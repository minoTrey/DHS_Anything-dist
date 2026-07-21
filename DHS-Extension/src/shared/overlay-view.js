(function exposeOverlayView(globalScope) {
  let nodePresentationApi = null;

  if (typeof require === 'function') {
    try {
      nodePresentationApi = require('./dongho-presentation');
    } catch (_) {
      nodePresentationApi = null;
    }
  }

  const PROVIDER_LABELS = {
    mk: 'MK \uBD80\uB3D9\uC0B0',
    r114: 'R114',
    gongsilclub: 'Gongsil Club',
    homesdid: 'Homes DID',
    serve: '\uBD80\uB3D9\uC0B0\uC368\uBE0C',
    rfine: 'R-FINE',
    rter: 'Rter/Rego',
    asil: '\uC544\uC2E4',
    hankyung: '\uD55C\uACBD\uBD80\uB3D9\uC0B0',
    daara: '\uB2E4\uC544\uB77C',
    neonet: 'Neonet',
    ten: 'TEN',
    kar: 'KAR \uD55C\uBC29',
    thebiz: 'TheBiz',
    kiso: 'KISO Land Center',
    woori: 'Woori House',
    other: '\uAE30\uD0C0 \uC81C\uACF5\uCC98'
  };

  const LAND_LINE_CONFIRMED_SOURCES = new Set([
    'land-line-after-group',
    'land-line-after-provider-floor',
    'land-line-after-provider-route-single',
    'land-line-direct-ho-corroborated',
    'building-units-article-linked'
  ]);

  function presentationApi() {
    return (globalScope && globalScope.DHS_DONGHO_PRESENTATION) || nodePresentationApi || {};
  }

  function providerLabel(families) {
    const first = Array.isArray(families) ? families[0] : '';
    return providerFamilyLabel(first) || '\uD655\uC778 \uC804';
  }

  function providerFamilyLabel(family) {
    return PROVIDER_LABELS[family] || (family ? String(family) : '');
  }

  function hasRegionExportView(state) {
    const status = String(state && state.regionExportStatus || 'idle');
    return Boolean(status && status !== 'idle');
  }

  function compactText(value) {
    return String(value || '').trim();
  }

  function hasVisibleDetailContextMismatch(input) {
    const state = input || {};
    if (!state.visibleDetailContextMismatch) return false;
    const visibleDong = compactText(state.visibleDetailDongToken);
    const activeDong = compactText(state.detailDongToken);
    if (visibleDong && activeDong && visibleDong !== activeDong) return true;
    const visibleDeal = compactText(state.visibleDetailDealType);
    const activeDeal = compactText(state.dealType);
    if (visibleDeal && activeDeal && visibleDeal !== activeDeal) return true;
    const visiblePrice = compactText(state.visibleDetailPriceToken);
    const activePrice = compactText(state.priceToken);
    return Boolean(visiblePrice && activePrice && visiblePrice !== activePrice);
  }

  function visibleDetailContextMismatchView(input) {
    const state = input || {};
    const summaryRows = [];
    const pushRow = (label, value) => {
      const text = compactText(value);
      if (text) summaryRows.push({ label, value: text });
    };
    pushRow('\uD654\uBA74 \uC0C1\uC138', [state.visibleDetailDongToken, state.visibleDetailDealType, state.visibleDetailPriceToken].map(compactText).filter(Boolean).join(' '));
    pushRow('\uC120\uD0DD \uD589', [state.detailDongToken, state.dealType, state.priceToken].map(compactText).filter(Boolean).join(' '));
    return {
      title: '\uBB3C\uAC74 \uC870\uC0AC \uACB0\uACFC',
      statusLabel: '\uC804\uD658 \uC911',
      statusTone: 'ready',
      primaryLabel: '\uD604\uC7AC \uC0C1\uD0DC',
      primaryValue: '\uC120\uD0DD \uD655\uC778 \uC911',
      helperText: '\uD654\uBA74 \uC0C1\uC138\uC640 \uC120\uD0DD\uD55C \uB9E4\uBB3C\uC774 \uB2EC\uB77C \uACB0\uACFC \uD45C\uC2DC\uB97C \uC7A0\uC2DC \uBCF4\uB958\uD569\uB2C8\uB2E4.',
      actionLabel: '',
      summaryRows,
      developerRows: [],
      hideDeveloperRows: true,
      listingTable: true,
      suppressListingDecoration: true
    };
  }

  function regionExportStatusLabel(status) {
    if (status === 'preparing') return '\uC870\uC0AC \uC900\uBE44';
    if (status === 'saving') return '\uC800\uC7A5 \uC911';
    if (status === 'running') return '\uC870\uC0AC \uC911';
    if (status === 'downloaded') return '\uC800\uC7A5 \uC644\uB8CC';
    if (status === 'quality-blocked') return '\uC800\uC7A5 \uBCF4\uB958';
    if (status === 'no-rows') return '\uB9E4\uBB3C \uC5C6\uC74C';
    if (status === 'cancelled') return '\uC800\uC7A5 \uCDE8\uC18C';
    if (status === 'error') return '\uC800\uC7A5 \uC2E4\uD328';
    return '\uC800\uC7A5 \uC900\uBE44';
  }

  function regionExportStatusTone(status) {
    if (status === 'downloaded') return 'ok';
    if (status === 'error' || status === 'quality-blocked' || status === 'no-rows' || status === 'cancelled') return 'warn';
    return 'ready';
  }

  function regionExportCandidateSummary(input) {
    const candidates = Array.isArray(input && input.lineInferenceCandidateDisplays)
      ? input.lineInferenceCandidateDisplays.map(compactText).filter(Boolean)
      : [];
    const unique = [];
    const seen = new Set();
    for (const candidate of candidates) {
      const key = candidate.replace(/\s+/g, '');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(candidate);
    }
    if (!unique.length) return '';
    return `\uD6C4\uBCF4: ${unique.join(' / ')}`;
  }

  function regionExportDongHoValue(input, row) {
    const savedValue = compactText(row && row.dongHo);
    if (savedValue) return savedValue;
    const status = compactText(row && row.dongHoStatus);
    if (status === 'waiting' || status === 'hashing') return '\uC870\uC0AC \uC911';
    return regionExportCandidateSummary(input) || '\uBBF8\uD655\uC815';
  }

  function regionExportNumericToken(value) {
    const api = presentationApi();
    return api && typeof api.numericToken === 'function' ? api.numericToken(value) : '';
  }

  function regionExportExactParts(display) {
    const api = presentationApi();
    return api && typeof api.exactParts === 'function' ? api.exactParts(display) : { dong: '', ho: '' };
  }

  function regionExportHoOnlyDisplay(display, targetDong, floorContext = {}) {
    const api = presentationApi();
    if (!api || typeof api.buildCandidateDisplay !== 'function') return '';
    return api.buildCandidateDisplay(Object.assign({ display, targetDong, maxVisible: 20 }, floorContext))
      .replace(/^\uD6C4\uBCF4\s*:\s*/, '');
  }

  function currentListingCandidateFloorContext(input, row) {
    const state = input || {};
    const sourceRow = row || {};
    return {
      targetFloor: sourceRow.floor || '',
      floorKind: state.detailFloorKind || '',
      floorValue: state.detailFloorValue || 0,
      floorBand: state.detailFloorBand || '',
      totalFloor: state.detailTotalFloor || 0
    };
  }

  function regionExportHoSummaryValue(input, row, dongHo) {
    const currentRow = row || {};
    const candidateLike = /^\uD6C4\uBCF4\s*:/.test(compactText(dongHo)) || /\s(?:\/|,|\u00B7)\s/.test(compactText(dongHo));
    const dong = regionExportNumericToken(currentRow.dong);
    const floorContext = currentListingCandidateFloorContext(input, currentRow);
    if (candidateLike) return regionExportHoOnlyDisplay(dongHo, dong, floorContext) || dongHo;
    const exact = regionExportExactParts(dongHo);
    if (exact.ho) return exact.ho;
    return regionExportHoOnlyDisplay(dongHo, dong, floorContext) || dongHo;
  }

  function listingPrimaryValue(row, fallbackValue) {
    const complexName = compactText(row && row.complexName);
    if (complexName) return complexName;
    const fallback = compactText(fallbackValue);
    if (!fallback || /\d{1,4}\s*\uB3D9|\d{1,4}\s*\uD638/.test(fallback)) return '\uC120\uD0DD\uD55C \uB9E4\uBB3C';
    return fallback;
  }

  function buildRegionExportView(state) {
    const input = state || {};
    const status = compactText(input.regionExportStatus || 'idle');
    const currentRow = input.regionExportCurrentRow && typeof input.regionExportCurrentRow === 'object'
      ? input.regionExportCurrentRow
      : {};
    const statusMessage = compactText(input.regionExportLastError);
    const dongHo = regionExportDongHoValue(input, currentRow);
    const hoValue = regionExportHoSummaryValue(input, currentRow, dongHo);
    const summaryRows = [];
    const pushRow = (label, value) => {
      const text = compactText(value);
      if (text) summaryRows.push({ label, value: text });
    };
    const excelRows = Array.isArray(currentRow.excelRows) ? currentRow.excelRows : [];
    if (excelRows.length) {
      excelRows.forEach((row) => {
        if (Array.isArray(row)) {
          pushRow(row[0], row[1]);
          return;
        }
        if (row && typeof row === 'object') pushRow(row.label, row.value);
      });
    } else {
      pushRow('\uB2E8\uC9C0', currentRow.complexName);
      pushRow('\uB3D9', currentRow.dong);
      pushRow('\uD638\uC218', hoValue);
      pushRow('\uCE35', currentRow.floor);
      pushRow('\uD0C0\uC785', currentRow.type);
      pushRow('\uAC70\uB798', currentRow.dealType);
      if (currentRow.isGroupedListing || Number(currentRow.groupedBrokerCount || 0) > 0) {
        pushRow('\uB3D9\uC77C\uB9E4\uBB3C', `${Math.max(1, Number(currentRow.groupedBrokerCount || 1))}\uAC1C`);
      }
    }
    return {
      title: '\uBB3C\uAC74 \uC870\uC0AC \uACB0\uACFC',
      statusLabel: regionExportStatusLabel(status),
      statusTone: regionExportStatusTone(status),
      primaryLabel: '\uBB3C\uAC74\uC9C0 \uC815\uBCF4',
      primaryValue: listingPrimaryValue(currentRow, regionExportStatusLabel(status)),
      helperText: status === 'quality-blocked' && statusMessage
        ? statusMessage
        : status === 'downloaded'
          ? `${compactText(input.regionExportSavedPath) || 'Downloads/DHS'}\uC5D0 \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4.`
          : '\uC800\uC7A5\uB420 \uBB3C\uAC74\uC9C0 \uC815\uBCF4\uB9CC \uD45C\uC2DC\uD569\uB2C8\uB2E4.',
      actionLabel: '',
      summaryRows,
      developerRows: [],
      hideDeveloperRows: true,
      listingTable: true
    };
  }

  function isHoSummaryLabel(label) {
    return compactText(label) === '\uD638\uC218';
  }

  function currentListingRows(input, options = {}) {
    const row = input && input.currentListingOverlayRow && typeof input.currentListingOverlayRow === 'object'
      ? input.currentListingOverlayRow
      : {};
    const excelRows = Array.isArray(row.excelRows) ? row.excelRows : [];
    const summaryRows = [];
    if (!excelRows.length) return summaryRows;
    const suppressDongHo = Boolean(options.suppressDongHo);
    const pushRow = (label, value) => {
      if (suppressDongHo && isHoSummaryLabel(label)) return;
      const text = compactText(value);
      if (label && text) summaryRows.push({ label, value: text });
    };
    excelRows.forEach((item) => {
      if (Array.isArray(item)) {
        pushRow(item[0], currentListingDisplayValue(input, row, item[0], item[1]));
        return;
      }
      if (item && typeof item === 'object') pushRow(item.label, currentListingDisplayValue(input, row, item.label, item.value));
    });
    return appendCurrentListingProcessingRows(summaryRows, input, row);
  }

  function candidateCountFromDisplay(value, targetDong = '', floorContext = {}) {
    const api = presentationApi();
    return api && typeof api.candidateCount === 'function'
      ? api.candidateCount(Object.assign({ display: value, targetDong }, floorContext))
      : 0;
  }

  function currentListingCandidateCount(input, row) {
    const state = input || {};
    const sourceRow = row || {};
    const targetDong = currentListingDongValue(sourceRow);
    const floorContext = currentListingCandidateFloorContext(state, sourceRow);
    const rowDisplayCount = candidateCountFromDisplay(sourceRow.dongHo, targetDong, floorContext);
    if (compactText(sourceRow.dongHoStatus) === 'multiple-candidates' && rowDisplayCount > 0) {
      return rowDisplayCount;
    }
    const displayRows = []
      .concat(Array.isArray(state.officialCandidateDisplays) ? state.officialCandidateDisplays : [])
      .concat(Array.isArray(state.lineInferenceCandidateDisplays) ? state.lineInferenceCandidateDisplays : []);
    return displayRows.length
      ? candidateCountFromDisplay(displayRows.join(' / '), targetDong, floorContext)
      : rowDisplayCount;
  }

  function currentListingDongValue(row) {
    const sourceRow = row || {};
    const direct = regionExportNumericToken(sourceRow.dong);
    if (direct) return direct;
    const excelRows = Array.isArray(sourceRow.excelRows) ? sourceRow.excelRows : [];
    for (const item of excelRows) {
      const label = Array.isArray(item) ? item[0] : (item && typeof item === 'object' ? item.label : '');
      const value = Array.isArray(item) ? item[1] : (item && typeof item === 'object' ? item.value : '');
      if (compactText(label) !== '\uB3D9') continue;
      const token = regionExportNumericToken(value);
      if (token) return token;
    }
    return regionExportExactParts(sourceRow.dongHo).dong;
  }

  function currentListingDisplayValue(input, row, label, value) {
    const text = compactText(value);
    if (isHoSummaryLabel(label)) {
      return regionExportHoOnlyDisplay(
        text,
        currentListingDongValue(row),
        currentListingCandidateFloorContext(input, row)
      ) || value;
    }
    if (label === '\uBE44\uACE0' && compactText(row && row.dongHoStatus) === 'exact' && /^\uD6C4\uBCF4(?:\s|$)/.test(text)) {
      return '';
    }
    if (label === '\uBE44\uACE0' && text === '\uD6C4\uBCF4 \uBCF5\uC218') {
      const count = currentListingCandidateCount(input, row);
      if (count > 0) return `\uD6C4\uBCF4 ${count}\uAC1C`;
    }
    return value;
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    if (total < 60) return `${total}\uCD08`;
    const minutes = Math.floor(total / 60);
    const remain = total % 60;
    return remain ? `${minutes}\uBD84 ${remain}\uCD08` : `${minutes}\uBD84`;
  }

  function currentListingProcessingValue(input, row) {
    const state = input || {};
    const sourceRow = row || {};
    if (['exact', 'multiple-candidates', 'unresolved', 'context-mismatch'].includes(compactText(sourceRow.dongHoStatus))) {
      return '\uCC98\uB9AC\uC644\uB8CC';
    }
    const route = compactText(state.routeSearchStatus);
    if (route === 'active') return '\uCC98\uB9AC\uC911';
    if (route === 'stalled' || route === 'expired') return '\uCC98\uB9AC\uC644\uB8CC';
    if (isAutoLoopFinishedWithoutResult(state)) return '\uCC98\uB9AC\uC644\uB8CC';
    return '\uCC98\uB9AC\uC911';
  }

  function upsertSummaryRow(rows, label, value) {
    const text = compactText(value);
    if (!text) return rows;
    const index = rows.findIndex((row) => row && row.label === label);
    if (index >= 0) {
      rows[index] = { label, value: text };
      return rows;
    }
    const insertBefore = label === '\uCC98\uB9AC\uC0C1\uD0DC' || label === '\uAC78\uB9B0\uC2DC\uAC04'
      ? rows.findIndex((row) => row && row.label === '\uC218\uC9D1\uC2DC\uAC04')
      : -1;
    if (insertBefore >= 0) rows.splice(insertBefore, 0, { label, value: text });
    else rows.push({ label, value: text });
    return rows;
  }

  function appendCurrentListingProcessingRows(rows, input, row) {
    const output = Array.isArray(rows) ? rows.slice() : [];
    const sourceRow = row || {};
    const terminal = ['exact', 'multiple-candidates', 'unresolved', 'context-mismatch']
      .includes(compactText(sourceRow.dongHoStatus));
    const hasRowElapsed = Object.prototype.hasOwnProperty.call(sourceRow, 'routeSearchElapsedSec')
      && Number.isFinite(Number(sourceRow.routeSearchElapsedSec));
    const hasRouteStatus = Boolean(compactText(input && input.routeSearchStatus));
    const hasElapsed = input
      && Object.prototype.hasOwnProperty.call(input, 'routeSearchElapsedSec')
      && Number.isFinite(Number(input.routeSearchElapsedSec));
    if (!hasRouteStatus && !hasElapsed) return output;
    upsertSummaryRow(output, '\uCC98\uB9AC\uC0C1\uD0DC', currentListingProcessingValue(input, row));
    if (hasElapsed) {
      const elapsedSeconds = terminal && hasRowElapsed
        ? sourceRow.routeSearchElapsedSec
        : input.routeSearchElapsedSec;
      upsertSummaryRow(output, '\uAC78\uB9B0\uC2DC\uAC04', formatDuration(elapsedSeconds));
    }
    return output;
  }

  function selectedListingTerminalStatus(row) {
    const status = compactText(row && row.dongHoStatus);
    return ['exact', 'multiple-candidates', 'unresolved', 'context-mismatch'].includes(status) ? status : '';
  }

  function selectedListingTerminalStatusLabel(status) {
    const api = presentationApi();
    if (api && typeof api.statusLabel === 'function') return api.statusLabel(status);
    return status ? '\uBBF8\uD655\uC815' : '';
  }

  function decorateCurrentListingView(view, state) {
    if (hasRegionExportView(state)) return view;
    if (view && view.suppressListingDecoration) return view;
    const detailMismatch = hasVisibleDetailContextMismatch(state);
    const summaryRows = currentListingRows(state, { suppressDongHo: detailMismatch });
    if (!summaryRows.length) return view;
    const row = state.currentListingOverlayRow || {};
    const rowExact = compactText(row.dongHoStatus) === 'exact' && compactText(row.dongHo);
    const terminalStatus = selectedListingTerminalStatus(row);
    const terminalCandidateCount = terminalStatus === 'multiple-candidates'
      ? currentListingCandidateCount(state, row)
      : 0;
    const terminalPrimaryValue = rowExact
      ? '\uC120\uD0DD\uD55C \uB9E4\uBB3C'
      : (terminalCandidateCount > 0 ? `${terminalCandidateCount}\uAC1C \uD6C4\uBCF4` : view.primaryValue);
    const presentationReady = typeof presentationApi().statusLabel === 'function';
    const terminalTone = terminalStatus ? (rowExact && presentationReady ? 'ok' : 'warn') : '';
    return Object.assign({}, view, {
      title: '\uBB3C\uAC74 \uC870\uC0AC \uACB0\uACFC',
      statusLabel: detailMismatch ? '\uCC98\uB9AC \uC911' : (terminalStatus ? selectedListingTerminalStatusLabel(terminalStatus) : view.statusLabel),
      statusTone: detailMismatch ? 'ready' : (terminalTone || view.statusTone),
      primaryLabel: '\uBB3C\uAC74\uC9C0 \uC815\uBCF4',
      primaryValue: listingPrimaryValue(row, terminalPrimaryValue),
      helperText: detailMismatch
        ? '\uD604\uC7AC \uC120\uD0DD\uD55C \uB9E4\uBB3C\uC744 \uAE30\uC900\uC73C\uB85C \uB2E4\uC2DC \uD655\uC778\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4.'
        : '\uD604\uC7AC \uB9E4\uBB3C\uC5D0\uC11C \uD655\uC778\uD55C \uBB3C\uAC74\uC9C0 \uC815\uBCF4\uC785\uB2C8\uB2E4.',
      summaryRows,
      developerRows: [],
      hideDeveloperRows: true,
      listingTable: true
    });
  }

  function groupSourceLabel(source) {
    const labels = {
      'dom-same-card': '\uD654\uBA74\uC758 \uAC19\uC740 \uB9E4\uBB3C \uCE74\uB4DC',
      'complex-cache-quick': '\uB2E8\uC9C0 \uCE90\uC2DC \uBE60\uB978 \uD655\uC778',
      sameAddress: '\uAC19\uC740\uC8FC\uC18C \uB9E4\uBB3C',
      'representative-main': '\uB300\uD45C\uB9E4\uBB3C \uBB36\uC74C',
      'representative-main-1': '\uB300\uD45C\uB9E4\uBB3C \uCD94\uAC00 \uBB36\uC74C',
      'complex-list': '\uB2E8\uC9C0 \uB9E4\uBB3C \uBAA9\uB85D',
      'complex-cache': '\uB2E8\uC9C0 \uCE90\uC2DC'
    };
    return labels[source] || (source ? String(source) : '');
  }

  function proofProviderFamily(proofSource) {
    const match = String(proofSource || '').match(/^provider-floor-hint:([A-Za-z0-9-]{1,32})$/);
    return match ? match[1] : '';
  }

  function landLineRouteLabel(input) {
    if (input.landLineCandidateSource === 'building-units-article-linked') {
      return '\uB124\uC774\uBC84 \uB3D9\uC815\uBCF4 \uB2E8\uC77C\uD638';
    }
    if (input.landLineCandidateSource === 'land-line-after-provider-floor') {
      const family = providerFamilyLabel(proofProviderFamily(input.landLineProofSource)) || '\uC81C\uACF5\uCC98';
      return `${family} \uC815\uD655\uCE35 + \uD3C9\uD615\u00B7\uB77C\uC778\uD45C`;
    }
    if (input.landLineCandidateSource === 'land-line-after-provider-route-single') {
      return '\uC81C\uACF5\uCC98 \uB2E8\uC77C \uD6C4\uBCF4 + \uD3C9\uD615\u00B7\uB77C\uC778\uD45C';
    }
    if (input.landLineCandidateSource === 'land-line-direct-ho-corroborated') {
      return '\uB124\uC774\uBC84 \uD638\uBCC4\uD45C \uAD50\uCC28\uD655\uC778 + \uD3C9\uD615\u00B7\uB77C\uC778\uD45C';
    }
    if (input.landLineCandidateSource === 'land-line-pyeong-no-line-direct-ho') {
      return '\uB124\uC774\uBC84 \uD3C9\uD615\uBC88\uD638-\uB77C\uC778 \uB9E4\uCE6D + \uD638\uBCC4\uD45C';
    }
    return `${groupSourceLabel(input.landLineProofSource) || '\uAC19\uC740\uB9E4\uBB3C'} + \uD3C9\uD615\u00B7\uB77C\uC778\uD45C`;
  }

  function openStatusLabel(status) {
    if (status === 'captured') return '\uD655\uC778\uB428';
    if (status === 'mismatch') return '\uBD88\uC77C\uCE58';
    if (status === 'unverified') return '\uAC80\uC99D \uD544\uC694';
    if (status === 'direct-lookup') return '\uC9C1\uC811 \uC870\uD68C \uC911';
    if (status === 'clicked' || status === 'trusted-clicked' || status === 'opening') return '\uC5F4\uB9BC';
    if (status === 'no-target') return '\uB300\uC0C1 \uC5C6\uC74C';
    return '\uB300\uAE30';
  }

  function buildOverlayViewContent(state) {
    if (hasRegionExportView(state)) {
      return buildRegionExportView(state);
    }

    const confirmedCandidate = confirmedCandidateState(state);
    const hasProviderTarget = Number(state && state.cpProviderClickTargetCount) > 0;
    const hasSelectedListing = isSelectedListingState(state);
    const providerOpenStatus = state && state.providerOpenStatus;
    const provider = providerLabel(state && state.cpProviderFamilies);
    const providerRouteCandidatePending = hasPendingProviderRouteCandidate(state);

    if (confirmedCandidate.present) {
      return buildConfirmedCandidateView(state, confirmedCandidate);
    }

    if (hasAmbiguousProviderCandidates(state)) {
      return buildAmbiguousProviderCandidateView(state);
    }

    if (!providerRouteCandidatePending && hasDisplayableSingleEstimatedLineInference(state)) {
      return buildLineInferenceView(state);
    }

    if (!providerRouteCandidatePending && hasLineInference(state)) {
      return buildLineInferenceView(state);
    }

    if (state && state.groupedListingSelectionPending) {
      return {
        title: '동호수 확인',
        statusLabel: '대기',
        statusTone: 'idle',
        primaryLabel: '현재 상태',
        primaryValue: '매물 상세 펼치기',
        helperText: '묶인 매물은 개별 물건을 눌러 상세를 펼치면 동·호수를 조사합니다.',
        actionLabel: '매물 상세 펼치기',
        summaryRows: [],
        developerRows: buildDeveloperRows(state)
      };
    }

    if (providerOpenStatus === 'mismatch' || providerOpenStatus === 'unverified') {
      return {
        title: '\uB3D9\uD638\uC218 \uD655\uC778',
        statusLabel: '\uAC80\uC99D \uD544\uC694',
        statusTone: 'warn',
        primaryLabel: '\uD604\uC7AC \uC0C1\uD0DC',
        primaryValue: providerOpenStatus === 'mismatch' ? '\uD6C4\uBCF4 \uBD88\uC77C\uCE58' : '\uD6C4\uBCF4 \uAC80\uC99D \uC804',
        helperText: providerOpenStatus === 'mismatch'
          ? '\uC81C\uACF5\uCC98 \uD398\uC774\uC9C0\uC758 \uD6C4\uBCF4\uAC00 \uD604\uC7AC \uB9E4\uBB3C\uACFC \uC77C\uCE58\uD558\uC9C0 \uC54A\uC544 \uB3D9\uD638\uC218\uB85C \uD45C\uC2DC\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.'
          : '\uD604\uC7AC \uB9E4\uBB3C\uC758 \uB3D9/\uCE35 \uC815\uBCF4\uB97C \uD655\uC778\uD55C \uB4A4\uC5D0\uB9CC \uD6C4\uBCF4\uB97C \uD45C\uC2DC\uD569\uB2C8\uB2E4.',
        actionLabel: '\uB2E4\uC2DC \uD655\uC778',
        summaryRows: [
          { label: '\uD655\uC778 \uACBD\uB85C', value: provider },
          { label: '\uC0C1\uD0DC', value: openStatusLabel(providerOpenStatus) }
        ],
        developerRows: buildDeveloperRows(state)
      };
    }

    if (hasAmbiguousGroupCandidates(state)) {
      return buildAmbiguousGroupCandidateView(state);
    }

    if (hasProviderTarget && hasSelectedListing) {
      const routeStatus = routeSearchStatus(state);
      return buildSelectedRouteView(state, routeStatus);
    }

    if (hasProviderTarget) {
      return {
        title: '\uB3D9\uD638\uC218 \uD655\uC778',
        statusLabel: '\uD655\uC778 \uD544\uC694',
        statusTone: 'ready',
        primaryLabel: '\uD604\uC7AC \uC0C1\uD0DC',
        primaryValue: '\uC544\uC9C1 \uD655\uC778 \uC804',
        helperText: '\uB124\uC774\uBC84\uC5D0 \uC548 \uBCF4\uC774\uB294 \uB3D9\uD638\uC218\uB97C \uC81C\uACF5\uCC98 \uD398\uC774\uC9C0\uC5D0\uC11C \uD655\uC778\uD569\uB2C8\uB2E4.',
        actionLabel: '\uC81C\uACF5\uCC98 \uD398\uC774\uC9C0\uC5D0\uC11C \uD655\uC778',
        summaryRows: [
          { label: '\uD604\uC7AC \uCC3E\uB294 \uACF3', value: routeSearchTargetLabel(state) },
          { label: '\uAC80\uC0C9 \uBC94\uC704', value: routeSearchCoverageLabel(state) },
          { label: '\uAC80\uC0C9 \uB300\uC0C1', value: `${Number(state.cpProviderClickTargetCount)}\uAC1C` }
        ],
        developerRows: buildDeveloperRows(state)
      };
    }

    if (hasSelectedListing) {
      const routeStatus = routeSearchStatus(state);
      return buildSelectedRouteView(state, routeStatus);
    }

    return {
      title: '\uB3D9\uD638\uC218 \uD655\uC778',
      statusLabel: '\uB300\uAE30',
      statusTone: 'idle',
      primaryLabel: '\uD604\uC7AC \uC0C1\uD0DC',
      primaryValue: '\uB9E4\uBB3C \uC120\uD0DD \uD544\uC694',
      helperText: '\uB3D9\uD638\uC218\uB97C \uD655\uC778\uD560 \uB9E4\uBB3C\uC744 \uBA3C\uC800 \uC120\uD0DD\uD558\uC138\uC694.',
      actionLabel: '\uC81C\uACF5\uCC98 \uD398\uC774\uC9C0\uC5D0\uC11C \uD655\uC778',
      summaryRows: [
        { label: '\uD655\uC778 \uACBD\uB85C', value: provider },
        { label: '\uC0C1\uD0DC', value: openStatusLabel(state && state.providerOpenStatus) }
      ],
      developerRows: buildDeveloperRows(state)
    };
  }

  function buildOverlayView(state) {
    return withActionState(decorateCurrentListingView(buildOverlayViewContent(state), state), state);
  }

  function withActionState(view, state) {
    const output = view && typeof view === 'object' ? Object.assign({}, view) : {};
    const label = String(output.actionLabel || '');
    const input = state || {};
    const terminalNoResult = isAutoLoopFinishedWithoutResult(input);
    const blocked = Boolean(input.stop || (input.autoLoopStatus === 'blocked' && input.autoLoopAction === 'record-blocker'));
    const actionable = hasActionableRoute(input);
    output.actionDisabled = Boolean(
      !label ||
      blocked ||
      terminalNoResult ||
      label === '\uD655\uC778 \uC885\uB8CC' ||
      label === '\uD655\uC778 \uACBD\uB85C \uC5C6\uC74C' ||
      (label !== '\uB2E4\uC2DC \uD655\uC778' && !actionable)
    );
    return output;
  }

  function confirmedCandidateState(state) {
    const input = state || {};
    // A latched confirmed exact (set in bridge once a trusted single exact was confirmed for
    // this listing) wins and is sticky, so late line/group signals cannot re-expand it.
    if (
      input.confirmedExactDisplay
      && input.confirmedExactMarker
      && (!input.articleMarker || input.confirmedExactMarker === input.articleMarker)
    ) {
      return {
        present: true,
        displayCandidate: String(input.confirmedExactDisplay),
        routeLabel: providerLabel(input.cpProviderFamilies),
        kind: input.confirmedExactKind || 'provider'
      };
    }
    const providerCaptured = input.providerOpenStatus === 'captured'
      && !input.providerCandidateRejectedReason
      && String(input.resolverOutcome || '').startsWith('captured:');
    if (
      input.providerCandidatePresent
      && input.providerCandidateDisplay
      && providerCaptured
      && Number(input.providerCandidateCount || 0) <= 1
    ) {
      return {
        present: true,
        displayCandidate: String(input.providerCandidateDisplay),
        routeLabel: providerLabel(input.cpProviderFamilies),
        kind: 'provider'
      };
    }
    const groupCaptured = !input.groupCandidateRejectedReason
      && String(input.resolverOutcome || '').startsWith('captured-group:');
    if (
      input.groupCandidatePresent
      && input.groupCandidateDisplay
      && groupCaptured
      && Number(input.groupCandidateCount || 0) <= 1
    ) {
      return {
        present: true,
        displayCandidate: String(input.groupCandidateDisplay),
        routeLabel: groupSourceLabel(input.groupCandidateSource) || '\uAC19\uC740\uB9E4\uBB3C',
        kind: 'group'
      };
    }
    const officialCaptured = input.articlePresent
      && input.officialExactCandidatePresent
      && input.officialExactCandidateDisplay
      && input.resolverBranch === 'official-table'
      && input.resolverOutcome === 'official-table-exact';
    if (officialCaptured) {
      return {
        present: true,
        displayCandidate: String(input.officialExactCandidateDisplay),
        routeLabel: '\uD604\uC7AC \uB9E4\uBB3C \uC0C1\uC138 \uD654\uBA74',
        kind: 'official-table'
      };
    }
    const landLineCaptured = !input.landLineRejectedReason
      && input.landLineCandidateCertainty === 'LAND_LINE'
      && LAND_LINE_CONFIRMED_SOURCES.has(input.landLineCandidateSource)
      && input.resolverOutcome === input.landLineCandidateSource;
    const landLineDisplay = String(input.landLineCandidateDisplay || input.lineInferenceDisplay || '');
    if (input.landLineCandidatePresent && landLineDisplay && landLineCaptured) {
      return {
        present: true,
        displayCandidate: landLineDisplay,
        routeLabel: landLineRouteLabel(input),
        kind: input.landLineCandidateSource === 'building-units-article-linked'
          ? 'building-units'
          : (input.landLineCandidateSource === 'land-line-after-provider-floor'
            ? 'land-line-provider-floor'
            : (input.landLineCandidateSource === 'land-line-after-provider-route-single'
              ? 'land-line-provider-route-single'
              : (input.landLineCandidateSource === 'land-line-direct-ho-corroborated'
                ? 'land-line-direct-ho'
                : (input.landLineCandidateSource === 'land-line-pyeong-no-line-direct-ho' ? 'land-line-pyeong-no-line-direct-ho' : 'land-line'))))
      };
    }
    return { present: false, displayCandidate: '', routeLabel: '', kind: '' };
  }

  function buildConfirmedCandidateView(state, candidate) {
    let sourceText = '\uD604\uC7AC \uC120\uD0DD\uD55C \uB9E4\uBB3C\uACFC \uC81C\uACF5\uCC98 \uD398\uC774\uC9C0 \uD6C4\uBCF4\uAC00 \uC77C\uCE58\uD574 \uD655\uC778\uB41C \uAC12\uC785\uB2C8\uB2E4.';
    if (candidate.kind === 'group') {
      sourceText = '\uD604\uC7AC \uC120\uD0DD\uD55C \uB9E4\uBB3C\uACFC \uAC19\uC740\uB9E4\uBB3C \uD6C4\uBCF4\uAC00 \uB3D9\u00B7\uCE35 \uC870\uAC74\uC744 \uD1B5\uACFC\uD574 \uD655\uC778\uB41C \uAC12\uC785\uB2C8\uB2E4.';
    } else if (candidate.kind === 'land-line-provider-floor') {
      sourceText = '\uC81C\uACF5\uCC98 \uC815\uD655\uCE35 \uB2E8\uC11C\uC640 \uD604\uC7AC \uB9E4\uBB3C\uC758 \uD3C9\uD615\u00B7\uB77C\uC778 \uC790\uB8CC\uAC00 \uD568\uAED8 \uD1B5\uACFC\uD574 \uD655\uC778\uB41C \uAC12\uC785\uB2C8\uB2E4.';
    } else if (candidate.kind === 'land-line-provider-route-single') {
      sourceText = '\uC81C\uACF5\uCC98\uC5D0\uC11C \uD604\uC7AC \uB9E4\uBB3C\uACFC \uCDA9\uB3CC\uD558\uC9C0 \uC54A\uB294 \uB2E8\uC77C \uD6C4\uBCF4\uAC00 \uD655\uC778\uB418\uACE0 \uD3C9\uD615\u00B7\uB77C\uC778 \uC790\uB8CC\uAC00 \uD568\uAED8 \uD1B5\uACFC\uD574 \uD655\uC778\uB41C \uAC12\uC785\uB2C8\uB2E4.';
    } else if (candidate.kind === 'building-units') {
      sourceText = '\uD604\uC7AC \uB9E4\uBB3C\uACFC \uC5F0\uACB0\uB41C \uB124\uC774\uBC84 \uB3D9\uC815\uBCF4 \uB2E8\uC77C \uD638 \uD589\uC774 \uD655\uC778\uB41C \uAC12\uC785\uB2C8\uB2E4.';
    } else if (candidate.kind === 'official-table') {
      sourceText = '\uD604\uC7AC \uB9E4\uBB3C \uC0C1\uC138 \uD654\uBA74\uC5D0\uC11C \uC120\uD0DD \uB9E4\uBB3C\uC758 \uB3D9\u00B7\uCE35 \uC870\uAC74\uC744 \uD1B5\uACFC\uD55C \uB2E8\uC77C \uD638\uC218\uAC00 \uD655\uC778\uB41C \uAC12\uC785\uB2C8\uB2E4.';
    } else if (candidate.kind === 'land-line-direct-ho') {
      sourceText = '\uD604\uC7AC \uB9E4\uBB3C\uC758 \uC815\uD655\uCE35\uACFC \uB124\uC774\uBC84 \uD638\uBCC4\uD45C\uC758 \uC9C1\uC811 \uD638\uC218 \uC99D\uAC70\uAC00 \uD568\uAED8 \uD1B5\uACFC\uD574 \uD655\uC778\uB41C \uAC12\uC785\uB2C8\uB2E4.';
    } else if (candidate.kind === 'land-line-pyeong-no-line-direct-ho') {
      sourceText = '\uD604\uC7AC \uB9E4\uBB3C\uC758 \uC815\uD655\uCE35\uACFC \uB124\uC774\uBC84 \uD638\uBCC4\uD45C\uC758 \uD3C9\uD615\uBC88\uD638-\uB77C\uC778 \uB9E4\uCE6D\uC774 \uD568\uAED8 \uD1B5\uACFC\uD574 \uD655\uC778\uB41C \uAC12\uC785\uB2C8\uB2E4.';
    } else if (candidate.kind === 'land-line') {
      sourceText = '\uD604\uC7AC \uC120\uD0DD\uD55C \uB9E4\uBB3C\uC758 \uAC19\uC740\uB9E4\uBB3C \uAC80\uC99D\uACFC \uD3C9\uD615\u00B7\uB77C\uC778 \uC790\uB8CC\uAC00 \uD568\uAED8 \uD1B5\uACFC\uD574 \uD655\uC778\uB41C \uAC12\uC785\uB2C8\uB2E4.';
    }
    return {
      title: '\uB3D9\uD638\uC218 \uD655\uC778',
      statusLabel: '\uD655\uC778 \uC644\uB8CC',
      statusTone: 'ok',
      primaryLabel: '\uD655\uC778\uB41C \uB3D9\uD638\uC218',
      primaryValue: candidate.displayCandidate,
      helperText: sourceText,
      actionLabel: '\uB2E4\uC2DC \uD655\uC778',
      summaryRows: [
        { label: '\uD655\uC778 \uACBD\uB85C', value: candidate.routeLabel || '\uD655\uC778\uB428' },
        { label: '\uC0C1\uD0DC', value: '\uD6C4\uBCF4 \uD655\uBCF4' }
      ],
      developerRows: buildDeveloperRows(state)
    };
  }

  function hasLineInference(state) {
    const status = state && state.lineInferenceStatus;
    return ['single-estimated', 'multiple-candidates', 'line-only'].includes(status);
  }

  function hasDisplayableSingleEstimatedLineInference(state) {
    return state
      && state.lineInferenceStatus === 'single-estimated'
      && Boolean(state.lineInferenceDisplay);
  }

  function hasPendingProviderRouteCandidate(state) {
    const input = state || {};
    const routeCandidateStored = input.providerRouteLookupBatchStatus === 'candidate-stored';
    const directLookupCandidatePending = input.providerDirectLookupStatus === 'candidate'
      && input.providerDirectLookupCandidatePresent;
    return (routeCandidateStored || directLookupCandidatePending)
      && !input.providerCandidatePresent
      && !input.providerFloorHintPresent
      && !input.buildingUnitsExactPresent;
  }

  function hasAmbiguousGroupCandidates(state) {
    const input = state || {};
    return Number(input.groupCandidateCount || 0) > 1
      && (input.groupCandidateRejectedReason === 'ambiguous-candidate' || Boolean(input.groupCandidatePresent));
  }

  function hasAmbiguousProviderCandidates(state) {
    const input = state || {};
    // More than one provider candidate — whether formally rejected as ambiguous, or captured but
    // still not narrowed to a single unit — must show "후보 여러 개", never a single "확인 완료".
    return Number(input.providerCandidateCount || 0) > 1
      && (input.providerCandidateRejectedReason === 'ambiguous-candidate' || Boolean(input.providerCandidatePresent));
  }

  function buildAmbiguousProviderCandidateView(state) {
    const input = state || {};
    const count = Number(input.providerCandidateCount || 0);
    return {
      title: '\uB3D9\uD638\uC218 \uD655\uC778',
      statusLabel: '\uD6C4\uBCF4 \uC5EC\uB7EC \uAC1C',
      statusTone: 'warn',
      primaryLabel: '\uD655\uC778 \uC0C1\uD0DC',
      primaryValue: `${count}\uAC1C \uD6C4\uBCF4`,
      helperText: '\uB9E4\uBB3C \uC81C\uACF5\uCC98\uC5D0\uC11C \uC870\uAC74\uC744 \uD1B5\uACFC\uD55C \uD6C4\uBCF4\uAC00 \uC5EC\uB7EC \uAC1C\uB77C \uB3D9\uD638\uC218\uB85C \uD655\uC815\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uCD94\uAC00 \uAC80\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.',
      actionLabel: hasActionableRoute(input) ? '\uC81C\uACF5\uCC98 \uD398\uC774\uC9C0\uC5D0\uC11C \uD655\uC778' : '\uD655\uC778 \uACBD\uB85C \uC5C6\uC74C',
      summaryRows: withAutoLoopSummary(input, selectedDongRows(input).concat(providerFloorHintRows(input)).concat([
        { label: '\uD655\uC778 \uADFC\uAC70', value: '\uB9E4\uBB3C \uC81C\uACF5\uCC98' },
        { label: '\uD6C4\uBCF4 \uC0C1\uD0DC', value: `${count}\uAC1C \uD6C4\uBCF4` },
        { label: '\uC9C4\uD589 \uC0C1\uD0DC', value: '\uCD94\uAC00 \uAC80\uC99D \uD544\uC694' }
      ])),
      developerRows: buildDeveloperRows(input)
    };
  }

  function buildAmbiguousGroupCandidateView(state) {
    const input = state || {};
    const count = Number(input.groupCandidateCount || 0);
    const source = groupSourceLabel(input.groupCandidateSource) || '\uAC19\uC740\uB9E4\uBB3C';
    return {
      title: '\uB3D9\uD638\uC218 \uD655\uC778',
      statusLabel: '\uD6C4\uBCF4 \uC5EC\uB7EC \uAC1C',
      statusTone: 'warn',
      primaryLabel: '\uD655\uC778 \uC0C1\uD0DC',
      primaryValue: `${count}\uAC1C \uD6C4\uBCF4`,
      helperText: '\uAC19\uC740\uB9E4\uBB3C \uACBD\uB85C\uC5D0\uC11C \uC870\uAC74\uC744 \uD1B5\uACFC\uD55C \uD6C4\uBCF4\uAC00 \uC5EC\uB7EC \uAC1C\uB77C \uB3D9\uD638\uC218\uB85C \uD655\uC815\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uCD94\uAC00 \uAC80\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.',
      actionLabel: hasActionableRoute(input) ? '\uC81C\uACF5\uCC98 \uD398\uC774\uC9C0\uC5D0\uC11C \uD655\uC778' : '\uD655\uC778 \uACBD\uB85C \uC5C6\uC74C',
      summaryRows: withAutoLoopSummary(input, selectedDongRows(input).concat(providerFloorHintRows(input)).concat([
        { label: '\uD655\uC778 \uADFC\uAC70', value: source },
        { label: '\uD6C4\uBCF4 \uC0C1\uD0DC', value: `${count}\uAC1C \uD6C4\uBCF4` },
        { label: '\uC9C4\uD589 \uC0C1\uD0DC', value: '\uCD94\uAC00 \uAC80\uC99D \uD544\uC694' }
      ])),
      developerRows: buildDeveloperRows(input)
    };
  }

  function buildLineInferenceView(state) {
    const input = state || {};
    const status = input.lineInferenceStatus || '';
    const typeToken = String(input.lineInferenceTypeToken || '-');
    const source = String(input.lineInferenceSource || '\uD3C9\uD615\u00B7\uB77C\uC778 \uC790\uB8CC');
    const routeStatus = routeSearchStatus(input);
    const finishedWithoutResult = isAutoLoopFinishedWithoutResult(input);
    const estimated = status === 'single-estimated';
    const multiple = status === 'multiple-candidates';
    const estimatedDisplay = estimated ? String(input.lineInferenceDisplay || '') : '';
    const candidateDisplays = Array.from(new Set(Array.isArray(input.lineInferenceCandidateDisplays)
      ? input.lineInferenceCandidateDisplays.map((item) => String(item || '').trim()).filter(Boolean)
      : []));
    const count = candidateDisplays.length || Number(input.lineInferenceCandidateCount || 0);
    const candidateSummary = candidateDisplays.join(', ');
    const summaryRows = providerFloorHintRows(input).concat([
      { label: '\uD655\uC778 \uADFC\uAC70', value: source },
      { label: '\uD3C9\uD615/\uD0C0\uC785', value: typeToken },
      { label: multiple ? '\uD6C4\uBCF4 \uC0C1\uD0DC' : '\uD6C4\uBCF4 \uC0C1\uD0DC', value: estimated ? '\uB2E8\uC77C \uCD94\uC815 \uD6C4\uBCF4' : multiple ? `${count}\uAC1C \uD6C4\uBCF4(\uD655\uC815 \uC544\uB2D8)` : `${count}\uAC1C \uB77C\uC778` }
    ]);
    if (multiple && candidateSummary) {
      summaryRows.push({ label: '\uD6C4\uBCF4 \uBAA9\uB85D', value: candidateSummary });
    }
    const candidateProvenance = lineInferenceCandidateProvenanceLabel(input, { userFacing: true });
    if (multiple && candidateProvenance !== '-') {
      summaryRows.push({ label: '\uD6C4\uBCF4 \uD310\uB2E8', value: candidateProvenance });
    }
    summaryRows.push(
      { label: '\uD604\uC7AC \uCC3E\uB294 \uACF3', value: routeSearchTargetLabel(input) },
      { label: '\uC9C4\uD589 \uC0C1\uD0DC', value: routeStatus.progressValue },
      { label: '\uB9C8\uC9C0\uB9C9 \uBCC0\uD654', value: formatElapsed(input.routeSearchIdleSec) }
    );
    return {
      title: '\uB3D9\uD638\uC218 \uD655\uC778',
      statusLabel: estimated ? '\uCD94\uC815 \uD6C4\uBCF4' : multiple ? '\uD6C4\uBCF4 \uAC00\uB2A5\uAC12' : '\uB77C\uC778 \uD6C4\uBCF4',
      statusTone: 'warn',
      primaryLabel: estimated && estimatedDisplay ? '\uCD94\uC815 \uB3D9\uD638\uC218' : multiple ? '\uD6C4\uBCF4 \uAC00\uB2A5\uAC12' : '\uD3C9\uD615\u00B7\uB77C\uC778 \uD6C4\uBCF4',
      primaryValue: estimated
        ? (estimatedDisplay || `${count || 1}\uAC1C \uCD94\uC815 \uD6C4\uBCF4`)
        : multiple ? `${count}\uAC1C \uD6C4\uBCF4` : `${count}\uAC1C \uB77C\uC778`,
      helperText: estimated
        ? '\uD3C9\uD615\u00B7\uB77C\uC778 \uC790\uB8CC\uB85C \uB2E8\uC77C \uD6C4\uBCF4\uAE4C\uC9C0 \uC881\uD600\uC84C\uC9C0\uB9CC \uD655\uC815\uAC12\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uC81C\uACF5\uCC98\uB098 \uAC19\uC740\uB9E4\uBB3C \uC99D\uAC70\uAC00 \uCD94\uAC00\uB85C \uC77C\uCE58\uD574\uC57C \uD569\uB2C8\uB2E4.'
        : '\uAC19\uC740 \uD3C9\uD615\u00B7\uB77C\uC778 \uC790\uB8CC\uAC00 \uC5EC\uB7EC \uD6C4\uBCF4\uB97C \uB0A8\uAE34 \uC0C1\uD0DC\uC785\uB2C8\uB2E4. \uD655\uC815\uAC12\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uAC19\uC740\uB9E4\uBB3C\uC774\uB098 \uC81C\uACF5\uCC98 \uC99D\uAC70\uB85C 1\uAC1C\uB85C \uC904\uC5B4\uC57C \uD569\uB2C8\uB2E4.',
      actionLabel: finishedWithoutResult ? '\uD655\uC778 \uC885\uB8CC' : hasActionableRoute(input) ? '\uC81C\uACF5\uCC98 \uD398\uC774\uC9C0\uC5D0\uC11C \uD655\uC778' : '\uD655\uC778 \uACBD\uB85C \uC5C6\uC74C',
      summaryRows: withAutoLoopSummary(input, summaryRows),
      developerRows: buildDeveloperRows(input)
    };
  }

  function buildSelectedRouteView(state, routeStatus) {
    return {
      title: '\uB3D9\uD638\uC218 \uD655\uC778',
      statusLabel: routeStatus.statusLabel,
      statusTone: routeStatus.statusTone,
      primaryLabel: '\uD604\uC7AC \uC0C1\uD0DC',
      primaryValue: routeStatus.primaryValue,
      helperText: routeStatus.helperText,
      actionLabel: hasActionableRoute(state) ? '\uC81C\uACF5\uCC98 \uD398\uC774\uC9C0\uC5D0\uC11C \uD655\uC778' : '\uD655\uC778 \uACBD\uB85C \uC5C6\uC74C',
      summaryRows: routeSummaryRows(state, routeStatus),
      developerRows: buildDeveloperRows(state)
    };
  }

  function isSelectedListingState(state) {
    if (!state) return false;
    // A listing counts as selected/tracked in the overlay ONLY when its real article detail panel
    // is open. 단지 정보 (is-complex) and bare group parents expose an article context but have no
    // article detail panel, so they must read as idle ("매물 선택 필요"), not "매물 선택됨".
    if (!state.detailPanelPresent) return false;
    if (state.articlePresent || state.articleMarker) return true;
    if (state.detailContextPresent) return true;
    if (state.detailDongToken) return true;
    return Boolean(state.detailFloorKind && state.detailFloorKind !== 'none');
  }

  function formatElapsed(seconds) {
    const total = Math.max(0, Number(seconds) || 0);
    if (total < 60) return `${total}\uCD08 \uC804`;
    const minutes = Math.floor(total / 60);
    const remain = total % 60;
    return remain ? `${minutes}\uBD84 ${remain}\uCD08 \uC804` : `${minutes}\uBD84 \uC804`;
  }

  function hasContinuableDirectProviderTarget(state) {
    const input = state || {};
    const targetCount = Number(input.cpProviderClickTargetCount) || 0;
    const finishedWithoutResult = isAutoLoopFinishedWithoutResult(input);
    return targetCount > 0
      && input.cpProviderClickTargetPhase === 'direct-provider'
      && !finishedWithoutResult;
  }

  function isAutoLoopFinishedWithoutResult(state) {
    const input = state || {};
    return ['exhausted', 'terminal'].includes(input.autoLoopStatus)
      && input.autoLoopAction === 'record-no-result';
  }

  function routeSearchStatus(state) {
    const input = state || {};
    const autoLoopBlocked = input.autoLoopStatus === 'blocked' && input.autoLoopAction === 'record-blocker';
    const providerContinuation = hasContinuableDirectProviderTarget(input);
    const routeBlockedStop = input.groupRouteStatus === 'blocked'
      && input.groupRouteLastRejectReason === 'http-stop'
      && !providerContinuation;
    const autoLoopFinishedWithoutResult = isAutoLoopFinishedWithoutResult(input);
    const expired = (input.routeSearchStatus === 'expired' || Number(input.routeSearchIdleSec) >= 180)
      && !providerContinuation;
    const stalled = (input.routeSearchStatus === 'stalled' || Number(input.routeSearchIdleSec) >= 60)
      && !providerContinuation;
    const actionable = hasActionableRoute(input);
    const referenceOnly = hasReferenceOnlyEvidence(input);
    if (input.stop || autoLoopBlocked || routeBlockedStop) {
      return {
        statusLabel: '\uD655\uC778 \uC911\uB2E8',
        statusTone: 'warn',
        primaryValue: '\uC811\uADFC \uC81C\uD55C \uC751\uB2F5\uC73C\uB85C \uC911\uB2E8',
        progressValue: '\uC911\uB2E8',
        helperText: '\uAD8C\uD55C \uC81C\uD55C\uC774\uB098 \uC694\uCCAD \uC81C\uD55C \uC751\uB2F5\uC774 \uAC10\uC9C0\uB418\uC5B4 \uC790\uB3D9 \uD655\uC778\uC744 \uC911\uB2E8\uD588\uC2B5\uB2C8\uB2E4.'
      };
    }
    if (autoLoopFinishedWithoutResult) {
      return {
        statusLabel: '\uD655\uC778 \uC885\uB8CC',
        statusTone: 'warn',
        primaryValue: '\uD655\uC778 \uACB0\uACFC \uC5C6\uC74C',
        progressValue: '\uD655\uC778 \uC885\uB8CC',
        helperText: input.autoLoopReason === 'group-routes-exhausted'
          ? '\uC81C\uACF5\uCC98\uC640 \uAC19\uC740\uB9E4\uBB3C \uACBD\uB85C\uB97C \uBAA8\uB450 \uD655\uC778\uD588\uC9C0\uB9CC \uB3D9\uD638\uC218\uB85C \uD45C\uC2DC\uD560 \uB2E8\uC77C \uD6C4\uBCF4\uB294 \uC5C6\uC2B5\uB2C8\uB2E4.'
          : '\uC81C\uACF5\uCC98 \uD6C4\uBCF4\uB97C \uBAA8\uB450 \uD655\uC778\uD588\uC9C0\uB9CC \uB3D9\uD638\uC218\uB85C \uD45C\uC2DC\uD560 \uB2E8\uC77C \uD6C4\uBCF4\uB294 \uC5C6\uC2B5\uB2C8\uB2E4.'
      };
    }
    if (expired) {
      return {
        statusLabel: actionable ? '\uD655\uC778 \uC885\uB8CC' : '\uD655\uC778\uD560 \uACF3 \uC5C6\uC74C',
        statusTone: 'warn',
        primaryValue: actionable ? '\uD655\uC778 \uACB0\uACFC \uC5C6\uC74C' : '\uB3D9\uD638\uC218 \uD655\uC778 \uBD88\uAC00',
        progressValue: '\uC2DC\uAC04 \uCD08\uACFC',
        helperText: actionable
          ? '3\uBD84 \uB3D9\uC548 \uD6C4\uBCF4\uC5D0\uC11C \uB3D9\uD638\uC218\uB97C \uD655\uC778\uD558\uC9C0 \uBABB\uD574 \uC790\uB3D9\uC73C\uB85C \uD655\uC778\uC744 \uC885\uB8CC\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uB978 \uB9E4\uBB3C\uC744 \uC120\uD0DD\uD558\uAC70\uB098 \uD398\uC774\uC9C0\uB97C \uC0C8\uB85C\uACE0\uCE68\uD55C \uB4A4 \uB2E4\uC2DC \uC2DC\uB3C4\uD558\uC138\uC694.'
          : '3\uBD84 \uB3D9\uC548 \uC774 \uB9E4\uBB3C\uC758 \uB3D9\uD638\uC218\uB97C \uD655\uC778\uD560 \uC218 \uC788\uB294 \uC81C\uACF5\uCC98\uB098 \uAC19\uC740 \uB9E4\uBB3C \uC815\uBCF4\uB97C \uCC3E\uC9C0 \uBABB\uD574 \uC790\uB3D9\uC73C\uB85C \uD655\uC778\uC744 \uC885\uB8CC\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uB978 \uB9E4\uBB3C\uC744 \uC120\uD0DD\uD558\uAC70\uB098 \uD398\uC774\uC9C0\uB97C \uC0C8\uB85C\uACE0\uCE68\uD55C \uB4A4 \uB2E4\uC2DC \uC2DC\uB3C4\uD558\uC138\uC694.'
      };
    }
    if (!actionable && referenceOnly) {
      return {
        statusLabel: stalled ? '\uD655\uC778 \uACBD\uB85C \uC5C6\uC74C' : '\uCC38\uACE0\uC790\uB8CC \uAC10\uC9C0',
        statusTone: stalled ? 'warn' : 'ready',
        primaryValue: stalled ? '\uC81C\uACF5\uCC98\u00B7\uAC19\uC740\uB9E4\uBB3C \uB2E8\uC11C \uC5C6\uC74C' : '\uB3D9\uD638\uC218 \uD655\uC778 \uACBD\uB85C \uC544\uB2D8',
        progressValue: '\uC2DC\uC138\u00B7\uB2E8\uC9C0 \uCC38\uACE0\uC790\uB8CC\uB9CC \uAC10\uC9C0',
        helperText: '\uC2DC\uC138\u00B7\uB2E8\uC9C0 \uC790\uB8CC\uB294 \uCC38\uACE0 \uC815\uBCF4\uC77C \uBFD0 \uB3D9\uD638\uC218 \uD655\uC778 \uACBD\uB85C\uB85C \uC0AC\uC6A9\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB9E4\uBB3C \uC81C\uACF5\uCC98\uB098 \uAC19\uC740\uB9E4\uBB3C \uB2E8\uC11C\uAC00 \uB098\uC624\uBA74 \uADF8\uB54C \uD655\uC778\uC744 \uC9C4\uD589\uD569\uB2C8\uB2E4.'
      };
    }
    if (stalled) {
      return {
        statusLabel: '\uBA48\uCDA4 \uC758\uC2EC',
        statusTone: 'warn',
        primaryValue: '\uD655\uC778 \uACBD\uB85C \uB300\uAE30 \uC911',
        progressValue: '1\uBD84 \uC774\uC0C1 \uC0C8 \uC2E0\uD638 \uC5C6\uC74C',
        helperText: '\uC120\uD0DD\uD55C \uB9E4\uBB3C\uC758 \uD655\uC778 \uACBD\uB85C\uB97C \uCC3E\uB2E4\uAC00 \uBA48\uCDB0 \uC788\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uB9E4\uBB3C\uC744 \uB2E4\uC2DC \uC120\uD0DD\uD558\uAC70\uB098 \uD398\uC774\uC9C0\uB97C \uC0C8\uB85C\uACE0\uCE68\uD574 \uD655\uC778\uD558\uC138\uC694.'
      };
    }
    return {
      statusLabel: '\uD655\uC778 \uC911',
      statusTone: 'ready',
      primaryValue: '\uB9E4\uBB3C \uC120\uD0DD\uB428',
      progressValue: '\uCC3E\uB294 \uC911',
      helperText: '\uC120\uD0DD\uD55C \uB9E4\uBB3C\uC5D0\uC11C \uB3D9\uD638\uC218 \uD655\uC778 \uACBD\uB85C\uB97C \uCC3E\uACE0 \uC788\uC2B5\uB2C8\uB2E4. \uD655\uC778 \uC704\uCE58\uC640 \uB9C8\uC9C0\uB9C9 \uBCC0\uD654 \uC2DC\uAC04\uC744 \uD568\uAED8 \uD45C\uC2DC\uD569\uB2C8\uB2E4.'
    };
  }

  function routeSearchTargetLabel(state) {
    const input = state || {};
    if (isAutoLoopFinishedWithoutResult(input)) {
      return input.autoLoopReason === 'group-routes-exhausted'
        ? '\uD655\uC778 \uC885\uB8CC: \uC81C\uACF5\uCC98\u00B7\uAC19\uC740\uB9E4\uBB3C \uACBD\uB85C \uBAA8\uB450 \uD655\uC778'
        : '\uD655\uC778 \uC885\uB8CC: \uCD94\uAC00 \uD655\uC778 \uACBD\uB85C \uC5C6\uC74C';
    }
    const targetCount = Number(input.cpProviderClickTargetCount) || 0;
    const families = input.cpProviderFamilies || [];
    const providerNames = providerFamilyList(families);
    const directProviderTarget = targetCount > 0 && input.cpProviderClickTargetPhase === 'direct-provider';
    const hasActiveGroupRoute = input.groupRouteSource
      && input.groupRouteStatus
      && input.groupRouteStatus !== 'idle'
      && (
        Number(input.groupRouteProgressSeq || 0) > 0 ||
        input.autoLoopTargetPhase === 'group-route' ||
        input.autoLoopAction === 'scan-group-route' ||
        input.autoLoopReason === 'group-routes-exhausted'
      );
    if (directProviderTarget) return `\uB9E4\uBB3C \uC81C\uACF5\uCC98: ${providerNames || providerLabel(families)} \uBC84\uD2BC ${targetCount}\uAC1C`;
    if (hasActiveGroupRoute) {
      return `\uAC19\uC740\uB9E4\uBB3C: ${groupSourceLabel(input.groupRouteSource)} (${groupRouteStatusLabel(input.groupRouteStatus, input.groupRouteLastRejectReason)})`;
    }
    if (targetCount > 0) return `\uB9E4\uBB3C \uC81C\uACF5\uCC98: ${providerNames || providerLabel(families)} \uBC84\uD2BC ${targetCount}\uAC1C`;
    const groupProgress = groupRouteProgress(input);
    if (groupProgress.currentRoute !== 'waiting-group-route') return groupProgress.userLabel;
    if (input.sameAddressEvidenceSeen) return '\uAC19\uC740\uB9E4\uBB3C: \uAC19\uC740 \uC8FC\uC18C \uB9E4\uBB3C';
    if (input.representativeEvidenceSeen) return '\uAC19\uC740\uB9E4\uBB3C: \uB300\uD45C\uB9E4\uBB3C \uBB36\uC74C';
    if (input.kbAliasEvidenceSeen) return 'KB \uB2E8\uC9C0 \uC2DD\uBCC4: \uBCF4\uC870 \uB9E4\uD551 \uB2E8\uC11C';
    if (input.cpTextSignalStrong || input.cpProviderEvidenceSeen || families.length > 0) return `\uB9E4\uBB3C \uC81C\uACF5\uCC98 \uB2E8\uC11C${providerNames ? `: ${providerNames}` : ''}`;
    if (hasReferenceOnlyEvidence(input)) return '\uB124\uC774\uBC84 \uCC38\uACE0\uC790\uB8CC\uB9CC \uAC10\uC9C0';
    return '\uC81C\uACF5\uCC98\u00B7\uAC19\uC740\uB9E4\uBB3C \uB2E8\uC11C \uCC3E\uB294 \uC911';
  }

  function routeSearchCoverageLabel(state) {
    const inventory = cpInventory(state);
    const providerCount = inventory ? inventory.domainCandidateCount : 16;
    return `\uB9E4\uBB3C \uC81C\uACF5\uCC98 \uD6C4\uBCF4 ${providerCount}\uACF3 \u00B7 \uAC19\uC740\uB9E4\uBB3C \u00B7 \uB300\uD45C\uB9E4\uBB3C \u00B7 KB \uB2E8\uC9C0\uC2DD\uBCC4`;
  }

  function routeSummaryRows(state, routeStatus) {
    const input = state || {};
    const dongRows = selectedDongRows(input);
    const floorHintRows = providerFloorHintRows(input);
    if (!hasActionableRoute(input) && hasReferenceOnlyEvidence(input)) {
      return withAutoLoopSummary(input, dongRows.concat(floorHintRows).concat([
        { label: '\uB3D9\uD638\uC218 \uD655\uC778 \uACBD\uB85C', value: '\uC5C6\uC74C' },
        { label: '\uD604\uC7AC \uCC3E\uB294 \uACF3', value: routeSearchTargetLabel(input) },
        { label: '\uAC80\uC0C9 \uBC94\uC704', value: routeSearchCoverageLabel(input) },
        { label: routeStatus.progressValue === '\uC2DC\uAC04 \uCD08\uACFC' ? '\uC9C4\uD589 \uC0C1\uD0DC' : '\uCC38\uACE0\uC790\uB8CC \uC0C1\uD0DC', value: routeStatus.progressValue },
        { label: '\uB9C8\uC9C0\uB9C9 \uBCC0\uD654', value: formatElapsed(input.routeSearchIdleSec) }
      ]));
    }
    return withAutoLoopSummary(input, dongRows.concat(floorHintRows).concat([
      { label: '\uD604\uC7AC \uCC3E\uB294 \uACF3', value: routeSearchTargetLabel(input) },
      { label: '\uAC80\uC0C9 \uBC94\uC704', value: routeSearchCoverageLabel(input) },
      { label: '\uC9C4\uD589 \uC0C1\uD0DC', value: routeStatus.progressValue },
      { label: '\uB9C8\uC9C0\uB9C9 \uBCC0\uD654', value: formatElapsed(input.routeSearchIdleSec) }
    ]));
  }

  function selectedDongRows(input) {
    const dong = String(input && input.detailDongToken || '');
    return dong ? [{ label: '\uD655\uC778\uB41C \uB3D9', value: dong }] : [];
  }

  function providerFloorHintRows(input) {
    if (!input || !input.providerFloorHintPresent || !(Number(input.providerFloorHintValue) > 0)) return [];
    const family = input.providerFloorHintSourceLabel || providerLabel(input.providerFloorHintFamily ? [input.providerFloorHintFamily] : []);
    return [{ label: '\uC81C\uACF5\uCC98 \uCE35 \uB2E8\uC11C', value: `${family ? `${family} \u00B7 ` : ''}${Number(input.providerFloorHintValue)}\uCE35` }];
  }

  function withAutoLoopSummary(input, rows) {
    const label = autoLoopSummaryLabel(input);
    if (!label) return rows;
    const nextRows = rows.slice();
    const progressIndex = nextRows.findIndex((row) => row.label === '\uC9C4\uD589 \uC0C1\uD0DC' || row.label === '\uCC38\uACE0\uC790\uB8CC \uC0C1\uD0DC');
    const row = { label: '\uC790\uB3D9 \uD655\uC778', value: label };
    if (progressIndex >= 0) {
      nextRows.splice(progressIndex, 0, row);
      return nextRows;
    }
    nextRows.push(row);
    return nextRows;
  }

  function autoLoopTargetLabel(input) {
    const count = Number(input && input.autoLoopTargetCount || 0);
    const index = Number(input && input.autoLoopTargetIndex || 0);
    const phase = String(input && input.autoLoopTargetPhase || '');
    if (phase === 'group-route') {
      return groupSourceLabel(input.autoLoopTargetRoute || input.groupRouteSource) || '\uAC19\uC740\uB9E4\uBB3C \uACBD\uB85C';
    }
    if (phase === 'group-target') return '\uBB36\uC74C \uC5F4\uAE30';
    if (count > 0) {
      const family = providerLabel(input.cpProviderCurrentFamily ? [input.cpProviderCurrentFamily] : []);
      const progress = `${Math.max(1, index + 1)}/${count}`;
      return family ? `${family} (${progress})` : `\uC81C\uACF5\uCC98 ${progress}`;
    }
    return '\uC81C\uACF5\uCC98';
  }

  function autoLoopSummaryLabel(input) {
    const status = String(input && input.autoLoopStatus || '');
    if (!status || status === 'idle') return '';
    const reason = String(input && input.autoLoopReason || '');
    if (reason === 'searching-group-routes') return '\uAC19\uC740\uB9E4\uBB3C \uACBD\uB85C \uCC3E\uB294 \uC911';
    if (reason === 'waiting-for-group-expansion') return '\uBB36\uC74C \uB9E4\uBB3C \uC5EC\uB294 \uC911';
    const target = autoLoopTargetLabel(input);
    if (status === 'opening') return `${target} \uD655\uC778 \uC911`;
    if (status === 'waiting') return `${target} \uC751\uB2F5 \uB300\uAE30`;
    if (status === 'exhausted') {
      if (reason === 'group-expansion-no-target') return '\uBB36\uC74C \uC5F4\uAE30 \uACB0\uACFC \uC5C6\uC74C';
      return reason === 'group-routes-exhausted'
        ? '\uAC19\uC740\uB9E4\uBB3C \uACBD\uB85C \uBAA8\uB450 \uD655\uC778\uD568'
        : '\uC81C\uACF5\uCC98 \uBAA8\uB450 \uD655\uC778\uD568';
    }
    if (status === 'done') return '\uD655\uC778 \uC644\uB8CC';
    if (status === 'blocked') return '\uC790\uB3D9 \uD655\uC778 \uC911\uB2E8';
    if (status === 'terminal') return '\uC790\uB3D9 \uD655\uC778 \uC885\uB8CC';
    return `${target} \uD655\uC778`;
  }

  function hasActionableRoute(state) {
    const input = state || {};
    return Boolean(
      Number(input.cpProviderClickTargetCount) > 0 ||
      input.cpTextSignalStrong ||
      input.cpProviderEvidenceSeen ||
      (input.cpProviderFamilies || []).length > 0 ||
      input.sameAddressEvidenceSeen ||
      input.representativeEvidenceSeen ||
      input.complexListEvidenceSeen ||
      input.complexCacheEvidenceSeen
    );
  }

  function hasReferenceOnlyEvidence(state) {
    const input = state || {};
    return Boolean(
      input.naverCacheEvidenceSeen ||
      ['landprice', 'prices', 'buildingUnits', 'pyeongtype', 'finFrontApi'].includes(input.lastEvidenceCategory) ||
      input.resolverBranch === 'naver-cache' ||
      input.resolverBranch === 'official-table' ||
      input.kbAliasEvidenceSeen ||
      input.lastEvidenceCategory === 'kbAlias' ||
      input.resolverBranch === 'kb-alias'
    );
  }

  function buildDeveloperRows(state) {
    const input = state || {};
    const cpRows = buildCpInventoryRows(input);
    return [
      { label: '\uBAA9\uB85D \uB9E4\uBB3C', value: `${input.listingCount || 0}\uAC1C (\uD45C\uBCF8 ${input.listingSampleCount || 0}\uAC1C)` },
      { label: '\uB3D9\u00B7\uCE35\u00B7\uD638 \uD45C\uC2DC', value: `\uB3D9 ${input.dongCount || 0} \u00B7 \uCE35 ${input.floorCount || 0} \u00B7 \uD638 ${input.hoCount || 0}` },
      { label: '\uD638\uC218 \uC0C1\uD0DC', value: `\uB3D9\uD638\uB178\uCD9C ${input.dongHoShownCount || 0} \u00B7 \uC815\uD655\uCE35\uB9CC ${input.floorKnownNoHoCount || 0} \u00B7 \uCE35\uB300\uB9CC ${input.floorBandNoHoCount || 0}` },
      { label: '\uC120\uD0DD \uB9E4\uBB3C', value: selectedListingDiagnostic(input) },
      { label: '\uD655\uC7A5 \uBC84\uC804', value: versionLabel(input) },
      { label: '\uB3D9\u00B7\uCE35 \uB2E8\uC11C', value: detailFloorLabel(input) },
      { label: '\uB124\uC774\uBC84 article \uB9E5\uB77D', value: articleDetailContextLabel(input) },
      { label: 'CP \uCE35 \uB2E8\uC11C', value: providerFloorHintLabel(input) },
      { label: '\uD3C9\uD615\u00B7\uB77C\uC778 \uCD94\uB860', value: lineInferenceLabel(input) },
      { label: '\uB77C\uC778\uB9F5 \uB9E4\uCE6D', value: lineMapMatchLabel(input) },
      { label: '\uB77C\uC778\uB9F5 \uADF8\uB8F9', value: lineMapGroupStatsLabel(input.lineInferenceTypeGroupStats) },
      { label: '\uD6C4\uBCF4 \uADF8\uB8F9', value: lineMapGroupStatsLabel(input.lineInferenceCandidateGroupStats) },
      { label: '\uB77C\uC778 \uAC00\uB2A5\uAC12 \uADFC\uAC70', value: lineInferenceCandidateProvenanceLabel(input) },
      { label: '\uD0C0\uC785\uAD70 \uADF8\uB8F9', value: lineMapGroupStatsLabel(input.lineInferenceTypeFamilyGroupStats) },
      { label: '\uB3D9 \uC804\uCCB4 \uADF8\uB8F9', value: lineMapGroupStatsLabel(input.lineInferenceDongGroupStats) },
      { label: '\uB77C\uC778\uB9F5 \uD655\uC778', value: lineMapRouteLabel(input) },
      { label: '\uB3D9\uC815\uBCF4 \uC815\uD655\uD6C4\uBCF4', value: buildingUnitsExactLabel(input) },
      { label: 'LAND_LINE \uC2B9\uACA9', value: landLinePromotionLabel(input) },
      { label: '\uBB36\uC74C \uD6C4\uBCF4', value: groupCandidateLabel(input) },
      { label: '\uBB36\uC74C \uD6C4\uBCF4 \uC694\uC57D', value: groupCandidateRankedSummary(input) },
      { label: '\uBB36\uC74C \uACBD\uB85C \uAC80\uC99D', value: groupRouteScanLabel(input) },
      { label: '\uBB36\uC74C \uACBD\uB85C \uC6D0\uC790\uB8CC', value: groupRouteRawLabel(input) },
      { label: '\uBB36\uC74C \uCE35\uB2E8\uC11C \uC6D0\uC778', value: groupFloorHintDiagnosticLabel(input) },
      { label: '\uBB36\uC74C \uCE35\uB2E8\uC11C \uAC80\uC99D', value: groupFloorHintGuardLabel(input) },
      { label: '\uBB36\uC74C \uACBD\uB85C \uAD6C\uC870', value: groupRouteShapeLabel(input) },
      { label: '\uBB36\uC74C CP \uD1A0\uD070', value: providerRouteLookupLabel(input) },
      { label: 'CP \uC218\uC9D1 \uB2E8\uACC4', value: providerEvidencePipelineLabel(input) },
      { label: 'CP \uC784\uC2DC\uC790\uB8CC', value: providerEvidenceTempLabel(input) },
      { label: 'CP \uC784\uC2DC\uC790\uB8CC \uCD9C\uCC98', value: providerEvidenceTempSourceSummaryLabel(input) },
      { label: '\uACF5\uC2DD\uD45C(\uCC38\uACE0)', value: `\uD589 ${input.officialFloorRows || 0} \u00B7 \uD6C4\uBCF4 ${input.officialCandidateCells || 0} \u00B7 ${officialModeLabel(input.officialCandidateMode)}` },
      { label: 'CP \uACBD\uB85C', value: `${cpReadinessLabel(input.cpParserReadiness)} \u00B7 \uD604\uC7AC ${providerLabel(input.cpProviderCurrentFamily ? [input.cpProviderCurrentFamily] : []) || '-'} \u00B7 \uB9C1\uD06C ${input.cpProviderLinkCount || 0} \u00B7 \uBC84\uD2BC ${input.cpProviderClickTargetCount || 0} \u00B7 \uAE30\uC220\uB2E8\uC11C ${input.cpTechnicalIdPresent ? '\uC788\uC74C' : '\uC5C6\uC74C'}` },
      { label: 'CP \uC9C1\uC811 \uC870\uD68C', value: providerDirectLookupLabel(input) },
      { label: 'CP \uD6C4\uBCF4 \uCD9C\uCC98', value: providerCandidateSourceDiagnostic(input) },
      { label: 'CP \uD6C4\uBCF4 \uC694\uC57D', value: providerCandidateRankedSummary(input) },
      { label: '\uD655\uC778 \uACBD\uB85C \uC21C\uD68C', value: groupRouteProgress(input).developerSummary },
      { label: '\uC790\uB3D9 \uB8E8\uD504', value: autoLoopDeveloperLabel(input) },
      ...cpRows,
      { label: '\uD6C4\uBCF4 \uAC80\uC99D', value: candidateGuardLabel(input) },
      { label: '\uD310\uB2E8 \uBD84\uAE30', value: `${resolverBranchLabel(input.resolverBranch)} / ${resolverOutcomeLabel(input.resolverOutcome)}` },
      { label: '\uCD5C\uADFC \uC790\uB8CC', value: `${evidenceLabel(input.lastEvidenceCategory)}:${input.lastEvidenceStatus || 'none'}` },
      { label: '\uC9C4\uD589 \uC0C1\uD0DC', value: `${routeSearchStatus(input).progressValue} / \uB9C8\uC9C0\uB9C9 ${formatElapsed(input.routeSearchIdleSec)} / \uCD1D ${input.routeSearchElapsedSec || 0}\uCD08` },
      { label: '\uCD5C\uADFC \uC774\uBCA4\uD2B8', value: eventLabel(input.lastEvent) }
    ];
  }

  function selectedListingDiagnostic(input) {
    if (input.articleMarker) return '\uB9E4\uBB3C \uC120\uD0DD\uB428';
    if (input.articlePresent || input.detailContextPresent) return '\uC0C1\uC138 \uD328\uB110 \uAC10\uC9C0';
    return '-';
  }

  function versionLabel(input) {
    return [
      `manifest ${input.manifestVersion || '-'}`,
      `bridge ${input.bridgeVersion || '-'}`,
      `hook ${input.pageHookVersion || '-'}`
    ].join(' \u00B7 ');
  }

  function detailFloorLabel(input) {
    const kind = input.detailFloorKind || 'none';
    const dong = input.detailDongToken ? `\uB3D9\uB2E8\uC11C ${input.detailDongToken}` : '\uB3D9\uB2E8\uC11C \uC5C6\uC74C';
    if (kind === 'exact') return `${dong} \u00B7 \uC815\uD655\uCE35`;
    if (kind === 'band') return `${dong} \u00B7 \uCE35\uB300`;
    if (kind === 'loose') return `${dong} \u00B7 \uCE35\uB2E8\uC11C`;
    return '-';
  }

  function articleDetailContextLabel(input) {
    if (!input || !input.articleDetailContextSeen) return '-';
    return [
      '\uAC10\uC9C0',
      input.articleDetailExclusiveSpaceSeen ? '\uC804\uC6A9\uBA74\uC801 \uC788\uC74C' : '\uC804\uC6A9\uBA74\uC801 \uC5C6\uC74C',
      input.articleDetailPyeongNoSeen ? '\uD3C9\uD615\uBC88\uD638 \uC788\uC74C' : '\uD3C9\uD615\uBC88\uD638 \uC5C6\uC74C'
    ].join(' \u00B7 ');
  }

  function lineInferenceLabel(input) {
    const status = input.lineInferenceStatus || '';
    if (!status) return '-';
    const typeToken = input.lineInferenceTypeToken || '-';
    const count = Number(input.lineInferenceCandidateCount || 0);
    const statusLabel = status === 'multiple-candidates'
      ? '\uBBF8\uD655\uC815 \uAC00\uB2A5\uAC12'
      : (status === 'single-estimated' ? '\uB2E8\uC77C \uCD94\uC815' : status);
    return `${statusLabel} \u00B7 ${typeToken} \u00B7 ${count}\uAC1C`;
  }

  function lineMapMatchLabel(input) {
    const total = Number(input && input.lineInferenceRowCount || 0);
    const dong = Number(input && input.lineInferenceDongMatchCount || 0);
    const type = Number(input && input.lineInferenceTypeMatchCount || 0);
    const floor = Number(input && input.lineInferenceFloorMatchCount || 0);
    const reason = candidateRejectReasonLabel(input && input.lineInferenceReason || '');
    if (total <= 0 && dong <= 0 && type <= 0 && floor <= 0) return '-';
    return `\uC804\uCCB4 ${total}\uAC1C \u00B7 \uB3D9 ${dong}\uAC1C \u00B7 \uD3C9\uD615 ${type}\uAC1C \u00B7 \uCE35\uBC94\uC704 ${floor}\uAC1C \u00B7 ${reason}`;
  }

  function lineMapGroupStatsLabel(items) {
    const rows = (Array.isArray(items) ? items : [])
      .filter((item) => item && Number(item.lineNo || 0) > 0 && Number(item.count || 0) > 0)
      .slice(0, 8);
    if (!rows.length) return '-';
    return rows.map((item) => {
      const typeToken = String(item.typeToken || '-').replace(/[^0-9A-Za-z]/g, '').slice(0, 16) || '-';
      const lineNo = Number(item.lineNo || 0) || 0;
      const min = Number(item.floorMin || 0) || 0;
      const max = Number(item.floorMax || 0) || 0;
      const floorLabel = min > 0 && max > 0
        ? (min === max ? `${min}\uCE35` : `${min}-${max}\uCE35`)
        : '\uCE35\uBC94\uC704 -';
      const count = Math.min(999, Number(item.count || 0) || 0);
      const source = String(item.source || '').replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 24);
      const direct = item.directHo ? ' direct' : '';
      return `${typeToken} ${lineNo}\uB77C\uC778 ${floorLabel} ${count}\uAC1C${direct}${source ? ` ${source}` : ''}`;
    }).join(' / ');
  }

  function sourceRouteHumanLabel(value) {
    const route = String(value || '');
    const source = route.replace(/^naver-line-map:/, '');
    const labels = {
      pyeongtype: 'pyeongtype',
      landprice: 'landprice',
      prices: 'prices',
      buildingUnits: 'buildingUnits',
      'naver-house-number-map': '\uB124\uC774\uBC84 \uD638\uBCC4\uD45C',
      unknown: '\uCD9C\uCC98\uBBF8\uC0C1'
    };
    return labels[source] || source || '-';
  }

  function sourceFieldHumanLabel(value) {
    const field = String(value || '');
    if (['hoNm', 'hoName', 'hoNo', 'houseNo', 'roomNo', 'unitNumber', 'hoNo/hoName', 'directHoToken'].includes(field)) {
      return 'hoNo\u00B7hoName';
    }
    if (field === 'hoFloor+lineNo') return 'hoFloor+lineNo';
    return field || '-';
  }

  function guardHumanLabel(value) {
    const labels = {
      'line-candidate-not-unique': '\uD6C4\uBCF4 \uC5EC\uB7EC\uAC1C',
      'needs-land-line-promotion': 'LAND_LINE \uC2B9\uACA9 \uD544\uC694',
      'group-or-provider-proof': '\uAC19\uC740\uB9E4\uBB3C/CP \uC99D\uAC70',
      'exact-floor-proof': '\uC815\uD655\uCE35 \uC99D\uAC70',
      'pyeongNo-context': '\uD3C9\uD615\uBC88\uD638',
      'exclusive-area-context': '\uC804\uC6A9\uBA74\uC801',
      dong: '\uB3D9',
      type: '\uD3C9\uD615',
      'exact-floor': '\uC815\uD655\uCE35',
      'floor-band-range': '\uCE35\uB300',
      'direct-ho-field': 'hoNo\u00B7hoName',
      'exclusive-area': '\uC804\uC6A9\uBA74\uC801',
      pyeongNo: '\uD3C9\uD615\uBC88\uD638',
      direction: '\uD5A5',
      'landprice-anomaly': 'landprice anomaly'
    };
    return labels[value] || String(value || '-');
  }

  function lineInferenceCandidateProvenanceLabel(input, options) {
    const rows = Array.isArray(input && input.lineInferenceCandidateProvenance)
      ? input.lineInferenceCandidateProvenance
      : [];
    if (!rows.length) return '-';
    const limit = options && options.userFacing ? 3 : 8;
    return rows.slice(0, limit).map((item) => {
      const display = String(item.displayCandidate || '').trim() || `${Number(item.lineNo || 0) || '-'}\uB77C\uC778`;
      const route = sourceRouteHumanLabel(item.sourceRoute);
      const field = sourceFieldHumanLabel(item.sourceField);
      const missing = (Array.isArray(item.guardsMissing) ? item.guardsMissing : [])
        .slice(0, options && options.userFacing ? 2 : 4)
        .map(guardHumanLabel)
        .join(',');
      const blocker = guardHumanLabel(item.finalBlocker);
      return `${display} ${route}/${field} \uBD80\uC871:${missing || blocker}`;
    }).join(' / ');
  }

  function pyeongTypeRouteLabel(input) {
    const eventName = input.pyeongTypeRouteEvent || '';
    const status = Number(input.pyeongTypeRouteStatus || 0);
    const reason = input.pyeongTypeRouteReason || '';
    const rows = Number(input.pyeongTypeLineMapRowCount || 0);
    if (!eventName && !status && !reason && rows <= 0) return '-';
    return `${eventName || 'seen'} \u00B7 ${status || '-'} \u00B7 ${reason || '-'} \u00B7 \uB77C\uC778 ${rows}\uAC1C`;
  }

  function lineMapRouteLabel(input) {
    const byEndpoint = input && typeof input.lineMapRouteByEndpoint === 'object'
      ? input.lineMapRouteByEndpoint
      : {};
    const entries = ['finFrontApi', 'pyeongtype', 'landprice', 'prices', 'buildingUnits', 'naverOther']
      .map((endpoint) => byEndpoint[endpoint])
      .filter((item) => item && typeof item === 'object');
    const source = entries.length ? entries : [{
      endpoint: input.lineMapRouteEndpoint || 'pyeongtype',
      event: input.lineMapRouteEvent || input.pyeongTypeRouteEvent || '',
      status: input.lineMapRouteStatus || input.pyeongTypeRouteStatus || 0,
      reason: input.lineMapRouteReason || input.pyeongTypeRouteReason || '',
      rowCount: Number(input.lineMapRouteRowCount || input.pyeongTypeLineMapRowCount || 0),
      durationMs: Number(input.lineMapRouteDurationMs || 0),
      shapeSummary: input.lineMapRouteShapeSummary || ''
    }];
    const parts = source
      .map((item) => {
        const endpoint = String(item.endpoint || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 24) || '-';
        const status = Number(item.status || 0) || 0;
        const rows = Number(item.rowCount || 0) || 0;
        const reason = candidateRejectReasonLabel(String(item.reason || '-'));
        const duration = Number(item.durationMs || 0) > 0 ? ` \u00B7 ${Number(item.durationMs || 0)}ms` : '';
        return `${endpoint} \u00B7 HTTP ${status || '-'} \u00B7 ${reason} \u00B7 \uB77C\uC778 ${rows}\uAC1C${duration}`;
      })
      .filter(Boolean);
    if (!parts.length) return pyeongTypeRouteLabel(input);
    const shape = String(input.lineMapRouteShapeSummary || '').slice(0, 160);
    return shape ? `${parts.join(' / ')} \u00B7 shape ${shape}` : parts.join(' / ');
  }

  function buildingUnitsExactLabel(input) {
    const rows = Number(input && input.buildingUnitsExactRowCount || 0);
    const linked = Number(input && input.buildingUnitsExactArticleLinkedCount || 0);
    const candidates = Number(input && input.buildingUnitsExactCandidateCount || 0);
    const reason = candidateRejectReasonLabel(input && input.buildingUnitsExactReason || '');
    if (input && input.buildingUnitsExactPresent) {
      const floor = Number(input.buildingUnitsExactFloorValue || 0) > 0 ? ` \u00B7 ${Number(input.buildingUnitsExactFloorValue)}\uCE35` : '';
      const type = input.buildingUnitsExactTypeToken ? ` \u00B7 ${input.buildingUnitsExactTypeToken}` : '';
      return `\uD1B5\uACFC \u00B7 \uD589 ${rows}\uAC1C \u00B7 article ${linked}\uAC1C \u00B7 \uD6C4\uBCF4 ${candidates}\uAC1C${floor}${type}`;
    }
    if (rows || linked || candidates || (input && input.buildingUnitsExactReason)) {
      return `${reason || '\uB300\uAE30'} \u00B7 \uD589 ${rows}\uAC1C \u00B7 article ${linked}\uAC1C \u00B7 \uD6C4\uBCF4 ${candidates}\uAC1C`;
    }
    return '-';
  }

  function landLinePromotionLabel(input) {
    if (input.landLineCandidatePresent) {
      return [
        input.landLineCandidateCertainty || 'LAND_LINE',
        input.landLineCandidateSource || 'land-line-after-group',
        input.landLineProofSource || '-'
      ].join(' \u00B7 ');
    }
    if (input.landLineRejectedReason) {
      return `\uB300\uAE30 \u00B7 ${candidateRejectReasonLabel(input.landLineRejectedReason)}`;
    }
    return '-';
  }

  function groupCandidateLabel(input) {
    const route = groupSourceLabel(input.groupCandidateSource) || '-';
    if (input.groupCandidatePresent) return `${route} \u00B7 \uD1B5\uACFC`;
    if (input.groupCandidateRejectedReason) return `${route} \u00B7 ${candidateRejectReasonLabel(input.groupCandidateRejectedReason)}`;
    const count = Number(input.groupCandidateCount || 0);
    return count > 0 ? `${route} \u00B7 ${count}\uAC1C` : '-';
  }

  function groupCandidateRankedSummary(input) {
    const summary = String(input && input.groupCandidateRankedSummary || '');
    return /^[A-Za-z0-9:-]+(?:\/[A-Za-z0-9:-]+){0,12}$/.test(summary) ? summary : '-';
  }

  function countMapLabel(input, labels) {
    const source = input && typeof input === 'object' ? input : {};
    const entries = Object.entries(source)
      .filter(([, value]) => Number(value || 0) > 0)
      .slice(0, 5);
    if (!entries.length) return '-';
    return entries.map(([key, value]) => `${labels && labels[key] || key} ${Number(value || 0)}`).join(' · ');
  }

  function groupFloorHintDiagnosticLabel(input) {
    const seen = Number(input && input.groupRouteFloorHintSeenCount || 0);
    const accepted = Number(input && input.groupRouteFloorHintAcceptedCount || 0);
    const rejected = Number(input && input.groupRouteFloorHintRejectedCount || 0);
    if (seen <= 0 && accepted <= 0 && rejected <= 0) return '-';
    const reasonLabels = {
      'band-or-total-only': '\uCE35\uB300/\uCD1D\uCE35',
      'unparsed-floor-value': '\uD30C\uC2F1\uBD88\uAC00',
      'non-floor-text': '\uCE35\uBB38\uAD6C\uC544\uB2D8',
      empty: '\uAC12\uC5C6\uC74C'
    };
    const fieldLabel = countMapLabel(input.groupRouteFloorHintSeenByField);
    const reasonLabel = countMapLabel(input.groupRouteFloorHintRejectByReason, reasonLabels);
    return `\uBCF4\uC784 ${seen} \u00B7 \uC815\uD655\uCE35 ${accepted} \u00B7 \uBC84\uB9BC ${rejected} \u00B7 \uD544\uB4DC ${fieldLabel} \u00B7 \uC774\uC720 ${reasonLabel}`;
  }

  function groupFloorHintGuardLabel(input) {
    const seen = Number(input && input.groupFloorHintGuardSeenCount || 0);
    const matched = Number(input && input.groupFloorHintGuardMatchedCount || 0);
    if (seen <= 0 && matched <= 0) return '-';
    const rejectLabels = {
      'dong-mismatch': '\uB3D9 \uBD88\uC77C\uCE58',
      'type-mismatch': '\uD3C9\uD615 \uBD88\uC77C\uCE58',
      'area-mismatch': '\uC804\uC6A9\uBA74\uC801 \uBD88\uC77C\uCE58',
      'pyeong-no-mismatch': '\uD3C9\uD615\uBC88\uD638 \uBD88\uC77C\uCE58',
      'total-floor-mismatch': '\uCD1D\uCE35 \uBD88\uC77C\uCE58',
      'provider-floor-mismatch': '\uCE35\uB300 \uBD88\uC77C\uCE58',
      'invalid-floor-hint': '\uCE35 \uB2E8\uC11C \uBB34\uD6A8'
    };
    const rejected = Math.max(0, seen - matched);
    const reasonLabel = countMapLabel(input.groupFloorHintGuardRejectByReason, rejectLabels);
    return `\uAC80\uC99D ${seen} \u00B7 \uD1B5\uACFC ${matched} \u00B7 \uD0C8\uB77D ${rejected} \u00B7 \uC774\uC720 ${reasonLabel}`;
  }

  function providerCandidateRankedSummary(input) {
    const summary = String(input && input.providerCandidateRankedSummary || '');
    return /^[A-Za-z0-9:_-]+(?:\/[A-Za-z0-9:_-]+){0,12}$/.test(summary) ? summary : '-';
  }

  function directLookupStepLabel(value) {
    const labels = {
      prepare: '\uC900\uBE44',
      'mk-redirect': 'MK redirect',
      'kiso-popup': 'KISO popup',
      'landad-kiso-json': 'MK landad',
      'current-page-landad-kiso-json': 'MK landad',
      'group-route-landad-kiso-json': 'MK landad'
    };
    return labels[value] || String(value || '-');
  }

  function directLookupStatusLabel(value) {
    const labels = {
      idle: '\uB300\uAE30',
      running: '\uC870\uD68C \uC911',
      candidate: '\uD6C4\uBCF4 \uBC1C\uACAC',
      'candidate-stored': '\uD6C4\uBCF4 \uC800\uC7A5',
      'missing-key': '\uB9E4\uBB3C\uD0A4 \uC5C6\uC74C',
      'missing-marker': '\uC120\uD0DD \uB9E4\uBB3C \uC2DD\uBCC4\uC790 \uC5C6\uC74C',
      'marker-mismatch': '\uC120\uD0DD \uB9E4\uBB3C \uBD88\uC77C\uCE58',
      'missing-provider-marker': '\uC81C\uACF5\uCC98 \uC120\uD0DD \uC99D\uAC70 \uC5C6\uC74C',
      'provider-marker-mismatch': '\uC81C\uACF5\uCC98 \uC120\uD0DD \uC99D\uAC70 \uBD88\uC77C\uCE58',
      'provider-not-mk': 'MK \uC9C1\uC811\uC870\uD68C \uB300\uC0C1 \uC544\uB2D8',
      'non-mk-not-wired': '\uC9C1\uC811\uC870\uD68C \uC5B4\uB311\uD130 \uBBF8\uC5F0\uACB0',
      'missing-provider': 'CP \uC2DD\uBCC4 \uC5C6\uC74C',
      'missing-fetch': '\uC870\uD68C\uAE30 \uC5C6\uC74C',
      'redirect-http-stop': 'MK redirect \uC2E4\uD328',
      'redirect-body-too-large': 'MK redirect \uC790\uB8CC \uD06C\uAE30 \uCD08\uACFC',
      'missing-sequence': 'mseq \uC5C6\uC74C',
      'popup-http-stop': 'KISO popup \uC2E4\uD328',
      'popup-body-too-large': 'KISO popup \uC790\uB8CC \uD06C\uAE30 \uCD08\uACFC',
      'visible-fallback-only': '\uAD6C\uC870\uD654 \uD544\uB4DC \uC5C6\uC774 \uD654\uBA74\uBB38\uAD6C \uD6C4\uBCF4\uB9CC \uC788\uC74C',
      'no-candidate': '\uD6C4\uBCF4 \uC5C6\uC74C',
      'fallback-opened': '\uD0ED \uC5F4\uAE30\uB85C \uC804\uD658',
      'direct-lookup-slow': '\uC9C1\uC811\uC870\uD68C \uC9C0\uC5F0',
      'lookup-error': '\uC870\uD68C \uC624\uB958',
      'lookup-unavailable': '\uC870\uD68C \uBAA8\uB4C8 \uC5C6\uC74C',
      'not-executable': '\uC2E4\uD589 \uC870\uAC74 \uBD88\uC77C\uCE58',
      'candidate-store-miss': '\uD6C4\uBCF4 \uC800\uC7A5 \uC2E4\uD328'
    };
    return labels[value] || String(value || '-');
  }

  function directLookupBodyShapeLabel(value) {
    if (!value) return '';
    const labels = {
      empty: '\uBE48 \uC751\uB2F5',
      'known-structured': '\uAD6C\uC870\uD654\uC790\uB8CC',
      'visible-fragment': '\uD654\uBA74\uBB38\uAD6C',
      'broker-office-only': '\uC911\uAC1C\uC0AC \uC8FC\uC18C\uB9CC',
      'no-safe-signal': '\uC548\uC804\uB2E8\uC11C \uC5C6\uC74C'
    };
    return labels[value] || String(value || '-');
  }

  function directLookupStructuredValueStatusLabel(value) {
    if (!value) return '';
    const labels = {
      none: '\uAD6C\uC870\uAC12 \uC5C6\uC74C',
      'usable-candidate': '\uAD6C\uC870\uAC12 \uD6C4\uBCF4',
      'usable-floor-hint': '\uAD6C\uC870\uAC12 \uCE35\uB2E8\uC11C',
      unusable: '\uAD6C\uC870\uAC12 \uBD88\uC77C\uCE58'
    };
    return labels[value] || String(value || '-');
  }

  function directLookupVisibleFragmentStatusLabel(value) {
    if (!value) return '';
    const labels = {
      none: '\uD654\uBA74\uBB38\uAD6C \uC5C6\uC74C',
      accepted: '\uD654\uBA74\uBB38\uAD6C \uCE35\uBC94\uC704 \uD1B5\uACFC',
      'floor-mismatch': '\uD654\uBA74\uBB38\uAD6C \uCE35\uBC94\uC704 \uBD88\uC77C\uCE58'
    };
    return labels[value] || String(value || '-');
  }

  function providerDirectLookupLabel(input) {
    const status = String(input && input.providerDirectLookupStatus || '');
    if (!status || status === 'idle') return '-';
    const family = providerFamilyLabel(input && input.providerDirectLookupProviderFamily)
      || providerFamilyLabel(input && input.cpProviderCurrentFamily)
      || providerLabel(input && input.cpProviderFamilies);
    const address2 = input && input.providerDirectLookupAddress2Seen ? 'address2 \uC788\uC74C' : 'address2 \uC5C6\uC74C';
    const sequence = input && input.providerDirectLookupSequenceSeen ? 'mseq \uBC1C\uACAC' : 'mseq \uC5C6\uC74C';
    const redirectStatus = boundedCount(input && input.providerDirectLookupRedirectStatus);
    const popupStatus = boundedCount(input && input.providerDirectLookupPopupStatus);
    const http = [
      redirectStatus ? `redirect ${redirectStatus}` : '',
      popupStatus ? `popup ${popupStatus}` : ''
    ].filter(Boolean).join('/');
    const bodyShape = directLookupBodyShapeLabel(input && input.providerDirectLookupBodyShape);
    const fieldName = safeDiagnosticKey(input && input.providerDirectLookupStructuredFieldName);
    const structured = input && input.providerDirectLookupStructuredFieldSeen
      ? `\uAD6C\uC870\uD654\uD544\uB4DC ${fieldName || '\uC788\uC74C'}`
      : '\uAD6C\uC870\uD654\uD544\uB4DC \uC5C6\uC74C';
    const structuredStatus = directLookupStructuredValueStatusLabel(input && input.providerDirectLookupStructuredValueStatus);
    const visible = input && input.providerDirectLookupVisibleFragmentSeen
      ? '\uD654\uBA74\uBB38\uAD6C \uD6C4\uBCF4 \uC788\uC74C'
      : '\uD654\uBA74\uBB38\uAD6C \uD6C4\uBCF4 \uC5C6\uC74C';
    const visibleStatus = directLookupVisibleFragmentStatusLabel(input && input.providerDirectLookupVisibleFragmentStatus);
    const visibleOnly = input && input.providerDirectLookupVisibleFallbackOnly
      ? '\uD654\uBA74\uBB38\uAD6C\uB9CC \uC788\uC5B4 \uBCF4\uB958'
      : '';
    const brokerOffice = input && input.providerDirectLookupBrokerOfficeBlockSeen
      ? '\uC911\uAC1C\uC0AC\uC8FC\uC18C \uBE14\uB85D \uC788\uC74C'
      : '';
    const candidate = input && input.providerDirectLookupCandidatePresent
      ? 'address2 \uD6C4\uBCF4 \uC788\uC74C'
      : (input && input.providerDirectLookupFloorHintPresent ? '\uCE35\uB2E8\uC11C \uC788\uC74C' : '\uD6C4\uBCF4 \uC5C6\uC74C');
    const reason = input && input.providerDirectLookupRejectReason
      ? directLookupStatusLabel(input.providerDirectLookupRejectReason)
      : '';
    return [family, directLookupStatusLabel(status), directLookupStepLabel(input && input.providerDirectLookupStep), http, sequence, bodyShape, address2, structured, structuredStatus, visible, visibleStatus, visibleOnly, brokerOffice, candidate, reason]
      .filter(Boolean)
      .join(' \u00B7 ');
  }

  function groupRouteStatusLabel(status, reason) {
    const rejectReason = String(reason || '');
    if (['http-401', 'http-403'].includes(rejectReason)) return '\uC811\uADFC \uC81C\uD55C';
    if (rejectReason === 'http-429' || rejectReason === 'rate-limited') return '\uC694\uCCAD \uC81C\uD55C';
    const labels = {
      idle: '\uB300\uAE30',
      queued: '\uB300\uAE30\uC5F4',
      opening: '\uC5F4\uAE30',
      waiting: '\uB300\uAE30',
      fetching: '\uC790\uB8CC \uBD88\uB7EC\uC624\uB294 \uC911',
      validating: '\uAC80\uC99D \uC911',
      rejected: '\uBD88\uC77C\uCE58',
      captured: '\uD1B5\uACFC',
      exhausted: '\uD6C4\uBCF4 \uC5C6\uC74C',
      blocked: '\uC774 \uACBD\uB85C \uCC28\uB2E8'
    };
    return labels[status] || String(status || '-');
  }

  function groupRouteScanLabel(input) {
    const source = groupSourceLabel(input.groupRouteSource) || '-';
    const status = groupRouteStatusLabel(input.groupRouteStatus || 'idle', input.groupRouteLastRejectReason);
    const index = Number(input.groupRouteIndex || 0);
    const count = Number(input.groupRouteCount || 0);
    const candidates = Number(input.groupRouteCandidateCount || 0);
    const rejected = Number(input.groupRouteRejectedCount || 0);
    const reason = input.groupRouteLastRejectReason
      ? candidateRejectReasonLabel(input.groupRouteLastRejectReason)
      : '-';
    if (!input.groupRouteSource && (!input.groupRouteStatus || input.groupRouteStatus === 'idle')) return '-';
    return `${source} \u00B7 ${status} \u00B7 ${Math.max(1, index + 1)}/${count || 1} \u00B7 \uAC80\uC99D\uAC12 ${candidates}\uAC1C \u00B7 \uAC70\uC808 ${rejected}\uAC1C \u00B7 ${reason}`;
  }

  function boundedCount(value) {
    const count = Number(value || 0);
    if (!Number.isFinite(count) || count <= 0) return 0;
    return Math.min(999, Math.floor(count));
  }

  function safeDiagnosticKey(value) {
    return String(value || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40);
  }

  function safeShapeSummary(value) {
    return String(value || '')
      .replace(/https?:\/\/\S+/gi, 'url')
      .replace(/article:[A-Za-z0-9]+/gi, 'article')
      .replace(/[^A-Za-z0-9_.:,\[\]\- ]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180);
  }

  function sourceCountSummary(map) {
    if (!map || typeof map !== 'object') return '';
    return Object.entries(map)
      .map(([key, value]) => {
        const source = safeDiagnosticKey(key);
        if (!source) return '';
        return `${source} ${boundedCount(value)}`;
      })
      .filter(Boolean)
      .join(' / ');
  }

  function rejectReasonCountSummary(map) {
    if (!map || typeof map !== 'object') return '';
    return Object.entries(map)
      .map(([key, value]) => {
        const reason = candidateRejectReasonLabel(key);
        return reason && reason !== '-' ? `${reason} ${boundedCount(value)}` : '';
      })
      .filter(Boolean)
      .join(' / ');
  }

  function groupRouteRawLabel(input) {
    const total = boundedCount(input && input.groupRouteFloorHintRawCount);
    const bySource = sourceCountSummary(input && input.groupRouteFloorHintRawBySource);
    return bySource ? `\uC815\uD655\uCE35 \uC6D0\uD589 ${total}\uAC1C \u00B7 ${bySource}` : `\uC815\uD655\uCE35 \uC6D0\uD589 ${total}\uAC1C`;
  }

  function groupRouteShapeLabel(input) {
    const current = safeShapeSummary(input && input.groupRouteShapeSummary);
    const bySource = input && input.groupRouteShapeBySource && typeof input.groupRouteShapeBySource === 'object'
      ? Object.entries(input.groupRouteShapeBySource)
        .map(([key, value]) => {
          const source = safeDiagnosticKey(key);
          const shape = safeShapeSummary(value);
          return source && shape ? `${source} ${shape}` : '';
        })
        .filter(Boolean)
        .join(' / ')
      : '';
    return [current, bySource].filter(Boolean).join(' / ') || '-';
  }

  function providerRouteLookupLabel(input) {
    const total = boundedCount(input && input.providerRouteLookupRawCount);
    if (!total) return '-';
    const source = groupSourceLabel(input && input.providerRouteLookupLastSource)
      || safeDiagnosticKey(input && input.providerRouteLookupLastSource)
      || '-';
    const match = boundedCount(input && input.providerRouteLookupMatchCount);
    const groupContext = boundedCount(input && input.providerRouteLookupGroupContextCount);
    const rejected = boundedCount(input && input.providerRouteLookupRejectedCount);
    const attempted = boundedCount(input && input.providerRouteLookupAttemptedCount);
    const batch = providerRouteLookupBatchStatusLabel(input && input.providerRouteLookupBatchStatus);
    const reason = input && input.providerRouteLookupLastRejectReason
      ? candidateRejectReasonLabel(input.providerRouteLookupLastRejectReason)
      : '-';
    const bySource = sourceCountSummary(input && input.providerRouteLookupBySource);
    const byReason = rejectReasonCountSummary(input && input.providerRouteLookupRejectByReason);
    const rejectSummary = byReason ? `\uD0C8\uB77D\uC0AC\uC720 ${byReason}` : reason;
    return `${source} \u00B7 \uD1A0\uD070 ${total}\uAC1C \u00B7 \uD1B5\uACFC ${match}\uAC1C${groupContext ? ` \u00B7 \uBB36\uC74C\uC99D\uAC70 ${groupContext}\uAC1C` : ''} \u00B7 \uC2DC\uB3C4 ${attempted}\uAC1C \u00B7 ${batch} \u00B7 \uAC70\uC808 ${rejected}\uAC1C \u00B7 ${rejectSummary}${bySource ? ` \u00B7 ${bySource}` : ''}`;
  }

  function providerEvidenceTempLabel(input) {
    const pending = Boolean(input && input.providerEvidenceTempPendingActive);
    const total = boundedCount(input && input.providerEvidenceTempCount);
    const exact = boundedCount(input && input.providerEvidenceTempExactCount);
    const floor = boundedCount(input && input.providerEvidenceTempFloorCount);
    const cleared = boundedCount(input && input.providerEvidenceTempClearedCandidateCount);
    const clearRequest = Boolean(input && input.providerEvidenceTempClearedPendingRequest);
    const families = providerFamilyList(input && input.providerEvidenceTempFamilies);
    const parts = [];
    if (pending) parts.push('\uC218\uC9D1 \uC911');
    if (total) {
      parts.push(`\uD6C4\uBCF4 ${total}\uAC1C`);
      parts.push(`\uB3D9\uD638 ${exact}\uAC1C`);
      parts.push(`\uCE35\uB2E8\uC11C ${floor}\uAC1C`);
      if (families) parts.push(families);
    }
    if (!pending && (cleared || clearRequest)) {
      parts.push(`\uC815\uB9AC\uB428 \uD6C4\uBCF4 ${cleared}\uAC1C`);
      parts.push(clearRequest ? '\uC694\uCCAD \uC815\uB9AC' : '\uC694\uCCAD \uC5C6\uC74C');
    }
    return parts.join(' \u00B7 ') || '-';
  }

  function providerEvidenceCandidateKindLabel(value) {
    const labels = {
      'dong-ho': '\uB3D9\uD638',
      'ho-only': '\uD638\uC218',
      'floor-only': '\uCE35\uB2E8\uC11C',
      none: ''
    };
    return labels[value] || '';
  }

  function providerEvidenceTempSourceSummaryLabel(input) {
    const summaries = Array.isArray(input && input.providerEvidenceTempSourceSummaries)
      ? input.providerEvidenceTempSourceSummaries
      : [];
    const labels = summaries.map((summary) => {
      const item = summary && typeof summary === 'object' ? summary : {};
      const family = providerFamilyLabel(item.providerFamily);
      const sourceLabel = String(item.providerSourceLabel || '');
      const sourceField = String(item.sourceField || '');
      const candidateKind = providerEvidenceCandidateKindLabel(item.candidateKind);
      const certainty = String(item.certainty || '');
      const floorHint = item.floorHintPresent && item.floorHintSourceField
        ? `\uCE35\uB2E8\uC11C \u00B7 ${item.floorHintSourceField}`
        : '';
      return [
        family,
        sourceLabel,
        sourceField,
        candidateKind,
        certainty,
        floorHint
      ].filter(Boolean).join(' \u00B7 ');
    }).filter(Boolean);
    return labels.slice(0, 6).join(' / ') || '-';
  }

  function providerRouteLookupBatchStatusLabel(value) {
    const labels = {
      ready: '\uC2DC\uB3C4 \uC900\uBE44',
      'no-match': '\uB9DE\uB294 \uD1A0\uD070 \uC5C6\uC74C',
      'already-attempted': '\uC774\uBBF8 \uC2DC\uB3C4\uD568',
      'article-attempting': '\uC120\uD0DD\uB9E4\uBB3C \uD1A0\uD070 \uC870\uD68C',
      'group-context-attempting': '\uBB36\uC74C\uC99D\uAC70 \uD1A0\uD070 \uC870\uD68C',
      'lookup-failed': '\uC870\uD68C \uC2E4\uD328',
      'candidate-stored': '\uD6C4\uBCF4 \uC800\uC7A5 \uC644\uB8CC',
      exhausted: '\uC2DC\uB3C4 \uC644\uB8CC'
    };
    return labels[value] || String(value || '-');
  }

  function providerEvidenceTargetLabel(input) {
    const family = providerFamilyLabel(input && input.providerEvidenceTempTargetFamily);
    const count = boundedCount(input && input.providerEvidenceTempTargetCount);
    const index = boundedCount(input && input.providerEvidenceTempTargetIndex);
    const progress = count > 0 ? `${Math.min(count, index + 1)}/${count}` : '';
    return [family, progress].filter(Boolean).join(' ');
  }

  function providerEvidencePipelineLabel(input) {
    const pending = Boolean(input && input.providerEvidenceTempPendingActive);
    const total = boundedCount(input && input.providerEvidenceTempCount);
    const exact = boundedCount(input && input.providerEvidenceTempExactCount);
    const floor = boundedCount(input && input.providerEvidenceTempFloorCount);
    const cleared = boundedCount(input && input.providerEvidenceTempClearedCandidateCount);
    const clearRequest = Boolean(input && input.providerEvidenceTempClearedPendingRequest);
    const tabsClose = Boolean(input && input.providerEvidenceTempTabsCloseScheduled);
    const target = providerEvidenceTargetLabel(input);
    if (pending) {
      return [
        '\uC218\uC9D1 \uC911',
        target,
        `tmp ${total}\uAC1C`,
        `\uD544\uD130 \uB3D9\uD638 ${exact}\uAC1C/\uCE35\uB2E8\uC11C ${floor}\uAC1C`,
        '\uC885\uD569 \uB300\uAE30'
      ].filter(Boolean).join(' \u00B7 ');
    }
    if (total > 0) {
      return [
        '\uD544\uD130\uB9C1 \uC644\uB8CC',
        target,
        `tmp ${total}\uAC1C`,
        `\uD544\uD130 \uB3D9\uD638 ${exact}\uAC1C/\uCE35\uB2E8\uC11C ${floor}\uAC1C`,
        '\uC885\uD569 \uB300\uAE30'
      ].filter(Boolean).join(' \u00B7 ');
    }
    if (cleared || clearRequest || tabsClose) {
      return [
        '\uC815\uB9AC \uC644\uB8CC',
        `tmp \uC0AD\uC81C ${cleared}\uAC1C`,
        tabsClose ? 'CP \uD0ED \uB2EB\uAE30 \uC608\uC57D' : (clearRequest ? '\uC694\uCCAD \uC815\uB9AC' : '')
      ].filter(Boolean).join(' \u00B7 ');
    }
    return '-';
  }

  function officialModeLabel(value) {
    const labels = {
      none: '\uC5C6\uC74C',
      'exact-floor': '\uC815\uD655\uCE35',
      'floor-band': '\uCE35\uB300',
      'all-rows': '\uC804\uCCB4\uD589'
    };
    return labels[value] || String(value || '\uC5C6\uC74C');
  }

  function cpReadinessLabel(value) {
    const labels = {
      none: '\uC5C6\uC74C',
      'broker-only': '\uC911\uAC1C\uC0AC\uBB38\uAD6C',
      'provider-name': '\uC81C\uACF5\uCC98\uBA85',
      'provider-link': '\uC81C\uACF5\uCC98\uB9C1\uD06C',
      'provider-click-target': '\uBC84\uD2BC\uD6C4\uBCF4',
      'technical-id': '\uAE30\uC220ID',
      'network-provider': '\uB124\uD2B8\uC6CC\uD06C\uC81C\uACF5\uCC98',
      'ambiguous-provider-family': '\uC81C\uACF5\uCC98 \uC5EC\uB7EC\uAC1C'
    };
    return labels[value] || String(value || '\uC5C6\uC74C');
  }

  function candidateGuardLabel(input) {
    const reason = input.providerCandidateRejectedReason || '';
    if (reason) return candidateRejectReasonLabel(reason);
    return input.providerCandidatePresent ? '\uD1B5\uACFC' : '-';
  }

  function providerCandidateSourceDiagnostic(input) {
    const sourceLabel = String(input && input.providerCandidateSourceLabel || '');
    const sourceField = String(input && input.providerCandidateSource || '');
    const certainty = String(input && input.providerCandidateCertainty || '');
    const rank = Number(input && input.providerCandidateRank || 0);
    const parts = [sourceLabel, sourceField, certainty, rank > 0 ? `rank ${rank}` : ''].filter(Boolean);
    if (parts.length > 0) return parts.join(' \u00B7 ');

    const rejectedSourceLabel = String(input && input.providerCandidateRejectedSourceLabel || '');
    const rejectedSourceField = String(input && input.providerCandidateRejectedSource || '');
    const rejectedKind = String(input && input.providerCandidateRejectedKind || '');
    const rejectedFamily = providerFamilyLabel(input && input.providerCandidateRejectedFamily);
    const rejectedParts = [
      input && input.providerCandidateRejectedReason ? '\uAC70\uC808' : '',
      rejectedSourceLabel,
      rejectedSourceField,
      rejectedKind,
      rejectedFamily
    ].filter(Boolean);
    return rejectedParts.length > 1 ? rejectedParts.join(' \u00B7 ') : '-';
  }

  function autoLoopDeveloperLabel(input) {
    const status = String(input && input.autoLoopStatus || '');
    if (!status || status === 'idle') return '-';
    const labels = {
      opening: '\uC5F4\uAE30',
      waiting: '\uB300\uAE30',
      exhausted: '\uC18C\uC9C4',
      done: '\uC644\uB8CC',
      blocked: '\uC911\uB2E8',
      terminal: '\uC885\uB8CC'
    };
    const target = autoLoopTargetLabel(input);
    const attempted = Number(input && input.autoLoopAttemptedCount || 0);
    return `${labels[status] || status} / ${target} / \uC2DC\uB3C4 ${attempted}\uAC1C`;
  }

  function candidateRejectReasonLabel(reason) {
    const labels = {
      'dong-mismatch': '\uB3D9 \uBD88\uC77C\uCE58',
      'floor-mismatch': '\uCE35 \uBD88\uC77C\uCE58',
      'floor-band-mismatch': '\uCE35\uB300 \uBD88\uC77C\uCE58',
      'ho-only-band-context': '\uD638\uC218\uB9CC \uC788\uB294 \uD6C4\uBCF4\uB294 \uC815\uD655\uCE35 \uD544\uC694',
      'provider-floor-mismatch': 'CP \uCE35 \uB2E8\uC11C \uBD88\uC77C\uCE58',
      'invalid-floor-hint': 'CP \uCE35 \uB2E8\uC11C \uBB34\uD6A8',
      'type-mismatch': '\uD3C9\uD615 \uBD88\uC77C\uCE58',
      'area-mismatch': '\uC804\uC6A9\uBA74\uC801 \uBD88\uC77C\uCE58',
      'pyeong-no-mismatch': '\uD3C9\uD615\uBC88\uD638 \uBD88\uC77C\uCE58',
      'total-floor-mismatch': '\uCD1D\uCE35 \uBD88\uC77C\uCE58',
      'estimated-candidate': '\uCD94\uC815\uD6C4\uBCF4',
      'ambiguous-candidate': '\uD6C4\uBCF4 \uC5EC\uB7EC \uAC1C',
      'missing-context': '\uAC80\uC99D \uC804',
      'missing-validator': '\uAC80\uC99D\uAE30 \uC5C6\uC74C',
      'missing-promoter': 'LAND_LINE \uC2B9\uACA9\uAE30 \uC5C6\uC74C',
      'group-proof-missing': '\uBB36\uC74C \uC99D\uAC70 \uB300\uAE30',
      'group-proof-blocked': '\uBB36\uC74C \uACBD\uB85C \uCC28\uB2E8',
      'group-floor-source-mismatch': '\uBB36\uC74C \uCE35\uB2E8\uC11C \uCD9C\uCC98 \uBD88\uC77C\uCE58',
      'exact-floor-proof-missing': '\uC815\uD655\uCE35 \uC99D\uAC70 \uBD80\uC871',
      'pyeong-line-direct-ho-unsafe': '\uD3C9\uD615\uBC88\uD638-\uB77C\uC778 \uCD94\uC815\uC740 \uD655\uC815 \uBD88\uAC00',
      'line-candidate-not-unique': '\uB77C\uC778 \uD6C4\uBCF4 \uBBF8\uD655\uC815',
      'not-promoted': '\uC2B9\uACA9 \uC804',
      'no-matching-candidate': '\uC77C\uCE58 \uD6C4\uBCF4 \uC5C6\uC74C',
      'no-candidate': '\uD6C4\uBCF4 \uC5C6\uC74C',
      'no-floor-hint': '\uC815\uD655\uCE35 \uB2E8\uC11C \uC5C6\uC74C',
      'ambiguous-floor-hint': '\uC815\uD655\uCE35 \uB2E8\uC11C \uC5EC\uB7EC \uAC1C',
      'no-valid-token': 'CP \uD1A0\uD070 \uBB34\uD6A8',
      'missing-active-marker': '\uC120\uD0DD \uB9E4\uBB3C \uC2DD\uBCC4 \uC804',
      'missing-article-marker': '\uC120\uD0DD \uB9E4\uBB3C \uC2DD\uBCC4 \uBD80\uC871',
      'marker-mismatch': '\uC120\uD0DD \uB9E4\uBB3C \uBD88\uC77C\uCE58',
      'article-marker-mismatch': '\uC120\uD0DD \uB9E4\uBB3C \uC2DD\uBCC4 \uBD88\uC77C\uCE58',
      'missing-dong-proof': '\uB3D9 \uC99D\uAC70 \uBD80\uC871',
      'missing-type-proof': '\uD3C9\uD615 \uC99D\uAC70 \uBD80\uC871',
      'missing-provider-proof': 'CP \uBB36\uC74C \uC99D\uAC70 \uBD80\uC871',
      'group-context-multiple': '\uBB36\uC74C \uD6C4\uBCF4 \uC5EC\uB7EC \uAC1C',
      'missing-sequence': 'mseq \uC5C6\uC74C',
      'visible-fallback-only': 'address2 \uC5C6\uC74C',
      'fallback-opened': '\uD0ED \uC5F4\uAE30\uB85C \uC804\uD658',
      'direct-lookup-slow': '\uC9C1\uC811\uC870\uD68C \uC9C0\uC5F0',
      'redirect-http-stop': 'MK redirect \uC2E4\uD328',
      'popup-http-stop': 'KISO popup \uC2E4\uD328',
      'candidate-store-miss': '\uD6C4\uBCF4 \uC800\uC7A5 \uC2E4\uD328',
      'candidates-captured': '\uD6C4\uBCF4 \uC218\uC9D1\uB428',
      'route-fetched': '\uC751\uB2F5 \uC218\uC2E0',
      'line-map-captured': '\uB77C\uC778\uD45C \uC218\uC9D1\uB428',
      'no-line-map': '\uB77C\uC778\uD45C \uC5C6\uC74C',
      'http-stop': '\uCC28\uB2E8 \uC751\uB2F5',
      'http-401': '\uC811\uADFC \uC81C\uD55C',
      'http-403': '\uC811\uADFC \uC81C\uD55C',
      'http-429': '\uC694\uCCAD \uC81C\uD55C',
      'http-error': '\uC751\uB2F5 \uC624\uB958',
      'non-json': '\uC790\uB8CC \uD615\uC2DD \uBD88\uC77C\uCE58',
      'response-too-large': '\uC790\uB8CC \uD06C\uAE30 \uCD08\uACFC',
      'no-response': '\uC751\uB2F5 \uC5C6\uC74C',
      'empty-body': '\uBE48 \uC751\uB2F5',
      'body-timeout': '\uBCF8\uBB38 \uC77D\uAE30 \uC2DC\uAC04\uCD08\uACFC',
      'body-parse-error': '\uBCF8\uBB38 \uD574\uC11D \uC2E4\uD328',
      'network-error': '\uB124\uD2B8\uC6CC\uD06C \uC624\uB958',
      'missing-active-route-api': '\uB2A5\uB3D9 \uACBD\uB85C \uBAA8\uB4C8 \uC5C6\uC74C',
      'missing-article': '\uB9E4\uBB3C \uC2DD\uBCC4\uC790 \uC5C6\uC74C',
      'missing-complex': '\uB2E8\uC9C0 \uC2DD\uBCC4\uC790 \uC5C6\uC74C',
      'route-local-only': '\uD654\uBA74 \uB0B4 \uAC80\uC99D \uACBD\uB85C',
      'article-changed': '\uB9E4\uBB3C \uBCC0\uACBD\uB428',
      'phase-mismatch': '\uD655\uC778 \uACBD\uB85C \uBD88\uC77C\uCE58',
      'runtime-invalidated': '\uD655\uC7A5 \uC7AC\uB85C\uB4DC \uD544\uC694'
    };
    return labels[reason] || String(reason || '-');
  }

  function resolverBranchLabel(value) {
    const labels = {
      idle: '\uB300\uAE30',
      stop: '\uC911\uB2E8',
      'same-card': '\uB3D9\uC77C\uCE74\uB4DC',
      'official-table': '\uACF5\uC2DD\uD45C(\uCC38\uACE0)',
      'cpid-ui': 'CP \uD6C4\uBCF4',
      sameAddress: '\uAC19\uC740\uC8FC\uC18C',
      'complex-cache': '\uB2E8\uC9C0\uB9E4\uBB3C',
      'kb-alias': 'KB \uB2E8\uC9C0\uC2DD\uBCC4',
      'naver-cache': '\uB124\uC774\uBC84\uC790\uB8CC(\uCC38\uACE0)',
      'line-inference': '\uD3C9\uD615\u00B7\uB77C\uC778\uCD94\uB860',
      ambiguous: '\uBD88\uBA85\uD655'
    };
    return labels[value] || String(value || '\uB300\uAE30');
  }

  function resolverOutcomeLabel(value) {
    const labels = {
      'no-article': '\uB9E4\uBB3C\uC5C6\uC74C',
      'needs-evidence': '\uC99D\uAC70\uD544\uC694',
      'needs-group-candidates': '\uBB36\uC74C\uD6C4\uBCF4\uD544\uC694',
      'needs-cache-match': '\uB3D9\uD638\uC218 \uD655\uC778\uACBD\uB85C \uC544\uB2D8',
      'complex-alias-seen': '\uB2E8\uC9C0\uB9E4\uD551\uB2E8\uC11C',
      'direct-alias': '\uC9C1\uC811\uB9E4\uD551\uB2E8\uC11C',
      'candidate-one': '\uB2E8\uC77C\uD6C4\uBCF4',
      'line-type-single-estimated': '\uD3C9\uD615\u00B7\uB77C\uC778 \uB2E8\uC77C \uCD94\uC815',
      'line-type-multiple': '\uD3C9\uD615\u00B7\uB77C\uC778 \uD6C4\uBCF4 \uC5EC\uB7EC \uAC1C',
      'land-line-after-group': 'LAND_LINE \uD655\uC815',
      'land-line-after-provider-floor': 'LAND_LINE \uD655\uC815',
      'land-line-direct-ho-corroborated': 'LAND_LINE \uD655\uC815',
      'land-line-pyeong-no-line-direct-ho': 'LAND_LINE \uD655\uC815',
      'building-units-article-linked': '\uB3D9\uC815\uBCF4 \uB2E8\uC77C\uD638 \uD655\uC815',
      'official-table-exact': '\uC0C1\uC138\uD654\uBA74 \uB2E8\uC77C\uD638 \uD655\uC815',
      'reference-one': '\uCC38\uACE0\uD6C4\uBCF4 1\uAC1C',
      'visible-ho': '\uD638\uC218\uB178\uCD9C',
      blocked: '\uC911\uB2E8'
    };
    if (!value) return '\uB9E4\uBB3C\uC5C6\uC74C';
    if (String(value).startsWith('provider:')) return `\uC81C\uACF5\uCC98 ${cpReadinessLabel(String(value).slice(9))}`;
    if (String(value).startsWith('captured:')) return '\uD6C4\uBCF4\uD655\uBCF4';
    if (String(value).startsWith('captured-group:')) return '\uBB36\uC74C\uD6C4\uBCF4\uD655\uBCF4';
    if (String(value).startsWith('candidates:')) return `\uD6C4\uBCF4 ${String(value).slice(11)}\uAC1C`;
    if (String(value).startsWith('reference-candidates:')) return `\uCC38\uACE0\uD6C4\uBCF4 ${String(value).slice(21)}\uAC1C`;
    return labels[value] || String(value);
  }

  function evidenceLabel(value) {
    const labels = {
      none: '\uC5C6\uC74C',
      cpProvider: 'CP\uC81C\uACF5\uC0AC',
      sameAddress: '\uAC19\uC740\uC8FC\uC18C',
      representativeArticles: '\uB300\uD45C\uB9E4\uBB3C',
      complexList: '\uB2E8\uC9C0\uB9E4\uBB3C\uBAA9\uB85D',
      complexCache: '\uB2E8\uC9C0\uCE90\uC2DC',
      kbAlias: 'KB\uB2E8\uC9C0\uC2DD\uBCC4',
      landprice: '\uACF5\uC2DC\uAC00',
      prices: '\uC2DC\uC138',
      buildingUnits: '\uB3D9\uC815\uBCF4',
      pyeongtype: '\uD3C9\uD615',
      finFrontApi: 'FIN \uB9E4\uBB3C\uC815\uBCF4',
      naverOther: '\uB124\uC774\uBC84\uAE30\uD0C0',
      other: '\uAE30\uD0C0'
    };
    return labels[value] || String(value || '\uC5C6\uC74C');
  }

  function eventLabel(value) {
    const labels = {
      'bridge-installed': '\uBE0C\uB9AC\uC9C0 \uC124\uCE58\uB428',
      interval: '\uC815\uAE30 \uD655\uC778',
      'dom-mutation': 'DOM \uBCC0\uACBD',
      'page-message': '\uD398\uC774\uC9C0 \uC2E0\uD638',
      popstate: '\uC8FC\uC18C \uBCC0\uACBD',
      'provider-open-click': '\uC81C\uACF5\uCC98 \uC5F4\uAE30',
      'provider-candidate': '\uC81C\uACF5\uCC98 \uD6C4\uBCF4',
      'provider-candidate-rejected': '\uC81C\uACF5\uCC98 \uD6C4\uBCF4 \uAC70\uC808',
      'runtime-invalidated': '\uD655\uC7A5 \uC7AC\uB85C\uB4DC \uD544\uC694'
    };
    return labels[value] || String(value || '-');
  }

  function buildCpInventoryRows(input) {
    const inventory = cpInventory(input);
    if (!inventory) return [];
    const rows = [
      { label: 'CP \uD6C4\uBCF4\uAD70', value: `\uAD00\uCE21 ${providerFamilyList(inventory.observedFamilies) || '-'} / \uAD6C\uD604 ${inventory.implementedCaptureCount}/${inventory.domainCandidateCount} / \uC9C1\uC811\uC870\uD68C ${inventory.backgroundDirectCount || 0}/${inventory.domainCandidateCount} / \uC6D0\uBCF8 CPID ${inventory.directCpidCandidateCount}\uC885 / \uB9E4\uD551 ${inventory.directCpidCoveredCount}/${inventory.directCpidCandidateCount}` },
      { label: 'CP \uBBF8\uAD6C\uD604', value: providerFamilyList(inventory.observedMissingCaptureFamilies) || '-' },
      { label: '\uC6D0\uBCF8 \uBD84\uAE30', value: inventory.branchSummary }
    ];
    const nonDirect = providerFamilyList(inventory.observedNonDirectFamilies);
    if (nonDirect) rows.splice(2, 0, { label: 'CP \uC9C1\uC811\uC870\uD68C \uBBF8\uC5F0\uACB0', value: nonDirect });
    return rows;
  }

  function cpInventory(input) {
    const api = globalScope.DHS_CP_INVENTORY;
    if (!api || typeof api.buildCpInventory !== 'function') return null;
    return api.buildCpInventory(input || {});
  }

  function providerFamilyList(families) {
    return (families || []).map(providerFamilyLabel).filter(Boolean).join(', ');
  }

  function providerFloorHintLabel(input) {
    if (!input || !input.providerFloorHintPresent || !(Number(input.providerFloorHintValue) > 0)) {
      return input && input.providerFloorHintRejectedReason
        ? candidateRejectReasonLabel(input.providerFloorHintRejectedReason)
        : '-';
    }
    const family = input.providerFloorHintSourceLabel || providerFamilyLabel(input.providerFloorHintFamily) || '\uC81C\uACF5\uCC98';
    const floor = Number(input.providerFloorHintValue);
    const total = Number(input.providerFloorHintTotal || 0);
    return `${family} \u00B7 ${floor}${total > 0 ? `/${total}` : ''}\uCE35`;
  }

  function groupRouteProgress(input) {
    const api = globalScope.DHS_GROUP_ROUTES;
    if (!api || typeof api.buildGroupRouteProgress !== 'function') {
      return {
        currentRoute: 'waiting-group-route',
        userLabel: '\uAC19\uC740\uB9E4\uBB3C \uACBD\uB85C \uCC3E\uB294 \uC911',
        developerSummary: 'not-loaded'
      };
    }
    return api.buildGroupRouteProgress(input || {});
  }

  const api = { buildOverlayView, formatDuration };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }

  globalScope.DHS_OVERLAY_VIEW = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
