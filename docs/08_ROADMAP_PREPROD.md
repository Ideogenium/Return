# 08_ROADMAP_PREPROD.md

**Return - Roadmap de mise en place Pré-production (Test sur téléphone réel)**

**Version** : 1.0
**Co-validé par** : Esdras GBEDOZIN & Ismael AIHOU
**Date** : 20 mars 2026
**Prérequis** : Sprint 6 terminé

---

## État au 31/10/2026

| Phase | État | Écart avec le plan ci-dessous |
| ----- | ---- | ----------------------------- |
| 1 — Backend Fly.io | ✅ Faite | App `return-api` (région `cdg`), Postgres `return-db` **non managé** (sauvegardes à notre charge). `CORS_ORIGIN=*` du PREPROD-006 est remplacé par une origine https exacte (voir « Exploitation Fly »). |
| 2 — Config frontend | ✅ Faite | URL de prod `https://return-api.fly.dev/v1` (surcharge `EXPO_PUBLIC_API_URL`), tous les modules à `false` dans `api-modules.config.ts`. Identifiant d'app `com.ideogen.returnapp` (et non `com.ideogen.return`, `return` étant un mot-clé Java). |
| 3/4 — APK et tests | ✅ Faites (re-test terrain en cours) | — |
| 5 — Play test interne | ✅ Piste interne active (FEAT-05, AAB importé puis `eas submit` auto validé le 29/10) | Voir `15_SETUP_COMPTES_DISTRIBUTION.md`. |
| 5b — iOS TestFlight | ✅ Faite (FEAT-03) | Profil EAS `production` (pas `preview`), build dans le cloud EAS (aucun Mac requis), bundle `com.ideogen.returnapp`. Builds 1.0.0 (1)→(3) sur TestFlight. |
| 6 — Push réels | ✅ Remplacée par l'Expo Push Service (CORR-13) | Plus de Firebase Admin côté back ni de secret Firebase sur Fly : voir `14_ROADMAP_PUSH_EXPO.md`. Push reçu sur iPhone physique le 31/10. |

### Exploitation Fly — règles en vigueur

- **Jamais plus d'une machine** pour `return-api` tant que les tâches planifiées tournent dans le process (CORR-09
  non fait) : avec deux machines, chaque rappel et chaque transition automatique partirait deux fois. Vérifier
  `fly status` / `fly machines list` après chaque déploiement (1 machine au 31/10/2026) ; ne jamais lancer
  `fly scale count` au-delà de 1, et déployer une app neuve avec `--ha=false` (Fly crée sinon 2 machines).
- `min_machines_running = 1` (CORR-01) : la machine ne s'endort pas, sinon les tâches planifiées ne tournent pas.
- Chaque tâche planifiée écrit une ligne `info` à chaque passage, même à vide (`Reminders tick`,
  `Pending-confirmation tick`, `Invitations tick`, puis `Overdue tick` avec FEAT-10) : vérifier leur présence dans
  `fly logs` après un déploiement.
- **Secrets** : les poser **avant** `fly deploy` (en `--stage` puis appliqués par le déploiement) ; l'API refuse de
  démarrer en production sans R2 ni `CORS_ORIGIN` valide.

| Variable | Où | Statut au 31/10/2026 |
| -------- | -- | -------------------- |
| `DATABASE_URL`, `JWT_ACCESS_SECRET`, `REDIS_URL` | secrets Fly | en place |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | secrets Fly | stagés (déploiement D2) |
| `EXPO_ACCESS_TOKEN` | secret Fly | stagé (déploiement D2) |
| `CORS_ORIGIN` | `fly.toml` (`https://return-api.fly.dev`) | ancien secret `*` retiré en `--stage` |
| `NODE_ENV`, `PORT`, `API_PREFIX`, `LOG_LEVEL` | `fly.toml` | en place |
| `UPLOAD_BASE_URL` | — | retiré (R2) |
| Firebase (`FIREBASE_*`) | — | absent (Expo Push) |

---

## Objectif

Déployer l'application Return sur un environnement accessible depuis internet pour permettre des tests sur téléphones
réels (Android) avant toute mise en production publique. Pas de publication sur le Play Store à ce stade — distribution
directe par APK.

---

## Architecture Cible

```
Téléphone (APK)  →  https://return-api.fly.dev/v1  →  Fly.io (backend NestJS)
                                                          ├── PostgreSQL (Fly Postgres)
                                                          └── Redis (Upstash / Fly Redis)
```

---

## Phase 1 : Déployer le Backend sur Fly.io

### Objectif

Rendre l'API backend accessible depuis internet avec base de données et Redis.

### Tâches

| ID              | Titre                                                                                                                                                                                        | Dépendance               | Critère de Fin                                    | Temps |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------- | ----- |
| **PREPROD-001** | Installer Fly CLI (`curl -L https://fly.io/install.sh \| sh`) + `fly auth login`                                                                                                             | -                        | CLI installée, authentifié                        | 5min  |
| **PREPROD-002** | Créer l'app Fly.io : `fly apps create return-api --org personal`                                                                                                                             | PREPROD-001              | App créée, visible dans le dashboard Fly.io       | 2min  |
| **PREPROD-003** | Créer `fly.toml` à la racine du backend : region `cdg` (Paris), healthcheck `/health`, internal port 3000, release_command `npx prisma migrate deploy`                                       | PREPROD-002              | Fichier `fly.toml` valide (`fly config validate`) | 15min |
| **PREPROD-004** | Provisionner PostgreSQL : `fly postgres create --name return-db --region cdg --vm-size shared-cpu-1x`                                                                                        | PREPROD-002              | Base créée, connection string disponible          | 5min  |
| **PREPROD-005** | Provisionner Redis : Upstash (gratuit, compatible Fly.io) ou `fly redis create`                                                                                                              | PREPROD-002              | Redis accessible, URL disponible                  | 5min  |
| **PREPROD-006** | Configurer les secrets Fly.io : `fly secrets set DATABASE_URL=... REDIS_URL=... JWT_ACCESS_SECRET=... JWT_REFRESH_SECRET=... CORS_ORIGIN=* NODE_ENV=production LOG_LEVEL=info API_PREFIX=v1` | PREPROD-004, PREPROD-005 | Secrets visibles dans `fly secrets list`          | 10min |
| **PREPROD-007** | Premier déploiement : `fly deploy` depuis le dossier backend                                                                                                                                 | PREPROD-006              | `fly status` → running, migrations appliquées     | 10min |
| **PREPROD-008** | Vérifier le health check : `curl https://return-api.fly.dev/health` → 200 OK                                                                                                                 | PREPROD-007              | Réponse HTTP 200                                  | 2min  |

> **Note** : Le Dockerfile de production (`backend/Dockerfile`) existe déjà (multi-stage, optimisé < 200 MB). Le
> `release_command` dans `fly.toml` exécute `prisma migrate deploy` avant chaque déploiement — pas besoin de le mettre
> dans le CMD comme en dev.

---

## Phase 2 : Configurer le Frontend pour la Pré-prod

### Objectif

Faire pointer l'application mobile vers le backend déployé au lieu de localhost.

### Tâches

| ID              | Titre                                                                                                                                                                                 | Dépendance  | Critère de Fin                                | Temps |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------- | ----- |
| **PREPROD-009** | Mettre à jour l'URL de production dans `frontend/src/config/api-modules.config.ts` : remplacer `https://api.return.app/v1` par `https://return-api.fly.dev/v1` (ou configurer le DNS) | PREPROD-008 | URL correcte dans le code                     | 2min  |
| **PREPROD-010** | Passer tous les modules en `false` dans `api-modules.config.ts` (reminders, history inclus) ou les laisser sur Prism selon l'état d'implémentation                                    | PREPROD-009 | Aucun appel vers localhost en mode production | 5min  |
| **PREPROD-011** | Configurer `app.json` : ajouter `android.package` (`com.ideogen.return`), vérifier `version`, `versionCode`                                                                           | -           | `app.json` valide                             | 5min  |

---

## Phase 3 : Builder l'APK Android

### Objectif

Générer un fichier APK installable sur n'importe quel téléphone Android sans passer par le Play Store.

### Option A — Build local avec EAS (recommandé)

| ID              | Titre                                                                                                                                             | Dépendance  | Critère de Fin        | Temps    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------- | -------- |
| **PREPROD-012** | Créer `frontend/eas.json` avec profil `preview` : `{ "build": { "preview": { "distribution": "internal", "android": { "buildType": "apk" } } } }` | PREPROD-011 | Fichier valide        | 10min    |
| **PREPROD-013** | Build APK en local : `cd frontend && eas build --platform android --profile preview --local`                                                      | PREPROD-012 | Fichier `.apk` généré | 15-30min |

**Prérequis** : Android SDK installé (via Android Studio ou standalone SDK). Si non disponible, utiliser l'option B.

### Option B — Build avec expo prebuild + Android Studio

| ID               | Titre                                                                                   | Dépendance   | Critère de Fin                                       | Temps    |
| ---------------- | --------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------- | -------- |
| **PREPROD-012b** | Générer le projet Android natif : `cd frontend && npx expo prebuild --platform android` | PREPROD-011  | Dossier `android/` généré                            | 5min     |
| **PREPROD-013b** | Ouvrir dans Android Studio → Build → Build Bundle(s) / APK(s) → Build APK(s)            | PREPROD-012b | Fichier `.apk` dans `android/app/build/outputs/apk/` | 15-30min |

---

## Phase 4 : Distribuer et Tester

### Objectif

Installer l'APK sur les téléphones des développeurs et valider le parcours complet.

### Tâches

| ID              | Titre                                                                                                                                                                  | Dépendance  | Critère de Fin                       | Temps    |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------ | -------- |
| **PREPROD-014** | Envoyer l'APK aux testeurs (Google Drive, Telegram, email)                                                                                                             | PREPROD-013 | APK reçu par les testeurs            | 5min     |
| **PREPROD-015** | Installer l'APK sur les téléphones (activer "Sources inconnues" dans les paramètres Android)                                                                           | PREPROD-014 | App installée et ouverte             | 5min     |
| **PREPROD-016** | Tester le parcours complet : inscription → connexion → ajouter contact → inviter → accepter → créer prêt → vérifier notification → confirmer/contester → marquer rendu | PREPROD-015 | Parcours validé sans erreur critique | 1h       |
| **PREPROD-017** | Documenter les bugs et anomalies trouvés dans un fichier `docs/PREPROD_BUGS.md` ou issues GitHub                                                                       | PREPROD-016 | Liste de bugs documentée             | 30min    |
| **PREPROD-018** | Itérer : corriger, rebuilder l'APK, retester                                                                                                                           | PREPROD-017 | Zéro bug bloquant                    | Variable |

---

## Phase 5 (Optionnelle) : Google Play Internal Testing

> À faire uniquement si vous souhaitez un canal de distribution plus propre (lien Play Store privé).

| ID              | Titre                                                                                                | Dépendance  | Critère de Fin                               | Temps |
| --------------- | ---------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------- | ----- |
| **PREPROD-019** | Créer un compte Google Play Console (25$ unique)                                                     | -           | Compte actif                                 | 10min |
| **PREPROD-020** | Créer l'application dans la console (nom, description, catégorie)                                    | PREPROD-019 | App créée dans la console                    | 15min |
| **PREPROD-021** | Builder un AAB au lieu d'un APK : modifier `eas.json` profil `preview` → `"buildType": "app-bundle"` | PREPROD-020 | Fichier `.aab` généré                        | 15min |
| **PREPROD-022** | Uploader l'AAB sur Internal Testing, ajouter emails des testeurs                                     | PREPROD-021 | Testeurs invités, lien d'installation généré | 15min |

---

## Phase 6 (Optionnelle) : Push Notifications Réelles (FCM)

> Sans Firebase, l'app fonctionne — les notifications sont consultables via le polling (badge rafraîchi toutes les 30s)
> et l'écran de notifications. Firebase ajoute le push en arrière-plan (notification même quand l'app est fermée).

| ID              | Titre                                                                                                  | Dépendance  | Critère de Fin                          | Temps |
| --------------- | ------------------------------------------------------------------------------------------------------ | ----------- | --------------------------------------- | ----- |
| **PREPROD-023** | Créer un projet Firebase (console Firebase)                                                            | -           | Projet créé                             | 10min |
| **PREPROD-024** | Ajouter l'app Android au projet Firebase, récupérer `google-services.json`                             | PREPROD-023 | Fichier dans `frontend/android/app/`    | 10min |
| **PREPROD-025** | Récupérer le service account Firebase (JSON) pour le backend                                           | PREPROD-023 | Service account dans les secrets Fly.io | 15min |
| **PREPROD-026** | Implémenter l'envoi FCM dans `NotificationsService` : envoyer un push FCM en plus de la création en DB | PREPROD-025 | Push reçu sur le téléphone (app fermée) | 2h    |

---

## Phase 5b (Optionnelle) : Distribution iOS via TestFlight

> Contrairement à Android (APK libre), iOS nécessite un compte Apple Developer (99$/an) et
> une signature obligatoire pour toute distribution, même interne.

| ID               | Titre                                                                                                 | Dépendance   | Critère de Fin                                   | Temps |
| ---------------- | ----------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------ | ----- |
| **PREPROD-023b** | Créer un compte Apple Developer (99$/an) si pas déjà fait                                             | -            | Compte actif, accès App Store Connect            | 10min |
| **PREPROD-024b** | Ajouter `ios.bundleIdentifier: "com.ideogen.return"` dans `app.json`                                  | -            | `app.json` valide                                | 2min  |
| **PREPROD-025b** | Créer `eas.json` profil iOS preview : `{ "build": { "preview": { "ios": { "simulator": false } } } }` | PREPROD-024b | Fichier valide                                   | 5min  |
| **PREPROD-026b** | Build iOS : `eas build --platform ios --profile preview` (nécessite un Mac)                           | PREPROD-025b | Build terminé, fichier `.ipa` disponible         | 30min |
| **PREPROD-027b** | Uploader le build sur TestFlight via App Store Connect                                                | PREPROD-026b | Build en traitement sur TestFlight               | 15min |
| **PREPROD-028b** | Ajouter les testeurs (emails) dans TestFlight, envoyer les invitations                                | PREPROD-027b | Testeurs invités, app installable via TestFlight | 10min |

> **Note** : Le `GoogleService-Info.plist` est déjà en place dans `frontend/ios/Return/`.
> Le framework `@react-native-firebase` devra être intégré côté frontend (partagé avec Android).

---

## Résumé des Coûts

| Service          | Coût                                           |
| ---------------- | ---------------------------------------------- |
| Fly.io (backend) | Gratuit (free tier : 3 shared VMs)             |
| Fly Postgres     | Gratuit (1 shared VM, 1 GB storage)            |
| Upstash Redis    | Gratuit (10 000 commandes/jour)                |
| Firebase         | Gratuit (FCM illimité)                         |
| Play Console     | 25$ une fois (optionnel, Phase 5 uniquement)   |
| Apple Developer  | 99$/an (requis pour Phase 5b — iOS/TestFlight) |

---

## Planning Estimé

| Phase                     | Durée    | Qui                                               |
| ------------------------- | -------- | ------------------------------------------------- |
| Phase 1 (Fly.io)          | 1h       | Backend dev (Esdras)                              |
| Phase 2 (Config frontend) | 15min    | Frontend dev (Ismael)                             |
| Phase 3 (Build APK)       | 30min-1h | Frontend dev (Ismael)                             |
| Phase 4 (Test)            | 1-2h     | Les deux                                          |
| Phase 5b (iOS TestFlight) | 1h       | Frontend dev (Ismael) — nécessite Apple Developer |
| **Total minimum**         | **~3h**  | -                                                 |
