// ══════════════════════════════════════════════════════════════
// PLATEFORME APBC — logique de la page
//   Calendrier de choix de la date (partagé par les trois onglets)
//   Onglet « Prévision »     : cartes GFS brut / APBC
//   Onglet « Time series »   : histogramme des prévisions aux 73 stations (GFS et APBC)
//   Onglet « Vérification »  : carte de contingence (succès, fausse alerte, manqué…)
// ══════════════════════════════════════════════════════════════
(function () {
  "use strict";

  var CFG = window.APBC_CONFIG;
  var STATIONS = window.APBC_STATIONS || [];
  var GEO = window.APBC_GEO || null;
  var DATES = window.APBC_DATES || [];            // plus récente d'abord
  var DATES_OBS = window.APBC_OBS_DATES || [];

  var PAS = 0.0375, LAT_MAX = 17.0, LON_MIN = -18.0, N_LAT = 134, N_LON = 187;
  var COULEUR_GFS = "#9AA9BA", COULEUR_APBC = "#1F6FB2";
  var POLICE = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

  // Échelle de couleurs : arrêts en fraction de VMAX (plus fins pour les faibles cumuls)
  var PALIERS = [
    [0,    "#F6FAFD"], [0.01, "#DCEBF7"], [0.05, "#A9D0EA"], [0.10, "#5FA8D8"],
    [0.20, "#2B7BC0"], [0.35, "#1B4F9C"], [0.50, "#5B3C9E"], [0.75, "#9B2F8E"],
    [1,    "#5C0F4E"]
  ];

  // ── Données en cache, remplies par les fichiers data/AAAA-MM-JJ.js ──
  var CACHE = {};
  window.APBC_REGISTER = function (date, payload) { CACHE[date] = payload; };

  function $(id) { return document.getElementById(id); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function fmt(x, d) {
    if (x === null || x === undefined || isNaN(x)) return "—";
    return x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function libelleDate(iso) {
    var d = new Date(iso + "T12:00:00");
    var t = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function message(texte) {
    var m = $("message");
    if (!texte) { m.hidden = true; m.textContent = ""; return; }
    m.hidden = false; m.textContent = texte;
  }

  // ══════════════════════════════════════════════════════════
  // ÉTAT
  // ══════════════════════════════════════════════════════════
  var dateCourante = null;
  var ongletCourant = "prevision";
  var echeanceCourante = CFG.ECHEANCES_ACTIVES[0] || CFG.ECHEANCES[0];
  var modeleVerif = ["apbc", "gfs", "deux"].indexOf(CFG.VERIF_MODELE) >= 0 ? CFG.VERIF_MODELE : "deux";
  var aRedessiner = { prevision: true, series: true, verification: true };

  var ONGLETS = ["prevision", "series", "verification"];
  var GRAPHES = {
    prevision: ["carte-gfs", "carte-apbc"],
    series: ["histogramme"],
    verification: ["carte-verif-apbc", "carte-verif-gfs"]
  };

  // ══════════════════════════════════════════════════════════
  // CALENDRIER
  // ══════════════════════════════════════════════════════════
  var DISPO = {}, AVEC_OBS = {};
  DATES.forEach(function (d) { DISPO[d] = true; });
  DATES_OBS.forEach(function (d) { AVEC_OBS[d] = true; });
  var cal = { y: 0, m: 0 };

  function indexMois(y, m) { return y * 12 + m; }
  function moisDe(iso) { return { y: +iso.slice(0, 4), m: +iso.slice(5, 7) - 1 }; }

  function aujourdhui() {
    var n = new Date();
    return n.getFullYear() + "-" + pad(n.getMonth() + 1) + "-" + pad(n.getDate());
  }

  function dessinerCalendrier() {
    var grille = $("cal-grille");
    grille.innerHTML = "";
    var d0 = new Date(cal.y, cal.m, 1);
    var titre = d0.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    $("cal-mois").textContent = titre;

    ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"].forEach(function (j) {
      var e = document.createElement("div");
      e.className = "cal__semaine"; e.textContent = j;
      grille.appendChild(e);
    });
    var decalage = (d0.getDay() + 6) % 7;                     // semaine commençant le lundi
    for (var k = 0; k < decalage; k++) {
      var v = document.createElement("div"); v.className = "cal__vide"; grille.appendChild(v);
    }
    var nbJours = new Date(cal.y, cal.m + 1, 0).getDate();
    var auj = aujourdhui();
    for (var j = 1; j <= nbJours; j++) {
      var iso = cal.y + "-" + pad(cal.m + 1) + "-" + pad(j);
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = j;
      b.className = "cal__jour";
      b.dataset.date = iso;
      if (DISPO[iso]) {
        b.classList.add("cal__jour--dispo");
        b.setAttribute("aria-label", libelleDate(iso) + (AVEC_OBS[iso] ? " (avec observations)" : ""));
        b.addEventListener("click", function (ev) { choisirDate(ev.currentTarget.dataset.date); });
      } else {
        b.disabled = true;
        b.setAttribute("aria-label", libelleDate(iso) + " : aucune prévision");
      }
      if (AVEC_OBS[iso]) b.classList.add("cal__jour--obs");
      if (iso === auj) b.classList.add("cal__jour--aujourdhui");
      if (iso === dateCourante) { b.classList.add("cal__jour--selection"); b.setAttribute("aria-current", "date"); }
      grille.appendChild(b);
    }
    var bornes = [moisDe(DATES[DATES.length - 1]), moisDe(DATES[0])];
    $("cal-prec").disabled = indexMois(cal.y, cal.m) <= indexMois(bornes[0].y, bornes[0].m);
    $("cal-suiv").disabled = indexMois(cal.y, cal.m) >= indexMois(bornes[1].y, bornes[1].m);
  }

  function changerMois(delta) {
    var t = cal.y * 12 + cal.m + delta;
    cal.y = Math.floor(t / 12); cal.m = t % 12;
    dessinerCalendrier();
  }

  function ouvrirCalendrier() {
    var mois = moisDe(dateCourante || DATES[0]);
    cal.y = mois.y; cal.m = mois.m;
    dessinerCalendrier();
    $("cal-popover").hidden = false;
    $("btn-date").setAttribute("aria-expanded", "true");
    var sel = $("cal-grille").querySelector(".cal__jour--selection, .cal__jour--dispo");
    if (sel) sel.focus();
  }

  function fermerCalendrier(rendreFocus) {
    if ($("cal-popover").hidden) return;
    $("cal-popover").hidden = true;
    $("btn-date").setAttribute("aria-expanded", "false");
    if (rendreFocus) $("btn-date").focus();
  }

  function choisirDate(iso) {
    if (!DISPO[iso]) return;
    var change = iso !== dateCourante;
    dateCourante = iso;
    $("btn-date-texte").textContent = libelleDate(iso);
    fermerCalendrier(true);
    if (change) {
      aRedessiner = { prevision: true, series: true, verification: true };
      afficherOnglet();
    }
  }

  function initialiserCalendrier() {
    if (!DATES_OBS.length) $("cal-legende-obs").hidden = true;
    $("btn-date").addEventListener("click", function () {
      if ($("cal-popover").hidden) ouvrirCalendrier(); else fermerCalendrier(false);
    });
    $("cal-prec").addEventListener("click", function () { changerMois(-1); });
    $("cal-suiv").addEventListener("click", function () { changerMois(1); });
    $("cal-derniere").addEventListener("click", function () { choisirDate(DATES[0]); });
    document.addEventListener("click", function (ev) {
      if (!$("calendrier").contains(ev.target)) fermerCalendrier(false);
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") fermerCalendrier(true);
    });
  }

  // ══════════════════════════════════════════════════════════
  // ÉCHÉANCES (composant inactif sauf J+1)
  // ══════════════════════════════════════════════════════════
  function construireEcheances() {
    var conteneur = $("echeances");
    conteneur.innerHTML = "";
    CFG.ECHEANCES.forEach(function (e) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "echeance";
      b.textContent = e;
      var active = CFG.ECHEANCES_ACTIVES.indexOf(e) >= 0;
      b.disabled = !active;
      b.setAttribute("aria-pressed", e === echeanceCourante ? "true" : "false");
      if (!active) b.title = "Disponible prochainement";
      b.addEventListener("click", function () {
        echeanceCourante = e;
        Array.prototype.forEach.call(conteneur.children, function (x) {
          x.setAttribute("aria-pressed", x.textContent === e ? "true" : "false");
        });
        aRedessiner.prevision = true; aRedessiner.verification = true;
        afficherOnglet();
      });
      conteneur.appendChild(b);
    });
  }

  // ══════════════════════════════════════════════════════════
  // CHARGEMENT D'UNE DATE (balise <script>, compatible file://)
  // ══════════════════════════════════════════════════════════
  function charger(date) {
    return new Promise(function (resolve, reject) {
      if (CACHE[date]) return resolve(CACHE[date]);
      var s = document.createElement("script");
      s.src = (window.APBC_DATA_BASE || "data/") + date + ".js";
      s.onload = function () { CACHE[date] ? resolve(CACHE[date]) : reject(new Error("format")); };
      s.onerror = function () { reject(new Error("introuvable")); };
      document.head.appendChild(s);
    });
  }

  // ══════════════════════════════════════════════════════════
  // OUTILS COMMUNS CARTES
  // ══════════════════════════════════════════════════════════
  function pixel(lat, lon) {
    var i = Math.round((LAT_MAX - lat) / PAS), j = Math.round((lon - LON_MIN) / PAS);
    return [Math.max(0, Math.min(N_LAT - 1, i)), Math.max(0, Math.min(N_LON - 1, j))];
  }

  function valeursStations(grille) {
    return STATIONS.map(function (s) {
      var v = grille[s.i] ? grille[s.i][s.j] : null;
      return (v === undefined) ? null : v;
    });
  }

  function statistiques(valeurs) {
    var ok = [], max = -1, nomMax = "";
    valeurs.forEach(function (v, k) {
      if (v === null) return;
      ok.push(v);
      if (v > max) { max = v; nomMax = STATIONS[k].nom; }
    });
    var moy = ok.length ? ok.reduce(function (a, b) { return a + b; }, 0) / ok.length : null;
    return { moyenne: moy, max: max, nomMax: nomMax, n: ok.length };
  }

  function texteStats(st) {
    if (st.n === 0) return "";
    return "Moyenne des stations : " + fmt(st.moyenne, 1) + " mm · Maximum : " +
           fmt(st.max, 1) + " mm (" + st.nomMax + ")";
  }

  function axesCarte() {
    var xs = [], ys = [];
    for (var j = 0; j < N_LON; j++) xs.push(LON_MIN + j * PAS);
    for (var i = 0; i < N_LAT; i++) ys.push(LAT_MAX - i * PAS);
    return { x: xs, y: ys };
  }
  var AXES = axesCarte();

  function formeMasque() {
    if (!GEO || !GEO.masque) return [];
    var ext = GEO.extent, marge = 0.5;
    var x0 = ext[0] - marge, x1 = ext[1] + marge, y0 = ext[2] - marge, y1 = ext[3] + marge;
    var chemin = "M" + x0 + "," + y0 + "L" + x1 + "," + y0 + "L" + x1 + "," + y1 + "L" + x0 + "," + y1 + "Z";
    GEO.masque.forEach(function (anneau) {
      chemin += "M" + anneau.map(function (p) { return p[0] + "," + p[1]; }).join("L") + "Z";
    });
    return [{
      type: "path", path: chemin, xref: "x", yref: "y", layer: "above",
      fillcolor: "#FFFFFF", fillrule: "evenodd", line: { width: 0 }
    }];
  }

  function traceLignes(anneaux, couleur, largeur) {
    var x = [], y = [];
    anneaux.forEach(function (anneau) {
      anneau.forEach(function (p) { x.push(p[0]); y.push(p[1]); });
      x.push(null); y.push(null);
    });
    return { type: "scatter", mode: "lines", x: x, y: y, hoverinfo: "skip",
             line: { color: couleur, width: largeur }, showlegend: false };
  }

  // ══════════════════════════════════════════════════════════
  // ONGLET 1 — PRÉVISION
  // ══════════════════════════════════════════════════════════
  function construireLegende() {
    var vmax = CFG.VMAX;
    var arrets = PALIERS.map(function (p) {
      return p[1] + " " + (p[0] * 100).toFixed(1) + "%";
    }).join(", ");
    $("legende-barre").style.background = "linear-gradient(to right, " + arrets + ")";
    var grad = $("legende-graduations");
    grad.innerHTML = "";
    [0, 0.2, 0.4, 0.6, 0.8, 1].forEach(function (f) {
      var s = document.createElement("span");
      s.style.left = (f * 100) + "%";
      s.textContent = Math.round(f * vmax) + (f === 1 ? "+" : "");
      grad.appendChild(s);
    });
  }

  function tracerCarte(idDiv, grille, valeursPts) {
    var traces = [{
      type: "heatmap", x: AXES.x, y: AXES.y, z: grille,
      colorscale: PALIERS, zmin: 0, zmax: CFG.VMAX, zsmooth: false,
      showscale: false, hoverongaps: false,
      hovertemplate: "%{z:.1f} mm<br>%{y:.2f}°N, %{x:.2f}°<extra></extra>"
    }];
    if (GEO && GEO.regions) traces.push(traceLignes(GEO.regions, "#2C3A4A", 0.9));
    if (CFG.AFFICHER_STATIONS && $("afficher-stations").checked) {
      traces.push({
        type: "scatter", mode: "markers",
        x: STATIONS.map(function (s) { return s.lon; }),
        y: STATIONS.map(function (s) { return s.lat; }),
        text: STATIONS.map(function (s) { return s.nom; }),
        customdata: valeursPts,
        marker: { size: 5, color: "#FFFFFF", line: { color: "#1B2733", width: 1 } },
        hovertemplate: "<b>%{text}</b><br>%{customdata:.1f} mm<extra></extra>",
        showlegend: false
      });
    }
    var layout = {
      margin: { l: 44, r: 8, t: 4, b: 36 },
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "#FFFFFF",
      xaxis: { range: [-18, -11], title: { text: "Longitude", font: { size: 11 } },
               showgrid: false, zeroline: false, constrain: "domain",
               tickvals: [-18, -17, -16, -15, -14, -13, -12, -11], ticksuffix: "°", fixedrange: true },
      yaxis: { range: [12, 17], title: { text: "Latitude", font: { size: 11 } },
               scaleanchor: "x", scaleratio: 1, showgrid: false, zeroline: false,
               constrain: "domain", tickvals: [12, 13, 14, 15, 16, 17], ticksuffix: "°", fixedrange: true },
      shapes: formeMasque(),
      hoverlabel: { font: { size: 12 } }
    };
    Plotly.react(idDiv, traces, layout, { displayModeBar: false, responsive: true });
  }

  function tracerHistogramme(vGfs, vApbc) {
    var noms = STATIONS.map(function (s) { return s.nom; });
    var traces = [
      { type: "bar", name: CFG.LABEL_GFS, x: noms, y: vGfs, marker: { color: COULEUR_GFS },
        hovertemplate: "%{y:.1f} mm" },
      { type: "bar", name: CFG.LABEL_APBC, x: noms, y: vApbc, marker: { color: COULEUR_APBC },
        hovertemplate: "%{y:.1f} mm" }
    ];
    var layout = {
      barmode: "group", bargap: 0.18, bargroupgap: 0.04,
      margin: { l: 56, r: 12, t: 8, b: 110 },
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
      xaxis: { tickangle: -90, tickfont: { size: 10 }, automargin: true, type: "category" },
      yaxis: { title: { text: "Précipitations prévues (mm / 24 h)", font: { size: 12 } },
               gridcolor: "#E3E9F0", zeroline: true, zerolinecolor: "#B9C4D0", rangemode: "tozero" },
      legend: { orientation: "h", x: 0, y: 1.08, font: { size: 12 } },
      hovermode: "x unified", font: { family: POLICE, color: "#1B2733" }
    };
    Plotly.react("histogramme", traces, layout, { displayModeBar: false, responsive: true });
  }

  function rendrePrevision() {
    var date = dateCourante;
    return charger(date).then(function (donnees) {
      var e = donnees.echeances[echeanceCourante];
      if (!e) { message("Aucune prévision pour l'échéance " + echeanceCourante + " à cette date."); return; }
      message("");
      var vGfs = valeursStations(e.gfs), vApbc = valeursStations(e.apbc);
      $("stats-gfs").textContent = texteStats(statistiques(vGfs));
      $("stats-apbc").textContent = texteStats(statistiques(vApbc));
      tracerCarte("carte-gfs", e.gfs, vGfs);
      tracerCarte("carte-apbc", e.apbc, vApbc);
    });
  }

  // ══════════════════════════════════════════════════════════
  // ONGLET 2 — TIME SERIES : histogramme des prévisions aux 73 stations
  // ══════════════════════════════════════════════════════════
  function rendreSeries() {
    var date = dateCourante;
    return charger(date).then(function (donnees) {
      var e = donnees.echeances[echeanceCourante];
      if (!e) { message("Aucune prévision pour l'échéance " + echeanceCourante + " à cette date."); return; }
      message("");
      var vGfs = valeursStations(e.gfs), vApbc = valeursStations(e.apbc);
      $("titre-histo").textContent = "Précipitations prévues aux " + STATIONS.length +
        " stations du réseau — " + libelleDate(date);
      tracerHistogramme(vGfs, vApbc);
    });
  }

  // ══════════════════════════════════════════════════════════
  // ONGLET 3 — VÉRIFICATION (carte de contingence)
  // ══════════════════════════════════════════════════════════
  var CATS = {
    H:  { nom: "Succès",        symbole: "circle",        couleur: "#2E9B5A", taille: 11, bord: "#2A5E40" },
    FA: { nom: "Fausse alerte", symbole: "triangle-up",   couleur: "#F08A5D", taille: 11, bord: "#7A3B1F" },
    M:  { nom: "Manqué",        symbole: "triangle-down", couleur: "#4A74B5", taille: 11, bord: "#26416A" },
    CN: { nom: "Bon rejet",     symbole: "circle",        couleur: "#D9D9D9", taille: 11, bord: "#555555" },
    NC: { nom: "Non classé",    symbole: "circle",        couleur: "#FFFFFF", taille: 7,  bord: "#9A9A9A" }
  };
  var ORDRE = ["H", "FA", "M", "CN", "NC"];

  function classer(obs, prev) {
    if (obs === null || obs === undefined || prev === null || prev === undefined) return "NC";
    var s = CFG.SEUIL_PLUIE;
    if (obs >= s && prev >= s) return "H";
    if (obs >= s) return "M";
    if (prev >= s) return "FA";
    return "CN";
  }

  function nombre2(x) { return (x === null || !isFinite(x)) ? "—" : x.toFixed(2); }

  function boiteStats(c, n) {
    var H = c.H, M = c.M, FA = c.FA, CN = c.CN;
    var pod = (H + M) ? H / (H + M) : null;
    var far = (H + FA) ? FA / (H + FA) : null;
    var csi = (H + M + FA) ? H / (H + M + FA) : null;
    var biais = (H + M) ? (H + FA) / (H + M) : null;
    var pc = n ? (H + CN) / n : null;
    var nb = "&nbsp;";
    var lignes = [
      "Seuil pluie : " + CFG.SEUIL_PLUIE.toFixed(1) + " mm/j" + nb + nb + nb + "(n = " + n + ")",
      "POD = " + nombre2(pod) + nb + nb + nb + nb + "FAR = " + nombre2(far)
    ];
    lignes.push(CFG.AFFICHER_CSI
      ? "CSI = " + nombre2(csi) + nb + nb + nb + nb + "Biais fréq. = " + nombre2(biais)
      : "Biais fréq. = " + nombre2(biais));
    lignes.push("Proportion correcte = " + nombre2(pc));
    return lignes.join("<br>");
  }

  function ticksLon() { return { vals: [-18, -17, -16, -15, -14, -13, -12, -11],
    txt: ["18.0° O", "17.0° O", "16.0° O", "15.0° O", "14.0° O", "13.0° O", "12.0° O", "11.0° O"] }; }

  function afficherVideVerif(texte) {
    $("vide-verif").hidden = !texte;
    $("vide-verif").textContent = texte || "";
    $("bloc-verif").hidden = !!texte;
  }

  var XR = [-18.3, -10.9], YR = [11.8, 17];
  var MONO = "ui-monospace, Menlo, Consolas, 'Courier New', monospace";

  // Trace UNE carte de vérification dans le <div> idDiv, pour la grille d'un modèle.
  function tracerVerif(idDiv, modele, grille, obs, date) {
    var pts = { H: [], FA: [], M: [], CN: [], NC: [] };
    var compte = { H: 0, FA: 0, M: 0, CN: 0 };
    obs.forEach(function (o) {
      var p = pixel(o[1], o[2]);
      var prev = grille[p[0]] ? grille[p[0]][p[1]] : null;
      var c = classer(o[3], prev);
      pts[c].push({ nom: o[0], lat: o[1], lon: o[2], obs: o[3], prev: prev });
      if (c !== "NC") compte[c]++;
    });
    var n = compte.H + compte.FA + compte.M + compte.CN;

    var traces = [];
    if (GEO && GEO.masque) traces.push(traceLignes(GEO.masque, "#3C3C3C", 1.1));
    // Les cinq catégories figurent toujours dans la légende, même à zéro station.
    ORDRE.forEach(function (cle) {
      var L = pts[cle], st = CATS[cle];
      traces.push({
        type: "scatter", mode: "markers", name: st.nom + " (" + L.length + ")",
        // trace sans point : [null] (et non []) pour que l'entrée reste dans la légende
        x: L.length ? L.map(function (p) { return p.lon; }) : [null],
        y: L.length ? L.map(function (p) { return p.lat; }) : [null],
        customdata: L.map(function (p) { return [p.nom, p.obs, p.prev]; }),
        marker: { symbol: st.symbole, size: st.taille, color: st.couleur,
                  line: { color: st.bord, width: cle === "NC" ? 0.8 : 0.9 } },
        hovertemplate: "<b>%{customdata[0]}</b><br>" + st.nom +
          "<br>Observé : %{customdata[1]:.1f} mm<br>Prévu : %{customdata[2]:.1f} mm<extra></extra>"
      });
    });

    var nomModele = modele === "gfs" ? CFG.LABEL_GFS : "APBC";
    var t = ticksLon();
    var div = $(idDiv);
    var largeur = div.clientWidth;
    var petit = largeur < 620;                      // légende sous la carte
    var moyen = !petit && largeur < 800;            // deux cartes côte à côte
    var layout = {
      title: { text: "<b>" + (petit ? "Vérification " : "Vérification catégorielle ") + nomModele + " — " + date + "</b>",
               x: 0.5, xanchor: "center", font: { size: petit ? 13 : (moyen ? 15 : 18) } },
      margin: petit ? { l: 46, r: 10, t: 40, b: 150 } : { l: moyen ? 58 : 66, r: 14, t: 52, b: 52 },
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "#F2F5EE",
      font: { family: POLICE, color: "#111", size: (petit || moyen) ? 10 : 12 },
      xaxis: { range: XR, tickvals: t.vals, ticktext: petit ? t.vals.map(function (v) { return Math.abs(v) + "°O"; }) : t.txt,
               title: { text: "Longitude" }, tickangle: 0,
               showgrid: true, gridcolor: "#CFD6CA", griddash: "dot", zeroline: false,
               showline: true, linecolor: "#222", mirror: true, constrain: "domain", fixedrange: true },
      yaxis: { range: YR, tickvals: [12, 13, 14, 15, 16, 17],
               ticktext: petit ? ["12°N", "13°N", "14°N", "15°N", "16°N", "17°N"]
                               : ["12.0° N", "13.0° N", "14.0° N", "15.0° N", "16.0° N", "17.0° N"],
               title: { text: "Latitude" }, scaleanchor: "x", scaleratio: 1,
               showgrid: true, gridcolor: "#CFD6CA", griddash: "dot", zeroline: false,
               showline: true, linecolor: "#222", mirror: true, constrain: "domain", fixedrange: true },
      legend: petit
        ? { orientation: "h", x: 0, y: -0.2, xanchor: "left", yanchor: "top", font: { size: 11 },
            itemsizing: "constant", bgcolor: "rgba(0,0,0,0)" }
        : { x: 0.01, y: 0.01, xanchor: "left", yanchor: "bottom", bgcolor: "rgba(255,255,255,0.92)",
            bordercolor: "#999", borderwidth: 1, font: { size: moyen ? 10.5 : 12 }, itemsizing: "constant" },
      annotations: [{
        xref: "paper", yref: "paper", x: 0.01, y: 0.99, xanchor: "left", yanchor: "top",
        showarrow: false, align: "left", text: boiteStats(compte, n),
        font: { family: MONO, size: petit ? 8.5 : (moyen ? 10.5 : 12) },
        bgcolor: "rgba(255,255,255,0.92)", bordercolor: "#888", borderwidth: 1, borderpad: petit ? 3 : 6
      }],
      hoverlabel: { font: { size: 12 } }
    };
    // Hauteur calquée sur le rapport d'aspect de la carte pour que le cadre remplisse la largeur
    var marge = layout.margin;
    var largeurCarte = Math.max(240, largeur - marge.l - marge.r);
    div.style.height = Math.round(largeurCarte * (YR[1] - YR[0]) / (XR[1] - XR[0]) + marge.t + marge.b) + "px";
    Plotly.react(idDiv, traces, layout, { displayModeBar: false, responsive: true });
  }

  function rendreVerification() {
    var date = dateCourante;
    return charger(date).then(function (donnees) {
      var e = donnees.echeances[echeanceCourante];
      var obs = donnees.obs;
      if (!obs || !obs.length) {
        afficherVideVerif("Pas d'observations pour le " + libelleDate(date).toLowerCase() +
          ". La vérification est disponible une fois les observations de ce jour reçues " +
          "(relance exporter_donnees_APBC.py avec l'option --stations-anacim ou --obs).");
        return;
      }
      if (!e) { afficherVideVerif("Aucune prévision pour l'échéance " + echeanceCourante + " à cette date."); return; }
      message("");
      afficherVideVerif("");

      var modes = modeleVerif === "deux" ? ["apbc", "gfs"] : [modeleVerif];
      ["apbc", "gfs"].forEach(function (m) { $("bloc-v-" + m).hidden = modes.indexOf(m) < 0; });
      $("grille-verif").classList.toggle("cartes--une", modes.length === 1);
      modes.forEach(function (m) { tracerVerif("carte-verif-" + m, m, e[m], obs, date); });

      $("note-verif").textContent =
        "Un point par station du réseau : succès = pluie prévue et observée (≥ " + CFG.SEUIL_PLUIE.toFixed(1) +
        " mm/j) ; fausse alerte = pluie prévue mais non observée ; manqué = pluie observée mais non prévue ; " +
        "bon rejet = ni prévue ni observée ; non classé = pas d'observation ce jour-là.";
    });
  }

  // ══════════════════════════════════════════════════════════
  // ONGLETS
  // ══════════════════════════════════════════════════════════
  function afficherOnglet() {
    ONGLETS.forEach(function (nom) {
      var actif = nom === ongletCourant;
      var b = $("onglet-" + nom);
      b.setAttribute("aria-selected", actif ? "true" : "false");
      b.tabIndex = actif ? 0 : -1;
      $("panneau-" + nom).hidden = !actif;
    });
    if (!dateCourante) return;
    if (aRedessiner[ongletCourant]) {
      var rendu = { prevision: rendrePrevision, series: rendreSeries, verification: rendreVerification }[ongletCourant];
      aRedessiner[ongletCourant] = false;
      rendu().catch(function () {
        aRedessiner[ongletCourant] = true;
        message("Impossible de charger les données du " + dateCourante + ". Relance exporter_donnees_APBC.py.");
      });
    } else {
      GRAPHES[ongletCourant].forEach(function (id) {
        var el = $(id);
        if (el && el.data) Plotly.Plots.resize(el);
      });
      message("");
    }
  }

  function initialiserOnglets() {
    ONGLETS.forEach(function (nom, idx) {
      var b = $("onglet-" + nom);
      b.addEventListener("click", function () { ongletCourant = nom; afficherOnglet(); });
      b.addEventListener("keydown", function (ev) {
        var k = { ArrowRight: 1, ArrowLeft: -1 }[ev.key];
        var cible = null;
        if (k) cible = (idx + k + ONGLETS.length) % ONGLETS.length;
        else if (ev.key === "Home") cible = 0;
        else if (ev.key === "End") cible = ONGLETS.length - 1;
        if (cible === null) return;
        ev.preventDefault();
        ongletCourant = ONGLETS[cible];
        afficherOnglet();
        $("onglet-" + ongletCourant).focus();
      });
    });
  }

  function initialiserChoixModele() {
    var boutons = $("choix-modele").querySelectorAll("button");
    function maj() {
      Array.prototype.forEach.call(boutons, function (b) {
        b.setAttribute("aria-pressed", b.dataset.modele === modeleVerif ? "true" : "false");
      });
    }
    Array.prototype.forEach.call(boutons, function (b) {
      b.addEventListener("click", function () {
        modeleVerif = b.dataset.modele; maj();
        aRedessiner.verification = true; afficherOnglet();
      });
    });
    maj();
  }

  // ══════════════════════════════════════════════════════════
  // DÉMARRAGE
  // ══════════════════════════════════════════════════════════
  function demarrer() {
    $("titre-gfs").textContent = CFG.LABEL_GFS;
    $("titre-apbc").textContent = CFG.LABEL_APBC;
    $("badge-demo").hidden = !CFG.DEMO_MODE;
    construireLegende();
    construireEcheances();

    if (window.APBC_META && window.APBC_META.genere_utc && $("maj")) {
      $("maj").textContent = "— mise à jour : " + window.APBC_META.genere_utc.replace("T", " ").slice(0, 16) + " UTC";
    }
    if (!STATIONS.length || !GEO) {
      var inj = (window.APBC_ERREURS_CHARGEMENT || []).length;
      message(inj
        ? "Impossible de joindre le serveur de données de l'ANACIM. Vérifie que tu es connecté au réseau de l'ANACIM (ou au VPN), puis recharge la page."
        : "Fichiers de données manquants (stations.js, geo.js).");
      $("contenu").hidden = true;
      return;
    }
    if (!DATES.length) {
      message("Aucune prévision disponible. Lance : python exporter_donnees_APBC.py");
      $("contenu").hidden = true;
      return;
    }
    initialiserCalendrier();
    initialiserOnglets();
    initialiserChoixModele();
    $("afficher-stations").addEventListener("change", function () {
      aRedessiner.prevision = true; afficherOnglet();
    });
    var minuteur = null;
    window.addEventListener("resize", function () {          // recalcule la hauteur de la carte de vérification
      clearTimeout(minuteur);
      minuteur = setTimeout(function () {
        aRedessiner.verification = true;
        if (ongletCourant === "verification") afficherOnglet();
      }, 250);
    });
    choisirDate(DATES[0]);
  }

  demarrer();
})();
