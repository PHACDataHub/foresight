#!/bin/bash

if [ ! -d "deployment/neo4j/data" ]; then
    echo "Neo4j is not setup yet ❌";
    exit 1
fi

source deployment/neo4j/.env

echo "Stopping containers...";
docker compose  --env-file deployment/neo4j/.env -f neo4j/docker-compose.yml stop
echo "Containers stopped ✅";
