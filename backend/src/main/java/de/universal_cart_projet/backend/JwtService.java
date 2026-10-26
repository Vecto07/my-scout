package de.universal_cart_projet.backend;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;
import javax.crypto.SecretKey;
import java.util.Date;

@Service
public class JwtService {

    // Dieser geheime Schlüssel bleibt nur dem Server bekannt (Muss mind. 32 Zeichen lang sein)
    private static final String SECRET = "MeinSuperGeheimesUndSehrLangesPasswortFuerJwtTokens123!";
    private final SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes());

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