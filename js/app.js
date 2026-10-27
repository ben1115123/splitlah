import * as L from './logic.js';
import { createStore, newId } from './store.js';

const VERSION = '1.0.1';
const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
const sheetRoot = $('#sheet-root');

/* ============================== utilities ============================== */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const parseDate = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const fmtDate = (s, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => parseDate(s).toLocaleDateString('en-GB', opts);
const dayLabel = (s) => {
  if (s === today()) return 'Today';
  const y = new Date(); y.setDate(y.getDate() - 1);
  const ys = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  if (s === ys) return 'Yesterday';
  const sameYear = parseDate(s).getFullYear() === new Date().getFullYear();
  return fmtDate(s, sameYear ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
};
const timeAgo = (ms) => {
  if (!ms) return '';
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};
const hue = (id) => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => [...w][0] || '').join('').toUpperCase() || '?';
const avatar = (id, name, cls = '') => `<span class="avatar ${cls}" style="--h:${hue(id)}" aria-hidden="true">${esc(initials(name))}</span>`;
const money = (m, cur, o) => L.formatMoney(m, cur, o);

const ICON = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M16 6l-4-4-4 4M12 2v13"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
};

const CATS = {
  food: ['🍜', 'Food'], drinks: ['🧋', 'Drinks'], groceries: ['🛒', 'Groceries'], transport: ['🚕', 'Transport'],
  fuel: ['⛽', 'Petrol & tolls'], stay: ['🏨', 'Stay'], activities: ['🎟️', 'Activities'], shopping: ['🛍️', 'Shopping'],
  gifts: ['🎁', 'Gifts'], bills: ['🧾', 'Bills'], general: ['💸', 'Other'],
};
const CAT_RULES = [
  ['fuel', /\b(petrol|fuel|toll|parking|tng|touch ?n ?go|shell|petronas|caltex)\b/i],
  ['stay', /\b(hotel|airbnb|hostel|resort|villa|homestay|lodge|ryokan|accommodation|agoda)\b/i],
  ['transport', /\b(grab|taxi|uber|bus|train|mrt|lrt|ktm|ets|flight|flights|airasia|ferry|bolt|car rental|rent car|airport|shinkansen|metro|cab)\b/i],
  ['groceries', /\b(grocer(y|ies)|supermarket|7-?eleven|7-11|mart|aeon|jaya grocer|lotus|tesco|family ?mart|lawson)\b/i],
  ['drinks', /\b(drinks?|bar|beer|wine|coffee|kopi|teh|tea|boba|bubble tea|cocktails?|club|starbucks|zus|tealive)\b/i],
  ['food', /\b(lunch|dinner|breakfast|brunch|food|meal|nasi|mee|ramen|sushi|bbq|restaurant|cafe|mamak|supper|pizza|burger|steamboat|hotpot|kfc|mcd|snacks?|dessert)\b/i],
  ['activities', /\b(tickets?|tour|entry|admission|museum|theme park|show|concert|karaoke|ktv|dive|diving|snorkel|spa|massage|bowling|movie|cinema)\b/i],
  ['gifts', /\b(gift|present|birthday|angpao|ang pao)\b/i],
  ['shopping', /\b(shop|shopping|souvenirs?|mall|clothes|uniqlo)\b/i],
  ['bills', /\b(bill|electric|water|wifi|internet|rent|utilities|subscription|netflix|spotify)\b/i],
];
const guessCat = (desc) => (CAT_RULES.find(([, re]) => re.test(desc)) || ['general'])[0];
const EMOJIS = ['✈️', '🏝️', '🏔️', '🏕️', '🚗', '🎉', '🎂', '🍻', '🍜', '🏠', '💍', '🎄', '⛷️', '🎮', '⚽', '🎤', '🛳️', '🌏', '🇯🇵', '🇹🇭', '🇰🇷', '🇸🇬', '🇮🇩', '🇻🇳', '🇹🇼', '🇦🇺', '💼', '🎓', '❤️', '🧳', '📸', '🎁'];

/* ============================== state ============================== */
const S = {
  store: null,
  route: { view: 'boot' },
  prevHash: null,
  gid: null, group: null, expenses: [], gLoaded: false, eLoaded: false, missing: false, pending: false,
  unsubs: [],
  tab: 'activity', search: '', showDeleted: false,
  awaitingData: false,
  installEvt: null,
};
const myGroups = () => LS.get('splitlah.groups', []);
const saveMyGroups = (v) => LS.set('splitlah.groups', v);
const meMap = () => LS.get('splitlah.me', {});
const myId = (gid = S.gid) => meMap()[gid];
const setMe = (gid, mid) => { const m = meMap(); m[gid] = mid; LS.set('splitlah.me', m); };

function rememberGroup(gid, patch = {}) {
  const list = myGroups();
  const i = list.findIndex((g) => g.id === gid);
  if (i === -1) list.unshift({ id: gid, joinedAt: Date.now(), ...patch });
  else list[i] = { ...list[i], ...patch };
  saveMyGroups(list);
}
function forgetGroup(gid) {
  saveMyGroups(myGroups().filter((g) => g.id !== gid));
  const m = meMap(); delete m[gid]; LS.set('splitlah.me', m);
}

const members = (g = S.group) => Object.entries(g?.members || {})
  .map(([id, m]) => ({ id, ...m }))
  .sort((a, b) => (a.addedAt ?? 0) - (b.addedAt ?? 0) || String(a.name).localeCompare(b.name));
const nameOf = (id, g = S.group) => g?.members?.[id]?.name ?? 'Removed member';
const youOr = (id, cap = false) => (id === myId() ? (cap ? 'You' : 'you') : nameOf(id));
const live = () => S.expenses.filter((e) => !e.deleted);

/* ============================== action delegation ============================== */
let PAGE = {}, SHEET = {};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const reg = sheetRoot.contains(el) ? SHEET : PAGE;
  const fn = reg[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
});
const onInput = (handler) => (e) => {
  const el = e.target.closest('[data-in]');
  if (el) handler(el.dataset.in, el, e);
};

/* ============================== toast / sheets ============================== */
let toastTimer;
function toast(msg, action) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
  if (action) t.querySelector('button').onclick = () => { t.classList.remove('show'); action.fn(); };
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), action ? 5000 : 2600);
}
function openSheet(html, acts = {}, { dismissable = true, onClose } = {}) {
  SHEET = acts;
  sheetRoot.innerHTML = `<div class="sheet-backdrop" ${dismissable ? 'data-act="__close"' : ''}></div>
    <div class="sheet small" role="dialog" aria-modal="true"><div class="sheet-inner"><div class="sheet-grip"></div>${html}</div></div>`;
  if (dismissable) SHEET.__close = () => { closeSheet(); onClose?.(); };
}
function closeSheet() { sheetRoot.innerHTML = ''; SHEET = {}; }
function confirmSheet(title, body, okLabel = 'Confirm', danger = false) {
  return new Promise((resolve) => {
    openSheet(`<h2 style="font:700 21px var(--display);margin:6px 0 8px">${esc(title)}</h2>
      <p class="sub">${esc(body)}</p>
      <div class="btn-row"><button class="btn" data-act="no">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-act="yes">${esc(okLabel)}</button></div>`,
    { no: () => { closeSheet(); resolve(false); }, yes: () => { closeSheet(); resolve(true); } },
    { onClose: () => resolve(false) });
  });
}
function explainError(err) {
  const c = String(err?.code || '');
  if (/dynamically imported|importing a module|module script/i.test(String(err?.message || ''))) return 'Couldn’t download Firebase. Check your internet connection, and turn off any ad-blocker or private DNS that blocks gstatic.com.';
  if (c === 'config/broken') return 'config.js has a mistake in it, so the app can’t read your Firebase keys. Open it and check you only replaced the PASTE_… values (keep the quotes and commas, and don’t paste any “import” lines).';
  if (c.includes('permission-denied')) return 'The server refused it. In Firebase → Firestore → Rules, paste firestore.rules and Publish.';
  if (c.includes('not-found')) return 'Firestore database not found. In Firebase → Build → Firestore Database, click Create database.';
  if (c.includes('admin-restricted-operation') || c.includes('operation-not-allowed')) return 'Turn on Anonymous sign-in: Firebase → Authentication → Sign-in method → Anonymous → Enable.';
  if (c.includes('api-key') || c.includes('invalid-api-key')) return 'The apiKey in config.js is wrong. Copy it again from Firebase → Project settings → Your apps.';
  if (c.includes('unauthorized-domain') || c.includes('requests-from-referer') || c.includes('referer')) return 'This website isn’t allowed yet. Add its domain in Firebase → Authentication → Settings → Authorized domains (and in your API key’s website restrictions, if you set them).';
  if (c.includes('network-request-failed') || c.includes('unavailable') || c.includes('timeout')) return 'Couldn’t reach Firebase. Check your internet connection.';
  return null;
}
function fail(err, what = 'Something went wrong') {
  console.error(err);
  const why = explainError(err);
  toast(why || `${what}${err?.code ? ` (${err.code})` : ''}`);
}

/* ============================== routing ============================== */
function parseHash() {
  const h = location.hash.slice(1) || '/';
  const [path, qs] = h.split('?');
  return { parts: path.split('/').filter(Boolean), q: new URLSearchParams(qs || '') };
}
function go(hash) { location.hash = hash; }
function back(parent) {
  if (S.prevHash === parent) history.back();
  else location.replace(parent);
}
let lastHash = location.hash || '#/';
window.addEventListener('hashchange', () => { S.prevHash = lastHash; lastHash = location.hash || '#/'; route(); });

// Keep ?g=<id> in the address while a group is open. If someone taps
// "Add to Home Screen" here, the installed app opens straight into this group
// (iOS keeps home-screen apps' storage separate from Safari's).
function syncAddressBar(gid) {
  const want = gid ? `?g=${gid}` : '';
  if (location.search !== want) history.replaceState(history.state, '', location.pathname + want + location.hash);
}

function route() {
  closeSheet();
  const { parts, q } = parseHash();
  syncAddressBar(parts[0] === 'g' && /^[A-Za-z0-9]{20}$/.test(parts[1] || '') ? parts[1] : null);
  window.scrollTo(0, 0);
  if (parts[0] === 'g' && parts[1]) {
    const gid = parts[1];
    const sub = parts[2] || '';
    const view = { '': 'group', add: 'add', edit: 'edit', e: 'expense', settle: 'settle', settings: 'settings' }[sub] || 'group';
    S.route = { view, gid, arg: parts[3], q };
    watchGroup(gid);
    if (!(S.gLoaded && S.eLoaded)) { S.awaitingData = true; renderBoot(); return; }
    renderRoute();
  } else {
    unwatchGroup();
    const view = parts[0] === 'new' ? 'new' : parts[0] === 'join' ? 'join' : 'home';
    S.route = { view, q };
    renderRoute();
  }
}

function renderRoute() {
  const r = S.route;
  app.oninput = app.onchange = null;
  if (r.gid && S.missing) return renderMissing();
  ({
    home: renderHome, new: renderNewGroup, join: renderJoin,
    group: renderGroup, add: () => renderExpenseForm(null), edit: () => renderExpenseForm(r.arg),
    expense: () => renderExpenseDetail(r.arg), settle: renderSettle, settings: renderSettings,
  }[r.view] || renderHome)();
  if (r.gid) checkIdentity();
}

function renderBoot() { PAGE = {}; app.innerHTML = '<div class="boot"><div class="boot-mark">S/</div></div>'; }

/* ============================== data subscription ============================== */
function unwatchGroup() {
  S.unsubs.forEach((u) => { try { u(); } catch {} });
  Object.assign(S, { loadError: null, unsubs: [], gid: null, group: null, expenses: [], gLoaded: false, eLoaded: false, missing: false, pending: false });
}
function watchGroup(gid) {
  if (S.gid === gid) return;
  unwatchGroup();
  S.gid = gid;
  S.tab = 'activity'; S.search = ''; S.showDeleted = false;
  const onErr = (err) => { console.error(err); S.loadError = err; S.missing = true; S.gLoaded = S.eLoaded = true; onData(); };
  S.unsubs.push(S.store.watchGroup(gid, (g) => {
    S.group = g; S.missing = !g; S.gLoaded = true; onData();
  }, onErr));
  S.unsubs.push(S.store.watchExpenses(gid, (list, pending) => {
    S.expenses = list; S.pending = pending; S.eLoaded = true; onData();
  }, onErr));
}

function onData() {
  if (!(S.gLoaded && S.eLoaded)) return;
  if (S.group) cacheSummary();
  if (S.awaitingData) { S.awaitingData = false; renderRoute(); return; }
  if (S.missing) return renderMissing();
  const v = S.route.view;
  if (v === 'group') liveUpdateGroup();
  else if (v === 'expense') renderExpenseDetail(S.route.arg, true);
  else if (v === 'settings') refreshSettingsMembers();
  checkIdentity();
}

function cacheSummary() {
  const me = myId();
  const net = L.computeNet(members().map((m) => m.id), S.expenses);
  rememberGroup(S.gid, {
    name: S.group.name, emoji: S.group.emoji, cur: S.group.currency, archived: !!S.group.archived,
    bal: me ? net[me] ?? 0 : null, count: live().filter((e) => e.type !== 'payment').length, at: Date.now(),
  });
}

/* ============================== identity ============================== */
function checkIdentity() {
  if (!S.group || sheetRoot.innerHTML) return;
  const me = myId();
  if (me && S.group.members?.[me]) return;
  const list = members();
  openSheet(`
    <h2 style="font:700 22px var(--display);margin:6px 0 4px">${esc(S.group.emoji || '')} Who are you?</h2>
    <p class="sub">Pick your name in <b>${esc(S.group.name)}</b> so the app can show what you owe.</p>
    <div class="chips" style="margin-bottom:18px">
      ${list.map((m) => `<button class="chip" data-act="pick" data-id="${esc(m.id)}">${avatar(m.id, m.name, 'sm')}${esc(m.name)}</button>`).join('')}
    </div>
    <div class="field"><label for="newname">Not on the list? Add yourself</label>
      <div class="btn-row" style="gap:8px"><input id="newname" class="input" maxlength="40" placeholder="Your name" autocomplete="given-name" style="flex:2">
      <button class="btn primary" data-act="add" style="flex:1">Join</button></div></div>
    <div style="text-align:center"><button class="link-btn" data-act="home">Back to my groups</button></div>
  `, {
    home: () => { closeSheet(); location.replace('#/'); },
    pick: (el) => { setMe(S.gid, el.dataset.id); closeSheet(); cacheSummary(); renderRoute(); toast(`Welcome, ${nameOf(el.dataset.id)}!`); },
    add: async () => {
      const name = $('#newname').value.trim();
      if (!name) return $('#newname').focus();
      if (members().some((m) => m.name.toLowerCase() === name.toLowerCase())) return toast('That name is taken — tap it above if it’s you');
      const id = newId(10);
      setMe(S.gid, id);
      closeSheet();
      S.store.updateGroup(S.gid, { [`members.${id}`]: { name, addedAt: Date.now() } }).catch((e) => fail(e, 'Could not add you'));
      LS.set('splitlah.lastName', name);
    },
  }, { dismissable: false });
}

/* ============================== HOME ============================== */
function renderHome() {
  const list = myGroups();
  const active = list.filter((g) => !g.archived);
  const archived = list.filter((g) => g.archived);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const card = (g) => {
    let bal = '<span class="small">Open to sync</span>';
    if (g.bal != null && g.cur) {
      bal = g.bal > 0 ? `<span class="small bal-pos num">you’re owed ${money(g.bal, g.cur)}</span>`
        : g.bal < 0 ? `<span class="small bal-neg num">you owe ${money(-g.bal, g.cur)}</span>`
          : '<span class="small">all settled</span>';
    }
    return `<button class="group-card" data-act="open" data-id="${esc(g.id)}">
      <span class="group-emoji">${esc(g.emoji || '👥')}</span>
      <span class="meta"><div class="name">${esc(g.name || 'Group')}</div>${bal}</span>
      <span class="small" style="color:var(--faint)">${g.count != null ? `${g.count} exp` : ''}</span>
    </button>`;
  };
  PAGE = {
    open: (el) => go(`#/g/${el.dataset.id}`),
    new: () => go('#/new'), join: () => go('#/join'),
    install: async () => { if (S.installEvt) { S.installEvt.prompt(); S.installEvt = null; renderHome(); } },
    toggleArchived: () => { $('#archived').classList.toggle('hidden'); },
  };
  app.innerHTML = `
    <div class="brand">Split<span>Lah</span></div>
    <p class="sub">Trips, dinners, house bills — sorted.</p>
    ${S.store.mode === 'local' ? `<div class="banner warn"><span>🧪</span><div><b>Demo mode.</b> Data stays on this device only. Add your Firebase keys in <code>config.js</code> to share groups with friends.</div></div>` : ''}
    ${!standalone ? `<div class="banner info"><span>📲</span><div><b>Install it:</b> ${ios ? 'tap the Share button in Safari, then <b>Add to Home Screen</b>.' : S.installEvt ? '<button class="link-btn" data-act="install" style="padding:0">Add to home screen</button>' : 'open your browser menu and choose <b>Add to Home screen</b> / <b>Install app</b>.'}</div></div>` : ''}
    <div class="btn-row" style="margin:6px 0 4px">
      <button class="btn primary" data-act="new">${ICON.plus} New group</button>
      <button class="btn" data-act="join">Join with link</button>
    </div>
    ${active.length ? `<div class="section-title">Your groups</div>${active.map(card).join('')}` : `
      <div class="empty"><div class="big-emoji">🧳</div><h3>No groups yet</h3>
      <p>Create one for your next trip or makan session, then share the link with friends.</p></div>`}
    ${archived.length ? `<div class="section-title"><span>Archived (${archived.length})</span><button class="link-btn" data-act="toggleArchived">Show</button></div>
      <div id="archived" class="hidden">${archived.map(card).join('')}</div>` : ''}
    <p class="foot-note">SplitLah v${VERSION} · ${S.store.mode === 'firebase' ? 'synced' : 'demo mode'}</p>
  `;
}

/* ============================== NEW GROUP ============================== */
function renderNewGroup() {
  const f = { emoji: '✈️', people: ['', ''] };
  const lastName = LS.get('splitlah.lastName', '');
  const draw = () => {
    app.innerHTML = `
      <div class="top"><button class="icon-btn" data-act="back" aria-label="Back">${ICON.back}</button><h1>New group</h1></div>
      <div class="field"><label for="gname">Name</label><input id="gname" class="input" maxlength="60" placeholder="e.g. Bali Dec 2026, Hari Raya potluck" value="${esc(f.name || '')}"></div>
      <div class="field"><div class="label">Icon</div><div class="emoji-grid">
        ${EMOJIS.map((e) => `<button type="button" data-act="emoji" data-e="${e}" aria-pressed="${f.emoji === e}">${e}</button>`).join('')}</div></div>
      <div class="field"><label for="gcur">Main currency</label>
        <select id="gcur" class="input">${Object.entries(L.CURRENCIES).map(([c, v]) => `<option value="${c}" ${c === (f.cur || 'MYR') ? 'selected' : ''}>${c} — ${esc(v.name)}</option>`).join('')}</select>
        <p class="hint">Balances are settled in this currency. You can still log expenses in other currencies.</p></div>
      <div class="field"><label for="myname">Your name</label><input id="myname" class="input" maxlength="40" placeholder="Your name" value="${esc(f.me ?? lastName)}"></div>
      <div class="field"><div class="label">Friends</div>
        ${f.people.map((p, i) => `<div class="member-edit"><input class="input" data-in="p" data-i="${i}" maxlength="40" placeholder="Friend ${i + 1}" value="${esc(p)}">
          <button class="icon-btn" data-act="rm" data-i="${i}" aria-label="Remove">${ICON.close}</button></div>`).join('')}
        <button class="btn sm" data-act="addp">${ICON.plus} Add person</button>
        <p class="hint">Friends can also add themselves when they open the invite link.</p></div>
      <div class="sheet-foot"><button class="btn primary block" data-act="create">Create group</button></div>`;
  };
  const sync = () => {
    f.name = $('#gname').value; f.cur = $('#gcur').value; f.me = $('#myname').value;
    f.people = [...app.querySelectorAll('[data-in="p"]')].map((i) => i.value);
  };
  PAGE = {
    back: () => back('#/'),
    emoji: (el) => { sync(); f.emoji = el.dataset.e; app.querySelectorAll('.emoji-grid button').forEach((b) => b.setAttribute('aria-pressed', b === el)); },
    addp: () => { sync(); f.people.push(''); draw(); app.querySelectorAll('[data-in="p"]')[f.people.length - 1].focus(); },
    rm: (el) => { sync(); f.people.splice(Number(el.dataset.i), 1); draw(); },
    create: async (el) => {
      sync();
      const name = f.name.trim(); const me = f.me.trim();
      if (!name) { toast('Give the group a name'); return $('#gname').focus(); }
      if (!me) { toast('Add your name'); return $('#myname').focus(); }
      const names = [me, ...f.people.map((p) => p.trim()).filter(Boolean)];
      const lower = names.map((n) => n.toLowerCase());
      if (new Set(lower).size !== lower.length) return toast('Two people have the same name — make them unique');
      el.disabled = true;
      const now = Date.now();
      const mem = {}; const ids = names.map(() => newId(10));
      names.forEach((n, i) => (mem[ids[i]] = { name: n, addedAt: now + i }));
      try {
        const gid = await S.store.createGroup({
          name, emoji: f.emoji, currency: f.cur, members: mem, rates: {}, simplify: true, archived: false,
          createdAt: now, createdBy: me, schema: 1,
        });
        setMe(gid, ids[0]);
        LS.set('splitlah.lastName', me);
        rememberGroup(gid, { name, emoji: f.emoji, cur: f.cur, bal: 0, count: 0 });
        location.replace(`#/g/${gid}`);
        setTimeout(() => shareGroup(gid, name, true), 400);
      } catch (e) { el.disabled = false; fail(e, 'Could not create group'); }
    },
  };
  draw();
}

/* ============================== JOIN ============================== */
function extractGroupId(text) {
  const s = String(text || '').trim();
  const m = s.match(/[?&#]g=([A-Za-z0-9]{20})/) || s.match(/\/g\/([A-Za-z0-9]{20})/) || s.match(/^([A-Za-z0-9]{20})$/);
  return m ? m[1] : null;
}
async function joinGroup(gid) {
  const g = await S.store.getGroup(gid);
  if (!g) throw Object.assign(new Error('not found'), { code: 'not-found' });
  rememberGroup(gid, { name: g.name, emoji: g.emoji, cur: g.currency, archived: !!g.archived });
  return g;
}
function renderJoin() {
  PAGE = {
    back: () => back('#/'),
    paste: async () => { try { $('#code').value = await navigator.clipboard.readText(); } catch { toast('Paste it into the box'); } },
    join: async (el) => {
      const gid = extractGroupId($('#code').value);
      if (!gid) return toast('That doesn’t look like a SplitLah link');
      el.disabled = true;
      try { await joinGroup(gid); location.replace(`#/g/${gid}`); }
      catch (e) { el.disabled = false; toast(e.code === 'not-found' ? 'Group not found — check the link' : 'Couldn’t reach the group. Are you online?'); }
    },
  };
  app.innerHTML = `
    <div class="top"><button class="icon-btn" data-act="back" aria-label="Back">${ICON.back}</button><h1>Join a group</h1></div>
    <p class="sub">Paste the invite link (or the 20-character code) a friend sent you.</p>
    <div class="field"><textarea id="code" class="input" rows="3" placeholder="https://…/?g=…"></textarea></div>
    <div class="btn-row"><button class="btn" data-act="paste">Paste</button><button class="btn primary" data-act="join">Join</button></div>`;
}

function renderMissing() {
  PAGE = { home: () => location.replace('#/'), forget: () => { forgetGroup(S.route.gid); location.replace('#/'); } };
  app.innerHTML = `<div class="top"><button class="icon-btn" data-act="home" aria-label="Home">${ICON.back}</button><h1>Group</h1></div>
    <div class="empty"><div class="big-emoji">🔍</div><h3>Can’t open this group</h3>
    <p>${esc(explainError(S.loadError) || 'The link may be wrong, or you’re offline and haven’t opened this group on this device before.')}</p>
    <div class="btn-row" style="margin-top:16px"><button class="btn" data-act="home">Home</button><button class="btn danger" data-act="forget">Remove from list</button></div></div>`;
}

/* ============================== GROUP ============================== */
function groupNumbers() {
  const ids = members().map((m) => m.id);
  const ex = S.expenses;
  return { ids, net: L.computeNet(ids, ex), stats: L.computeStats(ids, ex) };
}

function heroHTML() {
  const g = S.group; const cur = g.currency; const me = myId();
  const { net, stats } = groupNumbers();
  const mine = me ? net[me] ?? 0 : 0;
  const count = live().filter((e) => e.type !== 'payment').length;
  const label = mine > 0 ? 'You’re owed' : mine < 0 ? 'You owe' : 'You’re all settled';
  return `<div class="card hero" id="hero">
    <div class="label">${label}</div>
    <div class="big num ${mine > 0 ? 'bal-pos' : mine < 0 ? 'bal-neg' : ''}">${mine ? money(Math.abs(mine), cur) : '🎉'}</div>
    <div class="stats"><span>Group spend <b class="num">${money(stats.total, cur)}</b></span>
      <span>Your share <b class="num">${money(stats.share[me] ?? 0, cur)}</b></span><span><b>${count}</b> expenses</span></div>
    ${S.pending ? '<div class="hint">⏳ Syncing your latest changes…</div>' : ''}
    <div class="hero-actions"><button class="btn sm" data-act="settle">💸 Settle up</button><button class="btn sm" data-act="share">${ICON.share.replace('<svg', '<svg width="16" height="16"')} Invite</button></div>
  </div>`;
}

function activityHTML() {
  const me = myId(); const cur = S.group.currency;
  const q = S.search.trim().toLowerCase();
  let list = S.expenses.filter((e) => S.showDeleted || !e.deleted);
  if (q) list = list.filter((e) => (e.type === 'payment' ? ['settlement', e.notes, nameOf(e.from), nameOf(e.to)] : [e.desc, e.notes, nameOf(e.paidBy), CATS[e.category]?.[1]]).join(' ').toLowerCase().includes(q));
  list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt ?? 0) - (a.createdAt ?? 0));
  const deletedCount = S.expenses.filter((e) => e.deleted).length;
  if (!list.length) {
    return q ? '<div class="empty"><p>No matches.</p></div>' : `<div class="empty"><div class="big-emoji">🧾</div><h3>Nothing yet</h3><p>Tap <b>Add expense</b> to log the first one.</p></div>`;
  }
  let lastDay = null; let out = '';
  for (const e of list) {
    if (e.date !== lastDay) { out += `<div class="day-label">${esc(dayLabel(e.date))}</div>`; lastDay = e.date; }
    if (e.type === 'payment') {
      const rel = e.from === me ? `<span class="small bal-pos">you paid</span>` : e.to === me ? `<span class="small bal-neg">you received</span>` : '';
      out += `<button class="row ${e.deleted ? 'deleted' : ''}" data-act="exp" data-id="${esc(e.id)}"><span class="cat pay">🤝</span>
        <span class="grow"><div class="title">${esc(youOr(e.from, true))} paid ${esc(youOr(e.to))}</div><div class="small">Settlement</div></span>
        <span class="right"><div class="num" style="font-weight:700">${money(e.baseTotal, cur)}</div>${rel}</span></button>`;
      continue;
    }
    const myShare = e.sharesBase?.[me] ?? 0;
    let rel;
    if (e.paidBy === me) {
      const lent = e.baseTotal - myShare;
      rel = lent ? `<div class="small">you lent</div><div class="num bal-pos" style="font-weight:700">${money(lent, cur)}</div>` : '<div class="small">just you</div>';
    } else if (myShare) {
      rel = `<div class="small">you borrowed</div><div class="num bal-neg" style="font-weight:700">${money(myShare, cur)}</div>`;
    } else rel = '<div class="small" style="color:var(--faint)">not involved</div>';
    const foreign = e.currency !== cur ? ` · ${money(e.amount, e.currency)}` : '';
    out += `<button class="row ${e.deleted ? 'deleted' : ''}" data-act="exp" data-id="${esc(e.id)}"><span class="cat">${(CATS[e.category] || CATS.general)[0]}</span>
      <span class="grow"><div class="title">${esc(e.desc || 'Expense')}</div><div class="small num">${esc(youOr(e.paidBy, true))} paid ${money(e.baseTotal, cur)}${foreign}</div></span>
      <span class="right">${rel}</span></button>`;
  }
  if (deletedCount) out += `<div style="text-align:center;margin-top:10px"><button class="link-btn" data-act="toggleDeleted">${S.showDeleted ? 'Hide' : 'Show'} ${deletedCount} deleted</button></div>`;
  return out;
}

function balancesHTML() {
  const g = S.group; const cur = g.currency; const me = myId();
  const { ids, net } = groupNumbers();
  const max = Math.max(1, ...ids.map((id) => Math.abs(net[id])));
  const settled = ids.every((id) => net[id] === 0);
  const simplify = g.simplify !== false;
  const transfers = settled ? [] : simplify ? L.simplifyDebts(net) : L.computePairwise(S.expenses);
  const rows = members().map((m) => {
    const v = net[m.id]; const w = (Math.abs(v) / max) * 50;
    return `<div class="bal-row">${avatar(m.id, m.name)}<div class="grow">
      <div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(m.name)}${m.id === me ? ' <span class="small" style="color:var(--muted);font-weight:500">(you)</span>' : ''}</b>
      <span class="num ${v > 0 ? 'bal-pos' : v < 0 ? 'bal-neg' : ''}" style="font-weight:700">${v > 0 ? 'gets back ' + money(v, cur) : v < 0 ? 'owes ' + money(-v, cur) : 'settled'}</span></div>
      <div class="bar-track"><div class="bar-mid"></div>${v ? `<div class="bar-fill ${v > 0 ? 'pos' : 'neg'}" style="width:${w}%"></div>` : ''}</div></div></div>`;
  }).join('');
  const tx = transfers.map((t) => `<div class="settle-row" style="${t.from === me || t.to === me ? '' : 'opacity:.85'}">
      ${avatar(t.from, nameOf(t.from), 'sm')}<span class="arrow">${ICON.arrow}</span>${avatar(t.to, nameOf(t.to), 'sm')}
      <span class="grow"><b>${esc(youOr(t.from, true))}</b> ${t.from === me ? 'pay' : 'pays'} <b>${esc(youOr(t.to))}</b><br><span class="num" style="font-weight:700">${money(t.amount, cur)}</span></span>
      <button class="btn sm ${t.from === me || t.to === me ? 'primary' : ''}" data-act="record" data-from="${esc(t.from)}" data-to="${esc(t.to)}" data-amt="${t.amount}">Record</button></div>`).join('');
  return `<div class="card">${rows || '<p class="sub">No members.</p>'}</div>
    <div class="section-title"><span>How to settle</span>
      <label style="display:flex;gap:8px;align-items:center;text-transform:none;letter-spacing:0;font-weight:600">
        <button class="check" role="switch" aria-checked="${simplify}" data-act="simplify" aria-label="Simplify debts"></button>Simplify</label></div>
    <div class="card">${settled ? '<div class="empty" style="padding:18px"><div class="big-emoji">🎉</div><h3>Everyone’s settled up</h3></div>' : tx}</div>
    <p class="hint" style="margin:0 6px">${simplify ? 'Simplified: the fewest transfers so everyone ends up even (A owes B, B owes C → A pays C).' : 'Showing who owes whom directly, expense by expense.'}</p>`;
}

function insightsHTML() {
  const g = S.group; const cur = g.currency;
  const { stats } = groupNumbers();
  if (!stats.total) return '<div class="empty"><div class="big-emoji">📊</div><h3>No spending yet</h3></div>';
  const ms = members();
  const maxP = Math.max(1, ...ms.map((m) => Math.max(stats.paid[m.id] || 0, stats.share[m.id] || 0)));
  const people = ms.map((m) => `<div style="padding:9px 0">
      <div style="display:flex;justify-content:space-between"><b>${esc(m.name)}</b><span class="small num" style="color:var(--muted)">paid ${money(stats.paid[m.id] || 0, cur)} · share ${money(stats.share[m.id] || 0, cur)}</span></div>
      <div class="hbar" style="width:${((stats.paid[m.id] || 0) / maxP) * 100}%;margin-top:6px"></div>
      <div class="hbar alt" style="width:${((stats.share[m.id] || 0) / maxP) * 100}%;margin-top:3px"></div></div>`).join('');
  const cats = Object.entries(stats.byCat).sort((a, b) => b[1] - a[1]);
  const catRows = cats.map(([c, v]) => `<div style="padding:8px 0"><div style="display:flex;justify-content:space-between">
      <span>${(CATS[c] || CATS.general)[0]} ${(CATS[c] || CATS.general)[1]}</span><span class="num"><b>${money(v, cur)}</b> <span class="small" style="color:var(--muted)">${Math.round((v / stats.total) * 100)}%</span></span></div>
      <div class="hbar" style="width:${(v / cats[0][1]) * 100}%;margin-top:6px;opacity:.85"></div></div>`).join('');
  const exps = live().filter((e) => e.type !== 'payment');
  const days = new Set(exps.map((e) => e.date)).size;
  const biggest = exps.reduce((a, e) => (!a || e.baseTotal > a.baseTotal ? e : a), null);
  return `<div class="card"><div class="kv"><span class="k">Total spent</span><b class="num">${money(stats.total, cur)}</b></div>
      <div class="kv"><span class="k">Per person (avg)</span><b class="num">${money(Math.round(stats.total / Math.max(1, ms.length)), cur)}</b></div>
      <div class="kv"><span class="k">Per day (${days} day${days === 1 ? '' : 's'})</span><b class="num">${money(Math.round(stats.total / Math.max(1, days)), cur)}</b></div>
      ${biggest ? `<div class="kv"><span class="k">Biggest</span><b>${esc(biggest.desc)} · <span class="num">${money(biggest.baseTotal, cur)}</span></b></div>` : ''}</div>
    <div class="section-title">Paid vs share <span class="small" style="text-transform:none;letter-spacing:0;font-weight:500"><span style="color:var(--accent)">■</span> paid <span style="color:var(--faint)">■</span> share</span></div>
    <div class="card">${people}</div>
    <div class="section-title">By category</div><div class="card">${catRows}</div>
    <button class="btn block" data-act="csv">⬇️ Export to CSV (Excel / Sheets)</button>`;
}

function tabBodyHTML() {
  if (S.tab === 'balances') return `<div id="tabc">${balancesHTML()}</div>`;
  if (S.tab === 'insights') return `<div id="tabc">${insightsHTML()}</div>`;
  return `<div class="search">${ICON.search}<input class="input" id="search" type="search" placeholder="Search expenses" value="${esc(S.search)}" autocomplete="off"></div><div id="tabc">${activityHTML()}</div>`;
}
const tabContent = () => (S.tab === 'balances' ? balancesHTML() : S.tab === 'insights' ? insightsHTML() : activityHTML());

function renderGroup() {
  const g = S.group;
  PAGE = {
    home: () => back('#/'),
    settings: () => go(`#/g/${S.gid}/settings`),
    add: () => go(`#/g/${S.gid}/add`),
    settle: () => go(`#/g/${S.gid}/settle`),
    share: () => shareGroup(S.gid, g.name),
    tab: (el) => { S.tab = el.dataset.t; renderGroup(); },
    exp: (el) => go(`#/g/${S.gid}/e/${el.dataset.id}`),
    toggleDeleted: () => { S.showDeleted = !S.showDeleted; $('#tabc').innerHTML = activityHTML(); },
    record: (el) => go(`#/g/${S.gid}/settle?from=${el.dataset.from}&to=${el.dataset.to}&amt=${el.dataset.amt}`),
    simplify: () => S.store.updateGroup(S.gid, { simplify: S.group.simplify === false }).catch((e) => fail(e)),
    csv: exportCSV,
    hideInstall: () => { LS.set('splitlah.hideInstall', true); $('#install-banner')?.remove(); },
    install: () => { if (S.installEvt) { S.installEvt.prompt(); S.installEvt = null; $('#install-banner')?.remove(); } },
  };
  app.innerHTML = `
    <div class="top"><button class="icon-btn" data-act="home" aria-label="All groups">${ICON.back}</button>
      <h1>${esc(g.emoji || '')} ${esc(g.name)}</h1>
      <button class="icon-btn" data-act="share" aria-label="Invite">${ICON.share}</button>
      <button class="icon-btn" data-act="settings" aria-label="Group settings">${ICON.gear}</button></div>
    ${g.archived ? '<div class="banner warn"><span>🗄️</span><div>This group is archived. You can still view and edit it.</div></div>' : ''}
    ${installBanner()}
    <div id="offline" class="banner warn ${navigator.onLine ? 'hidden' : ''}"><span>📴</span><div>You’re offline. Changes are saved on this phone and will sync when you’re back online.</div></div>
    ${heroHTML()}
    <div class="tabs" role="tablist">
      ${[['activity', 'Expenses'], ['balances', 'Balances'], ['insights', 'Insights']].map(([t, l]) => `<button role="tab" data-act="tab" data-t="${t}" aria-selected="${S.tab === t}">${l}</button>`).join('')}
    </div>
    ${tabBodyHTML()}
    <button class="fab" data-act="add">${ICON.plus} Add expense</button>`;
  const s = $('#search');
  if (s) s.oninput = () => { S.search = s.value; $('#tabc').innerHTML = activityHTML(); };
}
function installBanner() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone || LS.get('splitlah.hideInstall', false)) return '';
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const how = ios ? 'Tap <b>Share</b> → <b>Add to Home Screen</b>' : S.installEvt ? '<button class="link-btn" data-act="install" style="padding:0">Add to home screen</button>' : 'Browser menu → <b>Add to Home screen</b>';
  return `<div class="banner info" id="install-banner"><span>📲</span><div style="flex:1">${how} to keep this group one tap away.</div><button class="link-btn" data-act="hideInstall" style="padding:0 2px" aria-label="Dismiss">✕</button></div>`;
}
function liveUpdateGroup() {
  const hero = $('#hero'); const tabc = $('#tabc');
  if (!hero || !tabc) return renderGroup();
  hero.outerHTML = heroHTML();
  tabc.innerHTML = tabContent();
  const h1 = $('.top h1'); if (h1) h1.textContent = `${S.group.emoji || ''} ${S.group.name}`;
}
window.addEventListener('online', () => $('#offline')?.classList.add('hidden'));
window.addEventListener('offline', () => $('#offline')?.classList.remove('hidden'));

async function shareGroup(gid, name, fresh = false) {
  const url = `${location.origin}${location.pathname}?g=${gid}`;
  const text = `Join “${name}” on SplitLah to add our shared expenses:`;
  const doCopy = async () => { try { await navigator.clipboard.writeText(url); toast('Invite link copied'); } catch { toast('Copy the link from the box'); } };
  openSheet(`<h2 style="font:700 22px var(--display);margin:6px 0 4px">${fresh ? '🎉 Group created!' : 'Invite friends'}</h2>
    <p class="sub">Send this link. Friends open it, pick their name, then add it to their home screen <b>from that page</b> so the icon opens this group.</p>
    <div class="code-box">${esc(url)}</div>
    ${S.store.mode === 'local' ? '<p class="hint err">Demo mode: this link only works on this device until Firebase is set up.</p>' : ''}
    <div class="btn-row" style="margin-top:14px"><button class="btn" data-act="copy">Copy link</button>${navigator.share ? '<button class="btn primary" data-act="share">Share…</button>' : ''}</div>`, {
    copy: doCopy,
    share: async () => { try { await navigator.share({ title: `SplitLah · ${name}`, text, url }); closeSheet(); } catch {} },
  });
}

/* ============================== EXPENSE FORM ============================== */
function renderExpenseForm(eid) {
  const g = S.group; const base = g.currency; const ms = members(); const me = myId();
  const editing = eid ? S.expenses.find((e) => e.id === eid && e.type !== 'payment') : null;
  if (eid && !editing) return location.replace(`#/g/${S.gid}`);
  const lastCur = LS.get('splitlah.lastCur', {})[S.gid];
  const f = editing ? {
    desc: editing.desc, amountStr: L.minorToInput(editing.amount, editing.currency), currency: editing.currency,
    rateStr: editing.currency !== base ? String(editing.rate) : '', paidBy: editing.paidBy, date: editing.date,
    category: editing.category || 'general', catTouched: true, splitType: editing.splitType || 'equal',
    picked: new Set(editing.participants || Object.keys(editing.sharesBase || {})), inputs: { exact: {}, percent: {}, shares: {}, adjust: {} }, notes: editing.notes || '',
  } : {
    desc: '', amountStr: '', currency: lastCur && L.CURRENCIES[lastCur] ? lastCur : base, rateStr: '', paidBy: me && g.members[me] ? me : ms[0]?.id,
    date: today(), category: 'general', catTouched: false, splitType: 'equal', picked: new Set(ms.map((m) => m.id)),
    inputs: { exact: {}, percent: {}, shares: {}, adjust: {} }, notes: '',
  };
  if (editing && editing.splitInput && f.inputs[f.splitType]) {
    for (const [id, v] of Object.entries(editing.splitInput)) {
      f.inputs[f.splitType][id] = f.splitType === 'exact' || f.splitType === 'adjust' ? L.minorToInput(v, editing.currency) : String(v);
    }
  }
  if (editing && f.splitType === 'shares') ms.forEach((m) => { if (f.inputs.shares[m.id] == null) f.inputs.shares[m.id] = '0'; });
  if (!f.rateStr && f.currency !== base && g.rates?.[f.currency]) f.rateStr = String(g.rates[f.currency]);
  // members referenced by an old expense but since removed still need to show
  const rowsFor = () => {
    const extra = editing ? [...f.picked].filter((id) => !g.members[id]).map((id) => ({ id, name: 'Removed member' })) : [];
    return [...ms, ...extra];
  };

  const compute = () => {
    const amount = L.toMinor(f.amountStr, f.currency);
    const rows = rowsFor();
    let ids, input = {};
    const t = f.splitType;
    if (t === 'equal' || t === 'adjust') ids = rows.filter((m) => f.picked.has(m.id)).map((m) => m.id);
    else ids = rows.map((m) => m.id);
    if (t !== 'equal') {
      for (const id of ids) {
        const raw = f.inputs[t][id];
        if (t === 'exact' || t === 'adjust') { const v = raw ? L.toMinor(raw, f.currency) : 0; input[id] = Number.isNaN(v) ? NaN : v; }
        else if (t === 'shares') input[id] = raw === undefined || raw === '' ? 1 : Number(raw);
        else input[id] = raw ? Number(raw) : 0;
      }
      if (t !== 'adjust') { ids = ids.filter((id) => input[id]); }
    }
    const rate = f.currency === base ? 1 : Number(f.rateStr);
    if (!Number.isFinite(amount) || amount === 0) return { ok: false, error: 'Enter an amount', amount, ids, input };
    if (f.currency !== base && !(rate > 0)) return { ok: false, error: `Enter the ${f.currency}→${base} rate`, amount, ids, input };
    const r = L.buildExpenseAmounts({ amount, currency: f.currency, rate, baseCurrency: base, ids, splitType: t, splitInput: input });
    return { ...r, amount, ids, input, rate };
  };

  const splitBoxHTML = () => {
    const t = f.splitType; const rows = rowsFor();
    const step = L.dpOf(f.currency) ? '0.01' : '1';
    return rows.map((m) => {
      const checked = f.picked.has(m.id);
      let ctl = '';
      if (t === 'equal') ctl = '';
      else if (t === 'exact') ctl = `<input class="input mini num" inputmode="decimal" step="${step}" placeholder="0" data-in="split" data-id="${esc(m.id)}" value="${esc(f.inputs.exact[m.id] ?? '')}">`;
      else if (t === 'percent') ctl = `<input class="input mini num" inputmode="decimal" placeholder="0 %" data-in="split" data-id="${esc(m.id)}" value="${esc(f.inputs.percent[m.id] ?? '')}">`;
      else if (t === 'shares') ctl = `<input class="input mini num" inputmode="decimal" placeholder="1" data-in="split" data-id="${esc(m.id)}" value="${esc(f.inputs.shares[m.id] ?? '')}">`;
      else if (t === 'adjust') ctl = `<input class="input mini num" inputmode="text" placeholder="+0" data-in="split" data-id="${esc(m.id)}" value="${esc(f.inputs.adjust[m.id] ?? '')}" ${checked ? '' : 'disabled'}>`;
      const box = t === 'equal' || t === 'adjust' ? `<button type="button" class="check" role="checkbox" aria-checked="${checked}" data-act="pick" data-id="${esc(m.id)}" aria-label="Include ${esc(m.name)}"></button>` : '';
      return `<div class="split-row">${box}${avatar(m.id, m.name, 'sm')}<span class="grow">${esc(m.name)}${m.id === me ? ' (you)' : ''}<div class="share num" data-share="${esc(m.id)}"></div></span>${ctl}</div>`;
    }).join('');
  };

  const refresh = () => {
    const r = compute();
    const cur = f.currency;
    // shares per row
    app.querySelectorAll('[data-share]').forEach((el) => {
      const id = el.dataset.share;
      const v = r.ok ? r.shares[id] : undefined;
      if (v == null || v === 0) { el.textContent = f.splitType === 'equal' && !f.picked.has(id) ? 'not included' : ''; return; }
      el.textContent = money(v, cur) + (cur !== base ? ` ≈ ${money(r.sharesBase[id], base)}` : '');
    });
    // status
    const st = $('#split-status');
    let msg = '', cls = 'ok';
    if (r.ok) {
      msg = `✓ ${money(r.amount, cur)} split between ${Object.values(r.shares).filter((v) => v).length}`;
    } else if (r.diff != null && Number.isFinite(r.amount)) {
      cls = 'err';
      msg = f.splitType === 'percent' ? `${Math.abs(r.diff)}${r.error}` : `${money(Math.abs(r.diff), cur)} ${r.error}`;
    } else { cls = 'err'; msg = r.error || ''; }
    st.innerHTML = `<span class="${cls}">${esc(msg)}</span>${f.splitType !== 'equal' && f.splitType !== 'adjust' && r.diff ? '<button class="link-btn" data-act="fill">Fill rest</button>' : ''}`;
    // conversion line
    const conv = $('#conv');
    if (conv) conv.textContent = r.baseTotal ? `= ${money(r.baseTotal, base)} in ${base}` : '';
    $('#save').disabled = !r.ok || !f.desc.trim() || !f.paidBy;
    return r;
  };

  const rateBoxHTML = () => f.currency === base ? '' : `
    <div class="field" id="rate-field"><label for="rate">Exchange rate</label>
      <div class="amount-wrap" style="align-items:center"><span style="white-space:nowrap;font-weight:600">1 ${esc(f.currency)} =</span>
      <input id="rate" class="input num" inputmode="decimal" data-in="rate" value="${esc(f.rateStr)}" placeholder="0.00">
      <span style="font-weight:600">${esc(base)}</span></div>
      <div style="display:flex;justify-content:space-between;align-items:center"><p class="hint num" id="conv"></p>
      <button class="link-btn" data-act="fetchRate">Get today’s rate</button></div></div>`;

  const draw = () => {
    app.innerHTML = `
      <div class="top"><button class="icon-btn" data-act="cancel" aria-label="Cancel">${ICON.close}</button><h1>${editing ? 'Edit expense' : 'Add expense'}</h1></div>
      <div class="field"><label for="desc">What was it?</label><input id="desc" class="input" maxlength="80" data-in="desc" placeholder="e.g. Seafood dinner, Grab to airport" value="${esc(f.desc)}" autocomplete="off" enterkeyhint="next"></div>
      <div class="field"><label for="amt">Amount</label><div class="amount-wrap">
        <select class="input" data-in="currency" aria-label="Currency">${Object.keys(L.CURRENCIES).map((c) => `<option ${c === f.currency ? 'selected' : ''}>${c}</option>`).join('')}</select>
        <input id="amt" class="input amount-input num" inputmode="decimal" placeholder="0.00" data-in="amount" value="${esc(f.amountStr)}" autocomplete="off"></div></div>
      <div id="rate-box">${rateBoxHTML()}</div>
      <div class="field"><div class="label">Paid by</div><div class="chips scroll">
        ${ms.map((m) => `<button type="button" class="chip" data-act="payer" data-id="${esc(m.id)}" aria-pressed="${f.paidBy === m.id}">${avatar(m.id, m.name, 'sm')}${esc(m.id === me ? 'You' : m.name)}</button>`).join('')}</div></div>
      <div class="field"><div class="label">Split</div>
        <div class="seg" role="group">${Object.entries({ equal: 'Equal', exact: 'Exact', percent: '%', shares: 'Shares', adjust: '+/−' }).map(([k, v]) => `<button type="button" data-act="stype" data-t="${k}" aria-pressed="${f.splitType === k}" aria-label="${L.SPLIT_TYPES[k]}">${v}</button>`).join('')}</div>
        <p class="hint" id="split-hint"></p>
        <div class="card" style="padding:4px 14px;margin-top:8px"><div id="split-box">${splitBoxHTML()}</div></div>
        <div class="split-status" id="split-status"></div></div>
      <div class="field"><div class="label">Category</div><div class="chips">
        ${Object.entries(CATS).map(([k, [e, l]]) => `<button type="button" class="chip" data-act="cat" data-c="${k}" aria-pressed="${f.category === k}">${e} ${l}</button>`).join('')}</div></div>
      <div class="field"><label for="date">Date</label><input id="date" type="date" class="input" data-in="date" value="${esc(f.date)}"></div>
      <div class="field"><label for="notes">Notes (optional)</label><textarea id="notes" class="input" maxlength="500" data-in="notes" placeholder="Receipt details, who had what…">${esc(f.notes)}</textarea></div>
      <div class="sheet-foot"><button id="save" class="btn primary block" data-act="save">${editing ? 'Save changes' : 'Add expense'}</button></div>`;
    setHint();
    refresh();
  };
  const setHint = () => {
    $('#split-hint').textContent = {
      equal: 'Tick who shared it. Leftover cents are spread so it adds up exactly.',
      exact: 'Type each person’s amount. Must add up to the total.',
      percent: 'Type each person’s %. Must add up to 100%.',
      shares: 'e.g. 2 for someone who had a double portion, 1 for others. Blank = 1, 0 = not included.',
      adjust: 'Split equally, then add extra for someone (e.g. +12 for their drink). Use − to reduce.',
    }[f.splitType];
  };
  const redrawSplit = () => { $('#split-box').innerHTML = splitBoxHTML(); setHint(); refresh(); };

  app.oninput = onInput((k, el) => {
    if (k === 'desc') {
      f.desc = el.value;
      if (!f.catTouched) {
        const c = guessCat(f.desc);
        if (c !== f.category) { f.category = c; app.querySelectorAll('[data-act="cat"]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.c === c)); }
      }
      refresh();
    } else if (k === 'amount') { f.amountStr = el.value; refresh(); }
    else if (k === 'rate') { f.rateStr = el.value; refresh(); }
    else if (k === 'split') { f.inputs[f.splitType][el.dataset.id] = el.value; refresh(); }
    else if (k === 'date') f.date = el.value;
    else if (k === 'notes') f.notes = el.value;
  });
  app.onchange = onInput((k, el) => {
    if (k === 'currency') {
      const old = f.currency; f.currency = el.value;
      // keep typed amounts meaningful when dp changes (e.g. MYR -> JPY)
      if (L.dpOf(old) !== L.dpOf(f.currency)) for (const t of ['exact', 'adjust']) for (const id in f.inputs[t]) { const v = L.toMinor(f.inputs[t][id], old); if (!Number.isNaN(v)) f.inputs[t][id] = L.minorToInput(Math.round(v * 10 ** (L.dpOf(f.currency) - L.dpOf(old))), f.currency); }
      f.rateStr = f.currency !== base && g.rates?.[f.currency] ? String(g.rates[f.currency]) : '';
      $('#rate-box').innerHTML = rateBoxHTML();
      redrawSplit();
      if (f.currency !== base && !f.rateStr) fetchRate(true);
    }
  });

  const fetchRate = async (quiet) => {
    const from = f.currency;
    try {
      const r = await getRate(from, base);
      if (f.currency !== from) return;
      f.rateStr = String(r);
      const inp = $('#rate'); if (inp) inp.value = f.rateStr;
      refresh();
      if (!quiet) toast(`1 ${from} = ${r} ${base}`);
    } catch { if (!quiet) toast('Couldn’t fetch a rate — type it in'); }
  };

  PAGE = {
    cancel: () => back(editing ? `#/g/${S.gid}/e/${eid}` : `#/g/${S.gid}`),
    payer: (el) => { f.paidBy = el.dataset.id; app.querySelectorAll('[data-act="payer"]').forEach((b) => b.setAttribute('aria-pressed', b === el)); refresh(); },
    stype: (el) => {
      const prev = f.splitType; f.splitType = el.dataset.t;
      app.querySelectorAll('[data-act="stype"]').forEach((b) => b.setAttribute('aria-pressed', b === el));
      // carry over the current split as a starting point
      if (f.splitType !== prev && !Object.values(f.inputs[f.splitType] || {}).some((v) => v)) {
        const amt = L.toMinor(f.amountStr, f.currency);
        if (f.splitType === 'exact' && Number.isFinite(amt) && amt) {
          const ids = rowsFor().filter((m) => f.picked.has(m.id)).map((m) => m.id);
          const eq = L.computeSplit(amt, ids, 'equal');
          if (eq.ok) ids.forEach((id) => (f.inputs.exact[id] = L.minorToInput(eq.shares[id], f.currency)));
        } else if (f.splitType === 'percent') {
          const ids = rowsFor().filter((m) => f.picked.has(m.id)).map((m) => m.id);
          const p = L.allocate(10000, ids.map(() => 1));
          ids.forEach((id, i) => (f.inputs.percent[id] = String(p[i] / 100)));
        } else if (f.splitType === 'shares') {
          rowsFor().forEach((m) => (f.inputs.shares[m.id] = f.picked.has(m.id) ? '1' : '0'));
        }
      }
      redrawSplit();
    },
    pick: (el) => {
      const id = el.dataset.id;
      f.picked.has(id) ? f.picked.delete(id) : f.picked.add(id);
      el.setAttribute('aria-checked', f.picked.has(id));
      const inp = el.parentElement.querySelector('input'); if (inp) inp.disabled = !f.picked.has(id);
      refresh();
    },
    cat: (el) => { f.category = el.dataset.c; f.catTouched = true; app.querySelectorAll('[data-act="cat"]').forEach((b) => b.setAttribute('aria-pressed', b === el)); },
    fetchRate: () => fetchRate(false),
    fill: () => {
      const r = compute(); if (r.diff == null) return;
      const t = f.splitType;
      const rows = rowsFor();
      const target = rows.find((m) => !f.inputs[t][m.id]) || rows.at(-1);
      if (t === 'exact') { const cur0 = L.toMinor(f.inputs.exact[target.id] || '0', f.currency) || 0; f.inputs.exact[target.id] = L.minorToInput(cur0 + r.diff, f.currency); }
      else if (t === 'percent') { const cur0 = Number(f.inputs.percent[target.id] || 0); f.inputs.percent[target.id] = String(Math.round((cur0 + r.diff) * 1000) / 1000); }
      redrawSplit();
    },
    save: (el) => {
      const r = refresh();
      if (!r.ok) return toast(r.error || 'Check the split');
      if (!f.desc.trim()) { toast('Add a description'); return $('#desc').focus(); }
      el.disabled = true;
      const now = Date.now();
      const splitInput = f.splitType === 'equal' ? {} : Object.fromEntries(Object.entries(r.input).filter(([, v]) => v !== 0 && !Number.isNaN(v)));
      const doc = {
        id: editing ? editing.id : newId(),
        type: 'expense', desc: f.desc.trim(), category: f.category, notes: f.notes.trim(),
        amount: r.amount, currency: f.currency, rate: f.currency === base ? 1 : r.rate, baseCurrency: base,
        paidBy: f.paidBy, date: f.date || today(),
        splitType: f.splitType, splitInput, participants: r.ids,
        shares: r.shares, sharesBase: r.sharesBase, baseTotal: r.baseTotal,
        createdBy: editing ? editing.createdBy ?? null : me ?? null, createdAt: editing ? editing.createdAt : now,
        updatedBy: me ?? null, updatedAt: now, deleted: false,
      };
      S.store.saveExpense(S.gid, doc).catch((e) => fail(e, 'Couldn’t save — try again'));
      if (f.currency !== base && g.rates?.[f.currency] !== r.rate) S.store.updateGroup(S.gid, { [`rates.${f.currency}`]: r.rate }).catch(() => {});
      const lc = LS.get('splitlah.lastCur', {}); lc[S.gid] = f.currency; LS.set('splitlah.lastCur', lc);
      toast(editing ? 'Saved' : `Added ${f.desc.trim()}`);
      if (editing) back(`#/g/${S.gid}/e/${eid}`); else back(`#/g/${S.gid}`);
    },
  };
  draw();
  if (f.currency !== base && !f.rateStr) fetchRate(true);
  if (!editing) setTimeout(() => $('#desc')?.focus(), 250);
}

const rateCache = {};
async function getRate(from, to) {
  const key = `${from}>${to}`;
  if (rateCache[key] && Date.now() - rateCache[key].at < 3600e3) return rateCache[key].v;
  const round = (x) => Number(x.toPrecision(6));
  let v;
  try {
    const r = await fetch(`https://open.er-api.com/v6/latest/${from}`);
    const j = await r.json();
    v = j?.rates?.[to];
  } catch {}
  if (!v) {
    const r = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
    const j = await r.json();
    v = j?.rates?.[to];
  }
  if (!v) throw new Error('no rate');
  v = round(v);
  rateCache[key] = { v, at: Date.now() };
  return v;
}

/* ============================== EXPENSE DETAIL ============================== */
function renderExpenseDetail(eid, isLive = false) {
  const e = S.expenses.find((x) => x.id === eid);
  const g = S.group; const base = g.currency; const me = myId();
  if (!e) { if (!isLive) location.replace(`#/g/${S.gid}`); else renderMissingExpense(); return; }
  const y = isLive ? window.scrollY : 0;
  PAGE = {
    back: () => back(`#/g/${S.gid}`),
    edit: () => (e.type === 'payment' ? go(`#/g/${S.gid}/settle?edit=${e.id}`) : go(`#/g/${S.gid}/edit/${e.id}`)),
    del: async () => {
      if (!(await confirmSheet('Delete this?', `“${e.type === 'payment' ? 'Settlement' : e.desc}” will be removed from balances. You can restore it from the deleted list.`, 'Delete', true))) return;
      const upd = { ...e, deleted: true, updatedBy: me, updatedAt: Date.now() };
      S.store.saveExpense(S.gid, upd).catch((err) => fail(err));
      back(`#/g/${S.gid}`);
      toast('Deleted', { label: 'Undo', fn: () => S.store.saveExpense(S.gid, { ...e, deleted: false, updatedBy: me, updatedAt: Date.now() }).catch(fail) });
    },
    restore: () => { S.store.saveExpense(S.gid, { ...e, deleted: false, updatedBy: me, updatedAt: Date.now() }).catch(fail); toast('Restored'); },
  };
  const who = (id) => esc(nameOf(id)) + (id === me ? ' (you)' : '');
  let body;
  if (e.type === 'payment') {
    body = `<div class="card hero"><div class="label">Settlement · ${esc(fmtDate(e.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</div>
      <div class="big num">${money(e.baseTotal, base)}</div>
      <div style="display:flex;align-items:center;gap:10px">${avatar(e.from, nameOf(e.from))}<b>${who(e.from)}</b><span style="color:var(--faint)">${ICON.arrow}</span>${avatar(e.to, nameOf(e.to))}<b>${who(e.to)}</b></div>
      ${e.notes ? `<p class="hint" style="margin-top:12px">${esc(e.notes)}</p>` : ''}</div>`;
  } else {
    const shareRows = Object.entries(e.sharesBase || {}).filter(([, v]) => v).map(([id, v]) => `<div class="kv"><span>${avatar(id, nameOf(id), 'sm')} &nbsp;${who(id)}</span>
      <span class="num"><b>${money(v, base)}</b>${e.currency !== base ? `<br><span class="small" style="color:var(--muted)">${money(e.shares?.[id] ?? 0, e.currency)}</span>` : ''}</span></div>`).join('');
    body = `<div class="card hero"><div class="label">${(CATS[e.category] || CATS.general)[0]} ${(CATS[e.category] || CATS.general)[1]} · ${esc(fmtDate(e.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</div>
      <div style="font:700 22px var(--display);margin:4px 0 2px">${esc(e.desc)}</div>
      <div class="big num">${money(e.amount, e.currency)}</div>
      ${e.currency !== base ? `<div class="hint num">= ${money(e.baseTotal, base)} at 1 ${esc(e.currency)} = ${e.rate} ${esc(base)}</div>` : ''}
      <div style="display:flex;align-items:center;gap:10px;margin-top:10px">${avatar(e.paidBy, nameOf(e.paidBy))}<span><b>${who(e.paidBy)}</b> paid</span></div></div>
      <div class="section-title"><span>Split ${esc((L.SPLIT_TYPES[e.splitType] || '').toLowerCase())}</span></div>
      <div class="card">${shareRows}</div>
      ${e.notes ? `<div class="section-title">Notes</div><div class="card" style="white-space:pre-wrap">${esc(e.notes)}</div>` : ''}`;
  }
  app.innerHTML = `
    <div class="top"><button class="icon-btn" data-act="back" aria-label="Back">${ICON.back}</button><h1>${e.type === 'payment' ? 'Settlement' : 'Expense'}</h1></div>
    ${e.deleted ? '<div class="banner warn"><span>🗑️</span><div>This was deleted and doesn’t count toward balances.</div></div>' : ''}
    ${body}
    <p class="hint" style="margin:8px 6px 16px">Added by ${esc(nameOf(e.createdBy))} ${timeAgo(e.createdAt)}${e.updatedAt && e.updatedAt !== e.createdAt ? ` · edited by ${esc(nameOf(e.updatedBy))} ${timeAgo(e.updatedAt)}` : ''}</p>
    <div class="btn-row">${e.deleted ? '<button class="btn primary" data-act="restore">Restore</button>' : `<button class="btn danger" data-act="del">Delete</button><button class="btn primary" data-act="edit">Edit</button>`}</div>`;
  if (isLive) window.scrollTo(0, y);
}
function renderMissingExpense() {
  PAGE = { back: () => location.replace(`#/g/${S.gid}`) };
  app.innerHTML = `<div class="top"><button class="icon-btn" data-act="back">${ICON.back}</button><h1>Expense</h1></div><div class="empty"><h3>This item no longer exists</h3></div>`;
}

/* ============================== SETTLE UP ============================== */
function renderSettle() {
  const g = S.group; const base = g.currency; const me = myId(); const q = S.route.q;
  const ms = members();
  const editing = q.get('edit') ? S.expenses.find((e) => e.id === q.get('edit') && e.type === 'payment') : null;
  const { net } = groupNumbers();
  const suggestions = L.simplifyDebts(net);
  const mineFirst = suggestions.filter((t) => t.from === me || t.to === me);
  const pre = editing ? { from: editing.from, to: editing.to, amt: editing.baseTotal }
    : q.get('from') ? { from: q.get('from'), to: q.get('to'), amt: Number(q.get('amt')) }
      : mineFirst[0] ? { from: mineFirst[0].from, to: mineFirst[0].to, amt: mineFirst[0].amount }
        : { from: me, to: ms.find((m) => m.id !== me)?.id, amt: 0 };
  const f = { from: pre.from, to: pre.to, amountStr: pre.amt ? L.minorToInput(pre.amt, base) : '', date: editing?.date || today(), notes: editing?.notes || '' };
  const personChips = (key) => ms.map((m) => `<button type="button" class="chip" data-act="${key}" data-id="${esc(m.id)}" aria-pressed="${f[key] === m.id}">${avatar(m.id, m.name, 'sm')}${esc(m.id === me ? 'You' : m.name)}</button>`).join('');
  const check = () => {
    const amt = L.toMinor(f.amountStr, base);
    const ok = f.from && f.to && f.from !== f.to && Number.isFinite(amt) && amt > 0;
    $('#save').disabled = !ok;
    $('#who').textContent = f.from && f.to && f.from !== f.to ? `${youOr(f.from, true)} ${f.from === me ? 'pay' : 'pays'} ${youOr(f.to)}${ok ? ' ' + money(amt, base) : ''}` : 'Pick two different people';
    return ok ? amt : null;
  };
  PAGE = {
    back: () => back(editing ? `#/g/${S.gid}/e/${editing.id}` : `#/g/${S.gid}`),
    from: (el) => { f.from = el.dataset.id; app.querySelectorAll('[data-act="from"]').forEach((b) => b.setAttribute('aria-pressed', b === el)); check(); },
    to: (el) => { f.to = el.dataset.id; app.querySelectorAll('[data-act="to"]').forEach((b) => b.setAttribute('aria-pressed', b === el)); check(); },
    sugg: (el) => {
      Object.assign(f, { from: el.dataset.from, to: el.dataset.to, amountStr: L.minorToInput(Number(el.dataset.amt), base) });
      app.querySelectorAll('[data-act="from"]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.id === f.from));
      app.querySelectorAll('[data-act="to"]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.id === f.to));
      $('#amt').value = f.amountStr; check();
    },
    save: () => {
      const amt = check(); if (amt == null) return;
      const now = Date.now();
      S.store.saveExpense(S.gid, {
        id: editing ? editing.id : newId(), type: 'payment', from: f.from, to: f.to,
        amount: amt, currency: base, rate: 1, baseCurrency: base, baseTotal: amt, date: f.date || today(), notes: f.notes.trim(),
        createdBy: editing ? editing.createdBy : me, createdAt: editing ? editing.createdAt : now, updatedBy: me, updatedAt: now, deleted: false,
      }).catch((e) => fail(e, 'Couldn’t save'));
      toast('Payment recorded');
      back(editing ? `#/g/${S.gid}/e/${editing.id}` : `#/g/${S.gid}`);
    },
  };
  app.innerHTML = `
    <div class="top"><button class="icon-btn" data-act="back" aria-label="Back">${ICON.close}</button><h1>${editing ? 'Edit settlement' : 'Settle up'}</h1></div>
    ${!editing && suggestions.length ? `<div class="section-title">Suggested</div><div class="chips" style="margin-bottom:6px">${suggestions.map((t) => `<button class="chip" data-act="sugg" data-from="${esc(t.from)}" data-to="${esc(t.to)}" data-amt="${t.amount}">${esc(youOr(t.from, true))} → ${esc(youOr(t.to))} <span class="num">${money(t.amount, base)}</span></button>`).join('')}</div>` : ''}
    <div class="field" style="margin-top:14px"><div class="label">Who paid</div><div class="chips scroll">${personChips('from')}</div></div>
    <div class="field"><div class="label">Paid to</div><div class="chips scroll">${personChips('to')}</div></div>
    <div class="field"><label for="amt">Amount (${esc(base)})</label><input id="amt" class="input amount-input num" inputmode="decimal" data-in="amt" value="${esc(f.amountStr)}" placeholder="0.00"></div>
    <div class="field"><label for="date">Date</label><input id="date" type="date" class="input" data-in="date" value="${esc(f.date)}"></div>
    <div class="field"><label for="notes">Note (optional)</label><input id="notes" class="input" maxlength="200" data-in="notes" placeholder="e.g. DuitNow transfer" value="${esc(f.notes)}"></div>
    <div class="card" style="text-align:center;font-weight:700" id="who"></div>
    <div class="sheet-foot"><button id="save" class="btn primary block" data-act="save">${editing ? 'Save' : 'Record payment'}</button></div>`;
  app.oninput = onInput((k, el) => { if (k === 'amt') { f.amountStr = el.value; check(); } else if (k === 'date') f.date = el.value; else if (k === 'notes') f.notes = el.value; });
  app.onchange = null;
  check();
}

/* ============================== SETTINGS ============================== */
function membersBoxHTML() {
  const involved = L.involvedMembers(S.expenses);
  const me = myId();
  return members().map((m) => `<div class="member-edit">${avatar(m.id, m.name)}
    <input class="input" data-mid="${esc(m.id)}" maxlength="40" value="${esc(m.name)}" aria-label="Name">
    ${involved.has(m.id) || m.id === me ? '<span style="width:42px"></span>' : `<button class="icon-btn" data-act="rmMember" data-id="${esc(m.id)}" aria-label="Remove ${esc(m.name)}">${ICON.close}</button>`}</div>`).join('');
}
function refreshSettingsMembers() {
  const box = $('#members-box');
  if (!box || box.contains(document.activeElement)) return;
  box.innerHTML = membersBoxHTML();
}
function renderSettings() {
  const g = S.group; const hasExpenses = S.expenses.length > 0;
  const upd = (patch, msg) => S.store.updateGroup(S.gid, patch).then(() => msg && toast(msg)).catch((e) => fail(e));
  PAGE = {
    back: () => back(`#/g/${S.gid}`),
    emoji: (el) => { app.querySelectorAll('.emoji-grid button').forEach((b) => b.setAttribute('aria-pressed', b === el)); upd({ emoji: el.dataset.e }); },
    addMember: () => {
      const inp = $('#newmember'); const name = inp.value.trim();
      if (!name) return inp.focus();
      if (members().some((m) => m.name.toLowerCase() === name.toLowerCase())) return toast('Name already in group');
      inp.value = '';
      upd({ [`members.${newId(10)}`]: { name, addedAt: Date.now() } }, `${name} added`);
    },
    rmMember: async (el) => {
      const id = el.dataset.id;
      if (!(await confirmSheet(`Remove ${nameOf(id)}?`, 'They aren’t in any expenses yet, so balances won’t change.', 'Remove', true))) return;
      upd({ [`members.${id}`]: S.store.DELETE }, 'Removed');
    },
    share: () => shareGroup(S.gid, g.name),
    switchMe: () => { const m = meMap(); delete m[S.gid]; LS.set('splitlah.me', m); checkIdentity(); },
    archive: () => upd({ archived: !g.archived }, g.archived ? 'Unarchived' : 'Archived — find it at the bottom of your groups'),
    csv: exportCSV,
    forget: async () => {
      if (!(await confirmSheet('Remove from this phone?', 'The group stays intact for everyone else. You can rejoin with the invite link.', 'Remove'))) return;
      forgetGroup(S.gid); location.replace('#/');
    },
  };
  app.innerHTML = `
    <div class="top"><button class="icon-btn" data-act="back" aria-label="Back">${ICON.back}</button><h1>Group settings</h1></div>
    <div class="field"><label for="gname">Group name</label><input id="gname" class="input" maxlength="60" value="${esc(g.name)}"></div>
    <div class="field"><div class="label">Icon</div><div class="emoji-grid">${EMOJIS.map((e) => `<button type="button" data-act="emoji" data-e="${e}" aria-pressed="${g.emoji === e}">${e}</button>`).join('')}</div></div>
    <div class="field"><label for="gcur">Main currency</label>
      <select id="gcur" class="input" ${hasExpenses ? 'disabled' : ''}>${Object.entries(L.CURRENCIES).map(([c, v]) => `<option value="${c}" ${c === g.currency ? 'selected' : ''}>${c} — ${esc(v.name)}</option>`).join('')}</select>
      ${hasExpenses ? '<p class="hint">Locked once expenses exist, so past balances stay exact.</p>' : ''}</div>
    <div class="section-title">People</div>
    <div class="card"><div id="members-box">${membersBoxHTML()}</div>
      <div class="member-edit" style="margin-top:6px"><input id="newmember" class="input" maxlength="40" placeholder="Add a person"><button class="btn sm primary" data-act="addMember">Add</button></div>
      <p class="hint">People in an expense can be renamed but not removed.</p></div>
    <div class="section-title">Group</div>
    <div class="card" style="display:grid;gap:10px">
      <button class="btn block" data-act="share">${ICON.share.replace('<svg', '<svg width="18" height="18"')} Invite link</button>
      <button class="btn block" data-act="csv">⬇️ Export CSV</button>
      <button class="btn block" data-act="switchMe">I’m not ${esc(nameOf(myId()))}</button>
      <button class="btn block" data-act="archive">${g.archived ? '📤 Unarchive group' : '🗄️ Archive group (trip’s over)'}</button>
      <button class="btn block danger" data-act="forget">Remove from this phone</button>
    </div>`;
  const nameInp = $('#gname');
  nameInp.onchange = () => { const v = nameInp.value.trim(); if (v && v !== g.name) upd({ name: v }, 'Renamed'); };
  $('#gcur').onchange = (e) => upd({ currency: e.target.value }, 'Currency updated');
  app.oninput = null;
  app.onchange = (e) => {
    const el = e.target.closest('[data-mid]'); if (!el) return;
    const v = el.value.trim(); const id = el.dataset.mid;
    if (!v) { el.value = nameOf(id); return; }
    if (members().some((m) => m.id !== id && m.name.toLowerCase() === v.toLowerCase())) { el.value = nameOf(id); return toast('Name already in group'); }
    if (v !== nameOf(id)) upd({ [`members.${id}.name`]: v }, 'Renamed');
  };
}

/* ============================== CSV export ============================== */
function exportCSV() {
  const g = S.group; const ms = members(); const base = g.currency;
  const cell = (v) => {
    let s = String(v ?? '');
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s; // block spreadsheet formula injection
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const num = (m, cur) => L.fromMinor(m, cur).toFixed(L.dpOf(cur));
  const head = ['Date', 'Description', 'Category', 'Type', 'Paid by / From', 'To', 'Amount', 'Currency', 'Rate', `Amount (${base})`, ...ms.map((m) => `${m.name} share (${base})`), 'Notes'];
  const rows = live().sort((a, b) => (a.date || '').localeCompare(b.date || '')).map((e) => e.type === 'payment'
    ? [e.date, 'Settlement', '', 'Payment', nameOf(e.from), nameOf(e.to), num(e.amount, base), base, 1, num(e.baseTotal, base), ...ms.map(() => ''), e.notes]
    : [e.date, e.desc, (CATS[e.category] || CATS.general)[1], 'Expense', nameOf(e.paidBy), '', num(e.amount, e.currency), e.currency, e.rate, num(e.baseTotal, base),
      ...ms.map((m) => (e.sharesBase?.[m.id] ? num(e.sharesBase[m.id], base) : '')), e.notes]);
  const { net } = groupNumbers();
  rows.push([], ['Balances'], ...ms.map((m) => ['', m.name, '', net[m.id] >= 0 ? 'gets back' : 'owes', '', '', '', '', '', num(Math.abs(net[m.id]), base)]));
  const csv = '﻿' + [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  const fname = `${g.name.replace(/[^\w\- ]+/g, '').trim() || 'splitlah'}.csv`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const file = new File([blob], fname, { type: 'text/csv' });
  if (navigator.canShare?.({ files: [file] }) && /iphone|ipad|android/i.test(navigator.userAgent)) {
    navigator.share({ files: [file], title: fname }).catch(() => {});
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = fname; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* ============================== boot ============================== */
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); S.installEvt = e; if (S.route.view === 'home') renderHome(); });

async function boot() {
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  try {
    S.store = await createStore();
    S.store.onWriteError = (e) => fail(e, 'Couldn’t save to the server');
  } catch (e) {
    console.error(e);
    window.__splitlahBooted = true;
    app.innerHTML = `<div class="brand">Split<span>Lah</span></div><div class="banner warn"><span>⚠️</span><div><b>Couldn’t connect to Firebase.</b><br>
      ${esc(explainError(e) || 'Check config.js has your Firebase keys, that Anonymous sign-in is enabled (Firebase → Authentication → Sign-in method), and that this site’s domain is in Authorized domains.')}
      <br><br><small>Error: ${esc(e?.code || e?.message || e)}</small></div></div>
      <button class="btn primary block" onclick="location.reload()">Try again</button>`;
    return;
  }
  // Handle invite links: https://site/?g=GROUPID
  const params = new URLSearchParams(location.search);
  const invite = params.get('g');
  if (invite) {
    const gid = extractGroupId(`?g=${invite}`);
    const hashGid = parseHash().parts[0] === 'g' ? parseHash().parts[1] : null;
    if (gid && hashGid !== gid) {
      try { await joinGroup(gid); history.replaceState(null, '', `${location.pathname}?g=${gid}#/g/${gid}`); lastHash = location.hash; }
      catch (e) { toast(e.code === 'not-found' ? 'That invite link is for a group that doesn’t exist' : explainError(e) || 'Couldn’t open the invite. Are you online?'); }
    }
  }
  window.__splitlahBooted = true;
  route();
}
boot();
