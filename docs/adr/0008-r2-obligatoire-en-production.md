# 0008 — Cloudflare R2 obligatoire en production

Statut : accepté
Date : 2026-10-31
Révision : 2027-04-30
Métrique : aucune photo perdue après un redéploiement (une photo envoyée avant un `fly deploy` reste servie après),
et aucun démarrage de production sur le stockage disque.
À l'échéance : retrait par défaut — la reconduction exige un nouvel ADR
Classe (molette) : irréversible — l'activation touche des secrets de production et un service externe ; le chemin de
retour est l'image précédente (`fly deploy --image …`, décrit dans la PR #30).

## Contexte

Les photos d'objets et les avatars étaient écrits sur le disque du conteneur (`LocalPhotoStorageService`). Sur Fly.io,
ce disque est éphémère : chaque redéploiement ou redémarrage effaçait toutes les photos (CORR-02, FIX-01/02). FEAT-01
ajoute `R2PhotoStorageService` derrière l'interface `PhotoStorage` existante, choisi quand les variables `R2_*` sont
présentes.

Un choix « R2 si configuré, disque sinon » laisse un piège : en production, un secret oublié ou mal saisi ferait
retomber l'API sur le disque, sans erreur, et les photos recommenceraient à disparaître au déploiement suivant. Le
défaut ne se verrait qu'après coup, par une perte de données.

## Décision

- Les 5 variables `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` vont
  **toutes ensemble ou pas du tout** (`readR2Settings`) : une configuration partielle ou mal formée empêche le
  démarrage.
- En `NODE_ENV=production`, **R2 est obligatoire** : sans configuration R2 complète et valide, l'API refuse de
  démarrer (`config.validation.ts`).
- En développement, sans aucune variable `R2_*`, le stockage local reste utilisé et `/uploads` est servi par l'API ;
  avec R2, `/uploads` n'est pas servi.
- Les secrets R2 sont posés sur Fly **avant** le déploiement qui les exige.

## Conséquences

✅ Positives :

- Un oubli de configuration en production se voit immédiatement (le déploiement échoue au démarrage) au lieu de
  provoquer une perte de photos silencieuse.
- Le comportement de production est unique et prévisible ; le développement local reste sans dépendance externe.

❌ Négatives / dette acceptée :

- Le démarrage de production dépend de la présence des secrets R2 : un déploiement avant `fly secrets set` échoue (le
  retour arrière est l'image précédente).
- Aucun mode dégradé : si la configuration R2 est invalide, l'API ne démarre pas du tout, y compris pour les
  fonctions sans photo.
- Restent hors périmètre : retrait des métadonnées EXIF/GPS, domaine personnalisé du bucket (URL `r2.dev` en
  préprod), reprise automatique d'une purge interrompue, nettoyage des anciennes URL `fly.dev/uploads` en base.

## Alternatives écartées

- **Repli silencieux sur le disque** quand R2 n'est pas configuré : simple, mais reproduit exactement la perte de
  données que FEAT-01 corrige, sans alerte.
- **Volume Fly persistant** pour `uploads/` : lie les photos à une machine et à une région, sans CDN, et complique le
  passage à plusieurs machines.
- **Choix piloté par `NODE_ENV` seul** (plan initial, doc 04 R2-003) : ne détecte ni les secrets manquants ni une
  configuration partielle.
