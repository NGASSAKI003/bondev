-- =============================================================================
-- Bondev – Données d'exemple (seed)
-- =============================================================================
-- Ces données sont clairement marquées comme exemples.
-- Elles utilisent des UUID fixes pour faciliter les tests.
-- Exécuter APRÈS la migration 0001_init.sql.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Utilisateurs exemples
-- On insère d'abord dans auth.users (nécessaire pour la FK),
-- puis dans profiles (ce qui déclenche le bonus d'inscription de +5 points).
-- ─────────────────────────────────────────────────────────────────────────────

-- Note : dans Supabase, auth.users est géré par GoTrue. En seed local,
-- on insère directement. En production, les utilisateurs s'inscrivent
-- via l'interface.

INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at, email_confirmed_at, role, instance_id, aud, encrypted_password)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'amadou@example.com',
   '{"display_name":"Amadou Diallo"}'::jsonb, now(), now(), now(), 'authenticated',
   '00000000-0000-0000-0000-000000000000', 'authenticated', crypt('password123', gen_salt('bf'))),
  ('a0000000-0000-0000-0000-000000000002', 'fatou@example.com',
   '{"display_name":"Fatou Mbaye"}'::jsonb, now(), now(), now(), 'authenticated',
   '00000000-0000-0000-0000-000000000000', 'authenticated', crypt('password123', gen_salt('bf'))),
  ('a0000000-0000-0000-0000-000000000003', 'koffi@example.com',
   '{"display_name":"Koffi Asante"}'::jsonb, now(), now(), now(), 'authenticated',
   '00000000-0000-0000-0000-000000000000', 'authenticated', crypt('password123', gen_salt('bf')))
ON CONFLICT (id) DO NOTHING;

-- Création des identités auth (nécessaire pour Supabase)
INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001', '{"sub":"a0000000-0000-0000-0000-000000000001","email":"amadou@example.com"}'::jsonb,
   'email', now(), now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000002', '{"sub":"a0000000-0000-0000-0000-000000000002","email":"fatou@example.com"}'::jsonb,
   'email', now(), now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003',
   'a0000000-0000-0000-0000-000000000003', '{"sub":"a0000000-0000-0000-0000-000000000003","email":"koffi@example.com"}'::jsonb,
   'email', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

-- Profils (le trigger trg_signup_bonus donne +5 pts automatiquement)
INSERT INTO public.profiles (id, pseudo, display_name, avatar_url, bio, github_url, lang)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'amadou_d', 'Amadou Diallo', '',
   'Développeur full-stack · Dakar. Passionné de Mobile Money et fintech.', 'https://github.com/amadou-example', 'fr'),
  ('a0000000-0000-0000-0000-000000000002', 'fatou_m', 'Fatou Mbaye', '',
   'Développeuse front-end · Abidjan. Spécialisée en PWA et accessibilité.', 'https://github.com/fatou-example', 'fr'),
  ('a0000000-0000-0000-0000-000000000003', 'koffi_a', 'Koffi Asante', '',
   'Développeur back-end · Accra. Expert Node.js et bases de données.', 'https://github.com/koffi-example', 'en')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10 projets d'exemple réalistes
-- Insérés directement (pas via publish_project pour ne pas doubler les +3 pts).
-- Les points de publication sont ajoutés manuellement dans le ledger.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.projects (id, author_id, title, description, repo_url, license, technologies, tags, stars, last_activity) VALUES

-- 1. Gestion de stock
('b0000000-0000-0000-0000-000000000001',
 'a0000000-0000-0000-0000-000000000001',
 '[Exemple] Gestion de stock pour petites boutiques',
 'Application web pour suivre les produits, les ventes et les alertes de stock. Adaptée aux commerces africains avec un mode hors-ligne pour les zones sans connexion fiable.',
 'https://github.com/example/stock-manager',
 'MIT', ARRAY['React', 'Node.js', 'SQLite'], ARRAY['hors-ligne', 'commerce'],
 12, now() - interval '2 days'),

-- 2. Mobile Money
('b0000000-0000-0000-0000-000000000002',
 'a0000000-0000-0000-0000-000000000001',
 '[Exemple] Intégration Mobile Money MTN et Airtel',
 'SDK JavaScript pour intégrer les paiements Mobile Money (MTN MoMo, Airtel Money) sur n''importe quel site web. Gère les callbacks et la réconciliation.',
 'https://github.com/example/mobile-money-sdk',
 'Apache-2.0', ARRAY['Node.js', 'TypeScript', 'API REST'], ARRAY['Mobile Money', 'fintech', 'paiement'],
 28, now() - interval '5 days'),

-- 3. Formulaires hors-ligne
('b0000000-0000-0000-0000-000000000003',
 'a0000000-0000-0000-0000-000000000002',
 '[Exemple] Formulaires qui marchent sans connexion',
 'Bibliothèque PWA pour créer des formulaires qui enregistrent les réponses en IndexedDB, puis les synchronisent automatiquement quand le réseau revient.',
 'https://github.com/example/offline-forms',
 'MIT', ARRAY['JavaScript', 'PWA', 'IndexedDB'], ARRAY['hors-ligne', 'formulaire', 'faible connexion'],
 19, now() - interval '1 week'),

-- 4. API USSD
('b0000000-0000-0000-0000-000000000004',
 'a0000000-0000-0000-0000-000000000003',
 '[Exemple] Framework USSD pour services sans internet',
 'Créer des menus USSD interactifs en Python. Permet de construire des applications accessibles même sans smartphone ni connexion internet.',
 'https://github.com/example/ussd-framework',
 'MIT', ARRAY['Python', 'USSD', 'API'], ARRAY['USSD', 'pas de smartphone', 'accessibilité'],
 15, now() - interval '3 days'),

-- 5. Comptabilité simplifiée
('b0000000-0000-0000-0000-000000000005',
 'a0000000-0000-0000-0000-000000000002',
 '[Exemple] Comptabilité simplifiée pour PME',
 'Application de comptabilité simple en français : factures, dépenses, rapports PDF. Pensée pour les petites entreprises africaines qui n''ont pas besoin d''un ERP complet.',
 'https://github.com/example/compta-pme',
 'GPL-3.0', ARRAY['React', 'Python', 'PostgreSQL'], ARRAY['comptabilité', 'PME', 'francophone'],
 8, now() - interval '10 days'),

-- 6. SMS gateway
('b0000000-0000-0000-0000-000000000006',
 'a0000000-0000-0000-0000-000000000003',
 '[Exemple] Passerelle SMS multi-opérateurs',
 'Microservice pour envoyer des SMS via les APIs de MTN, Orange et Airtel. File d''attente Redis, retry automatique et tableau de bord de suivi.',
 'https://github.com/example/sms-gateway',
 'MIT', ARRAY['Node.js', 'Redis', 'Docker'], ARRAY['SMS', 'notification', 'multi-opérateurs'],
 22, now() - interval '4 days'),

-- 7. Apprentissage hors-ligne
('b0000000-0000-0000-0000-000000000007',
 'a0000000-0000-0000-0000-000000000001',
 '[Exemple] Plateforme e-learning hors-ligne',
 'Application mobile React Native pour suivre des cours même sans connexion. Les contenus se téléchargent une fois, puis sont disponibles hors-ligne indéfiniment.',
 'https://github.com/example/learn-offline',
 'MIT', ARRAY['React Native', 'SQLite', 'PWA'], ARRAY['hors-ligne', 'éducation', 'mobile'],
 14, now() - interval '6 days'),

-- 8. Marketplace agricole
('b0000000-0000-0000-0000-000000000008',
 'a0000000-0000-0000-0000-000000000002',
 '[Exemple] Marketplace pour produits agricoles',
 'Plateforme qui met en relation les agriculteurs et les acheteurs. Notifications par SMS, paiement via Mobile Money, recherche par région.',
 'https://github.com/example/agri-market',
 'MIT', ARRAY['Vue.js', 'Node.js', 'MongoDB'], ARRAY['Mobile Money', 'agriculture', 'SMS'],
 17, now() - interval '8 days'),

-- 9. Convertisseur de devises CEMAC/UEMOA
('b0000000-0000-0000-0000-000000000009',
 'a0000000-0000-0000-0000-000000000003',
 '[Exemple] API de conversion CFA / devises africaines',
 'API REST pour convertir entre le franc CFA (XOF/XAF), le naira, le cedi et d''autres monnaies africaines. Taux mis à jour toutes les heures.',
 'https://github.com/example/africa-currencies',
 'MIT', ARRAY['Go', 'API REST', 'PostgreSQL'], ARRAY['fintech', 'devises', 'API'],
 11, now() - interval '12 days'),

-- 10. Générateur de reçus
('b0000000-0000-0000-0000-000000000010',
 'a0000000-0000-0000-0000-000000000001',
 '[Exemple] Générateur de reçus PDF et WhatsApp',
 'Micro-service qui génère des reçus de paiement en PDF ou en image (pour envoi WhatsApp). Supporte les logos personnalisés et les montants en CFA.',
 'https://github.com/example/receipt-generator',
 'Apache-2.0', ARRAY['Node.js', 'Puppeteer', 'TypeScript'], ARRAY['paiement', 'PDF', 'WhatsApp'],
 9, now() - interval '15 days');

-- Points de publication pour les projets exemples (+3 par projet)
-- Amadou : projets 1, 2, 7, 10 = 4 × 3 = 12 pts
-- Fatou  : projets 3, 5, 8      = 3 × 3 =  9 pts
-- Koffi  : projets 4, 6, 9      = 3 × 3 =  9 pts
INSERT INTO public.points_ledger (user_id, delta, reason, ref_id, description) VALUES
('a0000000-0000-0000-0000-000000000001', 3, 'project_publish', 'b0000000-0000-0000-0000-000000000001', '[Exemple] Publication de projet'),
('a0000000-0000-0000-0000-000000000001', 3, 'project_publish', 'b0000000-0000-0000-0000-000000000002', '[Exemple] Publication de projet'),
('a0000000-0000-0000-0000-000000000002', 3, 'project_publish', 'b0000000-0000-0000-0000-000000000003', '[Exemple] Publication de projet'),
('a0000000-0000-0000-0000-000000000003', 3, 'project_publish', 'b0000000-0000-0000-0000-000000000004', '[Exemple] Publication de projet'),
('a0000000-0000-0000-0000-000000000002', 3, 'project_publish', 'b0000000-0000-0000-0000-000000000005', '[Exemple] Publication de projet'),
('a0000000-0000-0000-0000-000000000003', 3, 'project_publish', 'b0000000-0000-0000-0000-000000000006', '[Exemple] Publication de projet'),
('a0000000-0000-0000-0000-000000000001', 3, 'project_publish', 'b0000000-0000-0000-0000-000000000007', '[Exemple] Publication de projet'),
('a0000000-0000-0000-0000-000000000002', 3, 'project_publish', 'b0000000-0000-0000-0000-000000000008', '[Exemple] Publication de projet'),
('a0000000-0000-0000-0000-000000000003', 3, 'project_publish', 'b0000000-0000-0000-0000-000000000009', '[Exemple] Publication de projet'),
('a0000000-0000-0000-0000-000000000001', 3, 'project_publish', 'b0000000-0000-0000-0000-000000000010', '[Exemple] Publication de projet');

-- ─────────────────────────────────────────────────────────────────────────────
-- Vérification finale
-- ─────────────────────────────────────────────────────────────────────────────
-- Amadou : 5 (signup) + 12 (projets) = 17 pts
-- Fatou  : 5 (signup) +  9 (projets) = 14 pts
-- Koffi  : 5 (signup) +  9 (projets) = 14 pts

DO $$
DECLARE
  v_amadou_bal int;
  v_fatou_bal  int;
  v_koffi_bal  int;
  v_project_count int;
BEGIN
  SELECT public.get_balance('a0000000-0000-0000-0000-000000000001') INTO v_amadou_bal;
  SELECT public.get_balance('a0000000-0000-0000-0000-000000000002') INTO v_fatou_bal;
  SELECT public.get_balance('a0000000-0000-0000-0000-000000000003') INTO v_koffi_bal;
  SELECT COUNT(*) INTO v_project_count FROM public.projects;

  RAISE NOTICE '══════════════════════════════════════════════════';
  RAISE NOTICE '  SEED TERMINÉ';
  RAISE NOTICE '  Projets : %', v_project_count;
  RAISE NOTICE '  Amadou  : % pts (attendu 17)', v_amadou_bal;
  RAISE NOTICE '  Fatou   : % pts (attendu 14)', v_fatou_bal;
  RAISE NOTICE '  Koffi   : % pts (attendu 14)', v_koffi_bal;
  RAISE NOTICE '══════════════════════════════════════════════════';

  ASSERT v_amadou_bal = 17, 'Solde Amadou incorrect';
  ASSERT v_fatou_bal  = 14, 'Solde Fatou incorrect';
  ASSERT v_koffi_bal  = 14, 'Solde Koffi incorrect';
  ASSERT v_project_count = 10, 'Nombre de projets incorrect';
END;
$$;
