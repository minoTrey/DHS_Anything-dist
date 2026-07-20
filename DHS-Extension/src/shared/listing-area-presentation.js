(function exposeListingAreaPresentation(globalScope) {
  const AREA_UNIT = '(?:m2|m\\u00B2|\\u33A1)';
  const AREA_PAIR_PATTERN = new RegExp(
    `(?<!\\d)(\\d{1,3}(?:\\.\\d{1,4})?)\\s*(?:(${AREA_UNIT})|([A-Z]{1,3}))?\\s*\\/\\s*(\\d{1,3}(?:\\.\\d{1,4})?)\\s*(${AREA_UNIT})?(?!\\d)`,
    'gi'
  );

  function norm(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function areaNumber(value) {
    const match = norm(value).replace(/,/g, '').match(/(?<!\d)(\d{1,3}(?:\.\d{1,4})?)(?!\d)/);
    const number = match ? Number(match[1]) : 0;
    return Number.isFinite(number) && number > 0 && number < 400 ? number : 0;
  }

  function areaString(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 && number < 400 ? String(number) : '';
  }

  function supplyAreaFromText(value) {
    const text = norm(value);
    if (!text) return '';
    const candidates = [];
    AREA_PAIR_PATTERN.lastIndex = 0;
    for (const match of text.matchAll(AREA_PAIR_PATTERN)) {
      const supply = Number(match[1] || 0);
      const firstUnit = norm(match[2]);
      const typeSuffix = norm(match[3]);
      const exclusive = Number(match[4] || 0);
      const secondUnit = norm(match[5]);
      const suffix = text.slice(Number(match.index || 0) + String(match[0] || '').length, Number(match.index || 0) + String(match[0] || '').length + 3);
      const explicitAreaShape = Boolean(firstUnit || secondUnit || typeSuffix);
      if (!(supply > 0 && supply < 400 && exclusive > 0 && exclusive < 400)) continue;
      if (/^\s*\uCE35/.test(suffix)) continue;
      if (!explicitAreaShape && supply <= exclusive) continue;
      const prefix = text.slice(Math.max(0, Number(match.index || 0) - 24), Number(match.index || 0));
      const labeled = /\uACF5\uAE09|\uC804\uC6A9|\uBA74\uC801/.test(prefix);
      candidates.push({
        area: supply,
        index: Number(match.index || 0),
        score: (firstUnit || secondUnit ? 100 : 0) + (typeSuffix ? 40 : 0) + (labeled ? 80 : 0) + (supply > exclusive ? 10 : 0)
      });
    }
    candidates.sort((left, right) => (right.score - left.score) || (left.index - right.index));
    return candidates.length ? areaString(candidates[0].area) : '';
  }

  function floorCurrentValue(value) {
    const match = norm(value).match(/(?:^|[^\d])(\d{1,2})\s*\/\s*\d{1,2}(?:\s*\uCE35)?(?:$|[^\d])/);
    return match ? Number(match[1] || 0) || 0 : 0;
  }

  function compatibleAreaPair(areaHint, typeArea) {
    if (!(areaHint > 0 && typeArea > 0)) return true;
    const ratio = areaHint / typeArea;
    return ratio >= 0.65 && ratio <= 1.55;
  }

  function pyeongCell(row) {
    const input = row && typeof row === 'object' ? row : {};
    let areaHint = areaNumber(input.areaHint);
    const typeArea = areaNumber(input.type);
    const floorValue = floorCurrentValue(input.floor);
    if (areaHint && floorValue && Math.abs(areaHint - floorValue) < 0.001 && (!typeArea || Math.abs(typeArea - areaHint) > 0.001)) {
      areaHint = 0;
    }
    if (areaHint && typeArea && !compatibleAreaPair(areaHint, typeArea)) return '';
    const area = areaHint || typeArea;
    return area > 0 ? String(Math.round(area / 3.305785)) : '';
  }

  const api = {
    pyeongCell,
    supplyAreaFromText
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }
  globalScope.DHS_LISTING_AREA_PRESENTATION = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
