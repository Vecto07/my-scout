"use strict";

(() => {
  const API_BASE = document.querySelector('meta[name="api-base"]').content.replace(/\/+$/, "");
  const TOKEN_KEY = "warenkorb.jwt.v1";
  const USERNAME_KEY = "warenkorb.username.v1";
  const API_ROUTES = {
    register: "/api/auth/register",
    login: "/api/auth/login",
    articles: "/api/artikel"
  };

  const elements = {
    authView: document.querySelector("#auth-view"),
    dashboardView: document.querySelector("#dashboard-view"),
    authForm: document.querySelector("#auth-form"),
    authMessage: document.querySelector("#auth-message"),
    authSubmit: document.querySelector("#auth-submit"),
    usernameInput: document.querySelector("#username"),
    emailInput: document.querySelector("#email"),
    registerEmailField: document.querySelector("#register-email-field"),
    passwordInput: document.querySelector("#password"),
    formHeading: document.querySelector("#form-heading"),
    formDescription: document.querySelector("#form-description"),
    loginTab: document.querySelector("#login-tab"),
    registerTab: document.querySelector("#register-tab"),
    linkForm: document.querySelector("#link-form"),
    linkMessage: document.querySelector("#link-message"),
    linkTitleInput: document.querySelector("#link-title"),
    linkUrlInput: document.querySelector("#link-url"),
    shopInput: document.querySelector("#link-shop"),
    priceInput: document.querySelector("#link-price"),
    imageInput: document.querySelector("#link-image"),
    linkList: document.querySelector("#link-list"),
    emptyState: document.querySelector("#empty-state"),
    itemCount: document.querySelector("#item-count"),
    welcomeMessage: document.querySelector("#welcome-message"),
    searchInput: document.querySelector("#link-search"),
    logoutButton: document.querySelector("#logout-button"),
    emptyAddButton: document.querySelector("#empty-add-button"),
    addPanel: document.querySelector("#add-panel")
  };

  const state = {
    authMode: "login",
    searchQuery: "",
    articles: []
  };

  async function request(path, method = "GET", body) {
    const headers = {};
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const responseText = await response.text();
    let result = responseText;

    if (responseText) {
      try {
        result = JSON.parse(responseText);
      } catch (error) {
        result = responseText;
      }
    }

    if (!response.ok) {
      const message = typeof result === "string"
        ? result
        : result.message || result.error || "Die Anfrage konnte nicht verarbeitet werden.";
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    return result;
  }

  function setMessage(element, message, isError = true) {
    element.textContent = message;
    element.classList.toggle("is-error", isError && Boolean(message));
    element.classList.toggle("is-success", !isError && Boolean(message));
  }

  function setAuthMode(mode) {
    state.authMode = mode;
    const isRegister = mode === "register";

    elements.loginTab.classList.toggle("is-active", !isRegister);
    elements.registerTab.classList.toggle("is-active", isRegister);
    elements.loginTab.setAttribute("aria-selected", String(!isRegister));
    elements.registerTab.setAttribute("aria-selected", String(isRegister));
    elements.registerEmailField.classList.toggle("is-hidden", !isRegister);
    elements.emailInput.required = isRegister;
    elements.formHeading.textContent = isRegister ? "Konto erstellen." : "Willkommen zurück.";
    elements.formDescription.textContent = isRegister
      ? "Lege dein Konto an und speichere deine Produkte an einem Ort."
      : "Melde dich an, um deine gespeicherten Produkte zu öffnen.";
    elements.passwordInput.autocomplete = isRegister ? "new-password" : "current-password";
    setAuthButtonLabel(isRegister ? "Konto erstellen" : "Anmelden");
    setMessage(elements.authMessage, "");
  }

  function setAuthButtonLabel(label) {
    const arrow = document.createElement("span");
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "→";
    elements.authSubmit.replaceChildren(document.createTextNode(label + " "), arrow);
  }

  function normalizeWebUrl(rawUrl, label) {
    let url;
    try {
      url = new URL(rawUrl.trim());
    } catch (error) {
      throw new Error(`Bitte gib eine gültige ${label} ein.`);
    }

    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error(`Bitte verwende für ${label} einen HTTP- oder HTTPS-Link.`);
    }

    return url.href;
  }

  function getVisibleArticles() {
    const query = state.searchQuery.trim().toLocaleLowerCase("de");
    if (!query) return state.articles;

    return state.articles.filter(article =>
      [article.name, article.url, article.shopName || ""]
        .some(value => String(value).toLocaleLowerCase("de").includes(query))
    );
  }

  function createArticleCard(article) {
    const card = document.createElement("article");
    card.className = "link-card";

    const icon = document.createElement("span");
    icon.className = "link-card-icon product-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "◇";

    if (article.bildUrl) {
      const image = document.createElement("img");
      image.className = "article-thumbnail";
      image.src = article.bildUrl;
      image.alt = "";
      image.loading = "lazy";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => image.remove(), { once: true });
      icon.replaceChildren(image);
    }

    const details = document.createElement("div");
    details.className = "link-details";

    const title = document.createElement("h3");
    title.textContent = article.name;

    const url = document.createElement("a");
    url.className = "link-url";
    url.href = article.url;
    url.target = "_blank";
    url.rel = "noopener noreferrer";
    url.textContent = article.url.replace(/^https?:\/\//, "").replace(/\/$/, "");

    const metadata = document.createElement("div");
    metadata.className = "link-meta";

    if (article.shopName) {
      const shop = document.createElement("span");
      shop.className = "type-badge product-badge";
      shop.textContent = article.shopName;
      metadata.append(shop);
    }

    if (Number(article.preis) > 0) {
      const price = document.createElement("span");
      price.textContent = new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR"
      }).format(article.preis);
      metadata.append(price);
    }

    details.append(title, url, metadata);

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const openButton = document.createElement("a");
    openButton.className = "open-link";
    openButton.href = article.url;
    openButton.target = "_blank";
    openButton.rel = "noopener noreferrer";
    openButton.setAttribute("aria-label", `${article.name} in neuem Tab öffnen`);
    openButton.textContent = "↗";

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-link";
    deleteButton.type = "button";
    deleteButton.setAttribute("aria-label", `${article.name} löschen`);
    deleteButton.textContent = "×";
    deleteButton.addEventListener("click", () => handleDeleteArticle(article.id));

    actions.append(openButton, deleteButton);
    card.append(icon, details, actions);
    return card;
  }

  function renderArticles() {
    const visibleArticles = getVisibleArticles();
    elements.itemCount.textContent = String(state.articles.length);
    elements.linkList.replaceChildren();
    elements.emptyState.classList.toggle("is-hidden", state.articles.length > 0);
    elements.linkList.classList.toggle("is-hidden", visibleArticles.length === 0);

    visibleArticles.forEach(article => elements.linkList.append(createArticleCard(article)));

    if (state.articles.length > 0 && visibleArticles.length === 0) {
      const message = document.createElement("p");
      message.className = "no-matches";
      message.textContent = "Keine Produkte für diese Suche gefunden.";
      elements.linkList.append(message);
      elements.linkList.classList.remove("is-hidden");
    }
  }

  async function loadArticles() {
    const articles = await request(API_ROUTES.articles);
    if (!Array.isArray(articles)) {
      throw new Error("Der Server hat eine ungültige Artikelliste gesendet.");
    }
    state.articles = articles;
    renderArticles();
  }

  async function showDashboard() {
    elements.authView.classList.add("is-hidden");
    elements.dashboardView.classList.remove("is-hidden");
    elements.logoutButton.classList.remove("is-hidden");
    elements.welcomeMessage.textContent = `Angemeldet als ${sessionStorage.getItem(USERNAME_KEY)}.`;

    try {
      await loadArticles();
    } catch (error) {
      if (error.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USERNAME_KEY);
        elements.dashboardView.classList.add("is-hidden");
        elements.authView.classList.remove("is-hidden");
        elements.logoutButton.classList.add("is-hidden");
        setMessage(elements.authMessage, "Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an.");
        return;
      }
      setMessage(elements.linkMessage, error.message);
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    const username = elements.usernameInput.value.trim();
    const password = elements.passwordInput.value;

    elements.authSubmit.disabled = true;
    setMessage(elements.authMessage, "");

    try {
      if (state.authMode === "register") {
        await request(API_ROUTES.register, "POST", {
          benutzername: username,
          passwort: password,
          email: elements.emailInput.value.trim().toLowerCase()
        });
      }

      const token = await request(API_ROUTES.login, "POST", {
        benutzername: username,
        passwort: password
      });
      if (typeof token !== "string" || !token.trim()) {
        throw new Error("Der Server hat kein gültiges Anmeldetoken zurückgegeben.");
      }

      sessionStorage.setItem(TOKEN_KEY, token.trim());
      sessionStorage.setItem(USERNAME_KEY, username);
      await showDashboard();
      elements.authForm.reset();
    } catch (error) {
      setMessage(elements.authMessage, error.message);
    } finally {
      elements.authSubmit.disabled = false;
    }
  }

  async function handleCreateArticle(event) {
    event.preventDefault();

    let url;
    let imageUrl = "";
    try {
      url = normalizeWebUrl(elements.linkUrlInput.value, "Produktadresse");
      if (elements.imageInput.value.trim()) {
        imageUrl = normalizeWebUrl(elements.imageInput.value, "Bildadresse");
      }
    } catch (error) {
      setMessage(elements.linkMessage, error.message);
      return;
    }

    const priceValue = elements.priceInput.value.trim();
    const price = priceValue ? Number(priceValue) : 0;
    if (!Number.isFinite(price) || price < 0) {
      setMessage(elements.linkMessage, "Bitte gib einen gültigen Preis ab 0 Euro ein.");
      elements.priceInput.focus();
      return;
    }

    try {
      await request(API_ROUTES.articles, "POST", {
        name: elements.linkTitleInput.value.trim(),
        url,
        preis: price,
        shopName: elements.shopInput.value.trim(),
        bildUrl: imageUrl
      });
      await loadArticles();
      elements.linkForm.reset();
      setMessage(elements.linkMessage, "Produkt gespeichert – du findest es jetzt in deiner Sammlung.", false);
    } catch (error) {
      setMessage(elements.linkMessage, error.message);
    }
  }

  async function handleDeleteArticle(id) {
    try {
      await request(`${API_ROUTES.articles}/${encodeURIComponent(id)}`, "DELETE");
      await loadArticles();
    } catch (error) {
      setMessage(elements.linkMessage, error.message);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USERNAME_KEY);
    state.articles = [];
    state.searchQuery = "";
    elements.searchInput.value = "";
    elements.dashboardView.classList.add("is-hidden");
    elements.authView.classList.remove("is-hidden");
    elements.logoutButton.classList.add("is-hidden");
    elements.authForm.reset();
    setAuthMode("login");
  }

  function getSavedTheme() {
    try {
      const savedTheme = localStorage.getItem("warenkorb.theme.v1");
      return savedTheme === "dark" || savedTheme === "kiosk" ? "dark" : "light";
    } catch (error) {
      setMessage(elements.authMessage, "Dein Browser blockiert das lokale Speichern des Darstellungsmodus. Du kannst den Modus trotzdem wechseln.");
      return "light";
    }
  }

  function setTheme(theme) {
    if (!["light", "dark"].includes(theme)) return;

    document.documentElement.dataset.theme = theme;
    document.querySelectorAll(".theme-choice").forEach(button => {
      const isSelected = button.dataset.theme === theme;
      button.classList.toggle("is-active", isSelected);
      button.setAttribute("aria-pressed", String(isSelected));
    });

    try {
      localStorage.setItem("warenkorb.theme.v1", theme);
    } catch (error) {
      setMessage(elements.authMessage, "Der Darstellungsmodus konnte nicht auf diesem Gerät gespeichert werden.");
    }
  }

  function bindEventHandlers() {
    elements.loginTab.addEventListener("click", () => setAuthMode("login"));
    elements.registerTab.addEventListener("click", () => setAuthMode("register"));
    elements.authForm.addEventListener("submit", handleAuthSubmit);
    elements.linkForm.addEventListener("submit", handleCreateArticle);
    elements.logoutButton.addEventListener("click", handleLogout);
    elements.emptyAddButton.addEventListener("click", () => {
      elements.linkTitleInput.focus();
      elements.addPanel.scrollIntoView({ behavior: "auto", block: "center" });
    });
    elements.searchInput.addEventListener("input", () => {
      state.searchQuery = elements.searchInput.value;
      renderArticles();
    });
    document.querySelectorAll(".theme-choice").forEach(button => {
      button.addEventListener("click", () => setTheme(button.dataset.theme));
    });
  }

  async function initialize() {
    bindEventHandlers();
    setAuthMode("login");
    setTheme(getSavedTheme());

    if (!sessionStorage.getItem(TOKEN_KEY)) return;

    await showDashboard();
  }

  initialize();
})();