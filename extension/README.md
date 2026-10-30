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
  result to the backend article contract, sends it to `POST /api/artikel`, and
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

After loading the extension, create an account or log in with the backend
username and password. Registration calls `/api/auth/register` with
`benutzername`, `email`, and `passwort`; after successful registration the
extension logs in automatically. Then right-click a product page and select
**Add product to Universal Cart**.
The backend must be running at `https://api.my-scout.app`; the extension logs in
at `/api/auth/login` and posts this payload to `/api/artikel`:

```json
{
  "name": "Product name",
  "preis": 89.99,
  "shopName": "example.com",
  "url": "https://example.com/product",
  "bildUrl": "https://example.com/image.jpg"
}
```

The JWT returned by login is stored locally and sent as a Bearer token. The
backend supplies the article ID. The extension uses the first detected price
and sends an error instead of submitting when no valid price or currency is
available. It also performs a permissive product-page check using the page
title and price plus at least one product signal, such as product structured
data, product markup, a product image, or a product-like URL.

The scraper checks JSON-LD, Open Graph and schema.org data, common Amazon,
Apple and Shopify price selectors, product state embedded in scripts, and
visible price elements. Product images are collected from JSON-LD, Open Graph,
Twitter cards, normal images, lazy-loaded image attributes and `srcset`.
When the popup cannot find a price, it keeps the scraped product and shows a
manual price field so the product can still be saved.

If the backend is not running, the extension reports that it could not connect
to `https://api.my-scout.app`. A valid backend login is required before adding
products.

When adding fails after scraping, the popup still displays the scraped product
details and shows the submission error below them.

Developer mode is disabled by default. Enable it in the popup to see scraped
product details and diagnostic errors. With developer mode disabled, the popup
only reports whether adding the product succeeded or failed.

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

## Create a GitHub release

Every push to `main` that changes `extension/**` automatically increments the
patch version in both manifests, creates a `v<version>` tag, and publishes a
GitHub Release. The release contains
`universal-cart-chrome-<tag>.zip` and `universal-cart-firefox-<tag>.xpi`.
The workflow can also be started manually from the Actions tab. Leave the tag
empty to increment the patch version, or provide an explicit `vX.Y.Z` tag.

## Official references

- [Chrome action](https://developer.chrome.com/docs/extensions/reference/api/action)
- [Your second extension - Mozilla](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Your_second_WebExtension)
- [browserAction - Mozilla](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/browserAction)
- [tabs - Mozilla](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs)
- [Clipboard API - Mozilla](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Interact_with_the_clipboard)
