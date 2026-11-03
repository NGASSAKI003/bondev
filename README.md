# Bondev

**Ensemble, on va plus loin.** Plateforme d'entraide pour les développeurs africains : on cherche ce qui existe déjà, on se fait aider quand on bloque, on aide les autres et on gagne des points (1 point = 30 minutes d'aide).

Ce dépôt contient la **maquette interactive** (mobile, tablette, ordinateur). La connexion, le profil utilisateur, le catalogue de projets, la recherche et l'Entraide sont réels (Supabase). Réalisé pour le Systalink Challenge, équipe WAT.

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

## Configurer Supabase

La connexion et le profil utilisent Supabase. Sans configuration, l'application affiche un écran « Configuration requise » au lieu de planter.

1. Crée un fichier `.env.local` à la racine du projet en copiant `.env.example` :
   ```bash
   cp .env.example .env.local
   ```
   Sur Windows, tu peux aussi créer le fichier à la main et coller les deux lignes ci-dessous.
2. Ouvre ton projet sur [supabase.com](https://supabase.com), puis va dans **Project Settings > API**.
3. Copie l'**URL du projet** dans `VITE_SUPABASE_URL`.
4. Copie la clé **publishable** (appelée « anon public » dans les anciennes interfaces) dans `VITE_SUPABASE_ANON_KEY`.
5. Redémarre `npm run dev` après avoir modifié `.env.local`.

```env
VITE_SUPABASE_URL=https://ton-projet.supabase.co
VITE_SUPABASE_ANON_KEY=ta-cle-anon-publique
```

> [!IMPORTANT]
> N'utilise **jamais** la clé `service_role` (ou « secret key ») dans le code du navigateur. Elle donne tous les droits et doit rester secrète. La clé `anon public` est faite pour le navigateur : c'est la RLS de la base qui protège les données.

Pour la connexion GitHub, active le fournisseur GitHub dans **Authentication > Providers** et ajoute l'adresse de ton site dans **Authentication > URL Configuration**. En local, ajoute `http://localhost:5173` et `http://127.0.0.1:5173` (l'adresse affichée par Vite peut être l'une ou l'autre). Le bouton Google n'apparaît que si tu ajoutes `VITE_ENABLE_GOOGLE=true` dans `.env.local` et que Google est activé dans Supabase.

Le fichier `.env.local` est ignoré par Git. Ne mets jamais de clé secrète dans `.env.example`, dans le README ou dans un fichier `src/`.

Pour créer les tables et les fonctions, exécute les migrations de `supabase/migrations/` comme expliqué dans [`docs/DATABASE.md`](docs/DATABASE.md).

## Recherche et catalogue

Le catalogue, la recherche et le partage de projets sont branchés sur les vraies tables Supabase.

- **Catalogue** : `listProjects()` lit `public.projects` avec l'auteur (`profiles`), trie du plus récent au plus ancien et charge au maximum 200 projets. Les titres qui commencent par `[Exemple]` affichent une pastille « Exemple » à la place du préfixe.
- **Recherche** : `src/lib/search.ts` est un module pur, testable et sans service externe. Il ignore les accents, la casse et la ponctuation, puis s'appuie sur un dictionnaire de synonymes français/anglais : Mobile Money, hors-ligne, USSD, SMS, stock, comptabilité, paiement, PWA, API, éducation, agriculture et devises. Les tags pèsent plus que les technologies, puis le titre et la description. Chaque résultat explique « Pourquoi ce projet » et l'écran affiche « Bondev a compris : … ». Pour ajouter un mot-clé, complète simplement `SEARCH_CONCEPTS`.
- **Résultats vides** : une carte « Rien ne convient ? » propose le bouton « Demander de l’aide ».
- **Fiche projet** : titre, description, technologies, licence, dernière activité relative, étoiles, nombre de développeurs servis, auteur et lien vers le dépôt GitHub. Le lien ne s'ouvre dans un nouvel onglet que s'il commence par `https://`, avec `rel="noopener noreferrer"`.
- **Ça m’a servi** : appelle la RPC `mark_project_used`. Le bouton est désactivé avec une explication si l'utilisateur n'est pas connecté ou s'il s'agit de son propre projet. Après succès, le compteur se met à jour sans rechargement et une célébration s'affiche.
- **Partager un projet** : le lien GitHub est vérifié, puis les informations publiques sont récupérées via `https://api.github.com/repos/{owner}/{repo}` sans clé. La limite de débit et les erreurs GitHub sont expliquées en français. Les champs restent modifiables. La publication passe uniquement par la RPC `publish_project` (jamais d'insertion directe dans `projects` ou `points_ledger`). Les 5 premières publications rapportent +3 points, puis le solde est rafraîchi avec `getMyStats`.
- **Hors-ligne** : la dernière liste est conservée dans `localStorage` (clé `bondev-projects-cache-v1`). Quand le réseau est coupé, l'application affiche cette liste avec la mention « Dernière mise à jour : … ».
- **Raccourci** : `Ctrl + K` (ou `⌘ + K`) ouvre la recherche et place le curseur dans le champ.

La recherche reste volontairement lexicale : aucun modèle d'IA externe n'est appelé. Une vraie IA pourra être branchée plus tard derrière `searchProjects`, avec le même type de résultat et sans changer les écrans.

Les tests de la recherche se lancent avec :

```bash
npm test
```

Ils couvrent notamment « paiement mobile money », « sans connexion », « stock boutique », une requête sans résultat et les accents.

## Entraide

L'Entraide est branchée sur les tables `questions`, `answers`, `profiles` et la vue `profile_stats`. Aucun mouvement de points n'est écrit directement par le navigateur.

- **Liste** : `listQuestions(filtre)` lit les questions avec leur auteur, le nombre de réponses et les trie de la plus récente à la plus ancienne. Les onglets **Ouvertes / Résolues / Mes questions** filtrent le statut ou l'auteur. Les filtres **Débutant bienvenu** et **Technologie** s'ajoutent à l'onglet actif.
- **Cartes** : titre, technologies, palier, étiquette « Débutant bienvenu · +1 bonus mentor », question gratuite, nombre de réponses, expiration (« Expire dans 5 j ») et statut traduit (Ouverte, Résolue ✓, Expirée, Retirée).
- **Poser une question** : titre, description, technologie, lien GitHub facultatif (https uniquement), case débutant et paliers **Coup de pouce 1 point**, **Aide moyenne 3 points**, **Gros coup de main 6 points**. Le solde après publication est affiché sans rouge, même à 0. Si le solde est insuffisant, la question gratuite de la semaine est proposée pour le palier 1 ; sinon une carte « Gagne des points en 2 minutes » propose de répondre à une question débutant ou de partager un projet.
- **Publication** : uniquement via la RPC `post_question` (`p_title`, `p_body`, `p_technologies`, `p_tier`, `p_github_url`, `p_beginner_ok`). Après succès, le fil de la question s'ouvre et le solde est rafraîchi avec `getMyStats`.
- **Fil** : énoncé, statut, palier, auteur, lien GitHub sécurisé (`https`, `rel="noopener noreferrer"`), réponses avec auteur, niveau lu dans `profile_stats`, preuve et mise en avant de la réponse validée. La réponse validée passe en premier, puis les réponses sont classées de la plus ancienne à la plus récente.
- **Valider une réponse** : bouton « Utile ✓ » réservé à l'auteur d'une question ouverte, avec confirmation (« Cela donnera N point(s) à @pseudo »). La RPC `validate_answer` vérifie l'auteur, refuse une deuxième validation et refuse de valider sa propre réponse.
- **Répondre** : insertion directe dans `answers` avec uniquement `question_id`, `author_id` (utilisateur connecté), `body` et `proof_url`. Les colonnes `is_useful` et `visible` ne sont jamais envoyées. Une réponse reste modifiable et supprimable par son auteur tant qu'elle n'est pas validée.
- **Retirer sa question** : bouton réservé à l'auteur, avec confirmation et RPC `withdraw_question`. Les points du palier sont remboursés, sauf pour une question gratuite.
- **Brouillons** : le formulaire de question et les réponses sont conservés dans `localStorage` (`bondev-question-draft-v1:*`, `bondev-answer-draft-v1:*`), puis effacés après un envoi réussi.
- **Hors-ligne** : les boutons d'envoi sont désactivés avec une explication, mais les brouillons restent sur l'appareil.
- **Erreurs** : toutes les erreurs Supabase sont traduites en français simple dans `src/lib/api.ts` et `src/lib/help.ts` (« Solde insuffisant », « Une réponse a déjà été validée », « Seul l’auteur de la question peut valider », etc.).

Les fonctions pures de l'Entraide (expiration, libellés des paliers, statuts et traduction des erreurs) sont testées avec Vitest dans `src/lib/help.test.ts`. Aucun fichier SQL n'est modifié par cette fonctionnalité : les RPC et les droits nécessaires existent déjà dans `supabase/migrations/0001_init.sql` et `0002_securite.sql`.

## Les commandes utiles
| Commande | Ce qu'elle fait |
|---|---|
| `npm install` | Télécharge les outils nécessaires (à faire une fois, ou après une mise à jour) |
| `npm run dev` | Lance le site en mode développement, il se met à jour tout seul |
| `npm test` | Lance les tests Vitest (recherche et Entraide) |
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
│   ├── lib/          Accès Supabase, recherche, Entraide, GitHub et formatage des dates
│   └── index.css     Tout le style (thème sombre/clair, mobile, tablette, ordinateur)
├── package.json      Liste des outils et des commandes
└── vite.config.ts    Configuration du build
```
Stack : React, TypeScript, Vite, Tailwind CSS et Vitest. Le catalogue et la recherche vivent dans `src/lib/api.ts` et `src/lib/search.ts`, l'Entraide dans `src/lib/api.ts` et `src/lib/help.ts`.

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
- La connexion Supabase échoue : vérifie que le projet Supabase n'est pas en pause et que `VITE_SUPABASE_URL` correspond bien à l'URL du projet.

## Prochaines étapes
Vérifier le parcours complet avec deux comptes réels, puis déployer le produit. La recherche pourra ensuite évoluer vers une vraie IA sans changer les écrans.
