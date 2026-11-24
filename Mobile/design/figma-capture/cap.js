// Capture tooling for turning live screens of the web preview into static HTML snapshots.
(() => {
  const PROPS = ['display','position','top','left','right','bottom','width','height','min-width','min-height','max-width','max-height','margin-top','margin-right','margin-bottom','margin-left','padding-top','padding-right','padding-bottom','padding-left','flex-direction','flex-wrap','flex-grow','flex-shrink','flex-basis','align-items','align-self','align-content','justify-content','row-gap','column-gap','border-top-width','border-right-width','border-bottom-width','border-left-width','border-top-style','border-right-style','border-bottom-style','border-left-style','border-top-color','border-right-color','border-bottom-color','border-left-color','border-top-left-radius','border-top-right-radius','border-bottom-left-radius','border-bottom-right-radius','background-color','background-image','color','font-family','font-size','font-weight','line-height','letter-spacing','text-align','direction','white-space','overflow-x','overflow-y','opacity','transform','box-shadow','z-index','text-overflow','backdrop-filter','box-sizing','unicode-bidi','overflow-wrap','text-decoration-line'];
  const SKIP = new Set(['script','style','noscript','link','meta','title','head']);
  const SVGNS = 'http://www.w3.org/2000/svg';

  function styleOf(cs, leafText) {
    let st = '';
    for (const p of PROPS) {
      let v = cs.getPropertyValue(p);
      if (!v) continue;
      // text leaves flow inside their fixed-size parents; pinning them would break on tiny metric differences
      if (leafText && (p === 'height' || p === 'min-height')) continue;
      if (v === 'none' && (p === 'transform' || p === 'box-shadow' || p === 'backdrop-filter' || p === 'background-image' || p === 'max-width' || p === 'max-height' || p === 'text-decoration-line')) continue;
      if (v === 'auto' && (p === 'top' || p === 'left' || p === 'right' || p === 'bottom' || p === 'z-index' || p === 'min-width' || p === 'min-height')) continue;
      if (v === 'normal' && (p === 'letter-spacing' || p === 'row-gap' || p === 'column-gap' || p === 'align-content' || p === 'unicode-bidi' || p === 'overflow-wrap')) continue;
      if (v === '0px' && /^(margin|padding|border-.*-width|border-.*-radius|min-)/.test(p)) continue;
      if (/^border-.*-(style|color)$/.test(p) && cs.getPropertyValue(p.replace(/-(style|color)$/, '-width')) === '0px') continue;
      if (p === 'opacity' && v === '1') continue;
      if (p === 'background-color' && v === 'rgba(0, 0, 0, 0)') continue;
      st += p + ':' + v + ';';
    }
    return st;
  }

  function conv(el) {
    if (el.nodeType === 3) return el.nodeValue.trim() ? document.createTextNode(el.nodeValue) : null;
    if (el.nodeType !== 1) return null;
    const tag = el.tagName.toLowerCase();
    if (SKIP.has(tag)) return null;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return null;
    // content scrolled far out of view: keep a spacer above (so offsets hold), drop what is below
    const rect = el.getBoundingClientRect();
    if (rect.height > 0 && cs.position !== 'fixed') {
      if (rect.top > innerHeight + 260) return null;
      if (rect.bottom < -260) {
        const spacer = document.createElement('div');
        spacer.setAttribute('style', styleOf(cs, false) + 'visibility:hidden;');
        return spacer;
      }
    }
    if (el.namespaceURI === SVGNS) {
      const svg = el.cloneNode(true);
      svg.removeAttribute('class');
      svg.setAttribute('style', styleOf(cs, false));
      return svg;
    }
    const onlyText = el.childNodes.length === 1 && el.firstChild.nodeType === 3;
    const out = document.createElement('div');
    if (onlyText && /material/i.test(cs.fontFamily) && [...el.textContent].length === 1) {
      const size = parseFloat(cs.fontSize);
      out.setAttribute('style', styleOf(cs, false).replace(/(^|;)(font-family|line-height|width|height|display):[^;]*/g, '$1') + `display:block;width:${size}px;height:${size}px;line-height:0;flex-shrink:0;`);
      out.innerHTML = `<svg data-cp="${el.textContent.codePointAt(0).toString(16)}" width="${size}" height="${size}" fill="${cs.color}"></svg>`;
      return out;
    }
    if (tag === 'textarea' || tag === 'input') {
      let st = styleOf(cs, false);
      if (!el.value) st += 'color:#8C9A92;';
      out.setAttribute('style', st);
      out.textContent = el.value || el.placeholder || '';
      return out;
    }
    out.setAttribute('style', styleOf(cs, onlyText));
    const label = el.getAttribute('aria-label');
    if (label) out.setAttribute('data-name', label);
    for (const c of el.childNodes) {
      const n = conv(c);
      if (n) out.appendChild(n);
    }
    if (el.scrollTop > 0 && out.firstElementChild) out.firstElementChild.style.marginTop = -el.scrollTop + 'px';
    return out;
  }

  window.__snap = async (name) => {
    const out = conv(document.body);
    const html = out.innerHTML;
    await fetch('/snap?name=' + encodeURIComponent(name), { method: 'POST', body: html });
    return name + ':' + Math.round(html.length / 1024) + 'KB';
  };

  /* ---------- driving the lesson ---------- */
  const strip = (s) => s.replace(/[ً-ْ]/g, '');
  const noIcons = (s) => s.replace(/[\u{F0000}-\u{FFFFF}-]/gu, '');
  window.__sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__txt = (el) => strip(noIcons(el.innerText || '').replace(/\s+/g, ' ').trim());
  window.__btns = () => [...document.querySelectorAll('[role=button],button')].filter((b) => !b.disabled && b.getAttribute('aria-disabled') !== 'true' && b.offsetParent !== null);
  window.__by = (t) => __btns().filter((b) => __txt(b) === t);
  window.__starts = (t) => __btns().find((b) => __txt(b).startsWith(t));
  window.__label = (t) => [...document.querySelectorAll('button,[role=button]')].find((b) => b.getAttribute('aria-label') === t && b.offsetParent !== null);
  window.__body = () => strip(noIcons(document.body.innerText)).replace(/\s+/g, ' ');
  window.__kind = () => {
    const b = __body();
    if (__starts('فهمت')) return 'learn';
    const map = { 'اختر المعنى': 'meaning', 'ماذا سمعت': 'listen', 'رتب الكلمات': 'arrange', 'أكمل الجملة': 'fill', 'طابق كل': 'match', 'اكتب بالإنجليزية': 'type', 'استمع واكتب': 'dictation' };
    for (const k in map) if (b.includes(k)) return map[k];
    return null;
  };
  window.__settle = async () => {
    for (let w = 0; w < 30; w++) {
      if (__kind() || __by('متابعة')[0]) break;
      await __sleep(200);
    }
    await __sleep(500);
  };
  const tile = (w) => w.replace(/[.,!?;:"()]/g, '');
  const pairByAr = (b) => __P.filter((p) => b.includes(p[1])).sort((a, c) => c[1].length - a[1].length)[0];
  /** Fills in the answer of the current step. correct=false picks a wrong one where possible. count limits tiles/pairs. */
  window.__answer = async (correct = true, count = 99) => {
    const k = __kind();
    const b = __body();
    if (k === 'meaning') {
      const p = __P.find((p) => b.includes(p[0]));
      const opts = __btns().filter((x) => /^[1-4] /.test(__txt(x)));
      (correct ? opts.find((x) => __txt(x).endsWith(p[1])) : opts.find((x) => !__txt(x).endsWith(p[1]))).click();
    } else if (k === 'listen') {
      __btns().filter((x) => /^[1-3] /.test(__txt(x)))[0].click();
    } else if (k === 'arrange') {
      const p = pairByAr(b);
      const pool = __btns();
      const used = new Set();
      let n = 0;
      for (const w of p[0].split(' ').map(tile)) {
        if (n++ >= count) break;
        const el = pool.find((x) => !used.has(x) && __txt(x) === w);
        if (el) {
          used.add(el);
          el.click();
          await __sleep(150);
        }
      }
    } else if (k === 'fill') {
      const p = pairByAr(b);
      const set = new Set(p[0].split(' ').map(tile));
      const opts = __btns().filter((x) => /^[A-Za-z'\-]+$/.test(__txt(x)));
      (correct ? opts.find((x) => set.has(__txt(x))) : opts.find((x) => !set.has(__txt(x)))).click();
    } else if (k === 'match') {
      let n = 0;
      for (const p of __P) {
        const e = __by(p[0])[0], a = __by(p[1])[0];
        if (e && a) {
          if (n++ >= count) break;
          e.click();
          await __sleep(150);
          a.click();
          await __sleep(500);
        }
      }
    } else if (k === 'type' || k === 'dictation') {
      const ta = document.querySelector('textarea');
      const p = pairByAr(b);
      const val = p && correct ? p[0].toLowerCase().replace(/[.?]/g, '') : 'we need twenty boxes';
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, val);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await __sleep(400);
    return k;
  };
  window.__check = async () => {
    const c = __by('تحقق')[0];
    if (c) c.click();
    await __sleep(900);
  };
  window.__next = async () => {
    const c = __by('متابعة')[0] || __starts('فهمت');
    if (c) c.click();
    await __settle();
    return __kind();
  };
  /** Plays forward (answering correctly) until the current step is of the wanted kind. */
  window.__until = async (kind, max = 30) => {
    for (let i = 0; i < max; i++) {
      await __settle();
      if (__by('متابعة')[0]) { await __next(); continue; }
      const k = __kind();
      if (k === kind) return k;
      if (!k) return 'none:' + __body().slice(0, 60);
      if (k === 'learn') { await __next(); continue; }
      await __answer(true);
      if (k !== 'match') await __check();
      else await __sleep(900);
      await __next();
    }
    return 'gave-up';
  };

  /* ---------- a lived-in demo state, so every screen has real content ---------- */
  window.__demo = () => {
    const pad = (n) => String(n).padStart(2, '0');
    const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const day = (off) => { const d = new Date(); d.setDate(d.getDate() + off); return key(d); };
    const done = {}; [3, 3, 2, 3, 2, 3, 3, 2].forEach((s, i) => (done[i] = { stars: s, times: 1 }));
    const review = {};
    for (let i = 0; i < 48; i++) {
      const box = [3, 2, 4, 1, 3, 0, 2, 5, 1, 3, 2, 4][i % 12];
      review['p' + pad(i).padStart(3, '0')] = { box, due: day(box === 0 ? 0 : i % 5 === 0 ? -1 : [0, 1, 3, 7, 14, 30][box]) };
    }
    const state = {
      v: 1, onboarded: true, name: 'ليث', xp: 740, done, cases: [0],
      days: { [day(-6)]: 70, [day(-4)]: 60, [day(-3)]: 90, [day(-2)]: 130, [day(-1)]: 70, [day(0)]: 40 },
      review, favorites: ['p001', 'p013', 'p020', 'p037', 'p043'],
      recordings: { p000: { file: 'p000.webm', ms: 2400, at: Date.now() }, p007: { file: 'p007.webm', ms: 3100, at: Date.now() }, p043: { file: 'p043.webm', ms: 2900, at: Date.now() }, p048: { file: 'p048.webm', ms: 2600, at: Date.now() } },
      perfect: 4, settings: { voice: 'random', haptics: true, sfx: false, goal: 60, typing: true, autoplay: false },
    };
    localStorage.setItem('trade-english.progress.v1', JSON.stringify(state));
    return 'demo state written';
  };
})();
