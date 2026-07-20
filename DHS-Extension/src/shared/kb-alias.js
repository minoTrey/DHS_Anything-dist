(function exposeKbAlias(globalScope) {
  const NAVER_HOSTS = new Set(['new.land.naver.com', 'fin.land.naver.com']);
  const DIRECT_KB_COMPLEX_ALIASES = Object.freeze({
    122024: { kbComplexNo: '42011' },
    122025: { kbComplexNo: '42012' },
    125022: { kbComplexNo: '42010' },
    125346: { kbComplexNo: '45303' },
    125345: { kbComplexNo: '45302' },
    110630: { kbComplexNo: '39528' },
    115551: { kbComplexNo: '35059' },
    125937: { kbComplexNo: '45356' },
    125943: { kbComplexNo: '49504' },
    136748: { kbComplexNo: '321183' }
  });

  const DIRECT_KB_ALIAS_COUNT = Object.keys(DIRECT_KB_COMPLEX_ALIASES).length;

  function hashMarker(value) {
    const input = String(value || '');
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return `kb:${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }

  function normalizeComplexNo(value) {
    return String(value || '').replace(/[^0-9]/g, '');
  }

  function extractNaverComplexNoFromUrl(input) {
    try {
      const parsed = new URL(String(input || ''), 'https://new.land.naver.com');
      if (!NAVER_HOSTS.has(parsed.hostname.toLowerCase())) return '';
      const pathMatch = parsed.pathname.match(/^\/complexes\/(\d+)(?:\/|$)/);
      if (pathMatch) return normalizeComplexNo(pathMatch[1]);
      return normalizeComplexNo(parsed.searchParams.get('hscpNo'));
    } catch (_) {
      return '';
    }
  }

  function hasKbComplexAlias(value) {
    const complexNo = normalizeComplexNo(value);
    return Boolean(complexNo && DIRECT_KB_COMPLEX_ALIASES[complexNo]);
  }

  function emptyEvidence() {
    return {
      present: false,
      kind: 'none',
      source: 'none',
      aliasMarker: ''
    };
  }

  function kbAliasEvidenceFromUrl(input) {
    const naverComplexNo = extractNaverComplexNoFromUrl(input);
    const alias = naverComplexNo ? DIRECT_KB_COMPLEX_ALIASES[naverComplexNo] : null;
    if (!alias) return emptyEvidence();
    return {
      present: true,
      kind: 'direct-hscp-alias',
      source: 'naver-complex-url',
      aliasMarker: hashMarker(`${naverComplexNo}:${alias.kbComplexNo}`)
    };
  }

  const api = {
    DIRECT_KB_ALIAS_COUNT,
    extractNaverComplexNoFromUrl,
    hasKbComplexAlias,
    kbAliasEvidenceFromUrl
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }

  globalScope.DHS_KB_ALIAS = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
