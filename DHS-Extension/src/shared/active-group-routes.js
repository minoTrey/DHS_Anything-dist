(function exposeActiveGroupRoutes(globalScope) {
  const DONG = '\uB3D9';
  const HO = '\uD638';
  const MAX_ROWS = 80;
  const MAX_ARRAY_ITEMS = 200;
  const MAX_OBJECT_VALUES = 120;
  const MAX_DEPTH = 8;

  const NETWORK_ROUTE_SET = new Set([
    'article-detail',
    'sameAddress',
    'representative-main',
    'representative-main-1',
    'complex-list',
    'complex-cache'
  ]);

  const DONG_FIELDS = new Set([
    'buildingName',
    'buildingNo',
    'bildNo',
    'dongName',
    'dongNo',
    'dong',
    'DONG_NM'
  ]);

  const HO_FIELDS = new Set([
    'hoNo',
    'hoName',
    'unitNo',
    'roomNo',
    'houseNo',
    'hoNm'
  ]);

  const FLOOR_HINT_FIELDS = [
    'floor',
    'floorInfo',
    'floorText',
    'floorName',
    'floorNm',
    'floorNo',
    'article_floor',
    'articleFloor',
    'atclFlr',
    'flrInfo',
    'floor_info',
    'currentFloor',
    'floor_cnt',
    'floorCnt',
    'frlFloor',
    'roomFloor',
    'unitFloor',
    'Floor1',
    'Floor2',
    'FloorName',
    'floorType'
  ];

  const FLOOR_TOTAL_FIELDS = [
    'floor_cnt_total',
    'floorCntTotal',
    'totalFloor',
    'totalFloorCount',
    'buildingHighestFloor',
    'topFloor',
    'maxFloor'
  ];

  const PYEONG_NO_FIELDS = [
    'pyeongNo',
    'ptpNo',
    'pyeongTypeNo',
    'pyeongTypeNumber'
  ];

  const EXCLUSIVE_AREA_FIELDS = [
    'exclusiveSpace',
    'exclusiveArea',
    'excluseSpc',
    'realArea',
    'spc2'
  ];

  const ARTICLE_MARKER_FIELDS = [
    'articleNo',
    'atclNo',
    'articleId',
    'articleID',
    'representativeArticleNo'
  ];

  const DETAIL_FIELDS = [
    'buildingName',
    'buildingNo',
    'bildNo',
    'dongName',
    'dongNo',
    'dong',
    'address2',
    'addr2',
    'detailAddress',
    'dongHo',
    'hoNo',
    'hoName',
    'unitNo',
    'roomNo',
    'houseNo',
    'hoNm',
    'article_address2',
    'article_address3',
    'DONG_NM',
    'kiso_address2'
  ];
  const PROVIDER_LOOKUP_FIELD_PATTERN = /cp|provider|articlelink|linkurl|mobile|pc|kiso|mk|biz/i;
  const PROVIDER_LOOKUP_VALUE_PATTERN = /https?:\/\/|\/memul\/|\/rd\/|land\.mk|mk\.co\.kr|mseq=|UID=/i;
  const PROVIDER_DIRECT_DOMAINS = Object.freeze([
    { family: 'mk', domains: ['land.mk.co.kr', 'm.land.mk.co.kr', 'landad.mk.co.kr'] },
    { family: 'r114', domains: ['r114.com'] },
    { family: 'gongsilclub', domains: ['n.gongsilclub.com', 'm.gongsilclub.com'] },
    { family: 'homesdid', domains: ['homesdid.co.kr', 'm.homesdid.co.kr'] },
    { family: 'serve', domains: ['serve.co.kr'] },
    { family: 'rfine', domains: ['rfine.kr'] },
    { family: 'rter', domains: ['rter2.com', 'rego.kr', 'm.rego.kr'] },
    { family: 'asil', domains: ['asil.kr'] },
    { family: 'hankyung', domains: ['realestate.hankyung.com', 'maemul.hankyung.com', 'land.hankyung.com', 'hankyung.com', 'www.hankyung.com'] },
    { family: 'daara', domains: ['land.daara.co.kr', 'm.land.daara.co.kr', 'industryland.co.kr', 'www.industryland.co.kr'] },
    { family: 'neonet', domains: ['neonet.co.kr', 'www.neonet.co.kr', 'm.neonet.co.kr'] },
    { family: 'ten', domains: ['ten.co.kr'] },
    { family: 'kar', domains: ['karhanbang.com', 'www.karhanbang.com'] },
    { family: 'thebiz', domains: ['thebiz.co.kr', 'www.thebiz.co.kr', 'thebiz.kr', 'www.thebiz.kr'] },
    { family: 'woori', domains: ['woori-house.co.kr'] },
    { family: 'kiso', domains: ['landcenter.kiso.or.kr'] }
  ]);

  let nodeProviderApi = null;
  if (typeof require === 'function') {
    try {
      nodeProviderApi = require('./provider-candidate');
    } catch (_) {
      nodeProviderApi = null;
    }
  }

  function providerApi() {
    return (globalScope && globalScope.DHS_PROVIDER_CANDIDATE) || nodeProviderApi || {};
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function primitiveText(value) {
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    return '';
  }

  function digitsOnly(value) {
    const text = normalizeText(value);
    return /^\d{1,8}$/.test(text) ? text : '';
  }

  function safeNumericId(value) {
    const text = String(value || '').trim();
    return /^\d{4,24}$/.test(text) ? text : '';
  }

  function hashMarker(value) {
    const input = String(value || '');
    let hash = 0x811c9dc5;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return `article:${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }

  function hashProviderLookupRef(value) {
    const marker = hashMarker(value).replace(/^article:/, '');
    return `provider:${marker}`;
  }

  function hostnameMatchesDomain(hostname, domain) {
    const host = String(hostname || '').toLowerCase();
    const expected = String(domain || '').toLowerCase();
    return Boolean(host && expected && (host === expected || host.endsWith(`.${expected}`)));
  }

  function providerFamilyFromUrl(value) {
    let parsed;
    try {
      parsed = new URL(String(value || ''));
    } catch (_) {
      return '';
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    if (parsed.username || parsed.password) return '';
    const provider = PROVIDER_DIRECT_DOMAINS.find((item) => item.domains.some((domain) => hostnameMatchesDomain(parsed.hostname, domain)));
    return provider ? provider.family : '';
  }

  function sanitizeProviderLookupRef(value, providerFamily) {
    let parsed;
    try {
      parsed = new URL(String(value || ''));
    } catch (_) {
      return '';
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    if (parsed.username || parsed.password) return '';
    const family = providerFamilyFromUrl(parsed.href);
    if (!family || (providerFamily && family !== providerFamily)) return '';
    const href = parsed.href;
    return href.length <= 2048 ? href : '';
  }

  function safeArticleMarker(value) {
    const marker = String(value || '');
    return /^article:[a-f0-9]{8,12}$/.test(marker) ? marker : '';
  }

  function safeNumericDongNo(value) {
    const text = String(value || '').trim();
    return /^\d{1,24}$/.test(text) ? text : '';
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

  function parseSupportedHref(href) {
    try {
      const parsed = new URL(String(href || ''));
      const hostname = parsed.hostname.toLowerCase();
      if (hostname !== 'new.land.naver.com' && hostname !== 'fin.land.naver.com') {
        return { ok: false, reason: 'unsupported-origin' };
      }
      return { ok: true, parsed };
    } catch (_) {
      return { ok: false, reason: 'unsupported-origin' };
    }
  }

  function idParam(parsed, key) {
    const raw = parsed.searchParams.get(key);
    if (!raw) return { value: '', invalid: false };
    const value = safeNumericId(raw);
    return value ? { value, invalid: false } : { value: '', invalid: true };
  }

  function articleNoFromParsed(parsed) {
    return idParam(parsed, 'articleNo');
  }

  function complexNoFromParsed(parsed) {
    const pathMatch = parsed.pathname.match(/\/complexes\/([^/?#]+)(?:\/|$)/);
    if (pathMatch) {
      const value = safeNumericId(pathMatch[1]);
      return value ? { value, invalid: false } : { value: '', invalid: true };
    }
    const complexParam = idParam(parsed, 'complexNo');
    if (complexParam.value || complexParam.invalid) return complexParam;
    return idParam(parsed, 'hscpNo');
  }

  function safeRouteToken(value, fallback) {
    const text = normalizeText(value || fallback || '').toUpperCase();
    return /^[A-Z:]{1,120}$/.test(text) ? text : String(fallback || '');
  }

  function sourceFromRoute(route) {
    const value = String(route || '');
    if (value === 'articleDetail') return 'article-detail';
    if (value === 'representativeArticles') return 'representative-main';
    if (value === 'complexList') return 'complex-list';
    if (value === 'complexCache') return 'complex-cache';
    return NETWORK_ROUTE_SET.has(value) ? value : '';
  }

  function categoryFromRoute(route) {
    if (route === 'article-detail') return 'article';
    if (route === 'sameAddress') return 'sameAddress';
    if (route === 'representative-main' || route === 'representative-main-1') return 'representativeArticles';
    if (route === 'complex-list') return 'complexList';
    if (route === 'complex-cache') return 'complexCache';
    return '';
  }

  function missing(reason) {
    return {
      present: false,
      route: '',
      category: '',
      path: '',
      reason: reason || 'not-executable'
    };
  }

  function buildActiveGroupRouteRequest(input) {
    const route = sourceFromRoute(input && input.route);
    if (!route) return missing('route-local-only');

    const parsedHref = parseSupportedHref(input && input.href);
    if (!parsedHref.ok) return missing(parsedHref.reason);

    const articleNo = articleNoFromParsed(parsedHref.parsed);
    const complexNo = complexNoFromParsed(parsedHref.parsed);
    let path = '';

    if (route === 'article-detail') {
      if (articleNo.invalid) return missing('invalid-article');
      if (!articleNo.value) return missing('missing-article');
      path = `/api/articles/${encodeURIComponent(articleNo.value)}`;
    } else if (route === 'sameAddress') {
      if (articleNo.invalid) return missing('invalid-article');
      if (!articleNo.value) return missing('missing-article');
      path = `/api/articles/sameAddress?articleNo=${encodeURIComponent(articleNo.value)}`;
    } else if (route === 'representative-main' || route === 'representative-main-1') {
      if (articleNo.invalid) return missing('invalid-article');
      if (!articleNo.value) return missing('missing-article');
      const index = route === 'representative-main-1' ? 1 : 0;
      path = `/api/articles?index=${index}&representativeArticleNo=${encodeURIComponent(articleNo.value)}`;
    } else if (route === 'complex-list') {
      if (complexNo.invalid) return missing('invalid-complex');
      if (!complexNo.value) return missing('missing-complex');
      const params = new URLSearchParams({
        realEstateType: safeRouteToken(input && input.realEstateType, 'APT:ABYG:JGC:PRE'),
        tradeType: '',
        tag: '',
        rentPriceMin: '0',
        rentPriceMax: '900000000',
        priceMin: '0',
        priceMax: '900000000',
        areaMin: '0',
        areaMax: '900000000',
        oldBuildYears: '',
        recentlyBuildYears: '',
        minHouseHoldCount: '',
        maxHouseHoldCount: '',
        showArticle: 'false',
        sameAddressGroup: 'false',
        minMaintenanceCost: '',
        maxMaintenanceCost: '',
        priceType: safeRouteToken(input && input.priceType, 'RETAIL'),
        directions: '',
        page: '1',
        complexNo: complexNo.value,
        buildingNos: '',
        areaNos: '',
        type: 'list',
        order: 'rank'
      });
      path = `/api/articles/complex/${encodeURIComponent(complexNo.value)}?${params.toString()}`;
    } else if (route === 'complex-cache') {
      if (complexNo.invalid) return missing('invalid-complex');
      if (!complexNo.value) return missing('missing-complex');
      path = `/api/complexes/${encodeURIComponent(complexNo.value)}`;
    }

    return {
      present: Boolean(path),
      route,
      category: categoryFromRoute(route),
      path
    };
  }

  function firstPrimitive(object, fields) {
    const input = object && typeof object === 'object' ? object : {};
    for (const field of fields) {
      const value = primitiveText(input[field]);
      if (value) return value;
    }
    return '';
  }

  function normalizePyeongNoToken(value) {
    const text = normalizeText(value);
    return text ? text.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) : '';
  }

  function pyeongNoFromObject(object) {
    return normalizePyeongNoToken(firstPrimitive(object || {}, PYEONG_NO_FIELDS));
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

  function exclusiveSpaceFromObject(object) {
    return normalizeAreaValue(firstPrimitive(object || {}, EXCLUSIVE_AREA_FIELDS));
  }

  function articleMarkerFromObject(object, inheritedArticleMarker) {
    const explicit = safeNumericId(firstPrimitive(object, ARTICLE_MARKER_FIELDS));
    return explicit ? hashMarker(explicit) : safeArticleMarker(inheritedArticleMarker);
  }

  function displayDongTokenFromObject(object) {
    const explicit = firstPrimitive(object, [
      'displayDong',
      'buildingName',
      'dongName',
      'dongNm',
      'bldgNm',
      'bldNm',
      'buildingNm',
      'DONG_NM'
    ]);
    return normalizeDongToken(explicit) || safeNumericDongToken(explicit);
  }

  function dongNoFromObject(object) {
    return safeNumericDongNo(firstPrimitive(object, [
      'dongNo',
      'buildingNo',
      'bildNo',
      'dong'
    ]));
  }

  function buildNoFromObject(object) {
    return safeNumericDongNo(firstPrimitive(object || {}, [
      'buildNo',
      'buildingNo',
      'bildNo'
    ]));
  }

  function collectComplexDongRowsFromValue(value, rows, depth, context) {
    if (!value || rows.length >= MAX_ROWS || depth > MAX_DEPTH) return;
    const inherited = context && typeof context === 'object' ? context : {};
    if (Array.isArray(value)) {
      for (const item of value.slice(0, MAX_ARRAY_ITEMS)) {
        collectComplexDongRowsFromValue(item, rows, depth + 1, inherited);
      }
      return;
    }
    if (typeof value !== 'object') return;

    const ownDongToken = displayDongTokenFromObject(value);
    const ownDongNo = dongNoFromObject(value);
    const ownBuildNo = buildNoFromObject(value);
    const dongToken = ownDongToken || inherited.dongToken || '';
    const dongNo = ownDongNo || inherited.dongNo || '';
    const buildNo = ownBuildNo || inherited.buildNo || '';
    if (dongToken && dongNo) {
      const row = { dongToken, dongNo };
      if (buildNo) row.buildNo = buildNo;
      rows.push(row);
    }

    const nextContext = {
      dongToken,
      dongNo,
      buildNo
    };
    for (const child of Object.values(value).slice(0, MAX_OBJECT_VALUES)) {
      if (child && typeof child === 'object') collectComplexDongRowsFromValue(child, rows, depth + 1, nextContext);
    }
  }

  function collectComplexDongRows(body) {
    const rows = [];
    collectComplexDongRowsFromValue(body, rows, 0);
    const seen = new Set();
    const result = [];
    for (const row of rows) {
      const key = `${row.dongToken}:${row.dongNo}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(row);
      if (result.length >= MAX_ROWS) break;
    }
    return result;
  }

  function buildNaverPyeongTypeRouteRequest(input) {
    const result = buildNaverBuildingLineMapRouteRequests(input);
    if (!result.present) return missing(result.reason || 'not-executable');
    const request = result.requests.find((item) => item.category === 'pyeongtype');
    if (!request) return missing('missing-pyeongtype-route');
    return {
      present: true,
      route: request.route,
      category: request.category,
      path: request.path
    };
  }

  function buildNaverBuildingLineMapRouteRequests(input) {
    const parsedHref = parseSupportedHref(input && input.href);
    if (!parsedHref.ok) return { present: false, reason: parsedHref.reason, requests: [] };

    const complexNo = complexNoFromParsed(parsedHref.parsed);
    if (complexNo.invalid) return { present: false, reason: 'invalid-complex', requests: [] };
    if (!complexNo.value) return { present: false, reason: 'missing-complex', requests: [] };

    const detailDongToken = normalizeDongToken(input && input.detailDongToken) || safeNumericDongToken(input && input.detailDongToken);
    if (!detailDongToken) return { present: false, reason: 'missing-dong', requests: [] };

    const rows = collectComplexDongRows(input && input.complexCacheBody);
    const articleDongNo = safeNumericDongNo(input && input.detailDongNo);
    const articleBuildNo = safeNumericDongNo(input && input.detailBuildNo);
    const match = rows.find((row) => row.dongToken === detailDongToken) || (articleDongNo ? {
      dongToken: detailDongToken,
      dongNo: articleDongNo,
      buildNo: articleBuildNo || articleDongNo
    } : null);
    const hasDongNoMatch = Boolean(match && match.dongNo);

    const context = {
      detailDongToken,
      detailTypeToken: typeTokenFromObject({ articleAreaName: input && input.detailTypeToken }),
      detailDirectionToken: normalizeText(input && input.detailDirectionToken),
      detailFloorValue: Number(input && input.detailFloorValue || 0) || 0,
      detailFloorBand: /^(low|mid|high)$/.test(String(input && input.detailFloorBand || '')) ? String(input.detailFloorBand) : '',
      detailTotalFloor: Number(input && input.detailTotalFloor || 0) || 0,
      dongNo: hasDongNoMatch ? match.dongNo : '',
      buildNo: hasDongNoMatch ? (match.buildNo || match.dongNo || '') : ''
    };
    const buildingEndpointPaths = {
      pyeongtype: 'pyeongtype',
      landprice: 'landprice'
    };
    const requests = ['pyeongtype', 'landprice'].map((category) => Object.assign({
      present: true,
      route: `naver-${category}`,
      category,
      path: hasDongNoMatch
        ? `/api/complexes/${encodeURIComponent(complexNo.value)}/buildings/${buildingEndpointPaths[category]}?dongNo=${encodeURIComponent(match.dongNo)}`
        : `/api/complexes/${encodeURIComponent(complexNo.value)}/buildings/${buildingEndpointPaths[category]}`
    }, context));
    if (context.buildNo) {
      requests.push(Object.assign({
        present: true,
        route: 'naver-buildingUnits',
        category: 'buildingUnits',
        path: `/api/articles/buildings/units?buildingNos=${encodeURIComponent(context.buildNo)}`
      }, context));
    }
    requests.push(Object.assign({
      present: true,
      route: 'naver-prices',
      category: 'prices',
      path: `/api/complexes/${encodeURIComponent(complexNo.value)}/prices`
    }, context));
    return { present: true, reason: hasDongNoMatch ? '' : 'all-buildings-fallback', requests };
  }

  function fieldText(field, value) {
    const text = normalizeText(value);
    if (!text) return '';
    const digits = digitsOnly(text);
    if (digits && DONG_FIELDS.has(field)) return `${digits}${DONG}`;
    if (digits && HO_FIELDS.has(field)) return `${digits}${HO}`;
    return text;
  }

  function extractDongToken(value) {
    const api = providerApi();
    if (api && typeof api.extractDongToken === 'function') return api.extractDongToken(value);
    const match = normalizeText(value).match(new RegExp(`(?<!\\d)(\\d{1,4})\\s*${DONG}`));
    return match ? `${Number(match[1]) || match[1]}${DONG}` : '';
  }

  function extractHoToken(value) {
    const api = providerApi();
    if (api && typeof api.extractHoToken === 'function') return api.extractHoToken(value);
    const match = normalizeText(value).match(new RegExp(`(?<!\\d)(\\d{1,4})\\s*${HO}`));
    return match ? `${Number(match[1]) || match[1]}${HO}` : '';
  }

  function boundedDisplayCandidate(value) {
    const text = normalizeText(value);
    const dongToken = extractDongToken(text);
    const hoToken = extractHoToken(text);
    return dongToken && hoToken ? `${dongToken} ${hoToken}` : '';
  }

  function typeTokenFromObject(input) {
    const object = input && typeof input === 'object' ? input : {};
    const fields = [
      'articleAreaName',
      'areaName',
      'pyeongName',
      'pyeongTypeName',
      'pyeongType',
      'area2',
      'exclusiveArea',
      'excluseSpc',
      'spc2',
      'realArea'
    ];
    const text = normalizeText(fields.map((field) => primitiveText(object[field])).filter(Boolean).join(' '));
    const match = text.match(/(?<!\d)(0?\d{2,3})(?:\.\d+)?\s*([A-Z]{0,3})(?![A-Z0-9])/i);
    return match ? `${Number(match[1]) || match[1]}${String(match[2] || '').toUpperCase()}` : '';
  }

  function floorTotalFromObject(object, fallback) {
    const value = firstPrimitive(object, FLOOR_TOTAL_FIELDS);
    const number = Number(String(value || '').replace(/[^0-9]/g, '')) || 0;
    if (number > 0 && number <= 150) return number;
    return Number(fallback || 0) || 0;
  }

  function floorHintFromObject(object, fallbackTotalFloor) {
    const input = object && typeof object === 'object' ? object : {};
    const api = providerApi();
    if (!api || typeof api.extractFloorHintFromValue !== 'function') return null;
    const totalFloor = floorTotalFromObject(input, fallbackTotalFloor);
    for (const field of FLOOR_HINT_FIELDS) {
      if (input[field] === undefined || input[field] === null) continue;
      const pairedTotalFloor = /^floor_?cnt$/i.test(field) || /^(?:frlFloor|roomFloor|unitFloor|Floor1|FloorName|floorType)$/i.test(field)
        ? totalFloor
        : 0;
      const hint = api.extractFloorHintFromValue(field, input[field], pairedTotalFloor);
      if (hint && hint.floorHintPresent) return hint;
    }
    return null;
  }

  function incrementCount(target, key) {
    const safeKey = normalizeText(key || 'unknown').replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 40) || 'unknown';
    target[safeKey] = Math.min(999, (Number(target[safeKey] || 0) || 0) + 1);
  }

  function floorHintRejectReason(field, value) {
    const text = normalizeText(value);
    if (!text) return 'empty';
    if (/[저중고]\s*(?:\/|층|$)|(?:low|mid|high)\s*(?:\/|floor|$)/i.test(text)) return 'band-or-total-only';
    if (/(?:총|전체|최고|top|max|total|buildingHighestFloor)/i.test(`${field} ${text}`)) return 'band-or-total-only';
    if (/\d/.test(text)) return 'unparsed-floor-value';
    return 'non-floor-text';
  }

  function collectFloorHintDiagnosticsFromValue(value, summary, depth, context) {
    if (!value || depth > MAX_DEPTH) return;
    if (Array.isArray(value)) {
      for (const item of value.slice(0, MAX_ARRAY_ITEMS)) {
        collectFloorHintDiagnosticsFromValue(item, summary, depth + 1, context);
      }
      return;
    }
    if (typeof value !== 'object') return;

    const next = Object.assign({}, context || {});
    const totalFloor = floorTotalFromObject(value, next.totalFloor);
    if (totalFloor) next.totalFloor = totalFloor;

    const api = providerApi();
    for (const field of FLOOR_HINT_FIELDS) {
      if (value[field] === undefined || value[field] === null) continue;
      summary.seenCount += 1;
      incrementCount(summary.byField, field);
      const pairedTotalFloor = /^floor_?cnt$/i.test(field) || /^(?:frlFloor|roomFloor|unitFloor|Floor1|FloorName|floorType)$/i.test(field)
        ? Number(next.totalFloor || 0)
        : 0;
      const hint = api && typeof api.extractFloorHintFromValue === 'function'
        ? api.extractFloorHintFromValue(field, value[field], pairedTotalFloor)
        : null;
      if (hint && hint.floorHintPresent) {
        summary.acceptedCount += 1;
        continue;
      }
      summary.rejectedCount += 1;
      incrementCount(summary.byReason, floorHintRejectReason(field, value[field]));
    }

    for (const child of Object.values(value).slice(0, MAX_OBJECT_VALUES)) {
      if (child && typeof child === 'object') collectFloorHintDiagnosticsFromValue(child, summary, depth + 1, next);
    }
  }

  function sanitizeFloorHintRow(row) {
    const input = row && typeof row === 'object' ? row : {};
    const source = sourceFromRoute(input.source);
    const floorValue = Number(input.floorValue || 0);
    const totalFloor = Number(input.totalFloor || 0);
    if (!source || !Number.isInteger(floorValue) || floorValue < 1 || floorValue > 100) return null;
    if (totalFloor && (!Number.isInteger(totalFloor) || totalFloor < 1 || totalFloor > 150 || floorValue > totalFloor)) return null;
    const result = {
      source,
      dongToken: normalizeDongToken(input.dongToken || '') || '',
      typeToken: normalizeText(input.typeToken || '').toUpperCase().slice(0, 24),
      floorValue,
      totalFloor,
      floorHintSourceField: normalizeText(input.floorHintSourceField || '').slice(0, 40),
      articleMarker: safeArticleMarker(input.articleMarker)
    };
    const pyeongNo = normalizePyeongNoToken(input.pyeongNo || input.ptpNo || input.pyeongTypeNo || '');
    const exclusiveSpace = normalizeAreaValue(input.exclusiveSpace || input.exclusiveArea || input.excluseSpc || 0);
    if (pyeongNo) result.pyeongNo = pyeongNo;
    if (exclusiveSpace) result.exclusiveSpace = exclusiveSpace;
    return result;
  }

  function collectFloorHintFromValue(value, source, rows, depth, context) {
    if (!value || rows.length >= MAX_ROWS || depth > MAX_DEPTH) return;
    if (Array.isArray(value)) {
      for (const item of value.slice(0, MAX_ARRAY_ITEMS)) {
        collectFloorHintFromValue(item, source, rows, depth + 1, context);
      }
      return;
    }
    if (typeof value !== 'object') return;

    const next = Object.assign({}, context || {});
    const dongToken = displayDongTokenFromObject(value);
    const typeToken = typeTokenFromObject(value);
    const totalFloor = floorTotalFromObject(value, next.totalFloor);
    const articleMarker = articleMarkerFromObject(value, next.articleMarker);
    const pyeongNo = pyeongNoFromObject(value);
    const exclusiveSpace = exclusiveSpaceFromObject(value);
    if (dongToken) next.dongToken = dongToken;
    if (typeToken) next.typeToken = typeToken;
    if (totalFloor) next.totalFloor = totalFloor;
    if (articleMarker) next.articleMarker = articleMarker;
    if (pyeongNo) next.pyeongNo = pyeongNo;
    if (exclusiveSpace) next.exclusiveSpace = exclusiveSpace;

    const hint = floorHintFromObject(value, next.totalFloor);
    if (hint && hint.floorHintPresent) {
      const row = sanitizeFloorHintRow({
        source,
        dongToken: next.dongToken || '',
        typeToken: next.typeToken || '',
        floorValue: Number(hint.floorHintValue || 0),
        totalFloor: Number(hint.floorHintTotal || 0) || Number(next.totalFloor || 0),
        floorHintSourceField: hint.floorHintSourceField || '',
        articleMarker: next.articleMarker || '',
        pyeongNo: next.pyeongNo || '',
        exclusiveSpace: next.exclusiveSpace || 0
      });
      if (row) rows.push(row);
    }

    for (const child of Object.values(value).slice(0, MAX_OBJECT_VALUES)) {
      if (child && typeof child === 'object') collectFloorHintFromValue(child, source, rows, depth + 1, next);
    }
  }

  function dedupeFloorHintRows(rows) {
    const seen = new Set();
    const result = [];
    for (const row of rows.map(sanitizeFloorHintRow).filter(Boolean)) {
      const key = [
        row.source,
        row.dongToken,
        row.typeToken,
          row.floorValue,
          row.totalFloor,
          row.floorHintSourceField,
          row.pyeongNo || '',
          row.exclusiveSpace || '',
          row.articleMarker || ''
        ].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(row);
      if (result.length >= 40) break;
    }
    return result;
  }

  function collectFromValue(value, source, rows, inheritedText, depth, inheritedArticleMarker) {
    if (!value || rows.length >= MAX_ROWS || depth > MAX_DEPTH) return;
    if (Array.isArray(value)) {
      for (const item of value.slice(0, MAX_ARRAY_ITEMS)) {
        collectFromValue(item, source, rows, inheritedText, depth + 1, inheritedArticleMarker);
      }
      return;
    }
    if (typeof value !== 'object') return;

    const articleMarker = articleMarkerFromObject(value, inheritedArticleMarker);
    const ownText = DETAIL_FIELDS
      .map((field) => fieldText(field, value[field]))
      .filter(Boolean)
      .join(' ');
    const combinedText = normalizeText([inheritedText, ownText].filter(Boolean).join(' '));
    const displayCandidate = boundedDisplayCandidate(combinedText);
    if (displayCandidate) {
      rows.push({
        source,
        displayCandidate,
        typeToken: typeTokenFromObject(value),
        estimated: false,
        articleMarker
      });
    }

    const nextInherited = extractDongToken(combinedText) ? combinedText : inheritedText;
    for (const child of Object.values(value).slice(0, MAX_OBJECT_VALUES)) {
      if (child && typeof child === 'object') collectFromValue(child, source, rows, nextInherited, depth + 1, articleMarker);
    }
  }

  function dedupeRows(rows) {
    const seen = new Set();
    const result = [];
    for (const row of rows) {
      const key = `${row.source}:${row.displayCandidate}:${row.typeToken}:${row.articleMarker || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(row);
      if (result.length >= 40) break;
    }
    return result;
  }

  function isSafeShapeKey(key) {
    return /^[A-Za-z_][A-Za-z0-9_]{0,40}$/.test(String(key || ''));
  }

  function isFloorShapeKey(key) {
    const lower = String(key || '').toLowerCase();
    if (FLOOR_HINT_FIELDS.map((field) => field.toLowerCase()).includes(lower)) return true;
    if (FLOOR_TOTAL_FIELDS.map((field) => field.toLowerCase()).includes(lower)) return true;
    return /(?:floor|flr)/.test(lower);
  }

  function isCandidateShapeKey(key) {
    const lower = String(key || '').toLowerCase();
    return DETAIL_FIELDS.map((field) => field.toLowerCase()).includes(lower) ||
      ['articleareaname', 'areaname', 'pyeongname', 'pyeongtypename', 'pyeongtype'].includes(lower);
  }

  function collectShapeFromValue(value, stats, depth) {
    if (!value || depth > MAX_DEPTH) return;
    if (Array.isArray(value)) {
      stats.arrayCount += 1;
      for (const item of value.slice(0, MAX_ARRAY_ITEMS)) collectShapeFromValue(item, stats, depth + 1);
      return;
    }
    if (typeof value !== 'object') return;

    stats.objectCount += 1;
    for (const key of Object.keys(value).slice(0, MAX_OBJECT_VALUES)) {
      if (isSafeShapeKey(key)) stats.keys.add(key);
      if (isFloorShapeKey(key)) {
        stats.floorKeyCount += 1;
        if (isSafeShapeKey(key)) stats.floorKeys.add(key);
      }
      if (isCandidateShapeKey(key)) stats.candidateKeyCount += 1;
      const child = value[key];
      if (child && typeof child === 'object') collectShapeFromValue(child, stats, depth + 1);
    }
  }

  function summarizeActiveGroupRouteShape(body) {
    const stats = {
      objectCount: 0,
      arrayCount: 0,
      floorKeyCount: 0,
      candidateKeyCount: 0,
      floorKeys: new Set(),
      keys: new Set()
    };
    collectShapeFromValue(body, stats, 0);
    const keys = Array.from(stats.keys).sort((a, b) => a.localeCompare(b, 'en')).slice(0, 24);
    const floorKeys = Array.from(stats.floorKeys).sort((a, b) => a.localeCompare(b, 'en')).slice(0, 12);
    return [
      `objects:${stats.objectCount}`,
      `arrays:${stats.arrayCount}`,
      `floorKeys:${stats.floorKeyCount}`,
      `candidateKeys:${stats.candidateKeyCount}`,
      floorKeys.length ? `floorKeyNames:${floorKeys.join(',')}` : 'floorKeyNames:-',
      keys.length ? `keys:${keys.join(',')}` : 'keys:-'
    ].join(' ');
  }

  function collectActiveGroupCandidateRows(body, route) {
    const source = sourceFromRoute(route);
    if (!source) return [];
    const rows = [];
    collectFromValue(body, source, rows, '', 0, '');
    return dedupeRows(rows);
  }

  function collectActiveGroupFloorHintRows(body, route) {
    const source = sourceFromRoute(route);
    if (!source) return [];
    const rows = [];
    collectFloorHintFromValue(body, source, rows, 0, {});
    return dedupeFloorHintRows(rows);
  }

  function collectActiveGroupFloorHintDiagnostics(body, route) {
    const source = sourceFromRoute(route);
    if (!source) return {
      seenCount: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      byReason: {},
      byField: {}
    };
    const summary = {
      source,
      seenCount: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      byReason: {},
      byField: {}
    };
    collectFloorHintDiagnosticsFromValue(body, summary, 0, {});
    summary.seenCount = Math.min(999, summary.seenCount);
    summary.acceptedCount = Math.min(999, summary.acceptedCount);
    summary.rejectedCount = Math.min(999, summary.rejectedCount);
    return summary;
  }

  function providerFamilyFromLookupValue(sourceField, value) {
    const text = normalizeText(value).toLowerCase();
    const field = normalizeText(sourceField).toLowerCase();
    const urlFamily = providerFamilyFromUrl(text);
    if (urlFamily) return urlFamily;
    if (/(?:^|[/:.])(?:m\.)?land\.mk\.co\.kr(?:[/:?&#]|$)|(?:^|[/:.])landad\.mk\.co\.kr(?:[/:?&#]|$)/.test(text)) return 'mk';
    if (/https?:\/\//i.test(text)) return '';
    if (/(?:^|\.)land\.mk\.co\.kr|(?:^|\.)m\.land\.mk\.co\.kr|(?:^|\.)landad\.mk\.co\.kr/.test(text)) return 'mk';
    if (/(^|[^a-z0-9])bizmk([^a-z0-9]|$)|매경부동산/.test(text) || /(cpid|provider).*(mk|biz)/.test(field)) return 'mk';
    return '';
  }

  function providerLookupTokenFromValue(value, providerFamily) {
    const text = String(value || '');
    const sequence = text.match(/[?&]mseq=(\d{1,20})\b/i) || text.match(/\bmseq\s*[:=]\s*["']?(\d{1,20})/i);
    if (sequence && sequence[1]) return { lookupKind: 'mk-sequence', lookupKey: sequence[1] };
    const uid = text.match(/[?&]UID=(\d{5,15})\b/i) || text.match(/\bUID\s*[:=]\s*["']?(\d{5,15})/i);
    if (uid && uid[1]) return { lookupKind: 'mk-uid', lookupKey: uid[1] };
    const lookupRef = sanitizeProviderLookupRef(text, providerFamily);
    if (lookupRef) return { lookupKind: 'provider-url', lookupKey: hashProviderLookupRef(lookupRef), lookupRef };
    return null;
  }

  function safeLookupSourceField(value) {
    const field = String(value || '');
    return /^[A-Za-z_][A-Za-z0-9_]{0,80}$/.test(field) ? field : 'providerLink';
  }

  function sanitizeProviderLookupRow(row) {
    const input = row && typeof row === 'object' ? row : {};
    const source = sourceFromRoute(input.source);
    const providerFamily = String(input.providerFamily || '');
    const lookupKind = String(input.lookupKind || '');
    let lookupKey = String(input.lookupKey || '');
    let lookupRef = '';
    if (!source || !providerFamily) return null;
    if (lookupKind === 'mk-sequence') {
      lookupKey = lookupKey.replace(/[^0-9]/g, '');
      if (!/^\d{1,20}$/.test(lookupKey)) return null;
    } else if (lookupKind === 'mk-uid') {
      lookupKey = lookupKey.replace(/[^0-9]/g, '');
      if (!/^\d{5,15}$/.test(lookupKey)) return null;
    } else if (lookupKind === 'provider-url') {
      lookupRef = sanitizeProviderLookupRef(input.lookupRef, providerFamily);
      if (!lookupRef) return null;
      lookupKey = /^provider:[a-f0-9]{8}$/.test(lookupKey) ? lookupKey : hashProviderLookupRef(lookupRef);
    } else {
      return null;
    }
    if ((lookupKind === 'mk-sequence' || lookupKind === 'mk-uid') && providerFamily !== 'mk') return null;
    const result = {
      source,
      providerFamily,
      lookupKind,
      lookupKey,
      sourceField: safeLookupSourceField(input.sourceField),
      dongToken: normalizeDongToken(input.dongToken || '') || '',
      typeToken: normalizeText(input.typeToken || '').toUpperCase().slice(0, 24),
      articleMarker: safeArticleMarker(input.articleMarker)
    };
    const pyeongNo = normalizePyeongNoToken(input.pyeongNo || input.ptpNo || input.pyeongTypeNo || '');
    const exclusiveSpace = normalizeAreaValue(input.exclusiveSpace || input.exclusiveArea || input.excluseSpc || 0);
    if (pyeongNo) result.pyeongNo = pyeongNo;
    if (exclusiveSpace) result.exclusiveSpace = exclusiveSpace;
    if (lookupKind === 'provider-url') result.lookupRef = lookupRef;
    return result;
  }

  function collectProviderLookupFromValue(value, source, rows, depth, context) {
    if (!value || rows.length >= MAX_ROWS || depth > MAX_DEPTH) return;
    if (Array.isArray(value)) {
      for (const item of value.slice(0, MAX_ARRAY_ITEMS)) {
        collectProviderLookupFromValue(item, source, rows, depth + 1, context);
      }
      return;
    }
    if (typeof value !== 'object') return;

    const next = Object.assign({}, context || {});
    const articleMarker = articleMarkerFromObject(value, next.articleMarker);
    const dongToken = displayDongTokenFromObject(value);
    const rowTypeToken = typeTokenFromObject(value);
    const pyeongNo = pyeongNoFromObject(value);
    const exclusiveSpace = exclusiveSpaceFromObject(value);
    if (articleMarker) next.articleMarker = articleMarker;
    if (dongToken) next.dongToken = dongToken;
    if (rowTypeToken) next.typeToken = rowTypeToken;
    if (pyeongNo) next.pyeongNo = pyeongNo;
    if (exclusiveSpace) next.exclusiveSpace = exclusiveSpace;

    for (const [field, raw] of Object.entries(value).slice(0, MAX_OBJECT_VALUES)) {
      if (typeof raw !== 'string' && typeof raw !== 'number') continue;
      const text = String(raw || '');
      if (!PROVIDER_LOOKUP_FIELD_PATTERN.test(field) && !PROVIDER_LOOKUP_VALUE_PATTERN.test(text)) continue;
      const providerFamily = providerFamilyFromLookupValue(field, text);
      const token = providerLookupTokenFromValue(text, providerFamily);
      if (!providerFamily || !token) continue;
      const row = sanitizeProviderLookupRow({
        source,
        providerFamily,
        lookupKind: token.lookupKind,
        lookupKey: token.lookupKey,
        lookupRef: token.lookupRef || '',
        sourceField: field,
        dongToken: next.dongToken || '',
        typeToken: next.typeToken || '',
        articleMarker: next.articleMarker || '',
        pyeongNo: next.pyeongNo || '',
        exclusiveSpace: next.exclusiveSpace || 0
      });
      if (row) rows.push(row);
    }

    for (const child of Object.values(value).slice(0, MAX_OBJECT_VALUES)) {
      if (child && typeof child === 'object') collectProviderLookupFromValue(child, source, rows, depth + 1, next);
    }
  }

  function dedupeProviderLookupRows(rows) {
    const seen = new Set();
    const result = [];
    for (const row of rows.map(sanitizeProviderLookupRow).filter(Boolean)) {
      const key = [
        row.source,
        row.providerFamily,
        row.lookupKind,
        row.lookupKey,
        row.dongToken,
        row.typeToken,
        row.pyeongNo || '',
        row.exclusiveSpace || '',
        row.articleMarker || ''
      ].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(row);
      if (result.length >= 40) break;
    }
    return result;
  }

  function collectActiveGroupProviderLookupRows(body, route) {
    const source = sourceFromRoute(route);
    if (!source) return [];
    const rows = [];
    collectProviderLookupFromValue(body, source, rows, 0, {});
    return dedupeProviderLookupRows(rows);
  }

  function shouldStopActiveGroupRouteStatus(status) {
    return Number(status) === 429;
  }

  const api = {
    buildActiveGroupRouteRequest,
    buildNaverBuildingLineMapRouteRequests,
    buildNaverPyeongTypeRouteRequest,
    collectActiveGroupCandidateRows,
    collectActiveGroupFloorHintDiagnostics,
    collectActiveGroupFloorHintRows,
    collectActiveGroupProviderLookupRows,
    collectComplexDongRows,
    summarizeActiveGroupRouteShape,
    shouldStopActiveGroupRouteStatus
  };

  globalScope.DHS_ACTIVE_GROUP_ROUTES = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
