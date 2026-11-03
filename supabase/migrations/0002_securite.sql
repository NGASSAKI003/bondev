-- =============================================================================
-- Bondev – Migration 0002 : correctifs de sécurité
-- À exécuter APRÈS 0001_init.sql (et AVANT seed.sql).
-- Corrige : droits trop larges, fonctions sans search_path, doubles paiements
-- simultanés, points gagnés en boucle en publiant des projets bidon,
-- champs modifiables à la main (étoiles, « utile »), liens dangereux.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CONTRAINTES SUR LES DONNÉES (tailles et liens)
-- ─────────────────────────────────────────────────────────────────────────────
-- Les liens doivent commencer par https:// (évite les liens « javascript: »).
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_urls_valid CHECK (
    (avatar_url = '' OR avatar_url ~* '^https://')
    AND (github_url = '' OR github_url ~* '^https://')),
  ADD CONSTRAINT profiles_sizes CHECK (
    char_length(bio) <= 500 AND char_length(display_name) <= 80);

ALTER TABLE public.projects
  ADD CONSTRAINT projects_repo_valid CHECK (
    repo_url = '' OR repo_url ~ '^https://github\.com/[^/ ]+/[^/ ]+$'),
  ADD CONSTRAINT projects_sizes CHECK (
    char_length(description) <= 5000
    AND cardinality(technologies) <= 15
    AND cardinality(tags) <= 15);

-- Un même dépôt GitHub ne peut apparaître qu'une fois dans le catalogue.
CREATE UNIQUE INDEX uniq_projects_repo ON public.projects (lower(repo_url))
  WHERE repo_url <> '';

ALTER TABLE public.questions
  ADD CONSTRAINT questions_valid CHECK (
    (github_url = '' OR github_url ~* '^https://')
    AND char_length(body) <= 10000
    AND cardinality(technologies) <= 10);

ALTER TABLE public.answers
  ADD CONSTRAINT answers_valid CHECK (
    (proof_url = '' OR proof_url ~* '^https://')
    AND char_length(body) <= 10000);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. DROITS : le navigateur ne peut écrire QUE les colonnes prévues
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE ALL ON public.profiles, public.projects, public.project_uses,
              public.questions, public.answers, public.points_ledger
  FROM anon, authenticated;

GRANT SELECT ON public.profiles, public.projects, public.project_uses,
                public.questions, public.answers TO anon, authenticated;
GRANT SELECT ON public.points_ledger TO authenticated;   -- ses propres lignes (RLS)

-- Profil : création et modification de ses informations seulement
GRANT INSERT (id, pseudo, display_name, avatar_url, bio, github_url, lang)
  ON public.profiles TO authenticated;
GRANT UPDATE (pseudo, display_name, avatar_url, bio, github_url, lang)
  ON public.profiles TO authenticated;

-- Projet : modification du contenu seulement (pas les étoiles ni l'activité).
-- La création passe uniquement par publish_project().
GRANT UPDATE (title, description, repo_url, license, technologies, tags)
  ON public.projects TO authenticated;

-- Réponses : on écrit le texte et la preuve, jamais « utile » ni « visible ».
GRANT INSERT (question_id, author_id, body, proof_url) ON public.answers TO authenticated;
GRANT UPDATE (body, proof_url) ON public.answers TO authenticated;
GRANT DELETE ON public.answers TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. POLITIQUES RLS RENFORCÉES
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY projects_insert ON public.projects;
CREATE POLICY projects_insert ON public.projects FOR INSERT WITH CHECK (false);

-- On ne peut répondre qu'à une question encore ouverte.
DROP POLICY answers_insert ON public.answers;
CREATE POLICY answers_insert ON public.answers FOR INSERT WITH CHECK (
  auth.uid() = author_id
  AND EXISTS (SELECT 1 FROM public.questions q
               WHERE q.id = question_id AND q.status = 'open'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. FONCTIONS : search_path fixé, verrous, nouvelles règles
-- ─────────────────────────────────────────────────────────────────────────────
ALTER FUNCTION public.get_balance(uuid)        SET search_path = public, pg_temp;
ALTER FUNCTION public.get_total_earned(uuid)   SET search_path = public, pg_temp;
ALTER FUNCTION public.has_free_question(uuid)  SET search_path = public, pg_temp;
ALTER FUNCTION public.grant_signup_bonus()     SET search_path = public, pg_temp;

-- ── Publier une question (verrou : on ne peut pas dépenser deux fois) ───────
CREATE OR REPLACE FUNCTION public.post_question(
  p_title text, p_body text, p_technologies text[] DEFAULT '{}',
  p_tier int DEFAULT 1, p_github_url text DEFAULT '', p_beginner_ok boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_balance int;
  v_is_free boolean := false;
  v_question_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF p_tier NOT IN (1, 3, 6) THEN RAISE EXCEPTION 'Palier invalide : doit être 1, 3 ou 6'; END IF;

  -- Verrou sur le profil : deux publications simultanées passent l'une après l'autre
  PERFORM 1 FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profil introuvable'; END IF;

  IF (SELECT count(*) FROM public.questions WHERE author_id = v_uid AND status = 'open') >= 10 THEN
    RAISE EXCEPTION 'Maximum 10 questions ouvertes en même temps';
  END IF;

  v_balance := public.get_balance(v_uid);
  IF v_balance < p_tier THEN
    IF public.has_free_question(v_uid) AND p_tier = 1 THEN
      v_is_free := true;
    ELSE
      RAISE EXCEPTION 'Solde insuffisant (% points, palier %)', v_balance, p_tier;
    END IF;
  END IF;

  INSERT INTO public.questions (author_id, title, body, technologies, tier, github_url, beginner_ok, is_free)
  VALUES (v_uid, p_title, p_body, p_technologies, p_tier, p_github_url, p_beginner_ok, v_is_free)
  RETURNING id INTO v_question_id;

  IF v_is_free THEN
    INSERT INTO public.points_ledger (user_id, delta, reason, ref_id, description)
    VALUES (v_uid, 0, 'free_question', v_question_id, 'Question gratuite hebdomadaire');
  ELSE
    INSERT INTO public.points_ledger (user_id, delta, reason, ref_id, description)
    VALUES (v_uid, -p_tier, 'hold', v_question_id, format('Mise de côté pour question (palier %s)', p_tier));
  END IF;
  RETURN v_question_id;
END;
$$;

-- ── Valider une réponse (verrou sur la question : un seul paiement) ─────────
-- Question gratuite : l'aidant reçoit 1 point offert par la plateforme.
CREATE OR REPLACE FUNCTION public.validate_answer(p_answer_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_question_id uuid;
  v_question_author uuid;
  v_answer_author uuid;
  v_visible boolean;
  v_tier int;
  v_q_status public.question_status;
  v_validated uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;

  SELECT a.question_id, a.author_id, a.visible
    INTO v_question_id, v_answer_author, v_visible
    FROM public.answers a WHERE a.id = p_answer_id;
  IF v_question_id IS NULL THEN RAISE EXCEPTION 'Réponse introuvable'; END IF;

  -- FOR UPDATE : si deux validations arrivent en même temps, la 2e attend puis échoue
  SELECT q.author_id, q.tier, q.status, q.validated_answer_id
    INTO v_question_author, v_tier, v_q_status, v_validated
    FROM public.questions q WHERE q.id = v_question_id FOR UPDATE;

  IF v_uid <> v_question_author THEN RAISE EXCEPTION 'Seul l''auteur de la question peut valider une réponse'; END IF;
  IF v_uid = v_answer_author THEN RAISE EXCEPTION 'Impossible de valider sa propre réponse'; END IF;
  IF NOT v_visible THEN RAISE EXCEPTION 'Cette réponse est masquée'; END IF;
  IF v_q_status <> 'open' THEN RAISE EXCEPTION 'La question n''est plus ouverte (statut : %)', v_q_status; END IF;
  IF v_validated IS NOT NULL THEN RAISE EXCEPTION 'Une réponse a déjà été validée pour cette question'; END IF;

  UPDATE public.questions
     SET status = 'resolved', validated_answer_id = p_answer_id, updated_at = now()
   WHERE id = v_question_id;
  UPDATE public.answers SET is_useful = true, updated_at = now() WHERE id = p_answer_id;

  INSERT INTO public.points_ledger (user_id, delta, reason, ref_id, description)
  VALUES (v_answer_author, v_tier, 'reward', v_question_id, format('Réponse validée (palier %s)', v_tier));
END;
$$;

-- ── Retirer sa question (verrou) ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.withdraw_question(p_question_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_author uuid; v_tier int; v_status public.question_status; v_is_free boolean; v_validated uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;

  SELECT q.author_id, q.tier, q.status, q.is_free, q.validated_answer_id
    INTO v_author, v_tier, v_status, v_is_free, v_validated
    FROM public.questions q WHERE q.id = p_question_id FOR UPDATE;

  IF v_author IS NULL THEN RAISE EXCEPTION 'Question introuvable'; END IF;
  IF v_uid <> v_author THEN RAISE EXCEPTION 'Seul l''auteur peut retirer sa question'; END IF;
  IF v_validated IS NOT NULL THEN RAISE EXCEPTION 'Impossible de retirer une question avec une réponse validée'; END IF;
  IF v_status <> 'open' THEN RAISE EXCEPTION 'La question n''est plus ouverte (statut : %)', v_status; END IF;

  UPDATE public.questions SET status = 'withdrawn', updated_at = now() WHERE id = p_question_id;
  IF NOT v_is_free THEN
    INSERT INTO public.points_ledger (user_id, delta, reason, ref_id, description)
    VALUES (v_uid, v_tier, 'refund', p_question_id, 'Remboursement : question retirée');
  END IF;
END;
$$;

-- ── Expiration (réservée à la tâche planifiée, jamais aux utilisateurs) ─────
CREATE OR REPLACE FUNCTION public.expire_questions()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_row record; v_count int := 0;
BEGIN
  FOR v_row IN
    SELECT id, author_id, tier, is_free FROM public.questions
     WHERE status = 'open' AND expires_at <= now()
       FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.questions SET status = 'expired', updated_at = now() WHERE id = v_row.id;
    IF NOT v_row.is_free THEN
      INSERT INTO public.points_ledger (user_id, delta, reason, ref_id, description)
      VALUES (v_row.author_id, v_row.tier, 'refund', v_row.id, 'Remboursement : question expirée (7 jours)');
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- ── Publier un projet : lien GitHub obligatoire, pas de doublon, +3 points ──
-- pour les 5 premiers projets seulement (anti-abus : plus de points en boucle).
CREATE OR REPLACE FUNCTION public.publish_project(
  p_title text, p_description text DEFAULT '', p_repo_url text DEFAULT '',
  p_license text DEFAULT 'MIT', p_technologies text[] DEFAULT '{}', p_tags text[] DEFAULT '{}')
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_repo text := regexp_replace(trim(coalesce(p_repo_url, '')), '/+$', '');
  v_project_id uuid;
  v_rewarded int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF v_repo !~ '^https://github\.com/[^/ ]+/[^/ ]+$' THEN
    RAISE EXCEPTION 'Lien GitHub invalide : utilise https://github.com/pseudo/depot';
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profil introuvable'; END IF;

  IF EXISTS (SELECT 1 FROM public.projects WHERE lower(repo_url) = lower(v_repo)) THEN
    RAISE EXCEPTION 'Ce dépôt est déjà dans le catalogue';
  END IF;

  INSERT INTO public.projects (author_id, title, description, repo_url, license, technologies, tags)
  VALUES (v_uid, p_title, p_description, v_repo, p_license, p_technologies, p_tags)
  RETURNING id INTO v_project_id;

  SELECT count(*) INTO v_rewarded FROM public.points_ledger
   WHERE user_id = v_uid AND reason = 'project_publish';
  IF v_rewarded < 5 THEN
    INSERT INTO public.points_ledger (user_id, delta, reason, ref_id, description)
    VALUES (v_uid, 3, 'project_publish', v_project_id, 'Publication d''un projet');
  END IF;
  RETURN v_project_id;
END;
$$;

-- ── « Ça m'a servi » (verrou sur le projet : le plafond hebdo est exact) ────
CREATE OR REPLACE FUNCTION public.mark_project_used(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_author uuid;
  v_week_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;

  SELECT author_id INTO v_author FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF v_author IS NULL THEN RAISE EXCEPTION 'Projet introuvable'; END IF;
  IF v_uid = v_author THEN RAISE EXCEPTION 'Impossible de marquer son propre projet comme utile'; END IF;

  IF EXISTS (SELECT 1 FROM public.project_uses WHERE user_id = v_uid AND project_id = p_project_id) THEN
    RAISE EXCEPTION 'Tu as déjà marqué ce projet comme utile';
  END IF;

  SELECT COUNT(*) INTO v_week_count FROM public.project_uses
   WHERE project_id = p_project_id AND created_at >= date_trunc('week', now());
  IF v_week_count >= 10 THEN
    RAISE EXCEPTION 'Ce projet a atteint le plafond de « ça m''a servi » cette semaine';
  END IF;

  INSERT INTO public.project_uses (project_id, user_id) VALUES (p_project_id, v_uid);
  INSERT INTO public.points_ledger (user_id, delta, reason, ref_id, description)
  VALUES (v_author, 1, 'project_used', p_project_id, 'Un utilisateur a trouvé le projet utile');
  UPDATE public.projects SET stars = stars + 1, last_activity = now() WHERE id = p_project_id;
END;
$$;

-- ── Pour l'écran « Poser une question » : la question gratuite est-elle dispo ?
CREATE OR REPLACE FUNCTION public.my_free_question_available()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT auth.uid() IS NOT NULL AND public.has_free_question(auth.uid()); $$;

-- ── Vue profile_stats : le solde n'est visible que par son propriétaire ─────
CREATE OR REPLACE VIEW public.profile_stats AS
SELECT
  p.id, p.pseudo, p.display_name, p.avatar_url,
  CASE WHEN p.id = auth.uid() THEN public.get_balance(p.id) END AS balance,
  public.get_total_earned(p.id) AS total_earned,
  public.level_for(public.get_total_earned(p.id)) AS level
FROM public.profiles p;

REVOKE ALL ON public.profile_stats FROM anon, authenticated;
GRANT SELECT ON public.profile_stats TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. QUI A LE DROIT D'APPELER QUOI
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION
  public.get_balance(uuid), public.get_total_earned(uuid), public.has_free_question(uuid),
  public.grant_signup_bonus(), public.expire_questions(),
  public.post_question(text, text, text[], int, text, boolean),
  public.validate_answer(uuid), public.withdraw_question(uuid),
  public.publish_project(text, text, text, text, text[], text[]),
  public.mark_project_used(uuid), public.my_free_question_available()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.post_question(text, text, text[], int, text, boolean),
  public.validate_answer(uuid), public.withdraw_question(uuid),
  public.publish_project(text, text, text, text, text[], text[]),
  public.mark_project_used(uuid), public.my_free_question_available()
  TO authenticated;
-- level_for() et set_updated_at() sont inoffensives : on les laisse telles quelles.
