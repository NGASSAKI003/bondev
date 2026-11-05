-- =============================================================================
-- Bondev – Migration 0004 : séparer les étoiles GitHub et l'usage sur Bondev
-- À exécuter APRÈS 0003_stats.sql. Sans danger : on peut la relancer.
-- Avant : la colonne « stars » mélangeait les étoiles GitHub (importées) et les
-- « Ça m'a servi » reçus sur Bondev, ce qui affichait par exemple « 14 675 utiles ».
-- Après : github_stars = étoiles sur GitHub ; stars = nombre de « Ça m'a servi » sur Bondev
-- (mark_project_used continue d'ajouter +1 à stars, comme avant).
-- =============================================================================
begin;

alter table public.projects add column if not exists github_stars int not null default 0;

-- Une seule fois : si github_stars n'a jamais été rempli, on y copie les anciennes étoiles
do $$
begin
  if not exists (select 1 from public.projects where github_stars > 0) then
    update public.projects set github_stars = stars;
  end if;
end $$;

-- stars = nombre réel de « Ça m'a servi » reçus sur Bondev
update public.projects p
   set stars = (select count(*) from public.project_uses u where u.project_id = p.id);

-- Catalogue de départ : on ne garde que le langage principal comme technologie
-- (les « topics » GitHub rendaient la liste des filtres illisible)
update public.projects
   set technologies = technologies[1:1]
 where author_id = 'a0000000-0000-0000-0000-0000000000b0'
   and cardinality(technologies) > 1;

alter table public.projects drop constraint if exists projects_github_stars_valid;
alter table public.projects add constraint projects_github_stars_valid check (github_stars >= 0);

commit;
