import json
import os
import sys

if __name__ == '__main__':
    in_path, out_path = sys.argv[1], sys.argv[2]

    url_file_name = f"{out_path}/rss-feed-urls.txt"
    with open(url_file_name, 'wt') as url_out_file:
        
        for file_name in sorted(os.listdir(in_path)):
            path_name = os.path.join(in_path, file_name)
            if not os.path.isfile(path_name) or not path_name.endswith('.jsonl'):
                continue
            
            with open(path_name, 'rt') as in_file:
                line = in_file.readlines()[0]
                document = json.loads(line.strip())
                url_out_file.write(f"{document['feed']}\n")
