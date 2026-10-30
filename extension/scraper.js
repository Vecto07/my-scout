(() => {
  const scrapeData = window.universalCartScrapeData || {};
  const selectedLink = scrapeData.selectedLink;
  const requestId = scrapeData.requestId;
  delete window.universalCartScrapeData;

  const meta = (selector) => document.querySelector(selector)?.content?.trim();
  const text = (selector) => {
    const element = document.querySelector(selector);
    return element?.content?.trim() || element?.textContent?.trim();
  };
  const selectedAnchor = selectedLink?.url
    ? [...document.querySelectorAll("a[href]")].find((anchor) => {
        return new URL(anchor.href, window.location.href).href === selectedLink.url;
      })
    : null;

  const jsonLdProducts = [...document.querySelectorAll(
    'script[type="application/ld+json"]'
  )]
    .map((script) => {
      try {
        return JSON.parse(script.textContent);
      } catch {
        return null;
      }
    })
    .flatMap((data) => Array.isArray(data) ? data : [data])
    .flatMap((data) => data?.["@graph"] || [data])
    .filter((data) => {
      const type = data?.["@type"];
      return Array.isArray(type) ? type.includes("Product") : type === "Product";
    });

  const pageProduct = selectedLink?.url &&
    selectedLink.url !== window.location.href
    ? null
    : jsonLdProducts[0];
  const isDifferentSelectedLink = Boolean(
    selectedLink?.url && selectedLink.url !== window.location.href
  );
  const prices = [];
  const pricePattern = /(?:€|EUR|£|GBP|\$|USD|CHF|CAD|AUD)\s*\d[\d.,\s]*|\d[\d.,\s]*\s*(?:€|EUR|£|GBP|\$|USD|CHF|CAD|AUD)/gi;
  const numberPricePattern = /(?:price|preis|amount|cost|value|from|ab)[^\d]{0,20}(\d{1,6}(?:[.,]\d{1,2})?)/i;

  function addPrice(value, currency, source) {
    if (value === undefined || value === null || String(value).trim() === "") {
      return;
    }

    const price = {
      value: String(value).trim(),
      currency: currency ? String(currency).trim() : "",
      source
    };
    const duplicate = prices.some((item) =>
      item.value === price.value && item.currency === price.currency
    );
    if (!duplicate) {
      prices.push(price);
    }
  }

  function addPricesFromText(value, source) {
    if (!value) {
      return;
    }

    function addPriceFromElement(element, source) {
      if (!element) {
        return;
      }
      const value = element.getAttribute("content") ||
        element.getAttribute("data-price") ||
        element.getAttribute("data-product-price") ||
        element.textContent;
      addPricesFromText(value, source);
      if (!prices.length && value) {
        const match = String(value).match(numberPricePattern);
        if (match) {
          addPrice(match[1], "", `${source} (ohne Währung)`);
        }
      }
    }

    for (const match of String(value).match(pricePattern) || []) {
      addPrice(match, "", source);
    }
  }

  for (const product of pageProduct ? [pageProduct] : []) {
    const offers = Array.isArray(product.offers)
      ? product.offers
      : [product.offers];
    for (const offer of offers) {
      addPrice(offer?.price, offer?.priceCurrency, "JSON-LD");
    }
  }

  if (!isDifferentSelectedLink) {
    addPrice(
      meta('meta[property="product:price:amount"]'),
      meta('meta[property="product:price:currency"]'),
      "product meta tags"
    );
    addPrice(
      meta('meta[property="og:price:amount"]') || meta('meta[property="og:price"]'),
      meta('meta[property="og:price:currency"]'),
      "Open Graph meta tags"
    );
    addPrice(
      meta('meta[itemprop="price"]') || text('[itemprop="price"]'),
      meta('meta[itemprop="priceCurrency"]') || text('[itemprop="priceCurrency"]'),
      "itemprop markup"
    );

    for (const selector of [
      // Amazon's accessible price text is usually in .a-offscreen.
      "#corePriceDisplay_desktop_feature_div .a-price .a-offscreen",
      "#corePriceDisplay_mobile_feature_div .a-price .a-offscreen",
      "#priceblock_ourprice",
      "#priceblock_dealprice",
      "#priceblock_saleprice",
      "#newBuyBoxPrice",
      "#price_inside_buybox",
      "#price .a-offscreen",
      ".a-price .a-offscreen",
      ".price-item--sale",
      ".price-item--regular",
      ".price__regular",
      ".price__sale",
      ".product-price",
      ".product__price",
      ".rf-price",
      ".as-price-current",
      "[data-autom='productPrice']",
      "[data-autom='price']",
      "[data-testid*='price' i]",
      "[class*='price' i]",
      "[id*='price' i]",
      "[data-product-price]",
      "[data-price]"
    ]) {
      for (const element of [...document.querySelectorAll(selector)].slice(0, 8)) {
        addPriceFromElement(element, `Preis im Selektor: ${selector}`);
      }
    }

    for (const script of document.querySelectorAll(
      'script:not([src]), [data-state], [data-product], [data-product-json]'
    )) {
      const value = script.textContent || script.getAttribute("data-state") ||
        script.getAttribute("data-product") || script.getAttribute("data-product-json");
      if (value && /price|amount|preis|cost/i.test(value)) {
        addPricesFromText(value, "Preis aus Seitendaten");
        const match = value.match(numberPricePattern);
        if (match) {
          addPrice(match[1], "", "Preis aus Seitendaten (ohne Währung)");
        }
      }
    }
  }

  const name = isDifferentSelectedLink
    ? selectedAnchor?.textContent?.trim() || selectedLink.name || "Selected link"
    : pageProduct?.name ||
      text("#productTitle") ||
      text("#title") ||
      meta('meta[property="og:title"]') ||
      meta('meta[name="twitter:title"]') ||
      text("h1") ||
      document.title;
  // Some shops put the price directly in the product title or link text.
  if (!isDifferentSelectedLink) {
    addPricesFromText(name, "Preis im Produktnamen");
  }
  const image = pageProduct?.image;
  const imageUrl = Array.isArray(image) ? image[0] : image;
  const imageCandidates = [
    imageUrl,
    meta('meta[property="og:image"]'),
    meta('meta[name="twitter:image"]'),
    meta('meta[property="og:image:url"]'),
    ...[...document.querySelectorAll(
      'img[src], img[currentSrc], img[data-src], img[data-lazy-src], img[srcset], picture source[srcset]'
    )].slice(0, 20).flatMap((element) => [
      element.currentSrc,
      element.getAttribute("src"),
      element.getAttribute("data-src"),
      element.getAttribute("data-lazy-src"),
      element.getAttribute("srcset")?.split(",")[0]?.trim().split(/\s+/)[0]
    ])
  ];
  const absoluteImageUrl = imageCandidates
    .map((candidate) => {
      try {
        return candidate ? new URL(candidate, window.location.href).href : "";
      } catch {
        return "";
      }
    })
    .find((candidate) => /^https?:\/\//i.test(candidate)) || "";
  const hasProductMarkup = Boolean(document.querySelector(
    '[itemprop="price"], [itemprop="priceCurrency"], [itemtype*="Product"]'
  ));
  const hasProductUrl = /\/(?:dp|gp\/product|product|products|item|p)(?:\/|[-_])/i
    .test(window.location.pathname);
  const isLikelyProduct = !isDifferentSelectedLink &&
    Boolean(name &&
      (jsonLdProducts.length || hasProductMarkup || absoluteImageUrl || hasProductUrl));
  const product = {
    url: selectedLink?.url || window.location.href,
    name: name || "Unbekanntes Produkt",
    prices,
    imageUrl: absoluteImageUrl,
    isLikelyProduct,
    source: isDifferentSelectedLink
      ? "selected link only; open the link to read its product data"
      : prices.length
        ? "multiple methods"
        : "kein Preis gefunden",
    scrapedAt: new Date().toISOString()
  };

  const api = typeof browser !== "undefined" ? browser : chrome;
  api.runtime.sendMessage({ type: "productScraped", requestId, product });
})();
