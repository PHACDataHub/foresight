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
	    CALL apoc.load.json("file:///" + $infile) YIELD value RETURN value AS doc
    ','
        WITH doc, SPLIT(doc.publicationdate, "-") AS splits
            MERGE (n:Article {id: doc.id})
                SET 
                    n.pub_date = DATE({year: TOINTEGER(splits[2]), month: CASE WHEN splits[1] = "December" THEN 12 ELSE 1 END, day: TOINTEGER(splits[0])}),
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
        RETURN n.url
    ',
    {params: {infile: 'processed-' + pub_date + '-news-articles.jsonl'}, batchSize:1000, parallel:false})
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
    '2019-12-31-2020-01-02', '2020-01-01-2019-01-03', '2020-01-02-2020-01-04', '2020-01-03-2020-01-05',
    '2020-01-04-2020-01-06', '2020-01-05-2019-01-07', '2020-01-06-2020-01-08', 
    '2019-12-31-2020-01-06', 
    '2019-12-31-2020-01-29' 
    ] AS days
    UNWIND days AS pub_date
    CALL apoc.periodic.iterate('
        CALL apoc.load.json("file:///" + $pub_date + "-clusters.jsonl") YIELD value AS cluster_map
        WITH cluster_map, apoc.coll.sort(KEYS(cluster_map)) AS topics
            UNWIND topics AS topic
        WITH topic, cluster_map[topic] AS cluster
        	WHERE cluster.label <> "Outlier Topic"
        RETURN topic, cluster
    ','
        WITH topic, cluster 
            MERGE (c:Cluster {id: $pub_date + "-" + TOSTRING(topic)})
                SET c.summary = cluster.summary,
                    c.answers = apoc.convert.toJson(cluster.answers),
                    c.title = cluster.label
        WITH c, cluster
            FOREACH (article_id IN cluster.id_list  |
                MERGE (a:Article {id: article_id})
                MERGE (c)<-[:IN_CLUSTER]-(a)
            )
            FOREACH (threat IN KEYS(cluster.threats) |
                MERGE (t:Threat {text: threat})
                MERGE (c)-[r:DETECTED_THREAT]->(t)
                    SET r.score = cluster.threats[threat]
            )
        RETURN c
    ',
    {params: {pub_date: pub_date}, batchSize:1000, parallel:false})
    YIELD total RETURN total;
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
