// Regelbasierte Erkennung von Smart-Home-Befehlen aus freiem Text.
// Erwartet ROOMS und ROOM_ALIASES aus rooms-data.js im globalen Scope.

const CATEGORY_KEYWORDS = {
  shutter: ["store", "storen", "raffstore", "jalousie"],
  marquee: ["markise"],
  curtain: ["vorhang"],
  light: ["licht", "lampe", "leuchte", "dimmer", "beleuchtung"],
  heating: ["heizung", "heizventil", "temperatur"],
  plug: ["steckdose", "stecker"],
};

// Aktionen: top/bottom = ganz auf/zu (bzw. einfahren/ausfahren bei Markisen), stop = anhalten.
const ACTION_WORDS = {
  shutter: {
    top: ["auffahren", "auf", "hoch", "rauf", "öffnen", "offen"],
    bottom: ["runterfahren", "abfahren", "zu", "runter", "schliessen", "schließen", "geschlossen"],
    stop: ["stopp", "stop", "halt"],
  },
  marquee: {
    top: ["einfahren", "rein"], // Markise einfahren
    bottom: ["ausfahren", "raus"], // Markise ausfahren
    stop: ["stopp", "stop", "halt"],
  },
  curtain: {
    top: ["auf", "öffnen", "offen"],
    bottom: ["zu", "schliessen", "schließen", "geschlossen"],
    stop: ["stopp", "stop", "halt"],
  },
  light: {
    on: ["an", "ein", "einschalten"],
    off: ["aus", "ausschalten"],
  },
  plug: {
    on: ["an", "ein", "einschalten"],
    off: ["aus", "ausschalten"],
  },
  heating: {
    up: ["wärmer", "höher"],
    down: ["kälter", "tiefer"],
  },
};

function normalize(text) {
  return text.toLowerCase().replace(/[.,!?]/g, "").trim();
}

function findRoom(normText) {
  const candidates = [];
  for (const alias in ROOM_ALIASES) {
    if (normText.includes(alias)) {
      candidates.push({ key: ROOM_ALIASES[alias], matchLength: alias.length });
    }
  }
  for (const key in ROOMS) {
    const needle = key.toLowerCase();
    if (normText.includes(needle)) {
      candidates.push({ key, matchLength: needle.length });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.matchLength - a.matchLength);
  return candidates[0].key;
}

function findCategory(normText) {
  for (const category in CATEGORY_KEYWORDS) {
    for (const word of CATEGORY_KEYWORDS[category]) {
      if (normText.includes(word)) return category;
    }
  }
  return null;
}

function findAction(normText, category) {
  const actions = ACTION_WORDS[category];
  if (!actions) return null;
  for (const action in actions) {
    for (const word of actions[action]) {
      if (new RegExp("\\b" + word + "\\b").test(normText)) {
        return action;
      }
    }
  }
  return null;
}

// Erkennt "<Zahl> Grad" (Heizung) oder "<Zahl> Prozent" (Dimmer).
function findTargetValue(normText) {
  const match = normText.match(/(\d{1,3})\s*(grad|prozent)?/);
  if (!match) return null;
  return { value: parseInt(match[1], 10), unit: match[2] || null };
}

// Ergebnis: { room, floor, category, action, value, unit, matched }
function parseCommand(text) {
  const normText = normalize(text);
  const roomKey = findRoom(normText);
  const category = findCategory(normText);
  const action = category ? findAction(normText, category) : null;
  const target = findTargetValue(normText);

  return {
    raw: text,
    room: roomKey,
    floor: roomKey ? ROOMS[roomKey].floor : null,
    category,
    action,
    value: target ? target.value : null,
    unit: target ? target.unit : null,
    matched: Boolean(roomKey && category && (action || target)),
  };
}
