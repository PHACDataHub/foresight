/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Import Disease Ontology
//
CALL n10s.rdf.import.fetch("https://raw.githubusercontent.com/DiseaseOntology/HumanDiseaseOntology/main/src/ontology/releases/doid.owl", "RDF/XML");
//
WITH 
    "MATCH (r:Resource:Class)
        WHERE SIZE(r.label) > 0 OR r.IAO_0000115 IS NOT NULL OR r.hasExactSynonym IS NOT NULL
    WITH 
        r.uri AS url, 
        r.label AS label,
        CASE WHEN r.IAO_0000115 IS NOT NULL THEN r.IAO_0000115 ELSE '' END AS definition,
        CASE WHEN r.hasExactSynonym IS NOT NULL THEN r.hasExactSynonym ELSE [] END AS synonyms
    RETURN
        url, REPLACE(REPLACE(definition, '_', ' '), '\n', ' ') AS definition, label, synonyms"
    AS query
CALL apoc.export.csv.query(query, "disease-ontology.tsv", {delim: '\t', quotes: 'none', separateHeader: true})
YIELD file, source, format, nodes, relationships, properties, time, rows, batchSize, batches, done, data
RETURN file, source, format, nodes, relationships, properties, time, rows, batchSize, batches, done, data;
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Run process-disease-ontology.py separately to compute embedddings.
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Link resources with alternate ids
//
CALL apoc.periodic.iterate('
	MATCH (n:Resource:Class) 
        WHERE SIZE(n.hasAlternativeId) > 0
    RETURN n, n.hasAlternativeId AS id_list
','
	WITH n, id_list
        UNWIND id_list AS id
    WITH n, id
        MATCH (o:Resource:Class {id: id})
    WITH n, o
        FOREACH (dummy IN CASE WHEN n.id < o.id THEN [1] ELSE [] END |
            MERGE (n)<-[:ALTERNATE_ID]-(o)
        )
        FOREACH (dummy IN CASE WHEN o.id < n.id  THEN [1] ELSE [] END |
            MERGE (o)<-[:ALTERNATE_ID]-(n)
        )
    RETURN n.uri
',
{batchSize:10000, parallel:false})
YIELD total RETURN total;
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Import processed Disease Ontology (with vector embeddings)
//
CALL apoc.periodic.iterate('
	CALL apoc.load.json("file:///processed-disease-ontology.jsonl") YIELD value RETURN value AS doc
','
	WITH doc, apoc.coll.zip(doc.texts, doc.embeddings) AS text_embedding_list
        MATCH (r:Resource:Class {uri: doc.url})
    WITH doc, r, text_embedding_list
        UNWIND text_embedding_list AS text_embedding
    WITH doc, r, text_embedding[0] AS text, text_embedding[1] AS embeddings
    	MERGE (c:Chunk {text: text})
        MERGE (c)-[:PART_OF]->(r)
    WITH doc, r, c, embeddings
        CALL db.create.setNodeVectorProperty(c, "embeddings", embeddings)
    RETURN r.url
',
{batchSize:10000, parallel:true})
YIELD total RETURN total;
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
