package de.universal_cart_projet.backend;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.ArrayList;

@Component
public class JwtFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    public JwtFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");

        // Prüfen, ob ein Token im Header mitgeschickt wurde ("Bearer " ist der Standard-Präfix)
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            try {
                String benutzername = jwtService.extrahiereBenutzername(token);
                
                // Wenn der Token gültig ist und noch niemand eingeloggt ist, logge den Nutzer ein
                if (benutzername != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                    UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(benutzername, null, new ArrayList<>());
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            } catch (Exception e) {
                // Token ist ungültig, abgelaufen oder manipuliert -> Nutzer bleibt ausgeloggt
            }
        }
        
        // Anfrage weitergeben an den Controller (oder blockieren, falls nicht eingeloggt)
        filterChain.doFilter(request, response);
    }
}