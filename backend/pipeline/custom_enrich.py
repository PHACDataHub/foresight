import csv
from datetime import datetime
import json
import re
import sys

from bertopic import BERTopic

from langchain.schema import Document
from langchain_community.llms import Ollama
from langchain.chains.summarize import load_summarize_chain

from langchain.chains.llm import LLMChain
from langchain.output_parsers.list import NumberedListOutputParser
from langchain.prompts.prompt import PromptTemplate

from transformers import AutoTokenizer, AutoModelForTokenClassification
from transformers import pipeline

from langchain_core.exceptions import OutputParserException
from langchain_core.pydantic_v1 import BaseModel, Field
from langchain.output_parsers.json import SimpleJsonOutputParser


CUSTOM_TOPICS = {
    "Infectious Diseases": ["virus", "bacteria", "fungus", "prion", "parasite", "pathogen", "contagion", "epidemic", "transmission", "treatment"], 
    "Non-Infectious Diseases": ["chronic conditions", "lifestyle", "mental health", "aging", "substances", "drugs", "overdose", "drug poisoning", "nutrition", "injuries"], 
    "Environmental Hazards": ["pollution", "air quality", "water safety", "soil contamination", "waste", "pests", "environmental degradation", "climate change", "mitigation and adaptation", "environmental indicators"], 
    "Biosecurity and Biosafety": ["biosecurity", "bioterrorism", "biological attacks", "laboratory safety", "infectious waste", "animal reservoirs", "vector control", "biodefense", "infection prevention and control", "global health security"], 
    "Drug and Medical Device Safety": ["drug safety", "drug recalls", "medical device safety", "medical device recalls", "vaccine safety", "vaccine recalls", "adverse events following immunization", "pharmacovigilance", "medical technology"], 
    "Chemical Hazards": ["toxicology", "chemical exposure", "pesticides", "carcinogens", "chemical spills", "workplace safety", "environmental monitoring", "poison control", "hazardous materials", "air pollutants", "explosions", "fire"], 
    "Technological and Infrastructural Hazards": ["occupational hazards", "noise pollution", "mechanical hazards", "industrial accidents", "radiation", "ergonomics", "structural collapse", "transportation incidents", "cybersecurity events", "infrastructure disruption"], 
    "Vaccine-Preventable Diseases": ["immunization", "vaccine", "vaccination policy", "herd immunity", "vaccine hesitancy", "vaccine technologies", "vaccine-preventable disease outbreaks"], 
    "Antimicrobial Resistance": ["antibiotic resistance", "superbugs", "drug-resistant infections", "stewardship", "multi-drug resistance", "healthcare-associated infections", "bacteriophages", "infection prevention and control", "resistance genes", "antimicrobial technology"], 
    "Zoonotic Diseases": ["animal-to-human", "vector-borne", "One Health", "wildlife reservoirs", "animal reservoirs", "spillover", "veterinary public health", "anthroponotic", "vectors", "emerging diseases"], 
    "Food Safety": ["foodborne illness", "foodborne illness outbreaks", "food regulations", "food recalls", "food contamination", "food production", "food processing", "food storage", "food handling and preparation", "hazard analysis and critical control points"], 
    "Health Disparities and Health System Issues": ["social determinants of health", "health equity", "healthcare access", "disadvantaged populations", "health outcomes", "health policy", "health data", "information systems", "healthcare capacity"], 
    "Natural Disasters and Health": ["geophysical event", "hydrological event", "meteorological event", "climatological event", "extraterrestrial event", "disaster response", "evacuation", "emergency preparedness", "relief efforts", "humanitarian aid"], 
    "Societal hazards": ["mass gatherings", "violence", "conflict", "civil unrest", "terrorism", "financial crisis", "geopolitics", "political instability", "recession"], 
    "Unknown": ["unknown pathogens", "emerging pathogens", "novel pathogens", "unknown diseases", "anomalous health patterns", "anomalous disease clusters", "unforeseen health outcomes", "unforeseen health incidents", "unforeseen health risks"]
}

# MAX_DOC_LENGTH = 1536
MAX_DOC_LENGTH = 1024

# TOPIC_LIST = [
#     'Health impacts of geophysical events, including earthquakes, tsunamis, liquefaction, volcanic activity, and mass movement such as landslides, rock fall, and subsidence that have a geophysical trigger ',
#     'Health impacts of hydro-meteorological events, including storms, extreme temperatures, droughts, wildfires, floods, wave action, and mass movement such as landslides, avalanches, mudflows, and debris flows that have a hydro-meteorological trigger',
#     'Health impacts of known infectious diseases and outbreaks, including airborne diseases, waterborne diseases, vectorborne diseases, foodborne diseases, and antimicrobial resistant microorganisms',
#     'Outbreaks linked to vaccine-preventable diseases',
#     'Foodborne illness outbreaks and recalls',
#     'Waterborne diseases and contamination alerts',
#     'Health impacts of chemical, radiological, and technological events, including industrial accidents, radiation exposure, structural collapse, occupational hazards, transportation incidents, explosions, fires, infrastructure disruption, cybersecurity events, and chemical and radiological contamination of air, soil, water and food',
#     'Potential biological attacks or bioterrorism threats',
#     'Health impacts of societal events, including mass gatherings, acts of violence, armed conflicts, civil unrest, stampedes, terrorism, and financial crises',
#     'Health impacts of abnormal environmental indicators, including air pollution, erosion, deforestation, salinization, sea level rise, desertification, habitat degradation, glacier retreat, sand encroachment, and changing climate patterns',
#     'Reports on suspicious drug-related incidents, drug recalls, and drug safety concerns',
#     'Healthcare system issues, including controversies or developments in vaccination policies, security breaches or cyberattacks on healthcare systems, risks to patient data, healthcare system evaluations of readiness during emergencies, and healthcare capacity reports during crises or emergencies',
#     'Emerging infectious diseases, novel pathogens, or emerging pathogens',
#     'Anomalous health patterns, disease clusters, and disease-related incidents',
#     'Unforeseen health outcomes, health risks, and health incidents',
#     'Issues with medical device safety, recalls, and their impact on health'
# ]

TOPIC_LIST = list(CUSTOM_TOPICS.keys())

# TOPIC_LIST = [
#     'Outbreaks of known infectious diseases',
#     'Emerging infectious diseases or novel pathogens',
#     'Hurricanes, earthquakes, floods, wildfires, and their health impacts',
#     'Effects on health infrastructure and services during disasters',
#     'Air pollution levels and associated health risks',
#     'Water contamination issues and their health implications',
#     'Chemical spills or industrial accidents affecting public health',
#     'Health implications of accidents in industrial settings',
#     'Potential biological attacks or bioterrorism threats',
#     'Reports on suspicious disease-related incidents', 
#     'Reports on suspicious drug-related incidents', 
#     'Foodborne illness outbreaks and recalls',
#     'Waterborne diseases and contamination alerts',
#     'Incidents involving radiation exposure and their health consequences',
#     'Extreme weather events and health advisories',
#     'Health implications of changing climate patterns',
#     'Outbreaks linked to vaccine-preventable diseases',
#     'Controversies or developments in vaccination policies',
#     'Security breaches or cyberattacks on healthcare systems',
#     'Risks to patient data and healthcare services',
#     'Evaluations of healthcare system readiness during emergencies',
#     'Reports on hospital capacity during crises or emergencies',
#     'Drug recalls, counterfeit drugs, and safety concerns',
#     'Issues with medical device safety, recalls, and their impact on health',
#     'Unusual health patterns',
#     'Emerging pathogens',
#     'Abnormal environmental indicators',
#     'Unforeseen health outcomes',
#     'Anomalous disease clusters',
#     'Unrecognized health risks',
#     'Atypical health incidents'
# ]

# DISEASE_THREATS = {
#     'Health impacts of known infectious diseases and outbreaks, including airborne diseases, waterborne diseases, vectorborne diseases, foodborne diseases, and antimicrobial resistant microorganisms',
#     'Emerging infectious diseases, novel pathogens, or emerging pathogens',
#     'Anomalous health patterns, disease clusters, and disease-related incidents',
#     'Foodborne illness outbreaks and recalls',
#     'Waterborne diseases and contamination alerts',
#     'Outbreaks linked to vaccine-preventable diseases'
# }

DISEASE_THREATS = {
    "Infectious Diseases", 
    "Non-Infectious Diseases", 
    "Environmental Hazards",
    "Vaccine-Preventable Diseases", 
    "Zoonotic Diseases", 
    "Food Safety"
}

# DISEASE_THREATS = {
#     'Outbreaks of known infectious diseases',
#     'Emerging infectious diseases or novel pathogens',
#     'Reports on suspicious disease-related incidents', 
#     'Foodborne illness outbreaks and recalls',
#     'Waterborne diseases and contamination alerts',
#     'Outbreaks linked to vaccine-preventable diseases',
#     'Unusual health patterns',
#     'Emerging pathogens',
#     'Anomalous disease clusters',
# }

QUESTION_LIST = [
    'What disease is mentioned?',
    'What is the possible source of the disease?',
    'How does the disease spread?',
    'What geo location does the disease spread?',
    'What date did the disease start?',
    'Is the disease still spreading?',
]

OUTLIER_FILTER = 'Is it a disease outbreak news? Answer by Yes or No.'

JSON_REGEX = re.compile(r"```json\n([^`]+)\n```")


class Location(BaseModel):
    location: str = Field(description="name of a geo location")
    latitude: float = Field(description="latitude of the location")
    longitude: float = Field(description="longitude of the location")


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


def truncate_text(text, max_length=MAX_DOC_LENGTH):
    return text[0 : min(max_length, len(text))]


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


def find_coordinates(loc_chain, json_parser, answer):
    location, result = None, None

    output = loc_chain.invoke({'locations': answer})
    output_text = output['text'].strip()

    try:
        result = json_parser.parse(output_text)
    except OutputParserException: 
        found = JSON_REGEX.findall(output_text)
        if found:
            try:
                result = json_parser.parse(found[0])
            except Exception as ex1: 
                pass
    except Exception as ex2: 
        pass

    if result:
        if 'data' in result:
            location = result['data']
        elif 'properties' in result:
            if isinstance(result['properties'], dict) and result['properties'] and 'latitude' not in result:
                result = result['properties']
                if 'location' in result:
                    if isinstance(result['location'], dict):
                        if 'value' in result['location'] and 'value' in result['latitude'] and 'value' in result['longitude']:
                            location = {'location': result['location']['value'], 'latitude': result['latitude']['value'], 'longitude': result['longitude']['value']}
                    elif 'location' in result and result['location'] and 'latitude' in result and 'longitude' in result:
                        location = result
            elif 'latitude' in result and 'longitude' in result:
                location = {'location': answer, 'latitude': result['latitude'], 'longitude': result['longitude']}
        elif 'location' in result and isinstance(result, dict) and 'latitude' in result and 'longitude' in result:
            location = result

    return location


def create_labeler_prompt(format_instructions):
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
    return PromptTemplate(
        input_variables=["documents", "keywords"],
        partial_variables={"format_instructions": format_instructions}, 
        template=LABELING_PROMPT_TEMPLATE)


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


def create_loc_prompt(json_parser):
    LOC_TEMPLATE = """Find the coordinates for each of the locations using ONLY information found in the text delimited by triple backquotes (```).
    Return ONLY the coordinates. Do not explain.
    LOCATIONS:```{locations}```
    
    COORDINATES:{format_instructions}:"""
    
    return PromptTemplate(
        input_variables=["locations"], 
        partial_variables={"format_instructions": json_parser.get_format_instructions()}, 
        template=LOC_TEMPLATE)
    

def create_filter_prompt(format_instructions):
    FILTER_TEMPLATE = """Provide a short and concise answer the following question using ONLY information found in the article delimited by triple backquotes (```).
    Return answer with highest confidence score. Do not explain.
    QUESTION:{question}

    ARTICLE:```{article}```

    ANSWERS:{format_instructions}:"""
    return PromptTemplate(
        input_variables=["question", "article"], 
        partial_variables={"format_instructions": format_instructions}, 
        template=FILTER_TEMPLATE)


def create_llm_chain(task_name, model_name_dict, model_dict, chain_dict, prompt=None):
    if task_name == 'summarizer':
        for period, model_name in model_name_dict[task_name].items():
            if model_name not in model_dict:
                model_dict[model_name] = Ollama(model=model_name, temperature=0.0)
            model_llm = model_dict[model_name]
            chain_dict[f"{task_name}-{period}"] = load_summarize_chain(model_llm, chain_type='stuff') #, verbose=True)
    else:
        model_name = model_name_dict[task_name]
        if model_name not in model_dict:
            model_dict[model_name] = Ollama(model=model_name, temperature=0.0)
        model_llm = model_dict[model_name]
        chain_dict[task_name] = LLMChain(llm=model_llm, prompt=prompt)

    return model_dict, chain_dict


def create_llm_chains(model_name_dict):
    model_dict, chain_dict = dict(), dict()
    
    # Common tools
    output_parser = NumberedListOutputParser()
    format_instructions = output_parser.get_format_instructions()
    json_parser = SimpleJsonOutputParser(pydantic_object=Location)
    
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
    loc_prompt = create_loc_prompt(json_parser)
    model_dict, chain_dict = create_llm_chain('loc', model_name_dict, model_dict, chain_dict, loc_prompt)

    # Filter
    filter_prompt = create_filter_prompt(format_instructions)
    model_dict, chain_dict = create_llm_chain('filter', model_name_dict, model_dict, chain_dict, filter_prompt)
    
    return chain_dict, output_parser, json_parser
        

def extract_topic_info(topic_model, documents, full_texts):
    print('Extracting topic info ...')   
    document_info = topic_model.get_document_info(full_texts)
    headers, rows = document_info.columns.tolist(), document_info.values.tolist()
    
    topic_dict, document_index = dict(), 0
    for row in rows:
        row_dict = {header: value for header, value in zip(headers, row)}
        topic_id = row_dict['Topic']
        if topic_id not in topic_dict:
            topic_dict[topic_id] = {
                'name': row_dict['Name'],
                'representative_docs': [],
                'keywords': row_dict['Representation'],
                'articles': [],
                'id_list': []
            }
        doc_id = documents[document_index]['id']
        topic_dict[topic_id]['articles'].append([document_index, doc_id, row_dict['Probability']])
        topic_dict[topic_id]['id_list'].append(doc_id)
        if int(topic_id) != -1 and row_dict['Representative_document']:
            topic_dict[topic_id]['representative_docs'].append([document_index, doc_id, row_dict['Probability'], row_dict['Document']])
        document_index += 1

    nr_docs = 0
    for topic_id in sorted(topic_dict):
        info = topic_dict[topic_id]
        info['representative_docs'] = sorted(info['representative_docs'], key=lambda item: item[1], reverse=True)
        print(f"{topic_id} --- {info['name']} --- {len(info['articles'])} --- {len(info['representative_docs'])} {[item[2] for item in info['representative_docs']]} --- {info['keywords']}", flush=True)
        nr_docs += len(info['articles'])
    
    return topic_dict, nr_docs


def extract_hierarchical_topic_info(topic_model, full_texts):
    hierarchical_topics = topic_model.hierarchical_topics(full_texts)
    headers = ["Parent_ID", "Parent_Name", "Topics", "Child_Left_ID", "Child_Left_Name", "Child_Right_ID", "Child_Right_Name"]
    hierarchical_topic_list = []
    for row in hierarchical_topics.values.tolist():
        hierarchical_topic_list.append({header: value for header, value in zip(headers, row)})
    return hierarchical_topic_list


def summarize_topics(summarizer_chain, topic_dict):
    print('Start summarizing topics ...')
    start_time = datetime.now()
    
    for topic_id in sorted(topic_dict):
        info = topic_dict[topic_id]
        if int(topic_id) == -1:
            info['summary'] = 'Outliers'
        else:
            repr_texts = [d[3] for d in info['representative_docs']]
            docs = [Document(page_content=truncate_text(text)) for text in repr_texts]
            output = summarizer_chain.invoke(docs)
            info['summary'] = output['output_text'].replace('<|im_end|>', '')

        print(f"[SUM] --- {topic_id} --- {info['summary']}")
    
    end_time = datetime.now()
    seconds = (end_time - start_time).total_seconds()
    print(f"{seconds} seconds --- {len(topic_dict)} topics --- {seconds/len(topic_dict):0.2f} seconds per topic.\n")
    return topic_dict


def label_topics(labeler_llm_chain, output_parser, topic_dict):
    print('Start labeling topics ...')
    start_time = datetime.now()
    
    for topic_id in sorted(topic_dict):
        if int(topic_id) == -1:
            topic_dict[topic_id]['labels'] = 'Outliers'
        else:
            info = topic_dict[topic_id]
            output = labeler_llm_chain.invoke({'documents': info['summary'], 'keywords': info['keywords']})
            topic_dict[topic_id]['labels'] = [label.replace('<|im_end|>', '') for label in output_parser.parse(output['text'])]
            print(f"[LBL] --- {topic_id} --- {info['labels']}")
    
    end_time = datetime.now()
    seconds = (end_time - start_time).total_seconds()
    print(f"{seconds} seconds --- {len(topic_dict)} topics --- {seconds/len(topic_dict):0.2f} seconds per topic.\n")
    return topic_dict


def classify_topics(classifier_llm_chain, output_parser, topic_dict):
    print('Start classifying topics ...')
    start_time = datetime.now()
    
    for topic_id in sorted(topic_dict):
        if int(topic_id) == -1:
            topic_dict[topic_id]['threats'] = 'Outliers'
        else:
            info = topic_dict[topic_id]
            output = classifier_llm_chain.invoke({'article': info['summary'], 'topics': TOPIC_LIST})
            threats = []
            for threat in output_parser.parse(output['text']):
                for topic in TOPIC_LIST:
                    if threat in topic or topic in threat:
                        threats.append(topic)
                        break
            info['threats'] = threats
            print(f"[THR] --- {topic_id} --- {info['threats']}")
    
    end_time = datetime.now()
    seconds = (end_time - start_time).total_seconds()
    print(f"{seconds} seconds --- {len(topic_dict)} topics --- {seconds/len(topic_dict):0.2f} seconds per topic.\n")
    return topic_dict


def qa_topics(qa_llm_chain, output_parser, topic_dict):
    print('Start questioning topics ...')
    start_time = datetime.now()
    
    for topic_id in sorted(topic_dict):
        if int(topic_id) == -1:
            topic_dict[topic_id]['qa'] = 'Outliers'
        else:
            info = topic_dict[topic_id]
            info['qa'] = dict()
            if set(info['threats']).intersection(DISEASE_THREATS):
                output = qa_llm_chain.invoke({'article': info['summary'], 'questions': QUESTION_LIST})
                for question, answer in zip(QUESTION_LIST, output_parser.parse(output['text'])):
                    info['qa'][question] = answer
            print(f"[CQA] --- {topic_id} --- {info['qa']}")
    
    end_time = datetime.now()
    seconds = (end_time - start_time).total_seconds()
    print(f"{seconds} seconds --- {len(topic_dict)} topics --- {seconds/len(topic_dict):0.2f} seconds per topic.\n")
    return topic_dict


def locate_topics(loc_llm_chain, json_parser, topic_dict):
    print('Start locating topics ...')
    start_time = datetime.now()
    
    tokenizer = AutoTokenizer.from_pretrained("dslim/bert-base-NER")
    model = AutoModelForTokenClassification.from_pretrained("dslim/bert-base-NER")
    ner_extractor = pipeline("ner", model=model, tokenizer=tokenizer, aggregation_strategy = 'simple')
    
    detected_dict = dict()
    for topic_id in sorted(topic_dict):
        info = topic_dict[topic_id]
        if int(topic_id) == -1:
            info['loc'] = 'Outliers'
        else:
            info['loc'] = dict()
            if info['qa']:
                answer = info['qa']['What geo location does the disease spread?']
                countries = (extract_country(answer, country_dict))
                print(f"[CTR] --- {topic_id} --- {countries}", flush=True)
                info['loc']['countries'] = countries

                location_list = []
                answer = answer.replace('Geolocation: ', '').replace('Geo location: ', '')

                if answer.upper() in detected_dict:
                    coordinates = detected_dict[answer.upper()]
                    location_list.append(coordinates)
                    print(f"[COR] --- C --- {topic_id} --- {answer} --- {coordinates}", flush=True)

                else:
                    coordinates = find_coordinates(loc_llm_chain, json_parser, answer)
                    if coordinates:
                        detected_dict[answer.upper()] = coordinates
                        location_list.append(coordinates)
                        print(f"[COR] --- N --- {topic_id} --- {answer} --- {coordinates}", flush=True)
                    else:
                        found_locations = [e['word'] for e in ner_extractor(answer)]
                        print(f"[COR] --- F --- {topic_id} --- {answer} --- {found_locations}")

                        for found_location in found_locations:
                            if found_location.upper() in detected_dict:
                                coordinates = detected_dict[found_location.upper()]
                                location_list.append(coordinates)
                                print(f"[COR] --- C --- {topic_id} --- {found_location} --- {coordinates}", flush=True)
                            else:
                                coordinates = find_coordinates(loc_llm_chain, json_parser, found_location)
                                if coordinates:
                                    detected_dict[found_location.upper()] = coordinates
                                    location_list.append(coordinates)
                                    print(f"[COR] --- N --- {topic_id} --- {found_location} --- {coordinates}", flush=True)

                info['loc']['locations'] = location_list
            
            print(f"[LOC] --- {topic_id} --- {info['loc']}")
    
    end_time = datetime.now()
    seconds = (end_time - start_time).total_seconds()
    print(f"{seconds} seconds --- {len(topic_dict)} topics --- {seconds/len(topic_dict):0.2f} seconds per topic.\n")
    return topic_dict


def fix_locations(topic_dict):    
    for topic_id in sorted(topic_dict):
        info = topic_dict[topic_id]
        if int(topic_id) == -1 or not info['loc'] or not info['loc']['locations']:
            continue
        
        print(f"[LOC] <<< {topic_id} --- {info['loc']}")
        fixed_locations = []
        locations = []
        for location in info['loc']['locations']:
            if isinstance(location, list):
                locations.extend(location)
            else:
                locations.append(location)
            
        for location in locations:
            if isinstance(location, dict) and 'location' in location and isinstance(location['location'], list) and location['latitude'] and location['longitude']:
                for location, latitude, longitude in zip(location['location'], location['latitude'], location['longitude']):
                    if isinstance(latitude, list):
                        for lat, lng in zip(latitude, longitude):
                            fixed_locations.append({'location': location, 'latitude': lat, 'longitude': lng})
                    else:
                        fixed_locations.append({'location': location, 'latitude': latitude, 'longitude': longitude})
            else:
                if isinstance(location, dict) and 'latitude' in location and isinstance(location['latitude'], list):
                    for lat, lng in zip(location['latitude'], location['longitude']):
                        fixed_locations.append({'location': location['location'], 'latitude': lat, 'longitude': lng})
                else:
                    fixed_locations.append(location)
        
        info['loc']['locations'] = fixed_locations
        
        print(f"[LOC] >>> {topic_id} --- {info['loc']}")

    return topic_dict


def filter_outliers(filter_llm_chain, output_parser, topic_dict, full_texts):
    print('Start filtering outliers ...')
    start_time = datetime.now()
    
    articles = topic_dict["-1"]['articles']
    enriched_articles = dict()
    count = 0
    for document_index, doc_id, probability in articles:
        text = truncate_text(full_texts[int(document_index)])
        output = filter_llm_chain.invoke({'article': text, 'question': OUTLIER_FILTER})
        results = output_parser.parse(output['text'])
        answer = results[0] if results and len(results) > 0 else None
        if answer and not answer.startswith('No.'):
            enriched_articles[str(doc_id)] = {'filter': answer, 'probability': probability}
            count += 1
        print(f"[FLT] --- {document_index} --- {answer}")
    
    topic_dict["-1"]['enriched_articles'] = enriched_articles
    
    end_time = datetime.now()
    seconds = (end_time - start_time).total_seconds()
    print(f"{seconds} seconds --- {count} outliers --- {seconds/count:0.2f} seconds per outlier.\n")
    return topic_dict


def summarize_outliers(summarizer_chain, topic_dict, full_texts):
    print('Start summarizing outliers ...')
    start_time = datetime.now()
    
    articles = topic_dict["-1"]['articles']
    enriched_articles = topic_dict["-1"]['enriched_articles']
    count = 0
    for document_index, doc_id, _ in articles:
        summary = ''
        if str(doc_id) in enriched_articles:
            text = truncate_text(full_texts[int(document_index)])
            output = summarizer_chain.invoke([Document(page_content=text)])
            summary = output['output_text']
            enriched_articles[str(doc_id)]['summary'] = summary
            count += 1
        print(f"[OLS] --- {document_index} --- {summary}")
    
    end_time = datetime.now()
    seconds = (end_time - start_time).total_seconds()
    print(f"{seconds} seconds --- {count} outliers --- {seconds/count:0.2f} seconds per outlier.\n")
    return topic_dict


def qa_outliers(qa_llm_chain, output_parser, topic_dict, full_texts):
    print('Start questioning outliers ...')
    start_time = datetime.now()
    
    articles = topic_dict["-1"]['articles']
    enriched_articles = topic_dict["-1"]['enriched_articles']
    count = 0
    for document_index, doc_id, _ in articles:
        question_answers = dict()
        if str(doc_id) in enriched_articles:
            text = truncate_text(full_texts[int(document_index)])
            output = qa_llm_chain.invoke({'article': text, 'questions': QUESTION_LIST})
            for question, answer in zip(QUESTION_LIST, output_parser.parse(output['text'])):
                question_answers[question] = answer
            enriched_articles[str(doc_id)]['qa'] = question_answers
            count += 1
        print(f"[OQA] --- {document_index} --- {question_answers}")
    
    end_time = datetime.now()
    seconds = (end_time - start_time).total_seconds()
    print(f"{seconds} seconds --- {count} outliers --- {seconds/count:0.2f} seconds per outlier.\n")
    return topic_dict


def performing_tasks(path, temp, period, documents, full_texts, process_outliers=False):
    # Load model as pickled
    cls_file_name = f"{path}/processed-{period}-ctm.pkl"
    loaded_model = BERTopic.load(cls_file_name)
    print(f"[{cls_file_name}] loaded.")
    
    # Extracting topic info
    topic_dict, nr_docs = extract_topic_info(loaded_model, documents, full_texts)
    assert nr_docs == len(full_texts)
    tpc_file_name = f"{temp}/processed-{period}-tpc-ctm.jsonl"
    save_jsonl(topic_dict, tpc_file_name, single=True)

    # Extracting hierarchical topic info
    hierarchical_topic_list = extract_hierarchical_topic_info(loaded_model, full_texts)
    htp_file_name = f"{path}/processed-{period}-htp-ctm.jsonl"
    save_jsonl(hierarchical_topic_list, htp_file_name)
    
    # Summarizing
    tpc_file_name = f"{temp}/processed-{period}-tpc-ctm.jsonl"
    topic_dict = load_jsonl(tpc_file_name, single=True)
    chain_llm = chain_dict[f"summarizer-generic"]
    if period in model_dict['summarizer']:
        chain_llm = chain_dict[f"summarizer-{period}"]
    topic_dict = summarize_topics(chain_llm, topic_dict)
    sum_file_name = f"{temp}/processed-{period}-sum-ctm.jsonl"
    save_jsonl(topic_dict, sum_file_name, single=True)
            
    # Labeling
    sum_file_name = f"{temp}/processed-{period}-sum-ctm.jsonl"
    topic_dict = load_jsonl(sum_file_name, single=True)
    topic_dict = label_topics(chain_dict['labeler'], output_parser, topic_dict)
    lbl_file_name = f"{temp}/processed-{period}-lbl-ctm.jsonl"
    save_jsonl(topic_dict, lbl_file_name, single=True)
    
    # Classifying
    lbl_file_name = f"{temp}/processed-{period}-lbl-ctm.jsonl"
    topic_dict = load_jsonl(lbl_file_name, single=True)
    topic_dict = classify_topics(chain_dict['classifier'], output_parser, topic_dict)
    cls_file_name = f"{temp}/processed-{period}-cls-ctm.jsonl"
    save_jsonl(topic_dict, cls_file_name, single=True)
    
    # # Question answering
    # cls_file_name = f"{temp}/processed-{period}-cls.jsonl"
    # topic_dict = load_jsonl(cls_file_name, single=True)
    # topic_dict = qa_topics(chain_dict['qa'], output_parser, topic_dict)
    # qa_file_name = f"{temp}/processed-{period}-qa.jsonl"
    # save_jsonl(topic_dict, qa_file_name, single=True)

    # # Locating
    # qa_file_name = f"{temp}/processed-{period}-qa.jsonl"
    # topic_dict = load_jsonl(qa_file_name, single=True)
    # topic_dict = locate_topics(chain_dict['loc'], json_parser, topic_dict)
    # loc_file_name = f"{temp}/processed-{period}-loc.jsonl"
    # save_jsonl(topic_dict, loc_file_name, single=True)
    
    # # Fix locations
    # loc_file_name = f"{temp}/processed-{period}-loc.jsonl"
    # topic_dict = load_jsonl(loc_file_name, single=True)
    # topic_dict = fix_locations(topic_dict)
    # loc_file_name = f"{path}/enriched-{period}-cls.jsonl"
    # save_jsonl(topic_dict, loc_file_name, single=True)
    
    # if process_outliers:
    #     # Filter outliers
    #     loc_file_name = f"{path}/enriched-{period}-cls.jsonl"
    #     topic_dict = load_jsonl(loc_file_name, single=True)
    #     topic_dict = filter_outliers(chain_dict['filter'], output_parser, topic_dict, full_texts)
    #     flt_file_name = f"{temp}/processed-{pub_date}-flt.jsonl"
    #     save_jsonl(topic_dict, flt_file_name, single=True)
        
    #     # Summarizing outliers
    #     flt_file_name = f"{temp}/processed-{pub_date}-flt.jsonl"
    #     topic_dict = load_jsonl(flt_file_name, single=True)
    #     chain_llm = chain_dict[f"summarizer-generic"]
    #     if period in model_dict['summarizer']:
    #         chain_llm = chain_dict[f"summarizer-{period}"]
    #     topic_dict = summarize_outliers(chain_llm, topic_dict, full_texts)
    #     ols_file_name = f"{temp}/processed-{pub_date}-ols.jsonl"
    #     save_jsonl(topic_dict, ols_file_name, single=True)
        
    #     # Question answering outliers
    #     ols_file_name = f"{temp}/processed-{pub_date}-ols.jsonl"
    #     topic_dict = load_jsonl(ols_file_name, single=True)
    #     topic_dict = qa_outliers(chain_dict['qa'], output_parser, topic_dict, full_texts)
    #     olq_file_name = f"{path}/enriched-{pub_date}-olq.jsonl"
    #     save_jsonl(topic_dict, olq_file_name, single=True)


if __name__ == '__main__':
    path, temp, device, start_date, end_date, country_file_name = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], sys.argv[6]
    process_outliers = True if sys.argv[7] == '1' else False 

    model_dict = {
        'summarizer': {
            'generic': 'mistral:instruct',
            # '2019-12-16': 'tinyllama',
            # '2019-12-22': 'tinyllama',
            # '2020-01-01': 'mistral-openorca',
            # '2020-01-27': 'mistral-openorca',
            # '2020-01-28': 'mistral-openorca',
            # '2019-12-31-2020-01-02': 'mistral:instruct',
        },
        'labeler': 'mistral-openorca',
        'classifier': 'mistral-openorca',
        'qa': 'mistral:instruct',
        'loc': 'mistral:instruct',
        'filter': 'mistral:instruct',
    }

    chain_dict, output_parser, json_parser = create_llm_chains(model_dict)
    country_dict = load_country_codes(country_file_name)
    date_list = [f"{month}-{day:02}" for month in ['2019-12', '2020-01'] for day in range(1, 32)]
    daily_documents_dict = dict()

    for pub_date in date_list:
        if pub_date < start_date or pub_date > end_date:
            continue
  
        initial_time = datetime.now()
        
        # Load documents as jsonl
        doc_file_name = f"{path}/processed-{pub_date}-news-articles.jsonl"
        daily_documents = load_jsonl(doc_file_name)
        full_texts = [f"{d['title']}\n\n{d['content']}" for d in daily_documents]

        daily_documents_dict[pub_date] = daily_documents
        performing_tasks(path, temp, pub_date, daily_documents, full_texts, process_outliers=process_outliers)

        final_time = datetime.now()
        seconds = (final_time - initial_time).total_seconds()
        print(f"{seconds} seconds --- {len(full_texts)} documents --- {seconds/len(full_texts):0.2f} seconds per document.\n")


    for period_length, period_days in [ (3, range(30, 37)), (7, range(30, 31)), (30, range(30, 31)) ]:
        for i in period_days:
            
            start_period, end_period = date_list[i], date_list[i+period_length-1]
            period = f"{start_period}-{end_period}"
            period_documents = [d for j in range(0, period_length) for d in daily_documents_dict[date_list[i+j]]]
            full_texts = [f"{d['title']}\n\n{d['content']}" for d in period_documents]

            performing_tasks(path, temp, period, period_documents, full_texts)

