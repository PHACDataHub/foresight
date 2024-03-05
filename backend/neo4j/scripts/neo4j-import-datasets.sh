#!/bin/bash

set -e

source deployment/neo4j/.env

echo 'Import Disease Ontology ...'
sudo cp neo4j/cql/import-disease-ontology.cql deployment/neo4j/import/.
sudo cp datasets/processed-disease-ontology.jsonl deployment/neo4j/import/.
docker exec -u ${NEO4J_USERNAME} --interactive --tty  neo4j cypher-shell -u ${NEO4J_USERNAME} -p ${NEO4J_PASSWORD} --file /import/import-disease-ontology.cql
echo 'Disease Ontology imported ✅'

echo 'Import Disease Outbreak News ...'
sudo cp neo4j/cql/import-who-dons.cql deployment/neo4j/import/.
sudo cp datasets/processed-who-dons.jsonl deployment/neo4j/import/.
docker exec -u ${NEO4J_USERNAME} --interactive --tty  neo4j cypher-shell -u ${NEO4J_USERNAME} -p ${NEO4J_PASSWORD} --file /import/import-who-dons.cql
echo 'Disease Outbreak News Articles imported ✅'

echo 'Import News Articles ...'
sudo cp neo4j/cql/import-news-articles.cql deployment/neo4j/import/.
sudo cp datasets/processed-2019*-news-articles.jsonl deployment/neo4j/import/.
sudo cp datasets/processed-2020*-news-articles.jsonl deployment/neo4j/import/.
sudo cp datasets/2019*-clusters.jsonl deployment/neo4j/import/.
sudo cp datasets/2020*-clusters.jsonl deployment/neo4j/import/.
docker exec -u ${NEO4J_USERNAME} --interactive --tty  neo4j cypher-shell -u ${NEO4J_USERNAME} -p ${NEO4J_PASSWORD} --file /import/import-who-dons.cql
echo 'Disease Outbreak News Articles imported ✅'
