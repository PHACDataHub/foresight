from langchain.callbacks.manager import CallbackManager
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from langchain_community.llms import Ollama
from langchain.schema import HumanMessage

llm = Ollama(
    model='mistral',
    callback_manager=CallbackManager([StreamingStdOutCallbackHandler()],)
)

for text in [
    "What would be a good company name for a company that makes colorful socks?",
    "Tell me about the history of AI"
]:
    messages = [HumanMessage(content=text)]
    llm.invoke(text)