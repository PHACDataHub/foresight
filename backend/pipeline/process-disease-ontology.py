import json
import sys

from langchain_community.embeddings import HuggingFaceEmbeddings


def increase_count(count, character):
    count += 1
    print(character, end="", flush=True)
    return count


def load_disease_classes(in_file_name):
    disease_classes = []
    with open(in_file_name, 'rt') as in_file:
        count = 1
        for line in in_file.readlines()[1:]:
            count += 1
            url, definition, label, synonyms = line.split('\t')
            label = label.strip()
            if label.startswith('obsolete'):
                label = label.replace('obsolete ', '')
            disease_classes.append({'url': url, 'texts': [s for s in [label] + eval(synonyms) if s]})
            # disease_classes.append({'url': url, 'texts': [s for s in [label] + eval(synonyms) + [definition] if s]})
    return disease_classes


if __name__ == '__main__':
    in_file_name, out_file_name = sys.argv[1], sys.argv[2]
    
    disease_classes = load_disease_classes(in_file_name)
    print(f"Read {len(disease_classes)} classes.\n")
    
    embeddings = HuggingFaceEmbeddings(model_name='sentence-transformers/all-mpnet-base-v2')
    
    with open(out_file_name, 'wt') as out_file:
        count = 0
        for dc in disease_classes:
            dc['embeddings'] = embeddings.embed_documents(dc['texts'])
            count = increase_count(count, '.')
            out_file.write(f"{json.dumps(dc)}\n")
    
    print(f"\nProcessed {count} disease classes.\n")
