# 11_CORRECTIFS_PREPROD.md

**Return ↺ — Backlog de Correctifs · Phase Pré-production**

> **Date** : 20 juin 2026
> **Source** : Audit de cohérence preprod (exploration code `Explore` ×2 + analyse `architecte`)
> **Phase** : Pré-production — backend déployé sur Fly.io (`return-api.fly.dev`), frontend branché dessus (tous modules
`mock: false`), builds EAS Android/iOS configurés (`com.ideogen.returnapp`)
> **Périmètre** : **Front** = Ismael · **Back** = Esdras

### Légende gravité

| Symbole | Niveau   | Définition                                                              |
|---------|----------|-------------------------------------------------------------------------|
| 🔴      | Critique | Casse une fonctionnalité cœur ou rend les tests terrain non fiables     |
| 🟠      | Majeur   | Impact notable en production, à traiter avant la mise en ligne publique |
| 🟡      | Mineur   | Dette technique ou UX dégradée, peut attendre un sprint dédié           |

---

## Tableau récapitulatif

| ID      | Titre                                                              | Gravité     | Périmètre                         | Effort              | Statut |
|---------|--------------------------------------------------------------------|-------------|-----------------------------------|---------------------|--------|
| CORR-01 | CRON in-process vs Fly.io scale-to-zero                            | 🔴 Critique | Back (Esdras)                     | 5 min / 2-3h        | ✅      |
| CORR-02 | Stockage photos R2 non implémenté                                  | 🟠 Majeur   | Back (Esdras)                     | 2-3h                | ◑ code ✅ (FEAT-01) · recette après D2 |
| CORR-03 | `expo-notifications` absent des plugins `app.json`                 | 🟠 Majeur   | Front (Ismael)                    | 5 min               | ✅      |
| CORR-04 | `getExpoPushTokenAsync()` sans `projectId`                         | 🟠 Majeur   | Front (Ismael)                    | 5 min               | ✅      |
| CORR-05 | Secrets Fly à définir/vérifier                                     | 🟠 Majeur   | Back (Esdras)                     | 15 min              | ◑ stagés · effectifs au déploiement D2 |
| CORR-06 | Type MONEY orphelin (UX)                                           | 🟡 Mineur   | Front (Ismael) + décision produit | 30 min              | ☐      |
| CORR-07 | Rappels invisibles dans l'UI                                       | 🟡 Mineur   | Front (Ismael)                    | 2-4h                | ✅      |
| CORR-08 | Endpoints History/Statistics non consommés                         | 🟡 Mineur   | Front (Ismael)                    | 1h                  | ✅      |
| CORR-09 | BullMQ annoncé mais jamais implémenté                              | 🟡 Mineur   | Back (Esdras)                     | Dette doc           | ☐      |
| CORR-10 | Pas de `coverageThreshold` configuré                               | 🟡 Mineur   | Back + Front                      | 30 min              | ☐      |
| CORR-11 | `docs/CLAUDE.md` tableau Avancement périmé                         | 🟡 Mineur   | Doc                               | 10 min              | ☐      |
| CORR-12 | DNS custom `api.return.app` absent                                 | 🟡 Mineur   | Info / Back                       | Avant prod publique | ☐      |
| CORR-13 | Incompatibilité Expo Push Token ↔ Firebase Admin (FCM)             | 🟠 Majeur   | Front + Back                      | 1-3h                | ✅      |
| CORR-14 | Écrans Sprint 6 (Dashboard/History/Stats) retirés → Epic 4 partiel | 🟡 Décision | Front (Ismael) + produit          | 0 / 2-4j            | ◐ partiel (historique livré, dashboard post-échéance) |

---

## 🔴 Critique

### CORR-01 — CRON in-process vs Fly.io scale-to-zero

- **Gravité** : 🔴 Critique
- **Périmètre** : Back (Esdras)
- **Effort** : 5 min (correctif immédiat) / 2-3h (solution robuste)
- **Fichier(s) & preuve** :
    - `backend/fly.toml:18` → `auto_stop_machines = 'stop'`
    - `backend/fly.toml:20` → `min_machines_running = 0`
    - `backend/src/loans/loans-cron.service.ts:27` → `@Cron(CronExpression.EVERY_HOUR)` (auto-confirm 48h)
    - `backend/src/reminders/reminders-cron.service.ts:21` → `@Cron(CronExpression.EVERY_HOUR)` (envoi rappels)
    - `backend/src/contact-invitations/contact-invitations-cron.service.ts:20` → `@Cron('0 3 * * *')` (expiration
      invitations)
- **Problème** : les 3 CRON tournent via `@nestjs/schedule`, **en mémoire du process NestJS**. Avec
  `min_machines_running = 0` + `auto_stop_machines = 'stop'`, la machine Fly s'arrête après quelques minutes sans trafic
  HTTP. Conséquence : les **rappels automatiques** (proposition de valeur centrale), l'**auto-confirmation à 48h** et l'
  **expiration des invitations** ne s'exécutent pas de façon fiable — le CRON de 3h00 ne se déclenchera quasi jamais. *
  *C'est le cœur de ce que Return promet aux utilisateurs.**
- **Action recommandée** :
    1. *Immédiat* → `min_machines_running = 1` dans `fly.toml` (machine toujours active, ~3-4 $/mois pour une
       shared-cpu-1x 512 MB). Vérifier ensuite via `fly logs -a return-api` que les CRON s'exécutent.
    2. *À terme (si montée en charge)* → migrer les jobs vers **BullMQ** (worker Redis persistant) ou un **cron externe
       ** (Upstash QStash / GitHub Actions / Fly scheduled machine) appelant un endpoint `/v1/cron/tick`.
- **Statut** : ✅ Livré (`min_machines_running = 1`, cf. doc 16 FEAT-02). Reste : plafonner à 1 machine (FEAT-02) tant que
  les CRON ne sont pas migrés (CORR-09).

---

## 🟠 Majeur

### CORR-02 — Stockage photos R2 non implémenté

- **Gravité** : 🟠 Majeur
- **Périmètre** : Back (Esdras)
- **Effort** : 2-3h
- **Fichier(s) & preuve** :
    - `backend/src/storage/photo-storage.module.ts:19` → `useClass: LocalPhotoStorageService`
    - `backend/src/storage/photo-storage.module.ts:11-12` → commentaire « Pour la production (R2), remplacer useClass
      par R2PhotoStorageService »
    - `backend/src/storage/local-photo-storage.service.ts:22` → stockage disque `uploads/`
    - `backend/src/main.ts:45` → route statique `/uploads`
    - Aucun fichier `backend/src/storage/r2-photo-storage.service.ts`
- **Problème** : les conteneurs Fly.io sont éphémères ; le répertoire `uploads/` n'est pas un volume persistant. *
  *Toutes les photos uploadées sont perdues à chaque redéploiement** (ou restart automatique).
- **Action recommandée** : créer `R2PhotoStorageService` (`@aws-sdk/client-s3`, compatible R2), basculer l'injection,
  configurer 5 secrets Fly (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`,
  `R2_PUBLIC_URL`), conditionner `useStaticAssets` à l'absence de R2. **Procédure pas-à-pas complète
  dans `docs/10_ROADMAP_CLOUDFLARE_R2.md`** (l'interface `PhotoStorage` est déjà prête).
- **Statut** : ◑ Code livré par FEAT-01 (merge `9a6ca53`, PR #30) — `R2PhotoStorageService`, choix R2/local par
  `photo-storage.factory.ts` (les 5 `R2_*` ou aucune), **R2 obligatoire en production** (ADR 0008), `/uploads` servi
  seulement en stockage local, purge des photos à la suppression de compte. Bucket `return-photos-preprod` testé en
  réel le 26/10 ; les 5 secrets `R2_*` sont posés en `--stage`. Reste : déploiement D2 et preuve qu'une photo survit à
  un `fly deploy`. Détail à jour : `10_ROADMAP_CLOUDFLARE_R2.md` § « État au 31/10/2026 ».

### CORR-03 — `expo-notifications` absent des plugins `app.json`

- **Gravité** : 🟠 Majeur
- **Périmètre** : Front (Ismael)
- **Effort** : 5 min (rebuild EAS requis)
- **Fichier(s) & preuve** :
    - `frontend/app.json:38` → `"plugins": ["expo-localization"]` (`expo-notifications` absent)
    - `frontend/src/services/pushNotifications.ts:21` → usage runtime
    - `frontend/package.json:32` → `"expo-notifications": "~0.32.16"` (dépendance bien installée)
- **Problème** : sur un build natif EAS (`preview`), `expo-notifications` doit être déclaré dans `plugins` pour que les
  entitlements et le code natif soient injectés par Expo Prebuild. Sans ça, **les push ne fonctionnent pas sur l'APK** (
  uniquement en Expo Go / web).
- **Action recommandée** : ajouter `"expo-notifications"` au tableau `plugins` de `app.json`, puis rebuild EAS.
- **Statut** : ✅ Livré (push reçu sur le build Android de production, 28/10/2026)

### CORR-04 — `getExpoPushTokenAsync()` sans `projectId`

- **Gravité** : 🟠 Majeur
- **Périmètre** : Front (Ismael)
- **Effort** : 5 min
- **Fichier(s) & preuve** :
    - `frontend/src/services/pushNotifications.ts:21` → `Notifications.getExpoPushTokenAsync()` (sans paramètre)
    - `frontend/app.json:41` → `projectId` disponible : `595176ea-3595-4aec-8ba5-b56da4f48a67`
- **Problème** : avec Expo SDK 49+, `getExpoPushTokenAsync()` exige `{ projectId }` hors Expo Go. Sans ça, **erreur en
  build standalone**.
- **Action recommandée** : passer `{ projectId: '595176ea-3595-4aec-8ba5-b56da4f48a67' }`.
- **Statut** : ✅ Livré (push reçu sur le build Android de production, 28/10/2026)

### CORR-05 — Secrets Fly à définir / vérifier

- **Gravité** : 🟠 Majeur
- **Périmètre** : Back (Esdras)
- **Effort** : 15 min
- **Fichier(s) & preuve** :
    - `backend/src/main.ts:53` → `origin: config.get('CORS_ORIGIN', 'http://localhost:8081')` (valeur par défaut)
    - `backend/fly.toml` → aucune variable `CORS_ORIGIN`
- **Problème** : **Obsolète depuis CORR-13 (option B)** — le push passe désormais par l'Expo Push Service
  (`firebase-admin` retiré). `FIREBASE_SERVICE_ACCOUNT_BASE64` n'est plus utilisé ; l'envoi fonctionne sans credential
  (un `EXPO_ACCESS_TOKEN` optionnel lève seulement le rate-limit ~1000 notifs/h). Reste valable : sans `CORS_ORIGIN`,
  la valeur par défaut `localhost:8081` s'applique.
- **Action recommandée** : `fly secrets set EXPO_ACCESS_TOKEN=… CORS_ORIGIN=… -a return-api`, puis
  `fly secrets unset FIREBASE_SERVICE_ACCOUNT_BASE64 -a return-api` et `fly secrets list -a return-api` pour vérifier.
- **Statut** : ◑ Fait côté code et secrets, effectif au déploiement D2 (FEAT-02, PR #30) :
    - **Firebase** : aucun secret Firebase sur Fly (vérifié le 31/10 par `fly secrets list`, noms uniquement).
    - **`EXPO_ACCESS_TOKEN`** : posé en `--stage` le 26/10 (robot Expo, rôle Viewer — à confirmer suffisant lors du
      premier envoi après D2, sinon rôle Developer).
    - **`CORS_ORIGIN`** : fixé dans `fly.toml` à `https://return-api.fly.dev` ; en production l'API refuse de
      démarrer sans une origine https exacte et non locale (ADR 0009). L'ancien secret `CORS_ORIGIN='*'` est retiré en
      `--stage`.
    - **Audit vs `env.validation.ts`** : obligatoires en prod et présents sur Fly — `DATABASE_URL`,
      `JWT_ACCESS_SECRET`, `REDIS_URL` ; R2 obligatoire (5 `R2_*` stagés) ; `NODE_ENV`, `PORT`, `API_PREFIX`,
      `LOG_LEVEL`, `CORS_ORIGIN` dans `fly.toml`. `REDIS_URL` est obligatoire en prod
      (URL `redis://`/`rediss://`, commit `5b6066d`, remarque de relecture PR #30). Écart relevé : le secret `JWT_REFRESH_SECRET` existe sur Fly mais
      n'est lu par aucun code.

### CORR-13 — Incompatibilité Expo Push Token ↔ Firebase Admin SDK (FCM)

- **Gravité** : 🟠 Majeur — **fond du problème push, en amont de CORR-03/04/05**
- **Périmètre** : Front (Ismael) + Back (Esdras) — décision commune
- **Effort** : 1-3h selon l'option retenue
- **Fichier(s) & preuve** :
    - `frontend/src/services/pushNotifications.ts:21` → `Notifications.getExpoPushTokenAsync()` → renvoie un **token
      Expo** (format `ExponentPushToken[…]`)
    - `backend/src/firebase/firebase.service.ts:3` → `import * as admin from 'firebase-admin'`
    - `backend/src/firebase/firebase.service.ts:67` → `this.messaging.sendEachForMulticast(message)` → attend des *
      *tokens FCM natifs**
- **Problème** : le frontend enregistre un **token Expo Push** que le backend tente d'envoyer via **Firebase Admin SDK
  **, lequel n'accepte que des tokens FCM natifs. Formats incompatibles → rejet `messaging/invalid-registration-token`.
  **Les push en arrière-plan ne fonctionneront jamais** tels quels ; CORR-03/04/05 sont nécessaires mais **NON
  suffisants** sans celui-ci. Dégradé non bloquant : les notifications restent consultables in-app via le polling 30s.
- **Action recommandée — choisir UNE option** :
    - **Option A** : front → `getDevicePushTokenAsync()` (token FCM natif ; nécessite `google-services.json` dans le
      build) ; back conserve Firebase Admin. Cohérent avec la stack FCM des roadmaps.
    - **Option B** : back → API Expo Push (`expo-server-sdk` / `exp.host/--/api/v2/push/send`) ; front conserve
      `getExpoPushTokenAsync()`. Plus simple, mais crée une dépendance Expo.
- **Statut** : ✅ Option B retenue et livrée (Expo Push Service, `firebase-admin` retiré)

---

## 🟡 Mineur

### CORR-06 — Type MONEY orphelin (UX)

- **Gravité** : 🟡 Mineur
- **Périmètre** : Front (Ismael) + décision produit (avec Esdras)
- **Effort** : 30 min
- **Fichier(s) & preuve** :
    - `frontend/src/screens/items/ItemListScreen.tsx:47` → `if (item.category === 'MONEY') return false;` (filtré de la
      liste)
    - `frontend/src/components/loans/LoanWizard.tsx:149` → `items.filter((i) => i.category !== 'MONEY')` (exclu du
      sélecteur)
    - `frontend/src/components/items/ItemForm.tsx:108` → chip `'MONEY'` sélectionnable dans le formulaire
    - `frontend/src/screens/items/CreateItemScreen.tsx:31-33`
- **Problème** : le prêt d'argent fonctionne via le `LoanWizard`, mais un item MONEY créé via le **formulaire d'objet**
  devient **orphelin** (filtré partout → invisible et inutilisable, pollue la base).
- **Action recommandée** : trancher le statut du type MONEY → soit retirer le chip MONEY de `ItemForm`, soit
  conditionner la FAB de création standalone, puis aligner.
- **Statut** : ☐ À faire

### CORR-07 — Rappels invisibles dans l'UI

- **Gravité** : 🟡 Mineur
- **Périmètre** : Front (Ismael)
- **Effort** : 2-4h
- **Fichier(s) & preuve** :
    - `frontend/src/components/loans/LoanTimeline.tsx:123` →
      `// TODO Sprint 5 : ajouter les étapes de rappel (J+3, J+7, J+14, J+21)…`
    - Aucun appel `GET /loans/:id/reminders` côté front
- **Problème** : le backend planifie/envoie les rappels (statuts `SCHEDULED`/`SENT`/`FAILED`) mais le prêteur n'a *
  *aucune visibilité** sur les rappels prévus/envoyés — alors que c'est au cœur de la promesse « Return délègue la
  friction sociale ».
- **Action recommandée** : appeler `GET /v1/loans/:id/reminders` et afficher les paliers sur la timeline pour les prêts
  `AWAITING_RETURN`.
- **Statut** : ✅ Livré le 28/10/2026 (FEAT-06, doc 16) : seul le prêteur voit les rappels `SENT` / `SCHEDULED` pour les
  prêts `ACTIVE`, `ACTIVE_BY_DEFAULT` et `AWAITING_RETURN` ; TODO « J+3 » supprimé.

### CORR-08 — Endpoints History/Statistics non consommés + `LenderStats` inefficace

- **Gravité** : 🟡 Mineur
- **Périmètre** : Front (Ismael)
- **Effort** : 1h
- **Fichier(s) & preuve** :
    - `backend/src/history/history.controller.ts:30` → `GET /v1/history/loans`
    - `backend/src/history/history.controller.ts:42` → `GET /v1/history/statistics`
    - `frontend/src/components/profile/LenderStats.tsx:80-83` → recharge ~200 prêts (`GET /loans?role=…&limit=100` ×2)
      et recalcule côté client
    - Aucune occurrence `v1/history` dans `frontend/src/`
- **Problème** : agrégations refaites client-side (charge réseau inutile) ; les données serveur `byCategory`,
  `topBorrowers`, `mostLoanedItems` ne sont jamais exploitées → travail backend non consommé.
- **Action recommandée** : migrer `LenderStats` vers `GET /v1/history/statistics`.
- **Statut** : ✅ Livré le 28/10/2026 (FEAT-07, doc 16) : écran Historique (filtre par statut + pagination) consommant
  `/v1/history/*`, point d'entrée dans le Profil. Reste à vérifier sur device contre l'API prod.

### CORR-09 — BullMQ annoncé mais jamais implémenté

- **Gravité** : 🟡 Mineur
- **Périmètre** : Back (Esdras)
- **Effort** : dette documentaire (ou intégration si lié à CORR-01)
- **Fichier(s) & preuve** :
    - `backend/src/redis/redis.module.ts:9` → commentaire « Sprint 4 : BullMQ queue de rappels »
    - `backend/src/redis/redis.service.ts:12` → « Sera réutilisé au Sprint 4 pour BullMQ »
    - `backend/package.json` → aucune dépendance `bullmq` / `@nestjs/bullmq`
- **Problème** : Redis est présent (blacklist JWT) mais BullMQ n'a jamais été intégré ; les commentaires créent une
  fausse impression de roadmap.
- **Action recommandée** : soit implémenter BullMQ (si la correction de CORR-01 passe par là), soit nettoyer les
  commentaires trompeurs.
- **Statut** : ☐ À faire

### CORR-10 — Pas de `coverageThreshold` configuré

- **Gravité** : 🟡 Mineur
- **Périmètre** : Back (+ Front)
- **Effort** : 30 min
- **Fichier(s) & preuve** : aucune clé `coverageThreshold` dans la config Jest (backend & frontend)
- **Problème** : les cibles documentaires (Domain 95 / Services 90 / Controllers 70) ne sont **pas enforced** → une
  régression de couverture ne casse pas la CI.
- **Action recommandée** : ajouter `coverageThreshold` dans la config Jest des deux côtés (après mesure du coverage réel
  actuel).
- **Statut** : ☐ À faire

### CORR-11 — `docs/CLAUDE.md` tableau Avancement périmé

- **Gravité** : 🟡 Mineur
- **Périmètre** : Doc
- **Effort** : 10 min
- **Fichier(s) & preuve** : `docs/CLAUDE.md` section « Avancement » → marque Sprints 4.6 / 5 / 6 comme « — » (non faits)
  alors qu'ils sont mergés.
- **Action recommandée** : mettre à jour le tableau d'avancement pour refléter la phase preprod réelle.
- **Statut** : ☐ À faire

### CORR-12 — DNS custom `api.return.app` absent

- **Gravité** : 🟡 Mineur (Info)
- **Périmètre** : Info / Back (Esdras)
- **Effort** : avant prod publique
- **Fichier(s) & preuve** : URL de prod = `return-api.fly.dev` (front + back), pas de domaine custom.
- **Problème** : normal en preprod ; le plan général prévoit `api.return.app` + SSL pour le MVP prod.
- **Action recommandée** : configurer DNS + certificat custom avant la mise en production publique (non bloquant en
  preprod).
- **Statut** : ☐ À faire

### CORR-14 — Écrans Sprint 6 (Dashboard/History/Statistics) retirés — Epic 4 partiellement non exposé

- **Gravité** : 🟡 Décision produit (pas un bug)
- **Périmètre** : Front (Ismael) + décision produit (avec Esdras)
- **Effort** : 0 (assumer) / 2-4j (re-livrer)
- **Fichier(s) & preuve** :
    - `frontend/src/screens/` → pas de dossier `dashboard/`, `history/`, `statistics/` (vérifié)
    - Aucune occurrence de `DashboardScreen`/`HistoryScreen`/`StatisticsScreen`/`HistoryStore` (ajoutés au commit
      `7aa1d17`, puis retirés — commit `e4e1358` « remove History tab — redundant with existing screens »)
    - Stats réduites à `LenderStats` (profil) + `BorrowerStatsBadge` (détail emprunteur)
- **Problème** : refactor assumé (écrans jugés redondants), donc **pas un oubli**. Mais la Bible **Epic 4 (Historique)**
  demande des statistiques « objet le plus prêté / meilleur emprunteur » + une vue historique, non exposées dans la
  version allégée. Les endpoints backend `/v1/history/statistics` (`topBorrowers`, `mostLoanedItems`, `byCategory`)
  restent **orphelins** (lié à CORR-08).
- **Action recommandée** : décision binôme → soit **assumer** la version allégée et acter l'écart vs Bible Epic 4 (
  mettre la Bible/roadmap à jour), soit **re-livrer** un écran Historique/Statistiques consommant `/v1/history/*`.
- **Statut** : ◐ Partiel (historique livré, dashboard post-échéance) — écran Historique livré par FEAT-07 (28/10/2026) ;
  Dashboard dédié (graphiques `byCategory`, `topBorrowers`, `mostLoanedItems`) sorti du périmètre, cf. doc 16.

---

## Ordre d'exécution conseillé

> ⚠️ **Faire les 🔴 + quick-wins 🟠 AVANT tout retest sur téléphone.** Sans eux, le test terrain est faussé : pas de
> rappels automatiques (CORR-01), pas de push sur l'APK (CORR-03/04/05), photos perdues au moindre redeploy (CORR-02).

1. **Avant le retest terrain (déblocage)**
    - `Back` — **CORR-01** (`min_machines_running = 1`) → débloque rappels / auto-confirm / expiration
    - `Front+Back` — **CORR-13** (token push Expo↔FCM) → **sans ça, aucun push ne part**, même avec CORR-03/04/05
    - `Front` — **CORR-03** + **CORR-04** (push build EAS) → rebuild APK
    - `Back` — **CORR-05** (secrets Firebase + CORS) → push réellement émis
    - `Back` — **CORR-02** (R2) → photos persistantes (sinon le test photo est trompeur)
2. **Retest terrain** (parcours complet inscription → contact → invitation → prêt → notification →
   confirmation/contestation → rendu)
3. **Post-retest — polish & dette**
    - `Front` — **CORR-06** (décision MONEY), **CORR-07** (rappels dans l'UI), **CORR-08** (migration History/Stats)
    - `Back` — **CORR-09** (BullMQ/nettoyage), **CORR-10** (coverageThreshold)
    - `Doc` — **CORR-11** (mettre `docs/CLAUDE.md` à jour)
4. **Avant prod publique** — **CORR-12** (DNS custom + SSL)

---

## Décisions « post-échéance » (état au 28/10/2026, détail dans `16_ROADMAP_FEATURES.md`)

Sortis du périmètre du sprint 26→29/10/2026 :

- **CORR-14 (reste)** : Dashboard dédié (graphiques, `byCategory`, `topBorrowers`, `mostLoanedItems`) et filtres
  historique par date / emprunteur.
- **CORR-06** (type MONEY orphelin) : décision produit requise, non investiguée.
- **CORR-09** (BullMQ / migration des CRON) : d'ici là, **1 seule machine Fly**.
- **CORR-12** (DNS `api.return.app`) : avant la prod publique.
- **Prolonger un prêt déjà en retard** : bloqué par le 409 `loan-return-date-locked` de FEAT-11, et la machine à états
  n'a pas de transition `AWAITING_RETURN` → `ACTIVE`.
- **Historique** : tri par date de clôture plutôt que de création ; pagination par curseur ou avec un tri secondaire.
- CORR-02/05/10 : cochés par leur porteur de feature (FEAT-01/02/09), non traités ici.

---

*Document généré à partir de l'audit du 20/06/2026 — à confronter au retest terrain de l'application.*
