importScripts('../shared/provider-candidate.js');
importScripts('../shared/cp-inventory.js');
importScripts('../shared/provider-store.js');
importScripts('../shared/mk-provider-lookup.js');
importScripts('../shared/naver-line-map.js');
importScripts('../shared/building-units-resolver.js');

globalThis.__DHS_SERVICE_WORKER_VERSION__ = '0.1.322';
const PROVIDER_SOURCE = 'DHS_ANYTHING_PROVIDER_CAPTURE';
const BRIDGE_SOURCE = 'DHS_ANYTHING_CHROME_BRIDGE';
const DEBUGGER_PROTOCOL_VERSION = '1.3';
const PROVIDER_TAB_AUTO_CLOSE_ENABLED = true;
const PROVIDER_TAB_CLOSE_DELAY_MS = 7000;
const PROVIDER_TAB_CLOSE_AFTER_CANDIDATE_MS = 1200;
const PROVIDER_REQUEST_TTL_MS = 2 * 60 * 1000;
const PROVIDER_DIRECT_LOOKUP_TIMEOUT_MS = 6500;
const PROVIDER_DIRECT_LOOKUP_MAX_BYTES = 600000;
const FIN_FRONT_API_TIMEOUT_MS = 6500;
const FIN_FRONT_API_BASE = 'https://fin.land.naver.com/front-api/v1';
const REGION_EXPORT_MAX_CSV_BYTES = 8 * 1024 * 1024;
const DHS_RUNTIME_SESSION_TOKEN = typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const providerStore = globalThis.DHS_PROVIDER_STORE.createProviderCandidateStore();
let pendingProviderOpenerTabId = 0;
let pendingProviderOpenerClearTimer = 0;
let providerRequestEpoch = 0;
const providerTabCloseTimers = new Map();
const providerRequestTabIds = new Set();
const DHS_NAVER_MATCHES = [
  'https://new.land.naver.com/*',
  'https://fin.land.naver.com/*'
];
const DHS_PROVIDER_MATCHES = [
  'http://land.mk.co.kr/*',
  'https://land.mk.co.kr/*',
  'https://m.land.mk.co.kr/*',
  'https://landad.mk.co.kr/*',
  'https://r114.com/*',
  'https://*.r114.com/*',
  'https://n.gongsilclub.com/*',
  'https://m.gongsilclub.com/*',
  'https://homesdid.co.kr/*',
  'https://m.homesdid.co.kr/*',
  'https://serve.co.kr/*',
  'https://*.serve.co.kr/*',
  'https://rfine.kr/*',
  'https://*.rfine.kr/*',
  'https://rter2.com/*',
  'https://*.rter2.com/*',
  'https://rego.kr/*',
  'https://*.rego.kr/*',
  'https://m.rego.kr/*',
  'https://asil.kr/*',
  'https://*.asil.kr/*',
  'https://realestate.hankyung.com/*',
  'https://maemul.hankyung.com/*',
  'https://land.hankyung.com/*',
  'https://hankyung.com/*',
  'https://www.hankyung.com/*',
  'https://land.daara.co.kr/*',
  'https://m.land.daara.co.kr/*',
  'https://industryland.co.kr/*',
  'https://*.industryland.co.kr/*',
  'https://www.industryland.co.kr/*',
  'https://neonet.co.kr/*',
  'https://*.neonet.co.kr/*',
  'https://www.neonet.co.kr/*',
  'https://m.neonet.co.kr/*',
  'https://ten.co.kr/*',
  'https://*.ten.co.kr/*',
  'https://karhanbang.com/*',
  'https://*.karhanbang.com/*',
  'https://www.karhanbang.com/*',
  'https://thebiz.co.kr/*',
  'https://www.thebiz.co.kr/*',
  'https://thebiz.kr/*',
  'https://www.thebiz.kr/*',
  'https://woori-house.co.kr/*',
  'https://*.woori-house.co.kr/*',
  'https://landcenter.kiso.or.kr/*'
];
const DHS_NAVER_MAIN_WORLD_FILES = [
  'src/shared/naver-line-map.js',
  'src/shared/building-units-resolver.js',
  'src/shared/line-inference.js',
  'src/shared/provider-candidate.js',
  'src/shared/active-group-routes.js',
  'src/content/page-hook.js'
];
const DHS_NAVER_ISOLATED_WORLD_FILES = [
  'src/shared/runtime-guard.js',
  'src/shared/article-state.js',
  'src/shared/route-search.js',
  'src/shared/group-routes.js',
  'src/shared/active-group-routes.js',
  'src/shared/kb-alias.js',
  'src/shared/provider-candidate.js',
  'src/shared/group-candidate.js',
  'src/shared/grouped-listing.js',
  'src/shared/provider-target.js',
  'src/shared/cp-inventory.js',
  'src/shared/line-inference.js',
  'src/shared/land-line-promotion.js',
  'src/shared/naver-line-map.js',
  'src/shared/building-units-resolver.js',
  'src/shared/dongho-quality.js',
  'src/shared/dongho-presentation.js',
  'src/shared/listing-area-presentation.js',
  'src/shared/region-export-checkpoint.js',
  'src/shared/region-export-selection.js',
  'src/shared/live-loop.js',
  'src/shared/overlay-view.js',
  'src/content/bridge.js'
];
const DHS_PROVIDER_MAIN_WORLD_FILES = [
  'src/content/page-hook.js'
];
const DHS_PROVIDER_ISOLATED_WORLD_FILES = [
  'src/shared/runtime-guard.js',
  'src/shared/provider-candidate.js',
  'src/shared/mk-provider-lookup.js',
  'src/content/provider-capture.js'
];
const DHS_NAVER_CSS_FILES = [
  'src/content/overlay.css'
];

function manifestContentScriptRegistrations() {
  try {
    const manifest = chrome.runtime.getManifest();
    return (Array.isArray(manifest.content_scripts) ? manifest.content_scripts : [])
      .map((script, index) => {
        const registration = {
          id: `dhs-anything-content-${index}`,
          matches: script.matches || [],
          js: script.js || [],
          allFrames: Boolean(script.all_frames),
          persistAcrossSessions: true
        };
        if (script.run_at) registration.runAt = script.run_at;
        if (script.world) registration.world = script.world;
        return registration;
      })
      .filter((script) => script.matches.length > 0 && script.js.length > 0);
  } catch (_) {
    return [];
  }
}

function registerCurrentContentScripts() {
  if (!chrome.scripting || typeof chrome.scripting.registerContentScripts !== 'function') return;
  const scripts = manifestContentScriptRegistrations();
  if (scripts.length === 0) return;
  try {
    chrome.scripting.registerContentScripts(scripts, () => {
      void chrome.runtime.lastError;
    });
  } catch (_) {}
}

function dhsHostnameMatches(hostname, patternHost) {
  const host = String(hostname || '').toLowerCase();
  const pattern = String(patternHost || '').toLowerCase();
  if (!host || !pattern) return false;
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(2);
    return host === suffix || host.endsWith(`.${suffix}`);
  }
  return host === pattern;
}

function dhsTabMatchesPattern(tabAddress, pattern) {
  try {
    const parsed = new URL(String(tabAddress || ''));
    const parsedPattern = new URL(String(pattern || '').replace('*', ''));
    return parsed.protocol === parsedPattern.protocol &&
      dhsHostnameMatches(parsed.hostname, parsedPattern.hostname) &&
      parsed.pathname.startsWith(parsedPattern.pathname.replace(/\*+$/, ''));
  } catch (_) {
    return false;
  }
}

function dhsTabMatchesAny(tabAddress, patterns) {
  return (Array.isArray(patterns) ? patterns : []).some((pattern) => dhsTabMatchesPattern(tabAddress, pattern));
}

function executeDhsContentFiles(tabId, files, world) {
  if (!chrome.scripting || typeof chrome.scripting.executeScript !== 'function') return;
  if (!tabId || !Array.isArray(files) || files.length === 0) return;
  try {
    chrome.scripting.executeScript({
      target: { tabId },
      files,
      world
    }, () => {
      void chrome.runtime.lastError;
    });
  } catch (_) {}
}

function executeDhsIsolatedContentFiles(tabId, files) {
  if (!chrome.scripting || typeof chrome.scripting.executeScript !== 'function') return;
  if (!tabId || !Array.isArray(files) || files.length === 0) return;
  try {
    chrome.scripting.executeScript({
      target: { tabId },
      world: 'ISOLATED',
      func: (runtimeSessionToken) => {
        window.__DHS_ANYTHING_RUNTIME_SESSION__ = runtimeSessionToken;
      },
      args: [DHS_RUNTIME_SESSION_TOKEN]
    }, () => {
      const markerError = chrome.runtime.lastError;
      if (markerError) return;
      executeDhsContentFiles(tabId, files, 'ISOLATED');
    });
  } catch (_) {}
}

function insertDhsCssFiles(tabId, files) {
  if (!chrome.scripting || typeof chrome.scripting.insertCSS !== 'function') return;
  if (!tabId || !Array.isArray(files) || files.length === 0) return;
  try {
    chrome.scripting.insertCSS({
      target: { tabId },
      files
    }, () => {
      void chrome.runtime.lastError;
    });
  } catch (_) {}
}

function injectDhsContentScriptsForTab(tab) {
  const tabId = Number(tab && tab.id) || 0;
  const tabAddress = String(tab && (tab.url || tab.pendingUrl) || '');
  if (!tabId || !tabAddress) return false;

  if (dhsTabMatchesAny(tabAddress, DHS_NAVER_MATCHES)) {
    insertDhsCssFiles(tabId, DHS_NAVER_CSS_FILES);
    executeDhsContentFiles(tabId, DHS_NAVER_MAIN_WORLD_FILES, 'MAIN');
    executeDhsIsolatedContentFiles(tabId, DHS_NAVER_ISOLATED_WORLD_FILES);
    return true;
  }

  if (dhsTabMatchesAny(tabAddress, DHS_PROVIDER_MATCHES)) {
    executeDhsContentFiles(tabId, DHS_PROVIDER_MAIN_WORLD_FILES, 'MAIN');
    executeDhsIsolatedContentFiles(tabId, DHS_PROVIDER_ISOLATED_WORLD_FILES);
    return true;
  }

  return false;
}

function injectDhsContentScriptsForExistingTabs() {
  if (!chrome.tabs || typeof chrome.tabs.query !== 'function') return;
  try {
    chrome.tabs.query({ url: DHS_NAVER_MATCHES.concat(DHS_PROVIDER_MATCHES) }, (tabs) => {
      void chrome.runtime.lastError;
      for (const tab of Array.isArray(tabs) ? tabs : []) injectDhsContentScriptsForTab(tab);
    });
  } catch (_) {}
}

function clearStaleDynamicContentScripts() {
  if (!chrome.scripting || typeof chrome.scripting.unregisterContentScripts !== 'function') return;
  const unregister = (scriptIds) => {
    if (!Array.isArray(scriptIds) || scriptIds.length === 0) {
      registerCurrentContentScripts();
      return;
    }
    try {
      chrome.scripting.unregisterContentScripts({ ids: scriptIds }, () => {
        void chrome.runtime.lastError;
        registerCurrentContentScripts();
      });
    } catch (_) {
      registerCurrentContentScripts();
    }
  };

  if (typeof chrome.scripting.getRegisteredContentScripts === 'function') {
    try {
      chrome.scripting.getRegisteredContentScripts((scripts) => {
        if (chrome.runtime.lastError) return;
        const scriptIds = (Array.isArray(scripts) ? scripts : [])
          .map((script) => script && script.id)
          .filter(Boolean);
        unregister(scriptIds);
      });
      return;
    } catch (_) {}
  }

  try {
    chrome.scripting.unregisterContentScripts({}, () => {
      void chrome.runtime.lastError;
      registerCurrentContentScripts();
    });
  } catch (_) {
    registerCurrentContentScripts();
  }
}

clearStaleDynamicContentScripts();
injectDhsContentScriptsForExistingTabs();

if (chrome.runtime && chrome.runtime.onInstalled && typeof chrome.runtime.onInstalled.addListener === 'function') {
  chrome.runtime.onInstalled.addListener(() => {
    clearStaleDynamicContentScripts();
    injectDhsContentScriptsForExistingTabs();
  });
}

if (chrome.runtime && chrome.runtime.onStartup && typeof chrome.runtime.onStartup.addListener === 'function') {
  chrome.runtime.onStartup.addListener(() => {
    clearStaleDynamicContentScripts();
    injectDhsContentScriptsForExistingTabs();
  });
}

if (chrome.tabs && chrome.tabs.onUpdated && typeof chrome.tabs.onUpdated.addListener === 'function') {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!changeInfo || (changeInfo.status !== 'complete' && !changeInfo.url)) return;
    injectDhsContentScriptsForTab(Object.assign({}, tab || {}, { id: tabId }));
  });
}

if (chrome.tabs && chrome.tabs.onActivated && typeof chrome.tabs.onActivated.addListener === 'function') {
  chrome.tabs.onActivated.addListener((activeInfo) => {
    const tabId = Number(activeInfo && activeInfo.tabId) || 0;
    if (!tabId || !chrome.tabs || typeof chrome.tabs.get !== 'function') return;
    try {
      chrome.tabs.get(tabId, (tab) => {
        void chrome.runtime.lastError;
        injectDhsContentScriptsForTab(tab);
      });
    } catch (_) {}
  });
}

function coordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100000 ? number : null;
}

function boundedDelay(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 10000 ? Math.floor(number) : 0;
}

function detachDebugger(target, callback) {
  const done = typeof callback === 'function' ? callback : () => {};
  try {
    chrome.debugger.detach(target, () => {
      void chrome.runtime.lastError;
      done();
    });
  } catch (_) {
    done();
  }
}

function focusTabAfterDelay(tabId, delayMs) {
  if (!tabId || !delayMs || !chrome.tabs || typeof chrome.tabs.update !== 'function') return;
  setTimeout(() => {
    try {
      chrome.tabs.update(tabId, { active: true }, () => {});
    } catch (_) {}
  }, delayMs);
}

function rememberProviderOpener(tabId) {
  pendingProviderOpenerTabId = Number(tabId) || 0;
  if (pendingProviderOpenerClearTimer) clearTimeout(pendingProviderOpenerClearTimer);
  pendingProviderOpenerClearTimer = setTimeout(() => {
    pendingProviderOpenerTabId = 0;
    pendingProviderOpenerClearTimer = 0;
  }, PROVIDER_REQUEST_TTL_MS);
}

function forgetProviderOpener() {
  pendingProviderOpenerTabId = 0;
  if (pendingProviderOpenerClearTimer) clearTimeout(pendingProviderOpenerClearTimer);
  pendingProviderOpenerClearTimer = 0;
}

function providerUrlMatchesKnownFamily(value) {
  const text = String(value || '');
  if (text === 'about:blank') return true;
  let parsed;
  try {
    parsed = new URL(text);
  } catch (_) {
    return false;
  }
  return directProviderFamilies().some((item) => (
    Array.isArray(item.domains) &&
    item.domains.some((domain) => hostnameMatchesDomain(parsed.hostname, domain))
  ));
}

function providerTabMatchesCurrentRequest(tab, openerId) {
  const tabId = Number(tab && tab.id) || 0;
  const openerTabId = Number(tab && tab.openerTabId) || 0;
  const matchesOpener = openerTabId === openerId;
  if (!tabId || tabId === openerId || !matchesOpener) return false;
  return providerUrlMatchesKnownFamily(tab.url) || providerUrlMatchesKnownFamily(tab.pendingUrl);
}

function closeProviderTabId(tabId) {
  const id = Number(tabId) || 0;
  if (!id || !chrome.tabs || typeof chrome.tabs.remove !== 'function') return false;
  if (providerTabCloseTimers.has(id)) {
    clearTimeout(providerTabCloseTimers.get(id));
    providerTabCloseTimers.delete(id);
  }
  try {
    chrome.tabs.remove(id, () => {
      void chrome.runtime.lastError;
    });
    return true;
  } catch (_) {
    return false;
  }
}

function closeProviderTabsForOpener(openerTabId) {
  const openerId = Number(openerTabId) || 0;
  if (!openerId || !chrome.tabs || typeof chrome.tabs.remove !== 'function') {
    providerRequestTabIds.clear();
    return false;
  }
  let closeScheduled = false;
  for (const tabId of Array.from(providerRequestTabIds)) {
    closeScheduled = closeProviderTabId(tabId) || closeScheduled;
  }
  providerRequestTabIds.clear();
  if (typeof chrome.tabs.query === 'function') {
    try {
      chrome.tabs.query({}, (tabs) => {
        if (chrome.runtime.lastError) return;
        for (const tab of Array.isArray(tabs) ? tabs : []) {
          if (providerTabMatchesCurrentRequest(tab, openerId)) closeProviderTabId(tab.id);
        }
      });
      closeScheduled = true;
    } catch (_) {}
  }
  return closeScheduled;
}

function scheduleProviderTabIdClose(tabId, fast) {
  if (!PROVIDER_TAB_AUTO_CLOSE_ENABLED) return false;
  if (!chrome.tabs || typeof chrome.tabs.remove !== 'function') return false;
  if (providerTabCloseTimers.has(tabId) && !fast) return true;
  if (providerTabCloseTimers.has(tabId)) {
    clearTimeout(providerTabCloseTimers.get(tabId));
    providerTabCloseTimers.delete(tabId);
  }
  providerRequestTabIds.add(tabId);
  const delayMs = fast ? PROVIDER_TAB_CLOSE_AFTER_CANDIDATE_MS : PROVIDER_TAB_CLOSE_DELAY_MS;
  const timer = setTimeout(() => {
    providerTabCloseTimers.delete(tabId);
    providerRequestTabIds.delete(tabId);
    closeProviderTabId(tabId);
  }, delayMs);
  providerTabCloseTimers.set(tabId, timer);
  return true;
}

function scheduleProviderTabClose(sender, fast) {
  const tab = sender && sender.tab;
  const tabId = Number(tab && tab.id) || 0;
  const openerTabId = Number(tab && tab.openerTabId) || 0;
  if (!tabId || !pendingProviderOpenerTabId) return false;
  if (tabId === pendingProviderOpenerTabId || openerTabId !== pendingProviderOpenerTabId) return false;
  return scheduleProviderTabIdClose(tabId, fast);
}

function providerCaptureSenderTrusted(sender) {
  const tab = sender && sender.tab;
  const tabId = Number(tab && tab.id) || 0;
  const openerTabId = Number(tab && tab.openerTabId) || 0;
  return Boolean(tabId && pendingProviderOpenerTabId && tabId !== pendingProviderOpenerTabId && openerTabId === pendingProviderOpenerTabId);
}

function dispatchMouseSequence(target, x, y, returnFocusDelayMs, sendResponse) {
  chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x,
    y,
    button: 'none'
  }, () => {
    const moveError = chrome.runtime.lastError;
    if (moveError) {
      detachDebugger(target, () => sendResponse({ ok: false, reason: 'debugger-move-failed' }));
      return;
    }

    chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      clickCount: 1
    }, () => {
      const pressError = chrome.runtime.lastError;
      if (pressError) {
        detachDebugger(target, () => sendResponse({ ok: false, reason: 'debugger-press-failed' }));
        return;
      }

      chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x,
        y,
        button: 'left',
        clickCount: 1
      }, () => {
        const releaseFailed = Boolean(chrome.runtime.lastError);
        detachDebugger(target, () => {
          if (releaseFailed) {
            sendResponse({ ok: false, reason: 'debugger-release-failed' });
            return;
          }
          focusTabAfterDelay(target.tabId, returnFocusDelayMs);
          sendResponse({ ok: true });
        });
      });
    });
  });
}

function openProviderBackgroundTab(data, sender, sendResponse) {
  const openerTabId = Number(sender && sender.tab && sender.tab.id) || 0;
  const articleMarker = String(data && data.articleMarker || '');
  const providerFamily = String(data && data.providerFamily || '');
  const providerLookupRefInput = String(data && data.providerLookupRef || '');
  const providerLookupRef = sanitizeProviderLookupRef(providerLookupRefInput, providerFamily);
  if (!openerTabId) {
    sendResponse({ ok: false, reason: 'missing-opener-tab', providerFamily });
    return false;
  }
  if (!providerFamilyKnown(providerFamily)) {
    sendResponse({ ok: false, reason: 'provider-not-wired', providerFamily });
    return false;
  }
  if (!providerLookupRef) {
    sendResponse({ ok: false, reason: 'invalid-provider-ref', providerFamily });
    return false;
  }
  if (!chrome.tabs || typeof chrome.tabs.create !== 'function') {
    sendResponse({ ok: false, reason: 'tabs-create-unavailable', providerFamily });
    return false;
  }
  const requestEpoch = providerRequestEpoch;
  rememberProviderOpener(openerTabId);
  try {
    chrome.tabs.create({
      url: providerLookupRef,
      active: false,
      openerTabId
    }, (tab) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, reason: 'background-tab-create-failed', providerFamily });
        return;
      }
      const tabId = Number(tab && tab.id) || 0;
      if (!tabId) {
        sendResponse({ ok: false, reason: 'background-tab-missing-id', providerFamily });
        return;
      }
      if (requestEpoch !== providerRequestEpoch) {
        closeProviderTabId(tabId);
        sendResponse({ ok: false, reason: 'provider-request-cleared', providerFamily });
        return;
      }
      providerRequestTabIds.add(tabId);
      scheduleProviderTabIdClose(tabId, false);
      sendResponse({
        ok: true,
        status: 'background-tab-opened',
        providerFamily,
        providerEvidenceSummary: providerStore.summary(articleMarker)
      });
    });
    return true;
  } catch (_) {
    sendResponse({ ok: false, reason: 'background-tab-error', providerFamily });
    return false;
  }
}

function dispatchProviderClick(data, sender, sendResponse) {
  const tabId = sender && sender.tab && sender.tab.id;
  const x = coordinate(data && data.x);
  const y = coordinate(data && data.y);
  const returnFocusDelayMs = boundedDelay(data && data.returnFocusDelayMs);
  if (!tabId || x === null || y === null) {
    sendResponse({ ok: false, reason: 'invalid-click-target' });
    return false;
  }
  if (!chrome.debugger || typeof chrome.debugger.attach !== 'function') {
    sendResponse({ ok: false, reason: 'missing-debugger-api' });
    return false;
  }

  const target = { tabId };
  chrome.debugger.attach(target, DEBUGGER_PROTOCOL_VERSION, () => {
    const attachError = chrome.runtime.lastError;
    if (attachError) {
      sendResponse({ ok: false, reason: 'debugger-attach-failed' });
      return;
    }
    dispatchMouseSequence(target, x, y, returnFocusDelayMs, sendResponse);
  });
  return true;
}

function validListingKey(value) {
  const key = String(value || '').replace(/[^0-9]/g, '');
  return /^\d{5,15}$/.test(key) ? key : '';
}

function validProviderLookupSequence(value) {
  const key = String(value || '').replace(/[^0-9]/g, '');
  return /^\d{1,20}$/.test(key) ? key : '';
}

function validArticleMarker(value) {
  const marker = String(value || '');
  return /^article:[a-f0-9]{8,12}$/.test(marker) ? marker : '';
}

function hashMarker(value) {
  const input = String(value || '');
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `article:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function directProviderFamilies() {
  const inventory = globalThis.DHS_CP_INVENTORY;
  const rows = inventory && Array.isArray(inventory.DOMAIN_PROVIDER_CANDIDATES)
    ? inventory.DOMAIN_PROVIDER_CANDIDATES
    : [];
  return rows;
}

function providerFamilyKnown(providerFamily) {
  const family = String(providerFamily || '');
  return Boolean(family && directProviderFamilies().some((item) => item.family === family));
}

function hostnameMatchesDomain(hostname, domain) {
  const host = String(hostname || '').toLowerCase();
  const expected = String(domain || '').toLowerCase();
  return Boolean(host && expected && (host === expected || host.endsWith(`.${expected}`)));
}

function sanitizeProviderLookupRef(value, providerFamily) {
  let parsed;
  try {
    parsed = new URL(String(value || ''));
  } catch (_) {
    return '';
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return '';
  if (parsed.username || parsed.password) return '';
  const family = String(providerFamily || '');
  const provider = directProviderFamilies().find((item) => (
    item.family === family &&
    Array.isArray(item.domains) &&
    item.domains.some((domain) => hostnameMatchesDomain(parsed.hostname, domain))
  ));
  const href = parsed.href;
  return provider && href.length <= 2048 ? href : '';
}

function providerDirectLookupRejectReason(articleMarker, providerFamily, listingKey, providerLookupSequence, providerLookupRef, providerLookupArticleMarker, providerLookupGroupProof) {
  if (!/^article:[a-f0-9]{8,12}$/.test(String(articleMarker || ''))) return 'missing-marker';
  if (!providerFamilyKnown(providerFamily)) return 'provider-not-wired';
  if (String(providerLookupRef || '')) {
    if (!sanitizeProviderLookupRef(providerLookupRef, providerFamily)) return 'invalid-provider-ref';
    if (providerLookupGroupProof && !providerLookupArticleMarker) return 'missing-provider-proof';
    if (providerLookupArticleMarker && providerLookupArticleMarker !== articleMarker && !providerLookupGroupProof) return 'provider-marker-mismatch';
    return '';
  }
  if (String(providerFamily || '') !== 'mk') return 'missing-key';
  if (!listingKey && !providerLookupSequence) return 'missing-key';
  if (providerLookupGroupProof && !providerLookupArticleMarker) return 'missing-provider-proof';
  if (providerLookupArticleMarker && providerLookupArticleMarker !== articleMarker && !providerLookupGroupProof) return 'provider-marker-mismatch';
  if (listingKey && !providerLookupArticleMarker && hashMarker(listingKey) !== articleMarker && !providerLookupGroupProof) return 'marker-mismatch';
  if (providerLookupSequence && !providerLookupArticleMarker) return 'missing-provider-marker';
  return '';
}

function listingContextFromDirectLookup(data) {
  return {
    detailDongToken: data && data.detailDongToken,
    detailTypeToken: data && data.detailTypeToken,
    detailTypeAliases: Array.isArray(data && data.detailTypeAliases) ? data.detailTypeAliases.slice(0, 6) : [],
    detailDirectionToken: data && data.detailDirectionToken,
    lineCandidateDisplays: Array.isArray(data && data.lineCandidateDisplays) ? data.lineCandidateDisplays.slice(0, 80) : [],
    detailFloorKind: data && data.detailFloorKind,
    detailFloorBand: data && data.detailFloorBand,
    detailFloorValue: data && data.detailFloorValue,
    detailTotalFloor: data && data.detailTotalFloor
  };
}

function sanitizeDiagnosticFieldNames(items) {
  const seen = new Set();
  const names = [];
  for (const item of Array.isArray(items) ? items : []) {
    const name = String(item || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 40);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length >= 8) break;
  }
  return names;
}

function providerLookupResponseFromCandidate(providerFamily, candidate, fallbackStatus, diagnostic, requestKey, articleMarker) {
  const safeCandidate = globalThis.DHS_PROVIDER_CANDIDATE.sanitizeProviderCandidate(candidate);
  const stored = (safeCandidate.present || safeCandidate.floorHintPresent) ? providerStore.storeCandidate(safeCandidate, requestKey) : false;
  const status = stored ? 'candidate-stored' : fallbackStatus;
  const sourceField = safeCandidate.sourceField || safeCandidate.floorHintSourceField || '';
  return {
    ok: stored,
    status,
    directLookupStatus: status,
    directLookupStep: diagnostic && diagnostic.step ? diagnostic.step : '',
    providerFamily,
    bodyShape: diagnostic && diagnostic.bodyShape ? diagnostic.bodyShape : '',
    address2Seen: ['address2', 'addr2', 'addr3', 'address3', 'detailAddress', 'dongHo', 'hoNo', 'hoName', 'unitNo', 'roomNo', 'houseNo', 'hoNm', 'kiso_address2', 'ho', 'address_ho'].includes(String(sourceField || '')),
    sequenceSeen: false,
    redirectStatus: Number(diagnostic && diagnostic.redirectStatus || 0),
    popupStatus: 0,
    structuredFieldSeen: Boolean(sourceField),
    structuredFieldName: String(sourceField || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 40),
    structuredFieldNames: sanitizeDiagnosticFieldNames(diagnostic && diagnostic.structuredFieldNames || [sourceField]),
    structuredFloorFieldSeen: Boolean(diagnostic && diagnostic.structuredFloorFieldSeen),
    structuredFloorFieldNames: sanitizeDiagnosticFieldNames(diagnostic && diagnostic.structuredFloorFieldNames),
    structuredFloorTotalFieldSeen: Boolean(diagnostic && diagnostic.structuredFloorTotalFieldSeen),
    structuredValueStatus: safeCandidate.present ? 'usable-candidate' : (safeCandidate.floorHintPresent ? 'usable-floor-hint' : 'none'),
    visibleFragmentSeen: false,
    visibleFragmentStatus: '',
    visibleFallbackOnly: false,
    brokerOfficeBlockSeen: false,
    candidatePresent: Boolean(safeCandidate.present),
    floorHintPresent: Boolean(safeCandidate.floorHintPresent),
    rejectReason: stored ? '' : status,
    providerEvidenceSummary: providerStore.summary(articleMarker)
  };
}

function fetchWithTimeout(url, options, timeoutMs) {
  const requestedTimeoutMs = Number(timeoutMs || 0);
  const effectiveTimeoutMs = Number.isFinite(requestedTimeoutMs) && requestedTimeoutMs > 0
    ? Math.min(PROVIDER_DIRECT_LOOKUP_TIMEOUT_MS, Math.max(1, Math.floor(requestedTimeoutMs)))
    : PROVIDER_DIRECT_LOOKUP_TIMEOUT_MS;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), effectiveTimeoutMs) : 0;
  const fetchOptions = Object.assign({}, options || {});
  if (controller) fetchOptions.signal = controller.signal;
  return fetch(url, fetchOptions).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function sanitizeProviderDirectLookupBudget(value) {
  const budgetMs = Number(value || 0);
  if (!Number.isFinite(budgetMs) || budgetMs < 1000) return 0;
  return Math.min(PROVIDER_DIRECT_LOOKUP_TIMEOUT_MS, Math.floor(budgetMs));
}

async function fetchProviderLookupResponse(url, options, timeoutMs) {
  const requestedTimeoutMs = Number(timeoutMs || 0);
  const effectiveTimeoutMs = Number.isFinite(requestedTimeoutMs) && requestedTimeoutMs > 0
    ? Math.min(PROVIDER_DIRECT_LOOKUP_TIMEOUT_MS, Math.max(1, Math.floor(requestedTimeoutMs)))
    : PROVIDER_DIRECT_LOOKUP_TIMEOUT_MS;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const fetchOptions = Object.assign({}, options || {});
  if (controller) fetchOptions.signal = controller.signal;
  const timer = controller ? setTimeout(() => controller.abort(), effectiveTimeoutMs) : 0;
  try {
    const response = await fetch(url, fetchOptions);
    const bodyText = await response.text();
    return {
      ok: Boolean(response.ok),
      status: Number(response.status || 0),
      url: String(response.url || ''),
      headers: response.headers,
      redirected: Boolean(response.redirected),
      type: String(response.type || ''),
      text: async () => bodyText
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function providerDirectLookupFetch(data) {
  const budgetMs = sanitizeProviderDirectLookupBudget(data && data.lookupBudgetMs);
  if (!budgetMs) {
    return (url, options) => fetchProviderLookupResponse(
      url,
      options,
      PROVIDER_DIRECT_LOOKUP_TIMEOUT_MS
    );
  }
  const deadline = Date.now() + budgetMs;
  return (url, options) => {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) return Promise.reject(new Error('provider-lookup-budget-expired'));
    return fetchProviderLookupResponse(url, options, remainingMs);
  };
}

function safeNaverArticleNumber(value) {
  const text = String(value || '').replace(/[^0-9]/g, '');
  return /^\d{5,24}$/.test(text) ? text : '';
}

function safeFinMarker(value) {
  const marker = String(value || '');
  return /^article:[a-f0-9]{8,12}$/.test(marker) ? marker : '';
}

function safeFinText(value, pattern, limit) {
  const text = String(value || '');
  return pattern.test(text) ? text.slice(0, limit) : '';
}

function safeFinStatus(value) {
  const status = Number(value || 0);
  return status >= 100 && status <= 599 ? status : 0;
}

function sanitizeFinLineMapRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const input = row && typeof row === 'object' ? row : {};
    const output = {
      dongToken: safeFinText(input.dongToken, /^[0-9]{1,4}\uB3D9$/, 12),
      typeToken: safeFinText(input.typeToken, /^[0-9A-Za-z]{1,24}$/, 24),
      lineToken: safeFinText(input.lineToken, /^[0-9A-Za-z-]{0,24}$/, 24),
      floorValue: Math.min(99, Math.max(0, Number(input.floorValue || 0) || 0)),
      minFloor: Math.min(99, Math.max(0, Number(input.minFloor || 0) || 0)),
      maxFloor: Math.min(99, Math.max(0, Number(input.maxFloor || 0) || 0)),
      numberingScheme: safeFinText(input.numberingScheme, /^[A-Za-z0-9_-]{0,32}$/, 32),
      source: safeFinText(input.source, /^[A-Za-z0-9_.:-]{0,40}$/, 40),
      directHoToken: safeFinText(input.directHoToken, /^[0-9]{1,4}\uD638$/, 12),
      directionToken: safeFinText(input.directionToken, /^[\uAC00-\uD7AF]{0,8}$/, 8),
      sourceField: safeFinText(input.sourceField, /^[A-Za-z0-9_.:-]{0,40}$/, 40),
      pyeongNo: safeFinText(input.pyeongNo, /^[A-Za-z0-9_-]{0,32}$/, 32),
      exclusiveSpace: Number(input.exclusiveSpace || 0) > 0 ? Number(input.exclusiveSpace || 0) : 0,
      totalArea: Number(input.totalArea || 0) > 0 ? Number(input.totalArea || 0) : 0,
      landPriceAnomaly: Boolean(input.landPriceAnomaly)
    };
    return output.dongToken || output.typeToken || output.lineToken || output.directHoToken ? output : null;
  }).filter(Boolean).slice(0, 300);
}

function sanitizeFinArticleDetailContext(context) {
  const input = context && typeof context === 'object' ? context : {};
  const output = {};
  const exclusiveSpace = Number(input.detailExclusiveSpace || input.exclusiveSpace || 0) || 0;
  const pyeongNo = safeFinText(input.detailPyeongNo || input.pyeongNo, /^[A-Za-z0-9_-]{1,32}$/, 32);
  const floorValue = Number(input.detailFloorValue || input.floorValue || 0) || 0;
  const totalFloor = Number(input.detailTotalFloor || input.totalFloor || 0) || 0;
  const displayDongToken = safeFinText(input.detailDisplayDongToken || input.displayDongToken, /^[0-9]{1,4}\uB3D9$/, 12);
  if (exclusiveSpace > 0 && exclusiveSpace < 400) output.detailExclusiveSpace = exclusiveSpace;
  if (pyeongNo) output.detailPyeongNo = pyeongNo;
  if (Number.isInteger(floorValue) && floorValue > 0 && floorValue < 100) output.detailFloorValue = floorValue;
  if (Number.isInteger(totalFloor) && totalFloor > 0 && totalFloor < 200) output.detailTotalFloor = totalFloor;
  if (displayDongToken) output.detailDisplayDongToken = displayDongToken;
  return Object.keys(output).length ? output : null;
}

function sanitizeFinBuildingUnitsExact(input) {
  const result = input && typeof input === 'object' ? input : {};
  const display = String(result.displayCandidate || '').replace(/[^\uAC00-\uD7AF0-9 ]/g, '').slice(0, 32);
  return {
    present: Boolean(result.present && display && result.source === 'building-units-article-linked'),
    displayCandidate: display,
    source: result.source === 'building-units-article-linked' ? result.source : '',
    certainty: safeFinText(result.certainty, /^[A-Za-z0-9_-]{0,40}$/, 40),
    reason: safeFinText(result.reason, /^[A-Za-z0-9_-]{0,80}$/, 80),
    rowCount: Math.min(999, Number(result.rowCount || 0) || 0),
    articleLinkedCount: Math.min(999, Number(result.articleLinkedCount || 0) || 0),
    candidateCount: Math.min(999, Number(result.candidateCount || 0) || 0),
    floorValue: Math.min(99, Number(result.floorValue || 0) || 0),
    typeToken: safeFinText(result.typeToken, /^[0-9A-Za-z]{0,16}$/, 16)
  };
}

function sanitizeFinLookupResponse(input) {
  const data = input && typeof input === 'object' ? input : {};
  const lineMapRows = sanitizeFinLineMapRows(data.lineMapRows);
  const exact = sanitizeFinBuildingUnitsExact(data.buildingUnitsExact);
  const articleDetailContext = sanitizeFinArticleDetailContext(data.articleDetailContext);
  const endpointStatusByName = {};
  const endpointReasonByName = {};
  for (const [key, value] of Object.entries(data.endpointStatusByName || {})) {
    const name = safeFinText(key, /^[A-Za-z0-9_-]{1,24}$/, 24);
    if (name) endpointStatusByName[name] = safeFinStatus(value);
  }
  for (const [key, value] of Object.entries(data.endpointReasonByName || {})) {
    const name = safeFinText(key, /^[A-Za-z0-9_-]{1,24}$/, 24);
    const reason = safeFinText(value, /^[A-Za-z0-9_-]{1,80}$/, 80);
    if (name && reason) endpointReasonByName[name] = reason;
  }
  return {
    ok: Boolean(lineMapRows.length || exact.present || articleDetailContext),
    status: safeFinText(data.status, /^[A-Za-z0-9_-]{0,40}$/, 40) || 'no-candidate',
    reason: safeFinText(data.reason, /^[A-Za-z0-9_-]{0,80}$/, 80) || 'no-candidate',
    httpStatus: safeFinStatus(data.httpStatus),
    endpointStatusByName,
    endpointReasonByName,
    lineMapRowCount: lineMapRows.length,
    lineMapRows,
    lineMapShape: data.lineMapShape || null,
    buildingUnitsExact: exact,
    articleDetailContext
  };
}

function runNaverFinFrontApiLookup(data, sendResponse) {
  const naverArticleNumber = safeNaverArticleNumber(data && data.naverArticleNumber);
  const articleMarker = safeFinMarker(data && data.articleMarker);
  const context = {
    articleMarker,
    dongToken: data && data.detailDongToken,
    typeToken: data && data.detailTypeToken,
    floorValue: Number(data && data.detailFloorValue || 0) || 0,
    floorBand: data && data.detailFloorBand,
    totalFloor: Number(data && data.detailTotalFloor || 0) || 0,
    exclusiveSpace: Number(data && data.detailExclusiveSpace || 0) || 0,
    pyeongNo: data && data.detailPyeongNo,
    detailDongToken: data && data.detailDongToken,
    detailTypeToken: data && data.detailTypeToken,
    detailFloorValue: Number(data && data.detailFloorValue || 0) || 0,
    detailFloorBand: data && data.detailFloorBand,
    detailTotalFloor: Number(data && data.detailTotalFloor || 0) || 0,
    detailExclusiveSpace: Number(data && data.detailExclusiveSpace || 0) || 0,
    detailPyeongNo: data && data.detailPyeongNo
  };

  function normalizeArea(value) {
    const number = Number(String(value || '').replace(/,/g, '').match(/\d{1,3}(?:\.\d{1,4})?/)?.[0] || 0);
    return Number.isFinite(number) && number > 0 && number < 400 ? number : 0;
  }

  function firstPrimitive(object, fields) {
    const input = object && typeof object === 'object' ? object : {};
    for (const field of fields) {
      const value = input[field];
      if (typeof value === 'string' || typeof value === 'number') {
        const text = String(value).trim();
        if (text) return text;
      }
    }
    return '';
  }

  function collectFinArticleDetailContext(body) {
    const found = {};
    const visit = (value, depth) => {
      if (!value || depth > 8) return;
      if (Array.isArray(value)) {
        for (const item of value.slice(0, 160)) visit(item, depth + 1);
        return;
      }
      if (typeof value !== 'object') return;
      const pyeongNo = safeFinText(firstPrimitive(value, ['pyeongNo', 'ptpNo', 'pyeongTypeNo', 'pyeongTypeNumber']), /^[A-Za-z0-9_-]{1,32}$/, 32);
      const exclusiveSpace = normalizeArea(firstPrimitive(value, ['exclusiveSpace', 'exclusiveArea', 'exclusiveSpc', 'excluseSpc', 'realArea', 'spc2', 'area2', 'privateArea', 'useArea']));
      const floorValue = Number(firstPrimitive(value, ['targetFloor', 'correspondingFloorCount', 'correspondingFloor', 'articleFloor', 'article_floor', 'atclFlr']));
      const totalFloor = Number(firstPrimitive(value, ['totalFloor', 'highestFloor', 'floorCount']));
      const displayDongToken = safeFinText(firstPrimitive(value, ['dongName', 'buildingName', 'displayDong']), /^[0-9]{1,4}\uB3D9$/, 12);
      if (!found.detailPyeongNo && pyeongNo) found.detailPyeongNo = pyeongNo;
      if (!found.detailExclusiveSpace && exclusiveSpace) found.detailExclusiveSpace = exclusiveSpace;
      if (!found.detailFloorValue && Number.isInteger(floorValue) && floorValue > 0 && floorValue < 100) found.detailFloorValue = floorValue;
      if (!found.detailTotalFloor && Number.isInteger(totalFloor) && totalFloor > 0 && totalFloor < 200) found.detailTotalFloor = totalFloor;
      if (!found.detailDisplayDongToken && displayDongToken) found.detailDisplayDongToken = displayDongToken;
      for (const child of Object.values(value).slice(0, 120)) visit(child, depth + 1);
    };
    visit(body, 0);
    return sanitizeFinArticleDetailContext(found);
  }

  function collectFinRouteCode(body, field, fallback) {
    let found = '';
    const visit = (value, depth) => {
      if (found || !value || depth > 8) return;
      if (Array.isArray(value)) {
        for (const item of value.slice(0, 120)) visit(item, depth + 1);
        return;
      }
      if (typeof value !== 'object') return;
      const direct = firstPrimitive(value, [field]);
      if (/^[A-Z][0-9]{1,3}$/.test(direct)) {
        found = direct;
        return;
      }
      for (const child of Object.values(value).slice(0, 120)) visit(child, depth + 1);
    };
    visit(body, 0);
    return found || fallback;
  }

  async function fetchFinEndpoint(name, path, params) {
    const query = new URLSearchParams(Object.assign({ articleNumber: naverArticleNumber }, params || {}));
    const endpoint = `${FIN_FRONT_API_BASE}${path}?${query.toString()}`;
    const response = await fetchWithTimeout(endpoint, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      referrer: `https://fin.land.naver.com/articles/${naverArticleNumber}`,
      headers: {
        Accept: 'application/json, text/plain, */*',
        Referer: `https://fin.land.naver.com/articles/${naverArticleNumber}`,
        Origin: 'https://fin.land.naver.com'
      }
    });
    const status = safeFinStatus(response && response.status);
    if (!response || !response.ok) return { name, status, ok: false, reason: status ? `http-${status}` : 'http-error', body: null };
    const contentType = String(response.headers && response.headers.get ? response.headers.get('content-type') : '');
    if (contentType && !/json/i.test(contentType)) return { name, status, ok: false, reason: 'non-json', body: null };
    const body = await response.json();
    return { name, status, ok: true, reason: 'fetched', body };
  }

  function waitForFinTabReady(tabId) {
    return new Promise((resolve) => {
      let done = false;
      let timer = 0;
      const finish = () => {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        try {
          if (chrome.tabs && chrome.tabs.onUpdated && typeof chrome.tabs.onUpdated.removeListener === 'function') {
            chrome.tabs.onUpdated.removeListener(listener);
          }
        } catch (_) {}
        resolve();
      };
      const listener = (updatedTabId, changeInfo) => {
        if (Number(updatedTabId) === Number(tabId) && changeInfo && changeInfo.status === 'complete') finish();
      };
      timer = setTimeout(finish, 2800);
      try {
        if (chrome.tabs && chrome.tabs.onUpdated && typeof chrome.tabs.onUpdated.addListener === 'function') {
          chrome.tabs.onUpdated.addListener(listener);
        }
      } catch (_) {
        finish();
      }
    });
  }

  function createFinLookupTab() {
    return new Promise((resolve) => {
      try {
        chrome.tabs.create({
          url: `https://fin.land.naver.com/articles/${naverArticleNumber}`,
          active: false
        }, (tab) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(tab || null);
        });
      } catch (_) {
        resolve(null);
      }
    });
  }

  async function fetchFinEndpointViaTab() {
    if (
      !chrome.tabs ||
      typeof chrome.tabs.create !== 'function' ||
      typeof chrome.tabs.remove !== 'function' ||
      !chrome.scripting ||
      typeof chrome.scripting.executeScript !== 'function'
    ) {
      return [{ name: 'tab', status: 0, ok: false, reason: 'tab-unavailable', body: null }];
    }

    let tabId = 0;
    try {
      const tab = await createFinLookupTab();
      tabId = Number(tab && tab.id) || 0;
      if (!tabId) return [{ name: 'tab', status: 0, ok: false, reason: 'tab-create-failed', body: null }];
      await waitForFinTabReady(tabId);
      return await new Promise((resolve) => {
        try {
          chrome.scripting.executeScript({
            target: { tabId },
            func: async (inputNumber) => {
              const safeNumber = String(inputNumber || '').replace(/[^0-9]/g, '');
              const output = [];
              let realEstateType = 'A01';
              let tradeType = 'A1';

              const primitive = (object, fields) => {
                const input = object && typeof object === 'object' ? object : {};
                for (const field of fields) {
                  const value = input[field];
                  if (typeof value === 'string' || typeof value === 'number') {
                    const text = String(value).trim();
                    if (text) return text;
                  }
                }
                return '';
              };

              const routeCode = (body, field, fallback) => {
                let found = '';
                const visit = (value, depth) => {
                  if (found || !value || depth > 8) return;
                  if (Array.isArray(value)) {
                    for (const item of value.slice(0, 120)) visit(item, depth + 1);
                    return;
                  }
                  if (typeof value !== 'object') return;
                  const direct = primitive(value, [field]);
                  if (/^[A-Z][0-9]{1,3}$/.test(direct)) {
                    found = direct;
                    return;
                  }
                  for (const child of Object.values(value).slice(0, 120)) visit(child, depth + 1);
                };
                visit(body, 0);
                return found || fallback;
              };

              const callEndpoint = async (name, path, params) => {
                try {
                  const query = new URLSearchParams(Object.assign({ articleNumber: safeNumber }, params || {}));
                  const response = await fetch(`/front-api/v1${path}?${query.toString()}`, {
                    method: 'GET',
                    credentials: 'include',
                    cache: 'no-store',
                    headers: {
                      Accept: 'application/json, text/plain, */*'
                    }
                  });
                  const status = Number(response && response.status || 0) || 0;
                  if (!response || !response.ok) return { name, status, ok: false, reason: status ? `http-${status}` : 'http-error', body: null };
                  const contentType = String(response.headers && response.headers.get ? response.headers.get('content-type') : '');
                  if (contentType && !/json/i.test(contentType)) return { name, status, ok: false, reason: 'non-json', body: null };
                  const body = await response.json();
                  return { name, status, ok: true, reason: 'tab-fetched', body };
                } catch (_) {
                  return { name, status: 0, ok: false, reason: 'tab-fetch-error', body: null };
                }
              };

              const key = await callEndpoint('tabKey', '/article/key', {});
              output.push(key);
              if (key && key.ok && key.body) {
                realEstateType = routeCode(key.body, 'realEstateType', realEstateType);
                tradeType = routeCode(key.body, 'tradeType', tradeType);
              }
              if (!output.some((item) => item && item.status === 429)) {
                output.push(await callEndpoint('tabBasicInfo', '/article/basicInfo', { realEstateType, tradeType }));
              }
              if (!output.some((item) => item && item.status === 429) && output.some((item) => item && item.ok && (item.name === 'tabKey' || item.name === 'tabBasicInfo'))) {
                output.push(await callEndpoint('tabAbuse', '/article/abuse', {}));
                output.push(await callEndpoint('tabOutLink', '/article/outLink', {}));
              }
              return output;
            },
            args: [naverArticleNumber]
          }, (frames) => {
            if (chrome.runtime.lastError) {
              resolve([{ name: 'tab', status: 0, ok: false, reason: 'script-error', body: null }]);
              return;
            }
            const result = Array.isArray(frames) && frames[0] ? frames[0].result : null;
            resolve(Array.isArray(result) ? result : [{ name: 'tab', status: 0, ok: false, reason: 'script-empty', body: null }]);
          });
        } catch (_) {
          resolve([{ name: 'tab', status: 0, ok: false, reason: 'script-error', body: null }]);
        }
      });
    } finally {
      if (tabId) {
        try {
          chrome.tabs.remove(tabId, () => {
            void chrome.runtime.lastError;
          });
        } catch (_) {}
      }
    }
  }

  if (!naverArticleNumber || !articleMarker) {
    sendResponse(sanitizeFinLookupResponse({
      status: 'skipped',
      reason: naverArticleNumber ? 'missing-marker' : 'missing-listing-key'
    }));
    return false;
  }

  (async () => {
    const lineMapRows = [];
    let lineMapShape = null;
    let buildingUnitsExact = null;
    let articleDetailContext = null;
    let realEstateType = 'A01';
    let tradeType = 'A1';
    let keyOrBasicSucceeded = false;
    let stopped = false;
    let httpStatus = 0;
    let finalReason = 'no-candidate';
    const endpointStatusByName = {};
    const endpointReasonByName = {};

    const observe = (result) => {
      const name = safeFinText(result && result.name, /^[A-Za-z0-9_-]{1,24}$/, 24);
      const status = safeFinStatus(result && result.status);
      if (name) endpointStatusByName[name] = status;
      if (status) httpStatus = status;
      const reason = safeFinText(result && result.reason, /^[A-Za-z0-9_-]{1,80}$/, 80) || 'unknown';
      if (name) endpointReasonByName[name] = reason;
      if (status === 429) {
        stopped = true;
        finalReason = 'http-429';
      }
      if (!result || !result.ok || !result.body) return;
      keyOrBasicSucceeded = keyOrBasicSucceeded || name === 'key' || name === 'basicInfo' || name === 'tabKey' || name === 'tabBasicInfo';
      if (name === 'key' || name === 'tabKey') {
        realEstateType = collectFinRouteCode(result.body, 'realEstateType', realEstateType);
        tradeType = collectFinRouteCode(result.body, 'tradeType', tradeType);
      }
      const api = globalThis.DHS_NAVER_LINE_MAP;
      if (api && typeof api.collectNaverLineMapRows === 'function') {
        lineMapRows.push(...api.collectNaverLineMapRows(result.body, context));
      }
      if (!lineMapShape && api && typeof api.summarizeNaverLineMapShape === 'function') {
        lineMapShape = api.summarizeNaverLineMapShape(result.body);
      }
      const units = globalThis.DHS_BUILDING_UNITS_RESOLVER;
      if (!buildingUnitsExact && units && typeof units.resolveBuildingUnitsExact === 'function') {
        const exact = units.resolveBuildingUnitsExact(result.body, context);
        if (exact && (exact.present || Number(exact.rowCount || 0) > 0 || Number(exact.articleLinkedCount || 0) > 0)) {
          buildingUnitsExact = exact;
        }
      }
      const nextArticleDetailContext = collectFinArticleDetailContext(result.body);
      articleDetailContext = sanitizeFinArticleDetailContext(Object.assign({}, articleDetailContext || {}, nextArticleDetailContext || {}));
    };

    observe(await fetchFinEndpoint('key', '/article/key', {}));
    if (!stopped) observe(await fetchFinEndpoint('basicInfo', '/article/basicInfo', { realEstateType, tradeType }));
    if (!stopped && keyOrBasicSucceeded) observe(await fetchFinEndpoint('abuse', '/article/abuse', {}));
    if (!stopped && keyOrBasicSucceeded) observe(await fetchFinEndpoint('outLink', '/article/outLink', {}));

    let rows = sanitizeFinLineMapRows(lineMapRows);
    let tabFallbackAttempted = false;
    if (!stopped && rows.length === 0 && !(buildingUnitsExact && buildingUnitsExact.present) && !articleDetailContext) {
      tabFallbackAttempted = true;
      const tabResults = await fetchFinEndpointViaTab();
      for (const result of Array.isArray(tabResults) ? tabResults : []) observe(result);
      rows = sanitizeFinLineMapRows(lineMapRows);
    }

    if (rows.length > 0) finalReason = 'line-map-captured';
    else if (buildingUnitsExact && buildingUnitsExact.present) finalReason = 'building-units-captured';
    else if (articleDetailContext) finalReason = 'article-context-captured';
    else if (tabFallbackAttempted) {
      const tabReason = endpointReasonByName.tab || endpointReasonByName.tabKey || endpointReasonByName.tabBasicInfo || 'tab-no-candidate';
      finalReason = String(tabReason || '').startsWith('tab-') ? tabReason : `tab-${tabReason}`;
    }
    sendResponse(sanitizeFinLookupResponse({
      status: finalReason === 'http-429' ? 'blocked' : (rows.length || buildingUnitsExact || articleDetailContext ? 'captured' : 'no-candidate'),
      reason: finalReason,
      httpStatus,
      endpointStatusByName,
      endpointReasonByName,
      lineMapRows: rows,
      lineMapShape,
      buildingUnitsExact,
      articleDetailContext
    }));
  })().catch(() => {
    sendResponse(sanitizeFinLookupResponse({
      status: 'lookup-error',
      reason: 'lookup-error'
    }));
  });
  return true;
}

function runGenericProviderDirectLookup(providerFamily, providerLookupRef, data, sendResponse, lookupFetch) {
  const requestKey = String(data && data.requestKey || '');
  const articleMarker = String(data && data.articleMarker || '');
  lookupFetch(providerLookupRef, {
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/json,text/plain,*/*'
    }
  }).then((response) => {
    const contentLength = Number(response && response.headers && response.headers.get && response.headers.get('content-length') || 0);
    if (contentLength > PROVIDER_DIRECT_LOOKUP_MAX_BYTES) {
      sendResponse(providerLookupResponseFromCandidate(providerFamily, null, 'response-too-large', {
        step: 'provider-fetch',
        bodyShape: 'response-too-large',
        redirectStatus: Number(response && response.status || 0)
      }, requestKey, articleMarker));
      return null;
    }
    return response.text().then((text) => ({
      response,
      text: String(text || '').slice(0, PROVIDER_DIRECT_LOOKUP_MAX_BYTES)
    }));
  }).then((payload) => {
    if (!payload) return;
    const observation = globalThis.DHS_PROVIDER_CANDIDATE.buildProviderCandidateObservation({
      providerFamily,
      bodyText: payload.text,
      listingContext: listingContextFromDirectLookup(data)
    });
    const status = payload.response && payload.response.ok ? 'no-candidate' : 'http-error';
    const bodyShape = observation && (observation.present || observation.floorHintPresent)
      ? 'known-structured'
      : 'no-safe-signal';
    sendResponse(providerLookupResponseFromCandidate(providerFamily, observation, status, {
      step: 'provider-fetch',
      bodyShape,
      redirectStatus: Number(payload.response && payload.response.status || 0)
    }, requestKey, articleMarker));
  }).catch(() => {
    sendResponse({
      ok: false,
      status: 'lookup-error',
      directLookupStatus: 'lookup-error',
      directLookupStep: 'provider-fetch',
      providerFamily,
      address2Seen: false,
      candidatePresent: false,
      floorHintPresent: false,
      rejectReason: 'lookup-error',
      providerEvidenceSummary: providerStore.summary(articleMarker)
    });
  });
  return true;
}

function runProviderDirectLookup(data, sendResponse) {
  const articleMarker = String(data && data.articleMarker || '');
  const providerFamily = String(data && data.providerFamily || '');
  const listingKey = validListingKey(data && data.listingKey);
  const providerLookupSequence = validProviderLookupSequence(data && data.providerLookupSequence);
  const providerLookupRefInput = String(data && data.providerLookupRef || '');
  const providerLookupRef = sanitizeProviderLookupRef(providerLookupRefInput, providerFamily);
  const providerLookupArticleMarker = validArticleMarker(data && data.providerLookupArticleMarker);
  const providerLookupGroupProof = Boolean(data && data.providerLookupGroupProof === true);
  const requestKey = String(data && data.requestKey || '');
  const rejectReason = providerDirectLookupRejectReason(articleMarker, providerFamily, listingKey, providerLookupSequence, providerLookupRefInput, providerLookupArticleMarker, providerLookupGroupProof);
  if (rejectReason) {
    sendResponse({
      ok: false,
      status: rejectReason,
      directLookupStatus: rejectReason,
      directLookupStep: 'prepare',
      providerFamily,
      address2Seen: false,
      candidatePresent: false,
      floorHintPresent: false,
      rejectReason: rejectReason,
      providerEvidenceSummary: providerStore.summary(articleMarker)
    });
    return false;
  }

  const lookupFetch = providerDirectLookupFetch(data);

  if (providerLookupRef) {
    return runGenericProviderDirectLookup(providerFamily, providerLookupRef, data, sendResponse, lookupFetch);
  }

  if (
    !globalThis.DHS_MK_PROVIDER_LOOKUP ||
    typeof globalThis.DHS_MK_PROVIDER_LOOKUP.lookupMkProviderCandidate !== 'function' ||
    (providerLookupSequence && typeof globalThis.DHS_MK_PROVIDER_LOOKUP.lookupMkProviderCandidateFromSequence !== 'function')
  ) {
    sendResponse({
      ok: false,
      status: 'lookup-unavailable',
      directLookupStatus: 'lookup-unavailable',
      directLookupStep: 'prepare',
      providerFamily,
      address2Seen: false,
      candidatePresent: false,
      floorHintPresent: false,
      rejectReason: 'lookup-unavailable',
      providerEvidenceSummary: providerStore.summary(articleMarker)
    });
    return false;
  }

  const lookupInput = {
    listingKey,
    sequenceKey: providerLookupSequence,
    fetchImpl: lookupFetch,
    listingContext: listingContextFromDirectLookup(data),
    floorKind: data.detailFloorKind,
    floorBand: data.detailFloorBand,
    floorValue: data.detailFloorValue,
    totalFloor: data.detailTotalFloor
  };
  const lookupPromise = providerLookupSequence
    ? globalThis.DHS_MK_PROVIDER_LOOKUP.lookupMkProviderCandidateFromSequence(lookupInput)
    : globalThis.DHS_MK_PROVIDER_LOOKUP.lookupMkProviderCandidate(lookupInput);

  lookupPromise.then((result) => {
    const candidate = globalThis.DHS_PROVIDER_CANDIDATE.sanitizeProviderCandidate(result && result.candidate);
    const stored = (candidate.present || candidate.floorHintPresent) ? providerStore.storeCandidate(candidate, requestKey) : false;
    const diagnostic = result && result.diagnostic && typeof result.diagnostic === 'object' ? result.diagnostic : {};
    const status = stored ? 'candidate-stored' : (result && result.status ? result.status : 'no-candidate');
    const rejectReason = stored
      ? ''
      : (result && result.status === 'candidate' ? 'candidate-store-miss' : (diagnostic.rejectReason || status));
    sendResponse({
      ok: stored,
      status,
      directLookupStatus: diagnostic.directLookupStatus || (result && result.status ? result.status : status),
      directLookupStep: String(diagnostic.step || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40),
      providerFamily: diagnostic.providerFamily || providerFamily,
      bodyShape: String(diagnostic.bodyShape || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40),
      address2Seen: Boolean(diagnostic.address2Seen),
      sequenceSeen: Boolean(diagnostic.sequenceSeen),
      redirectStatus: Number(diagnostic.redirectStatus || 0),
      popupStatus: Number(diagnostic.popupStatus || 0),
      structuredFieldSeen: Boolean(diagnostic.structuredFieldSeen),
      structuredFieldName: String(diagnostic.structuredFieldName || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 40),
      structuredFieldNames: sanitizeDiagnosticFieldNames(diagnostic.structuredFieldNames),
      structuredFloorFieldSeen: Boolean(diagnostic.structuredFloorFieldSeen),
      structuredFloorFieldNames: sanitizeDiagnosticFieldNames(diagnostic.structuredFloorFieldNames),
      structuredFloorTotalFieldSeen: Boolean(diagnostic.structuredFloorTotalFieldSeen),
      structuredValueStatus: String(diagnostic.structuredValueStatus || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40),
      visibleFragmentSeen: Boolean(diagnostic.visibleFragmentSeen),
      visibleFragmentStatus: String(diagnostic.visibleFragmentStatus || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40),
      visibleFallbackOnly: Boolean(diagnostic.visibleFallbackOnly),
      brokerOfficeBlockSeen: Boolean(diagnostic.brokerOfficeBlockSeen),
      candidatePresent: Boolean(diagnostic.candidatePresent),
      floorHintPresent: Boolean(diagnostic.floorHintPresent),
      rejectReason,
      providerEvidenceSummary: providerStore.summary(articleMarker)
    });
  }).catch(() => {
    sendResponse({
      ok: false,
      status: 'lookup-error',
      directLookupStatus: 'lookup-error',
      directLookupStep: '',
      providerFamily,
      address2Seen: false,
      candidatePresent: false,
      floorHintPresent: false,
      rejectReason: 'lookup-error',
      providerEvidenceSummary: providerStore.summary(articleMarker)
    });
  });
  return true;
}

function regionExportSenderTrusted(sender) {
  const tab = sender && sender.tab;
  return Boolean(
    Number(tab && tab.id) > 0
    && dhsTabMatchesAny(tab && tab.url, DHS_NAVER_MATCHES)
  );
}

function sanitizeRegionExportFilename(value) {
  const filename = String(value || '').trim();
  return /^dhs-region-\d{8}-\d{6}\.(csv|xlsx)$/.test(filename) ? filename : '';
}

function downloadRegionExportCsv(data, sender, sendResponse) {
  if (!regionExportSenderTrusted(sender)) {
    sendResponse({ ok: false, reason: 'untrusted-sender' });
    return false;
  }
  if (!chrome.downloads || typeof chrome.downloads.download !== 'function') {
    sendResponse({ ok: false, reason: 'downloads-unavailable' });
    return false;
  }
  const filename = sanitizeRegionExportFilename(data && data.filename);
  const filenameFallback = sanitizeRegionExportFilename(data && data.filenameFallback);
  // The cleaned workbook ships as base64-encoded .xlsx bytes (real spreadsheet columns). A CSV payload is
  // ALWAYS carried alongside as a fallback so a failed .xlsx download NEVER produces "저장 실패" with no
  // file — we retry the same data as CSV. This also keeps working if the .xlsx writer was unavailable.
  const xlsxBase64 = typeof (data && data.xlsxBase64) === 'string' ? data.xlsxBase64 : '';
  const csvText = typeof (data && data.csvText) === 'string' ? data.csvText : '';
  const xlsxOk = Boolean(
    xlsxBase64
    && filename
    && /\.xlsx$/.test(filename)
    && /^[A-Za-z0-9+/]*={0,2}$/.test(xlsxBase64)
    && Math.floor(xlsxBase64.length * 3 / 4) <= REGION_EXPORT_MAX_CSV_BYTES
  );
  const csvName = filenameFallback || (filename && /\.csv$/.test(filename) ? filename : '');
  const csvOk = Boolean(
    csvText
    && csvName
    && new TextEncoder().encode(csvText).byteLength <= REGION_EXPORT_MAX_CSV_BYTES
  );
  if (!xlsxOk && !csvOk) {
    sendResponse({ ok: false, reason: !filename && !csvName ? 'invalid-filename' : 'invalid-payload' });
    return false;
  }
  const tryDownload = (url, name) => new Promise((resolve) => {
    try {
      chrome.downloads.download({
        url,
        filename: `DHS/${name}`,
        saveAs: false,
        conflictAction: 'uniquify'
      }, (downloadId) => {
        resolve(chrome.runtime.lastError || !Number.isInteger(downloadId) ? null : downloadId);
      });
    } catch (_) {
      resolve(null);
    }
  });
  (async () => {
    if (xlsxOk) {
      const id = await tryDownload(
        `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${xlsxBase64}`,
        filename
      );
      if (id !== null) {
        sendResponse({ ok: true, downloadId: id, path: `Downloads/DHS/${filename}` });
        return;
      }
    }
    if (csvOk) {
      const id = await tryDownload(`data:text/csv;charset=utf-8,${encodeURIComponent(csvText)}`, csvName);
      if (id !== null) {
        sendResponse({ ok: true, downloadId: id, path: `Downloads/DHS/${csvName}` });
        return;
      }
    }
    sendResponse({ ok: false, reason: 'download-failed' });
  })();
  return true;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const data = message && typeof message === 'object' ? message : {};

  if (data.source === BRIDGE_SOURCE && data.type === 'DOWNLOAD_REGION_EXPORT') {
    return downloadRegionExportCsv(data, sender, sendResponse);
  }

  if (data.source === PROVIDER_SOURCE && data.type === 'PROVIDER_CANDIDATE') {
    const candidate = globalThis.DHS_PROVIDER_CANDIDATE.sanitizeProviderCandidate(data.candidate);
    const floorOnly = candidate.floorHintPresent && !candidate.present;
    const trustedFloorOnly = !floorOnly || providerCaptureSenderTrusted(sender);
    const trustedProviderCandidate = trustedFloorOnly && providerCaptureSenderTrusted(sender);
    const stored = trustedProviderCandidate && (candidate.present || candidate.floorHintPresent) ? providerStore.storeCandidate(candidate, data.requestKey) : false;
    if (stored) scheduleProviderTabClose(sender, true);
    sendResponse({ ok: stored });
    return false;
  }

  if (data.source === PROVIDER_SOURCE && data.type === 'PROVIDER_PAGE_OBSERVED') {
    const context = providerCaptureSenderTrusted(sender) ? providerStore.currentRequestContext() : null;
    const observed = context ? providerStore.recordObservation({
      providerFamily: data.providerFamily,
      candidatePresent: data.candidatePresent,
      floorHintPresent: data.floorHintPresent
    }, data.requestKey) : false;
    const scheduled = scheduleProviderTabClose(sender, Boolean(data.candidatePresent || data.floorHintPresent));
    sendResponse({
      ok: true,
      observed,
      closeScheduled: scheduled,
      providerEvidenceSummary: providerStore.summary(context && context.articleMarker)
    });
    return false;
  }

  if (data.source === PROVIDER_SOURCE && data.type === 'GET_PROVIDER_REQUEST_CONTEXT') {
    const context = providerCaptureSenderTrusted(sender) ? providerStore.currentRequestContext() : null;
    if (!context) {
      sendResponse({ ok: false, articleMarker: '', listingContext: {} });
      return false;
    }
    sendResponse({
      ok: true,
      articleMarker: context.articleMarker,
      requestKey: context.requestKey,
      listingContext: context.listingContext
    });
    return false;
  }

  if (data.source === BRIDGE_SOURCE && data.type === 'BEGIN_PROVIDER_REQUEST') {
    const ok = providerStore.beginRequest({
      articleMarker: data.articleMarker,
      listingContext: data.listingContext,
      targetPhase: data.targetPhase,
      targetIndex: data.targetIndex,
      targetCount: data.targetCount,
      targetFamily: data.targetFamily
    });
    const beginContext = ok ? providerStore.currentRequestContext() : null;
    if (ok) {
      providerRequestEpoch += 1;
      closeProviderTabsForOpener(pendingProviderOpenerTabId);
      rememberProviderOpener(sender && sender.tab && sender.tab.id);
    }
    sendResponse({
      ok,
      requestKey: beginContext && beginContext.requestKey,
      providerEvidenceSummary: providerStore.summary(data.articleMarker)
    });
    return false;
  }

  if (data.source === BRIDGE_SOURCE && data.type === 'PROVIDER_DIRECT_LOOKUP') {
    return runProviderDirectLookup(data, sendResponse);
  }

  if (data.source === BRIDGE_SOURCE && data.type === 'OPEN_PROVIDER_BACKGROUND') {
    return openProviderBackgroundTab(data, sender, sendResponse);
  }

  if (data.source === BRIDGE_SOURCE && data.type === 'NAVER_FIN_ARTICLE_LOOKUP') {
    return runNaverFinFrontApiLookup(data, sendResponse);
  }

  if (data.source === BRIDGE_SOURCE && data.type === 'DISPATCH_PROVIDER_CLICK') {
    return dispatchProviderClick(data, sender, sendResponse);
  }

  if (data.source === BRIDGE_SOURCE && data.type === 'CLEAR_PROVIDER_CANDIDATE') {
    providerRequestEpoch += 1;
    const clearResult = providerStore.clear(data.articleMarker);
    const openerTabId = pendingProviderOpenerTabId || Number(sender && sender.tab && sender.tab.id) || 0;
    const providerTabsCloseScheduled = closeProviderTabsForOpener(openerTabId);
    forgetProviderOpener();
    sendResponse({
      ok: true,
      providerClearResult: Object.assign({}, clearResult, {
        providerTabsCloseScheduled: providerTabsCloseScheduled
      })
    });
    return false;
  }

  if (data.source === BRIDGE_SOURCE && data.type === 'GET_PROVIDER_CANDIDATE') {
    const candidates = providerStore.freshCandidates(data.articleMarker);
    sendResponse({
      providerEvidenceSummary: providerStore.summary(data.articleMarker),
      candidates: candidates,
      candidate: candidates.length > 0 ? candidates[candidates.length - 1] : null
    });
    return false;
  }

  return false;
});

// ---------------------------------------------------------------------------
// In-extension update check (baked-in "update available" notification).
// Unpacked Chrome extensions cannot silently self-update, so we periodically
// read the published manifest version on GitHub and, when it is newer than the
// running version, badge the toolbar icon + set a tooltip + fire a best-effort
// notification. Applying the update still means running an update-dhs script and
// reloading the extension. The current status is exposed via a runtime message
// (DHS_GET_UPDATE_STATUS) so the page overlay can surface it too.
// Public version feed the operator hosts on a public GitHub Gist or GitHub Pages, so the
// private code repo can stay private. JSON shape:
//   {"version":"x.y.z","downloadUrl":"...","notes":"..."}
// Set this to the RAW url, e.g.
//   https://gist.githubusercontent.com/<user>/<gistId>/raw/dhs-version.json
const DHS_UPDATE_VERSION_URL = 'https://gist.githubusercontent.com/minoTrey/76d9aa975cffe538a8fe1936a9774f88/raw/dhs-version.json';
const DHS_UPDATE_ALARM_NAME = 'dhs-update-check';
const DHS_UPDATE_CHECK_PERIOD_MINUTES = 360;

function dhsParseVersion(value) {
  return String(value || '').trim().split('.').map((part) => Number(part) || 0);
}

function dhsIsNewerVersion(remote, local) {
  const a = dhsParseVersion(remote);
  const b = dhsParseVersion(local);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

async function dhsApplyUpdateIndicator(available, latestVersion) {
  try {
    if (!chrome.action) return;
    if (typeof chrome.action.setBadgeText === 'function') {
      await chrome.action.setBadgeText({ text: available ? 'NEW' : '' });
    }
    if (available && typeof chrome.action.setBadgeBackgroundColor === 'function') {
      await chrome.action.setBadgeBackgroundColor({ color: '#d93025' });
    }
    if (typeof chrome.action.setTitle === 'function') {
      await chrome.action.setTitle({
        title: available
          ? ('DHS 업데이트 있음: v' + latestVersion + ' — update 스크립트 실행 후 확장을 새로고침하세요')
          : 'DHS — 동·호수·매물정보 정리'
      });
    }
  } catch (_) { /* ignore indicator errors */ }
}

async function dhsNotifyUpdateOnce(latestVersion) {
  try {
    const stored = await chrome.storage.local.get('dhsUpdateNotifiedVersion');
    if (stored && stored.dhsUpdateNotifiedVersion === latestVersion) return;
    if (chrome.notifications && typeof chrome.notifications.create === 'function') {
      chrome.notifications.create('dhs-update-' + latestVersion, {
        type: 'basic',
        iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAHElEQVR42mNkYPhfz0AEYBxVSF+Fo6NgVCF9FQIAcHwHgS1a3EcAAAAASUVORK5CYII=',
        title: 'DHS 업데이트 있음',
        message: '새 버전 ' + latestVersion + ' 이(가) 배포되었습니다. update 스크립트를 실행한 뒤 확장을 새로고침하세요.'
      }, () => { void chrome.runtime.lastError; });
    }
    await chrome.storage.local.set({ dhsUpdateNotifiedVersion: latestVersion });
  } catch (_) { /* ignore notify errors */ }
}

async function dhsCheckForUpdate() {
  try {
    if (!DHS_UPDATE_VERSION_URL) return; // version feed not configured yet
    const localVersion = chrome.runtime.getManifest().version;
    const response = await fetch(DHS_UPDATE_VERSION_URL, { cache: 'no-store' });
    if (!response || !response.ok) return;
    const feed = await response.json().catch(() => null);
    const latestVersion = feed && feed.version ? String(feed.version) : '';
    if (!latestVersion) return;
    const available = dhsIsNewerVersion(latestVersion, localVersion);
    await chrome.storage.local.set({
      dhsUpdateStatus: {
        updateAvailable: available,
        latestVersion: latestVersion,
        localVersion: localVersion,
        downloadUrl: (feed && feed.downloadUrl) || '',
        notes: (feed && feed.notes) || '',
        checkedAt: Date.now()
      }
    });
    await dhsApplyUpdateIndicator(available, latestVersion);
    if (available) await dhsNotifyUpdateOnce(latestVersion);
  } catch (_) { /* offline / transient — retry on next alarm */ }
}

if (chrome.runtime && chrome.runtime.onInstalled && typeof chrome.runtime.onInstalled.addListener === 'function') {
  chrome.runtime.onInstalled.addListener(() => { dhsCheckForUpdate(); });
}
if (chrome.runtime && chrome.runtime.onStartup && typeof chrome.runtime.onStartup.addListener === 'function') {
  chrome.runtime.onStartup.addListener(() => { dhsCheckForUpdate(); });
}
if (chrome.alarms && typeof chrome.alarms.create === 'function') {
  chrome.alarms.create(DHS_UPDATE_ALARM_NAME, { periodInMinutes: DHS_UPDATE_CHECK_PERIOD_MINUTES });
  if (chrome.alarms.onAlarm && typeof chrome.alarms.onAlarm.addListener === 'function') {
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm && alarm.name === DHS_UPDATE_ALARM_NAME) dhsCheckForUpdate();
    });
  }
}
if (chrome.runtime && chrome.runtime.onMessage && typeof chrome.runtime.onMessage.addListener === 'function') {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === 'DHS_GET_UPDATE_STATUS') {
      chrome.storage.local.get('dhsUpdateStatus').then((stored) => {
        sendResponse((stored && stored.dhsUpdateStatus) || { updateAvailable: false });
      });
      return true;
    }
    return false;
  });
}
dhsCheckForUpdate();
