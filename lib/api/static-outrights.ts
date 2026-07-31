/**
 * Static outright odds — DEPRECATED.
 * All outright odds now come from TheOddsAPI (real live bookmaker data).
 * This file is kept only for backward compatibility with any imports.
 * @deprecated Use lib/api/the-odds-api-outrights.ts instead.
 */

export interface StaticOutright {
  id: string;
  name: string;
  outcomes: { name: string; price: number }[];
}

export const GLOBAL_STATIC_OUTRIGHTS: never[] = [];

const STATIC: Record<number, StaticOutright[]> = {};

export function getStaticOutrights(leagueId: number): StaticOutright[] {
  return STATIC[leagueId] ?? [];
}
