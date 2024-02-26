#!/bin/bash

if [ ! -d "deployment/neo4j/data" ]; then
    echo "Neo4j is not setup yet ❌";
    exit 1
fi

source deployment/neo4j/.env

echo "Shutdown containers...";
docker compose  --env-file deployment/neo4j/.env -f neo4j/docker-compose.yml down
echo "Containers shutdown ✅";

./scripts/delete_volumes.sh deployment/neo4j/data deployment/neo4j/logs

rm -f deployment/neo4j/.env

dangling_volumes=$(docker volume ls -qf dangling=true)
if [ ! -z "$dangling_volumes" ]; then
    docker volume rm $dangling_volumes
fi
