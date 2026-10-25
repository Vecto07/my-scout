package de.universal_cart_projet.backend;

import java.math.BigDecimal;
import java.time.Instant;

public record Item(
        Long id,
        String title,
        BigDecimal price,
        String currency,
        String imageUrl,
        String shop,
        String url,
        int quantity,
        Instant addedAt
) 
{
    
}
