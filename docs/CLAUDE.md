# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

**Return** est une application mobile de suivi de prêts d'objets personnels et d'argent. Elle permet aux utilisateurs
d'enregistrer des prêts, suivre les échéances et envoyer des rappels diplomatiques aux emprunteurs.

**Statut actuel** : phase **pré-production** (octobre 2026). Sprints 1 à 6 livrés (Auth, Borrowers, Items/Photos,
Loans, Contact Invitations, Notifications, History/Dashboard). Backend déployé sur Fly.io (`return-api.fly.dev`),
frontend branché dessus, builds EAS Android/iOS. Depuis le 25/10/2026, l'équipe travaille **par fonctionnalité** :
chacun porte sa feature de bout en bout (back + front + tests + doc). Sprint `16_ROADMAP_FEATURES.md` en prod depuis le D2 (31/10) ; plan en cours : `17_ROADMAP_CORRECTIFS_POST_D2.md`.

## Stack Technique

- **Backend** : NestJS 11.x (TypeScript 5.8+), Monolithe Modulaire, Prisma 6.x+ ORM
- **Frontend** : React Native 0.78+ (TypeScript), Zustand 5.x, React Navigation 7.x, React Native Paper
- **Base de données** : PostgreSQL 17+ (principal) + Redis 8.x (cache, blacklist JWT ; pas de BullMQ : les CRON tournent in-process, cf. CORR-09)
- **Stockage photos** : Cloudflare R2 (S3-compatible) en production à partir du déploiement D2 (code livré, bascule pilotée par les variables `R2_*`), `LocalPhotoStorageService` (filesystem) en dev
- **Infrastructure** : Fly.io (Europe West), Docker, GitHub Actions CI/CD
- **Auth** : JWT (access token 15min + refresh token 30j) via Passport.js, révocation immédiate via Redis blacklist
- **Tests** : Jest, Supertest (backend, e2e sans base réelle : Prisma ou services simulés), React Native Testing Library (frontend), Detox (post-MVP E2E)
- **Logs** : Winston (JSON structuré, console transport uniquement)
- **Validation** : class-validator + class-transformer (NestJS ValidationPipe)
- **i18n** : FR + EN (app + notifications push) via react-i18next

## Modules Métier

Modules NestJS découplés par événements (EventEmitter2 + @OnEvent) :

- **Auth** : Authentification JWT (login, register, refresh, logout avec blacklist Redis)
- **Users** : Comptes, profils, avatar, rôles contextuels (Lender, Borrower)
- **Borrowers** : Contacts/emprunteurs (CRUD, trustScore dénormalisé)
- **Items** : Objets prêtés (CRUD, photos max 5, catégories, valeur estimée)
- **Loans** : Cycle de vie des prêts (8 statuts, types OBJECT/MONEY) — Sprint 4
- **ContactInvitations** : Invitations entre utilisateurs inscrits (recherche, envoi, acceptation, rejet, expiration) — Sprint 4.6
- **Reminders** : Rappels automatiques (CRON `@nestjs/schedule` in-process, BullMQ non implémenté) — politique fixe avec PREVENTIVE adaptatif (J-3 si Δ≥3, sinon J-1), J, J+7, J+14, J+21. Date retour minimum J+2. — Sprint 5
- **Notifications** : Push via Expo Push Service (`expo-server-sdk`) en V1. Email, SMS en V2+.
- **History** : Prêts archivés (`GET /history/loans`) et statistiques du prêteur (`GET /history/statistics`).
- **Dashboard** : Pas de module backend dédié ; les chiffres clés viennent des statistiques du module History
  (profil prêteur).

## Architecture & Patterns Obligatoires

- **SOLID strict** — SRP via EventBus, DIP via interfaces pour services externes (storage, notifications, queue)
- **Prisma directement dans les services** — Pas de Repository Pattern pour le MVP (décision pragmatique)
- **Factory Pattern** : Création d'entités complexes (`LoanFactory.toCreateInput()`)
- **Politique de rappels fixe** : PREVENTIVE adaptatif (J-3 si Δ≥3, J-1 si Δ<3), ON_DUE_DATE (J), FIRST_OVERDUE (J+7), SECOND_OVERDUE (J+14), FINAL_OVERDUE (J+21). Date retour minimum J+2 validée côté frontend + backend.
- **Observer/Event-Driven** : Communication inter-modules via `EventEmitter2` (`@OnEvent`)

## Standards de Développement

### TDD (Strict RED → GREEN → REFACTOR → COMMIT)

- Aucun code de production sans test préalable qui échoue
- Cycle par comportement (pas par feature entière)
- Pattern AAA (Arrange-Act-Assert) obligatoire
- Couverture minimale : Domain 95%, Services 90%, Controllers 70%

### Erreurs API (RFC 7807)

Toutes les erreurs HTTP retournent un objet `ProblemDetails` :

```json
{
  "type": "https://api.return.app/errors/<error-type>",
  "title": "...",
  "status": 404,
  "detail": "...",
  "instance": "/v1/...",
  "timestamp": "...",
  "requestId": "...",
  "errors": [
    {
      "field": "...",
      "code": "...",
      "message": "..."
    }
  ]
}
```

### Logs

- Winston uniquement (pas de `console.log`)
- Console transport uniquement (conteneurs Fly.io éphémères)
- Format JSON avec `requestId`, `userId`, `timestamp`, `context`, `duration`

### Git (GitHub Flow + Conventional Commits)

- **Branches** : `main` (prod) ← `feature/`, `fix/`, `hotfix/`, `refactor/`, `chore/` (pas de branche `develop`)
- **Conventional Commits** : `<type>(<scope>): <subject>`
- Types : `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `ci`, `build`, `revert`
- Scopes : `setup`, `loans`, `reminders`, `auth`, `items`, `photos`, `notifications`, `users`, `borrowers`, `invitations`, `db`, `api`, `i18n`, `ui`, `navigation`, `ci`, `docs`, `deps`, `integration`
- Pre-commit hooks : Husky + lint-staged (ESLint + Prettier uniquement). Jest en CI.
- PR : 1 approval, CI verte.

### Interdictions

- `console.log` (utiliser Winston)
- Erreurs HTTP sans RFC 7807
- Logique métier dans les controllers (déplacer dans services)
- Secrets en dur (utiliser .env)
- Zod pour la validation (utiliser class-validator)
- File Transport Winston (conteneurs éphémères)
- Code de production sans test préalable (TDD)

## Domaine Métier (Ubiquitous Language)

| Terme FR   | Terme EN (code) | Description                                                |
|------------|-----------------|-------------------------------------------------------------|
| Prêt       | Loan            | Transaction de prêt temporaire (objet physique ou argent)  |
| Prêteur    | Lender          | Utilisateur propriétaire qui prête                         |
| Emprunteur | Borrower        | Utilisateur qui emprunte (compte obligatoire)              |
| Objet      | Item            | Bien prêté (photo, nom, valeur optionnelle)                |
| Rappel     | Reminder        | Notification automatique planifiée                         |

**Termes interdits dans le code** : "Utilisateur" (trop vague → Lender/Borrower), "Transaction" (→ Loan), "Client" (→
pas de connotation commerciale)

## Statuts de Prêt (Machine à États)

`PENDING_CONFIRMATION` → `ACTIVE` (accepté) | `ACTIVE_BY_DEFAULT` (timeout 48h) | `CONTESTED` (refusé)
`ACTIVE` / `ACTIVE_BY_DEFAULT` → `AWAITING_RETURN` (date dépassée) → `RETURNED` (rendu) | `NOT_RETURNED` (5 rappels
ignorés) | `ABANDONED` (abandon manuel par le prêteur)

## Architecture Frontend

### Structure (`frontend/src/`)

```
api/            — apiClient Axios (baseURL, intercepteurs JWT, refresh token)
components/     — Composants réutilisables par module (auth/, borrowers/, items/, profile/)
config/         — api-modules.config.ts (toggle mock/real), theme.config.ts, i18n.config.ts
i18n/           — Locales FR + EN
navigation/     — RootNavigator → AuthNavigator | AppNavigator (Tab: `LoanTab`, `BorrowerTab`, `ItemTab`, `ProfileTab`)
screens/        — Écrans par module (auth/, borrowers/, items/, profile/)
stores/         — Zustand stores (`useAuthStore`, `useBorrowerStore`, `useItemStore`, `useLoanStore`, `useHistoryStore`, `useReminderStore`, `useContactInvitationStore`, `useNotificationStore`) ; `resetSessionStores.ts` remet à zéro les stores de session à la déconnexion
types/          — api.types.ts (Item, Borrower, Photo, ProblemDetails, PaginatedResponse, etc.)
utils/          — error.ts (extractProblemDetails, getErrorMessage, ERROR_TYPE_MAP), photo.ts
```

### Patterns Frontend

- **State management** : Zustand (1 store par module, actions async avec try/catch)
- **Formulaires** : react-hook-form + Controller (validation client-side)
- **Erreurs** : RFC 7807 `ProblemDetails` → `extractProblemDetails()` → `getErrorMessage(error, t)` → i18n
- **API mocking** : MSW (Mock Service Worker) via `frontend/__mocks__/handlers.ts` + `server.ts`
- **Toggle mock/real** : `frontend/src/config/api-modules.config.ts` — modules `auth`, `borrowers`, `items`, `loans`, `reminders`, `notifications`, `users`, `contact-invitations` (tous à `false` = API réelle)
- **Tests** : Jest + RNTL (React Native Testing Library) + MSW pour mocks API
- **Photos** : `PhotoPicker` (camera/galerie) + `PhotoGallery` (affichage + suppression) + `buildPhotoFormData()`

### Commandes

```bash
# Environnement complet (Docker) — recommandé
docker compose up                       # Lance postgres + redis + backend + frontend (Expo Web)

# Frontend (sans Docker)
cd frontend && npx expo start --web    # Dev (BROWSER=none pour éviter l'ouverture auto)
cd frontend && npx jest --verbose       # Tests
cd frontend && npm run typecheck        # Vérification TypeScript (tsc --noEmit)

# Backend (sans Docker)
cd backend && npx nest start --watch    # Dev
cd backend && npx jest --verbose        # Tests

# Infra seule (sans backend/frontend)
docker compose up postgres redis        # Uniquement les services d'infrastructure
```

## Avancement

| Sprint | Module | Backend | Frontend |
|--------|--------|---------|----------|
| Sprint 1 | Auth + Users + Profile | Fait | Fait |
| Sprint 2 | Borrowers | Fait | Fait |
| Sprint 3 | Items + Photos | Fait | Fait |
| Sprint 4 | Loans | Fait | Fait |
| Sprint 4.6 | Contact Invitations | Fait | Fait |
| Sprint 5 | Docker Dev + Validation J+2 + Notifications | Fait | Fait |
| Sprint 6 | Dashboard + History | Fait | Fait (historique ; dashboard dédié post-échéance) |

## Documents de Référence

- `00_BIBLE_PROJET.md` : Vision, personas, scope fonctionnel MVP, décisions stratégiques
- `01_ARCHITECTURE_TECHNIQUE.md` : Stack, ADRs, RBAC, sécurité, plan de scalabilité
- `02_NORMES_OPERATIONNELLES.md` : SOLID, design patterns, TDD, gestion d'erreurs, git flow
- `04_ROADMAP_BACKEND.md` / `05_ROADMAP_FRONTEND.md` : Plans d'implémentation
- `06_PLAN_GENERAL.md` : Planning global
- `openapi.yaml` : Contrat API complet (OpenAPI 3.1)
- `API_CONTRACT_TESTING.md` / `API_MOCKING_STRATEGY.md` : Stratégies de test API

## API

- Base URL locale : `http://localhost:3000/v1`
- Authentification : Bearer JWT sur tous les endpoints (sauf `/auth/register` et `/auth/login`)
- Validation : class-validator + class-transformer (NestJS ValidationPipe)
- Spécification complète dans `openapi.yaml`
