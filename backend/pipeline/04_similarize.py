from datetime import datetime
import json
from queue import Queue
from threading import Thread
import sys

from sentence_transformers import util


def increase_count(count, character):
    count += 1
    print(character, end="", flush=True)
    return count


def load_jsonl(file_name, slice=None, single=False):
    with open(file_name, 'rt') as in_file:
        lines = in_file.readlines()[0:int(slice)] if slice else in_file.readlines()
        documents = [json.loads(line.strip()) for line in lines]
        print(f"[{file_name}] Read {len(documents)} documents.")
        if single and len(documents) == 1:
            return documents[0]
        return documents


def save_jsonl(documents, file_name, single=False):
    with open(file_name, 'wt') as out_file:
        if single:
            out_file.write(f"{json.dumps(documents)}\n")
            print(f"\n[{file_name}] - Wrote 1 document.")
        else:
            for document in documents:
                out_file.write(f"{json.dumps(document)}\n")
            print(f"\n[{file_name}] - Wrote {len(documents)} documents.")


def compute_similarity_task(tid_documents_list, similarity_threshold, queue):
    count = 0
    for tid, documents in tid_documents_list:
        similarity_list = [tid, []]
        for i, f_document in enumerate(documents):
            f_doc_id, f_embeddings_list = f_document['id'], f_document['embeddings']
            for s_document in documents[i+1:]:
                s_doc_id, s_embeddings_list = s_document['id'], s_document['embeddings']
                
                total_f_length, total_s_length = len(f_embeddings_list), len(s_embeddings_list)
                cos_sim = util.cos_sim(f_embeddings_list, s_embeddings_list)

                paragraph_pairs_dict = dict()
                for i in range(len(f_embeddings_list)-1):
                    for j in range(len(s_embeddings_list)-1):
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
                
                if total_score >= similarity_threshold * min(total_f_length, total_s_length):
                    if total_s_length < total_f_length:
                        similarity_list[1].append([s_doc_id, f_doc_id, total_score])
                    else:
                        similarity_list[1].append([f_doc_id, s_doc_id, total_score])
                    # print(f"{f_doc_id} --- {s_doc_id} --- {total_score}", flush=True)
                    count = increase_count(count, '.')

        queue.put(similarity_list)


def compute_similarity(input_documents, topic_dict, similarity_threshold=0.85):
    n_workers = 4
    n_topics = 0
    sub_lists = {i: [] for i in range(0, n_workers)}
    cnt_lists = {i: 0 for i in range(0, n_workers)}
    for topic_id in sorted(topic_dict):
        tid = int(topic_id)
        if int(tid) == -1:
            continue

        min_idx = sorted(cnt_lists.items(), key=lambda item: item[1])[0][0]
        id_list = topic_dict[topic_id]['id_list']
        docs = [{'id': doc_id, 'embeddings': input_documents[doc_id]['embeddings']} for doc_id in id_list]
        sub_lists[min_idx].append([tid, docs])
        cnt_lists[min_idx] += len(docs)
        n_topics += 1
    
    output_queue = Queue()
    workers = []
    for i in range(0, n_workers):
        # device_id = 'mps' if device == 'mps' else i
        workers.append(Thread(target=compute_similarity_task, args=(sub_lists[i], similarity_threshold, output_queue,)))
        
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
        n_topics -= 1
        if n_topics == 0:
            break
    return output_documents


def performing_tasks(path, period, documents):
    # Compute similarity between articles in each of the clusters
    loc_file_name = f"{path}/enriched-{period}-cls.jsonl"
    topic_dict = load_jsonl(loc_file_name, single=True)
    topic_dict = compute_similarity(documents, topic_dict)
    smr_file_name = f"{path}/processed-{period}-smr.jsonl"
    save_jsonl(topic_dict, smr_file_name, single=True)


if __name__ == '__main__':
    path, device, start_date, end_date = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]

    date_list = [f"{month}-{day:02}" for month in ['2019-12', '2020-01'] for day in range(1, 32)]
    daily_documents_dict = dict()

    for pub_date in date_list:
        if pub_date < start_date or pub_date > end_date:
            continue
  
        initial_time = datetime.now()
        
        # Load documents as jsonl
        doc_file_name = f"{path}/processed-{pub_date}-news-articles.jsonl"
        daily_documents = dict()
        for document in load_jsonl(doc_file_name):
            document_id = document['id']
            daily_documents[document['id']] = document

        daily_documents_dict[pub_date] = daily_documents
        performing_tasks(path, pub_date, daily_documents)

        final_time = datetime.now()
        seconds = (final_time - initial_time).total_seconds()
        print(f"{seconds} seconds --- {len(daily_documents)} documents --- {seconds/len(daily_documents):0.2f} seconds per document.\n")


    for period_length, period_days in [ (3, range(30, 37)), (7, range(30, 31)), (30, range(30, 31)) ]:
        for i in period_days:
            
            initial_time = datetime.now()

            start_period, end_period = date_list[i], date_list[i+period_length-1]
            period = f"{start_period}-{end_period}"
            period_documents = {k: v for j in range(0, period_length) for k, v in daily_documents_dict[date_list[i+j]].items()}
            performing_tasks(path, period, period_documents)

            final_time = datetime.now()
            seconds = (final_time - initial_time).total_seconds()
            print(f"{seconds} seconds --- {len(period_documents)} documents --- {seconds/len(period_documents):0.2f} seconds per document.\n")
