/* ============================================================================
 * DUNGEON WORLD — monetization.js
 * "Watch an ad to continue" + "$1.99 buy the full game (ad-free, unlimited
 * continues)" — layered entirely on top of script.js through the small
 * public API it exposes on window.DungeonWorld (see the bottom of
 * script.js). This file never touches game internals directly.
 *
 * Today (plain browser / before the Capacitor/iOS wrapper exists) the ad
 * and purchase are SIMULATED so the whole flow is clickable and testable
 * right now — clearly labeled "(preview)" wherever that's happening. Once
 * this game is wrapped with Capacitor and the AdMob + purchase plugins are
 * installed, this file automatically switches to the real native calls —
 * no game-code changes needed, just install the two plugins below and
 * fill in your real IDs.
 *
 * Plugins this expects, once added via Capacitor:
 *   npm install @capacitor-community/admob         (rewarded video ads)
 *   npm install cordova-plugin-purchase && npx cap update   (StoreKit IAP)
 * ========================================================================== */
(() => {
  "use strict";

  // ---------- fill these in once you have real IDs ----------
  const CONFIG = {
    // AdMob rewarded ad unit ID (iOS). Using Google's public TEST unit ID by
    // default so nothing here can accidentally serve/charge for real ads
    // until you swap this for your own from the AdMob console.
    AD_UNIT_ID_IOS: "ca-app-pub-3940256099942544/1712485313", // Google test rewarded ad unit
    // The non-consumable product ID you'll register in App Store Connect
    // for "buy the full game / remove ads".
    PRODUCT_ID: "dungeonworld_full_unlock",
    PRICE_LABEL: "$1.99",
  };

  const STORAGE_KEY = "dw_full_unlock_v1";

  // ---------- persisted "paid, ad-free" flag ----------
  function isFullUnlock() {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch (e) { return false; }
  }
  function setFullUnlock(v) {
    try { localStorage.setItem(STORAGE_KEY, v ? "1" : "0"); } catch (e) {}
  }

  // ---------- native platform detection ----------
  function nativeAdMob() {
    return (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()
      && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob) || null;
  }
  function nativePurchases() {
    return (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()
      && window.CdvPurchase && window.CdvPurchase.store) || null;
  }
  function isNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }

  // ---------- AdMob init + App Tracking Transparency ----------
  // Apple Guideline 2.1 rejection (2026-08-28): the app uses the
  // AppTrackingTransparency framework (NSUserTrackingUsageDescription is in
  // Info.plist) but reviewers never saw the permission dialog. Root cause:
  // nothing ever called AdMob.initialize() / requestTrackingAuthorization() —
  // prepareRewardedAd() went straight to prepareRewardVideoAd(). This runs
  // the official @capacitor-community/admob init sequence (initialize →
  // check tracking status → request it if undetermined → UMP consent form
  // if required) once, at app start, before any ad is ever prepared.
  let adMobInitPromise = null;
  function ensureAdMobInitialized() {
    const AdMob = nativeAdMob();
    if (!AdMob) return Promise.resolve(null);
    if (adMobInitPromise) return adMobInitPromise;
    adMobInitPromise = AdMob.initialize()
      .then(() => AdMob.trackingAuthorizationStatus())
      .then((trackingInfo) => {
        if (trackingInfo && trackingInfo.status === "notDetermined") {
          return AdMob.requestTrackingAuthorization();
        }
      })
      .catch((err) => console.warn("DungeonWorld: ATT request failed:", err))
      .then(() => AdMob.requestConsentInfo().catch((err) => {
        console.warn("DungeonWorld: requestConsentInfo failed:", err);
        return null;
      }))
      .then((consentInfo) => {
        if (consentInfo && consentInfo.isConsentFormAvailable && consentInfo.status === "REQUIRED") {
          return AdMob.showConsentForm().catch((err) => console.warn("DungeonWorld: consent form failed:", err));
        }
      })
      .catch((err) => console.warn("DungeonWorld: AdMob initialization failed:", err))
      .then(() => AdMob);
    return adMobInitPromise;
  }

  // ---------- rewarded ad ----------
  let adReady = false, adPreparing = false;

  function prepareRewardedAd() {
    const AdMob = nativeAdMob();
    if (!AdMob || adReady || adPreparing) return;
    adPreparing = true;
    ensureAdMobInitialized()
      .then(() => AdMob.prepareRewardVideoAd({ adId: CONFIG.AD_UNIT_ID_IOS, isTesting: false }))
      .then(() => { adReady = true; adPreparing = false; })
      .catch((err) => { adPreparing = false; console.warn("DungeonWorld: rewarded ad failed to prepare:", err); });
  }

  // callbacks: { onReward(), onFail(reason) }
  function showRewardedAd(callbacks) {
    const AdMob = nativeAdMob();
    if (AdMob) {
      ensureAdMobInitialized().then(() => {
        const RewardedEvent = "onRewardedVideoAdReward"; // @capacitor-community/admob RewardAdPluginEvents.Rewarded
        let earned = false;
        const rewardListener = AdMob.addListener(RewardedEvent, () => { earned = true; });
        const dismissListener = AdMob.addListener("onRewardedVideoAdDismissed", () => {
          rewardListener.then((h) => h.remove && h.remove());
          dismissListener.then((h) => h.remove && h.remove());
          adReady = false;
          prepareRewardedAd(); // preload the next one
          if (earned) callbacks.onReward(); else callbacks.onFail("dismissed_without_reward");
        });
        const go = () => AdMob.showRewardVideoAd().catch((err) => {
          adReady = false;
          callbacks.onFail(err && err.message || "show_failed");
        });
        if (adReady) go();
        else AdMob.prepareRewardVideoAd({ adId: CONFIG.AD_UNIT_ID_IOS, isTesting: false })
          .then(() => { adReady = true; go(); })
          .catch((err) => callbacks.onFail(err && err.message || "prepare_failed"));
      });
      return;
    }
    // ---- browser preview fallback: a real 5s "ad" so the flow is testable now ----
    showSimulatedAd(callbacks);
  }

  function showSimulatedAd(callbacks) {
    const overlay = el("div", "dw-ad-overlay");
    const box = el("div", "dw-ad-box");
    const label = el("div", "dw-ad-label", "PREVIEW AD");
    const sub = el("div", "dw-ad-sub", "Real ads play here in the App Store version.");
    const bar = el("div", "dw-ad-bar");
    const fill = el("div", "dw-ad-bar-fill");
    bar.appendChild(fill);
    const timeEl = el("div", "dw-ad-time", "5");
    box.appendChild(label); box.appendChild(sub); box.appendChild(bar); box.appendChild(timeEl);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    let t = 5;
    fill.style.width = "0%";
    const iv = setInterval(() => {
      t -= 1;
      timeEl.textContent = String(Math.max(0, t));
      fill.style.width = ((5 - t) / 5 * 100) + "%";
      if (t <= 0) {
        clearInterval(iv);
        overlay.remove();
        callbacks.onReward();
      }
    }, 1000);
  }

  // ---------- purchase (buy full game / remove ads) ----------
  let purchaseInitialized = false;
  function initNativePurchasesOnce() {
    const store = nativePurchases();
    if (!store || purchaseInitialized) return;
    purchaseInitialized = true;
    const { ProductType, Platform } = window.CdvPurchase;
    store.register({ id: CONFIG.PRODUCT_ID, type: ProductType.NON_CONSUMABLE, platform: Platform.APPLE_APPSTORE });
    store.when().approved((p) => p.verify());
    store.when().verified((p) => p.finish());
    store.when().owned(() => setFullUnlock(true));
    store.initialize([Platform.APPLE_APPSTORE]).catch((err) => console.warn("DungeonWorld: store init failed:", err));
  }

  // callbacks: { onSuccess(), onFail(reason) }
  function purchaseFullUnlock(callbacks) {
    const store = nativePurchases();
    if (store) {
      initNativePurchasesOnce();
      const off1 = store.when().owned(() => { setFullUnlock(true); callbacks.onSuccess(); });
      const off2 = store.when().error(cordovaErr => callbacks.onFail(cordovaErr && cordovaErr.message));
      store.order(CONFIG.PRODUCT_ID).catch((err) => callbacks.onFail(err && err.message || "order_failed"));
      return;
    }
    // ---- browser preview fallback: no real payment processor exists here,
    // so this only ever "succeeds" locally after an explicit confirm click,
    // purely so the unlocked-state UI can be tested before the App Store
    // build exists. It never runs inside the native app. ----
    showSimulatedPurchaseConfirm(callbacks);
  }

  function restorePurchases(callbacks) {
    const store = nativePurchases();
    if (store) {
      initNativePurchasesOnce();
      store.restorePurchases()
        .then(() => callbacks.onSuccess(isFullUnlock()))
        .catch((err) => callbacks.onFail(err && err.message || "restore_failed"));
      return;
    }
    callbacks.onSuccess(isFullUnlock());
  }

  function showSimulatedPurchaseConfirm(callbacks) {
    const overlay = el("div", "dw-ad-overlay");
    const box = el("div", "dw-ad-box");
    const label = el("div", "dw-ad-label", "PREVIEW PURCHASE");
    const sub = el("div", "dw-ad-sub", CONFIG.PRICE_LABEL + " — Remove Ads & Unlimited Continues");
    const note = el("div", "dw-ad-sub", "This is a local preview. Real purchases happen through Apple in the App Store app.");
    const row = el("div", "dw-modal-btnrow");
    const yes = el("button", "dw-btn dw-btn-gold", "Confirm (preview)");
    const no = el("button", "dw-btn dw-btn-ghost", "Cancel");
    yes.onclick = () => { overlay.remove(); setFullUnlock(true); callbacks.onSuccess(); };
    no.onclick = () => { overlay.remove(); callbacks.onFail("cancelled"); };
    row.appendChild(yes); row.appendChild(no);
    box.appendChild(label); box.appendChild(sub); box.appendChild(note); box.appendChild(row);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  // ---------- tiny DOM helpers ----------
  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }
  function toast(msg) {
    const t = el("div", "dw-toast", msg);
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add("dw-toast-in"));
    setTimeout(() => { t.classList.remove("dw-toast-in"); setTimeout(() => t.remove(), 300); }, 2200);
  }

  // ---------- styles (injected once) ----------
  function injectStyles() {
    if (document.getElementById("dw-monetization-style")) return;
    const style = document.createElement("style");
    style.id = "dw-monetization-style";
    style.textContent = `
      .dw-modal-overlay, .dw-ad-overlay {
        position:fixed; inset:0; background:rgba(8,6,16,0.86);
        display:flex; align-items:center; justify-content:center;
        z-index:300000; padding:20px; box-sizing:border-box;
      }
      .dw-modal, .dw-ad-box {
        width:100%; max-width:380px; background:#2f2433; border:5px solid #1a1320;
        border-radius:16px; box-shadow:8px 8px 0 #00000066, inset 0 0 0 2px #ffffff14;
        padding:22px 18px; text-align:center; font-family:"Comic Neue",system-ui,sans-serif; color:#f3e7c2;
      }
      .dw-modal-title { font-family:"Bangers",cursive; letter-spacing:2px; font-size:32px; color:#ffd53d; text-shadow:2px 2px 0 #000; }
      .dw-modal-score { margin:6px 0 18px; font-size:15px; color:#bfe9ff; }
      .dw-modal-btnrow, #dwModalButtons { display:flex; flex-direction:column; gap:10px; }
      .dw-btn {
        font-family:"Bangers",cursive; letter-spacing:1px; font-size:17px; color:#fff;
        border:3px solid #1a1320; border-radius:12px; padding:12px 10px; cursor:pointer;
        box-shadow:0 4px 0 rgba(0,0,0,0.35);
      }
      .dw-btn:active { transform:translateY(3px); box-shadow:0 1px 0 rgba(0,0,0,0.35); }
      .dw-btn-blue { background:#37aeea; }
      .dw-btn-purple { background:linear-gradient(180deg,#b865ff,#8750e8); }
      .dw-btn-gold { background:radial-gradient(circle at 38% 32%,#ffe14d,#f0a400); color:#3a2400; }
      .dw-btn-ghost { background:transparent; box-shadow:none; color:#cbb98a; font-size:14px; border-color:#5b5566; }
      .dw-modal-footer { margin-top:14px; font-size:12px; color:#8a86a0; }
      .dw-modal-footer a, .dw-link { color:#8fd0ff; cursor:pointer; text-decoration:underline; }
      .dw-ad-label { font-family:"Bangers",cursive; letter-spacing:2px; font-size:20px; color:#37aeea; }
      .dw-ad-sub { font-size:13px; color:#cbb98a; margin:8px 0; }
      .dw-ad-bar { width:100%; height:10px; background:#1a1320; border-radius:6px; overflow:hidden; margin:14px 0 6px; }
      .dw-ad-bar-fill { height:100%; background:#37aeea; width:0%; transition:width 1s linear; }
      .dw-ad-time { font-family:"Bangers",cursive; font-size:22px; color:#ffd53d; }
      .dw-toast {
        position:fixed; top:16px; left:50%; transform:translate(-50%,-140%); z-index:400000;
        background:#2f2433; border:3px solid #1a1320; border-radius:10px; padding:10px 16px;
        color:#f3e7c2; font-family:"Comic Neue",system-ui,sans-serif; font-size:14px;
        box-shadow:4px 4px 0 #00000066; transition:transform 0.3s ease; max-width:80vw; text-align:center;
      }
      .dw-toast-in { transform:translate(-50%,0); }
    `;
    document.head.appendChild(style);
  }

  // ---------- game-over modal ----------
  let modalEl = null;
  function buildModal() {
    modalEl = el("div", "dw-modal-overlay");
    modalEl.style.display = "none";
    const modal = el("div", "dw-modal");
    modal.appendChild(el("div", "dw-modal-title", "RUN OVER"));
    const scoreEl = el("div", "dw-modal-score");
    scoreEl.id = "dwModalScore";
    modal.appendChild(scoreEl);
    const btns = el("div");
    btns.id = "dwModalButtons";
    modal.appendChild(btns);
    const footer = el("div", "dw-modal-footer");
    footer.id = "dwModalFooter";
    modal.appendChild(footer);
    modalEl.appendChild(modal);
    document.body.appendChild(modalEl);
  }

  function closeModal() {
    if (!modalEl) return;
    modalEl.style.display = "none";
    if (window.DungeonWorld) window.DungeonWorld.setModalOpen(false);
  }

  function showGameOverModal(data) {
    if (!modalEl) buildModal();
    document.getElementById("dwModalScore").textContent = "SCORE " + data.score + " · BEST " + data.best + " · FLOOR " + data.floor;
    const btns = document.getElementById("dwModalButtons");
    const footer = document.getElementById("dwModalFooter");
    btns.innerHTML = "";
    footer.innerHTML = "";

    const fullUnlock = isFullUnlock();

    if (fullUnlock) {
      // Paid users: free, unlimited, no-ad continue.
      const continueBtn = el("button", "dw-btn dw-btn-blue", "▶ CONTINUE");
      continueBtn.onclick = () => { closeModal(); window.DungeonWorld.continueRun(); };
      btns.appendChild(continueBtn);
    } else if (data.canContinue) {
      const adBtn = el("button", "dw-btn dw-btn-blue", "▶ WATCH AD TO CONTINUE");
      adBtn.onclick = () => {
        adBtn.disabled = true; adBtn.textContent = "LOADING AD…";
        showRewardedAd({
          onReward() { closeModal(); window.DungeonWorld.continueRun(); },
          onFail() { adBtn.disabled = false; adBtn.textContent = "▶ WATCH AD TO CONTINUE"; toast("Ad didn't finish — no continue this time."); }
        });
      };
      btns.appendChild(adBtn);
    }

    const restartBtn = el("button", "dw-btn dw-btn-purple", "RESTART RUN");
    restartBtn.onclick = () => { closeModal(); window.DungeonWorld.restart(); };
    btns.appendChild(restartBtn);

    if (!fullUnlock) {
      const buyBtn = el("button", "dw-btn dw-btn-gold",
        (data.canContinue ? "REMOVE ADS — " : "CONTINUE INSTEAD — ") + CONFIG.PRICE_LABEL);
      buyBtn.onclick = () => {
        buyBtn.disabled = true;
        purchaseFullUnlock({
          onSuccess() {
            buyBtn.disabled = false;
            toast("Ads removed — thanks for supporting Dungeon World!");
            showGameOverModal(Object.assign({}, data, { canContinue: true })); // re-render with unlocked state
          },
          onFail(reason) {
            buyBtn.disabled = false;
            if (reason !== "cancelled") toast("Purchase didn't go through.");
          }
        });
      };
      btns.appendChild(buyBtn);

      const restoreLink = el("span", "dw-link", "Restore purchase");
      restoreLink.onclick = () => {
        restorePurchases({
          onSuccess(unlocked) {
            if (unlocked) { toast("Purchase restored!"); showGameOverModal(Object.assign({}, data, { canContinue: true })); }
            else toast("No previous purchase found.");
          },
          onFail() { toast("Couldn't restore right now."); }
        });
      };
      footer.appendChild(restoreLink);
    }

    modalEl.style.display = "flex";
    if (window.DungeonWorld) window.DungeonWorld.setModalOpen(true);
  }

  // ---------- wire up ----------
  function init() {
    injectStyles();
    buildModal();
    if (!window.DungeonWorld) { console.warn("DungeonWorld API not found — monetization.js must load after script.js"); return; }
    window.DungeonWorld.onGameOver(showGameOverModal);
    ensureAdMobInitialized().then(prepareRewardedAd);
    initNativePurchasesOnce();
  }

  // Small debug/QA hook — lets you preview the modal without playing to
  // death. Not wired to any game UI. Try it from the browser console:
  //   window.DungeonWorldMonetization.debugShowGameOver()
  window.DungeonWorldMonetization = {
    isFullUnlock, setFullUnlock, isNative,
    debugShowGameOver(overrides) {
      showGameOverModal(Object.assign({ score: 1234, best: 5000, floor: 3, canContinue: true, continuesUsed: 0, maxFreeContinues: 2, fullUnlock: isFullUnlock() }, overrides || {}));
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
