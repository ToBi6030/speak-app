(function () {
  const recordBtn = document.getElementById("recordBtn");
  const feedbackBox = document.getElementById("feedbackBox");
  const feedbackText = document.getElementById("feedbackText");
  const feedbackCommand = document.getElementById("feedbackCommand");
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

  // Nur diese Kategorien sind protokollseitig bestätigt (UP/DOWN/STOP per Taster-Emulation).
  const SENDABLE_CATEGORIES = new Set(["shutter", "marquee", "curtain"]);
  const ACTION_TO_SMARTCONTROL = { up: "UP", down: "DOWN", stop: "STOP" };

  function setConnStatus(status) {
    connDot.className = "conn-dot " + status;
    const labels = {
      connected: "verbunden",
      connecting: "verbinde ...",
      disconnected: "nicht verbunden",
      error: "Fehler",
    };
    connText.textContent = labels[status] || status;
  }

  function showFeedback(text, command, state) {
    feedbackText.textContent = text;
    feedbackCommand.textContent = command ? JSON.stringify(command, null, 2) : "";
    feedbackBox.classList.remove("state-error", "state-success");
    if (state) feedbackBox.classList.add("state-" + state);
    feedbackBox.hidden = false;
  }

  function hideFeedback() {
    feedbackBox.hidden = true;
  }

  function handleRecognizedText(text) {
    if (!text.trim()) {
      hideFeedback();
      return;
    }
    const command = parseCommand(text);

    if (!command.matched) {
      showFeedback('Kein Befehl erkannt: "' + text + '"', command, "error");
      return;
    }

    if (!SENDABLE_CATEGORIES.has(command.category)) {
      showFeedback(
        "Erkannt, aber Protokoll für \"" + command.category + "\" noch nicht bestätigt – wird nicht gesendet.",
        command,
        "error"
      );
      return;
    }

    const scAction = ACTION_TO_SMARTCONTROL[command.action];
    if (!scAction) {
      showFeedback("Aktion \"" + command.action + "\" wird für " + command.category + " nicht unterstützt.", command, "error");
      return;
    }

    if (!WsControl.isConnected()) {
      showFeedback("Nicht verbunden – Einstellungen öffnen und WebSocket verbinden.", command, "error");
      return;
    }

    const entry = MappingStore.getEntry(command.room, command.category);
    if (!entry) {
      showFeedback(
        "Keine Button/Element-Zuordnung für \"" + command.room + " | " + command.category + "\" hinterlegt.",
        command,
        "error"
      );
      return;
    }

    try {
      WsControl.sendAction(scAction, entry.button, entry.element);
      showFeedback("Gesendet: " + scAction + " (" + command.room + ")", command, "success");
    } catch (err) {
      showFeedback("Fehler beim Senden: " + err.message, command, "error");
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
    let stopRequested = false;

    function setRecording(recording) {
      isRecording = recording;
      recordBtn.classList.toggle("recording", recording);
      recordBtn.setAttribute("aria-pressed", String(recording));
    }

    function startRecording() {
      if (isRecording) return;
      stopRequested = false;
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
      stopRequested = true;
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
    };

    recognition.onerror = function () {
      // errors surface via onend / status
    };

    recognition.onend = function () {
      setRecording(false);
      handleRecognizedText(liveText);
      stopRequested = false;
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

  connectBtn.addEventListener("click", () => {
    const url = wsUrlInput.value.trim();
    if (!url) return;
    MappingStore.saveWsUrl(url);
    WsControl.connect(url, setConnStatus);
  });

  disconnectBtn.addEventListener("click", () => {
    WsControl.disconnect();
  });

  // --- Einstellungen: Mapping-Editor ---

  mappingInput.value = JSON.stringify(MappingStore.load(), null, 2);

  saveMappingBtn.addEventListener("click", () => {
    try {
      const parsed = JSON.parse(mappingInput.value);
      MappingStore.save(parsed);
      mappingSaved.hidden = false;
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
