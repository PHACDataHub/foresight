from collections import defaultdict
import configparser
import csv
from datetime import datetime
from geopy.geocoders import Nominatim
import json
import math
from queue import Queue
from threading import Thread
import random
import sys


from umap import UMAP
from hdbscan import HDBSCAN
from sklearn.feature_extraction.text import CountVectorizer
from bertopic.vectorizers import ClassTfidfTransformer
from bertopic.representation import KeyBERTInspired
from bertopic import BERTopic

from sentence_transformers import SentenceTransformer, util

from langchain.chains.llm import LLMChain
from langchain.chains.summarize import load_summarize_chain
from langchain.output_parsers.list import NumberedListOutputParser
from langchain.prompts.prompt import PromptTemplate
from langchain.text_splitter import RecursiveCharacterTextSplitter

from langchain_community.llms import Ollama


NR_CHARS_PER_TOKEN = 5
NR_REPR_DOCS = 5
MAX_NR_TOKENS = 1000


def truncate_text(text, max_length):
    return text[0 : min(max_length, len(text))]


def load_config(file_name):
    config = configparser.ConfigParser()
    config.read_file(open(file_name))
    return config


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
            print(f"[{file_name}] - Wrote 1 document.")
        else:
            for document in documents:
                out_file.write(f"{json.dumps(document)}\n")
            print(f"[{file_name}] - Wrote {len(documents)} documents.")


def stat_runner(func):
    
    def wrap(*args, **kwargs): 
        start_time = datetime.now()
        total, result = func(*args, **kwargs) 
        end_time = datetime.now()
        seconds = (end_time - start_time).total_seconds()
        if total > 0:
            print(f"{func.__name__} --- {seconds} secs --- {total} items --- {seconds/total:0.2f} secs per item.", flush=True)
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
   

def create_clustering_tools(embedding_model, seed_phrases):
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
    topic_model = create_clustering_tools(embedding_model, seed_phrases)
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
    for topic, prob, doc_id, text in zip(topics, probs, [d['id'] for d in documents], texts):
        topic_id = int(topic)
        if topic_id not in topic_dict:
            topic_id = -1
        topic_dict[topic_id]['documents'][doc_id] = [float(1.0) if prob > 1.0 else float(prob), text]
    return len(topic_dict), topic_dict
    

@stat_runner
def predict_batches(topic_model, batches, topic_dict):
    nr_documents = 0
    title_dict = dict()
    for batch in batches:
        _, _, documents = batch
        title_dict.update({d['id']: d['title'] for d in documents})
        topic_dict = predict_batch(topic_model, batch, topic_dict)
        nr_documents += len(documents)
        
    for topic_id in sorted(topic_dict.keys()):
        sorted_doc_prob = sorted(topic_dict[topic_id]['documents'].items(), key=lambda item: item[1][0], reverse=True)
        representatives, distinct_titles = [], set()
        for doc_id, prob_text in sorted_doc_prob:
            prob, text = prob_text
            if title_dict[doc_id] in distinct_titles:
                continue
            if prob == 1.0 or (prob < 1.0 and len(representatives) < NR_REPR_DOCS):
                representatives.append([doc_id, prob, text])
                distinct_titles.add(title_dict[doc_id])
            else:
                break
        topic_dict[topic_id]['representatives'] = representatives
    return nr_documents, topic_dict


def increase_count(count, character):
    count += 1
    print(character, end="", flush=True)
    return count


def compute_similarity_task(sublist, similarity_threshold, content_similarity_ratio, queue):
    similarity_list = []
    count = 0
    for f, f_embeddings, s, s_embeddings in sublist:
        total_f_length, total_s_length = len(f_embeddings), len(s_embeddings)
        cos_sim = util.cos_sim(f_embeddings, s_embeddings)

        paragraph_pairs_dict = dict()
        for i in range(len(f_embeddings)):
            for j in range(len(s_embeddings)):
                paragraph_pairs_dict[cos_sim[i][j]] = [i, j]

        total_score, f_ids, s_ids = 0.0, [], []
        for k in sorted(paragraph_pairs_dict.keys(), reverse=True):
            i, j = paragraph_pairs_dict[k]
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
        if (len_f_ids == 1 and min_length == 1) or \
            (2 <= min_length <=3 and len_f_ids >= content_similarity_ratio * min_length) or \
            (len_f_ids >= 3):
            if total_s_length == total_f_length:
                key_id, val_id = f, s
            elif total_s_length < total_f_length:
                key_id, val_id = s, f
            else:
                key_id, val_id = f, s
            similarity_list.append([key_id, val_id, total_score/min_length])
            count = increase_count(count, '.')

    queue.put(similarity_list)


def compute_similarity(input_documents, n_workers, similarity_threshold, content_similarity_ratio):
    nr_input_documents = len(input_documents)
    full_batch = []
    for i in range(0, nr_input_documents-1):
        for j in range(i+1, nr_input_documents):
            full_batch.append([i, input_documents[i], j, input_documents[j]])
    
    nr_full_batch = len(full_batch)
    batch_size = nr_full_batch // n_workers

    sub_lists = []
    for i in range(0, n_workers-1):
        start = i * batch_size
        end = (i+1) * batch_size
        sub_lists.append(full_batch[start: end])

    start = (n_workers - 1) * batch_size
    sub_lists.append(full_batch[start:])
    
    output_queue = Queue()
    workers = []
    for i in range(0, n_workers):
        workers.append(Thread(target=compute_similarity_task, args=(sub_lists[i], similarity_threshold, content_similarity_ratio, output_queue,)))
        
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


@stat_runner
def compute_constellations(topic_dict, n_workers, similarity_threshold, content_similarity_ratio):
    topic_keywords, topic_ids = [], []
    for topic_id in sorted(topic_dict.keys()):
        if topic_id != -1 and 'name' in topic_dict[topic_id] and not topic_dict[topic_id]['name'].startswith('-1'):
            topic_keywords.append(embedding_model.encode([', '.join(topic_dict[topic_id]['keywords'])]))
            topic_ids.append(topic_id)
    
    similarity_dict = defaultdict(dict)
    similarity_lists = compute_similarity(topic_keywords, n_workers, similarity_threshold, content_similarity_ratio)
    for similarity_list in similarity_lists:
        for key_id, val_id, score in similarity_list:
            topic_kid = topic_ids[key_id]
            topic_sid = topic_ids[val_id]
            similarity_dict[topic_kid][topic_sid] = score
    
    return len(topic_dict), similarity_dict


def create_summarizer_prompt():
    MAP_PROMPT = """
    Write a concise summary of the following:
    "{docs}"
    CONCISE SUMMARY:
    """
    map_prompt_template = PromptTemplate(template=MAP_PROMPT, input_variables=["docs"])
    
    REDUCE_TEMPLATE = """
    The following is set of summaries:
    {docs}
    Take these and distill it into a final, consolidated summary of the main themes. 
    Helpful Answer:
    """
    reduce_prompt_template = PromptTemplate(template=REDUCE_TEMPLATE, input_variables=["docs"])
    
    return map_prompt_template, reduce_prompt_template


def create_labeler_prompt(format_instructions):
    LABELING_PROMPT_TEMPLATE = """
    You are a helpful, respectful and honest assistant for labeling topics.

    I have a summary of a set of articles: 
    {summary}

    The articles share the following keywords delimited by triple backquotes (```):
    ```{keywords}```

    Create a concise label for this set of articles.
    {format_instructions}
    """
    labeling_prompt = PromptTemplate(
        input_variables=["summary", "keywords"],
        partial_variables={"format_instructions": format_instructions}, 
        template=LABELING_PROMPT_TEMPLATE)

    return labeling_prompt
    

def create_classifier_prompt(format_instructions):
    CLASSIFY_PROMPT_TEMPLATE = """
    Which topic listed below
    {topics}

    that best matches the article delimited by triple backquotes (```)
    :```{article}```

    If there is no such topic, then return No match as result.
    {format_instructions}"""
    return PromptTemplate(
        input_variables=["article", "topics"],
        partial_variables={"format_instructions": format_instructions}, 
        template=CLASSIFY_PROMPT_TEMPLATE)


def create_qa_prompt(format_instructions):
    QA_TEMPLATE = """Provide a short and concise answer for each of the following questions using ONLY information found in the articles delimited by triple backquotes (```).
    Return answer with highest confidence score. Do not explain.
    QUESTIONS:{questions}

    ARTICLE:```{article}```

    ANSWERS:{format_instructions}:"""
    return PromptTemplate(
        input_variables=["questions", "article"], 
        partial_variables={"format_instructions": format_instructions}, 
        template=QA_TEMPLATE)


def create_loc_prompt(format_instructions):
    LOC_TEMPLATE = """Return the geo location found in the text delimited by triple backquotes (```).
    ```{text}```
    
    {format_instructions}:"""
    
    return PromptTemplate(
        input_variables=["text"], 
        partial_variables={"format_instructions": format_instructions}, 
        template=LOC_TEMPLATE)
    

# def create_filter_prompt(format_instructions):
#     FILTER_TEMPLATE = """Provide a short and concise answer the following question using ONLY information found in the article delimited by triple backquotes (```).
#     Return answer with highest confidence score. Do not explain.
#     QUESTION:{question}

#     ARTICLE:```{article}```

#     ANSWERS:{format_instructions}:"""
#     return PromptTemplate(
#         input_variables=["question", "article"], 
#         partial_variables={"format_instructions": format_instructions}, 
#         template=FILTER_TEMPLATE)


def create_llm_chain(task_name, model_name_dict, model_dict, chain_dict, prompt=None):
    if task_name == 'summarizer':
        model_name, chain_type = model_name_dict[task_name]
    else:
        model_name = model_name_dict[task_name]
        
    if model_name not in model_dict:
        model_dict[model_name] = Ollama(model=model_name, temperature=0.0)
    model_llm = model_dict[model_name]

    if task_name == 'summarizer':
        chain_dict[f"{task_name}-{chain_type}"] = load_summarize_chain(model_llm, chain_type=chain_type,)
    else:
        chain_dict[task_name] = LLMChain(llm=model_llm, prompt=prompt)

    return model_dict, chain_dict


def create_llm_chains(model_name_dict):
    model_dict, chain_dict = dict(), dict()
    
    # Common tools
    output_parser = NumberedListOutputParser()
    format_instructions = output_parser.get_format_instructions()
    # json_parser = SimpleJsonOutputParser(pydantic_object=Location)
    
    # Summarizer
    model_dict, chain_dict = create_llm_chain('summarizer', model_name_dict, model_dict, chain_dict)

    # Labeler
    labeler_prompt = create_labeler_prompt(format_instructions)
    model_dict, chain_dict = create_llm_chain('labeler', model_name_dict, model_dict, chain_dict, labeler_prompt)

    # Classifier
    classifier_prompt = create_classifier_prompt(format_instructions)
    model_dict, chain_dict = create_llm_chain('classifier', model_name_dict, model_dict, chain_dict, classifier_prompt)
    
    # Question answering
    qa_prompt = create_qa_prompt(format_instructions)
    model_dict, chain_dict = create_llm_chain('qa', model_name_dict, model_dict, chain_dict, qa_prompt)

    # Locator
    loc_prompt = create_loc_prompt(format_instructions)
    model_dict, chain_dict = create_llm_chain('loc', model_name_dict, model_dict, chain_dict, loc_prompt)

    # # Filter
    # filter_prompt = create_filter_prompt(format_instructions)
    # model_dict, chain_dict = create_llm_chain('filter', model_name_dict, model_dict, chain_dict, filter_prompt)
    
    return model_dict, chain_dict, output_parser #, json_parser


def filter_texts(info, llm_model, max_nr_tokens, max_repr_docs):
    nr_repr = len(info['representatives'])
    texts, min_nr_docs = [], min(max_repr_docs, nr_repr) if max_repr_docs > 0 else nr_repr
    for _, _, text in info['representatives'][:min_nr_docs]:
        tr_text = text
        cr_tokens = llm_model.get_num_tokens(tr_text) if len(tr_text) < max_nr_tokens * NR_CHARS_PER_TOKEN else len(tr_text) // NR_CHARS_PER_TOKEN
        while cr_tokens > max_nr_tokens:
            tr_text = truncate_text(tr_text, len(tr_text) - (cr_tokens - max_nr_tokens) * NR_CHARS_PER_TOKEN)
            cr_tokens = llm_model.get_num_tokens(tr_text)
        # print(f"{llm_model.get_num_tokens(tr_text)}")
        texts.append(tr_text)
    return texts


@stat_runner
def summarize_topics(summarizer_chain, llm_model, labeler_llm_chain, topic_dict, text_splitter, max_nr_tokens=MAX_NR_TOKENS, max_repr_docs=NR_REPR_DOCS):
    for topic_id in sorted(topic_dict):
        info = topic_dict[topic_id]
        if int(topic_id) == -1:
            info['summary'] = 'Outliers'
        else:
            filtered_texts = filter_texts(info, llm_model, max_nr_tokens, max_repr_docs)
            docs = text_splitter.create_documents(filtered_texts)
            output = summarizer_chain.invoke({"input_documents": docs})
            info['summary'] = output['output_text']
            print(f"[SUM] --- {topic_id} --- [{len(info['representatives'])}] --- {info['summary']}")

            output = labeler_llm_chain.invoke({'summary': info['summary'], 'keywords': info['keywords']})
            info['labels'] = [label.replace('<|im_end|>', '') for label in output_parser.parse(output['text'])]
            print(f"[LBL] --- {topic_id} -- {info['labels']}")

    return len(topic_dict), topic_dict


@stat_runner
def classify_topics(classifier_llm_chain, qa_llm_chain, loc_llm_chain, threat_list, disease_threats, question_list, filter_question, geolocator, locate_question, country_dict, output_parser, topic_dict):
    cache_location_dict = dict()
    
    for topic_id in sorted(topic_dict):
        if int(topic_id) == -1:
            topic_dict[topic_id]['threats'] = 'Outliers'
            continue

        info = topic_dict[topic_id]
        output = classifier_llm_chain.invoke({'article': info['summary'], 'topics': threat_list})
        threats = []
        for threat in output_parser.parse(output['text']):
            for topic in threat_list:
                if threat in topic or topic in threat:
                    threats.append(topic)
                    break
        
        info['threats'] = threats
        print(f"[THR] --- {topic_id} --- {info['threats']}")

        if not set(info['threats']).intersection(disease_threats):
            continue
        
        info['qa'] = dict()
        output = qa_llm_chain.invoke({'article': info['summary'], 'questions': question_list})
        for question, answer in zip(question_list, output_parser.parse(output['text'])):
            if question == filter_question['question'] and not any([answer.startswith(pref) for pref in filter_question['answer_prefix']]):
                # print(f"{question} >>> {answer}")
                break
            info['qa'][question] = answer
        
        if not info['qa']:
            continue

        print(f"[CQA] --- {topic_id} --- {list(info['qa'].values())}")
        # for question, answer in info['qa'].items():
        #     print(f"\t {question} --- {answer}")
        
        qa, info['loc'], location_dict = info['qa'], dict(), dict()
        loc_question = locate_question['question']
        if question == locate_question['question'] and any([answer.startswith(pref) for pref in locate_question['answer_prefix']]):
            continue
        
        output = loc_llm_chain.invoke({'text': qa[loc_question]})
        answers = [answer.replace('<|im_end|>', '') for answer in output_parser.parse(output['text'])]
        # print(f"{qa[loc_question]} >>> {answers}")
        for answer in answers:
            if len(answer) < 3:
                continue
            
            if answer in cache_location_dict:
                location_dict[answer] = cache_location_dict[answer]
                continue
            
            location = geolocator.geocode(answer, language='en')
            if location:
                cache_location_dict[answer] = {'name': location.raw['name'], 'display_name': location.raw['display_name'], 'lat': location.latitude, 'lng': location.longitude}
                location_dict[answer] = cache_location_dict[answer]
                
        country_set = set([c for answer in answers for c in extract_country(answer, country_dict)])
        info['loc'] = {'countries': list(country_set), 'locations': location_dict}
        print(f"[LOC] --- {topic_id} --- {qa[loc_question]} --- {info['loc']}")
            
    return len(topic_dict), topic_dict


if __name__ == '__main__':
    start_time = datetime.now()

    config = load_config(sys.argv[1])
    public_health_threats = config['public_health_threats']
    threat_classes = eval(public_health_threats['THREAT_CLASSES'])
    disease_threats = eval(public_health_threats['DISEASE_THREATS'])
    question_list = eval(public_health_threats['QUESTION_LIST'])
    filter_question = eval(public_health_threats['FILTER_QUESTION'])
    locate_question = eval(public_health_threats['LOCATE_QUESTION'])

    in_path, start_date, end_date, country_code_file = sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]

    country_dict = load_country_codes(country_code_file)

    model_name = 'sentence-transformers/all-MiniLM-L6-v2'
    embedding_model = SentenceTransformer(model_name)

    seed_phrases = [p for l in threat_classes.values() for p in l]
    print(f"Read {len(seed_phrases)} seed phrases.")

    date_list = [f"{month}-{day:02}" for month in ['2019-12', '2020-01'] for day in range(1, 32)]

    text_splitter = RecursiveCharacterTextSplitter(separators=["\n\n", "\n"], chunk_size=4096)

    llm_tool_dict = {
        'summarizer': ['mistral:instruct', 'refine'],
        'labeler': 'mistral-openorca',
        'classifier': 'mistral-openorca',
        'qa': 'mixtral',
        'loc': 'mistral-openorca',
        'filter': 'mistral:instruct',
    }

    llm_model_dict, llm_chain_dict, output_parser = create_llm_chains(llm_tool_dict)
    
    geolocator = Nominatim(user_agent=f"foresight-phac-ca-{random.random()}")
    
    batches = load_batches(in_path, date_list, start_date, end_date, embedding_model)
    
    topic_model = cluster_batches(batches, embedding_model, seed_phrases, print_topics=True)

    topic_dict = get_topic_info(topic_model)
    # for topic_id in sorted(topic_dict.keys()):
    #     print(f"[{topic_id}] --- [{len(topic_dict[topic_id]['documents'])}] --- {topic_dict[topic_id]['name']} --- {topic_dict[topic_id]['keywords']} --- {len(topic_dict[topic_id]['representatives'])}")
    
    topic_dict = predict_batches(topic_model, batches, topic_dict)
    for topic_id in sorted(topic_dict.keys()):
        print(f"[{topic_id}] --- [{len(topic_dict[topic_id]['documents'])}] --- {len(topic_dict[topic_id]['representatives'])} --- {topic_dict[topic_id]['name']} --- {topic_dict[topic_id]['keywords']}")

    n_workers = min(2 ** (round(math.log2(len(topic_dict)))-2), 16)
    similarity_dict = compute_constellations(topic_dict, n_workers, similarity_threshold=0.59, content_similarity_ratio=1.0)
    for topic_kid, score_dict in similarity_dict.items():
        print(f"{topic_kid} --- [{len(topic_dict[topic_kid]['documents'])}] --- {topic_dict[topic_kid]['name']}")   # --- {topic_dict[topic_kid]['keywords']}")
        for topic_sid, score in score_dict.items():
            print(f"\t{score:0.2f} --- {topic_sid} --- [{len(topic_dict[topic_sid]['documents'])}] --- {topic_dict[topic_sid]['name']}")    # --- {topic_dict[topic_sid]['keywords']}")

    sim_file_name = f"{in_path}/processed-{start_date}-{end_date}-sim.jsonl"
    save_jsonl(similarity_dict, sim_file_name, single=True)

    tps_file_name = f"{in_path}/processed-{start_date}-{end_date}-tps.jsonl"
    save_jsonl(topic_dict, tps_file_name, single=True)

    tps_file_name = f"{in_path}/processed-{start_date}-{end_date}-tps.jsonl"
    topic_dict = load_jsonl(tps_file_name, single=True)

    topic_dict = summarize_topics(
        llm_chain_dict['summarizer-refine'],
        llm_model_dict[llm_tool_dict['summarizer'][0]],
        llm_chain_dict['labeler'],
        topic_dict,
        text_splitter,
        max_nr_tokens=200,
        max_repr_docs=3)

    lbl_file_name = f"{in_path}/processed-{start_date}-{end_date}-lbl.jsonl"
    save_jsonl(topic_dict, lbl_file_name, single=True)
    
    lbl_file_name = f"{in_path}/processed-{start_date}-{end_date}-lbl.jsonl"
    topic_dict = load_jsonl(lbl_file_name, single=True)
 
    topic_dict = classify_topics(
        llm_chain_dict['classifier'], llm_chain_dict['qa'], llm_chain_dict['loc'],
        list(threat_classes.keys()),
        disease_threats, question_list, filter_question,
        geolocator, locate_question, country_dict,
        output_parser,
        topic_dict)

    cls_file_name = f"{in_path}/processed-{start_date}-{end_date}-cls.jsonl"
    save_jsonl(topic_dict, cls_file_name, single=True)

    end_time = datetime.now()
    seconds = (end_time - start_time).total_seconds()
    print(f"Executed in {seconds} secs.", flush=True)

