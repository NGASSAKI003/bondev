-- =============================================================================
-- Bondev – Migration initiale
-- Plateforme d'entraide pour développeurs africains
-- =============================================================================
-- Exécuter dans l'éditeur SQL de Supabase (ou via supabase db push).
-- Toutes les opérations sur les points passent par des fonctions SECURITY DEFINER.
-- Le client (navigateur) n'écrit JAMAIS directement dans points_ledger.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Profils utilisateurs ────────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pseudo      text UNIQUE NOT NULL
                   CONSTRAINT pseudo_format CHECK (pseudo ~ '^[a-zA-Z0-9_\-]{3,30}$'),
  display_name text NOT NULL DEFAULT '',
  avatar_url  text DEFAULT '',
  bio         text DEFAULT '',
  github_url  text DEFAULT '',
  lang        text NOT NULL DEFAULT 'fr'
                   CONSTRAINT lang_valid CHECK (lang IN ('fr', 'en')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Profil public de chaque utilisateur, lié à auth.users.';

-- ── Projets (catalogue) ─────────────────────────────────────────────────────
CREATE TABLE public.projects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title         text NOT NULL CONSTRAINT title_length CHECK (char_length(title) BETWEEN 5 AND 200),
  description   text NOT NULL DEFAULT '',
  repo_url      text DEFAULT '',
  license       text DEFAULT 'MIT',
  technologies  text[] NOT NULL DEFAULT '{}',  -- ex. {'React', 'Node.js'}
  tags          text[] NOT NULL DEFAULT '{}',  -- ex. {'Mobile Money', 'USSD', 'hors-ligne'}
  stars         int  NOT NULL DEFAULT 0 CHECK (stars >= 0),
  last_activity timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.projects IS 'Catalogue de projets open source partagés par la communauté.';

-- ── « Ça m'a servi » (project_uses) ────────────────────────────────────────
CREATE TABLE public.project_uses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- Un seul « ça m'a servi » par utilisateur et par projet
  CONSTRAINT one_use_per_user_project UNIQUE (user_id, project_id)
);

COMMENT ON TABLE public.project_uses IS 'Quand un utilisateur indique qu''un projet lui a été utile.';

-- ── Questions (entraide) ────────────────────────────────────────────────────
CREATE TYPE public.question_status AS ENUM ('open', 'resolved', 'expired', 'withdrawn');

CREATE TABLE public.questions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           text NOT NULL CONSTRAINT q_title_length CHECK (char_length(title) BETWEEN 5 AND 300),
  body            text NOT NULL DEFAULT '',
  technologies    text[] NOT NULL DEFAULT '{}',
  tier            int  NOT NULL CHECK (tier IN (1, 3, 6)),
  github_url      text DEFAULT '',
  beginner_ok     boolean NOT NULL DEFAULT false,
  status          public.question_status NOT NULL DEFAULT 'open',
  is_free         boolean NOT NULL DEFAULT false,  -- question gratuite de la semaine
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  validated_answer_id uuid DEFAULT NULL,  -- rempli quand une réponse est validée
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.questions IS 'Questions d''entraide avec mise en jeu de points.';

-- ── Réponses ────────────────────────────────────────────────────────────────
CREATE TABLE public.answers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id   uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  author_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body          text NOT NULL DEFAULT '',
  proof_url     text DEFAULT '',
  visible       boolean NOT NULL DEFAULT true,
  is_useful     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.answers IS 'Réponses aux questions d''entraide.';

-- ── Registre des points ─────────────────────────────────────────────────────
-- AJOUT SEULEMENT : jamais d'UPDATE ni de DELETE.
-- Solde = somme de tous les deltas pour un utilisateur.
-- Total gagné = somme des deltas positifs HORS remboursements.
CREATE TYPE public.point_reason AS ENUM (
  'signup',           -- inscription : +5
  'hold',             -- mise de côté pour une question (négatif)
  'reward',           -- cagnotte versée à l'aidant
  'refund',           -- remboursement (expiration ou retrait)
  'project_publish',  -- publication d'un projet : +3
  'project_used',     -- « ça m'a servi » : +1 à l'auteur du projet
  'free_question'     -- question gratuite (tier=1, delta=0, marqueur seulement)
);

CREATE TABLE public.points_ledger (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delta       int  NOT NULL,  -- positif = gain, négatif = dépense/hold
  reason      public.point_reason NOT NULL,
  ref_id      uuid DEFAULT NULL,  -- référence (question_id, project_id, answer_id…)
  description text DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.points_ledger IS
  'Registre immuable des mouvements de points. Append-only : jamais UPDATE ni DELETE.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. INDEX UTILES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX idx_projects_author     ON public.projects(author_id);
CREATE INDEX idx_projects_tags       ON public.projects USING GIN(tags);
CREATE INDEX idx_projects_techs      ON public.projects USING GIN(technologies);
CREATE INDEX idx_questions_author    ON public.questions(author_id);
CREATE INDEX idx_questions_status    ON public.questions(status);
CREATE INDEX idx_questions_expires   ON public.questions(expires_at) WHERE status = 'open';
CREATE INDEX idx_answers_question    ON public.answers(question_id);
CREATE INDEX idx_answers_author      ON public.answers(author_id);
CREATE INDEX idx_ledger_user         ON public.points_ledger(user_id);
CREATE INDEX idx_ledger_ref          ON public.points_ledger(ref_id);
CREATE INDEX idx_project_uses_project ON public.project_uses(project_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. FONCTIONS UTILITAIRES
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Solde d'un utilisateur ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_balance(p_user_id uuid)
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(SUM(delta), 0)::int
  FROM public.points_ledger
  WHERE user_id = p_user_id;
$$;

COMMENT ON FUNCTION public.get_balance IS 'Retourne le solde courant (somme de tous les deltas).';

-- ── Total gagné (ne baisse jamais) ──────────────────────────────────────────
-- = somme des deltas > 0 dont la raison N'EST PAS un remboursement
CREATE OR REPLACE FUNCTION public.get_total_earned(p_user_id uuid)
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(SUM(delta), 0)::int
  FROM public.points_ledger
  WHERE user_id = p_user_id
    AND delta > 0
    AND reason NOT IN ('refund');
$$;

COMMENT ON FUNCTION public.get_total_earned IS
  'Total gagné = gains réels (aide, projets, bonus), sans les remboursements. Ne baisse jamais.';

-- ── Niveau selon le total gagné ─────────────────────────────────────────────
-- Étincelle 0, Explorateur 10, Bâtisseur 30, Mentor 70, Maître 150, Légende 300
CREATE OR REPLACE FUNCTION public.level_for(p_total_earned int)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_total_earned >= 300 THEN 'Légende'
    WHEN p_total_earned >= 150 THEN 'Maître'
    WHEN p_total_earned >=  70 THEN 'Mentor'
    WHEN p_total_earned >=  30 THEN 'Bâtisseur'
    WHEN p_total_earned >=  10 THEN 'Explorateur'
    ELSE 'Étincelle'
  END;
$$;

COMMENT ON FUNCTION public.level_for IS
  'Retourne le nom du niveau selon le total de points gagnés.';

-- ── Question gratuite disponible cette semaine ? ────────────────────────────
CREATE OR REPLACE FUNCTION public.has_free_question(p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.points_ledger
    WHERE user_id = p_user_id
      AND reason = 'free_question'
      AND created_at >= date_trunc('week', now())
  );
$$;

COMMENT ON FUNCTION public.has_free_question IS
  '1 question gratuite par semaine. Retourne true si pas encore utilisée cette semaine.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. FONCTIONS SECURITY DEFINER (les seules voies pour modifier les points)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 4a. Inscription : +5 points de départ ───────────────────────────────────
-- Appelée automatiquement par le trigger after INSERT on profiles.
CREATE OR REPLACE FUNCTION public.grant_signup_bonus()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.points_ledger (user_id, delta, reason, description)
  VALUES (NEW.id, 5, 'signup', 'Bonus d''inscription');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_signup_bonus
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_signup_bonus();

-- ── 4b. Publier une question ────────────────────────────────────────────────
-- Déduit les points (hold) ou utilise la question gratuite.
CREATE OR REPLACE FUNCTION public.post_question(
  p_title       text,
  p_body        text,
  p_technologies text[] DEFAULT '{}',
  p_tier        int     DEFAULT 1,
  p_github_url  text    DEFAULT '',
  p_beginner_ok boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_balance  int;
  v_free     boolean;
  v_is_free  boolean := false;
  v_question_id uuid;
BEGIN
  -- Vérifier l'authentification
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  -- Vérifier que le palier est valide
  IF p_tier NOT IN (1, 3, 6) THEN
    RAISE EXCEPTION 'Palier invalide : doit être 1, 3 ou 6';
  END IF;

  -- Vérifier le solde
  v_balance := public.get_balance(v_uid);
  v_free    := public.has_free_question(v_uid);

  IF v_balance < p_tier THEN
    -- Pas assez de points : vérifier si la question gratuite est disponible
    IF v_free AND p_tier = 1 THEN
      v_is_free := true;
    ELSE
      RAISE EXCEPTION 'Solde insuffisant (% points, palier %)', v_balance, p_tier;
    END IF;
  END IF;

  -- Utiliser la question gratuite même si le solde suffit, quand demandée
  -- (on laisse le choix au front de l'appeler avec tier=1 et solde >= 1)
  -- Non : la question gratuite n'est utilisée que si le solde est insuffisant.

  -- Créer la question
  INSERT INTO public.questions (author_id, title, body, technologies, tier, github_url, beginner_ok, is_free)
  VALUES (v_uid, p_title, p_body, p_technologies, p_tier, p_github_url, p_beginner_ok, v_is_free)
  RETURNING id INTO v_question_id;

  -- Écriture dans le registre des points
  IF v_is_free THEN
    -- Question gratuite : marquer l'utilisation, pas de déduction
    INSERT INTO public.points_ledger (user_id, delta, reason, ref_id, description)
    VALUES (v_uid, 0, 'free_question', v_question_id, 'Question gratuite hebdomadaire');
  ELSE
    -- Hold : les points sont mis de côté
    INSERT INTO public.points_ledger (user_id, delta, reason, ref_id, description)
    VALUES (v_uid, -p_tier, 'hold', v_question_id,
            format('Mise de côté pour question (palier %s)', p_tier));
  END IF;

  RETURN v_question_id;
END;
$$;

COMMENT ON FUNCTION public.post_question IS
  'Publie une question et déduit les points (hold) ou utilise la question gratuite hebdomadaire.';

-- ── 4c. Valider une réponse ─────────────────────────────────────────────────
-- Seul l'auteur de la question peut valider. Jamais sa propre réponse.
-- Une seule validation par question. La cagnotte va à l'auteur de la réponse.
CREATE OR REPLACE FUNCTION public.validate_answer(p_answer_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_uid           uuid := auth.uid();
  v_question_id   uuid;
  v_question_author uuid;
  v_answer_author uuid;
  v_tier          int;
  v_q_status      public.question_status;
  v_is_free       boolean;
  v_validated     uuid;
BEGIN
  -- Vérifier l'authentification
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  -- Récupérer la réponse et la question liée
  SELECT a.question_id, a.author_id
    INTO v_question_id, v_answer_author
    FROM public.answers a
   WHERE a.id = p_answer_id;

  IF v_question_id IS NULL THEN
    RAISE EXCEPTION 'Réponse introuvable';
  END IF;

  SELECT q.author_id, q.tier, q.status, q.is_free, q.validated_answer_id
    INTO v_question_author, v_tier, v_q_status, v_is_free, v_validated
    FROM public.questions q
   WHERE q.id = v_question_id;

  -- Seul l'auteur de la question peut valider
  IF v_uid <> v_question_author THEN
    RAISE EXCEPTION 'Seul l''auteur de la question peut valider une réponse';
  END IF;

  -- Impossible de valider sa propre réponse
  IF v_uid = v_answer_author THEN
    RAISE EXCEPTION 'Impossible de valider sa propre réponse';
  END IF;

  -- La question doit être ouverte
  IF v_q_status <> 'open' THEN
    RAISE EXCEPTION 'La question n''est plus ouverte (statut : %)', v_q_status;
  END IF;

  -- Vérifier qu'il n'y a pas déjà une réponse validée (double paiement)
  IF v_validated IS NOT NULL THEN
    RAISE EXCEPTION 'Une réponse a déjà été validée pour cette question';
  END IF;

  -- Marquer la question comme résolue
  UPDATE public.questions
     SET status = 'resolved',
         validated_answer_id = p_answer_id,
         updated_at = now()
   WHERE id = v_question_id;

  -- Marquer la réponse comme utile
  UPDATE public.answers
     SET is_useful = true,
         updated_at = now()
   WHERE id = p_answer_id;

  -- Verser la cagnotte à l'auteur de la réponse (sauf question gratuite)
  IF NOT v_is_free THEN
    INSERT INTO public.points_ledger (user_id, delta, reason, ref_id, description)
    VALUES (v_answer_author, v_tier, 'reward', v_question_id,
            format('Réponse validée (palier %s)', v_tier));
  END IF;
END;
$$;

COMMENT ON FUNCTION public.validate_answer IS
  'L''auteur de la question valide une réponse : cagnotte versée, question résolue.';

-- ── 4d. Retirer sa question ─────────────────────────────────────────────────
-- Possible tant qu'aucune réponse n'a été validée. Points remboursés.
CREATE OR REPLACE FUNCTION public.withdraw_question(p_question_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_uid           uuid := auth.uid();
  v_question_author uuid;
  v_tier          int;
  v_q_status      public.question_status;
  v_is_free       boolean;
  v_validated     uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  SELECT q.author_id, q.tier, q.status, q.is_free, q.validated_answer_id
    INTO v_question_author, v_tier, v_q_status, v_is_free, v_validated
    FROM public.questions q
   WHERE q.id = p_question_id;

  IF v_question_author IS NULL THEN
    RAISE EXCEPTION 'Question introuvable';
  END IF;

  IF v_uid <> v_question_author THEN
    RAISE EXCEPTION 'Seul l''auteur peut retirer sa question';
  END IF;

  IF v_validated IS NOT NULL THEN
    RAISE EXCEPTION 'Impossible de retirer une question avec une réponse validée';
  END IF;

  IF v_q_status <> 'open' THEN
    RAISE EXCEPTION 'La question n''est plus ouverte (statut : %)', v_q_status;
  END IF;

  -- Passer en withdrawn
  UPDATE public.questions
     SET status = 'withdrawn',
         updated_at = now()
   WHERE id = p_question_id;

  -- Rembourser les points (sauf question gratuite)
  IF NOT v_is_free THEN
    INSERT INTO public.points_ledger (user_id, delta, reason, ref_id, description)
    VALUES (v_uid, v_tier, 'refund', p_question_id, 'Remboursement : question retirée');
  END IF;
END;
$$;

COMMENT ON FUNCTION public.withdraw_question IS
  'L''auteur retire sa question (si pas encore de réponse validée). Points remboursés.';

-- ── 4e. Expiration des questions ────────────────────────────────────────────
-- À appeler par pg_cron ou une Edge Function toutes les heures.
-- Voir docs/DATABASE.md pour la configuration.
CREATE OR REPLACE FUNCTION public.expire_questions()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_row    record;
  v_count  int := 0;
BEGIN
  FOR v_row IN
    SELECT id, author_id, tier, is_free
      FROM public.questions
     WHERE status = 'open'
       AND expires_at <= now()
  LOOP
    -- Passer en expired
    UPDATE public.questions
       SET status = 'expired',
           updated_at = now()
     WHERE id = v_row.id;

    -- Rembourser (sauf question gratuite)
    IF NOT v_row.is_free THEN
      INSERT INTO public.points_ledger (user_id, delta, reason, ref_id, description)
      VALUES (v_row.author_id, v_row.tier, 'refund', v_row.id,
              'Remboursement : question expirée (7 jours)');
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.expire_questions IS
  'Expire les questions ouvertes depuis plus de 7 jours et rembourse les points.
   À appeler via pg_cron (SELECT cron.schedule(''expire-questions'', ''0 * * * *'', $$SELECT public.expire_questions()$$);)
   ou via une Supabase Edge Function appelée par un cron externe.';

-- ── 4f. Publier un projet ───────────────────────────────────────────────────
-- +3 points (une seule fois, vérification par ref_id).
CREATE OR REPLACE FUNCTION public.publish_project(
  p_title        text,
  p_description  text    DEFAULT '',
  p_repo_url     text    DEFAULT '',
  p_license      text    DEFAULT 'MIT',
  p_technologies text[]  DEFAULT '{}',
  p_tags         text[]  DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_project_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  -- Créer le projet
  INSERT INTO public.projects (author_id, title, description, repo_url, license, technologies, tags)
  VALUES (v_uid, p_title, p_description, p_repo_url, p_license, p_technologies, p_tags)
  RETURNING id INTO v_project_id;

  -- +3 points pour la publication
  INSERT INTO public.points_ledger (user_id, delta, reason, ref_id, description)
  VALUES (v_uid, 3, 'project_publish', v_project_id, 'Publication d''un projet');

  RETURN v_project_id;
END;
$$;

COMMENT ON FUNCTION public.publish_project IS
  'Publie un projet et accorde +3 points à l''auteur.';

-- ── 4g. Marquer « Ça m'a servi » ───────────────────────────────────────────
-- +1 point à l'auteur du projet. Un seul par utilisateur/projet.
-- Plafonné à 10 « ça m'a servi » par semaine et par projet.
-- Un utilisateur ne peut pas se faire payer pour son propre projet.
CREATE OR REPLACE FUNCTION public.mark_project_used(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_project_author uuid;
  v_week_count   int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  -- Vérifier que le projet existe et récupérer l'auteur
  SELECT author_id INTO v_project_author
    FROM public.projects
   WHERE id = p_project_id;

  IF v_project_author IS NULL THEN
    RAISE EXCEPTION 'Projet introuvable';
  END IF;

  -- Interdire de marquer son propre projet
  IF v_uid = v_project_author THEN
    RAISE EXCEPTION 'Impossible de marquer son propre projet comme utile';
  END IF;

  -- Vérifier l'unicité (la contrainte UNIQUE le fera aussi, mais message plus clair)
  IF EXISTS (
    SELECT 1 FROM public.project_uses
     WHERE user_id = v_uid AND project_id = p_project_id
  ) THEN
    RAISE EXCEPTION 'Tu as déjà marqué ce projet comme utile';
  END IF;

  -- Vérifier le plafond hebdomadaire par projet (max 10 par semaine)
  SELECT COUNT(*) INTO v_week_count
    FROM public.project_uses
   WHERE project_id = p_project_id
     AND created_at >= date_trunc('week', now());

  IF v_week_count >= 10 THEN
    RAISE EXCEPTION 'Ce projet a atteint le plafond de « ça m''a servi » cette semaine';
  END IF;

  -- Enregistrer l'utilisation
  INSERT INTO public.project_uses (project_id, user_id)
  VALUES (p_project_id, v_uid);

  -- +1 point à l'auteur du projet
  INSERT INTO public.points_ledger (user_id, delta, reason, ref_id, description)
  VALUES (v_project_author, 1, 'project_used', p_project_id,
          'Un utilisateur a trouvé le projet utile');

  -- Incrémenter le compteur d'étoiles
  UPDATE public.projects
     SET stars = stars + 1,
         last_activity = now()
   WHERE id = p_project_id;
END;
$$;

COMMENT ON FUNCTION public.mark_project_used IS
  '« Ça m''a servi » : +1 point à l''auteur du projet. Un seul par utilisateur/projet, plafonné par semaine.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. VUE profile_stats
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.profile_stats AS
SELECT
  p.id,
  p.pseudo,
  p.display_name,
  p.avatar_url,
  public.get_balance(p.id)      AS balance,
  public.get_total_earned(p.id) AS total_earned,
  public.level_for(public.get_total_earned(p.id)) AS level
FROM public.profiles p;

COMMENT ON VIEW public.profile_stats IS
  'Vue combinant profil, solde, total gagné et niveau. Lecture seule.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. TRIGGER updated_at automatique
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_questions_updated_at BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_answers_updated_at BEFORE UPDATE ON public.answers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RLS (Row Level Security)
-- ─────────────────────────────────────────────────────────────────────────────

-- Activer la RLS sur toutes les tables
ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_uses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;

-- ── profiles ────────────────────────────────────────────────────────────────
-- Lecture publique
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT USING (true);
-- Insertion : seulement son propre profil
CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
-- Mise à jour : seulement son propre profil
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ── projects ────────────────────────────────────────────────────────────────
-- Lecture publique
CREATE POLICY projects_select ON public.projects
  FOR SELECT USING (true);
-- Insertion : via publish_project (SECURITY DEFINER), mais on autorise aussi
-- la politique pour que la fonction puisse insérer
CREATE POLICY projects_insert ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = author_id);
-- Mise à jour : seulement l'auteur
CREATE POLICY projects_update ON public.projects
  FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

-- ── project_uses ────────────────────────────────────────────────────────────
-- Lecture publique
CREATE POLICY project_uses_select ON public.project_uses
  FOR SELECT USING (true);
-- Insertion : via mark_project_used (SECURITY DEFINER)
-- On bloque l'insertion directe (seule la fonction SECURITY DEFINER peut écrire)
CREATE POLICY project_uses_insert ON public.project_uses
  FOR INSERT WITH CHECK (false);

-- ── questions ───────────────────────────────────────────────────────────────
-- Lecture publique
CREATE POLICY questions_select ON public.questions
  FOR SELECT USING (true);
-- Insertion : via post_question (SECURITY DEFINER)
CREATE POLICY questions_insert ON public.questions
  FOR INSERT WITH CHECK (false);
-- Mise à jour : via validate_answer / withdraw_question / expire_questions
CREATE POLICY questions_update ON public.questions
  FOR UPDATE USING (false);

-- ── answers ─────────────────────────────────────────────────────────────────
-- Lecture : réponses visibles ou propres réponses
CREATE POLICY answers_select ON public.answers
  FOR SELECT USING (visible = true OR auth.uid() = author_id);
-- Insertion : tout utilisateur authentifié peut répondre
CREATE POLICY answers_insert ON public.answers
  FOR INSERT WITH CHECK (auth.uid() = author_id);
-- Mise à jour : seulement l'auteur et si pas encore validée
CREATE POLICY answers_update ON public.answers
  FOR UPDATE USING (
    auth.uid() = author_id
    AND NOT EXISTS (
      SELECT 1 FROM public.questions q
       WHERE q.validated_answer_id = answers.id
    )
  );
-- Suppression : seulement l'auteur et si pas encore validée
CREATE POLICY answers_delete ON public.answers
  FOR DELETE USING (
    auth.uid() = author_id
    AND NOT EXISTS (
      SELECT 1 FROM public.questions q
       WHERE q.validated_answer_id = answers.id
    )
  );

-- ── points_ledger ───────────────────────────────────────────────────────────
-- Lecture : seulement ses propres écritures
CREATE POLICY ledger_select ON public.points_ledger
  FOR SELECT USING (auth.uid() = user_id);
-- Aucune écriture directe depuis le client. Les fonctions SECURITY DEFINER
-- s'exécutent en tant que propriétaire de la base et contournent la RLS.
CREATE POLICY ledger_insert ON public.points_ledger
  FOR INSERT WITH CHECK (false);
CREATE POLICY ledger_update ON public.points_ledger
  FOR UPDATE USING (false);
CREATE POLICY ledger_delete ON public.points_ledger
  FOR DELETE USING (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- FIN DE LA MIGRATION
-- ─────────────────────────────────────────────────────────────────────────────
