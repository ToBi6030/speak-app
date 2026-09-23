// KI-Fallback über die Claude API: wird nur genutzt, wenn die lokale Erkennung
// nichts Eindeutiges findet und in den Einstellungen ein API-Key hinterlegt ist.
// Der Key bleibt ausschliesslich im localStorage dieses Browsers.

const LlmNLU = (function () {
  const KEY_STORAGE = "speak-app.claudeApiKey";
  const MODEL_STORAGE = "speak-app.claudeModel";
  const DEFAULT_MODEL = "claude-haiku-4-5";

  function getKey() {
    try { return localStorage.getItem(KEY_STORAGE) || ""; } catch (e) { return ""; }
  }
  function setKey(k) {
    try { k ? localStorage.setItem(KEY_STORAGE, k) : localStorage.removeItem(KEY_STORAGE); } catch (e) { /* ignore */ }
  }
  function getModel() {
    try { return localStorage.getItem(MODEL_STORAGE) || DEFAULT_MODEL; } catch (e) { return DEFAULT_MODEL; }
  }
  function setModel(m) {
    try { localStorage.setItem(MODEL_STORAGE, m || DEFAULT_MODEL); } catch (e) { /* ignore */ }
  }
  function isEnabled() {
    return Boolean(getKey());
  }

  function catalogText(devices) {
    return devices
      .map((d) => {
        let extra = "";
        if (d.steps) extra = " | set-Werte: " + d.steps.map((s) => s.value + "=" + s.name).join(", ");
        if (d.kind === "setpoint") extra = " | " + d.min + "–" + d.max + " " + d.unit;
        return [d.id, d.floor, d.room, d.kind, d.name, LocalNLU.opsFor(d.kind).join("/")].join(" | ") + extra;
      })
      .join("\n");
  }

  const SYSTEM = `Du wandelst gesprochene Smart-Home-Befehle (Deutsch/Schweizerdeutsch, evtl. fehlerhaft transkribiert) in Aktionen für Datenpunkte um.
Geräteliste (id | Geschoss | Raum | Art | Name | erlaubte ops):
{{CATALOG}}

Bedeutung der ops: up=hoch/öffnen (bei Markise: einfahren), down=runter/schliessen (bei Markise: ausfahren), stop, on, off, toggle, set (value: Prozent 0-100 bei Licht, °C bei Heizung), inc/dec (value: Schritt, Heizung Standard 0.5).
Spezielle Arten: switch = Schalter (Anwesenheitssimulation, Heiz-/Kühlbetrieb) on/off; ventilation/mode = Stufen, set mit value aus "set-Werte" (Lüftung aus = kleinster Wert), inc/dec = Stufe hoch/runter; setpoint = Sollwert (set value in der angegebenen Einheit); reduction = Heizungsabsenkung (on/off, set value = Anzahl Tage bis automatisch aus).
Regeln:
- Fehlende Angaben sinnvoll ergänzen (z. B. "Store Wohnen auf" -> up; "Wohnen 22 Grad" -> Heizung set 22).
- Nur ids aus der Liste verwenden. Elemente namens "Alles"/"Alle" nur, wenn ausdrücklich gemeint.
- Ist unklar, WELCHES Gerät gemeint ist (mehrere passen, Raum auf mehreren Geschossen), NICHT raten: stelle eine Rückfrage mit Optionen (inkl. Option "Alle", falls sinnvoll).
Antworte NUR mit JSON, ohne Text davor/danach, in einer dieser Formen:
{"actions":[{"id":12,"op":"up"}]}
{"clarify":{"question":"...","options":[{"label":"...","actions":[{"id":12,"op":"up"}]}]}}
{"error":"kurzer Grund"}`;

  function extractJson(text) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end < start) throw new Error("Keine JSON-Antwort");
    return JSON.parse(text.slice(start, end + 1));
  }

  function toActions(list, devices) {
    return (list || [])
      .map((a) => ({ deviceId: Number(a.id), op: a.op, value: a.value }))
      .filter((a) => {
        const d = devices.find((x) => x.id === a.deviceId);
        return d && LocalNLU.opsFor(d.kind).includes(a.op);
      });
  }

  async function parse(text, devices) {
    const key = getKey();
    if (!key) return { status: "unknown", reason: "KI-Fallback nicht eingerichtet." };

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: getModel(),
        max_tokens: 600,
        system: SYSTEM.replace("{{CATALOG}}", catalogText(devices)),
        messages: [{ role: "user", content: text }],
      }),
    });
    if (!res.ok) {
      let msg = "HTTP " + res.status;
      try { msg += ": " + ((await res.json()).error || {}).message; } catch (e) { /* ignore */ }
      throw new Error(msg);
    }
    const data = await res.json();
    const out = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
    const json = extractJson(out);

    if (json.actions) {
      const actions = toActions(json.actions, devices);
      if (!actions.length) return { status: "unknown", reason: "KI: keine gültige Aktion." };
      return { status: "ok", actions, summary: actions.map((a) => LocalNLU.describe(a, devices)).join("\n"), source: "ki" };
    }
    if (json.clarify) {
      const options = (json.clarify.options || [])
        .map((o) => ({ label: String(o.label || ""), actions: toActions(o.actions, devices) }))
        .filter((o) => o.label && o.actions.length);
      if (!options.length) return { status: "unknown", reason: "KI: Rückfrage ohne gültige Optionen." };
      return { status: "clarify", question: String(json.clarify.question || "Welches Gerät?"), options, source: "ki" };
    }
    return { status: "unknown", reason: "KI: " + (json.error || "nicht erkannt") };
  }

  return { parse, isEnabled, getKey, setKey, getModel, setModel, DEFAULT_MODEL };
})();
