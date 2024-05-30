from langchain.chains.llm import LLMChain
from langchain.chains.summarize import load_summarize_chain
from langchain.output_parsers.list import NumberedListOutputParser
from langchain.prompts.prompt import PromptTemplate
from langchain.text_splitter import RecursiveCharacterTextSplitter

from langchain_community.llms import Ollama


def create_qa_prompt(format_instructions):
    QA_TEMPLATE = """Use the text below delimited by triple quotes (```) to create a GENERIC question that can be used later for similar text. Return ONLY the question WITHOUT any explanation.
    TEXT:```{text}```

    QUESTION:{format_instructions}:"""
    return PromptTemplate(
        input_variables=["text"], 
        partial_variables={"format_instructions": format_instructions}, 
        template=QA_TEMPLATE)
    

if __name__ == '__main__':
    output_parser = NumberedListOutputParser()
    format_instructions = output_parser.get_format_instructions()

    model_name = 'llama3'
    llm_model = Ollama(model=model_name, temperature=0.0)

    prompt = create_qa_prompt(format_instructions)
    llm_chain = prompt | llm_model | output_parser
    
    result = llm_chain.invoke({"text": "Assuming a small population on the order of about 50 animals, an optimistic assessment suggests that recovery to 200 animals could occur within 10-20 years and a recovery to 350 animals could occur within 15-30 years depending on the type of model used."})
    print(result)
