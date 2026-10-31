# Historique de Peppol Viewer

Chaque version distribuée conserve son numéro et ses fichiers. Les changements
suivants appartiennent à une nouvelle version, renseignée dans `package.json`.

## 0.1.6 — candidate du 2026-10-31, non publiée

- Bulletin vectoriel adapté au modèle du guide Febelfin : format fixe de
  210 × 101,6 mm, zones et positions physiques des données, montant en huit
  cases euros et deux cases centimes, code `02` ou `03` selon la communication.
- Un caractère centré dans chaque case, selon l’option de remplissage par cases
  du guide Febelfin : IBAN sans espaces de séparation, espaces des textes
  conservés comme cases vides, communication depuis la première case avec ses
  signes `+` et `/`. Le décor et le texte utilisent la même grille.
- Suppression des deux paragraphes sous le bulletin, à l’écran et à l’impression.
  Les consignes d’impression et références restent dans la documentation et le
  mode d’emploi.
- Impression sur une page A4 séparée, à 100 % / taille réelle, en couleur et
  recto uniquement. L’aperçu écran réduit le formulaire dans son ensemble sans
  redistribuer les champs. Les marges internes conservent les 186 mm utiles de
  la facture, tandis que le bulletin utilise les 210 mm de largeur de l’A4.
- Données du bulletin en majuscules, accents conservés, police monospace noire.
  L’échéance de facture reste hors du formulaire ; aucune date d’exécution,
  signature ou coordonnée du donneur d’ordre n’est déduite du XML.
- Contraintes du gabarit vérifiées séparément de l’admissibilité du virement :
  noms et lignes d’adresse de 26 caractères au maximum, communication libre de
  34 caractères avec alphabet autorisé, BIC de 8 ou 11 caractères, capacité du
  montant. Une valeur incompatible entraîne un message explicite sans bulletin,
  sans troncature, abréviation, réduction de police ou correction de la source.
- Explication de chaque exclusion du bulletin, y compris celles liées au type
  de document, à la devise, au moyen de paiement, à l’IBAN ou au montant. Une
  seule raison concise est affichée ; l’absence de bulletin ne transforme pas
  un avoir ou un paiement en espèces en erreur de lecture XML.
- Comptage et placement partagent le même découpage des caractères affichés.
  Une lettre latine et ses accents combinants restent ensemble : 26 caractères
  sont admis pour le nom, la rue ou la localité en NFC comme en NFD, 27 sont
  refusés. Aucun texte source n’est normalisé ou réécrit.
- Conservation du XML et des valeurs extraites, y compris les textes mal
  échappés. Les contrôles supplémentaires ne constituent pas une validation Peppol.
- Exemple 07 adapté avec un nom fictif assez court pour exercer le gabarit.
- Cinq exemples fictifs supplémentaires (08 à 12) : comparaison du même nom de
  26 caractères avec accents précomposés ou décomposés, nom décomposé de
  27 caractères, communication libre de 35 caractères et IBAN invalide.
  Le guide des exemples décrit le bulletin ou le motif d’exclusion attendu.
- **57 tests sur 57 passent**, soit 14 lecteur XML,
  21 paiement, 20 application et 2 construction/version. Positions des graphèmes
  comparées aux centres des cases, limites de champs et accents décomposés testés
  sans modification de la source. Build et contrôle du diff réussis après les
  compléments sur les exclusions et le comptage.
- **16 scénarios supplémentaires sur 16 réussissent dans le navigateur intégré** :
  messages d’exclusion, valeurs intégrales, limites de 26/27 caractères en NFC/NFD,
  cases exactes et suppression du motif lors du retour à une facture admissible,
  sans erreur ni débordement horizontal.
- Exemple 07 réinspecté sur ordinateur et à 390 × 844 pixels, sans débordement
  horizontal et sans les deux paragraphes sous le bulletin. Contrôle local d’une
  facture privée : gabarit admissible, fichier et modèle inchangés, entités
  littérales conservées, aucune donnée privée publiée.
- L’impression depuis le navigateur intégré n’a pas produit de PDF exploitable.
  La taille réelle en PDF/papier et la reconnaissance bancaire restent à vérifier.
  Le décor commence à environ 2,17 mm du bord : une imprimante non bord à bord
  peut le rogner ; ajuster à la page réduirait les dimensions du gabarit.
- Vérifications détaillées en section 10.4 de la conception technique. Les
  contrôles PDF natif de la v0.1.5 restent limités à cette version.

Le décor est reconstruit à partir du guide public, avec approximation RVB des
couleurs. Il ne s’agit pas du fichier maître d’impression Febelfin ni d’une
homologation bancaire. La dernière distribution publique reste la v0.1.5.

## 0.1.5 — 2026-10-30

- Bulletin d’aide au paiement en fin de facture, avec montant restant dû,
  bénéficiaire, IBAN et communication. Présentation HTML/CSS sans dépendance :
  fond saumon, repères rouges et police monospace, avec dimensions adaptatives.
- Affichage limité aux factures en EUR, avec montant positif exact en centimes,
  un seul moyen de paiement, un seul IBAN à clé valide et un bénéficiaire connu.
  Codes admis : `30`, `58`, `42` ; code `1` ou absent uniquement si le compte est
  belge et la communication structurée belge valide.
- Aucun bulletin pour les avoirs, prélèvements, mandats, cartes, espèces,
  factures soldées, devises autres que l’euro ou comptes multiples. La présence
  d’un `CardAccount` est exclue même avec un code de virement ; plusieurs
  identifiants bancaires dans un même compte empêchent aussi le bulletin.
- Présentation des communications belges valides sous la forme
  `+++ddd/dddd/ddddd+++`, sans modifier les autres références.
- Bénéficiaire choisi parmi la partie bénéficiaire, le titulaire du compte, puis
  le fournisseur. L’adresse du fournisseur n’est pas attribuée à un titulaire différent.
- Bloc prévu pour rester entier à l’impression. Cette aide à la saisie n’est pas
  un formulaire bancaire homologué et ne transmet aucun ordre de paiement.
- **37 tests sur 37 passent** : 14 lecteur XML, 11 paiement, 10 application et
  2 synchronisation des versions.
- Exemple 07 contrôlé dans le navigateur intégré sur ordinateur et à 390 × 844
  pixels, sans débordement horizontal. Ouverture WebMCP native réussie ; valeurs
  complètes présentes dans l’arbre d’accessibilité, cases décoratives masquées.
  Ce contrôle ne constitue pas un audit complet avec lecteur d’écran.
- Contrôle local du parseur sur une facture privée : communication, montant,
  bénéficiaire et BIC vérifiés, sans copie partagée.
- Contrôle complémentaire du PDF natif fourni par l’utilisateur : trois pages A4,
  seize lignes de facture réparties sur les deux premières pages, en-tête du
  tableau répété et bulletin entier en page 3. Couleurs, champs et numérotation
  lisibles, sans coupure ni chevauchement observés. Les données de paiement
  correspondent au XML ; navigateur et réglages exacts non connus.

Préversion distribuée sur GitHub avec ZIP autonome, mode d’emploi, six fichiers
applicatifs séparés et empreinte SHA-256. Aucun document de facturation privé
n’est ajouté au dépôt ou à la distribution.

## 0.1.4 — 2026-10-26

- Interface de dépôt simplifiée : le bouton visible « Choisir un fichier » devient
  un petit texte sous « Déposez votre facture ici. ».
- Toute la zone reste cliquable ; le glisser-déposer et l’activation native au
  clavier sont conservés, avec un indicateur de focus autour du panneau.
- Préparation depuis la dernière version GitHub : lien « GitHub · Versions »,
  corrections TVA et mise en page PDF des versions 0.1.2/0.1.3 conservés.

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
