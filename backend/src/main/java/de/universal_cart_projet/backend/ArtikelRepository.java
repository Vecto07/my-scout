package de.universal_cart_projet.backend;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ArtikelRepository extends JpaRepository<Artikel, Long> {
    // Spring Boot generiert den SQL-Befehl für diesen Filter automatisch
    List<Artikel> findByBenutzer(Benutzer benutzer);
}