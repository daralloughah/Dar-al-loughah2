/* ============================================================
   DAR AL LOUGHAH — app.js  (v3 : affiche la forme exacte)
   Dépend de : stopwords.js, engine.js (, pdfreader.js)
   ============================================================ */
(function () {
  "use strict";

  const PAGE = 60;
  const LS_KEY = "dar_analyses_v1";

  const $ = (id) => document.getElementById(id);
  const pasteArea  = $("pasteArea");
  const fileInput  = $("fileInput");
  const fileName   = $("fileName");
  const btnAnalyze = $("btnAnalyze");
  const optStop    = $("optStopwords");
  const optArticle = $("optArticle");
  const optDia     = $("optDiacritics");

  const statsBlock = $("statsBlock");
  const statTotal  = $("statTotal");
  const statUnique = $("statUnique");
  const statKept   = $("statKept");

  const toolbar    = $("toolbar");
  const searchIn   = $("searchInput");
  const sortSel    = $("sortSelect");
  const resultsMeta= $("resultsMeta");
  const resultsList= $("resultsList");
  const loadMore   = $("loadMore");
  const emptyState = $("emptyState");

  let currentResult = null;
  let currentExports = null;
  let view = [];
  let shown = 0;
  let currentTitle = "";

  injectStyles();
  const coverBanner = injectCoverageBanner();
  const exportBar   = injectExportBar();
  const savedBox    = injectSavedBox();
  const toastEl     = injectToast();

  function injectStyles() {
    const css = `
    .cover-banner{display:none;align-items:center;gap:12px;margin-bottom:18px;
      padding:14px 16px;border-radius:14px;
      background:linear-gradient(160deg,rgba(212,175,55,.16),rgba(17,26,58,.6));
      border:1px solid rgba(212,175,55,.4);box-shadow:inset 0 0 18px rgba(212,175,55,.08)}
    .cover-banner .cb-ic{font-size:22px;filter:drop-shadow(0 0 8px rgba(212,175,55,.6))}
    .cover-banner b{color:var(--gold);font-family:var(--ff-disp);font-size:19px}
    .cover-banner span{font-size:13px;color:var(--text-dim);line-height:1.5}
    .export-bar{display:none;flex-wrap:wrap;gap:8px;margin-bottom:14px}
    .export-bar .xbtn{flex:1;min-width:120px;font-family:var(--ff-ui);font-size:13px;
      cursor:pointer;border-radius:999px;padding:11px 12px;display:inline-flex;
      align-items:center;justify-content:center;gap:6px;transition:.15s;
      color:var(--night-0);font-weight:600;
      background:linear-gradient(180deg,var(--gold-hi),var(--gold) 50%,var(--gold-deep));
      box-shadow:0 4px 14px rgba(0,0,0,.35)}
    .export-bar .xbtn:active{transform:scale(.97)}
    .export-bar .xbtn.alt{color:var(--gold-soft);font-weight:500;
      background:rgba(20,34,77,.55);border:1px solid rgba(212,175,55,.4);box-shadow:none}
    .word-variants{grid-column:1/-1;margin-top:8px;padding-top:8px;
      border-top:1px dashed rgba(212,175,55,.25);font-family:var(--ff-ar);
      font-size:16px;color:var(--text-dim);direction:rtl;text-align:right;line-height:1.8}
    .word-row{cursor:pointer}
    .word-row .vhint{font-size:10px;color:var(--gold-deep);margin-right:6px}
    .saved-box{margin-bottom:18px}
    .saved-box h3{font-family:var(--ff-disp);font-size:14px;color:var(--gold-soft);
      margin-bottom:10px;text-align:center}
    .saved-item{display:flex;align-items:center;gap:10px;padding:10px 12px;
      background:rgba(17,26,58,.6);border:1px solid rgba(212,175,55,.2);
      border-radius:12px;margin-bottom:8px}
    .saved-item .si-main{flex:1;min-width:0}
    .saved-item .si-title{font-size:14px;color:var(--text);overflow:hidden;
      text-overflow:ellipsis;white-space:nowrap}
    .saved-item .si-sub{font-size:11px;color:var(--text-mut)}
    .saved-item button{background:none;border:none;cursor:pointer;font-size:13px;
      padding:6px 10px;border-radius:8px;color:var(--gold-soft)}
    .saved-item button.del{color:#c97}
    .saved-item button:hover{background:rgba(212,175,55,.12)}
    .toast{position:fixed;bottom:88px;left:50%;transform:translateX(-50%) translateY(20px);
      background:linear-gradient(160deg,var(--gold-soft),var(--gold-deep));
      color:var(--night-0);font-family:var(--ff-ui);font-weight:600;font-size:14px;
      padding:12px 22px;border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.5);
      opacity:0;pointer-events:none;transition:.3s;z-index:50}
    .toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
    .processing{opacity:.5;pointer-events:none}`;
    const s = document.createElement("style");
    s.textContent = css;
    document.head.appendChild(s);
  }

  function injectCoverageBanner() {
    const el = document.createElement("div");
    el.className = "cover-banner";
    el.innerHTML = `<span class="cb-ic">📖</span><span id="coverTxt"></span>`;
    statsBlock.insertAdjacentElement("afterend", el);
    return el;
  }

  function injectExportBar() {
    const el = document.createElement("div");
    el.className = "export-bar";
    el.innerHTML = `
      <button class="xbtn" data-act="copy">📋 Tout copier</button>
      <button class="xbtn alt" data-act="csv">⬇ CSV (Excel)</button>
      <button class="xbtn alt" data-act="json">⬇ JSON</button>
      <button class="xbtn alt" data-act="save">💾 Sauvegarder</button>`;
    toolbar.insertAdjacentElement("beforebegin", el);
    el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (b) handleExport(b.dataset.act);
    });
    return el;
  }

  function injectSavedBox() {
    const el = document.createElement("section");
    el.className = "saved-box";
    el.hidden = true;
    el.innerHTML = `<h3>Mes analyses sauvegardées</h3><div id="savedList"></div>`;
    statsBlock.insertAdjacentElement("beforebegin", el);
    return el;
  }

  function injectToast() {
    const el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
    return el;
  }

  /* ============================================================
     LECTURE FICHIER .txt / .pdf
     ============================================================ */
  fileInput.addEventListener("change", () => {
    const f = fileInput.files[0];
    if (!f) return;
    currentTitle = f.name.replace(/\.(txt|pdf)$/i, "");

    const isPdf = /\.pdf$/i.test(f.name) || f.type === "application/pdf";

    if (isPdf) {
      if (!window.DarPDF) { toast("Module PDF non chargé"); return; }
      btnAnalyze.classList.add("processing");
      fileName.textContent = f.name + " — extraction…";

      window.DarPDF.extractText(f, (page, total) => {
        fileName.textContent = `${f.name} — page ${page}/${total}…`;
      }).then((text) => {
        pasteArea.value = text;
        btnAnalyze.classList.remove("processing");
        if (!text.trim()) {
          fileName.textContent = f.name + " — aucun texte trouvé";
          toast("PDF scanné ? Aucun texte (OCR nécessaire)");
        } else {
          fileName.textContent =
            `${f.name} ✓ (${text.length.toLocaleString("fr-FR")} caractères)`;
          toast("PDF lu ✓ — clique sur Analyser");
        }
      }).catch((err) => {
        console.error(err);
        btnAnalyze.classList.remove("processing");
        fileName.textContent = f.name + " — échec de lecture";
        toast("Impossible de lire ce PDF");
      });
      return;
    }

    fileName.textContent = f.name;
    const reader = new FileReader();
    reader.onload = () => { pasteArea.value = reader.result; };
    reader.onerror = () => toast("Erreur de lecture du fichier");
    reader.readAsText(f, "UTF-8");
  });

  /* ============================================================
     ANALYSE
     ============================================================ */
  btnAnalyze.addEventListener("click", runAnalyze);

  function runAnalyze() {
    const text = pasteArea.value.trim();
    if (!text) { toast("Colle ou importe un texte d'abord"); return; }

    btnAnalyze.classList.add("processing");
    btnAnalyze.textContent = "Analyse en cours…";

    setTimeout(() => {
      const result = window.DarEngine.analyze(text, {
        removeStopwords: optStop.checked,
        article:         optArticle.checked,
        diacritics:      optDia.checked
      });

      if (!currentTitle) currentTitle = "Analyse du " + new Date().toLocaleDateString("fr-FR");

      currentResult  = result;
      currentExports = window.DarEngine.buildExports(result, { title: currentTitle });

      renderStats(result);
      renderCoverage(result);
      applyFilterSort();

      statsBlock.hidden = false;
      coverBanner.style.display = "flex";
      exportBar.style.display = "flex";
      toolbar.hidden = false;
      resultsMeta.hidden = false;
      emptyState.hidden = true;

      btnAnalyze.classList.remove("processing");
      btnAnalyze.textContent = "Analyser le texte";

      toast(result.stats.unique + " mots uniques trouvés ✦");
      resultsMeta.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 30);
  }

  function renderStats(r) {
    animateNum(statTotal,  r.stats.totalRaw);
    animateNum(statUnique, r.stats.unique);
    animateNum(statKept,   r.stats.keptTotal);
  }

  function renderCoverage(r) {
    const c = r.stats.coverage;
    const txt = $("coverTxt");
    if (c.p80 > 0) {
      txt.innerHTML = `Apprends les <b>${c.p80}</b> mots les plus fréquents ` +
        `et tu comprends déjà <b>80%</b> du texte.<br>` +
        `<span>${c.p50} mots = 50% · ${c.p90} mots = 90% · ` +
        `richesse lexicale ${r.stats.ttr}%</span>`;
    } else {
      txt.innerHTML = `<b>${r.stats.unique}</b> mots uniques · ` +
        `${r.stats.hapax} mots rares (vus 1 seule fois)`;
    }
  }

  /* ============================================================
     FILTRE + TRI + PAGINATION
     ============================================================ */
  searchIn.addEventListener("input", debounce(applyFilterSort, 180));
  sortSel.addEventListener("change", applyFilterSort);
  loadMore.addEventListener("click", renderMore);

  function applyFilterSort() {
    if (!currentResult) return;
    const q = searchIn.value.trim();
    let arr = currentResult.words;

    if (q) arr = arr.filter(w => w.word.includes(q) || (w.display && w.display.includes(q)));

    arr = arr.slice();
    switch (sortSel.value) {
      case "freq-asc": arr.sort((a, b) => a.count - b.count || a.word.localeCompare(b.word, "ar")); break;
      case "alpha":    arr.sort((a, b) => a.word.localeCompare(b.word, "ar")); break;
      default:         arr.sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, "ar"));
    }

    view = arr;
    shown = 0;
    resultsList.innerHTML = "";
    renderMore();

    resultsMeta.textContent = view.length + " mot(s) affiché(s)" +
      (q ? ` · recherche : « ${q} »` : "");
  }

  function renderMore() {
    const max = currentResult ? currentResult.stats.maxCount : 1;
    const slice = view.slice(shown, shown + PAGE);
    const frag = document.createDocumentFragment();

    slice.forEach((w) => {
      const li = document.createElement("li");
      li.className = "word-row";
      li.style.animationDelay = ((view.indexOf(w) % PAGE) * 8) + "ms";

      const pct = Math.max(4, (w.count / max) * 100);
      const vhint = w.variants > 1 ? `<span class="vhint">${w.variants} formes</span>` : "";

      li.innerHTML =
        `<span class="word-rank">${w.rank}</span>` +
        `<span class="word-text" dir="rtl">${w.display || w.word}${vhint}</span>` +
        `<span class="word-meta"><span class="word-count">${w.count}</span>` +
        `<i class="word-bar"><i style="width:${pct}%"></i></i></span>`;

      if (w.variants > 1) {
        li.addEventListener("click", () => toggleVariants(li, w));
      }
      frag.appendChild(li);
    });

    resultsList.appendChild(frag);
    shown += slice.length;
    loadMore.hidden = shown >= view.length;
    loadMore.textContent = `Afficher plus (${view.length - shown} restants)`;
  }

  function toggleVariants(li, w) {
    const existing = li.querySelector(".word-variants");
    if (existing) { existing.remove(); return; }
    const div = document.createElement("div");
    div.className = "word-variants";
    div.textContent = "Formes rencontrées : " + w.variantList.join("، ");
    li.appendChild(div);
  }

  /* ============================================================
     EXPORTS
     ============================================================ */
  function handleExport(act) {
    if (!currentExports) { toast("Lance une analyse d'abord"); return; }
    if (act === "copy") {
      copyText(currentExports.text, "Liste complète copiée 📋");
    } else if (act === "csv") {
      download(currentExports.csv, slug(currentTitle) + ".csv", "text/csv;charset=utf-8");
      toast("CSV téléchargé ⬇");
    } else if (act === "json") {
      download(currentExports.json, slug(currentTitle) + ".json", "application/json");
      toast("JSON téléchargé ⬇");
    } else if (act === "save") {
      saveAnalysis();
    }
  }

  function copyText(str, okMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(str).then(
        () => toast(okMsg),
        () => fallbackCopy(str, okMsg)
      );
    } else {
      fallbackCopy(str, okMsg);
    }
  }
  function fallbackCopy(str, okMsg) {
    const ta = document.createElement("textarea");
    ta.value = str; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); toast(okMsg); }
    catch (e) { toast("Copie impossible — sélectionne à la main"); }
    document.body.removeChild(ta);
  }

  function download(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ============================================================
     SAUVEGARDE LOCALE
     ============================================================ */
  function saveAnalysis() {
    if (!currentResult) return;
    const name = prompt("Nom de cette analyse :", currentTitle) || currentTitle;
    const entry = {
      id: Date.now(),
      title: name,
      date: new Date().toLocaleString("fr-FR"),
      options: currentResult.options,
      stats: currentResult.stats,
      words: currentResult.words.map(w => ({
        rank: w.rank, word: w.word, display: w.display, count: w.count,
        share: w.share, variants: w.variants, variantList: w.variantList
      }))
    };
    const all = loadSaved();
    all.unshift(entry);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(all.slice(0, 30)));
      toast("Analyse sauvegardée 💾");
      renderSaved();
    } catch (e) {
      toast("Stockage plein — supprime d'anciennes analyses");
    }
  }

  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
    catch (e) { return []; }
  }

  function renderSaved() {
    const all = loadSaved();
    const list = $("savedList");
    if (!all.length) { savedBox.hidden = true; return; }
    savedBox.hidden = false;
    list.innerHTML = "";
    all.forEach((a) => {
      const item = document.createElement("div");
      item.className = "saved-item";
      item.innerHTML =
        `<div class="si-main">
           <div class="si-title">${escapeHtml(a.title)}</div>
           <div class="si-sub">${a.date} · ${a.stats.unique} mots uniques</div>
         </div>
         <button data-open="${a.id}">Ouvrir</button>
         <button class="del" data-del="${a.id}">✕</button>`;
      list.appendChild(item);
    });
    list.onclick = (e) => {
      const open = e.target.closest("[data-open]");
      const del  = e.target.closest("[data-del]");
      if (open) reopenAnalysis(Number(open.dataset.open));
      if (del)  deleteAnalysis(Number(del.dataset.del));
    };
  }

  function reopenAnalysis(id) {
    const a = loadSaved().find(x => x.id === id);
    if (!a) return;
    currentTitle = a.title;
    currentResult = {
      options: a.options, generatedAt: a.date,
      words: a.words.map(w => ({ ...w, display: w.display || w.word, variantList: w.variantList || [w.word] })),
      stats: a.stats
    };
    currentExports = window.DarEngine.buildExports(currentResult, { title: a.title });
    renderStats(currentResult);
    renderCoverage(currentResult);
    applyFilterSort();
    statsBlock.hidden = false;
    coverBanner.style.display = "flex";
    exportBar.style.display = "flex";
    toolbar.hidden = false;
    resultsMeta.hidden = false;
    emptyState.hidden = true;
    toast("Analyse « " + a.title + " » rouverte");
    statsBlock.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function deleteAnalysis(id) {
    const all = loadSaved().filter(x => x.id !== id);
    localStorage.setItem(LS_KEY, JSON.stringify(all));
    renderSaved();
    toast("Analyse supprimée");
  }

  /* ============================================================
     NAVIGATION BASSE
     ============================================================ */
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
    });
  });

  /* ============================================================
     Utilitaires
     ============================================================ */
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  function animateNum(el, target) {
    const dur = 600, t0 = performance.now(), start = 0;
    function step(now) {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(start + (target - start) * eased).toLocaleString("fr-FR");
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function debounce(fn, ms) {
    let t; return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
  }

  function slug(s) {
    return (s || "analyse").replace(/[^\w\u0621-\u064A-]+/g, "_").slice(0, 40) || "analyse";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  renderSaved();
})();
