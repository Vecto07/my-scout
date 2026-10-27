// This script only reads the page the user is already viewing.
const extensionApi =
  typeof browser !== "undefined" ? browser : chrome;

const menuId = "add-product-to-cart";
const scrapeCooldownMs = 5000;
const apiBaseUrl = "http://92.5.41.183:8080";
const tokenStorageKey = "jwtToken";
const lastScrapeByTab = new Map();

function createContextMenu() {
  extensionApi.contextMenus.create({
    id: menuId,
    title: "Read product on this page",
    contexts: ["page", "link"]
  });
}

extensionApi.runtime.onInstalled.addListener(createContextMenu);

function newRequestId() {
  return `${Date.now()}-${Math.random()}`;
}

async function injectScraper(tabId, selectedLink, requestId) {
  const scrapeData = { selectedLink, requestId };

  if (typeof chrome !== "undefined" && chrome.scripting) {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (data) => {
        window.universalCartScrapeData = data;
      },
      args: [scrapeData]
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["scraper.js"]
    });
    return;
  }

  await browser.tabs.executeScript(tabId, {
    code: `window.universalCartScrapeData = ${JSON.stringify(scrapeData)};`
  });
  await browser.tabs.executeScript(tabId, { file: "scraper.js" });
}

async function scrapeTab(tabId, selectedLink) {
  const now = Date.now();
  const lastScrape = lastScrapeByTab.get(tabId) || 0;
  if (now - lastScrape < scrapeCooldownMs) {
    throw new Error("Please wait a few seconds before scraping again.");
  }
  lastScrapeByTab.set(tabId, now);

  const requestId = newRequestId();
  return new Promise(async (resolve, reject) => {
    const timeout = setTimeout(() => {
      extensionApi.runtime.onMessage.removeListener(onMessage);
      reject(new Error("The page did not return product data."));
    }, 10000);

    function onMessage(message) {
      if (message.type !== "productScraped" ||
          message.requestId !== requestId) {
        return;
      }
      clearTimeout(timeout);
      extensionApi.runtime.onMessage.removeListener(onMessage);
      resolve(message.product);
    }

    extensionApi.runtime.onMessage.addListener(onMessage);
    try {
      await injectScraper(tabId, selectedLink, requestId);
    } catch (error) {
      clearTimeout(timeout);
      extensionApi.runtime.onMessage.removeListener(onMessage);
      reject(error);
    }
  });
}

async function saveError(message, product) {
  await extensionApi.storage.local.set({
    lastProduct: {
      ...(product || {}),
      error: message
    }
  });
}

function parsePrice(price) {
  const rawValue = String(price.value)
    .replace(/[^\d,.-]/g, "")
    .trim();
  if (!rawValue) {
    throw new Error("The product price is not a valid number.");
  }

  const lastComma = rawValue.lastIndexOf(",");
  const lastDot = rawValue.lastIndexOf(".");
  let normalized = rawValue;
  if (lastComma > lastDot) {
    normalized = rawValue.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = rawValue.replace(/,/g, "");
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("The product price is not a valid number.");
  }
  return parsed;
}

function toBackendItem(product) {
  if (!product.isLikelyProduct) {
    throw new Error("This page does not appear to be a product page.");
  }

  const price = product.prices?.[0];
  if (!price) {
    throw new Error("No product price was found.");
  }

  let url;
  try {
    url = new URL(product.url);
  } catch {
    throw new Error("The product URL is not valid.");
  }

  return {
    name: product.name?.trim() || "Unknown product",
    preis: parsePrice(price),
    shopName: url.hostname,
    url: url.href,
    bildUrl: product.imageUrl || ""
  };
}

async function addToCart(product) {
  const item = toBackendItem(product);
  const { [tokenStorageKey]: token } =
    await extensionApi.storage.local.get(tokenStorageKey);
  if (!token) {
    throw new Error("Please log in before adding products.");
  }

  let response;
  try {
    response = await fetch(`${apiBaseUrl}/api/artikel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(item)
    });
  } catch (error) {
    console.error("Could not connect to the Universal Cart backend:", error);
    throw new Error(
      "Could not connect to the backend. Check http://92.5.41.183:8080 and try again."
    );
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      await extensionApi.storage.local.remove(["loggedIn", tokenStorageKey]);
      throw new Error("Your login has expired. Please log in again.");
    }
    throw new Error(`The backend rejected the product (${response.status}).`);
  }
  return item;
}

async function scrapeVisibleTab(tabId, selectedLink) {
  let product;
  try {
    product = await scrapeTab(tabId, selectedLink);
    const item = await addToCart(product);
    const savedProduct = { ...product, backendItem: item };
    await extensionApi.storage.local.set({ lastProduct: savedProduct });
    return savedProduct;
  } catch (error) {
    console.error("Could not read the visible product page:", error);
    await saveError(
      error.message || "Could not read this page.",
      product
    );
    throw error;
  }
}

extensionApi.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== menuId || !tab || tab.id === undefined) {
    return;
  }

  const selectedLink = info.linkUrl
    ? { url: info.linkUrl, name: info.selectionText || "" }
    : null;
  scrapeVisibleTab(tab.id, selectedLink).catch(() => {});
});

extensionApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "scrapeCurrentPage") {
    return;
  }

  extensionApi.tabs.query({
    active: true,
    currentWindow: true
  })
    .then(([tab]) => {
      if (!tab || tab.id === undefined) {
        throw new Error("No active tab was found.");
      }
      return scrapeVisibleTab(tab.id, null);
    })
    .then((product) => sendResponse({ ok: true, product }))
    .catch((error) => sendResponse({
      ok: false,
      error: error.message || "Could not read this page."
    }));

  // Keep the response channel open while the page is being injected.
  return true;
});
