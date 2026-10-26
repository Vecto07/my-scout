"use strict";

(() => {
  const API_ROUTES = {
    session: "/api/session",
    register: "/api/register",
    login: "/api/login",
    logout: "/api/logout",
    links: "/api/links"
  };

  const elements = {
    authView: document.querySelector("#auth-view"),
    dashboardView: document.querySelector("#dashboard-view"),
    authForm: document.querySelector("#auth-form"),
    authMessage: document.querySelector("#auth-message"),
    authSubmit: document.querySelector("#auth-submit"),
    emailInput: document.querySelector("#email"),
    passwordInput: document.querySelector("#password"),
    formHeading: document.querySelector("#form-heading"),
    formDescription: document.querySelector("#form-description"),
    loginTab: document.querySelector("#login-tab"),
    registerTab: document.querySelector("#register-tab"),
    linkForm: document.querySelector("#link-form"),
    linkMessage: document.querySelector("#link-message"),
    linkTitleInput: document.querySelector("#link-title"),
    linkUrlInput: document.querySelector("#link-url"),
    linkTypeInput: document.querySelector("#link-type"),
    linkList: document.querySelector("#link-list"),
    emptyState: document.querySelector("#empty-state"),
    itemCount: document.querySelector("#item-count"),
    welcomeMessage: document.querySelector("#welcome-message"),
    searchInput: document.querySelector("#link-search"),
    tagInput: document.querySelector("#link-tag"),
    logoutButton: document.querySelector("#logout-button"),
    emptyAddButton: document.querySelector("#empty-add-button"),
    addPanel: document.querySelector("#add-panel")
  };

  const state = {
    authMode: "login",
    activeFilter: "all",
    searchQuery: "",
    links: []
  };

  /**
   * API contract:
   * POST /api/register and /api/login:
   *   request { email, password } -> 201/200 { user: { id, email } }
   * POST /api/logout -> 200 { ok: true }
   * GET /api/session -> 200 { user: { id, email } | null }
   * GET /api/links -> 200 [{ id, title, url, type, createdAt, tag }]
   * POST /api/links:
   *   request { title, url, type: "product" | "cart", tag? }
   *   -> 201 { id, title, url, type, createdAt, tag }
   * DELETE /api/links/{id} -> 200 { ok: true }
   * Errors return { error: "message" }; requests use the same-origin session cookie.
   */
  const api = {
    getSession: () => request(API_ROUTES.session),
    register: credentials => request(API_ROUTES.register, "POST", credentials),
    login: credentials => request(API_ROUTES.login, "POST", credentials),
    logout: () => request(API_ROUTES.logout, "POST", {}),
    getLinks: () => request(API_ROUTES.links),
    createLink: link => request(API_ROUTES.links, "POST", link),
    deleteLink: id => request(`${API_ROUTES.links}/${encodeURIComponent(id)}`, "DELETE")
  };

  async function request(path, method = "GET", body) {
    const options = {
      method,
      credentials: "same-origin",
      headers: {}
    };

    if (body !== undefined) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    const response = await fetch(path, options);
    let result;

    try {
      result = await response.json();
    } catch (error) {
      if (response.ok) {
        throw new Error("Der Server hat eine ungültige Antwort gesendet.");
      }
      result = {};
    }

    if (!response.ok) {
      throw new Error(result.error || "Die Anfrage konnte nicht verarbeitet werden.");
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
    elements.formHeading.textContent = isRegister ? "Konto erstellen." : "Willkommen zurück.";
    elements.formDescription.textContent = isRegister
      ? "Lege dein Konto an und speichere deine Links an einem Ort."
      : "Melde dich an, um deine gespeicherten Links zu öffnen.";
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

  function formatDate(value) {
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(new Date(value));
  }

  function getVisibleLinks() {
    const query = state.searchQuery.trim().toLocaleLowerCase("de");

    return state.links.filter(link => {
      if (state.activeFilter !== "all" && link.type !== state.activeFilter) {
        return false;
      }
      if (!query) {
        return true;
      }

      return [link.title, link.url, link.tag || ""]
        .some(value => value.toLocaleLowerCase("de").includes(query));
    });
  }

  function createLinkCard(link) {
    const card = document.createElement("article");
    card.className = "link-card";

    const icon = document.createElement("span");
    icon.className = `link-card-icon ${link.type === "cart" ? "cart-icon" : "product-icon"}`;
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = link.type === "cart" ? "▤" : "◇";

    const details = createLinkDetails(link);
    const actions = createLinkActions(link);
    card.append(icon, details, actions);

    return card;
  }

  function createLinkDetails(link) {
    const details = document.createElement("div");
    details.className = "link-details";

    const title = document.createElement("h3");
    title.textContent = link.title;

    const url = document.createElement("a");
    url.className = "link-url";
    url.href = link.url;
    url.target = "_blank";
    url.rel = "noopener noreferrer";
    url.textContent = link.url.replace(/^https?:\/\//, "").replace(/\/$/, "");

    const metadata = document.createElement("div");
    metadata.className = "link-meta";

    const typeBadge = document.createElement("span");
    typeBadge.className = `type-badge ${link.type === "cart" ? "cart-badge" : "product-badge"}`;
    typeBadge.textContent = link.type === "cart" ? "Warenkorb" : "Produkt";

    const savedDate = document.createElement("span");
    savedDate.textContent = `Gespeichert am ${formatDate(link.createdAt)}`;
    metadata.append(typeBadge, savedDate);

    if (link.tag) {
      metadata.append(createTagButton(link.tag));
    }

    details.append(title, url, metadata);
    return details;
  }

  function createTagButton(tagValue) {
    const tagButton = document.createElement("button");
    tagButton.className = "tag-chip";
    tagButton.type = "button";
    tagButton.setAttribute("aria-label", `Nach ${tagValue} suchen`);
    tagButton.textContent = tagValue;
    tagButton.addEventListener("click", () => {
      elements.searchInput.value = tagValue;
      state.searchQuery = tagValue;
      renderLinks();
      elements.searchInput.focus();
    });

    return tagButton;
  }

  function createLinkActions(link) {
    const actions = document.createElement("div");
    actions.className = "card-actions";

    const openButton = document.createElement("a");
    openButton.className = "open-link";
    openButton.href = link.url;
    openButton.target = "_blank";
    openButton.rel = "noopener noreferrer";
    openButton.setAttribute("aria-label", `${link.title} in neuem Tab öffnen`);
    openButton.textContent = "↗";

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-link";
    deleteButton.type = "button";
    deleteButton.setAttribute("aria-label", `${link.title} löschen`);
    deleteButton.textContent = "×";
    deleteButton.addEventListener("click", () => handleDeleteLink(link.id));

    actions.append(openButton, deleteButton);
    return actions;
  }

  function renderLinks() {
    const visibleLinks = getVisibleLinks();

    elements.itemCount.textContent = String(state.links.length);
    elements.linkList.replaceChildren();
    elements.emptyState.classList.toggle("is-hidden", state.links.length > 0);
    elements.linkList.classList.toggle("is-hidden", visibleLinks.length === 0);

    visibleLinks.forEach(link => elements.linkList.append(createLinkCard(link)));

    if (state.links.length > 0 && visibleLinks.length === 0) {
      const message = document.createElement("p");
      message.className = "no-matches";
      message.textContent = "Keine Links für diese Suche und diesen Filter gefunden.";
      elements.linkList.append(message);
      elements.linkList.classList.remove("is-hidden");
    }
  }

  async function loadLinks() {
    state.links = await api.getLinks();
    renderLinks();
  }

  async function showDashboard(user) {
    elements.authView.classList.add("is-hidden");
    elements.dashboardView.classList.remove("is-hidden");
    elements.logoutButton.classList.remove("is-hidden");
    elements.welcomeMessage.textContent = `Angemeldet als ${user.email}.`;

    try {
      await loadLinks();
    } catch (error) {
      setMessage(elements.linkMessage, error.message);
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    const credentials = {
      email: elements.emailInput.value.trim().toLowerCase(),
      password: elements.passwordInput.value
    };

    elements.authSubmit.disabled = true;
    setMessage(elements.authMessage, "");

    try {
      const result = state.authMode === "register"
        ? await api.register(credentials)
        : await api.login(credentials);
      await showDashboard(result.user);
      elements.authForm.reset();
    } catch (error) {
      setMessage(elements.authMessage, error.message);
    } finally {
      elements.authSubmit.disabled = false;
    }
  }

  function normalizeLinkUrl(rawUrl) {
    let url;
    try {
      url = new URL(rawUrl.trim());
    } catch (error) {
      throw new Error("Bitte gib eine gültige Webadresse ein.");
    }

    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Bitte verwende einen Link, der mit http:// oder https:// beginnt.");
    }

    return url.href;
  }

  async function handleCreateLink(event) {
    event.preventDefault();
    const tag = elements.tagInput.value.trim();
    if (tag && !/^#[\p{L}\p{M}\p{N}_-]{1,31}$/u.test(tag)) {
      setMessage(elements.linkMessage, "Ein Tag muss mit # beginnen und darf danach nur Buchstaben, Zahlen, _ oder - enthalten.");
      elements.tagInput.focus();
      return;
    }

    let url;
    try {
      url = normalizeLinkUrl(elements.linkUrlInput.value);
    } catch (error) {
      setMessage(elements.linkMessage, error.message);
      elements.linkUrlInput.focus();
      return;
    }

    const link = {
      title: elements.linkTitleInput.value.trim(),
      url,
      type: elements.linkTypeInput.value,
      tag
    };

    try {
      await api.createLink(link);
      await loadLinks();
      elements.linkForm.reset();
      setMessage(elements.linkMessage, "Link gespeichert – du findest ihn jetzt in deiner Sammlung.", false);
    } catch (error) {
      setMessage(elements.linkMessage, error.message);
    }
  }

  async function handleDeleteLink(id) {
    try {
      await api.deleteLink(id);
      await loadLinks();
    } catch (error) {
      setMessage(elements.linkMessage, error.message);
    }
  }

  function setActiveFilter(button) {
    state.activeFilter = button.dataset.filter;

    document.querySelectorAll(".filter-button").forEach(filterButton => {
      const isActive = filterButton === button;
      filterButton.classList.toggle("is-active", isActive);
      filterButton.setAttribute("aria-pressed", String(isActive));
    });

    renderLinks();
  }

  async function handleLogout() {
    try {
      await api.logout();
    } catch (error) {
      setMessage(elements.linkMessage, error.message);
      return;
    }

    state.links = [];
    state.searchQuery = "";
    state.activeFilter = "all";
    elements.searchInput.value = "";
    document.querySelectorAll(".filter-button").forEach(button => {
      const isActive = button.dataset.filter === "all";
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
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
    if (!["light", "dark"].includes(theme)) {
      return;
    }

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
    elements.linkForm.addEventListener("submit", handleCreateLink);
    elements.logoutButton.addEventListener("click", handleLogout);
    elements.emptyAddButton.addEventListener("click", () => {
      elements.linkTitleInput.focus();
      elements.addPanel.scrollIntoView({ behavior: "auto", block: "center" });
    });
    elements.searchInput.addEventListener("input", () => {
      state.searchQuery = elements.searchInput.value;
      renderLinks();
    });

    document.querySelectorAll(".filter-button").forEach(button => {
      button.addEventListener("click", () => setActiveFilter(button));
    });
    document.querySelectorAll(".theme-choice").forEach(button => {
      button.addEventListener("click", () => setTheme(button.dataset.theme));
    });
  }

  async function initialize() {
    bindEventHandlers();
    setAuthMode("login");
    setTheme(getSavedTheme());

    try {
      const result = await api.getSession();
      if (result.user) {
        await showDashboard(result.user);
      }
    } catch (error) {
      setMessage(elements.authMessage, "Der Warenkorb-Server ist nicht erreichbar. Bitte starte den Java-Server.");
    }
  }

  initialize();
})();