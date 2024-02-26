#!/bin/bash

if [ ! -d "deployment/neo4j/data" ]; then
    echo "Neo4j is not setup yet ❌";
    exit 1
fi

echo "Start all services ...";
docker compose  --env-file deployment/neo4j/.env -f neo4j/docker-compose.yml up -d
./scripts/wait_for_it.sh neo4j 60
echo "All services have started ✅";
