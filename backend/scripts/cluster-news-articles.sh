#!/bin/bash

if [[ $# -lt 1 ]]; then
    echo "Usage: ./scripts/cluster-news-articles.sh <device>"
    echo "where <device> is one of: cuda, mps."
    echo "For example on Ubuntu: ./scripts/cluster-news-articles.sh cuda"
    echo "For example on Mac OS: ./scripts/cluster-news-articles.sh mps"
    exit 1
fi

device=$1

python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-01 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-02 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-03 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-04 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-05 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-06 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-07 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-08 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-09 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-10 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-11 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-12 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-13 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-14 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-15 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-16 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-17 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-18 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-19 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-20 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-21 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-22 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-23 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-24 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-25 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-26 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-27 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-28 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-29 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-30 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-31 $device

#!/bin/bash

python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-01 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-02 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-03 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-04 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-05 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-06 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-07 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-08 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-09 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-10 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-11 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-12 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-13 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-14 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-15 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-16 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-17 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-18 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-19 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-20 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-21 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-22 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-23 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-24 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-25 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-26 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-27 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-28 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-29 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-30 $device
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-31 $device

python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-31 $device 2020-01-02
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-01 $device 2020-01-03
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-02 $device 2020-01-04
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-03 $device 2020-01-05
python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2020-01-04 $device 2020-01-06

python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-31 $device 2020-01-06

python pipeline/cluster-news-articles.py datasets datasets/country-codes.tsv 2019-12-31 $device 2020-01-29
