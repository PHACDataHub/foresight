from collections import defaultdict
import configparser
from datetime import datetime
import hashlib
import json
import newspaper
from newspaper import Article, Config, news_pool
from queue import Queue
import requests
import random
import sys
from threading import Thread

# from langchain_community.document_loaders import RSSFeedLoader
import feedparser
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
    file_name = section['file']
    with open(file_name, 'rt') as in_file:
        rss_dict = json.load(in_file)
    
    for _, cty_info in rss_dict.items():
        for source in cty_info['newSources']:
            feed_url = source['feedUrls'][0]
            url = feed_url['url']
            url_list.append([url, 'yavuz'])
    print(f"[{file_name}] Read {len(url_list)} YAVUZ urls.")


def load_meta_config(section, url_list):
    file_name = section['file']
    with open(file_name, 'rt') as in_file:
        for line in in_file.readlines():
            _, _, url = line.strip().split()
            url_list.append([url, 'meta'])
    print(f"[{file_name}] Read {len(url_list)} META urls.")


def load_plenaryapp_config(section, url_list):
    file_path = section['path']
    for file_name in sorted(eval(section['files'])):
        full_file_name = f"{file_path}/{file_name}"
        with open(full_file_name, 'rt') as in_file:
            content = in_file.read()
            rss = listparser.parse(content)
            url_list.extend([[feed.url, 'plenaryapp']  for feed in rss.feeds])
            print(f"[{file_name}] Read {len(url_list)} PLENARYAPP urls.")


def load_gphin_config(section, url_list):
    file_name = section['file']
    with open(file_name, 'rt') as in_file:
        content = in_file.read()
        rss = listparser.parse(content)
        url_list.extend([[feed.url, 'gphin'] for feed in rss.feeds])
        print(f"[{file_name}] Read {len(url_list)} GPHIN-CG urls.")
    return url_list


def load_failed_urls(section):
    file_name = section['failed_url']
    with open(file_name, 'rt') as in_file:
        url_list = [line.strip().split('\t')[1] for line in in_file.readlines()]
        print(f"[{file_name}] Read {len(url_list)} FAILED urls.")
    return url_list


def filter_url_task(worker_id, timeout, out_file_path, failed_url_file, sub_list):
    count = 0
    url_file_name = f"{out_file_path}/{worker_id}-{failed_url_file}"
    with open(url_file_name, 'wt') as url_out_file:
        for url, sources in sub_list:
            count += 1
            try:
                r = requests.get(url, timeout=timeout)
                if r.status_code == 302:
                    r = requests.get(r.href, timeout=timeout)
                
                if r.status_code == 200:
                    feed = feedparser.parse(r.text)
                    if getattr(feed, "bozo", False):
                        url_out_file.write(f"{sources}\t{url}\t{feed.bozo_exception}\n")
                        continue
                    
                    s_time = datetime.now().strftime('%Y-%m-%dT%H-%M-%S')
                    rss_file_name = f"{out_file_path}/{sources}-{hash_text(url)}-{s_time}.json"
                    with open(rss_file_name, 'wt') as rss_out_file:
                        json.dump(feed, rss_out_file)
                    print(f">>> [{worker_id}] [{count:3d}/{len(sub_list):3d}] --- {s_time} --- [{url}] --- [{len(feed.entries)}]", flush=True)
                    
                elif r.status_code != 304:
                    url_out_file.write(f"{sources}\t{url}\t{r.status_code}\n")
                
            except Exception as e:
                url_out_file.write(f"{sources}\t{url}\t{e}\n")
    

def filter_url_work(url_list, n_workers, timeout, out_file_path, failed_url_file):
    random.shuffle(url_list)
    nr_urls = len(url_list)
    batch_size = nr_urls // n_workers
    
    sub_lists = []
    for i in range(0, n_workers-1):
        sub_lists.append(url_list[i * batch_size: (i+1) * batch_size])
    sub_lists.append(url_list[(n_workers - 1) * batch_size:])

    workers = []
    for i in range(0, n_workers):
        workers.append(Thread(target=filter_url_task, args=(i, timeout, out_file_path, failed_url_file, sub_lists[i],)))
        
    for i in range(0, n_workers):
        workers[i].start()
    
    for i in range(0, n_workers):
        workers[i].join()


def load_feed_task(worker_id, timeout, sub_list, queue):
    count = 0
    urls = []
    for url in sub_list:
        count += 1
        s_time = datetime.now().strftime('%Y-%m-%dT%H-%M-%S')
        try:
            r = requests.get(url, timeout=timeout)
            if r.status_code == 302:
                r = requests.get(r.href, timeout=timeout)
            
            if r.status_code == 200:
                feed = feedparser.parse(r.text)
                if getattr(feed, "bozo", False):
                    continue
                if len(feed.entries) > 0:
                    urls.extend([entry.link for entry in feed.entries])
                    print(f">>> [{worker_id}] [{count:3d}/{len(sub_list):3d}] --- {s_time} --- [{url}] --- [{len(feed.entries)}]", flush=True)
        except Exception as e:
            print(f"--- [{worker_id}] [{count:3d}/{len(sub_list):3d}] --- {s_time} --- [{url}] --- [{e}]", flush=True)

    queue.put(urls)
    print(f"Quit {worker_id}.", flush=True)
    

def load_feed_work(url_list, n_workers, timeout):
    random.shuffle(url_list)
    nr_urls = len(url_list)
    batch_size = nr_urls // n_workers
    
    sub_lists = []
    for i in range(0, n_workers-1):
        sub_lists.append(url_list[i * batch_size: (i+1) * batch_size])
    sub_lists.append(url_list[(n_workers - 1) * batch_size:])

    output_queue = Queue()
    workers = []
    for i in range(0, n_workers):
        workers.append(Thread(target=load_feed_task, args=(i, timeout, sub_lists[i], output_queue,)))
        
    for i in range(0, n_workers):
        workers[i].start()
    
    for i in range(0, n_workers):
        workers[i].join()

    output_urls = []
    task_count = 0
    while True:
        urls = output_queue.get()
        if urls is None:
            break
        
        task_count += 1
        output_urls.extend(urls)
        if task_count == n_workers:
            break
    return output_urls


def load_article_work(url_list, batch_size, n_workers, timeout, out_file_path):
    config = Config()
    config.request_timeout = timeout
    
    article_list = [Article(url) for url in url_list]

    start_index = 0
    nr_items = batch_size * n_workers
    while True:
        end_index = start_index + nr_items
        if end_index > len(article_list):
            end_index = len(article_list)
        sub_list = article_list[start_index:end_index]

        news_pool.set(sub_list, override_threads=n_workers)
        news_pool.join()

        s_time = datetime.now().strftime('%Y-%m-%dT%H-%M-%S')
        url_file_name = f"{out_file_path}/articles-{s_time}.jsonl"
        with open(url_file_name, 'wt') as url_out_file:
            for article in sub_list:
                try:
                    article.parse()
                    article.nlp()
                    publish_date = getattr(article, "publish_date", "")
                    if isinstance(publish_date, datetime):
                        publish_date = publish_date.strftime('%Y-%m-%dT%H-%M-%S')
                    else:
                        publish_date = str(publish_date)
                        
                    metadata = {
                        "title": getattr(article, "title", ""),
                        "link": getattr(article, "url", getattr(article, "canonical_link", "")),
                        "authors": getattr(article, "authors", []),
                        "language": getattr(article, "meta_lang", ""),
                        "description": getattr(article, "meta_description", ""),
                        "publish_date": publish_date,
                        "keywords": getattr(article, "keywords", []),
                        "summary": getattr(article, "summary", ""),
                    }
                    document = {
                        "metadata": metadata,
                        "page_content": article.text
                    }
                    url_out_file.write(f"{json.dumps(document)}\n")
                except Exception as e:
                    print(f"ERR [{e}]", flush=True)

        print(f"{url_file_name} done.")
        if end_index == len(article_list):
            break
        start_index = end_index


if __name__ == '__main__':
    config_file_name = sys.argv[1]
    batch_size = int(sys.argv[2])
    n_workers = int(sys.argv[3])

    config = load_config(config_file_name)
    timeout = int(config['output']['timeout'])
    out_file_path = config['output']['path']

    start_time = datetime.now()

    url_list = []
    load_yavuz_config(config['yavuz'], url_list)
    load_meta_config(config['meta'], url_list)
    load_plenaryapp_config(config['plenaryapp'], url_list)
    load_gphin_config(config['gphin'], url_list)
    filter_url_work(url_list, n_workers, timeout, out_file_path, 'failed-urls.txt')
    # failed_urls = load_failed_urls(config['output'])
    
    url_dict = defaultdict(set)
    for url, source in url_list:
        # if url not in failed_urls:
        url_dict[url].add(source)
    url_list = [[url, '-'.join(sorted(sources))] for url, sources in url_dict.items()]
    print(f"Total {len(url_list)} GOOD urls.")

    
    # url_list = list(set(url_list).difference(set(failed_url_list)))
    # random.shuffle(url_list)
    
    
    # article_urls = load_feed_work(url_list, n_workers, timeout)
    # random.shuffle(article_urls)
    # print(f"Total {len(article_urls)} articles.")
    
    # load_article_work(article_urls, batch_size, n_workers, timeout, out_file_path)
   
    # end_time = datetime.now()
    # seconds = (end_time - start_time).total_seconds()
    # print(f"Executed in {seconds} secs.", flush=True)
