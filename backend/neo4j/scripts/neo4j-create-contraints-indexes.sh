#!/bin/bash

set -e

source deployment/neo4j/.env

echo 'Creating constraints and indexes ...'
sudo cp neo4j/cql/create-constraints-and-indexes.cql deployment/neo4j/import/.
docker exec -u ${NEO4J_USERNAME} --interactive --tty  neo4j cypher-shell -u ${NEO4J_USERNAME} -p ${NEO4J_PASSWORD} --file /import/create-constraints-and-indexes.cql
echo 'Constraints and indexes are created ✅'
