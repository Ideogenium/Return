# 14_ROADMAP_PUSH_EXPO.md

**Return ↺ — Roadmap Push Notifications · Option B : Expo Push Service**

> **Date** : 24 juin 2026
> **Décision** : CORR-13 tranché — **Option B actée** (Expo Push Service, abandon de Firebase Admin direct)
> **Phase** : Pré-production — backend déployé sur Fly.io (`return-api.fly.dev`), frontend branché dessus
> **Périmètre** : **Front** = Ismael · **Back** = Ozias · **Credentials** = natismael (owner Apple/EAS)
> **Référence** : `11_CORRECTIFS_PREPROD.md` (CORR-01→CORR-14, audit du 20/06/2026) — ce document implémente CORR-13

---

### Décision technique (CORR-13 — Option B)

Le front récupère un `ExpoPushToken` (`ExponentPushToken[...]`), le back envoie via `expo-server-sdk` vers l'API
`exp.host`, qui relaie vers **FCM (Android)** et **APNs (iOS)**. Objectif : push opérationnels iOS ET Android pour le
re-test terrain.

**Contrat API `POST/DELETE /notifications/device-token` : INCHANGÉ.**
Aucune migration de données — les tokens en base sont déjà des `ExpoPushToken`.

---

### Légende gravité

| Symbole | Niveau   | Définition                                                            |
|---------|----------|-----------------------------------------------------------------------|
| 🔴      | Critique | Bloque la réception de push sur device — sans ça, rien ne fonctionne  |
| 🟠      | Majeur   | Impact notable sur la fiabilité ou l'UX push, à traiter avant le test |
| 🟡      | Mineur   | Amélioration ou robustesse, différable (POST-MVP)                     |

---

## Tableau récapitulatif

| ID      | Titre                                                         | Resp.     | Effort | Dépend de                 | Statut |
|---------|---------------------------------------------------------------|-----------|--------|---------------------------|--------|
| PUSH-P1 | Créer et uploader la clé APNs (iOS)                           | natismael | 20 min | —                         | ✅ (FEAT-03, 31/10) |
| PUSH-P2 | Uploader le compte de service FCM V1 (Android)                | natismael | 15 min | —                         | ✅ (push reçu sur le build production Play, piste interne, 28/10) |
| PUSH-F1 | Ajouter `projectId` à `getExpoPushTokenAsync`                 | Ismael    | 15 min | —                         | ✅     |
| PUSH-F2 | Déclarer `expo-notifications` dans `app.json > plugins`       | Ismael    | 5 min  | —                         | ✅     |
| PUSH-F3 | Canal Android `setNotificationChannelAsync`                   | Ismael    | 20 min | PUSH-F1                   | ✅     |
| PUSH-F4 | Listeners de tap + navigation vers `LoanDetailScreen`         | Ismael    | 1h     | PUSH-F1, PUSH-F2          | ✅     |
| PUSH-F5 | Rebuild EAS preview (Android + iOS)                           | Ismael    | 30 min | PUSH-F1, PUSH-F2, PUSH-F3 | ✅ iOS (FEAT-03) · Android (FEAT-05, piste interne Play ; tap sur notif → bon prêt à vérifier, ACC-E5) |
| PUSH-B1 | Installer `expo-server-sdk`, retirer `firebase-admin`         | Ozias     | 10 min | —                         | ✅ Fait |
| PUSH-B2 | Réécrire `firebase.service.ts` avec `expo-server-sdk`         | Ozias     | 1h30   | PUSH-B1                   | ✅ Fait |
| PUSH-B3 | Vérifier compat `isAvailable()` — `notifications.service.ts`  | Ozias     | 15 min | PUSH-B2                   | ✅ Fait |
| PUSH-B4 | Réécrire les specs back (`firebase.service.spec.ts` + notifs) | Ozias     | 1h     | PUSH-B2                   | ✅ Fait |
| PUSH-B5 | Secrets Fly : set `EXPO_ACCESS_TOKEN`, unset Firebase         | Ozias     | 10 min | PUSH-B1                   | ◑ Firebase absent ✅ · `EXPO_ACCESS_TOKEN` stagé (effectif au déploiement D2) |
| PUSH-B6 | Receipts Phase 2 : CRON + migration Prisma (POST-MVP)         | Ozias     | +2h    | PUSH-B2, PUSH-B5          | ⏸ POST-MVP |

> **Suivi iOS** (31/10/2026, FEAT-03) — la clé APNs a été générée et est stockée par EAS au premier build iOS
> `production` (pas de `.p8` manuel). Builds iOS 1.0.0 (1), (2) et (3) envoyés sur TestFlight. Le 31/10, avec le
> build (2) installé via TestFlight sur un iPhone physique, une contestation de prêt a déclenché un push reçu, et le
> tap a ouvert le bon prêt. Reste : un testeur iOS autre qu'Ozias, et le volet Android (FEAT-05).
>
> **Suivi back** (31/10/2026) — PUSH-B1→B4 vérifiés dans le code (`backend/src/firebase/firebase.service.ts`, commit
> `b3a7cc8`). PUSH-B5 : aucun secret Firebase sur Fly (vérifié par `fly secrets list`, noms uniquement) ;
> `EXPO_ACCESS_TOKEN` posé en `--stage`, il s'appliquera au déploiement D2.

> **Suivi front** (24/06/2026) — PUSH-F1/F2/F3/F4 livrés et testés (20 tests front ajoutés, suite verte 259/259), commits `6d6c799` (F1-F3) + `8e2b287` (F4). Reste front : **PUSH-F5** (rebuild EAS preview Android + iOS), bloqué par les credentials **PUSH-P1/P2** (natismael).

---

## A. Prérequis credentials — responsable : natismael

> Ces deux tâches débloquent les tests sur device standalone (build EAS). Sans elles, les push iOS et Android
> ne peuvent pas être validés hors Expo Go.

---

### PUSH-P1 — Clé APNs (iOS)

- **Gravité** : 🔴 Critique pour iOS standalone
- **Responsable** : natismael (owner compte Apple Developer)
- **Effort** : 20 min
- **Dépendances** : aucune
- **Fichier(s) concerné(s)** :
    - Portail Apple Developer (developer.apple.com > Keys)
    - `eas credentials` (iOS > Production > Push Notifications Key)
- **Description** : créer une clé `.p8` APNs sur le portail Apple Developer, puis l'uploader dans EAS via
  `cd frontend && eas credentials` (iOS > Production > Push Notifications Key). Sans cette clé, **aucun push iOS**
  n'est possible en build standalone.
- **Critères d'acceptation** :
    - [x] Clé APNs créée sur le compte Apple Developer — générée par EAS au premier build iOS (31/10 : push reçu)
    - [x] Clé référencée dans EAS (stockée par EAS, utilisée par les builds iOS 1→3)
    - [x] Le build iOS inclut les entitlements APNs (push reçu sur iPhone physique, build 1.0.0 (2))

---

### PUSH-P2 — Compte de service FCM V1 (Android)

- **Gravité** : 🔴 Critique pour Android standalone
- **Responsable** : natismael (owner projet Firebase)
- **Effort** : 15 min
- **Dépendances** : aucune
- **Fichier(s) concerné(s)** :
    - Console Firebase (projet Return > Paramètres du projet > Comptes de service)
    - `eas credentials` (Android > FCM V1 Service Account Key)
- **Description** : récupérer le fichier `google-services.json` (ou la clé de compte de service FCM V1) depuis la
  console Firebase du projet Return, puis l'uploader via `eas credentials` (Android > FCM V1 Service Account Key).
  Il s'agit d'un **credential EAS** — ce n'est pas un secret Fly.io et ce n'est pas `firebase-admin`.
- **Critères d'acceptation** :
    - [x] Fichier `google-services.json` / clé FCM V1 récupéré depuis la console Firebase
    - [x] Credential uploadé dans EAS (`eas credentials` confirme la présence côté Android)
    - [x] Le build Android suivant (PUSH-F5) intègre la configuration FCM (push reçu sur le build production, 28/10)

---

## B. Front — responsable : Ismael

> Total code front estimé à **≈ 1h30** (hors temps de build EAS).
> Le store `useNotificationStore` et le contrat API `POST/DELETE /notifications/device-token` ne changent pas.

---

### PUSH-F1 — Ajouter `projectId` à `getExpoPushTokenAsync` (couvre CORR-04)

- **Gravité** : 🔴 Critique
- **Responsable** : Ismael
- **Effort** : 15 min
- **Dépendances** : aucune
- **Fichier(s) concerné(s)** :
    - `frontend/src/services/pushNotifications.ts:21` — appel `getExpoPushTokenAsync`
    - `frontend/app.json` ou `frontend/app.config.ts` — section `extra.eas.projectId`
    - `expo-constants` (dépendance directe à ajouter si absente)
- **Description** : passer `{ experienceId, projectId }` à `getExpoPushTokenAsync`. Lire le `projectId` depuis
  `Constants.expoConfig?.extra?.eas?.projectId` (valeur : `595176ea-3595-4aec-8ba5-b56da4f48a67`). Vérifier si
  `expo-constants` est une dépendance directe du `package.json` frontend — l'ajouter si elle est absente ou seulement
  transitive.
- **Critères d'acceptation** :
    - [x] `projectId` passé explicitement à `getExpoPushTokenAsync`
    - [x] `expo-constants` présent dans `frontend/package.json` (dépendance directe)
    - [x] Le token retourné commence bien par `ExponentPushToken[` (vérifié indirectement : push Expo reçu sur iPhone le 31/10)

---

### PUSH-F2 — Déclarer `expo-notifications` dans `app.json > plugins` (couvre CORR-03)

- **Gravité** : 🔴 Critique
- **Responsable** : Ismael
- **Effort** : 5 min (+ rebuild EAS obligatoire — voir PUSH-F5)
- **Dépendances** : aucune (mais déclenche PUSH-F5)
- **Fichier(s) concerné(s)** :
    - `frontend/app.json` (section `expo.plugins`) — actuellement `["expo-localization"]` uniquement
- **Description** : ajouter `"expo-notifications"` au tableau `plugins` dans `app.json`. Sans cette déclaration,
  les entitlements push sont absents du build natif et la demande de permission ne fonctionne pas sur device
  standalone.
- **Critères d'acceptation** :
    - [x] `"expo-notifications"` présent dans `expo.plugins` de `app.json`
    - [ ] Le build EAS suivant (PUSH-F5) inclut les entitlements push natifs (iOS: `aps-environment`, Android: FCM)

---

### PUSH-F3 — Canal Android `setNotificationChannelAsync`

- **Gravité** : 🟠 Majeur
- **Responsable** : Ismael
- **Effort** : 20 min
- **Dépendances** : PUSH-F1
- **Fichier(s) concerné(s)** :
    - `frontend/src/services/pushNotifications.ts` — avant l'appel à `getExpoPushTokenAsync`
- **Description** : sur Android 8+, les notifications exigent un canal défini. Appeler
  `Notifications.setNotificationChannelAsync('default', { name: 'Default', importance: Notifications.AndroidImportance.MAX, ... })`
  **avant** `getExpoPushTokenAsync`, sous un guard `Platform.OS === 'android'`. L'identifiant `"default"` doit
  correspondre au `channelId` envoyé par le back dans le payload push (PUSH-B2).
- **Critères d'acceptation** :
    - [x] `setNotificationChannelAsync('default', ...)` appelé avant `getExpoPushTokenAsync` dans le service push
    - [x] Guard `Platform.OS === 'android'` en place (pas d'appel inutile sur iOS)
    - [x] L'identifiant du canal est `"default"` (cohérent avec le `channelId` back)
    - [x] Aucune régression sur iOS (le code iOS est inchangé)

---

### PUSH-F4 — Listeners de tap + navigation vers `LoanDetailScreen`

- **Gravité** : 🟠 Majeur (non bloquant pour la réception, bloquant pour l'utilité du tap)
- **Responsable** : Ismael
- **Effort** : 1h
- **Dépendances** : PUSH-F1, PUSH-F2
- **Fichier(s) concerné(s)** :
    - `frontend/src/navigation/RootNavigator.tsx` — ajout des listeners
- **Description** : brancher deux listeners dans `RootNavigator` :
    1. `addNotificationResponseReceivedListener` — déclenché quand l'utilisateur tape une notification (app ouverte ou
       en arrière-plan)
    2. `getLastNotificationResponseAsync()` — cas app killed (lecture au montage du composant)

  Dans les deux cas : lire `data.loanId` dans le payload et naviguer vers `LoanDetailScreen` via le navigateur.
- **Critères d'acceptation** :
    - [x] `addNotificationResponseReceivedListener` enregistré dans `RootNavigator` (et nettoyé au démontage)
    - [x] `getLastNotificationResponseAsync()` appelé au montage pour gérer le cas app killed
    - [x] Un tap sur une notification push navigue vers `LoanDetailScreen` avec le bon `loanId`
    - [x] Pas de crash si `data.loanId` est absent du payload

---

### PUSH-F5 — Rebuild EAS preview (Android + iOS)

- **Gravité** : 🔴 Critique pour les tests sur device
- **Responsable** : Ismael
- **Effort** : 30 min (temps de build EAS : 15-30 min selon la file)
- **Dépendances** : PUSH-F1, PUSH-F2, PUSH-F3 (PUSH-F4 peut suivre dans un build ultérieur)
- **Description** : lancer un build EAS preview pour les deux plateformes après application de PUSH-F1, PUSH-F2 et
  PUSH-F3. Ce build intègre les entitlements natifs push (APNs iOS, FCM Android) et installe le canal Android. Sans
  ce rebuild, les corrections F1/F2/F3 sont sans effet sur les builds existants.
- **Critères d'acceptation** :
    - [x] Build EAS Android déclenché et terminé sans erreur (profil `production` au lieu de `preview` — FEAT-05, AAB versionCode 1 puis 2)
    - [x] Build EAS iOS déclenché et terminé sans erreur (profil `production` au lieu de `preview` — FEAT-03, builds 1→3)
    - [x] Les builds incorporent bien les plugins `expo-notifications` (preuve indirecte : push reçu sur les builds Android et iOS)
    - [ ] L'APK/IPA installé sur device demande bien la permission de notifications au premier lancement (non vérifié explicitement)

---

## C. Back — responsable : Ozias

> Total back (sans PUSH-B6) estimé à **≈ 3h**.
> Les signatures publiques de `firebase.service.ts` (`isAvailable()` et `sendToMultipleTokens(): string[]`) sont
> conservées pour ne pas modifier `notifications.service.ts`.

---

### PUSH-B1 — Installer `expo-server-sdk`, retirer `firebase-admin`

- **Gravité** : 🔴 Critique
- **Responsable** : Ozias
- **Effort** : 10 min
- **Dépendances** : aucune
- **Fichier(s) concerné(s)** :
    - `backend/package.json`
- **Description** : `npm install expo-server-sdk` + retirer `firebase-admin` du `package.json` backend. Vérifier
  qu'aucun autre module n'importe directement `firebase-admin` hors `firebase.service.ts`.
- **Critères d'acceptation** :
    - [x] `expo-server-sdk` présent dans les dépendances backend
    - [x] `firebase-admin` absent de `package.json` et de `node_modules`
    - [x] `npm ci` passe sans erreur
    - [x] Aucun import résiduel de `firebase-admin` dans la base de code backend

---

### PUSH-B2 — Réécrire `firebase.service.ts` avec `expo-server-sdk`

- **Gravité** : 🔴 Critique
- **Responsable** : Ozias
- **Effort** : 1h30
- **Dépendances** : PUSH-B1
- **Fichier(s) concerné(s)** :
    - `backend/src/firebase/firebase.service.ts` — réécriture complète
- **Description** : remplacer l'implémentation FCM par `expo-server-sdk` :
    1. Instancier `new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN })` (accessToken optionnel, lève le rate-limit)
    2. Valider chaque token via `Expo.isExpoPushToken(token)` avant envoi
    3. Construire les messages :
       `{ to, title, body, data, sound: 'default', badge, channelId: 'default', priority: 'high' }`
    4. Chunker via `expo.chunkPushNotifications(messages)`
    5. Envoyer via `expo.sendPushNotificationsAsync(chunk)` pour chaque chunk
    6. Purger les tokens morts en erreur immédiate : `ticket.status === 'error'` ET
       `ticket.details.error === 'DeviceNotRegistered'`

  **Conserver impérativement les signatures publiques** :
    - `isAvailable(): boolean`
    - `sendToMultipleTokens(tokens: string[], title: string, body: string, data?: Record<string, string>): Promise<string[]>` (retourne les tokens **invalides**, à purger par l'appelant)

  Ces signatures sont consommées par `notifications.service.ts:188/201` qui reste inchangé.
- **Critères d'acceptation** :
    - [x] `firebase.service.ts` n'importe plus aucun module `firebase-admin`
    - [x] `Expo.isExpoPushToken(token)` appelé avant l'envoi (tokens invalides filtrés)
    - [x] Messages construits avec `channelId: 'default'` et `priority: 'high'`
    - [x] Chunking via `chunkPushNotifications` en place (gestion des gros volumes)
    - [x] Purge des `DeviceNotRegistered` implémentée sur les tickets en erreur immédiate
    - [x] Signatures `isAvailable()` et `sendToMultipleTokens()` inchangées (contrat vers `notifications.service.ts`)
    - [x] `notifications.service.ts` ne nécessite aucune modification

---

### PUSH-B3 — Vérifier compat `isAvailable()` — `notifications.service.ts`

- **Gravité** : 🟠 Majeur
- **Responsable** : Ozias
- **Effort** : 15 min
- **Dépendances** : PUSH-B2
- **Fichier(s) concerné(s)** :
    - `backend/src/firebase/firebase.service.ts` — méthode `isAvailable()`
    - `backend/src/notifications/notifications.service.ts:188, 201` — appelants
- **Description** : avec `expo-server-sdk`, le client Expo peut être instancié sans credentials obligatoires —
  `isAvailable()` doit donc retourner **toujours `true`** (contrairement à l'ancienne implémentation Firebase qui
  nécessitait `FIREBASE_SERVICE_ACCOUNT_BASE64`). Vérifier que les guards `if (this.isAvailable())` dans
  `notifications.service.ts:188/201` se comportent bien.
- **Critères d'acceptation** :
    - [x] `isAvailable()` retourne `true` même si `EXPO_ACCESS_TOKEN` est absent (non bloquant)
    - [x] Les chemins `if (!this.isAvailable())` dans `notifications.service.ts` ne sont plus empruntés inutilement
    - [x] Tests de `notifications.service.ts` passent sans modification du service lui-même

---

### PUSH-B4 — Réécrire les specs back

- **Gravité** : 🟠 Majeur
- **Responsable** : Ozias
- **Effort** : 1h
- **Dépendances** : PUSH-B2
- **Fichier(s) concerné(s)** :
    - `backend/src/firebase/firebase.service.spec.ts` — 9 tests à réécrire (mocker `expo-server-sdk`)
    - `backend/src/notifications/notifications.service.spec.ts` — 10 tests à ajuster (fixtures tokens)
- **Description** :
    - `firebase.service.spec.ts` : mocker `expo-server-sdk` (`Expo`, `chunkPushNotifications`,
      `sendPushNotificationsAsync`).
      Couvrir : envoi nominal, token invalide filtré, purge `DeviceNotRegistered`, chunking multi-tokens,
      `isAvailable()` vrai.
    - `notifications.service.spec.ts` : remplacer toutes les fixtures de tokens fictifs par le format
      `ExponentPushToken[XXXXXXXX]` pour correspondre à la réalité Expo.
- **Critères d'acceptation** :
    - [x] `firebase.service.spec.ts` : 9 tests passent (aucun import de `firebase-admin`) — 10 au 31/10
    - [x] `notifications.service.spec.ts` : 10 tests passent avec fixtures `ExponentPushToken[...]` — 17 au 31/10
    - [x] `npm run test` backend global vert (pas de régression sur les autres specs)

---

### PUSH-B5 — Secrets Fly : `EXPO_ACCESS_TOKEN`, purge Firebase

- **Gravité** : 🟠 Majeur
- **Responsable** : Ozias
- **Effort** : 10 min
- **Dépendances** : PUSH-B1
- **Fichier(s) concerné(s)** :
    - Fly.io secrets (`fly secrets set / unset`)
    - `11_CORRECTIFS_PREPROD.md` — entrée CORR-05 (log Firebase disabled)
- **Description** :
    1. `fly secrets set EXPO_ACCESS_TOKEN=<token>` — lève le rate-limit (~1000 notifs/h sans ce token). Recommandé
       mais non bloquant pour les tests terrain.
    2. `fly secrets unset FIREBASE_SERVICE_ACCOUNT_BASE64` — purge de l'ancien secret Firebase.
    3. Mettre à jour le commentaire/log CORR-05 dans `11_CORRECTIFS_PREPROD.md` : libellé `« FIREBASE... disabled »`
       à remplacer par `« EXPO_ACCESS_TOKEN configured »`.
- **Critères d'acceptation** :
    - [ ] `EXPO_ACCESS_TOKEN` défini comme secret Fly (ou documenté comme délibérément absent pour les tests) — posé
      en `--stage` le 26/10 (robot Expo, rôle Viewer), effectif au déploiement D2
    - [x] `FIREBASE_SERVICE_ACCOUNT_BASE64` supprimé des secrets Fly (absent de `fly secrets list` au 31/10)
    - [x] CORR-05 mis à jour dans `11_CORRECTIFS_PREPROD.md`
    - [ ] `fly deploy` redémarre sans erreur liée aux variables d'environnement — après le déploiement D2

---

### PUSH-B6 — Receipts Phase 2 : CRON + migration Prisma — POST-MVP

- **Gravité** : 🟡 Mineur — délibérément différé
- **Responsable** : Ozias
- **Effort** : +2h
- **Dépendances** : PUSH-B2, PUSH-B5
- **Fichier(s) concerné(s)** :
    - `backend/prisma/schema.prisma` — ajout de champs `expoTicketId`, `expoTicketSentAt` sur `DeviceToken`
    - Nouveau CRON horaire (module Reminders ou module dédié)
- **Description** : implémentation de la Phase 2 des receipts Expo (vérification différée) :
    1. Migration Prisma : ajouter `expoTicketId` et `expoTicketSentAt` sur l'entité `DeviceToken`
    2. CRON horaire : interroger `expo.getPushNotificationReceiptsAsync(ticketIds)`, purger les tokens avec
       `DeviceNotRegistered` détectés après ~30 min (délai recommandé par Expo)

  Les erreurs immédiates `DeviceNotRegistered` traitées en Phase 1 (PUSH-B2) suffisent pour le MVP.
  Ce ticket est différé jusqu'à la phase post-MVP.
- **Critères d'acceptation** :
    - [ ] Migration Prisma ajoutant `expoTicketId` + `expoTicketSentAt` sur `DeviceToken`
    - [ ] CRON horaire interrogeant les receipts Expo
    - [ ] Purge des tokens `DeviceNotRegistered` détectés via receipts
    - [ ] Tests unitaires couvrant le CRON receipts

---

## D. Ordre d'exécution — chemin critique

Les trois chantiers se déroulent **en parallèle** et convergent sur le test e2e terrain.

### Chantier credentials (natismael)

```
PUSH-P1 (APNs iOS)    ─┐
                        ├─ → débloque tests standalone
PUSH-P2 (FCM Android) ─┘
```

### Chantier front (Ismael)

```
PUSH-F1 (projectId) ─┬─ PUSH-F3 (canal Android) ─┐
PUSH-F2 (plugins)   ─┘                             ├─ PUSH-F5 (rebuild EAS) → réception device
                      └─ PUSH-F4 (listeners tap) ──┘  (F4 peut suivre dans un build ultérieur)
```

### Chantier back (Ozias)

```
PUSH-B1 (install SDK) ─┬─ PUSH-B2 (réécriture service) ─┬─ PUSH-B3 (compat isAvailable) ─┐
                       └─ PUSH-B5 (secrets Fly)          └─ PUSH-B4 (specs)               ├─ envoi backend OK
                                                                                            └─ (PUSH-B6 POST-MVP)
```

### Test e2e terrain

Le test complet (envoi + réception) nécessite les **3 chantiers terminés** (PUSH-P1/P2 + PUSH-F5 + PUSH-B2/B5).

**Test partiel possible sans attendre le rebuild front** : Ozias peut valider l'envoi backend via un appel `curl`
direct vers `https://exp.host/--/api/v2/push/send` avec un `ExponentPushToken` récupéré depuis Expo Go — sans aucun
build natif.

---

## E. Critères d'acceptation — validation e2e terrain

| # | Critère                                                                                           | Vérifié par        |
|---|---------------------------------------------------------------------------------------------------|--------------------|
| 1 | Specs back vertes après réécriture (`firebase.service.spec.ts` + `notifications.service.spec.ts`) | Ozias              |
| 2 | Token `ExponentPushToken[...]` visible en base après login sur device                             | Ismael + Ozias     |
| 3 | Event `LOAN_CREATED` → push reçu par le borrower sur **Android ET iOS** (standalone)              | Les deux en binôme |
| 4 | CRON reminder → push reçu lender + borrower (nécessite **CORR-01** `min_machines_running=1`)      | Ozias              |
| 5 | Logout → `DELETE /notifications/device-token` → token purgé en base → plus aucun push reçu        | Les deux en binôme |

---

## F. Risques

| Risque                                                  | Probabilité | Impact      | Atténuation                                                             |
|---------------------------------------------------------|-------------|-------------|-------------------------------------------------------------------------|
| Relais Expo indisponible                                | Faible      | 🟠 Majeur   | Fallback : notif in-app via polling 30s déjà en place                   |
| Rate-limit ~1000 notifs/h sans `EXPO_ACCESS_TOKEN`      | Faible      | 🟡 Mineur   | OK pour le test terrain — lever le rate-limit via PUSH-B5               |
| Tokens morts non détectés (receipts différés — PUSH-B6) | Moyen       | 🟡 Mineur   | Erreurs Phase 1 (PUSH-B2) détectent les `DeviceNotRegistered` immédiats |
| Latence APNs en background iOS (throttling iOS 15+)     | Moyen       | 🟡 Mineur   | Comportement Apple normal — non actionnable                             |
| Credentials natismael manquants au moment du rebuild    | Moyen       | 🔴 Critique | Démarrer PUSH-P1/P2 en parallèle dès que possible                       |

---

*Document produit le 24/06/2026 — à mettre à jour après chaque tâche PUSH-* appliquée (passer le statut ☐ à ✅ Fait).*
