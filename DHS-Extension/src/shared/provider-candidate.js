(function exposeProviderCandidate(globalScope) {
  const DONG = '\uB3D9';
  const HO = '\uD638';
  const FLOOR = '\uCE35';
  const LINE = '\uC120';
  const UNIT_LINE = '\uB77C\uC778';
  const LOW = '\uC800';
  const MID = '\uC911';
  const HIGH = '\uACE0';
  const FLOOR_BAND_TOTAL_PATTERN = new RegExp(`(?<![\\uAC00-\\uD7AF])[${LOW}${MID}${HIGH}]\\s*${FLOOR}?\\s*(?:\\/|\\s+)\\s*\\d{1,3}\\s*${FLOOR}`);
  const SERVE_ROW_FIELD = 'serve-row';
  const PROVIDER_FAMILIES = new Set([
    'mk',
    'r114',
    'gongsilclub',
    'homesdid',
    'serve',
    'rfine',
    'rter',
    'asil',
    'hankyung',
    'daara',
    'neonet',
    'ten',
    'kar',
    'thebiz',
    'kiso',
    'woori'
  ]);
  const PROVIDER_CPID_FAMILY = Object.freeze({
    fine: 'rfine',
    rter: 'rter',
    serve: 'serve',
    ten: 'ten',
    rets: 'rter',
    asil: 'asil',
    bizmk: 'mk',
    neonet: 'neonet',
    hkdotcom: 'hankyung',
    kar: 'kar',
    thebiz: 'thebiz',
    industry: 'daara',
    woori: 'woori'
  });
  const FIELD_NAMES = [
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
    'atclName',
    'DONG_NM',
    'kiso_address2',
    'dong_name',
    'dongName',
    'dong',
    'dongNm',
    'address_ho',
    'ho',
    SERVE_ROW_FIELD
  ];
  const FLOOR_FIELD_NAMES = [
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
  const FIELD_SET = new Set(FIELD_NAMES.map((name) => name.toLowerCase()));
  const FLOOR_FIELD_SET = new Set(FLOOR_FIELD_NAMES.map((name) => name.toLowerCase()));
  const MK_VISIBLE_TEXT_FIELD = 'mk-visible-text';
  const PROVIDER_DEEP_SCAN_FIELD = 'provider-deep-scan';
  const VISIBLE_FLOOR_TEXT_FIELD = 'visible-floor-text';
  const SOURCE_FIELDS = new Set(FIELD_NAMES.concat([MK_VISIBLE_TEXT_FIELD, PROVIDER_DEEP_SCAN_FIELD]));
  const FLOOR_SOURCE_FIELDS = new Set(FLOOR_FIELD_NAMES.concat([VISIBLE_FLOOR_TEXT_FIELD]));
  const FLOOR_TOTAL_FIELD_SET = new Set(['floor_cnt_total', 'floorcnttotal', 'buildinghighestfloor']);
  const FLOOR_NUMBER_ONLY_FIELD_SET = new Set([
    'floor_cnt',
    'floorcnt',
    'frlfloor',
    'roomfloor',
    'unitfloor',
    'floor1',
    'floor2',
    'floorname',
    'floortype'
  ]);
  const CANDIDATE_KINDS = new Set(['dong-ho', 'ho-only']);
  const DONG_ONLY_FIELD_SET = new Set(['address1', 'addr1', 'dong_nm', 'dong_name', 'dongname', 'dongno', 'dong_no', 'buildingno', 'bildno', 'dong', 'dongnm', 'article_address2']);
  const HO_ONLY_FIELD_SET = new Set(['address2', 'addr2', 'addr3', 'address3', 'hono', 'honame', 'unitno', 'roomno', 'houseno', 'honm', 'ho', 'address_ho', 'article_address3']);
  const EXPLICIT_HO_FIELD_SET = new Set(['hono', 'honame', 'unitno', 'roomno', 'houseno', 'honm', 'ho', 'address_ho']);
  const BROKER_OFFICE_CONTEXT_TERMS = [
    '\uC911\uAC1C',
    '\uACF5\uC778\uC911\uAC1C\uC0AC',
    '\uC0AC\uBB34\uC18C',
    '\uC18C\uC7AC\uC9C0',
    '\uB300\uD45C',
    '\uB4F1\uB85D\uBC88\uD638',
    '\uC804\uD654',
    '\uC5F0\uB77D\uCC98',
    '\uC0C1\uAC00\uB3D9',
    '\uAE38\uCC3E\uAE30'
  ];
  const BROKER_OFFICE_CONTEXT_PATTERN = new RegExp(BROKER_OFFICE_CONTEXT_TERMS.join('|'), 'i');

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
    const match = normalizeText(value).match(new RegExp(`(?<!\\d)(\\d{1,4})\\s*${HO}(?!\\s*(?:${LINE}|${UNIT_LINE}))`));
    return match ? `${canonicalNumber(match[1])}${HO}` : '';
  }

  function floorValueFromHo(value) {
    const hoToken = extractHoToken(value);
    const digits = (hoToken.match(/\d+/) || [''])[0];
    if (digits.length < 3) return 0;
    return Math.floor(Number(digits) / 100) || 0;
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

  function floorMatchesListingContext(candidateFloorValue, listingContext) {
    const rawFloorKind = String(listingContext.detailFloorKind || listingContext.floorKind || '');
    const rawDetailFloorValue = Number(listingContext.detailFloorValue || listingContext.floorValue || 0);
    const floorKind = rawFloorKind || (rawDetailFloorValue > 0 ? 'exact' : '');
    const detailFloorValue = floorKind === 'exact' ? rawDetailFloorValue : 0;
    if (detailFloorValue > 0) {
      return candidateFloorValue === detailFloorValue
        ? { matches: true, reason: 'context-match' }
        : { matches: false, reason: 'floor-mismatch' };
    }

    const floorBand = String(listingContext.detailFloorBand || listingContext.floorBand || '');
    const totalFloor = Number(listingContext.detailTotalFloor || listingContext.totalFloor || 0);
    if (floorKind === 'band' && floorBand && totalFloor > 0) {
      const range = bandRange(floorBand, totalFloor);
      if (!range) return { matches: false, reason: 'missing-context' };
      return candidateFloorValue >= range[0] && candidateFloorValue <= range[1]
        ? { matches: true, reason: 'context-match' }
        : { matches: false, reason: 'floor-band-mismatch' };
    }

    return { matches: false, reason: 'missing-context' };
  }

  function candidateFloorExceedsListingTotal(candidateFloorValue, listingContext) {
    const totalFloor = Number(
      (listingContext && (listingContext.detailTotalFloor || listingContext.totalFloor)) || 0
    );
    return totalFloor > 0 && Number(candidateFloorValue || 0) > totalFloor;
  }

  function floorSoftMatchesListingBand(candidateFloorValue, listingContext) {
    const context = listingContext && typeof listingContext === 'object' ? listingContext : {};
    const floorKind = String(context.detailFloorKind || context.floorKind || '');
    const floorBand = String(context.detailFloorBand || context.floorBand || '');
    const totalFloor = Number(context.detailTotalFloor || context.totalFloor || 0);
    if (floorKind !== 'band' || !floorBand || totalFloor <= 0) return false;
    const range = bandRange(floorBand, totalFloor);
    if (!range) return false;
    const paddedStart = Math.max(1, range[0] - 1);
    const paddedEnd = Math.min(totalFloor, range[1] + 1);
    return candidateFloorValue >= paddedStart && candidateFloorValue <= paddedEnd;
  }

  function comparableToken(value) {
    return normalizeText(value).toUpperCase().replace(/[^0-9A-Z\uAC00-\uD7AF]/g, '');
  }

  function listingTypeToken(listingContext) {
    return comparableToken(
      listingContext.detailTypeToken ||
      listingContext.typeToken ||
      listingContext.pyeongType ||
      ''
    ).slice(0, 24);
  }

  function typeNeedleParts(value) {
    const match = comparableToken(value).match(/^(\d{2,3})([A-Z]{0,3})$/);
    return match ? { base: match[1], suffix: match[2] || '' } : { base: '', suffix: '' };
  }

  function typeNeedlesCompatible(candidateType, listingType) {
    const candidate = typeNeedleParts(candidateType);
    const listing = typeNeedleParts(listingType);
    if (!candidate.base || !listing.base) return true;
    if (candidate.base !== listing.base) return false;
    if (candidate.suffix && listing.suffix && candidate.suffix !== listing.suffix) return false;
    return true;
  }

  function listingTypeTokens(listingContext) {
    const context = listingContext && typeof listingContext === 'object' ? listingContext : {};
    const values = [listingTypeToken(context)]
      .concat(Array.isArray(context.detailTypeAliases) ? context.detailTypeAliases : [])
      .map((value) => comparableToken(value).slice(0, 24))
      .filter(Boolean);
    const result = [];
    for (const value of values) {
      if (!result.includes(value)) result.push(value);
    }
    return result.slice(0, 8);
  }

  function typeTokenFromText(value) {
    const text = normalizeText(value);
    const pattern = /(?<!\d)(0?\d{2,3})(?:\.\d+)?\s*([A-Z]{0,3})(?![A-Z0-9])/gi;
    const candidates = [];
    let match;
    while ((match = pattern.exec(text))) {
      const suffix = String(match[2] || '').toUpperCase();
      const after = text.slice(match.index + String(match[0] || '').length).trimStart().charAt(0);
      if ([DONG, HO, FLOOR].includes(after)) continue;
      const token = comparableToken(`${Number(match[1]) || match[1]}${suffix}`).slice(0, 24);
      if (!token) continue;
      candidates.push({ token, hasSuffix: Boolean(suffix) });
    }
    const preferred = candidates.find((candidate) => candidate.hasSuffix) || candidates[0];
    return preferred ? preferred.token : '';
  }

  function sourceFieldAllowedForFamily(sourceField, providerFamily) {
    if (String(sourceField || '') !== SERVE_ROW_FIELD) return true;
    return String(providerFamily || '') === 'serve';
  }

  function scopedFloorSegments(bodyText, listingContext) {
    const context = listingContext && typeof listingContext === 'object' ? listingContext : {};
    const dongToken = extractDongToken(context.detailDongToken || context.detailText || '');
    if (!dongToken) return [];
    const raw = String(bodyText || '');
    if (!raw) return [];

    const dongNeedle = comparableToken(dongToken);
    const typeNeedle = listingTypeToken(context);
    const rows = raw.split(/\r?\n/)
      .map((line) => normalizeText(line))
      .filter(Boolean)
      .slice(0, 200);
    const segments = [];
    const seen = new Set();
    const pushSegment = (segment) => {
      const value = normalizeText(segment).slice(0, 260);
      if (!value) return;
      const comparable = comparableToken(value);
      if (!comparable.includes(dongNeedle)) return;
      if (typeNeedle && !comparable.includes(typeNeedle)) return;
      if (seen.has(value)) return;
      seen.add(value);
      segments.push(value);
    };

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (!comparableToken(row).includes(dongNeedle)) continue;
      pushSegment(row);
      pushSegment(rows.slice(Math.max(0, index - 1), Math.min(rows.length, index + 2)).join(' '));
    }

    if (segments.length < 1) {
      const normalized = normalizeText(raw);
      let searchFrom = 0;
      while (segments.length < 20) {
        const comparable = comparableToken(normalized.slice(searchFrom));
        const comparableIndex = comparable.indexOf(dongNeedle);
        if (comparableIndex < 0) break;
        const rawIndex = normalized.indexOf(dongToken, searchFrom);
        if (rawIndex < 0) break;
        pushSegment(normalized.slice(Math.max(0, rawIndex - 120), rawIndex + 220));
        searchFrom = rawIndex + dongToken.length;
      }
    }

    return segments.slice(0, 20);
  }

  function scopedFloorHintFromBodyText(bodyText, listingContext) {
    const context = listingContext && typeof listingContext === 'object' ? listingContext : {};
    const segments = scopedFloorSegments(bodyText, context);
    if (segments.length < 1) return emptyFloorHint();

    const hints = [];
    for (const segment of segments) {
      const hint = extractFloorHintFromValue(VISIBLE_FLOOR_TEXT_FIELD, segment);
      if (!hint.floorHintPresent) continue;
      const match = floorMatchesListingContext(hint.floorHintValue, context);
      if (!match.matches) continue;
      const expectedTotal = Number(context.detailTotalFloor || context.totalFloor || 0);
      if (expectedTotal > 0 && Number(hint.floorHintTotal || 0) > 0 && Number(hint.floorHintTotal || 0) !== expectedTotal) {
        continue;
      }
      hints.push(hint);
    }

    const unique = new Map();
    for (const hint of hints) {
      unique.set(`${hint.floorHintValue}/${hint.floorHintTotal || 0}`, hint);
    }
    return unique.size === 1 ? unique.values().next().value : emptyFloorHint();
  }

  function hasFloorListingContext(listingContext) {
    const context = listingContext && typeof listingContext === 'object' ? listingContext : {};
    if (!extractDongToken(context.detailDongToken || context.detailText || '')) return false;
    if (Number(context.detailFloorValue || context.floorValue || 0) > 0) return true;
    return String(context.detailFloorKind || context.floorKind || '') === 'band' &&
      String(context.detailFloorBand || context.floorBand || '') &&
      Number(context.detailTotalFloor || context.totalFloor || 0) > 0;
  }

  function allowsHoOnlyBandContext(candidateInput) {
    const sourceField = String(candidateInput && candidateInput.sourceField || '');
    const providerFamily = String(candidateInput && candidateInput.providerFamily || '');
    return providerFamily === 'mk' && sourceField === MK_VISIBLE_TEXT_FIELD;
  }

  function requiresExactFloorProviderContext(candidateInput) {
    const sourceField = String(candidateInput && candidateInput.sourceField || '');
    const providerFamily = String(candidateInput && candidateInput.providerFamily || '');
    const kind = String(candidateInput && candidateInput.candidateKind || candidateInput && candidateInput.kind || '');
    return providerFamily === 'mk' && (
      sourceField === PROVIDER_DEEP_SCAN_FIELD ||
      (sourceField === MK_VISIBLE_TEXT_FIELD && kind === 'ho-only')
    );
  }

  function decodeHtml(value) {
    return String(value || '')
      .replace(/&quot;/g, '"')
      .replace(/&#34;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  function decodeFieldValue(value) {
    const htmlDecoded = decodeHtml(value);
    try {
      return normalizeText(decodeURIComponent(htmlDecoded.replace(/\+/g, ' ')));
    } catch (_) {
      return normalizeText(htmlDecoded);
    }
  }

  function stripHtml(value) {
    return decodeHtml(String(value || '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '));
  }

  function hashMarker(value) {
    const input = String(value || '');
    let hash = 0x811c9dc5;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function candidateKind(value) {
    const normalized = normalizeText(value);
    const hasDong = new RegExp(`\\d{1,4}\\s*${DONG}`).test(normalized);
    const hasHo = new RegExp(`\\d{1,4}\\s*${HO}(?!\\s*(?:${LINE}|${UNIT_LINE}))`).test(normalized);
    if (hasDong && hasHo) return 'dong-ho';
    if (hasHo) return 'ho-only';
    return 'none';
  }

  function fieldPriority(name) {
    const index = FIELD_NAMES.findIndex((field) => field.toLowerCase() === String(name || '').toLowerCase());
    return index === -1 ? FIELD_NAMES.length : index;
  }

  function emptyFloorHint() {
    return {
      floorHintPresent: false,
      floorHintValue: 0,
      floorHintTotal: 0,
      floorHintSourceField: '',
      floorHintMarker: ''
    };
  }

  function withFloorHint(result, floorHint) {
    const hint = sanitizeFloorHint(floorHint);
    return hint.floorHintPresent ? Object.assign(result, hint) : result;
  }

  function sanitizeProviderCpid(value, providerFamily) {
    const cpid = String(value || '').trim().toLowerCase();
    const family = String(providerFamily || '');
    if (!Object.prototype.hasOwnProperty.call(PROVIDER_CPID_FAMILY, cpid)) return '';
    if (family && PROVIDER_CPID_FAMILY[cpid] !== family) return '';
    return cpid;
  }

  function isTrustedDirectSourceField(input, cpid) {
    const sourceField = String(input && input.sourceField || '').toLowerCase();
    if (cpid === 'bizmk') return ['address2', 'addr2', 'detailaddress', 'dongho', 'atclname'].includes(sourceField);
    return sourceField && sourceField !== MK_VISIBLE_TEXT_FIELD;
  }

  function directSourceMetadata(input, providerFamily) {
    const cpid = sanitizeProviderCpid(input && input.providerCpid, providerFamily);
    if (!cpid) return {};
    if (!isTrustedDirectSourceField(input, cpid)) return {};
    return {
      providerCpid: cpid,
      providerSourceLabel: `CPID:${cpid}`,
      certainty: 'CERTAIN_CPID',
      rank: 90
    };
  }

  function isTrustedDirectCpidCandidate(input, providerFamily) {
    return directSourceMetadata(input, providerFamily).certainty === 'CERTAIN_CPID';
  }

  function emptyResult(providerFamily, floorHint) {
    const result = {
      present: false,
      providerFamily: providerFamily || '',
      sourceField: '',
      candidateKind: 'none',
      redactedCandidate: '',
      displayCandidate: ''
    };
    return withFloorHint(result, floorHint);
  }

  function validFloorValue(value) {
    const floor = Number(value) || 0;
    return Number.isInteger(floor) && floor > 0 && floor <= 100;
  }

  function validTotalFloor(value) {
    const total = Number(value) || 0;
    return total === 0 || (Number.isInteger(total) && total > 0 && total <= 150);
  }

  function floorHintFromMatch(sourceField, floorValue, totalFloor) {
    const floor = Number(floorValue) || 0;
    const total = Number(totalFloor) || 0;
    if (!validFloorValue(floor) || !validTotalFloor(total)) return emptyFloorHint();
    if (total > 0 && floor > total) return emptyFloorHint();
    const source = FLOOR_SOURCE_FIELDS.has(sourceField) ? sourceField : VISIBLE_FLOOR_TEXT_FIELD;
    return {
      floorHintPresent: true,
      floorHintValue: floor,
      floorHintTotal: total,
      floorHintSourceField: source,
      floorHintMarker: `floor:${hashMarker(`${source}:${floor}/${total}`)}`
    };
  }

  function isFloorBandTotalContext(text, match) {
    if (!match) return false;
    const start = typeof match.index === 'number' ? match.index : 0;
    const body = String(match[0] || '');
    const context = `${String(text || '').slice(Math.max(0, start - 12), start)}${body}`;
    return FLOOR_BAND_TOTAL_PATTERN.test(context);
  }

  function sanitizeFloorHint(input) {
    const hint = input && typeof input === 'object' ? input : {};
    if (!hint.floorHintPresent) return emptyFloorHint();
    const sourceField = String(hint.floorHintSourceField || '');
    const marker = String(hint.floorHintMarker || '');
    const floor = Number(hint.floorHintValue || 0);
    const total = Number(hint.floorHintTotal || 0);
    if (!FLOOR_SOURCE_FIELDS.has(sourceField)) return emptyFloorHint();
    if (!/^floor:[a-f0-9]{8}$/.test(marker)) return emptyFloorHint();
    if (!validFloorValue(floor) || !validTotalFloor(total)) return emptyFloorHint();
    if (total > 0 && floor > total) return emptyFloorHint();
    return {
      floorHintPresent: true,
      floorHintValue: floor,
      floorHintTotal: total,
      floorHintSourceField: sourceField,
      floorHintMarker: marker
    };
  }

  function extractFloorHintFromValue(sourceField, value, pairedTotalFloor) {
    const source = FLOOR_SOURCE_FIELDS.has(sourceField) ? sourceField : VISIBLE_FLOOR_TEXT_FIELD;
    const text = normalizeText(stripHtml(decodeFieldValue(value)));
    if (!text) return emptyFloorHint();
    if (source === VISIBLE_FLOOR_TEXT_FIELD && text.length > 120) return emptyFloorHint();

    if (FLOOR_NUMBER_ONLY_FIELD_SET.has(String(sourceField || '').toLowerCase()) && /^\d{1,2}$/.test(text)) {
      return floorHintFromMatch(source, text, pairedTotalFloor || 0);
    }

    const slash = text.match(new RegExp(`(?<!\\d)(\\d{1,2})\\s*\\/\\s*(\\d{1,3})\\s*${FLOOR}`));
    if (slash) return floorHintFromMatch(source, slash[1], slash[2]);

    const labelledPattern = new RegExp(`(?:\\uD574\\uB2F9\\s*${FLOOR}|\\uCE35\\s*\\uC218|\\uB9E4\\uBB3C\\s*${FLOOR}|floor|atclFlr)\\D{0,12}(\\d{1,2})\\s*${FLOOR}`, 'ig');
    let labelled;
    while ((labelled = labelledPattern.exec(text))) {
      if (!isFloorBandTotalContext(text, labelled)) return floorHintFromMatch(source, labelled[1], pairedTotalFloor || 0);
    }

    if (source !== VISIBLE_FLOOR_TEXT_FIELD || text.length <= 80) {
      const exactPattern = new RegExp(`(?<!\\d)(\\d{1,2})\\s*${FLOOR}(?!\\s*(?:\\uC774\\uC0C1|\\uC774\\uD558|\\uAC74|\\uC138\\uB300|\\uB77C\\uC778))`, 'g');
      let exact;
      while ((exact = exactPattern.exec(text))) {
        if (!isFloorBandTotalContext(text, exact) && !/(?:\uCD1D|\uCD5C\uACE0|\uC804\uCCB4)\s*\d{1,2}\s*\uCE35/.test(text)) {
          return floorHintFromMatch(source, exact[1], pairedTotalFloor || 0);
        }
      }
    }

    return emptyFloorHint();
  }

  function extractMkVisibleCandidate(bodyText) {
    const normalized = normalizeText(stripHtml(bodyText));
    return boundedDisplayCandidate(normalized);
  }

  function boundedDisplayCandidate(value) {
    const normalized = normalizeText(value);
    const dongToken = extractDongToken(normalized);
    const hoToken = extractHoToken(normalized);
    return dongToken && hoToken ? `${dongToken} ${hoToken}` : '';
  }

  function boundedHoOnlyCandidate(value) {
    return extractHoToken(value);
  }

  function numericDongToken(value) {
    const text = normalizeText(value).replace(/[^0-9A-Za-z]/g, '');
    return /^[0-9]{1,4}$/.test(text) ? `${canonicalNumber(text)}${DONG}` : '';
  }

  function numericHoToken(value) {
    const text = normalizeText(value).replace(/[^0-9A-Za-z]/g, '');
    return /^[A-Za-z]?[0-9]{2,4}$/.test(text) ? `${String(text).toUpperCase()}${HO}` : '';
  }

  function primitiveText(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number') return normalizeText(value);
    return '';
  }

  function firstPrimitive(object, fields) {
    const row = object && typeof object === 'object' ? object : {};
    for (const field of fields) {
      const text = primitiveText(row[field]);
      if (text) return text;
    }
    return '';
  }

  function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function isServeLegalLotField(sourceField, value, carrier) {
    const sourceKey = String(sourceField || '').toLowerCase();
    if (!['addr2', 'address2'].includes(sourceKey)) return false;
    const lot = decodeFieldValue(value);
    if (!/^\d{1,5}(?:-\d{1,5})?$/.test(lot)) return false;

    const carrierText = typeof carrier === 'string'
      ? normalizeText(stripHtml(carrier))
      : normalizeText([
        firstPrimitive(carrier, ['addrKiso', 'addressKiso', 'jibunAddress', 'addressJibun', 'addrJibun', 'jibun']),
        firstPrimitive(carrier, ['addr1', 'address1'])
      ].filter(Boolean).join(' '));
    if (!carrierText) return false;

    const escapedLot = escapeRegExp(lot);
    if (new RegExp(`(?<!\\d)${escapedLot}\\s*${HO}(?!\\s*(?:${LINE}|${UNIT_LINE}))`).test(carrierText)) {
      return false;
    }
    if (typeof carrier === 'string') {
      const kisoFieldPattern = new RegExp(
        `(?<![A-Za-z0-9_])["']?(?:addrKiso|addressKiso|jibunAddress|addressJibun|addrJibun|jibun)["']?\\s*[:=]\\s*["'][^"']*(?<!\\d)${escapedLot}(?!\\d)`,
        'i'
      );
      return kisoFieldPattern.test(carrierText);
    }
    return new RegExp(`(?<!\\d)${escapedLot}(?!\\d)`).test(carrierText);
  }

  function primitiveTextUnlessServeLegalLot(row, field) {
    if (isServeLegalLotField(field, row && row[field], row)) return '';
    return primitiveText(row && row[field]);
  }

  function firstServePrimitive(object, fields) {
    const row = object && typeof object === 'object' ? object : {};
    for (const field of fields) {
      const text = primitiveTextUnlessServeLegalLot(row, field);
      if (text) return text;
    }
    return '';
  }

  function shouldIgnoreProviderField(sourceField, value, providerFamily, bodyText) {
    return String(providerFamily || '') === 'serve' &&
      isServeLegalLotField(sourceField, value, bodyText);
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
    return typeTokenFromText(text);
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
    ].map((field) => primitiveTextUnlessServeLegalLot(row, field)).filter(Boolean).join(' ');
    const direct = boundedDisplayCandidate(ownText);
    if (direct) return direct;

    const dongToken = extractDongToken(ownText) || numericDongToken(firstServePrimitive(row, [
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
    const hoToken = extractHoToken(ownText) || numericHoToken(firstServePrimitive(row, [
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
      rows.push({ sourceField: SERVE_ROW_FIELD, value: rowText });
    }

    for (const child of Object.values(value).slice(0, 120)) {
      if (child && typeof child === 'object') {
        collectServeRowFieldValuesFromValue(child, rows, depth + 1);
      }
    }
  }

  function collectServeRowFieldValuesFromBodyText(bodyText) {
    const text = String(bodyText || '');
    if (!text || text.length > 600000) return [];
    const rows = [];
    try {
      collectServeRowFieldValuesFromValue(JSON.parse(text), rows, 0);
    } catch (_) {
      return [];
    }
    const seen = new Set();
    return rows.filter((row) => {
      const key = `${row.sourceField}:${row.value}`;
      if (!row.value || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 80);
  }

  function summarizeProviderBodyShape(bodyText) {
    const text = String(bodyText || '');
    const empty = {
      jsonParsed: false,
      rootKind: '',
      keyNames: [],
      unitLikeFieldNames: [],
      primitiveFieldCount: 0
    };
    if (!text || text.length > 600000) return empty;

    let root;
    try {
      root = JSON.parse(text);
    } catch (_) {
      return empty;
    }

    const keyNames = new Set();
    const unitLikeFieldNames = new Set();
    let primitiveFieldCount = 0;
    let visitedCount = 0;
    const visit = (value, depth) => {
      if (!value || typeof value !== 'object' || depth > 8 || visitedCount >= 3000) return;
      visitedCount += 1;
      const entries = Array.isArray(value)
        ? value.slice(0, 200).map((item, index) => [String(index), item])
        : Object.entries(value).slice(0, 200);
      for (const [rawKey, child] of entries) {
        const key = /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(rawKey) ? rawKey : '';
        if (key) keyNames.add(key);
        if (child && typeof child === 'object') {
          visit(child, depth + 1);
          continue;
        }
        primitiveFieldCount += 1;
        if (
          key && (
            /(?:dong|ho|unit|room|addr|building|bldg|flr|floor)/i.test(key) ||
            /\d{1,4}\s*(?:\uB3D9|\uD638)/.test(normalizeText(child))
          )
        ) {
          unitLikeFieldNames.add(key);
        }
      }
    };
    visit(root, 0);
    return {
      jsonParsed: true,
      rootKind: Array.isArray(root) ? 'array' : (root && typeof root === 'object' ? 'object' : 'primitive'),
      keyNames: [...keyNames].sort().slice(0, 120),
      unitLikeFieldNames: [...unitLikeFieldNames].sort().slice(0, 60),
      primitiveFieldCount
    };
  }

  function hoDigitsFromValue(value) {
    const token = extractHoToken(value) || numericHoToken(value);
    const match = String(token || '').match(/\d+/);
    return match && match[0] ? match[0] : '';
  }

  function brokerOfficeHoMentions(text) {
    const raw = String(text || '');
    if (!raw) return [];
    const mentions = [];
    const pattern = new RegExp(`(?<!\\d)(\\d{2,4})\\s*${HO}(?!\\s*(?:${LINE}|${UNIT_LINE}))`, 'g');
    let match;
    while ((match = pattern.exec(raw))) {
      const start = Math.max(0, match.index - 80);
      const end = Math.min(raw.length, match.index + String(match[0] || '').length + 120);
      const window = raw.slice(start, end);
      if (!BROKER_OFFICE_CONTEXT_PATTERN.test(window)) continue;
      mentions.push({
        digits: match[1],
        start: match.index,
        end: match.index + String(match[0] || '').length
      });
    }
    return mentions;
  }

  function brokerOfficeHoDigitSet(bodyText) {
    return new Set(brokerOfficeHoMentions(bodyText).map((mention) => mention.digits).filter(Boolean));
  }

  function redactBrokerOfficeHoMentions(text) {
    const raw = String(text || '');
    const mentions = brokerOfficeHoMentions(raw);
    if (mentions.length < 1) return raw;
    const chars = raw.split('');
    for (const mention of mentions) {
      for (let index = mention.start; index < mention.end; index += 1) chars[index] = ' ';
    }
    return chars.join('');
  }

  function brokerOfficeOnlyHoField(sourceField, value, bodyText) {
    const sourceKey = String(sourceField || '').toLowerCase();
    if (!HO_ONLY_FIELD_SET.has(sourceKey)) return false;
    const decoded = decodeFieldValue(value);
    if (extractDongToken(decoded) || bareNumericPairCandidate(decoded)) return false;
    const digits = hoDigitsFromValue(decoded);
    if (!digits) return false;
    return brokerOfficeHoDigitSet(bodyText).has(digits);
  }

  function normalizeKisoAddressCandidate(value) {
    const decoded = decodeFieldValue(value);
    const exact = decoded.match(/^(\d+(?:-\d+)?)\s+([0-9]{1,4})\s+([A-Za-z]?[0-9]{2,4})\s*(?:\uD638)?$/);
    if (!exact || !exact[2] || !exact[3]) return '';
    return `${canonicalNumber(exact[2])}${DONG} ${String(exact[3]).toUpperCase()}${HO}`;
  }

  function bareNumericPairCandidate(value) {
    const decoded = decodeFieldValue(value).replace(/[(){}\[\]"']/g, ' ');
    const match = decoded.match(/^\s*([0-9]{1,4})\s+([A-Za-z]?[0-9]{2,4})\s*(?:\uD638)?\s*$/);
    if (!match || !match[1] || !match[2]) return '';
    if (/^0[0-9]/.test(match[2])) return '';
    return `${canonicalNumber(match[1])}${DONG} ${String(match[2]).toUpperCase()}${HO}`;
  }

  function normalizedFieldDisplayCandidate(sourceField, value) {
    const field = String(sourceField || '');
    if (field === SERVE_ROW_FIELD) return boundedDisplayCandidate(decodeFieldValue(value));
    if (field.toLowerCase() === 'kiso_address2') {
      const kisoCandidate = normalizeKisoAddressCandidate(value);
      if (kisoCandidate) return kisoCandidate;
    }
    const decoded = decodeFieldValue(value);
    return boundedDisplayCandidate(decoded)
      || bareNumericPairCandidate(decoded)
      || boundedHoOnlyCandidate(decoded);
  }

  function pushCandidate(candidates, sourceField, value, providerFamily, bodyText) {
    if (!SOURCE_FIELDS.has(sourceField)) return;
    if (!sourceFieldAllowedForFamily(sourceField, providerFamily)) return;
    if (shouldIgnoreProviderField(sourceField, value, providerFamily, bodyText)) return;
    if (brokerOfficeOnlyHoField(sourceField, value, bodyText)) return;
    const displayCandidate = normalizedFieldDisplayCandidate(sourceField, value);
    if (!displayCandidate) return;
    const floorHint = sourceField === SERVE_ROW_FIELD
      ? extractFloorHintFromValue(VISIBLE_FLOOR_TEXT_FIELD, value)
      : emptyFloorHint();
    const candidate = {
      providerFamily: String(providerFamily || ''),
      sourceField,
      displayCandidate,
      priority: sourceField === SERVE_ROW_FIELD ? 0 : fieldPriority(sourceField),
      floorHint,
      contextText: sourceField === SERVE_ROW_FIELD ? normalizeText(value).slice(0, 260) : '',
      candidateTypeToken: sourceField === SERVE_ROW_FIELD ? typeTokenFromText(value) : ''
    };
    const sourceKey = String(sourceField || '').toLowerCase();
    const hasDongHoDisplay = Boolean(extractDongToken(displayCandidate) && extractHoToken(displayCandidate));
    if (String(providerFamily || '') === 'serve' && (sourceField === SERVE_ROW_FIELD || (hasDongHoDisplay && FIELD_SET.has(sourceKey)))) {
      candidate.providerCpid = 'serve';
    }
    candidates.push(candidate);
  }

  function pushSplitPart(splitParts, sourceField, value, providerFamily, bodyText) {
    if (!FIELD_SET.has(String(sourceField || '').toLowerCase())) return;
    if (shouldIgnoreProviderField(sourceField, value, providerFamily, bodyText)) return;
    const decoded = decodeFieldValue(value);
    const sourceKey = String(sourceField || '').toLowerCase();
    const dongToken = DONG_ONLY_FIELD_SET.has(sourceKey)
      ? (extractDongToken(decoded) || numericDongToken(decoded))
      : extractDongToken(decoded);
    const hoToken = HO_ONLY_FIELD_SET.has(sourceKey)
      ? (extractHoToken(decoded) || numericHoToken(decoded))
      : extractHoToken(decoded);
    if (dongToken) splitParts.push({ sourceField, token: dongToken, tokenKind: 'dong' });
    if (hoToken) splitParts.push({ sourceField, token: hoToken, tokenKind: 'ho' });
  }

  function collectFieldValues(fieldValues, candidates, splitParts, providerFamily, bodyText) {
    for (const item of Array.isArray(fieldValues) ? fieldValues : []) {
      const sourceField = String((item && item.sourceField) || '');
      const sourceKey = sourceField.toLowerCase();
      if (!FIELD_SET.has(sourceKey) && !SOURCE_FIELDS.has(sourceField)) continue;
      if (!sourceFieldAllowedForFamily(sourceField, providerFamily)) continue;
      if (shouldIgnoreProviderField(sourceField, item.value, providerFamily, bodyText)) continue;
      if (brokerOfficeOnlyHoField(sourceField, item.value, bodyText)) continue;
      pushCandidate(candidates, sourceField, item.value, providerFamily, bodyText);
      if (FIELD_SET.has(sourceKey)) pushSplitPart(splitParts, sourceField, item.value, providerFamily, bodyText);
    }
  }

  function collectFloorHints(fieldValues, bodyText, listingContext) {
    const hints = [];
    const rows = Array.isArray(fieldValues) ? fieldValues : [];
    const fieldValueByName = (name) => {
      const match = rows.find((item) => String((item && item.sourceField) || '').toLowerCase() === name);
      return match ? match.value : '';
    };
    for (const item of Array.isArray(fieldValues) ? fieldValues : []) {
      const sourceField = String((item && item.sourceField) || '');
      const sourceKey = sourceField.toLowerCase();
      if (!FLOOR_FIELD_SET.has(sourceKey) || FLOOR_TOTAL_FIELD_SET.has(sourceKey)) continue;
      const pairedTotalFloor = sourceKey === 'floor_cnt'
        ? fieldValueByName('floor_cnt_total')
        : sourceKey === 'floorcnt'
          ? fieldValueByName('floorcnttotal')
          : ['frlfloor', 'roomfloor', 'unitfloor', 'floor1', 'floor2', 'floorname', 'floortype'].includes(sourceKey)
            ? fieldValueByName('buildinghighestfloor')
          : 0;
      const hint = extractFloorHintFromValue(sourceField, item.value, pairedTotalFloor);
      if (hint.floorHintPresent) hints.push(hint);
    }
    const hasScopedContext = hasFloorListingContext(listingContext);
    const scopedTextHint = scopedFloorHintFromBodyText(bodyText || '', listingContext);
    if (scopedTextHint.floorHintPresent) hints.push(scopedTextHint);
    if (!hasScopedContext) {
      const textHint = extractFloorHintFromValue(VISIBLE_FLOOR_TEXT_FIELD, bodyText || '');
      if (textHint.floorHintPresent) hints.push(textHint);
    }
    return hints[0] || emptyFloorHint();
  }

  function collectFromStructuredText(text, candidates, splitParts, providerFamily) {
    const content = String(text || '');
    for (const field of FIELD_NAMES) {
      const pattern = new RegExp(`(?<![A-Za-z0-9_])["']?${field}["']?\\s*[:=]\\s*["']([^"']{1,80})["']`, 'gi');
      let match;
      while ((match = pattern.exec(content))) {
        if (shouldIgnoreProviderField(field, match[1] || '', providerFamily, content)) continue;
        if (brokerOfficeOnlyHoField(field, match[1] || '', content)) continue;
        pushCandidate(candidates, field, match[1] || '', providerFamily, content);
        pushSplitPart(splitParts, field, match[1] || '', providerFamily, content);
      }
    }
  }

  function addSplitFieldCandidate(candidates, splitParts, providerFamily, bodyText) {
    const dongParts = splitParts.filter((part) => part.tokenKind === 'dong');
    const hoParts = splitParts.filter((part) => part.tokenKind === 'ho');
    const dongTokens = Array.from(new Set(dongParts.map((part) => part.token)));
    const hoTokens = Array.from(new Set(hoParts.map((part) => part.token)));
    if (dongTokens.length !== 1 || hoTokens.length !== 1) return;

    const hoSource = hoParts.find((part) => FIELD_SET.has(String(part.sourceField || '').toLowerCase()));
    const sourceField = hoSource ? hoSource.sourceField : (dongParts[0] && dongParts[0].sourceField);
    pushCandidate(candidates, sourceField, `${dongTokens[0]} ${hoTokens[0]}`, providerFamily, bodyText);
  }

  function candidateTypeMatchesContext(candidate, listingContext) {
    const sourceField = String(candidate && candidate.sourceField || '');
    if (sourceField !== SERVE_ROW_FIELD) return true;
    if (isTrustedDirectCpidCandidate(candidate, candidate && candidate.providerFamily)) return true;
    if (!candidate.candidateTypeToken) return true;
    const typeNeedle = listingTypeToken(listingContext);
    if (!typeNeedle) return true;
    return comparableToken(candidate.contextText || '').includes(typeNeedle);
  }

  function contextMatchingCandidate(candidates, listingContext) {
    const context = listingContext && typeof listingContext === 'object' ? listingContext : {};
    if (!hasFloorListingContext(context)) return null;
    const ranked = candidates
      .map((candidate, index) => ({
        ...candidate,
        kind: candidateKind(candidate.displayCandidate),
        index
      }))
      .filter((candidate) => candidate.kind !== 'none')
      .sort((a, b) => {
        const kindRank = (candidate) => candidate.kind === 'dong-ho' ? 0 : 1;
        return kindRank(a) - kindRank(b) || a.priority - b.priority || a.index - b.index;
      });
    const accepted = ranked.filter((candidate) => {
      if (!candidateTypeMatchesContext(candidate, context)) return false;
      const hint = sanitizeFloorHint(candidate.floorHint);
      const match = candidateMatchesListingContext({
        displayCandidate: candidate.displayCandidate,
        candidateKind: candidate.kind,
        sourceField: candidate.sourceField,
        providerFamily: String(candidate.providerFamily || ''),
        providerCpid: candidate.providerCpid || '',
        providerSourceLabel: candidate.providerSourceLabel || '',
        certainty: candidate.certainty || '',
        candidateTypeToken: candidate.candidateTypeToken || '',
        floorHintValue: hint.floorHintPresent ? Number(hint.floorHintValue || 0) : 0
      }, context);
      return Boolean(match.matches);
    });
    const seen = new Set();
    const unique = [];
    for (const candidate of accepted) {
      const key = normalizeText(candidate.displayCandidate || '');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(candidate);
    }
    return unique.length === 1 ? unique[0] : null;
  }

  function bestCandidate(candidates, listingContext) {
    const contextSelected = contextMatchingCandidate(candidates, listingContext);
    if (contextSelected) return contextSelected;
    if (hasFloorListingContext(listingContext) && candidates.some((candidate) => candidate.sourceField === SERVE_ROW_FIELD)) {
      return null;
    }
    return candidates
      .map((candidate, index) => ({
        ...candidate,
        kind: candidateKind(candidate.displayCandidate),
        index
      }))
      .filter((candidate) => candidate.kind !== 'none')
      .sort((a, b) => {
        const kindRank = (candidate) => candidate.kind === 'dong-ho' ? 0 : 1;
        return kindRank(a) - kindRank(b) || a.priority - b.priority || a.index - b.index;
      })[0];
  }

  function splitTokenSets(splitParts) {
    return {
      dongTokens: Array.from(new Set(splitParts.filter((part) => part.tokenKind === 'dong').map((part) => part.token))),
      hoTokens: Array.from(new Set(splitParts.filter((part) => part.tokenKind === 'ho').map((part) => part.token)))
    };
  }

  function lineCandidateDisplays(listingContext) {
    const context = listingContext && typeof listingContext === 'object' ? listingContext : {};
    return (Array.isArray(context.lineCandidateDisplays) ? context.lineCandidateDisplays : [])
      .map((item) => normalizeText(item))
      .filter((item) => /^\d{1,4}\s*\uB3D9\s+\d{2,4}\s*\uD638$/.test(item))
      .slice(0, 80);
  }

  function candidateHoDigits(displayCandidate) {
    const hoToken = extractHoToken(displayCandidate);
    const match = hoToken.match(/\d+/);
    return match && match[0] ? match[0] : '';
  }

  function numericBoundaryHitCount(text, digits) {
    if (!digits || !text) return 0;
    const escaped = digits.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?<!\\d)${escaped}(?!\\d)`, 'g');
    return Array.from(String(text || '').matchAll(pattern)).length;
  }

  function providerDeepScanCandidate(bodyText, fieldValues, listingContext) {
    const displays = lineCandidateDisplays(listingContext);
    if (displays.length < 1) return null;
    const fieldText = (Array.isArray(fieldValues) ? fieldValues : [])
      .filter((item) => !brokerOfficeOnlyHoField(item && item.sourceField, item && item.value, bodyText))
      .map((item) => redactBrokerOfficeHoMentions(normalizeText(item && item.value)))
      .filter(Boolean)
      .join(' ');
    const haystack = [redactBrokerOfficeHoMentions(bodyText), fieldText].filter(Boolean).join(' ');
    if (!haystack) return null;

    const hits = displays
      .map((displayCandidate) => ({
        displayCandidate,
        hitCount: numericBoundaryHitCount(haystack, candidateHoDigits(displayCandidate))
      }))
      .filter((item) => item.hitCount > 0);
    if (hits.length !== 1 || hits[0].hitCount !== 1) return null;
    return hits[0].displayCandidate;
  }

  function hasDongHoCandidate(candidates) {
    return candidates.some((candidate) => candidateKind(candidate.displayCandidate) === 'dong-ho');
  }

  function buildProviderCandidateObservation(input) {
    const providerFamily = input && input.providerFamily ? String(input.providerFamily) : '';
    if (!PROVIDER_FAMILIES.has(providerFamily)) return emptyResult('');

    const candidates = [];
    const splitParts = [];
    const fieldValues = input && input.fieldValues;
    const bodyText = (input && input.bodyText) || '';
    const effectiveFieldValues = providerFamily === 'serve'
      ? collectServeRowFieldValuesFromBodyText(bodyText).concat(Array.isArray(fieldValues) ? fieldValues : [])
      : fieldValues;
    const floorHint = collectFloorHints(effectiveFieldValues, bodyText, input && input.listingContext);
    collectFieldValues(effectiveFieldValues, candidates, splitParts, providerFamily, bodyText);
    collectFromStructuredText(bodyText, candidates, splitParts, providerFamily);
    addSplitFieldCandidate(candidates, splitParts, providerFamily, bodyText);
    const splitTokens = splitTokenSets(splitParts);
    if (splitTokens.dongTokens.length === 1 && splitTokens.hoTokens.length > 1 && !hasDongHoCandidate(candidates)) {
      return emptyResult(providerFamily, floorHint);
    }
    if (providerFamily === 'mk') {
      pushCandidate(candidates, MK_VISIBLE_TEXT_FIELD, extractMkVisibleCandidate(bodyText));
    }
    const deepScanDisplay = providerDeepScanCandidate(bodyText, effectiveFieldValues, input && input.listingContext);
    if (deepScanDisplay) {
      pushCandidate(candidates, PROVIDER_DEEP_SCAN_FIELD, deepScanDisplay, providerFamily);
    }

    const selected = bestCandidate(candidates, input && input.listingContext);
    if (!selected) return emptyResult(providerFamily, floorHint);
    const selectedFloorHint = sanitizeFloorHint(selected.floorHint);

    const result = {
      present: true,
      providerFamily,
      sourceField: selected.sourceField,
      candidateKind: selected.kind,
      redactedCandidate: `candidate:${hashMarker(selected.displayCandidate)}`,
      displayCandidate: selected.displayCandidate
    };
    if (selected.providerCpid) result.providerCpid = selected.providerCpid;
    if (selected.candidateTypeToken) result.candidateTypeToken = selected.candidateTypeToken;
    return withFloorHint(result, selectedFloorHint.floorHintPresent ? selectedFloorHint : floorHint);
  }

  function sanitizeProviderCandidate(input) {
    const candidate = input && typeof input === 'object' ? input : {};
    const providerFamily = String(candidate.providerFamily || '');
    const sourceField = String(candidate.sourceField || '');
    const kind = String(candidate.candidateKind || '');
    const redactedCandidate = String(candidate.redactedCandidate || '');
    const displayCandidate = normalizeText(candidate.displayCandidate || '');
    const candidateTypeToken = typeTokenFromText(candidate.candidateTypeToken || '');
    const floorHint = sanitizeFloorHint(candidate);
    const metadata = directSourceMetadata(candidate, providerFamily);

    if (!PROVIDER_FAMILIES.has(providerFamily)) return emptyResult('');
    if (!candidate.present) return Object.assign(emptyResult(providerFamily, floorHint), metadata);
    if (!sourceFieldAllowedForFamily(sourceField, providerFamily)) return Object.assign(emptyResult(providerFamily, floorHint), metadata);
    if (!SOURCE_FIELDS.has(sourceField)) return Object.assign(emptyResult(providerFamily, floorHint), metadata);
    if (!CANDIDATE_KINDS.has(kind)) return Object.assign(emptyResult(providerFamily, floorHint), metadata);
    if (!/^candidate:[a-f0-9]{8}$/.test(redactedCandidate)) return Object.assign(emptyResult(providerFamily, floorHint), metadata);
    const dongHoPattern = new RegExp(`^\\d{1,4}\\s*${DONG}\\s+\\d{1,4}\\s*${HO}$`);
    const hoOnlyPattern = new RegExp(`^\\d{2,4}\\s*${HO}$`);
    if (
      (kind === 'dong-ho' && !dongHoPattern.test(displayCandidate)) ||
      (kind === 'ho-only' && !hoOnlyPattern.test(displayCandidate))
    ) {
      return Object.assign(emptyResult(providerFamily, floorHint), metadata);
    }

    const result = {
      present: true,
      providerFamily,
      sourceField,
      candidateKind: kind,
      redactedCandidate,
      displayCandidate
    };
    if (candidateTypeToken) result.candidateTypeToken = candidateTypeToken;
    return Object.assign(withFloorHint(result, floorHint), metadata);
  }

  function candidateDisplay(input) {
    if (typeof input === 'string') return normalizeText(input);
    const candidate = input && typeof input === 'object' ? input : {};
    return normalizeText(candidate.displayCandidate || candidate.display || '');
  }

  function candidateMatchesListingContext(input, context) {
    const candidateInput = input && typeof input === 'object' ? input : {};
    if (candidateInput.estimated) {
      return { matches: false, reason: 'estimated-candidate' };
    }
    if (Number(candidateInput.candidateCount || 0) > 1) {
      return { matches: false, reason: 'ambiguous-candidate' };
    }
    const displayCandidate = candidateDisplay(input);
    const candidateDongToken = extractDongToken(displayCandidate);
    const candidateHoToken = extractHoToken(displayCandidate);
    const listingContext = context && typeof context === 'object' ? context : {};
    const detailDongToken = extractDongToken(listingContext.detailDongToken || listingContext.detailText || '');
    const candidateTypeNeedle = typeTokenFromText(candidateInput.candidateTypeToken || '');
    const listingTypeNeedles = listingTypeTokens(listingContext);

    if (!candidateDongToken || !candidateHoToken) {
      return { matches: false, reason: 'invalid-candidate' };
    }
    if (
      candidateTypeNeedle &&
      listingTypeNeedles.length > 0 &&
      !listingTypeNeedles.some((typeNeedle) => typeNeedlesCompatible(candidateTypeNeedle, typeNeedle))
    ) {
      return { matches: false, reason: 'type-mismatch' };
    }
    if (!detailDongToken) {
      return { matches: false, reason: 'missing-context' };
    }
    if (candidateDongToken !== detailDongToken) {
      return { matches: false, reason: 'dong-mismatch' };
    }
    const providerFloorHintValue = Number(candidateInput.floorHintValue || 0);
    const useProviderFloorAsCandidateFloor = String(candidateInput.sourceField || '') === SERVE_ROW_FIELD && providerFloorHintValue > 0;
    const candidateFloorValue = useProviderFloorAsCandidateFloor
      ? providerFloorHintValue
      : floorValueFromHo(candidateHoToken);
    const kind = String(candidateInput.candidateKind || '');
    const floorKind = String(listingContext.detailFloorKind || listingContext.floorKind || (Number(listingContext.detailFloorValue || listingContext.floorValue || 0) > 0 ? 'exact' : ''));
    if (!candidateFloorValue) {
      if (floorKind === 'band' && isTrustedDirectCpidCandidate(candidateInput, candidateInput.providerFamily)) {
        return { matches: true, reason: 'direct-cpid-unit-context' };
      }
      return { matches: false, reason: 'floor-unknown' };
    }
    if (providerFloorHintValue > 0 && candidateFloorValue !== providerFloorHintValue) {
      return { matches: false, reason: 'provider-floor-mismatch' };
    }
    if (
      requiresExactFloorProviderContext(candidateInput) &&
      floorKind === 'band' &&
      !(providerFloorHintValue > 0)
    ) {
      return { matches: false, reason: 'provider-exact-floor-required' };
    }
    if (
      kind === 'ho-only' &&
      floorKind === 'band' &&
      !(providerFloorHintValue > 0) &&
      !allowsHoOnlyBandContext(candidateInput)
    ) {
      return { matches: false, reason: 'ho-only-band-context' };
    }
    const floorMatch = floorMatchesListingContext(candidateFloorValue, listingContext);
    if (!floorMatch.matches && candidateFloorExceedsListingTotal(candidateFloorValue, listingContext)) {
      return { matches: false, reason: 'floor-total-mismatch' };
    }
    if (
      !floorMatch.matches &&
      floorMatch.reason === 'floor-band-mismatch' &&
      floorKind === 'band' &&
      isTrustedDirectCpidCandidate(candidateInput, candidateInput.providerFamily) &&
      floorSoftMatchesListingBand(candidateFloorValue, listingContext)
    ) {
      return { matches: true, reason: 'context-match' };
    }
    return floorMatch;
  }

  function hydrateCandidateDisplayForContext(candidate, context) {
    const candidateInput = candidate && typeof candidate === 'object' ? candidate : {};
    const display = candidateDisplay(candidateInput);
    if (extractDongToken(display) || candidateInput.candidateKind !== 'ho-only') return display;
    const hoToken = extractHoToken(display);
    const listingContext = context && typeof context === 'object' ? context : {};
    const dongToken = extractDongToken(listingContext.detailDongToken || listingContext.detailText || '');
    return hoToken && dongToken ? `${dongToken} ${hoToken}` : display;
  }

  function normalizeProviderCandidateForContext(input, context) {
    const candidate = sanitizeProviderCandidate(input);
    const providerFamily = String(candidate.providerFamily || '');
    const sourceField = String(candidate.sourceField || '');
    const kind = String(candidate.candidateKind || '');
    const marker = String(candidate.redactedCandidate || '');
    const display = hydrateCandidateDisplayForContext(candidate, context);
    const metadata = directSourceMetadata(candidate, providerFamily);

    if (!candidate.present || !providerFamily) return null;
    if (!CANDIDATE_KINDS.has(kind)) return null;
    if (!/^candidate:[a-f0-9]{8}$/.test(marker)) return null;
    if (!display || !extractDongToken(display) || !extractHoToken(display)) {
      return Object.assign({
        providerFamily,
        sourceField,
        kind,
        marker,
        display,
        accepted: false,
        reason: 'invalid-candidate'
      }, metadata);
    }

    const match = candidateMatchesListingContext({
      displayCandidate: display,
      candidateKind: kind,
      sourceField,
      providerFamily,
      providerCpid: candidate.providerCpid || '',
      providerSourceLabel: candidate.providerSourceLabel || '',
      certainty: candidate.certainty || '',
      candidateTypeToken: candidate.candidateTypeToken || '',
      floorHintValue: candidate.floorHintPresent ? Number(candidate.floorHintValue || 0) : 0
    }, context);

    return Object.assign({
      providerFamily,
      sourceField,
      kind,
      marker,
      display,
      accepted: Boolean(match.matches),
      reason: match.matches ? 'context-match' : (match.reason || 'context-mismatch')
    }, metadata);
  }

  function uniqueAcceptedCandidates(results) {
    const seen = new Set();
    const unique = [];
    results.filter((result) => result && result.accepted).forEach((result) => {
      const key = `${result.marker}|${normalizeText(result.display)}`;
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(result);
    });
    return unique;
  }

  function providerRankedDiagnostics(results) {
    const ranked = (Array.isArray(results) ? results : [])
      .slice(0, 8)
      .map((result) => ({
        providerFamily: result.providerFamily || '',
        sourceField: result.sourceField || '',
        kind: result.kind || '',
        marker: result.marker || '',
        providerSourceLabel: result.providerSourceLabel || '',
        providerCpid: result.providerCpid || '',
        certainty: result.certainty || '',
        rank: Number(result.rank || 0) || 0
      }));
    const counts = new Map();
    for (const candidate of ranked) {
      const key = [candidate.providerFamily || 'provider', candidate.sourceField || 'field'].join(':');
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const rankedSummary = Array.from(counts.entries())
      .map(([key, count]) => `${key}:${count}`)
      .join('/');
    return { rankedCandidates: ranked, rankedSummary };
  }

  function acceptedCandidateEvidenceRank(candidate) {
    const sourceField = String(candidate && candidate.sourceField || '');
    const sourceKey = sourceField.toLowerCase();
    const certainty = String(candidate && candidate.certainty || '');
    if (certainty === 'CERTAIN_CPID') return 500 + (Number(candidate.rank || 0) || 0);
    if (EXPLICIT_HO_FIELD_SET.has(sourceKey)) return 430;
    if (sourceKey === 'dongho' || sourceKey === 'detailaddress' || sourceKey === 'dtl_addr' || sourceKey === 'detail_addr') return 410;
    if (FIELD_SET.has(sourceKey)) return 370;
    if (sourceField === PROVIDER_DEEP_SCAN_FIELD) return 330;
    if (sourceField === MK_VISIBLE_TEXT_FIELD) return 100;
    return 0;
  }

  function preferredAcceptedCandidate(accepted) {
    const ranked = (Array.isArray(accepted) ? accepted : [])
      .map((candidate, index) => ({
        candidate,
        rank: acceptedCandidateEvidenceRank(candidate),
        index
      }))
      .sort((left, right) => (
        Number(right.rank || 0) - Number(left.rank || 0) ||
        Number(right.candidate && right.candidate.rank || 0) - Number(left.candidate && left.candidate.rank || 0) ||
        left.index - right.index
      ));
    const winner = ranked[0];
    const runnerUp = ranked[1];
    if (!winner || !(Number(winner.rank || 0) > 0)) return null;
    if (Number(winner.rank || 0) < 400) return null;
    if (runnerUp && Number(winner.rank || 0) <= Number(runnerUp.rank || 0)) return null;
    return winner.candidate;
  }

  function selectProviderCandidateForListingContext(inputCandidates, context) {
    const list = Array.isArray(inputCandidates)
      ? inputCandidates
      : (inputCandidates ? [inputCandidates] : []);
    const results = list
      .map((candidate) => normalizeProviderCandidateForContext(candidate, context))
      .filter(Boolean);

    if (results.length < 1) {
      return {
        present: false,
        accepted: false,
        reason: 'no-candidate',
        candidateCount: 0,
        rejectedCount: 0
      };
    }

    const accepted = uniqueAcceptedCandidates(results);
    if (accepted.length === 1) {
      return Object.assign({
        present: true,
        accepted: true,
        candidateCount: 1,
        rejectedCount: results.filter((result) => !result.accepted).length
      }, accepted[0]);
    }
    if (accepted.length > 1) {
      const preferred = preferredAcceptedCandidate(accepted);
      if (preferred) {
        return Object.assign({
          present: true,
          accepted: true,
          candidateCount: 1,
          rejectedCount: results.length - 1
        }, preferred);
      }
      return Object.assign({
        present: false,
        accepted: false,
        reason: 'ambiguous-candidate',
        candidateCount: accepted.length,
        rejectedCount: results.length - accepted.length
      }, providerRankedDiagnostics(accepted));
    }

    if (results.length > 1) {
      return Object.assign({
        present: false,
        accepted: false,
        reason: 'ambiguous-candidate',
        candidateCount: results.length,
        rejectedCount: results.length
      }, providerRankedDiagnostics(results));
    }

    const rejected = results.find((result) => result && !result.accepted) || results[0];
    return Object.assign({
      present: false,
      accepted: false,
      candidateCount: 0,
      rejectedCount: results.length
    }, rejected);
  }

  const api = {
    FIELD_NAMES,
    FLOOR_FIELD_NAMES,
    buildProviderCandidateObservation,
    summarizeProviderBodyShape,
    sanitizeProviderCandidate,
    extractDongToken,
    extractHoToken,
    extractFloorHintFromValue,
    candidateMatchesListingContext,
    selectProviderCandidateForListingContext
  };

  globalScope.DHS_PROVIDER_CANDIDATE = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
