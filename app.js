const API_URL = 'https://open.api.nexon.com/mabinogi/v1/auction/keyword-search';
const API_KEY = 'live_f5410ee0ae6feccbb5afdbc8e103b29648248b8e25600696d7c30c1e743a1f3eefe8d04e6d233bd35cf2fabdeb93fb0d';

const form = document.getElementById('search-form');
const keywordInput = document.getElementById('keyword');
const statusEl = document.getElementById('status');
const resultsCardEl = document.querySelector('.results-card');
const resultsEl = document.getElementById('results');
const resultCountEl = document.getElementById('result-count');
const sortSelectEl = document.getElementById('sort-select');
const priceMinEl = document.getElementById('price-min');
const priceMaxEl = document.getElementById('price-max');
const optionFilterListEl = document.getElementById('option-filter-list');
const optionMatchAnyEl = document.getElementById('option-match-any');
const optionAddEl = document.getElementById('option-add');
const optionResetEl = document.getElementById('option-reset');
const filterResetEl = document.getElementById('filter-reset');
const filterSaveEl = document.getElementById('filter-save');
const favoriteAddEl = document.getElementById('favorite-add');
const favoriteListEl = document.getElementById('favorite-list');
const recentListEl = document.getElementById('recent-list');
const savedFilterListEl = document.getElementById('saved-filter-list');
const categoryFilterListEl = document.getElementById('category-filter-list');
const inspectorTitleEl = document.getElementById('inspector-title');
const inspectorSummaryEl = document.getElementById('inspector-summary');
const inspectorColorsEl = document.getElementById('inspector-colors');
const inspectorOptionsEl = document.getElementById('inspector-options');
const modalEl = document.getElementById('item-modal');
const modalBackdropEl = document.getElementById('modal-backdrop');
const modalCloseEl = document.getElementById('modal-close');
const modalCategoryEl = document.getElementById('modal-category');
const modalTitleEl = document.getElementById('modal-title');
const modalPriceEl = document.getElementById('modal-price');
const modalCountEl = document.getElementById('modal-count');
const modalExpireEl = document.getElementById('modal-expire');
const modalColorsEl = document.getElementById('modal-colors');
const modalOptionsEl = document.getElementById('modal-options');

const state = {
  keyword: '',
  items: [],
  categoryFilter: 'all',
  priceMin: '',
  priceMax: '',
  optionFilters: [createOptionFilter()],
  optionMatchAny: false,
  optionFields: [],
  favorites: [],
  recentSearches: [],
  savedFilters: [],
  visibleItems: [],
  selectedIndex: 0,
};

const DEFAULT_EXCLUSIONS = ['도면', '옷본'];
const FAVORITES_STORAGE_KEY = 'mabinogi-auction:favorites';
const RECENTS_STORAGE_KEY = 'mabinogi-auction:recent-searches';
const SAVED_FILTERS_STORAGE_KEY = 'mabinogi-auction:saved-filters';
const SORT_STORAGE_KEY = 'mabinogi-auction:sort';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPrice(value) {
  return new Intl.NumberFormat('ko-KR').format(value) + ' 골드';
}

function formatExpire(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes >= 0) {
    if (diffMinutes < 60) return `만료까지 ${diffMinutes}분`;
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    if (hours < 24) return `만료까지 ${hours}시간 ${minutes}분`;
    const days = Math.floor(hours / 24);
    const remainHours = hours % 24;
    return `만료까지 ${days}일 ${remainHours}시간`;
  }

  const passedMinutes = Math.abs(diffMinutes);
  if (passedMinutes < 60) return `${passedMinutes}분 전 만료`;
  const passedHours = Math.floor(passedMinutes / 60);
  const remainMinutes = passedMinutes % 60;
  if (passedHours < 24) return `${passedHours}시간 ${remainMinutes}분 전 만료`;
  const passedDays = Math.floor(passedHours / 24);
  const remainHours = passedHours % 24;
  return `${passedDays}일 ${remainHours}시간 전 만료`;
}

function formatAbsoluteKST(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function splitOptions(options = []) {
  const colorOptions = [];
  const otherOptions = [];

  options.forEach((option) => {
    if (option?.option_type === '아이템 색상') {
      colorOptions.push(option);
    } else {
      otherOptions.push(option);
    }
  });

  return { colorOptions, otherOptions };
}

function createOptionFilter(filter = {}) {
  return {
    field: filter.field || 'all',
    mode: filter.mode || 'range',
    min: String(filter.min ?? ''),
    max: String(filter.max ?? ''),
  };
}

function getOptionFieldLabel(option) {
  return [option?.option_type, option?.option_sub_type].filter(Boolean).join(' ').trim();
}

function getOptionFieldGroup(option) {
  const type = String(option?.option_type || '').trim();
  if (!type) return '기타';
  if (type.startsWith('세공 옵션')) return '세공';
  if (type.startsWith('인챈트 접두')) return '인챈트, 접두';
  if (type.startsWith('인챈트 접미')) return '인챈트, 접미';
  if (type.startsWith('아이템 색상')) return '색상';
  if (type.startsWith('세트 효과')) return '세트 효과';
  if (type.startsWith('일반 개조')) return '개조';
  if (type.startsWith('특별 개조')) return '개조';
  if (type.startsWith('보석 개조')) return '개조';
  if (type.startsWith('에르그')) return '에르그';
  if (type.startsWith('남은 전용 해제 가능 횟수')) return '기타';
  return type.split(' ')[0] || '기타';
}

function extractNumbers(value) {
  const matches = String(value || '').match(/-?\d+(?:\.\d+)?/g) || [];
  return matches.map((part) => Number(part)).filter((num) => Number.isFinite(num));
}

function buildOptionFieldGroups(items = []) {
  const seen = new Set();
  const groups = new Map();

  items.forEach((item) => {
    (item.item_option || []).forEach((option) => {
      const label = getOptionFieldLabel(option);
      if (!label || seen.has(label)) return;
      seen.add(label);
      const group = getOptionFieldGroup(option);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(label);
    });
  });

  return [...groups.entries()].map(([group, fields]) => ({
    group,
    fields: fields.sort((a, b) => a.localeCompare(b, 'ko-KR')),
  }));
}

function getOptionFilterLabel(filter) {
  const parts = [];
  if (filter.field && filter.field !== 'all') parts.push(filter.field);
  if (filter.min || filter.max || filter.mode === 'gte' || filter.mode === 'lte') {
    const label = filter.mode === 'gte'
      ? `이상 ${filter.min || '0'}`
      : filter.mode === 'lte'
        ? `이하 ${filter.max || '∞'}`
        : `범위 ${filter.min || '0'}~${filter.max || '∞'}`;
    parts.push(label);
  }
  return parts.length ? parts.join(' · ') : '옵션 조건';
}

function getActiveOptionFilters() {
  return (state.optionFilters || []).filter((filter) => {
    const field = String(filter.field || 'all');
    const min = String(filter.min || '');
    const max = String(filter.max || '');
    return field !== 'all' || min !== '' || max !== '';
  });
}

function renderOptionFilterList(items) {
  if (!optionFilterListEl) return;
  const groups = buildOptionFieldGroups(items);
  const fields = groups.flatMap((entry) => entry.fields);
  const selectedFields = state.optionFilters
    .map((filter) => String(filter.field || '').trim())
    .filter((field) => field && field !== 'all' && !fields.includes(field));
  const allFields = [...fields, ...selectedFields];
  state.optionFields = allFields;

  state.optionFilters = (state.optionFilters.length ? state.optionFilters : [createOptionFilter()]).slice(0, 5).map(createOptionFilter);
  if (!state.optionFilters.length) state.optionFilters = [createOptionFilter()];

  const optionOptions = [
    `<option value="all">전체</option>`,
    selectedFields.length ? `
      <optgroup label="선택된 조건">
        ${selectedFields.map((field) => `<option value="${escapeHtml(field)}">${escapeHtml(field)}</option>`).join('')}
      </optgroup>
    ` : '',
    ...groups.map((entry) => `
      <optgroup label="${escapeHtml(entry.group)} · ${entry.fields.length}">
        ${entry.fields.map((field) => `<option value="${escapeHtml(field)}">${escapeHtml(field)}</option>`).join('')}
      </optgroup>
    `),
  ].join('');

  optionFilterListEl.innerHTML = state.optionFilters
    .map((filter, index) => `
      <div class="option-filter-row" data-option-index="${index}">
        <select class="option-filter-field" data-option-key="field">${optionOptions}</select>
        <select class="option-filter-mode" data-option-key="mode">
          <option value="range">범위</option>
          <option value="gte">이상</option>
          <option value="lte">이하</option>
        </select>
        <div class="option-range-grid">
          <input class="option-filter-min" data-option-key="min" type="number" inputmode="numeric" placeholder="최소값" />
          <input class="option-filter-max" data-option-key="max" type="number" inputmode="numeric" placeholder="최대값" />
        </div>
        <button class="filter-reset option-remove" type="button" ${state.optionFilters.length > 1 ? '' : 'disabled'}>삭제</button>
      </div>
    `)
    .join('');

  const rows = [...optionFilterListEl.querySelectorAll('.option-filter-row')];
  rows.forEach((row, index) => {
    const filter = state.optionFilters[index] || createOptionFilter();
    syncOptionFilterRowState(row, {
      field: allFields.includes(filter.field) ? filter.field : 'all',
      mode: filter.mode || 'range',
      min: filter.min || '',
      max: filter.max || '',
    });
  });

  if (optionMatchAnyEl) optionMatchAnyEl.checked = Boolean(state.optionMatchAny);
  if (optionAddEl) optionAddEl.disabled = state.optionFilters.length >= 5;
}

function syncOptionFilterRowState(row, filter) {
  if (!row) return;
  const fieldEl = row.querySelector('[data-option-key="field"]');
  const modeEl = row.querySelector('[data-option-key="mode"]');
  const minEl = row.querySelector('[data-option-key="min"]');
  const maxEl = row.querySelector('[data-option-key="max"]');
  if (fieldEl) fieldEl.value = filter.field || 'all';
  if (modeEl) modeEl.value = filter.mode || 'range';
  if (minEl) minEl.value = filter.min || '';
  if (maxEl) maxEl.value = filter.max || '';
}

function parseNumberInput(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeOptionNumberCriteria() {
  return state.optionFilters.map((filter) => ({
    field: String(filter.field || 'all'),
    mode: filter.mode || 'range',
    min: parseNumberInput(filter.min),
    max: parseNumberInput(filter.max),
  }));
}

function optionMatchesCriteria(option, filter) {
  if (filter.field !== 'all' && getOptionFieldLabel(option) !== filter.field) return false;

  const hasValueConstraint = filter.min !== null || filter.max !== null;
  if (!hasValueConstraint) return true;

  const numbers = [
    ...extractNumbers(option?.option_value),
    ...extractNumbers(option?.option_value2),
    ...extractNumbers(option?.option_desc),
  ];

  if (!numbers.length) return false;

  if (filter.mode === 'gte') {
    return filter.min === null ? true : numbers.some((num) => num >= filter.min);
  }

  if (filter.mode === 'lte') {
    return filter.max === null ? true : numbers.some((num) => num <= filter.max);
  }

  const lower = filter.min === null ? Number.NEGATIVE_INFINITY : filter.min;
  const upper = filter.max === null ? Number.POSITIVE_INFINITY : filter.max;
  return numbers.some((num) => num >= lower && num <= upper);
}

function matchesOptionFilters(item) {
  const filters = normalizeOptionNumberCriteria().filter((filter) => filter.field !== 'all' || filter.min !== null || filter.max !== null);
  if (!filters.length) return true;
  const options = item.item_option || [];
  const results = filters.map((filter) => options.some((option) => optionMatchesCriteria(option, filter)));
  return state.optionMatchAny ? results.some(Boolean) : results.every(Boolean);
}

function formatOption(option) {
  const parts = [option.option_type];
  if (option.option_sub_type) parts.push(option.option_sub_type);
  const label = parts.join(' ');
  const values = [option.option_value, option.option_value2].filter(Boolean).join(' / ');
  const desc = option.option_desc ? ` (${option.option_desc})` : '';
  return values ? `${label}: ${values}${desc}` : `${label}${desc}`;
}

function extractOptionRgb(option) {
  const numbers = [
    ...extractNumbers(option?.option_value),
    ...extractNumbers(option?.option_value2),
    ...extractNumbers(option?.option_desc),
  ];
  if (numbers.length < 3) return null;
  return numbers.slice(0, 3).map((num) => Math.max(0, Math.min(255, Math.floor(num))));
}

function hasDetail(item) {
  const { colorOptions, otherOptions } = splitOptions(item.item_option || []);
  return colorOptions.length > 0 || otherOptions.length > 0;
}

function loadFavorites() {
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean).slice(0, 12) : [];
  } catch {
    return [];
  }
}

function saveFavorites() {
  try {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(state.favorites.slice(0, 12)));
  } catch {
    // ignore storage failures
  }
}

function loadRecentSearches() {
  try {
    const raw = window.localStorage.getItem(RECENTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean).slice(0, 8) : [];
  } catch {
    return [];
  }
}

function saveRecentSearches() {
  try {
    window.localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(state.recentSearches.slice(0, 8)));
  } catch {
    // ignore storage failures
  }
}

function loadSavedFilters() {
  try {
    const raw = window.localStorage.getItem(SAVED_FILTERS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(Boolean)
      .map((entry) => ({
        keyword: String(entry.keyword || '').trim(),
        sort: entry.sort || 'registered',
        category: entry.category || 'all',
        optionMatchAny: Boolean(entry.optionMatchAny),
        optionFilters: Array.isArray(entry.optionFilters) && entry.optionFilters.length
          ? entry.optionFilters.slice(0, 5).map(createOptionFilter)
          : [{
            field: entry.optionField || 'all',
            mode: entry.optionMode || 'range',
            min: String(entry.optionMin ?? ''),
            max: String(entry.optionMax ?? ''),
            }],
        priceMin: String(entry.priceMin || ''),
        priceMax: String(entry.priceMax || ''),
      }))
      .slice(0, 8);
  } catch {
    return [];
  }
}

function saveSavedFilters() {
  try {
    window.localStorage.setItem(SAVED_FILTERS_STORAGE_KEY, JSON.stringify(state.savedFilters.slice(0, 8)));
  } catch {
    // ignore storage failures
  }
}

function addFavorite(keyword) {
  const value = String(keyword || '').trim();
  if (!value) return;
  state.favorites = [value, ...state.favorites.filter((item) => item !== value)].slice(0, 12);
  saveFavorites();
  renderFavorites();
}

function removeFavorite(keyword) {
  state.favorites = state.favorites.filter((item) => item !== keyword);
  saveFavorites();
  renderFavorites();
}

function addRecentSearch(keyword) {
  const value = String(keyword || '').trim();
  if (!value) return;
  state.recentSearches = [value, ...state.recentSearches.filter((item) => item !== value)].slice(0, 8);
  saveRecentSearches();
  renderRecentSearches();
}

function makeFilterSnapshot() {
  return {
    keyword: state.keyword.trim(),
    sort: sortSelectEl.value,
    category: state.categoryFilter,
    optionMatchAny: Boolean(state.optionMatchAny),
    optionFilters: state.optionFilters.map(createOptionFilter),
    priceMin: state.priceMin,
    priceMax: state.priceMax,
  };
}

function snapshotLabel(snapshot) {
  const parts = [];
  if (snapshot.keyword) parts.push(snapshot.keyword);
  const optionFilters = Array.isArray(snapshot.optionFilters) ? snapshot.optionFilters : [];
  const activeOptionFilters = optionFilters.filter((filter) => filter.field !== 'all' || filter.min || filter.max);
  if (activeOptionFilters.length) {
    const sample = activeOptionFilters.slice(0, 2).map(getOptionFilterLabel);
    const joiner = snapshot.optionMatchAny ? ' OR ' : ' AND ';
    parts.push(`옵션:${sample.join(joiner)}${activeOptionFilters.length > 2 ? ` 외 ${activeOptionFilters.length - 2}` : ''}`);
  }
  if (snapshot.category && snapshot.category !== 'all') parts.push(`분류:${snapshot.category}`);
  if (snapshot.priceMin || snapshot.priceMax) parts.push(`가격:${snapshot.priceMin || '0'}~${snapshot.priceMax || '∞'}`);
  if (snapshot.sort && snapshot.sort !== 'registered') parts.push(`정렬:${snapshot.sort}`);
  return parts.length ? parts.join(' · ') : '기본 조건';
}

function addSavedFilter(snapshot = makeFilterSnapshot()) {
  const normalized = {
    keyword: String(snapshot.keyword || '').trim(),
    sort: snapshot.sort || 'registered',
    category: snapshot.category || 'all',
    optionMatchAny: Boolean(snapshot.optionMatchAny),
    optionFilters: Array.isArray(snapshot.optionFilters) && snapshot.optionFilters.length
      ? snapshot.optionFilters.slice(0, 5).map(createOptionFilter)
      : [createOptionFilter()],
    priceMin: String(snapshot.priceMin || ''),
    priceMax: String(snapshot.priceMax || ''),
  };
  const key = JSON.stringify(normalized);
  state.savedFilters = [
    normalized,
    ...state.savedFilters.filter((entry) => JSON.stringify(entry) !== key),
  ].slice(0, 8);
  saveSavedFilters();
  renderSavedFilters();
}

function removeSavedFilter(index) {
  state.savedFilters = state.savedFilters.filter((_, i) => i !== index);
  saveSavedFilters();
  renderSavedFilters();
}

function removeRecentSearch(keyword) {
  state.recentSearches = state.recentSearches.filter((item) => item !== keyword);
  saveRecentSearches();
  renderRecentSearches();
}

function renderFavorites() {
  if (!favoriteListEl) return;
  if (!state.favorites.length) {
    favoriteListEl.innerHTML = '<span class="muted">저장된 검색어가 없습니다.</span>';
    return;
  }

  favoriteListEl.innerHTML = state.favorites
    .map(
      (keyword) => `
        <span class="favorite-chip" data-keyword="${escapeHtml(keyword)}">
          <button class="pill favorite-open" type="button">${escapeHtml(keyword)}</button>
          <button class="pill-remove" type="button" aria-label="${escapeHtml(keyword)} 삭제">×</button>
        </span>
      `
      )
    .join('');
}

function renderRecentSearches() {
  if (!recentListEl) return;
  if (!state.recentSearches.length) {
    recentListEl.innerHTML = '<span class="muted">최근 검색이 없습니다.</span>';
    return;
  }

  recentListEl.innerHTML = state.recentSearches
    .map(
      (keyword) => `
        <span class="favorite-chip" data-recent="${escapeHtml(keyword)}">
          <button class="pill recent-open" type="button">${escapeHtml(keyword)}</button>
          <button class="pill-remove" type="button" aria-label="${escapeHtml(keyword)} 삭제">×</button>
        </span>
      `
    )
    .join('');
}

function renderSavedFilters() {
  if (!savedFilterListEl) return;
  if (!state.savedFilters.length) {
    savedFilterListEl.innerHTML = '<span class="muted">저장된 조건이 없습니다.</span>';
    return;
  }

  savedFilterListEl.innerHTML = state.savedFilters
    .map((snapshot, index) => `
      <span class="favorite-chip" data-filter-index="${index}">
        <button class="pill saved-filter-open" type="button">${escapeHtml(snapshotLabel(snapshot))}</button>
        <button class="pill-remove" type="button" aria-label="조건 ${index + 1} 삭제">×</button>
      </span>
    `)
    .join('');
}

function getAvailableCategories(items) {
  const seen = new Set();
  const categories = [];
  items.forEach((item) => {
    const category = item.auction_item_category || '분류 없음';
    if (!seen.has(category)) {
      seen.add(category);
      categories.push(category);
    }
  });
  return categories;
}

function renderCategoryFilters(items) {
  if (!categoryFilterListEl) return;
  const categories = getAvailableCategories(items);
  const buttons = ['all', ...categories];
  if (state.categoryFilter !== 'all' && !categories.includes(state.categoryFilter)) {
    state.categoryFilter = 'all';
  }
  categoryFilterListEl.innerHTML = buttons
    .map((category) => {
      const label = category === 'all' ? '전체' : category;
      const active = state.categoryFilter === category ? 'active' : '';
      return `<button class="pill category-chip ${active}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(label)}</button>`;
    })
    .join('');
}

function getSortedItems(items) {
  const mode = sortSelectEl.value;
  if (mode === 'registered') return [...items];
  return [...items].sort((a, b) => {
    if (mode === 'priceAsc') return (a.auction_price_per_unit ?? 0) - (b.auction_price_per_unit ?? 0);
    if (mode === 'priceDesc') return (b.auction_price_per_unit ?? 0) - (a.auction_price_per_unit ?? 0);
    if (mode === 'expireAsc') return new Date(a.date_auction_expire || 0).getTime() - new Date(b.date_auction_expire || 0).getTime();
    return 0;
  });
}

function getQuantityColumnEnabled(items) {
  return items.some((item) => (item.item_count ?? 1) > 1);
}

function isCompactLayout() {
  try {
    return window.matchMedia('(max-width: 1240px)').matches;
  } catch {
    return false;
  }
}

function loadSortPreference() {
  try {
    const value = window.localStorage.getItem(SORT_STORAGE_KEY);
    return value || 'registered';
  } catch {
    return 'registered';
  }
}

function saveSortPreference() {
  try {
    window.localStorage.setItem(SORT_STORAGE_KEY, sortSelectEl.value);
  } catch {
    // ignore storage failures
  }
}

function parsePrice(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? String(Math.max(0, Math.floor(parsed))) : '';
}

function parseOptionValue(key, value) {
  if (key === 'min' || key === 'max') return parsePrice(value);
  return String(value || '');
}

function updateOptionFilter(index, patch) {
  const current = state.optionFilters[index] || createOptionFilter();
  state.optionFilters[index] = createOptionFilter({ ...current, ...patch });
}

function setPriceInputsFromState() {
  if (priceMinEl) priceMinEl.value = state.priceMin;
  if (priceMaxEl) priceMaxEl.value = state.priceMax;
}

function syncStateToUrl() {
  const url = new URL(window.location.href);
  const params = url.searchParams;

  if (state.keyword) params.set('keyword', state.keyword);
  else params.delete('keyword');

  if (sortSelectEl.value && sortSelectEl.value !== 'registered') params.set('sort', sortSelectEl.value);
  else params.delete('sort');

  if (state.categoryFilter && state.categoryFilter !== 'all') params.set('category', state.categoryFilter);
  else params.delete('category');

  if (state.priceMin) params.set('minPrice', state.priceMin);
  else params.delete('minPrice');

  if (state.priceMax) params.set('maxPrice', state.priceMax);
  else params.delete('maxPrice');

  const activeOptionFilters = getActiveOptionFilters().slice(0, 5).map(createOptionFilter);
  if (activeOptionFilters.length) params.set('options', JSON.stringify(activeOptionFilters));
  else params.delete('options');

  if (state.optionMatchAny) params.set('optionAny', '1');
  else params.delete('optionAny');

  window.history.replaceState({}, '', url);
}

function applyUrlState() {
  const params = new URL(window.location.href).searchParams;
  const keyword = params.get('keyword') || '';
  const sort = params.get('sort') || sortSelectEl.value || 'registered';
  const category = params.get('category') || 'all';
  const minPrice = parsePrice(params.get('minPrice'));
  const maxPrice = parsePrice(params.get('maxPrice'));
  const optionAny = params.get('optionAny') === '1';
  const optionsParam = params.get('options');
  let optionFilters = [];
  if (optionsParam) {
    try {
      const parsed = JSON.parse(optionsParam);
      if (Array.isArray(parsed)) optionFilters = parsed.slice(0, 5).map(createOptionFilter);
    } catch {
      optionFilters = [];
    }
  }
  if (!optionFilters.length) {
    const optionField = params.get('optionField') || 'all';
    const optionMode = params.get('optionMode') || 'range';
    const optionMin = parsePrice(params.get('optionMin'));
    const optionMax = parsePrice(params.get('optionMax'));
    optionFilters = [createOptionFilter({ field: optionField, mode: optionMode, min: optionMin, max: optionMax })];
  }

  sortSelectEl.value = sort;
  state.categoryFilter = category;
  state.priceMin = minPrice;
  state.priceMax = maxPrice;
  state.optionFilters = optionFilters.length ? optionFilters : [createOptionFilter()];
  state.optionMatchAny = optionAny;
  setPriceInputsFromState();

  return keyword;
}

function getVisibleItems() {
  const filteredByDefault = state.items.filter((item) => matchesDefaultExclusions(item, state.keyword));
  const filteredByPrice = filteredByDefault.filter((item) => {
    const price = Number(item.auction_price_per_unit ?? 0);
    if (state.priceMin !== '' && price < Number(state.priceMin)) return false;
    if (state.priceMax !== '' && price > Number(state.priceMax)) return false;
    return true;
  });
  const filteredByOption = filteredByPrice.filter((item) => matchesOptionFilters(item));
  return state.categoryFilter === 'all'
    ? filteredByOption
    : filteredByOption.filter((item) => (item.auction_item_category || '분류 없음') === state.categoryFilter);
}

function getItemsBeforeOptionFilter() {
  const filteredByDefault = state.items.filter((item) => matchesDefaultExclusions(item, state.keyword));
  const filteredByPrice = filteredByDefault.filter((item) => {
    const price = Number(item.auction_price_per_unit ?? 0);
    if (state.priceMin !== '' && price < Number(state.priceMin)) return false;
    if (state.priceMax !== '' && price > Number(state.priceMax)) return false;
    return true;
  });
  return state.categoryFilter === 'all'
    ? filteredByPrice
    : filteredByPrice.filter((item) => (item.auction_item_category || '분류 없음') === state.categoryFilter);
}

function matchesDefaultExclusions(item, keyword) {
  const query = String(keyword || '').trim();
  const allowExcludedTerms = DEFAULT_EXCLUSIONS.some((term) => query.includes(term));
  if (allowExcludedTerms) return true;

  const name = `${item.item_display_name || ''} ${item.item_name || ''}`;
  return !DEFAULT_EXCLUSIONS.some((term) => name.includes(term));
}

function setEmpty(message) {
  resultsEl.innerHTML = `<li class="empty">${escapeHtml(message)}</li>`;
  resultCountEl.textContent = '0건';
  resultsCardEl.classList.remove('qty-off');
  state.visibleItems = [];
  state.selectedIndex = 0;
  renderOptionFilterList([]);
  renderCategoryFilters([]);
  renderInspector(null);
  resultsCardEl.dataset.filtered = '0';
}

function renderZeroResults(message, showOptionReset = false) {
  const action = showOptionReset
    ? `<button id="empty-option-reset" class="filter-reset empty-option-reset" type="button">옵션 초기화</button>`
    : '';
  resultsEl.innerHTML = `
    <li class="empty empty-with-action">
      <div class="empty-copy">${escapeHtml(message)}</div>
      ${action}
    </li>
  `;
  if (showOptionReset) {
    const button = document.getElementById('empty-option-reset');
    if (button) {
      button.addEventListener('click', resetOptionFilters);
    }
  }
}

function renderInspector(item) {
  if (!inspectorTitleEl || !inspectorSummaryEl || !inspectorColorsEl || !inspectorOptionsEl) return;

  if (!item) {
    inspectorTitleEl.textContent = '아직 선택된 항목이 없습니다.';
    inspectorSummaryEl.textContent = '결과에서 항목을 선택하면 상세가 표시됩니다.';
    inspectorSummaryEl.classList.add('empty-state');
    inspectorColorsEl.classList.add('empty-state');
    inspectorColorsEl.textContent = '색상 정보가 없습니다.';
    inspectorOptionsEl.innerHTML = '<li class="empty-state">옵션 정보가 없습니다.</li>';
    return;
  }

  const itemName = item.item_display_name || item.item_name || '이름 없음';
  const category = item.auction_item_category || '분류 없음';
  const count = item.item_count ?? 0;
  const price = item.auction_price_per_unit ?? 0;
  const expire = item.date_auction_expire ? formatExpire(item.date_auction_expire) : '만료 정보 없음';
  const expireAbsolute = item.date_auction_expire ? formatAbsoluteKST(item.date_auction_expire) : '만료 정보 없음';
  const { colorOptions, otherOptions } = splitOptions(item.item_option || []);

  inspectorTitleEl.textContent = itemName;
  inspectorSummaryEl.classList.remove('empty-state');
  inspectorSummaryEl.innerHTML = `
    <div class="inspector-summary-grid">
      <span><strong>분류</strong>${escapeHtml(category)}</span>
      <span><strong>가격</strong>${escapeHtml(formatPrice(price))}</span>
      <span><strong>수량</strong>${escapeHtml(String(count > 1 ? count : 1))}</span>
      <span><strong>만료</strong>${escapeHtml(expire)} · ${escapeHtml(expireAbsolute)} KST</span>
    </div>
  `;

  if (colorOptions.length) {
    inspectorColorsEl.classList.remove('empty-state');
    inspectorColorsEl.innerHTML = colorOptions
      .map((option) => {
        const rgb = extractOptionRgb(option);
        const swatchStyle = rgb ? `style="background: rgb(${rgb.join(',')});"` : '';
        const swatchText = option.option_value || '-';
        return `
          <div class="color-chip">
            <span class="color-swatch" ${swatchStyle}></span>
            <div class="color-copy">
              <strong>${escapeHtml(option.option_sub_type || option.option_type)}</strong>
              <span>${escapeHtml(swatchText)}</span>
            </div>
          </div>
        `;
      })
      .join('');
  } else {
    inspectorColorsEl.classList.add('empty-state');
    inspectorColorsEl.textContent = '색상 정보가 없습니다.';
  }

  if (otherOptions.length) {
    inspectorOptionsEl.innerHTML = otherOptions
      .map((option) => `<li class="option-item">${escapeHtml(formatOption(option))}</li>`)
      .join('');
  } else {
    inspectorOptionsEl.innerHTML = '<li class="empty-state">옵션 정보가 없습니다.</li>';
  }
}

function renderResults({ refreshOptionFilters = true } = {}) {
  const visibleItems = getVisibleItems();
  const items = getSortedItems(visibleItems);
  state.visibleItems = items;
  if (state.selectedIndex >= items.length) state.selectedIndex = 0;
  const selectedItem = items[state.selectedIndex] || null;
  const compactLayout = isCompactLayout();
  const showQuantity = getQuantityColumnEnabled(items);
  resultsCardEl.classList.toggle('qty-off', !showQuantity);
  const activeFilters = [
    state.categoryFilter !== 'all' ? '분류' : '',
    state.priceMin || state.priceMax ? '가격' : '',
    getActiveOptionFilters().length ? '옵션' : '',
    state.optionMatchAny && getActiveOptionFilters().length > 1 ? 'OR' : '',
  ].filter(Boolean);
  resultCountEl.innerHTML = `${items.length}건${activeFilters.length ? ` · <strong>${escapeHtml(activeFilters.join('/'))}</strong>` : ''}`;
  resultsCardEl.dataset.filtered = String(items.length);
  if (refreshOptionFilters) {
    renderOptionFilterList(getItemsBeforeOptionFilter());
  }
  renderCategoryFilters(visibleItems);

  const optionFiltersActive = getActiveOptionFilters().length > 0;
  const itemsBeforeOptionFilter = getItemsBeforeOptionFilter();

  if (compactLayout) {
    renderInspector(null);
  }

  if (!items.length) {
    if (!compactLayout) renderInspector(null);
    resultsCardEl.classList.remove('qty-off');
    if (optionFiltersActive && itemsBeforeOptionFilter.length) {
      renderZeroResults('옵션 조건에 맞는 결과가 없습니다.', true);
    } else {
      renderZeroResults('검색 결과가 없습니다.', false);
    }
    resultsCardEl.dataset.filtered = '0';
    syncStateToUrl();
    return;
  }

  resultsEl.innerHTML = items
    .map((item, index) => {
      const itemName = item.item_display_name || item.item_name || '이름 없음';
      const itemRawName = item.item_name && item.item_name !== itemName ? item.item_name : '';
      const category = item.auction_item_category || '분류 없음';
      const count = item.item_count ?? 0;
      const price = item.auction_price_per_unit ?? 0;
      const expire = item.date_auction_expire ? formatExpire(item.date_auction_expire) : '만료 정보 없음';
      const expireAbsolute = item.date_auction_expire ? formatAbsoluteKST(item.date_auction_expire) : '만료 정보 없음';
      const detailAvailable = hasDetail(item);
      const quantityCell = showQuantity && count > 1 ? `<span class="result-cell qty-cell">${escapeHtml(count)}</span>` : showQuantity ? '<span class="result-cell qty-cell muted">-</span>' : '';
      const titleSubtitle = itemRawName ? `<span class="result-subtitle">${escapeHtml(itemRawName)}</span>` : '';
      const detailBadge = detailAvailable ? '<span class="detail-badge">상세 옵션</span>' : '<span class="detail-badge muted-badge">간단 정보</span>';
      const row = `
        <span class="result-title-wrap">
          <span class="result-title">${escapeHtml(itemName)}</span>
          ${titleSubtitle}
          ${detailBadge}
        </span>
        <span class="result-cell category-cell">${escapeHtml(category)}</span>
        ${quantityCell}
        <span class="result-cell expire-cell" title="${escapeHtml(expireAbsolute)} KST">${escapeHtml(expire)}</span>
        <span class="result-price price-cell">${escapeHtml(formatPrice(price))}</span>
      `;

      const isSelected = state.selectedIndex === index ? 'is-selected' : '';

      return `
        <li>
          <button class="result-button" type="button" data-index="${index}">
            <div class="result-item result-item-detail ${isSelected}">
              <div class="result-row">${row}</div>
            </div>
          </button>
        </li>
      `;
    })
      .join('');

  if (!compactLayout) {
    renderInspector(selectedItem);
  }

  syncStateToUrl();
}

function resetFilters() {
  state.categoryFilter = 'all';
  state.priceMin = '';
  state.priceMax = '';
  state.optionFilters = [createOptionFilter()];
  state.optionMatchAny = false;
  sortSelectEl.value = 'registered';
  setPriceInputsFromState();
  syncStateToUrl();
  if (state.items.length) renderResults();
}

function resetOptionFilters() {
  state.optionFilters = [createOptionFilter()];
  state.optionMatchAny = false;
  syncStateToUrl();
  if (state.items.length) renderResults();
}

function openModal(item) {
  const itemName = item.item_display_name || item.item_name || '이름 없음';
  const category = item.auction_item_category || '분류 없음';
  const count = item.item_count ?? 0;
  const price = item.auction_price_per_unit ?? 0;
  const expire = item.date_auction_expire ? formatExpire(item.date_auction_expire) : '만료 정보 없음';
  const expireAbsolute = item.date_auction_expire ? formatAbsoluteKST(item.date_auction_expire) : '만료 정보 없음';
  const { colorOptions, otherOptions } = splitOptions(item.item_option || []);

  modalCategoryEl.textContent = category;
  modalTitleEl.textContent = itemName;
  modalPriceEl.textContent = `개당 가격 ${formatPrice(price)}`;
  modalCountEl.textContent = count > 1 ? `수량 ${count}` : '수량 1';
  modalExpireEl.textContent = `만료 ${expire} · ${expireAbsolute} KST`;

  if (colorOptions.length) {
    modalColorsEl.classList.remove('empty-state');
    modalColorsEl.innerHTML = colorOptions
      .map((option) => {
        const rgb = extractOptionRgb(option);
        const swatchStyle = rgb ? `style="background: rgb(${rgb.join(',')});"` : '';
        const swatchText = option.option_value || '-';
        return `
          <div class="color-chip">
            <span class="color-swatch" ${swatchStyle}></span>
            <div class="color-copy">
              <strong>${escapeHtml(option.option_sub_type || option.option_type)}</strong>
              <span>${escapeHtml(swatchText)}</span>
            </div>
          </div>
        `;
      })
      .join('');
  } else {
    modalColorsEl.classList.add('empty-state');
    modalColorsEl.textContent = '색상 정보가 없습니다.';
  }

  if (otherOptions.length) {
    modalOptionsEl.innerHTML = otherOptions
      .map((option) => `<li class="option-item">${escapeHtml(formatOption(option))}</li>`)
      .join('');
  } else {
    modalOptionsEl.innerHTML = '<li class="empty-state">옵션 정보가 없습니다.</li>';
  }

  modalEl.classList.remove('hidden');
  modalEl.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function closeModal() {
  modalEl.classList.add('hidden');
  modalEl.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

async function searchAuction(keyword, cursor = null) {
  const url = new URL(API_URL);
  url.searchParams.set('keyword', keyword);
  if (cursor) url.searchParams.set('cursor', cursor);

  const response = await fetch(url, {
    headers: {
      'x-nxopen-api-key': API_KEY,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || '검색 요청에 실패했습니다.';
    throw new Error(message);
  }
  return {
    items: Array.isArray(data.auction_item) ? data.auction_item : [],
    nextCursor: data.next_cursor || null,
  };
}

async function fetchAllAuctionItems(keyword) {
  const allItems = [];
  let cursor = null;

  do {
    const result = await searchAuction(keyword, cursor);
    allItems.push(...result.items);
    cursor = result.nextCursor;
    statusEl.textContent = cursor
      ? `"${keyword}" 검색 결과를 수집 중입니다… ${allItems.length}건`
      : `"${keyword}" 검색 결과를 모두 불러왔습니다. ${allItems.length}건`;
  } while (cursor);

  return allItems;
}

async function runSearch(keyword, pushToUrl = true) {
  state.keyword = keyword;
  state.items = [];
  statusEl.textContent = '검색 중입니다…';
  setEmpty('검색 중입니다…');
  closeModal();
  if (pushToUrl) {
    syncStateToUrl();
  }

  try {
    const items = await fetchAllAuctionItems(keyword);
    addRecentSearch(keyword);
    if (!items.length) {
      statusEl.textContent = '검색 결과가 없습니다.';
      setEmpty('검색 결과가 없습니다.');
      return;
    }

    state.items = items;
    state.selectedIndex = 0;
    renderResults();
    syncStateToUrl();
    statusEl.textContent = `"${keyword}" 검색 결과입니다.`;
  } catch (error) {
    statusEl.textContent = `오류: ${error.message}`;
    setEmpty('검색 결과를 불러오지 못했습니다.');
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const keyword = keywordInput.value.trim();
  if (!keyword) {
    statusEl.textContent = '검색어를 입력해 주세요.';
    setEmpty('검색 결과가 없습니다.');
    return;
  }

  await runSearch(keyword, true);
});

sortSelectEl.addEventListener('change', () => {
  saveSortPreference();
  syncStateToUrl();
  if (!state.items.length) return;
  renderResults();
});

priceMinEl.addEventListener('change', () => {
  state.priceMin = parsePrice(priceMinEl.value);
  setPriceInputsFromState();
  syncStateToUrl();
  if (!state.items.length) return;
  renderResults();
});

priceMinEl.addEventListener('input', () => {
  state.priceMin = parsePrice(priceMinEl.value);
  syncStateToUrl();
  if (!state.items.length) return;
  renderResults();
});

priceMaxEl.addEventListener('change', () => {
  state.priceMax = parsePrice(priceMaxEl.value);
  setPriceInputsFromState();
  syncStateToUrl();
  if (!state.items.length) return;
  renderResults();
});

priceMaxEl.addEventListener('input', () => {
  state.priceMax = parsePrice(priceMaxEl.value);
  syncStateToUrl();
  if (!state.items.length) return;
  renderResults();
});

function commitOptionFilters({ refreshOptionFilters = false } = {}) {
  state.optionFilters = (state.optionFilters.length ? state.optionFilters : [createOptionFilter()]).slice(0, 5).map(createOptionFilter);
  syncStateToUrl();
  if (state.items.length) renderResults({ refreshOptionFilters });
}

if (optionMatchAnyEl) {
  optionMatchAnyEl.addEventListener('change', () => {
    state.optionMatchAny = optionMatchAnyEl.checked;
    commitOptionFilters();
  });
}

if (optionAddEl) {
  optionAddEl.addEventListener('click', () => {
    if (state.optionFilters.length >= 5) return;
    state.optionFilters = [...state.optionFilters, createOptionFilter()];
    commitOptionFilters({ refreshOptionFilters: true });
  });
}

if (optionFilterListEl) {
  optionFilterListEl.addEventListener('input', (event) => {
    const row = event.target.closest('.option-filter-row');
    if (!row) return;
    const index = Number(row.dataset.optionIndex);
    const key = event.target.dataset.optionKey;
    if (!Number.isInteger(index) || !key) return;
    updateOptionFilter(index, { [key]: parseOptionValue(key, event.target.value) });
    commitOptionFilters({ refreshOptionFilters: false });
  });

  optionFilterListEl.addEventListener('change', (event) => {
    const row = event.target.closest('.option-filter-row');
    if (!row) return;
    const index = Number(row.dataset.optionIndex);
    const key = event.target.dataset.optionKey;
    if (!Number.isInteger(index) || !key) return;
    updateOptionFilter(index, { [key]: parseOptionValue(key, event.target.value) });
    commitOptionFilters({ refreshOptionFilters: false });
  });

  optionFilterListEl.addEventListener('click', (event) => {
    const removeButton = event.target.closest('.option-remove');
    if (!removeButton) return;
    const row = removeButton.closest('.option-filter-row');
    if (!row) return;
    const index = Number(row.dataset.optionIndex);
    if (!Number.isInteger(index)) return;
    if (state.optionFilters.length <= 1) {
      state.optionFilters = [createOptionFilter()];
    } else {
      state.optionFilters = state.optionFilters.filter((_, i) => i !== index);
    }
    commitOptionFilters({ refreshOptionFilters: true });
  });
}

if (filterResetEl) {
  filterResetEl.addEventListener('click', resetFilters);
}

if (optionResetEl) {
  optionResetEl.addEventListener('click', resetOptionFilters);
}

if (filterSaveEl) {
  filterSaveEl.addEventListener('click', () => addSavedFilter());
}

favoriteAddEl.addEventListener('click', () => {
  const keyword = keywordInput.value.trim() || state.keyword;
  if (!keyword) return;
  addFavorite(keyword);
});

favoriteListEl.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-keyword]');
  if (!chip) return;
  const keyword = chip.dataset.keyword;
  if (event.target.closest('.pill-remove')) {
    removeFavorite(keyword);
    return;
  }
  if (event.target.closest('.favorite-open')) {
    keywordInput.value = keyword;
    runSearch(keyword, true);
  }
});

if (recentListEl) {
  recentListEl.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-recent]');
    if (!chip) return;
    const keyword = chip.dataset.recent;
    if (event.target.closest('.pill-remove')) {
      removeRecentSearch(keyword);
      return;
    }
    if (event.target.closest('.recent-open')) {
      keywordInput.value = keyword;
      runSearch(keyword, true);
    }
  });
}

categoryFilterListEl.addEventListener('click', (event) => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  state.categoryFilter = button.dataset.category;
  syncStateToUrl();
  renderResults();
});

if (savedFilterListEl) {
  savedFilterListEl.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-filter-index]');
    if (!chip) return;
    const index = Number(chip.dataset.filterIndex);
    const snapshot = state.savedFilters[index];
    if (!snapshot) return;
    if (event.target.closest('.pill-remove')) {
      removeSavedFilter(index);
      return;
    }
    if (event.target.closest('.saved-filter-open')) {
      keywordInput.value = snapshot.keyword;
      sortSelectEl.value = snapshot.sort || 'registered';
      state.categoryFilter = snapshot.category || 'all';
      state.priceMin = snapshot.priceMin || '';
      state.priceMax = snapshot.priceMax || '';
      state.optionMatchAny = Boolean(snapshot.optionMatchAny);
      state.optionFilters = Array.isArray(snapshot.optionFilters) && snapshot.optionFilters.length
        ? snapshot.optionFilters.slice(0, 5).map(createOptionFilter)
        : [createOptionFilter()];
      setPriceInputsFromState();
      if (snapshot.keyword) runSearch(snapshot.keyword, true);
      else if (state.items.length) renderResults();
    }
  });
}

resultsEl.addEventListener('click', (event) => {
  const button = event.target.closest('.result-button');
  if (!button) return;
  const index = Number(button.dataset.index);
  const item = state.visibleItems[index];
  if (!item) return;
  if (isCompactLayout()) {
    openModal(item);
    return;
  }
  state.selectedIndex = index;
  renderResults();
});

modalCloseEl.addEventListener('click', closeModal);
modalBackdropEl.addEventListener('click', closeModal);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modalEl.classList.contains('hidden')) {
    closeModal();
  }
});

let layoutMode = isCompactLayout();
window.addEventListener('resize', () => {
  const nextMode = isCompactLayout();
  if (nextMode !== layoutMode) {
    layoutMode = nextMode;
    if (state.items.length) renderResults();
  }
});

state.favorites = loadFavorites();
state.recentSearches = loadRecentSearches();
state.savedFilters = loadSavedFilters();
sortSelectEl.value = loadSortPreference();
renderFavorites();
renderRecentSearches();
renderSavedFilters();

const initialKeyword = applyUrlState();
if (initialKeyword) {
  keywordInput.value = initialKeyword;
  runSearch(initialKeyword, false);
} else {
  setEmpty('검색 결과가 없습니다.');
}
