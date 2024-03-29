from collections import defaultdict
import configparser
from datetime import datetime
import json
import numpy as np
from queue import Queue
from threading import Thread
import sys


from umap import UMAP
from hdbscan import HDBSCAN
from sklearn.feature_extraction.text import CountVectorizer
from bertopic.vectorizers import ClassTfidfTransformer
from bertopic.representation import KeyBERTInspired #, MaximalMarginalRelevance
from bertopic import BERTopic

from sentence_transformers import SentenceTransformer, util


def load_config(file_name):
    config = configparser.ConfigParser()
    config.read_file(open(file_name))
    return config


def stat_runner(func):
    
    def wrap(*args, **kwargs): 
        start_time = datetime.now()
        total, result = func(*args, **kwargs) 
        end_time = datetime.now()
        seconds = (end_time - start_time).total_seconds()
        if total > 0:
            print(f"{func.__name__} --- {seconds} secs --- {total} docs --- {seconds/total:0.2f} secs per doc.", flush=True)
        return result 
    return wrap 


@stat_runner
def load_batch(file_name, embedding_model):
    with open(file_name, 'rt') as in_file:
        documents = [json.loads(line.strip()) for line in in_file.readlines()]
        texts = [f"{d['title']}\n\n{d['content']}" for d in documents]
        embeddings = embedding_model.encode(texts, show_progress_bar=True)
        total = len(documents)
        return total, [embeddings, texts, documents]


def load_batches(in_path, date_list, start_date, end_date, embedding_model):
    batches = []
    for pub_date in date_list:
        if start_date and (start_date > pub_date or pub_date > end_date):
            continue
        in_file_name = f"{in_path}/processed-{pub_date}-news-articles.jsonl"
        embeddings_texts_documents = load_batch(in_file_name, embedding_model)
        batches.append(embeddings_texts_documents)
    return batches    
   

def create_tools(embedding_model, seed_phrases):
    umap_model = UMAP(n_neighbors=15, n_components=5, min_dist=0.0, metric='cosine', random_state=42)
    hdbscan_model = HDBSCAN(min_cluster_size=15, metric='euclidean', cluster_selection_method='eom', prediction_data=True)
    vectorizer_model = CountVectorizer(stop_words="english", ngram_range=(1, 3), min_df=3)
    ctfidf_model = ClassTfidfTransformer(seed_words=seed_phrases, seed_multiplier=2, bm25_weighting=True, reduce_frequent_words=True)
    # representation_model = MaximalMarginalRelevance(diversity=.5)
    representation_model = KeyBERTInspired()

    return BERTopic(
        embedding_model=embedding_model,            # Step 1 - Extract embeddings
        umap_model=umap_model,                      # Step 2 - Reduce dimensionality
        hdbscan_model=hdbscan_model,                # Step 3 - Cluster reduced embeddings
        vectorizer_model=vectorizer_model,          # Step 4 - Tokenize topics
        ctfidf_model=ctfidf_model,                  # Step 5 - Extract topic words
        representation_model=representation_model,  # Step 6 - (Optional) Fine-tune topic representations
        # calculate_probabilities=True,
        verbose=True
    )
    

@stat_runner
def cluster_batch(batch, embedding_model, seed_phrases):
    topic_model = create_tools(embedding_model, seed_phrases)
    embeddings, texts, _ = batch
    topic_model.fit_transform(texts, embeddings)
    return len(texts), topic_model


def cluster_batches(batches, embedding_model, seed_phrases, print_topics=False):
    topic_model = None
    for batch in batches:
        batch_model = cluster_batch(batch, embedding_model, seed_phrases)
        topic_model = batch_model if not topic_model else BERTopic.merge_models([topic_model, batch_model], min_similarity=0.9) 
        if print_topics:
            print(topic_model.get_topic_info(), flush=True)
    return topic_model

   
def get_topic_info(topic_model):
    topic_dict = dict()
    topic_info = topic_model.get_topic_info()
    headers, rows = topic_info.columns.tolist(), topic_info.values.tolist()
    for row in rows:
        row_dict = {header: value for header, value in zip(headers, row)}
        topic_id = int(row_dict['Topic'])
        if topic_id not in topic_dict:
            topic_dict[topic_id] = {
                'name': row_dict['Name'],
                'representatives': [],
                'keywords': row_dict['Representation'],
                'documents': dict(),
            }
    return topic_dict


@stat_runner
def predict_batch(topic_model, batch, topic_dict):
    embeddings, texts, documents = batch
    topics, probs = topic_model.transform(texts, embeddings)
    for topic, prob, doc_id in zip(topics, probs, [d['id'] for d in documents]):
        topic_id = int(topic)
        if topic_id not in topic_dict:
            topic_id = -1
        topic_dict[topic_id]['documents'][doc_id] = prob
    return len(topic_dict), topic_dict
    

def predict_batches(topic_model, batches, topic_dict):
    for batch in batches:
        topic_dict = predict_batch(topic_model, batch, topic_dict)
        
    for topic_id in sorted(topic_dict.keys()):
        sorted_doc_prob = sorted(topic_dict[topic_id]['documents'].items(), key=lambda item: item[1], reverse=True)
        representatives = [[doc_id, prob] for doc_id, prob in sorted_doc_prob if prob == 1.0]
        if len(representatives) < min(5, len(sorted_doc_prob)):
            representatives.extend(sorted_doc_prob[len(representatives):min(5, len(sorted_doc_prob))])
        topic_dict[topic_id]['representatives'] = representatives
    return topic_dict


def increase_count(count, character):
    count += 1
    print(character, end="", flush=True)
    return count


def compute_similarity_task(f_documents, sublist, similarity_threshold, content_similarity_ratio, queue):
    start, s_document = sublist

    similarity_list = []
    count = 0
    for f, f_embeddings in enumerate(f_documents):
        for s, s_embeddings in enumerate(s_document):
            if f == s + start:
                continue
            total_f_length, total_s_length = len(f_embeddings), len(s_embeddings)
            cos_sim = util.cos_sim(f_embeddings, s_embeddings)

            paragraph_pairs_dict = dict()
            for i in range(len(f_embeddings)-1):
                for j in range(len(s_embeddings)-1):
                    paragraph_pairs_dict[cos_sim[i][j]] = [i, j]

            total_score, f_ids, s_ids = 0.0, [], []
            for k in sorted(paragraph_pairs_dict.keys(), reverse=True):
                if float(k) < similarity_threshold:
                    break
                i, j = paragraph_pairs_dict[k]
                if i in f_ids or j in s_ids:
                    continue
                total_score += float(k)
                f_ids.append(i)
                s_ids.append(j)
                if len(f_ids) == total_f_length or len(s_ids) ==  total_s_length:
                    break
            
            min_length = min(total_f_length, total_s_length)
            len_f_ids = len(f_ids)
            if len_f_ids >= content_similarity_ratio * min_length:
                if total_s_length == total_f_length:
                    if s+start < f:
                        key_id, val_id = s+start, f
                    else:
                        key_id, val_id = f, s+start
                elif total_s_length < total_f_length:
                    key_id, val_id = s+start, f
                else:
                    key_id, val_id = f, s+start
                similarity_list.append([key_id, val_id, total_score/min_length])
                count = increase_count(count, '.')

    queue.put(similarity_list)


def compute_similarity(input_documents, n_workers, similarity_threshold, content_similarity_ratio):
    batch_size = len(input_documents) // n_workers

    sub_lists = []
    for i in range(0, n_workers-1):
        start = i * batch_size
        end = (i+1) * batch_size
        sub_lists.append([start, input_documents[start: end]])

    start = (n_workers - 1) * batch_size
    end = len(input_documents)
    sub_lists.append([start, input_documents[(n_workers - 1) * batch_size:]])
    
    half_documents = input_documents[:len(input_documents)//2+1]

    output_queue = Queue()
    workers = []
    for i in range(0, n_workers):
        workers.append(Thread(target=compute_similarity_task, args=(half_documents, sub_lists[i], similarity_threshold, content_similarity_ratio, output_queue,)))
        
    for i in range(0, n_workers):
        workers[i].start()
    
    for i in range(0, n_workers):
        workers[i].join()
        
    output_documents = []
    while True:
        document = output_queue.get()
        if document is None:
            break
        
        output_documents.append(document)
        if len(output_documents) == n_workers:
            break
    return output_documents


def compute_constellations(topic_dict, similarity_threshold, content_similarity_ratio):
    topic_keywords, topic_ids = [], []
    for topic_id in sorted(topic_dict.keys()):
        if topic_id != -1 and 'name' in topic_dict[topic_id] and not topic_dict[topic_id]['name'].startswith('-1'):
            topic_keywords.append(embedding_model.encode(topic_dict[topic_id]['keywords']))
            topic_ids.append(topic_id)
    
    similarity_dict = defaultdict(dict)
    n_workers = 4
    similarity_lists = compute_similarity(topic_keywords, n_workers, similarity_threshold, content_similarity_ratio)
    for similarity_list in similarity_lists:
        for key_id, val_id, score in similarity_list:
            topic_kid = topic_ids[key_id]
            topic_sid = topic_ids[val_id]
            similarity_dict[topic_kid][topic_sid] = score
    
    return similarity_dict
    

if __name__ == '__main__':
    start_time = datetime.now()

    config = load_config(sys.argv[1])

    in_path, start_date, end_date = sys.argv[2], sys.argv[3], sys.argv[4]
    if len(sys.argv) > 6:
        similarity_threshold, content_similarity_ratio = float(sys.argv[5]), float(sys.argv[6])
    else:
        similarity_threshold, content_similarity_ratio = 0.8, 0.3

    model_name = 'sentence-transformers/all-MiniLM-L6-v2'
    embedding_model = SentenceTransformer(model_name)

    seed_phrases = [p for l in eval(config['seed_phrases']['CUSTOM_TOPICS']).values() for p in l]
    print(f"Read {len(seed_phrases)} seed phrases.")

    date_list = [f"{month}-{day:02}" for month in ['2019-12', '2020-01'] for day in range(1, 32)]
    
    batches = load_batches(in_path, date_list, start_date, end_date, embedding_model)
    
    topic_model = cluster_batches(batches, embedding_model, seed_phrases, print_topics=True)

    topic_dict = get_topic_info(topic_model)
    for topic_id in sorted(topic_dict.keys()):
        print(f"[{topic_id}] --- [{len(topic_dict[topic_id]['documents'])}] --- {topic_dict[topic_id]['name']} --- {topic_dict[topic_id]['keywords']} --- {len(topic_dict[topic_id]['representatives'])}")
    
    topic_dict = predict_batches(topic_model, batches, topic_dict)
    for topic_id in sorted(topic_dict.keys()):
        print(f"[{topic_id}] --- [{len(topic_dict[topic_id]['documents'])}] --- {topic_dict[topic_id]['name']} --- {topic_dict[topic_id]['keywords']} --- {topic_dict[topic_id]['representatives']}")

    similarity_dict = compute_constellations(topic_dict, similarity_threshold, content_similarity_ratio)
    for topic_kid, score_dict in similarity_dict.items():
        print(f"{topic_kid} --- [{len(topic_dict[topic_kid]['documents'])}] --- {topic_dict[topic_kid]['name']}")   # --- {topic_dict[topic_kid]['keywords']}")
        for topic_sid, score in score_dict.items():
            print(f"\t{score:0.2f} --- {topic_sid} --- [{len(topic_dict[topic_sid]['documents'])}] --- {topic_dict[topic_sid]['name']}")    # --- {topic_dict[topic_sid]['keywords']}")

    end_time = datetime.now()
    seconds = (end_time - start_time).total_seconds()
    print(f"Executed in {seconds} secs.", flush=True)

