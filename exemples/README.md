# Factures fictives pour Peppol Viewer

Ces fichiers sont entièrement synthétiques : sociétés, adresses, références et coordonnées de paiement sont inventées. Les identifiants « DEMO », « BE0000000000 » et « COMPTE-FICTIF-NE-PAS-PAYER » ne sont pas utilisables. Aucun paiement ni envoi sur le réseau Peppol ne doit être effectué.

Ils servent à tester le lecteur. Ils ne constituent pas des factures à émettre ni un jeu certifié conforme aux règles XSD/Schematron de Peppol. Les taux sont des scénarios d’affichage, pas des recommandations fiscales.

## Essayer les fichiers

1. Ouvrir le site, ou le fichier index.html à la racine du projet.
2. Glisser **un seul XML** dans la zone de dépôt, ou utiliser **Choisir un fichier**.
3. Vérifier le contenu et le montant attendu ci-dessous.
4. Tester **Fermer** : l’accueil et la zone de dépôt réapparaissent. Déposer une autre facture, puis tester **Imprimer / PDF**. Choisir A4 et désactiver les en-têtes/pieds de page du navigateur si nécessaire.

| Fichier | Ce qu’il permet de vérifier | Résultat attendu |
|---|---|---|
| 01-facture-simple.xml | Fournisseur, client, références, 2 lignes, unités et TVA 21 % | HT 242,00 EUR ; TVA 50,82 EUR ; à payer **292,82 EUR** |
| 02-plusieurs-taux-tva.xml | Ventilation de TVA à 6 %, 12 % et 21 % | HT 230,00 EUR ; TVA 31,80 EUR ; à payer **261,80 EUR** |
| 03-remise-frais-acompte.xml | Remise globale de 100 EUR, frais de 20 EUR, acompte de 300 EUR | HT 920,00 EUR ; TTC 1 113,20 EUR ; à payer **813,20 EUR** |
| 04-note-de-credit.xml | Note de crédit et référence à la facture d’origine | **121,00 EUR à créditer**, sans inversion automatique du signe |
| 05-facture-longue-48-lignes.xml | Défilement, textes longs, tableau et impression sur plusieurs pages | 48 lignes ; HT 1 788,00 EUR ; à payer **2 163,48 EUR** |
| 06-devise-usd-utf16.xml | UTF-16, accents, USD, exonération fictive, prix à 8 décimales par 100 unités et texte contenant des balises | **71,40 USD** ; prix 3,14159265 USD ; balises affichées comme texte ; référence ANNEXE-DEMO visible, sans avertissement de pièce jointe |

## Vérifier les erreurs

Ouvrir d’abord une facture correcte, puis essayer les fichiers du sous-dossier erreurs :

- 01-format-non-peppol.xml : message « Format non pris en charge ».
- 02-xml-mal-forme.xml : message « Le XML est illisible ou mal formé ».

Dans les deux cas, **la facture déjà ouverte doit rester affichée**. Déposer deux fichiers simultanément doit demander de choisir un seul XML.

Les exemples sont fournis avec les sources locales et restent hors du dossier public dist : ils ne sont pas publiés automatiquement.
