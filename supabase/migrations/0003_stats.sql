-- =============================================================================
-- Bondev – Migration 0003 : corrige l'affichage des statistiques (solde, total, niveau)
-- À exécuter APRÈS 0002_securite.sql. Sans danger : on peut la relancer.
-- Pourquoi : une vue ne peut pas appeler une fonction dont l'accès est interdit à
-- l'utilisateur connecté (erreur « permission denied for function get_balance »).
-- Solution : le total gagné et le niveau sont publics (ils servent de réputation),
-- et le solde passe par une fonction qui ne renvoie QUE celui de la personne connectée.
-- =============================================================================

-- Le solde de la personne connectée (jamais celui des autres)
CREATE OR REPLACE FUNCTION public.my_balance()
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN NULL ELSE public.get_balance(auth.uid()) END;
$$;

REVOKE ALL ON FUNCTION public.my_balance() FROM PUBLIC, anon, authenticated;
-- anon : la fonction renvoie NULL quand personne n'est connecté (aucune fuite)
GRANT EXECUTE ON FUNCTION public.my_balance() TO anon, authenticated;

-- Le total gagné d'un utilisateur est public (comme son niveau).
-- get_balance, lui, reste interdit aux utilisateurs : les soldes restent privés.
GRANT EXECUTE ON FUNCTION public.get_total_earned(uuid) TO anon, authenticated;

CREATE OR REPLACE VIEW public.profile_stats WITH (security_invoker = true) AS
SELECT
  p.id, p.pseudo, p.display_name, p.avatar_url,
  CASE WHEN p.id = auth.uid() THEN public.my_balance() END AS balance,
  public.get_total_earned(p.id) AS total_earned,
  public.level_for(public.get_total_earned(p.id)) AS level
FROM public.profiles p;

REVOKE ALL ON public.profile_stats FROM anon, authenticated;
GRANT SELECT ON public.profile_stats TO anon, authenticated;
