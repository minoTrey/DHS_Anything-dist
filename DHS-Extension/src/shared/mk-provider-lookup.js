(function exposeMkProviderLookup(globalScope) {
  const DONG = '\uB3D9';
  const HO = '\uD638';
  const FLOOR = '\uCE35';
  const LOW = '\uC800';
  const MID = '\uC911';
  const HIGH = '\uACE0';
  const MK_REDIRECT_ENDPOINTS = [
    'http://land.mk.co.kr/rd/rd.php',
    'https://land.mk.co.kr/rd/rd.php'
  ];
  const MK_POPUP_ENDPOINT = 'https://land.mk.co.kr/memul/popReportedMemulKISO.php';
  const MK_LANDAD_KISO_ENDPOINT = 'https://landad.mk.co.kr/kiso/kiso_app.php';
  const MK_REFERER = 'http://land.mk.co.kr/';
  const MK_VISIBLE_TEXT_FIELD = 'mk-visible-text';
  const MK_STRUCTURED_DETAIL_FIELDS = Object.freeze([
    'address2',
    'addr2',
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
    'atclName'
  ]);
  const MK_STRUCTURED_FLOOR_FIELDS = Object.freeze([
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
  ]);
  const MK_STRUCTURED_DETAIL_FIELD_SET = new Set(MK_STRUCTURED_DETAIL_FIELDS.map((field) => field.toLowerCase()));
  const MK_STRUCTURED_FLOOR_FIELD_SET = new Set(MK_STRUCTURED_FLOOR_FIELDS.map((field) => field.toLowerCase()));
  const MK_STRUCTURED_TOTAL_FLOOR_FIELD_SET = new Set(['floor_cnt_total', 'floorcnttotal', 'buildinghighestfloor']);
  const MAX_PROVIDER_BODY_BYTES = 200000;
  const MK_DIRECT_SOURCE = Object.freeze({
    providerCpid: 'bizmk',
    providerSourceLabel: 'CPID:bizmk',
    certainty: 'CERTAIN_CPID',
    rank: 90
  });

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function decodeSimpleHtmlEntities(value) {
    return String(value || '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&#(\d+);/g, (_, numberText) => {
        const number = Number(numberText);
        return Number.isFinite(number) ? String.fromCharCode(number) : '';
      })
      .replace(/&#x([0-9a-f]+);/gi, (_, hexText) => {
        const number = Number.parseInt(hexText, 16);
        return Number.isFinite(number) ? String.fromCharCode(number) : '';
      })
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>');
  }

  function decodeMaybeUri(value) {
    let text = decodeSimpleHtmlEntities(String(value || '').replace(/<[^>]+>/g, '')).trim();
    try {
      if (/%[0-9A-Fa-f]{2}/.test(text) || /\+/.test(text)) {
        text = decodeURIComponent(text.replace(/\+/g, ' ')).trim();
      }
    } catch (_) {}
    return text;
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function isMkStructuredDetailField(sourceField) {
    return MK_STRUCTURED_DETAIL_FIELD_SET.has(String(sourceField || '').toLowerCase());
  }

  function isMkStructuredFloorField(sourceField) {
    return MK_STRUCTURED_FLOOR_FIELD_SET.has(String(sourceField || '').toLowerCase());
  }

  function extractMkStructuredDetailFromHtml(html, fields) {
    const text = String(html || '');
    const candidateFields = (Array.isArray(fields) && fields.length ? fields : MK_STRUCTURED_DETAIL_FIELDS)
      .map((field) => String(field || ''))
      .filter(Boolean);

    for (const sourceField of candidateFields) {
      const field = escapeRegExp(sourceField);
      const patterns = [
        new RegExp(`<input[^>]*(?:id|name)=["']${field}["'][^>]*value=["']([^"']*)["']`, 'i'),
        new RegExp(`<input[^>]*value=["']([^"']*)["'][^>]*(?:id|name)=["']${field}["']`, 'i'),
        new RegExp(`<textarea[^>]*(?:id|name)=["']${field}["'][^>]*>([\\s\\S]*?)<\\/textarea>`, 'i'),
        new RegExp(`(?:id|name)=["']${field}["'][^>]{0,900}?value=["']([^"']+)["']`, 'is'),
        new RegExp(`value=["']([^"']+)["'][^>]{0,300}?(?:id|name)=["']${field}["']`, 'is'),
        new RegExp(`["']${field}["']\\s*:\\s*["']([^"']{1,180})["']`, 'i'),
        new RegExp(`\\b${field}\\b\\s*[:=]\\s*["']([^"']{1,180})["']`, 'i'),
        new RegExp(`\\b${field}=([^&"'<>\\s]{1,180})`, 'i')
      ];
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (!match || !match[1]) continue;
        const decoded = decodeMaybeUri(match[1]);
        if (decoded) return { sourceField, value: decoded };
      }
    }

    return null;
  }

  function extractMkStructuredValuesFromHtml(html, fields) {
    const values = [];
    const seen = new Set();
    for (const field of Array.isArray(fields) ? fields : []) {
      const detail = extractMkStructuredDetailFromHtml(html, [field]);
      if (!detail || seen.has(String(detail.sourceField || '').toLowerCase())) continue;
      seen.add(String(detail.sourceField || '').toLowerCase());
      values.push(detail);
    }
    return values;
  }

  function extractMkAddress2FromHtml(html) {
    const detail = extractMkStructuredDetailFromHtml(html, ['address2']);
    return detail ? detail.value : '';
  }

  function stripMkBrokerOfficeBlocks(html) {
    return String(html || '')
      .replace(/<([a-z][\w:-]*)\b[^>]*(?:id|name)=["']jusoDiv["'][^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<([a-z][\w:-]*)\b[^>]*(?:id|name)=["']officeAddress["'][^>]*>[\s\S]*?<\/\1>/gi, ' ');
  }

  function mkBrokerOfficeBlockSeen(html) {
    return /(?:id|name)=["'](?:jusoDiv|officeAddress)["']/i.test(String(html || ''));
  }

  function bandRange(band, totalFloor) {
    const floors = Number(totalFloor) || 0;
    if (!band || floors <= 0) return null;
    const lowEnd = Math.ceil(floors / 3);
    const midStart = lowEnd + 1;
    const midEnd = Math.ceil((floors * 2) / 3);
    if (band === LOW) return [1, lowEnd];
    if (band === MID) return [midStart, midEnd];
    if (band === HIGH) return [midEnd + 1, floors];
    return null;
  }

  function visibleFloorBandRange(text) {
    const match = normalizeText(text).match(new RegExp(`([${LOW}${MID}${HIGH}])\\s*${FLOOR}?\\s*\\/\\s*(\\d{1,3})\\s*${FLOOR}`));
    return match ? bandRange(match[1], match[2]) : null;
  }

  function contextFloorRange(input) {
    const context = input && typeof input === 'object' ? input : {};
    const kind = String(context.detailFloorKind || context.floorKind || '');
    const bandValue = String(context.detailFloorBand || context.floorBand || '');
    const totalFloor = Number(context.detailTotalFloor || context.totalFloor || 0);
    const floorValue = Number(context.detailFloorValue || context.floorValue || 0);
    if (kind === 'exact' && floorValue > 0) return [floorValue, floorValue];
    if (kind !== 'band' || !bandValue || totalFloor <= 0) return null;
    const band = bandValue === 'low'
      ? LOW
      : (bandValue === 'mid' ? MID : (bandValue === 'high' ? HIGH : bandValue));
    return bandRange(band, totalFloor);
  }

  function floorFromHoFragment(value) {
    const match = String(value || '').match(new RegExp(`(\\d{3,4})\\s*${HO}?`));
    const digits = match && match[1] ? match[1] : '';
    return digits.length >= 3 ? Math.floor(Number(digits) / 100) || 0 : 0;
  }

  function matchesFloorBand(value, range) {
    if (!range) return true;
    const floor = floorFromHoFragment(value);
    return floor >= range[0] && floor <= range[1];
  }

  function extractDongHoFragmentFromMkHtml(html, context) {
    const text = normalizeText(decodeSimpleHtmlEntities(stripMkBrokerOfficeBlocks(html)));
    const range = visibleFloorBandRange(text) || contextFloorRange(context);
    const dongHoMatches = Array.from(text.matchAll(new RegExp(`(?<!\\d)(\\d{1,4}\\s*${DONG}\\s*\\d{2,4}\\s*${HO})(?!\\d)`, 'g')))
      .map((match) => normalizeText(match[1]));
    const dongHo = (range ? dongHoMatches.find((value) => matchesFloorBand(value, range)) : dongHoMatches[0]) || '';
    if (dongHo) return dongHo;
    const hoOnlyMatches = Array.from(text.matchAll(new RegExp(`(?<!\\d)(\\d{3,4})\\s*${HO}(?!\\d)`, 'g')))
      .map((match) => match[1]);
    const hoOnly = (range ? hoOnlyMatches.find((value) => matchesFloorBand(value, range)) : hoOnlyMatches[0]) || '';
    if (hoOnly) return hoOnly;
    return '';
  }

  function visibleFragmentShapeFromMkHtml(html, context) {
    const text = normalizeText(decodeSimpleHtmlEntities(stripMkBrokerOfficeBlocks(html)));
    const range = visibleFloorBandRange(text) || contextFloorRange(context);
    const dongHoMatches = Array.from(text.matchAll(new RegExp(`(?<!\\d)(\\d{1,4}\\s*${DONG}\\s*\\d{2,4}\\s*${HO})(?!\\d)`, 'g')))
      .map((match) => normalizeText(match[1]));
    const hoOnlyMatches = Array.from(text.matchAll(new RegExp(`(?<!\\d)(\\d{3,4})\\s*${HO}(?!\\d)`, 'g')))
      .map((match) => match[1]);
    const fragments = dongHoMatches.concat(hoOnlyMatches);
    if (!fragments.length) return { visibleFragmentSeen: false, visibleFragmentStatus: 'none' };
    if (!range) return { visibleFragmentSeen: true, visibleFragmentStatus: 'accepted' };
    const accepted = fragments.some((value) => matchesFloorBand(value, range));
    return {
      visibleFragmentSeen: true,
      visibleFragmentStatus: accepted ? 'accepted' : 'floor-mismatch'
    };
  }

  function mkNormalizeDetailAddress(value) {
    let text = String(value || '').trim();
    try {
      text = decodeURIComponent(text);
    } catch (_) {}
    text = decodeSimpleHtmlEntities(text);
    const tokens = text.split(/\s+/).filter((token) => token.includes(DONG) || token.includes(HO));
    return tokens.length === 0 ? text.trim() : tokens.join(' ');
  }

  function providerCandidateApi() {
    if (globalScope.DHS_PROVIDER_CANDIDATE) return globalScope.DHS_PROVIDER_CANDIDATE;
    if (typeof require === 'function') {
      try {
        return require('./provider-candidate');
      } catch (_) {}
    }
    return null;
  }

  function normalizeFragmentForCandidate(value) {
    const text = normalizeText(value);
    return /^\d{3,4}$/.test(text) ? `${text}${HO}` : text;
  }

  function mkListingContext(context) {
    const input = context && typeof context === 'object' ? context : {};
    const nested = input.listingContext && typeof input.listingContext === 'object' ? input.listingContext : {};
    return Object.assign({}, nested, {
      detailFloorKind: nested.detailFloorKind || input.detailFloorKind || input.floorKind,
      detailFloorBand: nested.detailFloorBand || input.detailFloorBand || input.floorBand,
      detailFloorValue: nested.detailFloorValue || input.detailFloorValue || input.floorValue,
      detailTotalFloor: nested.detailTotalFloor || input.detailTotalFloor || input.totalFloor
    });
  }

  function withMkDirectSource(candidate, sourceField) {
    if (!candidate || typeof candidate !== 'object') return candidate;
    if (!candidate.present && !candidate.floorHintPresent) return candidate;
    if (!isMkStructuredDetailField(sourceField)) return candidate;
    return Object.assign({}, candidate, MK_DIRECT_SOURCE);
  }

  function buildMkProviderCandidateFromHtml(html, context) {
    const api = providerCandidateApi();
    if (!api || typeof api.buildProviderCandidateObservation !== 'function') {
      return { present: false, providerFamily: 'mk', sourceField: '', candidateKind: 'none', redactedCandidate: '', displayCandidate: '' };
    }
    const structuredDetail = extractMkStructuredDetailFromHtml(html);
    const structuredFloorDetails = extractMkStructuredValuesFromHtml(html, MK_STRUCTURED_FLOOR_FIELDS);
    const directDetail = mkNormalizeDetailAddress(structuredDetail && structuredDetail.value);
    const fragment = normalizeFragmentForCandidate(extractDongHoFragmentFromMkHtml(html, context));
    const fieldValues = [];
    if (directDetail) {
      fieldValues.push({ sourceField: structuredDetail.sourceField, value: directDetail });
    } else if (fragment) {
      fieldValues.push({ sourceField: MK_VISIBLE_TEXT_FIELD, value: fragment });
    }
    for (const detail of structuredFloorDetails) {
      fieldValues.push({ sourceField: detail.sourceField, value: detail.value });
    }
    if (context && context.listingContext && Array.isArray(context.listingContext.lineCandidateDisplays)) {
      fieldValues.push({ sourceField: 'mk-deep-scan-text', value: html });
    }
    return withMkDirectSource(api.buildProviderCandidateObservation({
      providerFamily: 'mk',
      fieldValues,
      bodyText: '',
      listingContext: mkListingContext(context)
    }), directDetail ? structuredDetail.sourceField : MK_VISIBLE_TEXT_FIELD);
  }

  function validListingKey(value) {
    const key = String(value || '').replace(/[^0-9]/g, '');
    return /^\d{5,15}$/.test(key) ? key : '';
  }

  function validSequenceKey(value) {
    const key = String(value || '').replace(/[^0-9]/g, '');
    return /^\d{1,20}$/.test(key) ? key : '';
  }

  function responseHeader(response, name) {
    try {
      return response && response.headers && typeof response.headers.get === 'function'
        ? String(response.headers.get(name) || '')
        : '';
    } catch (_) {
      return '';
    }
  }

  async function fetchText(fetchImpl, url, options) {
    const response = await fetchImpl(url, options || {});
    const bodyText = response && typeof response.text === 'function' ? await response.text() : '';
    const tooLarge = bodyText.length > MAX_PROVIDER_BODY_BYTES;
    return {
      ok: Boolean(response && response.ok),
      status: Number(response && response.status || 0),
      locator: String(response && response.url || '') || responseHeader(response, 'location'),
      location: responseHeader(response, 'location'),
      bodyText: tooLarge ? '' : bodyText,
      tooLarge
    };
  }

  function safeHttpStatus(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) && number >= 100 && number <= 599 ? Math.floor(number) : 0;
  }

  function safeDiagnosticFieldName(value) {
    return String(value || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 40);
  }

  function safeDiagnosticFieldNames(values) {
    const seen = new Set();
    const names = [];
    for (const value of Array.isArray(values) ? values : []) {
      const name = safeDiagnosticFieldName(value);
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      names.push(name);
      if (names.length >= 8) break;
    }
    return names;
  }

  function safeDiagnosticEnum(value, allowed, fallback) {
    const text = String(value || '');
    return allowed.includes(text) ? text : fallback;
  }

  function providerBodyShape(html, context) {
    const text = String(html || '');
    const structuredDetail = extractMkStructuredDetailFromHtml(html);
    const structuredFloorDetails = extractMkStructuredValuesFromHtml(html, MK_STRUCTURED_FLOOR_FIELDS);
    const structuredFieldSeen = Boolean(structuredDetail || structuredFloorDetails.length);
    const firstStructuredField = structuredDetail || structuredFloorDetails[0] || null;
    const structuredFloorFieldNames = safeDiagnosticFieldNames(structuredFloorDetails.map((detail) => detail && detail.sourceField));
    const structuredFloorTotalFieldSeen = structuredFloorDetails.some((detail) => MK_STRUCTURED_TOTAL_FLOOR_FIELD_SET.has(String(detail && detail.sourceField || '').toLowerCase()));
    const visibleShape = visibleFragmentShapeFromMkHtml(html, context);
    const brokerOfficeSeen = mkBrokerOfficeBlockSeen(html);
    const bodyShape = structuredFieldSeen
      ? 'known-structured'
      : (visibleShape.visibleFragmentSeen ? 'visible-fragment' : (brokerOfficeSeen ? 'broker-office-only' : (text.trim() ? 'no-safe-signal' : 'empty')));
    return {
      bodyShape,
      address2Seen: Boolean(structuredDetail),
      structuredFieldSeen,
      structuredFieldName: firstStructuredField ? safeDiagnosticFieldName(firstStructuredField.sourceField) : '',
      structuredFieldNames: safeDiagnosticFieldNames([
        structuredDetail && structuredDetail.sourceField,
        ...structuredFloorDetails.map((detail) => detail && detail.sourceField)
      ]),
      structuredFloorFieldSeen: structuredFloorDetails.length > 0,
      structuredFloorFieldNames,
      structuredFloorTotalFieldSeen,
      structuredValueStatus: structuredDetail ? 'unusable' : 'none',
      visibleFragmentSeen: Boolean(visibleShape.visibleFragmentSeen),
      visibleFragmentStatus: visibleShape.visibleFragmentStatus,
      brokerOfficeBlockSeen: brokerOfficeSeen
    };
  }

  function redirectUrlFor(endpoint, key) {
    const url = new URL(endpoint);
    url.searchParams.set('UID', key);
    return url.href;
  }

  function popupUrlFor(sequence) {
    const url = new URL(MK_POPUP_ENDPOINT);
    url.searchParams.set('mseq', sequence);
    return url.href;
  }

  function landadKisoUrlFor(sequence) {
    const url = new URL(MK_LANDAD_KISO_ENDPOINT);
    url.searchParams.set('cpid', 'KB');
    url.searchParams.set('key', 'r5858494k5848473');
    url.searchParams.set('mk_memul_seq', sequence);
    return url.href;
  }

  function sequenceFromText(value) {
    const text = String(value || '');
    const match = text.match(/[?&]mseq=(\d{1,20})\b/i) || text.match(/\bmseq\s*[:=]\s*["']?(\d{1,20})/i);
    return match && match[1] ? match[1] : '';
  }

  function isRedirectWithSequence(response) {
    const status = Number(response && response.status || 0);
    if (status < 300 || status >= 400) return false;
    return Boolean(
      sequenceFromText(response && response.location) ||
      sequenceFromText(response && response.locator) ||
      sequenceFromText(response && response.bodyText)
    );
  }

  function lookupDiagnostic(status, candidate, overrides) {
    const input = overrides || {};
    const present = Boolean(candidate && candidate.present);
    const floorHint = Boolean(candidate && candidate.floorHintPresent);
    const structuredCandidate = Boolean(input.structuredFieldSeen && candidate && isMkStructuredDetailField(candidate.sourceField));
    const structuredFloorHint = Boolean(input.structuredFieldSeen && candidate && isMkStructuredFloorField(candidate.floorHintSourceField));
    const structuredValueStatus = input.structuredFieldSeen
      ? (structuredCandidate && present ? 'usable-candidate' : ((structuredCandidate || structuredFloorHint) && floorHint ? 'usable-floor-hint' : safeDiagnosticEnum(input.structuredValueStatus, ['unusable'], 'unusable')))
      : 'none';
    return {
      providerFamily: 'mk',
      directLookupStatus: String(status || ''),
      step: String(input.step || ''),
      bodyShape: safeDiagnosticEnum(input.bodyShape, ['empty', 'known-structured', 'visible-fragment', 'broker-office-only', 'no-safe-signal'], 'no-safe-signal'),
      address2Seen: Boolean(input.address2Seen),
      sequenceSeen: Boolean(input.sequenceSeen),
      redirectStatus: safeHttpStatus(input.redirectStatus),
      popupStatus: safeHttpStatus(input.popupStatus),
      redirectTooLarge: Boolean(input.redirectTooLarge),
      popupTooLarge: Boolean(input.popupTooLarge),
      structuredFieldSeen: Boolean(input.structuredFieldSeen || input.address2Seen),
      structuredFieldName: safeDiagnosticFieldName(input.structuredFieldName),
      structuredFieldNames: safeDiagnosticFieldNames(input.structuredFieldNames),
      structuredFloorFieldSeen: Boolean(input.structuredFloorFieldSeen),
      structuredFloorFieldNames: safeDiagnosticFieldNames(input.structuredFloorFieldNames),
      structuredFloorTotalFieldSeen: Boolean(input.structuredFloorTotalFieldSeen),
      structuredValueStatus,
      visibleFragmentSeen: Boolean(input.visibleFragmentSeen),
      visibleFragmentStatus: safeDiagnosticEnum(input.visibleFragmentStatus, ['none', 'accepted', 'floor-mismatch'], 'none'),
      visibleFallbackOnly: Boolean(input.visibleFallbackOnly),
      brokerOfficeBlockSeen: Boolean(input.brokerOfficeBlockSeen),
      candidatePresent: present,
      floorHintPresent: floorHint,
      rejectReason: present || floorHint ? '' : String(input.rejectReason || status || '')
    };
  }

  function lookupResult(status, candidate, overrides) {
    return {
      status,
      candidate: candidate || null,
      diagnostic: lookupDiagnostic(status, candidate, overrides)
    };
  }

  function usableMkFallbackCandidate(candidate) {
    return candidate && typeof candidate === 'object' && (candidate.present || candidate.floorHintPresent)
      ? candidate
      : null;
  }

  async function fetchMkRedirect(key, fetchImpl) {
    let lastStatus = 0;
    let lastOkResponse = null;
    for (const endpoint of MK_REDIRECT_ENDPOINTS) {
      try {
        const response = await fetchText(fetchImpl, redirectUrlFor(endpoint, key), {
          credentials: 'omit',
          redirect: 'manual',
          headers: { Referer: MK_REFERER }
        });
        lastStatus = response.status;
        if (response.ok || isRedirectWithSequence(response)) {
          lastOkResponse = response;
          if (
            response.tooLarge ||
            isRedirectWithSequence(response) ||
            sequenceFromText(response.location) ||
            sequenceFromText(response.locator) ||
            sequenceFromText(response.bodyText) ||
            extractMkStructuredDetailFromHtml(response.bodyText)
          ) {
            return response;
          }
        }
      } catch (_) {
        lastStatus = 0;
      }
    }
    if (lastOkResponse) return lastOkResponse;
    return { ok: false, status: lastStatus, locator: '', location: '', bodyText: '' };
  }

  async function lookupMkLandadKisoCandidate(sequence, settings, fetchImpl, baseDiagnostic, step) {
    if (!sequence || !fetchImpl) return null;
    try {
      const landad = await fetchText(fetchImpl, landadKisoUrlFor(sequence), {
        credentials: 'omit',
        redirect: 'follow',
        headers: {
          Accept: 'application/json, text/plain, */*',
          Referer: MK_REFERER
        }
      });
      if (!landad.ok || landad.tooLarge) return null;
      const landadShape = providerBodyShape(landad.bodyText, settings);
      const landadStructuredSeen = landadShape.address2Seen || landadShape.structuredFieldSeen;
      const landadCandidate = buildMkProviderCandidateFromHtml(landad.bodyText, settings);
      if (!landadStructuredSeen || (!landadCandidate.present && !landadCandidate.floorHintPresent)) return null;
      return lookupResult('candidate', landadCandidate, Object.assign({}, baseDiagnostic || {}, {
        step: step || 'landad-kiso-json',
        sequenceSeen: true
      }, landadShape));
    } catch (_) {
      return null;
    }
  }

  async function lookupMkProviderCandidate(input) {
    const settings = input || {};
    const key = validListingKey(settings.listingKey);
    const fetchImpl = typeof settings.fetchImpl === 'function'
      ? settings.fetchImpl
      : (typeof fetch === 'function' ? fetch.bind(globalScope) : null);
    if (!key) return lookupResult('missing-key', null, { step: 'prepare', rejectReason: 'missing-key' });
    if (!fetchImpl) return lookupResult('missing-fetch', null, { step: 'prepare', rejectReason: 'missing-fetch' });

    const redirect = await fetchMkRedirect(key, fetchImpl);
    if (!redirect.ok && !isRedirectWithSequence(redirect)) {
      return lookupResult('redirect-http-stop', null, {
        step: 'mk-redirect',
        redirectStatus: redirect.status,
        rejectReason: 'redirect-http-stop'
      });
    }
    if (redirect.tooLarge) {
      return lookupResult('redirect-body-too-large', null, {
        step: 'mk-redirect',
        redirectStatus: redirect.status,
        redirectTooLarge: true,
        rejectReason: 'redirect-body-too-large'
      });
    }

    const redirectShape = providerBodyShape(redirect.bodyText, settings);
    const redirectAddress2Seen = redirectShape.address2Seen || redirectShape.structuredFieldSeen;
    const redirectCandidate = buildMkProviderCandidateFromHtml(redirect.bodyText, settings);
    if (redirectAddress2Seen && (redirectCandidate.present || redirectCandidate.floorHintPresent)) {
      return lookupResult('candidate', redirectCandidate, Object.assign({
        step: 'mk-redirect',
        redirectStatus: redirect.status
      }, redirectShape));
    }

    const sequence = sequenceFromText(redirect.location) || sequenceFromText(redirect.locator) || sequenceFromText(redirect.bodyText);
    if (!sequence) {
      const fallback = usableMkFallbackCandidate(redirectCandidate);
      if (fallback) return lookupResult('candidate', fallback, Object.assign({ step: 'mk-redirect', redirectStatus: redirect.status }, redirectShape));
      return lookupResult('missing-sequence', null, Object.assign({
        step: 'mk-redirect',
        redirectStatus: redirect.status,
        rejectReason: 'missing-sequence'
      }, redirectShape));
    }

    const popup = await fetchText(fetchImpl, popupUrlFor(sequence), {
      credentials: 'omit',
      redirect: 'follow',
      headers: { Referer: MK_REFERER }
    });
    if (!popup.ok) {
      return lookupResult('popup-http-stop', null, {
        step: 'kiso-popup',
        sequenceSeen: true,
        redirectStatus: redirect.status,
        popupStatus: popup.status,
        rejectReason: 'popup-http-stop'
      });
    }
    if (popup.tooLarge) {
      return lookupResult('popup-body-too-large', null, {
        step: 'kiso-popup',
        sequenceSeen: true,
        redirectStatus: redirect.status,
        popupStatus: popup.status,
        popupTooLarge: true,
        rejectReason: 'popup-body-too-large'
      });
    }

    const popupShape = providerBodyShape(popup.bodyText, settings);
    const popupAddress2Seen = popupShape.address2Seen || popupShape.structuredFieldSeen;
    const candidate = buildMkProviderCandidateFromHtml(popup.bodyText, settings);
    if (popupAddress2Seen && (candidate.present || candidate.floorHintPresent)) {
      return lookupResult('candidate', candidate, Object.assign({
        step: 'kiso-popup',
        sequenceSeen: true,
        redirectStatus: redirect.status,
        popupStatus: popup.status
      }, popupShape));
    }
    const fallback = usableMkFallbackCandidate(candidate) || usableMkFallbackCandidate(redirectCandidate);
    if (fallback) return lookupResult('candidate', fallback, Object.assign({
      step: 'kiso-popup',
      sequenceSeen: true,
      redirectStatus: redirect.status,
      popupStatus: popup.status
    }, popupShape));
    const landadResult = await lookupMkLandadKisoCandidate(sequence, settings, fetchImpl, {
      redirectStatus: redirect.status,
      popupStatus: popup.status
    }, 'landad-kiso-json');
    if (landadResult && landadResult.status === 'candidate') return landadResult;
    return lookupResult('no-candidate', null, Object.assign({
      step: 'kiso-popup',
      sequenceSeen: true,
      redirectStatus: redirect.status,
      popupStatus: popup.status,
      rejectReason: 'no-candidate'
    }, popupShape));
  }

  async function lookupMkProviderCandidateFromCurrentPage(input) {
    const settings = input || {};
    const fetchImpl = typeof settings.fetchImpl === 'function'
      ? settings.fetchImpl
      : (typeof fetch === 'function' ? fetch.bind(globalScope) : null);
    if (!fetchImpl) return lookupResult('missing-fetch', null, { step: 'current-page', rejectReason: 'missing-fetch' });

    const currentText = [settings.href, settings.bodyText].filter(Boolean).join(' ');
    const sequence = sequenceFromText(currentText);
    const pageShape = providerBodyShape(settings.bodyText || '', settings);
    const pageStructuredSeen = pageShape.address2Seen || pageShape.structuredFieldSeen;
    const pageCandidate = buildMkProviderCandidateFromHtml(settings.bodyText || '', settings);
    if (pageStructuredSeen && (pageCandidate.present || pageCandidate.floorHintPresent)) {
      return lookupResult('candidate', pageCandidate, Object.assign({ step: 'current-page' }, pageShape));
    }

    if (!sequence) {
      const fallback = usableMkFallbackCandidate(pageCandidate);
      if (fallback) return lookupResult('candidate', fallback, Object.assign({ step: 'current-page' }, pageShape));
      return lookupResult('missing-sequence', null, Object.assign({ step: 'current-page', rejectReason: 'missing-sequence' }, pageShape));
    }

    const popup = await fetchText(fetchImpl, popupUrlFor(sequence), {
      credentials: 'omit',
      redirect: 'follow'
    });
    if (!popup.ok) return lookupResult('popup-http-stop', null, { step: 'current-page-kiso-popup', sequenceSeen: true, popupStatus: popup.status, rejectReason: 'popup-http-stop' });
    if (popup.tooLarge) return lookupResult('popup-body-too-large', null, { step: 'current-page-kiso-popup', sequenceSeen: true, popupStatus: popup.status, popupTooLarge: true, rejectReason: 'popup-body-too-large' });

    const popupShape = providerBodyShape(popup.bodyText, settings);
    const popupStructuredSeen = popupShape.address2Seen || popupShape.structuredFieldSeen;
    const candidate = buildMkProviderCandidateFromHtml(popup.bodyText, settings);
    if (popupStructuredSeen && (candidate.present || candidate.floorHintPresent)) {
      return lookupResult('candidate', candidate, Object.assign({
        step: 'current-page-kiso-popup',
        sequenceSeen: true,
        popupStatus: popup.status
      }, popupShape));
    }

    const fallback = usableMkFallbackCandidate(candidate) || usableMkFallbackCandidate(pageCandidate);
    if (fallback) return lookupResult('candidate', fallback, Object.assign({
      step: 'current-page-kiso-popup',
      sequenceSeen: true,
      popupStatus: popup.status
    }, popupShape));
    const landadResult = await lookupMkLandadKisoCandidate(sequence, settings, fetchImpl, {
      popupStatus: popup.status
    }, 'current-page-landad-kiso-json');
    if (landadResult && landadResult.status === 'candidate') return landadResult;
    return lookupResult('no-candidate', null, Object.assign({
      step: 'current-page-kiso-popup',
      sequenceSeen: true,
      popupStatus: popup.status,
      rejectReason: 'no-candidate'
    }, popupShape));
  }

  async function lookupMkProviderCandidateFromSequence(input) {
    const settings = input || {};
    const sequence = validSequenceKey(settings.sequenceKey);
    const fetchImpl = typeof settings.fetchImpl === 'function'
      ? settings.fetchImpl
      : (typeof fetch === 'function' ? fetch.bind(globalScope) : null);
    if (!sequence) return lookupResult('missing-sequence', null, { step: 'group-route-kiso-popup', rejectReason: 'missing-sequence' });
    if (!fetchImpl) return lookupResult('missing-fetch', null, { step: 'group-route-kiso-popup', rejectReason: 'missing-fetch' });

    const popup = await fetchText(fetchImpl, popupUrlFor(sequence), {
      credentials: 'omit',
      redirect: 'follow',
      headers: { Referer: MK_REFERER }
    });
    if (!popup.ok) return lookupResult('popup-http-stop', null, { step: 'group-route-kiso-popup', sequenceSeen: true, popupStatus: popup.status, rejectReason: 'popup-http-stop' });
    if (popup.tooLarge) return lookupResult('popup-body-too-large', null, { step: 'group-route-kiso-popup', sequenceSeen: true, popupStatus: popup.status, popupTooLarge: true, rejectReason: 'popup-body-too-large' });

    const popupShape = providerBodyShape(popup.bodyText, settings);
    const popupStructuredSeen = popupShape.address2Seen || popupShape.structuredFieldSeen;
    const candidate = buildMkProviderCandidateFromHtml(popup.bodyText, settings);
    if (popupStructuredSeen && (candidate.present || candidate.floorHintPresent)) {
      return lookupResult('candidate', candidate, Object.assign({
        step: 'group-route-kiso-popup',
        sequenceSeen: true,
        popupStatus: popup.status
      }, popupShape));
    }
    const landadResult = await lookupMkLandadKisoCandidate(sequence, settings, fetchImpl, {
      popupStatus: popup.status
    }, 'group-route-landad-kiso-json');
    if (landadResult && landadResult.status === 'candidate') return landadResult;
    const fallback = usableMkFallbackCandidate(candidate);
    if (fallback) return lookupResult('no-candidate', null, Object.assign({
      step: 'group-route-kiso-popup',
      sequenceSeen: true,
      popupStatus: popup.status,
      visibleFallbackOnly: true,
      rejectReason: 'visible-fallback-only'
    }, popupShape));
    return lookupResult('no-candidate', null, Object.assign({
      step: 'group-route-kiso-popup',
      sequenceSeen: true,
      popupStatus: popup.status,
      rejectReason: 'no-candidate'
    }, popupShape));
  }

  const api = {
    extractMkAddress2FromHtml,
    extractMkStructuredDetailFromHtml,
    extractDongHoFragmentFromMkHtml,
    mkNormalizeDetailAddress,
    buildMkProviderCandidateFromHtml,
    lookupMkProviderCandidate,
    lookupMkProviderCandidateFromSequence,
    lookupMkProviderCandidateFromCurrentPage
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }

  globalScope.DHS_MK_PROVIDER_LOOKUP = api;
})(typeof globalThis !== 'undefined' ? globalThis : self);
