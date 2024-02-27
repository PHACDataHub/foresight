import sys
import ollama


if __name__ == '__main__':
    ollama.pull(sys.argv[1])