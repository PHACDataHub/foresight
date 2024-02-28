from datetime import datetime
import json
import os
import sys

from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import CountVectorizer

from umap import UMAP
from hdbscan import HDBSCAN
from bertopic import BERTopic
from bertopic.representation import KeyBERTInspired
from bertopic.vectorizers import ClassTfidfTransformer

from langchain.chains.llm import LLMChain
from langchain_community.llms import Ollama
from langchain.output_parsers.list import NumberedListOutputParser
from langchain.prompts import PromptTemplate


def increase_count(count, character):
    count += 1
    print(character, end="", flush=True)
    return count


if __name__ == '__main__':
    path, country_file_name, single_date = sys.argv[1], sys.argv[2], sys.argv[3]

    device = sys.argv[4] if len(sys.argv) > 4 else 'cuda'

    doc_dict = dict()
    for file in sorted(os.listdir(path)):
        file_name = os.path.join(path, file)
        if not single_date in file_name:
            continue
        # if not os.path.isfile(file_name) \
        #     or not file.startswith('processed-') \
        #     or not file.endswith('-news-articles.jsonl'):
        #     continue
        
        pub_date = file[10:20]
        if file.endswith('.jsonl'):
            count = 0
            documents = []
            with open(file_name, 'rt') as in_file:
                for line in in_file.readlines():
                    document = json.loads(line.strip())
                    documents.append(document)
                    count = increase_count(count, '.')
            doc_dict[pub_date] = documents
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

    SUMMARY_PROMPT_TEMPLATE = """Write a concise summary for all following documents delimited by triple backquotes (```).
    ```{documents}```

    {format_instructions}"""
    summary_prompt = PromptTemplate(
        input_variables=["documents"], 
        partial_variables={"format_instructions": format_instructions},
        template=SUMMARY_PROMPT_TEMPLATE)
    summary_llm_chain = LLMChain(llm=llm, prompt=summary_prompt)

    # Step 1 - Extract embeddings
    # device_id = 'mps' if device == 'mps' else worker_id
    # sentence_transformer = SentenceTransformer('sentence-transformers/all-mpnet-base-v2', device=device_id)
    embedding_model = SentenceTransformer('sentence-transformers/all-mpnet-base-v2')

    # Step 2 - Reduce dimensionality
    umap_model = UMAP(n_neighbors=15, n_components=5, min_dist=0.0, metric='cosine')

    # Step 3 - Cluster reduced embeddings
    hdbscan_model = HDBSCAN(min_cluster_size=15, metric='euclidean', cluster_selection_method='eom', prediction_data=True)

    # Step 4 - Tokenize topics
    vectorizer_model = CountVectorizer(stop_words="english")

    # Step 5 - Create topic representation
    ctfidf_model = ClassTfidfTransformer()

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
       
    for pub_date in sorted(doc_dict.keys())[0:1]:
        start_time = datetime.now()

        print('Compute embeddings ...')
        texts = ['\n\n'.join([document[prop] for prop in ['title', 'summary']]) for document in doc_dict[pub_date]]
        if device == 'cuda':
            pool = embedding_model.start_multi_process_pool()
            embeddings = embedding_model.encode_multi_process(texts, pool)
        else:
            embeddings = embedding_model.encode(texts, show_progress_bar=True)
        
        print('Start fit_transform ...')
        topics, probs = topic_model.fit_transform(texts, embeddings)
        print(topic_model.get_topic_info())
        
        # Reduce outliers
        new_topics = topic_model.reduce_outliers(texts, topics, probabilities=probs, strategy="probabilities")
        new_topics = topic_model.reduce_outliers(texts, topics, strategy="embeddings", embeddings=embeddings)
        topic_model.update_topics(texts, topics=new_topics)
        print(topic_model.get_topic_info())
        
        label_dict, summary_dict = dict(), dict()
        for i in range(-1, len(topic_model.get_topic_info())-1):
            if i == -1:
                label_dict[i] = 'Outlier Topic'
                summary_dict[i] = ''
                
            else:
                keywords = topic_model.topic_labels_[i].split('_')[1:]
                representative_docs = topic_model.representative_docs_[i]
                output = labeling_llm_chain.invoke({'documents': representative_docs[0], 'keywords': keywords})['text']
                label_dict[i] = output_parser.parse(output)[0]
                
                output = summary_llm_chain.invoke({'documents': representative_docs[0]})['text']
                summary_dict[i] = sorted(output_parser.parse(output), reverse=True)[0]
                
                print(f"[{i}] {label_dict[i]} --- {summary_dict[i]}")
        
        topic_model.set_topic_labels(label_dict)
        print(topic_model.get_topic_info())
        
        grouped_topics = {
            topic: { 'id_list': [], 'label': label_dict[i], 'summary': summary_dict[i] } 
            for topic in set(topics)
        }
        for index, topic in enumerate(topics):
            grouped_topics[topic]['id_list'].append(doc_dict[pub_date][index]['id'])
            
        count = 0
        for topic in sorted(grouped_topics.keys()):
            print(topic, len(grouped_topics[topic]))
            count += len(grouped_topics[topic]['id_list'])
        print(count, len(doc_dict[pub_date]))
        assert count == len(doc_dict[pub_date])
        
        cluster_file_name = 'datasets/' + pub_date + '-clusters.jsonl'
        with open(cluster_file_name, 'wt') as out_file:
            out_file.write(f"{json.dumps(grouped_topics)}\n")
        print(f"\nWritten {cluster_file_name}.\n")
        
        viz_hie_arch = topic_model.visualize_hierarchy(custom_labels=True)
        viz_hie_arch.write_html("viz/" + pub_date + '-hie.html')

        # Reduce dimensionality of embeddings, this step is optional but much faster to perform iteratively:
        reduced_embeddings = UMAP(n_neighbors=10, n_components=2, min_dist=0.0, metric='cosine').fit_transform(embeddings)
        viz_docs = topic_model.visualize_documents(texts, reduced_embeddings=reduced_embeddings, width=2048, height=1536, custom_labels=True)
        viz_docs.write_html("viz/" + pub_date + '-cls.html')
        
        if device == 'cuda':
            embedding_model.stop_multi_process_pool(pool)
        
        end_time = datetime.now()
        seconds = (end_time - start_time).total_seconds()
        print(f"\nTotal {len(doc_dict[pub_date])} documents in {seconds} seconds: {seconds*1000/(len(doc_dict[pub_date])):0.3f} seconds per 1K documents.", flush=True)
