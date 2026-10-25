/* Meal app behavior. All words and numbers come from content.js. */
(function () {
  'use strict';
  var C = window.CONTENT;
  var appEl = document.getElementById('app');
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var KEEP_DAYS = 30;

  /* ---------- small helpers ---------- */
  function h(tag, props) {
    var e = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (k === 'class') e.className = v;
      else if (k.indexOf('on') === 0) e[k] = v;
      else if (v !== false && v != null) e.setAttribute(k, v);
    });
    var kids = Array.prototype.slice.call(arguments, 2);
    (function add(list) {
      list.forEach(function (c) {
        if (c == null || c === false) return;
        if (Array.isArray(c)) { add(c); return; }
        e.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
      });
    })(kids);
    return e;
  }
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };

  /* ---------- dates and plan weeks ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isoOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseIso(s) { var a = s.split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); }
  function dayNumber(d) {
    var a = C.plan.start.split('-');
    return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(+a[0], +a[1] - 1, +a[2])) / 86400000);
  }
  /* week 0 = before the plan starts; the menu keeps alternating after week 4 */
  function weekOf(d) { var n = dayNumber(d); return n < 0 ? 0 : Math.floor(n / 7) + 1; }
  function menuOf(d) { var w = weekOf(d); return w === 0 ? 0 : ((w % 2 === 1) ? 0 : 1); }
  function shortDate(d, withYear) { return MON[d.getMonth()] + ' ' + d.getDate() + (withYear ? ', ' + d.getFullYear() : ''); }

  /* ---------- saved picks (on this phone only) ---------- */
  function allPicks() { var p = store.get('picks', {}); return (p && typeof p === 'object' && !Array.isArray(p)) ? p : {}; }
  function prune(p) {
    var keys = Object.keys(p).filter(function (k) {
      var x = p[k]; return x && ((x.his && Object.keys(x.his).length) || (x.her && Object.keys(x.her).length));
    }).sort().reverse();
    var out = {};
    keys.slice(0, KEEP_DAYS).forEach(function (k) { out[k] = p[k]; });
    return out;
  }
  function setPick(iso, who, meal, opt) {
    var p = allPicks();
    if (!p[iso]) p[iso] = { his: {}, her: {} };
    if (!p[iso][who]) p[iso][who] = {};
    if (p[iso][who][meal] === opt) delete p[iso][who][meal]; else p[iso][who][meal] = opt;
    store.set('picks', prune(p));
  }
  function getPick(iso, who, meal) {
    var p = allPicks(); return p[iso] && p[iso][who] ? p[iso][who][meal] : undefined;
  }

  /* ---------- shared pieces ---------- */
  function backBtn(fn) { return h('button', { class: 'btn alt back', type: 'button', onclick: fn || renderToday }, 'Back'); }
  function heading(title, purpose) {
    return [h('h1', {}, title), purpose ? h('p', { class: 'purpose' }, purpose) : null];
  }
  function bulletList(items) {
    return h('ul', { class: 'pl-list' }, items.map(function (it) {
      if (typeof it === 'string') return h('li', {}, it);
      return h('li', {}, it.t, it.sub && it.sub.length ? h('ul', {}, it.sub.map(function (s) { return h('li', {}, s); })) : null);
    }));
  }
  function optionCard(menuIdx, row) {
    var cls = 'opt ' + (row.seafood ? 'sea' : 'menu' + (menuIdx + 1));
    var parts = [h('p', { class: 'ol' }, row.opt)];
    if (!row.seafood) parts.push(h('div', { class: 'pl' }, h('span', { class: 'who' }, 'His portion'), row.his));
    parts.push(h('div', { class: 'pl' }, h('span', { class: 'who' }, 'Her portion'), row.her));
    return h('div', { class: cls }, parts);
  }
  function mealBlock(menuIdx, meal, iso) {
    var box = h('div', { class: 'menu' + (menuIdx + 1) });
    box.appendChild(h('h2', { class: 'meal-h' }, meal.name));
    meal.rows.forEach(function (r) { box.appendChild(optionCard(menuIdx, r)); });
    if (iso) {
      var picks = h('div', { class: 'picks' });
      ['his', 'her'].forEach(function (who) {
        var seg = h('div', { class: 'seg' });
        var labels = meal.rows.filter(function (r) { return who === 'her' || !r.seafood; });
        labels.forEach(function (r) {
          var text = r.seafood ? 'Seafood' : r.opt;
          var b = h('button', { class: 'btn', type: 'button' }, text);
          function paint() {
            var on = getPick(iso, who, meal.name) === r.opt;
            b.className = 'btn ' + (on ? 'on' : 'off');
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
          }
          b.onclick = function () { setPick(iso, who, meal.name, r.opt); repaint(); };
          b._paint = paint; paint();
          seg.appendChild(b);
        });
        picks.appendChild(h('div', { class: 'lab' }, who === 'his' ? 'His pick' : 'Her pick'));
        picks.appendChild(seg);
      });
      function repaint() { Array.prototype.forEach.call(picks.querySelectorAll('button'), function (b) { b._paint(); }); }
      box.appendChild(picks);
    }
    return box;
  }

  /* ---------- screens ---------- */
  function renderToday() {
    var now = new Date(), iso = isoOf(now), w = weekOf(now), m = menuOf(now);
    appEl.textContent = '';
    var top = h('div', { class: 'today-top' },
      h('div', { class: 'd' }, DAYS[now.getDay()] + ', ' + shortDate(now, false)),
      h('div', { class: 'w' }, w === 0 ? 'Plan starts Monday, Oct 26 · Menu 1' : 'Week ' + w + ' · Menu ' + (m + 1)));
    var scr = h('div', { class: 'screen' }, h('h1', {}, 'Meals'), top);
    C.menus[m].meals.forEach(function (meal) { scr.appendChild(mealBlock(m, meal, iso)); });
    var nav = h('div', { class: 'nav' });
    function go(label, fn) { nav.appendChild(h('button', { class: 'btn alt', type: 'button', onclick: fn }, label)); }
    go('Menu 1', function () { renderMenu(0); });
    go('Menu 2', function () { renderMenu(1); });
    go(C.how.title, renderHow);
    go(C.dairy.title, renderDairy);
    go(C.rules.title, renderRules);
    go(C.flavors.title, renderFlavors);
    go(C.numbers.title, renderNumbers);
    go('Past days', renderHistory);
    scr.appendChild(nav);
    appEl.appendChild(scr);
    window.scrollTo(0, 0);
  }
  function renderMenu(idx) {
    appEl.textContent = '';
    var scr = h('div', { class: 'screen' }, backBtn(), h('h1', {}, C.menus[idx].name));
    C.menus[idx].meals.forEach(function (meal) { scr.appendChild(mealBlock(idx, meal, null)); });
    scr.appendChild(backBtn());
    appEl.appendChild(scr); window.scrollTo(0, 0);
  }
  function renderHow() {
    appEl.textContent = '';
    var H = C.how;
    appEl.appendChild(h('div', { class: 'screen' }, backBtn(), heading(H.title, H.purpose),
      bulletList(H.bullets),
      h('p', { class: 'sublabel' }, H.seafoodHead), bulletList(H.seafoodBullets), backBtn()));
    window.scrollTo(0, 0);
  }
  function renderDairy() {
    appEl.textContent = '';
    var D = C.dairy;
    appEl.appendChild(h('div', { class: 'screen' }, backBtn(), heading(D.title, D.purpose),
      h('p', {}, D.intro),
      D.rows.map(function (r) { return h('div', { class: 'kv' }, h('b', {}, r[0]), h('span', { class: 'k' }, 'Adds'), r[1]); }),
      h('p', {}, D.note), backBtn()));
    window.scrollTo(0, 0);
  }
  function renderRules() {
    appEl.textContent = '';
    var R = C.rules;
    appEl.appendChild(h('div', { class: 'screen' }, backBtn(), heading(R.title, R.purpose), bulletList(R.items), backBtn()));
    window.scrollTo(0, 0);
  }
  function renderFlavors() {
    appEl.textContent = '';
    var F = C.flavors;
    appEl.appendChild(h('div', { class: 'screen' }, backBtn(), heading(F.title, F.purpose),
      h('p', {}, F.intro),
      F.rows.map(function (r) {
        return h('div', { class: 'kv' }, h('b', {}, r[0]),
          h('span', { class: 'k' }, 'What to use'), r[1], h('span', { class: 'k' }, 'Try it on'), r[2]);
      }),
      bulletList(F.bullets), backBtn()));
    window.scrollTo(0, 0);
  }
  function renderNumbers() {
    appEl.textContent = '';
    var N = C.numbers;
    appEl.appendChild(h('div', { class: 'screen' }, backBtn(), heading(N.title, N.purpose), h('p', {}, N.text), backBtn()));
    window.scrollTo(0, 0);
  }
  function pickLine(day, who) {
    var picks = day[who] || {}, bits = [];
    C.menus[0].meals.forEach(function (meal) {
      if (picks[meal.name]) bits.push(meal.name + ': ' + picks[meal.name]);
    });
    return bits.length ? h('p', {}, (who === 'his' ? 'His: ' : 'Her: ') + bits.join(' · ')) : null;
  }
  function renderHistory() {
    appEl.textContent = '';
    var p = prune(allPicks()), keys = Object.keys(p).sort().reverse(), armed = false, tm = null;
    var list = h('div', {});
    if (!keys.length) list.appendChild(h('p', { class: 'sub' }, 'No days yet.'));
    keys.forEach(function (k) {
      var d = parseIso(k), mi = menuOf(d);
      list.appendChild(h('div', { class: 'hday' },
        h('b', {}, shortDate(d, true) + ' · Menu ' + (mi + 1)), pickLine(p[k], 'his'), pickLine(p[k], 'her')));
    });
    var clr = h('button', { class: 'btn alt', type: 'button' }, 'Clear history');
    clr.onclick = function () {
      if (!armed) {
        armed = true; clr.textContent = 'Tap again to clear';
        tm = setTimeout(function () { armed = false; clr.textContent = 'Clear history'; }, 4000);
        return;
      }
      clearTimeout(tm); store.set('picks', {}); renderHistory();
    };
    appEl.appendChild(h('div', { class: 'screen' },
      h('h1', {}, 'Past days'), h('p', { class: 'sub' }, 'Your last 30 days, on this phone only.'), list,
      h('div', { class: 'hbtns' }, h('button', { class: 'btn', type: 'button', onclick: renderToday }, 'Back'), keys.length ? clr : null)));
    window.scrollTo(0, 0);
  }

  /* ---------- start, and offline copy ---------- */
  renderToday();
  document.addEventListener('visibilitychange', function () {
    /* a new day while the app was open in the background */
    if (document.visibilityState === 'visible' && document.querySelector('.today-top')) {
      var d = document.querySelector('.today-top .d');
      var now = new Date(); var want = DAYS[now.getDay()] + ', ' + shortDate(now, false);
      if (d && d.textContent !== want) renderToday();
    }
  });
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* ignore */ }); });
  }
})();
