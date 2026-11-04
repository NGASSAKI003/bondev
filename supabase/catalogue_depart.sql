-- =============================================================================
-- Bondev – Catalogue de départ
-- =============================================================================
-- Généré le 2026-11-04T20:53:59.274Z par scripts/catalogue/build-catalogue.mjs.
-- Source : scripts/catalogue/repos.json
-- Dépôts examinés : 29 | importés : 28 | ignorés : 1
--
-- Dépôts importés (28) :
--   - Ushahidi — https://github.com/ushahidi/platform
--   - KoBoToolbox — https://github.com/kobotoolbox/kpi
--   - ODK Collect — https://github.com/getodk/collect
--   - ODK Central — https://github.com/getodk/central
--   - DHIS2 — https://github.com/dhis2/dhis2-core
--   - OpenMRS — https://github.com/openmrs/openmrs-core
--   - Community Health Toolkit — https://github.com/medic/cht-core
--   - CommCare HQ — https://github.com/dimagi/commcare-hq
--   - Apache Fineract — https://github.com/apache/fineract
--   - Mifos (application Android) — https://github.com/openMF/mifos-x-field-officer-app
--   - Mojaloop — https://github.com/mojaloop/mojaloop
--   - Flutterwave pour Node.js — https://github.com/Flutterwave/Node-v3
--   - Africa's Talking (Node.js) — https://github.com/AfricasTalkingLtd/africastalking-node.js
--   - Africa's Talking (Python) — https://github.com/AfricasTalkingLtd/africastalking-python
--   - RapidPro — https://github.com/rapidpro/rapidpro
--   - RapidSMS — https://github.com/rapidsms/rapidsms
--   - Kolibri — https://github.com/learningequality/kolibri
--   - Kiwix pour Android — https://github.com/kiwix/kiwix-android
--   - Open edX — https://github.com/openedx/openedx-platform
--   - Moodle — https://github.com/moodle/moodle
--   - Masakhane MT — https://github.com/masakhane-io/masakhane-mt
--   - Common Voice — https://github.com/common-voice/common-voice
--   - PouchDB — https://github.com/apache/pouchdb
--   - Dexie.js — https://github.com/dexie/Dexie.js
--   - Workbox — https://github.com/GoogleChrome/workbox
--   - farmOS — https://github.com/farmOS/farmOS
--   - ERPNext — https://github.com/frappe/erpnext
--   - OpenCRVS — https://github.com/opencrvs/opencrvs-core
--
-- Dépôts ignorés (1) :
--   - openMF/community-app — archivé sur GitHub
--
-- Ce fichier est idempotent : il peut être rejoué sans créer de doublon.
-- Il ne contient aucun INSERT dans public.points_ledger. Le bonus d’inscription
-- est évité en désactivant temporairement le trigger trg_signup_bonus autour
-- de l’insertion du profil technique.
--
-- À exécuter dans l’éditeur SQL de Supabase (rôle postgres), APRÈS les
-- migrations 0001_init.sql à 0004_stars.sql. Ne pas utiliser la clé anon.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Compte technique « Équipe Bondev » (non connectable)
-- ─────────────────────────────────────────────────────────────────────────────
-- Le mot de passe est aléatoire et n’est communiqué à personne : le compte ne
-- peut pas se connecter. Il sert uniquement d’auteur aux projets du catalogue.
INSERT INTO auth.users (
  id, email, raw_user_meta_data, created_at, updated_at, email_confirmed_at,
  role, instance_id, aud, encrypted_password
)
VALUES (
  'a0000000-0000-0000-0000-0000000000b0'::uuid,
  $bondev$equipe@bondev.invalid$bondev$,
  '{"display_name":"Équipe Bondev"}'::jsonb,
  now(), now(), now(),
  'authenticated',
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  crypt(gen_random_uuid()::text, gen_salt('bf'))
)
ON CONFLICT DO NOTHING;

-- Le trigger trg_signup_bonus ajoute +5 points dans points_ledger à chaque
-- profil créé. On le désactive uniquement le temps d’insérer le profil
-- technique, puis on le réactive. L’opération est transactionnelle : en cas
-- d’erreur, PostgreSQL restaure automatiquement l’état du trigger.
ALTER TABLE public.profiles DISABLE TRIGGER trg_signup_bonus;

INSERT INTO public.profiles (
  id, pseudo, display_name, avatar_url, bio, github_url, lang
)
VALUES (
  'a0000000-0000-0000-0000-0000000000b0'::uuid,
  $bondev$equipe_bondev$bondev$,
  $bondev$Équipe Bondev$bondev$,
  '',
  $bondev$Compte technique du catalogue Bondev. Non connectable.$bondev$,
  '',
  'fr'
)
ON CONFLICT DO NOTHING;

ALTER TABLE public.profiles ENABLE TRIGGER trg_signup_bonus;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Projets du catalogue (28)
-- ─────────────────────────────────────────────────────────────────────────────
-- La licence vaut « Autre » quand GitHub ne fournit pas de SPDX exploitable.
-- Les technologies se limitent au langage principal renvoyé par GitHub.
-- github_stars contient les étoiles GitHub ; stars reste à 0 (usage Bondev).

-- Ushahidi — https://github.com/ushahidi/platform
INSERT INTO public.projects (
  author_id, title, description, repo_url, license, technologies, tags, stars, github_stars, last_activity
)
VALUES (
  'a0000000-0000-0000-0000-0000000000b0'::uuid,
  $bondev$Ushahidi$bondev$,
  $bondev$Plateforme née au Kenya pour collecter des signalements par SMS, web ou email et les afficher sur une carte. Utilisée pour la gestion de crise et l'observation d'élections.$bondev$,
  $bondev$https://github.com/ushahidi/platform$bondev$,
  $bondev$Autre$bondev$,
  ARRAY[$bondev$PHP$bondev$]::text[],
  ARRAY[$bondev$collecte de données$bondev$, $bondev$cartographie$bondev$, $bondev$SMS$bondev$, $bondev$humanitaire$bondev$]::text[],
  0,
  734,
  $bondev$2026-10-22T09:17:23.000Z$bondev$::timestamptz
)
ON CONFLICT (lower(repo_url)) WHERE repo_url <> '' DO NOTHING;

-- KoBoToolbox — https://github.com/kobotoolbox/kpi
INSERT INTO public.projects (
  author_id, title, description, repo_url, license, technologies, tags, stars, github_stars, last_activity
)
VALUES (
  'a0000000-0000-0000-0000-0000000000b0'::uuid,
  $bondev$KoBoToolbox$bondev$,
  $bondev$Outil de collecte de données sur le terrain : formulaires, enquêtes et travail hors-ligne sur mobile. Très utilisé par les ONG et les organisations humanitaires.$bondev$,
  $bondev$https://github.com/kobotoolbox/kpi$bondev$,
  $bondev$AGPL-3.0$bondev$,
  ARRAY[$bondev$Python$bondev$]::text[],
  ARRAY[$bondev$collecte de données$bondev$, $bondev$hors-ligne$bondev$, $bondev$humanitaire$bondev$]::text[],
  0,
  188,
  $bondev$2026-11-04T20:52:28.000Z$bondev$::timestamptz
)
ON CONFLICT (lower(repo_url)) WHERE repo_url <> '' DO NOTHING;

-- ODK Collect — https://github.com/getodk/collect
INSERT INTO public.projects (
  author_id, title, description, repo_url, license, technologies, tags, stars, github_stars, last_activity
)
VALUES (
  'a0000000-0000-0000-0000-0000000000b0'::uuid,
  $bondev$ODK Collect$bondev$,
  $bondev$Application Android pour remplir des formulaires sans connexion et envoyer les réponses plus tard, quand le réseau revient.$bondev$,
  $bondev$https://github.com/getodk/collect$bondev$,
  $bondev$Autre$bondev$,
  ARRAY[$bondev$Kotlin$bondev$]::text[],
  ARRAY[$bondev$hors-ligne$bondev$, $bondev$collecte de données$bondev$, $bondev$mobile$bondev$, $bondev$faible connexion$bondev$]::text[],
  0,
  801,
  $bondev$2026-11-04T01:12:13.000Z$bondev$::timestamptz
)
ON CONFLICT (lower(repo_url)) WHERE repo_url <> '' DO NOTHING;

-- ODK Central — https://github.com/getodk/central
INSERT INTO public.projects (
  author_id, title, description, repo_url, license, technologies, tags, stars, github_stars, last_activity
)
VALUES (
  'a0000000-0000-0000-0000-0000000000b0'::uuid,
  $bondev$ODK Central$bondev$,
  $bondev$Serveur qui reçoit, gère et exporte les réponses aux formulaires ODK.$bondev$,
  $bondev$https://github.com/getodk/central$bondev$,
  $bondev$Apache-2.0$bondev$,
  ARRAY[$bondev$JavaScript$bondev$]::text[],
  ARRAY[$bondev$collecte de données$bondev$, $bondev$API$bondev$]::text[],
  0,
  232,
  $bondev$2026-11-03T19:44:10.000Z$bondev$::timestamptz
)
ON CONFLICT (lower(repo_url)) WHERE repo_url <> '' DO NOTHING;

-- DHIS2 — https://github.com/dhis2/dhis2-core
INSERT INTO public.projects (
  author_id, title, description, repo_url, license, technologies, tags, stars, github_stars, last_activity
)
VALUES (
  'a0000000-0000-0000-0000-0000000000b0'::uuid,
  $bondev$DHIS2$bondev$,
  $bondev$Système d'information sanitaire utilisé par de nombreux pays africains pour suivre et analyser les données de santé.$bondev$,
  $bondev$https://github.com/dhis2/dhis2-core$bondev$,
  $bondev$BSD-3-Clause$bondev$,
  ARRAY[$bondev$Java$bondev$]::text[],
  ARRAY[$bondev$santé$bondev$, $bondev$collecte de données$bondev$, $bondev$API$bondev$]::text[],
  0,
  360,
  $bondev$2026-11-04T14:29:53.000Z$bondev$::timestamptz
)
ON CONFLICT (lower(repo_url)) WHERE repo_url <> '' DO NOTHING;

-- OpenMRS — https://github.com/openmrs/openmrs-core
INSERT INTO public.projects (
  author_id, title, description, repo_url, license, technologies, tags, stars, github_stars, last_activity
)
VALUES (
  'a0000000-0000-0000-0000-0000000000b0'::uuid,
  $bondev$OpenMRS$bondev$,
  $bondev$Dossiers médicaux électroniques open source, pensés pour des contextes aux ressources limitées.$bondev$,
  $bondev$https://github.com/openmrs/openmrs-core$bondev$,
  $bondev$Autre$bondev$,
  ARRAY[$bondev$Java$bondev$]::text[],
  ARRAY[$bondev$santé$bondev$]::text[],
  0,
  1971,
  $bondev$2026-11-04T20:09:13.000Z$bondev$::timestamptz
)
ON CONFLICT (lower(repo_url)) WHERE repo_url <> '' DO NOTHING;

-- Community Health Toolkit — https://github.com/medic/cht-core
INSERT INTO public.projects (
  author_id, title, description, repo_url, license, technologies, tags, stars, github_stars, last_activity
)
VALUES (
  'a0000000-0000-0000-0000-0000000000b0'::uuid,
  $bondev$Community Health Toolkit$bondev$,
  $bondev$Outils pour les agents de santé communautaires, conçus pour fonctionner même hors-ligne.$bondev$,
  $bondev$https://github.com/medic/cht-core$bondev$,
  $bondev$AGPL-3.0$bondev$,
  ARRAY[$bondev$JavaScript$bondev$]::text[],
  ARRAY[$bondev$santé$bondev$, $bondev$hors-ligne$bondev$, $bondev$faible connexion$bondev$]::text[],
  0,
  563,
  $bondev$2026-11-04T19:53:40.000Z$bondev$::timestamptz
)
ON CONFLICT (lower(repo_url)) WHERE repo_url <> '' DO NOTHING;

-- CommCare HQ — https://github.com/dimagi/commcare-hq
INSERT INTO public.projects (
  author_id, title, description, repo_url, license, technologies, tags, stars, github_stars, last_activity
)
VALUES (
  'a0000000-0000-0000-0000-0000000000b0'::uuid,
  $bondev$CommCare HQ$bondev$,
  $bondev$Plateforme pour créer des applications mobiles de suivi de terrain qui fonctionnent hors-ligne.$bondev$,
  $bondev$https://github.com/dimagi/commcare-hq$bondev$,
  $bondev$BSD-3-Clause$bondev$,
  ARRAY[$bondev$Python$bondev$]::text[],
  ARRAY[$bondev$hors-ligne$bondev$, $bondev$collecte de données$bondev$, $bondev$santé$bondev$]::text[],
  0,
  525,
  $bondev$2026-11-04T20:25:05.000Z$bondev$::timestamptz
)
ON CONFLICT (lower(repo_url)) WHERE repo_url <> '' DO NOTHING;

-- Apache Fineract — https://github.com/apache/fineract
INSERT INTO public.projects (
  author_id, title, description, repo_url, license, technologies, tags, stars, github_stars, last_activity
)
VALUES (
  'a0000000-0000-0000-0000-0000000000b0'::uuid,
  $bondev$Apache Fineract$bondev$,
  $bondev$Cœur bancaire open source pour la microfinance et l'inclusion financière : clients, prêts, épargne.$bondev$,
  $bondev$https://github.com/apache/fineract$bondev$,
  $bondev$Apache-2.0$bondev$,
  ARRAY[$bondev$Java$bondev$]::text[],
  ARRAY[$bondev$microfinance$bondev$, $bondev$fintech$bondev$, $bondev$API$bondev$]::text[],
  0,
  2597,
  $bondev$2026-11-04T18:25:48.000Z$bondev$::timestamptz
)
ON CONFLICT (lower(repo_url)) WHERE repo_url <> '' DO NOTHING;

-- Mifos (application Android) — https://github.com/openMF/mifos-x-field-officer-app
INSERT INTO public.projects (
  author_id, title, description, repo_url, license, technologies, tags, stars, github_stars, last_activity
)
VALUES (
  'a0000000-0000-0000-0000-0000000000b0'::uuid,
  $bondev$Mifos (application Android)$bondev$,
  $bondev$Application mobile pour les agents de terrain de microfinance, reliée à Apache Fineract.$bondev$,
  $bondev$https://github.com/openMF/mifos-x-field-officer-app$bondev$,
  $bondev$MPL-2.0$bondev$,
  ARRAY[$bondev$Kotlin$bondev$]::text[],
  ARRAY[$bondev$microfinance$bondev$, $bondev$fintech$bondev$, $bondev$mobile$bondev$]::text[],
  0,
  249,
  $bondev$2026-11-04T15:05:45.000Z$bondev$::timestamptz
)
ON CONFLICT (lower(repo_url)) WHERE repo_url <> '' DO NOTHING;

-- Mojaloop — https://github.com/mojaloop/mojaloop
INSERT INTO public.projects (
  author_id, title, description, repo_url, license, technologies, tags, stars, github_stars, last_activity
)
VALUES (
  'a0000000-0000-0000-0000-0000000000b0'::uuid,
  $bondev$Mojaloop$bondev$,
  $bondev$Logiciel d'interopérabilité pour relier les systèmes de paiement mobile, les banques et les opérateurs.$bondev$,
  $bondev$https://github.com/mojaloop/mojaloop$bondev$,
  $bondev$Autre$bondev$,
  ARRAY[]::text[],
  ARRAY[$bondev$Mobile Money$bondev$, $bondev$paiement$bondev$, $bondev$fintech$bondev$, $bondev$API$bondev$]::text[],
  0,
  328,
  $bondev$2025-03-11T21:13:35.000Z$bondev$::timestamptz
)
ON CONFLICT (lower(repo_url)) WHERE repo_url <> '' DO NOTHING;

-- Flutterwave pour Node.js — https://github.com/Flutterwave/Node-v3
INSERT INTO public.projects (
  author_id, title, description, repo_url, license, technologies, tags, stars, github_stars, last_activity
)
VALUES (
  'a0000000-0000-0000-0000-0000000000b0'::uuid,
  $bondev$Flutterwave pour Node.js$bondev$,
  $bondev$Bibliothèque pour accepter des paiements (cartes, mobile money, virements) dans plusieurs pays africains.$bondev$,
  $bondev$https://github.com/Flutterwave/Node-v3$bondev$,
  $bondev$MIT$bondev$,
  ARRAY[$bondev$JavaScript$bondev$]::text[],
  ARRAY[$bondev$paiement$bondev$, $bondev$Mobile Money$bondev$, $bondev$API$bondev$]::text[],
  0,
  49,
  $bondev$2026-06-17T17:15:22.000Z$bondev$::timestamptz
)
ON CONFLICT (lower(repo_url)) WHERE repo_url <> '' DO NOTHING;

-- Africa's Talking (Node.js) — https://github.com/AfricasTalkingLtd/africastalking-node.js
INSERT INTO public.projects (
  author_id, title, description, repo_url, license, technologies, tags, stars, github_stars, last_activity
)
VALUES (
  'a0000000-0000-0000-0000-0000000000b0'::uuid,
  $bondev$Africa's Talking (Node.js)$bondev$,
  $bondev$SDK pour envoyer des SMS, gérer des menus USSD, passer des appels et recevoir des paiements via Africa's Talking.$bondev$,
  $bondev$https://github.com/AfricasTalkingLtd/africastalking-node.js$bondev$,
  $bondev$MIT$bondev$,
  ARRAY[$bondev$JavaScript$bondev$]::text[],
  ARRAY[$bondev$SMS$bondev$, $bondev$USSD$bondev$, $bondev$paiement$bondev$, $bondev$API$bondev$]::text[],
  0,
  167,
  $bondev$2026-10-09T07:20:23.000Z$bondev$::timestamptz
)
ON CONFLICT (lower(repo_url)) WHERE repo_url <> '' DO NOTHING;

-- Africa's Talking (Python) — https://github.com/AfricasTalkingLtd/africastalking-python
INSERT INTO public.projects (
  author_id, title, description, repo_url, license, technologies, tags, stars, github_stars, last_activity
)
VALUES (
  'a0000000-0000-0000-0000-0000000000b0'::uuid,
  $bondev$Africa's Talking (Python)$bondev$,
  $bondev$Le même SDK pour Python : SMS, USSD, voix et paiements via Africa's Talking.$bondev$,
  $bondev$https://github.com/AfricasTalkingLtd/africastalking-python$bondev$,
  $bondev$MIT$bondev$,
  ARRAY[$bondev$Python$bondev$]::text[],
  ARRAY[$bondev$SMS$bondev$, $bondev$USSD$bondev$, $bondev$paiement$bondev$, $bondev$API$bondev$]::text[],
  0,
  162,
  $bondev$2026-10-27T11:56:20.000Z$bondev$::timestamptz
)
ON CONFLICT (lower(repo_url)) WHERE repo_url <> '' DO NOTHING;

-- RapidPro — https://github.com/rapidpro/rapidpro
INSERT INTO public.projects (
  author_id, title, description, repo_url, license, technologies, tags, stars, github_stars, last_activity
)
VALUES (
  'a0000000-0000-0000-0000-0000000000b0'::uuid,
  $bondev$RapidPro$bondev$,
  $bondev$Plateforme pour construire des conversations par SMS et messageries, sans écrire de code.$bondev$,
  $bondev$https://github.com/rapidpro/rapidpro$bondev$,
  $bondev$Autre$bondev$,
  ARRAY[$bondev$Python$bondev$]::text[],
  ARRAY[$bondev$SMS$bondev$, $bondev$messagerie$bondev$, $bondev$humanitaire$bondev$]::text[],
  0,
  911,
  $bondev$2026-04-21T21:02:07.000Z$bondev$::timestamptz
)
ON CONFLICT (lower(repo_url)) WHERE repo_url <> '' DO NOTHING;

-- RapidSMS — https://github.com/rapidsms/rapidsms
INSERT INTO public.projects (
  author_id, title, description, repo_url, license, technologies, tags, stars, github_stars, last_activity
)
VALUES (
  'a0000000-0000-0000-0000-0000000000b0'::uuid,
  $bondev$RapidSMS$bondev$,
  $bondev$Framework Python (Django) pour créer des services par SMS.$bondev$,
  $bondev$https://github.com/rapidsms/rapidsms$bondev$,
  $bondev$BSD-3-Clause$bondev$,
  ARRAY[$bondev$Python$bondev$]::text[],
  ARRAY[$bondev$SMS$bondev$, $bondev$API$bondev$]::text[],
  0,
  660,
  $bondev$2025-05-22T14:54:46.000Z$bondev$::timestamptz
)
ON CONFLICT (lower(repo_url)) WHERE repo_url <> '' DO NOTHING;

-- Kolibri — https://github.com/learningequality/kolibri
INSERT INTO public.projects (
  author_id, title, description, repo_url, license, technologies, tags, stars, github_stars, last_activity
)
VALUES (
  'a0000000-0000-0000-0000-0000000000b0'::uuid,
  $bondev$Kolibri$bondev$,
  $bondev$Plateforme d'apprentissage qui fonctionne hors-ligne, pensée pour les écoles sans internet fiable.$bondev$,
  $bondev$https://github.com/learningequality/kolibri$bondev$,
  $bondev$MIT$bondev$,
  ARRAY[$bondev$Python$bondev$]::text[],
  ARRAY[$bondev$éducation$bondev$, $bondev$hors-ligne$bondev$, $bondev$faible connexion$bondev$]::text[],
  0,
  1167,
  $bondev$2026-11-02T23:30:58.000Z$bondev$::timestamptz
)
ON CONFLICT (lower(repo_url)) WHERE repo_url <> '' DO NOTHING;

-- Kiwix pour Android — https://github.com/kiwix/kiwix-android
INSERT INTO public.projects (
  author_id, title, description, repo_url, license, technologies, tags, stars, github_stars, last_activity
)
VALUES (
  'a0000000-0000-0000-0000-0000000000b0'::uuid,
  $bondev$Kiwix pour Android$bondev$,
  $bondev$Lire Wikipédia et d'autres contenus sans connexion, après les avoir téléchargés.$bondev$,
  $bondev$https://github.com/kiwix/kiwix-android$bondev$,
  $bondev$GPL-3.0$bondev$,
  ARRAY[$bondev$Kotlin$bondev$]::text[],
  ARRAY[$bondev$hors-ligne$bondev$, $bondev$éducation$bondev$, $bondev$mobile$bondev$]::text[],
  0,
  1527,
  $bondev$2026-11-04T18:09:15.000Z$bondev$::timestamptz
)
ON CONFLICT (lower(repo_url)) WHERE repo_url <> '' DO NOTHING;

-- Open edX — https://github.com/openedx/openedx-platform
INSERT INTO public.projects (
  author_id, title, description, repo_url, license, technologies, tags, stars, github_stars, last_activity
)
VALUES (
  'a0000000-0000-0000-0000-0000000000b0'::uuid,
  $bondev$Open edX$bondev$,
  $bondev$Plateforme de cours en ligne utilisée par des universités et organismes du monde entier.$bondev$,
  $bondev$https://github.com/openedx/openedx-platform$bondev$,
  $bondev$AGPL-3.0$bondev$,
  ARRAY[$bondev$Python$bondev$]::text[],
  ARRAY[$bondev$éducation$bondev$]::text[],
  0,
  8218,
  $bondev$2026-11-04T14:07:17.000Z$bondev$::timestamptz
)
ON CONFLICT (lower(repo_url)) WHERE repo_url <> '' DO NOTHING;

-- Moodle — https://github.com/moodle/moodle
INSERT INTO public.projects (
  author_id, title, description, repo_url, license, technologies, tags, stars, github_stars, last_activity
)
VALUES (
  'a0000000-0000-0000-0000-0000000000b0'::uuid,
  $bondev$Moodle$bondev$,
  $bondev$Plateforme d'apprentissage en ligne très répandue dans les écoles et les universités.$bondev$,
  $bondev$https://github.com/moodle/moodle$bondev$,
  $bondev$GPL-3.0$bondev$,
  ARRAY[$bondev$PHP$bondev$]::text[],
  ARRAY[$bondev$éducation$bondev$]::text[],
  0,
  7581,
  $bondev$2026-10-30T03:46:06.000Z$bondev$::timestamptz
)
ON CONFLICT (lower(repo_url)) WHERE repo_url <> '' DO NOTHING;

-- Masakhane MT — https://github.com/masakhane-io/masakhane-mt
INSERT INTO public.projects (
  author_id, title, description, repo_url, license, technologies, tags, stars, github_stars, last_activity
)
VALUES (
  'a0000000-0000-0000-0000-0000000000b0'::uuid,
  $bondev$Masakhane MT$bondev$,
  $bondev$Traduction automatique pour les langues africaines, issue d'une communauté de chercheurs du continent.$bondev$,
  $bondev$https://github.com/masakhane-io/masakhane-mt$bondev$,
  $bondev$MIT$bondev$,
  ARRAY[$bondev$Lua$bondev$]::text[],
  ARRAY[$bondev$langues africaines$bondev$, $bondev$IA$bondev$]::text[],
  0,
  329,
  $bondev$2022-06-14T18:49:35.000Z$bondev$::timestamptz
)
ON CONFLICT (lower(repo_url)) WHERE repo_url <> '' DO NOTHING;

-- Common Voice — https://github.com/common-voice/common-voice
INSERT INTO public.projects (
  author_id, title, description, repo_url, license, technologies, tags, stars, github_stars, last_activity
)
VALUES (
  'a0000000-0000-0000-0000-0000000000b0'::uuid,
  $bondev$Common Voice$bondev$,
  $bondev$Collecte ouverte de voix pour la reconnaissance vocale, y compris pour des langues africaines.$bondev$,
  $bondev$https://github.com/common-voice/common-voice$bondev$,
  $bondev$MPL-2.0$bondev$,
  ARRAY[$bondev$TypeScript$bondev$]::text[],
  ARRAY[$bondev$langues africaines$bondev$, $bondev$IA$bondev$]::text[],
  0,
  3499,
  $bondev$2026-11-04T19:18:56.000Z$bondev$::timestamptz
)
ON CONFLICT (lower(repo_url)) WHERE repo_url <> '' DO NOTHING;

-- PouchDB — https://github.com/apache/pouchdb
INSERT INTO public.projects (
  author_id, title, description, repo_url, license, technologies, tags, stars, github_stars, last_activity
)
VALUES (
  'a0000000-0000-0000-0000-0000000000b0'::uuid,
  $bondev$PouchDB$bondev$,
  $bondev$Base de données dans le navigateur qui se synchronise quand la connexion revient : idéale pour le hors-ligne.$bondev$,
  $bondev$https://github.com/apache/pouchdb$bondev$,
  $bondev$Apache-2.0$bondev$,
  ARRAY[$bondev$JavaScript$bondev$]::text[],
  ARRAY[$bondev$hors-ligne$bondev$, $bondev$faible connexion$bondev$]::text[],
  0,
  17624,
  $bondev$2026-11-04T15:07:26.000Z$bondev$::timestamptz
)
ON CONFLICT (lower(repo_url)) WHERE repo_url <> '' DO NOTHING;

-- Dexie.js — https://github.com/dexie/Dexie.js
INSERT INTO public.projects (
  author_id, title, description, repo_url, license, technologies, tags, stars, github_stars, last_activity
)
VALUES (
  'a0000000-0000-0000-0000-0000000000b0'::uuid,
  $bondev$Dexie.js$bondev$,
  $bondev$Simplifie l'utilisation d'IndexedDB pour stocker des données dans le navigateur, même sans connexion.$bondev$,
  $bondev$https://github.com/dexie/Dexie.js$bondev$,
  $bondev$Apache-2.0$bondev$,
  ARRAY[$bondev$TypeScript$bondev$]::text[],
  ARRAY[$bondev$hors-ligne$bondev$, $bondev$PWA$bondev$]::text[],
  0,
  14675,
  $bondev$2026-10-30T14:41:56.000Z$bondev$::timestamptz
)
ON CONFLICT (lower(repo_url)) WHERE repo_url <> '' DO NOTHING;

-- Workbox — https://github.com/GoogleChrome/workbox
INSERT INTO public.projects (
  author_id, title, description, repo_url, license, technologies, tags, stars, github_stars, last_activity
)
VALUES (
  'a0000000-0000-0000-0000-0000000000b0'::uuid,
  $bondev$Workbox$bondev$,
  $bondev$Outils pour mettre un site en cache et le rendre utilisable hors-ligne (PWA).$bondev$,
  $bondev$https://github.com/GoogleChrome/workbox$bondev$,
  $bondev$MIT$bondev$,
  ARRAY[$bondev$JavaScript$bondev$]::text[],
  ARRAY[$bondev$PWA$bondev$, $bondev$hors-ligne$bondev$, $bondev$faible connexion$bondev$]::text[],
  0,
  13042,
  $bondev$2026-10-29T21:43:40.000Z$bondev$::timestamptz
)
ON CONFLICT (lower(repo_url)) WHERE repo_url <> '' DO NOTHING;

-- farmOS — https://github.com/farmOS/farmOS
INSERT INTO public.projects (
  author_id, title, description, repo_url, license, technologies, tags, stars, github_stars, last_activity
)
VALUES (
  'a0000000-0000-0000-0000-0000000000b0'::uuid,
  $bondev$farmOS$bondev$,
  $bondev$Gestion d'exploitation agricole : parcelles, cultures, élevage et suivi des activités.$bondev$,
  $bondev$https://github.com/farmOS/farmOS$bondev$,
  $bondev$GPL-2.0$bondev$,
  ARRAY[$bondev$PHP$bondev$]::text[],
  ARRAY[$bondev$agriculture$bondev$]::text[],
  0,
  1383,
  $bondev$2026-10-31T22:05:34.000Z$bondev$::timestamptz
)
ON CONFLICT (lower(repo_url)) WHERE repo_url <> '' DO NOTHING;

-- ERPNext — https://github.com/frappe/erpnext
INSERT INTO public.projects (
  author_id, title, description, repo_url, license, technologies, tags, stars, github_stars, last_activity
)
VALUES (
  'a0000000-0000-0000-0000-0000000000b0'::uuid,
  $bondev$ERPNext$bondev$,
  $bondev$Logiciel de gestion complet (stocks, ventes, comptabilité, facturation) pour les petites et moyennes entreprises.$bondev$,
  $bondev$https://github.com/frappe/erpnext$bondev$,
  $bondev$GPL-3.0$bondev$,
  ARRAY[$bondev$Python$bondev$]::text[],
  ARRAY[$bondev$PME$bondev$, $bondev$comptabilité$bondev$, $bondev$stock$bondev$]::text[],
  0,
  40935,
  $bondev$2026-11-04T19:40:40.000Z$bondev$::timestamptz
)
ON CONFLICT (lower(repo_url)) WHERE repo_url <> '' DO NOTHING;

-- OpenCRVS — https://github.com/opencrvs/opencrvs-core
INSERT INTO public.projects (
  author_id, title, description, repo_url, license, technologies, tags, stars, github_stars, last_activity
)
VALUES (
  'a0000000-0000-0000-0000-0000000000b0'::uuid,
  $bondev$OpenCRVS$bondev$,
  $bondev$Système d'enregistrement des naissances, mariages et décès (état civil) open source.$bondev$,
  $bondev$https://github.com/opencrvs/opencrvs-core$bondev$,
  $bondev$Autre$bondev$,
  ARRAY[$bondev$TypeScript$bondev$]::text[],
  ARRAY[$bondev$état civil$bondev$, $bondev$API$bondev$]::text[],
  0,
  122,
  $bondev$2026-11-04T18:01:52.000Z$bondev$::timestamptz
)
ON CONFLICT (lower(repo_url)) WHERE repo_url <> '' DO NOTHING;

COMMIT;
