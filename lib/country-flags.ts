export function countryCodeToFlag(code: string | undefined | null): string {
  if (!code) return '🌍';
  const upper = code.toUpperCase();
  const SPECIAL: Record<string, string> = {
    EU: '🇪🇺', WO: '🌍', SA: '🌎', NA: '🌎', AS: '🌏', AF: '🌍', SH: '🌏',
    'GB-SCT': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    'GB-WLS': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
    'GB-NIR': '🇬🇧',
    'GB-ENG': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  };
  if (SPECIAL[upper]) return SPECIAL[upper];
  if (upper.length !== 2) return '🌍';
  const A = 0x1f1e6;
  const a = 'A'.charCodeAt(0);
  const code1 = A + (upper.charCodeAt(0) - a);
  const code2 = A + (upper.charCodeAt(1) - a);
  if (code1 < A || code2 < A) return '🌍';
  return String.fromCodePoint(code1, code2);
}

export function countryFlagUrl(code: string | undefined | null): string | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  if (upper.length !== 2) return null;
  return `https://flagcdn.com/w40/${upper.toLowerCase()}.png`;
}
