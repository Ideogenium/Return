# 0009 — Origine CORS stricte en production

Statut : accepté
Date : 2026-10-31
Révision : 2027-04-30
Métrique : en production, `CORS_ORIGIN` vaut toujours une seule origine https exacte et non locale, et l'API n'a
jamais démarré avec `*` ni avec la valeur par défaut `http://localhost:8081`.
À l'échéance : retrait par défaut — la reconduction exige un nouvel ADR
Classe (molette) : réversible — un changement de `fly.toml` ou d'un secret, annulable au déploiement suivant.

## Contexte

`main.ts` passe `CORS_ORIGIN` au middleware CORS ; la valeur par défaut est `http://localhost:8081` (confort de
développement). En préprod, `CORS_ORIGIN` était un secret Fly valant `*`, ce qui autorise n'importe quel site web à
appeler l'API depuis un navigateur (CORR-05, FEAT-02).

L'app mobile n'est pas soumise au CORS : seul un front web en a besoin, et aucun n'est déployé. Le middleware compare
des chaînes exactes : une barre finale ou un chemin ne correspond jamais à l'en-tête `Origin` envoyé par un navigateur.

## Décision

- En `NODE_ENV=production`, l'API refuse de démarrer si `CORS_ORIGIN` n'est pas **une seule origine https exacte et
  non locale** (pas de `*`, pas de liste, pas de chemin ni de barre finale, pas de `localhost`) —
  `config.validation.ts`.
- `fly.toml` fixe `CORS_ORIGIN = 'https://return-api.fly.dev'` (l'origine de l'API elle-même), faute de front web ; si
  un front web est déployé, c'est son origine qu'on y met.
- L'ancien secret `CORS_ORIGIN='*'` est supprimé (posé en `--stage`, effectif au déploiement suivant).

## Conséquences

✅ Positives :

- Aucun site tiers ne peut appeler l'API depuis le navigateur d'un utilisateur connecté.
- Une valeur oubliée, trop large ou mal écrite se voit au démarrage, pas en production.

❌ Négatives / dette acceptée :

- Une seule origine : un futur front web servi depuis plusieurs domaines exigera de faire évoluer la règle (et cet
  ADR).
- Le démarrage de production dépend d'une valeur correcte de `CORS_ORIGIN`.

## Alternatives écartées

- **Garder `*`** : sans risque pour l'app mobile, mais ouvre l'API à tout site web, sans aucun besoin.
- **Désactiver CORS** : équivalent à refuser tout front web futur sans le dire ; la règle explicite documente mieux
  l'intention.
- **Accepter une liste d'origines** : inutile aujourd'hui (aucun front web) et plus facile à mal configurer.
