import json
from json import JSONEncoder
import numpy
import sys


class NumpyArrayEncoder(JSONEncoder):
    def default(self, obj):
        if isinstance(obj, numpy.ndarray):
            return obj.tolist()
        return JSONEncoder.default(self, obj)


def increase_count(count, character):
    count += 1
    print(character, end="", flush=True)
    return count


if __name__ == '__main__':
    path, country_file_name = sys.argv[1], sys.argv[2]
    device = sys.argv[3] if len(sys.argv) > 3 else 'cuda'
    
    doc_dict = dict()
    for file in sorted(os.listdir(path)):
        file_name = os.path.join(path, file)
        if not os.path.isfile(file_name) or not file.startswith('processed-') or not file.endswith('-news-articles.jsonl'):
            continue
        
        pub_date = file[10:20]
        documents = []
        with open(file_name, 'rt') as in_file:
            for line in in_file.readlines():
                document = json.loads(line.strip())
                document['embeddings'] = numpy.asarray(document['embeddings'])
                count = increase_count(count, '.')

        doc_dict[pub_date] = documents
        print(f"\n[{pub_date}] Read {count} articles.\n")

    # Step 1 - Extract embeddings
    # device_id = 'mps' if device == 'mps' else worker_id
    # sentence_transformer = SentenceTransformer('sentence-transformers/all-mpnet-base-v2', device=device_id)
    embedding_model = SentenceTransformer('sentence-transformers/all-mpnet-base-v2', device=device)

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
        embedding_model=embedding_model,          # Step 1 - Extract embeddings
        umap_model=umap_model,                    # Step 2 - Reduce dimensionality
        hdbscan_model=hdbscan_model,              # Step 3 - Cluster reduced embeddings
        vectorizer_model=vectorizer_model,        # Step 4 - Tokenize topics
        ctfidf_model=ctfidf_model,                # Step 5 - Extract topic words
        representation_model=representation_model # Step 6 - (Optional) Fine-tune topic representations
    )

    for pub_date in sorted(doc_dict.keys())[0:1]:
        documents = doc_dict[pub_date]
        
        embeddings = [document['embeddings'] for document in documents]
        document_ids = [document['title'] for document in documents]
        topics, probs = topic_model.fit_transform(documents, embeddings)
        
        print(topic_model.get_topic_info())
        
        viz_words = topic_model.visualize_barchart(top_n_topics=20, custom_labels=True)
        viz_words.show()

        viz_hie_arch = topic_model.visualize_hierarchy(custom_labels=True)
        viz_hie_arch.show()

        # Run the visualization with the original embeddings
        topic_model.visualize_documents(documents, embeddings=embeddings)

        # Reduce dimensionality of embeddings, this step is optional but much faster to perform iteratively:
        reduced_embeddings = UMAP(n_neighbors=10, n_components=2, min_dist=0.0, metric='cosine').fit_transform(embeddings)
        viz_docs = topic_model.visualize_documents(documents, reduced_embeddings=reduced_embeddings, width=2880, height=1620, custom_labels=True)
        viz_docs.show()
        
