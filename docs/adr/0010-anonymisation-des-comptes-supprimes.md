# 0010 — Pseudonymiser un compte supprimé au lieu d'effacer ses prêts

Statut : accepté
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

**Prêts conservés** : seulement ses prêts clos dont le contact emprunteur est relié à un **autre** compte
(`Borrower.userId` non nul et différent du sien), c'est-à-dire ceux que quelqu'un peut encore voir. Si aucun prêt n'est conservé, le compte est supprimé
entièrement (`user.delete`), sans pierre tombale.

Sinon, le compte devient une **pierre tombale** : la ligne `users` reste, marquée `deletedAt`. Dans une seule
transaction, bornée (attente du verrou 5 s, durée 30 s), qui commence par verrouiller la ligne du compte encore actif
(`SELECT … FOR UPDATE`) : un second appel simultané ne trouve plus de compte actif (`404`), et une création de prêt
(qui prend `FOR SHARE` sur la ligne du prêteur) attend la fin de la suppression puis est refusée (`401`). Les prêts en
cours sont revérifiés sous ce verrou ; une contrainte heurtée par une écriture concurrente donne `409
active-loans-exist`, jamais `500` :

- **Compte** : prénom et nom remplacés par les valeurs fixes `Compte` / `supprimé`, enregistrées en base ; email
  remplacé par une adresse unique et non routable (`deleted+<id>.<aléa>@deleted.invalid`, domaine réservé par la
  RFC 2606), ce qui libère l'adresse d'origine. La partie aléatoire rend l'adresse impossible à deviner, et le domaine
  `deleted.invalid` est refusé à l'inscription et au changement d'email (`400 INVALID_EMAIL`) : personne ne peut
  occuper l'adresse d'une pierre tombale et bloquer ainsi une suppression sur la contrainte d'unicité ; mot de passe remplacé par un hash inutilisable ; téléphone, photo de profil et
  `lastLoginAt` à `null` ; préférences remises aux valeurs par défaut.
- **Supprimé** : refresh tokens, téléphones enregistrés (push), ses notifications, ses invitations envoyées et reçues ;
  ses prêts supprimés logiquement (`deletedAt`) ; ses prêts clos non conservés, avec leurs objets et contacts ; ses
  objets et contacts qui ne figurent dans aucun prêt conservé ; les lignes `Photo` de ses objets.
- **Notifications d'autres utilisateurs qui le nomment** : supprimées explicitement, dans les deux issues :
  - celles liées à un de ses prêts, comme prêteur ou comme emprunteur (`relatedLoanId`), avant la suppression des
    prêts ;
  - celles d'invitation, par la colonne interne `Notification.actorUserId` de FIX-27 (#45), non exposée par l'API :
    avec la pierre tombale, la ligne `users` reste, donc la `Cascade` de cette clé ne se déclenche pas.
- **Textes libres qu'il a écrits** : vidés, selon une règle unique : description de ses objets et notes de ses prêts.
  Exception : le motif de contestation (`contestReason`) écrit par un emprunteur qui supprime son compte est conservé,
  car il explique au prêteur le statut `CONTESTED` de son prêt.
- **Conservé** : ses prêts clos conservés (dates, statut), l'objet de chaque prêt (nom, catégorie, valeur ; sans
  photo ni description) et le contact de l'emprunteur (noms et email ; le téléphone est effacé, l'email reste à cause
  de la contrainte d'unicité `@@unique([lenderUserId, email])`).
- **Ses emprunts** : les contacts qui le représentaient chez d'autres prêteurs sont détachés **pour de bon**
  (`Borrower.userId` à `null`, `accountDeletedAt` renseigné, exposé en `accountDeleted: true` au prêteur) : leur
  email devient une adresse non routable unique du domaine `deleted.invalid` et leur téléphone est effacé. Le nom donné
  par le prêteur, les prêts et les statistiques restent chez ce prêteur.
- **Dernière étape de la transaction** : la clé Redis `user-deleted:<id>` (voir plus bas). Si elle ne peut pas être
  écrite, la transaction est annulée et l'API répond `503` : rien n'est effacé.
- **Après la transaction** : purge des photos R2 sous `users/<id>/` (avatar et objets), comme aujourd'hui.

**Access tokens encore valables** : `JwtStrategy` ne lit pas la base (seule la liste noire Redis des `jti` est
consultée), et la pierre tombale garde la ligne `users`. Un access token émis avant la suppression resterait donc
utilisable jusqu'à 15 min. La suppression écrit dans Redis, dans la transaction, une clé `user-deleted:<id>` dont la
durée de vie est celle de l'access token (`JWT_ACCESS_EXPIRATION`, dont le format est vérifié au démarrage, 15 min par
défaut) ; `JwtStrategy` la lit avec la liste noire en un seul `MGET` et répond `401 invalid-token`. La suppression
complète (`user.delete`) pose la même clé. En défense en profondeur, un compte `deletedAt` reçoit `404` sur ses routes
de profil, et `401` à la création d'un objet, d'un contact, d'une photo ou d'un prêt.

L'API signale un compte supprimé par `accountDeleted: true` sur `Loan.lender`, omis sinon. La recherche de contacts
exclut les comptes supprimés. La connexion et le refresh refusent un compte `deletedAt` (défense en profondeur, en
plus des tokens révoqués).

**Nouvelle inscription avec la même adresse** (décision d'équipe, Esdras et Ismael, revue de sécurité C4) : elle crée un compte **sans
aucun lien** avec l'ancien. L'adresse n'est pas vérifiée à l'inscription : relier par email les contacts détachés
donnerait l'historique d'emprunteur de la personne supprimée à quiconque s'inscrit avec son adresse. Les contacts
détachés n'ont donc plus son email (voir « Ses emprunts ») et `BorrowerLinkingListener` ne peut pas les relier. Si un
prêteur invite le nouveau compte, l'invitation acceptée crée un nouveau contact, sans historique : l'unicité
`(lenderUserId, email)` ne bloque pas, puisque l'ancien contact n'a plus cet email. Ce rattachement pourra être
réautorisé une fois l'email vérifié (FIX-40, lot 3).

## Conséquences

Positives :

- La suppression de compte fonctionne pour tous, ce qui débloque la publication sur l'App Store.
- L'emprunteur garde son historique et son score de confiance.
- Aucune clé étrangère à modifier : les contraintes `RESTRICT` restent un garde-fou contre la perte de prêts.
- L'adresse email peut resservir pour une nouvelle inscription, sans donner accès à l'historique de l'ancien compte.
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
- Une personne qui se réinscrit avec la même adresse ne retrouve **pas** son historique d'emprunteur, et un prêteur
  qui l'invite de nouveau a deux contacts : l'ancien, marqué « compte supprimé », et le nouveau (jusqu'à FIX-40).
- Une suppression revérifie les prêts en cours sous verrou et attend au plus 5 s ce verrou : sous forte concurrence,
  elle peut répondre `409` ou échouer à l'expiration du délai plutôt que d'attendre.
- Le `503` en cas de panne Redis rend la suppression impossible pendant la panne ; c'est le prix d'une révocation
  garantie des sessions.
- La clé Redis est écrite avant le commit de la transaction. Si le commit échoue ensuite, rien n'est effacé, mais le
  compte reçoit `401 invalid-token` jusqu'à l'expiration de la clé (au plus 15 min). C'est un échec fermé, accepté.
- Les builds installés (iOS 3 et 4, Android `versionCode` 3) ignorent `accountDeleted` et affichent `Compte supprimé`
  tel quel, en français.
- Migrations Prisma : colonnes `users.deleted_at` et `borrowers.account_deleted_at`, nullables, sans réécriture de
  données.

## Questions ouvertes

- **Rattachement après vérification de l'email (FIX-40)** : une fois l'adresse vérifiée à l'inscription, faut-il
  proposer de relier les contacts détachés au nouveau compte, avec l'accord du prêteur ?
- **Pierres tombales orphelines** : une pierre tombale dont plus aucun prêt conservé n'est visible (par exemple
  quand l'emprunteur supprime à son tour son compte et que son contact est détaché) n'est plus utile à personne ; elle pourrait être supprimée par une tâche
  périodique (suivi dans le doc 17).

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
