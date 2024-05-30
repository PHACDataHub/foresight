#!/bin/bash

python pipeline/pht/multi-cat-classifier.py pipeline/pht/config/pht.ini ~/Downloads/test2.xlsx Input1 mistral
python pipeline/pht/multi-cat-classifier.py pipeline/pht/config/pht.ini ~/Downloads/test2.xlsx Input1 llama3
python pipeline/pht/multi-cat-classifier.py pipeline/pht/config/pht.ini ~/Downloads/test2.xlsx Input1 phi3