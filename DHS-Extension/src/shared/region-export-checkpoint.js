(function exposeRegionExportCheckpoint(globalScope) {
  const CHECKPOINT_SCHEMA = 1;
  const DEFAULT_MAX_AGE_MS = 6 * 60 * 60 * 1000;
  const DEFAULT_MAX_ROWS = 1500;
  const MAX_ROWS = 2000;
  const FUTURE_SKEW_MS = 5 * 60 * 1000;
  const RESUMABLE_STATUSES = new Set(['exact', 'multiple-candidates']);
  const LISTING_CONTEXT_FIELDS = ['dong', 'floor', 'type', 'dealType', 'priceHint', 'areaHint', 'directionHint'];
  const EXACT_RECEIPT_SOURCES = new Set(['cdp', 'provider', 'group', 'line', 'official']);

  function norm(value, maxLength = 160) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
  }

  function safeText(value, maxLength = 160) {
    const text = norm(value, maxLength);
    if (/https?:\/\/|www\./i.test(text)) return '';
    if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text)) return '';
    if (/(?:^|\D)(?:01[016789]|0\d{1,2})[-.\s]?\d{3,4}[-.\s]?\d{4}(?:\D|$)/.test(text)) return '';
    return text;
  }

  function boundedInteger(value, maxValue = 999999) {
    const number = Math.floor(Number(value || 0) || 0);
    return Math.max(0, Math.min(maxValue, number));
  }

  function validRegionKey(value) {
    const key = norm(value, 80).toLowerCase();
    return /^region:[0-9a-f]{8,64}$/.test(key) ? key : '';
  }

  function validListingMarker(value) {
    const marker = norm(value, 80).toLowerCase();
    return /^listing:[0-9a-f]{8,64}$/.test(marker) ? marker : '';
  }

  function validDongHoHash(value) {
    const hash = norm(value, 64).toLowerCase();
    return /^[0-9a-f]{10,64}$/.test(hash) ? hash : '';
  }

  function validGroupChildHint(value) {
    const hint = norm(value, 40).toLowerCase();
    return /^child:[0-9a-f]{16}$/.test(hint) ? hint : '';
  }

  function validListingContextFingerprint(value) {
    const fingerprint = norm(value, 40).toLowerCase();
    return /^identity:[0-9a-f]{16}$/.test(fingerprint) ? fingerprint : '';
  }

  function validIsoTime(value) {
    const text = norm(value, 40);
    return text && Number.isFinite(Date.parse(text)) ? text : '';
  }

  function checkpointTime(nowMs) {
    const value = Number(nowMs);
    const time = Number.isFinite(value) && value > 0 ? value : Date.now();
    return new Date(time).toISOString();
  }

  function sanitizeCheckpointRow(row) {
    const input = row && typeof row === 'object' ? row : {};
    const listingMarker = validListingMarker(input.listingMarker);
    const dongHoStatus = norm(input.dongHoStatus, 40);
    const dongHo = safeText(input.dongHo, 240);
    const candidateCount = boundedInteger(input.candidateCount, 999);
    const collectedAt = validIsoTime(input.collectedAt);
    const qualityRejectedReason = safeText(input.qualityRejectedReason, 120);
    const groupedBrokerCount = boundedInteger(input.groupedBrokerCount, 9999);
    const isGroupedListing = Boolean(input.isGroupedListing || groupedBrokerCount > 1);
    const listingContextContractVersion = boundedInteger(input.listingContextContractVersion, 9);
    const hasListingContextDecision = Object.hasOwn(input, 'listingContextMatched')
      || Object.hasOwn(input, 'listingContextFingerprint')
      || Object.hasOwn(input, 'listingContextExpectedFingerprint')
      || listingContextContractVersion >= 1;
    const listingContextMatched = input.listingContextMatched === true;
    const listingContextFingerprint = validListingContextFingerprint(input.listingContextFingerprint);
    const listingContextExpectedFingerprint = validListingContextFingerprint(input.listingContextExpectedFingerprint);
    if (isGroupedListing) return null;
    if (hasListingContextDecision && (
      !listingContextMatched
      || !listingContextFingerprint
      || !listingContextExpectedFingerprint
    )) return null;
    if (!listingMarker || !RESUMABLE_STATUSES.has(dongHoStatus) || !dongHo || !collectedAt) return null;
    if (dongHoStatus === 'exact' && (qualityRejectedReason || !/\d{1,4}\s*\uB3D9\s*\d{1,4}\s*\uD638/.test(dongHo))) return null;
    if (dongHoStatus === 'multiple-candidates' && candidateCount < 1) return null;
    return {
      listingMarker,
      complexName: safeText(input.complexName, 120),
      complexListingCount: boundedInteger(input.complexListingCount, 99999),
      rowIndex: boundedInteger(input.rowIndex, 99999),
      dong: safeText(input.dong, 20),
      floor: safeText(input.floor, 30),
      type: safeText(input.type, 40),
      dealType: safeText(input.dealType, 30),
      priceHint: safeText(input.priceHint, 60),
      areaHint: safeText(input.areaHint, 30),
      directionHint: safeText(input.directionHint, 30),
      floorViewText: safeText(input.floorViewText, 120),
      moveInText: safeText(input.moveInText, 120),
      optionText: safeText(input.optionText, 160),
      listingFeatureText: safeText(input.listingFeatureText, 240),
      isGroupedListing,
      groupedBrokerCount,
      dongHoStatus,
      dongHo,
      candidateCount,
      qualityRejectedReason,
      qualityConfidence: safeText(input.qualityConfidence, 40),
      routeSearchStatus: safeText(input.routeSearchStatus, 40),
      routeSearchElapsedSec: boundedInteger(input.routeSearchElapsedSec, 3600),
      dongHoSource: safeText(input.dongHoSource, 120),
      dongHoHash: validDongHoHash(input.dongHoHash),
      resolverBranch: safeText(input.resolverBranch, 120),
      resolverOutcome: safeText(input.resolverOutcome, 120),
      ...(hasListingContextDecision ? {
        listingContextContractVersion: Math.max(1, listingContextContractVersion),
        listingContextMatched: true,
        listingContextFingerprint,
        listingContextExpectedFingerprint
      } : {}),
      collectedAt
    };
  }

  function parsedCheckpoint(value) {
    if (!value) return { value: null, reason: 'empty' };
    if (typeof value === 'object') return { value, reason: '' };
    try {
      return { value: JSON.parse(String(value)), reason: '' };
    } catch (_) {
      return { value: null, reason: 'invalid-json' };
    }
  }

  function cappedRows(value) {
    return Math.max(1, Math.min(MAX_ROWS, boundedInteger(value || DEFAULT_MAX_ROWS, MAX_ROWS)));
  }

  function sanitizedRows(rows, maxRows) {
    const byMarker = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
      const sanitized = sanitizeCheckpointRow(row);
      if (!sanitized) continue;
      byMarker.set(sanitized.listingMarker, sanitized);
      if (byMarker.size >= maxRows) break;
    }
    return Array.from(byMarker.values());
  }

  function sanitizedMarkers(markers, maxRows) {
    const values = new Set();
    for (const value of Array.isArray(markers) ? markers : []) {
      const marker = validListingMarker(value);
      if (!marker || values.has(marker)) continue;
      values.add(marker);
      if (values.size >= maxRows) break;
    }
    return Array.from(values);
  }

  function sanitizedRetryExactEvidence(values, maxRows) {
    const byMarker = new Map();
    for (const value of Array.isArray(values) ? values : []) {
      const input = value && typeof value === 'object' ? value : {};
      const listingMarker = validListingMarker(input.listingMarker);
      const dongHoHash = validDongHoHash(input.dongHoHash);
      if (!listingMarker || !dongHoHash) continue;
      const groupChildHint = validGroupChildHint(input.groupChildHint);
      byMarker.set(listingMarker, Object.assign(
        { listingMarker, dongHoHash },
        groupChildHint ? { groupChildHint } : {}
      ));
      if (byMarker.size >= maxRows) break;
    }
    return Array.from(byMarker.values());
  }

  function groupedShapeMatches(saved, current) {
    const savedCount = boundedInteger(saved.groupedBrokerCount, 9999);
    const savedGrouped = Boolean(saved.isGroupedListing || savedCount > 1);
    if (savedGrouped) return false;
    const hasCurrentShape = Object.hasOwn(current, 'isGroupedListing')
      || Object.hasOwn(current, 'groupedBrokerCount');
    if (!hasCurrentShape) return !savedGrouped;
    const currentCount = boundedInteger(current.groupedBrokerCount, 9999);
    const currentGrouped = Boolean(current.isGroupedListing || currentCount > 1);
    if (savedGrouped !== currentGrouped) return false;
    if (!savedGrouped) return true;
    return savedCount > 1 && currentCount > 1 && savedCount === currentCount;
  }

  function listingContextValue(field, value) {
    const text = norm(value, 160).replace(/\s+/g, '').toLowerCase();
    if (field === 'dong') {
      const match = text.match(/^(\d{1,4})(?:\uB3D9)?$/);
      if (match) return `dong:${String(Number(match[1]) || match[1])}`;
    }
    if (field === 'floor') {
      return text
        .replace(/\uC800\uCE35/g, 'low')
        .replace(/\uC911\uCE35/g, 'mid')
        .replace(/\uACE0\uCE35/g, 'high');
    }
    return text;
  }

  function checkpointRowMatchesCurrent(checkpointRow, currentRow) {
    const saved = sanitizeCheckpointRow(checkpointRow);
    const current = currentRow && typeof currentRow === 'object' ? currentRow : {};
    if (!saved) return false;
    if (!groupedShapeMatches(saved, current)) return false;
    let compared = 0;
    for (const field of LISTING_CONTEXT_FIELDS) {
      const left = listingContextValue(field, saved[field]);
      const right = listingContextValue(field, current[field]);
      if (!left || !right) continue;
      compared += 1;
      if (left !== right) return false;
    }
    return compared >= 2;
  }

  function mergeRevalidatedRows(previousRows, currentRows) {
    const previous = Array.isArray(previousRows) ? previousRows : [];
    const current = Array.isArray(currentRows) ? currentRows : [];
    const currentByMarker = new Map();
    const currentUnmarkedByKey = new Map();
    const currentUnkeyed = [];
    const unmarkedKey = (row) => {
      const complexName = norm(row && row.complexName, 120).toLowerCase();
      const status = norm(row && row.dongHoStatus, 60).toLowerCase();
      const source = norm(row && row.dongHoSource, 60).toLowerCase();
      return complexName && status ? `${complexName}|${status}|${source}` : '';
    };
    for (const value of current) {
      const row = value && typeof value === 'object' ? value : {};
      const marker = validListingMarker(row.listingMarker);
      if (marker) currentByMarker.set(marker, Object.assign({}, row, { listingMarker: marker }));
      else {
        const key = unmarkedKey(row);
        if (key) currentUnmarkedByKey.set(key, Object.assign({}, row));
        else currentUnkeyed.push(Object.assign({}, row));
      }
    }

    const merged = [];
    const consumed = new Set();
    const consumedUnmarked = new Set();
    for (const value of previous) {
      const row = value && typeof value === 'object' ? value : {};
      const marker = validListingMarker(row.listingMarker);
      if (marker) {
        if (consumed.has(marker)) continue;
        merged.push(currentByMarker.get(marker) || Object.assign({}, row, { listingMarker: marker }));
        consumed.add(marker);
        continue;
      }
      const key = unmarkedKey(row);
      if (!key || consumedUnmarked.has(key)) continue;
      merged.push(currentUnmarkedByKey.get(key) || Object.assign({}, row));
      consumedUnmarked.add(key);
    }
    for (const [marker, row] of currentByMarker) {
      if (consumed.has(marker)) continue;
      merged.push(row);
      consumed.add(marker);
    }
    for (const [key, row] of currentUnmarkedByKey) {
      if (consumedUnmarked.has(key)) continue;
      merged.push(row);
      consumedUnmarked.add(key);
    }
    merged.push(...currentUnkeyed);
    return merged.map((row, index) => Object.assign({}, row, { rowIndex: index + 1 }));
  }

  function exactReceiptAdvanced(beforeValue, afterValue, sourceValue) {
    const source = norm(sourceValue, 20).toLowerCase();
    if (!EXACT_RECEIPT_SOURCES.has(source)) return false;
    const before = beforeValue && typeof beforeValue === 'object' ? beforeValue : {};
    const after = afterValue && typeof afterValue === 'object' ? afterValue : {};
    return boundedInteger(after[source], Number.MAX_SAFE_INTEGER)
      > boundedInteger(before[source], Number.MAX_SAFE_INTEGER);
  }

  function groupedExactFreshnessDecision(input) {
    const options = input && typeof input === 'object' ? input : {};
    if (!options.runActive) return 'cancelled';
    const status = norm(options.status, 60).toLowerCase();
    if (status === 'exact') {
      return exactReceiptAdvanced(options.before, options.after, options.source)
        ? 'fresh-exact'
        : 'stale-exact';
    }
    if (['multiple-candidates', 'unresolved', 'timeout', 'group-child-unresolved', 'click-missing'].includes(status)) {
      return 'terminal-non-exact';
    }
    return 'waiting';
  }

  function buildCheckpoint(input) {
    const options = input && typeof input === 'object' ? input : {};
    const regionKey = validRegionKey(options.regionKey);
    if (!regionKey) return null;
    const now = checkpointTime(options.nowMs);
    const nowMs = Date.parse(now);
    const limit = cappedRows(options.maxRows);
    const previousParsed = parsedCheckpoint(options.previous).value;
    const maxAgeValue = Number(options.maxAgeMs);
    const maxAgeMs = Number.isFinite(maxAgeValue) && maxAgeValue > 0
      ? maxAgeValue
      : DEFAULT_MAX_AGE_MS;
    const previousUpdatedAt = previousParsed && validIsoTime(previousParsed.updatedAt);
    const previousUpdatedAtMs = previousUpdatedAt ? Date.parse(previousUpdatedAt) : 0;
    const previousMatches = previousParsed &&
      Number(previousParsed.schema) === CHECKPOINT_SCHEMA &&
      validRegionKey(previousParsed.regionKey) === regionKey &&
      previousUpdatedAtMs > 0 &&
      previousUpdatedAtMs <= nowMs + FUTURE_SKEW_MS &&
      nowMs - previousUpdatedAtMs <= maxAgeMs;
    const removeMarkers = new Set((Array.isArray(options.removeMarkers) ? options.removeMarkers : [])
      .map(validListingMarker)
      .filter(Boolean));
    const removeRetryMarkers = new Set([
      ...removeMarkers,
      ...(Array.isArray(options.removeRetryMarkers) ? options.removeRetryMarkers : [])
        .map(validListingMarker)
        .filter(Boolean)
    ]);
    const previousRows = previousMatches
      ? sanitizedRows(previousParsed.rows, limit).filter((row) => !removeMarkers.has(row.listingMarker))
      : [];
    const merged = new Map(previousRows.map((row) => [row.listingMarker, row]));
    for (const inputRow of Array.isArray(options.rows) ? options.rows : []) {
      const row = sanitizeCheckpointRow(inputRow);
      if (!row) continue;
      if (!merged.has(row.listingMarker) && merged.size >= limit) continue;
      merged.set(row.listingMarker, row);
    }
    const retryMarkers = new Set(previousMatches
      ? sanitizedMarkers(previousParsed.retryMarkers, limit)
        .filter((marker) => !removeRetryMarkers.has(marker))
      : []);
    for (const marker of sanitizedMarkers(options.retryMarkers, limit)) {
      if (retryMarkers.size >= limit && !retryMarkers.has(marker)) continue;
      retryMarkers.add(marker);
    }
    const retryExactByMarker = new Map(previousMatches
      ? sanitizedRetryExactEvidence(previousParsed.retryExactEvidence, limit)
        .filter((item) => !removeRetryMarkers.has(item.listingMarker))
        .map((item) => [item.listingMarker, item])
      : []);
    for (const item of sanitizedRetryExactEvidence(options.retryExactEvidence, limit)) {
      retryExactByMarker.set(item.listingMarker, item);
    }
    for (const marker of merged.keys()) {
      retryMarkers.delete(marker);
      retryExactByMarker.delete(marker);
    }
    for (const marker of retryExactByMarker.keys()) {
      if (!retryMarkers.has(marker)) retryExactByMarker.delete(marker);
    }
    const retryExactEvidence = Array.from(retryMarkers)
      .map((marker) => retryExactByMarker.get(marker))
      .filter(Boolean)
      .slice(0, limit);
    const createdAt = previousMatches && validIsoTime(previousParsed.createdAt)
      ? validIsoTime(previousParsed.createdAt)
      : now;
    return {
      schema: CHECKPOINT_SCHEMA,
      regionKey,
      createdAt,
      updatedAt: now,
      rows: Array.from(merged.values()).slice(0, limit),
      retryMarkers: Array.from(retryMarkers).slice(0, limit),
      retryExactEvidence
    };
  }

  function restoreFailure(reason) {
    return { ok: false, reason, checkpoint: null, rows: [], markers: [], retryMarkers: [], retryExactEvidence: [] };
  }

  function restoreCheckpoint(raw, input) {
    const options = input && typeof input === 'object' ? input : {};
    const regionKey = validRegionKey(options.regionKey);
    if (!regionKey) return restoreFailure('invalid-region');
    const parsed = parsedCheckpoint(raw);
    if (!parsed.value) return restoreFailure(parsed.reason);
    const checkpoint = parsed.value;
    if (Number(checkpoint.schema) !== CHECKPOINT_SCHEMA) return restoreFailure('schema-mismatch');
    if (validRegionKey(checkpoint.regionKey) !== regionKey) return restoreFailure('region-mismatch');
    const updatedAt = validIsoTime(checkpoint.updatedAt);
    if (!updatedAt) return restoreFailure('invalid-time');
    const nowValue = Number(options.nowMs);
    const nowMs = Number.isFinite(nowValue) && nowValue > 0 ? nowValue : Date.now();
    const updatedAtMs = Date.parse(updatedAt);
    if (updatedAtMs > nowMs + FUTURE_SKEW_MS) return restoreFailure('future');
    const maxAgeValue = Number(options.maxAgeMs);
    const maxAgeMs = Number.isFinite(maxAgeValue) && maxAgeValue > 0
      ? maxAgeValue
      : DEFAULT_MAX_AGE_MS;
    if (nowMs - updatedAtMs > maxAgeMs) return restoreFailure('stale');
    const rows = sanitizedRows(checkpoint.rows, cappedRows(options.maxRows));
    const rowMarkers = new Set(rows.map((row) => row.listingMarker));
    const retryMarkers = sanitizedMarkers(checkpoint.retryMarkers, cappedRows(options.maxRows))
      .filter((marker) => !rowMarkers.has(marker));
    const retryMarkerSet = new Set(retryMarkers);
    const retryExactEvidence = sanitizedRetryExactEvidence(
      checkpoint.retryExactEvidence,
      cappedRows(options.maxRows)
    ).filter((item) => retryMarkerSet.has(item.listingMarker));
    if (!rows.length && !retryMarkers.length) return restoreFailure('empty-rows');
    const safeCheckpoint = {
      schema: CHECKPOINT_SCHEMA,
      regionKey,
      createdAt: validIsoTime(checkpoint.createdAt) || updatedAt,
      updatedAt,
      rows,
      retryMarkers,
      retryExactEvidence
    };
    return {
      ok: true,
      reason: 'restored',
      checkpoint: safeCheckpoint,
      rows,
      markers: rows.map((row) => row.listingMarker),
      retryMarkers,
      retryExactEvidence
    };
  }

  const api = {
    CHECKPOINT_SCHEMA,
    DEFAULT_MAX_AGE_MS,
    DEFAULT_MAX_ROWS,
    buildCheckpoint,
    checkpointRowMatchesCurrent,
    exactReceiptAdvanced,
    groupedExactFreshnessDecision,
    mergeRevalidatedRows,
    restoreCheckpoint,
    sanitizeCheckpointRow
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }
  globalScope.DHS_REGION_EXPORT_CHECKPOINT = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
