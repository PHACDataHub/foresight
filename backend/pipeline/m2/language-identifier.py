from collections import defaultdict
import sys

import fasttext

fasttext.FastText.eprint = lambda x: None


def identify(model, texts):
    result_dict = defaultdict(float)
    for text in texts:
        labels, probabilities = model.predict(text, k=3)
        for label, probability in zip(labels, probabilities):
            result_dict[label[9:]] += probability
    result_dict = {k: v / len(result_dict)for k, v in result_dict.items()}
    if result_dict:
        return  sorted(result_dict.items(), key=lambda item: item[1], reverse=True)[0]
    else:
        return None, -1.0 

TEXTS = [
    'U23 Hàn Quốc hạ Nhật Bản, đối đầu U23 Indonesia ở tứ kết',
    "‘Xanh’ thành tiêu chí số 1, Giám đốc cũng phải đi học về giảm phát thải",
    'Giá vàng hôm nay 22/4/2024: SJC rơi tự do rồi bật tăng do hủy đấu thầu vàng',
]


if __name__ == '__main__':
    model = fasttext.load_model(sys.argv[1])
    print(len(model.words)) # number of words in dictionary
    # print(model['king']) # get the vector of the word 'king'
    # print( model['kingserwq']) # get the vector for an OOV word
    print(identify(model, TEXTS))