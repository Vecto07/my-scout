# 🛒 Universal Cart - Backend & API Dokumentation

Willkommen im Backend-Repository unseres Universal-Cart-Projekt! Dieses Dokument fasst die Architektur des Backends sowie die zentralen Funktionen für deine Teamkollegen zusammen.

---

## 🛠️ Backend-Architektur & Funktionsweise

Das Backend wurde mit **Spring Boot (Java)** und einer **PostgreSQL-Datenbank** entwickelt. Es fungiert als sichere Schnittstelle (API), die Anfragen verarbeitet, Nutzer authentifiziert und Artikel nutzerspezifisch speichert.

### 1. Sicherheit & Authentifizierung (Spring Security & JWT)
* **Passwort-Hashing:** Bei der Registrierung werden Passwörter niemals im Klartext gespeichert, sondern über den Algorithmus **BCrypt** unwiderruflich gehasht.
* **JWT (JSON Web Tokens):** Nach einem erfolgreichen Login stellt das Backend einen kryptografisch signierten Token aus, der als digitaler Ausweis dient.
* **Zustandslosigkeit:** Bei geschützten Anfragen müssen die Clients diesen Token im HTTP-Header (`Authorization: Bearer <TOKEN>`) mitschicken, damit jeder Nutzer ausschließlich Zugriff auf seinen eigenen Warenkorb hat.

### 2. Kernfunktionen der Artikel-Verwaltung
Das Backend stellt die folgenden essenziellen Operationen für den Warenkorb bereit:
* **Artikel abrufen (`GET /api/artikel`):** Liefert alle gespeicherten Artikel zurück, die dem aktuell eingeloggten Benutzer gehören.
* **Artikel speichern (`POST /api/artikel`):** Nimmt neue Artikeldaten entgegen, verknüpft sie automatisch mit dem Absender und speichert sie sicher in der Datenbank.
* **Artikel löschen (`DELETE /api/artikel/{id}`):** Entfernt einen Artikel anhand seiner ID, wobei strikt geprüft wird, ob der anfragende Nutzer auch der rechtmäßige Besitzer ist.

### 3. Artikel-Variablen (Datenstruktur)
Ein Artikel besitzt in der Datenbank standardmäßig die folgenden Eigenschaften (Variablen):
* `id` (Long): Eine vom System automatisch vergebene, eindeutige Nummer des Artikels.
* `name` (String): Die Bezeichnung des Produkts.
* `preis` (double): Der Preis des Artikels.
* `shopName` (String): Der Name des Shops (z. B. "Amazon" oder "Otto").
* `url` (String): Der direkte Link zur Produktseite.
* `bildUrl` (String): Die Bildquelle des Produktfotos.
* `benutzer` (Benutzer): Die feste Verknüpfung zum jeweiligen Besitzer des Artikels.