import json
import sys


def load_jsonl(file_name, slice=None, single=False):
    with open(file_name, 'rt') as in_file:
        lines = in_file.readlines()[0:int(slice)] if slice else in_file.readlines()
        documents = [json.loads(line.strip()) for line in lines]
        print(f"[{file_name}] Read {len(documents)} documents.")
        if single and len(documents) == 1:
            return documents[0]
        return documents


def save_jsonl(documents, file_name, single=False):
    with open(file_name, 'wt') as out_file:
        if single:
            out_file.write(f"{json.dumps(documents)}\n")
            print(f"\n[{file_name}] - Wrote 1 document.")
        else:
            for document in documents:
                out_file.write(f"{json.dumps(document)}\n")
            print(f"\n[{file_name}] - Wrote {len(documents)} documents.")


def performing_tasks(path, period):
    smr_file_name = f"{path}/processed-{period}-smr.jsonl"
    topic_similarity_list = load_jsonl(smr_file_name, single=True)
    
    article_similarity_list = []
    for topic_similarity in topic_similarity_list:
        topic, similarity_list = topic_similarity
        article_similarity_list.append({"topic": topic, "id_list": similarity_list})
        print(f"{topic} --- {len(similarity_list)}")

    smf_file_name = f"{path}/processed-{period}-smf.jsonl"
    save_jsonl(article_similarity_list, smf_file_name)


if __name__ == '__main__':
    path, start_date, end_date = sys.argv[1], sys.argv[2], sys.argv[3]

    date_list = [f"{month}-{day:02}" for month in ['2019-12', '2020-01'] for day in range(1, 32)]

    for pub_date in date_list:
        if pub_date < start_date or pub_date > end_date:
            continue
  
        # initial_time = datetime.now()
        
        # Load documents as jsonl
        # doc_file_name = f"{path}/processed-{pub_date}-news-articles.jsonl"
        # daily_documents = dict()
        # for document in load_jsonl(doc_file_name):
        #     document_id = document['id']
        #     daily_documents[document['id']] = document

        # daily_documents_dict[pub_date] = daily_documents
        performing_tasks(path, pub_date)

        # final_time = datetime.now()
        # seconds = (final_time - initial_time).total_seconds()
        # print(f"{seconds} seconds --- {len(daily_documents)} documents --- {seconds/len(daily_documents):0.2f} seconds per document.\n")


    # for period_length, period_days in [ (3, range(30, 37)), (7, range(30, 31)), (30, range(30, 31)) ]:
    #     for i in period_days:
            
    #         initial_time = datetime.now()

    #         start_period, end_period = date_list[i], date_list[i+period_length-1]
    #         period = f"{start_period}-{end_period}"
    #         period_documents = {k: v for j in range(0, period_length) for k, v in daily_documents_dict[date_list[i+j]].items()}
    #         performing_tasks(path, period, period_documents)

    #         final_time = datetime.now()
    #         seconds = (final_time - initial_time).total_seconds()
    #         print(f"{seconds} seconds --- {len(period_documents)} documents --- {seconds/len(period_documents):0.2f} seconds per document.\n")
