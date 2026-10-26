# Universal Cart (browser extension example)

This is a small cross-browser WebExtension with a toolbar popup. It has a
placeholder login form. Any non-empty credentials are accepted for now. After
login, the **Add current page** button reads the visible page and sends the
item to the local backend.

## Files

- `manifest.json` is the Chrome Manifest V3 metadata and configuration file.
  It declares the extension name, permission, toolbar button, and popup.
- `manifest.firefox.json` is the Firefox Manifest V2 variant. Firefox uses a
  `browser_action` key instead of Chrome's `action` key.
- `popup.html` contains the small user interface.
- `popup.css` styles the interface.
- `popup.js` handles the placeholder login, login state, and current-page
  scraping. The demo login state is stored locally in the extension.
- `background.js` adds the context-menu item, runs the scraper, converts the
  result to the backend item contract, sends it to `POST /api/items`, and
  stores the result.
- `scraper.js` reads product data from the current page. It tries JSON-LD
  first, then Open Graph/meta data and common visible elements. It also checks
  product names for embedded prices, uses Amazon's product title field, and
  includes Amazon price selectors. It keeps all distinct prices and their
  sources instead of choosing between conflicts.

JSON does not support comments, so the explanatory comments are in
`popup.js` and this README.

## Load it temporarily in Chrome

1. Open Chrome and visit `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose this folder.
5. Press the extension's toolbar button. If it is not visible, use the
   extensions menu to add it to the toolbar.

After loading the extension, right-click a product page and select
**Add product to Universal Cart**. Open the extension popup to see the last
scraped name, price, currency, link, and extraction source. The backend must
be running at `http://localhost:8080`; the extension posts this payload:

```json
{
  "title": "Product name",
  "price": 89.99,
  "currency": "EUR",
  "imageUrl": "https://example.com/image.jpg",
  "shop": "example.com",
  "url": "https://example.com/product",
  "quantity": 1
}
```

The backend supplies `id` and `addedAt`. The extension uses the first detected
price and sends an error instead of submitting when no valid price or currency
is available. It also performs a permissive product-page check using the page
title and price plus at least one product signal, such as product structured
data, product markup, a product image, or a product-like URL.

If the backend is not running, the extension reports that it could not connect
to `http://localhost:8080`. The backend must also implement `POST /api/items`;
the current backend documentation lists that endpoint as planned.

When adding fails after scraping, the popup still displays the scraped product
details and shows the submission error below them.

The same menu is available when right-clicking a link. It reads the current
page and uses the selected link as the product URL. It does not open the link
in a background tab, which avoids extra requests and reduces the chance of
triggering bot protection. It does not attach the current page's name or price
to the link. A linked page's own price can only be read after the user opens
that page.

The extension deliberately does not spoof browser details, rotate proxies,
solve CAPTCHAs, or bypass access controls. It waits five seconds between
scrapes in the same tab and stops when the page does not allow access.

## Load it temporarily in Firefox

1. Open Firefox and visit `about:debugging`.
2. Select **This Firefox**.
3. Select **Load Temporary Add-on...**.
4. Choose `manifest.firefox.json` in this folder.
5. Press the extension's toolbar button. If it is not visible, use the
   extensions menu to add it to the toolbar.

Temporary add-ons are removed when Firefox restarts. A signed, packaged add-on
is needed for permanent installation.

## Official references

- [Chrome action](https://developer.chrome.com/docs/extensions/reference/api/action)
- [Your second extension - Mozilla](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Your_second_WebExtension)
- [browserAction - Mozilla](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/browserAction)
- [tabs - Mozilla](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs)
- [Clipboard API - Mozilla](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Interact_with_the_clipboard)
