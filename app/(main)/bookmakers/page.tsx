'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Star,
  ExternalLink,
  Shield,
  Gift,
  Globe,
  Check,
  Filter,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
      .then(j => {
        if (cancelled) return;
        setBookmakers(j.bookmakers || []);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filteredBookmakers = useMemo(() => bookmakers
    .filter(b => !search || b.name.toLowerCase().includes(search.toLowerCase()))
    .filter(b => regionFilter === 'all' || b.regions.includes(regionFilter))
    .sort((a, b) => {
      switch (sortBy) {
        case 'rating': return b.rating - a.rating;
        case 'name': return a.name.localeCompare(b.name);
        case 'bonus': return b.minDeposit - a.minDeposit;
        default: return b.rating - a.rating;
      }
    }), [bookmakers, search, regionFilter, sortBy]);

  return (
    <div className="flex-1 overflow-hidden">
        <div className="px-3 py-3">
          <div className="mb-4">
            <h1 className="flex items-center gap-1.5 text-lg font-bold text-foreground">
              <Globe className="h-5 w-5 text-primary" />
              Bookmakers
            </h1>
            <p className="text-xs text-muted-foreground">
              Compare and find the best betting sites with exclusive bonuses
            </p>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search bookmakers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <Filter className="mr-1.5 h-3 w-3" />
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                {REGIONS.map(region => (
                  <SelectItem key={region.value} value={region.value} className="text-xs">
                    {region.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rating" className="text-xs">Top Rated</SelectItem>
                <SelectItem value="name" className="text-xs">Name A-Z</SelectItem>
                <SelectItem value="bonus" className="text-xs">Best Bonus</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mb-2 text-[11px] text-muted-foreground uppercase tracking-wider">
            {loading
              ? 'Loading bookmakers…'
              : `${filteredBookmakers.length} bookmaker${filteredBookmakers.length !== 1 ? 's' : ''} found`}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="grid gap-2">
              {filteredBookmakers.map((bookie, index) => (
                <div
                  key={bookie.id}
                  className={cn(
                    'rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md',
                    index === 0 && 'border-primary/20 bg-gradient-to-r from-primary/5 to-transparent'
                  )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
                        {bookie.logoUrl
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={bookie.logoUrl} alt={bookie.name} className="h-10 w-10 object-contain" />
                          : bookie.logo}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-base font-bold">{bookie.name}</h3>
                          {index === 0 && (
                            <Badge variant="default" className="h-4 bg-gradient-to-r from-warning to-warning/80 text-[9px] px-1.5">
                              <Star className="mr-0.5 h-2.5 w-2.5" />
                              Top Rated
                            </Badge>
                          )}
                          {bookie.featured && index !== 0 && (
                            <Badge variant="secondary" className="h-4 text-[9px] px-1.5">Featured</Badge>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <div className="flex items-center">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={cn(
                                  'h-3 w-3',
                                  i < Math.floor(bookie.rating)
                                    ? 'fill-warning text-warning'
                                    : 'text-muted'
                                )}
                              />
                            ))}
                          </div>
                          <span className="text-xs font-bold">{bookie.rating.toFixed(1)}</span>
                          {bookie.established && (
                            <span className="text-[10px] text-muted-foreground">Est. {bookie.established}</span>
                          )}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {bookie.regions.map(region => (
                            <Badge key={region} variant="outline" className="h-3.5 px-1 text-[8px] uppercase">
                              {region}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 sm:text-right">
                      <div className="rounded-lg bg-success/10 p-2 sm:inline-block">
                        <div className="flex items-center gap-1.5 sm:justify-end">
                          <Gift className="h-3.5 w-3.5 text-success" />
                          <span className="text-[10px] font-bold text-success uppercase">Welcome Bonus</span>
                        </div>
                        <div className="mt-0.5 text-sm font-bold">{bookie.bonus}</div>
                        {bookie.bonusCode && (
                          <div className="mt-0.5 font-mono text-[9px] text-muted-foreground uppercase">
                            Code: {bookie.bonusCode}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {bookie.features.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {bookie.features.map(feature => (
                        <div key={feature} className="flex items-center gap-1 text-[11px]">
                          <Check className="h-3 w-3 text-success" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {bookie.paymentMethods.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className="text-muted-foreground font-medium">PAYMENT:</span>
                      {bookie.paymentMethods.slice(0, 4).map(method => (
                        <Badge key={method} variant="secondary" className="h-4 px-1.5 text-[9px]">{method}</Badge>
                      ))}
                      {bookie.paymentMethods.length > 4 && (
                        <span className="text-muted-foreground">+{bookie.paymentMethods.length - 4}</span>
                      )}
                    </div>
                  )}

                  {(bookie.pros.length > 0 || bookie.cons.length > 0) && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <div className="mb-1 text-[10px] font-bold text-success uppercase tracking-wider">Pros</div>
                        <ul className="space-y-0.5">
                          {bookie.pros.map(pro => (
                            <li key={pro} className="flex items-start gap-1 text-[11px]">
                              <Check className="mt-0.5 h-3 w-3 shrink-0 text-success" />
                              {pro}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] font-bold text-destructive uppercase tracking-wider">Cons</div>
                        <ul className="space-y-0.5">
                          {bookie.cons.map(con => (
                            <li key={con} className="flex items-start gap-1 text-[11px] text-muted-foreground">
                              <span className="mt-0.5 h-3 w-3 shrink-0 text-center text-destructive leading-none">-</span>
                              {con}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                    <div className="text-[10px] text-muted-foreground">
                      Min. deposit: <span className="font-bold text-foreground">${bookie.minDeposit}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                        <a href={`/api/r/bookmaker/${encodeURIComponent(bookie.slug)}?placement=bookmakers-page-review`} target="_blank" rel="noopener noreferrer">
                          <Shield className="mr-1.5 h-3.5 w-3.5" />
                          Review
                        </a>
                      </Button>
                      <Button size="sm" className="h-7 text-xs px-4" asChild>
                        <a href={`/api/r/bookmaker/${encodeURIComponent(bookie.slug)}?placement=bookmakers-page`} target="_blank" rel="noopener noreferrer">
                          Sign Up
                          <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
  );
}
