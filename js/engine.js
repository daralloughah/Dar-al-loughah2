/* ============================================================
   DAR AL LOUGHAH — engine.js  (v3 : mots entiers + forme exacte)
   100% local, déterministe. API : window.DarEngine
   ============================================================ */
(function () {
  "use strict";

  // Harakat / tachkîl / signes (supprimés UNIQUEMENT dans normalize)
  const RE_TASHKEEL = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g;
  const RE_TATWEEL  = /\u0640/g;
  // On GARDE lettres + harakat ; tout le reste est un séparateur.
  const RE_NOT_ARABIC = /[^\u0621-\u065F\u0670\u0671]+/g;

  /* --- Normalisation : produit la CLÉ de comptage (sans harakat) --- */
  function normalize(word, opts) {
    let w = word;
    if (opts.diacritics) w = w.replace(RE_TASHKEEL, "");
    if (opts.tatweel)    w = w.replace(RE_TATWEEL, "");
    if (opts.alef)  w = w.replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627");
    if (opts.hamza) {
      w = w.replace(/\u0624/g, "\u0648");
      w = w.replace(/\u0626/g, "\u064A");
      w = w.replace(/\u0621/g, "");
    }
    if (opts.ya) w = w.replace(/\u0649/g, "\u064A");
    if (opts.taMarbuta) w = w.replace(/\u0629/g, "\u0647");
    if (opts.article && w.length > 3 && w.startsWith("\u0627\u0644")) w = w.slice(2);
    return w.trim();
  }

  /* --- Découpe en mots ENTIERS (harakat conservées ici) --- */
  function tokenize(rawText) {
    if (!rawText) return [];
    return rawText
      .normalize("NFKC")
      .replace(RE_NOT_ARABIC, " ")
      .split(/\s+/)
      .filter(Boolean);
  }

  /* --- Analyse complète --- */
  function analyze(rawText, options) {
    const opts = Object.assign({
      diacritics: true, tatweel: true, alef: true, ya: true,
      hamza: true, taMarbuta: false, article: false,
      removeStopwords: false, minLength: 1
    }, options || {});

    const stopwords = window.AR_STOPWORDS || new Set();
    const rawTokens = tokenize(rawText);
    const totalRaw = rawTokens.length;

    // clé normalisée -> { count, forms:Map(formeOriginale->n), first }
    const map = new Map();
    let keptTotal = 0;

    for (let i = 0; i < rawTokens.length; i++) {
      const raw  = rawTokens[i];
      const norm = normalize(raw, opts);
      if (!norm || norm.length < opts.minLength) continue;
      if (opts.removeStopwords && stopwords.has(norm)) continue;

      keptTotal++;
      let e = map.get(norm);
      if (!e) { e = { word: norm, count: 0, forms: new Map(), first: i }; map.set(norm, e); }
      e.count++;
      e.forms.set(raw, (e.forms.get(raw) || 0) + 1);
    }

    // Construit la liste : display = forme originale (vocalisée) la + fréquente
    const words = Array.from(map.values()).map(e => {
      let best = e.word, bestN = -1;
      const formList = [];
      e.forms.forEach((n, form) => {
        formList.push(form);
        if (n > bestN) { bestN = n; best = form; }
      });
      return {
        word: e.word,            // clé normalisée (recherche / fusion)
        display: best,           // FORME EXACTE affichée
        count: e.count,
        variants: e.forms.size,
        variantList: formList,
        first: e.first
      };
    });

        words.sort((a, b) => b.count - a.count || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0));

    words.forEach((w, i) => { w.rank = i + 1; w.share = keptTotal ? (w.count / keptTotal) * 100 : 0; });

    const unique = words.length;
    const hapax  = words.filter(w => w.count === 1).length;
    const maxCount = words.length ? words[0].count : 0;
    const ttr = keptTotal ? unique / keptTotal : 0;
    const coverage = buildCoverage(words, keptTotal);
    const bands = {
      tresFrequent: words.filter(w => w.count >= 20).length,
      frequent:     words.filter(w => w.count >= 5 && w.count < 20).length,
      moyen:        words.filter(w => w.count >= 2 && w.count < 5).length,
      rare:         hapax
    };
    const avgLen = unique ? words.reduce((s, w) => s + w.word.length, 0) / unique : 0;

    return {
      options: opts, generatedAt: new Date().toISOString(), words,
      stats: {
        totalRaw, keptTotal, removed: totalRaw - keptTotal, unique, hapax,
        maxCount, avgLen: round(avgLen, 1), ttr: round(ttr * 100, 1), bands, coverage
      }
    };
  }

  function buildCoverage(sorted, keptTotal) {
    const res = { p50: 0, p80: 0, p90: 0, p95: 0 };
    if (!keptTotal) return res;
    let cum = 0;
    for (let i = 0; i < sorted.length; i++) {
      cum += sorted[i].count;
      const pct = (cum / keptTotal) * 100;
      if (!res.p50 && pct >= 50) res.p50 = i + 1;
      if (!res.p80 && pct >= 80) res.p80 = i + 1;
      if (!res.p90 && pct >= 90) res.p90 = i + 1;
      if (!res.p95 && pct >= 95) { res.p95 = i + 1; break; }
    }
    return res;
  }

  /* --- Exports prêts à copier / télécharger --- */
  function buildExports(result, meta) {
    const title = (meta && meta.title) || "Analyse Dar Al Loughah";
    const s = result.stats;

    // a) LISTE PROPRE (le "Tout copier") : mot ⟶ occurrences, classé
    let text = "دار اللغة · " + title + "\n";
    text += s.unique + " mots uniques · " + s.totalRaw + " mots au total\n";
    text += "────────────────────────\n";
    result.words.forEach(w => {
      text += w.display + " \u2014 " + w.count + "\n";   // ex:  الْحَمْدُ — 412
    });

    // b) CSV (Excel/Sheets, BOM pour l'arabe)
    let csv = "\uFEFFrang,mot,occurrences,part_pourcent,variantes\n";
    result.words.forEach(w => {
      const v = w.variantList.join(" | ").replace(/"/g, '""');
      csv += `${w.rank},"${w.display}",${w.count},${round(w.share, 2)},"${v}"\n`;
    });

    // c) JSON (pour rebâtir des thèmes plus tard)
    const json = JSON.stringify({
      title, generatedAt: result.generatedAt, options: result.options, stats: s,
      words: result.words.map(w => ({
        rank: w.rank, word: w.word, display: w.display,
        count: w.count, share: round(w.share, 3), variants: w.variantList
      }))
    }, null, 2);

    return { text, csv, json };
  }

  function round(n, d) { const f = Math.pow(10, d || 0); return Math.round(n * f) / f; }

  window.DarEngine = { normalize, tokenize, analyze, buildExports };
})();
