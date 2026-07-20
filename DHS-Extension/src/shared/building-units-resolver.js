(function exposeBuildingUnitsResolver(globalScope) {
  const VERSION = '0.1.1';
  const DONG = '\uB3D9';
  const HO = '\uD638';
  const MAX_ROWS = 600;
  const MAX_ARRAY_ITEMS = 320;
  const MAX_OBJECT_VALUES = 180;
  const MAX_DEPTH = 10;

  const ARTICLE_FIELDS = [
    'articleNo',
    'atclNo',
    'atclNoStr',
    'articleId',
    'articleID',
    'detailCode',
    'naverArticleNo',
    'articleNumber',
    'representativeArticleNo'
  ];
  const HO_FIELDS = [
    'hoNm',
    'hoName',
    'hoNo',
    'houseNo',
    'roomNo',
    'unitName',
    'unitNo',
    'unitNumber',
    'ho'
  ];
  const FLOOR_FIELDS = [
    'hoFloor',
    'unitFloor',
    'floor',
    'floorNo',
    'floorNm',
    'currentFloor',
    'Floor1',
    'Floor2',
    'FloorName'
  ];
  const LINE_FIELDS = [
    'lineNo',
    'line',
    'unitLine',
    'hoLine',
    'lineNumber'
  ];

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function primitiveText(value) {
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    return '';
  }

  function firstPrimitive(object, fields) {
    for (const field of fields) {
      const value = primitiveText(object && object[field]);
      if (normalizeText(value)) return value;
    }
    return '';
  }

  function hashArticleMarker(value) {
    const input = String(value || '');
    let hash = 0x811c9dc5;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return `article:${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }

  function safeArticleMarker(value) {
    const marker = String(value || '');
    return /^article:[a-f0-9]{8,12}$/.test(marker) ? marker : '';
  }

  function safeNumericId(value) {
    const text = String(value || '').replace(/[^0-9]/g, '');
    return /^\d{4,24}$/.test(text) ? text : '';
  }

  function articleMarkersFromObject(object, inheritedMarkers) {
    const markers = new Set(Array.isArray(inheritedMarkers) ? inheritedMarkers.filter(Boolean) : []);
    for (const field of ARTICLE_FIELDS) {
      const id = safeNumericId(primitiveText(object && object[field]));
      if (id) markers.add(hashArticleMarker(id));
    }
    return Array.from(markers);
  }

  function normalizeDongToken(value) {
    const text = normalizeText(value);
    const match = text.match(new RegExp(`(?<!\\d)(\\d{1,4})\\s*${DONG}`));
    return match ? `${Number(match[1]) || match[1]}${DONG}` : '';
  }

  function safeNumericDongToken(value) {
    const text = normalizeText(value).replace(/[^0-9]/g, '');
    if (!/^\d{3,4}$/.test(text)) return '';
    return `${Number(text) || text}${DONG}`;
  }

  function normalizeTypeToken(value) {
    const text = normalizeText(value).toUpperCase();
    const matches = Array.from(text.matchAll(/(?<!\d)(0?\d{2,3})(?:\.\d{1,4})?\s*([A-Z]{0,3})(?![A-Z0-9])/g));
    const candidates = matches
      .map((match) => {
        const number = Number(match[1]);
        if (!Number.isFinite(number) || number < 10 || number > 299) return '';
        return `${number}${match[2] || ''}`;
      })
      .filter(Boolean);
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
    if (!row || !context) return true;
    if (row.token === context.token) return true;
    if (row.number !== context.number) return false;
    return !row.suffix || !context.suffix;
  }

  function normalizeHoToken(value) {
    const digits = normalizeText(value).replace(/[^0-9]/g, '');
    if (!/^\d{2,4}$/.test(digits)) return '';
    return `${Number(digits) || digits}${HO}`;
  }

  function hoDigits(hoToken) {
    return normalizeText(hoToken).replace(/[^0-9]/g, '');
  }

  function lineNumberFromObject(object) {
    const raw = firstPrimitive(object, LINE_FIELDS);
    const match = normalizeText(raw).match(/\d{1,2}/);
    if (!match) return 0;
    const number = Number(match[0]);
    return number > 0 && number < 100 ? number : 0;
  }

  function hoFromFloorAndLine(floor, lineNo) {
    const floorNumber = Number(floor || 0);
    const lineNumber = Number(lineNo || 0);
    if (!(floorNumber > 0) || !(lineNumber > 0)) return '';
    return normalizeHoToken(`${floorNumber}${String(lineNumber).padStart(2, '0')}`);
  }

  function floorFromHoToken(hoToken) {
    const digits = hoDigits(hoToken);
    if (!/^\d{3,4}$/.test(digits)) return 0;
    const floorText = digits.slice(0, -2);
    const floor = Number(floorText);
    return floor > 0 && floor < 100 ? floor : 0;
  }

  function floorValue(value) {
    if (typeof value === 'number') {
      return Number.isInteger(value) && value > 0 && value < 100 ? value : 0;
    }
    const text = normalizeText(value);
    if (!text) return 0;
    if (/[\uC800\uC911\uACE0]/.test(text) || /(?:low|mid|middle|high)/i.test(text)) return 0;
    if (/(?:\uCD1D|\uCD5C\uACE0|\uC804\uCCB4)\s*\d{1,3}\s*\uCE35?/.test(text)) return 0;
    const slash = text.match(/^(\d{1,2})\s*\/\s*\d{1,3}\s*\uCE35?$/);
    const exact = slash || text.match(/^(\d{1,2})\s*\uCE35?$/);
    if (!exact) return 0;
    const number = Number(exact[1]);
    return number > 0 && number < 100 ? number : 0;
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

  function existHoAllowed(object) {
    if (!Object.prototype.hasOwnProperty.call(object || {}, 'existHo')) return true;
    const raw = object.existHo;
    if (raw === false || raw === 0) return false;
    const text = normalizeText(raw).toLowerCase();
    return !['false', 'n', 'no', '0'].includes(text);
  }

  function dongTokenFromObject(object, inheritedDong) {
    const explicit = firstPrimitive(object, [
      'displayDong',
      'buildingName',
      'dongName',
      'bldgNm',
      'bldNm',
      'buildingNm',
      'dongNm',
      'DONG_NM'
    ]);
    const explicitToken = normalizeDongToken(explicit) || safeNumericDongToken(explicit);
    if (explicitToken) return explicitToken;
    const numeric = firstPrimitive(object, ['buildingNo', 'bildNo', 'dong']);
    return safeNumericDongToken(numeric) || inheritedDong || '';
  }

  function pyeongKeyValues(object, fallbackKey) {
    const keys = [];
    for (const field of ['pyeongNo', 'ptpNo', 'pyeongTypeNo', 'pyeongTypeNumber']) {
      const value = normalizeText(primitiveText(object && object[field]));
      if (value) keys.push(`${field}:${value}`, value);
    }
    const fallback = normalizeText(fallbackKey);
    if (/^\d{1,8}$/.test(fallback)) keys.push(fallback);
    return keys;
  }

  function pyeongMetadataTypeToken(item) {
    return normalizeTypeToken(firstPrimitive(item, [
      'pyeongName',
      'pyeongTypeName',
      'pyeongType',
      'articleAreaName',
      'areaName',
      'spc2',
      'supplyArea',
      'totalArea',
      'exclusiveArea',
      'excluseSpc',
      'realArea'
    ]));
  }

  function isUnitRow(object) {
    return Boolean(firstPrimitive(object || {}, HO_FIELDS.concat([
      ...LINE_FIELDS,
      'existHo'
    ])));
  }

  function addPyeongIndexRow(index, item, fallbackKey) {
    if (!item || typeof item !== 'object') return;
    if (isUnitRow(item)) return;
    const typeToken = pyeongMetadataTypeToken(item);
    if (!typeToken) return;
    for (const key of pyeongKeyValues(item, fallbackKey)) index[key] = typeToken;
  }

  function pyeongIndexFromObject(object) {
    const index = {};
    for (const [childKey, child] of Object.entries(object || {}).slice(0, MAX_OBJECT_VALUES)) {
      if (Array.isArray(child)) {
        for (const item of child.slice(0, MAX_ARRAY_ITEMS)) addPyeongIndexRow(index, item, '');
        continue;
      }
      if (!child || typeof child !== 'object') continue;
      addPyeongIndexRow(index, child, childKey);
      for (const [entryKey, item] of Object.entries(child).slice(0, MAX_OBJECT_VALUES)) {
        addPyeongIndexRow(index, item, entryKey);
      }
    }
    return index;
  }

  function mergePyeongIndex(parentIndex, nextIndex) {
    if (!nextIndex || Object.keys(nextIndex).length === 0) return parentIndex || null;
    return Object.assign({}, parentIndex || {}, nextIndex);
  }

  function typeTokenFromObject(object, inheritedType, pyeongIndex) {
    const displayType = normalizeTypeToken(firstPrimitive(object, [
      'pyeongName',
      'pyeongTypeName',
      'pyeongType',
      'articleAreaName',
      'areaName',
      'spc2',
      'supplyArea',
      'totalArea',
      'exclusiveArea',
      'excluseSpc',
      'realArea'
    ]));
    if (displayType) return displayType;
    if (pyeongIndex) {
      for (const key of pyeongKeyValues(object)) {
        if (pyeongIndex[key]) return pyeongIndex[key];
      }
    }
    return inheritedType || '';
  }

  function hoFromObject(object) {
    for (const field of HO_FIELDS) {
      const token = normalizeHoToken(primitiveText(object && object[field]));
      if (token) return { token, sourceField: field };
    }
    return { token: '', sourceField: '' };
  }

  function floorFromObject(object, inheritedFloor, hoToken) {
    const explicit = floorValue(firstPrimitive(object, FLOOR_FIELDS));
    if (explicit) return explicit;
    const inherited = Number(inheritedFloor || 0);
    if (inherited > 0) return inherited;
    return floorFromHoToken(hoToken);
  }

  function pushRow(rows, row) {
    if (!row.hoToken || !row.dongToken || rows.length >= MAX_ROWS) return;
    rows.push({
      articleMarkers: row.articleMarkers || [],
      dongToken: row.dongToken,
      typeToken: row.typeToken || '',
      hoToken: row.hoToken,
      floorValue: Number(row.floorValue || 0) || 0,
      sourceField: row.sourceField || ''
    });
  }

  function walk(value, context, rows, depth) {
    if (!value || rows.length >= MAX_ROWS || depth > MAX_DEPTH) return;
    if (Array.isArray(value)) {
      for (const item of value.slice(0, MAX_ARRAY_ITEMS)) walk(item, context, rows, depth + 1);
      return;
    }
    if (typeof value !== 'object') return;

    const pyeongIndex = mergePyeongIndex(context.pyeongIndex, pyeongIndexFromObject(value));
    const articleMarkers = articleMarkersFromObject(value, context.articleMarkers);
    const next = {
      articleMarkers,
      dongToken: dongTokenFromObject(value, context.dongToken),
      typeToken: typeTokenFromObject(value, context.typeToken, pyeongIndex),
      floorValue: floorValue(firstPrimitive(value, FLOOR_FIELDS)) || Number(context.floorValue || 0) || 0,
      pyeongIndex
    };

    if (existHoAllowed(value)) {
      const ho = hoFromObject(value);
      const rowFloor = floorFromObject(value, next.floorValue, ho.token);
      const lineHoToken = ho.token || hoFromFloorAndLine(rowFloor, lineNumberFromObject(value));
      if (lineHoToken) {
        pushRow(rows, {
          articleMarkers: next.articleMarkers,
          dongToken: next.dongToken,
          typeToken: next.typeToken,
          hoToken: lineHoToken,
          floorValue: rowFloor,
          sourceField: ho.sourceField || 'lineNo'
        });
      }
    }

    for (const field of [
      'pyeongHoList',
      'hoList',
      'hoListOnFloor',
      'floorHoList',
      'houseList',
      'landPriceFloors',
      'landPrices',
      'buildingUnits',
      'buildingList',
      'floors',
      'data',
      'list'
    ]) {
      const child = value[field];
      if (child && typeof child === 'object') walk(child, next, rows, depth + 1);
    }

    for (const child of Object.values(value).slice(0, MAX_OBJECT_VALUES)) {
      if (child && typeof child === 'object') walk(child, next, rows, depth + 1);
    }
  }

  function dedupeRows(rows) {
    const seen = new Set();
    const result = [];
    for (const row of rows) {
      const key = [
        row.articleMarkers.join(','),
        row.dongToken,
        row.typeToken,
        row.hoToken,
        Number(row.floorValue || 0),
        row.sourceField
      ].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(row);
      if (result.length >= MAX_ROWS) break;
    }
    return result;
  }

  function collectBuildingUnitRows(body, context) {
    const rows = [];
    const inherited = context && typeof context === 'object' ? context : {};
    walk(body, {
      articleMarkers: [],
      dongToken: normalizeDongToken(inherited.dongToken || inherited.detailDongToken || '') || '',
      typeToken: normalizeTypeToken(inherited.typeToken || inherited.detailTypeToken || '') || '',
      floorValue: floorValue(inherited.floorValue || inherited.detailFloorValue || 0) || 0,
      pyeongIndex: null
    }, rows, 0);
    return dedupeRows(rows);
  }

  function contextMatches(row, context) {
    const dongToken = normalizeDongToken(context.dongToken || context.detailDongToken || '');
    if (dongToken && row.dongToken && row.dongToken !== dongToken) return false;

    const typeToken = normalizeTypeToken(context.typeToken || context.detailTypeToken || '');
    if (typeToken && row.typeToken && !typeTokensCompatible(row.typeToken, typeToken)) return false;

    const exactFloor = floorValue(context.floorValue || context.detailFloorValue || 0);
    if (exactFloor > 0 && row.floorValue > 0 && row.floorValue !== exactFloor) return false;

    const floorBand = String(context.floorBand || context.detailFloorBand || '');
    const totalFloor = Number(context.totalFloor || context.detailTotalFloor || 0) || 0;
    if (!(exactFloor > 0) && floorBand && totalFloor > 0 && row.floorValue > 0) {
      const range = bandRange(floorBand, totalFloor);
      if (range && (row.floorValue < range[0] || row.floorValue > range[1])) return false;
    }

    return true;
  }

  function displayCandidateFromRow(row) {
    return row && row.dongToken && row.hoToken ? `${row.dongToken} ${row.hoToken}` : '';
  }

  function empty(reason, stats) {
    const input = stats || {};
    return {
      present: false,
      displayCandidate: '',
      source: 'building-units-article-linked',
      certainty: '',
      reason: reason || 'not-resolved',
      rowCount: Number(input.rowCount || 0) || 0,
      articleLinkedCount: Number(input.articleLinkedCount || 0) || 0,
      candidateCount: Number(input.candidateCount || 0) || 0,
      floorValue: 0,
      typeToken: ''
    };
  }

  function resolveBuildingUnitsExact(body, context) {
    const input = context && typeof context === 'object' ? context : {};
    const articleMarker = safeArticleMarker(input.articleMarker);
    const rows = collectBuildingUnitRows(body, input);
    const rowCount = rows.length;
    if (!articleMarker) return empty('missing-article-marker', { rowCount });

    const linked = rows.filter((row) => row.articleMarkers.includes(articleMarker));
    if (linked.length === 0) return empty('no-article-linked-unit', { rowCount, articleLinkedCount: 0 });

    const candidates = linked.filter((row) => contextMatches(row, input));
    const stats = { rowCount, articleLinkedCount: linked.length, candidateCount: candidates.length };
    if (candidates.length === 0) return empty('context-mismatch', stats);

    const displayCandidates = Array.from(new Set(candidates.map(displayCandidateFromRow).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko'));
    if (displayCandidates.length !== 1) {
      return empty('multiple-candidates-unresolved', Object.assign({}, stats, { candidateCount: displayCandidates.length || candidates.length }));
    }

    const selected = candidates.find((row) => displayCandidateFromRow(row) === displayCandidates[0]) || candidates[0];
    return {
      present: true,
      displayCandidate: displayCandidates[0],
      source: 'building-units-article-linked',
      certainty: 'BUILDING_UNITS_EXACT',
      reason: 'article-linked-unit-single',
      rowCount,
      articleLinkedCount: linked.length,
      candidateCount: 1,
      floorValue: Number(selected.floorValue || 0) || floorFromHoToken(selected.hoToken),
      typeToken: selected.typeToken || normalizeTypeToken(input.typeToken || input.detailTypeToken || '')
    };
  }

  const api = {
    VERSION,
    hashArticleMarker,
    collectBuildingUnitRows,
    resolveBuildingUnitsExact
  };

  globalScope.DHS_BUILDING_UNITS_RESOLVER = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
