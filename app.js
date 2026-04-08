const API_URL = 'https://open.api.nexon.com/mabinogi/v1/auction/keyword-search';
const API_KEY = 'live_f5410ee0ae6feccbb5afdbc8e103b29648248b8e25600696d7c30c1e743a1f3eefe8d04e6d233bd35cf2fabdeb93fb0d';

const form = document.getElementById('search-form');
const keywordInput = document.getElementById('keyword');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const resultCountEl = document.getElementById('result-count');

function formatPrice(value) {
  return new Intl.NumberFormat('ko-KR').format(value) + ' 골드';
}

function formatExpire(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(navigator.language || 'ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function setEmpty(message) {
  resultsEl.innerHTML = `<li class="empty">${message}</li>`;
  resultCountEl.textContent = '0건';
}

function renderResults(items) {
  resultCountEl.textContent = `${items.length}건`;
  resultsEl.innerHTML = items
    .map((item) => {
      const itemName = item.item_display_name || item.item_name || '이름 없음';
      const category = item.auction_item_category || '분류 없음';
      const count = item.item_count ?? 0;
      const price = item.auction_price_per_unit ?? 0;
      const expire = item.date_auction_expire ? formatExpire(item.date_auction_expire) : '만료 정보 없음';
      return `
        <li class="result-item">
          <p class="result-title">${itemName}</p>
          <div class="result-meta">
            <span>분류: ${category}</span>
            <span>수량: ${count}</span>
            <span>개당 가격: ${formatPrice(price)}</span>
            <span>만료: ${expire}</span>
          </div>
        </li>
      `;
    })
    .join('');
}

async function searchAuction(keyword) {
  const url = new URL(API_URL);
  url.searchParams.set('keyword', keyword);

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
  return Array.isArray(data.auction_item) ? data.auction_item : [];
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const keyword = keywordInput.value.trim();
  if (!keyword) {
    statusEl.textContent = '검색어를 입력해 주세요.';
    setEmpty('검색 결과가 없습니다.');
    return;
  }

  statusEl.textContent = '검색 중입니다…';
  setEmpty('검색 중입니다…');

  try {
    const items = await searchAuction(keyword);
    if (!items.length) {
      statusEl.textContent = '검색 결과가 없습니다.';
      setEmpty('검색 결과가 없습니다.');
      return;
    }
    statusEl.textContent = `"${keyword}" 검색 결과입니다.`;
    renderResults(items);
  } catch (error) {
    statusEl.textContent = `오류: ${error.message}`;
    setEmpty('검색 결과를 불러오지 못했습니다.');
  }
});

setEmpty('검색 결과가 없습니다.');
