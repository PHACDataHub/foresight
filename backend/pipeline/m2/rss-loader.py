from collections import defaultdict
import configparser
from datetime import datetime
import hashlib
import json
from queue import Queue
import random
import sys
from threading import Thread

from langchain_community.document_loaders import RSSFeedLoader
import listparser
import newspaper


def hash_text(text):
   return hashlib.sha256(str(text).encode('utf-8')).hexdigest()


def load_config(file_name):
    config = configparser.ConfigParser()
    config.read_file(open(file_name))
    return config


def load_yavuz_config(section, url_list):
    rss_dict = dict()
    file_name = f"{section['path']}/{eval(section['files'])[0]}"
    with open(file_name, 'rt') as in_file:
        rss_dict = json.load(in_file)
    
    for _, cty_info in rss_dict.items():
        for source in cty_info['newSources']:
            feed_url = source['feedUrls'][0]
            url = feed_url['url']
            url_list.append(url)
    print(f"[{file_name}] Read {len(url_list)} urls.")
    return url_list


def load_meta_config(section, url_list):
    file_name = f"{section['path']}/{eval(section['files'])[0]}"
    with open(file_name, 'rt') as in_file:
        for line in in_file.readlines():
            _, _, url = line.strip().split()
            url_list.append(url)
    print(f"[{file_name}] Read {len(url_list)} urls.")
    return url_list


def load_plenaryapp_config(section, url_list):
    file_path = section['path']
    for file_name in sorted(eval(section['files'])):
        full_file_name = f"{file_path}/{file_name}"
        with open(full_file_name, 'rt') as in_file:
            content = in_file.read()
            rss = listparser.parse(content)
            url_list.extend([feed.url for feed in rss.feeds])
            print(f"[{file_name}] Read {len(url_list)} urls.")
    return url_list


def load_gphin_config(section, url_list):
    file_name = f"{section['path']}/{eval(section['files'])[0]}"
    with open(file_name, 'rt') as in_file:
        content = in_file.read()
        rss = listparser.parse(content)
        url_list.extend([feed.url for feed in rss.feeds])
        print(f"[{file_name}] Read {len(url_list)} urls.")
    return url_list
    

def load_feed_task(worker_id, out_file_path, failed_url_file, sub_list):
    count = 0
    url_file_name = f"{out_file_path}/{worker_id}-{failed_url_file}"
    with open(url_file_name, 'wt') as url_out_file:
        for url in sub_list:
            count += 1
            loader = RSSFeedLoader(urls=[url], continue_on_failure=True, show_progress_bar=True)
            docs = loader.load()

            if not docs:
                url_out_file.write(f"{url}\n")
                continue
            print(f"[{count:3d}/{len(sub_list):3d}] [{len(docs)}] --- [{url}]", flush=True)

            s_time = datetime.now().strftime('%Y-%m-%dT%H-%M-%S')
            rss_file_name = f"{out_file_path}/{hash_text(url)}-{s_time}.jsonl"
            with open(rss_file_name, 'wt') as rss_out_file:
                for doc in docs:
                    d = {'page_content': doc.page_content}
                    for k, v in  doc.metadata.items():
                        if k == 'publish_date':
                            if isinstance(v, datetime):
                                v = v.strftime('%Y-%m-%dT%H-%M-%S')
                        d[k] = v
                    rss_out_file.write(f"{json.dumps(d)}\n")


def load_feed_work(url_list, n_workers, out_file_path, failed_url_file):
    random.shuffle(url_list)
    nr_urls = len(url_list)
    batch_size = nr_urls // n_workers
    
    sub_lists = []
    for i in range(0, n_workers-1):
        sub_lists.append(url_list[i * batch_size: (i+1) * batch_size])
    sub_lists.append(url_list[(n_workers - 1) * batch_size:])

    workers = []
    for i in range(0, n_workers):
        workers.append(Thread(target=load_feed_task, args=(i, out_file_path, failed_url_file, sub_lists[i],)))
        
    for i in range(0, n_workers):
        workers[i].start()
    
    for i in range(0, n_workers):
        workers[i].join()
    

if __name__ == '__main__':
    config_file_name = sys.argv[1]
    n_workers = int(sys.argv[2])

    config = load_config(config_file_name)
    out_file_path = config['output']['path']
    failed_url_file = config['output']['failed_urls']

    start_time = datetime.now()

    url_list = []
    url_list = load_yavuz_config(config['yavuz'], url_list)
    url_list = load_meta_config(config['meta'], url_list)
    url_list = load_plenaryapp_config(config['plenaryapp'], url_list)
    url_list = load_gphin_config(config['gphin'], url_list)
    print(f"Total {len(url_list)} urls.")
    
    url_set = list(set(url_list))
    print(f"Total {len(url_list)} unique urls.")
    
    load_feed_work(url_list, n_workers, out_file_path, failed_url_file)
    
    end_time = datetime.now()
    seconds = (end_time - start_time).total_seconds()
    print(f"Executed in {seconds} secs.", flush=True)
