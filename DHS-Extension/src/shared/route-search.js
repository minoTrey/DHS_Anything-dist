(function exposeRouteSearch(globalScope) {
  const STALLED_AFTER_MS = 60000;
  const EXPIRED_AFTER_MS = 180000;
  const ROUTE_PROGRESS_EVIDENCE_CATEGORIES = new Set([
    'article',
    'cpProvider',
    'sameAddress',
    'representativeArticles',
    'complexList',
    'complexCache'
  ]);
  const ROUTE_PROGRESS_COUNT_CATEGORIES = [
    'cpProvider',
    'sameAddress',
    'representativeArticles',
    'complexList',
    'complexCache'
  ];
  const REFERENCE_ONLY_RESOLVER_BRANCHES = new Set([
    'idle',
    'ambiguous',
    'official-table',
    'naver-cache',
    'kb-alias'
  ]);

  function toSeconds(ms) {
    return Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  }

  function updateRouteSearchState(previous, input) {
    const prior = previous || {};
    const data = input || {};
    const selected = Boolean(data.selected);
    const nowMs = Number(data.nowMs) || 0;
    const signature = selected ? String(data.signature || '') : '';

    if (!selected) {
      return {
        routeSearchStatus: 'idle',
        routeSearchStartedAt: 0,
        routeSearchLastProgressAt: 0,
        routeSearchElapsedSec: 0,
        routeSearchIdleSec: 0,
        routeSearchSignature: ''
      };
    }

    const previousSignature = String(prior.routeSearchSignature || '');
    const signatureChanged = signature !== previousSignature;
    const previousArticleKey = articleKeyFromSignature(previousSignature);
    const nextArticleKey = articleKeyFromSignature(signature);
    const sameKnownArticle = Boolean(previousArticleKey && nextArticleKey && previousArticleKey === nextArticleKey);
    const articleChanged = Boolean(previousArticleKey && nextArticleKey && previousArticleKey !== nextArticleKey);
    const startedAt = articleChanged ? nowMs : (Number(prior.routeSearchStartedAt) || nowMs);
    const previousProgressAt = articleChanged ? nowMs : (Number(prior.routeSearchLastProgressAt) || nowMs);
    const lastProgressAt = signatureChanged ? nowMs : previousProgressAt;
    const idleMs = Math.max(0, nowMs - lastProgressAt);
    const elapsedMs = Math.max(0, nowMs - startedAt);
    const status = (sameKnownArticle && elapsedMs >= EXPIRED_AFTER_MS) || idleMs >= EXPIRED_AFTER_MS
      ? 'expired'
      : idleMs >= STALLED_AFTER_MS
        ? 'stalled'
        : 'active';

    return {
      routeSearchStatus: status,
      routeSearchStartedAt: startedAt,
      routeSearchLastProgressAt: lastProgressAt,
      routeSearchElapsedSec: toSeconds(elapsedMs),
      routeSearchIdleSec: toSeconds(idleMs),
      routeSearchSignature: signature
    };
  }

  function routeProgressEvidenceKey(state) {
    const input = state || {};
    const category = String(input.lastEvidenceCategory || 'none');
    if (!ROUTE_PROGRESS_EVIDENCE_CATEGORIES.has(category)) return 'none:none';
    return `${category}:${input.lastEvidenceStatus || 'none'}`;
  }

  function routeProgressResolverKey(state) {
    const input = state || {};
    const branch = String(input.resolverBranch || 'idle');
    if (REFERENCE_ONLY_RESOLVER_BRANCHES.has(branch)) return 'not-actionable';
    return `${branch}:${input.resolverOutcome || 'no-article'}`;
  }

  function routeProgressCountKey(state) {
    const counts = state && typeof state.networkCategoryCounts === 'object'
      ? state.networkCategoryCounts
      : {};
    const parts = ROUTE_PROGRESS_COUNT_CATEGORIES
      .map((category) => `${category}:${Number(counts[category] || 0) || 0}`);
    return parts.join(',');
  }

  function groupRouteProgressKey(state) {
    const input = state || {};
    const allowedSources = new Set([
      'dom-same-card',
      'complex-cache-quick',
      'sameAddress',
      'representative-main',
      'representative-main-1',
      'complex-list',
      'complex-cache'
    ]);
    const allowedStatuses = new Set(['idle', 'queued', 'opening', 'waiting', 'fetching', 'validating', 'rejected', 'captured', 'exhausted', 'blocked']);
    const status = String(input.groupRouteStatus || 'idle');
    const source = String(input.groupRouteSource || '');
    return [
      `group:${allowedStatuses.has(status) ? status : 'idle'}`,
      allowedSources.has(source) ? source : 'none',
      `idx:${Number(input.groupRouteIndex || 0)}/${Number(input.groupRouteCount || 0)}`,
      `seq:${Number(input.groupRouteProgressSeq || 0)}`
    ].join(':');
  }

  function providerFloorHintKey(state) {
    const input = state || {};
    if (!input.providerFloorHintPresent || !(Number(input.providerFloorHintValue) > 0)) {
      return input.providerFloorHintRejectedReason
        ? `floor-hint-rejected:${input.providerFloorHintRejectedReason}`
        : 'floor-hint:none';
    }
    const family = String(input.providerFloorHintFamily || '').replace(/[^a-z0-9-]/gi, '').slice(0, 32) || 'provider';
    return `floor-hint:${family}:${Number(input.providerFloorHintValue)}/${Number(input.providerFloorHintTotal || 0)}`;
  }

  function lineMapRouteProgressKey(state) {
    const input = state || {};
    const seq = Number(input.lineMapRouteProgressSeq || 0) || 0;
    if (seq <= 0) return 'line-map:none';
    const endpoint = String(input.lineMapRouteEndpoint || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 24) || 'unknown';
    const status = Number(input.lineMapRouteStatus || 0) || 0;
    const rows = Number(input.lineMapRouteRowCount || 0) || 0;
    return `line-map:${seq}:${endpoint}:${status}:${rows}`;
  }

  function articleMarkerKey(value) {
    const marker = String(value || '');
    if (/^article:[a-f0-9]{8,12}$/.test(marker)) return marker;
    return marker ? 'article-marker-unsafe' : 'no-marker';
  }

  function articleKeyFromSignature(signature) {
    const key = String(signature || '').split('|')[1] || '';
    if (/^article:[a-f0-9]{8,12}$/.test(key)) return key;
    if (key === 'no-marker' || key === 'article-marker-unsafe') return key;
    return '';
  }

  function buildRouteSearchSignature(state) {
    const input = state || {};
    return [
      input.articlePresent ? 'article' : 'no-article',
      articleMarkerKey(input.articleMarker),
      input.detailContextPresent ? 'detail' : 'no-detail',
      input.cpProviderClickTargetCount || 0,
      input.cpProviderClickTargetPhase || 'no-provider-phase',
      `attempt:${Number(input.cpProviderAttemptIndex || 0)}/${Number(input.cpProviderAttemptCount || 0)}`,
      input.cpParserReadiness || 'none',
      (input.cpProviderFamilies || []).join(',') || '-',
      routeProgressEvidenceKey(input),
      routeProgressCountKey(input),
      groupRouteProgressKey(input),
      providerFloorHintKey(input),
      lineMapRouteProgressKey(input),
      input.providerOpenStatus || 'idle',
      routeProgressResolverKey(input)
    ].join('|');
  }

  const api = {
    EXPIRED_AFTER_MS,
    STALLED_AFTER_MS,
    buildRouteSearchSignature,
    groupRouteProgressKey,
    lineMapRouteProgressKey,
    providerFloorHintKey,
    routeProgressCountKey,
    routeProgressEvidenceKey,
    routeProgressResolverKey,
    updateRouteSearchState
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }

  globalScope.DHS_ROUTE_SEARCH = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
