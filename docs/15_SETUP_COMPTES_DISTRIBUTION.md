# 15_SETUP_COMPTES_DISTRIBUTION.md

**Return ↺ — Comptes développeur & distribution (Option B push)**

> **Date** : 25 juin 2026
> **Décision** : comptes Individual (Apple + Google) — distribution via TestFlight (iOS) + Play test interne (Android)
> **Périmètre** : **Ozias** = Apple Developer · **natismael** = Google Play Console + EAS owner · **Ismael** = profils EAS + builds + submit
> **Référence** : `docs/14_ROADMAP_PUSH_EXPO.md` (tâches PUSH-P1, PUSH-P2, PUSH-F5 — ce document est le compagnon "ops/comptes")

---

## Clarification : "push" vs "distribution"

Ces deux objectifs sont liés mais distincts. Le compte Apple Developer couvre les deux cas iOS à lui seul.

| Objectif | Android | iOS |
|---|---|---|
| **(A) Recevoir les push** (notifications sur device standalone) | Firebase — projet existant ✅ (extraire le compte de service FCM) | Compte Apple Developer (clé APNs .p8) |
| **(B) Install propre sans APK** (testeurs installent via store) | Google Play Console — piste "Test interne" | TestFlight (App Store Connect) |

---

## Tableau récapitulatif des tâches

| ID | Tâche | Resp. | Coût | Dépend de | Statut |
|---|---|---|---|---|---|
| ACC-A1 | Créer le compte Apple Developer (Individual) | Ozias | 99 $/an | — | ✅ |
| ACC-A2 | Créer + uploader la clé APNs .p8 (= PUSH-P1) | Ozias + natismael | — | ACC-A1 | ✅ (clé gérée par EAS) |
| ACC-A3 | Configurer TestFlight (testeurs internes) | Ozias | — | ACC-A1, build iOS | ✅ (Ozias seul testeur) |
| ACC-G1 | Extraire le compte de service FCM V1 du projet Firebase existant (= prérequis PUSH-P2) | natismael | gratuit | — | ✅ (doc 16 : « FCM EAS fait ») |
| ACC-G2 | Créer le compte Google Play Console (Individual) | natismael | 25 $ une fois | — | ✅ (doc 16 : « Play Console OK ») |
| ACC-G3 | Créer l'app "Return" + piste "Test interne" + liste testeurs | natismael | — | ACC-G2 | ✅ |
| ACC-E1 | Profil de distribution EAS dans `eas.json` (Android AAB / iOS store) | Ismael | — | — | ✅ (Android ✅ — iOS ✅) |
| ACC-E2 | Uploader credentials APNs + FCM dans EAS (`eas credentials`) (= PUSH-P1/P2) | Ismael + binôme | — | ACC-A2, ACC-G1 | ✅ |
| ACC-E3 | Builds EAS iOS + Android (= PUSH-F5) | Ismael | — | ACC-E1, ACC-E2 | ✅ (Android ✅ AAB v1.0.0, versionCode 1 — iOS ✅ builds 1→3) |
| ACC-E4 | `eas submit` → TestFlight + Play test interne | Ismael | — | ACC-E3, ACC-A3, ACC-G3 | ✅ (Android ✅ piste interne : 1er AAB importé manuellement, `eas submit` auto validé avec versionCode 2 le 29/10 — iOS ✅) |
| ACC-E5 | Test e2e : push reçu sur device iOS + Android (cf. `docs/14` § E) | Binôme | — | ACC-E4 | ◑ iOS ✅ (31/10) — Android ✅ push reçu (28/10 et 31/10) — tap → prêt non vérifié formellement |

---

## 🍎 Chantier Ozias — Apple Developer (Individual)

> **État au 31/10/2026 (FEAT-03)** — compte Apple Developer Individual actif (Team `WA935JW2DV`) sur l'Apple ID
> personnel d'Ozias (pas d'Apple ID dédié Ideogen). Le premier `eas build --platform ios --profile production` a
> généré et stocké dans EAS le certificat de distribution, le profil de provisionnement et la clé APNs ; `eas submit`
> utilise une clé API App Store Connect (rôle App Manager) gérée par EAS. Fiche App Store Connect : identifiant
> `6828146094`, nom « Return - Suivi de vos prêts » (FR) / « Return - Track What You Lend » (EN) — « Return » était
> pris. Builds 1.0.0 (1), (2) et (3) envoyés sur TestFlight ; push reçu sur iPhone physique le 31/10. **L'app n'est
> pas publiée sur l'App Store** : test interne uniquement, Ozias seul testeur iOS.

### ACC-A1 — Créer le compte Apple Developer

- **Gravité** : 🔴 Critique — déblocage de tout le chantier iOS
- **Responsable** : Ozias
- **Coût** : 99 $/an
- **Dépendances** : aucune
- **Description** : créer (ou utiliser) un Apple ID professionnel dédié à Ideogen avec 2FA activée, puis s'enrôler sur
  [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll) (ou via l'app **"Apple Developer"**
  sur iPhone, souvent plus fluide pour la vérification d'identité). Choisir le type **Individual**. Aucun numéro D-U-N-S
  requis. La vérification d'identité (pièce d'identité gouvernementale) peut prendre quelques heures à 48 h.
- **Critères d'acceptation** :
    - [x] Apple ID avec 2FA — Apple ID personnel d'Ozias, pas d'Apple ID dédié Ideogen
    - [x] Enrôlement soumis sur developer.apple.com (Individual)
    - [x] Vérification d'identité complétée (pièce gouvernementale acceptée)
    - [x] Paiement de 99 $/an effectué
    - [x] Compte actif (confirmé le 25/10 ; contrat de licence Apple accepté le 28/10)

---

### ACC-A2 — Créer + uploader la clé APNs .p8 (= PUSH-P1)

- **Gravité** : 🔴 Critique pour iOS standalone
- **Responsable** : Ozias (création) + natismael (upload EAS)
- **Dépendances** : ACC-A1
- **Fichier(s) concerné(s)** :
    - Portail Apple Developer → Certificates, Identifiers & Profiles → **Keys**
    - `eas credentials` (iOS > Production > Push Notifications Key) — dans l'espace EAS de natismael
- **Description** : une fois le compte Apple actif, créer la clé APNs dans le portail :
  Certificates, Identifiers & Profiles → **Keys** → "+" → activer **"Apple Push Notifications service (APNs)"** →
  télécharger le fichier `.p8`.

  > **Attention** : le fichier `.p8` n'est téléchargeable **qu'une seule fois**. Le conserver en lieu sûr
  > immédiatement après téléchargement.

  L'upload dans EAS se fait dans l'espace de **natismael** (owner EAS) via `cd frontend && eas credentials`
  (iOS > Production > Push Notifications Key). Cette étape nécessite que **Ozias et natismael soient disponibles
  ensemble** (ou qu'Ozias ajoute natismael comme membre de son équipe Apple pour lui déléguer l'accès).
- **Critères d'acceptation** :
    - [x] Clé APNs créée sur le compte Apple Developer — générée par EAS au premier build iOS
    - [x] Clé conservée en lieu sûr — stockée par EAS (aucune copie `.p8` locale à protéger)
    - [x] Clé référencée dans EAS côté iOS (push reçu sur iPhone physique le 31/10)

---

### ACC-A3 — Configurer TestFlight (testeurs internes)

- **Gravité** : 🟠 Majeur — requis pour l'install propre iOS sans câble
- **Responsable** : Ozias
- **Dépendances** : ACC-A1, build iOS (ACC-E3)
- **Fichier(s) concerné(s)** :
    - App Store Connect → onglet **TestFlight**
- **Description** : après soumission du premier build iOS via `eas submit`, aller dans App Store Connect →
  My Apps → Return → TestFlight → ajouter les testeurs **internes** (jusqu'à 100 personnes, disponible sans review
  Apple). Les testeurs reçoivent une invitation par email et installent via l'app **TestFlight** sur leur iPhone.

  > **Note** : le lien de test public (jusqu'à 10 000 testeurs externes) nécessite une courte "Beta App Review"
  > par Apple (1 à 2 jours). Pour le re-test terrain initial, les testeurs internes suffisent et sont disponibles
  > immédiatement.
- **Critères d'acceptation** :
    - [x] App créée dans App Store Connect (identifiant `6828146094`)
    - [x] Build iOS soumis visible dans l'onglet TestFlight (1.0.0 (1), (2), (3))
    - [x] Testeurs internes ajoutés et invitation envoyée (Ozias ; aucun autre utilisateur iOS dans l'équipe)
    - [x] Au moins un testeur a installé l'app via TestFlight sur device iOS (Ozias, iPhone physique)

---

## 🤖 Chantier natismael — Google (Firebase + Play Console)

### ACC-G1 — Extraire le compte de service FCM V1 (= prérequis PUSH-P2)

- **Gravité** : 🔴 Critique pour Android standalone
- **Responsable** : natismael
- **Coût** : gratuit
- **Dépendances** : aucune (le projet Firebase existe déjà ✅ — ne pas le recréer)
- **Fichier(s) concerné(s)** :
    - Console Firebase → Paramètres du projet → **Comptes de service**
    - `eas credentials` (Android > FCM V1 Service Account Key) — étape ACC-E2
- **Description** : dans le **projet Firebase existant** du projet Return, aller dans :
  Paramètres du projet (roue dentée) → onglet **Comptes de service** → **Générer une nouvelle clé privée** (format
  JSON). Ce fichier JSON servira pour la configuration "FCM V1" dans EAS (ACC-E2).

  Vérifier au passage que l'application Android `com.ideogen.returnapp` est bien enregistrée dans ce projet Firebase
  (onglet "Vue d'ensemble du projet" → liste des apps).
- **Critères d'acceptation** :
    - [x] Fichier JSON du compte de service FCM V1 généré depuis la console Firebase (doc 16 : « FCM EAS fait »)
    - [x] Fichier JSON sauvegardé en lieu sûr (ne pas commiter dans le dépôt)
    - [x] App Android `com.ideogen.returnapp` enregistrée dans le projet Firebase (`google-services.json`, commit
      `1063ec9`)

  > Statut au 28/10/2026 : « FCM EAS déjà fait » (doc 16, FEAT-05) et push reçu sur le build Android de production.

---

### ACC-G2 — Créer le compte Google Play Console (Individual)

- **Gravité** : 🔴 Critique — requis pour la distribution Android propre
- **Responsable** : natismael
- **Coût** : 25 $ une fois
- **Dépendances** : aucune
- **Description** : créer le compte sur [play.google.com/console](https://play.google.com/console) → choisir
  **Individual** (pas d'entreprise). Aucun D-U-N-S requis. La vérification d'identité demande le nom légal, l'adresse
  et un numéro de téléphone. Le paiement de 25 $ est unique (pas d'abonnement annuel).
- **Critères d'acceptation** :
    - [x] Compte Google Play Console créé (Individual) — doc 16 : « Play Console OK (fait) »
    - [x] Vérification d'identité complétée (nom légal, adresse, téléphone)
    - [x] Paiement de 25 $ effectué
    - [x] Accès au dashboard Play Console confirmé

---

### ACC-G3 — Créer l'app "Return" + piste "Test interne" + liste testeurs

- **Gravité** : 🟠 Majeur — requis pour l'install propre Android sans APK
- **Responsable** : natismael
- **Dépendances** : ACC-G2
- **Description** : dans le Play Console, créer une nouvelle app → nom "Return", package
  `com.ideogen.returnapp` → dans **Test** → **Test interne** → créer la liste de testeurs (emails Gmail ou Google
  Workspace). Les testeurs reçoivent un **lien d'opt-in** leur permettant d'installer l'app directement depuis le
  Play Store.

  > **Note importante** : la règle Google "20 testeurs pendant 14 jours consécutifs" ne concerne que le passage
  > en **production publique** pour les comptes Individual. Le **test interne est disponible immédiatement** et
  > sans cette contrainte — c'est exactement ce dont nous avons besoin pour le re-test terrain.
- **Critères d'acceptation** :
    - [x] App "Return" créée dans le Play Console (`com.ideogen.returnapp`)
    - [x] Piste "Test interne" configurée
    - [x] Liste de testeurs créée avec les emails concernés
    - [x] Lien d'opt-in généré et transmis aux testeurs (installation depuis la piste interne vérifiée sur un téléphone)

  > Statut au 28/10/2026 : Play App Signing activé ; release du 1er AAB déployée sur « Test interne » (FEAT-05, doc 16).

---

## ⚙️ Chantier EAS — Ismael (côté front, automatisable)

### ACC-E1 — Profil de distribution EAS dans `eas.json`

- **Gravité** : 🟠 Majeur — prérequis aux builds de distribution
- **Responsable** : Ismael
- **Dépendances** : aucune
- **Fichier(s) concerné(s)** :
    - `frontend/eas.json` — ajout d'un profil `production` ou `distribution`
- **Description** : configurer dans `eas.json` un profil de distribution avec Android en **AAB** (format obligatoire
  pour le Google Play) et iOS en distribution store. Ismael s'en charge côté front en s'alignant sur la config EAS
  existante du projet `natismael`.
- **Critères d'acceptation** :
    - [x] Profil de distribution défini dans `eas.json` (`production` : Android `app-bundle`, iOS store ;
      `submit.production.ios` avec `ascAppId` et `appleTeamId`, commit `9168429`)
    - [x] Bundle IDs confirmés : `com.ideogen.returnapp` Android et iOS

---

### ACC-E2 — Uploader credentials APNs + FCM dans EAS (= PUSH-P1/P2)

- **Gravité** : 🔴 Critique — sans ces credentials, les builds standalone ne reçoivent pas les push
- **Responsable** : Ismael + binôme
- **Dépendances** : ACC-A2 (clé APNs .p8), ACC-G1 (JSON FCM V1)
- **Fichier(s) concerné(s)** :
    - `eas credentials` (espace EAS de natismael)
- **Description** :
    - **iOS** : `cd frontend && eas credentials` → iOS → Production → Push Notifications Key → uploader la clé `.p8`
      générée en ACC-A2.
    - **Android** : `cd frontend && eas credentials` → Android → FCM V1 Service Account Key → uploader le fichier JSON
      généré en ACC-G1.
- **Critères d'acceptation** :
    - [x] Clé APNs référencée dans EAS (générée par EAS au premier build iOS)
    - [x] Clé FCM V1 JSON uploadée et référencée dans EAS (doc 16 : « FCM EAS fait »)

---

### ACC-E3 — Builds EAS iOS + Android (= PUSH-F5)

- **Gravité** : 🔴 Critique pour les tests sur device
- **Responsable** : Ismael
- **Dépendances** : ACC-E1, ACC-E2
- **Description** : lancer les builds EAS de distribution pour les deux plateformes :
  `eas build --platform ios --profile distribution` et `eas build --platform android --profile distribution`.
  Ces builds intègrent les entitlements push natifs (APNs iOS, FCM Android). Temps de build estimé : 15-30 min selon
  la file EAS.
- **Critères d'acceptation** :
    - [x] Build EAS Android déclenché et terminé sans erreur (artefact AAB généré : build
      `c2fcaeca-07b9-4a0c-a4fc-c6ea176902b1`, 1.0.0, versionCode 1)
    - [x] Build EAS iOS déclenché et terminé sans erreur (artefact IPA généré — builds 1→3, profil `production`)
    - [x] Les builds incorporent les plugins `expo-notifications` (preuve indirecte : Android push reçu
      (28/10/2026) ; iOS push reçu (31/10/2026, cf. ACC-E5))
    - [ ] L'app installée sur device demande la permission de notifications au premier lancement (non vérifié
      explicitement, non bloquant : ACC-E3 reste ✅ car push reçu)

---

### ACC-E4 — `eas submit` → TestFlight + Play test interne

- **Gravité** : 🟠 Majeur — dernière étape avant install propre par les testeurs
- **Responsable** : Ismael
- **Dépendances** : ACC-E3, ACC-A3, ACC-G3
- **Description** :
    - **iOS** : `eas submit --platform ios` → soumet l'IPA vers App Store Connect (TestFlight).
    - **Android** : `eas submit --platform android` → soumet l'AAB vers le Play Console (piste "Test interne").
- **Critères d'acceptation** :
    - [x] Build iOS soumis et visible dans l'onglet TestFlight d'App Store Connect
    - [x] Build Android soumis et visible dans la piste "Test interne" du Play Console (1er AAB **importé
      manuellement**, comme Google l'exige ; `eas submit` automatique validé avec le build versionCode 2 le 29/10)
    - [x] Testeurs notifiés (invitation TestFlight + lien opt-in Android) — Android ✅ ; iOS ✅ pour Ozias, seul
      testeur (aucun autre iPhone dans l'équipe)

---

### ACC-E5 — Test e2e : push reçu sur device iOS + Android

- **Gravité** : 🔴 Critique — validation finale de la chaîne complète
- **Responsable** : Binôme
- **Dépendances** : ACC-E4
- **Description** : valider la réception effective des push sur des devices physiques iOS et Android. Se référer
  aux 5 critères d'acceptation e2e définis dans **`docs/14_ROADMAP_PUSH_EXPO.md` § E** (specs back vertes, token
  visible en base, push reçu sur les deux plateformes, CRON reminder, logout + purge token).
- **Critères d'acceptation** :
    - [x] Push reçu sur device Android standalone (app installée via Play test interne) — 28/10 et 31/10 (build
      production, piste interne) ; tap → bon prêt non vérifié formellement sur Android (reste ouvert)
    - [x] Push reçu sur device iOS standalone (app installée via TestFlight) — 31/10, build 1.0.0 (2), tap → bon prêt
    - [ ] Les 5 critères e2e de `docs/14` § E validés

---

## Ordre d'exécution — chemin critique

Les trois chantiers se déroulent **en parallèle** et convergent sur les builds (ACC-E3) puis le submit (ACC-E4).

> **Maillons longs à démarrer EN PREMIER** : ACC-A1 (activation Apple — jusqu'à 48 h) et ACC-G2 (création Play
> Console — vérification d'identité). ACC-G1 (extraction FCM) est rapide et déblocable immédiatement.

```
Chantier Ozias (Apple)
  ACC-A1 (compte Apple, 24-48 h) ──┬── ACC-A2 (clé APNs .p8) ──────────────────────────────┐
                                    └── ACC-A3 (TestFlight — après 1er build) ───────────────┤
                                                                                              │
Chantier natismael (Google)                                                                   │
  ACC-G1 (FCM JSON — rapide, faire en 1er) ────────────────────────────────────────────────┐ │
  ACC-G2 (Play Console, quelques heures) ───── ACC-G3 (app + piste test interne) ──────────┤ │
                                                                                            │ │
Chantier Ismael (EAS)                                                                       │ │
  ACC-E1 (profil eas.json) ──────────────────── ACC-E2 (upload credentials) ◄──────────────┘─┤
                                                       │                                      │
                                                       ▼                                      │
                                                ACC-E3 (builds EAS iOS + Android) ◄──────────┘
                                                       │
                                                       ▼
                                                ACC-E4 (eas submit → TestFlight + Play)
                                                       │
                                                       ▼
                                                ACC-E5 (test e2e terrain — binôme)
```

---

## Notes & coûts

### Récapitulatif des coûts

| Plateforme | Coût | Type |
|---|---|---|
| Apple Developer Program | 99 $/an | Abonnement annuel (Ozias) |
| Google Play Console | 25 $ | Frais unique (natismael) |
| Firebase (FCM) | gratuit | Inclus dans le plan Spark |

### Compte Individual — implications

- **Pas de D-U-N-S requis** — c'est le parcours le plus rapide pour les deux plateformes.
- Le vendeur affiché publiquement sera le **nom légal de la personne** (Ozias pour Apple, natismael pour Google),
  pas "Ideogen". Ce point est acceptable pour la phase de test terrain.
- Une migration vers un compte **Organization** reste possible ultérieurement si le branding "Ideogen" doit apparaître
  en vitrine publique.

### Sécurité des credentials

- Le fichier `.p8` APNs est **téléchargeable une seule fois** depuis le portail Apple — le sauvegarder immédiatement
  dans un gestionnaire de mots de passe partagé ou un stockage chiffré.
- Le fichier JSON FCM V1 ne doit **pas être commité** dans le dépôt Git (ajouter à `.gitignore` si téléchargé
  localement).

---

*Document produit le 25/06/2026 — à mettre à jour au fur et à mesure (cocher les cases). Compagnon de `docs/14_ROADMAP_PUSH_EXPO.md`.*
