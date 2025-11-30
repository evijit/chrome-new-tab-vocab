// Wordset dictionary - divided into letter files
const WORDSET_BASE_URL = "https://raw.githubusercontent.com/wordset/wordset-dictionary/master/data/";
const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 
                 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'misc'];

async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("vocabDB", 3); 
    request.onupgradeneeded = () => {
      const db = request.result;
      // Delete old store and create new one to clear old data
      if (db.objectStoreNames.contains("vocabStore")) {
        db.deleteObjectStore("vocabStore");
      }
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

async function loadWordsetDictionary() {
  const db = await openDB();

  // 1. Try cached version
  const cached = await getCachedDictionary(db);
  if (cached && Object.keys(cached).length > 1000) {
    return cached;
  }

  // 2. Fetch all letter files from Wordset
  document.querySelector(".vocab__loading").textContent = "Loading full dictionary (one time only)...";
  
  const allWords = {};
  
  for (const letter of LETTERS) {
    try {
      const url = `${WORDSET_BASE_URL}${letter}.json`;
      const res = await fetch(url);
      const data = await res.json();
      Object.assign(allWords, data);
      
      // Show progress
      document.querySelector(".vocab__loading").textContent = 
        `Loading dictionary: ${letter.toUpperCase()} (${Object.keys(allWords).length} words)...`;
    } catch (err) {
      console.error(`Failed to load ${letter}.json:`, err);
    }
  }

  // 3. Save to IndexedDB
  await saveDictionary(db, allWords);

  return allWords;
}

function getRandomMeaning(meanings) {
  return meanings[Math.floor(Math.random() * meanings.length)];
}

function formatDefinition(meaning) {
  let text = meaning.def;
  if (meaning.speech_part) {
    text = `(${meaning.speech_part}) ${text}`;
  }
  return text;
}

async function main() {
  document.querySelector(".vocab__loading").textContent = "Loading word list…";

  let vocabObj;

  try {
    vocabObj = await loadWordsetDictionary();
  } catch (err) {
    document.body.innerHTML = "<p>Failed to load dictionary: " + err + "</p>";
    return;
  }

  console.log("Dictionary loaded:", Object.keys(vocabObj).length, "entries");

  // Convert object → array and extract meaningful entries
  const words = Object.entries(vocabObj)
    .filter(([word, data]) => {
      const isValid = data && data.meanings && data.meanings.length > 0;
      if (!isValid) console.log("Filtered out:", word, data);
      return isValid;
    })
    .map(([word, data]) => {
      const meaning = getRandomMeaning(data.meanings);
      return {
        word: data.word || word,
        definition: formatDefinition(meaning),
        example: meaning.example || "",
        partOfSpeech: meaning.speech_part || ""
      };
    })
    .filter(entry => entry.word && entry.definition);

  console.log("Valid words:", words.length);

  // Check if we have any words
  if (words.length === 0) {
    document.body.innerHTML = "<p>No valid words found in dictionary</p>";
    return;
  }

  // Random word
  const entry = words[Math.floor(Math.random() * words.length)];

  let html = `
    <div class="vocab">
      <h1 class="vocab__word">${entry.word}</h1>
      <hr class="vocab__hr">`;
  
  if (entry.example) {
    // Remove whitespace and emphasize current word
    let passage = entry.example.trim().replace(new RegExp(`(${entry.word}[a-z]*)`, 'gi'), '<em>$1</em>');
    html += `<blockquote class="vocab__passage">&ldquo;${passage}&rdquo;</blockquote>`;
  }
  
  html += `<p class="vocab__definition">${entry.definition}</p>`;
  html += `</div>`;
  
  document.body.innerHTML = html;
}

main();
