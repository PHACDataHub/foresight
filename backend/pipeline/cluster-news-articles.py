import csv
from datetime import datetime
import json
import os
from queue import Queue
from threading import Thread
from time import sleep
import sys

from wordcloud import WordCloud
import matplotlib.pyplot as plt

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


def increase_count(count, character):
    count += 1
    print(character, end="", flush=True)
    return count


def summarize_text_task(worker_id, device, document_list, queue):
    device_id = 'mps' if device == 'mps' else worker_id
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=768, chunk_overlap=0)
    summarizer = pipeline("summarization", model="facebook/bart-large-cnn",  device=device_id)
    
    for document in document_list:
        summary = ''
        chunks = [c.page_content for c in text_splitter.create_documents([document])]
        for chunk in chunks:
            summary = summary + '\n\n' + chunk
            if len(summary) > 768:
                summary = summarizer(summary, max_length=128)[0]['summary_text']

        summary = summary.strip('\n\n').strip()
        print('.', end="", flush=True)
        queue.put(summary)
        

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


def classify_text_task(worker_id, device, document_list, queue):
    device_id = 'mps' if device == 'mps' else worker_id
    classifier = pipeline("zero-shot-classification", model="facebook/bart-large-mnli",  device=device_id)
    
    for document in document_list:
        result = classifier(document, TOPIC_LIST, multi_label=True)
        topics = {topic: score for topic, score in zip(result['labels'], result['scores']) if score > 0.9}
        
        if topics:
            print('.', end="", flush=True)
        else:
            print(' ', end="", flush=True)
        queue.put(topics)
        
        
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
    print(f"Read {len(country_dict)} countries.\n")
    return country_dict


def extract_country(text, country_dict):
    return [country_dict[country_name] for country_name in country_dict if country_name in text]


def answer_text_task(worker_id, device, country_dict, document_list, queue):
    device_id = 'mps' if device == 'mps' else worker_id
    answerer = pipeline('question-answering', model="deepset/roberta-base-squad2", tokenizer="deepset/roberta-base-squad2",  device=device_id)
    
    for documents in document_list:
        answers = []
        for question in QUESTION_LIST:
            result = answerer({'question': question, 'context': '\n\n'.join(documents)})
            answer = {'question': question, 'score': result['score'], 'answer': result['answer']}
            if question == 'What countries does the disease spread?':
                answer['countries'] =  extract_country(result['answer'], country_dict)
            answers.append(answer)

        print('.', end="", flush=True)
        queue.put(answers)
        

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


if __name__ == '__main__':
    path, country_file_name, single_date = sys.argv[1], sys.argv[2], sys.argv[3]
    device = sys.argv[4] if len(sys.argv) > 4 else None
    end_date = sys.argv[5] if len(sys.argv) > 5 else None
    
    country_dict = load_country_codes(country_file_name)
    
    start_time = datetime.now()
    
    documents = []
    for file in sorted(os.listdir(path)):
        file_name = os.path.join(path, file)
        if not os.path.isfile(file_name) \
            or not file.startswith('processed-') \
            or not file.endswith('-news-articles.jsonl') \
            or not file.endswith('.jsonl'):
            continue

        pub_date = file[10:20]
        if end_date is None:
            if single_date != pub_date:
                continue
        else:
            if single_date > pub_date or pub_date > end_date:
                continue

        count = 0
        with open(file_name, 'rt') as in_file:
            for line in in_file.readlines():
                document = json.loads(line.strip())
                documents.append(document)
                count = increase_count(count, '.')
        print(f"\n[{pub_date}] Read {count} articles.\n")

    # System prompt describes information given to all conversations
    LABELING_PROMPT_TEMPLATE = """
    You are a helpful, respectful and honest assistant for labeling topics.

    I have a topic that contains the following documents delimited by triple backquotes (```). 
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
    umap_model = UMAP(n_neighbors=15, n_components=5, min_dist=0.0, metric='cosine')

    # Step 3 - Cluster reduced embeddings
    hdbscan_model = HDBSCAN(min_cluster_size=15, metric='euclidean', cluster_selection_method='eom', prediction_data=True)

    # Step 4 - Tokenize topics
    vectorizer_model = CountVectorizer(stop_words="english")

    # Step 5 - Create topic representation
    ctfidf_model = ClassTfidfTransformer(reduce_frequent_words=True)

    # Step 6 - (Optional) Fine-tune topic representations with 
    # a `bertopic.representation` model
    representation_model = KeyBERTInspired()

    # All steps together
    topic_model = BERTopic(
        embedding_model=embedding_model,            # Step 1 - Extract embeddings
        umap_model=umap_model,                      # Step 2 - Reduce dimensionality
        hdbscan_model=hdbscan_model,                # Step 3 - Cluster reduced embeddings
        vectorizer_model=vectorizer_model,          # Step 4 - Tokenize topics
        ctfidf_model=ctfidf_model,                  # Step 5 - Extract topic words
        representation_model=representation_model,  # Step 6 - (Optional) Fine-tune topic representations
        calculate_probabilities=True,
    )
    
    print('Compute embeddings ...')
    texts = ['\n\n'.join([document[prop] for prop in ['title', 'content']]) for document in documents]
    if device == 'cuda':
        pool = embedding_model.start_multi_process_pool(target_devices=['cuda:0', 'cuda:1', 'cuda:2', 'cuda:3'])
        embeddings = embedding_model.encode_multi_process(texts, pool)
        embedding_model.stop_multi_process_pool(pool)
    else:
        embeddings = embedding_model.encode(texts, show_progress_bar=True)

    print('Start fit_transform ...')
    topics, probs = topic_model.fit_transform(texts, embeddings)
    topic_set = set(topics)
    print(topic_model.get_topic_info())
    
    print('Reduce outliers ...')
    new_topics = topic_model.reduce_outliers(texts, topics, probabilities=probs, strategy="probabilities")
    new_topics = topic_model.reduce_outliers(texts, topics, strategy="embeddings", embeddings=embeddings)
    topic_model.update_topics(texts, topics=new_topics)
    print(topic_model.get_topic_info())
    
    n_workers = 4

    print('Summarize clusters ...')
    summaries = summarize_text(n_workers, [topic_model.representative_docs_[topic][0] for topic in topic_set if topic != -1], device)
    summary_dict = dict()
    for topic in topic_set:
        if topic == -1:
            summary_dict[topic] = ''
        else:
            summary_dict[topic] = summaries[topic]
        print(f"[{topic}] --- SUM --- {summary_dict[topic]}")

    print('Label clusters ...')
    label_dict = dict()
    for topic in topic_set:
        if topic == -1:
            label_dict[topic] = 'Outlier Topic'
        else:
            keywords = topic_model.topic_labels_[topic].split('_')[1:]
            output = labeling_llm_chain.invoke({'documents': summary_dict[topic], 'keywords': keywords})['text']
            result = output_parser.parse(output)
            if result and len(result) > 0:
                label_dict[topic] = result[0]
            else:
                label_dict[topic] = topic_model.topic_labels_[topic]
        print(f"[{topic}] --- LBL --- {label_dict[topic]}")

    topic_model.set_topic_labels(label_dict)
    print(topic_model.get_topic_info())

    print('Classify clusters ...')
    classified_topics_list = classify_text(n_workers, [topic_model.representative_docs_[topic][0] for topic in topic_set if topic != -1], device)
    classified_topic_dict = dict()
    for topic in topic_set:
        if topic == -1:
            classified_topic_dict[topic] = {}
        else:
            classified_topic_dict[topic] = classified_topics_list[topic]
        print(f"[{topic}] --- CLS --- {classified_topic_dict[topic]}")

    print('Answering questions ...')
    relevant_docs_list = []
    for topic in sorted(topic_set):
        if topic != -1 and classified_topic_dict[topic]:
            relevant_docs_list.append([topic, topic_model.representative_docs_[topic]])
            
    answers = answer_text(n_workers, [docs for _, docs in relevant_docs_list], country_dict, device)
    answers_dict = {topic: [] for topic in topic_set}
    for i, answer in enumerate(answers):
        topic = relevant_docs_list[i][0]
        answers_dict[topic] = answer

    for topic in topic_set:
        print(f"[{topic}] --- ANS --- {answers_dict[topic]}")

    print('Gathering stats ...')
    grouped_topics = {
        topic: { 
            'id_list': [], 'label': label_dict[topic], 'summary': summary_dict[topic], 
            'threats': classified_topic_dict[topic], 'answers': answers_dict[topic], 
        } for topic in topic_set
    }
    for index, topic in enumerate(topics):
        grouped_topics[topic]['id_list'].append(documents[index]['id'])
        
    count = 0
    for topic in topic_set:
        count += len(grouped_topics[topic]['id_list'])
    print(count, len(documents))
    assert count == len(documents)
    
    # for topic in topic_set:
    #     if topic != -1:
    #         text = {word: value for word, value in topic_model.get_topic(topic)}
    #         wc = WordCloud(background_color="white", max_words=1000)
    #         wc.generate_from_frequencies(text)
    #         plt.imshow(wc, interpolation="bilinear")
    #         plt.axis("off")
    #         plt.savefig('viz/' + pub_date + '-' + str(topic) + '.png')
    
    if end_date is None:
        cluster_file_name = 'datasets/' + single_date + '-clusters.jsonl'
    else:
        cluster_file_name = 'datasets/' + single_date + '-' + end_date + '-clusters.jsonl'
    with open(cluster_file_name, 'wt') as out_file:
        out_file.write(f"{json.dumps(grouped_topics)}\n")
    print(f"\nWritten {cluster_file_name}.\n")
    
    print('Generating viz ...')
    if end_date is None:
        viz_file_name = "viz/" + single_date + '-hie.html'
    else:
        viz_file_name = "viz/" + single_date + '-' + end_date + '-hie.html'
    viz_hie_arch = topic_model.visualize_hierarchy(custom_labels=True)
    viz_hie_arch.write_html(viz_file_name)

    if end_date is None:
        viz_file_name = "viz/" + single_date + '-cls.html'
    else:
        viz_file_name = "viz/" + single_date + '-' + end_date + '-cls.html'
    # Reduce dimensionality of embeddings, this step is optional but much faster to perform iteratively:
    reduced_embeddings = UMAP(n_neighbors=10, n_components=2, min_dist=0.0, metric='cosine').fit_transform(embeddings)
    viz_docs = topic_model.visualize_documents(texts, reduced_embeddings=reduced_embeddings, width=2048, height=1536, custom_labels=True)
    viz_docs.write_html(viz_file_name)
    
    end_time = datetime.now()
    seconds = (end_time - start_time).total_seconds()
    print(f"\nTotal {len(documents)} documents in {seconds} seconds: {seconds*1000/(len(documents)):0.3f} seconds per 1K documents.", flush=True)

