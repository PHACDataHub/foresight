from collections import defaultdict
import configparser
from datetime import datetime
import json
import os
import sys

from bs4 import BeautifulSoup
import fasttext

# fasttext.FastText.eprint = lambda x: None


def increase_count(count, character='.'):
    count += 1
    print(character, end="", flush=True)
    return count


def load_config(file_name):
    config = configparser.ConfigParser()
    config.read_file(open(file_name))
    return config


class LanguageIdentifier():
    
    def __init__(self, model_file_name):
        self.model = fasttext.load_model(model_file_name)
    
    def identify(self, texts):
        result_dict = defaultdict(float)
        for text in texts:
            labels, probabilities = self.model.predict(text, k=3)
            for label, probability in zip(labels, probabilities):
                result_dict[label[9:]] += probability
        result_dict = {k: v / len(result_dict)for k, v in result_dict.items()}
        if result_dict:
            return  sorted(result_dict.items(), key=lambda item: item[1], reverse=True)[0]
        else:
            return None, -1.0 
    

if __name__ == '__main__':
    config_file, in_path, url_file_name =  sys.argv[1], sys.argv[2], sys.argv[3]

    config = load_config(config_file)
    output_section = config['output']
    language_identifier = LanguageIdentifier(output_section['fasttext_model'])
    
    start_time = datetime.now()

    documents = []
    lang_dict = defaultdict(int)
    url_dict = dict()
    nr_articles = 0
    for file_name in sorted(os.listdir(in_path)):
        full_file_name = os.path.join(in_path, file_name)
        if not os.path.isfile(full_file_name) or not full_file_name.endswith('.json'):
            continue
        
        with open(full_file_name, 'rt') as in_file:
            feed = json.load(in_file)
            feed_info = dict()
            for k in ['title', 'subtitle', 'link', 'language', 'ttl', 'updated']:
                if k not in feed['feed']:
                    continue
                feed_info[f"feed-{k}"] = feed['feed'][k]
            
            for item in feed['entries']:
                if not item:
                    continue
                
                if item['link'] in url_dict:
                    if 'published_parsed' not in item:
                        continue
                    else:
                        pp = item['published_parsed']
                        ts = datetime(pp[0], pp[1], pp[2], pp[3], pp[4], pp[5]).timestamp()
                        if ts <= url_dict[item['link']]:
                            continue
                        else: 
                            url_dict[item['link']] = ts
                            
                document = {'id':  item['link']}
                document.update(feed_info)

                for k in ['published']:
                    if k not in item:
                        continue
                    document[k] = item[k]
                
                for k in ['title', 'summary']:
                    if k not in item:
                        continue
                    document[k] = BeautifulSoup(item[k], 'html.parser').get_text()
                        
                for pair in [['authors', 'name'], ['tags', 'term']]:
                    k, term = pair
                    if k not in item:
                        continue
                    document[k] = ' '.join([e[term] for e in item[k] if e and term in e])

                for pair in [['content', 'value']]:
                    k, term = pair
                    if k not in item:
                        continue
                    document[k] = ' '.join([BeautifulSoup(e[term], 'html.parser').get_text() for e in item[k] if e and term in e])


                texts = [document[k].replace('\n', ' ') for k in ['title', 'summary', 'content'] if k in document and len(document[k]) > 10]
                if texts:
                    language, probability = language_identifier.identify(texts)
                    if language:
                        document['language'] = [language, probability]
                        lang_dict[language] += 1
                        nr_articles = increase_count(nr_articles)
                    else:
                        print(f"[UNKNOWN] --- {texts}")
                        nr_articles += 1 
                        
                documents.append(document)

    with open(url_file_name, 'wt') as url_out_file:
        for document in documents:
            url_out_file.write(f"{json.dumps(document)}\n")

    print(f"Extract {nr_articles} articles.")
    for k in sorted(lang_dict.keys()):
        print(f"{k} --- {lang_dict[k]}")

    end_time = datetime.now()
    seconds = (end_time - start_time).total_seconds()
    print(f"{seconds} secs --- {nr_articles} articles --- {seconds/nr_articles:0.2f} secs per article.", flush=True)
