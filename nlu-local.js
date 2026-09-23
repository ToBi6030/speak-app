// Lokale Sprachinterpretation: freier Text -> konkrete Datenpunkt-Aktionen.
// Tolerant gegenüber Umlauten, Tippfehlern der Spracherkennung, Synonymen und
// fehlenden Angaben. Fehlende Parameter werden aus dem Gerätekatalog ergänzt;
// ist das Ziel mehrdeutig, wird eine Rückfrage mit Auswahl erzeugt.
//
// Ergebnis:
//   { status: "ok",      actions: [{ deviceId, op, value }], summary }
//   { status: "clarify", question, options: [{ label, actions }] }
//   { status: "unknown", reason }
// op: up | down | stop | on | off | toggle | set | inc | dec

const LocalNLU = (function () {
  function fold(s) {
    return String(s)
      .toLowerCase()
      .replace(/ä/g, "a")
      .replace(/ö/g, "o")
      .replace(/ü/g, "u")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9%°]+/g, " ")
      .trim();
  }

  function tokens(s) {
    return fold(s).split(" ").filter(Boolean);
  }

  function lev(a, b) {
    if (a === b) return 0;
    const m = a.length;
    const n = b.length;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }

  // Wort passt ungefähr (Spracherkennung liefert oft leicht falsche Endungen)
  function near(tok, word) {
    if (tok === word) return true;
    if (word.length < 4 || tok.length < 3) return false;
    const max = word.length >= 8 ? 2 : 1;
    return lev(tok, word) <= max;
  }

  function hasAny(toks, words, fuzzy) {
    return toks.some((t) => words.some((w) => (fuzzy ? near(t, w) : t === w)));
  }

  // --- Vokabular (bereits "gefoldet": ä->a, ö->o, ü->u, ß->ss) ---

  const KIND_WORDS = {
    shutter: ["store", "storen", "stores", "rollladen", "rolladen", "rollo", "jalousie", "jalousien", "raffstore", "raffstoren", "lamellen", "beschattung", "sonnenschutz"],
    marquee: ["markise", "markisen", "sonnenstore", "sonnenstoren"],
    skylight: ["oblicht", "oberlicht", "dachfenster", "lichtkuppel"],
    light: ["licht", "lichter", "lampe", "lampen", "leuchte", "leuchten", "beleuchtung", "dimmer", "spots", "spot", "deckenlicht"],
    plug: ["steckdose", "steckdosen", "stecker"],
    heating: ["heizung", "heizen", "temperatur", "raumtemperatur", "heizventil", "grad", "warmer", "kalter", "kuhler", "kalt", "warm", "heiss", "kuhl"],
    fan: ["luftung", "ventilator", "abluft"],
    scene: ["szene", "lichtszene", "stimmung"],
  };

  const OP_WORDS = {
    up: ["auf", "hoch", "rauf", "offnen", "offne", "offnet", "aufmachen", "hochfahren", "hochziehen", "auffahren", "offen", "einfahren", "rein", "zuruckfahren"],
    down: ["zu", "runter", "herunter", "ab", "schliessen", "schliesse", "zumachen", "runterfahren", "herunterfahren", "abfahren", "ablassen", "geschlossen", "ausfahren", "raus"],
    stop: ["stopp", "stop", "halt", "anhalten", "stoppen"],
    on: ["an", "ein", "einschalten", "anschalten", "anmachen", "anzunden", "hell", "aktivieren", "aktiviere", "aktiv", "starten", "starte", "start"],
    off: ["aus", "ausschalten", "ausmachen", "abschalten", "dunkel", "deaktivieren", "deaktiviere", "beenden", "beende"],
    toggle: ["umschalten", "toggle", "wechseln"],
    inc: ["heller", "warmer", "hoher", "mehr", "erhohen", "aufdrehen"],
    dec: ["dunkler", "kalter", "kuhler", "tiefer", "weniger", "senken", "reduzieren", "runterdrehen", "zudrehen"],
  };

  const ALL_WORDS = ["alle", "allen", "alles", "samtliche", "ganze", "ganzen", "uberall", "komplett"];

  const FLOOR_WORDS = {
    Obergeschoss: ["og", "obergeschoss", "oben", "erster stock", "1 stock", "ersten stock"],
    Erdgeschoss: ["eg", "erdgeschoss", "unten", "parterre"],
    Untergeschoss: ["ug", "untergeschoss", "keller"],
  };

  // Steuerwörter nie als Raum- oder Gerätename interpretieren ("heller" ≠ "Keller")
  const VOCAB = new Set([...Object.values(KIND_WORDS).flat(), ...Object.values(OP_WORDS).flat(), ...ALL_WORDS, "kalt", "warm", "heiss", "kuhl", "stufe", "stufen", "zu", "im", "in", "der", "die", "das", "den", "dem", "bitte", "mach", "mache"]);

  function contentToks(toks) {
    return toks.filter((t) => !VOCAB.has(t));
  }

  // Umgangssprachliche Raumnamen -> Raumname der Anlage (gefoldet)
  const ROOM_ALIASES = {
    wohnzimmer: "wohnen",
    stube: "wohnen",
    wohnraum: "wohnen",
    wohnbereich: "wohnen",
    schlafzimmer: "eltern schlafzimmer",
    elternschlafzimmer: "eltern schlafzimmer",
    elternbad: "eltern bad",
    gang: "korridor",
    flur: "korridor",
    diele: "korridor",
    galerie: "korridor",
    kuche: "kuche",
    buro: "buro",
    arbeitszimmer: "buro",
    heimkino: "kino",
    waschkuche: "waschen",
    waschraum: "waschen",
    gastetoilette: "gaste wc",
    gastewc: "gaste wc",
    balkon: "terrasse",
    sitzplatz: "terrasse",
  };

  // Wörter, die in Elementnamen vorkommen, aber nichts unterscheiden
  const GENERIC_NAME_WORDS = new Set(["raffstore", "heizventil", "gesch", "steckdose", "licht", "schaltkreis", "dimmer", "230v", "popup", "button", "temperatur", "markise", "store"]);

  const NUMBER_WORDS = {
    null: 0, eins: 1, ein: 1, eine: 1, zwei: 2, drei: 3, vier: 4, funf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10,
    elf: 11, zwolf: 12, dreizehn: 13, vierzehn: 14, funfzehn: 15, sechzehn: 16, siebzehn: 17, achtzehn: 18, neunzehn: 19,
    zwanzig: 20, dreissig: 30, vierzig: 40, funfzig: 50, sechzig: 60, siebzig: 70, achtzig: 80, neunzig: 90, hundert: 100,
  };

  function parseNumberWord(t) {
    if (t in NUMBER_WORDS && t !== "ein" && t !== "eine") return NUMBER_WORDS[t];
    const m = t.match(/^(ein|zwei|drei|vier|funf|sechs|sieben|acht|neun)und(zwanzig|dreissig|vierzig|funfzig|sechzig|siebzig|achtzig|neunzig)$/);
    if (m) return NUMBER_WORDS[m[1] === "ein" ? "eins" : m[1]] + NUMBER_WORDS[m[2]];
    return null;
  }

  // Zahl + Einheit (Prozent / Grad) finden
  function findValue(text, toks) {
    let value = null;
    let unit = null;
    const raw = text.replace(/(\d),(\d)/g, "$1.$2").toLowerCase();
    const m = raw.match(/(\d+(?:\.\d+)?)\s*(%|prozent|grad|°)?/);
    if (m) {
      value = parseFloat(m[1]);
      unit = m[2] ? (m[2] === "%" || m[2] === "prozent" ? "percent" : "degree") : null;
    } else {
      for (let i = 0; i < toks.length; i++) {
        const n = parseNumberWord(toks[i]);
        if (n !== null) {
          value = n;
          const next = toks[i + 1] || "";
          if (next === "prozent") unit = "percent";
          else if (next === "grad") unit = "degree";
          break;
        }
      }
    }
    if (value === null && (toks.includes("halb") || toks.includes("halbe") || toks.includes("halben"))) {
      value = 50;
      unit = "percent";
    }
    return { value, unit };
  }

  function detectKinds(toks) {
    const kinds = [];
    for (const kind in KIND_WORDS) {
      if (hasAny(toks, KIND_WORDS[kind], true)) kinds.push(kind);
    }
    // "Licht" steckt auch in "Oblicht"/"Oberlicht" -> Oblicht gewinnt
    if (kinds.includes("skylight")) return kinds.filter((k) => k !== "light");
    // "Grad"/"wärmer" nur als Heizung werten, wenn nichts anderes genannt wurde
    if (kinds.includes("heating") && kinds.length > 1 && !hasAny(toks, ["heizung", "temperatur", "heizventil"], true)) {
      return kinds.filter((k) => k !== "heating");
    }
    return kinds;
  }

  function detectOp(toks) {
    // Reihenfolge: stop vor allem, dann eindeutige Verben, dann kurze Partikel
    const order = ["stop", "toggle", "inc", "dec", "on", "off", "up", "down"];
    const found = [];
    for (const op of order) {
      for (const w of OP_WORDS[op]) {
        const fuzzy = w.length >= 6;
        const idx = toks.findIndex((t) => (fuzzy ? near(t, w) : t === w));
        if (idx >= 0) found.push({ op, idx, len: w.length });
      }
    }
    if (!found.length) return null;
    // längste (spezifischste) Übereinstimmung gewinnt, bei Gleichstand die spätere im Satz
    found.sort((a, b) => b.len - a.len || b.idx - a.idx);
    if (found.some((f) => f.op === "stop")) return "stop";
    return found[0].op;
  }

  function detectFloor(normText, toks) {
    for (const floor in FLOOR_WORDS) {
      for (const w of FLOOR_WORDS[floor]) {
        if (w.includes(" ") ? normText.includes(w) : toks.includes(w)) return floor;
      }
    }
    return null;
  }

  // Raum-Treffer: liefert Menge gefoldeter Raumnamen
  function detectRooms(normText, allToks, devices) {
    const toks = contentToks(allToks);
    // Sammelgruppen ("Storen", "Markisen", "Lichtszenen") sind keine echten Räume
    const roomNames = [...new Set(devices.filter((d) => !d.isGroup && d.kind !== "scene").map((d) => fold(d.room)))];
    const joined = toks.join("");
    const hits = new Map(); // room -> score
    for (const room of roomNames) {
      const rt = room.split(" ");
      const matched = rt.filter((w) => toks.some((t) => near(t, w)));
      let score = matched.length / rt.length;
      if (joined.includes(rt.join(""))) score = Math.max(score, 1);
      // Einzelwort "Bad"/"WC" alleine nur als voller Treffer
      if (score >= 1 || (rt.length > 1 && score >= 0.5 && matched.some((w) => w.length >= 5))) {
        hits.set(room, score + rt.join("").length / 100);
      }
    }
    for (const alias in ROOM_ALIASES) {
      if (toks.some((t) => near(t, alias)) || joined.includes(alias)) {
        const target = ROOM_ALIASES[alias];
        if (roomNames.includes(target)) hits.set(target, Math.max(hits.get(target) || 0, 1.5));
      }
    }
    // "bad" -> alle Bäder
    if (toks.includes("bad") && !hits.size) {
      for (const room of roomNames) if (room.endsWith("bad")) hits.set(room, 1);
    }
    if (!hits.size) return [];
    // Teilwort-Treffer verwerfen, wenn es einen besseren gibt ("eltern bad" vs "eltern schlafzimmer")
    const best = Math.max(...hits.values());
    return [...hits.entries()].filter(([, s]) => s >= Math.floor(best)).map(([r]) => r);
  }

  function nameWords(d) {
    return tokens(d.name).filter((w) => !GENERIC_NAME_WORDS.has(w) && w.length >= 2);
  }

  function matchByName(cands, toks, usedToks) {
    const scored = cands.map((d) => {
      const words = nameWords(d);
      const hit = words.filter((w) => toks.some((t) => !usedToks.has(t) && near(t, w))).length;
      return { d, hit };
    });
    const max = Math.max(0, ...scored.map((s) => s.hit));
    if (max === 0) return null;
    return scored.filter((s) => s.hit === max).map((s) => s.d);
  }

  function opsFor(kind) {
    return {
      shutter: ["up", "down", "stop"],
      skylight: ["up", "down", "stop"],
      marquee: ["up", "down", "stop"],
      light: ["on", "off", "toggle", "set", "inc", "dec"],
      plug: ["on", "off", "toggle"],
      fan: ["on", "off", "toggle"],
      scene: ["on", "toggle"],
      heating: ["set", "inc", "dec"],
      switch: ["on", "off", "toggle"],
      ventilation: ["set", "on", "off", "inc", "dec"],
      mode: ["set"],
      setpoint: ["set", "inc", "dec"],
      reduction: ["on", "off", "set"],
    }[kind] || [];
  }

  // Aktion aus Verb/Wert und Geräteart ableiten (fehlende Angaben ergänzen)
  function resolveOp(kind, op, value, unit, toks) {
    if (kind === "heating") {
      if (value !== null && op !== "inc" && op !== "dec") return { op: "set", value };
      if (op === "inc" || op === "up" || op === "on") return { op: "inc", value: value || 0.5 };
      if (op === "dec" || op === "down" || op === "off") return { op: "dec", value: value || 0.5 };
      return null;
    }
    if (kind === "marquee") {
      // Markise: "öffnen"/"ausfahren"/"raus" = ausfahren (down), "schliessen"/"einfahren" = einfahren (up)
      if (hasAny(toks, ["ausfahren", "raus", "offnen", "auf", "offen"], true)) return { op: "down" };
      if (hasAny(toks, ["einfahren", "rein", "schliessen", "zu", "zuruckfahren"], true)) return { op: "up" };
      if (op === "stop") return { op: "stop" };
      return null;
    }
    if (kind === "shutter" || kind === "skylight") {
      if (op === "on") return { op: "up" };
      if (op === "off") return null;
      if (["up", "down", "stop"].includes(op)) return { op };
      return null;
    }
    if (kind === "light") {
      if (value !== null && unit !== "degree" && (unit === "percent" || !op || op === "up" || op === "set")) {
        return value <= 0 ? { op: "off" } : { op: "set", value: Math.min(100, value) };
      }
      if (op === "up") return { op: "on" };
      if (op === "down") return { op: "off" };
      if (["on", "off", "toggle", "inc", "dec"].includes(op)) return { op, value: op === "inc" || op === "dec" ? value || 20 : undefined };
      return { op: "toggle" }; // "Licht Küche" -> umschalten
    }
    if (kind === "plug" || kind === "fan") {
      if (op === "up") return { op: "on" };
      if (op === "down") return { op: "off" };
      if (["on", "off", "toggle"].includes(op)) return { op };
      return { op: "toggle" };
    }
    if (kind === "scene") return { op: "on" };
    return null;
  }

  function kindFromOp(op, value, unit) {
    if (unit === "degree") return ["heating"];
    if (unit === "percent") return ["light"];
    if (op === "up" || op === "down" || op === "stop") return ["shutter", "skylight", "marquee"];
    if (op === "on" || op === "off" || op === "toggle") return ["light", "plug", "fan"];
    if (op === "inc" || op === "dec") return ["light", "heating"];
    return [];
  }

  const KIND_LABEL = {
    shutter: "Store",
    skylight: "Oblicht",
    marquee: "Markise",
    light: "Licht",
    plug: "Steckdose",
    fan: "Lüftung",
    scene: "Szene",
    heating: "Heizung",
    switch: "Schalter",
    ventilation: "Lüftung",
    mode: "Modus",
    setpoint: "Sollwert",
    reduction: "Heizungsabsenkung",
  };

  const OP_LABEL = {
    up: "hoch/öffnen",
    down: "runter/schliessen",
    stop: "stoppen",
    on: "ein",
    off: "aus",
    toggle: "umschalten",
    set: "setzen",
    inc: "erhöhen",
    dec: "verringern",
  };

  function describe(action, devices) {
    const d = devices.find((x) => x.id === action.deviceId);
    let what = OP_LABEL[action.op] || action.op;
    if (d && d.kind === "marquee") what = { up: "einfahren", down: "ausfahren", stop: "stoppen" }[action.op] || what;
    if (action.op === "set") what = d && d.kind === "heating" ? "auf " + action.value + " °C" : "auf " + action.value + " %";
    if ((action.op === "inc" || action.op === "dec") && d && d.kind === "heating") what = (action.op === "inc" ? "+" : "−") + action.value + " °C";
    if (d && (d.kind === "ventilation" || d.kind === "mode")) {
      const st = (d.steps || []).find((x) => x.value === action.value);
      if (action.op === "set") what = d.kind === "ventilation" ? "Stufe " + (st ? st.name : action.value) : (st ? st.name : action.value);
      if (action.op === "inc") what = "Stufe höher";
      if (action.op === "dec") what = "Stufe tiefer";
    }
    if (d && d.kind === "setpoint") {
      if (action.op === "set") what = "auf " + action.value + " " + (d.unit || "");
      else what = (action.op === "inc" ? "+" : "−") + (action.value || 1) + " " + (d.unit || "");
    }
    if (d && d.kind === "reduction") {
      what = action.op === "off" ? "aus" : "ein" + (action.value ? " (automatisch aus nach " + action.value + " Tag" + (action.value > 1 ? "en" : "") + ")" : "");
    }
    return (d ? DeviceCatalog.label(d) : "?") + ": " + what;
  }

  // --- Zentrale Funktionen (Allgemein): Absenkung, Simulation, Heiz-/Kühlbetrieb, Lüftung, Sauna ---

  const SPECIAL_KINDS = new Set(["switch", "ventilation", "mode", "setpoint", "reduction"]);

  const W = {
    reduction: ["absenkung", "heizungsabsenkung", "ferienmodus", "ferien", "urlaub", "urlaubsmodus", "abwesend"],
    simulation: ["simulation", "anwesenheitssimulation"],
    heatMode: ["heizbetrieb", "heizmodus"],
    coolMode: ["kuhlbetrieb", "kuhlmodus", "kuhlung"],
    ventilation: ["luftung", "luften", "ventilation", "luftungsstufe", "komfortluftung"],
    sauna: ["sauna"],
    sanarium: ["sanarium"],
    humidity: ["feuchte", "feuchtigkeit", "luftfeuchte"],
    bathTime: ["badezeit", "dauer", "minuten"],
  };
  const MORE = ["hoher", "mehr", "starker", "erhohen", "schneller", "plus", "hoch", "rauf"];
  const LESS = ["tiefer", "weniger", "schwacher", "reduzieren", "langsamer", "minus", "runter", "senken"];
  const MAX = ["maximal", "maximum", "max", "voll", "volle", "hochste", "starkste"];
  const ROMAN = { "0": 0, i: 1, ii: 2, iii: 3, iv: 4, "1": 1, "2": 2, "3": 3, "4": 4 };

  function findDays(text, toks) {
    const i = toks.findIndex((t) => /^tag(e|en)?$/.test(t) || t === "woche" || t === "wochen");
    if (i < 1) return null;
    const prev = toks[i - 1];
    let n = /^\d+$/.test(prev) ? parseInt(prev, 10) : parseNumberWord(prev);
    if (n === null && (prev === "ein" || prev === "einen" || prev === "eine")) n = 1;
    if (n === null) return null;
    return toks[i].startsWith("woche") ? n * 7 : n;
  }

  function stepByLevel(d, level) {
    const steps = d.steps || [];
    return steps.find((s) => ROMAN[fold(s.name)] === level) || steps[level] || null;
  }

  function stepFromText(d, toks, value) {
    const steps = d.steps || [];
    // Stufenname direkt genannt ("Sanarium", "Stufe II")
    const byName = steps.find((s) => fold(s.name).length > 2 && toks.some((t) => near(t, fold(s.name))));
    if (byName) return byName;
    const roman = toks.find((t) => ["i", "ii", "iii", "iv"].includes(t));
    if (roman) return stepByLevel(d, ROMAN[roman]);
    if (value !== null) return stepByLevel(d, Math.round(value));
    return null;
  }

  function parseSpecial(text, toks, devices, value, unit, op) {
    const has = (words) => hasAny(toks, words, true);
    const find = (pred) => devices.find(pred) || null;
    const onOff = () => (op === "off" || op === "stop" || op === "down" ? "off" : op === "on" || op === "up" ? "on" : null);

    // Heizungsabsenkung (Ferien)
    if (has(W.reduction) && !has(W.simulation)) {
      const d = find((x) => x.kind === "reduction");
      if (d) {
        const days = findDays(text, toks);
        let o = onOff();
        if (!o && days) o = "on";
        if (!o) return clarify("Heizungsabsenkung:", [
          { label: "Einschalten", actions: [{ deviceId: d.id, op: "on" }] },
          { label: "Ausschalten", actions: [{ deviceId: d.id, op: "off" }] },
        ], devices);
        return ok([{ deviceId: d.id, op: o, value: o === "on" && days ? days : undefined }], devices);
      }
    }

    // Anwesenheitssimulation, Heiz-/Kühlbetrieb (Schalter mit Zustand)
    const switchTargets = [
      [W.simulation, /simulation/i, "Anwesenheitssimulation"],
      [W.heatMode, /heizbetrieb/i, "Heizbetrieb"],
      [W.coolMode, /k(ü|ue)hlbetrieb/i, "Kühlbetrieb"],
    ];
    for (const [words, re, label] of switchTargets) {
      if (!has(words)) continue;
      const d = find((x) => x.kind === "switch" && (re.test(x.name) || re.test(x.group)));
      if (!d) continue;
      const o = onOff() || (op === "toggle" ? "toggle" : null);
      if (!o) return clarify(label + ":", [
        { label: "Einschalten", actions: [{ deviceId: d.id, op: "on" }] },
        { label: "Ausschalten", actions: [{ deviceId: d.id, op: "off" }] },
      ], devices);
      return ok([{ deviceId: d.id, op: o }], devices);
    }

    // Sauna / Sanarium
    if (has(W.sauna) || has(W.sanarium)) {
      const mode = find((x) => x.kind === "mode" && /sauna/i.test(x.group));
      const sp = (re) => find((x) => x.kind === "setpoint" && /sauna/i.test(x.group) && re.test(x.name));
      if (value !== null && unit !== "percent" && !has(W.humidity) && !has(W.bathTime)) {
        const d = has(W.sanarium) ? sp(/sanarium/i) : sp(/^sauna$/i);
        if (d) return ok([{ deviceId: d.id, op: "set", value }], devices);
      }
      if (value !== null && has(W.humidity)) {
        const d = sp(/feuchte/i);
        if (d) return ok([{ deviceId: d.id, op: "set", value }], devices);
      }
      if (value !== null && has(W.bathTime)) {
        const d = sp(/badezeit/i);
        if (d) return ok([{ deviceId: d.id, op: "set", value }], devices);
      }
      if (mode) {
        const o = onOff();
        let st = null;
        if (o === "off") st = (mode.steps || []).find((s) => /aus/i.test(s.name)) || (mode.steps || [])[0];
        else if (has(W.sanarium)) st = (mode.steps || []).find((s) => /sanarium/i.test(s.name));
        else if (o === "on") st = (mode.steps || []).find((s) => /^sauna$/i.test(s.name));
        if (st) return ok([{ deviceId: mode.id, op: "set", value: st.value }], devices);
        return clarify("Sauna:", (mode.steps || []).map((s) => ({ label: s.name, actions: [{ deviceId: mode.id, op: "set", value: s.value }] })), devices);
      }
    }

    // Lüftung (zentrale Stufen-Lüftung). "Lüftung Vorrat" etc. läuft über die normale Raumlogik.
    const roomNamed = detectRooms(fold(text), toks, devices.filter((x) => !SPECIAL_KINDS.has(x.kind))).length > 0;
    if (has(W.ventilation) && !roomNamed) {
      const d = find((x) => x.kind === "ventilation");
      if (d) {
        const steps = d.steps || [];
        if (hasAny(toks, MAX, true) && steps.length) return ok([{ deviceId: d.id, op: "set", value: steps[steps.length - 1].value }], devices);
        const st = stepFromText(d, toks, unit === "degree" ? null : value);
        if (st) return ok([{ deviceId: d.id, op: "set", value: st.value }], devices);
        if (op === "inc" || hasAny(toks, MORE, false)) return ok([{ deviceId: d.id, op: "inc" }], devices);
        if (op === "dec" || hasAny(toks, LESS, false)) return ok([{ deviceId: d.id, op: "dec" }], devices);
        if (op === "off") return ok([{ deviceId: d.id, op: "off" }], devices);
        if (op === "on") return ok([{ deviceId: d.id, op: "on" }], devices);
        return clarify("Lüftung: welche Stufe?", steps.map((s) => ({ label: "Stufe " + s.name, actions: [{ deviceId: d.id, op: "set", value: s.value }] })), devices);
      }
    }
    return null;
  }

  function parse(text, allDevices) {
    const normText = fold(text);
    const toks = tokens(text);
    if (!toks.length) return { status: "unknown", reason: "Kein Text." };

    const { value, unit } = findValue(text, toks);
    let op = detectOp(toks);

    const special = parseSpecial(text, toks, allDevices, value, unit, op);
    if (special) return special;
    // Ab hier nur noch die raumbezogenen Geräte (Licht, Storen, Heizung, …)
    const devices = allDevices.filter((d) => !SPECIAL_KINDS.has(d.kind));
    // "es ist zu kalt" -> wärmer, "zu warm" -> kälter
    const zi = toks.indexOf("zu");
    if (zi >= 0 && ["kalt", "kuhl"].includes(toks[zi + 1])) op = "inc";
    if (zi >= 0 && ["warm", "heiss"].includes(toks[zi + 1])) op = "dec";
    let kinds = detectKinds(toks);
    const floor = detectFloor(normText, toks);
    const wantsAll = hasAny(toks, ALL_WORDS, false);
    const rooms = detectRooms(normText, toks, devices);

    // Szenen direkt über ihren Namen ("Heimkommen", "Alles aus")
    const scenes = devices.filter((d) => d.kind === "scene");
    const sceneToks = toks.filter((t) => !ALL_WORDS.includes(t) || toks.length <= 2 || t === "alles");
    let sceneHit = matchByName(scenes, sceneToks, new Set());
    // Nur "aus"/"an" alleine reicht nicht für eine Szene ("Alles Aus" braucht "alles")
    const OPS_FLAT = new Set(Object.values(OP_WORDS).flat());
    if (sceneHit) sceneHit = sceneHit.filter((d) => nameWords(d).some((w) => !OPS_FLAT.has(w) && sceneToks.some((t) => near(t, w))));
    if (sceneHit && sceneHit.length === 1 && !rooms.length && (!kinds.length || kinds.includes("scene"))) {
      return ok([{ deviceId: sceneHit[0].id, op: "on" }], devices);
    }

    if (!kinds.length) kinds = kindFromOp(op, value, unit);

    // Kandidaten eingrenzen
    let cands = devices.filter((d) => kinds.length === 0 || kinds.includes(d.kind));
    cands = cands.filter((d) => d.kind !== "scene" || kinds.includes("scene"));

    const roomCands = rooms.length ? cands.filter((d) => rooms.includes(fold(d.room)) && !d.isGroup) : [];

    // Sammel-Storen: "alle Storen (im OG)" ohne Raum
    if (!rooms.length && wantsAll && (kinds.includes("shutter") || kinds.includes("marquee"))) {
      const kind = kinds.includes("marquee") && !kinds.includes("shutter") ? "marquee" : "shutter";
      const grp = devices.find((d) => d.isGroup && d.kind === kind && d.name === (floor === "Obergeschoss" ? "OG" : floor === "Erdgeschoss" ? "EG" : "Alle"));
      if (grp) {
        const r = resolveOp(kind, op, value, unit, toks);
        if (!r) return askOp(kind, [grp], devices);
        return ok([{ deviceId: grp.id, ...r }], devices);
      }
    }

    if (rooms.length) cands = roomCands;
    else cands = cands.filter((d) => !d.isGroup);

    if (floor) {
      const onFloor = cands.filter((d) => d.floor === floor);
      if (onFloor.length) cands = onFloor;
    }

    // Elementname ("Lounge", "Esstisch", "links", "Ankleide") eingrenzen
    const roomToks = new Set(toks.filter((t) => rooms.some((r) => r.split(" ").some((w) => near(t, w)))));
    const byName = matchByName(cands.length ? cands : devices.filter((d) => kinds.length === 0 || kinds.includes(d.kind)), contentToks(toks), roomToks);
    if (byName && (!rooms.length || byName.every((d) => rooms.includes(fold(d.room))))) cands = byName;

    // "Alles"-Sammelelemente nur verwenden, wenn ausdrücklich genannt
    const explicitAlles = byName && byName.some((d) => /^alle?s?$/i.test(d.name));
    if (!explicitAlles) cands = cands.filter((d) => !/^alle?s?$/i.test(d.name) || d.isGroup);

    if (!kinds.length && !rooms.length && !op && value === null && !byName) {
      return { status: "unknown", reason: "Kein Smart-Home-Befehl erkannt." };
    }

    if (!cands.length) {
      if (!kinds.length && !rooms.length) return { status: "unknown", reason: "Weder Gerät noch Raum erkannt." };
      if (rooms.length && kinds.length) return { status: "unknown", reason: "Im Raum " + rooms.map((r) => (devices.find((d) => fold(d.room) === r) || { room: r }).room).join(", ") + " gibt es kein Gerät vom Typ " + (KIND_LABEL[kinds[0]] || "?") + "." };
      return { status: "unknown", reason: "Kein passendes Gerät gefunden." };
    }

    // Kein Raum genannt, mehrere Räume möglich -> nachfragen
    const distinctRooms = [...new Set(cands.map((d) => d.floor + "|" + d.room))];

    // Mehrere Gerätearten im Raum (z. B. nur "Wohnen öffnen") -> Art aus Verb bestimmen
    const cKinds = [...new Set(cands.map((d) => d.kind))];
    if (cKinds.length > 1) {
      const pref = kindFromOp(op, value, unit).filter((k) => cKinds.includes(k));
      if (pref.length) {
        const pk = pref.find((k) => cands.some((d) => d.kind === k));
        cands = cands.filter((d) => d.kind === pk);
      }
    }

    const kind = cands[0].kind;
    const sameKind = cands.every((d) => d.kind === kind);
    if (!sameKind) {
      return clarify(
        "Was genau soll gesteuert werden?",
        cands.slice(0, 8).map((d) => {
          const r = resolveOp(d.kind, op, value, unit, toks);
          return r ? { label: DeviceCatalog.label(d), actions: [{ deviceId: d.id, ...r }] } : null;
        }).filter(Boolean),
        devices
      );
    }

    const r = resolveOp(kind, op, value, unit, toks);
    if (!r) return askOp(kind, cands, devices);

    if (cands.length === 1 || wantsAll) {
      return ok(cands.map((d) => ({ deviceId: d.id, ...r })), devices);
    }

    // Mehrere Kandidaten -> Rückfrage: alle oder welche?
    const where = distinctRooms.length === 1 ? " im Raum " + cands[0].room : "";
    const options = [];
    options.push({ label: "Alle " + cands.length + where, actions: cands.map((d) => ({ deviceId: d.id, ...r })) });
    for (const d of cands.slice(0, 10)) {
      options.push({ label: DeviceCatalog.label(d), actions: [{ deviceId: d.id, ...r }] });
    }
    const q = distinctRooms.length === 1
      ? "Im Raum " + cands[0].room + " gibt es " + cands.length + " × " + KIND_LABEL[kind] + ". Alle oder welche?"
      : KIND_LABEL[kind] + " in welchem Raum?";
    return clarify(q, options, devices);
  }

  function askOp(kind, cands, devices) {
    const ops = kind === "marquee"
      ? [["down", "Ausfahren"], ["up", "Einfahren"], ["stop", "Stopp"]]
      : kind === "heating"
        ? [["inc", "Wärmer (+0.5 °C)"], ["dec", "Kälter (−0.5 °C)"]]
        : [["up", "Hoch / öffnen"], ["down", "Runter / schliessen"], ["stop", "Stopp"]];
    return clarify(
      (cands.length === 1 ? DeviceCatalog.label(cands[0]) : KIND_LABEL[kind] + " (" + cands.length + ")") + ": was soll passieren?",
      ops.map(([op, label]) => ({ label, actions: cands.map((d) => ({ deviceId: d.id, op, value: kind === "heating" ? 0.5 : undefined })) })),
      devices
    );
  }

  function ok(actions, devices) {
    return { status: "ok", actions, summary: actions.map((a) => describe(a, devices)).join("\n") };
  }

  function clarify(question, options, devices) {
    if (options.length === 1) return ok(options[0].actions, devices);
    // Gleichlautende Optionen durchnummerieren ("Raffstore 1", "Raffstore 2")
    const count = {};
    for (const o of options) count[o.label] = (count[o.label] || 0) + 1;
    const seen = {};
    for (const o of options) {
      if (count[o.label] > 1) {
        seen[o.label] = (seen[o.label] || 0) + 1;
        o.label = o.label + " " + seen[o.label];
      }
    }
    return { status: "clarify", question, options };
  }

  return { parse, describe, fold, opsFor };
})();

if (typeof module !== "undefined") module.exports = LocalNLU;
