from datetime import datetime
import json
import os
import sys

import itertools
import pandas as pd

import seaborn as sns
from matplotlib import pyplot as plt
from adjustText import adjust_text
import matplotlib.patheffects as pe
import textwrap

from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import CountVectorizer

from umap import UMAP
from hdbscan import HDBSCAN
from bertopic import BERTopic
from bertopic.representation import KeyBERTInspired, MaximalMarginalRelevance, TextGeneration
from bertopic.vectorizers import ClassTfidfTransformer

from torch import bfloat16
import transformers


def increase_count(count, character):
    count += 1
    print(character, end="", flush=True)
    return count


if __name__ == '__main__':
    path, country_file_name, single_date = sys.argv[1], sys.argv[2], sys.argv[3]

    device = sys.argv[4] if len(sys.argv) > 4 else 'cuda'
    # if device == 'cuda':
    #     from cuml.cluster import HDBSCAN
    #     from cuml.manifold import UMAP
    #     from cuml.preprocessing import normalize
    # else:
    #     from umap import UMAP
    #     from hdbscan import HDBSCAN

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
                    # document['embeddings'] = numpy.asarray(document['embeddings'])
                    documents.append(document)
                    count = increase_count(count, '.')
            doc_dict[pub_date] = documents
            print(f"\n[{pub_date}] Read {count} articles.\n")

    model_id = 'meta-llama/Llama-2-13b-chat-hf'

    # Quantization to load an LLM with less GPU memory
    bnb_config = transformers.BitsAndBytesConfig(
        load_in_4bit=True,  # 4-bit quantization
        bnb_4bit_quant_type='nf4',  # Normalized float 4
        bnb_4bit_use_double_quant=True,  # Second quantization after the first
        bnb_4bit_compute_dtype=bfloat16  # Computation type
    )
    
    # Llama 2 Tokenizer
    tokenizer = transformers.AutoTokenizer.from_pretrained(model_id)

    # Llama 2 Model
    model = transformers.AutoModelForCausalLM.from_pretrained(
        model_id,
        trust_remote_code=True,
        quantization_config=bnb_config,
        device_map='auto',
    )
    model.eval()
    
    # Our text generator
    generator = transformers.pipeline(
        model=model, tokenizer=tokenizer,
        task='text-generation',
        temperature=0.1,
        max_new_tokens=500,
        repetition_penalty=1.1
    )
    
    # System prompt describes information given to all conversations
    system_prompt = """
    <s>[INST] <<SYS>>
    You are a helpful, respectful and honest assistant for labeling topics.
    <</SYS>>
    """

    # Example prompt demonstrating the output we are looking for
    example_prompt = """
    I have a topic that contains the following documents:
    - Traditional diets in most cultures were primarily plant-based with a little meat on top, but with the rise of industrial style meat production and factory farming, meat has become a staple food.
    - Meat, but especially beef, is the word food in terms of emissions.
    - Eating meat doesn't make you a bad person, not eating meat doesn't make you a good one.

    The topic is described by the following keywords: 'meat, beef, eat, eating, emissions, steak, food, health, processed, chicken'.

    Based on the information about the topic above, please create a short label of this topic. Make sure you to only return the label and nothing more.

    [/INST] Environmental impacts of eating meat
    """
    
    # Our main prompt with documents ([DOCUMENTS]) and keywords ([KEYWORDS]) tags
    main_prompt = """
    [INST]
    I have a topic that contains the following documents:
    [DOCUMENTS]

    The topic is described by the following keywords: '[KEYWORDS]'.

    Based on the information about the topic above, please create a short label of this topic. Make sure you to only return the label and nothing more.
    [/INST]
    """
    
    prompt = system_prompt + example_prompt + main_prompt

    # Step 1 - Extract embeddings
    # device_id = 'mps' if device == 'mps' else worker_id
    # sentence_transformer = SentenceTransformer('sentence-transformers/all-mpnet-base-v2', device=device_id)
    embedding_model = SentenceTransformer('sentence-transformers/all-mpnet-base-v2', device=device)

    # Step 2 - Reduce dimensionality
    umap_model = UMAP(n_neighbors=15, n_components=5, min_dist=0.0, metric='cosine', random_state=42)

    # Step 3 - Cluster reduced embeddings
    hdbscan_model = HDBSCAN(min_cluster_size=15, metric='euclidean', cluster_selection_method='eom', prediction_data=True)
    
    # Step 4 - Tokenize topics
    vectorizer_model = CountVectorizer(stop_words="english")

    # Step 5 - Create topic representation
    ctfidf_model = ClassTfidfTransformer()

    # Step 6 - (Optional) Fine-tune topic representations with a `bertopic.representation` model
    # KeyBERT
    keybert = KeyBERTInspired()

    # MMR
    mmr = MaximalMarginalRelevance(diversity=0.3)

    # Text generation with Llama 2
    llama2 = TextGeneration(generator, prompt=prompt)

    # All representation models
    representation_model = {
        "KeyBERT": keybert,
        "Llama2": llama2,
        "MMR": mmr,
    }
    
    representation_model = {
        'default': KeyBERTInspired(), 
        'labeling': LangChain(load_qa_chain(llm, chain_type="stuff"), prompt="Give a concise label describing these documents."),
        'summarizing': LangChain(load_qa_chain(llm, chain_type="stuff"), prompt="Give a concise summary of these documents."),
    }

    topic_model = BERTopic(
        # Sub-models
        embedding_model=embedding_model,            # Step 1 - Extract embeddings
        umap_model=umap_model,                      # Step 2 - Reduce dimensionality
        hdbscan_model=hdbscan_model,                # Step 3 - Cluster reduced embeddings
        vectorizer_model=vectorizer_model,          # Step 4 - Tokenize topics
        ctfidf_model=ctfidf_model,                  # Step 5 - Extract topic words
        representation_model=representation_model,  # Step 6 - (Optional) Fine-tune topic representations

        # Hyperparameters
        top_n_words=10,
        calculate_probabilities=True,
        verbose=True
    )

    for pub_date in sorted(doc_dict.keys())[0:1]:
        start_time = datetime.now()

        texts = ['\n\n'.join([document[prop] for prop in ['title', 'content']]) for document in doc_dict[pub_date]]
        embeddings = embedding_model.encode(texts, show_progress_bar=True)
        
        topics, probs = topic_model.fit_transform(texts, embeddings)
        print(topic_model.get_topic_info())
        
        # Reduce outliers
        new_topics = topic_model.reduce_outliers(texts, topics, probabilities=probs, strategy="probabilities")
        new_topics = topic_model.reduce_outliers(texts, topics, strategy="embeddings", embeddings=embeddings)
        topic_model.update_topics(texts, topics=new_topics)
        print(topic_model.get_topic_info())
        
        llama2_labels = [label[0][0].split("\n")[0] for label in topic_model.get_topics(full=True)["Llama2"].values()]
        topic_model.set_topic_labels(llama2_labels)
        print(topic_model.get_topic_info())
        
        reduced_embeddings = UMAP(n_neighbors=15, n_components=2, min_dist=0.0, metric='cosine', random_state=42).fit_transform(embeddings)
        viz_docs = topic_model.visualize_documents(titles, reduced_embeddings=reduced_embeddings, hide_annotations=True, hide_document_hover=False, custom_labels=True)
        viz_docs.write_html("viz/" + pub_date + '-cls.html')
        
        # Define colors for the visualization to iterate over
        colors = itertools.cycle(['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe', '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080', '#ffffff', '#000000'])
        color_key = {str(topic): next(colors) for topic in set(topic_model.topics_) if topic != -1}

        # Prepare dataframe and ignore outliers
        df = pd.DataFrame({"x": reduced_embeddings[:, 0], "y": reduced_embeddings[:, 1], "Topic": [str(t) for t in topic_model.topics_]})
        df["Length"] = [len(doc) for doc in abstracts]
        df = df.loc[df.Topic != "-1"]
        df = df.loc[(df.y > -10) & (df.y < 10) & (df.x < 10) & (df.x > -10), :]
        df["Topic"] = df["Topic"].astype("category")

        # Get centroids of clusters
        mean_df = df.groupby("Topic").mean().reset_index()
        mean_df.Topic = mean_df.Topic.astype(int)
        mean_df = mean_df.sort_values("Topic")
        
        fig = plt.figure(figsize=(20, 20))
        sns.scatterplot(data=df, x='x', y='y', c=df['Topic'].map(color_key), alpha=0.4, sizes=(0.4, 10), size="Length")

        # Annotate top 50 topics
        texts, xs, ys = [], [], []
        for row in mean_df.iterrows():
        topic = row[1]["Topic"]
        name = textwrap.fill(topic_model.custom_labels_[int(topic)], 20)

        if int(topic) <= 50:
            xs.append(row[1]["x"])
            ys.append(row[1]["y"])
            texts.append(plt.text(row[1]["x"], row[1]["y"], name, size=10, ha="center", color=color_key[str(int(topic))],
                                path_effects=[pe.withStroke(linewidth=0.5, foreground="black")]
                                ))

        # Adjust annotations such that they do not overlap
        adjust_text(texts, x=xs, y=ys, time_lim=1, force_text=(0.01, 0.02), force_static=(0.01, 0.02), force_pull=(0.5, 0.5))
        plt.axis('off')
        plt.legend('', frameon=False)
        # plt.show()
        plt.savefig("viz/" + pub_date + '-cls.png')
        
        end_time = datetime.now()
        seconds = (end_time - start_time).total_seconds()
        print(f"\nTotal {len(doc_dict[pub_date])} documents in {seconds} seconds: {seconds*1000/(len(doc_dict[pub_date])):0.3f} seconds per 1K documents.", flush=True)
        