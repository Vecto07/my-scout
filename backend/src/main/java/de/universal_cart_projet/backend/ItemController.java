package de.universal_cart_projet.backend;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/items")
@CrossOrigin(origins = "*")

public class ItemController {
    
     @GetMapping
    public List<Item> alleArtikel() {
        return List.of(
                new Item(1L, "Logitech MX Master 3S", new BigDecimal("89.99"), "EUR",
                        "https://example.com/bild1.jpg", "amazon.de",
                        "https://www.amazon.de/dp/BEISPIEL1", 1,
                        Instant.parse("2026-10-20T14:30:00Z")),
                new Item(2L, "Schreibtischlampe LED", new BigDecimal("24.50"), "EUR",
                        "https://example.com/bild2.jpg", "otto.de",
                        "https://www.otto.de/p/BEISPIEL2", 2,
                        Instant.parse("2026-10-21T09:15:00Z"))
        );
    }
}
