import fs from 'fs';
import path from 'path';
import { SUPPORTED_BOOKMAKERS } from './jackpot-types';
export type { JackpotStatus, Prediction, Bookmaker, JackpotGame, Jackpot } from './jackpot-types';
export { SUPPORTED_BOOKMAKERS } from './jackpot-types';
import type { Jackpot } from './jackpot-types';

export function getBookmaker(slug: string) { return SUPPORTED_BOOKMAKERS.find(b => b.slug === slug); }

const STATE_FILE = path.join(process.cwd(), '.local', 'state', 'jackpots.json');
interface JackpotState { jackpots: Jackpot[]; }
const g = globalThis as { __jackpotState?: JackpotState };

function ensureDir(p: string) { try { fs.mkdirSync(path.dirname(p), { recursive: true }); } catch {} }

function loadState(): JackpotState {
  if (g.__jackpotState) return g.__jackpotState;
  try { if (fs.existsSync(STATE_FILE)) { const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as JackpotState; g.__jackpotState = raw; return raw; } } catch (e) { console.warn('[jackpot-store] load failed', e); }
  g.__jackpotState = { jackpots: [] }; return g.__jackpotState;
}

function saveState() { try { ensureDir(STATE_FILE); fs.writeFileSync(STATE_FILE, JSON.stringify(g.__jackpotState!, null, 2)); } catch (e) { console.warn('[jackpot-store] persist failed', e); } }

export function getJackpots(): Jackpot[] { return loadState().jackpots; }
export function getJackpotById(id: string): Jackpot | undefined { return loadState().jackpots.find(j => j.id === id); }

export function getActiveJackpots(bookmakerSlug?: string): Jackpot[] {
  const all = loadState().jackpots.filter(j => j.status === 'active');
  return bookmakerSlug ? all.filter(j => j.bookmakerSlug === bookmakerSlug) : all;
}

export function getActiveJackpotsByBookmaker(): Record<string, Jackpot[]> {
  const active = loadState().jackpots.filter(j => j.status === 'active');
  const grouped: Record<string, Jackpot[]> = {};
  for (const jackpot of active) { if (!grouped[jackpot.bookmakerSlug]) grouped[jackpot.bookmakerSlug] = []; grouped[jackpot.bookmakerSlug].push(jackpot); }
  return grouped;
}

export function createJackpot(input: Omit<Jackpot, 'id' | 'createdAt' | 'updatedAt'>): Jackpot {
  const state = loadState();
  const bookmaker = getBookmaker(input.bookmakerSlug);
  const jackpot: Jackpot = { ...input, bookmakerName: input.bookmakerName || bookmaker?.name || input.bookmakerSlug, id: 'jackpot-' + Date.now(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  state.jackpots.unshift(jackpot); saveState(); return jackpot;
}

export function updateJackpot(id: string, patch: Partial<Jackpot>): Jackpot | null {
  const state = loadState();
  const idx = state.jackpots.findIndex(j => j.id === id);
  if (idx < 0) return null;
  state.jackpots[idx] = { ...state.jackpots[idx], ...patch, id, updatedAt: new Date().toISOString() };
  saveState(); return state.jackpots[idx];
}

export function deleteJackpot(id: string): boolean {
  const state = loadState();
  const before = state.jackpots.length;
  state.jackpots = state.jackpots.filter(j => j.id !== id);
  if (state.jackpots.length === before) return false;
  saveState(); return true;
}
