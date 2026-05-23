/* ============================================================
   DAR AL LOUGHAH — engine.js  (JS 2/3)
   Moteur d'analyse de texte arabe — 100% local, déterministe.
   Fonctions pures exposées via window.DarEngine
   ============================================================ */
(function () {
  "use strict";

  /* ------------------------------------------------------------
     1) PLAGES UNICODE ARABES
     ------------------------------------------------------------ */
  // Harakat / tachkîl / signes coraniques (à supprimer)
  const RE_TASHKEEL = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g;
  // Tatweel ـــ (allongement décoratif)
  const RE_TATWEEL  = /\u0640/g;
  // Tout ce qui n'est PAS une lettre arabe → séparateur
  const RE_NOT_ARABIC = /[^\u0621-\u063A\u0641-\u064A\u0671\u0649\u0629]+/g;

  /* ------------------------------------------------------------
     2) NORMALISATION  (le cœur, c'est ça qui évite les faux doublons)
     opts = {
       diacritics:      true,  // retirer harakat
       tatweel:         true,  // retirer ـ
       alef:            true,  // أ إ آ ٱ → ا
       ya:              true,  // ى → ي
       hamza:           true,  // ؤ ئ ء → forme simple
       taMarbuta:       false, // ة → ه  (désactivé par défaut : change le sens)
       article:         false  // retirer ال initial
     }
     ------------------------------------------------------------ */
  function normalize(word, opts) {
    let w = word;

    if (opts.diacritics) w = w.replace(RE_TASHKEEL, "");
    if (opts.tatweel)    w = w.replace(RE_TATWEEL, "");

    if (opts.alef) {
      w = w.replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627"); // آأإٱ → ا
    }
    if (opts.hamza) {
      w = w.replace(/[\u0624]/g, "\u0648");  // ؤ → و
      w = w.replace(/[\u0626]/g, "\u064A");  // ئ → ي
      w = w.replace(/\u0621/g, "");          // ء isolé → supprimé
    }
    if (opts.ya) {
      w = w.replace(/\u0649/g, "\u064A");     // ى → ي
    }
    if (opts.taMarbuta) {
      w = w.replace(/\u0629/g, "\u0647");     // ة → ه
    }
    if (opts.article && w.length > 3 && w.startsWith("\u0627\u0644")) {
      w = w.slice(2);                          // retire ال initial
    }
    return w.trim();
  }

  /* ------------------------------------------------------------
     3) TOKENIZATION  (découpe le texte en mots arabes)
     Retourne un tableau de mots BRUTS (non normalisés).
     ------------------------------------------------------------ */
  function tokenize(rawText) {
    if (!rawText) return [];
    // On remplace tout séparateur (ponctuation, chiffres, latin, retours
    // ligne, ponctuation arabe ، ؛ ؟ …) par une espace, puis on découpe.
    return rawText
      .replace(RE_NOT_ARABIC, " ")
      .split(/\s+/)
      .filter(Boolean);
  }

  /* ------------------------------------------------------------
     4) ANALYSE COMPLÈTE
     Retourne un objet riche, prêt pour l'affichage et l'export.
     ------------------------------------------------------------ */
  function analyze(rawText, options) {
    const opts = Object.assign({
      diacritics: true, tatweel: true, alef: true, ya: true,
      hamza: true, taMarbuta: false, article: false,
      removeStopwords: true, minLength: 1
    }, options || {});

    const stopwords = window.AR_STOPWORDS || new Set();

    // a) Tokens bruts
    const rawTokens = tokenize(rawText);
    const totalRaw = rawTokens.length;

    // b) Comptage normalisé via Map (exact, ordre d'insertion conservé)
    //    On garde aussi la 1re forme rencontrée + l'ensemble des variantes
    //    fusionnées (utile : montre "الصلاة" regroupe الصلاه, صلاة...).
    const map = new Map(); // clé normalisée → {count, display, variants:Set, first}
    let keptTotal = 0;     // total des occurrences gardées (après filtres)

    for (let i = 0; i < rawTokens.length; i++) {
      const raw = rawTokens[i];
      const norm = normalize(raw, opts);

      if (!norm) continue;
      if (norm.length < opts.minLength) continue;
      if (opts.removeStopwords && stopwords.has(norm)) continue;

      keptTotal++;

      if (map.has(norm)) {
        const e = map.get(norm);
        e.count++;
        e.variants.add(raw);
      } else {
        map.set(norm, {
          word: norm,
          display: norm,          // forme d'affichage (normalisée, propre)
          count: 1,
          variants: new Set([raw]),
          first: i                // position de 1re apparition
        });
      }
    }

    // c) Tableau trié par occurrence décroissante, puis alpha
    const words = Array.from(map.values()).map(e => ({
      word: e.word,
      count: e.count,
      variants: e.variants.size,
      variantList: Array.from(e.variants),
      first: e.first
    }));

    words.sort((a, b) =>
      b.count - a.count || a.word.localeCompare(b.word, "ar")
    );

    // d) Rang + part en % du total gardé
    words.forEach((w, idx) => {
      w.rank = idx + 1;
      w.share = keptTotal ? (w.count / keptTotal) * 100 : 0;
    });

    // e) STATISTIQUES utiles
    const unique  = words.length;
    const hapax   = words.filter(w => w.count === 1).length; // mots vus 1× seulement
    const maxCount = words.length ? words[0].count : 0;

    // Richesse lexicale (Type-Token Ratio) : mots uniques / mots gardés
    const ttr = keptTotal ? (unique / keptTotal) : 0;

    // Couverture : combien de mots-vedettes couvrent X% du texte ?
    //  → cœur de l'apprentissage : "apprends ces N mots = tu lis Y% du matn"
    const coverage = buildCoverage(words, keptTotal);

    // Bandes de fréquence (pour un mini-graphe / filtres)
    const bands = {
      tresFrequent: words.filter(w => w.count >= 20).length,
      frequent:     words.filter(w => w.count >= 5 && w.count < 20).length,
      moyen:        words.filter(w => w.count >= 2 && w.count < 5).length,
      rare:         hapax
    };

    // Longueur moyenne des mots (en caractères)
    const avgLen = unique
      ? (words.reduce((s, w) => s + w.word.length, 0) / unique)
      : 0;

    return {
      options: opts,
      generatedAt: new Date().toISOString(),
      words,                         // ← le classement complet
      stats: {
        totalRaw,                    // mots dans le texte (avant filtre)
        keptTotal,                   // mots gardés (après stopwords/filtres)
        removed: totalRaw - keptTotal,
        unique,                      // mots uniques (le "vocabulaire")
        hapax,                       // mots apparaissant 1 seule fois
        maxCount,
        avgLen: round(avgLen, 1),
        ttr: round(ttr * 100, 1),    // richesse lexicale en %
        bands,
        coverage                     // {p50, p80, p90} = nb de mots pour couvrir 50/80/90%
      }
    };
  }

  /* ------------------------------------------------------------
     5) COUVERTURE  (combien de mots pour lire X% du texte)
     ------------------------------------------------------------ */
  function buildCoverage(sortedWords, keptTotal) {
    const targets = { p50: 50, p80: 80, p90: 90, p95: 95 };
    const res = { p50: 0, p80: 0, p90: 0, p95: 0 };
    if (!keptTotal) return res;

    let cum = 0;
    for (let i = 0; i < sortedWords.length; i++) {
      cum += sortedWords[i].count;
      const pct = (cum / keptTotal) * 100;
      if (!res.p50 && pct >= 50) res.p50 = i + 1;
      if (!res.p80 && pct >= 80) res.p80 = i + 1;
      if (!res.p90 && pct >= 90) res.p90 = i + 1;
      if (!res.p95 && pct >= 95) { res.p95 = i + 1; break; }
    }
    return res;
  }

  /* ------------------------------------------------------------
     6) EXPORTS  (3 formats prêts à copier/télécharger)
     ------------------------------------------------------------ */
  function buildExports(result, meta) {
    const m = meta || {};
    const stamp = new Date().toLocaleString("fr-FR");
    const title = m.title || "Analyse Dar Al Loughah";

    /* --- a) Texte lisible (parfait pour coller n'importe où) --- */
    let text = "";
    text += "═══════════════════════════════════════\n";
    text += "  " + title + "\n";
    text += "  " + stamp + "\n";
    text += "═══════════════════════════════════════\n\n";
    text += "Mots au total : " + result.stats.totalRaw + "\n";
    text += "Mots gardés   : " + result.stats.keptTotal + "\n";
    text += "Mots uniques  : " + result.stats.unique + "\n";
    text += "Mots rares (1×): " + result.stats.hapax + "\n";
    text += "Richesse lex. : " + result.stats.ttr + " %\n";
    text += "Couverture    : " + result.stats.coverage.p80 +
            " mots = 80% du texte\n\n";
    text += "RANG\tMOT\tOCCUR.\tPART %\n";
    text += "───────────────────────────────────────\n";
    result.words.forEach(w => {
      text += w.rank + "\t" + w.word + "\t" + w.count + "\t" +
              round(w.share, 2) + "%\n";
    });

    /* --- b) CSV (ouvrable dans Excel / Sheets) --- */
    // BOM \uFEFF pour qu'Excel lise l'arabe correctement
    let csv = "\uFEFFrang,mot,occurrences,part_pourcent,variantes\n";
    result.words.forEach(w => {
      const variants = w.variantList.join(" | ").replace(/"/g, '""');
      csv += `${w.rank},"${w.word}",${w.count},${round(w.share, 2)},"${variants}"\n`;
    });

    /* --- c) JSON (pour réimporter / construire des thèmes plus tard) --- */
    const json = JSON.stringify({
      title, generatedAt: result.generatedAt,
      options: result.options, stats: result.stats,
      words: result.words.map(w => ({
        rank: w.rank, word: w.word, count: w.count,
        share: round(w.share, 3), variants: w.variantList
      }))
    }, null, 2);

    return { text, csv, json };
  }

  /* ------------------------------------------------------------
     Utilitaires
     ------------------------------------------------------------ */
  function round(n, d) {
    const f = Math.pow(10, d || 0);
    return Math.round(n * f) / f;
  }

  /* ------------------------------------------------------------
     API PUBLIQUE
     ------------------------------------------------------------ */
  window.DarEngine = {
    normalize,
    tokenize,
    analyze,
    buildExports
  };
})();
