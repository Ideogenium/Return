# 18_CLOTURE_PROJET.md

**Return ↺ — Clôture du projet et guide de reprise**

> **Date** : 13 novembre 2026
> **Décision** : clôture du projet prise le 13/11/2026 par Ismael (GitHub `Nathan-c-cloud`) et Ozias (GitHub
> `esdrasgbedozin`). **Ozias et Esdras sont la même personne** : les anciens docs (11, 12) disent « Esdras », les
> récents « Ozias ».
> **Source** : dépôt à `98319bd` (`main`), `backend/fly.toml`, `frontend/app.json`, `frontend/eas.json`,
> `.github/workflows/`, `docs/` (00 à 17), `docs/adr/`. Les faits de production (Fly, stores) viennent des deux
> développeurs : ils ne sont pas vérifiables dans le dépôt.
> **Statut** : base rédigée le 13/11 ; les marqueurs **[À compléter par Ozias]** et **[À mettre à jour après fusion]**
> restent à remplir.
> **Rôle** : **point d'entrée unique pour une reprise future**. Un développeur, ou un assistant IA, qui ne connaît pas
> le projet doit savoir ici où on en est et par où reprendre.
> **Règle** : plus aucun nouveau développement. On termine ce qui est commencé (#54, #51, #53), on documente, puis on
> arrête l'infrastructure (section 10).

---

## 1. Résumé

**Return** : application mobile de suivi de prêts d'objets et d'argent entre particuliers (rappels automatiques,
confirmation par l'emprunteur, historique, statistiques). Voir `00_BIBLE_PROJET.md` pour la vision.

- **Backend** : NestJS 11, Prisma, PostgreSQL, Redis (blacklist JWT uniquement), sur Fly.io (`return-api`, région
  `cdg`). Photos sur Cloudflare R2. Notifications par Expo Push Service. CRON in-process (`@nestjs/schedule`).
- **Frontend** : Expo / React Native (TypeScript, Zustand), builds EAS Android et iOS.
- **Organisation** : par fonctionnalité depuis le 25/10/2026 (ADR 0007, voir section 11) : chaque porteur fait contrat,
  back, front et tests.

**État au 13/11/2026**

1. Sprints 1 à 6 et sprint fonctionnalités (doc 16, FEAT-00 à FEAT-11) livrés ; **la production est au D2** (release
   Fly v12, 31/10/2026, commit `fa416a9`).
2. **Le D3 n'a jamais été déployé** : `main` contient du code qui n'a jamais tourné en prod (section 3).
3. L'app n'est **publiée sur aucun store** : TestFlight (Ozias seul testeur) et piste de test interne Play.
4. Trois PR en suspens à fusionner : #54, #51, #53 (section 4).
5. Le lot 3 du doc 17, la publication et la V2 ne seront **pas** faits (section 6).

---

## 2. Ce qui est livré

### Sprints 1 à 6 (source : `docs/CLAUDE.md`, tableau Avancement)

| Sprint     | Module                                      | Statut |
| ---------- | ------------------------------------------- | ------ |
| Sprint 1   | Auth + Users + Profil                       | Fait   |
| Sprint 2   | Borrowers (contacts)                        | Fait   |
| Sprint 3   | Items + Photos                              | Fait   |
| Sprint 4   | Loans                                       | Fait   |
| Sprint 4.6 | Invitations de contact                      | Fait   |
| Sprint 5   | Docker dev + validation J+2 + Notifications | Fait   |
| Sprint 6   | Dashboard + Historique                      | Fait (historique ; dashboard dédié non fait) |

### Sprint fonctionnalités (doc 16) : FEAT-00 à FEAT-11, en prod au D2

R2 (FEAT-01), durcissement prod (02), distribution iOS (03) et Android (05), statistiques de retard (04), rappels dans
la timeline (06), historique (07), documentation (08), seuils de couverture (09), passage automatique en retard (10),
rappels annulés ou replanifiés (11). PR #30 et #31. Détail et statuts : doc 16.

### Correctifs du doc 17

Numéros de PR vérifiés avec `gh`. Release D2 : #32 (#30 + #31) ; build 5 : #50 (commit `fa416a9`) ; roadmap doc 17 :
#33. **PR fusionnées après `fa416a9` (donc jamais en prod)** : #37, #38, #39, #40, #41, #42, #43, #44, #45, #46,
#47, #48, #49, #52.

| Lot | Fiche  | Sujet                                          | PR                                                     | En prod ? |
| --- | ------ | ---------------------------------------------- | ------------------------------------------------------ | --------- |
| 1   | FIX-18 | Fenêtres avec champ de texte, clavier (iPhone) | #34                                                    | Oui (D2)  |
| 1   | FIX-19 | Champ multiligne, clavier (Android)           | #35                                                    | Oui (D2)  |
| 1   | FIX-20 | Photos HEIC de l'iPhone                        | #36                                                    | Oui (D2)  |
| 1   | FIX-21 | Photos dans le détail du prêt, plein écran     | #41                                                    | Non (D3)  |
| 2   | FIX-22 | Suppression de compte (pseudonymisation)       | contrat #43 (fusionnée), code #54 (ouverte, fusion décidée) | Non  |
| 2   | FIX-23 | Désinscription du téléphone à la déconnexion   | #37                                                    | Non (D3)  |
| 2   | FIX-24 | Statistiques privées du prêteur                | contrat #40, code #42                                  | Non (D3)  |
| 2   | FIX-25 | Date de retour minimale en UTC                 | #38 (+ correctif d'affichage `parseIsoDate`)           | Non (D3)  |
| 2   | FIX-26 | Limites d'envoi de fichiers, codes d'erreur    | #44, contrat #48                                       | Non (D3)  |
| 2   | FIX-27 | Notifications d'invitation de contact          | #45 (+ colonne `actorUserId`), contrat #40             | Non (D3)  |
| 2   | FIX-28 | 404 au lieu de 403 pour les tiers              | #49, contrat #40                                       | Non (D3)  |
| 2   | FIX-29 | Avertissement `path-to-regexp`                 | #46                                                    | Non (D3)  |
| 2   | FIX-30 | Périmètre de `prettier --check`                | #39                                                    | Non (D3)  |
| 2   | FIX-31 | Secret `JWT_REFRESH_SECRET` inutilisé          | #47                                                    | Non (D3)  |
| 2   | FIX-37 | Limite de débit par IP client derrière Fly     | #52                                                    | Non (D3)  |

> Les statuts de la colonne « Statut » du doc 17 sont tous restés à ☐ : la colonne ci-dessus fait foi (voir
> section 11).

### Tests (ordres de grandeur, comptage des fichiers du dépôt, suites non lancées)

- Backend : environ **50 fichiers `*.spec.ts`** (`backend/src`) et **5 fichiers e2e** (`backend/test/*.e2e-spec.ts`).
- Frontend : environ **65 fichiers `*.test.ts(x)`** (`frontend/src`).
- Seuils de couverture en place (FEAT-09) ; la CI lance `--coverage` côté back et `test:coverage` côté front.

---

## 3. État de la production

| Élément                  | Valeur                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| API                      | `https://return-api.fly.dev`, release Fly **v12** du 31/10/2026, commit **`fa416a9`** (D2)        |
| Version en prod          | **D2**. **Le D3 n'a jamais été déployé.**                                                         |
| Tags prévus              | `prod-v12` sur `fa416a9` ; `cloture` sur le `main` final [À mettre à jour après pose]            |
| Android                  | `versionCode` **4** (build 5), piste de test interne Play, 31/10/2026                            |
| iOS                      | `buildNumber` **5**, TestFlight, 31/10/2026, **expire vers fin janvier 2027**                     |
| Build installés          | **Sans FIX-27 côté app** (fusionné après le build 5) : les builds ignorent les nouveaux types de notification |

### Ce que `main` contient et que la prod n'a jamais eu (le « D3 »)

FIX-21, 23, 24, 25, 26, 27, 28, 29, 30, 31, 37, et FIX-22 une fois #54 fusionnée. À recouper avec
`git log fa416a9..main` et `gh pr list --state merged`.

- **Migrations Prisma à appliquer** (le `release_command` de `fly.toml` lance `prisma migrate deploy`) :
  1. `20261031120000_add_contact_invitation_notification_types` (enum `NotificationType`, FIX-27) ;
  2. `20261031130000_add_notification_actor_user_id` (`notifications.actor_user_id`, FIX-27) ;
  3. `users.deleted_at` (FIX-22) : **arrive avec #54** ; elle n'est pas encore dans `main` au 13/11.
- **Secrets Fly** : `JWT_REFRESH_SECRET` n'apparaît plus dans `fly secrets list` (vérifié par Ozias le 13/11/2026,
  FIX-31) ; `OVERDUE_JOB_ENABLED` présent.
- **Variables dans `backend/fly.toml`** (pas des secrets) : `CLIENT_IP_HEADER = 'fly-client-ip'`,
  `TRUST_PROXY_HOPS = '2'` (FIX-37). **L'API refuse de démarrer en production sans `CLIENT_IP_HEADER`**
  (`backend/src/config/env.validation.ts`). Idem sans les cinq variables `R2_*` (ADR 0008).
- **Machine** : 1 machine toujours allumée (`min_machines_running = 1`), car les CRON tournent dans le processus :
  ne jamais passer à 0 ni à plusieurs machines (section 12).

---

## 4. En suspens au moment de la clôture

| PR  | Contenu                                                                                      | Décision du 13/11 | État            |
| --- | -------------------------------------------------------------------------------------------- | ----------------- | --------------- |
| #54 | FIX-22 : code de la suppression de compte (migration `users.deleted_at`, ADR 0010)           | Fusion            | [À mettre à jour après fusion] |
| #51 | Statuts du doc 17 et fiches du lot 3                                                         | Fusion            | [À mettre à jour après fusion] |
| #53 | Politique de confidentialité (`/privacy`) et liens dans l'app                                | Fusion, avec marqueurs | [À mettre à jour après fusion] |

> **#53 : les marqueurs `[Nom du responsable]` et `[Adresse postale]` de la politique de confidentialité sont
> obligatoires à remplir avant toute publication.** Ils sont fusionnés tels quels : la page n'est publiable qu'après
> remplissage (et après un déploiement du backend, qui sert `/privacy`).

**Autres points ouverts**

- **Tests Android du build 5** (versionCode 4) : non effectués avant la clôture.
- **Console Play : configuration incomplète (1/11 tâches faites).** Nom temporaire `com.ideogen.returnapp
  (unreviewed)` tant que l'app n'est pas examinée. Fiche Store remplie (nom, descriptions, icône 512, bannière
  1024×500, 6 captures anonymisées). Reste à faire, avec les réponses déjà préparées :

| Tâche Play Console                | Réponse préparée                                                            |
| --------------------------------- | --------------------------------------------------------------------------- |
| URL de la politique de confidentialité | URL `/privacy` de #53 (après remplissage des marqueurs et déploiement) |
| Accès à l'app (compte de test pour la revue) | Un compte de démo à créer [À compléter par Ozias / Ismael]       |
| Publicités                        | **Non** (aucune publicité)                                                  |
| Classification du contenu         | Questionnaire à remplir [à compléter]                                       |
| Public cible                      | **18+**                                                                     |
| Sécurité des données (Data safety) | Aucun partage avec des tiers ; données chiffrées en transit ; suppression possible (dans l'app) |
| Fonctionnalités financières       | **Aucune** (Financial features = aucune)                                    |
| Catégorie de l'app                | À choisir [à compléter]                                                     |
| Autres déclarations (11 au total) | [À compléter : lister celles que la console affiche encore]                 |

---

## 5. Liste de contrôle avant une publication sur les stores

Aucun doc ne suivait cette liste. Rien de ceci n'est fait.

- [ ] **Déployer le D3**, avec sa recette (section 8, étape 3).
- [ ] **Suppression de compte en prod** : #54 fusionnée et déployée (exigence Apple, guideline 5.1.1(v)).
- [ ] **URL `/privacy` en ligne**, avec le responsable du traitement et l'adresse remplis (#53).
- [ ] **Statut DSA « trader » tranché** (section 7).
- [ ] **App Store** : fiche (captures, description, App Privacy) ; compte de démo pour la revue Apple ; au moins un
  testeur autre qu'Ozias.
- [ ] **Play** : Data safety et déclarations (section 4) ; compte de test pour la revue ; **règle des 20 testeurs
  pendant 14 jours** (comptes personnels récents) avant la production ; tests du build.
- [ ] **`frontend/google-services.json`** : commité dans un dépôt public. C'est une configuration client, pas un
  secret, mais **la clé d'API doit être restreinte dans la console Google Cloud**.
- [ ] Nouveau build (Android `versionCode` 5, iOS `buildNumber` 6) depuis le `main` déployé.

---

## 6. Reste-à-faire regroupé

**Lot 3 du doc 17** : les fiches détaillées sont dans la PR #51 (ouverte, pas encore dans `main` au 13/11) ; après
fusion, voir `17_ROADMAP_CORRECTIFS_POST_D2.md`.

| Fiche  | Sujet                                                                                     | Gravité   | Porteur | Effort |
| ------ | ----------------------------------------------------------------------------------------- | --------- | ------- | ------ |
| FIX-32 | Accès aux ressources : une règle partagée, et `deletedAt` oublié à deux endroits          | 🟡 Mineur | Ismael  | M      |
| FIX-33 | Erreurs d'envoi : champ `photo`/`avatar`, taille égale à la limite, messages de l'app (contrat fait, #48) | 🟡 Mineur | Ozias | S |
| FIX-34 | Notifications écrites en français en dur côté serveur                                     | 🟡 Mineur | Ismael  | M      |
| FIX-35 | Réponses de prêt sans `Cache-Control: private` alors qu'elles dépendent du lecteur         | 🟡 Mineur | Ozias   | XS     |
| FIX-36 | Finitions photos (barre d'état, galerie dupliquée, chargement, zoom, PNG sur le web)      | 🟡 Mineur | Ismael  | S      |
| FIX-38 | Aucune notification quand le prêteur change la date de retour                             | 🟠 Majeur | Ismael  | M      |
| FIX-39 | Limites de connexion : par email seul, et compteurs en mémoire                            | 🟡 Mineur | Ozias   | S      |
| FIX-40 | Inscription sans vérification de l'email (prérequis de la connexion Google/Apple)         | 🟠 Majeur | Ozias   | M      |
| FIX-41 | Pierres tombales orphelines après la suppression de l'emprunteur                          | 🟡 Mineur | Ozias   | S      |

Suite non numérotée : test `LoanWizard` « MONEY flow » dépendant du fuseau (mock du calendrier en UTC) : à passer en
date locale et à ajouter à `test:tz`.

**Publication** : section 5.

**V2** (rien n'est planifié) :

- Backlog des docs 06 (plan général) et 16 (section « Post-échéance » : dashboard dédié, filtres d'historique,
  réactivation d'un prêt `NOT_RETURNED`, prolongation d'un prêt en retard, tri et pagination de l'historique).
- Doc 11 : CORR-06 (type MONEY orphelin), CORR-09 (BullMQ / CRON), CORR-12 (DNS `api.return.app`), CORR-14 (dashboard).
- Doc 13 : FIX-16 (temps réel, websockets). Doc 14 : PUSH-B6 (receipts push).
- **Connexion Google et Apple** : décision reportée (section 7).

---

## 7. Décisions reportées

### Connexion Google et Apple

Avis convergents des deux développeurs, **aucun ADR ni code écrits** :

- Garder le mot de passe (comptes existants) ; faire la connexion sociale **après** la sortie publique.
- **FIX-40 (vérification de l'email) d'abord** : elle conditionne la liaison sûre de comptes.
- Identifier par le **`sub` du fournisseur**, pas par l'email (adresses relais d'Apple) : table `AuthIdentity`
  (`provider`, `providerUserId`, `userId`) ; `User.password` devient nullable.
- Liaison automatique **seulement si l'email est vérifié des deux côtés** ; sinon liaison manuelle depuis le Profil,
  après connexion par mot de passe.
- Suppression d'un compte Google ou Apple confirmée par une **reconnexion récente au fournisseur**.
- **Révocation du jeton Apple** à la suppression du compte (App Store 5.1.1(v)).
- Proposer Google sur iOS **impose** Sign in with Apple (guideline 4.8).
- Procédure : **ADR + contrat d'abord** (`docs/openapi.yaml`), puis code.

### Responsable du traitement et statut DSA « trader »

**Non tranchés.** Ils conditionnent le remplissage de la politique de confidentialité (#53) et la publication
(section 5). [À compléter par Ozias]

---

## 8. Reprendre le projet : par où commencer

Dans cet ordre :

1. **Lire** ce document, puis `docs/CLAUDE.md` (conventions, architecture), `17_ROADMAP_CORRECTIFS_POST_D2.md` et
   les ADR (`docs/adr/`).
2. **Recréer l'infrastructure** (section 9) ou réactiver celle qui existe encore.
3. **Déployer le D3** (`cd backend && fly deploy`), puis la recette :
   - `CLIENT_IP_HEADER` présent dans `backend/fly.toml` ;
   - **3 migrations** appliquées (les 2 de FIX-27 + `users.deleted_at` de FIX-22) ;
   - ligne `Overdue tick` dans les logs (`fly logs | grep tick`) ;
   - connexion depuis deux téléphones sur des réseaux différents sans « Too many attempts » (FIX-37) ;
   - invitation de contact puis notification (FIX-27 ; la partie app nécessite un build 6) ;
   - `GET` sur le prêt d'un tiers : **404** (FIX-28) ;
   - suppression de compte avec un compte prêteur de test (FIX-22) ;
   - `JWT_REFRESH_SECRET` absent de `fly secrets list` (FIX-31).
4. **Nouveau build** : Android `versionCode` 5, iOS `buildNumber` 6 (`frontend/app.json`), `eas build` puis `eas submit`
   (profil `production`, `frontend/eas.json`).
5. **Liste de contrôle** de la section 5.
6. **Lot 3** du doc 17.

Commandes de base : `docs/CLAUDE.md` (section Commandes) et `07_GUIDE_LANCEMENT_BACKEND.md`, `FRONTEND.md`.

---

## 9. Infrastructure, comptes et coûts

| Service            | Titulaire / accès                                         | Ressources                                                                                  | Coût                                              |
| ------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Fly.io             | Organisation personnelle d'Ozias ; Ismael ADMIN           | `return-api` (1 machine toujours allumée), `return-db` (volume 1 Go + instantanés), `return-redis` (Upstash, à l'usage) | ~5-6 $/mois [à confirmer par Ozias dans Billing] |
| Apple Developer    | Ozias (Team `WA935JW2DV`)                                 | App Store Connect, app `6828146094`, TestFlight                                              | 99 $/an, renouvellement **fin octobre 2027**      |
| Google Play Console | Ismael                                                   | App `com.ideogen.returnapp`, piste de test interne                                           | 25 $, une fois                                    |
| Expo / EAS         | Ismael, owner `natismael`, projet `595176ea-3595-4aec-8ba5-b56da4f48a67` | Builds, certificats iOS, credentials push                                       | Plan gratuit (Free), confirmé par Ismael                     |
| Firebase           | Ismael                                                    | Projet Firebase (clé de service FCM pour Android)                                            | Plan gratuit (Spark), confirmé par Ismael                   |
| Cloudflare R2      | [À compléter par Ozias]                                   | Bucket des photos                                                                            | [à confirmer], gratuit sous 10 Go                 |
| GitHub             | `Ideogenium/Return`                                       | Dépôt public, CI                                                                             | Gratuit                                           |

### Recréer l'infrastructure à partir de zéro

Squelette ; les procédures détaillées sont dans les docs 07 (lancement backend), 08 et 09 (Fly), 10 (R2), 14 (push) et
15 (comptes et distribution). Les valeurs ne sont **jamais** écrites dans le dépôt.

1. **Fly** : `fly apps create return-api --org personal` ; PostgreSQL `return-db` (région `cdg`, volume 1 Go) rattaché
   avec `fly postgres attach` (pose `DATABASE_URL`) ; Redis `return-redis` chez Upstash via Fly (pose `REDIS_URL`).
   **[À compléter par Ozias : commandes exactes réellement utilisées, plan Postgres.]**
2. **Secrets Fly** (`fly secrets set … -a return-api`, **avant** le premier déploiement) : variables de
   `backend/src/config/env.validation.ts`, modèle dans `backend/.env.example` :
   - obligatoires : `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET` ;
   - R2, **obligatoires en production** (ADR 0008) : `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
     `R2_BUCKET_NAME`, `R2_PUBLIC_URL` (URL https publique du bucket) ;
   - optionnelles : `EXPO_ACCESS_TOKEN`, `OVERDUE_JOB_ENABLED` (exactement `true` pour l'activer),
     `OVERDUE_JOB_BATCH_SIZE`, `OVERDUE_JOB_MAX_SHARE`, `JWT_ACCESS_EXPIRATION`, `JWT_REFRESH_EXPIRATION` ;
   - déjà dans `fly.toml` (pas des secrets) : `NODE_ENV`, `PORT`, `API_PREFIX`, `LOG_LEVEL`, `CORS_ORIGIN`,
     `CLIENT_IP_HEADER`, `TRUST_PROXY_HOPS`.
3. **R2** : bucket + jeton d'API restreint au bucket + URL publique, puis les cinq `R2_*`.
   **[À compléter par Ozias : nom du bucket, domaine public, détails du jeton.]**
4. **Déploiement** : `cd backend && fly deploy` (applique les migrations via `release_command`), puis
   `GET https://return-api.fly.dev/health`.
5. **EAS** : `eas build --platform android|ios --profile production`, `eas submit --profile production --platform
   android|ios`. Credentials : certificat et profil iOS, clé APNs, clé de service FCM (`eas credentials`), clé API App
   Store Connect ; clé de service Play dans `frontend/google-play-service-account.json` (gitignorée, **locale** :
   à recréer, `eas.json` la référence).
6. **Comptes de test** : en créer pour les revues Apple et Google (section 5).

---

## 10. Plan d'arrêt de l'infrastructure

À lancer **après la fusion de ce document**, **une action à la fois**, en cochant. Données de la base fictives : pas
d'export.

| #  | Action                                                                                          | Qui    | Fait |
| -- | ----------------------------------------------------------------------------------------------- | ------ | ---- |
| 1  | Poser les tags : `prod-v12` sur `fa416a9`, `cloture` sur le `main` final                          | Ismael | ☐    |
| 2  | Fly : supprimer l'API `return-api` (arrête les CRON)                                              | Ozias  | ☐    |
| 3  | Fly : supprimer `return-redis` (Upstash)                                                          | Ozias  | ☐    |
| 4  | Fly : supprimer la base `return-db` (et ses instantanés)                                          | Ozias  | ☐    |
| 5  | R2 : vider puis supprimer le bucket ; révoquer le jeton d'API R2                                  | Ozias  | ☐    |
| 6  | Révoquer la clé d'API App Store Connect                                                           | Ozias  | ☐    |
| 7  | Révoquer le jeton Expo de production (`EXPO_ACCESS_TOKEN`)                                        | Ozias  | ☐    |
| 8  | Révoquer la clé de service Play (`google-play-service-account.json`, locale) et supprimer le fichier | Ismael | ☐    |
| 9  | Révoquer la clé de service FCM (Firebase)                                                         | Ismael | ☐    |
| 10 | Apple : couper le renouvellement automatique (échéance fin octobre 2027)                          | Ozias  | ☐    |
| 11 | Supprimer les branches fusionnées et la branche `feature/sprint-5-reminders-notifications` (FCM direct, remplacé par Expo Push, abandonnée) | Ismael | ☐ |
| 12 | **Archiver le dépôt GitHub** (lecture seule, réversible), en dernier                              | Ozias  | ☐    |

**On garde** (gratuit et utile à une reprise) : le compte Fly vide, le projet EAS (certificats iOS), l'app sur la piste
interne Play, le projet Firebase.

---

## 11. Ce qui est faux ou daté dans les anciens docs

Les anciens docs ne sont pas réécrits : ce tableau les corrige.

| Doc | Affirmation fausse ou datée | Réalité |
| --- | --------------------------- | ------- |
| 01 (l.55, 100, 112, 306) | File de jobs **BullMQ** | Jamais implémenté. Les CRON tournent in-process (`@nestjs/schedule`), d'où 1 seule machine (CORR-09). BullMQ absent de `backend/package.json`. |
| 01 (l.59, 66, 131) | Push par **Firebase Cloud Messaging** direct | Expo Push Service (`expo-server-sdk`). FCM ne sert qu'à Android via les credentials EAS. |
| 01 (l.101, 124, 638, 645) | Monitoring **Sentry** | Absent des dépendances. Seuls Winston (logs JSON) et Fly Metrics. |
| 01 (l.134) | Analytics **PostHog** | Absent. |
| 01 (l.226) | OpenAPI auto-généré par **Swagger** | Absent des dépendances. Le contrat est `docs/openapi.yaml`, écrit à la main et lint par Spectral en CI. |
| 01 (l.299-318, 619), 04 (l.757), 08 | PostgreSQL **managé** / free allowance | Fly Postgres non managé (`return-db`, volume 1 Go) : sauvegardes et mises à jour à notre charge (doc 09). |
| 01 | Redis « cache et file de jobs » | Redis ne sert qu'à la blacklist JWT et à l'invalidation des comptes supprimés (clé `user-deleted:<id>`). |
| `README.md` (dernière ligne) | « Projet en phase de spécifications — développement à venir » | Projet développé, en pré-production, clôturé le 13/11/2026. |
| `docs/CLAUDE.md` (l.10, 13) | Phase « pré-production (octobre 2026) », plan en cours = doc 17 | Projet clôturé ; prod au D2, D3 non déployé ; reprise : ce document. |
| 08 (PREPROD-006) | Secrets dont `JWT_REFRESH_SECRET`, `CORS_ORIGIN=*` | `JWT_REFRESH_SECRET` inutilisé (FIX-31) ; CORS strict en production (ADR 0009). |
| 08, 09, 10 | Cases ☐ « après D2 » ou statuts de déploiement | Le D2 est en prod depuis le 31/10 ; statuts non remis à jour. |
| 10, 11 (l.65), 13 (l.96) | `UPLOAD_BASE_URL`, scheduler externe `/v1/cron/tick` comme pistes | Abandonnées : R2 (FEAT-01) et CRON in-process. |
| 11, 12, 13, 14, 16 | Nombreux ☐ (14 dans le doc 13, 6 dans le doc 11, 3 dans le doc 16, etc.) | Beaucoup de lignes sont faites ; les statuts n'ont pas suivi. Se fier au code et au doc 17. |
| 16 (l.642) | Notifications d'invitation : « 3 valeurs `NotificationType` », refus notifié | Décision finale du doc 17 : **2** types (`CONTACT_INVITATION_RECEIVED`, `…_ACCEPTED`), ni refus ni expiration. |
| 16 (en-tête) | `fix/preprod-corrections` base de travail | Abandonné : depuis le doc 17, une branche par fiche depuis `main`. |
| 15 (ACC-A1) | Apple ID « dédié Ideogen » | Apple ID personnel d'Ozias (précisé dans le même doc, FEAT-03). |
| 17 | Colonne « Statut » : tout à ☐ ; build « 5 » et « main (`3564e29`) » | Plusieurs fiches fusionnées ; build 5 livré le 31/10. Corrigé dans #51. |
| 00 à 06 | Planning et statuts d'origine | Historique ; pour l'état réel, voir sections 2 à 4. |
| `docs/openapi.yaml` | — | Reste la référence du contrat. |
| ADR 0007 | Citée par les docs 16 et 17 (« organisation par fonctionnalité ») | **Le fichier n'existe pas** dans `docs/adr/` (0008 à 0010 seulement). [Ozias l'ajoute.] |

Nom trompeur : `backend/src/firebase/` (importé par `app.module.ts`) n'est pas du code mort. `FirebaseService`
envoie les push via `expo-server-sdk` (Expo Push Service) ; seul le nom est resté (dette mineure : renommer le module,
section 12).

---

## 12. Dette connue et pièges

- **La CI ne lance aucun test e2e** : `.github/workflows/ci.yml` exécute lint, `npm run test -- --coverage`, build,
  Docker, Spectral ; `frontend-ci.yml` : typecheck, lint, Prettier, Jest `test:coverage`, `test:tz`. Les 5 fichiers
  `backend/test/*.e2e-spec.ts` ne tournent qu'à la main.
- **`/health` e2e échoue en local** sans Redis ni `JWT_ACCESS_SECRET`.
- **CRLF** : certains docs sont en fins de ligne Windows (00, 01, 02, 04, 05, 06, `CLAUDE.md`, `FRONTEND.md`,
  `API_*`). Les modifier **en place** (pas de réécriture complète) pour garder des diffs lisibles. Les docs 07 à 18
  sont en LF.
- **WSL** : travailler sous `~/workspace/...` (système de fichiers Linux, hot reload) ; `/mnt/c/...` n'a pas
  d'inotify.
- **Notifications** : textes en français codés en dur côté serveur (pas d'i18n serveur malgré l'i18n de l'app).
- **Rate limit en mémoire**, par machine, remis à zéro à chaque redémarrage : une seule machine tant que le throttler
  n'est pas passé sur Redis (suivi de FIX-37).
- **CRON in-process** : `min_machines_running = 1` et une seule machine, sinon rappels absents ou dupliqués (CORR-01,
  CORR-09).
- **Test `LoanWizard` « MONEY flow »** dépendant du fuseau horaire.
- **`frontend/google-services.json`** public dans le dépôt : clé à restreindre (section 5).
- **ADR 0007** jamais commitée [Ozias l'ajoute].
- **Module `backend/src/firebase/`** : porte l'envoi Expo Push malgré son nom ; renommer le module (dette mineure).
- **Réinscription après suppression de compte** : `BorrowerLinkingListener` relie les anciens contacts au nouveau
  compte (accepté, ADR 0010).
- **`NOT_RETURNED` est irréversible** : le job de retard (FEAT-10) a un disjoncteur ; déployer coupé, compter, puis
  activer (`backend/.env.example`).

---

## Documents de référence

`00_BIBLE_PROJET.md` (vision) · `01_ARCHITECTURE_TECHNIQUE.md` (partiellement daté, section 11) ·
`07_GUIDE_LANCEMENT_BACKEND.md` · `08`, `09` (Fly) · `10` (R2) · `14` (push Expo) · `15` (comptes et distribution) ·
`16_ROADMAP_FEATURES.md` · `17_ROADMAP_CORRECTIFS_POST_D2.md` · `docs/adr/` (0008 à 0010) · `openapi.yaml`.
