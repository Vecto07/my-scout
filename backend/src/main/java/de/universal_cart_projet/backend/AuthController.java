package de.universal_cart_projet.backend;

import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    private final BenutzerRepository benutzerRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    // Dependency Injection für alle drei Werkzeuge
    public AuthController(BenutzerRepository benutzerRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.benutzerRepository = benutzerRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @PostMapping("/register")
    public ResponseEntity<String> registrieren(@RequestBody RegistrierungRequest request) {
        if (benutzerRepository.findByBenutzername(request.benutzername()).isPresent()) {
            return ResponseEntity.badRequest().body("Benutzername existiert bereits!");
        }

        Benutzer neuerNutzer = new Benutzer();
        neuerNutzer.setBenutzername(request.benutzername());
        neuerNutzer.setEmail(request.email());
        neuerNutzer.setPasswort(passwordEncoder.encode(request.passwort()));

        benutzerRepository.save(neuerNutzer);
        return ResponseEntity.ok("Benutzer erfolgreich registriert!");
    }

    @PostMapping("/login")
    public ResponseEntity<String> login(@RequestBody LoginRequest request) {
        Optional<Benutzer> benutzerOptional = benutzerRepository.findByBenutzername(request.benutzername());

        // 1. Prüfen, ob der Nutzer überhaupt existiert
        if (benutzerOptional.isEmpty()) {
            return ResponseEntity.status(401).body("Benutzer existiert nicht!");
        }

        Benutzer benutzer = benutzerOptional.get();

        // 2. Passwort mit dem Hash aus der Datenbank abgleichen
        if (!passwordEncoder.matches(request.passwort(), benutzer.getPasswort())) {
            return ResponseEntity.status(401).body("Falsches Passwort!");
        }

        // 3. Wenn alles stimmt: Token generieren und zurückgeben
        String token = jwtService.generiereToken(benutzer.getBenutzername());
        return ResponseEntity.ok(token);
    }
}