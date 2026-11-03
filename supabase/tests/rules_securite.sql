-- =============================================================================
-- Bondev – Tests de sécurité (à exécuter APRÈS 0001, 0002, seed.sql et rules.sql)
-- Chaque test échoue avec un message rouge si une protection manque.
-- Ces tests ne redéfinissent JAMAIS auth.uid().
-- =============================================================================

CREATE OR REPLACE FUNCTION public.test_set_user(p_user_id uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_user_id)::text, false);
$$;

-- ── TEST 13 : publier un projet (lien valide, pas de doublon, plafond de points)
DO $$
DECLARE v_before int; v_after int; v_ok boolean;
BEGIN
  RAISE NOTICE '── TEST 13 : publication de projet protégée';
  -- nettoyage : permet de relancer ce fichier sans erreur
  DELETE FROM public.points_ledger WHERE ref_id IN (SELECT id FROM public.projects WHERE repo_url LIKE 'https://github.com/test-securite/%');
  DELETE FROM public.projects WHERE repo_url LIKE 'https://github.com/test-securite/%';
  PERFORM public.test_set_user('a0000000-0000-0000-0000-000000000001');

  v_ok := false;
  BEGIN PERFORM public.publish_project('Projet sans lien valide', 'x', 'pas-un-lien'); EXCEPTION WHEN OTHERS THEN v_ok := true; END;
  ASSERT v_ok, 'Un lien invalide aurait dû être refusé';

  v_before := public.get_balance('a0000000-0000-0000-0000-000000000001');
  PERFORM public.publish_project('Projet de test sécurité 1', 'x', 'https://github.com/test-securite/depot-1');
  v_after := public.get_balance('a0000000-0000-0000-0000-000000000001');
  ASSERT v_after = v_before + 3, 'Le 5e projet doit donner +3 points';

  v_ok := false;
  BEGIN PERFORM public.publish_project('Projet de test doublon', 'x', 'https://github.com/test-securite/depot-1/'); EXCEPTION WHEN OTHERS THEN v_ok := true; END;
  ASSERT v_ok, 'Le même dépôt ne doit pas pouvoir être publié deux fois';

  v_before := public.get_balance('a0000000-0000-0000-0000-000000000001');
  PERFORM public.publish_project('Projet de test sécurité 2', 'x', 'https://github.com/test-securite/depot-2');
  v_after := public.get_balance('a0000000-0000-0000-0000-000000000001');
  ASSERT v_after = v_before, 'Au-delà de 5 projets récompensés, plus de points';
  PERFORM public.test_set_user(NULL);
  RAISE NOTICE '   ✅ OK';
END $$;

-- ── TEST 14 : question gratuite → l'aidant reçoit 1 point
DO $$
DECLARE v_koffi_before int; v_koffi_after int; v_q uuid; v_a uuid;
BEGIN
  RAISE NOTICE '── TEST 14 : question gratuite récompense l''aidant';
  -- nettoyage : permet de relancer ce fichier sans erreur
  DELETE FROM public.points_ledger WHERE user_id = 'a0000000-0000-0000-0000-000000000098' AND reason IN ('free_question', 'hold');
  DELETE FROM public.questions WHERE author_id = 'a0000000-0000-0000-0000-000000000098';
  INSERT INTO auth.users (id, email, role, aud, instance_id, created_at, updated_at, email_confirmed_at, raw_user_meta_data, encrypted_password)
  VALUES ('a0000000-0000-0000-0000-000000000098', 'zero@example.com', 'authenticated', 'authenticated',
          '00000000-0000-0000-0000-000000000000', now(), now(), now(), '{}'::jsonb, '')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profiles (id, pseudo) VALUES ('a0000000-0000-0000-0000-000000000098', 'test_zero')
  ON CONFLICT (id) DO NOTHING;
  -- on vide son solde pour simuler quelqu'un sans point
  INSERT INTO public.points_ledger (user_id, delta, reason, description)
  SELECT id, -public.get_balance(id), 'hold', 'test : solde remis à zéro'
    FROM public.profiles WHERE id = 'a0000000-0000-0000-0000-000000000098' AND public.get_balance(id) > 0;

  PERFORM public.test_set_user('a0000000-0000-0000-0000-000000000098');
  v_q := public.post_question('Question gratuite de test', 'corps', '{}', 1);
  ASSERT (SELECT is_free FROM public.questions WHERE id = v_q), 'La question doit être gratuite';

  INSERT INTO public.answers (question_id, author_id, body)
  VALUES (v_q, 'a0000000-0000-0000-0000-000000000003', 'Réponse de test') RETURNING id INTO v_a;

  v_koffi_before := public.get_balance('a0000000-0000-0000-0000-000000000003');
  PERFORM public.validate_answer(v_a);
  v_koffi_after := public.get_balance('a0000000-0000-0000-0000-000000000003');
  ASSERT v_koffi_after = v_koffi_before + 1, 'L''aidant doit recevoir 1 point sur une question gratuite';
  PERFORM public.test_set_user(NULL);
  RAISE NOTICE '   ✅ OK';
END $$;

-- ── TEST 15 : ce que le navigateur (rôle « authenticated ») ne peut PAS faire
DO $$
DECLARE v_ok boolean;
BEGIN
  RAISE NOTICE '── TEST 15 : droits du navigateur';
  PERFORM public.test_set_user('a0000000-0000-0000-0000-000000000001');
  EXECUTE 'SET LOCAL ROLE authenticated';

  v_ok := false;
  BEGIN EXECUTE 'UPDATE public.projects SET stars = 9999 WHERE author_id = ''a0000000-0000-0000-0000-000000000001'''; EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  ASSERT v_ok, 'Modifier les étoiles à la main doit être interdit';

  v_ok := false;
  BEGIN EXECUTE 'INSERT INTO public.points_ledger (user_id, delta, reason) VALUES (''a0000000-0000-0000-0000-000000000001'', 100, ''reward'')'; EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  ASSERT v_ok, 'Écrire dans le registre des points doit être interdit';

  v_ok := false;
  BEGIN EXECUTE 'UPDATE public.profiles SET created_at = now() WHERE id = ''a0000000-0000-0000-0000-000000000001'''; EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  ASSERT v_ok, 'Modifier created_at doit être interdit';

  v_ok := false;
  BEGIN EXECUTE 'INSERT INTO public.projects (author_id, title) VALUES (''a0000000-0000-0000-0000-000000000001'', ''Projet direct'')'; EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  ASSERT v_ok, 'Créer un projet sans passer par publish_project doit être interdit';

  v_ok := false;
  BEGIN EXECUTE 'SELECT public.get_balance(''a0000000-0000-0000-0000-000000000002'')'; EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  ASSERT v_ok, 'Lire le solde d''un autre via get_balance doit être interdit';

  v_ok := false;
  BEGIN EXECUTE 'SELECT public.expire_questions()'; EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  ASSERT v_ok, 'expire_questions doit être réservée à la tâche planifiée';

  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE anon';
  v_ok := false;
  BEGIN EXECUTE 'SELECT public.publish_project(''Projet anonyme'', '''', ''https://github.com/anon/depot'')'; EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  ASSERT v_ok, 'Un visiteur non connecté ne doit pas pouvoir appeler publish_project';
  EXECUTE 'RESET ROLE';
  PERFORM public.test_set_user(NULL);
  RAISE NOTICE '   ✅ OK';
END $$;

-- ── TEST 16 : toutes les fonctions SECURITY DEFINER ont un search_path fixé
DO $$
BEGIN
  RAISE NOTICE '── TEST 16 : search_path des fonctions sensibles';
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prosecdef
       AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}'::text[])) c WHERE c LIKE 'search_path=%')
  ), 'Une fonction SECURITY DEFINER n''a pas de search_path fixé';
  RAISE NOTICE '   ✅ OK';
END $$;

-- ── TEST 17 : les statistiques s'affichent pour le navigateur, soldes des autres privés
DO $$
DECLARE v_other int; v_own int; v_total int; v_level text; v_visitor int;
BEGIN
  RAISE NOTICE '── TEST 17 : statistiques et soldes privés (rôle navigateur)';
  PERFORM public.test_set_user('a0000000-0000-0000-0000-000000000001');
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT balance INTO v_other FROM public.profile_stats WHERE id = 'a0000000-0000-0000-0000-000000000002';
  SELECT balance, total_earned, level INTO v_own, v_total, v_level FROM public.profile_stats WHERE id = 'a0000000-0000-0000-0000-000000000001';
  ASSERT v_other IS NULL, 'Le solde d''un autre utilisateur ne doit pas être visible';
  ASSERT v_own IS NOT NULL AND v_total > 0 AND v_level IS NOT NULL, 'Ses propres statistiques doivent s''afficher';
  EXECUTE 'RESET ROLE';
  PERFORM public.test_set_user(NULL);
  EXECUTE 'SET LOCAL ROLE anon';
  SELECT balance INTO v_visitor FROM public.profile_stats WHERE id = 'a0000000-0000-0000-0000-000000000001';
  ASSERT v_visitor IS NULL, 'Un visiteur ne doit voir aucun solde';
  EXECUTE 'RESET ROLE';
  RAISE NOTICE '   ✅ OK';
END $$;

DROP FUNCTION IF EXISTS public.test_set_user(uuid);

DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '  ✅ TESTS DE SÉCURITÉ PASSENT (5/5)';
END $$;
