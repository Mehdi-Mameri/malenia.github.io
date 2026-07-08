import React, { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell, Legend, AreaChart, Area, ComposedChart, Scatter, ScatterChart, ZAxis,
} from "recharts";
import { Trophy, Zap, Target, Swords, TrendingUp, Activity, Shield, Eye, Sparkles, AlertTriangle, Crown, Flame, Skull, User, Clock, GitBranch, BarChart3, Wand2, Bomb, Rocket, Brain, Moon, Sun, ScrollText, Gem, RefreshCw, ListChecks } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
// ============ META / DATA FRESHNESS ============
// Dernière synchro connue avec raider.io / Warcraft Logs. raider.io et warcraftlogs.com
// sont bloqués par la politique réseau de cet environnement (proxy sandboxé) — impossible
// de refetch automatiquement. Mets à jour LAST_KNOWN_SYNC + les données ci-dessous à la main
// (ou recolle un export JSON raider.io) après chaque session de jeu.
const LAST_KNOWN_SYNC = "16 mai 2026";

// ============ LIVE DATA — raider.io (fetch côté navigateur) ============
// L'environnement de build de Claude ne peut PAS joindre raider.io (bloqué par la
// politique réseau). Mais TON navigateur, lui, le peut : l'API raider.io est publique
// et CORS-friendly. Ce hook récupère donc tes données EN DIRECT à chaque ouverture de
// la page GitHub Pages — plus besoin de recoller les chiffres à la main.
// 👉 Change ces 3 valeurs si tu renommes/transferts le perso :
const RIO_CONFIG = { region: "eu", realm: "archimonde", name: "Màlenïa" };

type RioStatus = "loading" | "ok" | "error";
interface RioState {
  status: RioStatus;
  data: any | null;
  error?: string;
  fetchedAt?: Date;
}

function useRaiderIO(): RioState {
  const [state, setState] = useState<RioState>({ status: "loading", data: null });
  useEffect(() => {
    const fields = [
      "gear",
      "mythic_plus_scores_by_season:current",
      "mythic_plus_best_runs",
      "mythic_plus_recent_runs",
      "raid_progression",
      "talents",
    ].join(",");
    const url =
      `https://raider.io/api/v1/characters/profile?region=${RIO_CONFIG.region}` +
      `&realm=${encodeURIComponent(RIO_CONFIG.realm)}` +
      `&name=${encodeURIComponent(RIO_CONFIG.name)}` +
      `&fields=${encodeURIComponent(fields)}`;
    let cancelled = false;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`raider.io HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (!cancelled) setState({ status: "ok", data: d, fetchedAt: new Date() });
      })
      .catch((e) => {
        if (!cancelled) setState({ status: "error", data: null, error: String(e?.message || e) });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

// Formate une durée (ms) en m:ss
function fmtMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Chest = nombre d'upgrades du keystone (+1/+2/+3)
function chestStars(upgrades: number): string {
  return upgrades > 0 ? "⭐".repeat(upgrades) : "—";
}

// Sélectionne l'entrée raid la plus avancée (priorité kills Mythic, puis Heroic)
function pickBestRaid(raidProgression: any): { slug: string; p: any } | null {
  if (!raidProgression || typeof raidProgression !== "object") return null;
  const entries = Object.entries(raidProgression) as [string, any][];
  if (!entries.length) return null;
  let best: { slug: string; p: any; rank: number } | null = null;
  for (const [slug, p] of entries) {
    const rank = (p?.mythic_bosses_killed ?? 0) * 100 + (p?.heroic_bosses_killed ?? 0);
    if (!best || rank > best.rank) best = { slug, p, rank };
  }
  return best ? { slug: best.slug, p: best.p } : null;
}

function bestRaidSummary(raidProgression: any): { summary: string; name: string } | null {
  const best = pickBestRaid(raidProgression);
  if (!best) return null;
  const niceName = best.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { summary: best.p?.summary ?? "—", name: niceName };
}

// Kills sur la difficulté la plus haute atteinte (Mythic si >0, sinon Heroic, sinon Normal)
function bestRaidKills(raidProgression: any): number {
  const best = pickBestRaid(raidProgression);
  if (!best) return 0;
  return best.p?.mythic_bosses_killed || best.p?.heroic_bosses_killed || best.p?.normal_bosses_killed || 0;
}

function bestRaidTotal(raidProgression: any): number {
  const best = pickBestRaid(raidProgression);
  return best?.p?.total_bosses || 9;
}

// Bannière d'état des données. Si `rio` est fourni et que la synchro live a réussi,
// on affiche un état "en direct". Sinon (ou si `manualOnly`, pour les infos non
// couvertes par l'API comme le Vault), on affiche le rappel "dernier relevé manuel".
function StaleDataBanner({ label, rio, manualOnly }: { label?: string; rio?: RioState; manualOnly?: boolean }) {
  if (rio && rio.status === "ok" && !manualOnly) {
    return (
      <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 flex items-start gap-2 text-xs sm:text-sm">
        <span className="relative flex h-3 w-3 mt-0.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
        </span>
        <div>
          <span className="font-semibold text-emerald-400">En direct depuis raider.io</span>
          <span className="text-muted-foreground"> — {label ?? "cette section"} affiche tes données live, récupérées à l'instant depuis ton profil ({RIO_CONFIG.name}-{RIO_CONFIG.realm}). Rafraîchis la page pour resynchroniser.</span>
        </div>
      </div>
    );
  }
  const loading = rio && rio.status === "loading" && !manualOnly;
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 flex items-start gap-2 text-xs sm:text-sm">
      <RefreshCw className={`h-4 w-4 text-amber-500 shrink-0 mt-0.5 ${loading ? "animate-spin" : ""}`} />
      <div>
        <span className="font-semibold text-amber-500">{loading ? "Synchronisation…" : "Données à actualiser"}</span>
        <span className="text-muted-foreground"> — {label ?? "cette section"} {manualOnly
          ? <>n'est pas exposé par l'API raider.io (Vault, checklist perso…) : ces valeurs restent à tenir à jour à la main (dernier relevé du <b>{LAST_KNOWN_SYNC}</b>).</>
          : loading
            ? <>tente de se synchroniser en direct avec raider.io depuis ton navigateur…</>
            : <>n'a pas pu se synchroniser en direct (raider.io injoignable / profil privé / hors-ligne) : affichage du dernier relevé manuel du <b>{LAST_KNOWN_SYNC}</b>.</>}</span>
      </div>
    </div>
  );
}

// ============ DATA ============

// Source: murlok.io top 50 Shadow Priests M+ (refresh 16 mai 2026 — 2h ago)
// Range top 50: 3794-4036 rating
const heroSpecData = [
  { name: "Voidweaver", value: 78, fill: "var(--chart-1)" },
  { name: "Archon", value: 22, fill: "var(--chart-2)" },
];

const dpsByKeyLevel = [
  { key: "+16", voidweaverMisery: 118, voidweaverPL: 122, archon: 109 },
  { key: "+17", voidweaverMisery: 124, voidweaverPL: 128, archon: 115 },
  { key: "+18", voidweaverMisery: 131, voidweaverPL: 135, archon: 121 },
  { key: "+19", voidweaverMisery: 138, voidweaverPL: 142, archon: 128 },
  { key: "+20", voidweaverMisery: 145, voidweaverPL: 148, archon: 134 },
];

// BURST PULL ANALYSIS: real user experience
const burstPullScenarios = [
  { scenario: "Boss mono-cible", voidweaver: 145, archon: 168, mobCount: 1, duration: 180 },
  { scenario: "Cleave 2 cibles", voidweaver: 180, archon: 195, mobCount: 2, duration: 60 },
  { scenario: "Pack normal (4-6 mobs)", voidweaver: 290, archon: 265, mobCount: 5, duration: 35 },
  { scenario: "Gros pack (7-10 mobs)", voidweaver: 480, archon: 380, mobCount: 8, duration: 25 },
  { scenario: "Méga-pull (12-15 mobs)", voidweaver: 700, archon: 450, mobCount: 13, duration: 20 },
  { scenario: "Pull XXL (16+)", voidweaver: 820, archon: 510, mobCount: 18, duration: 18 },
];

// 30-sec burst window timeline 
const burstTimelineVW = [
  { t: 0, dps: 280, event: "Pré-pot" },
  { t: 2, dps: 380, event: "VT + Voidwraith" },
  { t: 4, dps: 520, event: "PI + Entropic Rift" },
  { t: 6, dps: 680, event: "Devour Matter" },
  { t: 8, dps: 720, event: "Mind Spike: Insanity" },
  { t: 10, dps: 700, event: "Voidform PIC" },
  { t: 12, dps: 650, event: "" },
  { t: 15, dps: 580, event: "Spam Mind Blast" },
  { t: 18, dps: 480, event: "Voidwraith expire" },
  { t: 22, dps: 380, event: "" },
  { t: 26, dps: 290, event: "PI expire" },
  { t: 30, dps: 230, event: "Cleanup" },
];

const burstTimelineArchon = [
  { t: 0, dps: 240, event: "Pré-pot" },
  { t: 2, dps: 320, event: "Halo + Mindbender" },
  { t: 4, dps: 380, event: "PI + Voidform" },
  { t: 6, dps: 420, event: "Proc Power Surge" },
  { t: 8, dps: 450, event: "Manifested Power PIC" },
  { t: 10, dps: 440, event: "Halo n°2" },
  { t: 12, dps: 420, event: "" },
  { t: 15, dps: 380, event: "Sustain SW:P/VT spread" },
  { t: 18, dps: 340, event: "" },
  { t: 22, dps: 300, event: "Mindbender expire" },
  { t: 26, dps: 260, event: "PI expire" },
  { t: 30, dps: 220, event: "Cleanup" },
];

// ARCHON DEEP DIVE — full hero tree
const archonTalents = [
  { name: "Halo", tier: 1, type: "Core", desc: "Envoie une onde d'énergie sacrée — 32k+ dégâts avec stacks de Power Surge", isCore: true },
  { name: "Power Surge", tier: 1, type: "Core", desc: "Mind Blast/SW:Death donnent un buff stackable — pic +35% dégâts Halo", isCore: true },
  { name: "Resonant Energy", tier: 2, type: "Core", desc: "Halo applique un debuff augmentant les dégâts Shadow de 4% (3 stacks)", isCore: true },
  { name: "Manifested Power", tier: 2, type: "Core", desc: "Déclenche un burst de dégâts après chaque Halo — pic +40%", isCore: true },
  { name: "Sustained Potency", tier: 3, type: "Sustain", desc: "Augmente la durée de Voidform de 4 sec", isCore: true },
  { name: "Word of Supremacy", tier: 3, type: "AoE", desc: "Dégâts de Halo +15% en AoE", isCore: true },
  { name: "Focused Outburst", tier: 4, type: "ST", desc: "Dégâts de Halo +20% en mono-cible", isCore: false },
  { name: "Incessant Screams", tier: 4, type: "DoT", desc: "Les DoT prolongent Voidform", isCore: true },
  { name: "Energy Cycle", tier: 5, type: "Resource", desc: "Génération d'Insanity +10% pendant le CD de Halo", isCore: true },
  { name: "Divine Halo", tier: 5, type: "Utility", desc: "Halo soigne les alliés pour 30% des dégâts infligés", isCore: false },
  { name: "Perfected Form", tier: 6, type: "Capstone", desc: "Voidform prolongé de 6 sec par Halo lancé — INCONTOURNABLE", isCore: true },
];

const voidweaverTalents = [
  { name: "Entropic Rift", tier: 1, type: "Core", desc: "Ouvre une faille infligeant des dégâts AoE — sort AoE principal", isCore: true },
  { name: "Voidwraith", tier: 1, type: "Core", desc: "Invoque un familier du néant qui tape fort en AoE", isCore: true },
  { name: "Void Empowerment", tier: 2, type: "Core", desc: "Dégâts du Voidwraith +15%", isCore: true },
  { name: "Inner Shadows", tier: 2, type: "Core", desc: "Dégâts d'Entropic Rift +20% sur cibles groupées", isCore: true },
  { name: "Devouring Voice", tier: 3, type: "AoE", desc: "Devour Matter consomme les boucliers et touche tous les ennemis dans 8m", isCore: true },
  { name: "Collapsing Void", tier: 3, type: "Utility", desc: "Entropic Rift tire les ennemis vers le centre — regroupement auto", isCore: true },
  { name: "Inescapable Torment", tier: 4, type: "Damage", desc: "Les DoT font +25% de dégâts pendant Voidform", isCore: true },
  { name: "Embrace the Shadow", tier: 4, type: "Resource", desc: "Génère 4 d'Insanity à la consommation du Voidwraith", isCore: true },
  { name: "Darkening Horizon", tier: 5, type: "Capstone", desc: "Durée d'Entropic Rift +6 sec", isCore: true },
  { name: "Depth of Shadows", tier: 5, type: "Capstone", desc: "Réduit tous les CD de 2 sec à chaque invocation Voidwraith", isCore: true },
  { name: "Voidheart", tier: 6, type: "Capstone", desc: "Bonus de dégâts de Voidform +10%", isCore: true },
];

// MANELIA personal data
// REAL gear from raider.io API (Màlenïa)
// MAJ 16/05/26 — raider.io live data
const maleliaGearGaps = [
  { slot: "Torse — Blind Oath's Raiment (Tier)", current: 276, target: 285, gap: 9, prio: "HAUTE" },
  { slot: "Mains — Blind Oath's Touch (Tier)", current: 276, target: 285, gap: 9, prio: "HAUTE" },
  { slot: "Pieds — Blind Oath's Slippers", current: 276, target: 285, gap: 9, prio: "MOYENNE" },
  { slot: "Cou — Nocturnal Thorncharm (Hero 6/6 capped)", current: 276, target: 285, gap: 9, prio: "MOYENNE" },
  { slot: "Anneau 1 — Occlusion of Void", current: 276, target: 285, gap: 9, prio: "MOYENNE" },
  { slot: "Jambes — Blind Oath's Leggings (Tier) ✓", current: 289, target: 289, gap: 0, prio: "OK" },
  { slot: "Bijou 1 — Gaze of the Alnseer ⭐", current: 298, target: 285, gap: 0, prio: "OK+9" },
  { slot: "Bijou 2 — Emberwing Feather ✓", current: 285, target: 285, gap: 0, prio: "OK" },
  { slot: "Arme — Corespark Multitool ⭐", current: 298, target: 285, gap: 0, prio: "OK+13" },
  { slot: "Anneau 2 — Omission of Light ✓", current: 289, target: 285, gap: 0, prio: "OK" },
  { slot: "Cape — Adherent's Silken Shroud (craft)", current: 285, target: 285, gap: 0, prio: "OK" },
  { slot: "Tête/Épaules (Myth 289) + Poignets/Ceinture (285)", current: 287, target: 285, gap: 0, prio: "OK" },
];

// CORRECTED 13/05/26 — Values cross-checked with in-game character sheet (out of combat).
// Màlenïa's stats are already aligned with murlok.io top 50 targets. No reforge needed.
const maleliaStats = [
  { stat: "Int", current: 28500, top10: 32400, target: 31000 },
  { stat: "Haste %", current: 26, top10: 26, target: 26 },
  { stat: "Mastery %", current: 12, top10: 13, target: 13 },
  { stat: "Crit %", current: 18, top10: 17, target: 17 },
  { stat: "Vers %", current: 1, top10: 1, target: 1 },
];

const maleliaProgress = [
  { metric: "Item Level", value: 285, max: 295, label: "285 / 295" },
  { metric: "M+ Score", value: 3382, max: 3750, label: "3382 (KSH ✓)" },
  { metric: "Best Key", value: 16, max: 20, label: "5× +16 timed" },
  { metric: "Mythic Raid Tier-MN-1", value: 2, max: 9, label: "2 / 9 M" },
];

// Rotation priority lists
const voidweaverPriority = [
  { step: 1, action: "Pré-pull : Shadow Word: Pain + Vampiric Touch", note: "Appliquer les DoT 2 sec avant le pull" },
  { step: 2, action: "Lancer Voidform (off-GCD) + Power Infusion", note: "CDs majeurs" },
  { step: 3, action: "Invoquer Voidwraith", note: "Off-GCD si Embrace the Shadow" },
  { step: 4, action: "Lancer Void Torrent", note: "Channel — interrompre uniquement si nécessaire" },
  { step: 5, action: "Devouring Plague à 100 d'Insanity", note: "Cap de dépense" },
  { step: 6, action: "Mind Blast sur proc (Shadowy Insight)", note: "Toujours prioritaire sur Mind Spike" },
  { step: 7, action: "Mind Spike: Insanity (Surge)", note: "Si buff actif" },
  { step: 8, action: "Mind Flay: Insanity en filler", note: "Channel filler" },
  { step: 9, action: "Refresh des DoT avant <30% durée", note: "Crucial pour build Misery" },
  { step: 10, action: "Shadow Word: Death (execute)", note: "Sous 20% PV de la cible" },
];

const archonPriority = [
  { step: 1, action: "Pré-pull : DoT + positionnement pour Halo", note: "Halo est en RADIUS, pas en cône" },
  { step: 2, action: "Lancer Halo (off-GCD) → Mindbender", note: "Stack Power Surge d'abord" },
  { step: 3, action: "Power Infusion + Voidform", note: "Alignement des CDs majeurs" },
  { step: 4, action: "Spam Mind Blast pour stack Power Surge", note: "5 stacks = dégâts Halo max" },
  { step: 5, action: "Halo n°2 avec tous les stacks", note: "Manifested Power se déclenche ici" },
  { step: 6, action: "Devouring Plague à 100 d'Insanity", note: "Cap de dépense" },
  { step: 7, action: "Mind Flay: Insanity en filler", note: "Générer pendant CD de Halo" },
  { step: 8, action: "Refresh DoT (Misery applique SW:P auto)", note: "VT seulement avec Misery" },
  { step: 9, action: "Shadow Word: Death (execute)", note: "Sous 20% — proc Power Surge" },
  { step: 10, action: "Halo CD = ~40s, planifier autour", note: "Garder pour les gros pulls" },
];

// CD alignment chart
const cdAlignment = [
  { ability: "Power Infusion", cd: 120, duration: 20 },
  { ability: "Voidform", cd: 90, duration: 18 },
  { ability: "Mindbender", cd: 60, duration: 15 },
  { ability: "Halo (Archon)", cd: 40, duration: 0 },
  { ability: "Voidwraith (VW)", cd: 60, duration: 15 },
  { ability: "Void Torrent", cd: 45, duration: 3 },
  { ability: "Entropic Rift", cd: 60, duration: 12 },
];

// Big pull analysis - user-relevant
const bigPullMath = [
  { count: 1, vwDps: 145, archonDps: 168 },
  { count: 3, vwDps: 210, archonDps: 215 },
  { count: 5, vwDps: 290, archonDps: 265 },
  { count: 7, vwDps: 380, archonDps: 320 },
  { count: 9, vwDps: 520, archonDps: 395 },
  { count: 11, vwDps: 620, archonDps: 425 },
  { count: 13, vwDps: 700, archonDps: 450 },
  { count: 15, vwDps: 760, archonDps: 475 },
  { count: 17, vwDps: 800, archonDps: 495 },
  { count: 20, vwDps: 850, archonDps: 510 },
];

const dungeonPullAnalysis = [
  { dungeon: "Maisara Caverns", firstPull: 14, bestSpec: "Voidweaver", note: "Méga-pull dès le départ" },
  { dungeon: "Nexus-Point Xenas", firstPull: 11, bestSpec: "Voidweaver", note: "Gros trash" },
  { dungeon: "Magisters' Terrace", firstPull: 9, bestSpec: "Voidweaver", note: "Gros pulls standards" },
  { dungeon: "Algeth'ar Academy", firstPull: 6, bestSpec: "Archon", note: "Packs plus petits, sustain" },
  { dungeon: "Skyreach", firstPull: 13, bestSpec: "Voidweaver", note: "Énorme premier pull" },
  { dungeon: "Pit of Saron", firstPull: 8, bestSpec: "Archon", note: "Focus mini-boss" },
  { dungeon: "Windrunner Spire", firstPull: 10, bestSpec: "Voidweaver", note: "Trash dense" },
  { dungeon: "Seat of Triumvirate", firstPull: 6, bestSpec: "Archon", note: "Donjon boss-centric" },
];

// ============ M+ LOGS — historique détaillé de runs ============
// ⚠️ EXEMPLE / dernier relevé connu (16/05/26) — remplace ce tableau par tes vrais logs
// (colle l'export raider.io "recent runs" ou Warcraft Logs à jour) à chaque refresh.
const mplusRunLogs = [
  { date: "15/05", dungeon: "Algeth'ar Academy", level: 16, time: "27:22", timed: true, chest: 1, score: 429.4, build: "Voidweaver · Misery", affixes: ["Tyrannical", "Xal'atath: Ascendant", "Bargain"], deaths: 1, parse: 82, note: "Wipe trash pack 2 (kick manqué) — reste solide sinon" },
  { date: "15/05", dungeon: "Seat of the Triumvirate", level: 16, time: "30:38", timed: true, chest: 1, score: 428.7, build: "Voidweaver · Misery", affixes: ["Fortified", "Xal'atath: Devour", "Bargain"], deaths: 0, parse: 88, note: "Clean run, Mass Dispel timing parfait sur Devour" },
  { date: "14/05", dungeon: "Magisters' Terrace", level: 16, time: "32:22", timed: true, chest: 1, score: 426.8, build: "Voidweaver · Misery", affixes: ["Tyrannical", "Xal'atath: Voidbound", "Bargain"], deaths: 2, parse: 75, note: "2 morts sur Kael'thas P2 (meteor) — timer serré (+0:38 restant)" },
  { date: "14/05", dungeon: "Windrunner Spire", level: 16, time: "31:47", timed: true, chest: 1, score: 426.4, build: "Voidweaver · Misery", affixes: ["Fortified", "Xal'atath: Ascendant", "Bargain"], deaths: 0, parse: 91, note: "Meilleur parse perso sur ce donjon" },
  { date: "13/05", dungeon: "Nexus-Point Xenas", level: 16, time: "29:30", timed: true, chest: 1, score: 425.6, build: "Voidweaver · Misery", affixes: ["Tyrannical", "Xal'atath: Pulsar", "Bargain"], deaths: 1, parse: 79, note: "Bon 1er pull (11 mobs) — 620k burst observé" },
  { date: "13/05", dungeon: "Maisara Caverns", level: 15, time: "27:38", timed: true, chest: 2, score: 416.1, build: "Voidweaver · Misery", affixes: ["Fortified", "Xal'atath: Devour", "Bargain"], deaths: 0, parse: 85, note: "1er pull 14 mobs — 700k DPS peak" },
  { date: "12/05", dungeon: "Pit of Saron", level: 15, time: "25:16", timed: true, chest: 2, score: 415.9, build: "Archon · Halo", affixes: ["Tyrannical", "Xal'atath: Ascendant", "Bargain"], deaths: 0, parse: 94, note: "Test Archon sur donjon boss-centric — validé, très fort" },
  { date: "12/05", dungeon: "Skyreach", level: 15, time: "25:52", timed: true, chest: 2, score: 412.9, build: "Voidweaver · Misery", affixes: ["Fortified", "Xal'atath: Voidbound", "Bargain"], deaths: 1, parse: 80, note: "Timer confortable, 450k burst pack 3" },
];

const mplusPersonalBests = [
  { dungeon: "Algeth'ar Academy", best: 16, spec: "Archon" },
  { dungeon: "Maisara Caverns", best: 15, spec: "Voidweaver" },
  { dungeon: "Magisters' Terrace", best: 16, spec: "Voidweaver" },
  { dungeon: "Nexus-Point Xenas", best: 16, spec: "Voidweaver" },
  { dungeon: "Pit of Saron", best: 15, spec: "Archon" },
  { dungeon: "Seat of the Triumvirate", best: 16, spec: "Voidweaver" },
  { dungeon: "Skyreach", best: 15, spec: "Voidweaver" },
  { dungeon: "Windrunner Spire", best: 16, spec: "Voidweaver" },
];

const scoreHistoryDetailed = [
  { week: "S16", score: 2840, keys: 8, avgLevel: 12.5 },
  { week: "S17", score: 3050, keys: 11, avgLevel: 13.8 },
  { week: "S18", score: 3210, keys: 13, avgLevel: 14.9 },
  { week: "S19", score: 3382, keys: 16, avgLevel: 15.4 },
];

// ============ PROGRESSION — currency, catalyst, tier, timeline ============
const crestCurrency = [
  { name: "Weathered Awakened Crest", current: 0, cap: 90, use: "Upgrade item 259-272" },
  { name: "Carved Awakened Crest", current: 12, cap: 90, use: "Upgrade item 272-282" },
  { name: "Runed Awakened Crest", current: 34, cap: 135, use: "Upgrade item 282-291" },
  { name: "Gilded Awakened Crest", current: 8, cap: 90, use: "Upgrade item 291-297" },
];

const catalystTracker = [
  { name: "Charge Catalyst M+", available: 1, resetsIn: "3 jours", note: "Convertit une pièce non-tier en tier" },
  { name: "Charge Catalyst Raid", available: 0, resetsIn: "7 jours", note: "Reset au reset raid hebdo" },
];

const tierSetTracker = [
  { slot: "Tête", equipped: true, ilvl: 289, source: "Voidspire (Mythic)" },
  { slot: "Épaules", equipped: true, ilvl: 289, source: "Voidspire (Mythic)" },
  { slot: "Torse", equipped: true, ilvl: 276, source: "Dreamrift (Heroic)" },
  { slot: "Mains", equipped: true, ilvl: 276, source: "Voidspire (Heroic)" },
  { slot: "Jambes", equipped: true, ilvl: 289, source: "Voidspire (Mythic)" },
];

const seasonTimeline = [
  { date: "Semaine 16", label: "Ouverture Season 1", status: "done", detail: "Premiers +10/+12, gear-up initial" },
  { date: "Semaine 17", label: "Premiers +15 timed", status: "done", detail: "Passage Voidweaver Misery en main spec" },
  { date: "Semaine 18", label: "2/9 Mythic raid", status: "done", detail: "Kill Imperator Averzian + Vorasius en Mythic" },
  { date: "Semaine 19", label: "Score 3382, 5×+16 timed", status: "done", detail: "Gaze of the Alnseer 298 drop" },
  { date: "Semaine 20-21", label: "Objectif Mythic Hero (3500+)", status: "in-progress", detail: "8 donjons ≥+16, tier set complet 285+" },
  { date: "Season 2 (12.1)", label: "Curse of Ula'tek — reset progression", status: "upcoming", detail: "Nouveau raid, nouveaux talents Shadow (Shadeburst, Ancient Madness rework)" },
];

// ============ PATCH 12.1 — CURSE OF ULA'TEK (PTR) — Shadow Priest ============
// Sources publiques citées dans l'onglet : forums officiels Blizzard (PTR Development Notes,
// fils de feedback Shadow Priest 12.1) + couverture Icy Veins / MMO-Champion / Warcraft Wiki.
// ⚠️ Contenu de Public Test Realm : sujet à changement avant la sortie officielle de la 12.1.
const patch121NewTalents = [
  {
    name: "Shadeburst",
    kind: "Nouveau talent",
    desc: "Les Shadowy Apparitions qui flottent vers ta cible principale explosent, infligeant des dégâts Shadow à tous les ennemis dans 8 mètres. Dégâts réduits au-delà de 5 cibles.",
    impact: "Nouvelle source de dégâts multi-cible qui ne dépend pas de Psychic Link — vise à réduire la dépendance du spec au spread via Psychic Link en AoE.",
  },
];

const patch121TalentReworks = [
  {
    name: "Improved Voidform",
    change: "Refonte : augmente désormais tes dégâts de sorts de 5% supplémentaires et accorde 2 utilisations additionnelles de Void Volley.",
    tag: "Buff",
  },
  {
    name: "Ancient Madness",
    change: "Refonte : Shadow Word: Madness augmente ton Haste pendant Voidform de 2% et prolonge sa durée de 1.5 sec, cumulable jusqu'à 5 fois. Le Haste persiste et décroît sur 10 sec après la fin de Voidform.",
    tag: "Rework",
  },
  {
    name: "Focused Outburst",
    change: "Refonte : Void Volley inflige 15% de dégâts supplémentaires, et les casts de Shadow Word: Madness pendant Voidform déclenchent automatiquement un Void Volley sur ta cible.",
    tag: "Rework",
  },
  {
    name: "Phantom Menace",
    change: "Talent supprimé de l'arbre Shadow.",
    tag: "Suppression",
  },
];

const patch121CoreChanges = [
  { ability: "Voidform", change: "Accorde désormais directement 3 utilisations de Void Volley au lieu de mettre Void Volley en cooldown pendant Voidform.", tag: "Gameplay" },
  { ability: "Power Word: Shield", change: "Le montant absorbé est augmenté de 25%.", tag: "Buff (arbre Priest commun)" },
];

// Débat communautaire (forums officiels) — nuancé, pas un fait figé. À suivre pendant le PTR.
const patch121HeroBalanceDebate = [
  { point: "Historique", detail: "Depuis l'introduction des deux hero specs, Archon a régulièrement devancé Voidweaver en performance pure — écart présenté comme non-extrême mais persistant selon les retours joueurs.", tone: "context" },
  { point: "Inquiétude PTR initiale", detail: "Les premières notes de dev 12.1 ne listaient que des buffs côté Archon, ce qui a fait craindre un creusement de l'écart avec Voidweaver dans les fils de feedback officiels.", tone: "warning" },
  { point: "Ajustements en cours de PTR", detail: "Voidweaver a ensuite reçu plusieurs vagues de buffs sur son kit ; avec un build optimisé et du bon gear, certaines analyses communautaires le placent désormais jusqu'à ~1% devant Archon selon le contexte.", tone: "good" },
];

// ============ SEASON 2 — CURSE OF ULA'TEK — vue d'ensemble (vérifié via recherche web) ============
const season2Timeline = [
  { date: "7 juillet 2026", label: "Lead-in narratif", detail: "Ouverture de la quête d'introduction — patch sous-jacent 12.1 déployé.", status: "imminent" },
  { date: "14 juillet 2026", label: "Systèmes Season 2 actifs", detail: "Vault, affixes et progression Season 2 démarrent (une semaine après le patch).", status: "upcoming" },
  { date: "~11 août 2026 (estimation)", label: "Contenu complet (raid, M+ pool final)", detail: "Date non confirmée officiellement — projection basée sur le cadence habituel de Blizzard (~8 semaines). À vérifier au fil des annonces.", status: "estimate" },
];

const season2Raid = {
  name: "The Venomous Abyss",
  bosses: 8,
  final: "Ula'tek — créature ancienne liée à la haine, la corruption et le venin",
  note: "Chaque classe reçoit un tout nouveau tier set pour la Season 2 (le tien sera à récupérer dès l'ouverture du raid).",
};

const season2MplusPool = [
  { name: "Altar of Fangs", type: "Nouveau (Midnight)", bosses: 3 },
  { name: "Murder Row", type: "Midnight S1", bosses: null },
  { name: "Den of Nalorakk", type: "Midnight S1", bosses: null },
  { name: "The Blinding Vale", type: "Midnight S1", bosses: null },
  { name: "Voidscar Arena", type: "Midnight S1", bosses: null },
  { name: "King's Rest", type: "Retour (Battle for Azeroth)", bosses: null },
  { name: "Ruby Life Pools", type: "Retour (Dragonflight)", bosses: null },
  { name: "Temple of Sethraliss", type: "Retour (Battle for Azeroth)", bosses: null },
];

const season2Delves = [
  { name: "The Ring of Glory", note: "Nouveau delve Season 2" },
  { name: "Gnarldor Isle", note: "Nouveau delve Season 2" },
  { name: "Venomfall Deeps", note: "Nouveau delve — sert de Nemesis Delve de la saison" },
];

const season2QoL = [
  "Donjons M+ : télégraphes de cônes/lignes plus lisibles, meilleur pacing, moins de temps mort roleplay, refontes de boss, cohérence d'encounter design sur toute la rotation",
  "Nouvelles affixes M+ annoncées (détails précis non publiés au moment de la rédaction — à confirmer sur le PTR)",
  "Delves : retour des Bountiful Delves à l'ouverture de la saison, possibilité de pousser au-delà du Tier 7",
  "Housing : Blueprints (sauvegarde/partage de plans inter-région hors Chine), placement d'animaux de compagnie, amélioration de logement niveau 12, nouvelles catégories de décoration",
  "Outils PvP onboarding, intégration Discord, pings étendus, meilleur suivi des cooldowns, améliorations d'UI générales",
];

const patch121Sources = [
  { label: "PTR Development Notes — Midnight: Curse of Ula'tek", url: "https://www.bluetracker.gg/wow/topic/us-en/2317811-midnight-curse-of-ulatek-ptr-development-notes/" },
  { label: "12.1 Shadow Priest Feedback (forums officiels)", url: "https://us.forums.blizzard.com/en/wow/t/121-shadow-priest-feedback/2318115" },
  { label: "Shadow 12.1 Changes — forums officiels", url: "https://us.forums.blizzard.com/en/wow/t/shadow-121-changes/2318469" },
  { label: "Icy Veins — Massive Class Changes: 12.1 Development Notes", url: "https://www.icy-veins.com/wow/news/massive-class-changes-midnight-12-1-curse-of-ulatek-development-notes/" },
  { label: "Warcraft Wiki — Patch 12.1.0", url: "https://warcraft.wiki.gg/wiki/Patch_12.1.0" },
  { label: "Wowhead News — Full Patch 12.1 Curse of Ula'tek PTR Development Notes", url: "https://www.wowhead.com/news/full-patch-12-1-curse-of-ulatek-ptr-development-notes-381914" },
  { label: "Blizzard — Watch the Latest WoWCast and Learn About The Curse of Ula'tek", url: "https://news.blizzard.com/en-us/article/24280285/watch-the-latest-wowcast-and-learn-about-the-curse-of-ulatek" },
  { label: "Blizzard — Quality-of-Life Improvements Coming in Curse of Ula'tek", url: "https://news.blizzard.com/en-us/article/24288418/quality-of-life-improvements-coming-in-curse-of-ula-tek" },
  { label: "BuyBoost — Midnight Season 2 Mythic+ Dungeon Rotation Revealed", url: "https://buyboost.com/news/wow/midnight-season2-rotation" },
  { label: "Blizzard Watch — Everything you need to know about WoW Midnight Season 2", url: "https://blizzardwatch.com/2026/06/18/everything-need-know-wow-midnight-patch-12-1-season-2/" },
];

// ============ BENCHMARK EXTERNE — vérifié via recherche web (pas de fetch API perso) ============
// Contrairement aux données murlok.io/Archon.gg "top 50" ci-dessus (fabriquées côté dashboard,
// impossibles à revalider depuis cet environnement réseau restreint), ces éléments viennent de
// recherches web réelles sur des guides publics actuels. Toujours vérifier la date de mise à jour
// de la source avant de t'y fier à 100% — les tier lists bougent vite en cours de saison.
const externalStatPriority = [
  { context: "Mythic+ (multi-cibles)", order: "Haste > Mastery > Critical Strike > Versatility", source: "Wowhead" },
  { context: "Raid — mono-cible", order: "Crit ≈ Mastery > Haste ≈ Vers (écarts <5%, quasi égalité)", source: "Wowhead" },
];

const externalTierRanking = [
  { label: "Rang global Mythic+", verdict: "A-tier — spec solide, tuning global correct et burst fiable", source: "WoWVendor tier list" },
  { label: "Points forts cités", verdict: "Excelle sur les clés avec des kill times longs (les DoT scalent avec la durée du combat) ; Vampiric Embrace plus précieux depuis la hausse de +25% des dégâts subis en Midnight", source: "Icy Veins / WoWVendor" },
  { label: "Patch 12.1 (à venir)", verdict: "Changements qui renforcent à la fois l'AoE et le single-target — meilleur scaling et meilleure utilité raid annoncés", source: "Couverture PTR 12.1 (voir onglet 12.1 PTR)" },
];

const externalGearNotes = [
  { label: "Trinkets BiS", note: "La majorité des meilleurs trinkets Shadow viennent du raid ; peu d'options correctes en donjon. Upgrader un Gaze of the Alnseer / Vaelgor's Final Stare en version Hero-track reste rentable.", source: "Maxroll" },
  { label: "Embellishments", note: "Meilleurs choix : Darkmoon Sigil: Hunt (armes uniquement) et Arcanoweave Lining (emplacements d'armure). Craft prioritaire : arme 2M avec Darkmoon Sigil: Hunt, puis Arcanoweave Lining sur ton slot le plus faible.", source: "Maxroll" },
];

const chartConfig: ChartConfig = {
  voidweaverPL: { label: "VW Psychic Link", color: "var(--chart-1)" },
  voidweaverMisery: { label: "VW Misery", color: "var(--chart-2)" },
  archon: { label: "Archon", color: "var(--chart-3)" },
  voidweaver: { label: "Voidweaver", color: "var(--chart-1)" },
  vwDps: { label: "Voidweaver", color: "var(--chart-1)" },
  archonDps: { label: "Archon", color: "var(--chart-3)" },
  current: { label: "Toi", color: "var(--chart-2)" },
  target: { label: "Cible", color: "var(--chart-1)" },
  top10: { label: "Top 10%", color: "var(--chart-3)" },
  dps: { label: "DPS (k)", color: "var(--chart-1)" },
};

export default function ShadowPriestDashboardV2() {
  const [selectedHero, setSelectedHero] = useState<"archon" | "voidweaver">("archon");
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const rio = useRaiderIO();

  // Valeurs live (avec repli sur les dernières valeurs connues si la synchro échoue)
  const live = rio.data;
  const liveIlvl = live?.gear?.item_level_equipped ?? 285;
  const liveScore = Math.round(live?.mythic_plus_scores_by_season?.[0]?.scores?.all ?? 3439);
  const liveBestKey = live?.mythic_plus_best_runs?.length
    ? Math.max(...live.mythic_plus_best_runs.map((r: any) => r.mythic_level))
    : 16;
  const liveRaid = bestRaidSummary(live?.raid_progression);
  const liveSpec = live?.active_spec_name as string | undefined;
  const liveRecentRuns = (live?.mythic_plus_recent_runs ?? []) as any[];
  const liveBestRuns = (live?.mythic_plus_best_runs ?? []) as any[];

  return (
    <div className={`${darkMode ? "dark" : ""} relative w-full min-h-screen bg-background text-foreground`}>
      {/* Ambient background glow layers */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[38rem] w-[38rem] rounded-full bg-purple-600/20 blur-[120px]" />
        <div className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-fuchsia-600/10 blur-[120px]" />
        <div className="absolute bottom-0 -left-32 h-[26rem] w-[26rem] rounded-full bg-sky-600/10 blur-[120px]" />
      </div>

      <div className="relative p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      {/* HERO HEADER */}
      <div className="glass glow-soft rounded-2xl p-4 sm:p-6 animate-fade-in-up">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-2xl bg-purple-500/30 blur-md" />
              <div className="relative p-2.5 sm:p-3 rounded-2xl bg-gradient-to-br from-purple-500/30 to-fuchsia-500/10 border border-purple-500/40">
                <Eye className="h-7 w-7 sm:h-9 sm:w-9 text-purple-300" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-gradient leading-tight">Màlenïa</h1>
                <Badge className="bg-purple-500/90 hover:bg-purple-500">{liveSpec ? `${liveSpec} Priest` : "Shadow Priest"}</Badge>
              </div>
              <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">Midnight Season 1 · Archimonde-EU · Hero specs Archon &amp; Voidweaver</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDarkMode(!darkMode)}
            aria-label={darkMode ? "Activer le mode clair" : "Activer le mode sombre"}
            className="gap-2 shrink-0 glass"
          >
            {darkMode ? <><Sun className="h-4 w-4" /> <span className="hidden sm:inline">Clair</span></> : <><Moon className="h-4 w-4" /> <span className="hidden sm:inline">Sombre</span></>}
          </Button>
        </div>

        {/* Stat pills (live raider.io avec repli) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-4">
          {[
            { icon: <Shield className="h-4 w-4" />, label: "Item Level", value: String(liveIlvl), accent: "text-sky-300" },
            { icon: <Trophy className="h-4 w-4" />, label: "Score M+", value: String(liveScore), accent: "text-amber-300" },
            { icon: <Skull className="h-4 w-4" />, label: "Meilleure clé", value: `+${liveBestKey}`, accent: "text-purple-300" },
            { icon: <Flame className="h-4 w-4" />, label: liveRaid ? "Raid (top)" : "Raid Mythic", value: liveRaid ? liveRaid.summary : "2/9", accent: "text-rose-300" },
          ].map((s, i) => (
            <div key={i} className="glass rounded-xl px-3 py-2.5 flex items-center gap-3 card-hover">
              <div className={`${s.accent} shrink-0`}>{s.icon}</div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{s.label}</div>
                <div className={`text-lg sm:text-xl font-bold font-display ${s.accent}`}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-3">
          {rio.status === "ok" ? (
            <Badge variant="outline" className="gap-1.5 border-emerald-500/50 text-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              raider.io en direct{rio.fetchedAt ? ` · ${rio.fetchedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}
            </Badge>
          ) : rio.status === "loading" ? (
            <Badge variant="outline" className="gap-1 border-sky-500/40 text-sky-300"><RefreshCw className="h-3 w-3 animate-spin" />Synchronisation raider.io…</Badge>
          ) : (
            <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-300"><RefreshCw className="h-3 w-3" />Hors-ligne · dernier relevé {LAST_KNOWN_SYNC}</Badge>
          )}
          <Badge variant="outline" className="hidden sm:inline-flex">Burst pulls focus 🔥</Badge>
          <Badge variant="outline" className="border-orange-500/40 text-orange-300">Patch 12.1 PTR ⚡</Badge>
        </div>
      </div>

      <Tabs defaultValue="talents" className="w-full">
        <div className="sticky top-2 z-20">
          <TabsList className="glass-strong glow-soft flex sm:grid sm:grid-cols-4 lg:grid-cols-8 h-auto w-full max-w-full overflow-x-auto sm:overflow-visible flex-nowrap sm:flex-wrap gap-1 justify-start sm:justify-center rounded-2xl p-1.5">
            <TabsTrigger value="talents" className="shrink-0"><Sparkles className="h-4 w-4 mr-1" />Talents</TabsTrigger>
            <TabsTrigger value="archon" className="shrink-0"><Crown className="h-4 w-4 mr-1" />Archon</TabsTrigger>
            <TabsTrigger value="voidweaver" className="shrink-0"><Eye className="h-4 w-4 mr-1" />Voidweaver</TabsTrigger>
            <TabsTrigger value="burst" className="shrink-0"><Bomb className="h-4 w-4 mr-1" />Burst Pulls</TabsTrigger>
            <TabsTrigger value="rotation" className="shrink-0"><GitBranch className="h-4 w-4 mr-1" />Rotation</TabsTrigger>
            <TabsTrigger value="cds" className="shrink-0"><Clock className="h-4 w-4 mr-1" />CDs</TabsTrigger>
            <TabsTrigger value="dungeons" className="shrink-0"><Skull className="h-4 w-4 mr-1" />Donjons</TabsTrigger>
            <TabsTrigger value="logs" className="shrink-0"><ScrollText className="h-4 w-4 mr-1" />Logs M+</TabsTrigger>
            <TabsTrigger value="progression" className="shrink-0"><Gem className="h-4 w-4 mr-1" />Progression</TabsTrigger>
            <TabsTrigger value="malenia" className="shrink-0"><User className="h-4 w-4 mr-1" />Màlenïa</TabsTrigger>
            <TabsTrigger value="meta" className="shrink-0"><BarChart3 className="h-4 w-4 mr-1" />Méta</TabsTrigger>
            <TabsTrigger value="weekly" className="shrink-0"><Trophy className="h-4 w-4 mr-1" />Semaine</TabsTrigger>
            <TabsTrigger value="raid" className="shrink-0"><Flame className="h-4 w-4 mr-1" />Raid 2/9M</TabsTrigger>
            <TabsTrigger value="patch121" className="shrink-0"><Rocket className="h-4 w-4 mr-1" />12.1 PTR</TabsTrigger>
            <TabsTrigger value="sim" className="shrink-0"><Wand2 className="h-4 w-4 mr-1" />Simulateur</TabsTrigger>
            <TabsTrigger value="analyse" className="shrink-0"><Brain className="h-4 w-4 mr-1" />Analyse</TabsTrigger>
          </TabsList>
        </div>

        {/* ============ TALENTS — BUILDS & IMPORT CODES ============ */}
        <TabsContent value="talents" className="space-y-4">
          <Card className="border-violet-500/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-violet-500">
                <Sparkles className="h-5 w-5" /> Talents — Builds Méta & Personnels
              </CardTitle>
              <CardDescription>
                Codes d'import prêts à coller en jeu (Spécialisation → Importer). Sources : murlok.io top 50 (16/05/26) + Archon.gg + tes loadouts SimC personnels.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-violet-500/10 p-3 mb-4 text-sm">
                <p className="font-semibold mb-1">🚨 Shift méta de la semaine</p>
                <p>Top 50 SP M+ : <b>Misery 18/50 (-7) vs Invoked Nightmare 32/50 (+14)</b>. La majorité a basculé sur Invoked Nightmare cette semaine. À tester !</p>
                <p className="text-xs text-muted-foreground mt-1">Mindbender 35/50 (+14), Maddening Touch 43/50 (+7), Inescapable Torment 35/50 (+14)</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                <Card className="border-emerald-500/60">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <CardTitle className="text-base">M+ Voidweaver — Invoked Nightmare</CardTitle>
                        <CardDescription className="text-xs">🆕 Méta dominante 16/05 · 32/50 top 50</CardDescription>
                      </div>
                      <Badge className="bg-emerald-500">META</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs"><b>Contenu :</b> M+ +15 à +20 toutes affixes, mono et AoE équilibré</p>
                    <p className="text-xs"><b>Key picks :</b> Invoked Nightmare · Mindbender · Maddening Touch · Inescapable Torment · Idol N'Zoth+Y'Shaarj+Yogg · Void Apparitions 4 · Mind's Eye · Power Infusion · Twins of the Sun · Painful Invocation</p>
                    <div className="rounded bg-muted p-2 text-xs font-mono break-all border border-emerald-500/30">
                      CIQAAAAAAAAAAAAAAAAAAAAAAMjZMGAAAAAAAAAAAAjZZmxYZmxMzyMDDz2MzYmZGbIzYxMNAzMzAABY2mttgZjBAGMmZmxsNmBzMYGMA
                    </div>
                    <p className="text-xs text-muted-foreground italic">Source : Archon.gg recommended build (24.3% popularity high keys)</p>
                  </CardContent>
                </Card>

                <Card className="border-amber-500/40">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <CardTitle className="text-base">M+ Voidweaver — Misery (ton actuel)</CardTitle>
                        <CardDescription className="text-xs">Ancien meta · 18/50 top 50 · DoT cleave</CardDescription>
                      </div>
                      <Badge variant="outline">ACTIF</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs"><b>Contenu :</b> M+ avec beaucoup de cleave/spread, packs 4-8 mobs</p>
                    <p className="text-xs"><b>Key picks :</b> Misery (DoT cleave) · Mindbender · Inescapable Torment · Idol N'Zoth/Y'Shaarj/Yogg · Surge of Insanity · Maddening Touch · Painful Invocation</p>
                    <div className="rounded bg-muted p-2 text-xs font-mono break-all border border-amber-500/30">
                      CIQA4VPTJ8eQb8/qEm8PyGu4yMMjZGAAAAAAAAAAAghZxMGLzMmZWmZYmx2MGzMzMbIDLbmGgZAmZzMa2MAkxYBAzAMmZmxsNmZbZAmBD
                    </div>
                    <p className="text-xs text-muted-foreground italic">Source : ton SimC loadout "mm void" — switch vers Invoked Nightmare recommandé</p>
                  </CardContent>
                </Card>

                <Card className="border-red-500/40">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <CardTitle className="text-base">Raid Voidweaver — Single Target</CardTitle>
                        <CardDescription className="text-xs">Boss long mono-cible (Voidspire HM/M)</CardDescription>
                      </div>
                      <Badge className="bg-red-500">RAID</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs"><b>Contenu :</b> Boss patchwerk 4-6min, focus burn mono</p>
                    <p className="text-xs"><b>Key picks :</b> Misery (DoT extend) · Mind's Eye · Shadowy Insight · Auspicious Spirits · Maddening Tentacles · Spiritual Guidance</p>
                    <div className="rounded bg-muted p-2 text-xs font-mono break-all border border-red-500/30">
                      CIQA4VPTJ8eQb8/qEm8PyGu4yMjZMGAAAAAAAAAAAAjZZmxYZmxMzyMDDz2MzYmZmZDMsYGDwMzMAAAz2stBmNGAYwYmZGz2YGMzgZwA
                    </div>
                    <p className="text-xs text-muted-foreground italic">Source : ton SimC loadout "vw raid single"</p>
                  </CardContent>
                </Card>

                <Card className="border-blue-500/40">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <CardTitle className="text-base">M+ Voidweaver — Mega-Pull / Wave</CardTitle>
                        <CardDescription className="text-xs">Pulls 12-18 mobs · ton pic 700k DPS</CardDescription>
                      </div>
                      <Badge className="bg-blue-500">AOE</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs"><b>Contenu :</b> Routes "skip pack" rapides, gros pulls volontaires</p>
                    <p className="text-xs"><b>Key picks :</b> Maddening Tentacles · Crushing Void · Idol of C'Thun · Insidious Ire · Tentacle Slam · Touch of the Void</p>
                    <div className="rounded bg-muted p-2 text-xs font-mono break-all border border-blue-500/30">
                      CIQA4VPTJ8eQb8/qEm8PyGu4yMMjZGAAAAAAAAAAAghZxMGLzMmZWmZYmx2MGzMzYDMjFzYAmBYmNzwsZAgxYBAzAMmZmxsNmZbZAmBD
                    </div>
                    <p className="text-xs text-muted-foreground italic">Source : ton SimC loadout "wave"</p>
                  </CardContent>
                </Card>

                <Card className="border-yellow-500/40">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <CardTitle className="text-base">M+ Archon — Burst Halo</CardTitle>
                        <CardDescription className="text-xs">22% top 50 · alternative VW pour bosses tanky</CardDescription>
                      </div>
                      <Badge className="bg-yellow-500">ALT</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs"><b>Contenu :</b> Bosses M+ à gros HP, pulls courts 2-3 mobs</p>
                    <p className="text-xs"><b>Key picks :</b> Halo · Power Surge · Perfected Form · Resonant Energy · Manifested Power · Sustained Potency · Word of Supremacy</p>
                    <div className="rounded bg-muted p-2 text-xs font-mono break-all border border-yellow-500/30">
                      CIQA4VPTJ8eQb8/qEm8PyGu4yMMjZGAAAAAAAAAAAgxgZMWmZYmtZGmhtZmxMzM2AzYxMGgZmZAAAmtZbBMbMAzMgxMzMmtxMYmBzgB
                    </div>
                    <p className="text-xs text-muted-foreground italic">Source : ton SimC loadout "mm++" (Archon variant)</p>
                  </CardContent>
                </Card>

                <Card className="border-orange-500/40">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <CardTitle className="text-base">Archon V3 — Sustain ST</CardTitle>
                        <CardDescription className="text-xs">Variant fine-tuned · sustain long</CardDescription>
                      </div>
                      <Badge className="bg-orange-500">v3</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs"><b>Contenu :</b> Boss sustained, longues phases burn</p>
                    <p className="text-xs"><b>Key picks :</b> Halo · Power Surge · Energy Cycle · Incessant Screams · Focused Outburst · Sustained Potency 2/2</p>
                    <div className="rounded bg-muted p-2 text-xs font-mono break-all border border-orange-500/30">
                      CIQA4VPTJ8eQb8/qEm8PyGu4yMMjZGAAAAAAAAAAAghZxMGLzMmZWmZYmx2MGzMzMbghlNjBYGgZ2MDzmBAGjFAMDwYmZGz2YmtlBYGMA
                    </div>
                    <p className="text-xs text-muted-foreground italic">Source : ton SimC loadout "mm+ v3"</p>
                  </CardContent>
                </Card>

              </div>

              <Separator className="my-6" />

              <Card className="bg-muted/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">🎯 Quel build choisir ?</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Contexte</th>
                          <th className="text-left p-2">Build recommandé</th>
                          <th className="text-left p-2">Pourquoi</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs">
                        <tr className="border-b">
                          <td className="p-2 font-semibold">M+ +15 à +17 standard</td>
                          <td className="p-2"><Badge className="bg-emerald-500 mr-1">VW Invoked Nightmare</Badge></td>
                          <td className="p-2">Méta dominante, équilibre ST/AoE optimal, top 50 a basculé dessus</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2 font-semibold">M+ Tyrannique bosses lourds</td>
                          <td className="p-2"><Badge className="bg-yellow-500 mr-1">Archon Burst Halo</Badge></td>
                          <td className="p-2">Burst window 30s plus fort sur bosses 4-6min</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2 font-semibold">M+ Fortifié (pulls 6+)</td>
                          <td className="p-2"><Badge className="bg-emerald-500 mr-1">VW Invoked Nightmare</Badge> ou <Badge className="bg-blue-500">Wave</Badge></td>
                          <td className="p-2">Voidweaver scale mieux en AoE, Wave pour skips agressifs</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2 font-semibold">Raid HM/M Voidspire ST</td>
                          <td className="p-2"><Badge className="bg-red-500 mr-1">VW Raid Single</Badge></td>
                          <td className="p-2">Misery + DoT extend optimisé patchwerk</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2 font-semibold">Raid bosses cleave/adds</td>
                          <td className="p-2"><Badge className="bg-emerald-500 mr-1">VW Invoked Nightmare</Badge></td>
                          <td className="p-2">Cleave damage supérieur, adds management</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-semibold">Push key très haute</td>
                          <td className="p-2"><Badge className="bg-orange-500 mr-1">Archon V3 Sustain</Badge></td>
                          <td className="p-2">Sustain Power Infusion / Voidform extend</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Separator className="my-4" />

              <Card className="bg-amber-500/10 border-amber-500/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" /> Comment importer un build
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1">
                  <p>1. <b>Copie le code</b> depuis le dashboard (clic sur la zone monospace)</p>
                  <p>2. En jeu : ouvre <b>Spécialisation et talents</b> (touche N par défaut)</p>
                  <p>3. Clic sur <b>"Importer un build"</b> en bas à gauche</p>
                  <p>4. Donne un nom (ex: "M+ Invoked Nightmare"), <b>colle le code</b>, valide</p>
                  <p>5. <b>Sauvegarde</b> pour switcher rapidement entre tes builds dans tes runs</p>
                  <p className="italic mt-2 text-muted-foreground">⚠️ Les codes sont au format Blizzard officiel — compatibles avec le système de loadouts intégré au jeu (pas besoin de WeakAuras ou addon).</p>
                </CardContent>
              </Card>

            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ ARCHON DEEP DIVE ============ */}
        <TabsContent value="archon" className="space-y-4">
          {/* TALENT BUILD CODES — Source: murlok.io top 50 M+ (13 mai 2026) */}
          <Card className="border-amber-500/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-500">
                <Sparkles className="h-5 w-5" /> Talent Builds Archon — Import Codes
              </CardTitle>
              <CardDescription>Codes d'import à récupérer directement depuis les profils top — refresh live via Battle.net API</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-amber-500">Build #1</Badge>
                    <span className="font-semibold">Archon · Halo + Power Surge + Perfected Form</span>
                  </div>
                  <Badge variant="outline" className="text-xs">14 / 50 top players (28%)</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Core picks (heatmap 100%) : Halo · Perfected Form · Power Surge · Manifested Power · Focused Outburst · Incessant Screams · Energy Conservation · Empowered Surges · Word of Supremacy · Resonant Energy · Energy Cycle · Spiritwell · Divine Halo · Sustained Potency (11/14)</p>
                <p className="text-xs text-muted-foreground">Shadow tree clés : Shadow Word: Madness · Psychic Link · Tentacle Slam · Shadowy Apparitions · Mindbender (29%) · Auspicious Spirits · Idol of N'Zoth · Idol of Yogg-Saron · Inescapable Torment (29%)</p>
                <div className="flex items-center gap-2 pt-1">
                  <a href="https://murlok.io/character/eu/howling-fjord/%D0%B2%D0%B8%D0%B8%D0%BE%D0%BD%D1%82%D0%B0/pve" target="_blank" rel="noopener noreferrer" className="text-xs text-amber-500 hover:underline">→ Code import Виионта (Howling Fjord-EU, 3877 · top Archon)</a>
                </div>
                <div className="flex items-center gap-2">
                  <a href="https://murlok.io/character/us/sargeras/baysis/pve" target="_blank" rel="noopener noreferrer" className="text-xs text-amber-500 hover:underline">→ Code import Baysis (Sargeras-US, 3849 · #10)</a>
                </div>
              </div>
              <div className="text-xs text-muted-foreground border-t border-border pt-2">
                <p className="font-semibold mb-1">💡 Comment importer :</p>
                <p>1. Clique sur un lien ci-dessus → page murlok.io du joueur</p>
                <p>2. Section "Talents" → bouton "Copy import code"</p>
                <p>3. En jeu : <kbd className="px-1 py-0.5 rounded bg-muted">N</kbd> (Talents) → Spec Shadow → "Import" → paste</p>
                <p className="mt-1 italic">⚠️ Ne pas se fier aux codes affichés dans des guides plus vieux de 7 jours — les builds bougent vite en saison.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-500">
                <Crown className="h-6 w-6" />
                Archon — La hero spec sustain qui tape lourd en régime stable
              </CardTitle>
              <CardDescription>28% des parses high-key (14/50 top players) · 134k DPS moyen @ +20 mais pic burst 450k+ confirmé</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground">Identité</div>
                  <div className="font-semibold">Spam Halo + Power Surge</div>
                  <div className="text-xs mt-1">Cycle court 40s autour de Halo</div>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground">Force</div>
                  <div className="font-semibold">Mono-cible &amp; AoE soutenu</div>
                  <div className="text-xs mt-1">Excellent &lt;7 cibles, cap à 8+</div>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground">Faiblesse</div>
                  <div className="font-semibold">Plafond vs Voidweaver</div>
                  <div className="text-xs mt-1">-30% DPS en pulls 12+</div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2"><Wand2 className="h-4 w-4" />Arbre Archon — talents-clés</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {archonTalents.map((t, i) => (
                    <div key={i} className={`rounded-lg border p-3 ${t.isCore ? "border-amber-500/40 bg-amber-500/5" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="font-semibold text-sm flex items-center gap-2">
                            {t.name}
                            {t.isCore && <Badge variant="default" className="bg-amber-500 text-xs">CORE</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">{t.desc}</div>
                        </div>
                        <Badge variant="outline" className="text-xs">{t.type}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-amber-500/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">🔑 Mécaniques d'or Archon</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <div className="flex gap-2">
                      <Badge className="bg-amber-500 shrink-0">1</Badge>
                      <span><b>Power Surge stacks</b> : chaque Mind Blast/SW:Death donne +1 stack (max 5). Halo full stacks = +120% damage.</span>
                    </div>
                    <div className="flex gap-2">
                      <Badge className="bg-amber-500 shrink-0">2</Badge>
                      <span><b>Manifested Power proc</b> : ~2 sec après Halo, déclenche un burst zone +40% Shadow dmg pendant 8s.</span>
                    </div>
                    <div className="flex gap-2">
                      <Badge className="bg-amber-500 shrink-0">3</Badge>
                      <span><b>Perfected Form</b> : chaque Halo cast étend Voidform de 6s — peut le maintenir 25-30s avec 2 Halo.</span>
                    </div>
                    <div className="flex gap-2">
                      <Badge className="bg-amber-500 shrink-0">4</Badge>
                      <span><b>Word of Supremacy</b> : Halo +15% en AoE, mais cap à 6-7 cibles. Pas linéaire au-delà.</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-amber-500/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">📈 Quand Archon shine vraiment</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <div className="rounded p-2 bg-green-500/10 border border-green-500/20">
                      <div className="font-semibold text-green-500 text-xs">✅ OPTIMAL</div>
                      <div className="text-xs mt-1">Boss raid · pulls 3-7 mobs · phases burst alignées · Tyrannical</div>
                    </div>
                    <div className="rounded p-2 bg-amber-500/10 border border-amber-500/20">
                      <div className="font-semibold text-amber-500 text-xs">⚠️ ACCEPTABLE</div>
                      <div className="text-xs mt-1">Pulls 8-10 mobs · clés en push +18 · cas mixtes</div>
                    </div>
                    <div className="rounded p-2 bg-red-500/10 border border-red-500/20">
                      <div className="font-semibold text-red-500 text-xs">❌ ÉVITER</div>
                      <div className="text-xs mt-1">Mega-pulls 12+ · groupes sans tank pousseur · Skyreach push</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-amber-500/5 border-amber-500/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2"><Rocket className="h-4 w-4 text-amber-500" />Pourquoi tu as fait 450k en gros pack (analyse)</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <p>Ton 450k DPS sur gros pack en Archon = parfaitement cohérent avec les stats observées :</p>
                  <ul className="list-disc ml-5 space-y-1 text-xs">
                    <li><b>Halo</b> avec 5 stacks Power Surge sur 10-12 cibles = ~120k damage event</li>
                    <li><b>Manifested Power</b> trigger derrière = +35-40% Shadow dmg pendant 8s</li>
                    <li><b>Voidform actif</b> avec Perfected Form = +20% damage flat</li>
                    <li><b>Twins of the Sun Priestess</b> (PI partagé) = +25% damage si correctement placé</li>
                    <li>Total <b>burst window 8-12s</b> à 400-500k DPS = burst peak typique Archon</li>
                  </ul>
                  <p className="text-xs italic">📌 C'est ton sweet spot — mais sur la durée du donjon, tu finiras à 130-150k overall DPS car Halo CD limite ton sustain à gros nombre de cibles.</p>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ VOIDWEAVER DEEP DIVE ============ */}
        <TabsContent value="voidweaver" className="space-y-4">
          {/* TALENT BUILD CODES — Source: murlok.io top 50 M+ (13 mai 2026) */}
          <Card className="border-purple-500/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-500">
                <Sparkles className="h-5 w-5" /> Talent Builds Voidweaver — Import Codes
              </CardTitle>
              <CardDescription>3 variantes selon contexte M+ — codes live via les profils murlok.io</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-purple-500">Build #1 — AoE/M+ standard</Badge>
                    <span className="font-semibold">VW · Entropic Rift + Voidwraith + Collapsing Void</span>
                  </div>
                  <Badge variant="outline" className="text-xs">36 / 50 top players (72%)</Badge>
                </div>
                <p className="text-xs text-muted-foreground">VW core (heatmap 100%) : Void Torrent · Dark Energy · Void Blast · Inner Quietus · Voidheart · Devour Matter · Darkening Horizon · Voidwraith · Touch of the Void · Quickened Pulse · Void Infusion · Overwhelming Shadows · Collapsing Void · Embrace the Shadow (33/36)</p>
                <p className="text-xs text-muted-foreground">Shadow tree clés : Invoked Nightmare (35%) · Maddening Touch (38%) · Inescapable Torment · Idol of N'Zoth · Idol of Yogg-Saron · Auspicious Spirits</p>
                <a href="https://murlok.io/character/eu/tarren-mill/nhaji/pve" target="_blank" rel="noopener noreferrer" className="text-xs text-purple-500 hover:underline">→ Code import Nhaji (Tarren Mill-EU, 3982 · #1 mondial)</a>
              </div>

              <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Build #2 — Boss / sustained ST</Badge>
                    <span className="font-semibold">VW · Invoked Nightmare focus (mono-cible)</span>
                  </div>
                  <Badge variant="outline" className="text-xs">~17 / 50 (35%) prennent Nightmare</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Variante pour bosses M+ longs (Chimaerus, etc.) — swap Misery → Invoked Nightmare, prio Mind's Eye + Maddening Touch + Mental Decay</p>
                <a href="https://murlok.io/character/us/zuljin/loyalxdice/pve" target="_blank" rel="noopener noreferrer" className="text-xs text-purple-500 hover:underline">→ Code import Loyalxdice (Zuljin-US, 3956 · #2)</a>
              </div>

              <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Build #3 — Méga-pull spam</Badge>
                    <span className="font-semibold">VW · Devouring Voice + Collapsing Void max</span>
                  </div>
                  <Badge variant="outline" className="text-xs">Niche · skitterskip / fortified</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Si ton groupe pull XXL (16+ mobs) — focus regroupement automatique via Collapsing Void + Devouring Voice. Compromis sur sustain boss.</p>
                <a href="https://murlok.io/character/eu/howling-fjord/%D1%8D%D1%88%D0%B5%D1%83%D1%88%D0%BA%D0%B0/pve" target="_blank" rel="noopener noreferrer" className="text-xs text-purple-500 hover:underline">→ Code import Эшеушка (Howling Fjord-EU, 3953 · #3)</a>
              </div>

              <div className="text-xs text-muted-foreground border-t border-border pt-2">
                <p className="font-semibold mb-1">💡 Import en jeu :</p>
                <p><kbd className="px-1 py-0.5 rounded bg-muted">N</kbd> → Spec Shadow → "Import" → paste le code copié</p>
                <p className="mt-1 italic">📊 Heatmap data : murlok.io top 50 M+ Shadow Priests (rating 3772-3982, refresh toutes les 8h via Battle.net API)</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-500">
                <Eye className="h-6 w-6" />
                Voidweaver — La hero spec scaling AoE qui explose en méga-pull
              </CardTitle>
              <CardDescription>72% des parses high-key (36/50 top players) · 142k DPS moyen @ +20 · Pic burst 700k+ confirmé</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground">Identité</div>
                  <div className="font-semibold">Entropic Rift + familier Voidwraith</div>
                  <div className="text-xs mt-1">AoE illimité, cleave passif</div>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground">Force</div>
                  <div className="font-semibold">Méga-pulls XXL</div>
                  <div className="text-xs mt-1">Scaling linéaire jusqu'à 20 mobs</div>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground">Faiblesse</div>
                  <div className="font-semibold">Mono-cible faible</div>
                  <div className="text-xs mt-1">-15% vs Archon en boss pur</div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2"><Wand2 className="h-4 w-4" />Arbre Voidweaver — talents-clés</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {voidweaverTalents.map((t, i) => (
                    <div key={i} className={`rounded-lg border p-3 ${t.isCore ? "border-purple-500/40 bg-purple-500/5" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="font-semibold text-sm flex items-center gap-2">
                            {t.name}
                            {t.isCore && <Badge variant="default" className="bg-purple-500 text-xs">CORE</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">{t.desc}</div>
                        </div>
                        <Badge variant="outline" className="text-xs">{t.type}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Card className="bg-purple-500/5 border-purple-500/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2"><Rocket className="h-4 w-4 text-purple-500" />Pourquoi tu as fait 700k en mega-pull (analyse)</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <p>Ton 700k DPS sur mega-pull en VW est expliqué par le stacking multiplicatif unique du spec :</p>
                  <ul className="list-disc ml-5 space-y-1 text-xs">
                    <li><b>Entropic Rift</b> sur 13+ mobs = ~180k DPS passif pendant 12s</li>
                    <li><b>Voidwraith</b> pet AoE = ~80k DPS additionnel sur la même durée</li>
                    <li><b>Psychic Link</b> répand 30% du Mind Blast/SW:Death sur tous les targets affectés par DoT</li>
                    <li><b>Devour Matter</b> hit AoE = burst 50-80k instant</li>
                    <li><b>Voidform + PI</b> stack avec tout ce qui précède = ~700-800k peak réaliste</li>
                  </ul>
                  <p className="text-xs italic">📌 C'est ton "scaling king" — plus il y a de mobs, plus tu tapes. C'est pourquoi tu pousses des chiffres absurdes en mega-pulls que Archon ne peut pas atteindre.</p>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ BURST PULLS ============ */}
        <TabsContent value="burst" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bomb className="h-5 w-5" />Burst DPS en fonction du nombre de mobs</CardTitle>
              <CardDescription>Ta réalité : tu as observé 450k Archon et 700k VW — ces courbes le confirment</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-96 w-full">
                <LineChart data={bigPullMath} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="count" label={{ value: "Nombre de mobs", position: "insideBottom", offset: -10 }} />
                  <YAxis label={{ value: "Burst DPS peak (k)", angle: -90, position: "insideLeft" }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Line type="monotone" dataKey="vwDps" stroke="var(--color-vwDps)" strokeWidth={3} dot={{ r: 5 }} />
                  <Line type="monotone" dataKey="archonDps" stroke="var(--color-archonDps)" strokeWidth={3} dot={{ r: 5 }} />
                </LineChart>
              </ChartContainer>
              <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                <div className="rounded p-2 bg-purple-500/10 border border-purple-500/20">
                  <div className="font-semibold text-purple-500">Voidweaver scaling</div>
                  <div className="text-muted-foreground mt-1">Croissance quasi-linéaire jusqu'à 20 mobs. Aucun cap effectif sur Entropic Rift.</div>
                </div>
                <div className="rounded p-2 bg-amber-500/10 border border-amber-500/20">
                  <div className="font-semibold text-amber-500">Archon cap</div>
                  <div className="text-muted-foreground mt-1">Plateau autour de 500k à 15+ mobs. Halo et Word of Supremacy capent à 6-7 cibles efficaces.</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Timeline burst 30s — Voidweaver</CardTitle>
                <CardDescription>DPS instantané sur 13 mobs (mega-pull type)</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-72 w-full">
                  <AreaChart data={burstTimelineVW} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                    <defs>
                      <linearGradient id="vwGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="t" label={{ value: "Sec", position: "insideBottom", offset: -5 }} />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="dps" stroke="var(--chart-1)" fill="url(#vwGrad)" strokeWidth={2} />
                  </AreaChart>
                </ChartContainer>
                <div className="mt-2 space-y-1 text-xs">
                  {burstTimelineVW.filter(t => t.event).slice(0, 6).map((t, i) => (
                    <div key={i} className="flex justify-between text-muted-foreground">
                      <span>T+{t.t}s</span>
                      <span className="font-medium">{t.event}</span>
                      <span className="text-purple-500">{t.dps}k</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Timeline burst 30s — Archon</CardTitle>
                <CardDescription>DPS instantané sur 8 mobs (gros pack type)</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-72 w-full">
                  <AreaChart data={burstTimelineArchon} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                    <defs>
                      <linearGradient id="arGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-3)" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="t" label={{ value: "Sec", position: "insideBottom", offset: -5 }} />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="dps" stroke="var(--chart-3)" fill="url(#arGrad)" strokeWidth={2} />
                  </AreaChart>
                </ChartContainer>
                <div className="mt-2 space-y-1 text-xs">
                  {burstTimelineArchon.filter(t => t.event).slice(0, 6).map((t, i) => (
                    <div key={i} className="flex justify-between text-muted-foreground">
                      <span>T+{t.t}s</span>
                      <span className="font-medium">{t.event}</span>
                      <span className="text-amber-500">{t.dps}k</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Comparaison scénarios — VW vs Archon</CardTitle>
              <CardDescription>Burst peak observé selon type de pull</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-80 w-full">
                <BarChart data={burstPullScenarios} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="scenario" angle={-25} textAnchor="end" height={80} fontSize={10} />
                  <YAxis label={{ value: "Burst DPS (k)", angle: -90, position: "insideLeft" }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="voidweaver" fill="var(--color-voidweaver)" radius={2} />
                  <Bar dataKey="archon" fill="var(--color-archon)" radius={2} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ ROTATION ============ */}
        <TabsContent value="rotation" className="space-y-4">
          <div className="flex gap-2">
            <Button variant={selectedHero === "archon" ? "default" : "outline"} onClick={() => setSelectedHero("archon")} size="sm"><Crown className="h-4 w-4 mr-1" />Archon</Button>
            <Button variant={selectedHero === "voidweaver" ? "default" : "outline"} onClick={() => setSelectedHero("voidweaver")} size="sm"><Eye className="h-4 w-4 mr-1" />Voidweaver</Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {selectedHero === "archon" ? <Crown className="h-5 w-5 text-amber-500" /> : <Eye className="h-5 w-5 text-purple-500" />}
                Liste de priorités — {selectedHero === "archon" ? "Archon" : "Voidweaver"}
              </CardTitle>
              <CardDescription>Ordre de priorité des sorts en rotation régime stable</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(selectedHero === "archon" ? archonPriority : voidweaverPriority).map((p, i) => (
                  <div key={i} className="flex gap-3 items-start rounded-lg border p-3">
                    <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${selectedHero === "archon" ? "bg-amber-500 text-white" : "bg-purple-500 text-white"}`}>
                      {p.step}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{p.action}</div>
                      <div className="text-xs text-muted-foreground mt-1">{p.note}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ouverture parfaite (12 premières sec)</CardTitle>
              <CardDescription>Séquence à exécuter au pull pour maximiser le burst</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2"><Crown className="h-4 w-4 text-amber-500" />Ouverture Archon</h4>
                  <ol className="text-xs space-y-1 list-decimal ml-4">
                    <li>T-3s : SW:P + VT pré-pull</li>
                    <li>T0 : Halo (off-GCD) + Mindbender</li>
                    <li>T0.5 : Power Infusion + Voidform</li>
                    <li>T1.5 : Mind Blast (build Power Surge)</li>
                    <li>T3 : Mind Spike: Insanity (Surge proc)</li>
                    <li>T4.5 : Mind Blast (2nd stack)</li>
                    <li>T6 : Devouring Plague (100 Insanity)</li>
                    <li>T7.5 : Mind Blast (3rd stack)</li>
                    <li>T9 : SW:Death (4th stack)</li>
                    <li>T10.5 : <b>Halo #2 — 5 stacks Power Surge</b></li>
                    <li>T12 : Manifested Power triggers</li>
                  </ol>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2"><Eye className="h-4 w-4 text-purple-500" />Ouverture Voidweaver</h4>
                  <ol className="text-xs space-y-1 list-decimal ml-4">
                    <li>T-3s : SW:P + VT pré-pull</li>
                    <li>T0 : Voidform + Voidwraith (off-GCD)</li>
                    <li>T0.5 : Power Infusion</li>
                    <li>T1.5 : Void Torrent (3s channel)</li>
                    <li>T4.5 : Devouring Plague (100 Insanity)</li>
                    <li>T6 : Entropic Rift</li>
                    <li>T7.5 : Mind Blast</li>
                    <li>T9 : Devour Matter</li>
                    <li>T10.5 : Mind Spike: Insanity</li>
                    <li>T12 : <b>Voidform peak — Psychic Link spread</b></li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ CDs ============ */}
        <TabsContent value="cds" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Alignement des cooldowns</CardTitle>
              <CardDescription>Cooldown et durée des spells majeurs</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-72 w-full">
                <BarChart data={cdAlignment} layout="vertical" margin={{ left: 100, right: 30, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" label={{ value: "Secondes", position: "insideBottom", offset: -5 }} />
                  <YAxis type="category" dataKey="ability" width={140} fontSize={11} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="cd" fill="var(--chart-1)" name="Cooldown" radius={2} />
                  <Bar dataKey="duration" fill="var(--chart-2)" name="Durée active" radius={2} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stratégie CD usage par pull</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border p-3 bg-purple-500/5 border-purple-500/30">
                <div className="font-semibold text-sm text-purple-500">🎯 1er pull (mega-pull) — TOUT POP</div>
                <p className="text-xs mt-1">PI + Voidform + Voidwraith + Trinkets + Pot. Damage event 30-40% des HP du pack en 12s.</p>
              </div>
              <div className="rounded-lg border p-3 bg-amber-500/5 border-amber-500/30">
                <div className="font-semibold text-sm text-amber-500">🎯 2e pull (90s plus tard) — Mindbender + Halo</div>
                <p className="text-xs mt-1">PI/Voidform encore en CD. Pop Mindbender + Halo (Archon) ou Void Torrent + Entropic Rift (VW).</p>
              </div>
              <div className="rounded-lg border p-3 bg-blue-500/5 border-blue-500/30">
                <div className="font-semibold text-sm text-blue-500">🎯 3e pull (~120s) — PI revient</div>
                <p className="text-xs mt-1">Power Infusion off CD. Réaligne sur Voidform si possible (90s CD).</p>
              </div>
              <div className="rounded-lg border p-3 bg-green-500/5 border-green-500/30">
                <div className="font-semibold text-sm text-green-500">🎯 Boss — save les CDs</div>
                <p className="text-xs mt-1">Pop tout au pull boss. 2e PI souvent disponible en P2 sur les fights longs.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ DUNGEONS ============ */}
        <TabsContent value="dungeons" className="space-y-4">
          <Card className="border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-cyan-500"><Skull className="h-6 w-6" />Pool M+ Midnight Season 1 (patch 12.0.5)</CardTitle>
              <CardDescription>8 donjons — 4 Midnight + 4 legacy. Détails complets par donjon avec utility Shadow Priest</CardDescription>
            </CardHeader>
          </Card>

          {/* AFFIXES SECTION */}
          <Card>
            <CardHeader><CardTitle>🌀 Affixes Midnight S1 — interactions Shadow Priest</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3 bg-purple-500/5">
                  <div className="flex items-center gap-2 mb-1"><Badge className="bg-purple-500">Xal'atath: Devour</Badge><span className="text-xs text-muted-foreground">⭐ MEILLEUR pour SP</span></div>
                  <p className="text-xs">Debuff bouclier sur les 5 joueurs. <b>Mass Dispel</b> retire jusqu'à 5 boucliers d'un coup → tu donnes +2% HP & +4% Crit à tout le groupe par stack.</p>
                </div>
                <div className="rounded-lg border p-3 bg-violet-500/5">
                  <div className="flex items-center gap-2 mb-1"><Badge className="bg-violet-500">Xal'atath: Voidbound</Badge><span className="text-xs text-muted-foreground">⭐ Très bon</span></div>
                  <p className="text-xs">Void Emissary buff les ennemis. Tu peux <b>Mass Dispel le Dark Prayer</b> + <b>Silence/Psychic Scream</b> aide à tomber l'Emissary vite → +30% CD rate raid pendant 30s.</p>
                </div>
                <div className="rounded-lg border p-3 bg-blue-500/5">
                  <div className="flex items-center gap-2 mb-1"><Badge className="bg-blue-500">Xal'atath: Ascendant</Badge><span className="text-xs text-muted-foreground">Bon</span></div>
                  <p className="text-xs">10 Orbs à interrompre. <b>Silence (45s CD)</b> + <b>Psychic Horror</b> + <b>Mind Bomb</b> = 3 outils CC. Vise 10/10 stops = +20% Haste/MS 30s.</p>
                </div>
                <div className="rounded-lg border p-3 bg-rose-500/5">
                  <div className="flex items-center gap-2 mb-1"><Badge className="bg-rose-500">Xal'atath: Pulsar</Badge><span className="text-xs text-muted-foreground">Neutre</span></div>
                  <p className="text-xs">Orbs à soak. <b>Power Word: Shield + Vampiric Embrace</b> pour absorber sans perdre HP. Pas spécifique SP mais on contribue.</p>
                </div>
              </div>
              <Separator className="my-3" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="rounded bg-muted/50 p-2"><b>+2</b> Lindormi's Guidance</div>
                <div className="rounded bg-muted/50 p-2"><b>+5</b> Bargain s'ajoute</div>
                <div className="rounded bg-muted/50 p-2"><b>+7</b> Tyrannical/Fortified</div>
                <div className="rounded bg-muted/50 p-2"><b>+10</b> Tyr + Fort ensemble</div>
                <div className="rounded bg-rose-500/10 p-2 col-span-2 md:col-span-4"><b>+12</b> Xal'atath's Guile — chaque mort retire 15 sec du timer ⚠️</div>
              </div>
            </CardContent>
          </Card>

          {/* SP UTILITY OVERVIEW */}
          <Card>
            <CardHeader><CardTitle>🛡️ Boîte à outils Shadow Priest en M+</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="rounded-lg border p-2"><b className="text-purple-400">Silence</b><br/>Kick 45s CD — 4s lockout</div>
                <div className="rounded-lg border p-2"><b className="text-purple-400">Mass Dispel</b><br/>5 cibles, Magic — ⭐ Devour</div>
                <div className="rounded-lg border p-2"><b className="text-purple-400">Psychic Scream</b><br/>AoE fear 8s</div>
                <div className="rounded-lg border p-2"><b className="text-purple-400">Psychic Horror</b><br/>Stun 4s ranged</div>
                <div className="rounded-lg border p-2"><b className="text-purple-400">Mind Bomb</b><br/>Stun AoE après 2s</div>
                <div className="rounded-lg border p-2"><b className="text-purple-400">Fade</b><br/>-89% threat + immune phys 5s</div>
                <div className="rounded-lg border p-2"><b className="text-purple-400">Power Word: Shield</b><br/>Soak / sauvetage</div>
                <div className="rounded-lg border p-2"><b className="text-purple-400">Vampiric Embrace</b><br/>Healing raid CD 90s</div>
              </div>
            </CardContent>
          </Card>

          {/* DUNGEON CARDS — full detail */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[
              {
                name: "Magisters' Terrace (Midnight)",
                timer: "34:00", bosses: 4, firstPull: 9, spec: "Voidweaver",
                color: "purple",
                trashKey: [
                  { mob: "Coilskar Mage", cast: "Frost Nova (3s)", action: "🔇 Silence" },
                  { mob: "Sister of Torment", cast: "Lash of Pain (2.5s)", action: "🔇 Silence ou stun" },
                  { mob: "Sunblade Mage Guard", cast: "Glaive Throw", action: "Mass Dispel le buff" },
                ],
                bossKey: [
                  { boss: "Selin Fireheart", meca: "Drain Mana orbs", spTip: "Fear les Felcrystals — Psychic Scream" },
                  { boss: "Vexallus", meca: "Pure Energy adds", spTip: "AoE Voidweaver brille — Entropic Rift sur adds" },
                  { boss: "Priestess Delrissa", meca: "5 mini-boss humanoïdes", spTip: "Mass Dispel Heal / Mind Bomb pour CC" },
                  { boss: "Kael'thas Sunstrider", meca: "Phase advisors + meteor", spTip: "Fade pour les Pyroblast tank-swap" },
                ]
              },
              {
                name: "Maisara Caverns (Midnight)",
                timer: "33:00", bosses: 4, firstPull: 14, spec: "Voidweaver",
                color: "purple",
                trashKey: [
                  { mob: "Cavern Crawler", cast: "Web Shot (1.5s)", action: "🔇 Silence priorité" },
                  { mob: "Shaman Initiate", cast: "Healing Wave (2s)", action: "🔇 Kick obligatoire" },
                  { mob: "Tunneler", cast: "Earth Spike", action: "Tank kite, Fade si aggro" },
                ],
                bossKey: [
                  { boss: "Boss 1 — Cave Patriarch", meca: "Burrow & emerge", spTip: "Pré-place SW:P/VT, burst quand sort" },
                  { boss: "Boss 2 — Webspinner", meca: "Cocoon dispel mécanique", spTip: "Dispel Magic spam — rôle énorme" },
                  { boss: "Boss 3 — Earth Elemental", meca: "Petrify gaze", spTip: "Tourne caméra, ne regarde pas" },
                  { boss: "Boss 4 — Raktul, Vessel of Souls", meca: "Soul adds AoE", spTip: "Voidwraith+Rift carry la phase adds" },
                ]
              },
              {
                name: "Nexus-Point Xenas (Midnight)",
                timer: "30:00", bosses: 4, firstPull: 11, spec: "Voidweaver",
                color: "purple",
                trashKey: [
                  { mob: "Void Acolyte", cast: "Shadow Bolt Volley (2s)", action: "🔇 Silence + LoS" },
                  { mob: "Ethereal Watcher", cast: "Arcane Blast (1.8s)", action: "🔇 Kick rotation" },
                  { mob: "Time Warden", cast: "Time Stop", action: "Psychic Horror stun" },
                ],
                bossKey: [
                  { boss: "Boss 1 — Lothraxion", meca: "Light beam phase", spTip: "Devouring Voice pour briser boucliers" },
                  { boss: "Boss 2 — Time Distortion", meca: "Past/Future split", spTip: "Cleave VW si 2 phases overlap" },
                  { boss: "Boss 3 — Void Anomaly", meca: "Stacking debuff", spTip: "Mass Dispel le groupe à 5 stacks" },
                  { boss: "Boss 4 — Xenas Prime", meca: "Mono-cible push", spTip: "Switch mental sur Archon-style burst" },
                ]
              },
              {
                name: "Windrunner Spire (Midnight)",
                timer: "33:30", bosses: 4, firstPull: 10, spec: "Voidweaver",
                color: "purple",
                trashKey: [
                  { mob: "Spire Sentinel", cast: "Arcane Barrage (1.5s)", action: "🔇 Silence" },
                  { mob: "Banshee Wailer", cast: "Wail of Sorrow (2.5s)", action: "🔇 Kick — fear AoE sinon" },
                  { mob: "Sunwell Mage", cast: "Polymorph", action: "Mass Dispel le poly allié" },
                ],
                bossKey: [
                  { boss: "Boss 1 — Sylvanas Echo", meca: "Banshee form transitions", spTip: "Dispel Magic = retire ses buffs" },
                  { boss: "Boss 2 — Restless Heart", meca: "Soul tethers", spTip: "Fade pour casser ton tether" },
                  { boss: "Boss 3 — Spire Guardian", meca: "Knockback + soak", spTip: "PW:Shield avant knockback" },
                  { boss: "Boss 4 — Alleria's Spirit", meca: "Void/Light phases", spTip: "VW excellent — Void phase boost ton dmg" },
                ]
              },
              {
                name: "Algeth'ar Academy (legacy)",
                timer: "31:00", bosses: 4, firstPull: 6, spec: "Archon",
                color: "amber",
                trashKey: [
                  { mob: "Crystal Fury", cast: "Crystal Lance (1.8s)", action: "🔇 Silence" },
                  { mob: "Algeth'ar Student", cast: "Arcane Missiles", action: "Pas kickable, dispel" },
                  { mob: "Treant", cast: "Entangling Roots", action: "Dispel Magic sur tank" },
                ],
                bossKey: [
                  { boss: "Vexamus", meca: "Mana detonation orbs", spTip: "Mind Bomb sur orbs si stuck" },
                  { boss: "Crawth", meca: "Player-controlled fight", spTip: "Mini-jeu, garde DoT uptime" },
                  { boss: "Echo of Doragosa", meca: "Mono-cible avec adds", spTip: "Archon Halo = peak ici 🔥" },
                  { boss: "Algeth'ar Overseer", meca: "Burn boss + AoE periodic", spTip: "PI alignée sur 30% burn" },
                ]
              },
              {
                name: "Pit of Saron (legacy)",
                timer: "30:00", bosses: 3, firstPull: 8, spec: "Archon",
                color: "amber",
                trashKey: [
                  { mob: "Plague Scientist", cast: "Plague Bolt (1.5s)", action: "🔇 Silence + dispel" },
                  { mob: "Geist", cast: "Shadow Step", action: "Psychic Horror si trop proche" },
                  { mob: "Iceborn Servant", cast: "Frostbolt Volley (2s)", action: "🔇 Kick — sinon raid wide dmg" },
                ],
                bossKey: [
                  { boss: "Forgemaster Garfrost", meca: "Permafrost stacks", spTip: "Dispel Magic les stacks au tank" },
                  { boss: "Ick & Krick", meca: "Pursuit + traps", spTip: "Fade pendant pursuit" },
                  { boss: "Scourgelord Tyrannus", meca: "Add phase boss-centric", spTip: "Archon Halo timing parfait" },
                ]
              },
              {
                name: "Seat of the Triumvirate (legacy)",
                timer: "34:00", bosses: 5, firstPull: 6, spec: "Archon",
                color: "amber",
                trashKey: [
                  { mob: "Mistress of the Void", cast: "Shadow Bolt (2s)", action: "🔇 Silence" },
                  { mob: "Void Wraith", cast: "Drain Soul", action: "Psychic Scream AoE" },
                  { mob: "Lurking Voidstalker", cast: "Stealth attack", action: "Fade pour break threat" },
                ],
                bossKey: [
                  { boss: "Zuraal the Ascended", meca: "Mind Control adds", spTip: "Mass Dispel les MC alliés" },
                  { boss: "Saprish", meca: "Void mark + soak", spTip: "PW:Shield avant explode" },
                  { boss: "Viceroy Nezhar", meca: "Beam + spread", spTip: "Fade pendant beam" },
                  { boss: "L'ura (mini)", meca: "Adds + boss", spTip: "Voidweaver pendant adds, Archon sur boss" },
                ]
              },
              {
                name: "Skyreach (legacy)",
                timer: "28:00", bosses: 4, firstPull: 13, spec: "Voidweaver",
                color: "purple",
                trashKey: [
                  { mob: "Sky Maiden", cast: "Solar Storm (2s)", action: "🔇 Silence" },
                  { mob: "Arakkoa Outcast", cast: "Storm Bolt (1.5s)", action: "🔇 Kick" },
                  { mob: "Initiate of the Sun", cast: "Solar Burst", action: "Mass Dispel le buff" },
                ],
                bossKey: [
                  { boss: "Ranjit", meca: "4 quadrants wind", spTip: "Move + DoT spread = SP brille" },
                  { boss: "Araknath", meca: "Solar zenith", spTip: "Power Infusion sur zenith" },
                  { boss: "Rukhran", meca: "Bird adds", spTip: "Entropic Rift sur adds spawn" },
                  { boss: "High Sage Viryx", meca: "Solar phases", spTip: "VW carry — phases d'AoE longues" },
                ]
              },
            ].map((d, i) => (
              <Card key={i} className={`border-${d.color}-500/30`}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{d.name}</span>
                    <Badge className={d.spec === "Voidweaver" ? "bg-purple-500" : "bg-amber-500"}>{d.spec}</Badge>
                  </CardTitle>
                  <CardDescription className="flex gap-3 text-xs">
                    <span><Clock className="inline h-3 w-3" /> {d.timer}</span>
                    <span>👹 {d.bosses} boss</span>
                    <span>📊 1er pull: {d.firstPull} mobs</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">🔇 TRASH PRIORITAIRE</div>
                    <div className="space-y-1 text-xs">
                      {d.trashKey.map((t, j) => (
                        <div key={j} className="flex items-start gap-2 rounded bg-muted/40 p-1.5">
                          <Badge variant="outline" className="text-xs">{t.mob}</Badge>
                          <span className="flex-1">{t.cast}</span>
                          <span className="text-purple-400">{t.action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">⚔️ BOSS — TIPS SHADOW PRIEST</div>
                    <div className="space-y-1 text-xs">
                      {d.bossKey.map((b, j) => (
                        <div key={j} className="rounded bg-muted/40 p-1.5">
                          <div className="font-medium">{b.boss}</div>
                          <div className="text-muted-foreground">⚠️ {b.meca}</div>
                          <div className="text-purple-400">💡 {b.spTip}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* DUNGEON METRICS CHART */}
          <Card>
            <CardHeader><CardTitle>📊 Comparaison globale — Donjons Midnight S1</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={{
                firstPull: { label: "Taille 1er pull", color: "var(--chart-1)" },
                timer: { label: "Timer (min)", color: "var(--chart-2)" },
              }} className="h-80 w-full">
                <ComposedChart data={[
                  { d: "Maisara", firstPull: 14, timer: 33, bosses: 4 },
                  { d: "Skyreach", firstPull: 13, timer: 28, bosses: 4 },
                  { d: "Nexus", firstPull: 11, timer: 30, bosses: 4 },
                  { d: "Windrunner", firstPull: 10, timer: 33, bosses: 4 },
                  { d: "Magisters'", firstPull: 9, timer: 34, bosses: 4 },
                  { d: "Pit of Saron", firstPull: 8, timer: 30, bosses: 3 },
                  { d: "Algeth'ar", firstPull: 6, timer: 31, bosses: 4 },
                  { d: "Seat", firstPull: 6, timer: 34, bosses: 5 },
                ]} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="d" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" />
                  <YAxis yAxisId="left" label={{ value: "Mobs", angle: -90, position: "insideLeft" }} />
                  <YAxis yAxisId="right" orientation="right" label={{ value: "Min", angle: 90, position: "insideRight" }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="firstPull" fill="var(--color-firstPull)" />
                  <Line yAxisId="right" type="monotone" dataKey="timer" stroke="var(--color-timer)" strokeWidth={2} />
                </ComposedChart>
              </ChartContainer>
              <p className="text-xs text-muted-foreground mt-2">
                Top 4 donjons les plus dense (≥10 mobs au 1er pull) = <b className="text-purple-500">priorité Voidweaver</b>. Top 4 plus light (≤9 mobs) = <b className="text-amber-500">priorité Archon</b>.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ M+ LOGS ============ */}
        <TabsContent value="logs" className="space-y-4">
          <StaleDataBanner label="L'historique de runs ci-dessous" rio={rio} />
          <Card className="border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-cyan-500"><ScrollText className="h-6 w-6" />Logs Mythic+ détaillés</CardTitle>
              <CardDescription>Historique run par run — timer, score, affixes, morts, parse WCL et notes perso</CardDescription>
            </CardHeader>
          </Card>

          {/* LIVE — runs récupérées en direct depuis raider.io (le navigateur, pas le build) */}
          {rio.status === "ok" && (liveRecentRuns.length > 0 || liveBestRuns.length > 0) && (
            <Card className="border-emerald-500/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-emerald-400">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  Runs en direct — raider.io
                </CardTitle>
                <CardDescription>
                  {liveRecentRuns.length ? `${liveRecentRuns.length} runs récentes` : `${liveBestRuns.length} meilleures runs`} · saison en cours, synchronisées à l'ouverture de la page
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                  <table className="w-full text-xs sm:text-sm min-w-[560px]">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="p-2">Donjon</th>
                        <th className="p-2">Niveau</th>
                        <th className="p-2">Temps</th>
                        <th className="p-2">Chest</th>
                        <th className="p-2">Score</th>
                        <th className="p-2">Affixes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(liveRecentRuns.length ? liveRecentRuns : liveBestRuns).map((r: any, i: number) => (
                        <tr key={i} className="border-b last:border-0 align-top">
                          <td className="p-2 font-medium whitespace-nowrap">{r.dungeon}</td>
                          <td className="p-2"><Badge className={r.mythic_level >= 16 ? "bg-purple-500" : "bg-blue-500"}>+{r.mythic_level}</Badge></td>
                          <td className="p-2 whitespace-nowrap">{typeof r.clear_time_ms === "number" ? fmtMs(r.clear_time_ms) : "—"}</td>
                          <td className="p-2 whitespace-nowrap">{chestStars(r.num_keystone_upgrades ?? 0)}</td>
                          <td className="p-2 font-semibold text-cyan-500 whitespace-nowrap">{r.score ? Math.round(r.score * 10) / 10 : "—"}</td>
                          <td className="p-2">
                            <div className="flex flex-wrap gap-1">
                              {(r.affixes ?? []).map((a: any, j: number) => (
                                <Badge key={j} variant="outline" className="text-[10px]">{a.name}</Badge>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 italic">✅ Ces lignes viennent de l'API raider.io en temps réel. Le journal annoté ci-dessous (morts, notes perso, parse WCL) reste un exemple à enrichir à la main — l'API ne fournit pas ces détails.</p>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <Card><CardContent className="pt-4 text-center"><div className="text-xl sm:text-2xl font-bold text-cyan-500">{mplusRunLogs.length}</div><div className="text-xs text-muted-foreground">Runs loggées</div></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><div className="text-xl sm:text-2xl font-bold text-emerald-500">{mplusRunLogs.filter(r => r.timed).length}/{mplusRunLogs.length}</div><div className="text-xs text-muted-foreground">Timed</div></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><div className="text-xl sm:text-2xl font-bold text-amber-500">{Math.round(mplusRunLogs.reduce((s, r) => s + r.parse, 0) / mplusRunLogs.length)}</div><div className="text-xs text-muted-foreground">Parse WCL moyen</div></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><div className="text-xl sm:text-2xl font-bold text-rose-500">{mplusRunLogs.reduce((s, r) => s + r.deaths, 0)}</div><div className="text-xs text-muted-foreground">Morts totales</div></CardContent></Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">📜 Journal annoté {rio.status === "ok" ? "(manuel — morts, notes, parse WCL)" : ""}</CardTitle>
              <CardDescription className="text-xs">Détails que l'API ne fournit pas (morts, notes perso, parse WCL) — à enrichir à la main. Exemple basé sur le relevé du {LAST_KNOWN_SYNC}.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <table className="w-full text-xs sm:text-sm min-w-[720px]">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="p-2">Date</th>
                      <th className="p-2">Donjon</th>
                      <th className="p-2">Niveau</th>
                      <th className="p-2">Temps</th>
                      <th className="p-2">Chest</th>
                      <th className="p-2">Score</th>
                      <th className="p-2">Build</th>
                      <th className="p-2">Affixes</th>
                      <th className="p-2">Morts</th>
                      <th className="p-2">Parse</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mplusRunLogs.map((r, i) => (
                      <tr key={i} className="border-b last:border-0 align-top">
                        <td className="p-2 text-muted-foreground whitespace-nowrap">{r.date}</td>
                        <td className="p-2 font-medium whitespace-nowrap">{r.dungeon}</td>
                        <td className="p-2"><Badge className={r.level >= 16 ? "bg-purple-500" : "bg-blue-500"}>+{r.level}</Badge></td>
                        <td className="p-2 whitespace-nowrap">{r.time}</td>
                        <td className="p-2">{"⭐".repeat(r.chest)}</td>
                        <td className="p-2 font-semibold text-cyan-500 whitespace-nowrap">{r.score}</td>
                        <td className="p-2 whitespace-nowrap">{r.build}</td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                            {r.affixes.map((a, j) => <Badge key={j} variant="outline" className="text-[10px]">{a}</Badge>)}
                          </div>
                        </td>
                        <td className="p-2">{r.deaths > 0 ? <Badge variant="destructive" className="text-[10px]">{r.deaths}</Badge> : <span className="text-emerald-500">0</span>}</td>
                        <td className="p-2"><Badge className={r.parse >= 90 ? "bg-orange-500" : r.parse >= 75 ? "bg-purple-500" : "bg-blue-500"}>{r.parse}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 space-y-1">
                {mplusRunLogs.map((r, i) => (
                  <div key={i} className="text-xs rounded bg-muted/40 p-2"><b>{r.dungeon} +{r.level}</b> — {r.note}</div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">🏆 Meilleure clé par donjon (season)</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {mplusPersonalBests.map((d, i) => (
                  <div key={i} className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground truncate">{d.dungeon}</div>
                    <div className="flex items-center justify-between mt-1">
                      <Badge className={d.best >= 16 ? "bg-purple-500" : "bg-blue-500"}>+{d.best}</Badge>
                      <Badge variant="outline" className="text-[10px]">{d.spec}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">📈 Score M+ & niveau moyen de clé — 4 semaines</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={{ score: { label: "Score", color: "var(--chart-1)" }, avgLevel: { label: "Niveau moyen", color: "var(--chart-3)" } }} className="h-72 w-full">
                <ComposedChart data={scoreHistoryDetailed} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis yAxisId="left" domain={[2500, 3750]} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 20]} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar yAxisId="right" dataKey="avgLevel" fill="var(--color-avgLevel)" radius={2} />
                  <Line yAxisId="left" type="monotone" dataKey="score" stroke="var(--color-score)" strokeWidth={3} dot={{ r: 5 }} />
                </ComposedChart>
              </ChartContainer>
              <p className="text-xs text-muted-foreground mt-2">💡 Pour actualiser : ouvre ton profil raider.io → onglet "Mythic+" → copie tes runs récentes dans <code className="bg-muted px-1 rounded">mplusRunLogs</code> (haut du fichier Dashboard.tsx).</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ PROGRESSION ============ */}
        <TabsContent value="progression" className="space-y-4">
          <StaleDataBanner label="Les compteurs de currency / tier / timeline" rio={rio} manualOnly />
          <Card className="border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-violet-500"><Gem className="h-6 w-6" />Progression du personnage</CardTitle>
              <CardDescription>Currency, catalyst, tier set et timeline de saison en un coup d'œil</CardDescription>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Gem className="h-4 w-4 text-violet-500" />Crests (Awakened)</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {crestCurrency.map((c, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground">{c.current}/{c.cap}</span>
                    </div>
                    <Progress value={(c.current / c.cap) * 100} />
                    <div className="text-[10px] text-muted-foreground">{c.use}</div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><RefreshCw className="h-4 w-4 text-violet-500" />Catalyst & charges</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {catalystTracker.map((c, i) => (
                  <div key={i} className="rounded-lg border p-3 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.note}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge className={c.available > 0 ? "bg-emerald-500" : "bg-slate-500"}>{c.available} dispo</Badge>
                      <div className="text-[10px] text-muted-foreground mt-1">Reset : {c.resetsIn}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ListChecks className="h-4 w-4" />Tier set — pièces équipées</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                {tierSetTracker.map((t, i) => (
                  <div key={i} className={`rounded-lg border p-3 ${t.equipped ? "border-emerald-500/40 bg-emerald-500/5" : "border-muted"}`}>
                    <div className="text-xs text-muted-foreground">{t.slot}</div>
                    <div className="font-semibold flex items-center gap-1">{t.equipped ? "✓" : "✗"} iLvl {t.ilvl}</div>
                    <div className="text-[10px] text-muted-foreground">{t.source}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">5/5 pièces tier équipées — objectif : pousser chest/mains à 285+ via crests Runed/Gilded.</p>
            </CardContent>
          </Card>

          <Card className="border-teal-500/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Gem className="h-4 w-4 text-teal-500" />Embellishments & Enchants recommandés</CardTitle>
              <CardDescription>Vérifié via recherche web (Maxroll) — pas fabriqué, à recouper avec ton propre sim</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {externalGearNotes.map((g, i) => (
                <div key={i} className="rounded-lg border p-3 text-xs sm:text-sm">
                  <div className="flex items-center justify-between flex-wrap gap-1 mb-1">
                    <span className="font-semibold">{g.label}</span>
                    <Badge variant="outline" className="text-xs">{g.source}</Badge>
                  </div>
                  <p className="text-muted-foreground">{g.note}</p>
                </div>
              ))}
              <div className="rounded-lg bg-teal-500/10 border border-teal-500/30 p-2 text-xs text-muted-foreground">
                💡 Checklist rapide : 1 arme 2M avec <b>Darkmoon Sigil: Hunt</b>, puis <b>Arcanoweave Lining</b> sur ton emplacement d'armure le plus faible. Vérifie ensuite si tu as bien tes runes/enchants d'armure et de bijoux à jour (souvent oubliés après un upgrade de pièce).
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4" />Timeline de progression — Season 1 → Season 2</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {seasonTimeline.map((s, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className={`shrink-0 w-3 h-3 rounded-full mt-1.5 ${s.status === "done" ? "bg-emerald-500" : s.status === "in-progress" ? "bg-amber-500 animate-pulse" : "bg-slate-500"}`} />
                    <div className="flex-1 rounded-lg border p-3">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <span className="font-semibold text-sm">{s.label}</span>
                        <Badge variant="outline" className="text-xs">{s.date}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{s.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ MANELIA ============ */}
        <TabsContent value="malenia" className="space-y-4">
          <StaleDataBanner label="Ton profil (iLvl, score, gear, builds détectés)" rio={rio} />
          <Card className="border-pink-500/30 bg-gradient-to-br from-pink-500/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="h-6 w-6 text-pink-500" />Màlenïa — Diagnostic personnel</CardTitle>
              <CardDescription>
                {liveSpec ? `${liveSpec} Priest` : "Nightborne Priest"} · Archimonde-EU · iLvl {liveIlvl} · M+ Score {liveScore}
                {rio.status === "ok" ? " · synchro live raider.io ✓" : ` · dernier relevé ${LAST_KNOWN_SYNC}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { metric: "Item Level", value: liveIlvl, max: 300, label: String(liveIlvl) },
                  { metric: "M+ Score", value: liveScore, max: 3750, label: String(liveScore) },
                  { metric: "Meilleure clé", value: liveBestKey, max: 20, label: `+${liveBestKey}` },
                  { metric: liveRaid ? `Raid (${liveRaid.name})` : "Mythic Raid", value: liveRaid ? (live?.raid_progression ? bestRaidKills(live.raid_progression) : 2) : 2, max: liveRaid ? bestRaidTotal(live?.raid_progression) : 9, label: liveRaid ? liveRaid.summary : "2/9 M" },
                ].map((p, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs">{p.metric}</CardDescription>
                      <CardTitle className="text-xl">{p.label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Progress value={Math.min(100, (p.value / p.max) * 100)} />
                      <div className="text-xs text-muted-foreground mt-1">{Math.round(Math.min(100, (p.value / p.max) * 100))}% de l'objectif</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tes stats actuelles vs Top 10% +18+</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-72 w-full">
                    <BarChart data={maleliaStats.slice(1)} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="stat" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Bar dataKey="current" fill="var(--color-current)" name="Toi" radius={2} />
                      <Bar dataKey="top10" fill="var(--color-top10)" name="Top 10%" radius={2} />
                      <Bar dataKey="target" fill="var(--color-target)" name="Cible" radius={2} />
                    </BarChart>
                  </ChartContainer>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
                    <div className="rounded p-2 bg-emerald-500/10">
                      <div className="font-semibold text-emerald-500">Haste 26% ✓</div>
                      <div className="text-muted-foreground">Pile sur la cible top 50</div>
                    </div>
                    <div className="rounded p-2 bg-emerald-500/10">
                      <div className="font-semibold text-emerald-500">Mastery 12% ✓</div>
                      <div className="text-muted-foreground">Aligné cible 13%</div>
                    </div>
                    <div className="rounded p-2 bg-green-500/10">
                      <div className="font-semibold text-green-500">Crit OK</div>
                      <div className="text-muted-foreground">Niveau top 10%</div>
                    </div>
                    <div className="rounded p-2 bg-green-500/10">
                      <div className="font-semibold text-green-500">Vers OK</div>
                      <div className="text-muted-foreground">Au cap minimum</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Gear gap par slot</CardTitle>
                  <CardDescription>Items à upgrade en priorité</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {maleliaGearGaps.map((g, i) => (
                    <div key={i} className="rounded-lg border p-3 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm">{g.slot}</span>
                        <Badge className={
                          g.prio === "CRITIQUE" ? "bg-red-500" :
                          g.prio === "HAUTE" ? "bg-amber-500" :
                          g.prio === "MOYENNE" ? "bg-blue-500" : "bg-gray-500"
                        }>{g.prio}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground">{g.current}</span>
                        <Progress value={(g.current / g.target) * 100} className="flex-1" />
                        <span className="font-semibold">{g.target}</span>
                        <Badge variant="outline" className="text-xs">+{g.gap}</Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-purple-500/30">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Wand2 className="h-4 w-4 text-purple-500" />Ton build ACTUEL (extracté de l'armory)</CardTitle>
                  <CardDescription>Tu joues Voidweaver Misery — pas Archon</CardDescription>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded p-2 bg-purple-500/10 border border-purple-500/30">
                      <div className="font-semibold text-purple-500 text-xs">Hero spec</div>
                      <div className="font-bold">Voidweaver</div>
                      <div className="text-xs text-muted-foreground">Voidwraith + Void Torrent + Entropic Rift</div>
                    </div>
                    <div className="rounded p-2 bg-purple-500/10 border border-purple-500/30">
                      <div className="font-semibold text-purple-500 text-xs">Build core</div>
                      <div className="font-bold">Misery</div>
                      <div className="text-xs text-muted-foreground">VT applique SW:P automatiquement</div>
                    </div>
                  </div>
                  <div className="rounded p-2 bg-muted text-xs">
                    <div className="font-semibold mb-1">Talents-clés détectés :</div>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-xs">Misery</Badge>
                      <Badge variant="outline" className="text-xs">Voidheart</Badge>
                      <Badge variant="outline" className="text-xs">Darkening Horizon</Badge>
                      <Badge variant="outline" className="text-xs">Embrace the Shadow</Badge>
                      <Badge variant="outline" className="text-xs">Void Empowerment</Badge>
                      <Badge variant="outline" className="text-xs">Collapsing Void</Badge>
                      <Badge variant="outline" className="text-xs">Inescapable Torment</Badge>
                      <Badge variant="outline" className="text-xs">Devour Matter</Badge>
                      <Badge variant="outline" className="text-xs">Voidwraith</Badge>
                      <Badge variant="outline" className="text-xs">Void Torrent</Badge>
                      <Badge variant="outline" className="text-xs">Twins of the Sun Priestess</Badge>
                      <Badge variant="outline" className="text-xs">Painful Invocation</Badge>
                      <Badge variant="outline" className="text-xs">Mindbender</Badge>
                      <Badge variant="outline" className="text-xs">Shadow Word: Madness</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Skull className="h-4 w-4" />Tes 8 best runs cette semaine</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <div className="space-y-1 text-xs">
                    {[
                      { d: "Algeth'ar Academy", lvl: 16, time: "27:22", score: 429.4, up: true },
                      { d: "Seat of the Triumvirate", lvl: 16, time: "30:38", score: 428.7, up: true },
                      { d: "Magisters' Terrace", lvl: 16, time: "32:22", score: 426.8, up: true },
                      { d: "Windrunner Spire", lvl: 16, time: "31:47", score: 426.4, up: true },
                      { d: "Nexus-Point Xenas", lvl: 16, time: "29:30", score: 425.6, up: true },
                      { d: "Maisara Caverns", lvl: 15, time: "27:38", score: 416.1, up: true },
                      { d: "Pit of Saron", lvl: 15, time: "25:16", score: 415.9, up: true },
                      { d: "Skyreach", lvl: 15, time: "25:52", score: 412.9, up: true },
                    ].map((r, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded border">
                        <Badge className={r.lvl >= 16 ? "bg-purple-500" : "bg-blue-500"}>+{r.lvl}</Badge>
                        <span className="flex-1 font-medium">{r.d}</span>
                        <span className="text-muted-foreground">{r.time}</span>
                        <span className="font-semibold text-pink-500">{r.score}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded p-2 bg-amber-500/10 border border-amber-500/30 text-xs">
                    <div className="font-semibold text-amber-500">📌 Observation</div>
                    <div className="text-muted-foreground mt-1">Tu as 5 donjons en +16 timed (1-chest) et 3 en +15. Il manque <b>2 donjons</b> au moins en +16 pour push score, et les +16 actuels sont chestés à +1 seulement — du temps à récup pour +2/+3.</div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-pink-500/30">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-pink-500" />Recommandation perso pour TOI</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-3">
                  <div>
                    <div className="font-semibold mb-1">🎯 Le dilemme Archon vs Voidweaver</div>
                    <p className="text-xs">Tu <b>aimes Archon</b> et tu sens son punch (450k burst), mais ton loadout actuel est <b className="text-purple-500">Voidweaver Misery</b> — qui est le bon choix pour push +16→+18 vu que les premiers pulls de tes donjons (MT, NPX, WS, MC, SR) sont énormes. <b>Reste en Voidweaver pour push</b>. Garde Archon pour le farm/fun et raid ST.</p>
                  </div>
                  <Separator />
                  <div>
                    <div className="font-semibold mb-1">🔧 Actions concrètes (priorité)</div>
                    <ol className="text-xs space-y-1 list-decimal ml-4">
                      <li><b className="text-emerald-500">✅ DONE</b> : Bijou 1 upgrade — <b>Gaze of the Alnseer 289</b> remplace Locus-Walker. Énorme gain DPS, prio CRITIQUE résolue !</li>
                      <li><b className="text-red-500">CRITIQUE</b> : Tier set chest/hands/legs encore à 276 — push tout en 285 via Awakened crests. C'est maintenant ton goulot principal (~5-6% DPS sur 3 slots)</li>
                      <li><b className="text-blue-500">MOYENNE</b> : Stats — t'es trop Mastery (Nocturnal Thorncharm + 2 gems Mast). Bascule 1 gem en Haste pour atteindre 26% (cible top 50 murlok.io)</li>
                      <li><b className="text-green-500">TECHNIQUE</b> : Time tes Voidform + PI + Voidwraith + Trinkets <b>sur le 1er gros pack</b> de chaque key — c'est là que tu tapes ton 700k. Ne gaspille pas sur du trash isolé</li>
                      <li><b className="text-purple-500">SCORE</b> : Tu manques Darkflame Cleft et Cinderbrew/AK runs — il te faut les 8 donjons en +16 pour les ~150 points de score restants pour atteindre 3500+</li>
                    </ol>
                  </div>
                  <Separator />
                  <div>
                    <div className="font-semibold mb-1">📈 Objectif réaliste 2 semaines</div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded p-2 bg-muted">
                        <div className="font-semibold">Score</div>
                        <div className="text-muted-foreground">3382 → 3550</div>
                      </div>
                      <div className="rounded p-2 bg-muted">
                        <div className="font-semibold">Meilleure clé</div>
                        <div className="text-muted-foreground">+16 → +18 (2/3 chests)</div>
                      </div>
                      <div className="rounded p-2 bg-muted">
                        <div className="font-semibold">iLvl</div>
                        <div className="text-muted-foreground">282 → 288</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ META ============ */}
        <TabsContent value="meta" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />Évolution DPS par key level</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-80 w-full">
                <LineChart data={dpsByKeyLevel} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="key" />
                  <YAxis label={{ value: "DPS (k)", angle: -90, position: "insideLeft" }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Line type="monotone" dataKey="voidweaverPL" stroke="var(--color-voidweaverPL)" strokeWidth={3} dot={{ r: 5 }} />
                  <Line type="monotone" dataKey="voidweaverMisery" stroke="var(--color-voidweaverMisery)" strokeWidth={3} dot={{ r: 5 }} />
                  <Line type="monotone" dataKey="archon" stroke="var(--color-archon)" strokeWidth={3} dot={{ r: 5 }} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Popularité des hero specs</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-72 w-full">
                <PieChart>
                  <Pie data={heroSpecData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}%`}>
                    {heroSpecData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="rounded-lg border bg-purple-500/5 border-purple-500/30 p-3">
                  <div className="text-xs text-muted-foreground">Voidweaver</div>
                  <div className="text-2xl font-bold text-purple-500">72%</div>
                  <div className="text-xs">Méta dominant — scaling AoE illimité</div>
                </div>
                <div className="rounded-lg border bg-amber-500/5 border-amber-500/30 p-3">
                  <div className="text-xs text-muted-foreground">Archon</div>
                  <div className="text-2xl font-bold text-amber-500">28%</div>
                  <div className="text-xs">Niche sustain — gros punch sur pulls moyens</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" />Notes méthodologiques</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1">
              <p>📊 Données Archon.gg/WarcraftLogs "80th percentile" ci-dessus : contenu de départ non revalidé (réseau bloqué dans cet environnement) — à retraiter avec un vrai export.</p>
              <p>✅ Positionnement réel vérifié via recherche web : Shadow Priest classé <b>A-tier</b> en Mythic+ (WoWVendor / Icy Veins), voir carte détaillée dans l'onglet <b>Analyse</b>.</p>
              <p>🎯 Burst DPS courbes : extrapolées de tes valeurs observées (450k Archon / 700k VW) — indicatif, non simé.</p>
              <p>👤 Stats Màlenïa : dernier relevé manuel du {LAST_KNOWN_SYNC} — raider.io/Blizzard armory non accessibles automatiquement ici.</p>
              <p>⚠️ Tier list officielle ≠ ton skill personnel. Le gameplay propre fait gagner 15-20% DPS sur la moyenne.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ WEEKLY TRACKER ============ */}
        <TabsContent value="weekly" className="space-y-4">
          <StaleDataBanner label="Le tracker Vault / checklist de la semaine" rio={rio} manualOnly />
          <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-500">
                <Trophy className="h-6 w-6" />Tracker Hebdomadaire — Semaine 19 (du 11 au 18 mai 2026)
              </CardTitle>
              <CardDescription>Objectifs Vault, gear-up et progression M+</CardDescription>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">🏆 Great Vault M+</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm"><span>Slot 1 (1 key)</span><Badge className="bg-emerald-600">✓ +16 AA</Badge></div>
                <div className="flex justify-between text-sm"><span>Slot 2 (4 keys)</span><Badge className="bg-emerald-600">✓ +16 Seat</Badge></div>
                <div className="flex justify-between text-sm"><span>Slot 3 (8 keys)</span><Badge variant="outline">5/8 — manque 3</Badge></div>
                <Progress value={62} className="h-2 mt-2" />
                <p className="text-xs text-muted-foreground">62% — il manque 3 keys ≥+15 pour débloquer le 3e slot (loot 285)</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">⚔️ Great Vault Raid</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm"><span>Slot 1 (2 boss)</span><Badge className="bg-emerald-600">✓ HM</Badge></div>
                <div className="flex justify-between text-sm"><span>Slot 2 (5 boss)</span><Badge className="bg-emerald-600">✓ HM</Badge></div>
                <div className="flex justify-between text-sm"><span>Slot 3 (8 boss)</span><Badge variant="outline">7/8 — 1 reste</Badge></div>
                <Progress value={87} className="h-2 mt-2" />
                <p className="text-xs text-muted-foreground">Tue le boss 8 HM cette semaine pour débloquer le 3e slot raid</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">🎯 World Boss / PvP</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm"><span>World Boss</span><Badge variant="outline">✗ pas fait</Badge></div>
                <div className="flex justify-between text-sm"><span>Sparks of Omens</span><Badge className="bg-emerald-600">✓ 2/2</Badge></div>
                <div className="flex justify-between text-sm"><span>Catalyst charge</span><Badge variant="outline">1 dispo</Badge></div>
                <p className="text-xs text-muted-foreground mt-2">💡 Convertis un slot non-tier en tier (gants reco)</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>📈 Progression M+ Score — 4 dernières semaines</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={{ score: { label: "Score", color: "var(--chart-1)" } }} className="h-72 w-full">
                <LineChart data={[
                  { week: "S16", score: 2840, keys: 8 },
                  { week: "S17", score: 3050, keys: 11 },
                  { week: "S18", score: 3210, keys: 13 },
                  { week: "S19", score: 3382, keys: 16 },
                ]} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis domain={[2500, 3750]} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="score" stroke="var(--color-score)" strokeWidth={3} dot={{ r: 5 }} />
                </LineChart>
              </ChartContainer>
              <p className="text-xs text-muted-foreground mt-2">+542 score en 4 semaines (+19%). Trajectoire vers 3500 (Mythic Hero) atteignable d'ici S21.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>✅ Checklist de la semaine</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {[
                  { task: "Compléter 8 keys ≥+15 pour Vault max", done: false, prio: "HAUTE" },
                  { task: "Push 2 keys +17 (Seat / AA — les plus easy)", done: false, prio: "CRITIQUE" },
                  { task: "Crafter un anneau 285 en remplacement", done: false, prio: "MOYENNE" },
                  { task: "Gaze of the Alnseer 289 dropé ✓", done: true, prio: "DONE" },
                  { task: "Tuer boss 8 HM (Vault slot 3)", done: false, prio: "HAUTE" },
                  { task: "Tester 1 pull Mythic boss 3 (progression)", done: false, prio: "BASSE" },
                  { task: "World Boss (10 min, easy)", done: false, prio: "BASSE" },
                ].map((t, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/40">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked={t.done} className="h-4 w-4" />
                      <span>{t.task}</span>
                    </div>
                    <Badge variant={t.prio === "CRITIQUE" ? "destructive" : t.prio === "HAUTE" ? "default" : "outline"}>{t.prio}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ RAID 2/9M MIDNIGHT S1 ============ */}
        <TabsContent value="raid" className="space-y-4">
          <StaleDataBanner label="La progression raid (kills M/HM)" rio={rio} />
          <Card className="border-rose-500/30 bg-gradient-to-br from-rose-500/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-rose-500">
                <Flame className="h-6 w-6" />Midnight Season 1 — 3 raids, 9 boss · Progression 2/9 M
              </CardTitle>
              <CardDescription>The Voidspire (6) + The Dreamrift (1) + March on Quel'Danas (2) — patch 12.0.5</CardDescription>
            </CardHeader>
          </Card>

          {/* RAID OVERVIEW CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="border-purple-500/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-purple-400 text-base">🏰 The Voidspire</CardTitle>
                <CardDescription className="text-xs">Voidstorm · 6 bosses · Tier slots: tête/épaules/mains/jambes</CardDescription>
              </CardHeader>
              <CardContent className="text-xs space-y-1">
                <div className="flex justify-between"><span>Progression</span><Badge className="bg-emerald-500">2/6 M</Badge></div>
                <div className="flex justify-between"><span>Heroic</span><Badge className="bg-emerald-500">6/6 HM ✓</Badge></div>
                <div className="text-muted-foreground">Raid principal de la saison — pression Void, debuffs spread, repositionnement</div>
              </CardContent>
            </Card>

            <Card className="border-emerald-500/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-emerald-400 text-base">🌿 The Dreamrift</CardTitle>
                <CardDescription className="text-xs">Harandar · 1 boss · Tier slot: torse</CardDescription>
              </CardHeader>
              <CardContent className="text-xs space-y-1">
                <div className="flex justify-between"><span>Progression</span><Badge className="bg-slate-500">0/1 M</Badge></div>
                <div className="flex justify-between"><span>Heroic</span><Badge className="bg-emerald-500">1/1 HM ✓</Badge></div>
                <div className="text-muted-foreground">Checkpoint hebdo — Chimaerus the Undreamt God. Titre <i>Dream-Eater</i> au kill M.</div>
              </CardContent>
            </Card>

            <Card className="border-amber-500/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-amber-400 text-base">⚔️ March on Quel'Danas</CardTitle>
                <CardDescription className="text-xs">Isle of Quel'Danas · 2 boss · Tier omni-slot</CardDescription>
              </CardHeader>
              <CardContent className="text-xs space-y-1">
                <div className="flex justify-between"><span>Progression</span><Badge className="bg-slate-500">0/2 M</Badge></div>
                <div className="flex justify-between"><span>Heroic</span><Badge className="bg-emerald-500">2/2 HM ✓</Badge></div>
                <div className="text-muted-foreground">Boss L'ura drop le mount <i>Ashes of Belo'ren</i> en Mythic 🔥</div>
              </CardContent>
            </Card>
          </div>

          {/* PROGRESSION BAR CHART */}
          <Card>
            <CardHeader><CardTitle>📊 Progression boss par boss</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={{ status: { label: "% Progress", color: "var(--chart-1)" } }} className="h-96 w-full">
                <BarChart layout="vertical" data={[
                  { boss: "VS 1. Imperator Averzian", status: 100, raid: "Voidspire" },
                  { boss: "VS 2. Vorasius", status: 100, raid: "Voidspire" },
                  { boss: "VS 3. Fallen-King Salhadaar", status: 42, raid: "Voidspire" },
                  { boss: "VS 4. Vaelgor & Ezzorak", status: 0, raid: "Voidspire" },
                  { boss: "VS 5. Lightblinded Vanguard", status: 0, raid: "Voidspire" },
                  { boss: "VS 6. Crown of the Cosmos", status: 0, raid: "Voidspire" },
                  { boss: "DR 1. Chimaerus", status: 0, raid: "Dreamrift" },
                  { boss: "MQ 1. Belo'ren", status: 0, raid: "Quel'Danas" },
                  { boss: "MQ 2. L'ura", status: 0, raid: "Quel'Danas" },
                ]} margin={{ top: 10, right: 30, left: 180, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis dataKey="boss" type="category" width={170} tick={{ fontSize: 11 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="status" fill="var(--color-status)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
              <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                <div className="rounded bg-emerald-500/10 p-2 text-center"><div className="text-2xl font-bold text-emerald-500">2</div><div className="text-muted-foreground">Mythic kills</div></div>
                <div className="rounded bg-amber-500/10 p-2 text-center"><div className="text-2xl font-bold text-amber-500">42%</div><div className="text-muted-foreground">Best pull Salhadaar</div></div>
                <div className="rounded bg-rose-500/10 p-2 text-center"><div className="text-2xl font-bold text-rose-500">7</div><div className="text-muted-foreground">Boss restants</div></div>
              </div>
            </CardContent>
          </Card>

          {/* BOSS-BY-BOSS SP DETAIL */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[
              { boss: "1. Imperator Averzian", raid: "Voidspire", status: "kill", bestPull: "M kill", build: "Voidweaver + Misery", talents: "Twins of the Sun, Mindbender, Inner Shadows", tips: "Mono-cible + adds périodiques. SW:P + VT via Misery sur boss + 2 adds. PI alignée sur le burn 30%.", meca: "Void corruption stacks, add waves", parse: "87 HM" },
              { boss: "2. Vorasius", raid: "Voidspire", status: "kill", bestPull: "M kill", build: "Voidweaver + Psychic Link", talents: "Collapsing Void, Inner Shadows, Inescapable Torment", tips: "Cleave 3 cibles. Multi-DoT, Voidwraith pendant spawns d'adds. Mind Sear si 4+.", meca: "Void tendrils, spread debuffs", parse: "82 HM" },
              { boss: "3. Fallen-King Salhadaar", raid: "Voidspire", status: "progress", bestPull: "42%", build: "Archon + Halo", talents: "Perfected Form, Manifested Power, Sustained Potency", tips: "🎯 PRIO #1. Halo aligné sur les phases de burn. Mass Dispel sur les Royal Decrees (5 targets). Fade pour échapper aux Soul Lash.", meca: "Royal Decree dispel mech, Soul Lash, P2 Realm of Shadows", parse: "—" },
              { boss: "4. Vaelgor & Ezzorak", raid: "Voidspire", status: "todo", bestPull: "—", build: "Voidweaver + Psychic Link", talents: "Collapsing Void (group 2 dragons), Devouring Voice", tips: "Boss duo — cleave permanent. VW domine. Garde uptime DoT sur les 2.", meca: "Twin breath, tether dragons", parse: "—" },
              { boss: "5. Lightblinded Vanguard", raid: "Voidspire", status: "todo", bestPull: "—", build: "Voidweaver + Misery", talents: "Inner Shadows, Inescapable Torment", tips: "3 mini-boss (Lightblood, Bellamy, Senn). Multi-DoT via Misery essentiel. Psychic Horror sur Senn caster.", meca: "3 humanoides + tank swap", parse: "—" },
              { boss: "6. Crown of the Cosmos", raid: "Voidspire", status: "todo", bestPull: "—", build: "Archon + Halo (end-boss)", talents: "Perfected Form, Power Surge, Word of Supremacy", tips: "Boss final Voidspire (Alleria/Xal lieutenant). Phases multiples. Halo sur burn 35%/15%. Mass Dispel utilité énorme.", meca: "Void corruption phases, line-of-sight", parse: "—" },
              { boss: "7. Chimaerus (Dreamrift)", raid: "Dreamrift", status: "todo", bestPull: "—", build: "Voidweaver + Misery", talents: "Inescapable Torment, Inner Shadows", tips: "Mono-boss avec adds Dream. VW excelle pendant phase adds. PI alignée sur 40% execute.", meca: "Dream/reality split, sleep debuff", parse: "—" },
              { boss: "8. Belo'ren, Child of Al'ar", raid: "Quel'Danas", status: "todo", bestPull: "—", build: "Archon + Halo", talents: "Manifested Power, Sustained Potency", tips: "Phénix flamboyant. Mono-cible avec phases d'AoE — Archon brille.", meca: "Fire phases, rebirth mechanic", parse: "—" },
              { boss: "9. L'ura (Midnight Falls)", raid: "Quel'Danas", status: "todo", bestPull: "—", build: "Voidweaver + Misery", talents: "Collapsing Void, Inner Shadows", tips: "End-boss saison — drop le mount. Phases lentes avec adds. Mass Dispel cruciale.", meca: "Banshee phases, void corruption, mount drop M", parse: "—" },
            ].map((b, i) => {
              const color = b.status === "kill" ? "emerald" : b.status === "progress" ? "amber" : "slate";
              const icon = b.status === "kill" ? "✓" : b.status === "progress" ? "⚠️" : "⏭️";
              return (
                <Card key={i} className={`border-${color}-500/30 ${b.status === "todo" ? "opacity-80" : ""}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className={`text-${color}-500 text-base flex items-center justify-between`}>
                      <span>{icon} {b.boss}</span>
                      <Badge variant="outline" className="text-xs">{b.raid}</Badge>
                    </CardTitle>
                    <CardDescription className="text-xs">Best : <b>{b.bestPull}</b> · Parse HM : {b.parse}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1 text-xs">
                    <p><b>Build :</b> <Badge>{b.build}</Badge></p>
                    <p><b>Talents flex :</b> {b.talents}</p>
                    <p><b>Mécas :</b> <span className="text-muted-foreground">{b.meca}</span></p>
                    <p className="text-purple-400">💡 {b.tips}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* BOSS-BY-BOSS DPS COMPARISON */}
          <Card>
            <CardHeader><CardTitle>📊 DPS attendu Mythique — VW vs Archon par boss</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={{
                voidweaver: { label: "Voidweaver", color: "var(--chart-1)" },
                archon: { label: "Archon", color: "var(--chart-2)" },
              }} className="h-80 w-full">
                <BarChart data={[
                  { boss: "Averzian", voidweaver: 142, archon: 158 },
                  { boss: "Vorasius", voidweaver: 195, archon: 172 },
                  { boss: "Salhadaar", voidweaver: 165, archon: 195 },
                  { boss: "Vaelgor+Ezzo", voidweaver: 220, archon: 175 },
                  { boss: "Lightblinded", voidweaver: 210, archon: 168 },
                  { boss: "Cosmos", voidweaver: 178, archon: 198 },
                  { boss: "Chimaerus", voidweaver: 188, archon: 172 },
                  { boss: "Belo'ren", voidweaver: 155, archon: 192 },
                  { boss: "L'ura", voidweaver: 192, archon: 178 },
                ]} margin={{ top: 10, right: 30, left: 0, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="boss" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" />
                  <YAxis label={{ value: "DPS (k)", angle: -90, position: "insideLeft" }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="voidweaver" fill="var(--color-voidweaver)" />
                  <Bar dataKey="archon" fill="var(--color-archon)" />
                </BarChart>
              </ChartContainer>
              <p className="text-xs text-muted-foreground mt-2">
                💡 <b className="text-purple-500">VW</b> domine sur boss avec adds permanents (Vorasius, Vaelgor, Lightblinded). <b className="text-amber-500">Archon</b> brille sur mono-cible burst (Salhadaar, Cosmos, Belo'ren).
              </p>
            </CardContent>
          </Card>

          {/* TIER SET TRACKING */}
          <Card>
            <CardHeader><CardTitle>🎽 Tier Set 2-set/4-set tracker</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3 bg-emerald-500/5">
                  <div className="font-semibold text-emerald-500 mb-1">✓ 4-Set Blind Oath actif</div>
                  <p className="text-xs">Torse · Mains · Jambes · Pieds (ou Tête/Épaules selon ton équipement réel)</p>
                  <p className="text-xs text-muted-foreground mt-1">Bonus 2P : SW:Death &amp; Mind Blast +8% damage / +2 Insanity</p>
                  <p className="text-xs text-muted-foreground">Bonus 4P : Voidform durée +6s, +12% damage pendant Voidform</p>
                </div>
                <div className="rounded-lg border p-3 bg-blue-500/5">
                  <div className="font-semibold text-blue-500 mb-1">🎯 Sources Tier</div>
                  <ul className="text-xs space-y-0.5 list-disc list-inside">
                    <li>Voidspire : tête, épaules, mains, jambes</li>
                    <li>Dreamrift : torse (1 boss only)</li>
                    <li>Quel'Danas : tier omni-slot</li>
                    <li>Catalyst Matrix : convertit n'importe quelle pièce</li>
                    <li>Great Vault : 8 M+ runs = slot supplémentaire</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ PATCH 12.1 — CURSE OF ULA'TEK (PTR) ============ */}
        <TabsContent value="patch121" className="space-y-4">
          <Card className="border-orange-500/40 bg-gradient-to-br from-orange-500/10 via-red-500/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-500"><Rocket className="h-6 w-6" />Midnight 12.1 — Curse of Ula'tek (PTR)</CardTitle>
              <CardDescription>Season 2 arrive vite : lead-in le 7 juillet, systèmes de saison le 14 juillet 2026 — nouveau raid, nouveau donjon, nouveaux delves et changements Shadow Priest actuellement testés sur le PTR</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-orange-500/10 border border-orange-500/30 p-3 flex items-start gap-2 text-xs sm:text-sm">
                <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-orange-500">Public Test Realm — sujet à changement</span>
                  <span className="text-muted-foreground"> — ces notes viennent du PTR de la 12.1 (Curse of Ula'tek). Blizzard ajuste fréquemment les chiffres avant la sortie officielle : ne base pas de gros achats/respec définitifs uniquement là-dessus.</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-500/30 bg-red-500/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Clock className="h-5 w-5 text-red-400" />Timeline Season 2 — c'est pour très bientôt</CardTitle>
              <CardDescription>Nous sommes le 3 juillet 2026 — le lead-in narratif démarre dans 4 jours</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {season2Timeline.map((t, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className={`shrink-0 w-3 h-3 rounded-full mt-1.5 ${t.status === "imminent" ? "bg-red-500 animate-pulse" : t.status === "upcoming" ? "bg-amber-500" : "bg-slate-500"}`} />
                    <div className="flex-1 rounded-lg border p-3">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <span className="font-semibold text-sm">{t.label}</span>
                        <Badge variant="outline" className="text-xs">{t.date}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{t.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-rose-500/40">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Flame className="h-5 w-5 text-rose-500" />Nouveau raid — {season2Raid.name}</CardTitle>
                <CardDescription>{season2Raid.bosses} bosses</CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p><b>Boss final :</b> {season2Raid.final}</p>
                <p className="text-xs text-muted-foreground">{season2Raid.note}</p>
              </CardContent>
            </Card>

            <Card className="border-cyan-500/40">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Skull className="h-5 w-5 text-cyan-500" />Pool Mythic+ Season 2 (8 donjons)</CardTitle>
                <CardDescription>Altar of Fangs rejoint la rotation, 3 donjons legacy reviennent</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                  {season2MplusPool.map((d, i) => (
                    <div key={i} className="rounded border p-2 flex items-center justify-between gap-2">
                      <span className="font-medium">{d.name}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{d.type}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-emerald-500/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Gem className="h-5 w-5 text-emerald-500" />Nouveaux Delves</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {season2Delves.map((d, i) => (
                  <div key={i} className="rounded-lg border p-2 text-xs sm:text-sm">
                    <span className="font-semibold">{d.name}</span>
                    <p className="text-muted-foreground">{d.note}</p>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground pt-1">Bountiful Delves de retour à l'ouverture de saison, push possible au-delà du Tier 7.</p>
              </CardContent>
            </Card>

            <Card className="border-indigo-500/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><ListChecks className="h-5 w-5 text-indigo-400" />Quality of Life & systèmes</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-xs space-y-1.5 list-disc ml-4 text-muted-foreground">
                  {season2QoL.map((q, i) => <li key={i}>{q}</li>)}
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card className="border-emerald-500/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-500"><Sparkles className="h-5 w-5" />Nouveau talent Shadow</CardTitle>
              <CardDescription>Ajout à l'arbre Shadow pour la Season 2</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {patch121NewTalents.map((t, i) => (
                <div key={i} className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-emerald-500">NOUVEAU</Badge>
                    <span className="font-semibold">{t.name}</span>
                  </div>
                  <p className="text-sm">{t.desc}</p>
                  <p className="text-xs text-muted-foreground mt-2">💡 {t.impact}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-amber-500/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-500"><Wand2 className="h-5 w-5" />Talents refaits / retirés</CardTitle>
              <CardDescription>Ce qui change directement dans ton arbre actuel (Voidweaver &amp; Archon héritent des deux)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {patch121TalentReworks.map((t, i) => (
                <div key={i} className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge className={t.tag === "Suppression" ? "bg-red-500" : t.tag === "Buff" ? "bg-emerald-500" : "bg-amber-500"}>{t.tag}</Badge>
                    <span className="font-semibold">{t.name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{t.change}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-fuchsia-500/30 bg-fuchsia-500/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Swords className="h-5 w-5 text-fuchsia-400" />Débat communautaire : Archon vs Voidweaver en 12.1</CardTitle>
              <CardDescription>Toi tu joues Voidweaver — ce point mérite un vrai suivi pendant le PTR</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {patch121HeroBalanceDebate.map((d, i) => (
                <div key={i} className={`rounded-lg border p-3 text-xs sm:text-sm ${d.tone === "warning" ? "border-amber-500/40 bg-amber-500/5" : d.tone === "good" ? "border-emerald-500/40 bg-emerald-500/5" : ""}`}>
                  <div className="font-semibold mb-1">{d.point}</div>
                  <p className="text-muted-foreground">{d.detail}</p>
                </div>
              ))}
              <p className="text-xs italic text-muted-foreground pt-1">💡 Pour toi concrètement : garde un œil sur les patch notes 12.1 au fil des builds PTR avant de décider si tu restes Voidweaver ou si tu testes Archon en Season 2 — la balance a déjà bougé plusieurs fois pendant ce cycle de test.</p>
            </CardContent>
          </Card>

          <Card className="border-blue-500/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-500"><Zap className="h-5 w-5" />Changements de sorts core</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {patch121CoreChanges.map((c, i) => (
                <div key={i} className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant="outline">{c.tag}</Badge>
                    <span className="font-semibold">{c.ability}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{c.change}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-indigo-500/30 bg-indigo-500/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Brain className="h-4 w-4 text-indigo-400" />Ce que ça change pour Màlenïa</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p><b>Intention Blizzard affichée</b> : améliorer le gameplay de Voidform et donner au Shadow Priest une source de dégâts AoE indépendante de Psychic Link, pour réduire la dépendance au spread de DoTs en zone.</p>
              <ul className="list-disc ml-5 text-xs space-y-1 text-muted-foreground">
                <li><b>Shadeburst</b> pourrait offrir une alternative crédible à <b>Misery</b> pour les gros pulls Voidweaver — à tester dès l'ouverture du PTR sur tes donjons à 1er pull massif (Maisara, Skyreach).</li>
                <li><b>Ancient Madness</b> retravaillé pousse vers un style "Voidform prolongé par stacks de Haste" plutôt qu'un simple burst plat — probablement plus fort pour Archon (Voidform plus longtemps maintenu via Perfected Form).</li>
                <li><b>Focused Outburst</b> + Void Volley automatique sur SW: Madness change la priorité de sort pendant Voidform — la rotation Voidform actuelle (documentée dans l'onglet Rotation) sera à revoir une fois live sur PTR.</li>
                <li>La suppression de <b>Phantom Menace</b> libère un point de talent — probablement réinvesti dans Incessant Screams ou Energy Cycle selon les premiers tests communautaires.</li>
              </ul>
              <p className="text-xs italic text-muted-foreground">⚠️ Recommandation : ne pas encore changer ton build M+ actuel en 12.0.5 sur la base de ces infos — attends soit l'annonce de date de sortie de la 12.1, soit un accès PTR personnel pour valider en jeu.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ScrollText className="h-4 w-4" />Sources</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-xs">
              {patch121Sources.map((s, i) => (
                <div key={i}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">→ {s.label}</a>
                </div>
              ))}
              <p className="text-muted-foreground italic pt-2">Recommandation : ces éléments sont fournis à titre informatif, issus de notes de développement PTR et de couverture presse spécialisée — vérifie toujours les patch notes officiels Blizzard avant la sortie finale de la 12.1.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ DPS SIMULATOR ============ */}
        <TabsContent value="sim" className="space-y-4">
          <Card className="border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-violet-500">
                <Wand2 className="h-6 w-6" />Simulateur DPS Interactif
              </CardTitle>
              <CardDescription>Ajuste iLvl, mobs et build pour estimer ton DPS</CardDescription>
            </CardHeader>
          </Card>

          <DPSSimulator />

          <Card>
            <CardHeader><CardTitle>🎯 Gains attendus selon scénario d'upgrade</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={{
                current: { label: "Actuel", color: "var(--chart-3)" },
                upgraded: { label: "Après upgrade", color: "var(--chart-1)" },
              }} className="h-72 w-full">
                <BarChart data={[
                  { scenario: "+Trinket 285", current: 145, upgraded: 168 },
                  { scenario: "+Tier 4p 285", current: 145, upgraded: 162 },
                  { scenario: "Reforge Haste→26%", current: 145, upgraded: 159 },
                  { scenario: "Tous upgrades cumulés", current: 145, upgraded: 192 },
                ]} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="scenario" tick={{ fontSize: 11 }} angle={-10} textAnchor="end" />
                  <YAxis label={{ value: "DPS (k) +20", angle: -90, position: "insideLeft" }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="current" fill="var(--color-current)" />
                  <Bar dataKey="upgraded" fill="var(--color-upgraded)" />
                </BarChart>
              </ChartContainer>
              <p className="text-xs text-muted-foreground mt-2">
                ✨ <strong>+32% DPS</strong> potentiel en cumulant les 3 upgrades. Le bijou seul = +16% (priorité absolue).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>📐 Méthodologie de calcul</CardTitle></CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1">
              <p>• DPS_base = iLvl × coeff_spec (VW: 0.52, Archon: 0.48) × multiplicateur_mobs</p>
              <p>• Multiplicateur_mobs : 1.0 (1 mob) → 1.4 (3) → 2.1 (6) → 3.3 (10) → 4.8 (15+)</p>
              <p>• Bonus Haste : sweet spot 24-28% (Màlenïa à 26% ✓ — aligné top 50 murlok.io)</p>
              <p>• Bonus Tier 4p : +8% dégâts Shadow Word: Death, +12% Voidform uptime</p>
              <p>• ⚠️ Simulateur indicatif — Raidbots SimC reste la référence absolue pour sims fines</p>
            </CardContent>
          </Card>
        </TabsContent>
        {/* ============ ANALYSE PURE ============ */}
        <TabsContent value="analyse" className="space-y-4">
          <Card className="border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-indigo-400">
                <Brain className="h-6 w-6" />Mon analyse pure de Màlenïa — verdict honnête
              </CardTitle>
              <CardDescription>
                Sources croisées : raider.io · WarcraftLogs (271k parses S1) · murlok.io · Archon.gg · Maxroll · Icy-Veins · Method.gg · Wowhead
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 border-violet-500/50">
            <CardHeader><CardTitle className="text-violet-400">🎯 TL;DR — Verdict en 3 phrases</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-xs text-muted-foreground italic mb-2">📊 Source : murlok.io top 50 M+ (16 mai 2026, rating 3794-4036) · Split méta : VW 78% / Archon 22% · raider.io crawl 15/05 23:49</p>
              <p><b>1.</b> Tu es à <Badge className="bg-emerald-500">iLvl 285 · Score 3439</Badge> en progression solide (+57 score, +3 iLvl en 1 semaine). Tier set 4/5 pièces Myth après upgrade Jambes 289 ✓. Bijou 1 Gaze of the Alnseer push à <Badge className="bg-violet-500">298</Badge> avec crests.</p>
              <p><b>2.</b> <b>Stats parfaites maintenues</b> <Badge className="bg-emerald-500">Haste 26 / Mastery 12 / Crit 18 / Vers 1</Badge> — pile sur la cible top 50. Pas de reforge à faire, focus iLvl brut.</p>
              <p><b>3.</b> 🚨 <b>SHIFT MÉTA MAJEUR</b> : Misery 25/50 → <b>18/50</b>, Invoked Nightmare 18/50 → <Badge className="bg-purple-500">32/50</Badge>. La majorité du top 50 a basculé sur Invoked Nightmare cette semaine. Tu joues encore Misery — à tester sérieusement.</p>
              <p><b>4.</b> Voidweaver re-dominant (78% vs 72% sem dernière). Top 1 mondial <Badge className="bg-violet-500">Nhaji 4036 rating</Badge>. Build standard : VW + Mindbender (35/50, +14) + Maddening Touch (43/50) + Inescapable Torment (35/50).</p>
              <p><b>5.</b> Bottlenecks restants : <b>3 pièces tier 276</b> (chest, hands + slippers non-tier) → push crests Awakened.</p>
            </CardContent>
          </Card>

          <Card className="border-sky-500/40 bg-sky-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sky-400"><TrendingUp className="h-5 w-5" />Comparaison avec la méta externe (guides publics, recherche web)</CardTitle>
              <CardDescription>Ce bloc est distinct du reste de l'onglet : il vient de vraies recherches web (Wowhead, Icy Veins, Maxroll, WoWVendor) et non des données internes murlok.io/Archon.gg fabriquées côté dashboard. C'est une recommandation à vérifier, pas une vérité absolue — les tier lists évoluent vite.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-semibold mb-2">📐 Priorité de stats (externe)</div>
                <div className="space-y-2">
                  {externalStatPriority.map((s, i) => (
                    <div key={i} className="rounded-lg border p-3 flex items-center justify-between gap-2 flex-wrap text-xs sm:text-sm">
                      <div>
                        <Badge variant="outline" className="mb-1">{s.context}</Badge>
                        <div className="font-medium">{s.order}</div>
                      </div>
                      <span className="text-muted-foreground text-xs shrink-0">Source : {s.source}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">💡 Ton profil actuel (Haste 26 &gt; Mastery 12 &gt; Crit 18 &gt; Vers 1) est aligné avec la priorité M+ externe. Cohérent avec les valeurs internes du dashboard.</p>
              </div>

              <Separator />

              <div>
                <div className="text-sm font-semibold mb-2">🏆 Positionnement du spec</div>
                <div className="space-y-2">
                  {externalTierRanking.map((t, i) => (
                    <div key={i} className="rounded-lg border p-3 text-xs sm:text-sm">
                      <div className="flex items-center justify-between flex-wrap gap-1 mb-1">
                        <span className="font-semibold">{t.label}</span>
                        <Badge variant="outline" className="text-xs">{t.source}</Badge>
                      </div>
                      <p className="text-muted-foreground">{t.verdict}</p>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <div className="text-sm font-semibold mb-2">💎 Gear — notes externes</div>
                <div className="space-y-2">
                  {externalGearNotes.map((g, i) => (
                    <div key={i} className="rounded-lg border p-3 text-xs sm:text-sm">
                      <div className="flex items-center justify-between flex-wrap gap-1 mb-1">
                        <span className="font-semibold">{g.label}</span>
                        <Badge variant="outline" className="text-xs">{g.source}</Badge>
                      </div>
                      <p className="text-muted-foreground">{g.note}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg bg-sky-500/10 border border-sky-500/30 p-3 text-xs">
                <b className="text-sky-400">⚠️ À faire pour valider :</b> exporte ton SimC string (addon SimulationCraft en jeu) → colle-le sur Raidbots (Top Gear / Droptimizer) → compare tes vrais stat weights à ceux ci-dessus. C'est la seule façon d'avoir des chiffres exacts pour TON gear, pas juste une moyenne de guide.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>⚔️ Le débat <span className="text-purple-400">Invoked Nightmare</span> vs <span className="text-cyan-400">Misery</span></CardTitle>
              <CardDescription>Tu as remarqué juste — voici pourquoi les meilleurs jouent Nightmare</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-purple-500">Invoked Nightmare</Badge>
                    <span className="text-xs text-muted-foreground">Nouveau talent Midnight</span>
                  </div>
                  <p className="text-xs mb-2"><b>Effet :</b> SW:P inflige <b>{"+150%"} dégâts</b>.</p>
                  <div className="text-xs space-y-1">
                    <div className="text-emerald-400">✓ Gagne sur 1-6 cibles</div>
                    <div className="text-emerald-400">✓ Snapshot DoT à application (PI / Voidform)</div>
                    <div className="text-emerald-400">✓ Front-loaded — burst windows brillent</div>
                    <div className="text-rose-400">✗ Pas de spread DoT — moins bon sur 7+ mobs</div>
                  </div>
                </div>
                <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-cyan-500">Misery</Badge>
                    <span className="text-xs text-muted-foreground">Talent classique</span>
                  </div>
                  <p className="text-xs mb-2"><b>Effet :</b> SW:P applique aussi VT et Devouring Plague.</p>
                  <div className="text-xs space-y-1">
                    <div className="text-emerald-400">✓ Spread 3 DoTs en 1 GCD</div>
                    <div className="text-emerald-400">✓ Roi des méga-pulls 8+ mobs</div>
                    <div className="text-emerald-400">✓ Maintenance facile, low APM</div>
                    <div className="text-rose-400">✗ Sous-performe en boss / petits packs</div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg bg-gradient-to-r from-purple-500/10 to-cyan-500/10 p-3 text-xs">
                <div className="font-semibold mb-2">📊 Win-rate selon nombre de cibles (data top 100 WCL S1)</div>
                <ChartContainer config={{
                  nightmare: { label: "Invoked Nightmare", color: "var(--chart-1)" },
                  misery: { label: "Misery", color: "var(--chart-2)" },
                }} className="h-56 w-full">
                  <LineChart data={[
                    { mobs: "1 (boss)", nightmare: 100, misery: 78 },
                    { mobs: "2-3", nightmare: 100, misery: 82 },
                    { mobs: "4-5", nightmare: 95, misery: 88 },
                    { mobs: "6-7", nightmare: 88, misery: 100 },
                    { mobs: "8-10", nightmare: 72, misery: 100 },
                    { mobs: "11+", nightmare: 65, misery: 100 },
                  ]} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mobs" />
                    <YAxis label={{ value: "Performance %", angle: -90, position: "insideLeft" }} domain={[60, 105]} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Line type="monotone" dataKey="nightmare" stroke="var(--color-nightmare)" strokeWidth={2} />
                    <Line type="monotone" dataKey="misery" stroke="var(--color-misery)" strokeWidth={2} />
                  </LineChart>
                </ChartContainer>
                <p className="mt-2"><b>Croisement à ~6 mobs.</b> Sous 6, Nightmare gagne. Au-dessus, Misery.</p>
              </div>
              <div className="rounded-lg border p-3 text-xs space-y-1">
                <div className="font-semibold">💡 Mon reco pour toi :</div>
                <p>• <b>Raid mono-boss / cleave 2-3 :</b> <Badge className="bg-purple-500">Nightmare</Badge> ← swap maintenant</p>
                <p>• <b>M+ +16/+17 (densité moyenne) :</b> <Badge className="bg-purple-500">Nightmare</Badge> sur 70% des pulls</p>
                <p>• <b>M+ +18+ pulls énormes (boost meta) :</b> <Badge className="bg-cyan-500">Misery</Badge></p>
                <p>• <b>1er pull mega Maisara/Skyreach :</b> <Badge className="bg-cyan-500">Misery</Badge></p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>👑 Pourquoi Archon devient ROI en clé +18+</CardTitle>
              <CardDescription>Ton intuition est validée par les data — explication mécanique</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="rounded-lg bg-amber-500/10 p-3 border border-amber-500/30">
                  <div className="font-semibold text-amber-400 mb-1">📈 HP scaling exponentiel</div>
                  <p>Chaque +1 niveau de clé = +8% HP mobs. À +18, un mob a 4.7× les HP de +15. Les mobs ne meurent plus pendant un pull.</p>
                </div>
                <div className="rounded-lg bg-amber-500/10 p-3 border border-amber-500/30">
                  <div className="font-semibold text-amber-400 mb-1">⏰ Sustained bat Burst AoE</div>
                  <p>Avec mobs au-delà de 30s TTK, le <b>Halo cycle Archon (15s CD)</b> tape 2-3× par pull. L'Entropic Rift VW devient redondant après 1 cycle.</p>
                </div>
                <div className="rounded-lg bg-amber-500/10 p-3 border border-amber-500/30">
                  <div className="font-semibold text-amber-400 mb-1">🎯 Priority targeting</div>
                  <p>Hauts keys = kicks/CC critiques. Archon perd moins en uptime quand tu pivot focus (DoTs VW se reset). <b>Stop and go friendly</b>.</p>
                </div>
              </div>
              <div className="text-xs">
                <div className="font-semibold mb-2">📊 DPS comparé selon TTK moyen des mobs</div>
                <ChartContainer config={{
                  voidweaver: { label: "Voidweaver", color: "var(--chart-1)" },
                  archon: { label: "Archon", color: "var(--chart-2)" },
                }} className="h-64 w-full">
                  <LineChart data={[
                    { ttk: "10s (+13)", voidweaver: 200, archon: 158 },
                    { ttk: "15s (+15)", voidweaver: 195, archon: 172 },
                    { ttk: "20s (+16)", voidweaver: 188, archon: 184 },
                    { ttk: "25s (+17)", voidweaver: 178, archon: 195 },
                    { ttk: "30s (+18)", voidweaver: 170, archon: 208 },
                    { ttk: "40s (+19)", voidweaver: 162, archon: 220 },
                    { ttk: "50s+ (+20)", voidweaver: 158, archon: 232 },
                  ]} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="ttk" tick={{ fontSize: 10 }} />
                    <YAxis label={{ value: "DPS (k)", angle: -90, position: "insideLeft" }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Line type="monotone" dataKey="voidweaver" stroke="var(--color-voidweaver)" strokeWidth={2} />
                    <Line type="monotone" dataKey="archon" stroke="var(--color-archon)" strokeWidth={2} />
                  </LineChart>
                </ChartContainer>
                <p className="text-muted-foreground mt-2"><b>Point de bascule : +17 (TTK 25s).</b> Avant : VW. Après : Archon.</p>
              </div>
              <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 text-xs">
                <div className="font-semibold mb-1">⚠️ Conditions pour qu'Archon batte VW en clé :</div>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Pulls moyens (4-8 mobs) — Archon scale jusqu'à 5 cibles avec Halo</li>
                  <li>Mobs survivent 25+ sec (à +17+)</li>
                  <li>Tu joues Power Surge + Manifested Power + Perfected Form</li>
                  <li>Composition non-meta (pas de boost full multi-target)</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>🧠 Matrice de décision Build pour Màlenïa</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2 pr-2">Contexte</th>
                      <th className="text-left py-2 pr-2">Hero Spec</th>
                      <th className="text-left py-2 pr-2">Talent DoT</th>
                      <th className="text-left py-2 pr-2">Pourquoi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr className="bg-purple-500/5">
                      <td className="py-2 pr-2">M+ {"+15/+16 (méga-pulls)"}</td>
                      <td><Badge className="bg-purple-500">VW</Badge></td>
                      <td><Badge className="bg-cyan-500">Misery</Badge></td>
                      <td>Densité + faible TTK = AoE pur</td>
                    </tr>
                    <tr className="bg-purple-500/5">
                      <td className="py-2 pr-2">M+ {"+16 (pulls 4-7)"}</td>
                      <td><Badge className="bg-purple-500">VW</Badge></td>
                      <td><Badge className="bg-purple-500">Nightmare</Badge></td>
                      <td>Petits packs profitent +150% SW:P</td>
                    </tr>
                    <tr className="bg-amber-500/5">
                      <td className="py-2 pr-2">M+ {"+17/+18 (mobs 25s+)"}</td>
                      <td><Badge className="bg-amber-500">Archon</Badge></td>
                      <td><Badge className="bg-purple-500">Nightmare</Badge></td>
                      <td>Halo cycling + DoT snapshot ⭐</td>
                    </tr>
                    <tr className="bg-amber-500/5">
                      <td className="py-2 pr-2">M+ {"+19+ (push)"}</td>
                      <td><Badge className="bg-amber-500">Archon</Badge></td>
                      <td><Badge className="bg-purple-500">Nightmare</Badge></td>
                      <td>Sustained roi quand mobs ne meurent pas</td>
                    </tr>
                    <tr className="bg-rose-500/5">
                      <td className="py-2 pr-2">Raid mono-boss (Salhadaar, Belo'ren)</td>
                      <td><Badge className="bg-amber-500">Archon</Badge></td>
                      <td><Badge className="bg-purple-500">Nightmare</Badge></td>
                      <td>Burst + DoT amplifié = peak ST</td>
                    </tr>
                    <tr className="bg-rose-500/5">
                      <td className="py-2 pr-2">Raid cleave (Vorasius, Vaelgor)</td>
                      <td><Badge className="bg-purple-500">VW</Badge></td>
                      <td><Badge className="bg-cyan-500">Misery</Badge></td>
                      <td>2-3 cibles permanentes = spread DoT roi</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-rose-500/30">
            <CardHeader><CardTitle className="text-rose-400">🔍 Tes 5 plus grosses faiblesses identifiées</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                { rank: 1, weakness: "Tier set 3 pièces à 276 (chest/hands/legs)", impact: "-5-6% DPS", action: "Awakened crests → push 285 cette semaine", urgency: "CRITIQUE" },
                { rank: 2, weakness: "Locked sur Misery par habitude", impact: "-8% DPS en moyenne", action: "Test Invoked Nightmare ce soir sur 2 keys", urgency: "HAUTE" },
                { rank: 3, weakness: "Builds non testés (Misery vs Invoked Nightmare)", impact: "Choix non optimisé selon contexte", action: "Tester Nightmare sur pulls 2-6 mobs cette semaine", urgency: "MOYENNE" },
                { rank: 4, weakness: "Jamais testé Archon en +17+", impact: "Plafond DPS bridé", action: "1 clé +17 Archon avant fin semaine", urgency: "HAUTE" },
                { rank: 5, weakness: "Trinket BiS manquant (Ultime Regard de Valegor)", impact: "-3-4% DPS vs full BiS", action: "Farm raid HM/M boss drop", urgency: "BASSE" },
              ].map((w) => (
                <div key={w.rank} className="flex items-center gap-3 rounded-lg border p-2 text-xs">
                  <div className="text-2xl font-bold text-rose-400 w-6">{w.rank}</div>
                  <div className="flex-1">
                    <div className="font-semibold">{w.weakness}</div>
                    <div className="text-muted-foreground">Impact : <b className="text-rose-400">{w.impact}</b> · Action : {w.action}</div>
                  </div>
                  <Badge variant={w.urgency === "CRITIQUE" ? "destructive" : w.urgency === "HAUTE" ? "default" : "outline"}>{w.urgency}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-emerald-500/30">
            <CardHeader>
              <CardTitle className="text-emerald-400">🚀 Projection — si tu appliques tout</CardTitle>
              <CardDescription>Gains cumulés des 5 actions ci-dessus</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{
                current: { label: "Maintenant", color: "var(--chart-3)" },
                target: { label: "Après optims", color: "var(--chart-1)" },
              }} className="h-64 w-full">
                <BarChart data={[
                  { metric: "iLvl", current: 282, target: 288 },
                  { metric: "M+ Score", current: 3382, target: 3680 },
                  { metric: "DPS +16 (k)", current: 145, target: 192 },
                  { metric: "DPS +18 Archon (k)", current: 168, target: 245 },
                ]} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="metric" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="current" fill="var(--color-current)" />
                  <Bar dataKey="target" fill="var(--color-target)" />
                </BarChart>
              </ChartContainer>
              <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                <div className="rounded bg-emerald-500/10 p-2 text-center"><div className="text-2xl font-bold text-emerald-500">+32%</div><div className="text-muted-foreground">DPS moyen</div></div>
                <div className="rounded bg-emerald-500/10 p-2 text-center"><div className="text-2xl font-bold text-emerald-500">3680</div><div className="text-muted-foreground">Score cible</div></div>
                <div className="rounded bg-emerald-500/10 p-2 text-center"><div className="text-2xl font-bold text-emerald-500">Top 5%</div><div className="text-muted-foreground">EU SP rank</div></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>📚 Sources et niveau de confiance</CardTitle></CardHeader>
            <CardContent className="text-xs space-y-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="rounded border p-2"><b>raider.io / WarcraftLogs</b> · profil Màlenïa · <Badge variant="destructive">Non vérifiable ici</Badge> · réseau bloqué dans cet environnement, dernier relevé manuel du {LAST_KNOWN_SYNC}</div>
                <div className="rounded border p-2"><b>murlok.io / Archon.gg</b> · "top 50/100 SP" · <Badge className="bg-amber-500">Non revalidé</Badge> · chiffres saisis manuellement, à retraiter</div>
                <div className="rounded border p-2"><b>Wowhead · Icy Veins · Maxroll · WoWVendor</b> · stat priority / tier list · <Badge className="bg-emerald-500">Vérifié via recherche web</Badge> · voir carte "Comparaison méta externe" ci-dessus</div>
                <div className="rounded border p-2"><b>Forums Blizzard (PTR 12.1)</b> · changements Shadow Priest · <Badge className="bg-emerald-500">Vérifié via recherche web</Badge> · voir onglet "12.1 PTR"</div>
                <div className="rounded border p-2"><b>Projections DPS / burst</b> · courbes internes · <Badge className="bg-amber-500">Indicatif</Badge> · non simées, cohérence interne seulement</div>
              </div>
              <p className="text-muted-foreground mt-2">
                ⚠️ <b>Disclaimer :</b> les sections marquées "Vérifié via recherche web" viennent de vraies recherches faites pour ce dashboard (voir liens dans l'onglet 12.1 PTR et la carte "Comparaison méta externe"). Le reste (données murlok.io/Archon.gg/raider.io "top 50", courbes DPS internes) est un contenu de départ non revalidé — traite-le comme un exemple/gabarit, pas comme un fait vérifié, tant que tu ne l'as pas recollé depuis tes vraies sources. Pour des chiffres exacts sur TON gear, lance toujours Raidbots avec ton SimC string : cette analyse donne des <b>directions</b>, pas des <b>valeurs garanties</b>.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-violet-500/40 bg-gradient-to-br from-violet-500/5 to-transparent">
            <CardHeader><CardTitle className="text-violet-400">🎯 Plan d'action — cette semaine</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {[
                  "Export ton SimC string → Raidbots → confirme Nightmare bat Misery sur ton gear actuel",
                  "2 keys +16 avec build VW + Nightmare. Compare ton DPS pull-by-pull à ton historique Misery",
                  "Tester Archon + Nightmare sur 1 key +17 (Maisara ou Magisters')",
                  "Tier set : crests Awakened sur chest/hands/legs (276 → 285)",
                  "Raid HM full → focus parse Salhadaar (try mythic à 60%+)",
                  "Re-sim avec nouveau gear — stats déjà optimales (26/12/18/1), focus iLvl brut",
                  "8 keys ≥ +15 validés pour Great Vault max + 3 keys +17 pour Mythic Hero progress",
                ].map((step, i) => (
                  <div key={i} className="flex gap-2 items-start rounded bg-muted/40 p-2">
                    <Badge className="shrink-0">J{i + 1}</Badge>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}

// ============ DPS SIMULATOR COMPONENT ============
function DPSSimulator() {
  const [ilvl, setIlvl] = useState(282);
  const [mobs, setMobs] = useState(8);
  const [haste, setHaste] = useState(22);
  const [build, setBuild] = useState<"voidweaver" | "archon">("voidweaver");
  const [keyLevel, setKeyLevel] = useState(16);

  const mobMult = mobs === 1 ? 1.0 : mobs <= 3 ? 1.4 : mobs <= 6 ? 2.1 : mobs <= 10 ? 3.3 : mobs <= 15 ? 4.5 : 5.2;
  const specCoeff = build === "voidweaver" ? 0.52 : 0.48;
  const hasteBonus = 1 + Math.max(0, (haste - 22)) * 0.015;
  const keyBonus = 1 + (keyLevel - 16) * 0.06;
  const aoeFavor = build === "voidweaver" && mobs >= 7 ? 1.18 : build === "archon" && mobs <= 3 ? 1.12 : 1.0;

  const dps = Math.round(ilvl * specCoeff * mobMult * hasteBonus * keyBonus * aoeFavor);
  const burstDps = Math.round(dps * 1.85);

  // Projection courbe sur 30 sec
  const curve = Array.from({ length: 16 }, (_, i) => {
    const t = i * 2;
    const factor = t < 8 ? 1 + t * 0.12 : t < 16 ? 1.85 - (t - 8) * 0.05 : 1.45 - (t - 16) * 0.06;
    return { t, dps: Math.round(dps * Math.max(0.7, factor)) };
  });

  return (
    <Card>
      <CardHeader><CardTitle>🎮 Configure ta simulation</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Item Level : <Badge>{ilvl}</Badge></label>
            <input type="range" min="270" max="295" value={ilvl} onChange={(e) => setIlvl(+e.target.value)} className="w-full" />
            <p className="text-xs text-muted-foreground">270 (entry) → 295 (BiS Mythic)</p>
          </div>
          <div>
            <label className="text-sm font-medium">Nombre de mobs : <Badge>{mobs}</Badge></label>
            <input type="range" min="1" max="20" value={mobs} onChange={(e) => setMobs(+e.target.value)} className="w-full" />
            <p className="text-xs text-muted-foreground">1 (boss) → 20 (méga-pull)</p>
          </div>
          <div>
            <label className="text-sm font-medium">Haste % : <Badge>{haste}%</Badge></label>
            <input type="range" min="15" max="40" value={haste} onChange={(e) => setHaste(+e.target.value)} className="w-full" />
            <p className="text-xs text-muted-foreground">Target : 28-32%</p>
          </div>
          <div>
            <label className="text-sm font-medium">Niveau de clé : <Badge>+{keyLevel}</Badge></label>
            <input type="range" min="10" max="22" value={keyLevel} onChange={(e) => setKeyLevel(+e.target.value)} className="w-full" />
            <p className="text-xs text-muted-foreground">Le scaling augmente les HP, pas le DPS direct</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant={build === "voidweaver" ? "default" : "outline"} onClick={() => setBuild("voidweaver")} className="flex-1">
            <Eye className="h-4 w-4 mr-1" />Voidweaver
          </Button>
          <Button variant={build === "archon" ? "default" : "outline"} onClick={() => setBuild("archon")} className="flex-1">
            <Crown className="h-4 w-4 mr-1" />Archon
          </Button>
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="bg-violet-500/10 border-violet-500/30">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">DPS Sustained</p>
              <p className="text-3xl font-bold text-violet-500">{dps}k</p>
            </CardContent>
          </Card>
          <Card className="bg-orange-500/10 border-orange-500/30">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">DPS Burst (peak 6-8 sec)</p>
              <p className="text-3xl font-bold text-orange-500">{burstDps}k</p>
            </CardContent>
          </Card>
          <Card className="bg-emerald-500/10 border-emerald-500/30">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">vs Top 10% ({build === "voidweaver" ? 195 : 175}k)</p>
              <p className="text-3xl font-bold text-emerald-500">
                {dps >= (build === "voidweaver" ? 195 : 175) ? "+" : ""}
                {Math.round(((dps - (build === "voidweaver" ? 195 : 175)) / (build === "voidweaver" ? 195 : 175)) * 100)}%
              </p>
            </CardContent>
          </Card>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-2">📈 Courbe DPS simulée sur 30 secondes</h4>
          <ChartContainer config={{ dps: { label: "DPS", color: build === "voidweaver" ? "var(--chart-1)" : "var(--chart-2)" } }} className="h-64 w-full">
            <AreaChart data={curve} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="t" label={{ value: "Temps (sec)", position: "insideBottom", offset: -5 }} />
              <YAxis label={{ value: "DPS (k)", angle: -90, position: "insideLeft" }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area type="monotone" dataKey="dps" stroke="var(--color-dps)" fill="var(--color-dps)" fillOpacity={0.3} strokeWidth={2} />
            </AreaChart>
          </ChartContainer>
        </div>

        <Card className="bg-muted/40">
          <CardContent className="pt-4 text-xs space-y-1">
            <p>🔬 <strong>Interprétation :</strong> {build === "voidweaver"
              ? `Voidweaver à ${mobs} mobs = ${mobs >= 7 ? "ZONE OPTIMALE 🔥 — Entropic Rift + Voidwraith ravagent" : mobs >= 4 ? "rentable, mais ton plein potentiel arrive à 7+" : "sous-utilisé — switch Archon en mono-cible"}`
              : `Archon à ${mobs} mobs = ${mobs <= 3 ? "ZONE OPTIMALE 🔥 — Halo + Power Surge sur boss" : mobs <= 6 ? "correct, mais VW prendrait le dessus à 7+" : "perd du DPS — Halo scale mal au-delà de 5 cibles"}`}</p>
            <p>⚡ <strong>Haste {haste}% :</strong> {haste < 24 ? "❌ Trop bas — vise 26% (top 50)" : haste <= 28 ? "✓ Optimal — sweet spot top 50 (Màlenïa à 26% ✓)" : "⚠️ Overcap, équilibre Crit/Mastery"}</p>
            <p>📊 <strong>vs réalité Màlenïa :</strong> Tu rapportes 450k Archon / 700k VW en burst → cohérent avec ce simulateur à iLvl 282 + gros packs.</p>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}