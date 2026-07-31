// Build a tracked outbound bookmaker URL. The destination is the tracker
// endpoint that records the click context, then redirects to the bookmaker's
// affiliate URL. See app/api/r/bookmaker/[slug]/route.ts.
export interface ClickContext {
  placement?: 'odds-table' | 'sidebar' | 'bookmakers-page' | 'match-tip' | 'home-strip' | string;
  sport?: string;
  league?: string;
  matchId?: string | number;
  match?: string;
  market?: string;
  selection?: string;
  /** Optional native deeplink (e.g. SGO event link) — passed through. */
  to?: string;
}

export function trackedBookmakerUrl(slug: string, ctx: ClickContext = {}): string {
  if (!slug) return '#';
  const qs = new URLSearchParams();
  if (ctx.placement) qs.set('placement', ctx.placement);
  if (ctx.sport) qs.set('sport', String(ctx.sport));
  if (ctx.league) qs.set('league', String(ctx.league));
  if (ctx.matchId !== undefined && ctx.matchId !== null) qs.set('matchId', String(ctx.matchId));
  if (ctx.match) qs.set('match', ctx.match);
  if (ctx.market) qs.set('market', ctx.market);
  if (ctx.selection) qs.set('selection', ctx.selection);
  if (ctx.to) qs.set('to', ctx.to);
  const q = qs.toString();
  return `/api/r/bookmaker/${encodeURIComponent(slug)}${q ? `?${q}` : ''}`;
}
