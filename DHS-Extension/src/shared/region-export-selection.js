(function exposeRegionExportSelection(globalScope) {
  function norm(value) {
    return String(value || '')
      .replace(/[|\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 40);
  }

  function createSelection(values) {
    const input = Array.isArray(values) ? values : String(values || '').split('|');
    const selected = input.map(norm).filter(Boolean).slice(0, 3);
    const complete = selected.length === 3;
    return {
      sido: selected[0] || '',
      sigungu: selected[1] || '',
      eupMyeonDong: selected[2] || '',
      values: selected,
      key: complete ? selected.join('|') : '',
      label: selected.join(' '),
      complete
    };
  }

  function confirmationText(selection) {
    const selected = createSelection(selection && selection.values || selection && selection.key || selection);
    return selected.complete ? `${selected.label} \uC815\uBCF4\uB97C \uCD94\uCD9C\uD560\uAE4C\uC694?` : '';
  }

  function sameSelection(left, right) {
    const leftSelection = createSelection(left && left.values || left && left.key || left);
    const rightSelection = createSelection(right && right.values || right && right.key || right);
    return Boolean(
      leftSelection.complete
      && rightSelection.complete
      && leftSelection.key === rightSelection.key
    );
  }

  function shouldConfirmSelection(input) {
    const state = input && typeof input === 'object' ? input : {};
    const selection = createSelection(state.selection && state.selection.values || state.selection && state.selection.key || state.selection);
    return state.status === 'selecting-region'
      && Boolean(state.selectorWasExpanded)
      && !state.selectorExpanded
      && selection.complete;
  }

  const api = {
    createSelection,
    confirmationText,
    sameSelection,
    shouldConfirmSelection
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }
  globalScope.DHS_REGION_EXPORT_SELECTION = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
