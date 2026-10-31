# Factures fictives pour Peppol Viewer

Ces fichiers utilisent des sociétés, adresses et références fictives. Les
coordonnées de paiement sont inventées, sauf l’IBAN du spécimen public Febelfin
repris dans les exemples 07 à 11 pour tester sa clé de contrôle. L’exemple 12
utilise volontairement un IBAN invalide. Les identifiants « DEMO »,
« BE0000000000 » et « COMPTE-FICTIF-NE-PAS-PAYER » ne sont pas utilisables.
**Aucun paiement ni envoi sur le réseau Peppol ne doit être effectué.**

Ils servent à tester le lecteur. Ils ne constituent pas des factures à émettre ni un jeu certifié conforme aux règles XSD/Schematron de Peppol. Les taux sont des scénarios d’affichage, pas des recommandations fiscales.

## Essayer les fichiers

1. Ouvrir le site, ou le fichier index.html à la racine du projet.
2. Glisser **un seul XML** dans la zone de dépôt, ou cliquer dans la zone de dépôt.
3. Vérifier le contenu et le montant attendu ci-dessous.
4. Tester **Fermer** : l’accueil et la zone de dépôt réapparaissent. Déposer une autre facture, puis tester **Imprimer / PDF**. Choisir A4 portrait, **100 % / Taille réelle**, marges par défaut et désactiver les en-têtes/pieds de page du navigateur. Pour le bulletin de la v0.1.6, choisir la couleur et le recto uniquement ; éviter « Ajuster à la page ».

| Fichier | Ce qu’il permet de vérifier | Résultat attendu |
|---|---|---|
| 01-facture-simple.xml | Fournisseur, client, références, 2 lignes, unités et TVA 21 % | HT 242,00 EUR ; TVA 50,82 EUR ; à payer **292,82 EUR** |
| 02-plusieurs-taux-tva.xml | Ventilation de TVA à 6 %, 12 % et 21 % | HT 230,00 EUR ; TVA 31,80 EUR ; à payer **261,80 EUR** |
| 03-remise-frais-acompte.xml | Remise globale de 100 EUR, frais de 20 EUR, acompte de 300 EUR | HT 920,00 EUR ; TTC 1 113,20 EUR ; à payer **813,20 EUR** |
| 04-note-de-credit.xml | Note de crédit et référence à la facture d’origine | **121,00 EUR à créditer**, sans inversion automatique du signe |
| 05-facture-longue-48-lignes.xml | Défilement, textes longs, tableau et impression sur plusieurs pages | 48 lignes ; HT 1 788,00 EUR ; à payer **2 163,48 EUR** |
| 06-devise-usd-utf16.xml | UTF-16, accents, USD, exonération fictive, prix à 8 décimales par 100 unités et texte contenant des balises | **71,40 USD** ; prix 3,14159265 USD ; balises affichées comme texte ; référence ANNEXE-DEMO visible, sans avertissement de pièce jointe |
| 07-bulletin-virement.xml | Gabarit Febelfin et communication belge avec moyen de paiement non précisé (code 1) | **292,82 EUR** ; **+++202/6000/10195+++** ; **ATELIER PIXEL DÉMO** ; bulletin 210 × 101,6 mm sur une page d’impression séparée en v0.1.6 |
| [08-accents-precomposes-26.xml](08-accents-precomposes-26.xml) | Nom de 26 caractères affichés avec accents précomposés (NFC) | **292,82 EUR** ; bulletin présent ; nom dans exactement 26 cases |
| [09-accents-decomposes-26.xml](09-accents-decomposes-26.xml) | Même nom, mais chaque accent est encodé séparément de sa lettre (NFD) | **292,82 EUR** ; même nom à l’écran et même bulletin que le 08 ; une lettre et son accent dans chaque case |
| [10-accents-decomposes-27.xml](10-accents-decomposes-27.xml) | Nom décomposé de 27 caractères affichés | **292,82 EUR** ; nom conservé intégralement dans la facture ; « Le nom du bénéficiaire dépasse les 26 caractères du gabarit. » |
| [11-communication-trop-longue.xml](11-communication-trop-longue.xml) | Communication libre de 35 caractères, virement explicite (code 58) | **292,82 EUR** ; communication complète dans le paiement ; « La communication dépasse les 34 caractères du gabarit. » |
| [12-iban-invalide.xml](12-iban-invalide.xml) | Compte bénéficiaire volontairement invalide | **292,82 EUR** ; compte conservé dans le paiement ; « L’IBAN du bénéficiaire est invalide. » |

Les exemples 07 à 11 utilisent l’IBAN du spécimen public Febelfin (`BE68 5390 0754 7034`) pour exercer le contrôle de clé. Sa validité syntaxique ne signifie pas qu’un paiement est autorisé. **Ne pas payer**. La communication et les autres données restent fictives.

Pour la candidate v0.1.6, le nom fictif « Atelier Pixel Démo » reste dans la limite
de 26 caractères du gabarit. La communication structurée doit occuper seule sa
zone ; les zones du donneur d’ordre, de signature et de date d’exécution doivent
rester vides. L’échéance du 19 novembre 2026 demeure une information de facture,
hors du formulaire. Mesurer le bulletin imprimé à 100 % : 210 mm de largeur et
101,6 mm de hauteur. L’aperçu mobile conserve les proportions, sans servir de
preuve des dimensions sur papier. La reconnaissance bancaire reste à vérifier.

Contrôle du 31 octobre 2026 sur la candidate v0.1.6 : l’exemple 07 a été inspecté
sur ordinateur et à 390 × 844 pixels. La largeur du document reste de 375 pixels
sans débordement horizontal, et le SVG mesure environ 307 × 148,52 pixels en
conservant ses proportions. La tentative d’impression dans le navigateur
intégré n’a pas fourni de PDF exploitable ; la mesure à 100 % sur PDF ou papier
reste à réaliser. Le décor situé à environ 2,17 mm du bord peut être rogné par
une imprimante non bord à bord : ne pas réduire le formulaire avec « Ajuster
à la page » pour compenser.

## Comparer les accents et les exclusions du bulletin

Ouvrir successivement les exemples **08**, **09**, puis **10**. Dans les deux
premiers, le nom du bénéficiaire doit occuper les 26 cases du gabarit. Le troisième
ajoute un caractère : le bulletin est remplacé par une explication, tandis que le
nom complet reste visible dans la facture.

Le nom utilisé est « École Démo du Pré Enchanté » : 26 caractères affichés.
Le fichier 08 utilise 26 points Unicode pour ce nom ; le 09 en utilise 30,
car ses quatre accents aigus sont des caractères combinants distincts.
Le 10 ajoute un point final au nom du 09.

Dans le 08, `é` correspond à U+00E9. Dans le 09, le même aspect visuel est obtenu
avec `e` (U+0065), suivi de l’accent aigu combinant U+0301. Ces deux représentations
Unicode sont valides : **l’accent décomposé n’est pas une erreur du XML**. Les
fichiers contiennent réellement ces séquences, et non le texte littéral
`\u0301`. Éviter de normaliser leur texte en les enregistrant dans un éditeur,
car cela supprimerait la différence testée.

Les exemples **10 à 12** restent des factures lisibles. Leur exclusion concerne
uniquement le bulletin ; leurs valeurs ne doivent être ni coupées ni réparées.
Après chaque exclusion, rouvrir le 09 : le bulletin doit revenir et l’ancien
message disparaître. Les notes visibles dans chaque facture rappellent le cas
testé et le résultat attendu.

## Vérifier les erreurs

Ouvrir d’abord une facture correcte, puis essayer les fichiers du sous-dossier erreurs :

- 01-format-non-peppol.xml : message « Format non pris en charge ».
- 02-xml-mal-forme.xml : message « Le XML est illisible ou mal formé ».

Dans les deux cas, **la facture déjà ouverte doit rester affichée**. Déposer deux fichiers simultanément doit demander de choisir un seul XML.

Les exemples sont fournis avec les sources locales et restent hors du dossier public dist : ils ne sont pas publiés automatiquement.
