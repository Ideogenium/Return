# 0010 — Pseudonymiser un compte supprimé au lieu d'effacer ses prêts

Statut : proposé
Date : 2026-10-31
Révision : 2027-04-30
Métrique : aucun `DELETE /users/me` en 500 dans les logs de prod, et aucun emprunteur ne perd un prêt de son historique
après la suppression du compte de son prêteur
À l'échéance : retrait par défaut ; la reconduction exige un nouvel ADR
Classe : irréversible (une suppression de compte efface des données sans retour possible)

## Contexte

`DELETE /users/me` répond 500 pour tout utilisateur qui a prêté au moins une fois, même si tous ses prêts sont clos
(FIX-22, doc 17). Le service ne bloque que les prêts en cours (`409 active-loans-exist`), puis appelle
`user.delete`. Trois clés étrangères en `ON DELETE RESTRICT` l'en empêchent : `Loan.lender`, `Loan.item` (l'objet
est supprimé en cascade avec le compte) et `Loan.borrower` (le contact aussi). L'erreur Prisma `P2003` n'est pas
traduite, d'où le 500.

Apple exige que l'app permette de supprimer son compte (règle 5.1.1(v)) : la suppression doit vraiment effacer le
compte, mais garder des données pseudonymisées est accepté. Le RGPD impose l'effacement des données personnelles de la
personne qui le demande, sans obliger à effacer les données des autres.

Un prêt concerne deux personnes. Le prêt clos d'un prêteur fait aussi partie de l'historique de son emprunteur
(écran Historique, score de confiance agrégé par `GET /users/me/trust-score`).

## Décision

**Contrôles, dans cet ordre** : mot de passe (`401 invalid-current-password`), puis prêts en cours du prêteur
(`409 active-loans-exist` pour `PENDING_CONFIRMATION`, `ACTIVE`, `ACTIVE_BY_DEFAULT`, `AWAITING_RETURN`). Les emprunts
en cours de l'utilisateur chez d'autres prêteurs ne bloquent pas : leurs rappels s'arrêtent d'eux-mêmes, puisque le
cron des rappels lit `borrower.userId ?? null` et que ses téléphones sont supprimés.

Un **prêt clos** est un prêt dans tout autre statut que ces 4, `CONTESTED` compris.

**Prêts conservés** : seulement ses prêts clos dont le contact emprunteur est relié à un compte (`Borrower.userId`
non nul), c'est-à-dire ceux que quelqu'un peut encore voir. Si aucun prêt n'est conservé, le compte est supprimé
entièrement (`user.delete`), sans pierre tombale.

Sinon, le compte devient une **pierre tombale** : la ligne `users` reste, marquée `deletedAt`. Dans une seule
transaction :

- **Compte** : prénom et nom remplacés par les valeurs fixes `Compte` / `supprimé`, enregistrées en base ; email
  remplacé par une adresse unique et non routable (`deleted+<id>@deleted.invalid`, domaine réservé par la RFC 2606),
  ce qui libère l'adresse d'origine ; mot de passe remplacé par un hash inutilisable ; téléphone, photo de profil et
  `lastLoginAt` à `null` ; préférences remises aux valeurs par défaut.
- **Supprimé** : refresh tokens, téléphones enregistrés (push), ses notifications, ses invitations envoyées et reçues ;
  ses prêts supprimés logiquement (`deletedAt`) ; ses prêts clos non conservés, avec leurs objets et contacts ; ses
  objets et contacts qui ne figurent dans aucun prêt conservé ; les lignes `Photo` de ses objets.
- **Notifications d'autres utilisateurs qui le nomment** : supprimées explicitement
  (`WHERE actorUserId = <id du compte supprimé>`). Cela dépend de la colonne interne `Notification.actorUserId`
  ajoutée par FIX-27 (#45), non exposée par l'API : avec la pierre tombale, la ligne `users` reste, donc ni `SetNull`
  ni `Cascade` ne se déclenchent. Les notifications créées avant cette colonne n'ont rien à nettoyer : FIX-27 n'est pas
  encore déployé, il n'existe aucune notification d'invitation en prod.
- **Textes libres qu'il a écrits** : vidés, selon une règle unique : description de ses objets et notes de ses prêts.
  Exception : le motif de contestation (`contestReason`) écrit par un emprunteur qui supprime son compte est conservé,
  car il explique au prêteur le statut `CONTESTED` de son prêt.
- **Conservé** : ses prêts clos conservés (dates, statut), l'objet de chaque prêt (nom, catégorie, valeur ; sans
  photo ni description) et le contact de l'emprunteur (noms et email ; le téléphone est effacé, l'email reste à cause
  de la contrainte d'unicité `@@unique([lenderUserId, email])`).
- **Ses emprunts** : les contacts qui le représentaient chez d'autres prêteurs sont détachés (`Borrower.userId` à
  `null`), comme le fait déjà `ON DELETE SET NULL` aujourd'hui.
- **Après la transaction** : purge des photos R2 sous `users/<id>/` (avatar et objets), comme aujourd'hui.

**Access tokens encore valables** : `JwtStrategy` ne lit pas la base (seule la liste noire Redis des `jti` est
consultée), et la pierre tombale garde la ligne `users`. Un access token émis avant la suppression resterait donc
utilisable jusqu'à 15 min. La suppression écrit dans Redis une clé `user-deleted:<id>` dont la durée de vie est au
moins celle de l'access token (`JWT_ACCESS_EXPIRATION`, 15 min par défaut) ; `JwtStrategy` la vérifie et répond
`401 invalid-token`, le slug déjà utilisé pour un token sur liste noire. La suppression complète (`user.delete`) pose
la même clé.

L'API signale un compte supprimé par `accountDeleted: true` sur `Loan.lender`, omis sinon. La recherche de contacts
exclut les comptes supprimés. La connexion et le refresh refusent un compte `deletedAt` (défense en profondeur, en
plus des tokens révoqués).

**Nouvelle inscription avec la même adresse** : acceptée telle quelle. `BorrowerLinkingListener` relie, à chaque
inscription, les contacts sans compte qui portent cet email ; les contacts détachés lors de la suppression se relient
donc au nouveau compte, qui retrouve l'historique et le score de confiance d'emprunteur de l'ancien. C'est le même
comportement que pour une première inscription.

## Conséquences

Positives :

- La suppression de compte fonctionne pour tous, ce qui débloque la publication sur l'App Store.
- L'emprunteur garde son historique et son score de confiance.
- Aucune clé étrangère à modifier : les contraintes `RESTRICT` restent un garde-fou contre la perte de prêts.
- L'adresse email peut resservir pour une nouvelle inscription.
- Minimisation : rien n'est gardé si personne ne peut plus le voir.

Négatives et dette acceptée :

- Les pierres tombales restent en base sans limite de durée. Elles contiennent des **données pseudonymisées** :
  l'identifiant reste et relie les prêts conservés, sans nom, email, téléphone ni photo d'origine.
- Toutes les requêtes qui lisent des utilisateurs doivent tenir compte de `deletedAt` (recherche, connexion, refresh,
  invitations) : un oubli exposerait un compte supprimé. Il faut un test par point d'entrée.
- Une lecture Redis de plus par requête authentifiée. Comme pour la liste noire des `jti`, une erreur Redis fait
  échouer la requête au lieu de laisser passer le token.
- Le nom de l'objet reste visible pour l'emprunteur, puisqu'il désigne ce qui a été prêté ; la description et les
  notes ne le sont plus.
- Une personne qui se réinscrit avec la même adresse retrouve son historique d'emprunteur.
- Le nettoyage des notifications d'autres utilisateurs dépend de la colonne `actorUserId` de FIX-27 (#45).
- Les builds installés (iOS 3 et 4, Android `versionCode` 3) ignorent `accountDeleted` et affichent `Compte supprimé`
  tel quel, en français.
- Migration Prisma : une colonne `users.deleted_at` nullable, sans réécriture de données.

## Alternatives écartées

- **Effacer tous les prêts clos du prêteur** : l'emprunteur perdrait des prêts de son historique, et son score de
  confiance changerait sans raison. Un utilisateur effacerait ainsi les données d'un autre.
- **Rendre `Loan.lenderId` nullable avec `ON DELETE SET NULL`** : cela ne règle pas `Loan.item` ni `Loan.borrower`,
  supprimés en cascade avec le compte. Il faudrait aussi rendre `Loan.lender` facultatif dans le contrat, ce qui casse
  les builds installés (ils lisent `loan.lender.firstName`).
- **Refuser la suppression tant qu'il existe des prêts, même clos** : contraire à la règle 5.1.1(v) d'Apple et au
  droit à l'effacement.
- **Bloquer aussi sur ses emprunts en cours** : inutile, ses rappels s'arrêtent déjà et le prêteur garde son prêt.
- **Lire la base à chaque requête dans `JwtStrategy`** : une requête SQL de plus par appel pour un cas rare ; la clé
  Redis couvre la fenêtre de 15 min.
