# 16_ROADMAP_FEATURES.md

**Return ↺ — Roadmap de fin de phase pré-production · Organisation par fonctionnalité**

> **Date** : 25 octobre 2026
> **Échéance** : **jeudi 29 octobre 2026, au soir** — fenêtre de travail : lundi 26 → jeudi 29 (4 jours)
> **Phase** : Pré-production — backend déployé sur Fly.io (`return-api.fly.dev`), frontend branché dessus
> **Équipe** : Ismael + Ozias, **capacité égale** (≈ 6 h productives / jour / personne → 24 h chacun, 48 h au total)
> **Référence** : `11_CORRECTIFS_PREPROD.md`, `13_ROADMAP_CORRECTIFS_TESTS.md`, `14_ROADMAP_PUSH_EXPO.md`,
> `15_SETUP_COMPTES_DISTRIBUTION.md`, `10_ROADMAP_CLOUDFLARE_R2.md` (recette R2 détaillée)
> **Nature des estimations** : chiffrage **macro** (heures, un chiffre = temps de travail effectif hors attentes
> de build/validation externe). Chaque porteur affine à l'ouverture de sa feature. Le projet est à l'arrêt depuis le
> 26/06/2026 : prévoir un temps de remise en route (install, `.env`, accès EAS/Fly) — inclus dans le buffer.

---

### Changement d'organisation (décision équipe du 25/10/2026)

Les docs 11 à 15 utilisent le découpage **Front = Ismael / Back = Ozias**. **Il est abandonné.**

Ismael et Ozias travaillent désormais **par fonctionnalité** : chacun porte sa feature **de bout en bout** — backend +
frontend + tests + intégration + mise à jour de la doc. Conséquences :

- Les colonnes « Périmètre : Front/Back » des docs 11-15 restent valables comme **historique** ; pour tout ce qui reste
  à faire, le porteur est celui indiqué dans ce document (doc 16 fait foi).
- Un seul **déployeur Fly** (Ozias) pour éviter les `fly deploy` concurrents. Chacun **code le back de ses propres
  features** (Ismael : FEAT-10) ; seul le `fly deploy` est centralisé, sur des **créneaux fixes** (cf. « Indépendance
  des tâches »), jamais à la demande.
- Le contrat API ne change que pour FEAT-04 (`overdueLoans`, champ additif) — porté par une seule personne. FEAT-10 et
  FEAT-11 ne changent aucun contrat HTTP (comportement back + événements internes).
- Exception imposée : **toute la distribution iOS = Ozias** (compte Apple Developer).

**Définition de « fini »** (identique pour toutes les features) : back + front concernés livrés · tests verts
(`npm run lint` + `typecheck` + `jest` front ET back) · intégré sur la branche cible · statuts de la doc mis à jour.

---

### Légende

| Priorité (MoSCoW) | Sens                                                         |
|-------------------|--------------------------------------------------------------|
| **Must**          | Bloquant prod / imposé — doit être fini jeudi                |
| **Should**        | Valeur utilisateur — visé jeudi, coupable en dernier recours |
| **Could**         | Confort — fait uniquement s'il reste du temps                |
| **Won't (now)**   | Sorti explicitement après l'échéance                         |

---

## Tableau récapitulatif

| ID      | Titre                                                            | Porteur                             | Priorité | Estim.             | Dépend de                          | Réfs                                   | Statut |
|---------|------------------------------------------------------------------|-------------------------------------|----------|--------------------|------------------------------------|----------------------------------------|--------|
| FEAT-00 | Merge `fix/preprod-corrections` → `main` + stratégie de branches | Ismael (PR) + Ozias (revue)         | Must     | 1 h (0,5 h chacun) | jalon de fin (gel + recette)       | —                                      | ☐      |
| FEAT-01 | Photos persistantes : `R2PhotoStorageService`                    | Ozias                               | Must     | 4,5 h              | —                                  | CORR-02, FIX-01/02                     | ☐      |
| FEAT-02 | Durcissement prod (CORS, secrets, 1 seule machine, Expo token)   | Ozias                               | Must     | 2 h                | —                                  | CORR-05, PUSH-B5, CORR-01              | ☐      |
| FEAT-03 | Distribution iOS (EAS prod iOS, APNs, TestFlight, push e2e iOS)  | Ozias                               | Must     | 7 h                | accès EAS (ACC-A1 ✅)              | PUSH-P1, PUSH-F5, ACC-A2/A3, ACC-E1→E5 | ☐      |
| FEAT-04 | Stats prêts en retard : `overdueLoans` back + carte front        | Ozias                               | Should   | 1,5 h              | —                                  | FIX-14 (reste)                         | ☐      |
| FEAT-05 | Distribution Android (Play internal via `eas submit`)            | Ismael                              | Must     | 3 h                | Play Console OK (fait)             | PUSH-P2, ACC-G*, ACC-E3/E4             | ☐      |
| FEAT-06 | Rappels visibles dans la timeline du prêt                        | Ismael                              | Should   | 3,5 h              | —                                  | CORR-07                                | ☐      |
| FEAT-07 | Historique des prêts (écran dédié, périmètre réduit)             | Ismael                              | Should   | 8 h                | —                                  | CORR-14 (partiel), CORR-08             | ☐      |
| FEAT-08 | Mise à jour de la documentation                                  | Ismael (porteur) + Ozias (sous-lot) | Must     | 4,5 h (2,5 + 2)    | features terminées (en continu)    | CORR-11, doc 12 §A                     | ☐      |
| FEAT-09 | Seuils de couverture (`coverageThreshold` front + back)          | Ismael (front) + Ozias (back)       | Could    | 2 h (1 + 1)        | —                                  | CORR-10                                | ☐      |
| FEAT-10 | Passage automatique en retard (AWAITING_RETURN) puis non rendu   | Ismael                              | Must     | 3,5 h (3-4 h)      | — (contrat : événement `STATUS_CHANGED`) | LOAN-017 (doc 04), doc 13:209-212, openapi.yaml:638-639 | ☐ |
| FEAT-11 | Rappels annulés / replanifiés selon le cycle de vie du prêt      | Ozias                               | Must     | 1,5 h (1-2 h)      | — (contrat : événement `STATUS_CHANGED`) | `reminders.service.ts:107-112`, `loans.service.ts:283-300` | ☐ |

> FEAT-10 et FEAT-11 (validées par Ismael le 25/10) sont des **Must placées au-dessus de FEAT-04** : elles touchent
> le cœur de l'app (relances et statut des prêts). Aujourd'hui, `NOT_RETURNED` est inatteignable et des relances
> partent encore après un retour.

**Charge** : Ozias = 4,5 + 2 + 7 + 1,5 + **1,5 (FEAT-11)** + 2 (doc) + 1 (cov.) + 0,5 (merge) = **20 h** · Ismael =
3 + 3,5 + 8 + **3,5 (FEAT-10)** + 2,5 (doc) + 1 (cov.) + 0,5 (merge) = **22 h**.

### Check de capacité

| Personne | Capacité brute (4 j × 6 h) | Planifié (tout) | Planifié sans Could | Buffer restant        |
|----------|----------------------------|-----------------|---------------------|-----------------------|
| Ismael   | 24 h                       | 22 h            | 21 h                | 2 à 3 h (≈ 10 %) — **serré** |
| Ozias    | 24 h                       | 20 h            | 19 h                | 4 à 5 h (≈ 18 %)     |

Le buffer couvre : remise en route après 4 mois d'arrêt, temps de build EAS, aléas Apple/Cloudflare, bugs de
régression. **Le plan tient sur le papier mais la marge d'Ismael est faible** : c'est lui qui porte FEAT-07 (8 h,
la plus incertaine) — d'où le repli « liste simple » en premier dans l'ordre de coupe. Le chemin iOS dépend de
délais externes (cf. risques).

**Ordre de coupe si ça dérape** (de la première à sacrifier à la dernière) : **FEAT-07 passe d'abord en version liste
simple** (−2 h) → FEAT-09 → FEAT-07 supprimée de la semaine → FEAT-06 → FEAT-04. Les **Must** (dont FEAT-10 et
FEAT-11) ne se coupent pas ; s'ils glissent, on le signale dès mercredi midi. Si la marge d'Ismael fond, Ozias
(marge plus large) reprend en priorité FEAT-09 front puis FEAT-06 (aucune dépendance, cf. section Indépendance).

---

## Stratégie de branches et merge

### Décision (25/10/2026) : `fix/preprod-corrections` reste la base de travail ; merge vers `main` **À LA FIN**

Chaque branche de feature est créée **depuis `fix/preprod-corrections`** et mergée **dans** `fix/preprod-corrections`.
Un **seul merge final** `fix/preprod-corrections` → `main` (FEAT-00), jeudi, après le gel du code et la recette.

Justification :

- Branche déjà partagée par les deux et à jour : aucune remise en route nécessaire.
- On évite de bloquer lundi matin sur la revue d'une PR de 41 commits avant de pouvoir démarrer les features.
- Un seul merge final vers `main` : `main` ne reçoit qu'un état recetté, un seul point de revue/CI.

**Plan** : PR `fix/preprod-corrections` → `main` préparée **manuellement** par Ismael (titre + description, pas de
création automatique) jeudi après la recette, revue croisée par Ozias, CI verte exigée, merge jeudi soir.

### Branches

Base de toutes les branches ci-dessous : **`fix/preprod-corrections`** (PR de feature → `fix/preprod-corrections`).

| Branche                           | Porteur        | Contenu |
|-----------------------------------|----------------|---------|
| `feature/photos-r2`               | Ozias          | FEAT-01 |
| `chore/prod-hardening`            | Ozias          | FEAT-02 |
| `feature/ios-distribution`        | Ozias          | FEAT-03 |
| `feature/overdue-loans-stats`     | Ozias          | FEAT-04 |
| `feature/android-distribution`    | Ismael         | FEAT-05 |
| `feature/loan-reminders-timeline` | Ismael         | FEAT-06 |
| `feature/loan-history`            | Ismael         | FEAT-07 |
| `feature/loan-overdue-transition` | Ismael         | FEAT-10 |
| `feature/reminders-lifecycle`     | Ozias          | FEAT-11 |
| `docs/roadmap-resync`             | Ismael + Ozias | FEAT-08 |
| `chore/coverage-thresholds`       | Ismael + Ozias | FEAT-09 |

Règles : une branche = une feature, depuis `fix/preprod-corrections`, PR courtes vers cette même branche, merge dès que CI verte + revue croisée (1 approval).
Merge fréquent pour limiter les conflits ; commits conventionnels, une phrase, sans Co-Authored-By. **Zones de
conflit connues** : `docs/*` (rows de tableau distincts → ok, chacun ne coche que ses lignes), `frontend/eas.json`
(JSON à blocs séparés : **Ismael ne touche que les blocs `android`**, **Ozias que les blocs `ios`** — aucune
demande à faire à l'autre, conflit de merge trivial), `frontend/src/types/api.types.ts` (FEAT-04 et FEAT-07 ajoutent
chacun leurs champs sans modifier ceux de l'autre), `ProfileScreen`/`LenderStats`
(FEAT-04 touche `LenderStats.tsx`, FEAT-07 ajoute seulement un point d'entrée dans `ProfileScreen` : fichiers
distincts).

---

## Features — fiches

### FEAT-00 — Merge `fix/preprod-corrections` → `main`

- **Porteur** : Ismael (prépare la PR) · Ozias (revue) · **Priorité** : Must · **Estim.** : 0,5 h chacun
- **Périmètre** : Back + Front + docs — aucune modification de code, uniquement la PR.
- **Dépendances** : **jalon de fin** — toutes les features mergées dans `fix/preprod-corrections`, gel du code (S6,
  jeudi 16h) et recette terminée. Ne bloque aucune feature.
- **Description** : sur `fix/preprod-corrections` finale, vérifier `npm run lint`, `typecheck`, `jest` (front, back +
  e2e) ; rédiger titre + description de PR (regroupée par sujet : push Expo, correctifs terrain FIX-xx, stats/trustScore,
  branding, features de la semaine), la créer **à la main**, revue croisée, merge.
- **Critères d'acceptation** :
    - [ ] Gel du code effectué et recette Android + iOS faite
    - [ ] CI verte sur la PR (lint + typecheck + tests front et back)
    - [ ] PR `fix/preprod-corrections` → `main` mergée (pas de squash : on garde les commits conventionnels)
    - [ ] Smoke test manuel après merge : login, création prêt, notification reçue

---

### FEAT-01 — Photos persistantes (R2) — CORR-02 / FIX-01 / FIX-02

- **Porteur** : Ozias · **Priorité** : Must (**bloquant prod** : photos perdues à chaque redeploy) · **Estim.** : 4,5 h
- **Dépendances** : bucket Cloudflare R2 + token API (à créer par Ozias lundi matin, ~30 min) .
- **Périmètre**
    - **Back** : `@aws-sdk/client-s3` ; `backend/src/storage/r2-photo-storage.service.ts` implémentant l'interface
      `PhotoStorage` ; bascule `useClass` dans `photo-storage.module.ts:11,19` pilotée par variable d'env
      (R2 si `R2_*` renseignées, local sinon → dev inchangé) ; validation env (`env.validation.ts`) ; `useStaticAssets`
      (`main.ts:45`) conservé en dev uniquement ; secrets Fly ; `fly deploy`. Recette détaillée :
      `10_ROADMAP_CLOUDFLARE_R2.md`.
    - **Front** : vérification seule (URLs absolues déjà consommées telles quelles — FIX-01/02 front ✅). Smoke test
      photo objet + avatar sur l'app.
    - **Tests** : spec unitaire `R2PhotoStorageService` (client S3 mocké : upload, delete, URL publique) ; specs
      existantes
      du module vertes.
- **Critères d'acceptation**
    - [ ] Upload photo objet et avatar OK sur `return-api.fly.dev`, URL publique R2 renvoyée — après le déploiement D2
    - [ ] Une photo uploadée **survit à un `fly deploy`** (preuve : redeploy puis GET de l'URL) — après D2
    - [x] Suppression d'une photo supprime l'objet R2 (test réel sur `return-photos-preprod` le 26/10 : 404 après
      suppression)
    - [x] Dev local (sans variables R2) fonctionne toujours avec le stockage local (`/uploads` vérifié en 200)
    - [x] Tests back verts, lint + typecheck OK
    - [ ] Doc : FIX-01/02 → ✅ (doc 13), CORR-02 → ✅ (doc 11), secrets R2 documentés (doc 10) — doc 10 à jour,
      FIX-01/02 et CORR-02 « code livré », passeront ✅ après la recette D2

---

### FEAT-02 — Durcissement prod

- **Porteur** : Ozias · **Priorité** : Must · **Estim.** : 2 h
- **Dépendances** : aucune (à faire dans le même `fly deploy` que FEAT-01 quand c'est possible).
- **Périmètre** (principalement Back / ops ; aucun changement front)
    - `CORS_ORIGIN` : défaut localhost (`main.ts:52-55`), absent de `fly.toml` → définir explicitement (origine web
      réelle, ou valeur restrictive ; l'app native n'est pas soumise au CORS) et documenter.
    - **CRON in-process, risque de double exécution** : `min_machines_running = 1` est fait (CORR-01) mais le nombre
      de machines n'est pas plafonné → vérifier `fly status`, `fly scale count 1`, et noter dans la doc « ne jamais
      passer à >1 machine tant que les CRON ne sont pas migrés (CORR-09) ».
    - **PUSH-B5** : `fly secrets set EXPO_ACCESS_TOKEN=…`, `fly secrets unset` des secrets Firebase obsolètes
      (vérifier via `fly secrets list`, noms uniquement).
    - **CORR-05** : audit des secrets requis (`JWT_*`, `DATABASE_URL`, `REDIS_URL`, `R2_*`, `EXPO_ACCESS_TOKEN`…) vs
      `env.validation.ts` ; l'app démarre en prod avec validation stricte.
    - Vérifier dans `fly logs` que les **4 CRON** s'exécutent, y compris `handleOverdueLoans` (FEAT-10). Garder
      l'attention sur la double exécution si plus d'une machine tourne.
- **Critères d'acceptation**
    - [ ] `fly secrets list` : `EXPO_ACCESS_TOKEN` présent, secrets Firebase absents — Firebase absent ✅ (31/10),
      `EXPO_ACCESS_TOKEN` stagé, effectif au déploiement D2
    - [ ] `CORS_ORIGIN` explicite en prod (fly.toml ou secret), plus de défaut localhost en prod — `fly.toml` +
      validation stricte livrés (ADR 0009), effectifs au déploiement D2
    - [x] Exactement 1 machine Fly en service, confirmé (`fly machines list` le 31/10 : 1 machine) ; règle « jamais
      plus d'1 machine tant que CORR-09 n'est pas fait » écrite dans le doc 08 § « Exploitation Fly »
    - [ ] Logs montrant au moins un tick de chacun des **4 CRON**, y compris `handleOverdueLoans` (vérifié après le
      déploiement D1 de mardi 17h ; si FEAT-10 n'est pas encore déployée, les 3 autres sont validés et le 4e est
      revérifié après D2 — FEAT-02 ne bloque pas sur FEAT-10)
    - [ ] Doc : PUSH-B5 → ✅ (doc 14), CORR-05 → ✅ (doc 11), tableau secrets à jour

---

### FEAT-03 — Distribution iOS (imposé Ozias)

- **Porteur** : Ozias · **Priorité** : Must · **Estim.** : 7 h (dont ~2 h d'attentes Apple/EAS hors estimation)
- **Dépendances** : **ACC-A1 compte Apple Developer : ✅ ACTIF** (créé par Ozias, confirmé le 25/10) — il reste à
  « brancher l'app au compte » (bundle ID, fiche App Store Connect, clé APNs → EAS) ; **accès EAS** : Ozias doit être
  invité au projet/compte EAS (owner `natismael` = Ismael, confirmé ; **invitation faite par Ismael dès le dimanche
  25/10**, donc Ozias n'attend rien lundi matin).
- **Périmètre**
    - **Ops/Credentials** : brancher l'app au compte Apple — identifiant de bundle `com.ideogen.returnapp` enregistré,
      fiche app créée dans App Store Connect, clé APNs `.p8` créée et uploadée dans EAS (ACC-A2 / PUSH-P1) ;
      sauvegarde sécurisée (téléchargeable une seule fois).
    - **Front/config** : `frontend/eas.json` — profil `production` iOS (distribution store) + bloc
      `submit.production.ios`
      (`ascAppId`, `appleTeamId`) — absents aujourd'hui (ACC-E1) ; bundle ID `com.ideogen.returnapp` ; vérifier
      `app.json` (`ios.bundleIdentifier`, entitlements push, `buildNumber`).
    - **Build/Submit** : `eas build --platform ios --profile production`, `eas submit --platform ios`, TestFlight
      testeurs internes (ACC-A3, ACC-E3/E4).
    - **Test** : PUSH-F5 / ACC-E5 — push reçu sur un iPhone physique en standalone (token enregistré en base, push
      par event de prêt, tap → `LoanDetailScreen`).
    - **Tests auto** : aucun nouveau (config) ; suite front/back inchangée verte.
- **Critères d'acceptation**
    - [x] Compte Apple Developer actif (ACC-A1)
    - [x] Bundle ID + fiche App Store Connect en place ; clé APNs référencée dans EAS (générée par EAS)
    - [x] Profil `production` iOS + `submit` iOS présents dans `eas.json`
    - [x] Build iOS terminé sans erreur, soumis, visible dans TestFlight (1.0.0 (1), (2), (3))
    - [ ] Au moins un testeur interne (autre qu'Ozias idéalement) a installé via TestFlight — Ozias a installé ;
      aucun autre membre de l'équipe n'a d'iPhone
    - [x] Push reçu sur iPhone physique + tap ouvre le bon prêt (31/10, build (2) ; retour à la liste corrigé dans la
      PR #30)
    - [x] Doc : PUSH-P1, PUSH-F5, ACC-A1→A3, ACC-E1→E5 cochés (docs 14 et 15) — volet iOS ; volet Android = FEAT-05
- **Risque / repli** : si le premier build / les credentials EAS iOS ne passent pas **mardi soir**, si le
  traitement TestFlight traîne **mercredi soir**, ou si aucun **iPhone physique** n'est dispo pour le test push, la
  feature est livrée « prête à soumettre » (config + profil + clé en place) et l'installation TestFlight / le test
  push e2e sortent en post-échéance ; le signaler à l'équipe immédiatement.
  Il faut aussi **un iPhone physique** pour le test push (le simulateur ne reçoit pas les push distants).

---

### FEAT-04 — Stats prêts en retard (`overdueLoans`) — reste de FIX-14

- **Porteur** : Ozias · **Priorité** : Should · **Estim.** : 1,5 h (back 0,75 h + front 0,5 h + tests 0,25 h)
- **Dépendances** : aucune. Déploiement groupé avec FEAT-01/02.
- **Périmètre**
    - **Back** : `HistoryOverview` (`backend/src/history/history.service.ts:26-33`) + `computeOverview` : ajout du
      champ `overdueLoans`. Champ **additif** : pas de rupture de contrat. Mise à jour `openapi.yaml` et
      `HistoryStatistics` (`api.types.ts`). **Définition : validée par Ismael + Ozias le 25/10/2026** :
        - compte les prêts du prêteur **encore ouverts** ayant une `returnDate` renseignée **strictement antérieure à
          aujourd'hui** — comparaison sur la date du jour (`returnDate` est `@db.Date` ; retour le jour J = à l'heure,
          cf. commit `7e1adc3`) ;
        - statuts inclus : `ACTIVE`, `ACTIVE_BY_DEFAULT`, `AWAITING_RETURN` ;
        - statuts exclus : `PENDING_CONFIRMATION` (pas démarré), `CONTESTED` (compteur `contestedLoans`), `RETURNED`,
          `NOT_RETURNED` (clos, compteur `notReturnedLoans`), `ABANDONED` ;
        - prêt sans `returnDate` : jamais en retard ;
        - un prêt en retard **reste compté** dans `activeLoans` (« En cours ») : le recoupement des deux cartes est
          assumé, c'est voulu ;
        - point d'attention : `ACTIVE_STATUSES` dans `history.service.ts` inclut aussi `PENDING_CONFIRMATION`, donc
          `activeLoans` ne couvre pas exactement ACTIVE / ACTIVE_BY_DEFAULT / AWAITING_RETURN (non modifié ici) ;
        - différence avec `notReturnedLoans` : « en retard » = toujours ouvert, récupérable ; « non rendu » = clos
          définitivement.
    - **Front** : `frontend/src/components/profile/LenderStats.tsx:70` — retirer le TODO, afficher la carte (clé i18n
      `profile.overdueLoans` déjà présente) ; handler MSW mis à jour.
    - **Tests** : cas back dans `history.service.spec.ts` (en retard / non en retard / rendu / sans `returnDate` /
      statuts exclus / **cas limite `returnDate` = aujourd'hui → non compté**) ; test composant
      front
      (carte visible, valeur affichée).
- **Critères d'acceptation**
    - [x] `GET /history/statistics` renvoie `overview.overdueLoans` correct (code + tests ; en prod après D2)
    - [x] Carte « en retard » visible dans le profil prêteur, plus de TODO
    - [x] Tests back + front verts, lint + typecheck OK
    - [x] Doc : FIX-14 → entièrement ✅ (doc 13), `openapi.yaml` à jour

---

### FEAT-05 — Distribution Android (Play test interne)

- **Porteur** : Ismael · **Priorité** : Must · **Estim.** : 3 h (hors file de build EAS)
- **Dépendances** : Play Console + FCM EAS **déjà faits**. `eas.json` : profil `production` Android et bloc
  `submit` Android **déjà présents** → en principe aucune édition ; si une modif est nécessaire, Ismael édite
  **uniquement les blocs `android`** de `eas.json` (Ozias édite les blocs `ios`) : aucune demande croisée.
- **Périmètre**
    - **Ops** (PUSH-P2 / ACC-G*) : créer le **2e JSON « Google Play API service account »** (≠ clé FCM) via
      Play Console → Utilisateurs et autorisations / API access, lui accorder les droits de publication ; placer le
      fichier en local à `frontend/google-play-service-account.json` (chemin attendu par `eas.json`), **non commité**
      (vérifier `.gitignore`).
    - **Build/Submit** : `eas build --platform android --profile production` (AAB), `eas submit --platform android`
      (track `internal`) ; liste de testeurs + lien d'opt-in (ACC-G3).
    - Note Google : le **premier** upload d'un AAB doit parfois être fait manuellement dans la console avant que l'API
      accepte `eas submit` — prévoir ce cas.
    - **Test** : installation depuis le Play Store (lien interne), push reçu, login contre l'API prod.
- **Critères d'acceptation**
    - [ ] Service account Play API créé, **fichier non versionné** (`git status` propre)
    - [ ] AAB production construit et soumis sur la piste « Test interne »
    - [ ] App installée depuis le lien Play interne sur au moins un device, push reçu
    - [ ] Doc : PUSH-P2, ACC-G1→G3, ACC-E1/E3/E4 (volet Android) cochés (docs 14, 15)

---

### FEAT-06 — Rappels visibles dans la timeline — CORR-07

- **Porteur** : Ismael · **Priorité** : Should · **Estim.** : 3,5 h
- **Dépendances** : aucune.
- **État vérifié (25/10)** : l'API existe déjà — `GET /v1/loans/:loanId/reminders` (`reminders.controller.ts`) renvoie
  `ReminderResponse { id, loanId, type, status, scheduledFor, sentAt, message?, channel }`. **Accès réservé au prêteur**
  (`assertLoanOwnership`). Politique : PREVENTIVE, ON_DUE_DATE, FIRST_OVERDUE (J+7), SECOND_OVERDUE (J+14),
  FINAL_OVERDUE (J+21) — `reminders/reminder-policy.ts`. Aucun changement back requis.
- **Périmètre**
    - **Front** : store/service pour charger les rappels d'un prêt (prêteur uniquement) ; `LoanTimeline.tsx:127` —
      retirer
      le TODO et insérer les étapes de rappel (envoyé = atteint avec `sentAt`, planifié = non atteint avec
      `scheduledFor`, annulé = ignoré) pour les prêts `ACTIVE` / `AWAITING_RETURN` ; libellés i18n FR/EN ; côté
      emprunteur : timeline inchangée (pas d'appel, pas d'erreur 403 affichée). Corriger au passage le libellé du TODO
      (« J+3 » n'existe pas dans la politique : les étapes sont J, J+7, J+14, J+21).
    - **Tests** : tests de `getTimelineSteps` avec rappels (envoyés / planifiés / aucun), rendu prêteur vs emprunteur,
      handler MSW `GET /loans/:id/reminders`.
- **Critères d'acceptation**
    - [ ] Le prêteur voit les rappels envoyés (date d'envoi) et à venir (date prévue) dans la timeline
    - [ ] L'emprunteur ne déclenche aucun appel reminders ni erreur
    - [ ] Prêt sans rappel / échec réseau : la timeline s'affiche sans les rappels (dégradation silencieuse)
    - [ ] FR + EN, tests front verts, lint + typecheck OK, TODO supprimé
    - [ ] Doc : CORR-07 → ✅ (doc 11)

---

### FEAT-07 — Historique des prêts (périmètre réduit) — CORR-14 partiel / CORR-08

- **Porteur** : Ismael · **Priorité** : Should · **Estim.** : 8 h
- **Dépendances** : aucune (endpoints `/history/*` existent ; `useHistoryStore.ts` ne gère aujourd'hui que
  `/history/statistics`).
- **Décision de périmètre** : le chantier complet « Dashboard + Historique » (2-4 j selon CORR-14) **ne tient pas**
  dans la fenêtre avec le reste. Le périmètre retenu est le plus utile à l'utilisateur :
    - **Dans le périmètre** : un écran **Historique** = liste paginée des prêts archivés (`GET /history/loans`,
      statuts terminaux : RETURNED, NOT_RETURNED, ABANDONED, …) avec filtre par statut (chips), tap →
      `LoanDetailScreen`,
      états vide / chargement / erreur, point d'entrée depuis l'écran Profil, FR + EN.
    - **Hors périmètre (post-échéance)** : Dashboard dédié (graphiques, `byCategory`, `topBorrowers`,
      `mostLoanedItems`), filtres par date et par emprunteur, export. Les stats de base restent visibles dans le profil
      (FIX-14 ✅).
- **Périmètre**
    - **Front** : extension de `useHistoryStore` (`fetchArchivedLoans`, pagination infinie, filtre statut, reset) ;
      types
      `api.types.ts` ; écran `HistoryScreen` + composant item de liste (réutiliser `LoanCard` si adapté) ;
      navigation (`navigation/types.ts`, stack, entrée dans `ProfileScreen`) ; handlers MSW ; i18n.
    - **Back** : aucun changement attendu (si un écart de contrat est découvert, correction minimale **par Ismael**,
      mergée avec tests verts ; mise en prod au créneau de déploiement suivant — Ismael n'attend pas Ozias, il adapte
      d'abord le front au contrat réel et se branche sur l'API une fois déployée).
    - **Tests** : store (pagination, filtre, erreur), écran (rendu liste, vide, filtre, navigation).
- **Critères d'acceptation**
    - [ ] L'écran Historique liste les prêts terminés du prêteur, du plus récent au plus ancien
    - [ ] Filtre par statut fonctionnel, pagination (page suivante au scroll)
    - [ ] Tap sur un prêt ouvre son détail ; retour conserve la liste
    - [ ] États vide / erreur / chargement gérés, FR + EN
    - [ ] Tests front verts, lint + typecheck OK, vérifié sur device contre l'API prod
    - [ ] Doc : CORR-08 → ✅, CORR-14 → « partiel (historique livré, dashboard post-échéance) » (doc 11)
- **Repli** : si retard mercredi midi, livrer la liste sans filtre (−2 h).

---

### FEAT-10 — Passage automatique en retard puis non rendu

- **Porteur** : Ismael (back + tests + e2e ; pas de front) · **Priorité** : Must (**cœur de l'app**) ·
  **Estim.** : 3,5 h (3-4 h)
- **Dépendances** : aucune. **Contrat avec FEAT-11** : l'événement existant `LOAN_EVENTS.STATUS_CHANGED`.
- **Constat vérifié (debugger, recoupé dans le code)** : aucun code n'écrit jamais `AWAITING_RETURN`. La transition
  `ACTIVE` / `ACTIVE_BY_DEFAULT` → `AWAITING_RETURN` est déclarée dans `backend/src/loans/loan-status-machine.ts:28-30,64-65`
  (rôle `system`) mais jamais exécutée. `reminder-exhausted.listener.ts:28` ignore tout prêt hors `AWAITING_RETURN` :
  `NOT_RETURNED` est **inatteignable**, `notReturnedLoans` reste à 0, un prêt jamais rendu reste « en cours » et le
  trustScore n'est jamais pénalisé. Sujet reporté en juin (doc 13:209-212, 504-505) ; la spec le prévoit
  (`openapi.yaml:638-639`, Bible ~l.376-403 : J+1 « En attente de retour », J+21/22 `NOT_RETURNED` ; tâche LOAN-017,
  doc 04:376). Les tests le masquent : `reminder-exhausted.listener.spec.ts` crée directement des prêts
  `AWAITING_RETURN`.
- **Périmètre**
    - **Back** : `@Cron(CronExpression.EVERY_HOUR) handleOverdueLoans` dans `LoansCronService`
      (`loans/loans-cron.service.ts`, même pattern que `handlePendingTimeout` l.49-95). Conditions : statut ∈
      {`ACTIVE`, `ACTIVE_BY_DEFAULT`}, `deletedAt` nul, `returnDate` non nulle et **strictement antérieure au jour
      courant** (bascule à J+1 ; le jour J reste « à l'heure », cohérent avec le commit `7e1adc3` et la définition
      `overdueLoans` de FEAT-04 ; **attention timezone** : `returnDate` est `@db.Date`). Transition validée via la
      machine à états (`ROLE_TRANSITIONS.system`). `updateMany` avec le statut dans le `where` → **idempotent**.
      Émission de `LOAN_EVENTS.STATUS_CHANGED` pour chaque prêt basculé. Le listener existant fait ensuite
      `AWAITING_RETURN` → `NOT_RETURNED` au FINAL_OVERDUE (J+21) **sans modification**.
    - **Rattrapage** : les prêts déjà en retard en prod sont repris au premier passage du CRON. Cas à traiter : prêts
      dont le FINAL_OVERDUE est déjà parti (ils resteraient bloqués en `AWAITING_RETURN`) → rattrapage explicite vers
      `NOT_RETURNED` si un rappel `FINAL_OVERDUE` est `SENT`.
    - **Front** : aucun changement (`StatusBadge`, `LoanTimeline`, filtres affichent déjà `AWAITING_RETURN` et
      `NOT_RETURNED`) ; vérification visuelle seulement.
    - **Tests** : unitaires (sélection ; exclusions : sans `returnDate`, échéance du jour J, `deletedAt`,
      `CONTESTED` / `RETURNED` ; événement émis ; idempotence ; frontière J / J+1) + **e2e du chemin complet**
      `ACTIVE` → `AWAITING_RETURN` → rappels → `ALL_EXHAUSTED` → `NOT_RETURNED`, en vérifiant que `notReturnedLoans`
      et le trustScore évoluent.
- **Critères d'acceptation**
    - [ ] Un prêt `ACTIVE` / `ACTIVE_BY_DEFAULT` dont la `returnDate` est passée (< jour courant) passe en
      `AWAITING_RETURN` au tick suivant ; un prêt dont la date est aujourd'hui reste inchangé
    - [ ] Idempotent (deux ticks = une seule transition, un seul événement)
    - [ ] Chemin complet jusqu'à `NOT_RETURNED` couvert par un e2e vert ; `notReturnedLoans` > 0 et trustScore pénalisé
    - [ ] Rattrapage des prêts déjà en retard / FINAL_OVERDUE déjà envoyé testé
    - [ ] Tests back verts, lint + typecheck OK ; mergée sur `fix/preprod-corrections`
    - [ ] Doc : LOAN-017 coché (doc 04), doc 13 : sujet reporté (l.209) noté « traité »

---

### FEAT-11 — Rappels annulés ou replanifiés selon le cycle de vie

- **Porteur** : Ozias (back + tests ; pas de front) · **Priorité** : Must · **Estim.** : 1,5 h (1-2 h)
- **⚠️ Exception au périmètre (validée par Ismael le 28/10)** : FEAT-11 a finalement **changé un contrat HTTP** et le
  **front**. `PATCH /loans/{loanId}` renvoie `409 loan-return-date-locked` si la date de retour est modifiée hors d'un
  prêt `PENDING_CONFIRMATION` / `ACTIVE` / `ACTIVE_BY_DEFAULT` (mise à jour conditionnelle au statut) ; côté front, le
  champ date est masqué hors prêt ouvert, un message FR/EN s'affiche et la fenêtre d'édition reste ouverte en cas de
  409. Les rappels sont aussi annulés sur `NOT_RETURNED` et à la suppression du prêt, et toutes les règles de jour
  calendaire passent en UTC (`startOfUtcDay`).
- **Dépendances** : aucune. **Contrat avec FEAT-10** : événement `LOAN_EVENTS.STATUS_CHANGED`.
- **Constat vérifié** : les rappels ne sont jamais annulés quand le prêt passe `RETURNED` / `ABANDONED` /
  `CONTESTED`. `RemindersService.cancel` (`reminders.service.ts:107-112`) n'est appelé que par l'endpoint manuel et
  `scheduleReminders` crée tous les rappels à `LOAN_EVENTS.CREATED`. Un emprunteur qui a rendu l'objet reçoit donc
  encore les relances J+7 / J+14 / J+21. De plus, un `PATCH` de `returnDate` (`loans.service.ts:283-300`) ne
  replanifie pas les rappels. L'enum `ReminderStatus` contient déjà `CANCELLED`.
- **Périmètre**
    - **Back** : nouveau listener dans `reminders/` sur `LOAN_EVENTS.STATUS_CHANGED` : annule (`CANCELLED`) les
      rappels `SCHEDULED` **uniquement** quand le nouveau statut est `RETURNED`, `ABANDONED` ou `CONTESTED`,
      **jamais** pour `AWAITING_RETURN` (sinon FEAT-10 casserait la chaîne de relances). Sur modification de
      `returnDate` (`loans.service.ts:283-300`) : annuler les `SCHEDULED` et replanifier via `reminder-policy`.
    - **Front** : aucun.
    - **Tests** : unitaires du listener (chaque statut cible ; `AWAITING_RETURN` n'annule rien ; les rappels `SENT`
      restent intacts) ; replanification après changement de date.
- **Critères d'acceptation**
    - [x] Retour / abandon / contestation d'un prêt → ses rappels `SCHEDULED` passent `CANCELLED`, plus aucune relance
      ne part
    - [x] Passage en `AWAITING_RETURN` n'annule aucun rappel ; les rappels `SENT` restent intacts
    - [x] Changement de `returnDate` → anciens rappels `SCHEDULED` annulés, nouveaux planifiés selon la politique
    - [ ] Tests back verts, lint + typecheck OK ; mergée sur `fix/preprod-corrections` — tests verts, en attente de la
      fusion de la PR #30
    - [x] Doc : note dans doc 13 / 04 si applicable (lignes de sa feature uniquement) — note FEAT-11 dans le doc 04

---

### FEAT-08 — Mise à jour de la documentation

- **Porteur** : Ismael (pilotage + lot A) · Ozias (lot B) · **Priorité** : Must · **Estim.** : 4,5 h (2,5 + 2)
- **Dépendances** : en continu — **chaque porteur coche lui-même les lignes de sa propre feature** (y compris
  PUSH-B5/F5/P1/P2, CORR-02/05/07, LOAN-017 selon qui a livré) ; les lots ci-dessous ne touchent **que** les
  rattrapages structurels sans porteur de feature, à faire **après** les merges (mercredi soir / jeudi matin). Ainsi
  aucun lot n'attend ni ne dépend de l'avancement de l'autre.
- **Lot A — Ismael (2,5 h)**
    - Doc 11 : statuts CORR-01/03/04/13 → ✅ (déjà livrés) ; CORR-14 partiel ; décisions « post-échéance »
      inscrites (CORR-02/05/07/08/10 : cochés par leur porteur de feature).
    - Doc 13 : FIX-17 « ✅ Back / ⏳ Front » → ✅ (commit `c4d6d91`).
    - `docs/CLAUDE.md` (CORR-11) : tableau Avancement (Sprints 4.6 / 5 / 6 passés à Fait, phase pré-prod), Notifications
      « FCM » → « Expo Push Service », mention de l'organisation par feature.
    - Docs 00 et 05 : resync (doc 12 §A).
    - Doc 16 : statuts finaux.
- **Lot B — Ozias (2 h)**
    - Doc 14 : hashes F1-F4 → `6d6c799` / `8e2b287` (au lieu de `dc6f4a0` / `0781cd5`) ; cases d'acceptation B1-B4
      cochées (statut ✅) ; les lignes PUSH-B5 / F5 / P1 / P2 sont cochées par le porteur de FEAT-02/03/05.
    - Doc 15 : cocher ce qui est fait (Play Console, FCM EAS, ACC-G1→G3) + iOS selon FEAT-03.
    - Docs 04 et 08 : resync (doc 12 §A) ; doc 10 : état R2 après FEAT-01. (Doc 04 : la ligne LOAN-017 est cochée par
      Ismael via FEAT-10 — lignes distinctes, pas de conflit.)
- **Critères d'acceptation**
    - [ ] Plus aucun statut ☐ dans les docs 11-15 qui contredise le code ou l'infra réelle
    - [ ] Docs 00 / 04 / 05 / 08 resynchronisés (liste des écarts de doc 12 §A traitée ou explicitement reportée)
    - [ ] `docs/CLAUDE.md` à jour (avancement, notifications, organisation par feature)
    - [ ] Hashes de commit vérifiés via `git log` (pas de hash recopié de mémoire)
    - [ ] PR docs mergée dans `fix/preprod-corrections` (puis dans `main` via FEAT-00)

---

### FEAT-09 — Seuils de couverture (CORR-10)

- **Porteur** : Ismael (front) + Ozias (back) · **Priorité** : Could · **Estim.** : 2 h (1 h chacun)
- **Dépendances** : toutes les autres features mergées (mesurer sur le code final) → **jeudi seulement**.
- **Périmètre** : mesurer la couverture actuelle (`jest --coverage`), fixer `coverageThreshold` **légèrement sous** le
  niveau mesuré (garde-fou anti-régression, pas d'objectif irréaliste) dans `frontend/jest.config.js` et la config Jest
  backend ; brancher en CI si déjà prévu. Les cibles du projet (Domain 95 %, Services 90 %, Controllers 70 %)
  restent l'objectif long terme.
- **Critères d'acceptation**
    - [ ] `coverageThreshold` défini côté front et côté back
    - [ ] `jest --coverage` passe localement et en CI
    - [ ] Doc : CORR-10 → ✅ (doc 11)

---

## Planning jour par jour

Points de synchro : **S1** lundi 8h30 (kick-off 15 min) · **S3** mardi 17h (point
d'étape, dont avancement iOS + **déploiement D1**) · **S4** mercredi 12h (go/no-go sur les Should) · **S5** jeudi 9h (plan de clôture) ·
**S6** jeudi 16h (gel du code, puis **déploiement D2**).
**Créneaux de déploiement Fly fixes (Ozias)** : **D1** mardi 17h (FEAT-01, 02, 10, 11) · **D2** jeudi après le gel
(FEAT-04 + éventuels correctifs de recette). Aucun déploiement « à la demande » : personne n'attend l'autre pour
avancer, la DoD d'une feature back = mergée sur `fix/preprod-corrections` avec tests verts.

### Lundi 26/10

| Slot           | Ismael                                                                                               | Ozias                                                                                                           |
|----------------|------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------|
| 8h30           | **S1** kick-off ; (invitation EAS d'Ozias déjà faite dimanche 25/10) ; branches de features créées depuis `fix/preprod-corrections` ; smoke test de la base | **S1** ; branche l'app au compte Apple (bundle ID `com.ideogen.returnapp` + fiche App Store Connect + clé APNs `.p8` → EAS) ; crée le bucket R2 |
| 9h-11h         | FEAT-05 : service account Play API, fichier local                                                    | FEAT-01 : service R2 + specs (TDD)                                                                              |
| 11h-12h        | FEAT-05 : build AAB lancé (tâche de fond) ; démarrage FEAT-10 (CRON + tests unitaires)                                | FEAT-01 : bascule module + env validation                                                                       |
| après-midi     | FEAT-10 : CRON, rattrapage, tests unitaires                                                          | FEAT-01 : tests + préparation déploiement ; début FEAT-02 (audit secrets)                                       |
| Fin de journée | PRs de feature mergées au fil de l'eau dans `fix/preprod-corrections`                                | Si possible : accès EAS reçu, vérif des credentials                                                             |

### Mardi 27/10

| Slot       | Ismael                                                                          | Ozias                                                                                                            |
|------------|---------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------|
| Matin      | FEAT-10 : e2e chemin complet + merge (avant 16h pour D1) ; FEAT-05 : `eas submit` Android, piste interne, testeurs | FEAT-01 : secrets Fly R2, premier `fly deploy` + vérif survie au redeploy ; FEAT-02 (CORS, scale count, secrets) |
| Après-midi | FEAT-06 : store + étapes de timeline + tests, merge ; démarrage FEAT-07 (store + types) | FEAT-11 (listener + replanification + tests) ; FEAT-03 : `eas.json` iOS, premier build iOS lancé                |
| 17h        | **S3** : point d'étape ; test install Play interne ; FEAT-10 mergée avant D1 | **S3** : point d'étape iOS (build/credentials OK ? iPhone dispo ?) ; **déploiement D1** FEAT-01/02/10/11           |

### Mercredi 28/10

| Slot       | Ismael                                                              | Ozias                                                                |
|------------|---------------------------------------------------------------------|----------------------------------------------------------------------|
| Matin      | FEAT-07 : écran, filtres, pagination, navigation                    | Vérif logs D1 (4 CRON, FEAT-02) ; FEAT-03 : build iOS production, `eas submit`, TestFlight |
| 12h        | **S4** : go/no-go (FEAT-07 filtre/pagination ou repli liste simple) | **S4**                                                               |
| Après-midi | FEAT-07 : tests, i18n, vérif device ; PR                            | FEAT-04 (back + front + tests, pendant le traitement TestFlight) ; FEAT-03 : installation TestFlight, test push iPhone |
| Soir       | Début FEAT-08 lot A (docs 11, 13)                                   | Début FEAT-08 lot B (docs 14, 15)                                    |

### Jeudi 29/10

| Slot               | Ismael                                                                       | Ozias                                                                                    |
|--------------------|------------------------------------------------------------------------------|------------------------------------------------------------------------------------------|
| 9h                 | **S5**                                                                       | **S5**                                                                                   |
| Matin              | FEAT-07 mergée ; FEAT-08 lot A (CLAUDE.md, docs 00/05, 16)                   | FEAT-03 : finalisation (e2e iOS, TestFlight testeurs) ; FEAT-08 lot B (docs 04/08/14/15) |
| Début d'après-midi | FEAT-09 front (si temps) ; régression complète lint + typecheck + jest ; recette croisée FEAT-10 × FEAT-11 (cycle de vie complet, avec Ozias) | FEAT-09 back (si temps) ; régression back + e2e ; vérif prod (`fly logs`, CRON, photos)  |
| 16h                | **S6 : gel du code** ; PR docs mergée                                        | **S6** ; déploiement **D2** après le gel (FEAT-04 + correctifs)                          |
| 16h-soir           | Recette finale sur device (Android) ; **FEAT-00** : prépare la PR `fix/preprod-corrections` → `main` (0,5 h), merge après revue | Recette finale (iOS) ; **FEAT-00** : revue de la PR (0,5 h) ; mise à jour de ce doc ; buffer |

---

## Indépendance des tâches / dépendances croisées

Exigence explicite (Ismael, 25/10) : **aucun des deux ne doit attendre l'autre pour avancer**. Points de contact et
leur neutralisation :

| #  | Point de contact | Neutralisation |
|----|------------------|----------------|
| 1  | **FEAT-10 ↔ FEAT-11** | **Contrat = événement `STATUS_CHANGED` existant.** FEAT-11 n'annule que sur `RETURNED` / `ABANDONED` / `CONTESTED`, **jamais** sur `AWAITING_RETURN`. Chacun développe et teste en isolation ; le test croisé se fait à la recette de jeudi. Fichiers distincts : `loans/loans-cron.service.ts` (FEAT-10) vs `reminders/` + `loans.service.ts` update (FEAT-11) |
| 2  | FEAT-10 ↔ FEAT-04 | Aucune dépendance : `overdueLoans` repose sur la date, pas sur le statut `AWAITING_RETURN` (inclus dans sa définition) |
| 3  | FEAT-06 ↔ FEAT-11 | Aucune dépendance : `ReminderStatus.CANCELLED` existe déjà et FEAT-06 l'ignore à l'affichage |
| 4  | **Déploiement Fly** (Ozias seul déployeur) | DoD d'une feature back (dont FEAT-10 d'Ismael) = mergée sur `fix/preprod-corrections` avec tests verts. Mise en prod aux **créneaux fixes D1 (mardi 17h) et D2 (jeudi après gel)**, jamais à la demande : personne n'est bloqué |
| 5  | **Invitation EAS d'Ozias** | Faite par Ismael **dès dimanche 25/10** : Ozias ne l'attend pas lundi |
| 6  | `api.types.ts` (FEAT-04 `overdueLoans`, FEAT-07 types historique) | Risque de conflit de merge seulement : chacun ajoute ses champs sans modifier ceux de l'autre |
| 7  | `frontend/eas.json` (FEAT-03 iOS ↔ FEAT-05 Android) | Blocs séparés : Ismael édite uniquement `android`, Ozias uniquement `ios` ; aucune demande croisée (règle précédente « Ozias seul » supprimée car elle créait une dépendance) |
| 8  | FEAT-02 ↔ FEAT-10 (vérif « 4 CRON ») | Ozias valide les 3 CRON existants après D1 ; `handleOverdueLoans` est vérifié dès qu'il est déployé (D1 ou D2) — FEAT-02 ne bloque pas sur FEAT-10 |
| 9  | FEAT-07 → correction back éventuelle | Corrigée par Ismael lui-même (merge + tests) ; il adapte le front au contrat réel sans attendre le déploiement |
| 10 | FEAT-08 (docs) | Chaque porteur coche les lignes de **sa** feature ; les lots A/B ne couvrent que les rattrapages structurels ; lignes distinctes dans les mêmes fichiers (doc 04 : LOAN-017 par Ismael, resync par Ozias) |
| 11 | Tâches **communes par nature** | FEAT-08 (docs), FEAT-09 (couverture, front/back séparés), FEAT-00 (merge final, fin de sprint) — seules tâches où les deux se synchronisent, en fin de semaine |
| 12 | Recette croisée FEAT-10 × FEAT-11 | Seul vrai point de jonction fonctionnel, volontairement placé jeudi après-midi ; chaque feature est déjà prouvée seule par ses propres tests |

---

## Post-échéance (explicitement sorti du périmètre)

| Item                                                                                                               | Raison                                                                                                                         |
|--------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------|
| Dashboard dédié (graphiques `byCategory`, `topBorrowers`, `mostLoanedItems`) — reste de CORR-14                    | Trop gros pour la fenêtre (2-4 j) ; l'historique et les stats de base livrés couvrent le besoin immédiat                       |
| Filtres historique par date / emprunteur                                                                           | Valeur secondaire, endpoint prêt côté back, ajout simple ensuite                                                               |
| CORR-12 — DNS `api.return.app`                                                                                     | Nécessite l'achat d'un domaine + config DNS/TLS ; aucun utilisateur public avant la prod publique, `return-api.fly.dev` suffit |
| CORR-06 — Type MONEY orphelin                                                                                      | Décision produit requise, non investiguée ; aucun impact bloquant                                                              |
| Passage Beta App Review / lien TestFlight public, passage en production publique Google (règle 20 testeurs × 14 j) | Hors besoin du re-test terrain (testeurs internes)                                                                             |
| FIX-16 — Temps réel (websockets)                                                                                   | Post-MVP acté                                                                                                                  |
| PUSH-B6 — Receipts push (CRON + migration Prisma)                                                                  | Post-MVP acté                                                                                                                  |
| Réactivation manuelle d'un prêt `NOT_RETURNED` si l'objet revient (prévue par la Bible)                             | La machine à états ne le permet pas (`loan-status-machine.ts:41`) ; changement de règle métier, hors échéance                  |
| CORR-09 — BullMQ / migration des CRON                                                                              | Post-MVP acté ; **d'ici là : 1 seule machine Fly** (cf. FEAT-02)                                                               |

---

## Risques (top)

| #  | Risque                                                                                                                          | Proba   | Impact | Mitigation                                                                                                              |
|----|---------------------------------------------------------------------------------------------------------------------------------|---------|--------|-------------------------------------------------------------------------------------------------------------------------|
| R1 | **Mise en route iOS** : premier build / credentials EAS iOS, traitement TestFlight, iPhone physique pour le test push (compte Apple ✅ actif) | Faible | Moyen | Brancher l'app au compte et lancer le 1er build dès lundi/mardi ; point d'étape S3 mardi 17h ; repli « prêt à soumettre » |
| R2 | **Accès croisés** : Ozias doit être invité sur EAS (owner `natismael` = Ismael, confirmé) pour iOS ; Cloudflare/Fly à partager | Moyenne | Moyen  | Invitation EAS faite par Ismael dès dimanche 25/10 ; secrets jamais commités ; un seul déployeur Fly (Ozias)                                     |
| R3 | Remise en route après 4 mois d'arrêt (dépendances, builds EAS, quotas gratuits Fly/EAS, 1er upload Play manuel)                 | Moyenne | Moyen  | Buffer ≈ 25 % ; smoke test de la base dès lundi ; lancer les builds tôt                                                  |
| R4 | Double exécution des CRON si >1 machine Fly (notifications en double)                                                           | Faible  | Moyen  | Contrôle `fly status` / `fly scale count 1` (FEAT-02)                                                                   |
| R5 | FEAT-07 sous-estimée (plus gros chantier front)                                                                                 | Moyenne | Moyen  | Repli liste simple, go/no-go mercredi 12h                                                                               |
| R7 | **Marge d'Ismael faible** (≈ 10 %) : FEAT-10 (Must) + FEAT-07 (incertaine) | Moyenne | Moyen | Repli liste simple FEAT-07 en premier ; Ozias reprend FEAT-09/FEAT-06 si besoin (indépendants) |
| R8 | **FEAT-10 change le comportement prod** : au premier tick, tous les prêts déjà en retard basculent en `AWAITING_RETURN` (et notifs/relances reprennent) ; timezone `@db.Date` | Moyenne | Moyen | Rattrapage testé, idempotence, frontière J/J+1 testée ; recette croisée jeudi ; D1 mardi laisse 2 jours d'observation |
| R6 | Besoin d'un iPhone physique pour le test push iOS                                                                               | Moyenne | Moyen  | Identifier l'appareil/testeur dès lundi                                                                                 |

---

*Document produit le 25/10/2026 — estimations macro à valider par chaque porteur à l'ouverture de sa feature ; à tenir
à jour (statuts, cases) pendant la semaine. Compagnon de `11` → `15`.*
