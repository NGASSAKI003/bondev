# Bondev

**Ensemble, on va plus loin.** Plateforme d'entraide pour les développeurs africains : on cherche ce qui existe déjà, on se fait aider quand on bloque, on aide les autres et on gagne des points (1 point = 30 minutes d'aide).

Ce dépôt contient la **maquette interactive** (mobile, tablette, ordinateur). Les données affichées sont fictives. Réalisé pour le Systalink Challenge, équipe WAT.

## Ce qu'il faut installer (une seule fois)
1. **Node.js version 20 ou plus** : https://nodejs.org (prendre la version « LTS »)
2. **Git** : https://git-scm.com
3. Un éditeur : **VS Code** (https://code.visualstudio.com)

Pour vérifier, ouvre un terminal et tape `node -v` puis `git --version` : un numéro de version doit s'afficher.

## Lancer le projet sur ton ordinateur
```bash
git clone https://github.com/NGASSAKI003/bondev.git
cd bondev
npm install
npm run dev
```
Ouvre ensuite l'adresse affichée (en général http://localhost:5173). Pour arrêter : `Ctrl + C`.

## Les commandes utiles
| Commande | Ce qu'elle fait |
|---|---|
| `npm install` | Télécharge les outils nécessaires (à faire une fois, ou après une mise à jour) |
| `npm run dev` | Lance le site en mode développement, il se met à jour tout seul |
| `npm run build` | Prépare la version finale dans le dossier `dist` |
| `npm run preview` | Teste la version finale en local |

## Où se trouve quoi
```
bondev/
├── index.html        Page de départ
├── public/           Logo, icônes et manifest de l'application installable (PWA)
├── src/
│   ├── main.tsx      Démarre l'application
│   ├── App.tsx       Tous les écrans (connexion, accueil, résultats, entraide, profil…)
│   └── index.css     Tout le style (thème sombre/clair, mobile, tablette, ordinateur)
├── package.json      Liste des outils et des commandes
└── vite.config.ts    Configuration du build
```
Stack : React, TypeScript, Vite, Tailwind CSS. Le texte et les exemples (projets, questions) se trouvent en haut de `src/App.tsx`.

## Mettre en ligne
Réglages à saisir sur **Cloudflare Pages** ou sur **Systalink (site statique)**, après avoir connecté le dépôt GitHub :
- Branche : `main`
- Commande de build : `npm run build`
- Dossier de publication : `dist`

## Travailler à plusieurs
1. Avant de commencer : `git pull`
2. Crée ta branche : `git checkout -b ma-modification`
3. Modifie, puis : `git add .` et `git commit -m "Ce que j'ai changé"`
4. Envoie : `git push origin ma-modification`, puis ouvre une « Pull Request » sur GitHub.

## Si ça ne marche pas
- `node` ou `npm` introuvable : réinstalle Node.js, puis ferme et rouvre le terminal.
- Erreur après `npm install` : supprime le dossier `node_modules` et recommence.
- Page blanche : regarde le terminal, l'erreur y est écrite.

## Prochaines étapes
Connexion GitHub, vraie base de données, recherche dans le catalogue, points et historique, déploiement du produit complet.
