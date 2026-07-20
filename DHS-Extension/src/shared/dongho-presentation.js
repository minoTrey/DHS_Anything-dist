(function exposeDongHoPresentation(globalScope) {
  let nodeQualityApi = null;

  if (typeof require === 'function') {
    try {
      nodeQualityApi = require('./dongho-quality');
    } catch (_) {
      nodeQualityApi = null;
    }
  }

  function qualityApi() {
    return (globalScope && globalScope.DHS_DONGHO_QUALITY) || nodeQualityApi || {};
  }

  function norm(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  const NON_QUALITY_REJECTION_REASONS = new Set(['missing-exact', 'not-exact', 'non-exact-status']);
  const CANDIDATE_CONTEXT_WARNING_REASONS = new Set([
    'floor-exact-conflict',
    'floor-band-conflict',
    'dong-mismatch',
    'evidence-direction-mismatch',
    'evidence-dong-mismatch',
    'evidence-floor-mismatch',
    'evidence-floor-band-mismatch',
    'evidence-total-floor-mismatch',
    'evidence-type-mismatch',
    'evidence-deal-mismatch',
    'evidence-price-mismatch',
    'evidence-context-insufficient',
    'quality-module-missing',
    'group-child-module-missing',
    'grouped-exact-revalidation-stale',
    'grouped-exact-revalidation-module-missing'
  ]);

  function qualityRejectionReason(value) {
    const reason = norm(value);
    return NON_QUALITY_REJECTION_REASONS.has(reason) ? '' : reason;
  }

  function numericToken(value) {
    const match = norm(value).match(/\d{1,4}/);
    return match ? String(Number(match[0]) || match[0]) : '';
  }

  function exactParts(value) {
    const match = norm(value).match(/(\d{1,4})\s*\uB3D9\s*(\d{1,4})\s*\uD638/);
    return match
      ? { dong: String(Number(match[1]) || match[1]), ho: String(Number(match[2]) || match[2]) }
      : { dong: '', ho: '' };
  }

  function candidateValue(value) {
    if (value && typeof value === 'object') {
      return norm(value.exact || value.displayCandidate || value.display || value.dongHo || '');
    }
    return norm(value);
  }

  function splitCandidateDisplay(value) {
    const normalized = norm(value).replace(/^\uD6C4\uBCF4\s*:\s*/, '');
    if (!normalized) return { items: [], overflow: 0 };
    const overflowMatch = normalized.match(/\s+\uC678\s+(\d{1,3})\uAC1C\s*$/);
    const overflow = overflowMatch ? Number(overflowMatch[1] || 0) || 0 : 0;
    const body = overflowMatch ? normalized.slice(0, overflowMatch.index).trim() : normalized;
    return {
      items: body.split(/\s*(?:\/|,|\u00B7)\s*/).map(norm).filter(Boolean),
      overflow
    };
  }

  function candidateKey(value, targetDong) {
    const text = candidateValue(value);
    const parts = exactParts(text);
    const expectedDong = numericToken(targetDong);
    if (parts.dong && parts.ho) {
      return expectedDong && parts.dong === expectedDong ? `ho:${parts.ho}` : `${parts.dong}:${parts.ho}`;
    }
    const ho = text.match(/(\d{1,4})\s*\uD638/);
    if (ho) return `ho:${String(Number(ho[1]) || ho[1])}`;
    return text.replace(/\s+/g, '').toLowerCase();
  }

  function candidateFloorContext(input) {
    const data = input && typeof input === 'object' ? input : {};
    return {
      floorKind: data.targetFloorKind || data.floorKind || '',
      floorValue: data.targetFloorValue || data.floorValue || 0,
      totalFloor: data.targetTotalFloor || data.totalFloor || 0,
      floorBand: data.targetFloorBand || data.floorBand || '',
      floorText: data.targetFloor || data.floorText || data.floor || ''
    };
  }

  function hasCandidateFloorContext(context) {
    const data = context || {};
    return Boolean(norm(data.floorText) || Number(data.floorValue || 0) || norm(data.floorBand));
  }

  function candidateMatchesContext(value, input) {
    const data = input && typeof input === 'object' ? input : {};
    const text = candidateValue(value);
    const parts = exactParts(text);
    const expectedDong = numericToken(data.targetDong);
    if (expectedDong && parts.dong && parts.dong !== expectedDong) return false;
    const floorContext = candidateFloorContext(data);
    if (!hasCandidateFloorContext(floorContext)) return true;
    const ho = parts.ho || text.match(/(\d{1,4})\s*\uD638/)?.[1] || '';
    if (!ho) return false;
    const api = qualityApi();
    if (!api || typeof api.evaluateExactContext !== 'function') return false;
    const dong = parts.dong || expectedDong || '1';
    const result = api.evaluateExactContext(Object.assign({}, floorContext, {
      exact: `${dong}\uB3D9 ${ho}\uD638`,
      expectedDong
    }));
    return Boolean(result && result.accepted);
  }

  function candidateState(input) {
    const data = input && typeof input === 'object' ? input : {};
    const display = splitCandidateDisplay(data.display || '');
    const raw = []
      .concat(Array.isArray(data.candidates) ? data.candidates : [])
      .concat(Array.isArray(data.candidateDisplays) ? data.candidateDisplays : [])
      .concat(display.items);
    const seen = new Set();
    const rejected = new Set();
    const items = [];
    for (const value of raw) {
      const text = candidateValue(value);
      if (!candidateMatchesContext(text, data)) {
        rejected.add(candidateKey(text, '') || text);
        continue;
      }
      const key = candidateKey(text, data.targetDong);
      if (!text || !key || seen.has(key)) continue;
      seen.add(key);
      items.push(text);
    }
    items.sort((left, right) => {
      const leftParts = exactParts(left);
      const rightParts = exactParts(right);
      const leftHo = leftParts.ho || numericToken(left);
      const rightHo = rightParts.ho || numericToken(right);
      const leftDong = leftParts.dong || numericToken(data.targetDong);
      const rightDong = rightParts.dong || numericToken(data.targetDong);
      return (Number(leftDong || 0) - Number(rightDong || 0))
        || (Number(leftHo || 0) - Number(rightHo || 0))
        || left.localeCompare(right, 'ko');
    });
    const reportedCount = Math.max(
      0,
      Number(data.reportedCount || 0) || 0,
      Number(data.candidateCount || 0) || 0
    );
    const displayKeys = new Set();
    for (const value of display.items) {
      const text = candidateValue(value);
      if (!candidateMatchesContext(text, data)) continue;
      const key = candidateKey(text, data.targetDong);
      if (key) displayKeys.add(key);
    }
    const adjustedReportedCount = Math.max(0, reportedCount - rejected.size);
    const displayTotal = displayKeys.size ? displayKeys.size + display.overflow : 0;
    const reportedTotal = Math.max(adjustedReportedCount, displayTotal);
    return {
      items,
      total: items.length,
      reportedTotal,
      missingCount: Math.max(0, reportedTotal - items.length),
      rejectedCount: rejected.size
    };
  }

  function candidateCount(input) {
    return candidateState(input).total;
  }

  function exactQualityDecision(input, exact, targetDong) {
    const api = qualityApi();
    if (!api || typeof api.evaluateExactContext !== 'function') {
      return { accepted: false, reason: 'quality-module-missing' };
    }
    return api.evaluateExactContext(Object.assign({}, candidateFloorContext(input), {
      exact,
      expectedDong: targetDong
    }));
  }

  function candidatePart(value, targetDong) {
    const text = candidateValue(value);
    const parts = exactParts(text);
    const expectedDong = numericToken(targetDong);
    if (parts.ho) {
      if (expectedDong && parts.dong === expectedDong) return `${parts.ho}\uD638`;
      return parts.dong ? `${parts.dong}\uB3D9 ${parts.ho}\uD638` : `${parts.ho}\uD638`;
    }
    const ho = text.match(/(\d{1,4})\s*\uD638/);
    if (ho) return `${String(Number(ho[1]) || ho[1])}\uD638`;
    return text;
  }

  function commonCandidateDongFromItems(items) {
    let common = '';
    for (const item of Array.isArray(items) ? items : []) {
      const dong = exactParts(item).dong;
      if (!dong) return '';
      if (!common) common = dong;
      else if (common !== dong) return '';
    }
    return common;
  }

  function commonCandidateDong(input) {
    const data = input && typeof input === 'object' ? input : {};
    const targetDong = numericToken(data.targetDong || data.dong);
    if (targetDong) return targetDong;
    return commonCandidateDongFromItems(candidateState(data).items);
  }

  function buildCandidateDisplay(input) {
    const data = input && typeof input === 'object' ? input : {};
    const state = candidateState(data);
    if (!state.items.length) return '';
    const displayDong = numericToken(data.targetDong || data.dong) || commonCandidateDongFromItems(state.items);
    const visible = state.items.map((item) => candidatePart(item, displayDong));
    return `\uD6C4\uBCF4: ${visible.join(' / ')}`;
  }

  function statusLabel(status) {
    const value = norm(status);
    if (value === 'exact') return '\uB3D9\uD638\uC218 \uD655\uC815';
    if (value === 'multiple-candidates') return '\uD6C4\uBCF4 \uD655\uC778';
    if (value === 'unresolved') return '\uBBF8\uD655\uC815';
    if (value === 'context-mismatch') return '\uB300\uC0C1 \uBD88\uC77C\uCE58';
    if (value === 'waiting') return '\uCC98\uB9AC \uC911';
    return '';
  }

  const TERMINAL_EVIDENCE_STATUSES = new Set(['exact', 'multiple-candidates', 'unresolved', 'context-mismatch']);

  function advanceEvidenceClock(previousInput, nextInput) {
    const previous = previousInput && typeof previousInput === 'object' ? previousInput : {};
    const next = nextInput && typeof nextInput === 'object' ? nextInput : {};
    const key = norm(next.key);
    const status = norm(next.status);
    if (!key || !TERMINAL_EVIDENCE_STATUSES.has(status)) return { key: '', collectedAt: '' };
    const previousAt = norm(previous.collectedAt);
    if (norm(previous.key) === key && previousAt && Number.isFinite(Date.parse(previousAt))) {
      return { key, collectedAt: previousAt };
    }
    const preferredAtMs = Number(next.preferredAtMs || 0);
    const nowMs = Number(next.nowMs || 0);
    const collectedAtMs = Number.isFinite(preferredAtMs) && preferredAtMs > 0 ? preferredAtMs : nowMs;
    if (!Number.isFinite(collectedAtMs) || collectedAtMs <= 0) return { key, collectedAt: '' };
    return { key, collectedAt: new Date(collectedAtMs).toISOString() };
  }

  function qualityReasonLabel(reason) {
    const api = qualityApi();
    if (api && typeof api.qualityReasonLabel === 'function') return api.qualityReasonLabel(reason);
    return reason ? '\uD655\uC815 \uADFC\uAC70 \uBD80\uC871' : '';
  }

  function canonicalStatus(input, exact, candidates) {
    const data = input && typeof input === 'object' ? input : {};
    const raw = norm(data.status || data.dongHoStatus);
    if (raw === 'context-mismatch') return 'context-mismatch';
    if (qualityRejectionReason(data.qualityRejectedReason)) return candidates.total > 0 ? 'multiple-candidates' : 'unresolved';
    if (raw === 'exact' && exact.dong && exact.ho) return 'exact';
    if (candidates.items.length > 0) return 'multiple-candidates';
    if (candidates.rejectedCount > 0) return 'context-mismatch';
    if (['multiple-candidates', 'candidate', 'candidates'].includes(raw)) return 'unresolved';
    if (['waiting', 'hashing', 'pending', 'processing'].includes(raw) || !raw) return 'waiting';
    return 'unresolved';
  }

  function noteFor(input, status, count) {
    const data = input && typeof input === 'object' ? input : {};
    const raw = norm(data.status || data.dongHoStatus);
    const qualityReason = qualityRejectionReason(data.qualityRejectedReason);
    if (status === 'multiple-candidates') {
      if (CANDIDATE_CONTEXT_WARNING_REASONS.has(qualityReason)) {
        return qualityReasonLabel(qualityReason) || '\uD655\uC815 \uADFC\uAC70 \uBD80\uC871';
      }
      return count === 1 ? '\uD6C4\uBCF4 1\uAC1C' : '\uD6C4\uBCF4 \uBCF5\uC218';
    }
    if (qualityReason) return qualityReasonLabel(qualityReason) || '\uD655\uC815 \uADFC\uAC70 \uBD80\uC871';
    if (status === 'exact' || status === 'waiting') return '';
    if (status === 'context-mismatch') return '\uB300\uC0C1 \uB9E4\uBB3C \uC870\uAC74 \uBD88\uC77C\uCE58';
    if (raw === 'complex-select-failed') return '\uB2E8\uC9C0 \uC120\uD0DD \uC2E4\uD328';
    if (raw === 'complex-no-rows') return '\uB9E4\uBB3C \uBAA9\uB85D \uC218\uC9D1 \uC2E4\uD328';
    return '\uD655\uC815 \uADFC\uAC70 \uBD80\uC871';
  }

  function buildDongHoPresentation(input) {
    const data = input && typeof input === 'object' ? input : {};
    const rawStatus = norm(data.status || data.dongHoStatus);
    const rawDisplay = norm(data.display || data.dongHo);
    const targetDong = numericToken(data.targetDong || data.dong);
    const exactDisplay = data.exactDisplay || (rawStatus === 'exact' ? rawDisplay : '');
    const exactDecision = rawStatus === 'exact'
      ? exactQualityDecision(data, exactDisplay, targetDong)
      : { accepted: true, reason: '' };
    const effectiveData = exactDecision.accepted || qualityRejectionReason(data.qualityRejectedReason)
      ? data
      : Object.assign({}, data, { qualityRejectedReason: exactDecision.reason || 'invalid-exact' });
    const exact = exactParts(exactDisplay);
    const candidateInput = {
      candidates: effectiveData.candidates,
      candidateDisplays: effectiveData.candidateDisplays,
      display: rawStatus === 'multiple-candidates' || /^\uD6C4\uBCF4\s*:/.test(rawDisplay) ? rawDisplay : '',
      reportedCount: effectiveData.reportedCount,
      candidateCount: effectiveData.candidateCount,
      targetDong,
      targetFloorKind: effectiveData.targetFloorKind,
      floorKind: effectiveData.floorKind,
      targetFloorValue: effectiveData.targetFloorValue,
      floorValue: effectiveData.floorValue,
      targetTotalFloor: effectiveData.targetTotalFloor,
      totalFloor: effectiveData.totalFloor,
      targetFloorBand: effectiveData.targetFloorBand,
      floorBand: effectiveData.floorBand,
      targetFloor: effectiveData.targetFloor,
      floorText: effectiveData.floorText,
      floor: effectiveData.floor,
      maxVisible: effectiveData.maxVisible
    };
    const initialCandidates = candidateState(candidateInput);
    const candidateDong = targetDong || commonCandidateDongFromItems(initialCandidates.items);
    const effectiveCandidateInput = candidateDong && !targetDong
      ? Object.assign({}, candidateInput, { targetDong: candidateDong })
      : candidateInput;
    const candidates = candidateDong && !targetDong ? candidateState(effectiveCandidateInput) : initialCandidates;
    const status = canonicalStatus(effectiveData, exact, candidates);
    const dong = exact.dong || candidateDong;
    const candidateDisplay = status === 'multiple-candidates'
      ? buildCandidateDisplay(effectiveCandidateInput)
      : '';
    const candidateListIncomplete = status === 'multiple-candidates' && (
      effectiveData.candidateComplete === false
      || candidates.missingCount > 0
    );
    const ho = status === 'exact'
      ? exact.ho
      : (status === 'multiple-candidates'
          ? candidateDisplay
          : (status === 'waiting' ? '\uC870\uC0AC \uC911' : '\uBBF8\uD655\uC815'));
    const display = status === 'exact' ? `${exact.dong}\uB3D9 ${exact.ho}\uD638` : candidateDisplay;
    return {
      status,
      dong,
      ho,
      display,
      candidateCount: status === 'multiple-candidates' ? candidates.total : 0,
      note: candidateListIncomplete
        ? '\uD6C4\uBCF4 \uBAA9\uB85D \uBD88\uC644\uC804'
        : noteFor(effectiveData, status, candidates.total),
      statusLabel: statusLabel(status),
      hasEvidence: status === 'exact'
        || (status === 'multiple-candidates' && Boolean(candidateDisplay) && !candidateListIncomplete)
    };
  }

  function presentationFingerprint(input) {
    const presentation = input && typeof input === 'object' ? input : {};
    const canonical = [
      norm(presentation.status),
      norm(presentation.dong),
      norm(presentation.ho),
      norm(presentation.display),
      String(Math.max(0, Number(presentation.candidateCount || 0) || 0)),
      norm(presentation.note),
      norm(presentation.statusLabel),
      presentation.hasEvidence === true ? 'true' : 'false'
    ].join('|');
    let hash = 0x811c9dc5;
    for (let index = 0; index < canonical.length; index += 1) {
      hash ^= canonical.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return `presentation:${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }

  const api = {
    advanceEvidenceClock,
    buildCandidateDisplay,
    buildDongHoPresentation,
    candidateCount,
    commonCandidateDong,
    exactParts,
    numericToken,
    presentationFingerprint,
    statusLabel
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }
  globalScope.DHS_DONGHO_PRESENTATION = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
