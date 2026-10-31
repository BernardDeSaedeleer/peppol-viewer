# Peppol Viewer

Visionneuse française de factures et notes de crédit XML **Peppol BIS Billing 3.0 / UBL**.
Un outil local pour déposer un XML, afficher une facture lisible et l’imprimer,
avec une architecture KISS.

## Télécharger et démarrer

**[Télécharger Peppol Viewer 0.1.5 prêt à l’emploi](https://github.com/BernardDeSaedeleer/peppol-viewer/releases/download/v0.1.5/Peppol-Viewer-0.1.5.zip)** · [Page de la version et téléchargement sans ZIP](https://github.com/BernardDeSaedeleer/peppol-viewer/releases/tag/v0.1.5)

1. Téléchargez l’archive ci-dessus.
2. Sous Windows, faites un clic droit sur le fichier ZIP, puis **Extraire tout…**.
3. Dans le dossier extrait, double-cliquez sur **index.html**.
4. Déposez votre facture XML dans la zone de dépôt, ou cliquez dans cette zone pour choisir le fichier.

Conservez **index.html** et le dossier **assets** ensemble. Aucun logiciel
supplémentaire ni commande à exécuter : un navigateur suffit. La lecture fonctionne
sans connexion Internet ; toutes les données restent sur votre ordinateur.

Pour vérifier les mises à jour, cliquez sur **GitHub · Versions** dans le pied de
page et comparez les versions publiées au numéro de votre copie. Cette consultation
nécessite Internet ; aucune vérification automatique n’est effectuée.

Les six fichiers sont aussi disponibles séparément sur la page de la version,
avec les instructions pour les placer dans les bons dossiers.
[Consulter le mode d’emploi complet](https://github.com/BernardDeSaedeleer/peppol-viewer/releases/download/v0.1.5/Mode-emploi.txt).

Cette **préversion** est destinée aux premiers essais et retours utilisateurs.
La pagination PDF reste à vérifier selon le navigateur et le document.

La **v0.1.5, publiée le 30 octobre 2026**, ajoute un bulletin
d’aide au paiement en fin de facture lorsque les informations permettent de
présenter un virement sans ambiguïté, ainsi que le formatage des communications
structurées belges valides.

La **v0.1.6 est préparée pour revue, sans publication à ce stade**. Elle remplace
ce bulletin adaptatif par un gabarit inspiré des directives Febelfin, avec des
dimensions d’impression fixes de **210 × 101,6 mm**. Les liens de téléchargement
ci-dessus désignent toujours la dernière distribution publique, la v0.1.5.

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

Déposer **un seul XML** (5 Mo et 2 000 lignes maximum), ou cliquer dans la zone de dépôt
pour choisir un fichier. Cette zone reste accessible au clavier avec Tab, puis Entrée ou Espace.
« Fermer » efface l’aperçu et revient à la zone de dépôt pour ouvrir une autre facture.
Déposer un fichier pendant la consultation remplace le document après lecture réussie.
Une erreur conserve l’aperçu précédent et le signale explicitement.
« Imprimer / PDF » utilise la boîte de dialogue du navigateur : sélectionner
« Enregistrer au format PDF ». Choisir **A4**, **portrait**, une échelle de **100 %**
ou **Taille réelle**, et les **marges par défaut** pour laisser agir la feuille de
style. Ne pas sélectionner « Ajuster à la page ». Pour le bulletin, imprimer en
**couleur**, en **recto uniquement**. Désactiver les en-têtes/pieds de page automatiques
du navigateur : la feuille de style prévoit son propre « Page x / y » dans les
navigateurs compatibles. Les lignes d’un tableau large défilent horizontalement sur mobile.

## Exemples de démonstration

Le dossier [`exemples`](exemples/README.md) contient sept documents de démonstration
et deux fichiers volontairement invalides. Les données sont fictives, sauf l’IBAN
du spécimen public Febelfin utilisé dans l’exemple de bulletin : aucun paiement ne
doit être effectué. Le guide précise les montants attendus et les fonctionnalités
à tester. Ces fichiers sont exclus de la publication statique.

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

### Bulletin d’aide au paiement — candidate v0.1.6

Le bulletin reprend le montant restant à payer, le bénéficiaire, l’IBAN et la
communication à la fin de la facture. Il apparaît uniquement pour une facture en
EUR avec un montant strictement positif représentable exactement en euros et
centimes, un seul moyen de paiement, un seul IBAN dont la clé de contrôle est
valide et un bénéficiaire identifié. Aucun arrondi ni recalcul du solde n’est effectué.

Les moyens de paiement `30`, `58` et `42` sont retenus. Le code `1` ou un code
absent n’est admis que pour un compte belge accompagné d’une communication belge
structurée valide. Les avoirs, prélèvements, mandats, cartes, espèces, factures
soldées, autres devises et comptes multiples n’affichent pas ce bulletin. La présence
d’une carte exclut aussi le bulletin si le code indique un virement ; plusieurs
identifiants bancaires dans un seul compte sont également refusés.
Une communication de douze chiffres avec une clé modulo 97 valide est présentée
sous la forme `+++ddd/dddd/ddddd+++` dans le contexte d’un compte belge ; les
autres références conservent leur texte.

Le gabarit vectoriel conserve la disposition du formulaire belge : fond saumon,
repères rouges, données noires en police monospace et zones du donneur d’ordre.
Il mesure **210 × 101,6 mm à l’impression** et commence sur une page séparée,
après la facture. À l’écran, l’ensemble est réduit proportionnellement sans
déplacer les champs. Les zones du donneur d’ordre, de signature et de date
d’exécution restent vierges ; l’échéance de facture figure hors du formulaire.

Les données sont présentées en majuscules dans le bulletin, avec leurs accents.
Le XML et les valeurs extraites ne sont pas modifiés. Une entité doublement
échappée, telle que `&amp;apos;` dans le XML, n’est pas réparée par l’application.
Si un nom ou une ligne d’adresse dépasse 26 caractères, une communication libre
34 caractères, ou si un autre champ ne peut pas être représenté dans les zones
prévues, un message explique l’absence du bulletin. Aucune valeur n’est coupée,
abrégée ou imprimée avec une police réduite pour la faire entrer. Les informations
de facture et de paiement restent consultables.

Cette adaptation suit les cotes du guide public Febelfin ; son décor est
reconstruit d’après le modèle publié et ses couleurs sont des approximations
RVB. Ce n’est pas le fichier maître d’impression de Febelfin, ni un formulaire
homologué. La lecture par les applications bancaires **reste à tester** : après
un scan, toujours vérifier les champs reconnus. L’application ne transmet aucun
ordre et le contrôle de l’IBAN ne vérifie ni l’existence du compte ni son titulaire.
Les règles détaillées et les références Febelfin figurent dans la
[conception technique](docs/technical-design.md#65-bulletin-daide-au-paiement).

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

La suite couvre la précision décimale, les exclusions du bulletin, les entrées
refusées, l’injection de balises, la conservation de l’aperçu après erreur et la
délégation de l’impression. Pour la v0.1.6, elle vérifie aussi les limites du
gabarit et l’absence de mutation des données. Les résultats de cette candidate
et les contrôles visuels sont consignés dans la
[section de vérification v0.1.6](docs/technical-design.md#104-vérifications-de-la-candidate-v016).

Le 31 octobre 2026, les **49 tests sur 49 passent** : 14 lecteur XML, 18 paiement,
15 application et 2 construction/version. Le build et le contrôle du diff
réussissent. L’exemple 07 a été inspecté sur ordinateur et à une largeur mobile
de 390 pixels, sans débordement horizontal. Un contrôle local d’un XML privé a
confirmé la conservation du fichier et des valeurs extraites, sans publication
de ses données.

La tentative d’impression dans le navigateur intégré n’a pas produit de PDF
exploitable. La taille physique à 100 %, le rendu papier et la reconnaissance
bancaire restent donc à vérifier avant de considérer ces usages comme validés.
Une imprimante qui n’imprime pas jusqu’aux bords peut rogner le décor, situé à
environ 2,17 mm du bord ; l’option « Ajuster à la page » ne doit pas servir à
compenser ce rognage, car elle réduit aussi le gabarit.

Les **37 tests passants** et les contrôles écran/PDF du 30 octobre 2026 concernent
la v0.1.5 : ils restent documentés comme historique, sans valider le nouveau
gabarit de la v0.1.6. Aucun essai de reconnaissance par une application bancaire
n’a encore été réalisé.

## Versionnement et publication

Le badge « Version installée » indique la version de la copie ouverte, y compris
hors ligne. `package.json` est la source unique du numéro : ne pas modifier le badge
manuellement. Il est synchronisé dans `index.html` au lancement du serveur local et
à chaque build, puis inclus dans `dist/index.html`. Aucune connexion ni
vérification de mise à jour n’est nécessaire à son affichage.

Numérotation `MAJEURE.MINEURE.CORRECTIF` :

- `0.1.4` : zone de dépôt simplifiée et corrections TVA/PDF conservées.
- `0.1.5` : dernière préversion publiée ; bulletin d’aide au paiement et présentation des communications structurées belges.
- `0.1.6` : candidate en revue ; gabarit Febelfin à taille réelle, sans modification des données XML.
- `0.2.0` : ajout de fonctionnalités pendant la phase de préparation.
- `1.0.0` : première version stable ; ensuite, changement majeur pour une évolution
  incompatible, mineur pour une fonction compatible, correctif pour une réparation.

Pour préparer une distribution : modifier `version` dans `package.json`, décrire les
changements dans [`CHANGELOG.md`](CHANGELOG.md), exécuter les tests puis
`node scripts/build.mjs`. Distribuer ensemble `dist/index.html` et le dossier
`dist/assets/` dans un dossier nommé, par exemple, `Peppol-Viewer-0.1.6`. Conserver chaque version
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
