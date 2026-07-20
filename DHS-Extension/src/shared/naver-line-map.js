(function exposeNaverLineMap(globalScope) {
  const VERSION = '0.1.7';
  const DONG = '\uB3D9';
  const HO = '\uD638';
  const MAX_ROWS = 300;
  const MAX_ARRAY_ITEMS = 300;
  const MAX_OBJECT_VALUES = 160;
  const MAX_DEPTH = 9;
  const MAX_SHAPE_KEYS = 32;
  const MAX_SHAPE_PATHS = 20;
  const SHAPE_KEYS = new Set([
    'articleAreaName',
    'areaName',
    'buildingList',
    'buildingName',
    'buildingNo',
    'data',
    'displayDong',
    'direction',
    'directionBaseTypeName',
    'directionName',
    'directionTypeName',
    'dir',
    'dong',
    'dongName',
    'dongNm',
    'dongNo',
    'excluseSpc',
    'exclusiveArea',
    'floor',
    'floorCnt',
    'floorHoList',
    'floorNo',
    'hoFloor',
    'hoList',
    'hoListOnFloor',
    'hoName',
    'hoNo',
    'houseList',
    'landPriceFloors',
    'landPrices',
    'lineNo',
    'list',
    'pyeongHoList',
    'pyeongList',
    'pyeongName',
    'pyeongNo',
    'pyeongType',
    'pyeongTypeName',
    'ptpNo',
    'realArea',
    'roomNo',
    'orientation',
    'supplyArea',
    'totalArea',
    'unitNo',
    'unitNumber',
    'spc2'
  ]);

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function primitiveText(value) {
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    return '';
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

  function floorValue(value) {
    if (typeof value === 'number') {
      return Number.isInteger(value) && value > 0 && value < 100 ? value : 0;
    }
    const text = normalizeText(value);
    if (!text) return 0;
    if (/[저중고]/.test(text) || /총|전체|최고/i.test(text) || /\b(?:low|mid|middle|high)\b/i.test(text)) return 0;
    const slash = text.match(/^(\d{1,2})\s*\/\s*\d{1,2}\s*\uCE35?$/);
    const exact = slash || text.match(/^(\d{1,2})\s*\uCE35?$/);
    if (!exact) return 0;
    const number = Number(exact[1]);
    return number > 0 && number < 100 ? number : 0;
  }

  function normalizeLineToken(value) {
    const text = normalizeText(value);
    const match = text.match(/\d{1,2}/);
    if (!match) return '';
    const number = Number(match[0]);
    return number > 0 && number < 100 ? `${number}${HO}` : '';
  }

  function normalizeDirectionToken(value) {
    const text = normalizeText(value);
    if (!text) return '';
    const tokens = [
      '\uB0A8\uB3D9\uD5A5',
      '\uB0A8\uC11C\uD5A5',
      '\uBD81\uB3D9\uD5A5',
      '\uBD81\uC11C\uD5A5',
      '\uB0A8\uD5A5',
      '\uB3D9\uD5A5',
      '\uBD81\uD5A5',
      '\uC11C\uD5A5'
    ];
    return tokens.find((token) => text.includes(token)) || '';
  }

  function lineTokenFromHo(value, floor) {
    const digits = normalizeText(value).replace(/[^0-9]/g, '');
    const floorNumber = Number(floor || 0);
    if (!/^\d{2,4}$/.test(digits) || !(floorNumber > 0)) return '';
    const floorText = String(floorNumber);
    if (digits.startsWith(floorText) && digits.length > floorText.length) {
      return normalizeLineToken(digits.slice(floorText.length));
    }
    if (digits.length >= 3) {
      return normalizeLineToken(String(Number(digits) % 100));
    }
    return '';
  }

  function existHoAllowed(value) {
    if (!Object.prototype.hasOwnProperty.call(value || {}, 'existHo')) return true;
    const raw = value.existHo;
    if (raw === false || raw === 0) return false;
    const text = normalizeText(raw).toLowerCase();
    return !['false', 'n', 'no', '0'].includes(text);
  }

  function firstPrimitive(object, fields) {
    for (const field of fields) {
      const value = primitiveText(object[field]);
      if (value) return value;
    }
    return '';
  }

  function normalizePyeongNoToken(value) {
    const text = normalizeText(value);
    if (!text) return '';
    return text.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
  }

  function pyeongNoFromObject(object) {
    return normalizePyeongNoToken(firstPrimitive(object || {}, [
      'pyeongNo',
      'ptpNo',
      'pyeongTypeNo',
      'pyeongTypeNumber'
    ]));
  }

  function numericArea(value) {
    if (typeof value === 'number') {
      return Number.isFinite(value) && value > 0 && value < 400 ? value : 0;
    }
    const text = normalizeText(value).replace(/,/g, '');
    const match = text.match(/(?<!\d)(\d{1,3}(?:\.\d{1,4})?)(?!\d)/);
    if (!match) return 0;
    const number = Number(match[1]);
    return Number.isFinite(number) && number > 0 && number < 400 ? number : 0;
  }

  function areaMetadataFromObject(object) {
    const exclusiveSpace = numericArea(firstPrimitive(object || {}, [
      'exclusiveSpace',
      'exclusiveArea',
      'excluseSpc',
      'realArea',
      'spc2'
    ]));
    const totalArea = numericArea(firstPrimitive(object || {}, [
      'totalArea',
      'supplyArea',
      'area'
    ]));
    return { exclusiveSpace, totalArea };
  }

  function dongTokenFromObject(object, inheritedDong) {
    const explicit = firstPrimitive(object, [
      'displayDong',
      'buildingName',
      'dongName',
      'bldgNm',
      'bldNm',
      'buildingNm',
      'dongNm'
    ]);
    const explicitToken = normalizeDongToken(explicit) || safeNumericDongToken(explicit);
    if (explicitToken) return explicitToken;

    const numeric = firstPrimitive(object, ['buildingNo', 'bildNo', 'dong']);
    return safeNumericDongToken(numeric) || inheritedDong || '';
  }

  function typeTokenFromObject(object, inheritedType, inheritedPyeongNo) {
    const displayType = normalizeTypeToken(firstPrimitive(object, [
      'pyeongName',
      'pyeongTypeName',
      'pyeongType',
      'articleAreaName',
      'areaName'
    ]));
    if (displayType) return displayType;
    const indexedType = typeTokenFromPyeongIndex(object, object && object.__dhsPyeongIndex);
    if (indexedType) return indexedType;
    const ownPyeongNo = pyeongNoFromObject(object);
    const scopedPyeongNo = normalizePyeongNoToken(inheritedPyeongNo || '');
    if (inheritedType && (!ownPyeongNo || (scopedPyeongNo && ownPyeongNo === scopedPyeongNo))) {
      return inheritedType;
    }
    return normalizeTypeToken(firstPrimitive(object, [
      'spc2',
      'supplyArea',
      'totalArea',
      'exclusiveArea',
      'excluseSpc',
      'realArea'
    ])) || '';
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

  function typeTokenFromPyeongIndex(object, index) {
    if (!index) return '';
    for (const key of pyeongKeyValues(object)) {
      if (typeof index[key] === 'string') return index[key];
      if (index[key] && index[key].typeToken) return index[key].typeToken;
    }
    return '';
  }

  function pyeongMetadataFromIndex(object, index) {
    if (!index) return null;
    for (const key of pyeongKeyValues(object)) {
      const entry = index[key];
      if (entry && typeof entry === 'object') return entry;
      if (typeof entry === 'string') return { typeToken: entry };
    }
    return null;
  }

  function mergePyeongIndex(parentIndex, nextIndex) {
    if (!nextIndex || Object.keys(nextIndex).length === 0) return parentIndex || null;
    return Object.assign({}, parentIndex || {}, nextIndex);
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

  function pyeongMetadataForItem(item) {
    const area = areaMetadataFromObject(item);
    return {
      typeToken: pyeongMetadataTypeToken(item),
      pyeongNo: pyeongNoFromObject(item),
      exclusiveSpace: area.exclusiveSpace,
      totalArea: area.totalArea
    };
  }

  function addPyeongIndexRow(index, item, fallbackKey) {
    if (!item || typeof item !== 'object') return;
    if (isHoUnitRow(item)) return;
    const metadata = pyeongMetadataForItem(item);
    if (!metadata.typeToken && !metadata.exclusiveSpace && !metadata.totalArea) return;
    for (const key of pyeongKeyValues(item, fallbackKey)) index[key] = metadata;
  }

  function pyeongIndexFromObject(object) {
    const index = {};
    for (const [childKey, child] of Object.entries(object || {}).slice(0, MAX_OBJECT_VALUES)) {
      if (Array.isArray(child)) {
        for (const item of child.slice(0, MAX_ARRAY_ITEMS)) {
          addPyeongIndexRow(index, item, '');
        }
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

  function isHoUnitRow(object) {
    return Boolean(firstPrimitive(object || {}, [
      'hoNm',
      'hoName',
      'hoNo',
      'houseNo',
      'roomNo',
      'unitNo',
      'unitNumber',
      'lineNo',
      'existHo'
    ]));
  }

  function floorFromObject(object, inheritedFloor) {
    return floorValue(firstPrimitive(object, [
      'hoFloor',
      'floor',
      'floorNo',
      'floorNm',
      'currentFloor'
    ])) || Number(inheritedFloor || 0);
  }

  function lineTokenFromObject(object, floor) {
    const direct = normalizeLineToken(firstPrimitive(object, [
      'lineNo',
      'line',
      'unitLine',
      'hoLine',
      'lineNumber'
    ]));
    if (direct) return direct;
    return lineTokenFromHo(firstPrimitive(object, [
      'hoNm',
      'hoName',
      'hoNo',
      'houseNo',
      'roomNo',
      'unitNo',
      'unitNumber'
    ]), floor);
  }

  function normalizeHoToken(value) {
    const digits = normalizeText(value).replace(/[^0-9]/g, '');
    if (!/^\d{2,4}$/.test(digits)) return '';
    return `${Number(digits) || digits}${HO}`;
  }

  function directHoFromObject(object) {
    for (const field of ['hoNm', 'hoName', 'hoNo', 'houseNo', 'roomNo', 'unitNumber']) {
      const token = normalizeHoToken(firstPrimitive(object || {}, [field]));
      if (token) return { token, sourceField: field };
    }
    return { token: '', sourceField: '' };
  }

  function hasOwn(object, field) {
    return Object.prototype.hasOwnProperty.call(object || {}, field);
  }

  function landPriceAnomalyFromObject(object, directHoToken) {
    if (!object || typeof object !== 'object' || directHoToken) return false;
    if (!hasOwn(object, 'price')) return false;
    const rawPrice = object.price;
    const priceText = rawPrice === null || rawPrice === undefined ? '' : String(rawPrice).trim();
    const priceLooksEmpty = priceText === '' || priceText === '0' || rawPrice === 0;
    if (!priceLooksEmpty) return false;
    const hscpNo = primitiveText(object.hscpNo).trim();
    return !hscpNo || hscpNo === '0';
  }

  function directionTokenFromObject(object, inheritedDirection) {
    return normalizeDirectionToken(firstPrimitive(object || {}, [
      'direction',
      'directionName',
      'directionTypeName',
      'directionBaseTypeName',
      'houseDirection',
      'hoDirection',
      'hoDir',
      'dir',
      'orientation'
    ])) || inheritedDirection || '';
  }

  function pushRow(rows, row) {
    if (!row.dongToken || !row.typeToken || !row.lineToken) return;
    const output = {
      dongToken: row.dongToken,
      typeToken: row.typeToken,
      lineToken: row.lineToken,
      floorValue: Number(row.floorValue || 0),
      numberingScheme: 'floor-line',
      source: 'naver-house-number-map'
    };
    if (row.directHoToken) output.directHoToken = row.directHoToken;
    if (row.sourceField) output.sourceField = row.sourceField;
    if (row.directionToken) output.directionToken = row.directionToken;
    if (row.landPriceAnomaly) output.landPriceAnomaly = true;
    if (row.pyeongNo) output.pyeongNo = row.pyeongNo;
    if (row.exclusiveSpace) output.exclusiveSpace = row.exclusiveSpace;
    if (row.totalArea) output.totalArea = row.totalArea;
    rows.push(output);
  }

  function walk(value, context, rows, depth) {
    if (!value || rows.length >= MAX_ROWS || depth > MAX_DEPTH) return;
    if (Array.isArray(value)) {
      for (const item of value.slice(0, MAX_ARRAY_ITEMS)) walk(item, context, rows, depth + 1);
      return;
    }
    if (typeof value !== 'object') return;

    const pyeongIndex = mergePyeongIndex(context.pyeongIndex, pyeongIndexFromObject(value));
    const valueWithIndex = Object.assign({}, value, { __dhsPyeongIndex: pyeongIndex });
    const pyeongMetadata = pyeongMetadataFromIndex(value, pyeongIndex) || {};
    const areaMetadata = areaMetadataFromObject(value);
    const next = {
      dongToken: dongTokenFromObject(value, context.dongToken),
      typeToken: typeTokenFromObject(valueWithIndex, context.typeToken, context.pyeongNo),
      floorValue: floorFromObject(value, context.floorValue),
      directionToken: directionTokenFromObject(value, context.directionToken),
      pyeongNo: pyeongNoFromObject(value) || pyeongMetadata.pyeongNo || context.pyeongNo || '',
      exclusiveSpace: areaMetadata.exclusiveSpace || pyeongMetadata.exclusiveSpace || context.exclusiveSpace || 0,
      totalArea: areaMetadata.totalArea || pyeongMetadata.totalArea || context.totalArea || 0,
      pyeongIndex
    };

    if (existHoAllowed(value)) {
      const lineToken = lineTokenFromObject(value, next.floorValue);
      const directHo = directHoFromObject(value);
      if (lineToken) {
        pushRow(rows, {
          dongToken: next.dongToken,
          typeToken: next.typeToken,
          lineToken,
          floorValue: next.floorValue,
          directionToken: next.directionToken,
          directHoToken: directHo.token,
          sourceField: directHo.sourceField,
          landPriceAnomaly: landPriceAnomalyFromObject(value, directHo.token),
          pyeongNo: next.pyeongNo,
          exclusiveSpace: next.exclusiveSpace,
          totalArea: next.totalArea
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
      'landPrices'
    ]) {
      if (Array.isArray(value[field])) {
        for (const item of value[field].slice(0, MAX_ARRAY_ITEMS)) walk(item, next, rows, depth + 1);
      }
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
        row.dongToken,
        row.typeToken,
        row.lineToken,
        Number(row.floorValue || 0),
        row.directHoToken || '',
        row.directionToken || '',
        row.pyeongNo || '',
        row.exclusiveSpace || '',
        row.totalArea || '',
        row.source,
        row.landPriceAnomaly ? 'anomaly' : ''
      ].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(row);
      if (result.length >= MAX_ROWS) break;
    }
    return result;
  }

  function collectNaverLineMapRows(body, context) {
    const rows = [];
    const inherited = context && typeof context === 'object' ? context : {};
    walk(body, {
      dongToken: normalizeDongToken(inherited.dongToken || inherited.detailDongToken || '') || '',
      typeToken: normalizeTypeToken(inherited.typeToken || inherited.detailTypeToken || inherited.pyeongType || '') || '',
      floorValue: floorValue(inherited.floorValue || inherited.detailFloorValue || 0) || 0,
      directionToken: '',
      pyeongNo: normalizePyeongNoToken(inherited.pyeongNo || inherited.detailPyeongNo || ''),
      exclusiveSpace: numericArea(inherited.exclusiveSpace || inherited.detailExclusiveSpace || 0),
      totalArea: numericArea(inherited.totalArea || inherited.supplyArea || 0)
    }, rows, 0);
    return dedupeRows(rows);
  }

  function rootKind(value) {
    if (value === null || value === undefined) return 'empty';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'primitive';
  }

  function safePath(path) {
    return String(path || '')
      .replace(/\[\d+\]/g, '[]')
      .replace(/[^A-Za-z0-9_.[\]-]/g, '')
      .slice(0, 120);
  }

  function summarizeShapeWalk(value, shape, path, depth) {
    if (!value || depth > MAX_DEPTH) return;
    if (Array.isArray(value)) {
      shape.arrayCount += 1;
      if (path && shape.arrayPaths.length < MAX_SHAPE_PATHS) shape.arrayPaths.push(safePath(path));
      for (const item of value.slice(0, MAX_ARRAY_ITEMS)) summarizeShapeWalk(item, shape, `${path || '$'}[]`, depth + 1);
      return;
    }
    if (typeof value !== 'object') {
      shape.primitiveCount += 1;
      return;
    }

    shape.objectCount += 1;
    const keys = Object.keys(value).slice(0, MAX_OBJECT_VALUES);
    let candidate = false;
    for (const key of keys) {
      if (SHAPE_KEYS.has(key)) {
        candidate = true;
        shape.knownKeySet.add(key);
      }
    }
    if (candidate) shape.candidateObjectCount += 1;

    for (const key of keys) {
      const child = value[key];
      if (child && typeof child === 'object') {
        summarizeShapeWalk(child, shape, path ? `${path}.${key}` : key, depth + 1);
      }
    }
  }

  function summarizeNaverLineMapShape(body) {
    const shape = {
      rootKind: rootKind(body),
      objectCount: 0,
      arrayCount: 0,
      primitiveCount: 0,
      candidateObjectCount: 0,
      knownKeySet: new Set(),
      arrayPaths: []
    };
    summarizeShapeWalk(body, shape, '', 0);
    return {
      rootKind: shape.rootKind,
      objectCount: Math.min(9999, shape.objectCount),
      arrayCount: Math.min(9999, shape.arrayCount),
      primitiveCount: Math.min(9999, shape.primitiveCount),
      candidateObjectCount: Math.min(9999, shape.candidateObjectCount),
      knownKeys: Array.from(shape.knownKeySet).sort().slice(0, MAX_SHAPE_KEYS),
      arrayPaths: Array.from(new Set(shape.arrayPaths)).slice(0, MAX_SHAPE_PATHS)
    };
  }

  const api = {
    VERSION,
    collectNaverLineMapRows,
    summarizeNaverLineMapShape,
    normalizeDirectionToken
  };

  globalScope.DHS_NAVER_LINE_MAP = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
