(function installDhsAnythingPageHook() {
  const VERSION = '0.1.77';
  const SOURCE = 'DHS_ANYTHING_CHROME_PAGE';
  const BRIDGE_SOURCE = 'DHS_ANYTHING_CHROME_BRIDGE';
  const EVENT = 'DHS_ANYTHING_CHROME_PAGE_EVENT';
  const GROUP_ROUTE_REQUEST = 'DHS_ANYTHING_CHROME_ACTIVE_GROUP_ROUTE_REQUEST';
  const DONG = '\uB3D9';
  const HO = '\uD638';
  const FLOOR = '\uCE35';
  const SERVE_ROW_FIELD = 'serve-row';
  const MAX_PROVIDER_PAYLOAD_CHARS = 400000;
  const MAX_NAVER_OTHER_PAYLOAD_CHARS = 120000;
  const MAX_CACHED_LINE_MAP_BODIES = 8;
  const LINE_MAP_BODY_CACHE_TTL_MS = 90 * 1000;
  const BUILDING_LINE_MAP_FETCH_TIMEOUT_MS = 3000;
  const ACTIVE_GROUP_ROUTE_FETCH_TIMEOUT_MS = 2500;
  const OPTIONAL_LINE_MAP_ROUTE_DELAY_MS = 900;
  const OPTIONAL_LINE_MAP_GUARD_RETRY_DELAY_MS = 250;
  const OPTIONAL_LINE_MAP_GUARD_MAX_RETRIES = 5;
  const NAVER_HOSTS = new Set(['new.land.naver.com', 'fin.land.naver.com']);
  const KB_ALIAS_HOSTS = [
    'kbland.kr',
    'data-api.kbland.kr',
    'm.kbland.kr',
    'onland.kbstar.com'
  ];
  const CP_PROVIDER_HOSTS = [
    { domain: 'land.mk.co.kr', family: 'mk' },
    { domain: 'm.land.mk.co.kr', family: 'mk' },
    { domain: 'landad.mk.co.kr', family: 'mk' },
    { domain: 'r114.com', family: 'r114' },
    { domain: 'n.gongsilclub.com', family: 'gongsilclub' },
    { domain: 'm.gongsilclub.com', family: 'gongsilclub' },
    { domain: 'homesdid.co.kr', family: 'homesdid' },
    { domain: 'm.homesdid.co.kr', family: 'homesdid' },
    { domain: 'serve.co.kr', family: 'serve' },
    { domain: 'rfine.kr', family: 'rfine' },
    { domain: 'rter2.com', family: 'rter' },
    { domain: 'rego.kr', family: 'rter' },
    { domain: 'm.rego.kr', family: 'rter' },
    { domain: 'asil.kr', family: 'asil' },
    { domain: 'realestate.hankyung.com', family: 'hankyung' },
    { domain: 'maemul.hankyung.com', family: 'hankyung' },
    { domain: 'land.hankyung.com', family: 'hankyung' },
    { domain: 'hankyung.com', family: 'hankyung' },
    { domain: 'www.hankyung.com', family: 'hankyung' },
    { domain: 'land.daara.co.kr', family: 'daara' },
    { domain: 'm.land.daara.co.kr', family: 'daara' },
    { domain: 'industryland.co.kr', family: 'daara' },
    { domain: 'www.industryland.co.kr', family: 'daara' },
    { domain: 'neonet.co.kr', family: 'neonet' },
    { domain: 'www.neonet.co.kr', family: 'neonet' },
    { domain: 'm.neonet.co.kr', family: 'neonet' },
    { domain: 'ten.co.kr', family: 'ten' },
    { domain: 'karhanbang.com', family: 'kar' },
    { domain: 'www.karhanbang.com', family: 'kar' },
    { domain: 'thebiz.co.kr', family: 'thebiz' },
    { domain: 'www.thebiz.co.kr', family: 'thebiz' },
    { domain: 'thebiz.kr', family: 'thebiz' },
    { domain: 'www.thebiz.kr', family: 'thebiz' },
    { domain: 'woori-house.co.kr', family: 'woori' },
    { domain: 'landcenter.kiso.or.kr', family: 'kiso' }
  ];
  const PROVIDER_FIELD_NAMES = [
    'address1',
    'addr1',
    'address2',
    'addr2',
    'addr3',
    'address3',
    'Addr2',
    'Address2',
    'dongNo',
    'dong_no',
    'buildingNo',
    'bildNo',
    'detailAddress',
    'dongHo',
    'hoNo',
    'hoName',
    'unitNo',
    'roomNo',
    'ADDR2',
    'DTL_ADDR',
    'detail_addr',
    'houseNo',
    'hoNm',
    'article_address2',
    'article_address3',
    'DONG_NM',
    'kiso_address2',
    'dong_name',
    'dongName',
    'dong',
    'dongNm',
    'address_ho',
    'ho',
    SERVE_ROW_FIELD,
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
    'floor_cnt_total',
    'floorCnt',
    'floorCntTotal',
    'frlFloor',
    'roomFloor',
    'unitFloor',
    'Floor1',
    'Floor2',
    'FloorName',
    'floorType',
    'buildingHighestFloor'
  ];
  const PROVIDER_FIELD_SET = new Set(PROVIDER_FIELD_NAMES.map((name) => name.toLowerCase()));
  const NAVER_LINE_MAP_CATEGORIES = new Set(['article', 'buildingUnits', 'landprice', 'pyeongtype', 'prices', 'complexCache', 'naverOther']);
  const ARTICLE_MARKER_FIELDS = [
    'articleNo',
    'atclNo',
    'articleId',
    'articleID',
    'detailCode',
    'representativeArticleNo'
  ];
  const pyeongTypeRouteKeys = new Set();
  const cachedLineMapBodies = [];
  const articleBuildNoByMarker = new Map();
  let naverAuthorizationHeader = '';

  function versionParts(value) {
    return String(value || '').split('.').map((part) => {
      const number = Number.parseInt(part, 10);
      return Number.isFinite(number) ? number : 0;
    });
  }

  function isSameOrNewerVersion(existing, current) {
    const left = versionParts(existing);
    const right = versionParts(current);
    for (let index = 0; index < Math.max(left.length, right.length, 3); index += 1) {
      const leftPart = left[index] || 0;
      const rightPart = right[index] || 0;
      if (leftPart > rightPart) return true;
      if (leftPart < rightPart) return false;
    }
    return true;
  }

  if (window.__DHS_ANYTHING_CHROME_PAGE_HOOK__ && isSameOrNewerVersion(window.__DHS_ANYTHING_CHROME_PAGE_HOOK__, VERSION)) return;
  window.__DHS_ANYTHING_CHROME_PAGE_HOOK__ = VERSION;

  function hashMarker(value) {
    const input = String(value || '');
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return `article:${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }

  function classifyEndpoint(input) {
    const href = String(input || '');
    let pathname = href;
    let search = '';
    let hostname = '';
    try {
      const parsed = new URL(href, location.href);
      pathname = parsed.pathname;
      search = parsed.search;
      hostname = parsed.hostname.toLowerCase();
    } catch (_) {
      pathname = href.split('?')[0];
    }

    if (/\/api\/articles\/sameAddress/.test(pathname)) return { category: 'sameAddress' };
    if (/representativeArticleNo=/.test(search)) return { category: 'representativeArticles' };
    if (/\/api\/articles\/complex\/\d+/.test(pathname)) return { category: 'complexList' };
    if (/\/api\/articles(?:\?|$)/.test(pathname) && /(?:[?&])(?:complexNo|hscpNo)=/.test(search)) return { category: 'complexList' };
    if (/\/api\/articles\//.test(pathname) || /\/api\/articles(?:\?|$)/.test(pathname)) return { category: 'article' };
    if (/\/landprice/.test(pathname)) return { category: 'landprice' };
    if (/\/pyeongtype/.test(pathname)) return { category: 'pyeongtype' };
    if (/\/prices/.test(pathname)) return { category: 'prices' };
    if (/\/buildings\/units/.test(pathname)) return { category: 'buildingUnits' };
    if (/\/api\/complexes(?:\/|$)/.test(pathname)) return { category: 'complexCache' };
    if (NAVER_HOSTS.has(hostname)) return { category: 'naverOther' };
    if (KB_ALIAS_HOSTS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)) && isKbAliasEndpoint(hostname, pathname, search)) {
      return { category: 'kbAlias' };
    }
    const provider = CP_PROVIDER_HOSTS.find((item) => hostname === item.domain || hostname.endsWith(`.${item.domain}`));
    if (provider) {
      return { category: 'cpProvider', providerFamily: provider.family };
    }
    return { category: 'other' };
  }

  function isKbAliasEndpoint(hostname, pathname, search) {
    if (hostname === 'data-api.kbland.kr' || hostname.endsWith('.data-api.kbland.kr')) {
      return /\/land-complex\/complex(?:\/|$)/.test(pathname) && /(?:[?&])complexNo=/.test(search);
    }
    if (hostname === 'kbland.kr' || hostname.endsWith('.kbland.kr') || hostname === 'm.kbland.kr' || hostname.endsWith('.m.kbland.kr')) {
      return /^\/c\/\d+(?:\/|$)/.test(pathname);
    }
    if (hostname === 'onland.kbstar.com' || hostname.endsWith('.onland.kbstar.com')) {
      return /complex/i.test(pathname) && /(?:[?&])complexNo=/.test(search);
    }
    return false;
  }

  function classifyStopCondition(status) {
    if (Number(status) === 429) return 'stop';
    return 'continue';
  }

  function isNaverLandUrl(input) {
    try {
      const parsed = new URL(String(input || ''), location.href);
      const hostname = parsed.hostname.toLowerCase();
      return hostname === 'land.naver.com' || hostname.endsWith('.land.naver.com');
    } catch (_) {
      return false;
    }
  }

  function authorizationFromHeaders(source) {
    try {
      if (!source) return '';
      const headers = new Headers(source);
      return String(headers.get('Authorization') || '').trim();
    } catch (_) {
      return '';
    }
  }

  function rememberNaverAuthorizationHeader(value) {
    const text = String(value || '').trim();
    if (/^Bearer\s+/i.test(text)) naverAuthorizationHeader = text;
  }

  function captureNaverAuthorizationHeader(input, init) {
    if (!isNaverLandUrl(endpointFromFetchInput(input))) return;
    rememberNaverAuthorizationHeader(authorizationFromHeaders(init && init.headers) || authorizationFromHeaders(input && input.headers));
  }

  function captureNaverAuthorizationHeaderFromXhr(url, name, value) {
    if (String(name || '').toLowerCase() !== 'authorization') return;
    if (!isNaverLandUrl(url)) return;
    rememberNaverAuthorizationHeader(value);
  }

  function currentArticleMarker() {
    try {
      const articleNo = new URL(location.href).searchParams.get('articleNo');
      return articleNo ? hashMarker(articleNo) : '';
    } catch (_) {
      return '';
    }
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function canonicalNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? String(number) : String(value || '');
  }

  function extractDongToken(value) {
    const match = normalizeText(value).match(new RegExp(`(?<!\\d)(\\d{1,4})\\s*${DONG}`));
    return match ? `${canonicalNumber(match[1])}${DONG}` : '';
  }

  function extractHoToken(value) {
    const match = normalizeText(value).match(new RegExp(`(?<!\\d)(\\d{1,4})\\s*${HO}`));
    return match ? `${canonicalNumber(match[1])}${HO}` : '';
  }

  function numericDongToken(value) {
    const text = normalizeText(value).replace(/[^0-9A-Za-z]/g, '');
    return /^[0-9]{1,4}$/.test(text) ? `${canonicalNumber(text)}${DONG}` : '';
  }

  function displayNumericDongToken(value) {
    const text = normalizeText(value).replace(/[^0-9]/g, '');
    return /^[0-9]{3,4}$/.test(text) ? `${canonicalNumber(text)}${DONG}` : '';
  }

  function safeNumericDongNo(value) {
    const text = String(value || '').trim();
    return /^\d{1,24}$/.test(text) ? text : '';
  }

  function safeNumericId(value) {
    const text = String(value || '').trim();
    return /^\d{4,24}$/.test(text) ? text : '';
  }

  function safeArticleMarker(value) {
    const marker = String(value || '');
    return /^article:[a-f0-9]{8,12}$/.test(marker) ? marker : '';
  }

  function buildingUnitsRouteKey(articleMarker, complexNo, buildNo) {
    const marker = safeArticleMarker(articleMarker);
    const complex = safeNumericId(complexNo);
    const building = safeNumericId(buildNo);
    return marker && complex && building
      ? `${marker}:${complex}:${building}:buildingUnits`
      : '';
  }

  function numericHoToken(value) {
    const text = normalizeText(value).replace(/[^0-9A-Za-z]/g, '');
    return /^[A-Za-z]?[0-9]{2,4}$/.test(text) ? `${String(text).toUpperCase()}${HO}` : '';
  }

  function boundedDisplayCandidate(value) {
    const text = normalizeText(value);
    const dongToken = extractDongToken(text);
    const hoToken = extractHoToken(text);
    return dongToken && hoToken ? `${dongToken} ${hoToken}` : '';
  }

  function groupSourceFromCategory(category) {
    if (category === 'sameAddress') return 'sameAddress';
    if (category === 'representativeArticles') return 'representative-main';
    if (category === 'complexList') return 'complex-list';
    if (category === 'complexCache') return 'complex-cache';
    return '';
  }

  function primitiveText(value) {
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    return '';
  }

  function boundedProviderFieldValue(value) {
    const text = normalizeText(value);
    return text ? text.slice(0, 180) : '';
  }

  function pushProviderFieldValue(rows, sourceField, value) {
    const field = String(sourceField || '');
    if (!PROVIDER_FIELD_SET.has(field.toLowerCase())) return;
    const text = boundedProviderFieldValue(value);
    if (!text) return;
    rows.push({ sourceField: field, value: text });
  }

  function collectProviderFieldValuesFromValue(value, rows, depth) {
    if (!value || rows.length >= 80 || depth > 8) return;
    if (Array.isArray(value)) {
      for (const item of value.slice(0, 200)) collectProviderFieldValuesFromValue(item, rows, depth + 1);
      return;
    }
    if (typeof value !== 'object') return;

    for (const [key, child] of Object.entries(value).slice(0, 160)) {
      if (PROVIDER_FIELD_SET.has(String(key).toLowerCase()) && (typeof child === 'string' || typeof child === 'number')) {
        pushProviderFieldValue(rows, key, child);
      } else if (child && typeof child === 'object') {
        collectProviderFieldValuesFromValue(child, rows, depth + 1);
      }
    }
  }

  function firstPrimitive(object, fields) {
    for (const field of fields) {
      const value = primitiveText(object[field]);
      if (value) return value;
    }
    return '';
  }

  function articleMarkerFromObject(object, inheritedArticleMarker) {
    const explicit = safeNumericId(firstPrimitive(object || {}, ARTICLE_MARKER_FIELDS));
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
    return extractDongToken(explicit) || displayNumericDongToken(explicit) || displayNumericDongToken(firstPrimitive(object, [
      'buildingNo',
      'bildNo',
      'dong'
    ]));
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

  function numericFieldFromNestedValue(value, fields, depth) {
    if (!value || depth > 7) return '';
    if (Array.isArray(value)) {
      for (const item of value.slice(0, 120)) {
        const found = numericFieldFromNestedValue(item, fields, depth + 1);
        if (found) return found;
      }
      return '';
    }
    if (typeof value !== 'object') return '';
    for (const [key, child] of Object.entries(value).slice(0, 140)) {
      if (fields.includes(key)) {
        const numeric = safeNumericDongNo(primitiveText(child));
        if (numeric) return numeric;
      }
      if (child && typeof child === 'object') {
        const found = numericFieldFromNestedValue(child, fields, depth + 1);
        if (found) return found;
      }
    }
    return '';
  }

  function shortRouteErrorReason(error) {
    const name = String(error && error.name || 'error').replace(/[^A-Za-z0-9]/g, '').slice(0, 24).toLowerCase() || 'error';
    const message = String(error && error.message || '').toLowerCase();
    if (/body is not defined/.test(message)) return `${name}-body-undefined`;
    if (/encodeuricomponent/.test(message)) return `${name}-encode-uri`;
    if (/is not defined/.test(message)) return `${name}-not-defined`;
    if (/invalid url|failed to construct/.test(message)) return `${name}-invalid-url`;
    if (/cyclic|circular/.test(message)) return `${name}-circular`;
    return name;
  }

  function collectComplexDongRowsFromValue(value, rows, depth, context) {
    const inherited = context && typeof context === 'object' ? context : {};
    if (!value || rows.length >= 80 || depth > 8) return;
    if (Array.isArray(value)) {
      for (const item of value.slice(0, 200)) collectComplexDongRowsFromValue(item, rows, depth + 1, inherited);
      return;
    }
    if (typeof value !== 'object') return;

    const dongToken = displayDongTokenFromObject(value) || inherited.dongToken || '';
    const dongNo = dongNoFromObject(value) || inherited.dongNo || '';
    const buildNo = buildNoFromObject(value) || inherited.buildNo || '';
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
    for (const child of Object.values(value).slice(0, 160)) {
      if (child && typeof child === 'object') collectComplexDongRowsFromValue(child, rows, depth + 1, nextContext);
    }
  }

  function collectComplexDongRowsFromBody(body) {
    const rows = [];
    collectComplexDongRowsFromValue(body, rows, 0);
    const seen = new Set();
    const result = [];
    for (const row of rows) {
      const key = `${row.dongToken}:${row.dongNo}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(row);
      if (result.length >= 80) break;
    }
    return result;
  }

  function safeShapeKeyName(value) {
    const text = String(value || '');
    return /^[A-Za-z_][A-Za-z0-9_]{0,48}$/.test(text) ? text : '';
  }

  function summarizeMatchedComplexDongRows(body, detailDongToken) {
    const targetDongToken = extractDongToken(detailDongToken) || displayNumericDongToken(detailDongToken);
    if (!targetDongToken) return '';
    const stats = {
      count: 0,
      keys: new Set(),
      numericKeys: new Set(),
      buildLikeKeys: new Set()
    };
    const visit = (value, depth) => {
      if (!value || depth > 8 || stats.count >= 12) return;
      if (Array.isArray(value)) {
        for (const item of value.slice(0, 200)) visit(item, depth + 1);
        return;
      }
      if (typeof value !== 'object') return;
      if (displayDongTokenFromObject(value) === targetDongToken) {
        stats.count += 1;
        for (const [key, child] of Object.entries(value).slice(0, 120)) {
          const safeKey = safeShapeKeyName(key);
          if (!safeKey) continue;
          stats.keys.add(safeKey);
          if (/^(?:build|bld|bild|building|dong|ho|house|unit|apt|complex|hscp|ptp|pyeong).*(?:no|num|id|seq)?$/i.test(safeKey)) {
            stats.buildLikeKeys.add(safeKey);
          }
          if (typeof child === 'string' || typeof child === 'number') {
            const numeric = String(child).replace(/[^0-9]/g, '');
            if (/^\d{1,24}$/.test(numeric)) stats.numericKeys.add(safeKey);
          }
        }
      }
      for (const child of Object.values(value).slice(0, 120)) {
        if (child && typeof child === 'object') visit(child, depth + 1);
      }
    };
    visit(body, 0);
    if (!stats.count) return 'matchedDongRows:0';
    const keys = Array.from(stats.keys).sort((a, b) => a.localeCompare(b, 'en')).slice(0, 36).join(',');
    const numericKeys = Array.from(stats.numericKeys).sort((a, b) => a.localeCompare(b, 'en')).slice(0, 24).join(',');
    const buildLikeKeys = Array.from(stats.buildLikeKeys).sort((a, b) => a.localeCompare(b, 'en')).slice(0, 24).join(',');
    return [
      `matchedDongRows:${stats.count}`,
      keys ? `matchedKeys:${keys}` : '',
      numericKeys ? `numericKeys:${numericKeys}` : '',
      buildLikeKeys ? `buildLikeKeys:${buildLikeKeys}` : ''
    ].filter(Boolean).join(' ');
  }

  function serveRowDisplayCandidate(object) {
    const row = object && typeof object === 'object' ? object : {};
    const ownText = [
      'buildingName',
      'buildingNm',
      'bldgNm',
      'dongName',
      'dongNm',
      'DONG_NM',
      'dongNo',
      'dong',
      'address1',
      'addr1',
      'address2',
      'addr2',
      'addr3',
      'address3',
      'detailAddress',
      'dongHo',
      'hoNo',
      'hoName',
      'unitNo',
      'roomNo',
      'houseNo',
      'hoNm',
      'ho',
      'address_ho',
      'article_address3'
    ].map((field) => primitiveText(row[field])).filter(Boolean).join(' ');
    const direct = boundedDisplayCandidate(ownText);
    if (direct) return direct;

    const dongToken = extractDongToken(ownText) || numericDongToken(firstPrimitive(row, [
      'address1',
      'addr1',
      'dongNo',
      'dong',
      'dongName',
      'dongNm',
      'DONG_NM',
      'buildingNo',
      'bildNo',
      'buildingNm',
      'bldgNm'
    ]));
    const hoToken = extractHoToken(ownText) || numericHoToken(firstPrimitive(row, [
      'address2',
      'addr2',
      'addr3',
      'address3',
      'hoNo',
      'hoName',
      'unitNo',
      'roomNo',
      'houseNo',
      'hoNm',
      'ho',
      'address_ho',
      'article_address3'
    ]));
    return dongToken && hoToken ? `${dongToken} ${hoToken}` : '';
  }

  function serveRowFloorText(object) {
    const row = object && typeof object === 'object' ? object : {};
    const floor = firstPrimitive(row, [
      'flr1',
      'floor',
      'atclFlr',
      'floor_cnt',
      'floorCnt',
      'currentFloor',
      'frlFloor',
      'roomFloor',
      'unitFloor',
      'Floor1',
      'Floor2',
      'FloorName',
      'floorType'
    ]);
    const total = firstPrimitive(row, [
      'flr2',
      'floorTotal',
      'totalFloor',
      'floor_cnt_total',
      'floorCntTotal',
      'buildingHighestFloor'
    ]);
    const floorText = normalizeText(floor);
    if (!floorText || /(?:\uACE0|\uC911|\uC800)\s*(?:\uCE35)?\s*\/|(?:\uCD1D|\uCD5C\uACE0|\uC804\uCCB4)\s*\d{1,3}\s*\uCE35/.test(floorText)) return '';
    const slash = floorText.match(/^(\d{1,2})\s*\/\s*(\d{1,3})\s*\uCE35?$/);
    const labelled = floorText.match(/(?:\uD574\uB2F9\s*\uCE35|\uCE35\s*\uC218|\uB9E4\uBB3C\s*\uCE35|floor|atclFlr)\D{0,12}(\d{1,2})\s*\uCE35?/i);
    const exact = floorText.match(/^(\d{1,2})\s*\uCE35?$/);
    const floorValue = slash ? slash[1] : (labelled ? labelled[1] : (exact ? exact[1] : ''));
    const totalValue = slash ? slash[2] : String(total || '').trim();
    if (!/^\d{1,2}$/.test(floorValue)) return '';
    if (/^\d{1,3}$/.test(totalValue)) {
      return `\uD574\uB2F9\uCE35/\uCD1D\uCE35 ${floorValue}/${totalValue}${FLOOR}`;
    }
    return `${floorValue}${FLOOR}`;
  }

  function collectServeRowFieldValuesFromValue(value, rows, depth) {
    if (!value || rows.length >= 80 || depth > 8) return;
    if (Array.isArray(value)) {
      for (const item of value.slice(0, 200)) collectServeRowFieldValuesFromValue(item, rows, depth + 1);
      return;
    }
    if (typeof value !== 'object') return;

    const displayCandidate = serveRowDisplayCandidate(value);
    if (displayCandidate) {
      const rowText = normalizeText([
        displayCandidate,
        typeTokenFromObject(value),
        serveRowFloorText(value)
      ].filter(Boolean).join(' '));
      pushProviderFieldValue(rows, SERVE_ROW_FIELD, rowText);
    }

    for (const child of Object.values(value).slice(0, 120)) {
      if (child && typeof child === 'object') {
        collectServeRowFieldValuesFromValue(child, rows, depth + 1);
      }
    }
  }

  function collectProviderFieldValuesFromText(text) {
    const content = String(text || '');
    if (!content || content.length > MAX_PROVIDER_PAYLOAD_CHARS) return [];
    const rows = [];

    for (const field of PROVIDER_FIELD_NAMES) {
      const safeField = String(field).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const scriptPattern = new RegExp(`(?<![A-Za-z0-9_])["']?${safeField}["']?\\s*[:=]\\s*["']([^"']{1,160})["']`, 'gi');
      let scriptMatch;
      while ((scriptMatch = scriptPattern.exec(content)) && rows.length < 80) {
        pushProviderFieldValue(rows, field, scriptMatch[1] || '');
      }

      const inputPattern = new RegExp(
        `(?:name|id)=["']${safeField}["'][^>]{0,300}?value=["']([^"']{1,160})["']|value=["']([^"']{1,160})["'][^>]{0,300}?(?:name|id)=["']${safeField}["']`,
        'gi'
      );
      let inputMatch;
      while ((inputMatch = inputPattern.exec(content)) && rows.length < 80) {
        pushProviderFieldValue(rows, field, inputMatch[1] || inputMatch[2] || '');
      }
    }

    try {
      const params = new URLSearchParams(content);
      for (const field of PROVIDER_FIELD_NAMES) {
        if (params.has(field)) pushProviderFieldValue(rows, field, params.get(field));
      }
    } catch (_) {}

    return dedupeProviderFieldValues(rows);
  }

  function dedupeProviderFieldValues(rows) {
    const seen = new Set();
    return rows.filter((row) => {
      const key = `${String(row.sourceField).toLowerCase()}:${row.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 40);
  }

  function collectProviderFieldValuesFromBody(body, category, providerFamily) {
    if (category !== 'cpProvider') return [];
    const rows = [];
    const serveRows = [];
    if (providerFamily === 'serve') collectServeRowFieldValuesFromValue(body, serveRows, 0);
    collectProviderFieldValuesFromValue(body, rows, 0);
    return dedupeProviderFieldValues(serveRows.concat(rows));
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

  function collectGroupCandidatesFromValue(value, source, rows, inheritedText, depth, inheritedArticleMarker) {
    if (!value || rows.length >= 80 || depth > 8) return;
    if (Array.isArray(value)) {
      for (const item of value.slice(0, 200)) collectGroupCandidatesFromValue(item, source, rows, inheritedText, depth + 1, inheritedArticleMarker);
      return;
    }
    if (typeof value !== 'object') return;

    const articleMarker = articleMarkerFromObject(value, inheritedArticleMarker);
    const ownText = [
      'buildingName',
      'dongName',
      'dongNo',
      'dong',
      'address2',
      'addr2',
      'addr3',
      'address3',
      'Addr2',
      'Address2',
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
      'DONG_NM'
    ].map((field) => primitiveText(value[field])).filter(Boolean).join(' ');
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
    for (const child of Object.values(value).slice(0, 120)) {
      if (child && typeof child === 'object') {
        collectGroupCandidatesFromValue(child, source, rows, nextInherited, depth + 1, articleMarker);
      }
    }
  }

  function dedupeGroupCandidateRows(rows) {
    const seen = new Set();
    return rows.filter((row) => {
      const key = `${row.source}:${row.displayCandidate}:${row.typeToken}:${row.articleMarker || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 40);
  }

  function collectGroupCandidatesFromBody(body, category) {
    const source = groupSourceFromCategory(category);
    if (!source) return [];
    const rows = [];
    collectGroupCandidatesFromValue(body, source, rows, '', 0, '');
    return dedupeGroupCandidateRows(rows);
  }

  async function collectGroupCandidates(response, category) {
    if (!response || typeof response.clone !== 'function') return [];
    try {
      const contentType = String(response.headers && response.headers.get ? response.headers.get('content-type') : '');
      if (contentType && !/json/i.test(contentType)) return [];
      const body = await response.clone().json();
      return collectGroupCandidatesFromBody(body, category);
    } catch (_) {
      return [];
    }
  }

  async function collectProviderLookupRows(response, category) {
    const activeApi = window.DHS_ACTIVE_GROUP_ROUTES;
    if (!activeApi || typeof activeApi.collectActiveGroupProviderLookupRows !== 'function') return [];
    if (!response || typeof response.clone !== 'function') return [];
    try {
      const contentType = String(response.headers && response.headers.get ? response.headers.get('content-type') : '');
      if (contentType && !/json/i.test(contentType)) return [];
      const body = await response.clone().json();
      return activeApi.collectActiveGroupProviderLookupRows(body, groupSourceFromCategory(category) || category);
    } catch (_) {
      return [];
    }
  }

  async function collectProviderFieldValues(response, category, providerFamily) {
    if (category !== 'cpProvider' || !response || typeof response.clone !== 'function') return [];
    if (classifyStopCondition(response.status) === 'stop' || Number(response.status) >= 400) return [];
    try {
      const contentType = String(response.headers && response.headers.get ? response.headers.get('content-type') : '');
      const contentLength = Number(response.headers && response.headers.get ? response.headers.get('content-length') : 0) || 0;
      if (contentLength > MAX_PROVIDER_PAYLOAD_CHARS) return [];
      if (contentType && /json/i.test(contentType)) {
        const body = await response.clone().json();
        return collectProviderFieldValuesFromBody(body, category, providerFamily);
      }
      const payloadText = await response.clone().text();
      if (!payloadText || payloadText.length > MAX_PROVIDER_PAYLOAD_CHARS) return [];
      if (/^\s*[\[{]/.test(payloadText)) {
        try {
          return collectProviderFieldValuesFromBody(JSON.parse(payloadText), category, providerFamily);
        } catch (_) {}
      }
      if (!PROVIDER_FIELD_NAMES.some((field) => payloadText.includes(field))) return [];
      return collectProviderFieldValuesFromText(payloadText);
    } catch (_) {
      return [];
    }
  }

  function lineMapContextFromFetchContext(fetchContext) {
    const input = fetchContext && typeof fetchContext === 'object' ? fetchContext : {};
    return {
      articleMarker: safeArticleMarker(input.articleMarker) || currentArticleMarker(),
      dongToken: input.detailDongToken || '',
      typeToken: input.detailTypeToken || '',
      floorValue: Number(input.detailFloorValue || 0) || 0,
      floorBand: input.detailFloorBand || '',
      totalFloor: Number(input.detailTotalFloor || 0) || 0,
      exclusiveSpace: Number(input.detailExclusiveSpace || input.exclusiveSpace || 0) || 0,
      pyeongNo: String(input.detailPyeongNo || input.pyeongNo || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32),
      detailBuildNo: safeNumericDongNo(input.detailBuildNo),
      detailDongNo: safeNumericDongNo(input.detailDongNo),
      detailDisplayDongToken: extractDongToken(input.detailDisplayDongToken || '') || displayNumericDongToken(input.detailDisplayDongToken || '')
    };
  }

  function normalizeArticleAreaValue(value) {
    if (typeof value === 'number') {
      return Number.isFinite(value) && value > 0 && value < 400 ? value : 0;
    }
    const text = normalizeText(value).replace(/,/g, '');
    const match = text.match(/(?<!\d)(\d{1,3}(?:\.\d{1,4})?)(?!\d)/);
    if (!match) return 0;
    const number = Number(match[1]);
    return Number.isFinite(number) && number > 0 && number < 400 ? number : 0;
  }

  function normalizeArticleFloorValue(value) {
    if (typeof value === 'number') {
      return Number.isInteger(value) && value > 0 && value < 100 ? value : 0;
    }
    const text = normalizeText(value);
    if (!text) return 0;
    const match = text.match(/^(\d{1,2})(?:\s*\uCE35)?$/);
    if (!match) return 0;
    const number = Number(match[1]);
    return number > 0 && number < 100 ? number : 0;
  }

  function normalizeArticleTotalFloorValue(value) {
    if (typeof value === 'number') {
      return Number.isInteger(value) && value > 0 && value < 200 ? value : 0;
    }
    const text = normalizeText(value);
    if (!text) return 0;
    const match = text.match(/^(\d{1,3})(?:\s*\uCE35)?$/);
    if (!match) return 0;
    const number = Number(match[1]);
    return number > 0 && number < 200 ? number : 0;
  }

  function sanitizePyeongNoToken(value) {
    return String(value || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
  }

  function articleDetailContextFromObject(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
    const detailPyeongNo = sanitizePyeongNoToken(firstPrimitive(input, [
      'pyeongNo',
      'ptpNo',
      'pyeongTypeNo',
      'pyeongTypeNumber'
    ]));
    const detailExclusiveSpace = normalizeArticleAreaValue(firstPrimitive(input, [
      'exclusiveSpace',
      'exclusiveArea',
      'exclusiveSpc',
      'excluseSpc',
      'realArea',
      'spc2',
      'area2',
      'privateArea',
      'useArea'
    ]));
    const detailFloorValue = normalizeArticleFloorValue(firstPrimitive(input, [
      'correspondingFloorCount',
      'correspondingFloor',
      'articleFloor',
      'article_floor',
      'atclFlr'
    ]));
    const detailTotalFloor = normalizeArticleTotalFloorValue(firstPrimitive(input, [
      'totalFloorCount',
      'buildingHighestFloor',
      'complexHighestFloor',
      'uppergroundFloorCount'
    ]));
    const detailBuildNo = safeNumericDongNo(firstPrimitive(input, [
      'buildNo',
      'buildingNo',
      'bildNo'
    ]));
    const detailDongNo = safeNumericDongNo(firstPrimitive(input, [
      'dongNo',
      'buildingNo',
      'bildNo',
      'dong'
    ]));
    const detailDisplayDongToken = displayDongTokenFromObject(input);
    const context = {};
    if (detailExclusiveSpace) context.detailExclusiveSpace = detailExclusiveSpace;
    if (detailPyeongNo) context.detailPyeongNo = detailPyeongNo;
    if (detailFloorValue) context.detailFloorValue = detailFloorValue;
    if (detailTotalFloor) context.detailTotalFloor = detailTotalFloor;
    if (detailBuildNo) context.detailBuildNo = detailBuildNo;
    if (detailDongNo) context.detailDongNo = detailDongNo;
    if (detailDisplayDongToken) context.detailDisplayDongToken = detailDisplayDongToken;
    return Object.keys(context).length ? context : null;
  }

  function collectArticleDetailContextFromBody(body) {
    if (!body || typeof body !== 'object') return null;
    const context = {};
    const articleBoundContext = {};
    const expectedArticleMarker = currentArticleMarker();
    const mergeCandidate = (target, candidate, options = {}) => {
      if (!candidate) return;
      if (!target.detailExclusiveSpace && candidate.detailExclusiveSpace) target.detailExclusiveSpace = candidate.detailExclusiveSpace;
      if (options.includePyeongNo && !target.detailPyeongNo && candidate.detailPyeongNo) target.detailPyeongNo = candidate.detailPyeongNo;
      if (!target.detailFloorValue && candidate.detailFloorValue) target.detailFloorValue = candidate.detailFloorValue;
      if (!target.detailTotalFloor && candidate.detailTotalFloor) target.detailTotalFloor = candidate.detailTotalFloor;
      if (!target.detailBuildNo && candidate.detailBuildNo) target.detailBuildNo = candidate.detailBuildNo;
      if (!target.detailDongNo && candidate.detailDongNo) target.detailDongNo = candidate.detailDongNo;
      if (!target.detailDisplayDongToken && candidate.detailDisplayDongToken) target.detailDisplayDongToken = candidate.detailDisplayDongToken;
    };
    const visit = (value, depth) => {
      if (!value || depth > 6) return;
      if (Array.isArray(value)) {
        for (const item of value.slice(0, 120)) visit(item, depth + 1);
        return;
      }
      if (typeof value !== 'object') return;
      const candidate = articleDetailContextFromObject(value);
      mergeCandidate(context, candidate, { includePyeongNo: false });
      const objectArticleMarker = articleMarkerFromObject(value, '');
      if (expectedArticleMarker && objectArticleMarker === expectedArticleMarker) {
        mergeCandidate(articleBoundContext, candidate, { includePyeongNo: true });
      }
      for (const child of Object.values(value).slice(0, 120)) {
        if (child && typeof child === 'object') visit(child, depth + 1);
      }
    };
    visit(body, 0);
    const output = Object.assign({}, context, articleBoundContext);
    if (!articleBoundContext.detailPyeongNo) delete output.detailPyeongNo;
    return Object.keys(output).length ? output : null;
  }

  function buildingUnitsContextFromFetchContext(fetchContext) {
    const input = fetchContext && typeof fetchContext === 'object' ? fetchContext : {};
    const lineMapContext = lineMapContextFromFetchContext(input);
    return Object.assign({}, lineMapContext, {
      articleMarker: safeArticleMarker(input.articleMarker) || safeArticleMarker(lineMapContext.articleMarker) || currentArticleMarker()
    });
  }

  function collectNaverLineMapRowsFromBody(body, category, fetchContext) {
    if (!NAVER_LINE_MAP_CATEGORIES.has(category)) return [];
    const api = window.DHS_NAVER_LINE_MAP;
    if (!api || typeof api.collectNaverLineMapRows !== 'function') return [];
    return api.collectNaverLineMapRows(body, lineMapContextFromFetchContext(fetchContext));
  }

  function rememberNaverLineMapBody(category, body) {
    if (!NAVER_LINE_MAP_CATEGORIES.has(category) || !body || typeof body !== 'object') return;
    if (category === 'article') rememberArticleBuildNo(body);
    cachedLineMapBodies.push({
      category,
      body,
      capturedAt: Date.now()
    });
    while (cachedLineMapBodies.length > MAX_CACHED_LINE_MAP_BODIES) cachedLineMapBodies.shift();
    scheduleCachedLineMapReplay(category, body, 8);
    scheduleBuildingUnitsFetchFromLineMapBody(category, body, 8);
  }

  function dongNoFromLineMapBody(body) {
    const direct = dongNoFromObject(body);
    if (direct) return direct;
    return numericFieldFromNestedValue(body, ['dongNo', 'buildingNo', 'bildNo', 'dong'], 0);
  }

  function buildNoFromLineMapBody(body) {
    return buildNoInfoFromLineMapBody(body).value;
  }

  function rememberArticleBuildNo(body) {
    const marker = currentArticleMarker();
    if (!marker) return;
    const articleContext = collectArticleDetailContextFromBody(body) || {};
    const buildNo = articleContext.detailBuildNo
      || numericFieldFromNestedValue(body, ['buildNo'], 0)
      || numericFieldFromNestedValue(body, ['buildingNo', 'bildNo'], 0);
    if (!buildNo) return;
    articleBuildNoByMarker.set(marker, {
      value: buildNo,
      dongNo: articleContext.detailDongNo || '',
      displayDongToken: articleContext.detailDisplayDongToken || '',
      source: articleContext.detailBuildNo ? 'article-detail-build' : 'article-build',
      capturedAt: Date.now()
    });
    if (articleBuildNoByMarker.size > 40) {
      const firstKey = articleBuildNoByMarker.keys().next().value;
      if (firstKey) articleBuildNoByMarker.delete(firstKey);
    }
  }

  function currentArticleBuildNoInfo() {
    const marker = currentArticleMarker();
    if (!marker) return { value: '', source: '' };
    const cached = articleBuildNoByMarker.get(marker);
    if (!cached || Date.now() - Number(cached.capturedAt || 0) > LINE_MAP_BODY_CACHE_TTL_MS) return { value: '', source: '' };
    return {
      value: cached.value || '',
      dongNo: cached.dongNo || '',
      displayDongToken: cached.displayDongToken || '',
      source: cached.source || 'article-build'
    };
  }

  function buildNoInfoFromLineMapBody(body) {
    const direct = buildNoFromObject(body);
    if (direct) return { value: direct, source: 'direct-build' };
    const nested = numericFieldFromNestedValue(body, ['buildNo', 'buildingNo', 'bildNo'], 0);
    if (nested) return { value: nested, source: 'nested-build' };
    const fallbackDong = numericFieldFromNestedValue(body, ['dongNo'], 0);
    if (fallbackDong) return { value: fallbackDong, source: 'fallback-dong' };
    return { value: '', source: '' };
  }

  function scheduleBuildingUnitsFetchFromLineMapBody(category, body, remaining) {
    if (!['pyeongtype', 'landprice'].includes(category)) return;
    const attemptsLeft = Math.max(0, Number(remaining || 0) || 0);
    window.setTimeout(() => {
      if (lineMapResolutionAlreadyExact()) return;
      let stage = 'start';
      try {
        stage = 'complex';
        const complexNo = complexNoFromLocation();
        stage = 'context';
        const context = currentLineMapContextForRoute();
        const lineMapContext = context;
        stage = 'dong';
        const dongNo = lineMapContext.detailDongNo || dongNoFromLineMapBody(body);
        stage = 'build';
        const probeBuildNo = lineMapContext.detailBuildNo;
        const articleBuildNoInfo = currentArticleBuildNoInfo();
        const bodyBuildNoInfo = buildNoInfoFromLineMapBody(body);
        const buildNoInfo = probeBuildNo ? { value: probeBuildNo, source: 'article-probe-build' } : (articleBuildNoInfo.value ? articleBuildNoInfo : bodyBuildNoInfo);
        const buildNo = buildNoInfo.value;
        stage = 'required';
        if (!buildNo || !context.detailDongToken || !context.detailTypeToken) {
          if (attemptsLeft > 0) scheduleBuildingUnitsFetchFromLineMapBody(category, body, attemptsLeft - 1);
          else {
            post({
              eventName: 'fetch-buildingUnits-route-missing',
              endpointCategory: 'buildingUnits',
              status: 0,
              routeReason: !buildNo ? 'missing-build-no' : (!context.detailDongToken ? 'missing-dong-token' : 'missing-type-token'),
              stopState: 'continue',
              durationMs: 0
            });
          }
          return;
        }
        stage = 'key';
        const routeContext = Object.assign({}, context, {
          articleMarker: currentArticleMarker(),
          complexNo,
          dongNo,
          buildNo,
          buildNoSource: buildNoInfo.source
        });
        const routeLineMapRows = collectNaverLineMapRowsFromBody(body, category, routeContext);
        const proof = lineMapQuickDirectHoProofFromRows(routeContext, routeLineMapRows);
        if (proof.exact || lineMapResolutionAlreadyExact(routeContext)) return;
        if (attemptsLeft > 0 && shouldRetryBuildingUnitsGuard(proof)) {
          scheduleBuildingUnitsFetchFromLineMapBody(category, body, attemptsLeft - 1);
          return;
        }
        const routeKey = buildingUnitsRouteKey(currentArticleMarker(), complexNo, buildNo);
        if (!routeKey) return;
        if (pyeongTypeRouteKeys.has(routeKey)) return;
        pyeongTypeRouteKeys.add(routeKey);
        if (pyeongTypeRouteKeys.size > 80) pyeongTypeRouteKeys.clear();
        stage = 'fetch';
        fetchBuildingLineMapRoute(
          'buildingUnits',
          `/api/articles/buildings/units?buildingNos=${encodeURIComponent(buildNo)}`,
          Object.assign({}, routeContext, {
            optionalGuardReason: proof.reason,
            optionalGuardStatus: proof.status,
            optionalGuardRowCount: proof.rowCount,
            optionalGuardCandidateCount: proof.candidateCount,
            optionalGuardDirectHoEvidenceCount: proof.directHoEvidenceCount
          }),
          Date.now()
        );
      } catch (error) {
        post({
          eventName: 'fetch-buildingUnits-route-error',
          endpointCategory: 'buildingUnits',
          status: 0,
          routeReason: `schedule-${stage}-${shortRouteErrorReason(error)}`,
          stopState: 'continue',
          durationMs: 0
        });
      }
    }, attemptsLeft > 0 ? 250 : 0);
  }

  function scheduleCachedLineMapReplay(category, body, remaining) {
    const attemptsLeft = Math.max(0, Number(remaining || 0) || 0);
    window.setTimeout(() => {
      const context = currentLineMapContextForRoute();
      if (!context.detailDongToken || !context.detailTypeToken) {
        if (attemptsLeft > 0) scheduleCachedLineMapReplay(category, body, attemptsLeft - 1);
        return;
      }
      const lineMapRows = collectNaverLineMapRowsFromBody(body, category, context);
      const buildingUnitsExact = resolveBuildingUnitsExactFromBody(body, category, Object.assign({
        articleMarker: currentArticleMarker()
      }, context));
      if (!lineMapRows.length && !buildingUnitsExact) return;
      post({
        eventName: `cached-${category}-line-map`,
        endpointCategory: category,
        status: 200,
        routeReason: lineMapRows.length ? 'line-map-cache-captured' : 'building-units-cache-captured',
        stopState: 'continue',
        durationMs: 0,
        lineMapRowCount: lineMapRows.length,
        lineMapShape: summarizeNaverLineMapShape(body, category),
        lineMapRows,
        buildingUnitsExact
      });
    }, attemptsLeft > 0 ? 250 : 0);
  }

  function mergeLineMapRowsForPost(rows) {
    const seen = new Set();
    const result = [];
    for (const row of Array.isArray(rows) ? rows : []) {
      const key = [
        row && row.dongToken || '',
        row && row.typeToken || '',
        row && row.lineToken || '',
        Number(row && row.floorValue || 0) || 0,
        row && row.directHoToken || '',
        row && row.directionToken || '',
        row && row.source || '',
        row && row.landPriceAnomaly ? 'anomaly' : ''
      ].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(row);
      if (result.length >= 300) break;
    }
    return result;
  }

  function cachedNaverLineMapObservation(fetchContext) {
    const now = Date.now();
    const context = lineMapObservationContext(fetchContext);
    const rows = [];
    let shape = null;
    let exact = null;
    let articleDetailContext = null;
    for (let index = cachedLineMapBodies.length - 1; index >= 0; index -= 1) {
      const entry = cachedLineMapBodies[index];
      if (!entry || now - Number(entry.capturedAt || 0) > LINE_MAP_BODY_CACHE_TTL_MS) {
        cachedLineMapBodies.splice(index, 1);
        continue;
      }
      rows.push(...collectNaverLineMapRowsFromBody(entry.body, entry.category, context));
      if (!shape) shape = summarizeNaverLineMapShape(entry.body, entry.category);
      if (!exact) exact = resolveBuildingUnitsExactFromBody(entry.body, entry.category, context);
      if (!articleDetailContext) articleDetailContext = collectArticleDetailContextFromBody(entry.body);
    }
    return {
      lineMapRows: mergeLineMapRowsForPost(rows),
      lineMapShape: shape,
      buildingUnitsExact: exact,
      articleDetailContext
    };
  }

  function safeOptionalGuardText(value) {
    return String(value || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  }

  function optionalGuardSummary(fetchContext) {
    const context = fetchContext && typeof fetchContext === 'object' ? fetchContext : {};
    const reason = safeOptionalGuardText(context.optionalGuardReason);
    if (!reason) return '';
    return [
      `guard:${reason}`,
      `status:${safeOptionalGuardText(context.optionalGuardStatus) || 'none'}`,
      `rows:${Math.max(0, Math.min(999, Number(context.optionalGuardRowCount || 0) || 0))}`,
      `candidates:${Math.max(0, Math.min(999, Number(context.optionalGuardCandidateCount || 0) || 0))}`,
      `direct:${Math.max(0, Math.min(999, Number(context.optionalGuardDirectHoEvidenceCount || 0) || 0))}`
    ].join(' ');
  }

  function lineMapQuickDirectHoProofFromRows(fetchContext, lineMapRows) {
    try {
      const api = window.DHS_LINE_INFERENCE;
      if (!api || typeof api.buildLineInference !== 'function') {
        return { exact: false, reason: 'missing-line-inference-api', rowCount: 0 };
      }
      const context = lineMapObservationContext(fetchContext || currentLineMapContextForRoute());
      if (!context.detailDongToken) return { exact: false, reason: 'missing-dong', rowCount: 0 };
      if (!context.detailTypeToken) return { exact: false, reason: 'missing-type', rowCount: 0 };
      if (!(Number(context.detailFloorValue || 0) > 0)) return { exact: false, reason: 'missing-floor', rowCount: 0 };
      const rows = Array.isArray(lineMapRows) ? lineMapRows : [];
      const result = api.buildLineInference({
        context: {
          dongToken: context.detailDongToken,
          typeToken: context.detailTypeToken,
          floorValue: context.detailFloorValue,
          floorBand: context.detailFloorBand,
          totalFloor: context.detailTotalFloor,
          directionToken: context.detailDirectionToken,
          exclusiveSpace: context.detailExclusiveSpace,
          pyeongNo: context.detailPyeongNo
        },
        lineMapRows: rows
      });
      const directHoEvidenceCount = Number(result && result.directHoEvidenceCount || 0);
      const exact = Boolean(
        result &&
        result.status === 'single-estimated' &&
        result.reason === 'line-type-corroborated-direct-ho' &&
        result.displayCandidate &&
        Number(result.candidateCount || 0) === 1 &&
        directHoEvidenceCount >= 2
      );
      return {
        exact,
        reason: exact ? 'exact' : safeOptionalGuardText(result && (result.reason || result.status) || 'not-exact'),
        status: safeOptionalGuardText(result && result.status || ''),
        rowCount: rows.length,
        candidateCount: Number(result && result.candidateCount || 0) || 0,
        directHoEvidenceCount
      };
    } catch (_) {
      return { exact: false, reason: 'proof-error', rowCount: 0 };
    }
  }

  function lineMapQuickDirectHoProof(fetchContext) {
    const context = lineMapObservationContext(fetchContext || currentLineMapContextForRoute());
    const observation = cachedNaverLineMapObservation(context);
    return lineMapQuickDirectHoProofFromRows(context, observation.lineMapRows);
  }

  function lineMapQuickDirectHoProofAvailable(fetchContext) {
    return Boolean(lineMapQuickDirectHoProof(fetchContext).exact);
  }

  function shouldRetryOptionalGuard(proof) {
    if (!proof || proof.exact) return false;
    if (Number(proof.directHoEvidenceCount || 0) > 0) return false;
    const reason = safeOptionalGuardText(proof.reason);
    const status = safeOptionalGuardText(proof.status);
    return [
      reason,
      status
    ].some((value) => [
      'line-type-multiple',
      'multiple-candidates',
      'missing-line-map',
      'no-map',
      'not-exact'
    ].includes(value));
  }

  function shouldRetryBuildingUnitsGuard(proof) {
    if (!proof || proof.exact) return false;
    const directHoEvidenceCount = Number(proof.directHoEvidenceCount || 0);
    const status = safeOptionalGuardText(proof.status);
    const reason = safeOptionalGuardText(proof.reason);
    if (
      status === 'single-estimated' &&
      Number(proof.candidateCount || 0) === 1
    ) {
      return false;
    }
    if (
      ['multiple-candidates', 'line-type-multiple'].includes(status) ||
      ['multiple-candidates', 'line-type-multiple'].includes(reason)
    ) {
      return false;
    }
    if (directHoEvidenceCount > 0) return false;
    return shouldRetryOptionalGuard(proof);
  }

  function summarizeNaverLineMapShape(body, category) {
    if (!NAVER_LINE_MAP_CATEGORIES.has(category)) return null;
    const api = window.DHS_NAVER_LINE_MAP;
    if (!api || typeof api.summarizeNaverLineMapShape !== 'function') return null;
    return api.summarizeNaverLineMapShape(body);
  }

  function resolveBuildingUnitsExactFromBody(body, category, fetchContext) {
    if (!NAVER_LINE_MAP_CATEGORIES.has(category)) return null;
    const api = window.DHS_BUILDING_UNITS_RESOLVER;
    if (!api || typeof api.resolveBuildingUnitsExact !== 'function') return null;
    const result = api.resolveBuildingUnitsExact(body, buildingUnitsContextFromFetchContext(fetchContext));
    if (!result || typeof result !== 'object') return null;
    if (result.present || Number(result.rowCount || 0) > 0 || Number(result.articleLinkedCount || 0) > 0) return result;
    return null;
  }

  function naverLineMapPayloadLimit(category) {
    return category === 'naverOther' ? MAX_NAVER_OTHER_PAYLOAD_CHARS : MAX_PROVIDER_PAYLOAD_CHARS;
  }

  function naverLineMapPayloadAllowed(category, contentLength) {
    const size = Number(contentLength || 0) || 0;
    if (category === 'naverOther' && size <= 0) return false;
    return size <= naverLineMapPayloadLimit(category);
  }

  function complexNoFromLocation() {
    try {
      const parsed = new URL(location.href);
      const pathMatch = parsed.pathname.match(/\/complexes\/(\d{4,24})(?:\/|$)/);
      if (pathMatch) return pathMatch[1];
      return safeNumericDongNo(parsed.searchParams.get('complexNo')) || safeNumericDongNo(parsed.searchParams.get('hscpNo'));
    } catch (_) {
      return '';
    }
  }

  function preferLineMapTypeToken(currentValue, targetValue) {
    const current = String(currentValue || '').replace(/[^0-9A-Za-z]/g, '').slice(0, 12).toUpperCase();
    const target = String(targetValue || '').replace(/[^0-9A-Za-z]/g, '').slice(0, 12).toUpperCase();
    if (!target) return current;
    if (!current) return target;
    if (current === target) return current;
    const currentNumericOnly = /^[0-9]+$/.test(current);
    const targetHasVariant = /[A-Z]/.test(target);
    if (currentNumericOnly && targetHasVariant) return target;
    return current;
  }

  function preferLineMapDongToken(currentValue, targetValue) {
    const current = extractDongToken(currentValue) || displayNumericDongToken(currentValue);
    const target = extractDongToken(targetValue) || displayNumericDongToken(targetValue);
    return current || target;
  }

  function lineMapTypeTokensCompatible(leftValue, rightValue) {
    const left = String(leftValue || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
    const right = String(rightValue || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
    if (!left || !right || left === right) return true;
    const leftNumber = left.replace(/[^0-9]/g, '');
    const rightNumber = right.replace(/[^0-9]/g, '');
    return Boolean(leftNumber && leftNumber === rightNumber);
  }

  function lineMapFallbackContextVerified(probeInput, fallbackInput) {
    const probe = probeInput && typeof probeInput === 'object' ? probeInput : {};
    const fallback = fallbackInput && typeof fallbackInput === 'object' ? fallbackInput : {};
    const fallbackArticleMarker = safeArticleMarker(fallback.articleMarker);
    const probeArticleMarker = safeArticleMarker(probe.articleMarker);
    const locationArticleMarker = currentArticleMarker();
    if (!fallbackArticleMarker || (!probeArticleMarker && !locationArticleMarker)) return false;
    if (probeArticleMarker && probeArticleMarker !== fallbackArticleMarker) return false;
    if (locationArticleMarker && locationArticleMarker !== fallbackArticleMarker) return false;

    const probeDongToken = extractDongToken(probe.detailDongToken) || displayNumericDongToken(probe.detailDongToken);
    const fallbackDongToken = extractDongToken(fallback.detailDongToken || fallback.dongToken || fallback.dong)
      || displayNumericDongToken(fallback.detailDongToken || fallback.dongToken || fallback.dong);
    if (probeDongToken && fallbackDongToken && probeDongToken !== fallbackDongToken) return false;

    const probeDirectionToken = normalizeText(probe.detailDirectionToken).replace(/[^\uAC00-\uD7AF]/g, '');
    const fallbackDirectionToken = normalizeText(fallback.detailDirectionToken || fallback.directionToken).replace(/[^\uAC00-\uD7AF]/g, '');
    if (probeDirectionToken && fallbackDirectionToken && probeDirectionToken !== fallbackDirectionToken) return false;
    if (!lineMapTypeTokensCompatible(probe.detailTypeToken, fallback.detailTypeToken)) return false;

    const probeFloorValue = Number(probe.detailFloorValue || 0) || 0;
    const fallbackFloorValue = Number(fallback.detailFloorValue || fallback.floorValue || 0) || 0;
    if (probeFloorValue && fallbackFloorValue && probeFloorValue !== fallbackFloorValue) return false;
    const probeFloorBand = String(probe.detailFloorBand || '');
    const fallbackFloorBand = String(fallback.detailFloorBand || fallback.floorBand || '');
    if (probeFloorBand && fallbackFloorBand && probeFloorBand !== fallbackFloorBand) return false;
    const probeTotalFloor = Number(probe.detailTotalFloor || 0) || 0;
    const fallbackTotalFloor = Number(fallback.detailTotalFloor || fallback.totalFloor || 0) || 0;
    if (probeTotalFloor && fallbackTotalFloor && probeTotalFloor !== fallbackTotalFloor) return false;
    return true;
  }

  function currentLineMapContextForRoute() {
    try {
      const overlay = document.getElementById('dhs-anything-diagnostic-overlay');
      const probe = overlay ? JSON.parse(overlay.getAttribute('data-dhs-probe') || 'null') : null;
      const fallbackInput = window.__DHS_CDP_TARGET_CONTEXT__ && typeof window.__DHS_CDP_TARGET_CONTEXT__ === 'object'
        ? window.__DHS_CDP_TARGET_CONTEXT__
        : null;
      const fallbackFresh = Boolean(fallbackInput && Number(fallbackInput.__dhsExpiresAt || 0) > Date.now());
      const fallbackVerified = Boolean(fallbackFresh && lineMapFallbackContextVerified(probe, fallbackInput));
      const fallback = fallbackVerified ? fallbackInput : {};
      const probeDongToken = probe && probe.detailDongToken ? String(probe.detailDongToken) : '';
      const fallbackDongToken = String(fallback.detailDongToken || fallback.dongToken || fallback.dong || '');
      const token = preferLineMapDongToken(probeDongToken, fallbackDongToken);
      const probeTypeToken = probe && probe.detailTypeToken ? String(probe.detailTypeToken) : '';
      const fallbackTypeToken = String(fallback.detailTypeToken || '');
      const typeToken = preferLineMapTypeToken(probeTypeToken, fallbackTypeToken);
      const directionToken = probe && probe.detailDirectionToken ? String(probe.detailDirectionToken) : String(fallback.detailDirectionToken || fallback.directionToken || '');
      const floorValue = Number(probe && probe.detailFloorValue || fallback.floorValue || fallback.detailFloorValue || 0) || 0;
      const totalFloor = Number(probe && probe.detailTotalFloor || fallback.totalFloor || fallback.detailTotalFloor || 0) || 0;
      const exclusiveSpace = Number(probe && probe.detailExclusiveSpace || fallback.detailExclusiveSpace || fallback.exclusiveSpace || 0) || 0;
      const pyeongNo = probe && probe.detailPyeongNo ? String(probe.detailPyeongNo) : String(fallback.detailPyeongNo || fallback.pyeongNo || '');
      const buildNo = probe && probe.detailBuildNo ? String(probe.detailBuildNo) : String(fallback.detailBuildNo || fallback.buildNo || '');
      const dongNo = probe && probe.detailDongNo ? String(probe.detailDongNo) : String(fallback.detailDongNo || fallback.dongNo || '');
      const displayDongToken = probe && probe.detailDisplayDongToken ? String(probe.detailDisplayDongToken) : String(fallback.detailDisplayDongToken || '');
      const floorBand = String(probe && probe.detailFloorBand || fallback.detailFloorBand || fallback.floorBand || '');
      return {
        detailDongToken: extractDongToken(token) || displayNumericDongToken(token),
        detailTypeToken: typeToken.replace(/[^0-9A-Za-z]/g, '').slice(0, 12).toUpperCase(),
        detailDirectionToken: directionToken.replace(/[^\uAC00-\uD7AF]/g, '').slice(0, 8),
        detailFloorValue: floorValue > 0 && floorValue < 100 ? floorValue : 0,
        detailFloorBand: /^(low|mid|high)$/.test(floorBand) ? floorBand : '',
        detailTotalFloor: totalFloor > 0 && totalFloor < 100 ? totalFloor : 0,
        detailExclusiveSpace: exclusiveSpace > 0 && exclusiveSpace < 400 ? exclusiveSpace : 0,
        detailPyeongNo: pyeongNo.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32),
        detailBuildNo: safeNumericDongNo(buildNo),
        detailDongNo: safeNumericDongNo(dongNo),
        detailDisplayDongToken: extractDongToken(displayDongToken) || displayNumericDongToken(displayDongToken)
      };
    } catch (_) {
      return {
        detailDongToken: '',
        detailTypeToken: '',
        detailDirectionToken: '',
        detailFloorValue: 0,
        detailFloorBand: '',
        detailTotalFloor: 0,
        detailExclusiveSpace: 0,
        detailPyeongNo: '',
        detailBuildNo: '',
        detailDongNo: '',
        detailDisplayDongToken: ''
      };
    }
  }

  function headersForNaverRoute(input, init) {
    const headers = new Headers();
    const blocked = new Set(['content-length', 'host', 'origin', 'referer']);
    const copy = (source) => {
      try {
        if (!source) return;
        const sourceHeaders = new Headers(source);
        sourceHeaders.forEach((value, key) => {
          const name = String(key || '').toLowerCase();
          if (!name || blocked.has(name)) return;
          headers.set(key, value);
        });
      } catch (_) {}
    };
    try {
      if (input && input.headers) copy(input.headers);
    } catch (_) {}
    try {
      if (init && init.headers) copy(init.headers);
    } catch (_) {}
    if (!headers.has('Authorization') && naverAuthorizationHeader) headers.set('Authorization', naverAuthorizationHeader);
    if (!headers.has('accept')) headers.set('accept', 'application/json');
    return headers;
  }

  function credentialsForNaverRoute(input, init) {
    const initCredentials = init && typeof init.credentials === 'string' ? init.credentials : '';
    if (initCredentials) return initCredentials;
    try {
      if (input && typeof input.credentials === 'string' && input.credentials) return input.credentials;
    } catch (_) {}
    return 'same-origin';
  }

  function safeBridgeRequestId(value) {
    const text = String(value || '');
    return /^[A-Za-z0-9:._-]{1,80}$/.test(text) ? text : '';
  }

  function activeGroupRouteContext() {
    try {
      const current = new URL(location.href);
      return {
        href: location.href,
        realEstateType: current.searchParams.get('a') || '',
        priceType: current.searchParams.get('e') || ''
      };
    } catch (_) {
      return {
        href: location.href,
        realEstateType: '',
        priceType: ''
      };
    }
  }

  function activeGroupRouteReason(status, groupCandidates, groupFloorHintRows, lineMapRows, bodyReason) {
    if (Number(status) >= 400) return `http-${Number(status)}`;
    if (Array.isArray(groupCandidates) && groupCandidates.length > 0) return 'candidates-captured';
    if (Array.isArray(groupFloorHintRows) && groupFloorHintRows.length > 0) return 'floor-hints-captured';
    if (Array.isArray(lineMapRows) && lineMapRows.length > 0) return 'line-map-captured';
    if (bodyReason) return bodyReason;
    return 'no-candidate';
  }

  function activeGroupRouteBodyShape(bodyReason, status, contentLength) {
    const reason = String(bodyReason || '').replace(/[^a-z0-9-]/gi, '').slice(0, 40);
    if (!reason) return '';
    const safeStatus = Math.max(0, Math.min(999, Number(status || 0) || 0));
    const sizeKnown = Number.isFinite(Number(contentLength)) && Number(contentLength) > 0;
    const sizeBucket = sizeKnown
      ? (Number(contentLength) > MAX_PROVIDER_PAYLOAD_CHARS ? 'large' : 'bounded')
      : 'unknown-size';
    return `body:${reason} status:${safeStatus} size:${sizeBucket}`;
  }

  async function openJsonResponseDeadline(path, options, timeoutMs) {
    const canAbort = typeof AbortController === 'function';
    const controller = canAbort ? new AbortController() : null;
    let timer = 0;
    let closed = false;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      if (timer) window.clearTimeout(timer);
      timer = 0;
      if (controller && !controller.signal.aborted) controller.abort();
    };
    if (controller && Number(timeoutMs || 0) > 0) {
      timer = window.setTimeout(() => controller.abort(), Number(timeoutMs || 0));
    }
    try {
      const response = await originalFetch.call(window, path, Object.assign({}, options || {}, controller ? { signal: controller.signal } : {}));
      return {
        response,
        readJson: async () => {
          try {
            return await response.json();
          } finally {
            cleanup();
          }
        },
        close: cleanup
      };
    } catch (error) {
      cleanup();
      throw error;
    }
  }

  async function fetchBuildingLineMapRoute(endpointName, path, fetchContext, startedAt) {
    const started = Number(startedAt || Date.now());
    let responseDeadline = null;
    try {
      responseDeadline = await openJsonResponseDeadline(path, {
        method: 'GET',
        credentials: credentialsForNaverRoute(fetchContext && fetchContext.input, fetchContext && fetchContext.init),
        cache: 'no-store',
        headers: headersForNaverRoute(fetchContext && fetchContext.input, fetchContext && fetchContext.init)
      }, BUILDING_LINE_MAP_FETCH_TIMEOUT_MS);
      const response = responseDeadline.response;
      const status = Number(response && response.status) || 0;
      post({
        eventName: `fetch-${endpointName}-route`,
        endpointCategory: endpointName,
        status,
        routeReason: status >= 400
          ? `http-${status}${fetchContext && fetchContext.buildNoSource ? `-${fetchContext.buildNoSource}` : ''}`
          : 'route-fetched',
        stopState: classifyStopCondition(status),
        durationMs: Date.now() - started,
        endpointSummary: optionalGuardSummary(fetchContext)
      });
      if (classifyStopCondition(status) === 'stop' || status >= 400 || !response) return;
      const contentType = String(response.headers && response.headers.get ? response.headers.get('content-type') : '');
      const contentLength = Number(response.headers && response.headers.get ? response.headers.get('content-length') : 0) || 0;
      if (contentLength > MAX_PROVIDER_PAYLOAD_CHARS || (contentType && !/json/i.test(contentType))) return;
      const body = await responseDeadline.readJson();
      rememberNaverLineMapBody(endpointName, body);
      const lineMapRows = collectNaverLineMapRowsFromBody(body, endpointName, fetchContext);
      const lineMapShape = summarizeNaverLineMapShape(body, endpointName);
      const buildingUnitsExact = resolveBuildingUnitsExactFromBody(body, endpointName, fetchContext);
      post({
        eventName: `fetch-${endpointName}-line-map`,
        endpointCategory: endpointName,
        status,
        routeReason: lineMapRows.length ? 'line-map-captured' : 'no-line-map',
        stopState: classifyStopCondition(status),
        durationMs: Date.now() - started,
        lineMapRowCount: lineMapRows.length,
        lineMapShape,
        lineMapRows,
        buildingUnitsExact,
        endpointSummary: optionalGuardSummary(fetchContext)
      });
    } catch (_) {
      post({
        eventName: `fetch-${endpointName}-error`,
        endpointCategory: endpointName,
        status: 0,
        routeReason: 'network-error',
        stopState: 'continue',
        durationMs: Date.now() - started
      });
    } finally {
      if (responseDeadline) responseDeadline.close();
    }
  }

  function lineMapResolutionAlreadyExact(fetchContext) {
    try {
      if (lineMapQuickDirectHoProofAvailable(fetchContext)) return true;
      const overlay = document.getElementById('dhs-anything-diagnostic-overlay');
      if (!overlay) return false;
      if (normalizeText(overlay.getAttribute('data-dhs-compare-status') || '') !== 'exact') return false;
      const probeText = overlay.getAttribute('data-dhs-probe') || '';
      const probe = probeText ? JSON.parse(probeText) : {};
      const expectedMarker = currentArticleMarker();
      const actualMarker = normalizeText(probe && probe.articleMarker || '');
      if (expectedMarker && actualMarker && expectedMarker !== actualMarker) return false;
      return Boolean(overlay.getAttribute('data-dhs-compare-exact-display64') || normalizeText(overlay.querySelector('.dhs-primary-value') && overlay.querySelector('.dhs-primary-value').textContent || ''));
    } catch (_) {
      return false;
    }
  }

  function scheduleOptionalLineMapRoute(endpointName, path, fetchContext, startedAt, delayMs, guardRetriesLeft) {
    const started = Number(startedAt || Date.now());
    const delay = delayMs === undefined ? OPTIONAL_LINE_MAP_ROUTE_DELAY_MS : delayMs;
    const attemptsLeft = guardRetriesLeft === undefined
      ? OPTIONAL_LINE_MAP_GUARD_MAX_RETRIES
      : Math.max(0, Math.min(OPTIONAL_LINE_MAP_GUARD_MAX_RETRIES, Number(guardRetriesLeft || 0) || 0));
    window.setTimeout(() => {
      const proof = lineMapQuickDirectHoProof(fetchContext);
      if (proof.exact) return;
      if (lineMapResolutionAlreadyExact(fetchContext)) return;
      if (attemptsLeft > 0 && shouldRetryOptionalGuard(proof)) {
        scheduleOptionalLineMapRoute(endpointName, path, fetchContext, started, OPTIONAL_LINE_MAP_GUARD_RETRY_DELAY_MS, attemptsLeft - 1);
        return;
      }
      fetchBuildingLineMapRoute(endpointName, path, Object.assign({}, fetchContext || {}, {
        optionalGuardReason: proof.reason,
        optionalGuardStatus: proof.status,
        optionalGuardRowCount: proof.rowCount,
        optionalGuardCandidateCount: proof.candidateCount,
        optionalGuardDirectHoEvidenceCount: proof.directHoEvidenceCount
      }), started);
    }, Math.max(0, Number(delay) || 0));
  }

  function afterPrimaryLineMapRoutes(fetches, callback) {
    const pending = (Array.isArray(fetches) ? fetches : []).filter((item) => item && typeof item.then === 'function');
    if (!pending.length) {
      callback();
      return;
    }
    Promise.allSettled(pending).then(callback, callback);
  }

  async function fetchActiveGroupRouteFromBridge(data) {
    const requestId = safeBridgeRequestId(data && data.requestId);
    const route = String(data && data.route || '');
    const started = Date.now();
    const activeApi = window.DHS_ACTIVE_GROUP_ROUTES;
    const bridgeLineMapContext = lineMapObservationContext(data);
    const cachedObservation = cachedNaverLineMapObservation(bridgeLineMapContext);
    const cachedLineMapRows = Array.isArray(cachedObservation.lineMapRows) ? cachedObservation.lineMapRows : [];
    const cachedHasEvidence = cachedLineMapRows.length > 0 || cachedObservation.lineMapShape || cachedObservation.buildingUnitsExact || cachedObservation.articleDetailContext;
    const basePayload = {
      eventName: 'fetch-active-group-route',
      requestId,
      endpointCategory: 'other',
      status: 0,
      routeReason: 'missing-active-route-api',
      stopState: 'continue',
      durationMs: 0
    };
    if (!requestId || !activeApi || typeof activeApi.buildActiveGroupRouteRequest !== 'function') {
      post(Object.assign({}, basePayload, {
        endpointCategory: cachedHasEvidence ? 'pyeongtype' : 'other',
        status: cachedHasEvidence ? 200 : 0,
        routeReason: cachedHasEvidence ? 'line-map-cache-captured' : 'missing-active-route-api',
        durationMs: Date.now() - started,
        lineMapRowCount: cachedLineMapRows.length,
        lineMapRows: cachedLineMapRows,
        lineMapShape: cachedObservation.lineMapShape,
        buildingUnitsExact: cachedObservation.buildingUnitsExact,
        articleDetailContext: cachedObservation.articleDetailContext
      }));
      return;
    }

    const request = activeApi.buildActiveGroupRouteRequest(Object.assign({ route }, activeGroupRouteContext()));
    if (!request || !request.present) {
      post(Object.assign({}, basePayload, {
        endpointCategory: request && request.category ? request.category : 'other',
        routeReason: request && request.reason ? request.reason : 'not-executable',
        durationMs: Date.now() - started
      }));
      return;
    }

    let responseDeadline = null;
    try {
      responseDeadline = await openJsonResponseDeadline(request.path, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: headersForNaverRoute(null, null)
      }, ACTIVE_GROUP_ROUTE_FETCH_TIMEOUT_MS);
      const response = responseDeadline.response;
      const status = Number(response && response.status) || 0;
      const contentType = String(response && response.headers && response.headers.get ? response.headers.get('content-type') : '');
      const contentLength = Number(response && response.headers && response.headers.get ? response.headers.get('content-length') : 0) || 0;
      let body = null;
      let bodyReason = '';
      if (!response) {
        bodyReason = 'no-response';
      } else if (contentLength > MAX_PROVIDER_PAYLOAD_CHARS) {
        bodyReason = 'response-too-large';
      } else if (contentType && !/json/i.test(contentType)) {
        bodyReason = 'non-json';
      } else {
        try {
          body = await responseDeadline.readJson();
        } catch (error) {
          body = null;
          bodyReason = error && error.name === 'AbortError' ? 'body-timeout' : 'body-parse-error';
        }
      }
      const canUseBody = status > 0 && status < 400 && body;
      if (status > 0 && status < 400 && !body && !bodyReason) bodyReason = 'empty-body';
      const groupCandidates = canUseBody && typeof activeApi.collectActiveGroupCandidateRows === 'function'
        ? activeApi.collectActiveGroupCandidateRows(body, route)
        : [];
      const groupFloorHintRows = canUseBody && typeof activeApi.collectActiveGroupFloorHintRows === 'function'
        ? activeApi.collectActiveGroupFloorHintRows(body, route)
        : [];
      const groupFloorHintDiagnostics = canUseBody && typeof activeApi.collectActiveGroupFloorHintDiagnostics === 'function'
        ? activeApi.collectActiveGroupFloorHintDiagnostics(body, route)
        : null;
      const bodyArticleDetailContext = canUseBody ? collectArticleDetailContextFromBody(body) : null;
      const providerLookupRows = canUseBody && typeof activeApi.collectActiveGroupProviderLookupRows === 'function'
        ? activeApi.collectActiveGroupProviderLookupRows(body, route)
        : [];
      const bodyLineMapRows = canUseBody
        ? collectNaverLineMapRowsFromBody(body, request.category, bridgeLineMapContext)
        : [];
      const lineMapRows = mergeLineMapRowsForPost([].concat(bodyLineMapRows, cachedLineMapRows));
      const groupRouteShapeSummary = body && typeof activeApi.summarizeActiveGroupRouteShape === 'function'
        ? activeApi.summarizeActiveGroupRouteShape(body)
        : activeGroupRouteBodyShape(bodyReason, status, contentLength);
      const matchedComplexDongSummary = request.category === 'complexCache' && canUseBody
        ? summarizeMatchedComplexDongRows(body, bridgeLineMapContext && bridgeLineMapContext.detailDongToken)
        : '';
      if (request.category === 'complexCache' && canUseBody) schedulePyeongTypeLineMapFetchFromComplexCache(body, bridgeLineMapContext);
      post({
        eventName: 'fetch-active-group-route',
        requestId,
        articleMarker: safeArticleMarker(request.articleMarker),
        endpointCategory: request.category,
        status,
        routeReason: activeGroupRouteReason(status, groupCandidates, groupFloorHintRows, lineMapRows, bodyReason),
        stopState: classifyStopCondition(status),
        durationMs: Date.now() - started,
        groupCandidates,
        groupFloorHintRows,
        groupFloorHintDiagnostics,
        providerLookupRows,
        groupRouteShapeSummary: [groupRouteShapeSummary, matchedComplexDongSummary || ''].filter(Boolean).join(' ') || (cachedObservation.lineMapShape ? 'cached-line-map-shape' : ''),
        lineMapRowCount: lineMapRows.length,
        lineMapRows,
        buildingUnitsExact: cachedObservation.buildingUnitsExact,
        articleDetailContext: bodyArticleDetailContext || cachedObservation.articleDetailContext
      });
    } catch (_) {
      post(Object.assign({}, basePayload, {
        endpointCategory: request.category,
        routeReason: 'network-error',
        durationMs: Date.now() - started
      }));
    } finally {
      if (responseDeadline) responseDeadline.close();
    }
  }

  function schedulePyeongTypeLineMapFetchFromComplexCache(body, fetchContext) {
    const complexNo = complexNoFromLocation();
    const rows = collectComplexDongRowsFromBody(body);
    if (!complexNo) return;

    const attempt = (remaining) => {
      const lineMapContext = lineMapObservationContext(fetchContext);
      const detailDongToken = lineMapContext.detailDongToken;
      const detailTypeToken = lineMapContext.detailTypeToken;
      if (!detailDongToken || !detailTypeToken) {
        if (remaining > 0) window.setTimeout(() => attempt(remaining - 1), 250);
        else {
          post({
            eventName: 'fetch-pyeongtype-route-missing',
            endpointCategory: 'pyeongtype',
            status: 0,
            routeReason: detailDongToken ? 'missing-type-token' : 'missing-dong-token',
            stopState: 'continue',
            durationMs: 0
          });
        }
        return;
      }
      const match = rows.find((row) => row.dongToken === detailDongToken) || (lineMapContext.detailDongNo ? {
        dongToken: detailDongToken,
        dongNo: lineMapContext.detailDongNo,
        buildNo: lineMapContext.detailBuildNo || lineMapContext.detailDongNo,
        source: 'article-probe'
      } : null);
      const canUseAllBuildingFallback = !match || !match.dongNo;
      const routeKey = `${currentArticleMarker()}:${complexNo}:${detailDongToken}:${detailTypeToken}:${match ? match.dongNo : 'missing'}:${match && match.buildNo ? match.buildNo : 'no-build'}`;
      if (pyeongTypeRouteKeys.has(routeKey)) return;
      pyeongTypeRouteKeys.add(routeKey);
      if (pyeongTypeRouteKeys.size > 60) pyeongTypeRouteKeys.clear();
      const buildingEndpointPaths = {
        pyeongtype: 'pyeongtype',
        landprice: 'landprice'
      };
      const primaryRouteFetches = [];
      for (const endpointName of ['pyeongtype', 'landprice']) {
        const endpointRouteKey = `${routeKey}:${endpointName}`;
        if (pyeongTypeRouteKeys.has(endpointRouteKey)) continue;
        pyeongTypeRouteKeys.add(endpointRouteKey);
        const path = canUseAllBuildingFallback
          ? `/api/complexes/${encodeURIComponent(complexNo)}/buildings/${encodeURIComponent(buildingEndpointPaths[endpointName])}`
          : `/api/complexes/${encodeURIComponent(complexNo)}/buildings/${encodeURIComponent(buildingEndpointPaths[endpointName])}?dongNo=${encodeURIComponent(match.dongNo)}`;
        primaryRouteFetches.push(fetchBuildingLineMapRoute(endpointName, path, Object.assign({}, fetchContext || {}, {
          articleMarker: currentArticleMarker(),
          complexNo,
          dongNo: canUseAllBuildingFallback ? '' : match.dongNo,
          dongNoSource: canUseAllBuildingFallback ? 'all-buildings-fallback' : 'complex-dong',
          buildNo: canUseAllBuildingFallback ? '' : (match.buildNo || ''),
          detailDongToken: lineMapContext.detailDongToken,
          detailTypeToken: lineMapContext.detailTypeToken,
          detailDirectionToken: lineMapContext.detailDirectionToken,
          detailFloorValue: lineMapContext.detailFloorValue,
          detailFloorBand: lineMapContext.detailFloorBand,
          detailTotalFloor: lineMapContext.detailTotalFloor,
          detailExclusiveSpace: lineMapContext.detailExclusiveSpace,
          detailPyeongNo: lineMapContext.detailPyeongNo,
          detailBuildNo: lineMapContext.detailBuildNo,
          detailDongNo: lineMapContext.detailDongNo,
          detailDisplayDongToken: lineMapContext.detailDisplayDongToken
        }), Date.now()));
      }
      const matchBuildNo = match && (match.buildNo || match.dongNo) ? (match.buildNo || match.dongNo) : '';
      if (matchBuildNo) {
        const endpointName = 'buildingUnits';
        const endpointRouteKey = buildingUnitsRouteKey(currentArticleMarker(), complexNo, matchBuildNo);
        if (endpointRouteKey && !pyeongTypeRouteKeys.has(endpointRouteKey)) {
          pyeongTypeRouteKeys.add(endpointRouteKey);
          afterPrimaryLineMapRoutes(primaryRouteFetches, () => {
            scheduleOptionalLineMapRoute(endpointName, `/api/articles/buildings/units?buildingNos=${encodeURIComponent(matchBuildNo)}`, Object.assign({}, fetchContext || {}, {
              articleMarker: currentArticleMarker(),
              complexNo,
              dongNo: match.dongNo,
              buildNo: matchBuildNo,
              buildNoSource: match.buildNo ? 'complex-build' : 'complex-dong-fallback',
              detailDongToken: lineMapContext.detailDongToken,
              detailTypeToken: lineMapContext.detailTypeToken,
              detailDirectionToken: lineMapContext.detailDirectionToken,
              detailFloorValue: lineMapContext.detailFloorValue,
              detailFloorBand: lineMapContext.detailFloorBand,
              detailTotalFloor: lineMapContext.detailTotalFloor,
              detailExclusiveSpace: lineMapContext.detailExclusiveSpace,
              detailPyeongNo: lineMapContext.detailPyeongNo,
              detailBuildNo: lineMapContext.detailBuildNo,
              detailDongNo: lineMapContext.detailDongNo,
              detailDisplayDongToken: lineMapContext.detailDisplayDongToken
            }), Date.now(), 0, 0);
          });
        }
      }
      const pricesRouteKey = `${routeKey}:prices`;
      if (!pyeongTypeRouteKeys.has(pricesRouteKey)) {
        pyeongTypeRouteKeys.add(pricesRouteKey);
        afterPrimaryLineMapRoutes(primaryRouteFetches, () => {
          scheduleOptionalLineMapRoute('prices', `/api/complexes/${encodeURIComponent(complexNo)}/prices`, Object.assign({}, fetchContext || {}, {
            articleMarker: currentArticleMarker(),
            complexNo,
            dongNo: canUseAllBuildingFallback ? '' : match.dongNo,
            buildNo: canUseAllBuildingFallback ? '' : (match.buildNo || ''),
            detailDongToken: lineMapContext.detailDongToken,
            detailTypeToken: lineMapContext.detailTypeToken,
            detailDirectionToken: lineMapContext.detailDirectionToken,
            detailFloorValue: lineMapContext.detailFloorValue,
            detailFloorBand: lineMapContext.detailFloorBand,
            detailTotalFloor: lineMapContext.detailTotalFloor,
            detailExclusiveSpace: lineMapContext.detailExclusiveSpace,
            detailPyeongNo: lineMapContext.detailPyeongNo,
            detailBuildNo: lineMapContext.detailBuildNo,
            detailDongNo: lineMapContext.detailDongNo,
            detailDisplayDongToken: lineMapContext.detailDisplayDongToken
          }), Date.now());
        });
      }
    };

    attempt(6);
  }

  async function collectNaverLineMapRows(response, category, fetchContext) {
    const observation = await collectNaverLineMapObservation(response, category, fetchContext);
    return observation.lineMapRows;
  }

  function lineMapObservationContext(fetchContext) {
    const current = currentLineMapContextForRoute();
    const context = Object.assign({}, current, fetchContext || {});
    context.detailTypeToken = preferLineMapTypeToken(fetchContext && fetchContext.detailTypeToken, current.detailTypeToken);
    context.detailDongToken = preferLineMapDongToken(fetchContext && fetchContext.detailDongToken, current.detailDongToken);
    return context;
  }

  async function collectNaverLineMapObservation(response, category, fetchContext) {
    const empty = { lineMapRows: [], lineMapShape: null, buildingUnitsExact: null, articleDetailContext: null };
    if (!NAVER_LINE_MAP_CATEGORIES.has(category) || !response || typeof response.clone !== 'function') return empty;
    if (classifyStopCondition(response.status) === 'stop' || Number(response.status) >= 400) return empty;
    try {
      const contentType = String(response.headers && response.headers.get ? response.headers.get('content-type') : '');
      const contentLength = Number(response.headers && response.headers.get ? response.headers.get('content-length') : 0) || 0;
      if (!naverLineMapPayloadAllowed(category, contentLength)) return empty;
      if (contentType && !/json/i.test(contentType)) return empty;
      if (contentType && /json/i.test(contentType)) {
        const body = await response.clone().json();
        const context = lineMapObservationContext(fetchContext);
        const articleDetailContext = collectArticleDetailContextFromBody(body);
        if (category === 'complexCache') schedulePyeongTypeLineMapFetchFromComplexCache(body, context);
        rememberNaverLineMapBody(category, body);
        return {
          lineMapRows: collectNaverLineMapRowsFromBody(body, category, context),
          lineMapShape: summarizeNaverLineMapShape(body, category),
          buildingUnitsExact: resolveBuildingUnitsExactFromBody(body, category, context),
          articleDetailContext
        };
      }
      if (contentLength <= 0) return empty;
      const payloadText = await response.clone().text();
      if (!payloadText || payloadText.length > naverLineMapPayloadLimit(category) || !/^\s*[\[{]/.test(payloadText)) return empty;
      const body = JSON.parse(payloadText);
      const context = lineMapObservationContext(fetchContext);
      const articleDetailContext = collectArticleDetailContextFromBody(body);
      if (category === 'complexCache') schedulePyeongTypeLineMapFetchFromComplexCache(body, context);
      rememberNaverLineMapBody(category, body);
      return {
        lineMapRows: collectNaverLineMapRowsFromBody(body, category, context),
        lineMapShape: summarizeNaverLineMapShape(body, category),
        buildingUnitsExact: resolveBuildingUnitsExactFromBody(body, category, context),
        articleDetailContext
      };
    } catch (_) {
      return empty;
    }
  }

  function collectGroupCandidatesFromXhr(xhr, category) {
    try {
      if (!groupSourceFromCategory(category)) return [];
      const contentType = String(xhr && typeof xhr.getResponseHeader === 'function' ? xhr.getResponseHeader('content-type') : '');
      const bodyText = typeof xhr.response === 'string' ? xhr.response : '';
      if (!bodyText) return [];
      if (contentType && !/json/i.test(contentType) && !/^\s*[\[{]/.test(bodyText)) return [];
      return collectGroupCandidatesFromBody(JSON.parse(bodyText), category);
    } catch (_) {
      return [];
    }
  }

  function collectProviderLookupRowsFromXhr(xhr, category) {
    const activeApi = window.DHS_ACTIVE_GROUP_ROUTES;
    if (!activeApi || typeof activeApi.collectActiveGroupProviderLookupRows !== 'function') return [];
    try {
      const contentType = String(xhr && typeof xhr.getResponseHeader === 'function' ? xhr.getResponseHeader('content-type') : '');
      const bodyText = typeof xhr.response === 'string' ? xhr.response : '';
      if (!bodyText || bodyText.length > MAX_PROVIDER_PAYLOAD_CHARS) return [];
      if (contentType && !/json/i.test(contentType) && !/^\s*[\[{]/.test(bodyText)) return [];
      return activeApi.collectActiveGroupProviderLookupRows(JSON.parse(bodyText), groupSourceFromCategory(category) || category);
    } catch (_) {
      return [];
    }
  }

  function collectProviderFieldValuesFromXhr(xhr, category, providerFamily) {
    try {
      if (category !== 'cpProvider') return [];
      if (classifyStopCondition(xhr && xhr.status) === 'stop' || Number(xhr && xhr.status) >= 400) return [];
      const contentType = String(xhr && typeof xhr.getResponseHeader === 'function' ? xhr.getResponseHeader('content-type') : '');
      const payloadText = typeof xhr.response === 'string' ? xhr.response : '';
      if (!payloadText || payloadText.length > MAX_PROVIDER_PAYLOAD_CHARS) return [];
      if (contentType && /json/i.test(contentType)) {
        return collectProviderFieldValuesFromBody(JSON.parse(payloadText), category, providerFamily);
      }
      if (/^\s*[\[{]/.test(payloadText)) {
        try {
          return collectProviderFieldValuesFromBody(JSON.parse(payloadText), category, providerFamily);
        } catch (_) {}
      }
      if (!PROVIDER_FIELD_NAMES.some((field) => payloadText.includes(field))) return [];
      return collectProviderFieldValuesFromText(payloadText);
    } catch (_) {
      return [];
    }
  }

  function collectNaverLineMapObservationFromXhr(xhr, category) {
    const empty = { lineMapRows: [], lineMapShape: null, buildingUnitsExact: null, articleDetailContext: null };
    try {
      if (!NAVER_LINE_MAP_CATEGORIES.has(category)) return empty;
      if (classifyStopCondition(xhr && xhr.status) === 'stop' || Number(xhr && xhr.status) >= 400) return empty;
      const contentType = String(xhr && typeof xhr.getResponseHeader === 'function' ? xhr.getResponseHeader('content-type') : '');
      const payloadText = typeof xhr.response === 'string' ? xhr.response : '';
      if (!payloadText || payloadText.length > naverLineMapPayloadLimit(category)) return empty;
      if (category === 'naverOther' && payloadText.length > MAX_NAVER_OTHER_PAYLOAD_CHARS) return empty;
      if (contentType && !/json/i.test(contentType) && !/^\s*[\[{]/.test(payloadText)) return empty;
      const body = JSON.parse(payloadText);
      if (category === 'complexCache') schedulePyeongTypeLineMapFetchFromComplexCache(body, null);
      rememberNaverLineMapBody(category, body);
      return {
        lineMapRows: collectNaverLineMapRowsFromBody(body, category, currentLineMapContextForRoute()),
        lineMapShape: summarizeNaverLineMapShape(body, category),
        buildingUnitsExact: resolveBuildingUnitsExactFromBody(body, category, Object.assign({
          articleMarker: currentArticleMarker()
        }, currentLineMapContextForRoute())),
        articleDetailContext: collectArticleDetailContextFromBody(body)
      };
    } catch (_) {
      return empty;
    }
  }

  function post(payload) {
    window.postMessage(
      Object.assign(
        {
          source: SOURCE,
          type: EVENT,
          version: VERSION,
          articleMarker: currentArticleMarker(),
          hrefHasArticle: Boolean(currentArticleMarker())
        },
        payload
      ),
      location.origin
    );
  }

  function onBridgeGroupRouteRequest(event) {
    try {
      if (!event || (event.source && event.source !== window)) return;
      const data = event.data || {};
      if (data.source !== BRIDGE_SOURCE || data.type !== GROUP_ROUTE_REQUEST) return;
      fetchActiveGroupRouteFromBridge(data);
    } catch (_) {}
  }

  window.addEventListener('message', onBridgeGroupRouteRequest);

  function endpointFromFetchInput(input) {
    if (typeof input === 'string') return input;
    if (input && typeof input.url === 'string') return input.url;
    return '';
  }

  const originalFetch = window.fetch;
  if (typeof originalFetch === 'function') {
    window.fetch = async function dhsAnythingFetch(input, init) {
      captureNaverAuthorizationHeader(input, init);
      const startedAt = Date.now();
      const endpoint = classifyEndpoint(endpointFromFetchInput(input));
      try {
        const response = await originalFetch.apply(this, arguments);
        post({
          eventName: 'fetch',
          endpointCategory: endpoint.category,
          providerFamily: endpoint.providerFamily || '',
          status: Number(response && response.status) || 0,
          stopState: classifyStopCondition(response && response.status),
          durationMs: Date.now() - startedAt
        });
        collectGroupCandidates(response, endpoint.category).then((groupCandidates) => {
          if (!groupCandidates.length) return;
          post({
            eventName: 'fetch-candidates',
            endpointCategory: endpoint.category,
            providerFamily: endpoint.providerFamily || '',
            status: Number(response && response.status) || 0,
            stopState: classifyStopCondition(response && response.status),
            durationMs: Date.now() - startedAt,
            groupCandidates
          });
        });
        collectProviderLookupRows(response, endpoint.category).then((providerLookupRows) => {
          if (!providerLookupRows.length) return;
          post({
            eventName: 'fetch-provider-lookup',
            endpointCategory: endpoint.category,
            providerFamily: endpoint.providerFamily || '',
            status: Number(response && response.status) || 0,
            stopState: classifyStopCondition(response && response.status),
            durationMs: Date.now() - startedAt,
            providerLookupRows
          });
        });
        collectProviderFieldValues(response, endpoint.category, endpoint.providerFamily || '').then((providerFieldValues) => {
          if (!providerFieldValues.length) return;
          post({
            eventName: 'fetch-provider-fields',
            endpointCategory: endpoint.category,
            providerFamily: endpoint.providerFamily || '',
            status: Number(response && response.status) || 0,
            stopState: classifyStopCondition(response && response.status),
            durationMs: Date.now() - startedAt,
            providerFieldValues
          });
        });
            collectNaverLineMapObservation(response, endpoint.category, { input, init }).then((lineMapObservation) => {
              const lineMapRows = lineMapObservation.lineMapRows;
              if (lineMapRows.length <= 0 && !lineMapObservation.lineMapShape && !lineMapObservation.buildingUnitsExact && !lineMapObservation.articleDetailContext) return;
              post({
                eventName: 'fetch-line-map',
                endpointCategory: endpoint.category,
                providerFamily: endpoint.providerFamily || '',
                status: Number(response && response.status) || 0,
                stopState: classifyStopCondition(response && response.status),
                durationMs: Date.now() - startedAt,
                lineMapRowCount: lineMapRows.length,
                lineMapShape: lineMapObservation.lineMapShape,
                lineMapRows,
                buildingUnitsExact: lineMapObservation.buildingUnitsExact,
                articleDetailContext: lineMapObservation.articleDetailContext
              });
            });
        return response;
      } catch (error) {
        post({
          eventName: 'fetch-error',
          endpointCategory: endpoint.category,
          providerFamily: endpoint.providerFamily || '',
          status: 0,
          stopState: 'continue',
          durationMs: Date.now() - startedAt
        });
        throw error;
      }
    };
  }

  const OriginalXHR = window.XMLHttpRequest;
  if (typeof OriginalXHR === 'function' && OriginalXHR.prototype) {
    const originalOpen = OriginalXHR.prototype.open;
    const originalSetRequestHeader = OriginalXHR.prototype.setRequestHeader;
    const originalSend = OriginalXHR.prototype.send;

    OriginalXHR.prototype.open = function open(method, url) {
      this.__DHS_ANYTHING_CHROME_ENDPOINT_URL__ = url;
      this.__DHS_ANYTHING_CHROME_ENDPOINT__ = classifyEndpoint(url);
      return originalOpen.apply(this, arguments);
    };

    if (typeof originalSetRequestHeader === 'function') {
      OriginalXHR.prototype.setRequestHeader = function setRequestHeader(name, value) {
        captureNaverAuthorizationHeaderFromXhr(this.__DHS_ANYTHING_CHROME_ENDPOINT_URL__, name, value);
        return originalSetRequestHeader.apply(this, arguments);
      };
    }

    OriginalXHR.prototype.send = function send() {
      const startedAt = Date.now();
        const endpoint = this.__DHS_ANYTHING_CHROME_ENDPOINT__ || { category: 'other' };
        this.addEventListener('loadend', () => {
          const groupCandidates = collectGroupCandidatesFromXhr(this, endpoint.category);
          const providerLookupRows = collectProviderLookupRowsFromXhr(this, endpoint.category);
          const providerFieldValues = collectProviderFieldValuesFromXhr(this, endpoint.category, endpoint.providerFamily || '');
          const lineMapObservation = collectNaverLineMapObservationFromXhr(this, endpoint.category);
          const lineMapRows = lineMapObservation.lineMapRows;
          post({
            eventName: 'xhr',
            endpointCategory: endpoint.category,
          providerFamily: endpoint.providerFamily || '',
          status: Number(this.status) || 0,
          stopState: classifyStopCondition(this.status),
          durationMs: Date.now() - startedAt
        });
        if (groupCandidates.length) {
          post({
            eventName: 'xhr-candidates',
            endpointCategory: endpoint.category,
            providerFamily: endpoint.providerFamily || '',
            status: Number(this.status) || 0,
            stopState: classifyStopCondition(this.status),
            durationMs: Date.now() - startedAt,
              groupCandidates
            });
          }
          if (providerLookupRows.length) {
            post({
              eventName: 'xhr-provider-lookup',
              endpointCategory: endpoint.category,
              providerFamily: endpoint.providerFamily || '',
              status: Number(this.status) || 0,
              stopState: classifyStopCondition(this.status),
              durationMs: Date.now() - startedAt,
              providerLookupRows
            });
          }
          if (providerFieldValues.length) {
            post({
              eventName: 'xhr-provider-fields',
              endpointCategory: endpoint.category,
              providerFamily: endpoint.providerFamily || '',
              status: Number(this.status) || 0,
              stopState: classifyStopCondition(this.status),
              durationMs: Date.now() - startedAt,
              providerFieldValues
            });
          }
              if (lineMapRows.length > 0 || lineMapObservation.lineMapShape || lineMapObservation.buildingUnitsExact || lineMapObservation.articleDetailContext) {
                post({
                  eventName: 'xhr-line-map',
                  endpointCategory: endpoint.category,
                  providerFamily: endpoint.providerFamily || '',
                  status: Number(this.status) || 0,
                  stopState: classifyStopCondition(this.status),
                  durationMs: Date.now() - startedAt,
                  lineMapRowCount: lineMapRows.length,
                  lineMapShape: lineMapObservation.lineMapShape,
                  lineMapRows,
                  buildingUnitsExact: lineMapObservation.buildingUnitsExact,
                  articleDetailContext: lineMapObservation.articleDetailContext
                });
              }
        }, { once: true });
      return originalSend.apply(this, arguments);
    };
  }

  function emitUrlContext(eventName) {
    post({
      eventName,
      endpointCategory: 'urlContext',
      status: 0,
      stopState: 'continue',
      durationMs: 0
    });
  }

  const originalPushState = history.pushState;
  history.pushState = function pushState() {
    const result = originalPushState.apply(this, arguments);
    emitUrlContext('pushState');
    return result;
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function replaceState() {
    const result = originalReplaceState.apply(this, arguments);
    emitUrlContext('replaceState');
    return result;
  };

  window.addEventListener('popstate', () => emitUrlContext('popstate'));
  emitUrlContext('hook-installed');
})();
