# Return — Brand assets

Logos sources (SVG vectoriels) de l'application **Return**. À utiliser dans l'app
(écrans, en-têtes) et comme source pour générer les icônes PNG.

## Fichiers

| Fichier | Variante | Couleur | Fond | Usage conseillé |
|---|---|---|---|---|
| `return-symbol.svg` | Symbole seul (la marque ↺/R) | Anthracite + flèche rouge | Transparent | Favicon, avatar, petit format, source de l'icône d'app |
| `return-logo-horizontal.svg` | Logo principal (symbole + « Return ») | Couleur (sauge + anthracite) | Beige sable | En-tête, écran de login, marketing |
| `return-logo-horizontal-dark.svg` | Logo horizontal sombre/mono | Anthracite + accent | Transparent | Sur fond clair quand on veut un logo monochrome |
| `return-app-icon.svg` | Icône d'app (tuile arrondie) | Sauge sur tuile beige | Beige sable | Source de `icon.png` / `splash-icon.png` |

## Palette de marque

| Rôle | Couleur | Hex |
|---|---|---|
| Principale | Vert sauge | `#6B8E7B` |
| Accent | Terracotta | `#D97A6B` |
| Foncée | Sauge foncé | `#4A6355` |
| Fond | Beige sable | `#F7F4EF` |
| Texte | Gris anthracite | `#2D3748` |

## Générer les assets de l'app (Expo)

Les SVG doivent être exportés en **PNG** pour Expo. Fichiers cibles dans `frontend/assets/` :

| Cible | Source conseillée | Spéc |
|---|---|---|
| `icon.png` | `return-app-icon.svg` | 1024×1024, carré plein (pas de transparence iOS) |
| `adaptive-icon.png` | `return-symbol.svg` | 1024×1024, symbole centré dans la zone sûre ~66 %, fond transparent |
| `favicon.png` | `return-symbol.svg` | petit (ex. 48×48) |
| `splash-icon.png` | `return-logo-horizontal.svg` ou `return-app-icon.svg` | centré sur fond `#F7F4EF` |

> Penser à passer `splash.backgroundColor` de `#ffffff` → `#F7F4EF` dans `app.json`
> pour la cohérence de marque.

## À compléter plus tard (manquant)

- Version **blanche** (1 couleur) du symbole/logo, pour fonds foncés ou photo.
- Version **symbole seul en sauge** sur fond transparent (actuellement seul l'anthracite existe en transparent).
- Wordmark seul (« Return » sans le symbole), si besoin.

---

*Sources IA originales (téléchargées le 25/06/2026) renommées proprement ; un doublon a été écarté.*
