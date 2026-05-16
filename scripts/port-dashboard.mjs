#!/usr/bin/env node
/**
 * Porte le fichier ShadowPriestDashboardV2.tsx (export depuis Dust) vers
 * src/Dashboard.tsx en remplaçant les imports Dust par les imports standards.
 *
 * Usage:
 *   node scripts/port-dashboard.mjs <chemin-vers-ShadowPriestDashboardV2.tsx>
 *
 * Exemple:
 *   node scripts/port-dashboard.mjs ~/Downloads/ShadowPriestDashboardV2.tsx
 */
import fs from "node:fs";
import path from "node:path";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("❌ Usage: node scripts/port-dashboard.mjs <chemin-vers-ShadowPriestDashboardV2.tsx>");
  process.exit(1);
}
if (!fs.existsSync(inputPath)) {
  console.error(`❌ Fichier introuvable: ${inputPath}`);
  process.exit(1);
}

let src = fs.readFileSync(inputPath, "utf8");
const before = src.length;

// 1) Remplacer l'import "shadcn" combiné (UI + chart) par les imports modulaires.
//    Match TOUS les imports depuis "shadcn" (peu importe leur contenu).
const shadcnImports = [];
src = src.replace(
  /import\s*\{([^}]+)\}\s*from\s*["']shadcn["'];?\s*\n/g,
  (_m, names) => {
    shadcnImports.push(names.split(",").map((s) => s.trim()).filter(Boolean));
    return "";
  }
);

// Cartographie symbole -> module local
const SYMBOL_TO_MODULE = {
  Card: "@/components/ui/card",
  CardHeader: "@/components/ui/card",
  CardTitle: "@/components/ui/card",
  CardDescription: "@/components/ui/card",
  CardContent: "@/components/ui/card",
  Tabs: "@/components/ui/tabs",
  TabsList: "@/components/ui/tabs",
  TabsTrigger: "@/components/ui/tabs",
  TabsContent: "@/components/ui/tabs",
  Button: "@/components/ui/button",
  Badge: "@/components/ui/badge",
  Progress: "@/components/ui/progress",
  Separator: "@/components/ui/separator",
  Tooltip: "@/components/ui/tooltip",
  TooltipProvider: "@/components/ui/tooltip",
  TooltipTrigger: "@/components/ui/tooltip",
  TooltipContent: "@/components/ui/tooltip",
  ChartConfig: "@/components/ui/chart",
  ChartContainer: "@/components/ui/chart",
  ChartTooltip: "@/components/ui/chart",
  ChartTooltipContent: "@/components/ui/chart",
};

// Regroupe les imports par module
const byModule = {};
for (const names of shadcnImports) {
  for (const name of names) {
    const mod = SYMBOL_TO_MODULE[name];
    if (!mod) {
      console.warn(`⚠️  Symbole inconnu importé depuis "shadcn": ${name} (ignoré)`);
      continue;
    }
    byModule[mod] = byModule[mod] || new Set();
    byModule[mod].add(name);
  }
}

const newImports = Object.entries(byModule)
  .map(([mod, set]) => `import { ${[...set].join(", ")} } from "${mod}";`)
  .join("\n");

// 2) Remplacer @viz/lib/utils
src = src.replace(/from\s*["']@viz\/lib\/utils["']/g, 'from "@/lib/utils"');

// 3) Supprimer les imports Dust react-hooks (non utilisés en standalone)
src = src.replace(/import\s*\{[^}]*\}\s*from\s*["']@dust\/react-hooks["'];?\s*\n/g, "");

// 4) Insérer les nouveaux imports juste après le dernier import du fichier
const lastImportMatch = [...src.matchAll(/^import\s.*?;?\s*$/gm)].pop();
if (lastImportMatch) {
  const insertPos = lastImportMatch.index + lastImportMatch[0].length;
  src = src.slice(0, insertPos) + "\n" + newImports + src.slice(insertPos);
} else {
  src = newImports + "\n\n" + src;
}

// 5) Garantir un export default. Si la fonction principale s'appelle p.ex. "ShadowPriestDashboardV2",
//    on s'assure qu'elle est bien exportée par défaut.
if (!/export\s+default\s+/.test(src)) {
  // Cherche la dernière déclaration de composant function/const
  const compMatch = [...src.matchAll(/^(?:export\s+)?(?:function|const)\s+([A-Z][A-Za-z0-9_]*)/gm)].pop();
  if (compMatch) {
    src += `\n\nexport default ${compMatch[1]};\n`;
  }
}

// 6) Écriture
const outDir = path.resolve("src");
const outPath = path.join(outDir, "Dashboard.tsx");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, src);

console.log(`✅ Dashboard porté: ${outPath}`);
console.log(`   Taille: ${before}o → ${src.length}o`);
console.log(`   Modules d'imports générés:\n${Object.keys(byModule).map((m) => "    • " + m).join("\n")}`);
console.log("\nProchaines étapes:");
console.log("  npm install");
console.log("  npm run dev   # test local sur http://localhost:5173");
console.log("  git add . && git commit -m \"port dashboard\" && git push");
