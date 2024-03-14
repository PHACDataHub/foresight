from collections import defaultdict
from datetime import datetime
from json import JSONEncoder, dumps
import json
from queue import Queue
from threading import Thread
import sys

import numpy as np


from langchain.text_splitter import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer


class NumpyFloatValuesEncoder(JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.float32):
            return float(obj)
        return JSONEncoder.default(self, obj)


def to_json_str(o):
    return dumps(o, cls=NumpyFloatValuesEncoder)


def increase_count(count, character):
    count += 1
    print(character, end="", flush=True)
    return count


def load_jsonl(file_name, slice=None):
    with open(file_name, 'rt') as in_file:
        lines = in_file.readlines()[0:int(slice)] if slice else in_file.readlines()
        documents = [json.loads(line.strip()) for line in lines]
        print(f"[{file_name}] Read {len(documents)} articles.")
        return documents


def save_jsonl(documents, file_name):
    with open(file_name, 'wt') as out_file:
        for document in documents:
            out_file.write(f"{json.dumps(document)}\n")
        print(f"[{file_name}] - Wrote {len(documents)} articles.")


def filter_documents(in_file_name, start_date, end_date, limit):
    lines = []
    with open(in_file_name, 'rt') as in_file:
        lines = in_file.readlines()
    print(f"Read {len(lines)} documents.\n")
    
    documents = []
    count, truncated = 0, 0
    for line in lines:
        document = json.loads(line.strip())
        pub_date = document['publicationdate'][:10]
        if pub_date < start_date or pub_date > end_date or 'EN' not in document['body']:
            continue
        if len(document['body']['EN']['contents']) > limit:
            document['body']['EN']['contents'] = document['body']['EN']['contents'][:limit]
            truncated += 1
        documents.append(document)
        count +=1

    print(f"TRUNCATED --- {truncated} documents.", flush=True)
    return documents

    
def embed_text_task(worker_id, text_splitter, model_name, device_id, document_list, queue):
    sentence_transformer = SentenceTransformer(model_name, device=device_id)
    
    count = 0
    for document in document_list:
        body = document['body']['EN']
        full_text = '\n\n'.join([body[e] for e in ['title', 'contents'] if e in body])
        document['chunks'] = [c.page_content for c in text_splitter.create_documents([full_text])]
        document['embeddings'] = sentence_transformer.encode(document['chunks']).tolist()

        count = increase_count(count, '.')
        if count // 1000:
            print(f"\n[{worker_id}] --- {count}\n")
        queue.put(document)


def embed_text(input_documents, n_workers, text_splitter, model_name, device):
    batch_size = len(input_documents) // n_workers

    sub_lists = []
    for i in range(0, n_workers-1):
        sub_lists.append(input_documents[i * batch_size: (i+1) * batch_size])
    sub_lists.append(input_documents[(n_workers - 1) * batch_size:])

    output_queue = Queue()
    workers = []
    for i in range(0, n_workers):
        device_id = 'mps' if device == 'mps' else i
        workers.append(Thread(target=embed_text_task, args=(i, text_splitter, model_name, device_id, sub_lists[i], output_queue,)))
        
    for i in range(0, n_workers):
        workers[i].start()
    
    for i in range(0, n_workers):
        workers[i].join()
        
    output_documents = []
    while True:
        document = output_queue.get()
        if document is None:
            break
        
        assert document['chunks'] is not None
        assert document['embeddings'] is not None
        output_documents.append(document)
        if len(output_documents) == len(input_documents):
            break
    return output_documents


if __name__ == '__main__':
    in_file_name, out_path, start_date, end_date, limit, device = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], int(sys.argv[5]), sys.argv[6]

    start_time = datetime.now()
    documents = filter_documents(in_file_name, start_date, end_date, limit)    
    end_time = datetime.now()
    seconds = (end_time - start_time).total_seconds()
    print(f"\nTotal {len(documents)} documents in {seconds} seconds: {seconds*1000/(len(documents)):0.3f} seconds per 1K documents.", flush=True)

    n_workers = 4
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1024, chunk_overlap=0)
    model_name = 'sentence-transformers/all-MiniLM-L6-v2'   # 'sentence-transformers/all-mpnet-base-v2'
    
    start_time = datetime.now()
    documents = embed_text(documents, n_workers, text_splitter, model_name, device)
    end_time = datetime.now()
    seconds = (end_time - start_time).total_seconds()
    print(f"\nTotal {len(documents)} documents in {seconds} seconds: {seconds*1000/(len(documents)):0.3f} seconds per 1K documents.", flush=True)
    
    daily_documents_dict = defaultdict(list)
    headers = ['id', 'publicationdate', 'publicationname', 'originallanguage', 'originalfilename', 'factivatopicfolder', 'state', 'score', 'chunks', 'embeddings']
    for document in documents:
        d = { k: v for k, v in document.items() if k in headers}
        d.update({'title': document['body']['EN']['title'], 'content': document['body']['EN']['contents']})
        
        pub_date = d['publicationdate'][:10]
        daily_documents_dict[pub_date].append(d)
        print(f"[{pub_date}] --- {len(daily_documents_dict[pub_date])} docs.")
    
    date_list = [f"{month}-{day:02}" for month in ['2019-12', '2020-01'] for day in range(1, 32)]

    for pub_date in date_list:
        save_jsonl(daily_documents_dict[pub_date], f"{out_path}/processed-{pub_date}-news-articles.jsonl")
    
    for period_length, period_days in [ (3, range(30, 37)), (7, range(30, 31)), (30, range(30, 31)) ]:
        for i in period_days:
            start_period, end_period = date_list[i], date_list[i+period_length-1]
            period_documents = [d for j in range(0, period_length) for d in daily_documents_dict[date_list[i+j]]]
            save_jsonl(period_documents, f"{out_path}/processed-{start_period}-{end_period}-news-articles.jsonl")
    