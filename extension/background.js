// This script only reads the page the user is already viewing.
const extensionApi =
  typeof browser !== "undefined" ? browser : chrome;

const menuId = "add-product-to-cart";
const scrapeCooldownMs = 5000;
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

async function saveError(message) {
  await extensionApi.storage.local.set({
    lastProduct: { error: message }
  });
}

async function scrapeVisibleTab(tabId, selectedLink) {
  try {
    const product = await scrapeTab(tabId, selectedLink);
    await extensionApi.storage.local.set({ lastProduct: product });
    return product;
  } catch (error) {
    console.error("Could not read the visible product page:", error);
    await saveError(error.message || "Could not read this page.");
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
