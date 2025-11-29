const URL = "https://raw.githubusercontent.com/matthewreagan/WebstersEnglishDictionary/refs/heads/master/dictionary_compact.json";

async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("vocabDB", 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore("vocabStore");
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getCachedDictionary(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("vocabStore", "readonly");
    const store = tx.objectStore("vocabStore");
    const request = store.get("dictionary");

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function saveDictionary(db, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("vocabStore", "readwrite");
    const store = tx.objectStore("vocabStore");
    const request = store.put(data, "dictionary");

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function loadDictionary() {
  const db = await openDB();

  // 1. Try cached version
  const cached = await getCachedDictionary(db);
  if (cached) return cached;

  // 2. Fetch from GitHub
  const res = await fetch(URL);
  const fresh = await res.json();

  // 3. Save to IndexedDB
  await saveDictionary(db, fresh);

  return fresh;
}

async function main() {
  document.querySelector(".vocab__loading").textContent = "Loading word list…";

  let vocabObj;

  try {
    vocabObj = await loadDictionary();
  } catch (err) {
    document.body.innerHTML = "<p>Failed to load dictionary: " + err + "</p>";
    return;
  }

  // Convert object → array
  const words = Object.entries(vocabObj).map(([word, definition]) => ({
    word,
    definition,
    pronunciation: "",
    passage: definition,
    partOfSpeech: ""
  }));

  // Random word
  const entry = words[Math.floor(Math.random() * words.length)];

  document.body.innerHTML = `
    <div class="vocab">
      <h1 class="vocab__word">${entry.word}</h1>
      <hr class="vocab__hr">
      <p class="vocab__definition">${entry.definition}</p>
    </div>
  `;
}

main();
