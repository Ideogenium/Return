# 17_ROADMAP_CORRECTIFS_POST_D2.md

**Return ↺ — Correctifs après la mise en production D2**

> **Date** : 31 octobre 2026
> **Source** : tests en prod du 31/10 (Ozias sur iPhone, build iOS 4 ; Ismael sur Android, `versionCode` 3), et
> backlog relevé pendant les revues des PR #30 et #31. Chaque fiche a été **revérifiée dans le code de `main`**
> (`3564e29`) avant d'être écrite.
> **Prod** : API v12 sur Fly.io (`return-api.fly.dev`), déployée le 31/10 depuis `main`.
> **Organisation** : par fonctionnalité (ADR 0007). Chaque fiche a **un seul porteur**, qui fait contrat → back →
> front → tests ; l'autre relit la PR.
> **Suite de** : `13_ROADMAP_CORRECTIFS_TESTS.md` (FIX-01 → FIX-17). La numérotation continue à FIX-18.

---

### Résultat des tests en prod du 31/10

| Test | Sujet                                                              | Résultat            |
| ---- | ------------------------------------------------------------------ | ------------------- |
| A    | Photos sur R2 (envoi, survie à un redémarrage)                     | ✅                  |
| B    | Création d'un prêt, push, contestation                             | ❌ → FIX-18, FIX-19 |
| C    | Rappels dans la timeline, replanification, annulation              | ✅                  |
| D    | Historique et statistiques                                         | ✅                  |
| E    | Déconnexion puis connexion sur un autre compte                     | ✅                  |
| F    | Passage du job overdue (tick 16:00 UTC, 0/0, ni failed ni tripped) | ✅                  |
| G    | Clavier Android à l'inscription                                    | ✅                  |

### Légende gravité

Identique au doc 13 :

| Symbole | Niveau   | Définition                                                              |
| ------- | -------- | ----------------------------------------------------------------------- |
| 🔴      | Critique | Casse une fonctionnalité cœur ou bloque la publication                  |
| 🟠      | Majeur   | Impact notable en production, à traiter avant la mise en ligne publique |
| 🟡      | Mineur   | Dette technique ou UX dégradée, peut attendre un sprint dédié           |

---

## Tableau récapitulatif

**Lot 1** = build 5, à faire maintenant. **Lot 2** = avant la publication sur les stores.

| ID     | Titre                                                                                 | Gravité     | Lot | Porteur | Effort | Contrat   | Statut |
| ------ | ------------------------------------------------------------------------------------- | ----------- | --- | ------- | ------ | --------- | ------ |
| FIX-18 | Fenêtres avec champ de texte : clavier par-dessus, contestation impossible sur iPhone | 🔴 Critique | 1   | Ozias   | S      | —         | ☐      |
| FIX-19 | Champ multiligne caché par le clavier ; défiler ferme le clavier (Android)            | 🟠 Majeur   | 1   | Ozias   | S      | —         | ☐      |
| FIX-20 | Photos HEIC de l'iPhone refusées                                                      | 🟠 Majeur   | 1   | Ozias   | S      | —         | ☐      |
| FIX-21 | Photos de l'objet absentes du détail du prêt, aucun plein écran                       | 🟠 Majeur   | 1   | Ismael  | S      | —         | ☐      |
| FIX-22 | Suppression de compte en 500 pour tout prêteur (bloque l'App Store)                   | 🔴 Critique | 2   | Ozias   | M      | oui       | ☐      |
| FIX-23 | La déconnexion ne désinscrit pas le téléphone des notifications                       | 🟠 Majeur   | 2   | Ismael  | S      | —         | ☐      |
| FIX-24 | L'emprunteur reçoit les statistiques privées du prêteur sur lui                       | 🟠 Majeur   | 2   | Ismael  | S      | PR contrat | ☐      |
| FIX-25 | Date de retour minimale : J+2 local côté app, J+2 UTC côté API                        | 🟠 Majeur   | 2   | Ismael  | XS     | —         | ☐      |
| FIX-26 | Envoi de fichiers : aucune limite Multer, erreurs étiquetées `INVALID_UUID`           | 🟠 Majeur   | 2   | Ozias   | S      | —         | ☐      |
| FIX-27 | Aucune notification à la réception d'une invitation de contact                        | 🟡 Mineur   | 2   | Ismael  | M      | PR contrat | ☐      |
| FIX-28 | 403 au lieu de 404 révèle l'existence d'une ressource                                 | 🟡 Mineur   | 2   | Ismael  | S      | PR contrat | ☐      |
| FIX-29 | Avertissement `path-to-regexp` sur la route `/v1/*`                                   | 🟡 Mineur   | 2   | Ozias   | XS     | —         | ☐      |
| FIX-30 | `prettier --check .` signale 2 fichiers hors du périmètre `format:check`              | 🟡 Mineur   | 2   | Ismael  | XS     | —         | ☐      |
| FIX-31 | Secret Fly `JWT_REFRESH_SECRET` inutilisé                                             | 🟡 Mineur   | 2   | Ozias   | XS     | —         | 🟡      |

### Répartition

- **Ozias** : FIX-18 et FIX-19 (clavier : il a écrit `FormScrollView` et a l'iPhone pour vérifier), FIX-20 (photos,
  FEAT-01, test iPhone obligatoire), puis FIX-22, FIX-26, FIX-29, FIX-31 (back, prod).
- **Ismael** : FIX-21 (affichage des prêts, vérifiable sur Android), puis FIX-23 (il a écrit la remise à zéro au
  logout), FIX-24, FIX-25, FIX-27, FIX-28 (contrat), FIX-30.

### Fichiers partagés (lot 1)

- `ConfirmationDialog.tsx` et `LoanDetailScreen.tsx` : FIX-18 (fenêtres) et FIX-21 (photos) les touchent tous les
  deux. **FIX-18 est fusionné en premier**, puis FIX-21 se met à jour sur `main`. Les zones sont distinctes : les
  fenêtres en bas de `LoanDetailScreen`, la carte de l'objet en haut.

### Processus

1. Une branche par fiche depuis `main` (`fix/FIX-18-dialog-keyboard`, …), une PR vers `main`, relue par l'autre.
2. TDD : le test qui reproduit le bug échoue d'abord.
3. Quand les 4 fiches du lot 1 sont fusionnées : build iOS 5 et Android `versionCode` 4 depuis `main`, puis tests.
4. Une fiche qui touche `docs/openapi.yaml` attend l'accord des deux, **avant** le code.

---

## 🔴 Lot 1 — build 5

### FIX-18 — Fenêtres avec champ de texte : clavier par-dessus, contestation impossible sur iPhone

- **Gravité** : 🔴 Critique · **Porteur** : Ozias · **Effort** : S
- **Constat (test B, iPhone)** : dans la fenêtre de contestation, le clavier cache les boutons « Annuler » et
  « Contester » ; il ne se ferme pas (champ multiligne : la touche Retour ajoute une ligne) ; toucher à côté ferme la
  fenêtre et efface le motif. **Contester un prêt est impossible sur iPhone.** Le champ est aussi caché à mesure qu'il
  grandit.
- **Fichiers** : les 3 seules fenêtres de l'app avec un champ de texte :
  - `frontend/src/screens/loans/LoanDetailScreen.tsx:448-488` — contestation (`contest-loan-dialog`), simple
    `Dialog.Content` sans défilement ;
  - `frontend/src/screens/loans/LoanDetailScreen.tsx:550-610` — modification (notes, date) ;
  - `frontend/src/components/loans/ConfirmationDialog.tsx:57-137` — confirmation ou contestation par l'emprunteur.
- **Cause** : un `Dialog` de react-native-paper reste centré dans un `Modal` plein écran et ne réagit pas au clavier.
  Ses boutons (`Dialog.Actions`) sont hors de la zone qui défile. `onDismiss` est appelé au toucher du fond, même
  pendant la saisie.
- **Correctif** : un composant partagé pour les 3 fenêtres :
  1. la fenêtre se place au-dessus du clavier et sa hauteur se limite à la place restante ; le contenu défile ;
  2. pendant la saisie, toucher le fond ferme le clavier, pas la fenêtre ; le texte n'est jamais perdu ;
  3. le contenu défile dans une `FormScrollView`, comme les formulaires.
- **Tests** : unitaires du composant (fond touché clavier ouvert → `onDismiss` non appelé ; clavier fermé → appelé),
  et des 3 fenêtres (elles utilisent le composant partagé). Vérification sur iPhone, build 5.

### FIX-19 — Champ multiligne caché par le clavier ; défiler ferme le clavier (Android)

- **Gravité** : 🟠 Majeur · **Porteur** : Ozias · **Effort** : S
- **Constat** : Android (Ismael), création de prêt : le champ de notes est caché par le clavier quand il grandit, et
  faire défiler ferme le clavier. iPhone (Ozias) : défiler marche, mais le champ n'est pas suivi non plus.
- **Fichiers** : `frontend/src/components/common/FormScrollView.tsx:59` (`keyboardDismissMode` vaut `on-drag` sur
  Android) ; champs multilignes : `LoanWizard.tsx:335-344`, `ItemForm.tsx:209`, et ceux de FIX-18.
- **Cause** : `on-drag` ferme le clavier au premier défilement ; aucun composant ne fait défiler le formulaire quand le
  champ actif grandit.
- **Correctif** : dans `FormScrollView` seulement (donc tous les formulaires) : `keyboardDismissMode="none"` sur
  Android ; quand le contenu change de taille et qu'un champ de ce formulaire a le focus, faire défiler pour garder sa
  fin au-dessus du clavier.
- **Tests** : test de garde `formScrolling.test.ts` étendu ; unitaires de `FormScrollView`. Vérification Android
  (Ismael) et iPhone.

### FIX-20 — Photos HEIC de l'iPhone refusées

- **Gravité** : 🟠 Majeur · **Porteur** : Ozias · **Effort** : S
- **Constat (test A)** : choisir une photo de la galerie de l'iPhone pour l'avatar affiche « ni JPEG ni PNG ». Par
  défaut, l'iPhone enregistre en HEIC : **la plupart des photos de galerie sont refusées**, pour l'avatar comme pour les
  objets.
- **Fichiers** : `frontend/src/components/items/PhotoPicker.tsx:8,41-46` (seuls JPEG et PNG passent),
  `frontend/src/utils/photo.ts` (construction de l'envoi). Côté API, `FileTypeValidator(/(jpeg|jpg|png)$/)` (contrat).
- **Correctif** : convertir l'image en JPEG sur le téléphone avant l'envoi (`expo-image-manipulator`), au même endroit
  pour les 3 écrans qui utilisent `PhotoPicker`. Effets en plus : redimensionnement (côté le plus long 2048 px), donc
  plus de refus au-delà de 5 Mo ; les métadonnées EXIF, dont la position GPS, disparaissent (point ouvert depuis
  FEAT-01). Aucun changement de contrat : l'API reçoit toujours du JPEG.
- **Tests** : unitaires (HEIC choisi → JPEG envoyé ; image trop grande → redimensionnée). Vérification sur iPhone
  avec une photo HEIC. Nouveau module natif : il faut le build 5.

### FIX-21 — Photos de l'objet absentes du détail du prêt, aucun plein écran

- **Gravité** : 🟠 Majeur · **Porteur** : Ismael · **Effort** : S
- **Constat** : l'emprunteur voit la première photo sur la carte du prêt (`LoanCard.tsx:20-38`), mais **aucune** dans
  le détail, ni les autres photos. Le prêteur ne le voit pas, car il a la fiche de son objet. Nulle part on ne peut
  agrandir une photo (vignettes de 72 px dans `PhotoGallery.tsx`).
- **Fichiers** : `frontend/src/screens/loans/LoanDetailScreen.tsx:257-280` (carte de l'objet, sans photo) ;
  `frontend/src/components/items/PhotoGallery.tsx` ; `ConfirmationDialog.tsx`. L'API renvoie déjà `loan.item.photos`
  (`loans.service.ts`, `include: { photos: true }`) : **aucun changement back ni contrat**.
- **Correctif** :
  1. `PhotoGallery` en lecture seule (sans ajout ni suppression) dans le détail du prêt, pour les deux rôles ;
  2. toucher une vignette ouvre la photo en plein écran, avec passage d'une photo à l'autre (composant partagé, aussi
     dans `ItemDetailScreen`) ;
  3. les photos dans `ConfirmationDialog`, là où l'emprunteur décide de confirmer ou de contester.
- **Tests** : unitaires (galerie affichée pour l'emprunteur, sans bouton de suppression ; ouverture du plein écran).
- **Dépendance** : après la fusion de FIX-18 (fichiers partagés).

---

## Lot 2 — avant la publication sur les stores

### FIX-22 — Suppression de compte en 500 pour tout prêteur

- **Gravité** : 🔴 Critique (Apple exige la suppression de compte dans l'app, guideline 5.1.1(v)) · **Porteur** :
  Ozias · **Effort** : M
- **Constat** : `DELETE /users/me` renvoie 500 dès que l'utilisateur a prêté une fois, même si tous ses prêts sont
  clos.
- **Cause** : `backend/prisma/schema.prisma:233-235` : `Loan.item`, `Loan.lender` et `Loan.borrower` sans `onDelete`,
  donc `ON DELETE RESTRICT`. `users.service.ts:116-147` ne bloque que les prêts actifs, puis `user.delete` heurte les
  prêts clos ou supprimés. L'erreur Prisma `P2003` n'est pas traduite : 500. Un utilisateur qui a seulement emprunté
  peut supprimer son compte (`Borrower.user` en `SetNull`).
- **Décision (31/10, validée en revue de #43)** : **pseudonymiser**, ADR `0010-anonymisation-des-comptes-supprimes.md`.
  - Contrôles : mot de passe d'abord (`401`), puis `409 active-loans-exist` pour les 4 statuts en cours. Ses emprunts
    en cours ne bloquent pas (rappels arrêtés : `borrower.userId ?? null`, téléphones supprimés).
  - Prêts conservés : ses prêts clos (tout statut hors des 4 en cours, `CONTESTED` compris) dont le contact
    emprunteur est relié à un compte. S'il n'en reste aucun : `user.delete` complet, sans pierre tombale.
  - Sinon, pierre tombale (`deletedAt`, noms `Compte` / `supprimé` en base, email `deleted+<id>@deleted.invalid`,
    mot de passe inutilisable, téléphone, avatar et `lastLoginAt` à `null`).
  - Supprimés : sessions, téléphones, ses notifications et invitations, ses prêts `deletedAt`, ses prêts clos non
    conservés, ses objets et contacts hors prêt conservé, ses photos (R2 et lignes `Photo`), et les notifications
    d'autres utilisateurs qui le nomment (`WHERE actorUserId = <id>` : dépend de la colonne interne `actorUserId`
    ajoutée par FIX-27, #45 ; rien à nettoyer avant, FIX-27 n'étant pas déployé).
  - Textes libres qu'il a écrits vidés (description de ses objets, notes de ses prêts). Exception : `contestReason`
    d'un emprunteur qui supprime son compte, conservé pour le prêteur.
  - Contact conservé : noms et email (unicité `@@unique([lenderUserId, email])`), téléphone effacé.
  - Access tokens encore valables (15 min) : clé Redis `user-deleted:<id>` lue par `JwtStrategy`, réponse
    `401 invalid-token`.
  - Réinscription avec la même adresse : `BorrowerLinkingListener` relie les contacts détachés au nouveau compte,
    qui retrouve l'historique d'emprunteur. Accepté.
- **Contrat** (PR #43, contrat seul) : `DELETE /users/me` décrit l'ordre des contrôles, ce qui est effacé et ce qui
  est conservé ; `Loan.lender` et `UserSummary.accountDeleted` (seulement sur `Loan.lender`) ; la recherche de
  contacts exclut les comptes supprimés.
- **Code, après validation du contrat** : migration `users.deleted_at` ; suppression en une transaction ; ordre
  mot de passe puis 409 (aujourd'hui inversé dans `users.service.ts`) ; clé Redis dans `JwtStrategy` ; `deletedAt`
  filtré à la connexion, au refresh, à la recherche et aux invitations ; `accountDeleted` dans le mapper du prêteur ;
  libellé traduit côté app. Un test par point d'entrée qui lit des utilisateurs.
- **Builds installés** : ils ignorent `accountDeleted` et affichent « Compte supprimé » tel quel.
- **Statut** : 🟡 code livré sur `fix/FIX-22-account-deletion` (31/10), tout le contrat #43. Les notifications
  d'autres utilisateurs qui le nomment sont supprimées par `relatedLoanId` (prêts) et par `actorUserId` (invitations,
  colonne de FIX-27 #45, fusionnée). Preuve sur un vrai Postgres 17 : `test/account-deletion.db.e2e-spec.ts`
  (opt-in `DB_E2E_DATABASE_URL`), dont la reproduction du `P2003` d'origine.

### FIX-23 — La déconnexion ne désinscrit pas le téléphone des notifications

- **Gravité** : 🟠 Majeur · **Porteur** : Ismael · **Effort** : S
- **Cause** : `useAuthStore.ts:93-102` efface les jetons, puis `RootNavigator.tsx:44-50` appelle
  `DELETE /notifications/device-token` quand `isAuthenticated` passe à faux, donc sans jeton : 401, erreur ignorée.
  Le téléphone reçoit encore les notifications du compte déconnecté. Commit `34749bf` n'a pas changé l'ordre.
- **Correctif** : désinscrire le téléphone dans `logout`, **avant** `/auth/logout` et l'effacement des jetons.

### FIX-24 — L'emprunteur reçoit les statistiques privées du prêteur sur lui

- **Gravité** : 🟠 Majeur (confidentialité) · **Porteur** : Ismael · **Effort** : S · **Contrat** : oui
- **Cause** : `backend/src/common/mappers/loan-response.mapper.ts:53-69` met toujours `borrower.statistics`
  (`trustScore`, `averageReturnDelay`, etc.) dans les réponses de prêt, y compris pour l'emprunteur
  (`GET /loans`, `GET /loans/{id}`). L'app ne l'affiche pas : la fuite est dans la réponse JSON.
- **Hors fiche** : le score global sur le profil (`LenderStats`, `GET /users/me/trust-score`) est voulu (FIX-15).
- **Correctif** : ne renvoyer `statistics` qu'au prêteur ; contrat mis à jour d'abord.
- **Décision (31/10, Ismael + Ozias)** : `Borrower.statistics` n'est présent que si l'appelant est le prêteur du prêt,
  omis (pas `null`) sinon ; `GET /borrowers/{borrowerId}/statistics` reste réservé au prêteur (inchangé).
  **Décision validée en revue de #40** : pour l'emprunteur, `loan.borrower` contient son propre profil (prénom, nom,
  email de son compte), sans `phoneNumber` ni `statistics` ; `id` reste l'identifiant du contact ; le nom saisi par le
  prêteur dans ses contacts lui reste réservé.
- **À faire dans la PR de code** : la réponse d'un prêt dépend désormais de l'appelant, elle ne doit donc pas être
  partagée en cache entre utilisateurs. Vérifié (31/10) : aucun cache HTTP sur ces routes (pas de `CacheInterceptor`
  ni de `CacheModule`, aucun en-tête `Cache-Control` posé par l'API ; seul `r2-photo-storage.service.ts` définit un
  `CacheControl`, pour les photos). Redis ne sert qu'à la blacklist JWT. Rien à changer aujourd'hui ; ne pas
  introduire de cache de réponse sur `/loans` sans clé par utilisateur (ou `Vary: Authorization`).

### FIX-25 — Date de retour minimale : J+2 local côté app, J+2 UTC côté API

- **Gravité** : 🟠 Majeur · **Porteur** : Ismael · **Effort** : XS
- **Cause** : `frontend/src/utils/date.ts:4-10` (`getMinReturnDate` en heure locale) contre
  `backend/src/loans/loans.service.ts:39-43` (UTC). En UTC-5 à 21 h, le calendrier propose une date que l'API refuse
  (400 `return-date-too-soon`). En UTC+1 juste après minuit, un jour valide n'est pas proposé.
- **Correctif** : calculer la date minimale en UTC côté app, comme `startOfUtcDay` côté API.

### FIX-26 — Envoi de fichiers : aucune limite Multer, erreurs étiquetées `INVALID_UUID`

- **Gravité** : 🟠 Majeur (sécurité : un fichier énorme est lu en entier en mémoire) · **Porteur** : Ozias ·
  **Effort** : S
- **Cause** : aucune option `limits` sur `FileInterceptor` (`items.controller.ts:125-138`, `users.controller.ts:143-151`) :
  Multer lit tout le fichier avant le contrôle de taille. `all-exceptions.filter.ts:84-121` ne reconnaît pas les
  messages de taille et de type de NestJS 11 et les étiquette `INVALID_UUID` sur le champ `id`.
- **Correctif** : `limits: { fileSize }` sur les deux routes (5 Mo, 2 Mo), réponse 400 du contrat ; codes `TOO_LARGE`
  et `FILE_REQUIRED` pour un type refusé (définition du contrat), déjà dans l'enum `ErrorDetail.code`.
- **Livré** (PR #44, branche `fix/FIX-26-upload-limits`) : limites Multer partagées avec `ParseFilePipe`
  (`common/upload/upload-limits.ts`), plus `files`, `fields`, `fieldSize` et `parts` bornés ; filtre d'exceptions qui
  donne à chaque 400 à message (fichier, multipart, UUID) son propre code, et qui répond en RFC 7807 aux erreurs du
  lecteur de corps JSON au lieu d'une 500 (413 au-delà de 100 Ko, 415 pour un jeu de caractères non pris en charge).
- **Suite contrat** (PR contrat seul, branche `docs/contract-upload-errors`, accord d'Ismael) : règle transversale
  413 / 415 dans `info.description` avec les composants `PayloadTooLarge` et `UnsupportedMediaType` ; `TOO_LARGE`
  étendu à la taille d'un fichier ; exemples 400 des deux routes d'envoi, avec les champs `photo` et `avatar`.
- **Suites de code, après la fusion du contrat** :
    - filtre : erreurs d'envoi sur `photo` / `avatar` (nom réel de la partie multipart) au lieu de `file` ;
    - piste : un `exceptionFactory` sur le `ParseFilePipe` de chaque route, qui porte le nom du champ, plutôt que de
      reconnaître les messages de NestJS dans le filtre ;
    - limite exacte : `MaxFileSizeValidator` refuse une taille **égale** à la limite (`<`), Multer et l'app
      l'acceptent (`<=`) ; aligner les trois sur la même règle ;
    - app : `payload-too-large` dans `ERROR_TYPE_MAP`, et un message dédié pour `TOO_LARGE` sur une photo.

### FIX-27 — Aucune notification à la réception d'une invitation de contact

- **Gravité** : 🟡 Mineur (fonctionnalité manquante) · **Porteur** : Ismael · **Effort** : M · **Contrat** : oui
- **Cause** : `contact-invitations.service.ts:149-217` n'émet aucun événement ; `NotificationType`
  (`schema.prisma:342-350`) n'a pas de type invitation.
- **Correctif** : inventaire des événements qui méritent une notification, puis contrat, enum, listener, push.
- **Décision (31/10, Ismael + Ozias)** : notifier la réception (au destinataire) et l'acceptation (à l'auteur) ;
  ni le refus ni l'expiration. Nouveaux types `CONTACT_INVITATION_RECEIVED` et `CONTACT_INVITATION_ACCEPTED`,
  `relatedLoanId` reste `null` ; données du push `{ type, invitationId }` (voir `PushNotificationData` dans le
  contrat). Tap : réception -> Contacts, invitations reçues ; acceptation -> Contacts, invitations envoyées. Les
  anciens builds ignorent un type inconnu (icône par défaut, tap sans effet). Invitation annulée ou expirée : la
  notification reste et ouvre la liste des invitations. **Migration Prisma** : ajout de 2 valeurs à l'enum
  `NotificationType` (`schema.prisma:342-350`).

### FIX-28 — 403 au lieu de 404 révèle l'existence d'une ressource

- **Gravité** : 🟡 Mineur · **Porteur** : Ismael · **Effort** : S · **Contrat** : oui
- **Constat** : un tiers reçoit 403 sur un prêt, un objet ou un contact qui existe, 404 sinon : il peut tester des
  identifiants. Le contrat (`openapi.yaml:507-524`) prévoit ce 403. Le message du 403 sur un GET parle de « change
  this loan status » (`loans.service.ts:686`).
- **Décision** : 404 pour tout ce qui n'appartient pas à l'utilisateur, ou garder 403.
- **Décision (31/10, Ismael + Ozias)** : 404 quand l'appelant n'est pas partie à la ressource, 403 seulement quand il
  est partie sans le droit (ex. emprunteur qui tente une action réservée au prêteur). Le 404 est strictement
  identique (`type`, `title`, `detail`) que la ressource existe ou non. Exception tranchée par Ozias : pour les
  invitations de contact, seule la personne autorisée à l'action voit la ressource (destinataire pour accepter ou
  refuser, émetteur pour annuler), tout autre utilisateur, l'autre partie comprise, reçoit le 404 (plus de 403). Le message du 403 sur un GET de prêt
  (« change this loan status », `loans.service.ts:686`) disparaît avec ce cas (le tiers reçoit un 404).
  **Décisions validées en revue de #40** : 403 pour l'emprunteur, 404 pour le tiers ; `GET /items/{itemId}` par
  l'emprunteur d'un prêt : 404 ; contact (`Borrower`) lu par la personne qu'il représente : 404.
- **À faire dans la PR de code** :
  - invitations : `contact-invitations.service.ts` lève encore `ForbiddenException` (~l.230 accept, ~334 reject,
    ~377 cancel) pour un non-autorisé, avant le 409. À remplacer par le 404 `invitation-not-found` ; ordre des
    contrôles : appartenance (404) puis état (409 `invitation-not-pending` / `invitation-already-accepted`).
  - création de prêt : `loans.service.ts` lève aujourd'hui `forbidden` (objet ~l.560, contact ~l.609) pour une
    ressource d'autrui, à remplacer par le 404 `item-not-found` / `borrower-not-found`. L'ordre actuel (objet,
    409 `item-already-loaned`, contact, puis 403 `contact-not-accepted`) place déjà la propriété avant
    `contact-not-accepted` : le conserver.

### FIX-29 — Avertissement `path-to-regexp` sur la route `/v1/*`

- **Gravité** : 🟡 Mineur · **Porteur** : Ozias · **Effort** : XS
- **Cause** : `backend/src/app.module.ts:62` `forRoutes('*')` avec le préfixe global `v1`.
- **Correctif** : `forRoutes('{*splat}')`.

### FIX-30 — `prettier --check .` signale 2 fichiers hors du périmètre `format:check`

- **Gravité** : 🟡 Mineur · **Porteur** : Ismael · **Effort** : XS
- **Cause** : `babel.config.js` et `assets/branding/README.md` sont hors des globs de `format:check`
  (`frontend/package.json:13`) ; pas de `.prettierignore`.
- **Correctif** : les formater, ou les ignorer explicitement.

### FIX-31 — Secret Fly `JWT_REFRESH_SECRET` inutilisé

- **Gravité** : 🟡 Mineur · **Porteur** : Ozias · **Effort** : XS
- **Cause** : les refresh tokens sont opaques et stockés hachés ; aucun code ne lit ce secret.
- **Correctif** : `fly secrets unset JWT_REFRESH_SECRET --stage -a return-api`, appliqué au prochain déploiement ;
  retirer la variable de `.env.example` et des docs.
- **Statut** : 🟡 secret mis en attente de suppression sur Fly le 31/10 (`--stage`), effectif au prochain déploiement ; variable retirée de `.env.example`, `backend/.env.example`, `docker-compose.yml` et du doc 07. Aucun code ne la lit (`git grep`). Les docs 08, 09 et 11 sont des traces datées, laissées telles quelles.
