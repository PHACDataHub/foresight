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
        print(f"[{file_name}] Read {len(documents)} articles.")
        return documents


if __name__ == '__main__':
    in_path, out_path, do_file_name, device = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    if len(sys.argv) > 6:
        start_date, end_date = sys.argv[5], sys.argv[6]

    disease_names = load_disease_names(do_file_name)
    print(f"Read {len(disease_names)} distinct disease names.")

    relevant_phrases = [phrase for phrases in CUSTOM_TOPICS.values() for phrase in phrases]
    print(f"Read {len(relevant_phrases)} distinct relevant phrases.")

    model_name = 'sentence-transformers/all-MiniLM-L6-v2'
    date_list = [f"{month}-{day:02}" for month in ['2019-12', '2020-01'] for day in range(1, 32)]
    daily_documents_dict = dict()

    for pub_date in date_list:
        if start_date and (start_date > pub_date or pub_date > end_date):
            continue
        
        in_file_name = f"{in_path}/processed-{pub_date}-news-articles.jsonl"
        daily_documents = load_jsonl(in_file_name)
        full_texts = [f"{d['title']}\n\n{d['content']}" for d in daily_documents]

        daily_documents_dict[pub_date] = daily_documents
        
        device_id = 'mps' if device == 'mps' else 0
        # embedding_model = SentenceTransformer(model_name, device=device)
        
        print('Compute embeddings ...')
        start_time = datetime.now()

        if device == 'mps':
            embedding_model = SentenceTransformer(model_name, device=device)
            embeddings = embedding_model.encode(full_texts, show_progress_bar=True)
        else:
            embedding_model = SentenceTransformer(model_name)
            processing_pool = embedding_model.start_multi_process_pool()
            embeddings = embedding_model.encode_multi_process(full_texts, processing_pool)
            embedding_model.stop_multi_process_pool(processing_pool)
        
        print('Loading tool models ...')
        umap_model = UMAP(n_neighbors=15, n_components=5, min_dist=0.0, metric='cosine') #, random_state=42)
        hdbscan_model = HDBSCAN(min_cluster_size=15, metric='euclidean', cluster_selection_method='eom', prediction_data=True)
        vectorizer_model = CountVectorizer(stop_words="english")
        ctfidf_model = ClassTfidfTransformer(
            seed_words=relevant_phrases,
            seed_multiplier=2,
            reduce_frequent_words=True
        )
        representation_model = KeyBERTInspired()
        

        topic_model_1 = BERTopic(
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

        print('Train model ...')
        topics, _ = topic_model_1.fit_transform(full_texts, embeddings)
        print(topic_model_1.get_topic_info())
        
        end_time = datetime.now()
        seconds = (end_time - start_time).total_seconds()
        print(f"{seconds} seconds --- {len(full_texts)} docs --- {seconds/len(full_texts):0.2f} seconds per document.\n")
        
        # out_file_name = f"{out_path}/processed-{pub_date}-ctm.pkl"
        # topic_model.save(out_file_name, serialization="pickle")
        # print(f"[{out_file_name}] saved.")
        
        print('Extracting outliers ...')   
        document_info = topic_model_1.get_document_info(full_texts)
        headers, rows = document_info.columns.tolist(), document_info.values.tolist()
        
        outlier_texts, document_ids, document_index = [], [], 0
        for row in rows:
            row_dict = {header: value for header, value in zip(headers, row)}
            topic_id = row_dict['Topic']
            if topic_id != -1:
                continue
            document_ids.append(document_index)
            outlier_texts.append(row_dict['Document'])
            document_index += 1
        
        print(f"Found {len(outlier_texts)} outliers.")
        
        print('Compute embeddings ...')
        start_time = datetime.now()

        if device == 'mps':
            embedding_model = SentenceTransformer(model_name, device=device)
            embeddings = embedding_model.encode(full_texts, show_progress_bar=True)
        else:
            embedding_model = SentenceTransformer(model_name)
            processing_pool = embedding_model.start_multi_process_pool()
            embeddings = embedding_model.encode_multi_process(outlier_texts, processing_pool)
            embedding_model.stop_multi_process_pool(processing_pool)
        
        print('Loading tool models ...')
        umap_model = UMAP(n_neighbors=15, n_components=5, min_dist=0.0, metric='cosine') #, random_state=42)
        hdbscan_model = HDBSCAN(min_cluster_size=10, metric='euclidean', cluster_selection_method='eom', prediction_data=True)
        vectorizer_model = CountVectorizer(stop_words="english")
        ctfidf_model = ClassTfidfTransformer(reduce_frequent_words=True)
        representation_model = KeyBERTInspired()
        
        topic_model_2 = BERTopic(
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
        topics, _ = topic_model_2.fit_transform(outlier_texts, embeddings)
        print(topic_model_2.get_topic_info())
        
        end_time = datetime.now()
        seconds = (end_time - start_time).total_seconds()
        print(f"{seconds} seconds --- {len(outlier_texts)} docs --- {seconds/len(outlier_texts):0.2f} seconds per document.\n")
                
        print('Extracting second outliers ...')   
        document_info = topic_model_2.get_document_info(outlier_texts)
        headers, rows = document_info.columns.tolist(), document_info.values.tolist()
        
        outlier_texts, document_index = [], 0
        for row in rows:
            row_dict = {header: value for header, value in zip(headers, row)}
            topic_id = row_dict['Topic']
            if topic_id != -1:
                continue
            outlier_texts.append(row_dict['Document'])
            document_index += 1
        
        print(f"Found {len(outlier_texts)} outliers.")
        
        print('Compute embeddings ...')
        start_time = datetime.now()

        if device == 'mps':
            embedding_model = SentenceTransformer(model_name, device=device)
            embeddings = embedding_model.encode(full_texts, show_progress_bar=True)
        else:
            embedding_model = SentenceTransformer(model_name)
            processing_pool = embedding_model.start_multi_process_pool()
            embeddings = embedding_model.encode_multi_process(outlier_texts, processing_pool)
            embedding_model.stop_multi_process_pool(processing_pool)

        print('Loading tool models ...')
        umap_model = UMAP(n_neighbors=15, n_components=5, min_dist=0.0, metric='cosine') #, random_state=42)
        hdbscan_model = HDBSCAN(min_cluster_size=5, metric='euclidean', cluster_selection_method='eom', prediction_data=True)
        vectorizer_model = CountVectorizer(stop_words="english")
        ctfidf_model = ClassTfidfTransformer(reduce_frequent_words=True)
        representation_model = KeyBERTInspired()
        
        print('Compute embeddings ...')
        start_time = datetime.now()
        
        embeddings = embedding_model.encode(outlier_texts, show_progress_bar=True)

        topic_model_3 = BERTopic(
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
        topics, _ = topic_model_3.fit_transform(outlier_texts, embeddings)
        print(topic_model_3.get_topic_info())
        
    # for period_length, period_days in [ (3, range(30, 37)), (7, range(30, 31)), (30, range(30, 31)) ]:
    #     for i in period_days:
    #         start_period, end_period = date_list[i], date_list[i+period_length-1]
    #         period_documents = [d for j in range(0, period_length) for d in daily_documents_dict[date_list[i+j]]]
    #         full_texts = [f"{d['title']}\n\n{d['content']}" for d in period_documents]

    #         topic_model = model_topics(full_texts, model_name, device)

    #         out_file_name = f"{path}/processed-{start_period}-{end_period}-ctm.pkl"
    #         topic_model.save(out_file_name, serialization="pickle")
    #         print(f"[{out_file_name}] saved.")
