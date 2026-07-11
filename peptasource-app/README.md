# PeptaSource Labs — boutique B2B (peptides de recherche)

Application e-commerce complète : catalogue, **gestion de stock**, panier, commandes,
paiement **virement / crypto** avec validation manuelle, comptes **laboratoires à valider**,
et un **espace d'administration** complet (tableau de bord, produits & stock, commandes,
comptes labos, réglages de paiement).

> ⚠️ **Usage recherche uniquement (RUO).** Les produits présentés sont destinés à la
> recherche scientifique en laboratoire. La vente est réservée aux professionnels habilités.
> Vous êtes responsable du respect des réglementations applicables à votre activité et à
> votre juridiction, ainsi que des conditions d'utilisation de vos prestataires
> (banque, processeur de paiement, hébergeur).

---

## Stack technique

- **Node.js ≥ 22.5** (utilise le module SQLite intégré `node:sqlite`, aucune compilation native)
- **Express** pour le serveur et l'API
- **SQLite** pour la base de données (fichier `data/peptasource.db`)
- Front en **HTML/CSS/JS** pur (pas de build, pas de framework)
- Authentification par cookie **JWT**, mots de passe hachés avec **bcrypt**

---

## Démarrage en local (5 minutes)

```bash
# 1. Installer les dépendances
npm install

# 2. (Optionnel) créer un fichier .env à partir du modèle
cp .env.example .env      # puis éditez JWT_SECRET et ADMIN_PASSWORD

# 3. Initialiser la base (admin + produits) et des données de démo
npm run setup             # = seed + demo   (ou juste `npm run seed` sans démo)

# 4. Lancer le serveur
npm start
```

Ouvrez ensuite :

- Boutique : **http://localhost:3000**
- Espace labo : **http://localhost:3000/compte**
- Administration : **http://localhost:3000/admin**

**Identifiants admin par défaut** (à changer) : `admin@peptasource.example` / `admin1234`

---

## Mise en ligne

L'application est prête à être déployée. Deux points à savoir :

1. Renseignez les variables d'environnement `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
   et `NODE_ENV=production`.
2. SQLite écrit dans `data/`. Sur les hébergeurs « éphémères » (systèmes de fichiers
   remis à zéro à chaque déploiement), **attachez un disque persistant** pointant sur
   le dossier `data/`, sinon la base est réinitialisée à chaque mise à jour.

### Option A — Render (recommandé, offre gratuite)

1. Poussez ce dossier sur un dépôt GitHub.
2. Sur [render.com](https://render.com) → **New → Web Service** → sélectionnez le dépôt.
3. Réglages :
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Environment** → ajoutez `JWT_SECRET`, `ADMIN_PASSWORD`, `NODE_ENV=production`.
4. (Recommandé) **Disks** → ajoutez un disque monté sur `/opt/render/project/src/data`
   pour conserver la base entre les déploiements.
5. Après le premier déploiement, initialisez la base via le **Shell** de Render :
   `npm run seed` (et `npm run demo` si vous voulez les données d'exemple).

### Option B — Railway

1. [railway.app](https://railway.app) → **New Project → Deploy from GitHub**.
2. Railway détecte Node automatiquement. Ajoutez les variables d'environnement.
3. Ajoutez un **Volume** monté sur `/app/data` pour la persistance.
4. Lancez `npm run seed` une fois (onglet Shell / commande de démarrage temporaire).

### Option C — VPS (Ubuntu, etc.)

```bash
# Node 22+ requis
git clone <votre-repo> && cd peptasource-app
npm install
cp .env.example .env && nano .env      # secrets de production
npm run seed
# Lancer en tâche de fond (ex. avec pm2)
npm i -g pm2
pm2 start "npm start" --name peptasource
```

Placez un reverse-proxy (Nginx/Caddy) devant, avec HTTPS (Let's Encrypt), puis pointez
votre nom de domaine dessus.

---

## Configurer les paiements

Tout se fait dans **Admin → Paiement** (aucun code à toucher) :

- **Virement** : bénéficiaire, IBAN, BIC.
- **Crypto** : adresses Bitcoin (BTC) et USDT (TRC-20).

Au moment de commander, le client choisit son mode de règlement et reçoit une
**référence de commande** + les instructions. La commande reste `En attente de paiement`
jusqu'à ce que vous la passiez à `Payée` puis `Expédiée` depuis **Admin → Commandes**.

> Note : les processeurs de carte classiques (Stripe, PayPal…) refusent généralement ce
> secteur ; c'est pourquoi le flux repose sur virement/crypto avec validation manuelle.
> Vérifiez les conditions de votre banque avant toute mise en production commerciale.

---

## Fonctionnement du stock & des comptes

- Le stock est **décrémenté automatiquement** à la validation d'une commande.
- Annuler une commande non expédiée **réapprovisionne** le stock.
- Un nouveau compte labo est créé en statut **`pending`** : il peut naviguer mais **ne peut
  pas commander** tant qu'un admin ne l'a pas **validé** (Admin → Comptes labos).
- Seuils de stock faible configurables par produit (alertes sur le tableau de bord).

---

## Structure du projet

```
peptasource-app/
├── server.js          API + service des pages
├── db.js              schéma SQLite
├── seed.js            admin + produits + réglages par défaut
├── demo.js            données de démonstration (facultatif)
├── package.json
├── .env.example
└── public/
    ├── index.html     boutique (hero vidéo, catalogue, panier, checkout)
    ├── account.html   espace laboratoire (inscription/connexion, commandes)
    ├── admin.html     espace administration
    ├── styles.css     design system partagé
    ├── app.js         helpers (API + notifications)
    ├── vial.mp4       vidéo de fond
    └── poster.jpg     image de repli
```

## Principales routes de l'API

| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| POST | `/api/auth/register` | public | créer un compte labo |
| POST | `/api/auth/login` / `logout` | public | session |
| GET | `/api/products` | public | catalogue |
| POST | `/api/orders` | labo validé | passer commande (décrémente le stock) |
| GET | `/api/orders/mine` | connecté | mes commandes |
| GET | `/api/admin/stats` | admin | tableau de bord |
| GET/POST/PUT/DELETE | `/api/admin/products` | admin | produits & stock |
| GET/PATCH | `/api/admin/orders` | admin | commandes & statuts |
| GET/PATCH | `/api/admin/customers` | admin | valider les labos |
| GET/PUT | `/api/admin/settings` | admin | infos de paiement |

---

© 2026 PeptaSource Labs — modèle de démonstration à personnaliser.
