#!/bin/bash

set -e 

if [[ $# -lt 3 ]]; then
    echo "Usage: ./neo4j/scripts/prepare_dot_env.sh <neo4j_version> <ext_apoc_version> <neosemantics_version> <gds_version> <neodash_version> <neo4j_username> <neo4j_password> <neo4j_pagecache> <neo4j_heapsize> <neodash_dashboard>"
    echo Example: ./neo4j/scripts/prepare_dot_env.sh 5.14.0 5.14.0 5.14.0 2.5.5 2.4.1 neo4j phac@2024 8G 16G "Dashboard"
    exit 1
fi

CURRENT_UID=$(id -u)
CURRENT_GID=$(id -g)

if [[ $(uname -s) == 'Linux' ]]; then
    INTERNAL_IP=$(ip route get 8.8.8.8 | grep -oP 'src \K[^ ]+')
    EXTERNAL_IP=$(curl --silent ifconfig.me)
elif [[ $(uname -s) == "Darwin" ]]; then
    if [[ ! -z $(which ggrep | grep 'not found') ]]; then
        echo Please install GNU grep
        exit 1
    fi
    INTERNAL_IP=$(ip route get 8.8.8.8 | ggrep -oP 'src \K[^ ]+')
    EXTERNAL_IP=$INTERNAL_IP
else
    echo Unsupported platform $(uname -s). Only Linux or MacOS are supported.
    exit 1
fi

NEO4J_VERSION=$1
NEO4J_CORE_APOC_VERSION=$1
NEO4J_EXTENDED_APOC_VERSION=$2
NEO4J_NEOSEMANTICS_VERSION=$3
NEO4J_GDS_VERSION=$4
NEODASH_VERSION=$5

NEO4J_USERNAME=$6
NEO4J_PASSWORD=$7

NEO4J_SERVER_MEMORY_PAGECACHE_SIZE=$8
NEO4J_SERVER_MEMORY_HEAP_INITIAL_SIZE=$9
NEO4J_SERVER_MEMORY_HEAP_MAX_SIZE=$9

NEODASH_DASHBOARD=${10}

DOT_ENV=deployment/neo4j/.env

cp neo4j/conf/.env.template ${DOT_ENV}

if [[ $(uname -s) == 'Linux' ]]; then

    sed -i s/CURRENT_UID=.*/CURRENT_UID=${CURRENT_UID}/g ${DOT_ENV}
    sed -i s/CURRENT_GID=.*/CURRENT_GID=${CURRENT_GID}/g ${DOT_ENV}

    sed -i s/INTERNAL_IP=.*/INTERNAL_IP=${INTERNAL_IP}/g ${DOT_ENV}
    sed -i s/EXTERNAL_IP=.*/EXTERNAL_IP=${EXTERNAL_IP}/g ${DOT_ENV}

    sed -i s/NEO4J_VERSION=.*/NEO4J_VERSION=${NEO4J_VERSION}/g ${DOT_ENV}
    sed -i s/NEO4J_CORE_APOC_VERSION=.*/NEO4J_CORE_APOC_VERSION=${NEO4J_CORE_APOC_VERSION}/g ${DOT_ENV}
    sed -i s/NEO4J_EXTENDED_APOC_VERSION=.*/NEO4J_EXTENDED_APOC_VERSION=${NEO4J_EXTENDED_APOC_VERSION}/g ${DOT_ENV}
    sed -i s/NEO4J_NEOSEMANTICS_VERSION=.*/NEO4J_NEOSEMANTICS_VERSION=${NEO4J_NEOSEMANTICS_VERSION}/g ${DOT_ENV}
    sed -i s/NEO4J_GDS_VERSION=.*/NEO4J_GDS_VERSION=${NEO4J_GDS_VERSION}/g ${DOT_ENV}
    sed -i s/NEODASH_VERSION=.*/NEODASH_VERSION=${NEODASH_VERSION}/g ${DOT_ENV}

    sed -i s/NEO4J_USERNAME=.*/NEO4J_USERNAME=${NEO4J_USERNAME}/g ${DOT_ENV}
    sed -i s/NEO4J_PASSWORD=.*/NEO4J_PASSWORD=${NEO4J_PASSWORD}/g ${DOT_ENV}

    sed -i s/NEO4J_SERVER_MEMORY_PAGECACHE_SIZE=.*/NEO4J_SERVER_MEMORY_PAGECACHE_SIZE=${NEO4J_SERVER_MEMORY_PAGECACHE_SIZE}/g ${DOT_ENV}
    sed -i s/NEO4J_SERVER_MEMORY_HEAP_INITIAL_SIZE=.*/NEO4J_SERVER_MEMORY_HEAP_INITIAL_SIZE=${NEO4J_SERVER_MEMORY_HEAP_INITIAL_SIZE}/g ${DOT_ENV}
    sed -i s/NEO4J_SERVER_MEMORY_HEAP_MAX_SIZE=.*/NEO4J_SERVER_MEMORY_HEAP_MAX_SIZE=${NEO4J_SERVER_MEMORY_HEAP_MAX_SIZE}/g ${DOT_ENV}

    sed -i "s/NEODASH_DASHBOARD=.*/NEODASH_DASHBOARD=\"${NEODASH_DASHBOARD}\"/g" ${DOT_ENV}

elif [[ $(uname -s) == "Darwin" ]]; then

    sed -i '' s/CURRENT_UID=.*/CURRENT_UID=${CURRENT_UID}/g ${DOT_ENV}
    sed -i '' s/CURRENT_GID=.*/CURRENT_GID=${CURRENT_GID}/g ${DOT_ENV}

    sed -i '' s/INTERNAL_IP=.*/INTERNAL_IP=${INTERNAL_IP}/g ${DOT_ENV}
    sed -i '' s/EXTERNAL_IP=.*/EXTERNAL_IP=${EXTERNAL_IP}/g ${DOT_ENV}

    sed -i '' s/NEO4J_VERSION=.*/NEO4J_VERSION=${NEO4J_VERSION}/g ${DOT_ENV}
    sed -i '' s/NEO4J_CORE_APOC_VERSION=.*/NEO4J_CORE_APOC_VERSION=${NEO4J_CORE_APOC_VERSION}/g ${DOT_ENV}
    sed -i '' s/NEO4J_EXTENDED_APOC_VERSION=.*/NEO4J_EXTENDED_APOC_VERSION=${NEO4J_EXTENDED_APOC_VERSION}/g ${DOT_ENV}
    sed -i '' s/NEO4J_NEOSEMANTICS_VERSION=.*/NEO4J_NEOSEMANTICS_VERSION=${NEO4J_NEOSEMANTICS_VERSION}/g ${DOT_ENV}
    sed -i '' s/NEO4J_GDS_VERSION=.*/NEO4J_GDS_VERSION=${NEO4J_GDS_VERSION}/g ${DOT_ENV}
    sed -i '' s/NEODASH_VERSION=.*/NEODASH_VERSION=${NEODASH_VERSION}/g ${DOT_ENV}

    sed -i '' s/NEO4J_USERNAME=.*/NEO4J_USERNAME=${NEO4J_USERNAME}/g ${DOT_ENV}
    sed -i '' s/NEO4J_PASSWORD=.*/NEO4J_PASSWORD=${NEO4J_PASSWORD}/g ${DOT_ENV}

    sed -i '' s/NEO4J_SERVER_MEMORY_PAGECACHE_SIZE=.*/NEO4J_SERVER_MEMORY_PAGECACHE_SIZE=${NEO4J_SERVER_MEMORY_PAGECACHE_SIZE}/g ${DOT_ENV}
    sed -i '' s/NEO4J_SERVER_MEMORY_HEAP_INITIAL_SIZE=.*/NEO4J_SERVER_MEMORY_HEAP_INITIAL_SIZE=${NEO4J_SERVER_MEMORY_HEAP_INITIAL_SIZE}/g ${DOT_ENV}
    sed -i '' s/NEO4J_SERVER_MEMORY_HEAP_MAX_SIZE=.*/NEO4J_SERVER_MEMORY_HEAP_MAX_SIZE=${NEO4J_SERVER_MEMORY_HEAP_MAX_SIZE}/g ${DOT_ENV}

    sed -i '' "s/NEODASH_DASHBOARD=.*/NEODASH_DASHBOARD=\"${NEODASH_DASHBOARD}\"/g" ${DOT_ENV}
fi