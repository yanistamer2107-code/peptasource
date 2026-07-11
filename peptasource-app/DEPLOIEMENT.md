# Mettre PeptaSource en ligne (gratuit, sans ligne de commande)

Objectif : obtenir une **adresse web publique** (ex. `https://peptasource.onrender.com`).
Deux étapes : (1) mettre le code sur **GitHub**, (2) le déployer sur **Render**.
Compter 15–20 minutes la première fois.

---

## Étape 1 — Mettre le code sur GitHub

1. Décompressez `peptasource-app.zip` sur votre ordinateur (clic droit → Extraire tout).
2. Créez un compte gratuit sur **https://github.com** (si vous n'en avez pas).
3. En haut à droite, cliquez sur **+ → New repository**.
   - **Repository name** : `peptasource`
   - Laissez **Public** (ou Private), **ne cochez rien d'autre**, puis **Create repository**.
4. Sur la page du dépôt vide, cliquez sur le lien **« uploading an existing file »**
   (ou bouton **Add file → Upload files**).
5. Ouvrez le dossier décompressé, **sélectionnez tout ce qu'il contient**
   (les fichiers *et* le dossier `public/`), et **glissez-déposez** le tout dans la zone d'upload.
   - ⚠️ Envoyez bien le **contenu** du dossier (pas le dossier zip lui-même).
   - Inutile d'envoyer `node_modules` ou `data` : ils ne sont pas dans le zip, c'est normal.
6. En bas, cliquez sur **Commit changes**. Vos fichiers apparaissent dans le dépôt. ✅

---

## Étape 2 — Déployer sur Render

1. Allez sur **https://render.com** et cliquez **Get Started** →
   **« Sign in with GitHub »** (le plus simple : ça relie déjà votre compte GitHub).
2. Autorisez Render à accéder à vos dépôts (vous pouvez limiter au dépôt `peptasource`).
3. Dans Render, cliquez **+ New → Blueprint**.
   - Sélectionnez le dépôt **peptasource**.
   - Render détecte le fichier `render.yaml` inclus et pré-remplit tout automatiquement.
4. Il vous demandera de saisir **ADMIN_PASSWORD** → choisissez un **mot de passe fort**
   (c'est celui de votre espace admin ; notez-le).
5. Cliquez **Apply / Create**. Render installe et démarre le site (2–4 min).
6. Une fois « Live », votre URL s'affiche en haut, du type
   **`https://peptasource.onrender.com`**. Ouvrez-la : le site est en ligne ! 🎉

> Si le blueprint ne s'affiche pas, utilisez **+ New → Web Service** à la place :
> sélectionnez le dépôt, puis réglez **Build Command** = `npm install`,
> **Start Command** = `npm start`, et ajoutez les variables `NODE_ENV=production`,
> `ADMIN_PASSWORD=votre-mot-de-passe`. C'est tout.

---

## Se connecter à l'admin

- Boutique : `https://VOTRE-URL.onrender.com`
- Admin : `https://VOTRE-URL.onrender.com/admin`
- Identifiant : `admin@peptasource.example` · Mot de passe : celui saisi à l'étape 2-4.

La base (admin + catalogue) se crée **toute seule** au premier démarrage — rien à faire.

---

## À savoir sur l'offre gratuite Render

- **Mise en veille** : après ~15 min sans visite, le site s'endort ; la première visite
  suivante prend ~30–50 s à charger, puis c'est de nouveau rapide. Normal en gratuit.
- **Données non permanentes** : en offre gratuite, il n'y a pas de disque persistant.
  Le catalogue se recrée à chaque redémarrage, mais **les commandes et comptes créés en
  ligne sont effacés lors d'un redéploiement**. Parfait pour présenter/tester.
- **Pour une vraie mise en production** (données conservées), passez l'instance en plan
  payant et activez un **disque** monté sur `data/` (voir le commentaire dans `render.yaml`),
  ou migrez vers une base hébergée (PostgreSQL) — je peux m'en charger quand vous voudrez.

---

## Modifier le site plus tard

Deux façons :

1. **Via moi** : dites-moi les changements, je modifie le code et vous renvoie le dépôt à
   ré-uploader (ou je vous guide pour remplacer les fichiers sur GitHub). Render
   redéploie automatiquement à chaque mise à jour du dépôt.
2. **Vous-même sur GitHub** : ouvrez un fichier dans le dépôt → icône crayon ✏️ → modifiez
   → Commit. Render met le site à jour tout seul en quelques minutes.
