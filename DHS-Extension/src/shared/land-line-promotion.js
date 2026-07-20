(function exposeLandLinePromotion(globalScope) {
  const GROUP_PROOF_ROUTES = new Set([
    'sameAddress',
    'representative-main',
    'representative-main-1',
    'complex-list',
    'complex-cache'
  ]);

  const GROUP_PROOF_STATUSES = new Set([
    'captured',
    'validating'
  ]);

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function safeRoute(value) {
    const route = String(value || '');
    return GROUP_PROOF_ROUTES.has(route) ? route : '';
  }

  function hasRouteEvidence(input, route) {
    if (route === 'sameAddress') return Boolean(input.sameAddressEvidenceSeen);
    if (route === 'representative-main' || route === 'representative-main-1') return Boolean(input.representativeEvidenceSeen);
    if (route === 'complex-list') return Boolean(input.complexListEvidenceSeen);
    if (route === 'complex-cache') return Boolean(input.complexCacheEvidenceSeen);
    return false;
  }

  function safeProviderFamily(value) {
    const family = String(value || '').trim();
    return /^[A-Za-z0-9-]{1,32}$/.test(family) ? family : '';
  }

  function bandRange(band, totalFloor) {
    const total = Number(totalFloor || 0);
    if (!band || !(total > 0)) return null;
    if (band === 'low') return [1, Math.max(1, Math.ceil(total / 3))];
    if (band === 'mid') return [Math.max(1, Math.floor(total / 3) + 1), Math.max(1, Math.ceil((total * 2) / 3))];
    if (band === 'high') return [Math.max(1, Math.floor((total * 2) / 3) + 1), total];
    return null;
  }

  function floorMatchesSelectedFloor(input, floor) {
    const selectedFloor = Number(input.detailFloorValue || input.floorValue || 0);
    if (String(input.detailFloorKind || '') === 'exact' && selectedFloor > 0) return selectedFloor === floor;
    const range = bandRange(String(input.detailFloorBand || input.floorBand || ''), Number(input.detailTotalFloor || input.totalFloor || 0));
    return !range || (floor >= range[0] && floor <= range[1]);
  }

  function providerFloorProof(input) {
    const floor = Number(input.providerFloorHintValue || 0);
    const family = safeProviderFamily(input.providerFloorHintFamily);
    if (!input.providerFloorHintPresent || !(floor > 0) || !family || family === 'group-route') return null;
    if (!floorMatchesSelectedFloor(input, floor)) return { rejected: true, reason: 'floor-band-conflict' };
    return {
      source: `provider-floor-hint:${family}`
    };
  }

  function routeSourcesMatch(source, route) {
    if (!source || !route) return false;
    if (source === route) return true;
    return route === 'representative-main-1' && source === 'representative-main';
  }

  function detailFloorProof(input) {
    const floor = Number(input.detailFloorValue || input.floorValue || 0);
    return input.detailFloorKind === 'exact' && floor > 0
      ? { source: 'naver-detail-floor' }
      : null;
  }

  function directHoCorroborationProof(input) {
    if (String(input.lineInferenceReason || '') !== 'line-type-corroborated-direct-ho') return null;
    if (Number(input.lineInferenceDirectHoEvidenceCount || 0) < 2) {
      return { rejected: true, reason: 'direct-ho-corroboration-insufficient' };
    }
    const floorProof = detailFloorProof(input);
    if (!floorProof) return { rejected: true, reason: 'exact-floor-proof-missing' };
    return { source: `naver-direct-ho+${floorProof.source}` };
  }

  function pyeongNoLineDirectHoProof(input) {
    if (String(input.lineInferenceReason || '') !== 'line-pyeong-no-line-direct-ho') return null;
    return { rejected: true, reason: 'pyeong-line-direct-ho-unsafe' };
  }

  function providerRouteSingleProof(input) {
    const rawCount = Number(input.providerRouteLookupRawCount || 0);
    const matchCount = Number(input.providerRouteLookupMatchCount || 0);
    const rejectedCount = Number(input.providerRouteLookupRejectedCount || 0);
    if (rawCount !== 1 || matchCount !== 1 || rejectedCount !== 0) return null;
    const floorProof = detailFloorProof(input);
    if (!floorProof) return { rejected: true, reason: 'exact-floor-proof-missing' };
    return { source: `provider-route-single+${floorProof.source}` };
  }

  function groupFloorProof(input, route) {
    const floor = Number(input.groupFloorHintValue || 0);
    if (!input.groupFloorHintPresent || !(floor > 0)) return null;
    const source = safeRoute(input.groupFloorHintSource);
    if (!route || !source) return { rejected: true, reason: 'group-proof-missing' };
    if (!routeSourcesMatch(source, route)) return { rejected: true, reason: 'group-floor-source-mismatch' };
    if (!floorMatchesSelectedFloor(input, floor)) return { rejected: true, reason: 'floor-band-conflict' };
    return { source: `group-floor-hint:${source}` };
  }

  function buildingUnitsExactProof(input) {
    const displayCandidate = normalizeText(input.buildingUnitsExactDisplay || '');
    if (!input.buildingUnitsExactPresent || input.buildingUnitsExactSource !== 'building-units-article-linked' || !displayCandidate) {
      return null;
    }
    if (!normalizeText(input.articleMarker || '') || !normalizeText(input.detailDongToken || '') || !normalizeText(input.detailTypeToken || '')) {
      return { rejected: true, reason: 'missing-context' };
    }
    return { displayCandidate };
  }

  function empty(reason) {
    return {
      present: false,
      displayCandidate: '',
      certainty: '',
      source: '',
      proofSource: '',
      reason: reason || 'not-promoted'
    };
  }

  function promoteLandLineCandidate(input) {
    const data = input && typeof input === 'object' ? input : {};
    const buildingUnitsProof = buildingUnitsExactProof(data);
    if (buildingUnitsProof && buildingUnitsProof.rejected) return empty(buildingUnitsProof.reason);
    if (buildingUnitsProof) {
      return {
        present: true,
        displayCandidate: buildingUnitsProof.displayCandidate,
        certainty: 'LAND_LINE',
        source: 'building-units-article-linked',
        proofSource: 'buildingUnits',
        reason: 'building-units-exact-accepted'
      };
    }

    const status = String(data.lineInferenceStatus || '');
    const displayCandidate = normalizeText(data.lineInferenceDisplay || '');
    const count = Number(data.lineInferenceCandidateCount || 0);
    if (status !== 'single-estimated' || !displayCandidate || count !== 1) {
      return empty('line-candidate-not-unique');
    }

    if (!normalizeText(data.articleMarker || '') || !normalizeText(data.detailDongToken || '') || !normalizeText(data.detailTypeToken || '')) {
      return empty('missing-context');
    }

    const directHoProof = directHoCorroborationProof(data);
    if (directHoProof && directHoProof.rejected) return empty(directHoProof.reason);
    if (directHoProof) {
      return {
        present: true,
        displayCandidate,
        certainty: 'LAND_LINE',
        source: 'land-line-direct-ho-corroborated',
        proofSource: directHoProof.source,
        reason: 'direct-ho-corroboration-accepted'
      };
    }

    const providerRouteProof = providerRouteSingleProof(data);
    if (providerRouteProof && providerRouteProof.rejected) return empty(providerRouteProof.reason);
    if (providerRouteProof) {
      return {
        present: true,
        displayCandidate,
        certainty: 'LAND_LINE',
        source: 'land-line-after-provider-route-single',
        proofSource: providerRouteProof.source,
        reason: 'provider-route-single-proof-accepted'
      };
    }

    const pyeongLineProof = pyeongNoLineDirectHoProof(data);
    if (pyeongLineProof && pyeongLineProof.rejected) return empty(pyeongLineProof.reason);
    if (pyeongLineProof) {
      return {
        present: true,
        displayCandidate,
        certainty: 'LAND_LINE',
        source: 'land-line-pyeong-no-line-direct-ho',
        proofSource: pyeongLineProof.source,
        reason: 'pyeong-no-line-direct-ho-accepted'
      };
    }

    const providerProof = providerFloorProof(data);
    if (providerProof) {
      return {
        present: true,
        displayCandidate,
        certainty: 'LAND_LINE',
        source: 'land-line-after-provider-floor',
        proofSource: providerProof.source,
        reason: 'provider-floor-proof-accepted'
      };
    }

    const route = safeRoute(data.groupRouteSource);
    if (!route || !hasRouteEvidence(data, route)) return empty('group-proof-missing');

    const groupStatus = String(data.groupRouteStatus || '');
    if (groupStatus === 'blocked') return empty('group-proof-blocked');
    if (!GROUP_PROOF_STATUSES.has(groupStatus)) return empty('group-proof-missing');

    const floorProof = detailFloorProof(data) || groupFloorProof(data, route);
    if (floorProof && floorProof.rejected) return empty(floorProof.reason);
    if (!floorProof) return empty('exact-floor-proof-missing');

    return {
      present: true,
      displayCandidate,
      certainty: 'LAND_LINE',
      source: 'land-line-after-group',
      proofSource: `${route}+${floorProof.source}`,
      reason: 'group-proof-accepted'
    };
  }

  const api = {
    promoteLandLineCandidate
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }

  globalScope.DHS_LAND_LINE_PROMOTION = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
