// Raum-/Geräte-Daten, abgeleitet aus der Smart-Control-Projektdatei (Demo_Config_07_ts.sco).
// category: shutter | marquee | curtain | light | heating | plug
const ROOMS = {
  "Lüftung": { floor: "Allgemein", devices: [{ name: "Lueftung", category: "light" }] },
  "Gästezimmer": {
    floor: "Obergeschoss",
    devices: [
      { name: "Dimmer 230V", category: "light" },
      { name: "Raffstore", category: "shutter" },
      { name: "Heizventil", category: "heating" },
      { name: "gesch. Steckdose", category: "plug" },
    ],
  },
  "Eltern-Bad": {
    floor: "Obergeschoss",
    devices: [
      { name: "Dusche", category: "light" },
      { name: "Spiegel", category: "light" },
      { name: "Bad", category: "light" },
      { name: "WC", category: "light" },
      { name: "Raffstore", category: "shutter" },
      { name: "Heizventil", category: "heating" },
      { name: "Licht-Schaltkreis", category: "light" },
    ],
  },
  "Eltern Schlafzimmer": {
    floor: "Obergeschoss",
    devices: [
      { name: "Schlafen", category: "light" },
      { name: "Ankleide", category: "light" },
      { name: "gesch. Steckdose", category: "plug" },
      { name: "Ankleide", category: "shutter" },
      { name: "Schlafen", category: "shutter" },
      { name: "Heizventil", category: "heating" },
    ],
  },
  "Gästebad": {
    floor: "Obergeschoss",
    devices: [
      { name: "Bad", category: "light" },
      { name: "Heizventil", category: "heating" },
      { name: "Raffstore", category: "shutter" },
    ],
  },
  "Korridor Obergeschoss": {
    floor: "Obergeschoss",
    devices: [
      { name: "Korridor", category: "light" },
      { name: "Raffstore", category: "shutter" },
      { name: "Heizventil", category: "heating" },
    ],
  },
  "Terrasse Obergeschoss": {
    floor: "Obergeschoss",
    devices: [
      { name: "Terrasse", category: "light" },
      { name: "Markise", category: "marquee" },
    ],
  },
  "Wohnen": {
    floor: "Erdgeschoss",
    devices: [
      { name: "Lounge", category: "light" },
      { name: "Stehleuchte", category: "plug" },
      { name: "gesch. Steckdose", category: "plug" },
      { name: "Raffstore links", category: "shutter" },
      { name: "Heizventil", category: "heating" },
    ],
  },
  "Kino": {
    floor: "Erdgeschoss",
    devices: [
      { name: "Dimmer 230V", category: "light" },
      { name: "gesch. Steckdose", category: "plug" },
      { name: "Raffstore", category: "shutter" },
      { name: "Heizventil", category: "heating" },
      { name: "Vorhang", category: "curtain" },
    ],
  },
  "Büro": {
    floor: "Erdgeschoss",
    devices: [
      { name: "Dimmer 230V", category: "light" },
      { name: "gesch. Steckdose", category: "plug" },
      { name: "Raffstore", category: "shutter" },
      { name: "Heizventil", category: "heating" },
    ],
  },
  "Garage": {
    floor: "Erdgeschoss",
    devices: [
      { name: "Garage", category: "light" },
      { name: "gesch. Steckdose", category: "plug" },
    ],
  },
  "Eingang": { floor: "Erdgeschoss", devices: [{ name: "Eingang", category: "light" }] },
  "Gäste WC": {
    floor: "Erdgeschoss",
    devices: [
      { name: "Gäste-WC", category: "light" },
      { name: "Heizventil", category: "heating" },
    ],
  },
  "Pool": { floor: "Erdgeschoss", devices: [{ name: "Pool", category: "light" }] },
  "Küche": {
    floor: "Erdgeschoss",
    devices: [
      { name: "Kochinsel", category: "light" },
      { name: "Store", category: "shutter" },
      { name: "Untersicht", category: "light" },
      { name: "Esstisch", category: "light" },
    ],
  },
  "Terrasse Erdgeschoss": {
    floor: "Erdgeschoss",
    devices: [
      { name: "Markise", category: "marquee" },
      { name: "Licht-Schaltkreis", category: "light" },
    ],
  },
  "Vorrat": {
    floor: "Erdgeschoss",
    devices: [
      { name: "Vorrat", category: "light" },
      { name: "Heizventil", category: "heating" },
    ],
  },
  "Hobbyraum": {
    floor: "Untergeschoss",
    devices: [
      { name: "Hobbyraum", category: "light" },
      { name: "WC", category: "light" },
      { name: "Heizventil", category: "heating" },
      { name: "Raffstore", category: "shutter" },
    ],
  },
  "Keller": {
    floor: "Untergeschoss",
    devices: [
      { name: "Licht-Schaltkreis", category: "light" },
      { name: "Heizventil", category: "heating" },
      { name: "Raffstore", category: "shutter" },
    ],
  },
  "Pool Technik": {
    floor: "Untergeschoss",
    devices: [
      { name: "Licht-Schaltkreis", category: "light" },
      { name: "Heizventil", category: "heating" },
    ],
  },
  "Waschen": {
    floor: "Untergeschoss",
    devices: [
      { name: "Licht-Schaltkreis", category: "light" },
      { name: "Heizventil", category: "heating" },
    ],
  },
  "Musikraum": {
    floor: "Untergeschoss",
    devices: [
      { name: "Wand", category: "light" },
      { name: "Decke", category: "light" },
      { name: "gesch. Steckdose", category: "plug" },
      { name: "Heizventil", category: "heating" },
      { name: "Raffstore", category: "shutter" },
    ],
  },
  "Technik": {
    floor: "Untergeschoss",
    devices: [
      { name: "Heizventil", category: "heating" },
      { name: "Decke", category: "light" },
    ],
  },
  "WC Untergeschoss": {
    floor: "Untergeschoss",
    devices: [
      { name: "Decke", category: "light" },
      { name: "Heizventil", category: "heating" },
    ],
  },
};

// Sprach-Alias -> Raumschlüssel (für Räume, deren Name pro Etage doppelt vorkommt
// oder die man kürzer ansprechen möchte).
const ROOM_ALIASES = {
  "korridor oben": "Korridor Obergeschoss",
  "korridor obergeschoss": "Korridor Obergeschoss",
  "terrasse oben": "Terrasse Obergeschoss",
  "terrasse obergeschoss": "Terrasse Obergeschoss",
  "terrasse unten": "Terrasse Erdgeschoss",
  "terrasse erdgeschoss": "Terrasse Erdgeschoss",
  "wc unten": "WC Untergeschoss",
  "wc untergeschoss": "WC Untergeschoss",
  "wohnzimmer": "Wohnen",
  "büro": "Büro",
};
