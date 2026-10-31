# 05_ROADMAP_FRONTEND.md

**Return ↺ - Roadmap de Développement Frontend (React Native)**

**Version** : 1.2 — Post-intégration Sprint 4 (ajout Sprint 4.5)
**Co-validé par** : Esdras GBEDOZIN & Ismael AIHOU
**Date** : 12 février 2026

---

## Stratégie de Développement (2 Développeurs)

**Approche** : Développement **MOCK-FIRST** en parallèle du Backend.

**Principe** :

1. Le Frontend utilise **Prism Mock Server** dès le Sprint 0 (pas d'attente du Backend).
2. Chaque Sprint livre des **écrans complets** connectés au mock.
3. Le **basculement mock → backend réel** se fait progressivement (1 module à la fois).
4. Les 2 développeurs avancent en parallèle sans blocage.

**Durée estimée** : 6 Sprints de 5 jours + buffer intégration (35-40 jours calendaires).

> **Note Containerisation** : À partir du Sprint 5, l'environnement de développement est **conteneurisé** via Docker
> (`docker compose up` → postgres + redis + backend + frontend Expo Web). Le frontend est servi en **Expo Web uniquement**
> dans le conteneur — les builds natifs (iOS/Android) restent gérés par **Expo/EAS Build** (cloud).
> Voir Phase 5.0 pour les détails de mise en place.

**Stack Frontend** :

| Technologie              | Version | Rôle                                  |
|--------------------------|---------|---------------------------------------|
| React Native             | 0.78+   | Framework mobile                      |
| Expo (dev-client)        | SDK 52+ | Toolchain, builds natifs, OTA updates |
| TypeScript               | 5.8+    | Typage statique                       |
| React Navigation         | 7.x     | Navigation (Stack + Tab)              |
| Zustand                  | 5.x     | State management                      |
| React Native Paper       | -       | Composants UI Material Design         |
| react-hook-form          | 7.x     | Gestion de formulaires + validation   |
| react-i18next            | -       | Internationalisation (FR + EN)        |
| Axios                    | -       | Client HTTP avec interceptéurs JWT    |
| AsyncStorage             | -       | Persistance locale (tokens)           |
| Firebasé Cloud Messaging | -       | Notifications push                    |

**Tests** :

| Outil                        | Scope                          | Quand                       |
|------------------------------|--------------------------------|-----------------------------|
| React Native Testing Library | Composants, formulaires, flows | Sprint 1 → Sprint 6 (MVP)   |
| Jest                         | Stores Zustand, utilitaires    | Sprint 1 → Sprint 6 (MVP)   |
| Detox                        | Tests E2E bout en bout         | Post-MVP (flows stabilises) |

---

## Sprint 0 : Setup Projet (3-4 jours)

### Objectif

Mettre en place l'infrastructuré Frontend avant tout développement fonctionnel.

### Taches

| ID            | Titre                                                                   | Dépendance | Critère de Fin                                                 | Temps |
|---------------|-------------------------------------------------------------------------|------------|----------------------------------------------------------------|-------|
| **SETUP-001** | Initialiser projet React Native avec **Expo (dev-client)**              | -          | `npx expo start` fonctionne                                    | 30min |
| **SETUP-002** | Configurer TypeScript strict + ESLint + Prettier                        | SETUP-001  | `npm run lint` passe sans erreur                               | 30min |
| **SETUP-003** | Installer React Navigation 7.x (Stack + Tab Navigator)                  | SETUP-001  | Navigation fonctionne entre 2 écrans de test                   | 1h    |
| **SETUP-004** | Installer react-hook-form 7.x (formulaires + validation)                | SETUP-001  | Formulaire de test avec validation fonctionne                  | 30min |
| **SETUP-005** | Installer react-i18next (i18n FR/EN)                                    | SETUP-001  | Traduction FR/EN fonctionnelle sur un écran de test            | 45min |
| **SETUP-006** | Installer Zustand 5.x (state management)                                | SETUP-001  | Store créé et accessible dans composants                       | 45min |
| **SETUP-007** | Installer React Native Paper (UI components)                            | SETUP-001  | Bouton + TextInput affiches avec theme                         | 45min |
| **SETUP-008** | Configurer Axios (HTTP client) + interceptéurs JWT                      | SETUP-001  | Requête authentifiee avec Bearer token                         | 1h30  |
| **SETUP-009** | Lancer Prism Mock Server (basé sur openapi.yaml)                        | -          | `prism mock openapi.yaml` accessible sur http://localhost:3000 | 15min |
| **SETUP-010** | Créer service API `apiClient.ts` (basé sur Axios) avec switch mock/real | SETUP-008  | Variable `USE_MOCK=true` pointe vers Prism                     | 1h    |
| **SETUP-011** | Configurer React Native Async Storage (persistance tokens)              | SETUP-001  | Token sauvegarde et récupéré après redémarrage                 | 1h    |
| **SETUP-012** | Setup CI/CD GitHub Actions (lint + tests Jest/RNTL)                     | SETUP-002  | Pipeline passe sur `main`                                      | 1h30  |

> **Note SETUP-012** : La CI/CD exécuté uniquement ESLint, Prettier et les tests RNTL/Jest. Les tests Detox E2E ne
> seront intégrés en CI que post-MVP, une fois les flows stabilises. Le pipeline tourne sur `main` (GitHub Flow, pas de
> branche `develop`).

📦 **Livrable Sprint 0** : App démarrable avec navigation + mock API fonctionnel + i18n configuré + CI/CD opérationnelle.

---

## Sprint 1 : Module Auth + Profil (5 jours)

### Objectif

Authentification complète + Édition de profil + Suppression de compte (RGPD). **Se connecté au Mock Server
immédiatement.**

### Phase 1.1 : Gestion d'État (Zustand Store) (Jour 1)

| ID           | Titre                                                                   | Dépendance          | Critère de Fin                                         | Temps |
|--------------|-------------------------------------------------------------------------|---------------------|--------------------------------------------------------|-------|
| **AUTH-001** | Créer `useAuthStore` (state: user, accessToken, isAuthenticated)        | SETUP-006           | Store créé avec actions login/logout                   | 1h    |
| **AUTH-002** | Créer action `login(email, password)` (appelle `/auth/login`)           | AUTH-001, SETUP-010 | Action fonctionnelle (appelle mock API)                | 1h30  |
| **AUTH-003** | Créer action `register(email, password, firstName, lastName)`           | AUTH-001            | Action fonctionnelle (appelle mock API)                | 1h    |
| **AUTH-004** | Créer action `logout()` (supprime token + reset state)                  | AUTH-001            | Action efface token en AsyncStorage                    | 45min |
| **AUTH-005** | Créer action `refreshToken()` (appelle `/auth/refresh` si token expire) | AUTH-001            | Token rafraichi automatiquement via interceptéur Axios | 1h30  |

### Phase 1.2 : Composants UI (Dumb) (Jour 2)

| ID           | Titre                                                                    | Dépendance | Critère de Fin                                   | Temps |
|--------------|--------------------------------------------------------------------------|------------|--------------------------------------------------|-------|
| **AUTH-006** | Créer composant `LoginForm` (email + password + bouton)                  | SETUP-007  | Formulaire affiche, validation react-hook-form   | 1h    |
| **AUTH-007** | Créer composant `RegisterForm` (email + password + firstName + lastName) | SETUP-007  | Formulaire affiche, validation mot de passe fort | 1h30  |
| **AUTH-008** | Créer composant `ProfileCard` (affichage infos user)                     | SETUP-007  | Card affiché firstName, lastName, email          | 45min |
| **AUTH-009** | Créer composant `EditProfileForm` (édition firstName/lastName)           | SETUP-007  | Formulaire éditable avec bouton "Sauvegarder"    | 1h    |
| **AUTH-010** | Créer composant `ChangePasswordForm` (ancien + nouveau mot de passe)     | SETUP-007  | Formulaire avec validation                       | 1h    |

### Phase 1.3 : Écrans (Smart Components) (Jour 3)

| ID            | Titre                                                                       | Dépendance         | Critère de Fin                              | Temps |
|---------------|-----------------------------------------------------------------------------|--------------------|---------------------------------------------|-------|
| **AUTH-011**  | Créer écran `LoginScreen` (connecté LoginForm au store)                     | AUTH-002, AUTH-006 | Connexion réussie redirigé vers Dashboard   | 1h    |
| **AUTH-012**  | Créer écran `RegisterScreen` (connecté RegisterForm au store)               | AUTH-003, AUTH-007 | Inscription réussie redirigé vers Dashboard | 1h    |
| **AUTH-013**  | Créer écran `ProfileScreen` (affiché ProfileCard + bouton "Éditer")         | AUTH-001, AUTH-008 | Affiche infos utilisateur connecté          | 45min |
| **AUTH-014**  | Créer écran `EditProfileScreen` (connecté EditProfileForm au store)         | AUTH-009           | Sauvegarde mise à jour profil via API mock  | 1h    |
| **AUTH-015**  | Créer écran `ChangePasswordScreen` (connecté ChangePasswordForm au store)   | AUTH-010           | Change mot de passe via API mock            | 1h    |
| **AUTH-016**  | Créer écran `DeleteAccountScreen` (confirmation + appel `DELETE /users/me`) | AUTH-001           | Suppression compte via API mock (RGPD)      | 1h30  |
| **AUTH-016b** | Créer écran `SettingsScreen` (langue, préférences notifications)            | AUTH-001           | GET + PATCH `/users/me/settings` via mock   | 1h30  |

> **Note AUTH-016** : L'écran `DeleteAccountScreen` implémente la suppression de compte conformement au RGPD.
> L'utilisateur doit confirmer par saisie de son mot de passe avant suppression. En cas de prêts actifs, l'API retourné
> une erreur 409 — l'écran affiché un message explicatif.

### Phase 1.4 : Navigation + Guards (Jour 4)

| ID           | Titre                                                                                               | Dépendance                                        | Critère de Fin                                       | Temps |
|--------------|-----------------------------------------------------------------------------------------------------|---------------------------------------------------|------------------------------------------------------|-------|
| **AUTH-017** | Configurer Stack Navigator Auth (Login → Register)                                                  | SETUP-003, AUTH-011, AUTH-012                     | Navigation fonctionnelle entre Login et Register     | 30min |
| **AUTH-018** | Configurer Stack Navigator App (Dashboard → Profile → EditProfile → ChangePassword → DeleteAccount) | SETUP-003, AUTH-013, AUTH-014, AUTH-015, AUTH-016 | Navigation fonctionnelle dans l'app                  | 45min |
| **AUTH-019** | Créer `AuthGuard` (redirect vers Login si pas authentifie)                                          | AUTH-001, SETUP-003                               | Acces à Dashboard impossible sans login              | 1h    |
| **AUTH-020** | Implémenter "Remember Me" (persist token en AsyncStorage)                                           | SETUP-011, AUTH-002                               | Token persiste après redémarrage app                 | 1h    |
| **AUTH-021** | Gerer refresh automatique du token (via interceptéur Axios)                                         | AUTH-005, SETUP-008                               | Token expire → refresh automatique → requête rejouée | 1h30  |

### Phase 1.5 : Tests + Gestion d'Erreurs (Jour 5)

| ID           | Titre                                                            | Dépendance | Critère de Fin                                    | Temps |
|--------------|------------------------------------------------------------------|------------|---------------------------------------------------|-------|
| **AUTH-022** | Afficher erreur RFC 7807 si login échoue (401 ou 400)            | AUTH-011   | Message "Email ou mot de passe incorrect" affiché | 1h    |
| **AUTH-023** | Afficher erreur si email déjà utilisé lors de register (409)     | AUTH-012   | Message "Cet email est déjà utilisé" affiché      | 45min |
| **AUTH-024** | Afficher erreur 409 si suppression compte avec prêts actifs      | AUTH-016   | Message explicatif affiché                        | 30min |
| **AUTH-025** | Écrire test RNTL : LoginForm validation + submit                 | AUTH-006   | Test RNTL passe                                   | 1h    |
| **AUTH-026** | Écrire test RNTL : RegisterForm validation + submit              | AUTH-007   | Test RNTL passe                                   | 1h    |
| **AUTH-027** | Écrire test RNTL : EditProfileForm submit                        | AUTH-009   | Test RNTL passe                                   | 45min |
| **AUTH-028** | Écrire test RNTL : affichage conditionnel d'erreurs RFC 7807     | AUTH-022   | Test RNTL passe                                   | 45min |
| **AUTH-029** | Écrire test RNTL : état de chargement (loading spinner)          | AUTH-011   | Test RNTL passe                                   | 30min |
| **AUTH-030** | Écrire test RNTL : DeleteAccountScreen confirmation + erreur 409 | AUTH-016   | Test RNTL passe                                   | 45min |

📦 **Livrable Sprint 1** : **Authentification + Profil + Settings + Suppression de compte complets** (connectés au Mock
Server), couverts par tests RNTL.

---

## Sprint 2 : Module Borrowers (4 jours)

### Objectif

CRUD complet des emprunteurs. L'emprunteur doit obligatoirement disposer d'un compte Return pour recevoir les
notifications et interagir avec le pret.

### Phase 2.1 : Gestion d'État (Zustand Store)

| ID           | Titre                                                                                        | Dépendance | Critère de Fin               | Temps |
|--------------|----------------------------------------------------------------------------------------------|------------|------------------------------|-------|
| **BORR-001** | Créer `useBorrowerStore` (state: borrowers[], selectedBorrower)                              | SETUP-006  | Store créé avec actions CRUD | 1h    |
| **BORR-002** | Créer actions `fetchBorrowers()`, `createBorrower()`, `updateBorrower()`, `deleteBorrower()` | BORR-001   | Actions appellent API mock   | 2h    |

### Phase 2.2 : Composants UI (Dumb)

| ID           | Titre                                                                 | Dépendance | Critère de Fin                   | Temps |
|--------------|-----------------------------------------------------------------------|------------|----------------------------------|-------|
| **BORR-003** | Créer composant `BorrowerCard` (affichage firstName, lastName, email) | SETUP-007  | Card affichée dans liste         | 45min |
| **BORR-004** | Créer composant `BorrowerForm` (création/édition emprunteur)          | SETUP-007  | Formulaire avec validation email | 1h30  |
| **BORR-005** | Créer composant `BorrowerStatsBadge` (trustScore + nb prêts)          | SETUP-007  | Badge colore selon trustScore    | 1h    |

### Phase 2.3 : Écrans (Smart Components)

| ID           | Titre                                                                      | Dépendance         | Critère de Fin                        | Temps |
|--------------|----------------------------------------------------------------------------|--------------------|---------------------------------------|-------|
| **BORR-006** | Créer écran `BorrowerListScreen` (FlatList de BorrowerCard)                | BORR-002, BORR-003 | Liste paginée avec bouton "+ Nouveau" | 1h30  |
| **BORR-007** | Créer écran `CreateBorrowerScreen` (BorrowerForm)                          | BORR-002, BORR-004 | Création d'emprunteur via API mock    | 1h    |
| **BORR-008** | Créer écran `BorrowerDetailScreen` (stats + bouton "Éditer" + "Supprimer") | BORR-002, BORR-005 | Details emprunteur affiches           | 1h    |
| **BORR-009** | Créer écran `EditBorrowerScreen` (BorrowerForm pré-rempli)                 | BORR-002, BORR-004 | Mise à jour emprunteur via API mock   | 1h    |

### Phase 2.4 : Navigation + Tests

| ID           | Titre                                                            | Dépendance          | Critère de Fin                                           | Temps |
|--------------|------------------------------------------------------------------|---------------------|----------------------------------------------------------|-------|
| **BORR-010** | Ajouter onglet "Contacts" dans Tab Navigator                     | SETUP-003, BORR-006 | Onglet accessible depuis Dashboard                       | 30min |
| **BORR-011** | Gerer erreur 409 si email emprunteur existe déjà pour ce prêteur | BORR-007            | Message "Email déjà utilisé pour cet emprunteur" affiché | 45min |
| **BORR-012** | Écrire test RNTL : BorrowerForm validation + création            | BORR-004            | Test RNTL passe                                          | 1h    |
| **BORR-013** | Écrire test RNTL : suppression emprunteur avec confirmation      | BORR-008            | Test RNTL passe                                          | 1h    |

📦 **Livrable Sprint 2** : **Gestion des emprunteurs complète** (connectée au Mock Server), couverte par tests RNTL.

---

## Sprint 3 : Module Items — Photos (4 jours)

### Objectif

Enregistrement d'objets avec photos + upload. La reconnaissance automatique (OCR via Google Cloud Vision) est **hors
scope V1**.

### Phase 3.1 : Gestion d'État (Zustand Store)

| ID           | Titre                                                                                                                           | Dépendance | Critère de Fin               | Temps |
|--------------|---------------------------------------------------------------------------------------------------------------------------------|------------|------------------------------|-------|
| **ITEM-001** | Créer `useItemStore` (state: items[], selectedItem)                                                                             | SETUP-006  | Store créé avec actions CRUD | 1h    |
| **ITEM-002** | Créer actions `fetchItems()`, `fetchItem(id)`, `createItem()`, `updateItem()`, `deleteItem()`, `uploadPhoto()`, `deletePhoto()` | ITEM-001   | Actions appellent API mock   | 2h30  |

> **Note ITEM-002** : `fetchItem(id)` est nécessaire pour `ItemDetailScreen` (GET `/items/{itemId}`).
> `updateItem(id, data)` est nécessaire pour `EditItemScreen` (PATCH `/items/{itemId}`).
> `uploadPhoto(itemId, photo)` appelle POST `/items/{itemId}/photos` (multipart/form-data) sur un item **déjà créé**.

### Phase 3.2 : Composants UI (Dumb)

| ID           | Titre                                                                                      | Dépendance | Critère de Fin                                     | Temps |
|--------------|--------------------------------------------------------------------------------------------|------------|----------------------------------------------------|-------|
| **ITEM-003** | Créer composant `ItemCard` (photo + nom + categorie + valeur)                              | SETUP-007  | Card affichée dans liste                           | 1h    |
| **ITEM-004** | Créer composant `ItemForm` (création/édition manuelle avec selecteur categorie)            | SETUP-007  | Formulaire avec dropdown ItemCategory              | 1h30  |
| **ITEM-005** | Créer composant `PhotoPicker` (sélection photo via ImagePicker, validation JPEG/PNG ≤ 5MB) | SETUP-001  | Bouton "Prendre une photo" fonctionne              | 1h30  |
| **ITEM-006** | Créer composant `PhotoGallery` (carousel de photos de l'objet, max 5)                      | SETUP-007  | Swiper affiché photos avec bouton "+" pour ajouter | 1h30  |

> **Note ITEM-004** : Validations conformes à l'OpenAPI : `name` (min 3, max 100), `description` (max 500, nullable),
> `estimatedValue` (min 0, nullable, **obligatoire si category = MONEY**). L'enum `ItemCategory` comprend :
> TOOLS, BOOKS, ELECTRONICS, SPORTS, KITCHEN, GARDEN, MONEY, OTHER.

> **Note ITEM-005** : Le `PhotoPicker` doit valider côté client le format (JPEG/PNG uniquement) et la taille (max 5 MB)
> avant l'upload, conformément au contrat POST `/items/{itemId}/photos`.

### Phase 3.3 : Écrans (Smart Components)

| ID           | Titre                                                                                          | Dépendance                   | Critère de Fin                                                   | Temps |
|--------------|------------------------------------------------------------------------------------------------|------------------------------|------------------------------------------------------------------|-------|
| **ITEM-007** | Créer écran `ItemListScreen` (FlatList de ItemCard avec filtres category + available)          | ITEM-002, ITEM-003           | Liste paginée et filtrée avec bouton "+ Nouveau"                 | 1h30  |
| **ITEM-008** | Créer écran `CreateItemScreen` (ItemForm + PhotoPicker, workflow 2 étapes : créer puis upload) | ITEM-002, ITEM-004, ITEM-005 | Création item via API mock, puis upload photos sur item existant | 1h30  |
| **ITEM-009** | Créer écran `ItemDetailScreen` (PhotoGallery + infos + boutons "Éditer" / "Supprimer")         | ITEM-002, ITEM-006           | Details objet affiches via GET `/items/{itemId}`                 | 1h    |
| **ITEM-010** | Créer écran `EditItemScreen` (ItemForm pré-rempli)                                             | ITEM-002, ITEM-004           | Mise à jour objet via PATCH `/items/{itemId}`                    | 1h    |

> **Note ITEM-007** : L'OpenAPI expose 2 filtres sur GET `/items` : `category` (ItemCategory) et `available` (boolean —
> objets non actuellement prêtés). Le filtre `available` sera utile dès le Sprint 4 pour le LoanWizard.

> **Note ITEM-008** : L'upload de photos se fait obligatoirement en 2 étapes (contrainte OpenAPI) :
>
> 1. `POST /items` → créer l'item → récupérer l'`id`
> 2. `POST /items/{itemId}/photos` → uploader chaque photo (multipart/form-data)
>
> L'écran doit gérer le cas où la création réussit mais l'upload échoue (item créé sans photo, retry possible).

### Phase 3.4 : Navigation + Tests + Gestion d'Erreurs

| ID            | Titre                                                                   | Dépendance          | Critère de Fin                                                        | Temps |
|---------------|-------------------------------------------------------------------------|---------------------|-----------------------------------------------------------------------|-------|
| **ITEM-011**  | Ajouter onglet "Objets" dans Tab Navigator                              | SETUP-003, ITEM-007 | Onglet accessible                                                     | 30min |
| **ITEM-012**  | Gérer erreur 400 si category=MONEY sans estimatedValue                  | ITEM-008            | Message "Montant obligatoire pour MONEY" affiché                      | 45min |
| **ITEM-012b** | Gérer erreur 409 `item-currently-loaned` à la suppression d'un item     | ITEM-009            | Message "Impossible de supprimer un objet actuellement prêté" affiché | 30min |
| **ITEM-012c** | Gérer erreur 400 `max-photos-exceeded` à l'ajout de photo (limite de 5) | ITEM-009            | Message "Maximum de 5 photos atteint" affiché                         | 30min |
| **ITEM-013**  | Écrire test RNTL : ItemForm création manuelle                           | ITEM-004            | Test RNTL passe                                                       | 1h    |
| **ITEM-014**  | Écrire test RNTL : PhotoPicker sélection + preview                      | ITEM-005            | Test RNTL passe                                                       | 1h    |

> **Note ITEM-012b** : L'OpenAPI retourne 409 `item-currently-loaned` si on tente `DELETE /items/{itemId}` sur un objet
> associé à un prêt actif. L'écran `ItemDetailScreen` doit afficher un message explicatif.

📦 **Livrable Sprint 3** : **Enregistrement d'objets avec photos** (connecté au Mock Server), couvert par tests RNTL.

---

## Sprint 4 : Module Loans — Coeur Métier (8 jours)

### Objectif

Gestion complète du cyclé de vie des prêts (création, confirmation, suivi, clôture). Deux types de prêts : **Objet
physique (OBJECT)** et **Argent (MONEY)**.

### Phase 4.0 : Photo de Profil (Rattrapage Sprint 3) (Jour 1 matin)

> **Contexte** : Le backend `PUT /users/me/avatar` est implémenté depuis le Sprint 3 (USER-014/015/016) mais
> l'intégration frontend a été omise. Cette phase comble le manque avant d'attaquer les Loans.

| ID             | Titre                                                                                                                    | Dépendance      | Critère de Fin                                  | Temps |
|----------------|--------------------------------------------------------------------------------------------------------------------------|-----------------|-------------------------------------------------|-------|
| **AVATAR-001** | Ajouter action `updateAvatar(formData)` dans `useAuthStore` → `PUT /users/me/avatar` + mise à jour `user.profilePicture` | SETUP-006       | Action store appelle API réel, state mis à jour | 45min |
| **AVATAR-002** | Modifier `ProfileCard` : afficher `user.profilePicture` (Image) au lieu de l'icône statique, fallback sur icône si null  | AUTH-008        | Photo affichée si existante, icône sinon        | 30min |
| **AVATAR-003** | Ajouter bouton camera overlay sur l'avatar dans `ProfileScreen` → `PhotoPicker` (réutiliser composant Items)             | AVATAR-002      | Tap sur avatar → choix galerie/camera → upload  | 1h    |
| **AVATAR-004** | Ajouter handler MSW `PUT /users/me/avatar` → 200 avec `profilePicture` URL                                               | AVATAR-001      | Handler mock fonctionnel pour les tests         | 15min |
| **AVATAR-005** | Écrire tests RNTL : affichage photo existante, fallback icône, upload succès                                             | AVATAR-002, 003 | 3 tests RNTL passent                            | 1h    |

> **Estimation** : ~3h30. Le `PhotoPicker` et `buildPhotoFormData` du module Items sont réutilisables directement.

### Statuts de prêt (machine à états)

```
PENDING_CONFIRMATION → ACTIVE (accepte) | ACTIVE_BY_DEFAULT (timeout 48h) | CONTESTED (refuse)
ACTIVE / ACTIVE_BY_DEFAULT → AWAITING_RETURN (date dépassée)
AWAITING_RETURN → RETURNED (rendu) | NOT_RETURNED (5 rappels ignorés) | ABANDONED (abandon manuel)
```

### Politique de rappels (automatique, backend)

| Rappel | Type | Moment | Description |
|--------|------|--------|-------------|
| 1 | PREVENTIVE | **J-3** (si Δ ≥ 3) ou **J-1** (si Δ < 3) | Rappel préventif adaptatif avant échéance |
| 2 | ON_DUE_DATE | J (jour J) | Rappel le jour de l'échéance |
| 3 | FIRST_OVERDUE | J+7 | Premier rappel post-échéance |
| 4 | SECOND_OVERDUE | J+14 | Deuxieme rappel post-échéance |
| 5 | FINAL_OVERDUE | J+21 | Dernier rappel → NOT_RETURNED |

> **Contrainte date retour minimum J+2** : La date de retour doit être au minimum 2 jours après la création du prêt.
> Cette validation est appliquée côté frontend (calendrier bloqué avant J+2) et côté backend (API retourne 400).
> Grâce à cette contrainte, Δ ≥ 2 est garanti et le rappel PREVENTIVE est toujours envoyé avant l'échéance.
>
> Les rappels sont 100% automatiques cote backend (BullMQ). Le frontend **ne géré pas** l'envoi de rappels manuels en
> V1. Il reçoit et affiché les notifications push resultantes.

### Phase 4.1 : Gestion d'État (Zustand Store)

| ID           | Titre                                                                                                                                                    | Dépendance | Critère de Fin               | Temps |
|--------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|------------|------------------------------|-------|
| **LOAN-001** | Créer `useLoanStore` (state: loans[], filters, selectedLoan)                                                                                             | SETUP-006  | Store créé avec actions CRUD | 1h30  |
| **LOAN-002** | Créer actions `fetchLoans(filters)`, `fetchLoan(id)`, `createLoan()`, `updateLoan()`, `deleteLoan()`, `confirmLoan()`, `contestLoan()`, `updateStatus()` | LOAN-001   | Actions appellent API mock   | 3h30  |

### Phase 4.2 : Composants UI (Dumb) (Jours 1-2)

| ID           | Titre                                                                                                                                                                                                                                                                   | Dépendance | Critère de Fin                        | Temps |
|--------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------|---------------------------------------|-------|
| **LOAN-003** | Créer composant `LoanCard` (photo objet + nom + emprunteur + status badge + type OBJECT/MONEY)                                                                                                                                                                          | SETUP-007  | Card affichée dans liste              | 1h30  |
| **LOAN-004** | Créer composant `StatusBadge` (PENDING_CONFIRMATION en orange, ACTIVE en vert, ACTIVE_BY_DEFAULT en vert clair, AWAITING_RETURN en rouge, CONTESTED en gris, RETURNED en bleu, NOT_RETURNED en noir, ABANDONED en gris foncé)                                           | SETUP-007  | Badge coloré selon status (8 statuts) | 1h    |
| **LOAN-005** | Créer composant `LoanWizard` (step 1: type OBJECT/MONEY, step 2: sélection objet existant ou saisie montant, step 3: sélection emprunteur existant, step 4: date retour + notes). **Contrainte** : le calendrier bloque les dates avant J+2 (2 jours après aujourd'hui) | SETUP-007  | Wizard 4 étapes fonctionnel           | 4h    |
| **LOAN-006** | Créer composant `LoanTimeline` (affichage historique statuts)                                                                                                                                                                                                           | SETUP-007  | Timeline verticale avec dates         | 2h    |
| **LOAN-007** | Créer composant `ConfirmationDialog` (pour emprunteur : "Accepter" / "Refuser")                                                                                                                                                                                         | SETUP-007  | Dialog modale avec 2 boutons          | 1h    |

> **Note LOAN-005** : Le `LoanWizard` géré les deux types de prêts. Pour un prêt de type OBJECT, l'utilisateur
> sélectionné un objet existant (cree au préalable via le module Items). Pour un prêt de type MONEY, l'utilisateur
> saisit
> directement le montant. L'emprunteur est toujours sélectionné parmi les contacts existants (compte Return
> obligatoire).

### Phase 4.3 : Écrans (Smart Components) (Jours 3-4)

| ID           | Titre                                                                                                                                       | Dépendance                   | Critère de Fin                                                  | Temps |
|--------------|---------------------------------------------------------------------------------------------------------------------------------------------|------------------------------|-----------------------------------------------------------------|-------|
| **LOAN-008** | Créer écran `LoanListScreen` (FlatList de LoanCard avec filtres status + onglets "En cours" / "Archives")                                   | LOAN-002, LOAN-003, LOAN-004 | Liste filtree avec bouton "+ Nouveau pret"                      | 2h    |
| **LOAN-009** | Créer écran `CreateLoanScreen` (LoanWizard — type OBJECT/MONEY + sélection emprunteur existant)                                             | LOAN-002, LOAN-005           | Création prêt via API mock (type + objet/montant + emprunteur)  | 2h30  |
| **LOAN-010** | Créer écran `LoanDetailScreen` (infos complètes + LoanTimeline + boutons actions selon status + édition notes/date + suppression + abandon) | LOAN-002, LOAN-006           | Affichage détails + actions contextuelles (edit/delete/abandon) | 3h    |
| **LOAN-011** | Créer écran `ConfirmLoanScreen` (pour emprunteur : ConfirmationDialog)                                                                      | LOAN-002, LOAN-007           | Confirmation → status ACTIVE, Refus → status CONTESTED          | 1h30  |
| **LOAN-012** | Créer écran `ReturnLoanScreen` (bouton "Confirmer le retour")                                                                               | LOAN-002                     | Changement status → RETURNED via API mock                       | 1h    |

> **Note LOAN-009** : Le frontend ne créé pas d'objet ni d'emprunteur inline lors de la création d'un pret.
> L'utilisateur doit d'abord créer l'objet (module Items) et l'emprunteur (module Borrowers) via leurs écrans dédiés,
> puis
> les sélectionnér par UUID dans le wizard de création de pret. Pour un prêt de type MONEY, la sélection d'objet est
> remplacee par la saisie du montant.

### Phase 4.4 : Navigation + Workflow (Jour 5)

| ID           | Titre                                                                                                                                                                                                                                                     | Dépendance          | Critère de Fin                                     | Temps |
|--------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------|----------------------------------------------------|-------|
| **LOAN-013** | Ajouter onglet "Prêts" dans Tab Navigator (écran par defaut)                                                                                                                                                                                              | SETUP-003, LOAN-008 | Onglet accessible                                  | 30min |
| **LOAN-014** | Implémenter deep linking pour confirmation emprunteur (Universal Links iOS / App Links Android → ConfirmLoanScreen)                                                                                                                                       | LOAN-011            | Lien `return://loans/{id}/confirm` fonctionne      | 4-6h  |
| **LOAN-015** | Afficher boutons conditionnels selon status : "Marquer rendu" (ACTIVE/AWAITING_RETURN → RETURNED), "Abandonner" (ACTIVE/AWAITING_RETURN → ABANDONED), "Modifier" (notes/returnDate via PATCH), "Supprimer" (soft delete via DELETE, interdit si RETURNED) | LOAN-010            | Boutons corrects selon machine à états (8 statuts) | 2h    |

> **Note LOAN-014** : Le deep linking necessite la configuration des Universal Links (iOS :
> `apple-app-site-association`) et App Links (Android : `assetlinks.json`). L'emprunteur doit obligatoirement disposer
> d'
> un compte Return et etre authentifie dans l'app pour acceder à `ConfirmLoanScreen` (derriere `AuthGuard`). Si
> l'emprunteur n'a pas l'app installee, le lien redirigé vers une page web avec instructions d'installation. Prevoir un
> mécanisme de magic link ou token temporaire pour simplifier le parcours emprunteur. Estimation réaliste : 4-6h (
> configuration platform-specific complexe).

### Phase 4.5 : Tests (Jours 6-7)

| ID           | Titre                                                                                                                                                                                                                         | Dépendance | Critère de Fin                              | Temps |
|--------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------|---------------------------------------------|-------|
| **LOAN-016** | Gérer erreur 400 si returnDate < today + 2 jours. Le calendrier doit bloquer les dates avant J+2 (minDate = aujourd'hui + 2 jours). Message d'erreur : "La date de retour doit être au minimum 2 jours après la date du jour" | LOAN-009   | Message d'erreur affiché, calendrier bloqué | 45min |
| **LOAN-017** | Écrire test RNTL : LoanWizard flow (4 étapes, type OBJECT)                                                                                                                                                                    | LOAN-005   | Test RNTL passe                             | 1h30  |
| **LOAN-018** | Écrire test RNTL : LoanWizard flow (type MONEY)                                                                                                                                                                               | LOAN-005   | Test RNTL passe                             | 1h    |
| **LOAN-019** | Écrire test RNTL : ConfirmationDialog accept/refuse                                                                                                                                                                           | LOAN-007   | Test RNTL passe                             | 1h    |
| **LOAN-020** | Écrire test RNTL : StatusBadge affichage correct par statut (8 statuts)                                                                                                                                                       | LOAN-004   | Test RNTL passe                             | 1h    |
| **LOAN-021** | Ajouter 5 types d'erreur Loans dans `error.ts` + `en.json`/`fr.json` : `loan-not-found`, `daily-loan-limit-exceeded`, `loan-already-returned`, `forbidden-status-transition`, `invalid-status-transition`                     | LOAN-002   | Erreurs mappées et traduites FR/EN          | 30min |
| **LOAN-022** | Écrire tests RNTL : LoanDetailScreen — édition notes/date, suppression prêt, abandon                                                                                                                                          | LOAN-010   | 3 tests RNTL passent                        | 1h30  |

📦 **Livrable Sprint 4** : **Gestion complète des prêts** (workflow 8 statuts, 2 types OBJECT/MONEY,
édition/suppression/abandon, connecté au Mock
Server), couvert par tests RNTL.

---

## Sprint 4.5 : Corrections Intégration & UX Post-Sprint 4 (3 jours)

### Objectif

Corriger les problèmes révélés par les tests d'intégration avec le backend réel :

- **Bug critique** : l'emprunteur ne voit aucun prêt dans "Mes emprunts" (cause backend — voir roadmap backend Sprint
  4.5)
- **UX** : double SegmentedButtons empilés dans `LoanListScreen` (perspective + statut)
- **UX** : onglet "Prêts" ambigu — doit couvrir prêts ET emprunts
- **UX** : profil sans statistiques emprunteur (score de confiance personnel)
- **UX** : `LoanDetailScreen` ne s'adapte pas selon la perspective (prêteur vs emprunteur)
- **UX** : `LoanCard` affiche toujours l'emprunteur, même quand l'utilisateur IS l'emprunteur

> **Dépendance backend** : Les corrections UX frontend (Phase 4.5.2 à 4.5.4) peuvent démarrer en parallèle
> du backend (Phase 4.5.1). Seul le test de bout en bout "emprunteur voit ses prêts" nécessite que le
> listener `@OnEvent('user.registered')` soit implémenté côté backend.

> **Modèle de droits rappel** (ce que l'emprunteur peut et ne peut PAS faire) :
>
> - **Voir** ses prêts reçus (`GET /loans?role=borrower`) ✅
> - **Voir** les détails d'un prêt qui le concerne (`GET /loans/{id}`) ✅
> - **Confirmer** un prêt reçu (`POST /loans/{id}/confirm`) ✅
> - **Contester** un prêt reçu avec raison (`POST /loans/{id}/contest`) ✅
> - **Modifier** un prêt (notes, date retour) ❌ → Seul le prêteur
> - **Supprimer** un prêt ❌ → Seul le prêteur
> - **Marquer rendu / abandonner** ❌ → Seul le prêteur
> - **Créer** un prêt ❌ → Seul le prêteur

### Phase 4.5.1 : Refactoring LoanListScreen — UX contrôles (Jour 1)

| ID            | Titre                                                                                                                                                  | Dépendance | Critère de Fin                                              | Temps |
|---------------|--------------------------------------------------------------------------------------------------------------------------------------------------------|------------|-------------------------------------------------------------|-------|
| **INTEG-F01** | Refactorer `LoanListScreen` : remplacer les 2 SegmentedButtons empilés par un seul contrôle combiné (ex: Chips filtres ou SegmentedButtons + dropdown) | LOAN-008   | Un seul niveau de contrôle visible, UX mobile fluide        | 2h    |
| **INTEG-F02** | Implémenter le comportement combiné : la perspective (prêteur/emprunteur) détermine les données, le filtre (en cours/archives) affine l'affichage      | INTEG-F01  | Changement de perspective recharge les données correctement | 1h    |
| **INTEG-F03** | Masquer le FAB "+" en mode emprunteur (déjà fait, vérifier après refactoring)                                                                          | INTEG-F01  | FAB invisible quand perspective = borrower                  | 15min |

> **Proposition UX** : Utiliser un **SegmentedButtons** pour la perspective (Mes prêts / Mes emprunts) et
> des **Chip** filtres en dessous pour le statut (En cours / Archives), ou intégrer le filtre statut dans
> un menu/dropdown. L'objectif est d'éviter deux barres de boutons identiques empilées. Le choix final
> de l'approche UX est laissé à l'implémenteur.

### Phase 4.5.2 : LoanCard perspective-aware (Jour 1)

| ID            | Titre                                                                                                                                       | Dépendance | Critère de Fin                                                              | Temps |
|---------------|---------------------------------------------------------------------------------------------------------------------------------------------|------------|-----------------------------------------------------------------------------|-------|
| **INTEG-F04** | `LoanCard` : ajouter prop `perspective: 'lender' \| 'borrower'` — afficher le **prêteur** quand `borrower`, l'**emprunteur** quand `lender` | INTEG-F02  | En mode "Mes emprunts", la carte affiche qui a prêté l'objet (pas soi-même) | 45min |

> **Justification** : Actuellement `LoanCard` affiche toujours le nom de l'emprunteur. Quand Bob consulte
> ses emprunts, il voit "Bob" (lui-même) — ça n'a pas de sens. Il devrait voir "Alice" (la personne qui
> lui a prêté l'objet). Le champ `loan.lender` contient déjà cette info.

### Phase 4.5.3 : Renommage onglet navigation (Jour 1)

| ID            | Titre                                                                                                                           | Dépendance | Critère de Fin                                  | Temps |
|---------------|---------------------------------------------------------------------------------------------------------------------------------|------------|-------------------------------------------------|-------|
| **INTEG-F05** | Renommer l'onglet "Prêts" → "Suivi" dans `AppNavigator.tsx` + i18n (`navigation.loans` → `navigation.tracking`)                 | LOAN-013   | Onglet affiché "Suivi" en FR / "Tracking" en EN | 30min |
| **INTEG-F06** | Mettre à jour `fr.json` et `en.json` : ajouter clé `navigation.tracking` + conserver `navigation.loans` pour rétrocompatibilité | INTEG-F05  | i18n FR : "Suivi", EN : "Tracking"              | 15min |

> **Note** : Le terme "Suivi" est neutre et englobe à la fois le suivi des prêts (prêteur) et le suivi des emprunts
> (emprunteur). Le terme "Transaction" est interdit par le vocabulaire du projet (voir `CLAUDE.md`).
> **Alternative** : "Prêts & Emprunts" — plus explicite mais long pour un onglet mobile. À valider en équipe.

### Phase 4.5.4 : LoanDetailScreen — adaptation par perspective (Jour 2)

> **C'est la tâche la plus importante du Sprint 4.5 côté frontend.** Aujourd'hui, l'écran de détail
> affiche les mêmes boutons pour tout le monde (Modifier, Supprimer, Abandonner, Marquer rendu).
> L'emprunteur ne devrait voir que Confirmer et Contester.

| ID            | Titre                                                                                                                                               | Dépendance | Critère de Fin                                              | Temps |
|---------------|-----------------------------------------------------------------------------------------------------------------------------------------------------|------------|-------------------------------------------------------------|-------|
| **INTEG-F07** | Déterminer la perspective dans `LoanDetailScreen` : comparer `loan.lender.id` avec `authStore.user.id` — si identique → prêteur, sinon → emprunteur | LOAN-010   | Variable `isLender` / `isBorrower` calculée automatiquement | 30min |
| **INTEG-F08** | Afficher les boutons conditionnels selon la perspective :                                                                                           |            |                                                             |       |
|               | — **Prêteur** : Modifier, Supprimer, Marquer rendu, Abandonner (comportement actuel)                                                                |            |                                                             |       |
|               | — **Emprunteur** : Confirmer, Contester (uniquement si statut = `PENDING_CONFIRMATION`)                                                             | INTEG-F07  | Les bons boutons apparaissent selon le rôle                 | 2h    |
| **INTEG-F09** | Navigation vers `ConfirmLoanScreen` depuis le bouton "Confirmer" dans le détail (emprunteur)                                                        | INTEG-F08  | Tap "Confirmer" → ouvre le dialog de confirmation           | 30min |
| **INTEG-F10** | Adapter la section "Contact" dans le détail : afficher le **prêteur** (quand emprunteur regarde) ou l'**emprunteur** (quand prêteur regarde)        | INTEG-F07  | Le bon contact est affiché selon la perspective             | 30min |

> **Boutons emprunteur détaillés** :
> | Statut du prêt | Boutons visibles pour l'emprunteur |
> |---|---|
> | `PENDING_CONFIRMATION` | "Confirmer la réception" + "Contester" |
> | `ACTIVE` / `ACTIVE_BY_DEFAULT` / `AWAITING_RETURN` | Aucun bouton (lecture seule) |
> | `RETURNED` / `NOT_RETURNED` / `ABANDONED` / `CONTESTED` | Aucun bouton (prêt clos) |

### Phase 4.5.5 : Statistiques emprunteur dans le profil (Jour 2)

| ID            | Titre                                                                                                                                                                  | Dépendance | Critère de Fin                                                                 | Temps |
|---------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------|--------------------------------------------------------------------------------|-------|
| **INTEG-F11** | Créer composant `BorrowerStats` : charge les prêts via `fetchLoans({ role: 'borrower' })` et calcule les métriques                                                     | LOAN-001   | Composant affiche : prêts reçus, rendus à temps, en retard, score de confiance | 2h    |
| **INTEG-F12** | Intégrer `BorrowerStats` dans `ProfileScreen` sous `LenderStats`                                                                                                       | INTEG-F11  | Deux cards de stats visibles dans le profil (prêteur + emprunteur)             | 30min |
| **INTEG-F13** | Ajouter clés i18n pour `BorrowerStats` : `profile.borrowerStatistics`, `profile.loansReceived`, `profile.returnedOnTime`, `profile.returnedLate`, `profile.trustScore` | INTEG-F11  | Clés disponibles en FR et EN                                                   | 15min |

> **Calcul du score de confiance** : `(returnedOnTime * 100 + returnedLate * 50) / totalLoans`
> (formule identique à `BorrowerStatistics.trustScore` dans l'OpenAPI). Le calcul est fait côté client
> à partir des prêts chargés via `useLoanStore.fetchLoans({ role: 'borrower', includeArchived: true })`.
> Les statuts pris en compte : `RETURNED` (vérifié si avant/après `returnDate`) pour `returnedOnTime`/`returnedLate`,
> `NOT_RETURNED` et `ABANDONED` pour non rendus.

### Phase 4.5.6 : MSW Handlers + Tests (Jour 3)

| ID            | Titre                                                                                                                                     | Dépendance         | Critère de Fin                                                               | Temps |
|---------------|-------------------------------------------------------------------------------------------------------------------------------------------|--------------------|------------------------------------------------------------------------------|-------|
| **INTEG-F14** | MSW : `GET /loans` handler doit respecter le param `role` — retourner des mocks différents selon la perspective                           | INTEG-F02          | En mode borrower, le mock retourne des prêts où l'utilisateur est emprunteur | 45min |
| **INTEG-F15** | Écrire test RNTL : `LoanListScreen` — contrôle combiné perspective/statut fonctionne                                                      | INTEG-F02          | Test RNTL passe                                                              | 1h    |
| **INTEG-F16** | Écrire test RNTL : `LoanDetailScreen` — boutons corrects selon perspective (emprunteur: confirmer/contester, prêteur: modifier/supprimer) | INTEG-F08          | 2 tests RNTL passent                                                         | 1h30  |
| **INTEG-F17** | Écrire test RNTL : onglet "Suivi" affiché dans la navigation                                                                              | INTEG-F05          | Test RNTL passe                                                              | 30min |
| **INTEG-F18** | Écrire test RNTL : `BorrowerStats` affiche les métriques calculées                                                                        | INTEG-F11          | Test RNTL passe                                                              | 1h    |
| **INTEG-F19** | Écrire test RNTL : `LoanCard` affiche le prêteur en mode borrower, l'emprunteur en mode lender                                            | INTEG-F04          | Test RNTL passe                                                              | 30min |
| **INTEG-F20** | Test bout en bout : créer un prêt (prêteur) → vérifier qu'il apparaît dans "Mes emprunts" (emprunteur)                                    | INTEG-F02, backend | Test fonctionnel valide (nécessite backend Sprint 4.5)                       | 1h    |
| **INTEG-F21** | Vérifier que tous les tests existants (150+) passent après les modifications                                                              | INTEG-F15..F20     | `npx jest --verbose` : 0 échecs                                              | 30min |

📦 **Livrable Sprint 4.5** : **Perspective emprunteur complète** (onglet "Suivi", contrôle unique
perspective/statut, `LoanCard` et `LoanDetailScreen` adaptatifs, boutons conditionnels par rôle,
statistiques emprunteur en profil, MSW handlers perspective-aware), couverte par tests RNTL.

---

## Sprint 4.6 : Contact Invitation System (5 jours)

> **Statut (resync 28/10/2026)** : ✅ **LIVRÉ** (mergé ; le système d'invitation est branché sur l'API réelle).

### Objectif

Implémenter le système d'invitation de contacts côté frontend : un prêteur peut chercher des utilisateurs inscrits,
leur envoyer une invitation, et l'emprunteur peut l'accepter ou la refuser. Le `LoanWizard` est adapté pour n'autoriser
que les contacts avec invitation ACCEPTED comme emprunteur.

### Phase 4.6.1 : Store + Types + MSW (Jour 1)

| ID            | Titre                                                                                                                                                                                                                                                                                                                                                                                                                                            | Dépendance | Critère de Fin                                                               | Temps |
|---------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------|------------------------------------------------------------------------------|-------|
| **CINV-F001** | Ajouter type `ContactInvitation` (avec `recipientUser`, `rejectedAt`) et `UserSearchResult` (avec `alreadyContact`, `pendingInvitation?: boolean`, `pendingInvitationId?: string \| null`) dans `api.types.ts`. Ajouter types `SearchUsersDto` et `SendInvitationDto`. Modifier `CreateLoanDto` : remplacer `borrower: CreateBorrowerDto \| string` par `borrowerId: string` (UUID only, création inline supprimée — cf. OpenAPI `POST /loans`). | -          | Types exportés, `InvitationStatus` enum inclus, `CreateLoanDto` mis à jour   | 45min |
| **CINV-F002** | Créer `useContactInvitationStore` Zustand : `fetchReceivedInvitations` (`?direction=received&status=PENDING`), `fetchSentInvitations` (`?direction=sent`), `searchUsers(query, page?, limit?)` (pagination dans le body — cf. OpenAPI), `sendInvitation`, `acceptInvitation`, `rejectInvitation`, `cancelInvitation`                                                                                                                             | CINV-F001  | Store créé avec actions async try/catch, direction + status params supportés | 1h30  |
| **CINV-F003** | Créer MSW handlers pour les 7 endpoints `/contact-invitations/*` (incl. `?direction=sent`)                                                                                                                                                                                                                                                                                                                                                       | CINV-F001  | Handlers ajoutés dans `handlers.ts`, mock opérationnel                       | 1h    |
| **CINV-F004** | Tests unitaires `useContactInvitationStore` (fetch received, fetch sent, send, accept, reject, cancel)                                                                                                                                                                                                                                                                                                                                           | CINV-F002  | 6 tests RNTL passent                                                         | 1h30  |

### Phase 4.6.2 : SearchBorrowerScreen (Jour 2)

| ID            | Titre                                                                                                                                                                                                                                                     | Dépendance | Critère de Fin                                             | Temps |
|---------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------|------------------------------------------------------------|-------|
| **CINV-F005** | Créer `SearchBorrowerScreen` : barre de recherche (email / prénom / nom) + FlatList résultats                                                                                                                                                             | CINV-F002  | Écran affiché, recherche déclenche l'action                | 1h30  |
| **CINV-F006** | Créer composant `UserSearchResultItem` : affiche nom + email + badge (déjà contact / pending / nouveau)                                                                                                                                                   | CINV-F005  | Badges corrects selon le statut de la relation             | 1h    |
| **CINV-F007** | Bouton "Inviter" dans `UserSearchResultItem` → appelle `sendInvitation()` → badge passe à "En attente" ; bouton "Annuler" si `pendingInvitationId` présent (`?? null` — champ optionnel dans l'OpenAPI) → appelle `cancelInvitation(pendingInvitationId)` | CINV-F006  | Invitation envoyée/annulée, badge mis à jour sans re-fetch | 1h    |

### Phase 4.6.3 : BorrowerInvitationsScreen + SentInvitationsScreen (Jour 3)

| ID             | Titre                                                                                                                                                                                 | Dépendance | Critère de Fin                                                | Temps |
|----------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------|---------------------------------------------------------------|-------|
| **CINV-F008**  | Créer `BorrowerInvitationsScreen` : liste des invitations PENDING reçues (nom prêteur, date)                                                                                          | CINV-F002  | Écran affiche les invitations                                 | 1h    |
| **CINV-F009**  | Bouton "Accepter" → `acceptInvitation()` → invitation disparaît de la liste                                                                                                           | CINV-F008  | Contact créé, liste mise à jour                               | 1h    |
| **CINV-F010**  | Bouton "Refuser" → `rejectInvitation()` → invitation disparaît de la liste                                                                                                            | CINV-F008  | Invitation rejetée, liste mise à jour                         | 30min |
| **CINV-F010b** | Créer `SentInvitationsScreen` : liste des invitations envoyées par le prêteur (`?direction=sent`) avec statut (PENDING/ACCEPTED/REJECTED/EXPIRED) + bouton "Annuler" pour les PENDING | CINV-F002  | Écran affiche les invitations envoyées, annulation fonctionne | 1h30  |
| **CINV-F011**  | Badge numérique sur l'onglet Contacts indiquant le nombre d'invitations PENDING reçues                                                                                                | CINV-F008  | Badge visible dans la tab bar                                 | 1h    |

### Phase 4.6.4 : Navigation + Intégration LoanWizard (Jour 4)

| ID            | Titre                                                                                                                                                                                                                                                                                                                                                                            | Dépendance | Critère de Fin                                                                                            | Temps |
|---------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------|-----------------------------------------------------------------------------------------------------------|-------|
| **CINV-F012** | Ajouter `SearchBorrower`, `BorrowerInvitations`, et `SentInvitations` dans `BorrowerStackParamList`                                                                                                                                                                                                                                                                              | CINV-F005  | Navigation typée mise à jour                                                                              | 30min |
| **CINV-F013** | `BorrowerListScreen` : bouton "+" navigue vers `SearchBorrowerScreen` + lien "Invitations envoyées" vers `SentInvitationsScreen`                                                                                                                                                                                                                                                 | CINV-F012  | Navigation fonctionne                                                                                     | 30min |
| **CINV-F014** | `LoanWizard` step 3 (sélection emprunteur) : sélection par UUID uniquement parmi contacts ACCEPTED. Supprimer la création inline (`BorrowerForm`, `showBorrowerDialog`, `handleInlineBorrowerCreate`, Dialog Portal borrower). Adapter `handleSubmit()` : `borrower: selectedBorrowerId!` → `borrowerId: selectedBorrowerId!` (aligné avec `CreateLoanDto` modifié en CINV-F001) | CINV-F012  | Seuls les contacts acceptés sont sélectionnables, `borrowerId` UUID envoyé, code inline borrower supprimé | 1h30  |
| **CINV-F015** | Gérer le cas "aucun contact accepté" dans `LoanWizard` : message + lien vers `SearchBorrowerScreen`                                                                                                                                                                                                                                                                              | CINV-F014  | Message clair si liste vide                                                                               | 30min |

### Phase 4.6.5 : Tests RNTL + Buffer (Jour 5)

| ID             | Titre                                                                                                                                   | Dépendance      | Critère de Fin                  | Temps |
|----------------|-----------------------------------------------------------------------------------------------------------------------------------------|-----------------|---------------------------------|-------|
| **CINV-F016**  | Test RNTL : `SearchBorrowerScreen` — recherche, affichage résultats, badge statut                                                       | CINV-F006       | Test passe                      | 1h    |
| **CINV-F017**  | Test RNTL : `SearchBorrowerScreen` — bouton "Inviter" met à jour le badge en "En attente" ; bouton "Annuler" avec `pendingInvitationId` | CINV-F007       | Test passe                      | 45min |
| **CINV-F018**  | Test RNTL : `BorrowerInvitationsScreen` — affichage liste, acceptation, refus                                                           | CINV-F009       | Test passe                      | 1h    |
| **CINV-F018b** | Test RNTL : `SentInvitationsScreen` — affichage liste envoyée, annulation d'une invitation PENDING                                      | CINV-F010b      | Test passe                      | 1h    |
| **CINV-F019**  | Test RNTL : `LoanWizard` — step 3 n'affiche que les contacts ACCEPTED, envoie `borrowerId` UUID                                         | CINV-F014       | Test passe                      | 1h    |
| **CINV-F020**  | Smoke test end-to-end (mock) : inviter → accepter → créer prêt pour le contact                                                          | tous            | Flow complet fonctionne         | 1h    |
| **CINV-F021**  | Buffer review + fix bugs + vérification que les 150+ tests existants passent toujours                                                   | CINV-F016..F020 | `npx jest --verbose` : 0 échecs | 1h30  |

📦 **Livrable Sprint 4.6** : **Contact Invitation System** (store Zustand + MSW handlers + `SearchBorrowerScreen` +
`BorrowerInvitationsScreen` + `SentInvitationsScreen` + navigation intégrée + `LoanWizard` adapté `borrowerId` UUID
only),
couvert par 10+ tests RNTL.

---

## Sprint 5 : Conteneurisation + Validation J+2 + Notifications (5 jours)

> **Statut (resync 28/10/2026)** : ✅ **LIVRÉ** (Docker dev, validation J+2, notifications). Écart avec le texte
> ci-dessous : le push ne passe **pas** par FCM natif (NOTIF-001/010) mais par l'**Expo Push Service**
> (`getExpoPushTokenAsync` côté front, `expo-server-sdk` côté back — cf. CORR-13, doc 11).

### Objectif

1. **Conteneuriser l'environnement de développement frontend** : un `docker compose up` lance tout (postgres + redis + backend + frontend Expo Web). Environnement identique pour tous les développeurs.
2. **Valider la contrainte de date retour minimum J+2** côté frontend (calendrier bloqué).
3. **Recevoir et gérer les notifications push**. Les rappels sont 100% automatiques côté backend (pas de rappels manuels en V1). Ce sprint concerne uniquement : recevoir les push, afficher la liste des notifications, marquer comme lu.

> **Note** : Le frontend est servi en **Expo Web uniquement** dans le conteneur Docker. Les tests sur device physique (iOS/Android) ne sont pas couverts par la conteneurisation — le navigateur en mode responsive suffit pour le développement.

### Phase 5.0 : Conteneurisation Dev (Jour 1)

| ID            | Titre                                                                                                                                                                                      | Dépendance | Critère de Fin                                                             | Temps |
|---------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------|----------------------------------------------------------------------------|-------|
| **DOCK-001**  | Créer `frontend/Dockerfile.dev` (base `node:22-slim`, `npm ci`, expose port 8081, CMD `npx expo start --web`, volume pour hot reload)                                                      | SETUP-001  | `docker build` frontend réussit                                            | 45min |
| **DOCK-002**  | Créer `backend/Dockerfile.dev` (base `node:22-slim`, `npm ci`, `prisma generate`, CMD `npx nest start --watch`, volume pour hot reload)                                                    | SETUP-001  | `docker build` backend dev réussit                                         | 45min |
| **DOCK-003**  | Mettre à jour `docker-compose.yml` : ajouter services `backend` et `frontend` avec volumes source montés, `depends_on` postgres/redis, variables d'environnement (`DATABASE_URL`, etc.)    | DOCK-001, DOCK-002 | `docker compose up` démarre les 4 services sans erreur             | 1h    |
| **DOCK-004**  | Créer `frontend/.dockerignore` et `backend/.dockerignore` (exclure `node_modules/`, `.expo/`, `dist/`, `.env`)                                                                             | -          | Build context léger (< 5 MB sans node_modules)                             | 15min |
| **DOCK-005**  | Valider le hot reload : modifier un fichier `.tsx` → Expo Web se rafraîchit ; modifier un fichier `.ts` backend → NestJS redémarre                                                         | DOCK-003   | Hot reload fonctionnel dans les 2 conteneurs                               | 30min |
| **DOCK-006**  | Valider la communication frontend ↔ backend : le frontend peut appeler `http://backend:3000/v1` depuis le conteneur                                                                        | DOCK-003   | Requête API réussie depuis le frontend conteneurisé                        | 30min |

> **Note** : Les `node_modules` sont installés **dans le conteneur** (`npm ci`), pas montés en volume. Cela évite les conflits de binaires natifs entre OS (ex: `bcrypt`). Seuls les répertoires source (`src/`, `assets/`) sont montés.

### Phase 5.0b : Validation Date Retour J+2 (Jour 1)

| ID            | Titre                                                                                                                                                         | Dépendance | Critère de Fin                                              | Temps |
|---------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|------------|-------------------------------------------------------------|-------|
| **VALID-001** | `LoanWizard` step 4 : ajouter `minDate = today + 2 jours` sur le composant `Calendar`. Les dates avant J+2 sont grisées/non sélectionnables                 | LOAN-005   | Calendrier bloqué avant J+2                                 | 30min |
| **VALID-002** | `LoanDetailScreen` (dialog édition) : même contrainte `minDate = aujourd'hui + 2 jours` sur le Calendar                                                        | LOAN-010   | Calendrier édition bloqué avant J+2                         | 30min |
| **VALID-003** | Ajouter clés i18n `loans.returnDateTooSoon` : FR "La date de retour doit être au minimum 2 jours après le prêt" / EN "Return date must be at least 2 days after the loan" | VALID-001  | Clés disponibles FR + EN                                    | 15min |
| **VALID-004** | Mapper le type d'erreur backend `return-date-too-soon` dans `error.ts` + affichage via `getErrorMessage()`                                                    | VALID-003  | Erreur 400 backend affichée correctement                    | 15min |
| **VALID-005** | Test RNTL : vérifier que les dates avant J+2 ne sont pas sélectionnables dans `LoanWizard`                                                                   | VALID-001  | Test RNTL passe                                             | 45min |

### Phase 5.1 : Setup Notifications (Jour 2)

| ID            | Titre                                                                 | Dépendance | Critère de Fin                            | Temps |
|---------------|-----------------------------------------------------------------------|------------|-------------------------------------------|-------|
| **NOTIF-001** | Installer Firebasé Cloud Messaging (FCM) SDK via Expo                 | SETUP-001  | FCM initialise, token device récupéré     | 2h    |
| **NOTIF-002** | Configurer gestion des notifications foreground/background            | NOTIF-001  | Notification affichée même si app ouverte | 1h30  |
| **NOTIF-003** | Créer service `notificationService.ts` (subscribe/unsubscribe topics) | NOTIF-001  | Service créé                              | 1h    |

### Phase 5.2 : Gestion d'État (Zustand Store) (Jour 2)

| ID            | Titre                                                                   | Dépendance | Critère de Fin             | Temps |
|---------------|-------------------------------------------------------------------------|------------|----------------------------|-------|
| **NOTIF-004** | Créer `useNotificationStore` (state: notifications[], unreadCount)      | SETUP-006  | Store créé                 | 1h    |
| **NOTIF-005** | Créer actions `fetchNotifications()`, `markAsRead()`, `markAllAsRead()` | NOTIF-004  | Actions appellent API mock | 1h30  |

### Phase 5.3 : Composants UI (Dumb) (Jour 3)

| ID            | Titre                                                                    | Dépendance | Critère de Fin            | Temps |
|---------------|--------------------------------------------------------------------------|------------|---------------------------|-------|
| **NOTIF-006** | Créer composant `NotificationCard` (affichage notif avec badge "non lu") | SETUP-007  | Card affichée dans liste  | 1h    |
| **NOTIF-007** | Créer composant `NotificationBadge` (badge rouge avec count sur icone)   | SETUP-007  | Badge affiché dans header | 45min |

### Phase 5.4 : Écrans (Smart Components) (Jour 3)

| ID            | Titre                                                                                      | Dépendance           | Critère de Fin                                    | Temps |
|---------------|--------------------------------------------------------------------------------------------|----------------------|---------------------------------------------------|-------|
| **NOTIF-008** | Créer écran `NotificationListScreen` (FlatList de NotificationCard avec filtre unreadOnly) | NOTIF-005, NOTIF-006 | Liste paginée avec bouton "Tout marquer comme lu" | 1h30  |
| **NOTIF-009** | Ajouter NotificationBadge dans header                                                      | NOTIF-005, NOTIF-007 | Badge mis à jour en temps réel                    | 1h    |

### Phase 5.5 : Intégration + Tests (Jour 4-5)

| ID            | Titre                                                     | Dépendance          | Critère de Fin                       | Temps |
|---------------|-----------------------------------------------------------|---------------------|--------------------------------------|-------|
| **NOTIF-010** | Simuler reception notification push (via Postman → FCM)   | NOTIF-002           | Notification reçue et affichée       | 1h    |
| **NOTIF-011** | Navigation depuis notification push vers LoanDetailScreen | NOTIF-002, LOAN-010 | Tap sur notif ouvre le prêt concerne | 1h30  |
| **NOTIF-012** | Écrire test RNTL : NotificationCard mark as read          | NOTIF-006           | Test RNTL passe                      | 1h    |
| **NOTIF-013** | Écrire test RNTL : NotificationBadge affichage count      | NOTIF-007           | Test RNTL passe                      | 45min |

📦 **Livrable Sprint 5** : **Environnement Docker unifié** (`docker compose up` → 4 services, Expo Web uniquement) + **Validation date retour J+2** (calendrier bloqué, erreur i18n) + **Notifications push** (reception, liste, lecture, navigation vers prêt concerne), couverts par tests RNTL.

---

## Sprint 6 : Module History + Dashboard (4 jours)

> **Statut (resync 28/10/2026)** : ◐ **PARTIEL — périmètre réduit acté** (CORR-14, doc 11). Les écrans prévus ci-dessous
> (`DashboardScreen`, `StatisticsScreen`, onglet « Historique », `PieChart`, `TopBorrowersList`) ont été retirés
> (commit `e4e1358`) et **ne sont pas livrés** ; le Dashboard dédié est post-échéance. Livré à la place : un écran
> `HistoryScreen` (liste paginée des prêts archivés, filtre par statut) accessible depuis le **Profil** (FEAT-07, doc 16),
> et les statistiques de base dans `LenderStats` (profil). Les filtres par date et par emprunteur (HIST-007) ne sont pas
> livrés.

### Objectif

Statistiques + Historique archivé + Écran Dashboard avec overview.

### Phase 6.1 : Gestion d'État (Zustand Store)

| ID           | Titre                                                            | Dépendance | Critère de Fin             | Temps |
|--------------|------------------------------------------------------------------|------------|----------------------------|-------|
| **HIST-001** | Créer `useHistoryStore` (state: archivedLoans[], statistics)     | SETUP-006  | Store créé                 | 1h    |
| **HIST-002** | Créer actions `fetchArchivedLoans(filters)`, `fetchStatistics()` | HIST-001   | Actions appellent API mock | 1h30  |

### Phase 6.2 : Composants UI (Dumb)

| ID           | Titre                                                                     | Dépendance | Critère de Fin               | Temps |
|--------------|---------------------------------------------------------------------------|------------|------------------------------|-------|
| **HIST-003** | Créer composant `StatCard` (KPI : nb prêts actifs, taux de retour, etc.)  | SETUP-007  | Card avec chiffre + icone    | 1h    |
| **HIST-004** | Créer composant `PieChart` (repartition par categorie via Victory Native) | SETUP-001  | Graphique circulaire affiché | 2h    |
| **HIST-005** | Créer composant `TopBorrowersList` (top 5 emprunteurs les plus frequents) | SETUP-007  | Liste avec trustScore badge  | 1h    |

### Phase 6.3 : Écrans (Smart Components)

| ID           | Titre                                                                        | Dépendance                             | Critère de Fin                   | Temps |
|--------------|------------------------------------------------------------------------------|----------------------------------------|----------------------------------|-------|
| **HIST-006** | Créer écran `DashboardScreen` (4 StatCard + PieChart + boutons rapides)      | HIST-002, HIST-003, HIST-004           | Dashboard complet affiché        | 2h    |
| **HIST-007** | Créer écran `HistoryScreen` (liste archivedLoans avec filtres date + status) | HIST-002                               | Liste paginée avec filtres       | 1h30  |
| **HIST-008** | Créer écran `StatisticsScreen` (StatCards + PieChart + TopBorrowersList)     | HIST-002, HIST-003, HIST-004, HIST-005 | Statistiques complètes affichées | 2h    |

### Phase 6.4 : Navigation + Tests

| ID           | Titre                                                      | Dépendance          | Critère de Fin                | Temps |
|--------------|------------------------------------------------------------|---------------------|-------------------------------|-------|
| **HIST-009** | Ajouter onglet "Historique" dans Tab Navigator             | SETUP-003, HIST-007 | Onglet accessible             | 30min |
| **HIST-010** | Definir DashboardScreen comme écran par defaut après login | AUTH-019, HIST-006  | Dashboard affiché après login | 30min |
| **HIST-011** | Écrire test RNTL : StatCard affichage KPIs                 | HIST-003            | Test RNTL passe               | 1h    |

📦 **Livrable Sprint 6** : **Dashboard + Statistiques + Historique** (connectés au Mock Server), couverts par tests RNTL.

---

## Basculement Mock → Backend Réel

> **⚠️ SECTION OBSOLÈTE (resync 28/10/2026)** : tous les modules sont déjà basculés sur l'API réelle
> (`frontend/src/config/api-modules.config.ts`, backend `return-api.fly.dev`). Le mécanisme `MOCK_MODULES` /
> `apiClient.ts` et l'URL `api.return.app` décrits ci-dessous ne reflètent plus le code. Conservée pour l'historique.

### Stratégie de Basculement Progressif

**Principe** : Ne pas tout basculer d'un coup. Activer module par module.

| Sprint Backend Termine   | Module à Basculer         | Action Frontend                                                     | Temps                          |
|--------------------------|---------------------------|---------------------------------------------------------------------|--------------------------------|
| **Sprint 1 (Auth)**      | Auth + Users              | `USE_MOCK=false` pour endpoints `/auth/*` et `/users/*`             | 1h                             |
| **Sprint 2 (Borrowers)** | Borrowers                 | `USE_MOCK=false` pour endpoints `/borrowers/*`                      | 30min                          |
| **Sprint 3 (Items)**     | Items (Photos + R2)       | `USE_MOCK=false` pour endpoints `/items/*`                          | 1h (tester upload réel)        |
| **Sprint 4 (Loans)**     | Loans                     | `USE_MOCK=false` pour endpoints `/loans/*`                          | 1h30 (tester workflow statuts) |
| **Sprint 5 (Reminders)** | Reminders + Notifications | `USE_MOCK=false` pour endpoints `/reminders/*` + `/notifications/*` | 1h30 (tester push réel)        |
| **Sprint 6 (History)**   | History                   | `USE_MOCK=false` pour endpoints `/history/*`                        | 30min                          |

> **Buffer** : Prevoir 1 journee de buffer global pour le debugging d'intégration (différénces de format de date,
> pagination, headers entre Prism mock et backend réel).

**Implémentation dans `apiClient.ts`** :

```typescript
const MOCK_MODULES: Record<string, boolean> = {
    auth: false, // Backend réel active
    borrowers: false, // Backend réel active
    items: true, // Mock encore actif
    loans: true, // Mock encore actif
    reminders: true, // Mock encore actif
    notifications: true, // Mock encore actif
    history: true, // Mock encore actif
};

export const API_BASE_URL = (endpoint: string): string => {
    const module = endpoint.split('/')[1]; // Ex: /auth/login → 'auth'

    if (MOCK_MODULES[module]) {
        return 'http://localhost:3000/v1'; // Prism Mock Server (dev uniquement)
    } else {
        return __DEV__
            ? 'http://localhost:3001/v1' // Backend local
            : 'https://api.return.app/v1'; // Production
    }
};
```

> **Note** : Pas d'URL de staging mock. Deux environnements uniquement : `localhost` pour le développement,
> `api.return.app` pour la production.

**Checklist de Basculement (par module)** :

- [ ] Tests RNTL rejoues avec backend réel
- [ ] Smoke tests manuels des parcours principaux
- [ ] Tests d'intégration Supertest cote backend valides
- [ ] Gestion d'erreurs testee (401, 403, 404, 409, 429, 500)
- [ ] Upload de photos teste (si module Items)
- [ ] Notifications push testees (si module Reminders)

> **Post-MVP** : Des tests Detox E2E seront ajoutes pour valider les flows critiques de bout en bout (login → création
> prêt → confirmation → retour) une fois le MVP stabilise.

---

## Résumé des Sprints Frontend

| Sprint         | Durée        | Modules                      | Écrans livres                                                                                                                        | Tests RNTL    |
|----------------|--------------|------------------------------|--------------------------------------------------------------------------------------------------------------------------------------|---------------|
| **Sprint 0**   | 3-4 jours    | Setup infrastructuré         | 0                                                                                                                                    | CI/CD setup   |
| **Sprint 1**   | 5 jours      | Auth + Profil + Settings     | 7 (Login, Register, Profile, EditProfile, ChangePassword, DeleteAccount, Settings)                                                   | 6 tests       |
| **Sprint 2**   | 4 jours      | Borrowers                    | 4 (List, Create, Detail, Edit)                                                                                                       | 2 tests       |
| **Sprint 3**   | 4 jours      | Items (Photos)               | 4 (List, Create, Detail, Edit)                                                                                                       | 2 tests       |
| **Sprint 4**   | 8 jours      | Avatar + Loans               | 5 (List, Create, Detail, Confirm, Return) + avatar profil                                                                            | 4+3+3 tests   |
| **Sprint 4.5** | 3 jours      | Corrections intégration + UX | 0 (refactoring LoanListScreen + LoanDetailScreen adaptatif + LoanCard perspective + BorrowerStats + renommage onglet + MSW handlers) | 8 tests       |
| **Sprint 4.6** | 5 jours      | Contact Invitation System    | 2 (SearchBorrowerScreen + BorrowerInvitationsScreen) + navigation adaptée                                                            | 8+ tests      |
| **Sprint 5**   | 5 jours      | Docker Dev + Validation J+2 + Notifications | 1 (NotificationList) + header badge + Dockerfiles dev + validation calendrier J+2                                      | 3 tests       |
| **Sprint 6**   | 4 jours      | Dashboard + History          | 3 prévus (Dashboard, History, Statistics) — **réalisé : 1 (History, via le Profil)**, cf. note du Sprint 6                           | 1 test        |
| **TOTAL**      | **41-45 j.** | **7 modules + 1 correctif**  | **24 écrans**                                                                                                                        | **22+ tests** |

---

## Points de Synchronisation Frontend/Backend

| Moment                     | Frontend basculé vers                | Backend disponible                                              |
|----------------------------|--------------------------------------|-----------------------------------------------------------------|
| **Fin Sprint 1 Backend**   | Auth + Users + Settings réel         | `/auth/*` + `/users/me` + `/users/me/settings`                  |
| **Fin Sprint 2 Backend**   | Borrowers réel                       | `/borrowers/*`                                                  |
| **Fin Sprint 3 Backend**   | Items réel (Photos + R2)             | `/items/*`                                                      |
| **Fin Sprint 4 Backend**   | Loans réel (workflow complet)        | `/loans/*`                                                      |
| **Fin Sprint 4.5 Backend** | Perspective emprunteur fonctionnelle | `Borrower.userId` lié + `GET /loans?role=borrower` correct      |
| **Fin Sprint 4.6 Backend** | Système d'invitation de contacts     | `/contact-invitations/*` — 6 endpoints + consentement explicite |
| **Fin Sprint 5 Backend**   | Notifications réelles (FCM)          | `/reminders/*` + `/notifications/*`                             |
| **Fin Sprint 6 Backend**   | History + Déploiement réel           | `/history/*` + `/borrowers/{id}/loans`                          |

---

## Checklist de Fin de Sprint

A valider avant de passer au sprint suivant :

- [ ] Tous les écrans sont accessibles et navigables
- [ ] Tous les tests RNTL passent
- [ ] CI/CD passe sur `main`
- [ ] Gestion d'erreurs RFC 7807 implémentee (toasts ou modales)
- [ ] Formulaires valides cote client (react-hook-form)
- [ ] Code review approuve (1 approval)
- [ ] i18n : textes utilisateur disponibles en FR et EN

---

**Co-validé par** : Esdras GBEDOZIN & Ismael AIHOU
**Date de dernière mise à jour** : 7 mars 2026
**Version** : 1.4 — Alignement Sprint 4.6 avec OpenAPI (CINV-F001 CreateLoanDto, CINV-F002 status param, CINV-F007
pendingInvitationId optionnel, CINV-F014 handleSubmit)
