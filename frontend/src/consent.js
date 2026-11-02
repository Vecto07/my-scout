"use strict";

(() => {
  const consentKey = "my-scout.ads-consent.v1";
  const adClient = "ca-pub-2419030723209788";
  const banner = document.querySelector("#cookie-banner");
  const status = document.querySelector("#cookie-status");

  function loadAds() {
    if (document.querySelector('script[data-my-scout-adsense="true"]')) return;

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adClient}`;
    script.crossOrigin = "anonymous";
    script.dataset.myScoutAdsense = "true";
    document.head.appendChild(script);
  }

  function setConsent(value) {
    localStorage.setItem(consentKey, value);
    banner.hidden = true;
    if (value === "accepted") loadAds();
  }

  function showBanner() {
    banner.hidden = false;
  }

  document.querySelector("#cookie-accept").addEventListener("click", () => {
    setConsent("accepted");
  });
  document.querySelector("#cookie-reject").addEventListener("click", () => {
    setConsent("rejected");
  });
  document.querySelector("#cookie-settings").addEventListener("click", showBanner);

  const savedConsent = localStorage.getItem(consentKey);
  if (savedConsent === "accepted") {
    loadAds();
  } else if (savedConsent !== "rejected") {
    banner.hidden = false;
  }

  if (status) status.textContent = "";
})();
