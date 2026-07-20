(function exposeCpInventory(globalScope) {
  const DOMAIN_PROVIDER_CANDIDATES = Object.freeze([
    { family: 'mk', label: 'MK \uBD80\uB3D9\uC0B0', domains: ['land.mk.co.kr', 'm.land.mk.co.kr', 'landad.mk.co.kr'] },
    { family: 'r114', label: 'R114', domains: ['r114.com'] },
    { family: 'gongsilclub', label: 'Gongsil Club', domains: ['n.gongsilclub.com', 'm.gongsilclub.com'] },
    { family: 'homesdid', label: 'Homes DID', domains: ['homesdid.co.kr', 'm.homesdid.co.kr'] },
    { family: 'serve', label: '\uBD80\uB3D9\uC0B0\uC368\uBE0C', domains: ['serve.co.kr'] },
    { family: 'rfine', label: 'R-FINE', domains: ['rfine.kr'] },
    { family: 'rter', label: 'Rter/Rego', domains: ['rter2.com', 'rego.kr', 'm.rego.kr'] },
    { family: 'asil', label: '\uC544\uC2E4', domains: ['asil.kr'] },
    { family: 'hankyung', label: '\uD55C\uACBD\uBD80\uB3D9\uC0B0', domains: ['realestate.hankyung.com', 'maemul.hankyung.com', 'land.hankyung.com', 'hankyung.com', 'www.hankyung.com'] },
    { family: 'daara', label: '\uB2E4\uC544\uB77C/\uC0B0\uC5C5\uBD80\uB3D9\uC0B0', domains: ['land.daara.co.kr', 'm.land.daara.co.kr', 'industryland.co.kr', 'www.industryland.co.kr'] },
    { family: 'neonet', label: 'Neonet', domains: ['neonet.co.kr', 'www.neonet.co.kr', 'm.neonet.co.kr'] },
    { family: 'ten', label: 'TEN', domains: ['ten.co.kr'] },
    { family: 'kar', label: 'KAR \uD55C\uBC29', domains: ['karhanbang.com', 'www.karhanbang.com'] },
    { family: 'thebiz', label: 'TheBiz', domains: ['thebiz.co.kr', 'www.thebiz.co.kr', 'thebiz.kr', 'www.thebiz.kr'] },
    { family: 'woori', label: 'Woori House', domains: ['woori-house.co.kr'] },
    { family: 'kiso', label: 'KISO Land Center', domains: ['landcenter.kiso.or.kr'] }
  ]);

  const DIRECT_CPID_CANDIDATES = Object.freeze([
    'fine',
    'rter',
    'serve',
    'ten',
    'rets',
    'asil',
    'bizmk',
    'neonet',
    'hkdotcom',
    'kar',
    'thebiz',
    'industry',
    'woori'
  ]);

  const DIRECT_CPID_FAMILY_MAP = Object.freeze({
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

  const IMPLEMENTED_PROVIDER_CAPTURES = Object.freeze(DOMAIN_PROVIDER_CANDIDATES.map((item) => item.family));
  const BACKGROUND_DIRECT_FAMILIES = Object.freeze(DOMAIN_PROVIDER_CANDIDATES.map((item) => item.family));
  const NAVER_CACHE_CATEGORIES = new Set(['landprice', 'prices', 'buildingUnits', 'pyeongtype']);
  const KB_ALIAS_CATEGORIES = new Set(['kbAlias']);
  const KNOWN_DOMAIN_FAMILIES = new Set(DOMAIN_PROVIDER_CANDIDATES.map((item) => item.family));
  const DIRECT_CPID_COVERED_CANDIDATES = Object.freeze(DIRECT_CPID_CANDIDATES.filter((cpid) => DIRECT_CPID_FAMILY_MAP[cpid]));
  const DIRECT_CPID_UNMAPPED_CANDIDATES = Object.freeze(DIRECT_CPID_CANDIDATES.filter((cpid) => !DIRECT_CPID_FAMILY_MAP[cpid]));

  function uniqueKnownFamilies(values) {
    return Array.from(new Set((values || [])
      .map((value) => String(value || '').trim())
      .filter((value) => KNOWN_DOMAIN_FAMILIES.has(value))))
      .sort();
  }

  function readinessFromBoolean(value) {
    return value ? 'seen' : 'none';
  }

  function kbAliasReadiness(state, lastEvidenceCategory) {
    const explicit = String(state.kbAliasReadiness || 'none');
    if (explicit && explicit !== 'none') return 'wired';
    return (Boolean(state.kbAliasEvidenceSeen) || KB_ALIAS_CATEGORIES.has(lastEvidenceCategory))
      ? 'wired'
      : 'not-wired';
  }

  function buildBranchReadiness(input) {
    const state = input || {};
    const officialCells = Number(state.officialCandidateCells) || 0;
    const lastEvidenceCategory = String(state.lastEvidenceCategory || 'none');
    const naverCacheSeen = Boolean(state.naverCacheEvidenceSeen) || NAVER_CACHE_CATEGORIES.has(lastEvidenceCategory);
    const complexListSeen = Boolean(state.complexListEvidenceSeen) || lastEvidenceCategory === 'complexList';
    const complexCacheSeen = Boolean(state.complexCacheEvidenceSeen) || lastEvidenceCategory === 'complexCache';

    return {
      sameCard: Number(state.dongHoShownCount) > 0 ? 'visible-ho' : 'none',
      officialTable: officialCells === 1
        ? 'single-candidate'
        : (officialCells > 1 ? 'multi-candidate' : (state.officialRowsPresent ? 'no-candidate' : 'none')),
      cpidProvider: state.providerCandidatePresent
        ? 'candidate-captured'
        : (state.cpParserReadiness && state.cpParserReadiness !== 'none'
          ? String(state.cpParserReadiness)
          : (state.cpProviderEvidenceSeen || lastEvidenceCategory === 'cpProvider' ? 'needs-provider-parser' : 'none')),
      sameAddressGroup: readinessFromBoolean(Boolean(state.sameAddressEvidenceSeen) || lastEvidenceCategory === 'sameAddress'),
      representativeArticle: readinessFromBoolean(Boolean(state.representativeEvidenceSeen) || lastEvidenceCategory === 'representativeArticles'),
      naverCache: readinessFromBoolean(naverCacheSeen),
      complexCacheList: complexListSeen || complexCacheSeen ? 'seen' : 'not-wired',
      kbAlias: kbAliasReadiness(state, lastEvidenceCategory)
    };
  }

  function buildBranchSummary(branches) {
    const branch = branches || {};
    return [
      `same-card:${branch.sameCard || 'none'}`,
      `official:${branch.officialTable || 'none'}`,
      `cpid:${branch.cpidProvider || 'none'}`,
      `sameAddress:${branch.sameAddressGroup || 'none'}`,
      `representative:${branch.representativeArticle || 'none'}`,
      `naver-cache:${branch.naverCache || 'none'}`,
      `complex-cache:${branch.complexCacheList || 'not-wired'}`,
      `KB:${branch.kbAlias || 'not-wired'}`
    ].join(' / ');
  }

  function buildCpInventory(input) {
    const state = input || {};
    const observedFamilies = uniqueKnownFamilies([]
      .concat(state.cpProviderFamilies || [])
      .concat(state.lastEvidenceProviderFamily ? [state.lastEvidenceProviderFamily] : []));
    const implementedSet = new Set(IMPLEMENTED_PROVIDER_CAPTURES);
    const backgroundDirectSet = new Set(BACKGROUND_DIRECT_FAMILIES);
    const observedImplementedFamilies = observedFamilies.filter((family) => implementedSet.has(family));
    const observedMissingCaptureFamilies = observedFamilies.filter((family) => !implementedSet.has(family));
    const observedBackgroundDirectFamilies = observedFamilies.filter((family) => backgroundDirectSet.has(family));
    const observedNonDirectFamilies = observedFamilies.filter((family) => !backgroundDirectSet.has(family));
    const branchReadiness = buildBranchReadiness(state);

    return {
      domainCandidateCount: DOMAIN_PROVIDER_CANDIDATES.length,
      directCpidCandidateCount: DIRECT_CPID_CANDIDATES.length,
      directCpidCoveredCount: DIRECT_CPID_COVERED_CANDIDATES.length,
      directCpidUnmappedCount: DIRECT_CPID_UNMAPPED_CANDIDATES.length,
      directCpidUnmappedCandidates: DIRECT_CPID_UNMAPPED_CANDIDATES,
      implementedCaptureCount: IMPLEMENTED_PROVIDER_CAPTURES.length,
      backgroundDirectCount: BACKGROUND_DIRECT_FAMILIES.length,
      backgroundDirectFamilies: BACKGROUND_DIRECT_FAMILIES.slice(),
      observedFamilies,
      observedImplementedFamilies,
      observedMissingCaptureFamilies,
      observedBackgroundDirectFamilies,
      observedNonDirectFamilies,
      branchReadiness,
      readinessSummary: `observed ${observedFamilies.join(',') || '-'} / capture ${IMPLEMENTED_PROVIDER_CAPTURES.length}/${DOMAIN_PROVIDER_CANDIDATES.length} / background-direct ${BACKGROUND_DIRECT_FAMILIES.length}/${DOMAIN_PROVIDER_CANDIDATES.length} / direct cpid ${DIRECT_CPID_CANDIDATES.length} / mapped ${DIRECT_CPID_COVERED_CANDIDATES.length}/${DIRECT_CPID_CANDIDATES.length}`,
      branchSummary: buildBranchSummary(branchReadiness)
    };
  }

  const api = {
    DOMAIN_PROVIDER_CANDIDATES,
    DIRECT_CPID_CANDIDATES,
    DIRECT_CPID_FAMILY_MAP,
    DIRECT_CPID_COVERED_CANDIDATES,
    DIRECT_CPID_UNMAPPED_CANDIDATES,
    IMPLEMENTED_PROVIDER_CAPTURES,
    BACKGROUND_DIRECT_FAMILIES,
    buildCpInventory
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }

  globalScope.DHS_CP_INVENTORY = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
