(function exposeDongHoQuality(globalScope) {
  function norm(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function numericToken(value) {
    const match = norm(value).match(/\d{1,4}/);
    return match ? String(Number(match[0]) || match[0]) : '';
  }

  function normalizeFloorBand(value) {
    const text = norm(value).toLowerCase();
    if (['high', '\uACE0', '\uACE0\uCE35'].includes(text)) return 'high';
    if (['mid', 'middle', '\uC911', '\uC911\uCE35'].includes(text)) return 'mid';
    if (['low', '\uC800', '\uC800\uCE35'].includes(text)) return 'low';
    return '';
  }

  function floorBandFromFloorTotal(floor, total) {
    const floorNumber = Number(floor);
    const totalNumber = Number(total);
    if (!Number.isFinite(floorNumber) || !Number.isFinite(totalNumber) || floorNumber <= 0 || totalNumber <= 0 || floorNumber > totalNumber) {
      return '';
    }
    const lowMax = Math.max(1, Math.floor(totalNumber / 3));
    const highMin = Math.max(lowMax + 1, Math.ceil((totalNumber * 2) / 3));
    if (floorNumber <= lowMax) return 'low';
    if (floorNumber >= highMin) return 'high';
    return 'mid';
  }

  function floorMatchesBand(floor, total, band) {
    const floorNumber = Number(floor);
    const totalNumber = Number(total);
    const normalizedBand = normalizeFloorBand(band);
    if (!Number.isFinite(floorNumber) || !Number.isFinite(totalNumber) || floorNumber <= 0 || totalNumber <= 0 || floorNumber > totalNumber || !normalizedBand) {
      return false;
    }
    if (normalizedBand === 'low') return floorNumber <= Math.ceil(totalNumber / 3);
    if (normalizedBand === 'mid') {
      return floorNumber >= Math.floor(totalNumber / 3) + 1 && floorNumber <= Math.ceil((totalNumber * 2) / 3);
    }
    return floorNumber >= Math.floor((totalNumber * 2) / 3) + 1;
  }

  function unitFloorFromHo(value) {
    const digits = numericToken(value);
    // A 1-2 digit 호 (villa / 연립 / 다세대: "5호", "32호") encodes NO floor — the old code returned the
    // 호 number itself as the floor (32호 → floor 32), which then fabricated a floor-exact-conflict
    // against the listing's real floor and DROPPED a correct unit. Abstain (0) so the floor guards
    // short-circuit and the gate neither rejects nor invents a floor.
    if (!digits || digits.length < 3) return 0;
    return Number(digits.slice(0, -2)) || 0;
  }

  function exactParts(value) {
    const text = norm(value);
    const matches = [...text.matchAll(/(\d{1,4})\s*\uB3D9\s*(\d{1,4})\s*\uD638/g)];
    if (matches.length !== 1) {
      return {
        valid: false,
        ambiguous: matches.length > 1,
        dong: '',
        ho: '',
        floor: 0
      };
    }
    return {
      valid: true,
      ambiguous: false,
      dong: String(Number(matches[0][1]) || matches[0][1]),
      ho: String(Number(matches[0][2]) || matches[0][2]),
      floor: unitFloorFromHo(matches[0][2])
    };
  }

  function exactDisplayKey(value) {
    const parts = exactParts(value);
    return parts.valid ? `${parts.dong}:${parts.ho}` : '';
  }

  function floorContext(input) {
    const source = input && typeof input === 'object' ? input : {};
    const rawKind = norm(source.floorKind || source.detailFloorKind).toLowerCase();
    let kind = ['exact', 'band', 'loose', 'none'].includes(rawKind) ? rawKind : 'none';
    let floorValue = Number(source.floorValue || source.detailFloorValue || 0) || 0;
    let totalFloor = Number(source.totalFloor || source.detailTotalFloor || 0) || 0;
    let floorBand = normalizeFloorBand(source.floorBand || source.detailFloorBand);
    const floorTexts = Array.isArray(source.floorTexts)
      ? source.floorTexts.map(norm).filter(Boolean)
      : [norm(source.floorText)].filter(Boolean);

    if (kind !== 'loose') {
      for (const text of floorTexts) {
        const exact = text.match(/(?:^|[^\d])(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\uCE35)?(?:$|[^\d])/);
        if (exact) {
          floorValue = floorValue || Number(exact[1]) || 0;
          totalFloor = totalFloor || Number(exact[2]) || 0;
          kind = floorValue ? 'exact' : kind;
          break;
        }
        const bandToken = text.match(/(?:\uC800\uCE35|\uC911\uCE35|\uACE0\uCE35|\uC800|\uC911|\uACE0|low|mid|middle|high)/i)?.[0] || '';
        const band = normalizeFloorBand(bandToken);
        const total = Number(text.match(/\/\s*(\d{1,2})/)?.[1] || 0) || 0;
        if (band) {
          floorBand = floorBand || band;
          totalFloor = totalFloor || total;
          kind = 'band';
          break;
        }
      }
    }

    if (kind === 'none' && floorValue) kind = 'exact';
    if (kind === 'none' && floorBand) kind = 'band';
    return { kind, floorValue, totalFloor, floorBand };
  }

  function confidenceForContext(expectedDong, context) {
    const hasFloor = Boolean(
      (context.kind === 'exact' && context.floorValue) ||
      (context.kind === 'band' && context.floorBand && context.totalFloor)
    );
    if (expectedDong && hasFloor) return 'high';
    if (expectedDong || hasFloor) return 'medium';
    return 'low';
  }

  function buildResult(accepted, reason, exact, parts, expectedDong, context) {
    return {
      accepted,
      reason,
      exact: accepted ? norm(exact) : '',
      dong: parts.dong || '',
      ho: parts.ho || '',
      unitFloor: Number(parts.floor || 0) || 0,
      expectedDong,
      expectedFloor: Number(context.floorValue || 0) || 0,
      expectedFloorBand: context.floorBand || '',
      actualFloorBand: context.totalFloor
        ? (context.floorBand && floorMatchesBand(parts.floor, context.totalFloor, context.floorBand)
          ? context.floorBand
          : floorBandFromFloorTotal(parts.floor, context.totalFloor))
        : '',
      confidence: confidenceForContext(expectedDong, context)
    };
  }

  function evaluateExactContext(input) {
    const source = input && typeof input === 'object' ? input : {};
    const exact = norm(source.exact || source.display || source.primaryValue);
    const parts = exactParts(exact);
    const expectedDong = numericToken(source.expectedDong || source.detailDongToken || source.dong);
    const context = floorContext(source);
    if (!parts.valid) {
      return buildResult(false, parts.ambiguous ? 'ambiguous-exact' : 'invalid-exact', exact, parts, expectedDong, context);
    }
    if (expectedDong && parts.dong && expectedDong !== parts.dong) {
      return buildResult(false, 'dong-mismatch', exact, parts, expectedDong, context);
    }
    if (
      context.kind === 'exact'
      && context.floorValue
      && parts.floor
      // Only trust the 호-derived floor as a conflict signal when it is plausible for this building.
      // A floor greater than the total floor count means the derivation is wrong (mis-encoded 호), so
      // abstain rather than fabricate a conflict that would drop a correct unit.
      && (!context.totalFloor || parts.floor <= context.totalFloor)
      && context.floorValue !== parts.floor
    ) {
      return buildResult(false, 'floor-exact-conflict', exact, parts, expectedDong, context);
    }
    if (context.kind === 'band' && context.floorBand && context.totalFloor && parts.floor) {
      if (!floorMatchesBand(parts.floor, context.totalFloor, context.floorBand)) {
        return buildResult(false, 'floor-band-conflict', exact, parts, expectedDong, context);
      }
    }
    return buildResult(true, '', exact, parts, expectedDong, context);
  }

  function contextArticleMarker(source) {
    return norm(source && (source.articleMarker || source.expectedArticleMarker));
  }

  function contextDong(source) {
    return numericToken(source && (source.detailDongToken || source.dong));
  }

  function contextDirection(source) {
    return norm(source && (source.detailDirectionToken || source.direction))
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/\uD5A5$/, '');
  }

  function contextTypeTokens(source) {
    const input = source && typeof source === 'object' ? source : {};
    const values = [input.detailTypeToken]
      .concat(Array.isArray(input.detailTypeAliases) ? input.detailTypeAliases : []);
    return [...new Set(values
      .map((value) => norm(value).toUpperCase().replace(/[^0-9A-Z]/g, ''))
      .filter(Boolean))];
  }

  function typeTokenCompatible(left, right) {
    if (!left || !right || left === right) return Boolean(left && right);
    const leftNumber = left.replace(/[^0-9]/g, '');
    const rightNumber = right.replace(/[^0-9]/g, '');
    const leftSuffix = left.replace(/[0-9]/g, '');
    const rightSuffix = right.replace(/[0-9]/g, '');
    return Boolean(leftNumber && leftNumber === rightNumber && (!leftSuffix || !rightSuffix));
  }

  function contextTypesCompatible(requested, evidence) {
    const requestedTokens = contextTypeTokens(requested);
    const evidenceTokens = contextTypeTokens(evidence);
    if (requestedTokens.length && evidenceTokens.length) {
      return requestedTokens.some((left) => evidenceTokens.some((right) => typeTokenCompatible(left, right)));
    }
    const requestedSpace = Number(requested && (requested.detailExclusiveSpace || requested.exclusiveSpace) || 0) || 0;
    const evidenceSpace = Number(evidence && (evidence.detailExclusiveSpace || evidence.exclusiveSpace) || 0) || 0;
    return Boolean(requestedSpace > 0 && evidenceSpace > 0 && Math.abs(requestedSpace - evidenceSpace) <= 1.5);
  }

  function hasContextType(source) {
    return Boolean(
      contextTypeTokens(source).length ||
      Number(source && (source.detailExclusiveSpace || source.exclusiveSpace) || 0) > 0
    );
  }

  function normalizedConstraint(value) {
    return norm(value).toLowerCase().replace(/[\s,]/g, '');
  }

  function compareFloorContext(requested, evidence) {
    const expected = floorContext(requested);
    const actual = floorContext(evidence);
    const expectedPresent = Boolean(
      (expected.kind === 'exact' && expected.floorValue) ||
      (expected.kind === 'band' && expected.floorBand)
    );
    const actualPresent = Boolean(
      (actual.kind === 'exact' && actual.floorValue) ||
      (actual.kind === 'band' && actual.floorBand)
    );
    if (!expectedPresent) return { requested: false, evidence: actualPresent, matched: false, reason: '' };
    if (!actualPresent) return { requested: true, evidence: false, matched: false, reason: '' };
    if (expected.totalFloor && actual.totalFloor && expected.totalFloor !== actual.totalFloor) {
      return { requested: true, evidence: true, matched: false, reason: 'evidence-total-floor-mismatch' };
    }
    const totalFloor = expected.totalFloor || actual.totalFloor;
    if (expected.kind === 'exact' && actual.kind === 'exact') {
      return expected.floorValue === actual.floorValue
        ? { requested: true, evidence: true, matched: true, reason: '' }
        : { requested: true, evidence: true, matched: false, reason: 'evidence-floor-mismatch' };
    }
    if (expected.kind === 'band' && actual.kind === 'band') {
      return expected.floorBand === actual.floorBand
        ? { requested: true, evidence: true, matched: true, reason: '' }
        : { requested: true, evidence: true, matched: false, reason: 'evidence-floor-band-mismatch' };
    }
    const exactFloor = expected.kind === 'exact' ? expected.floorValue : actual.floorValue;
    const floorBand = expected.kind === 'band' ? expected.floorBand : actual.floorBand;
    if (!totalFloor) return { requested: true, evidence: true, matched: false, reason: '' };
    return floorMatchesBand(exactFloor, totalFloor, floorBand)
      ? { requested: true, evidence: true, matched: true, reason: '' }
      : { requested: true, evidence: true, matched: false, reason: 'evidence-floor-band-mismatch' };
  }

  function evidenceContextResult(accepted, reason, details) {
    return Object.assign({
      accepted,
      reason,
      sameArticle: false,
      matchCount: 0,
      coreMatchCount: 0,
      requestedCoreCount: 0,
      missingFields: []
    }, details || {});
  }

  function evaluateEvidenceTargetContext(input) {
    const source = input && typeof input === 'object' ? input : {};
    const requested = source.requested && typeof source.requested === 'object' ? source.requested : {};
    const evidence = source.evidence && typeof source.evidence === 'object' ? source.evidence : {};
    const requestedMarker = contextArticleMarker(requested);
    const evidenceMarker = contextArticleMarker(evidence);
    const sameArticle = Boolean(requestedMarker && evidenceMarker && requestedMarker === evidenceMarker);
    if (sameArticle) return evidenceContextResult(true, '', { sameArticle: true });
    let matchCount = 0;
    let coreMatchCount = 0;
    let requestedCoreCount = 0;
    const missingFields = [];

    const requestedDong = contextDong(requested);
    const evidenceDong = contextDong(evidence);
    if (requestedDong) {
      requestedCoreCount += 1;
      if (!evidenceDong) missingFields.push('dong');
      else if (requestedDong !== evidenceDong) {
        return evidenceContextResult(false, 'evidence-dong-mismatch', { sameArticle, matchCount, coreMatchCount, requestedCoreCount, missingFields });
      } else {
        matchCount += 1;
        coreMatchCount += 1;
      }
    }

    const floor = compareFloorContext(requested, evidence);
    if (floor.requested) {
      requestedCoreCount += 1;
      if (!floor.evidence) missingFields.push('floor');
      else if (floor.reason) {
        return evidenceContextResult(false, floor.reason, { sameArticle, matchCount, coreMatchCount, requestedCoreCount, missingFields });
      } else if (floor.matched) {
        matchCount += 1;
        coreMatchCount += 1;
      } else {
        missingFields.push('floor-proof');
      }
    }

    if (hasContextType(requested)) {
      requestedCoreCount += 1;
      if (!hasContextType(evidence)) missingFields.push('type');
      else if (!contextTypesCompatible(requested, evidence)) {
        return evidenceContextResult(false, 'evidence-type-mismatch', { sameArticle, matchCount, coreMatchCount, requestedCoreCount, missingFields });
      } else {
        matchCount += 1;
        coreMatchCount += 1;
      }
    }

    const requestedDirection = contextDirection(requested);
    const evidenceDirection = contextDirection(evidence);
    if (requestedDirection) {
      requestedCoreCount += 1;
      if (!evidenceDirection) missingFields.push('direction');
      else if (requestedDirection !== evidenceDirection) {
        return evidenceContextResult(false, 'evidence-direction-mismatch', { sameArticle, matchCount, coreMatchCount, requestedCoreCount, missingFields });
      } else {
        matchCount += 1;
        coreMatchCount += 1;
      }
    }

    for (const [field, reason] of [
      ['dealType', 'evidence-deal-mismatch'],
      ['priceToken', 'evidence-price-mismatch']
    ]) {
      const expected = normalizedConstraint(requested[field]);
      const actual = normalizedConstraint(evidence[field]);
      if (!expected || !actual) continue;
      if (expected !== actual) {
        return evidenceContextResult(false, reason, { sameArticle, matchCount, coreMatchCount, requestedCoreCount, missingFields });
      }
      matchCount += 1;
    }

    if (!sameArticle && (missingFields.length || requestedCoreCount < 3 || coreMatchCount < 3)) {
      return evidenceContextResult(false, 'evidence-context-insufficient', {
        sameArticle,
        matchCount,
        coreMatchCount,
        requestedCoreCount,
        missingFields
      });
    }
    return evidenceContextResult(true, '', {
      sameArticle,
      matchCount,
      coreMatchCount,
      requestedCoreCount,
      missingFields
    });
  }

  function qualityReasonLabel(value) {
    const reason = norm(value);
    if (['floor-exact-conflict', 'floor-band-conflict'].includes(reason)) return '\uCE35 \uC815\uBCF4 \uBD88\uC77C\uCE58';
    if (reason === 'dong-mismatch') return '\uB3D9 \uC815\uBCF4 \uBD88\uC77C\uCE58';
    if (reason === 'evidence-direction-mismatch') return '\uBC29\uD5A5 \uC815\uBCF4 \uBD88\uC77C\uCE58';
    if (reason === 'evidence-dong-mismatch') return '\uB3D9 \uC815\uBCF4 \uBD88\uC77C\uCE58';
    if (['evidence-floor-mismatch', 'evidence-floor-band-mismatch', 'evidence-total-floor-mismatch'].includes(reason)) return '\uCE35 \uC815\uBCF4 \uBD88\uC77C\uCE58';
    if (reason === 'evidence-type-mismatch') return '\uBA74\uC801\u00B7\uD0C0\uC785 \uC815\uBCF4 \uBD88\uC77C\uCE58';
    if (['evidence-deal-mismatch', 'evidence-price-mismatch'].includes(reason)) return '\uAC70\uB798 \uC870\uAC74 \uBD88\uC77C\uCE58';
    if (reason === 'evidence-context-insufficient') return '\uD615\uC81C \uB9E4\uBB3C \uD655\uC815 \uADFC\uAC70 \uBD80\uC871';
    if (reason === 'grouped-exact-revalidation-conflict') return '\uC7AC\uD655\uC778 \uACB0\uACFC \uBD88\uC77C\uCE58';
    if (reason === 'grouped-exact-revalidation-downgraded') return '\uC7AC\uD655\uC778\uC5D0\uC11C \uD6C4\uBCF4\uB85C \uBCC0\uACBD';
    if (reason === 'grouped-exact-revalidation-stale') return '\uC0C8 \uADFC\uAC70 \uD655\uC778 \uD544\uC694';
    if (reason === 'grouped-exact-revalidation-module-missing') return '\uC7AC\uD655\uC778 \uAC80\uC99D \uBD88\uAC00';
    if (reason === 'ambiguous-exact') return '\uD638\uC218 \uD6C4\uBCF4 \uBCF5\uC218';
    if (reason === 'invalid-exact') return '\uB3D9\uD638\uC218 \uD615\uC2DD \uD655\uC778 \uD544\uC694';
    if (reason === 'quality-module-missing') return '\uD655\uC815 \uAC80\uC99D \uBD88\uAC00';
    return reason ? '\uD655\uC815 \uADFC\uAC70 \uBD80\uC871' : '';
  }

  const api = {
    evaluateEvidenceTargetContext,
    evaluateExactContext,
    exactDisplayKey,
    exactParts,
    floorBandFromFloorTotal,
    floorMatchesBand,
    qualityReasonLabel
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }
  globalScope.DHS_DONGHO_QUALITY = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
