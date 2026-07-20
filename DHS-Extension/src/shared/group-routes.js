(function exposeGroupRoutes(globalScope) {
  const ORIGINAL_GROUP_ROUTE_ORDER = Object.freeze([
    'dom-same-card',
    'complex-cache-quick',
    'sameAddress',
    'representative-main',
    'representative-main-1',
    'complex-list',
    'complex-cache'
  ]);

  const ROUTE_LABELS = Object.freeze({
    'dom-same-card': '\uD654\uBA74\uC758 \uAC19\uC740 \uB9E4\uBB3C \uCE74\uB4DC',
    'complex-cache-quick': '\uB2E8\uC9C0 \uCE90\uC2DC \uBE60\uB978 \uD655\uC778',
    sameAddress: '\uAC19\uC740\uC8FC\uC18C \uB9E4\uBB3C',
    'representative-main': '\uB300\uD45C\uB9E4\uBB3C \uBB36\uC74C',
    'representative-main-1': '\uB300\uD45C\uB9E4\uBB3C \uCD94\uAC00 \uBB36\uC74C',
    'complex-list': '\uB2E8\uC9C0 \uB9E4\uBB3C \uBAA9\uB85D',
    'complex-cache': '\uB2E8\uC9C0 \uCE90\uC2DC',
    'waiting-group-route': '\uAC19\uC740\uB9E4\uBB3C \uACBD\uB85C \uCC3E\uB294 \uC911'
  });

  const REFERENCE_CATEGORIES = ['landprice', 'prices', 'buildingUnits', 'pyeongtype'];
  const EXECUTABLE_GROUP_ROUTES = Object.freeze([
    'dom-same-card',
    'complex-cache-quick',
    'sameAddress',
    'representative-main',
    'representative-main-1',
    'complex-list',
    'complex-cache'
  ]);

  function count(input, key) {
    const counts = input && typeof input.networkCategoryCounts === 'object'
      ? input.networkCategoryCounts
      : {};
    const value = Number(counts && counts[key]);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }

  function present(input, key) {
    return Boolean(input && input[key]);
  }

  function currentRoute(input) {
    const state = input || {};
    if (Number(state.dongHoShownCount || 0) > 0) return 'dom-same-card';
    if (present(state, 'complexCacheQuickEvidenceSeen')) return 'complex-cache-quick';
    if (present(state, 'sameAddressEvidenceSeen') || count(state, 'sameAddress') > 0) return 'sameAddress';
    if (present(state, 'representativeEvidenceSeen') || count(state, 'representativeArticles') > 0) return 'representative-main';
    if (present(state, 'complexListEvidenceSeen') || count(state, 'complexList') > 0) return 'complex-list';
    if (present(state, 'complexCacheEvidenceSeen') || count(state, 'complexCache') > 0) return 'complex-cache';
    return 'waiting-group-route';
  }

  function referenceCount(input) {
    return REFERENCE_CATEGORIES.reduce((total, key) => total + count(input, key), 0);
  }

  function buildDeveloperSummary(input) {
    const state = input || {};
    const kb = state.kbAliasEvidenceSeen || (state.kbAliasReadiness && state.kbAliasReadiness !== 'none')
      ? 'wired'
      : 'not-wired';
    return [
      `dom-same-card:${Number(state.dongHoShownCount || 0) > 0 ? 'visible' : 'none'}`,
      `complex-cache-quick:${present(state, 'complexCacheQuickEvidenceSeen') ? 'seen' : 'none'}`,
      `sameAddress:${count(state, 'sameAddress') || (present(state, 'sameAddressEvidenceSeen') ? 1 : 0)}`,
      `representative:${count(state, 'representativeArticles') || (present(state, 'representativeEvidenceSeen') ? 1 : 0)}`,
      `complex-list:${count(state, 'complexList') || (present(state, 'complexListEvidenceSeen') ? 1 : 'not-wired')}`,
      `complex-cache:${count(state, 'complexCache') || (present(state, 'complexCacheEvidenceSeen') ? 1 : 'not-wired')}`,
      `naver-reference:${referenceCount(state)}`,
      `KB:${kb}`
    ].join(' / ');
  }

  function buildGroupRouteProgress(input) {
    const route = currentRoute(input || {});
    return {
      currentRoute: route,
      userLabel: ROUTE_LABELS[route] || ROUTE_LABELS['waiting-group-route'],
      developerSummary: buildDeveloperSummary(input || {}),
      order: ORIGINAL_GROUP_ROUTE_ORDER.slice()
    };
  }

  function safeArticleMarker(value) {
    const marker = String(value || '');
    return /^article:[a-f0-9]{8,12}$/.test(marker) ? marker : 'article:unknown';
  }

  function attemptedKeys(input) {
    return new Set(Array.isArray(input && input.autoLoopAttemptedKeys)
      ? input.autoLoopAttemptedKeys.map((item) => String(item || '')).filter(Boolean)
      : []);
  }

  function routeEvidenceSeen(input, route) {
    const state = input || {};
    if (route === 'dom-same-card') return Number(state.dongHoShownCount || 0) > 0;
    if (route === 'complex-cache-quick') return present(state, 'complexCacheQuickEvidenceSeen');
    if (route === 'sameAddress') return present(state, 'sameAddressEvidenceSeen') || count(state, 'sameAddress') > 0;
    if (route === 'representative-main' || route === 'representative-main-1') {
      return present(state, 'representativeEvidenceSeen') || count(state, 'representativeArticles') > 0;
    }
    if (route === 'complex-list') return present(state, 'complexListEvidenceSeen') || count(state, 'complexList') > 0;
    if (route === 'complex-cache') return present(state, 'complexCacheEvidenceSeen') || count(state, 'complexCache') > 0;
    return false;
  }

  function selectedListingReady(input) {
    const state = input || {};
    if (!state.articlePresent && !state.detailContextPresent) return false;
    return Boolean(
      state.detailDongToken ||
      (state.detailFloorKind && state.detailFloorKind !== 'none') ||
      state.detailContextPresent
    );
  }

  function activeRouteReady(input, route) {
    if (input && input.deferActiveGroupRoutes) return false;
    if (!selectedListingReady(input)) return false;
    return ['sameAddress', 'representative-main', 'representative-main-1', 'complex-list', 'complex-cache'].includes(route);
  }

  function buildGroupRouteTargets(input) {
    const state = input || {};
    const marker = safeArticleMarker(state.articleMarker);
    if (marker === 'article:unknown') return [];
    const attempted = attemptedKeys(state);
    const routes = EXECUTABLE_GROUP_ROUTES
      .filter((route) => routeEvidenceSeen(state, route) || activeRouteReady(state, route))
      .filter((route) => !attempted.has(`${marker}|group-route|${route}`));
    const targetCount = routes.length;
    return routes.map((route, index) => ({
      actionKey: `${marker}|group-route|${route}`,
      targetPhase: 'group-route',
      targetRoute: route,
      targetIndex: index,
      targetCount
    }));
  }

  const api = {
    ORIGINAL_GROUP_ROUTE_ORDER,
    buildGroupRouteTargets,
    buildGroupRouteProgress
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }

  globalScope.DHS_GROUP_ROUTES = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
