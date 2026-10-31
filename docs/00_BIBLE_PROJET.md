# 00_BIBLE_PROJET.md

**Return ↺ - Document de Fondation Fonctionnelle**

---

## 1. Vision & Objectifs (Elevator Pitch)

### Quel est le problème résolu ?

Les utilisateurs prêtent régulièrement des objets personnels (livres, outils, argent) à leur entourage. Ces prêts
génèrent trois problèmes majeurs :

1. **Oubli** : Après plusieurs semaines/mois, l'utilisateur ne se souvient plus qui a emprunté l'objet
2. **Friction sociale** : La réclamation d'un objet prêté crée une gêne et peut être perçue comme mesquine
3. **Perte définitive** : Faute de suivi, les objets ne sont jamais rendus et sont perdus

### Quelle est la solution proposée ?

**Return** est un registre personnel de prêts qui agit comme un tiers de confiance neutre. L'application :

- Capture instantanément les prêts via photo
- Suit automatiquement les échéances de retour
- Gère les rappels diplomatiques à la place de l'utilisateur
- Archive l'historique complet des prêts

### Quelle est la proposition de valeur unique ?

**Return ne gère pas seulement la mémoire, mais délègue la friction sociale.**

Contrairement à une simple liste ou un rappel calendrier, Return prend en charge la partie la plus inconfortable du
prêt : demander le retour. L'application devient le messager neutre, préservant ainsi les relations humaines tout en
protégeant les biens de l'utilisateur.

### KPIs de succès

**Mesures d'adoption :**

- Temps médian entre inscription et premier prêt enregistré
- Nombre moyen de prêts enregistrés par utilisateur actif par mois
- Taux de rétention à 30/60/90 jours
- Taux d'installation de l'app par les emprunteurs après invitation

**Mesures d'efficacité :**

- Taux de retour : % d'objets effectivement rendus après rappel
- Taux de retour spontané : % d'objets rendus avant le premier rappel
- Délai moyen de retour (avant/après date prévue)
- Taux de confirmation des prêts par les emprunteurs (accepté vs ignoré vs contesté)

**Mesures de satisfaction :**

- Net Promoter Score (NPS)
- Taux de prêts marqués comme "non rendus après rappel"
- Réduction du temps passé à gérer mentalement les prêts (enquête qualitative)

---

## 2. Acteurs & Personas

### 2.1 Prêteur (Utilisateur Principal)

**Profil :**

- Personne qui prête régulièrement des objets à son entourage (famille, amis, collègues)
- Age : 25-55 ans
- Sensible à l'organisation, mais débordé par la vie quotidienne

**Besoins :**

- Enregistrer un prêt rapidement (< 30 secondes)
- Savoir en un coup d'œil ce qui est prêté et à qui
- Recevoir des alertes avant les dates de retour
- Déléguer la demande de retour pour éviter la gêne

**Frustrations :**

- Peur de passer pour quelqu'un de radin en réclamant
- Charge mentale : "Est-ce que j'oublie quelque chose ?"
- Perte d'objets de valeur sentimentale ou financière
- Interfaces complexes qui prennent plus de temps que le prêt lui-même

**Objectifs :**

- Prêter sereinement sans risque de perte
- Maintenir de bonnes relations avec son entourage
- Récupérer ses biens sans conflit

### 2.2 Emprunteur

**Profil :**

- Personne qui emprunte un objet enregistré dans Return
- Dispose obligatoirement d'un compte sur l'application
- Relation personnelle avec le Prêteur

**Besoins :**

- Comprendre qu'un rappel est automatique et non accusateur
- Connaître la date de retour attendue
- Pouvoir communiquer un délai supplémentaire si besoin

**Frustrations :**

- Sentiment d'être surveillé ou suspecté
- Notification perçue comme agressive
- Oubli sincère de la date de retour

**Objectifs :**

- Honorer ses engagements de retour
- Préserver sa réputation de "bon emprunteur"
- Éviter les malaises sociaux

### 2.3 Système (Acteur Technique)

**Rôle :**

- Automatisation des rappels selon la politique fixe
- Gestion des notifications push
- Gestion du cache local pour le mode hors ligne (lecture seule)

**Besoins :**

- Accès aux données de prêts (dates, objets, contacts)
- Capacité d'envoi de notifications push
- Templates de messages diplomatiques multilingues (FR/EN)

---

## 3. Dictionnaire du Domaine (Ubiquitous Language)

### Entités Métier Principales

**Prêt (Loan)**

- Définition : Transaction enregistrée où un Objet est temporairement transféré d'un Prêteur à un Emprunteur avec
  expectative de retour
- Attributs clés : Date de départ, Date de retour prévue, Statut, Type (Objet | Argent)
- Cycle de vie : En attente de confirmation → Actif (ou Contesté / Actif par défaut) → En attente de retour → Rendu /
  Non rendu / Abandonné

**Objet (Item)**

- Définition : Bien physique ou immatériel faisant l'objet d'un Prêt
- Distinction : Objet ≠ Catégorie (ex: "Ma perceuse Bosch" vs "Outil électrique")
- **Deux types de prêt avec workflows distincts :**
    - **Objet physique (OBJECT)** : Photo, nom, description, valeur estimée optionnelle. Workflow standard avec retour
      physique.
    - **Argent (MONEY)** : Montant obligatoire (constitue la valeur du prêt). Pas de photo. Workflow simplifié axé sur
      le remboursement.

**Prêteur (Lender)**

- Définition : Utilisateur propriétaire de l'Objet qui initie le Prêt
- Techniquement : Compte authentifié dans l'application

**Emprunteur (Borrower)**

- Définition : Utilisateur à qui l'Objet est prêté ; doit être un utilisateur inscrit. La relation Contact est établie
  via une invitation mutuellement acceptée avant tout prêt.
- Identification : Nom, Profil utilisateur

**Invitation de Contact**

- Définition : Demande envoyée par un prêteur à un utilisateur inscrit pour l'ajouter à son carnet de contacts. Doit
  être acceptée par le destinataire avant de pouvoir créer un prêt.
- Statuts : `PENDING` → `ACCEPTED` | `REJECTED` | `EXPIRED`

**Rappel (Reminder)**

- Définition : Notification automatique envoyée à l'Emprunteur selon la politique de rappel fixe
- Politique de rappel (5 paliers) :
    - **PREVENTIVE** : Rappel préventif **adaptatif** — planifié à **J-3** si la durée du prêt ≥ 3 jours, sinon à **J-1
      ** (la veille)
    - **J** : Rappel à l'échéance (jour de la date de retour prévue)
    - **J+7** : 1ère relance (7 jours après l'échéance)
    - **J+14** : 2ème relance
    - **J+21** : 3ème et dernière relance
- **Contrainte de durée minimale** : La date de retour doit être au minimum **J+2** (2 jours après la date de création
  du prêt). Cela garantit qu'il y a toujours au moins un rappel préventif (J-1) avant l'échéance.
- Canal V1 : Push notification uniquement. V2+ : SMS, Email.
- Messages : Templates prédéfinis par palier, sélection aléatoire dans un pool pour éviter la répétition

**Historique de Prêt (Loan History)**

- Définition : Archive immuable de tous les Prêts passés avec leur issue
- Usage : Calcul du "score de confiance" d'un Emprunteur

**Statut de Prêt (Loan Status)**

- **En attente de confirmation (PENDING_CONFIRMATION)** : Prêt créé par le Prêteur, non encore confirmé par
  l'Emprunteur
- **Actif (ACTIVE)** : Prêt confirmé en cours, date de retour non atteinte
- **Actif par défaut (ACTIVE_BY_DEFAULT)** : Prêt non confirmé mais accepté implicitement (timeout 48h)
- **Contesté (DISPUTED)** : Prêt refusé par l'Emprunteur, rappels désactivés
- **En attente de retour (AWAITING_RETURN)** : Date de retour dépassée, relance(s) envoyée(s)
- **Rendu (RETURNED)** : Objet restitué, Prêt clos avec succès
- **Non rendu (NOT_RETURNED)** : Objet non restitué après épuisement des 5 rappels automatiques (PREVENTIVE,
  ON_DUE_DATE, FIRST_OVERDUE, SECOND_OVERDUE, FINAL_OVERDUE), Prêt clos automatiquement en échec
- **Abandonné (ABANDONED)** : Le Prêteur renonce volontairement à récupérer son bien avant la fin du cycle de rappels.
  Prêt clos manuellement

### Vocabulaire Exclu (Anti-Patterns)

- ❌ **"Utilisateur"** → Trop vague dans le langage métier. Utiliser explicitement Prêteur ou Emprunteur.
  Note : le terme `User` reste valide dans le code technique pour désigner un compte authentifié (table `users`,
  `UserService`) qui peut être Lender ou Borrower selon le contexte.
- ❌ **"Transaction"** → Implique un échange financier. Utiliser Prêt
- ❌ **"Client"** → Connotation commerciale. Ce n'est pas un service payant (pour MVP)
- ❌ **"Propriétaire" / "Possesseur"** → Confusion juridique. Utiliser Prêteur

---

## 4. Scope Fonctionnel (Macro)

### IN SCOPE - MVP (V1)

#### Epic 1 : Enregistrement de Prêt

- Sélection du type de prêt : Objet physique ou Argent
- **Objet physique** : Capture photo, saisie du nom et de la catégorie
- **Argent** : Saisie du montant (obligatoire)
- Gestion des Contacts : recherche d'utilisateurs inscrits (email / prénom / nom), envoi d'une invitation,
  acceptation/refus par le destinataire. Un prêt ne peut être créé que pour un contact dont l'invitation est acceptée.
- Définition de date de retour (minimum J+2, soit 2 jours après la date du prêt) ou "indéfinie"
- Confirmation et création du Prêt

#### Epic 2 : Tableau de Bord

- Vue liste de tous les Prêts actifs
- Filtres : Statut, Emprunteur, Date de retour
- Compteurs : Nombre d'objets prêtés, valeur totale estimée
- Action rapide : Marquer comme rendu

#### Epic 3 : Système de Rappels

- Politique de rappel fixe appliquée à tous les prêts : PREVENTIVE (J-3 ou J-1 adaptatif), J, J+7, J+14, J+21
- Envoi automatique de notification push à l'Emprunteur
- Templates de messages diplomatiques prédéfinis avec pool aléatoire par palier
- Messages envoyés dans la langue préférée de l'emprunteur
- Log des rappels envoyés

#### Epic 4 : Historique

- Consultation des Prêts terminés (rendus + non rendus)
- Vue par Emprunteur : Taux de retour, délai moyen
- Statistiques personnelles : Objet le plus prêté, meilleur emprunteur

> **État d'implémentation (resync 28/10/2026)** : **partiel**. Livrés : consultation de l'historique des prêts
> terminés (écran Historique depuis le Profil, filtre par statut, pagination) et statistiques de base dans le profil
> prêteur. **Écart assumé / post-échéance** : vue Dashboard dédiée, statistiques « objet le plus prêté / meilleur
> emprunteur » (`mostLoanedItems`, `topBorrowers`, disponibles côté API mais non affichées), filtres par date et par
> emprunteur (cf. CORR-14, doc 11 et doc 16).

#### Epic 5 : Gestion de Compte

- Inscription / Connexion (email + mot de passe)
- Profil utilisateur basique
- Paramètres de notification (activation/désactivation des rappels)
- Préférences de langue (français / anglais)

#### Epic 6 : Internationalisation (i18n)

- Support bilingue français / anglais pour l'ensemble de l'application
- Templates de rappels disponibles dans les deux langues
- Notifications push envoyées dans la langue préférée de l'utilisateur

#### Epic 7 : RGPD & Protection des Données

- Recueil du consentement utilisateur
- Droit de suppression (droit à l'oubli)
- Politique de rétention des données
- Mentions légales

#### Epic 8 : Gestion du Cycle de Vie du Compte

- Désactivation de compte (prêts en cours traités)
- Suppression de compte avec anonymisation des données
- Traitement des prêts en cours lors de la suppression (notification aux parties, clôture ou transfert)

### OUT OF SCOPE - V1

#### Fonctionnalités Reportées V2+

- ❌ Reconnaissance automatique d'objet via photo (Google Cloud Vision)
- ❌ Notifications SMS et Email (canaux supplémentaires)
- ❌ Filtre de tonalité NLP pour messages personnalisés
- ❌ Réseau social / Partage public de prêts
- ❌ Marketplace ou location payante d'objets
- ❌ Gestion de prêts entre tiers (A prête à B qui sous-prête à C)
- ❌ Système de caution ou garantie financière
- ❌ Intégration calendrier externe (Google Calendar, etc.)
- ❌ Export comptable ou fiscal
- ❌ Version web (mobile-first pour MVP)
- ❌ Scan de code-barres / QR code pour inventaire
- ❌ Géolocalisation de l'objet
- ❌ Signature électronique ou contrat de prêt

#### Limitations Techniques Assumées V1

- 1 seul canal de notification (push uniquement)
- Mode hors ligne en lecture seule : l'utilisateur peut consulter les données déjà chargées (profil, liste de prêts,
  détails) via un cache local sur l'appareil. Les opérations d'écriture (création, modification, suppression)
  nécessitent
  une connexion internet. Un indicateur visuel signale le mode hors ligne.
- Pas de gestion multi-comptes (1 utilisateur = 1 compte)
- 2 langues supportées (français, anglais)

---

## Décisions Stratégiques

Les questions ouvertes ont été clarifiées avec les réponses suivantes :

### Q1 : Consentement de l'Emprunteur ✅

**Décision** : Acceptation recommandée mais non bloquante (Workflow hybride)

**Fonctionnement :**

1. Le Prêteur crée le Prêt → Statut initial = **"En attente de confirmation"**
2. L'Emprunteur reçoit une notification push de demande de confirmation
3. Trois issues possibles :
    - **Accepté** → Statut = **"Actif"** (rappels automatiques activés)
    - **Refusé** → Statut = **"Contesté"** (rappels désactivés, alerte au Prêteur)
    - **Ignoré pendant 48h** → Statut = **"Actif par défaut"** (consentement implicite)

**Rationale** :

- Protège contre les abus tout en évitant le blocage du Prêteur
- L'Emprunteur a obligatoirement un compte et reçoit la notification push
- Le taux d'acceptation devient un indicateur de confiance exploitable

### Q2 : Valeur Monétaire de l'Objet ✅

**Décision** : Champ optionnel avec cas spécial pour l'argent

**Règles :**

- Valeur estimée = facultative pour objets physiques
- **Exception** : Type de prêt "Argent" → montant obligatoire
- La valeur permet calculs statistiques et priorisation mais n'est jamais affichée à l'Emprunteur (éviter dimension
  accusatoire)

### Q3 : Ton des Rappels ✅

**Décision** : Templates prédéfinis avec sélection aléatoire

**Implémentation :**

- Un pool de templates de messages diplomatiques prédéfinis par palier de rappel (PREVENTIVE, ON_DUE_DATE,
  FIRST_OVERDUE, SECOND_OVERDUE, FINAL_OVERDUE)
- Le système sélectionne aléatoirement un template du pool correspondant au palier
- Templates disponibles en français et en anglais
- Le message est envoyé dans la langue préférée de l'emprunteur

**Exemples de templates (palier J — échéance) :**

> *"Bonjour [Emprunteur], petit rappel amical : le retour de [Objet] est prévu pour aujourd'hui. Pas d'urgence si tu en
> as encore besoin, dis-le moi ! — [Prêteur]"*

> *"Hey [Emprunteur] ! C'est aujourd'hui le retour prévu de [Objet]. Si tu as besoin d'un peu plus de temps, n'hésite
> pas à me le dire. — [Prêteur]"*

### Q4 : Politique de Rappel et Définition de "Non Rendu" ✅

**Décision** : Politique de rappel fixe avec escalade automatique

**Règles :**

- Politique fixe appliquée à tous les prêts (non configurable par prêt)
- **Contrainte** : La date de retour doit être au minimum **J+2** (2 jours après la création du prêt). Validation
  appliquée côté frontend (calendrier) et backend (API).
- Séquence de 5 rappels :
    - **PREVENTIVE** : Rappel préventif **adaptatif** — planifié à **J-3** si le délai avant retour (Δ) ≥ 3 jours, sinon
      à **J-1** (la veille de l'échéance). Grâce à la contrainte J+2, Δ ≥ 2 est garanti, donc le cas Δ < 1 n'existe pas.
    - **J** : Rappel le jour de l'échéance
    - **J+7** : 1ère relance post-échéance
    - **J+14** : 2ème relance post-échéance
    - **J+21** : 3ème et dernière relance
- Après la 5ème notification ignorée (J+21, dernière relance) → Statut automatique = **"Non rendu (NOT_RETURNED)"**
- Le Prêteur peut à tout moment abandonner manuellement la réclamation → Statut = **"Abandonné (ABANDONED)"**
- Le Prêteur peut toujours voir ces objets dans l'onglet "Non rendus" et "Abandonnés"
- Possibilité de réactiver manuellement le Prêt si l'objet est finalement rendu

**Timeline (cas standard, Δ ≥ 3 jours) :**

| Jour | Action                       | Statut du prêt           |
|------|------------------------------|--------------------------|
| J-3  | 1er rappel (PREVENTIVE)      | Actif                    |
| J    | 2ème rappel (ON_DUE_DATE)    | Actif                    |
| J+1  | Date dépassée                | En attente de retour     |
| J+7  | 3ème rappel (FIRST_OVERDUE)  | En attente de retour     |
| J+14 | 4ème rappel (SECOND_OVERDUE) | En attente de retour     |
| J+21 | 5ème rappel (FINAL_OVERDUE)  | En attente de retour     |
| J+22 | Clôture automatique          | Non rendu (NOT_RETURNED) |

**Timeline (cas prêt court, Δ = 2 jours) :**

| Jour | Action                       | Statut du prêt           |
|------|------------------------------|--------------------------|
| J-1  | 1er rappel (PREVENTIVE)      | Actif                    |
| J    | 2ème rappel (ON_DUE_DATE)    | Actif                    |
| J+1  | Date dépassée                | En attente de retour     |
| J+7  | 3ème rappel (FIRST_OVERDUE)  | En attente de retour     |
| J+14 | 4ème rappel (SECOND_OVERDUE) | En attente de retour     |
| J+21 | 5ème rappel (FINAL_OVERDUE)  | En attente de retour     |
| J+22 | Clôture automatique          | Non rendu (NOT_RETURNED) |

> **Note** : La seule différence est le timing du rappel PREVENTIVE (J-3 vs J-1). La contrainte de date minimum J+2
> garantit qu'il y a toujours un rappel préventif avant l'échéance.

### Q5 : Monétisation ✅

**Décision** : Gratuit au lancement, architecture prête pour Freemium

**V1 (MVP) :**

- Aucune limitation fonctionnelle
- Aucun paiement requis
- Focus : traction et validation du besoin

**Post-MVP (V2+) :**

- Modèle Freemium envisagé
- Limite possible : X prêts actifs simultanés pour version gratuite
- Fonctionnalités premium potentielles : rappels SMS, export de données, multi-comptes

**Impact Architecture :**

- Prévoir dès V1 un champ `subscription_tier` dans le modèle Utilisateur
- Implémenter des quotas désactivés mais présents en base de code

### Q6 — Consentement pour la relation de contact ✅

**Décision** : Les contacts doivent être des utilisateurs inscrits. La relation Contact est établie via invitation
acceptée. Si la personne n'est pas inscrite, une notification externe (email/SMS) peut lui être envoyée pour l'inviter
à s'inscrire (Sprint 5+). Cette décision garantit le consentement explicite de l'emprunteur.

---

**Document validé par :** Esdras GBEDOZIN & Ismael AÏHOU
**Date de dernière mise à jour :** 16 mars 2026
**Version :** 1.2 — Ajout contrainte date retour minimum J+2 et rappel PREVENTIVE adaptatif
