# 🌑 Màlenïa — Shadow Priest Dashboard

Dashboard React (Vite + TypeScript + Tailwind + shadcn/ui + Recharts) déployé sur **GitHub Pages**.

## 🚀 Setup en 5 minutes

### 1. Récupérer ce repo

Tous les fichiers sont dans `conversation/malenia-dashboard/` côté Dust.
Télécharge-les (ou clone-les) localement dans un dossier `malenia-dashboard/`.

### 2. Récupérer le dashboard depuis Dust

- Depuis la conversation Dust, télécharge le fichier **`ShadowPriestDashboardV2.tsx`** (bouton de téléchargement).
- Place-le **à la racine du projet** (à côté de `package.json`).

### 3. Installer les dépendances et porter le dashboard

```bash
cd malenia-dashboard
npm install
npm run port-dashboard -- ./ShadowPriestDashboardV2.tsx
```

Le script remplace automatiquement :
- `from "shadcn"` → imports modulaires vers `@/components/ui/*`
- `from "@viz/lib/utils"` → `from "@/lib/utils"`
- Supprime `from "@dust/react-hooks"`
- Garantit un `export default`

### 4. Tester en local

```bash
npm run dev
```

Ouvre [http://localhost:5173](http://localhost:5173) → tu devrais voir le dashboard.

### 5. Créer le repo GitHub

1. Crée un repo **public** sur GitHub nommé **`malenia-dashboard`** (sans le créer avec un README ou .gitignore — on a les nôtres).
2. Initialise et push :

```bash
git init
git add .
git commit -m "Initial commit: Malenia Shadow Priest Dashboard"
git branch -M main
git remote add origin https://github.com/<TON_USER>/malenia-dashboard.git
git push -u origin main
```

### 6. Activer GitHub Pages

Sur GitHub :
- **Settings → Pages → Build and deployment → Source : GitHub Actions** ✅

Le workflow `.github/workflows/deploy.yml` se déclenche au push. Compte ~3 min pour le 1er build.

Une fois vert : 👉 **`https://<TON_USER>.github.io/malenia-dashboard/`**

---

## ⚙️ Si tu changes le nom du repo

Si tu nommes ton repo autrement (par ex. `wow-dashboard`), modifie **`vite.config.ts`** :

```ts
base: "/wow-dashboard/",  // doit matcher le nom du repo
```

---

## 🔄 Workflow de mise à jour hebdo

Quand tu refresh le dashboard côté Dust :

```bash
# 1. Re-télécharge le TSX depuis Dust
# 2. Re-porte
npm run port-dashboard -- ./ShadowPriestDashboardV2.tsx

# 3. Push
git add src/Dashboard.tsx
git commit -m "weekly refresh $(date +%Y-%m-%d)"
git push
```

GitHub Actions redéploie automatiquement en ~3 min.

---

## 🏗️ Structure du projet

```
malenia-dashboard/
├── .github/workflows/deploy.yml    # CI/CD GitHub Pages
├── index.html                       # Entry point HTML
├── package.json                     # Dépendances
├── postcss.config.js                # PostCSS (Tailwind)
├── tailwind.config.js               # Theme + couleurs charts
├── tsconfig.json / tsconfig.node.json
├── vite.config.ts                   # ⚠️ base path = nom du repo
├── scripts/
│   └── port-dashboard.mjs           # Script de migration auto
└── src/
    ├── main.tsx                     # Bootstrap React
    ├── Dashboard.tsx                # ⬅️ Généré par port-dashboard.mjs
    ├── index.css                    # Tailwind + variables shadcn
    ├── lib/utils.ts                 # cn() helper
    └── components/ui/               # shadcn components
        ├── card.tsx
        ├── tabs.tsx
        ├── button.tsx
        ├── badge.tsx
        ├── progress.tsx
        ├── separator.tsx
        ├── tooltip.tsx
        └── chart.tsx                # Wrapper Recharts custom
```

---

## 🐛 Troubleshooting

| Problème | Solution |
|---|---|
| 404 sur les assets en prod | Vérifier `base:` dans `vite.config.ts` = nom du repo |
| Page blanche en prod | Ouvrir DevTools, vérifier le chemin des JS/CSS (préfixe `/malenia-dashboard/`) |
| `Module not found: shadcn` après port | Re-lancer `npm run port-dashboard -- ...` (oublié l'étape) |
| Build OK mais charts cassés | Vérifier que `chart.tsx` est bien dans `src/components/ui/` |
| Workflow rouge | Onglet Actions → cliquer le run → lire les logs |

---

## 📝 Crédits

- Données : raider.io, murlok.io, WarcraftLogs, Archon.gg, Wowhead
- Build : Vite 5 + React 18 + Tailwind 3 + shadcn/ui + Recharts
- Refresh hebdo via Dust (agent Claude)
