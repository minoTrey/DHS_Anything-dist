(function exposeProviderStore(globalScope) {
  const DEFAULT_PENDING_TTL_MS = 2 * 60 * 1000;
  const DEFAULT_CANDIDATE_TTL_MS = 10 * 60 * 1000;
  const DEFAULT_MAX_CANDIDATES = 25;

  function validArticleMarker(value) {
    return /^article:[a-f0-9]{8,12}$/.test(String(value || ''));
  }

  function validRequestKey(value) {
    return /^req:[a-z0-9]{2,16}$/.test(String(value || ''));
  }

  function boundedText(value, maxLength) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength || 40);
  }

  function boundedInteger(value, min, max) {
    const number = Number(value) || 0;
    return Number.isInteger(number) && number >= min && number <= max ? number : 0;
  }

  function sanitizeTargetPhase(value) {
    const phase = boundedText(value, 32);
    return ['direct-provider', 'group-target', 'group-route-provider', 'provider-name'].includes(phase) ? phase : '';
  }

  function sanitizeTargetFamily(value) {
    return String(value || '').replace(/[^a-z0-9-]/gi, '').toLowerCase().slice(0, 24);
  }

  function sanitizeSourceToken(value, maxLength) {
    return boundedText(value, maxLength || 40).replace(/[^A-Za-z0-9_:-]/g, '').slice(0, maxLength || 40);
  }

  function sanitizeCandidateKind(value) {
    const kind = sanitizeSourceToken(value, 20);
    return ['dong-ho', 'ho-only', 'floor-only', 'none'].includes(kind) ? kind : '';
  }

  function sanitizeObservationReason(value) {
    const reason = boundedText(value, 40).replace(/[^A-Za-z0-9_-]/g, '');
    return ['provider-page-observed', 'provider-page-no-candidate'].includes(reason) ? reason : '';
  }

  function summarizeCandidateSource(candidate) {
    const data = candidate && typeof candidate === 'object' ? candidate : {};
    return {
      providerFamily: sanitizeTargetFamily(data.providerFamily),
      sourceField: sanitizeSourceToken(data.sourceField, 40),
      candidateKind: sanitizeCandidateKind(data.candidateKind),
      providerSourceLabel: sanitizeSourceToken(data.providerSourceLabel, 40),
      certainty: sanitizeSourceToken(data.certainty, 40),
      present: Boolean(data.present),
      floorHintPresent: Boolean(data.floorHintPresent),
      floorHintSourceField: sanitizeSourceToken(data.floorHintSourceField, 40)
    };
  }

  function sanitizeRequestTarget(input) {
    const data = input && typeof input === 'object' ? input : {};
    return {
      requestTargetPhase: sanitizeTargetPhase(data.targetPhase || data.requestTargetPhase),
      requestTargetIndex: boundedInteger(data.targetIndex || data.requestTargetIndex, 0, 999),
      requestTargetCount: boundedInteger(data.targetCount || data.requestTargetCount, 0, 999),
      requestTargetFamily: sanitizeTargetFamily(data.targetFamily || data.requestTargetFamily)
    };
  }

  function requestTargetPresent(target) {
    return Boolean(target && (
      target.requestTargetPhase ||
      target.requestTargetCount > 0 ||
      target.requestTargetFamily
    ));
  }

  function sanitizeListingContext(input) {
    const context = input && typeof input === 'object' ? input : {};
    const detailFloorKind = boundedText(context.detailFloorKind || context.floorKind, 12);
    const detailFloorBand = boundedText(context.detailFloorBand || context.floorBand, 12);
    const lineCandidateDisplays = Array.isArray(context.lineCandidateDisplays)
      ? context.lineCandidateDisplays
        .map((item) => boundedText(item, 32))
        .filter((item) => /^\d{1,4}\s*\uB3D9\s+\d{2,4}\s*\uD638$/.test(item))
        .slice(0, 80)
      : [];
    const detailTypeAliases = Array.isArray(context.detailTypeAliases)
      ? context.detailTypeAliases
        .map((item) => boundedText(item, 24))
        .filter((item) => /^[0-9A-Za-z]{1,24}$/.test(item))
        .slice(0, 6)
      : [];
    return {
      detailDongToken: boundedText(context.detailDongToken || context.detailText, 24),
      detailFloorKind: ['exact', 'band', 'none'].includes(detailFloorKind) ? detailFloorKind : '',
      detailFloorBand: ['low', 'mid', 'high'].includes(detailFloorBand) ? detailFloorBand : '',
      detailFloorValue: boundedInteger(context.detailFloorValue || context.floorValue, 1, 100),
      detailTotalFloor: boundedInteger(context.detailTotalFloor || context.totalFloor, 1, 150),
      detailTypeToken: boundedText(context.detailTypeToken || context.typeToken || context.pyeongType, 24),
      detailTypeAliases,
      detailDirectionToken: boundedText(context.detailDirectionToken || context.directionToken, 24),
      dealType: boundedText(context.dealType, 16),
      priceToken: boundedText(context.priceToken, 24),
      lineCandidateDisplays
    };
  }

  function createProviderCandidateStore(options) {
    const settings = options || {};
    const now = typeof settings.now === 'function' ? settings.now : () => Date.now();
    const pendingTtlMs = Number(settings.pendingTtlMs || DEFAULT_PENDING_TTL_MS);
    const candidateTtlMs = Number(settings.candidateTtlMs || DEFAULT_CANDIDATE_TTL_MS);
    const maxCandidates = Math.max(1, Number(settings.maxCandidates || DEFAULT_MAX_CANDIDATES));
    let requestSeq = 0;
    let pendingRequest = null;
    let candidates = [];
    let lastObservation = null;

    function nextRequestKey() {
      requestSeq = (requestSeq % 1679615) + 1;
      const seq = requestSeq.toString(36);
      const time = Math.max(0, Math.floor(Number(now()) || 0)).toString(36).slice(-8);
      return `req:${seq}${time}`.slice(0, 20);
    }

    function beginRequest(input) {
      const articleMarker = String(input && input.articleMarker || '');
      if (!validArticleMarker(articleMarker)) return false;
      pendingRequest = {
        articleMarker,
        requestKey: nextRequestKey(),
        listingContext: sanitizeListingContext(input && input.listingContext),
        requestTarget: sanitizeRequestTarget(input),
        requestedAt: now()
      };
      candidates = [];
      lastObservation = null;
      return true;
    }

    function pendingFresh() {
      if (!pendingRequest) return null;
      if (now() - pendingRequest.requestedAt > pendingTtlMs) {
        pendingRequest = null;
        return null;
      }
      return pendingRequest;
    }

    function recordObservation(input, requestKey) {
      const pending = pendingFresh();
      if (!pending) return false;
      const key = String(requestKey || '');
      if (!validRequestKey(key) || key !== pending.requestKey) return false;
      const data = input && typeof input === 'object' ? input : {};
      const candidatePresent = Boolean(data.candidatePresent);
      const floorHintPresent = Boolean(data.floorHintPresent);
      lastObservation = {
        articleMarker: pending.articleMarker,
        requestKey: pending.requestKey,
        capturedAt: now(),
        lastObservationReason: candidatePresent || floorHintPresent
          ? 'provider-page-observed'
          : 'provider-page-no-candidate',
        lastObservationFamily: sanitizeTargetFamily(data.providerFamily),
        lastObservationCandidatePresent: candidatePresent,
        lastObservationFloorHintPresent: floorHintPresent
      };
      return true;
    }

    function currentRequestContext() {
      const pending = pendingFresh();
      if (!pending) return null;
      return {
        articleMarker: pending.articleMarker,
        requestKey: pending.requestKey,
        listingContext: Object.assign({}, pending.listingContext)
      };
    }

    function storeCandidate(candidate, requestKey) {
      const pending = pendingFresh();
      if (!pending || !candidate || (!candidate.present && !candidate.floorHintPresent)) return false;
      const key = String(requestKey || candidate.providerRequestKey || '');
      if (!validRequestKey(key) || key !== pending.requestKey) return false;
      candidates.push({
        ...candidate,
        articleMarker: pending.articleMarker,
        requestKey: pending.requestKey,
        capturedAt: now()
      });
      if (candidates.length > maxCandidates) {
        candidates = candidates.slice(candidates.length - maxCandidates);
      }
      return true;
    }

    function freshCandidates(articleMarker) {
      const marker = String(articleMarker || '');
      if (!validArticleMarker(marker) || candidates.length < 1) return [];
      const currentTime = now();
      candidates = candidates.filter((candidate) => currentTime - candidate.capturedAt <= candidateTtlMs);
      return candidates.filter((candidate) => candidate.articleMarker === marker);
    }

    function freshCandidate(articleMarker) {
      const fresh = freshCandidates(articleMarker);
      return fresh.length > 0 ? fresh[fresh.length - 1] : null;
    }

    function summary(articleMarker) {
      const marker = String(articleMarker || '');
      const pending = pendingFresh();
      const fresh = freshCandidates(marker);
      const providerFamilies = Array.from(new Set(fresh
        .map((candidate) => boundedText(candidate.providerFamily, 24))
        .filter(Boolean)));
      const result = {
        pendingActive: Boolean(marker && pending && pending.articleMarker === marker),
        candidateCount: fresh.length,
        exactCandidateCount: fresh.filter((candidate) => Boolean(candidate.present)).length,
        floorHintCount: fresh.filter((candidate) => Boolean(candidate.floorHintPresent)).length,
        providerFamilies,
        sourceSummaries: fresh.map(summarizeCandidateSource).slice(-6)
      };
      const requestTarget = pending && pending.articleMarker === marker ? pending.requestTarget : null;
      if (requestTargetPresent(requestTarget)) {
        Object.assign(result, requestTarget);
      }
      const observation = pending && pending.articleMarker === marker && lastObservation && lastObservation.articleMarker === marker
        ? lastObservation
        : null;
      if (observation) {
        Object.assign(result, {
          lastObservationReason: sanitizeObservationReason(observation.lastObservationReason),
          lastObservationFamily: sanitizeTargetFamily(observation.lastObservationFamily),
          lastObservationCandidatePresent: Boolean(observation.lastObservationCandidatePresent),
          lastObservationFloorHintPresent: Boolean(observation.lastObservationFloorHintPresent)
        });
      }
      return result;
    }

    function clear(articleMarker) {
      const marker = String(articleMarker || '');
      const clearedCandidateCount = marker
        ? candidates.filter((candidate) => candidate.articleMarker === marker).length
        : candidates.length;
      const clearedPendingRequest = Boolean(!marker || (pendingRequest && pendingRequest.articleMarker === marker));
      if (!marker) {
        candidates = [];
      } else {
        candidates = candidates.filter((candidate) => candidate.articleMarker !== marker);
      }
      if (!marker || (lastObservation && lastObservation.articleMarker === marker)) {
        lastObservation = null;
      }
      if (!marker || (pendingRequest && pendingRequest.articleMarker === marker)) {
        pendingRequest = null;
      }
      return {
        clearedCandidateCount,
        clearedPendingRequest
      };
    }

    return {
      beginRequest,
      currentRequestContext,
      recordObservation,
      storeCandidate,
      freshCandidate,
      freshCandidates,
      summary,
      clear
    };
  }

  const api = { createProviderCandidateStore };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }

  globalScope.DHS_PROVIDER_STORE = api;
})(typeof globalThis !== 'undefined' ? globalThis : self);
