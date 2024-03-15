from datetime import datetime

from fastapi import FastAPI
from pydantic import BaseModel

from langchain_community.llms import Ollama

from langchain_core.exceptions import OutputParserException
from langchain.chains.llm import LLMChain
from langchain.chains.summarize import load_summarize_chain
from langchain.output_parsers.list import NumberedListOutputParser
from langchain.prompts.prompt import PromptTemplate
from langchain.schema import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter

import ollama


MAX_DOC_LENGTH = 1024
BASE_URL="http://ollama:11434"
# BASE_URL="http://localhost:11434"


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


def create_llm_chain(model_name):
    # Common tools
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=MAX_DOC_LENGTH, chunk_overlap=0)
    output_parser = NumberedListOutputParser()
    format_instructions = output_parser.get_format_instructions()
    qa_prompt = create_qa_prompt(format_instructions)
    model_llm = Ollama(model=model_name, base_url=BASE_URL, temperature=0.0)
    qa_chain_llm = LLMChain(llm=model_llm, prompt=qa_prompt)
    sm_chain_llm = load_summarize_chain(model_llm, chain_type='stuff')
    return qa_chain_llm, sm_chain_llm, output_parser, text_splitter


def compute_answer(full_text, question, qa_chain_llm, sm_chain_llm, output_parser, text_splitter):
    print(f"[ANS] --- [{full_text}]\n", flush=True)
    
    # chunks = [c.page_content for c in text_splitter.create_documents([full_text])]
    # answers = []
    # for chunk in chunks:
    #     output = qa_chain_llm.invoke({'content': chunk, 'question': question})
    #     answers.extend(output_parser.parse(output['text']))
    # print(f"[MQA] --- {answers}\n", flush=True)
    
    # summary = 'No answer.'
    # if answers:
    #     if len(answers) > 1:
    #         docs = [Document(page_content=answer) for answer in answers]
    #         output = sm_chain_llm.invoke(docs)
    #         summary = output['output_text']
    #     else:
    #         summary = answers[0]
    # print(f"[SQA] --- {summary}\n", flush=True)
    # return summary
    
    output = qa_chain_llm.invoke({'content': full_text, 'question': question})
    answer = output_parser.parse(output['text'])
    print(f"[SQA] --- {answer}\n", flush=True)
    return answer


class UserInput(BaseModel):
    fulltext: str
    question: str

model_name = 'mistral:instruct'
# ollama.pull(model_name)
qa_chain_llm, sm_chain_llm, output_parser, text_splitter = create_llm_chain(model_name)
answer = compute_answer("Today is March 14, 2024", "What day was yesterday?", qa_chain_llm, sm_chain_llm, output_parser, text_splitter)

app = FastAPI()

@app.post("/answer_question")
def answering_question(input: UserInput):
    start_time = datetime.now()
    result = {"answer": compute_answer(input.fulltext, input.question, qa_chain_llm, sm_chain_llm, output_parser, text_splitter)}
    end_time = datetime.now()
    seconds = (end_time - start_time).total_seconds()
    print(f"{seconds} seconds --- {result}\n", flush=True)
    return result
