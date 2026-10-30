# Universal Cart Project

Production uses two hostnames:

- `https://my-scout.app`: frontend on GitHub Pages
- `https://api.my-scout.app`: Spring Boot API on the VPS

## Run the application locally

1. Start PostgreSQL and set `APP_JWT_SECRET` plus the optional `SPRING_DATASOURCE_*` environment variables. Keep database credentials out of version control.
2. Use Java 21 and start Spring Boot from the `backend` directory with `mvnw.cmd spring-boot:run` on Windows (or `./mvnw spring-boot:run` on macOS/Linux). The API listens on port 8080 by default.
3. Serve the `frontend` directory through a local web server, such as Apache in XAMPP. Open `Warenkorb.html` through that server rather than as a `file://` URL.
4. The frontend API origin is configured by the `api-base` meta tag in `frontend/src/Warenkorb.html`.

The frontend registers and logs in through `/api/auth`, then sends the returned JWT as a Bearer token to `/api/artikel`. The token is kept in session storage and is cleared when you sign out or end the browser session.
## Backend automatisch auf dem Oracle VPS deployen

Der Workflow `.github/workflows/deploy-backend.yml` baut das Backend bei Änderungen
unter `backend/` und startet den systemd-Dienst `universal-cart` auf dem VPS neu.
Dafür werden diese GitHub-Repository-Secrets benötigt:

- `VPS_HOST`: Hostname oder IP-Adresse des VPS
- `VPS_USER`: SSH-Benutzer
- `VPS_SSH_KEY`: privater SSH-Schlüssel
- `VPS_KNOWN_HOSTS`: Ausgabe von `ssh-keyscan -H <VPS_HOST>`

Wenn der Workflow mit `VPS_KNOWN_HOSTS enthält keinen Host-Key` abbricht,
ersetze den Secret-Wert durch die aktuelle Ausgabe von:

```bash
ssh-keyscan -H <VPS_HOST>
```

`VPS_HOST` darf dabei nur den Hostnamen oder die IP-Adresse enthalten, ohne
`https://`, Port oder Pfad.

Einmalig auf dem VPS vorbereiten:

```bash
sudo useradd --system --home /opt/universal-cart --shell /usr/sbin/nologin universal-cart
sudo mkdir -p /opt/universal-cart
sudo chown -R universal-cart:universal-cart /opt/universal-cart
sudo nano /etc/systemd/system/universal-cart.service
```

Inhalt der Service-Datei:

```ini
[Unit]
Description=Universal Cart Backend
After=network-online.target
Wants=network-online.target

[Service]
User=universal-cart
Group=universal-cart
WorkingDirectory=/opt/universal-cart
EnvironmentFile=/etc/universal-cart/backend.env
ExecStart=/usr/bin/java -jar /opt/universal-cart/backend.jar
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Danach den Dienst aktivieren:

```bash
sudo systemctl daemon-reload
sudo systemctl enable universal-cart
sudo systemctl status universal-cart
```

Lege außerdem `/etc/universal-cart/backend.env` mit den Backend-Variablen an.
Nach dem ersten erfolgreichen GitHub-Actions-Deployment wird die JAR kopiert
und der Dienst automatisch gestartet.

Die Datei `/etc/universal-cart/backend.env` enthält die Datenbank- und JWT-Secrets
und wird nicht ins Repository eingecheckt. Der SSH-Benutzer benötigt außerdem
eine gezielte `sudoers`-Regel für `install` und `systemctl restart/is-active
universal-cart`, damit der Workflow ohne interaktives Passwort deployen kann.

## Einmalige Produktions-Einrichtung

### 1. GitHub Pages

1. Push die Änderungen auf `main`. Der Workflow `deploy-pages.yml` veröffentlicht
   `frontend/src` und nimmt dabei die Datei `frontend/src/CNAME` mit.
2. Öffne im Repository **Settings → Pages**.
3. Wähle **GitHub Actions** als Source und trage unter **Custom domain**
   `my-scout.app` ein. Speichere und warte, bis GitHub die DNS-Prüfung
   bestätigt. Aktiviere danach **Enforce HTTPS**.
4. GitHub stellt das SSL-Zertifikat für `my-scout.app` nach erfolgreicher
   DNS-Verifizierung automatisch bereit. Aktiviere danach **Enforce HTTPS**.
   Die Seite muss unter `https://my-scout.app/Warenkorb.html` und
   `https://my-scout.app/` erreichbar sein. `index.html` leitet automatisch auf
   `Warenkorb.html` weiter.

### 2. DNS bei Name.com

Im Name.com-DNS-Editor des Domains `my-scout.app` vorhandene widersprüchliche
`A`, `AAAA` und `CNAME`-Einträge für `@` und `www` entfernen und diese Einträge
anlegen:

| Host | Typ | Wert |
|---|---|---|
| `@` | `A` | `185.199.108.153` |
| `@` | `A` | `185.199.109.153` |
| `@` | `A` | `185.199.110.153` |
| `@` | `A` | `185.199.111.153` |
| `www` | `CNAME` | `vecto07.github.io` |
| `api` | `A` | öffentliche IPv4-Adresse des VPS |

Set TTL auf den kleinsten sinnvollen Wert während der Umstellung (z. B. 300
Sekunden). Die GitHub-IPs sind die offiziellen Pages-Apex-Adressen; keine
Wildcard-DNS-Regel für `api` verwenden. DNS-Änderungen können bis zu 24 Stunden
benötigen. Prüfe mit `nslookup my-scout.app` und
`nslookup api.my-scout.app`.

### 3. VPS vorbereiten

Auf Ubuntu/Debian als Administrator:

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx postgresql
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Lege die Datenbank an und setze die geheimen Werte (niemals in Git):

```bash
sudo -u postgres createuser --pwprompt universal_cart
sudo -u postgres createdb -O universal_cart warenkorb
sudo install -d -o root -g universal-cart -m 0750 /etc/universal-cart
sudo nano /etc/universal-cart/backend.env
```

Inhalt von `/etc/universal-cart/backend.env` (mindestens 32 zufällige Zeichen
für `APP_JWT_SECRET`):

```dotenv
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/warenkorb
SPRING_DATASOURCE_USERNAME=universal_cart
SPRING_DATASOURCE_PASSWORD=<langes-db-passwort>
APP_JWT_SECRET=<mindestens-32-zeichen-zufallswert>
```

Setze danach die Rechte:

```bash
sudo chown root:universal-cart /etc/universal-cart/backend.env
sudo chmod 640 /etc/universal-cart/backend.env
```

Lege den Reverse Proxy für TLS an:

```bash
sudo nano /etc/nginx/sites-available/my-scout-api
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name api.my-scout.app;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Aktiviere und teste Nginx, hole anschließend das Zertifikat:

```bash
sudo ln -s /etc/nginx/sites-available/my-scout-api /etc/nginx/sites-enabled/my-scout-api
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d api.my-scout.app
sudo systemctl enable --now certbot.timer
```

Der Backend-Dienst muss auf `127.0.0.1:8080` laufen; Port 8080 wird nicht
öffentlich in der Firewall freigegeben. Der vorhandene
`/etc/systemd/system/universal-cart.service` nutzt die env-Datei. Danach:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now universal-cart
sudo systemctl status universal-cart --no-pager
curl -i https://api.my-scout.app/api/auth/login
```

Ein `401` oder `405` bei diesem letzten Test bestätigt, dass HTTPS, Nginx und
die Anwendung erreichbar sind; ein DNS- oder `502`-Fehler muss zuerst behoben
werden.

### 4. GitHub Actions Secrets

Unter **Settings → Secrets and variables → Actions** als Repository-Secrets
setzen:

- `VPS_HOST`: nur VPS-IP oder Hostname, ohne `https://` und ohne Port
- `VPS_USER`: SSH-Benutzer
- `VPS_SSH_KEY`: privater SSH-Key für diesen Benutzer
- `VPS_KNOWN_HOSTS`: Ausgabe von `ssh-keyscan -H <VPS_HOST>`

Der öffentliche Schlüssel muss in `~/.ssh/authorized_keys` des VPS-Benutzers
liegen. Der Benutzer braucht eine eingeschränkte `sudoers`-Regel für
`install`, `systemctl restart universal-cart` und
`systemctl is-active universal-cart`. Push danach nach `main`, prüfe beide
Workflows unter **Actions**, lösche den Browser-Cache und teste Registrierung,
Login, Speichern und Löschen.