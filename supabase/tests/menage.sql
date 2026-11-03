-- =============================================================================
-- Bondev – Ménage avant la démo : supprime les données de TEST et neutralise
-- les comptes d'exemple. À exécuter UNE FOIS dans le SQL Editor de Supabase.
-- ATTENTION : supprime TOUTES les questions et réponses existantes (ce sont
-- des essais). Ne pas relancer quand de vrais utilisateurs auront posé des questions.
-- =============================================================================
begin;

-- 1. Les 3 comptes d'exemple ne doivent jamais pouvoir se connecter :
--    on remplace leur mot de passe connu par un mot de passe aléatoire inutilisable.
update auth.users
   set encrypted_password = crypt(gen_random_uuid()::text, gen_salt('bf'))
 where email in ('amadou@example.com', 'fatou@example.com', 'koffi@example.com');

-- 2. Comptes et projets créés uniquement par les tests
delete from auth.users where id in ('a0000000-0000-0000-0000-000000000098', 'a0000000-0000-0000-0000-000000000099');
delete from auth.users where email like 'bondev.test.%';
delete from public.projects
 where repo_url ilike 'https://github.com/test-securite/%'
    or repo_url ilike 'https://github.com/octocat/Hello-World';

-- 3. « Ça m'a servi » d'essai : on retire les étoiles ajoutées, puis les lignes
update public.projects p
   set stars = greatest(0, p.stars - (select count(*) from public.project_uses u where u.project_id = p.id));
delete from public.project_uses;

-- 4. Toutes les questions (les réponses partent avec) : ce sont des essais
delete from public.questions;

-- 5. Registre des points : on ne garde que l'inscription et les publications de projets existants
delete from public.points_ledger
 where reason in ('hold', 'refund', 'reward', 'free_question', 'project_used')
    or (reason = 'project_publish' and ref_id not in (select id from public.projects));

commit;

-- Vérification : Amadou 17, Fatou 14, Koffi 14, ton compte 5 (et rien d'autre) ; 10 projets ; 0 question
select p.pseudo, (select coalesce(sum(l.delta), 0) from public.points_ledger l where l.user_id = p.id) as solde
  from public.profiles p order by p.pseudo;
select (select count(*) from public.projects) as projets, (select count(*) from public.questions) as questions;
