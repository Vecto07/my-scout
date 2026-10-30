# Warenkorb-Frontend

## Überblick

Das Frontend ist eine responsive, frameworkfreie HTML-, CSS- und JavaScript-Anwendung. Es bietet Registrierung und Anmeldung, zeigt Produkte an und ermöglicht Hinzufügen, Suchen und Löschen. Oberfläche, Light-/Dark-Themes und Formularmeldungen sind clientseitig; Konten und Produkte verwaltet das Spring-Backend.

## Dateistruktur

- `src/index.html`: Einstieg und Weiterleitung zu `src/Warenkorb.html`.
- `src/Warenkorb.html`: Seitenstruktur, Formulare und zugängliche Statusbereiche.
- `src/Warenkorb.js`: Ereignisse, UI-Zustand und REST-Kommunikation.
- `src/Warenkorb_Desin.css`: Layout, Farben und responsive Regeln.
- `src/Warenkorb_Backend.css`: ergänzende Regeln, etwa für Produktbilder.

Alle Dateien der Webanwendung liegen in `src`; diese Dokumentation bleibt im Frontend-Stamm. Die HTML-Datei referenziert die Stylesheets relativ aus demselben Verzeichnis.

## Lokal starten

1. PostgreSQL starten und die Verbindung in `../backend/src/main/resources/application.properties` passend zur lokalen Umgebung konfigurieren.
2. Java 21 verwenden und Spring Boot aus dem `backend`-Ordner starten: unter Windows `mvnw.cmd spring-boot:run`, unter macOS/Linux `./mvnw spring-boot:run`.
3. Das Verzeichnis `frontend` mit einem Webserver bereitstellen, z. B. Apache unter XAMPP. `src/index.html` über `http://localhost/.../src/` und nicht als `file://` öffnen.
4. Die API-Adresse ist für die Produktion `https://api.my-scout.app` und wird durch das `api-base`-Meta-Element in `src/Warenkorb.html` konfiguriert. Für lokale Entwicklung kann dort vorübergehend `http://localhost:8080` eingetragen werden.

## Ablauf und API

`src/Warenkorb.js` liest den API-Ursprung aus `meta[name="api-base"]`. Der zentrale Request-Helper sendet JSON und hängt, sofern vorhanden, den JWT im Bearer-Schema an. Fehlerhafte HTTP-Antworten werden als verständliche Meldungen in den Formularen angezeigt.

| Aktion | HTTP | Pfad | Request bzw. Antwort |
|---|---|---|---|
| Registrieren | `POST` | `/api/auth/register` | `{ "benutzername": "...", "passwort": "...", "email": "..." }` |
| Anmelden | `POST` | `/api/auth/login` | `{ "benutzername": "...", "passwort": "..." }`; Antwort ist ein JWT-Text |
| Produkte laden | `GET` | `/api/artikel` | Liste von Artikeln mit `id`, `name`, `url`, `preis`, `shopName`, `bildUrl` |
| Produkt speichern | `POST` | `/api/artikel` | `{ "name": "...", "url": "...", "preis": 0, "shopName": "...", "bildUrl": "..." }` |
| Produkt löschen | `DELETE` | `/api/artikel/{id}` | Erfolgreich ohne Antwortinhalt (`204`) |

Die Registrierung gibt einen Text zurück. Danach meldet sich das Frontend automatisch mit denselben Anmeldedaten an, um ein JWT zu erhalten. Token und Benutzername liegen im `sessionStorage`; beim Abmelden werden sie entfernt. Beim Laden innerhalb derselben Browser-Session wird mit dem vorhandenen Token die Artikelliste angefragt.

## Wichtige Funktionen

- `setAuthMode()` hält Login und Registrierung synchron und blendet die erforderliche E-Mail-Eingabe nur bei der Registrierung ein.
- `loadArticles()` lädt die Backend-Daten; `renderArticles()` zeigt sie an und filtert lokal anhand von Name, URL und Shop.
- `handleCreateArticle()` validiert HTTP-/HTTPS-Adressen und Preise. Die JSON-Eigenschaften entsprechen der Backend-Entity `Artikel`: `name`, `url`, `preis`, `shopName`, `bildUrl`.
- Produkttexte werden mit `textContent` eingesetzt. Externe Links öffnen mit `noopener noreferrer`.
- `getSavedTheme()` und `setTheme()` verwalten das Theme unabhängig vom Login in `localStorage`.
- Das Backend unterstützt derzeit einzelne Produkte, nicht Warenkorbtypen, Tags oder Bearbeitung. Die UI bietet daher Suche, Anlegen und Löschen, aber keine Tag-/Warenkorbfilter oder Bearbeitung.

## Änderungen

Bei Änderungen an Formularen `src/Warenkorb.html`, die Elementreferenzen und Payloads in `src/Warenkorb.js` sowie die Java-Felder im Backend gemeinsam prüfen. Neue Layoutregeln kommen in `src/Warenkorb_Desin.css`; ergänzende Backend-Darstellung kann in `src/Warenkorb_Backend.css` bleiben. Bei Änderungen des API-Ursprungs `src/Warenkorb.html` anpassen und CORS der Backend-Umgebung prüfen. Die Produktions-Domains sind `https://my-scout.app` für GitHub Pages und `https://api.my-scout.app` für die API.
