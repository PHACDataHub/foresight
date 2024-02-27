import csv
import json
import sys

from langchain.chains.llm import LLMChain
from langchain.chains.summarize import load_summarize_chain
from langchain.output_parsers.list import NumberedListOutputParser
from langchain.prompts.prompt import PromptTemplate
from langchain.text_splitter import RecursiveCharacterTextSplitter

from langchain_community.llms import Ollama
from langchain_community.embeddings import HuggingFaceEmbeddings


def increase_count(count, character):
    count += 1
    print(character, end="", flush=True)
    return count


def load_country_codes(file_name):
    country_dict = dict()
    with open(file_name, 'rt') as csv_file:
        csv_reader = csv.DictReader(csv_file, delimiter='\t')
        for row in csv_reader:
            country_dict[row["code"]] = row['name']
    print(f"Read {len(country_dict)} countries.")
    return country_dict


def create_out_file_name(in_file_name, pub_date):
    in_file_splits = in_file_name.split('/')
    out_file_name = '/'.join(in_file_splits[:-1]) + '/' + 'processed-' + pub_date + '-' + in_file_splits[-1]
    return out_file_name


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

CLASSIFICATION_TEMPLATE = """
Return ONLY the topic classifications listed below
TOPICS:{topics}

that best matches the article delimited by triple backquotes (```)
ARTICLE:```{article}```

If there is no such topic classification, then return No match as result.
RESULT:{format_instructions}"""


FILTER_TEMPLATE = """'Does the article delimited by triple backquotes (```) below describe an actual event and not an academic study?
Answer Yes or No. Do not explain.

ARTICLE:```{article}```

ANSWERS:{format_instructions}:"""


QA_TEMPLATE = """Provide a short and concise answer for each of the following questions using ONLY information found in the article delimited by triple backquotes (```).
Do not explain.
QUESTIONS:{questions}

ARTICLE:```{article}```

ANSWERS:{format_instructions}:"""

QUESTION_LIST = [
    'What disease is it or is it an unknown disease?',
    'What is the possible source of this disease?',
    'How does this disease spread?',
    'What are the countries effected by the disease?',
    'When did the disease start?',
    'Is the disease still spreading or did it stop?',
]    


MAPPING_TEMPLATE = """Return the ISO 3166 Alpha 2 two-letter country code for each of the country names found in the content .
Do not explain.
CONTENT:{content}

CODE:{format_instructions}:"""


def extract_topics(output_parser, output):
    topics = []
    for predicted_topic in output_parser.parse(output):
        for topic in TOPIC_LIST:
            if topic in predicted_topic:
                topics.append(topic)
                break
    return topics


def mapping_country_codes(mapping_chain, content):
    output = mapping_chain.invoke({'content': content})['text']
    return [e for e in output_parser.parse(output) if e != '-' ]


def filter_if_actual_event(filter_chain, content):
    output = filter_chain.invoke({'questions': [], 'article': content})['text']
    for e in output_parser.parse(output):
        if e.startswith('Yes'):
            return True
    return False
    

if __name__ == '__main__':
    in_file_name, country_file_name, start_date, end_date = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    country_dict = load_country_codes(country_file_name)
    
    llm = Ollama(model="mistral:instruct")
    embeddings = HuggingFaceEmbeddings(model_name='sentence-transformers/all-mpnet-base-v2', model_kwargs = {'device': 'cuda'})
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=384, chunk_overlap=0)
    summarize_chain = load_summarize_chain(llm=llm, chain_type='map_reduce') 
    output_parser = NumberedListOutputParser()
    format_instructions = output_parser.get_format_instructions()

    filter_prompt = PromptTemplate(
        input_variables=["article"], 
        partial_variables={"format_instructions": format_instructions}, 
        template=FILTER_TEMPLATE)
    filter_chain = LLMChain(llm=llm, prompt=filter_prompt)

    classify_prompt = PromptTemplate(
        input_variables=["topics", "article"], 
        partial_variables={"format_instructions": format_instructions}, 
        template=CLASSIFICATION_TEMPLATE)
    classify_chain = LLMChain(llm=llm, prompt=classify_prompt)
    
    qa_prompt = PromptTemplate(
        input_variables=["questions", "article"], 
        partial_variables={"format_instructions": format_instructions}, 
        template=QA_TEMPLATE)
    qa_chain = LLMChain(llm=llm, prompt=qa_prompt)

    mapping_prompt = PromptTemplate(
        input_variables=["content"], 
        partial_variables={"format_instructions": format_instructions}, 
        template=MAPPING_TEMPLATE)
    mapping_chain = LLMChain(llm=llm, prompt=mapping_prompt)
    
    print(f"Created LLM tools.")
    
    count = 0 if len(sys.argv) < 6 else int(sys.argv[5])
    limit = 10000 if len(sys.argv) < 7 else int(sys.argv[6])
    doc_dict = dict()
    with open(in_file_name, 'rt') as in_file:
        lines = in_file.readlines()
        print(f"Read {len(lines)} documents.")
        
        for line in lines[count:]:
            document = json.loads(line.strip())
            pub_date = document['publicationdate'][:10]
            if pub_date < start_date or pub_date > end_date or 'EN' not in document['body']:
                continue
            
            body = document['body']['EN']
            if len(body['contents']) > limit:
                print(f"""[{count}] {doc['id']}\n--- {body['title']}\n--- {body['contents']}\n""")
                continue
            
            # print(f"\n----- {document['id']}")
            full_text = '\n\n'.join([body[e] for e in ['title', 'contents'] if e in body])
            chunks = text_splitter.create_documents([full_text])
            document['chunks'] = [c.page_content for c in chunks]
            document['summary'] = summarize_chain.invoke(chunks)['output_text']

            # document['is_event'] = filter_if_actual_event(filter_chain, full_text)
            document['is_event'] = filter_if_actual_event(filter_chain, document['summary'])
            if document['is_event']:
                # topics = extract_topics(output_parser, classify_chain.invoke({'topics': TOPIC_LIST, 'article': document['summary']})['text'])

                # if topics:
                #     document['topics'] = topics
                #     document['answers'] = []
                #     for i, question in enumerate(QUESTION_LIST):
                #         output = qa_chain.invoke({'questions': [question], 'article': full_text})['text']
                #         document['answers'].append([question, [e for e in output_parser.parse(output) if e != '-' ]])
                #     document['countries'] = list(set([e for e in mapping_country_codes(mapping_chain, document['answers'][3][1]) if e in country_dict]))

                document['embeddings'] = embeddings.embed_documents(document['chunks'])
            
            doc = {
                k: v for k, v in document.items()
                if k in [
                    'id', 'publicationdate', 'publicationname', 'originallanguage', 'originalfilename', 'factivatopicfolder', 'state',
                    'chunks', 'embeddings', 'summary', 'topics', 'answers', 'countries', 'score', 'is_event'
                ]
            }
            doc['title'] = body['title']
            doc['content'] = body['contents']
            
            # if 'topics' in doc:
            #     print(f"""[{count}] {doc['id']}\n--- {doc['summary']}\n--- {doc['state']} --- {doc['score']}\n--- [{len(doc['topics'])}] {doc['topics']}\n--- [{len(doc['answers'])}] {doc['answers']}\n--- {doc['countries']}\n--- {[(llm.get_num_tokens(e), len(doc['embeddings'][i])) for i, e in enumerate(document['chunks'])]}\n""")
            # else:
            #     print(f"""[{count}] {doc['id']}\n--- {doc['summary']}\n--- {doc['is_event']} --- {doc['factivatopicfolder']} --- {doc['state']} --- {doc['score']}\n""")
            
            if document['is_event']:
                print(f"""[{count}] {doc['id']}\n--- {doc['summary']}\n--- {doc['is_event']} --- {doc['factivatopicfolder']} --- {doc['state']} --- {doc['score']} --- {[(llm.get_num_tokens(e), len(doc['embeddings'][i])) for i, e in enumerate(document['chunks'])]}""")
            else:
                print(f"""[{count}] {doc['id']}\n--- {doc['summary']}\n--- {doc['is_event']} --- {doc['factivatopicfolder']} --- {doc['state']} --- {doc['score']}""")
            count += 1
            
            if pub_date not in doc_dict:
                doc_dict[pub_date] = []
            doc_dict[pub_date].append(doc)

    print(f"\nProcessed {count} articles.\n")
    
    for pub_date in sorted(doc_dict.keys()):
        with open(create_out_file_name(in_file_name, pub_date), 'wt') as out_file:
            count = 0
            for doc in doc_dict[pub_date]:
                out_file.write(f"{json.dumps(doc)}\n")
                count = increase_count(count, '.')
            print(f"\n[{pub_date}] Written {count} articles.")
        