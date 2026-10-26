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
  const pricePattern = /(?:€|EUR|£|GBP|\$|USD)\s*\d[\d.,]*|\d[\d.,]*\s*(?:€|EUR|£|GBP|\$|USD)/gi;

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
      "[data-product-price]",
      "[data-price]"
    ]) {
      const value = text(selector);
      addPrice(value, "", `visible selector: ${selector}`);
      addPricesFromText(value, `price in selector: ${selector}`);
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
    addPricesFromText(name, "price in product name");
  }
  const image = pageProduct?.image;
  const imageUrl = Array.isArray(image) ? image[0] : image;
  const absoluteImageUrl = imageUrl
    ? new URL(imageUrl, window.location.href).href
    : meta('meta[property="og:image"]') ||
      meta('meta[name="twitter:image"]') ||
      "";
  const product = {
    url: selectedLink?.url || window.location.href,
    name: name || "Unknown product",
    prices,
    imageUrl: absoluteImageUrl,
    source: isDifferentSelectedLink
      ? "selected link only; open the link to read its product data"
      : prices.length
        ? "multiple methods"
        : "no price found",
    scrapedAt: new Date().toISOString()
  };

  const api = typeof browser !== "undefined" ? browser : chrome;
  api.runtime.sendMessage({ type: "productScraped", requestId, product });
})();
