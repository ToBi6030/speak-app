// Zuordnung Raum+Gerätekategorie -> button/element der Smart-Control-Anlage.
// Wird als JSON in localStorage gepflegt (nur im Browser des Nutzers, nicht öffentlich sichtbar).
// Key-Format: "<Raum>|<category>" (category: shutter | marquee | curtain)

const MAPPING_STORAGE_KEY = "speak-app.buttonMapping";
const WS_URL_STORAGE_KEY = "speak-app.wsUrl";

const DEFAULT_MAPPING = {
  "Küche|shutter": { button: 63, element: 1 },
};

const MappingStore = (function () {
  function load() {
    try {
      const raw = localStorage.getItem(MAPPING_STORAGE_KEY);
      if (!raw) return { ...DEFAULT_MAPPING };
      return JSON.parse(raw);
    } catch (err) {
      return { ...DEFAULT_MAPPING };
    }
  }

  function save(mapping) {
    localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(mapping, null, 2));
  }

  function getEntry(room, category) {
    const mapping = load();
    return mapping[room + "|" + category] || null;
  }

  function loadWsUrl() {
    try {
      return localStorage.getItem(WS_URL_STORAGE_KEY) || "";
    } catch (err) {
      return "";
    }
  }

  function saveWsUrl(url) {
    localStorage.setItem(WS_URL_STORAGE_KEY, url);
  }

  return { load, save, getEntry, loadWsUrl, saveWsUrl };
})();
