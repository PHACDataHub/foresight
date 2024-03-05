import csv
from datetime import datetime
import json
import os
import pickle
from queue import Queue
from threading import Thread
from time import sleep
import sys

import numpy

from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import CountVectorizer

from umap import UMAP
from hdbscan import HDBSCAN
from bertopic import BERTopic
from bertopic.representation import KeyBERTInspired
from bertopic.vectorizers import ClassTfidfTransformer

from transformers import pipeline

from langchain.chains.llm import LLMChain
from langchain_community.llms import Ollama
from langchain.output_parsers.list import NumberedListOutputParser
from langchain.prompts.prompt import PromptTemplate
from langchain.text_splitter import RecursiveCharacterTextSplitter


class NumpyFloatValuesEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.float32):
            return float(obj)
        return JSONEncoder.default(self, obj)


def to_json_str(o):
    return json.dumps(o, cls=NumpyFloatValuesEncoder)


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


DISEASE_THREATS = {
    'Outbreaks of known infectious diseases',
    'Emerging infectious diseases or novel pathogens',
    'Reports on suspicious disease-related incidents', 
    'Foodborne illness outbreaks and recalls',
    'Waterborne diseases and contamination alerts',
    'Outbreaks linked to vaccine-preventable diseases',
    'Unusual health patterns',
    'Emerging pathogens',
    'Anomalous disease clusters',
}


def increase_count(count, character):
    count += 1
    print(character, end="", flush=True)
    return count


def summarize_text_task(worker_id, device, topic_document_list, queue):
    device_id = 'mps' if device == 'mps' else worker_id
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=768, chunk_overlap=0)
    summarizer = pipeline("summarization", model="facebook/bart-large-cnn",  device=device_id)
    # summarizer = pipeline("summarization", model="philschmid/flan-t5-base-samsum",  device=device_id)
    
    for topic, documents in topic_document_list:
        summary = ''
        chunks = [c.page_content for c in text_splitter.create_documents(documents)]
        for chunk in chunks:
            summary = summary + '\n\n' + chunk
            if len(summary) > 768:
                summary = summarizer(summary, max_length=128)[0]['summary_text']

        summary = summary.strip('\n\n').strip()
        print('.', end="", flush=True)
        queue.put([topic, summary])
        

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
        
        output_documents.append(document)
        if len(output_documents) == len(input_documents):
            break
    return output_documents


def classify_text_task(worker_id, device, topic_document_list, queue):
    device_id = 'mps' if device == 'mps' else worker_id
    classifier = pipeline("zero-shot-classification", model="facebook/bart-large-mnli",  device=device_id)
    
    for topic, documents in topic_document_list:
        result = classifier('\n\n'.join(documents), TOPIC_LIST, multi_label=True)
        topics = {topic: score for topic, score in zip(result['labels'], result['scores']) if score > 0.9}
        
        if topics:
            print('.', end="", flush=True)
        else:
            print(' ', end="", flush=True)
        queue.put([topic, topics])
        
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
        
        output_documents.append(document)
        if len(output_documents) == len(input_documents):
            break
    return output_documents


QUESTION_LIST = [
    'What disease is it or is it an unknown disease?',
    'What is the possible source of this disease?',
    'How does this disease spread?',
    'What countries does the disease spread?',
    'When did the disease start?',
    'Is the disease still spreading or did it stop?',
]    


def load_country_codes(file_name):
    country_dict = dict()
    with open(file_name, 'rt') as csv_file:
        csv_reader = csv.DictReader(csv_file, delimiter='\t')
        for row in csv_reader:
            country_dict[row['name']] = row["code"]
    print(f"Read {len(country_dict)} countries.")
    return country_dict


def extract_country(text, country_dict):
    return [country_dict[country_name] for country_name in country_dict if country_name in text]


def answer_text_task(worker_id, device, country_dict, topic_threat_document_list, queue):
    device_id = 'mps' if device == 'mps' else worker_id
    answerer = pipeline('question-answering', model="deepset/roberta-base-squad2", tokenizer="deepset/roberta-base-squad2",  device=device_id)
    
    for topic, threats, documents in topic_threat_document_list:
        answers = []
        if threats and set(threats.keys()).intersection(DISEASE_THREATS):
            for question in QUESTION_LIST:
                result = answerer({'question': question, 'context': '\n\n'.join(documents)})
                answer = {'question': question, 'score': result['score'], 'answer': result['answer']}
                if question == 'What countries does the disease spread?':
                    answer['countries'] =  extract_country(result['answer'], country_dict)
                answers.append(answer)

        print('.', end="", flush=True)
        queue.put([topic, answers])
        

def answer_text(n_workers, input_documents, country_dict, device):
    batch_size = len(input_documents) // n_workers

    sub_lists = []
    for i in range(0, n_workers-1):
        sub_lists.append(input_documents[i * batch_size: (i+1) * batch_size])
    sub_lists.append(input_documents[(n_workers - 1) * batch_size:])

    output_queue = Queue()
    workers = []
    for i in range(0, n_workers):
        workers.append(Thread(target=answer_text_task, args=(i, device, country_dict, sub_lists[i], output_queue,)))
        
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
        if len(output_documents) == len(input_documents):
            break
    return output_documents
        

def multitask(topic_models, documents, texts, pub_date, labeling_llm_chain):
    model_file_name = f"datasets/{pub_date}.pkl"
    if os.path.isfile(model_file_name):
        print('Load model: ' + model_file_name)
        merged_model = BERTopic.load(model_file_name)
    else:            
        merged_model = BERTopic.merge_models(topic_models, min_similarity=0.9)
        merged_model.save(model_file_name, serialization="pickle")
        print('Saved model: ' + model_file_name)

    print('Start transform ...')
    topics, probabilities = merged_model.transform(texts)

    index = 0
    topic_doc_dict = dict()
    for topic, probability  in zip(topics, probabilities):
        topic, probability = topic if type(topic) == 'int' else topic.item(), probability[topic].item()
        if probability == 0.0:
            index += 1
            continue
        if topic not in topic_doc_dict:
            topic_doc_dict[topic] = {'id_list': [], 'rp_docs': dict()}
        topic_doc_dict[topic]['id_list'].append(documents[index]['id'])
        topic_doc_dict[topic]['rp_docs'][index] = probability
        index += 1
        # print(f"{topic} --- ID_LIST --- {topic_doc_dict[topic]['id_list']}")

    for topic in sorted(topic_doc_dict.keys()):
        if topic != -1:
            rp_docs = topic_doc_dict[topic]['rp_docs']
            topic_doc_dict[topic]['rp_docs'] = sorted(rp_docs, key=rp_docs.get, reverse=True)[0:min(5, len(rp_docs))]
            titles = [documents[i]['title'] for i in topic_doc_dict[topic]['rp_docs']]
            print(f"{topic} --- {len(topic_doc_dict[topic]['id_list'])} --- {topic_doc_dict[topic]['rp_docs']} --- {merged_model.topic_labels_[topic]} --- {titles[0]}")

    n_workers = 4
    # topic_top_repr_doc_list = [ [topic, texts[topic_doc_dict[topic]['rp_docs'][0]]] for topic in sorted(topic_doc_dict.keys()) if topic != -1]
    topic_all_content_list = [
        [topic, [ texts[i] for i in topic_doc_dict[topic]['rp_docs']] ] 
        for topic in sorted(topic_doc_dict.keys()) if topic != -1
    ]
    topic_one_content_list = [
        [topic, [ texts[topic_doc_dict[topic]['rp_docs'][0]] ]] 
        for topic in sorted(topic_doc_dict.keys()) if topic != -1
    ]
   
    print('Summarize clusters ...')
    summary_dict = dict()
    topic_summary_list = summarize_text(n_workers, topic_one_content_list, device)
    summary_dict = dict()
    for topic, summary in topic_summary_list:
        summary_dict[topic] = summary
    for topic in sorted(topic_doc_dict.keys()):
        if topic != -1:
            print(f"[{topic}] --- SUM --- {summary_dict[topic]}")
        else:
            summary_dict[topic] = ''

    print('Label clusters ...')
    label_dict = dict()
    for topic in sorted(topic_doc_dict.keys()):
        if topic == -1:
            label_dict[topic] = 'Outlier Topic'
        else:
            keywords = merged_model.topic_labels_[topic].split('_')[1:]
            # output = labeling_llm_chain.invoke({'documents': summary_dict[topic], 'keywords': keywords})['text']
            output = labeling_llm_chain.invoke({'documents': [documents[i]['title'] for i in topic_doc_dict[topic]['rp_docs']], 'keywords': keywords})['text']
            result = output_parser.parse(output)
            if result and len(result) > 0:
                label_dict[topic] = result[0]
            else:
                label_dict[topic] = merged_model.topic_labels_[topic]
        print(f"[{topic}] --- LBL --- {label_dict[topic]}")

    merged_model.set_topic_labels(label_dict)
    print(merged_model.get_topic_info())

    print('Classify clusters ...')
    topic_threats_list = classify_text(n_workers, topic_all_content_list, device)
    topic_threats_dict = dict()
    for topic, threats in topic_threats_list:
        topic_threats_dict[topic] = threats
    for topic in sorted(topic_doc_dict.keys()):
        if topic != -1:
            print(f"[{topic}] --- CLS --- {topic_threats_dict[topic]}")
        else:
            topic_threats_dict[topic] = {}

    print('Answering questions ...')
    topic_all_repr_doc_list = [ 
        [topic, topic_threats_dict[topic], [texts[i] for i in range(0, len(topic_doc_dict[topic]['rp_docs']))]] 
        for topic in sorted(topic_doc_dict.keys()) if topic != -1]
            
    topic_answers_list = answer_text(n_workers, topic_all_repr_doc_list, country_dict, device)
    topic_answers_dict = dict()
    for topic, answers in topic_answers_list:
        topic_answers_dict[topic] = answers
    for topic in sorted(topic_doc_dict.keys()):
        if topic != -1:
            print(f"[{topic}] --- ANS --- {topic_answers_dict[topic]}")
        else:
            topic_answers_dict[topic] = {}

    print('Gathering stats ...')
    grouped_topics = {
        topic: { 
            'id_list': topic_doc_dict[topic]['id_list'], 'label': label_dict[topic], 'summary': summary_dict[topic], 
            'threats': topic_threats_dict[topic], 'answers': topic_answers_dict[topic], 
        } for topic in sorted(topic_doc_dict.keys()) if topic != -1
    }
        
    out_name = f"datasets/{pub_date}-clusters.jsonl"
    with open(out_name, 'wt') as out_file:
        out_file.write(f"{to_json_str(grouped_topics)}\n")
    print(f"\nWritten {out_name}.")

    out_name = f"viz/{pub_date}-hie.html"
    viz_hie_arch = topic_model.visualize_hierarchy(custom_labels=True)
    viz_hie_arch.write_html(out_name)
    print(f"Written {out_name}.")

    out_name = f"viz/{pub_date}-cls.html"
    embeddings = embedding_model.encode(texts, show_progress_bar=True)
    reduced_embeddings = UMAP(n_neighbors=10, n_components=2, min_dist=0.0, metric='cosine').fit_transform(embeddings)
    viz_docs = topic_model.visualize_documents(texts, reduced_embeddings=reduced_embeddings, width=2048, height=1536, custom_labels=True)
    viz_docs.write_html(out_name)
    print(f"Written {out_name}.\n")


def single_task(topic_model, topics, embeddings, texts, documents, pub_date, labeling_llm_chain):
    topic_set = sorted(set(topics))
    
    n_workers = 4
    topic_all_title_list = [
        [topic, [d.split('\n\n')[0] for d in topic_model.representative_docs_[topic]]] 
        for topic in topic_set if topic != -1
    ]
    topic_all_content_list = [
        [topic, topic_model.representative_docs_[topic]] 
        for topic in topic_set if topic != -1
    ]
    topic_one_content_list = [
        [topic, [topic_model.representative_docs_[topic][0]]]
        for topic in topic_set if topic != -1
    ]
   
    print('Summarize clusters ...')
    topic_summary_list = summarize_text(n_workers, topic_one_content_list, device)
    summary_dict = dict()
    for topic, summary in topic_summary_list:
        summary_dict[topic] = summary
    for topic in topic_set:
        if topic != -1:
            print(f"[{topic}] --- SUM --- {summary_dict[topic]}")
        else:
            summary_dict[topic] = ''
    
    print('Label clusters ...')
    label_dict = dict()
    for topic in topic_set:
        if topic == -1:
            label_dict[topic] = 'Outlier Topic'
        else:
            keywords = topic_model.topic_labels_[topic].split('_')[1:]
            # output = labeling_llm_chain.invoke({'documents': summary_dict[topic], 'keywords': keywords})['text']
            output = labeling_llm_chain.invoke({'documents': [d.split('\n\n')[0] for d in topic_model.representative_docs_[topic]], 'keywords': keywords})['text']
            result = output_parser.parse(output)
            if result and len(result) > 0:
                label_dict[topic] = result[0]
            else:
                label_dict[topic] = topic_model.topic_labels_[topic]
        print(f"[{topic}] --- LBL --- {label_dict[topic]}")

    topic_model.set_topic_labels(label_dict)
    print(topic_model.get_topic_info())

    print('Classify clusters ...')
    topic_threats_list = classify_text(n_workers, topic_all_content_list, device)
    topic_threats_dict = dict()
    for topic, threats in topic_threats_list:
        topic_threats_dict[topic] = threats
    for topic in topic_set:
        if topic != -1:
            print(f"[{topic}] --- CLS --- {topic_threats_dict[topic]}")
        else:
            topic_threats_dict[topic] = {}

    print('Answering questions ...')
    topic_all_repr_doc_list = [[topic, topic_threats_dict[topic], topic_model.representative_docs_[topic]] for topic in topic_set if topic != -1]
    topic_answers_list = answer_text(n_workers, topic_all_repr_doc_list, country_dict, device)
    topic_answers_dict = dict()
    for topic, answers in topic_answers_list:
        topic_answers_dict[topic] = answers
    for topic in topic_set:
        if topic != -1:
            print(f"[{topic}] --- ANS --- {topic_answers_dict[topic]}")
        else:
            topic_answers_dict[topic] = {}

    print('Gathering stats ...')
    grouped_topics = {
        topic: { 
            'id_list': [], 'label': label_dict[topic], 'summary': summary_dict[topic], 
            'threats': topic_threats_dict[topic], 'answers': topic_answers_dict[topic], 
        } for topic in topic_set
    }
    
    for index, topic in enumerate(topics):
        grouped_topics[topic]['id_list'].append(documents[index]['id'])
        
    out_name = f"datasets/{pub_date}-clusters.jsonl"
    with open(out_name, 'wt') as out_file:
        out_file.write(f"{to_json_str(grouped_topics)}\n")
    print(f"\nWritten {out_name}.")

    out_name = f"viz/{pub_date}-hie.html"
    viz_hie_arch = topic_model.visualize_hierarchy(custom_labels=True)
    viz_hie_arch.write_html(out_name)
    print(f"Written {out_name}.")

    out_name = f"viz/{pub_date}-cls.html"
    reduced_embeddings = UMAP(n_neighbors=10, n_components=2, min_dist=0.0, metric='cosine').fit_transform(embeddings)
    viz_docs = topic_model.visualize_documents(texts, reduced_embeddings=reduced_embeddings, width=2048, height=1536, custom_labels=True)
    viz_docs.write_html(out_name)
    print(f"Written {out_name}.\n")
    
        
if __name__ == '__main__':
    start_time = datetime.now()

    path, country_file_name, device, daily = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    country_dict = load_country_codes(country_file_name)

    date_list = [f"{month}-{day:02}" for month in ['2019-12', '2020-01'] for day in range(1, 32)]
    
    document_dict = dict()
    for pub_date in date_list:
        file_name = os.path.join(path, f"processed-{pub_date}-news-articles.jsonl")
        with open(file_name, 'rt') as in_file:
            document_dict[pub_date] = [json.loads(line.strip()) for line in in_file.readlines()]
        print(f"[{pub_date}] Read {len(document_dict[pub_date])} articles.")

    LABELING_PROMPT_TEMPLATE = """
    You are a helpful, respectful and honest assistant for labeling topics.

    I have a topic that contains the following document delimited by triple backquotes (```). 
    ```{documents}```
    
    The topic is described by the following keywords delimited by triple backquotes (```):
    ```{keywords}```

    Create a concise label of this topic, which should not exceed 32 characters.
    If there are more than one possible labels, return the shortest one and nothing more.
    
    {format_instructions}
    """
    
    llm = Ollama(model="mistral:instruct")
    output_parser = NumberedListOutputParser()
    format_instructions = output_parser.get_format_instructions()

    labeling_prompt = PromptTemplate(
        input_variables=["documents", "keywords"], 
        partial_variables={"format_instructions": format_instructions}, 
        template=LABELING_PROMPT_TEMPLATE)
    labeling_llm_chain = LLMChain(llm=llm, prompt=labeling_prompt)

    # Step 1 - Extract embeddings
    device_id = 'mps' if device == 'mps' else 0
    # sentence_transformer = SentenceTransformer('sentence-transformers/all-mpnet-base-v2', device=device_id)
    embedding_model = SentenceTransformer('sentence-transformers/all-mpnet-base-v2', device=device_id)

    # Step 2 - Reduce dimensionality
    umap_model = UMAP(n_neighbors=15, n_components=5, min_dist=0.0, metric='cosine', random_state=42)

    # Step 3 - Cluster reduced embeddings
    hdbscan_model = HDBSCAN(min_cluster_size=15, metric='euclidean', cluster_selection_method='eom', prediction_data=True)

    # Step 4 - Tokenize topics
    vectorizer_model = CountVectorizer(stop_words="english")

    # Step 5 - Create topic representation
    ctfidf_model = ClassTfidfTransformer(reduce_frequent_words=True)

    # Step 6 - (Optional) Fine-tune topic representations with 
    # a `bertopic.representation` model
    representation_model = KeyBERTInspired()

    if daily in ['daily', 'both']:
        # All steps together
        for pub_date in sorted(document_dict.keys()):
            # cluster_out_name = f"datasets/{pub_date}-clusters.jsonl"
            # if os.path.isfile(cluster_out_name):
            #     continue
            
            texts = ['\n\n'.join([document[prop] for prop in ['title', 'content']]) for document in document_dict[pub_date]]
            partial_embeddings = embedding_model.encode(texts, show_progress_bar=True)
            topic_model = BERTopic(
                embedding_model=embedding_model,            # Step 1 - Extract embeddings
                umap_model=umap_model,                      # Step 2 - Reduce dimensionality
                hdbscan_model=hdbscan_model,                # Step 3 - Cluster reduced embeddings
                vectorizer_model=vectorizer_model,          # Step 4 - Tokenize topics
                ctfidf_model=ctfidf_model,                  # Step 5 - Extract topic words
                representation_model=representation_model,  # Step 6 - (Optional) Fine-tune topic representations
                calculate_probabilities=True,
                # nr_topics="auto",
                verbose=True
            )
            
            print('Train model: ' + pub_date)
            topics, probabilities = topic_model.fit_transform(texts, partial_embeddings)

            # print('Reduce outliers ...')
            # new_topics = topic_model.reduce_outliers(daily_texts, topic_model.topics_, strategy="embeddings", embeddings=partial_embeddings)
            # new_topics = topic_model.reduce_outliers(daily_texts, topic_model.topics_, strategy="probabilities", probabilities=probabilities)
            # new_topics = topic_model.reduce_outliers(daily_texts, topic_model.topics_)
            # topic_model.update_topics(daily_texts, topics=new_topics)
            print(topic_model.get_topic_info())
            
            single_task(topic_model, topics, partial_embeddings, texts, document_dict[pub_date], pub_date, labeling_llm_chain)
        
    if daily in ['period', 'both']:
        for i in range(30, 37):
            documents, texts = [], []
            for j in range(0, 3):
                d = date_list[i+j]
                documents.extend(document_dict[d])
                texts.extend(['\n\n'.join([document[prop] for prop in ['title', 'content']]) for document in document_dict[d]])

            pub_date = f"{date_list[i]}-{date_list[i+2]}"
            partial_embeddings = embedding_model.encode(texts, show_progress_bar=True)
            topic_model = BERTopic(
                embedding_model=embedding_model,            # Step 1 - Extract embeddings
                umap_model=umap_model,                      # Step 2 - Reduce dimensionality
                hdbscan_model=hdbscan_model,                # Step 3 - Cluster reduced embeddings
                vectorizer_model=vectorizer_model,          # Step 4 - Tokenize topics
                ctfidf_model=ctfidf_model,                  # Step 5 - Extract topic words
                representation_model=representation_model,  # Step 6 - (Optional) Fine-tune topic representations
                calculate_probabilities=True,
                # nr_topics="auto",
                verbose=True
            )
        
            print('Train model: ' + pub_date)
            topics, probabilities = topic_model.fit_transform(texts, partial_embeddings)

            # print('Reduce outliers ...')
            # new_topics = topic_model.reduce_outliers(daily_texts, topic_model.topics_, strategy="embeddings", embeddings=partial_embeddings)
            # new_topics = topic_model.reduce_outliers(daily_texts, topic_model.topics_, strategy="probabilities", probabilities=topic_model.probabilities_)
            # new_topics = topic_model.reduce_outliers(daily_texts, topic_model.topics_)
            # topic_model.update_topics(daily_texts, topics=new_topics)
            print(topic_model.get_topic_info())
        
            single_task(topic_model, topics, partial_embeddings, texts, documents, pub_date, labeling_llm_chain)
            
        for i in range(30, 31):
            documents, texts = [], []
            for k in [7, 30]:
                for j in range(0, k):
                    d = date_list[i+j]
                    documents.extend(document_dict[d])
                    texts.extend(['\n\n'.join([document[prop] for prop in ['title', 'content']]) for document in document_dict[d]])

                pub_date = f"{date_list[i]}-{date_list[i+k-1]}"
                partial_embeddings = embedding_model.encode(texts, show_progress_bar=True)
                topic_model = BERTopic(
                    embedding_model=embedding_model,            # Step 1 - Extract embeddings
                    umap_model=umap_model,                      # Step 2 - Reduce dimensionality
                    hdbscan_model=hdbscan_model,                # Step 3 - Cluster reduced embeddings
                    vectorizer_model=vectorizer_model,          # Step 4 - Tokenize topics
                    ctfidf_model=ctfidf_model,                  # Step 5 - Extract topic words
                    representation_model=representation_model,  # Step 6 - (Optional) Fine-tune topic representations
                    calculate_probabilities=True,
                    # nr_topics="auto",
                    verbose=True
                )
            
                print('Train model: ' + pub_date)
                topics, probabilities = topic_model.fit_transform(texts, partial_embeddings)

                # print('Reduce outliers ...')
                # new_topics = topic_model.reduce_outliers(daily_texts, topic_model.topics_, strategy="embeddings", embeddings=partial_embeddings)
                # new_topics = topic_model.reduce_outliers(daily_texts, topic_model.topics_, strategy="probabilities", probabilities=topic_model.probabilities_)
                # new_topics = topic_model.reduce_outliers(daily_texts, topic_model.topics_)
                # topic_model.update_topics(daily_texts, topics=new_topics)
                print(topic_model.get_topic_info())
            
                single_task(topic_model, topics, partial_embeddings, texts, documents, pub_date, labeling_llm_chain)