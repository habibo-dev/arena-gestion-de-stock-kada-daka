# AutoStock — gestion de stock de pièces automobiles

Application web de gestion de stock pour un magasin de pièces détachées automobiles,
conçue pour remplacer un suivi Excel (« Liste des Articles ») par une base de données
relationnelle, tout en conservant le vocabulaire du métier : **Référence, Désignation,
Marque, Quantité, Prix d'Achat, Prix Gros, Prix Détail, UM, Rayon**.

Interface en français, montants en dinars (DA), dates au format français.

## Fonctionnalités

| Module | Contenu |
| --- | --- |
| Tableau de bord | Références, quantité totale, valeur du stock, stock faible, ruptures, ventes / achats du jour, évolution des ventes et du stock, top pièces, répartition par catégorie, derniers mouvements, alertes |
| Pièces | CRUD complet, duplication, archivage, image, références OEM / alternatives / fournisseur (cellules « A / B » découpées, valeur brute conservée), véhicules compatibles, historique des mouvements |
| Stock | Vue par statut (Disponible / Stock faible / Rupture), rayons, ajustements et transferts |
| Recherche intelligente | Recherche multi-champs tolérante (espaces, tirets, casse) sur références, désignations, marques, codes-barres et véhicules ; interprétation des requêtes libres (« plaquette frein clio », « bosch 0986 », « clio 4 1.5 dci ») ; abstraction prête pour un moteur IA/NLP |
| Recherche par image | Téléversement / caméra → OCR (Tesseract hors ligne, ou fournisseur distant via variables d'environnement) → extraction de références → résultats classés avec niveau de confiance et confirmation manuelle. Aucune identification n'est inventée |
| Mouvements | Chaque variation de stock crée un mouvement (type, quantité, avant / après, utilisateur, motif, document) |
| Ventes | Brouillon → Confirmée → Annulée ; prix gros / détail par ligne, remise, mode de paiement ; la confirmation déduit le stock, la survente est bloquée (sauf paramètre « stock négatif ») |
| Achats | Brouillon → Commandée → Reçue → Annulée ; la réception augmente le stock et met à jour le prix d'achat ; suggestions de réapprovisionnement |
| Fournisseurs | Fiche, achats, pièces fournies, historique |
| Véhicules & compatibilité | Marque, modèle, génération, années, motorisation, cylindrée, carburant, puissance, code moteur ; liens pièce ↔ véhicule **vérifiés** ou **à vérifier** (jamais inventés) |
| Rapports | État et valeur du stock, stock faible, ruptures, mouvements, ventes, achats, top ventes, rotation ; filtres de dates ; export Excel |
| Import / Export | Assistant d'import Excel (feuille → colonnes → correspondance → validation → doublons → confirmation), exports Excel avec en-têtes en français |
| Utilisateurs | Rôles Administrateur / Gérant / Employé, matrice des droits, activation / désactivation |
| Paramètres | Entreprise, stock négatif, tarif par défaut, préfixes de numérotation |

## Démarrage

```bash
npm install
cp .env.example .env.local     # facultatif : les valeurs par défaut fonctionnent
npm run dev                    # http://localhost:3000
```

La base SQLite (`data/autostock.db`) est créée et remplie de données de démonstration
au premier démarrage. Comptes de démonstration :

| Identifiant | Mot de passe | Rôle |
| --- | --- | --- |
| `admin` | `admin123` | Administrateur |
| `gerant` | `gerant123` | Gérant |
| `vendeur` | `vendeur123` | Employé |

Autres commandes : `npm run build` / `npm start` (production), `npm run lint`,
`npm run typecheck`, `npm run db:reset` (réinitialise et re-remplit la base de démo).

## Scénario de bout en bout

1. **Achats → Nouvel achat** : choisir un fournisseur, ajouter des pièces, *Réceptionner* →
   le stock augmente et un mouvement `Entrée achat` est créé.
2. **Recherche** : saisir `Clio 4 1.5 dCi` → le véhicule est reconnu et les pièces compatibles
   en stock sont listées.
3. **Ventes → Nouvelle vente** : ajouter la pièce (prix gros ou détail), *Confirmer* →
   le stock diminue, un mouvement `Sortie vente` est créé.
4. **Tableau de bord** : les indicateurs se mettent à jour et la pièce apparaît dans les
   alertes si elle passe sous son stock minimum.

## Déploiement (obtenir un lien partageable)

AutoStock est une application serveur (Node.js + base SQLite sur disque) : elle ne peut pas être
hébergée sur GitHub Pages. Trois options :

### Option 1 — Render (le plus simple, depuis GitHub)

[![Déployer sur Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/habibo-dev/arena-gestion-de-stock-kada-daka)

1. Cliquez sur le bouton (ou **New → Blueprint** dans Render et choisissez ce dépôt) ; le fichier
   `render.yaml` configure tout (Docker, disque persistant `/app/data`, variables).
2. Après quelques minutes, Render fournit une adresse du type `https://autostock.onrender.com`
   à partager. Connectez-vous avec `admin` / `admin123`, puis **changez les mots de passe**
   (Utilisateurs) avant de partager le lien.
3. Plan gratuit : mettez `plan: free` et retirez le bloc `disk` dans `render.yaml`
   (la base est alors réinitialisée avec la démo à chaque redémarrage).

### Option 2 — Railway / Fly.io / tout hébergeur Docker

Le `Dockerfile` est autodétecté. Montez un volume sur `/app/data` pour conserver les données,
et définissez `TZ=Africa/Algiers` (les hébergeurs injectent `PORT` automatiquement).

### Option 3 — Serveur / VPS (Docker Compose)

```bash
git clone https://github.com/habibo-dev/arena-gestion-de-stock-kada-daka.git && cd arena-gestion-de-stock-kada-daka
docker compose up -d --build        # → http://<ip-du-serveur>:3000
```

`docker-compose.yml` définit `COOKIE_SECURE=false` pour un accès en HTTP simple ; retirez cette
variable dès que l'application est servie en HTTPS (Caddy, Nginx…).

## Architecture

- **Next.js 15** (App Router, Server Components, Server Actions), **React 19**, **TypeScript strict**, **Tailwind CSS 4**.
- **SQLite** via `better-sqlite3` + **Drizzle ORM** (migrations dans `drizzle/`), index FTS5 trigram pour la recherche.
- `exceljs` pour l'import / export, `tesseract.js` pour l'OCR local, `recharts` pour les graphiques.

```
src/
  app/            routes (App Router) — (auth)/connexion, (app)/… , api/
  components/     UI (ui/), et composants par module (parts/, sales/, search/, …)
  hooks/          useDebounce, useQueryState, useUnsavedChanges, useAction
  lib/            utilitaires partagés client/serveur : formats, schémas zod, permissions, normalisation des références
  server/
    db/           schéma Drizzle, client, index de recherche, données de démonstration
    services/     logique métier (stock, ventes, achats, recherche, rapports, import/export…)
    actions/      Server Actions (validation zod → services → ActionResult)
    auth/         sessions et permissions
    vision/       abstraction « image → texte → références » (OCR local ou API distante)
```

Règles clés :

- Toute modification de quantité passe par `applyStockMovement` dans une transaction :
  il n'existe aucun chemin qui modifie `parts.quantity` sans mouvement.
- Les actions serveur vérifient les permissions (`requirePermission`) et retournent
  `{ ok: true, data } | { ok: false, error }` avec des messages en français.
- Les données de compatibilité portent un indicateur `verified` ; les pièces importées
  ou saisies sans source restent « à vérifier ».

## Variables d'environnement

Voir `.env.example`. Les clés d'API éventuelles (`VISION_API_URL`, `VISION_API_KEY`)
ne sont lues que côté serveur et ne sont jamais exposées au navigateur.
