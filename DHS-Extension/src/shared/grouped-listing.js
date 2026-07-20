(function exposeGroupedListing(globalScope) {
  function norm(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function compact(value) {
    return norm(value).replace(/\s+/g, '');
  }

  function safeId(value) {
    const id = compact(value).replace(/[^A-Za-z0-9:_-]/g, '').slice(0, 96);
    return id;
  }

  function hashToken16(value) {
    const input = String(value || '');
    const hashWithSeed = (seed) => {
      let hash = seed >>> 0;
      for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
      }
      return (hash >>> 0).toString(16).padStart(8, '0');
    };
    return `${hashWithSeed(0x811c9dc5)}${hashWithSeed(0x9e3779b9)}`;
  }

  function positiveInteger(...values) {
    for (const value of values) {
      const number = Number(value);
      if (Number.isInteger(number) && number > 0) return number;
    }
    return 1;
  }

  function numberToken(value) {
    const number = Number(String(value ?? '').replace(/,/g, ''));
    if (!Number.isFinite(number) || number <= 0) return '';
    return number.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  }

  function canonicalGroupedListing(value) {
    const input = value && typeof value === 'object' ? value : {};
    const info = input.listingInfo && typeof input.listingInfo === 'object'
      ? Object.assign({}, input.listingInfo, input)
      : input;
    const deal = norm(info.dealOrWarrantPrc);
    const rent = norm(info.rentPrc);
    const price = norm(info.priceHint || info.price || (rent ? `${deal}/${rent}` : deal));
    const measuredArea = [numberToken(info.area1), numberToken(info.area2)].every(Boolean)
      ? [numberToken(info.area1), numberToken(info.area2)].join('|')
      : '';
    return {
      id: safeId(info.id || info.articleNo || info.key || info.listingKey),
      building: norm(info.building || info.buildingName || info.dong || info.targetDong),
      trade: norm(info.trade || info.tradeTypeName || info.dealType || info.dealHint),
      price,
      minPrice: norm(info.sameAddrMinPrc || info.minPrice),
      maxPrice: norm(info.sameAddrMaxPrc || info.maxPrice),
      area: norm(info.area || info.areaName || info.areaHint || info.type || info.typeToken),
      areaMeasures: norm(info.areaMeasures) || measuredArea,
      floor: norm(info.floorInfo || info.floor || info.floorHint || info.articleFloor || info.correspondingFloorCount),
      direction: norm(info.direction || info.directionHint),
      groupCount: positiveInteger(
        info.expectedCount,
        info.childExpectedCount,
        info.capacity,
        info.groupCount,
        info.sameAddrCnt,
        info.groupedBrokerCount
      )
    };
  }

  function normalizedBuilding(value) {
    const text = norm(value);
    const match = text.match(/\d{1,4}/);
    return match ? String(Number(match[0]) || match[0]) : compact(text).toUpperCase();
  }

  function normalizedArea(value) {
    const text = compact(value)
      .toUpperCase()
      .replace(/\u33A1|M\u00B2/g, 'M2')
      .replace(/M2$/, '');
    const match = text.match(/\d{1,3}(?:\.\d+)?[A-Z]{0,3}/);
    return match ? match[0].replace(/\.0+(?=[A-Z]|$)/, '') : text;
  }

  function normalizedContextToken(value) {
    return compact(value).replace(/,/g, '').toUpperCase();
  }

  function exactFloor(value) {
    const match = norm(value).match(/(?:^|[^\d])(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\uCE35)?(?:$|[^\d])/);
    if (!match) return { floor: 0, total: 0 };
    return { floor: Number(match[1]) || 0, total: Number(match[2]) || 0 };
  }

  function totalFloor(value) {
    const match = norm(value).match(/\/\s*(\d{1,2})/);
    return match ? Number(match[1]) || 0 : 0;
  }

  function explicitFloorBand(value) {
    const match = norm(value).match(/(?:^|\s)(\uC800|\uC911|\uACE0|low|mid|high)(?:\uCE35)?\s*\/\s*\d{1,2}(?:\s*\uCE35)?(?:$|\s)/i);
    if (!match) return '';
    const token = String(match[1]).toLowerCase();
    return ['\uC800', 'low'].includes(token) ? 'low' : (['\uC911', 'mid'].includes(token) ? 'mid' : 'high');
  }

  function numericFloorBand(floor, total) {
    if (!(floor > 0 && total > 0 && floor <= total)) return '';
    const lowMax = Math.max(1, Math.floor(total / 3));
    const highMin = Math.max(lowMax + 1, Math.ceil((total * 2) / 3));
    if (floor <= lowMax) return 'low';
    if (floor >= highMin) return 'high';
    return 'mid';
  }

  function floorBand(value) {
    const exact = exactFloor(value);
    return exact.floor ? numericFloorBand(exact.floor, exact.total) : explicitFloorBand(value);
  }

  function canonicalListingContext(value) {
    const input = value && typeof value === 'object' ? value : {};
    const info = input.listingInfo && typeof input.listingInfo === 'object'
      ? Object.assign({}, input.listingInfo, input)
      : input;
    const grouped = canonicalGroupedListing(info);
    const floorText = norm(info.floor || info.floorHint || info.floorInfo || grouped.floor);
    const parsedExact = exactFloor(floorText);
    const explicitKind = norm(info.floorKind || info.targetFloorKind).toLowerCase();
    const explicitValue = Number(info.floorValue || info.targetFloorValue || 0) || 0;
    const explicitBandValue = norm(info.floorBand || info.targetFloorBand).toLowerCase();
    const explicitTotal = Number(info.totalFloor || info.targetTotalFloor || 0) || 0;
    const parsedBand = floorBand(floorText);
    const floorKind = ['exact', 'band'].includes(explicitKind)
      ? explicitKind
      : (parsedExact.floor ? 'exact' : (parsedBand ? 'band' : ''));
    return {
      owner: safeId(info.ownerMarker || info.articleMarker || info.listingMarker || info.owner),
      building: normalizedBuilding(grouped.building),
      trade: normalizedContextToken(grouped.trade),
      price: normalizedContextToken(grouped.price),
      area: normalizedArea(grouped.area),
      floorKind,
      floorValue: floorKind === 'exact' ? (explicitValue || parsedExact.floor) : 0,
      floorBand: floorKind === 'band' ? (normalizedFloorBand(explicitBandValue) || parsedBand) : '',
      totalFloor: explicitTotal || parsedExact.total || totalFloor(floorText),
      direction: normalizedContextToken(grouped.direction)
    };
  }

  function normalizedFloorBand(value) {
    const token = norm(value).toLowerCase();
    if (['\uC800', 'low', 'lower'].includes(token)) return 'low';
    if (['\uC911', 'mid', 'middle'].includes(token)) return 'mid';
    if (['\uACE0', 'high', 'upper'].includes(token)) return 'high';
    return '';
  }

  function listingContextFingerprint(value) {
    const context = canonicalListingContext(value);
    const canonical = [
      context.owner,
      context.building,
      context.trade,
      context.price,
      context.area,
      context.floorKind,
      context.floorValue,
      context.floorBand,
      context.totalFloor,
      context.direction
    ].join('|');
    return `identity:${hashToken16(canonical)}`;
  }

  function groupedChildRetryHint(parentListingMarker, childValue) {
    const parentMarker = norm(parentListingMarker, 80).toLowerCase();
    if (!/^listing:[a-f0-9]{8,64}$/.test(parentMarker)) return '';
    const child = canonicalGroupedListing(childValue);
    if (!child.id) return '';
    const childKey = [
      parentMarker,
      child.id.toLowerCase(),
      normalizedBuilding(child.building),
      normalizedContextToken(child.trade),
      normalizedContextToken(child.price),
      normalizedArea(child.area),
      normalizedContextToken(child.floor),
      normalizedContextToken(child.direction)
    ].join('|');
    return `child:${hashToken16(childKey)}`;
  }

  function prioritizeGroupedChildRetry(entriesValue, parentListingMarker, hintValue) {
    const rows = Array.isArray(entriesValue) ? entriesValue.slice() : [];
    const hint = norm(hintValue, 40).toLowerCase();
    if (!/^child:[a-f0-9]{16}$/.test(hint)) {
      return { rows, matched: false, reason: 'invalid' };
    }
    const matchingIndexes = [];
    rows.forEach((entry, index) => {
      const child = entry && typeof entry === 'object' && entry.row ? entry.row : entry;
      if (groupedChildRetryHint(parentListingMarker, child) === hint) matchingIndexes.push(index);
    });
    if (!matchingIndexes.length) return { rows, matched: false, reason: 'not-found' };
    if (matchingIndexes.length !== 1) return { rows, matched: false, reason: 'ambiguous' };
    const matchIndex = matchingIndexes[0];
    return {
      rows: [rows[matchIndex], ...rows.slice(0, matchIndex), ...rows.slice(matchIndex + 1)],
      matched: true,
      reason: 'matched'
    };
  }

  function compareListingContexts(expectedValue, observedValue, options) {
    const config = options && typeof options === 'object' ? options : {};
    const expected = canonicalListingContext(expectedValue);
    const observed = canonicalListingContext(observedValue);
    const checkedFields = [];
    const missingFields = [];
    const mismatchFields = [];
    const compare = (field, expectedField, observedField) => {
      if (expectedField === '' || expectedField === 0) return;
      checkedFields.push(field);
      if (observedField === '' || observedField === 0) missingFields.push(field);
      else if (expectedField !== observedField) mismatchFields.push(field);
    };

    if (config.compareOwner !== false) compare('owner', expected.owner, observed.owner);
    compare('building', expected.building, observed.building);
    compare('trade', expected.trade, observed.trade);
    compare('price', expected.price, observed.price);
    compare('area', expected.area, observed.area);
    compare('direction', expected.direction, observed.direction);

    if (expected.floorKind) {
      checkedFields.push('floor-kind');
      if (!observed.floorKind) {
        missingFields.push('floor-kind');
      } else if (expected.floorKind === observed.floorKind) {
        if (expected.floorKind === 'exact') compare('floor-value', expected.floorValue, observed.floorValue);
        else compare('floor-band', expected.floorBand, observed.floorBand);
      } else if (expected.floorKind === 'band' && observed.floorKind === 'exact') {
        const observedBand = numericFloorBand(observed.floorValue, observed.totalFloor || expected.totalFloor);
        if (!expected.floorBand || observedBand !== expected.floorBand) mismatchFields.push('floor-kind');
      } else {
        mismatchFields.push('floor-kind');
      }
    }
    compare('total-floor', expected.totalFloor, observed.totalFloor);

    return {
      matched: missingFields.length === 0 && mismatchFields.length === 0,
      checkedFields,
      missingFields,
      mismatchFields,
      expectedFingerprint: listingContextFingerprint(expected),
      observedFingerprint: listingContextFingerprint(observed)
    };
  }

  function floorsCompatible(leftValue, rightValue) {
    const left = norm(leftValue);
    const right = norm(rightValue);
    if (!left || !right) return false;
    if (compact(left) === compact(right)) return true;
    const leftExact = exactFloor(left);
    const rightExact = exactFloor(right);
    const leftTotal = leftExact.total || totalFloor(left);
    const rightTotal = rightExact.total || totalFloor(right);
    if (leftTotal && rightTotal && leftTotal !== rightTotal) return false;
    if (leftExact.floor && rightExact.floor) return leftExact.floor === rightExact.floor;
    const leftBand = floorBand(left);
    const rightBand = floorBand(right);
    return Boolean(leftBand && rightBand && leftBand === rightBand);
  }

  function coreIdentityKey(item) {
    const required = [item.building, item.trade, item.price, item.area].map(compact);
    return required.every(Boolean) ? required.join('|') : '';
  }

  function identityKey(item) {
    const core = coreIdentityKey(item);
    const direction = compact(item.direction);
    return core && direction ? `${core}|${direction}` : '';
  }

  function ownershipAreaKey(item) {
    if (item.areaMeasures) return `measure:${item.areaMeasures}`;
    const area = compact(item.area);
    return area ? `name:${area}` : '';
  }

  function addressShapeKey(item) {
    const required = [item.building, item.trade, ownershipAreaKey(item)].map(compact);
    return required.every(Boolean) ? required.join('|') : '';
  }

  function priceCompatible(parent, child) {
    if (!compact(parent.price) || !compact(child.price)) return false;
    if (compact(parent.price) === compact(child.price)) return true;
    const parentParts = splitPrice(parent.price);
    const childParts = splitPrice(child.price);
    if ((parentParts.rent || childParts.rent) && compact(parentParts.rent) !== compact(childParts.rent)) return false;
    if (rangeContainsPrice(parent.minPrice, parent.maxPrice, childParts.deal)) return true;
    if (compact(parent.minPrice) || compact(parent.maxPrice)) return false;
    return rangeContainsPrice(child.minPrice, child.maxPrice, parentParts.deal);
  }

  function splitPrice(value) {
    const [deal = '', ...rent] = norm(value).split('/');
    return { deal: norm(deal), rent: norm(rent.join('/')) };
  }

  function moneyValue(value) {
    const text = compact(value).replace(/,/g, '');
    if (!text) return NaN;
    let remainder = text;
    let total = 0;
    let found = false;
    const eok = remainder.match(/(\d+(?:\.\d+)?)\uC5B5/);
    if (eok) {
      total += Number(eok[1]) * 100000000;
      remainder = remainder.replace(eok[0], '');
      found = true;
    }
    const man = remainder.match(/(\d+(?:\.\d+)?)\uB9CC/);
    if (man) {
      total += Number(man[1]) * 10000;
      remainder = remainder.replace(man[0], '');
      found = true;
    }
    const trailing = remainder.match(/\d+(?:\.\d+)?/);
    if (trailing) {
      total += Number(trailing[0]) * 10000;
      found = true;
    }
    return found && Number.isFinite(total) && total > 0 ? total : NaN;
  }

  function rangeContainsPrice(minValue, maxValue, targetValue) {
    const min = moneyValue(minValue);
    const max = moneyValue(maxValue);
    const target = moneyValue(targetValue);
    if (![min, max, target].every(Number.isFinite)) return false;
    return target >= Math.min(min, max) && target <= Math.max(min, max);
  }

  function areaMeasuresConflict(parent, child) {
    return Boolean(
      compact(parent.areaMeasures) &&
      compact(child.areaMeasures) &&
      compact(parent.areaMeasures) !== compact(child.areaMeasures)
    );
  }

  function exactOverridesHiddenBand(parent, child) {
    const parentExact = exactFloor(parent.floor);
    const childExact = exactFloor(child.floor);
    if (Boolean(parentExact.floor) === Boolean(childExact.floor)) return false;
    const exact = parentExact.floor ? parentExact : childExact;
    const hiddenFloor = parentExact.floor ? child.floor : parent.floor;
    return Boolean(
      identityKey(parent) && identityKey(parent) === identityKey(child) &&
      exact.total === 2 &&
      totalFloor(hiddenFloor) === 2 &&
      explicitFloorBand(hiddenFloor) === 'mid' &&
      parent.groupCount > 1 &&
      parent.groupCount === child.groupCount
    );
  }

  function siblingFloorsCompatible(parent, child) {
    return floorsCompatible(parent.floor, child.floor) || exactOverridesHiddenBand(parent, child);
  }

  function groupedListingCompatible(parentValue, childValue) {
    const parent = canonicalGroupedListing(parentValue);
    const child = canonicalGroupedListing(childValue);
    if (!parent.id || !child.id) return false;
    if (areaMeasuresConflict(parent, child)) return false;
    if (parent.id === child.id) return true;
    const parentIdentity = identityKey(parent);
    const childIdentity = identityKey(child);
    if (parentIdentity && parentIdentity === childIdentity && siblingFloorsCompatible(parent, child)) return true;
    if (parent.groupCount <= 1 && child.groupCount <= 1) return false;
    return Boolean(
      addressShapeKey(parent) &&
      addressShapeKey(parent) === addressShapeKey(child) &&
      priceCompatible(parent, child) &&
      floorsCompatible(parent.floor, child.floor)
    );
  }

  function groupedListingOwnershipScore(parentValue, childValue) {
    const parent = canonicalGroupedListing(parentValue);
    const child = canonicalGroupedListing(childValue);
    if (!groupedListingCompatible(parent, child)) return -1;
    if (parent.id === child.id) return 1000000;
    let score = 0;
    if (identityKey(parent) && identityKey(parent) === identityKey(child)) score += 100;
    if (compact(parent.area) && compact(parent.area) === compact(child.area)) score += 20;
    if (compact(parent.direction) && compact(parent.direction) === compact(child.direction)) score += 40;
    if (compact(parent.price) && compact(parent.price) === compact(child.price)) score += 20;
    if (compact(parent.floor) && compact(parent.floor) === compact(child.floor)) score += 20;
    else if (siblingFloorsCompatible(parent, child)) score += 10;
    if (parent.groupCount > 1 && parent.groupCount === child.groupCount) score += 5;
    return score;
  }

  function contextSignature(item) {
    return [
      item.building,
      item.trade,
      item.price,
      item.minPrice,
      item.maxPrice,
      item.area,
      item.areaMeasures,
      item.floor,
      item.direction
    ].map(compact).join('|');
  }

  function uniqueCanonicalRows(values) {
    const variants = new Map();
    for (const value of Array.isArray(values) ? values : []) {
      const item = canonicalGroupedListing(value);
      if (!item.id) continue;
      if (!variants.has(item.id)) variants.set(item.id, new Map());
      variants.get(item.id).set(contextSignature(item), item);
    }
    const rows = [];
    const conflicts = [];
    for (const [id, contexts] of variants.entries()) {
      const valuesForId = [...contexts.values()];
      if (valuesForId.length === 1) rows.push(valuesForId[0]);
      else conflicts.push(id);
    }
    rows.sort((left, right) => left.id.localeCompare(right.id));
    conflicts.sort();
    return { rows, conflicts };
  }

  function rankGroupedListingChildren(parentValue, childValues) {
    const parent = canonicalGroupedListing(parentValue);
    const children = uniqueCanonicalRows(childValues).rows;
    return children
      .map((child) => ({ id: child.id, score: groupedListingOwnershipScore(parent, child) }))
      .filter((item) => item.score >= 0 && item.id !== parent.id)
      .sort((left, right) => (right.score - left.score) || left.id.localeCompare(right.id));
  }

  function unassignedEntry(childId, reason, candidates = [], best = []) {
    return {
      childId,
      reason,
      compatibleParentCount: candidates.length,
      bestParentCount: best.length,
      bestScore: best.length ? best[0].score : -1
    };
  }

  function assignGroupedListingChildren(input) {
    const data = input && typeof input === 'object' ? input : {};
    const parentResult = uniqueCanonicalRows(data.parents);
    const childResult = uniqueCanonicalRows(data.children);
    const parents = parentResult.rows;
    const parentIds = new Set(parents.map((item) => item.id));
    const parentById = new Map(parents.map((item) => [item.id, item]));
    const childById = new Map(childResult.rows.map((item) => [item.id, item]));
    const ownerByChild = new Map();
    const claimsByParent = new Map(parents.map((item) => [item.id, []]));
    const unassigned = childResult.conflicts
      .filter((id) => !parentIds.has(id))
      .map((id) => unassignedEntry(id, 'conflicting-child-context'));

    for (const parent of parents) ownerByChild.set(parent.id, parent.id);
    for (const child of childResult.rows) {
      if (parentIds.has(child.id)) continue;
      const candidates = parents
        .map((parent) => ({ parentId: parent.id, score: groupedListingOwnershipScore(parent, child) }))
        .filter((item) => item.score >= 0)
        .sort((left, right) => (right.score - left.score) || left.parentId.localeCompare(right.parentId));
      if (!candidates.length) {
        unassigned.push(unassignedEntry(child.id, 'no-compatible-parent'));
        continue;
      }
      const bestScore = candidates[0].score;
      const best = candidates.filter((item) => item.score === bestScore);
      if (best.length !== 1) {
        unassigned.push(unassignedEntry(child.id, 'ambiguous-best-parent', candidates, best));
        continue;
      }
      claimsByParent.get(best[0].parentId).push({
        childId: child.id,
        score: bestScore,
        candidates,
        best
      });
    }

    const assignments = [];
    for (const parent of parents) {
      const expectedCount = Math.max(1, parent.groupCount);
      const slots = Math.max(0, expectedCount - 1);
      const claims = [...claimsByParent.get(parent.id)]
        .sort((left, right) => (right.score - left.score) || left.childId.localeCompare(right.childId));
      const accepted = [];
      const rejectionReasons = new Set();
      let remaining = slots;
      let cursor = 0;
      while (cursor < claims.length) {
        const score = claims[cursor].score;
        const group = [];
        while (cursor < claims.length && claims[cursor].score === score) {
          group.push(claims[cursor]);
          cursor += 1;
        }
        if (remaining >= group.length) {
          accepted.push(...group);
          remaining -= group.length;
          continue;
        }
        const reason = remaining > 0 ? 'over-capacity-tie' : 'capacity-exhausted';
        rejectionReasons.add(reason);
        for (const claim of group) {
          unassigned.push(unassignedEntry(claim.childId, reason, claim.candidates, claim.best));
        }
        remaining = 0;
      }
      for (const claim of accepted) ownerByChild.set(claim.childId, parent.id);
      const rejectedClaimCount = claims.length - accepted.length;
      assignments.push({
        parentId: parent.id,
        expectedCount,
        childIds: [parent.id, ...accepted.map((item) => item.childId).sort()],
        overCapacityClaimCount: rejectedClaimCount,
        overCapacityReason: rejectionReasons.has('over-capacity-tie')
          ? 'over-capacity-tie'
          : (rejectionReasons.has('capacity-exhausted') ? 'capacity-exhausted' : '')
      });
    }

    unassigned.sort((left, right) => left.childId.localeCompare(right.childId) || left.reason.localeCompare(right.reason));
    const ownerEntries = [...ownerByChild.entries()].sort((left, right) => left[0].localeCompare(right[0]));
    const assignedIds = new Set(assignments.flatMap((item) => item.childIds));
    const sharedChildTotal = [...assignedIds].filter((childId) => (
      assignments.filter((item) => item.childIds.includes(childId)).length > 1
    )).length;
    return {
      assignments,
      invalidParentIds: parentResult.conflicts,
      ownerByChild: Object.fromEntries(ownerEntries),
      unassigned,
      audit: {
        parentTotal: parents.length,
        childIdentityTotal: childById.size + childResult.conflicts.length,
        expectedTotal: assignments.reduce((sum, item) => sum + item.expectedCount, 0),
        assignedUniqueTotal: assignedIds.size,
        underfilledParentTotal: assignments.filter((item) => item.childIds.length < item.expectedCount).length,
        overfilledParentTotal: assignments.filter((item) => item.childIds.length > item.expectedCount).length,
        overCapacityParentTotal: assignments.filter((item) => item.overCapacityClaimCount > 0).length,
        sharedChildTotal,
        ambiguousChildTotal: unassigned.filter((item) => item.reason === 'ambiguous-best-parent').length,
        capacityRejectedTotal: unassigned.filter((item) => ['over-capacity-tie', 'capacity-exhausted'].includes(item.reason)).length,
        conflictingChildContextTotal: unassigned.filter((item) => item.reason === 'conflicting-child-context').length,
        missingContextChildTotal: unassigned.filter((item) => item.reason === 'no-compatible-parent').length,
        invalidParentTotal: parentResult.conflicts.length
      }
    };
  }

  function planGroupedListingChildren(parentValue, childValues, options) {
    const config = options && typeof options === 'object' ? options : {};
    const parent = canonicalGroupedListing(parentValue);
    const expectedCount = positiveInteger(config.expectedCount, parent.groupCount);
    const assignmentExpectedCount = expectedCount + (config.summaryParent === true ? 1 : 0);
    const plannedParent = Object.assign({}, parentValue || {}, { expectedCount: assignmentExpectedCount });
    const children = Array.isArray(childValues) ? childValues : [];
    const childContexts = uniqueCanonicalRows([plannedParent, ...children]);
    const decision = assignGroupedListingChildren({
      parents: [plannedParent],
      children: [plannedParent, ...children]
    });
    const assignment = decision.assignments.find((item) => item.parentId === parent.id);
    const acceptedIds = new Set((assignment?.childIds || []).filter((id) => id !== parent.id));
    const ranked = rankGroupedListingChildren(plannedParent, children)
      .filter((item) => acceptedIds.has(item.id));
    const reasons = new Set((decision.unassigned || []).map((item) => item.reason));
    if (childContexts.conflicts.length) reasons.add('conflicting-child-context');
    const reasonPriority = [
      'over-capacity-tie',
      'conflicting-child-context',
      'ambiguous-best-parent',
      'capacity-exhausted',
      'no-compatible-parent'
    ];
    return {
      ranked,
      reason: reasonPriority.find((reason) => reasons.has(reason)) || '',
      expectedCount,
      assignmentExpectedCount,
      audit: decision.audit
    };
  }

  function groupedResolutionProviderFamily(value) {
    const entry = value && typeof value === 'object' && value.row ? value.row : value;
    const input = entry && typeof entry === 'object' ? entry : {};
    const info = input.listingInfo && typeof input.listingInfo === 'object'
      ? Object.assign({}, input.listingInfo, input)
      : input;
    const direct = norm(
      info.providerFamilyHint
      || info.providerFamily
      || info.targetContext?.providerFamilyHint
    ).toLowerCase();
    const known = new Set([
      'mk', 'r114', 'gongsilclub', 'homesdid', 'serve', 'rfine', 'rter', 'asil',
      'hankyung', 'daara', 'neonet', 'ten', 'kar', 'thebiz', 'woori', 'kiso'
    ]);
    if (known.has(direct)) return direct;
    const text = norm([info.cpName, info.providerName, info.provider, direct].filter(Boolean).join(' '));
    const patterns = [
      ['mk', /\uB9E4\uACBD\uBD80\uB3D9\uC0B0|\b(?:bizmk|mk)\b/i],
      ['r114', /\br114\b/i],
      ['serve', /\uBD80\uB3D9\uC0B0\uC368\uBE0C|\bserve\b/i],
      ['rfine', /\uBD80\uB3D9\uC0B0\uD3EC\uC2A4|\br-?fine\b/i],
      ['neonet', /\uBD80\uB3D9\uC0B0(?:\uBC45\uD06C|\uB145\uD06C)|\uB124\uC624\uB137|\bneonet\b/i],
      ['asil', /\uC544\uC2E4|\basil\b/i],
      ['rter', /\b(?:rter|rego|rets)\b/i],
      ['hankyung', /\uD55C\uACBD|\bhankyung\b/i],
      ['kar', /\uD55C\uBC29|\uD55C\uAD6D\uACF5\uC778\uC911\uAC1C\uC0AC\uD611\uD68C|\bkar\b|karhanbang/i]
    ];
    return patterns.find((item) => item[1].test(text))?.[0] || '';
  }

  function groupedResolutionAttemptPriority(value) {
    const row = value && typeof value === 'object' && value.row ? value.row : value;
    const family = groupedResolutionProviderFamily(row);
    const grouped = canonicalGroupedListing(row);
    const exactFloorBonus = exactFloor(grouped.floor).floor > 0 ? 20 : 0;
    if (family === 'mk') return 1000 + exactFloorBonus;
    return (family ? 100 : 0) + exactFloorBonus;
  }

  function groupedResolutionEquivalenceKey(value) {
    const row = value && typeof value === 'object' && value.row ? value.row : value;
    const family = groupedResolutionProviderFamily(row);
    const grouped = canonicalGroupedListing(row);
    if (!family || !grouped.id) return `unique:${grouped.id}`;
    return [
      family,
      normalizedBuilding(grouped.building),
      normalizedContextToken(grouped.trade),
      normalizedContextToken(grouped.price),
      normalizedArea(grouped.area),
      normalizedContextToken(grouped.areaMeasures),
      normalizedContextToken(grouped.floor),
      normalizedContextToken(grouped.direction)
    ].join('|');
  }

  function planGroupedListingResolutionAttempts(entriesValue, options) {
    const config = options && typeof options === 'object' ? options : {};
    const preferredId = safeId(config.preferredId);
    const entries = (Array.isArray(entriesValue) ? entriesValue : [])
      .map((entry, index) => {
        const row = entry && typeof entry === 'object' && entry.row ? entry.row : entry;
        const id = safeId(entry?.id || canonicalGroupedListing(row).id);
        return Object.assign({}, entry, {
          id,
          equivalentCount: 1,
          resolutionPriority: groupedResolutionAttemptPriority(row),
          _resolutionOriginalIndex: index,
          _resolutionEquivalenceKey: groupedResolutionEquivalenceKey(row)
        });
      })
      .filter((entry) => entry.id)
      .sort((left, right) => (
        Number(right.id === preferredId) - Number(left.id === preferredId)
        || right.resolutionPriority - left.resolutionPriority
        || Number(right.score || 0) - Number(left.score || 0)
        || left.id.localeCompare(right.id)
        || left._resolutionOriginalIndex - right._resolutionOriginalIndex
      ));
    const planned = [];
    const plannedIndexByKey = new Map();
    for (const entry of entries) {
      const key = entry._resolutionEquivalenceKey;
      if (key && plannedIndexByKey.has(key)) {
        const index = plannedIndexByKey.get(key);
        planned[index] = Object.assign({}, planned[index], {
          equivalentCount: planned[index].equivalentCount + 1
        });
        continue;
      }
      if (key) plannedIndexByKey.set(key, planned.length);
      const clean = Object.assign({}, entry);
      delete clean._resolutionOriginalIndex;
      delete clean._resolutionEquivalenceKey;
      planned.push(clean);
    }
    return {
      rows: planned,
      originalCount: entries.length,
      skippedEquivalentCount: Math.max(0, entries.length - planned.length)
    };
  }

  function dongHoValues(value) {
    const values = [];
    const text = norm(value);
    const remainder = text.replace(/(\d{1,4})\s*\uB3D9\s*(\d{1,4})\s*\uD638/g, (_match, dong, ho) => {
      values.push(`${dong}\uB3D9 ${ho}\uD638`);
      return ' ';
    });
    remainder.replace(/(\d{1,4})\s*\uD638/g, (_match, ho) => {
      values.push(`${ho}\uD638`);
      return ' ';
    });
    return values;
  }

  function resolutionStatus(value) {
    return norm(value && (value.dongHoStatus || value.status));
  }

  function resolutionDisplay(value) {
    return norm(value && (value.dongHo || value.display || value.exact));
  }

  function resolutionDong(value) {
    const explicit = norm(value && (value.dong || value.targetDong)).match(/\d{1,4}/);
    if (explicit) return String(Number(explicit[0]) || explicit[0]);
    const dongs = [];
    resolutionDisplay(value).replace(/(\d{1,4})\s*\uB3D9\s*\d{1,4}\s*\uD638/g, (_match, dong) => {
      dongs.push(String(Number(dong) || dong));
      return '';
    });
    const unique = [...new Set(dongs)];
    return unique.length === 1 ? unique[0] : '';
  }

  function commonResolutionDong(values) {
    const evidence = (Array.isArray(values) ? values : [])
      .filter((item) => dongHoValues(resolutionDisplay(item)).length > 0);
    if (!evidence.length) return '';
    const dongs = evidence.map(resolutionDong);
    if (dongs.some((dong) => !dong)) return '';
    const unique = [...new Set(dongs)];
    return unique.length === 1 ? unique[0] : '';
  }

  function resolutionSignature(value) {
    return [
      resolutionStatus(value),
      resolutionDisplay(value),
      norm(value && (value.dongHoSource || value.source)),
      norm(value && value.qualityRejectedReason),
      stableResolutionValue(value)
    ].join('|');
  }

  function stableResolutionValue(value, depth = 0) {
    if (depth > 4 || value === null || value === undefined) return '';
    if (Array.isArray(value)) {
      return value.map((item) => stableResolutionValue(item, depth + 1)).sort().join(',');
    }
    if (typeof value === 'object') {
      return Object.keys(value).sort().map((key) => (
        `${key}:${stableResolutionValue(value[key], depth + 1)}`
      )).join(';');
    }
    return norm(value);
  }

  function multipleCandidateResolution(values, reason, count, dong) {
    return Object.assign({
      dongHoStatus: 'multiple-candidates',
      dongHo: `\uD6C4\uBCF4: ${values.join(' / ')}`,
      candidateCount: values.length,
      dongHoSource: reason,
      dongHoHash: '',
      qualityRejectedReason: reason,
      groupChildEvidenceCount: count
    }, dong ? { dong } : {});
  }

  function exactResolutionHash(value) {
    const hash = norm(value && value.dongHoHash).toLowerCase();
    return /^[0-9a-f]{10,64}$/.test(hash) ? hash : '';
  }

  function normalizedRevalidationCandidates(values) {
    const resolutions = Array.isArray(values) ? values : [];
    const commonDong = commonResolutionDong(resolutions);
    const candidates = resolutions.flatMap((item) => dongHoValues(resolutionDisplay(item)));
    const normalized = candidates.map((candidate) => {
      const exact = candidate.match(/^(\d{1,4})\s*\uB3D9\s*(\d{1,4})\s*\uD638$/);
      if (exact) return `${Number(exact[1]) || exact[1]}\uB3D9 ${Number(exact[2]) || exact[2]}\uD638`;
      const ho = candidate.match(/^(\d{1,4})\s*\uD638$/);
      if (ho && commonDong) return `${commonDong}\uB3D9 ${Number(ho[1]) || ho[1]}\uD638`;
      return candidate;
    });
    return {
      candidates: [...new Set(normalized)].sort(),
      commonDong
    };
  }

  function stabilizeGroupedExactRevalidation(firstValue, secondValue) {
    const first = firstValue && typeof firstValue === 'object' ? firstValue : {};
    const second = secondValue && typeof secondValue === 'object' ? secondValue : {};
    if (resolutionStatus(second) === 'cancelled') return Object.assign({}, second);

    const firstDisplay = resolutionDisplay(first);
    const secondDisplay = resolutionDisplay(second);
    const firstHash = exactResolutionHash(first);
    const secondHash = exactResolutionHash(second);
    const bothHashesPresent = Boolean(firstHash && secondHash);
    const hashMatches = bothHashesPresent && firstHash === secondHash;
    const displayMatches = Boolean(firstDisplay && secondDisplay && compact(firstDisplay) === compact(secondDisplay));
    const secondIsExact = resolutionStatus(second) === 'exact' && secondDisplay;
    const exactObservationMatches = firstDisplay
      ? displayMatches && (!bothHashesPresent || hashMatches)
      : hashMatches;
    if (secondIsExact && exactObservationMatches) {
      return Object.assign({}, second, {
        dongHoStatus: 'exact',
        dongHo: secondDisplay,
        dongHoHash: secondHash || firstHash,
        qualityRejectedReason: '',
        groupedExactStable: true,
        groupedExactObservationCount: 2,
        groupedExactRevalidationReason: 'matched'
      });
    }

    if (firstDisplay && displayMatches && bothHashesPresent && !hashMatches) {
      return Object.assign({}, second, {
        dongHoStatus: 'unresolved',
        dongHo: '',
        candidateCount: 0,
        dongHoHash: '',
        qualityRejectedReason: 'grouped-exact-revalidation-conflict',
        groupedExactStable: false,
        groupedExactObservationCount: 2,
        groupedExactRevalidationReason: 'grouped-exact-revalidation-conflict'
      });
    }

    if (!firstDisplay && firstHash && secondIsExact) {
      return Object.assign({}, second, {
        dongHoStatus: 'unresolved',
        dongHo: '',
        candidateCount: 0,
        dongHoHash: '',
        qualityRejectedReason: 'grouped-exact-revalidation-conflict',
        groupedExactStable: false,
        groupedExactObservationCount: 2,
        groupedExactRevalidationReason: 'grouped-exact-revalidation-conflict'
      });
    }

    const reason = secondIsExact
      ? 'grouped-exact-revalidation-conflict'
      : 'grouped-exact-revalidation-downgraded';
    const normalized = normalizedRevalidationCandidates([first, second]);
    if (normalized.candidates.length) {
      return Object.assign(
        multipleCandidateResolution(normalized.candidates, reason, 2, normalized.commonDong),
        {
          groupedExactStable: false,
          groupedExactObservationCount: 2,
          groupedExactRevalidationReason: reason
        }
      );
    }
    return Object.assign({}, second, {
      dongHoStatus: resolutionStatus(second) === 'cancelled' ? 'cancelled' : 'unresolved',
      dongHo: resolutionStatus(second) === 'cancelled' ? '' : resolutionDisplay(second),
      dongHoHash: '',
      qualityRejectedReason: reason,
      groupedExactStable: false,
      groupedExactObservationCount: 2,
      groupedExactRevalidationReason: reason
    });
  }

  function mergeGroupedChildResolutions(values) {
    const resolutions = (Array.isArray(values) ? values : [])
      .filter((item) => item && typeof item === 'object')
      .slice()
      .sort((left, right) => resolutionSignature(left).localeCompare(resolutionSignature(right)));
    const exacts = resolutions.filter((item) => resolutionStatus(item) === 'exact' && resolutionDisplay(item));
    const exactValues = [...new Set(exacts.map(resolutionDisplay))].sort();
    if (exactValues.length > 1) {
      return multipleCandidateResolution(
        exactValues,
        'group-child-exact-conflict',
        exacts.length,
        commonResolutionDong(exacts)
      );
    }
    if (exactValues.length === 1) {
      const base = exacts.find((item) => resolutionDisplay(item) === exactValues[0]);
      return Object.assign({}, base, {
        dongHoStatus: 'exact',
        dongHo: exactValues[0],
        groupChildEvidenceCount: exacts.length
      });
    }
    const candidates = [...new Set(resolutions.flatMap((item) => dongHoValues(resolutionDisplay(item))))].sort();
    if (candidates.length) {
      return multipleCandidateResolution(
        candidates,
        'group-child-candidates',
        resolutions.length,
        commonResolutionDong(resolutions)
      );
    }
    if (!resolutions.length) {
      return {
        dongHoStatus: 'unresolved',
        dongHo: '',
        dongHoSource: 'group-child-empty',
        dongHoHash: '',
        groupChildEvidenceCount: 0
      };
    }
    return Object.assign({}, resolutions[0], { groupChildEvidenceCount: resolutions.length });
  }

  function groupedChildCoverageCount(value) {
    const number = Math.floor(Number(value) || 0);
    return Math.min(999, Math.max(0, number));
  }

  function groupedChildPlanReason(value) {
    const reason = norm(value).toLowerCase();
    return [
      'over-capacity-tie',
      'conflicting-child-context',
      'ambiguous-best-parent',
      'capacity-exhausted',
      'no-compatible-parent',
      'module-missing',
      'missing'
    ].includes(reason) ? reason : '';
  }

  function withGroupedChildCoverage(value, coverageValue) {
    const resolution = value && typeof value === 'object' ? value : {};
    const coverage = coverageValue && typeof coverageValue === 'object' ? coverageValue : {};
    const expectedCount = groupedChildCoverageCount(coverage.expectedCount);
    const plannedCount = groupedChildCoverageCount(coverage.plannedCount);
    const resolvedCount = groupedChildCoverageCount(coverage.resolvedCount);
    const observedCount = groupedChildCoverageCount(coverage.observedCount);
    const planReason = groupedChildPlanReason(coverage.planReason);
    const groupChildComplete = Boolean(
      expectedCount > 0
      && plannedCount >= expectedCount
      && resolvedCount >= plannedCount
    );
    const result = Object.assign({}, resolution, {
      groupChildExpectedCount: expectedCount,
      groupChildPlannedCount: plannedCount,
      groupChildResolvedCount: resolvedCount,
      groupChildComplete,
      groupChildObservedCount: observedCount,
      groupChildPlanReason: planReason
    });
    if (resolutionStatus(resolution) === 'multiple-candidates' && dongHoValues(resolutionDisplay(resolution)).length) {
      result.candidateComplete = groupChildComplete && resolution.candidateComplete !== false;
    }
    return result;
  }

  const api = {
    assignGroupedListingChildren,
    canonicalListingContext,
    canonicalGroupedListing,
    compareListingContexts,
    groupedChildRetryHint,
    groupedListingCompatible,
    groupedListingOwnershipScore,
    listingContextFingerprint,
    mergeGroupedChildResolutions,
    planGroupedListingResolutionAttempts,
    planGroupedListingChildren,
    prioritizeGroupedChildRetry,
    rankGroupedListingChildren,
    stabilizeGroupedExactRevalidation,
    withGroupedChildCoverage
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }
  globalScope.DHS_GROUPED_LISTING = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
