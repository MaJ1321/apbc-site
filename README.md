# APBC — interface web (dépôt public)

Page de la plateforme APBC (Anacim Precipitation Bias Corrector), publiée par
GitHub Pages à partir du dossier `site/`.

Ce dépôt ne contient **que l'interface**. Les prévisions et l'historique des
dates restent sur le serveur de l'ANACIM ; la page les lit à l'adresse
`DATA_BASE_URL` (fichier `site/config.js`). Les données ne sont lisibles que
depuis le réseau de l'ANACIM : en dehors de ce réseau, la page s'affiche avec
un message d'accès impossible.

## Mise en route

1. Dans `site/config.js`, renseigner `DATA_BASE_URL` (adresse HTTPS du dossier
   de données, avec la barre finale) et passer `DEMO_MODE` à `false` quand les
   champs viennent réellement du GFS.
2. Déposer le logo de l'ANACIM dans `site/assets/logo_anacim.png`.
3. Dans *Settings → Pages*, choisir *Source : GitHub Actions*.
4. Pousser sur `main` : le workflow *Publier le site* met la page en ligne.

## Essai en local

```
cd site
python -m http.server 8000
```
puis ouvrir http://localhost:8000 (avec `DATA_BASE_URL: "data/"` et un dossier
`site/data/` produit par `exporter_donnees_APBC.py`).
