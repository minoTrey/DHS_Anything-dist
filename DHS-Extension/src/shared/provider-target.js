(function exposeProviderTarget(globalScope) {
  const VERSION = '0.2.33';
  const CP_TARGET_SELECTOR = [
    'a.agent_name[data-nclk="TAA.cp"]',
    'a[data-nclk="TAA.cp"]',
    'a.agent_info',
    'span.agent_info',
    'button.agent_info',
    '.label--multicp',
    'a.item_link[data-nclk="TAA.groupo"]',
    'a.item_link[role="button"]',
    'button[aria-label*="\uC911\uAC1C\uC0AC"]',
    'button[title*="\uC911\uAC1C\uC0AC"]',
    'button'
  ].join(', ');
  const DIRECT_CP_TARGET_SELECTOR = [
    'a.agent_name[data-nclk="TAA.cp"]',
    'a[data-nclk="TAA.cp"]',
    'a.agent_info',
    'span.agent_info',
    'button.agent_info'
  ].join(', ');
  const SELECTED_ROOT_SELECTOR = [
    '.item.is-selected',
    '.item.is-active',
    '.item[aria-selected="true"]',
    '.item[aria-current="true"]',
    '.item_inner.is-selected',
    '.item_inner.is-active',
    '.item_inner[aria-selected="true"]',
    '.item_inner[aria-current="true"]',
    'a.item_link.is-selected',
    'a.item_link.is-active',
    'a.item_link[aria-selected="true"]',
    'a.item_link[aria-current="true"]',
    'a.item_link[aria-expanded="true"]'
  ].join(', ');
  const ACTIVE_ROOT_SELECTOR = [
    '.detail_panel',
    '.detail_contents',
    '.detail_contents_inner',
    '.main_info_area'
  ].join(', ');
  const LISTING_ROOT_SELECTOR = '.item, .item_inner, li, a.item_link';
  const LISTING_LINK_SELECTOR = 'a.item_link';
  const PROVIDER_TEXT_PATTERN = /\uB9E4\uACBD\uBD80\uB3D9\uC0B0|\uD55C\uACBD\uBD80\uB3D9\uC0B0|\uBD80\uB3D9\uC0B0\uC368\uBE0C|\uACF5\uC2E4\uD074\uB7FD|\uB2E4\uC544\uB77C|\uC0B0\uC5C5\uBD80\uB3D9\uC0B0|\uC544\uC2E4|\uBD80\uB3D9\uC0B0\uB145\uD06C|\uC6B0\uB9AC\uC9D1|\uC6B0\uB9AC\uD558\uC6B0\uC2A4|R114|Gongsil|Homes\s*DID|R-FINE|Rter|Rego|Neonet|TEN|KAR|TheBiz|KISO|Woori|MK/i;

  function list(value) {
    return Array.from(value || []);
  }

  function isVisibleElement(element) {
    if (!element) return false;
    const style = typeof getComputedStyle === 'function' ? getComputedStyle(element) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) {
      return false;
    }
    if (typeof element.getClientRects === 'function' && element.getClientRects().length > 0) return true;
    return Boolean(element.offsetWidth || element.offsetHeight);
  }

  function uniqueElements(elements) {
    return Array.from(new Set(elements.filter(Boolean)));
  }

  function directProviderFamilyKey(element) {
    const text = elementText(element).toLowerCase();
    if (/\uB9E4\uACBD\uBD80\uB3D9\uC0B0|mk/.test(text)) return 'mk';
    if (/\uD55C\uACBD\uBD80\uB3D9\uC0B0|hankyung/.test(text)) return 'hankyung';
    if (/\uBD80\uB3D9\uC0B0\uC368\uBE0C|serve/.test(text)) return 'serve';
    if (/r114/.test(text)) return 'r114';
    if (/\uACF5\uC2E4\uD074\uB7FD|gongsil/.test(text)) return 'gongsilclub';
    if (/homes\s*did/.test(text)) return 'homesdid';
    if (/r-fine|rfine/.test(text)) return 'rfine';
    if (/rter|rego/.test(text)) return 'rter';
    if (/\uC544\uC2E4|asil/.test(text)) return 'asil';
    if (/\uB2E4\uC544\uB77C|\uC0B0\uC5C5\uBD80\uB3D9\uC0B0|daara|industry/.test(text)) return 'daara';
    if (/\uBD80\uB3D9\uC0B0\uB145\uD06C|neonet/.test(text)) return 'neonet';
    if (/ten/.test(text)) return 'ten';
    if (/kar/.test(text)) return 'kar';
    if (/thebiz/.test(text)) return 'thebiz';
    if (/\uC6B0\uB9AC\uC9D1|\uC6B0\uB9AC\uD558\uC6B0\uC2A4|woori/.test(text)) return 'woori';
    if (/kiso/.test(text)) return 'kiso';
    return `text:${text.replace(/\s+/g, '').slice(0, 80)}`;
  }

  function publicProviderFamilyKey(key) {
    const value = String(key || '');
    return value.startsWith('text:') ? 'other' : value;
  }

  function providerFamiliesForTargets(targets) {
    return Array.from(new Set(list(targets)
      .map((target) => publicProviderFamilyKey(directProviderFamilyKey(target)))
      .filter(Boolean)));
  }

  function providerFamilyForTarget(target) {
    return target ? publicProviderFamilyKey(directProviderFamilyKey(target)) : '';
  }

  function uniqueDirectProviderTargetsByFamily(targets) {
    const seen = new Set();
    const rows = [];
    for (const target of list(targets)) {
      const key = directProviderFamilyKey(target);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      rows.push(target);
    }
    return rows;
  }

  function elementMatches(element, selector) {
    return Boolean(element && typeof element.matches === 'function' && element.matches(selector));
  }

  function closest(element, selector) {
    return element && typeof element.closest === 'function' ? element.closest(selector) : null;
  }

  function hasClass(element, className) {
    return String(element && element.className || '').split(/\s+/).includes(className);
  }

  function isBrokerCountLabel(element) {
    return hasClass(element, 'label--multicp');
  }

  function hasVisibleBrokerCountLabel(element) {
    if (!element || typeof element.querySelectorAll !== 'function') return false;
    return list(element.querySelectorAll('.label--multicp')).some(isVisibleElement);
  }

  function elementText(element) {
    if (!element) return '';
    return [
      element.innerText,
      element.textContent,
      element.getAttribute && element.getAttribute('aria-label'),
      element.getAttribute && element.getAttribute('title'),
      element.getAttribute && element.getAttribute('data-nclk'),
      element.className
    ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }

  function isProviderTargetElement(element) {
    const text = elementText(element);
    return Boolean(
      /TAA\.cp/i.test(text) ||
      /TAA\.groupo/i.test(text) ||
      /\uC911\uAC1C\uC0AC\s*\d+\s*\uACF3/.test(text) ||
      /label--multicp/.test(text) ||
      (/\uC81C\uACF5/.test(text) && PROVIDER_TEXT_PATTERN.test(text))
    );
  }

  function normalizeClickTarget(element) {
    if (!element) return null;
    if (isBrokerCountLabel(element)) return closest(element, 'a, button, [role="button"]') || element;
    if (elementMatches(element, 'a, button, [role="button"]')) return element;
    return closest(element, 'a, button, [role="button"]') || element;
  }

  function compactProviderTargets(elements) {
    return list(elements).filter((element) => {
      if (isBrokerCountLabel(element)) return true;
      if (!hasVisibleBrokerCountLabel(element)) return true;
      const text = elementText(element);
      return /TAA\.cp/i.test(text);
    });
  }

  function queryTargetsWithinRoot(root, selector) {
    const targetSelector = selector || CP_TARGET_SELECTOR;
    const own = elementMatches(root, targetSelector) ? [root] : [];
    const children = root && typeof root.querySelectorAll === 'function'
      ? list(root.querySelectorAll(targetSelector))
      : [];
    return own.concat(children);
  }

  function selectSingleVisibleTarget(roots, selector, options) {
    const config = options || {};
    const targets = uniqueElements(compactProviderTargets(list(roots).flatMap((root) => queryTargetsWithinRoot(root, selector)))
      .filter(isVisibleElement)
      .filter(isProviderTargetElement)
      .filter((target) => directProviderTargetMatchesContext(target, config.context))
      .map(normalizeClickTarget));

    if (targets.length === 0) {
      return { status: 'no-target', count: 0, target: null, phase: '', providerFamilies: [], targetProviderFamily: '' };
    }
    if (targets.length > 1) {
      return { status: 'ambiguous-target', count: targets.length, target: null, phase: 'ambiguous', providerFamilies: providerFamiliesForTargets(targets), targetProviderFamily: '' };
    }
    const targetText = elementText(targets[0]);
    const phase = /TAA\.cp/i.test(targetText) ? 'direct-provider' : 'group-target';
    return {
      status: 'ready',
      count: 1,
      target: targets[0],
      phase,
      providerFamilies: phase === 'direct-provider' ? providerFamiliesForTargets(targets) : [],
      targetProviderFamily: phase === 'direct-provider' ? providerFamilyForTarget(targets[0]) : ''
    };
  }

  function safeTargetIndex(value, count) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || count <= 0) return 0;
    return Math.floor(parsed) % count;
  }

  function directProviderTargetMatchesContext(target, context) {
    if (!hasContextSignals(context)) return true;
    const nearestListing = closest(target, '.item, li, a.item_link') || closest(target, LISTING_ROOT_SELECTOR);
    if (!looksLikeStandaloneListingRow(nearestListing)) return true;
    const text = listingRootContextText(nearestListing, target);
    return (
      listingMatchesContextWithoutPrice(text, context) ||
      listingMatchesExpandedContext(text, context) ||
      listingMatchesRelaxedProviderContext(text, context)
    );
  }

  function selectDirectProviderTargets(targets, targetIndex, options) {
    const config = options || {};
    const normalizedTargets = uniqueElements(list(targets)
      .filter(isVisibleElement)
      .filter(isProviderTargetElement)
      .filter((target) => directProviderTargetMatchesContext(target, config.context))
      .map(normalizeClickTarget));
    const selectedTargets = config.dedupeByFamily === false
      ? normalizedTargets
      : uniqueDirectProviderTargetsByFamily(normalizedTargets);

    if (selectedTargets.length === 0) {
      return { status: 'no-target', count: 0, target: null, phase: '', providerFamilies: [], targetProviderFamily: '' };
    }
    const target = selectedTargets[safeTargetIndex(targetIndex, selectedTargets.length)];
    return {
      status: 'ready',
      count: selectedTargets.length,
      target,
      phase: 'direct-provider',
      providerFamilies: providerFamiliesForTargets(selectedTargets),
      targetProviderFamily: providerFamilyForTarget(target)
    };
  }

  function selectFirstDirectProviderTarget(roots, targetIndex, options) {
    return selectDirectProviderTargets(list(roots).flatMap((root) => queryTargetsWithinRoot(root, DIRECT_CP_TARGET_SELECTOR)), targetIndex, options);
  }

  function isGroupProviderTargetElement(element) {
    const text = elementText(element);
    return Boolean(
      /TAA\.groupo/i.test(text) ||
      /\uC911\uAC1C\uC0AC\s*\d+\s*\uACF3/.test(text) ||
      /label--multicp/.test(text)
    );
  }

  function selectFirstGroupProviderTarget(roots, targetIndex) {
    const targets = uniqueElements(compactProviderTargets(list(roots).flatMap((root) => queryTargetsWithinRoot(root, CP_TARGET_SELECTOR)))
      .filter(isVisibleElement)
      .filter(isGroupProviderTargetElement)
      .map(normalizeClickTarget));

    if (targets.length === 0) {
      return { status: 'no-target', count: 0, target: null, phase: '', providerFamilies: [], targetProviderFamily: '' };
    }
    const target = targets[safeTargetIndex(targetIndex, targets.length)];
    return {
      status: 'ready',
      count: targets.length,
      target,
      phase: 'group-target',
      providerFamilies: [],
      targetProviderFamily: ''
    };
  }

  function normalized(value) {
    return String(value || '').replace(/\s+/g, '').trim();
  }

  function tokenMatches(haystack, token) {
    const value = normalized(token);
    return Boolean(value && haystack.includes(value));
  }

  function typeTokenMatches(haystack, typeToken) {
    const value = normalized(typeToken);
    if (!value) return false;
    return haystack.includes(value) || haystack.includes(value.replace(/[A-Z]+$/i, ''));
  }

  function typeTokensForContext(context) {
    const input = context || {};
    return Array.from(new Set([input.typeToken].concat(Array.isArray(input.typeAliases) ? input.typeAliases : [])
      .map(normalized)
      .filter(Boolean)));
  }

  function anyTypeTokenMatches(haystack, context) {
    const tokens = typeTokensForContext(context);
    if (tokens.length < 1) return false;
    return tokens.some((token) => typeTokenMatches(haystack, token));
  }

  function hasContextSignals(context) {
    const input = context || {};
    return Boolean(
      input.dongToken ||
      input.dealType ||
      input.priceToken ||
      input.directionToken ||
      input.typeToken ||
      (Array.isArray(input.typeAliases) && input.typeAliases.length > 0) ||
      input.floorKind ||
      input.floorBand ||
      input.floorValue ||
      input.totalFloor
    );
  }

  function filterRootsByContext(roots, context) {
    if (!hasContextSignals(context)) return roots;
    return list(roots).filter((root) => {
      const text = listingRootContextText(root, root);
      return (
        listingMatchesContext(text, context) ||
        listingMatchesExpandedContext(text, context) ||
        listingMatchesRelaxedProviderContext(text, context)
      );
    });
  }

  function uniqueListingRootsByContextText(items) {
    const seen = new Set();
    const rows = [];
    for (const item of list(items)) {
      const root = item && item.root;
      if (!root) continue;
      const signature = normalized(listingRootContextText(root, item.link)).slice(0, 240);
      if (signature && seen.has(signature)) continue;
      if (signature) seen.add(signature);
      rows.push(root);
    }
    return uniqueElements(rows);
  }

  function listingBandToken(context) {
    const band = String(context.floorBand || '');
    if (band === 'low') return '\uC800';
    if (band === 'mid') return '\uC911';
    if (band === 'high') return '\uACE0';
    return '';
  }

  function listingHasBandMatch(haystack, context) {
    const band = listingBandToken(context);
    if (!band) return false;
    const total = Number(context && context.totalFloor || 0);
    if (total > 0) {
      return haystack.includes(`${band}/${total}\uCE35`) || haystack.includes(`${band}\uCE35/${total}\uCE35`);
    }
    return haystack.includes(`${band}\uCE35`);
  }

  function listingHasAnyFloorSignal(haystack) {
    return /(?:\d{1,2}|[\uC800\uC911\uACE0](?:\uCE35)?)\/\d{1,3}\uCE35|\d{1,2}\uCE35/.test(haystack);
  }

  function listingDirectionMatch(haystack, context) {
    const expected = normalized(context && context.directionToken);
    if (!expected) return { present: false, matches: true };
    const directions = new Set(
      String(haystack || '').match(/(?:\uB0A8\uB3D9|\uB0A8\uC11C|\uBD81\uB3D9|\uBD81\uC11C|\uB3D9|\uC11C|\uB0A8|\uBD81)\uD5A5/g) || []
    );
    if (directions.size < 1) return { present: false, matches: true };
    return {
      present: true,
      matches: directions.size === 1 && directions.has(expected)
    };
  }

  function listingMatchesContextInternal(text, context, options) {
    const input = context || {};
    const config = options || {};
    const haystack = normalized(text);
    let required = 0;
    let matched = 0;

    function requireToken(token) {
      const value = normalized(token);
      if (!value) return;
      required += 1;
      if (haystack.includes(value)) matched += 1;
    }

    requireToken(input.dongToken);
    requireToken(input.dealType);
    if (!config.ignorePrice) requireToken(input.priceToken);

    const direction = listingDirectionMatch(haystack, input);
    if (!direction.matches) return false;
    if (direction.present) {
      required += 1;
      matched += 1;
    }

    if (typeTokensForContext(input).length > 0) {
      required += 1;
      if (anyTypeTokenMatches(haystack, input)) matched += 1;
    }

    if (input.floorKind === 'exact' && Number(input.floorValue) > 0) {
      required += 1;
      const exact = `${Number(input.floorValue)}/${Number(input.totalFloor) || ''}\uCE35`;
      const loose = `${Number(input.floorValue)}\uCE35`;
      if (haystack.includes(exact) || haystack.includes(loose)) matched += 1;
      else if (listingHasAnyFloorSignal(haystack)) return false;
    } else if (input.floorKind === 'band') {
      if (listingBandToken(input)) {
        required += 1;
        if (listingHasBandMatch(haystack, input)) matched += 1;
        else if (listingHasAnyFloorSignal(haystack)) return false;
      }
    }

    return required >= 2 && matched === required;
  }

  function listingMatchesContext(text, context) {
    return listingMatchesContextInternal(text, context, { ignorePrice: false });
  }

  function listingMatchesContextWithoutPrice(text, context) {
    return listingMatchesContextInternal(text, context, { ignorePrice: true });
  }

  function listingMatchesExpandedContext(text, context) {
    const input = context || {};
    const haystack = normalized(text);
    let required = 0;
    let matched = 0;

    function scoreToken(token) {
      const value = normalized(token);
      if (!value) return;
      required += 1;
      if (haystack.includes(value)) matched += 1;
    }

    scoreToken(input.dongToken);
    scoreToken(input.dealType);

    const direction = listingDirectionMatch(haystack, input);
    if (!direction.matches) return false;
    if (direction.present) {
      required += 1;
      matched += 1;
    }

    if (typeTokensForContext(input).length > 0) {
      required += 1;
      if (!anyTypeTokenMatches(haystack, input)) return false;
      matched += 1;
    }

    if (input.floorKind === 'exact' && Number(input.floorValue) > 0) {
      required += 1;
      const exact = `${Number(input.floorValue)}/${Number(input.totalFloor) || ''}\uCE35`;
      const loose = `${Number(input.floorValue)}\uCE35`;
      if (haystack.includes(exact) || haystack.includes(loose)) matched += 1;
      else if (listingHasAnyFloorSignal(haystack)) return false;
    } else if (input.floorKind === 'band') {
      if (listingBandToken(input)) {
        required += 1;
        if (listingHasBandMatch(haystack, input)) matched += 1;
        else if (listingHasAnyFloorSignal(haystack)) return false;
      }
    }

    return required >= 3 && matched >= 3;
  }

  function listingMatchesRelaxedProviderContext(text, context) {
    const input = context || {};
    const haystack = normalized(text);
    const dongToken = normalized(input.dongToken);
    if (!dongToken || typeTokensForContext(input).length < 1 || !tokenMatches(haystack, dongToken)) return false;
    if (!anyTypeTokenMatches(haystack, input)) return false;
    if (!listingDirectionMatch(haystack, input).matches) return false;

    if (input.floorKind === 'exact' && Number(input.floorValue) > 0) {
      const exact = `${Number(input.floorValue)}/${Number(input.totalFloor) || ''}\uCE35`;
      const loose = `${Number(input.floorValue)}\uCE35`;
      if (haystack.includes(exact) || haystack.includes(loose)) return true;
      if (listingHasAnyFloorSignal(haystack)) return false;
    } else if (input.floorKind === 'band') {
      if (listingBandToken(input)) {
        if (listingHasBandMatch(haystack, input)) return true;
        if (listingHasAnyFloorSignal(haystack)) return false;
      }
    }

    const dealType = normalized(input.dealType);
    if (dealType && haystack.includes(dealType)) return true;

    return true;
  }

  function selectUniqueListingTextByContext(items, context) {
    const matches = list(items).filter((item) => {
      const text = String(item && item.text || '');
      if (!text) return false;
      return listingMatchesContext(text, context)
        || listingMatchesExpandedContext(text, context)
        || listingMatchesRelaxedProviderContext(text, context);
    });
    return matches.length === 1 ? matches[0] : null;
  }

  function brokerTokenCandidates(value) {
    const full = normalized(value);
    if (!full) return [];
    const stem = full.replace(/(?:\uACF5\uC778\uC911\uAC1C\uC0AC\uC0AC\uBB34\uC18C|\uBD80\uB3D9\uC0B0\uC911\uAC1C\uC0AC\uBB34\uC18C|\uC911\uAC1C\uC0AC\uBB34\uC18C|\uACF5\uC778\uC911\uAC1C\uC0AC|\uBD80\uB3D9\uC0B0|\uC0AC\uBB34\uC18C)$/u, '');
    return [...new Set([full, stem.length >= 3 ? stem : ''].filter(Boolean))];
  }

  function selectUniqueGroupedChildTextByContext(items, context) {
    const brokerTokens = brokerTokenCandidates(context && context.brokerToken);
    if (brokerTokens.length) {
      const fullBrokerMatches = list(items).filter((item) => {
        const text = normalized(item && item.text);
        return text.includes(brokerTokens[0]);
      });
      if (fullBrokerMatches.length === 1) return fullBrokerMatches[0];
      const stemTokens = brokerTokens.slice(1);
      if (fullBrokerMatches.length === 0 && stemTokens.length) {
        const stemMatches = list(items).filter((item) => {
          const text = normalized(item && item.text);
          return stemTokens.some((token) => text.includes(token));
        });
        if (stemMatches.length === 1) return stemMatches[0];
      }
    }
    const strict = selectUniqueListingTextByContext(items, context);
    if (strict) return strict;
    if (!normalized(context && context.directionToken)) return null;
    const directionMatches = list(items).filter((item) => {
      const direction = listingDirectionMatch(String(item && item.text || ''), context);
      return direction.present && direction.matches;
    });
    return directionMatches.length === 1 ? directionMatches[0] : null;
  }

  function listingRootForLink(link) {
    const nearest = closest(link && link.parentElement, '.item, .item_inner, li') || link;
    const broader = nearest && nearest.parentElement
      ? closest(nearest.parentElement, '.item, li')
      : null;
    if (
      broader &&
      broader !== nearest &&
      queryTargetsWithinRoot(broader, DIRECT_CP_TARGET_SELECTOR).length >
        queryTargetsWithinRoot(nearest, DIRECT_CP_TARGET_SELECTOR).length
    ) {
      return broader;
    }
    return nearest;
  }

  function descendantText(element, depth) {
    if (!element || depth > 4 || !element.children) return '';
    return list(element.children).slice(0, 80)
      .map((child) => [elementText(child), descendantText(child, depth + 1)].filter(Boolean).join(' '))
      .filter(Boolean)
      .join(' ');
  }

  function listingRootContextText(root, link) {
    const listingLinks = root && typeof root.querySelectorAll === 'function'
      ? list(root.querySelectorAll(LISTING_LINK_SELECTOR))
      : [];
    return uniqueElements([root, link].concat(listingLinks))
      .map(elementText)
      .concat(descendantText(root, 0))
      .join(' ');
  }

  function looksLikeStandaloneListingRow(root) {
    if (!root || hasClass(root, 'item--child')) return false;
    const haystack = normalized(listingRootContextText(root, root));
    if (!haystack) return false;
    const hasDong = /\d{1,4}\uB3D9/.test(haystack);
    const hasFloor = listingHasAnyFloorSignal(haystack);
    const hasType = /\d{2,3}[A-Z]?\/\d{1,3}m/.test(haystack) || /\uC544\uD30C\uD2B8\d{2,3}[A-Z]?/.test(haystack);
    const hasDeal = /\uB9E4\uB9E4|\uC804\uC138|\uC6D4\uC138/.test(haystack);
    const hasDealPrice = /(?:\uB9E4\uB9E4|\uC804\uC138|\uC6D4\uC138)[0-9,]+\uC5B5?/.test(haystack);
    const score = [hasDong, hasFloor, hasType, hasDealPrice || hasDeal].filter(Boolean).length;
    return score >= 2;
  }

  function contextMatchedListingRoots(documentRef, context) {
    const doc = documentRef || (typeof document !== 'undefined' ? document : null);
    if (!doc || typeof doc.querySelectorAll !== 'function' || !context) return [];
    return uniqueListingRootsByContextText(list(doc.querySelectorAll(LISTING_LINK_SELECTOR))
      .map((link) => ({ link, root: listingRootForLink(link) }))
      .filter((item) => listingMatchesContext(listingRootContextText(item.root, item.link), context)));
  }

  function looseExpandedContextRoots(documentRef, context) {
    const doc = documentRef || (typeof document !== 'undefined' ? document : null);
    if (!doc || typeof doc.querySelectorAll !== 'function' || !context) return [];
    return uniqueListingRootsByContextText(list(doc.querySelectorAll(LISTING_LINK_SELECTOR))
      .map((link) => ({ link, root: listingRootForLink(link) }))
      .filter((item) => listingMatchesExpandedContext(listingRootContextText(item.root, item.link), context))
    )
      .filter((root) => selectFirstDirectProviderTarget([root]).count > 0);
  }

  function directProviderContextItems(documentRef, context) {
    const doc = documentRef || (typeof document !== 'undefined' ? document : null);
    if (!doc || typeof doc.querySelectorAll !== 'function' || !context) return [];
    return list(doc.querySelectorAll(DIRECT_CP_TARGET_SELECTOR))
      .filter(isVisibleElement)
      .map((target) => ({
        target,
        root: providerContextRootForTarget(target, context)
      }))
      .filter((item) => item.root && listingMatchesExpandedContext(listingRootContextText(item.root, item.target), context));
  }

  function directProviderContextRoots(documentRef, context) {
    return uniqueElements(directProviderContextItems(documentRef, context)
      .flatMap((item) => providerContextRootsForTarget(item.target, item.root)));
  }

  function siblingDirectProviderTargets(documentRef, context) {
    return uniqueElements(directProviderContextItems(documentRef, context)
      .filter((item) => item.root && item.target && !containsElement(item.root, item.target))
      .map((item) => item.target));
  }

  function relaxedDirectProviderContextRoots(documentRef, context) {
    const doc = documentRef || (typeof document !== 'undefined' ? document : null);
    if (!doc || typeof doc.querySelectorAll !== 'function' || !context) return [];
    return uniqueElements(list(doc.querySelectorAll(DIRECT_CP_TARGET_SELECTOR))
      .filter(isVisibleElement)
      .map((target) => ({
        target,
        root: providerContextRootForTarget(target, context)
      }))
      .filter((item) => item.root && hasClass(item.root, 'item') && hasClass(item.root, 'is-expanded'))
      .filter((item) => item.root && listingMatchesRelaxedProviderContext(listingRootContextText(item.root, item.target), context))
      .map((item) => item.root));
  }

  function activeFallbackRoots(roots, context) {
    const rows = list(roots).filter(isVisibleElement);
    if (!hasContextSignals(context)) return rows;
    return rows
      .filter((root) => {
        const listingCount = root && typeof root.querySelectorAll === 'function'
          ? list(root.querySelectorAll(LISTING_LINK_SELECTOR)).length
          : 0;
        if (listingCount > 3) return false;
        const text = listingRootContextText(root, root);
        return (
          listingMatchesContextWithoutPrice(text, context) ||
          listingMatchesExpandedContext(text, context) ||
          listingMatchesRelaxedProviderContext(text, context)
        );
      });
  }

  function preferredListingRoots(context) {
    return uniqueElements(list(context && context.preferredListingRoots).filter(isVisibleElement));
  }

  function preferredRootForElement(element, context) {
    for (const root of preferredListingRoots(context)) {
      if (root === element || containsElement(root, element)) return root;
    }
    return null;
  }

  function previousPreferredListingSibling(root, context) {
    const preferredRoots = preferredListingRoots(context);
    if (preferredRoots.length < 1) return null;
    let current = root;
    while (current) {
      let sibling = current.previousElementSibling || null;
      while (sibling) {
        const preferred = preferredRoots.find((candidate) => candidate === sibling || containsElement(candidate, sibling));
        if (preferred) return preferred;
        sibling = sibling.previousElementSibling || null;
      }
      current = current.parentElement;
    }
    return null;
  }

  function providerContextRootForTarget(target, context) {
    const preferredOwnRoot = preferredRootForElement(target, context);
    if (preferredOwnRoot) return preferredOwnRoot;
    let current = target;
    while (current) {
      if (isExpandedListingContextRoot(current)) return current;
      current = current.parentElement;
    }
    const nearestListing = closest(target, '.item, li, a.item_link') || closest(target, LISTING_ROOT_SELECTOR);
    const preferredSibling = previousPreferredListingSibling(nearestListing, context);
    if (preferredSibling && !looksLikeStandaloneListingRow(nearestListing)) return preferredSibling;
    const expandedSibling = previousExpandedListingSibling(nearestListing);
    if (expandedSibling && !looksLikeStandaloneListingRow(nearestListing)) return expandedSibling;
    return nearestListing || closest(target, LISTING_ROOT_SELECTOR);
  }

  function providerContextRootsForTarget(target, contextRoot) {
    if (!target || !contextRoot) return [];
    if (containsElement(contextRoot, target)) return [contextRoot];
    const targetRoot = closest(target, LISTING_ROOT_SELECTOR) || target;
    return uniqueElements([contextRoot, targetRoot]);
  }

  function containsElement(root, target) {
    if (!root || !target) return false;
    if (root === target) return true;
    if (typeof root.contains === 'function') return root.contains(target);
    let current = target.parentElement || null;
    while (current) {
      if (current === root) return true;
      current = current.parentElement || null;
    }
    return false;
  }

  function previousExpandedListingSibling(root) {
    let current = root;
    while (current) {
      let sibling = current.previousElementSibling || null;
      while (sibling) {
        if (isExpandedListingContextRoot(sibling)) return sibling;
        sibling = sibling.previousElementSibling || null;
      }
      current = current.parentElement;
    }
    return null;
  }

  function hasExpandedListingLink(element) {
    if (!element) return false;
    if (hasClass(element, 'item_link') && element.getAttribute && element.getAttribute('aria-expanded') === 'true') return true;
    if (typeof element.querySelectorAll !== 'function') return false;
    return list(element.querySelectorAll('a.item_link'))
      .some((link) => link && link.getAttribute && link.getAttribute('aria-expanded') === 'true');
  }

  function isExpandedListingContextRoot(element) {
    if (!element || hasClass(element, 'item--child')) return false;
    if (!elementMatches(element, LISTING_ROOT_SELECTOR)) return false;
    return (hasClass(element, 'item') && hasClass(element, 'is-expanded')) || hasExpandedListingLink(element);
  }

  function findProviderClickTarget(documentRef, context) {
    const doc = documentRef || (typeof document !== 'undefined' ? document : null);
    if (!doc || typeof doc.querySelectorAll !== 'function') {
      return { status: 'no-target', count: 0, target: null };
    }
    const directProviderTargetIndex = context && context.directProviderTargetIndex;
    const forcedPhase = String(context && (context.providerTargetPhase || context.targetPhase) || '');
    const groupTargetIndex = context && context.groupProviderTargetIndex;

    if (forcedPhase === 'group-target') {
      const contextRoots = contextMatchedListingRoots(doc, context).filter(isVisibleElement);
      const contextGroupResult = selectFirstGroupProviderTarget(contextRoots, groupTargetIndex);
      if (contextGroupResult.count > 0) return contextGroupResult;

      const selectedRoots = filterRootsByContext(list(doc.querySelectorAll(SELECTED_ROOT_SELECTOR)).filter(isVisibleElement), context);
      const selectedGroupResult = selectFirstGroupProviderTarget(selectedRoots, groupTargetIndex);
      if (selectedGroupResult.count > 0) return selectedGroupResult;

      const roots = filterRootsByContext(
        list(doc.querySelectorAll(ACTIVE_ROOT_SELECTOR)).filter(isVisibleElement),
        context
      );
      return selectFirstGroupProviderTarget(roots, groupTargetIndex);
    }

    const contextRoots = contextMatchedListingRoots(doc, context).filter(isVisibleElement);
    const contextDirectResult = selectFirstDirectProviderTarget(contextRoots, directProviderTargetIndex, { context });
    if (contextDirectResult.count > 0) return contextDirectResult;
    const contextResult = selectSingleVisibleTarget(contextRoots, undefined, { context });
    if (contextResult.count > 0) return contextResult;

    const looseRoots = looseExpandedContextRoots(doc, context).filter(isVisibleElement);
    if (looseRoots.length === 1) {
      const looseDirectResult = selectFirstDirectProviderTarget(looseRoots, directProviderTargetIndex, { context });
      if (looseDirectResult.count > 0) return looseDirectResult;
    }

    const directRoots = directProviderContextRoots(doc, context).filter(isVisibleElement);
    const siblingDirectTargets = siblingDirectProviderTargets(doc, context).filter(isVisibleElement);
    if (siblingDirectTargets.length > 0) {
      const siblingDirectResult = selectDirectProviderTargets(siblingDirectTargets, directProviderTargetIndex, { dedupeByFamily: false, context });
      if (siblingDirectResult.count > 0) return siblingDirectResult;
    }
    const expandedDirectResult = selectFirstDirectProviderTarget(directRoots, directProviderTargetIndex, { context });
    if (expandedDirectResult.count > 0) return expandedDirectResult;

    const relaxedDirectRoots = relaxedDirectProviderContextRoots(doc, context).filter(isVisibleElement);
    if (relaxedDirectRoots.length === 1) {
      const relaxedDirectResult = selectFirstDirectProviderTarget(relaxedDirectRoots, directProviderTargetIndex, { context });
      if (relaxedDirectResult.count > 0) return relaxedDirectResult;
    }

    const selectedRoots = filterRootsByContext(list(doc.querySelectorAll(SELECTED_ROOT_SELECTOR)).filter(isVisibleElement), context);
    const selectedDirectResult = selectFirstDirectProviderTarget(selectedRoots, directProviderTargetIndex, { context });
    if (selectedDirectResult.count > 0) return selectedDirectResult;
    const selectedResult = selectSingleVisibleTarget(selectedRoots, undefined, { context });
    if (selectedResult.count > 0) return selectedResult;

    const roots = activeFallbackRoots(list(doc.querySelectorAll(ACTIVE_ROOT_SELECTOR)), context);
    const activeDirectResult = selectFirstDirectProviderTarget(roots, directProviderTargetIndex, { context });
    if (activeDirectResult.count > 0) return activeDirectResult;
    return selectSingleVisibleTarget(roots, undefined, { context });
  }

  const api = {
    VERSION,
    CP_TARGET_SELECTOR,
    DIRECT_CP_TARGET_SELECTOR,
    SELECTED_ROOT_SELECTOR,
    ACTIVE_ROOT_SELECTOR,
    selectSingleVisibleTarget,
    selectFirstDirectProviderTarget,
    selectFirstGroupProviderTarget,
    uniqueDirectProviderTargetsByFamily,
    providerFamiliesForTargets,
    providerFamilyForTarget,
    contextMatchedListingRoots,
    listingMatchesContext,
    listingMatchesContextWithoutPrice,
    listingMatchesExpandedContext,
    listingMatchesRelaxedProviderContext,
    selectUniqueGroupedChildTextByContext,
    selectUniqueListingTextByContext,
    looseExpandedContextRoots,
    directProviderContextRoots,
    relaxedDirectProviderContextRoots,
    providerContextRootForTarget,
    findProviderClickTarget
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }

  globalScope.DHS_PROVIDER_TARGET = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
