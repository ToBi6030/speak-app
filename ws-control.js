// JS-Port von spline_client.py – Steuerung der Smart-Control-Anlage über den
// öffentlichen WebSocket von vsc1.spline.ch (kein Token/Cookie nötig).
//
// Transport : wss://<host>/  Textnachrichten
// Senden    : "ACTION;<base64(JSON)>;"  JSON = {"type":..., "action":..., "data":{...}}
// Keepalive : Server schickt "PING;..." -> Client antwortet "PONG;"
// Adressierung: button = Button-*channel*, element = Element-*channel* (nicht id!)

const WsControl = (function () {
  let socket = null;
  let statusCallback = null;
  let reconnectTimer = null;
  let intentionallyClosed = false;

  const scState = new Map(); // `${button}_${element}` -> letztes FEEDBACK
  const heatingState = new Map(); // zone -> letztes FEEDBACK

  function setStatus(status, detail) {
    if (statusCallback) statusCallback(status, detail);
  }

  function base64EncodeUtf8(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function base64DecodeUtf8(str) {
    return decodeURIComponent(escape(atob(str)));
  }

  function encodeAction(type, action, data) {
    const raw = JSON.stringify({ type, action, data });
    return "ACTION;" + base64EncodeUtf8(raw) + ";";
  }

  function decodeMessage(msg) {
    const parts = msg.split(";");
    const kind = parts[0];
    if (kind === "ACTION" && parts.length > 1) {
      try {
        return { kind: "ACTION", ...JSON.parse(base64DecodeUtf8(parts[1])) };
      } catch (err) {
        return { kind: "ACTION", raw: msg };
      }
    }
    return { kind, raw: msg };
  }

  function handleIncoming(raw) {
    if (raw.startsWith("PING")) {
      socket.send("PONG;");
      return;
    }
    const msg = decodeMessage(raw);
    if (msg.kind === "ACTION" && msg.action === "FEEDBACK") {
      const d = msg.data || {};
      if (msg.type === "SMARTCONTROL" && "button" in d) {
        scState.set(d.button + "_" + (d.element || 0), d);
      } else if (msg.type === "HEATING" && "zone" in d) {
        heatingState.set(d.zone, d);
      }
    }
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
      handleIncoming(data);
    });

    socket.addEventListener("close", () => {
      setStatus("disconnected");
      socket = null;
      if (!intentionallyClosed) {
        reconnectTimer = setTimeout(() => connect(url, statusCallback), 5000);
      }
    });

    socket.addEventListener("error", () => setStatus("error"));
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

  function send(type, action, data) {
    if (!isConnected()) throw new Error("Keine WebSocket-Verbindung");
    socket.send(encodeAction(type, action, data));
  }

  function sc(action, button, element, extra) {
    send("SMARTCONTROL", action, { button, element, ...(extra || {}) });
  }

  function register(button) {
    send("SMARTCONTROL", "REGISTER", { button });
  }

  function unregister(button) {
    send("SMARTCONTROL", "UNREGISTER", { button, push: false });
  }

  // BINARY_TOGGLE / ANALOG_ABSOLUTE / Szenen: ein Tastendruck = PUSH + RELEASE
  function toggle(button, element) {
    sc("PUSH", button, element);
    sc("RELEASE", button, element);
  }

  // BINARY_ON_OFF
  function on(button, element) {
    sc("PUSH", button, element);
  }
  function off(button, element) {
    sc("RELEASE", button, element);
  }

  // ANALOG_ABSOLUTE (Dimmer) 0..100, ANALOG_STEPS: value aus values[]
  function setLevel(button, element, value) {
    sc("VALUE", button, element, { value: Math.round(value) });
  }

  // Storen / Markisen / Oberlicht
  function top(button, element) {
    sc("TOP", button, element);
  } // ganz auf / einfahren / öffnen
  function bottom(button, element) {
    sc("BOTTOM", button, element);
  } // ganz zu / ausfahren / schliessen
  function up(button, element) {
    sc("UP", button, element);
  }
  function down(button, element) {
    sc("DOWN", button, element);
  }
  function stop(button, element) {
    sc("STOP", button, element);
  }
  function preset(button, element, number) {
    sc("PRESET", button, element, { number });
  }

  // Heizung
  function heatingRegister(zone) {
    send("HEATING", "REGISTER", { zone });
  }
  function heatingUnregister(zone) {
    send("HEATING", "UNREGISTER", { zone });
  }
  function heatingTarget(zone, target) {
    send("HEATING", "TARGET", { zone, target });
  }
  function getHeatingState(zone) {
    return heatingState.get(zone) || null;
  }
  function getScState(button, element) {
    return scState.get(button + "_" + element) || null;
  }

  return {
    connect,
    disconnect,
    isConnected,
    send,
    sc,
    register,
    unregister,
    toggle,
    on,
    off,
    setLevel,
    top,
    bottom,
    up,
    down,
    stop,
    preset,
    heatingRegister,
    heatingUnregister,
    heatingTarget,
    getHeatingState,
    getScState,
  };
})();
