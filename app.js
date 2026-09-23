(function () {
  const recordBtn = document.getElementById("recordBtn");
  const statusEl = document.getElementById("status");
  const resultInput = document.getElementById("resultText");
  const copyBtn = document.getElementById("copyBtn");
  const unsupportedEl = document.getElementById("unsupported");
  const commandOutput = document.getElementById("commandOutput");
  const copyCommandBtn = document.getElementById("copyCommandBtn");

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    unsupportedEl.hidden = false;
    recordBtn.disabled = true;
    statusEl.textContent = "Nicht unterstützt";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = navigator.language || "de-DE";
  recognition.continuous = true;
  recognition.interimResults = true;

  let finalText = "";
  let isRecording = false;
  let stopRequested = false;

  function setRecording(recording) {
    isRecording = recording;
    recordBtn.classList.toggle("recording", recording);
    recordBtn.setAttribute("aria-pressed", String(recording));
    statusEl.textContent = recording ? "Höre zu ..." : "Bereit";
  }

  function updateCommandOutput(text) {
    if (typeof parseCommand !== "function" || !text.trim()) {
      commandOutput.textContent = "–";
      commandOutput.classList.remove("no-match");
      return;
    }
    const command = parseCommand(text);
    commandOutput.textContent = JSON.stringify(command, null, 2);
    commandOutput.classList.toggle("no-match", !command.matched);
  }

  function startRecording() {
    if (isRecording) return;
    stopRequested = false;
    finalText = "";
    resultInput.value = "";
    updateCommandOutput("");
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
    resultInput.value = (finalText + " " + interim).trim();
    updateCommandOutput(resultInput.value);
  };

  recognition.onerror = function (event) {
    if (event.error === "no-speech") {
      statusEl.textContent = "Kein Ton erkannt, versuch's nochmal";
    } else if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      statusEl.textContent = "Mikrofon-Zugriff verweigert";
    } else {
      statusEl.textContent = "Fehler: " + event.error;
    }
  };

  recognition.onend = function () {
    setRecording(false);
    if (!stopRequested) {
      // recognition can end on its own (e.g. silence timeout) while button still held
      stopRequested = false;
    }
  };

  function handlePressStart(e) {
    e.preventDefault();
    startRecording();
  }

  function handlePressEnd(e) {
    e.preventDefault();
    stopRecording();
  }

  recordBtn.addEventListener("mousedown", handlePressStart);
  recordBtn.addEventListener("mouseup", handlePressEnd);
  recordBtn.addEventListener("mouseleave", handlePressEnd);
  recordBtn.addEventListener("touchstart", handlePressStart, { passive: false });
  recordBtn.addEventListener("touchend", handlePressEnd);
  recordBtn.addEventListener("touchcancel", handlePressEnd);
  recordBtn.addEventListener("contextmenu", (e) => e.preventDefault());

  copyBtn.addEventListener("click", async () => {
    if (!resultInput.value) return;
    try {
      await navigator.clipboard.writeText(resultInput.value);
    } catch (err) {
      resultInput.select();
      document.execCommand("copy");
    }
    copyBtn.textContent = "Kopiert!";
    copyBtn.classList.add("copied");
    setTimeout(() => {
      copyBtn.textContent = "Kopieren";
      copyBtn.classList.remove("copied");
    }, 1500);
  });

  copyCommandBtn.addEventListener("click", async () => {
    const text = commandOutput.textContent;
    if (!text || text === "–") return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      const range = document.createRange();
      range.selectNode(commandOutput);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      document.execCommand("copy");
      window.getSelection().removeAllRanges();
    }
    copyCommandBtn.textContent = "Kopiert!";
    copyCommandBtn.classList.add("copied");
    setTimeout(() => {
      copyCommandBtn.textContent = "Befehl kopieren";
      copyCommandBtn.classList.remove("copied");
    }, 1500);
  });
})();
