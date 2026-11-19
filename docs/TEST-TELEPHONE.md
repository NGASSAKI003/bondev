# Tester Bondev sur un téléphone réel

Ce document décrit la passe de fiabilité Android : laboratoire de rendu,
mode sûr par défaut, en-tête sans conteneur, fond homogène et tuiles
d'icônes. Il sert à reproduire les vérifications sur un Xiaomi, un Samsung
ou tout autre Android, puis à comparer avec les mesures de `README.md`.

Aucune dépendance, aucun SQL et aucun changement de contenu métier n'ont
été ajoutés pour cette passe.

## 1. Ouvrir la page Diagnostic

La page n'est pas liée dans la navigation. Sur le téléphone, remplace le
hash de l'URL par `#/diagnostic` :

- preview local : `http://localhost:4173/#/diagnostic` ;
- version déployée : `https://<domaine>/#/diagnostic`.

Elle affiche les dimensions, `visualViewport`, les safe areas, le matériel,
le mode d'effets effectif et un test de frames de 3 s. Le bouton
**Copier le rapport** produit un texte français qui contient aussi l'état
des dix interrupteurs du laboratoire.

## 2. Les dix interrupteurs du laboratoire

Le laboratoire coupe une famille CSS à la fois. Son état est mémorisé dans
`localStorage` sous `bondev-render-lab` et appliqué sur `<html>` par des
attributs `data-lab-*`. Il fonctionne en mode sûr comme en mode complet.

| Interrupteur | Attribut | Ce qui est coupé | Ce qu'il faut regarder |
|---|---|---|---|
| Bordures en dégradé | `data-lab-gradient-borders` | `mask`, `mask-composite`, `border-image`, pseudo-éléments de contour | Les cartes gardent une bordure 1 px nette, sans liseré qui bave. |
| Ombres et lueurs | `data-lab-shadows` | `box-shadow`, `text-shadow`, `drop-shadow` | Plus aucune ombre ni lueur ; le texte reste lisible. |
| Reflets intérieurs | `data-lab-inner-shine` | `::before`/`::after` de brillance | Les surfaces sont unies, sans reflet diagonal. |
| Fond fixe et halos | `data-lab-background-layer` | couche `fixed`, halos, dégradés animés | Le fond devient absolu, 420 px, avec un seul halo statique. |
| Grain | `data-lab-grain` | texture de bruit et `mix-blend-mode` | Plus de grain, plus de trame sur les aplats. |
| Flous | `data-lab-blurs` | `backdrop-filter`, `filter` | Plus de verre flouté ni de halo flou. |
| Animations et transitions | `data-lab-motion` | `animation`, `transition`, `scroll-behavior` | Les changements sont instantanés, sans mouvement. |
| Dégradés SVG des icônes | `data-lab-icon-gradients` | `fill`/`stroke` en `url(#brand-gradient)` | Les icônes restent visibles en bleu plein, jamais transparentes. |
| content-visibility et contain | `data-lab-containment` | `content-visibility`, `contain` | Les cartes hors écran sont mises en page normalement. |
| View Transitions | `data-lab-view-transitions` | `document.startViewTransition` | La navigation utilise le repli sans transition d'écran. |

### Procédure

1. Ouvrir `#/diagnostic`, puis **Tout réactiver** pour partir d'une base
   connue.
2. Relever la référence : une carte `.glass`, un bouton `.secondary`, une
   tuile d'icône, le fond `.bd-backdrop`.
3. Couper un interrupteur, attendre une frame, puis observer l'écran.
4. Remettre l'interrupteur, puis passer au suivant.
5. Recharger la page : les dix états doivent être conservés.
6. Copier le rapport et vérifier que les dix lignes sont présentes, avec
   « activé » ou « désactivé ».

Le laboratoire doit rester efficace même en mode sûr : ses sélecteurs
portent `html[data-theme][data-effects]` pour passer après les règles
`!important` du mode sûr.

## 3. Mode sûr et mode Complets

### Décision automatique

En `Auto`, le mode sûr (`light`) est choisi avant les signaux de
performance si :

- `matchMedia('(pointer: coarse)').matches` est vrai ; ou
- la largeur de la fenêtre est inférieure ou égale à 820 px.

Sinon, les signaux habituels s'appliquent : Économie de données, mémoire
≤ 4 Go, cœurs ≤ 4, ou médiane de frame > 24 ms. `Complets` force le mode
complet, `Légers` force le mode sûr. Le choix est mémorisé sous
`bondev-effects` et appliqué avant React dans `src/main.tsx`.

### Ce que le mode sûr garantit

- `html` et `body` : `#050816` en sombre, `#f7f9ff` en clair.
- `.bd-backdrop` : `position: absolute`, hauteur 420 px, un seul
  `radial-gradient` statique, non fixe, identique sur tous les écrans.
- Aucun `mask`, `mask-composite`, `border-image`, `backdrop-filter`,
  `filter`, `mix-blend-mode`, reflet intérieur ni grain.
- Ombres simples, sans lueur, ≤ 12 px.
- Aucune couche fixe animée, aucun `content-visibility`.
- Aucune View Transition.
- Nav et safe area de la même couleur pleine que le fond.
- Le bouton « + » de navigation est un cercle de 22 px, aligné sur les autres icônes, avec un anneau de 1,5 px et un symbole de 14 px, sans masque.

### Vérifier dans la console

```js
const root = document.documentElement
const glass = document.querySelector('.glass')
const backdrop = document.querySelector('.bd-backdrop')
const art = document.querySelector('.empty .state-art')

root.dataset.effects                    // "light"
matchMedia('(pointer: coarse)').matches // true sur un téléphone
getComputedStyle(glass).backdropFilter  // "none"
getComputedStyle(glass, '::before').display // "none"
getComputedStyle(glass).boxShadow       // ombre simple, pas de lueur
getComputedStyle(backdrop).position     // "absolute"
getComputedStyle(backdrop).height       // "420px"
getComputedStyle(backdrop).backgroundImage // un seul radial-gradient
getComputedStyle(backdrop, '::after').display // "none"
getComputedStyle(art).backgroundColor   // "rgba(0, 0, 0, 0)"
getComputedStyle(art).borderRadius      // "0px"
```

Pour vérifier `Complets`, aller dans **Profil > Effets visuels >
Complets** : `root.dataset.effects` doit valoir `full`, le verre doit
retrouver `backdrop-filter: blur(18px)` et `.bd-backdrop` doit repasser en
`fixed`. Le retour à **Légers** doit rendre le fond absolu et les surfaces
unies.

## 4. En-tête

### Au repos

- Le logo, les points et le bouton de thème n'ont **aucun fond, aucune
  bordure, aucune ombre et aucun angle droit** derrière eux.
- L'en-tête est transparent, `position: sticky`, hauteur 56 px,
  `padding-top: calc(env(safe-area-inset-top) + 8px)`.
- Les points affichent une pièce et « N pts », toujours visibles.
- Le bouton de thème est une icône seule de 44 × 44 px, sans cadre.
- Le titre tient sur une ligne, avec ellipse si nécessaire.
- L'écran Règles affiche bien « Règles », pas « Comment ça marche ».

### Au défilement

- Avant 8 px de défilement : rien ne change.
- Après 8 px : une barre pleine largeur, de la couleur du fond, avec un
  filet de 1 px en bas.
- En sombre : fond `rgb(5, 8, 22)`, filet `rgba(255, 255, 255, 0.1)`.
- En clair : fond `rgb(247, 249, 255)`.
- La barre ne doit jamais apparaître sur le focus d'un champ ni quand le
  clavier virtuel est ouvert.

### Vérifier dans la console

```js
const header = document.querySelector('.topbar')
const before = getComputedStyle(header, '::before')
const rect = header.getBoundingClientRect()

rect.top      // 0
rect.height   // 56
getComputedStyle(header).paddingTop // "8px" (hors safe area)
before.backgroundColor // transparent au repos
document.documentElement.dataset.scrolled // "true" après 8 px
before.width  // largeur de la fenêtre, pas 350 px
document.documentElement.dataset.keyboard // "open" avec le clavier
before.backgroundColor // transparent quand keyboard=open
```

## 5. Tuiles d'icônes

Une tuile ne doit jamais avoir un remplissage partiel : le dégradé couvre
toute la surface, avec `background-size: 100% 100%`.

À contrôler :

- l'accueil et les cartes projet (`.project-icon`) ;
- l'Entraide (`.help-icon`) ;
- la progression et la flamme (`.week-flame`, `.streak-flame`) ;
- les étapes du tutoriel (`.tutorial-icon`) ;
- la navigation et le bouton « + » ;
- les états vides (`.state-art`), hors-ligne et erreur.

```js
const tile = document.querySelector('.project-icon')
getComputedStyle(tile).backgroundImage // un seul linear-gradient
getComputedStyle(tile).backgroundSize  // "100% 100%"
```

L'illustration d'état vide doit rester transparente, sans carré bleu :

```js
const art = document.querySelector('.empty .state-art')
getComputedStyle(art).backgroundColor // "rgba(0, 0, 0, 0)"
getComputedStyle(art).borderRadius    // "0px"
```

## 6. Fond, nav et safe area

- `index.html` doit contenir `viewport-fit=cover`.
- `meta[name="theme-color"]` doit valoir `#050816` en sombre et
  `#f7f9ff` en clair.
- `html`, `body`, `.shell` et `.nav` doivent être de la même couleur
  pleine que le fond.
- Le fond ne doit pas changer de teinte entre l'accueil, Entraide, Règles,
  Profil et Diagnostic.
- En haut et en bas, avec la barre d'adresse rétractée puis déployée, aucun
  liseré ne doit apparaître.

```js
getComputedStyle(document.documentElement).backgroundColor // rgb(5, 8, 22)
getComputedStyle(document.body).backgroundColor            // rgb(5, 8, 22)
getComputedStyle(document.querySelector('.nav')).backgroundColor
document.querySelector('meta[name="theme-color"]').content
```

## 7. Causes et hypothèses des défauts corrigés

| Défaut observé | Cause probable | Correction |
|---|---|---|
| Liserés, rectangles noirs ou bavures autour des cartes sur Xiaomi/Mali | Combinaison de `mask`/`mask-composite` pour les bordures dégradées, `backdrop-filter`, grain en `mix-blend-mode` et `filter` imbriqués ; certains pilotes Mali composent mal ces couches. | Mode sûr par défaut sur pointeur grossier ou ≤ 820 px : surfaces unies, bordure 1 px, aucun masque, flou, filtre ni grain. Le laboratoire permet de confirmer la famille fautive sur l'appareil. |
| En-tête qui ressemble à une pastille flottante | Ancienne marge de 20 px, fond, flou, bordure et rayon derrière le logo, les points et le thème ; une règle clavier peignait aussi un fond. | En-tête `sticky` transparent au repos ; barre pleine largeur peinte par `.topbar::before` seulement après 8 px de défilement, jamais au focus ni au clavier. |
| Teinte qui change d'un écran à l'autre | Dégradé `.shell` proportionnel à la hauteur de la page, plus `.bd-backdrop` fixe avec plusieurs halos. La couleur à une même hauteur dépendait donc de la longueur du contenu. | `html`/`body` solides, un seul radial statique de 420 px, nav et safe area pleines. |
| Liseré en bas à droite | `.nav { width: min(100%, 390px) }` sur un écran plus large que 390 px laissait une bande de fond à droite. | Nav en pleine largeur. |
| Tuile d'icône remplie à moitié | Dégradé radial dimensionné sur un coin, ou fond porté par un `div` interne plus petit que la tuile. | Un seul `linear-gradient` couvrant 100 % × 100 %, y compris sur le « + » de navigation. |
| Carré bleu dans l'état vide | `.empty > div` héritait du fond de tuile alors que l'illustration `StateArt` a déjà son propre halo. | Sélecteur limité aux tuiles ; `.state-art` transparent, 128 × 96, sans rayon. |
| Halo de focus autour des titres | Le focus programmatique du premier `h1`/`h2` après navigation peignait `outline` et `box-shadow`. | `#contenu :is(h1,h2)[tabindex="-1"]:focus` et `:focus-visible` sans contour ni ombre. |
| Saut de mise en page au chargement (CLS 0,16) | La bannière invité était initialisée à « non fermée », peinte une frame, puis retirée par l'effet qui lisait `localStorage`. | Lecture de `localStorage` dans l'initialisation de l'état ; le saut de la bannière disparaît et le CLS Lighthouse connecté est à 0. |
| Symbole « + » invisible dans la navigation | Le cercle avait été réduit à 22 px et son anneau dessiné par un masque ; en mode sûr, le masque est retiré et le trait de 13 px se perd dans le fond. | Le bouton garde un cercle de 22 px, aligné sur les autres icônes, avec un anneau de 1,5 px en deux couches de fond (sans masque) et un symbole de 14 px. |
| Bouton « + » qui se décale quand la nav s'élargit | `margin:0 auto` sur le cercle dans un bouton passé en `flex-direction:row` : l'auto-marge absorbait l'espace libre et centrait le cercle, alors que les autres icônes restent alignées à gauche. | `margin:0` : le cercle de 22 px garde le même axe que les autres icônes dans les états fermé, survolé et épinglé ; sur mobile, la grille le centre dans sa colonne. |

## 8. Lighthouse mobile

Protocole : Chrome 157.0.8103.78, Lighthouse 13.6.0, viewport mobile,
3 passages, médiane. Pour l'écran connecté, un profil invité existant est
réutilisé avec `--disable-storage-reset` et Lighthouse est connecté au
Chrome déjà ouvert (`--port`), sinon Lighthouse repart sur l'écran de
connexion.

```powershell
# Page publique (écran de connexion)
npx lighthouse http://localhost:4173/ --output=json `
  --output-path=lighthouse-public.json `
  --chrome-path="C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --chrome-flags="--headless=new --no-first-run --no-default-browser-check" `
  --only-categories=performance,accessibility,best-practices,seo --quiet

# Accueil connecté : lancer Chrome avec --remote-debugging-port=9342,
# ouvrir la session invitée, puis :
npx lighthouse http://localhost:4173/#/ --port=9342 --disable-storage-reset `
  --output=json --output-path=lighthouse-connected.json `
  --only-categories=performance,accessibility,best-practices,seo --quiet
```

### Résultats après cette passe

**Écran de connexion** (3 passages : 96, 96, 95) :

| Audit | Avant | Après |
|---|---:|---:|
| Performance | 94 | 96 |
| Accessibilité | 98 | 98 |
| Best practices | 100 | 100 |
| SEO | 92 | 92 |
| FCP | 2,1 s | 0,9 s |
| LCP | 2,8 s | 2,7 s |
| TBT | 80 ms | 40 ms |
| CLS | 0 | 0 |
| Speed Index | — | 1,4 s |

**Accueil connecté, invité** (3 passages : 100, 98, 100) :

| Audit | Avant | Après |
|---|---:|---:|
| Performance | 95 (84–96) | 100 (98–100) |
| Accessibilité | 94 | 94 |
| Best practices | 100 | 100 |
| SEO | 92 | 92 |
| FCP | 0,79 s | 0,8 s |
| LCP | 1,06 s | 0,9 s |
| TBT | 256 ms | 80 ms |
| CLS | 0 | 0 |
| Speed Index | 1,59 s | 1,2 s |

Les chiffres « avant » sont ceux du commit précédent (`ca7c782`), déjà
documentés dans `README.md` ; ils n'ont pas été re-mesurés sur la même
machine au même instant. Les chiffres « après » sont ceux de la version
courante. La comparaison reste indicative : le cache, la charge de la
machine et la session Supabase font varier Lighthouse. Dans un relevé
intermédiaire de cette passe, le CLS connecté mesurait 0,16 avant la
correction de la bannière invité ; il est à 0 après.

## 9. Captures

Les huit captures de cette passe sont dans `docs/screens/` (non
versionnées, viewport 390 × 844, DPR 2) :

- `accueil-avant-apres.jpg` : salutation, placeholder et ligne « Récent » ;
- `recherche-avant-apres.jpg` : suggestions en grille de 2 colonnes ;
- `projet-avant-apres.jpg` : fiche projet, actions pleine largeur et licence ;
- `profil-avant-apres.jpg` : nom affiché et contrôles segmentés ;
- `profil-bas-avant-apres.jpg` : effets, langue et déconnexion ;
- `recherche-menu.jpg` : menu « ⋯ » de la ligne « Récent » ;
- `accueil-clair.jpg` : accueil en thème clair ;
- `remonter.jpg` : bouton « Remonter » à 40 px.

Les cinq composites placent la version `ca7c782` à gauche et la version
courante à droite.

## 10. Points non vérifiés

- Xiaomi, Samsung Internet et navigateur Xiaomi sur appareil physique.
- GPU Mali/Adreno réels : les artefacts sont reproduits par le laboratoire
  et par les mesures CSS, pas par un rendu GPU physique dans cette passe.
- iOS Safari et le clavier virtuel réel.
- Lecteurs d'écran et zoom texte natif à 200 %.
- Le comportement exact de la barre d'adresse et des gestes système varie
  selon le constructeur.
- Le mode `Complets` sur un appareil modeste : il reste activable dans
  Profil, mais n'est pas le mode par défaut.
- CLS résiduel : un rechargement CDP à 500 px mesure 0,047 quand les
  données de progression déplacent `.impact-strip` ; Lighthouse connecté
  mesure 0. À confirmer sur un téléphone réel avec le réseau mobile.
