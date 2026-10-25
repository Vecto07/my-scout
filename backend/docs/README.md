# Backend

Java mit Spring Boot. Stellt die REST-API bereit, die Frontend und Extension nutzen.

## Starten

1. Ordner `backend` in VS Code öffnen
2. `BackendApplication.java` → **Run**
3. Läuft auf `http://localhost:8080`

## API

| Methode | Pfad         | Zweck                | Stand           |
|---------|--------------|----------------------|-----------------|
| GET     | `/api/items` | Alle Artikel abrufen | Testdaten       |
| POST    | `/api/items` | Artikel hinzufügen   | geplant         |
| DELETE  | `/api/items/{id}` | Artikel löschen | geplant         |

## Artikel-Format (JSON)

```json
{
  "id": 1,
  "title": "Logitech MX Master 3S",
  "price": 89.99,
  "currency": "EUR",
  "imageUrl": "https://example.com/bild1.jpg",
  "shop": "amazon.de",
  "url": "https://www.amazon.de/dp/BEISPIEL1",
  "quantity": 1,
  "addedAt": "2026-10-20T14:30:00Z"
}
```

Beim Hinzufügen schickt die Extension alles außer `id` und `addedAt` (setzt das Backend).
Änderungen am Format bitte vorher im Team absprechen.
