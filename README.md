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

Pour la connexion GitHub, active le fournisseur GitHub dans **Authentication > Providers** et ajoute l'adresse de ton site dans **Authentication > URL Configuration**. En local, ajoute `http://localhost:5173` et `http://127.0.0.1:5173` (l'adresse affichée par Vite peut être l'une ou l'autre). Les connexions Google et par email (lien magique) sont masquées par défaut : ajoute `VITE_ENABLE_GOOGLE=true` ou `VITE_ENABLE_EMAIL=true` dans `.env.local`, puis active le fournisseur correspondant dans Supabase. Redémarre `npm run dev` après toute modification de `.env.local`.

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

## Navigation et liens

Chaque écran possède une adresse réelle derrière le fragment d'URL. Le routeur (`src/lib/router.ts`) est un module pur, sans dépendance, testé avec Vitest. Il valide les identifiants UUID et ne lève jamais sur un lien mal encodé.

| Adresse | Écran |
|---|---|
| `#/` | Accueil |
| `#/recherche?q=santé` | Résultats, avec la requête dans l'URL |
| `#/projet/<uuid>` | Fiche projet |
| `#/entraide` | Liste des questions |
| `#/entraide/<uuid>` | Fil d'une question |
| `#/profil` | Profil et progression |
| `#/regles` | Règles de la communauté |
| `#/connexion` | Connexion |

Les écrans internes `#/ajouter`, `#/partager` et `#/etats` suivent les mêmes règles. Une adresse inconnue affiche une 404 chaleureuse avec « Retour à l’accueil ».

- **Historique** : chaque changement d'écran ajoute une entrée (`pushState`). Retour et Avancer fonctionnent au clavier, à la souris, sur Android et avec les gestes du navigateur. La position de défilement est conservée dans `history.state` et restaurée au retour.
- **Hors historique** : les feuilles « Ajouter » et filtres, le tutoriel et les célébrations ne créent jamais d'entrée. Un lien direct est rejoué après la connexion au lieu d'être perdu.
- **Partage** : les boutons « Partager » de la fiche projet et du fil de question utilisent `navigator.share` quand il existe, sinon copient le lien absolu `https://bondev.ngassakindzaa.workers.dev/#/…` et affichent un toast. Le titre de l'onglet suit l'écran (`Accueil · Bondev`, `Recherche · Bondev`…).
- **Recherches récentes** : cinq requêtes au maximum, sous le champ, dans `localStorage` (clé `bondev-recent-searches-v1`). Elles peuvent être retirées une à une, effacées ou désactivées (`bondev-recent-searches-disabled-v1`). Désactivées, un lien permet de les réactiver.
- **Clavier et focus** : `Ctrl + K` (ou `⌘ + K`) et `/` ouvrent la recherche et placent le curseur dans le champ. `Échap` ferme la feuille « Ajouter », le panneau des filtres et le tutoriel. Un lien « Aller au contenu » précède la navigation, le titre du nouvel écran reçoit le focus, et le focus reste piégé dans les modales puis revient à l'élément d'origine.
- **Formulaires** : Entrée envoie la recherche. Les champs titre et description affichent un compteur de caractères. Les brouillons de question et de projet sont conservés dans `localStorage` et signalés au retour (« Ton brouillon de la dernière visite a été restauré »). Quand le clavier virtuel s'ouvre, l'en-tête reste visible.

Les tests du routeur (`src/lib/router.test.ts`) couvrent les routes connues, les identifiants invalides, les paramètres encodés, la 404 et l'aller-retour parseur/constructeur. La trilogie complète reste :

```bash
npm test
npx tsc --noEmit
npm run build
```

### Fichiers et vérifications

Cette évolution touche principalement `src/lib/router.ts`, `src/lib/router.test.ts`, `src/lib/search.ts`, `src/lib/recentSearches.ts`, `src/lib/share.ts`, `src/components/ShareButton.tsx`, `src/components/ui.tsx`, `src/App.tsx`, `src/index.css`, `src/screens/EntraideScreen.tsx`, `src/screens/ShareProjectScreen.tsx`, `src/screens/types.ts` et `src/lib/motion.ts`.

Vérifié dans Chromium sur la version de production : lien direct et rejeu après connexion, Retour/Avancer, restauration du défilement, 404, synchronisation `#/recherche?q=…` à la frappe, partage avec toast, `Ctrl + K`, `/`, `Échap`, lien d'évitement, focus du titre, brouillon et compteurs. Restent à confirmer sur un vrai téléphone : la feuille de partage native, l'en-tête quand le clavier virtuel s'ouvre, et le formulaire de publication avec un compte GitHub réel (le mode invité affiche une restriction).

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
- **Économie de données** : l'interrupteur du Profil est activé par défaut si `navigator.connection.saveData` est vrai. Il coupe animations, flou et retour haptique, allège les ombres et reste mémorisé dans `localStorage`. `prefers-reduced-motion` est également respecté.
- **Cache** : `getProgress()` fait quelques requêtes parallèles plafonnées, garde la valeur 60 secondes en mémoire et conserve la dernière valeur dans `localStorage`. Hors-ligne, le profil et l'accueil affichent « Dernière mise à jour : … ». Le cache est invalidé après une réponse, une validation, une publication, un retrait ou un « Ça m'a servi ».

Les règles de progression sont testées dans `src/lib/progress.test.ts` (seuils de niveaux, semaines UTC, série avec et sans joker, paliers et progression des badges, missions, défi atteint ou non).

## Mode invité

Un visiteur peut essayer Bondev sans compte GitHub avec le bouton secondaire **« Essayer sans compte »**, placé sous les autres moyens de connexion. Il appelle `supabase.auth.signInAnonymously()`. Si Supabase refuse, l'écran affiche exactement : « Le mode invité est indisponible pour l'instant, connecte-toi avec GitHub ».

### Activer le mode invité dans Supabase

1. Ouvre **Authentication > Sign In / Providers** dans le tableau de bord Supabase.
2. Active **Anonymous sign-ins**.
3. Vérifie que les migrations de `supabase/migrations/` sont déjà appliquées, notamment `0005_invites.sql` qui bloque les RPC réservées aux comptes réels.

Sans cette activation, le bouton reste visible mais renvoie le message d'erreur ci-dessus. Aucun réglage n'est nécessaire dans le code.

### Profil de l'invité

- `src/lib/guest.ts` génère un pseudo `invite_` suivi de 6 caractères aléatoires (`a-z`, `0-9`), soit 13 caractères. Le format respecte la contrainte `^[a-zA-Z0-9_-]{3,30}$` de `profiles.pseudo`.
- Le nom affiché est **« Invité »**, l'avatar et le lien GitHub restent vides.
- Le profil est créé par `ensureProfile` dans `src/lib/auth.tsx`. En cas de conflit de pseudo, un nouveau suffixe est tiré (5 tentatives).
- Aucune ligne n'est écrite directement dans `points_ledger` : les 5 points de bienvenue viennent du trigger SQL existant.
- L'invité peut poser des questions, répondre et valider des réponses comme un compte normal, avec ses points d'invité.

### Bannière et conversion

Une bannière discrète s'affiche sur l'accueil et le profil : « Tu es en mode invité. Crée un compte GitHub pour garder tes points et publier un projet. » Elle propose **« Se connecter avec GitHub »** et peut être fermée. La fermeture est mémorisée par utilisateur dans `localStorage` (`bondev-guest-banner:<id>`).

La conversion demande une confirmation (« Tes données d'invité (points, questions et réponses) seront perdues. Continuer avec GitHub ? »), déconnecte l'invité, puis lance l'OAuth GitHub. En cas d'échec OAuth, le message est remonté sur l'écran de connexion via `authNotice`.

### Restrictions

- **Partager un projet** : l'entrée reste visible, mais un invité voit l'écran `GuestRestriction` avec l'explication et le bouton GitHub. Aucun formulaire ni appel API n'est exécuté.
- **Ça m'a servi** : le bouton reste visible. Un clic affiche l'explication sans appeler `mark_project_used`.
- **Entraide** : les questions, réponses et validations restent autorisées.
- La migration `0005_invites.sql` refuse aussi ces deux RPC côté base : les restrictions ne dépendent pas seulement de l'interface.

### Tests et performance

Les tests du pseudo invité, de la détection `is_anonymous` et de la bannière sont dans `src/lib/guest.test.ts` et se lancent avec `npm test`.

Les écrans lourds (Entraide, Profil/Progression, Règles, Partage) sont chargés avec `React.lazy` et un squelette `Suspense`. Supabase est isolé dans son propre chunk. Les logos sont servis en WebP avec `width`/`height`, Montserrat utilise `font-display: swap` et un preconnect Supabase est injecté au build depuis `VITE_SUPABASE_URL`.

Tailles du build de production (gzip) :

| Élément | Avant | Après |
|---|---|---|
| Entrée principale | 174,58 kB | 117,68 kB |
| Supabase | inclus | 55,16 kB (chunk séparé) |
| CSS | 17,90 kB | 35,17 kB |
| Écrans lazy | inclus | 3,05 à 9,34 kB chacun |

## Design system

La refonte visuelle est centralisée **en fin de `src/index.css`**, après les règles historiques. Elle harmonise les composants existants sans modifier le contenu, les écrans ni la logique métier. Aucune dépendance n'a été ajoutée.

### Tokens

Les couleurs sont centralisées dans `src/index.css` (`:root` pour le sombre, `html[data-theme="light"]` pour le clair). Le thème initial est appliqué **avant la première peinture** par le script inline de `index.html`, avec `<meta name="color-scheme">` et `color-scheme`.

| Token | Sombre | Clair | Usage |
| --- | --- | --- | --- |
| `--bd-bg` | `#050816` | `#f7f9ff` | Fond de l'application, `.phone` |
| `--bd-bg-deep` | `#02040c` | `#eef3ff` | Fond profond, `body`, `.shell` |
| `--bd-bg-glow` | `#111936` | `#e4ecff` | Halo statique du fond |
| `--bd-surface` | `#0c1124` | `#ffffff` | Cartes, feuilles, barre latérale |
| `--bd-surface-2` | `#111936` | `#f2f6ff` | Surface secondaire, pistes |
| `--bd-surface-glass` | `rgba(255,255,255,.055)` | `rgba(255,255,255,.88)` | Verre, champs, boutons contour |
| `--bd-field-bg` | `rgba(255,255,255,.055)` | `#ffffff` | Fond des champs |
| `--bd-hover` | `rgba(255,255,255,.07)` | `rgba(24,52,107,.055)` | Survol, puces, pistes |
| `--bd-nav-bg` | `rgba(7,11,26,.94)` | `rgba(247,249,255,.95)` | Barre de navigation |
| `--bd-border` | `rgba(255,255,255,.10)` | `rgba(24,52,107,.12)` | Filets et bordures fines |
| `--bd-border-strong` | `rgba(255,255,255,.16)` | `rgba(24,52,107,.20)` | Bordures de champs et de cartes |
| `--bd-text` | `#f2f6ff` | `#111936` | Texte principal |
| `--bd-text-muted` | `#a8b3cf` | `#4a5a78` | Texte secondaire |
| `--bd-text-soft` | `#8490ad` | `#5d6b86` | Texte tertiaire, placeholders |
| `--bd-nav-inactive` | `#93a0bd` | `#4f5e7a` | Icônes de navigation inactives |
| `--bd-link` | `#7cc0ff` | `#1557b8` | Liens et actions actives |
| `--bd-brand-ink` | `#8fd0ff` | `#0b63b8` | Texte sur fond de marque |
| `--bd-brand-1` | `#1EA7FF` | `#1EA7FF` | Bleu électrique : actif uniquement |
| `--bd-brand-2` | `#2F6BFF` | `#2F6BFF` | Bleu de marque |
| `--bd-brand-3` | `#7B3FF2` | `#7B3FF2` | Violet de marque |
| `--bd-brand-soft` | `rgba(47,107,255,.16)` | `rgba(47,107,255,.10)` | Teinte de marque douce |
| `--bd-brand-glow` | `rgba(47,107,255,.18)` | `rgba(47,107,255,.08)` | Halo et fonds teintés |
| `--bd-success` | `#5fe3b0` | `#087a4e` | Succès, progression |
| `--bd-warning` | `#ffc45c` | `#8a5a00` | Alerte, série |
| `--bd-danger` | `#ff8fa3` | `#b3123a` | Danger, erreur |
| `--bd-danger-bg` | `rgba(255,93,122,.12)` | `rgba(179,18,58,.08)` | Fond des messages d'erreur |
| `--bd-focus` | `rgba(30,167,255,.45)` | `rgba(47,107,255,.38)` | Anneau de focus |
| `--bd-gradient-brand` | `linear-gradient(110deg,#1EA7FF,#2F6BFF 53%,#7B3FF2)` | idem | Dégradé décoratif de marque |
| `--bd-gradient-primary` | `linear-gradient(110deg,#0874d1,#2a5fe8 52%,#6a2fd8)` | idem | Dégradé des boutons primaires |
| `--bd-gradient-text` | `linear-gradient(110deg,#5bc6ff,#7fa4ff 55%,#b99bff)` | `linear-gradient(110deg,#0968c4,#2046c9 55%,#5b2bb8)` | Texte en dégradé |
| `--bd-gradient-danger` | `linear-gradient(110deg,#b81f45,#e0335f)` | idem | Boutons dangereux |

**Règles d'usage** : le bleu électrique `--bd-brand-1` ne sert qu'aux éléments actifs (onglet actif, lien, focus, progression) ; le texte courant utilise `--bd-text*`. Les variantes alpha de la marque (`#2f6bff0d`, `#2f6bff1f`, etc.) restent des teintes décoratives ponctuelles, jamais des couleurs de texte. Les blancs et noirs en dur sont réservés au texte sur dégradé, aux ombres et aux illustrations (médailles, confettis). Les teintes de statut des médailles, pastilles résolues et célébrations (`#38d996`, `#7ee2b8`, `#16794f`, ambre et rouge) restent littérales : ce sont des accents décoratifs calibrés pour leurs fonds, pas des doublons des tokens de texte. Le bloc `@media(prefers-color-scheme:light)` conserve des valeurs littérales : c'est le repli avant l'exécution du script de thème, il ne peut pas encore lire `data-theme`.

- **Rayons** : `--bd-radius-sm|md|lg|xl|pill` valent 12 / 16 / 22 / 28 / 999 px.
- **Ombres** : douce, moyenne, halo de marque et danger.
- **Espacements** : base 4 px, de `--bd-space-1` à `--bd-space-8`.
- **Mouvement** : durées 120 / 200 / 320 / 520 ms, courbe `cubic-bezier(.2,.8,.2,1)` et ressort `cubic-bezier(.34,1.56,.64,1)`. La couche de mouvement ajoute 240 ms pour les changements d'écran, 600 ms pour le compteur de points, 380 ms pour la coche « Utile » et 40 ms par élément de cascade.

### Boutons

- **Primaire** : dégradé de marque, élévation et halo au survol, échelle `.94` à l'appui puis retour ressort en 280 ms.
- **Contour** : bordure dégradée de 2 px, fond transparent, texte et icône en dégradé.
- **Ghost**, **danger** et **icône seule** : variantes dédiées, tailles `.btn-sm` et `.btn-lg`, cibles d'au moins 44 px.
- **États** : `:focus-visible` avec anneau de marque, `:disabled` atténué, `[aria-busy="true"]` avec pulsation discrète. Tous les boutons utilisent `-webkit-tap-highlight-color: transparent` et `touch-action: manipulation`.
- **Recherche** : le bouton loupe reprend la variante contour, avec un `linearGradient` SVG pour la loupe et un rebond au survol, au focus et à l'appui. La barre de recherche, elle, ne se soulève pas et ne change pas d'apparence au focus.

### Navigation

- Barre basse sur mobile, barre latérale sur tablette et ordinateur.
- L'icône active est **remplie en dégradé** (`FILLED_ICONS` + `url(#brand-gradient)`), l'icône inactive reste en **trait dégradé**. Les boutons de navigation n'ont plus de conteneur visuel : l'icône est rendue directement dans le bouton.
- L'onglet actif est marqué immédiatement, dans la même image que le nouvel écran (aucun indicateur séparé) ; son icône garde la grille de 22 px et son libellé est en dégradé.
- Sur mobile, les cinq entrées occupent le même emplacement de 22 px et partagent le même axe ; tous les libellés restent sur la même ligne de base.
- Le bouton « + » est aligné sur les autres icônes : cercle de 22 × 22 px, anneau de 1,5 px et symbole de 14 px, sans masque.
- Les trois états du menu latéral (fermé, survolé, épinglé) conservent le même alignement ; son déploiement est instantané et seuls les libellés animent opacité et translation.

### Champs et sélections

- Champs, zones de texte et sélections partagent les surfaces, bordures et rayons des tokens ; le focus affiche un anneau de marque.
- La barre de recherche fait exception : elle garde exactement son apparence de repos au survol, au clic et au focus, sans contour, changement de fond ou de bordure, ni soulèvement.
- La case à cocher des filtres a une coche animée et un fond dégradé ; l'interrupteur glisse avec un ressort.
- Le remplissage automatique de Chrome est neutralisé par `:-webkit-autofill` et la surface du thème. Les champs portent `autocomplete`, `inputmode`, `enterkeyhint` et `spellcheck` adaptés.

### Mouvement

La couche de mouvement vit dans `src/lib/motion.ts` (règles pures), `src/components/motion.tsx` (compteurs, barres, confettis), `src/lib/viewTransition.ts` (transitions d'écran) et `src/lib/haptics.ts` (vibration). Elle n'ajoute aucune dépendance et ne change ni le contenu ni la logique métier. Ses règles sont testées dans `src/lib/motion.test.ts` (courbe du compteur, plafond de cascade, sens des transitions).

- **Principes** : toutes les animations de déplacement et de taille passent par `transform` et `opacity` ; les transitions restantes de couleur, bordure ou ombre accompagnent des changements d'état (survol, focus, actif) et ne servent jamais de mouvement. Aucun `will-change` permanent, aucune animation de `backdrop-filter`. La coche « Utile ✓ » est la seule exception CSS de dessin (`stroke-dashoffset`) ; les confettis utilisent un canvas dédié, limité à 40 particules.
- **Écrans** : `document.startViewTransition` quand il existe, avec un glissement directionnel de 240 ms ; repli fondu + glissement de 200 ms sinon. En mode complet, l'onglet actif est peint dans la même image que le nouvel écran (`flushSync`). En mode sûr, `startTransition` découpe le rendu des longues listes sans bloquer le clic et aucune View Transition n'est lancée. Chaque écran retrouve sa position de défilement.
- **Listes** : cascade de 40 ms par élément, plafonnée à 10 éléments et rejouée une seule fois par affichage. Les squelettes utilisent un shimmer aux couleurs de la marque, sans saut de mise en page.
- **Points et progression** : compteur de 600 ms ralenti en fin de course, puce `+3` / `−1`, barres remplies par `scaleX` avec un ressort de 720 ms. Les confettis maison sont limités à 40 particules et s'arrêtent après 1,5 s ; le niveau reçoit une carte avec emblème.
- **Micro-interactions** : soulèvement et inclinaison de 1,2° sur pointeur fin, retour d'appui sur les cartes cliquables, feuilles et panneau de filtres avec ressort, toasts empilés, fondu croisé des onglets de l'Entraide, ombre d'en-tête au défilement et bouton « Remonter ».
- **Validation** : coche « Utile ✓ » dessinée en `stroke-dashoffset`, vibration `navigator.vibrate(10)` sur validation et célébration. L'interrupteur **Retour haptique** du Profil est actif par défaut et se coupe avec l'Économie de données.
- **Désactivation** : `prefers-reduced-motion: reduce` et l'Économie de données coupent les View Transitions, les confettis, les squelettes animés et ramènent les durées à environ 0 ms. L'Économie de données coupe aussi l'haptique. Le mode d'effets **Légers** (le mode sûr, auto ou manuel) va plus loin : fond solide avec un seul halo statique de 420 px, surfaces unies et bordure 1 px, aucun masque, flou, filtre, grain, reflet ni `content-visibility`, aucune View Transition, cascade, inclinaison ni confetti ; les compteurs et les contenus restent visibles.
- **Mesures** : voir [Téléphone réel et effets adaptatifs](#téléphone-réel-et-effets-adaptatifs) pour le protocole 6× CPU / Fast 3G et les tableaux avant/après. Repère public : Lighthouse mobile 94 → 96, FCP 0,9 s, LCP 2,8 s, TBT 70-100 ms, CLS 0 ; l'audit connecté mesure 100 (98-100) sur la version courante et varie avec les données Supabase.

### Accessibilité et préférences

- Contrastes AA, focus visible et cibles tactiles de 44 px minimum.
- `prefers-reduced-motion` supprime animations, transitions et View Transitions.
- Le mode **Économie de données** coupe le flou, les animations, l'haptique et allège les ombres.
- En `Auto`, un pointeur grossier ou un écran ≤ 820 px force le mode sûr, indépendamment des performances. `Complets` reste activable dans Profil.
- Le traducteur observait chaque frappe : il est désormais temporisé à 90 ms pour éviter les repeints en cascade.

Les captures de cette passe sont dans `docs/screens/` (non versionnées, 8 fichiers, viewport 390 × 844 capturé en DPR 2) : `accueil-avant-apres.jpg`, `recherche-avant-apres.jpg`, `projet-avant-apres.jpg`, `profil-avant-apres.jpg`, `profil-bas-avant-apres.jpg`, `recherche-menu.jpg`, `accueil-clair.jpg` et `remonter.jpg`. Les cinq composites placent la version `ca7c782` à gauche et la version courante à droite : salutation en casse normale, placeholder fixe, ligne « Récent » et son menu « ⋯ », puces en grille, fiche projet, nom affiché, segments pleine largeur et bouton Remonter.

## Direction artistique

La direction artistique pousse l'interface vers un rendu premium, moderne et artistique, sans changer le contenu ni la logique métier, sans dépendance et sans ressource distante au runtime.

- **Typographie** : Montserrat variable auto-hébergée (`public/fonts/montserrat-latin-var.woff2`, 400–700, sous-ensemble latin, `font-display: swap`), préchargée depuis `index.html`. Les titres utilisent une échelle fluide `clamp()`, un interlettrage resserré ; les chiffres sont tabulaires et les grands nombres passent en dégradé.
- **Ambiance** : trois halos flous animés en 36 s sur `.bd-backdrop::before`, couche fixe hors de `.phone` ; grain SVG à 3 %, pause quand l'onglet est caché (`data-activity="hidden"`), désactivation avec `prefers-reduced-motion`, l'Économie de données ou le mode sûr. En mode sûr, un seul halo statique de 420 px remplace les trois halos animés. Le thème clair reprend les mêmes halos en pastel.
- **Matières** : cartes en verre à plusieurs couches, bordure dégradée de 1 px via `mask`, reflet intérieur et élévation cohérente ; monogrammes déterministes pour les projets, emblèmes SVG pour les six niveaux, anneaux d'avatar selon le niveau et illustrations inline pour les états vides, hors-ligne et erreurs. En mode sûr, ces matières deviennent des surfaces unies avec une bordure 1 px, sans masque, flou ni reflet.
- **Icônes** : grille de 24 px, trait 1,75, bouts arrondis, tailles unifiées ; le remplissage est réservé à l'état actif et aux célébrations. Le « + » de la navigation reprend la taille et l'axe des autres icônes.
- **Lancement** : splash HTML/CSS pur dans `index.html` (logo local pulsé, ligne de progression, styles clair et sombre), fondu déclenché au montage de React. Le manifest reprend le nom, les couleurs et les icônes de la marque.
- **En-tête et navigation** : l'en-tête est transparent au repos, sans fond, backdrop ni conteneur ; après 8 px de défilement, une barre pleine largeur de la couleur du fond et un filet 1 px apparaissent, jamais au focus ni au clavier. Les points affichent une pièce et « N pts » ; le thème est une icône seule de 44 px. Le logo de la barre latérale est visible dès 640 px et masqué dans la grille mobile à cinq boutons.

Poids CSS : **26,54 kB → 30,23 kB gzip** (+3,69 kB) lors de la refonte ; la passe mobile le porte à **33,52 kB gzip**, puis cette passe à **36,10 kB gzip**. Les animations restent sur `transform` et `opacity`, avec `prefers-reduced-motion`, Économie de données et mode d'effets sûr.

Fichiers modifiés : `index.html`, `src/main.tsx`, `src/index.css`, `src/App.tsx`, `src/components/ui.tsx`, `src/components/motion.tsx`, `src/lib/motion.ts`, `src/lib/viewTransition.ts`, `src/lib/haptics.ts`, `src/lib/motion.test.ts`, `src/screens/ProfileScreen.tsx`, `src/screens/EntraideScreen.tsx`, `public/fonts/montserrat-latin-var.woff2` et `README.md`.

Points non vérifiés : Safari/iOS et appareils physiques, lecteurs d'écran, clavier virtuel réel et zoom texte natif à 200 %. L'audit Lighthouse de l'accueil connecté reste variable (98–100 sur cette passe) selon la charge de la machine ; la page publique mesure 96.

## Affichage responsive

L'interface est vérifiée de **320 px à 1920 px**, en thèmes sombre et clair, sans défilement horizontal ni texte coupé.

| Largeur | Appareil visé |
|---|---|
| 320 / 360 px | petits téléphones, portrait |
| 390 / 412 / 480 px | iPhone et Android courants, portrait et paysage |
| 768 px | tablette portrait |
| 1024 px | tablette paysage |
| 1280 / 1440 / 1920 px | ordinateur |

Les écrans suivants sont contrôlés à chaque largeur : accueil, résultats de recherche, fiche projet, partage de projet, Entraide, fil de question (ouverte et résolue), poser une question, profil, règles, états vides et hors-ligne, feuille « Ajouter ». Le panneau de filtres, le tutoriel, la bannière invité et les trois états du menu latéral (fermé, survolé, épinglé) sont aussi vérifiés. Deux formats paysage de téléphone (667 × 375 et 844 × 390) complètent l'audit.

Le fil de question est testé dans ses quatre états (ouverte, résolue, retirée, expirée), avec un titre long, un pseudo long, une URL longue, 0, 1 ou 20 réponses, avec et sans preuve GitHub. Le texte du navigateur est également contrôlé à **130 %** et **200 %** aux largeurs mobiles.

Règles appliquées dans `src/index.css` :

- `min-width: 0` sur les enfants flex/grid, `overflow-wrap: anywhere` sur les titres, pseudos, URL et réponses ;
- puces, badges et onglets en `flex-wrap` ; blocs d'information en pleine largeur ;
- `clamp()` pour les grands titres et largeur maximale du contenu sur les grands écrans ;
- grille de projets en 1, 2 puis 3 colonnes ;
- échelle de `z-index` en variables CSS (`--z-nav`, `--z-filter`, `--z-sheet`, `--z-toast`, `--z-net`, `--z-tutorial`) ;
- `100dvh`, `env(safe-area-inset-*)` et marges basses pour que le contenu ne passe jamais sous la navigation ;
- cibles tactiles d'au moins 44 px ;
- bandeau « Résolue grâce à @pseudo » en pleine largeur sous les puces, et message « Merci ! … » empilé dessous ;
- panneau de filtres mobile en `position: fixed`, largeur `min(360px, 100%)`, défilement interne et au-dessus de la navigation ;
- en paysage de téléphone, le menu latéral défile verticalement et les cartes tablette passent d'elles-mêmes à une colonne quand le contenu devient étroit.

Les captures de la passe mobile sont dans [`docs/screens/`](docs/screens/) et détaillées dans [Téléphone réel et effets adaptatifs](#téléphone-réel-et-effets-adaptatifs). Elles ne sont pas versionnées.

> [!NOTE]
> Les états « retirée » et « expirée » ne sont pas disponibles dans les données de démonstration actuelles : ils ont été simulés dans le DOM pour vérifier leur mise en page, pas rejoués depuis Supabase. Les tests à 200 % ont été faits dans Chromium en agrandissant les polices calculées, pas avec le zoom texte natif de chaque navigateur. Safari/iOS, le clavier virtuel réel et les lecteurs d'écran n'ont pas été testés sur appareil physique. Un placeholder de champ de recherche sur une seule ligne reste tronqué nativement à 320 px ; le libellé complet reste disponible dans l'attribut `placeholder`.

Contrôles avant livraison :

```bash
npm test
npx tsc --noEmit
npm run build
```

## Téléphone réel et effets adaptatifs

### La bande sombre : cause exacte et correction

Sur Android, la barre d'adresse de Chrome se rétracte au défilement et le clavier virtuel réduit la zone visible. Avant, trois couches se disputaient le fond : `html` et `body` en `#02040c`, `.shell` avec un dégradé radial, et `.phone` avec son propre `radial-gradient(...), #050816`. Le contenu défilait dans `.screen` en `min-height: 100vh`, pas en `100lvh`. Dès que la zone visible grandissait, la partie découverte affichait le fond de `html`/`body`, plus sombre : c'était la bande. La navigation, translucide (`color-mix(... 88%, transparent)`) avec `backdrop-filter: blur(22px)`, échantillonnait cette bande et accentuait la couture ; l'en-tête collant des Règles ajoutait une seconde couche floutée au même endroit. Enfin, `theme-color` valait `#050816` alors que le fond de page valait `#02040c`.

La correction tient en une seule couche : `.bd-backdrop` est un `div` fixe, hors de `.phone`, en `position: fixed; inset: 0; height: 100lvh`, avec les halos et le grain. `html` et `body` reprennent `--bd-bg-deep`, `.phone` devient transparent, ses anciens `::before`/`::after` sont désactivés. La navigation est opaque, exactement `var(--bd-bg)`, sans `backdrop-filter`. `theme-color` est mis à jour dans le même rendu que le thème (`#050816` en sombre, `#f7f9ff` en clair). Comme la couche est fixe et couvre la grande viewport, la barre rétractée, le clavier, le rebond et le passage sombre/clair ne peuvent plus découvrir un autre fond.

En mode sûr, la couche devient `position: absolute`, haute de 420 px, avec un seul `radial-gradient` statique, et `html`, `body`, `.shell` et `.nav` sont de la même couleur pleine. C'est le fond par défaut sur un pointeur grossier ou un écran ≤ 820 px : la teinte ne dépend plus de la hauteur de la page.

### Décision des effets

`src/lib/effects.ts` contient la règle pure, testée dans `src/lib/effects.test.ts`. L'ordre est strict :

1. `Complets` force le mode complet, `Légers` force le mode sûr.
2. En `Auto`, un pointeur grossier (`pointer: coarse`) ou une largeur ≤ 820 px passe en sûr, avant même les signaux de performance.
3. Sinon, `saveData`, `deviceMemory <= 4`, `hardwareConcurrency <= 4` ou une médiane de frame supérieure à 24 ms passent en sûr.
4. Sinon, complet.

La préférence est mémorisée dans `localStorage` sous `bondev-effects` et appliquée avant React dans `src/main.tsx`. Sur un appareil qui semble puissant, une sonde de 2 s démarre 320 ms après le chargement, uniquement si l'onglet est visible ; elle ignore les deux premières frames et bascule en sûr si la médiane dépasse 24 ms. Le Profil expose **Effets visuels : Auto / Complets / Légers** avec l'état effectif.

En sûr : fond statique (plus de dérive ni de grain), aucun `backdrop-filter`, aucun `filter`, aucun `mask`/`border-image`/`mix-blend-mode`, surfaces unies avec une bordure 1 px, pas de reflet intérieur, pas de View Transition, pas de cascade, pas d'inclinaison, pas de confettis, ombres simples ≤ 12 px sans lueur, aucun `content-visibility`. Les compteurs de points restent visibles, les icônes, les dégradés de marque, les cibles de 44 px et tous les contenus restent identiques. En complet, rien n'est retiré : halos, verre, View Transitions et micro-interactions restent en place.

### Laboratoire de rendu

La page `#/diagnostic` expose dix interrupteurs persistés sous `bondev-render-lab`. Chacun coupe une famille CSS à risque et applique un attribut `data-lab-*` sur `<html>` :

| Interrupteur | Famille coupée |
|---|---|
| Bordures en dégradé | `mask`, `mask-composite`, `border-image`, contours |
| Ombres et lueurs | `box-shadow`, `text-shadow`, `drop-shadow` |
| Reflets intérieurs | pseudo-éléments de brillance |
| Fond fixe et halos | couche `fixed`, halos, dégradés animés |
| Grain | bruit et `mix-blend-mode` |
| Flous | `backdrop-filter`, `filter` |
| Animations et transitions | `animation`, `transition`, `scroll-behavior` |
| Dégradés SVG des icônes | `fill`/`stroke` en `url(#brand-gradient)` |
| content-visibility et contain | `content-visibility`, `contain` |
| View Transitions | `document.startViewTransition` |

Les interrupteurs fonctionnent en mode sûr comme en mode complet : leurs sélecteurs portent `html[data-theme][data-effects]` pour passer après les règles `!important` du mode sûr. Le rapport copié contient les dix états. La procédure complète, les valeurs attendues et les causes/hypothèses sont dans [`docs/TEST-TELEPHONE.md`](docs/TEST-TELEPHONE.md).

### En-tête, tuiles et états

- L'en-tête est `sticky` et transparent au repos : aucun fond, bordure, ombre ou angle droit derrière le logo, les points ou le thème. La barre pleine largeur n'est peinte par `.topbar::before` qu'après 8 px de défilement, avec un filet de 1 px ; jamais au focus ni quand le clavier est ouvert.
- `padding-top: calc(env(safe-area-inset-top) + 8px)`, hauteur 56 px. Les points affichent une pièce et « N pts ». Le thème est une icône seule de 44 px, sans cadre. Le titre reste sur une ligne avec ellipse ; l'écran Règles affiche « Règles ».
- Les tuiles d'icônes utilisent un seul `linear-gradient` qui couvre 100 % × 100 % de la tuile. Le bouton « + » de navigation est un cercle de 22 px, aligné sur les autres icônes, avec un anneau et un symbole visibles en mode sûr. L'état vide utilise `StateArt` transparent, sans carré bleu.
- Le focus programmatique du premier titre après navigation ne peint plus de halo (`outline` et `box-shadow` neutralisés pour `[tabindex="-1"]`).
- La bannière invité lit son état de fermeture dès l'initialisation : elle n'apparaît plus une frame avant de disparaître, ce qui ramène le CLS Lighthouse connecté de 0,16 à 0. Un rechargement CDP à 500 px montre encore un CLS de 0,047 quand les données de progression déplacent `.impact-strip` ; Lighthouse connecté ne le reproduit pas (CLS 0).

### Causes et hypothèses

- **Liserés et bavures sur Xiaomi/Mali** : combinaison de `mask`/`mask-composite` (bordures dégradées), `backdrop-filter`, grain en `mix-blend-mode` et `filter` imbriqués. Le pilote Mali compose mal ces couches. Le mode sûr les retire tous ; le laboratoire permet d'isoler la famille fautive sur l'appareil.
- **En-tête encadré** : ancienne marge de 20 px, fond, flou, bordure et rayon derrière le logo, les points et le thème ; une règle clavier peignait aussi un fond. L'en-tête est désormais transparent au repos et la barre n'existe qu'au défilement.
- **Teinte variable** : le dégradé `.shell` était proportionnel à la hauteur de la page, et `.bd-backdrop` fixe superposait plusieurs halos. La couleur à une même hauteur changeait donc selon l'écran. Le fond sûr est solide, avec un seul radial statique de 420 px.
- **Liseré en bas à droite** : `.nav { width: min(100%, 390px) }` laissait une bande de fond sur un écran plus large que 390 px. La nav est maintenant pleine largeur.
- **Tuiles remplies à moitié** : dégradé radial dimensionné sur un coin, ou fond porté par un `div` interne plus petit que la tuile. Un seul `linear-gradient` couvre toute la tuile.
- **Carré bleu de l'état vide** : `.empty > div` héritait du fond de tuile alors que `StateArt` a déjà son halo. Le sélecteur est limité aux tuiles et `.state-art` est transparent.
- **Symbole « + » invisible** : le cercle avait été réduit à 22 px et son anneau dessiné par un masque ; en mode sûr, le masque est retiré et le trait de 13 px se perdait dans le fond. Le bouton garde un cercle de 22 px, aligné sur les autres icônes, avec un anneau de 1,5 px en deux couches de fond (sans masque) et un symbole de 14 px.
- **« + » décalé quand le menu latéral s'élargit** : `margin:0 auto` sur le cercle, dans un bouton passé en `flex-direction:row` ; l'auto-marge absorbait l'espace libre et centrait le cercle, alors que les autres icônes restent à gauche. `margin:0` : le cercle garde le même axe que les autres dans les trois états (fermé, survolé, épinglé) et le libellé suit ; sur mobile, la grille le centre dans sa colonne.

Le tableau détaillé, avec les valeurs CSS attendues et la procédure de test, est dans [`docs/TEST-TELEPHONE.md`](docs/TEST-TELEPHONE.md).

### Réactivité

- `AuthSession`, `AuthStats` et `AuthActions` sont trois contextes distincts : une mise à jour de points ne re-rend plus les écrans qui n'utilisent que la session.
- `ProjectCard` et `QuestionCard` sont mémoïsés, les clés sont stables, et la saisie de recherche des Résultats vit dans l'écran au lieu de App.
- Résultats et Entraide affichent 20 éléments par page, puis **Voir plus**. La première peinture monte 8 cartes, les suivantes arrivent par 6 toutes les 120 ms.
- `content-visibility: auto` et `contain-intrinsic-size` évitent de mettre en page les cartes hors écran (96 px générique, 168 px pour les résultats, 210 px pour les questions, 64 px pour l'historique).
- Les écouteurs de défilement sont passifs et coalescés par `requestAnimationFrame` ; aucune lecture de mise en page répétée dans le handler. `touch-action: manipulation`, `:active` immédiat et transitions limitées à `transform`/`opacity`.
- En mode sûr, `navigateWithMotion` utilise `startTransition` : le rendu d'une longue liste est découpé au lieu de bloquer l'événement. En mode complet, `flushSync` reste nécessaire pour peindre l'onglet actif et le nouvel écran dans la même image.
- La recherche normalise une fois les mots-clés et met en cache les champs normalisés de chaque projet dans une `WeakMap` ; les résultats ne changent pas.

### Mesures à 6× CPU et Fast 3G

Protocole : Chrome 157, viewport 390 × 844, DPR 2,625, 6× CPU, réseau Fast 3G (150 ms, environ 1,7 Mbit/s descendant et 768 kbit/s montant), 3 passages après un passage à chaud, médiane. « Blocage » = plus longue tâche longue démarrée après le clic, collectée 550 ms après les deux `requestAnimationFrame` qui suivent l'écran cible. « Stabilisation » = clic → cible DOM → 2 rAF. L'après est mesuré en **mode sûr**, celui qu'un téléphone milieu de gamme reçoit en Auto.

| Écran | Avant : stabilisation | Avant : blocage médian / max | Après : stabilisation | Après : blocage médian / max |
|---|---:|---:|---:|---:|
| Accueil | 403 ms | 74 / 89 ms | 318 ms | 80 / 92 ms |
| Résultats | 1 072 ms | 138 / 181 ms | 939 ms | 0 / 0 ms |
| Fiche projet | 496 ms | 0 / 53 ms | 300 ms | 0 / 0 ms |
| Entraide | 454 ms | 68 / 98 ms | 351 ms | 0 / 85 ms |
| Fil de question | 1 224 ms | 0 / 0 ms | 1 100 ms | 0 / 0 ms |
| Profil | 395 ms | 78 / 105 ms | 339 ms | 59 / 77 ms |

Les six changements d'écran après sont sous **100 ms de blocage** (maximum 92 ms à l'accueil). Avant, Résultats (181 ms) et Profil (105 ms) dépassaient la limite. La stabilisation baisse de 10 à 40 % sur cinq écrans ; le fil de question reste dominé par le chargement réseau des réponses.

Le mode complet a aussi été mesuré avec le même protocole : Accueil 354 ms (69 / 76 ms), Résultats 1 205 ms (238 / 255 ms), Fiche projet 497 ms (0 / 0 ms), Entraide 500 ms (76 / 105 ms), Fil 1 385 ms (52 / 52 ms), Profil 383 ms (60 / 64 ms). Il conserve la View Transition synchronisée : à 6× CPU, le rendu des 8 premières cartes de Résultats reste une tâche longue de 255 ms, soit environ 42 ms sur un appareil haut de gamme non bridé. Ce chemin n'est pas celui des appareils modestes, qui passent en sûr avant React.

### Lighthouse mobile

**Écran de connexion** (page publique, 3 passages : 96, 96, 95) :

| Audit | Avant | Après |
|---|---:|---:|
| Performance | 94 | 96 |
| Accessibilité | 98 | 98 |
| Best practices | 100 | 100 |
| SEO | 92 | 92 |
| FCP | 2,1 s | 0,9 s |
| LCP | 2,8 s | 2,8 s |
| TBT | 80 ms | 80 ms |
| CLS | 0 | 0 |
| Speed Index | — | 1,5 s |

**Écran connecté** (invité sur l'accueil, données Supabase chargées, 3 passages : 100, 98, 100) :

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

La plage de l'après (98-100) montre la variabilité d'une session invitée Supabase : un passage peut descendre sous la médiane. Le TBT de l'écran connecté inclut le chargement des données et la création de la session ; il reste supérieur à celui de la connexion, mais sa médiane baisse fortement. Le protocole 6× CPU ci-dessus est plus stable pour juger les changements d'écran. Les chiffres « avant » sont ceux du commit précédent (`ca7c782`), déjà mesurés dans la passe mobile ; les « après » ont été mesurés sur la version courante, avec un profil invité existant et `--disable-storage-reset` pour éviter que Lighthouse ne reparte sur l'écran de connexion. Un contrôle final après la restauration du bouton « + » donne 3 passages 96/96/95, avec un TBT de 70 à 100 ms (médiane 80 ms) et un Speed Index de 1,5 s : le score reste identique, le TBT varie avec la charge de la machine. Dans un relevé intermédiaire de cette passe, le CLS connecté mesurait 0,16 avant la correction de la bannière invité ; il est à 0 après.

### Checklist Android

À vérifier sur un vrai téléphone, en Chrome, Samsung Internet et navigateur Xiaomi :

- [ ] Accueil, Résultats, Fiche projet, Entraide, Fil de question, Profil, Règles : aucun liseré sombre en haut ou en bas, barre d'adresse rétractée puis déployée.
- [ ] Clavier ouvert dans la recherche et dans « Poser une question » : le fond reste continu, l'en-tête reste visible, le champ n'est pas masqué.
- [ ] Rebond en haut et en bas (overscroll) : aucune couture, aucun flash blanc ou noir.
- [ ] Thème sombre puis clair : la barre système et la barre d'adresse reprennent `theme-color`, sans transition visible.
- [ ] Entraide : bulle de dialogue en trait, puis pleine en dégradé quand l'onglet est actif.
- [ ] Règles : livre fermé en trait, puis plein en dégradé quand l'onglet est actif.
- [ ] Profil > Effets visuels : Auto, Complets, Légers ; le choix survit à un rechargement.
- [ ] En mode sûr : fond solide, un seul halo statique de 420 px, pas de flou, pas de masque, pas de grain, pas de confettis ; compteurs de points et contenus toujours lisibles.
- [ ] `#/diagnostic` : les dix interrupteurs du laboratoire, « Tout réactiver », persistance après rechargement et rapport copié avec les dix états.
- [ ] En-tête : transparent au repos, barre pleine largeur et filet 1 px après 8 px de défilement, jamais au focus ni au clavier ; pièce + « N pts » ; thème en icône seule de 44 px ; titre sur une ligne avec ellipse ; « Règles ».
- [ ] Tuiles : un seul dégradé couvrant 100 % de la tuile sur l'accueil, l'Entraide, la progression, la navigation, le tutoriel et les états vides.
- [ ] Listes : 20 éléments, « Voir plus », les cartes suivantes arrivent sans saut de mise en page.
- [ ] `#/diagnostic` : dimensions, visualViewport, test 3 s, « Copier le rapport » en français.
- [ ] Mode avion puis retour réseau : bannière hors-ligne, aucune donnée personnelle dans le diagnostic.

### Vérifications et fichiers modifiés

```bash
npm test          # 10 fichiers, 114 tests
npx tsc --noEmit
npm run build
```

Fichiers modifiés : `README.md`, `src/App.tsx`, `src/components/GuestBanner.tsx`, `src/components/motion.tsx`, `src/components/ui.tsx`, `src/index.css`, `src/lib/api.ts`, `src/lib/effects.ts`, `src/lib/effects.test.ts`, `src/lib/format.ts`, `src/lib/format.test.ts`, `src/lib/progress.ts`, `src/lib/renderLab.ts`, `src/lib/renderLab.test.ts`, `src/lib/viewTransition.ts`, `src/main.tsx`, `src/screens/DiagnosticScreen.tsx`, `src/screens/HowItWorksScreen.tsx`, `src/screens/ProfileScreen.tsx` et `docs/TEST-TELEPHONE.md`. Aucune dépendance ajoutée, aucun SQL modifié, aucun changement de contenu métier ou d'API.

Points non vérifiés : Samsung Internet et navigateur Xiaomi sur appareil physique, iOS Safari, clavier virtuel réel, lecteurs d'écran et zoom texte natif à 200 %. Les artefacts GPU Mali/Adreno ne sont pas reproduits sur un GPU physique dans cette passe : le laboratoire et les mesures CSS permettent de les isoler sur l'appareil. Le comportement exact de la barre d'adresse et des gestes système varie selon le constructeur ; il a été reproduit dans Chrome par émulation de la viewport, pas sur chaque surcouche Android.

## Diagnostic

La page `#/diagnostic` est accessible sans session et **non liée dans la navigation**. Elle est chargée à la demande, ajoute `<meta name="robots" content="noindex, nofollow">` pendant son affichage et le retire en quittant. Elle n'appelle ni Supabase ni aucun service réseau et n'affiche aucune donnée personnelle.

Pour l'ouvrir sur un téléphone, remplace le hash de l'URL par `#/diagnostic` (par exemple `https://bondev.example/#/diagnostic`). Sur le preview local : `http://localhost:4173/#/diagnostic`.

Elle affiche :

- dimensions de la fenêtre et de `visualViewport`, offsets et échelle, DPR, `screen.width/height`, safe areas lues par une sonde `env()`, user-agent ;
- `deviceMemory`, `hardwareConcurrency`, `saveData`, type de connexion, `display-mode`, mode d'effets effectif ;
- prise en charge de View Transitions, `backdrop-filter` et `content-visibility` ;
- le **Laboratoire de rendu** : dix interrupteurs persistés sous `bondev-render-lab`, appliqués immédiatement sur `<html>` par `data-lab-*`, avec un bouton **Tout réactiver** ;
- un test de frames de 3 s lancé automatiquement 350 ms après l'ouverture, avec médiane, p95, nombre de frames > 50 ms et long tasks. Le bouton **Relancer le test** refait la mesure ; l'onglet doit rester visible.
- le bouton **Copier le rapport** produit un texte français lisible, avec repli `execCommand` si l'API Clipboard est refusée. Il contient le pointeur, la largeur, le mode d'effets et les dix états du laboratoire.

## Audit des icônes

Toutes les icônes partagent la grille de 24 px, un trait de 1,75, des bouts et jonctions arrondis. La taille par défaut est 22 px ; les tailles explicites vont de 12 à 34 px. Le dégradé de marque (`#1EA7FF → #2F6BFF → #7B3FF2`) est réservé aux états actifs et aux boutons de recherche. Une icône de navigation inactive est en **trait dégradé** ; l'onglet actif utilise la variante **pleine en dégradé**.

### Navigation

| Icône | Usage | Variantes |
|---|---|---|
| `home` | Accueil, onglet de navigation | trait dégradé ; plein dégradé actif |
| `help` | Entraide : navigation, état vide | trait ; plein dégradé actif |
| `plus` | Ajouter : navigation, bouton « Poser ma question » | trait ; plein dégradé actif ; signe « + » couleur surface sur le cercle |
| `user` | Profil, connexion invitée | trait ; plein dégradé actif |
| `book` | Règles : navigation, en-tête, lien du Profil | trait ; plein dégradé actif |

### Actions et navigation secondaire

| Icône | Usage | Variantes |
|---|---|---|
| `search` | Barre de recherche, bouton loupe, état vide | trait ; trait dégradé sur le bouton loupe |
| `arrow` | Liens « voir tout », chevrons de cartes et d'étapes | trait |
| `back` | Bouton retour des en-têtes | trait |
| `chevron` | Réservée à la bibliothèque, aucun usage actuel | trait |
| `close` | Fermer une feuille, un filtre, un toast | trait |
| `menu` | Ouvrir le menu latéral | trait |
| `plus` | Voir « Poser ma question » | trait |
| `share` | Partager un projet ou une question | trait |
| `check` | Mission faite, réponse validée, lien copié | trait |
| `refresh` | Réessayer après une erreur réseau | trait |
| `external` | Ouvrir une preuve ou un dépôt hors de l'app | trait |
| `mail` | Connexion par email, confirmation d'envoi | trait |
| `github` | OAuth GitHub, dépôt d'un projet, étoiles | trait |
| `sun` / `moon` | Bascule de thème clair / sombre | trait |
| `ask` | Feuille « Ajouter » : poser une question | trait |

### Contenus, états et progression

| Icône | Usage | Variantes |
|---|---|---|
| `clock` | Historique de recherche, dernière activité d'un projet | trait |
| `wifi` | Hors-ligne, fonctionne hors-ligne, état réseau | trait |
| `code` | Technologies, spécialités, étapes de projet | trait |
| `trophy` | Niveaux et progression | trait |
| `star` | Étoiles GitHub, favoris | trait |
| `flame` | Série, missions, tutoriel | trait |
| `target` | Objectif de progression, tutoriel | trait |
| `lock` | Restriction invité, badge verrouillé | trait |
| `wallet` | Suggestion « Mobile Money » | trait |
| `box` | Suggestion « Gestion de stock » | trait |
| `shield` | Réserve de la bibliothèque, aucun usage actuel | trait |
| `calendar` | Réserve de la bibliothèque, aucun usage actuel | trait |
| `sparkles` | Réserve de la bibliothèque, aucun usage actuel | trait |
| `handshake` | Tutoriel, étapes, état vide et badges d'Entraide | trait |

### Variantes pleines

`FILLED_ICONS` contient `home`, `help`, `user`, `book` et `plus`. Elles sont peintes avec `url(#brand-gradient)`, sans trait. Le livre garde la même silhouette fermée en trait et en plein ; le « + » garde un signe couleur surface, lisible sur le dégradé dans les deux thèmes.

## Les commandes utiles
| Commande | Ce qu'elle fait |
|---|---|
| `npm install` | Télécharge les outils nécessaires (à faire une fois, ou après une mise à jour) |
| `npm run dev` | Lance le site en mode développement, il se met à jour tout seul |
| `npm test` | Lance les tests Vitest (recherche, routeur, Entraide, progression et effets visuels) |
| `npm run catalogue:build` | Régénère `supabase/catalogue_depart.sql` depuis `scripts/catalogue/repos.json` |
| `npm run build` | Prépare la version finale dans le dossier `dist` |
| `npm run preview` | Teste la version finale en local |

## Où se trouve quoi
```
bondev/
├── index.html        Page de départ
├── public/           Logo, icônes et manifest de l'application installable (PWA)
├── src/
│   ├── main.tsx      Démarre l'application et affiche l'écran d'erreur global
│   ├── App.tsx       Connexion, accueil, résultats, fiche projet, navigation et chargement des écrans
│   ├── screens/      Écrans lourds chargés à la demande (Entraide, Profil, Règles, Partage, Diagnostic)
│   ├── components/   Briques partagées (en-tête, boutons, bannière et restriction invité)
│   ├── lib/          Accès Supabase, recherche, routeur, partage, Entraide, progression, mode invité, GitHub, dates et effets visuels
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
