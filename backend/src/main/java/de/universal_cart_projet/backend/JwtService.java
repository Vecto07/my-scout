package de.universal_cart_projet.backend;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import javax.crypto.SecretKey;
import java.util.Date;

@Service
public class JwtService {

    private final SecretKey key;

    public JwtService(@Value("${app.jwt.secret}") String secret) {
        if (secret == null || secret.length() < 32) {
            throw new IllegalArgumentException("app.jwt.secret must contain at least 32 characters");
        }
        key = Keys.hmacShaKeyFor(secret.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    public String generiereToken(String benutzername) {
        return Jwts.builder()
                .subject(benutzername) // Für wen ist der Ausweis?
                .issuedAt(new Date(System.currentTimeMillis())) // Ausgestellt jetzt
                .expiration(new Date(System.currentTimeMillis() + 1000 * 60 * 60 * 24)) // Gültig für 1 Tag (24h)
                .signWith(key) // Digitale Unterschrift mit dem geheimen Schlüssel
                .compact();
    }

    public String extrahiereBenutzername(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .getSubject();
    }
}