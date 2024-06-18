import configparser
import json
import sys

from openpyxl import load_workbook, Workbook

from langchain.output_parsers.list import NumberedListOutputParser
from langchain.prompts.prompt import PromptTemplate
from langchain_community.llms import Ollama


def load_config(file_name):
    config = configparser.ConfigParser()
    config.read_file(open(file_name))
    return config


def load_categories(config):
    category_dict = eval(config['public_health_threats']['THREAT_CATEGORIES'])
    # print_category_dict(category_dict)
    return category_dict


def match_category(category_dict, category):
    for k1, v1 in category_dict.items():
        if k1.lower() == category.lower():
            return k1
        if isinstance(v1, dict):
            for k2, v2 in v1.items():
                if k2.lower() == category.lower():
                    return k2
                for e in v2:
                    if e.lower() == category.lower():
                        return e
        else:   # if isinstance(v1, list):
            for e in v1:
                if e.lower() == category.lower():
                    return e
    raise Exception(f"Unknown category -- {category}")


def load_data_file(file_name, sheet_name, category_dict):
    wb = load_workbook(file_name)
    ws = wb[sheet_name]
    headers, inputs = [], []
    for i, row in enumerate(ws): 
        if i == 0:
            headers = [cell.value for cell in row]
            continue
        row_dict = {headers[j]: cell.value for j, cell in enumerate(row)}
        
        truths = []
        print(row_dict['Ground Truth'])
        for l in row_dict['Ground Truth'].split('\n'):
            leaves = l.split('->')[-1].strip()
            if leaves:
                categories = [e.strip() for e in leaves.split(',') if e]
                print(categories)
                truths.extend(categories)
        truths = [match_category(category_dict, t) for t in truths]
        row_dict['Ground Truth'] = truths
        
        inputs.append(row_dict)
    return inputs


def save_jsonl(documents, file_name, single=False):
    with open(file_name, 'wt') as out_file:
        if single:
            out_file.write(f"{json.dumps(documents)}\n")
            print(f"[{file_name}] - Wrote 1 document.")
        else:
            for document in documents:
                out_file.write(f"{json.dumps(document)}\n")
            print(f"[{file_name}] - Wrote {len(documents)} documents.")


def create_summarizer_prompt(format_instructions):
    MAP_PROMPT = """
    Summarize the following article delimited by triple backquotes (```):
    ```{article}```

    {format_instructions}"""
    return PromptTemplate(
        input_variables=["article"],
        partial_variables={"format_instructions": format_instructions}, 
        template=MAP_PROMPT)


def summarize_text(model_name, llm_chain, output):
    result = llm_chain.invoke({"article": output['text']})
    if result and isinstance(result, list) and result[0]:
        output['sum'] = result[0]
    
    print(f"[{model_name} SUMMARIZER] --- {output['url']} \n\t--- {output['sum']}\n")
    return output


if __name__ == '__main__':
    config_file_name = sys.argv[1]
    input_data_file = sys.argv[2]
    input_sheet_name = sys.argv[3]
    llm_model_name = sys.argv[4]

    config = load_config(config_file_name)
    categories = load_categories(config)
    inputs = load_data_file(input_data_file, input_sheet_name, categories)

    output_parser = NumberedListOutputParser()
    format_instructions = output_parser.get_format_instructions()

    llm_model = Ollama(model=llm_model_name, temperature=0.0)

    summarizer_prompt = create_summarizer_prompt(format_instructions)
    sum_llm_chain = summarizer_prompt | llm_model | output_parser

    category_links = []
    for k1, v1 in categories.items():
        if isinstance(v1, dict):
            for k2, v2 in v1.items():
                category_links.append([k1, k2])
                for e in v2:
                    category_links.append([k2, e])
        else:   # if isinstance(v1, list):
            for e in v1:
                category_links.append([k1, e])

    save_jsonl(category_links, f"datasets/v3_classification.jsonl", single=True)
    
    outputs = []
    for input in inputs:
        output = {
            'url': input['URL'],
            'text': input['Text'],
            'sum': '',
            'ground_truth': input['Ground Truth']
        }
        output = summarize_text(llm_model_name, sum_llm_chain, output)
        outputs.append(output)

    save_jsonl(outputs, f"datasets/who-dons.jsonl")