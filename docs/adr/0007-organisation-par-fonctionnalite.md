# 0007 — Organisation de l'équipe par fonctionnalité (vertical slice)

Statut : accepté
Date : 2026-10-25
Révision : 2027-04-25
Métrique : sur les fonctionnalités livrées depuis la date de l'ADR, chacune l'a été par **une seule PR** (contrat + back + front + tests) portée par **un seul responsable**, sans fonctionnalité bloquée en attente de « l'autre côté ».
À l'échéance : retrait par défaut — la reconduction exige un nouvel ADR
Classe (molette) : réversible — décision d'organisation, annulable par un nouvel ADR ; aucun impact sur le code ni les données.

> Numérotation : fait suite aux ADR-001 → ADR-006 consignés dans `docs/01_ARCHITECTURE_TECHNIQUE.md`.

## Contexte

Jusqu'ici, l'équipe de 2 développeurs était découpée **par couche technique** : Esdras sur le backend (NestJS,
`backend/`), Ismael sur le frontend (Expo / React Native, `frontend/`). Ce découpage est encodé dans la documentation :
mention « Périmètre : Front = Ismael · Back = Esdras » des docs 11, 12, 13 et 14, roadmaps séparées
`04_ROADMAP_BACKEND.md` / `05_ROADMAP_FRONTEND.md`, colonnes « Back / Front » dans les tableaux de responsables.

Ce mode a produit des effets de bord observés pendant la préprod : fonctionnalités à moitié livrées (endpoint prêt mais
écran absent, ex. CORR-08 History/Statistics non consommés ; CORR-14 écrans Sprint 6 retirés), corrections devant être
coordonnées des deux côtés (FIX-01/02 photos, FIX-17 trustScore), et dérive doc/code parce que personne ne portait une
fonctionnalité de bout en bout.

L'équipe reprend le projet et veut mieux travailler et garder une structure plus nette.

## Décision

L'équipe découpe désormais le travail **par fonctionnalité** : chaque développeur prend une fonctionnalité complète et
la mène de bout en bout — contrat OpenAPI → backend → frontend → tests — au lieu d'une couche.

Règles concrètes :

1. **Une fonctionnalité = un responsable = une branche = une PR** (`feature/<scope>-<nom>` ou `fix/<scope>-<nom>`,
   convention de `02_NORMES_OPERATIONNELLES.md` §4.1), couvrant `backend/` **et** `frontend/`.
2. **Contract First dans la PR** : le premier commit de la PR met à jour `docs/openapi.yaml` (et les types dérivés) avant
   tout code d'implémentation.
3. **Review croisée** : l'autre développeur relit la PR (1 approval, CI verte — règle inchangée). La review est aussi le
   moment où il découvre la partie de la stack qu'il connaît le moins.
4. **Roadmaps et backlogs** : à partir de maintenant, chaque ticket/fonctionnalité a **un responsable unique** ; les
   colonnes « Back / Front » disparaissent des nouveaux documents de planification.
5. **Docs existantes** : la mise à jour des documents existants (`docs/00`→`15`, `docs/CLAUDE.md`) pour refléter
   cette organisation est confiée à Ismael.

## Conséquences

**Positives**

- Une fonctionnalité est « finie » au sens de la Definition of Done dans une seule PR : plus d'endpoint orphelin ni
  d'écran qui attend son API.
- Responsabilité claire : une personne répond de la cohérence contrat ↔ back ↔ front ↔ doc de sa fonctionnalité.
- Les deux développeurs montent en compétence sur toute la stack ; le bus factor passe de 1 à 2 par couche.

**Négatives / risques acceptés**

- **Courbe d'apprentissage** : chacun doit maîtriser NestJS/Prisma _et_ Expo/Zustand. Les premières fonctionnalités
  seront plus lentes. Mitigation : `docs/CLAUDE.md` et `docs/ONBOARDING.md` comme points d'entrée ; review croisée
  pédagogique.
- **Conflits sur les fichiers partagés** : `docs/openapi.yaml`, `backend/prisma/schema.prisma` (et migrations),
  navigation frontend (`frontend/src/navigation/`), fichiers i18n, `api.types.ts`. Mitigation : PR courtes (tickets
  ≤ 2 h), rebase fréquent sur `main`, une seule migration Prisma par PR, prévenir l'autre avant de toucher au schéma.
- **Cohérence transverse** : sans « gardien » d'une couche, les conventions (RFC 7807, patterns Zustand, structure des
  modules NestJS) peuvent diverger. Mitigation : `02_NORMES_OPERATIONNELLES.md` reste la référence, vérifiée en review.

## Alternatives écartées

- **Garder le découpage back / front** : rejeté — c'est la source des fonctionnalités à moitié livrées et des
  allers-retours de coordination constatés en préprod.
- **Binôme (pair programming) sur chaque fonctionnalité** : rejeté comme mode par défaut — divise le débit par deux
  pour une équipe de deux ; reste possible ponctuellement sur un sujet difficile.

## Questions ouvertes

- Les docs 13 et 14 citent **« Ozias »** (responsable back) et **« natismael »** (owner des comptes Apple/EAS/Firebase).
  Leur identité vis-à-vis d'Esdras et Ismael n'est pas confirmée dans le repo : à préciser pour savoir qui détient
  quels comptes de distribution (doc 15), indépendamment du découpage par fonctionnalité.
- Les chantiers non découpables en fonctionnalité (comptes de distribution, credentials push, infra Fly.io/R2) :
  à attribuer explicitement, ticket par ticket.

> **Réponses (13/11/2026, clôture, voir `18_CLOTURE_PROJET.md`)** : Ozias et Esdras sont la même personne ; `natismael`
> est le compte d'Ismael (EAS, Play, Firebase). Le compte Apple Developer est celui d'Ozias. `docs/ONBOARDING.md`,
> cité plus haut, n'a jamais été commité : le doc 18 le remplace comme point d'entrée. Cet ADR, écrit le 25/10, n'a été
> versionné qu'à la clôture.
