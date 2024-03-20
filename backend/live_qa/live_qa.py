from datetime import datetime

from fastapi import FastAPI
from pydantic import BaseModel
from typing import List

from langchain_community.llms import Ollama

from langchain_core.exceptions import OutputParserException
from langchain.chains.llm import LLMChain
from langchain.chains.summarize import load_summarize_chain
from langchain.output_parsers.list import NumberedListOutputParser
from langchain.prompts.prompt import PromptTemplate
from langchain.schema import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter

# import ollama


MAX_DOC_LENGTH = 1024
BASE_URL="http://ollama:11434"


def create_qa_prompt(format_instructions):
    QA_TEMPLATE = """Provide a short and concise answer for the following question using ONLY information found in the content delimited by triple backquotes (```).
    Return answer with highest confidence score. Do not explain.
    QUESTION:{question}

    CONTENT:```{content}```

    ANSWER:{format_instructions}:"""
    return PromptTemplate(
        input_variables=["question", "content"], 
        partial_variables={"format_instructions": format_instructions}, 
        template=QA_TEMPLATE)


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
    
    
def create_llm_chain(model_name):
    # Common tools
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=MAX_DOC_LENGTH, chunk_overlap=0)
    output_parser = NumberedListOutputParser()
    format_instructions = output_parser.get_format_instructions()
    
    qa_prompt = create_qa_prompt(format_instructions)
    cl_prompt = create_classifier_prompt(format_instructions)
    lb_prompt = create_labeler_prompt(format_instructions)
    
    model_llm = Ollama(model=model_name, base_url=BASE_URL, temperature=0.0)
    qa_chain_llm = LLMChain(llm=model_llm, prompt=qa_prompt)
    sm_chain_llm = load_summarize_chain(model_llm, chain_type='stuff')
    cl_chain_llm  = LLMChain(llm=model_llm, prompt=cl_prompt)
    lb_chain_llm  = LLMChain(llm=model_llm, prompt=lb_prompt)
    
    return qa_chain_llm, sm_chain_llm, cl_chain_llm, lb_chain_llm, output_parser, text_splitter


def compute_answer(full_text, question, qa_chain_llm, output_parser):
    output = qa_chain_llm.invoke({'content': full_text, 'question': question})
    answer = output_parser.parse(output['text'])
    print(f"[SQA] --- {answer}\n", flush=True)
    return answer


def compute_answer_long_text(full_text, question, qa_chain_llm, sm_chain_llm, output_parser, text_splitter):
    chunks = [c.page_content for c in text_splitter.create_documents([full_text])]
    answers = []
    for chunk in chunks:
        output = qa_chain_llm.invoke({'content': chunk, 'question': question})
        answers.extend(output_parser.parse(output['text']))
    
    summary = 'No answer.'
    if answers:
        if len(answers) > 1:
            docs = [Document(page_content=answer) for answer in answers]
            output = sm_chain_llm.invoke(docs)
            summary = output['output_text']
        else:
            summary = answers[0]
    print(f"[SQA] --- {summary}\n", flush=True)
    return summary


def compute_summary(full_text, sm_chain_llm, output_parser, text_splitter):
    chunks = text_splitter.create_documents([full_text])
    output = sm_chain_llm.invoke(chunks)
    summary = output['output_text'].replace('<|im_end|>', '')
    print(f"[LTS] --- {summary}\n", flush=True)
    return summary
    

def compute_labels(full_text, keywords, lb_chain_llm, sm_chain_llm, output_parser, text_splitter):
    chunks = text_splitter.create_documents([full_text])
    output = sm_chain_llm.invoke(chunks)
    summary = output['output_text'].replace('<|im_end|>', '')
    output = lb_chain_llm.invoke({'documents':summary, 'keywords': [keyword.strip() for keyword in keywords.split(',')]})
    labels = [label.replace('<|im_end|>', '') for label in output_parser.parse(output['text'])]
    print(f"[LTS] --- {labels}\n", flush=True)
    return labels


def compute_topics(full_text, categories, cl_chain_llm, sm_chain_llm, output_parser, text_splitter):
    chunks = text_splitter.create_documents([full_text])
    output = sm_chain_llm.invoke(chunks)
    summary = output['output_text'].replace('<|im_end|>', '')
    output = cl_chain_llm.invoke({'article':summary, 'topics': [category.strip() for category in categories.split(',')]})
    topics = []
    for topic in output_parser.parse(output['text']):
        if topic in categories:
            topics.append(topic)
    print(f"[TPS] --- {topics}\n", flush=True)
    return topics


class QAIput(BaseModel):
    fulltext: str
    question: str


class TSInput(BaseModel):
    fulltext: str


class LBInput(BaseModel):
    fulltext: str
    keywords: str


class CTInput(BaseModel):
    fulltext: str
    categories: str


class MLInput(BaseModel):
    model_name: str


class ModelManager:
    def __init__(self, model_name):
        self.model_name = model_name    # 'mistral:instruct'
        self.qa_chain_llm, self.sm_chain_llm, self.cl_chain_llm, self.lb_chain_llm, self.output_parser, self.text_splitter = create_llm_chain(model_name)
        answer = compute_answer("Today is March 14, 2024", "What day was yesterday?", self.qa_chain_llm, self.output_parser)


model_manager = ModelManager('mistral:instruct')
app = FastAPI()


@app.post("/answer_question")
def answering_question(input: QAIput):
    start_time = datetime.now()
    result = {"answer": compute_answer(input.fulltext, input.question, model_manager.qa_chain_llm, model_manager.output_parser)}
    end_time = datetime.now()
    seconds = (end_time - start_time).total_seconds()
    print(f"{seconds} seconds --- {result}\n", flush=True)
    return result


@app.post("/answer_question_long_text")
def answering_question(input: QAIput):
    start_time = datetime.now()
    result = {"answer_long_text": compute_answer_long_text(
        input.fulltext, input.question, 
        model_manager.qa_chain_llm, model_manager.sm_chain_llm, model_manager.output_parser, model_manager.text_splitter)}
    end_time = datetime.now()
    seconds = (end_time - start_time).total_seconds()
    print(f"{seconds} seconds --- {result}\n", flush=True)
    return result


@app.post("/summarize_text")
def summarize_text(input: TSInput):
    start_time = datetime.now()
    result = {"summary": compute_summary(
        input.fulltext, 
        model_manager.sm_chain_llm, model_manager.output_parser, model_manager.text_splitter)}
    end_time = datetime.now()
    seconds = (end_time - start_time).total_seconds()
    print(f"{seconds} seconds --- {result}\n", flush=True)
    return result


@app.post("/label_text")
def label_text(input: LBInput):
    start_time = datetime.now()
    result = {"labels": compute_labels(
        input.fulltext, input.keywords, 
        model_manager.lb_chain_llm, model_manager.sm_chain_llm, model_manager.output_parser, model_manager.text_splitter)}
    end_time = datetime.now()
    seconds = (end_time - start_time).total_seconds()
    print(f"{seconds} seconds --- {result}\n", flush=True)
    return result


@app.post("/classify_text")
def classify_text(input: CTInput):
    start_time = datetime.now()
    result = {"categories": compute_topics(
        input.fulltext, input.categories, 
        model_manager.cl_chain_llm, model_manager.sm_chain_llm, model_manager.output_parser, model_manager.text_splitter)}
    end_time = datetime.now()
    seconds = (end_time - start_time).total_seconds()
    print(f"{seconds} seconds --- {result}\n", flush=True)
    return result


@app.post("/load_model")
def load_model(input: MLInput):
    try:
        global model_manager
        model_manager = ModelManager(input.model_name)
        result = {"result": "OK"} 
    except Exception as ex:
        result = {"result": "Failed", "exception": str(ex)}
    return result
