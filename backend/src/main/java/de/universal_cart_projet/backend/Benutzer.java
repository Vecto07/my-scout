package de.universal_cart_projet.backend;

import jakarta.persistence.*;

@Entity
public class Benutzer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String benutzername;

    @Column(nullable = false)
    private String passwort;

    @Column(unique = true, nullable = false)
    private String email;

    public Benutzer() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getBenutzername() { return benutzername; }
    public void setBenutzername(String benutzername) { this.benutzername = benutzername; }

    public String getPasswort() { return passwort; }
    public void setPasswort(String passwort) { this.passwort = passwort; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
}