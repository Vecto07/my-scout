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
const productSource = document.querySelector("#product-source");
const productError = document.querySelector("#product-error");
const devModeToggle = document.querySelector("#dev-mode");
const productDetailsSection = document.querySelector("#product-details-section");
let devMode = false;
const apiBaseUrl = "http://92.5.41.183:8080";

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
  if (!devMode || !product) {
    return;
  }

  productName.textContent = product.name || "Unknown product";
  productPrices.replaceChildren();
  if (!product.prices?.length) {
    productPrices.textContent = "No price found";
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
  productSource.textContent = product.source || "-";
  productError.textContent = product.error || "-";
  productError.hidden = !product.error;
}

// Keep the placeholder login state when the popup is closed and reopened.
storageGet(["loggedIn", "lastProduct", "devMode"])
  .then(({ loggedIn, lastProduct, devMode: storedDevMode }) => {
    devMode = storedDevMode === true;
    devModeToggle.checked = devMode;
    if (loggedIn) {
      showLoggedIn();
    }
    showProduct(lastProduct);
  })
  .catch((error) => {
    console.error("Could not read login state:", error);
    status.textContent = "Could not read the login state.";
  });

devModeToggle.addEventListener("change", async () => {
  devMode = devModeToggle.checked;
  try {
    await storageSet({ devMode });
    const { lastProduct } = await storageGet("lastProduct");
    showProduct(lastProduct);
  } catch (error) {
    console.error("Could not save developer mode:", error);
    status.textContent = "Could not update developer mode.";
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
    status.textContent = "Logged in. You can add products now.";
  } catch (error) {
    console.error("Could not save login state:", error);
    status.textContent = error.message || "Could not log in.";
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
    console.error("Could not connect to the backend:", error);
    throw new Error("Could not connect to the backend.");
  }

  if (!response.ok) {
    const message = (await response.text()).trim();
    throw new Error(message || "Login failed. Check your username and password.");
  }

  const token = (await response.text()).trim();
  if (!token) {
    throw new Error("Login failed because the backend returned no token.");
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
      throw new Error(message || "Registration failed.");
    }

    const token = await login(username, password);
    await storageSet({ loggedIn: true, jwtToken: token });
    showLoggedIn();
    status.textContent = "Account created. You are logged in.";
  } catch (error) {
    console.error("Could not register account:", error);
    status.textContent = error.message || "Could not create the account.";
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
    status.textContent = "Reading product details...";
    const response = await sendRuntimeMessage({
      type: "scrapeCurrentPage"
    });
    if (!response?.ok) {
      throw new Error(response?.error || "Could not read this page.");
    }
    showProduct(response.product);
    status.textContent = "Product added to the universal cart.";
  } catch (error) {
    console.error("Could not scrape the product page:", error);
    if (devMode) {
      try {
        const { lastProduct } = await storageGet("lastProduct");
        showProduct(lastProduct);
      } catch (storageError) {
        console.error("Could not display the scraped product:", storageError);
      }
    }
    status.textContent = "Product could not be added.";
  }
});

document.querySelector("#logout").addEventListener("click", () => {
  storageRemove(["loggedIn", "jwtToken"])
    .then(() => {
      showLoggedOut();
      status.textContent = "Logged out.";
    })
    .catch((error) => {
      console.error("Could not clear login state:", error);
      status.textContent = "Could not log out.";
    });
});
