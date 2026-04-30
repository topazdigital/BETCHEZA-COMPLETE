// Centralised slug helpers for SEO-friendly URLs.
//
// We use the shape `<name-slug>-<numericId>` for both teams and players,
// e.g. `paris-saint-germain-160` or `kylian-mbappe-323850`.
// The numeric id is the canonical ESPN id and is what the API endpoints
// actually need to talk to ESPN. The slug is purely cosmetic (good for SEO
// and user-shareable URLs) and is ignored when parsing.
//
// We also keep backwards compatibility with the older internal id shapes
// `espn_<league>_<eventOrTeamId>` (matches/teams) and bare numeric ids
// (players from the ESPN /athletes endpoint).

export function slugify(input: string | undefined | null): string {
  if (!input) return '';
  return String(input)
    .toLowerCase()
    .normalize('NFKD')
    // Strip combining diacritics that NFKD splits off (e.g. "é" → "e").
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    // Anything that isn't a letter, digit, space or dash → space.
    .replace(/[^a-z0-9\s-]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------- Teams ----------

// Build the SEO URL for a team page.
// `id` may be the bare ESPN team id (e.g. "160") OR the legacy
// `espn_<league>_<id>` shape — both work.
export function teamHref(name: string | undefined | null, id: string | number | undefined | null): string {
  if (id === undefined || id === null || id === '') return '#';
  const numeric = extractNumericTeamId(String(id));
  const slug = slugify(name);
  if (!numeric) {
    // Fall back to whatever id we have so links still work for legacy data.
    return `/teams/${encodeURIComponent(String(id))}`;
  }
  return slug ? `/teams/${slug}-${numeric}` : `/teams/${numeric}`;
}

// Pull the bare ESPN team id out of any of:
//  • "160"
//  • "espn_eng.1_160"
//  • "paris-saint-germain-160"
//  • "160-paris-saint-germain"
export function extractNumericTeamId(raw: string): string | null {
  if (!raw) return null;
  const s = String(raw);
  if (/^\d+$/.test(s)) return s;
  // espn_<league>_<id>
  const espn = s.match(/^espn_[a-z0-9.]+_(\d+)$/i);
  if (espn) return espn[1];
  // <slug>-<id>
  const tail = s.match(/-(\d{2,})$/);
  if (tail) return tail[1];
  // <id>-<slug>
  const head = s.match(/^(\d{2,})-/);
  if (head) return head[1];
  return null;
}

// ---------- Players ----------

export function playerHref(name: string | undefined | null, id: string | number | undefined | null): string {
  if (id === undefined || id === null || id === '') return '#';
  const numeric = extractNumericPlayerId(String(id));
  const slug = slugify(name);
  if (!numeric) {
    return `/players/${encodeURIComponent(String(id))}`;
  }
  return slug ? `/players/${slug}-${numeric}` : `/players/${numeric}`;
}

// ---------- Tipsters ----------

// Build the SEO URL for a tipster profile.
// Prefer username (already URL-friendly) then fall back to slugifying display name + id.
// The /api/tipsters/[id] endpoint accepts both numeric id AND username, so this is safe.
export function tipsterHref(
  displayNameOrUsername: string | undefined | null,
  usernameOrId: string | number | undefined | null,
): string {
  // If caller passed a username string with no display name, use it directly.
  const fallback = usernameOrId == null ? '' : String(usernameOrId);
  if (!displayNameOrUsername && fallback) {
    return `/tipsters/${encodeURIComponent(fallback)}`;
  }
  const candidate = displayNameOrUsername || '';
  // If the candidate looks like a clean username already (no spaces, allowed chars), use as-is.
  if (/^[a-z0-9._-]+$/i.test(candidate)) {
    return `/tipsters/${encodeURIComponent(candidate.toLowerCase())}`;
  }
  // Otherwise, slugify the name.
  const slug = slugify(candidate);
  if (slug) return `/tipsters/${slug}`;
  return fallback ? `/tipsters/${encodeURIComponent(fallback)}` : '#';
}

export function extractNumericPlayerId(raw: string): string | null {
  if (!raw) return null;
  const s = String(raw);
  if (/^\d+$/.test(s)) return s;
  const tail = s.match(/-(\d{2,})$/);
  if (tail) return tail[1];
  const head = s.match(/^(\d{2,})-/);
  if (head) return head[1];
  return null;
}
