# Peppol Viewer

Visionneuse française de factures et notes de crédit XML **Peppol BIS Billing 3.0 / UBL**.
Un outil local pour déposer un XML, afficher une facture lisible et l’imprimer,
avec une architecture KISS.

## Télécharger et démarrer

**[Télécharger Peppol Viewer 0.1.2 prêt à l’emploi](https://github.com/BernardDeSaedeleer/peppol-viewer/releases/download/v0.1.2/Peppol-Viewer-0.1.2.zip)** · [Page de la version et téléchargement sans ZIP](https://github.com/BernardDeSaedeleer/peppol-viewer/releases/tag/v0.1.2)

1. Téléchargez l’archive ci-dessus.
2. Sous Windows, faites un clic droit sur le fichier ZIP, puis **Extraire tout…**.
3. Dans le dossier extrait, double-cliquez sur **index.html**.
4. Déposez votre facture XML dans la zone de dépôt.

Conservez **index.html** et le dossier **assets** ensemble. Aucun logiciel
supplémentaire ni commande à exécuter : un navigateur suffit. La lecture fonctionne
sans connexion Internet ; toutes les données restent sur votre ordinateur.

Les six fichiers sont aussi disponibles séparément sur la page de la version,
avec les instructions pour les placer dans les bons dossiers.
[Consulter le mode d’emploi complet](https://github.com/BernardDeSaedeleer/peppol-viewer/releases/download/v0.1.2/Mode-emploi.txt).

Cette **préversion** est destinée aux premiers essais et retours utilisateurs.
La pagination PDF reste à vérifier selon le navigateur et le document.

Auteur : [Bernard De Saedeleer](https://www.linkedin.com/in/bernard-de-saedeleer-059070aa).
© 2026 Bernard De Saedeleer.

Code source : [BernardDeSaedeleer/peppol-viewer](https://github.com/BernardDeSaedeleer/peppol-viewer).

La [documentation technique détaillée](docs/technical-design.md) décrit
l’architecture, le mapping UBL, les règles de restitution, la sécurité, les tests
et les procédures d’exploitation.

## Utilisation locale

Dans la version distribuée aux utilisateurs, ouvrir **`index.html`**. C’est le
seul fichier à la racine, accompagné du dossier **`assets`** qui contient les
scripts, les styles et les images. Conserver `index.html` et `assets` ensemble
pour déplacer ou partager l’application. Il n’est pas nécessaire d’ouvrir `assets`.

Ouvrir `index.html` dans un navigateur moderne. Aucun logiciel supplémentaire n’est
nécessaire pour lire les factures. Les scripts sont classiques et fonctionnent aussi
en `file://`.

Pour un aperçu servi en HTTP avec Node.js 22 ou ultérieur :

```powershell
node scripts/serve.mjs
```

Ouvrir http://127.0.0.1:4173. Le serveur ne distribue que six fichiers publics et
n’accepte aucun téléversement. Arrêt : Ctrl+C.

Déposer **un seul XML** (5 Mo et 2 000 lignes maximum), ou choisir un fichier.
« Fermer » efface l’aperçu et revient à la zone de dépôt pour ouvrir une autre facture.
Déposer un fichier pendant la consultation remplace le document après lecture réussie.
Une erreur conserve l’aperçu précédent et le signale explicitement.
« Imprimer / PDF » utilise la boîte de dialogue du navigateur : sélectionner
« Enregistrer au format PDF ». Choisir **A4**, **portrait**, une échelle de **100 %**
et les **marges par défaut**. Désactiver les en-têtes/pieds de page automatiques
du navigateur : la feuille de style prévoit son propre « Page x / y » dans les
navigateurs compatibles. Les lignes d’un tableau large défilent horizontalement sur mobile.

## Exemples de démonstration

Le dossier [`exemples`](exemples/README.md) contient six documents fictifs et deux
fichiers volontairement invalides. Le guide précise les montants attendus et les
fonctionnalités à tester. Ces fichiers sont exclus de la publication statique.

## Périmètre

- Factures `Invoice` et notes de crédit `CreditNote` déclarant exactement
  `urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0`.
- Fournisseur, client, références, lignes, base du prix unitaire, remises/frais de
  ligne et globaux, ventilation TVA, totaux, acompte, arrondi et paiement.
- Montants et signes repris du XML, sans calcul comptable et sans conversion de devise.
  Les décimales sont formatées comme des chaînes, sans perte liée aux nombres flottants.
- Namespaces XML reconnus indépendamment des préfixes choisis par le fournisseur.
- UTF-8, UTF-16 et encodages déclarés reconnus par `TextDecoder`.
- Les références et descriptions des documents complémentaires sont affichées.
  Un avertissement distinct signale les pièces jointes incluses et les liens externes,
  dont le contenu n’est pas affiché ni ouvert. Une simple référence ne déclenche pas cet avertissement.

Il s’agit d’un **aperçu synthétique**, pas d’une restitution exhaustive de chaque champ
UBL, d’un validateur XSD/Schematron, d’un logiciel comptable ou d’une connexion au réseau
Peppol. Les enveloppes de transport, CII/Factur-X et autres profils Peppol sont hors périmètre.
Les données manquantes sont affichées par un tiret avec avertissement pour les totaux clés.
Les prix affichés sont les prix nets fournis par le XML ; le détail d’une remise déjà
intégrée au prix n’est pas développé. Le XML original reste la référence.

## Confidentialité

Le contenu de la facture reste en mémoire dans l’onglet : aucun envoi, stockage
persistant, compte applicatif, analytics ou service tiers. Fermer le document ou
recharger la page efface l’aperçu. L’impression et l’enregistrement PDF sont commandés par l’utilisateur.
Les DTD/entités personnalisées sont refusées. Les valeurs importées sont insérées
uniquement comme texte. La politique CSP interdit les connexions depuis l’application.

Le navigateur peut proposer le WebMCP expérimental : `open_peppol_xml` reçoit un XML
fourni par l’utilisateur et utilise le même lecteur. Aucune dépendance ni polyfill
n’est chargé si cette API est absente.

Ne pas placer de vraies factures dans Git. Utiliser `private/` (ignoré) pour des essais
personnels ; seuls les exemples publics OpenPeppol et les documents fictifs du
dossier `exemples/` sont versionnés.

## Développement et vérification

Application : HTML, CSS et JavaScript natif ; aucune dépendance à l’exécution.
La seule dépendance de développement est un DOM XML pour les tests Node.js.

```powershell
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

`node scripts/build.mjs` synchronise le numéro de version du pied de page, puis
prépare `dist/index.html` et place les cinq fichiers techniques dans `dist/assets/`.
Les chemins de l’HTML distribué sont adaptés automatiquement ; le chemin de la
mascotte reste relatif à la feuille de style. Distribuer le contenu de `dist/`.
`parser.js` lit et normalise le XML ; `app.js` gère les interactions et crée les éléments
HTML avec `textContent`. `styles.css` contient les styles écran, mobile et A4.

`mascot.png` contient les quatre expressions du robot-document géométrique :
accueil, attention au survol ou au focus, invitation au dépôt et interrogation
en cas d’erreur. Le coin de feuille, l’écran à pixels et les lignes de registre
rappellent le XML et la lecture comptable. Cette image est chargée localement,
sans service externe. Les mouvements restent discrets, sans animation en boucle,
et sont désactivés si le navigateur demande de réduire les animations.

Les tests couvrent les exemples officiels, devises de TVA distinctes, préfixes XML,
précision décimale, encodages, entrées refusées, injection de balises, état conservé
après erreur, dépôt de fichier et délégation de l’impression. Le rendu et le contrat
WebMCP sont exercés dans un adaptateur DOM Node, pas dans un navigateur réel.
La mise en page visuelle, la pagination PDF et le WebMCP natif restent à confirmer
dans le navigateur avec les factures habituelles de l’utilisateur.

## Versionnement et publication

Le badge « Version installée » indique la version de la copie ouverte, y compris
hors ligne. `package.json` est la source unique du numéro : ne pas modifier le badge
manuellement. Il est synchronisé dans `index.html` au lancement du serveur local et
à chaque build, puis inclus dans `dist/index.html`. Aucune connexion ni
vérification de mise à jour n’est nécessaire à son affichage.

Numérotation `MAJEURE.MINEURE.CORRECTIF` :

- `0.1.2` : préversion actuelle, avec les corrections de présentation TVA et d’impression.
- `0.1.3` : exemple de correction suivante sans nouvelle fonctionnalité.
- `0.2.0` : ajout de fonctionnalités pendant la phase de préparation.
- `1.0.0` : première version stable ; ensuite, changement majeur pour une évolution
  incompatible, mineur pour une fonction compatible, correctif pour une réparation.

Pour préparer une distribution : modifier `version` dans `package.json`, décrire les
changements dans [`CHANGELOG.md`](CHANGELOG.md), exécuter les tests puis
`node scripts/build.mjs`. Distribuer ensemble `dist/index.html` et le dossier
`dist/assets/` dans un dossier nommé, par exemple, `Peppol-Viewer-0.1.2`. Conserver chaque version
déjà distribuée sans en remplacer les fichiers ; attribuer un nouveau numéro à la
distribution suivante. `node scripts/version.mjs` permet aussi de synchroniser
uniquement le pied de page avant d’ouvrir le fichier source `index.html` directement.

Le dépôt GitHub contient le code source, la documentation, les tests et les exemples
fictifs. Les dépendances installées, `dist/`, les archives de build, les réglages
d’hébergement locaux et le dossier `private/` restent exclus du dépôt.
La publication du code sur GitHub ne change pas le fonctionnement hors ligne de
l’application. Le livrable reste utilisable chez tout hébergeur statique.
Retour arrière : restaurer un commit précédent dans une copie distincte et
reconstruire `dist/`. Aucune migration de données n’est nécessaire.

Référence : https://docs.peppol.eu/poacc/billing/3.0/
