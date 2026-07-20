(function exposeArticleState(globalScope) {
  function hasDetailContext(detailFloor) {
    const detail = detailFloor || {};
    return Boolean(
      detail.detailContextPresent ||
      detail.detailDongToken ||
      (detail.detailFloorKind && detail.detailFloorKind !== 'none')
    );
  }

  function resolveArticleSelection(input) {
    const state = input || {};
    const urlArticleMarker = String(state.urlArticleMarker || '');
    const selectedArticleMarker = String(state.selectedArticleMarker || '');
    const preferSelectedArticleMarker = Boolean(state.preferSelectedArticleMarker);
    const previousArticleMarker = String(state.currentArticleMarker || state.lastArticleMarker || '');
    const detailContextPresent = Boolean(state.detailContextPresent);
    const articleMarker = preferSelectedArticleMarker && selectedArticleMarker
      ? selectedArticleMarker
      : urlArticleMarker || selectedArticleMarker || (detailContextPresent ? previousArticleMarker : '');

    return {
      articlePresent: Boolean(articleMarker || detailContextPresent),
      articleMarker
    };
  }

  function resolveVerifiedCdpArticleMarker(input) {
    const state = input || {};
    const targetArticleMarker = String(state.targetArticleMarker || '');
    const selectedArticleMarker = String(state.selectedArticleMarker || '');
    const urlArticleMarker = String(state.urlArticleMarker || '');
    if (!targetArticleMarker) return '';
    if (selectedArticleMarker) {
      return selectedArticleMarker === targetArticleMarker ? targetArticleMarker : '';
    }
    if (urlArticleMarker) {
      return urlArticleMarker === targetArticleMarker ? targetArticleMarker : '';
    }
    return '';
  }

  function isFreshCdpTargetContext(input, nowMs = Date.now()) {
    if (!input || typeof input !== 'object') return false;
    const expiresAt = Number(input.__dhsExpiresAt || 0) || 0;
    return expiresAt > Number(nowMs || 0);
  }

  const api = {
    hasDetailContext,
    resolveArticleSelection,
    resolveVerifiedCdpArticleMarker,
    isFreshCdpTargetContext
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }

  globalScope.DHS_ARTICLE_STATE = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
