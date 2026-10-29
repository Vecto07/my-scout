# Universal Cart Project

## Run the application locally

1. Start PostgreSQL and configure the database connection for the backend in `backend/src/main/resources/application.properties`. Keep database credentials out of version control.
2. Use Java 21 and start Spring Boot from the `backend` directory with `mvnw.cmd spring-boot:run` on Windows (or `./mvnw spring-boot:run` on macOS/Linux). The API listens on port 8080 by default.
3. Serve the `frontend` directory through a local web server, such as Apache in XAMPP. Open `Warenkorb.html` through that server rather than as a `file://` URL.
4. The frontend API origin is configured by the `api-base` meta tag in `frontend/Warenkorb.html`; it defaults to `http://localhost:8080`. Change it to the deployed backend origin when hosting elsewhere.

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
ExecStart=/usr/bin/java -jar /opt/universal-cart/backend.jar
Restart=on-failure
RestartSec=5
EnvironmentFile=/etc/universal-cart/backend.env

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