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
- **Recherche** : `src/lib/search.ts` est un module pur, testable et sans service externe. Il ignore les accents, la casse et la ponctuation, puis s'appuie sur un dictionnaire de synonymes français/anglais : Mobile Money, hors-ligne, faible connexion, USSD, SMS, messagerie, stock, comptabilité, paiement, PWA, API, éducation, agriculture, devises, santé, microfinance, collecte de données, cartographie, humanitaire, état civil, langues africaines, IA, PME et mobile. Les tags pèsent plus que les technologies, puis le titre et la description. Les concepts de domaine (santé, éducation…) passent avant les simples contraintes techniques (hors-ligne, API…). Chaque résultat explique « Pourquoi ce projet » sans citer une technologie que la requête ne nomme pas, et l'écran affiche « Bondev a compris : … ». Pour ajouter un mot-clé, complète simplement `SEARCH_CONCEPTS`.
- **Résultats vides** : une carte « Rien ne convient ? » propose le bouton « Demander de l’aide ».
- **Fiche projet** : titre, description, technologies, licence, dernière activité relative, étoiles GitHub séparées de l’usage Bondev, nombre de développeurs servis, auteur et lien vers le dépôt GitHub. Le lien ne s’ouvre dans un nouvel onglet que s’il commence par `https://`, avec `rel="noopener noreferrer"`.
- **Ça m’a servi** : appelle la RPC `mark_project_used`. Le bouton est désactivé avec une explication si l'utilisateur n'est pas connecté ou s'il s'agit de son propre projet. Après succès, le compteur se met à jour sans rechargement et une célébration s'affiche.
- **Partager un projet** : le lien GitHub est vérifié, puis les informations publiques sont récupérées via `https://api.github.com/repos/{owner}/{repo}` sans clé. La limite de débit et les erreurs GitHub sont expliquées en français. Les champs restent modifiables. La publication passe uniquement par la RPC `publish_project` (jamais d'insertion directe dans `projects` ou `points_ledger`). Les 5 premières publications rapportent +3 points, puis le solde est rafraîchi avec `getMyStats`.
- **Hors-ligne** : la dernière liste est conservée dans `localStorage` (clé `bondev-projects-cache-v1`). Quand le réseau est coupé, l'application affiche cette liste avec la mention « Dernière mise à jour : … ».
- **Raccourci** : `Ctrl + K` (ou `⌘ + K`) ouvre la recherche et place le curseur dans le champ.

La recherche reste volontairement lexicale : aucun modèle d'IA externe n'est appelé. Une vraie IA pourra être branchée plus tard derrière `searchProjects`, avec le même type de résultat et sans changer les écrans.

Les tests de la recherche se lancent avec :

```bash
npm test
```

Ils couvrent notamment « paiement mobile money », « sans connexion », « stock boutique », une requête sans résultat, les accents et les scénarios du catalogue de départ (« application de santé hors-ligne », « sms ussd », « apprendre sans internet »).

## Catalogue de départ

Le fichier `scripts/catalogue/repos.json` contient la liste de départ des dépôts GitHub (URL, titre, résumé français et étiquettes). Le script `scripts/catalogue/build-catalogue.mjs` vérifie chaque dépôt avec l'API GitHub, puis génère `supabase/catalogue_depart.sql`.

```bash
npm run catalogue:build
```

Le script utilise `GITHUB_TOKEN` s'il est défini. Sans jeton, GitHub limite à 60 requêtes par heure ; avec un jeton, la limite passe à 5000. Pour définir le jeton dans le terminal :

```bash
# macOS / Linux
GITHUB_TOKEN=ghp_xxx npm run catalogue:build

# PowerShell
$env:GITHUB_TOKEN = "ghp_xxx"
npm run catalogue:build
```

Ne mets jamais le jeton dans un fichier du projet.

Pendant la génération :

- le script attend 250 ms entre deux appels à GitHub ;
- les dépôts introuvables (404), archivés ou redirigés hors de `github.com` sont ignorés et listés avec la raison dans le résumé et dans l'en-tête du fichier SQL ;
- `repo_url` est l'adresse `html_url` renvoyée par GitHub, sans slash final ;
- le titre et le résumé viennent de `repos.json` (jamais de la description anglaise de GitHub) ;
- la licence est le code SPDX de GitHub, ou `Autre` si elle est absente ou `NOASSERTION` ;
- les technologies se limitent au langage principal renvoyé par GitHub, et les étiquettes viennent de `repos.json` (15 maximum chacune) ;

Le fichier `supabase/catalogue_depart.sql` est idempotent : il peut être rejoué sans créer de doublon. Il crée un compte technique non connectable « Équipe Bondev », puis insère les projets avec `ON CONFLICT (lower(repo_url)) WHERE repo_url <> '' DO NOTHING`. Le trigger `trg_signup_bonus` est désactivé uniquement le temps d'insérer le profil technique : **aucune ligne n'est ajoutée à `points_ledger`**.

Exécute ce fichier dans l'éditeur SQL de Supabase (rôle `postgres`), **après** les migrations `0001_init.sql` à `0004_stars.sql`. Ne l'exécute pas avec la clé `anon`. Les migrations existantes ne sont pas modifiées. Pour mettre à jour le catalogue, modifie `repos.json` puis relance `npm run catalogue:build` : ne modifie pas `catalogue_depart.sql` à la main.

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

## Progression

La progression est calculée **entièrement dans le navigateur**, en lecture seule, à partir des tables et vues déjà présentes (`profile_stats`, `answers`, `questions`, `projects`, `project_uses` et `points_ledger`). Aucune migration SQL n'est ajoutée et le navigateur n'écrit jamais dans `points_ledger`.

- **Niveaux** : `src/lib/progress.ts` reprend exactement les seuils de la fonction SQL `level_for` — Étincelle 0, Explorateur 10, Bâtisseur 30, Mentor 70, Maître 150, Légende 300. Le profil affiche le niveau courant, la barre de progression et « Encore N points… ».
- **Semaines et série** : les semaines vont du lundi 00:00 au lundi 00:00 en UTC, comme `date_trunc('week', now())`. Une semaine est active avec une réponse publiée, une réponse validée par l'auteur de la question, un projet publié ou un « Ça m'a servi » donné. Une simple connexion ne compte pas. Un joker pardonne une semaine manquée si elle est encadrée par deux semaines actives et qu'aucun autre joker n'est utilisé à moins de quatre semaines ; la règle est déterministe et commentée dans `computeStreak`.
- **Badges** : Entraide (1 / 5 / 25 réponses validées), Partage (1 / 3 / 5 projets), Utilité (1 / 10 / 50 « Ça m'a servi » reçus) et Série (4 / 12 / 52 semaines). Les spécialités gardent les trois technologies les plus pratiquées, avec 3 / 10 / 25 réponses validées par technologie et le titre « Expert &lt;techno&gt; ». Les badges Communauté sont « Première réponse », « Nouvelle voix » et « Bienveillant » (3 réponses à des questions débutant).
- **Quête hebdomadaire** : trois missions — répondre à une question `beginner_ok`, publier un projet, donner un « Ça m'a servi ». Le défi collectif suit les questions résolues par toute la communauté dans la semaine, avec un objectif de 10 ; le badge « Défi de la semaine » est virtuel et réservé aux personnes actives cette semaine.
- **Célébrations** : niveau, badge, quête et défi déclenchent une notification fluide. L'état « déjà vu » est enregistré par utilisateur dans `localStorage` ; le premier chargement enregistre la situation sans célébrer.
- **Page d'aide** : « Comment ça marche » (Profil et menu) explique en français ou en anglais les 5 règles, les gains et dépenses, les paliers 1 / 3 / 6, les niveaux, la série, la quête et le défi. Un tutoriel de 3 écrans s'affiche à la première connexion, avec un bouton « Passer ».
- **Économie de données** : l'interrupteur du Profil est activé par défaut si `navigator.connection.saveData` est vrai. Il coupe animations et flou, allège les ombres et reste mémorisé dans `localStorage`. `prefers-reduced-motion` est également respecté.
- **Cache** : `getProgress()` fait quelques requêtes parallèles plafonnées, garde la valeur 60 secondes en mémoire et conserve la dernière valeur dans `localStorage`. Hors-ligne, le profil et l'accueil affichent « Dernière mise à jour : … ». Le cache est invalidé après une réponse, une validation, une publication, un retrait ou un « Ça m'a servi ».

Les règles de progression sont testées dans `src/lib/progress.test.ts` (seuils de niveaux, semaines UTC, série avec et sans joker, paliers et progression des badges, missions, défi atteint ou non).

## Les commandes utiles
| Commande | Ce qu'elle fait |
|---|---|
| `npm install` | Télécharge les outils nécessaires (à faire une fois, ou après une mise à jour) |
| `npm run dev` | Lance le site en mode développement, il se met à jour tout seul |
| `npm test` | Lance les tests Vitest (recherche, Entraide et progression) |
| `npm run catalogue:build` | Régénère `supabase/catalogue_depart.sql` depuis `scripts/catalogue/repos.json` |
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
│   ├── lib/          Accès Supabase, recherche, Entraide, progression, GitHub et formatage des dates
│   └── index.css     Tout le style (thème sombre/clair, mobile, tablette, ordinateur)
├── scripts/
│   └── catalogue/    Liste des dépôts et générateur du catalogue de départ
├── supabase/         Migrations SQL, seed et catalogue de départ généré
├── package.json      Liste des outils et des commandes
└── vite.config.ts    Configuration du build
```
Stack : React, TypeScript, Vite, Tailwind CSS et Vitest. Le catalogue et la recherche vivent dans `src/lib/api.ts` et `src/lib/search.ts`, l'Entraide dans `src/lib/api.ts` et `src/lib/help.ts`, la progression dans `src/lib/progress.ts`.

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
