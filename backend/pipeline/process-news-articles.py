import csv
from datetime import datetime
import json
import sys

from langchain.text_splitter import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
from transformers import pipeline, AutoTokenizer


def increase_count(count, character):
    count += 1
    print(character, end="", flush=True)
    return count


def load_country_codes(file_name):
    country_dict = dict()
    with open(file_name, 'rt') as csv_file:
        csv_reader = csv.DictReader(csv_file, delimiter='\t')
        for row in csv_reader:
            country_dict[row["code"]] = row['name']
    print(f"Read {len(country_dict)} countries.")
    return country_dict


def create_out_file_name(in_file_name, pub_date):
    in_file_splits = in_file_name.split('/')
    out_file_name = '/'.join(in_file_splits[:-1]) + '/' + 'processed-' + pub_date + '-' + in_file_splits[-1]
    return out_file_name


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


def increase_count(count, character):
    count += 1
    print(character, end="", flush=True)
    return count


def create_out_file_name(in_file_name):
    in_file_splits = in_file_name.split('/')
    out_file_name = '/'.join(in_file_splits[:-1]) + '/' + 'processed-' + in_file_splits[-1]
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


if __name__ == '__main__':
    in_file_name, country_file_name, start_date, end_date = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    device = sys.argv[5] if len(sys.argv) > 6 else 'cuda'

    country_dict = load_country_codes(country_file_name)
    
    tokenizer = AutoTokenizer.from_pretrained("facebook/bart-large-cnn")
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1024, chunk_overlap=0)
    devices = ['mps' for i in range(0, 4)]
    if device == 'cuda':
        devices = [0, 1, 2, 3]
    sentence_transformer = SentenceTransformer('sentence-transformers/all-mpnet-base-v2', device=devices[0])
    summarizer = pipeline("summarization", model="facebook/bart-large-cnn",  device=devices[1])
    answerer = pipeline('question-answering', model="deepset/roberta-base-squad2", tokenizer="deepset/roberta-base-squad2",  device=devices[2])
    classifier = pipeline("zero-shot-classification", model="facebook/bart-large-mnli",  device=devices[3])
    
    print(f"Created LLM tools.")
    
    count = 0 if len(sys.argv) < 7 else int(sys.argv[6])
    useful, ignore = 0, 0
    limit = 10000 if len(sys.argv) < 8 else int(sys.argv[7])
    doc_dict = dict()
    start_time = datetime.now()
    
    with open(in_file_name, 'rt') as in_file:
        lines = in_file.readlines()
        print(f"Read {len(lines)} documents.\n")
        
        for line in lines[count:]:
            document = json.loads(line.strip())
            pub_date = document['publicationdate'][:10]
            if pub_date < start_date or pub_date > end_date or 'EN' not in document['body']:
                continue
            
            body = document['body']['EN']
            if len(body['contents']) > limit:
                print(f"""[{count}] {doc['id']}\n--- {body['title']}\n--- {len(body['contents'])}\n""", flush=True)
                ignore += 1
                count += 1
                continue
            
            full_text = '\n\n'.join([body[e] for e in ['title', 'contents'] if e in body])
            document['chunks'] = [c.page_content for c in text_splitter.create_documents([full_text])]
            
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

            result = classifier(document['summary'], TOPIC_LIST, multi_label=True)
            document['topics'] = {topic: score for topic, score in zip(result['labels'], result['scores']) if score > 0.9}

            if document['topics']:
                document['answers'] = []
                for i, question in enumerate(QUESTION_LIST):
                    result = answerer({'question': question, 'context': full_text})
                    document['answers'].append({'question': question, 'score': result['score'], 'answer': result['answer']})
                    if question == 'What countries does the disease spread?':
                        document['countries'] = extract_country(result['answer'], country_dict)

                document['embeddings'] = sentence_transformer.encode(document['chunks']).tolist()
                useful += 1
            
            doc = {
                k: v for k, v in document.items()
                if k in [
                    'id', 'publicationdate', 'publicationname', 'originallanguage', 'originalfilename', 'factivatopicfolder', 'state',
                    'chunks', 'embeddings', 'summary', 'topics', 'answers', 'countries', 'score'
                ]
            }
            doc['title'] = body['title']
            doc['content'] = body['contents']
            
            if doc['topics']:
                if 'answers' in doc:
                    print(f"""[{useful}/{count}/{count+ignore}] {doc['id']}\n--- {doc['summary']}\n--- {doc['state']} --- {doc['score']}\n--- [{len(doc['topics'])}] {doc['topics']}\n--- [{len(doc['answers'])}] {doc['answers']}\n--- {doc['countries']}\n--- {[(len(tokenizer(e)), len(doc['embeddings'][i])) for i, e in enumerate(document['chunks'])]}\n""", flush=True)
                else:
                    print(f"""[{useful}/{count}/{count+ignore}] {doc['id']}\n--- {doc['summary']}\n--- {doc['state']} --- {doc['score']}\n--- [{len(doc['topics'])}] {doc['topics']}\n--- {[(len(tokenizer(e)), len(doc['embeddings'][i])) for i, e in enumerate(document['chunks'])]}\n""", flush=True)
            else:
                print(f"""[{useful}/{count}/{count+ignore}] {doc['id']}\n--- {doc['summary']}\n--- {doc['factivatopicfolder']} --- {doc['state']} --- {doc['score']}\n""", flush=True)
            count += 1
            
            if pub_date not in doc_dict:
                doc_dict[pub_date] = []
            doc_dict[pub_date].append(doc)

            if (count+ignore) % 10 == 0:            
                end_time = datetime.now()
                seconds = (end_time - start_time).total_seconds()
                print(f"Total {count} documents in {seconds} seconds: {seconds/(count+ignore)} seconds per document.", flush=True)

    print(f"\nProcessed {count} articles.\n")
    
    for pub_date in sorted(doc_dict.keys()):
        with open(create_out_file_name(in_file_name, pub_date), 'wt') as out_file:
            count = 0
            for doc in doc_dict[pub_date]:
                out_file.write(f"{json.dumps(doc)}\n")
                count = increase_count(count, '.')
            print(f"\n[{pub_date}] Written {count} articles.")
        