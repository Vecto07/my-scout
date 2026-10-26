# Universal Cart Project

## Run the application locally

1. Start PostgreSQL and configure the database connection for the backend in `backend/src/main/resources/application.properties`. Keep database credentials out of version control.
2. Use Java 21 and start Spring Boot from the `backend` directory with `mvnw.cmd spring-boot:run` on Windows (or `./mvnw spring-boot:run` on macOS/Linux). The API listens on port 8080 by default.
3. Serve the `frontend` directory through a local web server, such as Apache in XAMPP. Open `Warenkorb.html` through that server rather than as a `file://` URL.
4. The frontend API origin is configured by the `api-base` meta tag in `frontend/Warenkorb.html`; it defaults to `http://localhost:8080`. Change it to the deployed backend origin when hosting elsewhere.

The frontend registers and logs in through `/api/auth`, then sends the returned JWT as a Bearer token to `/api/artikel`. The token is kept in session storage and is cleared when you sign out or end the browser session.