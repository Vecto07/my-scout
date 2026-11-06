"use strict";

(() => {
  const TOKEN_KEY = "warenkorb.jwt.v1";
  const USERNAME_KEY = "warenkorb.username.v1";
  const THEME_KEY = "warenkorb.theme.v1";
  const logoutButton = document.querySelector("#logout-button");

  if (!logoutButton) {
    throw new Error("Logout button not found; website data cleanup was not initialized.");
  }

  logoutButton.addEventListener("click", async () => {
    const failures = new Set();
    clearStorageItem("sessionStorage", TOKEN_KEY, failures);
    clearStorageItem("sessionStorage", USERNAME_KEY, failures);
    clearStorageItem("localStorage", THEME_KEY, failures);

    document.documentElement.dataset.theme = "light";
    document.querySelectorAll(".theme-choice").forEach(button => {
      const isSelected = button.dataset.theme === "light";
      button.classList.toggle("is-active", isSelected);
      button.setAttribute("aria-pressed", String(isSelected));
    });

    document.querySelector("#auth-form").reset();
    document.querySelector("#link-form").reset();
    document.querySelector("#link-search").value = "";
    document.querySelector("#link-list").replaceChildren();
    document.querySelector("#item-count").textContent = "0";
    document.querySelector("#welcome-message").textContent = "Alle gespeicherten Produkte an einem Ort.";
    document.querySelector("#link-message").textContent = "";

    try {
      if ("caches" in window) {
        const cacheNames = await window.caches.keys();
        const deleted = await Promise.all(cacheNames.map(name => window.caches.delete(name)));
        if (deleted.some(success => !success)) failures.add("Cache-Storage");
      }
    } catch (error) {
      failures.add("Cache-Storage");
    }

    if (failures.size) {
      const message = document.querySelector("#auth-message");
      message.textContent = "[LOGOUT-CLEANUP-001] Du bist abgemeldet, aber einige lokale Browserdaten konnten nicht gelöscht werden.";
      message.classList.add("is-error");
      message.classList.remove("is-success");
    }
  });

  function clearStorageItem(storageName, key, failures) {
    try {
      window[storageName].removeItem(key);
    } catch (error) {
      failures.add(storageName);
    }
  }
})();
