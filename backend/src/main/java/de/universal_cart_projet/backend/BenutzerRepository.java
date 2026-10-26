package de.universal_cart_projet.backend;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface BenutzerRepository extends JpaRepository<Benutzer, Long> {
    // Diese Methode baut Spring Boot automatisch: Sie sucht einen Nutzer anhand seines Namens in der Datenbank
    Optional<Benutzer> findByBenutzername(String benutzername);
}