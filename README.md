# WatchNext

Ton suivi de séries, anime et films — hébergé chez toi, gratuitement, sans
dépendre d'un service qui peut fermer du jour au lendemain.

## Ce que fait cette V1

- **Connexion** par lien magique envoyé par email (pas de mot de passe à gérer)
- **Bibliothèque** avec 4 onglets : Vu / En cours / À voir / Abandonné
- **Détail d'une série** : coche épisode par épisode ce que tu as vu, saison
  par saison
- **À venir** : prochaines dates de diffusion des séries que tu suis
  (via TVmaze)
- **Ajouter** : recherche une série ou un anime et l'ajoute à ta bibliothèque

Les films ne sont pas couverts par la recherche (TVmaze ne référence que les
séries) — ils arrivent dans ta base uniquement via l'import de ton historique
Sofa Time (voir le dossier `watchnext-import`).

## 1. Installer en local (pour tester avant de déployer)

Prérequis : [Node.js](https://nodejs.org) (version 18 ou plus) installé sur
ton ordinateur.

```bash
npm install
cp .env.local.example .env.local
```

Remplis `.env.local` avec :
- `NEXT_PUBLIC_SUPABASE_URL` : Project Settings → Data API sur ton dashboard Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` : Project Settings → API Keys → clé `anon` / `public`
  (**pas** la `service_role`, celle-là ne doit jamais aller dans cette app)

Puis lance :

```bash
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000).

## 2. Configurer Supabase pour les liens de connexion

Dans ton dashboard Supabase → **Authentication → URL Configuration** :
- **Site URL** : mets `http://localhost:3000` pour l'instant (on le changera
  à l'étape 4 une fois déployé)
- **Redirect URLs** : ajoute `http://localhost:3000/auth/callback`

Sans ça, le lien magique reçu par email ne te reconnectera pas correctement.

## 3. Mettre le code sur GitHub

Le plus simple si tu n'as jamais utilisé Git en ligne de commande :
[GitHub Desktop](https://desktop.github.com/) — installe-le, connecte-toi
avec ton compte GitHub, choisis "Add local repository", pointe vers ce
dossier, puis "Publish repository" (laisse-le en privé).

Sinon en ligne de commande, depuis ce dossier :

```bash
git init
git add .
git commit -m "WatchNext v1"
git branch -M main
git remote add origin https://github.com/<ton-pseudo>/watchnext.git
git push -u origin main
```

(Crée d'abord le repo vide sur github.com avant le `git push`.)

## 4. Déployer sur Vercel

1. Sur [vercel.com](https://vercel.com), clique **Add New → Project**
2. Choisis ton repo `watchnext` sur GitHub
3. Dans **Environment Variables**, ajoute les deux mêmes variables que dans
   ton `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
4. Clique **Deploy**

Une fois déployé, Vercel te donne une URL du type
`https://watchnext-xxxx.vercel.app`. Retourne dans Supabase →
**Authentication → URL Configuration** et :
- Change **Site URL** pour cette URL Vercel
- Ajoute `https://watchnext-xxxx.vercel.app/auth/callback` dans **Redirect URLs**
  (garde aussi celle de localhost si tu veux continuer à tester en local)

## 5. Se créer un compte et importer l'historique

- Va sur ton URL Vercel, entre ton email, clique le lien reçu
- Une fois connecté, récupère ton **User ID** : dashboard Supabase →
  **Authentication → Users**, copie l'UUID à côté de ton email
- Utilise ce UUID comme `WATCHNEXT_USER_ID` dans le script d'import
  (`watchnext-import/.env`, voir son propre README) pour peupler ta
  bibliothèque avec tout ton historique Sofa Time d'un coup

## Limites connues de cette V1

- Pas de gestion multi-appareils avancée au-delà de l'auth (mais ça marche
  très bien sur mobile comme sur ordinateur, c'est juste un site responsive)
- Pas d'ajout de films via la recherche (TVmaze ne les couvre pas)
- Le calcul de "prochain épisode" ne fonctionne que pour les séries encore en
  diffusion sur TVmaze
