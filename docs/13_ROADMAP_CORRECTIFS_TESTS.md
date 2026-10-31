# 13_ROADMAP_CORRECTIFS_TESTS.md

**Return ↺ — Roadmap de Correctifs · Session Tests Terrain**

> **Date** : 22 juin 2026
> **Source** : Session de tests terrain — notes croisées et dédupliquées par **Ismael (front)** et **Ozias (back)**
> **Phase** : Pré-production — backend déployé sur Fly.io (`return-api.fly.dev`), frontend branché dessus
> **Périmètre** : **Front** = Ismael · **Back** = Ozias
> **Complète** : `11_CORRECTIFS_PREPROD.md` (CORR-01→CORR-14, audit du 20/06/2026). Ce document ne duplique pas les
> fiches CORR — il les référence explicitement quand un FIX en dépend.

---

### Révision du 23/06/2026 (relecture Ismael + Ozias)

- **FIX-05** requalifié en vrai correctif backend (deux volets : auto-confirmation à 24h pour les prêts courts + pas de
  rappel préventif avant J pour Δ<3 jours) — ce n'est plus « workflow à faire » ni « déjà implémenté »
- **FIX-06, FIX-07, FIX-08** fusionnés dans **FIX-14** (chantier stats prêteur) — conservés pour traçabilité
- **FIX-11** reformulé : le vrai problème est que le champ « Contact » est figé sur `loan.borrower` quel que soit le
  spectateur — il doit être relatif au rôle de l'utilisateur courant
- **FIX-12** reformulé : pour un prêt actif, supprimer purement et simplement l'affichage de la date dans la timeline (
  pas de label « Sans échéance »)
- **FIX-13** retiré (faux bug — renommer un contact est déjà possible via les alias locaux `firstName`/`lastName`)
- **FIX-14** élargi au chantier stats prêteur englobant FIX-06/07/08
- **FIX-15** reformulé et passé en **MVP** (🟠) : le vrai sujet est l'incohérence du trustScore calculé par-relation côté
  back mais global côté front — décision validée : trustScore global unique par utilisateur

### Révision du 25/06/2026 (test terrain Ozias)

- **FIX-17** ajouté : le trustScore comptait les prêts **CONTESTÉS** et **en cours** au dénominateur, faussant le score à
  la baisse. Décision validée : dénominateur = prêts **résolus** uniquement (RETURNED + NOT_RETURNED + ABANDONED), et
  **`null`** (« pas encore noté ») quand aucun prêt résolu. Back livré ; front à adapter (gérer `null` à l'affichage).

---

### Liens avec le backlog CORR existant

| Sujet FIX                                          | Lien CORR                                                    |
|----------------------------------------------------|--------------------------------------------------------------|
| FIX-01/02 — Photos (upload + stockage éphémère)    | Dépend de **CORR-02** (R2) — voir `11_CORRECTIFS_PREPROD.md` |
| FIX-05 — Workflow prêt < 3 jours (CRON)            | Dépend de **CORR-01** (scale-to-zero)                        |
| FIX-14 — Stats front recalcule / endpoint orphelin | Lien **CORR-08** (History/Statistics non consommés)          |

### Légende gravité

| Symbole | Niveau   | Définition                                                              |
|---------|----------|-------------------------------------------------------------------------|
| 🔴      | Critique | Casse une fonctionnalité cœur ou rend les tests terrain non fiables     |
| 🟠      | Majeur   | Impact notable en production, à traiter avant la mise en ligne publique |
| 🟡      | Mineur   | Dette technique ou UX dégradée, peut attendre un sprint dédié           |

---

## Tableau récapitulatif

| ID     | Titre                                                                     | Gravité     | Périmètre / Qui                      | Effort               | Statut   |
|--------|---------------------------------------------------------------------------|-------------|--------------------------------------|----------------------|----------|
| FIX-01 | Photos objets : upload ET GET KO                                          | 🔴 Critique | Back (Ozias) + Front (Ismael, vérif) | M                    | 🟡 Code livré (FEAT-01) — recette après D2 |
| FIX-02 | Photo de profil ajoutée non affichée                                      | 🔴 Critique | Back (Ozias) + Front (Ismael, vérif) | M (mutualisé FIX-01) | 🟡 Code livré (FEAT-01) — recette après D2 |
| FIX-03 | Date de retour obligatoire                                                | 🟠 Majeur   | Les deux                             | XS                   | ✅ Fait    |
| FIX-04 | Objet déjà prêté reste re-prêtable                                        | 🟠 Majeur   | Les deux                             | M                    | ✅ Fait    |
| FIX-05 | Workflow prêt court (Δ<3j) : auto-confirm 24h + pas de préventive avant J | 🟠 Majeur   | Back (Ozias)                         | S                    | ✅ Fait    |
| FIX-06 | Stats : prêts CONTESTÉS comptés comme actifs                              | 🟠 Majeur   | Front (Ismael)                       | XS                   | → FIX-14 |
| FIX-07 | Stats figées / "s'affichent quand elles veulent"                          | 🟠 Majeur   | Front (Ismael)                       | S                    | → FIX-14 |
| FIX-08 | Mise à jour d'un prêt non reflétée dans les stats                         | 🟠 Majeur   | Front (Ismael)                       | M                    | → FIX-14 |
| FIX-09 | Email d'un contact ne doit pas être modifiable                            | 🟠 Majeur   | Les deux                             | XS                   | ✅ Fait    |
| FIX-10 | Format de date incohérent selon la machine                                | 🟠 Majeur   | Front (Ismael)                       | XS                   | ✅ Fait    |
| FIX-11 | Champ "Contact" figé sur loan.borrower quel que soit le spectateur        | 🟠 Majeur   | Front (Ismael)                       | S                    | ✅ Fait    |
| FIX-12 | Timeline affiche "Invalid Date" pour prêt actif (date absente)            | 🟡 Mineur   | Front (Ismael)                       | XS                   | ✅ Fait    |
| FIX-13 | Renommer un contact (impossible aujourd'hui)                              | 🟡 Mineur   | —                                    | —                    | ❌ Annulé |
| FIX-14 | Chantier stats prêteur : brancher `/history/statistics` (ex-FIX-06/07/08) | 🟠 Majeur   | Les deux (surtout Front)             | M                    | ✅ Fait    |
| FIX-15 | trustScore global incohérent (par-relation back vs global front)          | 🟠 Majeur   | Front + Back — MVP                   | M                    | ✅ Fait    |
| FIX-16 | Temps réel (websockets)                                                   | 🟡 Mineur   | Back + Front — POST-MVP              | M→L                  | ☐        |
| FIX-17 | trustScore faussé : CONTESTÉS + prêts en cours comptés au dénominateur     | 🟠 Majeur   | Back (Ozias) + Front (Ismael)        | S                    | ✅ |

---

## 🔴 Critique

### FIX-01 — Photos objets : upload ET GET KO

- **Gravité** : 🔴 Critique
- **Périmètre** : Back (Ozias) — correctif principal ; Front (Ismael) — vérification affichage
- **Effort** : M
- **Fichier(s) & preuve** :
    - `backend/src/photos/local-photo-storage.service.ts:23` → `UPLOAD_BASE_URL` défaut `http://localhost:3000/uploads`,
      jamais surchargé en prod
    - `backend/src/main.ts:45` → `useStaticAssets('/uploads')` — route locale uniquement
    - `backend/src/items/items.service.ts:228` — URL construite depuis la constante non configurée
    - `frontend/src/screens/items/CreateItemScreen.tsx:49` — envoi photo vers l'API
    - `frontend/src/stores/useItemStore.ts:124` — réception et stockage de l'URL photo
    - `frontend/src/components/items/PhotoGallery.tsx:32` — rendu de l'URL reçue
- **Problème** : l'URL renvoyée par le backend pointe vers `localhost:3000`, inaccessible depuis le client en prod. De
  plus, le stockage disque Fly.io est éphémère : toutes les photos uploadées sont perdues à chaque redéploiement.
- **Action Back (Ozias)** :
    1. *Court terme* — configurer `UPLOAD_BASE_URL=https://return-api.fly.dev/uploads` via `fly secrets set`
    2. *Fond* — implémenter `R2PhotoStorageService` (voir **CORR-02** dans `11_CORRECTIFS_PREPROD.md`) pour la
       persistance réelle
- **Action Front (Ismael)** : vérifier que `PhotoGallery` affiche bien l'URL absolue renvoyée par le backend (pas de
  reconstruction côté client). Aucune reconstruction locale si l'URL est déjà absolue.
- **Statut** : 🟡 Code livré — front vérifié ✅ ; back livré par FEAT-01 (merge `9a6ca53`, PR #30) : photos sur
  Cloudflare R2, URL publique du bucket renvoyée telle quelle. Le court terme `UPLOAD_BASE_URL` est **abandonné** :
  la variable est retirée de `fly.toml`, `/uploads` n'est plus servi qu'en stockage local (dev). Reste : déploiement
  D2 puis recette (upload sur `return-api.fly.dev`, photo qui survit à un `fly deploy`). Les chemins de fichiers
  cités ci-dessus datent de l'audit : le stockage vit désormais dans `backend/src/storage/`.

---

### FIX-02 — Photo de profil ajoutée non affichée

- **Gravité** : 🔴 Critique
- **Périmètre** : Back (Ozias) — même racine que FIX-01 ; Front (Ismael) — vérification affichage
- **Effort** : M (mutualisé avec FIX-01 — même correctif backend)
- **Fichier(s) & preuve** :
    - `frontend/src/screens/profile/ProfileScreen.tsx:31` — affichage avatar
    - `frontend/src/stores/useAuthStore.ts:142-151` — stockage URL avatar après upload
    - `frontend/src/components/profile/ProfileCard.tsx:21` — rendu de l'avatar
    - `backend/src/users/users.controller.ts:125` — endpoint upload avatar
    - `backend/src/users/users.service.ts:258` — construction URL avatar
- **Problème** : même cause que FIX-01 — `UPLOAD_BASE_URL` non configuré en prod, URL renvoyée pointe `localhost`.
  L'avatar uploadé s'affiche en erreur ou pas du tout.
- **Action Back (Ozias)** : identique FIX-01 — le correctif `UPLOAD_BASE_URL` couvre aussi les avatars.
- **Action Front (Ismael)** : vérifier que `ProfileCard` consomme l'URL absolue stockée dans `useAuthStore` sans la
  reconstruire.
- **Statut** : 🟡 Code livré — front vérifié ✅ ; même correctif que FIX-01 (FEAT-01). Clé d'avatar
  `users/<userId>/avatar-<uuid>.<ext>` : remplacer son avatar par un fichier de même extension ne supprime plus le
  nouveau fichier (bug corrigé dans FEAT-01). Reste : recette après le déploiement D2.

---

## 🟠 Majeur

### FIX-03 — Date de retour obligatoire

- **Gravité** : 🟠 Majeur
- **Périmètre** : Les deux
- **Effort** : XS
- **Fichier(s) & preuve** :
    - `backend/src/loans/dto/create-loan.dto.ts:22` → `@IsOptional()` + `returnDate?: string | null`
    - `frontend/src/components/loans/LoanWizard.tsx:90` → `returnDate: returnDate || null`
    - `frontend/src/components/loans/LoanWizard.tsx:72` (environ) → garde `canNext()` step 4 ne bloque pas sur date
      absente
- **Problème** : le DTO back accepte un prêt sans date de retour, et le wizard front ne bloque pas la progression. Cela
  contourne la politique de rappels (qui repose sur `returnDate`) et génère des prêts orphelins sans échéance.
- **Action Back (Ozias)** : retirer `@IsOptional()` du champ `returnDate` dans `create-loan.dto.ts` — rendre la date
  obligatoire (400 si absente).
- **Action Front (Ismael)** : rendre le champ date obligatoire dans le wizard (bloquer `canNext()` si `returnDate` est
  vide) + message de validation visible.
- **Statut** : ✅ Fait — front (wizard : étape bloquée tant que la date est vide) + back (`returnDate` requis dans le DTO)

---

### FIX-04 — Objet déjà prêté reste re-prêtable

- **Gravité** : 🟠 Majeur
- **Périmètre** : Les deux
- **Effort** : M
- **Fichier(s) & preuve** :
    - `backend/src/loans/loans.service.ts:47-142` → `create()` sans vérification d'un prêt actif existant sur l'`itemId`
    - `frontend/src/screens/loans/CreateLoanScreen.tsx:25` → `fetchItems()` sans filtre `available: true`
    - `frontend/src/screens/loans/CreateLoanScreen.tsx:149` (environ) → liste affiche tous les objets sans distinction
- **Problème** : rien n'empêche de créer deux prêts simultanés pour le même objet. Les données sont incohérentes et les
  rappels se déclenchent en double.
- **Action Back (Ozias)** : dans `loans.service.ts > create()`, vérifier qu'aucun prêt avec un statut actif (
  `PENDING_CONFIRMATION`, `ACTIVE`, `ACTIVE_BY_DEFAULT`, `AWAITING_RETURN`) n'existe déjà pour l'`itemId` → retourner
  409 Conflict si c'est le cas.
- **Action Front (Ismael)** : appeler `GET /items?available=true` (ou filtrer côté store) pour ne proposer que les
  objets disponibles dans le sélecteur du wizard. Griser ou masquer les objets déjà prêtés.
- **Statut** : ✅ Fait — front (sélecteur `available=true` + mapping i18n du 409 `item-already-loaned`) + back (409 Conflict)

---

### FIX-05 — Workflow prêt court (Δ<3 jours) : auto-confirm 24h + pas de préventive avant J

- **Gravité** : 🟠 Majeur
- **Périmètre** : Back (Ozias) — aucun front
- **Effort** : S (global)
- **Lien CORR** : dépend de **CORR-01** (scale-to-zero) — `11_CORRECTIFS_PREPROD.md`

#### Contexte

La logique de rappels adaptative existe déjà dans `backend/src/reminders/reminder-policy.ts:28` : J-3 si Δ≥3
jours, sinon J-1. La révision du 23/06/2026 change la règle pour les prêts courts sur deux volets distincts.

#### Volet A — Auto-confirmation à 24h (au lieu de 48h) pour Δ<3 jours

- **Fichier(s) & preuve** :
    - `backend/src/loans/loans-cron.service.ts:29` → délai `ACTIVE_BY_DEFAULT` codé en dur à 48h
    - `backend/src/loans/loans-cron.service.ts:31-38` → requête de sélection des prêts à auto-confirmer
- **Problème** : pour un prêt dont l'échéance est à J+2 (minimum autorisé), l'auto-confirmation à 48h se déclenche
  exactement à l'échéance — le prêt passe `ACTIVE_BY_DEFAULT` sans jamais avoir eu le temps d'être confirmé ou contesté.
- **Action Back (Ozias)** : dans la requête de sélection du CRON d'auto-confirmation, ajouter `returnDate` et
  `createdAt` au select, calculer Δ = `returnDate − createdAt`, puis scinder le seuil : **24h si Δ<3 jours**, 48h si
  Δ≥3 jours. Compléter les tests dans `backend/src/loans/loans-cron.service.spec.ts`.
- **Effort volet A** : S

#### Volet B — Pas de rappel préventif avant l'échéance pour Δ<3 jours

- **Fichier(s) & preuve** :
    - `backend/src/reminders/reminder-policy.ts:32` → génère une PREVENTIVE J-1 pour Δ=2 jours
    - `backend/src/reminders/reminder-policy.spec.ts:28` → test couvrant ce cas
    - `backend/src/reminders/reminders.service.spec.ts` — tests à ajuster
- **Problème** : pour un prêt de 2 jours, une notification PREVENTIVE J-1 part alors que la durée totale du prêt est
  déjà très courte. La 1ère notification pertinente pour ces prêts est `ON_DUE_DATE` (jour J).
- **Action Back (Ozias)** : dans `calculateDates()` de `reminder-policy.ts`, n'ajouter la PREVENTIVE que si Δ≥3 jours.
  Pour Δ<3 jours : pas de PREVENTIVE (ni J-3 ni J-1) — première notification = `ON_DUE_DATE`. Les rappels overdue
  J+7/J+14/J+21 restent inchangés quel que soit Δ. Ajuster les tests `reminder-policy.spec.ts` et
  `reminders.service.spec.ts`.
- **Effort volet B** : XS

#### Prêts ≥ 3 jours

Comportement inchangé : auto-confirmation à 48h + PREVENTIVE J-3.

#### Note — transition ACTIVE → AWAITING_RETURN

La transition automatique `ACTIVE → AWAITING_RETURN` à l'échéance (soulevée lors du 1er audit) est un **sujet
séparé**, à confirmer avec Ozias — hors périmètre FIX-05.

> **Traité (FEAT-10, 28/10/2026)** : un CRON horaire `handleOverdueLoans` fait passer les prêts `ACTIVE` /
> `ACTIVE_BY_DEFAULT` en `AWAITING_RETURN` à l'échéance (cf. doc 16).

- **Statut** : ✅ Fait — back : volet A (auto-confirm 24h pour Δ<3j) + volet B (pas de PREVENTIVE pour Δ<3j) livrés

---

### FIX-06 — Stats : prêts CONTESTÉS comptés comme actifs

> → Couvert par **FIX-14** (chantier stats prêteur). Conservé pour traçabilité.

---

### FIX-07 — Stats figées / "s'affichent quand elles veulent"

> → Couvert par **FIX-14** (chantier stats prêteur). Conservé pour traçabilité.

---

### FIX-08 — Mise à jour d'un prêt non reflétée dans les stats

> → Couvert par **FIX-14** (chantier stats prêteur). Conservé pour traçabilité.

---

### FIX-09 — Email d'un contact ne doit pas être modifiable

- **Gravité** : 🟠 Majeur
- **Périmètre** : Les deux
- **Effort** : XS
- **Fichier(s) & preuve** :
    - `frontend/src/components/borrowers/BorrowerForm.tsx:100-123` → champ email éditable même en mode édition
    - `backend/src/borrowers/borrowers.service.ts:137` → `data: dto` applique le DTO en entier, y compris `email` —
      il faut exclure explicitement ce champ
    - `backend/src/borrowers/dto/update-borrower.dto.ts:17` → email présent dans le DTO de mise à jour
- **Problème** : un utilisateur peut modifier l'email d'un contact existant depuis l'interface. L'email est un
  identifiant d'invitation — le modifier casse la cohérence du lien entre comptes.
- **Action Front (Ismael)** : désactiver le champ email lorsque `mode === 'edit'` dans `BorrowerForm`
  (`editable={false}` + style visuel désactivé).
- **Action Back (Ozias)** : retirer `email` du `UpdateBorrowerDto` ou lever une `BadRequestException` si `email` est
  présent dans le body d'un PATCH.
- **Statut** : ✅ Fait — front (champ email verrouillé en édition) + back (email retiré du `UpdateBorrowerDto`)

---

### FIX-10 — Format de date incohérent selon la machine (MM/JJ/AAAA vs JJ/MM/AAAA)

- **Gravité** : 🟠 Majeur
- **Périmètre** : Front (Ismael)
- **Effort** : XS
- **Fichier(s) & preuve** — 9 appels `toLocaleDateString()` sans locale :
    - `frontend/src/components/loans/LoanCard.tsx:19`
    - `frontend/src/components/loans/LoanTimeline.tsx:24,26,120`
    - `frontend/src/components/loans/ConfirmationDialog.tsx:61`
    - `frontend/src/components/notifications/NotificationCard.tsx:38`
    - `frontend/src/components/profile/ProfileCard.tsx:15`
    - `frontend/src/screens/borrowers/BorrowerInvitationsScreen.tsx:42`
    - `frontend/src/screens/loans/LoanDetailScreen.tsx:208`
    - Bonne pratique déjà présente : `LoanWizard.tsx:309` et `LoanDetailScreen.tsx:480` utilisent
      `toLocaleDateString(i18n.language)`
    - Utilitaire existant : `frontend/src/utils/date.ts` (ne contient que `getMinReturnDate`)
- **Problème** : sans locale explicite, `toLocaleDateString()` utilise la locale système de la machine — sur iOS
  américain, les dates s'affichent MM/JJ/AAAA alors que les utilisateurs français attendent JJ/MM/AAAA.
- **Action Front (Ismael)** : créer une fonction `formatDate(date: string | Date, language: string): string` centralisée
  dans `frontend/src/utils/date.ts` (appelle `toLocaleDateString(language, { ... })`), puis remplacer les 9 occurrences
  incriminées.
- **Action Back** : aucune.
- **Statut** : ✅ Fait — front (`formatDate(date, language)` centralisé)

---

### FIX-11 — Champ "Contact" figé sur loan.borrower quel que soit le spectateur

- **Gravité** : 🟠 Majeur
- **Périmètre** : Front (Ismael)
- **Effort** : S
- **Fichier(s) & preuve** :
    - `frontend/src/components/loans/LoanCard.tsx:50` → affiche toujours `loan.borrower`, quel que soit l'utilisateur
      courant
    - `frontend/src/screens/loans/LoanDetailScreen.tsx:198` → idem, toujours `borrower`
    - `frontend/src/screens/loans/LoanDetailScreen.tsx:165` → `isLender` déjà calculé mais inutilisé pour ce champ
    - `backend/src/loans/.../loan-response.interface.ts:35-36` → le backend renvoie bien `lender` + `borrower` (correct,
      aucune modification nécessaire)
- **Problème** : l'emprunteur qui consulte un prêt se voit lui-même dans le champ « Contact » au lieu de voir le
  prêteur. Le champ doit être **relatif au rôle de l'utilisateur courant** : le prêteur voit l'emprunteur, l'emprunteur
  voit le prêteur.
- **Action Front (Ismael)** : créer un helper `getContactForUser(loan, currentUserId)` qui retourne `loan.borrower` si
  `loan.lender.id === currentUserId`, sinon `loan.lender`. Appliquer ce helper dans `LoanCard` et `LoanDetailScreen` en
  remplacement de l'accès direct à `loan.borrower`.
- **Action Back** : aucune — le backend est déjà correct.
- **Statut** : ✅ Fait — front (helper `getContactForUser(loan, currentUserId)`)

---

## 🟡 Mineur / Amélioration

### FIX-12 — Timeline affiche "Invalid Date" pour un prêt actif (date de retour absente)

- **Gravité** : 🟡 Mineur
- **Périmètre** : Front (Ismael)
- **Effort** : XS
- **Fichier(s) & preuve** :
    - `frontend/src/components/loans/LoanTimeline.tsx:37-38` → `returnDate` potentiellement `undefined` passé sans garde
    - `frontend/src/components/loans/LoanTimeline.tsx:24` → `formatDateRange` ne gère pas un argument `from`
      null/undefined
- **Problème** : si `returnDate` est null (prêt actif sans échéance — possible avant FIX-03), la timeline affiche
  "Invalid Date". Pour un prêt au statut Actif, il faut **supprimer purement et simplement l'affichage de la date**
  dans la timeline (rien afficher) — ce qui élimine le « Invalid Date ».
- **Action Front (Ismael)** : ajouter une garde sur `returnDate` avant de le passer à `formatDateRange` — ne rien
  afficher lorsque la date est absente (ne pas afficher de label de substitution).
- **Action Back** : aucune.
- **Statut** : ✅ Fait — front (garde sur `returnDate` avant formatage)

---

### FIX-13 — Renommer un contact ❌ ANNULÉ — faux bug

> **Annulé le 23/06/2026.** Renommer un contact est **déjà possible** : l'entité `Borrower` est propre au prêteur
> (`backend/prisma/schema.prisma` : contrainte `@@unique([lenderUserId, email])`), donc les champs `firstName` /
> `lastName` sont des **alias locaux** modifiables sans affecter le compte lié. Aucune migration `displayName` n'est
> nécessaire. Le seul besoin réel — verrouiller l'email — est déjà couvert par **FIX-09**.

---

### FIX-14 — Chantier stats prêteur (ex-FIX-06 / FIX-07 / FIX-08)

- **Gravité** : 🟠 Majeur
- **Périmètre** : Les deux — surtout Front (Ismael)
- **Effort** : M
- **Lien CORR** : voir **CORR-08** dans `11_CORRECTIFS_PREPROD.md`
- **Fichier(s) & preuve** :
    - `backend/src/history/history.service.ts:158-196` → endpoint `GET /v1/history/statistics` correct et complet (
      `byCategory`, `topBorrowers`, `mostLoanedItems`)
    - `frontend/src/components/profile/LenderStats.tsx:8-14` → `ACTIVE_STATUSES` inclut `'CONTESTED'` (ex-FIX-06)
    - `frontend/src/components/profile/LenderStats.tsx:37-84` → recalcul client-side à partir de
      `GET /loans?role=…&limit=100` ×2 (≈200 prêts chargés inutilement)
    - `frontend/src/components/profile/LenderStats.tsx:101` → `useEffect([])` — chargement unique, stats figées
      (ex-FIX-07)
    - `frontend/src/screens/profile/ProfileScreen.tsx` → pas de `useFocusEffect`, pas de refetch au retour (ex-FIX-07)
    - `frontend/src/stores/useLoanStore.ts:129-175` → mutations non observées par `LenderStats` (ex-FIX-08)
    - Aucune occurrence de `v1/history` dans `frontend/src/`
- **Problème** : le front recalcule les stats côté client au lieu de consommer l'endpoint backend dédié. Cela génère
  une charge réseau inutile, des calculs fragiles (CONTESTED mal classé, ex-FIX-06), des stats figées (ex-FIX-07) et
  une désynchronisation après mutation (ex-FIX-08). Ce chantier résout FIX-06, FIX-07 et FIX-08 d'un seul coup.
- **Action Front (Ismael)** :
    1. Migrer `LenderStats` pour appeler `GET /v1/history/statistics` — supprimer le recalcul client
    2. Ajouter `useFocusEffect` (refetch au retour sur l'écran Profil)
    3. Invalider / refetch les stats après chaque mutation `useLoanStore` (création, confirmation, contestation)
- **Action Back (Ozias)** : vérifier que l'endpoint retourne bien les données dans le format attendu par le front (
  confronter avec `openapi.yaml`).
- **Statut** : ✅ Fait — front (`/history/statistics` + `useFocusEffect` + invalidation après mutation ; ex-FIX-06/07/08 réglés) + back. `overview.overdueLoans` ajouté par FEAT-04 (contrat validé par Ismael, back + carte « En retard » côté front, TODO retiré ; merge `e571521`, PR #30) — en prod après le déploiement D2.

---

### FIX-15 — trustScore global incohérent entre back (par-relation) et front (global)

- **Gravité** : 🟠 Majeur — MVP
- **Périmètre** : Front (Ismael) + Back (Ozias)
- **Effort** : M
- **Fichier(s) & preuve** :
    - `backend/src/borrowers/borrower-stats.listener.ts:145` → `trustScore` calculé par-relation (le record `Borrower`
      est propre à chaque prêteur — Ozias voit un trustScore d'Ismael différent d'Ismael lui-même)
    - `frontend/src/components/profile/LenderStats.tsx:53-77` → recalcul global côté front sur le profil self —
      agrège tous les prêts reçus, tous prêteurs confondus
- **Problème** : incohérence structurelle entre les deux vues. Exemple : Ismael voit Ozias à 33 % (calcul par-relation
  sur leur historique commun), tandis qu'Ozias se voit à 0 % sur son propre profil (calcul global front sans données
  suffisantes). Le trustScore doit être **unique et cohérent partout**.
- **Décision validée (23/06/2026)** : un **trustScore global unique par utilisateur**, calculé côté back en agrégeant
  tous les prêteurs, exposé via un endpoint dédié, et consommé par le front aussi bien sur le profil self que sur la
  fiche contact.
- **Action Back (Ozias)** : exposer le trustScore global de l'utilisateur en tant qu'emprunteur (nouvel endpoint dédié,
  agrégé tous prêteurs confondus).
- **Action Front (Ismael)** : afficher ce score global sur le profil self (remplacer le recalcul client dans
  `LenderStats`) et sur la fiche contact (remplacer la valeur par-relation actuelle).
- **Statut** : ✅ Fait — front (section emprunteur 100% serveur via `GET /users/me/trust-score`, plus aucun recalcul client) + back (endpoint trustScore global agrégé)

---

### FIX-17 — trustScore faussé par les prêts contestés et en cours

- **Gravité** : 🟠 Majeur — MVP
- **Périmètre** : Back (Ozias) ✅ + Front (Ismael) ✅
- **Effort** : S
- **Lien** : prolonge **FIX-15** (même calcul de trustScore)
- **Fichier(s) & preuve** :
    - `backend/src/borrowers/borrower-stats.listener.ts` → dénominateur = `borrower.totalLoans` (tous les prêts créés)
    - `backend/src/trust-score/trust-score.service.ts` → agrégation `Σ totalLoans` (hérite du même biais)
    - `totalLoans` incrémenté à chaque création (y compris prêts qui deviennent CONTESTED), jamais décrémenté au contest
- **Problème** : les prêts **CONTESTÉS** (refusés par l'emprunteur) et **en cours** (PENDING/ACTIVE/AWAITING) étaient
  comptés au dénominateur du trustScore, le faisant chuter à tort. Ex. : 1 prêt rendu à temps + 1 contesté → 50 % au
  lieu de 100 % ; nouvel emprunteur avec 1 prêt actif → 0 %.
- **Décision validée (25/06/2026)** : dénominateur = prêts **résolus** uniquement
  (`returnedOnTime + returnedLate + notReturned`), CONTESTÉS et en cours exclus. Score **`null`** (« pas encore noté »)
  quand aucun prêt résolu, au lieu d'un 0 trompeur. Arrondi à 1 décimale (cohérent back/global).
- **Action Back (Ozias)** : ✅ corrigé dans le listener par-relation ET le `TrustScoreService` global ;
  `Borrower.trustScore` rendu **nullable** (migration `trust_score_nullable_resolved`) ; `BorrowerStatistics` /
  `UserTrustScore` / `topBorrowers` nullables dans `openapi.yaml` + interfaces.
- **Action Front (Ismael)** : gérer `trustScore = null` partout où il s'affiche (profil self, fiche contact, liste des
  emprunteurs, détail de prêt, top emprunteurs) → afficher un état « pas encore noté » / « — », **ne pas** supposer un
  nombre (risque de `null %` ou crash sur `.toFixed()`).
- **Statut** : ✅ Back livré (commit `e4d7ed0`) · ✅ Front livré (commit `c4d6d91`,
  « fix(borrowers): render null trustScore as not-yet-rated in stats badge and profile »)

---

### FIX-16 — Temps réel (websockets) — POST-MVP

- **Gravité** : 🟡 Mineur — décision POST-MVP
- **Périmètre** : Back (Ozias) + Front (Ismael) — à ne pas traiter maintenant
- **Effort** : M→L
- **Dépendances** : résolution de **CORR-01** (scale-to-zero Fly) + besoin utilisateur confirmé sur le terrain
- **Problème** : le polling 30s et le `useFocusEffect` couvrent le besoin MVP. Les websockets ajoutent de la
  complexité (connexions persistantes incompatibles avec le scale-to-zero Fly, état de reconnexion à gérer des deux
  côtés).
- **Décision** : ne pas implémenter en phase préprod. Réévaluer après les premiers retours terrain et après résolution
  de CORR-01.
- **Action Back** : aucune maintenant. Ticket à planifier en post-MVP si le besoin est confirmé.
- **Action Front** : aucune maintenant.
- **Statut** : ☐ Post-MVP — délibérément différé

---

## Décision d'architecture — Stats & Temps réel

Cette section documente les décisions prises lors de la session de tests du 22/06/2026, mises à jour lors de la
révision du 23/06/2026.

### Calcul des statistiques prêteur (FIX-14)

Le frontend consomme l'endpoint backend existant `GET /v1/history/statistics` (calcul serveur). Pas de dénormalisation
d'un champ `lenderStats` sur l'entité `User` en MVP — c'est de la sur-ingénierie pour la volumétrie actuelle.

### Calcul du trustScore global (FIX-15)

Le trustScore est un score **unique par utilisateur en tant qu'emprunteur**, calculé côté back en agrégeant tous les
prêteurs qui ont une relation avec cet utilisateur. Il est exposé via un endpoint dédié et consommé par le front
partout où le score apparaît : profil self et fiche contact. Ce principe est symétrique à FIX-14 (côté prêteur pour
les stats) — même source de vérité back, même consommation front. Aucun recalcul côté client.

### Fraîcheur des données

- `useFocusEffect` sur les écrans Stats/Profil : refetch au retour sur l'écran
- Invalidation explicite des stats après chaque mutation (créer/confirmer/contester un prêt)
- Websockets : POST-MVP — dépend de la résolution du scale-to-zero Fly (CORR-01) et d'un besoin terrain confirmé

### Cohérence inter-comptes

Même source de vérité (endpoint serveur) + refetch au focus couvre le besoin MVP. La vraie synchronisation temps réel
est POST-MVP (FIX-16).

### Lots séquencés

| Lot   | Contenu                                                                                | Qui            | Effort | Cible    |
|-------|----------------------------------------------------------------------------------------|----------------|--------|----------|
| LOT 1 | Stats prêteur : brancher `GET /history/statistics` + `useFocusEffect` (FIX-14)         | Front (Ismael) | S      | MVP      |
| LOT 2 | Fraîcheur après mutation : invalidation stats après créer/confirmer/contester (FIX-14) | Front (Ismael) | XS     | MVP      |
| LOT 3 | trustScore global : endpoint back + consommation front (FIX-15)                        | Back + Front   | M      | MVP      |
| LOT 4 | Vérif format endpoint `/history/statistics` vs openapi.yaml (FIX-14 back)              | Back (Ozias)   | XS     | MVP      |
| LOT 5 | Websockets : push temps réel inter-comptes (FIX-16)                                    | Back + Front   | M→L    | Post-MVP |
| LOT 6 | Dénormalisation `lenderStats` sur `User`                                               | Back           | L      | Post-MVP |

---

## Répartition pour demain

### Ismael — Front (quick-wins d'abord)

| Ordre | FIX                                                                                            | Effort | Nature        |
|-------|------------------------------------------------------------------------------------------------|--------|---------------|
| 1     | FIX-12 — Supprimer l'affichage de la date dans la timeline si absente                          | XS     | Quick-win     |
| 2     | FIX-10 — `formatDate()` centralisé + remplacer les 9 occurrences                               | XS     | Quick-win     |
| 3     | FIX-03 [front] — Rendre date de retour obligatoire dans le wizard                              | XS     | Quick-win     |
| 4     | FIX-11 — Helper `getContactForUser()` dans LoanCard + LoanDetailScreen                         | S      | Fonctionnel   |
| 5     | FIX-14 — Brancher `GET /history/statistics` + `useFocusEffect` + invalidation mutations        | M      | LOT 1+2 archi |
| 6     | FIX-15 [front] — Afficher le trustScore global (endpoint back) sur profil self + fiche contact | M      | MVP           |
| 7     | FIX-04 [front] — Filtrer objets disponibles uniquement dans le wizard                          | S      | Fonctionnel   |
| 8     | FIX-09 [front] — Email non éditable en mode édition contact                                    | XS     | Fonctionnel   |
| 9     | FIX-01/02 [vérif] — Vérifier affichage URL absolue photos + avatar                             | XS     | Vérification  |

### Ozias — Back (quick-wins d'abord)

| Ordre | FIX                                                                            | Effort | Nature             |
|-------|--------------------------------------------------------------------------------|--------|--------------------|
| 1     | FIX-05 volet B — Pas de PREVENTIVE pour Δ<3j (`reminder-policy.ts`)            | XS     | Quick-win          |
| 2     | FIX-01 + FIX-02 — ~~`UPLOAD_BASE_URL` via `fly secrets set` (court terme)~~ abandonné : R2 directement (FEAT-01) | XS     | Quick-win bloquant |
| 3     | FIX-03 [back] — Rendre `returnDate` obligatoire dans le DTO                    | XS     | Quick-win          |
| 4     | FIX-09 [back] — Retirer email du `UpdateBorrowerDto`                           | XS     | Fonctionnel        |
| 5     | FIX-05 volet A — Auto-confirm 24h pour Δ<3j (`loans-cron.service.ts`)          | S      | Workflow correctif |
| 6     | FIX-04 [back] — Contrôle 409 prêt actif sur même item                          | M      | Fonctionnel        |
| 7     | FIX-15 [back] — Exposer endpoint trustScore global (agrégé tous prêteurs)      | M      | MVP                |
| 8     | FIX-14 [back] — Vérifier format endpoint `/history/statistics` vs openapi.yaml | XS     | Vérification       |
| 9     | FIX-01 + FIX-02 [fond] — Implémenter R2PhotoStorageService (= CORR-02) — ✅ code (FEAT-01) | M      | Persistance        |
| —     | FIX-16 — Websockets                                                            | M→L    | POST-MVP           |

> **Note Ozias** : la transition automatique `ACTIVE → AWAITING_RETURN` à l'échéance est un sujet à confirmer
> séparément — hors périmètre des FIX ci-dessus. **Traité (FEAT-10, 28/10/2026)**, cf. doc 16.

---

## Ordre global conseillé

**Étape 1 — Quick-wins indépendants (les deux côtés en parallèle)**

- Front : FIX-12 (supprimer date absente timeline), FIX-10 (formatDate), FIX-03 [front], FIX-11 (contact relatif au
  rôle)
- Back : FIX-05 volet B (pas de PREVENTIVE Δ<3j), FIX-01/02 config `UPLOAD_BASE_URL`, FIX-03 [back], FIX-09 [back]

**Étape 2 — Fond fonctionnel**

- Front : FIX-14 (stats LOT 1+2 : brancher `GET /history/statistics` + useFocusEffect + invalidation), FIX-04 [front]
- Back : FIX-05 volet A (auto-confirm 24h), FIX-04 [back], FIX-01/02 [fond] R2

**Étape 3 — Chantier trustScore + stats (FIX-15)**

- Back : endpoint trustScore global
- Front : afficher trustScore global (profil self + fiche contact)

**Étape 4 — Vérifications & filet**

- FIX-14 [back] vérif format endpoint, FIX-09 [front], FIX-01/02 [vérif affichage]

**Étape 5 — Post-MVP**

- FIX-16 (websockets), dénormalisation `lenderStats`

---

*Document produit à partir des notes de tests terrain du 22/06/2026 — révisé le 23/06/2026 (relecture Ismael + Ozias) —
à mettre à jour après chaque correctif appliqué.*
