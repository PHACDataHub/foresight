import configparser
import sys

from openpyxl import load_workbook, Workbook

from langchain.output_parsers.list import NumberedListOutputParser
from langchain.prompts.prompt import PromptTemplate

from langchain_community.llms import Ollama


def load_config(file_name):
    config = configparser.ConfigParser()
    config.read_file(open(file_name))
    return config


def load_threats(config):
    v1_threats = eval(config['public_health_threats']['V1_THREAT_CLASSES'])
    # for k, v in v1_threats.items():
    #     print(f"{k} --- {v}")

    v2_threats = eval(config['public_health_threats']['V2_THREAT_CLASSES'])
    # for k, d in v2_threats.items():
    #     print(f"{k}")
    #     for e, v in d.items():
    #         print(f"\t{e} --- {v}")
    return v1_threats, v2_threats


def load_data_file(file_name, sheet_name):
    wb = load_workbook(file_name)
    ws = wb[sheet_name]
    headers, inputs = [], []
    for i, row in enumerate(ws): 
        if i == 0:
            headers = [cell.value for cell in row]
            continue
        inputs.append({headers[j]: cell.value for j, cell in enumerate(row)})
    return inputs


def create_classifier_prompt(format_instructions):
    CLASSIFY_PROMPT_TEMPLATE = """
    Which topic listed below:
    {topics}

    that best matches the article delimited by triple backquotes (```):
    ```{article}```

    If there is no such topic, then return No match as result.
    {format_instructions}"""
    return PromptTemplate(
        input_variables=["article", "topics"],
        partial_variables={"format_instructions": format_instructions}, 
        template=CLASSIFY_PROMPT_TEMPLATE)


def classify_text(llm_chain, text, topics):
    identified_topics = []
    results = llm_chain.invoke({"article": text, "topics": topics})
    for result in results:
        for topic in topics:
            if result in topic or topic in result:
                identified_topics.append(topic)
                break
    return identified_topics
    

def write_to_excel_file(file_name, sheet_name, outputs):
    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name
    headers = list(outputs[0].keys())
    ws.append(headers)
    for output in outputs:
        row = [f"{output[h]}" for h in headers]
        ws.append(row)
    wb.save(file_name)


if __name__ == '__main__':
    config_file_name = sys.argv[1]
    input_data_file = sys.argv[2]
    input_sheet_name = sys.argv[3]
    llm_model_name = sys.argv[4]

    config = load_config(config_file_name)
    v1_threats, v2_threats = load_threats(config)
    inputs = load_data_file(input_data_file, input_sheet_name)
    
    output_parser = NumberedListOutputParser()
    format_instructions = output_parser.get_format_instructions()

    llm_model = Ollama(model=llm_model_name, temperature=0.0)
    classifier_prompt = create_classifier_prompt(format_instructions)
    sum_llm_chain = classifier_prompt | llm_model | output_parser
    
    outputs = []
    for input in inputs:
        if not input['URL']:
            continue
        
        output = {
            'title': input['Title'], 
            'text': input['Text Input'],
            'url': input['URL'],
            'src': input['Type of source'],
            'v1_threats': dict(),
            'v2_threats': dict(),
        }
        
        cls_v1_threats = output['v1_threats']
        l1_threats = classify_text(sum_llm_chain, output['text'], list(v1_threats.keys()))
        for l1_threat in l1_threats:
            cls_v1_threats[l1_threat] = classify_text(sum_llm_chain, output['text'], v1_threats[l1_threat])
        
        cls_v2_threats = output['v2_threats']
        l1_threats = classify_text(sum_llm_chain, output['text'], list(v2_threats.keys()))
        for l1_threat in l1_threats:
            cls_v2_threats[l1_threat] = dict()
            l2_threats = classify_text(sum_llm_chain, output['text'], v2_threats[l1_threat].keys())
            for l2_threat in l2_threats:
                cls_v2_threats[l1_threat][l2_threat] = classify_text(sum_llm_chain, output['text'], v2_threats[l1_threat][l2_threat])
        
        print(f"{output['url']} \n\t--- {cls_v1_threats} \n\t--- {cls_v2_threats}\n")
        outputs.append(output)
        
    output_excel_file = input_data_file.replace(".xlsx", f"-{llm_model_name}-out.xlsx")
    write_to_excel_file(output_excel_file, 'Output', outputs)
        