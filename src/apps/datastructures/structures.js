// @ts-check

// ─── 1. Dynamic Array ──────────────────────────────────────────────────────────
export class DynamicArrayModel {
  constructor(initialCapacity = 4) {
    this.capacity = initialCapacity;
    /** @type {Array<number|null>} */
    this.data = new Array(this.capacity).fill(null);
    this.size = 0;
  }

  *insert(val, index = this.size) {
    yield { type: 'highlight', line: 1, message: `Insert ${val} at index ${index}` };
    if (this.size >= this.capacity) {
      yield {
        type: 'highlight',
        line: 2,
        message: `Array full (size ${this.size} == capacity ${this.capacity}). Doubling capacity!`,
      };
      const newCap = this.capacity * 2;
      const newData = new Array(newCap).fill(null);
      for (let i = 0; i < this.size; i++) {
        newData[i] = this.data[i];
      }
      this.capacity = newCap;
      this.data = newData;
      yield { type: 'resize', capacity: newCap, message: `Resized to capacity ${newCap}` };
    }

    const targetIdx = Math.max(0, Math.min(this.size, index));
    // Shift elements right
    for (let i = this.size; i > targetIdx; i--) {
      this.data[i] = this.data[i - 1];
      yield { type: 'shift', from: i - 1, to: i, line: 3 };
    }
    this.data[targetIdx] = val;
    this.size++;
    yield { type: 'set', index: targetIdx, value: val, line: 4, message: `Placed ${val} at index ${targetIdx}` };
  }

  *delete(index) {
    if (index < 0 || index >= this.size) {
      yield { type: 'error', message: 'Index out of bounds' };
      return;
    }
    yield { type: 'highlight', line: 1, message: `Delete element at index ${index}` };
    const val = this.data[index];
    for (let i = index; i < this.size - 1; i++) {
      this.data[i] = this.data[i + 1];
      yield { type: 'shift', from: i + 1, to: i, line: 2 };
    }
    this.data[this.size - 1] = null;
    this.size--;
    yield { type: 'finish', message: `Deleted ${val}, new size ${this.size}` };
  }

  *search(val) {
    yield { type: 'highlight', line: 1, message: `Searching for ${val}` };
    for (let i = 0; i < this.size; i++) {
      yield { type: 'compare', index: i, line: 2, message: `Checking index ${i} (${this.data[i]})` };
      if (this.data[i] === val) {
        yield { type: 'found', index: i, line: 3, message: `Found ${val} at index ${i}!` };
        return i;
      }
    }
    yield { type: 'notFound', line: 4, message: `${val} not found in array.` };
    return -1;
  }
}

// ─── 2. Stack & Queue & Circular Buffer ───────────────────────────────────────
export class StackModel {
  constructor() {
    /** @type {number[]} */
    this.items = [];
  }

  *push(val) {
    yield { type: 'highlight', line: 1, message: `Push ${val} onto stack` };
    this.items.push(val);
    yield { type: 'push', value: val, line: 2, message: `Pushed ${val} (top is now ${val})` };
  }

  *pop() {
    if (this.items.length === 0) {
      yield { type: 'error', message: 'Stack underflow! Stack is empty.' };
      return null;
    }
    yield { type: 'highlight', line: 1, message: 'Pop element from top of stack' };
    const val = this.items.pop();
    yield { type: 'pop', value: val, line: 2, message: `Popped ${val}` };
    return val;
  }
}

export class QueueModel {
  constructor() {
    /** @type {number[]} */
    this.items = [];
  }

  *enqueue(val) {
    yield { type: 'highlight', line: 1, message: `Enqueue ${val} at tail` };
    this.items.push(val);
    yield { type: 'enqueue', value: val, line: 2, message: `Enqueued ${val}` };
  }

  *dequeue() {
    if (this.items.length === 0) {
      yield { type: 'error', message: 'Queue underflow! Queue is empty.' };
      return null;
    }
    yield { type: 'highlight', line: 1, message: 'Dequeue element from head' };
    const val = this.items.shift();
    yield { type: 'dequeue', value: val, line: 2, message: `Dequeued ${val}` };
    return val;
  }
}

export class CircularBufferModel {
  constructor(capacity = 6) {
    this.capacity = capacity;
    /** @type {Array<number|null>} */
    this.buffer = new Array(capacity).fill(null);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  *enqueue(val) {
    if (this.count >= this.capacity) {
      yield { type: 'error', message: 'Circular buffer full!' };
      return;
    }
    yield { type: 'highlight', line: 1, message: `Enqueue ${val} at tail index ${this.tail}` };
    this.buffer[this.tail] = val;
    this.tail = (this.tail + 1) % this.capacity;
    this.count++;
    yield { type: 'set', line: 2, message: `Stored ${val}. Head: ${this.head}, Tail: ${this.tail}` };
  }

  *dequeue() {
    if (this.count === 0) {
      yield { type: 'error', message: 'Circular buffer is empty!' };
      return null;
    }
    yield { type: 'highlight', line: 1, message: `Dequeue from head index ${this.head}` };
    const val = this.buffer[this.head];
    this.buffer[this.head] = null;
    this.head = (this.head + 1) % this.capacity;
    this.count--;
    yield { type: 'finish', message: `Removed ${val}. Head: ${this.head}, Tail: ${this.tail}` };
    return val;
  }
}

// ─── 3. Linked Lists ──────────────────────────────────────────────────────────
export class LinkedListModel {
  constructor(isDoubly = false) {
    this.isDoubly = isDoubly;
    /** @type {Array<{ val: number, id: string }>} */
    this.nodes = [];
  }

  *insertHead(val) {
    yield { type: 'highlight', line: 1, message: `Insert ${val} at head` };
    this.nodes.unshift({ val, id: `n_${Date.now()}_${Math.random()}` });
    yield { type: 'finish', line: 2, message: `Node ${val} is now head` };
  }

  *insertTail(val) {
    yield { type: 'highlight', line: 1, message: `Insert ${val} at tail` };
    this.nodes.push({ val, id: `n_${Date.now()}_${Math.random()}` });
    yield { type: 'finish', line: 2, message: `Node ${val} appended to tail` };
  }

  *delete(val) {
    yield { type: 'highlight', line: 1, message: `Search and delete node with value ${val}` };
    for (let i = 0; i < this.nodes.length; i++) {
      yield { type: 'compare', index: i, line: 2, message: `Checking node ${this.nodes[i].val}` };
      if (this.nodes[i].val === val) {
        this.nodes.splice(i, 1);
        yield { type: 'finish', line: 3, message: `Deleted node ${val}` };
        return true;
      }
    }
    yield { type: 'notFound', line: 4, message: `Value ${val} not found` };
    return false;
  }

  *search(val) {
    yield { type: 'highlight', line: 1, message: `Traverse list searching for ${val}` };
    for (let i = 0; i < this.nodes.length; i++) {
      yield { type: 'compare', index: i, line: 2, message: `Inspecting node at position ${i}: ${this.nodes[i].val}` };
      if (this.nodes[i].val === val) {
        yield { type: 'found', index: i, line: 3, message: `Found ${val} at position ${i}!` };
        return i;
      }
    }
    yield { type: 'notFound', line: 4, message: `Value ${val} not in list.` };
    return -1;
  }
}

// ─── 4. BST & AVL Tree ────────────────────────────────────────────────────────
export class TreeNode {
  constructor(val) {
    this.val = val;
    this.left = null;
    this.right = null;
    this.height = 1;
  }
}

export class TreeModel {
  constructor(isAvl = false) {
    this.isAvl = isAvl;
    /** @type {TreeNode | null} */
    this.root = null;
  }

  getHeight(node) {
    return node ? node.height : 0;
  }

  getBalance(node) {
    return node ? this.getHeight(node.left) - this.getHeight(node.right) : 0;
  }

  updateHeight(node) {
    if (node) {
      node.height = 1 + Math.max(this.getHeight(node.left), this.getHeight(node.right));
    }
  }

  rotateRight(y) {
    const x = y.left;
    const T2 = x.right;
    x.right = y;
    y.left = T2;
    this.updateHeight(y);
    this.updateHeight(x);
    return x;
  }

  rotateLeft(x) {
    const y = x.right;
    const T2 = y.left;
    y.left = x;
    x.right = T2;
    this.updateHeight(x);
    this.updateHeight(y);
    return y;
  }

  *insert(val) {
    yield { type: 'highlight', line: 1, message: `Insert ${val} into ${this.isAvl ? 'AVL' : 'BST'} tree` };
    const self = this;

    function* insertNode(node, v) {
      if (!node) {
        yield { type: 'createNode', value: v, message: `Created new node ${v}` };
        return new TreeNode(v);
      }

      yield { type: 'compare', nodeVal: node.val, message: `Compare ${v} with ${node.val}` };
      if (v < node.val) {
        node.left = yield* insertNode(node.left, v);
      } else if (v > node.val) {
        node.right = yield* insertNode(node.right, v);
      } else {
        yield { type: 'error', message: `Value ${v} already exists!` };
        return node;
      }

      self.updateHeight(node);
      const balance = self.getBalance(node);

      if (self.isAvl) {
        // LL Case
        if (balance > 1 && v < node.left.val) {
          yield {
            type: 'rotate',
            rotation: 'Right (LL)',
            nodeVal: node.val,
            message: `LL imbalance at ${node.val}. Rotate Right!`,
          };
          return self.rotateRight(node);
        }
        // RR Case
        if (balance < -1 && v > node.right.val) {
          yield {
            type: 'rotate',
            rotation: 'Left (RR)',
            nodeVal: node.val,
            message: `RR imbalance at ${node.val}. Rotate Left!`,
          };
          return self.rotateLeft(node);
        }
        // LR Case
        if (balance > 1 && v > node.left.val) {
          yield {
            type: 'rotate',
            rotation: 'Left-Right (LR)',
            nodeVal: node.val,
            message: `LR imbalance at ${node.val}. Rotate Left then Right!`,
          };
          node.left = self.rotateLeft(node.left);
          return self.rotateRight(node);
        }
        // RL Case
        if (balance < -1 && v < node.right.val) {
          yield {
            type: 'rotate',
            rotation: 'Right-Left (RL)',
            nodeVal: node.val,
            message: `RL imbalance at ${node.val}. Rotate Right then Left!`,
          };
          node.right = self.rotateRight(node.right);
          return self.rotateLeft(node);
        }
      }

      return node;
    }

    this.root = yield* insertNode(this.root, val);
    yield { type: 'finish', message: `Inserted ${val} successfully.` };
  }

  *search(val) {
    yield { type: 'highlight', line: 1, message: `Searching for ${val} in tree` };
    let curr = this.root;
    while (curr) {
      yield { type: 'compare', nodeVal: curr.val, message: `Visiting node ${curr.val}` };
      if (curr.val === val) {
        yield { type: 'found', nodeVal: curr.val, message: `Found ${val}!` };
        return curr;
      }
      if (val < curr.val) curr = curr.left;
      else curr = curr.right;
    }
    yield { type: 'notFound', message: `${val} not found in tree.` };
    return null;
  }

  *delete(val) {
    yield { type: 'highlight', line: 1, message: `Delete ${val} from tree` };
    const self = this;

    function* deleteNode(node, v) {
      if (!node) {
        yield { type: 'notFound', message: `${v} not found to delete.` };
        return null;
      }

      yield { type: 'compare', nodeVal: node.val, message: `Compare ${v} with ${node.val}` };
      if (v < node.val) {
        node.left = yield* deleteNode(node.left, v);
      } else if (v > node.val) {
        node.right = yield* deleteNode(node.right, v);
      } else {
        // Node with 0 or 1 child
        if (!node.left || !node.right) {
          const temp = node.left || node.right;
          yield { type: 'removeNode', nodeVal: v, message: `Removing node ${v}` };
          return temp;
        }
        // Node with 2 children: find in-order successor (smallest in right subtree)
        let succ = node.right;
        while (succ.left) succ = succ.left;
        yield { type: 'successor', nodeVal: succ.val, message: `In-order successor is ${succ.val}` };
        node.val = succ.val;
        node.right = yield* deleteNode(node.right, succ.val);
      }

      self.updateHeight(node);
      const balance = self.getBalance(node);

      if (self.isAvl) {
        if (balance > 1 && self.getBalance(node.left) >= 0) return self.rotateRight(node);
        if (balance > 1 && self.getBalance(node.left) < 0) {
          node.left = self.rotateLeft(node.left);
          return self.rotateRight(node);
        }
        if (balance < -1 && self.getBalance(node.right) <= 0) return self.rotateLeft(node);
        if (balance < -1 && self.getBalance(node.right) > 0) {
          node.right = self.rotateRight(node.right);
          return self.rotateLeft(node);
        }
      }

      return node;
    }

    this.root = yield* deleteNode(this.root, val);
    yield { type: 'finish', message: `Deleted ${val} from tree.` };
  }
}

// ─── 5. Binary Heap ───────────────────────────────────────────────────────────
export class BinaryHeapModel {
  /**
   * @param {'max' | 'min'} type
   */
  constructor(type = 'max') {
    this.type = type;
    /** @type {number[]} */
    this.heap = [];
  }

  isBetter(a, b) {
    return this.type === 'max' ? a > b : a < b;
  }

  *insert(val) {
    yield { type: 'highlight', line: 1, message: `Insert ${val} at heap end` };
    this.heap.push(val);
    let i = this.heap.length - 1;
    yield { type: 'set', index: i, value: val, message: `Added ${val} at index ${i}` };

    // Bubble up
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      yield {
        type: 'compare',
        indices: [i, parent],
        message: `Compare child ${this.heap[i]} with parent ${this.heap[parent]}`,
      };
      if (this.isBetter(this.heap[i], this.heap[parent])) {
        yield { type: 'swap', indices: [i, parent], message: `Swap ${this.heap[i]} and ${this.heap[parent]}` };
        const tmp = this.heap[i];
        this.heap[i] = this.heap[parent];
        this.heap[parent] = tmp;
        i = parent;
      } else {
        break;
      }
    }
    yield { type: 'finish', message: `Heap invariant restored.` };
  }

  *extract() {
    if (this.heap.length === 0) {
      yield { type: 'error', message: 'Heap is empty!' };
      return null;
    }
    const rootVal = this.heap[0];
    yield { type: 'highlight', line: 1, message: `Extract root (${rootVal})` };
    const last = this.heap.pop();
    if (this.heap.length === 0) {
      yield { type: 'finish', message: `Extracted last element ${rootVal}` };
      return rootVal;
    }

    this.heap[0] = last;
    yield { type: 'set', index: 0, value: last, message: `Moved last element ${last} to root` };

    // Sink down
    let i = 0;
    const n = this.heap.length;
    while (true) {
      let target = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;

      if (left < n) {
        yield { type: 'compare', indices: [left, target] };
        if (this.isBetter(this.heap[left], this.heap[target])) target = left;
      }
      if (right < n) {
        yield { type: 'compare', indices: [right, target] };
        if (this.isBetter(this.heap[right], this.heap[target])) target = right;
      }

      if (target !== i) {
        yield { type: 'swap', indices: [i, target], message: `Swap ${this.heap[i]} with child ${this.heap[target]}` };
        const tmp = this.heap[i];
        this.heap[i] = this.heap[target];
        this.heap[target] = tmp;
        i = target;
      } else {
        break;
      }
    }

    yield { type: 'finish', message: `Extracted ${rootVal}. Heap restored.` };
    return rootVal;
  }
}

// ─── 6. Hash Table ────────────────────────────────────────────────────────────
export class HashTableModel {
  /**
   * @param {'chaining' | 'linear' | 'quadratic'} mode
   * @param {number} capacity
   */
  constructor(mode = 'chaining', capacity = 7) {
    this.mode = mode;
    this.capacity = capacity;
    /** @type {any[]} */
    this.buckets = Array.from({ length: capacity }, () => (mode === 'chaining' ? [] : null));
    this.count = 0;
  }

  hash(val) {
    const num =
      typeof val === 'number'
        ? val
        : String(val)
            .split('')
            .reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return Math.abs(num) % this.capacity;
  }

  getLoadFactor() {
    return Math.round((this.count / this.capacity) * 100) / 100;
  }

  *insert(val) {
    const h = this.hash(val);
    yield { type: 'highlight', line: 1, message: `hash(${val}) = ${h} (capacity ${this.capacity})` };

    if (this.mode === 'chaining') {
      this.buckets[h].push(val);
      this.count++;
      yield { type: 'set', bucket: h, value: val, message: `Appended ${val} to chain at index ${h}` };
    } else {
      // Open addressing
      let i = 0;
      while (i < this.capacity) {
        const idx = (h + (this.mode === 'quadratic' ? i * i : i)) % this.capacity;
        yield { type: 'probe', index: idx, probeCount: i, message: `Probe ${i}: index ${idx}` };
        if (this.buckets[idx] === null) {
          this.buckets[idx] = val;
          this.count++;
          yield { type: 'set', bucket: idx, value: val, message: `Stored ${val} at slot ${idx}` };
          return;
        }
        i++;
      }
      yield { type: 'error', message: 'Hash table full! Cannot insert.' };
    }

    if (this.getLoadFactor() > 0.75) {
      yield { type: 'rehash', message: `Load factor ${this.getLoadFactor()} > 0.75. Rehash recommended.` };
    }
  }

  *search(val) {
    const h = this.hash(val);
    yield { type: 'highlight', line: 1, message: `hash(${val}) = ${h}` };

    if (this.mode === 'chaining') {
      const chain = this.buckets[h] || [];
      for (let i = 0; i < chain.length; i++) {
        yield { type: 'compare', bucket: h, chainIndex: i, message: `Checking item ${chain[i]}` };
        if (chain[i] === val) {
          yield { type: 'found', bucket: h, message: `Found ${val} in bucket ${h}!` };
          return true;
        }
      }
    } else {
      let i = 0;
      while (i < this.capacity) {
        const idx = (h + (this.mode === 'quadratic' ? i * i : i)) % this.capacity;
        yield { type: 'probe', index: idx, message: `Checking slot ${idx}` };
        if (this.buckets[idx] === val) {
          yield { type: 'found', bucket: idx, message: `Found ${val} at slot ${idx}!` };
          return true;
        }
        if (this.buckets[idx] === null) break;
        i++;
      }
    }
    yield { type: 'notFound', message: `${val} not found.` };
    return false;
  }
}

// ─── 7. Trie ──────────────────────────────────────────────────────────────────
export class TrieNode {
  constructor() {
    /** @type {Record<string, TrieNode>} */
    this.children = {};
    this.isEndOfWord = false;
  }
}

export class TrieModel {
  constructor() {
    this.root = new TrieNode();
  }

  *insert(word) {
    const w = String(word).toLowerCase();
    yield { type: 'highlight', line: 1, message: `Insert word "${w}" into Trie` };
    let curr = this.root;
    for (let i = 0; i < w.length; i++) {
      const char = w[i];
      yield { type: 'char', char, index: i, message: `Process char "${char}"` };
      if (!curr.children[char]) {
        curr.children[char] = new TrieNode();
        yield { type: 'addNode', char, message: `Created branch for "${char}"` };
      }
      curr = curr.children[char];
    }
    curr.isEndOfWord = true;
    yield { type: 'finish', message: `Marked end of word for "${w}"` };
  }

  *search(word) {
    const w = String(word).toLowerCase();
    yield { type: 'highlight', line: 1, message: `Search word "${w}" in Trie` };
    let curr = this.root;
    for (let i = 0; i < w.length; i++) {
      const char = w[i];
      yield { type: 'char', char, index: i, message: `Follow branch "${char}"` };
      if (!curr.children[char]) {
        yield { type: 'notFound', message: `Branch "${char}" missing! Word not in Trie.` };
        return false;
      }
      curr = curr.children[char];
    }
    if (curr.isEndOfWord) {
      yield { type: 'found', message: `Word "${w}" found in Trie!` };
      return true;
    }
    yield { type: 'notFound', message: `Prefix exists, but "${w}" is not a complete word.` };
    return false;
  }
}
