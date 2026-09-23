// Gerätekatalog: wird automatisch aus der Projektkonfiguration der Anlage geladen
// (scConfig.js der Visu). Damit sind Button-/Element-Kanal, Komponente und
// Heizzone für jeden Datenpunkt bekannt – keine manuelle Zuordnung nötig.

const DeviceCatalog = (function () {
  const CONFIG_URL = "https://vsc1.spline.ch/designs/design/ressources/data/scConfig.js";

  let devices = [];
  let loaded = false;

  // Datenpunkt-Typ der Visu -> interne Geräteart
  function kindOf(button, element, roomName) {
    const comp = element.component || "";
    switch (button.type) {
      case "SHUTTER":
        return "shutter";
      case "MARQUEE":
        return "marquee";
      case "SKYLIGHT":
        return "skylight";
      case "LIGHT":
        return "light";
      case "POWER_SOCKET":
        return "plug";
      case "FAN":
        return "fan";
      case "TEMPERATURE":
        return comp === "CONTROL_RELATIVE" && typeof element.controlId === "number" ? "heating" : null;
      case "GENERIC":
        if (comp === "MOTOR_IN_OUT") return "marquee";
        if (comp === "MOTOR_ARROWS") return "shutter";
        // Lichtszenen = Szenen; übrige Taster (Anwesenheitssimulation, Heiz-/Kühlbetrieb) = Schalter mit Zustand
        if (comp === "BINARY_TOGGLE") return /szene/i.test(button.name) || /szene/i.test(roomName) ? "scene" : "switch";
        if (comp === "ANALOG_STEPS") return /l(ü|ue|u)ftung/i.test(button.name) ? "ventilation" : "mode";
        if (comp === "CONTROL_ABSOLUTE" && typeof element.controlId === "number") return "setpoint";
        return null;
      default:
        return null; // Messwerte, Sicherheit, Kameras usw. werden nicht gesteuert
    }
  }

  function build(config) {
    const list = [];
    for (const area of config.areas || []) {
      for (const room of area.rooms || []) {
        // Buttons können direkt im Raum oder in Gruppen (z. B. "Ferien", "Heizung") liegen
        const buttons = [...(room.buttons || [])];
        for (const g of room.groups || []) buttons.push(...(g.buttons || []));
        for (const button of buttons) {
          if (button.type === "AV_DEVICE" && button.key) {
            list.push({
              id: list.length, floor: area.name, room: room.name, group: button.name, name: button.name || room.name,
              kind: "music", type: button.type, component: "", button: null, element: null, zone: null, isGroup: false,
              key: button.key,
            });
            continue;
          }
          if (button.type === "HEATING_REDUCTION") {
            list.push({
              id: list.length, floor: area.name, room: room.name, group: button.name, name: button.name || "Heizungsabsenkung",
              kind: "reduction", type: button.type, component: "", button: null, element: null, zone: null, isGroup: false,
            });
            continue;
          }
          for (const element of button.elements || []) {
            const kind = kindOf(button, element, room.name);
            if (!kind) continue;
            const isGroup = area.name === "Allgemein" && (kind === "shutter" || kind === "marquee");
            list.push({
              id: list.length,
              floor: area.name,
              room: room.name,
              group: button.name,
              name: element.name && !/^popup-button/i.test(element.name) ? element.name : button.name,
              kind,
              type: button.type,
              component: element.component || "",
              button: button.channel,
              element: element.channel,
              zone: typeof element.controlId === "number" ? element.controlId : null,
              isGroup, // "Alle" / "OG" / "EG" Sammelsteuerung
              steps: Array.isArray(element.values) ? element.values.map((v) => ({ name: String(v.name), value: v.value })) : null,
              min: typeof element.min === "number" ? element.min : null,
              max: typeof element.max === "number" ? element.max : null,
              unit: element.unit || "",
            });
          }
        }
      }
    }
    if ((config.modules || []).includes("SECURITY")) {
      list.push({
        id: list.length, floor: "Allgemein", room: "Sicherheit", group: "Sicherheit", name: "Alarmanlage",
        kind: "security", type: "SECURITY", component: "", button: null, element: null, zone: null, isGroup: false,
      });
    }
    return list;
  }

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = url + "?t=" + Date.now();
      s.onload = resolve;
      s.onerror = () => reject(new Error("Konfiguration nicht ladbar"));
      document.head.appendChild(s);
    });
  }

  async function load() {
    await loadScript(CONFIG_URL);
    if (typeof window.scConfig !== "object") throw new Error("scConfig fehlt");
    devices = build(window.scConfig);
    loaded = true;
    return devices;
  }

  function setDevices(list) {
    devices = list;
    loaded = true;
  }

  function label(d) {
    const dupRoom = devices.some((o) => o.room === d.room && o.floor !== d.floor);
    const room = dupRoom ? d.room + " " + floorShort(d.floor) : d.room;
    if (d.isGroup) return "Alle Storen/Markisen " + d.name;
    if (d.kind === "music") return "Musik " + room;
    if (!d.name || d.name === d.room) return room;
    if (d.kind === "reduction" || d.kind === "switch" || d.kind === "security") return d.name;
    return room + " – " + d.name;
  }

  function floorShort(floor) {
    return { Obergeschoss: "OG", Erdgeschoss: "EG", Untergeschoss: "UG", Allgemein: "" }[floor] || floor;
  }

  return {
    load,
    setDevices,
    build,
    label,
    floorShort,
    all: () => devices,
    isLoaded: () => loaded,
    byId: (id) => devices.find((d) => d.id === id) || null,
    heatingZones: () => [...new Set(devices.filter((d) => d.kind === "heating").map((d) => d.zone))],
  };
})();

if (typeof module !== "undefined") module.exports = DeviceCatalog;
