#!/bin/bash

echo "Start all services ...";
docker compose  -f neo4j/docker-compose-llm.yml up -d
echo "All services have started ✅";
