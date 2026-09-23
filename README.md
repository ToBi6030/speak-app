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

## Zentrale Sprachbefehle (Beispiele)

| Funktion | Beispiele |
|---|---|
| Lichtszenen | „Alles aus“, „Heimkommen“, „Szene Abend“, „Nacht“ |
| Storen / Markisen gesamt | „Alle Storen hoch“, „Alle Storen im OG runter“, „Alle Markisen einfahren“ |
| Heizungsabsenkung (Ferien) | „Absenkung ein/aus“, „Ferienmodus für 5 Tage“, „Absenkung für zwei Wochen“ |
| Anwesenheitssimulation | „Simulation ein“, „Anwesenheitssimulation ausschalten“ |
| Heiz-/Kühlbetrieb | „Heizbetrieb ein“, „Kühlbetrieb aus“ |
| Lüftung | „Lüftung Stufe 2“, „Lüftung aus“, „Lüftung höher/tiefer“, „Lüftung maximal“ |
| Sauna | „Sauna ein/aus“, „Sanarium einschalten“, „Sauna auf 85 Grad“, „Sauna Badezeit 90 Minuten“ |
| Raumtemperatur | „Wohnen 22 Grad“, „Wohnen wärmer/kühler“ |
