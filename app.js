(function () {
  const recordBtn = document.getElementById("recordBtn");
  const feedbackBox = document.getElementById("feedbackBox");
  const feedbackText = document.getElementById("feedbackText");
  const feedbackCommand = document.getElementById("feedbackCommand");
  const feedbackStatus = document.getElementById("feedbackStatus");
  const unsupportedEl = document.getElementById("unsupported");

  const connDot = document.getElementById("connDot");
  const connText = document.getElementById("connText");
  const settingsBtn = document.getElementById("settingsBtn");
  const closeSettingsBtn = document.getElementById("closeSettingsBtn");
  const settingsPanel = document.getElementById("settingsPanel");
  const wsUrlInput = document.getElementById("wsUrlInput");
  const connectBtn = document.getElementById("connectBtn");
  const disconnectBtn = document.getElementById("disconnectBtn");
  const mappingInput = document.getElementById("mappingInput");
  const saveMappingBtn = document.getElementById("saveMappingBtn");
  const mappingSaved = document.getElementById("mappingSaved");
  const nativeWidthInput = document.getElementById("nativeWidthInput");
  const nativeHeightInput = document.getElementById("nativeHeightInput");
  const saveScaleBtn = document.getElementById("saveScaleBtn");

  const HEATING_STEP = 0.5;

  // --- Iframe-Skalierung (die Visu ist eine feste Pixel-Canvas ohne responsives Layout) ---

  const SCALE_W_KEY = "speak-app.nativeWidth";
  const SCALE_H_KEY = "speak-app.nativeHeight";
  const DEFAULT_NATIVE_WIDTH = 1024;
  const DEFAULT_NATIVE_HEIGHT = 600;

  const visuFrame = document.getElementById("visuFrame");
  const visuWrapper = document.getElementById("visuWrapper");

  function loadScaleSettings() {
    const w = parseInt(localStorage.getItem(SCALE_W_KEY), 10) || DEFAULT_NATIVE_WIDTH;
    const h = parseInt(localStorage.getItem(SCALE_H_KEY), 10) || DEFAULT_NATIVE_HEIGHT;
    return { w, h };
  }

  function saveScaleSettings(w, h) {
    localStorage.setItem(SCALE_W_KEY, String(w));
    localStorage.setItem(SCALE_H_KEY, String(h));
  }

  function applyIframeScale() {
    const { w, h } = loadScaleSettings();
    visuFrame.style.width = w + "px";
    visuFrame.style.height = h + "px";
    const containerW = visuWrapper.clientWidth;
    const containerH = visuWrapper.clientHeight;
    const scale = Math.max(containerW / w, containerH / h);
    visuFrame.style.transform = "scale(" + scale + ")";
  }

  window.addEventListener("resize", applyIframeScale);
  applyIframeScale();

  // --- Sprachbefehl -> Aktion ---

  const SENDABLE_CATEGORIES = new Set(["shutter", "marquee", "curtain", "light", "plug", "heating"]);

  function setConnStatus(status) {
    connDot.className = "conn-dot " + status;
    const labels = {
      connected: "verbunden",
      connecting: "verbinde ...",
      disconnected: "nicht verbunden",
      error: "Fehler",
    };
    connText.textContent = labels[status] || status;
    if (status === "connected") registerHeatingZones();
  }

  function registerHeatingZones() {
    const zones = new Set([...MappingStore.allHeatingZones(), ...DeviceCatalog.heatingZones()]);
    for (const zone of zones) {
      try {
        WsControl.heatingRegister(zone);
      } catch (err) {
        // ignore, best effort
      }
    }
  }

  function showLive(rawText, command) {
    feedbackText.textContent = rawText;
    feedbackCommand.textContent = command ? JSON.stringify(command, null, 2) : "";
    feedbackStatus.textContent = "";
    feedbackBox.classList.remove("state-error", "state-success");
    feedbackBox.hidden = false;
  }

  function setStatus(text, state) {
    feedbackStatus.textContent = text;
    feedbackBox.classList.remove("state-error", "state-success");
    if (state) feedbackBox.classList.add("state-" + state);
  }

  function hideFeedback() {
    feedbackBox.hidden = true;
  }

  function dispatchShutterLike(command, entry) {
    const actionFn = { top: WsControl.top, bottom: WsControl.bottom, stop: WsControl.stop }[command.action];
    if (!actionFn) {
      setStatus('Aktion "' + command.action + '" wird nicht unterstützt.', "error");
      return;
    }
    actionFn(entry.button, entry.element);
    setStatus("Gesendet: " + command.action.toUpperCase() + " (" + command.room + ")", "success");
  }

  function dispatchLightLike(command, entry) {
    if (command.unit === "prozent" && command.value !== null) {
      WsControl.setLevel(entry.button, entry.element, command.value);
      setStatus("Gesendet: " + command.value + "% (" + command.room + ")", "success");
      return;
    }
    if (command.action === "on" || command.action === "off") {
      if (entry.component === "ON_OFF") {
        (command.action === "on" ? WsControl.on : WsControl.off)(entry.button, entry.element);
        setStatus("Gesendet: " + (command.action === "on" ? "EIN" : "AUS") + " (" + command.room + ")", "success");
      } else {
        WsControl.toggle(entry.button, entry.element);
        setStatus("Umgeschaltet (Toggle) – Zielzustand nicht garantiert (" + command.room + ")", "success");
      }
      return;
    }
    setStatus("Kein Wert/Aktion für Licht/Steckdose erkannt.", "error");
  }

  function dispatchHeating(command, entry) {
    if (command.unit === "grad" && command.value !== null) {
      WsControl.heatingTarget(entry.zone, command.value);
      setStatus("Gesendet: Sollwert " + command.value + "°C (" + command.room + ")", "success");
      return;
    }
    if (command.action === "up" || command.action === "down") {
      const state = WsControl.getHeatingState(entry.zone);
      const current = state && (typeof state.target === "number" ? state.target : state.value);
      if (typeof current !== "number") {
        setStatus("Aktueller Sollwert von Zone " + entry.zone + " noch nicht bekannt – kurz warten und erneut versuchen.", "error");
        return;
      }
      const next = current + (command.action === "up" ? HEATING_STEP : -HEATING_STEP);
      WsControl.heatingTarget(entry.zone, next);
      setStatus("Gesendet: Sollwert " + next.toFixed(1) + "°C (" + command.room + ")", "success");
      return;
    }
    setStatus("Kein Sollwert/Aktion für Heizung erkannt.", "error");
  }

  // --- Neue Pipeline: Katalog + lokale KI + Claude-Fallback ---

  const clarifyBox = document.getElementById("clarifyBox");
  const clarifyQuestion = document.getElementById("clarifyQuestion");
  const clarifyOptions = document.getElementById("clarifyOptions");

  function hideClarify() {
    clarifyBox.hidden = true;
    clarifyOptions.innerHTML = "";
  }

  function isOn(d) {
    const st = WsControl.getScState(d.button, d.element);
    if (!st) return null;
    if (typeof st.value === "number" && d.component === "ANALOG_ABSOLUTE") return st.value > 0 || st.status === 1;
    return st.status === 1;
  }

  // Eine Aktion an die Anlage senden. Liefert kurzen Hinweis zurück.
  function executeAction(a) {
    const d = DeviceCatalog.byId(a.deviceId);
    if (!d) throw new Error("Unbekanntes Gerät " + a.deviceId);
    const b = d.button;
    const e = d.element;

    if (d.kind === "shutter" || d.kind === "skylight" || d.kind === "marquee") {
      ({ up: WsControl.top, down: WsControl.bottom, stop: WsControl.stop })[a.op](b, e);
      return "";
    }
    if (d.kind === "heating") {
      if (a.op === "set") {
        WsControl.heatingTarget(d.zone, a.value);
        return "";
      }
      const st = WsControl.getHeatingState(d.zone);
      const cur = st && (typeof st.target === "number" ? st.target : st.value);
      if (typeof cur !== "number") throw new Error("Sollwert von " + d.room + " noch unbekannt – gleich nochmals versuchen");
      const next = Math.round((cur + (a.op === "inc" ? 1 : -1) * (a.value || HEATING_STEP)) * 2) / 2;
      WsControl.heatingTarget(d.zone, next);
      return " (" + next + " °C)";
    }
    if (d.kind === "scene") {
      WsControl.toggle(b, e);
      return "";
    }
    // Licht / Steckdose / Lüftung
    if (a.op === "set") {
      if (d.component === "ANALOG_ABSOLUTE") {
        WsControl.setLevel(b, e, a.value);
        return "";
      }
      a = { ...a, op: a.value > 0 ? "on" : "off" }; // nicht dimmbar -> ein/aus
    }
    if (a.op === "inc" || a.op === "dec") {
      if (d.component !== "ANALOG_ABSOLUTE") throw new Error(DeviceCatalog.label(d) + " ist nicht dimmbar");
      const st = WsControl.getScState(b, e);
      const cur = st && typeof st.value === "number" ? st.value : 50;
      const next = Math.max(0, Math.min(100, cur + (a.op === "inc" ? 1 : -1) * (a.value || 20)));
      WsControl.setLevel(b, e, next);
      return " (" + next + " %)";
    }
    if (a.op === "toggle") {
      WsControl.toggle(b, e);
      return "";
    }
    // on / off zustandsabhängig: nur umschalten, wenn nötig
    const state = isOn(d);
    const want = a.op === "on";
    if (state === want) return " (war schon " + (want ? "ein" : "aus") + ")";
    WsControl.toggle(b, e);
    return state === null ? " (Zustand unbekannt – umgeschaltet)" : "";
  }

  function runActions(result) {
    hideClarify();
    if (!WsControl.isConnected()) {
      setStatus("Nicht verbunden – Seite neu laden oder in den Einstellungen verbinden.", "error");
      return;
    }
    const devices = DeviceCatalog.all();
    const lines = [];
    let errors = 0;
    for (const a of result.actions) {
      try {
        lines.push("✓ " + LocalNLU.describe(a, devices) + executeAction(a));
      } catch (err) {
        errors++;
        lines.push("✗ " + LocalNLU.describe(a, devices) + ": " + err.message);
      }
    }
    feedbackCommand.textContent = lines.join("\n");
    setStatus(errors ? "Teilweise fehlgeschlagen." : "Gesendet" + (result.source === "ki" ? " (KI)" : "") + ".", errors ? "error" : "success");
  }

  function showClarify(result) {
    feedbackCommand.textContent = "";
    setStatus(result.source === "ki" ? "Rückfrage (KI)" : "Rückfrage", null);
    clarifyQuestion.textContent = result.question;
    clarifyOptions.innerHTML = "";
    for (const opt of result.options) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "clarify-btn";
      btn.textContent = opt.label;
      btn.addEventListener("click", () => runActions({ actions: opt.actions, source: result.source }));
      clarifyOptions.appendChild(btn);
    }
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "clarify-btn cancel";
    cancel.textContent = "Abbrechen";
    cancel.addEventListener("click", () => {
      hideClarify();
      hideFeedback();
    });
    clarifyOptions.appendChild(cancel);
    clarifyBox.hidden = false;
  }

  function previewText(text) {
    if (!DeviceCatalog.isLoaded()) return JSON.stringify(parseCommand(text), null, 2);
    const r = LocalNLU.parse(text, DeviceCatalog.all());
    if (r.status === "ok") return r.summary;
    if (r.status === "clarify") return "? " + r.question;
    return "…";
  }

  async function handleRecognizedText(text) {
    hideClarify();
    if (!text.trim()) {
      hideFeedback();
      return;
    }
    if (!DeviceCatalog.isLoaded()) {
      handleRecognizedTextLegacy(text);
      return;
    }
    const devices = DeviceCatalog.all();
    showLive(text, null);
    let result = LocalNLU.parse(text, devices);

    if (result.status === "unknown" && LlmNLU.isEnabled()) {
      setStatus("KI wird gefragt …", null);
      try {
        result = await LlmNLU.parse(text, devices);
      } catch (err) {
        setStatus("KI-Fehler: " + err.message, "error");
        return;
      }
    }

    if (result.status === "ok") runActions(result);
    else if (result.status === "clarify") showClarify(result);
    else setStatus(result.reason + (LlmNLU.isEnabled() ? "" : " (Tipp: KI-Fallback in den Einstellungen aktivieren)"), "error");
  }

  function handleRecognizedTextLegacy(text) {
    if (!text.trim()) {
      hideFeedback();
      return;
    }
    const command = parseCommand(text);
    showLive(text, command);

    if (!command.matched) {
      setStatus("Kein Befehl erkannt.", "error");
      return;
    }
    if (!SENDABLE_CATEGORIES.has(command.category)) {
      setStatus('Kategorie "' + command.category + '" wird nicht unterstützt.', "error");
      return;
    }
    if (!WsControl.isConnected()) {
      setStatus("Nicht verbunden – Einstellungen öffnen und WebSocket verbinden.", "error");
      return;
    }
    const entry = MappingStore.getEntry(command.room, command.category);
    if (!entry) {
      setStatus('Keine Zuordnung für "' + command.room + " | " + command.category + '" hinterlegt.', "error");
      return;
    }

    try {
      if (command.category === "shutter" || command.category === "marquee" || command.category === "curtain") {
        dispatchShutterLike(command, entry);
      } else if (command.category === "light" || command.category === "plug") {
        dispatchLightLike(command, entry);
      } else if (command.category === "heating") {
        dispatchHeating(command, entry);
      }
    } catch (err) {
      setStatus("Fehler beim Senden: " + err.message, "error");
    }
  }

  // --- Spracherkennung (Push-to-Talk) ---

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    unsupportedEl.hidden = false;
    recordBtn.disabled = true;
  } else {
    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "de-DE";
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalText = "";
    let liveText = "";
    let isRecording = false;

    function setRecording(recording) {
      isRecording = recording;
      recordBtn.classList.toggle("recording", recording);
      recordBtn.setAttribute("aria-pressed", String(recording));
    }

    function startRecording() {
      if (isRecording) return;
      finalText = "";
      liveText = "";
      hideFeedback();
      try {
        recognition.start();
      } catch (err) {
        // start() throws if already started; ignore
      }
    }

    function stopRecording() {
      if (!isRecording) return;
      recognition.stop();
    }

    recognition.onstart = function () {
      setRecording(true);
    };

    recognition.onresult = function (event) {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText = (finalText ? finalText + " " : "") + transcript.trim();
        } else {
          interim += transcript;
        }
      }
      liveText = (finalText + " " + interim).trim();
      if (liveText) {
        showLive(liveText, null);
        feedbackCommand.textContent = previewText(liveText);
      }
    };

    recognition.onerror = function () {
      // errors surface via onend / status
    };

    recognition.onend = function () {
      setRecording(false);
      handleRecognizedText(liveText);
    };

    recordBtn.addEventListener("mousedown", (e) => { e.preventDefault(); startRecording(); });
    recordBtn.addEventListener("mouseup", (e) => { e.preventDefault(); stopRecording(); });
    recordBtn.addEventListener("mouseleave", (e) => { e.preventDefault(); stopRecording(); });
    recordBtn.addEventListener("touchstart", (e) => { e.preventDefault(); startRecording(); }, { passive: false });
    recordBtn.addEventListener("touchend", (e) => { e.preventDefault(); stopRecording(); });
    recordBtn.addEventListener("touchcancel", (e) => { e.preventDefault(); stopRecording(); });
    recordBtn.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  // --- Einstellungen: WebSocket-Verbindung ---

  wsUrlInput.value = MappingStore.loadWsUrl();
  setConnStatus("disconnected");
  WsControl.connect(wsUrlInput.value, setConnStatus);

  connectBtn.addEventListener("click", () => {
    const url = wsUrlInput.value.trim();
    if (!url) return;
    MappingStore.saveWsUrl(url);
    WsControl.connect(url, setConnStatus);
  });

  disconnectBtn.addEventListener("click", () => {
    WsControl.disconnect();
  });

  // Für Tests in der Browser-Konsole: speakApp.handleText("Store Wohnen öffnen")
  window.speakApp = { handleText: handleRecognizedText };

  // --- Gerätekatalog aus der Anlage laden ---

  const catalogInfo = document.getElementById("catalogInfo");
  DeviceCatalog.load()
    .then((list) => {
      catalogInfo.textContent = "Gerätekatalog: " + list.length + " steuerbare Datenpunkte automatisch geladen.";
      if (WsControl.isConnected()) registerHeatingZones();
    })
    .catch((err) => {
      catalogInfo.textContent = "Gerätekatalog nicht geladen (" + err.message + ") – es gilt die manuelle Zuordnung.";
    });

  // --- Einstellungen: KI-Fallback ---

  const llmKeyInput = document.getElementById("llmKeyInput");
  const llmModelInput = document.getElementById("llmModelInput");
  const saveLlmBtn = document.getElementById("saveLlmBtn");
  const llmSaved = document.getElementById("llmSaved");
  llmKeyInput.value = LlmNLU.getKey();
  llmModelInput.value = LlmNLU.getModel();
  saveLlmBtn.addEventListener("click", () => {
    LlmNLU.setKey(llmKeyInput.value.trim());
    LlmNLU.setModel(llmModelInput.value.trim());
    llmSaved.hidden = false;
    setTimeout(() => { llmSaved.hidden = true; }, 1500);
  });

  // --- Einstellungen: Skalierung ---

  {
    const { w, h } = loadScaleSettings();
    nativeWidthInput.value = w;
    nativeHeightInput.value = h;
  }

  saveScaleBtn.addEventListener("click", () => {
    const w = parseInt(nativeWidthInput.value, 10) || DEFAULT_NATIVE_WIDTH;
    const h = parseInt(nativeHeightInput.value, 10) || DEFAULT_NATIVE_HEIGHT;
    saveScaleSettings(w, h);
    applyIframeScale();
  });

  // --- Einstellungen: Mapping-Editor ---

  mappingInput.value = JSON.stringify(MappingStore.load(), null, 2);

  saveMappingBtn.addEventListener("click", () => {
    try {
      const parsed = JSON.parse(mappingInput.value);
      MappingStore.save(parsed);
      mappingSaved.hidden = false;
      registerHeatingZones();
      setTimeout(() => { mappingSaved.hidden = true; }, 1500);
    } catch (err) {
      alert("Ungültiges JSON: " + err.message);
    }
  });

  // --- Einstellungen: Panel öffnen/schliessen ---

  settingsBtn.addEventListener("click", () => { settingsPanel.hidden = false; });
  closeSettingsBtn.addEventListener("click", () => { settingsPanel.hidden = true; });
  settingsPanel.addEventListener("click", (e) => {
    if (e.target === settingsPanel) settingsPanel.hidden = true;
  });
})();
