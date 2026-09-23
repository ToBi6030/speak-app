// Gerätekatalog: wird automatisch aus der Projektkonfiguration der Anlage geladen
// (scConfig.js der Visu). Damit sind Button-/Element-Kanal, Komponente und
// Heizzone für jeden Datenpunkt bekannt – keine manuelle Zuordnung nötig.

const DeviceCatalog = (function () {
  const CONFIG_URL = "https://vsc1.spline.ch/designs/design/ressources/data/scConfig.js";

  let devices = [];
  let loaded = false;

  // Datenpunkt-Typ der Visu -> interne Geräteart
  function kindOf(button, element) {
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
        if (comp === "BINARY_TOGGLE") return "scene";
        return null;
      default:
        return null; // Messwerte, Sicherheit, Kameras usw. werden nicht gesteuert
    }
  }

  function build(config) {
    const list = [];
    for (const area of config.areas || []) {
      for (const room of area.rooms || []) {
        for (const button of room.buttons || []) {
          for (const element of button.elements || []) {
            const kind = kindOf(button, element);
            if (!kind) continue;
            const isGroup = area.name === "Allgemein" && (kind === "shutter" || kind === "marquee");
            list.push({
              id: list.length,
              floor: area.name,
              room: room.name,
              group: button.name,
              name: element.name || button.name,
              kind,
              type: button.type,
              component: element.component || "",
              button: button.channel,
              element: element.channel,
              zone: typeof element.controlId === "number" ? element.controlId : null,
              isGroup, // "Alle" / "OG" / "EG" Sammelsteuerung
            });
          }
        }
      }
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
    return d.isGroup ? "Alle Storen/Markisen " + d.name : room + " – " + d.name;
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
