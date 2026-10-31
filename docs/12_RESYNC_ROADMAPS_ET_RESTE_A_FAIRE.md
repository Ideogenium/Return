# 12_RESYNC_ROADMAPS_ET_RESTE_A_FAIRE.md

**Return ↺ — Mises à jour documentaires & Analyse du reste-à-faire**

> **Date** : 20 juin 2026
> **Source** : 2ᵉ passe d'analyse (`architecte`) + arbitrage factuel dans le code
> **Complément de** : `docs/11_CORRECTIFS_PREPROD.md` (backlog des correctifs de code/config — **non répété ici**)
> **Périmètre** : Front = Ismael · Back = Esdras

> ⚠️ **Ce document ne reprend PAS les correctifs CORR-01→14 du doc 11.** Il couvre uniquement ce qui est **nouveau** : (
> A) les mises à jour de documentation à effectuer, (B) l'analyse de cohérence du reste-à-faire, (C) l'arbitrage des
> contradictions. Les correctifs sont seulement **référencés** (CORR-xx → voir doc 11).

---

## A. Mises à jour documentaires — resync roadmaps ↔ réalité

L'audit a révélé que les roadmaps officielles listent comme « à faire » des éléments **déjà livrés**, et passent sous
silence de vrais bloquants. À resynchroniser :

| Document                          | Mise à jour à faire                                                                                                                                                                                               | Raison                                                                |
|-----------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------|
| `08_ROADMAP_PREPROD.md`           | Cocher **Phase 1** (backend Fly.io) et **Phase 2** (config front : URL `return-api.fly.dev`, modules `false`, `app.json`, `eas.json`) comme **FAITES**                                                            | Déjà livré et vérifié dans le code                                    |
| `08_ROADMAP_PREPROD.md` — Phase 6 | Clarifier la stratégie push : **FCM natif** vs **Expo Push** (cf. CORR-13)                                                                                                                                        | La roadmap suppose FCM natif, le code utilise Expo Push → incohérence |
| `04_ROADMAP_BACKEND.md`           | Cocher **Sprints 5-6** livrés ; **centraliser R2** (aujourd'hui dispersé entre §6.5 et le doc dédié `10_ROADMAP_CLOUDFLARE_R2.md`)                                                                                | Désynchro + information dispersée                                     |
| `05_ROADMAP_FRONTEND.md`          | Cocher **Sprints 4.6/5** livrés ; **acter le retrait des écrans Sprint 6** (Dashboard/History/Statistics — cf. CORR-14) ; marquer la section **« basculement mock→réel » comme OBSOLÈTE** (tout est déjà en réel) | Désynchro + section caduque                                           |
| `docs/CLAUDE.md`                  | Tableau « Avancement » (déjà tracé comme **CORR-11** dans le doc 11)                                                                                                                                              | Périmé (Sprints 4.6/5/6 marqués non faits)                            |
| `00_BIBLE_PROJET.md`              | **Si** on assume la version allégée : acter l'écart **Epic 4** (stats « objet le plus prêté / meilleur emprunteur » + vue historique dédiée)                                                                      | Décision produit liée à CORR-14                                       |

> Ces mises à jour sont **documentaires** (aucun code touché) — distinctes des correctifs du doc 11. Elles peuvent être
> faites à tout moment, idéalement en fin de chantier preprod.

---

## B. Analyse de cohérence du reste-à-faire

### Verdict

Notre vision du reste-à-faire est **globalement cohérente**, mais les **roadmaps sont désynchronisées** de la réalité,
dans les deux sens : (1) elles listent « à faire » des choses **déjà livrées** (preprod Phases 1-2, Sprints 5-6) ; (2)
elles **ignorent deux vrais bloquants** absents de toute roadmap — le **CRON scale-to-zero** (CORR-01) et l'*
*incompatibilité push token Expo/FCM** (CORR-13). Le *« reste à faire réel »* n'est donc **pas** celui des roadmaps →
resynchroniser avant de planifier.

### Reste-à-faire consolidé (vérifié), par jalon

**Jalon 1 — Preprod testable de bout en bout**

| Élément                                                            | Statut        | Réf          |
|--------------------------------------------------------------------|---------------|--------------|
| Backend déployé Fly.io (`return-api.fly.dev`)                      | ✅ Fait        | 08 Phase 1   |
| Config front (URL réelle, modules `false`, `app.json`, `eas.json`) | ✅ Fait        | 08 Phase 2   |
| CRON fiables malgré scale-to-zero                                  | ❌ À faire     | CORR-01      |
| Push token compatible (Expo↔FCM)                                   | ❌ À faire     | CORR-13      |
| Build push (plugin `expo-notifications` + `projectId`)             | ❌ À faire     | CORR-03 / 04 |
| Secrets Fly (`FIREBASE_SERVICE_ACCOUNT_BASE64`, `CORS_ORIGIN`)     | ⚠️ À vérifier | CORR-05      |
| Persistance photos (R2)                                            | ❌ À faire     | CORR-02      |
| Build APK + test terrain                                           | ❌ À faire     | 08 Phase 3-4 |

**Jalon 2 — MVP prod-ready** (checklist `06_PLAN_GENERAL.md`)

| Élément                                   | Statut                    | Réf          |
|-------------------------------------------|---------------------------|--------------|
| ~49 endpoints backend fonctionnels        | ✅ Fait                    | 06           |
| Couverture de tests enforced (95/90/70)   | ⚠️ Partiel (non enforced) | CORR-10      |
| Smoke E2E complet (register→loan→return)  | ⚠️ Partiel                | 04 E2E       |
| Epic 4 — stats/historique exposés côté UI | ⚠️ Partiel                | CORR-14 / 08 |
| DNS `api.return.app` + SSL                | ❌ À faire                 | CORR-12      |
| CORS resserré pour la prod                | ❌ À faire                 | CORR-05      |
| Build Expo iOS + Android                  | ❌ À faire                 | 06 M6        |

**Jalon 3 — V2 (backlog, non prioritaire)** : invitation par email (non-inscrits), OCR, notifications email/SMS, rappels
manuels, Detox E2E — tous **OUT-OF-SCOPE MVP** (`06` Post-MVP). Statut : À faire (V2).

### Chemin critique recommandé (preprod → prod)

> Ordonné par dépendances. Tester sur téléphone **avant** d'avoir réglé les bloquants = test faussé (ni rappels, ni
> push, photos perdues).

1. **Bloquants infra/back** *(Esdras — parallélisables)* : CORR-01 (CRON), CORR-02 (R2), CORR-05 (secrets).
2. **Push — décision commune** *(Front+Back)* : trancher **Option A vs B** (CORR-13), puis CORR-03 + CORR-04 *(Ismael)*.
3. **Build APK + test terrain** *(Ismael)* — **seulement après 1 et 2**.
4. **Décisions produit** *(non bloquantes preprod)* : CORR-06 (MONEY UI), CORR-14 (écrans Epic 4).
5. **Qualité avant prod** : CORR-07, CORR-08, CORR-10, CORS resserré, CORR-12 (DNS/SSL).
6. **Resync roadmaps** (partie A ci-dessus) + CORR-11 — à tout moment.

### Angles morts (hors correctifs déjà tracés au doc 11)

- **Resync des roadmaps** (partie A) — n'apparaît dans aucune roadmap : les docs se croient à un état qu'elles ont
  dépassé.
- *(Les autres angles morts — CRON, push token, plugin notifications, coverage — sont déjà des correctifs : CORR-01 /
  13 / 03 / 10.)*

### Scope vs Bible

- **IN-SCOPE MVP non exposé** : Epic 4 (stats « objet le plus prêté / meilleur emprunteur » + historique dédié) →
  CORR-14 / 08.
- **OUT-OF-SCOPE fait par erreur** : **aucun** — pas de sur-ingénierie (deep linking, OCR, etc. bien laissés de côté). ✅

---

## C. Arbitrage des contradictions (traçabilité)

La 2ᵉ analyse a produit des affirmations contradictoires avec la 1ʳᵉ cartographie. Vérifiées dans le code :

| Affirmation (2ᵉ analyse)                         | Vérification code                                                                                                                    | Verdict                                                                                     |
|--------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------|
| « Le prêt MONEY échoue silencieusement à l'API » | `backend/src/loans/dto/create-loan.dto.ts:17` → `item!: string \| CreateItemDto` (inline accepté explicitement)                      | ❌ **RÉFUTÉ** — le flux MONEY fonctionne. Seul souci réel = item orphelin côté UI (CORR-06)  |
| « Push token Expo ≠ FCM token »                  | `frontend/src/services/pushNotifications.ts:21` (Expo) ↔ `backend/src/firebase/firebase.service.ts:67` (`sendEachForMulticast`, FCM) | ✅ **CONFIRMÉ** → nouveau correctif **CORR-13**                                              |
| « Écrans Sprint 6 absents »                      | `ls frontend/src/screens/` (pas de `history/`/`dashboard/`/`statistics/`), 0 occurrence `HistoryStore`                               | ✅ **CONFIRMÉ** mais **refactor assumé** (commit `e4e1358`), pas un oubli bloquant → CORR-14 |

---

*Document généré le 20/06/2026 — complément non redondant du backlog `11_CORRECTIFS_PREPROD.md`.*
