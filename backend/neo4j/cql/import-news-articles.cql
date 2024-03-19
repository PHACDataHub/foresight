/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Import News Articles
//
WITH
    [i IN RANGE(1, 31) | CASE WHEN i < 10 THEN '0' + TOSTRING(i) ELSE TOSTRING(i) END] AS days,
    ['2019-12-', '2020-01-'] AS months
    UNWIND months AS month
WITH days, month
    UNWIND days AS day
WITH month + day AS pub_date
    CALL apoc.periodic.iterate('
	    CALL apoc.load.json("file:///processed/" + $infile) YIELD value RETURN value AS doc
    ','
        WITH doc, SPLIT(SUBSTRING(doc.publicationdate, 0, 10), "-") AS splits
            MERGE (n:Article {id: doc.id})
                SET 
                    n.pub_date = DATE({year: TOINTEGER(splits[0]), month: TOINTEGER(splits[1]), day: TOINTEGER(splits[2])}),
                    n.pub_time = doc.publicationdate,
                    n.pub_name = doc.publicationname,
                    n.factiva_file_name = doc.originalfilename,
                    n.factiva_folder = doc.factivatopicfolder,
                    n.gphin_state = doc.state,
                    n.gphin_score = doc.score,
                    n.title = doc.title,
                    n.content = doc.content
        WITH doc, n, apoc.coll.zip(doc.chunks, doc.embeddings) AS chunk_embeddings_list
        WITH doc, n, chunk_embeddings_list
            UNWIND chunk_embeddings_list AS chunk_embeddings
        WITH doc, n, chunk_embeddings[0] AS chunk, chunk_embeddings[1] AS embeddings
            MERGE (c:Chunk {text: chunk})
            MERGE (c)-[:PART_OF]->(n)
        WITH doc, n, c, embeddings
            CALL db.create.setNodeVectorProperty(c, "embeddings", embeddings)
        RETURN DISTINCT(n.url) AS url
    ',
    {params: {infile: 'processed-' + pub_date + '-news-articles.jsonl'}, batchSize:10000, parallel:true})
    YIELD total RETURN total;
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Import Article Clusters
//
WITH
    [i IN RANGE(1, 31) | CASE WHEN i < 10 THEN '0' + TOSTRING(i) ELSE TOSTRING(i) END] AS days,
    ['2019-12-', '2020-01-'] AS months
    UNWIND months AS month
WITH days, month
    UNWIND days AS day
WITH month + day AS pub_date
WITH COLLECT(pub_date) AS days
WITH days + [
    '2019-12-31-2020-01-02', '2020-01-01-2020-01-03', '2020-01-02-2020-01-04', '2020-01-03-2020-01-05',
    '2020-01-04-2020-01-06', '2020-01-05-2020-01-07', '2020-01-06-2020-01-08', 
    '2019-12-31-2020-01-06', '2019-12-31-2020-01-29' 
    ] AS days
    UNWIND days AS pub_date
    CALL apoc.periodic.iterate('
        CALL apoc.load.json("file:///processed/enriched-" + $pub_date + "-cls.jsonl") YIELD value AS cluster_map
        WITH cluster_map, apoc.coll.sort(KEYS(cluster_map)) AS topics
            UNWIND topics AS topic
        WITH topic, cluster_map[topic] AS cluster
        	WHERE cluster.labels <> "Outliers"
        RETURN topic, cluster
    ','
        WITH topic, cluster, 
            SPLIT(SUBSTRING($pub_date, 0, 10), "-") AS start_date_splits,
            CASE WHEN SIZE($pub_date) > 20 THEN SPLIT(SUBSTRING($pub_date, 11, 10), "-") ELSE [] END AS end_date_splits
        WITH topic, cluster, 
            DATE({year: TOINTEGER(start_date_splits[0]), month: TOINTEGER(start_date_splits[1]), day: TOINTEGER(start_date_splits[2])}) AS start_date,
            CASE WHEN SIZE(end_date_splits) > 0 THEN DATE({year: TOINTEGER(end_date_splits[0]), month: TOINTEGER(end_date_splits[1]), day: TOINTEGER(end_date_splits[2])}) ELSE NULL END AS end_date
            MERGE (c:Cluster {id: $pub_date + "-" + TOSTRING(topic)})
                SET c.summary = cluster.summary,
                    c.answers = apoc.convert.toJson(cluster.qa),
                    c.title = CASE WHEN cluster.labels[0] IS NULL THEN cluster.name ELSE cluster.labels[0] END,
                    c.labels = cluster.labels,
                    c.keywords = cluster.keywords,
                    c.topic_id = topic,
                    c.countries = CASE WHEN cluster.loc["countries"] IS NOT NULL THEN cluster.loc["countries"] ELSE NULL END,
                    c.locations = CASE WHEN cluster.loc["locations"] IS NOT NULL THEN  apoc.convert.toJson(cluster.loc["locations"]) ELSE NULL END,
                    c.representative_docs = [d IN cluster.representative_docs | d[1]],
                    c.start_date = start_date,
                    c.end_date =  end_date 
        WITH c, cluster
            FOREACH (article IN cluster.articles  |
                MERGE (a:Article {id: article[1]})
                    SET a.probability = article[2],
                        a.prob_size = article[2] * 10 
                MERGE (c)<-[:IN_CLUSTER {probability: article[2]}]-(a)
            )
            FOREACH (threat IN cluster.threats |
                MERGE (t:Threat {text: threat})
                MERGE (c)-[r:DETECTED_THREAT]->(t)
            )
        RETURN c.id
    ',
    {params: {pub_date: pub_date}, batchSize:1000, parallel:false})
    YIELD total RETURN total;
//
MATCH (c:Cluster)<-[:IN_CLUSTER]-(a:Article)
WITH DISTINCT(c) AS c, COUNT(DISTINCT(a)) AS count
SET c.nr_articles = count/10;
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Import Outlier Articles
//
WITH
    [i IN RANGE(1, 31) | CASE WHEN i < 10 THEN '0' + TOSTRING(i) ELSE TOSTRING(i) END] AS days,
    ['2019-12-', '2020-01-'] AS months
    UNWIND months AS month
WITH days, month
    UNWIND days AS day
WITH month + day AS pub_date
WITH COLLECT(pub_date) AS days
    UNWIND days AS pub_date
    CALL apoc.periodic.iterate('
        CALL apoc.load.json("file:///processed/enriched-" + $pub_date + "-olq.jsonl") YIELD value AS cluster_map
        WITH cluster_map, apoc.coll.sort(KEYS(cluster_map)) AS topics
            UNWIND topics AS topic
        WITH topic, cluster_map[topic] AS cluster
        	WHERE cluster.labels = "Outliers"
        RETURN cluster.enriched_articles AS articles, KEYS(cluster.enriched_articles) AS ids
    ','
        WITH articles, ids
            UNWIND ids AS id
        WITH id, articles[id] AS article
            MERGE (n:Article {id: TOINTEGER(id)})
                SET n:Outlier,
                    n.probability = article.probability,
                    n.prob_size = article.probability * 10,
                    n.disease_question = article.filter,
                    n.summary = article.summary,
                    n.answers = apoc.convert.toJson(article.qa)
        RETURN id
    ',
    {params: {pub_date: pub_date}, batchSize:1000, parallel:false})
    YIELD total RETURN total;
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Import Hierarchical Topics
//
CALL apoc.periodic.iterate('
    WITH
        [i IN RANGE(1, 31) | CASE WHEN i < 10 THEN "0" + TOSTRING(i) ELSE TOSTRING(i) END] AS days,
        ["2019-12-", "2020-01-"] AS months
        UNWIND months AS month
    WITH days, month
        UNWIND days AS day
    WITH month + day AS pub_date
    WITH COLLECT(pub_date) AS days
    WITH days + [
        "2019-12-31-2020-01-02", "2020-01-01-2020-01-03", "2020-01-02-2020-01-04", "2020-01-03-2020-01-05",
        "2020-01-04-2020-01-06", "2020-01-05-2020-01-07", "2020-01-06-2020-01-08", 
        "2019-12-31-2020-01-06", "2019-12-31-2020-01-29" 
        ] AS days
        UNWIND days AS pub_date
    RETURN pub_date
','
    WITH pub_date
    CALL apoc.load.json("file:///processed/processed-" +  pub_date + "-htp.jsonl") YIELD value AS row
    WITH COLLECT(row) AS rows, pub_date
    WITH rows, pub_date,
        REDUCE(m=0, r IN rows | CASE WHEN m = 0 OR m > TOINTEGER(r["Parent_ID"]) THEN TOINTEGER(r["Parent_ID"]) ELSE m END) AS min_id
    WITH rows, min_id, pub_date
        UNWIND rows AS row
    WITH row, min_id, pub_date,
        TOINTEGER(row["Parent_ID"]) AS parent_id,
        TOINTEGER(row["Child_Left_ID"]) AS child_left_id,
        TOINTEGER(row["Child_Right_ID"]) AS child_right_id
        MERGE (p:HierarchicalCluster {id: pub_date + "-" + row["Parent_ID"]})
            SET p.clusters = row["Topics"], p.name = row["Parent_Name"]
        FOREACH (dummy IN CASE WHEN min_id > child_left_id THEN [1] ELSE [] END |
            MERGE (c:Cluster {id: pub_date + "-" + row["Child_Left_ID"]})
                SET c.name = row["Child_Left_Name"]
            MERGE (p)-[:CONTAINS {side: "left"}]->(c)
        )
        FOREACH (dummy IN CASE WHEN min_id <= child_left_id THEN [1] ELSE [] END |
            MERGE (c:HierarchicalCluster {id: pub_date + "-" + row["Child_Left_ID"]})
                SET c.name = row["Child_Left_Name"]
            MERGE (p)-[:CONTAINS {side: "left"}]->(c)
        )
        FOREACH (dummy IN CASE WHEN min_id > child_right_id THEN [1] ELSE [] END |
            MERGE (c:Cluster {id: pub_date + "-" + child_right_id})
                SET c.name = row["Child_Right_Name"]
            MERGE (p)-[:CONTAINS {side: "right"}]->(c)
        )
        FOREACH (dummy IN CASE WHEN min_id <= child_right_id THEN [1] ELSE [] END |
            MERGE (c:HierarchicalCluster {id: pub_date + "-" + row["Child_Right_ID"]})
                SET c.name = row["Child_Right_Name"]
            MERGE (p)-[:CONTAINS {side: "right"}]->(c)
        )
    RETURN DISTINCT(pub_date);
',
{batchSize:1000, parallel:false})
YIELD total RETURN total;
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Connect simmilar articles within the same cluster
//
WITH
    [i IN RANGE(1, 31) | CASE WHEN i < 10 THEN "0" + TOSTRING(i) ELSE TOSTRING(i) END] AS days,
    ["2019-12-", "2020-01-"] AS months
    UNWIND months AS month
WITH days, month
    UNWIND days AS day
WITH month + day AS pub_date
WITH COLLECT(pub_date) AS days
WITH days + [
    "2019-12-31-2020-01-02", "2020-01-01-2020-01-03", "2020-01-02-2020-01-04", "2020-01-03-2020-01-05",
    "2020-01-04-2020-01-06", "2020-01-05-2020-01-07", "2020-01-06-2020-01-08", 
    "2019-12-31-2020-01-06", "2019-12-31-2020-01-29" 
    ] AS days
    UNWIND days AS pub_date
    CALL apoc.periodic.iterate('
        CALL apoc.load.json("file:///processed/processed-" + $pub_date + "-smf.jsonl") YIELD value AS cluster_list
        WITH cluster_list["id_list"] AS similarity_list
            WHERE SIZE(similarity_list) > 0
        RETURN similarity_list
    ',' 
        WITH similarity_list
            UNWIND similarity_list AS similarity
        WITH similarity[0] AS start_id, similarity[1] AS end_id, similarity[2] AS score
            MERGE (s:Article {id: start_id})
            MERGE (e:Article {id: end_id})
            MERGE (s)-[r:SIMILAR_TO]->(e)
                SET r.score = score,
                    r.period = $pub_date
        RETURN COUNT(*) AS number_of_similarities
    ',
    {params: {pub_date: pub_date}, batchSize:1000, parallel:false})
    YIELD total RETURN total;
//
// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
