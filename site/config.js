// ══════════════════════════════════════════════════════════════
// CONFIGURATION DE LA PLATEFORME APBC
// ══════════════════════════════════════════════════════════════
window.APBC_CONFIG = {
  // Adresse (HTTPS) du dossier de données sur le serveur de l'ANACIM,
  // avec la barre finale. Laisser "data/" pour un essai en local.
  // Exemple : "https://apbc.anacim.sn/donnees/"
  DATA_BASE_URL: "data/",

  // Affiche un bandeau « données de démonstration ».
  // Passe à false quand les champs bruts proviennent réellement du GFS.
  DEMO_MODE: true,

  // Échelle de couleurs commune aux deux cartes (mm / 24 h).
  VMAX: 100,

  // Échéances affichées ; seules celles de ECHEANCES_ACTIVES sont cliquables.
  ECHEANCES: ["J+1", "J+2", "J+3", "J+4", "J+5", "J+6", "J+7"],
  ECHEANCES_ACTIVES: ["J+1"],

  // Libellés
  LABEL_GFS: "GFS brut",
  LABEL_APBC: "APBC (corrigé)",

  // Affiche les 73 stations sur les cartes
  AFFICHER_STATIONS: true,

  // ── Onglet Vérification ──────────────────────────────────────
  SEUIL_PLUIE: 1.0,        // mm/j : seuil de définition d'un jour pluvieux
  VERIF_MODELE: "deux",    // à l'ouverture : "deux" (côte à côte), "apbc" ou "gfs"
  AFFICHER_CSI: true       // false = retire la ligne « CSI » de l'encadré
};
