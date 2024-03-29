from collections import defaultdict
import json
import sys

if __name__ == '__main__':
    in_file_name = sys.argv[1]
    
    stats = defaultdict(int)
    multi_linguals = defaultdict(int)
    folders = defaultdict(int)
    genres = defaultdict(int)
    filenames = defaultdict(int)
    scores = dict()
    publishers = defaultdict(int)
    count = 0
    
    with open(in_file_name, 'rt') as in_file:
        for line in in_file.readlines():
            document = json.loads(line.strip())

            for k in document.keys():
                if document[k]:
                    stats[k] += 1

            langs = set()
            for k in document['body']:
                if len(document['body'][k]['title']) > 0 and len(document['body'][k]['contents']) > 0:
                    langs.add(k)
            multi_linguals['-'.join(list(sorted(langs)))] += 1

            if document['genre']:
                genres[document['genre']] += 1
            else:
                genres[''] += 1

            if document['factivatopicfolder']:
                folders[document['factivatopicfolder']] += 1
            else:
                folders[''] += 1

            if document['score']:
                if document['score'] not in scores:
                    scores[document['score']] = [0, 0, 0]
                p_state = 1 if document['state'] == 'PUBLISHED' else 0 if document['state'] == 'TRASHED' else 2
                scores[document['score']][p_state] += 1
            else:
                if -1.0 not in scores:
                    scores[-1.0] = [0, 0, 0]
                p_state = 1 if document['state'] == 'PUBLISHED' else 0 if document['state'] == 'TRASHED' else 2
                scores[-1.0][p_state] += 1

            if document['publicationname']:
                publishers[document['publicationname']] += 1
            else:
                publishers[''] += 1

            count += 1
        
    print(f"Read {count} articles.")
    
    print('\nStats:')
    for k in sorted(stats.keys()):
        print(f"{k} --- {stats[k]}")

    print('\nMulti-linguals:')
    for k in sorted(multi_linguals.keys()):
        print(f"{k} --- {multi_linguals[k]}")

    print(f'\nTitles and contents: {sum(multi_linguals.values())}')

    print('\nGenres:')
    for k in sorted(genres.keys()):
        print(f"{k} --- {genres[k]}")

    print('\nFolders:')
    for k in sorted(folders.keys()):
        print(f"{k} --- {folders[k]}")

    print('\nFiles:')
    for k in sorted(filenames.keys()):
        print(f"{k} --- {filenames[k]}")

    print('\nScores:')
    for k in sorted(scores.keys()):
        print(f"{k} --- {scores[k]}")

    print('\nPublishers:')
    for k in sorted(publishers.keys()):
        print(f"{k} --- {publishers[k]}")
