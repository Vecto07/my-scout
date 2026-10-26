# 🔌 API-Anleitung für Frontend & Browser-Extension

Damit eure Webseite und die Browser-Extension mit dem Java-Backend kommunizieren können, findet ihr hier alle notwendigen Endpunkte, Methoden und JavaScript-Codebeispiele.

---

## ⚙️ Basis-URL
Solange das Backend lokal läuft:
`http://localhost:8080`

---

## 1. 🔑 Authentifizierung (Login & Registrierung)

Bevor Daten geladen oder gespeichert werden können, muss sich ein Nutzer einloggen, um den JWT-Token zu erhalten. Dieser Token muss bei allen weiteren Anfragen im Header mitgeschickt werden.

### A) Registrieren
* **URL:** `/api/auth/register`
* **Methode:** `POST`
* **Body (JSON):**
  ```json
  {
    "benutzername": "max",
    "email": "max@example.com",
    "passwort": "sicheresPasswort123"
  }
  ```

### B) Einloggen & Token erhalten
* **URL:** `/api/auth/login`
* **Methode:** `POST`
* **Body (JSON):**
  ```json
  {
    "benutzername": "max",
    "passwort": "sicheresPasswort123"
  }
  ```
* **Antwort:** Ein reiner Text-String (der JWT-Token, z. B. `eyJhbGciOi...`). Speichert diesen Token im JavaScript-Code (z.B. in `localStorage`).

---

## 2. 🛍️ Artikel-Verwaltung (Benötigt immer den Token!)

Füge bei allen folgenden Anfragen im `headers`-Bereich folgenden Eintrag hinzu:  
`'Authorization': 'Bearer ' + token`

### A) Alle Artikel des Nutzers abrufen (Für die Webseite / Warenkorb-Ansicht)
* **URL:** `/api/artikel`
* **Methode:** `GET`
* **JavaScript-Beispiel:**
  ```javascript
  async function ladeWarenkorb() {
      const token = localStorage.getItem("jwt_token"); // Token aus dem Speicher holen
      
      const response = await fetch('http://localhost:8080/api/artikel', {
          method: 'GET',
          headers: {
              'Authorization': 'Bearer ' + token
          }
      });
      
      if (response.ok) {
          const artikelListe = await response.json();
          console.log("Deine Artikel:", artikelListe);
          // Hier das HTML für den Warenkorb dynamisch aufbauen!
      } else {
          console.error("Nicht autorisiert oder Fehler beim Laden.");
      }
  }
  ```

### B) Neuen Artikel hinzufügen (Für die Browser-Extension)
* **URL:** `/api/artikel`
* **Methode:** `POST`
* **Body (JSON):** *(Die ID wird vom Backend automatisch vergeben und darf nicht mitgeschickt werden!)*
  ```json
  {
    "name": "Beispiel-Produkt",
    "preis": 29.99,
    "shopName": "Amazon",
    "url": "https://www.amazon.de/dp/...",
    "bildUrl": "https://images.example.com/bild.jpg"
  }
  ```
* **JavaScript-Beispiel:**
  ```javascript
  async function artikelHinzufuegen(produktName, produktPreis, shop) {
      const token = localStorage.getItem("jwt_token");
      
      const neuerArtikel = {
          name: produktName,
          preis: produktPreis,
          shopName: shop
      };

      const response = await fetch('http://localhost:8080/api/artikel', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify(neuerArtikel)
      });

      if (response.ok) {
          const gespeichert = await response.json();
          console.log("Erfolgreich gespeichert:", gespeichert);
      }
  }
  ```

### C) Artikel löschen
* **URL:** `/api/artikel/{id}` *(Ersetze `{id}` durch die echte ID des Artikels, z.B. `/api/artikel/3`)*
* **Methode:** `DELETE`
* **JavaScript-Beispiel:**
  ```javascript
  async function artikelLoeschen(artikelId) {
      const token = localStorage.getItem("jwt_token");

      const response = await fetch(`http://localhost:8080/api/artikel/${artikelId}`, {
          method: 'DELETE',
          headers: {
              'Authorization': 'Bearer ' + token
          }
      });

      if (response.ok) {
          console.log("Artikel erfolgreich gelöscht!");
      }
  }
  ```