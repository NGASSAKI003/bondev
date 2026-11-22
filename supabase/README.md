# Supabase — Bondev

Tout le schéma, les politiques RLS et les fonctions métier de Bondev vivent
dans ce dossier. Le front ne fait jamais d'écriture directe dans
`points_ledger` : les opérations sensibles passent par des RPC
`SECURITY DEFINER`.

## Ordre d'installation

Exécute les fichiers **dans cet ordre** dans l'éditeur SQL Supabase (rôle
`postgres`) ou avec la CLI Supabase :

| Ordre | Fichier | Contenu |
| --- | --- | --- |
| 1 | `migrations/0001_init.sql` | Tables, vues, fonctions de points, RLS, triggers. |
| 2 | `migrations/0002_securite.sql` | Durcissement des droits, contraintes et RPC. |
| 3 | `migrations/0003_stats.sql` | Correction de `profile_stats` et du solde privé. |
| 4 | `migrations/0004_stars.sql` | Étoiles GitHub séparées des usages Bondev. |
| 5 | `migrations/0005_invites.sql` | Restrictions du mode invité. |
| 6 | `catalogue_depart.sql` | Catalogue initial (compte « Équipe Bondev »). |
| 7 | `seed.sql` | Données d'exemple, uniquement pour le développement. |

```bash
# Avec la CLI Supabase, sur un projet de test
supabase db push

# Les fichiers catalogue_depart.sql et seed.sql restent des scripts manuels.
```

> [!IMPORTANT]
> Les migrations sont **immuables** : ne modifie jamais un fichier déjà
> appliqué. Ajoute une nouvelle migration numérotée. Le dépôt ne contient
> volontairement aucun script destructif.

## Configuration Supabase

1. Crée un projet sur [supabase.com](https://supabase.com).
2. Récupère l'URL et la clé **publishable** (`anon`) dans
   **Project Settings → API**.
3. Renseigne `.env.local` à la racine du dépôt :

   ```env
   VITE_SUPABASE_URL=https://ton-projet.supabase.co
   VITE_SUPABASE_ANON_KEY=ta-cle-publishable
   ```

4. Active les fournisseurs voulus dans **Authentication → Providers** :
   GitHub est le parcours principal ; Google et l'email sont optionnels
   (`VITE_ENABLE_GOOGLE=true`, `VITE_ENABLE_EMAIL=true`).
5. Active **Anonymous sign-ins** pour le bouton « Essayer sans compte ».
6. Ajoute les URL de redirection :
   - `http://localhost:5173`
   - `http://127.0.0.1:5173`
   - l'URL de production, par exemple
     `https://bondev.ngassakindzaa.workers.dev`

> [!CAUTION]
> N'utilise jamais la clé `service_role` dans `.env.local`, dans le front ou
> dans une GitHub Action de ce dépôt. Elle contourne toute la RLS.

## Modèle de données

- `profiles` : profil public lié à `auth.users`.
- `projects` : catalogue open source.
- `project_uses` : un « Ça m'a servi » par utilisateur et par projet.
- `questions` : questions avec palier (1, 3 ou 6 points), expiration à 7 jours
  et statut (`open`, `resolved`, `expired`, `withdrawn`).
- `answers` : réponses, preuve GitHub facultative, validation unique.
- `points_ledger` : registre en ajout seulement. Le solde est la somme des
  `delta` ; aucune ligne n'est modifiée ni supprimée.
- `profile_stats` (vue) : total gagné public, niveau, et solde visible
  uniquement par son propriétaire.

Le détail pédagogique des tables, des points et des niveaux est dans
[`docs/DATABASE.md`](../docs/DATABASE.md).

## Fonctions principales

| Fonction | Rôle |
| --- | --- |
| `post_question(...)` | Débite le palier (ou la question gratuite) et crée la question. |
| `validate_answer(answer_id)` | Verse la cagnotte à l'auteur de la réponse validée. |
| `withdraw_question(question_id)` | Retire une question et rembourse les points. |
| `expire_questions()` | Expire les questions ouvertes depuis plus de 7 jours. |
| `publish_project(...)` | Publie un projet et récompense l'auteur (+3, cinq fois). |
| `mark_project_used(project_id)` | Crédite l'auteur d'un projet utile (+1, plafonné). |
| `get_balance`, `get_total_earned`, `level_for` | Lecture des compteurs et du niveau. |

Les comptes anonymes peuvent poser des questions, répondre et valider. Ils ne
peuvent pas publier de projet ni marquer « Ça m'a servi » : la restriction est
appliquée à la fois par l'interface et par `0005_invites.sql`.

## Expiration automatique

`expire_questions()` doit être appelée régulièrement. Deux options :

```sql
-- pg_cron (plan Pro)
SELECT cron.schedule(
  'expire-questions',
  '0 * * * *',
  $$SELECT public.expire_questions()$$
);
```

Ou une Edge Function / un cron externe qui appelle la RPC toutes les heures.
Sans cette tâche, les questions restent `open` au-delà de 7 jours.

## Tests SQL

Les fichiers de `tests/` vérifient les règles métier et la RLS sur un projet
de test :

| Fichier | Vérifie |
| --- | --- |
| `tests/rules.sql` | Points, paliers, validation, retrait, expiration. |
| `tests/rules_securite.sql` | RLS, droits des RPC et refus des accès interdits. |
| `tests/menage.sql` | Nettoie les données créées par les tests. |

Exécute-les dans un projet Supabase **de test**, jamais en production. Ils
créent puis suppriment leurs propres données.

## Keepalive

Le workflow `.github/workflows/keepalive.yml` lit une ligne publique toutes les
72 heures environ. Configure les secrets GitHub suivants :

| Secret | Valeur |
| --- | --- |
| `SUPABASE_URL` | URL du projet, sans slash final. |
| `SUPABASE_ANON_KEY` | Clé publishable (`anon`). |

Le ping est en lecture seule et ne consomme pas de points.
