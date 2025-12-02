let trie = null;

const setTrie = (instance) => {
  trie = instance;
};

const searchCoins = (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim() === "") {
      return res.status(400).json({ error: "Missing search query" });
    }

    const results = trie.search(q);

    res.json({
      count: results.length,
      results
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed" });
  }
};

export { setTrie, searchCoins };