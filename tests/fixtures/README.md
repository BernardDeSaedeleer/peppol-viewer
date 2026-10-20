# Exemples de test

Les quatre XML proviennent de l’archive d’exemples publique OpenPeppol BIS Billing 3.0,
version de mai 2026, téléchargée le 5 septembre 2026 :
https://docs.peppol.eu/poacc/billing/3.0/files/BIS-Billing3-Examples.zip

- `base-example.xml` : facture avec frais globaux.
- `base-creditnote-correction.xml` : note de crédit.
- `Allowance-example.xml` : remises, frais, acompte et plusieurs catégories TVA.
- `vat-category-E.xml` : exonération, devise GBP.

Fichiers conservés sans modification. Ce sont des exemples de spécification,
pas des factures personnelles. Ils ne sont pas inclus dans la version publiée.

Le 20 octobre 2026, les quatre fichiers ont été comparés octet pour octet avec
les membres `rules/examples/` de l’archive officielle ci-dessus : correspondance
exacte pour chacun. Les noms, coordonnées et comptes qu’ils contiennent sont ceux
des exemples publics OpenPeppol, et ne proviennent pas de documents de l’utilisateur.

Empreintes SHA-256 des fichiers vérifiés :

| Fichier | SHA-256 |
| --- | --- |
| `Allowance-example.xml` | `aa3df18eb8c634624637eb229891d989c5cfb7cd0d08894ff8e58c58f247ea5b` |
| `base-creditnote-correction.xml` | `08e0ad82e0dbe7e16d7533c01761843343a56954ea24881d0f7f1cce06f8879e` |
| `base-example.xml` | `1b7cc3ff1834c8963f2c93f30f171b58002cbf0b2c52dc8765e7e83aebb9f7c9` |
| `vat-category-E.xml` | `4f2f20de65a8c088bba6c43177c75b5066bf30f54b996bc1729a82097a6591db` |
