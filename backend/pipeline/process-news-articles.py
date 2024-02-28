import csv
from datetime import datetime
import json
from json import JSONEncoder
import numpy
from queue import Queue
from threading import Thread
import sys

from langchain.text_splitter import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
from transformers import pipeline, AutoTokenizer


TOPIC_LIST = [
    'Outbreaks of known infectious diseases',
    'Emerging infectious diseases or novel pathogens',
    'Hurricanes, earthquakes, floods, wildfires, and their health impacts',
    'Effects on health infrastructure and services during disasters',
    'Air pollution levels and associated health risks',
    'Water contamination issues and their health implications',
    'Chemical spills or industrial accidents affecting public health',
    'Health implications of accidents in industrial settings',
    'Potential biological attacks or bioterrorism threats',
    'Reports on suspicious disease-related incidents', 
    'Reports on suspicious drug-related incidents', 
    'Foodborne illness outbreaks and recalls',
    'Waterborne diseases and contamination alerts',
    'Incidents involving radiation exposure and their health consequences',
    'Extreme weather events and health advisories',
    'Health implications of changing climate patterns',
    'Outbreaks linked to vaccine-preventable diseases',
    'Controversies or developments in vaccination policies',
    'Security breaches or cyberattacks on healthcare systems',
    'Risks to patient data and healthcare services',
    'Evaluations of healthcare system readiness during emergencies',
    'Reports on hospital capacity during crises or emergencies',
    'Drug recalls, counterfeit drugs, and safety concerns',
    'Issues with medical device safety, recalls, and their impact on health',
    'Unusual health patterns',
    'Emerging pathogens',
    'Abnormal environmental indicators',
    'Unforeseen health outcomes',
    'Anomalous disease clusters',
    'Unrecognized health risks',
    'Atypical health incidents'
]

QUESTION_LIST = [
    'What disease is it or is it an unknown disease?',
    'What is the possible source of this disease?',
    'How does this disease spread?',
    'What countries does the disease spread?',
    'When did the disease start?',
    'Is the disease still spreading or did it stop?',
]    


class NumpyArrayEncoder(JSONEncoder):
    def default(self, obj):
        if isinstance(obj, numpy.ndarray):
            return obj.tolist()
        return JSONEncoder.default(self, obj)
    
    
def increase_count(count, character):
    count += 1
    print(character, end="", flush=True)
    return count


def create_out_file_name(in_file_name, pub_date):
    in_file_splits = in_file_name.split('/')
    out_file_name = '/'.join(in_file_splits[:-1]) + '/' + 'processed-' + pub_date + '-' + in_file_splits[-1]
    return out_file_name


def load_country_codes(file_name):
    country_dict = dict()
    with open(file_name, 'rt') as csv_file:
        csv_reader = csv.DictReader(csv_file, delimiter='\t')
        for row in csv_reader:
            country_dict[row['name']] = row["code"]
    print(f"Read {len(country_dict)} countries.\n")
    return country_dict


def extract_country(text, country_dict):
    return [country_dict[country_name] for country_name in country_dict if country_name in text]


def filter_documents(in_file_name):
    lines = []
    with open(in_file_name, 'rt') as in_file:
        lines = in_file.readlines()
    print(f"Read {len(lines)} documents.\n")
    
    documents = []
    count, ignored = 0, 0
    for line in lines:
        document = json.loads(line.strip())
        pub_date = document['publicationdate'][:10]
        if pub_date < start_date or pub_date > end_date or 'EN' not in document['body']:
            continue
        body = document['body']['EN']
        if len(body['contents']) > limit:
            print(f"[{count}/{count+ignored}] {document['id']}--- {body['title']}--- {len(body['contents'])}", flush=True)
            ignored += 1
            continue
        documents.append(document)
        count +=1

    return documents, ignored


def split_text_task(document_list, queue):
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1024, chunk_overlap=0)
    
    for document in document_list:
        body = document['body']['EN']
        full_text = '\n\n'.join([body[e] for e in ['title', 'contents'] if e in body])
        document['chunks'] = [c.page_content for c in text_splitter.create_documents([full_text])]
        
        print('.', end="", flush=True)
        queue.put(document)


def split_text(n_workers, input_documents):
    batch_size = len(input_documents) // n_workers

    sub_lists = []
    for i in range(0, n_workers-1):
        sub_lists.append(input_documents[i * batch_size: (i+1) * batch_size])
    sub_lists.append(input_documents[(n_workers - 1) * batch_size:])

    output_queue = Queue()
    workers = []
    for i in range(0, n_workers):
        workers.append(Thread(target=split_text_task, args=(sub_lists[i], output_queue,)))
        
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
        output_documents.append(document)
        if len(output_documents) == len(input_documents):
            break
    return output_documents
    
    
def summarize_text_task(worker_id, device, document_list, queue):
    device_id = 'mps' if device == 'mps' else worker_id
    tokenizer = AutoTokenizer.from_pretrained("facebook/bart-large-cnn")
    summarizer = pipeline("summarization", model="facebook/bart-large-cnn",  device=device_id)
    
    for document in document_list:
        summary_texts = [chunk if len(tokenizer(chunk)) < 143 else None for chunk in document['chunks']]
        long_texts = [chunk for chunk in document['chunks'] if len(tokenizer(chunk)) > 142]
        
        summarized_texts = [e['summary_text'] for e in summarizer(long_texts, min_length=142)]
        j = 0
        for i in range(0, len(document['chunks'])):
            if summary_texts[i] is None:
                summary_texts[i] = summarized_texts[j]
                j += 1
        
        document['summary'] = '\n\n'.join(summary_texts)
        if len(tokenizer(document['summary'])) > 1024:
            document['summary'] = summarizer(document['summary'], min_length=142)[0]['summary_text']

        print('.', end="", flush=True)
        queue.put(document)
        

def summarize_text(n_workers, input_documents, device):
    batch_size = len(input_documents) // n_workers

    sub_lists = []
    for i in range(0, n_workers-1):
        sub_lists.append(input_documents[i * batch_size: (i+1) * batch_size])
    sub_lists.append(input_documents[(n_workers - 1) * batch_size:])

    output_queue = Queue()
    workers = []
    for i in range(0, n_workers):
        workers.append(Thread(target=summarize_text_task, args=(i, device, sub_lists[i], output_queue,)))
        
    for i in range(0, n_workers):
        workers[i].start()
    
    for i in range(0, n_workers):
        workers[i].join()
        
    output_documents = []
    while True:
        document = output_queue.get()
        if document is None:
            break
        
        assert document['summary'] is not None
        output_documents.append(document)
        if len(output_documents) == len(input_documents):
            break
    return output_documents


def classify_text_task(worker_id, device, document_list, queue):
    device_id = 'mps' if device == 'mps' else worker_id
    classifier = pipeline("zero-shot-classification", model="facebook/bart-large-mnli",  device=device_id)
    
    for document in document_list:
        result = classifier(document['summary'], TOPIC_LIST, multi_label=True)
        document['topics'] = {topic: score for topic, score in zip(result['labels'], result['scores']) if score > 0.9}
        
        if document['topics']:
            print('.', end="", flush=True)
        else:
            print(' ', end="", flush=True)
        queue.put(document)
        

def classify_text(n_workers, input_documents, device):
    batch_size = len(input_documents) // n_workers

    sub_lists = []
    for i in range(0, n_workers-1):
        sub_lists.append(input_documents[i * batch_size: (i+1) * batch_size])
    sub_lists.append(input_documents[(n_workers - 1) * batch_size:])

    output_queue = Queue()
    workers = []
    for i in range(0, n_workers):
        workers.append(Thread(target=classify_text_task, args=(i, device, sub_lists[i], output_queue,)))
        
    for i in range(0, n_workers):
        workers[i].start()
    
    for i in range(0, n_workers):
        workers[i].join()
        
    output_documents = []
    while True:
        document = output_queue.get()
        if document is None:
            break
        
        assert document['topics'] is not None
        output_documents.append(document)
        if len(output_documents) == len(input_documents):
            break
    return output_documents


def answer_text_task(worker_id, device, country_dict, document_list, queue):
    device_id = 'mps' if device == 'mps' else worker_id
    answerer = pipeline('question-answering', model="deepset/roberta-base-squad2", tokenizer="deepset/roberta-base-squad2",  device=device_id)
    
    for document in document_list:
        document['answers'] = []
        for question in QUESTION_LIST:
            body = document['body']['EN']
            full_text = '\n\n'.join([body[e] for e in ['title', 'contents'] if e in body])
            result = answerer({'question': question, 'context': full_text})
            document['answers'].append({'question': question, 'score': result['score'], 'answer': result['answer']})
            if question == 'What countries does the disease spread?':
                document['countries'] = extract_country(result['answer'], country_dict)

        print('.', end="", flush=True)
        queue.put(document)
        

def answer_text(n_workers, input_documents, device):
    batch_size = len(input_documents) // n_workers

    sub_lists = []
    for i in range(0, n_workers-1):
        sub_lists.append(input_documents[i * batch_size: (i+1) * batch_size])
    sub_lists.append(input_documents[(n_workers - 1) * batch_size:])

    output_queue = Queue()
    workers = []
    for i in range(0, n_workers):
        workers.append(Thread(target=answer_text_task, args=(i, device, sub_lists[i], output_queue,)))
        
    for i in range(0, n_workers):
        workers[i].start()
    
    for i in range(0, n_workers):
        workers[i].join()
        
    output_documents = []
    while True:
        document = output_queue.get()
        if document is None:
            break
        
        assert document['answers'] is not None
        output_documents.append(document)
        if len(output_documents) == len(input_documents):
            break
    return output_documents


def embed_text_task(worker_id, device, document_list, queue):
    device_id = 'mps' if device == 'mps' else worker_id
    sentence_transformer = SentenceTransformer('sentence-transformers/all-mpnet-base-v2', device=device_id)
    
    for document in document_list:
        document['embeddings'] = sentence_transformer.encode(document['chunks'])

        print('.', end="", flush=True)
        queue.put(document)


def embed_text(n_workers, input_documents, device):
    batch_size = len(input_documents) // n_workers

    sub_lists = []
    for i in range(0, n_workers-1):
        sub_lists.append(input_documents[i * batch_size: (i+1) * batch_size])
    sub_lists.append(input_documents[(n_workers - 1) * batch_size:])

    output_queue = Queue()
    workers = []
    for i in range(0, n_workers):
        workers.append(Thread(target=embed_text_task, args=(i, device, sub_lists[i], output_queue,)))
        
    for i in range(0, n_workers):
        workers[i].start()
    
    for i in range(0, n_workers):
        workers[i].join()
        
    output_documents = []
    while True:
        document = output_queue.get()
        if document is None:
            break
        
        assert document['embeddings'] is not None
        output_documents.append(document)
        if len(output_documents) == len(input_documents):
            break
    return output_documents


if __name__ == '__main__':
    in_file_name, country_file_name, start_date, end_date = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    device = sys.argv[5] if len(sys.argv) > 5 else 'cuda'
    count = 0 if len(sys.argv) < 7 else int(sys.argv[6])
    limit = 100000 if len(sys.argv) < 8 else int(sys.argv[7])

    country_dict = load_country_codes(country_file_name)
    
    n_workers = 4
   
    start_time = datetime.now()
    documents, ignored = filter_documents(in_file_name)    
    end_time = datetime.now()
    seconds = (end_time - start_time).total_seconds()
    print(f"\nTotal {len(documents)+ignored} documents in {seconds} seconds: {seconds*1000/(len(documents)+ignored):0.3f} seconds per 1K documents.", flush=True)

    start_time = datetime.now()
    documents = split_text(n_workers, documents)
    end_time = datetime.now()
    seconds = (end_time - start_time).total_seconds()
    print(f"\nTotal {len(documents)} documents in {seconds} seconds: {seconds*1000/(len(documents)):0.3f} seconds per 1K documents.", flush=True)

    start_time = datetime.now()
    documents = summarize_text(n_workers, documents, device)
    end_time = datetime.now()
    seconds = (end_time - start_time).total_seconds()
    print(f"\nTotal {len(documents)} documents in {seconds} seconds: {seconds*1000/(len(documents)):0.3f} seconds per 1K documents.", flush=True)

    # start_time = datetime.now()
    # documents = classify_text(n_workers, documents, device)
    # end_time = datetime.now()
    # seconds = (end_time - start_time).total_seconds()
    # print(f"\nTotal {len(documents)} documents in {seconds} seconds: {seconds*1000/(len(documents)):0.3f} seconds per 1K documents.", flush=True)

    # relevant_documents, irrelevant_documents = [], []
    # for d in documents:
    #     if d['topics']:
    #         relevant_documents.append(d)
    #     else:
    #         irrelevant_documents.append(d)
    # print(f"\nTotal {len(relevant_documents)} RELEVANT, {len(irrelevant_documents)} IRRELEVANT documents", flush=True)

    # start_time = datetime.now()
    # documents = answer_text(n_workers, country_dict, relevant_documents, device)
    # end_time = datetime.now()
    # seconds = (end_time - start_time).total_seconds()
    # print(f"\nTotal {len(documents)} documents in {seconds} seconds: {seconds*1000/(len(documents)):0.3f} seconds per 1K documents.", flush=True)

    start_time = datetime.now()
    documents = embed_text(n_workers, documents, device)
    end_time = datetime.now()
    seconds = (end_time - start_time).total_seconds()
    print(f"\nTotal {len(documents)} documents in {seconds} seconds: {seconds*1000/(len(documents)):0.3f} seconds per 1K documents.", flush=True)

    doc_dict = dict()
    # for document in documents + irrelevant_documents:
    for document in documents:
        doc = {
            k: v for k, v in document.items()
            if k in [
                'id', 'publicationdate', 'publicationname', 'originallanguage', 'originalfilename', 'factivatopicfolder', 'state',
                'chunks', 'embeddings', 'summary', 'topics', 'answers', 'countries', 'score'
            ]
        }
        
        body = document['body']['EN']
        doc['title'] = body['title']
        doc['content'] = body['contents']
        
        pub_date = document['publicationdate'][:10]
        if pub_date not in doc_dict:
            doc_dict[pub_date] = []
        doc_dict[pub_date].append(doc)

    print(f"\nProcessed {len(doc_dict)} days.\n")
    
    for pub_date in sorted(doc_dict.keys()):
        with open(create_out_file_name(in_file_name, pub_date), 'wt') as out_file:
            count = 0
            for doc in doc_dict[pub_date]:
                out_file.write(f"{json.dumps(doc, cls=NumpyArrayEncoder)}\n")
                count = increase_count(count, '.')
            print(f"\n[{pub_date}] Written {count} articles.")
        