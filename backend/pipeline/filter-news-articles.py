import json
import sys


if __name__ == '__main__':
    in_file_name = sys.argv[1]
    lines = []
    with open(in_file_name, 'rt') as in_file:
        lines = in_file.readlines()
    print(f"Read {len(lines)} documents.\n")
    
    documents = []
    id_set = set()
    for line in lines:
        document = json.loads(line.strip())
        if document['id'] not in id_set:
            id_set.add(document['id'])
            documents.append(document)

    with open(in_file_name, 'wt') as out_file:
        for document in documents:
            out_file.write(f"{json.dumps(document)}\n")

    print(f"Written {len(documents)} articles.")
        