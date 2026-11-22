# Politique de sécurité

## Versions prises en charge

Bondev est déployé en continu depuis la branche `dev`. Seule la version
actuellement en production reçoit des correctifs de sécurité.

| Version | Support |
| --- | --- |
| Production (`dev`) | ✅ |
| Anciennes révisions | ❌ |

## Signaler une vulnérabilité

**N'ouvre pas d'issue publique.** Utilise l'onglet **Security → Report a
vulnerability** du dépôt GitHub (GitHub Private Vulnerability Reporting). Si ce
canal n'est pas disponible, contacte le mainteneur via son profil GitHub
[@NGASSAKI003](https://github.com/NGASSAKI003).

Merci d'inclure :

- la surface concernée (interface, API Supabase, service worker, en-têtes,
  dépendance) ;
- les étapes de reproduction et l'impact observé ;
- la version ou le commit testé ;
- une preuve de concept minimale, sans données personnelles ni clé secrète.

Le mainteneur accuse réception sous 5 jours ouvrés et publie un correctif dès
que la vulnérabilité est confirmée. Aucune récompense financière n'est
proposée.

## Périmètre

Sont concernés :

- l'application à l'adresse
  [bondev.ngassakindzaa.workers.dev](https://bondev.ngassakindzaa.workers.dev) ;
- le code de ce dépôt ;
- les fonctions RPC et les politiques RLS de Supabase.

Ne sont pas concernés : les comptes de démonstration, les données de test, les
dépendances tierces (signale-les directement à leur mainteneur) et les
scénarios qui exigent un accès physique à l'appareil.

## Défenses en place

- **Clé publique uniquement.** Le navigateur ne reçoit que la clé publishable
  (`anon`). La clé `service_role` n'est jamais exposée, ni dans le code, ni dans
  les variables de build.
- **RLS activée.** Toutes les tables publiques ont des politiques par ligne.
  Les points passent exclusivement par des fonctions `SECURITY DEFINER` ; le
  client n'écrit jamais dans `points_ledger`.
- **CSP stricte.** `default-src 'self'`, scripts et polices locaux, connexions
  limitées à Supabase et `api.github.com`. L'origine Supabase est injectée au
  build depuis `VITE_SUPABASE_URL`, jamais codée en dur.
- **En-têtes.** `X-Frame-Options: DENY`, `frame-ancestors 'none'`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
  `Permissions-Policy`, `Cross-Origin-Opener-Policy` et HSTS.
- **Entrées validées.** Les formulaires valident les longueurs, les formats et
  les URL `https://` ; les liens externes utilisent
  `rel="noopener noreferrer"`. Aucun HTML utilisateur n'est injecté via
  `dangerouslySetInnerHTML`.
- **Service worker prudent.** Il ne met jamais en cache les requêtes
  authentifiées ni les réponses d'une autre origine, et purge les anciens
  caches à chaque déploiement.
- **Secrets.** `.env.local`, les jetons GitHub et les clés `service_role` sont
  ignorés par Git. Le workflow keepalive ne lit que des secrets GitHub et
  n'écrit aucune donnée.

## Bonnes pratiques pour les contributeurs

- Ne jamais committer de fichier `.env*` autre que `.env.example`.
- Ne jamais utiliser la clé `service_role` dans du code navigateur, un script
  de build ou une GitHub Action de ce dépôt.
- Signaler toute dépendance vulnérable via `npm audit` et une issue privée si
  l'exploitation est plausible.
- Faire passer `npm run lint`, `npm run typecheck`, `npm test` et
  `npm run build` avant toute pull request.
