// PLACEHOLDER — sera remplacé par scripts/port-dashboard.mjs
// Exécute: npm run port-dashboard -- ~/Downloads/ShadowPriestDashboardV2.tsx
export default function Dashboard() {
  return (
    <div className="flex h-screen items-center justify-center p-8 text-center">
      <div className="space-y-4 max-w-xl">
        <h1 className="text-3xl font-bold">⚙️ Dashboard non encore porté</h1>
        <p className="text-muted-foreground">
          Exécute la commande suivante depuis la racine du projet :
        </p>
        <pre className="rounded-lg bg-muted p-4 text-left text-sm overflow-x-auto">
{`npm run port-dashboard -- ./ShadowPriestDashboardV2.tsx`}
        </pre>
        <p className="text-sm text-muted-foreground">
          (Télécharge d'abord <code>ShadowPriestDashboardV2.tsx</code> depuis Dust et place-le à la racine du repo.)
        </p>
      </div>
    </div>
  );
}
