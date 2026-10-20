# Historique de Peppol Viewer

Chaque version distribuée conserve son numéro et ses fichiers. Les changements
suivants appartiennent à une nouvelle version, renseignée dans `package.json`.

## 0.1.3 — 2026-10-20

- Lien « GitHub · Versions » avec le logo GitHub dans le pied de page, à côté
  de la version installée, pour consulter les versions et téléchargements publiés.
- Icône intégrée au HTML : aucun chargement externe au démarrage. Le lien ouvre
  GitHub dans un nouvel onglet uniquement lorsque l’utilisateur le sélectionne.

## 0.1.2 — 2026-10-20

- Libellés de TVA conservés sur une ligne à l’écran et à l’impression, notamment
  « Exonération » ; espaces insécables entre les taux et le symbole pour cent.
- Marges A4 rééquilibrées et titre plus compact pour laisser davantage de place
  au contenu sans réduire la taille du texte des lignes.
- En-têtes de tableau prévus pour se répéter, lignes et totaux protégés contre
  les coupures ; les notes longues peuvent se poursuivre sur une autre page.
- Pied de page avec « Page x / y » dans les navigateurs prenant en charge les
  zones de marge CSS, notamment Chrome et Edge récents.
- Contrôle des six exemples à la largeur A4 : aucun débordement horizontal.
- Contrôle complémentaire du PDF natif de l’exemple de 48 lignes : cinq pages A4,
  lignes intactes, en-têtes répétés, totaux regroupés et compteurs corrects.
  Le paiement et les notes occupent la dernière page ; les autres cas d’impression
  restent à vérifier dans les navigateurs visés.

## 0.1.1 — 2026-10-20

- Distribution simplifiée : seul `index.html` reste à la racine ; les cinq fichiers
  techniques sont regroupés dans `assets/`.
- Liens relatifs adaptés pour conserver l’ouverture locale sans connexion Internet.
- Le build retire les anciens fichiers techniques à la racine de `dist/` après
  les avoir copiés dans `assets/` ; les autres fichiers éventuels sont conservés.

## 0.1.0 — 2026-10-20

Version de préparation à la première distribution stable.

- Lecture locale de factures et notes de crédit XML UBL compatibles Peppol BIS Billing 3.0.
- Un fichier à la fois, jusqu’à 5 Mo et 2 000 lignes, avec dépôt et sélection de fichier.
- Affichage des parties, lignes, taxes, remises, acomptes, paiements et références complémentaires.
- Impression A4 et PDF par le navigateur ; bouton « Fermer » pour revenir à l’accueil.
- Interface française et mascotte robot avec quatre expressions.
- Badge « Version installée » dans le pied de page, synchronisé depuis `package.json`.
- Attribution à Bernard De Saedeleer et lien LinkedIn dans le pied de page et les métadonnées.
- Six exemples fictifs et cas invalides pour les essais.

La validation finale des impressions PDF reste à effectuer dans les navigateurs
visés avant de déclarer la version 1.0.0 stable.
