# Speak App

Einfache Web-App, die Sprache in Text umwandelt – gedacht als Befehlseingabe für Smart-Home-Systeme.

## Nutzung

Aufnahme-Button gedrückt halten und sprechen. Solange der Button gehalten wird, läuft die Spracherkennung; der erkannte Text erscheint live in der Zeile darunter und kann per Klick auf "Kopieren" in die Zwischenablage übernommen werden.

## Technik

Nutzt die browsereigene [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) (`SpeechRecognition`). Funktioniert am zuverlässigsten in Chrome/Edge (Chromium); Firefox und Safari unterstützen die API aktuell nicht oder nur eingeschränkt. Erfordert HTTPS (oder `localhost`) sowie Mikrofon-Berechtigung.

## Lokal starten

Statische Dateien, kein Build nötig – z. B.:

```
python3 -m http.server 8080
```

und dann `http://localhost:8080` öffnen.
