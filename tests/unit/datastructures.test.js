// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  BinaryHeapModel,
  CircularBufferModel,
  DynamicArrayModel,
  HashTableModel,
  LinkedListModel,
  QueueModel,
  StackModel,
  TreeModel,
  TrieModel,
} from '../../src/apps/datastructures/structures.js';

describe('Data Structures Models', () => {
  function exhaust(generator) {
    let step = generator.next();
    let last = null;
    while (!step.done) {
      last = step.value;
      step = generator.next();
    }
    return last;
  }

  it('tests DynamicArrayModel with auto-resizing and shift', () => {
    const arr = new DynamicArrayModel(2);
    expect(arr.capacity).toBe(2);

    exhaust(arr.insert(10));
    exhaust(arr.insert(20));
    expect(arr.size).toBe(2);

    // Inserts 3rd element -> doubles capacity to 4
    exhaust(arr.insert(30));
    expect(arr.capacity).toBe(4);
    expect(arr.size).toBe(3);

    // Search
    let searchRes = null;
    const gSearch = arr.search(20);
    let s = gSearch.next();
    while (!s.done) {
      if (s.value?.type === 'found') searchRes = s.value.index;
      s = gSearch.next();
    }
    expect(searchRes).toBe(1);

    // Delete
    exhaust(arr.delete(1));
    expect(arr.size).toBe(2);
  });

  it('tests Stack and Queue models', () => {
    const stack = new StackModel();
    exhaust(stack.push(5));
    exhaust(stack.push(10));
    expect(stack.items).toEqual([5, 10]);
    exhaust(stack.pop());
    expect(stack.items).toEqual([5]);

    const queue = new QueueModel();
    exhaust(queue.enqueue(1));
    exhaust(queue.enqueue(2));
    expect(queue.items).toEqual([1, 2]);
    exhaust(queue.dequeue());
    expect(queue.items).toEqual([2]);
  });

  it('tests CircularBufferModel with modulo wrap-around', () => {
    const cb = new CircularBufferModel(3);
    exhaust(cb.enqueue(10));
    exhaust(cb.enqueue(20));
    exhaust(cb.enqueue(30));
    expect(cb.count).toBe(3);

    exhaust(cb.dequeue());
    expect(cb.head).toBe(1);
    expect(cb.count).toBe(2);

    exhaust(cb.enqueue(40));
    expect(cb.tail).toBe(1);
    expect(cb.buffer[0]).toBe(40); // wrap-around to index 0!
  });

  it('tests LinkedListModel (singly and doubly)', () => {
    const list = new LinkedListModel(false);
    exhaust(list.insertTail(1));
    exhaust(list.insertTail(2));
    exhaust(list.insertHead(0));
    expect(list.nodes.map((n) => n.val)).toEqual([0, 1, 2]);

    exhaust(list.delete(1));
    expect(list.nodes.map((n) => n.val)).toEqual([0, 2]);
  });

  it('tests AVL Tree rotations and balancing', () => {
    const avl = new TreeModel(true);
    // Inserting 30, 20, 10 produces an LL imbalance resolved by right rotation on 30
    exhaust(avl.insert(30));
    exhaust(avl.insert(20));
    exhaust(avl.insert(10));

    // After right rotation, 20 is root with children 10 and 30
    expect(avl.root?.val).toBe(20);
    expect(avl.root?.left?.val).toBe(10);
    expect(avl.root?.right?.val).toBe(30);
  });

  it('tests BinaryHeapModel (Max Heap)', () => {
    const heap = new BinaryHeapModel('max');
    exhaust(heap.insert(10));
    exhaust(heap.insert(50));
    exhaust(heap.insert(30));
    exhaust(heap.insert(70));

    // Root of max heap must be maximum value 70
    expect(heap.heap[0]).toBe(70);

    const extGen = heap.extract();
    let maxVal;
    let st = extGen.next();
    while (!st.done) {
      st = extGen.next();
    }
    maxVal = st.value;
    expect(maxVal).toBe(70);
    expect(heap.heap[0]).toBe(50);
  });

  it('tests HashTableModel (chaining and open addressing)', () => {
    const ht = new HashTableModel('chaining', 5);
    exhaust(ht.insert(10));
    exhaust(ht.insert(15)); // Both 10 and 15 hash to 0
    expect(ht.buckets[0].length).toBe(2);

    const htLin = new HashTableModel('linear', 5);
    exhaust(htLin.insert(10)); // slot 0
    exhaust(htLin.insert(15)); // collision -> probed to slot 1
    expect(htLin.buckets[0]).toBe(10);
    expect(htLin.buckets[1]).toBe(15);
  });

  it('tests TrieModel (insert and search)', () => {
    const trie = new TrieModel();
    exhaust(trie.insert('cat'));
    exhaust(trie.insert('car'));

    let foundCat = false;
    const gCat = trie.search('cat');
    let sc = gCat.next();
    while (!sc.done) {
      if (sc.value?.type === 'found') foundCat = true;
      sc = gCat.next();
    }
    expect(foundCat).toBe(true);

    let foundDog = false;
    const gDog = trie.search('dog');
    let sd = gDog.next();
    while (!sd.done) {
      if (sd.value?.type === 'found') foundDog = true;
      sd = gDog.next();
    }
    expect(foundDog).toBe(false);
  });
});
