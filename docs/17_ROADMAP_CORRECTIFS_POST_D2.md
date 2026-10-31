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
| FIX-22 | Suppression de compte en 500 pour tout prêteur (bloque l'App Store)                   | 🔴 Critique | 2   | Ozias   | M      | à décider | ☐      |
| FIX-23 | La déconnexion ne désinscrit pas le téléphone des notifications                       | 🟠 Majeur   | 2   | Ismael  | S      | —         | ☐      |
| FIX-24 | L'emprunteur reçoit les statistiques privées du prêteur sur lui                       | 🟠 Majeur   | 2   | Ismael  | S      | oui       | ☐      |
| FIX-25 | Date de retour minimale : J+2 local côté app, J+2 UTC côté API                        | 🟠 Majeur   | 2   | Ismael  | XS     | —         | ☐      |
| FIX-26 | Envoi de fichiers : aucune limite Multer, erreurs étiquetées `INVALID_UUID`           | 🟠 Majeur   | 2   | Ozias   | S      | —         | ☐      |
| FIX-27 | Aucune notification à la réception d'une invitation de contact                        | 🟡 Mineur   | 2   | Ismael  | M      | oui       | ☐      |
| FIX-28 | 403 au lieu de 404 révèle l'existence d'une ressource                                 | 🟡 Mineur   | 2   | Ismael  | S      | oui       | ☐      |
| FIX-29 | Avertissement `path-to-regexp` sur la route `/v1/*`                                   | 🟡 Mineur   | 2   | Ozias   | XS     | —         | ☐      |
| FIX-30 | `prettier --check .` signale 2 fichiers hors du périmètre `format:check`              | 🟡 Mineur   | 2   | Ismael  | XS     | —         | ☐      |
| FIX-31 | Secret Fly `JWT_REFRESH_SECRET` inutilisé                                             | 🟡 Mineur   | 2   | Ozias   | XS     | —         | ☐      |

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
- **Décision produit à prendre (les deux)** : à la suppression du prêteur, supprimer ses prêts clos (l'emprunteur perd
  l'historique) ou les anonymiser (prêteur « Compte supprimé »).
- **Correctif** : selon la décision, migration Prisma et suppression dans une transaction ; erreur RFC 7807 si un prêt
  actif bloque.

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
  et `INVALID_FORMAT` (déjà dans l'enum `ErrorDetail.code`).

### FIX-27 — Aucune notification à la réception d'une invitation de contact

- **Gravité** : 🟡 Mineur (fonctionnalité manquante) · **Porteur** : Ismael · **Effort** : M · **Contrat** : oui
- **Cause** : `contact-invitations.service.ts:149-217` n'émet aucun événement ; `NotificationType`
  (`schema.prisma:342-350`) n'a pas de type invitation.
- **Correctif** : inventaire des événements qui méritent une notification, puis contrat, enum, listener, push.

### FIX-28 — 403 au lieu de 404 révèle l'existence d'une ressource

- **Gravité** : 🟡 Mineur · **Porteur** : Ismael · **Effort** : S · **Contrat** : oui
- **Constat** : un tiers reçoit 403 sur un prêt, un objet ou un contact qui existe, 404 sinon : il peut tester des
  identifiants. Le contrat (`openapi.yaml:507-524`) prévoit ce 403. Le message du 403 sur un GET parle de « change
  this loan status » (`loans.service.ts:686`).
- **Décision** : 404 pour tout ce qui n'appartient pas à l'utilisateur, ou garder 403.

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
