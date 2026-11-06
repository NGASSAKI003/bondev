-- =============================================================================
-- Bondev – Migration 0005 : mode invité (connexion anonyme Supabase)
-- À exécuter APRÈS 0004_stars.sql. Sans danger : on peut la relancer.
-- Un invité peut poser des questions, répondre et valider (c'est le cœur de la démo),
-- mais il ne peut PAS publier de projet ni marquer « Ça m'a servi » (anti-spam du catalogue).
-- Pour le jury : activer dans Supabase « Authentication, Sign In / Providers, Anonymous sign-ins ».
-- =============================================================================

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
  IF coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'Crée un compte GitHub pour publier un projet (le mode invité est en lecture et entraide seulement)';
  END IF;
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
  IF coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'Crée un compte GitHub pour dire « Ça m''a servi » (le mode invité est en lecture et entraide seulement)';
  END IF;

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

-- Les droits (EXECUTE) sont conservés par CREATE OR REPLACE ; on les réaffirme par sécurité.
REVOKE ALL ON FUNCTION
  public.publish_project(text, text, text, text, text[], text[]),
  public.mark_project_used(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.publish_project(text, text, text, text, text[], text[]),
  public.mark_project_used(uuid)
  TO authenticated;
