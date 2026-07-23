(function installDhsAnythingBridge() {
  const VERSION = '0.6.277';
  const BRIDGE_SOURCE = 'DHS_ANYTHING_CHROME_BRIDGE';
  const PAGE_SOURCE = 'DHS_ANYTHING_CHROME_PAGE';
  const PAGE_EVENT = 'DHS_ANYTHING_CHROME_PAGE_EVENT';
  const PAGE_GROUP_ROUTE_REQUEST = 'DHS_ANYTHING_CHROME_ACTIVE_GROUP_ROUTE_REQUEST';
  const OVERLAY_ID = 'dhs-anything-diagnostic-overlay';
  const AUTO_LOOP_DELAY_MS = 250;
  const DEFAULT_SCAN_DELAY_MS = 120;
  const USER_INTERACTION_SCAN_DELAY_MS = 80;
  const DOM_MUTATION_SCAN_DELAY_MS = 360;
  const PROVIDER_DISCOVERY_GRACE_SEC = 3;
  const PROVIDER_DIRECT_LOOKUP_FAST_FALLBACK_MS = 900;
  // A provider direct-lookup that fails for a TRANSIENT reason (rate limit, timeout, http 5xx, tab/
  // script infra hiccup) is retried a bounded number of times before falling back. Without it, one
  // transient miss drops the listing from a single exact to the weaker line-inference multi-candidate
  // fallback, so the same listing resolves differently per run. The predicate + ceiling live in a
  // pure, unit-tested module (the capture path itself is not CDP-drivable, so its logic is pinned there).
  const PROVIDER_TRANSIENT = (typeof window !== 'undefined' && window.DHS_PROVIDER_TRANSIENT) || {
    PROVIDER_DIRECT_LOOKUP_MAX_RETRY: 2,
    isTransientProviderLookupFailure: function () { return false; }
  };
  const PROVIDER_DIRECT_LOOKUP_MAX_RETRY = PROVIDER_TRANSIENT.PROVIDER_DIRECT_LOOKUP_MAX_RETRY;
  const isTransientProviderLookupFailure = PROVIDER_TRANSIENT.isTransientProviderLookupFailure;
  // Same-unit group inheritance decision (pure, unit-tested). Falls back to a no-inherit stub.
  const GROUP_INHERIT = (typeof window !== 'undefined' && window.DHS_GROUP_INHERIT) || {
    chooseInheritedExact: function () { return ''; }
  };
  const PROVIDER_ROUTE_LOOKUP_STALE_CLICK_RESUME_SEC = 8;
  const MAX_PROVIDER_GROUP_CONTEXT_LOOKUPS = 12;
  const ACTIVE_GROUP_ROUTE_MAX_BYTES = 1000000;
  const ACTIVE_GROUP_ROUTE_TIMEOUT_MS = 1500;
  const LINE_MAP_RECOVERY_RETRY_MS = 2 * 60 * 1000;
  const RECENT_LISTING_CLICK_TTL_MS = 300000;
  const RECENT_LISTING_TEXT_FALLBACK_MS = 3000;
  const EXPANDED_LISTING_CONTEXT_TTL_MS = 45000;
  const CDP_RESOLVER_FINAL_TTL_MS = 120000;
  const REGION_EXPORT_ROW_TIMEOUT_MS = 9000;
  const REGION_EXPORT_ROW_STRONG_LOOKUP_GRACE_MS = 3000;
  const REGION_EXPORT_PROVIDER_LOOKUP_BUDGET_MS = 3000;
  const REGION_EXPORT_CANDIDATE_STABLE_MS = 1000;
  const REGION_EXPORT_CANDIDATE_FOLLOWUP_MS = 3500;
  const REGION_EXPORT_ROW_SETTLE_MS = 500;
  const REGION_EXPORT_SCROLL_SETTLE_MS = 450;
  const REGION_EXPORT_MAX_SCROLL_ROUNDS = 80;
  const REGION_EXPORT_COMPLEX_SETTLE_MS = 650;
  const REGION_EXPORT_SELECTOR_SETTLE_MS = 180;
  const REGION_EXPORT_COMPLEX_SCROLL_SETTLE_MS = 350;
  const REGION_EXPORT_COMPLEX_MAX_SCROLL_ROUNDS = 80;
  const REGION_EXPORT_UNRESOLVED_LABEL = '\uBBF8\uD655\uC815';
  const REGION_EXPORT_CHECKPOINT_STORAGE_KEY = '__dhs_region_export_checkpoint_v1';
  const REGION_EXPORT_MARKER_NONCE_STORAGE_KEY = '__dhs_region_export_marker_nonce_v1';
  const REGION_EXPORT_CHECKPOINT_MAX_AGE_MS = 6 * 60 * 60 * 1000;
  const REGION_EXPORT_STORAGE_TIMEOUT_MS = 1500;
  const REGION_EXPORT_GROUPED_FRESH_EVIDENCE_TIMEOUT_MS = 2500;
  const REGION_EXPORT_BROWSER_LOCK_NAME = 'dhs-anything-region-export-v1';
  const REGION_EXPORT_SELECTION_LEVELS = Object.freeze(['sido', 'sigungu', 'dong']);
  const EXACT_EVIDENCE_RECEIPT_SOURCES = Object.freeze(['cdp', 'provider', 'group', 'line', 'official']);
  const REGION_EXPORT_CANDIDATE_BLOCKERS = Object.freeze([
    'candidate-incomplete',
    'candidate-no-evidence',
    'provider-direct-lookup',
    'provider-route-lookup',
    'provider-route-queue',
    'group-route-fetch',
    'group-route-validation',
    'provider-evidence-pending',
    'provider-request',
    'provider-open',
    'auto-loop-timer',
    'line-map-recovery',
    'automation-active'
  ]);
  const REGION_EXPORT_COMPLETION_REASONS = Object.freeze([
    'idle',
    'candidate-incomplete',
    'candidate-unstable',
    'strong-proof-pending',
    'settled',
    'followup-budget-exhausted',
    'exact',
    'timeout',
    'cancelled'
  ]);

  const DONG = '\uB3D9';
  const FLOOR = '\uCE35';
  const HO = '\uD638';
  const LINE = '\uC120';
  const UNIT_LINE = '\uB77C\uC778';
  const LOW = '\uC800';
  const MID = '\uC911';
  const HIGH = '\uACE0';
  const DIRECTION_TOKENS = Object.freeze([
    '\uB0A8\uB3D9\uD5A5',
    '\uB0A8\uC11C\uD5A5',
    '\uBD81\uB3D9\uD5A5',
    '\uBD81\uC11C\uD5A5',
    '\uB0A8\uD5A5',
    '\uB3D9\uD5A5',
    '\uBD81\uD5A5',
    '\uC11C\uD5A5'
  ]);
  const TOTAL_FLOOR_LABEL_PATTERN = new RegExp(`(?:\\uCD1D|\\uCD5C\\uACE0|\\uC804\\uCCB4)\\s*\\d{1,2}\\s*${FLOOR}`);
  const SELECTED_LISTING_SELECTOR = [
    '.item.is-selected',
    '.item.is-active',
    '.item[aria-selected="true"]',
    '.item[aria-current="true"]',
    '.item[aria-current="page"]',
    '.item_inner.is-selected',
    '.item_inner.is-active',
    '.item_inner[aria-selected="true"]',
    '.item_inner[aria-current="true"]',
    '.item_inner[aria-current="page"]',
    'a.item_link.is-selected',
    'a.item_link.is-active',
    'a.item_link[aria-selected="true"]',
    'a.item_link[aria-current="true"]',
    'a.item_link[aria-current="page"]',
    'a.item_link[aria-expanded="true"]'
  ].join(',');
  const LISTING_CLICK_TARGET_SELECTOR = 'a.item_link, a[href*="articleNo"], a[href*="atclNo"], button, [role="button"]';
  const CP_PROVIDER_HOSTS = [
    { domain: 'land.mk.co.kr', family: 'mk' },
    { domain: 'm.land.mk.co.kr', family: 'mk' },
    { domain: 'landad.mk.co.kr', family: 'mk' },
    { domain: 'r114.com', family: 'r114' },
    { domain: 'n.gongsilclub.com', family: 'gongsilclub' },
    { domain: 'm.gongsilclub.com', family: 'gongsilclub' },
    { domain: 'homesdid.co.kr', family: 'homesdid' },
    { domain: 'm.homesdid.co.kr', family: 'homesdid' },
    { domain: 'serve.co.kr', family: 'serve' },
    { domain: 'rfine.kr', family: 'rfine' },
    { domain: 'rter2.com', family: 'rter' },
    { domain: 'rego.kr', family: 'rter' },
    { domain: 'm.rego.kr', family: 'rter' },
    { domain: 'asil.kr', family: 'asil' },
    { domain: 'realestate.hankyung.com', family: 'hankyung' },
    { domain: 'maemul.hankyung.com', family: 'hankyung' },
    { domain: 'land.hankyung.com', family: 'hankyung' },
    { domain: 'hankyung.com', family: 'hankyung' },
    { domain: 'www.hankyung.com', family: 'hankyung' },
    { domain: 'land.daara.co.kr', family: 'daara' },
    { domain: 'm.land.daara.co.kr', family: 'daara' },
    { domain: 'industryland.co.kr', family: 'daara' },
    { domain: 'www.industryland.co.kr', family: 'daara' },
    { domain: 'neonet.co.kr', family: 'neonet' },
    { domain: 'www.neonet.co.kr', family: 'neonet' },
    { domain: 'm.neonet.co.kr', family: 'neonet' },
    { domain: 'ten.co.kr', family: 'ten' },
    { domain: 'karhanbang.com', family: 'kar' },
    { domain: 'www.karhanbang.com', family: 'kar' },
    { domain: 'thebiz.co.kr', family: 'thebiz' },
    { domain: 'www.thebiz.co.kr', family: 'thebiz' },
    { domain: 'thebiz.kr', family: 'thebiz' },
    { domain: 'www.thebiz.kr', family: 'thebiz' },
    { domain: 'woori-house.co.kr', family: 'woori' },
    { domain: 'landcenter.kiso.or.kr', family: 'kiso' }
  ];
  const PAGE_EVENT_CATEGORIES = new Set([
    'article',
    'sameAddress',
    'representativeArticles',
    'complexList',
    'complexCache',
    'landprice',
    'prices',
    'buildingUnits',
    'pyeongtype',
    'finFrontApi',
    'kbAlias',
    'cpProvider',
    'naverOther',
    'urlContext',
    'other'
  ]);
  const PROVIDER_FAMILIES = new Set(CP_PROVIDER_HOSTS.map((item) => item.family));
  const NETWORK_COUNT_CATEGORIES = new Set([
    'article',
    'cpProvider',
    'sameAddress',
    'representativeArticles',
    'complexList',
    'complexCache',
    'landprice',
    'prices',
    'buildingUnits',
    'pyeongtype',
    'finFrontApi',
    'kbAlias',
    'naverOther'
  ]);

  function versionParts(value) {
    return String(value || '').split('.').map((part) => {
      const number = Number.parseInt(part, 10);
      return Number.isFinite(number) ? number : 0;
    });
  }

  function isSameOrNewerVersion(existing, current) {
    const left = versionParts(existing);
    const right = versionParts(current);
    for (let index = 0; index < Math.max(left.length, right.length, 3); index += 1) {
      const leftPart = left[index] || 0;
      const rightPart = right[index] || 0;
      if (leftPart > rightPart) return true;
      if (leftPart < rightPart) return false;
    }
    return true;
  }

  const runtimeSession = String(window.__DHS_ANYTHING_RUNTIME_SESSION__ || '');
  const existingBridgeVersion = String(window.__DHS_ANYTHING_CHROME_BRIDGE__ || '');
  const existingBridgeSession = String(window.__DHS_ANYTHING_CHROME_BRIDGE_SESSION__ || '');
  if (
    existingBridgeVersion
    && isSameOrNewerVersion(existingBridgeVersion, VERSION)
    && existingBridgeSession === runtimeSession
  ) return;
  const previousBridgeDispose = window.__DHS_ANYTHING_CHROME_BRIDGE_DISPOSE__;
  if (typeof previousBridgeDispose === 'function') {
    try { previousBridgeDispose(); } catch (_) {}
  }
  const staleOverlay = document.getElementById(OVERLAY_ID);
  if (staleOverlay) staleOverlay.remove();
  const staleRegionShield = document.getElementById('dhs-region-export-shield');
  if (staleRegionShield) staleRegionShield.remove();
  window.__DHS_ANYTHING_CHROME_BRIDGE__ = VERSION;
  window.__DHS_ANYTHING_CHROME_BRIDGE_SESSION__ = runtimeSession;

  const state = {
    diagnosis: 'waiting',
    listingCount: 0,
    listingSampleCount: 0,
    dongCount: 0,
    floorCount: 0,
    hoCount: 0,
    dongHoShownCount: 0,
    floorKnownNoHoCount: 0,
    floorBandNoHoCount: 0,
    subwayHoFalsePositiveCount: 0,
    listingDisplayUnknownCount: 0,
    detailFloorKind: 'none',
    detailFloorBand: '',
    detailFloorValue: 0,
    detailTotalFloor: 0,
    detailDongToken: '',
    detailTypeToken: '',
    detailTypeAliases: [],
    detailDirectionToken: '',
    detailExclusiveSpace: 0,
    detailPyeongNo: '',
    visibleDetailDongToken: '',
    visibleDetailDealType: '',
    visibleDetailPriceToken: '',
    visibleDetailContextMismatch: false,
    recentListingContextPresent: false,
    recentListingDongToken: '',
    recentListingDealType: '',
    recentListingPriceToken: '',
    recentListingOverridesDetail: false,
    dealType: '',
    priceToken: '',
    articleDetailExclusiveSpace: 0,
    articleDetailPyeongNo: '',
    articleDetailFloorValue: 0,
    articleDetailTotalFloor: 0,
    articleDetailBuildNo: '',
    articleDetailDongNo: '',
    articleDetailDisplayDongToken: '',
    detailContextPresent: false,
    articlePresent: false,
    articleMarker: '',
    // Wall-clock investigation timer: stamped when a listing's marker first appears (≈ user click)
    // so the "걸린시간" row measures click→done, not the resolver's internal FIN-lookup duration.
    investigationClockMarker: '',
    investigationStartedAtMs: 0,
    selectedListingGroupKey: '',
    selectedArticleMarkerSource: '',
    representativeChildContextPresent: false,
    officialRowsPresent: false,
    officialFloorRows: 0,
    officialCandidateCells: 0,
    officialCandidateMode: 'none',
    officialCandidateDisplays: [],
    officialExactCandidatePresent: false,
    officialExactCandidateDisplay: '',
    cpTextSignalPresent: false,
    cpTextSignalStrong: false,
    cpTextSignalKind: 'none',
    cpProviderFamilies: [],
    cpProviderLinkCount: 0,
    cpProviderClickTargetCount: 0,
    cpProviderGroupTargetCount: 0,
    cpProviderClickTargetStatus: 'no-target',
    cpProviderClickTargetPhase: '',
    cpProviderAttemptIndex: 0,
    cpProviderAttemptCount: 0,
    cpProviderCurrentFamily: '',
    providerTargetVersion: '',
    cpTechnicalIdPresent: false,
    cpParserReadiness: 'none',
    cpProviderEvidenceSeen: false,
    sameAddressEvidenceSeen: false,
    representativeEvidenceSeen: false,
    naverCacheEvidenceSeen: false,
    complexListEvidenceSeen: false,
    complexCacheEvidenceSeen: false,
    kbAliasEvidenceSeen: false,
    providerOpenStatus: 'idle',
    providerDirectLookupStatus: 'idle',
    providerDirectLookupStep: '',
    providerDirectLookupProviderFamily: '',
    providerDirectLookupBodyShape: '',
    providerDirectLookupAddress2Seen: false,
    providerDirectLookupSequenceSeen: false,
    providerDirectLookupRedirectStatus: 0,
    providerDirectLookupPopupStatus: 0,
    providerDirectLookupStructuredFieldSeen: false,
    providerDirectLookupStructuredFieldName: '',
    providerDirectLookupStructuredFieldNames: [],
    providerDirectLookupStructuredFloorFieldSeen: false,
    providerDirectLookupStructuredFloorFieldNames: [],
    providerDirectLookupStructuredFloorTotalFieldSeen: false,
    providerDirectLookupStructuredValueStatus: '',
    providerDirectLookupVisibleFragmentSeen: false,
    providerDirectLookupVisibleFragmentStatus: '',
    providerDirectLookupVisibleFallbackOnly: false,
    providerDirectLookupBrokerOfficeBlockSeen: false,
    providerDirectLookupCandidatePresent: false,
    providerDirectLookupFloorHintPresent: false,
    providerDirectLookupRejectReason: '',
    providerCandidatePresent: false,
    providerCandidateKind: 'none',
    providerCandidateFamily: '',
    providerCandidateSource: '',
    providerCandidateSourceLabel: '',
    providerCandidateCpid: '',
    providerCandidateCertainty: '',
    providerCandidateRank: 0,
    providerCandidateDisplay: '',
    providerCandidateMarker: '',
    providerCandidateRejectedReason: '',
    providerCandidateRejectedSource: '',
    providerCandidateRejectedSourceLabel: '',
    providerCandidateRejectedCpid: '',
    providerCandidateRejectedCertainty: '',
    providerCandidateRejectedRank: 0,
    providerCandidateRejectedKind: '',
    providerCandidateRejectedFamily: '',
    providerCandidateCount: 0,
    providerCandidateRejectedCount: 0,
    providerCandidateRankedSummary: '',
    providerEvidenceTempPendingActive: false,
    providerEvidenceTempCount: 0,
    providerEvidenceTempExactCount: 0,
    providerEvidenceTempFloorCount: 0,
    providerEvidenceTempFamilies: [],
    providerEvidenceTempSourceSummaries: [],
    providerEvidenceTempLastObservationReason: '',
    providerEvidenceTempLastObservationFamily: '',
    providerEvidenceTempLastObservationCandidatePresent: false,
    providerEvidenceTempLastObservationFloorHintPresent: false,
    providerEvidenceTempClearedCandidateCount: 0,
    providerEvidenceTempClearedPendingRequest: false,
    providerEvidenceTempTargetPhase: '',
    providerEvidenceTempTargetIndex: 0,
    providerEvidenceTempTargetCount: 0,
    providerEvidenceTempTargetFamily: '',
    providerEvidenceTempTabsCloseScheduled: false,
    providerRequestKey: '',
    providerFloorHintPresent: false,
    providerFloorHintValue: 0,
    providerFloorHintTotal: 0,
    providerFloorHintFamily: '',
    providerFloorHintSourceLabel: '',
    providerFloorHintMarker: '',
    providerFloorHintRejectedReason: '',
    groupFloorHintPresent: false,
    groupFloorHintValue: 0,
    groupFloorHintTotal: 0,
    groupFloorHintSource: '',
    groupFloorHintCount: 0,
    groupFloorHintRejectedReason: '',
    groupFloorHintGuardSeenCount: 0,
    groupFloorHintGuardMatchedCount: 0,
    groupFloorHintGuardRejectByReason: {},
    groupCandidatePresent: false,
    groupCandidateSource: '',
    groupCandidateDisplay: '',
    groupCandidateMarker: '',
    groupCandidateRejectedReason: '',
    groupCandidateCount: 0,
    groupCandidateRankedSummary: '',
    groupRouteStatus: 'idle',
    groupRouteSource: '',
    groupRouteIndex: 0,
    groupRouteCount: 0,
    groupRouteCandidateCount: 0,
    groupRouteRejectedCount: 0,
    groupRouteLastRejectReason: '',
    groupRouteProgressSeq: 0,
    groupRouteFloorHintRawCount: 0,
    groupRouteFloorHintRawBySource: {},
    groupRouteFloorHintDiagnosticBySource: {},
    groupRouteFloorHintSeenCount: 0,
    groupRouteFloorHintAcceptedCount: 0,
    groupRouteFloorHintRejectedCount: 0,
    groupRouteFloorHintRejectByReason: {},
    groupRouteFloorHintSeenByField: {},
    groupRouteShapeSummary: '',
    groupRouteShapeBySource: {},
    providerRouteLookupRawCount: 0,
    providerRouteLookupMatchCount: 0,
    providerRouteLookupGroupContextCount: 0,
    providerRouteLookupRejectedCount: 0,
    providerRouteLookupAttemptedCount: 0,
    providerRouteLookupBatchStatus: '',
    providerRouteLookupLastSource: '',
    providerRouteLookupLastRejectReason: '',
    providerRouteLookupBySource: {},
    providerRouteLookupRejectByReason: {},
    providerRouteLookupRejectBySource: {},
    providerRouteLookupKindBySource: {},
    providerRouteLookupFamilyBySource: {},
    providerRouteLookupMatchBySource: {},
    providerRouteLookupAttemptLastSource: '',
    providerRouteLookupAttemptLastFamily: '',
    providerRouteLookupAttemptLastKind: '',
    providerRouteLookupAttemptLastMatchKind: '',
    resolverBranch: 'idle',
    resolverOutcome: 'no-article',
    lastNetworkCategory: 'none',
    lastNetworkStatus: 'none',
    networkCategoryCounts: {},
    lastEvidenceCategory: 'none',
    lastEvidenceStatus: 'none',
    lastEvidenceProviderFamily: '',
    kbAliasMarker: '',
    kbAliasReadiness: 'none',
    lineInferenceStatus: '',
    lineInferenceDisplay: '',
    lineInferenceCandidateCount: 0,
    lineInferenceCandidateDisplays: [],
    lineInferenceCandidateStats: [],
    lineInferenceCandidateProvenance: [],
    lineInferenceTypeGroupStats: [],
    lineInferenceCandidateGroupStats: [],
    lineInferenceTypeFamilyGroupStats: [],
    lineInferenceDongGroupStats: [],
    lineInferenceTypeToken: '',
    lineInferenceSource: '',
    lineInferenceReason: '',
    lineInferenceRowCount: 0,
    lineInferenceDongMatchCount: 0,
    lineInferenceTypeMatchCount: 0,
    lineInferenceFloorMatchCount: 0,
    lineInferenceDirectionMatchCount: 0,
    lineInferenceDirectionHeuristicMatchCount: 0,
    lineInferenceLandPriceAnomalyMatchCount: 0,
    lineInferencePyeongNoMatchCount: 0,
    lineInferencePyeongNoSuppressedSingleCandidate: false,
    lineInferencePyeongNoInputCandidateCount: 0,
    lineInferencePyeongNoFilteredCandidateCount: 0,
    lineInferenceDirectHoEvidenceCount: 0,
    pyeongTypeRouteEvent: '',
    pyeongTypeRouteStatus: 0,
    pyeongTypeRouteReason: '',
    pyeongTypeLineMapRowCount: 0,
    lineMapRouteEndpoint: '',
    lineMapRouteEvent: '',
    lineMapRouteStatus: 0,
    lineMapRouteReason: '',
    lineMapRouteRowCount: 0,
    lineMapRouteDurationMs: 0,
    lineMapRouteProgressSeq: 0,
    lineMapRouteShapeSummary: '',
    lineMapRouteByEndpoint: {},
    lineMapFollowupRequestCount: 0,
    lineMapFollowupReason: '',
    finFrontPriorityReason: 'idle',
    finFrontPriorityAttemptCount: 0,
    finFrontPriorityHitCount: 0,
    finFrontPriorityWaitMs: 0,
    buildingUnitsExactPresent: false,
    buildingUnitsExactDisplay: '',
    buildingUnitsExactSource: '',
    buildingUnitsExactReason: '',
    buildingUnitsExactRowCount: 0,
    buildingUnitsExactArticleLinkedCount: 0,
    buildingUnitsExactCandidateCount: 0,
    buildingUnitsExactFloorValue: 0,
    buildingUnitsExactTypeToken: '',
    landLineCandidatePresent: false,
    landLineCandidateDisplay: '',
    landLineCandidateCertainty: '',
    landLineCandidateSource: '',
    landLineProofSource: '',
    landLineRejectedReason: '',
    cdpResolverFinalPresent: false,
    cdpResolverFinalArticleMarker: '',
    cdpResolverFinalStatus: '',
    cdpResolverFinalExact: '',
    cdpResolverFinalDisplay: '',
    cdpResolverFinalSource: '',
    cdpResolverFinalBranch: '',
    cdpResolverFinalOutcome: '',
    cdpResolverFinalRejectedReason: '',
    cdpResolverFinalCandidateCount: 0,
    cdpResolverFinalDurationMs: 0,
    cdpResolverFinalAt: 0,
    cdpResolverFinalRunKey: '',
    cdpResolverFinalSeenRunKey: '',
    cdpResolverFinalSeenFingerprint: '',
    currentListingEvidenceKey: '',
    currentListingEvidenceAt: '',
    currentListingElapsedKey: '',
    currentListingElapsedSec: 0,
    regionExportStatus: 'idle',
    regionExportRowCount: 0,
    regionExportDoneCount: 0,
    regionExportExactCount: 0,
    regionExportResumedCount: 0,
    regionExportComplexTargetCount: 0,
    regionExportComplexDoneCount: 0,
    regionExportComplexFailureCount: 0,
    regionExportComplexLastReason: '',
    regionExportGroupedRetryPendingCount: 0,
    regionExportGroupedRevalidationCount: 0,
    regionExportGroupedRevalidationElapsedMs: 0,
    regionExportGroupedRetryHintAttemptCount: 0,
    regionExportGroupedRetryHintMatchCount: 0,
    regionExportGroupedRetryHintExactCount: 0,
    regionExportGroupedParentResolutionMs: 0,
    regionExportGroupedChildAttemptCount: 0,
    regionExportGroupedChildClickCount: 0,
    regionExportGroupedChildAttemptTotal: 0,
    regionExportGroupedChildClickTotal: 0,
    regionExportGroupedChildSkippedEquivalentCount: 0,
    regionExportGroupedChildSkippedEquivalentTotal: 0,
    regionExportGroupedChildRebindMissCount: 0,
    regionExportGroupedChildExactAttemptIndex: 0,
    regionExportGroupedChildResolutionMs: 0,
    regionExportStartedAt: 0,
    regionExportElapsedMs: 0,
    regionExportCheckpointStatus: 'idle',
    regionExportLastError: '',
    regionExportCurrentRow: null,
    regionExportCandidatePendingReasons: [],
    regionExportCandidateSettled: false,
    regionExportCandidateCompletionReason: 'idle',
    regionExportCandidateEarlyExitCount: 0,
    regionExportSelectionKey: '',
    regionExportSelectionLabel: '',
    // Snapshot of the chosen 시/구/동 values, frozen at the first complete selection of a picking
    // session so the overlay name doesn't churn as Naver's live filter (.area.is-selected) shifts.
    regionExportSelectionValues: [],
    // DHS-native region picker (fed by Naver's public regions/list API, NO visual-selector driving,
    // so the map does NOT react while the user picks 시/도→시/군/구→읍/면/동). The visual selector is
    // only driven later, on 추출하기, to apply the chosen region to Naver.
    regionPickerOptions: [],   // current level's [{cortarNo, cortarName, cortarType}]
    regionPickerPath: [],      // chosen path [{cortarNo, cortarName, cortarType}] (len 0..3)
    regionPickerLoading: false,
    regionExportSelectionProof: '',
    regionExportSelectionLevel: 'sido',
    regionExportSelectorWasExpanded: false,
    regionExportSelectorReady: false,
    regionExportSelectionError: '',
    regionExportSavedPath: '',
    lastEvent: 'bridge-installed',
    manifestVersion: '',
    bridgeVersion: VERSION,
    pageHookVersion: '',
    activeGroupRoutesImportStatus: 'idle',
    activeGroupRoutesImportReason: '',
    routeSearchStatus: 'idle',
    routeSearchStartedAt: 0,
    routeSearchLastProgressAt: 0,
    routeSearchElapsedSec: 0,
    routeSearchIdleSec: 0,
    routeSearchSignature: '',
    autoLoopStatus: 'idle',
    autoLoopReason: '',
    autoLoopAction: '',
    autoLoopTargetPhase: '',
    autoLoopTargetRoute: '',
    autoLoopTargetIndex: 0,
    autoLoopTargetCount: 0,
    autoLoopAttemptedCount: 0,
    autoLoopLastActionAt: 0,
    stop: false
  };
  window.__DHS_ANYTHING_CHROME_STATE__ = state;

  let lastArticleMarker = '';
  let runtimeContextActive = true;
  let bridgeObserver = null;
  let domContentLoadedListener = null;
  let overlayClickListener = null;
  let pageMessageListener;
  let popstateListener = null;
  let listingMouseDownListener = null;
  let listingClickListener = null;
  let cdpTargetContextListener = null;
  let cdpResolverFinalListener = null;
  let cdpTargetContextOverride = null;
  let lastClickedListingRoot = null;
  let lastClickedListingAt = 0;
  let lastClickedListingText = '';
  let lastClickedListingSource = '';
  let selectedArticleMarkerSource = '';
  let lastExpandedListingText = '';
  let lastExpandedListingAt = 0;
  let lastExpandedListingRootCount = 0;
  let lastExpandedListingRootKeys = [];
  let groupCandidateRows = [];
  let groupFloorHintRows = [];
  let networkLineMapRows = [];
  let autoLoopTimer = 0;
  let activeGroupRouteRequestSeq = 0;
  let activeGroupRouteFetchCount = 0;
  let activeGroupRouteStatusBeforeFetch = '';
  let activeGroupRoutesImportPromise = null;
  let autoLoopArticleMarker = '';
  const autoLoopAttemptedKeys = new Set();
  // R3: last decision produced by updateAutoLoopDecision(), reused by the probe dataset writer
  // within the same render cycle to avoid a redundant planLiveAutomation()+groupRouteTargets() pass.
  let lastPlannedAutoLoopDecision = null;
  // R4: last serialized data-dhs-probe payload; skip the DOM write when unchanged.
  let lastSerializedProbe = '';
  const lineMapRecoveryKeys = new Set();
  let lineMapRecoveryPending = false;
  // Debounce state for the display "resolver finished" signal (absorbs exhausted↔opening oscillation).
  let settledLookMarker = '';
  let settledLookSinceMs = 0;
  // 동일매물(same-unit) group → confirmed exact cache. Keyed by the group's sorted sibling articleNos.
  // Because grouped children are literally the same unit listed by different brokers, once ANY child
  // confirms the exact 동/호, its siblings can inherit it instead of each running its own (sometimes
  // failing, always slower) provider search. Bounded; safety-gated at read time.
  const groupExactCache = new Map();
  const currentArticleMkLookupAttemptKeys = new Set();
  const providerNameLookupAttemptKeys = new Set();
  const providerRouteLookupAttemptKeys = new Set();
  const providerRouteLookupPendingKeys = new Set();
  const providerRouteLookupPendingRows = [];
  let providerRouteLookupRunning = false;
  const bridgeIntervals = [];
  let compareSignalDisplay = '';
  let compareSignalHash = '';
  let compareSignalPending = '';
  // While >0, the region-export shield is click-through (pointer-events:none) so the extraction's own
  // coordinate-based trusted clicks can land on the page; otherwise the shield blocks user clicks.
  let regionExportShieldClickThroughDepth = 0;
  let regionExportRunId = 0;
  let regionExportMarkerNoncePromise = null;
  let regionExportResumeRegionKey = '';
  let providerRequestGeneration = 0;
  let exactEvidenceReceiptCounter = 0;
  let exactEvidenceReceiptBySource = Object.freeze({ cdp: 0, provider: 0, group: 0, line: 0, official: 0 });
  let exactEvidenceReceiptKeyBySource = Object.freeze({ cdp: '', provider: '', group: '', line: '', official: '' });
  let exactEvidenceObjectReceiptSequence = 0;
  const exactEvidenceObjectReceiptIds = new WeakMap();
  let officialTableReceiptSequence = 0;
  const officialTableReceiptIds = new WeakMap();
  let groupCandidateEvidenceReceiptSequence = 0;
  let groupCandidateEvidenceReceiptByProof = Object.create(null);
  let lineMapEvidenceReceiptSequence = 0;
  let lineMapEvidenceReceiptByProof = Object.create(null);
  let providerFloorEvidenceReceiptSequence = 0;
  let providerFloorEvidenceReceiptKey = '';

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function evidenceObjectReceiptId(value) {
    if (!value || typeof value !== 'object') return '';
    if (!exactEvidenceObjectReceiptIds.has(value)) {
      exactEvidenceObjectReceiptSequence = Math.min(Number.MAX_SAFE_INTEGER, exactEvidenceObjectReceiptSequence + 1);
      exactEvidenceObjectReceiptIds.set(value, exactEvidenceObjectReceiptSequence);
    }
    return String(exactEvidenceObjectReceiptIds.get(value) || '');
  }

  function markExactEvidenceReceipt(sourceValue, receiptKeyValue) {
    const source = String(sourceValue || '').toLowerCase();
    if (!EXACT_EVIDENCE_RECEIPT_SOURCES.includes(source)) return false;
    const receiptKey = normalizeText(receiptKeyValue);
    if (!receiptKey) return false;
    const redactedKey = hashMarker(`${source}|${receiptKey}`);
    if (exactEvidenceReceiptKeyBySource[source] === redactedKey) return false;
    exactEvidenceReceiptCounter = Math.min(Number.MAX_SAFE_INTEGER, exactEvidenceReceiptCounter + 1);
    exactEvidenceReceiptKeyBySource = Object.freeze(Object.assign({}, exactEvidenceReceiptKeyBySource, {
      [source]: redactedKey
    }));
    exactEvidenceReceiptBySource = Object.freeze(Object.assign({}, exactEvidenceReceiptBySource, {
      [source]: exactEvidenceReceiptCounter
    }));
    return true;
  }

  function resetExactEvidenceReceiptKeys() {
    exactEvidenceReceiptKeyBySource = Object.freeze({ cdp: '', provider: '', group: '', line: '', official: '' });
  }

  function exactEvidenceReceiptSnapshot() {
    return Object.assign({}, exactEvidenceReceiptBySource);
  }

  function regionExportExactReceiptAdvanced(before, source) {
    const api = window.DHS_REGION_EXPORT_CHECKPOINT || {};
    if (typeof api.exactReceiptAdvanced === 'function') {
      return api.exactReceiptAdvanced(before, exactEvidenceReceiptSnapshot(), source);
    }
    return EXACT_EVIDENCE_RECEIPT_SOURCES.includes(source)
      && Number(exactEvidenceReceiptBySource[source] || 0) > Number(before && before[source] || 0);
  }

  function regionExportGroupedExactFreshnessDecision(before, status, runActive) {
    const source = currentExactEvidenceReceiptSource();
    const api = window.DHS_REGION_EXPORT_CHECKPOINT || {};
    if (typeof api.groupedExactFreshnessDecision === 'function') {
      return api.groupedExactFreshnessDecision({
        before,
        after: exactEvidenceReceiptSnapshot(),
        source,
        status,
        runActive
      });
    }
    if (!runActive) return 'cancelled';
    if (status === 'exact') {
      return source && regionExportExactReceiptAdvanced(before, source) ? 'fresh-exact' : 'stale-exact';
    }
    return ['multiple-candidates', 'unresolved', 'timeout', 'group-child-unresolved', 'click-missing'].includes(status)
      ? 'terminal-non-exact'
      : 'waiting';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function chromeRuntimeRef() {
    const guard = window.DHS_RUNTIME_GUARD;
    if (guard && typeof guard.safeChromeRuntimeRef === 'function') {
      return guard.safeChromeRuntimeRef(window);
    }
    try {
      return typeof chrome === 'undefined' ? null : chrome;
    } catch (_) {
      return null;
    }
  }

  function isRuntimeInvalidationError(error) {
    const guard = window.DHS_RUNTIME_GUARD;
    return guard && typeof guard.isRuntimeInvalidationError === 'function'
      ? guard.isRuntimeInvalidationError(error)
      : /Extension context invalidated/i.test(String(error && error.message || error || ''));
  }

  function sanitizeVersion(value) {
    const version = String(value || '');
    return /^\d{1,3}\.\d{1,3}\.\d{1,3}(?:[-+][A-Za-z0-9.-]{1,24})?$/.test(version) ? version : '';
  }

  function readManifestVersion() {
    try {
      const chromeRef = chromeRuntimeRef();
      const manifest = chromeRef && chromeRef.runtime && typeof chromeRef.runtime.getManifest === 'function'
        ? chromeRef.runtime.getManifest()
        : null;
      return sanitizeVersion(manifest && manifest.version) || '-';
    } catch (_) {
      return '-';
    }
  }

  function stopRuntimeTasks() {
    window.clearTimeout(scanTimer);
    scanTimer = 0;
    scanDueAt = 0;
    window.clearTimeout(autoLoopTimer);
    autoLoopTimer = 0;
    while (bridgeIntervals.length > 0) {
      window.clearInterval(bridgeIntervals.pop());
    }
    if (bridgeObserver) {
      bridgeObserver.disconnect();
      bridgeObserver = null;
    }
    if (domContentLoadedListener) {
      document.removeEventListener('DOMContentLoaded', domContentLoadedListener);
      domContentLoadedListener = null;
    }
    if (pageMessageListener) {
      window.removeEventListener('message', pageMessageListener);
      pageMessageListener=null;
    }
    if (popstateListener) {
      window.removeEventListener('popstate', popstateListener);
      popstateListener = null;
    }
    if (listingMouseDownListener) {
      document.removeEventListener('mousedown', listingMouseDownListener, true);
      listingMouseDownListener = null;
    }
    if (listingClickListener) {
      document.removeEventListener('click', listingClickListener, true);
      listingClickListener = null;
    }
    if (cdpTargetContextListener) {
      window.removeEventListener('dhs-cdp-target-context', cdpTargetContextListener);
      cdpTargetContextListener = null;
    }
    if (cdpResolverFinalListener) {
      window.removeEventListener('dhs-cdp-resolver-final', cdpResolverFinalListener);
      cdpResolverFinalListener = null;
    }
    try { delete window.__DHS_CDP_FORCE_OFFICIAL_SCAN__; } catch (_) {
      window.__DHS_CDP_FORCE_OFFICIAL_SCAN__ = null;
    }
    cdpTargetContextOverride = null;
    if (overlayClickListener) {
      const overlay = document.getElementById(OVERLAY_ID);
      if (overlay) overlay.removeEventListener('click', overlayClickListener);
      overlayClickListener = null;
    }
  }

  window.__DHS_ANYTHING_CHROME_BRIDGE_DISPOSE__ = () => {
    runtimeContextActive = false;
    stopRuntimeTasks();
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.remove();
    const shield = document.getElementById('dhs-region-export-shield');
    if (shield) shield.remove();
  };

  function safeBridgeTask(fn) {
    if (!runtimeContextActive) return;
    try {
      fn();
    } catch (error) {
      if (isRuntimeInvalidationError(error)) {
        markRuntimeUnavailable(error);
        return;
      }
      throw error;
    }
  }

  function markRuntimeUnavailable(error) {
    if (!runtimeContextActive && state.lastEvent === 'runtime-invalidated') return;
    runtimeContextActive = false;
    stopRuntimeTasks();
    state.providerOpenStatus = 'unverified';
    state.providerCandidateRejectedReason = 'runtime-invalidated';
    state.lastEvent = 'runtime-invalidated';
    try {
      console.info('[DHS_ANYTHING_CHROME]', {
        eventName: state.lastEvent,
        runtime: 'unavailable',
        error: String(error && error.message || error || 'runtime-unavailable')
      });
      renderOverlay();
    } catch (_) {
      // The old content script is being torn down; avoid surfacing a second error.
    }
  }

  function safeRuntimeGetURL(path) {
    if (!runtimeContextActive) return '';
    const guard = window.DHS_RUNTIME_GUARD;
    const url = guard && typeof guard.safeRuntimeGetURL === 'function'
      ? guard.safeRuntimeGetURL(chromeRuntimeRef(), path)
      : '';
    if (!url) markRuntimeUnavailable('runtime-get-url-failed');
    return url;
  }

  function safeRuntimeSendMessage(message, callback) {
    if (!runtimeContextActive) return false;
    const guard = window.DHS_RUNTIME_GUARD;
    const done = typeof callback === 'function' ? callback : function noop() {};
    if (!guard || typeof guard.safeRuntimeSendMessage !== 'function') {
      markRuntimeUnavailable('missing-runtime-guard');
      return false;
    }
    return guard.safeRuntimeSendMessage(chromeRuntimeRef(), message, (response, error) => {
      if (error) {
        markRuntimeUnavailable(error);
        return;
      }
      done(response);
    });
  }

  function classifyFloor(normalized) {
    const exact = normalized.match(new RegExp(`(?<!\\d)(\\d{1,2})\\s*\\/\\s*(\\d{1,2})\\s*${FLOOR}`));
    if (exact) {
      return {
        hasFloor: true,
        floorKind: 'exact',
        floorBand: '',
        floorValue: Number(exact[1]) || 0,
        totalFloor: Number(exact[2]) || 0
      };
    }

    const band = normalized.match(new RegExp(`([${LOW}${MID}${HIGH}])\\s*${FLOOR}?\\s*\\/\\s*(\\d{1,2})\\s*${FLOOR}`));
    if (band) {
      const labels = {
        [LOW]: 'low',
        [MID]: 'mid',
        [HIGH]: 'high'
      };
      return {
        hasFloor: true,
        floorKind: 'band',
        floorBand: labels[band[1]] || '',
        floorValue: 0,
        totalFloor: Number(band[2]) || 0
      };
    }

    const loosePattern = new RegExp(`(?<!\\d)(\\d{1,2})\\s*${FLOOR}`, 'g');
    let loose;
    while ((loose = loosePattern.exec(normalized))) {
      const start = typeof loose.index === 'number' ? loose.index : 0;
      const context = `${normalized.slice(Math.max(0, start - 8), start)}${loose[0]}`;
      if (!TOTAL_FLOOR_LABEL_PATTERN.test(context)) break;
    }
    return {
      hasFloor: Boolean(loose),
      floorKind: loose ? 'loose' : 'none',
      floorBand: '',
      floorValue: loose ? Number(loose[1]) || 0 : 0,
      totalFloor: 0
    };
  }

  function extractDongToken(text) {
    const match = normalizeText(text).match(new RegExp(`(?<!\\d)(\\d{1,4})\\s*${DONG}`));
    if (!match) return '';
    return `${Number(match[1]) || match[1]}${DONG}`;
  }

  function extractHoToken(text) {
    const match = normalizeText(text).match(new RegExp(`(?<!\\d)(\\d{1,4})\\s*${HO}(?!\\s*(?:${LINE}|${UNIT_LINE}))`));
    if (!match) return '';
    return `${Number(match[1]) || match[1]}${HO}`;
  }

  function floorValueFromHoToken(value) {
    const hoToken = extractHoToken(value);
    const digits = (hoToken.match(/\d+/) || [''])[0];
    if (digits.length < 3) return 0;
    return Math.floor(Number(digits) / 100) || 0;
  }

  function providerCandidateApi() {
    const windowApi = window.DHS_PROVIDER_CANDIDATE;
    if (windowApi && typeof windowApi.sanitizeProviderCandidate === 'function') return windowApi;
    const globalApi = typeof globalThis !== 'undefined' ? globalThis.DHS_PROVIDER_CANDIDATE : null;
    return globalApi && typeof globalApi.sanitizeProviderCandidate === 'function' ? globalApi : null;
  }

  function activeGroupRoutesApi() {
    const windowApi = window.DHS_ACTIVE_GROUP_ROUTES;
    if (windowApi && typeof windowApi.buildActiveGroupRouteRequest === 'function') return windowApi;
    const globalApi = typeof globalThis !== 'undefined' ? globalThis.DHS_ACTIVE_GROUP_ROUTES : null;
    return globalApi && typeof globalApi.buildActiveGroupRouteRequest === 'function' ? globalApi : null;
  }

  async function ensureActiveGroupRoutesApi() {
    const existingApi = activeGroupRoutesApi();
    if (existingApi) {
      state.activeGroupRoutesImportStatus = 'ready';
      state.activeGroupRoutesImportReason = '';
      return existingApi;
    }
    if (!activeGroupRoutesImportPromise) {
      const scriptUrl = safeRuntimeGetURL('src/shared/active-group-routes.js');
      if (!scriptUrl) {
        state.activeGroupRoutesImportStatus = 'unavailable';
        state.activeGroupRoutesImportReason = 'missing-url';
        return null;
      }
      state.activeGroupRoutesImportStatus = 'loading';
      state.activeGroupRoutesImportReason = '';
      activeGroupRoutesImportPromise = import(scriptUrl)
        .then(() => {
          const api = activeGroupRoutesApi();
          state.activeGroupRoutesImportStatus = api ? 'ready' : 'missing-api';
          state.activeGroupRoutesImportReason = api ? '' : 'imported-without-api';
          return api;
        })
        .catch(() => {
          state.activeGroupRoutesImportStatus = 'failed';
          state.activeGroupRoutesImportReason = 'import-failed';
          return null;
        });
    }
    await activeGroupRoutesImportPromise;
    return activeGroupRoutesApi();
  }

  function activeGroupRoutesApiPresent() {
    return Boolean(activeGroupRoutesApi());
  }

  function extractDetailTypeToken(text) {
    const api = window.DHS_LINE_INFERENCE;
    if (!api || typeof api.normalizeTypeToken !== 'function') return '';
    const normalized = normalizeText(text);
    const compactType = normalized.match(/(?<!\d)(0?\d{2,3})\s*([A-Z]{1,3})\s*\/\s*\d{2,3}(?:\.\d{1,4})?\s*(?:m2|m\u00B2|\u33A1)?/i);
    if (compactType) return api.normalizeTypeToken(`${compactType[1]}${compactType[2]}`);
    const explicitType = normalized.match(/(?<!\d)(0?\d{2,3})(?:\.\d{1,4})?\s*([A-Z]{1,3})(?![A-Z0-9])/i);
    if (explicitType) {
      const suffix = String(explicitType[2] || '').toUpperCase();
      const nextChar = normalized.charAt(Number(explicitType.index || 0) + String(explicitType[0] || '').length);
      const typeSuffix = suffix === 'M2' || (suffix === 'M' && nextChar === '\u00B2') ? '' : suffix;
      return api.normalizeTypeToken(`${explicitType[1]}${typeSuffix}`);
    }
    const officialExclusiveArea = normalized.match(/\uACF5\uAE09\s*\/\s*\uC804\uC6A9\s*\uBA74\uC801\s*:?\s*\d{2,3}(?:\.\d{1,4})?\s*(?:m2|m\u00B2|\u33A1)?\s*\/\s*(\d{2,3}(?:\.\d{1,4})?)\s*(?:m2|m\u00B2|\u33A1)/i);
    if (officialExclusiveArea) return api.normalizeTypeToken(officialExclusiveArea[1]);
    const exclusiveArea = normalized.match(/\/\s*(\d{2,3}(?:\.\d{1,4})?)\s*(?:m2|m\u00B2|\u33A1)/i);
    if (exclusiveArea) return api.normalizeTypeToken(exclusiveArea[1]);
    return '';
  }

  function normalizeAreaValue(value) {
    if (typeof value === 'number') {
      return Number.isFinite(value) && value > 0 && value < 400 ? value : 0;
    }
    const text = normalizeText(value).replace(/,/g, '');
    const match = text.match(/(?<!\d)(\d{1,3}(?:\.\d{1,4})?)(?!\d)/);
    if (!match) return 0;
    const number = Number(match[1]);
    return Number.isFinite(number) && number > 0 && number < 400 ? number : 0;
  }

  function extractExclusiveSpaceValue(text) {
    const normalized = normalizeText(text);
    const official = normalized.match(/\uACF5\uAE09\s*\/\s*\uC804\uC6A9\s*\uBA74\uC801\s*:?\s*\d{2,3}(?:\.\d{1,4})?\s*(?:m2|m\u00B2|\u33A1)?\s*\/\s*(\d{2,3}(?:\.\d{1,4})?)\s*(?:m2|m\u00B2|\u33A1)/i);
    if (official) return normalizeAreaValue(official[1]);
    const labeled = normalized.match(/\uC804\uC6A9(?:\s*\uBA74\uC801)?\s*:?\s*(\d{2,3}(?:\.\d{1,4})?)\s*(?:m2|m\u00B2|\u33A1)/i);
    if (labeled) return normalizeAreaValue(labeled[1]);
    const slash = normalized.match(/\/\s*(\d{2,3}(?:\.\d{1,4})?)\s*(?:m2|m\u00B2|\u33A1)/i);
    return slash ? normalizeAreaValue(slash[1]) : 0;
  }

  function extractPyeongNoToken(text) {
    const match = normalizeText(text).match(/\b(?:pyeongNo|ptpNo|pyeongTypeNo)\s*[:=]\s*([A-Za-z0-9_-]{1,32})\b/i);
    return match ? match[1] : '';
  }

  function sanitizeArticleDetailPyeongNo(value) {
    return String(value || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
  }

  function sanitizeArticleDetailNumber(value) {
    const text = String(value || '').replace(/[^0-9]/g, '');
    return /^\d{1,24}$/.test(text) ? text : '';
  }

  function applyArticleDetailContext(context) {
    const safe = sanitizeArticleDetailContext(context);
    if (!safe) return;
    const exclusiveSpace = normalizeAreaValue(safe.detailExclusiveSpace || safe.exclusiveSpace || 0);
    const pyeongNo = sanitizeArticleDetailPyeongNo(safe.detailPyeongNo || safe.pyeongNo || '');
    const floorValue = sanitizeArticleDetailFloorValue(safe.detailFloorValue || safe.floorValue || 0);
    const totalFloor = sanitizeArticleDetailTotalFloor(safe.detailTotalFloor || safe.totalFloor || 0);
    const buildNo = sanitizeArticleDetailNumber(safe.detailBuildNo || safe.buildNo || '');
    const dongNo = sanitizeArticleDetailNumber(safe.detailDongNo || safe.dongNo || '');
    const displayDongToken = extractDongToken(safe.detailDisplayDongToken || safe.displayDongToken || '') || '';
    if (exclusiveSpace) state.articleDetailExclusiveSpace = exclusiveSpace;
    if (pyeongNo) state.articleDetailPyeongNo = pyeongNo;
    if (floorValue) state.articleDetailFloorValue = floorValue;
    if (totalFloor) state.articleDetailTotalFloor = totalFloor;
    if (buildNo) state.articleDetailBuildNo = buildNo;
    if (dongNo) state.articleDetailDongNo = dongNo;
    if (displayDongToken) state.articleDetailDisplayDongToken = displayDongToken;
  }

  function sanitizeArticleDetailFloorValue(value) {
    const number = Number(value || 0);
    return Number.isInteger(number) && number > 0 && number < 100 ? number : 0;
  }

  function sanitizeArticleDetailTotalFloor(value) {
    const number = Number(value || 0);
    return Number.isInteger(number) && number > 0 && number < 200 ? number : 0;
  }

  function articleFloorCompatibleWithDetailFloor(detailFloor, articleFloor) {
    const floor = sanitizeArticleDetailFloorValue(articleFloor);
    if (!floor) return false;
    const input = detailFloor || {};
    const kind = input.detailFloorKind || input.floorKind || 'none';
    if (kind === 'exact') {
      const inputFloor = Number(input.floorValue || input.detailFloorValue || 0) || 0;
      return !inputFloor || inputFloor === floor;
    }
    if (kind === 'band') {
      const range = bandRange(input.detailFloorBand || input.floorBand || '', Number(input.totalFloor || input.detailTotalFloor || 0) || 0);
      return Boolean(range && floor >= range[0] && floor <= range[1]);
    }
    return true;
  }

  function sanitizeArticleDetailContext(context) {
    if (!context || typeof context !== 'object') return null;
    const exclusiveSpace = normalizeAreaValue(context.detailExclusiveSpace || context.exclusiveSpace || 0);
    const pyeongNo = sanitizeArticleDetailPyeongNo(context.detailPyeongNo || context.pyeongNo || '');
    const floorValue = sanitizeArticleDetailFloorValue(context.detailFloorValue || context.floorValue || 0);
    const totalFloor = sanitizeArticleDetailTotalFloor(context.detailTotalFloor || context.totalFloor || 0);
    const buildNo = sanitizeArticleDetailNumber(context.detailBuildNo || context.buildNo || '');
    const dongNo = sanitizeArticleDetailNumber(context.detailDongNo || context.dongNo || '');
    const displayDongToken = extractDongToken(context.detailDisplayDongToken || context.displayDongToken || '');
    const output = {};
    if (exclusiveSpace) output.detailExclusiveSpace = exclusiveSpace;
    if (pyeongNo) output.detailPyeongNo = pyeongNo;
    if (floorValue) output.detailFloorValue = floorValue;
    if (totalFloor) output.detailTotalFloor = totalFloor;
    if (buildNo) output.detailBuildNo = buildNo;
    if (dongNo) output.detailDongNo = dongNo;
    if (displayDongToken) output.detailDisplayDongToken = displayDongToken;
    return Object.keys(output).length ? output : null;
  }

  function enrichDetailFloorWithArticleContext(detailFloor) {
    const input = detailFloor || {};
    const candidateArticleFloor = sanitizeArticleDetailFloorValue(state.articleDetailFloorValue);
    const inputFloorKind = input.detailFloorKind || input.floorKind || 'none';
    const articleFloor = articleFloorCompatibleWithDetailFloor(input, candidateArticleFloor) ? candidateArticleFloor : 0;
    const articleTotalFloor = sanitizeArticleDetailTotalFloor(state.articleDetailTotalFloor);
    const inputFloor = inputFloorKind === 'exact'
      ? (Number(input.floorValue || input.detailFloorValue || 0) || 0)
      : 0;
    const inputTotalFloor = Number(input.totalFloor || input.detailTotalFloor || 0) || 0;
    return Object.assign({}, input, {
      detailFloorKind: articleFloor ? 'exact' : input.detailFloorKind,
      floorValue: articleFloor || inputFloor,
      detailFloorValue: articleFloor || inputFloor,
      totalFloor: inputTotalFloor || articleTotalFloor,
      detailTotalFloor: inputTotalFloor || articleTotalFloor,
      detailExclusiveSpace: Number(input.detailExclusiveSpace || state.articleDetailExclusiveSpace || 0) || 0,
      detailPyeongNo: input.detailPyeongNo || state.articleDetailPyeongNo || '',
      detailBuildNo: input.detailBuildNo || state.articleDetailBuildNo || '',
      detailDongNo: input.detailDongNo || state.articleDetailDongNo || '',
      detailDisplayDongToken: input.detailDisplayDongToken || state.articleDetailDisplayDongToken || ''
    });
  }

  function appendTypeAlias(list, value) {
    const api = window.DHS_LINE_INFERENCE;
    if (!api || typeof api.normalizeTypeToken !== 'function') return;
    const token = api.normalizeTypeToken(value);
    if (token && !list.includes(token)) list.push(token);
  }

  function slashTypeToken(number, suffix) {
    const unitSafeSuffix = String(suffix || '').toUpperCase();
    const typeSuffix = unitSafeSuffix === 'M' || unitSafeSuffix === 'M2' ? '' : unitSafeSuffix;
    return `${number}${typeSuffix}`;
  }

  function typeAliasCompatibleWithPrimary(alias, primary) {
    const api = window.DHS_LINE_INFERENCE;
    if (!primary) return true;
    if (api && typeof api.typeTokensCompatible === 'function') return api.typeTokensCompatible(alias, primary);
    const left = String(alias || '').match(/^(\d{2,3})/);
    const right = String(primary || '').match(/^(\d{2,3})/);
    return Boolean(left && right && left[1] === right[1]);
  }

  function extractDetailTypeAliases(text, primaryTypeToken) {
    const api = window.DHS_LINE_INFERENCE;
    if (!api || typeof api.normalizeTypeToken !== 'function') return [];
    const normalized = normalizeText(text);
    const aliases = [];
    const primary = api.normalizeTypeToken(primaryTypeToken || '');
    appendTypeAlias(aliases, primary);

    const slashPattern = /(?<!\d)(0?\d{2,3})(?:\.\d{1,4})?\s*([A-Z]{0,3})?\s*\/\s*(0?\d{2,3})(?:\.\d{1,4})?\s*([A-Z]{0,3})?\s*(?:m2|m\u00B2|\u33A1)?/gi;
    let slash;
    while ((slash = slashPattern.exec(normalized))) {
      const leftToken = api.normalizeTypeToken(slashTypeToken(slash[1], slash[2]));
      const rightToken = api.normalizeTypeToken(slashTypeToken(slash[3], slash[4]));
      if (!typeAliasCompatibleWithPrimary(leftToken, primary) && !typeAliasCompatibleWithPrimary(rightToken, primary)) continue;
      appendTypeAlias(aliases, leftToken);
      appendTypeAlias(aliases, rightToken);
      if (aliases.length >= 6) break;
    }

    return aliases.slice(0, 6);
  }

  function extractDirectionToken(text) {
    const normalized = normalizeText(text);
    if (!normalized) return '';
    return DIRECTION_TOKENS.find((token) => normalized.includes(token)) || '';
  }

  function extractUnitLineHint(text) {
    const normalized = normalizeText(text);
    const direct = normalized.match(new RegExp(`(?<!\\d)(\\d{1,2})\\s*${HO}\\s*${UNIT_LINE}`));
    const prefix = normalized.match(new RegExp(`${UNIT_LINE}\\s*(\\d{1,2})`));
    const number = direct ? direct[1] : prefix ? prefix[1] : '';
    return number ? `${Number(number) || number}${HO}${UNIT_LINE}` : '';
  }

  function extractDealType(text) {
    const match = normalizeText(text).match(/(\uB9E4\uB9E4|\uC804\uC138|\uC6D4\uC138)/);
    return match ? match[1] : '';
  }

  function extractPriceToken(text) {
    const normalized = normalizeText(text);
    const dealType = extractDealType(normalized);
    const pattern = dealType
      ? new RegExp(`${dealType}\\s*([0-9,]+\\s*\\uC5B5(?:\\s*[0-9,]+)?|[0-9,]+)`)
      : /(?:\uB9E4\uB9E4|\uC804\uC138|\uC6D4\uC138)\s*([0-9,]+\s*\uC5B5(?:\s*[0-9,]+)?|[0-9,]+)/;
    const match = normalized.match(pattern);
    return match ? normalizeText(match[1]).replace(/\s+/g, '') : '';
  }

  function isVisibleNode(element) {
    if (!element) return false;
    const style = typeof getComputedStyle === 'function' ? getComputedStyle(element) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) return false;
    if (typeof element.getClientRects === 'function' && element.getClientRects().length > 0) return true;
    return Boolean(element.offsetWidth || element.offsetHeight);
  }

  function detailText() {
    const selectors = [
      '.detail_contents.is-article',
      '.detail_contents_inner',
      '.detail_panel'
    ];
    const root = selectors
      .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
      .find(isVisibleNode)
      || Array.from(document.querySelectorAll('.main_info_area')).find(isVisibleNode);
    return normalizeText(elementText(root));
  }

  function rootForListingLink(link) {
    if (!link || typeof link.closest !== 'function') return null;
    const childRoot = link.closest('.item--child');
    if (childRoot) return link.closest('.item_inner:not(.is-loading)') || childRoot;
    return link.closest('.item') || link.closest('.item_inner, li') || link;
  }

  function rootHasListingContext(root) {
    const text = normalizeText(elementText(root));
    if (!text) return false;
    const signal = classifyListingText(text);
    return Boolean(signal.hasDong && (signal.hasFloor || signal.pyeongTypeToken));
  }

  function isBlockedListingNavigationTarget(target) {
    const clickTarget = target && typeof target.closest === 'function'
      ? (target.closest('a[href]') || target)
      : target;
    return isBlockedProviderNavigationHref(clickNavigationRefFromTarget(clickTarget));
  }

  function safeListingClickTarget(target) {
    return Boolean(target && isVisibleNode(target) && !isBlockedListingNavigationTarget(target));
  }

  function listingClickTarget(root) {
    if (!root) return null;
    if (root.matches && root.matches(LISTING_CLICK_TARGET_SELECTOR) && safeListingClickTarget(root)) return root;
    if (!root.querySelector) return safeListingClickTarget(root) ? root : null;
    return Array.from(root.querySelectorAll(LISTING_CLICK_TARGET_SELECTOR)).find(safeListingClickTarget)
      || (safeListingClickTarget(root) ? root : null);
  }

  function childListingParentRoot(root) {
    const childRoot = root && typeof root.closest === 'function' ? root.closest('.item--child') : null;
    if (!childRoot) return null;
    let sibling = childRoot.previousElementSibling;
    while (sibling && sibling.matches && sibling.matches('.item--child')) {
      sibling = sibling.previousElementSibling;
    }
    if (sibling && sibling.matches && sibling.matches('.item') && !sibling.matches('.item--child')) return sibling;
    let node = childRoot.parentElement;
    while (node && node !== document.documentElement) {
      if (node.matches && node.matches('.item') && !node.matches('.item--child')) return node;
      node = node.parentElement;
    }
    return null;
  }

  function parentListingTextForChild(root) {
    const parentRoot = childListingParentRoot(root);
    if (!parentRoot) return '';
    const parentLink = parentRoot.querySelector && (
      parentRoot.querySelector(':scope > .item_inner a.item_link[aria-expanded]')
      || parentRoot.querySelector(':scope > .item_inner a.item_link')
      || parentRoot.querySelector('a.item_link[aria-expanded]')
      || parentRoot.querySelector('a.item_link')
    );
    return normalizeText(elementText(parentLink) || elementText(parentRoot));
  }

  function listingTextForSelectionRoot(root) {
    if (!root) return '';
    const ownText = normalizeText(elementText(root));
    const parentText = parentListingTextForChild(root);
    return normalizeText([parentText, ownText].filter(Boolean).join(' '));
  }

  function selectionRootHasListingContext(root) {
    const text = listingTextForSelectionRoot(root);
    if (!text) return false;
    const signal = classifyListingText(text);
    return Boolean(signal.hasDong && (signal.hasFloor || signal.pyeongTypeToken));
  }

  function childListingRootsForParent(root) {
    if (!root || typeof root.closest !== 'function') return [];
    const parentRoot = root.closest('.item') || root;
    if (parentRoot.matches && parentRoot.matches('.item--child')) return [];
    const children = [];
    const pushChildRoot = (childRoot) => {
      if (!childRoot) return;
      const itemInners = childRoot.querySelectorAll
        ? Array.from(childRoot.querySelectorAll('.item_inner:not(.is-loading)'))
          .filter((inner) => inner.querySelector && inner.querySelector(LISTING_CLICK_TARGET_SELECTOR))
        : [];
      if (itemInners.length) children.push(...itemInners);
      else children.push(childRoot);
    };
    if (parentRoot.querySelectorAll) {
      Array.from(parentRoot.querySelectorAll('.item--child')).forEach(pushChildRoot);
    }
    let sibling = parentRoot.nextElementSibling;
    while (sibling && sibling.matches && sibling.matches('.item--child')) {
      pushChildRoot(sibling);
      sibling = sibling.nextElementSibling;
    }
    return Array.from(new Set(children));
  }

  function groupedListingSelectionRow(root, fallbackInput) {
    const fallback = fallbackInput && typeof fallbackInput === 'object' ? fallbackInput : {};
    const target = listingClickTarget(root);
    const childText = normalizeText(elementText(target) || elementText(root));
    if (!childText) return null;
    const combinedText = normalizeText([childText, fallback.text].filter(Boolean).join(' '));
    const signal = classifyListingText(childText);
    const articleNo = articleNoFromListingRoot(root);
    const key = articleNo || typedHashMarker('groupchild', childText);
    const groupedBrokerCount = currentRegionGroupedBrokerCount(childText) || Number(fallback.groupedBrokerCount || 0) || 0;
    return {
      key,
      _root: root,
      _clickTarget: target,
      rowIndex: fallback.rowIndex || 0,
      articleNo: articleNo || '',
      dong: extractDongToken(childText) || fallback.dong || '',
      floor: signal.floorKind === 'exact'
        ? `${signal.floorValue}/${signal.totalFloor || ''}`.replace(/\/$/, '')
        : (signal.floorBand
            ? `${signal.floorBand}/${signal.totalFloor || ''}`.replace(/\/$/, '')
            : (fallback.floor || '')),
      type: signal.pyeongTypeToken || extractDetailTypeToken(childText) || fallback.type || '',
      dealType: extractDealType(childText) || fallback.dealType || '',
      priceHint: extractPriceToken(childText) || fallback.priceHint || '',
      areaHint: regionExportAreaHint(childText) || fallback.areaHint || '',
      directionHint: signal.directionToken || extractDirectionToken(childText) || fallback.directionHint || '',
      providerFamilyHint: classifyCpTextSignal(childText).providerFamilies[0] || '',
      featureText: regionExportFeatureText(childText) || fallback.featureText || '',
      groupedBrokerCount,
      isGroupedListing: groupedBrokerCount > 1,
      parentListingKey: fallback.key || '',
      text: combinedText.slice(0, 500)
    };
  }

  function representativeChildListingRoot(root) {
    if (!root || typeof root.closest !== 'function') return null;
    const parentRoot = root.closest('.item') || root;
    const parentRow = groupedListingSelectionRow(parentRoot);
    if (!parentRow) return null;
    const childRows = childListingRootsForParent(parentRoot)
      .filter(isVisibleNode)
      .map((childRoot) => groupedListingSelectionRow(childRoot, parentRow))
      .filter((row) => row && row._root && row._clickTarget && isVisibleNode(row._clickTarget));
    const plan = plannedGroupedChildRows({ ...parentRow, isGroupedListing: true }, childRows);
    return plan.rows[0]?.row?._root || null;
  }

  function clickedListingRootForElement(element) {
    const target = element && typeof element.closest === 'function' ? element : null;
    const link = target && target.closest('a.item_link');
    const root = rootForListingLink(link);
    if (root) {
      if (root.closest && root.closest('.item--child')) return root;
      if (rootHasListingContext(root)) return representativeChildListingRoot(root) || root;
      const previous = root.previousElementSibling;
      return rootHasListingContext(previous) ? previous : root;
    }
    const buttonRoot = target && target.closest('button, [role="button"]');
    const buttonListingRoot = buttonRoot && buttonRoot.closest('.item, .item_inner, li');
    if (rootHasListingContext(buttonListingRoot)) return buttonListingRoot;
    return rootHasListingContext(buttonRoot) ? buttonRoot : null;
  }

  function rememberListingSelectionRoot(root) {
    if (!root || !isVisibleNode(root)) return;
    lastClickedListingRoot = root;
    lastClickedListingAt = Date.now();
    lastClickedListingText = listingTextForSelectionRoot(root);
    lastClickedListingSource = 'user';
  }

  function rememberClickedListingRoot(element) {
    rememberListingSelectionRoot(clickedListingRootForElement(element));
  }

  function recentClickedListingRoot() {
    if ((Date.now() - lastClickedListingAt) > RECENT_LISTING_CLICK_TTL_MS) {
      lastClickedListingRoot = null;
      lastClickedListingAt = 0;
      lastClickedListingText = '';
      return null;
    }
    if (!lastClickedListingRoot || !isVisibleNode(lastClickedListingRoot)) return null;
    return lastClickedListingRoot;
  }

  function recentClickedListingText(options = {}) {
    const allowSnapshot = options.allowSnapshot !== false;
    const maxAgeMs = Number(options.maxAgeMs || RECENT_LISTING_CLICK_TTL_MS) || RECENT_LISTING_CLICK_TTL_MS;
    const snapshotMaxAgeMs = Number(options.snapshotMaxAgeMs || RECENT_LISTING_TEXT_FALLBACK_MS)
      || RECENT_LISTING_TEXT_FALLBACK_MS;
    const ageMs = Date.now() - lastClickedListingAt;
    if (ageMs <= maxAgeMs) {
      const liveText = listingTextForSelectionRoot(recentClickedListingRoot());
      if (liveText) return liveText;
    }
    const snapshotFresh = lastClickedListingText && ageMs <= Math.min(maxAgeMs, snapshotMaxAgeMs);
    if (allowSnapshot && snapshotFresh) return lastClickedListingText;
    if (lastClickedListingText && !snapshotFresh) lastClickedListingText = '';
    return '';
  }

  function selectedListingRoots(options = {}) {
    const preserveParent = Boolean(options.preserveParent);
    return [recentClickedListingRoot()]
      .concat(Array.from(document.querySelectorAll(SELECTED_LISTING_SELECTOR)))
      .filter(Boolean)
      .map((element) => element.closest('.item, .item_inner, li') || element)
      .map((element) => preserveParent ? element : (representativeChildListingRoot(element) || element))
      .filter(isVisibleNode)
      .filter((element, index, list) => list.indexOf(element) === index);
  }

  function selectedListingText() {
    return normalizeText(selectedListingRoots()
      .slice(0, 4)
      .map(listingTextForSelectionRoot)
      .filter(Boolean)
      .join(' '));
  }

  function expandedParentListingRoots() {
    const linkRoots = Array.from(document.querySelectorAll('a.item_link[aria-expanded="true"]'))
      .map(rootForListingLink);
    const itemRoots = Array.from(document.querySelectorAll('.item.is-expanded, .item_inner.is-expanded'))
      .map((element) => element.closest('.item') || element.closest('.item_inner') || element);
    return linkRoots
      .concat(itemRoots)
      .filter(Boolean)
      .filter(isVisibleNode)
      .filter(rootHasListingContext)
      .filter((element, index, list) => list.indexOf(element) === index);
  }

  function expandedListingRoots() {
    return expandedParentListingRoots()
      .map((element) => representativeChildListingRoot(element) || element)
      .filter(isVisibleNode)
      .filter(selectionRootHasListingContext)
      .filter((element, index, list) => list.indexOf(element) === index);
  }

  function representativeChildContextActive() {
    return selectedListingRoots()
      .concat(expandedListingRoots())
      .some((root) => root && root.closest && root.closest('.item--child'));
  }

  function isGroupedParentListingRoot(root) {
    if (!root || (root.closest && root.closest('.item--child'))) return false;
    // Cheap grouped test: a group parent either renders child rows or shows "중개사 N곳" (N>1).
    // Avoid the heavier groupedListingSelectionRow (outerHTML slice + full classification) here
    // because this runs every scan tick for every selected root.
    const parentItem = (root.closest && root.closest('.item')) || root;
    if (parentItem.querySelector && parentItem.querySelector('.item--child')) return true;
    const text = normalizeText(elementText(listingClickTarget(root)) || elementText(root));
    return currentRegionGroupedBrokerCount(text) > 1;
  }

  // A selection is "grouped context" when it stems from a grouped listing (a group
  // parent, or a representative child of one). For these we defer dong-ho investigation
  // until the listing's detail panel is actually expanded — never investigate the bare
  // parent/group, which only yields ambiguous multi-unit results.
  function selectedListingIsGroupedContext() {
    const roots = selectedListingRoots({ preserveParent: true });
    for (const root of roots) {
      if (!root) continue;
      const parent = (root.closest && root.closest('.item--child'))
        ? childListingParentRoot(root)
        : root;
      if (isGroupedParentListingRoot(parent)) return true;
    }
    return false;
  }

  // True when the user's own most recent selection is a BARE group parent (the group header row),
  // not a specific child. Clicking a parent just expands the 동일매물 cards and opens no detail of its
  // own — but the PREVIOUS listing's detail panel stays on screen, so detailPanelPresent would read
  // stale-true and the overlay would keep showing the old listing's result. This lets the gate treat
  // that leftover panel as stale and idle the overlay. A child selection (inside .item--child) is a
  // deliberate unit open and must NOT match here.
  function currentSelectionIsBareGroupParent() {
    if (lastClickedListingSource !== 'user') return false;
    const root = recentClickedListingRoot();
    if (!root) return false;
    if (root.closest && root.closest('.item--child')) return false;
    return isGroupedParentListingRoot(root);
  }

  // Stable identity of the 동일매물 group the currently-open child belongs to: the sorted set of its
  // siblings' articleNos. Empty unless the selection is a grouped child with >=2 members (so a lone
  // listing never shares a key). Used to inherit a sibling's confirmed exact.
  function selectedListingGroupKey() {
    // Naver's grouped-child DOM carries NO per-child articleNo (href="javascript:void(0)", no data-*),
    // and the active selection marker sits on `.item_inner.is-selected` / `.area.is-selected`, not on
    // `.item--child`. The only stable, sibling-IDENTICAL group identity is the expanded group
    // container `.item.is-expanded` — specifically its representative listing text + broker count,
    // which is byte-identical no matter which member of the group is currently open.
    const selected = document.querySelector('.item_inner.is-selected, .area.is-selected');
    if (!selected || typeof selected.closest !== 'function') return '';
    const group = selected.closest('.item.is-expanded');
    if (!group || typeof group.querySelector !== 'function') return '';
    const groupText = normalizeText(elementText(group));
    const brokerCount = currentRegionGroupedBrokerCount(groupText);
    // Only a genuine 동일매물 group (has child rows or a >1 broker count) yields a key.
    if (!group.querySelector('.item--child') && brokerCount <= 1) return '';
    // Key off the representative listing's own text (a direct `.item_inner` child of the group) — it
    // excludes the variable per-child snippets (which flip to "매물을 불러오는 중" until opened), so it
    // stays constant across sibling opens. Fall back to a bounded group-text prefix if absent.
    const representative = group.querySelector(':scope > .item_inner');
    const identity = normalizeText(elementText(representative) || groupText)
      .replace(/\s+/g, ' ')
      .slice(0, 200);
    if (!identity) return '';
    return `g${brokerCount || 0}:${identity}`;
  }


  function expandedListingRootKey(text) {
    return normalizeText(text).replace(/\s+/g, ' ').slice(0, 2000);
  }

  function expandedListingText(options = {}) {
    const allowSnapshot = options.allowSnapshot !== false;
    const roots = expandedListingRoots();
    const entries = roots
      .map((root) => {
        const text = listingTextForSelectionRoot(root);
        return { text, key: expandedListingRootKey(text) };
      })
      .filter((entry) => entry.text && entry.key);
    const previousKeys = new Set(lastExpandedListingRootKeys);
    const newlyExpanded = entries.find((entry) => !previousKeys.has(entry.key));
    const preferred = newlyExpanded || entries[entries.length - 1];
    const liveText = preferred ? preferred.text : '';
    const previousStillFresh = lastExpandedListingText && (Date.now() - lastExpandedListingAt) <= EXPANDED_LISTING_CONTEXT_TTL_MS;
    if (liveText && (newlyExpanded || !previousStillFresh || roots.length >= lastExpandedListingRootCount)) {
      lastExpandedListingText = liveText;
      lastExpandedListingAt = Date.now();
      lastExpandedListingRootCount = roots.length;
      lastExpandedListingRootKeys = entries.map((entry) => entry.key);
      return liveText;
    }
    if (allowSnapshot && previousStillFresh) {
      return lastExpandedListingText;
    }
    lastExpandedListingText = '';
    lastExpandedListingAt = 0;
    lastExpandedListingRootCount = 0;
    lastExpandedListingRootKeys = [];
    return '';
  }

  function urlArticleListingFallbackText() {
    if (!articleMarkerFromUrl()) return '';
    const visibleListings = Array.from(document.querySelectorAll('a.item_link'))
      .filter(isVisibleNode)
      .map((element) => ({
        element,
        top: element.getBoundingClientRect ? Math.round(element.getBoundingClientRect().top) : 0
      }))
      .filter((item) => item.top >= 0)
      .sort((left, right) => left.top - right.top);
    const first = visibleListings[0] && visibleListings[0].element;
    const text = normalizeText(elementText(first));
    const signal = classifyListingText(text);
    return signal.hasDong && signal.hasFloor && signal.pyeongTypeToken ? text : '';
  }

  function articleNoFromListingRoot(root) {
    if (!root) return '';
    const values = [];
    const elements = [root].concat(Array.from(root.querySelectorAll ? root.querySelectorAll('a[href], [data-article-no], [data-articleNo], [data-article], [data-atcl-no]') : []));
    elements.slice(0, 30).forEach((element) => {
      if (!element || typeof element.getAttribute !== 'function') return;
      values.push(
        element.getAttribute('href'),
        element.getAttribute('data-article-no'),
        element.getAttribute('data-articleNo'),
        element.getAttribute('data-article'),
        element.getAttribute('data-atcl-no')
      );
    });
    if (root.outerHTML) values.push(String(root.outerHTML).slice(0, 6000));
    for (const value of values) {
      const text = String(value || '');
      if (!text) continue;
      const match = text.match(/articleNo["'=:\s%26&?]*(\d{5,15})/i) ||
        text.match(/atcl(?:No|_no)?["'=:\s-]*(\d{5,15})/i);
      if (match) return match[1];
    }
    return '';
  }

  function articleMarkerFromSelectedListing() {
    const roots = selectedListingRoots();
    selectedArticleMarkerSource = '';
    let sawRepresentativeChild = false;
    for (const root of roots) {
      if (root && root.closest && root.closest('.item--child')) sawRepresentativeChild = true;
      const articleNo = articleNoFromListingRoot(root);
      if (articleNo) {
        selectedArticleMarkerSource = root && root.closest && root.closest('.item--child')
          ? 'representative-child'
          : 'selected-listing';
        return hashMarker(articleNo);
      }
    }
    if (sawRepresentativeChild) selectedArticleMarkerSource = 'representative-child';
    return '';
  }

  // (Removed) The representative-child auto-select cluster — maybeAutoSelectRepresentativeChild /
  // representativeChildSelectionCandidate / rememberRepresentativeChildSelection — was dead (no
  // caller) and implemented the forbidden auto-select ("nothing is ever auto-selected"). It was the
  // ONLY writer of lastClickedListingSource='auto'; the field is now only ever '' or 'user'.

  function floorSignalsMatch(left, right) {
    if (!left || !right) return false;
    if (left.floorKind === 'exact' && right.floorKind === 'exact') {
      return Number(left.floorValue || 0) > 0 && Number(left.floorValue || 0) === Number(right.floorValue || 0);
    }
    if (left.floorKind === 'band' && right.floorKind === 'band') {
      if (!left.floorBand || left.floorBand !== right.floorBand) return false;
      const leftTotal = Number(left.totalFloor || 0);
      const rightTotal = Number(right.totalFloor || 0);
      return !leftTotal || !rightTotal || leftTotal === rightTotal;
    }
    return false;
  }

  function floorSignalsConflict(left, right) {
    if (!left || !right) return false;
    if (left.floorKind === 'none' || right.floorKind === 'none') return false;
    return !floorSignalsMatch(left, right);
  }

  function recentListingConflictsWithDetail(recentListingText, detailContext, hasDetailPanel) {
    if (!recentListingText || !hasDetailPanel) return false;
    const recentDongToken = extractDongToken(recentListingText);
    const detailDongToken = detailContext.detailDongToken || '';
    if (recentDongToken && detailDongToken && recentDongToken !== detailDongToken) return true;

    const recentDealType = extractDealType(recentListingText);
    const detailDealType = detailContext.dealType || '';
    if (recentDealType && detailDealType && recentDealType !== detailDealType) return true;

    const recentPriceToken = extractPriceToken(recentListingText);
    const detailPriceToken = detailContext.priceToken || '';
    if (recentPriceToken && detailPriceToken && recentPriceToken !== detailPriceToken) return true;

    const recentSignal = classifyListingText(recentListingText);
    const detailSignal = {
      floorKind: detailContext.detailFloorKind || 'none',
      floorBand: detailContext.detailFloorBand || '',
      floorValue: Number(detailContext.floorValue || 0),
      totalFloor: Number(detailContext.totalFloor || 0)
    };
    if (floorSignalsConflict(detailSignal, recentSignal)) return true;

    const recentTypeToken = recentSignal.pyeongTypeToken || extractDetailTypeToken(recentListingText);
    const detailTypeToken = detailContext.detailTypeToken || '';
    return Boolean(recentTypeToken && detailTypeToken && recentTypeToken !== detailTypeToken);
  }

  function selectDetailFloorSignal(detailSignal, fallbackSignal, matchedListingText, hasDetailPanel) {
    const detail = detailSignal || {};
    const fallback = fallbackSignal || {};
    const hasMatchedListing = Boolean(matchedListingText);
    if (hasMatchedListing && fallback.floorKind && fallback.floorKind !== 'none') {
      if (!hasDetailPanel || !detail.floorKind || detail.floorKind === 'none') return fallback;
      if (detail.floorKind !== 'exact' && floorSignalsConflict(detail, fallback)) return fallback;
    }
    return hasDetailPanel ? detail : fallback;
  }

  function priceTokenInText(text, priceToken) {
    const token = normalizeText(priceToken).replace(/\s+/g, '');
    if (!token) return false;
    const compact = normalizeText(text).replace(/\s+/g, '');
    return compact.includes(token) || compact.replace(/,/g, '').includes(token.replace(/,/g, ''));
  }

  function listingDetailMatchScore(text, detailContext) {
    const normalized = normalizeText(text);
    if (!normalized) return 0;
    const detailDongToken = detailContext.detailDongToken || '';
    const listingDongToken = extractDongToken(normalized);
    if (detailDongToken && listingDongToken !== detailDongToken) return 0;

    const listingSignal = classifyListingText(normalized);
    const detailSignal = {
      floorKind: detailContext.detailFloorKind || 'none',
      floorBand: detailContext.detailFloorBand || '',
      floorValue: Number(detailContext.floorValue || 0),
      totalFloor: Number(detailContext.totalFloor || 0)
    };
    let score = listingDongToken ? 8 : 0;
    let floorMismatch = false;
    if (detailSignal.floorKind !== 'none') {
      if (floorSignalsMatch(detailSignal, listingSignal)) {
        score += 8;
      } else if (listingSignal.floorKind !== 'none') {
        floorMismatch = true;
      }
    }
    const detailDealType = detailContext.dealType || '';
    const listingDealType = extractDealType(normalized);
    if (detailDealType && listingDealType) {
      if (detailDealType !== listingDealType) return 0;
      score += 2;
    }
    if (detailContext.priceToken && priceTokenInText(normalized, detailContext.priceToken)) {
      score += 6;
    }
    if (listingSignal.pyeongTypeToken) score += 2;
    if (floorMismatch && score < 16) return 0;
    return score;
  }

  function matchingListingTextForDetail(detailContext) {
    const roots = selectedListingRoots()
      .concat(Array.from(document.querySelectorAll('a.item_link')).slice(0, 80))
      .filter((element, index, list) => element && list.indexOf(element) === index);
    let best = { score: 0, text: '' };
    roots.forEach((element) => {
      const text = listingTextForSelectionRoot(element);
      const score = listingDetailMatchScore(text, detailContext);
      if (score > best.score) best = { score, text };
    });
    return best.score >= 16 ? best.text : '';
  }

  function classifyListingText(text) {
    const normalized = normalizeText(text);
    const floor = classifyFloor(normalized);
    return {
      hasDong: new RegExp(`\\d{1,4}\\s*${DONG}`).test(normalized),
      hasFloor: floor.hasFloor,
      hasHo: new RegExp(`\\d{1,4}\\s*${HO}(?!\\s*(?:${LINE}|${UNIT_LINE}))`).test(normalized),
      hasSubwayLineHo: new RegExp(`\\d+\\s*${HO}\\s*${LINE}`).test(normalized),
      floorKind: floor.floorKind,
      floorBand: floor.floorBand,
      floorValue: floor.floorValue,
      totalFloor: floor.totalFloor,
      pyeongTypeToken: extractDetailTypeToken(normalized),
      directionToken: extractDirectionToken(normalized),
      unitLineHint: extractUnitLineHint(normalized),
      length: normalized.length
    };
  }

  function currentCdpTargetContext() {
    const input = cdpTargetContextOverride || window.__DHS_CDP_TARGET_CONTEXT__;
    const api = window.DHS_ARTICLE_STATE;
    if (!api || typeof api.isFreshCdpTargetContext !== 'function') return null;
    return api.isFreshCdpTargetContext(input) ? input : null;
  }

  function applyCdpTargetContext(input) {
    if (!input || typeof input !== 'object') return false;
    const appliedAt = Math.max(0, Number(input.__dhsAppliedAt || 0) || 0);
    if (state.cdpResolverFinalPresent && appliedAt > Number(state.cdpResolverFinalAt || 0)) {
      resetCdpResolverFinal('new-target-context');
      state.currentListingElapsedKey = '';
      state.currentListingElapsedSec = 0;
    }
    cdpTargetContextOverride = input;
    return true;
  }

  function cdpTargetContextFallback() {
    const input = currentCdpTargetContext();
    if (!input || typeof input !== 'object') {
      return {
        detailDongToken: '',
        detailFloorKind: 'none',
        detailFloorBand: '',
        floorValue: 0,
        totalFloor: 0,
        detailTypeToken: '',
        detailTypeAliases: [],
        detailDirectionToken: '',
        detailExclusiveSpace: 0,
        detailPyeongNo: '',
        dealType: '',
        priceToken: '',
        providerName: ''
      };
    }

    const text = normalizeText([
      input.text,
      input.detailText,
      input.detailDongToken,
      input.detailFloorText,
      input.detailTypeToken,
      input.detailDirectionToken,
      input.dealType,
      input.priceToken,
      input.providerName,
      input.cpName,
      input.provider
    ].filter(Boolean).join(' '));
    const floorKindInput = String(input.detailFloorKind || input.floorKind || '').toLowerCase();
    const rawFloorValue = sanitizeArticleDetailFloorValue(input.floorValue || input.detailFloorValue || 0);
    const totalFloor = sanitizeArticleDetailTotalFloor(input.totalFloor || input.detailTotalFloor || 0);
    const floorBandInput = String(input.detailFloorBand || input.floorBand || '').toLowerCase();
    const detailFloorBand = ['low', 'mid', 'high'].includes(floorBandInput) ? floorBandInput : '';
    const detailFloorKind = ['exact', 'band', 'loose', 'none'].includes(floorKindInput)
      ? floorKindInput
      : (rawFloorValue ? 'exact' : (detailFloorBand ? 'band' : 'none'));
    const floorValue = detailFloorKind === 'exact' ? rawFloorValue : 0;
    const api = window.DHS_LINE_INFERENCE;
    const normalizeType = (value) => api && typeof api.normalizeTypeToken === 'function'
      ? api.normalizeTypeToken(value)
      : normalizeText(value);
    const rawType = input.detailTypeToken || input.typeToken || input.areaToken || input.detailExclusiveSpace || '';
    const detailTypeToken = normalizeType(rawType);
    const detailTypeAliases = [];
    appendTypeAlias(detailTypeAliases, detailTypeToken);
    if (Array.isArray(input.detailTypeAliases)) {
      input.detailTypeAliases.slice(0, 8).forEach((alias) => appendTypeAlias(detailTypeAliases, alias));
    }
    appendTypeAlias(detailTypeAliases, input.areaHint || input.areaToken || '');
    appendTypeAlias(detailTypeAliases, input.detailExclusiveSpace || input.exclusiveSpace || '');

    return {
      detailDongToken: extractDongToken(input.detailDongToken || input.dongToken || input.dong || text),
      detailFloorKind,
      detailFloorBand,
      floorValue,
      totalFloor,
      detailTypeToken,
      detailTypeAliases: detailTypeAliases.slice(0, 6),
      detailDirectionToken: extractDirectionToken(input.detailDirectionToken || input.directionToken || input.direction || text),
      detailExclusiveSpace: normalizeAreaValue(input.detailExclusiveSpace || input.exclusiveSpace || 0),
      detailPyeongNo: sanitizeArticleDetailPyeongNo(input.detailPyeongNo || input.pyeongNo || ''),
      dealType: extractDealType(input.dealType || text),
      priceToken: normalizeText(input.priceToken || extractPriceToken(text)).replace(/\s+/g, '').slice(0, 40),
      providerName: normalizeText(input.providerName || input.cpName || input.provider || '').slice(0, 80)
    };
  }

  function cdpTargetArticleMarkerForDetail(detailFloor) {
    const input = currentCdpTargetContext();
    const marker = input && typeof input === 'object' ? sanitizeArticleMarker(input.articleMarker || '') : '';
    if (!marker || !detailFloor || !detailFloor.detailScreenContextPresent) return '';

    const targetDong = extractDongToken(input.detailDongToken || input.dongToken || input.dong || '');
    const activeDong = extractDongToken(detailFloor.detailDongToken || '');
    if (targetDong && activeDong && targetDong !== activeDong) return '';

    const floorKind = String(detailFloor.detailFloorKind || detailFloor.floorKind || 'none').toLowerCase();
    const floorValue = sanitizeArticleDetailFloorValue(detailFloor.floorValue || detailFloor.detailFloorValue || 0);
    const totalFloor = sanitizeArticleDetailTotalFloor(detailFloor.totalFloor || detailFloor.detailTotalFloor || input.detailTotalFloor || input.totalFloor || 0);
    const floorBand = String(detailFloor.detailFloorBand || detailFloor.floorBand || '').toLowerCase();
    const targetFloorKind = String(input.detailFloorKind || input.floorKind || '').toLowerCase();
    const targetFloorValue = sanitizeArticleDetailFloorValue(input.floorValue || input.detailFloorValue || 0);
    const targetTotalFloor = sanitizeArticleDetailTotalFloor(input.totalFloor || input.detailTotalFloor || totalFloor || 0);
    const targetFloorBand = String(input.detailFloorBand || input.floorBand || '').toLowerCase();

    if (targetFloorKind === 'exact' && targetFloorValue && floorKind === 'exact' && floorValue && targetFloorValue !== floorValue) return '';
    if (targetFloorKind === 'exact' && targetFloorValue && floorKind === 'band' && floorBand && totalFloor) {
      const range = bandRange(floorBand, totalFloor);
      if (range && (targetFloorValue < range[0] || targetFloorValue > range[1])) return '';
    }
    if (targetFloorKind === 'band' && targetFloorBand && targetTotalFloor && floorKind === 'exact' && floorValue) {
      const range = bandRange(targetFloorBand, targetTotalFloor);
      if (range && (floorValue < range[0] || floorValue > range[1])) return '';
    }
    if (targetFloorKind === 'band' && targetFloorBand && floorKind === 'band' && floorBand && targetFloorBand !== floorBand) return '';

    const api = window.DHS_LINE_INFERENCE;
    const normalizeType = (value) => api && typeof api.normalizeTypeToken === 'function'
      ? api.normalizeTypeToken(value)
      : normalizeText(value);
    const typeCompatible = (left, right) => {
      if (api && typeof api.typeTokensCompatible === 'function') return api.typeTokensCompatible(left, right);
      const leftText = normalizeType(left).replace(/[^0-9A-Z]/gi, '').toUpperCase();
      const rightText = normalizeType(right).replace(/[^0-9A-Z]/gi, '').toUpperCase();
      if (!leftText || !rightText || leftText === rightText) return true;
      const leftNumber = leftText.replace(/[^0-9]/g, '');
      const rightNumber = rightText.replace(/[^0-9]/g, '');
      const leftSuffix = leftText.replace(/[0-9]/g, '');
      const rightSuffix = rightText.replace(/[0-9]/g, '');
      return Boolean(leftNumber && leftNumber === rightNumber && (!leftSuffix || !rightSuffix));
    };
    const activeTypes = [
      detailFloor.detailTypeToken,
      ...(Array.isArray(detailFloor.detailTypeAliases) ? detailFloor.detailTypeAliases : [])
    ].map(normalizeType).filter(Boolean);
    const targetTypes = [
      input.detailTypeToken,
      input.typeToken,
      input.areaToken,
      input.detailExclusiveSpace,
      input.exclusiveSpace,
      ...(Array.isArray(input.detailTypeAliases) ? input.detailTypeAliases : [])
    ].map(normalizeType).filter(Boolean);
    if (activeTypes.length && targetTypes.length && !targetTypes.some((targetType) => activeTypes.some((activeType) => typeCompatible(targetType, activeType)))) return '';

    const targetDirection = extractDirectionToken(input.detailDirectionToken || input.directionToken || input.direction || '');
    const activeDirection = extractDirectionToken(detailFloor.detailDirectionToken || '');
    if (targetDirection && activeDirection && targetDirection !== activeDirection) return '';

    return marker;
  }

  function currentCdpTargetContextMarker() {
    const input = currentCdpTargetContext();
    return input && typeof input === 'object' ? sanitizeArticleMarker(input.articleMarker || '') : '';
  }

  function resetCdpResolverFinal(reason) {
    state.cdpResolverFinalPresent = false;
    state.cdpResolverFinalArticleMarker = '';
    state.cdpResolverFinalStatus = '';
    state.cdpResolverFinalExact = '';
    state.cdpResolverFinalDisplay = '';
    state.cdpResolverFinalSource = '';
    state.cdpResolverFinalBranch = '';
    state.cdpResolverFinalOutcome = reason || '';
    state.cdpResolverFinalRejectedReason = '';
    state.cdpResolverFinalCandidateCount = 0;
    state.cdpResolverFinalDurationMs = 0;
    state.cdpResolverFinalAt = 0;
    state.cdpResolverFinalRunKey = '';
  }

  function sanitizeCdpResolverSource(value) {
    return String(value || '').replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 80);
  }

  function cdpResolverFinalPayload() {
    const input = window.__DHS_CDP_RESOLVER_FINAL__;
    return input && typeof input === 'object' ? input : {};
  }

  function cdpResolverTerminalStatus(value) {
    const status = String(value || '').replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 40);
    return ['exact', 'multiple-candidates', 'unresolved'].includes(status) ? status : '';
  }

  function sanitizeCdpResolverCollectedAt(value) {
    const text = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(text)) return '';
    const timestamp = Date.parse(text);
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '';
  }

  function cdpResolverFinalPayloadFingerprint(input) {
    const text = String(input || '');
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return `final:${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }

  function currentCdpActiveArticleMarkers() {
    const validatedTargetMarker = cdpTargetArticleMarkerForDetail(state);
    if (validatedTargetMarker) return [validatedTargetMarker];
    const activeMarker = sanitizeArticleMarker(state.articleMarker || '');
    return activeMarker ? [activeMarker] : [];
  }

  function applyCdpResolverFinal(input) {
    const payload = input && typeof input === 'object' ? input : cdpResolverFinalPayload();
    const status = cdpResolverTerminalStatus(payload.status);
    const articleMarker = sanitizeArticleMarker(payload.articleMarker || '');
    const collectedAt = sanitizeCdpResolverCollectedAt(payload.collectedAt);
    const runKey = articleMarker && collectedAt ? `${articleMarker}|${collectedAt}` : '';
    const exact = normalizeText(payload.exact || payload.primaryValue || '').slice(0, 80);
    const display = normalizeText(payload.display || payload.dongHo || payload.primaryValue || exact);
    const presentation = dongHoPresentationApi();
    const displayCandidateCount = status === 'multiple-candidates' && presentation && typeof presentation.candidateCount === 'function'
      ? presentation.candidateCount({ display })
      : 0;
    const candidateCount = status === 'exact' ? 1 : Math.min(999, Math.max(0, displayCandidateCount));
    if (!status || !articleMarker || !runKey) {
      resetCdpResolverFinal('invalid-final');
      return false;
    }
    if (status === 'exact' && (!exact || !exactDisplayKey(exact))) {
      resetCdpResolverFinal('invalid-final');
      return false;
    }
    if (status === 'multiple-candidates' && (!display || candidateCount < 1)) {
      resetCdpResolverFinal('invalid-final');
      return false;
    }
    const activeMarkers = currentCdpActiveArticleMarkers();
    if (!activeMarkers.length) {
      resetCdpResolverFinal('target-context-missing');
      return false;
    }
    if (activeMarkers.some((marker) => marker !== articleMarker)) {
      resetCdpResolverFinal('target-context-mismatch');
      return false;
    }
    const durationMs = Math.max(0, Math.min(3600000, Math.floor(Number(payload.elapsedMs || 0) || 0)));
    const finalDisplay = status === 'exact' ? exact : display;
    const rejectedReason = status === 'exact'
      ? ''
      : sanitizeCdpResolverSource(payload.qualityRejectedReason || payload.exactRejectedReason || '');
    const fingerprint = cdpResolverFinalPayloadFingerprint([
      status,
      exact,
      finalDisplay,
      durationMs,
      sanitizeCdpResolverSource(payload.source || ''),
      sanitizeCdpResolverSource(payload.branch || ''),
      sanitizeCdpResolverSource(payload.outcome || ''),
      rejectedReason
    ].join('|'));
    const seenRunReplay = state.cdpResolverFinalSeenRunKey === runKey
      && state.cdpResolverFinalSeenFingerprint === fingerprint;
    if (
      state.cdpResolverFinalSeenRunKey === runKey
      && state.cdpResolverFinalSeenFingerprint
      && state.cdpResolverFinalSeenFingerprint !== fingerprint
    ) return false;
    if (state.cdpResolverFinalRunKey === runKey) {
      return state.cdpResolverFinalStatus === status
        && state.cdpResolverFinalExact === exact
        && state.cdpResolverFinalDisplay === finalDisplay
        && state.cdpResolverFinalDurationMs === durationMs;
    }
    state.cdpResolverFinalPresent = true;
    state.cdpResolverFinalArticleMarker = articleMarker;
    state.cdpResolverFinalStatus = status;
    state.cdpResolverFinalExact = exact;
    state.cdpResolverFinalDisplay = finalDisplay;
    state.cdpResolverFinalSource = sanitizeCdpResolverSource(payload.source || 'cdp-final');
    state.cdpResolverFinalBranch = sanitizeCdpResolverSource(payload.branch || 'cdp-final');
    state.cdpResolverFinalOutcome = sanitizeCdpResolverSource(payload.outcome || `cdp-final-${status}`);
    state.cdpResolverFinalRejectedReason = rejectedReason;
    state.cdpResolverFinalCandidateCount = candidateCount;
    state.cdpResolverFinalDurationMs = durationMs;
    state.cdpResolverFinalAt = Date.now();
    state.cdpResolverFinalRunKey = runKey;
    state.cdpResolverFinalSeenRunKey = runKey;
    state.cdpResolverFinalSeenFingerprint = fingerprint;
    state.currentListingElapsedKey = currentListingElapsedContextKey();
    state.currentListingElapsedSec = state.cdpResolverFinalDurationMs
      ? Math.max(1, Math.ceil(state.cdpResolverFinalDurationMs / 1000))
      : Math.max(1, Number(state.routeSearchElapsedSec || 0) || 0);
    if (!seenRunReplay && status === 'exact' && currentListingExactResolution(exact).dongHoStatus === 'exact') {
      markExactEvidenceReceipt('cdp', [
        runKey,
        fingerprint
      ].join('|'));
    }
    return true;
  }

  function cdpResolverFinalMatchesCurrentContext() {
    if (!state.cdpResolverFinalPresent) return false;
    const status = cdpResolverTerminalStatus(state.cdpResolverFinalStatus);
    if (!status) return false;
    if (status === 'exact' && !state.cdpResolverFinalExact) return false;
    const finalMarker = sanitizeArticleMarker(state.cdpResolverFinalArticleMarker || '');
    if (!finalMarker) return false;
    const activeMarkers = currentCdpActiveArticleMarkers();
    if (!activeMarkers.length) return false;
    if (activeMarkers.some((marker) => marker !== finalMarker)) return false;
    if (state.cdpResolverFinalAt && Date.now() - state.cdpResolverFinalAt > CDP_RESOLVER_FINAL_TTL_MS) return false;
    return true;
  }

  function cdpResolverFinalResolutionForOverlay() {
    if (!cdpResolverFinalMatchesCurrentContext()) return null;
    const status = cdpResolverTerminalStatus(state.cdpResolverFinalStatus);
    if (status === 'exact') {
      return {
        dongHoStatus: 'exact',
        dongHo: normalizeText(state.cdpResolverFinalExact)
      };
    }
    if (status === 'multiple-candidates') {
      const display = normalizeText(state.cdpResolverFinalDisplay);
      return {
        dongHoStatus: status,
        dongHo: display,
        qualityRejectedReason: state.cdpResolverFinalRejectedReason || ''
      };
    }
    return {
      dongHoStatus: status,
      dongHo: REGION_EXPORT_UNRESOLVED_LABEL,
      qualityRejectedReason: state.cdpResolverFinalRejectedReason || ''
    };
  }

  function hashMarker(value) {
    const input = String(value || '');
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return `article:${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }

  function typedHashMarker(type, value) {
    const digest = hashMarker(value).replace(/^article:/, '');
    return `${String(type || 'marker').replace(/[^a-z]/gi, '').toLowerCase()}:${digest}`;
  }

  function providerContextArticleMarker() {
    const typeTokens = detailTypeTokenList(state).join(',');
    if (!state.detailDongToken || !typeTokens) return '';
    const key = [
      'provider-context',
      state.detailDongToken || '',
      typeTokens,
      state.detailPyeongNo || '',
      Math.round((Number(state.detailExclusiveSpace || 0) || 0) * 100),
      state.detailDirectionToken || '',
      state.detailFloorKind || '',
      state.detailFloorBand || '',
      Number(state.detailFloorValue || 0) || 0,
      Number(state.detailTotalFloor || 0) || 0
    ].join('|');
    return hashMarker(key);
  }

  function detailContextArticleMarker(detailFloor) {
    const detail = detailFloor && typeof detailFloor === 'object' ? detailFloor : {};
    const typeTokens = detailTypeTokenList(detail).join(',');
    const dongToken = detail.detailDongToken || '';
    if (!dongToken || !typeTokens) return '';
    const key = [
      'detail-context',
      dongToken,
      typeTokens,
      detail.detailPyeongNo || '',
      Math.round((Number(detail.detailExclusiveSpace || 0) || 0) * 100),
      detail.detailDirectionToken || '',
      detail.detailFloorKind || '',
      detail.detailFloorBand || '',
      Number(detail.floorValue || detail.detailFloorValue || 0) || 0,
      Number(detail.totalFloor || detail.detailTotalFloor || 0) || 0
    ].join('|');
    return hashMarker(key);
  }

  function activeProviderArticleMarker() {
    return state.articleMarker || providerContextArticleMarker();
  }

  function exactDisplayKey(value) {
    const api = window.DHS_DONGHO_QUALITY;
    if (api && typeof api.exactDisplayKey === 'function') return api.exactDisplayKey(value);
    const matches = [...normalizeText(value).matchAll(/(\d{1,4})\s*\uB3D9\s*(\d{1,4})\s*\uD638/g)];
    if (matches.length !== 1) return '';
    return `${Number(matches[0][1]) || matches[0][1]}:${Number(matches[0][2]) || matches[0][2]}`;
  }

  function csvCell(value) {
    const text = String(value || '');
    const safeText = /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
    return /[",\r\n]/.test(safeText) ? `"${safeText.replace(/"/g, '""')}"` : safeText;
  }

  function delayMs(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, Number(ms || 0));
    });
  }

  function currentRegionLabel() {
    const selected = currentRegionSelection();
    if (selected.complete) return selected.label;
    const candidates = Array.from(document.querySelectorAll('button, a, span, div'))
      .map((element) => normalizeText(element.innerText || element.textContent || ''))
      .filter((text) => /(?:경기도|서울|부산|대구|인천|광주|대전|울산|세종|강원|충청|전라|경상|제주|하남시|감이동)/.test(text))
      .slice(0, 8);
    return normalizeText(candidates.join(' ')).slice(0, 120);
  }

  async function regionExportMarkerDigest(value) {
    const input = String(value || '');
    if (
      !input ||
      typeof crypto === 'undefined' ||
      !crypto.subtle ||
      typeof TextEncoder === 'undefined'
    ) return '';
    try {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
      return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 32);
    } catch (_) {
      return '';
    }
  }

  function regionExportRandomMarkerNonce() {
    if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') return '';
    try {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
    } catch (_) {
      return '';
    }
  }

  async function regionExportCheckpointMarkerNonce() {
    if (regionExportMarkerNoncePromise) return regionExportMarkerNoncePromise;
    regionExportMarkerNoncePromise = (async () => {
      const read = await regionExportStorageCall('get', [REGION_EXPORT_MARKER_NONCE_STORAGE_KEY]);
      const existing = normalizeText(read.value && read.value[REGION_EXPORT_MARKER_NONCE_STORAGE_KEY]).toLowerCase();
      if (read.ok && /^[0-9a-f]{32}$/.test(existing)) return existing;
      const generated = regionExportRandomMarkerNonce();
      if (!generated) return '';
      const stored = await regionExportStorageCall('set', {
        [REGION_EXPORT_MARKER_NONCE_STORAGE_KEY]: generated
      });
      if (!stored.ok) return '';
      const confirmed = await regionExportStorageCall('get', [REGION_EXPORT_MARKER_NONCE_STORAGE_KEY]);
      const value = normalizeText(confirmed.value && confirmed.value[REGION_EXPORT_MARKER_NONCE_STORAGE_KEY]).toLowerCase();
      return confirmed.ok && /^[0-9a-f]{32}$/.test(value) ? value : '';
    })();
    const nonce = await regionExportMarkerNoncePromise;
    if (!nonce) regionExportMarkerNoncePromise = null;
    return nonce;
  }

  function regionExportSelectionApi() {
    return window.DHS_REGION_EXPORT_SELECTION || {};
  }

  function currentRegionSelection() {
    const api = regionExportSelectionApi();
    const selectors = [
      '.filter_region .area.is-selected',
      '.filter_btn_region .area.is-selected'
    ];
    let bestValues = [];
    for (const selector of selectors) {
      const values = [];
      const seen = new Set();
      Array.from(document.querySelectorAll(selector))
        .filter(isVisibleNode)
        .map(currentRegionVisibleText)
        .map(normalizeText)
        .filter(Boolean)
        .forEach((value) => {
          if (values.length >= 4) return;
          const key = value.replace(/\s+/g, '').toLowerCase();
          if (!key || seen.has(key)) return;
          seen.add(key);
          values.push(value);
        });
      if (values.length > bestValues.length) bestValues = values;
      if (values.length >= 3 && typeof api.createSelection === 'function') {
        return api.createSelection(values);
      }
    }
    return typeof api.createSelection === 'function'
      ? api.createSelection(bestValues)
      : { sido: '', sigungu: '', eupMyeonDong: '', values: [], key: '', label: '', complete: false };
  }

  function currentRegionSelectionMatchesKey(selectionKey) {
    const expectedKey = normalizeText(selectionKey);
    if (!expectedKey) return true;
    const api = regionExportSelectionApi();
    if (typeof api.createSelection !== 'function' || typeof api.sameSelection !== 'function') return false;
    const expected = api.createSelection(expectedKey.split('|'));
    return Boolean(expected.complete && api.sameSelection(expected, currentRegionSelection()));
  }

  function regionExportSelectionProofMatches(confirmedSelection) {
    return state.regionExportSelectionProof === 'selector-complete'
      && Boolean(confirmedSelection && confirmedSelection.complete)
      && confirmedSelection.key === state.regionExportSelectionKey;
  }

  function currentRegionExportSelectionMatches(confirmedSelection) {
    const api = regionExportSelectionApi();
    const currentMatches = Boolean(
      confirmedSelection
      && confirmedSelection.complete
      && typeof api.sameSelection === 'function'
      && api.sameSelection(confirmedSelection, currentRegionSelection())
    );
    return currentMatches || regionExportSelectionProofMatches(confirmedSelection);
  }

  function currentRegionComplexPopupSelection() {
    const api = regionExportSelectionApi();
    if (typeof api.createSelection !== 'function') {
      return { sido: '', sigungu: '', eupMyeonDong: '', values: [], key: '', label: '', complete: false };
    }
    const popupValues = Array.from(document.querySelectorAll('.filter_popup--area .area_select_item:not(.is-disabled)'))
      .filter(isVisibleNode)
      .map(currentRegionVisibleText)
      .map(normalizeText)
      .filter(Boolean)
      .slice(0, 3);
    return api.createSelection(popupValues);
  }

  function currentRegionComplexPopupMatchesKey(selectionKey) {
    const expectedKey = normalizeText(selectionKey);
    if (!expectedKey || !currentRegionComplexListIsOpen()) return false;
    const api = regionExportSelectionApi();
    if (typeof api.createSelection !== 'function' || typeof api.sameSelection !== 'function') return false;
    const expected = api.createSelection(expectedKey.split('|'));
    const popupSelection = currentRegionComplexPopupSelection();
    return Boolean(expected.complete && popupSelection.complete && api.sameSelection(expected, popupSelection));
  }

  function currentRegionComplexContextMatchesKey(selectionKey) {
    return currentRegionSelectionMatchesKey(selectionKey)
      || currentRegionComplexPopupMatchesKey(selectionKey);
  }

  function currentRegionSelectedAreaKey() {
    return currentRegionSelection().key;
  }

  async function currentRegionContextMarker(expectedSelectionKey) {
    const selectedAreaKey = expectedSelectionKey || currentRegionSelectedAreaKey();
    if (!selectedAreaKey) return '';
    const api = regionExportSelectionApi();
    const expectedSelection = typeof api.createSelection === 'function'
      ? api.createSelection(String(selectedAreaKey).split('|'))
      : currentRegionSelection();
    if (
      expectedSelectionKey
      && (
        !expectedSelection.complete
        || !currentRegionComplexContextMatchesKey(expectedSelection.key)
      )
    ) return '';
    let context = selectedAreaKey;
    try {
      const url = new URL(location.href);
      const ignoredKeys = new Set(['articleno', 'articlenumber', 'atclno', 'complexno', 'hscpno', 'ms']);
      const params = Array.from(url.searchParams.entries())
        .filter(([key]) => !ignoredKeys.has(String(key || '').toLowerCase()))
        .map(([key, value]) => `${key}=${value}`)
        .sort();
      context = [url.origin, selectedAreaKey, params.join('&')].filter(Boolean).join('|');
    } catch (_) {
      context = selectedAreaKey;
    }
    const nonce = await regionExportCheckpointMarkerNonce();
    const digest = nonce ? await regionExportMarkerDigest(`${nonce}|region|${context}`) : '';
    return digest ? `region:${digest}` : '';
  }

  function currentRegionVisibleText(element) {
    if (!element) return '';
    return normalizeText(
      element.innerText ||
      element.textContent ||
      element.getAttribute && element.getAttribute('aria-label') ||
      element.getAttribute && element.getAttribute('title') ||
      ''
    );
  }

  function currentRegionComplexDropdownTrigger() {
    const scoped = document.querySelector('.filter_region .area.type_complex')
      || document.querySelector('.filter_btn_region .area.type_complex');
    if (scoped && isVisibleNode(scoped)) return scoped;
    const segment = Array.from(document.querySelectorAll('.area.type_complex'))
      .filter(isVisibleNode)
      .find((element) => currentRegionVisibleText(element).includes('\uB2E8\uC9C0'));
    if (segment) return segment;
    const direct = Array.from(document.querySelectorAll('a.filter_btn_region, button.filter_btn_region'))
      .filter(isVisibleNode)
      .find((element) => currentRegionVisibleText(element).includes('\uB2E8\uC9C0'));
    if (direct) return direct;
    return Array.from(document.querySelectorAll('a[aria-expanded], button[aria-expanded], [role="button"][aria-expanded]'))
      .filter(isVisibleNode)
      .find((element) => currentRegionVisibleText(element).includes('\uB2E8\uC9C0')) || null;
  }

  function currentRegionComplexTriggerIsClickable(trigger) {
    if (!trigger || !isVisibleNode(trigger) || typeof trigger.getBoundingClientRect !== 'function') return false;
    const rect = trigger.getBoundingClientRect();
    if (!rect || rect.width < 1 || rect.height < 1) return false;
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) return false;
    const hit = document.elementFromPoint(x, y);
    if (!hit) return false;
    return hit === trigger
      || (typeof trigger.contains === 'function' && trigger.contains(hit))
      || (typeof hit.contains === 'function' && hit.contains(trigger));
  }

  function currentRegionVisibleArticleDetailCloseButton() {
    const selectors = [
      '.detail_panel button.btn_close[aria-label="\uC0C1\uC138\uD398\uC774\uC9C0 \uB2EB\uAE30"]',
      '.detail_contents button.btn_close[aria-label="\uC0C1\uC138\uD398\uC774\uC9C0 \uB2EB\uAE30"]',
      'button.btn_close[aria-label="\uC0C1\uC138\uD398\uC774\uC9C0 \uB2EB\uAE30"]'
    ];
    return selectors
      .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
      .find(isVisibleNode) || null;
  }

  function currentRegionSelectorTrigger() {
    return Array.from(document.querySelectorAll(
      '.filter_region a.filter_btn_region, .filter_region button.filter_btn_region, a.filter_btn_region, button.filter_btn_region'
    )).filter(isVisibleNode)[0] || null;
  }

  function currentRegionSelectorExpanded() {
    const trigger = currentRegionSelectorTrigger();
    const pickerVisible = Array.from(document.querySelectorAll(
      '.filter_popup--area .area_select_item, .filter_popup--area label.radio_label_district'
    )).some(isVisibleNode);
    return Boolean(
      trigger
      && trigger.getAttribute('aria-expanded') === 'true'
      && pickerVisible
    );
  }

  function normalizeRegionSelectionLevel(value) {
    const level = String(value || '').toLowerCase();
    return REGION_EXPORT_SELECTION_LEVELS.includes(level) ? level : 'sido';
  }

  function currentRegionLevelStepTarget(level) {
    if (!currentRegionSelectorExpanded()) return null;
    const items = Array.from(document.querySelectorAll('.filter_region .area_select_item'))
      .filter(isVisibleNode);
    const levelIndex = REGION_EXPORT_SELECTION_LEVELS.indexOf(normalizeRegionSelectionLevel(level));
    return items[levelIndex] || null;
  }

  function currentRegionSelectorOptionTarget(value) {
    const expected = normalizeText(value);
    if (!expected || !currentRegionSelectorExpanded()) return null;
    return Array.from(document.querySelectorAll('.filter_popup--area label.radio_label_district'))
      .filter(isVisibleNode)
      .find((element) => currentRegionVisibleText(element) === expected) || null;
  }

  async function waitForCurrentRegionSelectorOption(value, timeoutMs = 1600) {
    const deadline = Date.now() + Math.max(100, Number(timeoutMs || 0) || 0);
    let target = currentRegionSelectorOptionTarget(value);
    while (!target && Date.now() < deadline) {
      await delayMs(80);
      target = currentRegionSelectorOptionTarget(value);
    }
    return target;
  }

  async function clickCurrentRegionSelectorControl(target) {
    const clicked = await dispatchRegionExportTrustedClick(target, 'region-export-selector-option');
    if (!clicked) return false;
    await delayMs(120);
    return true;
  }

  async function selectCurrentRegionSelectorOption(value) {
    const target = await waitForCurrentRegionSelectorOption(value);
    if (!target) return false;
    return clickCurrentRegionSelectorControl(target);
  }

  async function positionCurrentRegionSelectorAtLevel(level, selection) {
    const desiredLevel = normalizeRegionSelectionLevel(level);
    const selectedPath = selection && typeof selection === 'object' ? selection : {};
    const resetToSido = async () => {
      const sidoStep = currentRegionLevelStepTarget('sido');
      if (!sidoStep) return { ok: false, reason: 'region-sido-step-unavailable' };
      const moved = await clickCurrentRegionSelectorControl(sidoStep);
      if (!moved) return { ok: false, reason: 'region-sido-step-failed' };
      const ready = !selectedPath.sido || Boolean(await waitForCurrentRegionSelectorOption(selectedPath.sido));
      return ready
        ? { ok: true, reason: '' }
        : { ok: false, reason: 'region-sido-options-unavailable' };
    };
    const ensureSigunguOptions = async () => {
      if (selectedPath.sigungu && currentRegionSelectorOptionTarget(selectedPath.sigungu)) {
        return { ok: true, reason: '' };
      }
      if (!selectedPath.sido) return { ok: false, reason: 'region-sido-parent-unavailable' };
      const reset = await resetToSido();
      if (!reset.ok) return reset;
      if (!await selectCurrentRegionSelectorOption(selectedPath.sido)) {
        return { ok: false, reason: 'region-sido-parent-failed' };
      }
      const ready = !selectedPath.sigungu || Boolean(
        await waitForCurrentRegionSelectorOption(selectedPath.sigungu)
      );
      return ready
        ? { ok: true, reason: '' }
        : { ok: false, reason: 'region-sigungu-options-unavailable' };
    };

    if (desiredLevel === 'sido') return resetToSido();
    if (desiredLevel === 'sigungu') return ensureSigunguOptions();
    if (selectedPath.eupMyeonDong && currentRegionSelectorOptionTarget(selectedPath.eupMyeonDong)) {
      return { ok: true, reason: '' };
    }
    if (!selectedPath.sigungu) return { ok: false, reason: 'region-sigungu-parent-unavailable' };
    const sigunguOptions = await ensureSigunguOptions();
    if (!sigunguOptions.ok) return sigunguOptions;
    if (!await selectCurrentRegionSelectorOption(selectedPath.sigungu)) {
      return { ok: false, reason: 'region-sigungu-parent-failed' };
    }
    const ready = !selectedPath.eupMyeonDong || Boolean(
      await waitForCurrentRegionSelectorOption(selectedPath.eupMyeonDong)
    );
    return ready
      ? { ok: true, reason: '' }
      : { ok: false, reason: 'region-dong-options-unavailable' };
  }

  async function waitForCurrentRegionSelectorExpanded(expected, timeoutMs = 1600) {
    const deadline = Date.now() + Math.max(100, Number(timeoutMs || 0) || 0);
    while (Date.now() < deadline) {
      if (currentRegionSelectorExpanded() === Boolean(expected)) return true;
      await delayMs(80);
    }
    return currentRegionSelectorExpanded() === Boolean(expected);
  }

  function refreshRegionExportSelectionState() {
    // No-op in the DHS-native picker: the selecting→confirming transition now happens synchronously in
    // pickCurrentRegionOptionFromOverlay (leaf 동 picked). This used to poll Naver's visual selector,
    // which is exactly what made the map react during selection. Kept for scanPage() call compatibility.
    return false;
  }

  function regionSelectionOptionFromEventTarget(target) {
    if (!target || typeof target.closest !== 'function') return null;
    const option = target.closest('.filter_popup--area label.radio_label_district');
    return option && isVisibleNode(option) ? option : null;
  }

  function scheduleRegionSelectionUiRefresh(expectedOptionText = '') {
    const expected = normalizeText(expectedOptionText);
    [0, 70, 180, 400, 800].forEach((waitMs) => {
      window.setTimeout(() => safeBridgeTask(() => {
        if (!['selecting-region', 'confirming-region'].includes(state.regionExportStatus)) return;
        const popupSelection = currentRegionComplexPopupSelection();
        const visibleSelection = popupSelection.values.length ? popupSelection : currentRegionSelection();
        if (expected && !visibleSelection.values.includes(expected)) return;
        refreshRegionExportSelectionState();
        renderOverlay();
      }), waitMs);
    });
  }

  async function openCurrentRegionSelector(level = 'sido') {
    if (!['selecting-region', 'confirming-region'].includes(state.regionExportStatus)) return false;
    const selectedPath = currentRegionSelection();
    state.regionExportSelectionLevel = normalizeRegionSelectionLevel(level);
    state.regionExportStatus = 'selecting-region';
    state.regionExportSelectionKey = '';
    state.regionExportSelectionLabel = '';
    state.regionExportSelectionValues = [];
    state.regionExportSelectionProof = '';
    state.regionExportSelectorWasExpanded = false;
    state.regionExportSelectorReady = false;
    state.regionExportSelectionError = '';
    renderOverlay();

    let trigger = currentRegionSelectorTrigger();
    if (!trigger) {
      state.regionExportSelectionError = 'region-selector-unavailable';
      renderOverlay();
      return false;
    }
    if (!currentRegionComplexTriggerIsClickable(trigger)) {
      const closeButton = currentRegionVisibleArticleDetailCloseButton();
      const closed = closeButton
        ? await dispatchRegionExportTrustedClick(closeButton, 'region-export-region-detail-close')
        : false;
      if (!closed) {
        state.regionExportSelectionError = 'region-selector-occluded';
        renderOverlay();
        return false;
      }
      await delayMs(REGION_EXPORT_COMPLEX_SETTLE_MS);
      trigger = currentRegionSelectorTrigger();
      if (!currentRegionComplexTriggerIsClickable(trigger)) {
        state.regionExportSelectionError = 'region-selector-occluded';
        renderOverlay();
        return false;
      }
    }
    if (!currentRegionSelectorExpanded()) {
      const staleExpanded = trigger.getAttribute('aria-expanded') === 'true';
      if (staleExpanded) {
        const reset = await dispatchRegionExportTrustedClick(trigger, 'region-export-region-selector-reset');
        if (!reset) {
          state.regionExportSelectionError = 'region-selector-reset-failed';
          renderOverlay();
          return false;
        }
        await delayMs(REGION_EXPORT_SELECTOR_SETTLE_MS);
        trigger = currentRegionSelectorTrigger();
        if (!currentRegionComplexTriggerIsClickable(trigger)) {
          state.regionExportSelectionError = 'region-selector-reset-failed';
          renderOverlay();
          return false;
        }
      }
      if (!currentRegionSelectorExpanded()) {
        const opened = await dispatchRegionExportTrustedClick(trigger, 'region-export-region-selector-open');
        if (!opened || !await waitForCurrentRegionSelectorExpanded(true)) {
          state.regionExportSelectionError = 'region-selector-open-failed';
          renderOverlay();
          return false;
        }
      }
    }
    await delayMs(REGION_EXPORT_SELECTOR_SETTLE_MS);
    if (!currentRegionSelectorExpanded()) {
      state.regionExportSelectionError = 'region-selector-open-failed';
      renderOverlay();
      return false;
    }
    state.regionExportSelectorWasExpanded = true;
    const positioned = await positionCurrentRegionSelectorAtLevel(
      state.regionExportSelectionLevel,
      selectedPath
    );
    state.regionExportSelectorReady = positioned.ok === true;
    if (!positioned.ok) state.regionExportSelectionError = positioned.reason || 'region-level-step-unavailable';
    renderOverlay();
    scheduleScan('region-export-region-selector-open');
    return true;
  }

  function requestCurrentRegionSelectorOpen(level = 'sido') {
    openCurrentRegionSelector(level).catch((error) => {
      if (isRuntimeInvalidationError(error)) {
        markRuntimeUnavailable(error);
        return;
      }
      if (!['selecting-region', 'confirming-region'].includes(state.regionExportStatus)) return;
      state.regionExportSelectionError = 'region-selector-open-failed';
      renderOverlay();
    });
  }

  // ── DHS-native region picker (API-driven, NO visual-selector driving) ─────────────────
  // The user picks 시/도→시/군/구→읍/면/동 entirely inside the DHS card. Options come from Naver's
  // OWN public same-origin endpoint /api/regions/list (the exact source Naver's visual filter is
  // rendered from — cortarName === the visual label text, verified live), so the map does NOT react
  // while picking. The visual selector is only driven LATER, on 추출하기, by
  // restoreCurrentRegionExportSelection (name-matched) to apply the chosen region to Naver + extract.
  const REGION_PICKER_TOP_CORTAR_NO = '0000000000';
  const regionPickerListCache = new Map(); // cortarNo -> [{cortarNo, cortarName, cortarType}]
  let regionPickerLoadToken = 0;

  async function fetchRegionPickerList(cortarNo) {
    const key = String(cortarNo || REGION_PICKER_TOP_CORTAR_NO);
    if (regionPickerListCache.has(key)) return regionPickerListCache.get(key);
    const regionsResponse = await fetch(
      `https://new.land.naver.com/api/regions/list?cortarNo=${encodeURIComponent(key)}`,
      { credentials: 'include', headers: { accept: 'application/json' } }
    );
    if (!regionsResponse.ok) throw new Error(`region-list-http-${regionsResponse.status}`);
    const body = await regionsResponse.json();
    const list = (Array.isArray(body && body.regionList) ? body.regionList : [])
      .map((entry) => ({
        cortarNo: String(entry && entry.cortarNo || ''),
        cortarName: normalizeText(entry && entry.cortarName || ''),
        cortarType: String(entry && entry.cortarType || '')
      }))
      .filter((entry) => entry.cortarNo && entry.cortarName);
    regionPickerListCache.set(key, list);
    return list;
  }

  // Load the option list for the level whose parent is `parentCortarNo`. `pathLen` is how many levels
  // are already chosen (0 → 시/도 list). Guards against stale async with a monotonic token.
  function loadRegionPickerLevel(parentCortarNo, pathLen) {
    const token = (regionPickerLoadToken += 1);
    state.regionPickerLoading = true;
    state.regionPickerOptions = [];
    state.regionExportSelectionLevel = REGION_EXPORT_SELECTION_LEVELS[
      Math.min(pathLen, REGION_EXPORT_SELECTION_LEVELS.length - 1)
    ];
    renderOverlay();
    fetchRegionPickerList(parentCortarNo)
      .then((list) => {
        if (token !== regionPickerLoadToken) return;
        if (state.regionExportStatus !== 'selecting-region') return;
        state.regionPickerOptions = list;
        state.regionPickerLoading = false;
        state.regionExportSelectionError = list.length ? '' : 'region-option-unavailable';
        renderOverlay();
      })
      .catch((error) => {
        if (isRuntimeInvalidationError(error)) { markRuntimeUnavailable(error); return; }
        if (token !== regionPickerLoadToken) return;
        if (state.regionExportStatus !== 'selecting-region') return;
        state.regionPickerLoading = false;
        state.regionPickerOptions = [];
        state.regionExportSelectionError = 'region-list-fetch-failed';
        renderOverlay();
      });
  }

  function regionPickerApplyPath() {
    const path = Array.isArray(state.regionPickerPath) ? state.regionPickerPath : [];
    state.regionExportSelectionValues = path.map((entry) => entry.cortarName).slice(0, 3);
  }

  // User picked one option (by cortarNo) in the DHS card. Drill down; when a leaf (읍/면/동, type 'sec'
  // OR path reaches 3) is chosen, the selection is complete → confirming-region. NEVER touches Naver.
  function pickCurrentRegionOptionFromOverlay(cortarNo) {
    if (state.regionExportStatus !== 'selecting-region') return false;
    const options = Array.isArray(state.regionPickerOptions) ? state.regionPickerOptions : [];
    const picked = options.find((entry) => entry.cortarNo === String(cortarNo || ''));
    if (!picked) return false;
    const path = (Array.isArray(state.regionPickerPath) ? state.regionPickerPath : []).slice(0, 2);
    path.push(picked);
    state.regionPickerPath = path;
    regionPickerApplyPath();
    state.regionExportSelectionError = '';
    const isLeaf = picked.cortarType === 'sec' || path.length >= 3;
    if (isLeaf) {
      const api = regionExportSelectionApi();
      const selection = typeof api.createSelection === 'function'
        ? api.createSelection(path.map((entry) => entry.cortarName))
        : { complete: false, key: '', label: '' };
      if (!selection.complete) {
        // Non-leaf that Naver classifies oddly: fall back to drilling one more level.
        loadRegionPickerLevel(picked.cortarNo, path.length);
        return true;
      }
      state.regionPickerOptions = [];
      state.regionPickerLoading = false;
      state.regionExportSelectionKey = selection.key;
      state.regionExportSelectionLabel = selection.label;
      state.regionExportSelectionValues = selection.values.slice(0, 3);
      state.regionExportSelectionProof = 'dhs-picker';
      state.regionExportStatus = 'confirming-region';
      renderOverlay();
      return true;
    }
    loadRegionPickerLevel(picked.cortarNo, path.length);
    return true;
  }

  // Clicking a step chip (1/2/3) re-opens that level for re-picking: truncate the path to that level and
  // reload its options from the parent above it.
  function chooseCurrentRegionLevelFromOverlay(level) {
    if (!['selecting-region', 'confirming-region'].includes(state.regionExportStatus)) return false;
    const levelIndex = Math.max(0, REGION_EXPORT_SELECTION_LEVELS.indexOf(normalizeRegionSelectionLevel(level)));
    const fullPath = Array.isArray(state.regionPickerPath) ? state.regionPickerPath : [];
    // Only allow jumping to an already-reachable level (<= current depth).
    if (levelIndex > fullPath.length) return false;
    state.regionExportStatus = 'selecting-region';
    state.regionExportSelectionKey = '';
    state.regionExportSelectionLabel = '';
    state.regionExportSelectionProof = '';
    state.regionExportSelectionError = '';
    state.regionPickerPath = fullPath.slice(0, levelIndex);
    regionPickerApplyPath();
    const parentCortarNo = levelIndex === 0
      ? REGION_PICKER_TOP_CORTAR_NO
      : state.regionPickerPath[levelIndex - 1].cortarNo;
    loadRegionPickerLevel(parentCortarNo, levelIndex);
    return true;
  }

  function requestConfirmedCurrentRegionExport(confirmedSelectionKey) {
    exportCurrentRegionFromOverlay(false, confirmedSelectionKey).catch((error) => {
      if (isRuntimeInvalidationError(error)) {
        markRuntimeUnavailable(error);
        return;
      }
      state.regionExportStatus = 'error';
      state.regionExportLastError = 'region-export-start-failed';
      renderOverlay();
    });
  }

  function ensureRegionConfirmingSelection() {
    // No-op in the DHS-native picker: selecting→confirming happens synchronously in
    // pickCurrentRegionOptionFromOverlay when a leaf 동 is picked. Kept for call-site compatibility.
    return;
  }

  function beginRegionExportSelectionFromOverlay() {
    if (['preparing', 'running', 'saving'].includes(state.regionExportStatus)) return false;
    state.regionExportStatus = 'selecting-region';
    state.regionExportSelectionKey = '';
    state.regionExportSelectionLabel = '';
    state.regionExportSelectionValues = [];
    state.regionExportSelectionProof = '';
    state.regionExportSelectionLevel = 'sido';
    state.regionExportSelectorWasExpanded = false;
    state.regionExportSelectorReady = false;
    state.regionExportSelectionError = '';
    state.regionExportLastError = '';
    // DHS-native picker: reset path and load the 시/도 list from Naver's public regions API.
    // NOTE: we do NOT open Naver's visual selector here — the map must stay still while picking.
    state.regionPickerPath = [];
    state.regionPickerOptions = [];
    state.regionPickerLoading = true;
    renderOverlay();
    loadRegionPickerLevel(REGION_PICKER_TOP_CORTAR_NO, 0);
    return true;
  }

  function cancelRegionExportSelection() {
    if (!['selecting-region', 'confirming-region'].includes(state.regionExportStatus)) return false;
    regionPickerLoadToken += 1; // cancel any in-flight level load
    state.regionExportStatus = 'idle';
    state.regionExportSelectionKey = '';
    state.regionExportSelectionLabel = '';
    state.regionExportSelectionProof = '';
    state.regionExportSelectionLevel = 'sido';
    state.regionExportSelectorWasExpanded = false;
    state.regionExportSelectorReady = false;
    state.regionExportSelectionError = '';
    state.regionPickerPath = [];
    state.regionPickerOptions = [];
    state.regionPickerLoading = false;
    renderOverlay();
    return true;
  }

  function confirmCurrentRegionExportFromOverlay() {
    if (state.regionExportStatus !== 'confirming-region') return false;
    const api = regionExportSelectionApi();
    const confirmedSelection = typeof api.createSelection === 'function'
      ? api.createSelection(String(state.regionExportSelectionKey || '').split('|'))
      : { complete: false, key: '' };
    // 추출하기: proceed on ANY complete 시/구/동 selection. We no longer bail when Naver's currently
    // applied region has drifted from the pick — the extraction run APPLIES the confirmed region to
    // Naver itself (restoreCurrentRegionExportSelection) before collecting, so 추출하기 = "apply the
    // selected region to 네이버부동산 + extract it", which is what the user expects.
    if (!confirmedSelection.complete) {
      // Shouldn't happen (a confirming-region key is always a complete 3-level pick), but if it does,
      // drop back into the DHS picker at the 읍/면/동 level rather than driving Naver's selector.
      state.regionExportStatus = 'selecting-region';
      state.regionExportSelectionError = 'selection-changed';
      state.regionExportSelectionKey = '';
      state.regionExportSelectionLabel = '';
      state.regionExportSelectionProof = '';
      chooseCurrentRegionLevelFromOverlay('dong');
      return false;
    }
    state.regionExportStatus = 'idle';
    state.regionExportSelectionError = '';
    requestConfirmedCurrentRegionExport(confirmedSelection.key);
    return true;
  }

  function currentRegionComplexListingCount(text) {
    const normalized = normalizeText(text);
    let total = 0;
    let matched = false;
    normalized.replace(/(\uB9E4\uB9E4|\uC804\uC138|\uC6D4\uC138)\s*(\d{1,5})/g, (_match, _type, count) => {
      matched = true;
      total += Number(count || 0) || 0;
      return '';
    });
    return matched ? total : 0;
  }

  function currentRegionComplexNameFromText(text) {
    return normalizeText(text).split(/(?:\uC544\uD30C\uD2B8|\uC624\uD53C\uC2A4\uD154|\uB9E4\uB9E4|\uC804\uC138|\uC6D4\uC138)/)[0].trim();
  }

  function currentRegionComplexKey(name, text) {
    const normalizedName = normalizeText(name).toLowerCase().replace(/\s+/g, '');
    const normalizedText = normalizeText(text).toLowerCase().replace(/\s+/g, '');
    return normalizedName ? `${normalizedName}|${normalizedText}` : normalizedText;
  }

  function currentRegionComplexIdFromElement(element) {
    if (!element) return '';
    const values = [];
    const elements = [element].concat(Array.from(element.querySelectorAll ? element.querySelectorAll('a[href], [data-hscp-no], [data-hscpno], [data-complex-no], [data-complexno], [data-id]') : []));
    elements.slice(0, 20).forEach((node) => {
      if (!node || typeof node.getAttribute !== 'function') return;
      values.push(
        node.getAttribute('href'),
        node.getAttribute('data-hscp-no'),
        node.getAttribute('data-hscpno'),
        node.getAttribute('data-complex-no'),
        node.getAttribute('data-complexno'),
        node.getAttribute('data-id'),
        node.getAttribute('aria-label'),
        node.getAttribute('title')
      );
    });
    if (element.outerHTML) values.push(String(element.outerHTML).slice(0, 4000));
    for (const value of values) {
      const text = String(value || '');
      if (!text) continue;
      const match = text.match(/\/complexes\/(\d{3,12})/) ||
        text.match(/(?:hscpNo|complexNo|complex_no|hscp_no)["'=:\s%26&?]*(\d{3,12})/i);
      if (match) return match[1];
    }
    return '';
  }

  function currentRegionComplexIdFromLocation() {
    try {
      const match = new URL(location.href).pathname.match(/^\/complexes\/(\d{3,12})(?:\/|$)/);
      return match ? match[1] : '';
    } catch (_) {
      return '';
    }
  }

  function currentRegionComplexNameFromPage() {
    const selectors = [
      '.list_fixed .list_complex_info .complex_title h3.title',
      '.list_fixed .list_complex_info h3.title',
      '.list_fixed .list_complex_info .complex_title',
      '.list_complex_info .complex_title',
      '.complex_summary .complex_title'
    ];
    for (const selector of selectors) {
      const node = Array.from(document.querySelectorAll(selector)).find(isVisibleNode);
      const text = currentRegionVisibleText(node);
      if (text) return currentRegionComplexNameFromText(text) || text;
    }
    return '';
  }

  function prioritizeCurrentRegionComplexTargets(targets, currentContextInput) {
    const rows = (Array.isArray(targets) ? targets : []).slice();
    const currentContext = currentContextInput && typeof currentContextInput === 'object'
      ? currentContextInput
      : {
          complexId: currentRegionComplexIdFromLocation(),
          name: currentRegionComplexNameFromPage()
        };
    const currentComplexId = String(currentContext.complexId || '');
    let currentIndex = currentComplexId
      ? rows.findIndex((row) => String(row && row.complexId || '') === currentComplexId)
      : -1;
    if (currentIndex < 0) {
      const normalizedCurrentName = normalizeText(currentContext.name).toLowerCase().replace(/\s+/g, '');
      if (normalizedCurrentName) {
        currentIndex = rows.findIndex((row) => {
          const normalizedTargetName = normalizeText(row && row.name).toLowerCase().replace(/\s+/g, '');
          return normalizedTargetName === normalizedCurrentName;
        });
      }
    }
    if (currentIndex <= 0) return rows;
    return [rows[currentIndex], ...rows.slice(0, currentIndex), ...rows.slice(currentIndex + 1)];
  }

  function collectCurrentRegionLevelOptions() {
    if (!currentRegionSelectorExpanded()) return [];
    const seen = new Set();
    const options = [];
    Array.from(document.querySelectorAll('.filter_popup--area label.radio_label_district'))
      .filter(isVisibleNode)
      .forEach((node) => {
        const text = normalizeText(currentRegionVisibleText(node));
        if (!text) return;
        const key = text.replace(/\s+/g, '').toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        options.push(text);
      });
    return options;
  }

  function collectCurrentRegionComplexOptions() {
    const roots = Array.from(document.querySelectorAll([
      '.complex_item_inner[role="option"]',
      '.complex_item a[role="option"]',
      '.complex_item_inner',
      'li.complex_item'
    ].join(',')))
      .filter(isVisibleNode);
    const seen = new Set();
    const options = [];
    roots.forEach((root) => {
      const clickable = root.matches && root.matches('a, button, [role="option"], [role="button"]')
        ? root
        : (root.querySelector && root.querySelector('.complex_item_inner[role="option"], a, button, [role="option"], [role="button"]'));
      if (!clickable || !isVisibleNode(clickable)) return;
      const text = currentRegionVisibleText(root);
      const listingCount = currentRegionComplexListingCount(text);
      if (!text || listingCount < 1) return;
      const titleNode = root.querySelector && root.querySelector('.complex_title');
      const name = currentRegionVisibleText(titleNode) || currentRegionComplexNameFromText(text);
      const complexId = currentRegionComplexIdFromElement(root) || currentRegionComplexIdFromElement(clickable);
      const key = complexId ? `complex:${complexId}` : currentRegionComplexKey(name, text);
      if (!key || seen.has(key)) return;
      seen.add(key);
      options.push({
        key,
        complexId,
        name,
        text: text.slice(0, 240),
        listingCount,
        _root: clickable
      });
    });
    return options;
  }

  function currentRegionComplexScrollContainer() {
    const candidates = Array.from(document.querySelectorAll('div, section, ul, ol'))
      .filter(isVisibleNode)
      .filter((element) => Number(element.scrollHeight || 0) > Number(element.clientHeight || 0) + 40)
      .map((element) => {
        const complexCount = Array.from(element.querySelectorAll('.complex_item, .complex_item_inner[role="option"]'))
          .filter(isVisibleNode)
          .length;
        return {
          element,
          complexCount,
          scrollRoom: Number(element.scrollHeight || 0) - Number(element.clientHeight || 0)
        };
      })
      .filter((item) => item.complexCount > 0)
      .sort((left, right) => (right.complexCount - left.complexCount) || (right.scrollRoom - left.scrollRoom));
    return candidates[0] && candidates[0].element || null;
  }

  function currentRegionComplexListIsOpen() {
    const trigger = currentRegionSelectorTrigger();
    if (!trigger || trigger.getAttribute('aria-expanded') !== 'true') return false;
    const list = Array.from(document.querySelectorAll('.filter_popup--area .area_list--complex'))
      .find(isVisibleNode);
    if (!list) return false;
    return collectCurrentRegionComplexOptions().length > 0;
  }

  async function waitForCurrentRegionSelectionKey(selectionKey, runId, timeoutMs = 2600) {
    const deadline = Date.now() + Math.max(200, Number(timeoutMs || 0) || 0);
    while (Date.now() < deadline) {
      if (runId && runId !== regionExportRunId) return false;
      if (currentRegionSelectionMatchesKey(selectionKey)) return true;
      await delayMs(80);
    }
    return currentRegionSelectionMatchesKey(selectionKey);
  }

  async function waitForCurrentRegionComplexContextKey(selectionKey, runId, timeoutMs = 2600) {
    const deadline = Date.now() + Math.max(200, Number(timeoutMs || 0) || 0);
    while (Date.now() < deadline) {
      if (runId && runId !== regionExportRunId) return false;
      if (currentRegionComplexContextMatchesKey(selectionKey)) return true;
      await delayMs(80);
    }
    return currentRegionComplexContextMatchesKey(selectionKey);
  }

  async function selectCurrentRegionExportPathOption(value, action, runId) {
    const target = await waitForCurrentRegionSelectorOption(value, 2200);
    if (!target) return false;
    const clicked = await dispatchRegionExportTrustedClick(target, action, runId);
    if (!clicked) return false;
    await delayMs(REGION_EXPORT_SELECTOR_SETTLE_MS);
    return !runId || runId === regionExportRunId;
  }

  async function closeCurrentRegionExpandedPopup(runId, action) {
    const trigger = currentRegionSelectorTrigger();
    if (!trigger || trigger.getAttribute('aria-expanded') !== 'true') return true;
    const clicked = await dispatchRegionExportTrustedClick(trigger, action, runId);
    if (!clicked) return false;
    const deadline = Date.now() + 1800;
    while (Date.now() < deadline) {
      if (runId && runId !== regionExportRunId) return false;
      const currentTrigger = currentRegionSelectorTrigger();
      if (!currentTrigger || currentTrigger.getAttribute('aria-expanded') !== 'true') return true;
      await delayMs(80);
    }
    const currentTrigger = currentRegionSelectorTrigger();
    return Boolean(!currentTrigger || currentTrigger.getAttribute('aria-expanded') !== 'true');
  }

  async function restoreCurrentRegionExportSelection(selectionKey, runId) {
    const api = regionExportSelectionApi();
    const expectedSelection = typeof api.createSelection === 'function'
      ? api.createSelection(String(selectionKey || '').split('|'))
      : { complete: false, key: '' };
    if (!expectedSelection.complete) return { ok: false, reason: 'region-restore-selection-invalid' };
    if (currentRegionComplexContextMatchesKey(expectedSelection.key)) return { ok: true, reason: 'region-current' };
    if (runId && runId !== regionExportRunId) return { ok: false, reason: 'cancelled' };

    if (!await closeCurrentRegionExpandedPopup(runId, 'region-export-region-restore-reset')) {
      return { ok: false, reason: runId !== regionExportRunId ? 'cancelled' : 'region-restore-reset-failed' };
    }
    const access = await ensureCurrentRegionComplexFilterAccessible(runId);
    if (!access.ok) return access;
    let trigger = currentRegionSelectorTrigger();
    if (!trigger) return { ok: false, reason: 'region-restore-trigger-unavailable' };
    const opened = await dispatchRegionExportTrustedClick(trigger, 'region-export-region-restore-open', runId);
    if (!opened || !await waitForCurrentRegionSelectorExpanded(true, 2200)) {
      return { ok: false, reason: runId !== regionExportRunId ? 'cancelled' : 'region-restore-open-failed' };
    }

    const sidoStep = currentRegionLevelStepTarget('sido');
    if (!sidoStep) return { ok: false, reason: 'region-restore-sido-step-unavailable' };
    if (!await dispatchRegionExportTrustedClick(sidoStep, 'region-export-region-restore-sido-step', runId)) {
      return { ok: false, reason: runId !== regionExportRunId ? 'cancelled' : 'region-restore-sido-step-failed' };
    }
    await delayMs(REGION_EXPORT_SELECTOR_SETTLE_MS);
    if (!await selectCurrentRegionExportPathOption(expectedSelection.sido, 'region-export-region-restore-sido', runId)) {
      return { ok: false, reason: runId !== regionExportRunId ? 'cancelled' : 'region-restore-sido-failed' };
    }
    if (!await selectCurrentRegionExportPathOption(expectedSelection.sigungu, 'region-export-region-restore-sigungu', runId)) {
      return { ok: false, reason: runId !== regionExportRunId ? 'cancelled' : 'region-restore-sigungu-failed' };
    }
    if (!await selectCurrentRegionExportPathOption(expectedSelection.eupMyeonDong, 'region-export-region-restore-dong', runId)) {
      return { ok: false, reason: runId !== regionExportRunId ? 'cancelled' : 'region-restore-dong-failed' };
    }
    return await waitForCurrentRegionComplexContextKey(expectedSelection.key, runId)
      ? { ok: true, reason: 'region-restored' }
      : { ok: false, reason: runId !== regionExportRunId ? 'cancelled' : 'region-restore-timeout' };
  }

  async function ensureCurrentRegionComplexFilterAccessible(runId) {
    if (runId && runId !== regionExportRunId) return { ok: false, reason: 'cancelled' };
    const trigger = currentRegionComplexDropdownTrigger();
    if (!trigger) return { ok: false, reason: 'complex-trigger-unavailable' };
    if (currentRegionComplexTriggerIsClickable(trigger)) return { ok: true, reason: 'ready' };
    const closeButton = currentRegionVisibleArticleDetailCloseButton();
    if (!closeButton) return { ok: false, reason: 'complex-detail-close-unavailable' };
    const clicked = await dispatchRegionExportTrustedClick(closeButton, 'region-export-detail-close', runId);
    if (runId && runId !== regionExportRunId) return { ok: false, reason: 'cancelled' };
    if (!clicked) return { ok: false, reason: 'complex-detail-close-failed' };
    await delayMs(REGION_EXPORT_COMPLEX_SETTLE_MS);
    if (runId && runId !== regionExportRunId) return { ok: false, reason: 'cancelled' };
    const restoredTrigger = currentRegionComplexDropdownTrigger();
    return currentRegionComplexTriggerIsClickable(restoredTrigger)
      ? { ok: true, reason: 'detail-closed' }
      : { ok: false, reason: 'complex-trigger-occluded' };
  }

  async function ensureCurrentRegionComplexDropdownOpen(runId, expectedSelectionKey = '', forceReopen = false) {
    if (forceReopen && !await closeCurrentRegionExpandedPopup(runId, 'region-export-complex-reopen-reset')) {
      return { ok: false, reason: runId !== regionExportRunId ? 'cancelled' : 'complex-reopen-reset-failed' };
    }
    if (expectedSelectionKey && !currentRegionComplexContextMatchesKey(expectedSelectionKey)) {
      const restored = await restoreCurrentRegionExportSelection(expectedSelectionKey, runId);
      if (!restored.ok) return restored;
    }
    if (currentRegionComplexListIsOpen()) return { ok: true, reason: 'open' };
    if (!await closeCurrentRegionExpandedPopup(runId, 'region-export-complex-picker-reset')) {
      return { ok: false, reason: runId !== regionExportRunId ? 'cancelled' : 'complex-picker-reset-failed' };
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (runId && runId !== regionExportRunId) return { ok: false, reason: 'cancelled' };
      const access = await ensureCurrentRegionComplexFilterAccessible(runId);
      if (!access.ok) return access;
      const trigger = currentRegionComplexDropdownTrigger();
      if (!trigger) return { ok: false, reason: 'complex-trigger-unavailable' };
      const clicked = await dispatchRegionExportTrustedClick(trigger, 'region-export-complex-open', runId);
      if (!clicked && runId && runId !== regionExportRunId) return { ok: false, reason: 'cancelled' };
      await delayMs(REGION_EXPORT_COMPLEX_SETTLE_MS);
      if (currentRegionComplexListIsOpen()) return { ok: true, reason: 'open' };
      await closeCurrentRegionExpandedPopup(runId, 'region-export-complex-open-retry-reset');
    }
    return { ok: false, reason: 'complex-dropdown-unavailable' };
  }

  async function collectCurrentRegionComplexTargets(runId, expectedSelectionKey = '') {
    const currentContext = {
      complexId: currentRegionComplexIdFromLocation(),
      name: currentRegionComplexNameFromPage()
    };
    const targets = [];
    const seen = new Set();
    const opened = await ensureCurrentRegionComplexDropdownOpen(runId, expectedSelectionKey);
    if (!opened.ok) throw new Error(opened.reason || 'complex-dropdown-unavailable');
    let scroller = currentRegionComplexScrollContainer();
    if (scroller) {
      scroller.scrollTop = 0;
      scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
      await delayMs(REGION_EXPORT_COMPLEX_SCROLL_SETTLE_MS);
    }
    for (let round = 0; round < REGION_EXPORT_COMPLEX_MAX_SCROLL_ROUNDS; round += 1) {
      if (runId !== regionExportRunId) break;
      collectCurrentRegionComplexOptions().forEach((option) => {
        if (!option.key || seen.has(option.key)) return;
        seen.add(option.key);
        targets.push({
          key: option.key,
          complexId: option.complexId || '',
          name: option.name,
          text: option.text,
          listingCount: option.listingCount
        });
      });
      if (!scroller) break;
      const maxScrollTop = Math.max(0, Number(scroller.scrollHeight || 0) - Number(scroller.clientHeight || 0));
      const atBottom = Number(scroller.scrollTop || 0) >= maxScrollTop - 4;
      if (atBottom) break;
      scroller.scrollTop = Math.min(maxScrollTop, Number(scroller.scrollTop || 0) + Math.max(160, Math.round(Number(scroller.clientHeight || 0) * 0.85)));
      scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
      await delayMs(REGION_EXPORT_COMPLEX_SCROLL_SETTLE_MS);
      scroller = currentRegionComplexScrollContainer();
    }
    return prioritizeCurrentRegionComplexTargets(targets, currentContext);
  }

  function findCurrentRegionComplexOption(target) {
    const input = target || {};
    const key = input.key || currentRegionComplexKey(input.name, input.text);
    const options = collectCurrentRegionComplexOptions();
    const keyMatches = options.filter((option) => option.key === key);
    if (keyMatches.length === 1) return keyMatches[0];
    const idMatches = input.complexId
      ? options.filter((option) => option.complexId && option.complexId === input.complexId)
      : [];
    if (idMatches.length === 1) return idMatches[0];
    const nameMatches = options.filter((option) => option.name && input.name && option.name === input.name);
    return nameMatches.length === 1 ? nameMatches[0] : null;
  }

  async function findCurrentRegionComplexOptionByScrolling(complexTarget, runId, expectedSelectionKey) {
    let lastReason = 'complex-option-not-found';
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const opened = await ensureCurrentRegionComplexDropdownOpen(runId, expectedSelectionKey, attempt > 0);
      if (!opened.ok) {
        lastReason = opened.reason || lastReason;
        if (lastReason === 'cancelled') break;
        continue;
      }
      let option = findCurrentRegionComplexOption(complexTarget);
      let scroller = currentRegionComplexScrollContainer();
      if (option && option._root && typeof option._root.scrollIntoView === 'function') {
        option._root.scrollIntoView({ block: 'center', inline: 'nearest' });
        await delayMs(REGION_EXPORT_COMPLEX_SCROLL_SETTLE_MS);
        option = findCurrentRegionComplexOption(complexTarget);
        if (option) return { option, reason: 'complex-option-found' };
      }
      if (scroller) {
        scroller.scrollTop = 0;
        scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
        await delayMs(REGION_EXPORT_COMPLEX_SCROLL_SETTLE_MS);
      }
      for (let round = 0; round < REGION_EXPORT_COMPLEX_MAX_SCROLL_ROUNDS; round += 1) {
        if (runId !== regionExportRunId) return { option: null, reason: 'cancelled' };
        option = findCurrentRegionComplexOption(complexTarget);
        if (option) {
          if (option._root && typeof option._root.scrollIntoView === 'function') {
            option._root.scrollIntoView({ block: 'center', inline: 'nearest' });
            await delayMs(REGION_EXPORT_COMPLEX_SCROLL_SETTLE_MS);
            option = findCurrentRegionComplexOption(complexTarget);
          }
          if (option) return { option, reason: 'complex-option-found' };
        }
        scroller = currentRegionComplexScrollContainer();
        if (!scroller) break;
        const maxScrollTop = Math.max(0, Number(scroller.scrollHeight || 0) - Number(scroller.clientHeight || 0));
        if (Number(scroller.scrollTop || 0) >= maxScrollTop - 4) break;
        scroller.scrollTop = Math.min(
          maxScrollTop,
          Number(scroller.scrollTop || 0) + Math.max(160, Math.round(Number(scroller.clientHeight || 0) * 0.85))
        );
        scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
        await delayMs(REGION_EXPORT_COMPLEX_SCROLL_SETTLE_MS);
      }
    }
    return { option: null, reason: lastReason };
  }

  function currentRegionComplexTargetMatchesPage(complexTarget) {
    const target = complexTarget || {};
    const targetComplexId = String(target.complexId || '');
    const targetName = normalizeText(target.name).toLowerCase().replace(/\s+/g, '');
    const currentName = normalizeText(currentRegionComplexNameFromPage()).toLowerCase().replace(/\s+/g, '');
    const idMatches = !targetComplexId
      || new RegExp(`/complexes/${targetComplexId}(?:\\D|$)`).test(String(location.href || ''));
    const nameMatches = !targetName || Boolean(currentName && targetName === currentName);
    return Boolean(idMatches && nameMatches && (targetComplexId || targetName));
  }

  async function waitForCurrentRegionListingsAfterComplexClick(runId, complexTarget) {
    const started = Date.now();
    while ((Date.now() - started) < 5000) {
      if (runId !== regionExportRunId) return { ok: false, reason: 'cancelled' };
      safeBridgeTask(scanPage);
      renderOverlay();
      if (currentRegionComplexTargetMatchesPage(complexTarget) && collectCurrentRegionListingRows().length > 0) {
        return { ok: true, reason: 'selected' };
      }
      await delayMs(REGION_EXPORT_COMPLEX_SETTLE_MS);
    }
    if (!currentRegionComplexTargetMatchesPage(complexTarget)) return { ok: false, reason: 'complex-route-mismatch' };
    return collectCurrentRegionListingRows().length > 0
      ? { ok: true, reason: 'selected' }
      : { ok: false, reason: 'complex-listings-timeout' };
  }

  async function clickCurrentRegionComplexTarget(complexTarget, runId, expectedSelectionKey = '') {
    if (!complexTarget) return { ok: false, reason: 'complex-target-missing' };
    if (currentRegionComplexTargetMatchesPage(complexTarget) && collectCurrentRegionListingRows().length > 0) {
      await ensureCurrentRegionSameAddressGroupingOn(runId);
      return { ok: true, reason: 'already-selected' };
    }
    let lastReason = 'complex-option-not-found';
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (runId !== regionExportRunId) return { ok: false, reason: 'cancelled' };
      const found = await findCurrentRegionComplexOptionByScrolling(complexTarget, runId, expectedSelectionKey);
      if (!found.option) {
        lastReason = found.reason || lastReason;
        if (lastReason === 'cancelled') return { ok: false, reason: 'cancelled' };
        continue;
      }
      const root = found.option._root;
      if (!root) {
        lastReason = 'complex-option-not-found';
        continue;
      }
      const clicked = await dispatchRegionExportTrustedClick(root, 'region-export-complex-select', runId);
      if (!clicked) {
        lastReason = runId !== regionExportRunId ? 'cancelled' : 'complex-click-failed';
        if (lastReason === 'cancelled') return { ok: false, reason: 'cancelled' };
        continue;
      }
      await delayMs(REGION_EXPORT_COMPLEX_SETTLE_MS);
      if (runId !== regionExportRunId) return { ok: false, reason: 'cancelled' };
      const selection = await waitForCurrentRegionListingsAfterComplexClick(runId, complexTarget);
      if (selection.ok) {
        await ensureCurrentRegionSameAddressGroupingOn(runId);
        return selection;
      }
      lastReason = selection.reason || lastReason;
    }
    return { ok: false, reason: lastReason };
  }

  function articleNoFromListingElement(element) {
    if (!element) return '';
    const raw = [
      element.getAttribute && element.getAttribute('href'),
      element.getAttribute && element.getAttribute('data-article-no'),
      element.getAttribute && element.getAttribute('data-atcl-no'),
      element.outerHTML
    ].filter(Boolean).join(' ');
    const match = raw.match(/[?&]articleNo=(\d+)/) || raw.match(/(?:articleNo|atclNo)\D+(\d{6,})/);
    return match ? match[1] : '';
  }

  function currentRegionListingContainer() {
    const direct = document.querySelector('#articleListArea');
    if (direct) return direct;
    return Array.from(document.querySelectorAll('.item_list--article, .item_area, .article_list, .infinite_scroll, .list_contents'))
      .filter(isVisibleNode)
      .map((element) => ({
        element,
        itemCount: Array.from(element.querySelectorAll('.item')).filter(isVisibleNode).length,
        linkCount: Array.from(element.querySelectorAll('a.item_link')).filter(isVisibleNode).length,
        complexCount: Array.from(element.querySelectorAll('.complex_item')).filter(isVisibleNode).length
      }))
      .filter((item) => item.itemCount > 0 || item.linkCount > 0)
      .sort((left, right) => (right.linkCount - left.linkCount) || (right.itemCount - left.itemCount) || (left.complexCount - right.complexCount))
      .map((item) => item.element)[0] || document;
  }

  function isRegionExportListingScopeNode(root) {
    return Boolean(root)
      && !root.closest('.complex_item, .area_list--complex, .filter_popup, #region_filter, .filter_region')
      && !root.closest('.item--child');
  }

  function currentRegionListingParentLink(root) {
    if (!root) return null;
    if (root.matches && root.matches('a.item_link') && !root.closest('.item--child')) return root;
    if (!root.querySelector) return null;
    return root.querySelector(':scope > .item_inner a.item_link[aria-expanded]')
      || root.querySelector(':scope > .item_inner a.item_link')
      || root.querySelector('a.item_link[aria-expanded]')
      || root.querySelector('a.item_link');
  }

  function currentRegionGroupedBrokerCount(text) {
    const match = normalizeText(text).match(/\uC911\uAC1C\uC0AC\s*(\d{1,4})\s*\uACF3/);
    return match ? Number(match[1] || 0) || 0 : 0;
  }

  function isAssociationProviderListingText(text) {
    const normalized = normalizeText(text);
    return /\uD55C\uAD6D\uACF5\uC778\uC911\uAC1C\uC0AC\uD611\uD68C|\uACF5\uC778\uC911\uAC1C\uC0AC\uD611\uD68C|\uBD80\uB3D9\uC0B0\uD611\uD68C|karhanbang|\bKAR\b/i.test(normalized)
      || /(?:^|\s)\uD55C\uBC29(?:\s+\uC81C\uACF5)?(?:\s|$)/.test(normalized);
  }

  function currentRegionListingTextFromRoot(root) {
    const link = currentRegionListingParentLink(root);
    return normalizeText(elementText(link) || elementText(root));
  }

  function regionExportListingPublicIdentity(row) {
    const input = row && typeof row === 'object' ? row : {};
    const core = [
      input.dong,
      input.floor,
      input.type,
      input.dealType,
      input.priceHint,
      input.areaHint,
      input.directionHint
    ].map(normalizeText);
    if (core.filter(Boolean).length < 3) return '';
    return core.concat([
      regionExportFloorViewFeature(input),
      regionExportMoveFeature(input),
      regionExportOption(input),
      regionExportListingFeature(input),
      input.text
    ].map(normalizeText)).join('|');
  }

  async function ensureCurrentRegionSameAddressGroupingOn(runId) {
    if (runId && runId !== regionExportRunId) return false;
    const input = document.querySelector('#address_group2') || document.querySelector('input[name="sameAddressGroup"]');
    if (!input || input.checked) return true;
    const label = document.querySelector('label[for="address_group2"]');
    const target = label || input;
    if (!target || typeof target.click !== 'function') return false;
    target.click();
    scheduleScan('region-export-same-address-group-on');
    await delayMs(REGION_EXPORT_COMPLEX_SETTLE_MS);
    if (runId && runId !== regionExportRunId) return false;
    return Boolean(input.checked);
  }

  function collectCurrentRegionListingRows() {
    const container = currentRegionListingContainer();
    let roots = Array.from(container.querySelectorAll ? container.querySelectorAll('.item') : [])
      .filter(isVisibleNode)
      .filter(isRegionExportListingScopeNode)
      .filter((root) => rootHasListingContext(currentRegionListingParentLink(root) || root));
    if (!roots.length) {
      roots = Array.from(container.querySelectorAll ? container.querySelectorAll('a.item_link') : [])
        .filter(isVisibleNode)
        .filter(isRegionExportListingScopeNode)
        .filter(rootHasListingContext);
    }
    const seen = new Set();
    const rows = [];
    roots.forEach((root) => {
      const parentRoot = root.matches && root.matches('a.item_link') ? (root.closest('.item') || root) : root;
      const parentLink = currentRegionListingParentLink(parentRoot) || root;
      const text = currentRegionListingTextFromRoot(parentRoot) || normalizeText(elementText(root));
      const providerScopeText = normalizeText(elementText(parentRoot));
      if (!text) return;
      if (isAssociationProviderListingText(text + ' ' + providerScopeText)) return;
      const signal = classifyListingText(text);
      const articleNo = articleNoFromListingElement(parentLink) || articleNoFromListingElement(parentRoot);
      const brokerCount = currentRegionGroupedBrokerCount(text);
      const grouped = brokerCount > 1;
      const key = articleNo || `${extractDongToken(text)}|${signal.floorKind}:${signal.floorBand}:${signal.floorValue}/${signal.totalFloor}|${signal.pyeongTypeToken}|${text.slice(0, 120)}`;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({
        key,
        _root: parentRoot,
        _clickTarget: parentLink,
        rowIndex: rows.length + 1,
        articleNo,
        dong: extractDongToken(text),
        floor: signal.floorKind === 'exact'
          ? `${signal.floorValue}/${signal.totalFloor || ''}`.replace(/\/$/, '')
          : (signal.floorBand ? `${signal.floorBand}/${signal.totalFloor || ''}`.replace(/\/$/, '') : ''),
        type: signal.pyeongTypeToken || extractDetailTypeToken(text),
        dealType: extractDealType(text),
        priceHint: extractPriceToken(text),
        areaHint: regionExportAreaHint(text),
        directionHint: signal.directionToken || extractDirectionToken(text),
        featureText: regionExportFeatureText(text),
        isGroupedListing: grouped,
        groupedBrokerCount: brokerCount,
        text: text.slice(0, 500)
      });
    });
    return rows;
  }

  function currentRegionListingScrollContainer() {
    const direct = currentRegionListingContainer();
    if (direct && direct !== document && Number(direct.scrollHeight || 0) > Number(direct.clientHeight || 0) + 80) {
      return direct;
    }
    const candidates = Array.from(document.querySelectorAll('div, section, ul, ol, aside'))
      .filter(isVisibleNode)
      .filter((element) => !element.closest('.filter_popup, #region_filter, .filter_region'))
      .filter((element) => Number(element.scrollHeight || 0) > Number(element.clientHeight || 0) + 80)
      .map((element) => {
        const listingCount = Array.from(element.querySelectorAll('a.item_link, .item, .item_inner, li, button, [role="button"]'))
          .filter(isVisibleNode)
          .filter(isRegionExportListingScopeNode)
          .filter(rootHasListingContext)
          .length;
        return {
          element,
          listingCount,
          scrollRoom: Number(element.scrollHeight || 0) - Number(element.clientHeight || 0)
        };
      })
      .filter((item) => item.listingCount > 0)
      .sort((left, right) => (right.listingCount - left.listingCount) || (right.scrollRoom - left.scrollRoom));
    return candidates[0] && candidates[0].element || null;
  }

  function stripRegionExportRow(row) {
    const input = row || {};
    return {
      listingMarker: input.listingMarker || '',
      complexName: input.complexName || '',
      complexListingCount: input.complexListingCount || 0,
      rowIndex: input.rowIndex || 0,
      articleNo: input.articleNo || '',
      dong: input.dong || '',
      floor: input.floor || '',
      type: input.type || '',
      dealType: input.dealType || '',
      priceHint: input.priceHint || '',
      areaHint: input.areaHint || '',
      directionHint: input.directionHint || '',
      featureText: input.featureText || '',
      floorViewText: input.floorViewText || '',
      listingFeatureText: input.listingFeatureText || '',
      optionText: input.optionText || '',
      moveInText: input.moveInText || '',
      isGroupedListing: Boolean(input.isGroupedListing),
      groupedBrokerCount: input.groupedBrokerCount || 0,
      groupedExactStable: Boolean(input.groupedExactStable),
      groupedExactObservationCount: Math.min(9, Math.max(0, Number(input.groupedExactObservationCount || 0) || 0)),
      dongHoStatus: input.dongHoStatus || '',
      dongHo: input.dongHo || '',
      candidateCount: Math.min(999, Number(input.candidateCount || 0) || 0),
      candidateComplete: input.candidateComplete === true
        ? true
        : (input.candidateComplete === false ? false : null),
      groupChildExpectedCount: Math.min(999, Math.max(0, Number(input.groupChildExpectedCount || 0) || 0)),
      groupChildPlannedCount: Math.min(999, Math.max(0, Number(input.groupChildPlannedCount || 0) || 0)),
      groupChildResolvedCount: Math.min(999, Math.max(0, Number(input.groupChildResolvedCount || 0) || 0)),
      groupChildComplete: input.groupChildComplete === true,
      groupChildObservedCount: Math.min(999, Math.max(0, Number(input.groupChildObservedCount || 0) || 0)),
      groupChildPlanReason: String(input.groupChildPlanReason || '').replace(/[^a-z-]/g, '').slice(0, 48),
      qualityRejectedReason: input.qualityRejectedReason || '',
      qualityConfidence: input.qualityConfidence || '',
      routeSearchStatus: input.routeSearchStatus || '',
      routeSearchElapsedSec: Math.max(0, Math.floor(Number(input.routeSearchElapsedSec || 0) || 0)),
      dongHoSource: input.dongHoSource || '',
      dongHoHash: input.dongHoHash || '',
      resolverBranch: input.resolverBranch || '',
      resolverOutcome: input.resolverOutcome || '',
      listingContextMatched: input.listingContextMatched === true
        ? true
        : (input.listingContextMatched === false ? false : null),
      listingContextFingerprint: /^identity:[0-9a-f]{16}$/i.test(String(input.listingContextFingerprint || ''))
        ? String(input.listingContextFingerprint).toLowerCase()
        : '',
      listingContextContractVersion: Math.min(9, Math.max(0, Number(input.listingContextContractVersion || 0) || 0)),
      listingContextExpectedFingerprint: /^identity:[0-9a-f]{16}$/i.test(String(input.listingContextExpectedFingerprint || ''))
        ? String(input.listingContextExpectedFingerprint).toLowerCase()
        : '',
      listingContextMismatchFields: (Array.isArray(input.listingContextMismatchFields)
        ? input.listingContextMismatchFields
        : [])
        .map((value) => String(value || '').replace(/[^a-z-]/g, '').slice(0, 32))
        .filter(Boolean)
        .slice(0, 12),
      collectedAt: input.collectedAt || '',
      text: input.text || ''
    };
  }

  function normalizeRegionExportScope(scopeInput) {
    const input = scopeInput && typeof scopeInput === 'object'
      ? scopeInput
      : { key: String(scopeInput || 'current') };
    return {
      key: input.key || input.complexId || input.name || 'current',
      complexId: input.complexId || '',
      name: input.name || '',
      listingCount: Number(input.listingCount || 0) || 0
    };
  }

  async function regionExportListingMarkerInfo(row, scopeInput) {
    const input = row && typeof row === 'object' ? row : {};
    if (/^listing:[0-9a-f]{8,64}$/i.test(String(input.listingMarker || ''))) {
      return {
        marker: String(input.listingMarker).toLowerCase(),
        reusable: true,
        kind: 'existing'
      };
    }
    const scope = normalizeRegionExportScope(scopeInput);
    const publicIdentity = regionExportListingPublicIdentity(input);
    const stablePublicKey = publicIdentity
      ? [scope.complexId || scope.name, publicIdentity].map(normalizeText).join('|')
      : '';
    const transientKey = [scope.key, input.key, input.rowIndex].map(normalizeText).join('|');
    const articleMarkerReusable = Boolean(
      input.articleNo
      && !input.isGroupedListing
      && Number(input.groupedBrokerCount || 0) <= 1
    );
    const rowKey = articleMarkerReusable
      ? `article|${String(input.articleNo).replace(/[^0-9]/g, '')}`
      : (stablePublicKey ? `public|${stablePublicKey}` : `transient|${transientKey}`);
    const nonce = rowKey ? await regionExportCheckpointMarkerNonce() : '';
    const digest = nonce ? await regionExportMarkerDigest(`${nonce}|region-row|${rowKey}`) : '';
    return {
      marker: digest ? `listing:${digest}` : '',
      reusable: Boolean(articleMarkerReusable || stablePublicKey),
      kind: articleMarkerReusable ? 'article' : (stablePublicKey ? 'public' : 'transient')
    };
  }

  async function regionExportListingMarker(row, scopeInput) {
    const info = await regionExportListingMarkerInfo(row, scopeInput);
    return info.marker;
  }

  function regionExportComplexStatusRow(complexTarget, status, message) {
    const scope = normalizeRegionExportScope(complexTarget || {});
    return {
      complexName: scope.name,
      complexListingCount: scope.listingCount,
      rowIndex: 0,
      articleNo: '',
      dongHoStatus: status || 'complex-status',
      dongHo: '',
      dongHoSource: 'region-export',
      dongHoHash: '',
      resolverBranch: '',
      resolverOutcome: '',
      text: normalizeText(message || '')
    };
  }

  function currentTimestampForFilename() {
    const date = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
      '-',
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds())
    ].join('');
  }

  const REGION_EXPORT_SIMPLE_HEADERS = [
    '\uB3D9',
    '\uD638\uC218',
    '\uAC70\uB798\uBC29\uC2DD',
    '\uAC00\uACA9',
    '\uD0C0\uC785',
    '\uD3C9\uC218',
    '\uBC29\uD5A5',
    '\uCE35/\uC804\uB9DD',
    '\uC785\uC8FC\uAC00\uB2A5\uC77C/\uD2B9\uC9D5',
    '\uC635\uC158',
    '\uB9E4\uBB3C\uD2B9\uC9D5',
    '\uBE44\uACE0',
    '\uC218\uC9D1\uC2DC\uAC04'
  ];

  function regionExportUniqueParts(parts) {
    const seen = new Set();
    const result = [];
    (Array.isArray(parts) ? parts : []).map(normalizeText).filter(Boolean).forEach((part) => {
      part.split(/\s+\/\s+/).map(normalizeText).filter(Boolean).forEach((splitPart) => {
        const key = splitPart.replace(/\s+/g, '').toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        result.push(splitPart);
      });
    });
    return result;
  }

  function dongHoPresentationApi() {
    return window.DHS_DONGHO_PRESENTATION || {};
  }

  function listingAreaPresentationApi() {
    return window.DHS_LISTING_AREA_PRESENTATION || {};
  }

  function regionExportPresentation(row) {
    const safe = row || {};
    const api = dongHoPresentationApi();
    if (!api || typeof api.buildDongHoPresentation !== 'function') {
      return {
        status: 'unresolved',
        dong: '',
        ho: REGION_EXPORT_UNRESOLVED_LABEL,
        display: '',
        candidateCount: 0,
        note: '\uD655\uC815 \uD45C\uC2DC \uBD88\uAC00',
        statusLabel: '\uBBF8\uD655\uC815',
        hasEvidence: false
      };
    }
    return api.buildDongHoPresentation({
      status: safe.dongHoStatus,
      display: safe.dongHo,
      targetDong: safe.dong,
      targetFloor: safe.floor,
      candidateCount: safe.candidateCount,
      candidateComplete: safe.candidateComplete,
      qualityRejectedReason: safe.qualityRejectedReason
    });
  }

  function regionExportCandidateFloorContext() {
    return {
      floorKind: state.detailFloorKind,
      floorValue: state.detailFloorValue,
      floorBand: state.detailFloorBand,
      totalFloor: state.detailTotalFloor
    };
  }

  function regionExportNumericToken(value) {
    const api = dongHoPresentationApi();
    return api && typeof api.numericToken === 'function' ? api.numericToken(value) : '';
  }

  function regionExportExactParts(display) {
    const api = dongHoPresentationApi();
    return api && typeof api.exactParts === 'function' ? api.exactParts(display) : { dong: '', ho: '' };
  }

  function regionExportHoOnlyDisplay(display, targetDong) {
    return regionExportPresentation({
      dongHoStatus: 'multiple-candidates',
      dongHo: display,
      dong: targetDong
    }).ho.replace(/^\uD6C4\uBCF4\s*:\s*/, '');
  }

  function regionExportCandidateDisplayCount(display) {
    const api = dongHoPresentationApi();
    return api && typeof api.candidateCount === 'function' ? api.candidateCount({ display }) : 0;
  }

  function regionExportCandidateCount(row) {
    return regionExportPresentation(row).candidateCount;
  }

  function regionExportDongCell(row) {
    const presentation = regionExportPresentation(row);
    return presentation.dong || regionExportNumericToken(row && row.dong);
  }

  function regionExportHoCell(row) {
    return regionExportPresentation(row).ho;
  }

  function regionExportAreaHint(text) {
    const api = listingAreaPresentationApi();
    return api && typeof api.supplyAreaFromText === 'function' ? api.supplyAreaFromText(text) : '';
  }

  function regionExportPyeongCell(row) {
    const api = listingAreaPresentationApi();
    return api && typeof api.pyeongCell === 'function' ? api.pyeongCell(row) : '';
  }

  function regionExportFeatureText(text) {
    return normalizeText(text).slice(0, 500);
  }

  function regionExportFeatureSource(row) {
    return normalizeText([
      row && row.featureText,
      row && row.text
    ].filter(Boolean).join(' '));
  }

  function regionExportRoomBathFeature(row) {
    const text = regionExportFeatureSource(row);
    const room = text.match(/(?:\uBC29\s*([1-5])|([1-5])\s*\uB8F8)/);
    const bath = text.match(/(?:\uD654\uC7A5\uC2E4|\uC695\uC2E4)\s*([1-4])/);
    const roomCount = room ? (room[1] || room[2]) : '';
    const bathCount = bath ? bath[1] : '';
    if (roomCount && bathCount) return `\uBC29${roomCount}\uD654${bathCount}`;
    if (roomCount) return `${roomCount}\uB8F8`;
    return '';
  }

  function regionExportDevelopmentFeature(row) {
    const text = regionExportFeatureSource(row);
    if (/\uC2E0\uC18D\uD1B5\uD569/.test(text)) return '\uC2E0\uC18D\uD1B5\uD569';
    if (/\uC7AC\uAC1C\uBC1C|\uB274\uD0C0\uC6B4|\uAC1C\uBC1C/.test(text)) return '\uC7AC\uAC1C\uBC1C';
    return '';
  }

  function regionExportLocationFeature(row) {
    const text = regionExportFeatureSource(row);
    const parts = [];
    if (/\uB9C8\uCC9C\uC5ED|\uC5ED\uC138\uAD8C|\uC5ED\s*\uB3C4\uBCF4/.test(text)) parts.push('\uC5ED\uC138\uAD8C');
    if (/\uCD08\uB4F1|\uCD08\s*\d?\s*\uBD84|\uD559\uAD50|\uD559\uAD70|\uD559\uC138\uAD8C/.test(text)) parts.push('\uD559\uAD50 \uC778\uADFC');
    if (/\uACF5\uC6D0|\uC232\uC138\uAD8C|\uC131\uB0B4\uCC9C|\uCC9C\uBCC0/.test(text)) parts.push('\uACF5\uC6D0/\uB179\uC9C0');
    return regionExportUniqueParts(parts).join(' / ');
  }

  function regionExportFloorViewFeature(row) {
    const saved = normalizeText(row && row.floorViewText);
    if (saved) return saved;
    const text = regionExportFeatureSource(row);
    const floor = normalizeText(row && row.floor);
    const parts = [];
    if (/^\uACE0/.test(floor)) parts.push('\uACE0\uCE35');
    else if (/^\uC911/.test(floor)) parts.push('\uC911\uCE35');
    else if (/^\uC800/.test(floor)) parts.push('\uC800\uCE35');
    else {
      const match = floor.match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
      if (match) {
        const current = Number(match[1]);
        const total = Number(match[2]);
        const lowMax = Math.max(1, Math.floor(total / 3));
        const highMin = Math.max(lowMax + 1, Math.ceil((total * 2) / 3));
        if (current <= lowMax) parts.push('\uC800\uCE35');
        else if (current >= highMin) parts.push('\uACE0\uCE35');
        else parts.push('\uC911\uCE35');
      }
    }
    if (/\uC804\uB9DD|\uBDF0|\uCC44\uAD11|\uBC1D/.test(text)) parts.push('\uC804\uB9DD/\uCC44\uAD11');
    return regionExportUniqueParts(parts).join(' / ');
  }

  function regionExportMoveFeature(row) {
    const saved = normalizeText(row && row.moveInText);
    if (saved) return saved;
    const text = regionExportFeatureSource(row);
    if (/\uC989\uC2DC|\uBE60\uB978\s*\uC785\uC8FC|\uBE60\uB978\uC785\uC8FC/.test(text)) return '\uBE60\uB978\uC785\uC8FC';
    if (/\uC785\uC8FC\s*\uD611\uC758|\uD611\uC758|\uB0A0\uC9DC\uD611\uC758/.test(text)) return '\uC785\uC8FC\uD611\uC758';
    if (/\uC785\uC8FC\uAC00\uB2A5/.test(text)) return '\uC785\uC8FC\uAC00\uB2A5';
    return '';
  }

  function regionExportOption(row) {
    const saved = normalizeText(row && row.optionText);
    if (saved) return saved;
    const text = regionExportFeatureSource(row);
    const parts = [];
    if (/\uC62C\s*\uC218\uB9AC|\uC62C\uB9AC\uBAA8\uB378|\uC804\uCCB4\s*\uC218\uB9AC/.test(text)) parts.push('\uC62C\uC218\uB9AC');
    else if (/\uAE54\uB054\s*\uC218\uB9AC|\uAE54\uB054/.test(text)) parts.push('\uAE54\uB054\uC218\uB9AC');
    if (/\uD655\uC7A5/.test(text)) parts.push('\uD655\uC7A5');
    if (/\uC5D0\uC5B4\uCEE8/.test(text)) parts.push('\uC5D0\uC5B4\uCEE8 \uC788\uC74C');
    return regionExportUniqueParts(parts).join(' / ');
  }

  function regionExportListingFeature(row) {
    const saved = normalizeText(row && row.listingFeatureText);
    if (saved) return saved;
    return regionExportUniqueParts([
      regionExportRoomBathFeature(row),
      regionExportDevelopmentFeature(row) ? `\uAC1C\uBC1C ${regionExportDevelopmentFeature(row)}` : '',
      regionExportLocationFeature(row) ? `\uC785\uC9C0 ${regionExportLocationFeature(row)}` : ''
    ]).join(' / ');
  }

  function regionExportCheckpointApi() {
    return window.DHS_REGION_EXPORT_CHECKPOINT || {};
  }

  function mergeRegionRevalidatedRows(previousRows, currentRows) {
    const api = regionExportCheckpointApi();
    if (typeof api.mergeRevalidatedRows === 'function') {
      return api.mergeRevalidatedRows(previousRows, currentRows);
    }
    const currentByMarker = new Map((Array.isArray(currentRows) ? currentRows : [])
      .filter((row) => /^listing:[0-9a-f]{8,64}$/i.test(String(row && row.listingMarker || '')))
      .map((row) => [String(row.listingMarker).toLowerCase(), row]));
    return (Array.isArray(previousRows) ? previousRows : []).map((row, index) => {
      const marker = String(row && row.listingMarker || '').toLowerCase();
      return Object.assign({}, currentByMarker.get(marker) || row, { rowIndex: index + 1 });
    });
  }

  function regionExportCheckpointRowMatchesCurrent(checkpointRow, currentRow) {
    const api = regionExportCheckpointApi();
    return Boolean(
      api &&
      typeof api.checkpointRowMatchesCurrent === 'function' &&
      api.checkpointRowMatchesCurrent(checkpointRow, currentRow)
    );
  }

  function regionExportCheckpointRow(row) {
    const safe = stripRegionExportRow(row);
    return {
      listingMarker: safe.listingMarker,
      complexName: safe.complexName,
      complexListingCount: safe.complexListingCount,
      rowIndex: safe.rowIndex,
      dong: safe.dong,
      floor: safe.floor,
      type: safe.type,
      dealType: safe.dealType,
      priceHint: safe.priceHint,
      areaHint: safe.areaHint,
      directionHint: safe.directionHint,
      floorViewText: regionExportFloorViewFeature(safe),
      moveInText: regionExportMoveFeature(safe),
      optionText: regionExportOption(safe),
      listingFeatureText: regionExportListingFeature(safe),
      isGroupedListing: safe.isGroupedListing,
      groupedBrokerCount: safe.groupedBrokerCount,
      dongHoStatus: safe.dongHoStatus,
      dongHo: safe.dongHo,
      candidateCount: safe.candidateCount,
      qualityRejectedReason: safe.qualityRejectedReason,
      qualityConfidence: safe.qualityConfidence,
      routeSearchStatus: safe.routeSearchStatus,
      routeSearchElapsedSec: safe.routeSearchElapsedSec,
      dongHoSource: safe.dongHoSource,
      dongHoHash: safe.dongHoHash,
      resolverBranch: safe.resolverBranch,
      resolverOutcome: safe.resolverOutcome,
      ...(safe.listingContextMatched === null ? {} : {
        listingContextContractVersion: safe.listingContextContractVersion,
        listingContextMatched: safe.listingContextMatched,
        listingContextFingerprint: safe.listingContextFingerprint,
        listingContextExpectedFingerprint: safe.listingContextExpectedFingerprint
      }),
      collectedAt: safe.collectedAt
    };
  }

  function regionExportStorageLocalRef() {
    const chromeRef = chromeRuntimeRef();
    try {
      if (!chromeRef || !chromeRef.storage || !chromeRef.storage.local) return null;
      return { chromeRef, storage: chromeRef.storage.local };
    } catch (_) {
      return null;
    }
  }

  function regionExportStorageCall(method, input) {
    return new Promise((resolve) => {
      const ref = regionExportStorageLocalRef();
      if (!ref || !ref.storage || typeof ref.storage[method] !== 'function') {
        resolve({ ok: false, value: null, reason: 'storage-unavailable' });
        return;
      }
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        resolve(result);
      };
      const timeoutId = window.setTimeout(() => {
        finish({ ok: false, value: null, reason: 'storage-timeout' });
      }, REGION_EXPORT_STORAGE_TIMEOUT_MS);
      try {
        const pending = ref.storage[method](input, (value) => {
          let runtimeError = null;
          try {
            runtimeError = ref.chromeRef.runtime && ref.chromeRef.runtime.lastError;
          } catch (_) {
            runtimeError = true;
          }
          finish(runtimeError
            ? { ok: false, value: null, reason: 'storage-error' }
            : { ok: true, value, reason: '' });
        });
        if (pending && typeof pending.then === 'function') {
          pending.then((value) => finish({ ok: true, value, reason: '' }))
            .catch(() => finish({ ok: false, value: null, reason: 'storage-error' }));
        }
      } catch (_) {
        finish({ ok: false, value: null, reason: 'storage-error' });
      }
    });
  }

  async function readRegionExportCheckpointRaw() {
    const result = await regionExportStorageCall('get', [REGION_EXPORT_CHECKPOINT_STORAGE_KEY]);
    if (!result.ok) {
      state.regionExportCheckpointStatus = result.reason;
      return '';
    }
    const value = result.value && result.value[REGION_EXPORT_CHECKPOINT_STORAGE_KEY];
    return typeof value === 'string' ? value : '';
  }

  async function removeRegionExportCheckpointRaw() {
    const result = await regionExportStorageCall('remove', REGION_EXPORT_CHECKPOINT_STORAGE_KEY);
    if (!result.ok) state.regionExportCheckpointStatus = result.reason;
    return result.ok;
  }

  async function restoreRegionExportCheckpoint(regionKey) {
    const api = regionExportCheckpointApi();
    if (!api || typeof api.restoreCheckpoint !== 'function') {
      state.regionExportCheckpointStatus = 'module-unavailable';
      return { rows: [], markers: [], retryMarkers: [], retryExactEvidence: [], reason: 'module-unavailable' };
    }
    const raw = await readRegionExportCheckpointRaw();
    if (!raw) {
      if (String(state.regionExportCheckpointStatus || '').startsWith('storage-')) {
        return { rows: [], markers: [], retryMarkers: [], retryExactEvidence: [], reason: state.regionExportCheckpointStatus };
      }
      state.regionExportCheckpointStatus = 'empty';
      return { rows: [], markers: [], retryMarkers: [], retryExactEvidence: [], reason: 'empty' };
    }
    const restored = api.restoreCheckpoint(raw, {
      regionKey,
      nowMs: Date.now(),
      maxAgeMs: REGION_EXPORT_CHECKPOINT_MAX_AGE_MS
    });
    if (!restored || !restored.ok) {
      const reason = restored && restored.reason || 'invalid';
      const cleanupSucceeded = await removeRegionExportCheckpointRaw();
      state.regionExportCheckpointStatus = cleanupSucceeded ? reason : `${reason}-cleanup-failed`;
      return { rows: [], markers: [], retryMarkers: [], retryExactEvidence: [], reason: state.regionExportCheckpointStatus };
    }
    const rows = restored.rows.map(stripRegionExportRow);
    state.regionExportCheckpointStatus = 'resumed';
    return {
      rows,
      markers: restored.markers.slice(),
      retryMarkers: Array.isArray(restored.retryMarkers) ? restored.retryMarkers.slice() : [],
      retryExactEvidence: Array.isArray(restored.retryExactEvidence)
        ? restored.retryExactEvidence.map((item) => Object.assign({}, item))
        : [],
      reason: 'restored'
    };
  }

  async function persistRegionExportCheckpoint(regionKey, updateInput) {
    const api = regionExportCheckpointApi();
    if (!api || typeof api.buildCheckpoint !== 'function') {
      state.regionExportCheckpointStatus = 'module-unavailable';
      return false;
    }
    const update = updateInput && typeof updateInput === 'object' ? updateInput : {};
    const previousRead = await regionExportStorageCall('get', [REGION_EXPORT_CHECKPOINT_STORAGE_KEY]);
    if (!previousRead.ok) {
      state.regionExportCheckpointStatus = previousRead.reason;
      return false;
    }
    const previousValue = previousRead.value && previousRead.value[REGION_EXPORT_CHECKPOINT_STORAGE_KEY];
    const previous = typeof previousValue === 'string' ? previousValue : '';
    const checkpoint = api.buildCheckpoint({
      regionKey,
      previous,
      rows: (Array.isArray(update.rows) ? update.rows : []).map(regionExportCheckpointRow),
      removeMarkers: Array.isArray(update.removeMarkers) ? update.removeMarkers : [],
      retryMarkers: Array.isArray(update.retryMarkers) ? update.retryMarkers : [],
      retryExactEvidence: Array.isArray(update.retryExactEvidence) ? update.retryExactEvidence : [],
      removeRetryMarkers: Array.isArray(update.removeRetryMarkers) ? update.removeRetryMarkers : [],
      nowMs: Date.now()
    });
    if (!checkpoint || !Array.isArray(checkpoint.rows)) return false;
    const retryMarkers = Array.isArray(checkpoint.retryMarkers) ? checkpoint.retryMarkers : [];
    if (!checkpoint.rows.length && !retryMarkers.length) {
      const removed = await removeRegionExportCheckpointRaw();
      if (removed) state.regionExportCheckpointStatus = 'empty';
      return removed;
    }
    const stored = await regionExportStorageCall('set', {
      [REGION_EXPORT_CHECKPOINT_STORAGE_KEY]: JSON.stringify(checkpoint)
    });
    if (stored.ok) {
      state.regionExportCheckpointStatus = 'saved';
      return true;
    }
    state.regionExportCheckpointStatus = stored.reason;
    return false;
  }

  async function clearRegionExportCheckpoint(regionKey) {
    const raw = await readRegionExportCheckpointRaw();
    if (!raw) {
      state.regionExportCheckpointStatus = 'cleared';
      return true;
    }
    try {
      const checkpoint = JSON.parse(raw);
      if (!checkpoint || checkpoint.regionKey !== regionKey) return false;
    } catch (_) {
      return removeRegionExportCheckpointRaw();
    }
    const cleared = await removeRegionExportCheckpointRaw();
    if (cleared) state.regionExportCheckpointStatus = 'cleared';
    return cleared;
  }

  function regionExportNote(row) {
    const presentation = regionExportPresentation(row);
    if (presentation.status === 'exact' && row && row.groupedExactStable) return '\uC7AC\uD655\uC778 \uC77C\uCE58';
    return presentation.note;
  }

  function regionExportCollectedHour(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '';
    const pad = (item) => String(item).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  function regionExportSimpleRow(row, collectedAt = '') {
    const safe = row || {};
    const floorView = regionExportFloorViewFeature(safe);
    const moveFeature = regionExportMoveFeature(safe);
    return [
      regionExportDongCell(safe),
      regionExportHoCell(safe),
      normalizeText(safe.dealType),
      normalizeText(safe.priceHint),
      normalizeText(safe.type),
      regionExportPyeongCell(safe),
      normalizeText(safe.directionHint),
      floorView,
      moveFeature,
      regionExportOption(safe),
      regionExportListingFeature(safe),
      regionExportNote(safe),
      regionExportCollectedHour(safe.collectedAt || collectedAt)
    ];
  }

  function regionExportSimpleRowsForOverlay(row, options) {
    const simpleRow = regionExportSimpleRow(row, row && row.collectedAt || '');
    const displayRows = REGION_EXPORT_SIMPLE_HEADERS
      .map((label, index) => ({ label, value: simpleRow[index] || '' }))
      .filter((item) => normalizeText(item.value));
    const processingRows = regionExportProcessingRowsForOverlay(row, options);
    if (!processingRows.length) return displayRows;
    const collectedIndex = displayRows.findIndex((item) => item.label === '\uC218\uC9D1\uC2DC\uAC04');
    if (collectedIndex < 0) return displayRows.concat(processingRows);
    return displayRows
      .slice(0, collectedIndex)
      .concat(processingRows)
      .concat(displayRows.slice(collectedIndex));
  }

  function regionExportProcessingStatusForOverlay(row) {
    const safe = row || {};
    const routeStatus = String(safe.routeSearchStatus || '');
    if (routeStatus === 'active') return '\uCC98\uB9AC\uC911';
    if (routeStatus || ['exact', 'multiple-candidates', 'unresolved', 'context-mismatch'].includes(String(safe.dongHoStatus || ''))) {
      return '\uCC98\uB9AC\uC644\uB8CC';
    }
    return '';
  }

  function regionExportDurationForOverlay(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds || 0) || 0));
    if (!total) return '';
    if (total < 60) return `${total}\uCD08`;
    const minutes = Math.floor(total / 60);
    const remain = total % 60;
    return remain ? `${minutes}\uBD84 ${remain}\uCD08` : `${minutes}\uBD84`;
  }

  function regionExportProcessingRowsForOverlay(row, options) {
    const safe = row || {};
    const rows = [];
    const status = regionExportProcessingStatusForOverlay(safe);
    if (status) rows.push({ label: '\uCC98\uB9AC\uC0C1\uD0DC', value: status });
    // The current-listing overlay suppresses the baked \uAC78\uB9B0\uC2DC\uAC04 (options.suppressElapsed) so it does
    // NOT bake the live-ticking elapsed into excelRows \u2014 the overlay-view gate then adds it only once
    // a confirmed exact is latched (frozen). Region-export rows keep it (batch progress).
    if (!(options && options.suppressElapsed)) {
      const elapsed = regionExportDurationForOverlay(safe.routeSearchElapsedSec);
      if (elapsed) rows.push({ label: '\uAC78\uB9B0\uC2DC\uAC04', value: elapsed });
    }
    return rows;
  }

  function buildCurrentRegionCsv(rows) {
    const collectedAt = new Date().toISOString();
    const lines = [REGION_EXPORT_SIMPLE_HEADERS.map(csvCell).join(',')];
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const safe = stripRegionExportRow(row);
      lines.push(regionExportSimpleRow(safe, collectedAt).map(csvCell).join(','));
    });
    return `\ufeff${lines.join('\r\n')}\r\n`;
  }

  function buildRegionExportStatusCsv(status, message) {
    return buildCurrentRegionCsv([{
      rowIndex: 0,
      dongHoStatus: status || 'status',
      dongHoSource: 'export',
      text: message || ''
    }]);
  }

  // The user asked for the cleaned output as .xlsx (CSV "정리가 잘 안돼"): a real spreadsheet keeps every
  // column separated and preserves 동/호 leading zeros as text. Build a 2D grid from the same simple
  // columns the CSV used, then hand it to the dependency-free xlsx writer.
  function regionExportRows2D(rows) {
    const collectedAt = new Date().toISOString();
    const grid = [REGION_EXPORT_SIMPLE_HEADERS.slice()];
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      grid.push(regionExportSimpleRow(stripRegionExportRow(row), collectedAt)
        .map((value) => String(value == null ? '' : value)));
    });
    return grid;
  }

  function regionExportStatusRows2D(status, message) {
    const grid = regionExportRows2D([{
      rowIndex: 0,
      dongHoStatus: status || 'status',
      dongHoSource: 'export',
      text: message || ''
    }]);
    // Append self-diagnosing breadcrumbs (why the run produced no usable rows). Padded to the column
    // count so the spreadsheet stays rectangular.
    const width = REGION_EXPORT_SIMPLE_HEADERS.length;
    const pad = (label, value) => {
      const row = new Array(width).fill('');
      row[0] = label;
      row[1] = String(value == null ? '' : value);
      return row;
    };
    const diag = state.regionExportRunDiagnostic && typeof state.regionExportRunDiagnostic === 'object'
      ? state.regionExportRunDiagnostic
      : {};
    grid.push(pad('[진단] 상태', status || ''));
    grid.push(pad('[진단] 메시지', message || ''));
    grid.push(pad('[진단] 선택지역', diag.picked || ''));
    grid.push(pad('[진단] 네이버(추출전)', diag.naverBefore || ''));
    grid.push(pad('[진단] 지역적용', diag.restore || ''));
    if (diag.naverAfter != null) grid.push(pad('[진단] 네이버(적용후)', diag.naverAfter || ''));
    grid.push(pad('[진단] 단지수', String(Math.max(0, Number(state.regionExportComplexTargetCount || 0) || 0))));
    grid.push(pad('[진단] 마지막사유', String(state.regionExportComplexLastReason || state.regionExportLastError || '')));
    return grid;
  }

  function regionExportXlsxWriter() {
    if (typeof DHS_XLSX_WRITER !== 'undefined' && DHS_XLSX_WRITER) return DHS_XLSX_WRITER;
    if (typeof globalThis !== 'undefined' && globalThis.DHS_XLSX_WRITER) return globalThis.DHS_XLSX_WRITER;
    return null;
  }

  function buildRegionExportXlsxBase64(grid) {
    const writer = regionExportXlsxWriter();
    if (!writer || typeof writer.buildXlsx !== 'function') return '';
    return writer.buildXlsx(grid, { sheetName: '동호수 정리' }).base64;
  }

  function regionExportRowHasDongHoEvidence(row) {
    const safe = row || {};
    if (safe.listingContextContractVersion >= 1 && safe.listingContextMatched !== true) return false;
    return regionExportPresentation(safe).hasEvidence;
  }

  function regionExportRowIsUnresolved(row) {
    return !regionExportRowHasDongHoEvidence(row);
  }

  function regionExportQualityGate(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const total = list.length;
    const evidenceCount = list.filter(regionExportRowHasDongHoEvidence).length;
    const unresolvedCount = list.filter(regionExportRowIsUnresolved).length;
    if (total >= 3 && unresolvedCount > 0 && evidenceCount / total < 0.5) {
      return {
        ok: false,
        total,
        evidenceCount,
        unresolvedCount,
        message: `\uD655\uC815/\uD6C4\uBCF4 \uBD80\uC871: ${evidenceCount}/${total}\uAC74. \uC815\uBC00 \uCD94\uCD9C\uB85C \uB2E4\uC2DC \uD655\uC778 \uD544\uC694`
      };
    }
    return {
      ok: true,
      total,
      evidenceCount,
      unresolvedCount,
      message: ''
    };
  }

  async function downloadRegionExportWorkbook(filename, xlsxBase64) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        if (error) reject(error);
        else resolve(value);
      };
      const timeoutId = window.setTimeout(() => {
        finish(new Error('region-export-download-timeout'));
      }, 15000);
      const sent = safeRuntimeSendMessage({
        source: BRIDGE_SOURCE,
        type: 'DOWNLOAD_REGION_EXPORT',
        filename,
        xlsxBase64
      }, (response) => {
        if (!response || response.ok !== true) {
          finish(new Error(String(response && response.reason || 'region-export-download-failed')));
          return;
        }
        finish(null, {
          downloadId: Math.max(0, Number(response.downloadId || 0) || 0),
          path: String(response.path || '').slice(0, 160)
        });
      });
      if (!sent) finish(new Error('region-export-download-unavailable'));
    });
  }

  function regionExportElapsedMilliseconds() {
    const stored = Math.max(0, Number(state.regionExportElapsedMs || 0) || 0);
    const startedAt = Math.max(0, Number(state.regionExportStartedAt || 0) || 0);
    const active = state.regionExportStatus === 'running' && startedAt > 0
      ? Math.max(0, Date.now() - startedAt)
      : 0;
    return Math.min(24 * 60 * 60 * 1000, Math.max(stored, active));
  }

  function regionExportElapsedSeconds() {
    const elapsedMs = regionExportElapsedMilliseconds();
    return elapsedMs > 0 ? Math.max(1, Math.ceil(elapsedMs / 1000)) : 0;
  }

  function finishRegionExportTiming() {
    const stored = Math.max(0, Number(state.regionExportElapsedMs || 0) || 0);
    const startedAt = Math.max(0, Number(state.regionExportStartedAt || 0) || 0);
    const active = startedAt > 0 ? Math.max(0, Date.now() - startedAt) : 0;
    state.regionExportElapsedMs = Math.min(
      24 * 60 * 60 * 1000,
      Math.max(stored, active)
    );
    state.regionExportStartedAt = 0;
    return state.regionExportElapsedMs;
  }

  function beginRegionExportFileWrite(runId) {
    if (runId !== regionExportRunId) return false;
    state.regionExportStatus = 'saving';
    renderOverlay();
    return true;
  }

  function cancelCurrentRegionExport() {
    if (state.regionExportStatus !== 'running') return false;
    regionExportRunId += 1;
    providerRequestGeneration += 1;
    finishRegionExportTiming();
    state.regionExportStatus = 'cancelled';
    state.regionExportLastError = 'user-cancelled';
    state.providerOpenStatus = 'cancelled';
    state.providerDirectLookupStatus = 'cancelled';
    providerRouteLookupRunning = false;
    providerRouteLookupPendingRows.length = 0;
    providerRouteLookupPendingKeys.clear();
    state.providerRouteLookupBatchStatus = 'cancelled';
    clearProviderCandidate(activeProviderArticleMarker(), true);
    renderOverlay();
    return true;
  }

  function regionExportSelectionErrorText(reason) {
    if (reason === 'selection-changed') return '\uC120\uD0DD\uD55C \uC9C0\uC5ED\uC774 \uBC14\uB00C\uC5C8\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.';
    if (reason === 'region-selector-occluded') return '\uC9C0\uC5ED \uC120\uD0DD \uCC3D\uC744 \uC5F4 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.';
    if (reason === 'region-option-unavailable') return '\uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.';
    if (reason) return '\uC9C0\uC5ED \uC120\uD0DD \uCC3D\uC744 \uB2E4\uC2DC \uC5F4\uC5B4 \uC8FC\uC138\uC694.';
    return '\uC2DC/\uB3C4\uBD80\uD130 \uC74D/\uBA74/\uB3D9\uAE4C\uC9C0 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.';
  }

  function regionExportSelectionConfirmationText(selection) {
    const api = regionExportSelectionApi();
    return typeof api.confirmationText === 'function'
      ? api.confirmationText(selection)
      : '';
  }

  function renderRegionExportSelectionFlow(overlay) {
    const flow = overlay && overlay.querySelector('.dhs-region-flow');
    if (!flow) return;
    const active = ['selecting-region', 'confirming-region'].includes(state.regionExportStatus);
    flow.hidden = !active;
    flow.classList.toggle('is-confirming', state.regionExportStatus === 'confirming-region');
    if (!active) {
      const staleOptions = flow.querySelector('.dhs-region-options');
      if (staleOptions) { staleOptions.hidden = true; staleOptions.innerHTML = ''; }
      return;
    }
    const api = regionExportSelectionApi();
    const confirmedSelection = typeof api.createSelection === 'function'
      ? api.createSelection(String(state.regionExportSelectionKey || '').split('|'))
      : { complete: false, values: [], key: '' };
    const liveComplete = state.regionExportStatus === 'confirming-region'
      && Boolean(confirmedSelection && confirmedSelection.complete);
    flow.classList.toggle('is-confirming', liveComplete);
    const labels = ['\uC2DC/\uB3C4', '\uC2DC/\uAD70/\uAD6C', '\uC74D/\uBA74/\uB3D9'];
    // Step values come straight from the DHS picker path (cortarNames). No live-reading of Naver's map,
    // so nothing churns while picking.
    const values = Array.isArray(state.regionExportSelectionValues) ? state.regionExportSelectionValues : [];
    const activeLevelIndex = Math.min(
      Array.isArray(state.regionPickerPath) ? state.regionPickerPath.length : 0,
      REGION_EXPORT_SELECTION_LEVELS.length - 1
    );
    Array.from(flow.querySelectorAll('.dhs-region-step')).forEach((node, index) => {
      const valueNode = node.querySelector('.dhs-region-step-value');
      if (valueNode) valueNode.textContent = values[index] || labels[index];
      node.classList.toggle('is-selected', Boolean(values[index]));
      // A step chip is reachable (clickable to re-pick) only up to the current depth.
      const reachable = index <= (Array.isArray(state.regionPickerPath) ? state.regionPickerPath.length : 0);
      node.disabled = !reachable;
      node.setAttribute('aria-label', `${labels[index]} ${values[index] || '\uC120\uD0DD'}`);
      node.setAttribute('aria-pressed', !liveComplete && index === activeLevelIndex ? 'true' : 'false');
    });
    const title = flow.querySelector('.dhs-region-flow-title');
    const question = flow.querySelector('.dhs-region-question');
    const optionsNode = flow.querySelector('.dhs-region-options');
    const choose = flow.querySelector('[data-dhs-action="choose-region"]');
    const confirm = flow.querySelector('[data-dhs-action="confirm-region"]');
    if (title) {
      title.textContent = liveComplete ? '\uC120\uD0DD \uC9C0\uC5ED \uD655\uC778' : '\uC9C0\uC5ED \uC120\uD0DD';
    }
    if (question) {
      const levelPromptLabel = labels[activeLevelIndex] || '';
      question.textContent = liveComplete
        ? regionExportSelectionConfirmationText(confirmedSelection)
        : (state.regionExportSelectionError
          ? regionExportSelectionErrorText(state.regionExportSelectionError)
          : (state.regionPickerLoading
            ? '\uBD88\uB7EC\uC624\uB294 \uC911\u2026'
            : `${levelPromptLabel}\uC744(\uB97C) \uC120\uD0DD\uD558\uC138\uC694`));
    }
    if (optionsNode) {
      const showOptions = !liveComplete && state.regionExportStatus === 'selecting-region';
      const levelOptions = showOptions && Array.isArray(state.regionPickerOptions)
        ? state.regionPickerOptions
        : [];
      optionsNode.hidden = !showOptions || (levelOptions.length === 0 && !state.regionPickerLoading);
      // renderOverlay() runs on every scan tick (~1/s). Rebuilding innerHTML each time replaces the
      // option <button> nodes mid-interaction, so a click landing between mousedown and mouseup gets
      // cancelled (user has to click twice). Only rewrite when the rendered set actually changed.
      const loadingCell = state.regionPickerLoading && showOptions;
      const optionSig = loadingCell
        ? 'loading'
        : levelOptions.map((option) => `${option.cortarNo}:${option.cortarName}`).join('|');
      if (optionsNode.getAttribute('data-dhs-options-sig') !== optionSig) {
        optionsNode.setAttribute('data-dhs-options-sig', optionSig);
        if (loadingCell) {
          optionsNode.innerHTML = '<div class="dhs-region-option is-loading" aria-disabled="true">\uBD88\uB7EC\uC624\uB294 \uC911\u2026</div>';
        } else {
          optionsNode.innerHTML = levelOptions.map((option) => {
            return '<button type="button" class="dhs-region-option" role="option" aria-selected="false" data-dhs-action="pick-region-option" data-dhs-region-cortarno="' + escapeHtml(option.cortarNo) + '">' + escapeHtml(option.cortarName) + '</button>';
          }).join('');
        }
      }
    }
    if (choose) {
      // The visual "\uC9C0\uC5ED \uC120\uD0DD \uCC3D \uC5F4\uAE30" fallback is gone \u2014 the DHS picker never opens Naver's selector.
      choose.hidden = true;
    }
    if (confirm) {
      confirm.textContent = '\uCD94\uCD9C\uD558\uAE30';
      confirm.hidden = !liveComplete;
      confirm.disabled = !liveComplete;
    }
  }

  function regionExportButtonLabel() {
    if (state.regionExportStatus === 'selecting-region') return '\uC9C0\uC5ED \uC120\uD0DD \uC911';
    if (state.regionExportStatus === 'confirming-region') return '\uC120\uD0DD \uC9C0\uC5ED \uD655\uC778';
    if (state.regionExportStatus === 'preparing') return '\uC9C0\uC5ED \uC870\uC0AC \uC900\uBE44 \uC911';
    if (state.regionExportStatus === 'saving') return `\uACB0\uACFC \uC815\uB9AC \uC911 \u00B7 ${regionExportElapsedSeconds()}\uCD08`;
    if (state.regionExportStatus === 'running') {
      const total = Number(state.regionExportRowCount || 0) || '?';
      const complexTotal = Number(state.regionExportComplexTargetCount || 0) || 0;
      const complexDone = Number(state.regionExportComplexDoneCount || 0) || 0;
      const complexLabel = complexTotal ? ` \u00B7 \uB2E8\uC9C0 ${complexDone}/${complexTotal}` : '';
      const resumed = Number(state.regionExportResumedCount || 0) || 0;
      const resumedLabel = resumed ? ` \u00B7 \uC7AC\uC0AC\uC6A9 ${resumed}` : '';
      const groupedDone = Number(state.regionExportGroupedRevalidationCount || 0) || 0;
      const groupedPending = Number(state.regionExportGroupedRetryPendingCount || 0) || 0;
      const groupedTotal = groupedDone + groupedPending;
      const groupedLabel = groupedTotal
        ? ` \u00B7 \uBB36\uC74C ${groupedDone}/${groupedTotal}`
        : '';
      return `\uC911\uB2E8${complexLabel} \u00B7 \uBB3C\uAC74 ${state.regionExportDoneCount || 0}/${total} \u00B7 ${regionExportElapsedSeconds()}\uCD08${resumedLabel}${groupedLabel}`;
    }
    if (state.regionExportStatus === 'downloaded') {
      return `\uC800\uC7A5 \uC644\uB8CC ${state.regionExportRowCount || 0}\uAC74 \u00B7 ${regionExportElapsedSeconds()}\uCD08`;
    }
    if (state.regionExportStatus === 'quality-blocked') return '\uC800\uC7A5 \uBCF4\uB958 - \uB2E4\uC2DC \uD655\uC778';
    if (state.regionExportStatus === 'no-rows') return '\uB9E4\uBB3C \uC5C6\uC74C - \uB2E4\uC2DC \uC800\uC7A5';
    if (state.regionExportStatus === 'cancelled' && state.regionExportLastError === 'user-cancelled') {
      return `\uC911\uB2E8\uB428 ${state.regionExportDoneCount || 0}\uAC74 \u00B7 ${regionExportElapsedSeconds()}\uCD08 \u00B7 \uB2E4\uC2DC \uC774\uC5B4\uC11C`;
    }
    if (state.regionExportStatus === 'cancelled') return '\uC800\uC7A5 \uCDE8\uC18C - \uB2E4\uC2DC \uC800\uC7A5';
    if (state.regionExportStatus === 'error' && state.regionExportLastError === 'save-picker-unavailable') {
      return '\uC800\uC7A5 \uC704\uCE58 \uC120\uD0DD \uBD88\uAC00';
    }
    if (state.regionExportStatus === 'error') return '\uC9C0\uC5ED \uC815\uBCF4 \uCD94\uCD9C \uB2E4\uC2DC \uC2DC\uB3C4';
    return '\uC6D0\uD558\uB294 \uC9C0\uC5ED \uC815\uBCF4 \uCD94\uCD9C\uD558\uAE30';
  }

  function regionExportTypeMatchesCurrentContext(rowType) {
    const activeTypes = detailTypeTokenList(state);
    if (!rowType || !activeTypes.length) return true;
    const api = window.DHS_LINE_INFERENCE;
    return activeTypes.some((activeType) => {
      if (api && typeof api.typeTokensCompatible === 'function') {
        return api.typeTokensCompatible(rowType, activeType);
      }
      const left = String(rowType || '').match(/^(\d{2,3})([A-Z]{0,3})$/i);
      const right = String(activeType || '').match(/^(\d{2,3})([A-Z]{0,3})$/i);
      if (!left || !right || Number(left[1]) !== Number(right[1])) return false;
      return !left[2] || !right[2] || String(left[2]).toUpperCase() === String(right[2]).toUpperCase();
    });
  }

  function regionExportFloorMatchesCurrentContext(rowSignal) {
    const row = rowSignal || {};
    const active = {
      floorKind: state.detailFloorKind || 'none',
      floorBand: state.detailFloorBand || '',
      floorValue: Number(state.detailFloorValue || 0),
      totalFloor: Number(state.detailTotalFloor || 0)
    };
    if (!row.floorKind || row.floorKind === 'none' || active.floorKind === 'none') return true;
    if (row.floorKind === 'exact' && active.floorKind === 'exact') {
      return Number(row.floorValue || 0) > 0 && Number(row.floorValue || 0) === active.floorValue;
    }
    if (row.floorKind === 'loose' && ['exact', 'loose'].includes(active.floorKind)) {
      return Number(row.floorValue || 0) > 0 && Number(row.floorValue || 0) === active.floorValue;
    }
    if (active.floorKind === 'loose' && row.floorKind === 'exact') {
      return active.floorValue > 0 && Number(row.floorValue || 0) === active.floorValue;
    }
    if (row.floorKind === 'band' && active.floorKind === 'band') {
      if (!row.floorBand || row.floorBand !== active.floorBand) return false;
      const rowTotal = Number(row.totalFloor || 0);
      return !rowTotal || !active.totalFloor || rowTotal === active.totalFloor;
    }
    if (row.floorKind === 'band' && active.floorKind === 'exact' && active.floorValue > 0) {
      const range = bandRange(row.floorBand, Number(row.totalFloor || active.totalFloor || 0));
      return Boolean(range && active.floorValue >= range[0] && active.floorValue <= range[1]);
    }
    if (active.floorKind === 'band' && row.floorKind === 'exact' && Number(row.floorValue || 0) > 0) {
      const range = bandRange(active.floorBand, active.totalFloor || Number(row.totalFloor || 0));
      return Boolean(range && Number(row.floorValue || 0) >= range[0] && Number(row.floorValue || 0) <= range[1]);
    }
    return true;
  }

  function regionExportRowListingContext(row) {
    const input = row || {};
    return {
      ownerMarker: input.articleNo ? hashMarker(input.articleNo) : '',
      dong: input.dong || extractDongToken(input.text || ''),
      dealType: input.dealType,
      priceHint: input.priceHint,
      type: input.type,
      floor: input.floor,
      directionHint: input.directionHint
    };
  }

  function regionExportCurrentListingContext() {
    return {
      ownerMarker: state.articleMarker || '',
      dong: state.detailDongToken,
      dealType: state.dealType,
      priceHint: state.priceToken,
      type: state.detailTypeToken,
      floorKind: state.detailFloorKind,
      floorValue: state.detailFloorValue,
      floorBand: state.detailFloorBand,
      totalFloor: state.detailTotalFloor,
      floor: currentListingFloorForOverlay(),
      directionHint: state.detailDirectionToken
    };
  }

  function regionExportListingContextDecision(row) {
    const api = groupedListingReducerApi();
    if (!api || typeof api.compareListingContexts !== 'function') {
      return {
        matched: false,
        missingFields: ['identity-module'],
        mismatchFields: [],
        expectedFingerprint: '',
        observedFingerprint: ''
      };
    }
    return api.compareListingContexts(
      regionExportRowListingContext(row),
      regionExportCurrentListingContext()
    );
  }

  function regionExportRowMatchesCurrentResolverContext(row, contextDecisionInput) {
    const input = row || {};
    const decision = contextDecisionInput || regionExportListingContextDecision(input);
    if (!decision.matched) return false;
    const expectedMarker = input.articleNo ? hashMarker(input.articleNo) : '';
    if (expectedMarker && state.articleMarker && expectedMarker !== state.articleMarker) return false;
    const text = input.text || `${input.dong || ''} ${input.floor || ''} ${input.type || ''}`;
    const rowDong = extractDongToken(input.dong || text);
    const activeDong = extractDongToken(state.detailDongToken || '') || state.detailDongToken || '';
    if (rowDong && activeDong && rowDong !== activeDong) return false;
    const rowSignal = classifyListingText(text);
    if (!regionExportFloorMatchesCurrentContext(rowSignal)) return false;
    const rowType = input.type || rowSignal.pyeongTypeToken || extractDetailTypeToken(text);
    return regionExportTypeMatchesCurrentContext(rowType);
  }

  function currentResolverExportSnapshot(row) {
    const resolverState = Object.assign({}, state, {
      regionExportStatus: 'idle',
      regionExportCurrentRow: null
    });
    const view = window.DHS_OVERLAY_VIEW
      ? window.DHS_OVERLAY_VIEW.buildOverlayView(resolverState)
      : null;
    const qualityResolution = currentListingDongHoResolutionForOverlay();
    const rawStatus = compareSignalStatus(view);
    const needsContextCheck = ['exact', 'multiple-candidates'].includes(rawStatus);
    const contextDecision = regionExportListingContextDecision(row);
    const contextMatches = !needsContextCheck || regionExportRowMatchesCurrentResolverContext(row, contextDecision);
    const qualityRejected = Boolean(qualityResolution && qualityResolution.qualityRejectedReason);
    const dongHoStatus = qualityRejected ? 'unresolved' : (contextMatches ? rawStatus : 'context-mismatch');
    const candidateDong = dongHoStatus === 'multiple-candidates'
      ? regionExportCandidateDongToken()
      : '';
    const dongHo = qualityRejected
      ? REGION_EXPORT_UNRESOLVED_LABEL
      : dongHoStatus === 'exact'
      ? normalizeText(view && view.primaryValue)
      : (dongHoStatus === 'multiple-candidates' ? regionExportCandidateDongHoDisplay() : '');
    const candidateCount = dongHoStatus === 'multiple-candidates'
      ? regionExportCandidateDisplayCount(dongHo)
      : (dongHoStatus === 'exact' && dongHo ? 1 : 0);
    return Object.assign({
      dongHoStatus,
      dongHo,
      candidateCount,
      qualityRejectedReason: qualityResolution && qualityResolution.qualityRejectedReason || '',
      qualityConfidence: qualityResolution && qualityResolution.qualityConfidence || '',
      dongHoSource: compareSignalSourceMarker(),
      resolverBranch: state.resolverBranch || '',
      resolverOutcome: state.resolverOutcome || '',
      listingContextMatched: contextDecision.matched,
      listingContextContractVersion: 1,
      listingContextFingerprint: contextDecision.observedFingerprint,
      listingContextExpectedFingerprint: contextDecision.expectedFingerprint,
      listingContextMismatchFields: [
        ...(Array.isArray(contextDecision.missingFields) ? contextDecision.missingFields.map((field) => `missing-${field}`) : []),
        ...(Array.isArray(contextDecision.mismatchFields) ? contextDecision.mismatchFields : [])
      ]
    }, candidateDong ? { dong: candidateDong } : {});
  }

  function regionExportResolutionIsExact(resolution) {
    return Boolean(resolution && resolution.dongHoStatus === 'exact' && resolution.dongHo);
  }

  function regionExportCandidateDongHoInput() {
    const displays = [
      ...(Array.isArray(state.officialCandidateDisplays) ? state.officialCandidateDisplays : []),
      ...(Array.isArray(state.lineInferenceCandidateDisplays) ? state.lineInferenceCandidateDisplays : [])
    ];
    const count = Math.max(
      Number(state.officialCandidateCells || 0) || 0,
      Number(state.lineInferenceCandidateCount || 0) || 0
    );
    return {
      candidates: displays,
      reportedCount: count,
      targetDong: state.detailDongToken,
      ...regionExportCandidateFloorContext()
    };
  }

  function regionExportCandidateDongToken() {
    const api = dongHoPresentationApi();
    return api && typeof api.commonCandidateDong === 'function'
      ? api.commonCandidateDong(regionExportCandidateDongHoInput())
      : '';
  }

  function regionExportCandidateDongHoDisplay() {
    const api = dongHoPresentationApi();
    return api && typeof api.buildCandidateDisplay === 'function'
      ? api.buildCandidateDisplay(regionExportCandidateDongHoInput())
      : '';
  }

  function regionExportOverlayRow(row, resolution) {
    const cleaned = stripRegionExportRow(Object.assign({}, row || {}, resolution || {}));
    return Object.assign({}, cleaned, {
      excelRows: regionExportSimpleRowsForOverlay(cleaned)
    });
  }

  function isAutoLoopFinishedWithoutResult(input) {
    const snapshot = input || {};
    const status = String(snapshot.autoLoopStatus || '');
    if (!['terminal', 'exhausted'].includes(status)) return false;
    return String(snapshot.autoLoopAction || '') === 'record-no-result';
  }

  function currentListingExactResolution(value) {
    const exact = normalizeText(value);
    const api = window.DHS_DONGHO_QUALITY;
    if (!api || typeof api.evaluateExactContext !== 'function') {
      return {
        dongHoStatus: 'unresolved',
        dongHo: REGION_EXPORT_UNRESOLVED_LABEL,
        qualityRejectedReason: 'quality-module-missing',
        qualityConfidence: ''
      };
    }
    const target = currentCdpTargetContext() || {};
    const targetFloorKind = String(target.detailFloorKind || target.floorKind || 'none');
    const useTargetFloor = ['exact', 'band'].includes(targetFloorKind);
    const decision = api.evaluateExactContext({
      exact,
      expectedDong: target.detailDongToken || target.dong || state.detailDongToken || '',
      floorKind: useTargetFloor ? targetFloorKind : state.detailFloorKind,
      floorBand: useTargetFloor ? (target.detailFloorBand || target.floorBand || '') : state.detailFloorBand,
      floorValue: useTargetFloor ? (target.detailFloorValue || target.floorValue || 0) : state.detailFloorValue,
      totalFloor: useTargetFloor ? (target.detailTotalFloor || target.totalFloor || 0) : state.detailTotalFloor
    });
    if (decision.accepted) {
      return {
        dongHoStatus: 'exact',
        dongHo: exact,
        qualityRejectedReason: '',
        qualityConfidence: decision.confidence
      };
    }
    return {
      dongHoStatus: 'unresolved',
      dongHo: REGION_EXPORT_UNRESOLVED_LABEL,
      qualityRejectedReason: decision.reason,
      qualityConfidence: decision.confidence
    };
  }

  function currentListingDongHoResolutionForOverlay() {
    // A latched confirmed exact — own capture OR inherited from a same-unit (동일매물) group sibling —
    // is the final answer for this listing. Return it FIRST so the ROW matches the confirmed overlay
    // view; otherwise this listing's own weaker resolution (e.g. a late line-inference multi-candidate)
    // would override the confirmed single display via decorateCurrentListingView.
    if (
      state.confirmedExactDisplay
      && state.confirmedExactMarker
      && state.confirmedExactMarker === normalizeText(state.articleMarker || '')
    ) {
      const latched = currentListingExactResolution(state.confirmedExactDisplay);
      if (latched.dongHoStatus === 'exact') return latched;
    }
    const cdpFinal = cdpResolverFinalResolutionForOverlay();
    if (cdpFinal) return cdpFinal.dongHoStatus === 'exact'
      ? currentListingExactResolution(cdpFinal.dongHo)
      : cdpFinal;
    if (
      state.providerCandidatePresent &&
      state.providerCandidateDisplay &&
      state.providerOpenStatus === 'captured' &&
      !state.providerCandidateRejectedReason &&
      String(state.resolverOutcome || '').startsWith('captured:')
    ) {
      return currentListingExactResolution(state.providerCandidateDisplay);
    }
    if (
      state.groupCandidatePresent &&
      state.groupCandidateDisplay &&
      !state.groupCandidateRejectedReason &&
      String(state.resolverOutcome || '').startsWith('captured-group:')
    ) {
      return currentListingExactResolution(state.groupCandidateDisplay);
    }
    if (
      state.articlePresent &&
      state.officialExactCandidatePresent &&
      state.officialExactCandidateDisplay &&
      state.resolverBranch === 'official-table' &&
      state.resolverOutcome === 'official-table-exact'
    ) {
      return currentListingExactResolution(state.officialExactCandidateDisplay);
    }
    const confirmedLandLineSources = [
      'land-line-after-group',
      'land-line-after-provider-floor',
      'land-line-after-provider-route-single',
      'land-line-direct-ho-corroborated',
      'building-units-article-linked'
    ];
    const landLineDisplay = normalizeText(state.landLineCandidateDisplay || state.lineInferenceDisplay || '');
    if (
      state.landLineCandidatePresent &&
      landLineDisplay &&
      !state.landLineRejectedReason &&
      state.landLineCandidateCertainty === 'LAND_LINE' &&
      confirmedLandLineSources.includes(state.landLineCandidateSource) &&
      state.resolverOutcome === state.landLineCandidateSource
    ) {
      return currentListingExactResolution(landLineDisplay);
    }
    // Weak/negative verdicts (a line-inference N-\uD638 guess, a single estimate, or "\uBBF8\uD655\uC815") must NOT be
    // shown while the resolver is still working toward a stronger provider/group capture that can
    // collapse them to one exact \u2014 otherwise the overlay flickers "\uBBF8\uD655\uC815 \u2192 2\uAC1C \uD6C4\uBCF4 \u2192 1\uAC1C \uD655\uC815", which
    // the user finds misleading. A confirmed exact is handled by the branches above and shows
    // immediately; everything below is a not-yet-certain verdict, so gate it on `displaySettled`.
    //
    // `displaySettled` is true only when the resolver has genuinely stopped: the route search
    // expired, OR a hard time cap elapsed (anti-hang), OR the loop reported no-result AND is not
    // actively pursuing anything AND a short floor has passed (covers the startup window where the
    // loop momentarily "exhausts" before the line map / route targets have even loaded).
    const investigationAgeMs = Number(state.investigationStartedAtMs || 0) > 0
      ? Math.max(0, Date.now() - Number(state.investigationStartedAtMs || 0))
      : 0;
    const resolverActivelyWorking = lineMapRecoveryPending
      || ['opening', 'running'].includes(String(state.autoLoopStatus || ''))
      || String(state.autoLoopAction || '') === 'scan-group-route'
      || ['opening', 'direct-lookup', 'clicked', 'trusted-clicked'].includes(String(state.providerOpenStatus || ''))
      || state.groupRouteStatus === 'fetching';
    // The auto-loop oscillates exhausted↔opening between group-route retries, so a single "finished"
    // tick must not count as a final settle — otherwise a weak line-inference candidate flashes for
    // ~one tick before the loop resumes. Debounce: the finished-look must persist for a short window.
    const nowMs = Date.now();
    const settleLookMarker = normalizeText(state.articleMarker || '');
    const finishedLook = investigationAgeMs >= 3000
      && !resolverActivelyWorking
      && isAutoLoopFinishedWithoutResult(state);
    if (finishedLook && settledLookMarker === settleLookMarker && settledLookSinceMs > 0) {
      // already tracking — keep the original start time
    } else if (finishedLook) {
      settledLookMarker = settleLookMarker;
      settledLookSinceMs = nowMs;
    } else {
      settledLookMarker = '';
      settledLookSinceMs = 0;
    }
    const finishedLookStable = finishedLook
      && settledLookMarker === settleLookMarker
      && settledLookSinceMs > 0
      && (nowMs - settledLookSinceMs) >= 1600;
    const displaySettled = state.routeSearchStatus === 'expired'
      || investigationAgeMs >= 15000
      || finishedLookStable;
    const candidateDisplay = regionExportCandidateDongHoDisplay();
    if (candidateDisplay) {
      if (!displaySettled) return { dongHoStatus: 'waiting', dongHo: '' };
      return { dongHoStatus: 'multiple-candidates', dongHo: candidateDisplay };
    }
    if (state.lineInferenceStatus === 'single-estimated' && state.lineInferenceDisplay) {
      if (!displaySettled) return { dongHoStatus: 'waiting', dongHo: '' };
      return { dongHoStatus: 'multiple-candidates', dongHo: `\uD6C4\uBCF4: ${normalizeText(state.lineInferenceDisplay)}` };
    }
    if (isAutoLoopFinishedWithoutResult(state) || state.routeSearchStatus === 'expired') {
      if (!displaySettled) return { dongHoStatus: 'waiting', dongHo: '' };
      return { dongHoStatus: 'unresolved', dongHo: REGION_EXPORT_UNRESOLVED_LABEL };
    }
    return { dongHoStatus: 'waiting', dongHo: '' };
  }

  function currentExactEvidenceReceiptSource() {
    const cdpFinal = cdpResolverFinalResolutionForOverlay();
    if (
      cdpFinal
      && cdpFinal.dongHoStatus === 'exact'
      && currentListingExactResolution(cdpFinal.dongHo).dongHoStatus === 'exact'
    ) return 'cdp';
    if (
      state.providerCandidatePresent
      && state.providerCandidateDisplay
      && state.providerOpenStatus === 'captured'
      && !state.providerCandidateRejectedReason
      && String(state.resolverOutcome || '').startsWith('captured:')
      && currentListingExactResolution(state.providerCandidateDisplay).dongHoStatus === 'exact'
    ) return 'provider';
    if (
      state.groupCandidatePresent
      && state.groupCandidateDisplay
      && !state.groupCandidateRejectedReason
      && String(state.resolverOutcome || '').startsWith('captured-group:')
      && currentListingExactResolution(state.groupCandidateDisplay).dongHoStatus === 'exact'
    ) return 'group';
    if (
      state.articlePresent
      && state.officialExactCandidatePresent
      && state.officialExactCandidateDisplay
      && state.resolverBranch === 'official-table'
      && state.resolverOutcome === 'official-table-exact'
      && currentListingExactResolution(state.officialExactCandidateDisplay).dongHoStatus === 'exact'
    ) return 'official';
    const confirmedLandLineSources = new Set([
      'land-line-after-group',
      'land-line-after-provider-floor',
      'land-line-after-provider-route-single',
      'land-line-direct-ho-corroborated',
      'building-units-article-linked'
    ]);
    const landLineDisplay = normalizeText(state.landLineCandidateDisplay || state.lineInferenceDisplay || '');
    if (
      state.landLineCandidatePresent
      && landLineDisplay
      && !state.landLineRejectedReason
      && state.landLineCandidateCertainty === 'LAND_LINE'
      && confirmedLandLineSources.has(state.landLineCandidateSource)
      && state.resolverOutcome === state.landLineCandidateSource
      && currentListingExactResolution(landLineDisplay).dongHoStatus === 'exact'
    ) return 'line';
    return '';
  }

  function clearConfirmedExactLatch(reason) {
    if (!state.confirmedExactMarker && !state.confirmedExactDisplay) return;
    state.confirmedExactMarker = '';
    state.confirmedExactDisplay = '';
    state.confirmedExactKind = '';
    state.confirmedExactAt = 0;
    state.confirmedExactClearedReason = String(reason || '');
  }

  function confirmedExactDisplayForSource(source) {
    if (source === 'cdp') {
      const cdpFinal = cdpResolverFinalResolutionForOverlay();
      return cdpFinal ? cdpFinal.dongHo : '';
    }
    if (source === 'provider') return state.providerCandidateDisplay;
    if (source === 'group') return state.groupCandidateDisplay;
    if (source === 'official') return state.officialExactCandidateDisplay;
    if (source === 'line') return state.landLineCandidateDisplay || state.lineInferenceDisplay;
    return '';
  }

  // General "confirm -> lock -> stop" latch: once a TRUSTED single exact is confirmed for the
  // active listing, remember it (keyed by articleMarker) so late/parallel signals cannot
  // re-expand the display back into multiple candidates. Reused by the overlay (single-value
  // display) and the live loop (sticky `done`). Cleared only when the listing changes.
  function updateConfirmedExactLatch() {
    const marker = normalizeText(state.articleMarker || '');
    if (state.confirmedExactMarker && state.confirmedExactMarker !== marker) {
      clearConfirmedExactLatch('marker-changed');
    }
    if (!marker) return;
    if (state.confirmedExactMarker === marker && state.confirmedExactDisplay) return;
    const groupKey = normalizeText(state.selectedListingGroupKey || '');
    const source = currentExactEvidenceReceiptSource();
    let display = '';
    let kind = source;
    if (source) {
      display = normalizeText(confirmedExactDisplayForSource(source) || '');
    } else if (groupKey) {
      // No own evidence yet — but a sibling of the same 동일매물 group already confirmed the unit.
      // Inherit it (validated below via currentListingExactResolution), so this child shows the
      // answer immediately instead of running its own slow/sometimes-failing provider search.
      const inheritedDisplay = GROUP_INHERIT.chooseInheritedExact(
        groupKey, groupExactCache, state.lineInferenceCandidateDisplays
      );
      if (inheritedDisplay) {
        display = inheritedDisplay;
        kind = 'group-inherited';
      }
    }
    if (!display) return;
    if (currentListingExactResolution(display).dongHoStatus !== 'exact') return;
    state.confirmedExactMarker = marker;
    state.confirmedExactDisplay = display;
    state.confirmedExactKind = kind;
    state.confirmedExactAt = autoLoopNowMs();
    // Seed the group cache from an OWN confirmation so later-opened siblings can inherit it.
    if (source && groupKey) {
      groupExactCache.set(groupKey, { display: display });
      if (groupExactCache.size > 50) {
        groupExactCache.delete(groupExactCache.keys().next().value);
      }
    }
  }

  function currentListingFloorForOverlay() {
    const kind = String(state.detailFloorKind || 'none');
    const value = Number(state.detailFloorValue || 0);
    const total = Number(state.detailTotalFloor || 0);
    if ((kind === 'exact' || kind === 'loose') && value > 0) {
      return `${value}${total > 0 ? `/${total}` : ''}`;
    }
    if (kind === 'band' && state.detailFloorBand) {
      const band = state.detailFloorBand === 'high' ? HIGH : (state.detailFloorBand === 'mid' ? MID : LOW);
      return `${band}${total > 0 ? `/${total}` : ''}`;
    }
    return '';
  }

  function currentListingEvidenceCollectedAt(resolution) {
    const api = dongHoPresentationApi();
    if (!api || typeof api.advanceEvidenceClock !== 'function') {
      state.currentListingEvidenceKey = '';
      state.currentListingEvidenceAt = '';
      return '';
    }
    const safe = resolution && typeof resolution === 'object' ? resolution : {};
    const status = normalizeText(safe.dongHoStatus);
    const key = [
      currentCdpTargetContextMarker() || state.articleMarker || '',
      state.detailDongToken,
      currentListingFloorForOverlay(),
      state.detailTypeToken,
      state.detailDirectionToken,
      status,
      safe.dongHo,
      safe.qualityRejectedReason
    ].map(normalizeText).join('|');
    const next = api.advanceEvidenceClock({
      key: state.currentListingEvidenceKey,
      collectedAt: state.currentListingEvidenceAt
    }, {
      key,
      status,
      nowMs: Date.now(),
      preferredAtMs: cdpResolverFinalMatchesCurrentContext() ? state.cdpResolverFinalAt : 0
    });
    state.currentListingEvidenceKey = next.key;
    state.currentListingEvidenceAt = next.collectedAt;
    return next.collectedAt;
  }

  function currentListingElapsedContextKey() {
    const articleMarker = state.articleMarker || currentCdpTargetContextMarker();
    if (articleMarker) {
      const runKey = state.cdpResolverFinalArticleMarker === articleMarker
        ? normalizeText(state.cdpResolverFinalRunKey)
        : '';
      return ['article', normalizeText(articleMarker), runKey].filter(Boolean).join('|');
    }
    const fallback = [
      state.detailDongToken,
      currentListingFloorForOverlay(),
      state.detailTypeToken,
      state.detailDirectionToken,
      state.dealType,
      state.priceToken
    ].map(normalizeText);
    return fallback.some(Boolean) ? fallback.join('|') : '';
  }

  function currentListingElapsedSeconds(resolution, collectedAt) {
    const status = normalizeText(resolution && resolution.dongHoStatus);
    const terminal = ['exact', 'multiple-candidates', 'unresolved', 'context-mismatch'].includes(status);
    const contextKey = terminal && collectedAt
      ? currentListingElapsedContextKey()
      : '';
    if (!contextKey) {
      state.currentListingElapsedKey = '';
      state.currentListingElapsedSec = 0;
      return Number(state.routeSearchElapsedSec || 0) || 0;
    }
    if (state.currentListingElapsedKey === contextKey) {
      return Number(state.currentListingElapsedSec || 0) || 0;
    }
    // Prefer the wall-clock investigation time (marker-appeared ≈ click → this terminal moment). This
    // is captured ONCE per contextKey (the cache below freezes it), so it reflects the true
    // click→done span the user perceives, not the resolver's internal FIN-lookup duration (~1s).
    const activeMarker = normalizeText(state.articleMarker || '');
    const wallElapsedMs = activeMarker
      && state.investigationClockMarker === activeMarker
      && Number(state.investigationStartedAtMs || 0) > 0
      ? Math.max(0, Date.now() - Number(state.investigationStartedAtMs || 0))
      : 0;
    const elapsedSec = wallElapsedMs > 0
      ? Math.max(1, Math.ceil(wallElapsedMs / 1000))
      : (cdpResolverFinalMatchesCurrentContext() && state.cdpResolverFinalDurationMs
        ? Math.max(1, Math.ceil(state.cdpResolverFinalDurationMs / 1000))
        : Math.max(1, Number(state.routeSearchElapsedSec || 0) || 0));
    state.currentListingElapsedKey = contextKey;
    state.currentListingElapsedSec = elapsedSec;
    return elapsedSec;
  }

  function currentListingOverlayRowForOverlay() {
    if (!selectedListingForRouteSearch()) return null;
    const listingText = selectedListingText();
    const listingDetailText = detailText();
    const text = normalizeText([listingDetailText, listingText].filter(Boolean).join(' '));
    const detailAreaHint = regionExportAreaHint(listingDetailText);
    const listingAreaHint = regionExportAreaHint(listingText);
    const resolution = currentListingDongHoResolutionForOverlay();
    const collectedAt = currentListingEvidenceCollectedAt(resolution);
    const row = {
      complexName: '',
      dong: state.detailDongToken || extractDongToken(text),
      floor: currentListingFloorForOverlay(),
      type: state.detailTypeToken || extractDetailTypeToken(text),
      dealType: state.dealType || extractDealType(text),
      priceHint: state.priceToken || extractPriceToken(text),
      areaHint: detailAreaHint || listingAreaHint,
      directionHint: state.detailDirectionToken || extractDirectionToken(text),
      featureText: regionExportFeatureText(text || listingText),
      dongHoStatus: resolution.dongHoStatus,
      dongHo: resolution.dongHo,
      qualityRejectedReason: resolution.qualityRejectedReason || '',
      qualityConfidence: resolution.qualityConfidence || '',
      candidateCount: regionExportCandidateCount(resolution),
      routeSearchStatus: state.routeSearchStatus || '',
      routeSearchElapsedSec: currentListingElapsedSeconds(resolution, collectedAt),
      collectedAt,
      text
    };
    const cleaned = stripRegionExportRow(row);
    return Object.assign({}, cleaned, {
      // Suppress the baked live-ticking 걸린시간 for the current-listing overlay; overlay-view adds it
      // (frozen) only once a confirmed exact is latched, so the processing overlay stays static.
      excelRows: regionExportSimpleRowsForOverlay(cleaned, { suppressElapsed: true })
    });
  }

  function fallbackRegionExportClick(target) {
    if (!target) return false;
    if (typeof target.click === 'function') {
      target.click();
      return true;
    }
    if (typeof target.dispatchEvent === 'function') {
      return target.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      }));
    }
    return false;
  }

  function dispatchRegionExportTrustedClick(target, scanReason, expectedRunId) {
    return new Promise((resolve) => {
      if (expectedRunId && expectedRunId !== regionExportRunId) {
        resolve(false);
        return;
      }
      if (!target) {
        resolve(false);
        return;
      }
      if (isBlockedListingNavigationTarget(target)) {
        resolve(false);
        return;
      }
      scrollProviderTargetIntoView(target);
      const point = providerClickPoint(target);
      if (!point) {
        const clicked = fallbackRegionExportClick(target);
        if (clicked) scheduleScan(scanReason || 'region-export-click');
        resolve(clicked);
        return;
      }
      // Let the extraction's own coordinate click pass through the shield, then restore the block.
      const restoreShield = beginRegionExportShieldClickThrough();
      safeRuntimeSendMessage({
        source: BRIDGE_SOURCE,
        type: 'DISPATCH_PROVIDER_CLICK',
        version: VERSION,
        x: point.x,
        y: point.y,
        returnFocusDelayMs: 250
      }, (response) => {
        restoreShield();
        if (expectedRunId && expectedRunId !== regionExportRunId) {
          resolve(false);
          return;
        }
        if (response && response.ok) {
          scheduleScan(scanReason || 'region-export-trusted-click');
          resolve(true);
          return;
        }
        const clicked = fallbackRegionExportClick(target);
        if (clicked) scheduleScan(scanReason || 'region-export-click-fallback');
        resolve(clicked);
      });
    });
  }

  function currentRegionLiveListingRow(row) {
    const input = row && typeof row === 'object' ? row : {};
    if (
      input.parentListingKey
      && input._root && input._root.isConnected
      && input._clickTarget && input._clickTarget.isConnected
      && isVisibleNode(input._clickTarget)
    ) return input;
    const currentRows = collectCurrentRegionListingRows();
    const articleNo = String(input.articleNo || '');
    if (articleNo) {
      const articleMatches = currentRows.filter((candidate) => String(candidate.articleNo || '') === articleNo);
      if (articleMatches.length === 1) return articleMatches[0];
      const childLinks = Array.from(document.querySelectorAll('.item--child a.item_link'))
        .filter(isVisibleNode)
        .filter((link) => articleNoFromListingElement(link) === articleNo);
      if (childLinks.length === 1) {
        const link = childLinks[0];
        const root = rootForListingLink(link) || link;
        return Object.assign({}, input, { _root: root, _clickTarget: link });
      }
    }
    const key = String(input.key || '');
    if (key) {
      const keyMatches = currentRows.filter((candidate) => String(candidate.key || '') === key);
      if (keyMatches.length === 1) return keyMatches[0];
    }
    const identity = regionExportListingPublicIdentity(input);
    if (!identity || identity === '|||||') return null;
    const identityMatches = currentRows.filter((candidate) => regionExportListingPublicIdentity(candidate) === identity);
    if (identityMatches.length === 1) return identityMatches[0];
    return null;
  }

  function regionExportListingClickState(row, target) {
    const input = row && typeof row === 'object' ? row : {};
    const root = input._root;
    const expectedArticleMarker = input.articleNo ? hashMarker(input.articleNo) : '';
    const childCount = childListingRootsForParent(root).filter(isVisibleNode).length;
    return {
      articleMarker: articleMarkerFromUrl(),
      expectedArticleMarker,
      expanded: Boolean(target && target.getAttribute && target.getAttribute('aria-expanded') === 'true'),
      childCount
    };
  }

  function regionExportListingClickAdvanced(beforeInput, afterInput) {
    const before = beforeInput && typeof beforeInput === 'object' ? beforeInput : {};
    const after = afterInput && typeof afterInput === 'object' ? afterInput : {};
    if (
      after.expectedArticleMarker
      && after.articleMarker === after.expectedArticleMarker
      && before.articleMarker !== after.articleMarker
    ) return true;
    if (!after.expectedArticleMarker && after.articleMarker && after.articleMarker !== before.articleMarker) return true;
    if (!before.expanded && after.expanded) return true;
    return Number(after.childCount || 0) > Number(before.childCount || 0);
  }

  async function waitForRegionExportListingClickAdvance(row, target, before, runId) {
    const startedAt = Date.now();
    while ((Date.now() - startedAt) < 600) {
      if (runId !== regionExportRunId) return false;
      const after = regionExportListingClickState(row, target);
      if (regionExportListingClickAdvanced(before, after)) return true;
      await delayMs(80);
    }
    return false;
  }

  async function clickRegionExportListingRow(row, runId) {
    if (runId !== regionExportRunId) return false;
    const liveRow = currentRegionLiveListingRow(row);
    const root = liveRow && liveRow._root;
    if (!root) return false;
    const target = liveRow && liveRow._clickTarget && isVisibleNode(liveRow._clickTarget)
      ? liveRow._clickTarget
      : root.matches && root.matches('a.item_link, button, [role="button"]')
      ? root
      : (root.querySelector && root.querySelector('a.item_link, button, [role="button"]') || root);
    if (!target || typeof target.click !== 'function') return false;
    if (typeof root.scrollIntoView === 'function' && isVisibleNode(root)) {
      root.scrollIntoView({ block: 'center', inline: 'nearest' });
    } else if (typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ block: 'center', inline: 'nearest' });
    }
    const before = regionExportListingClickState(liveRow, target);
    rememberClickedListingRoot(target);
    const trustedClicked = await dispatchRegionExportTrustedClick(target, 'region-export-row', runId);
    if (runId !== regionExportRunId) return false;
    const trustedAdvanced = trustedClicked
      ? await waitForRegionExportListingClickAdvance(liveRow, target, before, runId)
      : false;
    if (trustedAdvanced) return true;
    const fallbackClicked = fallbackRegionExportClick(target);
    if (!fallbackClicked) return false;
    scheduleScan('region-export-row-fallback');
    return waitForRegionExportListingClickAdvance(liveRow, target, before, runId);
  }

  function regionExportStrongLookupPending() {
    return state.providerDirectLookupStatus === 'running';
  }

  function regionExportConcreteCandidateSnapshot(resolution) {
    const safe = resolution && typeof resolution === 'object' ? resolution : {};
    if (safe.dongHoStatus !== 'multiple-candidates' || !safe.dongHo) return null;
    const presentation = regionExportPresentation(safe);
    if (presentation.status !== 'multiple-candidates' || presentation.candidateCount < 1) return null;
    return Object.assign({}, safe, { candidateCount: presentation.candidateCount });
  }

  function regionExportCandidateFingerprint(resolution) {
    const candidate = regionExportConcreteCandidateSnapshot(resolution);
    if (!candidate) return '';
    const presentation = regionExportPresentation(candidate);
    if (presentation.status !== 'multiple-candidates' || presentation.hasEvidence !== true) return '';
    const api = dongHoPresentationApi();
    if (!api || typeof api.presentationFingerprint !== 'function') return '';
    const fingerprint = api.presentationFingerprint(presentation);
    return /^presentation:[a-f0-9]{8}$/.test(fingerprint) ? fingerprint : '';
  }

  function regionExportCandidateCompletionDecision(resolution, stableMs) {
    const candidate = regionExportConcreteCandidateSnapshot(resolution);
    const api = window.DHS_LIVE_LOOP;
    if (!candidate || !api || typeof api.candidateSearchSettled !== 'function') {
      state.regionExportCandidatePendingReasons = Object.freeze([]);
      state.regionExportCandidateSettled = false;
      state.regionExportCandidateCompletionReason = 'candidate-incomplete';
      return { complete: false, reason: 'candidate-incomplete', pendingReasons: [] };
    }
    const presentation = regionExportPresentation(candidate);
    const settlementInput = {
      candidateComplete: presentation.status === 'multiple-candidates' && presentation.hasEvidence === true,
      candidateHasEvidence: presentation.hasEvidence === true,
      autoLoopStatus: state.autoLoopStatus,
      autoLoopAction: state.autoLoopAction,
      providerDirectLookupStatus: state.providerDirectLookupStatus,
      providerRouteLookupRunning,
      providerRouteLookupPendingCount: providerRouteLookupPendingRows.length,
      groupRouteStatus: state.groupRouteStatus,
      groupRouteFetchPending: activeGroupRouteFetchCount > 0,
      providerEvidenceTempPendingActive: state.providerEvidenceTempPendingActive,
      providerRequestKey: state.providerRequestKey,
      providerOpenStatus: state.providerOpenStatus,
      autoLoopTimerActive: Boolean(autoLoopTimer),
      lineMapRecoveryPending
    };
    const pendingReasons = typeof api.candidateSearchPendingReasons === 'function'
      ? api.candidateSearchPendingReasons(settlementInput)
      : [];
    const safePendingReasons = (Array.isArray(pendingReasons) ? pendingReasons : [])
      .map((value) => String(value || ''))
      .filter((value) => REGION_EXPORT_CANDIDATE_BLOCKERS.includes(value))
      .slice(0, REGION_EXPORT_CANDIDATE_BLOCKERS.length);
    const fallbackSettled = api.candidateSearchSettled(settlementInput) && safePendingReasons.length === 0;
    const rawDecision = typeof api.candidateCompletionDecision === 'function'
      ? api.candidateCompletionDecision(Object.assign({}, settlementInput, {
        stableMs: Math.max(0, Number(stableMs || 0) || 0),
        minStableMs: REGION_EXPORT_CANDIDATE_STABLE_MS,
        followupBudgetMs: REGION_EXPORT_CANDIDATE_FOLLOWUP_MS
      }))
      : {
        complete: fallbackSettled,
        reason: fallbackSettled ? 'settled' : 'strong-proof-pending',
        pendingReasons: safePendingReasons
      };
    const completionReason = REGION_EXPORT_COMPLETION_REASONS.includes(String(rawDecision && rawDecision.reason || ''))
      ? String(rawDecision.reason)
      : 'strong-proof-pending';
    const complete = rawDecision && rawDecision.complete === true;
    state.regionExportCandidatePendingReasons = Object.freeze(safePendingReasons.slice());
    state.regionExportCandidateSettled = complete;
    state.regionExportCandidateCompletionReason = completionReason;
    return {
      complete,
      reason: completionReason,
      pendingReasons: Object.freeze(safePendingReasons.slice())
    };
  }

  function expireRegionExportCandidateFollowups() {
    const marker = activeProviderArticleMarker();
    providerRequestGeneration += 1;
    providerRouteLookupRunning = false;
    providerRouteLookupPendingRows.length = 0;
    providerRouteLookupPendingKeys.clear();
    state.providerRouteLookupBatchStatus = 'candidate-budget-exhausted';
    if (autoLoopTimer) {
      window.clearTimeout(autoLoopTimer);
      autoLoopTimer = 0;
    }
    resetProviderEvidenceTemp();
    resetProviderCandidate('unverified', 'candidate-followup-budget');
    resetDirectLookupStatus('candidate-budget-exhausted');
    state.autoLoopStatus = 'exhausted';
    state.autoLoopAction = 'record-no-result';
    state.autoLoopReason = 'candidate-followup-budget';
    if (marker) clearProviderCandidate(marker);
  }

  async function waitForRegionExportResolution(row, runId) {
    const started = Date.now();
    state.regionExportCandidatePendingReasons = Object.freeze([]);
    state.regionExportCandidateSettled = false;
    state.regionExportCandidateCompletionReason = 'idle';
    let snapshot = currentResolverExportSnapshot(row);
    let currentCandidateSnapshot = regionExportConcreteCandidateSnapshot(snapshot);
    let bestCandidateSnapshot = currentCandidateSnapshot;
    let stableCandidateFingerprint = regionExportCandidateFingerprint(currentCandidateSnapshot);
    let stableCandidateSince = stableCandidateFingerprint ? started : 0;
    while ((Date.now() - started) < REGION_EXPORT_ROW_TIMEOUT_MS) {
      if (runId !== regionExportRunId) {
        return Object.assign({}, snapshot, { dongHoStatus: 'cancelled', dongHo: '', dongHoHash: '' });
      }
      safeBridgeTask(scanPage);
      renderOverlay();
      await delayMs(REGION_EXPORT_ROW_SETTLE_MS);
      snapshot = currentResolverExportSnapshot(row);
      currentCandidateSnapshot = regionExportConcreteCandidateSnapshot(snapshot);
      bestCandidateSnapshot = currentCandidateSnapshot || bestCandidateSnapshot;
      if (snapshot.dongHoStatus === 'exact' && snapshot.dongHo) {
        state.regionExportCandidatePendingReasons = Object.freeze([]);
        state.regionExportCandidateSettled = true;
        state.regionExportCandidateCompletionReason = 'exact';
        return Object.assign({}, snapshot, {
          dongHoHash: await safeExactDisplayHashAsync(snapshot.dongHo)
        });
      }
      const currentCandidateFingerprint = regionExportCandidateFingerprint(currentCandidateSnapshot);
      if (!currentCandidateFingerprint) {
        stableCandidateFingerprint = '';
        stableCandidateSince = 0;
      } else if (currentCandidateFingerprint !== stableCandidateFingerprint) {
        stableCandidateFingerprint = currentCandidateFingerprint;
        stableCandidateSince = Date.now();
      }
      const currentCandidateStableMs = stableCandidateSince > 0
        ? Math.max(0, Date.now() - stableCandidateSince)
        : 0;
      const completionDecision = currentCandidateFingerprint
        && currentCandidateStableMs >= REGION_EXPORT_CANDIDATE_STABLE_MS
        ? regionExportCandidateCompletionDecision(currentCandidateSnapshot, currentCandidateStableMs)
        : { complete: false, reason: 'candidate-incomplete', pendingReasons: [] };
      if (completionDecision.complete) {
        if (completionDecision.reason === 'followup-budget-exhausted') {
          expireRegionExportCandidateFollowups();
        }
        state.regionExportCandidateEarlyExitCount = Math.min(
          9999,
          Number(state.regionExportCandidateEarlyExitCount || 0) + 1
        );
        return Object.assign({}, currentCandidateSnapshot, {
          dongHoStatus: 'multiple-candidates',
          dongHoHash: ''
        });
      }
    }
    const graceStarted = Date.now();
    while (regionExportStrongLookupPending() && (Date.now() - graceStarted) < REGION_EXPORT_ROW_STRONG_LOOKUP_GRACE_MS) {
      if (runId !== regionExportRunId) {
        return Object.assign({}, snapshot, { dongHoStatus: 'cancelled', dongHo: '', dongHoHash: '' });
      }
      safeBridgeTask(scanPage);
      renderOverlay();
      await delayMs(250);
      snapshot = currentResolverExportSnapshot(row);
      bestCandidateSnapshot = regionExportConcreteCandidateSnapshot(snapshot) || bestCandidateSnapshot;
      if (snapshot.dongHoStatus === 'exact' && snapshot.dongHo) {
        state.regionExportCandidatePendingReasons = Object.freeze([]);
        state.regionExportCandidateSettled = true;
        state.regionExportCandidateCompletionReason = 'exact';
        return Object.assign({}, snapshot, {
          dongHoHash: await safeExactDisplayHashAsync(snapshot.dongHo)
        });
      }
    }
    const candidateSnapshot = regionExportConcreteCandidateSnapshot(snapshot) || bestCandidateSnapshot;
    state.regionExportCandidateCompletionReason = 'timeout';
    if (candidateSnapshot) {
      return Object.assign({}, candidateSnapshot, {
        dongHoStatus: 'multiple-candidates',
        dongHoHash: ''
      });
    }
    const unresolvedDongHo = snapshot.dongHo || REGION_EXPORT_UNRESOLVED_LABEL;
    return Object.assign({}, snapshot, {
      dongHoStatus: 'timeout',
      dongHo: unresolvedDongHo,
      dongHoHash: ''
    });
  }

  function collectRegionExportChildRows(parentRow) {
    const parent = currentRegionLiveListingRow(parentRow) || parentRow || {};
    const root = parent._root;
    if (!root || !root.querySelectorAll) return [];
    const links = Array.from(root.querySelectorAll(
      '.item--child .item_inner:not(.is-loading) a.item_link, .item--child a.item_link'
    ))
      .filter(isVisibleNode);
    const rows = [];
    links.forEach((link) => {
      const childInner = link.closest('.item_inner:not(.is-loading)');
      const childRoot = childInner && childInner.closest('.item--child')
        ? childInner
        : (link.closest('.item--child') || link);
      const row = groupedListingSelectionRow(childRoot, parent);
      const providerScopeText = normalizeText(elementText(childRoot));
      if (!row || isAssociationProviderListingText(row.text + ' ' + providerScopeText)) return;
      rows.push({ ...row, _clickTarget: link, parentListingKey: parent.key || '' });
    });
    return rows;
  }

  async function ensureRegionExportGroupedChildRows(parentRow, runId) {
    let rows = collectRegionExportChildRows(parentRow);
    if (rows.length || runId !== regionExportRunId) return rows;
    if (!await clickRegionExportListingRow(parentRow, runId)) return [];
    const startedAt = Date.now();
    while (runId === regionExportRunId && (Date.now() - startedAt) < 1200) {
      rows = collectRegionExportChildRows(parentRow);
      if (rows.length) return rows;
      await delayMs(80);
    }
    return [];
  }

  function groupedListingReducerApi() {
    return window.DHS_GROUPED_LISTING || {};
  }

  function normalizeRegionExportRetryExactProof(value) {
    const input = value && typeof value === 'object' ? value : {};
    const listingMarker = /^listing:[0-9a-f]{8,64}$/i.test(String(input.listingMarker || ''))
      ? String(input.listingMarker).toLowerCase()
      : '';
    const expectedDongHoHash = /^[0-9a-f]{10,64}$/i.test(String(input.expectedDongHoHash || ''))
      ? String(input.expectedDongHoHash).toLowerCase()
      : '';
    const groupChildHint = /^child:[0-9a-f]{16}$/i.test(String(input.groupChildHint || ''))
      ? String(input.groupChildHint).toLowerCase()
      : '';
    return { listingMarker, expectedDongHoHash, groupChildHint };
  }

  function regionExportGroupChildRetryHint(listingMarker, childRow) {
    const api = groupedListingReducerApi();
    if (typeof api.groupedChildRetryHint !== 'function') return '';
    return api.groupedChildRetryHint(listingMarker, childRow);
  }

  function prioritizeRegionExportRetryChildren(childRows, retryProof) {
    const rows = Array.isArray(childRows) ? childRows.slice() : [];
    const proof = normalizeRegionExportRetryExactProof(retryProof);
    if (!proof.groupChildHint) return { rows, matched: false, reason: 'none' };
    const api = groupedListingReducerApi();
    if (typeof api.prioritizeGroupedChildRetry !== 'function') {
      return { rows, matched: false, reason: 'module-missing' };
    }
    return api.prioritizeGroupedChildRetry(rows, proof.listingMarker, proof.groupChildHint);
  }

  async function rebindRegionExportGroupedChildRow(parentRow, childRow, listingMarker, runId) {
    if (runId !== regionExportRunId) return null;
    const groupChildHint = regionExportGroupChildRetryHint(listingMarker, childRow);
    if (!groupChildHint) return null;
    const findUnique = (rows) => {
      const match = prioritizeRegionExportRetryChildren(rows, { listingMarker, groupChildHint });
      return match.matched ? match.rows[0] : null;
    };
    const current = findUnique(collectRegionExportChildRows(parentRow));
    if (current) return current;
    const refreshed = await ensureRegionExportGroupedChildRows(parentRow, runId);
    if (runId !== regionExportRunId) return null;
    return findUnique(refreshed);
  }

  async function regionExportRetryExactDecision(resolution, retryProof) {
    if (!regionExportResolutionIsExact(resolution)) {
      return { matched: false, reason: 'not-exact', resolution };
    }
    const proof = normalizeRegionExportRetryExactProof(retryProof);
    if (!proof.expectedDongHoHash) {
      return { matched: true, reason: 'first-observation', resolution };
    }
    const observedHash = await safeRegionExactHashAsync(resolution.dongHo, proof.listingMarker);
    if (observedHash && observedHash === proof.expectedDongHoHash) {
      return {
        matched: true,
        reason: 'matched',
        resolution: Object.assign({}, resolution, { dongHoHash: observedHash })
      };
    }
    return { matched: false, reason: observedHash ? 'hash-mismatch' : 'hash-unavailable', resolution };
  }

  function plannedGroupedChildRows(parentRow, childRows) {
    const api = groupedListingReducerApi();
    if (typeof api.planGroupedListingChildren !== 'function' || typeof api.canonicalGroupedListing !== 'function') {
      return { rows: [], reason: 'module-missing', audit: {} };
    }
    const candidates = (Array.isArray(childRows) ? childRows : [])
      .map((row) => ({ canonical: api.canonicalGroupedListing(row), row }))
      .filter((item) => item.canonical.id)
      .sort((left, right) => (
        left.canonical.id.localeCompare(right.canonical.id) ||
        JSON.stringify(left.canonical).localeCompare(JSON.stringify(right.canonical))
      ));
    const byId = new Map();
    candidates.forEach((item) => {
      if (!byId.has(item.canonical.id)) byId.set(item.canonical.id, item.row);
    });
    const reportedCount = Number(parentRow?.groupedBrokerCount || parentRow?.childExpectedCount || 0) || 0;
    const expectedChildCount = Math.max(reportedCount > 1 ? reportedCount : 0, byId.size);
    const plan = api.planGroupedListingChildren(parentRow, childRows, {
      expectedCount: Math.max(1, expectedChildCount),
      summaryParent: true
    });
    return {
      rows: plan.ranked
      .map((item) => ({ ...item, row: byId.get(item.id) }))
        .filter((item) => item.row),
      reason: plan.reason || '',
      expectedCount: Number(plan.expectedCount || expectedChildCount) || expectedChildCount,
      expectedChildCount: Number(plan.expectedCount || expectedChildCount) || expectedChildCount,
      observedCount: byId.size,
      audit: plan.audit || {}
    };
  }

  function plannedGroupedResolutionAttempts(childRows, options) {
    const api = groupedListingReducerApi();
    if (typeof api.planGroupedListingResolutionAttempts !== 'function') {
      const rows = Array.isArray(childRows) ? childRows.slice() : [];
      return { rows, originalCount: rows.length, skippedEquivalentCount: 0 };
    }
    return api.planGroupedListingResolutionAttempts(childRows, options);
  }

  function rankedRegionExportChildRows(parentRow, childRows) {
    return plannedGroupedChildRows(parentRow, childRows);
  }

  function groupedChildResolution(resolutions) {
    const api = groupedListingReducerApi();
    if (typeof api.mergeGroupedChildResolutions !== 'function') {
      return {
        dongHoStatus: 'unresolved',
        dongHo: REGION_EXPORT_UNRESOLVED_LABEL,
        dongHoSource: 'group-child-module-missing',
        dongHoHash: '',
        qualityRejectedReason: 'group-child-module-missing'
      };
    }
    return api.mergeGroupedChildResolutions(resolutions);
  }

  function groupedChildCoverageResolution(resolution, coverage) {
    const api = groupedListingReducerApi();
    if (typeof api.withGroupedChildCoverage === 'function') {
      return api.withGroupedChildCoverage(resolution, coverage);
    }
    const safe = resolution && typeof resolution === 'object' ? resolution : {};
    const candidate = safe.dongHoStatus === 'multiple-candidates' && safe.dongHo;
    return Object.assign({}, safe, {
      candidateComplete: candidate ? false : safe.candidateComplete,
      groupChildExpectedCount: Math.max(0, Number(coverage && coverage.expectedCount || 0) || 0),
      groupChildPlannedCount: Math.max(0, Number(coverage && coverage.plannedCount || 0) || 0),
      groupChildResolvedCount: Math.max(0, Number(coverage && coverage.resolvedCount || 0) || 0),
      groupChildComplete: false,
      groupChildObservedCount: Math.max(0, Number(coverage && coverage.observedCount || 0) || 0),
      groupChildPlanReason: String(coverage && coverage.planReason || 'module-missing').replace(/[^a-z-]/g, '').slice(0, 48),
      qualityRejectedReason: safe.qualityRejectedReason || 'group-child-module-missing'
    });
  }

  async function resolveRegionExportListingRow(row, runId, retryProofInput) {
    if (runId !== regionExportRunId) {
      return { dongHoStatus: 'cancelled', dongHo: '', dongHoSource: '', dongHoHash: '' };
    }
    const retryProof = normalizeRegionExportRetryExactProof(retryProofInput);
    if (row.isGroupedListing) {
      state.regionExportGroupedParentResolutionMs = 0;
      state.regionExportGroupedChildAttemptCount = 0;
      state.regionExportGroupedChildClickCount = 0;
      state.regionExportGroupedChildSkippedEquivalentCount = 0;
      state.regionExportGroupedChildRebindMissCount = 0;
      state.regionExportGroupedChildExactAttemptIndex = 0;
      state.regionExportGroupedChildResolutionMs = 0;
    }
    const initialChildPlan = row.isGroupedListing
      ? rankedRegionExportChildRows(row, collectRegionExportChildRows(row))
      : { rows: [], reason: '', expectedCount: 0, expectedChildCount: 0, observedCount: 0 };
    if (!await clickRegionExportListingRow(row, runId)) {
      return {
        dongHoStatus: 'click-missing',
        dongHo: REGION_EXPORT_UNRESOLVED_LABEL,
        dongHoSource: '',
        dongHoHash: ''
      };
    }
    const parentResolutionStartedAt = Date.now();
    let parentResolution = await waitForRegionExportResolution(row, runId);
    if (row.isGroupedListing) {
      state.regionExportGroupedParentResolutionMs = Math.min(
        60 * 60 * 1000,
        Math.max(0, Date.now() - parentResolutionStartedAt)
      );
    }
    if (runId !== regionExportRunId || parentResolution.dongHoStatus === 'cancelled') return parentResolution;
    const parentRetryDecision = await regionExportRetryExactDecision(parentResolution, retryProof);
    const parentIdentity = row.isGroupedListing
      ? regionExportGroupedParentIdentityMetadata(parentResolution)
      : {};
    if (regionExportResolutionIsExact(parentResolution) && parentRetryDecision.matched) {
      return Object.assign({}, parentResolution, parentIdentity);
    }
    if (!row.isGroupedListing) return parentResolution;
    let childPlan = initialChildPlan;
    const currentChildRows = await ensureRegionExportGroupedChildRows(row, runId);
    if (runId !== regionExportRunId) {
      return { dongHoStatus: 'cancelled', dongHo: '', dongHoSource: '', dongHoHash: '' };
    }
    if (currentChildRows.length) {
      childPlan = rankedRegionExportChildRows(row, currentChildRows);
    }
    const prioritizedChildren = prioritizeRegionExportRetryChildren(childPlan.rows, retryProof);
    if (retryProof.groupChildHint) {
      state.regionExportGroupedRetryHintAttemptCount = Math.min(
        9999,
        Number(state.regionExportGroupedRetryHintAttemptCount || 0) + 1
      );
      if (prioritizedChildren.matched) {
        state.regionExportGroupedRetryHintMatchCount = Math.min(
          9999,
          Number(state.regionExportGroupedRetryHintMatchCount || 0) + 1
        );
      }
    }
    const resolutionAttempts = plannedGroupedResolutionAttempts(prioritizedChildren.rows, {
      preferredId: prioritizedChildren.matched
        ? String(prioritizedChildren.rows[0]?.id || '')
        : ''
    });
    const rankedChildren = resolutionAttempts.rows;
    const plannedChildCount = Math.max(
      rankedChildren.length,
      Number(resolutionAttempts.originalCount || prioritizedChildren.rows.length || 0) || 0
    );
    state.regionExportGroupedChildSkippedEquivalentCount = Math.max(
      0,
      Number(resolutionAttempts.skippedEquivalentCount || 0) || 0
    );
    state.regionExportGroupedChildSkippedEquivalentTotal = Math.min(
      999999,
      Number(state.regionExportGroupedChildSkippedEquivalentTotal || 0)
        + state.regionExportGroupedChildSkippedEquivalentCount
    );
    const expectedChildCount = Math.max(0, Number(childPlan.expectedChildCount || childPlan.expectedCount || 0));
    if (!rankedChildren.length) {
      const keepCandidates = parentResolution.dongHoStatus === 'multiple-candidates' && parentResolution.dongHo;
      const unresolved = Object.assign({}, parentResolution, {
        dongHoStatus: keepCandidates ? 'multiple-candidates' : 'group-child-unresolved',
        dongHo: parentResolution.dongHo || REGION_EXPORT_UNRESOLVED_LABEL,
        dongHoHash: '',
        qualityRejectedReason: parentResolution.qualityRejectedReason || `group-child-${childPlan.reason || 'missing'}`
      });
      return groupedChildCoverageResolution(unresolved, {
        expectedCount: expectedChildCount,
        plannedCount: 0,
        resolvedCount: 0,
        observedCount: childPlan.observedCount,
        planReason: childPlan.reason || 'missing'
      });
    }
    const collected = [];
    let coveredChildCount = 0;
    for (let offset = 0; offset < rankedChildren.length;) {
      const score = rankedChildren[offset].score;
      const scoreGroup = [];
      while (offset < rankedChildren.length && rankedChildren[offset].score === score) {
        scoreGroup.push(rankedChildren[offset]);
        offset += 1;
      }
      const scoreResolutions = [];
      for (const item of scoreGroup) {
        if (runId !== regionExportRunId) break;
        state.regionExportGroupedChildAttemptCount = Math.min(
          999,
          Number(state.regionExportGroupedChildAttemptCount || 0) + 1
        );
        state.regionExportGroupedChildAttemptTotal = Math.min(
          999999,
          Number(state.regionExportGroupedChildAttemptTotal || 0) + 1
        );
        const childAttemptIndex = state.regionExportGroupedChildAttemptCount;
        const liveChild = await rebindRegionExportGroupedChildRow(
          row,
          item.row,
          retryProof.listingMarker,
          runId
        );
        if (!liveChild) {
          state.regionExportGroupedChildRebindMissCount = Math.min(
            999,
            Number(state.regionExportGroupedChildRebindMissCount || 0) + 1
          );
          continue;
        }
        if (!await clickRegionExportListingRow(liveChild, runId)) continue;
        state.regionExportGroupedChildClickCount = Math.min(
          999,
          Number(state.regionExportGroupedChildClickCount || 0) + 1
        );
        state.regionExportGroupedChildClickTotal = Math.min(
          999999,
          Number(state.regionExportGroupedChildClickTotal || 0) + 1
        );
        const childResolutionStartedAt = Date.now();
        const childResolution = Object.assign(
          {},
          await waitForRegionExportResolution(liveChild, runId),
          { groupChildRetryHint: regionExportGroupChildRetryHint(retryProof.listingMarker, liveChild) }
        );
        state.regionExportGroupedChildResolutionMs = Math.min(
          60 * 60 * 1000,
          Number(state.regionExportGroupedChildResolutionMs || 0)
            + Math.max(0, Date.now() - childResolutionStartedAt)
        );
        if (
          !state.regionExportGroupedChildExactAttemptIndex
          && regionExportResolutionIsExact(childResolution)
        ) {
          state.regionExportGroupedChildExactAttemptIndex = childAttemptIndex;
        }
        const childRetryDecision = await regionExportRetryExactDecision(childResolution, retryProof);
        if (childRetryDecision.matched) {
          if (
            retryProof.groupChildHint
            && childResolution.groupChildRetryHint === retryProof.groupChildHint
          ) {
            state.regionExportGroupedRetryHintExactCount = Math.min(
              9999,
              Number(state.regionExportGroupedRetryHintExactCount || 0) + 1
            );
          }
          return Object.assign({}, childResolution, parentIdentity, {
            dongHoSource: childResolution.dongHoSource
              ? `${childResolution.dongHoSource};group-child`
              : 'group-child'
          });
        }
        scoreResolutions.push(childResolution);
        collected.push(childResolution);
        coveredChildCount += Math.max(1, Number(item.equivalentCount || 1) || 1);
        await delayMs(80);
      }
      if (runId !== regionExportRunId) return { dongHoStatus: 'cancelled', dongHo: '', dongHoSource: '', dongHoHash: '' };
      const mergedScore = groupedChildResolution(scoreResolutions);
      const retryDecision = await regionExportRetryExactDecision(mergedScore, retryProof);
      if (retryDecision.matched) {
        if (
          retryProof.groupChildHint
          && mergedScore.groupChildRetryHint === retryProof.groupChildHint
        ) {
          state.regionExportGroupedRetryHintExactCount = Math.min(
            9999,
            Number(state.regionExportGroupedRetryHintExactCount || 0) + 1
          );
        }
        return Object.assign({}, mergedScore, parentIdentity, {
          dongHoSource: mergedScore.dongHoSource
            ? `${mergedScore.dongHoSource};group-child`
            : 'group-child'
        });
      }
    }
    if (rankedChildren.length) {
      const fallbackResolution = groupedChildResolution(collected);
      const candidateResolution = fallbackResolution.dongHoStatus === 'multiple-candidates' && fallbackResolution.dongHo
        ? fallbackResolution
        : (parentResolution.dongHoStatus === 'multiple-candidates' && parentResolution.dongHo
            ? parentResolution
            : fallbackResolution);
      const coveredResolution = groupedChildCoverageResolution(candidateResolution, {
        expectedCount: expectedChildCount,
        plannedCount: plannedChildCount,
        resolvedCount: coveredChildCount,
        observedCount: childPlan.observedCount,
        planReason: childPlan.reason
      });
      return Object.assign({}, coveredResolution, parentIdentity, {
        dongHoStatus: coveredResolution.dongHoStatus === 'cancelled'
          ? 'cancelled'
          : (coveredResolution.dongHoStatus === 'multiple-candidates' ? 'multiple-candidates' : 'group-child-unresolved'),
        dongHo: coveredResolution.dongHo || REGION_EXPORT_UNRESOLVED_LABEL,
        dongHoHash: coveredResolution.dongHoStatus === 'exact' ? coveredResolution.dongHoHash || '' : '',
        qualityRejectedReason: coveredResolution.qualityRejectedReason || (childPlan.reason ? `group-child-${childPlan.reason}` : '')
      });
    }
    return parentResolution;
  }

  function regionExportReusedCheckpointRow(row, checkpointRow, scopeInput, rowIndex) {
    const scope = normalizeRegionExportScope(scopeInput);
    const saved = stripRegionExportRow(checkpointRow);
    return Object.assign({}, row, {
      listingMarker: saved.listingMarker,
      complexName: scope.name,
      complexListingCount: scope.listingCount,
      rowIndex,
      floorViewText: regionExportFloorViewFeature(row) || saved.floorViewText,
      moveInText: regionExportMoveFeature(row) || saved.moveInText,
      optionText: regionExportOption(row) || saved.optionText,
      listingFeatureText: regionExportListingFeature(row) || saved.listingFeatureText,
      dongHoStatus: saved.dongHoStatus,
      dongHo: saved.dongHo,
      candidateCount: saved.candidateCount,
      qualityRejectedReason: saved.qualityRejectedReason,
      qualityConfidence: saved.qualityConfidence,
      routeSearchStatus: saved.routeSearchStatus,
      routeSearchElapsedSec: saved.routeSearchElapsedSec,
      dongHoSource: saved.dongHoSource,
      dongHoHash: saved.dongHoHash,
      resolverBranch: saved.resolverBranch,
      resolverOutcome: saved.resolverOutcome,
      listingContextContractVersion: saved.listingContextContractVersion,
      listingContextMatched: saved.listingContextMatched,
      listingContextFingerprint: saved.listingContextFingerprint,
      listingContextExpectedFingerprint: saved.listingContextExpectedFingerprint,
      collectedAt: saved.collectedAt
    });
  }

  function regionExportResolutionIdentityMetadata(previousResolution, currentResolution) {
    const previous = previousResolution && typeof previousResolution === 'object' ? previousResolution : {};
    const current = currentResolution && typeof currentResolution === 'object' ? currentResolution : {};
    const source = Number(current.listingContextContractVersion || 0) >= 1 ? current : previous;
    if (Number(source.listingContextContractVersion || 0) < 1) return {};
    return {
      listingContextContractVersion: 1,
      listingContextMatched: source.listingContextMatched === true,
      listingContextFingerprint: source.listingContextFingerprint || '',
      listingContextExpectedFingerprint: source.listingContextExpectedFingerprint || '',
      listingContextMismatchFields: Array.isArray(source.listingContextMismatchFields)
        ? source.listingContextMismatchFields.slice()
        : []
    };
  }

  function regionExportGroupedParentIdentityMetadata(resolution) {
    const identity = regionExportResolutionIdentityMetadata({}, resolution);
    if (
      identity.listingContextMatched === true
      && /^identity:[a-f0-9]{16}$/.test(String(identity.listingContextExpectedFingerprint || ''))
    ) {
      return Object.assign({}, identity, {
        listingContextFingerprint: identity.listingContextExpectedFingerprint
      });
    }
    return identity;
  }

  function stabilizeRegionGroupedExactRevalidation(previousResolution, currentResolution) {
    const api = groupedListingReducerApi();
    const identity = regionExportGroupedParentIdentityMetadata(currentResolution);
    if (api && typeof api.stabilizeGroupedExactRevalidation === 'function') {
      const stabilized = api.stabilizeGroupedExactRevalidation(previousResolution, currentResolution);
      return Object.assign({}, stabilized, identity);
    }
    const current = currentResolution && typeof currentResolution === 'object' ? currentResolution : {};
    const display = normalizeText(current.dongHo);
    return Object.assign({}, current, {
      dongHoStatus: display ? 'multiple-candidates' : 'unresolved',
      dongHo: display ? `\uD6C4\uBCF4: ${display.replace(/^\uD6C4\uBCF4\s*:\s*/, '')}` : REGION_EXPORT_UNRESOLVED_LABEL,
      candidateCount: display ? 1 : 0,
      dongHoHash: '',
      qualityRejectedReason: 'grouped-exact-revalidation-module-missing',
      groupedExactStable: false,
      groupedExactObservationCount: 2
    }, identity);
  }

  async function waitForFreshGroupedExactResolution(row, runId, receiptSnapshot, initialResolution) {
    const startedAt = Date.now();
    let resolution = initialResolution && typeof initialResolution === 'object'
      ? initialResolution
      : currentResolverExportSnapshot(row);
    while (Date.now() - startedAt < REGION_EXPORT_GROUPED_FRESH_EVIDENCE_TIMEOUT_MS) {
      const freshness = regionExportGroupedExactFreshnessDecision(
        receiptSnapshot,
        String(resolution.dongHoStatus || ''),
        runId === regionExportRunId
      );
      if (freshness === 'cancelled') {
        return Object.assign({}, resolution, { dongHoStatus: 'cancelled', dongHo: '', dongHoHash: '' });
      }
      if (freshness === 'fresh-exact') return resolution;
      if (freshness === 'terminal-non-exact') {
        return Object.assign({}, resolution, { dongHoHash: '' });
      }
      safeBridgeTask(scanPage);
      renderOverlay();
      await delayMs(250);
      resolution = currentResolverExportSnapshot(row);
    }
    return Object.assign({}, resolution, {
      dongHoStatus: 'unresolved',
      dongHo: '',
      dongHoHash: '',
      qualityRejectedReason: 'grouped-exact-revalidation-stale'
    });
  }

  async function exportVisibleCurrentRegionRows(outputRows, seen, runId, scopeInput, checkpointContext) {
    const scope = normalizeRegionExportScope(scopeInput);
    if (!checkpointContext || !(checkpointContext.rowsByMarker instanceof Map)) {
      checkpointContext = {
        regionKey: '',
        rowsByMarker: new Map(),
        inMemoryRowsByMarker: new Map(),
        retryMarkers: new Set(),
        retryExactHashByMarker: new Map(),
        retryExactHintByMarker: new Map()
      };
    }
    if (!(checkpointContext.retryMarkers instanceof Set)) checkpointContext.retryMarkers = new Set();
    if (!(checkpointContext.retryExactHashByMarker instanceof Map)) checkpointContext.retryExactHashByMarker = new Map();
    if (!(checkpointContext.retryExactHintByMarker instanceof Map)) checkpointContext.retryExactHintByMarker = new Map();
    if (!(checkpointContext.inMemoryRowsByMarker instanceof Map)) checkpointContext.inMemoryRowsByMarker = new Map();
    const visibleRows = collectCurrentRegionListingRows();
    state.regionExportRowCount = Math.max(Number(state.regionExportRowCount || 0) || 0, seen.size + visibleRows.length);
    for (const row of visibleRows) {
      if (runId !== regionExportRunId) break;
      const markerInfo = await regionExportListingMarkerInfo(row, scope);
      const listingMarker = markerInfo.marker;
      const checkpointMarkerReusable = Boolean(markerInfo.reusable);
      if (runId !== regionExportRunId) break;
      if (!listingMarker || seen.has(listingMarker)) continue;
      seen.add(listingMarker);
      const groupedRetry = checkpointContext.retryMarkers.has(listingMarker);
      const isGrouped = Boolean(
        groupedRetry
        || row.isGroupedListing
        || Number(row.groupedBrokerCount || 0) > 1
      );
      const resolutionRow = groupedRetry && !row.isGroupedListing
        ? Object.assign({}, row, {
            isGroupedListing: true,
            groupedBrokerCount: Math.max(2, Number(row.groupedBrokerCount || 0) || 0)
          })
        : row;
      const resumedRow = checkpointContext.rowsByMarker.get(listingMarker);
      if (!groupedRetry && resumedRow && regionExportCheckpointRowMatchesCurrent(resumedRow, row)) {
        const reusedRow = regionExportReusedCheckpointRow(row, resumedRow, scope, outputRows.length + 1);
        state.regionExportCurrentRow = regionExportOverlayRow(reusedRow);
        outputRows.push(reusedRow);
        state.regionExportResumedCount = Math.min(9999, Number(state.regionExportResumedCount || 0) + 1);
        if (reusedRow.dongHoStatus === 'exact' && reusedRow.dongHo) {
          state.regionExportExactCount = Math.min(9999, Number(state.regionExportExactCount || 0) + 1);
        }
        state.regionExportDoneCount = outputRows.length;
        renderOverlay();
        await delayMs(20);
        continue;
      }
      const inMemoryRow = checkpointContext.inMemoryRowsByMarker.get(listingMarker);
      if (!groupedRetry && inMemoryRow) {
        const reusedRow = regionExportReusedCheckpointRow(row, inMemoryRow, scope, outputRows.length + 1);
        state.regionExportCurrentRow = regionExportOverlayRow(reusedRow);
        outputRows.push(reusedRow);
        if (reusedRow.dongHoStatus === 'exact' && reusedRow.dongHo) {
          state.regionExportExactCount = Math.min(9999, Number(state.regionExportExactCount || 0) + 1);
        }
        state.regionExportDoneCount = outputRows.length;
        renderOverlay();
        await delayMs(20);
        continue;
      }
      if (resumedRow && !groupedRetry) {
        checkpointContext.rowsByMarker.delete(listingMarker);
        checkpointContext.retryMarkers.delete(listingMarker);
        checkpointContext.retryExactHashByMarker.delete(listingMarker);
        checkpointContext.retryExactHintByMarker.delete(listingMarker);
        const checkpointRemoved = await persistRegionExportCheckpoint(checkpointContext.regionKey, {
          removeMarkers: [listingMarker],
          removeRetryMarkers: [listingMarker]
        });
        if (!checkpointRemoved) throw new Error('checkpoint-persist-failed');
      }
      const outputRow = Object.assign({}, row, {
        listingMarker,
        checkpointMarkerReusable,
        complexName: scope.name,
        complexListingCount: scope.listingCount,
        rowIndex: outputRows.length + 1
      });
      state.regionExportCurrentRow = regionExportOverlayRow(outputRow, {
        dongHoStatus: 'waiting',
        dongHo: ''
      });
      state.regionExportDoneCount = outputRows.length;
      renderOverlay();
      const groupedRetryStartedAt = groupedRetry ? Date.now() : 0;
      const groupedRetryObservationToken = groupedRetry ? exactEvidenceReceiptSnapshot() : {};
      const rowResolutionStartedAt = Date.now();
      let resolution = await resolveRegionExportListingRow(resolutionRow, runId, {
        listingMarker,
        expectedDongHoHash: groupedRetry
          ? checkpointContext.retryExactHashByMarker.get(listingMarker) || ''
          : '',
        groupChildHint: groupedRetry
          ? checkpointContext.retryExactHintByMarker.get(listingMarker) || ''
          : ''
      });
      if (runId !== regionExportRunId) break;
      if (groupedRetry && resolution.dongHoStatus === 'exact') {
        resolution = await waitForFreshGroupedExactResolution(
          row,
          runId,
          groupedRetryObservationToken,
          resolution
        );
        const exactSource = currentExactEvidenceReceiptSource();
        if (
          resolution.dongHoStatus === 'exact'
          && (!exactSource || !regionExportExactReceiptAdvanced(groupedRetryObservationToken, exactSource))
        ) {
          resolution = Object.assign({}, resolution, {
            dongHoStatus: 'unresolved',
            dongHo: '',
            dongHoHash: '',
            qualityRejectedReason: 'grouped-exact-revalidation-stale'
          });
        }
      }
      if (resolution.dongHoStatus === 'exact' && resolution.dongHo) {
        resolution = Object.assign({}, resolution, {
          dongHoHash: await safeRegionExactHashAsync(resolution.dongHo, listingMarker)
        });
      }
      if (groupedRetry && resolution.dongHoStatus !== 'cancelled') {
        const previousExact = inMemoryRow && inMemoryRow.dongHoStatus === 'exact'
          ? inMemoryRow
          : {
              dongHoStatus: 'exact',
              dongHo: '',
              dongHoHash: checkpointContext.retryExactHashByMarker.get(listingMarker) || ''
            };
        resolution = stabilizeRegionGroupedExactRevalidation(previousExact, resolution);
      }
      resolution = Object.assign({}, resolution, {
        routeSearchElapsedSec: Math.max(1, Math.ceil((Date.now() - rowResolutionStartedAt) / 1000))
      });
      const resolvedRow = Object.assign(outputRow, resolution, {
        collectedAt: new Date().toISOString()
      });
      outputRows.push(resolvedRow);
      const groupedExactNeedsRetry = Boolean(
        isGrouped
        && !groupedRetry
        && resolution.dongHoStatus === 'exact'
        && resolution.dongHo
      );
      const groupedEvidenceNeedsRetry = Boolean(
        checkpointMarkerReusable
        &&
        isGrouped
        && !groupedRetry
        && regionExportRowHasDongHoEvidence(resolvedRow)
      );
      state.regionExportCurrentRow = groupedExactNeedsRetry
        ? regionExportOverlayRow(resolvedRow, {
            dongHoStatus: 'waiting',
            dongHo: '',
            routeSearchStatus: 'active'
          })
        : regionExportOverlayRow(resolvedRow);
      const checkpointUpdateRequired = groupedRetry
        || groupedEvidenceNeedsRetry
        || (checkpointMarkerReusable && !isGrouped && regionExportRowHasDongHoEvidence(resolvedRow));
      if (checkpointUpdateRequired) {
        const checkpointSaved = await persistRegionExportCheckpoint(checkpointContext && checkpointContext.regionKey, {
          rows: checkpointMarkerReusable && !isGrouped && regionExportRowHasDongHoEvidence(resolvedRow) ? [resolvedRow] : [],
          retryMarkers: groupedEvidenceNeedsRetry ? [listingMarker] : [],
          retryExactEvidence: groupedExactNeedsRetry && resolvedRow.dongHoHash
            ? [{
                listingMarker,
                dongHoHash: resolvedRow.dongHoHash,
                groupChildHint: resolvedRow.groupChildRetryHint || ''
              }]
            : [],
          removeRetryMarkers: groupedRetry ? [listingMarker] : (checkpointMarkerReusable && !isGrouped ? [listingMarker] : [])
        });
        if (!checkpointSaved) throw new Error('checkpoint-persist-failed');
      }
      if (groupedRetry && resolution.dongHoStatus !== 'cancelled') {
        checkpointContext.retryMarkers.delete(listingMarker);
        checkpointContext.retryExactHashByMarker.delete(listingMarker);
        checkpointContext.retryExactHintByMarker.delete(listingMarker);
        state.regionExportGroupedRetryPendingCount = Math.max(
          0,
          Number(state.regionExportGroupedRetryPendingCount || 0) - 1
        );
        state.regionExportGroupedRevalidationCount = Math.min(
          9999,
          Number(state.regionExportGroupedRevalidationCount || 0) + 1
        );
        state.regionExportGroupedRevalidationElapsedMs = Math.min(
          24 * 60 * 60 * 1000,
          Number(state.regionExportGroupedRevalidationElapsedMs || 0) + Math.max(0, Date.now() - groupedRetryStartedAt)
        );
      } else if (groupedEvidenceNeedsRetry) {
        checkpointContext.retryMarkers.add(listingMarker);
        if (resolvedRow.dongHoHash) checkpointContext.retryExactHashByMarker.set(listingMarker, resolvedRow.dongHoHash);
        if (resolvedRow.groupChildRetryHint) {
          checkpointContext.retryExactHintByMarker.set(listingMarker, resolvedRow.groupChildRetryHint);
        }
        state.regionExportGroupedRetryPendingCount = Math.min(
          9999,
          Number(state.regionExportGroupedRetryPendingCount || 0) + 1
        );
      }
      if (!groupedExactNeedsRetry && resolution.dongHoStatus === 'exact' && resolution.dongHo) {
        state.regionExportExactCount = Math.min(9999, Number(state.regionExportExactCount || 0) + 1);
      }
      state.regionExportDoneCount = outputRows.length;
      renderOverlay();
      await delayMs(120);
    }
  }

  async function exportCurrentRegionListingRowsWithResolvers(rows, seen, runId, scopeInput, checkpointContext) {
    const startedCount = rows.length;
    await ensureCurrentRegionSameAddressGroupingOn(runId);
    if (runId !== regionExportRunId) return 0;
    const scroller = currentRegionListingScrollContainer();
    if (scroller) {
      scroller.scrollTop = 0;
      scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
      await delayMs(REGION_EXPORT_SCROLL_SETTLE_MS);
    }
    for (let round = 0; round < REGION_EXPORT_MAX_SCROLL_ROUNDS; round += 1) {
      if (runId !== regionExportRunId) break;
      const before = rows.length;
      await exportVisibleCurrentRegionRows(rows, seen, runId, scopeInput, checkpointContext);
      if (!scroller || runId !== regionExportRunId) break;
      const maxScrollTop = Math.max(0, Number(scroller.scrollHeight || 0) - Number(scroller.clientHeight || 0));
      const atBottom = Number(scroller.scrollTop || 0) >= maxScrollTop - 4;
      if (atBottom) break;
      const nextTop = Math.min(maxScrollTop, Number(scroller.scrollTop || 0) + Math.max(240, Math.round(Number(scroller.clientHeight || 0) * 0.85)));
      scroller.scrollTop = nextTop;
      scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
      await delayMs(REGION_EXPORT_SCROLL_SETTLE_MS);
      if (rows.length === before && nextTop >= maxScrollTop - 4) break;
    }
    return rows.length - startedCount;
  }

  async function exportCurrentRegionRowsWithResolvers(runId, resumeInput) {
    const resume = resumeInput && typeof resumeInput === 'object' ? resumeInput : {};
    const expectedSelectionKey = state.regionExportSelectionKey;
    const rows = [];
    const seen = new Set();
    const checkpointContext = {
      regionKey: resume.regionKey || '',
      rowsByMarker: new Map((Array.isArray(resume.rows) ? resume.rows : [])
        .map(stripRegionExportRow)
        .filter((row) => row.listingMarker)
        .map((row) => [row.listingMarker, row])),
      inMemoryRowsByMarker: new Map((Array.isArray(resume.inMemoryRows) ? resume.inMemoryRows : [])
        .map(stripRegionExportRow)
        .filter((row) => row.listingMarker)
        .map((row) => [row.listingMarker, row])),
      retryMarkers: new Set((Array.isArray(resume.retryMarkers) ? resume.retryMarkers : [])
        .filter((marker) => /^listing:[0-9a-f]{8,64}$/i.test(String(marker || '')))),
      retryExactHashByMarker: new Map((Array.isArray(resume.retryExactEvidence) ? resume.retryExactEvidence : [])
        .filter((item) => (
          item
          && /^listing:[0-9a-f]{8,64}$/i.test(String(item.listingMarker || ''))
          && /^[0-9a-f]{10,64}$/i.test(String(item.dongHoHash || ''))
        ))
        .map((item) => [String(item.listingMarker).toLowerCase(), String(item.dongHoHash).toLowerCase()])),
      retryExactHintByMarker: new Map((Array.isArray(resume.retryExactEvidence) ? resume.retryExactEvidence : [])
        .filter((item) => (
          item
          && /^listing:[0-9a-f]{8,64}$/i.test(String(item.listingMarker || ''))
          && /^child:[0-9a-f]{16}$/i.test(String(item.groupChildHint || ''))
        ))
        .map((item) => [String(item.listingMarker).toLowerCase(), String(item.groupChildHint).toLowerCase()]))
    };
    const complexTargets = await collectCurrentRegionComplexTargets(runId, expectedSelectionKey);
    if (complexTargets.length) {
      state.regionExportComplexTargetCount = complexTargets.length;
      const estimatedRows = complexTargets.reduce((sum, target) => sum + (Number(target.listingCount || 0) || 0), 0);
      if (estimatedRows > 0) state.regionExportRowCount = Math.max(estimatedRows, rows.length);
      for (const complexTarget of complexTargets) {
        if (runId !== regionExportRunId) break;
        const selection = await clickCurrentRegionComplexTarget(complexTarget, runId, expectedSelectionKey);
        if (runId !== regionExportRunId || selection.reason === 'cancelled') break;
        state.regionExportComplexDoneCount = Math.min(
          9999,
          Number(state.regionExportComplexDoneCount || 0) + 1
        );
        state.regionExportComplexLastReason = selection.reason || '';
        if (!selection.ok) {
          state.regionExportComplexFailureCount = Math.min(
            9999,
            Number(state.regionExportComplexFailureCount || 0) + 1
          );
          const statusRow = Object.assign(regionExportComplexStatusRow(
            complexTarget,
            'complex-select-failed',
            selection.reason || 'complex-select-failed'
          ), { rowIndex: rows.length + 1 });
          rows.push(statusRow);
          state.regionExportCurrentRow = regionExportOverlayRow(statusRow);
          renderOverlay();
          continue;
        }
        renderOverlay();
        const added = await exportCurrentRegionListingRowsWithResolvers(rows, seen, runId, complexTarget, checkpointContext);
        const visibleCount = collectCurrentRegionListingRows().length;
        if (added < 1 && visibleCount < 1 && (Number(complexTarget.listingCount || 0) || 0) > 0) {
          state.regionExportComplexFailureCount = Math.min(
            9999,
            Number(state.regionExportComplexFailureCount || 0) + 1
          );
          state.regionExportComplexLastReason = 'complex-no-rows';
          const statusRow = Object.assign(regionExportComplexStatusRow(
            complexTarget,
            'complex-no-rows',
            'complex selected but no listing rows were collected'
          ), { rowIndex: rows.length + 1 });
          rows.push(statusRow);
          state.regionExportCurrentRow = regionExportOverlayRow(statusRow);
          renderOverlay();
        }
      }
    } else {
      await exportCurrentRegionListingRowsWithResolvers(rows, seen, runId, 'current', checkpointContext);
    }
    return rows.map(stripRegionExportRow);
  }

  async function revalidatePendingGroupedExactRows(rows, runId, regionKey) {
    const pending = Math.max(0, Number(state.regionExportGroupedRetryPendingCount || 0) || 0);
    if (!pending || runId !== regionExportRunId) return rows;
    const resumed = await restoreRegionExportCheckpoint(regionKey);
    if (runId !== regionExportRunId) return rows;
    if (String(resumed.reason || '').startsWith('storage-')) {
      throw new Error(resumed.reason);
    }
    const retryMarkers = Array.isArray(resumed.retryMarkers) ? resumed.retryMarkers : [];
    if (!retryMarkers.length) return rows;
    state.regionExportDoneCount = 0;
    state.regionExportExactCount = 0;
    state.regionExportComplexDoneCount = 0;
    state.regionExportComplexFailureCount = 0;
    state.regionExportComplexLastReason = '';
    state.regionExportGroupedRetryPendingCount = retryMarkers.length;
    state.regionExportRowCount = Math.max(rows.length, retryMarkers.length);
    state.regionExportCurrentRow = null;
    renderOverlay();
    return exportCurrentRegionRowsWithResolvers(runId, {
      regionKey,
      rows: resumed.rows,
      markers: resumed.markers,
      retryMarkers,
      retryExactEvidence: resumed.retryExactEvidence,
      inMemoryRows: rows
    });
  }

  async function exportCurrentRegionFromOverlay(lockHeld = false, confirmedSelectionKey = '', requestedResumeRegionKey = '') {
    if (['running', 'saving'].includes(state.regionExportStatus)) return;
    if (state.regionExportStatus === 'preparing' && !lockHeld) return;
    const selectionApi = regionExportSelectionApi();
    const confirmedSelection = typeof selectionApi.createSelection === 'function'
      ? selectionApi.createSelection(String(confirmedSelectionKey || '').split('|'))
      : { complete: false, key: '' };
    if (!confirmedSelection.complete) {
      state.regionExportStatus = 'error';
      state.regionExportLastError = 'selection-required';
      renderOverlay();
      return;
    }
    // Do NOT bail when Naver's currently applied region differs from the confirmed pick — the run
    // applies (restores) the confirmed region to 네이버부동산 before collecting complexes. 추출하기
    // therefore navigates Naver to the selected region and extracts it, rather than requiring Naver to
    // already be on it.
    if (!lockHeld) {
      const resumeRegionKey = state.regionExportStatus === 'cancelled'
        && state.regionExportLastError === 'user-cancelled'
        ? regionExportResumeRegionKey
        : '';
      state.regionExportStatus = 'preparing';
      state.regionExportLastError = '';
      state.regionExportSelectionKey = confirmedSelection.key;
      state.regionExportSelectionLabel = confirmedSelection.label;
      renderOverlay();
      if (
        typeof navigator === 'undefined'
        || !navigator.locks
        || typeof navigator.locks.request !== 'function'
      ) {
        state.regionExportStatus = 'error';
        state.regionExportLastError = 'browser-lock-unavailable';
        renderOverlay();
        return;
      }
      let lockAcquired = false;
      await navigator.locks.request(REGION_EXPORT_BROWSER_LOCK_NAME, {
        mode: 'exclusive',
        ifAvailable: true
      }, async (lock) => {
        if (!lock) return;
        lockAcquired = true;
        await exportCurrentRegionFromOverlay(true, confirmedSelection.key, resumeRegionKey);
      });
      if (!lockAcquired) {
        state.regionExportStatus = 'error';
        state.regionExportLastError = 'another-tab-running';
        renderOverlay();
      }
      return;
    }
    const resumableRegionKey = /^region:[0-9a-f]{32}$/i.test(String(requestedResumeRegionKey || ''))
      ? String(requestedResumeRegionKey).toLowerCase()
      : '';
    const runId = regionExportRunId + 1;
    regionExportRunId = runId;
    const filename = `dhs-region-${currentTimestampForFilename()}.xlsx`;
    state.lastEvent = 'region-export';
    state.regionExportStatus = 'preparing';
    state.regionExportRowCount = 0;
    state.regionExportDoneCount = 0;
    state.regionExportExactCount = 0;
    state.regionExportResumedCount = 0;
    state.regionExportComplexTargetCount = 0;
    state.regionExportComplexDoneCount = 0;
    state.regionExportComplexFailureCount = 0;
    state.regionExportComplexLastReason = '';
    state.regionExportGroupedRetryPendingCount = 0;
    state.regionExportGroupedRevalidationCount = 0;
    state.regionExportGroupedRevalidationElapsedMs = 0;
    state.regionExportGroupedRetryHintAttemptCount = 0;
    state.regionExportGroupedRetryHintMatchCount = 0;
    state.regionExportGroupedRetryHintExactCount = 0;
    state.regionExportGroupedParentResolutionMs = 0;
    state.regionExportGroupedChildAttemptCount = 0;
    state.regionExportGroupedChildClickCount = 0;
    state.regionExportGroupedChildAttemptTotal = 0;
    state.regionExportGroupedChildClickTotal = 0;
    state.regionExportGroupedChildSkippedEquivalentCount = 0;
    state.regionExportGroupedChildSkippedEquivalentTotal = 0;
    state.regionExportGroupedChildRebindMissCount = 0;
    state.regionExportGroupedChildExactAttemptIndex = 0;
    state.regionExportGroupedChildResolutionMs = 0;
    state.regionExportStartedAt = 0;
    state.regionExportElapsedMs = 0;
    state.regionExportCheckpointStatus = 'idle';
    state.regionExportLastError = '';
    state.regionExportCurrentRow = null;
    state.regionExportCandidatePendingReasons = Object.freeze([]);
    state.regionExportCandidateSettled = false;
    state.regionExportCandidateCompletionReason = 'idle';
    state.regionExportCandidateEarlyExitCount = 0;
    state.regionExportSelectionKey = confirmedSelection.key;
    state.regionExportSelectionLabel = confirmedSelection.label;
    state.regionExportSavedPath = '';
    providerRequestGeneration += 1;
    if (state.providerOpenStatus === 'cancelled') state.providerOpenStatus = 'idle';
    renderOverlay();
    // 추출하기: apply the DHS-picked region to 네이버부동산 whenever Naver isn't already on it. The old
    // `regionExportSelectionProofMatches` gate only restored a "trusted popup selection" (proof
    // 'selector-complete'); the DHS-native picker sets proof 'dhs-picker', so gating on it skipped the
    // restore entirely → Naver stayed on the wrong region → checkpoint marker failed → "저장 실패".
    // The pick came from Naver's own regions API, so the key always maps to a real region to restore.
    // Self-diagnosing breadcrumbs written into any diagnostic/no-rows workbook so a failed run explains
    // itself (was the region applied? how many complexes did Naver show?) without needing a live session.
    state.regionExportRunDiagnostic = {
      picked: String(confirmedSelection.label || confirmedSelection.key || ''),
      naverBefore: String((currentRegionSelection() || {}).label || ''),
      restore: 'skipped-already-current'
    };
    if (!currentRegionComplexContextMatchesKey(confirmedSelection.key)) {
      const restoredSelection = await restoreCurrentRegionExportSelection(confirmedSelection.key, runId);
      if (runId !== regionExportRunId) return;
      state.regionExportRunDiagnostic.restore = String(restoredSelection.reason || (restoredSelection.ok ? 'ok' : 'failed'));
      state.regionExportRunDiagnostic.naverAfter = String((currentRegionSelection() || {}).label || '');
      if (!restoredSelection.ok) {
        state.regionExportSelectionProof = '';
        state.regionExportStatus = 'error';
        state.regionExportLastError = 'region-selection-restore-failed';
        renderOverlay();
        return;
      }
    }
    const regionKey = resumableRegionKey || await currentRegionContextMarker(confirmedSelection.key);
    state.regionExportSelectionProof = '';
    if (runId !== regionExportRunId) return;
    if (!regionKey) {
      state.regionExportStatus = 'error';
      state.regionExportLastError = 'checkpoint-marker-unavailable';
      renderOverlay();
      return;
    }
    regionExportResumeRegionKey = regionKey;
    const resumed = await restoreRegionExportCheckpoint(regionKey);
    if (runId !== regionExportRunId) return;
    if (String(resumed.reason || '').startsWith('storage-')) {
      state.regionExportStatus = 'error';
      state.regionExportLastError = resumed.reason;
      renderOverlay();
      return;
    }
    state.regionExportResumedCount = 0;
    state.regionExportDoneCount = 0;
    state.regionExportExactCount = 0;
    state.regionExportGroupedRetryPendingCount = resumed.retryMarkers.length;
    state.regionExportRowCount = resumed.rows.length + resumed.retryMarkers.length;
    state.regionExportStatus = 'running';
    state.regionExportStartedAt = Date.now();
    renderOverlay();
    let rows = [];
    try {
      rows = await exportCurrentRegionRowsWithResolvers(runId, {
      regionKey,
      rows: resumed.rows,
      markers: resumed.markers,
      retryMarkers: resumed.retryMarkers,
      retryExactEvidence: resumed.retryExactEvidence
      });
      if (runId === regionExportRunId && state.regionExportGroupedRetryPendingCount > 0) {
        const firstPassRows = rows;
        const revalidatedRows = await revalidatePendingGroupedExactRows(rows, runId, regionKey);
        rows = mergeRegionRevalidatedRows(firstPassRows, revalidatedRows);
      }
    } catch (error) {
      if (runId !== regionExportRunId) return;
      const errorMessage = String(error && error.message || error || '').slice(0, 120);
      state.regionExportLastError = errorMessage;
      if (!beginRegionExportFileWrite(runId)) return;
      try {
        await downloadRegionExportWorkbook(filename, buildRegionExportXlsxBase64(regionExportStatusRows2D('error', errorMessage)));
      } catch (writeError) {
        state.regionExportLastError = String(writeError && writeError.message || writeError || errorMessage || '').slice(0, 120);
      }
      if (runId !== regionExportRunId) return;
      state.regionExportStatus = 'error';
      finishRegionExportTiming();
      renderOverlay();
      return;
    }
    if (runId !== regionExportRunId) return;
    state.regionExportRowCount = rows.length;
    state.regionExportDoneCount = rows.length;
    state.regionExportExactCount = rows.filter((row) => row.dongHoStatus === 'exact' && row.dongHo).length;
    if (!rows.length) {
      if (!beginRegionExportFileWrite(runId)) return;
      let finalStatus = 'no-rows';
      try {
        await downloadRegionExportWorkbook(filename, buildRegionExportXlsxBase64(regionExportStatusRows2D('no-rows', 'no listing rows collected')));
      } catch (error) {
        finalStatus = 'error';
        state.regionExportLastError = String(error && error.message || error || '').slice(0, 120);
      }
      if (runId !== regionExportRunId) return;
      state.regionExportStatus = finalStatus;
      finishRegionExportTiming();
      renderOverlay();
      return;
    }
    const groupedRetryPending = Math.max(0, Number(state.regionExportGroupedRetryPendingCount || 0) || 0);
    if (groupedRetryPending > 0) {
      const message = `\uBB36\uC74C \uC7AC\uD655\uC778 \uBBF8\uC644\uB8CC: ${groupedRetryPending}\uAC74`;
      state.regionExportLastError = message;
      state.regionExportCurrentRow = null;
      if (!beginRegionExportFileWrite(runId)) return;
      let finalStatus = 'quality-blocked';
      try {
        await downloadRegionExportWorkbook(
          filename,
          buildRegionExportXlsxBase64(regionExportStatusRows2D('grouped-retry-pending', message))
        );
      } catch (error) {
        finalStatus = 'error';
        state.regionExportLastError = String(error && error.message || error || message).slice(0, 120);
      }
      if (runId !== regionExportRunId) return;
      state.regionExportStatus = finalStatus;
      finishRegionExportTiming();
      renderOverlay();
      return;
    }
    const quality = regionExportQualityGate(rows);
    if (!quality.ok) {
      state.regionExportLastError = quality.message;
      state.regionExportCurrentRow = null;
      if (!beginRegionExportFileWrite(runId)) return;
      let finalStatus = 'quality-blocked';
      try {
        await downloadRegionExportWorkbook(filename, buildRegionExportXlsxBase64(regionExportStatusRows2D('quality-blocked', quality.message)));
      } catch (error) {
        finalStatus = 'error';
        state.regionExportLastError = String(error && error.message || error || '').slice(0, 120);
      }
      if (runId !== regionExportRunId) return;
      state.regionExportStatus = finalStatus;
      finishRegionExportTiming();
      renderOverlay();
      return;
    }
    if (!beginRegionExportFileWrite(runId)) return;
    try {
      const download = await downloadRegionExportWorkbook(filename, buildRegionExportXlsxBase64(regionExportRows2D(rows)));
      if (runId !== regionExportRunId) return;
      const checkpointCleared = await clearRegionExportCheckpoint(regionKey);
      if (runId !== regionExportRunId) return;
      if (!checkpointCleared) throw new Error('checkpoint-cleanup-failed');
      state.regionExportStatus = 'downloaded';
      state.regionExportSavedPath = download.path || `Downloads/DHS/${filename}`;
      regionExportResumeRegionKey = '';
    } catch (error) {
      if (runId !== regionExportRunId) return;
      state.regionExportStatus = 'error';
      state.regionExportLastError = String(error && error.message || error || '').slice(0, 120);
    }
    if (runId !== regionExportRunId) return;
    finishRegionExportTiming();
    renderOverlay();
  }

  async function safeExactDisplayHashAsync(value) {
    const key = exactDisplayKey(value);
    if (
      !key ||
      typeof crypto === 'undefined' ||
      !crypto.subtle ||
      typeof TextEncoder === 'undefined' ||
      typeof Uint8Array === 'undefined'
    ) return '';
    try {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
      return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 10);
    } catch (_) {
      return '';
    }
  }

  async function safeRegionExactHashAsync(value, listingMarker) {
    const key = exactDisplayKey(value);
    const marker = /^listing:[0-9a-f]{8,64}$/i.test(String(listingMarker || ''))
      ? String(listingMarker).toLowerCase()
      : '';
    if (!key || !marker) return '';
    const nonce = await regionExportCheckpointMarkerNonce();
    if (!nonce) return '';
    const digest = await regionExportMarkerDigest(`${nonce}|region-exact|${marker}|${key}`);
    return digest ? digest.slice(0, 10) : '';
  }

  function articleMarkerFromUrl() {
    try {
      const articleNo = new URL(location.href).searchParams.get('articleNo');
      return articleNo ? hashMarker(articleNo) : '';
    } catch (_) {
      return '';
    }
  }

  function providerLookupRequestFromUrl() {
    try {
      const key = String(new URL(location.href).searchParams.get('articleNo') || '').replace(/[^0-9]/g, '');
      if (!/^\d{5,15}$/.test(key)) return { listingKey: '', rejectReason: 'missing-key' };
      const targetContext = currentCdpTargetContext() || {};
      const expectedMarkers = [state.articleMarker, targetContext.articleMarker]
        .map((value) => sanitizeArticleMarker(value))
        .filter((value, index, list) => value && list.indexOf(value) === index);
      if (!expectedMarkers.length) {
        return { listingKey: '', rejectReason: 'missing-marker' };
      }
      const urlMarker = hashMarker(key);
      return expectedMarkers.includes(urlMarker)
        ? { listingKey: key, articleMarker: urlMarker, rejectReason: '' }
        : { listingKey: '', rejectReason: 'marker-mismatch' };
    } catch (_) {
      return { listingKey: '', rejectReason: 'missing-key' };
    }
  }

  function providerLookupKeyFromUrl() {
    const request = providerLookupRequestFromUrl();
    return request.listingKey || '';
  }

  function sanitizeProviderLookupKind(value) {
    const kind = String(value || '');
    return ['mk-sequence', 'mk-uid', 'provider-url'].includes(kind) ? kind : '';
  }

  function sanitizeProviderLookupKey(value, kind) {
    const text = String(value || '');
    const key = text.replace(/[^0-9]/g, '');
    if (kind === 'mk-sequence') return /^\d{1,20}$/.test(key) ? key : '';
    if (kind === 'mk-uid') return /^\d{5,15}$/.test(key) ? key : '';
    if (kind === 'provider-url') return /^provider:[a-f0-9]{8}$/.test(text) ? text : '';
    return '';
  }

  function sanitizeProviderLookupRef(value) {
    const text = String(value || '').trim();
    if (!/^https?:\/\//i.test(text) || text.length > 2048) return '';
    try {
      const parsed = new URL(text);
      if (!['http:', 'https:'].includes(parsed.protocol)) return '';
      if (parsed.username || parsed.password) return '';
      return parsed.href;
    } catch (_) {
      return '';
    }
  }

  function kbAliasEvidenceFromLocation() {
    const api = window.DHS_KB_ALIAS;
    if (!api || typeof api.kbAliasEvidenceFromUrl !== 'function') {
      return { present: false, aliasMarker: '' };
    }
    return api.kbAliasEvidenceFromUrl(location.href);
  }

  const REGION_EXPORT_SHIELD_ID = 'dhs-region-export-shield';

  function regionExportShieldActive() {
    return ['preparing', 'running', 'saving'].includes(state.regionExportStatus);
  }

  function ensureRegionExportShield() {
    let shield = document.getElementById(REGION_EXPORT_SHIELD_ID);
    if (shield) return shield;
    if (!document.documentElement) return null;
    shield = document.createElement('div');
    shield.id = REGION_EXPORT_SHIELD_ID;
    shield.setAttribute('role', 'alertdialog');
    shield.setAttribute('aria-label', '지역 추출 진행 중');
    shield.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483646', 'display:none',
      'align-items:center', 'justify-content:center',
      'background:rgba(15,23,42,0.45)', 'pointer-events:auto', 'cursor:not-allowed'
    ].join(';');
    const box = document.createElement('div');
    box.style.cssText = [
      'pointer-events:auto', 'max-width:320px', 'text-align:center', 'background:#0f172a',
      'color:#e2e8f0', 'border-radius:14px', 'padding:18px 22px',
      'box-shadow:0 12px 44px rgba(0,0,0,0.45)',
      'font:600 14px/1.55 -apple-system,BlinkMacSystemFont,"Malgun Gothic",sans-serif'
    ].join(';');
    const msg = document.createElement('div');
    msg.textContent = '지역 추출 중입니다. 완료될 때까지 페이지를 건드리지 마세요.';
    const sub = document.createElement('div');
    sub.className = 'dhs-region-shield-sub';
    sub.style.cssText = 'margin-top:6px;font-weight:400;font-size:12px;color:#94a3b8';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'dhs-region-shield-cancel';
    cancel.textContent = '추출 취소';
    cancel.style.cssText = [
      'margin-top:14px', 'pointer-events:auto', 'cursor:pointer', 'background:#ef4444',
      'color:#fff', 'border:0', 'border-radius:8px', 'padding:8px 16px', 'font:600 13px sans-serif'
    ].join(';');
    cancel.addEventListener('click', (event) => {
      if (event) event.stopPropagation();
      safeBridgeTask(() => {
        if (cancelCurrentRegionExport()) renderOverlay();
      });
    });
    box.appendChild(msg);
    box.appendChild(sub);
    box.appendChild(cancel);
    shield.appendChild(box);
    document.documentElement.appendChild(shield);
    return shield;
  }

  function updateRegionExportShield() {
    const active = regionExportShieldActive();
    const shield = active ? ensureRegionExportShield() : document.getElementById(REGION_EXPORT_SHIELD_ID);
    if (!shield) return;
    if (!active) {
      if (shield.style.display !== 'none') shield.style.display = 'none';
      return;
    }
    if (shield.style.display !== 'flex') shield.style.display = 'flex';
    const clickThrough = regionExportShieldClickThroughDepth > 0 ? 'none' : 'auto';
    if (shield.style.pointerEvents !== clickThrough) shield.style.pointerEvents = clickThrough;
    const sub = shield.querySelector('.dhs-region-shield-sub');
    if (sub) {
      const label = state.regionExportStatus === 'saving'
        ? '저장 중…'
        : (state.regionExportStatus === 'preparing'
          ? '준비 중…'
          : `진행 ${Number(state.regionExportDoneCount || 0)}/${Number(state.regionExportRowCount || 0)}`);
      if (sub.textContent !== label) sub.textContent = label;
    }
  }

  // Toggle the shield to click-through so the extraction's own coordinate clicks reach the page, then
  // restore. A safety timer guarantees the block is restored even if the click callback never fires.
  function beginRegionExportShieldClickThrough() {
    regionExportShieldClickThroughDepth += 1;
    updateRegionExportShield();
    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      regionExportShieldClickThroughDepth = Math.max(0, regionExportShieldClickThroughDepth - 1);
      updateRegionExportShield();
    };
    window.setTimeout(restore, 1500);
    return restore;
  }

  function ensureOverlay() {
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;
    if (!document.documentElement) return null;

    overlay = document.createElement('aside');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = [
      '<div class="dhs-user-card">',
      '<div class="dhs-title">',
      '<span class="dhs-heading">\uB3D9\uD638\uC218 \uD655\uC778</span>',
      '<span class="dhs-state">\uB300\uAE30</span>',
      '</div>',
      '<div class="dhs-primary">',
      '<span class="dhs-primary-label">\uD604\uC7AC \uC0C1\uD0DC</span>',
      '<strong class="dhs-primary-value">\uB9E4\uBB3C \uC120\uD0DD \uD544\uC694</strong>',
      '</div>',
      '<p class="dhs-helper"></p>',
      '<div class="dhs-summary"></div>',
      '<button type="button" class="dhs-region-export" data-dhs-action="export-region">\uC6D0\uD558\uB294 \uC9C0\uC5ED \uC815\uBCF4 \uCD94\uCD9C\uD558\uAE30</button>',
      '<div class="dhs-region-flow" role="dialog" aria-labelledby="dhs-region-flow-title" hidden>',
      '<strong class="dhs-region-flow-title" id="dhs-region-flow-title">\uC9C0\uC5ED \uC120\uD0DD</strong>',
      '<div class="dhs-region-steps" aria-label="\uC9C0\uC5ED \uC120\uD0DD \uB2E8\uACC4">',
      '<button type="button" class="dhs-region-step" data-dhs-action="choose-region-level" data-dhs-region-level="sido"><small>1</small><span class="dhs-region-step-value">\uC2DC/\uB3C4</span></button>',
      '<button type="button" class="dhs-region-step" data-dhs-action="choose-region-level" data-dhs-region-level="sigungu"><small>2</small><span class="dhs-region-step-value">\uC2DC/\uAD70/\uAD6C</span></button>',
      '<button type="button" class="dhs-region-step" data-dhs-action="choose-region-level" data-dhs-region-level="dong"><small>3</small><span class="dhs-region-step-value">\uC74D/\uBA74/\uB3D9</span></button>',
      '</div>',
      '<p class="dhs-region-question"></p>',
      '<div class="dhs-region-options" role="listbox" aria-label="지역 목록" hidden></div>',
      '<div class="dhs-region-actions">',
      '<button type="button" class="dhs-region-choose" data-dhs-action="choose-region" hidden>\uC9C0\uC5ED \uC120\uD0DD \uCC3D \uC5F4\uAE30</button>',
      '<button type="button" class="dhs-region-cancel" data-dhs-action="cancel-region">\uCDE8\uC18C</button>',
      '<button type="button" class="dhs-region-confirm" data-dhs-action="confirm-region" hidden>\uCD94\uCD9C\uD558\uAE30</button>',
      '</div>',
      '</div>',
      '<button type="button" class="dhs-dev-toggle" data-dhs-action="toggle-dev">\uAC1C\uBC1C\uC790 \uC815\uBCF4</button>',
      '<button type="button" class="dhs-compare-signal" tabindex="-1" aria-label="DHS_COMPARE status=idle exactHash= source=idle branch=idle outcome=idle route=idle line=idle count=0">DHS_COMPARE status=idle exactHash= source=idle branch=idle outcome=idle route=idle line=idle count=0</button>',
      '</div>',
      '<div class="dhs-dev-card" hidden>',
      '<div class="dhs-dev-title">\uAC1C\uBC1C\uC790 \uC9C4\uB2E8</div>',
      '<div class="dhs-grid"></div>',
      '<div class="dhs-footnote">\uC775\uBA85\uD654\uB41C \uC9C4\uB2E8\uAC12\uB9CC \uD45C\uC2DC</div>',
      '</div>'
    ].join('');
    overlayClickListener = (event) => safeBridgeTask(() => {
      const target = event.target && event.target.closest('[data-dhs-action]');
      if (!target) return;
      if (target.getAttribute('data-dhs-action') === 'export-region') {
        if (state.regionExportStatus === 'running') {
          cancelCurrentRegionExport();
          return;
        }
        beginRegionExportSelectionFromOverlay();
        return;
      }
      if (target.getAttribute('data-dhs-action') === 'choose-region-level') {
        chooseCurrentRegionLevelFromOverlay(target.getAttribute('data-dhs-region-level'));
        return;
      }
      if (target.getAttribute('data-dhs-action') === 'pick-region-option') {
        pickCurrentRegionOptionFromOverlay(target.getAttribute('data-dhs-region-cortarno'));
        return;
      }
      if (target.getAttribute('data-dhs-action') === 'confirm-region') {
        confirmCurrentRegionExportFromOverlay();
        return;
      }
      if (target.getAttribute('data-dhs-action') === 'cancel-region') {
        cancelRegionExportSelection();
        return;
      }
      if (target.getAttribute('data-dhs-action') === 'toggle-dev') {
        const devCard = overlay.querySelector('.dhs-dev-card');
        if (devCard) devCard.hidden = !devCard.hidden;
      }
    });
    overlay.addEventListener('click', overlayClickListener);

    document.documentElement.appendChild(overlay);
    return overlay;
  }

  function renderOverlay() {
    const overlay = ensureOverlay();
    if (!overlay) return;
    // Full-screen shield blocks page interaction while an extraction is preparing/running/saving.
    updateRegionExportShield();
    const currentListingOverlayRow = currentListingOverlayRowForOverlay();
    writeOverlayProbeDataset(overlay, currentListingOverlayRow);

    const selectionUiActive = ['selecting-region', 'confirming-region'].includes(state.regionExportStatus);
    // Single source of truth for "the resolver is still working on the open listing". The row gate in
    // currentListingResolution() returns dongHoStatus 'waiting' exactly while the investigation has
    // neither confirmed an exact nor genuinely settled — so the overlay can key off this one flag to
    // suppress ALL not-yet-certain verdicts (line-inference "N개 후보", premature "확인 결과 없음") and
    // show a clean "조사 중" until the answer (or a real timeout) lands.
    const investigationInProgress = Boolean(
      !selectionUiActive
      && selectedListingForRouteSearch()
      && currentListingOverlayRow
      && currentListingOverlayRow.dongHoStatus === 'waiting'
    );
    const overlayState = Object.assign({}, state, selectionUiActive ? {
      regionExportStatus: 'idle',
      regionExportCurrentRow: null,
      currentListingOverlayRow: null,
      investigationInProgress: false
    } : {
      currentListingOverlayRow: currentListingOverlayRow,
      investigationInProgress
    });
    const view = window.DHS_OVERLAY_VIEW
      ? window.DHS_OVERLAY_VIEW.buildOverlayView(overlayState)
      : null;
    if (!view) return;
    const isRegionExportView = Boolean(
      state.regionExportStatus
      && state.regionExportStatus !== 'idle'
      && !selectionUiActive
    );
    if (isRegionExportView) {
      const currentPresentation = regionExportPresentation(state.regionExportCurrentRow);
      const presentationApi = dongHoPresentationApi();
      const currentPresentationFingerprint = presentationApi && typeof presentationApi.presentationFingerprint === 'function'
        ? presentationApi.presentationFingerprint(currentPresentation)
        : '';
      const currentCandidateComplete = currentPresentation.status !== 'multiple-candidates'
        || currentPresentation.hasEvidence === true;
      const currentGroupChildExpectedCount = Math.min(
        999,
        Math.max(0, Number(state.regionExportCurrentRow && state.regionExportCurrentRow.groupChildExpectedCount || 0) || 0)
      );
      const currentGroupChildPlannedCount = Math.min(
        999,
        Math.max(0, Number(state.regionExportCurrentRow && state.regionExportCurrentRow.groupChildPlannedCount || 0) || 0)
      );
      const currentGroupChildResolvedCount = Math.min(
        999,
        Math.max(0, Number(state.regionExportCurrentRow && state.regionExportCurrentRow.groupChildResolvedCount || 0) || 0)
      );
      const currentGroupChildComplete = currentGroupChildExpectedCount === 0
        || state.regionExportCurrentRow && state.regionExportCurrentRow.groupChildComplete === true;
      const currentGroupChildObservedCount = Math.min(
        999,
        Math.max(0, Number(state.regionExportCurrentRow && state.regionExportCurrentRow.groupChildObservedCount || 0) || 0)
      );
      const currentGroupChildPlanReason = String(
        state.regionExportCurrentRow && state.regionExportCurrentRow.groupChildPlanReason || ''
      ).replace(/[^a-z-]/g, '').slice(0, 48);
      const currentRowElapsedMs = Math.min(
        60 * 60 * 1000,
        Math.max(0, Number(state.regionExportCurrentRow && state.regionExportCurrentRow.routeSearchElapsedSec || 0) || 0) * 1000
      );
      const currentRowDong = regionExportNumericToken(state.regionExportCurrentRow && state.regionExportCurrentRow.dong);
      const currentCellDong = regionExportDongCell(state.regionExportCurrentRow);
      const currentSettlementBlockers = (Array.isArray(state.regionExportCandidatePendingReasons)
        ? state.regionExportCandidatePendingReasons
        : [])
        .filter((value) => REGION_EXPORT_CANDIDATE_BLOCKERS.includes(value))
        .slice(0, REGION_EXPORT_CANDIDATE_BLOCKERS.length)
        .join(',');
      overlay.setAttribute('data-dhs-region-export', 'true');
      overlay.setAttribute('data-dhs-region-status', String(state.regionExportStatus || 'idle'));
      overlay.setAttribute('data-dhs-region-done-count', String(Math.max(0, Number(state.regionExportDoneCount || 0) || 0)));
      overlay.setAttribute('data-dhs-region-row-count', String(Math.max(0, Number(state.regionExportRowCount || 0) || 0)));
      overlay.setAttribute('data-dhs-region-exact-count', String(Math.max(0, Number(state.regionExportExactCount || 0) || 0)));
      overlay.setAttribute('data-dhs-region-complex-target-count', String(Math.max(0, Number(state.regionExportComplexTargetCount || 0) || 0)));
      overlay.setAttribute('data-dhs-region-complex-done-count', String(Math.max(0, Number(state.regionExportComplexDoneCount || 0) || 0)));
      overlay.setAttribute('data-dhs-region-complex-failure-count', String(Math.max(0, Number(state.regionExportComplexFailureCount || 0) || 0)));
      overlay.setAttribute('data-dhs-region-complex-last-reason', String(state.regionExportComplexLastReason || '').replace(/[^a-z0-9-]/gi, '').slice(0, 48));
      overlay.setAttribute('data-dhs-region-resumed-count', String(Math.max(0, Number(state.regionExportResumedCount || 0) || 0)));
      overlay.setAttribute('data-dhs-region-grouped-retry-pending', String(Math.max(0, Number(state.regionExportGroupedRetryPendingCount || 0) || 0)));
      overlay.setAttribute('data-dhs-region-grouped-revalidated', String(Math.max(0, Number(state.regionExportGroupedRevalidationCount || 0) || 0)));
      overlay.setAttribute('data-dhs-region-grouped-revalidation-ms', String(Math.max(0, Number(state.regionExportGroupedRevalidationElapsedMs || 0) || 0)));
      overlay.setAttribute('data-dhs-region-grouped-retry-hint-attempts', String(Math.max(0, Number(state.regionExportGroupedRetryHintAttemptCount || 0) || 0)));
      overlay.setAttribute('data-dhs-region-grouped-retry-hint-matches', String(Math.max(0, Number(state.regionExportGroupedRetryHintMatchCount || 0) || 0)));
      overlay.setAttribute('data-dhs-region-grouped-retry-hint-exacts', String(Math.max(0, Number(state.regionExportGroupedRetryHintExactCount || 0) || 0)));
      overlay.setAttribute('data-dhs-region-grouped-parent-resolution-ms', String(Math.max(0, Number(state.regionExportGroupedParentResolutionMs || 0) || 0)));
      overlay.setAttribute('data-dhs-region-grouped-child-attempts', String(Math.max(0, Number(state.regionExportGroupedChildAttemptCount || 0) || 0)));
      overlay.setAttribute('data-dhs-region-grouped-child-clicks', String(Math.max(0, Number(state.regionExportGroupedChildClickCount || 0) || 0)));
      overlay.setAttribute('data-dhs-region-grouped-child-skipped-equivalents', String(Math.max(0, Number(state.regionExportGroupedChildSkippedEquivalentCount || 0) || 0)));
      overlay.setAttribute('data-dhs-region-grouped-child-attempt-total', String(Math.max(0, Number(state.regionExportGroupedChildAttemptTotal || 0) || 0)));
      overlay.setAttribute('data-dhs-region-grouped-child-click-total', String(Math.max(0, Number(state.regionExportGroupedChildClickTotal || 0) || 0)));
      overlay.setAttribute('data-dhs-region-grouped-child-skipped-total', String(Math.max(0, Number(state.regionExportGroupedChildSkippedEquivalentTotal || 0) || 0)));
      overlay.setAttribute('data-dhs-region-grouped-child-rebind-misses', String(Math.max(0, Number(state.regionExportGroupedChildRebindMissCount || 0) || 0)));
      overlay.setAttribute('data-dhs-region-grouped-child-exact-index', String(Math.max(0, Number(state.regionExportGroupedChildExactAttemptIndex || 0) || 0)));
      overlay.setAttribute('data-dhs-region-grouped-child-resolution-ms', String(Math.max(0, Number(state.regionExportGroupedChildResolutionMs || 0) || 0)));
      overlay.setAttribute('data-dhs-region-elapsed-ms', String(regionExportElapsedMilliseconds()));
      overlay.setAttribute('data-dhs-region-current-row-dong', String(currentRowDong || '').replace(/\D/g, '').slice(0, 4));
      overlay.setAttribute('data-dhs-region-current-cell-dong', String(currentCellDong || '').replace(/\D/g, '').slice(0, 4));
      overlay.setAttribute('data-dhs-region-current-status', String(currentPresentation.status || '').replace(/[^a-z-]/g, '').slice(0, 32));
      overlay.setAttribute('data-dhs-region-current-candidate-count', String(Math.min(999, Math.max(0, Number(currentPresentation.candidateCount || 0) || 0))));
      overlay.setAttribute('data-dhs-region-current-candidate-complete', currentCandidateComplete ? 'true' : 'false');
      overlay.setAttribute('data-dhs-region-current-group-child-expected', String(currentGroupChildExpectedCount));
      overlay.setAttribute('data-dhs-region-current-group-child-planned', String(currentGroupChildPlannedCount));
      overlay.setAttribute('data-dhs-region-current-group-child-resolved', String(currentGroupChildResolvedCount));
      overlay.setAttribute('data-dhs-region-current-group-child-complete', currentGroupChildComplete ? 'true' : 'false');
      overlay.setAttribute('data-dhs-region-current-group-child-observed', String(currentGroupChildObservedCount));
      overlay.setAttribute('data-dhs-region-current-group-child-reason', currentGroupChildPlanReason);
      overlay.setAttribute('data-dhs-region-current-has-evidence', currentPresentation.hasEvidence === true ? 'true' : 'false');
      overlay.setAttribute('data-dhs-region-current-presentation-fingerprint', /^presentation:[a-f0-9]{8}$/.test(currentPresentationFingerprint) ? currentPresentationFingerprint : '');
      overlay.setAttribute('data-dhs-region-current-row-elapsed-ms', String(currentRowElapsedMs));
      overlay.setAttribute('data-dhs-region-current-settlement-blockers', currentSettlementBlockers);
      overlay.setAttribute('data-dhs-region-current-candidate-settled', state.regionExportCandidateSettled === true ? 'true' : 'false');
      overlay.setAttribute(
        'data-dhs-region-current-completion-reason',
        REGION_EXPORT_COMPLETION_REASONS.includes(String(state.regionExportCandidateCompletionReason || ''))
          ? String(state.regionExportCandidateCompletionReason)
          : 'idle'
      );
      overlay.setAttribute('data-dhs-region-candidate-early-exit-count', String(Math.min(9999, Math.max(0, Number(state.regionExportCandidateEarlyExitCount || 0) || 0))));
      overlay.setAttribute(
        'data-dhs-region-current-identity-fingerprint',
        /^identity:[a-f0-9]{16}$/.test(String(state.regionExportCurrentRow && state.regionExportCurrentRow.listingContextFingerprint || ''))
          ? String(state.regionExportCurrentRow.listingContextFingerprint)
          : ''
      );
      overlay.setAttribute(
        'data-dhs-region-current-expected-identity-fingerprint',
        /^identity:[a-f0-9]{16}$/.test(String(state.regionExportCurrentRow && state.regionExportCurrentRow.listingContextExpectedFingerprint || ''))
          ? String(state.regionExportCurrentRow.listingContextExpectedFingerprint)
          : ''
      );
      overlay.setAttribute(
        'data-dhs-region-current-identity-matched',
        state.regionExportCurrentRow && state.regionExportCurrentRow.listingContextMatched === true ? 'true' : 'false'
      );
      overlay.setAttribute(
        'data-dhs-region-current-identity-mismatch',
        (Array.isArray(state.regionExportCurrentRow && state.regionExportCurrentRow.listingContextMismatchFields)
          ? state.regionExportCurrentRow.listingContextMismatchFields
          : [])
          .map((value) => String(value || '').replace(/[^a-z-]/g, '').slice(0, 32))
          .filter(Boolean)
          .slice(0, 12)
          .join(',')
      );
    } else {
      overlay.removeAttribute('data-dhs-region-export');
      overlay.removeAttribute('data-dhs-region-status');
      overlay.removeAttribute('data-dhs-region-done-count');
      overlay.removeAttribute('data-dhs-region-row-count');
      overlay.removeAttribute('data-dhs-region-exact-count');
      overlay.removeAttribute('data-dhs-region-complex-target-count');
      overlay.removeAttribute('data-dhs-region-complex-done-count');
      overlay.removeAttribute('data-dhs-region-complex-failure-count');
      overlay.removeAttribute('data-dhs-region-complex-last-reason');
      overlay.removeAttribute('data-dhs-region-resumed-count');
      overlay.removeAttribute('data-dhs-region-grouped-retry-pending');
      overlay.removeAttribute('data-dhs-region-grouped-revalidated');
      overlay.removeAttribute('data-dhs-region-grouped-revalidation-ms');
      overlay.removeAttribute('data-dhs-region-grouped-retry-hint-attempts');
      overlay.removeAttribute('data-dhs-region-grouped-retry-hint-matches');
      overlay.removeAttribute('data-dhs-region-grouped-retry-hint-exacts');
      overlay.removeAttribute('data-dhs-region-grouped-parent-resolution-ms');
      overlay.removeAttribute('data-dhs-region-grouped-child-attempts');
      overlay.removeAttribute('data-dhs-region-grouped-child-clicks');
      overlay.removeAttribute('data-dhs-region-grouped-child-skipped-equivalents');
      overlay.removeAttribute('data-dhs-region-grouped-child-attempt-total');
      overlay.removeAttribute('data-dhs-region-grouped-child-click-total');
      overlay.removeAttribute('data-dhs-region-grouped-child-skipped-total');
      overlay.removeAttribute('data-dhs-region-grouped-child-rebind-misses');
      overlay.removeAttribute('data-dhs-region-grouped-child-exact-index');
      overlay.removeAttribute('data-dhs-region-grouped-child-resolution-ms');
      overlay.removeAttribute('data-dhs-region-elapsed-ms');
      overlay.removeAttribute('data-dhs-region-current-row-dong');
      overlay.removeAttribute('data-dhs-region-current-cell-dong');
      overlay.removeAttribute('data-dhs-region-current-status');
      overlay.removeAttribute('data-dhs-region-current-candidate-count');
      overlay.removeAttribute('data-dhs-region-current-candidate-complete');
      overlay.removeAttribute('data-dhs-region-current-group-child-expected');
      overlay.removeAttribute('data-dhs-region-current-group-child-planned');
      overlay.removeAttribute('data-dhs-region-current-group-child-resolved');
      overlay.removeAttribute('data-dhs-region-current-group-child-complete');
      overlay.removeAttribute('data-dhs-region-current-group-child-observed');
      overlay.removeAttribute('data-dhs-region-current-group-child-reason');
      overlay.removeAttribute('data-dhs-region-current-has-evidence');
      overlay.removeAttribute('data-dhs-region-current-presentation-fingerprint');
      overlay.removeAttribute('data-dhs-region-current-row-elapsed-ms');
      overlay.removeAttribute('data-dhs-region-current-settlement-blockers');
      overlay.removeAttribute('data-dhs-region-current-candidate-settled');
      overlay.removeAttribute('data-dhs-region-current-completion-reason');
      overlay.removeAttribute('data-dhs-region-candidate-early-exit-count');
      overlay.removeAttribute('data-dhs-region-current-identity-fingerprint');
      overlay.removeAttribute('data-dhs-region-current-expected-identity-fingerprint');
      overlay.removeAttribute('data-dhs-region-current-identity-matched');
      overlay.removeAttribute('data-dhs-region-current-identity-mismatch');
    }
    if (selectionUiActive) {
      overlay.setAttribute('data-dhs-region-selection', 'true');
      overlay.setAttribute('data-dhs-region-status', String(state.regionExportStatus));
      overlay.setAttribute('data-dhs-region-selector-ready', state.regionExportSelectorReady ? 'true' : 'false');
      overlay.setAttribute('data-dhs-region-selection-error', String(state.regionExportSelectionError || '').replace(/[^a-z-]/g, '').slice(0, 48));
    } else {
      overlay.removeAttribute('data-dhs-region-selection');
      overlay.removeAttribute('data-dhs-region-selector-ready');
      overlay.removeAttribute('data-dhs-region-selection-error');
    }
    if (view.listingTable) {
      overlay.setAttribute('data-dhs-listing-table', 'true');
    } else {
      overlay.removeAttribute('data-dhs-listing-table');
    }

    const stateNode = overlay.querySelector('.dhs-state');
    const headingNode = overlay.querySelector('.dhs-heading');
    const primaryLabelNode = overlay.querySelector('.dhs-primary-label');
    const primaryValueNode = overlay.querySelector('.dhs-primary-value');
    const helperNode = overlay.querySelector('.dhs-helper');
    const summaryNode = overlay.querySelector('.dhs-summary');
    const exportNode = overlay.querySelector('.dhs-region-export');
    const devToggleNode = overlay.querySelector('.dhs-dev-toggle');
    const devCardNode = overlay.querySelector('.dhs-dev-card');
    const gridNode = overlay.querySelector('.dhs-grid');

    if (!stateNode || !headingNode || !primaryLabelNode || !primaryValueNode || !helperNode || !summaryNode || !gridNode) return;

    headingNode.textContent = view.title;
    stateNode.textContent = view.statusLabel;
    stateNode.className = `dhs-state ${view.statusTone || 'idle'}`;
    primaryLabelNode.textContent = view.primaryLabel;
    primaryValueNode.textContent = view.primaryValue;
    helperNode.textContent = view.helperText;
    if (selectionUiActive) {
      headingNode.textContent = '\uC9C0\uC5ED \uC815\uBCF4 \uCD94\uCD9C';
      stateNode.textContent = state.regionExportStatus === 'confirming-region'
        ? '\uD655\uC778 \uD544\uC694'
        : '\uC9C0\uC5ED \uC120\uD0DD';
      stateNode.className = 'dhs-state ready';
    }
    if (exportNode) {
      exportNode.textContent = regionExportButtonLabel();
      exportNode.disabled = ['selecting-region', 'confirming-region', 'preparing', 'saving'].includes(state.regionExportStatus);
    }
    renderRegionExportSelectionFlow(overlay);
    if (devToggleNode) {
      devToggleNode.hidden = Boolean(view.hideDeveloperRows);
    }
    if (devCardNode && view.hideDeveloperRows) {
      devCardNode.hidden = true;
    }
    summaryNode.innerHTML = view.summaryRows
      .map((row) => `<span class="dhs-label">${escapeHtml(row.label)}</span><span class="dhs-value">${escapeHtml(row.value)}</span>`)
      .join('');
    gridNode.innerHTML = view.developerRows
      .map((row) => `<span class="dhs-label">${escapeHtml(row.label)}</span><span class="dhs-value">${escapeHtml(row.value)}</span>`)
      .join('');
    updateOverlayCompareSignal(overlay, view);
  }

  function compareSignalStatus(view) {
    if (!view || typeof view !== 'object') return 'idle';
    if (view.statusTone === 'ok' && exactDisplayKey(view.primaryValue)) return 'exact';
    const text = normalizeText(`${view.statusLabel || ''} ${view.primaryValue || ''}`);
    if (text.includes('\uB9E4\uBB3C \uC120\uD0DD \uD544\uC694')) return 'selection-missing';
    if (text.includes('\uD6C4\uBCF4')) return 'multiple-candidates';
    if (text.includes('\uBBF8\uD655\uC815')) return 'unresolved';
    if (text.includes('\uD655\uC778 \uC911') || text.includes('\uCC3E\uB294 \uC911')) return 'waiting';
    return 'unresolved';
  }

  function selectedListingExactForCompareSignal() {
    const row = currentListingOverlayRowForOverlay();
    const exact = normalizeText(row && row.dongHo);
    if (!row || row.dongHoStatus !== 'exact' || !exactDisplayKey(exact)) return '';
    return exact;
  }

  function selectedListingTerminalStatusForCompareSignal() {
    const row = currentListingOverlayRowForOverlay();
    const status = normalizeText(row && row.dongHoStatus);
    return ['exact', 'multiple-candidates', 'unresolved', 'context-mismatch'].includes(status) ? status : '';
  }

  function compareSignalSourceMarker() {
    if (cdpResolverFinalMatchesCurrentContext() && state.cdpResolverFinalSource) {
      return state.cdpResolverFinalSource;
    }
    if (state.providerCandidatePresent && state.providerCandidateDisplay && state.providerOpenStatus === 'captured') {
      return `provider:${state.providerCandidateFamily || state.providerCandidateSource || 'captured'}`;
    }
    if (state.groupCandidatePresent && state.groupCandidateDisplay && String(state.resolverOutcome || '').startsWith('captured-group:')) {
      return `group:${state.groupCandidateSource || 'captured'}`;
    }
    if (state.landLineCandidatePresent && state.landLineCandidateDisplay && state.landLineCandidateCertainty === 'LAND_LINE') {
      return `land-line:${state.landLineCandidateSource || 'captured'}`;
    }
    if (state.officialExactCandidatePresent && state.officialExactCandidateDisplay && state.resolverOutcome === 'official-table-exact') {
      return 'official-table';
    }
    return currentSearchRoute();
  }

  function sanitizeCompareToken(value, fallback) {
    const token = String(value || '').replace(/[^A-Za-z0-9_.:-]/g, '-').replace(/-+/g, '-').slice(0, 80);
    return token || fallback || 'none';
  }

  function exactDisplayPayload(value) {
    const display = normalizeText(value).slice(0, 80);
    if (!display) return '';
    try {
      const encoded = btoa(unescape(encodeURIComponent(display)));
      return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '').slice(0, 220);
    } catch (_) {
      return '';
    }
  }

  function ensureOverlayCompareSignal(overlay) {
    if (!overlay || typeof overlay.querySelector !== 'function') return null;
    let node = overlay.querySelector('.dhs-compare-signal');
    if (node) return node;
    node = document.createElement('button');
    node.type = 'button';
    node.className = 'dhs-compare-signal';
    node.tabIndex = -1;
    node.textContent = 'DHS_COMPARE status=idle exactHash= source=idle branch=idle outcome=idle route=idle line=idle count=0';
    node.setAttribute('aria-label', node.textContent);
    const userCard = overlay.querySelector('.dhs-user-card') || overlay;
    userCard.appendChild(node);
    return node;
  }

  function compareSignalDiagnostics() {
    if (cdpResolverFinalMatchesCurrentContext()) {
      return {
        branch: state.cdpResolverFinalBranch || state.resolverBranch || 'idle',
        outcome: state.cdpResolverFinalOutcome || state.resolverOutcome || 'idle',
        route: state.routeSearchStatus || 'idle',
        line: state.lineInferenceStatus || 'idle',
        count: Math.min(999, Math.max(0, Number(state.cdpResolverFinalCandidateCount || 0) || 0))
      };
    }
    return {
      branch: state.resolverBranch || 'idle',
      outcome: state.resolverOutcome || 'idle',
      route: state.routeSearchStatus || 'idle',
      line: state.lineInferenceStatus || 'idle',
      count: Math.min(999, Math.max(0, Number(state.lineInferenceCandidateCount || state.groupCandidateCount || state.providerCandidateCount || 0) || 0))
    };
  }

  function setOverlayCompareSignal(overlay, status, exactHash, source, diagnostics, display) {
    const node = ensureOverlayCompareSignal(overlay);
    if (!node) return;
    const safeStatus = sanitizeCompareToken(status, 'idle');
    const safeHash = /^[a-f0-9]{10}$/.test(String(exactHash || '')) ? String(exactHash) : '';
    const safeSource = sanitizeCompareToken(source, 'none');
    const data = diagnostics && typeof diagnostics === 'object' ? diagnostics : compareSignalDiagnostics();
    const safeBranch = sanitizeCompareToken(data.branch, 'idle');
    const safeOutcome = sanitizeCompareToken(data.outcome, 'idle');
    const safeRoute = sanitizeCompareToken(data.route, 'idle');
    const safeLine = sanitizeCompareToken(data.line, 'idle');
    const safeCount = String(Math.min(999, Math.max(0, Number(data.count || 0) || 0)));
    const safeDisplay64 = safeStatus === 'exact' ? exactDisplayPayload(display) : '';
    const text = `DHS_COMPARE status=${safeStatus} exactHash=${safeHash} source=${safeSource} branch=${safeBranch} outcome=${safeOutcome} route=${safeRoute} line=${safeLine} count=${safeCount} exactDisplay64=${safeDisplay64}`;
    node.textContent = text;
    node.setAttribute('aria-label', text);
    overlay.setAttribute('data-dhs-compare-status', safeStatus);
    overlay.setAttribute('data-dhs-compare-exact-hash', safeHash);
    overlay.setAttribute('data-dhs-compare-source', safeSource);
    overlay.setAttribute('data-dhs-compare-branch', safeBranch);
    overlay.setAttribute('data-dhs-compare-outcome', safeOutcome);
    overlay.setAttribute('data-dhs-compare-route', safeRoute);
    overlay.setAttribute('data-dhs-compare-line', safeLine);
    overlay.setAttribute('data-dhs-compare-count', safeCount);
    overlay.setAttribute('data-dhs-compare-exact-display64', safeDisplay64);
  }

  function updateOverlayCompareSignal(overlay, view) {
    const selectedExact = selectedListingExactForCompareSignal();
    const selectedTerminalStatus = selectedListingTerminalStatusForCompareSignal();
    const status = selectedExact ? 'exact' : (selectedTerminalStatus || compareSignalStatus(view));
    const source = compareSignalSourceMarker();
    const display = selectedExact || (status === 'exact' ? normalizeText(view && view.primaryValue) : '');
    if (!display) {
      compareSignalDisplay = '';
      compareSignalHash = '';
      compareSignalPending = '';
      setOverlayCompareSignal(overlay, status, '', source, compareSignalDiagnostics());
      return;
    }
    if (display === compareSignalDisplay && compareSignalHash) {
      setOverlayCompareSignal(overlay, 'exact', compareSignalHash, source, compareSignalDiagnostics(), display);
      return;
    }
    compareSignalDisplay = display;
    compareSignalHash = '';
    if (compareSignalPending !== display) {
      compareSignalPending = display;
      safeExactDisplayHashAsync(display).then((hash) => {
        if (compareSignalDisplay !== display) return;
        compareSignalPending = '';
        compareSignalHash = hash || '';
        const latestOverlay = document.getElementById(OVERLAY_ID);
        if (latestOverlay) setOverlayCompareSignal(latestOverlay, hash ? 'exact' : 'unresolved', hash, compareSignalSourceMarker(), compareSignalDiagnostics(), display);
      });
    }
    setOverlayCompareSignal(overlay, 'hashing', '', source, compareSignalDiagnostics());
  }

  function currentSearchRoute() {
    if (state.cpProviderClickTargetCount > 0) return 'cp-provider-click-target';
    if (state.cpProviderEvidenceSeen || state.lastEvidenceCategory === 'cpProvider') return 'cp-provider-evidence';
    if (state.sameAddressEvidenceSeen || state.lastEvidenceCategory === 'sameAddress') return 'same-address';
    if (state.representativeEvidenceSeen || state.lastEvidenceCategory === 'representativeArticles') return 'representative';
    if (state.complexListEvidenceSeen || state.lastEvidenceCategory === 'complexList') return 'complex-list';
    if (state.complexCacheEvidenceSeen || state.lastEvidenceCategory === 'complexCache') return 'complex-cache';
    if (state.kbAliasEvidenceSeen || state.lastEvidenceCategory === 'kbAlias') return 'kb-alias';
    if (state.naverCacheEvidenceSeen || ['landprice', 'prices', 'buildingUnits', 'pyeongtype'].includes(state.lastEvidenceCategory)) return 'naver-reference';
    return 'generic';
  }

  function summarizeAutoLoopAttemptedByPhase() {
    const summary = {};
    for (const key of autoLoopAttemptedKeys) {
      const phase = String(key || '').split('|')[1] || 'unknown';
      const safePhase = phase.replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 40) || 'unknown';
      summary[safePhase] = Math.min(999, Number(summary[safePhase] || 0) + 1);
    }
    return summary;
  }

  function writeOverlayProbeDataset(overlay, currentListingOverlayRow) {
    const liveApi = window.DHS_LIVE_LOOP;
    const liveResult = liveApi && typeof liveApi.classifyLiveProbe === 'function'
      ? liveApi.classifyLiveProbe(state)
      : { status: '', reason: '' };
    const nextActions = liveApi && typeof liveApi.nextLiveActions === 'function'
      ? liveApi.nextLiveActions(liveResult)
      : [];
    // R3: reuse the decision already computed by updateAutoLoopDecision() this cycle. Fall back to a
    // fresh plan only when the probe is written outside a scan cycle (standalone renderOverlay).
    const plannedDecision = lastPlannedAutoLoopDecision
      ? lastPlannedAutoLoopDecision
      : (liveApi && typeof liveApi.planLiveAutomation === 'function'
        ? liveApi.planLiveAutomation(Object.assign({}, state, {
          autoLoopAttemptedKeys: Array.from(autoLoopAttemptedKeys),
          groupRouteTargets: groupRouteTargets()
        }), {
          nowMs: autoLoopNowMs()
        })
        : { status: '', action: '', reason: '' });
    const plannedResult = {
      status: plannedDecision && plannedDecision.status || '',
      reason: plannedDecision && plannedDecision.reason || ''
    };
    const plannedActions = liveApi && typeof liveApi.nextLiveActions === 'function'
      ? liveApi.nextLiveActions(plannedResult)
      : [];
    const probe = {
      bridgeVersion: state.bridgeVersion || '',
      manifestVersion: state.manifestVersion || '',
      pageHookVersion: state.pageHookVersion || '',
      listingAreaPresentationApiPresent: Boolean(listingAreaPresentationApi().pyeongCell),
      currentListingAreaHint: normalizeAreaValue(currentListingOverlayRow && currentListingOverlayRow.areaHint),
      currentListingPyeong: regionExportPyeongCell(currentListingOverlayRow),
      activeGroupRoutesApiPresent: activeGroupRoutesApiPresent(),
      activeGroupRoutesImportStatus: state.activeGroupRoutesImportStatus || '',
      activeGroupRoutesImportReason: state.activeGroupRoutesImportReason || '',
      articlePresent: Boolean(state.articlePresent),
      articleMarker: state.articleMarker || '',
      selectedArticleMarkerSource: state.selectedArticleMarkerSource || '',
      representativeChildContextPresent: Boolean(state.representativeChildContextPresent),
      detailPanelPresent: Boolean(state.detailPanelPresent),
      groupedListingSelectionPending: Boolean(state.groupedListingSelectionPending),
      selectedListingPresent: Boolean(state.articleMarker || state.articlePresent || state.detailContextPresent),
      detailScreenContextPresent: Boolean(state.detailScreenContextPresent),
      detailContextPresent: Boolean(state.detailContextPresent),
      detailDongToken: state.detailDongToken || '',
      detailFloorKind: state.detailFloorKind || '',
      detailFloorBand: state.detailFloorBand || '',
      detailFloorValue: Number(state.detailFloorValue || 0),
      detailTotalFloor: Number(state.detailTotalFloor || 0),
      detailTypeToken: state.detailTypeToken || '',
      detailTypeAliases: Array.isArray(state.detailTypeAliases) ? state.detailTypeAliases.slice(0, 6) : [],
      detailDirectionToken: state.detailDirectionToken || '',
      detailExclusiveSpace: Number(state.detailExclusiveSpace || 0),
      detailPyeongNo: state.detailPyeongNo || '',
      visibleDetailDongToken: state.visibleDetailDongToken || '',
      visibleDetailDealType: state.visibleDetailDealType || '',
      visibleDetailPriceToken: state.visibleDetailPriceToken || '',
      visibleDetailContextMismatch: Boolean(state.visibleDetailContextMismatch),
      recentListingContextPresent: Boolean(state.recentListingContextPresent),
      recentListingDongToken: state.recentListingDongToken || '',
      recentListingDealType: state.recentListingDealType || '',
      recentListingPriceToken: state.recentListingPriceToken || '',
      recentListingOverridesDetail: Boolean(state.recentListingOverridesDetail),
      articleDetailContextSeen: Boolean(state.articleDetailExclusiveSpace || state.articleDetailPyeongNo || state.articleDetailFloorValue || state.articleDetailTotalFloor),
      articleDetailExclusiveSpaceSeen: Boolean(state.articleDetailExclusiveSpace),
      articleDetailPyeongNoSeen: Boolean(state.articleDetailPyeongNo),
      articleDetailFloorSeen: Boolean(state.articleDetailFloorValue),
      articleDetailTotalFloorSeen: Boolean(state.articleDetailTotalFloor),
      articleDetailBuildNoSeen: Boolean(state.articleDetailBuildNo),
      articleDetailDongNoSeen: Boolean(state.articleDetailDongNo),
      detailBuildNo: state.articleDetailBuildNo || '',
      detailDongNo: state.articleDetailDongNo || '',
      detailDisplayDongToken: state.articleDetailDisplayDongToken || '',
      lineInferenceStatus: state.lineInferenceStatus || '',
      lineInferenceDisplay: state.lineInferenceDisplay || '',
      lineInferenceCandidateCount: Number(state.lineInferenceCandidateCount || 0),
      lineInferenceCandidateDisplays: Array.isArray(state.lineInferenceCandidateDisplays)
        ? state.lineInferenceCandidateDisplays.slice()
        : [],
      lineInferenceCandidateStats: Array.isArray(state.lineInferenceCandidateStats)
        ? state.lineInferenceCandidateStats.slice(0, 24)
        : [],
      lineInferenceCandidateProvenance: Array.isArray(state.lineInferenceCandidateProvenance)
        ? state.lineInferenceCandidateProvenance.slice(0, 24)
        : [],
      lineInferenceTypeGroupStats: Array.isArray(state.lineInferenceTypeGroupStats)
        ? state.lineInferenceTypeGroupStats.slice(0, 24)
        : [],
      lineInferenceCandidateGroupStats: Array.isArray(state.lineInferenceCandidateGroupStats)
        ? state.lineInferenceCandidateGroupStats.slice(0, 24)
        : [],
      lineInferenceTypeFamilyGroupStats: Array.isArray(state.lineInferenceTypeFamilyGroupStats)
        ? state.lineInferenceTypeFamilyGroupStats.slice(0, 24)
        : [],
      lineInferenceDongGroupStats: Array.isArray(state.lineInferenceDongGroupStats)
        ? state.lineInferenceDongGroupStats.slice(0, 24)
        : [],
      lineInferenceTypeToken: state.lineInferenceTypeToken || '',
      lineInferenceSource: state.lineInferenceSource || '',
      lineInferenceReason: state.lineInferenceReason || '',
      lineInferenceRowCount: Number(state.lineInferenceRowCount || 0),
      lineInferenceDongMatchCount: Number(state.lineInferenceDongMatchCount || 0),
      lineInferenceTypeMatchCount: Number(state.lineInferenceTypeMatchCount || 0),
      lineInferenceFloorMatchCount: Number(state.lineInferenceFloorMatchCount || 0),
      lineInferenceDirectionMatchCount: Number(state.lineInferenceDirectionMatchCount || 0),
      lineInferenceDirectionHeuristicMatchCount: Number(state.lineInferenceDirectionHeuristicMatchCount || 0),
      lineInferenceLandPriceAnomalyMatchCount: Number(state.lineInferenceLandPriceAnomalyMatchCount || 0),
      lineInferencePyeongNoMatchCount: Number(state.lineInferencePyeongNoMatchCount || 0),
      lineInferencePyeongNoSuppressedSingleCandidate: Boolean(state.lineInferencePyeongNoSuppressedSingleCandidate),
      lineInferencePyeongNoInputCandidateCount: Number(state.lineInferencePyeongNoInputCandidateCount || 0),
      lineInferencePyeongNoFilteredCandidateCount: Number(state.lineInferencePyeongNoFilteredCandidateCount || 0),
      lineInferenceDirectHoEvidenceCount: Number(state.lineInferenceDirectHoEvidenceCount || 0),
      pyeongTypeRouteEvent: state.pyeongTypeRouteEvent || '',
      pyeongTypeRouteStatus: Number(state.pyeongTypeRouteStatus || 0),
      pyeongTypeRouteReason: state.pyeongTypeRouteReason || '',
      pyeongTypeLineMapRowCount: Number(state.pyeongTypeLineMapRowCount || 0),
      lineMapRouteEndpoint: state.lineMapRouteEndpoint || '',
      lineMapRouteEvent: state.lineMapRouteEvent || '',
      lineMapRouteStatus: Number(state.lineMapRouteStatus || 0),
      lineMapRouteReason: state.lineMapRouteReason || '',
      lineMapRouteRowCount: Number(state.lineMapRouteRowCount || 0),
      lineMapRouteDurationMs: Number(state.lineMapRouteDurationMs || 0),
      lineMapRouteProgressSeq: Number(state.lineMapRouteProgressSeq || 0),
      lineMapRouteShapeSummary: state.lineMapRouteShapeSummary || '',
      lineMapRouteByEndpoint: Object.assign({}, state.lineMapRouteByEndpoint || {}),
      lineMapFollowupRequestCount: Number(state.lineMapFollowupRequestCount || 0),
      lineMapFollowupReason: state.lineMapFollowupReason || '',
      finFrontPriorityReason: state.finFrontPriorityReason || '',
      finFrontPriorityAttemptCount: Number(state.finFrontPriorityAttemptCount || 0),
      finFrontPriorityHitCount: Number(state.finFrontPriorityHitCount || 0),
      finFrontPriorityWaitMs: Number(state.finFrontPriorityWaitMs || 0),
      buildingUnitsExactPresent: Boolean(state.buildingUnitsExactPresent),
      buildingUnitsExactSource: state.buildingUnitsExactSource || '',
      buildingUnitsExactReason: state.buildingUnitsExactReason || '',
      buildingUnitsExactRowCount: Number(state.buildingUnitsExactRowCount || 0),
      buildingUnitsExactArticleLinkedCount: Number(state.buildingUnitsExactArticleLinkedCount || 0),
      buildingUnitsExactCandidateCount: Number(state.buildingUnitsExactCandidateCount || 0),
      buildingUnitsExactFloorValue: Number(state.buildingUnitsExactFloorValue || 0),
      buildingUnitsExactTypeToken: state.buildingUnitsExactTypeToken || '',
      landLineCandidatePresent: Boolean(state.landLineCandidatePresent),
      landLineCandidateDisplay: state.landLineCandidateDisplay || '',
      landLineCandidateCertainty: state.landLineCandidateCertainty || '',
      landLineCandidateSource: state.landLineCandidateSource || '',
      landLineProofSource: state.landLineProofSource || '',
      landLineRejectedReason: state.landLineRejectedReason || '',
      providerOpenStatus: state.providerOpenStatus || '',
      providerDirectLookupStatus: state.providerDirectLookupStatus || '',
      providerDirectLookupStep: state.providerDirectLookupStep || '',
      providerDirectLookupProviderFamily: state.providerDirectLookupProviderFamily || '',
      providerDirectLookupBodyShape: state.providerDirectLookupBodyShape || '',
      providerDirectLookupAddress2Seen: Boolean(state.providerDirectLookupAddress2Seen),
      providerDirectLookupSequenceSeen: Boolean(state.providerDirectLookupSequenceSeen),
      providerDirectLookupRedirectStatus: Number(state.providerDirectLookupRedirectStatus || 0),
      providerDirectLookupPopupStatus: Number(state.providerDirectLookupPopupStatus || 0),
      providerDirectLookupStructuredFieldSeen: Boolean(state.providerDirectLookupStructuredFieldSeen),
      providerDirectLookupStructuredFieldName: state.providerDirectLookupStructuredFieldName || '',
      providerDirectLookupStructuredFieldNames: Array.isArray(state.providerDirectLookupStructuredFieldNames) ? state.providerDirectLookupStructuredFieldNames.slice(0, 8) : [],
      providerDirectLookupStructuredFloorFieldSeen: Boolean(state.providerDirectLookupStructuredFloorFieldSeen),
      providerDirectLookupStructuredFloorFieldNames: Array.isArray(state.providerDirectLookupStructuredFloorFieldNames) ? state.providerDirectLookupStructuredFloorFieldNames.slice(0, 8) : [],
      providerDirectLookupStructuredFloorTotalFieldSeen: Boolean(state.providerDirectLookupStructuredFloorTotalFieldSeen),
      providerDirectLookupStructuredValueStatus: state.providerDirectLookupStructuredValueStatus || '',
      providerDirectLookupVisibleFragmentSeen: Boolean(state.providerDirectLookupVisibleFragmentSeen),
      providerDirectLookupVisibleFragmentStatus: state.providerDirectLookupVisibleFragmentStatus || '',
      providerDirectLookupVisibleFallbackOnly: Boolean(state.providerDirectLookupVisibleFallbackOnly),
      providerDirectLookupBrokerOfficeBlockSeen: Boolean(state.providerDirectLookupBrokerOfficeBlockSeen),
      providerDirectLookupCandidatePresent: Boolean(state.providerDirectLookupCandidatePresent),
      providerDirectLookupFloorHintPresent: Boolean(state.providerDirectLookupFloorHintPresent),
      providerDirectLookupRejectReason: state.providerDirectLookupRejectReason || '',
      providerCandidatePresent: Boolean(state.providerCandidatePresent),
      providerCandidateKind: state.providerCandidateKind || '',
      providerCandidateFamily: state.providerCandidateFamily || '',
      providerCandidateSource: state.providerCandidateSource || '',
      providerCandidateSourceLabel: state.providerCandidateSourceLabel || '',
      providerCandidateCpid: state.providerCandidateCpid || '',
      providerCandidateCertainty: state.providerCandidateCertainty || '',
      providerCandidateRank: Number(state.providerCandidateRank || 0),
      providerCandidateRejectedReason: state.providerCandidateRejectedReason || '',
      providerCandidateRejectedSource: state.providerCandidateRejectedSource || '',
      providerCandidateRejectedSourceLabel: state.providerCandidateRejectedSourceLabel || '',
      providerCandidateRejectedCpid: state.providerCandidateRejectedCpid || '',
      providerCandidateRejectedCertainty: state.providerCandidateRejectedCertainty || '',
      providerCandidateRejectedRank: Number(state.providerCandidateRejectedRank || 0),
      providerCandidateRejectedKind: state.providerCandidateRejectedKind || '',
      providerCandidateRejectedFamily: state.providerCandidateRejectedFamily || '',
      providerCandidateCount: Number(state.providerCandidateCount || 0),
      providerCandidateRejectedCount: Number(state.providerCandidateRejectedCount || 0),
      providerCandidateRankedSummary: state.providerCandidateRankedSummary || '',
      providerEvidenceTempPendingActive: Boolean(state.providerEvidenceTempPendingActive),
      providerEvidenceTempCount: Number(state.providerEvidenceTempCount || 0),
      providerEvidenceTempExactCount: Number(state.providerEvidenceTempExactCount || 0),
      providerEvidenceTempFloorCount: Number(state.providerEvidenceTempFloorCount || 0),
      providerEvidenceTempFamilies: Array.isArray(state.providerEvidenceTempFamilies) ? state.providerEvidenceTempFamilies.slice(0, 12) : [],
      providerEvidenceTempSourceSummaries: Array.isArray(state.providerEvidenceTempSourceSummaries) ? state.providerEvidenceTempSourceSummaries.slice(0, 6) : [],
      providerEvidenceTempLastObservationReason: state.providerEvidenceTempLastObservationReason || '',
      providerEvidenceTempLastObservationFamily: state.providerEvidenceTempLastObservationFamily || '',
      providerEvidenceTempLastObservationCandidatePresent: Boolean(state.providerEvidenceTempLastObservationCandidatePresent),
      providerEvidenceTempLastObservationFloorHintPresent: Boolean(state.providerEvidenceTempLastObservationFloorHintPresent),
      providerEvidenceTempClearedCandidateCount: Number(state.providerEvidenceTempClearedCandidateCount || 0),
      providerEvidenceTempClearedPendingRequest: Boolean(state.providerEvidenceTempClearedPendingRequest),
      providerEvidenceTempTargetPhase: state.providerEvidenceTempTargetPhase || '',
      providerEvidenceTempTargetIndex: Number(state.providerEvidenceTempTargetIndex || 0),
      providerEvidenceTempTargetCount: Number(state.providerEvidenceTempTargetCount || 0),
      providerEvidenceTempTargetFamily: state.providerEvidenceTempTargetFamily || '',
      providerEvidenceTempTabsCloseScheduled: Boolean(state.providerEvidenceTempTabsCloseScheduled),
      providerFloorHintPresent: Boolean(state.providerFloorHintPresent),
      providerFloorHintValue: Number(state.providerFloorHintValue || 0),
      providerFloorHintTotal: Number(state.providerFloorHintTotal || 0),
      providerFloorHintFamily: state.providerFloorHintFamily || '',
      providerFloorHintSourceLabel: state.providerFloorHintSourceLabel || '',
      providerFloorHintRejectedReason: state.providerFloorHintRejectedReason || '',
      groupFloorHintPresent: Boolean(state.groupFloorHintPresent),
      groupFloorHintValue: Number(state.groupFloorHintValue || 0),
      groupFloorHintTotal: Number(state.groupFloorHintTotal || 0),
      groupFloorHintSource: state.groupFloorHintSource || '',
      groupFloorHintCount: Number(state.groupFloorHintCount || 0),
      groupFloorHintRejectedReason: state.groupFloorHintRejectedReason || '',
      groupFloorHintGuardSeenCount: Number(state.groupFloorHintGuardSeenCount || 0),
      groupFloorHintGuardMatchedCount: Number(state.groupFloorHintGuardMatchedCount || 0),
      groupFloorHintGuardRejectByReason: Object.assign({}, state.groupFloorHintGuardRejectByReason || {}),
      groupCandidatePresent: Boolean(state.groupCandidatePresent),
      groupCandidateSource: state.groupCandidateSource || '',
      groupCandidateMarker: state.groupCandidateMarker || '',
      groupCandidateRejectedReason: state.groupCandidateRejectedReason || '',
      groupCandidateCount: Number(state.groupCandidateCount || 0),
      groupCandidateRankedSummary: state.groupCandidateRankedSummary || '',
      groupRouteStatus: state.groupRouteStatus || '',
      groupRouteSource: state.groupRouteSource || '',
      groupRouteIndex: Number(state.groupRouteIndex || 0),
      groupRouteCount: Number(state.groupRouteCount || 0),
      groupRouteCandidateCount: Number(state.groupRouteCandidateCount || 0),
      groupRouteRejectedCount: Number(state.groupRouteRejectedCount || 0),
      groupRouteLastRejectReason: state.groupRouteLastRejectReason || '',
      groupRouteProgressSeq: Number(state.groupRouteProgressSeq || 0),
      groupRouteFloorHintRawCount: Number(state.groupRouteFloorHintRawCount || 0),
      groupRouteFloorHintRawBySource: Object.assign({}, state.groupRouteFloorHintRawBySource || {}),
      groupRouteFloorHintDiagnosticBySource: Object.assign({}, state.groupRouteFloorHintDiagnosticBySource || {}),
      groupRouteFloorHintSeenCount: Number(state.groupRouteFloorHintSeenCount || 0),
      groupRouteFloorHintAcceptedCount: Number(state.groupRouteFloorHintAcceptedCount || 0),
      groupRouteFloorHintRejectedCount: Number(state.groupRouteFloorHintRejectedCount || 0),
      groupRouteFloorHintRejectByReason: Object.assign({}, state.groupRouteFloorHintRejectByReason || {}),
      groupRouteFloorHintSeenByField: Object.assign({}, state.groupRouteFloorHintSeenByField || {}),
      groupRouteShapeSummary: state.groupRouteShapeSummary || '',
      groupRouteShapeBySource: Object.assign({}, state.groupRouteShapeBySource || {}),
      providerRouteLookupRawCount: Number(state.providerRouteLookupRawCount || 0),
      providerRouteLookupMatchCount: Number(state.providerRouteLookupMatchCount || 0),
      providerRouteLookupGroupContextCount: Number(state.providerRouteLookupGroupContextCount || 0),
      providerRouteLookupRejectedCount: Number(state.providerRouteLookupRejectedCount || 0),
      providerRouteLookupAttemptedCount: Number(state.providerRouteLookupAttemptedCount || 0),
      providerRouteLookupBatchStatus: state.providerRouteLookupBatchStatus || '',
      providerRouteLookupLastSource: state.providerRouteLookupLastSource || '',
      providerRouteLookupLastRejectReason: state.providerRouteLookupLastRejectReason || '',
      providerRouteLookupBySource: Object.assign({}, state.providerRouteLookupBySource || {}),
      providerRouteLookupRejectByReason: Object.assign({}, state.providerRouteLookupRejectByReason || {}),
      providerRouteLookupRejectBySource: Object.assign({}, state.providerRouteLookupRejectBySource || {}),
      providerRouteLookupKindBySource: Object.assign({}, state.providerRouteLookupKindBySource || {}),
      providerRouteLookupFamilyBySource: Object.assign({}, state.providerRouteLookupFamilyBySource || {}),
      providerRouteLookupMatchBySource: Object.assign({}, state.providerRouteLookupMatchBySource || {}),
      providerRouteLookupAttemptLastSource: state.providerRouteLookupAttemptLastSource || '',
      providerRouteLookupAttemptLastFamily: state.providerRouteLookupAttemptLastFamily || '',
      providerRouteLookupAttemptLastKind: state.providerRouteLookupAttemptLastKind || '',
      providerRouteLookupAttemptLastMatchKind: state.providerRouteLookupAttemptLastMatchKind || '',
      autoLoopStatus: state.autoLoopStatus || '',
      autoLoopReason: state.autoLoopReason || '',
      autoLoopAction: state.autoLoopAction || '',
      autoLoopTargetPhase: state.autoLoopTargetPhase || '',
      autoLoopTargetRoute: state.autoLoopTargetRoute || '',
      autoLoopTargetIndex: Number(state.autoLoopTargetIndex || 0),
      autoLoopTargetCount: Number(state.autoLoopTargetCount || 0),
      autoLoopAttemptedCount: Number(state.autoLoopAttemptedCount || 0),
      autoLoopAttemptedByPhase: summarizeAutoLoopAttemptedByPhase(),
      plannedAutoLoopStatus: plannedDecision.status || '',
      plannedAutoLoopReason: plannedDecision.reason || '',
      plannedAutoLoopAction: plannedDecision.action || '',
      plannedAutoLoopTargetPhase: plannedDecision.targetPhase || '',
      plannedAutoLoopTargetRoute: plannedDecision.targetRoute || '',
      plannedAutoLoopTargetIndex: Number(plannedDecision.targetIndex || 0),
      plannedAutoLoopTargetCount: Number(plannedDecision.targetCount || 0),
      cpProviderEvidenceSeen: Boolean(state.cpProviderEvidenceSeen),
      sameAddressEvidenceSeen: Boolean(state.sameAddressEvidenceSeen),
      representativeEvidenceSeen: Boolean(state.representativeEvidenceSeen),
      complexListEvidenceSeen: Boolean(state.complexListEvidenceSeen),
      complexCacheEvidenceSeen: Boolean(state.complexCacheEvidenceSeen),
      kbAliasEvidenceSeen: Boolean(state.kbAliasEvidenceSeen),
      kbAliasReadiness: state.kbAliasReadiness || '',
      naverCacheEvidenceSeen: Boolean(state.naverCacheEvidenceSeen),
      officialRowsPresent: Boolean(state.officialRowsPresent),
      officialFloorRows: Number(state.officialFloorRows || 0),
      officialCandidateCells: Number(state.officialCandidateCells || 0),
      officialCandidateMode: state.officialCandidateMode || '',
      officialCandidateDisplays: Array.isArray(state.officialCandidateDisplays) ? state.officialCandidateDisplays.slice() : [],
      officialExactCandidatePresent: Boolean(state.officialExactCandidatePresent),
      officialExactCandidateDisplay: state.officialExactCandidateDisplay || '',
      networkCategoryCounts: Object.assign({}, state.networkCategoryCounts || {}),
      currentSearchRoute: currentSearchRoute(),
      liveLoopStatus: liveResult.status || '',
      liveLoopReason: liveResult.reason || '',
      nextLiveActions: nextActions,
      nextPlannedActions: plannedActions,
      resolverBranch: state.resolverBranch || '',
      resolverOutcome: state.resolverOutcome || '',
      routeSearchStatus: state.routeSearchStatus || '',
      routeSearchSignature: state.routeSearchSignature || '',
      routeSearchIdleSec: Number(state.routeSearchIdleSec || 0),
      routeSearchElapsedSec: Number(state.routeSearchElapsedSec || 0),
      cpProviderClickTargetCount: Number(state.cpProviderClickTargetCount || 0),
      cpProviderGroupTargetCount: Number(state.cpProviderGroupTargetCount || 0),
      cpProviderClickTargetStatus: state.cpProviderClickTargetStatus || '',
      cpProviderClickTargetPhase: state.cpProviderClickTargetPhase || '',
      cpProviderAttemptIndex: Number(state.cpProviderAttemptIndex || 0),
      cpProviderAttemptCount: Number(state.cpProviderAttemptCount || 0),
      cpProviderCurrentFamily: state.cpProviderCurrentFamily || '',
      providerTargetVersion: state.providerTargetVersion || '',
      cpProviderFamilies: state.cpProviderFamilies || [],
      cpParserReadiness: state.cpParserReadiness || '',
      lastEvidenceCategory: state.lastEvidenceCategory || '',
      lastEvidenceStatus: state.lastEvidenceStatus || '',
      lastEvent: state.lastEvent || '',
      confirmedExactKind: state.confirmedExactKind || '',
      confirmedExactDisplay: state.confirmedExactDisplay || '',
      confirmedExactMarker: state.confirmedExactMarker || '',
      confirmedExactClearedReason: state.confirmedExactClearedReason || '',
      selectedListingGroupKey: state.selectedListingGroupKey || '',
      regionExportStatus: state.regionExportStatus || '',
      regionExportSelectionError: state.regionExportSelectionError || '',
      regionExportLastError: state.regionExportLastError || '',
      regionExportSelectorReady: Boolean(state.regionExportSelectorReady),
      stop: Boolean(state.stop)
    };
    // R4: only touch the DOM attribute when the serialized probe actually changed. This avoids an
    // attribute-write mutation on every render tick (which the overlay MutationObserver must filter),
    // so a steady/idle state stops churning the DOM with identical diagnostic payloads.
    const serializedProbe = JSON.stringify(probe);
    if (serializedProbe !== lastSerializedProbe) {
      lastSerializedProbe = serializedProbe;
      overlay.setAttribute('data-dhs-probe', serializedProbe);
    }
  }

  function elementText(element) {
    if (!element) return '';
    return normalizeText([
      element.innerText,
      element.textContent,
      element.getAttribute && element.getAttribute('aria-label'),
      element.getAttribute && element.getAttribute('title')
    ].filter(Boolean).join(' '));
  }

  function scanListingStats() {
    const listings = Array.from(document.querySelectorAll('a.item_link'));
    const stats = listings.slice(0, 50).map((element) => classifyListingText(elementText(element)));
    const dongHoShownCount = stats.filter((item) => item.hasDong && item.hasHo).length;
    const floorKnownNoHoCount = stats.filter((item) => item.floorKind === 'exact' && !item.hasHo).length;
    const floorBandNoHoCount = stats.filter((item) => item.floorKind === 'band' && !item.hasHo).length;

    return {
      listingCount: listings.length,
      listingSampleCount: stats.length,
      dongCount: stats.filter((item) => item.hasDong).length,
      floorCount: stats.filter((item) => item.hasFloor).length,
      hoCount: stats.filter((item) => item.hasHo).length,
      dongHoShownCount,
      floorKnownNoHoCount,
      floorBandNoHoCount,
      subwayHoFalsePositiveCount: stats.filter((item) => item.hasSubwayLineHo).length,
      listingDisplayUnknownCount: Math.max(0, stats.length - dongHoShownCount - floorKnownNoHoCount - floorBandNoHoCount)
    };
  }

  function effectiveDetailFloorSignal(signal, cdpFallback) {
    const visible = signal && typeof signal === 'object' ? signal : {};
    const fallback = cdpFallback && typeof cdpFallback === 'object' ? cdpFallback : {};
    const fallbackKind = String(fallback.detailFloorKind || fallback.floorKind || 'none').toLowerCase();
    const fallbackFloor = sanitizeArticleDetailFloorValue(fallback.floorValue || fallback.detailFloorValue || 0);
    const fallbackTotal = sanitizeArticleDetailTotalFloor(fallback.totalFloor || fallback.detailTotalFloor || visible.totalFloor || 0);
    const visibleKind = String(visible.floorKind || visible.detailFloorKind || 'none').toLowerCase();

    if (fallbackKind === 'exact' && fallbackFloor > 0 && visibleKind !== 'exact') {
      const visibleBand = String(visible.floorBand || visible.detailFloorBand || '').toLowerCase();
      const visibleTotal = sanitizeArticleDetailTotalFloor(visible.totalFloor || visible.detailTotalFloor || fallbackTotal || 0);
      if (visibleKind !== 'band' || !visibleBand || !visibleTotal) {
        return {
          floorKind: 'exact',
          floorBand: '',
          floorValue: fallbackFloor,
          totalFloor: fallbackTotal || visibleTotal
        };
      }
      const range = bandRange(visibleBand, visibleTotal);
      if (range && fallbackFloor >= range[0] && fallbackFloor <= range[1]) {
        return {
          floorKind: 'exact',
          floorBand: '',
          floorValue: fallbackFloor,
          totalFloor: fallbackTotal || visibleTotal
        };
      }
    }

    return {
      floorKind: visible.floorKind || visible.detailFloorKind || 'none',
      floorBand: visible.floorBand || visible.detailFloorBand || '',
      floorValue: Number(visible.floorValue || visible.detailFloorValue || 0) || 0,
      totalFloor: Number(visible.totalFloor || visible.detailTotalFloor || 0) || 0
    };
  }

  function preferCdpDetailTypeToken(currentValue, fallbackValue, visibleAliases) {
    const current = normalizeText(currentValue).replace(/[^0-9A-Za-z]/g, '').slice(0, 12).toUpperCase();
    const fallback = normalizeText(fallbackValue).replace(/[^0-9A-Za-z]/g, '').slice(0, 12).toUpperCase();
    if (!fallback) return current;
    if (!current) return fallback;
    if (current === fallback) return current;
    const aliases = (Array.isArray(visibleAliases) ? visibleAliases : [])
      .map((value) => normalizeText(value).replace(/[^0-9A-Za-z]/g, '').slice(0, 12).toUpperCase())
      .filter(Boolean);
    if (aliases.includes(fallback)) return fallback;
    const currentNumericOnly = /^[0-9]+$/.test(current);
    const fallbackHasVariant = /[A-Z]/.test(fallback);
    if (currentNumericOnly && fallbackHasVariant) return fallback;
    return current;
  }

  function preferCdpDetailDongToken(currentValue, fallbackValue) {
    const current = extractDongToken(currentValue);
    const fallback = extractDongToken(fallbackValue);
    return fallback || current;
  }

  function scanDetailFloor() {
    const cdpFallback = cdpTargetContextFallback();
    const detailPanelText = detailText();
    // A specific LISTING's article detail is open only when the '.detail_contents.is-article'
    // container is visible. 단지 정보 renders '.detail_contents.is-complex' and a bare group
    // parent renders no detail container — both must NOT count as a tracked listing.
    const articleDetailPanelVisible = Array.from(document.querySelectorAll('.detail_contents.is-article'))
      .some(isVisibleNode);
    const detailSignal = classifyListingText(detailPanelText);
    const detailTypeToken = extractDetailTypeToken(detailPanelText);
    const detailContext = {
      detailDongToken: extractDongToken(detailPanelText),
      detailFloorKind: detailSignal.floorKind,
      detailFloorBand: detailSignal.floorBand,
      floorValue: detailSignal.floorValue,
      totalFloor: detailSignal.totalFloor,
      detailTypeToken,
      dealType: extractDealType(detailPanelText),
      priceToken: extractPriceToken(detailPanelText)
    };
    const hasDetailPanel = Boolean(detailPanelText);
    const preserveRegionExportClickContext = state.regionExportStatus === 'running'
      && Boolean(state.regionExportCurrentRow);
    const recentListingContextMaxAgeMs = preserveRegionExportClickContext
      ? Math.min(
          RECENT_LISTING_CLICK_TTL_MS,
          REGION_EXPORT_ROW_TIMEOUT_MS + REGION_EXPORT_ROW_STRONG_LOOKUP_GRACE_MS + 1000
        )
      : (hasDetailPanel ? RECENT_LISTING_TEXT_FALLBACK_MS : RECENT_LISTING_CLICK_TTL_MS);
    const recentListingText = recentClickedListingText({
      allowSnapshot: !hasDetailPanel || preserveRegionExportClickContext,
      maxAgeMs: recentListingContextMaxAgeMs,
      snapshotMaxAgeMs: preserveRegionExportClickContext
        ? recentListingContextMaxAgeMs
        : RECENT_LISTING_TEXT_FALLBACK_MS
    });
    const expandedText = expandedListingText({ allowSnapshot: !hasDetailPanel });
    const recentListingOverridesDetail = recentListingConflictsWithDetail(recentListingText, detailContext, hasDetailPanel);
    const expandedListingOverridesDetail = !recentListingOverridesDetail && recentListingConflictsWithDetail(expandedText, detailContext, hasDetailPanel);
    const overrideListingText = recentListingOverridesDetail ? recentListingText : expandedListingOverridesDetail ? expandedText : '';
    state.visibleDetailDongToken = detailContext.detailDongToken || '';
    state.visibleDetailDealType = detailContext.dealType || '';
    state.visibleDetailPriceToken = detailContext.priceToken || '';
    state.visibleDetailContextMismatch = Boolean(overrideListingText && hasDetailPanel && recentListingConflictsWithDetail(overrideListingText, detailContext, hasDetailPanel));
    state.recentListingContextPresent = Boolean(recentListingText);
    state.recentListingDongToken = extractDongToken(recentListingText);
    state.recentListingDealType = extractDealType(recentListingText);
    state.recentListingPriceToken = extractPriceToken(recentListingText);
    state.recentListingOverridesDetail = Boolean(recentListingOverridesDetail || expandedListingOverridesDetail);
    const matchedListingText = overrideListingText ? '' : matchingListingTextForDetail(detailContext);
    const fallbackListingText = overrideListingText || (matchedListingText || (hasDetailPanel ? '' : (recentListingText || selectedListingText() || urlArticleListingFallbackText())));
    const fallbackSignal = classifyListingText(fallbackListingText);
    const effectiveDetailPanelText = overrideListingText ? '' : detailPanelText;
    const effectiveHasDetailPanel = Boolean(effectiveDetailPanelText);
    const effectiveMatchedListingText = overrideListingText || matchedListingText;
    const signal = selectDetailFloorSignal(detailSignal, fallbackSignal, effectiveMatchedListingText, effectiveHasDetailPanel);
    const floorSignal = effectiveDetailFloorSignal(signal, cdpFallback);
    const text = normalizeText([effectiveDetailPanelText, fallbackListingText].filter(Boolean).join(' '));
    const fallbackTypeToken = fallbackSignal.pyeongTypeToken || extractDetailTypeToken(fallbackListingText);
    const renderedTypeToken = fallbackTypeToken || (effectiveHasDetailPanel ? detailTypeToken : '');
    const visibleTypeAliases = extractDetailTypeAliases(text, renderedTypeToken);
    const primaryTypeToken = preferCdpDetailTypeToken(renderedTypeToken, cdpFallback.detailTypeToken, visibleTypeAliases);
    const primaryDongToken = preferCdpDetailDongToken(
      extractDongToken(effectiveDetailPanelText) || extractDongToken(fallbackListingText),
      cdpFallback.detailDongToken
    );
    const detailTypeAliases = extractDetailTypeAliases(text, primaryTypeToken);
    const mergedTypeAliases = detailTypeAliases.slice(0, 6);
    cdpFallback.detailTypeAliases.forEach((alias) => {
      if (alias && !mergedTypeAliases.includes(alias) && mergedTypeAliases.length < 6) mergedTypeAliases.push(alias);
    });
    return {
      detailScreenContextPresent: Boolean(text),
      detailPanelPresent: articleDetailPanelVisible,
      detailContextPresent: Boolean(text || cdpFallback.detailDongToken || cdpFallback.detailTypeToken || cdpFallback.detailFloorKind !== 'none'),
      detailFloorKind: floorSignal.floorKind !== 'none' ? floorSignal.floorKind : cdpFallback.detailFloorKind,
      detailFloorBand: floorSignal.floorBand || cdpFallback.detailFloorBand,
      floorValue: floorSignal.floorValue || cdpFallback.floorValue,
      totalFloor: floorSignal.totalFloor || cdpFallback.totalFloor,
      detailDongToken: primaryDongToken || cdpFallback.detailDongToken,
      detailTypeToken: primaryTypeToken || cdpFallback.detailTypeToken,
      detailTypeAliases: mergedTypeAliases,
      detailDirectionToken: (effectiveHasDetailPanel ? detailSignal.directionToken : '') || fallbackSignal.directionToken || extractDirectionToken(text) || cdpFallback.detailDirectionToken,
      detailExclusiveSpace: extractExclusiveSpaceValue(text) || cdpFallback.detailExclusiveSpace,
      detailPyeongNo: extractPyeongNoToken(text) || cdpFallback.detailPyeongNo,
      dealType: extractDealType(effectiveDetailPanelText) || extractDealType(fallbackListingText) || cdpFallback.dealType,
      priceToken: extractPriceToken(effectiveDetailPanelText) || extractPriceToken(fallbackListingText) || cdpFallback.priceToken,
      providerName: cdpFallback.providerName
    };
  }

  function lineMapRowFromElement(element) {
    if (!element) return null;
    const text = elementText(element);
    const data = element.dataset || {};
    const api = window.DHS_LINE_INFERENCE;
    if (!api) return null;
    const row = {
      dongToken: data.dongToken || data.dong || data.building || extractDongToken(text),
      typeToken: data.typeToken || data.type || data.pyeongType || (typeof api.normalizeTypeToken === 'function' ? api.normalizeTypeToken(text) : ''),
      lineToken: data.lineToken || data.line || data.unitLine || (typeof api.normalizeLineToken === 'function' ? api.normalizeLineToken(text) : ''),
      directionToken: data.directionToken || data.direction || (typeof api.normalizeDirectionToken === 'function' ? api.normalizeDirectionToken(text) : ''),
      minFloor: Number(data.minFloor || data.floorMin || 0),
      maxFloor: Number(data.maxFloor || data.floorMax || 0),
      numberingScheme: data.numberingScheme || '',
      source: data.source || 'visible-line-map',
      pyeongNo: data.pyeongNo || data.ptpNo || data.pyeongTypeNo || '',
      exclusiveSpace: normalizeAreaValue(data.exclusiveSpace || data.exclusiveArea || data.excluseSpc || 0),
      totalArea: normalizeAreaValue(data.totalArea || data.supplyArea || 0)
    };
    return row.dongToken && row.typeToken && row.lineToken ? row : null;
  }

  function sanitizeLineMapRow(row) {
    const input = row && typeof row === 'object' ? row : {};
    const api = window.DHS_LINE_INFERENCE;
    if (!api) return null;
    const dongToken = typeof api.normalizeDongToken === 'function'
      ? api.normalizeDongToken(input.dongToken || input.dong || input.building || '')
      : '';
    const typeToken = typeof api.normalizeTypeToken === 'function'
      ? api.normalizeTypeToken(input.typeToken || input.type || input.pyeongType || '')
      : '';
    const lineToken = typeof api.normalizeLineToken === 'function'
      ? api.normalizeLineToken(input.lineToken || input.line || input.unitLine || '')
      : '';
    const directionToken = typeof api.normalizeDirectionToken === 'function'
      ? api.normalizeDirectionToken(input.directionToken || input.direction || input.directionName || input.directionTypeName || input.directionBaseTypeName || input.houseDirection || input.hoDirection || input.hoDir || input.dir || input.orientation || '')
      : '';
    const directHoToken = typeof api.normalizeHoToken === 'function'
      ? api.normalizeHoToken(input.directHoToken || input.directHo || input.hoToken || '')
      : '';
    const pyeongNo = extractPyeongNoToken(`pyeongNo=${input.pyeongNo || input.ptpNo || input.pyeongTypeNo || ''}`);
    const exclusiveSpace = normalizeAreaValue(input.exclusiveSpace || input.exclusiveArea || input.excluseSpc || input.realArea || input.spc2 || 0);
    const totalArea = normalizeAreaValue(input.totalArea || input.supplyArea || 0);
    if (!dongToken || !typeToken || !lineToken) return null;
    const output = {
      dongToken,
      typeToken,
      lineToken,
      floorValue: Number(input.floorValue || 0),
      minFloor: Number(input.minFloor || input.floorMin || 0),
      maxFloor: Number(input.maxFloor || input.floorMax || 0),
      numberingScheme: input.numberingScheme === 'floor-line' ? 'floor-line' : '',
      source: normalizeText(input.source || 'naver-house-number-map').slice(0, 80),
      landPriceAnomaly: Boolean(input.landPriceAnomaly)
    };
    if (directionToken) output.directionToken = directionToken;
    if (directHoToken) output.directHoToken = directHoToken;
    if (input.sourceField) output.sourceField = normalizeText(input.sourceField).slice(0, 40);
    if (pyeongNo) output.pyeongNo = pyeongNo;
    if (exclusiveSpace) output.exclusiveSpace = exclusiveSpace;
    if (totalArea) output.totalArea = totalArea;
    return output;
  }

  function lineMapEvidenceReceiptForDisplay(display) {
    const key = exactDisplayKey(display);
    return key ? Number(lineMapEvidenceReceiptByProof[key] || 0) : 0;
  }

  function addNetworkLineMapRows(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return;
    const sanitizedRows = rows.map(sanitizeLineMapRow).filter(Boolean);
    if (!sanitizedRows.length) return;
    lineMapEvidenceReceiptSequence = Math.min(Number.MAX_SAFE_INTEGER, lineMapEvidenceReceiptSequence + 1);
    const nextReceiptByProof = Object.assign({}, lineMapEvidenceReceiptByProof);
    sanitizedRows.forEach((row) => {
      const key = exactDisplayKey(`${row.dongToken || ''} ${row.directHoToken || ''}`);
      if (key) nextReceiptByProof[key] = lineMapEvidenceReceiptSequence;
    });
    lineMapEvidenceReceiptByProof = nextReceiptByProof;
    const merged = networkLineMapRows.concat(sanitizedRows);
    const seen = new Set();
    networkLineMapRows = merged.filter((row) => {
      const key = [
        row.dongToken,
        row.typeToken,
        row.lineToken,
        Number(row.floorValue || 0),
        Number(row.minFloor || 0),
        Number(row.maxFloor || 0),
        row.numberingScheme,
        row.source,
        row.directHoToken || '',
        row.directionToken || '',
        row.sourceField || '',
        row.pyeongNo || '',
        row.exclusiveSpace || '',
        row.totalArea || '',
        row.landPriceAnomaly ? 'anomaly' : ''
      ].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(-300);
  }

  function naverLineMapContextFromRequest(request) {
    const input = request && typeof request === 'object' ? request : {};
    return {
      dongToken: input.detailDongToken || state.detailDongToken || '',
      typeToken: input.detailTypeToken || state.detailTypeToken || '',
      floorValue: Number(input.detailFloorValue || state.detailFloorValue || 0) || 0,
      floorBand: input.detailFloorBand || state.detailFloorBand || '',
      totalFloor: Number(input.detailTotalFloor || state.detailTotalFloor || 0) || 0,
      exclusiveSpace: Number(input.detailExclusiveSpace || state.detailExclusiveSpace || 0) || 0,
      pyeongNo: input.detailPyeongNo || state.detailPyeongNo || '',
      detailDongToken: input.detailDongToken || state.detailDongToken || '',
      detailTypeToken: input.detailTypeToken || state.detailTypeToken || '',
      detailFloorValue: Number(input.detailFloorValue || state.detailFloorValue || 0) || 0,
      detailFloorBand: input.detailFloorBand || state.detailFloorBand || '',
      detailTotalFloor: Number(input.detailTotalFloor || state.detailTotalFloor || 0) || 0,
      detailExclusiveSpace: Number(input.detailExclusiveSpace || state.detailExclusiveSpace || 0) || 0,
      detailPyeongNo: input.detailPyeongNo || state.detailPyeongNo || '',
      detailBuildNo: input.detailBuildNo || state.articleDetailBuildNo || '',
      detailDongNo: input.detailDongNo || state.articleDetailDongNo || '',
      detailDisplayDongToken: input.detailDisplayDongToken || state.articleDetailDisplayDongToken || '',
      articleMarker: input.articleMarker || state.articleMarker || ''
    };
  }

  function addNaverLineMapRowsFromBody(body, request) {
    const api = window.DHS_NAVER_LINE_MAP;
    if (!api || typeof api.collectNaverLineMapRows !== 'function') return 0;
    const rows = api.collectNaverLineMapRows(body, naverLineMapContextFromRequest(request));
    addNetworkLineMapRows(rows);
    return Array.isArray(rows) ? rows.length : 0;
  }

  function naverLineMapShapeFromBody(body) {
    const api = window.DHS_NAVER_LINE_MAP;
    if (!api || typeof api.summarizeNaverLineMapShape !== 'function') return null;
    return api.summarizeNaverLineMapShape(body);
  }

  function resolveBuildingUnitsExactFromBody(body, endpointCategory, request) {
    if (!['landprice', 'prices', 'buildingUnits', 'pyeongtype', 'article', 'complexCache', 'finFrontApi', 'naverOther'].includes(endpointCategory)) return null;
    const api = window.DHS_BUILDING_UNITS_RESOLVER;
    if (!api || typeof api.resolveBuildingUnitsExact !== 'function') return null;
    const result = api.resolveBuildingUnitsExact(body, naverLineMapContextFromRequest(request));
    if (!result || typeof result !== 'object') return null;
    if (result.present || Number(result.rowCount || 0) > 0 || Number(result.articleLinkedCount || 0) > 0) return result;
    return null;
  }

  function sanitizeLineMapShape(shape) {
    const input = shape && typeof shape === 'object' ? shape : {};
    const safeList = (value, limit) => (Array.isArray(value) ? value : [])
      .map((item) => String(item || '').replace(/[^A-Za-z0-9_.[\]-]/g, '').slice(0, 80))
      .filter(Boolean)
      .slice(0, limit);
    return {
      rootKind: /^(empty|array|object|primitive)$/.test(String(input.rootKind || '')) ? String(input.rootKind) : '',
      objectCount: Math.min(9999, Number(input.objectCount || 0) || 0),
      arrayCount: Math.min(9999, Number(input.arrayCount || 0) || 0),
      primitiveCount: Math.min(9999, Number(input.primitiveCount || 0) || 0),
      candidateObjectCount: Math.min(9999, Number(input.candidateObjectCount || 0) || 0),
      knownKeys: safeList(input.knownKeys, 16),
      arrayPaths: safeList(input.arrayPaths, 8)
    };
  }

  function lineMapShapeSummary(shape) {
    const safe = sanitizeLineMapShape(shape);
    if (!safe.rootKind && !safe.objectCount && !safe.arrayCount) return '';
    const keys = safe.knownKeys.slice(0, 6).join(',');
    const paths = safe.arrayPaths.slice(0, 3).join(',');
    return [
      safe.rootKind || 'unknown',
      `obj:${safe.objectCount}`,
      `arr:${safe.arrayCount}`,
      `cand:${safe.candidateObjectCount}`,
      keys ? `keys:${keys}` : '',
      paths ? `paths:${paths}` : ''
    ].filter(Boolean).join(' ');
  }

  function sanitizeRouteShapeSummary(value) {
    return String(value || '').replace(/[^A-Za-z0-9_:,.\- ]/g, '').slice(0, 600);
  }

  function summarizeRouteEndpoints(statusByName, reasonByName) {
    const statusInput = statusByName && typeof statusByName === 'object' ? statusByName : {};
    const reasonInput = reasonByName && typeof reasonByName === 'object' ? reasonByName : {};
    return Object.keys(Object.assign({}, statusInput, reasonInput))
      .filter((key) => /^[A-Za-z0-9_-]{1,24}$/.test(key))
      .slice(0, 12)
      .map((key) => {
        const status = Math.max(0, Math.min(599, Number(statusInput[key] || 0) || 0));
        const reason = String(reasonInput[key] || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
        return [key, status || '', reason].filter(Boolean).join(':');
      })
      .filter(Boolean)
      .join(', ');
  }

  function isTrustedWindowMessage(event) {
    const origin = String(event && event.origin || '');
    return Boolean(event && event.source === window) && (!origin || origin === location.origin);
  }

  function updateLineMapRouteDiagnostics(endpointCategory, eventName, status, data) {
    if (!['pyeongtype', 'landprice', 'prices', 'buildingUnits', 'article', 'complexCache', 'finFrontApi', 'naverOther'].includes(endpointCategory)) return;
    const rowCount = Array.isArray(data.lineMapRows)
      ? data.lineMapRows.length
      : Math.max(0, Number(data.lineMapRowCount || 0) || 0);
    const shape = sanitizeLineMapShape(data.lineMapShape);
    const groupShapeSummary = sanitizeRouteShapeSummary(data.groupRouteShapeSummary);
    const routeInfo = {
      endpoint: endpointCategory,
      event: eventName,
      status,
      reason: String(data.routeReason || data.reason || '').slice(0, 80),
      rowCount: Math.min(999, rowCount),
      durationMs: Math.min(999999, Number(data.durationMs || 0) || 0),
      shapeSummary: lineMapShapeSummary(shape) || groupShapeSummary,
      endpointSummary: sanitizeRouteShapeSummary(data.endpointSummary)
    };
    state.lineMapRouteEndpoint = routeInfo.endpoint;
    state.lineMapRouteEvent = routeInfo.event;
    state.lineMapRouteStatus = routeInfo.status;
    state.lineMapRouteReason = routeInfo.reason;
    state.lineMapRouteRowCount = routeInfo.rowCount;
    state.lineMapRouteDurationMs = routeInfo.durationMs;
    state.lineMapRouteShapeSummary = routeInfo.shapeSummary;
    state.lineMapRouteProgressSeq = Math.min(9999, Number(state.lineMapRouteProgressSeq || 0) + 1);
    const next = Object.assign({}, state.lineMapRouteByEndpoint || {});
    next[endpointCategory] = routeInfo;
    state.lineMapRouteByEndpoint = next;
  }

  function listingLineMapRows() {
    const api = window.DHS_LINE_INFERENCE;
    if (!api || typeof api.normalizeLineToken !== 'function') return [];
    const roots = selectedListingRoots()
      .concat(Array.from(document.querySelectorAll('a.item_link')).slice(0, 50))
      .filter((element, index, list) => element && list.indexOf(element) === index);
    return roots
      .map((element) => {
        const text = elementText(element);
        const signal = classifyListingText(text);
        const lineToken = api.normalizeLineToken(signal.unitLineHint || '');
        const dongToken = extractDongToken(text);
        const typeToken = signal.pyeongTypeToken || extractDetailTypeToken(text);
        if (!dongToken || !typeToken || !lineToken) return null;
        const row = {
          dongToken,
          typeToken,
          lineToken,
          numberingScheme: 'floor-line',
          source: 'listing-line-hint'
        };
        if (signal.floorKind === 'exact' && Number(signal.floorValue || 0) > 0) {
          row.floorValue = Number(signal.floorValue || 0);
        } else if (signal.floorKind === 'band' && signal.floorBand && Number(signal.totalFloor || 0) > 0) {
          const range = bandRange(signal.floorBand, signal.totalFloor);
          if (range) {
            row.minFloor = range[0];
            row.maxFloor = range[1];
          }
        }
        return row;
      })
      .filter(Boolean)
      .slice(0, 100);
  }

  function collectLineMapRows() {
    const injected = Array.isArray(window.DHS_ANYTHING_LINE_MAP_ROWS)
      ? window.DHS_ANYTHING_LINE_MAP_ROWS
      : [];
    const domRows = Array.from(document.querySelectorAll([
      '[data-dhs-line-map-row]',
      '[data-dong-token][data-line-token]',
      '[data-dhs-line-map] [data-line-token]',
      '[data-unit-line]'
    ].join(',')))
      .slice(0, 200)
      .map(lineMapRowFromElement)
      .filter(Boolean);
    const listingRows = listingLineMapRows();
    return injected.concat(networkLineMapRows, domRows, listingRows).slice(0, 500);
  }

  function resetLineInference(status, typeToken) {
    state.lineInferenceStatus = status || '';
    state.lineInferenceDisplay = '';
    state.lineInferenceCandidateCount = 0;
    state.lineInferenceCandidateDisplays = [];
    state.lineInferenceCandidateStats = [];
    state.lineInferenceCandidateProvenance = [];
    state.lineInferenceTypeGroupStats = [];
    state.lineInferenceCandidateGroupStats = [];
    state.lineInferenceTypeFamilyGroupStats = [];
    state.lineInferenceDongGroupStats = [];
    state.lineInferenceTypeToken = typeToken || '';
    state.lineInferenceSource = '';
    state.lineInferenceReason = status || '';
    state.lineInferenceRowCount = 0;
    state.lineInferenceDongMatchCount = 0;
    state.lineInferenceTypeMatchCount = 0;
    state.lineInferenceFloorMatchCount = 0;
    state.lineInferenceDirectionMatchCount = 0;
    state.lineInferenceDirectionHeuristicMatchCount = 0;
    state.lineInferenceLandPriceAnomalyMatchCount = 0;
    state.lineInferencePyeongNoMatchCount = 0;
    state.lineInferencePyeongNoSuppressedSingleCandidate = false;
    state.lineInferencePyeongNoInputCandidateCount = 0;
    state.lineInferencePyeongNoFilteredCandidateCount = 0;
    state.lineInferenceDirectHoEvidenceCount = 0;
    resetLandLinePromotion(status || 'line-candidate-not-unique');
  }

  function resetLandLinePromotion(reason) {
    state.landLineCandidatePresent = false;
    state.landLineCandidateDisplay = '';
    state.landLineCandidateCertainty = '';
    state.landLineCandidateSource = '';
    state.landLineProofSource = '';
    state.landLineRejectedReason = reason || '';
  }

  function providerRouteLookupCandidatePending() {
    const routeCandidateStored = state.providerRouteLookupBatchStatus === 'candidate-stored';
    const directLookupCandidatePending = state.providerDirectLookupStatus === 'candidate'
      && state.providerDirectLookupCandidatePresent;
    return (routeCandidateStored || directLookupCandidatePending)
      && !state.providerCandidatePresent
      && !state.buildingUnitsExactPresent;
  }

  function resetBuildingUnitsExact(reason) {
    state.buildingUnitsExactPresent = false;
    state.buildingUnitsExactDisplay = '';
    state.buildingUnitsExactSource = '';
    state.buildingUnitsExactReason = reason || '';
    state.buildingUnitsExactRowCount = 0;
    state.buildingUnitsExactArticleLinkedCount = 0;
    state.buildingUnitsExactCandidateCount = 0;
    state.buildingUnitsExactFloorValue = 0;
    state.buildingUnitsExactTypeToken = '';
  }

  function sanitizeBuildingUnitsExact(input) {
    if (!input || typeof input !== 'object') return null;
    const display = sanitizeProviderDongHoDisplay(input.displayCandidate || '');
    const source = String(input.source || '');
    const reason = String(input.reason || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
    const typeToken = String(input.typeToken || '').replace(/[^0-9A-Za-z]/g, '').slice(0, 16).toUpperCase();
    return {
      present: Boolean(input.present && display && source === 'building-units-article-linked'),
      display,
      source: source === 'building-units-article-linked' ? source : '',
      reason,
      rowCount: Math.min(999, Number(input.rowCount || 0) || 0),
      articleLinkedCount: Math.min(999, Number(input.articleLinkedCount || 0) || 0),
      candidateCount: Math.min(999, Number(input.candidateCount || 0) || 0),
      floorValue: Math.min(99, Number(input.floorValue || 0) || 0),
      typeToken
    };
  }

  function applyBuildingUnitsExact(input) {
    const result = sanitizeBuildingUnitsExact(input);
    if (!result) return;
    if (state.buildingUnitsExactPresent && !result.present) {
      state.buildingUnitsExactRowCount = Math.max(Number(state.buildingUnitsExactRowCount || 0), result.rowCount);
      state.buildingUnitsExactArticleLinkedCount = Math.max(Number(state.buildingUnitsExactArticleLinkedCount || 0), result.articleLinkedCount);
      state.buildingUnitsExactCandidateCount = Math.max(Number(state.buildingUnitsExactCandidateCount || 0), result.candidateCount);
      return;
    }
    state.buildingUnitsExactPresent = result.present;
    state.buildingUnitsExactDisplay = result.present ? result.display : '';
    state.buildingUnitsExactSource = result.source || 'building-units-article-linked';
    state.buildingUnitsExactReason = result.reason || (result.present ? 'article-linked-unit-single' : 'not-resolved');
    state.buildingUnitsExactRowCount = result.rowCount;
    state.buildingUnitsExactArticleLinkedCount = result.articleLinkedCount;
    state.buildingUnitsExactCandidateCount = result.candidateCount;
    state.buildingUnitsExactFloorValue = result.floorValue;
    state.buildingUnitsExactTypeToken = result.typeToken;
    if (result.present && currentListingExactResolution(result.display).dongHoStatus === 'exact') {
      markExactEvidenceReceipt('line', [
        state.articleMarker,
        result.source,
        result.display,
        evidenceObjectReceiptId(input)
      ].join('|'));
    }
  }

  function sanitizeLineGroupStats(items) {
    return (Array.isArray(items) ? items : []).slice(0, 24).map((item) => ({
      typeToken: String(item && item.typeToken || '').replace(/[^0-9A-Za-z]/g, '').slice(0, 16).toUpperCase(),
      lineNo: Number(item && item.lineNo || 0) || 0,
      count: Math.min(999, Number(item && item.count || 0) || 0),
      floorMin: Math.min(99, Number(item && item.floorMin || 0) || 0),
      floorMax: Math.min(99, Number(item && item.floorMax || 0) || 0),
      source: String(item && item.source || '').replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 40),
      directHo: Boolean(item && item.directHo),
      landPriceAnomaly: Boolean(item && item.landPriceAnomaly),
      directionToken: String(item && item.directionToken || '').replace(/[^\uAC00-\uD7AF]/g, '').slice(0, 8)
    })).filter((item) => item.lineNo > 0 && item.count > 0);
  }

  function sanitizeStringList(items, pattern, limit, itemLimit) {
    return (Array.isArray(items) ? items : [])
      .map((item) => String(item || '').trim())
      .map((item) => pattern ? item.replace(pattern, '') : item)
      .filter(Boolean)
      .slice(0, limit || 8)
      .map((item) => item.slice(0, itemLimit || 40));
  }

  function sanitizeLineCandidateProvenance(items) {
    return (Array.isArray(items) ? items : []).slice(0, 24).map((item) => ({
      displayCandidate: sanitizeProviderDongHoDisplay(item && item.displayCandidate || ''),
      sourceFamily: String(item && item.sourceFamily || '').replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 40),
      sourceRoute: String(item && item.sourceRoute || '').replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 64),
      sourceField: String(item && item.sourceField || '').replace(/[^A-Za-z0-9_.:/+-]/g, '').slice(0, 48),
      articleBinding: String(item && item.articleBinding || '').replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 48),
      finalEligible: Boolean(item && item.finalEligible),
      finalBlocker: String(item && item.finalBlocker || '').replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 64),
      guardsPassed: sanitizeStringList(item && item.guardsPassed, /[^A-Za-z0-9_.:-]/g, 12, 40),
      guardsMissing: sanitizeStringList(item && item.guardsMissing, /[^A-Za-z0-9_.:-]/g, 12, 40),
      floorValue: Number(item && item.floorValue || 0) || 0,
      lineNo: Number(item && item.lineNo || 0) || 0,
      typeToken: String(item && item.typeToken || '').replace(/[^0-9A-Za-z]/g, '').slice(0, 16),
      directHo: Boolean(item && item.directHo),
      landPriceAnomaly: Boolean(item && item.landPriceAnomaly)
    })).filter((item) => item.displayCandidate || item.lineNo > 0 || item.sourceRoute);
  }

  function sanitizeSmallCountMap(input, keyLimit) {
    const output = {};
    const source = input && typeof input === 'object' ? input : {};
    for (const [key, value] of Object.entries(source).slice(0, 16)) {
      const safeKey = String(key || '').replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, keyLimit || 40);
      const count = Math.min(999, Math.max(0, Number(value || 0) || 0));
      if (safeKey && count > 0) output[safeKey] = count;
    }
    return output;
  }

  function sanitizeGroupFloorHintDiagnostics(input) {
    const data = input && typeof input === 'object' ? input : {};
    return {
      source: safeGroupCandidateSource(data.source) || '',
      seenCount: Math.min(999, Math.max(0, Number(data.seenCount || 0) || 0)),
      acceptedCount: Math.min(999, Math.max(0, Number(data.acceptedCount || 0) || 0)),
      rejectedCount: Math.min(999, Math.max(0, Number(data.rejectedCount || 0) || 0)),
      byReason: sanitizeSmallCountMap(data.byReason, 40),
      byField: sanitizeSmallCountMap(data.byField, 40)
    };
  }

  function mergeGroupFloorHintDiagnostics(diagnostics, source) {
    const clean = sanitizeGroupFloorHintDiagnostics(Object.assign({}, diagnostics || {}, {
      source: diagnostics && diagnostics.source || source || ''
    }));
    if (!clean.source && clean.seenCount < 1 && clean.acceptedCount < 1 && clean.rejectedCount < 1) return;
    if (clean.source) {
      state.groupRouteFloorHintDiagnosticBySource = Object.assign({}, state.groupRouteFloorHintDiagnosticBySource || {}, {
        [clean.source]: clean
      });
    }
    const all = Object.values(state.groupRouteFloorHintDiagnosticBySource || {});
    state.groupRouteFloorHintSeenCount = Math.min(999, all.reduce((sum, item) => sum + Number(item && item.seenCount || 0), 0));
    state.groupRouteFloorHintAcceptedCount = Math.min(999, all.reduce((sum, item) => sum + Number(item && item.acceptedCount || 0), 0));
    state.groupRouteFloorHintRejectedCount = Math.min(999, all.reduce((sum, item) => sum + Number(item && item.rejectedCount || 0), 0));
    const byReason = {};
    const byField = {};
    for (const item of all) {
      for (const [key, value] of Object.entries(item && item.byReason || {})) byReason[key] = Math.min(999, (byReason[key] || 0) + Number(value || 0));
      for (const [key, value] of Object.entries(item && item.byField || {})) byField[key] = Math.min(999, (byField[key] || 0) + Number(value || 0));
    }
    state.groupRouteFloorHintRejectByReason = byReason;
    state.groupRouteFloorHintSeenByField = byField;
  }

  function updateLineInference(detailFloor) {
    const api = window.DHS_LINE_INFERENCE;
    const typeTokens = detailTypeTokenList(detailFloor);
    const typeToken = typeTokens[0] || '';
    if (!api || typeof api.buildLineInference !== 'function') {
      resetLineInference('', typeToken);
      return;
    }
    const effectiveFloor = effectiveLineInferenceFloor(detailFloor);
    const lineMapRows = collectLineMapRows();
    const resultRank = (result) => {
      const status = String(result && result.status || '');
      if (status === 'single-estimated') return 500;
      if (status === 'multiple-candidates') return 400;
      if (status === 'line-only') return 300;
      if (Number(result && result.floorMatchCount || 0) > 0) return 200;
      if (Number(result && result.typeMatchCount || 0) > 0) return 100;
      return 0;
    };
    const candidateResults = (typeTokens.length ? typeTokens : [typeToken]).map((candidateType, index) => Object.assign(api.buildLineInference({
      context: {
        dongToken: detailFloor.detailDongToken,
        floorValue: effectiveFloor.floorValue,
        floorBand: detailFloor.detailFloorBand,
        totalFloor: detailFloor.totalFloor,
        typeToken: candidateType,
        directionToken: detailFloor.detailDirectionToken || '',
        exclusiveSpace: detailFloor.detailExclusiveSpace,
        pyeongNo: detailFloor.detailPyeongNo
      },
      lineMapRows
    }), {
      aliasTypeToken: candidateType,
      aliasOrder: index
    }));
    const result = candidateResults.reduce((best, candidate) => {
      const bestRank = resultRank(best);
      const candidateRank = resultRank(candidate);
      if (candidateRank !== bestRank) return candidateRank > bestRank ? candidate : best;
      const bestCount = Number(best && best.candidateCount || 0);
      const candidateCount = Number(candidate && candidate.candidateCount || 0);
      if (candidateRank >= 400 && candidateCount && bestCount && candidateCount !== bestCount) {
        return candidateCount < bestCount ? candidate : best;
      }
      return Number(candidate.aliasOrder || 0) < Number(best.aliasOrder || 0) ? candidate : best;
    }, candidateResults[0] || {});
    state.lineInferenceStatus = result.status || '';
    state.lineInferenceDisplay = result.displayCandidate || '';
    state.lineInferenceCandidateCount = Number(result.candidateCount || 0);
    state.lineInferenceCandidateDisplays = Array.isArray(result.candidateDisplays)
      ? result.candidateDisplays.slice()
      : [];
    state.lineInferenceCandidateStats = Array.isArray(result.candidateStats)
      ? result.candidateStats.slice(0, 80).map((item) => ({
        floorValue: Number(item && item.floorValue || 0) || 0,
        lineNo: Number(item && item.lineNo || 0) || 0,
        typeToken: String(item && item.typeToken || '').slice(0, 16),
        source: String(item && item.source || '').slice(0, 40),
        sourceField: String(item && item.sourceField || '').slice(0, 40),
        directHo: Boolean(item && item.directHo),
        landPriceAnomaly: Boolean(item && item.landPriceAnomaly)
      }))
      : [];
    state.lineInferenceCandidateProvenance = sanitizeLineCandidateProvenance(result.candidateProvenance);
    state.lineInferenceTypeGroupStats = sanitizeLineGroupStats(result.typeGroupStats);
    state.lineInferenceCandidateGroupStats = sanitizeLineGroupStats(result.candidateGroupStats);
    state.lineInferenceTypeFamilyGroupStats = sanitizeLineGroupStats(result.typeFamilyGroupStats);
    state.lineInferenceDongGroupStats = sanitizeLineGroupStats(result.dongGroupStats);
    state.lineInferenceTypeToken = result.typeToken || result.aliasTypeToken || typeToken || '';
    state.lineInferenceSource = result.candidateCount > 0
      ? (effectiveFloor.source === 'provider-floor-hint' ? '제공처 정확층 단서 + 공개 평형·라인표' : '공개 평형·라인표')
      : '';
    state.lineInferenceReason = result.reason || '';
    state.lineInferenceRowCount = Number(result.rowCount || 0);
    state.lineInferenceDongMatchCount = Number(result.dongMatchCount || 0);
    state.lineInferenceTypeMatchCount = Number(result.typeMatchCount || 0);
    state.lineInferenceFloorMatchCount = Number(result.floorMatchCount || 0);
    state.lineInferenceDirectionMatchCount = Number(result.directionMatchCount || 0);
    state.lineInferenceDirectionHeuristicMatchCount = Number(result.directionHeuristicMatchCount || 0);
    state.lineInferenceLandPriceAnomalyMatchCount = Number(result.landPriceAnomalyMatchCount || 0);
    state.lineInferencePyeongNoMatchCount = Number(result.pyeongNoMatchCount || 0);
    state.lineInferencePyeongNoSuppressedSingleCandidate = Boolean(result.pyeongNoSuppressedSingleCandidate);
    state.lineInferencePyeongNoInputCandidateCount = Number(result.pyeongNoInputCandidateCount || 0);
    state.lineInferencePyeongNoFilteredCandidateCount = Number(result.pyeongNoFilteredCandidateCount || 0);
    state.lineInferenceDirectHoEvidenceCount = Number(result.directHoEvidenceCount || 0);
  }

  function updateLandLinePromotion() {
    const api = window.DHS_LAND_LINE_PROMOTION;
    if (!api || typeof api.promoteLandLineCandidate !== 'function') {
      resetLandLinePromotion('missing-promoter');
      return { present: false, reason: 'missing-promoter' };
    }
    if (providerRouteLookupCandidatePending()) {
      resetLandLinePromotion('provider-candidate-pending');
      return { present: false, reason: 'provider-candidate-pending' };
    }
    const result = api.promoteLandLineCandidate({
      lineInferenceStatus: state.lineInferenceStatus,
      lineInferenceReason: state.lineInferenceReason,
      lineInferenceDisplay: state.lineInferenceDisplay,
      lineInferenceCandidateCount: state.lineInferenceCandidateCount,
      lineInferenceTypeToken: state.lineInferenceTypeToken,
      lineInferenceDirectHoEvidenceCount: state.lineInferenceDirectHoEvidenceCount,
      articleMarker: state.articleMarker,
      detailDongToken: state.detailDongToken,
      detailTypeToken: state.detailTypeToken,
      detailFloorKind: state.detailFloorKind,
      detailFloorValue: state.detailFloorValue,
      detailFloorBand: state.detailFloorBand,
      detailTotalFloor: state.detailTotalFloor,
      buildingUnitsExactPresent: state.buildingUnitsExactPresent,
      buildingUnitsExactDisplay: state.buildingUnitsExactDisplay,
      buildingUnitsExactSource: state.buildingUnitsExactSource,
      sameAddressEvidenceSeen: state.sameAddressEvidenceSeen,
      representativeEvidenceSeen: state.representativeEvidenceSeen,
      complexListEvidenceSeen: state.complexListEvidenceSeen,
      complexCacheEvidenceSeen: state.complexCacheEvidenceSeen,
      providerFloorHintPresent: state.providerFloorHintPresent,
      providerFloorHintValue: state.providerFloorHintValue,
      providerFloorHintFamily: state.providerFloorHintFamily,
      providerRouteLookupRawCount: state.providerRouteLookupRawCount,
      providerRouteLookupMatchCount: state.providerRouteLookupMatchCount,
      providerRouteLookupRejectedCount: state.providerRouteLookupRejectedCount,
      groupFloorHintPresent: state.groupFloorHintPresent,
      groupFloorHintValue: state.groupFloorHintValue,
      groupFloorHintSource: state.groupFloorHintSource,
      groupRouteStatus: state.groupRouteStatus,
      groupRouteSource: state.groupRouteSource
    });
    if (!result || !result.present) {
      const reason = result && result.reason ? result.reason : 'group-proof-missing';
      resetLandLinePromotion(reason);
      return result || { present: false, reason };
    }
    state.landLineCandidatePresent = true;
    state.landLineCandidateDisplay = String(result.displayCandidate || state.lineInferenceDisplay || '');
    state.landLineCandidateCertainty = String(result.certainty || 'LAND_LINE');
    state.landLineCandidateSource = String(result.source || 'land-line-after-group');
    state.landLineProofSource = String(result.proofSource || '');
    state.landLineRejectedReason = '';
    let lineProofReceipt = lineMapEvidenceReceiptForDisplay(state.landLineCandidateDisplay);
    if (state.landLineCandidateSource === 'land-line-after-provider-floor') {
      lineProofReceipt = providerFloorEvidenceReceiptSequence;
    } else if (state.landLineCandidateSource === 'building-units-article-linked') {
      lineProofReceipt = 0;
    }
    if (
      lineProofReceipt > 0
      && currentListingExactResolution(state.landLineCandidateDisplay).dongHoStatus === 'exact'
    ) {
      markExactEvidenceReceipt('line', [
        state.articleMarker,
        state.landLineCandidateSource,
        state.landLineCandidateDisplay,
        lineProofReceipt
      ].join('|'));
    }
    return result;
  }

  function providerFloorHintMatchesDetail(detailFloor) {
    const floor = Number(state.providerFloorHintValue || 0);
    if (!state.providerFloorHintPresent || floor <= 0) return false;
    if (detailFloor.detailFloorKind === 'exact' && Number(detailFloor.floorValue || 0) > 0) {
      return Number(detailFloor.floorValue || 0) === floor;
    }
    if (detailFloor.detailFloorKind === 'band' && detailFloor.detailFloorBand && Number(detailFloor.totalFloor || 0) > 0) {
      const range = bandRange(detailFloor.detailFloorBand, detailFloor.totalFloor);
      return Boolean(range && floor >= range[0] && floor <= range[1]);
    }
    return false;
  }

  function detailFloorExactKnown(detailFloor) {
    const input = detailFloor && typeof detailFloor === 'object' ? detailFloor : {};
    const kind = String(input.detailFloorKind || input.floorKind || state.detailFloorKind || 'none');
    const floor = Number(input.floorValue || input.detailFloorValue || state.detailFloorValue || 0);
    return kind === 'exact' && floor > 0;
  }

  function effectiveLineInferenceFloor(detailFloor) {
    const directFloor = Number(detailFloor && detailFloor.floorValue || 0);
    if (detailFloor && detailFloor.detailFloorKind === 'exact' && directFloor > 0) {
      return { floorValue: directFloor, source: 'naver-detail' };
    }
    const providerFloor = Number(state.providerFloorHintValue || 0);
    if (providerFloor > 0 && providerFloorHintMatchesDetail(detailFloor || {})) {
      return { floorValue: providerFloor, source: 'provider-floor-hint' };
    }
    return { floorValue: 0, source: 'missing-floor' };
  }

  function safeGroupCandidateSource(value) {
    const source = String(value || '');
    const api = window.DHS_GROUP_CANDIDATE;
    const allowed = api && Array.isArray(api.GROUP_CANDIDATE_SOURCES)
      ? api.GROUP_CANDIDATE_SOURCES
      : ['dom-same-card', 'complex-cache-quick', 'sameAddress', 'representative-main', 'representative-main-1', 'complex-list', 'complex-cache'];
    return allowed.includes(source) ? source : '';
  }

  function groupRouteMatchesSource(rowSource, targetRoute) {
    const source = safeGroupCandidateSource(rowSource);
    const route = safeGroupCandidateSource(targetRoute);
    if (!route) return true;
    if (source === route) return true;
    return route === 'representative-main-1' && source === 'representative-main';
  }

  function groupSourceFromEndpointCategory(category) {
    if (category === 'sameAddress') return 'sameAddress';
    if (category === 'representativeArticles') return 'representative-main';
    if (category === 'complexList') return 'complex-list';
    if (category === 'complexCache') return 'complex-cache';
    return '';
  }

  function sanitizeTypeToken(value) {
    const token = normalizeText(value).toUpperCase();
    return /^[0-9]{2,3}[A-Z]{0,3}$/.test(token) ? token : '';
  }

  function sanitizeGroupDisplay(value) {
    const api = providerCandidateApi();
    const dong = api && typeof api.extractDongToken === 'function' ? api.extractDongToken(value) : extractDongToken(value);
    const ho = api && typeof api.extractHoToken === 'function' ? api.extractHoToken(value) : extractHoToken(value);
    return dong && ho ? `${dong} ${ho}` : '';
  }

  function sanitizeGroupRankedSummary(value) {
    const summary = String(value || '');
    return /^[A-Za-z0-9:-]+(?:\/[A-Za-z0-9:-]+){0,12}$/.test(summary) ? summary : '';
  }

  function sanitizeProviderRankedSummary(value) {
    const summary = String(value || '');
    return /^[A-Za-z0-9:_-]+(?:\/[A-Za-z0-9:_-]+){0,12}$/.test(summary) ? summary : '';
  }

  function groupCandidateEvidenceProofKey(source, display, articleMarker) {
    const safeSource = safeGroupCandidateSource(source);
    const exactKey = exactDisplayKey(display);
    const marker = sanitizeArticleMarker(articleMarker);
    return safeSource && exactKey && marker ? `${safeSource}|${exactKey}|${marker}` : '';
  }

  function addGroupCandidateRows(rows, endpointCategory) {
    const fallbackSource = groupSourceFromEndpointCategory(endpointCategory);
    const nextRows = [];
    for (const row of (Array.isArray(rows) ? rows : []).slice(0, 80)) {
      const input = row && typeof row === 'object' ? row : {};
      const source = safeGroupCandidateSource(input.source) || fallbackSource;
      const displayCandidate = sanitizeGroupDisplay(input.displayCandidate || input.display || '');
      if (!source || !displayCandidate) continue;
      nextRows.push({
        source,
        displayCandidate,
        typeToken: sanitizeTypeToken(input.typeToken || ''),
        estimated: Boolean(input.estimated),
        articleMarker: sanitizeArticleMarker(input.articleMarker)
      });
    }
    if (nextRows.length === 0) return;
    groupCandidateEvidenceReceiptSequence = Math.min(
      Number.MAX_SAFE_INTEGER,
      groupCandidateEvidenceReceiptSequence + 1
    );
    const nextReceiptByProof = Object.assign({}, groupCandidateEvidenceReceiptByProof);
    nextRows.forEach((row) => {
      const proofKey = groupCandidateEvidenceProofKey(
        row.source,
        row.displayCandidate,
        row.articleMarker || state.articleMarker
      );
      if (proofKey) nextReceiptByProof[proofKey] = groupCandidateEvidenceReceiptSequence;
    });
    groupCandidateEvidenceReceiptByProof = nextReceiptByProof;
    const seen = new Set();
    groupCandidateRows = groupCandidateRows.concat(nextRows)
      .filter((row) => {
        const key = `${row.source}:${row.displayCandidate}:${row.typeToken}:${row.estimated ? 1 : 0}:${row.articleMarker || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(-200);
  }

  function groupFloorHintSourceLabel(source) {
    if (source === 'sameAddress') return '같은주소 매물';
    if (source === 'representative-main' || source === 'representative-main-1') return '대표매물 묶음';
    if (source === 'complex-list') return '단지 매물목록';
    if (source === 'complex-cache') return '네이버 단지 자료';
    return '';
  }

  function sanitizeGroupFloorHintRow(row, fallbackSource) {
    const input = row && typeof row === 'object' ? row : {};
    const source = safeGroupCandidateSource(input.source) || safeGroupCandidateSource(fallbackSource);
    const floorValue = Number(input.floorValue || 0);
    const totalFloor = Number(input.totalFloor || 0);
    if (!source || !Number.isInteger(floorValue) || floorValue < 1 || floorValue > 100) return null;
    if (totalFloor && (!Number.isInteger(totalFloor) || totalFloor < 1 || totalFloor > 150 || floorValue > totalFloor)) return null;
    return {
      source,
      dongToken: extractDongToken(input.dongToken || '') || '',
      typeToken: sanitizeTypeToken(input.typeToken || ''),
      floorValue,
      totalFloor,
      floorHintSourceField: normalizeText(input.floorHintSourceField || '').slice(0, 40),
      articleMarker: sanitizeArticleMarker(input.articleMarker),
      pyeongNo: sanitizeArticleDetailPyeongNo(input.pyeongNo || input.ptpNo || input.pyeongTypeNo || ''),
      exclusiveSpace: normalizeAreaValue(input.exclusiveSpace || input.exclusiveArea || input.excluseSpc || 0)
    };
  }

  function addGroupFloorHintRows(rows, endpointCategory) {
    const fallbackSource = groupSourceFromEndpointCategory(endpointCategory);
    const nextRows = [];
    for (const row of (Array.isArray(rows) ? rows : []).slice(0, 80)) {
      const sanitized = sanitizeGroupFloorHintRow(row, fallbackSource);
      if (sanitized) nextRows.push(sanitized);
    }
    if (nextRows.length === 0) return;
    const seen = new Set();
    groupFloorHintRows = groupFloorHintRows.concat(nextRows)
      .filter((row) => {
        const key = [
          row.source,
          row.dongToken,
          row.typeToken,
          row.floorValue,
          row.totalFloor,
          row.floorHintSourceField,
          row.pyeongNo || '',
          row.exclusiveSpace || '',
          row.articleMarker || ''
        ].join('|');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(-200);
  }

  function groupTypeTokenMatches(candidateType, contextType) {
    if (!candidateType || !contextType) return true;
    const api = window.DHS_GROUP_CANDIDATE;
    if (api && typeof api.typeTokensMatch === 'function') {
      return api.typeTokensMatch(candidateType, contextType);
    }
    return candidateType === contextType;
  }

  function detailTypeTokenList(input) {
    const data = input && typeof input === 'object' ? input : {};
    const values = [data.detailTypeToken || data.typeToken || '']
      .concat(Array.isArray(data.detailTypeAliases) ? data.detailTypeAliases : []);
    const result = [];
    values.forEach((value) => {
      const token = sanitizeTypeToken(value);
      if (token && !result.includes(token)) result.push(token);
    });
    return result.slice(0, 8);
  }

  function groupTypeTokenMatchesAny(candidateType, contextTypes) {
    if (!candidateType) return true;
    const tokens = Array.isArray(contextTypes) ? contextTypes.filter(Boolean) : [contextTypes].filter(Boolean);
    if (tokens.length < 1) return true;
    return tokens.some((token) => groupTypeTokenMatches(candidateType, token));
  }

  function groupFloorHintAreaMatches(rowArea, contextArea) {
    const row = normalizeAreaValue(rowArea);
    const context = normalizeAreaValue(contextArea);
    if (!(row > 0) || !(context > 0)) return true;
    return Math.abs(row - context) < 0.01;
  }

  function groupFloorHintPyeongNoMatches(rowPyeongNo, contextPyeongNo) {
    const row = sanitizeArticleDetailPyeongNo(rowPyeongNo || '');
    const context = sanitizeArticleDetailPyeongNo(contextPyeongNo || '');
    if (!row || !context) return true;
    return row === context;
  }

  function groupFloorHintMatchesDetail(row, detailFloor) {
    return !groupFloorHintRejectReason(row, detailFloor);
  }

  function incrementGuardReject(target, reason) {
    const key = String(reason || 'unknown').replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 40) || 'unknown';
    target[key] = Math.min(999, Number(target[key] || 0) + 1);
  }

  function groupFloorHintRejectReason(row, detailFloor) {
    const input = detailFloor || {};
    if (row.dongToken && input.detailDongToken && row.dongToken !== input.detailDongToken) return 'dong-mismatch';
    if (!groupTypeTokenMatchesAny(row.typeToken, detailTypeTokenList(input))) return 'type-mismatch';
    if (!groupFloorHintAreaMatches(row.exclusiveSpace, input.detailExclusiveSpace)) return 'area-mismatch';
    if (!groupFloorHintPyeongNoMatches(row.pyeongNo, input.detailPyeongNo)) return 'pyeong-no-mismatch';
    const expectedTotal = Number(input.totalFloor || input.detailTotalFloor || 0);
    if (expectedTotal > 0 && Number(row.totalFloor || 0) > 0 && Number(row.totalFloor || 0) !== expectedTotal) return 'total-floor-mismatch';
    const match = validateProviderFloorHint({
      floorValue: row.floorValue,
      totalFloor: row.totalFloor
    }, input);
    return match && match.accepted ? '' : (match && match.reason || 'provider-floor-mismatch');
  }

  function groupFloorHintGuardDiagnostics(rows, detailFloor) {
    const diagnostics = {
      seenCount: Math.min(999, Array.isArray(rows) ? rows.length : 0),
      matchedCount: 0,
      rejectByReason: {}
    };
    for (const row of (Array.isArray(rows) ? rows : []).slice(0, 300)) {
      const reason = groupFloorHintRejectReason(row, detailFloor);
      if (reason) incrementGuardReject(diagnostics.rejectByReason, reason);
      else diagnostics.matchedCount += 1;
    }
    diagnostics.matchedCount = Math.min(999, diagnostics.matchedCount);
    return diagnostics;
  }

  function selectGroupFloorHint(detailFloor, targetRoute) {
    const route = safeGroupCandidateSource(targetRoute);
    const routeRows = groupFloorHintRows
      .filter((row) => groupRouteMatchesSource(row.source, route));
    const diagnostics = groupFloorHintGuardDiagnostics(routeRows, detailFloor);
    const matched = routeRows.filter((row) => groupFloorHintMatchesDetail(row, detailFloor));
    if (matched.length < 1) return { present: false, reason: 'no-floor-hint', count: 0, diagnostics };
    const activeMarker = sanitizeArticleMarker(state.articleMarker || '');
    const activeArticleMatches = activeMarker
      ? matched.filter((row) => row.articleMarker === activeMarker)
      : [];
    const effectiveMatches = activeArticleMatches.length > 0 ? activeArticleMatches : matched;
    const byFloor = new Map();
    for (const row of effectiveMatches) byFloor.set(`${row.floorValue}/${row.totalFloor || 0}`, row);
    if (byFloor.size !== 1) return { present: false, reason: 'ambiguous-floor-hint', count: effectiveMatches.length, diagnostics };
    const selected = byFloor.values().next().value;
    return {
      present: true,
      row: selected,
      count: effectiveMatches.length,
      diagnostics
    };
  }

  function updateGroupFloorHint(detailFloor, targetRoute) {
    const result = selectGroupFloorHint(detailFloor, targetRoute);
    state.groupFloorHintCount = Number(result.count || 0);
    const diagnostics = result.diagnostics || {};
    state.groupFloorHintGuardSeenCount = Number(diagnostics.seenCount || 0);
    state.groupFloorHintGuardMatchedCount = Number(diagnostics.matchedCount || 0);
    state.groupFloorHintGuardRejectByReason = Object.assign({}, diagnostics.rejectByReason || {});
    if (!result.present || !result.row) {
      state.groupFloorHintPresent = false;
      state.groupFloorHintValue = 0;
      state.groupFloorHintTotal = 0;
      state.groupFloorHintSource = safeGroupCandidateSource(targetRoute) || '';
      state.groupFloorHintRejectedReason = result.reason || 'no-floor-hint';
      if (state.providerFloorHintFamily === 'group-route') resetProviderFloorHint(result.reason || 'no-floor-hint');
      return result;
    }
    const row = result.row;
    state.groupFloorHintPresent = true;
    state.groupFloorHintValue = row.floorValue;
    state.groupFloorHintTotal = row.totalFloor;
    state.groupFloorHintSource = row.source;
    state.groupFloorHintRejectedReason = '';
    state.providerFloorHintPresent = true;
    state.providerFloorHintValue = row.floorValue;
    state.providerFloorHintTotal = row.totalFloor;
    state.providerFloorHintFamily = 'group-route';
    state.providerFloorHintSourceLabel = groupFloorHintSourceLabel(row.source) || '같은매물 경로';
    state.providerFloorHintMarker = `floor:${hashMarker(`${row.source}:${row.floorValue}/${row.totalFloor || 0}`)}`;
    state.providerFloorHintRejectedReason = '';
    return result;
  }

  function listingRootsForGroupScan(detailFloor) {
    const roots = [];
    const targetApi = window.DHS_PROVIDER_TARGET;
    const context = providerTargetContext(detailFloor);
    if (targetApi && typeof targetApi.contextMatchedListingRoots === 'function') {
      roots.push(...targetApi.contextMatchedListingRoots(document, context));
    }
    roots.push(...selectedListingRoots());
    if (state.dongHoShownCount > 0) {
      roots.push(...Array.from(document.querySelectorAll('a.item_link'))
        .slice(0, 80)
        .map((link) => link.closest('.item, .item_inner, li') || link));
    }
    return Array.from(new Set(roots.filter(isVisibleNode))).slice(0, 120);
  }

  function collectDomSameCardCandidateRows(detailFloor) {
    return listingRootsForGroupScan(detailFloor)
      .map((root) => {
        const text = listingTextForSelectionRoot(root) || elementText(root);
        return {
          source: 'dom-same-card',
          displayCandidate: text,
          typeToken: extractDetailTypeToken(text) || detailFloor.detailTypeToken || '',
          estimated: false
        };
      })
      .filter((row) => sanitizeGroupDisplay(row.displayCandidate));
  }

  function collectGroupCandidateRows(detailFloor, targetRoute) {
    const route = safeGroupCandidateSource(targetRoute);
    const domRows = !route || route === 'dom-same-card'
      ? collectDomSameCardCandidateRows(detailFloor)
      : [];
    return domRows
      .concat(groupCandidateRows.filter((row) => groupRouteMatchesSource(row.source, route)))
      .slice(0, 300);
  }

  function resetGroupCandidate(reason) {
    state.groupCandidatePresent = false;
    state.groupCandidateSource = '';
    state.groupCandidateDisplay = '';
    state.groupCandidateMarker = '';
    state.groupCandidateCount = 0;
    state.groupCandidateRankedSummary = '';
    if (reason) state.groupCandidateRejectedReason = reason;
  }

  function updateGroupCandidate(detailFloor, targetRoute) {
    const api = window.DHS_GROUP_CANDIDATE;
    if (!api || typeof api.selectGroupCandidate !== 'function') {
      resetGroupCandidate('missing-validator');
      return { present: false, candidateCount: 0, reason: 'missing-validator' };
    }
    const result = api.selectGroupCandidate({
      rows: collectGroupCandidateRows(detailFloor, targetRoute),
      context: {
        articleMarker: state.articleMarker,
        detailDongToken: state.detailDongToken,
        detailFloorKind: state.detailFloorKind,
        detailFloorBand: state.detailFloorBand,
        detailFloorValue: state.detailFloorValue,
        detailTotalFloor: state.detailTotalFloor,
        detailTypeToken: state.detailTypeToken,
        detailTypeAliases: Array.isArray(state.detailTypeAliases) ? state.detailTypeAliases.slice(0, 6) : []
      }
    });
    state.groupCandidateCount = Number(result.candidateCount || 0);
    state.groupCandidateRankedSummary = sanitizeGroupRankedSummary(result.rankedSummary || '');
    if (!result.present) {
      resetGroupCandidate(result.reason || '');
      state.groupCandidateCount = Number(result.candidateCount || 0);
      state.groupCandidateRankedSummary = sanitizeGroupRankedSummary(result.rankedSummary || '');
      if (targetRoute) state.groupCandidateSource = safeGroupCandidateSource(targetRoute);
      return result;
    }
    state.groupCandidatePresent = true;
    state.groupCandidateSource = safeGroupCandidateSource(result.source);
    state.groupCandidateDisplay = sanitizeGroupDisplay(result.displayCandidate || '');
    state.groupCandidateMarker = /^candidate:[a-f0-9]{8}$/.test(result.redactedCandidate || '') ? result.redactedCandidate : '';
    state.groupCandidateRejectedReason = '';
    state.groupCandidateCount = 1;
    state.groupCandidateRankedSummary = '';
    const groupProofKey = groupCandidateEvidenceProofKey(
      state.groupCandidateSource,
      state.groupCandidateDisplay,
      state.articleMarker
    );
    const groupEvidenceReceipt = Number(groupCandidateEvidenceReceiptByProof[groupProofKey] || 0);
    if (
      groupEvidenceReceipt > 0
      && currentListingExactResolution(state.groupCandidateDisplay).dongHoStatus === 'exact'
    ) {
      markExactEvidenceReceipt('group', [
        state.articleMarker,
        state.groupCandidateMarker,
        state.groupCandidateSource,
        groupEvidenceReceipt
      ].join('|'));
    }
    return result;
  }

  function bandRange(band, totalFloor) {
    if (!band || !totalFloor) return null;
    const lowEnd = Math.ceil(totalFloor / 3);
    const midStart = lowEnd + 1;
    const midEnd = Math.ceil((totalFloor * 2) / 3);
    if (band === 'low') return [1, lowEnd];
    if (band === 'mid') return [midStart, midEnd];
    if (band === 'high') return [midEnd + 1, totalFloor];
    return null;
  }

  function rowFloorValue(row) {
    const value = row.querySelector('input')?.getAttribute('value') || '';
    return Number(value.replace(/[^0-9]/g, '')) || 0;
  }

  function unitCellsForRow(row) {
    return Array.from(row.querySelectorAll('.house_number')).filter((cell) => (
      !cell.classList.contains('is-blank') &&
      !cell.classList.contains('is-pilotis') &&
      normalizeText(cell.textContent || '').length > 0
    ));
  }

  function officialTypeNumber(detailFloor) {
    const match = String(detailFloor && detailFloor.detailTypeToken || '').match(/(\d{2,3})/);
    return match ? Number(match[1]) || 0 : 0;
  }

  function officialCellArea(text) {
    const match = normalizeText(text).match(/(\d{2,3}(?:\.\d{1,4})?)\s*(?:m2|m\u00B2|\u33A1)/i);
    const area = match ? Number(match[1]) || 0 : 0;
    return area > 0 && area < 400 ? area : 0;
  }

  function officialAreaMatchesType(area, typeNumber) {
    if (!(area > 0) || !(typeNumber > 0)) return true;
    return Math.abs(area - typeNumber) < 1 || Math.floor(area) === typeNumber || Math.ceil(area) === typeNumber;
  }

  function officialCellDisplay(cell, detailFloor) {
    const text = normalizeText(cell && (cell.textContent || (cell.getAttribute && cell.getAttribute('aria-label'))) || '');
    if (!text) return '';
    const typeNumber = officialTypeNumber(detailFloor);
    const area = officialCellArea(text);
    if (!officialAreaMatchesType(area, typeNumber)) return '';
    const exact = text.match(/(\d{1,4})\s*(?:\uB3D9|dong)\s*(\d{1,4})\s*(?:\uD638|ho)?/i);
    if (exact) return `${exact[1]}\uB3D9 ${exact[2]}\uD638`;
    const hoMatch = text.match(/(\d{1,4})\s*(?:\uD638|ho)(?![0-9a-z])/i);
    const hoDigits = hoMatch ? String(hoMatch[1] || '').replace(/[^0-9]/g, '') : text.replace(/[^0-9]/g, '');
    const dongDigits = String(detailFloor && detailFloor.detailDongToken || '').replace(/[^0-9]/g, '');
    if (!/^\d{1,4}$/.test(hoDigits) || !/^\d{1,4}$/.test(dongDigits)) return '';
    return `${dongDigits}\uB3D9 ${hoDigits}\uD638`;
  }

  function scanOfficialTable(detailFloor) {
    const table = document.querySelector('.detail_box--officialprice .house_number_table');
    if (!table) {
      return {
        officialRowsPresent: false,
        officialFloorRows: 0,
        officialCandidateCells: 0,
        officialCandidateMode: 'no-table',
        officialCandidateDisplays: [],
        officialExactCandidatePresent: false,
        officialExactCandidateDisplay: '',
        officialReceiptKey: ''
      };
    }

    if (!officialTableReceiptIds.has(table)) {
      officialTableReceiptSequence = Math.min(Number.MAX_SAFE_INTEGER, officialTableReceiptSequence + 1);
      officialTableReceiptIds.set(table, officialTableReceiptSequence);
    }

    const rows = Array.from(table.querySelectorAll('.house_floor'));
    let candidateRows = [];
    let mode = 'all-table';

    if (detailFloor.detailFloorKind === 'exact' && detailFloor.floorValue > 0) {
      candidateRows = rows.filter((row) => rowFloorValue(row) === detailFloor.floorValue);
      mode = 'exact-floor';
    } else if (detailFloor.detailFloorKind === 'band' && detailFloor.totalFloor > 0) {
      const range = bandRange(detailFloor.detailFloorBand, detailFloor.totalFloor);
      candidateRows = range ? rows.filter((row) => {
        const floor = rowFloorValue(row);
        return floor >= range[0] && floor <= range[1];
      }) : [];
      mode = `band-${detailFloor.detailFloorBand || 'unknown'}`;
    } else {
      candidateRows = rows;
    }

    const candidateDisplays = Array.from(new Set(candidateRows
      .flatMap((row) => unitCellsForRow(row).map((cell) => officialCellDisplay(cell, detailFloor)))
      .filter(Boolean)));
    const officialCandidateCells = candidateDisplays.length;
    return {
      officialRowsPresent: rows.length > 0 && rows.some((row) => unitCellsForRow(row).length > 0),
      officialFloorRows: rows.length,
      officialCandidateCells,
      officialCandidateMode: mode,
      officialCandidateDisplays: candidateDisplays,
      officialExactCandidatePresent: officialCandidateCells === 1,
      officialExactCandidateDisplay: officialCandidateCells === 1 ? candidateDisplays[0] : '',
      officialReceiptKey: `table:${officialTableReceiptIds.get(table) || 0}`
    };
  }

  function uniqueValues(values) {
    return Array.from(new Set(values.filter(Boolean))).sort();
  }

  function cpidAliasFamilies(text) {
    const cpidFamilyMap = {
      r114: 'r114',
      mk: 'mk',
      bizmk: 'mk',
      fine: 'rfine',
      rter: 'rter',
      rego: 'rter',
      rets: 'rter',
      serve: 'serve',
      ten: 'ten',
      asil: 'asil',
      neonet: 'neonet',
      hkdotcom: 'hankyung',
      kar: 'kar',
      thebiz: 'thebiz',
      industry: 'daara',
      woori: 'woori'
    };
    const result = [];
    const pattern = /\b(?:CPID|UI_CP|cpid|ui_cp)\s*[:=]\s*([A-Za-z0-9_-]{2,30})/g;
    let match;
    while ((match = pattern.exec(String(text || '')))) {
      const family = cpidFamilyMap[String(match[1] || '').toLowerCase()];
      if (family) result.push(family);
    }
    return result;
  }

  function providerFamilyFromUrl(href) {
    try {
      const hostname = new URL(String(href || ''), location.href).hostname.toLowerCase();
      const provider = CP_PROVIDER_HOSTS.find((item) => hostname === item.domain || hostname.endsWith(`.${item.domain}`));
      return provider ? provider.family : '';
    } catch (_) {
      return '';
    }
  }

  function classifyCpTextSignal(text) {
    const normalized = normalizeText(text);
    const technicalPattern = /\b(?:CPID|UI_CP|cpid|ui_cp)\b/;
    const providerPatterns = [
      { family: 'r114', pattern: /R114|r114/ },
      { family: 'mk', pattern: new RegExp('\\uB9E4\\uACBD\\uBD80\\uB3D9\\uC0B0|\\bMK\\b|\\bmk\\b') },
      { family: 'serve', pattern: new RegExp('\\uBD80\\uB3D9\\uC0B0\\uC368\\uBE0C|serve') },
      { family: 'rfine', pattern: new RegExp('\\uBD80\\uB3D9\\uC0B0\\uD3EC\\uC2A4|rfine|R-FINE|Rfine') },
      { family: 'rter', pattern: /RTER|Rter|REGO|Rego|RETS|rter|rego|rets/ },
      { family: 'asil', pattern: new RegExp('\\uC544\\uC2E4|asil|ASIL') },
      { family: 'gongsilclub', pattern: /Gongsil\s*Club|gongsilclub|\uACF5\uC2E4\uD074\uB7FD/i },
      { family: 'homesdid', pattern: new RegExp('\\uC120\\uBC29|Homes\\s*DID|homesdid', 'i') },
      { family: 'hankyung', pattern: new RegExp('\\uD55C\\uACBD|hankyung|Hankyung') },
      { family: 'daara', pattern: new RegExp('\\uB2E4\\uC544\\uB77C|daara|Daara|industryland|Industry') },
      { family: 'neonet', pattern: new RegExp('\\uBD80\\uB3D9\\uC0B0(?:\\uBC45\\uD06C|\\uB145\\uD06C)|\\uB124\\uC624\\uB137|neonet|Neonet') },
      { family: 'ten', pattern: /(?:\bTEN\b|\bTen\b|ten\.co\.kr)/ },
      { family: 'kar', pattern: new RegExp('\\uD55C\\uBC29|\\uD55C\\uAD6D\\uACF5\\uC778\\uC911\\uAC1C\\uC0AC\\uD611\\uD68C|\\bKAR\\b|karhanbang') },
      { family: 'thebiz', pattern: /TheBiz|thebiz/i },
      { family: 'kiso', pattern: /KISO|Land\s*Center|landcenter\.kiso/i },
      { family: 'woori', pattern: new RegExp('\\uC6B0\\uB9AC\\uC9D1|\\uC6B0\\uB9AC\\uD558\\uC6B0\\uC2A4|woori-house|Woori') }
    ];
    const brokerTextPattern = new RegExp([
      '\\uC911\\uAC1C\\uC0AC',
      '\\uD655\\uC778\\uB9E4\\uBB3C',
      '\\uC81C\\uACF5'
    ].join('|'));
    const providerFamilies = uniqueValues(providerPatterns
      .filter((item) => item.pattern.test(normalized))
      .map((item) => item.family)
      .concat(cpidAliasFamilies(normalized)));

    if (technicalPattern.test(normalized)) {
      return {
        present: true,
        strong: true,
        kind: 'technical-id',
        providerFamilies,
        parserReadiness: 'technical-id'
      };
    }
    if (providerFamilies.length > 0) {
      return {
        present: true,
        strong: true,
        kind: 'known-provider-name',
        providerFamilies,
        parserReadiness: 'provider-name'
      };
    }
    if (brokerTextPattern.test(normalized)) {
      return {
        present: true,
        strong: false,
        kind: 'broker-text-only',
        providerFamilies: [],
        parserReadiness: 'broker-only'
      };
    }
    return {
      present: false,
      strong: false,
      kind: 'none',
      providerFamilies: [],
      parserReadiness: 'none'
    };
  }

  function providerTargetContext(detailFloor) {
    const input = detailFloor || {};
    return {
      dongToken: input.detailDongToken || '',
      floorKind: input.detailFloorKind || '',
      floorBand: input.detailFloorBand || '',
      floorValue: Number(input.floorValue || 0),
      totalFloor: Number(input.totalFloor || 0),
      typeToken: input.detailTypeToken || '',
      typeAliases: Array.isArray(input.detailTypeAliases) ? input.detailTypeAliases.slice(0, 6) : [],
      directionToken: input.detailDirectionToken || input.directionToken || '',
      dealType: input.dealType || '',
      priceToken: input.priceToken || '',
      providerName: input.providerName || '',
      providerFamilyHint: classifyCpTextSignal(input.providerName || '').providerFamilies[0] || '',
      preferredListingRoots: selectedListingRoots().slice(0, 4)
    };
  }

  function scanProviderContext(detailFloor) {
    const root = document.querySelector('.detail_panel, .detail_contents, .detail_contents_inner') || document.body;
    const textSignal = classifyCpTextSignal(elementText(root));
    const providerLinkFamilies = Array.from(root ? root.querySelectorAll('a[href]') : [])
      .slice(0, 80)
      .map((element) => providerFamilyFromUrl(element.getAttribute('href')))
      .filter(Boolean);
    const cpClickTarget = window.DHS_PROVIDER_TARGET && window.DHS_PROVIDER_TARGET.findProviderClickTarget
      ? window.DHS_PROVIDER_TARGET.findProviderClickTarget(document, providerTargetContext(detailFloor))
      : { status: 'no-target', count: 0, target: null };
    const cpGroupTarget = window.DHS_PROVIDER_TARGET && window.DHS_PROVIDER_TARGET.findProviderClickTarget
      ? window.DHS_PROVIDER_TARGET.findProviderClickTarget(document, Object.assign({}, providerTargetContext(detailFloor), {
        providerTargetPhase: 'group-target'
      }))
      : { status: 'no-target', count: 0, target: null };
    const cpClickTargetFamilies = Array.isArray(cpClickTarget.providerFamilies)
      ? cpClickTarget.providerFamilies
      : (cpClickTarget.count > 0 && textSignal.providerFamilies[0] ? [textSignal.providerFamilies[0]] : []);
    const targetProviderHintFamilies = classifyCpTextSignal(detailFloor && detailFloor.providerName || '').providerFamilies;
    const attrTechnicalIdPresent = Array.from(root ? root.querySelectorAll('[id], [name]') : [])
      .slice(0, 200)
      .some((element) => /cpid|ui_cp/i.test(`${element.id || ''} ${element.getAttribute('name') || ''}`));
    const cpTechnicalIdPresent = textSignal.kind === 'technical-id' || attrTechnicalIdPresent;
    const parserReadiness = cpTechnicalIdPresent
      ? 'technical-id'
      : (providerLinkFamilies.length > 0
        ? 'provider-link'
        : (cpClickTarget.count > 0 ? cpClickTarget.status : textSignal.parserReadiness));

    return {
      present: textSignal.present || providerLinkFamilies.length > 0 || cpClickTarget.count > 0 || cpTechnicalIdPresent,
      strong: textSignal.strong || providerLinkFamilies.length > 0 || cpClickTarget.count > 0 || cpTechnicalIdPresent,
      kind: textSignal.kind,
      providerFamilies: uniqueValues(textSignal.providerFamilies.concat(providerLinkFamilies).concat(cpClickTargetFamilies).concat(targetProviderHintFamilies)),
      providerLinkCount: providerLinkFamilies.length,
      providerClickTargetCount: cpClickTarget.count,
      providerGroupTargetCount: cpGroupTarget.count || 0,
      providerClickTargetStatus: cpClickTarget.status || 'no-target',
      providerClickTargetPhase: cpClickTarget.phase || '',
      providerClickTargetFamily: sanitizeProviderFamily(cpClickTarget.targetProviderFamily || ''),
      providerTargetVersion: window.DHS_PROVIDER_TARGET && window.DHS_PROVIDER_TARGET.VERSION ? window.DHS_PROVIDER_TARGET.VERSION : '',
      cpTechnicalIdPresent,
      parserReadiness
    };
  }

  function activeProviderFamilies(cpSignal) {
    const preferred = [
      state.cpProviderCurrentFamily,
      state.providerDirectLookupProviderFamily,
      state.providerRouteLookupAttemptLastFamily,
      state.lastEvidenceProviderFamily,
      cpSignal && cpSignal.providerClickTargetFamily
    ].map((family) => sanitizeProviderFamily(family)).filter(Boolean);
    return preferred.length ? [preferred[0]] : uniqueValues(cpSignal.providerFamilies);
  }

  function openProviderClickTarget(expectedPhase) {
    const detailFloor = scanDetailFloor();
    const cpSignal = scanProviderContext(detailFloor);
    state.cpProviderFamilies = cpSignal.providerFamilies;
    state.cpProviderClickTargetCount = cpSignal.providerClickTargetCount;
    state.cpProviderGroupTargetCount = cpSignal.providerGroupTargetCount;
    state.cpProviderClickTargetStatus = cpSignal.providerClickTargetStatus;
    state.cpProviderClickTargetPhase = cpSignal.providerClickTargetPhase;
    const targetContext = providerTargetContext(detailFloor);
    targetContext.directProviderTargetIndex = state.cpProviderAttemptIndex || 0;
    if (expectedPhase === 'group-target') {
      targetContext.providerTargetPhase = 'group-target';
      targetContext.groupProviderTargetIndex = state.cpProviderGroupAttemptIndex || 0;
    }
    const result = window.DHS_PROVIDER_TARGET && window.DHS_PROVIDER_TARGET.findProviderClickTarget
      ? window.DHS_PROVIDER_TARGET.findProviderClickTarget(document, targetContext)
      : { status: 'no-target', count: 0, target: null };
    const phase = result.phase || '';
    if (expectedPhase && phase && phase !== expectedPhase) {
      state.providerOpenStatus = 'unverified';
      state.providerCandidateRejectedReason = 'phase-mismatch';
      state.cpProviderClickTargetStatus = 'phase-mismatch';
      state.cpProviderClickTargetPhase = phase;
      renderOverlay();
      return;
    }
    const target = result.target;
    if (!target) {
      state.providerOpenStatus = result.status || 'no-target';
      state.cpProviderClickTargetCount = result.count || 0;
      if (expectedPhase === 'group-target') state.cpProviderGroupTargetCount = result.count || 0;
      state.cpProviderClickTargetStatus = result.status || 'no-target';
      state.cpProviderClickTargetPhase = result.phase || '';
      state.cpProviderAttemptCount = result.count || 0;
      state.cpProviderCurrentFamily = '';
      renderOverlay();
      return;
    }
    state.providerOpenStatus = 'opening';
    state.cpProviderClickTargetStatus = result.status || 'ready';
    state.cpProviderClickTargetPhase = phase;
    state.cpProviderAttemptCount = phase === 'direct-provider' ? Number(result.count || 0) : 0;
    if (phase === 'group-target') state.cpProviderGroupTargetCount = Number(result.count || 0);
    state.cpProviderCurrentFamily = sanitizeProviderFamily(result.targetProviderFamily || '');
    renderOverlay();
    const directLookupResult = preferredProviderDirectLookupResult(targetContext, result);
    const dispatchResult = directLookupResult && directLookupResult.target ? directLookupResult : result;
    const dispatchTarget = dispatchResult && dispatchResult.target ? dispatchResult.target : target;
    const dispatchPhase = dispatchResult && dispatchResult.phase ? dispatchResult.phase : phase;
    const providerRequestTarget = {
      targetPhase: dispatchPhase,
      targetIndex: Number(state.cpProviderAttemptIndex || 0),
      targetCount: Number(dispatchResult.count || result.count || 0),
      targetFamily: targetProviderFamily(dispatchResult) || state.cpProviderCurrentFamily
    };
    beginProviderRequest(() => {
      runProviderDirectLookup(directLookupResult, () => {
        dispatchProviderClick(dispatchTarget, dispatchPhase, dispatchResult);
      });
    }, providerRequestTarget);
  }

  function targetProviderFamily(result) {
    return sanitizeProviderFamily(result && result.targetProviderFamily || '');
  }

  function findProviderClickTargetByFamily(targetContext, providerFamily, maxCount) {
    const family = sanitizeProviderFamily(providerFamily || '');
    const count = Math.min(Number(maxCount || 0), 20);
    if (!family || !count || !window.DHS_PROVIDER_TARGET || typeof window.DHS_PROVIDER_TARGET.findProviderClickTarget !== 'function') {
      return null;
    }
    for (let index = 0; index < count; index += 1) {
      const candidate = window.DHS_PROVIDER_TARGET.findProviderClickTarget(document, Object.assign({}, targetContext, {
        directProviderTargetIndex: index
      }));
      if (targetProviderFamily(candidate) === family) return candidate;
    }
    return null;
  }

  function preferredProviderDirectLookupResult(targetContext, result) {
    const requestedIndex = Math.floor(Number(targetContext && targetContext.directProviderTargetIndex || 0));
    const currentFamily = targetProviderFamily(result);
    const targetContextFamily = sanitizeProviderFamily(targetContext && targetContext.providerFamilyHint || '');
    const count = Math.min(Number(result && result.count || 0), 20);
    if (targetContextFamily && currentFamily !== targetContextFamily) {
      const hintedTarget = findProviderClickTargetByFamily(targetContext, targetContextFamily, count);
      if (hintedTarget) return hintedTarget;
    }
    if (currentFamily) return result;
    if (targetContextFamily) {
      return Object.assign({}, result || {}, {
        targetProviderFamily: targetContextFamily,
        providerFamilies: uniqueValues((Array.isArray(result && result.providerFamilies) ? result.providerFamilies : []).concat([targetContextFamily]))
      });
    }
    const families = uniqueValues((Array.isArray(result && result.providerFamilies) ? result.providerFamilies : [])
      .concat(Array.isArray(state.cpProviderFamilies) ? state.cpProviderFamilies : []));
    if (requestedIndex > 0 && currentFamily && state.providerDirectLookupProviderFamily === 'mk' && state.providerDirectLookupStatus === 'no-candidate') return result;
    if (requestedIndex > 0 && currentFamily && !families.includes('mk')) return result;
    if (!families.includes('mk')) return result;
    return findProviderClickTargetByFamily(targetContext, 'mk', count) || result;
  }

  function directLookupRejectReasonForFamily(family) {
    if (!family) return 'missing-provider';
    if (family === 'mk') return '';
    if (PROVIDER_FAMILIES.has(family)) return 'missing-key';
    return 'provider-not-mk';
  }

  function runProviderDirectLookup(result, fallback, options) {
    const requestGeneration = providerRequestGeneration;
    const settings = options && typeof options === 'object' ? options : {};
    const family = targetProviderFamily(result);
    const providerLookupKind = sanitizeProviderLookupKind(result && result.providerLookupKind);
    const providerLookupSequence = providerLookupKind === 'mk-sequence'
      ? sanitizeProviderLookupKey(result && result.providerLookupSequence, providerLookupKind)
      : '';
    const providerLookupRef = providerLookupKind === 'provider-url'
      ? sanitizeProviderLookupRef(result && result.providerLookupRef)
      : '';
    const providerLookupArticleMarker = providerLookupKind
      ? sanitizeArticleMarker(result && result.providerLookupArticleMarker)
      : '';
    const providerLookupGroupProof = Boolean(result && result.providerLookupGroupProof === true);
    const lookupRequest = providerLookupRequestFromUrl();
    const listingKey = providerLookupKind === 'mk-uid'
      ? sanitizeProviderLookupKey(result && result.providerLookupKey, providerLookupKind)
      : (lookupRequest.listingKey || '');
    const hasMkLookupKey = family === 'mk' && (listingKey || providerLookupSequence);
    const hasProviderLookupRef = providerLookupKind === 'provider-url' && providerLookupRef;
    if (!hasMkLookupKey && !hasProviderLookupRef) {
      const rejectReason = directLookupRejectReasonForFamily(family) || lookupRequest.rejectReason || 'missing-key';
      state.providerDirectLookupStatus = rejectReason;
      state.providerDirectLookupStep = 'prepare';
      state.providerDirectLookupProviderFamily = family;
      state.providerDirectLookupBodyShape = '';
      state.providerDirectLookupAddress2Seen = false;
      state.providerDirectLookupSequenceSeen = false;
      state.providerDirectLookupRedirectStatus = 0;
      state.providerDirectLookupPopupStatus = 0;
      state.providerDirectLookupStructuredFieldSeen = false;
      state.providerDirectLookupStructuredFieldName = '';
      state.providerDirectLookupStructuredFieldNames = [];
      state.providerDirectLookupStructuredFloorFieldSeen = false;
      state.providerDirectLookupStructuredFloorFieldNames = [];
      state.providerDirectLookupStructuredFloorTotalFieldSeen = false;
      state.providerDirectLookupStructuredValueStatus = '';
      state.providerDirectLookupVisibleFragmentSeen = false;
      state.providerDirectLookupVisibleFragmentStatus = '';
      state.providerDirectLookupVisibleFallbackOnly = false;
      state.providerDirectLookupBrokerOfficeBlockSeen = false;
      state.providerDirectLookupCandidatePresent = false;
      state.providerDirectLookupFloorHintPresent = false;
      state.providerDirectLookupRejectReason = rejectReason;
      renderOverlay();
      fallback();
      return;
    }
    state.providerOpenStatus = 'direct-lookup';
    state.providerDirectLookupStatus = 'running';
    state.providerDirectLookupStep = hasProviderLookupRef ? 'provider-fetch' : 'mk-redirect';
    state.providerDirectLookupProviderFamily = family;
    state.providerDirectLookupBodyShape = '';
    state.providerDirectLookupAddress2Seen = false;
    state.providerDirectLookupSequenceSeen = false;
    state.providerDirectLookupRedirectStatus = 0;
    state.providerDirectLookupPopupStatus = 0;
    state.providerDirectLookupStructuredFieldSeen = false;
    state.providerDirectLookupStructuredFieldName = '';
    state.providerDirectLookupStructuredFieldNames = [];
    state.providerDirectLookupStructuredFloorFieldSeen = false;
    state.providerDirectLookupStructuredFloorFieldNames = [];
    state.providerDirectLookupStructuredFloorTotalFieldSeen = false;
    state.providerDirectLookupStructuredValueStatus = '';
    state.providerDirectLookupVisibleFragmentSeen = false;
    state.providerDirectLookupVisibleFragmentStatus = '';
    state.providerDirectLookupVisibleFallbackOnly = false;
    state.providerDirectLookupBrokerOfficeBlockSeen = false;
    state.providerDirectLookupCandidatePresent = false;
    state.providerDirectLookupFloorHintPresent = false;
    state.providerDirectLookupRejectReason = '';
    state.cpProviderCurrentFamily = family;
    renderOverlay();
    let fallbackStarted = false;
    const startFallback = (reason) => {
      if (requestGeneration !== providerRequestGeneration) return;
      if (fallbackStarted) return;
      fallbackStarted = true;
      state.providerOpenStatus = settings.fallbackOpenStatus || 'opening';
      if (reason) state.providerDirectLookupRejectReason = reason;
      renderOverlay();
      fallback();
    };
    const fallbackTimer = settings.fastFallback === false ? 0 : window.setTimeout(() => {
      if (requestGeneration !== providerRequestGeneration) return;
      state.providerDirectLookupStatus = 'fallback-opened';
      startFallback('direct-lookup-slow');
    }, PROVIDER_DIRECT_LOOKUP_FAST_FALLBACK_MS);
    const requestKey = state.providerRequestKey || '';
    safeRuntimeSendMessage({
      source: BRIDGE_SOURCE,
      type: 'PROVIDER_DIRECT_LOOKUP',
      version: VERSION,
      articleMarker: state.articleMarker,
      requestKey,
      providerFamily: family,
      listingKey,
      providerLookupKind,
      providerLookupSequence,
      providerLookupKey: providerLookupKind === 'mk-uid' ? listingKey : '',
      providerLookupRef,
      providerLookupArticleMarker,
      providerLookupGroupProof,
      lookupBudgetMs: REGION_EXPORT_PROVIDER_LOOKUP_BUDGET_MS,
      detailDongToken: state.detailDongToken,
      detailTypeToken: state.detailTypeToken,
      detailTypeAliases: Array.isArray(state.detailTypeAliases) ? state.detailTypeAliases.slice(0, 6) : [],
      detailDirectionToken: state.detailDirectionToken,
      lineCandidateDisplays: providerLineCandidateDisplays(),
      detailFloorKind: state.detailFloorKind,
      detailFloorBand: state.detailFloorBand,
      detailFloorValue: state.detailFloorValue,
      detailTotalFloor: state.detailTotalFloor
    }, (response) => {
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      if (requestGeneration !== providerRequestGeneration) return;
      if (requestKey !== (state.providerRequestKey || '')) return;
      applyProviderEvidenceSummary(response && response.providerEvidenceSummary);
      state.providerDirectLookupStatus = response && response.directLookupStatus ? response.directLookupStatus : (response && response.status ? response.status : 'no-response');
      state.providerDirectLookupStep = response && response.directLookupStep ? response.directLookupStep : '';
      state.providerDirectLookupProviderFamily = sanitizeProviderFamily(response && response.providerFamily || family);
      state.providerDirectLookupBodyShape = normalizeText(response && response.bodyShape || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40);
      state.providerDirectLookupAddress2Seen = Boolean(response && response.address2Seen);
      state.providerDirectLookupSequenceSeen = Boolean(response && response.sequenceSeen);
      state.providerDirectLookupRedirectStatus = Number(response && response.redirectStatus || 0);
      state.providerDirectLookupPopupStatus = Number(response && response.popupStatus || 0);
      state.providerDirectLookupStructuredFieldSeen = Boolean(response && response.structuredFieldSeen);
      state.providerDirectLookupStructuredFieldName = normalizeText(response && response.structuredFieldName || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 40);
      state.providerDirectLookupStructuredFieldNames = sanitizeStringList(response && response.structuredFieldNames, /[^A-Za-z0-9_]/g, 8, 40);
      state.providerDirectLookupStructuredFloorFieldSeen = Boolean(response && response.structuredFloorFieldSeen);
      state.providerDirectLookupStructuredFloorFieldNames = sanitizeStringList(response && response.structuredFloorFieldNames, /[^A-Za-z0-9_]/g, 8, 40);
      state.providerDirectLookupStructuredFloorTotalFieldSeen = Boolean(response && response.structuredFloorTotalFieldSeen);
      state.providerDirectLookupStructuredValueStatus = normalizeText(response && response.structuredValueStatus || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40);
      state.providerDirectLookupVisibleFragmentSeen = Boolean(response && response.visibleFragmentSeen);
      state.providerDirectLookupVisibleFragmentStatus = normalizeText(response && response.visibleFragmentStatus || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40);
      state.providerDirectLookupVisibleFallbackOnly = Boolean(response && response.visibleFallbackOnly);
      state.providerDirectLookupBrokerOfficeBlockSeen = Boolean(response && response.brokerOfficeBlockSeen);
      state.providerDirectLookupCandidatePresent = Boolean(response && response.candidatePresent);
      state.providerDirectLookupFloorHintPresent = Boolean(response && response.floorHintPresent);
      state.providerDirectLookupRejectReason = response && response.rejectReason ? response.rejectReason : '';
      if (providerLookupKind && response && response.ok) {
        providerRouteLookupRunning = false;
        providerRouteLookupPendingRows.length = 0;
        providerRouteLookupPendingKeys.clear();
        state.providerRouteLookupBatchStatus = 'candidate-stored';
      } else if (providerLookupKind && response && !response.ok) {
        state.providerRouteLookupBatchStatus = 'lookup-failed';
      }
      if (response && response.ok) {
        scheduleScan('provider-direct-lookup');
        safeBridgeTask(pollProviderCandidate);
        return;
      }
      // Retry the SAME lookup on a transient failure before giving up on it. A genuine no-match
      // ('no-candidate', 'missing-key', ...) is NOT transient and falls through to the normal fallback.
      // This applies to ALL callers (not just the group-route queue): the `!fallbackStarted` guard
      // already prevents retrying after the 900ms fast-fallback has opened the provider page, so a
      // fast transient miss on the primary current-article / provider-name paths is retried too —
      // that was the path where a one-off 429/5xx silently degraded to the 2-candidate fallback.
      const attempt = Number(settings.attempt || 0);
      const failureSignal = String(
        (response && (response.rejectReason || response.status || response.directLookupStatus)) || 'no-response'
      );
      if (
        !fallbackStarted
        && attempt < PROVIDER_DIRECT_LOOKUP_MAX_RETRY
        && isTransientProviderLookupFailure(failureSignal)
      ) {
        state.providerRouteLookupBatchStatus = 'lookup-retry';
        const backoffMs = Math.min(1500, 400 * (attempt + 1));
        window.setTimeout(() => {
          if (requestGeneration !== providerRequestGeneration) return;
          if (requestKey !== (state.providerRequestKey || '')) return;
          if (state.providerCandidatePresent) return;
          runProviderDirectLookup(result, fallback, Object.assign({}, settings, { attempt: attempt + 1 }));
        }, backoffMs);
        return;
      }
      if (!fallbackStarted) {
        startFallback(response && response.status ? response.status : 'no-response');
        return;
      }
      scheduleScan('provider-direct-lookup-after-fallback');
    });
  }

  function maybeRunCurrentArticleMkDirectLookup() {
    if (!runtimeContextActive || !state.articleMarker) return;
    if (!Array.isArray(state.cpProviderFamilies) || !state.cpProviderFamilies.includes('mk')) return;
    if (state.providerCandidatePresent) return;
    if (['direct-lookup', 'opening', 'clicked', 'trusted-clicked', 'background-tab', 'captured', 'cancelled'].includes(String(state.providerOpenStatus || ''))) return;
    const lookupKey = providerLookupKeyFromUrl();
    if (!lookupKey) return;
    const key = [
      state.articleMarker,
      state.detailDongToken || '',
      state.detailTypeToken || '',
      state.detailFloorKind || '',
      state.detailFloorBand || '',
      Number(state.detailFloorValue || 0) || 0,
      Number(state.detailTotalFloor || 0) || 0,
      'mk-current-article'
    ].join('|');
    if (currentArticleMkLookupAttemptKeys.has(key)) return;
    currentArticleMkLookupAttemptKeys.add(key);
    if (currentArticleMkLookupAttemptKeys.size > 120) currentArticleMkLookupAttemptKeys.clear();
    const directLookupResult = {
      targetProviderFamily: 'mk',
      providerFamilies: ['mk'],
      phase: 'current-article',
      count: 1,
      providerLookupKind: 'mk-uid',
      providerLookupKey: lookupKey,
      providerLookupArticleMarker: state.articleMarker
    };
    state.providerOpenStatus = 'direct-lookup';
    state.cpProviderCurrentFamily = 'mk';
    state.cpProviderClickTargetStatus = 'current-article-direct-lookup';
    beginProviderRequest(() => {
      runProviderDirectLookup(directLookupResult, () => {
        state.providerOpenStatus = 'unverified';
        state.providerCandidateRejectedReason = state.providerDirectLookupRejectReason || 'current-article-direct-lookup-no-candidate';
        scheduleScan('current-article-direct-lookup-fallback');
      });
    }, {
      targetPhase: 'current-article',
      targetIndex: 0,
      targetCount: 1,
      targetFamily: 'mk'
    });
  }

  function maybeRunProviderNameDirectLookup() {
    if (!runtimeContextActive || !state.articleMarker) return;
    if (Number(state.cpProviderClickTargetCount || 0) > 0) return;
    if (!Array.isArray(state.cpProviderFamilies) || !state.cpProviderFamilies.includes('mk')) return;
    if (state.providerCandidatePresent) return;
    if (['direct-lookup', 'opening', 'clicked', 'trusted-clicked', 'background-tab', 'captured', 'cancelled'].includes(String(state.providerOpenStatus || ''))) return;
    const key = [
      state.articleMarker,
      state.detailDongToken || '',
      state.detailTypeToken || '',
      state.detailFloorKind || '',
      state.detailFloorBand || '',
      Number(state.detailTotalFloor || 0) || 0,
      'mk-provider-name'
    ].join('|');
    if (providerNameLookupAttemptKeys.has(key)) return;
    providerNameLookupAttemptKeys.add(key);
    if (providerNameLookupAttemptKeys.size > 80) providerNameLookupAttemptKeys.clear();
    const directLookupResult = {
      targetProviderFamily: 'mk',
      providerFamilies: ['mk'],
      phase: 'provider-name',
      count: 0
    };
    state.providerOpenStatus = 'direct-lookup';
    state.cpProviderCurrentFamily = 'mk';
    state.cpProviderClickTargetStatus = 'provider-name-direct-lookup';
    beginProviderRequest(() => {
      runProviderDirectLookup(directLookupResult, () => {
        state.providerOpenStatus = 'unverified';
        state.providerCandidateRejectedReason = state.providerDirectLookupRejectReason || 'provider-name-direct-lookup-no-target';
        scheduleScan('provider-name-direct-lookup-fallback');
      });
    }, {
      targetPhase: 'provider-name',
      targetIndex: 0,
      targetCount: 1,
      targetFamily: 'mk'
    });
  }

  function sanitizeProviderLookupRow(row, fallbackSource) {
    const input = row && typeof row === 'object' ? row : {};
    const source = safeGroupCandidateSource(input.source) || groupSourceFromEndpointCategory(fallbackSource);
    const providerFamily = sanitizeProviderFamily(input.providerFamily || '');
    const lookupKind = sanitizeProviderLookupKind(input.lookupKind || '');
    const lookupKey = sanitizeProviderLookupKey(input.lookupKey || '', lookupKind);
    const lookupRef = lookupKind === 'provider-url' ? sanitizeProviderLookupRef(input.lookupRef || '') : '';
    if (!source || !providerFamily || !lookupKind || !lookupKey) return null;
    if ((lookupKind === 'mk-sequence' || lookupKind === 'mk-uid') && providerFamily !== 'mk') return null;
    if (lookupKind === 'provider-url' && !lookupRef) return null;
    const sanitizedRow = {
      source,
      providerFamily,
      lookupKind,
      lookupKey,
      sourceField: normalizeText(input.sourceField || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 80),
      dongToken: extractDongToken(input.dongToken || '') || '',
      typeToken: sanitizeTypeToken(input.typeToken || ''),
      articleMarker: sanitizeArticleMarker(input.articleMarker),
      pyeongNo: sanitizeArticleDetailPyeongNo(input.pyeongNo || input.ptpNo || input.pyeongTypeNo || ''),
      exclusiveSpace: normalizeAreaValue(input.exclusiveSpace || input.exclusiveArea || input.excluseSpc || 0)
    };
    if (lookupKind === 'provider-url') sanitizedRow.lookupRef = lookupRef;
    return sanitizedRow;
  }

  function providerLookupGroupSourceTrusted(source) {
    return ['sameAddress', 'representative-main', 'complex-list', 'complex-cache'].includes(String(source || ''));
  }

  function providerLookupRowAreaMatches(rowArea, contextArea) {
    const row = normalizeAreaValue(rowArea);
    const context = normalizeAreaValue(contextArea);
    if (!(row > 0) || !(context > 0)) return true;
    return Math.abs(row - context) < 0.01;
  }

  function providerLookupRowPyeongNoMatches(rowPyeongNo, contextPyeongNo) {
    const row = sanitizeArticleDetailPyeongNo(rowPyeongNo || '');
    const context = sanitizeArticleDetailPyeongNo(contextPyeongNo || '');
    if (!row || !context) return true;
    return row === context;
  }

  function providerLookupRowContextRejectReason(row, requireExplicitProof) {
    const activeDong = extractDongToken(state.detailDongToken || '') || state.detailDongToken || '';
    const activeTypes = detailTypeTokenList(state);
    if (requireExplicitProof && (!row.dongToken || !activeDong)) return 'missing-dong-proof';
    if (row.dongToken && activeDong && row.dongToken !== activeDong) return 'dong-mismatch';
    if (requireExplicitProof && (!row.typeToken || activeTypes.length < 1)) return 'missing-type-proof';
    if (!groupTypeTokenMatchesAny(row.typeToken, activeTypes)) return 'type-mismatch';
    if (!providerLookupRowAreaMatches(row.exclusiveSpace, state.detailExclusiveSpace)) return 'area-mismatch';
    if (!providerLookupRowPyeongNoMatches(row.pyeongNo, state.detailPyeongNo)) return 'pyeong-no-mismatch';
    return '';
  }

  function providerLookupRowGroupContextMatches(row) {
    if (!row) return false;
    const activeMarker = state.articleMarker || '';
    if (activeMarker && (!row.articleMarker || row.articleMarker === activeMarker)) return false;
    if (!providerLookupGroupSourceTrusted(row.source)) return false;
    return !providerLookupRowContextRejectReason(row, true);
  }

  function providerLookupRowMatchKind(row) {
    if (!row || !PROVIDER_FAMILIES.has(row.providerFamily)) return '';
    if (row.articleMarker === state.articleMarker) return 'article';
    return providerLookupRowGroupContextMatches(row) ? 'group-context' : '';
  }

  function providerLookupRowMatchesDetail(row) {
    return Boolean(providerLookupRowMatchKind(row));
  }

  function providerLookupRowRejectReason(row) {
    if (!row) return 'no-valid-token';
    if (providerLookupRowMatchKind(row)) return '';
    if (!state.articleMarker) {
      const contextReason = providerLookupRowContextRejectReason(row, true);
      return contextReason || 'missing-active-marker';
    }
    const strictContextReason = providerLookupRowContextRejectReason(row, row.articleMarker !== state.articleMarker);
    if (strictContextReason) return strictContextReason;
    if (row.articleMarker !== state.articleMarker) return 'marker-mismatch';
    return '';
  }

  function countProviderLookupField(rows, field) {
    const counts = {};
    const items = Array.isArray(rows) ? rows : [];
    for (const row of items) {
      let key = '';
      if (field === 'lookupKind') key = sanitizeProviderLookupKind(row && row.lookupKind);
      if (field === 'providerFamily') key = sanitizeProviderFamily(row && row.providerFamily);
      if (field === 'matchKind') {
        const value = String(row && row.matchKind || '');
        key = value === 'article' || value === 'group-context' ? value : '';
      }
      if (!key) continue;
      counts[key] = Math.min(999, (Number(counts[key] || 0) || 0) + 1);
    }
    return counts;
  }

  function updateProviderRouteLookupDiagnostics(rawRows, rows, endpointCategory) {
    const rawCount = Array.isArray(rawRows) ? rawRows.length : 0;
    if (!rawCount) return;
    const source = groupSourceFromEndpointCategory(endpointCategory) || String(endpointCategory || '') || '-';
    const matches = rows
      .map((row) => Object.assign({}, row, { matchKind: providerLookupRowMatchKind(row) }))
      .filter((row) => row.matchKind);
    const groupContextMatches = matches.filter((row) => row.matchKind === 'group-context');
    const rejectByReason = {};
    const rejectBySource = {};
    rows.forEach((row) => {
      const reason = providerLookupRowRejectReason(row);
      if (!reason) return;
      rejectByReason[reason] = Math.min(999, (rejectByReason[reason] || 0) + 1);
      const rowSource = row.source || source || '-';
      rejectBySource[rowSource] = Math.min(999, (rejectBySource[rowSource] || 0) + 1);
    });
    const firstReject = rows.map(providerLookupRowRejectReason).filter(Boolean)[0] || (rawCount ? 'no-valid-token' : '');
    const blockedReason = groupContextMatches.length > 1 ? 'group-context-multiple' : firstReject;
    state.providerRouteLookupRawCount = Math.min(999, rawCount);
    state.providerRouteLookupMatchCount = Math.min(999, matches.length);
    state.providerRouteLookupGroupContextCount = Math.min(999, groupContextMatches.length);
    state.providerRouteLookupRejectedCount = Math.min(999, Math.max(0, rows.length - matches.length));
    state.providerRouteLookupLastSource = source;
    state.providerRouteLookupLastRejectReason = matches.length ? '' : blockedReason;
    state.providerRouteLookupBatchStatus = matches.length ? 'ready' : 'no-match';
    state.providerRouteLookupBySource = Object.assign({}, state.providerRouteLookupBySource || {}, {
      [source]: Math.min(999, rawCount)
    });
    state.providerRouteLookupKindBySource = Object.assign({}, state.providerRouteLookupKindBySource || {}, {
      [source]: countProviderLookupField(rows, 'lookupKind')
    });
    state.providerRouteLookupFamilyBySource = Object.assign({}, state.providerRouteLookupFamilyBySource || {}, {
      [source]: countProviderLookupField(rows, 'providerFamily')
    });
    state.providerRouteLookupMatchBySource = Object.assign({}, state.providerRouteLookupMatchBySource || {}, {
      [source]: countProviderLookupField(matches, 'matchKind')
    });
    state.providerRouteLookupRejectByReason = rejectByReason;
    state.providerRouteLookupRejectBySource = rejectBySource;
  }

  function providerRouteDirectLookupKey(row) {
    return [activeProviderArticleMarker(), row.source, row.providerFamily, row.lookupKind, row.lookupKey].join('|');
  }

  function providerRouteDirectLookupResult(row) {
    return {
      targetProviderFamily: row.providerFamily,
      providerFamilies: [row.providerFamily],
      phase: 'group-route-provider',
      count: 0,
      providerLookupKind: row.lookupKind,
      providerLookupSequence: row.lookupKind === 'mk-sequence' ? row.lookupKey : '',
      providerLookupKey: row.lookupKind === 'mk-uid' ? row.lookupKey : '',
      providerLookupRef: row.lookupKind === 'provider-url' ? row.lookupRef : '',
      providerLookupArticleMarker: row.articleMarker,
      providerLookupGroupProof: row.matchKind === 'group-context'
    };
  }

  function enqueueProviderRouteDirectLookupRows(rows) {
    const input = Array.isArray(rows) ? rows : [];
    for (const row of input) {
      const key = providerRouteDirectLookupKey(row);
      if (!key || providerRouteLookupAttemptKeys.has(key) || providerRouteLookupPendingKeys.has(key)) continue;
      providerRouteLookupPendingKeys.add(key);
      providerRouteLookupPendingRows.push(row);
    }
    if (providerRouteLookupPendingRows.length > 24) {
      const removed = providerRouteLookupPendingRows.splice(0, providerRouteLookupPendingRows.length - 24);
      removed.forEach((row) => providerRouteLookupPendingKeys.delete(providerRouteDirectLookupKey(row)));
    }
  }

  function providerRouteLookupQueueBlockedByProviderOpenStatus() {
    const status = String(state.providerOpenStatus || '');
    if (['opening', 'direct-lookup', 'background-tab', 'captured'].includes(status)) return true;
    if (['clicked', 'trusted-clicked'].includes(status)) {
      if (state.providerCandidateRejectedReason) return false;
      if (Number(state.providerEvidenceTempCount || 0) > 0 || Number(state.providerEvidenceTempFloorCount || 0) > 0) return false;
      const idleSec = Number(state.routeSearchIdleSec || 0);
      return idleSec < PROVIDER_ROUTE_LOOKUP_STALE_CLICK_RESUME_SEC;
    }
    return false;
  }

  function runProviderRouteDirectLookupQueue() {
    const articleMarker = activeProviderArticleMarker();
    if (providerRouteLookupRunning) return;
    if (!runtimeContextActive) return;
    if (!articleMarker) return;
    if (state.providerCandidatePresent) return;
    if (providerRouteLookupQueueBlockedByProviderOpenStatus()) return;
    if (!providerRouteLookupPendingRows.length) return;
    providerRouteLookupRunning = true;
    state.providerOpenStatus = 'direct-lookup';
    state.cpProviderCurrentFamily = providerRouteLookupPendingRows[0] && providerRouteLookupPendingRows[0].providerFamily
      ? providerRouteLookupPendingRows[0].providerFamily
      : '';
    state.cpProviderClickTargetStatus = 'group-route-direct-lookup';
    const initialPendingCount = providerRouteLookupPendingRows.length;
    const initialPendingFamily = state.cpProviderCurrentFamily;
    const runNext = () => {
      if (!runtimeContextActive || !articleMarker || articleMarker !== activeProviderArticleMarker()) {
        providerRouteLookupRunning = false;
        return;
      }
      if (state.providerCandidatePresent) {
        providerRouteLookupRunning = false;
        providerRouteLookupPendingRows.length = 0;
        providerRouteLookupPendingKeys.clear();
        state.providerRouteLookupBatchStatus = 'candidate-stored';
        return;
      }
      const row = providerRouteLookupPendingRows.shift();
      if (!row) {
        providerRouteLookupRunning = false;
        state.providerRouteLookupBatchStatus = 'exhausted';
        state.providerOpenStatus = 'unverified';
        state.providerCandidateRejectedReason = state.providerDirectLookupRejectReason || 'group-route-direct-lookup-no-candidate';
        clearProviderCandidate(articleMarker);
        scheduleScan('group-route-provider-direct-lookup-exhausted');
        return;
      }
      const rowKey = providerRouteDirectLookupKey(row);
      providerRouteLookupPendingKeys.delete(rowKey);
      providerRouteLookupAttemptKeys.add(rowKey);
      state.cpProviderCurrentFamily = row.providerFamily || '';
      if (providerRouteLookupAttemptKeys.size > 160) providerRouteLookupAttemptKeys.clear();
      state.providerRouteLookupAttemptedCount = Math.min(999, (Number(state.providerRouteLookupAttemptedCount || 0) || 0) + 1);
      state.providerRouteLookupBatchStatus = row.matchKind === 'article' ? 'article-attempting' : 'group-context-attempting';
      state.providerRouteLookupAttemptLastSource = row.source || '';
      state.providerRouteLookupAttemptLastFamily = row.providerFamily || '';
      state.providerRouteLookupAttemptLastKind = row.lookupKind || '';
      state.providerRouteLookupAttemptLastMatchKind = row.matchKind || '';
      runProviderDirectLookup(providerRouteDirectLookupResult(row), runNext, {
        fastFallback: false,
        fallbackOpenStatus: 'direct-lookup'
      });
    };
    beginProviderRequest(runNext, {
      targetPhase: 'group-route-provider',
      targetIndex: 0,
      targetCount: initialPendingCount,
      targetFamily: initialPendingFamily
    });
  }

  function maybeRunProviderRouteDirectLookup(rows, endpointCategory) {
    const rawRows = Array.isArray(rows) ? rows : [];
    const sanitizedRows = rawRows
      .map((item) => sanitizeProviderLookupRow(item, endpointCategory))
      .filter(Boolean);
    updateProviderRouteLookupDiagnostics(rawRows, sanitizedRows, endpointCategory);
    if (!runtimeContextActive || !activeProviderArticleMarker()) return;
    const matchedRows = sanitizedRows
      .map((item) => Object.assign({}, item, { matchKind: providerLookupRowMatchKind(item) }))
      .filter((item) => item.matchKind);
    const articleRows = matchedRows.filter((item) => item.matchKind === 'article');
    const groupContextRows = matchedRows.filter((item) => item.matchKind === 'group-context');
    const lookupRows = articleRows.length ? articleRows : groupContextRows.slice(0, MAX_PROVIDER_GROUP_CONTEXT_LOOKUPS);
    enqueueProviderRouteDirectLookupRows(lookupRows);
    if (!providerRouteLookupPendingRows.length) {
      if (lookupRows.length) state.providerRouteLookupBatchStatus = 'already-attempted';
      return;
    }
    runProviderRouteDirectLookupQueue();
  }

  function providerClickPoint(target) {
    if (!target || typeof target.getBoundingClientRect !== 'function') return null;
    const rect = target.getBoundingClientRect();
    const width = Number(rect && rect.width);
    const height = Number(rect && rect.height);
    const left = Number(rect && rect.left);
    const top = Number(rect && rect.top);
    if (![width, height, left, top].every(Number.isFinite) || width <= 0 || height <= 0) return null;
    return {
      x: Math.max(0, Math.round(left + width / 2)),
      y: Math.max(0, Math.round(top + height / 2))
    };
  }

  function scrollProviderTargetIntoView(target) {
    if (!target || typeof target.scrollIntoView !== 'function' || typeof target.getBoundingClientRect !== 'function') return;
    const rect = target.getBoundingClientRect();
    const top = Number(rect && rect.top);
    const bottom = Number(rect && rect.bottom);
    const viewportHeight = Number(window.innerHeight || document.documentElement.clientHeight || 0);
    if (!Number.isFinite(top) || !Number.isFinite(bottom) || !viewportHeight) return;
    if (top < 0 || bottom > viewportHeight) {
      target.scrollIntoView({ block: 'center', inline: 'nearest' });
    }
  }

  function markProviderClickStarted(status, phase, result) {
    state.providerOpenStatus = status || 'clicked';
    if (phase === 'direct-provider' && Number(result && result.count || 0) > 0) {
      state.cpProviderAttemptIndex = (Number(state.cpProviderAttemptIndex || 0) + 1) % Number(result.count || 1);
    }
    if (phase === 'group-target' && Number(result && result.count || 0) > 0) {
      state.cpProviderGroupAttemptIndex = (Number(state.cpProviderGroupAttemptIndex || 0) + 1) % Number(result.count || 1);
    }
    state.cpProviderCurrentFamily = targetProviderFamily(result);
    const scanReason = status === 'trusted-clicked'
      ? 'provider-open-trusted-click'
      : (status === 'background-tab' ? 'provider-open-background-tab' : 'provider-open-click');
    scheduleScan(scanReason);
  }

  function providerClickableElement(target) {
    if (!target || typeof target.closest !== 'function') return target || null;
    return target.closest('a[href]') || target.closest('button, [role="button"]') || target;
  }

  function isJavascriptHref(target) {
    if (!target || typeof target.getAttribute !== 'function') return false;
    return /^\s*javascript:/i.test(String(target.getAttribute('href') || ''));
  }

  function clickNavigationRefFromTarget(target) {
    if (!target) return '';
    return typeof target.href === 'string'
      ? target.href
      : (typeof target.getAttribute === 'function' ? target.getAttribute('href') || target.getAttribute('onclick') || '' : '');
  }

  function isBlockedProviderNavigationHref(value) {
    const href = String(value || '');
    return /articleGallery\.naver|[?&]startImage=Y(?:&|$)|[?&]isGroupArticle=Y(?:&|$)/i.test(href);
  }

  function isBlockedProviderNavigationTarget(target) {
    return isBlockedProviderNavigationHref(clickNavigationRefFromTarget(providerClickableElement(target)));
  }

  function skipBlockedProviderNavigation(phase, result) {
    state.providerOpenStatus = 'blocked-naver-gallery-link';
    state.cpProviderClickTargetStatus = 'blocked-naver-gallery-link';
    state.cpProviderCurrentFamily = targetProviderFamily(result);
    markProviderClickStarted('blocked-naver-gallery-link', phase, result);
    renderOverlay();
  }

  function providerLookupRefFromTarget(target) {
    const clickTarget = providerClickableElement(target);
    if (!clickTarget || isJavascriptHref(clickTarget)) return '';
    const href = clickNavigationRefFromTarget(clickTarget);
    if (isBlockedProviderNavigationHref(href)) return '';
    return sanitizeProviderLookupRef(href);
  }

  function dispatchSyntheticProviderClick(target) {
    if (!target || typeof target.dispatchEvent !== 'function') return false;
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    return target.dispatchEvent(event);
  }

  function restoreJavascriptHrefAfterDefaultAction(target, href) {
    if (!target || typeof target.setAttribute !== 'function') return;
    const restore = () => {
      try {
        if (typeof target.hasAttribute === 'function' && target.hasAttribute('href')) return;
        target.setAttribute('href', href);
      } catch (_) {
        // Best-effort restoration after the browser has skipped javascript: navigation.
      }
    };
    if (typeof window.setTimeout === 'function') {
      window.setTimeout(restore, 0);
      return;
    }
    restore();
  }

  function skipJavascriptDirectProviderClick(phase, result) {
    state.providerOpenStatus = 'javascript-skipped';
    state.cpProviderClickTargetStatus = 'javascript-target-not-backgroundable';
    state.cpProviderCurrentFamily = targetProviderFamily(result);
    markProviderClickStarted('javascript-skipped', phase, result);
  }

  function fallbackProviderClick(target, phase, result) {
    const clickTarget = providerClickableElement(target);
    if (isBlockedProviderNavigationTarget(clickTarget)) {
      skipBlockedProviderNavigation(phase, result);
      return;
    }
    if (isJavascriptHref(clickTarget)) {
      const href = clickTarget.getAttribute('href');
      clickTarget.removeAttribute('href');
      dispatchSyntheticProviderClick(clickTarget);
      restoreJavascriptHrefAfterDefaultAction(clickTarget, href);
    } else if (clickTarget && typeof clickTarget.click === 'function') {
      clickTarget.click();
    }
    markProviderClickStarted('clicked', phase, result);
  }

  function openProviderBackgroundTab(target, phase, result) {
    const requestGeneration = providerRequestGeneration;
    const providerLookupRef = providerLookupRefFromTarget(target);
    const providerFamily = targetProviderFamily(result);
    if (phase !== 'direct-provider' || !providerFamily || !providerLookupRef) return false;
    state.providerOpenStatus = 'background-tab';
    state.cpProviderClickTargetStatus = 'background-tab-opening';
    state.cpProviderCurrentFamily = providerFamily;
    renderOverlay();
    safeRuntimeSendMessage({
      source: BRIDGE_SOURCE,
      type: 'OPEN_PROVIDER_BACKGROUND',
      version: VERSION,
      articleMarker: state.articleMarker,
      requestKey: state.providerRequestKey || '',
      providerFamily,
      providerLookupRef
    }, (response) => {
      if (requestGeneration !== providerRequestGeneration) return;
      applyProviderEvidenceSummary(response && response.providerEvidenceSummary);
      if (response && response.ok) {
        markProviderClickStarted('background-tab', phase, result);
        safeBridgeTask(pollProviderCandidate);
        return;
      }
      state.cpProviderClickTargetStatus = response && response.reason ? response.reason : 'background-tab-unavailable';
      dispatchVisibleProviderClick(target, phase, result);
    });
    return true;
  }

  function dispatchVisibleProviderClick(target, phase, result) {
    if (isBlockedProviderNavigationTarget(target)) {
      skipBlockedProviderNavigation(phase, result);
      return;
    }
    scrollProviderTargetIntoView(target);
    const point = providerClickPoint(target);
    if (!point) {
      fallbackProviderClick(target, phase, result);
      return;
    }

    safeRuntimeSendMessage({
      source: BRIDGE_SOURCE,
      type: 'DISPATCH_PROVIDER_CLICK',
      version: VERSION,
      articleMarker: state.articleMarker,
      x: point.x,
      y: point.y,
      returnFocusDelayMs: 2500
    }, (response) => {
      if (response && response.ok) {
        markProviderClickStarted('trusted-clicked', phase, result);
        return;
      }
      state.cpProviderClickTargetStatus = response && response.reason ? response.reason : 'trusted-click-unavailable';
      fallbackProviderClick(target, phase, result);
    });
  }

  function dispatchProviderClick(target, phase, result) {
    if (isBlockedProviderNavigationTarget(target)) {
      skipBlockedProviderNavigation(phase, result);
      return;
    }
    if (isJavascriptHref(providerClickableElement(target))) {
      if (phase === 'direct-provider') {
        skipJavascriptDirectProviderClick(phase, result);
        return;
      }
      fallbackProviderClick(target, phase, result);
      return;
    }
    if (phase === 'direct-provider' && openProviderBackgroundTab(target, phase, result)) return;
    dispatchVisibleProviderClick(target, phase, result);
  }

  function exposeCdpProviderControls() {
    window.__DHS_CDP_OPEN_PROVIDER_CLICK_TARGET__ = (input) => {
      const phase = input && typeof input === 'object' ? String(input.phase || '') : String(input || '');
      openProviderClickTarget(phase);
      return {
        ok: true,
        providerOpenStatus: state.providerOpenStatus || '',
        providerClickTargetStatus: state.cpProviderClickTargetStatus || '',
        providerClickTargetPhase: state.cpProviderClickTargetPhase || '',
        providerFamily: state.cpProviderCurrentFamily || ''
      };
    };
  }

  function isAbortError(error) {
    return Boolean(error && (error.name === 'AbortError' || /aborted|abort/i.test(String(error.message || ''))));
  }

  async function openJsonResponseDeadline(path, options, timeoutMs) {
    const canAbort = typeof AbortController === 'function';
    const controller = canAbort ? new AbortController() : null;
    let timer = 0;
    let closed = false;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      if (timer) window.clearTimeout(timer);
      timer = 0;
      if (controller && !controller.signal.aborted) controller.abort();
    };
    if (controller && Number(timeoutMs || 0) > 0) {
      timer = window.setTimeout(() => controller.abort(), Number(timeoutMs || 0));
    }
    try {
      const response = await fetch(path, Object.assign({}, options || {}, controller ? { signal: controller.signal } : {}));
      return {
        response,
        readJson: async () => {
          try {
            return await response.json();
          } finally {
            cleanup();
          }
        },
        close: cleanup
      };
    } catch (error) {
      cleanup();
      throw error;
    }
  }

  function resetProviderCandidate(status, reason) {
    state.providerCandidatePresent = false;
    state.providerCandidateKind = 'none';
    state.providerCandidateFamily = '';
    state.providerCandidateSource = '';
    state.providerCandidateSourceLabel = '';
    state.providerCandidateCpid = '';
    state.providerCandidateCertainty = '';
    state.providerCandidateRank = 0;
    state.providerCandidateDisplay = '';
    state.providerCandidateRejectedSource = '';
    state.providerCandidateRejectedSourceLabel = '';
    state.providerCandidateRejectedCpid = '';
    state.providerCandidateRejectedCertainty = '';
    state.providerCandidateRejectedRank = 0;
    state.providerCandidateRejectedKind = '';
    state.providerCandidateRejectedFamily = '';
    state.providerCandidateCount = 0;
    state.providerCandidateRejectedCount = 0;
    state.providerCandidateRankedSummary = '';
    if (reason) state.providerCandidateRejectedReason = reason;
    if (status) state.providerOpenStatus = status;
  }

  function resetDirectLookupStatus(status) {
    state.providerDirectLookupStatus = status || 'idle';
    state.providerDirectLookupStep = '';
    state.providerDirectLookupProviderFamily = '';
    state.providerDirectLookupBodyShape = '';
    state.providerDirectLookupAddress2Seen = false;
    state.providerDirectLookupSequenceSeen = false;
    state.providerDirectLookupRedirectStatus = 0;
    state.providerDirectLookupPopupStatus = 0;
    state.providerDirectLookupStructuredFieldSeen = false;
    state.providerDirectLookupStructuredFieldName = '';
    state.providerDirectLookupStructuredFieldNames = [];
    state.providerDirectLookupStructuredFloorFieldSeen = false;
    state.providerDirectLookupStructuredFloorFieldNames = [];
    state.providerDirectLookupStructuredFloorTotalFieldSeen = false;
    state.providerDirectLookupStructuredValueStatus = '';
    state.providerDirectLookupVisibleFragmentSeen = false;
    state.providerDirectLookupVisibleFragmentStatus = '';
    state.providerDirectLookupVisibleFallbackOnly = false;
    state.providerDirectLookupBrokerOfficeBlockSeen = false;
    state.providerDirectLookupCandidatePresent = false;
    state.providerDirectLookupFloorHintPresent = false;
    state.providerDirectLookupRejectReason = '';
  }

  function resetProviderFloorHint(reason) {
    state.providerFloorHintPresent = false;
    state.providerFloorHintValue = 0;
    state.providerFloorHintTotal = 0;
    state.providerFloorHintFamily = '';
    state.providerFloorHintSourceLabel = '';
    state.providerFloorHintMarker = '';
    if (reason) state.providerFloorHintRejectedReason = reason;
  }

  function resetAutoLoop(reason) {
    window.clearTimeout(autoLoopTimer);
    autoLoopTimer = 0;
    autoLoopAttemptedKeys.clear();
    autoLoopArticleMarker = state.articleMarker || '';
    state.autoLoopStatus = 'idle';
    state.autoLoopReason = reason || '';
    state.autoLoopAction = '';
    state.autoLoopTargetPhase = '';
    state.autoLoopTargetRoute = '';
    state.autoLoopTargetIndex = 0;
    state.autoLoopTargetCount = 0;
    state.autoLoopAttemptedCount = 0;
    state.autoLoopLastActionAt = 0;
  }

  function resetResolverEvidence() {
    state.cpProviderEvidenceSeen = false;
    state.sameAddressEvidenceSeen = false;
    state.representativeEvidenceSeen = false;
    state.naverCacheEvidenceSeen = false;
    state.complexListEvidenceSeen = false;
    state.complexCacheEvidenceSeen = false;
    state.kbAliasEvidenceSeen = false;
    state.kbAliasReadiness = 'none';
    state.kbAliasMarker = '';
    state.networkCategoryCounts = {};
    state.lastEvidenceCategory = 'none';
    state.lastEvidenceStatus = 'none';
    state.lastEvidenceProviderFamily = '';
    state.articleDetailExclusiveSpace = 0;
    state.articleDetailPyeongNo = '';
    state.articleDetailFloorValue = 0;
    state.articleDetailTotalFloor = 0;
    state.pyeongTypeRouteEvent = '';
    state.pyeongTypeRouteStatus = 0;
    state.pyeongTypeRouteReason = '';
    state.pyeongTypeLineMapRowCount = 0;
    state.lineMapRouteEndpoint = '';
    state.lineMapRouteEvent = '';
    state.lineMapRouteStatus = 0;
    state.lineMapRouteReason = '';
    state.lineMapRouteRowCount = 0;
    state.lineMapRouteDurationMs = 0;
    state.lineMapRouteProgressSeq = 0;
    state.lineMapRouteShapeSummary = '';
    state.lineMapRouteByEndpoint = {};
    state.lineMapFollowupRequestCount = 0;
    state.lineMapFollowupReason = '';
    state.finFrontPriorityReason = 'idle';
    state.finFrontPriorityAttemptCount = 0;
    state.finFrontPriorityHitCount = 0;
    state.finFrontPriorityWaitMs = 0;
    resetBuildingUnitsExact('article-changed');
    state.groupRouteFloorHintRawBySource = {};
    state.groupRouteFloorHintDiagnosticBySource = {};
    state.groupRouteFloorHintSeenCount = 0;
    state.groupRouteFloorHintAcceptedCount = 0;
    state.groupRouteFloorHintRejectedCount = 0;
    state.groupRouteFloorHintRejectByReason = {};
    state.groupRouteFloorHintSeenByField = {};
    state.groupRouteShapeBySource = {};
    groupCandidateRows = [];
    groupCandidateEvidenceReceiptByProof = Object.create(null);
    lineMapEvidenceReceiptByProof = Object.create(null);
    groupFloorHintRows = [];
    networkLineMapRows = [];
    state.groupFloorHintPresent = false;
    state.groupFloorHintValue = 0;
    state.groupFloorHintTotal = 0;
    state.groupFloorHintSource = '';
    state.groupFloorHintCount = 0;
    state.groupFloorHintRejectedReason = '';
    state.groupFloorHintGuardSeenCount = 0;
    state.groupFloorHintGuardMatchedCount = 0;
    state.groupFloorHintGuardRejectByReason = {};
    resetGroupCandidate('article-changed');
    resetLandLinePromotion('article-changed');
    state.groupRouteStatus = 'idle';
    state.groupRouteSource = '';
    state.groupRouteIndex = 0;
    state.groupRouteCount = 0;
    state.groupRouteCandidateCount = 0;
    state.groupRouteRejectedCount = 0;
    state.groupRouteLastRejectReason = '';
    state.groupRouteProgressSeq = 0;
    state.providerRouteLookupRawCount = 0;
    state.providerRouteLookupMatchCount = 0;
    state.providerRouteLookupGroupContextCount = 0;
    state.providerRouteLookupRejectedCount = 0;
    state.providerRouteLookupAttemptedCount = 0;
    state.providerRouteLookupBatchStatus = '';
    state.providerRouteLookupLastSource = '';
    state.providerRouteLookupLastRejectReason = '';
    state.providerRouteLookupBySource = {};
    state.providerRouteLookupRejectByReason = {};
    state.providerRouteLookupRejectBySource = {};
    state.providerRouteLookupKindBySource = {};
    state.providerRouteLookupFamilyBySource = {};
    state.providerRouteLookupMatchBySource = {};
    state.providerRouteLookupAttemptLastSource = '';
    state.providerRouteLookupAttemptLastFamily = '';
    state.providerRouteLookupAttemptLastKind = '';
    state.providerRouteLookupAttemptLastMatchKind = '';
    currentArticleMkLookupAttemptKeys.clear();
    providerRouteLookupAttemptKeys.clear();
    providerRouteLookupPendingKeys.clear();
    providerRouteLookupPendingRows.length = 0;
    providerRouteLookupRunning = false;
  }

  function chooseResolverState() {
    if (state.stop) return { branch: 'stop', outcome: 'blocked' };
    if (state.dongHoShownCount > 0) return { branch: 'same-card', outcome: 'visible-ho' };
    if (state.articlePresent && state.officialExactCandidatePresent && state.officialExactCandidateDisplay) {
      return { branch: 'official-table', outcome: 'official-table-exact' };
    }
    if (state.providerCandidatePresent) {
      return { branch: 'cpid-ui', outcome: `captured:${state.providerCandidateKind}` };
    }
    if (state.groupCandidatePresent) {
      return { branch: 'sameAddress', outcome: `captured-group:${state.groupCandidateSource || 'group'}` };
    }
    if (providerRouteLookupCandidatePending()) {
      return { branch: 'cpid-ui', outcome: 'provider:candidate-stored' };
    }
    if (state.landLineCandidatePresent) {
      return { branch: 'line-inference', outcome: state.landLineCandidateSource || 'land-line-after-group' };
    }
    if (['single-estimated', 'multiple-candidates', 'line-only'].includes(state.lineInferenceStatus)) {
      const outcome = state.lineInferenceStatus === 'single-estimated'
        ? 'line-type-single-estimated'
        : (state.lineInferenceStatus === 'multiple-candidates' ? 'line-type-multiple' : 'line-type-line-only');
      return { branch: 'line-inference', outcome };
    }
    if (state.cpProviderEvidenceSeen || state.lastEvidenceCategory === 'cpProvider' || state.cpTextSignalStrong) {
      const readiness = state.cpParserReadiness && state.cpParserReadiness !== 'none'
        ? state.cpParserReadiness
        : 'needs-provider-parser';
      return { branch: 'cpid-ui', outcome: `provider:${readiness}` };
    }
    if (state.sameAddressEvidenceSeen || state.representativeEvidenceSeen || state.lastEvidenceCategory === 'sameAddress' || state.lastEvidenceCategory === 'representativeArticles') {
      return { branch: 'sameAddress', outcome: 'needs-group-candidates' };
    }
    if (state.complexListEvidenceSeen || state.complexCacheEvidenceSeen || state.lastEvidenceCategory === 'complexList' || state.lastEvidenceCategory === 'complexCache') {
      return { branch: 'complex-cache', outcome: 'needs-group-candidates' };
    }
    if (state.kbAliasEvidenceSeen || state.lastEvidenceCategory === 'kbAlias') {
      return { branch: 'kb-alias', outcome: state.kbAliasReadiness && state.kbAliasReadiness !== 'none' ? state.kbAliasReadiness : 'seen' };
    }
    if (state.articlePresent && state.officialCandidateCells > 0) {
      return {
        branch: 'official-table',
        outcome: state.officialCandidateCells === 1
          ? 'reference-one'
          : `reference-candidates:${state.officialCandidateCells}`
      };
    }
    if (state.naverCacheEvidenceSeen || ['landprice', 'prices', 'buildingUnits', 'pyeongtype'].includes(state.lastEvidenceCategory)) {
      return { branch: 'naver-cache', outcome: 'needs-cache-match' };
    }
    if (state.articlePresent) return { branch: 'ambiguous', outcome: 'needs-evidence' };
    return { branch: 'idle', outcome: 'no-article' };
  }

  function routeSearchSignature() {
    const api = window.DHS_ROUTE_SEARCH;
    return api && typeof api.buildRouteSearchSignature === 'function'
      ? api.buildRouteSearchSignature(state)
      : '';
  }

  function selectedListingForRouteSearch() {
    // Track dong-ho ONLY when a specific listing's real detail panel is open — i.e. the user
    // opened a child of a grouped listing, or a non-grouped listing. A bare group-parent click
    // just expands the group (no detail panel) and must not trigger tracking, and nothing is
    // ever auto-selected. Region extraction drives its own tracking, so allow it too.
    return Boolean(state.detailPanelPresent)
      || ['preparing', 'running', 'saving'].includes(state.regionExportStatus);
  }

  function updateRouteSearchState() {
    const api = window.DHS_ROUTE_SEARCH;
    if (!api || typeof api.updateRouteSearchState !== 'function') return;
    Object.assign(state, api.updateRouteSearchState(state, {
      selected: selectedListingForRouteSearch(),
      signature: routeSearchSignature(),
      nowMs: typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
    }));
  }

  function autoLoopNowMs() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }

  function groupRouteTargets() {
    const api = window.DHS_GROUP_ROUTES;
    if (!api || typeof api.buildGroupRouteTargets !== 'function') return [];
    const providerTargetVisible = Number(state.cpProviderClickTargetCount || 0) > 0;
    const providerAlreadyTried = autoLoopAttemptedKeys.size > 0 || ['opening', 'clicked', 'trusted-clicked', 'background-tab', 'javascript-skipped', 'blocked-naver-gallery-link', 'captured', 'mismatch', 'cancelled'].includes(String(state.providerOpenStatus || ''));
    const deferActiveGroupRoutes = !providerTargetVisible
      && !providerAlreadyTried
      && !state.cpProviderEvidenceSeen
      && !state.sameAddressEvidenceSeen
      && !state.representativeEvidenceSeen
      && !state.complexListEvidenceSeen
      && !state.complexCacheEvidenceSeen
      && Number(state.routeSearchElapsedSec || 0) < PROVIDER_DISCOVERY_GRACE_SEC;
    return api.buildGroupRouteTargets(Object.assign({}, state, {
      autoLoopAttemptedKeys: Array.from(autoLoopAttemptedKeys),
      deferActiveGroupRoutes
    }));
  }

  function markGroupRouteEvidence(category, status) {
    const endpointCategory = sanitizeEndpointCategory(category);
    if (!['sameAddress', 'representativeArticles', 'complexList', 'complexCache'].includes(endpointCategory)) return;
    state.lastNetworkCategory = endpointCategory;
    state.lastNetworkStatus = sanitizeStatus(status);
    incrementNetworkCategory(endpointCategory);
    state.lastEvidenceCategory = endpointCategory;
    state.lastEvidenceStatus = state.lastNetworkStatus;
    if (endpointCategory === 'sameAddress') state.sameAddressEvidenceSeen = true;
    if (endpointCategory === 'representativeArticles') state.representativeEvidenceSeen = true;
    if (endpointCategory === 'complexList') state.complexListEvidenceSeen = true;
    if (endpointCategory === 'complexCache') state.complexCacheEvidenceSeen = true;
  }

  function markNaverReferenceEvidence(category, status) {
    const endpointCategory = sanitizeEndpointCategory(category);
    if (!['landprice', 'prices', 'buildingUnits', 'pyeongtype', 'finFrontApi'].includes(endpointCategory)) return;
    state.lastNetworkCategory = endpointCategory;
    state.lastNetworkStatus = sanitizeStatus(status);
    incrementNetworkCategory(endpointCategory);
    state.lastEvidenceCategory = endpointCategory;
    state.lastEvidenceStatus = state.lastNetworkStatus;
    state.naverCacheEvidenceSeen = true;
  }

  function recordNaverLineMapRouteResult(endpointCategory, status, reason, input) {
    updateLineMapRouteDiagnostics(endpointCategory, 'fetch-naver-line-map-route', sanitizeStatus(status), Object.assign({
      lineMapRowCount: 0,
      routeReason: reason || 'no-line-map'
    }, input || {}));
  }

  async function fetchNaverLineMapRoute(request) {
    const activeApi = await ensureActiveGroupRoutesApi();
    const endpointCategory = sanitizeEndpointCategory(request && request.category) || 'pyeongtype';
    if (!request || !request.present) {
      recordNaverLineMapRouteResult(endpointCategory, 0, request && request.reason ? request.reason : 'not-executable');
      return {
        status: 'skipped',
        reason: request && request.reason ? request.reason : 'not-executable',
        lineMapRowCount: 0
      };
    }
    let responseDeadline = null;
    try {
      responseDeadline = await openJsonResponseDeadline(request.path, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          Accept: 'application/json'
        }
      }, ACTIVE_GROUP_ROUTE_TIMEOUT_MS);
      const response = responseDeadline.response;
      const status = sanitizeStatus(response && response.status);
      markNaverReferenceEvidence(endpointCategory, status);
      if (activeApi && activeApi.shouldStopActiveGroupRouteStatus && activeApi.shouldStopActiveGroupRouteStatus(status)) {
        recordNaverLineMapRouteResult(endpointCategory, status, status ? `http-${status}` : 'http-stop');
        return { status: 'blocked', reason: status ? `http-${status}` : 'http-stop', lineMapRowCount: 0 };
      }
      if (!response || !response.ok) {
        recordNaverLineMapRouteResult(endpointCategory, status, status ? `http-${status}` : 'http-error');
        return { status: 'http-error', reason: status ? `http-${status}` : 'http-error', lineMapRowCount: 0 };
      }
      const contentLength = Number(response.headers && response.headers.get ? response.headers.get('content-length') : 0);
      if (Number.isFinite(contentLength) && contentLength > ACTIVE_GROUP_ROUTE_MAX_BYTES) {
        recordNaverLineMapRouteResult(endpointCategory, status, 'response-too-large');
        return { status: 'skipped', reason: 'response-too-large', lineMapRowCount: 0 };
      }
      const contentType = String(response.headers && response.headers.get ? response.headers.get('content-type') : '');
      if (contentType && !/json/i.test(contentType)) {
        recordNaverLineMapRouteResult(endpointCategory, status, 'non-json');
        return { status: 'skipped', reason: 'non-json', lineMapRowCount: 0 };
      }
      const body = await responseDeadline.readJson();
      const lineMapRowCount = addNaverLineMapRowsFromBody(body, request);
      const buildingUnitsExact = resolveBuildingUnitsExactFromBody(body, endpointCategory, request);
      if (buildingUnitsExact) applyBuildingUnitsExact(buildingUnitsExact);
      updateLineMapRouteDiagnostics(endpointCategory, 'fetch-naver-line-map-route', status, {
        lineMapRowCount,
        lineMapShape: naverLineMapShapeFromBody(body),
        routeReason: lineMapRowCount > 0 ? 'line-map-captured' : 'no-line-map'
      });
      return {
        status: 'fetched',
        reason: lineMapRowCount > 0 ? 'line-map-captured' : 'no-line-map',
        lineMapRowCount,
        buildingUnitsExact,
        category: endpointCategory
      };
    } catch (error) {
      markNaverReferenceEvidence(endpointCategory, 0);
      if (isAbortError(error)) {
        recordNaverLineMapRouteResult(endpointCategory, 0, 'timeout');
        return { status: 'timeout', reason: 'timeout', lineMapRowCount: 0, category: endpointCategory };
      }
      recordNaverLineMapRouteResult(endpointCategory, 0, 'network-error');
      return { status: 'network-error', reason: 'network-error', lineMapRowCount: 0, category: endpointCategory };
    } finally {
      if (responseDeadline) responseDeadline.close();
    }
  }

  function activeGroupRouteResultFromPageEvent(data, request) {
    const status = sanitizeStatus(data && data.status);
    const routeReason = String(data && (data.routeReason || data.reason) || '').slice(0, 80);
    const category = sanitizeEndpointCategory(data && data.endpointCategory) || (request && request.category) || '';
    const candidateCount = Array.isArray(data && data.groupCandidates)
      ? data.groupCandidates.length
      : Math.max(0, Number(data && data.groupCandidateCount || 0) || 0);
    const floorHintRowCount = Array.isArray(data && data.groupFloorHintRows)
      ? data.groupFloorHintRows.length
      : Math.max(0, Number(data && data.groupFloorHintRowCount || 0) || 0);
    const lineMapRowCount = Array.isArray(data && data.lineMapRows)
      ? data.lineMapRows.length
      : Math.max(0, Number(data && data.lineMapRowCount || 0) || 0);
    const shapeSummary = sanitizeRouteShapeSummary(data && data.groupRouteShapeSummary);
    if (status === 429) {
      return { status: 'blocked', reason: routeReason || 'http-429', candidateCount: 0, floorHintRowCount, shapeSummary, lineMapRowCount, category };
    }
    if (!status) {
      return { status: 'network-error', reason: routeReason || 'network-error', candidateCount: 0, floorHintRowCount, shapeSummary, lineMapRowCount, category };
    }
    if (status >= 400) {
      return { status: 'http-error', reason: routeReason || `http-${status}`, candidateCount: 0, floorHintRowCount, shapeSummary, lineMapRowCount, category };
    }
    return {
      status: 'fetched',
      reason: routeReason || (candidateCount > 0
        ? 'candidates-captured'
        : (floorHintRowCount > 0 ? 'floor-hints-captured' : (lineMapRowCount > 0 ? 'line-map-captured' : 'no-candidate'))),
      candidateCount,
      floorHintRowCount,
      shapeSummary,
      lineMapRowCount,
      groupCandidates: Array.isArray(data && data.groupCandidates) ? data.groupCandidates : [],
      groupFloorHintRows: Array.isArray(data && data.groupFloorHintRows) ? data.groupFloorHintRows : [],
      groupFloorHintDiagnostics: sanitizeGroupFloorHintDiagnostics(data && data.groupFloorHintDiagnostics),
      lineMapRows: Array.isArray(data && data.lineMapRows) ? data.lineMapRows : [],
      articleDetailContext: sanitizeArticleDetailContext(data && data.articleDetailContext),
      category
    };
  }

  function fetchActiveGroupRouteWithPageHook(route, request) {
    return new Promise((resolve) => {
      const requestId = `group:${Date.now().toString(36)}:${(activeGroupRouteRequestSeq += 1).toString(36)}`;
      let settled = false;
      let timer = 0;
      const cleanup = () => {
        if (timer) window.clearTimeout(timer);
        window.removeEventListener('message', listener);
      };
      const finish = (result) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };
      const listener = (event) => {
        if (!isTrustedWindowMessage(event)) return;
        const data = event.data || {};
        if (data.source !== PAGE_SOURCE || data.type !== PAGE_EVENT) return;
        if (data.requestId !== requestId || data.eventName !== 'fetch-active-group-route') return;
        finish(activeGroupRouteResultFromPageEvent(data, request));
      };
      window.addEventListener('message', listener);
      timer = window.setTimeout(() => finish({ status: 'unavailable', reason: 'page-hook-timeout', candidateCount: 0 }), ACTIVE_GROUP_ROUTE_TIMEOUT_MS + 1200);
      window.postMessage({
        source: BRIDGE_SOURCE,
        type: PAGE_GROUP_ROUTE_REQUEST,
        version: VERSION,
        requestId,
        route,
        articleMarker: state.articleMarker,
        detailDongToken: state.detailDongToken,
        detailTypeToken: state.detailTypeToken,
        detailDirectionToken: state.detailDirectionToken,
        detailExclusiveSpace: state.detailExclusiveSpace,
        detailPyeongNo: state.detailPyeongNo,
        detailFloorValue: state.detailFloorValue,
        detailFloorBand: state.detailFloorBand,
        detailTotalFloor: state.detailTotalFloor
      }, location.origin);
    });
  }

  async function fetchActiveGroupRoute(route) {
    const previousGroupRouteStatus = state.groupRouteStatus;
    if (activeGroupRouteFetchCount === 0) {
      activeGroupRouteStatusBeforeFetch = previousGroupRouteStatus;
    }
    activeGroupRouteFetchCount += 1;
    state.groupRouteStatus = 'fetching';
    renderOverlay();
    try {
      return await fetchActiveGroupRouteRequest(route);
    } finally {
      activeGroupRouteFetchCount = Math.max(0, activeGroupRouteFetchCount - 1);
      if (activeGroupRouteFetchCount === 0 && state.groupRouteStatus === 'fetching') {
        const restoreStatus = activeGroupRouteStatusBeforeFetch || previousGroupRouteStatus || 'idle';
        state.groupRouteStatus = restoreStatus === 'fetching' ? 'idle' : restoreStatus;
        activeGroupRouteStatusBeforeFetch = '';
        renderOverlay();
      }
    }
  }

  async function fetchActiveGroupRouteRequest(route) {
    const api = activeGroupRoutesApi();
    const pageHookResult = await fetchActiveGroupRouteWithPageHook(route, null);
    if (pageHookResult && pageHookResult.status !== 'unavailable') {
      const pageHookCategory = sanitizeEndpointCategory(pageHookResult.category);
      const pageHookIsComplexCacheRoute = pageHookCategory === 'complexCache' || ['complex-cache', 'complex-cache-quick', 'complexCache'].includes(route);
      const pageHookFoundEvidence =
        Number(pageHookResult.candidateCount || 0) > 0 ||
        Number(pageHookResult.floorHintRowCount || 0) > 0 ||
        Number(pageHookResult.lineMapRowCount || 0) > 0;
      if (pageHookResult.reason !== 'missing-active-route-api' && (!pageHookIsComplexCacheRoute || pageHookFoundEvidence || pageHookResult.status !== 'fetched')) {
        return pageHookResult;
      }
    }

    const resolvedApi = api || await ensureActiveGroupRoutesApi();
    if (!resolvedApi || typeof resolvedApi.buildActiveGroupRouteRequest !== 'function') {
      return { status: 'skipped', reason: 'missing-active-route-api', candidateCount: 0 };
    }
    let currentUrl = null;
    try {
      currentUrl = new URL(location.href);
    } catch (_) {
      currentUrl = null;
    }
    const request = resolvedApi.buildActiveGroupRouteRequest({
      route,
      href: location.href,
      realEstateType: currentUrl ? currentUrl.searchParams.get('a') || '' : '',
      priceType: currentUrl ? currentUrl.searchParams.get('e') || '' : ''
    });
    if (!request || !request.present) {
      return {
        status: 'skipped',
        reason: request && request.reason ? request.reason : 'not-executable',
        candidateCount: 0
      };
    }
    let responseDeadline = null;
    try {
      responseDeadline = await openJsonResponseDeadline(request.path, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          Accept: 'application/json'
        }
      }, ACTIVE_GROUP_ROUTE_TIMEOUT_MS);
      const response = responseDeadline.response;
      const status = sanitizeStatus(response && response.status);
      markGroupRouteEvidence(request.category, status);
      if (resolvedApi.shouldStopActiveGroupRouteStatus && resolvedApi.shouldStopActiveGroupRouteStatus(status)) {
        return { status: 'blocked', reason: status ? `http-${status}` : 'http-stop', candidateCount: 0 };
      }
      if (!response || !response.ok) {
        return { status: 'http-error', reason: status ? `http-${status}` : 'http-error', candidateCount: 0 };
      }
      const contentLength = Number(response.headers && response.headers.get ? response.headers.get('content-length') : 0);
      if (Number.isFinite(contentLength) && contentLength > ACTIVE_GROUP_ROUTE_MAX_BYTES) {
        return { status: 'skipped', reason: 'response-too-large', candidateCount: 0 };
      }
      const contentType = String(response.headers && response.headers.get ? response.headers.get('content-type') : '');
      if (contentType && !/json/i.test(contentType)) {
        return { status: 'skipped', reason: 'non-json', candidateCount: 0 };
      }
      const body = await responseDeadline.readJson();
      state.groupRouteShapeSummary = typeof resolvedApi.summarizeActiveGroupRouteShape === 'function'
        ? resolvedApi.summarizeActiveGroupRouteShape(body)
        : '';
      state.groupRouteShapeBySource = Object.assign({}, state.groupRouteShapeBySource || {}, {
        [request.category]: state.groupRouteShapeSummary
      });
      let lineMapRowCount = addNaverLineMapRowsFromBody(body, { category: request.category });
      const skipFloorHintSearch = detailFloorExactKnown();
      const floorHintRows = skipFloorHintSearch
        ? []
        : typeof resolvedApi.collectActiveGroupFloorHintRows === 'function'
        ? resolvedApi.collectActiveGroupFloorHintRows(body, route)
        : [];
      const floorHintDiagnostics = skipFloorHintSearch
        ? null
        : typeof resolvedApi.collectActiveGroupFloorHintDiagnostics === 'function'
        ? resolvedApi.collectActiveGroupFloorHintDiagnostics(body, route)
        : null;
      const providerLookupRows = typeof resolvedApi.collectActiveGroupProviderLookupRows === 'function'
        ? resolvedApi.collectActiveGroupProviderLookupRows(body, route)
        : [];
      state.groupRouteFloorHintRawCount = floorHintRows.length;
      state.groupRouteFloorHintRawBySource = Object.assign({}, state.groupRouteFloorHintRawBySource || {}, {
        [request.category]: floorHintRows.length
      });
      mergeGroupFloorHintDiagnostics(floorHintDiagnostics, groupSourceFromEndpointCategory(request.category) || request.category);
      addGroupFloorHintRows(floorHintRows, request.category);
      if (request.category === 'complexCache' && typeof resolvedApi.buildNaverBuildingLineMapRouteRequests === 'function') {
        const lineMapRequestResult = resolvedApi.buildNaverBuildingLineMapRouteRequests({
          href: location.href,
          detailDongToken: state.detailDongToken,
          detailTypeToken: state.detailTypeToken,
          detailDirectionToken: state.detailDirectionToken,
          detailExclusiveSpace: state.detailExclusiveSpace,
          detailPyeongNo: state.detailPyeongNo,
          detailBuildNo: state.articleDetailBuildNo,
          detailDongNo: state.articleDetailDongNo,
          detailDisplayDongToken: state.articleDetailDisplayDongToken,
          detailFloorValue: state.detailFloorValue,
          detailFloorBand: state.detailFloorBand,
          detailTotalFloor: state.detailTotalFloor,
          articleMarker: state.articleMarker,
          complexCacheBody: body
        });
        state.lineMapFollowupRequestCount = Array.isArray(lineMapRequestResult.requests) ? lineMapRequestResult.requests.length : 0;
        state.lineMapFollowupReason = lineMapRequestResult.present
          ? (lineMapRequestResult.reason || 'ready')
          : (lineMapRequestResult.reason || 'not-executable');
        for (const lineMapRequest of lineMapRequestResult.requests || []) {
          if (lineMapRecoveryHasTerminalExact()) {
            state.lineMapFollowupReason = 'terminal-exact';
            break;
          }
          recordNaverLineMapRouteResult(lineMapRequest.category, 0, 'queued', {
            lineMapRowCount: 0
          });
          const lineMapResult = await fetchNaverLineMapRoute(lineMapRequest);
          lineMapRowCount += Number(lineMapResult && lineMapResult.lineMapRowCount || 0);
          if (lineMapRecoveryHasTerminalExact()) {
            state.lineMapFollowupReason = 'terminal-exact';
            break;
          }
        }
      } else if (request.category === 'complexCache' && typeof resolvedApi.buildNaverPyeongTypeRouteRequest === 'function') {
        const lineMapRequest = resolvedApi.buildNaverPyeongTypeRouteRequest({
          href: location.href,
          detailDongToken: state.detailDongToken,
          detailTypeToken: state.detailTypeToken,
          detailDirectionToken: state.detailDirectionToken,
          detailExclusiveSpace: state.detailExclusiveSpace,
          detailPyeongNo: state.detailPyeongNo,
          detailFloorValue: state.detailFloorValue,
          detailFloorBand: state.detailFloorBand,
          detailTotalFloor: state.detailTotalFloor,
          articleMarker: state.articleMarker,
          complexCacheBody: body
        });
        state.lineMapFollowupRequestCount = lineMapRequest && lineMapRequest.present ? 1 : 0;
        state.lineMapFollowupReason = lineMapRequest && lineMapRequest.present
          ? 'ready'
          : (lineMapRequest && lineMapRequest.reason || 'not-executable');
        recordNaverLineMapRouteResult(lineMapRequest && lineMapRequest.category, 0, 'queued', {
          lineMapRowCount: 0
        });
        const lineMapResult = await fetchNaverLineMapRoute(lineMapRequest);
        lineMapRowCount += Number(lineMapResult && lineMapResult.lineMapRowCount || 0);
      }
      if (lineMapRowCount || state.buildingUnitsExactPresent) {
        updateLineInference(enrichDetailFloorWithArticleContext(scanDetailFloor()));
        updateLandLinePromotion();
      }
      if (!lineMapRecoveryHasTerminalExact() && !lineMapRecoveryHasDirectHoExactProof()) {
        maybeRunProviderRouteDirectLookup(providerLookupRows, request.category);
      }
      const rows = typeof resolvedApi.collectActiveGroupCandidateRows === 'function'
        ? resolvedApi.collectActiveGroupCandidateRows(body, route)
        : [];
      addGroupCandidateRows(rows, request.category);
      return {
        status: 'fetched',
        reason: rows.length > 0 ? 'candidates-captured' : (lineMapRowCount > 0 ? 'line-map-captured' : 'no-candidate'),
        candidateCount: rows.length,
        floorHintRowCount: floorHintRows.length,
        groupFloorHintDiagnostics: floorHintDiagnostics,
        shapeSummary: state.groupRouteShapeSummary,
        lineMapRowCount
      };
    } catch (error) {
      markGroupRouteEvidence(request.category, 0);
      if (isAbortError(error)) {
        return { status: 'timeout', reason: 'timeout', candidateCount: 0 };
      }
      return { status: 'network-error', reason: 'network-error', candidateCount: 0 };
    } finally {
      if (responseDeadline) responseDeadline.close();
    }
  }

  function applyActiveGroupRouteFetchResult(fetchResult, route) {
    const result = fetchResult || {};
    const source = groupSourceFromEndpointCategory(result.category) || safeGroupCandidateSource(route) || String(result.category || '');
    addGroupCandidateRows(result.groupCandidates, source || result.category);
    addGroupFloorHintRows(result.groupFloorHintRows, source || result.category);
    mergeGroupFloorHintDiagnostics(result.groupFloorHintDiagnostics, source || result.category);
    addNetworkLineMapRows(result.lineMapRows);
    applyArticleDetailContext(result.articleDetailContext);
    const shapeSummary = sanitizeRouteShapeSummary(result.shapeSummary);
    if (shapeSummary) {
      state.groupRouteShapeSummary = shapeSummary;
      if (source) {
        state.groupRouteShapeBySource = Object.assign({}, state.groupRouteShapeBySource || {}, {
          [source]: shapeSummary
        });
      }
    }

    const floorHintRowCount = Number(result.floorHintRowCount);
    if (Number.isFinite(floorHintRowCount) && floorHintRowCount >= 0) {
      state.groupRouteFloorHintRawCount = Math.min(999, Math.max(0, Math.floor(floorHintRowCount)));
      if (source) {
        state.groupRouteFloorHintRawBySource = Object.assign({}, state.groupRouteFloorHintRawBySource || {}, {
          [source]: state.groupRouteFloorHintRawCount
        });
      }
    }
  }

  function applyAutoLoopDecision(decision) {
    const input = decision || {};
    state.autoLoopStatus = input.status || 'idle';
    state.autoLoopReason = input.reason || '';
    state.autoLoopAction = input.action || '';
    state.autoLoopTargetPhase = input.targetPhase || '';
    state.autoLoopTargetRoute = input.targetRoute || '';
    state.autoLoopTargetIndex = Number(input.targetIndex || 0);
    state.autoLoopTargetCount = Number(input.targetCount || 0);
    state.autoLoopAttemptedCount = autoLoopAttemptedKeys.size;
    if (['record-no-result', 'record-blocker', 'record-result'].includes(state.autoLoopAction)) {
      clearProviderCandidate(state.articleMarker);
    }
  }

  async function executeGroupRouteScan(decision) {
    const route = safeGroupCandidateSource(decision && decision.targetRoute);
    const actionKey = String(decision && decision.actionKey || '');
    if (!route || !actionKey || autoLoopAttemptedKeys.has(actionKey)) return;
    const marker = activeProviderArticleMarker();

    autoLoopAttemptedKeys.add(actionKey);
    state.autoLoopLastActionAt = autoLoopNowMs();
    state.autoLoopAttemptedCount = autoLoopAttemptedKeys.size;
    state.groupRouteStatus = 'validating';
    state.groupRouteSource = route;
    state.groupRouteIndex = Number(decision.targetIndex || 0);
    state.groupRouteCount = Number(decision.targetCount || 0);
    state.groupRouteCandidateCount = 0;
    state.groupRouteLastRejectReason = '';
    state.groupRouteFloorHintRawCount = 0;
    state.groupRouteShapeSummary = '';
    state.groupRouteProgressSeq = Math.min(999999, Number(state.groupRouteProgressSeq || 0) + 1);
    state.lastEvent = 'group-route-scan';
    renderOverlay();

    const fetchResult = await fetchActiveGroupRoute(route);
    if (marker && marker !== (state.articleMarker || '')) return;
    applyActiveGroupRouteFetchResult(fetchResult, route);

    const detailFloor = scanDetailFloor();
    const activeDetailFloor = enrichDetailFloorWithArticleContext(detailFloor);
    updateGroupFloorHint(activeDetailFloor, route);
    updateLineInference(activeDetailFloor);
    const result = updateGroupCandidate(activeDetailFloor, route) || {};
    const candidateCount = Number(result.candidateCount || state.groupCandidateCount || 0);
    state.groupRouteCandidateCount = candidateCount;
    if (fetchResult && fetchResult.status === 'blocked') {
      state.groupRouteStatus = 'blocked';
      state.groupRouteLastRejectReason = fetchResult.reason || 'http-stop';
    } else if (result.present) {
      state.groupRouteStatus = 'captured';
      state.groupRouteLastRejectReason = '';
    } else {
      const fetchReason = String(fetchResult && fetchResult.reason || '');
      const resultReason = String(result.reason || state.groupCandidateRejectedReason || '');
      const reason = fetchReason && fetchReason !== 'no-candidate'
        ? fetchReason
        : (resultReason || 'no-matching-candidate');
      state.groupRouteStatus = candidateCount > 0 ? 'rejected' : 'exhausted';
      state.groupRouteLastRejectReason = reason;
      state.groupRouteRejectedCount = Math.min(999, Number(state.groupRouteRejectedCount || 0) + Math.max(1, candidateCount || 0));
    }

    updateLandLinePromotion();
    const resolver = chooseResolverState();
    state.resolverBranch = resolver.branch;
    state.resolverOutcome = resolver.outcome;
    state.groupRouteProgressSeq = Math.min(999999, Number(state.groupRouteProgressSeq || 0) + 1);
    scheduleScan('group-route-scan');
  }

  function lineMapRecoveryKey(detailFloor) {
    const input = detailFloor || {};
    const targetContext = currentCdpTargetContext() || {};
    const appliedAt = Number(targetContext.__dhsAppliedAt || 0) || 0;
    const recoveryEpoch = appliedAt > 0
      ? `target:${Math.floor(appliedAt)}`
      : `window:${Math.floor(Date.now() / LINE_MAP_RECOVERY_RETRY_MS)}`;
    const exactFloorContext = String(input.detailFloorKind || '') === 'exact'
      && Number(input.floorValue || 0) > 0;
    return [
      currentLineMapRecoveryArticleMarker() || 'article:unknown',
      input.detailDongToken || '',
      input.detailTypeToken || '',
      input.detailFloorKind || '',
      input.detailFloorBand || '',
      Number(input.floorValue || 0) || 0,
      Number(input.totalFloor || 0) || 0,
      exactFloorContext ? 0 : Number(input.detailExclusiveSpace || 0) || 0,
      exactFloorContext ? '' : (input.detailPyeongNo || ''),
      recoveryEpoch
    ].join('|');
  }

  function publishLineMapRecoveryState(reason) {
    const resolver = chooseResolverState();
    state.resolverBranch = resolver.branch;
    state.resolverOutcome = resolver.outcome;
    scheduleScan(reason || 'line-map-recovery');
  }

  function lineMapRecoveryHasTerminalExact() {
    return Boolean(
      state.buildingUnitsExactPresent ||
      (
        state.landLineCandidatePresent &&
        state.landLineCandidateCertainty === 'LAND_LINE' &&
        state.landLineCandidateSource === 'land-line-direct-ho-corroborated'
      )
    );
  }

  function lineMapRecoveryHasDirectHoExactProof() {
    return Boolean(
      state.articleMarker &&
      state.detailDongToken &&
      state.detailTypeToken &&
      state.detailFloorKind === 'exact' &&
      Number(state.detailFloorValue || 0) > 0 &&
      state.lineInferenceStatus === 'single-estimated' &&
      state.lineInferenceReason === 'line-type-corroborated-direct-ho' &&
      Number(state.lineInferenceCandidateCount || 0) === 1 &&
      Number(state.lineInferenceDirectHoEvidenceCount || 0) >= 2
    );
  }

  function shouldFetchArticleDetailForLineMapRecovery(detailFloor) {
    const input = detailFloor || {};
    const missingPyeongNo = !state.articleDetailPyeongNo && !input.detailPyeongNo;
    return missingPyeongNo;
  }

  function currentLineMapRecoveryArticleMarker() {
    const targetContext = currentCdpTargetContext() || {};
    return sanitizeArticleMarker(targetContext.articleMarker || state.articleMarker || '');
  }

  function shouldPrioritizeFinFrontLineMap(detailFloor) {
    return finFrontPriorityDecision(detailFloor).prioritize;
  }

  function finFrontPriorityDecision(detailFloor) {
    const input = detailFloor || {};
    const floorKind = String(input.detailFloorKind || state.detailFloorKind || '');
    const floorValue = Number(input.floorValue || input.detailFloorValue || state.detailFloorValue || 0) || 0;
    const detailDongToken = String(input.detailDongToken || state.detailDongToken || '');
    const detailTypeToken = String(input.detailTypeToken || state.detailTypeToken || '');
    if (!runtimeContextActive) return { prioritize: false, reason: 'runtime-inactive' };
    if (floorKind !== 'exact' || floorValue <= 0) return { prioritize: false, reason: 'floor-not-exact' };
    if (!detailDongToken) return { prioritize: false, reason: 'missing-dong' };
    if (!detailTypeToken) return { prioritize: false, reason: 'missing-type' };
    const request = providerLookupRequestFromUrl();
    if (!request.listingKey || !request.articleMarker) {
      return { prioritize: false, reason: request.rejectReason || 'missing-key' };
    }
    return { prioritize: true, reason: 'ready' };
  }

  function hasFinFrontPriorityContextShape(detailFloor) {
    const input = detailFloor || {};
    const floorKind = String(input.detailFloorKind || state.detailFloorKind || '');
    const floorValue = Number(input.floorValue || input.detailFloorValue || state.detailFloorValue || 0) || 0;
    return Boolean(
      floorKind === 'exact' &&
      floorValue > 0 &&
      String(input.detailDongToken || state.detailDongToken || '') &&
      String(input.detailTypeToken || state.detailTypeToken || '')
    );
  }

  async function waitForFinFrontPriorityContext(detailFloor, timeoutMs = 650) {
    const startedAt = Date.now();
    let current = detailFloor || {};
    let decision = finFrontPriorityDecision(current);
    while (runtimeContextActive && Date.now() - startedAt <= timeoutMs) {
      if (decision.prioritize) {
        return { prioritize: true, detailFloor: current, reason: decision.reason };
      }
      if (!hasFinFrontPriorityContextShape(current)) break;
      await delayMs(75);
      current = enrichDetailFloorWithArticleContext(scanDetailFloor());
      decision = finFrontPriorityDecision(current);
    }
    return { prioritize: false, detailFloor: current, reason: decision.reason };
  }

  function shouldStartEarlyFinFrontRecovery(currentState, detailFloor) {
    const current = currentState && typeof currentState === 'object' ? currentState : {};
    const input = detailFloor && typeof detailFloor === 'object' ? detailFloor : {};
    if (String(current.lineInferenceStatus || '')) return false;
    if (Number(current.lineInferenceRowCount || 0) > 0) return false;
    const floorKind = String(input.detailFloorKind || input.floorKind || current.detailFloorKind || '');
    const floorValue = Number(
      input.floorValue || input.detailFloorValue || current.detailFloorValue || 0
    ) || 0;
    const dongToken = String(input.detailDongToken || current.detailDongToken || '');
    const typeToken = String(input.detailTypeToken || current.detailTypeToken || '');
    return floorKind === 'exact' && floorValue > 0 && Boolean(dongToken && typeToken);
  }

  function requestLineMapRecoveryAfterContext(detailFloor) {
    const input = detailFloor || {};
    if (!input.detailDongToken || !input.detailTypeToken) return;
    const shouldStartEarlyFinFront = shouldStartEarlyFinFrontRecovery(state, input);
    const shouldRecoverLineMap = shouldStartEarlyFinFront || (
      state.lineInferenceStatus === 'no-map' &&
      Number(state.lineInferenceRowCount || 0) <= 0
    ) || (
      state.lineInferenceStatus === 'single-estimated' &&
      !lineMapRecoveryHasDirectHoExactProof()
    );
    const shouldRecoverBuildingUnits = Boolean(
      state.articleMarker
      && !state.buildingUnitsExactPresent
      && (!state.buildingUnitsExactReason || ['missing-article-marker', 'no-article-linked-unit'].includes(state.buildingUnitsExactReason))
    );
    if (!shouldRecoverLineMap && !shouldRecoverBuildingUnits) return;
    if (!runtimeContextActive || lineMapRecoveryPending) return;
    if (shouldStartEarlyFinFront) state.lineMapFollowupReason = 'early-exact-floor-no-map';
    lineMapRecoveryPending = true;
    safeBridgeTask(async () => {
      try {
        const priorityStartedAt = Date.now();
        state.finFrontPriorityAttemptCount = Math.min(999, Number(state.finFrontPriorityAttemptCount || 0) + 1);
        let initialDetailFloor = enrichDetailFloorWithArticleContext(scanDetailFloor());
        let priorityDecision = finFrontPriorityDecision(initialDetailFloor);
        let prioritizeFinFront = priorityDecision.prioritize;
        if (!prioritizeFinFront && hasFinFrontPriorityContextShape(initialDetailFloor)) {
          const priorityContext = await waitForFinFrontPriorityContext(initialDetailFloor);
          initialDetailFloor = priorityContext.detailFloor;
          prioritizeFinFront = priorityContext.prioritize;
          priorityDecision = priorityContext;
        }
        state.finFrontPriorityWaitMs = Math.max(0, Date.now() - priorityStartedAt);
        state.finFrontPriorityReason = priorityDecision.reason || 'not-ready';
        if (prioritizeFinFront) {
          state.finFrontPriorityHitCount = Math.min(999, Number(state.finFrontPriorityHitCount || 0) + 1);
        }
        const key = lineMapRecoveryKey(initialDetailFloor);
        if (lineMapRecoveryKeys.has(key)) return;
        lineMapRecoveryKeys.add(key);
        if (lineMapRecoveryKeys.size > 80) lineMapRecoveryKeys.clear();
        const marker = currentLineMapRecoveryArticleMarker();
        if (prioritizeFinFront) {
          const stillActive = await recoverFinFrontLineMap(marker, initialDetailFloor);
          if (!stillActive) return;
          if (lineMapRecoveryHasTerminalExact()) return;
        }
        const articleDetailFloorBeforeFetch = enrichDetailFloorWithArticleContext(scanDetailFloor());
        if (shouldFetchArticleDetailForLineMapRecovery(articleDetailFloorBeforeFetch)) {
          const articleFetchResult = await fetchActiveGroupRoute('article-detail');
          if (!runtimeContextActive || marker !== currentLineMapRecoveryArticleMarker()) return;
          applyActiveGroupRouteFetchResult(articleFetchResult, 'article-detail');
          const articleDetailFloor = enrichDetailFloorWithArticleContext(scanDetailFloor());
          state.detailExclusiveSpace = Number(articleDetailFloor.detailExclusiveSpace || 0) || 0;
          state.detailPyeongNo = articleDetailFloor.detailPyeongNo || '';
          updateGroupFloorHint(articleDetailFloor, 'article-detail');
          updateLineInference(articleDetailFloor);
        }
        const fetchResult = await fetchActiveGroupRoute('complex-cache');
        if (!runtimeContextActive || marker !== currentLineMapRecoveryArticleMarker()) return;
        applyActiveGroupRouteFetchResult(fetchResult, 'complex-cache');
        const refreshedDetailFloor = enrichDetailFloorWithArticleContext(scanDetailFloor());
        updateGroupFloorHint(refreshedDetailFloor, 'complex-cache');
        updateLineInference(refreshedDetailFloor);
        updateGroupCandidate(refreshedDetailFloor, 'complex-cache');
        updateLandLinePromotion();
        publishLineMapRecoveryState('line-map-recovery');
        if (lineMapRecoveryHasTerminalExact()) return;

        if (!prioritizeFinFront) {
          const stillActive = await recoverFinFrontLineMap(marker, enrichDetailFloorWithArticleContext(scanDetailFloor()));
          if (!stillActive) return;
        }
      } finally {
        lineMapRecoveryPending = false;
      }
    });
  }

  async function recoverFinFrontLineMap(marker, detailFloor) {
    const finFetchResult = await fetchFinFrontApiContext(detailFloor);
    if (!runtimeContextActive || marker !== currentLineMapRecoveryArticleMarker()) return false;
    if (finFetchResult) {
      const finDetailFloor = enrichDetailFloorWithArticleContext(scanDetailFloor());
      updateGroupFloorHint(finDetailFloor, 'finFrontApi');
      updateLineInference(finDetailFloor);
      updateLandLinePromotion();
      publishLineMapRecoveryState('fin-front-api');
    }
    return true;
  }

  async function fetchFinFrontApiContext(detailFloor) {
    const request = providerLookupRequestFromUrl();
    if (!runtimeContextActive || !request.listingKey || !request.articleMarker) {
      updateLineMapRouteDiagnostics('finFrontApi', 'fin-front-api-skip', 0, {
        routeReason: request.rejectReason || 'missing-listing-key',
        lineMapRowCount: 0
      });
      return null;
    }
    const marker = request.articleMarker;
    updateLineMapRouteDiagnostics('finFrontApi', 'fin-front-api-start', 0, {
      routeReason: 'requesting',
      lineMapRowCount: 0
    });
    return new Promise((resolve) => {
      const activeDetailFloor = enrichDetailFloorWithArticleContext(detailFloor || scanDetailFloor());
      const sent = safeRuntimeSendMessage({
        source: BRIDGE_SOURCE,
        type: 'NAVER_FIN_ARTICLE_LOOKUP',
        version: VERSION,
        articleMarker: marker,
        naverArticleNumber: request.listingKey,
        detailDongToken: activeDetailFloor.detailDongToken,
        detailTypeToken: activeDetailFloor.detailTypeToken,
        detailFloorValue: activeDetailFloor.floorValue || activeDetailFloor.detailFloorValue,
        detailFloorBand: activeDetailFloor.detailFloorBand,
        detailTotalFloor: activeDetailFloor.totalFloor || activeDetailFloor.detailTotalFloor,
        detailExclusiveSpace: activeDetailFloor.detailExclusiveSpace,
        detailPyeongNo: activeDetailFloor.detailPyeongNo
      }, (response) => {
        if (marker !== currentLineMapRecoveryArticleMarker()) {
          resolve(null);
          return;
        }
        const result = response && typeof response === 'object' ? response : {};
        addNetworkLineMapRows(result.lineMapRows);
        if (result.buildingUnitsExact) applyBuildingUnitsExact(result.buildingUnitsExact);
        applyArticleDetailContext(result.articleDetailContext);
        const status = Number(result.httpStatus || 0) || 0;
        markNaverReferenceEvidence('finFrontApi', status);
        updateLineMapRouteDiagnostics('finFrontApi', 'fin-front-api-result', status, {
          routeReason: result.reason || result.status || 'no-candidate',
          lineMapRows: Array.isArray(result.lineMapRows) ? result.lineMapRows : [],
          lineMapRowCount: Number(result.lineMapRowCount || 0) || 0,
          lineMapShape: result.lineMapShape,
          endpointSummary: summarizeRouteEndpoints(result.endpointStatusByName, result.endpointReasonByName)
        });
        resolve(result);
      });
      if (!sent) {
        updateLineMapRouteDiagnostics('finFrontApi', 'fin-front-api-unavailable', 0, {
          routeReason: 'runtime-unavailable',
          lineMapRowCount: 0
        });
        resolve(null);
      }
    });
  }

  function executeAutoLoopDecision(decision) {
    if (!decision || !['open-provider-target', 'scan-group-route'].includes(decision.action)) return;
    if (autoLoopTimer) return;
    const marker = activeProviderArticleMarker();
    const actionKey = String(decision.actionKey || '');
    autoLoopTimer = window.setTimeout(() => safeBridgeTask(() => {
      autoLoopTimer = 0;
      if (!runtimeContextActive) return;
      if (!marker || marker !== activeProviderArticleMarker()) return;
      if (!actionKey || autoLoopAttemptedKeys.has(actionKey)) return;
      autoLoopAttemptedKeys.add(actionKey);
      state.cpProviderAttemptIndex = Number(decision.targetIndex || 0);
      state.autoLoopLastActionAt = autoLoopNowMs();
      state.autoLoopAttemptedCount = autoLoopAttemptedKeys.size;
      applyAutoLoopDecision(decision);
      renderOverlay();
      if (decision.action === 'scan-group-route') {
        autoLoopAttemptedKeys.delete(actionKey);
        executeGroupRouteScan(decision).catch(() => {
          state.groupRouteStatus = 'exhausted';
          state.groupRouteLastRejectReason = 'network-error';
          state.groupRouteProgressSeq = Math.min(999999, Number(state.groupRouteProgressSeq || 0) + 1);
          scheduleScan('group-route-error');
        });
        return;
      }
      openProviderClickTarget(decision.targetPhase);
    }), AUTO_LOOP_DELAY_MS);
  }

  function updateAutoLoopDecision() {
    const selected = selectedListingForRouteSearch();
    const marker = activeProviderArticleMarker();
    if (!selected || (marker && marker !== autoLoopArticleMarker)) {
      resetAutoLoop(marker && marker !== autoLoopArticleMarker ? 'article-changed' : 'no-selected-listing');
      autoLoopArticleMarker = marker;
    }
    const api = window.DHS_LIVE_LOOP;
    if (!api || typeof api.planLiveAutomation !== 'function') return;
    const decision = api.planLiveAutomation(Object.assign({}, state, {
      autoLoopAttemptedKeys: Array.from(autoLoopAttemptedKeys),
      groupRouteTargets: groupRouteTargets(),
      // Surface the module-scoped line-map recovery flag so the planner can avoid giving up
      // ('record-no-result') before the line map — which also yields provider/group targets — lands.
      lineMapRecoveryPending,
      // Same rationale for an in-flight group-route fetch: don't record no-result while it's pending.
      groupRouteFetchPending: activeGroupRouteFetchCount > 0
    }), {
      nowMs: autoLoopNowMs()
    });
    // R3: cache the freshly-planned decision so the per-render probe dataset can reuse it instead
    // of re-running planLiveAutomation()+groupRouteTargets() a second time each cycle.
    lastPlannedAutoLoopDecision = decision;
    applyAutoLoopDecision(decision);
    executeAutoLoopDecision(decision);
  }

  function scanPage() {
    refreshRegionExportSelectionState();
    const listingStats = scanListingStats();
    Object.assign(state, listingStats);

    const previousScanArticleMarker = state.articleMarker || lastArticleMarker || '';
    const urlArticleMarker = articleMarkerFromUrl();
    const selectedArticleMarker = articleMarkerFromSelectedListing();
    const representativeChildContext = representativeChildContextActive();
    // The article-changed reset is applied below, keyed off the RESOLVED article marker
    // (not the complex/URL marker) so it fires only on a real listing change — not every
    // tick when a listing legitimately resolves to a child marker differing from the URL.
    if (urlArticleMarker) lastArticleMarker = urlArticleMarker;
    const detailFloor = scanDetailFloor();
    const cdpContextArticleMarker = cdpTargetArticleMarkerForDetail(detailFloor);
    const officialTable = scanOfficialTable(detailFloor);
    const articleApi = window.DHS_ARTICLE_STATE;
    // hasDetailContext reads only detailFloor; the previous document-wide button/anchor "official tab"
    // walk (querySelectorAll('button, a') every tick, before the heavy-scan gate) fed an argument that
    // is ignored and a state.officialTabPresent flag that is read nowhere — removed as dead idle work.
    const detailContextPresent = articleApi && typeof articleApi.hasDetailContext === 'function'
      ? articleApi.hasDetailContext(detailFloor)
      : Boolean(detailFloor.detailContextPresent || detailFloor.detailDongToken || (detailFloor.detailFloorKind && detailFloor.detailFloorKind !== 'none'));
    const contextArticleMarker = detailContextArticleMarker(detailFloor);
    const cdpArticleMarker = articleApi && typeof articleApi.resolveVerifiedCdpArticleMarker === 'function'
      ? articleApi.resolveVerifiedCdpArticleMarker({
        targetArticleMarker: cdpContextArticleMarker,
        selectedArticleMarker,
        urlArticleMarker
      })
      : '';
    const articleContext = articleApi && typeof articleApi.resolveArticleSelection === 'function'
      ? articleApi.resolveArticleSelection({
        urlArticleMarker,
        selectedArticleMarker: selectedArticleMarker || cdpArticleMarker,
        preferSelectedArticleMarker: Boolean(cdpArticleMarker) || selectedArticleMarkerSource === 'representative-child' || representativeChildContext,
        currentArticleMarker: state.articleMarker,
        contextArticleMarker,
        lastArticleMarker,
        detailContextPresent
      })
      : {
        articlePresent: Boolean(urlArticleMarker || detailContextPresent),
        articleMarker: urlArticleMarker
      };
    if (articleContext.articleMarker) lastArticleMarker = articleContext.articleMarker;
    if (
      articleContext.articleMarker
      && previousScanArticleMarker
      && articleContext.articleMarker !== previousScanArticleMarker
    ) {
      resetProviderCandidate('idle', 'article-changed');
      resetDirectLookupStatus('idle');
      resetProviderFloorHint('article-changed');
      resetProviderEvidenceTemp();
      state.cpProviderAttemptIndex = 0;
      state.cpProviderAttemptCount = 0;
      state.cpProviderCurrentFamily = '';
      resetResolverEvidence();
      resetCdpResolverFinal('article-changed');
      resetAutoLoop('article-changed');
      resetExactEvidenceReceiptKeys();
      clearConfirmedExactLatch('article-changed');
      clearProviderCandidate(previousScanArticleMarker);
    }

    const activeDetailFloor = enrichDetailFloorWithArticleContext(detailFloor);

    state.articlePresent = articleContext.articlePresent;
    state.articleMarker = articleContext.articleMarker;
    // Start the wall-clock investigation timer the moment a NEW listing appears (≈ user click). The
    // timer is frozen at the terminal resolution in currentListingElapsedSeconds().
    const investigationClockMarker = normalizeText(state.articleMarker || '');
    if (investigationClockMarker && state.investigationClockMarker !== investigationClockMarker) {
      state.investigationClockMarker = investigationClockMarker;
      state.investigationStartedAtMs = Date.now();
    }
    state.selectedArticleMarkerSource = selectedArticleMarkerSource || (representativeChildContext ? 'representative-child' : '');
    state.representativeChildContextPresent = Boolean(representativeChildContext || selectedArticleMarkerSource === 'representative-child');
    const regionExportActiveForGate = ['preparing', 'running', 'saving'].includes(state.regionExportStatus);
    // "Detail expanded" for gating must mean a REAL detail panel is open (text lifted from an
    // actual detail panel), NOT a dong token / listing text from a selected representative-child
    // list row. detailScreenContextPresent/detailContextPresent are both contaminated by the
    // selected-listing fallback text, so gate on detailPanelPresent (Boolean(effectiveDetailPanelText)).
    const listingDetailPanelExpanded = Boolean(detailFloor.detailPanelPresent);
    // A leftover `.detail_contents.is-article` panel from a previously-investigated listing does NOT
    // close when the user then selects a bare group parent, so it reads stale-true. Treat it as
    // not-present when the current selection is a bare group parent → the overlay idles instead of
    // re-showing the old listing's result.
    const effectiveDetailPanelPresent = listingDetailPanelExpanded && !currentSelectionIsBareGroupParent();
    state.detailPanelPresent = effectiveDetailPanelPresent;
    const groupedSelectionContext = representativeChildContext
      || selectedArticleMarkerSource === 'representative-child'
      || selectedListingIsGroupedContext();
    state.groupedListingSelectionPending = !regionExportActiveForGate
      && !effectiveDetailPanelPresent
      && groupedSelectionContext;
    // Identity of the same-unit group this open child belongs to (empty unless a grouped child is
    // actually open) — the key for inheriting a sibling's confirmed exact.
    state.selectedListingGroupKey = effectiveDetailPanelPresent ? selectedListingGroupKey() : '';
    state.detailScreenContextPresent = Boolean(activeDetailFloor.detailScreenContextPresent);
    state.detailContextPresent = detailContextPresent;
    state.detailFloorKind = activeDetailFloor.detailFloorKind;
    state.detailFloorBand = activeDetailFloor.detailFloorBand;
    state.detailFloorValue = activeDetailFloor.floorValue;
    state.detailTotalFloor = activeDetailFloor.totalFloor;
    state.detailDongToken = activeDetailFloor.detailDongToken;
    state.detailTypeToken = activeDetailFloor.detailTypeToken;
    state.detailTypeAliases = Array.isArray(activeDetailFloor.detailTypeAliases) ? activeDetailFloor.detailTypeAliases.slice(0, 6) : [];
    state.detailDirectionToken = activeDetailFloor.detailDirectionToken;
    state.detailExclusiveSpace = Number(activeDetailFloor.detailExclusiveSpace || 0) || 0;
    state.detailPyeongNo = activeDetailFloor.detailPyeongNo || '';
    state.dealType = activeDetailFloor.dealType || '';
    state.priceToken = activeDetailFloor.priceToken || '';
    state.officialRowsPresent = officialTable.officialRowsPresent;
    state.officialFloorRows = officialTable.officialFloorRows;
    state.officialCandidateCells = officialTable.officialCandidateCells;
    state.officialCandidateMode = officialTable.officialCandidateMode;
    state.officialCandidateDisplays = Array.isArray(officialTable.officialCandidateDisplays) ? officialTable.officialCandidateDisplays.slice() : [];
    state.officialExactCandidatePresent = Boolean(officialTable.officialExactCandidatePresent);
    state.officialExactCandidateDisplay = officialTable.officialExactCandidateDisplay || '';
    // Skip the heavy detail-derived scans (line inference, group candidate, whole-document provider
    // scan, resolver) when there's no open article detail (idle / 단지 정보 / group parent), or when
    // the current article is already confirmed-exact latched — nothing to resolve or re-resolve.
    // Skipping never re-derives the latch, so it cannot flip a confirmed result (no 0.1.301 regress).
    const runHeavyScan = (state.detailPanelPresent || regionExportActiveForGate)
      && !isConfirmedExactLatched();
    if (runHeavyScan) {
    updateGroupFloorHint(activeDetailFloor);
    updateLineInference(activeDetailFloor);
    requestLineMapRecoveryAfterContext(activeDetailFloor);
    updateGroupCandidate(activeDetailFloor);
    updateLandLinePromotion();
    const kbAlias = kbAliasEvidenceFromLocation();
    if (kbAlias.present) {
      state.kbAliasEvidenceSeen = true;
      state.kbAliasMarker = kbAlias.aliasMarker || state.kbAliasMarker;
      state.kbAliasReadiness = 'direct-alias';
    }
    const cpSignal = scanProviderContext(activeDetailFloor);
    const providerFamilies = activeProviderFamilies(cpSignal);
    state.cpTextSignalPresent = cpSignal.present;
    state.cpTextSignalStrong = cpSignal.strong;
    state.cpTextSignalKind = cpSignal.kind;
    state.cpProviderFamilies = providerFamilies;
    state.cpProviderLinkCount = cpSignal.providerLinkCount;
    state.cpProviderClickTargetCount = cpSignal.providerClickTargetCount;
    state.cpProviderGroupTargetCount = cpSignal.providerGroupTargetCount;
    state.cpProviderClickTargetStatus = cpSignal.providerClickTargetStatus;
    state.cpProviderClickTargetPhase = cpSignal.providerClickTargetPhase;
    state.providerTargetVersion = cpSignal.providerTargetVersion;
    state.cpTechnicalIdPresent = cpSignal.cpTechnicalIdPresent;
    if (providerFamilies.length > 1) {
      state.cpParserReadiness = 'ambiguous-provider-family';
    } else {
      state.cpParserReadiness = cpSignal.parserReadiness === 'none' && state.lastEvidenceProviderFamily
        ? 'network-provider'
        : cpSignal.parserReadiness;
    }
    invalidateProviderCandidateForCurrentContext();
    maybeRunCurrentArticleMkDirectLookup();
    maybeRunProviderNameDirectLookup();
    runProviderRouteDirectLookupQueue();

    const resolver = chooseResolverState();
    state.resolverBranch = resolver.branch;
    state.resolverOutcome = resolver.outcome;
    if (
      state.officialExactCandidatePresent
      && state.officialExactCandidateDisplay
      && state.resolverBranch === 'official-table'
      && state.resolverOutcome === 'official-table-exact'
      && currentListingExactResolution(state.officialExactCandidateDisplay).dongHoStatus === 'exact'
    ) {
      markExactEvidenceReceipt('official', [
        state.articleMarker,
        officialTable.officialReceiptKey,
        state.officialExactCandidateDisplay
      ].join('|'));
    }

    updateConfirmedExactLatch();
    }

    if (state.stop) {
      state.diagnosis = 'stop';
    } else if (state.articlePresent && state.resolverBranch !== 'ambiguous') {
      state.diagnosis = 'branch detected';
    } else if (state.articlePresent) {
      state.diagnosis = 'article detected';
    } else if (state.listingCount > 0) {
      state.diagnosis = 'listing detected';
    } else {
      state.diagnosis = 'waiting';
    }

    updateRouteSearchState();
    updateAutoLoopDecision();
    renderOverlay();
  }

  function forceOfficialTableRescanForCdp() {
    if (!runtimeContextActive) return { ok: false, reason: 'runtime-inactive' };
    safeBridgeTask(scanPage);
    return {
      ok: true,
      officialRowsPresent: Boolean(state.officialRowsPresent),
      officialFloorRows: Math.max(0, Number(state.officialFloorRows || 0) || 0),
      officialCandidateCells: Math.max(0, Number(state.officialCandidateCells || 0) || 0)
    };
  }

  function injectPageHook() {
    if (!document.documentElement) return;
    const hookPaths = [
      'src/shared/naver-line-map.js',
      'src/shared/building-units-resolver.js',
      'src/shared/line-inference.js',
      'src/shared/provider-candidate.js',
      'src/shared/active-group-routes.js',
      'src/content/page-hook.js'
    ];
    for (const hookPath of hookPaths) {
      const hookUrl = safeRuntimeGetURL(hookPath);
      if (!hookUrl) continue;
      const script = document.createElement('script');
      script.src = hookUrl;
      script.async = false;
      script.onload = () => script.remove();
      document.documentElement.appendChild(script);
    }
  }

  let scanTimer = 0;
  let scanDueAt = 0;
  function scanDelayForEvent(eventName) {
    const name = String(eventName || '');
    if (name === 'dom-mutation') return DOM_MUTATION_SCAN_DELAY_MS;
    if (/^(listing-|popstate|cdp-target-context)/.test(name)) return USER_INTERACTION_SCAN_DELAY_MS;
    return DEFAULT_SCAN_DELAY_MS;
  }

  function shouldKeepEarlierScheduledScan(currentDueAt, nextDueAt) {
    const current = Number(currentDueAt || 0) || 0;
    const next = Number(nextDueAt || 0) || 0;
    return current > 0 && next > 0 && current <= next;
  }

  function scheduleScan(eventName) {
    if (!runtimeContextActive) return;
    state.lastEvent = eventName || state.lastEvent;
    const delayMs = scanDelayForEvent(eventName);
    const nextDueAt = Date.now() + delayMs;
    if (scanTimer && shouldKeepEarlierScheduledScan(scanDueAt, nextDueAt)) return;
    window.clearTimeout(scanTimer);
    scanDueAt = nextDueAt;
    scanTimer = window.setTimeout(() => {
      scanTimer = 0;
      scanDueAt = 0;
      safeBridgeTask(scanPage);
    }, delayMs);
  }

  function nodeInsideDhsOverlay(node) {
    if (!node) return false;
    const element = node.nodeType === Node.ELEMENT_NODE
      ? node
      : (node.parentElement || null);
    if (!element) return false;
    if (element.id === OVERLAY_ID) return true;
    return Boolean(element.closest && element.closest(`#${OVERLAY_ID}`));
  }

  function mutationTouchesOnlyOverlay(mutation) {
    if (!mutation) return false;
    // The mutation target is the (still-attached) parent where the change happened. When the
    // overlay re-renders (textContent/innerHTML replacement) the removed nodes are already
    // detached, so tracing THEM back to the overlay fails and the mutation looks external —
    // which fed a render→observe→scan loop. The target still resolves, so check it first: a
    // change whose target is inside the overlay is overlay-only regardless of detached nodes.
    if (nodeInsideDhsOverlay(mutation.target)) return true;
    const changedNodes = []
      .concat(Array.from(mutation.addedNodes || []))
      .concat(Array.from(mutation.removedNodes || []))
      .filter(Boolean);
    if (changedNodes.length > 0) return changedNodes.every(nodeInsideDhsOverlay);
    return false;
  }

  function shouldScanForMutation(mutations) {
    const list = Array.from(mutations || []);
    if (!list.length) return true;
    return list.some((mutation) => !mutationTouchesOnlyOverlay(mutation));
  }

  function sanitizeProviderDongHoDisplay(value) {
    const text = normalizeText(value);
    return new RegExp(`^\\d{1,4}\\s*${DONG}\\s+\\d{1,4}\\s*${HO}$`).test(text) ? text : '';
  }

  function sanitizeProviderHoOnlyDisplay(value) {
    const text = normalizeText(value);
    return new RegExp(`^\\d{2,4}\\s*${HO}$`).test(text) ? text : '';
  }

  function hydrateProviderDisplay(kind, value) {
    const dongHo = sanitizeProviderDongHoDisplay(value);
    if (dongHo) return dongHo;
    if (kind !== 'ho-only') return '';
    const hoOnly = sanitizeProviderHoOnlyDisplay(value) || extractHoToken(value);
    const dongToken = extractDongToken(state.detailDongToken || '');
    return hoOnly && dongToken ? `${dongToken} ${hoOnly}` : '';
  }

  function allowsProviderHoOnlyBandContextFallback(input) {
    const candidateInput = input && typeof input === 'object' ? input : {};
    return String(candidateInput.providerFamily || '') === 'mk' &&
      String(candidateInput.sourceField || '') === 'mk-visible-text';
  }

  function isTrustedDirectCpidCandidateFallback(input) {
    const candidateInput = input && typeof input === 'object' ? input : {};
    const providerFamily = String(candidateInput.providerFamily || '');
    const cpid = String(candidateInput.providerCpid || '').toLowerCase();
    const sourceField = String(candidateInput.sourceField || '').toLowerCase();
    return providerFamily === 'mk' &&
      cpid === 'bizmk' &&
      ['address2', 'addr2', 'detailaddress', 'dongho', 'atclname'].includes(sourceField);
  }

  function providerCandidateMatchesListingContextFallback(input, context) {
    const candidateInput = input && typeof input === 'object' ? input : {};
    const listingContext = context && typeof context === 'object' ? context : {};
    const displayCandidate = normalizeText(candidateInput.displayCandidate || '');
    const candidateDongToken = extractDongToken(displayCandidate);
    const candidateHoToken = extractHoToken(displayCandidate);
    const detailDongToken = extractDongToken(listingContext.detailDongToken || listingContext.detailText || '');
    if (!candidateDongToken || !candidateHoToken) return { matches: false, reason: 'invalid-candidate' };
    if (!detailDongToken) return { matches: false, reason: 'missing-context' };
    if (candidateDongToken !== detailDongToken) return { matches: false, reason: 'dong-mismatch' };

    const candidateFloorValue = floorValueFromHoToken(candidateHoToken);
    if (!candidateFloorValue) return { matches: false, reason: 'floor-unknown' };

    const providerFloorHintValue = Number(candidateInput.floorHintValue || 0);
    if (providerFloorHintValue > 0 && candidateFloorValue !== providerFloorHintValue) {
      return { matches: false, reason: 'provider-floor-mismatch' };
    }

    const floorKind = String(listingContext.detailFloorKind || listingContext.floorKind || '');
    if (
      String(candidateInput.candidateKind || '') === 'ho-only' &&
      floorKind === 'band' &&
      !(providerFloorHintValue > 0) &&
      !allowsProviderHoOnlyBandContextFallback(candidateInput)
    ) {
      return { matches: false, reason: 'ho-only-band-context' };
    }

    const detailFloorValue = floorKind === 'exact'
      ? Number(listingContext.detailFloorValue || listingContext.floorValue || 0)
      : 0;
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
      if (candidateFloorValue >= range[0] && candidateFloorValue <= range[1]) {
        return { matches: true, reason: 'context-match' };
      }
      return isTrustedDirectCpidCandidateFallback(candidateInput)
        ? { matches: true, reason: 'context-match' }
        : { matches: false, reason: 'floor-band-mismatch' };
    }

    return { matches: false, reason: 'missing-context' };
  }

  function sanitizeProviderCandidate(input) {
    const api = providerCandidateApi();
    const candidate = api && typeof api.sanitizeProviderCandidate === 'function'
      ? api.sanitizeProviderCandidate(input)
      : (input && typeof input === 'object' ? input : {});
    const providerFamily = sanitizeProviderFamily(candidate.providerFamily);
    const sourceField = String(candidate.sourceField || '');
    const kind = String(candidate.candidateKind || '');
    const marker = String(candidate.redactedCandidate || '');
    const display = hydrateProviderDisplay(kind, candidate.displayCandidate || '');
    const providerCpid = String(candidate.providerCpid || '');
    const providerSourceLabel = String(candidate.providerSourceLabel || '');
    const certainty = String(candidate.certainty || '');
    const rank = Number(candidate.rank || 0) || 0;
    if (!candidate.present || !providerFamily) return null;
    if (!['dong-ho', 'ho-only'].includes(kind)) return null;
    if (!/^candidate:[a-f0-9]{8}$/.test(marker)) return null;
    if (!display) return null;
    const candidateInput = {
      displayCandidate: display,
      candidateKind: kind,
      providerFamily,
      sourceField,
      providerCpid,
      providerSourceLabel,
      certainty,
      floorHintValue: candidate.floorHintPresent ? Number(candidate.floorHintValue || 0) : 0
    };
    const listingContext = {
      detailDongToken: state.detailDongToken,
      detailFloorKind: state.detailFloorKind,
      detailFloorBand: state.detailFloorBand,
      detailFloorValue: state.detailFloorValue,
      detailTotalFloor: state.detailTotalFloor
    };
    const match = api && typeof api.candidateMatchesListingContext === 'function'
      ? api.candidateMatchesListingContext(candidateInput, listingContext)
      : providerCandidateMatchesListingContextFallback(candidateInput, listingContext);
    if (!match.matches) {
      return {
        providerFamily,
        sourceField,
        providerCpid,
        providerSourceLabel,
        certainty,
        rank,
        kind,
        marker,
        display,
        accepted: false,
        reason: match.reason || 'context-mismatch'
      };
    }
    return {
      providerFamily,
      sourceField,
      providerCpid,
      providerSourceLabel,
      certainty,
      rank,
      kind,
      marker,
      display,
      accepted: true,
      reason: 'context-match'
    };
  }

  function sanitizeProviderFloorHint(input) {
    const api = providerCandidateApi();
    const candidate = api && typeof api.sanitizeProviderCandidate === 'function'
      ? api.sanitizeProviderCandidate(input)
      : (input && typeof input === 'object' ? input : {});
    const providerFamily = sanitizeProviderFamily(candidate.providerFamily);
    const floorValue = Number(candidate.floorHintValue || 0);
    const totalFloor = Number(candidate.floorHintTotal || 0);
    const marker = String(candidate.floorHintMarker || '');
    if (!candidate.floorHintPresent || !providerFamily) return null;
    if (!/^floor:[a-f0-9]{8}$/.test(marker)) return null;
    if (!(floorValue > 0)) return null;
    return {
      providerFamily,
      floorValue,
      totalFloor,
      marker,
      accepted: true,
      reason: 'provider-floor-hint'
    };
  }

  function providerCandidateResponseList(response) {
    if (response && Array.isArray(response.candidates)) {
      return response.candidates.filter((candidate) => candidate && typeof candidate === 'object');
    }
    return response && response.candidate && typeof response.candidate === 'object'
      ? [response.candidate]
      : [];
  }

  function sanitizeProviderTempTargetPhase(value) {
    const phase = normalizeText(value);
    return ['direct-provider', 'group-target', 'group-route-provider', 'provider-name'].includes(phase) ? phase : '';
  }

  function sanitizeProviderTempTargetIndex(value) {
    const number = Math.floor(Number(value || 0));
    return Number.isFinite(number) && number >= 0 && number <= 999 ? number : 0;
  }

  function sanitizeProviderEvidenceToken(value, maxLength) {
    return normalizeText(value).replace(/[^A-Za-z0-9_:-]/g, '').slice(0, maxLength || 40);
  }

  function sanitizeProviderEvidenceKind(value) {
    const kind = sanitizeProviderEvidenceToken(value, 20);
    return ['dong-ho', 'ho-only', 'floor-only', 'none'].includes(kind) ? kind : '';
  }

  function sanitizeProviderEvidenceObservationReason(value) {
    const reason = normalizeText(value).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
    return ['provider-page-observed', 'provider-page-no-candidate'].includes(reason) ? reason : '';
  }

  function sanitizeProviderEvidenceSourceSummary(input) {
    const data = input && typeof input === 'object' ? input : {};
    return {
      providerFamily: sanitizeProviderFamily(data.providerFamily),
      sourceField: sanitizeProviderEvidenceToken(data.sourceField, 40),
      candidateKind: sanitizeProviderEvidenceKind(data.candidateKind),
      providerSourceLabel: sanitizeProviderEvidenceToken(data.providerSourceLabel, 40),
      certainty: sanitizeProviderEvidenceToken(data.certainty, 40),
      present: Boolean(data.present),
      floorHintPresent: Boolean(data.floorHintPresent),
      floorHintSourceField: sanitizeProviderEvidenceToken(data.floorHintSourceField, 40)
    };
  }

  function applyProviderEvidenceSummary(summary) {
    const input = summary && typeof summary === 'object' ? summary : {};
    state.providerEvidenceTempPendingActive = Boolean(input.pendingActive);
    state.providerEvidenceTempCount = Math.min(999, Math.max(0, Number(input.candidateCount || 0) || 0));
    state.providerEvidenceTempExactCount = Math.min(999, Math.max(0, Number(input.exactCandidateCount || 0) || 0));
    state.providerEvidenceTempFloorCount = Math.min(999, Math.max(0, Number(input.floorHintCount || 0) || 0));
    state.providerEvidenceTempFamilies = uniqueValues((Array.isArray(input.providerFamilies) ? input.providerFamilies : [])
      .map((family) => sanitizeProviderFamily(family))
      .filter(Boolean))
      .slice(0, 12);
    state.providerEvidenceTempSourceSummaries = (Array.isArray(input.sourceSummaries) ? input.sourceSummaries : [])
      .map(sanitizeProviderEvidenceSourceSummary)
      .slice(0, 6);
    state.providerEvidenceTempLastObservationReason = sanitizeProviderEvidenceObservationReason(input.lastObservationReason);
    state.providerEvidenceTempLastObservationFamily = sanitizeProviderFamily(input.lastObservationFamily);
    state.providerEvidenceTempLastObservationCandidatePresent = Boolean(input.lastObservationCandidatePresent);
    state.providerEvidenceTempLastObservationFloorHintPresent = Boolean(input.lastObservationFloorHintPresent);
    state.providerEvidenceTempTargetPhase = sanitizeProviderTempTargetPhase(input.requestTargetPhase);
    state.providerEvidenceTempTargetIndex = sanitizeProviderTempTargetIndex(input.requestTargetIndex);
    state.providerEvidenceTempTargetCount = sanitizeProviderTempTargetIndex(input.requestTargetCount);
    state.providerEvidenceTempTargetFamily = sanitizeProviderFamily(input.requestTargetFamily);
    state.providerEvidenceTempTabsCloseScheduled = false;
    if (state.providerEvidenceTempPendingActive || state.providerEvidenceTempCount > 0) {
      state.providerEvidenceTempClearedCandidateCount = 0;
      state.providerEvidenceTempClearedPendingRequest = false;
    }
  }

  function resetProviderEvidenceTemp() {
    state.providerEvidenceTempPendingActive = false;
    state.providerEvidenceTempCount = 0;
    state.providerEvidenceTempExactCount = 0;
    state.providerEvidenceTempFloorCount = 0;
    state.providerEvidenceTempFamilies = [];
    state.providerEvidenceTempSourceSummaries = [];
    state.providerEvidenceTempLastObservationReason = '';
    state.providerEvidenceTempLastObservationFamily = '';
    state.providerEvidenceTempLastObservationCandidatePresent = false;
    state.providerEvidenceTempLastObservationFloorHintPresent = false;
    state.providerEvidenceTempClearedCandidateCount = 0;
    state.providerEvidenceTempClearedPendingRequest = false;
    state.providerEvidenceTempTargetPhase = '';
    state.providerEvidenceTempTargetIndex = 0;
    state.providerEvidenceTempTargetCount = 0;
    state.providerEvidenceTempTargetFamily = '';
    state.providerEvidenceTempTabsCloseScheduled = false;
    state.providerRequestKey = '';
  }

  function markProviderEvidencePending(summary) {
    resetProviderEvidenceTemp();
    applyProviderEvidenceSummary(Object.assign({
      pendingActive: true,
      candidateCount: 0,
      exactCandidateCount: 0,
      floorHintCount: 0,
      providerFamilies: []
    }, summary && typeof summary === 'object' ? summary : {}));
  }

  function applyProviderClearResult(result) {
    const input = result && typeof result === 'object' ? result : {};
    state.providerEvidenceTempPendingActive = false;
    state.providerEvidenceTempCount = 0;
    state.providerEvidenceTempExactCount = 0;
    state.providerEvidenceTempFloorCount = 0;
    state.providerEvidenceTempFamilies = [];
    state.providerEvidenceTempSourceSummaries = [];
    state.providerEvidenceTempLastObservationReason = '';
    state.providerEvidenceTempLastObservationFamily = '';
    state.providerEvidenceTempLastObservationCandidatePresent = false;
    state.providerEvidenceTempLastObservationFloorHintPresent = false;
    state.providerEvidenceTempClearedCandidateCount = Math.min(999, Math.max(0, Number(input.clearedCandidateCount || 0) || 0));
    state.providerEvidenceTempClearedPendingRequest = Boolean(input.clearedPendingRequest);
    state.providerEvidenceTempTargetPhase = '';
    state.providerEvidenceTempTargetIndex = 0;
    state.providerEvidenceTempTargetCount = 0;
    state.providerEvidenceTempTargetFamily = '';
    state.providerEvidenceTempTabsCloseScheduled = Boolean(input.providerTabsCloseScheduled);
    state.providerRequestKey = '';
  }

  function providerLineCandidateDisplays() {
    return (Array.isArray(state.lineInferenceCandidateDisplays) ? state.lineInferenceCandidateDisplays : [])
      .map((item) => normalizeText(item))
      .filter((item) => /^\d{1,4}\s*\uB3D9\s+\d{2,4}\s*\uD638$/.test(item))
      .slice(0, 80);
  }

  function providerListingContext() {
    return {
      detailDongToken: state.detailDongToken,
      detailFloorKind: state.detailFloorKind,
      detailFloorBand: state.detailFloorBand,
      detailFloorValue: state.detailFloorValue,
      detailTotalFloor: state.detailTotalFloor,
      detailTypeToken: state.detailTypeToken,
      detailTypeAliases: Array.isArray(state.detailTypeAliases) ? state.detailTypeAliases.slice(0, 6) : [],
      detailDirectionToken: state.detailDirectionToken,
      detailExclusiveSpace: state.detailExclusiveSpace,
      detailPyeongNo: state.detailPyeongNo,
      dealType: state.dealType,
      priceToken: state.priceToken,
      lineCandidateDisplays: providerLineCandidateDisplays()
    };
  }

  function invalidateProviderCandidateForCurrentContext() {
    if (!state.providerCandidatePresent || !state.providerCandidateDisplay) return;
    // A latched confirmed exact for this listing must not be revoked by a transient context read.
    if (state.confirmedExactMarker && state.confirmedExactMarker === normalizeText(state.articleMarker || '')) return;
    const api = providerCandidateApi();
    const candidateInput = {
      displayCandidate: state.providerCandidateDisplay,
      candidateKind: state.providerCandidateKind,
      providerFamily: state.providerCandidateFamily ||
        state.providerDirectLookupProviderFamily ||
        state.lastEvidenceProviderFamily ||
        (Array.isArray(state.cpProviderFamilies) ? state.cpProviderFamilies[0] : ''),
      sourceField: state.providerCandidateSource,
      floorHintValue: state.providerFloorHintPresent ? Number(state.providerFloorHintValue || 0) : 0,
      candidateCount: Number(state.providerCandidateCount || 0) || 1
    };
    const match = api && typeof api.candidateMatchesListingContext === 'function'
      ? api.candidateMatchesListingContext(candidateInput, providerListingContext())
      : providerCandidateMatchesListingContextFallback(candidateInput, providerListingContext());
    if (match && match.matches) return;
    const reason = match && match.reason ? match.reason : 'context-mismatch';
    const articleMarker = state.articleMarker || lastArticleMarker || '';
    resetProviderCandidate(reason === 'missing-context' ? 'unverified' : 'mismatch', `stale-context-${reason}`);
    resetProviderFloorHint(`stale-context-${reason}`);
    resetProviderEvidenceTemp();
    if (articleMarker) clearProviderCandidate(articleMarker);
  }

  function selectProviderCandidate(candidates) {
    const presentCandidates = (Array.isArray(candidates) ? candidates : [])
      .filter((candidate) => candidate && candidate.present);
    if (presentCandidates.length < 1) return null;

    const api = providerCandidateApi();
    if (api && typeof api.selectProviderCandidateForListingContext === 'function') {
      return api.selectProviderCandidateForListingContext(presentCandidates, providerListingContext());
    }

    return sanitizeProviderCandidate(presentCandidates[presentCandidates.length - 1]);
  }

  function selectProviderFloorHint(candidates, detailFloor) {
    const items = Array.isArray(candidates) ? candidates : [];
    let rejected = null;
    for (const item of items) {
      const floorHint = sanitizeProviderFloorHint(item);
      if (!floorHint) continue;
      const accepted = validateProviderFloorHint(floorHint, detailFloor);
      if (accepted.accepted) return { floorHint, accepted };
      if (!rejected) rejected = { floorHint, accepted };
    }
    return rejected;
  }

  function providerNoCandidateObservationReason() {
    if (state.providerEvidenceTempLastObservationReason !== 'provider-page-no-candidate') return '';
    if (
      state.providerEvidenceTempCount > 0 ||
      state.providerEvidenceTempExactCount > 0 ||
      (Number(state.providerEvidenceTempFloorCount || 0) > 0 && !detailFloorExactKnown())
    ) return '';
    if (!['opening', 'direct-lookup', 'clicked', 'trusted-clicked', 'background-tab', 'unverified'].includes(state.providerOpenStatus || '')) return '';
    return 'provider-page-no-candidate';
  }

  function finishProviderCandidatePoll(articleMarker, scanReason) {
    clearProviderCandidate(articleMarker);
    scheduleScan(scanReason);
  }

  // A trusted single exact is latched for the active listing (same predicate the scanPage heavy-scan
  // gate uses) — once latched there is nothing left to resolve, so both the heavy scan and this poll
  // must stop rather than keep re-scanning + waking the service worker on a settled listing.
  function isConfirmedExactLatched() {
    return Boolean(
      state.confirmedExactDisplay
      && state.confirmedExactMarker
      && state.confirmedExactMarker === state.articleMarker
    );
  }

  function pollProviderCandidate() {
    if (!runtimeContextActive) return;
    const articleMarker = activeProviderArticleMarker();
    if (!articleMarker) return;
    if (isConfirmedExactLatched()) return;
    safeRuntimeSendMessage({
      source: BRIDGE_SOURCE,
      type: 'GET_PROVIDER_CANDIDATE',
      version: VERSION,
      articleMarker
    }, (response) => {
      if (articleMarker !== activeProviderArticleMarker()) return;
      applyProviderEvidenceSummary(response && response.providerEvidenceSummary);
      const candidates = providerCandidateResponseList(response);
      const detailFloor = scanDetailFloor();
      const floorHintResult = detailFloorExactKnown(detailFloor) ? null : selectProviderFloorHint(candidates, detailFloor);
      if (floorHintResult && floorHintResult.floorHint) {
        state.providerFloorHintFamily = floorHintResult.floorHint.providerFamily;
        state.providerFloorHintValue = floorHintResult.floorHint.floorValue;
        state.providerFloorHintTotal = floorHintResult.floorHint.totalFloor;
        state.providerFloorHintMarker = floorHintResult.floorHint.marker;
        state.providerFloorHintSourceLabel = '';
        if (floorHintResult.accepted.accepted) {
          state.providerFloorHintPresent = true;
          state.providerFloorHintRejectedReason = '';
          const floorReceiptCandidate = candidates.slice().reverse().find((item) => (
            String(item && item.floorHintMarker || '') === floorHintResult.floorHint.marker
          ));
          const floorReceiptRequestKey = normalizeText(floorReceiptCandidate && floorReceiptCandidate.requestKey || '')
            .replace(/[^A-Za-z0-9_:-]/g, '')
            .slice(0, 80);
          const floorReceiptCapturedAt = Math.max(0, Number(floorReceiptCandidate && floorReceiptCandidate.capturedAt || 0) || 0);
          const nextFloorReceiptKey = [
            articleMarker,
            floorHintResult.floorHint.marker,
            floorReceiptRequestKey,
            floorReceiptCapturedAt
          ].join('|');
          if (
            (floorReceiptRequestKey || floorReceiptCapturedAt > 0)
            && nextFloorReceiptKey !== providerFloorEvidenceReceiptKey
          ) {
            providerFloorEvidenceReceiptKey = nextFloorReceiptKey;
            providerFloorEvidenceReceiptSequence = Math.min(
              Number.MAX_SAFE_INTEGER,
              providerFloorEvidenceReceiptSequence + 1
            );
          }
        } else {
          state.providerFloorHintPresent = false;
          state.providerFloorHintRejectedReason = floorHintResult.accepted.reason;
        }
      }
      const candidate = selectProviderCandidate(candidates);
      const noCandidateObservationReason = providerNoCandidateObservationReason();
      if (!candidate) {
        if (floorHintResult) {
          finishProviderCandidatePoll(articleMarker, 'provider-floor-hint');
        } else if (noCandidateObservationReason && state.providerCandidateRejectedReason !== noCandidateObservationReason) {
          state.providerOpenStatus = 'unverified';
          state.providerCandidateRejectedReason = noCandidateObservationReason;
          state.providerCandidateRejectedFamily = state.providerEvidenceTempLastObservationFamily || '';
          finishProviderCandidatePoll(articleMarker, 'provider-page-no-candidate');
        }
        return;
      }
      if (!candidate.accepted) {
        if (candidate.reason === 'missing-validator') {
          resetProviderCandidate('unverified', 'missing-validator');
          state.providerCandidateCount = Number(candidate.candidateCount || 0);
          state.providerCandidateRejectedCount = Number(candidate.rejectedCount || 0);
          state.providerCandidateRankedSummary = sanitizeProviderRankedSummary(candidate.rankedSummary || '');
          state.providerCandidateMarker = candidate.marker || '';
          state.providerCandidateRejectedSourceLabel = candidate.providerSourceLabel || '';
          state.providerCandidateRejectedSource = candidate.sourceField || '';
          state.providerCandidateRejectedCpid = candidate.providerCpid || '';
          state.providerCandidateRejectedCertainty = candidate.certainty || '';
          state.providerCandidateRejectedRank = Number(candidate.rank || 0) || 0;
          state.providerCandidateRejectedKind = candidate.kind || '';
          state.providerCandidateRejectedFamily = candidate.providerFamily || '';
          scheduleScan('provider-candidate-validator-pending');
          return;
        }
        resetProviderCandidate(
          candidate.reason === 'missing-context' || candidate.reason === 'missing-validator' ? 'unverified' : 'mismatch',
          candidate.reason
        );
        state.providerCandidateCount = Number(candidate.candidateCount || 0);
        state.providerCandidateRejectedCount = Number(candidate.rejectedCount || 0);
        state.providerCandidateRankedSummary = sanitizeProviderRankedSummary(candidate.rankedSummary || '');
        state.providerCandidateMarker = candidate.marker || '';
        state.providerCandidateRejectedReason = candidate.reason;
        state.providerCandidateRejectedSourceLabel = candidate.providerSourceLabel || '';
        state.providerCandidateRejectedSource = candidate.sourceField || '';
        state.providerCandidateRejectedCpid = candidate.providerCpid || '';
        state.providerCandidateRejectedCertainty = candidate.certainty || '';
        state.providerCandidateRejectedRank = Number(candidate.rank || 0) || 0;
        state.providerCandidateRejectedKind = candidate.kind || '';
        state.providerCandidateRejectedFamily = candidate.providerFamily || '';
        finishProviderCandidatePoll(articleMarker, 'provider-candidate-rejected');
        return;
      }
      state.providerCandidatePresent = true;
      state.providerCandidateKind = candidate.kind;
      state.providerCandidateFamily = candidate.providerFamily || '';
      state.providerCandidateSource = candidate.sourceField;
      state.providerCandidateSourceLabel = candidate.providerSourceLabel || '';
      state.providerCandidateCpid = candidate.providerCpid || '';
      state.providerCandidateCertainty = candidate.certainty || '';
      state.providerCandidateRank = Number(candidate.rank || 0) || 0;
      state.providerCandidateDisplay = candidate.display;
      state.providerCandidateMarker = candidate.marker;
      state.providerCandidateRejectedReason = '';
      state.providerCandidateRejectedSource = '';
      state.providerCandidateRejectedSourceLabel = '';
      state.providerCandidateRejectedCpid = '';
      state.providerCandidateRejectedCertainty = '';
      state.providerCandidateRejectedRank = 0;
      state.providerCandidateRejectedKind = '';
      state.providerCandidateRejectedFamily = '';
      state.providerCandidateCount = Number(candidate.candidateCount || 1) || 1;
      state.providerCandidateRejectedCount = Number(candidate.rejectedCount || 0) || 0;
      state.providerCandidateRankedSummary = '';
      state.providerOpenStatus = 'captured';
      const receiptCandidate = candidates.slice().reverse().find((item) => (
        String(item && item.redactedCandidate || '') === candidate.marker
      ));
      const receiptRequestKey = normalizeText(receiptCandidate && receiptCandidate.requestKey || '')
        .replace(/[^A-Za-z0-9_:-]/g, '')
        .slice(0, 80);
      const receiptCapturedAt = Math.max(0, Number(receiptCandidate && receiptCandidate.capturedAt || 0) || 0);
      if (
        (receiptRequestKey || receiptCapturedAt > 0)
        && currentListingExactResolution(candidate.display).dongHoStatus === 'exact'
      ) {
        markExactEvidenceReceipt('provider', [
          articleMarker,
          candidate.marker,
          receiptRequestKey,
          receiptCapturedAt
        ].join('|'));
      }
      finishProviderCandidatePoll(articleMarker, 'provider-candidate');
    });
  }

  function validateProviderFloorHint(floorHint, detailFloor) {
    const floor = Number(floorHint && floorHint.floorValue || 0);
    const totalFloor = Number(floorHint && floorHint.totalFloor || 0);
    const expectedTotalFloor = Number(detailFloor && (detailFloor.totalFloor || detailFloor.detailTotalFloor) || 0);
    if (!(floor > 0)) return { accepted: false, reason: 'invalid-floor-hint' };
    if (!detailFloor || !detailFloor.detailDongToken) return { accepted: false, reason: 'missing-context' };
    if (totalFloor > 0 && expectedTotalFloor > 0 && totalFloor !== expectedTotalFloor) {
      return { accepted: false, reason: 'provider-total-floor-mismatch' };
    }
    if (detailFloor.detailFloorKind === 'exact' && Number(detailFloor.floorValue || 0) > 0) {
      return Number(detailFloor.floorValue || 0) === floor
        ? { accepted: true, reason: 'context-match' }
        : { accepted: false, reason: 'provider-floor-mismatch' };
    }
    if (detailFloor.detailFloorKind === 'band' && detailFloor.detailFloorBand && Number(detailFloor.totalFloor || 0) > 0) {
      const range = bandRange(detailFloor.detailFloorBand, detailFloor.totalFloor);
      return range && floor >= range[0] && floor <= range[1]
        ? { accepted: true, reason: 'context-match' }
        : { accepted: false, reason: 'floor-band-mismatch' };
    }
    return { accepted: false, reason: 'missing-context' };
  }

  function providerRequestTargetSummary(input) {
    const data = input && typeof input === 'object' ? input : {};
    return {
      targetPhase: sanitizeProviderTempTargetPhase(data.targetPhase),
      targetIndex: sanitizeProviderTempTargetIndex(data.targetIndex),
      targetCount: sanitizeProviderTempTargetIndex(data.targetCount),
      targetFamily: sanitizeProviderFamily(data.targetFamily)
    };
  }

  function beginProviderRequest(afterBegin, targetSummary) {
    const requestGeneration = providerRequestGeneration;
    const articleMarker = activeProviderArticleMarker();
    if (!runtimeContextActive || !articleMarker) {
      state.providerOpenStatus = 'unverified';
      state.providerCandidateRejectedReason = 'missing-article';
      renderOverlay();
      return;
    }
    const requestTarget = providerRequestTargetSummary(targetSummary);
    safeRuntimeSendMessage({
      source: BRIDGE_SOURCE,
      type: 'BEGIN_PROVIDER_REQUEST',
      version: VERSION,
      articleMarker,
      listingContext: providerListingContext(),
      targetPhase: requestTarget.targetPhase,
      targetIndex: requestTarget.targetIndex,
      targetCount: requestTarget.targetCount,
      targetFamily: requestTarget.targetFamily
    }, (response) => {
      if (requestGeneration !== providerRequestGeneration) return;
      if (!response || !response.ok) {
        state.providerOpenStatus = 'unverified';
        state.providerCandidateRejectedReason = 'request-not-started';
        renderOverlay();
        return;
      }
      markProviderEvidencePending(response.providerEvidenceSummary || {
        requestTargetPhase: requestTarget.targetPhase,
        requestTargetIndex: requestTarget.targetIndex,
        requestTargetCount: requestTarget.targetCount,
        requestTargetFamily: requestTarget.targetFamily
      });
      state.providerRequestKey = sanitizeProviderRequestKey(response.requestKey);
      afterBegin();
    });
  }

  function clearProviderCandidate(articleMarker, forceAll) {
    if (!runtimeContextActive || (!articleMarker && !forceAll)) return;
    const clearMarker = forceAll ? '' : articleMarker;
    safeRuntimeSendMessage({
      source: BRIDGE_SOURCE,
      type: 'CLEAR_PROVIDER_CANDIDATE',
      version: VERSION,
      articleMarker: clearMarker
    }, (response) => {
      if (clearMarker && clearMarker !== activeProviderArticleMarker()) return;
      if (response && response.providerClearResult) {
        applyProviderClearResult(response.providerClearResult);
        renderOverlay();
      }
    });
  }

  function sanitizeEventName(value) {
    const text = String(value || 'page-event');
    return /^[a-z][a-z0-9-]{0,31}$/i.test(text) ? text : 'page-event';
  }

  function sanitizeEndpointCategory(value) {
    const text = String(value || 'other');
    return PAGE_EVENT_CATEGORIES.has(text) ? text : 'other';
  }

  function sanitizeStatus(value) {
    const status = Number(value) || 0;
    return status >= 100 && status <= 599 ? status : 0;
  }

  function sanitizeProviderFamily(value) {
    const family = String(value || '');
    return PROVIDER_FAMILIES.has(family) ? family : '';
  }

  function sanitizeArticleMarker(value) {
    const marker = String(value || '');
    return /^article:[a-f0-9]{8,12}$/.test(marker) ? marker : '';
  }

  function sanitizeProviderRequestKey(value) {
    const key = String(value || '');
    return /^req:[a-z0-9]{2,16}$/.test(key) ? key : '';
  }

  function incrementNetworkCategory(category) {
    const key = String(category || '');
    if (!NETWORK_COUNT_CATEGORIES.has(key)) return;
    const next = Object.assign({}, state.networkCategoryCounts || {});
    next[key] = Math.min(999, (Number(next[key] || 0) || 0) + 1);
    state.networkCategoryCounts = next;
  }

  pageMessageListener = (event) => safeBridgeTask(() => {
    if (!isTrustedWindowMessage(event)) return;
    const data = event.data || {};
    if (data.source === 'DHS_CDP_TARGET_CONTEXT' && data.context && typeof data.context === 'object') {
      applyCdpTargetContext(data.context);
      scheduleScan('cdp-target-context');
      return;
    }
    if (data.source === 'DHS_CDP_RESOLVER_FINAL' && data.payload && typeof data.payload === 'object') {
      if (applyCdpResolverFinal(data.payload)) {
        renderOverlay();
        scheduleScan('cdp-resolver-final-message');
      } else renderOverlay();
      return;
    }
    if (data.source !== PAGE_SOURCE || data.type !== PAGE_EVENT) return;

    const eventName = sanitizeEventName(data.eventName);
    const endpointCategory = sanitizeEndpointCategory(data.endpointCategory);
    const status = sanitizeStatus(data.status);
    const providerFamily = sanitizeProviderFamily(data.providerFamily);
    const articleMarker = sanitizeArticleMarker(data.articleMarker);
    const previousArticleMarker = state.articleMarker || lastArticleMarker;
    state.pageHookVersion = sanitizeVersion(data.version) || state.pageHookVersion;

    if (articleMarker && previousArticleMarker && articleMarker !== previousArticleMarker) {
      resetProviderCandidate('idle', 'article-changed');
      resetDirectLookupStatus('idle');
      resetProviderFloorHint('article-changed');
      resetProviderEvidenceTemp();
      resetResolverEvidence();
      resetExactEvidenceReceiptKeys();
      clearProviderCandidate(previousArticleMarker);
    }
    if (articleMarker) {
      lastArticleMarker = articleMarker;
      state.articlePresent = true;
      state.articleMarker = articleMarker;
    }

    state.lastEvent = eventName;
    state.lastNetworkCategory = endpointCategory;
    state.lastNetworkStatus = status;
    incrementNetworkCategory(endpointCategory);
    applyArticleDetailContext(data.articleDetailContext);
    addGroupCandidateRows(data.groupCandidates, endpointCategory);
    addGroupFloorHintRows(data.groupFloorHintRows, endpointCategory);
    addNetworkLineMapRows(data.lineMapRows);
    if (data.buildingUnitsExact) {
      applyBuildingUnitsExact(data.buildingUnitsExact);
    }
    if ((Array.isArray(data.lineMapRows) && data.lineMapRows.length) || data.buildingUnitsExact) {
      updateLineInference(enrichDetailFloorWithArticleContext(scanDetailFloor()));
      updateLandLinePromotion();
    }
    if (!lineMapRecoveryHasTerminalExact() && !lineMapRecoveryHasDirectHoExactProof()) {
      maybeRunProviderRouteDirectLookup(data.providerLookupRows, endpointCategory);
    }
    if (Array.isArray(data.groupFloorHintRows)) {
      const source = groupSourceFromEndpointCategory(endpointCategory) || endpointCategory;
      state.groupRouteFloorHintRawCount = data.groupFloorHintRows.length;
      state.groupRouteFloorHintRawBySource = Object.assign({}, state.groupRouteFloorHintRawBySource || {}, {
        [source]: data.groupFloorHintRows.length
      });
    }
    if (data.groupRouteShapeSummary) {
      const source = groupSourceFromEndpointCategory(endpointCategory) || endpointCategory;
      const summary = sanitizeRouteShapeSummary(data.groupRouteShapeSummary);
      state.groupRouteShapeSummary = summary;
      state.groupRouteShapeBySource = Object.assign({}, state.groupRouteShapeBySource || {}, {
        [source]: summary
      });
    }
    updateLineMapRouteDiagnostics(endpointCategory, eventName, status, data);
    if (endpointCategory === 'pyeongtype') {
      state.pyeongTypeRouteEvent = eventName;
      state.pyeongTypeRouteStatus = status;
      state.pyeongTypeRouteReason = String(data.routeReason || data.reason || '').slice(0, 80);
      state.pyeongTypeLineMapRowCount = Math.min(
        999,
        Number(state.pyeongTypeLineMapRowCount || 0) + (Array.isArray(data.lineMapRows) ? data.lineMapRows.length : Math.max(0, Number(data.lineMapRowCount || 0) || 0))
      );
    }
    if (['cpProvider', 'sameAddress', 'representativeArticles', 'complexList', 'complexCache', 'landprice', 'prices', 'buildingUnits', 'pyeongtype', 'finFrontApi', 'kbAlias'].includes(state.lastNetworkCategory)) {
      state.lastEvidenceCategory = state.lastNetworkCategory;
      state.lastEvidenceStatus = state.lastNetworkStatus;
      if (state.lastNetworkCategory === 'cpProvider' && providerFamily) {
        state.lastEvidenceProviderFamily = providerFamily;
      }
      if (state.lastNetworkCategory === 'cpProvider') state.cpProviderEvidenceSeen = true;
      if (state.lastNetworkCategory === 'sameAddress') state.sameAddressEvidenceSeen = true;
      if (state.lastNetworkCategory === 'representativeArticles') state.representativeEvidenceSeen = true;
      if (state.lastNetworkCategory === 'complexList') state.complexListEvidenceSeen = true;
      if (state.lastNetworkCategory === 'complexCache') state.complexCacheEvidenceSeen = true;
      if (state.lastNetworkCategory === 'kbAlias') {
        state.kbAliasEvidenceSeen = true;
        if (!state.kbAliasReadiness || state.kbAliasReadiness === 'none') state.kbAliasReadiness = 'seen';
      }
      if (['landprice', 'prices', 'buildingUnits', 'pyeongtype', 'finFrontApi'].includes(state.lastNetworkCategory)) {
        state.naverCacheEvidenceSeen = true;
      }
    }
    if (data.stopState === 'stop') {
      state.stop = true;
      state.diagnosis = 'stop';
    }

    console.info('[DHS_ANYTHING_CHROME]', {
      eventName: state.lastEvent,
      endpointCategory: state.lastNetworkCategory,
      status: state.lastNetworkStatus,
      evidenceCategory: state.lastEvidenceCategory,
      providerFamily: state.lastEvidenceProviderFamily || '',
      resolverBranch: state.resolverBranch,
      resolverOutcome: state.resolverOutcome,
      stop: state.stop
    });
    scheduleScan('page-message');
  });
  window.addEventListener('message', pageMessageListener);

  function start() {
    state.manifestVersion = readManifestVersion();
    window.__DHS_CDP_FORCE_OFFICIAL_SCAN__ = forceOfficialTableRescanForCdp;
    exposeCdpProviderControls();
    safeBridgeTask(injectPageHook);
    if (!runtimeContextActive) return;
    safeBridgeTask(scanPage);
    bridgeObserver = new MutationObserver((mutations) => {
      if (shouldScanForMutation(mutations)) scheduleScan('dom-mutation');
    });
    // Structural detection only needs childList/subtree — a new detail panel arrives as a node
    // insertion. characterData:true additionally fired on ambient map/marker/price-bubble TEXT
    // animation across the whole document, sustaining needless mutation-driven scans (버벅임); dropped.
    bridgeObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    popstateListener = () => scheduleScan('popstate');
    window.addEventListener('popstate', popstateListener);
    listingMouseDownListener = (event) => safeBridgeTask(() => {
      rememberClickedListingRoot(event && event.target);
      if (recentClickedListingText()) scheduleScan('listing-mousedown');
    });
    document.addEventListener('mousedown', listingMouseDownListener, true);
    listingClickListener = (event) => safeBridgeTask(() => {
      const overlay = document.getElementById(OVERLAY_ID);
      if (overlay && event && event.target && overlay.contains(event.target)) return;
      // DHS-native region picking happens entirely in the card; clicks on Naver's own visual selector
      // are no longer hijacked into the DHS flow (the picker never opens that popup).
      rememberClickedListingRoot(event && event.target);
      if (recentClickedListingText()) scheduleScan('listing-click');
    });
    document.addEventListener('click', listingClickListener, true);
    cdpTargetContextListener = (event) => {
      applyCdpTargetContext(event && event.detail);
      scheduleScan('cdp-target-context');
    };
    window.addEventListener('dhs-cdp-target-context', cdpTargetContextListener);
    cdpResolverFinalListener = () => {
      if (applyCdpResolverFinal()) {
        renderOverlay();
        scheduleScan('cdp-resolver-final');
      } else renderOverlay();
    };
    window.addEventListener('dhs-cdp-resolver-final', cdpResolverFinalListener);
    bridgeIntervals.push(window.setInterval(() => scheduleScan('interval'), 800));
    bridgeIntervals.push(window.setInterval(() => safeBridgeTask(pollProviderCandidate), 800));
    safeBridgeTask(pollProviderCandidate);
  }

  if (document.readyState === 'loading') {
    domContentLoadedListener = () => safeBridgeTask(start);
    document.addEventListener('DOMContentLoaded', domContentLoadedListener, { once: true });
  } else {
    safeBridgeTask(start);
  }
})();
