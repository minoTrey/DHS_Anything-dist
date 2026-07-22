(function exposeProviderTransient(globalScope) {
  // How many times a single provider direct-lookup is retried when it fails for a TRANSIENT reason
  // before falling back to weaker evidence. Bounded so a genuinely-unavailable provider can't loop.
  const PROVIDER_DIRECT_LOOKUP_MAX_RETRY = 2;

  // Non-HTTP transient failure reasons emitted by the service-worker provider fetch.
  const PROVIDER_DIRECT_LOOKUP_TRANSIENT_REASONS = [
    'http-error', 'non-json', 'no-response', 'timeout', 'timed-out', 'aborted',
    'tab-unavailable', 'tab-create-failed', 'tab-fetch-error', 'script-error', 'script-empty'
  ];

  // A provider lookup failure is TRANSIENT (worth retrying) when it is a rate-limit / server / infra
  // hiccup — http 429 or any 5xx, or one of the named infra reasons. A genuine result ("no-candidate",
  // "missing-key", http 4xx other than 429, etc.) is NOT transient and must fall back immediately, so
  // the same listing does not resolve differently across runs purely from a one-off network blip.
  function isTransientProviderLookupFailure(signal) {
    const value = String(signal == null ? '' : signal);
    if (/^http-(429|5\d\d)$/.test(value)) return true;
    return PROVIDER_DIRECT_LOOKUP_TRANSIENT_REASONS.indexOf(value) !== -1;
  }

  const api = {
    PROVIDER_DIRECT_LOOKUP_MAX_RETRY,
    PROVIDER_DIRECT_LOOKUP_TRANSIENT_REASONS,
    isTransientProviderLookupFailure
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }
  globalScope.DHS_PROVIDER_TRANSIENT = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
