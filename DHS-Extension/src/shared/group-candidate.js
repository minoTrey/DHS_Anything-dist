(function exposeGroupCandidate(globalScope) {
  const GROUP_CANDIDATE_SOURCES = Object.freeze([
    'dom-same-card',
    'complex-cache-quick',
    'sameAddress',
    'representative-main',
    'representative-main-1',
    'complex-list',
    'complex-cache'
  ]);

  const GROUP_SOURCE_SET = new Set(GROUP_CANDIDATE_SOURCES);
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

  function hashMarker(value) {
    const input = String(value || '');
    let hash = 0x811c9dc5;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function safeArticleMarker(value) {
    const marker = String(value || '');
    return /^article:[a-f0-9]{8,12}$/.test(marker) ? marker : '';
  }

  function typeParts(value) {
    const normalized = normalizeText(value).toUpperCase();
    const match = normalized.match(/(\d{2,3})([A-Z])?/);
    return match ? { base: match[1], suffix: match[2] || '' } : { base: '', suffix: '' };
  }

  function typeTokensMatch(candidateType, contextType) {
    const candidate = typeParts(candidateType);
    const context = typeParts(contextType);
    if (!candidate.base || !context.base) return true;
    if (candidate.base !== context.base) return false;
    if (candidate.suffix && context.suffix && candidate.suffix !== context.suffix) return false;
    return true;
  }

  function contextTypeTokens(context) {
    const input = context && typeof context === 'object' ? context : {};
    const values = [input.detailTypeToken || input.typeToken || '']
      .concat(Array.isArray(input.detailTypeAliases) ? input.detailTypeAliases : []);
    const result = [];
    for (const value of values) {
      const token = normalizeText(value);
      if (token && !result.includes(token)) result.push(token);
    }
    return result.slice(0, 8);
  }

  function typeTokensMatchAny(candidateType, context) {
    if (!candidateType) return true;
    const tokens = contextTypeTokens(context);
    if (tokens.length < 1) return true;
    return tokens.some((token) => typeTokensMatch(candidateType, token));
  }

  function boundedDisplayCandidate(value) {
    const api = providerApi();
    const text = normalizeText(value);
    const dong = api.extractDongToken ? api.extractDongToken(text) : '';
    const ho = api.extractHoToken ? api.extractHoToken(text) : '';
    return dong && ho ? `${dong} ${ho}` : '';
  }

  function sanitizeGroupRow(row) {
    const input = row && typeof row === 'object' ? row : {};
    const source = String(input.source || '');
    if (!GROUP_SOURCE_SET.has(source)) return null;

    const displayCandidate = boundedDisplayCandidate(input.displayCandidate || input.display || '');
    if (!displayCandidate) return null;

    return {
      source,
      articleMarker: safeArticleMarker(input.articleMarker),
      redactedCandidate: `candidate:${hashMarker(displayCandidate)}`,
      displayCandidate,
      typeToken: normalizeText(input.typeToken || ''),
      estimated: Boolean(input.estimated)
    };
  }

  function emptyResult(reason, count) {
    return {
      present: false,
      source: '',
      candidateKind: 'none',
      redactedCandidate: '',
      displayCandidate: '',
      candidateCount: Number(count || 0),
      rankedCandidates: [],
      rankedSummary: '',
      reason: reason || 'no-candidate'
    };
  }

  function uniqueRows(rows) {
    const seen = new Set();
    const result = [];
    for (const row of rows) {
      const key = `${row.source}:${row.redactedCandidate}:${row.typeToken}:${row.articleMarker || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(row);
    }
    return result;
  }

  function sourceRank(source) {
    const index = GROUP_CANDIDATE_SOURCES.indexOf(source);
    return index >= 0 ? index : GROUP_CANDIDATE_SOURCES.length;
  }

  function rankedDiagnostics(rows) {
    const ranked = uniqueRows(rows)
      .slice()
      .sort((left, right) => {
        const sourceDelta = sourceRank(left.source) - sourceRank(right.source);
        if (sourceDelta) return sourceDelta;
        return String(left.redactedCandidate).localeCompare(String(right.redactedCandidate));
      })
      .slice(0, 8)
      .map((row) => ({
        source: row.source,
        redactedCandidate: row.redactedCandidate,
        typeToken: row.typeToken || '',
        estimated: Boolean(row.estimated)
      }));
    const counts = {};
    for (const row of ranked) counts[row.source] = (counts[row.source] || 0) + 1;
    const rankedSummary = GROUP_CANDIDATE_SOURCES
      .filter((source) => counts[source])
      .map((source) => `${source}:${counts[source]}`)
      .join('/');
    return { rankedCandidates: ranked, rankedSummary };
  }

  function selectGroupCandidate(input) {
    const data = input && typeof input === 'object' ? input : {};
    const context = data.context && typeof data.context === 'object' ? data.context : {};
    const api = providerApi();
    const matcher = api.candidateMatchesListingContext;
    if (typeof matcher !== 'function') return emptyResult('missing-validator', 0);

    if (!safeArticleMarker(context.articleMarker)) return emptyResult('missing-context', 0);

    let lastRejectReason = '';
    const matched = [];

    for (const row of (Array.isArray(data.rows) ? data.rows : []).slice(0, 200)) {
      const candidate = sanitizeGroupRow(row);
      if (!candidate) continue;
      if (candidate.estimated) {
        lastRejectReason = 'estimated-candidate';
        continue;
      }
      if (!typeTokensMatchAny(candidate.typeToken, context)) {
        lastRejectReason = 'type-mismatch';
        continue;
      }
      const match = matcher({
        displayCandidate: candidate.displayCandidate
      }, context);
      if (!match.matches) {
        lastRejectReason = match.reason || 'context-mismatch';
        continue;
      }
      matched.push(candidate);
    }

    const activeMarker = safeArticleMarker(context.articleMarker);
    const activeArticleMatches = activeMarker
      ? matched.filter((candidate) => candidate.articleMarker === activeMarker)
      : [];
    const markerlessSameCardMatches = matched.filter((candidate) => (
      !candidate.articleMarker && candidate.source === 'dom-same-card'
    ));
    if (activeArticleMatches.length === 0 && markerlessSameCardMatches.length === 0 && matched.length > 0) {
      const rejected = uniqueRows(matched);
      const hasMarkerlessNetworkCandidate = rejected.some((candidate) => !candidate.articleMarker);
      const diagnostics = rejected.length > 1 ? rankedDiagnostics(rejected) : {};
      return Object.assign(emptyResult(
        hasMarkerlessNetworkCandidate ? 'missing-article-marker' : 'article-marker-mismatch',
        rejected.length
      ), diagnostics);
    }
    const eligible = activeArticleMatches.length > 0 ? activeArticleMatches : markerlessSameCardMatches;
    const unique = uniqueRows(eligible);
    if (unique.length === 0) return emptyResult(lastRejectReason || 'no-matching-candidate', 0);
    if (unique.length > 1) {
      const diagnostics = rankedDiagnostics(unique);
      return Object.assign(emptyResult('ambiguous-candidate', unique.length), diagnostics);
    }

    const selected = unique[0];
    return {
      present: true,
      source: selected.source,
      candidateKind: 'dong-ho',
      redactedCandidate: selected.redactedCandidate,
      displayCandidate: selected.displayCandidate,
      candidateCount: 1,
      rankedCandidates: [],
      rankedSummary: '',
      reason: 'context-match'
    };
  }

  const api = {
    GROUP_CANDIDATE_SOURCES,
    sanitizeGroupRow,
    selectGroupCandidate,
    typeTokensMatch,
    typeTokensMatchAny
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }

  globalScope.DHS_GROUP_CANDIDATE = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
