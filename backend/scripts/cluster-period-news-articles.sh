#!/bin/bash

device=$1

# python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-31 $device 2020-01-02
# python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-01 $device 2020-01-03
# python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-02 $device 2020-01-04
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-03 $device 2020-01-05
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-04 $device 2020-01-06

python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-31 $device 2020-01-06

# python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-31 $device 2020-01-29
