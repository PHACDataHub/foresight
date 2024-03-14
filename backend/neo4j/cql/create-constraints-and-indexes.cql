/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Creating constraints and indexes for WHO Disease Outbreak News articles
//
CREATE CONSTRAINT url_don IF NOT EXISTS FOR (n:DON) REQUIRE n.url IS UNIQUE;
CREATE INDEX report_date_don IF NOT EXISTS FOR (n:DON) ON (n.report_date);
CREATE TEXT INDEX summary_don IF NOT EXISTS FOR (n:DON) ON (n.summary);
//
//
// Public Health Threat
//
CREATE CONSTRAINT text_threat IF NOT EXISTS FOR (n:Threat) REQUIRE n.text IS UNIQUE;
//
//
// Chunks
//
CREATE CONSTRAINT chunk_resource IF NOT EXISTS FOR (n:Chunk) REQUIRE n.text IS UNIQUE;
//
//
// Down Jones News Articles
//
CREATE CONSTRAINT id_article IF NOT EXISTS FOR (n:Article) REQUIRE n.id IS UNIQUE;
CREATE TEXT INDEX title_article IF NOT EXISTS FOR (n:Article) ON (n.title);
CREATE INDEX pub_date_article IF NOT EXISTS FOR (n:Article) ON (n.pub_date);
CREATE TEXT INDEX pub_name_article IF NOT EXISTS FOR (n:Article) ON (n.pub_name);
CREATE INDEX keywords_article IF NOT EXISTS FOR (n:Article) ON (n.keyword);
//
CREATE TEXT INDEX summary_article IF NOT EXISTS FOR (n:Article) ON (n.summary);
CREATE CONSTRAINT id_outlier IF NOT EXISTS FOR (n:Outlier) REQUIRE n.id IS UNIQUE;
//
//
// Clusters
//
CREATE CONSTRAINT id_cluster IF NOT EXISTS FOR (n:Cluster) REQUIRE n.id IS UNIQUE;
CREATE TEXT INDEX summary_cluster IF NOT EXISTS FOR (n:Cluster) ON (n.summary);
//
//
// Hierarchical Cluster
//
CREATE CONSTRAINT id_cluster IF NOT EXISTS FOR (n:HierarchicalCluster) REQUIRE n.id IS UNIQUE;
CREATE TEXT INDEX name_cluster IF NOT EXISTS FOR (n:HierarchicalCluster) ON (n.name);
//
//
// Create vector index for embeddings
CALL db.index.vector.createNodeIndex('text-chunk', 'Chunk', 'embeddings', 384, 'COSINE');
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Create unique constraint
//
CREATE CONSTRAINT n10s_unique_uri IF NOT EXISTS FOR (r:Resource) REQUIRE r.uri IS UNIQUE;
CREATE TEXT INDEX id_resource IF NOT EXISTS FOR (n:Resource) ON (n.id);
CREATE TEXT INDEX label_resource IF NOT EXISTS FOR (n:Resource) ON (n.label);
CREATE TEXT INDEX synonym_resource IF NOT EXISTS FOR (n:Resource) ON (n.hasExactSynonym);
//
WITH '<rdf:RDF xmlns="http://purl.obolibrary.org/obo/doid.owl#"
     xml:base="http://purl.obolibrary.org/obo/doid.owl"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:obo="http://purl.obolibrary.org/obo/"
     xmlns:owl="http://www.w3.org/2002/07/owl#"
     xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
     xmlns:xml="http://www.w3.org/XML/1998/namespace"
     xmlns:xsd="http://www.w3.org/2001/XMLSchema#"
     xmlns:doid="http://purl.obolibrary.org/obo/doid#"
     xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
     xmlns:skos="http://www.w3.org/2004/02/skos/core#"
     xmlns:terms="http://purl.org/dc/terms/"
     xmlns:oboInOwl="http://www.geneontology.org/formats/oboInOwl#"' AS text
    CALL n10s.nsprefixes.addFromText(text) yield prefix, namespace
RETURN prefix, namespace;
//
// Setting the configuration of the graph
CALL n10s.graphconfig.init({  handleVocabUris: "IGNORE", classLabel: "DO_Disease", subClassOfRel: "HAS_PARENT", handleMultival: "ARRAY", multivalPropList: ['http://www.geneontology.org/formats/oboInOwl#hasAlternativeId', 'http://www.geneontology.org/formats/oboInOwl#hasExactSynonym', 'http://www.geneontology.org/formats/oboInOwl#hasDbXref']});
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
