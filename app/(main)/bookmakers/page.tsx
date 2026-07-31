'use client';

export const dynamic = 'force-dynamic';
import { useEffect, useMemo, useState } from 'react';
import { Search, Star, ExternalLink, Gift, Filter, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface BookmakerRow {
  id: number;
  name: string;
  slug: string;
  logo: string;
  logoUrl?: string;
  affiliateUrl: string;
  bonus: string;
  bonusCode?: string;
  rating: number;
  regions: string[];
  features: string[];
  minDeposit: number;
  paymentMethods: string[];
  pros: string[];
  cons: string[];
  established?: number;
  featured: boolean;
}

const REGIONS = [
  { value: 'all', label: 'All Regions' },
  { value: 'KE', label: 'Kenya' },
  { value: 'NG', label: 'Nigeria' },
  { value: 'GH', label: 'Ghana' },
  { value: 'UK', label: 'United Kingdom' },
  { value: 'US', label: 'United States' },
  { value: 'EU', label: 'Europe' },
  { value: 'AU', label: 'Australia' },
];

export default function BookmakersPage() {
  const [bookmakers, setBookmakers] = useState<BookmakerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');
  const [sortBy, setSortBy] = useState('rating');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/bookmakers', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (!cancelled) setBookmakers(j.bookmakers || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => bookmakers
    .filter(b => !search || b.name.toLowerCase().includes(search.toLowerCase()))
    .filter(b => regionFilter === 'all' || b.regions.includes(regionFilter))
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'bonus') return b.minDeposit - a.minDeposit;
      return b.rating - a.rating;
    }), [bookmakers, search, regionFilter, sortBy]);

  return (
    <div className="flex-1 overflow-hidden">
      <div className="px-3 py-3">
        {/* Header */}
        <div className="mb-3">
          <h1 className="text-base font-bold text-foreground">Bookmakers</h1>
          <p className="text-[11px] text-muted-foreground">Compare top betting sites and claim exclusive bonuses</p>
        </div>

        {/* Filters */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <div className="relative min-w-0 flex-1 sm:max-w-[200px]">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-7 pl-7 text-xs"
            />
          </div>
          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger className="h-7 w-28 text-[11px]">
              <Filter className="mr-1 h-3 w-3" />
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent>
              {REGIONS.map(r => (
                <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-7 w-28 text-[11px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rating" className="text-xs">Top Rated</SelectItem>
              <SelectItem value="name" className="text-xs">Name A–Z</SelectItem>
              <SelectItem value="bonus" className="text-xs">Best Bonus</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-[10px] text-muted-foreground ml-auto">
            {loading ? '…' : `${filtered.length} found`}
          </span>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((bk, i) => (
              <BookmakerCard key={bk.id} bk={bk} rank={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BookmakerCard({ bk, rank }: { bk: BookmakerRow; rank: number }) {
  const signupUrl = `/api/r/bookmaker/${encodeURIComponent(bk.slug)}?placement=bookmakers-page`;

  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border border-border bg-card transition-all hover:border-primary/40 hover:shadow-sm',
        rank === 0 && 'border-warning/40 bg-gradient-to-br from-warning/5 to-transparent'
      )}
    >
      {/* Top row */}
      <div className="flex items-center gap-2 p-3 pb-2">
        <div className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold',
          rank === 0 ? 'bg-warning text-warning-foreground' : 'bg-primary/10 text-primary'
        )}>
          {bk.logoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={bk.logoUrl} alt={bk.name} className="h-8 w-8 object-contain rounded" />
            : bk.logo}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate text-sm font-bold">{bk.name}</span>
            {rank === 0 && (
              <Badge className="h-3.5 shrink-0 bg-warning px-1 text-[8px] text-warning-foreground">
                <Star className="mr-0.5 h-2 w-2 fill-current" />TOP
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className={cn('h-2.5 w-2.5', i < Math.floor(bk.rating) ? 'fill-warning text-warning' : 'text-muted')} />
            ))}
            <span className="ml-1 text-[10px] font-bold">{bk.rating.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Bonus */}
      <div className="mx-3 mb-2 rounded bg-success/10 px-2 py-1.5">
        <div className="flex items-center gap-1">
          <Gift className="h-3 w-3 text-success" />
          <span className="text-[9px] font-bold uppercase text-success">Welcome Bonus</span>
        </div>
        <div className="mt-0.5 text-[11px] font-semibold leading-snug">{bk.bonus}</div>
        {bk.bonusCode && (
          <div className="mt-0.5 font-mono text-[9px] text-muted-foreground">Code: {bk.bonusCode}</div>
        )}
      </div>

      {/* Regions */}
      <div className="mx-3 mb-2 flex flex-wrap gap-0.5">
        {bk.regions.map(r => (
          <Badge key={r} variant="outline" className="h-3.5 px-1 text-[8px] uppercase">{r}</Badge>
        ))}
      </div>

      {/* Features — max 3 */}
      {bk.features.length > 0 && (
        <div className="mx-3 mb-2 grid grid-cols-2 gap-x-2 gap-y-0.5">
          {bk.features.slice(0, 4).map(f => (
            <div key={f} className="flex items-center gap-0.5 text-[10px]">
              <Check className="h-2.5 w-2.5 shrink-0 text-success" />
              <span className="truncate">{f}</span>
            </div>
          ))}
        </div>
      )}

      {/* Spacer pushes CTA to bottom */}
      <div className="flex-1" />

      {/* CTA */}
      <div className="border-t border-border p-2">
        <Button asChild size="sm" className="h-7 w-full text-xs">
          <a href={signupUrl} target="_blank" rel="noopener noreferrer">
            Sign Up <ExternalLink className="ml-1.5 h-3 w-3" />
          </a>
        </Button>
      </div>
    </div>
  );
}
