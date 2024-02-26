import json
import os
import sys


def increase_count(count, character):
    count += 1
    print(character, end="", flush=True)
    return count


def retrieve_documents(in_path, start_date, end_date):
    count = 0
    documents = dict()
    for file_name in sorted(os.listdir(in_path)):
        path_name = os.path.join(in_path, file_name)
        if not os.path.isfile(path_name) or not path_name.endswith('.json'):
            continue
        with open(path_name, 'rt') as in_file:
            for _, item_list in json.load(in_file).items():
                for item in item_list:
                    pub_date = item['publicationdate'][:10]
                    if pub_date >= start_date and pub_date <= end_date:
                        documents[item['id']] = {k: v for k, v in item.items() if k in ['id', 'title', 'pub_date', 'publicationname', 'originallanguage', 'originalfilename', 'factivatopicfolder', 'state', 'genre']}
        count = increase_count(count, '.')
    return documents


def retrieve_bodies(in_path, documents):
    count = 0
    for file_name in sorted(os.listdir(in_path)):
        path_name = os.path.join(in_path, file_name)
        if not os.path.isfile(path_name) or not path_name.endswith('.json'):
            continue
        with open(path_name, 'rt') as in_file:
            try:
                for _, item_list in json.load(in_file).items():
                    for item in item_list:
                        if item['documentid'] in documents:
                            if 'body' not in documents[item['documentid']]:
                                documents[item['documentid']]['body'] = dict()
                            documents[item['documentid']]['body'][item['languague']] = {k: v for k, v in item.items() if k in ['title', 'contents']}
            except Exception as ex:
                print(ex, path_name)
                exit(0)
            count = increase_count(count, '.')
        
    return documents


def retrieve_scores(in_path, documents):
    count = 0
    for file_name in sorted(os.listdir(in_path)):
        path_name = os.path.join(in_path, file_name)
        if not os.path.isfile(path_name) or not path_name.endswith('.json'):
            continue
        with open(path_name, 'rt') as in_file:
            for _, item_list in json.load(in_file).items():
                for item in item_list:
                    if item['documentid'] in documents:
                        documents[item['documentid']]['score'] = item['value']
        count = increase_count(count, '.')
    return documents


if __name__ == '__main__':
    in_path, out_file_name, start_date, end_date = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    
    documents = retrieve_documents(in_path + '/documents/', start_date, end_date)
    min_id = min(documents.keys())
    max_id = max(documents.keys())
    print(f"\nRetrieved {len(documents)} documents.\n min_id = {min_id}, max_id = {max_id}")

    documents = retrieve_bodies(in_path + '/body/', documents)
    empty_entries = []
    for document_id, document in documents.items():
        if 'body' not in document:
            empty_entries.append(document_id)
    for document_id in empty_entries:
        documents.pop(document_id)
    print(f"\nRetained {len(documents)} documents.\n")

    documents = retrieve_scores(in_path + '/score/', documents)
    count = 0
    for document_id, document in documents.items():
        if 'score' in document:
            count += 1
    print(f"\nOnly {count} documents having score.\n")

    with open(out_file_name, 'wt') as out_file:
        for document_id in sorted(documents.keys()):
            out_file.write(f"{json.dumps(documents[document_id])}\n")

    print(f"\nWritten {len(documents)} documents.\n")

