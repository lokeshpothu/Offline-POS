import { store } from './offlineStore';
import { seedCatalogIfEmpty } from './catalogSeed';
import { calcLine, calcOrder, createOrderFromCart, updateOrderStatus } from './orderDomain';
import { printManager } from './printManager';
import { syncEngine } from './syncEngine';
import { notify } from './toast';

const state = {
  q: '',
  category: '',
  products: [],
  categories: [],
  cart: { lines: [] },
  selectedSku: null,
  orders: [],
  syncStatus: { state: 'init' },
  view: 'pos'
};

function $(sel){ return document.querySelector(sel); }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

function render(){
  const app = $('#app');
  app.innerHTML = `
  <div class="container">
    <div class="header">
      <div class="brand">
        <div style="width:12px;height:12px;border-radius:4px;background:var(--accent)"></div>
        <div>
          <div style="font-weight:800;font-size:18px">Offline POS System</div>
          <div class="small">Offline-first order taking, print queue, and sync</div>
        </div>
      </div>
      <div class="row">
        ${renderSyncBadge()}
        <div class="badge">
          <span class="small">Shortcuts:</span>
          <span class="kbd">Ctrl/⌘K</span><span class="kbd">Ctrl/⌘N</span><span class="kbd">Ctrl/⌘P</span>
        </div>
        <button class="primary" id="btnSync">Sync now</button>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="row" style="justify-content:space-between">
          <h2 style="margin:0">Product Catalog</h2>
          <div class="small">1000+ items ready (seeded locally)</div>
        </div>
        <div class="row" style="margin:10px 0">
          <input id="search" placeholder="Search products / SKU" style="flex:1; min-width: 220px" value="${escapeHtml(state.q)}" />
          <select id="category">
            <option value="">All Categories</option>
            ${state.categories.map(c => `<option ${c===state.category?'selected':''} value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
          </select>
          <button id="btnAddSelected" ${state.selectedSku? '' : 'disabled'}>Add</button>
        </div>
        <div class="list" id="products" style="max-height: 420px; overflow:auto; padding-right: 6px"></div>
        <div class="small" style="margin-top:8px">Tip: tap an item → customize size/add-ons → Add</div>
      </div>

      <div class="card">
        <div class="row" style="justify-content:space-between">
          <h2 style="margin:0">Cart</h2>
          <button id="btnNew" class="primary">New Order</button>
        </div>
        <div id="cartLines" class="list" style="margin-top:10px"></div>
        ${renderTotals()}
        <div class="row" style="margin-top:10px">
          <button id="btnPlace" class="primary" ${state.cart.lines.length? '' : 'disabled'} style="flex:1">Place Order</button>
          <button id="btnPrint" ${state.cart.lines.length? '' : 'disabled'}>Print</button>
        </div>
        <div class="small" style="margin-top:8px">Touch friendly + keyboard ready</div>
      </div>
    </div>

    <div class="split" style="margin-top:14px">
      <div class="card">
        <div class="row" style="justify-content:space-between">
          <h2 style="margin:0">Orders</h2>
          <div class="small">Workflow: pending → preparing → ready → completed</div>
        </div>
        <div style="overflow:auto; max-height: 320px">
          <table class="table">
            <thead><tr><th>ID</th><th>Status</th><th>Total</th><th>Actions</th></tr></thead>
            <tbody id="ordersTable"></tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="row" style="justify-content:space-between">
          <h2 style="margin:0">Print Queue</h2>
          <div class="row">
            <button id="btnProcessPrint">Process</button>
            <button id="btnClearPrint" class="danger">Clear done</button>
          </div>
        </div>
        <div style="overflow:auto; max-height: 320px">
          <table class="table">
            <thead><tr><th>Job</th><th>Dest</th><th>Status</th><th>Attempts</th></tr></thead>
            <tbody id="printTable"></tbody>
          </table>
        </div>
        <div class="small">Jobs persist across refresh. Failures auto re-queue.</div>
      </div>
    </div>

    <div class="footer">
      <div class="small">Local storage: IndexedDB. Sync: REST API (mock server included). Prints: ESC/POS demo builder.</div>
      <div class="small">If offline, actions are queued and synced later.</div>
    </div>
  </div>
  `;

  renderProducts();
  renderCart();
  renderOrders();
  renderPrintJobs();
  bindHandlers();
}

function renderSyncBadge(){
  const s = state.syncStatus?.state || 'init';
  const map = {
    offline:['warn','OFFLINE'],
    syncing:['ok','SYNCING'],
    synced:['ok','SYNCED'],
    error:['danger','ERROR'],
    init:['warn','INIT']
  };
  const [cls, label] = map[s] || ['warn', s.toUpperCase()];
  const hint = state.syncStatus?.reason
    ? ` • ${escapeHtml(state.syncStatus.reason)}`
    : '';
  const last = state.syncStatus?.at
    ? ` • Last synced: ${new Date(state.syncStatus.at).toLocaleString()}`
    : '';

  return `
    <div class="badge">
      <span class="pill ${cls}">${label}</span>
      <span class="small">
        ${navigator.onLine ? 'online' : 'offline'}
        ${hint}
        ${s === 'synced' ? last : ''}
      </span>
    </div>
  `;
}

function renderTotals(){
  const totals = calcOrder(state.cart.lines);
  return `
  <div style="margin-top:10px" class="item">
    <div class="meta">
      <div class="name">Totals</div>
      <div class="sub">Includes 5% tax (demo)</div>
    </div>
    <div style="text-align:right">
      <div class="small">Subtotal: <strong>${totals.subtotal.toFixed(2)}</strong></div>
      <div class="small">Tax: <strong>${totals.tax.toFixed(2)}</strong></div>
      <div><strong>${totals.total.toFixed(2)}</strong></div>
    </div>
  </div>`;
}

function renderProducts() {
  const root = $('#products');
  if (!root) return;

  const total = state.products.length;
  const visible = state.products.slice(0, 80);

  // Render visible products
  root.innerHTML = visible.map(p => `
    <div class="item" data-sku="${escapeHtml(p.sku)}">
      <div class="meta">
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="sub">
          ${escapeHtml(p.category)} • ${escapeHtml(p.sku)} • ${p.basePrice.toFixed(2)}
        </div>
      </div>
      <div class="row">
        <span class="pill">${p.options.sizes.map(s => s.label).join('/')}</span>
        <button data-act="select" data-sku="${escapeHtml(p.sku)}">
          Customize
        </button>
      </div>
    </div>
  `).join('');

  if (total > 0) {
    root.innerHTML += `
      <div class="small" style="margin-top:8px">
        Showing <strong>${Math.min(80, total)}</strong> of
        <strong>${total}</strong> filtered results.
        Refine search or category to narrow further.
      </div>
    `;
  }
}


function renderCart(){
  const root = $('#cartLines');
  if (!root) return;
  if (!state.cart.lines.length){
    root.innerHTML = `<div class="small">Cart empty. Select products to add.</div>`;
    return;
  }
  root.innerHTML = state.cart.lines.map((l, idx) => `
    <div class="item">
      <div class="meta">
        <div class="name">${escapeHtml(l.name)} <span class="pill">${escapeHtml(l.size)}</span></div>
        <div class="sub">Add-ons: ${escapeHtml(l.addons.join(', ') || 'None')} ${l.specialRequest? ' • Note: '+escapeHtml(l.specialRequest): ''}</div>
      </div>
      <div class="row">
        <button data-act="dec" data-idx="${idx}">-</button>
        <span><strong>${l.qty}</strong></span>
        <button data-act="inc" data-idx="${idx}">+</button>
        <span style="min-width:70px; text-align:right"><strong>${l.lineTotal.toFixed(2)}</strong></span>
        <button class="danger" data-act="rm" data-idx="${idx}">Remove</button>
      </div>
    </div>
  `).join('');
}

function renderOrders(){
  const tb = $('#ordersTable');
  if (!tb) return;
  tb.innerHTML = state.orders.slice(0, 40).map(o => `
    <tr>
      <td>${escapeHtml(o.id.slice(-8))}</td>
      <td><span class="pill ${statusClass(o.status)}">${escapeHtml(o.status)}</span></td>
      <td>${Number(o.total||0).toFixed(2)}</td>
      <td>
        <div class="row">
          <button data-act="st" data-id="${escapeHtml(o.id)}" data-next="preparing" ${o.status!=='pending'?'disabled':''}>Preparing</button>
          <button data-act="st" data-id="${escapeHtml(o.id)}" data-next="ready" ${o.status!=='preparing'?'disabled':''}>Ready</button>
          <button data-act="st" data-id="${escapeHtml(o.id)}" data-next="completed" ${o.status!=='ready'?'disabled':''}>Complete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function statusClass(s){
  if (s==='pending') return 'warn';
  if (s==='completed') return 'ok';
  return 'ok';
}

async function renderPrintJobs(){
  const tb = $('#printTable');
  if (!tb) return;
  const jobs = await printManager.list();
  tb.innerHTML = jobs.slice(0, 40).map(j => `
    <tr>
      <td>${escapeHtml(j.id.slice(-8))}</td>
      <td>${escapeHtml(j.destination)}</td>
      <td><span class="pill ${j.status==='done'?'ok':(j.lastError?'danger':'warn')}">${escapeHtml(j.status)}</span></td>
      <td>${j.attempts}</td>
    </tr>
  `).join('') || `<tr><td colspan="4" class="small">No jobs</td></tr>`;
}

function bindHandlers(){
  $('#search').addEventListener('input', async (e) => {
    state.q = e.target.value;
    await refreshProducts();
  });
  $('#category').addEventListener('change', async (e) => {
    state.category = e.target.value;
    await refreshProducts();
  });

  $('#btnAddSelected').addEventListener('click', () => {
    if (!state.selectedSku) return;
    openCustomize(state.selectedSku);
  });

  $('#btnNew').addEventListener('click', () => {
    state.cart.lines = [];
    state.selectedSku = null;
    render();
  });

  $('#btnPlace').addEventListener('click', async () => {
    const order = await createOrderFromCart(state.cart);
    notify('Order placed', `Order ${order.id.slice(-8)} (${order.status})`);
    state.cart.lines = [];
    await refreshOrders();
    render();
  });

  $('#btnPrint').addEventListener('click', async () => {
    // print current cart as a "preview receipt" job
    const totals = calcOrder(state.cart.lines);
    const order = { id: 'preview', lines: state.cart.lines, ...totals };
    await printManager.enqueue({ destination:'receipt', priority: 3, payload: { order } });
    await renderPrintJobs();
  });

  $('#btnProcessPrint').addEventListener('click', async () => {
    await printManager.processOnce();
    await renderPrintJobs();
  });

  $('#btnClearPrint').addEventListener('click', async () => {
    await printManager.clearDone();
    await renderPrintJobs();
  });

  $('#btnSync').addEventListener('click', async () => {
    await syncEngine.kick('manual');
    await refreshSyncStatus();
    render();
  });

  // product list delegate
  $('#products').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act="select"]');
    if (!btn) return;
    const sku = btn.getAttribute('data-sku');
    openCustomize(sku);
  });

  // cart delegate
  $('#cartLines').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const act = b.getAttribute('data-act');
    const idx = Number(b.getAttribute('data-idx'));
    if (!Number.isFinite(idx)) return;
    const line = state.cart.lines[idx];
    if (!line) return;
    if (act==='inc'){ line.qty += 1; line.lineTotal = line.unitPrice * line.qty; }
    if (act==='dec'){ line.qty = Math.max(1, line.qty-1); line.lineTotal = line.unitPrice * line.qty; }
    if (act==='rm'){ state.cart.lines.splice(idx,1); }
    renderCart(); $('#app').querySelector('.card:nth-child(2)')?.querySelector('.item') && render();
    // cheap rerender
    render();
  });

  // orders delegate
  $('#ordersTable').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-act="st"]');
    if (!b) return;
    const id = b.getAttribute('data-id');
    const next = b.getAttribute('data-next');
    const order = await updateOrderStatus(id, next);
    if (order) notify('Order updated', `${id.slice(-8)} → ${order.status}`);
    await refreshOrders();
    render();
  });

  // keyboard shortcuts
  window.onkeydown = (e) => {
    const meta = e.metaKey || e.ctrlKey;
    if (meta && e.key.toLowerCase() === "k") {
      e.preventDefault();
      setTimeout(() => $("#search")?.focus(), 0);
    }
    if (meta && e.key.toLowerCase() === "n") {
      e.preventDefault();
      state.cart.lines = [];
      notify("New order", "Cart cleared");
      render();
    }
    if (meta && e.key.toLowerCase() === "p") {
      e.preventDefault();
      $("#btnPrint").click();
    }
  };
}

async function openCustomize(sku) {
  const product = state.products.find(p => p.sku === sku) 
    || (await store.get('products', sku));
  if (!product) return;

  const sizeInput = prompt(
    `Size (${product.options.sizes.map(s => s.label).join('/')})`,
    'M'
  );
  if (sizeInput === null) return;

  const addonsInput = prompt(
    `Add-ons (comma separated): ${product.options.addons.map(a => a.label).join(', ')}`,
    ''
  );
  if (addonsInput === null) return;

  const qtyInput = prompt('Quantity', '1');
  if (qtyInput === null) return;

  const noteInput = prompt('Special request (optional)', '');
  if (noteInput === null) return;

  const size = sizeInput || 'M';
  const addons = addonsInput
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const qty = Math.max(1, Number(qtyInput) || 1);

  const line = calcLine(product, {
    size,
    addons,
    qty,
    specialRequest: noteInput
  });

  state.cart.lines.push(line);
  render();
}

async function refreshProducts() {
  const rows = await store.queryProducts({
    q: state.q,
    category: state.category
  });

  state.products = rows;

  const all = await store.getAll('products');
  state.categories = Array.from(
    new Set(all.map(p => p.category))
  ).sort();

  renderProducts();
}

async function refreshOrders(){
  const orders = await store.getAll('orders');
  orders.sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));
  state.orders = orders;
}



async function refreshSyncStatus() {
  const sync = await store.getMeta('sync.status');
   state.syncStatus = sync || { state: 'init' };

  render();
}


function formatDateTime(ts) {
  if (!ts) return 'Never';
  return new Date(ts).toLocaleString();
}

export async function uiInit(){
  await seedCatalogIfEmpty();
  await refreshProducts();
  await refreshOrders();
  await refreshSyncStatus();
  bus.on('sync:status', refreshSyncStatus);
  bus.on('sync:complete', refreshSyncStatus);
  bus.on('sync:error', refreshSyncStatus);

  // refresh sync badge when local store changes
  store.on('change', async () => {
    await refreshOrders();
    await refreshSyncStatus();
  });

  // process print queue periodically
  setInterval(async () => {
    await printManager.processOnce();
    await renderPrintJobs();
  }, 5000);

  render();
}
