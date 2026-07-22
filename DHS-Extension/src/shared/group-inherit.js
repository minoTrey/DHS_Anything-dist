(function exposeGroupInherit(globalScope) {
  function norm(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  // The inherited exact (from a same-unit group sibling) must be consistent with THIS child's own
  // line-inference candidate set when one exists: because 동일매물 children are literally the same
  // unit, the sibling's answer must appear among this child's candidates. With no candidate set to
  // contradict, the caller still validates dong/floor via the quality gate, so we allow it here.
  function groupExactConsistentWithChild(inheritedDisplay, candidateDisplays) {
    const candidates = Array.isArray(candidateDisplays) ? candidateDisplays : [];
    if (!candidates.length) return true;
    const target = norm(inheritedDisplay);
    if (!target) return false;
    return candidates.some(function (candidate) { return norm(candidate) === target; });
  }

  // Decide the exact 동/호 to inherit for the currently-open child from the group cache, or '' for
  // none. Returns '' unless there is a group key, a cached exact for it, and it is consistent with
  // the child's own candidates. The caller is still responsible for validating dong/floor via the
  // quality gate before latching (this function is the group-membership + consistency decision only).
  function chooseInheritedExact(groupKey, cache, candidateDisplays) {
    const key = norm(groupKey);
    if (!key || !cache || typeof cache.get !== 'function') return '';
    const entry = cache.get(key);
    if (!entry || !entry.display) return '';
    if (!groupExactConsistentWithChild(entry.display, candidateDisplays)) return '';
    return norm(entry.display);
  }

  const api = {
    groupExactConsistentWithChild,
    chooseInheritedExact
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }
  globalScope.DHS_GROUP_INHERIT = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
