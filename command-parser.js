// Sehr einfache, regelbasierte Erkennung von Smart-Home-Befehlen aus freiem Text.
// Erwartet ROOMS und ROOM_ALIASES aus rooms-data.js im globalen Scope.

const CATEGORY_KEYWORDS = {
  shutter: ["store", "storen", "raffstore", "jalousie"],
  marquee: ["markise"],
  curtain: ["vorhang"],
  light: ["licht", "lampe", "leuchte", "dimmer", "beleuchtung"],
  heating: ["heizung", "heizventil", "temperatur"],
  plug: ["steckdose", "stecker"],
};

const ACTION_WORDS = {
  shutter: {
    up: ["auffahren", "auf", "hoch", "rauf", "öffnen", "offen"],
    down: ["runterfahren", "abfahren", "zu", "runter", "schliessen", "schließen", "geschlossen"],
    stop: ["stopp", "stop", "halt"],
  },
  marquee: {
    down: ["ausfahren", "raus"], // Markise ausfahren = Beschattung aktiv
    up: ["einfahren", "rein"],
    stop: ["stopp", "stop", "halt"],
  },
  curtain: {
    up: ["auf", "öffnen", "offen"],
    down: ["zu", "schliessen", "schließen", "geschlossen"],
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
    up: ["wärmer", "höher", "rauf", "hoch"],
    down: ["kälter", "tiefer", "runter"],
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

function findTargetValue(normText) {
  const match = normText.match(/(\d{1,3})\s*(grad|prozent)?/);
  if (!match) return null;
  return { value: parseInt(match[1], 10), unit: match[2] || null };
}

// Ergebnis: { room, floor, category, action, value, raw } oder null-Felder wenn nicht erkannt.
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
