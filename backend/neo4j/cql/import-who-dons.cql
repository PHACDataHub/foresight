/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Import WHO Disease Outbreak News Articles
//
CALL apoc.periodic.iterate('
	CALL apoc.load.json("file:///processed-who-dons.jsonl") YIELD value RETURN value AS doc
','
	WITH doc, SPLIT(doc.report_date, " ") AS splits
    	MERGE (n:DON {url: doc.url})
    		SET 
                n.answers = apoc.convert.toJson(doc.answers),
                n.content = doc.content,
                n.countries = doc.countries,
				n.report_date = DATE({year: TOINTEGER(splits[2]), month: CASE WHEN splits[1] = "December" THEN 12 ELSE 1 END, day: TOINTEGER(splits[0])}),
                n.summary = doc.summary,
                n.title = doc.title
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
{batchSize:1000, parallel:false})
YIELD total RETURN total;
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Create threats and connect WHO Disease Outbreak News Articles
//
WITH [
    'Outbreaks of known infectious diseases',
    'Emerging infectious diseases or novel pathogens',
    'Hurricanes, earthquakes, floods, wildfires, and their health impacts',
    'Effects on health infrastructure and services during disasters',
    'Air pollution levels and associated health risks',
    'Water contamination issues and their health implications',
    'Chemical spills or industrial accidents affecting public health',
    'Health implications of accidents in industrial settings',
    'Potential biological attacks or bioterrorism threats',
    'Reports on suspicious disease-related incidents', 
    'Reports on suspicious drug-related incidents', 
    'Foodborne illness outbreaks and recalls',
    'Waterborne diseases and contamination alerts',
    'Incidents involving radiation exposure and their health consequences',
    'Extreme weather events and health advisories',
    'Health implications of changing climate patterns',
    'Outbreaks linked to vaccine-preventable diseases',
    'Controversies or developments in vaccination policies',
    'Security breaches or cyberattacks on healthcare systems',
    'Risks to patient data and healthcare services',
    'Evaluations of healthcare system readiness during emergencies',
    'Reports on hospital capacity during crises or emergencies',
    'Drug recalls, counterfeit drugs, and safety concerns',
    'Issues with medical device safety, recalls, and their impact on health',
    'Unusual health patterns',
    'Emerging pathogens',
    'Abnormal environmental indicators',
    'Unforeseen health outcomes',
    'Anomalous disease clusters',
    'Unrecognized health risks',
    'Atypical health incidents'
] AS threats
    UNWIND threats AS threat
WITH threat
    MERGE (t:Threat {text: threat})
RETURN t.text;
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Connect WHO Disease Outbreak News Articles
//
CALL apoc.periodic.iterate('
    CALL apoc.load.json("file:///processed-who-dons.jsonl") YIELD value RETURN value AS doc
','
    WITH doc, KEYS(doc.topics) AS threats
        MERGE (n:DON {url: doc.url})
	WITH doc, n, threats
        UNWIND threats AS threat
    WITH doc, n, doc.topics[threat] AS score, threat
        MERGE (t:Threat {text: threat})
        MERGE (n)-[r:DETECTED_THREAT]->(t)
            SET t.score = score
    RETURN DISTINCT(n.url) AS url, COLLECT(DISTINCT(t.text)) AS threats
',
{batchSize:1000, parallel:false})
YIELD total RETURN total;
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Detect similar chunks
//
CALL apoc.periodic.iterate("
    MATCH (a:DON)<-[:PART_OF]-(c1:Chunk)
        WITH a, c1
            CALL db.index.vector.queryNodes('text-chunk', 100, c1.embeddings)
            YIELD node AS c2, score AS s
    WITH a, c1, c2, s
        WHERE c1 <> c2 AND s >= $cutoff
    WITH a, c1, c2, s
        MATCH (c2)-[:PART_OF]->(d:Resource:Class)
    RETURN a, c1, c2, d, s
","
    WITH a, c1, c2, d, s
        MERGE (c1)-[r:SIMILAR_D2D_CHUNK]->(c2)
        SET r.score = s;
",
{params: {cutoff: 0.75}, batchSize:1000, parallel:false})
YIELD total RETURN total;
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Detect disease in WHO Disease Outbreak News Articles with 
//
CALL apoc.periodic.iterate("
    MATCH (a:DON)<-[:PART_OF]-(:Chunk)-[r:SIMILAR_D2D_CHUNK]->(:Chunk)-[:PART_OF]->(d:Resource:Class)
        WHERE r.score >= $cutoff
    WITH DISTINCT([a, d]) AS pair, COLLECT(r.score) AS s_coll
    WITH pair[0] AS a, pair[1] AS d, apoc.coll.sort(s_coll) AS coll, apoc.coll.sum(s_coll) AS sum
    WITH DISTINCT(a) AS a, COLLECT([d, coll, sum]) AS dcs_coll
    WITH a, REDUCE(l=[], e IN dcs_coll | CASE WHEN SIZE(l) = 0 OR e[2] > l[2] THEN e ELSE l END) AS h
    RETURN a, h[0] AS d, h[1] AS coll, h[2] AS sum
","
    WITH a, d, coll, sum
        MERGE (a)-[r:DETECTED_DISEASE]->(d)
        SET r.score = sum,
            r.scores = coll;
",
{params: {cutoff: 0.75}, batchSize:1000, parallel:false})
YIELD total RETURN total;
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
