#!/bin/bash

# CPU only
# docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama

docker run --rm -d --gpus=all -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama
