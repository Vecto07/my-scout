package de.universal_cart_projet.backend;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/artikel")
@CrossOrigin(origins = "*")
public class ArtikelController {

    private final ArtikelRepository artikelRepository;
    private final BenutzerRepository benutzerRepository;

    public ArtikelController(ArtikelRepository artikelRepository, BenutzerRepository benutzerRepository) {
        this.artikelRepository = artikelRepository;
        this.benutzerRepository = benutzerRepository;
    }

    @GetMapping
    public ResponseEntity<List<Artikel>> holeAlleArtikel(Principal principal) {
        Optional<Benutzer> benutzer = benutzerRepository.findByBenutzername(principal.getName());
        if (benutzer.isEmpty()) return ResponseEntity.status(401).build();

        List<Artikel> meineArtikel = artikelRepository.findByBenutzer(benutzer.get());
        return ResponseEntity.ok(meineArtikel);
    }

    @PostMapping
    public ResponseEntity<Artikel> artikelHinzufuegen(@RequestBody Artikel neuerArtikel, Principal principal) {
        Optional<Benutzer> benutzer = benutzerRepository.findByBenutzername(principal.getName());
        if (benutzer.isEmpty()) return ResponseEntity.status(401).build();

        neuerArtikel.setBenutzer(benutzer.get());
        Artikel gespeicherterArtikel = artikelRepository.save(neuerArtikel);
        return ResponseEntity.ok(gespeicherterArtikel);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> artikelLoeschen(@PathVariable Long id, Principal principal) {
        Optional<Benutzer> benutzer = benutzerRepository.findByBenutzername(principal.getName());
        if (benutzer.isEmpty()) return ResponseEntity.status(401).build();

        Optional<Artikel> artikel = artikelRepository.findById(id);
        if (artikel.isEmpty() || !artikel.get().getBenutzer().getId().equals(benutzer.get().getId())) {
            return ResponseEntity.notFound().build();
        }

        artikelRepository.delete(artikel.get());
        return ResponseEntity.noContent().build();
    }
}