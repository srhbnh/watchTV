# Import Sofa Time -> WatchNext

Importe `canonical.json` (ton historique Sofa Time fusionné) dans Supabase,
en résolvant chaque série sur TVmaze au passage.

## Prérequis

- Le schéma `watchnext_schema_proposal.sql` doit avoir été exécuté sur ton
  projet Supabase (ou l'équivalent si tu as adapté les noms de tables/colonnes
  — dans ce cas, adapte aussi `import.mjs` en conséquence).
- Node.js 18+ (pour `fetch` natif).

## Installation

```bash
npm install
cp .env.example .env
```

Remplis `.env` :
- `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` : Project Settings > API sur ton
  dashboard Supabase. La service role key contourne le RLS, donc à garder secrète
  et à ne jamais commit.
- `WATCHNEXT_USER_ID` : l'UUID de ton compte dans `auth.users` (visible dans
  Authentication > Users sur le dashboard).

## Lancer un essai à blanc (recommandé en premier)

```bash
npm run import:dry-run
```

N'écrit rien dans Supabase, mais interroge quand même TVmaze pour chaque titre
(ça prend du temps : ~1150 titres x 400ms ≈ 8 minutes) et génère
`import-report.json` avec :
- `unmatched` : titres introuvables sur TVmaze (à traiter à la main)
- `lowConfidenceMatches` : matchés par recherche de titre plutôt que par IMDB
  id (à vérifier, risque de faux positifs sur les titres génériques)

## Lancer l'import réel

```bash
npm run import
```

Le script est **idempotent** : tu peux le relancer (par exemple après avoir
corrigé des `unmatched` ou ajouté de nouveaux titres) sans créer de doublons.

## Limites connues

- Les films ne sont pas sur TVmaze (TVmaze = séries uniquement) : ils sont
  importés avec `tvmaze_id = null`, identifiés seulement par `tmdb_id`/`imdb_id`.
- Le matching par titre (fallback quand l'IMDB id ne donne rien) peut se
  tromper sur des titres très génériques ou des remakes. Vérifie
  `lowConfidenceMatches` dans le rapport.
- Les OVA/spéciaux (Season 0) que tu avais notés comme introuvables dans ton
  classeur Excel resteront probablement dans `unmatched` — c'est une limite
  des bases de données publiques (TMDB comme TVmaze), pas du script.
