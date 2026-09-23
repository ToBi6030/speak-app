// Zuordnung Raum+Gerätekategorie -> Adressierung der Smart-Control-Anlage.
// Wird als JSON in localStorage gepflegt (nur im Browser des Nutzers).
//
// Key-Format: "<Raum>|<category>" (category: shutter | marquee | curtain | light | plug | heating)
//
// Storen/Markisen/Vorhang: { button, element }
// Licht/Steckdose:         { button, element, component }  component: "TOGGLE" (Standard) | "ON_OFF" | "DIMMER"
// Heizung:                 { zone }  (controlId der Heizzone)

const MAPPING_STORAGE_KEY = "speak-app.buttonMapping";
const WS_URL_STORAGE_KEY = "speak-app.wsUrl";
const DEFAULT_WS_URL = "wss://vsc1.spline.ch/";

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

  function allHeatingZones() {
    const mapping = load();
    const zones = [];
    for (const key in mapping) {
      if (key.endsWith("|heating") && mapping[key] && typeof mapping[key].zone === "number") {
        zones.push(mapping[key].zone);
      }
    }
    return [...new Set(zones)];
  }

  function loadWsUrl() {
    try {
      return localStorage.getItem(WS_URL_STORAGE_KEY) || DEFAULT_WS_URL;
    } catch (err) {
      return DEFAULT_WS_URL;
    }
  }

  function saveWsUrl(url) {
    localStorage.setItem(WS_URL_STORAGE_KEY, url);
  }

  return { load, save, getEntry, allHeatingZones, loadWsUrl, saveWsUrl };
})();
