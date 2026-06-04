import { parseCsv } from './parser.js';
import { t, setLang, initI18n, applyStaticTranslations } from './i18n.js';
import { dedupKey, findHeaderLineIndex } from './parser-utils.js';
import {
  getGroups, getGroup, createGroup, deleteGroup,
  addRule, deleteRule, updateRule, applyGroups, exportGroups, importGroups,
  GROUP_COLORS,
} from './groups.js';

// ─── State ──────────────────────────────────────────────────────────────────
let state = {
  raw: null,          // full parsed result {meta, transactions}
  filtered: [],       // transactions after time range filter
  searchQuery: '',
  searchCaseSensitive: false,
  searchRegex: false,
  tableFiltered: [],  // after search + type filter
  sortCol: 'date',
  sortDir: 'desc',
  page: 1,
  pageSize: 25,
  typeFilter: 'all',
  txMonthFilter: new Set(),  // empty = all; entries: monthKey strings e.g. '2025-01'
  amountMin: 0,
  groupFilter: new Set(),  // empty = all; entries: '__none__' | <groupId>
  monthChartMode: 'bar', // 'bar' | 'stacked'
  rangeMode: 'all',   // 'all' | 'cur' | 'prev' | 'curyr' | 'prevyr' | '3m' | '6m' | '12m' | 'year' | 'month' | 'custom'
  selectedYear: null,
  selectedMonth: null,
  customFrom: null,
  customTo: null,
  charts: {},
};

// ─── DOM refs ────────────────────────────────────────────────────────────────
const uploadScreen = document.getElementById('upload-screen');
const dashboard = document.getElementById('dashboard');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const headerMeta = document.getElementById('header-meta');
const balanceBadge = document.getElementById('balance-badge');

// ─── Boot ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initI18n();
  setupLangSwitcher();
  setupUpload();
  setupGroupsUpload();
  updateRangePillTitles();
  setupCollapseCards();
  setupMergeCard();
});

// ─── Language switcher ───────────────────────────────────────────────────────
function setupLangSwitcher() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setLang(btn.dataset.lang);
      // Re-render dynamic content if dashboard is visible
      if (state.raw) {
        populateYearSel();
        populateMonthSel();
        populateTxMonthFilter();
        renderAll();
        updateRangePillTitles();
      } else {
        updateRangePillTitles();
      }
    });
  });
}

// ─── Upload / Drag-and-drop ──────────────────────────────────────────────────
function setupUpload() {
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault(); dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) loadFile(fileInput.files[0]);
  });

  document.getElementById('load-example-csv-btn').addEventListener('click', async () => {
    const res = await fetch('sample_dkb.csv');
    const text = await res.text();
    loadText(text);
  });
}

function setupGroupsUpload() {
  const input = document.getElementById('groups-input');
  const nameEl = document.getElementById('groups-upload-name');

  function applyGroupsJson(json, label) {
    try {
      importGroups(json);
      _savedSnapshot = exportGroups(); // establish clean baseline
      _undoStack.length = 0; _redoStack.length = 0; _updateUndoRedoBtns();
      nameEl.textContent = label;
      if (state.raw) {
        applyGroups(state.raw.transactions);
        rebuildGroupFilter();
        renderGroupManager();
        applyTableFilters();
        renderTable();
      }
      showGroupsBanner();
    } catch (err) {
      console.error('Failed to import groups', err);
    }
  }

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => applyGroupsJson(e.target.result, file.name);
    reader.readAsText(file);
  });

  document.getElementById('load-example-groups-btn').addEventListener('click', async () => {
    const res = await fetch('sample_groups_dkb.json');
    const json = await res.text();
    applyGroupsJson(json, t('exampleLoaded'));
  });
}

function _applyParsedResult(result) {
  state.raw = result;
  applyGroups(state.raw.transactions);
  initDashboard();
  updateRangePillTitles();
}

function loadFile(file) {
  // Try UTF-8 first; if the text contains the replacement char in the header
  // area, retry with ISO-8859-1 (used by ING-DiBa exports).
  const readerUtf8 = new FileReader();
  readerUtf8.onload = e => {
    const text = e.target.result;
    const headerSample = text.slice(0, 500);
    if (headerSample.includes('\uFFFD')) {
      // Garbled — retry as Latin-1
      const readerLatin = new FileReader();
      readerLatin.onload = e2 => {
        try {
          _applyParsedResult(parseCsv(e2.target.result));
        } catch (err) {
          alert(t('errorParsing') + err.message);
        }
      };
      readerLatin.readAsText(file, 'iso-8859-1');
    } else {
      try {
        _applyParsedResult(parseCsv(text));
      } catch (err) {
        alert(t('errorParsing') + err.message);
      }
    }
  };
  readerUtf8.readAsText(file, 'utf-8');
}

function loadText(text) {
  try {
    const result = parseCsv(text);
    _applyParsedResult(result);
  } catch (err) {
    alert(t('errorParsing') + err.message);
  }
}

// ─── Groups dirty state ───────────────────────────────────────────────────────
let _savedSnapshot = null; // JSON string at last export or import

function _checkDirty() {
  const current = exportGroups();
  const isDirty = _savedSnapshot !== null && current !== _savedSnapshot;
  const banner  = document.getElementById('groups-dirty-banner');
  if (banner) banner.style.display = isDirty ? '' : 'none';
}

function markGroupsDirty() {
  // Called after mutations — just re-evaluate dirty state
  _checkDirty();
}

function showGroupsBanner() {
  // After import: set baseline, then evaluate (will be clean unless already modified)
  _checkDirty();
}

function markGroupsClean() {
  // Called after export: new baseline is current state
  _savedSnapshot = exportGroups();
  _checkDirty();
}

function doExportGroups() {
  const blob = new Blob([exportGroups()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'dkb-groups.json';
  a.click();
  markGroupsClean();
}

// ─── Undo / Redo ──────────────────────────────────────────────────────────────
const _undoStack = [];
const _redoStack = [];
const MAX_UNDO = 50;

function snapshotGroups() {
  _undoStack.push(exportGroups());
  if (_undoStack.length > MAX_UNDO) _undoStack.shift();
  _redoStack.length = 0;
  _updateUndoRedoBtns();
}

function _restoreGroupsSnapshot(json) {
  importGroups(json);
  if (state.raw) applyGroups(state.raw.transactions);
  rebuildGroupFilter();
  renderGroupManager();
  if (state.raw) { applyTableFilters(); renderTable(); }
  _updateUndoRedoBtns();
  _checkDirty();
}

function undoGroups() {
  if (!_undoStack.length) return;
  _redoStack.push(exportGroups());
  _restoreGroupsSnapshot(_undoStack.pop());
}

function redoGroups() {
  if (!_redoStack.length) return;
  _undoStack.push(exportGroups());
  _restoreGroupsSnapshot(_redoStack.pop());
}

function _updateUndoRedoBtns() {
  const u = document.getElementById('group-undo-btn');
  const r = document.getElementById('group-redo-btn');
  if (u) u.disabled = _undoStack.length === 0;
  if (r) r.disabled = _redoStack.length === 0;
}

// ─── Dashboard init ──────────────────────────────────────────────────────────
function initDashboard() {
  const { meta } = state.raw;

  // Update header
  balanceBadge.textContent = meta.balanceRaw || '';
  headerMeta.querySelector('#header-iban').textContent = meta.iban || '';
  headerMeta.querySelector('#header-period').textContent = meta.period || '';

  // Bank-detected hint
  const bankHint = document.getElementById('bank-detected-hint');
  if (bankHint && meta.bankName) {
    bankHint.textContent = `🏦 ${meta.bankName}`;
    bankHint.style.display = '';
  }

  // Show PDF export button
  const pdfBtn = document.getElementById('pdf-export-btn');
  if (pdfBtn) pdfBtn.style.display = '';

  uploadScreen.style.display = 'none';
  dashboard.style.display = 'flex';

  // Populate year selector
  populateYearSel();

  // Populate group filter & render manager
  rebuildGroupFilter();
  renderGroupManager();

  // Default: show all
  state.rangeMode = 'all';
  state.selectedYear = null;
  state.selectedMonth = null;

  applyRange();
  setupFilterListeners();
}

function populateYearSel() {
  const years = [...new Set(state.raw.transactions.map(tx => tx.year))].sort();
  const yearSel = document.getElementById('year-sel');
  yearSel.innerHTML = `<option value="all">${t('allYears')}</option>` +
    years.map(y => `<option value="${y}">${y}</option>`).join('');
}

// ─── Range filter ────────────────────────────────────────────────────────────
function applyRange() {
  const txs = state.raw.transactions;
  const now = new Date();

  let filtered = txs;
  let fromDate = null, toDate = null;

  if (state.rangeMode === 'cur') {
    fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    toDate   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    filtered = txs.filter(tx => tx.year === now.getFullYear() && tx.month === now.getMonth());
  } else if (state.rangeMode === 'prev') {
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevYear  = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    fromDate = new Date(prevYear, prevMonth, 1);
    toDate   = new Date(prevYear, prevMonth + 1, 0);
    filtered = txs.filter(tx => tx.year === prevYear && tx.month === prevMonth);
  } else if (state.rangeMode === 'curyr') {
    fromDate = new Date(now.getFullYear(), 0, 1);
    toDate   = new Date(now.getFullYear(), 11, 31);
    filtered = txs.filter(tx => tx.year === now.getFullYear());
  } else if (state.rangeMode === 'prevyr') {
    const prevYear = now.getFullYear() - 1;
    fromDate = new Date(prevYear, 0, 1);
    toDate   = new Date(prevYear, 11, 31);
    filtered = txs.filter(tx => tx.year === prevYear);
  } else if (state.rangeMode === '3m') {
    fromDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    toDate   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    filtered = txs.filter(tx => tx.date >= fromDate);
  } else if (state.rangeMode === '6m') {
    fromDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    toDate   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    filtered = txs.filter(tx => tx.date >= fromDate);
  } else if (state.rangeMode === '12m') {
    fromDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    toDate   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    filtered = txs.filter(tx => tx.date >= fromDate);
  } else if (state.rangeMode === 'year' && state.selectedYear) {
    fromDate = new Date(state.selectedYear, 0, 1);
    toDate   = new Date(state.selectedYear, 11, 31);
    filtered = txs.filter(tx => tx.year === state.selectedYear);
  } else if (state.rangeMode === 'month' && state.selectedYear && state.selectedMonth !== null) {
    fromDate = new Date(state.selectedYear, state.selectedMonth, 1);
    toDate   = new Date(state.selectedYear, state.selectedMonth + 1, 0);
    filtered = txs.filter(tx => tx.year === state.selectedYear && tx.month === state.selectedMonth);
  } else if (state.rangeMode === 'custom' && state.customFrom && state.customTo) {
    fromDate = state.customFrom;
    toDate   = state.customTo;
    filtered = txs.filter(tx => tx.date >= state.customFrom && tx.date <= state.customTo);
  }

  // Update from/to date inputs to reflect the active range
  if (state.rangeMode !== 'custom') {
    document.getElementById('from-date').value = fromDate ? toInputDate(fromDate) : '';
    document.getElementById('to-date').value   = toDate   ? toInputDate(toDate)   : '';
  }

  state.filtered = filtered;
  state.page = 1;
  populateTxMonthFilter();
  applyTableFilters();
  renderAll();
}

function applyTableFilters() {
  let txs = state.filtered;
  if (state.searchQuery) {
    let match;
    if (state.searchRegex) {
      try {
        const flags = state.searchCaseSensitive ? '' : 'i';
        const re = new RegExp(state.searchQuery, flags);
        match = (str) => re.test(str || '');
      } catch { match = () => false; }
    } else {
      const q = state.searchCaseSensitive ? state.searchQuery : state.searchQuery.toLowerCase();
      match = (str) => state.searchCaseSensitive
        ? (str || '').includes(q)
        : (str || '').toLowerCase().includes(q);
    }
    txs = txs.filter(tx => match(tx.recipient) || match(tx.payer) || match(tx.purpose));
  }
  if (state.typeFilter !== 'all') {
    txs = txs.filter(tx => state.typeFilter === 'income' ? tx.isIncome : tx.isExpense);
  }
  if (state.txMonthFilter.size > 0) {
    txs = txs.filter(tx => state.txMonthFilter.has(tx.monthKey));
  }
  if (state.amountMin > 0) {
    txs = txs.filter(tx => Math.abs(tx.amount) >= state.amountMin);
  }
  if (state.groupFilter.size > 0) {
    const wantsNone = state.groupFilter.has('__none__');
    const groupIds  = [...state.groupFilter].filter(v => v !== '__none__');
    txs = txs.filter(tx => {
      const hasNoGroup = !tx.groups || tx.groups.length === 0;
      if (wantsNone && hasNoGroup) return true;
      if (groupIds.some(id => tx.groups && tx.groups.includes(id))) return true;
      return false;
    });
  }

  // Sort
  txs = [...txs].sort((a, b) => {
    let av = a[state.sortCol], bv = b[state.sortCol];
    if (state.sortCol === 'date') { av = a.date.getTime(); bv = b.date.getTime(); }
    if (typeof av === 'string') return state.sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    return state.sortDir === 'asc' ? av - bv : bv - av;
  });

  state.tableFiltered = txs;
}

// ─── Listeners ───────────────────────────────────────────────────────────────
function setupFilterListeners() {
  // Range pills
  document.querySelectorAll('.range-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.range-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.rangeMode = btn.dataset.range;
      applyRange();
    });
  });

  // Year select
  document.getElementById('year-sel').addEventListener('change', e => {
    const val = e.target.value;
    if (val === 'all') {
      state.rangeMode = 'all'; state.selectedYear = null; state.selectedMonth = null;
    } else {
      state.selectedYear = parseInt(val);
      state.selectedMonth = null;
      state.rangeMode = 'year';
    }
    document.querySelectorAll('.range-pill').forEach(b => b.classList.remove('active'));
    populateMonthSel();
    applyRange();
  });

  // Month select
  document.getElementById('month-sel').addEventListener('change', e => {
    const val = e.target.value;
    if (val === 'all') { state.selectedMonth = null; state.rangeMode = state.selectedYear ? 'year' : 'all'; }
    else { state.selectedMonth = parseInt(val); state.rangeMode = 'month'; }
    applyRange();
  });

  // Custom date range
  document.getElementById('from-date').addEventListener('change', e => {
    state.customFrom = e.target.value ? new Date(e.target.value) : null;
    if (state.customFrom && state.customTo) { state.rangeMode = 'custom'; applyRange(); }
  });
  document.getElementById('to-date').addEventListener('change', e => {
    state.customTo = e.target.value ? new Date(e.target.value + 'T23:59:59') : null;
    if (state.customFrom && state.customTo) { state.rangeMode = 'custom'; applyRange(); }
  });

  // Search
  document.getElementById('table-search').addEventListener('input', e => {
    state.searchQuery = e.target.value;
    state.page = 1;
    applyTableFilters();
    renderTable();
    renderGroupManager();
  });

  // Case-sensitive toggle
  document.getElementById('search-case-btn').addEventListener('click', () => {
    state.searchCaseSensitive = !state.searchCaseSensitive;
    document.getElementById('search-case-btn').classList.toggle('active', state.searchCaseSensitive);
    state.page = 1;
    applyTableFilters();
    renderTable();
  });

  // Regex toggle
  document.getElementById('search-regex-btn').addEventListener('click', () => {
    state.searchRegex = !state.searchRegex;
    document.getElementById('search-regex-btn').classList.toggle('active', state.searchRegex);
    state.page = 1;
    applyTableFilters();
    renderTable();
  });

  // Type filter
  document.getElementById('type-filter').addEventListener('change', e => {
    state.typeFilter = e.target.value;
    state.page = 1;
    applyTableFilters();
    renderTable();
  });

  // Transaction month filter
  // Month filter — multi-select dropdown
  const mfToggle   = document.getElementById('month-filter-toggle');
  const mfDropdown = document.getElementById('month-filter-dropdown');

  mfToggle.addEventListener('click', e => {
    e.stopPropagation();
    const open = mfDropdown.style.display !== 'none';
    mfDropdown.style.display = open ? 'none' : 'block';
  });

  document.addEventListener('click', e => {
    if (!document.getElementById('month-filter-wrap').contains(e.target)) {
      mfDropdown.style.display = 'none';
    }
  });

  function _applyMonthFilterChange() {
    state.page = 1;
    applyTableFilters();
    renderTable();
    populateTxMonthFilter(); // re-render checkboxes + chips
  }

  document.getElementById('month-filter-list').addEventListener('change', e => {
    const chk = e.target.closest('input[type="checkbox"]');
    if (!chk) return;
    if (chk.checked) state.txMonthFilter.add(chk.value); else state.txMonthFilter.delete(chk.value);
    _applyMonthFilterChange();
  });

  document.getElementById('month-filter-chips').addEventListener('click', e => {
    const btn = e.target.closest('.gf-chip-remove');
    if (!btn) return;
    state.txMonthFilter.delete(btn.dataset.val);
    _applyMonthFilterChange();
  });

  // Group filter — multi-select dropdown
  const gfToggle   = document.getElementById('group-filter-toggle');
  const gfDropdown = document.getElementById('group-filter-dropdown');

  gfToggle.addEventListener('click', e => {
    e.stopPropagation();
    const open = gfDropdown.style.display !== 'none';
    gfDropdown.style.display = open ? 'none' : 'block';
  });

  document.addEventListener('click', e => {
    if (!document.getElementById('group-filter-wrap').contains(e.target)) {
      gfDropdown.style.display = 'none';
    }
  });

  function _applyGroupFilterChange() {
    state.page = 1;
    applyTableFilters();
    renderTable();
    rebuildGroupFilter();
  }

  document.getElementById('gf-none').addEventListener('change', e => {
    if (e.target.checked) state.groupFilter.add('__none__'); else state.groupFilter.delete('__none__');
    _applyGroupFilterChange();
  });

  document.getElementById('group-filter-list').addEventListener('change', e => {
    const chk = e.target.closest('.gf-group-chk');
    if (!chk) return;
    if (chk.checked) state.groupFilter.add(chk.value); else state.groupFilter.delete(chk.value);
    _applyGroupFilterChange();
  });

  document.getElementById('group-filter-chips').addEventListener('click', e => {
    const btn = e.target.closest('.gf-chip-remove');
    if (!btn) return;
    state.groupFilter.delete(btn.dataset.val);
    _applyGroupFilterChange();
  });

  // Group manager buttons (delegated)
  document.getElementById('group-new-btn').addEventListener('click', () => {
    const name = prompt(t('groupsName'));
    if (!name) return;
    snapshotGroups();
    createGroup(name.trim());
    applyGroups(state.raw.transactions);
    rebuildGroupFilter();
    renderGroupManager();
    applyTableFilters();
    renderTable();
    markGroupsDirty();
  });

  document.getElementById('group-export-btn').addEventListener('click', doExportGroups);
  document.getElementById('groups-dirty-export-btn').addEventListener('click', doExportGroups);

  document.getElementById('group-undo-btn').addEventListener('click', undoGroups);
  document.getElementById('group-redo-btn').addEventListener('click', redoGroups);

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') { e.preventDefault(); undoGroups(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redoGroups(); }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    // Ctrl+F / Cmd+F → focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      document.getElementById('table-search')?.focus();
      return;
    }

    // Escape → blur search or let existing handlers close modals
    if (e.key === 'Escape' && document.activeElement === document.getElementById('table-search')) {
      document.getElementById('table-search')?.blur();
      return;
    }

    // Arrow keys for pagination (skip when typing in an input)
    if (!isInput) {
      if (e.key === 'ArrowLeft' && state.page > 1) {
        e.preventDefault();
        state.page--;
        renderTable();
      }
      if (e.key === 'ArrowRight') {
        const pages = Math.ceil(state.tableFiltered.length / state.pageSize);
        if (state.page < pages) {
          e.preventDefault();
          state.page++;
          renderTable();
        }
      }
    }
  });

  document.getElementById('group-import-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        importGroups(ev.target.result);
        applyGroups(state.raw.transactions);
        rebuildGroupFilter();
        renderGroupManager();
        applyTableFilters();
        renderTable();
      } catch (err) {
        alert(t('errorParsing') + err.message);
      }
    };
    reader.readAsText(file, 'utf-8');
  });

  // Group list event delegation
  document.getElementById('group-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const groupId = btn.dataset.groupId;
    const ruleId  = btn.dataset.ruleId;

    const mutatingActions = ['delete-group','add-rule','save-rule','delete-rule','toggle-case','rename-group','change-color'];
    if (mutatingActions.includes(action)) snapshotGroups();

    if (action === 'delete-group') {
      deleteGroup(groupId);
    } else if (action === 'add-rule') {
      if (!state.searchQuery) return;
      const field = btn.closest('.group-card').querySelector('.rule-field').value;
      const op    = btn.closest('.group-card').querySelector('.rule-op').value;
      addRule(groupId, {
        field,
        op,
        value: state.searchQuery,
        caseSensitive: state.searchCaseSensitive,
      });
      // Clear search and apply group filter so the full group result is visible
      state.searchQuery = '';
      state.searchCaseSensitive = false;
      state.searchRegex = false;
      state.groupFilter = new Set([groupId]);
      state.page = 1;
      document.getElementById('table-search').value = '';
      document.getElementById('search-case-btn').classList.remove('active');
      document.getElementById('search-regex-btn').classList.remove('active');
    } else if (action === 'edit-rule') {
      // Replace rule tag with inline edit form — no full re-render
      const tag = btn.closest('.rule-tag');
      const field = btn.dataset.field;
      const op    = btn.dataset.op;
      const value = btn.dataset.value;
      const fieldMap2 = { any: t('groupsFieldAny'), payee: t('groupsFieldPayee'), purpose: t('groupsFieldPurpose') };
      const opMap2    = { contains: t('groupsOpContains'), equals: t('groupsOpEquals'), startsWith: t('groupsOpStartsWith'), endsWith: t('groupsOpEndsWith'), regex: t('groupsOpRegex') };
      tag.innerHTML = `
        <select class="rule-edit-field">
          ${Object.entries(fieldMap2).map(([k,v]) => `<option value="${k}"${k===field?' selected':''}>${v}</option>`).join('')}
        </select>
        <select class="rule-edit-op">
          ${Object.entries(opMap2).map(([k,v]) => `<option value="${k}"${k===op?' selected':''}>${v}</option>`).join('')}
        </select>
        <input class="rule-edit-val" type="text" value="${value.replace(/"/g,'&quot;')}" style="width:12ch">
        <button class="btn btn-primary btn-sm" data-action="save-rule" data-group-id="${groupId}" data-rule-id="${ruleId}">✓</button>
        <button class="btn btn-ghost btn-sm" data-action="cancel-edit-rule" data-group-id="${groupId}" data-rule-id="${ruleId}">✕</button>
      `;
      tag.querySelector('.rule-edit-val').focus();
      return; // skip re-render
    } else if (action === 'save-rule') {
      const tag = btn.closest('.rule-tag');
      const newField = tag.querySelector('.rule-edit-field').value;
      const newOp    = tag.querySelector('.rule-edit-op').value;
      const newValue = tag.querySelector('.rule-edit-val').value.trim();
      if (!newValue) return;
      updateRule(groupId, ruleId, { field: newField, op: newOp, value: newValue });
      markGroupsDirty();
    } else if (action === 'cancel-edit-rule') {
      // Just re-render to restore original tag
    } else if (action === 'delete-rule') {
      deleteRule(groupId, ruleId);
    } else if (action === 'toggle-case') {
      const g = getGroup(groupId);
      const r = g && g.rules.find(r => r.id === ruleId);
      if (r) updateRule(groupId, ruleId, { caseSensitive: !r.caseSensitive });
    } else if (action === 'filter-group') {
      state.groupFilter = new Set([groupId]);
      state.searchQuery = '';
      state.page = 1;
      document.getElementById('table-search').value = '';
      document.getElementById('search-case-btn').classList.remove('active');
      document.getElementById('search-regex-btn').classList.remove('active');
    } else if (action === 'rename-group') {
      const g = getGroup(groupId);
      const name = prompt(t('groupsName'), g.name);
      if (name) { g.name = name.trim(); markGroupsDirty(); } else { _undoStack.pop(); _updateUndoRedoBtns(); return; }
    } else if (action === 'change-color') {
      const g = getGroup(groupId);
      g.color = btn.dataset.color;
      markGroupsDirty();
    }

    if (['delete-group','add-rule','delete-rule','toggle-case','save-rule'].includes(action)) markGroupsDirty();

    applyGroups(state.raw.transactions);
    rebuildGroupFilter();
    renderGroupManager();
    applyTableFilters();
    renderTable();
  });

  // Keyboard shortcuts for inline rule edit form
  document.getElementById('group-list').addEventListener('keydown', e => {
    const input = e.target.closest('.rule-edit-val');
    if (!input) return;
    const tag = input.closest('.rule-tag');
    if (e.key === 'Enter') {
      tag.querySelector('[data-action="save-rule"]').click();
    } else if (e.key === 'Escape') {
      tag.querySelector('[data-action="cancel-edit-rule"]').click();
    }
  });

  // Amount preset filter
  document.getElementById('amount-preset-filter').addEventListener('change', e => {
    state.amountMin = parseFloat(e.target.value) || 0;
    document.getElementById('amount-min-filter').value = state.amountMin || '';
    state.page = 1;
    applyTableFilters();
    renderTable();
  });

  // Amount freetext filter
  document.getElementById('amount-min-filter').addEventListener('input', e => {
    state.amountMin = parseFloat(e.target.value) || 0;
    // Sync preset select to closest match or reset
    const presets = [0, 100, 1000, 3000, 5000, 10000];
    const sel = document.getElementById('amount-preset-filter');
    sel.value = presets.includes(state.amountMin) ? String(state.amountMin) : '0';
    state.page = 1;
    applyTableFilters();
    renderTable();
  });

  // Reset table filters
  document.getElementById('reset-table-filters-btn').addEventListener('click', () => {
    state.searchQuery = '';
    state.searchCaseSensitive = false; state.searchRegex = false;
    state.typeFilter = 'all';
    state.txMonthFilter = new Set();
    state.amountMin = 0;
    state.groupFilter = new Set();
    state.page = 1;

    document.getElementById('table-search').value = '';
    document.getElementById('search-case-btn').classList.remove('active'); document.getElementById('search-regex-btn').classList.remove('active');
    document.getElementById('type-filter').value = 'all';
    document.getElementById('amount-preset-filter').value = '0';
    document.getElementById('amount-min-filter').value = '';

    applyTableFilters();
    renderTable();
    rebuildGroupFilter();
    populateTxMonthFilter();
  });

  // CSV export of filtered table
  document.getElementById('export-csv-btn').addEventListener('click', () => {
    const txs = state.tableFiltered;
    if (!txs.length) return;

    const esc = v => {
      const s = String(v ?? '');
      return s.includes(';') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const rows = [
      ['Buchungstag', 'Beguenstigter/Zahlungspflichtiger', 'Buchungstext', 'Verwendungszweck', 'IBAN', 'Betrag']
    ];
    txs.forEach(tx => {
      const payee = tx.isExpense ? tx.recipient : tx.payer;
      const d = tx.date;
      const dateStr = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
      rows.push([
        dateStr,
        esc(payee),
        esc(tx.type),
        esc(tx.purpose),
        esc(tx.iban),
        tx.amount.toLocaleString('de-DE', { minimumFractionDigits: 2, useGrouping: false }),
      ]);
    });

    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `kontoeinblick_export_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Upload new
  document.getElementById('upload-new-btn').addEventListener('click', () => {
    uploadScreen.style.display = 'flex';
    dashboard.style.display = 'none';
    state.raw = null;
  });
}

// ─── Group manager ────────────────────────────────────────────────────────────
function rebuildGroupFilter() {
  const groups = getGroups();
  const txs    = state.raw ? state.raw.transactions : [];

  // Sync "Ohne Gruppe" checkbox
  const noneChk = document.getElementById('gf-none');
  if (noneChk) noneChk.checked = state.groupFilter.has('__none__');

  // Rebuild per-group checkboxes
  const list = document.getElementById('group-filter-list');
  if (list) {
    list.innerHTML = groups.map(g => {
      const count   = txs.filter(tx => tx.groups && tx.groups.includes(g.id)).length;
      const checked = state.groupFilter.has(g.id) ? 'checked' : '';
      const dot     = `<span class="gf-dot" style="background:${g.color}"></span>`;
      return `<label class="group-filter-option">
        <input type="checkbox" class="gf-group-chk" value="${g.id}" ${checked} />
        ${dot}<span>${g.name}</span><span class="gf-count">${count}</span>
      </label>`;
    }).join('');
  }

  // Update toggle button label
  _updateGroupFilterToggle();

  // Render active chips
  _renderGroupFilterChips(groups);
}

function _updateGroupFilterToggle() {
  const btn = document.getElementById('group-filter-toggle');
  if (!btn) return;
  const size = state.groupFilter.size;
  btn.textContent = size === 0 ? t('groupsFilterAll') : t('groupsFilterActive')(size);
  btn.classList.toggle('has-filter', size > 0);
}

function _renderGroupFilterChips(groups) {
  const bar   = document.getElementById('group-filter-chips-bar');
  const chips = document.getElementById('group-filter-chips');
  if (!chips || !bar) return;
  if (state.groupFilter.size === 0) {
    bar.style.display = 'none';
    chips.innerHTML = '';
    return;
  }
  bar.style.display = '';
  chips.innerHTML = [...state.groupFilter].map(val => {
    if (val === '__none__') {
      return `<span class="gf-chip" data-val="__none__">${t('groupsFilterNone')} <button class="gf-chip-remove" data-val="__none__">×</button></span>`;
    }
    const g = groups.find(g => g.id === val);
    if (!g) return '';
    return `<span class="gf-chip" data-val="${val}" style="border-color:${g.color};background:${g.color}18;color:${g.color}">
      ${g.name} <button class="gf-chip-remove" data-val="${val}" style="color:${g.color}">×</button>
    </span>`;
  }).join('');
}

function renderGroupManager() {
  const groups = getGroups();
  const txs = state.raw ? state.raw.transactions : [];

  document.getElementById('group-list').innerHTML = groups.length === 0
    ? `<div class="group-empty">${t('groupsNoRules')}</div>`
    : groups.map(g => {
        const matchCount = txs.filter(tx => tx.groups && tx.groups.includes(g.id)).length;
        const colorSwatches = GROUP_COLORS.map(c =>
          `<button class="color-swatch${c === g.color ? ' active' : ''}" data-action="change-color" data-group-id="${g.id}" data-color="${c}" style="background:${c}"></button>`
        ).join('');
        const fieldMap = { any: t('groupsFieldAny'), payee: t('groupsFieldPayee'), purpose: t('groupsFieldPurpose') };
        const opMap    = { contains: t('groupsOpContains'), equals: t('groupsOpEquals'), startsWith: t('groupsOpStartsWith'), endsWith: t('groupsOpEndsWith'), regex: t('groupsOpRegex') };
        const rulesHtml = g.rules.length === 0
          ? `<span class="group-no-rules">${t('groupsNoRules')}</span>`
          : g.rules.map(r => {
              let invalidRegex = false;
              if (r.op === 'regex') { try { new RegExp(r.value); } catch { invalidRegex = true; } }
              return `
              <span class="rule-tag${invalidRegex ? ' rule-tag-invalid' : ''}" data-rule-id="${r.id}" data-group-id="${g.id}"${invalidRegex ? ' title="Ungültiger regulärer Ausdruck"' : ''}>
                <span class="rule-tag-field">${fieldMap[r.field] || r.field}</span>
                <span class="rule-tag-op">${opMap[r.op] || r.op}</span>
                <span class="rule-tag-val">"${r.value}"</span>
                <button class="rule-case-btn${r.caseSensitive ? ' active' : ''}" data-action="toggle-case" data-group-id="${g.id}" data-rule-id="${r.id}" title="${r.caseSensitive ? 'Groß-/Kleinschreibung beachten (aktiv)' : 'Groß-/Kleinschreibung ignorieren'}">Aa</button>
                <button class="rule-edit-btn" data-action="edit-rule" data-group-id="${g.id}" data-rule-id="${r.id}" data-field="${r.field}" data-op="${r.op}" data-value="${r.value.replace(/"/g,'&quot;')}" title="Regel bearbeiten">✏️</button>
                <button class="rule-delete-btn" data-action="delete-rule" data-group-id="${g.id}" data-rule-id="${r.id}">${t('groupsDeleteRule')}</button>
              </span>`;
            }).join('');

        return `
          <div class="group-card" data-group-id="${g.id}">
            <div class="group-card-header">
              <span class="group-dot" style="background:${g.color}"></span>
              <span class="group-name" data-action="rename-group" data-group-id="${g.id}" title="Click to rename">${g.name}</span>
              <span class="group-match-count">${t('groupsMatches')(matchCount)}</span>
              <div class="color-swatches">${colorSwatches}</div>
              <button class="group-filter-btn btn btn-ghost btn-sm" data-action="filter-group" data-group-id="${g.id}">🔍</button>
              <button class="group-delete-btn btn btn-ghost btn-sm" data-action="delete-group" data-group-id="${g.id}">${t('groupsDelete')}</button>
            </div>
            <div class="group-rules">${rulesHtml}</div>
            <div class="group-add-rule">
              <select class="rule-field">
                <option value="any">${t('groupsFieldAny')}</option>
                <option value="payee">${t('groupsFieldPayee')}</option>
                <option value="purpose">${t('groupsFieldPurpose')}</option>
              </select>
              <select class="rule-op">
                <option value="contains">${t('groupsOpContains')}</option>
                <option value="equals">${t('groupsOpEquals')}</option>
                <option value="startsWith">${t('groupsOpStartsWith')}</option>
                <option value="endsWith">${t('groupsOpEndsWith')}</option>
                <option value="regex">${t('groupsOpRegex')}</option>
              </select>
              <button class="btn btn-primary btn-sm" data-action="add-rule" data-group-id="${g.id}"
                ${!state.searchQuery ? 'disabled title="Suchbegriff eingeben"' : ''}>
                + ${t('groupsAddRule')}${state.searchQuery ? `: "${state.searchQuery}"` : ''}
              </button>
            </div>
          </div>`;
      }).join('');
  rebuildGroupFilter();
}

function populateMonthSel() {
  const monthSel = document.getElementById('month-sel');
  if (!state.selectedYear) {
    monthSel.innerHTML = `<option value="all">${t('allMonths')}</option>`;
    return;
  }
  const months = [...new Set(
    state.raw.transactions.filter(tx => tx.year === state.selectedYear).map(tx => tx.month)
  )].sort((a, b) => a - b);
  monthSel.innerHTML = `<option value="all">${t('allMonths')}</option>` +
    months.map(m => `<option value="${m}">${t('months')[m]}</option>`).join('');
}

// ─── Populate tx month filter ─────────────────────────────────────────────────
function populateTxMonthFilter() {
  // Available months come from the range-filtered set (before table filters applied)
  const monthKeys = [...new Set(state.filtered.map(tx => tx.monthKey))].sort();

  // Remove any selected months that are no longer in range
  for (const k of state.txMonthFilter) {
    if (!monthKeys.includes(k)) state.txMonthFilter.delete(k);
  }

  // Rebuild checkboxes
  const list = document.getElementById('month-filter-list');
  if (list) {
    list.innerHTML = monthKeys.map(k => {
      const [y, m] = k.split('-');
      const label   = `${t('months')[parseInt(m) - 1]} ${y}`;
      const checked = state.txMonthFilter.has(k) ? 'checked' : '';
      return `<label class="group-filter-option">
        <input type="checkbox" value="${k}" ${checked} />
        <span>${label}</span>
      </label>`;
    }).join('');
  }

  // Update toggle button
  const btn = document.getElementById('month-filter-toggle');
  if (btn) {
    const size = state.txMonthFilter.size;
    btn.textContent = size === 0 ? t('allMonths') : t('monthsFilterActive')(size);
    btn.classList.toggle('has-filter', size > 0);
  }

  // Render chips
  const bar   = document.getElementById('month-filter-chips-bar');
  const chips = document.getElementById('month-filter-chips');
  if (bar && chips) {
    if (state.txMonthFilter.size === 0) {
      bar.style.display = 'none';
      chips.innerHTML = '';
    } else {
      bar.style.display = '';
      chips.innerHTML = [...state.txMonthFilter].sort().map(k => {
        const [y, m] = k.split('-');
        const label = `${t('months')[parseInt(m) - 1]} ${y}`;
        return `<span class="gf-chip">${label} <button class="gf-chip-remove" data-val="${k}">×</button></span>`;
      }).join('');
    }
  }
}

// ─── Render all ───────────────────────────────────────────────────────────────
// ─── Collapse helper ──────────────────────────────────────────────────────
function isCardCollapsed(id) {
  const el = document.getElementById(id);
  if (!el) return false;
  const btn = el.querySelector('.collapse-btn');
  return btn && btn.classList.contains('collapsed');
}

function renderAll() {
  applyStaticTranslations();
  renderKPIs();
  renderMonthlyChart();
  renderBalanceChart();
  renderTopMerchants();
  renderLargestTransactions();
  renderFilterChart();
  renderMonthChart();
  renderTable();
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────
function renderKPIs() {
  const txs = state.filtered;
  const totalIncome = txs.filter(tx => tx.isIncome).reduce((s, tx) => s + tx.amount, 0);
  const totalExpense = txs.filter(tx => tx.isExpense).reduce((s, tx) => s + tx.amount, 0);
  const net = totalIncome + totalExpense;
  const avgMonthlyExpense = calcAvgMonthly(txs, false);
  const avgMonthlyIncome = calcAvgMonthly(txs, true);
  const txCount = txs.length;
  const balance = state.raw.meta.balance || 0;

  setKPI('kpi-income',  fmt(totalIncome),           'income',                          `${t('kpiAvgMonth')}: ${fmt(avgMonthlyIncome)}`);
  setKPI('kpi-expense', fmt(Math.abs(totalExpense)), 'expense',                         `${t('kpiAvgMonth')}: ${fmt(Math.abs(avgMonthlyExpense))}`);
  setKPI('kpi-net',     fmt(net),                   net >= 0 ? 'income' : 'expense',   net >= 0 ? t('kpiPositive') : t('kpiNegative'));
  setKPI('kpi-balance', fmt(balance),               'neutral',                         `${t('kpiAsOf')} ${state.raw.meta.balanceDate || '—'}`);
  setKPI('kpi-txcount', txCount.toString(),         'neutral',                         t('kpiTransactions'));
  const savingsRate = totalIncome > 0 ? (net / totalIncome * 100) : 0;
  setKPI('kpi-savings', savingsRate.toFixed(1) + '%', savingsRate >= 0 ? 'income' : 'expense', t('kpiSavingsRate'));
}

function setKPI(id, value, cls, sub) {
  const el = document.getElementById(id);
  if (!el) return;
  el.querySelector('.kpi-value').textContent = value;
  el.querySelector('.kpi-value').className = 'kpi-value ' + cls;
  el.querySelector('.kpi-sub').textContent = sub;
}

function calcAvgMonthly(txs, income) {
  const months = [...new Set(txs.map(tx => tx.monthKey))];
  if (!months.length) return 0;
  const sum = txs.filter(tx => income ? tx.isIncome : tx.isExpense).reduce((s, tx) => s + tx.amount, 0);
  return sum / months.length;
}

// ─── Monthly bar chart ────────────────────────────────────────────────────────
function renderMonthlyChart() {
  if (isCardCollapsed('pdf-chart-monthly')) return;
  const txs = state.filtered;
  const monthKeys = [...new Set(txs.map(tx => tx.monthKey))].sort();
  const incomeData  = monthKeys.map(k => txs.filter(tx => tx.monthKey === k && tx.isIncome).reduce((s, tx) => s + tx.amount, 0));
  const expenseData = monthKeys.map(k => Math.abs(txs.filter(tx => tx.monthKey === k && tx.isExpense).reduce((s, tx) => s + tx.amount, 0)));
  const labels = monthKeys.map(k => { const [y, m] = k.split('-'); return `${t('months')[parseInt(m)-1]} ${y.slice(2)}`; });

  destroyChart('monthly-chart');
  const ctx = document.getElementById('monthly-chart').getContext('2d');
  state.charts['monthly-chart'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: t('chartIncome'),   data: incomeData,  backgroundColor: '#16a34a', borderRadius: 4, borderSkipped: false },
        { label: t('chartExpenses'), data: expenseData, backgroundColor: '#dc2626', borderRadius: 4, borderSkipped: false },
      ]
    },
    options: chartOpts({ currency: true, stacked: false })
  });
}

// ─── Net balance over time ────────────────────────────────────────────────────
function renderBalanceChart() {
  if (isCardCollapsed('pdf-chart-balance')) return;
  const txs = [...state.filtered].sort((a, b) => a.date - b.date);
  let running = 0;
  const labels = [], data = [];
  txs.forEach(tx => {
    running += tx.amount;
    labels.push(fmtDate(tx.date));
    data.push(parseFloat(running.toFixed(2)));
  });

  destroyChart('balance-chart');
  const ctx = document.getElementById('balance-chart').getContext('2d');
  state.charts['balance-chart'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: t('chartCumulative'),
        data,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37,99,235,.08)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      }]
    },
    options: chartOpts({ currency: true })
  });
}

// ─── Top counterparties ───────────────────────────────────────────────────────
function renderTopMerchants() {
  if (isCardCollapsed('pdf-chart-merchants')) return;
  const txs = state.filtered;

  const map = {};
  txs.forEach(tx => {
    const name = tx.recipient || tx.payer || t('chartUnknown');
    if (!map[name]) map[name] = { income: 0, expense: 0 };
    if (tx.isIncome)  map[name].income  += tx.amount;
    if (tx.isExpense) map[name].expense += Math.abs(tx.amount);
  });

  const top = Object.entries(map)
    .sort((a, b) => (b[1].income + b[1].expense) - (a[1].income + a[1].expense))
    .slice(0, 10);

  const labels   = top.map(e => truncate(e[0], 22));
  const incomes  = top.map(e => e[1].income);
  const expenses = top.map(e => e[1].expense);

  destroyChart('top-merchants');
  const mc = document.getElementById('top-merchants').getContext('2d');
  state.charts['top-merchants'] = new Chart(mc, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: t('chartIncome'),   data: incomes,  backgroundColor: '#16a34a', borderRadius: 4, borderSkipped: false },
        { label: t('chartExpenses'), data: expenses, backgroundColor: '#dc2626', borderRadius: 4, borderSkipped: false },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 12, usePointStyle: true } },
        tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${fmt(c.raw)}` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 }, maxRotation: 35, minRotation: 35 } },
        y: { beginAtZero: true, grid: { color: '#f0f1f6' }, ticks: { font: { size: 11 }, callback: v => fmt(v) } }
      }
    }
  });
}

// ─── Largest transactions list ─────────────────────────────────────────────
function renderLargestTransactions() {
  if (isCardCollapsed('pdf-chart-largest')) return;
  const txs = state.filtered;
  const el = document.getElementById('largest-tx-list');
  if (!el) return;

  const incomes  = txs.filter(tx => tx.isIncome).sort((a, b) => b.amount - a.amount).slice(0, 5);
  const expenses = txs.filter(tx => tx.isExpense).sort((a, b) => a.amount - b.amount).slice(0, 5);

  const fmtAmt = (v, cls) => `<span class="lti-amount ${cls}">${v > 0 ? '+' : ''}${fmt(v)}</span>`;
  const item   = (tx, cls) => {
    const payee = tx.isExpense ? tx.recipient : tx.payer;
    const date  = fmtDate(tx.date);
    return `<div class="largest-tx-item"><span class="lti-payee" title="${(payee || '').replace(/"/g,'&quot;')}">${date} ${payee || '—'}</span>${fmtAmt(tx.amount, cls)}</div>`;
  };

  el.innerHTML = `
    <div class="largest-col">
      <h4 class="income">${t('chartIncome')}</h4>
      ${incomes.length ? incomes.map(t => item(t, 'income')).join('') : `<div class="largest-empty">—</div>`}
    </div>
    <div class="largest-col">
      <h4 class="expense">${t('chartExpenses')}</h4>
      ${expenses.length ? expenses.map(t => item(t, 'expense')).join('') : `<div class="largest-empty">—</div>`}
    </div>`;
}

// ─── Collapsible cards ────────────────────────────────────────────────────
function setupCollapseCards() {
  const KEY = 'kb-collapsed';
  let collapsed;
  try { collapsed = JSON.parse(localStorage.getItem(KEY)) || []; } catch { collapsed = []; }

  document.querySelectorAll('.collapse-btn').forEach(btn => {
    const card = btn.closest('[id]') || btn.closest('.chart-card, .table-card');
    const id = card && card.id;
    if (!id) return;

    function getBody() {
      // chart-card: h3 siblings = body
      if (card.classList.contains('chart-card')) {
        const h3 = card.querySelector('h3');
        if (!h3) return [];
        const els = [];
        let sib = h3.nextElementSibling;
        while (sib) { els.push(sib); sib = sib.nextElementSibling; }
        return els;
      }
      // table-card: .table-header siblings = body
      if (card.classList.contains('table-card')) {
        const header = card.querySelector('.table-header');
        if (!header) return [];
        const els = [];
        let sib = header.nextElementSibling;
        while (sib) { els.push(sib); sib = sib.nextElementSibling; }
        return els;
      }
      return [];
    }

    if (collapsed.includes(id)) {
      btn.classList.add('collapsed');
      getBody().forEach(el => el.style.display = 'none');
    }

    btn.addEventListener('click', () => {
      btn.classList.toggle('collapsed');
      const hidden = btn.classList.contains('collapsed');
      getBody().forEach(el => el.style.display = hidden ? 'none' : '');

      if (hidden) {
        if (!collapsed.includes(id)) collapsed.push(id);
      } else {
        collapsed = collapsed.filter(c => c !== id);
      }
      localStorage.setItem(KEY, JSON.stringify(collapsed));
    });
  });
}

// ─── Merge CSV files ─────────────────────────────────────────────────────
function setupMergeCard() {
  const input      = document.getElementById('merge-file-input');
  const dropZone   = document.getElementById('merge-drop-zone');
  const fileList   = document.getElementById('merge-file-list');
  const status     = document.getElementById('merge-status');
  const actions    = document.getElementById('merge-actions');
  const downloadBtn = document.getElementById('merge-download-btn');
  const useBtn     = document.getElementById('merge-use-btn');
  const resetBtn   = document.getElementById('merge-reset-btn');

  const entries = []; // { name, raw, result, rawLines, headerLen }

  function renderFileList() {
    fileList.innerHTML = entries.map(e => {
      const cls = e._error ? 'merge-file-err' : 'merge-file-ok';
      return `<div class="merge-file-item"><span class="${cls}">${e._error ? '✗' : '✓'}</span> ${e.name}</div>`;
    }).join('');
  }

  function updateActions() {
    const valid = entries.filter(e => !e._error);
    if (valid.length < 2) { actions.style.display = 'none'; status.textContent = ''; return; }

    const banks = [...new Set(valid.map(e => e.result.meta.bank))];
    if (banks.length !== 1) {
      status.textContent = t('mergeErrDifferentBanks');
      status.className = 'merge-status merge-status-err';
      actions.style.display = 'none';
      return;
    }

    // Check all formats match (same bank parser was used)
    const bankName = valid[0].result.meta.bankName;
    status.textContent = t('mergeStatusBank').replace('%s', bankName);
    status.className = 'merge-status merge-status-ok';
    actions.style.display = 'flex';
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const readerUtf8 = new FileReader();
      readerUtf8.onload = e => {
        const text = e.target.result;
        if (text.slice(0, 500).includes('\uFFFD')) {
          const readerLatin = new FileReader();
          readerLatin.onload = e2 => resolve(e2.target.result);
          readerLatin.onerror = reject;
          readerLatin.readAsText(file, 'iso-8859-1');
        } else {
          resolve(text);
        }
      };
      readerUtf8.onerror = reject;
      readerUtf8.readAsText(file, 'utf-8');
    });
  }

  async function handleFiles(files) {
    entries.length = 0;
    fileList.innerHTML = '';
    status.textContent = '';
    status.className = 'merge-status';
    actions.style.display = 'none';

    for (const file of files) {
      const entry = { name: file.name, _error: false };
      entries.push(entry);

      try {
        const raw = await readFile(file);
        entry.raw = raw;
        const rawLines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        entry.rawLines = rawLines;

        const result = parseCsv(raw);
        entry.result = result;

        // Find where the header row ends in the raw lines
        const headerIdx = findHeaderLineIndex(rawLines, result.meta.bank);
        if (headerIdx >= 0) {
          entry.headerLen = headerIdx + 1; // lines 0..headerIdx are header
        } else {
          entry.headerLen = 0;
        }
      } catch (err) {
        entry._error = true;
        entry._errMsg = err.message;
      }

      renderFileList();
      updateActions();
    }

    // Update status with tx count
    const valid = entries.filter(e => !e._error);
    if (valid.length >= 2) {
      const banks = [...new Set(valid.map(e => e.result.meta.bank))];
      if (banks.length === 1) {
        const total = valid.reduce((s, e) => s + e.result.transactions.length, 0);
        // Compute unique across all entries to show counts
        const seen = new Set();
        let unique = 0;
        for (const e of valid) {
          for (const tx of e.result.transactions) {
            const key = dedupKey(tx);
            if (!seen.has(key)) { seen.add(key); unique++; }
          }
        }
        const dups = total - unique;
        const msg = t('mergeStatusTxCount')
          .replace('%d', total)
          .replace('%d', unique)
          .replace('%d', dups);
        status.textContent += ' — ' + msg;
      }
    }
  }

  input.addEventListener('change', () => {
    if (input.files.length) handleFiles(input.files);
  });

  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = 'var(--accent)'; });
  dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = ''; });
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.style.borderColor = '';
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  });

  // Merge + download
  downloadBtn.addEventListener('click', () => {
    const merged = performMerge();
    if (!merged) return;
    downloadCsv(merged.content, merged.filename);
  });

  // Merge + use in dashboard
  useBtn.addEventListener('click', () => {
    const merged = performMerge();
    if (!merged) return;
    _applyParsedResult(merged.result);
  });

  resetBtn.addEventListener('click', () => {
    entries.length = 0;
    fileList.innerHTML = '';
    status.textContent = '';
    status.className = 'merge-status';
    actions.style.display = 'none';
    input.value = '';
  });

  function performMerge() {
    const valid = entries.filter(e => !e._error);
    if (valid.length < 2) { alert(t('mergeErrIncompatible')); return null; }

    const banks = [...new Set(valid.map(e => e.result.meta.bank))];
    if (banks.length !== 1) { alert(t('mergeErrDifferentBanks')); return null; }

    // Gather all transactions with their dedup key
    const allTx = [];
    for (const e of valid) {
      for (const tx of e.result.transactions) {
        allTx.push({ tx, key: dedupKey(tx) });
      }
    }

    // Deduplicate (keep first occurrence)
    const seen = new Set();
    const unique = [];
    for (const item of allTx) {
      if (!seen.has(item.key)) {
        seen.add(item.key);
        unique.push(item.tx);
      }
    }

    // Sort by date ascending
    unique.sort((a, b) => a.date - b.date);

    if (unique.length === 0) {
      alert(t('mergeStatusEmpty'));
      return null;
    }

    // Build merged meta from first file
    const first = valid[0];
    const meta = { ...first.result.meta, period: 'Merged' };

    const mergedResult = { meta, transactions: unique };

    // Build merged CSV content by combining raw text data rows
    let csvContent = '';

    // Use first file's header section
    const firstHeaderEnd = first.headerLen;
    const firstLines = first.rawLines.slice(0, firstHeaderEnd);
    csvContent = firstLines.join('\n') + '\n';

    // For each data row in each file, check if its parsed tx is in the unique set
    // We need to map lines back to their dedup keys
    const uniqueKeys = new Set(unique.map(tx => dedupKey(tx)));

    // Collect data rows from each file, pairing with their dedup key
    const dataRows = []; // { line, key }
    for (const e of valid) {
      const lines = e.rawLines;
      const start = e.headerLen;
      // Parse each data row to get its dedup key
      const eTxs = e.result.transactions;
      let txIdx = 0;
      for (let i = start; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (txIdx < eTxs.length) {
          dataRows.push({ line, key: dedupKey(eTxs[txIdx]) });
          txIdx++;
        }
      }
    }

    // Sort data rows by their transaction date
    const txByKey = {};
    for (const tx of unique) {
      txByKey[dedupKey(tx)] = tx;
    }

    // Filter to unique and sort by date
    const seenLines = new Set();
    const sortedLines = [];
    // Sort unique transactions first, then find their matching lines
    unique.forEach(tx => {
      const key = dedupKey(tx);
      if (seenLines.has(key)) return;
      seenLines.add(key);
      const match = dataRows.find(r => r.key === key);
      if (match) sortedLines.push(match.line);
    });

    csvContent += sortedLines.join('\n') + '\n';

    return {
      content: csvContent,
      filename: `merged_${meta.bank}_${new Date().toISOString().slice(0, 10)}.csv`,
      result: mergedResult,
    };
  }

  function downloadCsv(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// ─── Filter chart (amount per day) ───────────────────────────────────────────
function isFiltered() {
  return state.searchQuery !== '' ||
    state.typeFilter !== 'all' ||
    state.txMonthFilter.size > 0 ||
    state.amountMin > 0 ||
    state.groupFilter.size > 0;
}

function renderFilterChart() {
  if (isCardCollapsed('tx-filter-chart-card')) return;
  const hint  = document.getElementById('tx-filter-chart-hint');
  const wrap  = document.getElementById('tx-filter-chart-wrap');

  if (!isFiltered()) {
    hint.style.display = '';
    wrap.style.display = 'none';
    destroyChart('tx-filter-chart');
    return;
  }

  hint.style.display = 'none';
  wrap.style.display = '';

  const txs = state.tableFiltered;

  // Aggregate by day
  const incomeMap = {}, expenseMap = {};
  txs.forEach(tx => {
    const key = toInputDate(tx.date);
    if (tx.isIncome)  incomeMap[key]  = (incomeMap[key]  || 0) + tx.amount;
    if (tx.isExpense) expenseMap[key] = (expenseMap[key] || 0) + Math.abs(tx.amount);
  });

  const days = [...new Set(txs.map(tx => toInputDate(tx.date)))].sort();
  const incomeData  = days.map(d => incomeMap[d]  || 0);
  const expenseData = days.map(d => expenseMap[d] || 0);

  destroyChart('tx-filter-chart');
  const ctx = document.getElementById('tx-filter-chart').getContext('2d');
  state.charts['tx-filter-chart'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [
        { label: t('filterChartIncome'),   data: incomeData,  backgroundColor: '#16a34a', borderRadius: 3, borderSkipped: false },
        { label: t('filterChartExpenses'), data: expenseData, backgroundColor: '#dc2626', borderRadius: 3, borderSkipped: false },
      ]
    },
    options: chartOpts({ currency: true, stacked: false })
  });
}

// ─── Month chart (all filtered transactions grouped by month) ─────────────────
function renderMonthChart() {
  if (isCardCollapsed('tx-month-chart-card')) return;
  const stacked = state.monthChartMode === 'stacked';
  const txs = state.tableFiltered;

  // Collect all months present
  const monthSet = new Set();
  txs.forEach(tx => {
    monthSet.add(`${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, '0')}`);
  });
  const months = [...monthSet].sort();

  let datasets;

  if (!stacked) {
    // ── Simple bar: income vs expenses ──────────────────────────────────────
    const incomeMap = {}, expenseMap = {};
    txs.forEach(tx => {
      const key = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, '0')}`;
      if (tx.isIncome)  incomeMap[key]  = (incomeMap[key]  || 0) + tx.amount;
      if (tx.isExpense) expenseMap[key] = (expenseMap[key] || 0) + Math.abs(tx.amount);
    });
    datasets = [
      { label: t('monthChartIncome'),   data: months.map(m => incomeMap[m]  || 0), backgroundColor: '#16a34a', borderRadius: 3, borderSkipped: false },
      { label: t('monthChartExpenses'), data: months.map(m => expenseMap[m] || 0), backgroundColor: '#dc2626', borderRadius: 3, borderSkipped: false },
    ];
  } else {
    // ── Stacked: bucket expenses by rule value within matched groups ─────────

    const expenseTxs = txs.filter(tx => tx.isExpense);
    const activeGroup = (state.groupFilter.size === 1 && !state.groupFilter.has('__none__'))
      ? getGroups().find(g => g.id === [...state.groupFilter][0]) : null;

    // bucketMap: label → { monthKey → total }
    // colorMap:  label → color string
    const bucketMap = {};
    const colorMap  = {};

    function hexToHsl(hex) {
      const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
      const max = Math.max(r,g,b), min = Math.min(r,g,b); let h = 0, s = 0; const l = (max+min)/2;
      if (max !== min) {
        const d = max - min; s = l > 0.5 ? d/(2-max-min) : d/(max+min);
        switch(max){ case r: h=((g-b)/d+(g<b?6:0))/6; break; case g: h=((b-r)/d+2)/6; break; default: h=((r-g)/d+4)/6; }
      }
      return [h*360, s*100, l*100];
    }

    if (activeGroup) {
      // One stack per rule in the active group; color = spread of hues around group color
      const [baseH, baseS] = hexToHsl(activeGroup.color);
      const rules = activeGroup.rules;
      rules.forEach((r, i) => {
        const hue = (baseH + i * (360 / Math.max(rules.length, 1))) % 360;
        colorMap[r.value] = `hsl(${hue.toFixed(0)},${Math.max(60, Math.round(baseS))}%,${42 + (i % 3) * 10}%)`;
        bucketMap[r.value] = {};
      });

      expenseTxs.forEach(tx => {
        const key = `${tx.date.getFullYear()}-${String(tx.date.getMonth()+1).padStart(2,'0')}`;
        // Find the first matching rule in this group for the tx
        const matchedRule = activeGroup.rules.find(r => {
          const fields = r.field === 'any'
            ? [tx.recipient, tx.payer, tx.purpose]
            : r.field === 'payee' ? [tx.recipient, tx.payer] : [tx.purpose];
          return fields.some(f => {
            if (!f) return false;
            const hay = r.caseSensitive ? f : f.toLowerCase();
            const needle = r.caseSensitive ? r.value : r.value.toLowerCase();
            switch(r.op) {
              case 'contains':   return hay.includes(needle);
              case 'equals':     return hay === needle;
              case 'startsWith': return hay.startsWith(needle);
              case 'endsWith':   return hay.endsWith(needle);
              default:           return false;
            }
          });
        });
        if (matchedRule) {
          bucketMap[matchedRule.value][key] = (bucketMap[matchedRule.value][key] || 0) + Math.abs(tx.amount);
        }
      });
    } else {
      // No group filter: one stack per group, colored by group color
      const groups = getGroups();
      groups.forEach(g => {
        bucketMap[g.name] = {};
        colorMap[g.name]  = g.color;
      });
      // ungrouped bucket
      bucketMap[t('monthChartUngrouped')] = {};
      colorMap[t('monthChartUngrouped')]  = '#94a3b8';

      expenseTxs.forEach(tx => {
        const key = `${tx.date.getFullYear()}-${String(tx.date.getMonth()+1).padStart(2,'0')}`;
        const txGroups = tx.groups || [];
        if (txGroups.length === 0) {
          bucketMap[t('monthChartUngrouped')][key] = (bucketMap[t('monthChartUngrouped')][key] || 0) + Math.abs(tx.amount);
        } else {
          txGroups.forEach(gid => {
            const g = getGroups().find(g => g.id === gid);
            if (g && bucketMap[g.name] !== undefined) {
              bucketMap[g.name][key] = (bucketMap[g.name][key] || 0) + Math.abs(tx.amount);
            }
          });
        }
      });
    }

    // Sort buckets by total descending (biggest at bottom of stack)
    const labels = Object.keys(bucketMap).sort((a, b) => {
      const sumA = Object.values(bucketMap[a]).reduce((s,v) => s+v, 0);
      const sumB = Object.values(bucketMap[b]).reduce((s,v) => s+v, 0);
      return sumB - sumA;
    }).filter(label => Object.values(bucketMap[label]).some(v => v > 0));

    datasets = labels.map((label, i) => ({
      label,
      data: months.map(m => bucketMap[label][m] || 0),
      backgroundColor: colorMap[label] || GROUP_COLORS[i % GROUP_COLORS.length],
      borderRadius: 2,
      borderSkipped: false,
    }));

    if (datasets.length === 0) {
      datasets = [{ label: t('monthChartExpenses'), data: months.map(() => 0), backgroundColor: '#dc2626', borderRadius: 2, borderSkipped: false }];
    }
  }

  // Build a ruleLabel map: dataset label → tooltip subtitle (rule description)
  // Only meaningful in stacked+activeGroup mode; otherwise undefined → plain label shown
  const ruleLabelMap = {};
  if (stacked) {
    const activeGroup = (state.groupFilter.size === 1 && !state.groupFilter.has('__none__'))
      ? getGroups().find(g => g.id === [...state.groupFilter][0]) : null;
    if (activeGroup) {
      const fieldMap = { any: t('groupsFieldAny'), payee: t('groupsFieldPayee'), purpose: t('groupsFieldPurpose') };
      const opMap    = { contains: t('groupsOpContains'), equals: t('groupsOpEquals'), startsWith: t('groupsOpStartsWith'), endsWith: t('groupsOpEndsWith') };
      activeGroup.rules.forEach(r => {
        ruleLabelMap[r.value] = `${fieldMap[r.field] || r.field} ${opMap[r.op] || r.op} "${r.value}"`;
      });
    }
  }

  const baseOpts = chartOpts({ currency: true, stacked });
  if (stacked && Object.keys(ruleLabelMap).length > 0) {
    baseOpts.plugins.tooltip.callbacks = {
      label: c => {
        const ruleDesc = ruleLabelMap[c.dataset.label];
        const amount = ` ${fmt(c.raw)}`;
        return ruleDesc ? [`${amount}`, `  ${ruleDesc}`] : amount;
      }
    };
  }

  destroyChart('tx-month-chart');
  const ctx = document.getElementById('tx-month-chart').getContext('2d');
  state.charts['tx-month-chart'] = new Chart(ctx, {
    type: 'bar',
    data: { labels: months, datasets },
    options: baseOpts,
  });
}

// Toggle buttons for month chart mode
document.addEventListener('click', e => {
  const btn = e.target.closest('.chart-mode-btn');
  if (!btn || !document.getElementById('tx-month-chart-card').contains(btn)) return;
  const mode = btn.dataset.mode;
  if (state.monthChartMode === mode) return;
  state.monthChartMode = mode;
  document.querySelectorAll('#tx-month-chart-card .chart-mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  renderMonthChart();
});

// ─── Transaction table ────────────────────────────────────────────────────────
function renderTable() {
  if (isCardCollapsed('tx-table-card')) return;
  const txs = state.tableFiltered;
  const total = txs.length;
  const pages = Math.ceil(total / state.pageSize);
  const start = (state.page - 1) * state.pageSize;
  const slice = txs.slice(start, start + state.pageSize);

  const tbody = document.getElementById('tx-tbody');
  tbody.innerHTML = slice.map((tx, i) => {
    const payee   = tx.isExpense ? tx.recipient : tx.payer;
    const purpose = tx.purpose;
    const payeeEsc   = payee   ? payee.replace(/"/g, '&quot;')   : '';
    const purposeEsc = purpose ? purpose.replace(/"/g, '&quot;') : '';
    const actions = [
      payeeEsc   ? `<button class="qs-btn" data-search="${payeeEsc}"   title="${payeeEsc}">${truncate(payeeEsc, 18)}</button>`   : '',
      purposeEsc ? `<button class="qs-btn" data-search="${purposeEsc}" title="${purposeEsc}">${truncate(purposeEsc, 18)}</button>` : '',
    ].filter(Boolean).join('');
    const groupTags = (tx.groups || []).map(gid => {
      const g = getGroup(gid);
      return g ? `<span class="group-tag" style="background:${g.color}20;color:${g.color};border-color:${g.color}40">${g.name}</span>` : '';
    }).join('');
    return `
    <tr data-payee="${payeeEsc}" data-purpose="${purposeEsc}" data-tx-idx="${start + i}">
      <td style="white-space:nowrap">${fmtDate(tx.date)}</td>
      <td>${truncate(payee, 30)}</td>
      <td style="max-width:250px;color:var(--text-muted);font-size:.78rem">${truncate(purpose, 40)}</td>
      <td><span class="badge ${tx.isIncome ? 'badge-income' : 'badge-expense'}">${tx.type}</span></td>
      <td class="${tx.isIncome ? 'amount-positive' : 'amount-negative'}" style="text-align:right;white-space:nowrap">${tx.isIncome ? '+' : ''}${fmt(tx.amount)}</td>
      <td class="qs-cell">${groupTags}${actions}<button class="row-group-btn" title="${t('groupsAddToGroup')}">＋</button><span class="row-select-hint">${t('tableSelectHint')}</span></td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" class="empty-state"><div class="empty-icon">🔍</div>${t('tableEmpty')}</td></tr>`;

  // Quick-search click delegation
  tbody.querySelectorAll('.qs-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const q = btn.dataset.search;
      state.searchQuery = q;
      state.searchCaseSensitive = false; state.searchRegex = false;
      state.page = 1;
      document.getElementById('table-search').value = q;
      document.getElementById('search-case-btn').classList.remove('active'); document.getElementById('search-regex-btn').classList.remove('active');
      applyTableFilters();
      renderTable();
      document.getElementById('table-search').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });

  // Summary footer
  const totalIncome  = txs.filter(tx => tx.isIncome).reduce((s, tx) => s + tx.amount, 0);
  const totalExpense = txs.filter(tx => tx.isExpense).reduce((s, tx) => s + tx.amount, 0);
  const net = totalIncome + totalExpense;
  const txWord = txs.length === 1 ? t('tableTransaction') : t('tableTransactions');
  const tfoot = document.getElementById('tx-tfoot');
  tfoot.innerHTML = `
    <tr style="background:var(--surface2);font-size:.8rem;border-top:2px solid var(--border)">
      <td colspan="3" style="padding:.6rem 1rem;color:var(--text-muted);font-weight:600">
        ${txs.length} ${txWord} (${t('tableFiltered')})
      </td>
      <td style="padding:.6rem 1rem;text-align:right;white-space:nowrap">
        <span style="color:var(--income);font-weight:700">+${fmt(totalIncome)}</span>
        &nbsp;/&nbsp;
        <span style="color:var(--expense);font-weight:700">${fmt(totalExpense)}</span>
      </td>
      <td style="padding:.6rem 1rem;text-align:right;white-space:nowrap;font-weight:700" class="${net >= 0 ? 'amount-positive' : 'amount-negative'}">
        ${net >= 0 ? '+' : ''}${fmt(net)}
      </td>
      <td></td>
    </tr>
  `;

  document.getElementById('tx-count').textContent =
    `${t('tableShowing')} ${Math.min(start+1,total)}–${Math.min(start+state.pageSize,total)} ${t('tableOf')} ${total}`;
  document.getElementById('tx-count-top').textContent =
    `${t('tableShowing')} ${Math.min(start+1,total)}–${Math.min(start+state.pageSize,total)} ${t('tableOf')} ${total}`;
  renderPagination(pages);

  // Sort indicators
  document.querySelectorAll('#tx-table th').forEach(th => {
    th.classList.toggle('sorted', th.dataset.col === state.sortCol);
    const icon = th.querySelector('.sort-icon');
    if (icon) icon.textContent = th.dataset.col === state.sortCol ? (state.sortDir === 'asc' ? '↑' : '↓') : '↕';
  });

  renderFilterChart();
  renderMonthChart();
}

function renderPagination(pages) {
  const p = state.page;
  let btns = [];

  const addBtn = (label, page, active = false, disabled = false) => {
    btns.push(`<button class="page-btn${active?' active':''}" ${disabled?'disabled':''} data-page="${page}">${label}</button>`);
  };

  addBtn('‹', p - 1, false, p === 1);
  if (pages <= 7) {
    for (let i = 1; i <= pages; i++) addBtn(i, i, i === p);
  } else {
    addBtn(1, 1, p === 1);
    if (p > 3) btns.push('<span style="padding:.3rem .4rem;color:var(--text-muted)">…</span>');
    for (let i = Math.max(2, p-1); i <= Math.min(pages-1, p+1); i++) addBtn(i, i, i === p);
    if (p < pages - 2) btns.push('<span style="padding:.3rem .4rem;color:var(--text-muted)">…</span>');
    addBtn(pages, pages, p === pages);
  }
  addBtn('›', p + 1, false, p === pages);

  const html = btns.join('');
  ['pagination', 'pagination-top'].forEach(id => {
    const el = document.getElementById(id);
    el.innerHTML = html;
    el.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pg = parseInt(btn.dataset.page);
        if (!isNaN(pg) && pg >= 1 && pg <= pages) { state.page = pg; renderTable(); }
      });
    });
  });
}

// Table sort
document.addEventListener('click', e => {
  const th = e.target.closest('#tx-table th[data-col]');
  if (!th) return;
  const col = th.dataset.col;
  if (state.sortCol === col) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
  else { state.sortCol = col; state.sortDir = 'desc'; }
  state.page = 1;
  applyTableFilters();
  renderTable();
});

// ─── Chart helpers ────────────────────────────────────────────────────────────
function destroyChart(id) {
  if (state.charts[id]) { state.charts[id].destroy(); delete state.charts[id]; }
}

function chartOpts({ currency = false, stacked = false } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 12, usePointStyle: true } },
      tooltip: {
        callbacks: { label: c => ` ${currency ? fmt(c.raw) : c.raw}` }
      }
    },
    scales: {
      x: { stacked, grid: { display: false }, ticks: { font: { size: 11 } } },
      y: { stacked, grid: { color: '#f0f1f6' }, ticks: { font: { size: 11 }, callback: v => currency ? fmt(v) : v } }
    }
  };
}

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmt(n) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

function fmtDate(d) {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function updateRangePillTitles() {
  const now = new Date();
  const lang = localStorage.getItem('dkb-lang') || 'de';
  const loc = lang === 'de' ? 'de-DE' : 'en-GB';
  const fmt = d => d.toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const range = (from, to) => fmt(from) + ' – ' + fmt(to);

  const allLabel = () => {
    if (!state.raw || !state.raw.transactions.length) return '';
    const dates = state.raw.transactions.map(tx => tx.date).filter(Boolean).sort((a, b) => a - b);
    return dates.length ? range(dates[0], dates[dates.length - 1]) : '';
  };

  const cur = () => range(new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const prev = () => {
    const pm = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const py = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return range(new Date(py, pm, 1), new Date(py, pm + 1, 0));
  };
  const curyr = () => range(new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear(), 11, 31));
  const prevyr = () => range(new Date(now.getFullYear() - 1, 0, 1), new Date(now.getFullYear() - 1, 11, 31));
  const rel = n => range(new Date(now.getFullYear(), now.getMonth() - n + 1, 1), new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const labels = { all: allLabel, cur, prev, curyr, prevyr, '3m': () => rel(3), '6m': () => rel(6), '12m': () => rel(12) };

  document.querySelectorAll('.range-pill').forEach(btn => {
    const fn = labels[btn.dataset.range];
    btn.title = fn ? fn() : '';
  });
}

function toInputDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function truncate(str, len) {
  if (!str) return '—';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

// ─── Row group context menu ────────────────────────────────────────────────────
(function initGroupContextMenu() {
  const menu   = document.getElementById('group-ctx-menu');
  const valEl  = document.getElementById('group-ctx-value');
  const listEl = document.getElementById('group-ctx-list');
  const newBtn = document.getElementById('group-ctx-new');

  let currentValue = '';
  let currentField = 'any';  // 'payee' | 'purpose' | 'any'
  let newRowEl = null;

  function positionMenu(x, y) {
    menu.style.display = 'block';
    const mw = menu.offsetWidth  || 240;
    const mh = menu.offsetHeight || 200;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    menu.style.left = Math.min(x, vw - mw - 10) + 'px';
    menu.style.top  = Math.min(y, vh - mh - 10) + 'px';
  }

  function closeMenu() {
    menu.style.display = 'none';
    newRowEl = null;
  }

  function addValueToGroup(groupId) {
    snapshotGroups();
    addRule(groupId, { field: currentField, op: 'contains', value: currentValue, caseSensitive: false });
    applyGroups(state.raw.transactions);
    applyTableFilters();
    renderTable();
    renderGroupManager();
    rebuildGroupFilter();
    markGroupsDirty();
    closeMenu();
  }

  function buildMenu(value, field, x, y) {
    currentValue = value.trim();
    currentField = field;
    // Remove any lingering new-group input row
    if (newRowEl && newRowEl.parentNode) newRowEl.parentNode.removeChild(newRowEl);
    newRowEl = null;

    // Header: show value
    valEl.innerHTML = `<strong>${value}</strong>`;

    // Group list
    const groups = getGroups();
    listEl.innerHTML = '';
    if (groups.length === 0) {
      listEl.innerHTML = `<div style="padding:.3rem .9rem;color:var(--text-muted);font-size:.8rem">${t('groupsNoRules')}</div>`;
    } else {
      groups.forEach(g => {
        // check if value already covered by a rule in this group
        const alreadyIn = (g.rules || []).some(r => {
          const fieldMatch = r.field === 'any' || field === 'any' || r.field === field;
          return fieldMatch && r.op === 'contains' &&
            r.value.trim().toLowerCase() === value.trim().toLowerCase();
        });
        const btn = document.createElement('button');
        btn.className = 'group-ctx-item';
        btn.innerHTML = `
          <span class="ctx-dot" style="background:${g.color}"></span>
          <span>${g.name}</span>
          ${alreadyIn ? '<span class="ctx-check">✓</span>' : ''}
        `;
        if (!alreadyIn) btn.addEventListener('click', () => addValueToGroup(g.id));
        else btn.style.opacity = '.55';
        listEl.appendChild(btn);
      });
    }

    // Separator + new group button
    const sep = document.createElement('hr');
    sep.className = 'group-ctx-separator';
    listEl.appendChild(sep);

    positionMenu(x, y);
  }

  // "New group" button expands an inline input
  newBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (newRowEl) { newRowEl.querySelector('input').focus(); return; }
    newRowEl = document.createElement('div');
    newRowEl.className = 'group-ctx-new-row';
    newRowEl.innerHTML = `
      <input type="text" placeholder="${t('groupsCtxNewName')}" maxlength="40" />
      <button class="btn btn-primary">OK</button>
    `;
    menu.insertBefore(newRowEl, newBtn);
    const inp = newRowEl.querySelector('input');
    const ok  = newRowEl.querySelector('button');
    // Live hint: show if a group with this name already exists
    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:.72rem;color:var(--accent);padding:.1rem .6rem .3rem;display:none';
    newRowEl.appendChild(hint);
    inp.addEventListener('input', () => {
      const match = getGroups().find(g => g.name.toLowerCase() === inp.value.trim().toLowerCase());
      hint.textContent = match ? `→ fügt zu "${match.name}" hinzu` : '';
      hint.style.display = match ? 'block' : 'none';
    });
    inp.focus();
    let confirmed = false;
    const confirm = () => {
      if (confirmed) return;
      const name = inp.value.trim();
      if (!name) return;
      confirmed = true;
      // Reuse existing group with same name (case-insensitive) instead of creating a duplicate
      const existing = getGroups().find(g => g.name.toLowerCase() === name.toLowerCase());
      const g = existing || createGroup(name);
      addValueToGroup(g.id);
      renderGroupManager();
    };
    ok.addEventListener('click', confirm);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') closeMenu(); });
    // reposition in case menu grew
    const rect = menu.getBoundingClientRect();
    positionMenu(rect.left, rect.top);
  });

  // Close on outside click / scroll
  document.addEventListener('click', e => {
    if (!menu.contains(e.target)) closeMenu();
  }, true);
  document.addEventListener('scroll', closeMenu, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  // ── Open on ＋ button click ──────────────────────────────────────────────
  document.getElementById('tx-tbody').addEventListener('click', e => {
    const btn = e.target.closest('.row-group-btn');
    if (!btn) return;
    e.stopPropagation();
    const tr = btn.closest('tr');
    const payee   = tr.dataset.payee   || '';
    const purpose = tr.dataset.purpose || '';
    // Show payee/purpose choice if both exist, otherwise use whichever exists
    const value = payee || purpose;
    const field = payee ? 'payee' : 'purpose';
    if (!value) return;

    const rect = btn.getBoundingClientRect();
    buildMenu(value, field, rect.right + 6, rect.top);

    // If row has both payee and purpose, offer field toggle chips above list
    if (payee && purpose) {
      const chips = document.createElement('div');
      chips.style.cssText = 'display:flex;gap:.3rem;padding:.2rem .6rem .4rem;flex-wrap:wrap;';
      [['payee', payee, t('groupsFieldPayee')], ['purpose', purpose, t('groupsFieldPurpose')]].forEach(([f, v, label]) => {
        const c = document.createElement('button');
        c.style.cssText = `font-size:.72rem;padding:.15rem .5rem;border-radius:20px;cursor:pointer;
          border:1px solid var(--border);background:${currentField===f?'var(--accent)':'var(--surface2)'};
          color:${currentField===f?'#fff':'var(--text)'};white-space:nowrap;`;
        c.textContent = `${label}: ${v.length > 20 ? v.slice(0,20)+'…' : v}`;
        c.addEventListener('click', e => {
          e.stopPropagation();
          buildMenu(v, f, rect.right + 6, rect.top);
          if (payee && purpose) chips.querySelectorAll('button').forEach((b,i) => {
            b.style.background = (['payee','purpose'][i] === f) ? 'var(--accent)' : 'var(--surface2)';
            b.style.color = (['payee','purpose'][i] === f) ? '#fff' : 'var(--text)';
          });
        });
        chips.appendChild(c);
      });
      listEl.insertBefore(chips, listEl.firstChild);
    }
  });

  // ── Open on text selection within a table row ────────────────────────────
  let selBtn = null;

  function removeSelBtn() {
    if (selBtn) { selBtn.remove(); selBtn = null; }
  }

  document.addEventListener('selectionchange', () => {
    removeSelBtn();
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString().trim();
    if (text.length < 2) return;

    // Only activate inside the tx table
    const anchor = sel.anchorNode;
    const tbody = document.getElementById('tx-tbody');
    if (!tbody || !tbody.contains(anchor)) return;

    const tr = anchor.parentElement?.closest('tr');
    if (!tr) return;

    const range = sel.getRangeAt(0);
    const rRect = range.getBoundingClientRect();
    if (!rRect.width) return;

    // Determine field from which cell the selection is in
    const td = anchor.parentElement?.closest('td');
    const tds = tr ? [...tr.querySelectorAll('td')] : [];
    const tdIdx = td ? tds.indexOf(td) : -1;
    // col 1 = payee, col 2 = purpose, others = 'any'
    const field = tdIdx === 1 ? 'payee' : tdIdx === 2 ? 'purpose' : 'any';

    selBtn = document.createElement('button');
    selBtn.className = 'sel-add-btn';
    selBtn.textContent = `＋ ${t('groupsAddToGroup')}`;
    selBtn.style.left = `${rRect.left + rRect.width / 2 - 60}px`;
    selBtn.style.top  = `${rRect.top - 36}px`;
    document.body.appendChild(selBtn);

    selBtn.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      removeSelBtn();
      buildMenu(text, field, rRect.left, rRect.top + 4);
    });
  });

  document.addEventListener('mousedown', e => {
    if (selBtn && !selBtn.contains(e.target)) removeSelBtn();
  });
})();

// ─── Transaction detail popover ───────────────────────────────────────────────
(function initTxDetailPopover() {
  const popover = document.getElementById('tx-detail-popover');
  const inner   = document.getElementById('tx-detail-inner');

  function hide() { popover.style.display = 'none'; }

  function show(tx, anchorEl) {
    const payee  = tx.isExpense ? tx.recipient : tx.payer;
    const isIncome = tx.isIncome;

    const row = (label, val) => val
      ? `<div class="tx-detail-label">${label}</div><div class="tx-detail-val">${val}</div>`
      : '';

    const groupTagsHtml = (tx.groups || []).map(gid => {
      const g = getGroup(gid);
      return g ? `<span class="group-tag" style="background:${g.color}20;color:${g.color};border-color:${g.color}40">${g.name}</span>` : '';
    }).join('');

    inner.innerHTML = `
      <div class="tx-detail-amount ${isIncome ? 'positive' : 'negative'}">
        ${isIncome ? '+' : ''}${fmt(tx.amount)}
      </div>
      <div class="tx-detail-payee">${payee || '—'}</div>
      ${tx.purpose ? `<div class="tx-detail-purpose">${tx.purpose}</div>` : ''}
      <div class="tx-detail-grid">
        ${row('Buchungsdatum', fmtDate(tx.date))}
        ${row('Wertstellung',  tx.valueDate ? tx.valueDate : '')}
        ${row('Typ',           tx.type)}
        ${row('Status',        tx.status)}
        ${row('IBAN',          tx.iban)}
        ${row('Gläubiger-ID',  tx.creditorId)}
        ${row('Mandatsref.',   tx.mandateRef)}
      </div>
      ${groupTagsHtml ? `<div class="tx-detail-groups">${groupTagsHtml}</div>` : ''}
    `;

    popover.style.display = 'block';

    // Position: prefer right of row, fall back to left, clamp to viewport
    const rect = anchorEl.getBoundingClientRect();
    const pw = popover.offsetWidth  || 380;
    const ph = popover.offsetHeight || 260;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = rect.left;
    let top  = rect.bottom + 6;

    // If not enough space below, show above
    if (top + ph > vh - 10) top = rect.top - ph - 6;
    // Clamp horizontally
    left = Math.max(10, Math.min(left, vw - pw - 10));

    popover.style.left = left + 'px';
    popover.style.top  = top  + 'px';
  }

  // Show on row click (but not on interactive elements or when user is selecting text)
  document.getElementById('tx-tbody').addEventListener('click', e => {
    // Skip clicks on buttons / interactive children
    if (e.target.closest('button, a, input, select')) return;
    // Skip if the user just made or has a text selection
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    const tr = e.target.closest('tr[data-tx-idx]');
    if (!tr) return;
    const idx = parseInt(tr.dataset.txIdx);
    const tx  = state.tableFiltered[idx];
    if (!tx) return;
    e.stopPropagation();
    show(tx, tr);
  });

  // Close on outside click or Escape
  document.addEventListener('click', () => hide());
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
  document.addEventListener('scroll', hide, true);
})();

// ─────────────────────────────────────────────────────────────────────────────
// PDF Export
// ─────────────────────────────────────────────────────────────────────────────
(function initPdfExport() {
  const backdrop   = document.getElementById('pdf-modal-backdrop');
  const closeBtn   = document.getElementById('pdf-modal-close');
  const cancelBtn  = document.getElementById('pdf-cancel-btn');
  const printBtn   = document.getElementById('pdf-print-btn');
  const selectAll  = document.getElementById('pdf-select-all');
  const exportBtn  = document.getElementById('pdf-export-btn');

  const SECTIONS = ['kpi', 'chart-monthly', 'chart-balance', 'chart-merchants', 'chart-largest', 'chart-month-amount', 'tx-table'];

  function getSectionEls() {
    return SECTIONS.map(key => document.querySelector(`[data-pdf-section="${key}"]`)).filter(Boolean);
  }

  function getChecked() {
    return [...document.querySelectorAll('input[name="pdf-section"]:checked')].map(i => i.value);
  }

  function syncSelectAll() {
    const boxes = [...document.querySelectorAll('input[name="pdf-section"]')];
    selectAll.checked = boxes.every(b => b.checked);
    selectAll.indeterminate = !selectAll.checked && boxes.some(b => b.checked);
  }

  function openModal() {
    backdrop.style.display = 'flex';
    syncSelectAll();
  }

  function closeModal() {
    backdrop.style.display = 'none';
  }

  function applyPrintSelection(selected) {
    getSectionEls().forEach(el => {
      const key = el.dataset.pdfSection;
      if (selected.includes(key)) {
        el.setAttribute('data-pdf-visible', '');
      } else {
        el.removeAttribute('data-pdf-visible');
      }
    });
  }

  function buildPrintHeader() {
    const title   = document.getElementById('print-header-title');
    const sub     = document.getElementById('print-header-sub');
    const filters = document.getElementById('print-header-filters');
    if (!title || !sub) return;

    // Title + meta line
    const meta = state.raw && state.raw.meta;
    title.textContent = `Kontoeinblick${meta && meta.bankName ? ' — ' + meta.bankName : ''}`;
    const parts = [];
    if (meta && meta.iban)   parts.push(meta.iban);
    if (meta && meta.period) parts.push(meta.period);
    parts.push(new Date().toLocaleDateString());
    sub.textContent = parts.join(' · ');

    // Active filters summary
    if (!filters) return;
    const chips = [];

    // Time range
    const rangeLabelMap = {
      all: t('rangeAll'), cur: t('rangeCur'), prev: t('rangePrev'),
      curyr: t('rangeCuryr'), prevyr: t('rangePrevyr'),
      '3m': '3M', '6m': '6M', '12m': '12M',
    };
    if (state.rangeMode === 'year' && state.selectedYear) {
      chips.push({ label: t('labelYear'), value: String(state.selectedYear) });
    } else if (state.rangeMode === 'month' && state.selectedYear && state.selectedMonth !== null) {
      const monthNames = t('months');
      chips.push({ label: t('labelMonth'), value: `${monthNames[state.selectedMonth]} ${state.selectedYear}` });
    } else if (state.rangeMode === 'custom' && state.customFrom && state.customTo) {
      const fmt = d => d.toLocaleDateString();
      chips.push({ label: t('labelRange'), value: `${fmt(state.customFrom)} – ${fmt(state.customTo)}` });
    } else if (state.rangeMode !== 'all') {
      chips.push({ label: t('labelRange'), value: rangeLabelMap[state.rangeMode] || state.rangeMode });
    }

    // Type filter
    if (state.typeFilter === 'income')  chips.push({ label: t('allTypes'), value: t('incomeOnly') });
    if (state.typeFilter === 'expense') chips.push({ label: t('allTypes'), value: t('expenseOnly') });

    // Group filter
    if (state.groupFilter.size > 0) {
      const names = [...state.groupFilter].map(id => {
        if (id === '__none__') return t('groupsFilterNone');
        const g = getGroup(id);
        return g ? g.name : id;
      });
      chips.push({ label: t('groupsHeading'), value: names.join(', ') });
    }

    // Month filter (table)
    if (state.txMonthFilter.size > 0) {
      const monthNames = t('months');
      const labels = [...state.txMonthFilter].sort().map(mk => {
        const [y, m] = mk.split('-');
        return `${monthNames[parseInt(m) - 1]} ${y}`;
      });
      chips.push({ label: t('labelMonth'), value: labels.join(', ') });
    }

    // Search query
    if (state.searchQuery) {
      chips.push({ label: '🔍', value: state.searchQuery });
    }

    // Minimum amount
    if (state.amountMin > 0) {
      chips.push({ label: '≥', value: `${state.amountMin.toLocaleString('de-DE')} €` });
    }

    if (chips.length === 0) {
      filters.style.display = 'none';
    } else {
      filters.style.display = '';
      filters.innerHTML = chips.map(c =>
        `<span class="print-filter-chip"><span class="print-filter-label">${c.label}:</span> ${c.value}</span>`
      ).join('');
    }
  }

  function buildPrintTable(selected) {
    // If tx-table is selected, render all filtered rows (no pagination) into the print table
    const tableBody = document.getElementById('tx-tbody');
    const tableFoot = document.getElementById('tx-tfoot');
    if (!selected.includes('tx-table') || !tableBody) return null;

    const txs = state.tableFiltered || [];
    const fmt = (n) => (n >= 0 ? '+' : '') + n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

    // Temporarily replace tbody with all rows (we'll restore after print)
    const savedInner = tableBody.innerHTML;
    const savedFoot  = tableFoot ? tableFoot.innerHTML : '';

    tableBody.innerHTML = txs.map((tx, i) => {
      const payee = tx.isExpense ? (tx.recipient || tx.payer || '—') : (tx.payer || tx.recipient || '—');
      const amtClass = tx.isIncome ? 'income' : 'expense';
      const date = tx.bookingDate || tx.date.toLocaleDateString('de-DE');
      return `<tr>
        <td>${date}</td>
        <td>${payee.replace(/</g,'&lt;')}</td>
        <td>${(tx.purpose||'').replace(/</g,'&lt;')}</td>
        <td>${(tx.type||'').replace(/</g,'&lt;')}</td>
        <td style="text-align:right" class="amount ${amtClass}">${fmt(tx.amount)}</td>
      </tr>`;
    }).join('');

    // Summary footer
    if (tableFoot) {
      const totalIncome  = txs.filter(tx => tx.isIncome).reduce((s, tx) => s + tx.amount, 0);
      const totalExpense = txs.filter(tx => tx.isExpense).reduce((s, tx) => s + tx.amount, 0);
      const net = totalIncome + totalExpense;
      tableFoot.innerHTML = `<tr>
        <td colspan="4" style="text-align:right;font-weight:700">${t('kpiIncome')}: <span class="income">${fmt(totalIncome)}</span> &nbsp; ${t('kpiExpense')}: <span class="expense">${fmt(totalExpense)}</span></td>
        <td style="text-align:right;font-weight:700" class="amount ${net >= 0 ? 'income' : 'expense'}">${fmt(net)}</td>
      </tr>`;
    }

    return () => {
      tableBody.innerHTML = savedInner;
      if (tableFoot) tableFoot.innerHTML = savedFoot;
    };
  }

  function doPrint() {
    const selected = getChecked();
    if (!selected.length) { alert(t('pdfNoSectionWarning')); return; }

    // Expand collapsed cards that are selected for print
    selected.forEach(key => {
      const el = document.querySelector(`[data-pdf-section="${key}"]`);
      if (!el) return;
      const btn = el.querySelector('.collapse-btn.collapsed');
      if (btn) btn.click();
    });

    closeModal();
    buildPrintHeader();
    applyPrintSelection(selected);

    const restoreTable = buildPrintTable(selected);

    // Brief timeout to let DOM settle before print dialog
    setTimeout(() => {
      window.print();

      // Restore everything after print dialog closes
      getSectionEls().forEach(el => el.setAttribute('data-pdf-visible', ''));
      if (restoreTable) restoreTable();
    }, 80);
  }

  // Wire up modal buttons
  if (exportBtn) exportBtn.addEventListener('click', openModal);
  if (closeBtn)  closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (printBtn)  printBtn.addEventListener('click', doPrint);

  // Close on backdrop click (outside modal)
  if (backdrop) {
    backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });
  }

  // Select-all toggle
  if (selectAll) {
    selectAll.addEventListener('change', () => {
      document.querySelectorAll('input[name="pdf-section"]').forEach(b => { b.checked = selectAll.checked; });
    });
  }

  // Keep select-all in sync
  document.querySelectorAll('input[name="pdf-section"]').forEach(b => {
    b.addEventListener('change', syncSelectAll);
  });

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && backdrop && backdrop.style.display !== 'none') closeModal();
  });
})();
