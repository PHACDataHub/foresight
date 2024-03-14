#!/bin/bash

copy_data=$1

set -e

source deployment/neo4j/.env

echo 'Import Disease Ontology ...'
echo 'Copying scripts and data ...'
sudo cp neo4j/cql/import-disease-ontology.cql deployment/neo4j/import/.
if [ "$copy_data" = "copy" ]; then
    sudo cp datasets/processed/processed-disease-ontology.jsonl deployment/neo4j/import/processed/.
fi
echo 'Executing queries ...'
docker exec -u ${NEO4J_USERNAME} --interactive --tty  neo4j cypher-shell -u ${NEO4J_USERNAME} -p ${NEO4J_PASSWORD} --file /import/import-disease-ontology.cql
echo 'Disease Ontology imported ✅'

echo 'Import Disease Outbreak News ...'
echo 'Copying scripts and data ...'
sudo cp neo4j/cql/import-who-dons.cql deployment/neo4j/import/.
if [ "$copy_data" = "copy" ]; then
    sudo cp datasets/processed/processed-who-dons.jsonl deployment/neo4j/import/processed/.
fi
echo 'Executing queries ...'
docker exec -u ${NEO4J_USERNAME} --interactive --tty  neo4j cypher-shell -u ${NEO4J_USERNAME} -p ${NEO4J_PASSWORD} --file /import/import-who-dons.cql
echo 'Disease Outbreak News Articles imported ✅'

echo 'Import News Articles ...'
echo 'Copying scripts and data ...'
sudo cp neo4j/cql/import-news-articles.cql deployment/neo4j/import/.
if [ "$copy_data" = "copy" ]; then
    sudo cp datasets/processed/*-news-articles.jsonl deployment/neo4j/import/processed/.
    sudo cp datasets/processed/*-cls.jsonl deployment/neo4j/import/processed/.
    sudo cp datasets/processed/*-olq.jsonl deployment/neo4j/import/processed/.
    sudo cp datasets/processed/*-htp.jsonl deployment/neo4j/import/processed/.
fi
echo 'Executing queries ...'
docker exec -u ${NEO4J_USERNAME} --interactive --tty  neo4j cypher-shell -u ${NEO4J_USERNAME} -p ${NEO4J_PASSWORD} --file /import/import-news-articles.cql
echo 'Disease Outbreak News Articles imported ✅'
