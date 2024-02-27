from queue import Queue
from threading import Thread
from time import sleep

def process(item_sublist, queue):
    for i in item_sublist:
        sleep(1)
        i *= 2
        queue.put(i)

if __name__ == '__main__':
    item_list = [i for i in range(0, 10)]
    n_workers = 3
    batch_size = len(item_list) // n_workers
    
    sub_lists = []
    for i in range(0, n_workers-1):
        sub_lists.append(item_list[i * batch_size: (i+1) * batch_size])
    sub_lists.append(item_list[(n_workers - 1) * batch_size:])

    output_queue = Queue()
    workers = []
    for i in range(0, n_workers):
        workers.append(Thread(target=process, args=(sub_lists[i], output_queue,)))
        
    for i in range(0, n_workers):
        workers[i].start()
    
    for i in range(0, n_workers):
        workers[i].join()
    
    output = []
    while True:
        i = output_queue.get()
        if i is None:
            break
        output.append(i)
        if len(output) == len(item_list):
            break
        
    print(output)