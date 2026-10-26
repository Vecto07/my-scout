import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.math.BigDecimal;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.Collections;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;

public final class Warenkorbfunktion {
    private static final int PASSWORD_ITERATIONS = 160000;
    private static final int MAX_REQUEST_BYTES = 16384;
    private static final long SESSION_LIFETIME_SECONDS = 43200;
    private static final String SESSION_COOKIE = "WARENKORB_SESSION";
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final JsonReader JSON = new JsonReader();

    private Warenkorbfunktion() {
    }

    public static void main(String[] args) throws Exception {
        int port = args.length > 0 ? Integer.parseInt(args[0]) : 8080;
        Path webRoot = args.length > 1 ? Paths.get(args[1]) : Paths.get(System.getProperty("user.dir"));
        Path dataRoot = args.length > 2
            ? Paths.get(args[2])
            : Paths.get(System.getProperty("user.home"), ".warenkorb");
        if (port < 1 || port > 65535) {
            throw new IllegalArgumentException("Der Port muss zwischen 1 und 65535 liegen.");
        }
        webRoot = webRoot.toRealPath();
        Files.createDirectories(dataRoot.toAbsolutePath().normalize());
        dataRoot = dataRoot.toRealPath();
        if (dataRoot.startsWith(webRoot)) {
            throw new IllegalArgumentException("Der Datenordner muss außerhalb des öffentlich ausgelieferten Webordners liegen.");
        }
        Store store = new Store(dataRoot);
        SessionStore sessions = new SessionStore();
        HttpServer server = HttpServer.create(new InetSocketAddress(InetAddress.getByName("127.0.0.1"), port), 0);
        server.createContext("/api/", new ApiHandler(store, sessions));
        server.createContext("/", new StaticHandler(webRoot, dataRoot));
        server.setExecutor(Executors.newFixedThreadPool(8));
        Runtime.getRuntime().addShutdownHook(new Thread(() -> server.stop(0), "warenkorb-shutdown"));
        server.start();
        System.out.println("Warenkorb läuft auf http://127.0.0.1:" + port + "/");
        System.out.println("Webdateien: " + webRoot);
        System.out.println("Konten- und Linkdaten: " + dataRoot.toAbsolutePath().normalize());
    }

    private static final class ApiHandler implements HttpHandler {
        private final Store store;
        private final SessionStore sessions;

        private ApiHandler(Store store, SessionStore sessions) {
            this.store = store;
            this.sessions = sessions;
        }

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            try {
                route(exchange);
            } catch (RequestException error) {
                sendJson(exchange, error.status, object("error", error.getMessage()));
            } catch (Exception error) {
                error.printStackTrace(System.err);
                sendJson(exchange, 500, object("error", "Interner Serverfehler. Bitte prüfe das Serverprotokoll."));
            } finally {
                exchange.close();
            }
        }

        private void route(HttpExchange exchange) throws Exception {
            String method = exchange.getRequestMethod();
            String path = exchange.getRequestURI().getPath();

            if ("/api/session".equals(path) && "GET".equals(method)) {
                User user = sessions.userForCookie(exchange.getRequestHeaders(), store);
                sendJson(exchange, 200, object("user", user == null ? null : publicUser(user)));
                return;
            }
            if ("/api/register".equals(path) && "POST".equals(method)) {
                Map<?, ?> body = requestObject(exchange);
                User user = store.register(requiredString(body, "email"), requiredString(body, "password"));
                createSession(exchange, user);
                sendJson(exchange, 201, object("user", publicUser(user)));
                return;
            }
            if ("/api/login".equals(path) && "POST".equals(method)) {
                Map<?, ?> body = requestObject(exchange);
                User user = store.login(requiredString(body, "email"), requiredString(body, "password"));
                createSession(exchange, user);
                sendJson(exchange, 200, object("user", publicUser(user)));
                return;
            }
            if ("/api/logout".equals(path) && "POST".equals(method)) {
                sessions.remove(cookieValue(exchange.getRequestHeaders()));
                exchange.getResponseHeaders().add("Set-Cookie", SESSION_COOKIE + "=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0");
                sendJson(exchange, 200, object("ok", Boolean.TRUE));
                return;
            }
            if ("/api/links".equals(path) && "GET".equals(method)) {
                User user = requireUser(exchange);
                sendJson(exchange, 200, linksJson(store.linksFor(user.id)));
                return;
            }
            if ("/api/links".equals(path) && "POST".equals(method)) {
                User user = requireUser(exchange);
                Map<?, ?> body = requestObject(exchange);
                SavedLink link = store.addLink(
                    user.id,
                    requiredString(body, "title"),
                    requiredString(body, "url"),
                    requiredString(body, "type"),
                    optionalString(body, "tag")
                );
                sendJson(exchange, 201, linkJson(link));
                return;
            }
            if (path.startsWith("/api/links/") && "DELETE".equals(method)) {
                User user = requireUser(exchange);
                String id = path.substring("/api/links/".length());
                if (id.isEmpty() || id.contains("/")) {
                    throw new RequestException(400, "Der Link ist ungültig.");
                }
                if (!store.removeLink(user.id, id)) {
                    throw new RequestException(404, "Der Link wurde nicht gefunden.");
                }
                sendJson(exchange, 200, object("ok", Boolean.TRUE));
                return;
            }
            if (path.startsWith("/api/")) {
                throw new RequestException(404, "API-Endpunkt nicht gefunden.");
            }
            throw new RequestException(405, "HTTP-Methode nicht erlaubt.");
        }

        private User requireUser(HttpExchange exchange) throws RequestException {
            User user = sessions.userForCookie(exchange.getRequestHeaders(), store);
            if (user == null) {
                throw new RequestException(401, "Bitte melde dich erneut an.");
            }
            return user;
        }

        private void createSession(HttpExchange exchange, User user) {
            String token = sessions.create(user.id);
            exchange.getResponseHeaders().add("Set-Cookie",
                SESSION_COOKIE + "=" + token + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=" + SESSION_LIFETIME_SECONDS);
        }
    }

    private static final class StaticHandler implements HttpHandler {
        private final Path root;
        private final Path privateDataRoot;

        private StaticHandler(Path root, Path privateDataRoot) {
            this.root = root;
            this.privateDataRoot = privateDataRoot;
        }

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            try {
                if (!"GET".equals(exchange.getRequestMethod()) && !"HEAD".equals(exchange.getRequestMethod())) {
                    exchange.getResponseHeaders().set("Allow", "GET, HEAD");
                    sendText(exchange, 405, "Methode nicht erlaubt.");
                    return;
                }
                String relative = exchange.getRequestURI().getPath();
                if (relative == null || "/".equals(relative)) relative = "/index.html";
                String fileName = relative.startsWith("/") ? relative.substring(1) : relative;
                if (!"index.html".equals(fileName) && !"Warenkorb.html".equals(fileName)
                    && !"Warenkorb_Desin.css".equals(fileName) && !"Warenkorb.js".equals(fileName)) {
                    sendText(exchange, 404, "Datei nicht gefunden.");
                    return;
                }
                Path candidate = root.resolve(fileName).normalize();
                if (!candidate.startsWith(root) || !Files.isRegularFile(candidate)) {
                    sendText(exchange, 404, "Datei nicht gefunden.");
                    return;
                }
                Path realFile = candidate.toRealPath();
                if (!realFile.startsWith(root) || realFile.startsWith(privateDataRoot)) {
                    sendText(exchange, 404, "Datei nicht gefunden.");
                    return;
                }
                byte[] content = Files.readAllBytes(realFile);
                Headers headers = exchange.getResponseHeaders();
                headers.set("Content-Type", contentType(realFile));
                headers.set("X-Content-Type-Options", "nosniff");
                headers.set("Referrer-Policy", "no-referrer");
                headers.set("Cache-Control", "no-cache");
                headers.set("Content-Security-Policy",
                    "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
                if ("HEAD".equals(exchange.getRequestMethod())) {
                    exchange.sendResponseHeaders(200, -1);
                    return;
                }
                exchange.sendResponseHeaders(200, content.length);
                exchange.getResponseBody().write(content);
            } catch (IOException error) {
                error.printStackTrace(System.err);
                sendText(exchange, 500, "Die angeforderte Datei konnte nicht gelesen werden.");
            } finally {
                exchange.close();
            }
        }

        private static String contentType(Path file) {
            String name = file.getFileName().toString().toLowerCase(Locale.ROOT);
            if (name.endsWith(".html")) return "text/html; charset=utf-8";
            if (name.endsWith(".css")) return "text/css; charset=utf-8";
            if (name.endsWith(".js")) return "application/javascript; charset=utf-8";
            if (name.endsWith(".svg")) return "image/svg+xml";
            if (name.endsWith(".png")) return "image/png";
            if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
            return "application/octet-stream";
        }
    }

    private static final class Store {
        private final Path directory;
        private final Path usersFile;
        private final Path linksFile;
        private final Map<String, User> usersByEmail = new LinkedHashMap<String, User>();
        private final Map<String, SavedLink> linksById = new LinkedHashMap<String, SavedLink>();

        private Store(Path directory) throws IOException {
            this.directory = directory;
            this.usersFile = directory.resolve("users.tsv");
            this.linksFile = directory.resolve("links.tsv");
            Files.createDirectories(directory);
            loadUsers();
            loadLinks();
        }

        private synchronized User register(String rawEmail, String password) throws RequestException, IOException, GeneralSecurityException {
            String email = normalizeEmail(rawEmail);
            validatePassword(password);
            if (usersByEmail.containsKey(email)) {
                throw new RequestException(409, "Für diese E-Mail-Adresse gibt es bereits ein Konto.");
            }
            byte[] salt = new byte[16];
            RANDOM.nextBytes(salt);
            User user = new User(UUID.randomUUID().toString(), email, salt, passwordHash(password, salt));
            usersByEmail.put(email, user);
            try {
                saveUsers();
            } catch (IOException error) {
                usersByEmail.remove(email);
                throw error;
            }
            return user;
        }

        private synchronized User login(String rawEmail, String password) throws RequestException, GeneralSecurityException {
            String email = normalizeEmail(rawEmail);
            if (password == null || password.length() > 128) {
                throw new RequestException(401, "E-Mail-Adresse oder Passwort ist nicht korrekt.");
            }
            User user = usersByEmail.get(email);
            byte[] salt = user == null ? new byte[16] : user.salt;
            byte[] expected = user == null ? new byte[32] : user.passwordHash;
            byte[] actual = passwordHash(password, salt);
            if (user == null || !MessageDigest.isEqual(expected, actual)) {
                throw new RequestException(401, "E-Mail-Adresse oder Passwort ist nicht korrekt.");
            }
            return user;
        }

        private synchronized List<SavedLink> linksFor(String ownerId) {
            List<SavedLink> result = new ArrayList<SavedLink>();
            for (SavedLink link : linksById.values()) {
                if (link.ownerId.equals(ownerId)) result.add(link);
            }
            Collections.reverse(result);
            return result;
        }

        private synchronized SavedLink addLink(String ownerId, String title, String rawUrl, String type, String rawTag) throws RequestException, IOException {
            title = title.trim();
            if (title.isEmpty() || title.length() > 100) throw new RequestException(400, "Der Titel muss zwischen 1 und 100 Zeichen lang sein.");
            if (!"product".equals(type) && !"cart".equals(type)) throw new RequestException(400, "Bitte wähle Produkt oder Warenkorb.");
            String url = validateUrl(rawUrl);
            String tag = validateTag(rawTag);
            SavedLink link = new SavedLink(UUID.randomUUID().toString(), ownerId, title, url, type, Instant.now().toString(), tag);
            linksById.put(link.id, link);
            try {
                saveLinks();
            } catch (IOException error) {
                linksById.remove(link.id);
                throw error;
            }
            return link;
        }

        private synchronized boolean removeLink(String ownerId, String linkId) throws IOException {
            SavedLink link = linksById.get(linkId);
            if (link == null || !link.ownerId.equals(ownerId)) return false;
            linksById.remove(linkId);
            try {
                saveLinks();
            } catch (IOException error) {
                linksById.put(linkId, link);
                throw error;
            }
            return true;
        }

        private void loadUsers() throws IOException {
            if (!Files.exists(usersFile)) return;
            int lineNumber = 0;
            for (String line : Files.readAllLines(usersFile, StandardCharsets.UTF_8)) {
                lineNumber++;
                String[] fields = line.split("\t", -1);
                if (fields.length != 4) throw new IOException("Ungültiger Datensatz in users.tsv, Zeile " + lineNumber + ".");
                try {
                    User user = new User(decode(fields[0]), decode(fields[1]), Base64.getDecoder().decode(fields[2]), Base64.getDecoder().decode(fields[3]));
                    if (user.salt.length != 16 || user.passwordHash.length != 32 || usersByEmail.put(user.email, user) != null) {
                        throw new IOException("Ungültiger oder doppelter Kontodatensatz in users.tsv, Zeile " + lineNumber + ".");
                    }
                } catch (IllegalArgumentException error) {
                    throw new IOException("Ungültige Kodierung in users.tsv, Zeile " + lineNumber + ".", error);
                }
            }
        }

        private void loadLinks() throws IOException {
            if (!Files.exists(linksFile)) return;
            int lineNumber = 0;
            for (String line : Files.readAllLines(linksFile, StandardCharsets.UTF_8)) {
                lineNumber++;
                String[] fields = line.split("\t", -1);
                if (fields.length != 6 && fields.length != 7) throw new IOException("Ungültiger Datensatz in links.tsv, Zeile " + lineNumber + ".");
                try {
                    String tag = fields.length == 7 ? decode(fields[6]) : "";
                    SavedLink link = new SavedLink(decode(fields[0]), decode(fields[1]), decode(fields[2]), decode(fields[3]), decode(fields[4]), decode(fields[5]), tag);
                    validateTag(tag);
                    if (!usersByIdContains(link.ownerId) || linksById.put(link.id, link) != null
                        || (!"product".equals(link.type) && !"cart".equals(link.type))) {
                        throw new IOException("Ungültiger oder doppelter Linkdatensatz in links.tsv, Zeile " + lineNumber + ".");
                    }
                } catch (IllegalArgumentException error) {
                    throw new IOException("Ungültige Kodierung in links.tsv, Zeile " + lineNumber + ".", error);
                } catch (RequestException error) {
                    throw new IOException("Ungültiges Tag in links.tsv, Zeile " + lineNumber + ".", error);
                }
            }
        }

        private boolean usersByIdContains(String userId) {
            for (User user : usersByEmail.values()) if (user.id.equals(userId)) return true;
            return false;
        }

        private synchronized void saveUsers() throws IOException {
            StringBuilder contents = new StringBuilder();
            for (User user : usersByEmail.values()) {
                contents.append(encode(user.id)).append('\t')
                    .append(encode(user.email)).append('\t')
                    .append(Base64.getEncoder().encodeToString(user.salt)).append('\t')
                    .append(Base64.getEncoder().encodeToString(user.passwordHash)).append('\n');
            }
            replaceFile(usersFile, contents.toString());
        }

        private synchronized void saveLinks() throws IOException {
            StringBuilder contents = new StringBuilder();
            for (SavedLink link : linksById.values()) {
                contents.append(encode(link.id)).append('\t')
                    .append(encode(link.ownerId)).append('\t')
                    .append(encode(link.title)).append('\t')
                    .append(encode(link.url)).append('\t')
                    .append(encode(link.type)).append('\t')
                    .append(encode(link.createdAt)).append('\t')
                    .append(encode(link.tag)).append('\n');
            }
            replaceFile(linksFile, contents.toString());
        }

        private void replaceFile(Path target, String contents) throws IOException {
            Files.createDirectories(directory);
            Path temporary = Files.createTempFile(directory, target.getFileName().toString(), ".tmp");
            try {
                Files.write(temporary, contents.getBytes(StandardCharsets.UTF_8));
                try {
                    Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
                } catch (AtomicMoveNotSupportedException error) {
                    Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING);
                }
            } finally {
                Files.deleteIfExists(temporary);
            }
        }
    }

    private static final class SessionStore {
        private final Map<String, Session> sessions = new ConcurrentHashMap<String, Session>();

        private String create(String userId) {
            byte[] token = new byte[32];
            RANDOM.nextBytes(token);
            String value = Base64.getUrlEncoder().withoutPadding().encodeToString(token);
            sessions.put(value, new Session(userId, Instant.now().plusSeconds(SESSION_LIFETIME_SECONDS)));
            return value;
        }

        private User userForCookie(Headers headers, Store store) {
            String token = cookieValue(headers);
            if (token == null) return null;
            Session session = sessions.get(token);
            if (session == null) return null;
            if (session.expiresAt.isBefore(Instant.now())) {
                sessions.remove(token);
                return null;
            }
            synchronized (store) {
                for (User user : store.usersByEmail.values()) if (user.id.equals(session.userId)) return user;
            }
            sessions.remove(token);
            return null;
        }

        private void remove(String token) {
            if (token != null) sessions.remove(token);
        }
    }

    private static final class Session {
        private final String userId;
        private final Instant expiresAt;

        private Session(String userId, Instant expiresAt) {
            this.userId = userId;
            this.expiresAt = expiresAt;
        }
    }

    private static final class User {
        private final String id;
        private final String email;
        private final byte[] salt;
        private final byte[] passwordHash;

        private User(String id, String email, byte[] salt, byte[] passwordHash) {
            this.id = id;
            this.email = email;
            this.salt = salt;
            this.passwordHash = passwordHash;
        }
    }

    private static final class SavedLink {
        private final String id;
        private final String ownerId;
        private final String title;
        private final String url;
        private final String type;
        private final String createdAt;
        private final String tag;

        private SavedLink(String id, String ownerId, String title, String url, String type, String createdAt, String tag) {
            this.id = id;
            this.ownerId = ownerId;
            this.title = title;
            this.url = url;
            this.type = type;
            this.createdAt = createdAt;
            this.tag = tag;
        }
    }

    private static final class JsonReader {
        private String input;
        private int index;

        private synchronized Map<?, ?> parseObject(String source) throws RequestException {
            input = source;
            index = 0;
            skipWhitespace();
            Object value = readValue(0);
            skipWhitespace();
            if (index != input.length() || !(value instanceof Map)) {
                throw new RequestException(400, "Die Anfrage muss ein gültiges JSON-Objekt enthalten.");
            }
            return (Map<?, ?>) value;
        }

        private Object readValue(int depth) throws RequestException {
            skipWhitespace();
            if (index >= input.length() || depth > 32) throw invalidJson();
            char character = input.charAt(index);
            if (character == '{') return readObject(depth);
            if (character == '[') return readArray(depth);
            if (character == '"') return readString();
            if (character == 't') return readLiteral("true", Boolean.TRUE);
            if (character == 'f') return readLiteral("false", Boolean.FALSE);
            if (character == 'n') return readLiteral("null", null);
            if (character == '-' || (character >= '0' && character <= '9')) return readNumber();
            throw invalidJson();
        }

        private Map<String, Object> readObject(int depth) throws RequestException {
            Map<String, Object> result = new LinkedHashMap<String, Object>();
            index++;
            skipWhitespace();
            if (consume('}')) return result;
            while (true) {
                skipWhitespace();
                if (index >= input.length() || input.charAt(index) != '"') throw invalidJson();
                String key = readString();
                skipWhitespace();
                if (!consume(':')) throw invalidJson();
                if (result.containsKey(key)) throw invalidJson();
                result.put(key, readValue(depth + 1));
                skipWhitespace();
                if (consume('}')) return result;
                if (!consume(',')) throw invalidJson();
            }
        }

        private List<Object> readArray(int depth) throws RequestException {
            List<Object> result = new ArrayList<Object>();
            index++;
            skipWhitespace();
            if (consume(']')) return result;
            while (true) {
                result.add(readValue(depth + 1));
                skipWhitespace();
                if (consume(']')) return result;
                if (!consume(',')) throw invalidJson();
            }
        }

        private String readString() throws RequestException {
            index++;
            StringBuilder result = new StringBuilder();
            while (index < input.length()) {
                char character = input.charAt(index++);
                if (character == '"') return result.toString();
                if (character < 0x20) throw invalidJson();
                if (character != '\\') {
                    result.append(character);
                    continue;
                }
                if (index >= input.length()) throw invalidJson();
                char escaped = input.charAt(index++);
                if (escaped == '"' || escaped == '\\' || escaped == '/') result.append(escaped);
                else if (escaped == 'b') result.append('\b');
                else if (escaped == 'f') result.append('\f');
                else if (escaped == 'n') result.append('\n');
                else if (escaped == 'r') result.append('\r');
                else if (escaped == 't') result.append('\t');
                else if (escaped == 'u') result.append(readUnicodeEscape());
                else throw invalidJson();
            }
            throw invalidJson();
        }

        private char readUnicodeEscape() throws RequestException {
            if (index + 4 > input.length()) throw invalidJson();
            int value = 0;
            for (int offset = 0; offset < 4; offset++) {
                int digit = hexValue(input.charAt(index++));
                if (digit < 0) throw invalidJson();
                value = (value << 4) | digit;
            }
            return (char) value;
        }

        private Object readNumber() throws RequestException {
            int start = index;
            consume('-');
            if (consume('0')) {
                if (index < input.length() && isDigit(input.charAt(index))) throw invalidJson();
            } else {
                if (index >= input.length() || input.charAt(index) < '1' || input.charAt(index) > '9') throw invalidJson();
                while (index < input.length() && isDigit(input.charAt(index))) index++;
            }
            if (consume('.')) {
                int fractionStart = index;
                while (index < input.length() && isDigit(input.charAt(index))) index++;
                if (fractionStart == index) throw invalidJson();
            }
            if (consume('e') || consume('E')) {
                if (!consume('+')) consume('-');
                int exponentStart = index;
                while (index < input.length() && isDigit(input.charAt(index))) index++;
                if (exponentStart == index) throw invalidJson();
            }
            try {
                return new BigDecimal(input.substring(start, index));
            } catch (NumberFormatException error) {
                throw invalidJson();
            }
        }

        private Object readLiteral(String literal, Object value) throws RequestException {
            if (!input.regionMatches(index, literal, 0, literal.length())) throw invalidJson();
            index += literal.length();
            return value;
        }

        private void skipWhitespace() {
            while (index < input.length()) {
                char character = input.charAt(index);
                if (character != ' ' && character != '\t' && character != '\r' && character != '\n') return;
                index++;
            }
        }

        private boolean isDigit(char character) {
            return character >= '0' && character <= '9';
        }

        private int hexValue(char character) {
            if (character >= '0' && character <= '9') return character - '0';
            if (character >= 'a' && character <= 'f') return character - 'a' + 10;
            if (character >= 'A' && character <= 'F') return character - 'A' + 10;
            return -1;
        }

        private boolean consume(char expected) {
            if (index < input.length() && input.charAt(index) == expected) {
                index++;
                return true;
            }
            return false;
        }

        private RequestException invalidJson() {
            return new RequestException(400, "Die Anfrage enthält ungültiges JSON.");
        }
    }

    private static final class RequestException extends Exception {
        private static final long serialVersionUID = 1L;
        private final int status;

        private RequestException(int status, String message) {
            super(message);
            this.status = status;
        }
    }

    private static Map<?, ?> requestObject(HttpExchange exchange) throws IOException, RequestException {
        String contentType = exchange.getRequestHeaders().getFirst("Content-Type");
        if (contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("application/json")) {
            throw new RequestException(415, "Die Anfrage muss als JSON gesendet werden.");
        }
        byte[] bytes = readLimited(exchange.getRequestBody(), MAX_REQUEST_BYTES);
        return JSON.parseObject(new String(bytes, StandardCharsets.UTF_8));
    }

    private static byte[] readLimited(InputStream input, int maximum) throws IOException, RequestException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[2048];
        int total = 0;
        int read;
        while ((read = input.read(buffer)) != -1) {
            total += read;
            if (total > maximum) throw new RequestException(413, "Die Anfrage ist zu groß.");
            output.write(buffer, 0, read);
        }
        return output.toByteArray();
    }

    private static String requiredString(Map<?, ?> object, String key) throws RequestException {
        Object value = object.get(key);
        if (!(value instanceof String)) throw new RequestException(400, "Das Feld " + key + " fehlt oder ist ungültig.");
        return (String) value;
    }

    private static String optionalString(Map<?, ?> object, String key) throws RequestException {
        Object value = object.get(key);
        if (value == null) return "";
        if (!(value instanceof String)) throw new RequestException(400, "Das Feld " + key + " muss Text enthalten.");
        return (String) value;
    }

    private static String normalizeEmail(String rawEmail) throws RequestException {
        if (rawEmail == null) throw new RequestException(400, "Bitte gib eine gültige E-Mail-Adresse ein.");
        String email = rawEmail.trim().toLowerCase(Locale.ROOT);
        if (email.length() > 254 || !EMAIL_PATTERN.matcher(email).matches()) {
            throw new RequestException(400, "Bitte gib eine gültige E-Mail-Adresse ein.");
        }
        return email;
    }

    private static void validatePassword(String password) throws RequestException {
        if (password == null || password.length() < 8 || password.length() > 128) {
            throw new RequestException(400, "Das Passwort muss zwischen 8 und 128 Zeichen lang sein.");
        }
    }

    private static String validateTag(String rawTag) throws RequestException {
        if (rawTag == null || rawTag.trim().isEmpty()) return "";
        String tag = rawTag.trim();
        if (tag.length() > 32 || !tag.matches("#[\\p{L}\\p{M}\\p{N}_-]{1,31}")) {
            throw new RequestException(400, "Ein Tag muss mit # beginnen und danach 1 bis 31 Buchstaben, Zahlen, _ oder - enthalten.");
        }
        return tag;
    }

    private static String validateUrl(String rawUrl) throws RequestException {
        if (rawUrl == null || rawUrl.length() > 2048) throw new RequestException(400, "Bitte gib eine gültige Webadresse ein.");
        try {
            URI uri = new URI(rawUrl.trim()).normalize();
            String scheme = uri.getScheme();
            if (scheme == null || (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme))
                || uri.getHost() == null || uri.getUserInfo() != null) {
                throw new RequestException(400, "Bitte verwende einen gültigen HTTP- oder HTTPS-Link.");
            }
            return uri.toASCIIString();
        } catch (java.net.URISyntaxException error) {
            throw new RequestException(400, "Bitte gib eine gültige Webadresse ein.");
        }
    }

    private static byte[] passwordHash(String password, byte[] salt) throws GeneralSecurityException {
        byte[] passwordBytes = password.getBytes(StandardCharsets.UTF_8);
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(passwordBytes, "HmacSHA256"));
        byte[] firstBlock = Arrays.copyOf(salt, salt.length + 4);
        firstBlock[firstBlock.length - 1] = 1;
        byte[] current = mac.doFinal(firstBlock);
        byte[] result = current.clone();
        for (int iteration = 1; iteration < PASSWORD_ITERATIONS; iteration++) {
            current = mac.doFinal(current);
            for (int index = 0; index < result.length; index++) result[index] ^= current[index];
        }
        Arrays.fill(passwordBytes, (byte) 0);
        return result;
    }

    private static String cookieValue(Headers headers) {
        List<String> cookies = headers.get("Cookie");
        if (cookies == null) return null;
        for (String header : cookies) {
            for (String part : header.split(";")) {
                String cookie = part.trim();
                String prefix = SESSION_COOKIE + "=";
                if (cookie.startsWith(prefix)) {
                    String token = cookie.substring(prefix.length());
                    return token.matches("[A-Za-z0-9_-]{40,50}") ? token : null;
                }
            }
        }
        return null;
    }

    private static Map<String, Object> publicUser(User user) {
        return object("id", user.id, "email", user.email);
    }

    private static String linksJson(List<SavedLink> links) {
        StringBuilder json = new StringBuilder("[");
        for (int index = 0; index < links.size(); index++) {
            if (index > 0) json.append(',');
            json.append(linkJson(links.get(index)));
        }
        return json.append(']').toString();
    }

    private static String linkJson(SavedLink link) {
        return json(object(
            "id", link.id,
            "title", link.title,
            "url", link.url,
            "type", link.type,
            "createdAt", link.createdAt,
            "tag", link.tag
        ));
    }

    private static Map<String, Object> object(Object... values) {
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        for (int index = 0; index < values.length; index += 2) {
            result.put((String) values[index], values[index + 1]);
        }
        return result;
    }

    private static String json(Map<?, ?> values) {
        StringBuilder output = new StringBuilder("{");
        Iterator<? extends Map.Entry<?, ?>> iterator = values.entrySet().iterator();
        while (iterator.hasNext()) {
            Map.Entry<?, ?> entry = iterator.next();
            if (output.length() > 1) output.append(',');
            if (!(entry.getKey() instanceof String)) throw new IllegalArgumentException("JSON-Objektschlüssel müssen Text sein.");
            output.append(quote((String) entry.getKey())).append(':');
            appendJsonValue(output, entry.getValue());
        }
        return output.append('}').toString();
    }

    private static void appendJsonValue(StringBuilder output, Object value) {
        if (value == null) output.append("null");
        else if (value instanceof Boolean || value instanceof Number) output.append(value.toString());
        else if (value instanceof Map) {
            output.append(json((Map<?, ?>) value));
        } else if (value instanceof List) {
            output.append('[');
            Iterator<?> iterator = ((List<?>) value).iterator();
            while (iterator.hasNext()) {
                appendJsonValue(output, iterator.next());
                if (iterator.hasNext()) output.append(',');
            }
            output.append(']');
        } else output.append(quote(value.toString()));
    }

    private static String quote(String value) {
        StringBuilder output = new StringBuilder("\"");
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if (character == '"') output.append("\\\"");
            else if (character == '\\') output.append("\\\\");
            else if (character == '\b') output.append("\\b");
            else if (character == '\f') output.append("\\f");
            else if (character == '\n') output.append("\\n");
            else if (character == '\r') output.append("\\r");
            else if (character == '\t') output.append("\\t");
            else if (character < 0x20) output.append(String.format("\\u%04x", (int) character));
            else output.append(character);
        }
        return output.append('"').toString();
    }

    private static String encode(String value) {
        return Base64.getEncoder().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private static String decode(String value) {
        return new String(Base64.getDecoder().decode(value), StandardCharsets.UTF_8);
    }

    private static void sendJson(HttpExchange exchange, int status, String content) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.getResponseHeaders().set("Cache-Control", "no-store");
        exchange.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
    }

    private static void sendJson(HttpExchange exchange, int status, Map<?, ?> content) throws IOException {
        sendJson(exchange, status, json(content));
    }

    private static void sendText(HttpExchange exchange, int status, String content) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "text/plain; charset=utf-8");
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
    }
}
