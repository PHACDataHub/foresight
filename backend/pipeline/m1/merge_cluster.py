from collections import defaultdict
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

from river import stream
from river import cluster


CUSTOM_TOPICS = {
    "Infectious Diseases": [
        "Viral infections", "Bacterial infections", "Fungal infections", "Prion diseases", "Parasitic infections", "Pathogenic microorganisms", "Disease transmission", "Epidemic outbreaks", "Treatment protocols", "Contagious diseases", "Emerging pathogens", "Disease control measures", "Infection prevention", "Vaccine development", "Disease surveillance"
    ], 
    "Public Health and Wellness": [
        "Chronic conditions management", "Lifestyle factors", "Mental health awareness", "Aging population health", "Substance abuse prevention", "Drug addiction treatment", "Overdose prevention strategies", "Nutrition guidelines", "Injury prevention programs", "Health promotion initiatives", "Preventive healthcare services", "Well-being interventions", "Health education campaigns", "Physical activity promotion", "Stress management techniques"
    ], 
    "Environmental Hazards and Pollution": [
        "Air pollution levels", "Water quality assessments", "Soil contamination sources", "Waste management practices", "Pest control measures", "Climate change impacts", "Adaptation strategies", "Environmental degradation indicators", "Pollution mitigation efforts", "Environmental monitoring systems", "Hazardous waste disposal", "Pollution control regulations", "Green technology innovations", "Ecological sustainability initiatives", "Biodiversity conservation efforts"
    ],
    "Biological Threats and Bioterrorism": [
        "Biosecurity measures", "Bioterrorism preparedness", "Biological attack scenarios", "Laboratory safety protocols", "Infectious waste disposal", "Animal reservoir surveillance", "Vector-borne disease control", "Biodefense strategies", "Global health security initiatives", "Infection control practices", "Disease outbreak responses", "Pathogen surveillance systems", "Biological threat assessments", "Public health emergency plans", "Health security collaborations"
    ], 
    "Medical Product Safety and Surveillance": [
        "Drug safety monitoring", "Medical device recalls", "Vaccine safety assessments", "Adverse event reporting", "Immunization surveillance", "Pharmacovigilance programs", "Medical technology advancements", "Health product regulation", "Drug efficacy evaluations", "Device safety standards", "Vaccine adverse reactions", "Product quality control", "Post-marketing surveillance", "Healthcare technology assessment", "Regulatory compliance enforcement"
    ], 
    "Chemical and Occupational Hazards.": [
        "Toxicological studies", "Chemical exposure risks", "Pesticide regulations", "Carcinogenic substances", "Chemical spill response", "Workplace safety guidelines", "Environmental monitoring protocols", "Poison control centers", "Hazardous material handling", "Air pollutant levels", "Industrial accident investigations", "Radiation protection measures", "Fire prevention strategies", "Explosion hazards", "Occupational health regulations"
    ], 
    "Occupational Health and Safety": [
        "Workplace hazard assessments", "Noise pollution controls", "Mechanical hazard identification", "Industrial accident prevention", "Radiation exposure monitoring", "Ergonomic design principles", "Structural integrity inspections", "Transportation safety measures", "Cybersecurity protocols", "Infrastructure maintenance", "Incident response plans", "Workplace injury prevention", "Health and safety training", "Occupational health services", "Safety culture promotion"
    ], 
    "Vaccine-Preventable Diseases": [
        "Immunization programs", "Vaccine distribution strategies", "Vaccination policy updates", "Herd immunity thresholds", "Vaccine hesitancy interventions", "Vaccine technology advancements", "Disease outbreak containment", "Vaccine efficacy studies", "Immunization coverage rates", "Public health vaccination campaigns", "Adverse reactions monitoring", "Vaccine-preventable disease surveillance", "Vaccination scheduling", "Vaccine safety communications", "Immunization recommendations"
    ], 
    "Antibiotic Resistance and Infection Control": [
        "Antibiotic stewardship programs", "Superbug outbreaks", "Drug-resistant infections management", "Multidrug resistance mechanisms", "Healthcare-associated infections prevention", "Bacteriophage therapy research", "Infection control guidelines", "Resistance gene surveillance", "Antimicrobial technology development", "Infection prevention strategies", "Antimicrobial resistance monitoring", "Hospital infection control practices", "Antibiotic resistance education", "Resistance gene transfer mechanisms", "Antimicrobial resistance policies"
    ], 
    "Zoonotic Diseases": [
        "Animal-to-human transmission pathways", "Vector-borne disease surveillance", "One Health initiatives", "Wildlife reservoir identification", "Spillover events investigation", "Veterinary public health measures", "Anthroponotic disease control", "Vector control strategies", "Emerging zoonotic diseases monitoring", "Zoonotic disease prevention programs", "Vectors identification and control", "Disease transmission modeling", "Emerging infectious diseases surveillance", "Wildlife disease ecology studies", "Zoonotic disease research collaborations"
    ], 
    "Foodborne Disease Prevention and Regulation.": [
        "Foodborne illness surveillance", "Foodborne outbreak investigations", "Food safety regulations enforcement", "Food recall protocols", "Food contamination detection methods", "Food production standards", "Food processing regulations", "Food storage guidelines", "Food handling and preparation practices", "Hazard analysis and critical control points (HACCP)", "Foodborne disease prevention measures", "Food safety training programs", "Public health inspections", "Quality assurance in food production", "Regulatory compliance in food industry"
    ], 
    "Health Disparities and Access": [
        "Social determinants of health", "Health equity initiatives", "Healthcare access barriers", "Disadvantaged populations health disparities", "Health outcomes disparities", "Health policy analysis", "Health data collection and analysis", "Health information systems", "Healthcare capacity planning", "Healthcare infrastructure development", "Equitable healthcare provision", "Healthcare disparities reduction strategies", "Healthcare resource allocation", "Access to healthcare services", "Healthcare affordability"
    ], 
    "Natural Disasters and Health": [
        "Geophysical event impacts on health", "Hydrological event consequences", "Meteorological event effects on health", "Climatological event impacts on public health", "Extraterrestrial event preparedness", "Disaster response protocols", "Evacuation planning", "Emergency preparedness measures", "Relief efforts coordination", "Humanitarian aid distribution", "Disaster risk reduction strategies", "Community resilience building", "Healthcare infrastructure resilience", "Disaster-related health hazards", "Post-disaster health management"
    ],
    "Societal hazards": [
        "Mass gatherings health risks", "Violence-related health impacts", "Conflict-induced health crises", "Civil unrest consequences on health", "Terrorism and health effects", "Financial crisis implications on health", "Geopolitical factors and health", "Political instability effects on public health", "Recession and health outcomes", "Social instability impacts on healthcare", "Community safety measures", "Risk communication strategies", "Crisis response coordination", "Public health interventions during crises", "Resilience-building programs"
    ], 
    "Unknown Health Threats": [
        "Unknown pathogens discovery", "Emerging pathogens surveillance", "Novel pathogens identification", "Unknown diseases investigation", "Anomalous health patterns detection", "Anomalous disease clusters analysis", "Unforeseen health outcomes assessment", "Unforeseen health incidents monitoring", "Unforeseen health risks identification", "Disease outbreak investigation", "Epidemiological surveillance", "Global health monitoring", "Pandemic preparedness planning", "Early warning systems", "Disease outbreak response strategies"
    ]
}

# SEED_WORDS = [
#     "virus", "bacteria", "fungus", "prion", "parasite", "pathogen", "contagion", "epidemic", "transmission", "treatment", 
#     "chronic conditions", "lifestyle", "mental health", "aging", "substances", 
#     "drugs", "overdose", "drug poisoning", "nutrition", "injuries", 
#     "pollution", "air quality", "water safety", "soil contamination", "waste", "pests", "environmental degradation", "climate change", "mitigation and adaptation", "environmental indicators", 
#     "biosecurity", "bioterrorism", "biological attacks", "laboratory safety", "infectious waste", "animal reservoirs", "vector control", "biodefense", "infection prevention and control", "global health security", 
#     "drug safety", "drug recalls", "medical device safety", "medical device recalls", "vaccine safety", "vaccine recalls", "adverse events following immunization", "pharmacovigilance", "medical technology", 
#     "toxicology", "chemical exposure", "pesticides", "carcinogens", "chemical spills", "workplace safety", "environmental monitoring", "poison control", "hazardous materials", "air pollutants", "explosions", "fire", 
#     "occupational hazards", "noise pollution", "mechanical hazards", "industrial accidents", "radiation", "ergonomics", "structural collapse", "transportation incidents", "cybersecurity events", "infrastructure disruption", 
#     "immunization", "vaccine", "vaccination policy", "herd immunity", "vaccine hesitancy", "vaccine technologies", "vaccine-preventable disease outbreaks", 
#     "antibiotic resistance", "superbugs", "drug-resistant infections", "stewardship", "multi-drug resistance", "healthcare-associated infections", "bacteriophages", "infection prevention and control", "resistance genes", "antimicrobial technology", 
#     "animal-to-human", "vector-borne", "One Health", "wildlife reservoirs", "animal reservoirs", "spillover", "veterinary public health", "anthroponotic", "vectors", "emerging diseases", 
#     "foodborne illness", "foodborne illness outbreaks", "food regulations", "food recalls", "food contamination", "food production", "food processing", "food storage", "food handling and preparation", "hazard analysis and critical control points", 
#     "social determinants of health", "health equity", "healthcare access", "disadvantaged populations", "health outcomes", "health policy", "health data", "information systems", "healthcare capacity", 
#     "geophysical event", "hydrological event", "meteorological event", "climatological event", "extraterrestrial event", "disaster response", "evacuation", "emergency preparedness", "relief efforts", "humanitarian aid", 
#     "mass gatherings", "violence", "conflict", "civil unrest", "terrorism", "financial crisis", "geopolitics", "political instability", "recession ", 
#     "unknown pathogens", "emerging pathogens", "novel pathogens", "unknown diseases", "anomalous health patterns", "anomalous disease clusters", "unforeseen health outcomes", "unforeseen health incidents", "unforeseen health risks"
# ]

def increase_count(count, character):
    count += 1
    print(character, end="", flush=True)
    return count


def load_disease_names(in_file_name):
    disease_names = []
    with open(in_file_name, 'rt') as in_file:
        count = 1
        for line in in_file.readlines()[1:]:
            count += 1
            url, definition, label, synonyms = line.split('\t')
            label = label.strip()
            if label.startswith('obsolete'):
                label = label.replace('obsolete ', '')
            disease_names.extend([s for s in [label] + eval(synonyms) if s])
    return disease_names


def load_jsonl(file_name, slice=None):
    with open(file_name, 'rt') as in_file:
        lines = in_file.readlines()[0:int(slice)] if slice else in_file.readlines()
        documents = [json.loads(line.strip()) for line in lines]
        print(f"[{file_name}] Read {len(lines)} articles.")
        return documents


class River:
    def __init__(self, model):
        self.model = model

    def partial_fit(self, umap_embeddings):
        for umap_embedding, _ in stream.iter_array(umap_embeddings):
            self.model.learn_one(umap_embedding)

        labels = []
        for umap_embedding, _ in stream.iter_array(umap_embeddings):
            label = self.model.predict_one(umap_embedding)
            labels.append(label)

        self.labels_ = labels
        return self
    
    
if __name__ == '__main__':
    in_path, out_path, do_file_name, device = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    if len(sys.argv) > 6:
        start_date, end_date = sys.argv[5], sys.argv[6]

    disease_names = load_disease_names(do_file_name)
    print(f"Read {len(disease_names)} distinct disease names.")

    device_id = 'mps' if device == 'mps' else 0

    model_name = 'sentence-transformers/all-MiniLM-L6-v2'
    date_list = [f"{month}-{day:02}" for month in ['2019-12', '2020-01'] for day in range(1, 32)]

    relevant_phrases = [phrase for phrases in CUSTOM_TOPICS.values() for phrase in phrases]
    print(f"Read {len(relevant_phrases)} distinct relevant phrases.")

    print('Loading tool models ...')
    device_id = 'mps' if device == 'mps' else 0
    embedding_model = SentenceTransformer(model_name, device=device)
    umap_model = UMAP(n_neighbors=10, n_components=5, min_dist=0.0, metric='cosine', random_state=42)
    hdbscan_model = HDBSCAN(min_cluster_size=10, metric='euclidean', cluster_selection_method='eom', prediction_data=True)
    vectorizer_model = CountVectorizer(stop_words="english", min_df=2, ngram_range=(1, 3))
    ctfidf_model = ClassTfidfTransformer(
        seed_words=relevant_phrases,
        seed_multiplier=2,
        reduce_frequent_words=True
    )
    representation_model = KeyBERTInspired()

    nr_documents = 0
    documents = []
    for pub_date in date_list:
        if start_date and (start_date > pub_date or pub_date > end_date):
            continue
        in_file_name = f"{in_path}/processed-{pub_date}-news-articles.jsonl"
        daily_docs = load_jsonl(in_file_name)
        nr_documents += len(daily_docs)
        documents.extend(daily_docs)

    topic_models = []
    total, cur_idx, batch_size = len(documents), 0, 3000
    min_iter = 1 if total < 2 * batch_size else total // batch_size
    for i in range(0, min_iter):
        e = (i+1) * batch_size if i < min_iter-1 else total
        batch = [f"{d['title']}\n\n{d['content']}" for d in documents[i * batch_size : e]]

        print(f"Training model with [{len(batch)}] documents ...")
        start_time = datetime.now()

        topic_model = BERTopic(
            embedding_model=embedding_model,            # Step 1 - Extract embeddings
            umap_model=umap_model,                      # Step 2 - Reduce dimensionality
            hdbscan_model=hdbscan_model,                # Step 3 - Cluster reduced embeddings
            vectorizer_model=vectorizer_model,          # Step 4 - Tokenize topics
            ctfidf_model=ctfidf_model,                  # Step 5 - Extract topic words
            representation_model=representation_model,  # Step 6 - (Optional) Fine-tune topic representations
            zeroshot_topic_list=list(CUSTOM_TOPICS.values()),
            zeroshot_min_similarity=.85,
            calculate_probabilities=True,
            verbose=True
        )

        topic_model.fit(batch)
        print(topic_model.get_topic_info())
        
        topic_models.append(topic_model)

        end_time = datetime.now()
        seconds = (end_time - start_time).total_seconds()
        print(f"{seconds} seconds --- {len(batch)} docs --- {seconds/len(batch):0.2f} seconds per document.\n")

    merged_model = BERTopic.merge_models(topic_models, min_similarity=0.9)
    
    print('Latest topic info ...')   
    print(merged_model.get_topic_info())
    
    topic_docs = defaultdict(list)
    
    nr_articles = 0
    total, cur_idx, batch_size = len(documents), 0, 3000
    min_iter = 1 if total < 2 * batch_size else total // batch_size
    for i in range(0, min_iter):
        e = (i+1) * batch_size if i < min_iter-1 else total
        batch, doc_ids = [], []
        for j, d in enumerate(documents[i * batch_size : e]):
            batch.append(f"{d['title']}\n\n{d['content']}")
            doc_ids.append(i * batch_size + j)

        print(f"Using model with [{len(batch)}] documents ...")
        start_time = datetime.now()
        
        topics, probs = merged_model.transform(batch)
        for topic, doc_id in zip(topics, doc_ids):
            topic_docs[topic].append(doc_id)
            nr_articles += 1

        end_time = datetime.now()
        seconds = (end_time - start_time).total_seconds()
        print(f"{seconds} seconds --- {len(batch)} docs --- {seconds/len(batch):0.2f} seconds per document.\n")
    
    print(f"{nr_articles} articles transformed.")
    
    nr_articles = 0
    for topic in sorted(topic_docs.keys()):
        nr_articles += len(topic_docs[topic])
        print(f"{topic} --- {merged_model.topic_labels_[topic]} --- [{len(topic_docs[topic])}]")
        for id in topic_docs[topic]:
            print(f"\t{documents[id]['title']}")
    
    assert nr_documents == nr_articles, f"{nr_documents} != {nr_articles}"