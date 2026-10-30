// Chrome uses "chrome"; Firefox also provides the WebExtensions "browser" API.
const extensionApi =
  typeof browser !== "undefined" ? browser : chrome;

const status = document.querySelector("#status");
const loginSection = document.querySelector("#login-section");
const registerSection = document.querySelector("#register-section");
const cartSection = document.querySelector("#cart-section");
const productName = document.querySelector("#product-name");
const productPrices = document.querySelector("#product-prices");
const productUrl = document.querySelector("#product-url");
const productImage = document.querySelector("#product-image");
const productSource = document.querySelector("#product-source");
const productError = document.querySelector("#product-error");
const manualPriceForm = document.querySelector("#manual-price-form");
const manualPriceInput = document.querySelector("#manual-price");
const devModeToggle = document.querySelector("#dev-mode");
const productDetailsSection = document.querySelector("#product-details-section");
const themeChoices = document.querySelectorAll(".theme-choice");
const themeStorageKey = "theme";
let devMode = false;
const apiBaseUrl = "https://api.my-scout.app";

// Chrome and Firefox expose the same WebExtension APIs differently:
// Firefox returns promises, while Chrome may require callbacks.
function storageGet(key) {
  if (typeof browser !== "undefined") {
    return browser.storage.local.get(key);
  }

  return new Promise((resolve, reject) => {
    chrome.storage.local.get(key, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(result);
    });
  });
}

function storageSet(values) {
  if (typeof browser !== "undefined") {
    return browser.storage.local.set(values);
  }

  return new Promise((resolve, reject) => {
    chrome.storage.local.set(values, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve();
    });
  });
}

function storageRemove(key) {
  if (typeof browser !== "undefined") {
    return browser.storage.local.remove(key);
  }

  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(key, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve();
    });
  });
}

function sendRuntimeMessage(message) {
  if (typeof browser !== "undefined") {
    return browser.runtime.sendMessage(message);
  }

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(response);
    });
  });
}

function setTheme(theme) {
  const selectedTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = selectedTheme;
  themeChoices.forEach((button) => {
    const isSelected = button.dataset.theme === selectedTheme;
    button.classList.toggle("is-active", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
}

storageGet(themeStorageKey)
  .then(({ [themeStorageKey]: storedTheme }) => {
    setTheme(storedTheme);
  })
  .catch((error) => {
    console.error("Darstellung konnte nicht gelesen werden:", error);
    setTheme("light");
  });

themeChoices.forEach((button) => {
  button.addEventListener("click", async () => {
    const theme = button.dataset.theme;
    setTheme(theme);
    try {
      await storageSet({ [themeStorageKey]: theme });
    } catch (error) {
      console.error("Darstellung konnte nicht gespeichert werden:", error);
      status.textContent = "Die Darstellung konnte nicht gespeichert werden.";
    }
  });
});

function showLoggedIn() {
  loginSection.hidden = true;
  cartSection.hidden = false;
}

function showLoggedOut() {
  loginSection.hidden = false;
  registerSection.hidden = true;
  cartSection.hidden = true;
}

function showLoginForm() {
  loginSection.hidden = false;
  registerSection.hidden = true;
}

function showRegisterForm() {
  loginSection.hidden = true;
  registerSection.hidden = false;
}

function showProduct(product) {
  productDetailsSection.hidden = !devMode;
  manualPriceForm.hidden = Boolean(product?.prices?.length);
  if (!devMode || !product) {
    return;
  }

  productName.textContent = product.name || "Unbekanntes Produkt";
  productPrices.replaceChildren();
  if (!product.prices?.length) {
    productPrices.textContent = "Kein Preis gefunden";
  } else {
    const list = document.createElement("ul");
    for (const price of product.prices) {
      const item = document.createElement("li");
      item.textContent = `${price.value} ${price.currency || ""} (${price.source})`
        .trim();
      list.appendChild(item);
    }
    productPrices.appendChild(list);
  }
  productUrl.textContent = product.url || "-";
  productImage.textContent = product.imageUrl || "Kein Bild gefunden";
  productSource.textContent = product.source || "-";
  productError.textContent = product.error || "-";
  productError.hidden = !product.error;
}

// Keep the login state and token consistent when the popup is closed and reopened.
storageGet(["loggedIn", "jwtToken", "lastProduct", "devMode"])
  .then(async ({ loggedIn, jwtToken, lastProduct, devMode: storedDevMode }) => {
    devMode = storedDevMode === true;
    devModeToggle.checked = devMode;
    if (loggedIn && typeof jwtToken === "string" && jwtToken.trim()) {
      showLoggedIn();
    } else {
      await storageRemove(["loggedIn", "jwtToken"]);
      showLoggedOut();
    }
    showProduct(lastProduct);
  })
  .catch((error) => {
    console.error("Anmeldestatus konnte nicht gelesen werden:", error);
    status.textContent = "Der Anmeldestatus konnte nicht gelesen werden.";
  });

devModeToggle.addEventListener("change", async () => {
  devMode = devModeToggle.checked;
  try {
    await storageSet({ devMode });
    const { lastProduct } = await storageGet("lastProduct");
    showProduct(lastProduct);
  } catch (error) {
    console.error("Entwicklermodus konnte nicht gespeichert werden:", error);
    status.textContent = "Der Entwicklermodus konnte nicht aktualisiert werden.";
  }
});

document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const username = document.querySelector("#username").value.trim();
    const password = document.querySelector("#password").value;
    const token = await login(username, password);
    await storageSet({ loggedIn: true, jwtToken: token });
    showLoggedIn();
    status.textContent = "Du bist angemeldet. Du kannst jetzt Produkte speichern.";
  } catch (error) {
    console.error("Anmeldestatus konnte nicht gespeichert werden:", error);
    status.textContent = error.message || "Die Anmeldung ist fehlgeschlagen.";
  }
});

async function login(username, password) {
  let response;
  try {
    response = await fetch(`${apiBaseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        benutzername: username,
        passwort: password
      })
    });
  } catch (error) {
    console.error("Backend konnte nicht erreicht werden:", error);
    throw new Error("Der Server konnte nicht erreicht werden.");
  }

  if (!response.ok) {
    const message = (await response.text()).trim();
    throw new Error(message || "Anmeldung fehlgeschlagen. Prüfe Benutzername und Passwort.");
  }

  const token = (await response.text()).trim();
  if (!token) {
    throw new Error("Anmeldung fehlgeschlagen, weil der Server kein gültiges Token zurückgegeben hat.");
  }
  return token;
}

document.querySelector("#register-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const username = document.querySelector("#register-username").value.trim();
    const email = document.querySelector("#register-email").value.trim();
    const password = document.querySelector("#register-password").value;
    const response = await fetch(`${apiBaseUrl}/api/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        benutzername: username,
        email,
        passwort: password
      })
    });
    if (!response.ok) {
      const message = (await response.text()).trim();
      throw new Error(message || "Die Registrierung ist fehlgeschlagen.");
    }

    const token = await login(username, password);
    await storageSet({ loggedIn: true, jwtToken: token });
    showLoggedIn();
    status.textContent = "Konto erstellt. Du bist angemeldet.";
  } catch (error) {
    console.error("Konto konnte nicht erstellt werden:", error);
    status.textContent = error.message || "Das Konto konnte nicht erstellt werden.";
  }
});

document.querySelector("#show-register").addEventListener("click", () => {
  showRegisterForm();
  status.textContent = "";
});

document.querySelector("#show-login").addEventListener("click", () => {
  showLoginForm();
  status.textContent = "";
});

document.querySelector("#add-product").addEventListener("click", async () => {
  try {
    status.textContent = "Produktdetails werden gelesen...";
    const { jwtToken } = await storageGet("jwtToken");
    if (typeof jwtToken !== "string" || !jwtToken.trim()) {
      showLoggedOut();
      throw new Error("Bitte melde dich an, bevor du Produkte speicherst.");
    }
    const scrapedResponse = await sendRuntimeMessage({
      type: "scrapeCurrentPage",
      jwtToken
    });
    if (!scrapedResponse?.ok) {
      throw new Error(scrapedResponse?.error || "Diese Seite konnte nicht gelesen werden.");
    }
    await storageSet({ lastProduct: scrapedResponse.product });
    showProduct(scrapedResponse.product);
    if (!scrapedResponse.product?.prices?.length) {
      status.textContent = "Kein Preis erkannt. Bitte gib den Preis manuell ein.";
      manualPriceInput.focus();
      return;
    }
    const saveResponse = await sendRuntimeMessage({
      type: "saveProduct",
      product: scrapedResponse.product,
      jwtToken
    });
    if (!saveResponse?.ok) {
      throw new Error(saveResponse?.error || "Das Produkt konnte nicht gespeichert werden.");
    }
    status.textContent = "Produkt wurde in deiner Sammlung gespeichert.";
  } catch (error) {
    console.error("Produktseite konnte nicht gelesen werden:", error);
    if (devMode) {
      try {
        const { lastProduct } = await storageGet("lastProduct");
        showProduct(lastProduct);
      } catch (storageError) {
        console.error("Gefundenes Produkt konnte nicht angezeigt werden:", storageError);
      }
    }
    status.textContent = error.message || "Das Produkt konnte nicht gespeichert werden.";
  }
});

manualPriceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const manualPrice = manualPriceInput.value.trim();
  if (!manualPrice) {
    status.textContent = "Bitte gib einen Preis ein.";
    manualPriceInput.focus();
    return;
  }
  try {
    const { jwtToken, lastProduct } = await storageGet(["jwtToken", "lastProduct"]);
    if (!lastProduct) {
      throw new Error("Lies zuerst eine Produktseite ein.");
    }
    status.textContent = "Produkt wird gespeichert...";
    const response = await sendRuntimeMessage({
      type: "saveProduct",
      product: lastProduct,
      manualPrice,
      jwtToken
    });
    if (!response?.ok) {
      throw new Error(response?.error || "Das Produkt konnte nicht gespeichert werden.");
    }
    manualPriceForm.hidden = true;
    status.textContent = "Produkt wurde mit dem manuellen Preis gespeichert.";
  } catch (error) {
    console.error("Produkt mit manuellem Preis konnte nicht gespeichert werden:", error);
    status.textContent = error.message || "Das Produkt konnte nicht gespeichert werden.";
  }
});

document.querySelector("#logout").addEventListener("click", () => {
  storageRemove(["loggedIn", "jwtToken"])
    .then(() => {
      showLoggedOut();
      status.textContent = "Du bist abgemeldet.";
    })
    .catch((error) => {
      console.error("Anmeldestatus konnte nicht gelöscht werden:", error);
      status.textContent = "Die Abmeldung ist fehlgeschlagen.";
    });
});
