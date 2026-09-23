// Verbindung zum Smart-Control-WebSocket (vsc1.spline.ch).
// Protokoll (per DevTools-Mitschnitt ermittelt):
//   Client -> Server: "ACTION;<Base64(JSON)>;"
//   JSON:  {"type":"SMARTCONTROL","action":"UP"|"DOWN"|"STOP","data":{"button":<n>,"element":<n>}}
//   Server -> Client: "PING;" (Keepalive) -> Client antwortet "PONG;"
// Nur für Storen/Markisen/Vorhang (UP/DOWN/STOP) verifiziert.

const WsControl = (function () {
  let socket = null;
  let statusCallback = null;
  let reconnectTimer = null;
  let intentionallyClosed = false;

  function setStatus(status, detail) {
    if (statusCallback) statusCallback(status, detail);
  }

  function base64EncodeUtf8(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function connect(url, onStatusChange) {
    statusCallback = onStatusChange || statusCallback;
    intentionallyClosed = false;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (socket) {
      try {
        socket.close();
      } catch (err) {
        // ignore
      }
    }

    setStatus("connecting");
    try {
      socket = new WebSocket(url);
    } catch (err) {
      setStatus("error", err.message);
      return;
    }

    socket.addEventListener("open", () => setStatus("connected"));

    socket.addEventListener("message", (event) => {
      const data = typeof event.data === "string" ? event.data : "";
      if (data.startsWith("PING")) {
        socket.send("PONG;");
      }
    });

    socket.addEventListener("close", () => {
      setStatus("disconnected");
      socket = null;
      if (!intentionallyClosed) {
        reconnectTimer = setTimeout(() => connect(url, statusCallback), 5000);
      }
    });

    socket.addEventListener("error", () => {
      setStatus("error");
    });
  }

  function disconnect() {
    intentionallyClosed = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (socket) {
      socket.close();
      socket = null;
    }
    setStatus("disconnected");
  }

  function isConnected() {
    return Boolean(socket && socket.readyState === WebSocket.OPEN);
  }

  // action: "UP" | "DOWN" | "STOP"
  function sendAction(action, button, element) {
    if (!isConnected()) {
      throw new Error("Keine WebSocket-Verbindung");
    }
    const payload = JSON.stringify({
      type: "SMARTCONTROL",
      action,
      data: { button, element },
    });
    socket.send("ACTION;" + base64EncodeUtf8(payload) + ";");
  }

  return { connect, disconnect, isConnected, sendAction };
})();
