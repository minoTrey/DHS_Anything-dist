(function installDhsProviderCapture() {
  const VERSION = '0.1.18';
  const SOURCE = 'DHS_ANYTHING_PROVIDER_CAPTURE';
  const PAGE_SOURCE = 'DHS_ANYTHING_CHROME_PAGE';
  const PAGE_EVENT = 'DHS_ANYTHING_CHROME_PAGE_EVENT';
  const PROVIDER_HOSTS = [
    { domain: 'land.mk.co.kr', family: 'mk' },
    { domain: 'm.land.mk.co.kr', family: 'mk' },
    { domain: 'landad.mk.co.kr', family: 'mk' },
    { domain: 'r114.com', family: 'r114' },
    { domain: 'n.gongsilclub.com', family: 'gongsilclub' },
    { domain: 'm.gongsilclub.com', family: 'gongsilclub' },
    { domain: 'homesdid.co.kr', family: 'homesdid' },
    { domain: 'm.homesdid.co.kr', family: 'homesdid' },
    { domain: 'serve.co.kr', family: 'serve' },
    { domain: 'rfine.kr', family: 'rfine' },
    { domain: 'rter2.com', family: 'rter' },
    { domain: 'rego.kr', family: 'rter' },
    { domain: 'm.rego.kr', family: 'rter' },
    { domain: 'asil.kr', family: 'asil' },
    { domain: 'realestate.hankyung.com', family: 'hankyung' },
    { domain: 'maemul.hankyung.com', family: 'hankyung' },
    { domain: 'land.hankyung.com', family: 'hankyung' },
    { domain: 'hankyung.com', family: 'hankyung' },
    { domain: 'www.hankyung.com', family: 'hankyung' },
    { domain: 'land.daara.co.kr', family: 'daara' },
    { domain: 'm.land.daara.co.kr', family: 'daara' },
    { domain: 'industryland.co.kr', family: 'daara' },
    { domain: 'www.industryland.co.kr', family: 'daara' },
    { domain: 'neonet.co.kr', family: 'neonet' },
    { domain: 'www.neonet.co.kr', family: 'neonet' },
    { domain: 'm.neonet.co.kr', family: 'neonet' },
    { domain: 'ten.co.kr', family: 'ten' },
    { domain: 'karhanbang.com', family: 'kar' },
    { domain: 'www.karhanbang.com', family: 'kar' },
    { domain: 'thebiz.co.kr', family: 'thebiz' },
    { domain: 'www.thebiz.co.kr', family: 'thebiz' },
    { domain: 'thebiz.kr', family: 'thebiz' },
    { domain: 'www.thebiz.kr', family: 'thebiz' },
    { domain: 'woori-house.co.kr', family: 'woori' },
    { domain: 'landcenter.kiso.or.kr', family: 'kiso' }
  ];

  function versionParts(value) {
    return String(value || '').split('.').map((part) => {
      const number = Number.parseInt(part, 10);
      return Number.isFinite(number) ? number : 0;
    });
  }

  function isSameOrNewerVersion(existing, current) {
    const left = versionParts(existing);
    const right = versionParts(current);
    for (let index = 0; index < Math.max(left.length, right.length, 3); index += 1) {
      const leftPart = left[index] || 0;
      const rightPart = right[index] || 0;
      if (leftPart > rightPart) return true;
      if (leftPart < rightPart) return false;
    }
    return true;
  }

  if (window.__DHS_ANYTHING_PROVIDER_CAPTURE__ && isSameOrNewerVersion(window.__DHS_ANYTHING_PROVIDER_CAPTURE__, VERSION)) return;
  window.__DHS_ANYTHING_PROVIDER_CAPTURE__ = VERSION;
  let runtimeUnavailable = false;
  let hookFieldValues = [];
  let providerRequestContext = {};
  let providerRequestKey = '';
  let mkDirectLookupStatus = 'idle';
  let mkDirectLookupKey = '';

  function providerFamilyFromLocation() {
    const hostname = location.hostname.toLowerCase();
    const provider = PROVIDER_HOSTS.find((item) => hostname === item.domain || hostname.endsWith(`.${item.domain}`));
    return provider ? provider.family : '';
  }

  function summarizeSourceFields(values) {
    const counts = new Map();
    for (const item of (Array.isArray(values) ? values : [])) {
      const sourceField = String(item && item.sourceField || '');
      if (!/^[A-Za-z0-9_-]{1,32}$/.test(sourceField)) continue;
      counts.set(sourceField, (counts.get(sourceField) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 12)
      .map(([sourceField, count]) => `${sourceField}:${Math.max(0, Math.min(999, count))}`)
      .join(',');
  }

  function comparableToken(value) {
    return String(value || '').toUpperCase().replace(/[^0-9A-Z\uAC00-\uD7AF]/g, '');
  }

  function sanitizeProviderRequestKey(value) {
    const key = String(value || '');
    return /^req:[a-z0-9]{2,16}$/.test(key) ? key : '';
  }

  function summarizeFieldContext(values) {
    const rows = Array.isArray(values) ? values : [];
    const dongNeedle = comparableToken(providerRequestContext.detailDongToken || '');
    const typeNeedle = comparableToken(providerRequestContext.detailTypeToken || '');
    const summary = {
      selectedDong: 0,
      selectedType: 0,
      hoLike: 0,
      floorLike: 0,
      serveRow: 0
    };

    for (const item of rows) {
      const sourceField = String(item && item.sourceField || '');
      const value = String(item && item.value || '');
      const comparable = comparableToken(value);
      if (sourceField === 'serve-row') summary.serveRow += 1;
      if (dongNeedle && comparable.includes(dongNeedle)) summary.selectedDong += 1;
      if (typeNeedle && comparable.includes(typeNeedle)) summary.selectedType += 1;
      if (/\d{2,4}\s*\uD638|^\s*[A-Za-z]?\d{2,4}\s*$/.test(value)) summary.hoLike += 1;
      if (/\d{1,2}\s*\uCE35|^\s*\d{1,2}\s*$/.test(value)) summary.floorLike += 1;
    }

    return Object.entries(summary)
      .filter(([, count]) => count > 0)
      .map(([key, count]) => `${key}:${Math.max(0, Math.min(999, count))}`)
      .join(',');
  }

  function writeProviderDiagnostic(eventName, candidate, fieldValuesForSummary) {
    if (!document.documentElement) return;
    const payload = {
      version: VERSION,
      providerFamily: providerFamilyFromLocation(),
      eventName: /^[a-z][a-z0-9-]{0,31}$/i.test(String(eventName || '')) ? eventName : 'event',
      fieldValueCount: Math.max(0, Math.min(999, Array.isArray(fieldValuesForSummary) ? fieldValuesForSummary.length : 0)),
      sourceFieldSummary: summarizeSourceFields(fieldValuesForSummary),
      fieldContextSummary: summarizeFieldContext(fieldValuesForSummary),
      candidatePresent: Boolean(candidate && candidate.present),
      candidateKind: candidate && candidate.present ? String(candidate.candidateKind || '').slice(0, 24) : '',
      sourceField: candidate && candidate.present ? String(candidate.sourceField || '').slice(0, 32) : '',
      floorHintPresent: Boolean(candidate && candidate.floorHintPresent),
      floorHintSourceField: candidate && candidate.floorHintPresent ? String(candidate.floorHintSourceField || '').slice(0, 32) : '',
      mkDirectLookupStatus: /^[a-z0-9-]{0,32}$/i.test(String(mkDirectLookupStatus || '')) ? String(mkDirectLookupStatus || '') : '',
      runtimeUnavailable: Boolean(runtimeUnavailable)
    };
    document.documentElement.setAttribute('data-dhs-provider-capture', JSON.stringify(payload));
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function escapeCssString(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function providerFieldSelectors(fields) {
    return fields.flatMap((field) => {
      const value = escapeCssString(field);
      return [
        `[id="${value}"]`,
        `[name="${value}"]`,
        `[property="${value}"]`,
        `[itemprop="${value}"]`,
        `[data-field="${value}"]`,
        `[data-name="${value}"]`,
        `[data-key="${value}"]`
      ];
    });
  }

  function structuredTextSnippets() {
    const api = window.DHS_PROVIDER_CANDIDATE;
    const fields = api
      ? []
        .concat(Array.isArray(api.FIELD_NAMES) ? api.FIELD_NAMES : [])
        .concat(Array.isArray(api.FLOOR_FIELD_NAMES) ? api.FLOOR_FIELD_NAMES : [])
      : [];
    if (fields.length === 0) return '';

    const fieldPattern = new RegExp(`.{0,40}(?:${fields.map(escapeRegExp).join('|')}).{0,140}`, 'gi');
    const snippets = [];
    const nodes = Array.from(document.querySelectorAll('script, meta, [data-field], [data-name], [data-key], [data-props], [data-state], [data-json]')).slice(0, 120);

    for (const node of nodes) {
      const text = [
        node.textContent || '',
        node.getAttribute && node.getAttribute('content'),
        node.getAttribute && node.getAttribute('value'),
        node.getAttribute && node.getAttribute('data-props'),
        node.getAttribute && node.getAttribute('data-state'),
        node.getAttribute && node.getAttribute('data-json')
      ].filter(Boolean).join(' ');
      let match;
      fieldPattern.lastIndex = 0;
      while ((match = fieldPattern.exec(text)) && snippets.length < 40) {
        snippets.push(String(match[0] || '').replace(/\s+/g, ' ').slice(0, 220));
      }
      if (snippets.length >= 40) break;
    }

    return snippets.join(' ');
  }

  function pageText() {
    if (!document.body) return '';
    const visibleText = String(document.body.innerText || '').slice(0, 5000);
    return [visibleText, structuredTextSnippets()].filter(Boolean).join(' ');
  }

  function fieldValues() {
    const api = window.DHS_PROVIDER_CANDIDATE;
    const fields = api
      ? []
        .concat(Array.isArray(api.FIELD_NAMES) ? api.FIELD_NAMES : [])
        .concat(Array.isArray(api.FLOOR_FIELD_NAMES) ? api.FLOOR_FIELD_NAMES : [])
      : [];
    const fieldSet = new Set(fields.map((field) => String(field).toLowerCase()));
    const values = [];
    const selectors = [
      'input',
      'textarea',
      'select',
      'meta',
      '[data-field]',
      '[data-name]',
      '[data-key]'
    ].concat(providerFieldSelectors(fields));
    const elements = Array.from(document.querySelectorAll(selectors.join(', '))).slice(0, 500);

    for (const element of elements) {
      const sourceField = ['name', 'id', 'property', 'itemprop', 'data-field', 'data-name', 'data-key']
        .map((attr) => element.getAttribute && element.getAttribute(attr))
        .find((attr) => fieldSet.has(String(attr || '').toLowerCase()));
      if (!sourceField) continue;
      const selectedText = element.selectedOptions
        ? Array.from(element.selectedOptions).map((option) => option.textContent || '').join(' ')
        : '';
      const value = [
        'value' in element ? element.value : '',
        selectedText,
        element.getAttribute('content'),
        element.getAttribute('value'),
        element.getAttribute('data-value'),
        element.getAttribute('title'),
        element.getAttribute('aria-label'),
        element.textContent
      ].filter(Boolean).join(' ');
      if (value) values.push({ sourceField, value });
    }

    return values.slice(0, 40);
  }

  function sanitizeHookFieldValues(values) {
    const api = window.DHS_PROVIDER_CANDIDATE;
    const fields = api
      ? []
        .concat(Array.isArray(api.FIELD_NAMES) ? api.FIELD_NAMES : [])
        .concat(Array.isArray(api.FLOOR_FIELD_NAMES) ? api.FLOOR_FIELD_NAMES : [])
      : [];
    const fieldSet = new Set(fields.map((field) => String(field).toLowerCase()));
    const rows = [];

    for (const item of (Array.isArray(values) ? values : []).slice(0, 80)) {
      const sourceField = String(item && item.sourceField || '');
      if (!fieldSet.has(sourceField.toLowerCase())) continue;
      const value = String(item && item.value || '').replace(/\s+/g, ' ').trim().slice(0, 180);
      if (!value) continue;
      rows.push({ sourceField, value });
    }

    return rows.slice(0, 40);
  }

  function chromeRuntimeRef() {
    const guard = window.DHS_RUNTIME_GUARD;
    if (guard && typeof guard.safeChromeRuntimeRef === 'function') {
      return guard.safeChromeRuntimeRef(window);
    }
    try {
      return typeof chrome === 'undefined' ? null : chrome;
    } catch (_) {
      return null;
    }
  }

  function safeRuntimeSendMessage(message, callback) {
    const guard = window.DHS_RUNTIME_GUARD;
    const chromeRef = chromeRuntimeRef();
    const done = typeof callback === 'function' ? callback : function noop() {};
    if (guard && typeof guard.safeRuntimeSendMessage === 'function') {
      return guard.safeRuntimeSendMessage(chromeRef, message, done);
    }
    try {
      if (!chromeRef || !chromeRef.runtime || typeof chromeRef.runtime.sendMessage !== 'function') {
        done(null, new Error('runtime-unavailable'));
        return false;
      }
      chromeRef.runtime.sendMessage(message, (response) => {
        let runtimeError = null;
        try {
          runtimeError = chromeRef.runtime && chromeRef.runtime.lastError;
        } catch (error) {
          runtimeError = error;
        }
        done(runtimeError ? null : response, runtimeError);
      });
      return true;
    } catch (error) {
      done(null, error);
      return false;
    }
  }

  function providerObservation(extraFieldValues) {
    if (runtimeUnavailable) return;
    const api = window.DHS_PROVIDER_CANDIDATE;
    if (!api) return null;
    const mergedFieldValues = fieldValues()
      .concat(sanitizeHookFieldValues(extraFieldValues))
      .slice(0, 80);

    return api.buildProviderCandidateObservation({
      providerFamily: providerFamilyFromLocation(),
      bodyText: pageText(),
      fieldValues: mergedFieldValues,
      listingContext: providerRequestContext
    });
  }

  function sendProviderCandidate(candidate) {
    if (!candidate || (!candidate.present && !candidate.floorHintPresent)) return;
    safeRuntimeSendMessage({
      source: SOURCE,
      type: 'PROVIDER_CANDIDATE',
      version: VERSION,
      requestKey: providerRequestKey,
      candidate
    }, (_response, error) => {
      if (error) runtimeUnavailable = true;
    });
  }

  function sendProviderPageObserved(candidate) {
    safeRuntimeSendMessage({
      source: SOURCE,
      type: 'PROVIDER_PAGE_OBSERVED',
      version: VERSION,
      requestKey: providerRequestKey,
      providerFamily: providerFamilyFromLocation(),
      candidatePresent: Boolean(candidate && candidate.present),
      floorHintPresent: Boolean(candidate && candidate.floorHintPresent)
    }, (_response, error) => {
      if (error) runtimeUnavailable = true;
    });
  }

  function captureCandidate() {
    const candidate = providerObservation(hookFieldValues);
    writeProviderDiagnostic('scan', candidate, hookFieldValues);
    sendProviderPageObserved(candidate);
    if (!candidate || (!candidate.present && !candidate.floorHintPresent)) return;
    sendProviderCandidate(candidate);
  }

  function captureMkDirectCandidate() {
    if (providerFamilyFromLocation() !== 'mk') return;
    if (mkDirectLookupStatus === 'running') return;
    const lookup = window.DHS_MK_PROVIDER_LOOKUP;
    if (!lookup || typeof lookup.lookupMkProviderCandidateFromCurrentPage !== 'function') return;
    const fetchImpl = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
    if (!fetchImpl) return;

    const lookupKey = String(location && location.href || '');
    if (lookupKey && lookupKey === mkDirectLookupKey && mkDirectLookupStatus !== 'idle') return;
    mkDirectLookupKey = lookupKey;
    mkDirectLookupStatus = 'running';

    lookup.lookupMkProviderCandidateFromCurrentPage({
      href: lookupKey,
      bodyText: pageText(),
      fetchImpl,
      detailDongToken: providerRequestContext.detailDongToken || '',
      detailFloorKind: providerRequestContext.detailFloorKind || '',
      detailFloorBand: providerRequestContext.detailFloorBand || '',
      detailTotalFloor: providerRequestContext.detailTotalFloor || 0,
      detailFloorValue: providerRequestContext.detailFloorValue || 0
    }).then((result) => {
      mkDirectLookupStatus = String(result && result.status || 'done').replace(/[^a-z0-9-]/gi, '').slice(0, 32) || 'done';
      const candidate = result && result.candidate;
      writeProviderDiagnostic('mk-direct', candidate, hookFieldValues);
      sendProviderPageObserved(candidate);
      sendProviderCandidate(candidate);
    }).catch(() => {
      mkDirectLookupStatus = 'error';
      writeProviderDiagnostic('mk-direct-error', null, hookFieldValues);
    });
  }

  function requestProviderContext(callback) {
    safeRuntimeSendMessage({
      source: SOURCE,
      type: 'GET_PROVIDER_REQUEST_CONTEXT',
      version: VERSION
    }, (response, error) => {
      if (error) {
        runtimeUnavailable = true;
        if (typeof callback === 'function') callback();
        return;
      }
      providerRequestContext = response && response.ok && response.listingContext && typeof response.listingContext === 'object'
        ? response.listingContext
        : {};
      providerRequestKey = response && response.ok ? sanitizeProviderRequestKey(response.requestKey) : '';
      if (typeof callback === 'function') callback();
    });
  }

  function captureProviderFieldValues(values) {
    const sanitized = sanitizeHookFieldValues(values);
    if (!sanitized.length) return;
    hookFieldValues = sanitized.concat(hookFieldValues).slice(0, 80);
    const candidate = providerObservation(sanitized);
    writeProviderDiagnostic('field-values', candidate, hookFieldValues);
    sendProviderPageObserved(candidate);
    if (!candidate || (!candidate.present && !candidate.floorHintPresent)) return;
    sendProviderCandidate(candidate);
  }

  function onPageHookMessage(event) {
    if (event.source !== window) return;
    const data = event.data || {};
    if (data.source !== PAGE_SOURCE || data.type !== PAGE_EVENT) return;
    if (data.endpointCategory !== 'cpProvider') return;
    if (!data.providerFieldValues) return;
    captureProviderFieldValues(data.providerFieldValues);
  }

  function start() {
    requestProviderContext(() => {
      captureCandidate();
      captureMkDirectCandidate();
    });
    const observer = new MutationObserver(() => {
      window.clearTimeout(start.scanTimer);
      start.scanTimer = window.setTimeout(() => {
        captureCandidate();
        captureMkDirectCandidate();
      }, 250);
    });
    if (document.documentElement) {
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
    window.setInterval(() => {
      captureCandidate();
      captureMkDirectCandidate();
    }, 1500);
  }

  window.addEventListener('message', onPageHookMessage);
  writeProviderDiagnostic('installed', null, 0);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
