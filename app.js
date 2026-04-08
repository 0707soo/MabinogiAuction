const API_URL = 'https://open.api.nexon.com/mabinogi/v1/auction/keyword-search';
const API_KEY = 'live_f5410ee0ae6feccbb5afdbc8e103b29648248b8e25600696d7c30c1e743a1f3eefe8d04e6d233bd35cf2fabdeb93fb0d';

const form = document.getElementById('search-form');
const keywordInput = document.getElementById('keyword');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const resultCountEl = document.getElementById('result-count');
const sortSelectEl = document.getElementById('sort-select');
const loadMoreEl = document.getElementById('load-more');
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
  nextCursor: null,
  loadingMore: false,
};

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

function setEmpty(message) {
  resultsEl.innerHTML = `<li class="empty">${escapeHtml(message)}</li>`;
  resultCountEl.textContent = '0건';
  loadMoreEl.classList.add('hidden');
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

function formatOption(option) {
  const parts = [option.option_type];
  if (option.option_sub_type) parts.push(option.option_sub_type);
  const label = parts.join(' ');
  const values = [option.option_value, option.option_value2].filter(Boolean).join(' / ');
  const desc = option.option_desc ? ` (${option.option_desc})` : '';
  return values ? `${label}: ${values}${desc}` : `${label}${desc}`;
}

function parseRgb(value) {
  const parts = String(value || '')
    .split(',')
    .map((part) => Number(part.trim()));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }
  return parts.map((part) => Math.max(0, Math.min(255, part)));
}

function hasDetail(item) {
  const { colorOptions, otherOptions } = splitOptions(item.item_option || []);
  return colorOptions.length > 0 || otherOptions.length > 0;
}

function getSortedItems(items) {
  const mode = sortSelectEl.value;
  return [...items].sort((a, b) => {
    if (mode === 'priceAsc') return (a.auction_price_per_unit ?? 0) - (b.auction_price_per_unit ?? 0);
    if (mode === 'priceDesc') return (b.auction_price_per_unit ?? 0) - (a.auction_price_per_unit ?? 0);
    return new Date(a.date_auction_expire || 0).getTime() - new Date(b.date_auction_expire || 0).getTime();
  });
}

function updateLoadMore() {
  if (state.nextCursor) {
    loadMoreEl.classList.remove('hidden');
    loadMoreEl.disabled = state.loadingMore;
    loadMoreEl.textContent = state.loadingMore ? '불러오는 중…' : '더 불러오기';
  } else {
    loadMoreEl.classList.add('hidden');
  }
}

function renderResults() {
  const items = getSortedItems(state.items);
  resultCountEl.textContent = `${items.length}건`;
  resultsEl.innerHTML = items
    .map((item, index) => {
      const itemName = item.item_display_name || item.item_name || '이름 없음';
      const category = item.auction_item_category || '분류 없음';
      const count = item.item_count ?? 0;
      const price = item.auction_price_per_unit ?? 0;
      const expire = item.date_auction_expire ? formatExpire(item.date_auction_expire) : '만료 정보 없음';
      const expireAbsolute = item.date_auction_expire ? formatAbsoluteKST(item.date_auction_expire) : '만료 정보 없음';
      const { colorOptions, otherOptions } = splitOptions(item.item_option || []);
      const detailAvailable = colorOptions.length > 0 || otherOptions.length > 0;
      const detailBadge = detailAvailable ? '<span class="detail-badge">옵션</span>' : '';
      const quantityMeta = count > 1 ? `<span>수량: ${escapeHtml(count)}</span>` : '';

      if (!detailAvailable) {
        return `
          <li>
            <div class="result-item result-item-static">
              <div class="result-top">
                <div class="result-heading">
                  <p class="result-title">${escapeHtml(itemName)}</p>
                  ${detailBadge}
                </div>
                <span class="result-price">${escapeHtml(formatPrice(price))}</span>
              </div>
              <div class="result-meta">
                <span>분류: ${escapeHtml(category)}</span>
                ${quantityMeta}
                <span title="${escapeHtml(expireAbsolute)} KST">만료: ${escapeHtml(expire)}</span>
              </div>
            </div>
          </li>
        `;
      }

      return `
        <li>
          <button class="result-button" type="button" data-index="${index}">
            <div class="result-item result-item-detail">
              <div class="result-top">
                <div class="result-heading">
                  <p class="result-title">${escapeHtml(itemName)}</p>
                  ${detailBadge}
                </div>
                <span class="result-price">${escapeHtml(formatPrice(price))}</span>
              </div>
              <div class="result-meta">
                <span>분류: ${escapeHtml(category)}</span>
                ${quantityMeta}
                <span title="${escapeHtml(expireAbsolute)} KST">만료: ${escapeHtml(expire)}</span>
              </div>
            </div>
          </button>
        </li>
      `;
    })
    .join('');

  updateLoadMore();
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
        const rgb = parseRgb(option.option_value);
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

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const keyword = keywordInput.value.trim();
  if (!keyword) {
    statusEl.textContent = '검색어를 입력해 주세요.';
    setEmpty('검색 결과가 없습니다.');
    return;
  }

  state.keyword = keyword;
  state.items = [];
  state.nextCursor = null;
  state.loadingMore = false;
  statusEl.textContent = '검색 중입니다…';
  setEmpty('검색 중입니다…');
  closeModal();

  try {
    const result = await searchAuction(keyword);
    if (!result.items.length) {
      statusEl.textContent = '검색 결과가 없습니다.';
      setEmpty('검색 결과가 없습니다.');
      return;
    }

    state.items = result.items;
    state.nextCursor = result.nextCursor;
    statusEl.textContent = `"${keyword}" 검색 결과입니다. ${state.nextCursor ? '더 불러오기가 가능합니다.' : ''}`.trim();
    renderResults();
  } catch (error) {
    statusEl.textContent = `오류: ${error.message}`;
    setEmpty('검색 결과를 불러오지 못했습니다.');
  }
});

sortSelectEl.addEventListener('change', () => {
  if (!state.items.length) return;
  renderResults();
});

loadMoreEl.addEventListener('click', async () => {
  if (!state.keyword || !state.nextCursor || state.loadingMore) return;
  state.loadingMore = true;
  updateLoadMore();

  try {
    const result = await searchAuction(state.keyword, state.nextCursor);
    state.items = state.items.concat(result.items);
    state.nextCursor = result.nextCursor;
    statusEl.textContent = `"${state.keyword}" 검색 결과 ${state.items.length}건을 불러왔습니다.`;
    renderResults();
  } catch (error) {
    statusEl.textContent = `추가 불러오기 실패: ${error.message}`;
    updateLoadMore();
  } finally {
    state.loadingMore = false;
    updateLoadMore();
  }
});

resultsEl.addEventListener('click', (event) => {
  const button = event.target.closest('.result-button');
  if (!button) return;
  const index = Number(button.dataset.index);
  const item = getSortedItems(state.items)[index];
  if (!item || !hasDetail(item)) return;
  openModal(item);
});

modalCloseEl.addEventListener('click', closeModal);
modalBackdropEl.addEventListener('click', closeModal);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modalEl.classList.contains('hidden')) {
    closeModal();
  }
});

setEmpty('검색 결과가 없습니다.');
