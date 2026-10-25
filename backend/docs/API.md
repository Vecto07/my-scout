# API-Beschreibung

Das ist der **Vertrag** zwischen Backend, Frontend und Browser-Extension.
Das Backend liefert genau diese Formate. Frontend und Extension verlassen sich darauf.

- **Status:** Entwurf, wird gemeinsam im Team abgestimmt
- **Basis-URL (lokal):** `http://localhost:8080`
- **Datenformat:** JSON (`Content-Type: application/json`)

## Endpunkte

| Methode | Pfad              | Beschreibung                   | Stand                       |
|---------|-------------------|--------------------------------|-----------------------------|
| GET     | `/api/items`      | Alle Artikel abrufen           | **fertig, liefert Testdaten** |
| POST    | `/api/items`      | Neuen Artikel hinzufügen       | geplant                     |
| PUT     | `/api/items/{id}` | Artikel ändern (Menge, Notiz)  | geplant                     |
| DELETE  | `/api/items/{id}` | Artikel löschen                | geplant                     |
| POST    | `/api/auth/register` | Konto anlegen               | geplant                     |
| POST    | `/api/auth/login` | Einloggen, Token erhalten      | geplant                     |

Solange der Stand "liefert Testdaten" ist, gibt das Backend feste Beispielartikel zurück.
Die echte Datenbank kommt später dahinter, **das Format ändert sich dadurch nicht.**

## Datenformat eines Artikels (`Item`)

```json
{
  "id": 1,
  "title": "Logitech MX Master 3S",
  "price": 89.99,
  "currency": "EUR",
  "imageUrl": "https://example.com/bild1.jpg",
  "shop": "amazon.de",
  "url": "https://www.amazon.de/dp/BEISPIEL",
  "quantity": 1,
  "addedAt": "2026-10-20T14:30:00Z"
}
```

| Feld       | Typ    | Bedeutung                                                   |
|------------|--------|-------------------------------------------------------------|
| `id`       | Zahl   | Eindeutige Nummer, vergibt das Backend (beim Hinzufügen nicht mitschicken) |
| `title`    | Text   | Produktname                                                 |
| `price`    | Zahl   | Preis als Dezimalzahl mit Punkt (`89.99`), ohne Währungszeichen |
| `currency` | Text   | Währung als Kürzel, z.B. `EUR`                              |
| `imageUrl` | Text   | Link zum Produktbild                                        |
| `shop`     | Text   | Name/Domain des Shops, z.B. `amazon.de`                     |
| `url`      | Text   | Link zur Produktseite                                       |
| `quantity` | Zahl   | Gewünschte Menge (mindestens 1)                             |
| `addedAt`  | Text   | Zeitpunkt des Hinzufügens, ISO-8601 in UTC                  |

## Beispiel: Artikel abrufen

Anfrage:

```
GET http://localhost:8080/api/items
```

Antwort (Status `200 OK`): eine Liste von Artikeln

```json
[
  { "id": 1, "title": "...", "price": 89.99, "currency": "EUR", "...": "..." },
  { "id": 2, "title": "...", "price": 24.5,  "currency": "EUR", "...": "..." }
]
```

## Für die Extension

Die Extension liest Titel, Preis, Bild und URL aus der geöffneten Produktseite
(z.B. aus JSON-LD bzw. Open-Graph-Tags) und schickt sie später per `POST /api/items`
an das Backend. Die Felder entsprechen dem Format oben, `id` und `addedAt` setzt das Backend.

## Für das Frontend

Die Artikelliste kommt über `GET /api/items`. Das Backend erlaubt aktuell Anfragen von
jeder Herkunft (CORS offen), damit lokales Entwickeln einfach ist. Vor der Abgabe wird das eingeschränkt.

## Änderungen

| Datum      | Änderung                | Von     |
|------------|-------------------------|---------|
| 2026-10-25 | Erster Entwurf, GET /api/items mit Testdaten | Andreas |