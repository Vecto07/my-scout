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
  const ERROR_CODES = {
    usernameRequired: "VAL-AUTH-001",
    usernameTooLong: "VAL-AUTH-002",
    emailRequired: "VAL-AUTH-003",
    emailInvalid: "VAL-AUTH-004",
    passwordRequired: "VAL-AUTH-005",
    passwordTooShort: "VAL-AUTH-006",
    passwordTooLong: "VAL-AUTH-007",
    articleNameRequired: "VAL-ART-001",
    articleNameTooLong: "VAL-ART-002",
    articleUrlRequired: "VAL-ART-003",
    articleUrlInvalid: "VAL-ART-004",
    articleUrlProtocol: "VAL-ART-005",
    imageUrlInvalid: "VAL-ART-006",
    priceInvalid: "VAL-ART-007",
    shopNameTooLong: "VAL-ART-008",
    loginFailed: "AUTH-LOGIN-001",
    registrationRejected: "AUTH-REGISTER-001",
    usernameTaken: "AUTH-REGISTER-002",
    sessionExpired: "AUTH-SESSION-001",
    network: "API-NET-001",
    badRequest: "API-HTTP-400",
    forbidden: "API-HTTP-403",
    notFound: "API-HTTP-404",
    conflict: "API-HTTP-409",
    invalidData: "API-HTTP-422",
    rateLimited: "API-HTTP-429",
    server: "API-SERVER-001",
    unexpected: "APP-UNEXPECTED-001",
    invalidArticleList: "API-RESPONSE-001",
    invalidToken: "API-RESPONSE-002"
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

    let response;
    let responseText;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      responseText = await response.text();
    } catch {
      throw createAppError(
        ERROR_CODES.network,
        "Der Server ist nicht erreichbar. Prüfe, ob das Backend läuft und CORS für das Frontend freigegeben ist."
      );
    }
    let result = responseText;

    if (responseText) {
      try {
        result = JSON.parse(responseText);
      } catch (error) {
        result = responseText;
      }
    }

    if (!response.ok) {
      const code = getHttpErrorCode(path, response.status);
      const message = getResponseErrorMessage(result, response.status);
      throw createAppError(code, message, response.status);
    }

    return result;
  }

  function setMessage(element, message, isError = true) {
    element.textContent = message;
    element.classList.toggle("is-error", isError && Boolean(message));
    element.classList.toggle("is-success", !isError && Boolean(message));
  }

  function createAppError(code, message, status) {
    const error = new Error(message);
    error.code = code;
    if (status !== undefined) error.status = status;
    return error;
  }

  function getHttpErrorCode(path, status) {
    if (path === API_ROUTES.login && status === 401) return ERROR_CODES.loginFailed;
    if (path === API_ROUTES.register && status === 400) return ERROR_CODES.registrationRejected;
    if (path === API_ROUTES.register && status === 409) return ERROR_CODES.usernameTaken;

    if (status === 400) return ERROR_CODES.badRequest;
    if (status === 401) return ERROR_CODES.sessionExpired;
    if (status === 403) return ERROR_CODES.forbidden;
    if (status === 404) return ERROR_CODES.notFound;
    if (status === 409) return ERROR_CODES.conflict;
    if (status === 422) return ERROR_CODES.invalidData;
    if (status === 429) return ERROR_CODES.rateLimited;
    if (status >= 500) return ERROR_CODES.server;
    return `API-HTTP-${status}`;
  }

  function getResponseErrorMessage(result, status) {
    const detail = typeof result === "string"
      ? result.trim()
      : result && (result.message || result.error || result.detail);
    if (detail) return `${detail}`.slice(0, 300);
    return `Die Anfrage wurde vom Server abgelehnt (HTTP ${status}).`;
  }

  function setErrorMessage(element, error) {
    const appError = error && error.code
      ? error
      : createAppError(ERROR_CODES.unexpected, "Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.");
    setMessage(element, `[${appError.code}] ${appError.message}`);
  }

  function getValidationError(form, input) {
    const isAuthForm = form === elements.authForm;
    const name = input.name;

    if (isAuthForm) {
      if (name === "username") {
        if (input.validity.valueMissing) return createAppError(ERROR_CODES.usernameRequired, "Bitte gib einen Benutzernamen ein.");
        if (input.validity.tooLong) return createAppError(ERROR_CODES.usernameTooLong, "Der Benutzername darf höchstens 100 Zeichen lang sein.");
      }
      if (name === "email") {
        if (input.validity.valueMissing) return createAppError(ERROR_CODES.emailRequired, "Bitte gib für die Registrierung eine E-Mail-Adresse ein.");
        if (input.validity.typeMismatch) return createAppError(ERROR_CODES.emailInvalid, "Bitte gib eine gültige E-Mail-Adresse ein.");
      }
      if (name === "password") {
        if (input.validity.valueMissing) return createAppError(ERROR_CODES.passwordRequired, "Bitte gib ein Passwort ein.");
        if (input.validity.tooShort) return createAppError(ERROR_CODES.passwordTooShort, "Das Passwort muss mindestens 8 Zeichen enthalten.");
        if (input.validity.tooLong) return createAppError(ERROR_CODES.passwordTooLong, "Das Passwort darf höchstens 128 Zeichen lang sein.");
      }
    } else {
      if (name === "title") {
        if (input.validity.valueMissing) return createAppError(ERROR_CODES.articleNameRequired, "Bitte gib einen Produktnamen ein.");
        if (input.validity.tooLong) return createAppError(ERROR_CODES.articleNameTooLong, "Der Produktname darf höchstens 255 Zeichen lang sein.");
      }
      if (name === "url") {
        if (input.validity.valueMissing) return createAppError(ERROR_CODES.articleUrlRequired, "Bitte gib einen Link zum Produkt ein.");
        if (input.validity.typeMismatch) return createAppError(ERROR_CODES.articleUrlInvalid, "Bitte gib eine gültige Produktadresse ein.");
      }
      if (name === "image" && input.validity.typeMismatch) {
        return createAppError(ERROR_CODES.imageUrlInvalid, "Bitte gib eine gültige Bildadresse ein.");
      }
      if (name === "price" && (
        input.validity.badInput ||
        input.validity.rangeUnderflow ||
        input.validity.stepMismatch
      )) {
        return createAppError(ERROR_CODES.priceInvalid, "Bitte gib einen gültigen Preis ab 0 Euro mit höchstens zwei Nachkommastellen ein.");
      }
      if (name === "shopName" && input.validity.tooLong) {
        return createAppError(ERROR_CODES.shopNameTooLong, "Der Shopname darf höchstens 255 Zeichen lang sein.");
      }
    }

    return createAppError(ERROR_CODES.unexpected, "Bitte prüfe deine Eingaben und versuche es erneut.");
  }

  function handleInvalidInput(form, messageElement, event) {
    event.preventDefault();
    if (form.dataset.validationErrorDisplayed) return;

    const error = getValidationError(form, event.target);
    form.dataset.validationErrorDisplayed = "true";
    setErrorMessage(messageElement, error);
  }

  function clearValidationMessage(form, messageElement) {
    delete form.dataset.validationErrorDisplayed;
    setMessage(messageElement, "");
  }

  function setAuthMode(mode) {
    state.authMode = mode;
    const isRegister = mode === "register";
    delete elements.authForm.dataset.validationErrorDisplayed;

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
    const isImageUrl = label === "Bildadresse";
    let url;
    try {
      url = new URL(rawUrl.trim());
    } catch (error) {
      const code = isImageUrl ? ERROR_CODES.imageUrlInvalid : ERROR_CODES.articleUrlInvalid;
      throw createAppError(code, `Bitte gib eine gültige ${label} ein.`);
    }

    if (!["http:", "https:"].includes(url.protocol)) {
      const code = isImageUrl ? ERROR_CODES.imageUrlInvalid : ERROR_CODES.articleUrlProtocol;
      throw createAppError(code, `Bitte verwende für ${label} einen HTTP- oder HTTPS-Link.`);
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
      throw createAppError(ERROR_CODES.invalidArticleList, "Der Server hat eine ungültige Artikelliste gesendet.");
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
        setErrorMessage(elements.authMessage, createAppError(
          ERROR_CODES.sessionExpired,
          "Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an.",
          error.status
        ));
        return;
      }
      setErrorMessage(elements.linkMessage, error);
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    const username = elements.usernameInput.value.trim();
    const password = elements.passwordInput.value;

    if (!username) {
      setErrorMessage(elements.authMessage, createAppError(ERROR_CODES.usernameRequired, "Bitte gib einen Benutzernamen ein."));
      elements.usernameInput.focus();
      return;
    }

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
        throw createAppError(ERROR_CODES.invalidToken, "Der Server hat kein gültiges Anmeldetoken zurückgegeben.");
      }

      sessionStorage.setItem(TOKEN_KEY, token.trim());
      sessionStorage.setItem(USERNAME_KEY, username);
      await showDashboard();
      elements.authForm.reset();
    } catch (error) {
      setErrorMessage(elements.authMessage, error);
    } finally {
      elements.authSubmit.disabled = false;
    }
  }

  async function handleCreateArticle(event) {
    event.preventDefault();

    if (!elements.linkTitleInput.value.trim()) {
      setErrorMessage(elements.linkMessage, createAppError(ERROR_CODES.articleNameRequired, "Bitte gib einen Produktnamen ein."));
      elements.linkTitleInput.focus();
      return;
    }

    if (!elements.linkUrlInput.value.trim()) {
      setErrorMessage(elements.linkMessage, createAppError(ERROR_CODES.articleUrlRequired, "Bitte gib einen Link zum Produkt ein."));
      elements.linkUrlInput.focus();
      return;
    }

    let url;
    let imageUrl = "";
    try {
      url = normalizeWebUrl(elements.linkUrlInput.value, "Produktadresse");
      if (elements.imageInput.value.trim()) {
        imageUrl = normalizeWebUrl(elements.imageInput.value, "Bildadresse");
      }
    } catch (error) {
      setErrorMessage(elements.linkMessage, error);
      return;
    }

    const priceValue = elements.priceInput.value.trim();
    const price = priceValue ? Number(priceValue) : 0;
    if (!Number.isFinite(price) || price < 0) {
      setErrorMessage(elements.linkMessage, createAppError(
        ERROR_CODES.priceInvalid,
        "Bitte gib einen gültigen Preis ab 0 Euro mit höchstens zwei Nachkommastellen ein."
      ));
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
      elements.linkForm.reset();
      delete elements.linkForm.dataset.validationErrorDisplayed;
      setMessage(elements.linkMessage, "Produkt gespeichert – du findest es jetzt in deiner Sammlung.", false);
    } catch (error) {
      setErrorMessage(elements.linkMessage, error);
      return;
    }

    try {
      await loadArticles();
    } catch (error) {
      const code = error && error.code ? error.code : ERROR_CODES.unexpected;
      setErrorMessage(elements.linkMessage, createAppError(
        code,
        `Das Produkt wurde gespeichert, aber die Sammlung konnte nicht aktualisiert werden. ${error.message}`,
        error.status
      ));
    }
  }

  async function handleDeleteArticle(id) {
    try {
      await request(`${API_ROUTES.articles}/${encodeURIComponent(id)}`, "DELETE");
      await loadArticles();
    } catch (error) {
      setErrorMessage(elements.linkMessage, error);
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
    elements.authForm.addEventListener("invalid", event => {
      handleInvalidInput(elements.authForm, elements.authMessage, event);
    }, true);
    elements.authForm.addEventListener("input", () => {
      clearValidationMessage(elements.authForm, elements.authMessage);
    });
    elements.linkForm.addEventListener("submit", handleCreateArticle);
    elements.linkForm.addEventListener("invalid", event => {
      handleInvalidInput(elements.linkForm, elements.linkMessage, event);
    }, true);
    elements.linkForm.addEventListener("input", () => {
      clearValidationMessage(elements.linkForm, elements.linkMessage);
    });
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
