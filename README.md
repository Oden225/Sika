# Sika — suivi financier et planification de l'épargne

Application web simple pour suivre ses revenus et ses dépenses, et planifier son épargne.
Elle fonctionne entièrement dans le navigateur : **aucun compte, aucun serveur, vos données restent sur votre appareil** (stockage local du navigateur).

## Fonctionnalités

- **Tableau de bord mensuel** : revenus, dépenses, reste à vivre, taux d'épargne, dépenses par catégorie, évolution sur 6 mois.
- **Transactions** : saisie rapide des revenus et dépenses par catégorie, historique filtrable par mois.
- **Budgets** : plafond mensuel par catégorie, avec alerte visuelle à 80 % puis en cas de dépassement.
- **Objectifs d'épargne** : montant visé, date limite, rendement annuel éventuel.
  L'application calcule **combien mettre de côté chaque mois** pour atteindre l'objectif à temps.
  Les versements peuvent être enregistrés automatiquement comme transactions « Épargne ».
- **Règle 50 / 30 / 20** : répartition indicative besoins / envies / épargne selon vos revenus.
- **Simulateur** : projection de l'épargne avec intérêts composés (capital de départ, versement mensuel, rendement, durée).
- **Sauvegarde** : export / import JSON, export CSV des transactions (ouvrable dans Excel), devise configurable (FCFA par défaut).

## Utilisation

Aucune installation nécessaire. Servez le dossier avec n'importe quel serveur statique, par exemple :

```bash
python3 -m http.server 8080
# ou
npm start
```

Puis ouvrez <http://localhost:8080>.

Pour l'utiliser depuis votre téléphone, vous pouvez publier le dépôt avec **GitHub Pages**
(Settings → Pages → branche principale, dossier racine).

> Pensez à exporter régulièrement vos données (onglet Réglages) : vider les données du navigateur les efface.

## Tests

```bash
npm test
```

Les fonctions de calcul (`js/calc.js`) sont couvertes par `tests/calc.test.mjs` (Node 18+, sans dépendance).

## Structure

```
index.html        Interface
css/style.css     Styles (thème clair / sombre automatique)
js/calc.js        Calculs purs : résumés, objectifs, projections
js/store.js       Persistance locale (localStorage)
js/app.js         Logique d'interface
tests/            Tests unitaires
```
