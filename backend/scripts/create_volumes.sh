#!/bin/bash

set -e

CURRENT_UID=$(id -u)
CURRENT_GID=$(id -g)

for item in $@
do
    echo  $item
    mkdir -p $item;
    sudo chown -R $CURRENT_UID $item;
    sudo chgrp -R $CURRENT_GID $item;
    sudo chmod -R u+rwX,g+rX,o+wrx $item;
    echo $item 'volume is created ✅'
done
