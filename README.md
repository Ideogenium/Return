# Return ↺
**Prêtez l'esprit tranquille.**

---

### Le Problème
Nous avons tous déjà vécu cette situation : vous prêtez un livre, une perceuse ou un peu d'argent à un proche. Le temps passe, la vie continue, et six mois plus tard... l'objet a disparu.

Vous avez oublié qui l'a. Ou pire, vous vous en souvenez, mais vous n'osez pas le réclamer de peur de passer pour quelqu'un de radin ou de procédurier. Résultat : vous perdez vos affaires et cela crée des frictions inutiles.

### La Solution
**Return** est votre mémoire externe pour tout ce qui sort de chez vous — objets comme argent. C'est un registre personnel, simple et élégant, conçu pour encourager la générosité sans sacrifier vos biens.

L'application agit comme un tiers de confiance neutre. Elle se souvient pour vous, et elle rappelle les échéances à votre place.

### Fonctionnalités Clés

#### 1. Capturez l'instant
Ne perdez pas de temps à remplir des formulaires. Prenez une photo de l'objet au moment où vous le prêtez, saisissez le nom et la catégorie, et c'est parti. Pour un prêt d'argent, indiquez simplement le montant.

#### 2. La fin des oublis
Assignez une date de retour (ou laissez indéfini). **Return** garde un œil sur le calendrier. Vous savez toujours exactement où se trouvent vos affaires, affichées sur un tableau de bord clair.

#### 3. Rappels Diplomatiques
C'est la partie la plus délicate du prêt : demander le retour. **Return** s'en charge pour vous. L'application envoie des notifications douces et neutres à l'emprunteur quand la date approche — puis 3 relances progressives si nécessaire. Plus besoin d'envoyer ce SMS gênant : *"Au fait, tu as toujours ma raclette ?"*

#### 4. Historique de Confiance
Gardez une trace de tous vos prêts passés et rendus. Voyez en un coup d'œil qui sont vos amis les plus sérieux et ce que vous avez prêté le plus souvent.

---

### Philosophie
**Return** n'est pas un réseau social. C'est un outil utilitaire, privé et sécurisé. Vos données vous appartiennent. L'objectif est simple : supprimer la charge mentale liée aux prêts, pour que vous puissiez vous concentrer sur ce qui compte vraiment : les relations humaines.

> *"Les bons comptes font les bons amis. Les bons suivis aussi."*

---

### Stack Technique

- **Backend** : NestJS (TypeScript), PostgreSQL, Redis, Prisma
- **Frontend** : React Native (TypeScript), Zustand, React Navigation
- **Infrastructure** : Fly.io, Cloudflare R2, Docker, GitHub Actions
- **API** : REST (OpenAPI 3.1), JWT, RFC 7807

### Installation (une fois par poste)

```bash
npm install              # à la racine : installe commitlint et active les hooks Git (husky)
cd backend && npm install
cd ../frontend && npm install
```

Le `npm install` de la racine lance `npm run prepare`, qui active les hooks Git : sans lui, les messages de commit ne sont pas vérifiés par commitlint et le lint des fichiers indexés ne tourne pas. Si les dépendances racine sont déjà installées, `npm run prepare` suffit. Guides détaillés : [backend](docs/07_GUIDE_LANCEMENT_BACKEND.md), [frontend](docs/FRONTEND.md).

*Projet en phase de spécifications — développement à venir.*
