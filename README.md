# Sika — suivi financier et épargne

Application web mobile pour suivre son argent au quotidien et planifier son épargne, pensée pour la
Côte d'Ivoire : salaire de fin de mois **et** revenus irréguliers, loyer, factures CIE / SODECI,
abonnements, Mobile Money, tontines, argent prêté aux proches, soutien à la famille.

Elle s'installe sur le téléphone comme une application (PWA), fonctionne **hors connexion**, et peut
synchroniser les données avec un **compte en ligne** (connexion par code reçu par e-mail).

## Écrans

| Écran | Contenu |
|---|---|
| **Accueil** | Total dépensé du mois et comparaison avec le mois précédent, revenus, reste et **reste prévu en fin de mois**, actions rapides, paiements à confirmer, prochains paiements, dernières transactions |
| **Calendrier** | Mois avec des points de couleur (factures, revenus, tontine, dettes) et frise jour par jour |
| **+** | Ajout rapide : dépense, revenu, opération Mobile Money ou paiement programmé |
| **Épargne** | Objectifs (montant à mettre de côté par mois / semaine / jour), règle « X % de chaque rentrée d'argent », simulateur d'intérêts composés |
| **Plus** | Tontines, dettes et prêts, paiements programmés, analyses, budgets, transactions, réglages, compte |

## Fonctionnalités

- **Catégories locales** : loyer, électricité (CIE), eau (SODECI), TV / internet, crédit & data,
  marché, transport (gbaka, woro-woro…), scolarité, famille / village, cérémonies, tontine, frais
  Mobile Money…
- **Paiements programmés** (hebdomadaire, mensuel, tous les 2 mois, trimestriel, annuel ; un 31 tombe
  le dernier jour des mois courts) :
  - *montant fixe* : enregistrement automatique possible à chaque échéance ;
  - *montant variable* (CIE, SODECI) : un rappel demande de confirmer le montant de la facture ;
  - modèles en un geste : salaire (fin du mois), loyer, CIE, SODECI, Canal+, internet, forfait, scolarité ;
  - fiche détaillée : prochaine échéance, total payé, rappel (J-0 à J-7), pause, arrêt, historique.
- **Revenus irréguliers** : à chaque revenu ajouté, Sika propose d'en épargner un pourcentage
  (10 % par défaut) vers un objectif ; les objectifs sont comparés au **revenu moyen des 3 derniers mois**.
- **Mobile Money** (Wave, Orange Money, MTN MoMo, Moov Money) : envoi, retrait, dépôt, avec frais
  calculés automatiquement et suivis à part. Les grilles par défaut (environ 1 %, plafond MTN de
  4 500 F) sont **indicatives** et modifiables dans *Réglages*, et à chaque opération.
- **Tontines** : cotisation, fréquence, ordre de passage, cagnotte, membres ayant cotisé pour chaque
  tour, date de mon tour, réception de la cagnotte.
- **Dettes et prêts** : ce qu'on me doit / ce que je dois, remboursements partiels, échéance avec rappel.
- **Analyses** : répartition des dépenses, factures, soutien familial, frais Mobile Money,
  6 derniers mois, règle 50 / 30 / 20 ; **budgets** par catégorie (alerte à 80 % et au-delà de 100 %).
- **Rappels** : cloche avec les paiements à confirmer ; notifications du téléphone (si autorisées) à
  l'ouverture de l'application.
- **Sauvegarde** : export / import JSON, export CSV (Excel), thème clair / sombre automatique.

## Lancer en local

```bash
python3 -m http.server 8080   # ou : npm start
```

Puis ouvrir <http://localhost:8080>. Aucune dépendance à installer.

## Compte en ligne (Supabase)

Sans configuration, Sika garde les données sur le téléphone. Pour activer les comptes :

1. Créer un projet gratuit sur <https://supabase.com>.
2. **SQL Editor** → coller le contenu de [`supabase/schema.sql`](supabase/schema.sql) → **Run**
   (crée la table `sika_state` protégée : chacun ne voit que ses données).
3. **Authentication → Sign In / Providers** : vérifier que *Email* est activé.
4. **Authentication → Emails → Templates** : dans **les deux** modèles **Confirm signup** (première
   connexion d'une adresse) et **Magic Link** (connexions suivantes), remplacer le contenu par un
   message contenant le code, par exemple :
   `<h2>Votre code Sika</h2><p>Entrez ce code dans l'application : <b>{{ .Token }}</b></p>`
   (par défaut Supabase envoie un lien ; Sika utilise le **code à 6 chiffres**).
5. **Authentication → URL Configuration** : *Site URL* = `https://oden225.github.io/Sika/`.
6. **Project Settings → API** : copier *Project URL* et la clé *anon public* dans
   [`js/config.js`](js/config.js), puis publier.

> Le service d'e-mail intégré de Supabase est limité à quelques envois par heure : pour de vrais
> utilisateurs, configurez un SMTP (Brevo, Resend…) dans **Authentication → Emails → SMTP Settings**.

Fonctionnement de la synchronisation : les données restent sur le téléphone (hors connexion
possible) et une copie est envoyée au compte 1,5 s après chaque modification. À l'ouverture, la
version la plus récente l'emporte. À la première connexion d'un téléphone qui a déjà des données,
Sika demande lesquelles garder.

## Tests

```bash
npm test
```

Les calculs (`js/calc.js`) et la migration des données (`js/store.js`) sont testés avec `node --test`.

## Structure

```
index.html            Coquille de l'application et barre de navigation
css/style.css         Thème « verre dépoli », clair et sombre
css/otp.css           Saisie animée du code de connexion
js/app.js             Navigation, rappels, démarrage
js/data.js            Catégories, modèles de factures, opérateurs Mobile Money
js/calc.js            Calculs purs (échéances, épargne, tontine, dettes, frais…)
js/store.js           Stockage local et migration
js/actions.js         Modifications partagées (payer, épargner, cotiser…)
js/sheets.js          Formulaires en feuille du bas
js/cloud.js           Compte et synchronisation Supabase
js/config.js          Identifiants Supabase (vide = sans compte)
js/screens/           Écrans
supabase/schema.sql   Table et règles d'accès
sw.js, manifest…      Installation et mode hors connexion
```
