#!/usr/bin/env node
// KATA · build: inlines src/ + data/ into ONE self-contained index.html.
// Usage: node build.mjs [--out <path>]
// - CSS  = src/css/*.css concatenated in filename order  → one <style>
// - JS   = src/js/*.js  concatenated in filename order  → one classic <script>
// - DATA = data/research-data.json, validated, minified, every "<" written as <
// - CSP  = sha256 hashes of the exact inline <script> and <style> contents
// Exits non-zero on any error (invalid JSON, JS syntax error, forbidden pattern…).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'src');
const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const OUT = outIdx >= 0 && args[outIdx + 1] ? path.resolve(args[outIdx + 1]) : path.join(ROOT, 'index.html');

const errors = [];
const warnings = [];
const read = p => fs.readFileSync(p, 'utf8');
const listDir = (dir, ext) => fs.readdirSync(dir).filter(f => f.endsWith(ext) && !f.startsWith('.')).sort();
const kb = n => (n / 1024).toFixed(1) + ' KB';
const sha = s => "'sha256-" + crypto.createHash('sha256').update(s, 'utf8').digest('base64') + "'";

function fail(msg) { errors.push(msg); }

// ---------- sources ----------
let template, icons, cssFiles, jsFiles, css = '', js = '', dataRaw, data;
try {
  template = read(path.join(SRC, 'template.html'));
  icons = read(path.join(SRC, 'icons.svg')).trim();
  cssFiles = listDir(path.join(SRC, 'css'), '.css');
  jsFiles = listDir(path.join(SRC, 'js'), '.js');
} catch (e) { console.error('build: lecture impossible · ' + e.message); process.exit(1); }

const NUM = /^\d\d-[a-z0-9-]+\.(css|js)$/;
for (const f of [...cssFiles, ...jsFiles]) if (!NUM.test(f)) fail(`nom de fichier hors convention NN-nom.ext : ${f}`);

for (const f of cssFiles) css += `/* ${f} */\n` + read(path.join(SRC, 'css', f)).trim() + '\n';
for (const f of jsFiles) js += `/* ==== ${f} ==== */\n` + read(path.join(SRC, 'js', f)).trim() + '\n';

// ---------- research JSON ----------
try {
  dataRaw = read(path.join(ROOT, 'data', 'research-data.json'));
  data = JSON.parse(dataRaw);
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('research-data.json : la racine doit être un objet');
  else if (!data.meta || typeof data.meta !== 'object') fail('research-data.json : clé "meta" absente');
} catch (e) { fail('research-data.json invalide · ' + e.message); }
const json = data ? JSON.stringify(data).replace(/</g, '\\u003c') : '';

// ---------- assets ----------
let touchIcon = '', favicon = '';
try {
  touchIcon = fs.readFileSync(path.join(SRC, 'assets', 'apple-touch-icon.png')).toString('base64');
  favicon = Buffer.from(read(path.join(SRC, 'assets', 'favicon.svg')).trim(), 'utf8').toString('base64');
} catch (e) { fail('icônes absentes · ' + e.message); }

// ---------- checks on hand-written code (research JSON excluded) ----------
try { new vm.Script(js, { filename: 'kata.js' }); } catch (e) { fail('JS : erreur de syntaxe · ' + e.message + (e.stack ? '\n' + e.stack.split('\n').slice(0, 3).join('\n') : '')); }
if (/<\/script/i.test(js)) fail('JS : contient "</script"');
if (/<\/style/i.test(css)) fail('CSS : contient "</style"');

const handWritten = [
  ['template.html', template], ['icons.svg', icons],
  ...cssFiles.map(f => ['css/' + f, read(path.join(SRC, 'css', f))]),
  ...jsFiles.map(f => ['js/' + f, read(path.join(SRC, 'js', f))]),
];
const RULES = [
  [/\balert\s*\(|\bconfirm\s*\(|\bprompt\s*\(|\beval\s*\(|new\s+Function\b|document\.write/, 'appel interdit (alert/confirm/prompt/eval/new Function/document.write)'],
  [/\son[a-z]+=["'`]/, 'gestionnaire inline on*= interdit'],
  [/Màlenïa|Malenia|Voidweaver|Archon|Shadow Priest|Prêtre/, 'hygiène : nom interdit (ancien projet)'],
  [/[\u{2600}-\u{27BF}\u{1F000}-\u{1FAFF}\u{FE0F}]/u, 'emoji / dingbat interdit'],
  [/<img\b|<link[^>]+stylesheet|@import|url\(\s*["']?https?:/i, 'ressource externe interdite'],
  [/\sstyle\s*=\s*["']/i, 'attribut style="" interdit (CSP : utiliser KATA.vars / classes)'],
  [/insertAdjacentHTML|outerHTML\s*=|\.innerHTML\s*\+=/, 'injection HTML hors KATA.setHTML'],
];
for (const [name, text] of handWritten) {
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    for (const [re, msg] of RULES) if (re.test(line)) fail(`${name}:${i + 1} ${msg}\n    ${line.trim().slice(0, 140)}`);
    if (/\.innerHTML\s*=/.test(line) && name !== 'js/10-dom.js') fail(`${name}:${i + 1} innerHTML interdit hors 10-dom.js (utiliser KATA.setHTML)`);
    const urls = line.match(/https?:\/\/[^\s"'`)<>]+/g) || [];
    for (const u of urls) if (!u.startsWith('https://raider.io')) fail(`${name}:${i + 1} URL non autorisée : ${u}`);
  });
}
// icons referenced from JS must exist in the sprite
const have = new Set([...icons.matchAll(/id="i-([a-z0-9-]+)"/g)].map(m => m[1]));
for (const m of js.matchAll(/\bicon\(\s*'([a-z0-9-]+)'/g)) if (!have.has(m[1])) warnings.push(`icône inconnue dans le sprite : ${m[1]}`);
// emoji check on the research JSON too (whole-file rule of the spec)
if (/[\u{2600}-\u{27BF}\u{1F000}-\u{1FAFF}\u{FE0F}]/u.test(json)) fail('research-data.json contient un emoji / dingbat');

for (const m of ['<!--INLINE:CSS-->', '<!--INLINE:DATA-->', '<!--INLINE:JS-->', '<!--INLINE:ICONS-->', '%%CSP%%', '%%TOUCH_ICON%%', '%%FAVICON%%']) {
  if (!template.includes(m)) fail('template.html : marqueur absent ' + m);
}
const navCount = (template.match(/data-nav="/g) || []).length;
if (navCount !== 5) fail(`template.html : ${navCount} data-nav au lieu de 5`);

if (errors.length) {
  console.error('build: ÉCHEC\n- ' + errors.join('\n- '));
  process.exit(1);
}

// ---------- minify (esbuild if resolvable, else conservative strip) ----------
// Sources keep their API-doc comments; the shipped file does not need them.
// Note for authors: leading indentation inside multi-line template literals may be removed.
const srcJsB = Buffer.byteLength(js), srcCssB = Buffer.byteLength(css);
let minifier = 'aucun (--no-minify)';
if (!args.includes('--no-minify')) {
  let esb = null;
  try { esb = await import('esbuild'); } catch (e) { esb = null; }
  if (esb && esb.transform) {
    try {
      js = (await esb.transform(js, { loader: 'js', minify: true, target: 'es2020', charset: 'utf8', legalComments: 'none' })).code.trim();
      css = (await esb.transform(css, { loader: 'css', minify: true, target: ['safari15', 'chrome100'], charset: 'utf8', legalComments: 'none' })).code.trim();
      minifier = 'esbuild ' + (esb.version || '');
    } catch (e) { console.error('build: ÉCHEC\n- minification esbuild · ' + e.message); process.exit(1); }
  } else {
    const strip = s => s.replace(/(^|\n)[ \t]*\/\*[\s\S]*?\*\/[ \t]*(?=\n|$)/g, '$1').split('\n')
      .filter(l => !/^\s*\/\//.test(l)).map(l => l.trim()).filter(Boolean).join('\n');
    js = strip(js); css = strip(css);
    minifier = 'léger (commentaires + indentation ; esbuild introuvable)';
  }
  try { new vm.Script(js, { filename: 'kata.min.js' }); } catch (e) { console.error('build: ÉCHEC\n- JS minifié invalide · ' + e.message); process.exit(1); }
  if (!/var KATA\b|KATA=/.test(js)) { console.error('build: ÉCHEC\n- le namespace KATA a disparu après minification'); process.exit(1); }
  if (/<\/script/i.test(js) || /<\/style/i.test(css)) { console.error('build: ÉCHEC\n- "</script" ou "</style" après minification'); process.exit(1); }
}

// ---------- assemble ----------
const csp = [
  "default-src 'none'",
  'script-src ' + sha(js),
  'style-src ' + sha(css),
  'img-src data:',
  'connect-src https://raider.io',
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const html = template
  .replace('%%CSP%%', () => csp.replace(/'/g, '&#39;'))   // meta content is single-quoted (keeps the spec grep on[a-z]+=" at 0)
  .replace('%%TOUCH_ICON%%', () => touchIcon)
  .replace('%%FAVICON%%', () => favicon)
  .replace('<!--INLINE:CSS-->', () => `<style>${css}</style>`)
  .replace('<!--INLINE:DATA-->', () => `<script type="application/json" id="kata-research">${json}</script>`)
  .replace('<!--INLINE:ICONS-->', () => icons)
  .replace('<!--INLINE:JS-->', () => `<script>${js}</script>`);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);

const total = Buffer.byteLength(html), jsB = Buffer.byteLength(js), cssB = Buffer.byteLength(css), jsonB = Buffer.byteLength(json);
const BUDGET = { total: 320 * 1024, js: 100 * 1024, css: 30 * 1024 };   // spec §9.6 (brut, recherche non comptée pour JS/CSS)
if (total > BUDGET.total) warnings.push(`index.html dépasse 320 KB (${kb(total)})`);
if (jsB > BUDGET.js) warnings.push(`JS dépasse 100 KB (${kb(jsB)})`);
if (cssB > BUDGET.css) warnings.push(`CSS dépasse 30 KB (${kb(cssB)})`);

console.log(`build: OK → ${path.relative(process.cwd(), OUT) || OUT}`);
console.log(`  total ${kb(total)} · JS ${kb(jsB)} (source ${kb(srcJsB)}, ${jsFiles.length} fichiers) · CSS ${kb(cssB)} (source ${kb(srcCssB)}, ${cssFiles.length} fichiers) · recherche ${kb(jsonB)} · sprite ${kb(Buffer.byteLength(icons))}`);
console.log(`  minification : ${minifier} · transfert gzip ≈ ${kb(zlib.gzipSync(html, { level: 9 }).length)} (GitHub Pages compresse)`);
for (const w of warnings) console.warn('  attention : ' + w);
