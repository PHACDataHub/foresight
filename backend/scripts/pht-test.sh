#!/bin/bash

# python pipeline/pht/multi-cat-classifier.py pipeline/pht/config/pht.ini ~/Downloads/test2.xlsx Input1 mistral
# python pipeline/pht/multi-cat-classifier.py pipeline/pht/config/pht.ini ~/Downloads/test2.xlsx Input1 llama3
# python pipeline/pht/multi-cat-classifier.py pipeline/pht/config/pht.ini ~/Downloads/test2.xlsx Input1 phi3

# python pipeline/pht/multi-cat-classifier.py pipeline/pht/config/pht.ini ~/Downloads/test3.xlsx Input3 mistral
# python pipeline/pht/multi-cat-classifier.py pipeline/pht/config/pht.ini ~/Downloads/test3.xlsx Input3 mixtral
# python pipeline/pht/multi-cat-classifier.py pipeline/pht/config/pht.ini ~/Downloads/test3.xlsx Input3 llama3
# python pipeline/pht/multi-cat-classifier.py pipeline/pht/config/pht.ini ~/Downloads/test3.xlsx Input3 gemma

python pipeline/pht/multi-cat-classifier.py pipeline/pht/config/pht.ini ~/Downloads/test4.xlsx Input4 mistral