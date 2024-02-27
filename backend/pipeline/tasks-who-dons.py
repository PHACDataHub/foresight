import csv
import json
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
    'What disease is it or is it an unknown disease? ',
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
    in_file_name, country_file_name = sys.argv[1], sys.argv[2]
    device = sys.argv[3] if len(sys.argv) > 3 else 'cuda'

    country_dict = load_country_codes(country_file_name)
    
    with open(in_file_name, 'rt') as in_file:
        documents = [json.loads(line.strip()) for line in in_file.readlines()]
    print(f"Read {len(documents)} articles.\n")

    tokenizer = AutoTokenizer.from_pretrained("facebook/bart-large-cnn")
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1024, chunk_overlap=0)
    devices = [0, 0, 0, 0]
    if device == 'cuda':
        devices = [0, 1, 2, 3]
    sentence_transformer = SentenceTransformer('sentence-transformers/all-mpnet-base-v2', device=devices[0])
    summarizer = pipeline("summarization", model="facebook/bart-large-cnn",  device=devices[1])
    answerer = pipeline('question-answering', model="deepset/roberta-base-squad2", tokenizer="deepset/roberta-base-squad2",  device=devices[2])
    classifier = pipeline("zero-shot-classification", model="facebook/bart-large-mnli",  device=devices[3])

    with open(create_out_file_name(in_file_name), 'wt') as out_file:
        count = 0
        for document in documents:
            full_text = '\n\n'.join([document[e] for e in ['title', 'content'] if e in document])

            document['chunks'] = [c.page_content for c in text_splitter.create_documents([full_text])]
            
            summary_texts = [chunk if len(tokenizer(chunk)) < 143 else None for chunk in document['chunks']]
            long_texts = [chunk for chunk in document['chunks'] if len(tokenizer(chunk)) > 142]
            summarized_texts = [e['summary_text'] for e in summarizer(long_texts)]
            j = 0
            for i in range(0, len(document['chunks'])):
                if summary_texts[i] is None:
                    summary_texts[i] = summarized_texts[j]
                    j += 1
            
            document['summary'] = '\n\n'.join(summary_texts)
            if len(tokenizer(document['summary'])) > 1024:
                document['summary'] = summarizer(document['summary'])[0]['summary_text']

            result = classifier(document['summary'], TOPIC_LIST, multi_label=True)
            document['topics'] = {topic: score for topic, score in zip(result['labels'], result['scores']) if score > 0.9}

            document['answers'] = []
            for i, question in enumerate(QUESTION_LIST):
                result = answerer({'question': question, 'context': full_text})
                document['answers'].append({'question': question, 'score': result['score'], 'answer': result['answer']})
                if question == 'What countries does the disease spread?':
                    document['countries'] = extract_country(result['answer'], country_dict)

            document['embeddings'] = sentence_transformer.encode(document['chunks']).tolist()
            
            count += 1
            print(f"[{count}] {document['url']}\n--- {document['summary']}\n--- [{len(document['topics'])}] {document['topics']}\n--- [{len(document['answers'])}] {document['answers']}\n--- {document['countries']}\n--- {document['chunks']}\n--- {[len(document['embeddings'][i]) for i, e in enumerate(document['chunks'])]}\n")

            out_file.write(f"{json.dumps(document)}\n")

    print(f"\nProcessed {count} articles.\n")
