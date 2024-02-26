#!/bin/bash

set -e

source deployment/neo4j/.env

echo 'Memory recommendation ...'
docker exec -u ${NEO4J_USERNAME} --interactive --tty  neo4j bin/neo4j-admin server memory-recommendation
