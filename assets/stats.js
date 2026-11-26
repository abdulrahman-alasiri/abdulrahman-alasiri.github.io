/* صفحة «الإحصاءات التفصيلية» — تُحمَّل فقط عند فتحها، فلا تثقل المكتبة.
   البيانات: stats.json (تحدّثه مهمة «تحديث إحصاءات الدول» كل ساعة) + عدادات الكتب الحية من الصفحة الرئيسية. */
(function () {
  "use strict";
  const L = window.Lib || {};
  const en = L.en || ((n) => Number(n).toLocaleString("en-US"));
  const plural = L.plural || ((n) => "");
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ICON = {
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3 19.5c.8-3.2 3.2-5 6-5s5.2 1.8 6 5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.6 14.6c2.6-.4 4.6 1.2 5.4 4.4"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19h16"/><path d="m5 15 4-5 4 3 6-7"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5C6.4 4.4 9 4.6 12 6.4v13c-3-1.8-5.6-2-8-.9z"/><path d="M20 5.5c-2.4-1.1-5-.9-8 .9v13c3-1.8 5.6-2 8-.9z"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    device: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="13" height="10" rx="1.5"/><path d="M6 19h6M9 15v4"/><rect x="17" y="8" width="5" height="11" rx="1.2"/></svg>',
  };

  let root, sheet, body, lastFocus, data, drag;

  // ===== أدوات =====
  const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  let fDay; try { fDay = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "long" }); } catch (e) {}
  const dayName = (s) => { const d = new Date(s + "T12:00:00"); return fDay ? fDay.format(d) : s; };
  let names; try { names = new Intl.DisplayNames(["ar"], { type: "region" }); } catch (e) {}
  const country = (c) => { try { return (names && names.of(c.code.toUpperCase())) || c.name || c.code; } catch (e) { return c.name || c.code; } };
  const pct = (n, sum) => (sum ? Math.round((n / sum) * 100) : 0);
  const visitors = (n) => en(n) + " " + plural(n, "visitor");
  function ago(isoStr) {
    const t = Date.parse(isoStr); if (isNaN(t)) return "";
    const m = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (m < 2) return "قبل لحظات";
    if (m < 60) return "قبل " + en(m) + " " + (m <= 10 ? "دقائق" : "دقيقة");
    const h = Math.round(m / 60);
    if (h === 1) return "قبل ساعة"; if (h === 2) return "قبل ساعتين";
    if (h < 24) return "قبل " + en(h) + " " + (h <= 10 ? "ساعات" : "ساعة");
    return "بتاريخ " + dayName(isoStr.slice(0, 10));
  }
  function countUp(el, to) {
    if (RM || !to) { el.textContent = en(to); return; }
    const t0 = performance.now(), dur = 900;
    const step = (t) => { const k = Math.min(1, (t - t0) / dur); el.textContent = en(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  const growBars = (box) => requestAnimationFrame(() => setTimeout(() => box.querySelectorAll("[data-w]").forEach((b, i) => { b.style.transitionDelay = (RM ? 0 : i * 45) + "ms"; b.style.width = b.dataset.w + "%"; }), 60));

  // ===== المصادر: أسماء مفهومة =====
  const SRC = [
    [/google/i, "قوقل"], [/bing/i, "بينق"], [/yahoo/i, "ياهو"], [/duckduckgo/i, "دك دك قو"], [/yandex/i, "ياندكس"],
    [/whatsapp|wa\.me/i, "واتساب"], [/t\.co$|twitter|x\.com/i, "إكس (تويتر)"], [/telegram|t\.me/i, "تيليجرام"],
    [/youtube|youtu\.be/i, "يوتيوب"], [/facebook|fb\./i, "فيسبوك"], [/instagram/i, "إنستقرام"], [/snapchat/i, "سناب شات"],
    [/beacons|linktr\.ee|linktree/i, "صفحة الروابط (Beacons)"], [/linkedin|lnkd/i, "لينكدإن"], [/tiktok/i, "تيك توك"], [/github/i, "GitHub"], [/chatgpt|openai/i, "ChatGPT"], [/claude|anthropic/i, "Claude"],
  ];
  function srcName(r) {
    const n = (r.name || r.id || "").trim();
    if (!n || /^\(?(no data|unknown|direct)\)?$/i.test(n)) return "دخول مباشر";
    for (const [re, ar] of SRC) if (re.test(n)) return ar;
    return n.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  }
  const DEV = { phone: "جوال", largephone: "جوال", tablet: "جهاز لوحي", desktop: "كمبيوتر", desktophd: "كمبيوتر" };

  // ===== البناء =====
  function card(cls, icon, title, extra) {
    return '<section class="sx-card ' + cls + '"><div class="sx-ch"><span class="sx-ci">' + icon + "</span><h3>" + title + "</h3>" + (extra || "") + "</div>";
  }
  function rows(list, max, kind) {
    return list.map((r, i) => {
      const w = Math.max(3, Math.round((r.n / max) * 100));
      const lead = kind === "book"
        ? '<a class="sx-bk" href="' + esc(r.href) + '">' + (r.cover ? '<img src="' + esc(r.cover) + '" alt="" loading="lazy">' : '<span class="sx-nocv"></span>') + "<b>" + esc(r.name) + "</b></a>"
        : '<span class="sx-rk">' + en(i + 1) + '</span><b class="sx-nm">' + esc(r.name) + "</b>";
      return '<li class="sx-row' + (i >= 6 ? " sx-more-row" : "") + '">' + lead +
        '<span class="sx-val"><b dir="ltr">' + en(r.n) + "</b>" + (r.p != null ? '<i dir="ltr">' + r.p + "%</i>" : "") + "</span>" +
        '<span class="sx-bar"><i data-w="' + w + '"></i></span></li>';
    }).join("");
  }
  function list(cls, icon, title, items, kind, note) {
    if (!items.length) return "";
    const max = items[0].n;
    const more = items.length > 6 ? '<button type="button" class="sx-all">عرض الكل (' + en(items.length) + ")</button>" : "";
    return card(cls, icon, title) + (note ? '<p class="sx-hint">' + note + "</p>" : "") + '<ol class="sx-list">' + rows(items, max, kind) + "</ol>" + more + "</section>";
  }

  function build() {
    const st = data.stats || {};
    const total = data.total || st.total || 0;
    const last28 = data.last28 || st.last28 || 0;
    const ctry = (Array.isArray(st.countries) ? st.countries : []).filter((c) => c && c.code && c.count > 0).sort((a, b) => b.count - a.count);
    const cSum = ctry.reduce((a, c) => a + c.count, 0);

    // الكتب: العدادات الحية أولاً، ثم stats.json
    const books = data.books || [], bp = L.bookPath || ((b) => "/book/" + b.id);
    const byPath = new Map(); (st.pages || []).forEach((p) => byPath.set(p.path, p.count));
    const bookRows = books.map((b) => {
      const live = data.views && data.views.get ? data.views.get(b) : 0;
      return { name: b.title, cover: b.cover, href: L.readerUrl ? L.readerUrl(b) : "read.html?b=" + encodeURIComponent(b.file), n: Math.max(live || 0, byPath.get(bp(b)) || 0) };
    }).filter((r) => r.n > 0).sort((a, b) => b.n - a.n);

    const srcMap = new Map(); (st.refs || []).forEach((r) => { const k = srcName(r); srcMap.set(k, (srcMap.get(k) || 0) + r.count); });
    const srcSum = [...srcMap.values()].reduce((a, n) => a + n, 0);
    const srcRows = [...srcMap].map(([name, n]) => ({ name, n, p: pct(n, srcSum) })).sort((a, b) => b.n - a.n);

    const devMap = new Map(); (st.sizes || []).forEach((s) => { const k = DEV[String(s.id || s.name).toLowerCase()]; if (k) devMap.set(k, (devMap.get(k) || 0) + s.count); });
    const devSum = [...devMap.values()].reduce((a, n) => a + n, 0);
    const devRows = ["جوال", "كمبيوتر", "جهاز لوحي"].filter((k) => devMap.get(k)).map((k) => ({ name: k, n: devMap.get(k), p: pct(devMap.get(k), devSum) }));

    const daily = Array.isArray(st.daily) ? st.daily : [];
    const today = data.today != null ? data.today : (daily.length && daily[daily.length - 1][0] === iso(new Date()) ? daily[daily.length - 1][1] : null);

    const kpi = (ic, lbl, n, word, cls) => '<div class="sx-kpi ' + (cls || "") + '"><span class="sx-ki">' + ic + '</span><span class="sx-kl">' + lbl + '</span><b dir="ltr" data-n="' + n + '">0</b><small>' + word + "</small></div>";

    let h = '<div class="sx-kpis">' +
      kpi(ICON.users, "منذ إطلاق الموقع", total, plural(total, "visitor"), "k1") +
      (last28 ? kpi(ICON.cal, "آخر 28 يوماً", last28, plural(last28, "visitor")) : "") +
      (today != null ? kpi(ICON.sun, "اليوم", today, plural(today, "visitor"), "live") : "") +
      (ctry.length ? kpi(ICON.globe, "دول الزوار", ctry.length, plural(ctry.length, "country")) : "") +
      "</div>";

    if (daily.some((d) => d[1] > 0)) {
      h += card("sx-trend", ICON.chart, "الزيارات اليومية", '<div class="sx-seg" role="tablist" aria-label="الفترة"></div>') +
        '<div class="sx-sum" aria-live="polite"></div><div class="sx-plot"><svg aria-hidden="true"></svg><div class="sx-tip" hidden></div></div></section>';
    }
    h += '<div class="sx-two">' +
      list("sx-books", ICON.book, "أكثر الكتب قراءة", bookRows, "book", "عدد الزوار الذين فتحوا الكتاب — اضغط على أي كتاب لفتحه.") +
      list("sx-ctry", ICON.globe, "الزوار حسب الدولة", ctry.map((c) => ({ name: country(c), n: c.count, p: pct(c.count, cSum) })), "row") +
      "</div>";
    if (srcRows.length || devRows.length) {
      h += '<div class="sx-two">' + list("sx-src", ICON.link, "من أين وصل الزوار", srcRows, "row");
      if (devRows.length) {
        h += card("sx-dev", ICON.device, "أجهزة الزوار") + '<div class="sx-stack">' +
          devRows.map((d, i) => '<i class="d' + i + '" data-w="' + d.p + '" title="' + esc(d.name) + '"></i>').join("") + '</div><ul class="sx-legend">' +
          devRows.map((d, i) => '<li><span class="dot d' + i + '"></span>' + d.name + '<b dir="ltr">' + d.p + "%</b></li>").join("") + "</ul></section>";
      }
      h += "</div>";
    }
    h += '<p class="sx-foot">تتحدّث الأرقام تلقائياً كل ساعة، ويُحسب الزائر مرة واحدة في اليوم. لا تُجمع أي بيانات شخصية عن الزوار.</p>';
    body.innerHTML = h;
    root.querySelector(".sx-upd").textContent = st.updated ? "آخر تحديث " + ago(st.updated) : "";

    body.querySelectorAll(".sx-kpi b").forEach((b) => countUp(b, +b.dataset.n));
    body.querySelectorAll(".sx-card").forEach((c) => growBars(c));
    body.querySelectorAll(".sx-all").forEach((btn) => btn.addEventListener("click", () => {
      const c = btn.closest(".sx-card"); c.classList.add("open"); btn.remove();
      growBars(c); c.querySelector(".sx-more-row").scrollIntoView({ block: "nearest", behavior: RM ? "auto" : "smooth" });
    }));
    if (body.querySelector(".sx-trend")) trend(daily);
  }

  // ===== منحنى الزيارات اليومية (SVG خفيف) =====
  function trend(daily) {
    const sec = body.querySelector(".sx-trend"), seg = sec.querySelector(".sx-seg"), svg = sec.querySelector(".sx-plot svg"), tip = sec.querySelector(".sx-tip"), sum = sec.querySelector(".sx-sum");
    const map = new Map(daily);
    const first = daily.find((d) => d[1] > 0)[0];
    const span = Math.round((new Date(iso(new Date()) + "T12:00:00") - new Date(first + "T12:00:00")) / 86400000) + 1;
    const opts = [[7, "7 أيام"], [30, "30 يوماً"], [90, "الكل"]].filter(([n], i, a) => i === 0 || span > a[i - 1][0]);
    let range = opts[opts.length > 1 ? 1 : 0][0], pts = [];
    if (opts.length > 1) {
      seg.innerHTML = opts.map(([n, t]) => '<button type="button" role="tab" data-n="' + n + '">' + t + "</button>").join("");
      seg.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { range = +b.dataset.n; draw(true); } });
    }
    function series() {
      const n = Math.min(range, Math.max(span, 2)), out = [], d = new Date(); d.setHours(12, 0, 0, 0);
      for (let i = n - 1; i >= 0; i--) { const x = new Date(d - i * 86400000), k = iso(x); out.push([k, map.get(k) || 0]); }
      return out;
    }
    function draw(anim) {
      seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", +b.dataset.n === range));
      const s = series(), W = Math.max(280, svg.parentNode.clientWidth), H = W < 520 ? 180 : 220, P = { t: 14, r: 10, b: 28, l: 34 };
      const max = Math.max(4, ...s.map((x) => x[1])), nice = Math.ceil(max / 4) * 4;
      const iw = W - P.l - P.r, ih = H - P.t - P.b, step = s.length > 1 ? iw / (s.length - 1) : 0;
      // الأحدث يسار (اتجاه القراءة العربي): الأقدم في اليمين
      pts = s.map((x, i) => ({ d: x[0], n: x[1], x: W - P.r - i * step, y: P.t + ih - (x[1] / nice) * ih }));
      const line = pts.map((p, i) => {
        if (!i) return "M" + p.x.toFixed(1) + " " + p.y.toFixed(1);
        const q = pts[i - 1], cx = (q.x + p.x) / 2;
        return "C" + cx.toFixed(1) + " " + q.y.toFixed(1) + " " + cx.toFixed(1) + " " + p.y.toFixed(1) + " " + p.x.toFixed(1) + " " + p.y.toFixed(1);
      }).join("");
      const base = P.t + ih, last = pts[pts.length - 1], firstP = pts[0];
      let g = "";
      for (let k = 0; k <= 4; k++) { const y = P.t + ih - (k / 4) * ih; g += '<line x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + y + '" y2="' + y + '" class="gl"/><text x="' + (P.l - 8) + '" y="' + (y + 4) + '" class="ya">' + en((nice / 4) * k) + "</text>"; }
      const every = Math.ceil(s.length / (W < 520 ? 4 : 7));
      pts.forEach((p, i) => { if ((s.length - 1 - i) % every === 0) g += '<text x="' + p.x + '" y="' + (H - 8) + '" class="xa">' + esc(dayName(p.d)) + "</text>"; });
      svg.setAttribute("viewBox", "0 0 " + W + " " + H); svg.setAttribute("width", W); svg.setAttribute("height", H);
      svg.innerHTML = '<defs><linearGradient id="sxFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="f0"/><stop offset="1" class="f1"/></linearGradient></defs>' + g +
        '<path class="ar" d="' + line + "L" + last.x + " " + base + "L" + firstP.x + " " + base + 'Z"/><path class="ln" d="' + line + '"/>' +
        '<line class="cur" y1="' + P.t + '" y2="' + base + '" hidden/><circle class="pt" r="5" hidden/>';
      const ln = svg.querySelector(".ln");
      if (anim && !RM) { const L2 = ln.getTotalLength(); ln.style.strokeDasharray = L2; ln.style.strokeDashoffset = L2; ln.getBoundingClientRect(); ln.style.transition = "stroke-dashoffset 1s cubic-bezier(.3,.7,.2,1)"; ln.style.strokeDashoffset = 0; }
      const tot = s.reduce((a, x) => a + x[1], 0), best = s.reduce((a, x) => (x[1] > a[1] ? x : a), s[0]);
      sum.innerHTML = "<span>المجموع <b>" + en(tot) + "</b></span><span>المعدل <b>" + en(Math.round((tot / s.length) * 10) / 10) + "</b> يومياً</span>" + (best[1] ? "<span>أعلى يوم <b>" + esc(dayName(best[0])) + "</b> (" + en(best[1]) + ")</span>" : "");
      tip.hidden = true;
    }
    function hover(e) {
      const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) * (svg.viewBox.baseVal.width / r.width);
      let p = pts[0]; for (const q of pts) if (Math.abs(q.x - x) < Math.abs(p.x - x)) p = q;
      const cur = svg.querySelector(".cur"), pt = svg.querySelector(".pt");
      cur.setAttribute("x1", p.x); cur.setAttribute("x2", p.x); cur.removeAttribute("hidden");
      pt.setAttribute("cx", p.x); pt.setAttribute("cy", p.y); pt.removeAttribute("hidden");
      tip.innerHTML = "<b>" + esc(dayName(p.d)) + "</b>" + esc(visitors(p.n)); tip.hidden = false;
      const k = r.width / svg.viewBox.baseVal.width, tw = tip.offsetWidth;
      tip.style.left = Math.min(r.width - tw - 4, Math.max(4, p.x * k - tw / 2)) + "px"; tip.style.top = Math.max(0, p.y * k - 66) + "px";
    }
    svg.addEventListener("pointermove", hover); svg.addEventListener("pointerdown", hover);
    svg.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") { tip.hidden = true; svg.querySelectorAll(".cur,.pt").forEach((n) => n.setAttribute("hidden", "")); } });
    let rt; const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => draw(false), 120); }); ro.observe(svg.parentNode);
    draw(true);
  }

  // ===== الفتح والإغلاق =====
  function ensure() {
    if (root) return;
    root = document.createElement("div");
    root.className = "sx"; root.hidden = true;
    root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-labelledby", "sxH");
    root.innerHTML = '<div class="sx-scrim"></div><div class="sx-sheet" tabindex="-1"><div class="sx-grab" aria-hidden="true"><i></i></div>' +
      '<header class="sx-head"><div class="sx-tt"><span class="sx-kick">' + ICON.users + 'لوحة الزوار</span><h2 id="sxH">الإحصاءات التفصيلية</h2><p class="sx-upd"></p></div>' +
      '<button type="button" class="sx-x" aria-label="إغلاق الإحصاءات" title="إغلاق (Esc)">' + ICON.x + "</button></header>" +
      '<div class="sx-body"></div></div>';
    document.body.appendChild(root);
    sheet = root.querySelector(".sx-sheet"); body = root.querySelector(".sx-body");
    root.querySelector(".sx-x").addEventListener("click", requestClose);
    root.querySelector(".sx-scrim").addEventListener("click", requestClose);
    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); requestClose(); }
      if (e.key === "Tab") { // إبقاء التنقل داخل اللوحة
        const f = [...sheet.querySelectorAll("button,a[href]")].filter((n) => n.offsetParent); if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
    // السحب للأسفل للإغلاق (الجوال)
    sheet.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1 || (body.scrollTop > 0 && !e.target.closest(".sx-grab,.sx-head"))) return;
      drag = { y: e.touches[0].clientY, dy: 0 };
    }, { passive: true });
    sheet.addEventListener("touchmove", (e) => {
      if (!drag) return; drag.dy = Math.max(0, e.touches[0].clientY - drag.y);
      if (drag.dy > 6) { sheet.style.transition = "none"; sheet.style.transform = "translateY(" + drag.dy + "px)"; }
    }, { passive: true });
    sheet.addEventListener("touchend", () => {
      if (!drag) return; const dy = drag.dy; drag = null; sheet.style.transition = ""; sheet.style.transform = "";
      if (dy > 110) requestClose();
    });
    window.addEventListener("popstate", () => { if (!root.hidden && !isHash()) hide(); });
  }
  const HASH = "#إحصاءات";
  const isHash = () => { try { return decodeURIComponent(location.hash) === HASH; } catch (e) { return false; } };

  function open(d) {
    ensure(); data = d || {};
    if (!root.hidden) return;
    lastFocus = document.activeElement;
    if (!isHash()) history.pushState({ sx: 1 }, "", HASH);
    document.documentElement.classList.add("sx-lock");
    root.hidden = false; build(); body.scrollTop = 0;
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("in")));
    setTimeout(() => sheet.focus({ preventScroll: true }), 30);
  }
  function requestClose() {
    if (history.state && history.state.sx) history.back(); // يغلق عبر popstate ويُبقي سجل التصفح نظيفاً
    else { if (isHash()) history.replaceState(null, "", location.pathname + location.search); hide(); }
  }
  function hide() {
    if (!root || root.hidden) return;
    root.classList.remove("in");
    const done = () => { root.hidden = true; document.documentElement.classList.remove("sx-lock"); body.innerHTML = ""; if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); };
    RM ? done() : setTimeout(done, 280);
  }
  window.StatsPanel = { open, close: requestClose, isHash };
})();
