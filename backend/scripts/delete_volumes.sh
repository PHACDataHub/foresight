#!/bin/bash

set -e

echo Deleting volumes ...
for item in $@
do
    echo  $item
    sudo rm -rf $item;
    echo volume $item deleted ✅
done
