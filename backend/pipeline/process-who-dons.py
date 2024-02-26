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

QA_TEMPLATE = """Provide a short and concise answer for each of the following questions using ONLY information found in the article delimited by triple backquotes (```).
Do not explain.
QUESTIONS:{questions}

ARTICLE:```{article}```

ANSWERS:{format_instructions}:"""

QUESTION_LIST = [
    'What disease is it or is it an unknown disease? ',
    'What is the possible source of this disease?',
    'How does this disease spread?',
    'What are the countries effected by the disease?',
    'When did the disease start?',
    'Is the disease still spreading or did it stop?',
]    

QUESTION_LIST = [
    'What disease is it or is it an unknown disease? ',
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


def increase_count(count, character):
    count += 1
    print(character, end="", flush=True)
    return count


def create_out_file_name(in_file_name):
    in_file_splits = in_file_name.split('/')
    out_file_name = '/'.join(in_file_splits[:-1]) + '/' + 'processed-' + in_file_splits[-1]
    return out_file_name


def load_country_codes(file_name):
    country_dict = dict()
    with open(file_name, 'rt') as csv_file:
        csv_reader = csv.DictReader(csv_file, delimiter='\t')
        for row in csv_reader:
            country_dict[row["code"]] = row['name']
    print(f"Read {len(country_dict)} countries.\n")
    return country_dict


class Pipeline(object):
    
    def __init__(self) -> None:
        self.llm = Ollama(model="mistral")
        self.embeddings = HuggingFaceEmbeddings(model_name='sentence-transformers/all-mpnet-base-v2')
        self.text_splitter = RecursiveCharacterTextSplitter(chunk_size=384, chunk_overlap=0)
        self.summarize_chain = load_summarize_chain(llm=self.llm, chain_type='map_reduce') 
        
        self.output_parser = NumberedListOutputParser()
        format_instructions = self.output_parser.get_format_instructions()

        classify_prompt = PromptTemplate(
            input_variables=["topics", "article"], 
            partial_variables={"format_instructions": format_instructions}, 
            template=CLASSIFICATION_TEMPLATE)
        self.classify_chain = LLMChain(llm=self.llm, prompt=classify_prompt)

        qa_prompt = PromptTemplate(
            input_variables=["questions", "article"], 
            partial_variables={"format_instructions": format_instructions}, 
            template=QA_TEMPLATE)
        self.qa_chain = LLMChain(llm=self.llm, prompt=qa_prompt)

        mapping_prompt = PromptTemplate(
            input_variables=["content"], 
            partial_variables={"format_instructions": format_instructions}, 
            template=MAPPING_TEMPLATE)
        self.mapping_chain = LLMChain(llm=self.llm, prompt=mapping_prompt)
 
    def create_embeddings(self, document, prop_content=['title', 'content'], prop_chunks='chunks', prop_embeddings='embeddings'):
        content = '\n\n'.join([document[e] for e in prop_content if e in document])
        document[prop_chunks] = self.text_splitter.create_documents([content])
        document[prop_embeddings] = self.embeddings.embed_documents([c.page_content for c in document[prop_chunks]])
        return document
        
    def create_summary(self, document, prop_summary='summary', prop_content='chunks', prop_output='output_text'):
        document[prop_summary] = self.summarize_chain.invoke(document[prop_content])[prop_output]
        return document
    
    def chunks_to_texts(self, document, prop_chunks='chunks'):
        document[prop_chunks] = [chunk.page_content for chunk in document[prop_chunks]]
        return document

    def classify(self, document, prop_topics='topics', param_topics='topics', param_content='article', prop_content='summary', prop_output='text'):
        output = self.classify_chain.invoke({param_topics: TOPIC_LIST, param_content: document[prop_content]})[prop_output]
        document[prop_topics] = []
        for predicted_topic in self.output_parser.parse(output):
            for topic in TOPIC_LIST:
                if topic in predicted_topic:
                    document[prop_topics].append(topic)
                    break
        return document

    def qa(self, document, prop_answers='answers', param_questions='questions', param_content='article', prop_content=['title', 'summary'], prop_output='text'): 
        content = '\n\n'.join([document[e] for e in prop_content if e in document])
        document[prop_answers] = []
        for i, question in enumerate(QUESTION_LIST):
            output = self.qa_chain.invoke({param_questions: [question], param_content: content})[prop_output]
            document[prop_answers].append([question, [e for e in self.output_parser.parse(output) if e != '-' ]])
        return document

    def mapping(self, content, param_content='content', prop_output='text'):
        output = self.mapping_chain.invoke({param_content: content})[prop_output]
        return [e for e in self.output_parser.parse(output) if e != '-' ]

    
if __name__ == '__main__':
    in_file_name, country_file_name = sys.argv[1], sys.argv[2]
    country_dict = load_country_codes(country_file_name)
    
    with open(in_file_name, 'rt') as in_file:
        documents = [json.loads(line.strip()) for line in in_file.readlines()]
    print(f"Read {len(documents)} articles.\n")

    pipeline = Pipeline()

    with open(create_out_file_name(in_file_name), 'wt') as out_file:
        count = 0
        for document in [documents[15], documents[16]]:
            document = pipeline.create_embeddings(document)
            document = pipeline.create_summary(document)
            document = pipeline.classify(document)
            document = pipeline.qa(document)
            document['countries'] = list(set([e for e in pipeline.mapping(document['answers'][3][1]) if e in country_dict]))
            if not document['countries']:
                document['countries'] = list(set([e for e in pipeline.mapping(document['answers'][3][1]) if e in country_dict]))
            document = pipeline.chunks_to_texts(document)
            
            count += 1
            print(f"""[{count}] {document['url']}\n--- {document['summary']}\n--- [{len(document['topics'])}] {document['topics']}\n--- [{len(document['answers'])}] {document['answers']}\n--- [{len(document['countries'])}] {document['countries']}\n--- {[(pipeline.llm.get_num_tokens(e), len(document['embeddings'][i])) for i, e in enumerate(document['chunks'])]}\n""")
            # count = increase_count(count, '.')

            out_file.write(f"{json.dumps(document)}\n")

    print(f"\nProcessed {count} articles.\n")
