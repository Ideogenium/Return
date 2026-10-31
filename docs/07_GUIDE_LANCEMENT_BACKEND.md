# Guide de lancement du Backend

## Prérequis

| Outil                   | Version          | Vérification             |
|-------------------------|------------------|--------------------------|
| Node.js                 | ≥ 22.x           | `node -v`                |
| npm                     | ≥ 10.x           | `npm -v`                 |
| Docker + Docker Compose | Dernière version | `docker compose version` |
| Git                     | ≥ 2.x            | `git -v`                 |

---

## 1. Cloner le projet

```bash
git clone https://github.com/Ideogen7/Return.git
cd Return
```

---

## 2. Lancer les services (PostgreSQL + Redis)

```bash
docker compose up -d
```

Vérifie que les conteneurs sont en cours d'exécution :

```bash
docker compose ps
```

| Service       | Port | Conteneur       |
|---------------|------|-----------------|
| PostgreSQL 17 | 5432 | return-postgres |
| Redis 8       | 6379 | return-redis    |

---

## 3. Installer les dépendances backend

```bash
cd backend
npm install
```

---

## 4. Configurer les variables d'environnement

```bash
cp .env.example .env
```

Ouvre `backend/.env` et renseigne les valeurs manquantes :

```dotenv
# Obligatoire — Génère un secret fort (ex: openssl rand -hex 32)
JWT_ACCESS_SECRET=<ton_secret_jwt_access>
```

Les autres valeurs ont des défauts fonctionnels pour le développement local.

### Référence des variables

| Variable                 | Requis  | Défaut                   | Description                                   |
|--------------------------|---------|--------------------------|-----------------------------------------------|
| `NODE_ENV`               | Non     | `development`            | Environnement (development, production, test) |
| `PORT`                   | Non     | `3000`                   | Port du serveur API                           |
| `API_PREFIX`             | Non     | `v1`                     | Préfixe des routes API                        |
| `DATABASE_URL`           | Oui     | (dans .env.example)      | URL PostgreSQL                                |
| `REDIS_URL`              | Non     | `redis://localhost:6379` | URL Redis                                     |
| `JWT_ACCESS_SECRET`      | **Oui** | —                        | Secret pour les access tokens                 |
| `JWT_ACCESS_EXPIRATION`  | Non     | `15m`                    | Durée de vie access token                     |
| `JWT_REFRESH_EXPIRATION` | Non     | `30d`                    | Durée de vie refresh token                    |
| `LOG_LEVEL`              | Non     | `info`                   | Niveau de log (error, warn, info, debug)      |
| `CORS_ORIGIN`            | Non     | `http://localhost:8081`  | Origine CORS autorisée                        |
| `CLIENT_IP_HEADER`       | Prod    | —                        | En-tête posé par le proxy avec l'IP du client (Fly : `fly-client-ip`), pour la limite de débit |
| `TRUST_PROXY_HOPS`       | Non     | `0`                      | Nombre de proxys de confiance (`trust proxy` Express ; Fly : `2`, le proxy ajoute sa propre adresse en dernier dans `X-Forwarded-For`) |

`CLIENT_IP_HEADER` est obligatoire en production (FIX-37) : derrière un proxy, sans lui, tous les utilisateurs partageraient le même compteur de limite de débit. `TRUST_PROXY_HOPS` seul ne suffit pas.

---

## 5. Générer le client Prisma

```bash
npm run prisma:generate
```

Cette commande génère le client TypeScript à partir du schema `prisma/schema.prisma`.

---

## 6. Appliquer les migrations

```bash
npm run prisma:migrate
```

Cela applique toutes les migrations SQL sur la base PostgreSQL locale. À relancer à chaque fois qu'un collègue ajoute
une migration.

---

## 7. Lancer le serveur en mode développement

```bash
npm run start:dev
```

Le serveur démarre sur `http://localhost:3000/v1`.

### Vérifier que tout fonctionne

```bash
curl http://localhost:3000/v1/health
```

Réponse attendue :

```json
{
  "status": "ok",
  "uptime": "...",
  "timestamp": "..."
}
```

---

## Commandes utiles

### Tests

```bash
# Tests unitaires (395 tests)
npm test

# Tests unitaires en mode watch
npm run test:watch

# Tests unitaires avec couverture
npm run test:cov

# Tests E2E (29 tests)
npm run test:e2e
```

### Prisma

```bash
# Générer le client Prisma (après modification du schema)
npm run prisma:generate

# Appliquer les migrations (après un pull avec de nouvelles migrations)
npm run prisma:migrate

# Créer une nouvelle migration
npx prisma migrate dev --name nom_de_la_migration

# Interface visuelle de la base de données
npm run prisma:studio
```

### Lint & Format

```bash
# Lint avec auto-fix
npm run lint

# Formater le code
npm run format
```

### Build

```bash
# Build TypeScript → JavaScript
npm run build

# Lancer le build de production
npm run start:prod
```

### Scripts ponctuels

#### `db:legacy-fix` : données anciennes du déploiement D2

Nettoie les données antérieures à FEAT-11 et mesure ce que le job overdue (FEAT-10) trouvera. Il n'écrit rien tant que `--apply` n'est pas passé.

- a. Annule (`CANCELLED`) les rappels `SCHEDULED` d'un prêt clos (tout statut non remindable) ou supprimé.
- b. Replanifie, comme FEAT-11, les prêts `ACTIVE` / `ACTIVE_BY_DEFAULT` dont les rappels `SCHEDULED` ne suivent pas la `returnDate` actuelle. Les prêts `AWAITING_RETURN` dans ce cas ne sont jamais modifiés : ils sont listés pour examen manuel.
- c. Compte (lecture seule) les prêts que `markAwaitingReturn` basculerait, que `closeExhausted` clôturerait, et les prêts ouverts, pour régler `OVERDUE_JOB_BATCH_SIZE` / `OVERDUE_JOB_MAX_SHARE`.

Précondition : **sauvegarde de la base faite** avant tout `--apply`. Les étapes a et b s'exécutent dans une seule transaction (tout ou rien) ; relancé, le script ne fait plus rien.

```bash
# Tunnel vers la base de prod (autre terminal), puis :
export DATABASE_URL="postgresql://...@localhost:<port>/<base>"

# À blanc : comptes et liste des UUID concernés, aucune écriture
npm run db:legacy-fix

# Écriture (après relecture de la sortie à blanc)
npm run db:legacy-fix -- --apply
```

Le script compile le projet (`tsc`) puis lance un `PrismaClient` direct : aucune application Nest, aucun cron, aucun listener n'est démarré.

---

## Structure du backend

```
backend/
├── prisma/
│   ├── schema.prisma          # Schéma de la base de données
│   └── migrations/            # Migrations SQL (versionné)
├── src/
│   ├── main.ts                # Point d'entrée
│   ├── app.module.ts          # Module racine
│   ├── auth/                  # Authentification (JWT, register, login)
│   ├── users/                 # Gestion des profils utilisateur
│   ├── borrowers/             # Emprunteurs + listeners (stats, linking)
│   ├── loans/                 # Prêts + CRON rappels
│   ├── items/                 # Objets prêtés + photos
│   ├── contact-invitations/   # Invitations de contact (Sprint 4.6)
│   ├── common/                # Exceptions RFC 7807, middleware, events, logger
│   ├── config/                # Validation des variables d'environnement
│   ├── prisma/                # PrismaService (module global)
│   ├── redis/                 # RedisService (wrapper ioredis)
│   ├── health/                # Endpoint /health
│   └── storage/               # Stockage de photos (local en dev)
└── test/
    └── *.e2e-spec.ts          # Tests d'intégration E2E
```

---

## Résoudre les problèmes courants

### `DATABASE_URL` invalide ou connexion refusée

```bash
# Vérifier que PostgreSQL tourne
docker compose ps
docker compose logs postgres
```

### Client Prisma désynchronisé

```bash
# Regénérer après un pull
npm run prisma:generate
```

### Migrations en conflit

```bash
# Réinitialiser la base (DESTRUCTIF — dev uniquement)
npx prisma migrate reset
```

### Port 3000 déjà occupé

```bash
lsof -i :3000
kill -9 <PID>
```

---

## Checklist pour un nouveau développeur

1. [ ] Cloner le repo
2. [ ] `docker compose up -d`
3. [ ] `cd backend && npm install`
4. [ ] `cp .env.example .env` + renseigner les secrets JWT
5. [ ] `npm run prisma:generate`
6. [ ] `npm run prisma:migrate`
7. [ ] `npm run start:dev`
8. [ ] `curl http://localhost:3000/v1/health` → `{"status":"ok"}`
9. [ ] `npm test` → 395 tests PASS
10. [ ] `npm run test:e2e` → 29 tests PASS
