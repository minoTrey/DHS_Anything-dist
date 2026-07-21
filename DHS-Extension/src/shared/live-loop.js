(function exposeLiveLoop(globalScope) {
  const DEFAULT_PROVIDER_SETTLE_MS = 2500;
  const ACTIVE_PROVIDER_STATUSES = new Set([
    'opening',
    'direct-lookup',
    'clicked',
    'trusted-clicked',
    'background-tab'
  ]);

  function candidateSearchPendingReasons(input) {
    const state = input && typeof input === 'object' ? input : {};
    const reasons = [];
    if (state.candidateComplete !== true) reasons.push('candidate-incomplete');
    if (state.candidateHasEvidence !== true) reasons.push('candidate-no-evidence');
    if (state.providerDirectLookupStatus === 'running') reasons.push('provider-direct-lookup');
    if (state.providerRouteLookupRunning === true) reasons.push('provider-route-lookup');
    if (Number(state.providerRouteLookupPendingCount || 0) > 0) reasons.push('provider-route-queue');
    if (state.groupRouteFetchPending === true) reasons.push('group-route-fetch');
    if (String(state.groupRouteStatus || '') === 'validating') reasons.push('group-route-validation');
    if (state.providerEvidenceTempPendingActive === true) reasons.push('provider-evidence-pending');
    if (String(state.providerRequestKey || '')) reasons.push('provider-request');
    if (ACTIVE_PROVIDER_STATUSES.has(String(state.providerOpenStatus || ''))) reasons.push('provider-open');
    if (state.autoLoopTimerActive === true) reasons.push('auto-loop-timer');
    if (state.lineMapRecoveryPending === true) reasons.push('line-map-recovery');

    const status = String(state.autoLoopStatus || '');
    const action = String(state.autoLoopAction || '');
    const terminal = (status === 'done' && action === 'record-result')
      || (['terminal', 'exhausted'].includes(status) && action === 'record-no-result');
    if (!terminal) reasons.push('automation-active');
    return reasons;
  }

  function candidateSearchSettled(input) {
    return candidateSearchPendingReasons(input).length === 0;
  }

  function candidateCompletionDecision(input) {
    const state = input && typeof input === 'object' ? input : {};
    const pendingReasons = candidateSearchPendingReasons(state);
    if (state.candidateComplete !== true || state.candidateHasEvidence !== true) {
      return {
        complete: false,
        reason: 'candidate-incomplete',
        pendingReasons
      };
    }

    const stableMs = Math.max(0, Number(state.stableMs || 0) || 0);
    const minStableMs = Math.max(0, Number(state.minStableMs || 1000) || 1000);
    const followupBudgetMs = Math.max(
      minStableMs,
      Number(state.followupBudgetMs || 3500) || 3500
    );
    if (stableMs < minStableMs) {
      return {
        complete: false,
        reason: 'candidate-unstable',
        pendingReasons
      };
    }
    if (pendingReasons.length === 0) {
      return {
        complete: true,
        reason: 'settled',
        pendingReasons: []
      };
    }
    if (stableMs >= followupBudgetMs) {
      return {
        complete: true,
        reason: 'followup-budget-exhausted',
        pendingReasons
      };
    }
    return {
      complete: false,
      reason: 'strong-proof-pending',
      pendingReasons
    };
  }

  function classifyLiveProbe(input) {
    const state = input && typeof input === 'object' ? input : {};
    const lastStatus = Number(state.lastEvidenceStatus || 0);

    if (
      state.stop ||
      lastStatus === 429 ||
      (state.groupRouteStatus === 'blocked' && ['http-429', 'rate-limited', 'http-stop'].includes(state.groupRouteLastRejectReason))
    ) {
      return { status: 'blocked', reason: 'stop-condition' };
    }

    // Sticky confirmed-exact latch: once bridge locks a trusted single exact for the active
    // listing, stay `done` so probing stops and late signals cannot re-open it as `candidate`.
    if (
      state.confirmedExactMarker
      && state.confirmedExactDisplay
      && (!state.articleMarker || state.confirmedExactMarker === state.articleMarker)
    ) {
      return { status: 'done', reason: 'latched-confirmed-exact' };
    }

    const routeSearchIdleSec = Number(state.routeSearchIdleSec || 0);
    if (
      ['terminal', 'exhausted'].includes(state.autoLoopStatus) &&
      state.autoLoopAction === 'record-no-result' &&
      !nextProviderAttempt(state) &&
      !nextProviderGroupAttempt(state) &&
      !nextGroupRouteAttempt(state)
    ) {
      return { status: 'terminal', reason: state.autoLoopReason || 'previous-no-result' };
    }

    if (state.groupRouteStatus === 'fetching') {
      if (state.routeSearchStatus === 'expired' || routeSearchIdleSec >= 180) {
        return { status: 'advance', reason: 'route-expired-without-candidate' };
      }
      if (state.routeSearchStatus === 'stalled' || routeSearchIdleSec >= 60) {
        return { status: 'advance', reason: 'route-stalled-without-candidate' };
      }
      return { status: 'continue', reason: 'group-route-fetching' };
    }

    const hasProviderCandidate = Boolean(state.providerCandidatePresent && state.providerCandidateDisplay);
    const confirmedProviderCandidate = hasProviderCandidate
      && state.providerOpenStatus === 'captured'
      && !state.providerCandidateRejectedReason
      && String(state.resolverOutcome || '').startsWith('captured:');

    if (confirmedProviderCandidate) {
      return { status: 'done', reason: 'confirmed-provider-candidate' };
    }

    const confirmedGroupCandidate = Boolean(state.groupCandidatePresent && state.groupCandidateDisplay)
      && !state.groupCandidateRejectedReason
      && String(state.resolverOutcome || '').startsWith('captured-group:');

    if (confirmedGroupCandidate) {
      return { status: 'done', reason: 'confirmed-group-candidate' };
    }

    const acceptedLandLineSources = [
      'land-line-after-group',
      'land-line-after-provider-floor',
      'land-line-direct-ho-corroborated',
      'building-units-article-linked'
    ];
    const confirmedLandLineCandidate = Boolean(state.landLineCandidatePresent && state.landLineCandidateDisplay)
      && state.landLineCandidateCertainty === 'LAND_LINE'
      && acceptedLandLineSources.includes(state.landLineCandidateSource)
      && !state.landLineRejectedReason
      && acceptedLandLineSources.includes(String(state.resolverOutcome || ''));

    if (confirmedLandLineCandidate) {
      return { status: 'done', reason: 'confirmed-land-line-candidate' };
    }

    if (hasProviderCandidate) {
      return { status: 'continue', reason: 'provider-candidate-needs-guard' };
    }

    if (state.lineInferenceStatus === 'single-estimated' && state.lineInferenceDisplay) {
      return { status: 'candidate', reason: 'single-estimated-line-inference' };
    }

    if (['multiple-candidates', 'line-only'].includes(state.lineInferenceStatus)) {
      if (state.routeSearchStatus === 'expired' || routeSearchIdleSec >= 180) {
        return { status: 'advance', reason: 'route-expired-without-candidate' };
      }
      if (state.routeSearchStatus === 'stalled' || routeSearchIdleSec >= 60) {
        return { status: 'advance', reason: 'route-stalled-without-candidate' };
      }
      return { status: 'candidate', reason: state.lineInferenceStatus };
    }

    if (state.routeSearchStatus === 'expired' || routeSearchIdleSec >= 180) {
      return { status: 'advance', reason: 'route-expired-without-candidate' };
    }

    if (state.routeSearchStatus === 'stalled' || routeSearchIdleSec >= 60) {
      return { status: 'advance', reason: 'route-stalled-without-candidate' };
    }

    if (state.articlePresent || state.detailContextPresent) {
      return { status: 'continue', reason: 'selected-listing-active' };
    }

    return { status: 'continue', reason: 'waiting-for-selected-listing' };
  }

  function nextLiveActions(result) {
    const status = result && result.status;
    if (status === 'done') return ['capture-screen', 'record-result'];
    if (status === 'candidate') return ['capture-screen', 'probe-overlay', 'continue-source-search'];
    if (status === 'blocked') return ['record-blocker'];
    if (status === 'terminal' || status === 'exhausted') return ['record-no-result'];
    if (status === 'advance') return ['run-tests', 'reload-extension', 'reload-page', 'capture-screen', 'probe-overlay'];
    return ['probe-overlay', 'wait-for-signals'];
  }

  function selectedListingActive(state) {
    const input = state || {};
    // Investigate only when a specific listing's real detail panel is open (user opened a
    // grouped child or a non-grouped listing), or during region extraction. Never on a bare
    // group-parent selection, and nothing is auto-selected.
    return Boolean(input.detailPanelPresent)
      || ['preparing', 'running', 'saving'].includes(input.regionExportStatus);
  }

  function safeArticleMarker(value) {
    const marker = String(value || '');
    return /^article:[a-f0-9]{8,12}$/.test(marker) ? marker : 'article:unknown';
  }

  function providerTargetCount(state) {
    const input = state || {};
    const count = Number(input.cpProviderClickTargetCount || input.cpProviderAttemptCount || 0);
    return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  }

  function providerTargetPhase(state) {
    const phase = String(state && state.cpProviderClickTargetPhase || '');
    return phase === 'direct-provider' || phase === 'group-target' ? phase : '';
  }

  function providerGroupTargetCount(state) {
    const input = state || {};
    const count = Number(input.cpProviderGroupTargetCount || 0);
    return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  }

  function hasDirectProviderTarget(state) {
    return providerTargetPhase(state) === 'direct-provider' && providerTargetCount(state) > 0;
  }

  function routeSearchExpired(state) {
    return Boolean(state && (state.routeSearchStatus === 'expired' || Number(state.routeSearchIdleSec || 0) >= 180));
  }

  function providerActionKey(state, index, count, phase) {
    return [
      safeArticleMarker(state && state.articleMarker),
      phase || providerTargetPhase(state) || 'provider-target',
      `${Number(index || 0)}/${Number(count || 0)}`
    ].join('|');
  }

  function attemptedKeys(state) {
    return new Set(Array.isArray(state && state.autoLoopAttemptedKeys)
      ? state.autoLoopAttemptedKeys.map((item) => String(item || '')).filter(Boolean)
      : []);
  }

  function nextProviderAttempt(state) {
    const input = state || {};
    const phase = providerTargetPhase(input);
    const count = providerTargetCount(input);
    if (!phase || count < 1) return null;
    const attempted = attemptedKeys(input);
    const start = Math.max(0, Math.floor(Number(input.cpProviderAttemptIndex || 0))) % count;
    for (let offset = 0; offset < count; offset += 1) {
      const index = phase === 'direct-provider' ? (start + offset) % count : 0;
      const actionKey = providerActionKey(input, index, count, phase);
      if (!attempted.has(actionKey)) {
        return {
          actionKey,
          targetIndex: index,
          targetCount: count,
          targetPhase: phase
        };
      }
      if (phase !== 'direct-provider') break;
    }
    return null;
  }

  function hasAttemptedGroupTarget(state) {
    const attempted = attemptedKeys(state);
    for (const key of attempted) {
      if (key.includes('|group-target|')) return true;
    }
    return false;
  }

  function hasLineMapRouteEndpointEvidence(state) {
    const endpoints = state && typeof state.lineMapRouteByEndpoint === 'object'
      ? state.lineMapRouteByEndpoint
      : {};
    return Object.values(endpoints).some((endpoint) => {
      const input = endpoint && typeof endpoint === 'object' ? endpoint : {};
      return Boolean(
        input.event ||
        Number(input.status || 0) > 0 ||
        input.reason ||
        Number(input.rowCount || 0) > 0 ||
        Number(input.durationMs || 0) > 0
      );
    });
  }

  function nextProviderGroupAttempt(state) {
    const count = providerGroupTargetCount(state);
    if (count < 1) return null;
    const attempted = attemptedKeys(state);
    const start = Math.max(0, Math.floor(Number(state && state.cpProviderGroupAttemptIndex || 0))) % count;
    for (let offset = 0; offset < count; offset += 1) {
      const index = (start + offset) % count;
      const actionKey = providerActionKey(state, index, count, 'group-target');
      if (!attempted.has(actionKey)) {
        return {
          actionKey,
          targetIndex: index,
          targetCount: count,
          targetPhase: 'group-target'
        };
      }
    }
    return null;
  }

  function hasPendingGroupRouteEvidence(state) {
    const input = state || {};
    if (Array.isArray(input.groupRouteTargets) && input.groupRouteTargets.length > 0) return true;
    if (
      Array.isArray(input.groupRouteTargets) &&
      input.groupRouteTargets.length === 0 &&
      Number(input.groupRouteProgressSeq || 0) > 0 &&
      ['exhausted', 'rejected'].includes(String(input.groupRouteStatus || ''))
    ) {
      return true;
    }
    if (
      input.sameAddressEvidenceSeen ||
      input.representativeEvidenceSeen ||
      input.complexListEvidenceSeen ||
      input.complexCacheEvidenceSeen ||
      hasLineMapRouteEndpointEvidence(input) ||
      Number(input.groupCandidateCount || 0) > 0
    ) {
      return true;
    }

    const category = String(input.lastEvidenceCategory || '');
    if (['sameAddress', 'representativeArticles', 'complexList', 'complexCache'].includes(category)) {
      return true;
    }

    const branch = String(input.resolverBranch || '');
    if (['sameAddress', 'representative-main', 'representative-main-1', 'complex-list', 'complex-cache'].includes(branch)) {
      return true;
    }

    const counts = input.networkCategoryCounts && typeof input.networkCategoryCounts === 'object'
      ? input.networkCategoryCounts
      : {};
    return ['sameAddress', 'representativeArticles', 'complexList', 'complexCache']
      .some((key) => Number(counts[key] || 0) > 0);
  }

  function baseDecision(status, action, reason) {
    return {
      status,
      action,
      reason,
      actionKey: '',
      targetIndex: 0,
      targetCount: 0,
      targetPhase: ''
    };
  }

  function openingDecision(reason, attempt) {
    return Object.assign(baseDecision('opening', 'open-provider-target', reason), attempt);
  }

  function groupRouteDecision(reason, attempt) {
    return Object.assign(baseDecision('opening', 'scan-group-route', reason), attempt);
  }

  function nextGroupRouteAttempt(state) {
    const input = state || {};
    const attempted = attemptedKeys(input);
    const targets = Array.isArray(input.groupRouteTargets) ? input.groupRouteTargets : [];
    for (const target of targets) {
      const actionKey = String(target && target.actionKey || '');
      if (!actionKey || attempted.has(actionKey)) continue;
      const route = String(target.targetRoute || '');
      if (!route) continue;
      return {
        actionKey,
        targetIndex: Number(target.targetIndex || 0),
        targetCount: Number(target.targetCount || targets.length || 0),
        targetPhase: 'group-route',
        targetRoute: route
      };
    }
    return null;
  }

  function groupRouteFollowupDecision(state) {
    if (!hasPendingGroupRouteEvidence(state)) return null;
    const groupAttempt = nextGroupRouteAttempt(state);
    if (groupAttempt) return groupRouteDecision('group-route-ready', groupAttempt);
    if (Array.isArray(state && state.groupRouteTargets)) {
      return baseDecision('exhausted', 'record-no-result', 'group-routes-exhausted');
    }
    return baseDecision('waiting', 'wait', 'searching-group-routes');
  }

  function stickyTerminalDecision(state) {
    const status = String(state && state.autoLoopStatus || '');
    if (!['terminal', 'exhausted'].includes(status)) return null;
    if (String(state && state.autoLoopAction || '') !== 'record-no-result') return null;
    const terminalMarker = String(state && state.autoLoopArticleMarker || '');
    const currentMarker = String(state && state.articleMarker || '');
    if (terminalMarker && currentMarker && terminalMarker !== currentMarker) return null;
    if (nextProviderAttempt(state) || nextProviderGroupAttempt(state) || nextGroupRouteAttempt(state)) return null;
    return baseDecision(status, 'record-no-result', state.autoLoopReason || 'previous-no-result');
  }

  function planLiveAutomation(input, options) {
    const state = input && typeof input === 'object' ? input : {};
    const config = options || {};
    const nowMs = Number(config.nowMs || 0);
    const providerSettleMs = Number(config.providerSettleMs || DEFAULT_PROVIDER_SETTLE_MS);
    const directProviderTargetAvailable = hasDirectProviderTarget(state);
    const lastActionAt = Number(state.autoLoopLastActionAt || 0);
    const providerStatus = String(state.providerOpenStatus || '');
    const recentlyOpened = lastActionAt > 0 && nowMs > 0 && nowMs - lastActionAt < providerSettleMs;
    const providerOpeningWithoutReject = ['opening', 'direct-lookup', 'clicked', 'trusted-clicked'].includes(providerStatus)
      && !state.providerCandidateRejectedReason;
    const probe = classifyLiveProbe(state);
    const targetCount = providerTargetCount(state);
    const currentProviderAttempt = nextProviderAttempt(state);
    const currentGroupTargetAttempt = nextProviderGroupAttempt(state);
    const providerActionAvailable = Boolean(currentProviderAttempt || currentGroupTargetAttempt);
    // The line map is the primary evidence source and also produces provider/group route targets.
    // Concluding "record-no-result" before it lands is a premature terminal: it freezes the elapsed
    // clock and lets weak line-inference candidates surface as if final, then flips when the real
    // capture arrives. While the map is still being fetched (and the route search has not genuinely
    // expired), keep waiting instead of giving up.
    const lineMapStillArriving = state.lineMapRecoveryPending === true && !routeSearchExpired(state);
    const giveUpDecision = (reason) => (
      lineMapStillArriving
        ? baseDecision('waiting', 'wait', 'line-map-recovery-pending')
        : baseDecision('exhausted', 'record-no-result', reason)
    );

    if (probe.status === 'done') return baseDecision('done', 'record-result', probe.reason);
    if (probe.status === 'blocked' && !directProviderTargetAvailable) return baseDecision('blocked', 'record-blocker', probe.reason);
    if (!selectedListingActive(state)) return baseDecision('waiting', 'wait', 'waiting-for-selected-listing');
    const stickyTerminal = stickyTerminalDecision(state);
    if (stickyTerminal) return stickyTerminal;
    const pendingGroupFollowup = groupRouteFollowupDecision(state);
    if (
      pendingGroupFollowup &&
      pendingGroupFollowup.action === 'scan-group-route' &&
      !(providerOpeningWithoutReject && recentlyOpened)
    ) {
      return pendingGroupFollowup;
    }
    if (
      currentGroupTargetAttempt &&
      !currentProviderAttempt &&
      (!pendingGroupFollowup || pendingGroupFollowup.action !== 'scan-group-route')
    ) {
      return openingDecision('provider-group-target-ready', currentGroupTargetAttempt);
    }
    if (routeSearchExpired(state) && !providerActionAvailable) return baseDecision('terminal', 'record-no-result', 'route-expired-without-candidate');
    if (
      probe.status === 'advance' &&
      probe.reason === 'route-stalled-without-candidate' &&
      targetCount < 1 &&
      providerGroupTargetCount(state) < 1 &&
      (
        !hasPendingGroupRouteEvidence(state) ||
        (Array.isArray(state.groupRouteTargets) && state.groupRouteTargets.length < 1)
      )
    ) {
      return baseDecision('terminal', 'record-no-result', 'route-stalled-without-candidate');
    }

    if (targetCount < 1) {
      const groupFollowup = pendingGroupFollowup || groupRouteFollowupDecision(state);
      if (groupFollowup) return groupFollowup;
      if (hasAttemptedGroupTarget(state)) {
        if (providerOpeningWithoutReject && recentlyOpened) {
          return baseDecision('waiting', 'wait', 'waiting-for-group-expansion');
        }
        return giveUpDecision('group-expansion-no-target');
      }
      if (providerOpeningWithoutReject && recentlyOpened) {
        return baseDecision('waiting', 'wait', 'waiting-for-group-expansion');
      }
      return baseDecision('waiting', 'wait', 'searching-group-routes');
    }

    if (providerOpeningWithoutReject && recentlyOpened) {
      return baseDecision('waiting', 'wait', 'provider-candidate-pending');
    }

    const attempt = currentProviderAttempt;
    if (!attempt) {
      if (providerTargetPhase(state) === 'group-target' && hasAttemptedGroupTarget(state)) {
        const groupFollowup = groupRouteFollowupDecision(state);
        if (groupFollowup) return groupFollowup;
        if (providerOpeningWithoutReject && recentlyOpened) {
          return baseDecision('waiting', 'wait', 'waiting-for-group-expansion');
        }
        return giveUpDecision('group-expansion-no-target');
      }
      const groupTargetAttempt = providerTargetPhase(state) === 'direct-provider'
        ? currentGroupTargetAttempt
        : null;
      if (groupTargetAttempt) return openingDecision('provider-group-target-ready', groupTargetAttempt);
      const groupFollowup = groupRouteFollowupDecision(state);
      if (groupFollowup) return groupFollowup;
      return giveUpDecision('provider-targets-exhausted');
    }

    const rejected = Boolean(state.providerCandidateRejectedReason || providerStatus === 'mismatch');
    return openingDecision(rejected ? 'rejected-provider-advance' : 'provider-target-ready', attempt);
  }

  const api = {
    candidateCompletionDecision,
    candidateSearchPendingReasons,
    candidateSearchSettled,
    classifyLiveProbe,
    nextLiveActions,
    planLiveAutomation,
    providerActionKey
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }

  globalScope.DHS_LIVE_LOOP = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
