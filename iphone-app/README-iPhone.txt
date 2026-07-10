Version iPhone du Voyage Balkans

Fichiers principaux :
- index.html : application mobile
- stops.json : parcours et visites
- manifest.webmanifest + sw.js : installation et hors-ligne

Utilisation locale sur PC :
python -m http.server 8090 -d iphone-app
puis ouvrir http://127.0.0.1:8090

Sur iPhone, le mieux est une URL HTTPS. Ouvrir l'URL dans Safari, puis Partager > Sur l'?cran d'accueil.
Apr?s le premier chargement, le parcours reste disponible hors-ligne.
