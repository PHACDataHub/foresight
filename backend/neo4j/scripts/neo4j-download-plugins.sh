#!/bin/bash

set -e

source deployment/neo4j/.env

echo Downloading plugins into neo4j folder ...
echo 

if [ -f deployment/neo4j/plugins/apoc-${NEO4J_CORE_APOC_VERSION}-core.jar ]; then
    echo deployment/neo4j/plugins/apoc-${NEO4J_CORE_APOC_VERSION}-core.jar already downloaded.
else
    wget https://github.com/neo4j/apoc/releases/download/${NEO4J_CORE_APOC_VERSION}/apoc-${NEO4J_CORE_APOC_VERSION}-core.jar 
    sudo mv apoc-${NEO4J_CORE_APOC_VERSION}-core.jar deployment/neo4j/plugins/.
    echo 
fi

if [ -f deployment/neo4j/plugins/apoc-${NEO4J_EXTENDED_APOC_VERSION}-extended.jar ]; then
    echo deployment/neo4j/plugins/apoc-${NEO4J_EXTENDED_APOC_VERSION}-extended.jar already downloaded.
else
    wget https://github.com/neo4j-contrib/neo4j-apoc-procedures/releases/download/${NEO4J_EXTENDED_APOC_VERSION}/apoc-${NEO4J_EXTENDED_APOC_VERSION}-extended.jar 
    sudo mv apoc-${NEO4J_EXTENDED_APOC_VERSION}-extended.jar deployment/neo4j/plugins/.
    echo 
fi

if [ -f deployment/neo4j/plugins/neo4j-graph-data-science-${NEO4J_GDS_VERSION}.jar ]; then
    echo deployment/neo4j/plugins/neo4j-graph-data-science-${NEO4J_GDS_VERSION}.jar already downloaded.
else
    wget https://graphdatascience.ninja/neo4j-graph-data-science-${NEO4J_GDS_VERSION}.zip
    unzip neo4j-graph-data-science-${NEO4J_GDS_VERSION}.zip
    sudo mv neo4j-graph-data-science-${NEO4J_GDS_VERSION}.jar deployment/neo4j/plugins/.
    rm neo4j-graph-data-science-${NEO4J_GDS_VERSION}.zip
    echo 
fi

if [ -f deployment/neo4j/plugins/neosemantics-${NEO4J_NEOSEMANTICS_VERSION}.jar ]; then
    echo deployment/neo4j/plugins/neosemantics-${NEO4J_NEOSEMANTICS_VERSION}.jar already downloaded.
else
    wget https://github.com/neo4j-labs/neosemantics/releases/download/${NEO4J_NEOSEMANTICS_VERSION}/neosemantics-${NEO4J_NEOSEMANTICS_VERSION}.jar
    sudo mv neosemantics-${NEO4J_NEOSEMANTICS_VERSION}.jar deployment/neo4j/plugins/.
    echo 
fi

echo Plugins downloaded into neo4j ✅
echo 
