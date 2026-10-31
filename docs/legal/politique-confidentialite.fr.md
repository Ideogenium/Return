# Politique de confidentialité de Return

Dernière mise à jour : 31 octobre 2026

Return est une application mobile qui aide des particuliers à suivre les objets et les sommes d'argent qu'ils prêtent
ou empruntent. Cette page explique, simplement, quelles données l'application utilise, pourquoi, qui peut les voir et
comment exercer vos droits.

## 1. Qui est responsable de vos données ?

<!-- À COMPLÉTER AVANT PUBLICATION : nom et adresse du responsable du traitement -->

Le responsable du traitement est l'équipe Return (projet Ideogen) :

- [Nom du responsable]
- [Adresse postale]

Pour toute question sur vos données :

- egbedozin@gmail.com
- nathan.aihou@gmail.com

## 2. Quelles données collectons-nous ?

### Données de votre compte

Fournies par vous à l'inscription ou dans votre profil :

- prénom, nom et adresse email ;
- mot de passe : nous ne le conservons que sous forme hachée (illisible), jamais en clair ;
- numéro de téléphone et photo de profil, facultatifs ;
- vos préférences : notifications push, rappels, langue et fuseau horaire.

Nous enregistrons aussi la date de création du compte et de votre dernière connexion.

### Vos contacts (données de tiers)

Lorsque vous ajoutez un contact (par exemple une personne à qui vous prêtez quelque chose), vous saisissez son prénom,
son nom, son adresse email et, si vous le souhaitez, son numéro de téléphone. Ce sont des données concernant d'autres
personnes, que vous saisissez vous-même. Return ne lit pas le carnet d'adresses de votre téléphone. Si vous ajoutez
une personne, veillez à ce qu'elle soit informée. Vous pouvez aussi envoyer une invitation à un autre utilisateur
inscrit ; il peut l'accepter ou la refuser.

### Vos objets et photos

Nom, description, catégorie et valeur estimée de l'objet prêté, ainsi que les photos que vous y joignez (prises avec
l'appareil photo ou choisies dans votre galerie).

**Important : visibilité des photos.** Les photos (objets et photo de profil) sont stockées sur Cloudflare R2 et
servies par des adresses web (URL) publiques. Ces adresses sont longues et non devinables, mais elles ne demandent
aucune authentification : toute personne qui dispose du lien peut afficher la photo. Évitez donc de photographier des
documents d'identité, des documents bancaires ou toute information sensible. Après la suppression d'une photo, un
cache de diffusion peut continuer à la servir pendant une durée limitée (de l'ordre d'une journée).

### Vos prêts

Objet ou montant prêté, dates (prêt, retour prévu, retour effectif), statut du prêt, notes éventuelles et, si un
emprunteur conteste un prêt, le motif de la contestation.

### Rappels et notifications

Les rappels automatiques et les notifications envoyés dans le cadre d'un prêt (titre, texte, état lu ou non lu).
Pour recevoir des notifications push, nous enregistrons le jeton d'appareil (identifiant technique fourni par votre
téléphone) et sa plateforme (iOS ou Android).

### Statistiques et score de confiance

Return calcule à partir de l'historique des prêts des statistiques (nombre de prêts, retours à temps, en retard ou
non rendus, délai moyen de retour) et un score de confiance (voir section 4).

### Données techniques

- des journaux techniques du serveur, qui contiennent notamment un identifiant de requête et, lorsque vous êtes
  connecté, votre identifiant interne d'utilisateur ;
- votre adresse IP, que le serveur utilise pour limiter le nombre de requêtes et de tentatives de connexion ;
- des jetons de session (voir section 7).

## 3. Pourquoi utilisons-nous vos données ?

| Finalité | Base légale (RGPD) |
| --- | --- |
| Créer votre compte, gérer vos prêts, contacts, objets, photos, rappels, historique et statistiques | Exécution du service que vous avez demandé (contrat) |
| Sécuriser le service : limitation du nombre de requêtes et de tentatives de connexion, journaux techniques, détection des erreurs | Intérêt légitime (protéger le service et ses utilisateurs) |
| Envoyer des notifications push | Votre consentement, donné via l'autorisation de notification de votre téléphone ; vous pouvez la retirer à tout moment dans les réglages du téléphone ou de l'application |

Nous n'utilisons pas vos données pour d'autres finalités.

## 4. Ce que voient les autres utilisateurs

- **L'emprunteur** (s'il a un compte Return) voit les prêts qui le concernent et leur statut. Il voit aussi le nom du
  prêteur.
- **Le prêteur** voit les informations du contact qu'il a saisi pour son emprunteur, ainsi que les prêts qu'il lui a
  consentis.
- Un utilisateur ne voit pas vos autres contacts, vos autres prêts ni vos autres objets.
- **Score de confiance** : pour chaque emprunteur, Return calcule automatiquement un score à partir des retours à
  temps, en retard ou non rendus (les prêts contestés ou encore en cours ne sont pas comptés). C'est un profilage
  simple : il sert uniquement à informer le prêteur, et aucune décision produisant des effets juridiques n'est prise
  automatiquement. Vous pouvez vous opposer à ce calcul ou contester un résultat en nous écrivant (section 8).

## 5. Publicité et suivi

Return ne contient aucune publicité, ne revend pas vos données et n'utilise ni traceur publicitaire ni outil
d'analyse d'audience tiers.

## 6. Qui traite vos données pour nous ?

Nous faisons appel aux prestataires suivants :

- **Fly.io** : hébergement de l'API et de la base de données (application déployée dans la région de Paris, France).
- **Upstash** (Redis, région de Paris, France) : stockage temporaire des identifiants de sessions révoquées et des
  marqueurs de compte supprimé, sans contenu de vos prêts.
- **Cloudflare R2** : stockage des photos.
- **Expo** (service d'envoi de notifications) : transmet les notifications push, qui contiennent leur titre et leur
  texte et le jeton d'appareil.
- **Google Firebase Cloud Messaging** (Android) et **Apple Push Notification service** (iOS) : acheminent les
  notifications jusqu'à votre téléphone.

Certains de ces prestataires peuvent traiter des données en dehors de l'Union européenne, notamment aux États-Unis.
Dans ce cas, le transfert s'appuie sur des garanties appropriées prévues par le RGPD, telles que les clauses
contractuelles types de la Commission européenne ou, le cas échéant, une décision d'adéquation.

## 7. Combien de temps conservons-nous vos données ?

- **Tant que votre compte existe** : vos données sont conservées pour faire fonctionner le service.
- **Sessions** : la connexion repose sur un jeton d'accès de 15 minutes et un jeton de renouvellement de 30 jours,
  conservé uniquement sous forme hachée. Une déconnexion le révoque.
- **Suppression du compte** : vous pouvez supprimer votre compte à tout moment (section 8). Vos données personnelles
  sont alors effacées ou pseudonymisées, mais l'effacement n'est pas total lorsque des prêts terminés doivent être
  conservés pour l'autre partie : un prêt terminé fait aussi partie de l'historique de l'autre
  personne concernée, qui ne doit pas le perdre.
  - Vos sessions, jetons d'appareil, notifications, invitations, ainsi que vos objets et contacts qui ne servent plus
    à personne sont supprimés. Les photos stockées sont supprimées.
  - Vos prêts terminés dont l'emprunteur a un compte Return sont conservés pour cette personne, de façon
    pseudonymisée : votre nom devient « Compte supprimé », votre adresse email, votre mot de passe, votre téléphone et
    votre photo de profil sont effacés, et les textes libres que vous avez écrits (description des objets, notes des
    prêts) sont vidés. L'objet prêté (nom, catégorie, valeur), les dates et le statut restent visibles pour l'autre
    personne. Le motif de contestation écrit par un emprunteur est conservé pour expliquer le statut du prêt au
    prêteur.
  - Les notifications destinées à d'autres utilisateurs et qui vous nomment sont supprimées.
  - Si aucun prêt ne doit être conservé, le compte est supprimé entièrement.
  - Les prêts en cours doivent être clôturés avant de pouvoir supprimer un compte de prêteur.
- **Journaux techniques** : conservés pour une durée limitée, uniquement pour la sécurité et le dépannage.

## 8. Vos droits et comment les exercer

Vous disposez des droits d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de vos
données.

- **Rectifier vos informations et supprimer votre compte** : directement dans l'application, onglet Profil
  (« Supprimer mon compte », avec confirmation par mot de passe).
- **Tous les autres droits** (accès, copie de vos données, limitation, opposition, contestation du score de
  confiance) : écrivez-nous à egbedozin@gmail.com ou nathan.aihou@gmail.com. Nous vous répondons dans un délai d'un
  mois. Nous pouvons vous demander de justifier de votre identité.
- **Réclamation** : si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la CNIL
  (https://www.cnil.fr).

Si vous êtes un contact saisi par un autre utilisateur, les mêmes droits s'appliquent : écrivez-nous.

## 9. Sécurité

- Les échanges avec le serveur sont chiffrés (HTTPS).
- Les mots de passe sont stockés hachés (bcrypt) ; les jetons de renouvellement sont stockés hachés.
- Les jetons de session peuvent être révoqués (déconnexion, suppression du compte).
- Les données ne sont accessibles qu'aux personnes qui en ont besoin pour faire fonctionner le service.
- Limite à connaître : les photos sont accessibles à toute personne qui possède leur lien (voir section 2).

Aucun système n'est infaillible, mais nous prenons ces mesures pour protéger vos données.

## 10. Mineurs

Return s'adresse aux personnes de 18 ans et plus. Nous ne collectons pas sciemment de données de personnes mineures.

## 11. Modifications de cette politique

Nous pouvons mettre à jour cette politique, par exemple lors de l'ajout d'une fonctionnalité. La date de dernière
mise à jour figure en haut de cette page. En cas de changement important, nous vous en informerons dans
l'application ou par email.
