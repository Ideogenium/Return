/**
 * Privacy policy bodies as static HTML, derived from `docs/legal/*.md` (Markdown stays the
 * editorial source). A TS module rather than .html assets so the build, and the Docker image that only
 * copies `dist`, need no asset configuration. `privacy-policy.content.spec.ts` guards against drift.
 */
export const PRIVACY_POLICY_BODY = {
  fr: `<h1>Politique de confidentialité de Return</h1>
<p>Dernière mise à jour : 31 octobre 2026</p>
<p>Return est une application mobile qui aide des particuliers à suivre les objets et les sommes d'argent qu'ils prêtent ou empruntent. Cette page explique, simplement, quelles données l'application utilise, pourquoi, qui peut les voir et comment exercer vos droits.</p>
<h2>1. Qui est responsable de vos données ?</h2>
<!-- À COMPLÉTER AVANT PUBLICATION : nom et adresse du responsable du traitement -->
<p>Le responsable du traitement est l'équipe Return (projet Ideogen) :</p>
<ul>
<li>[Nom du responsable]</li>
<li>[Adresse postale]</li>
</ul>
<p>Pour toute question sur vos données :</p>
<ul>
<li><a href="mailto:egbedozin@gmail.com">egbedozin@gmail.com</a></li>
<li><a href="mailto:nathan.aihou@gmail.com">nathan.aihou@gmail.com</a></li>
</ul>
<h2>2. Quelles données collectons-nous ?</h2>
<h3>Données de votre compte</h3>
<p>Fournies par vous à l'inscription ou dans votre profil :</p>
<ul>
<li>prénom, nom et adresse email ;</li>
<li>mot de passe : nous ne le conservons que sous forme hachée (illisible), jamais en clair ;</li>
<li>numéro de téléphone et photo de profil, facultatifs ;</li>
<li>vos préférences : notifications push, rappels, langue et fuseau horaire.</li>
</ul>
<p>Nous enregistrons aussi la date de création du compte et de votre dernière connexion.</p>
<h3>Vos contacts (données de tiers)</h3>
<p>Lorsque vous ajoutez un contact (par exemple une personne à qui vous prêtez quelque chose), vous saisissez son prénom, son nom, son adresse email et, si vous le souhaitez, son numéro de téléphone. Ce sont des données concernant d'autres personnes, que vous saisissez vous-même. Return ne lit pas le carnet d'adresses de votre téléphone. Si vous ajoutez une personne, veillez à ce qu'elle soit informée. Vous pouvez aussi envoyer une invitation à un autre utilisateur inscrit ; il peut l'accepter ou la refuser.</p>
<h3>Vos objets et photos</h3>
<p>Nom, description, catégorie et valeur estimée de l'objet prêté, ainsi que les photos que vous y joignez (prises avec l'appareil photo ou choisies dans votre galerie).</p>
<p><strong>Important : visibilité des photos.</strong> Les photos (objets et photo de profil) sont stockées sur Cloudflare R2 et servies par des adresses web (URL) publiques. Ces adresses sont longues et non devinables, mais elles ne demandent aucune authentification : toute personne qui dispose du lien peut afficher la photo. Évitez donc de photographier des documents d'identité, des documents bancaires ou toute information sensible. Après la suppression d'une photo, un cache de diffusion peut continuer à la servir pendant une durée limitée (de l'ordre d'une journée).</p>
<h3>Vos prêts</h3>
<p>Objet ou montant prêté, dates (prêt, retour prévu, retour effectif), statut du prêt, notes éventuelles et, si un emprunteur conteste un prêt, le motif de la contestation.</p>
<h3>Rappels et notifications</h3>
<p>Les rappels automatiques et les notifications envoyés dans le cadre d'un prêt (titre, texte, état lu ou non lu). Pour recevoir des notifications push, nous enregistrons le jeton d'appareil (identifiant technique fourni par votre téléphone) et sa plateforme (iOS ou Android).</p>
<h3>Statistiques et score de confiance</h3>
<p>Return calcule à partir de l'historique des prêts des statistiques (nombre de prêts, retours à temps, en retard ou non rendus, délai moyen de retour) et un score de confiance (voir section 4).</p>
<h3>Données techniques</h3>
<ul>
<li>des journaux techniques du serveur, qui contiennent notamment un identifiant de requête et, lorsque vous êtes connecté, votre identifiant interne d'utilisateur ;</li>
<li>votre adresse IP, que le serveur utilise pour limiter le nombre de requêtes et de tentatives de connexion ;</li>
<li>des jetons de session (voir section 7).</li>
</ul>
<h2>3. Pourquoi utilisons-nous vos données ?</h2>
<table>
<thead><tr><th>Finalité</th><th>Base légale (RGPD)</th></tr></thead>
<tbody>
<tr><td>Créer votre compte, gérer vos prêts, contacts, objets, photos, rappels, historique et statistiques</td><td>Exécution du service que vous avez demandé (contrat)</td></tr>
<tr><td>Sécuriser le service : limitation du nombre de requêtes et de tentatives de connexion, journaux techniques, détection des erreurs</td><td>Intérêt légitime (protéger le service et ses utilisateurs)</td></tr>
<tr><td>Envoyer des notifications push</td><td>Votre consentement, donné via l'autorisation de notification de votre téléphone ; vous pouvez la retirer à tout moment dans les réglages du téléphone ou de l'application</td></tr>
</tbody>
</table>
<p>Nous n'utilisons pas vos données pour d'autres finalités.</p>
<h2>4. Ce que voient les autres utilisateurs</h2>
<ul>
<li><strong>L'emprunteur</strong> (s'il a un compte Return) voit les prêts qui le concernent et leur statut. Il voit aussi le nom du prêteur.</li>
<li><strong>Le prêteur</strong> voit les informations du contact qu'il a saisi pour son emprunteur, ainsi que les prêts qu'il lui a consentis.</li>
<li>Un utilisateur ne voit pas vos autres contacts, vos autres prêts ni vos autres objets.</li>
<li><strong>Score de confiance</strong> : pour chaque emprunteur, Return calcule automatiquement un score à partir des retours à temps, en retard ou non rendus (les prêts contestés ou encore en cours ne sont pas comptés). C'est un profilage simple : il sert uniquement à informer le prêteur, et aucune décision produisant des effets juridiques n'est prise automatiquement. Vous pouvez vous opposer à ce calcul ou contester un résultat en nous écrivant (section 8).</li>
</ul>
<h2>5. Publicité et suivi</h2>
<p>Return ne contient aucune publicité, ne revend pas vos données et n'utilise ni traceur publicitaire ni outil d'analyse d'audience tiers.</p>
<h2>6. Qui traite vos données pour nous ?</h2>
<p>Nous faisons appel aux prestataires suivants :</p>
<ul>
<li><strong>Fly.io</strong> : hébergement de l'API et de la base de données (application déployée dans la région de Paris, France).</li>
<li><strong>Upstash</strong> (Redis, région de Paris, France) : stockage temporaire des identifiants de sessions révoquées et des marqueurs de compte supprimé, sans contenu de vos prêts.</li>
<li><strong>Cloudflare R2</strong> : stockage des photos.</li>
<li><strong>Expo</strong> (service d'envoi de notifications) : transmet les notifications push, qui contiennent leur titre et leur texte et le jeton d'appareil.</li>
<li><strong>Google Firebase Cloud Messaging</strong> (Android) et <strong>Apple Push Notification service</strong> (iOS) : acheminent les notifications jusqu'à votre téléphone.</li>
</ul>
<p>Certains de ces prestataires peuvent traiter des données en dehors de l'Union européenne, notamment aux États-Unis. Dans ce cas, le transfert s'appuie sur des garanties appropriées prévues par le RGPD, telles que les clauses contractuelles types de la Commission européenne ou, le cas échéant, une décision d'adéquation.</p>
<h2>7. Combien de temps conservons-nous vos données ?</h2>
<ul>
<li><strong>Tant que votre compte existe</strong> : vos données sont conservées pour faire fonctionner le service.</li>
<li><strong>Sessions</strong> : la connexion repose sur un jeton d'accès de 15 minutes et un jeton de renouvellement de 30 jours, conservé uniquement sous forme hachée. Une déconnexion le révoque.</li>
<li><strong>Suppression du compte</strong> : vous pouvez supprimer votre compte à tout moment (section 8). Vos données personnelles sont alors effacées ou pseudonymisées, mais l'effacement n'est pas total lorsque des prêts terminés doivent être conservés pour l'autre partie : un prêt terminé fait aussi partie de l'historique de l'autre personne concernée, qui ne doit pas le perdre.
<ul>
<li>Vos sessions, jetons d'appareil, notifications, invitations, ainsi que vos objets et contacts qui ne servent plus à personne sont supprimés. Les photos stockées sont supprimées.</li>
<li>Vos prêts terminés dont l'emprunteur a un compte Return sont conservés pour cette personne, de façon pseudonymisée : votre nom devient « Compte supprimé », votre adresse email, votre mot de passe, votre téléphone et votre photo de profil sont effacés, et les textes libres que vous avez écrits (description des objets, notes des prêts) sont vidés. L'objet prêté (nom, catégorie, valeur), les dates et le statut restent visibles pour l'autre personne. Le motif de contestation écrit par un emprunteur est conservé pour expliquer le statut du prêt au prêteur.</li>
<li>Les notifications destinées à d'autres utilisateurs et qui vous nomment sont supprimées.</li>
<li>Si aucun prêt ne doit être conservé, le compte est supprimé entièrement.</li>
<li>Les prêts en cours doivent être clôturés avant de pouvoir supprimer un compte de prêteur.</li>
</ul>
</li>
<li><strong>Journaux techniques</strong> : conservés pour une durée limitée, uniquement pour la sécurité et le dépannage.</li>
</ul>
<h2>8. Vos droits et comment les exercer</h2>
<p>Vous disposez des droits d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de vos données.</p>
<ul>
<li><strong>Rectifier vos informations et supprimer votre compte</strong> : directement dans l'application, onglet Profil (« Supprimer mon compte », avec confirmation par mot de passe).</li>
<li><strong>Tous les autres droits</strong> (accès, copie de vos données, limitation, opposition, contestation du score de confiance) : écrivez-nous à <a href="mailto:egbedozin@gmail.com">egbedozin@gmail.com</a> ou <a href="mailto:nathan.aihou@gmail.com.">nathan.aihou@gmail.com.</a> Nous vous répondons dans un délai d'un mois. Nous pouvons vous demander de justifier de votre identité.</li>
<li><strong>Réclamation</strong> : si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la CNIL (<a href="https://www.cnil.fr">https://www.cnil.fr</a>).</li>
</ul>
<p>Si vous êtes un contact saisi par un autre utilisateur, les mêmes droits s'appliquent : écrivez-nous.</p>
<h2>9. Sécurité</h2>
<ul>
<li>Les échanges avec le serveur sont chiffrés (HTTPS).</li>
<li>Les mots de passe sont stockés hachés (bcrypt) ; les jetons de renouvellement sont stockés hachés.</li>
<li>Les jetons de session peuvent être révoqués (déconnexion, suppression du compte).</li>
<li>Les données ne sont accessibles qu'aux personnes qui en ont besoin pour faire fonctionner le service.</li>
<li>Limite à connaître : les photos sont accessibles à toute personne qui possède leur lien (voir section 2).</li>
</ul>
<p>Aucun système n'est infaillible, mais nous prenons ces mesures pour protéger vos données.</p>
<h2>10. Mineurs</h2>
<p>Return s'adresse aux personnes de 18 ans et plus. Nous ne collectons pas sciemment de données de personnes mineures.</p>
<h2>11. Modifications de cette politique</h2>
<p>Nous pouvons mettre à jour cette politique, par exemple lors de l'ajout d'une fonctionnalité. La date de dernière mise à jour figure en haut de cette page. En cas de changement important, nous vous en informerons dans l'application ou par email.</p>
`,
  en: `<h1>Return Privacy Policy</h1>
<p>Last updated: October 31, 2026</p>
<p>Return is a mobile app that helps individuals keep track of the items and money they lend or borrow. This page explains in plain terms what data the app uses, why, who can see it, and how to exercise your rights.</p>
<h2>1. Who is responsible for your data?</h2>
<!-- À COMPLÉTER AVANT PUBLICATION : nom et adresse du responsable du traitement -->
<p>The data controller is the Return team (Ideogen project):</p>
<ul>
<li>[Controller name]</li>
<li>[Postal address]</li>
</ul>
<p>For any question about your data:</p>
<ul>
<li><a href="mailto:egbedozin@gmail.com">egbedozin@gmail.com</a></li>
<li><a href="mailto:nathan.aihou@gmail.com">nathan.aihou@gmail.com</a></li>
</ul>
<h2>2. What data do we collect?</h2>
<h3>Your account data</h3>
<p>Provided by you when you sign up or edit your profile:</p>
<ul>
<li>first name, last name and email address;</li>
<li>password: we only store it in hashed (unreadable) form, never in clear text;</li>
<li>phone number and profile picture, both optional;</li>
<li>your preferences: push notifications, reminders, language and time zone.</li>
</ul>
<p>We also record when your account was created and when you last logged in.</p>
<h3>Your contacts (third-party data)</h3>
<p>When you add a contact (for example someone you lend something to), you enter their first name, last name, email address and, optionally, phone number. This is information about other people that you enter yourself. Return does not read your phone's address book. If you add someone, please make sure they are aware of it. You can also send an invitation to another registered user, who can accept or decline it.</p>
<h3>Your items and photos</h3>
<p>The name, description, category and estimated value of the lent item, and the photos you attach (taken with the camera or chosen from your photo library).</p>
<p><strong>Important: photo visibility.</strong> Photos (items and profile picture) are stored on Cloudflare R2 and served through public web addresses (URLs). These addresses are long and not guessable, but they require no authentication: anyone who has the link can view the photo. Please avoid photographing identity documents, bank documents or any sensitive information. After a photo is deleted, a delivery cache may keep serving it for a limited time (around one day).</p>
<h3>Your loans</h3>
<p>The item or amount lent, dates (loan, expected return, actual return), loan status, any notes and, if a borrower contests a loan, the reason for the contestation.</p>
<h3>Reminders and notifications</h3>
<p>The automatic reminders and notifications sent about a loan (title, text, read or unread state). To deliver push notifications, we store your device token (a technical identifier provided by your phone) and its platform (iOS or Android).</p>
<h3>Statistics and trust score</h3>
<p>From your loan history, Return computes statistics (number of loans, returns on time, late or not returned, average return delay) and a trust score (see section 4).</p>
<h3>Technical data</h3>
<ul>
<li>server technical logs, which include a request identifier and, when you are logged in, your internal user identifier;</li>
<li>your IP address, which the server uses to limit the number of requests and login attempts;</li>
<li>session tokens (see section 7).</li>
</ul>
<h2>3. Why do we use your data?</h2>
<table>
<thead><tr><th>Purpose</th><th>Legal basis (GDPR)</th></tr></thead>
<tbody>
<tr><td>Create your account and manage your loans, contacts, items, photos, reminders, history and statistics</td><td>Performance of the service you requested (contract)</td></tr>
<tr><td>Keep the service secure: rate limiting of requests and login attempts, technical logs, error detection</td><td>Legitimate interest (protecting the service and its users)</td></tr>
<tr><td>Send push notifications</td><td>Your consent, given through your phone's notification permission; you can withdraw it at any time in your phone or app settings</td></tr>
</tbody>
</table>
<p>We do not use your data for any other purpose.</p>
<h2>4. What other users can see</h2>
<ul>
<li><strong>The borrower</strong> (if they have a Return account) sees the loans that concern them and their status. They also see the lender's name.</li>
<li><strong>The lender</strong> sees the contact details they entered for their borrower, and the loans made to that person.</li>
<li>A user cannot see your other contacts, other loans or other items.</li>
<li><strong>Trust score</strong>: for each borrower, Return automatically computes a score from returns on time, late returns and items not returned (contested and ongoing loans are not counted). This is simple profiling: it only informs the lender, and no decision with legal effect is made automatically. You can object to this calculation or contest a result by writing to us (section 8).</li>
</ul>
<h2>5. No advertising and no tracking</h2>
<p>Return contains no advertising, does not sell your data, and uses no advertising trackers or third-party analytics tools.</p>
<h2>6. Who processes your data on our behalf?</h2>
<p>We rely on the following providers:</p>
<ul>
<li><strong>Fly.io</strong>: hosting of the API and the database (application deployed in the Paris, France region).</li>
<li><strong>Upstash</strong> (Redis, Paris, France region): temporary storage of revoked session identifiers and deleted-account markers, without the content of your loans.</li>
<li><strong>Cloudflare R2</strong>: storage of photos.</li>
<li><strong>Expo</strong> (push notification service): relays push notifications, which contain their title and text and the device token.</li>
<li><strong>Google Firebase Cloud Messaging</strong> (Android) and <strong>Apple Push Notification service</strong> (iOS): deliver notifications to your phone.</li>
</ul>
<p>Some of these providers may process data outside the European Union, notably in the United States. In that case, the transfer relies on appropriate safeguards provided by the GDPR, such as the European Commission's standard contractual clauses or, where applicable, an adequacy decision.</p>
<h2>7. How long do we keep your data?</h2>
<ul>
<li><strong>As long as your account exists</strong>: your data is kept to run the service.</li>
<li><strong>Sessions</strong>: login relies on a 15-minute access token and a 30-day refresh token, stored only in hashed form. Logging out revokes it.</li>
<li><strong>Account deletion</strong>: you can delete your account at any time (section 8). Your personal data is then erased or pseudonymized, but erasure is not total when completed loans must be kept for the other party: a completed loan is also part of the other person's history, and they should not lose it.
<ul>
<li>Your sessions, device tokens, notifications, invitations, and any items and contacts that no one needs anymore are deleted. Stored photos are deleted.</li>
<li>Your completed loans whose borrower has a Return account are kept for that person in pseudonymized form: your name becomes "Deleted account", your email address, password, phone number and profile picture are erased, and the free text you wrote (item descriptions, loan notes) is emptied. The lent item (name, category, value), the dates and the status remain visible to the other person. A contestation reason written by a borrower is kept to explain the loan's status to the lender.</li>
<li>Notifications sent to other users that name you are deleted.</li>
<li>If no loan needs to be kept, the account is deleted entirely.</li>
<li>Ongoing loans must be closed before a lender account can be deleted.</li>
</ul>
</li>
<li><strong>Technical logs</strong>: kept for a limited period, only for security and troubleshooting.</li>
</ul>
<h2>8. Your rights and how to exercise them</h2>
<p>You have the right to access, rectify, erase, restrict, object to the processing of, and port your data.</p>
<ul>
<li><strong>Edit your information and delete your account</strong>: directly in the app, Profile tab ("Delete my account", with password confirmation).</li>
<li><strong>All other rights</strong> (access, copy of your data, restriction, objection, contesting the trust score): write to <a href="mailto:egbedozin@gmail.com">egbedozin@gmail.com</a> or <a href="mailto:nathan.aihou@gmail.com.">nathan.aihou@gmail.com.</a> We will reply within one month. We may ask you to prove your identity.</li>
<li><strong>Complaint</strong>: if you believe your rights are not respected, you can lodge a complaint with the CNIL, the French data protection authority (<a href="https://www.cnil.fr">https://www.cnil.fr</a>), or with your local authority.</li>
</ul>
<p>If you are a contact entered by another user, the same rights apply: write to us.</p>
<h2>9. Security</h2>
<ul>
<li>Communication with the server is encrypted (HTTPS).</li>
<li>Passwords are stored hashed (bcrypt); refresh tokens are stored hashed.</li>
<li>Session tokens can be revoked (logout, account deletion).</li>
<li>Data is only accessible to those who need it to operate the service.</li>
<li>A limitation to be aware of: photos can be viewed by anyone who has their link (see section 2).</li>
</ul>
<p>No system is infallible, but we take these measures to protect your data.</p>
<h2>10. Minors</h2>
<p>Return is intended for people aged 18 and over. We do not knowingly collect data from minors.</p>
<h2>11. Changes to this policy</h2>
<p>We may update this policy, for example when a feature is added. The date of the last update appears at the top of this page. For significant changes, we will let you know in the app or by email.</p>
`,
} as const;
