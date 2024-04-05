from datetime import datetime
import json
import sys

from sentence_transformers import SentenceTransformer
from umap import UMAP
from hdbscan import HDBSCAN
from sklearn.feature_extraction.text import CountVectorizer
from bertopic.vectorizers import ClassTfidfTransformer
from bertopic.representation import KeyBERTInspired
from bertopic import BERTopic


SEED_WORDS = [
    "virus", "bacteria", "fungus", "prion", "parasite", "pathogen", "contagion", "epidemic", "transmission", "treatment", 
    "chronic conditions", "lifestyle", "mental health", "aging", "substances", 
    "drugs", "overdose", "drug poisoning", "nutrition", "injuries", 
    "pollution", "air quality", "water safety", "soil contamination", "waste", "pests", "environmental degradation", "climate change", "mitigation and adaptation", "environmental indicators", 
    "biosecurity", "bioterrorism", "biological attacks", "laboratory safety", "infectious waste", "animal reservoirs", "vector control", "biodefense", "infection prevention and control", "global health security", 
    "drug safety", "drug recalls", "medical device safety", "medical device recalls", "vaccine safety", "vaccine recalls", "adverse events following immunization", "pharmacovigilance", "medical technology", 
    "toxicology", "chemical exposure", "pesticides", "carcinogens", "chemical spills", "workplace safety", "environmental monitoring", "poison control", "hazardous materials", "air pollutants", "explosions", "fire", 
    "occupational hazards", "noise pollution", "mechanical hazards", "industrial accidents", "radiation", "ergonomics", "structural collapse", "transportation incidents", "cybersecurity events", "infrastructure disruption", 
    "immunization", "vaccine", "vaccination policy", "herd immunity", "vaccine hesitancy", "vaccine technologies", "vaccine-preventable disease outbreaks", 
    "antibiotic resistance", "superbugs", "drug-resistant infections", "stewardship", "multi-drug resistance", "healthcare-associated infections", "bacteriophages", "infection prevention and control", "resistance genes", "antimicrobial technology", 
    "animal-to-human", "vector-borne", "One Health", "wildlife reservoirs", "animal reservoirs", "spillover", "veterinary public health", "anthroponotic", "vectors", "emerging diseases", 
    "foodborne illness", "foodborne illness outbreaks", "food regulations", "food recalls", "food contamination", "food production", "food processing", "food storage", "food handling and preparation", "hazard analysis and critical control points", 
    "social determinants of health", "health equity", "healthcare access", "disadvantaged populations", "health outcomes", "health policy", "health data", "information systems", "healthcare capacity", 
    "geophysical event", "hydrological event", "meteorological event", "climatological event", "extraterrestrial event", "disaster response", "evacuation", "emergency preparedness", "relief efforts", "humanitarian aid", 
    "mass gatherings", "violence", "conflict", "civil unrest", "terrorism", "financial crisis", "geopolitics", "political instability", "recession ", 
    "unknown pathogens", "emerging pathogens", "novel pathogens", "unknown diseases", "anomalous health patterns", "anomalous disease clusters", "unforeseen health outcomes", "unforeseen health incidents", "unforeseen health risks"
]

def increase_count(count, character):
    count += 1
    print(character, end="", flush=True)
    return count


def load_jsonl(file_name, slice=None):
    with open(file_name, 'rt') as in_file:
        lines = in_file.readlines()[0:int(slice)] if slice else in_file.readlines()
        documents = [json.loads(line.strip()) for line in lines]
        print(f"[{file_name}] Read {len(documents)} articles.")
        return documents


def model_topics(texts, model_name, device):
    device_id = 'mps' if device == 'mps' else i

    print('Loading tool models ...')
    embedding_model = SentenceTransformer(model_name, device=device_id)
    umap_model = UMAP(n_neighbors=15, n_components=5, min_dist=0.0, metric='cosine') #, random_state=42)
    hdbscan_model = HDBSCAN(min_cluster_size=15, metric='euclidean', cluster_selection_method='eom', prediction_data=True)
    vectorizer_model = CountVectorizer(stop_words="english")
    ctfidf_model = ClassTfidfTransformer(
        seed_words=SEED_WORDS,
        seed_multiplier=2,
        reduce_frequent_words=True
    )
    representation_model = KeyBERTInspired()
    
    print('Compute embeddings ...')
    start_time = datetime.now()
    embeddings = embedding_model.encode(texts, show_progress_bar=True)

    topic_model = BERTopic(
        embedding_model=embedding_model,            # Step 1 - Extract embeddings
        umap_model=umap_model,                      # Step 2 - Reduce dimensionality
        hdbscan_model=hdbscan_model,                # Step 3 - Cluster reduced embeddings
        vectorizer_model=vectorizer_model,          # Step 4 - Tokenize topics
        ctfidf_model=ctfidf_model,                  # Step 5 - Extract topic words
        representation_model=representation_model,  # Step 6 - (Optional) Fine-tune topic representations
        calculate_probabilities=True,
        verbose=True
    )

    print('Train model ...')
    topics, _ = topic_model.fit_transform(texts, embeddings)
    print(topic_model.get_topic_info())
    
    end_time = datetime.now()
    seconds = (end_time - start_time).total_seconds()
    print(f"{seconds} seconds --- {len(texts)} docs --- {seconds/len(texts):0.2f} seconds per document.\n")
    return topic_model



if __name__ == '__main__':
    path, device = sys.argv[1], sys.argv[2]

    model_name = 'sentence-transformers/all-MiniLM-L6-v2'
    date_list = [f"{month}-{day:02}" for month in ['2019-12', '2020-01'] for day in range(1, 32)]
    daily_documents_dict = dict()

    for pub_date in date_list:
        in_file_name = f"{path}/processed-{pub_date}-news-articles.jsonl"
        daily_documents = load_jsonl(in_file_name)
        full_texts = [f"{d['title']}\n\n{d['content']}" for d in daily_documents]

        daily_documents_dict[pub_date] = daily_documents
        topic_model = model_topics(full_texts, model_name, device)

        out_file_name = f"{path}/processed-{pub_date}-ctm.pkl"
        topic_model.save(out_file_name, serialization="pickle")
        print(f"[{out_file_name}] saved.")
        
    for period_length, period_days in [ (3, range(30, 37)), (7, range(30, 31)), (30, range(30, 31)) ]:
        for i in period_days:
            start_period, end_period = date_list[i], date_list[i+period_length-1]
            period_documents = [d for j in range(0, period_length) for d in daily_documents_dict[date_list[i+j]]]
            full_texts = [f"{d['title']}\n\n{d['content']}" for d in period_documents]

            topic_model = model_topics(full_texts, model_name, device)

            out_file_name = f"{path}/processed-{start_period}-{end_period}-ctm.pkl"
            topic_model.save(out_file_name, serialization="pickle")
            print(f"[{out_file_name}] saved.")
