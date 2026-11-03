-- =============================================================================
-- Bondev – Tests des règles métier
-- =============================================================================
-- Exécuter APRÈS la migration (0001_init.sql) et le seed (seed.sql).
-- Chaque test utilise un bloc DO $$ ... $$ qui lève une EXCEPTION si la règle
-- est violée. Si tout passe, le message « ✅ TOUS LES TESTS PASSENT » s'affiche.
--
-- Les tests utilisent les utilisateurs du seed :
--   Amadou : a0000000-0000-0000-0000-000000000001 (17 pts après seed)
--   Fatou  : a0000000-0000-0000-0000-000000000002 (14 pts après seed)
--   Koffi  : a0000000-0000-0000-0000-000000000003 (14 pts après seed)
--
-- Les fonctions SECURITY DEFINER vérifient auth.uid(). Pour les tests,
-- on simule auth.uid() en utilisant set_config / current_setting via
-- une fonction helper.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper : simuler auth.uid() pour les tests
-- En environnement Supabase local, auth.uid() lit request.jwt.claims.
-- On crée une version de test qui permet de définir l'utilisateur courant.
-- ─────────────────────────────────────────────────────────────────────────────

-- (Sécurité) On ne redéfinit plus auth.uid() : on simule la connexion avec request.jwt.claims.

-- Fonction helper pour définir l'utilisateur de test
CREATE OR REPLACE FUNCTION public.test_set_user(p_user_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_user_id)::text, false);
$$;

-- Fonction helper pour se déconnecter
CREATE OR REPLACE FUNCTION public.test_clear_user()
RETURNS void
LANGUAGE sql
AS $$
  SELECT set_config('request.jwt.claims', '', false);
$$;

-- =============================================================================
-- TEST 1 : Poster une question baisse le solde
-- =============================================================================
DO $$
DECLARE
  v_balance_before int;
  v_balance_after  int;
  v_question_id    uuid;
BEGIN
  RAISE NOTICE '── TEST 1 : Poster une question baisse le solde';

  -- Se connecter en tant qu'Amadou (17 pts)
  PERFORM public.test_set_user('a0000000-0000-0000-0000-000000000001');

  v_balance_before := public.get_balance('a0000000-0000-0000-0000-000000000001');

  -- Poster une question palier 3
  v_question_id := public.post_question(
    'Test : question palier 3',
    'Corps de la question de test',
    ARRAY['Node.js'],
    3,    -- palier
    '',   -- github_url
    false -- beginner_ok
  );

  v_balance_after := public.get_balance('a0000000-0000-0000-0000-000000000001');

  ASSERT v_balance_after = v_balance_before - 3,
    format('Le solde devrait baisser de 3 (avant: %s, après: %s)', v_balance_before, v_balance_after);

  RAISE NOTICE '   ✅ Solde passé de % à % (-3 pts)', v_balance_before, v_balance_after;
END;
$$;

-- =============================================================================
-- TEST 2 : Valider une réponse paie une seule fois
-- =============================================================================
DO $$
DECLARE
  v_question_id  uuid;
  v_answer_id    uuid;
  v_answer_id_2  uuid;
  v_koffi_before int;
  v_koffi_after  int;
  v_ok           boolean;
BEGIN
  RAISE NOTICE '── TEST 2 : Valider une réponse paie une seule fois';

  -- Amadou pose une question palier 1
  PERFORM public.test_set_user('a0000000-0000-0000-0000-000000000001');
  v_question_id := public.post_question('Test : validation unique', 'Corps', ARRAY['React'], 1);

  -- Koffi répond
  PERFORM public.test_set_user('a0000000-0000-0000-0000-000000000003');
  INSERT INTO public.answers (id, question_id, author_id, body)
  VALUES (gen_random_uuid(), v_question_id, 'a0000000-0000-0000-0000-000000000003', 'Ma réponse')
  RETURNING id INTO v_answer_id;

  -- Fatou répond aussi
  PERFORM public.test_set_user('a0000000-0000-0000-0000-000000000002');
  INSERT INTO public.answers (id, question_id, author_id, body)
  VALUES (gen_random_uuid(), v_question_id, 'a0000000-0000-0000-0000-000000000002', 'Autre réponse')
  RETURNING id INTO v_answer_id_2;

  v_koffi_before := public.get_balance('a0000000-0000-0000-0000-000000000003');

  -- Amadou valide la réponse de Koffi
  PERFORM public.test_set_user('a0000000-0000-0000-0000-000000000001');
  PERFORM public.validate_answer(v_answer_id);

  v_koffi_after := public.get_balance('a0000000-0000-0000-0000-000000000003');
  ASSERT v_koffi_after = v_koffi_before + 1,
    format('Koffi devrait gagner 1 point (avant: %s, après: %s)', v_koffi_before, v_koffi_after);

  -- Tenter de valider une deuxième réponse → doit échouer
  BEGIN
    PERFORM public.validate_answer(v_answer_id_2);
    ASSERT false, 'La double validation aurait dû échouer';
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
  END;
  ASSERT v_ok, 'La double validation aurait dû lever une exception';

  RAISE NOTICE '   ✅ Koffi a reçu 1 pt, la double validation est bloquée';
END;
$$;

-- =============================================================================
-- TEST 3 : Impossible de valider sa propre réponse
-- =============================================================================
DO $$
DECLARE
  v_question_id uuid;
  v_answer_id   uuid;
  v_ok          boolean := false;
BEGIN
  RAISE NOTICE '── TEST 3 : Impossible de valider sa propre réponse';

  -- Fatou pose une question
  PERFORM public.test_set_user('a0000000-0000-0000-0000-000000000002');
  v_question_id := public.post_question('Test : auto-validation interdite', 'Corps', ARRAY['Python'], 1);

  -- Fatou répond elle-même
  INSERT INTO public.answers (id, question_id, author_id, body)
  VALUES (gen_random_uuid(), v_question_id, 'a0000000-0000-0000-0000-000000000002', 'Ma propre réponse')
  RETURNING id INTO v_answer_id;

  -- Fatou essaie de valider sa propre réponse
  BEGIN
    PERFORM public.validate_answer(v_answer_id);
    ASSERT false, 'L''auto-validation aurait dû échouer';
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
  END;
  ASSERT v_ok, 'L''auto-validation aurait dû lever une exception';

  RAISE NOTICE '   ✅ Auto-validation correctement refusée';
END;
$$;

-- =============================================================================
-- TEST 4 : Expiration rembourse les points
-- =============================================================================
DO $$
DECLARE
  v_question_id    uuid;
  v_balance_before int;
  v_balance_after  int;
  v_expired_count  int;
BEGIN
  RAISE NOTICE '── TEST 4 : Expiration rembourse les points';

  -- Koffi pose une question palier 3
  PERFORM public.test_set_user('a0000000-0000-0000-0000-000000000003');
  v_balance_before := public.get_balance('a0000000-0000-0000-0000-000000000003');

  v_question_id := public.post_question('Test : expiration', 'Corps', ARRAY['Go'], 3);

  -- Vérifier que le solde a baissé
  ASSERT public.get_balance('a0000000-0000-0000-0000-000000000003') = v_balance_before - 3,
    'Le solde devrait baisser de 3';

  -- Simuler l'expiration en reculant expires_at dans le passé
  UPDATE public.questions SET expires_at = now() - interval '1 hour' WHERE id = v_question_id;

  -- Appeler expire_questions
  v_expired_count := public.expire_questions();
  ASSERT v_expired_count >= 1, 'Au moins 1 question devrait expirer';

  -- Vérifier que le solde est revenu
  v_balance_after := public.get_balance('a0000000-0000-0000-0000-000000000003');
  ASSERT v_balance_after = v_balance_before,
    format('Le solde devrait être rétabli (avant: %s, après: %s)', v_balance_before, v_balance_after);

  -- Vérifier le statut
  ASSERT (SELECT status FROM public.questions WHERE id = v_question_id) = 'expired',
    'Le statut devrait être expired';

  RAISE NOTICE '   ✅ Question expirée, % pts remboursés à Koffi', 3;
END;
$$;

-- =============================================================================
-- TEST 5 : Solde insuffisant → refus
-- =============================================================================
DO $$
DECLARE
  v_ok boolean := false;
BEGIN
  RAISE NOTICE '── TEST 5 : Solde insuffisant refusé';

  -- Créer un utilisateur temporaire avec 0 points pour ce test
  -- On va vider le solde d'un utilisateur en postant des questions
  -- Plus simple : on teste directement avec un solde qu'on connaît

  -- Amadou a un certain solde, on tente un palier trop élevé
  -- D'abord, vidons le solde en postant des questions palier 6
  PERFORM public.test_set_user('a0000000-0000-0000-0000-000000000001');

  -- Vider le solde d'Amadou
  DECLARE
    v_bal int;
  BEGIN
    LOOP
      v_bal := public.get_balance('a0000000-0000-0000-0000-000000000001');
      EXIT WHEN v_bal < 6;
      PERFORM public.post_question(
        format('Vidange %s', gen_random_uuid()),
        'Corps', ARRAY['Test'], 6
      );
    END LOOP;

    -- Maintenant, tenter de poster une question palier 6 sans points
    -- et sans question gratuite dispo (on doit aussi épuiser la gratuite)
    v_bal := public.get_balance('a0000000-0000-0000-0000-000000000001');
    IF v_bal < 6 THEN
      BEGIN
        PERFORM public.post_question('Devrait échouer', 'Corps', ARRAY['Test'], 6);
        ASSERT false, 'Poster avec solde insuffisant aurait dû échouer';
      EXCEPTION WHEN OTHERS THEN
        v_ok := true;
      END;
    END IF;
  END;

  ASSERT v_ok, 'Le refus pour solde insuffisant n''a pas fonctionné';
  RAISE NOTICE '   ✅ Question palier 6 refusée avec solde insuffisant';
END;
$$;

-- =============================================================================
-- TEST 6 : Question gratuite hebdomadaire fonctionne
-- =============================================================================
DO $$
DECLARE
  v_question_id  uuid;
  v_balance_before int;
  v_balance_after  int;
BEGIN
  RAISE NOTICE '── TEST 6 : Question gratuite hebdomadaire fonctionne';

  -- Utiliser Fatou qui a encore assez de points mais on va tester la gratuité
  -- On crée un nouvel utilisateur pour ce test pour être sûr qu'il n'a pas
  -- déjà utilisé sa question gratuite
  INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at, email_confirmed_at, role, instance_id, aud, encrypted_password)
  VALUES ('a0000000-0000-0000-0000-000000000099', 'test-free@example.com',
          '{"display_name":"Test Free"}'::jsonb, now(), now(), now(), 'authenticated',
          '00000000-0000-0000-0000-000000000000', 'authenticated', crypt('password123', gen_salt('bf')))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  VALUES ('a0000000-0000-0000-0000-000000000099', 'a0000000-0000-0000-0000-000000000099',
          'a0000000-0000-0000-0000-000000000099',
          '{"sub":"a0000000-0000-0000-0000-000000000099","email":"test-free@example.com"}'::jsonb,
          'email', now(), now(), now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, pseudo, display_name, lang)
  VALUES ('a0000000-0000-0000-0000-000000000099', 'test_free', 'Test Free', 'fr')
  ON CONFLICT (id) DO NOTHING;

  -- Ce nouvel utilisateur a 5 pts (bonus inscription)
  -- On les dépense tous via des questions palier 1
  PERFORM public.test_set_user('a0000000-0000-0000-0000-000000000099');

  -- Dépenser 5 pts (5 questions palier 1)
  PERFORM public.post_question('Dépense 1', 'Corps', ARRAY['Test'], 1);
  PERFORM public.post_question('Dépense 2', 'Corps', ARRAY['Test'], 1);
  PERFORM public.post_question('Dépense 3', 'Corps', ARRAY['Test'], 1);
  PERFORM public.post_question('Dépense 4', 'Corps', ARRAY['Test'], 1);
  PERFORM public.post_question('Dépense 5', 'Corps', ARRAY['Test'], 1);

  -- Solde = 0 maintenant
  v_balance_before := public.get_balance('a0000000-0000-0000-0000-000000000099');
  ASSERT v_balance_before = 0,
    format('Le solde devrait être 0, il est %s', v_balance_before);

  -- La question gratuite devrait être disponible (pas encore utilisée cette semaine)
  ASSERT public.has_free_question('a0000000-0000-0000-0000-000000000099'),
    'La question gratuite devrait être disponible';

  -- Poster avec palier 1 et solde 0 → devrait utiliser la question gratuite
  v_question_id := public.post_question('Question gratuite !', 'Corps', ARRAY['Test'], 1);

  -- Le solde ne devrait pas changer (c'est gratuit)
  v_balance_after := public.get_balance('a0000000-0000-0000-0000-000000000099');
  ASSERT v_balance_after = 0,
    format('Le solde ne devrait pas changer après une question gratuite (solde: %s)', v_balance_after);

  -- La question gratuite ne devrait plus être disponible cette semaine
  ASSERT NOT public.has_free_question('a0000000-0000-0000-0000-000000000099'),
    'La question gratuite ne devrait plus être disponible';

  -- Tenter une autre question gratuite → doit échouer (solde 0 et plus de gratuite)
  DECLARE
    v_ok boolean := false;
  BEGIN
    PERFORM public.post_question('Deuxième gratuite impossible', 'Corps', ARRAY['Test'], 1);
    ASSERT false, 'La deuxième question gratuite aurait dû échouer';
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
  END;

  RAISE NOTICE '   ✅ Question gratuite utilisée, solde inchangé, deuxième refusée';
END;
$$;

-- =============================================================================
-- TEST 7 : Retrait rembourse les points
-- =============================================================================
DO $$
DECLARE
  v_question_id    uuid;
  v_balance_before int;
  v_balance_after  int;
BEGIN
  RAISE NOTICE '── TEST 7 : Retrait de question rembourse les points';

  -- Fatou pose une question palier 3
  PERFORM public.test_set_user('a0000000-0000-0000-0000-000000000002');
  v_balance_before := public.get_balance('a0000000-0000-0000-0000-000000000002');

  v_question_id := public.post_question('Test : retrait', 'Corps', ARRAY['React'], 3);
  ASSERT public.get_balance('a0000000-0000-0000-0000-000000000002') = v_balance_before - 3,
    'Le solde devrait baisser de 3';

  -- Fatou retire sa question
  PERFORM public.withdraw_question(v_question_id);

  v_balance_after := public.get_balance('a0000000-0000-0000-0000-000000000002');
  ASSERT v_balance_after = v_balance_before,
    format('Le solde devrait être rétabli (avant: %s, après: %s)', v_balance_before, v_balance_after);

  RAISE NOTICE '   ✅ Question retirée, % pts remboursés à Fatou', 3;
END;
$$;

-- =============================================================================
-- TEST 8 : On ne peut pas marquer son propre projet comme utile
-- =============================================================================
DO $$
DECLARE
  v_ok boolean := false;
BEGIN
  RAISE NOTICE '── TEST 8 : Impossible de se payer via son propre projet';

  -- Amadou essaie de marquer son propre projet comme utile
  PERFORM public.test_set_user('a0000000-0000-0000-0000-000000000001');

  BEGIN
    PERFORM public.mark_project_used('b0000000-0000-0000-0000-000000000001');
    ASSERT false, 'Marquer son propre projet aurait dû échouer';
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
  END;

  ASSERT v_ok, 'L''auto-paiement via projet aurait dû lever une exception';
  RAISE NOTICE '   ✅ Auto-paiement via projet correctement refusé';
END;
$$;

-- =============================================================================
-- TEST 9 : « Ça m'a servi » donne +1 pt à l'auteur du projet
-- =============================================================================
DO $$
DECLARE
  v_amadou_before int;
  v_amadou_after  int;
BEGIN
  RAISE NOTICE '── TEST 9 : « Ça m''a servi » donne +1 pt à l''auteur';

  -- Fatou marque le projet d'Amadou comme utile
  PERFORM public.test_set_user('a0000000-0000-0000-0000-000000000002');
  v_amadou_before := public.get_balance('a0000000-0000-0000-0000-000000000001');

  PERFORM public.mark_project_used('b0000000-0000-0000-0000-000000000001');

  v_amadou_after := public.get_balance('a0000000-0000-0000-0000-000000000001');
  ASSERT v_amadou_after = v_amadou_before + 1,
    format('Amadou devrait gagner 1 pt (avant: %s, après: %s)', v_amadou_before, v_amadou_after);

  RAISE NOTICE '   ✅ Amadou a reçu +1 pt grâce à Fatou';
END;
$$;

-- =============================================================================
-- TEST 10 : Le total gagné ne baisse jamais (les remboursements ne comptent pas)
-- =============================================================================
DO $$
DECLARE
  v_total_before int;
  v_total_after  int;
  v_question_id  uuid;
BEGIN
  RAISE NOTICE '── TEST 10 : Le total gagné ne baisse jamais';

  PERFORM public.test_set_user('a0000000-0000-0000-0000-000000000002');
  v_total_before := public.get_total_earned('a0000000-0000-0000-0000-000000000002');

  -- Poser une question (hold = -3, le total ne devrait pas baisser car c'est un delta négatif)
  v_question_id := public.post_question('Test total gagné', 'Corps', ARRAY['JS'], 3);

  v_total_after := public.get_total_earned('a0000000-0000-0000-0000-000000000002');
  ASSERT v_total_after = v_total_before,
    format('Le total gagné ne devrait pas baisser après un hold (avant: %s, après: %s)', v_total_before, v_total_after);

  -- Retirer la question (refund = +3 mais c'est un remboursement, ne compte pas)
  PERFORM public.withdraw_question(v_question_id);

  v_total_after := public.get_total_earned('a0000000-0000-0000-0000-000000000002');
  ASSERT v_total_after = v_total_before,
    format('Le total gagné ne devrait pas changer après un remboursement (avant: %s, après: %s)', v_total_before, v_total_after);

  RAISE NOTICE '   ✅ Total gagné stable à % malgré hold et remboursement', v_total_before;
END;
$$;

-- =============================================================================
-- TEST 11 : Niveaux (level_for)
-- =============================================================================
DO $$
BEGIN
  RAISE NOTICE '── TEST 11 : Niveaux (level_for)';

  ASSERT public.level_for(0)   = 'Étincelle',   'Niveau 0 = Étincelle';
  ASSERT public.level_for(9)   = 'Étincelle',   'Niveau 9 = Étincelle';
  ASSERT public.level_for(10)  = 'Explorateur', 'Niveau 10 = Explorateur';
  ASSERT public.level_for(29)  = 'Explorateur', 'Niveau 29 = Explorateur';
  ASSERT public.level_for(30)  = 'Bâtisseur',   'Niveau 30 = Bâtisseur';
  ASSERT public.level_for(69)  = 'Bâtisseur',   'Niveau 69 = Bâtisseur';
  ASSERT public.level_for(70)  = 'Mentor',       'Niveau 70 = Mentor';
  ASSERT public.level_for(149) = 'Mentor',       'Niveau 149 = Mentor';
  ASSERT public.level_for(150) = 'Maître',       'Niveau 150 = Maître';
  ASSERT public.level_for(299) = 'Maître',       'Niveau 299 = Maître';
  ASSERT public.level_for(300) = 'Légende',      'Niveau 300 = Légende';
  ASSERT public.level_for(999) = 'Légende',      'Niveau 999 = Légende';

  RAISE NOTICE '   ✅ Tous les niveaux sont corrects';
END;
$$;

-- =============================================================================
-- TEST 12 : Le points_ledger est immuable côté RLS (insert/update/delete bloqués)
-- =============================================================================
DO $$
DECLARE
  v_ok_insert boolean := false;
  v_ok_update boolean := false;
  v_ok_delete boolean := false;
BEGIN
  RAISE NOTICE '── TEST 12 : points_ledger immuable côté client (RLS)';

  -- Note : Ce test vérifie que les politiques RLS bloquent les écritures.
  -- Les fonctions SECURITY DEFINER contournent la RLS car elles s'exécutent
  -- en tant que propriétaire.
  -- Pour tester les politiques RLS directement, il faudrait exécuter en
  -- tant qu'un rôle authentifié (anon/authenticated), ce qui n'est pas
  -- possible dans ce contexte de test (on est superuser).
  -- On documente donc que les politiques sont :
  --   ledger_insert WITH CHECK (false)
  --   ledger_update USING (false)
  --   ledger_delete USING (false)
  -- et on vérifie que ces politiques existent.

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE tablename = 'points_ledger' AND policyname = 'ledger_insert'
       AND qual IS NULL AND with_check = 'false'
  ), 'Politique ledger_insert devrait bloquer les INSERT';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE tablename = 'points_ledger' AND policyname = 'ledger_update'
       AND qual = 'false'
  ), 'Politique ledger_update devrait bloquer les UPDATE';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE tablename = 'points_ledger' AND policyname = 'ledger_delete'
       AND qual = 'false'
  ), 'Politique ledger_delete devrait bloquer les DELETE';

  RAISE NOTICE '   ✅ Politiques RLS correctement configurées pour points_ledger';
END;
$$;

-- =============================================================================
-- Nettoyer les fonctions de test
DROP FUNCTION IF EXISTS public.test_set_user(uuid);
DROP FUNCTION IF EXISTS public.test_clear_user();

-- =============================================================================
-- RÉSULTAT FINAL
-- =============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════════════';
  RAISE NOTICE '  ✅ TOUS LES TESTS PASSENT (12/12)';
  RAISE NOTICE '══════════════════════════════════════════════════';
  RAISE NOTICE '';
END;
$$;
