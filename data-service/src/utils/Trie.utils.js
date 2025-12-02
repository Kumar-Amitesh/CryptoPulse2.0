class TrieNode {
    constructor() {
        this.children = {};
        this.isEndOfWord = false;
        this.coinData = [];
    }
}

class Trie {
    constructor() {
        this.root = new TrieNode();
    }

    insert(key, data) {
        let node = this.root;
        const lowerKey = key.toLowerCase();

        for (const char of lowerKey) {
            if (!node.children[char]) {
                node.children[char] = new TrieNode();
            }
            node = node.children[char];
        }

        node.isEndOfWord = true;
        node.coinData.push(data);
    }

    search(prefix, limit = 10) {
        let node = this.root;
        const lowerPrefix = prefix.toLowerCase();

        for (const char of lowerPrefix) {
            if (!node.children[char]) return [];
            node = node.children[char];
        }

        const results = [];
        this._collect(node, results, limit);
        return results.slice(0, limit);
    }

    _collect(node, results, limit) {
        if (results.length >= limit) return;

        if (node.isEndOfWord && node.coinData.length > 0) {
            results.push(...node.coinData);
        }

        for (const char in node.children) {
            this._collect(node.children[char], results, limit);
        }
    }
}

export const coinTrie = new Trie();
