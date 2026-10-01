#!/usr/bin/env node
// ai:check — verifies a project's shared AI base (harness v2). Behaviour is specified in
// harness/check/SPEC.md of agentic-setups; ai-check.ps1 implements the same checks for projects
// without Node, and the parity tests in harness/check/test/ keep the two identical.
// Harness-owned: installed as ai/tools/ai-check.mjs and replaced on upgrade. Project data lives in
// ai/harness.json, never in this file.
//
//   node ai/tools/ai-check.mjs            check
//   node ai/tools/ai-check.mjs --fix      also rewrite the generated blocks
//   node ai/tools/ai-check.mjs --stamp    also fill empty hashes in ai/harness.lock.json
//   --root <dir>                          repo root (default: two levels above this file)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const rootArg = argv.indexOf('--root');
const root = rootArg !== -1 ? path.resolve(argv[rootArg + 1]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fix = flag('fix');
const stamp = flag('stamp');

const problems = [];
const infos = [];
const fixed = [];
const abs = (rel) => path.join(root, rel);
const exists = (rel) => fs.existsSync(abs(rel));
const readRaw = (rel) => fs.readFileSync(abs(rel), 'utf8').replace(/^﻿/, '');
const read = (rel) => readRaw(rel).replace(/\r\n/g, '\n');
const byOrdinal = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const list = (rel, filter) =>
  exists(rel) && fs.statSync(abs(rel)).isDirectory()
    ? fs.readdirSync(abs(rel), { withFileTypes: true }).filter(filter).map((d) => d.name).sort(byOrdinal)
    : [];
const isDir = (d) => d.isDirectory();
const isFile = (d) => d.isFile();

const KNOWN_TOOLS = ['claude-code', 'github-copilot-vscode', 'codex', 'cursor'];
const CONFIG = 'ai/harness.json';
const LOCK = 'ai/harness.lock.json';

// ---------------------------------------------------------------- parsing helpers

function decodeJsonString(quoted) {
  return JSON.parse(quoted);
}

function unquote(value) {
  const v = value.trim();
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) return decodeJsonString(v);
  if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  return v;
}

// Single-line `key: value` YAML frontmatter; that is all harness files use.
function frontmatter(rel) {
  const m = read(rel).match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fields = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) fields[kv[1]] = unquote(kv[2]);
  }
  return fields;
}

// Top-level `key = "value"` TOML strings; that is all the Codex agent stubs use.
function tomlStrings(rel) {
  const fields = {};
  for (const line of read(rel).split('\n')) {
    const kv = line.match(/^([\w-]+)\s*=\s*(".*")\s*$/);
    if (kv) fields[kv[1]] = decodeJsonString(kv[2]);
  }
  return fields;
}

// POSIX path helpers, written out so the PowerShell runner can match them exactly.
function normalize(p) {
  const out = [];
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (out.length && out[out.length - 1] !== '..') out.pop();
      else out.push('..');
    } else out.push(seg);
  }
  return out.join('/');
}
const dirOf = (rel) => (rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '');
const joinRel = (dir, p) => normalize(dir ? `${dir}/${p}` : p);
function relative(fromDir, to) {
  const a = normalize(fromDir).split('/').filter(Boolean);
  const b = normalize(to).split('/').filter(Boolean);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return [...a.slice(i).map(() => '..'), ...b.slice(i)].join('/');
}

// Every path a stub refers to, repo-relative: `ai/...` in backticks, #[[file:...]], @imports and
// relative Markdown links (the last two resolved against the stub's folder).
function references(rel) {
  const text = read(rel);
  const dir = dirOf(rel);
  const refs = new Set();
  for (const m of text.matchAll(/`(ai\/[^`\s]+)`/g)) refs.add(normalize(m[1]));
  for (const m of text.matchAll(/#\[\[file:([^\]\s]+)\]\]/g)) refs.add(normalize(m[1]));
  for (const m of text.matchAll(/^@(\S+)\s*$/gm)) refs.add(joinRel(dir, m[1]));
  for (const m of text.matchAll(/\]\((?![a-z][\w+.-]*:|#|\/)([^)\s#]+)(#[^)\s]*)?\)/gi)) refs.add(joinRel(dir, m[1]));
  return [...refs];
}

function checkPointer(stub, target) {
  const refs = references(stub);
  for (const ref of refs) if (ref.startsWith('ai/') && !exists(ref)) problems.push(`${stub}: points to missing ${ref}`);
  if (!refs.includes(target)) problems.push(`${stub}: does not point to ${target}`);
}

// ---------------------------------------------------------------- config

let config = null;
if (!exists(CONFIG)) problems.push(`${CONFIG}: missing; it declares the tools, Tier 0 files and instructions to check`);
else {
  try {
    config = JSON.parse(read(CONFIG));
  } catch (e) {
    problems.push(`${CONFIG}: not valid JSON`);
  }
}

if (config) {
  if (typeof config.harness_version !== 'string' || !/^\d+\.\d+\.\d+$/.test(config.harness_version))
    problems.push(`${CONFIG}: harness_version must be a version like 2.0.0`);
  if (!Array.isArray(config.tools) || config.tools.length === 0) problems.push(`${CONFIG}: tools must be a non-empty list`);
  for (const t of Array.isArray(config.tools) ? config.tools : [])
    if (!KNOWN_TOOLS.includes(t)) problems.push(`${CONFIG}: unknown tool ${t}`);
  if (!Array.isArray(config.tier0)) problems.push(`${CONFIG}: tier0 must be a list`);
  if (!Array.isArray(config.context_sections)) problems.push(`${CONFIG}: context_sections must be a list`);
  if (config.instructions !== undefined && (typeof config.instructions !== 'object' || Array.isArray(config.instructions) || config.instructions === null))
    problems.push(`${CONFIG}: instructions must be an object of name to glob`);
}

const tools = new Set(Array.isArray(config?.tools) ? config.tools : []);
const tier0Order = Array.isArray(config?.tier0) ? config.tier0 : [];
const contextSections = Array.isArray(config?.context_sections) ? config.context_sections : [];
const declaredInstructions =
  config?.instructions && typeof config.instructions === 'object' && !Array.isArray(config.instructions) ? config.instructions : {};
const limits = { tier0_lines: 300, agents_md_bytes: 32768, ...(config?.limits ?? {}) };

// ---------------------------------------------------------------- AGENTS.md tables

function tableNames(section) {
  if (!exists('ai/AGENTS.md')) return null;
  const text = read('ai/AGENTS.md');
  const start = text.indexOf(`\n## ${section}`);
  if (start === -1) {
    problems.push(`ai/AGENTS.md: no "## ${section}" section`);
    return null;
  }
  const end = text.indexOf('\n## ', start + 1);
  const body = text.slice(start, end === -1 ? undefined : end);
  return [...body.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map((m) => m[1]);
}

function compareTable(section, actual) {
  const listed = tableNames(section);
  if (listed === null) return;
  for (const n of actual) if (!listed.includes(n)) problems.push(`ai/AGENTS.md ${section} table: missing ${n}`);
  for (const n of listed) if (!actual.includes(n)) problems.push(`ai/AGENTS.md ${section} table: lists ${n}, which has no ai/ source`);
  const seen = new Set();
  for (const n of listed) {
    if (seen.has(n)) problems.push(`ai/AGENTS.md ${section} table: lists ${n} more than once`);
    seen.add(n);
  }
}

if (config && !exists('ai/AGENTS.md')) problems.push('ai/AGENTS.md: missing');

// ---------------------------------------------------------------- skills

const skills = list('ai/skills', (d) => isDir(d) && !d.name.startsWith('_') && exists(`ai/skills/${d.name}/SKILL.md`));
const skillDirs = [
  ['claude-code', '.claude/skills'],
  ['github-copilot-vscode', '.github/skills'],
  ['codex', '.agents/skills'],
].filter(([t]) => tools.has(t)).map(([, d]) => d);

for (const name of skills) {
  const source = `ai/skills/${name}/SKILL.md`;
  const src = frontmatter(source);
  if (!src?.name || !src?.description) problems.push(`${source}: frontmatter needs name and description`);
  if (src?.name && src.name !== name) problems.push(`${source}: name "${src.name}" does not match folder ${name}`);
  for (const dir of skillDirs) {
    const stub = `${dir}/${name}/SKILL.md`;
    if (!exists(stub)) {
      problems.push(`${stub}: missing stub for skill ${name}`);
      continue;
    }
    checkPointer(stub, source);
    const fm = frontmatter(stub);
    if (fm?.name !== src?.name) problems.push(`${stub}: name differs from ${source}`);
    if (fm?.description !== src?.description) problems.push(`${stub}: description differs from ${source}`);
  }
}
for (const dir of skillDirs)
  for (const name of list(dir, isDir))
    if (!skills.includes(name)) problems.push(`${dir}/${name}: stub for a skill with no ai/skills/${name}/SKILL.md`);
if (config) compareTable('Skills', skills);

// ---------------------------------------------------------------- agents

// Agent bodies have no frontmatter; descriptions are compared across stubs.
const agents = list('ai/agents', (d) => isFile(d) && d.name.endsWith('.md')).map((f) => f.slice(0, -3));
const agentStubs = [
  { tool: 'claude-code', dir: '.claude/agents', suffix: '.md', parse: frontmatter },
  { tool: 'github-copilot-vscode', dir: '.github/agents', suffix: '.agent.md', parse: frontmatter },
  { tool: 'codex', dir: '.codex/agents', suffix: '.toml', parse: tomlStrings },
].filter((s) => tools.has(s.tool));

for (const name of agents) {
  const source = `ai/agents/${name}.md`;
  let reference;
  for (const { dir, suffix, parse } of agentStubs) {
    const stub = `${dir}/${name}${suffix}`;
    if (!exists(stub)) {
      problems.push(`${stub}: missing stub for agent ${name}`);
      continue;
    }
    checkPointer(stub, source);
    const fields = parse(stub) ?? {};
    if (fields.name !== name) problems.push(`${stub}: name "${fields.name ?? ''}" does not match ${name}`);
    if (!fields.description) problems.push(`${stub}: no description`);
    else if (reference === undefined) reference = { stub, description: fields.description };
    else if (fields.description !== reference.description) problems.push(`${stub}: description differs from ${reference.stub}`);
  }
}
for (const { dir, suffix } of agentStubs)
  for (const f of list(dir, (d) => isFile(d) && d.name.endsWith(suffix))) {
    const name = f.slice(0, -suffix.length);
    if (!agents.includes(name)) problems.push(`${dir}/${f}: stub for an agent with no ai/agents/${name}.md`);
  }
if (config) compareTable('Agents', agents);

// ---------------------------------------------------------------- instructions

const instructions = list('ai/instructions', (d) => isFile(d) && d.name.endsWith('.md')).map((f) => f.slice(0, -3));
const declared = Object.keys(declaredInstructions);
for (const n of instructions)
  if (!declared.includes(n)) problems.push(`ai/instructions/${n}.md: not declared in ${CONFIG} instructions`);
for (const n of declared)
  if (!instructions.includes(n)) problems.push(`${CONFIG}: instruction ${n} has no ai/instructions/${n}.md`);
const alwaysInstructions = declared.filter((n) => declaredInstructions[n] === '**' && instructions.includes(n));

function expectField(stub, fields, key, want) {
  const got = fields?.[key];
  if (want === undefined) {
    if (got !== undefined) problems.push(`${stub}: ${key} must be absent for an always-on instruction`);
  } else if (got !== want) problems.push(`${stub}: ${key} is "${got ?? ''}", expected "${want}"`);
}

for (const name of declared.filter((n) => instructions.includes(n))) {
  const glob = declaredInstructions[name];
  if (typeof glob !== 'string' || glob === '') {
    problems.push(`${CONFIG}: instruction ${name} needs a glob ("**" for always-on)`);
    continue;
  }
  const source = `ai/instructions/${name}.md`;
  const always = glob === '**';
  const stubs = [];
  if (tools.has('claude-code')) stubs.push({ stub: `.claude/rules/${name}.md`, check: (s, fm) => expectField(s, fm, 'paths', always ? undefined : glob) });
  if (tools.has('github-copilot-vscode')) stubs.push({ stub: `.github/instructions/${name}.instructions.md`, check: (s, fm) => expectField(s, fm, 'applyTo', glob) });
  if (tools.has('cursor') && !always)
    stubs.push({
      stub: `.cursor/rules/${name}.mdc`,
      check: (s, fm) => {
        expectField(s, fm, 'globs', glob);
        expectField(s, fm, 'alwaysApply', 'false');
      },
    });
  const dirMatch = glob.match(/^([^*?[\]{}!]+)\/\*\*$/);
  if (tools.has('codex') && dirMatch) stubs.push({ stub: `${dirMatch[1]}/AGENTS.md`, check: () => {} });
  for (const { stub, check } of stubs) {
    if (!exists(stub)) {
      problems.push(`${stub}: missing stub for instruction ${name}`);
      continue;
    }
    checkPointer(stub, source);
    check(stub, frontmatter(stub) ?? {});
  }
}
if (config) compareTable('Instructions', instructions);

// ---------------------------------------------------------------- Tier 0

const TIER0_DIR = 'ai/architecture';
const tier0Present = list(TIER0_DIR, (d) => isFile(d) && d.name.endsWith('.md')).map((f) => f.slice(0, -3));
for (const n of tier0Present) if (!tier0Order.includes(n)) problems.push(`${TIER0_DIR}/${n}.md: not listed in ${CONFIG} tier0`);
for (const n of tier0Order) if (!tier0Present.includes(n)) problems.push(`${TIER0_DIR}/${n}.md: listed in ${CONFIG} tier0 but missing`);
const tier0Files = tier0Order.filter((n) => tier0Present.includes(n)).map((n) => `${TIER0_DIR}/${n}.md`);
const tier0Lines = tier0Files.reduce((sum, f) => sum + read(f).trimEnd().split('\n').length, 0);
if (tier0Lines > limits.tier0_lines)
  problems.push(`${TIER0_DIR}: ${tier0Lines} lines, over the Tier 0 budget of ${limits.tier0_lines} (limits.tier0_lines in ${CONFIG})`);

// Claude Code loads Tier 0 through @imports in ai/AGENTS.md; the other tools get the tier0 block.
if (tools.has('claude-code') && exists('ai/AGENTS.md')) {
  const file = 'ai/AGENTS.md';
  const form = (n) => `@architecture/${n}.md`;
  const refs = [...read(file).matchAll(/^@architecture\/([\w-]+)\.md\s*$/gm)].map((m) => m[1]);
  for (const n of [...new Set([...tier0Order, ...tier0Present])]) if (!refs.includes(n)) problems.push(`${file}: does not reference ${form(n)}`);
  for (const n of refs) if (!tier0Order.includes(n)) problems.push(`${file}: references ${form(n)}, which is not a Tier 0 file`);
}

// ---------------------------------------------------------------- entry files

if (tools.has('claude-code')) {
  if (!exists('CLAUDE.md')) problems.push('CLAUDE.md: missing (Claude Code entry file)');
  else checkPointer('CLAUDE.md', 'ai/AGENTS.md');
}

// ---------------------------------------------------------------- generated blocks

const isFence = (line) => /^\s*(```|~~~)/.test(line);

function rebaseLinks(line, rel, targetDir) {
  return line.replace(/\]\((?![a-z][\w+.-]*:|#|\/)([^)\s]+)\)/gi, (_, link) => {
    const hashAt = link.indexOf('#');
    const target = hashAt === -1 ? link : link.slice(0, hashAt);
    const hash = hashAt === -1 ? '' : link.slice(hashAt);
    return `](${relative(targetDir, joinRel(dirOf(rel), target))}${hash})`;
  });
}

// One file under its own `##` heading; its headings shift down a level outside code fences.
function renderFile(rel, targetDir) {
  let fence = false;
  return read(rel)
    .trimEnd()
    .split('\n')
    .map((line, i) => {
      const f = isFence(line);
      if (f) fence = !fence;
      if (fence || f) return line;
      if (i === 0 && /^# /.test(line)) line = `## ${line.slice(2)} (\`${rel}\`)`;
      else if (/^#{1,5} /.test(line)) line = `#${line}`;
      return rebaseLinks(line, rel, targetDir);
    })
    .join('\n');
}

// The context_sections of ai/AGENTS.md in source order, headings unchanged.
function renderContext(targetDir) {
  const rel = 'ai/AGENTS.md';
  if (!exists(rel)) return [];
  const sections = [];
  let fence = false;
  let current = null;
  for (const line of read(rel).split('\n')) {
    const f = isFence(line);
    if (f) fence = !fence;
    const heading = !fence && !f ? line.match(/^## (.+)$/) : null;
    if (heading) {
      const name = heading[1].split(' (')[0].trim();
      current = contextSections.includes(name) ? { name, lines: [] } : null;
      if (current) sections.push(current);
    }
    if (current) current.lines.push(fence || f ? line : rebaseLinks(line, rel, targetDir));
  }
  for (const n of contextSections) {
    const count = sections.filter((s) => s.name === n).length;
    if (count === 0) problems.push(`${rel}: no "## ${n}" section for the context block`);
    if (count > 1) problems.push(`${rel}: more than one "## ${n}" section`);
  }
  return sections.map((s) => s.lines.join('\n').trimEnd());
}

const BLOCKS = {
  context: { source: 'ai/AGENTS.md', render: renderContext },
  always: { source: 'ai/instructions', render: (dir) => alwaysInstructions.map((n) => renderFile(`ai/instructions/${n}.md`, dir)) },
  tier0: { source: 'ai/architecture', render: (dir) => tier0Files.map((f) => renderFile(f, dir)) },
};
const beginMarker = (name) => `<!-- ${name}:begin (generated from ${BLOCKS[name].source} by ai:check --fix; do not edit) -->`;
const endMarker = (name) => `<!-- ${name}:end -->`;

// A missing block goes before the next block that is present, or at the end, so the order holds.
function syncBlocks(copy, names) {
  const raw = readRaw(copy);
  let text = raw.replace(/\r\n/g, '\n');
  const stale = [];
  for (const [i, name] of names.entries()) {
    const parts = BLOCKS[name].render(dirOf(copy));
    const block = [beginMarker(name), '', ...parts.flatMap((part) => [part, '']), endMarker(name)].join('\n');
    const begin = text.indexOf(`<!-- ${name}:begin`);
    const end = text.indexOf(endMarker(name));
    let next;
    if (begin === -1 && end === -1) {
      const later = names
        .slice(i + 1)
        .map((b) => text.indexOf(`<!-- ${b}:begin`))
        .find((at) => at !== -1);
      next = later === undefined ? `${text.trimEnd()}\n\n${block}\n` : `${text.slice(0, later)}${block}\n\n${text.slice(later)}`;
    } else if (begin === -1 || end < begin) {
      problems.push(`${copy}: malformed ${name} block markers; fix them by hand`);
      continue;
    } else next = text.slice(0, begin) + block + text.slice(end + endMarker(name).length);
    if (next === text) continue;
    stale.push(`${name} block ${begin === -1 ? 'missing' : 'out of date'}`);
    text = next;
  }
  if (!stale.length) return;
  if (fix) {
    fs.writeFileSync(abs(copy), raw.includes('\r\n') ? text.replace(/\n/g, '\r\n') : text);
    fixed.push(`${copy} (${stale.join(', ')})`);
  } else for (const s of stale) problems.push(`${copy}: ${s}; run ai:check --fix`);
}

if (config) {
  const copies = [['AGENTS.md', ['context', 'always', 'tier0']]];
  if (tools.has('github-copilot-vscode')) copies.push(['.github/copilot-instructions.md', ['context', 'tier0']]);
  for (const [copy, names] of copies) {
    if (!exists(copy)) problems.push(`${copy}: missing (it carries the generated blocks)`);
    else syncBlocks(copy, names);
  }
  // Codex stops reading AGENTS.md past project_doc_max_bytes (default 32 KiB), without a warning.
  if (tools.has('codex') && exists('AGENTS.md')) {
    const bytes = Buffer.byteLength(readRaw('AGENTS.md'), 'utf8');
    if (bytes > limits.agents_md_bytes) problems.push(`AGENTS.md: ${bytes} bytes, over ${limits.agents_md_bytes}; Codex stops reading there`);
  }
}

// ---------------------------------------------------------------- lock

// Hash of LF-normalised UTF-8 content, so line-ending conversion by git doesn't count as a change.
const hashOf = (rel) => crypto.createHash('sha256').update(read(rel), 'utf8').digest('hex');

// JSON.stringify(value, null, 2) semantics, written out so ai-check.ps1 can match it byte for byte.
function toJson(value, indent = '') {
  const inner = `${indent}  `;
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return value.length ? `[\n${value.map((v) => inner + toJson(v, inner)).join(',\n')}\n${indent}]` : '[]';
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    return keys.length ? `{\n${keys.map((k) => `${inner}${JSON.stringify(k)}: ${toJson(value[k], inner)}`).join(',\n')}\n${indent}}` : '{}';
  }
  return JSON.stringify(value);
}

if (exists(LOCK)) {
  let lock = null;
  try {
    lock = JSON.parse(read(LOCK));
  } catch {
    problems.push(`${LOCK}: not valid JSON`);
  }
  const files = lock?.files && typeof lock.files === 'object' ? lock.files : null;
  if (lock && !files) problems.push(`${LOCK}: needs a files object`);
  let stamped = 0;
  for (const [rel, entry] of Object.entries(files ?? {})) {
    if (!['harness', 'catalog', 'generated', 'project'].includes(entry?.owner)) {
      problems.push(`${LOCK}: ${rel} has owner "${entry?.owner ?? ''}"; expected harness, catalog, generated or project`);
      continue;
    }
    if (!exists(rel)) {
      infos.push(`${rel}: in ${LOCK} but deleted in this project`);
      continue;
    }
    if (entry.hash === null || entry.hash === undefined || entry.hash === '') {
      if (stamp) {
        entry.hash = hashOf(rel);
        stamped++;
      } else if (entry.owner === 'harness' || entry.owner === 'catalog') infos.push(`${rel}: no hash in ${LOCK}; run ai:check --stamp after installing`);
    } else if ((entry.owner === 'harness' || entry.owner === 'catalog') && entry.hash !== hashOf(rel))
      infos.push(`${rel}: changed locally since install (${entry.owner}-owned; an upgrade will merge, not overwrite)`);
  }
  if (stamped) {
    fs.writeFileSync(abs(LOCK), `${toJson(lock)}\n`);
    fixed.push(`${LOCK} (${stamped} hash${stamped === 1 ? '' : 'es'} stamped)`);
  }
}

// ---------------------------------------------------------------- report

// A problem found twice (e.g. once per generated copy) is reported once.
const unique = [...new Set(problems)];
for (const f of fixed) console.log(`ai:check --fix: rewrote ${f}`);
for (const i of infos) console.log(`ai:check info: ${i}`);
if (unique.length) {
  console.error(`ai:check found ${unique.length} problem(s):`);
  for (const p of unique) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(
  `ai:check passed (harness ${config.harness_version}): ${skills.length} skills, ${agents.length} agents, ${instructions.length} instructions, ${tier0Files.length} Tier 0 files (${tier0Lines} lines); stubs, tables and generated blocks in sync.`,
);
