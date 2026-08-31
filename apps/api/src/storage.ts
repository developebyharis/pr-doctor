import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { PRRecord, RiskLevel } from './models.js';
import type { Settings } from './settings.js';

interface Doc {
  repo: string;
  id: number;
  record: PRRecord;
}

function loadFile(settings: Settings): Doc[] {
  if (!existsSync(settings.db_path)) return [];
  try {
    const raw = readFileSync(settings.db_path, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveFile(settings: Settings, docs: Doc[]): void {
  mkdirSync(dirname(settings.db_path), { recursive: true });
  writeFileSync(settings.db_path, JSON.stringify(docs, null, 2), 'utf-8');
}

export function upsertPr(record: PRRecord, settings: Settings): void {
  const docs = loadFile(settings);
  const idx = docs.findIndex((d) => d.repo === record.repo && d.id === record.id);
  const doc: Doc = { repo: record.repo, id: record.id, record };
  if (idx >= 0) docs[idx] = doc;
  else docs.push(doc);
  saveFile(settings, docs);
}

export function getPr(prNumber: number, repo: string, settings: Settings): PRRecord | null {
  const docs = loadFile(settings);
  const found = docs.find((d) => d.repo === repo && d.id === prNumber);
  return found ? found.record : null;
}

export function listPrs(settings: Settings, riskFilter?: RiskLevel | string): PRRecord[] {
  const docs = loadFile(settings);
  if (riskFilter) {
    return docs
      .filter((d) => d.record.overall_risk === riskFilter)
      .map((d) => d.record);
  }
  return docs.map((d) => d.record);
}

export function deletePr(prNumber: number, repo: string, settings: Settings): boolean {
  const docs = loadFile(settings);
  const before = docs.length;
  const next = docs.filter((d) => !(d.repo === repo && d.id === prNumber));
  if (next.length === before) return false;
  saveFile(settings, next);
  return true;
}
