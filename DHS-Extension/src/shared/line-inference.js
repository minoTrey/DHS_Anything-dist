(function exposeLineInference(globalScope) {
  const DONG = '\uB3D9';
  const HO = '\uD638';
  const LINE = '\uB77C\uC778';
  const DIRECTION_TOKENS = Object.freeze([
    '\uB0A8\uB3D9\uD5A5',
    '\uB0A8\uC11C\uD5A5',
    '\uBD81\uB3D9\uD5A5',
    '\uBD81\uC11C\uD5A5',
    '\uB0A8\uD5A5',
    '\uB3D9\uD5A5',
    '\uBD81\uD5A5',
    '\uC11C\uD5A5'
  ]);

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeDongToken(value) {
    const match = normalizeText(value).match(new RegExp(`(?<!\\d)(\\d{1,4})\\s*${DONG}`));
    return match ? `${Number(match[1]) || match[1]}${DONG}` : '';
  }

  function normalizeTypeToken(value) {
    const text = normalizeText(value).toUpperCase();
    const matches = Array.from(text.matchAll(/(?<!\d)(0?\d{2,3})(?:\.\d{1,4})?\s*([A-Z]{0,3})(?![A-Z0-9])/g));
    const candidates = matches
      .map((match) => {
        const number = Number(match[1]);
        if (!Number.isFinite(number) || number < 10 || number > 299) return '';
        const rawSuffix = String(match[2] || '').toUpperCase();
        const nextChar = text.charAt(Number(match.index || 0) + String(match[0] || '').length);
        const suffix = rawSuffix === 'M2' || (rawSuffix === 'M' && nextChar === '\u00B2') ? '' : rawSuffix;
        return `${number}${suffix}`;
      })
      .filter(Boolean);
    if (candidates.length < 1) {
      const unitArea = text.match(/(?<!\d)(0?\d{2,3})(?:\.\d{1,4})?\s*(?:M2|M\u00B2|\u33A1)(?![A-Z0-9])/);
      if (unitArea) {
        const number = Number(unitArea[1]);
        if (Number.isFinite(number) && number >= 10 && number <= 299) return String(number);
      }
    }
    return candidates.find((item) => /[A-Z]$/.test(item)) || candidates[0] || '';
  }

  function typeTokenParts(value) {
    const token = normalizeTypeToken(value);
    const match = token.match(/^(\d{2,3})([A-Z]{0,3})$/i);
    return match ? { number: String(Number(match[1]) || match[1]), suffix: String(match[2] || '').toUpperCase(), token } : null;
  }

  function typeTokensCompatible(rowType, contextType) {
    const row = typeTokenParts(rowType);
    const context = typeTokenParts(contextType);
    if (!row || !context) return false;
    if (row.token === context.token) return true;
    if (row.number !== context.number) return false;
    return !row.suffix || !context.suffix;
  }

  function typeTokensExact(rowType, contextType) {
    const row = typeTokenParts(rowType);
    const context = typeTokenParts(contextType);
    return Boolean(row && context && row.token === context.token);
  }

  function normalizeLineToken(value) {
    const text = normalizeText(value);
    const direct = text.match(new RegExp(`(?<!\\d)(\\d{1,2})\\s*${HO}(?!\\s*\\uC120)`));
    const suffix = text.match(new RegExp(`(?<!\\d)(\\d{1,2})\\s*${LINE}`));
    const prefix = text.match(new RegExp(`${LINE}\\s*(\\d{1,2})`));
    const number = direct ? direct[1] : suffix ? suffix[1] : prefix ? prefix[1] : '';
    return number ? `${Number(number) || number}${HO}` : '';
  }

  function normalizeDirectionToken(value) {
    const text = normalizeText(value);
    if (!text) return '';
    return DIRECTION_TOKENS.find((token) => text.includes(token)) || '';
  }

  function normalizePyeongNoToken(value) {
    const text = normalizeText(value);
    if (!text) return '';
    return text.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
  }

  function normalizeAreaValue(value) {
    if (typeof value === 'number') {
      return Number.isFinite(value) && value > 0 && value < 400 ? value : 0;
    }
    const text = normalizeText(value).replace(/,/g, '');
    const match = text.match(/(?<!\d)(\d{1,3}(?:\.\d{1,4})?)(?!\d)/);
    if (!match) return 0;
    const number = Number(match[1]);
    return Number.isFinite(number) && number > 0 && number < 400 ? number : 0;
  }

  function areaMatches(rowArea, contextArea) {
    const row = normalizeAreaValue(rowArea);
    const context = normalizeAreaValue(contextArea);
    return row > 0 && context > 0 && Math.abs(row - context) < 0.01;
  }

  function lineNumber(lineToken) {
    const match = normalizeLineToken(lineToken).match(/\d+/);
    return match ? Number(match[0]) || 0 : 0;
  }

  function hoFromFloorAndLine(floorValue, lineToken, numberingScheme) {
    if (numberingScheme !== 'floor-line') return '';
    const floor = Number(floorValue) || 0;
    const line = lineNumber(lineToken);
    if (!(floor > 0) || !(line > 0)) return '';
    return `${floor}${String(line).padStart(2, '0')}${HO}`;
  }

  function originalDirectionLineHeuristicRows(rows, directionToken) {
    const text = normalizeText(directionToken);
    if (!text || !Array.isArray(rows) || rows.length === 0) {
      return { rows, matchCount: 0 };
    }
    let filtered = [];
    if (/남|South/i.test(text)) {
      filtered = rows.filter((row) => lineNumber(row.lineToken) >= 3);
    } else if (/동|East/i.test(text)) {
      filtered = rows.filter((row) => {
        const number = lineNumber(row.lineToken);
        return number > 0 && number <= 2;
      });
    }
    if (filtered.length > 0 && filtered.length < rows.length) {
      return { rows: filtered, matchCount: filtered.length };
    }
    return { rows, matchCount: 0 };
  }

  function floorMatches(row, floorValue) {
    const floor = Number(floorValue) || 0;
    if (!(floor > 0)) return false;
    const exact = Number(row.floorValue || 0);
    if (exact > 0) return exact === floor;
    const minFloor = Number(row.minFloor || row.floorMin || 0);
    const maxFloor = Number(row.maxFloor || row.floorMax || 0);
    if (minFloor > 0 || maxFloor > 0) {
      return floor >= (minFloor || floor) && floor <= (maxFloor || floor);
    }
    return true;
  }

  function bandRange(band, totalFloor) {
    const normalizedBand = String(band || '');
    const floors = Number(totalFloor) || 0;
    if (!normalizedBand || floors <= 0) return null;
    const lowEnd = Math.ceil(floors / 3);
    const midStart = lowEnd + 1;
    const midEnd = Math.ceil((floors * 2) / 3);
    if (normalizedBand === 'low') return [1, lowEnd];
    if (normalizedBand === 'mid') return [midStart, midEnd];
    if (normalizedBand === 'high') return [midEnd + 1, floors];
    return null;
  }

  function rowExactFloorAllowed(row, floorBand, totalFloor) {
    const exact = Number(row && row.floorValue || 0);
    if (!(exact > 0)) return false;
    const range = bandRange(floorBand, totalFloor);
    if (!range) return false;
    return exact >= range[0] && exact <= range[1];
  }

  function normalizeLineMapRow(row) {
    const input = row && typeof row === 'object' ? row : {};
    const dongToken = normalizeDongToken(input.dongToken || input.dong || input.building || '');
    const typeToken = normalizeTypeToken(input.typeToken || input.type || input.pyeongType || '');
    const lineToken = normalizeLineToken(input.lineToken || input.line || input.unitLine || '');
    return {
      dongToken,
      typeToken,
      lineToken,
      directionToken: normalizeDirectionToken(
        input.directionToken ||
        input.direction ||
        input.directionName ||
        input.directionTypeName ||
        input.directionBaseTypeName ||
        input.houseDirection ||
        input.hoDirection ||
        input.hoDir ||
        input.dir ||
        input.orientation ||
        ''
      ),
      directHoToken: normalizeHoToken(input.directHoToken || input.directHo || ''),
      sourceField: normalizeText(input.sourceField || '').replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 40),
      floorValue: Number(input.floorValue || 0),
      minFloor: Number(input.minFloor || input.floorMin || 0),
      maxFloor: Number(input.maxFloor || input.floorMax || 0),
      numberingScheme: String(input.numberingScheme || ''),
      source: normalizeText(input.source || ''),
      landPriceAnomaly: Boolean(input.landPriceAnomaly),
      pyeongNo: normalizePyeongNoToken(input.pyeongNo || input.ptpNo || input.pyeongTypeNo || ''),
      exclusiveSpace: normalizeAreaValue(
        input.exclusiveSpace ||
        input.exclusiveArea ||
        input.excluseSpc ||
        input.realArea ||
        input.spc2 ||
        0
      )
    };
  }

  function normalizeHoToken(value) {
    const digits = normalizeText(value).replace(/[^0-9]/g, '');
    if (!/^\d{2,4}$/.test(digits)) return '';
    return `${Number(digits) || digits}${HO}`;
  }

  function emptyResult(status, reason) {
    return {
      status,
      reason,
      confirmed: false,
      displayCandidate: '',
      candidateCount: 0,
      candidateDisplays: [],
      candidateStats: [],
      candidateProvenance: [],
      typeGroupStats: [],
      candidateGroupStats: [],
      typeFamilyGroupStats: [],
      dongGroupStats: [],
      lineTokens: [],
      typeToken: ''
    };
  }

  function withDiagnostics(result, diagnostics) {
    const input = diagnostics || {};
    return Object.assign({}, result, {
      rowCount: Math.max(0, Number(input.rowCount || 0) || 0),
      dongMatchCount: Math.max(0, Number(input.dongMatchCount || 0) || 0),
      typeMatchCount: Math.max(0, Number(input.typeMatchCount || 0) || 0),
      floorMatchCount: Math.max(0, Number(input.floorMatchCount || 0) || 0),
      directionMatchCount: Math.max(0, Number(input.directionMatchCount || 0) || 0),
      directionHeuristicMatchCount: Math.max(0, Number(input.directionHeuristicMatchCount || 0) || 0),
      landPriceAnomalyMatchCount: Math.max(0, Number(input.landPriceAnomalyMatchCount || 0) || 0),
      areaMatchCount: Math.max(0, Number(input.areaMatchCount || 0) || 0),
      pyeongNoMatchCount: Math.max(0, Number(input.pyeongNoMatchCount || 0) || 0),
      pyeongNoSuppressedSingleCandidate: Boolean(input.pyeongNoSuppressedSingleCandidate),
      pyeongNoInputCandidateCount: Math.max(0, Number(input.pyeongNoInputCandidateCount || 0) || 0),
      pyeongNoFilteredCandidateCount: Math.max(0, Number(input.pyeongNoFilteredCandidateCount || 0) || 0),
      typeGroupStats: Array.isArray(input.typeGroupStats) ? input.typeGroupStats.slice(0, 24) : [],
      candidateGroupStats: Array.isArray(input.candidateGroupStats) ? input.candidateGroupStats.slice(0, 24) : [],
      typeFamilyGroupStats: Array.isArray(input.typeFamilyGroupStats) ? input.typeFamilyGroupStats.slice(0, 24) : [],
      dongGroupStats: Array.isArray(input.dongGroupStats) ? input.dongGroupStats.slice(0, 24) : []
    });
  }

  function uniqueSorted(values) {
    return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko'));
  }

  function safeGroupSource(value) {
    return normalizeText(value).replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 40);
  }

  function lineMapSourceLabel(row) {
    const source = safeGroupSource(row && row.source || '') || 'unknown';
    return `naver-line-map:${source}`;
  }

  function lineMapSourceField(row) {
    if (row && row.directHoToken) {
      return safeGroupSource(row.sourceField || '') || 'hoNo/hoName';
    }
    return 'hoFloor+lineNo';
  }

  function candidateDisplayFromRow(row, dongToken, floorValue) {
    if (!row) return '';
    const candidateFloor = floorValue > 0 ? floorValue : Number(row.floorValue || 0);
    if (row.directHoToken) return `${dongToken} ${row.directHoToken}`;
    const hoToken = hoFromFloorAndLine(candidateFloor, row.lineToken, row.numberingScheme);
    return hoToken ? `${dongToken} ${hoToken}` : '';
  }

  function candidateDisplaysFromRows(rows, dongToken, floorValue) {
    return uniqueSorted((Array.isArray(rows) ? rows : [])
      .map((row) => candidateDisplayFromRow(row, dongToken, floorValue)));
  }

  function candidateGuardSummary(row, context) {
    const input = context || {};
    const floorValue = Number(input.floorValue || 0);
    const exclusiveSpace = normalizeAreaValue(input.exclusiveSpace || 0);
    const pyeongNo = normalizePyeongNoToken(input.pyeongNo || '');
    const directionToken = normalizeDirectionToken(input.directionToken || '');
    const guardsPassed = ['dong', 'type'];
    const guardsMissing = ['group-or-provider-proof'];
    if (floorValue > 0) {
      guardsPassed.push('exact-floor');
    } else {
      guardsPassed.push('floor-band-range');
      guardsMissing.push('exact-floor-proof');
    }
    if (row && row.directHoToken) guardsPassed.push('direct-ho-field');
    if (row && row.landPriceAnomaly) guardsPassed.push('landprice-anomaly');
    if (exclusiveSpace > 0 && row && areaMatches(row.exclusiveSpace, exclusiveSpace)) guardsPassed.push('exclusive-area');
    if (pyeongNo && row && normalizePyeongNoToken(row.pyeongNo) === pyeongNo) guardsPassed.push('pyeongNo');
    if (directionToken && row && normalizeDirectionToken(row.directionToken) === directionToken) guardsPassed.push('direction');
    if (!pyeongNo) guardsMissing.push('pyeongNo-context');
    if (!(exclusiveSpace > 0)) guardsMissing.push('exclusive-area-context');
    return { guardsPassed, guardsMissing };
  }

  function candidateProvenanceRows(rows, dongToken, context, statusReason) {
    const floorValue = Number(context && context.floorValue || 0);
    const byDisplay = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
      const displayCandidate = candidateDisplayFromRow(row, dongToken, floorValue);
      if (!displayCandidate || byDisplay.has(displayCandidate)) continue;
      const guardSummary = candidateGuardSummary(row, context);
      byDisplay.set(displayCandidate, {
        displayCandidate,
        sourceFamily: 'naver-line-map',
        sourceRoute: lineMapSourceLabel(row),
        sourceField: lineMapSourceField(row),
        articleBinding: 'active-detail-context',
        finalEligible: false,
        finalBlocker: statusReason || 'needs-land-line-promotion',
        guardsPassed: guardSummary.guardsPassed,
        guardsMissing: guardSummary.guardsMissing,
        floorValue: floorValue > 0 ? floorValue : Number(row.floorValue || 0) || 0,
        lineNo: lineNumber(row.lineToken),
        typeToken: row.typeToken || '',
        directHo: Boolean(row.directHoToken),
        landPriceAnomaly: Boolean(row.landPriceAnomaly)
      });
    }
    return Array.from(byDisplay.values())
      .sort((left, right) => String(left.displayCandidate || '').localeCompare(String(right.displayCandidate || ''), 'ko'))
      .slice(0, 24);
  }

  function lineGroupStats(rows) {
    const groups = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
      const lineNo = lineNumber(row && row.lineToken);
      if (!(lineNo > 0)) continue;
      const typeToken = normalizeTypeToken(row.typeToken || '') || '';
      const source = safeGroupSource(row.source || '');
      const directHo = Boolean(row.directHoToken);
      const landPriceAnomaly = Boolean(row.landPriceAnomaly);
      const directionToken = normalizeDirectionToken(row.directionToken || '');
      const key = [typeToken, lineNo, source, directHo ? 1 : 0, landPriceAnomaly ? 1 : 0, directionToken].join('|');
      if (!groups.has(key)) {
        groups.set(key, {
          typeToken,
          lineNo,
          count: 0,
          floorMin: 0,
          floorMax: 0,
          source,
          directHo,
          landPriceAnomaly,
          directionToken
        });
      }
      const group = groups.get(key);
      group.count += 1;
      const floor = Number(row.floorValue || 0) || 0;
      if (floor > 0) {
        group.floorMin = group.floorMin > 0 ? Math.min(group.floorMin, floor) : floor;
        group.floorMax = Math.max(group.floorMax, floor);
      }
    }
    return Array.from(groups.values())
      .sort((left, right) => (
        String(left.typeToken).localeCompare(String(right.typeToken), 'ko') ||
        Number(left.lineNo || 0) - Number(right.lineNo || 0) ||
        Number(left.floorMin || 0) - Number(right.floorMin || 0) ||
        String(left.source || '').localeCompare(String(right.source || ''), 'ko')
      ))
      .slice(0, 24);
  }

  function typeNumbersCompatible(rowType, contextType) {
    const row = typeTokenParts(rowType);
    const context = typeTokenParts(contextType);
    return Boolean(row && context && row.number === context.number);
  }

  function selectOriginalLandPriceAnomalyRows(rows, floorValue, floorBand, totalFloor) {
    if (floorValue > 0 || !floorBand || !(Number(totalFloor) > 0)) return [];
    return [];
  }

  function filterRowsByExclusiveArea(rows, exclusiveSpace) {
    const area = normalizeAreaValue(exclusiveSpace);
    if (!(area > 0)) return { rows, matchCount: 0, rejectedAll: false };
    const withArea = rows.filter((row) => normalizeAreaValue(row.exclusiveSpace) > 0);
    if (withArea.length === 0) return { rows, matchCount: 0, rejectedAll: false };
    const matched = withArea.filter((row) => areaMatches(row.exclusiveSpace, area));
    if (matched.length > 0) return { rows: matched, matchCount: matched.length, rejectedAll: false };
    const unknownOnly = rows.filter((row) => !(normalizeAreaValue(row.exclusiveSpace) > 0));
    return { rows: unknownOnly, matchCount: 0, rejectedAll: unknownOnly.length === 0 };
  }

  function filterRowsByPyeongNo(rows, pyeongNo) {
    const token = normalizePyeongNoToken(pyeongNo);
    if (!token) return { rows, matchCount: 0, rejectedAll: false };
    const withPyeongNo = rows.filter((row) => normalizePyeongNoToken(row.pyeongNo));
    if (withPyeongNo.length === 0) return { rows, matchCount: 0, rejectedAll: false };
    const matched = withPyeongNo.filter((row) => normalizePyeongNoToken(row.pyeongNo) === token);
    if (matched.length > 0) return { rows: matched, matchCount: matched.length, rejectedAll: false };
    const unknownOnly = rows.filter((row) => !normalizePyeongNoToken(row.pyeongNo));
    return { rows: unknownOnly, matchCount: 0, rejectedAll: unknownOnly.length === 0 };
  }

  function directHoEvidenceKey(row) {
    const source = safeGroupSource(row && row.source || '') || 'source';
    const field = safeGroupSource(row && row.sourceField || '') || 'field';
    return `${source}:${field}`;
  }

  function selectCorroboratedDirectHoRows(rows, dongToken, floorValue) {
    const groups = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
      if (!row || !row.directHoToken) continue;
      if (floorValue > 0 && Number(row.floorValue || 0) !== floorValue) continue;
      const displayCandidate = candidateDisplayFromRow(row, dongToken, floorValue);
      if (!displayCandidate) continue;
      if (!groups.has(displayCandidate)) {
        groups.set(displayCandidate, {
          displayCandidate,
          rows: [],
          evidenceKeys: new Set()
        });
      }
      const group = groups.get(displayCandidate);
      group.rows.push(row);
      group.evidenceKeys.add(directHoEvidenceKey(row));
    }

    const ranked = Array.from(groups.values())
      .map((group) => ({
        displayCandidate: group.displayCandidate,
        rows: group.rows,
        score: Math.max(group.rows.length, group.evidenceKeys.size),
        distinctEvidenceCount: group.evidenceKeys.size
      }))
      .sort((left, right) => (
        Number(right.score || 0) - Number(left.score || 0) ||
        Number(right.distinctEvidenceCount || 0) - Number(left.distinctEvidenceCount || 0) ||
        String(left.displayCandidate || '').localeCompare(String(right.displayCandidate || ''), 'ko')
      ));

    const winner = ranked[0];
    const runnerUp = ranked[1];
    if (
      !winner ||
      Number(winner.distinctEvidenceCount || 0) < 2 ||
      Number(winner.score || 0) <= Number(runnerUp && runnerUp.score || 0)
    ) {
      return { rows: [], displayCandidate: '', score: 0, distinctEvidenceCount: 0 };
    }
    return {
      rows: winner.rows,
      displayCandidate: winner.displayCandidate,
      score: winner.score,
      distinctEvidenceCount: winner.distinctEvidenceCount
    };
  }

  function contextLineNoFromPyeongNo(pyeongNo) {
    const token = normalizePyeongNoToken(pyeongNo);
    if (!/^\d{1,2}$/.test(token)) return 0;
    const number = Number(token);
    return number > 0 && number < 30 ? number : 0;
  }

  function selectContextPyeongLineDirectHoRows(rows, dongToken, floorValue, pyeongNo) {
    const lineNo = contextLineNoFromPyeongNo(pyeongNo);
    if (!(lineNo > 0)) {
      return { rows: [], displayCandidate: '', score: 0, distinctEvidenceCount: 0 };
    }
    const matched = (Array.isArray(rows) ? rows : []).filter((row) => (
      row &&
      row.directHoToken &&
      safeGroupSource(row.source || '') === 'naver-house-number-map' &&
      lineNumber(row.lineToken) === lineNo &&
      (!(floorValue > 0) || Number(row.floorValue || 0) === floorValue)
    ));
    const displays = uniqueSorted(matched.map((row) => candidateDisplayFromRow(row, dongToken, floorValue)));
    if (displays.length !== 1) {
      return { rows: [], displayCandidate: '', score: 0, distinctEvidenceCount: 0 };
    }
    const evidenceKeys = new Set(matched.map(directHoEvidenceKey).filter(Boolean));
    return {
      rows: matched,
      displayCandidate: displays[0],
      score: matched.length,
      distinctEvidenceCount: Math.max(1, evidenceKeys.size)
    };
  }

  function selectMatchedPyeongDirectHoRows(rows, dongToken, floorValue, pyeongNo) {
    const token = normalizePyeongNoToken(pyeongNo);
    if (!token || !(Number(floorValue) > 0)) {
      return { rows: [], displayCandidate: '', score: 0, distinctEvidenceCount: 0 };
    }
    const matched = (Array.isArray(rows) ? rows : []).filter((row) => (
      row &&
      row.directHoToken &&
      safeGroupSource(row.source || '') === 'naver-house-number-map' &&
      normalizePyeongNoToken(row.pyeongNo) === token &&
      Number(row.floorValue || 0) === Number(floorValue || 0)
    ));
    const displays = uniqueSorted(matched.map((row) => candidateDisplayFromRow(row, dongToken, floorValue)));
    if (displays.length !== 1) {
      return { rows: [], displayCandidate: '', score: 0, distinctEvidenceCount: 0 };
    }
    const evidenceKeys = new Set(matched.map(directHoEvidenceKey).filter(Boolean));
    return {
      rows: matched,
      displayCandidate: displays[0],
      score: matched.length,
      distinctEvidenceCount: Math.max(1, evidenceKeys.size)
    };
  }

  function buildLineInference(input) {
    const data = input && typeof input === 'object' ? input : {};
    const context = data.context && typeof data.context === 'object' ? data.context : {};
    const dongToken = normalizeDongToken(context.dongToken || context.detailDongToken || '');
    const floorValue = Number(context.floorValue || context.detailFloorValue || 0);
    const floorBand = String(context.floorBand || context.detailFloorBand || '');
    const totalFloor = Number(context.totalFloor || context.detailTotalFloor || 0);
    const typeToken = normalizeTypeToken(context.typeToken || context.detailTypeToken || context.pyeongType || '');
    const directionToken = normalizeDirectionToken(context.directionToken || context.detailDirectionToken || context.direction || '');
    const exclusiveSpace = normalizeAreaValue(
      context.exclusiveSpace ||
      context.detailExclusiveSpace ||
      context.exclusiveArea ||
      context.detailExclusiveArea ||
      context.areaExclusive ||
      0
    );
    const pyeongNo = normalizePyeongNoToken(
      context.pyeongNo ||
      context.ptpNo ||
      context.detailPyeongNo ||
      context.detailPtpNo ||
      ''
    );

    const rows = (Array.isArray(data.lineMapRows) ? data.lineMapRows : []).map(normalizeLineMapRow);
    const baseDiagnostics = { rowCount: rows.length };

    if (!dongToken) return withDiagnostics(emptyResult('missing-context', 'missing-dong'), baseDiagnostics);
    if (!typeToken) return withDiagnostics(emptyResult('missing-context', 'missing-type'), baseDiagnostics);
    if (rows.length === 0) return withDiagnostics(emptyResult('no-map', 'missing-line-map'), baseDiagnostics);

    const dongMatches = rows.filter((row) => row.dongToken === dongToken);
    const typeFamilyMatches = dongMatches.filter((row) => typeNumbersCompatible(row.typeToken, typeToken));
    const typeMatches = dongMatches.filter((row) => typeTokensCompatible(row.typeToken, typeToken));
    const floorMatchesRows = typeMatches.filter((row) => (
      row.lineToken &&
      (floorValue > 0
        ? floorMatches(row, floorValue)
        : rowExactFloorAllowed(row, floorBand, totalFloor))
    ));
    const areaFiltered = filterRowsByExclusiveArea(floorMatchesRows, exclusiveSpace);
    const pyeongNoForCandidateFilter = floorValue > 0 ? pyeongNo : '';
    const rawPyeongFiltered = filterRowsByPyeongNo(areaFiltered.rows, pyeongNoForCandidateFilter);
    const areaCandidateDisplays = candidateDisplaysFromRows(areaFiltered.rows, dongToken, floorValue);
    const pyeongCandidateDisplays = candidateDisplaysFromRows(rawPyeongFiltered.rows, dongToken, floorValue);
    const pyeongNoSuppressedSingleCandidate = Boolean(
      pyeongNo &&
      rawPyeongFiltered.matchCount > 0 &&
      areaCandidateDisplays.length > 1 &&
      pyeongCandidateDisplays.length === 1
    );
    const pyeongFiltered = pyeongNoSuppressedSingleCandidate
      ? Object.assign({}, rawPyeongFiltered, { rows: areaFiltered.rows, rejectedAll: false })
      : rawPyeongFiltered;
    const pyeongSoftMismatch = Boolean(pyeongFiltered.rejectedAll);
    const pyeongRows = pyeongSoftMismatch ? areaFiltered.rows : pyeongFiltered.rows;
    const matchedPyeongDirectHo = pyeongNoSuppressedSingleCandidate
      ? { rows: [], displayCandidate: '', score: 0, distinctEvidenceCount: 0 }
      : selectMatchedPyeongDirectHoRows(pyeongRows, dongToken, floorValue, pyeongNo);
    const pyeongNoStillAmbiguous = Boolean(
      pyeongNo &&
      pyeongFiltered.matchCount > 0 &&
      matchedPyeongDirectHo.rows.length === 0
    );
    const corroboratedDirectHo = (pyeongSoftMismatch || pyeongNoStillAmbiguous || pyeongNoSuppressedSingleCandidate)
      ? selectCorroboratedDirectHoRows(areaFiltered.rows, dongToken, floorValue)
      : { rows: [], displayCandidate: '', score: 0 };
    const pyeongLineDirectHo = { rows: [], displayCandidate: '', score: 0, distinctEvidenceCount: 0 };
    const usingCorroboratedDirectHo = (
      pyeongSoftMismatch ||
      pyeongNoStillAmbiguous ||
      pyeongNoSuppressedSingleCandidate
    ) && corroboratedDirectHo.rows.length > 0;
    const usingPyeongLineDirectHo = false;
    const usingMatchedPyeongDirectHo = !pyeongSoftMismatch && matchedPyeongDirectHo.rows.length > 0;
    const matches = usingMatchedPyeongDirectHo
      ? matchedPyeongDirectHo.rows
      : usingCorroboratedDirectHo
      ? corroboratedDirectHo.rows
      : pyeongRows;
    const directHoMatches = matches.filter((row) => row.directHoToken);
    const exactDirectHoMatches = directHoMatches.filter((row) => typeTokensExact(row.typeToken, typeToken));
    const strongExactDirectHoMatches = exactDirectHoMatches.filter((row) => safeGroupSource(row.source || row.sourceField || ''));
    const exactTypeMatches = matches.filter((row) => typeTokensExact(row.typeToken, typeToken));
    const anomalyMatches = selectOriginalLandPriceAnomalyRows(matches, floorValue, floorBand, totalFloor);
    const proofMatches = strongExactDirectHoMatches.length > 0
      ? strongExactDirectHoMatches
      : anomalyMatches.length > 0
        ? anomalyMatches
        : exactDirectHoMatches.length > 0
        ? exactDirectHoMatches
        : directHoMatches.length > 0
          ? directHoMatches
          : exactTypeMatches.length > 0
            ? exactTypeMatches
            : matches;
    const directionCapable = directionToken ? proofMatches.filter((row) => row.directionToken) : [];
    const directionCoverageComplete = directionCapable.length > 0 && directionCapable.length === proofMatches.length;
    const matchedDirectionRows = directionToken
      ? proofMatches.filter((row) => row.directionToken === directionToken)
      : [];
    const directionHeuristic = directionCoverageComplete || directionCapable.length > 0
      ? { rows: proofMatches, matchCount: 0 }
      : originalDirectionLineHeuristicRows(proofMatches, directionToken);
    const directionMatches = directionCoverageComplete
      ? proofMatches.filter((row) => row.directionToken === directionToken)
      : directionHeuristic.rows;
    const diagnostics = {
      rowCount: rows.length,
      dongMatchCount: dongMatches.length,
      typeMatchCount: typeMatches.length,
      floorMatchCount: floorMatchesRows.length,
      directionMatchCount: matchedDirectionRows.length,
      directionHeuristicMatchCount: directionHeuristic.matchCount,
      landPriceAnomalyMatchCount: anomalyMatches.length,
      areaMatchCount: areaFiltered.matchCount,
      pyeongNoMatchCount: pyeongFiltered.matchCount,
      pyeongNoSuppressedSingleCandidate,
      pyeongNoInputCandidateCount: areaCandidateDisplays.length,
      pyeongNoFilteredCandidateCount: pyeongCandidateDisplays.length,
      directHoEvidenceCount: usingCorroboratedDirectHo
        ? Number(corroboratedDirectHo.distinctEvidenceCount || 0)
        : usingMatchedPyeongDirectHo
          ? Number(matchedPyeongDirectHo.distinctEvidenceCount || 0)
        : usingPyeongLineDirectHo
          ? Number(pyeongLineDirectHo.distinctEvidenceCount || 0)
        : 0,
      typeGroupStats: lineGroupStats(typeMatches),
      candidateGroupStats: lineGroupStats(directionMatches),
      typeFamilyGroupStats: lineGroupStats(typeFamilyMatches),
      dongGroupStats: lineGroupStats(dongMatches)
    };
    if (!(floorValue > 0) && floorMatchesRows.length === 0) {
      return withDiagnostics(emptyResult('missing-context', 'missing-floor'), diagnostics);
    }
    if (areaFiltered.rejectedAll) {
      return withDiagnostics({
        ...emptyResult('no-match', 'line-area-no-match'),
        typeToken
      }, diagnostics);
    }
    if (matches.length === 0) {
      return withDiagnostics({
        ...emptyResult('no-match', 'line-type-no-match'),
        typeToken
      }, diagnostics);
    }
    if (directionCoverageComplete && directionMatches.length === 0) {
      return withDiagnostics({
        ...emptyResult('no-match', 'line-direction-no-match'),
        typeToken
      }, diagnostics);
    }

    const effectiveMatches = directionMatches;
    const candidateStats = effectiveMatches.slice(0, 80).map((row) => ({
      floorValue: floorValue > 0 ? floorValue : Number(row.floorValue || 0) || 0,
      lineNo: lineNumber(row.lineToken),
      typeToken: row.typeToken || '',
      source: row.source || '',
      sourceField: row.sourceField || '',
      directHo: Boolean(row.directHoToken),
      landPriceAnomaly: Boolean(row.landPriceAnomaly)
    }));
    const candidateDisplays = uniqueSorted(effectiveMatches
      .map((row) => candidateDisplayFromRow(row, dongToken, floorValue)));
    const lineTokens = uniqueSorted(effectiveMatches.map((row) => row.lineToken));
    const provenanceContext = { floorValue, exclusiveSpace, pyeongNo, directionToken };

    if (candidateDisplays.length === 0) {
      return withDiagnostics({
        status: 'line-only',
        reason: 'numbering-scheme-unverified',
        confirmed: false,
        displayCandidate: '',
        candidateCount: lineTokens.length,
        candidateDisplays: [],
        candidateStats,
        candidateProvenance: [],
        lineTokens,
        typeToken
      }, diagnostics);
    }

    if (candidateDisplays.length === 1) {
      const reason = usingCorroboratedDirectHo
        ? 'line-type-corroborated-direct-ho'
        : usingMatchedPyeongDirectHo
          ? 'line-pyeong-no-line-direct-ho'
        : usingPyeongLineDirectHo
          ? 'line-pyeong-no-line-direct-ho'
        : pyeongSoftMismatch
          ? 'line-pyeong-soft-mismatch-single-estimated'
        : 'line-type-single-estimated';
      return withDiagnostics({
        status: 'single-estimated',
        reason,
        confirmed: false,
        displayCandidate: candidateDisplays[0],
        candidateCount: 1,
        candidateDisplays,
        candidateStats,
        candidateProvenance: candidateProvenanceRows(effectiveMatches, dongToken, provenanceContext, 'needs-land-line-promotion'),
        lineTokens,
        typeToken,
        directHoEvidenceCount: usingCorroboratedDirectHo
          ? Number(corroboratedDirectHo.distinctEvidenceCount || 0)
          : usingMatchedPyeongDirectHo
            ? Number(matchedPyeongDirectHo.distinctEvidenceCount || 0)
          : usingPyeongLineDirectHo
            ? Number(pyeongLineDirectHo.distinctEvidenceCount || 0)
          : 0
      }, diagnostics);
    }

    const reason = pyeongSoftMismatch ? 'line-pyeong-soft-mismatch-multiple' : 'line-type-multiple';
    return withDiagnostics({
      status: 'multiple-candidates',
      reason,
      confirmed: false,
      displayCandidate: '',
      candidateCount: candidateDisplays.length,
      candidateDisplays,
      candidateStats,
      candidateProvenance: candidateProvenanceRows(effectiveMatches, dongToken, provenanceContext, 'line-candidate-not-unique'),
      lineTokens,
      typeToken,
      directHoEvidenceCount: usingCorroboratedDirectHo
        ? Number(corroboratedDirectHo.distinctEvidenceCount || 0)
        : 0
    }, diagnostics);
  }

  const api = {
    buildLineInference,
    normalizeTypeToken,
    typeTokensCompatible,
    normalizeLineToken,
    normalizeDirectionToken,
    normalizeDongToken,
    normalizeHoToken
  };

  globalScope.DHS_LINE_INFERENCE = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
