# 0010 — Anonymiser un compte supprimé au lieu d'effacer ses prêts

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
compte, mais garder des données anonymisées est accepté. Le RGPD impose l'effacement des données personnelles de la
personne qui le demande, sans obliger à effacer les données des autres.

Un prêt concerne deux personnes. Le prêt clos d'un prêteur fait aussi partie de l'historique de son emprunteur
(écran Historique, score de confiance agrégé par `GET /users/me/trust-score`).

## Décision

Un compte supprimé devient une **pierre tombale** : la ligne `users` reste, marquée `deletedAt`, sans donnée
personnelle. Dans une seule transaction :

- **Compte** : prénom et nom remplacés par des valeurs fixes (`Compte` / `supprimé`), email remplacé par une adresse
  unique et non routable (`deleted+<id>@deleted.invalid`, domaine réservé par la RFC 2606), ce qui libère l'adresse
  d'origine ; mot de passe remplacé par un hash inutilisable ; téléphone et photo de profil effacés ; préférences
  remises aux valeurs par défaut. La connexion devient impossible.
- **Supprimé** : refresh tokens, téléphones enregistrés (push), notifications, invitations envoyées et reçues ; ses
  objets et ses contacts qui ne figurent dans aucun prêt ; les lignes `Photo` de ses objets.
- **Conservé** : ses prêts clos, l'objet de chaque prêt (nom, catégorie, valeur ; sans photo) et le contact de
  l'emprunteur lié à ces prêts.
- **Ses emprunts** : les contacts qui le représentaient chez d'autres prêteurs sont détachés (`Borrower.userId` à
  `null`), comme le fait déjà `ON DELETE SET NULL` aujourd'hui.
- **Après la transaction** : purge des photos R2 sous `users/<id>/` (avatar et objets), comme aujourd'hui.

Le refus `409 active-loans-exist` est conservé. L'API signale un compte supprimé par `UserSummary.accountDeleted:
true`, omis sinon. La recherche de contacts exclut les comptes supprimés. Toute requête authentifiée d'un compte
supprimé est refusée (défense en profondeur, en plus des tokens révoqués).

## Conséquences

Positives :

- La suppression de compte fonctionne pour tous, ce qui débloque la publication sur l'App Store.
- L'emprunteur garde son historique et son score de confiance.
- Aucune clé étrangère à modifier : les contraintes `RESTRICT` restent un garde-fou contre la perte de prêts.
- L'adresse email peut resservir pour une nouvelle inscription.

Négatives et dette acceptée :

- Les pierres tombales restent en base sans limite de durée. Elles ne contiennent aucune donnée personnelle.
- Toutes les requêtes qui lisent des utilisateurs doivent tenir compte de `deletedAt` (recherche, authentification,
  invitations) : un oubli exposerait un compte supprimé. Il faut un test par point d'entrée.
- Le nom de l'objet et les notes du prêt, écrits par le prêteur, restent visibles pour l'emprunteur : ils font partie
  du prêt commun aux deux.
- Les builds installés (iOS 3 et 4, Android `versionCode` 3) ignorent `accountDeleted` et affichent « Compte
  supprimé » tel quel, en français.
- Migration Prisma : une colonne `users.deleted_at` nullable, sans réécriture de données.

## Alternatives écartées

- **Effacer les prêts clos du prêteur** : l'emprunteur perdrait des prêts de son historique, et son score de confiance
  changerait sans raison. Un utilisateur effacerait ainsi les données d'un autre.
- **Rendre `Loan.lenderId` nullable avec `ON DELETE SET NULL`** : cela ne règle pas `Loan.item` ni `Loan.borrower`,
  supprimés en cascade avec le compte. Il faudrait aussi rendre `Loan.lender` facultatif dans le contrat, ce qui casse
  les builds installés (ils lisent `loan.lender.firstName`).
- **Refuser la suppression tant qu'il existe des prêts, même clos** : contraire à la règle 5.1.1(v) d'Apple et au
  droit à l'effacement.
