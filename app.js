const STORAGE = {
  customDeals: 'teacher-treasure.customDeals.v1',
  favorites: 'teacher-treasure.favorites.v1',
  alerts: 'teacher-treasure.alerts.v1',
  reports: 'teacher-treasure.reports.v1'
};

const state = {
  deals: [],
  favorites: new Set(JSON.parse(localStorage.getItem(STORAGE.favorites) || '[]')),
  favoritesOnly: false
};

const els = {
  grid: document.querySelector('#dealGrid'),
  empty: document.querySelector('#emptyState'),
  search: document.querySelector('#searchInput'),
  category: document.querySelector('#categoryFilter'),
  type: document.querySelector('#typeFilter'),
  location: document.querySelector('#locationFilter'),
  sort: document.querySelector('#sortFilter'),
  resultsCount: document.querySelector('#resultsCount'),
  resultsTitle: document.querySelector('#resultsTitle'),
  favoriteCount: document.querySelector('#favoriteCount'),
  submitDialog: document.querySelector('#submitDialog'),
  alertsDialog: document.querySelector('#alertsDialog'),
  dealForm: document.querySelector('#dealForm'),
  alertsForm: document.querySelector('#alertsForm'),
  toast: document.querySelector('#toast'),
  scoutLinks: document.querySelector('#scoutLinks')
};

function getCustomDeals() {
  try { return JSON.parse(localStorage.getItem(STORAGE.customDeals) || '[]'); }
  catch { return []; }
}

function saveFavorites() {
  localStorage.setItem(STORAGE.favorites, JSON.stringify([...state.favorites]));
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
  } catch { return '#'; }
}

function formatDate(value) {
  if (!value) return 'No deadline listed';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? 'Check deadline' : `Ends ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function daysUntil(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  return (new Date(`${value}T23:59:59`) - new Date()) / 86400000;
}

function uniqueCategories() {
  return [...new Set(state.deals.map(deal => deal.category).filter(Boolean))].sort();
}

function populateCategories() {
  const selected = els.category.value || 'all';
  els.category.innerHTML = '<option value="all">All categories</option>' + uniqueCategories().map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('');
  els.category.value = uniqueCategories().includes(selected) ? selected : 'all';

  const alertCategories = document.querySelector('#alertCategories');
  const saved = JSON.parse(localStorage.getItem(STORAGE.alerts) || '{}');
  alertCategories.innerHTML = uniqueCategories().map(cat => `<label><input type="checkbox" name="categories" value="${escapeHtml(cat)}" ${saved.categories?.includes(cat) ? 'checked' : ''}/> ${escapeHtml(cat)}</label>`).join('');
}

function filteredDeals() {
  const query = els.search.value.trim().toLowerCase();
  const filtered = state.deals.filter(deal => {
    const haystack = [deal.title, deal.organization, deal.description, deal.category, deal.region, deal.type].join(' ').toLowerCase();
    return (!query || haystack.includes(query))
      && (els.category.value === 'all' || deal.category === els.category.value)
      && (els.type.value === 'all' || deal.type === els.type.value)
      && (els.location.value === 'all' || deal.locationType === els.location.value)
      && (!state.favoritesOnly || state.favorites.has(deal.id));
  });

  return filtered.sort((a, b) => {
    if (els.sort.value === 'ending') return daysUntil(a.expires) - daysUntil(b.expires);
    if (els.sort.value === 'popular') return (b.saves || 0) - (a.saves || 0);
    return String(b.created || '').localeCompare(String(a.created || ''));
  });
}

function cardTemplate(deal) {
  const isSaved = state.favorites.has(deal.id);
  const typeClass = `badge-${String(deal.type).toLowerCase()}`;
  return `<article class="deal-card">
    <div class="card-top">
      <div class="badges">
        <span class="badge ${typeClass}">${escapeHtml(deal.type)}</span>
        ${deal.verified ? '<span class="badge badge-verified">✓ Verified</span>' : ''}
      </div>
      <button class="save-btn ${isSaved ? 'saved' : ''}" type="button" data-save="${escapeHtml(deal.id)}" aria-label="${isSaved ? 'Remove from saved deals' : 'Save deal'}">${isSaved ? '★' : '☆'}</button>
    </div>
    <div class="card-body">
      <p class="card-org">${escapeHtml(deal.organization)}</p>
      <h3>${escapeHtml(deal.title)}</h3>
      <p class="card-description">${escapeHtml(deal.description)}</p>
      <div class="card-meta">
        <span>${escapeHtml(deal.category)}</span>
        <span>${escapeHtml(deal.locationType)} · ${escapeHtml(deal.region || 'See details')}</span>
        <span>${escapeHtml(formatDate(deal.expires))}</span>
        <span>${Number(deal.saves || 0)} community saves</span>
      </div>
      <div class="card-actions">
        <a class="btn btn-primary" href="${safeUrl(deal.url)}" target="_blank" rel="noopener noreferrer">View offer</a>
        <button class="btn btn-ghost report-btn" type="button" data-report="${escapeHtml(deal.id)}" aria-label="Report this deal">⚑</button>
      </div>
    </div>
  </article>`;
}

function updateStats() {
  document.querySelector('#dealCount').textContent = state.deals.length;
  document.querySelector('#freeCount').textContent = state.deals.filter(deal => deal.type === 'Free').length;
  document.querySelector('#verifiedCount').textContent = state.deals.filter(deal => deal.verified).length;
  els.favoriteCount.textContent = state.favorites.size;
}

function updateScoutLinks() {
  const query = els.search.value.trim() || 'teacher freebies discounts giveaways';
  const searches = [
    ['Google', `https://www.google.com/search?q=${encodeURIComponent(query + ' for teachers')}`],
    ['Google News', `https://news.google.com/search?q=${encodeURIComponent(query + ' teachers')}`],
    ['DonorsChoose', `https://www.google.com/search?q=${encodeURIComponent('site:donorschoose.org ' + query)}`],
    ['Local Fort Worth', `https://www.google.com/search?q=${encodeURIComponent(query + ' Fort Worth TX teachers')}`]
  ];
  els.scoutLinks.innerHTML = searches.map(([name, url]) => `<a class="scout-link" target="_blank" rel="noopener noreferrer" href="${url}"><span>${name}</span><span>↗</span></a>`).join('');
}

function render() {
  const deals = filteredDeals();
  els.grid.innerHTML = deals.map(cardTemplate).join('');
  els.empty.hidden = deals.length !== 0;
  els.grid.hidden = deals.length === 0;
  els.resultsCount.textContent = `${deals.length} result${deals.length === 1 ? '' : 's'}`;
  els.resultsTitle.textContent = state.favoritesOnly ? 'Saved teacher deals' : 'Teacher deals';
  updateStats();
  updateScoutLinks();
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove('show'), 2600);
}

function openDialog(dialog) {
  if (typeof dialog.showModal === 'function') dialog.showModal();
}

async function loadDeals() {
  let seedDeals = [];
  try {
    const response = await fetch('data/deals.json');
    if (!response.ok) throw new Error('Could not load seed data');
    seedDeals = await response.json();
  } catch {
    toast('Demo listings could not load. You can still add your own deals.');
  }
  state.deals = [...getCustomDeals(), ...seedDeals];
  populateCategories();
  render();
}

['input', 'change'].forEach(eventName => {
  [els.search, els.category, els.type, els.location, els.sort].forEach(control => control.addEventListener(eventName, render));
});

document.querySelector('#clearFilters').addEventListener('click', () => {
  els.search.value = '';
  els.category.value = 'all';
  els.type.value = 'all';
  els.location.value = 'all';
  els.sort.value = 'newest';
  state.favoritesOnly = false;
  render();
});

document.querySelector('#favoritesToggle').addEventListener('click', () => {
  state.favoritesOnly = !state.favoritesOnly;
  render();
});

document.querySelectorAll('#openSubmit, #emptyAdd').forEach(button => button.addEventListener('click', () => openDialog(els.submitDialog)));
document.querySelector('#openAlerts').addEventListener('click', () => {
  const saved = JSON.parse(localStorage.getItem(STORAGE.alerts) || '{}');
  els.alertsForm.elements.email.value = saved.email || '';
  populateCategories();
  openDialog(els.alertsDialog);
});

document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => els.submitDialog.close()));
document.querySelectorAll('.close-alerts').forEach(button => button.addEventListener('click', () => els.alertsDialog.close()));

els.grid.addEventListener('click', event => {
  const saveButton = event.target.closest('[data-save]');
  if (saveButton) {
    const id = saveButton.dataset.save;
    state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
    saveFavorites();
    render();
    toast(state.favorites.has(id) ? 'Deal saved.' : 'Deal removed from saved list.');
    return;
  }
  const reportButton = event.target.closest('[data-report]');
  if (reportButton) {
    const reports = JSON.parse(localStorage.getItem(STORAGE.reports) || '[]');
    if (!reports.includes(reportButton.dataset.report)) reports.push(reportButton.dataset.report);
    localStorage.setItem(STORAGE.reports, JSON.stringify(reports));
    toast('Thanks. This deal was marked for review on this device.');
  }
});

els.dealForm.addEventListener('submit', event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(els.dealForm));
  const deal = {
    ...data,
    id: `local-${Date.now()}`,
    created: new Date().toISOString().slice(0, 10),
    verified: false,
    saves: 0
  };
  const custom = getCustomDeals();
  custom.unshift(deal);
  localStorage.setItem(STORAGE.customDeals, JSON.stringify(custom));
  state.deals.unshift(deal);
  els.dealForm.reset();
  els.submitDialog.close();
  populateCategories();
  render();
  toast('Deal added to your local tracker.');
});

els.alertsForm.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(els.alertsForm);
  const preferences = { email: data.get('email') || '', categories: data.getAll('categories') };
  localStorage.setItem(STORAGE.alerts, JSON.stringify(preferences));
  els.alertsDialog.close();
  toast('Alert preferences saved on this device.');
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}

loadDeals();
