'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ArrowUpRight, ArrowDownLeft, RefreshCw, ChevronLeft, ChevronRight,
  Search, Smartphone, Wallet, TrendingUp, TrendingDown, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Transaction {
  id: string;
  userId: number;
  username?: string | null;
  type: string;
  amount: number;
  currency: string;
  status: string;
  method?: string;
  reference?: string;
  description?: string;
  createdAt: string;
}

interface ApiResponse {
  txns: Transaction[];
  total: number;
  pages: number;
  stats: {
    grandTotal: number;
    totalDeposited: number;
    totalWithdrawn: number;
    mpesaCount: number;
    pendingCount: number;
  };
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const TYPE_LABELS: Record<string, string> = {
  deposit: 'Deposit',
  withdraw: 'Withdrawal',
  competition_entry: 'Comp. Entry',
  prize_payout: 'Prize',
  refund: 'Refund',
  adjustment: 'Adjustment',
};

const METHOD_LABELS: Record<string, string> = {
  mpesa: 'M-Pesa',
  card: 'Card',
  bank: 'Bank',
  crypto: 'Crypto',
  paypal: 'PayPal',
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    reversed: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  };
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', styles[status] || 'bg-muted text-muted-foreground')}>
      {status}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted', color)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase text-muted-foreground leading-none truncate">{label}</p>
          <p className="font-bold text-base mt-0.5 tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminTransactionsPage() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const params = new URLSearchParams({ page: String(page), limit: '50' });
  if (typeFilter !== 'all') params.set('type', typeFilter);
  if (statusFilter !== 'all') params.set('status', statusFilter);
  if (methodFilter !== 'all') params.set('method', methodFilter);
  if (search) params.set('search', search);

  const { data, isLoading, mutate } = useSWR<ApiResponse>(
    `/api/admin/transactions?${params}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const txns = data?.txns ?? [];
  const totalPages = data?.pages ?? 1;
  const stats = data?.stats;

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const resetFilters = () => {
    setTypeFilter('all');
    setStatusFilter('all');
    setMethodFilter('all');
    setSearch('');
    setSearchInput('');
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold">Transactions</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {data?.total ?? 0} matching · {stats?.grandTotal ?? 0} total in ledger
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()} className="h-8 text-xs gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <StatCard
            label="Total Deposited"
            value={`KES ${stats.totalDeposited.toLocaleString()}`}
            icon={TrendingUp}
            color="text-emerald-500"
          />
          <StatCard
            label="Total Withdrawn"
            value={`KES ${stats.totalWithdrawn.toLocaleString()}`}
            icon={TrendingDown}
            color="text-rose-500"
          />
          <StatCard
            label="M-Pesa Txns"
            value={String(stats.mpesaCount)}
            icon={Smartphone}
            color="text-green-600"
          />
          <StatCard
            label="Pending"
            value={String(stats.pendingCount)}
            icon={Clock}
            color={stats.pendingCount > 0 ? 'text-amber-500' : 'text-muted-foreground'}
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-1.5 flex-1 min-w-48">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="h-8 text-xs pl-8"
              placeholder="Search user, ref, description…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Button size="sm" className="h-8 text-xs" onClick={handleSearch}>Search</Button>
        </div>

        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="h-8 text-xs w-36">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All types</SelectItem>
            <SelectItem value="deposit" className="text-xs">Deposit</SelectItem>
            <SelectItem value="withdraw" className="text-xs">Withdrawal</SelectItem>
            <SelectItem value="competition_entry" className="text-xs">Comp. Entry</SelectItem>
            <SelectItem value="prize_payout" className="text-xs">Prize Payout</SelectItem>
            <SelectItem value="refund" className="text-xs">Refund</SelectItem>
            <SelectItem value="adjustment" className="text-xs">Adjustment</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="h-8 text-xs w-32">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All statuses</SelectItem>
            <SelectItem value="completed" className="text-xs">Completed</SelectItem>
            <SelectItem value="pending" className="text-xs">Pending</SelectItem>
            <SelectItem value="failed" className="text-xs">Failed</SelectItem>
            <SelectItem value="reversed" className="text-xs">Reversed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={methodFilter} onValueChange={(v) => { setMethodFilter(v); setPage(1); }}>
          <SelectTrigger className="h-8 text-xs w-32">
            <SelectValue placeholder="All methods" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All methods</SelectItem>
            <SelectItem value="mpesa" className="text-xs">M-Pesa</SelectItem>
            <SelectItem value="card" className="text-xs">Card</SelectItem>
            <SelectItem value="bank" className="text-xs">Bank</SelectItem>
            <SelectItem value="crypto" className="text-xs">Crypto</SelectItem>
          </SelectContent>
        </Select>

        {(typeFilter !== 'all' || statusFilter !== 'all' || methodFilter !== 'all' || search) && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={resetFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : txns.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              No transactions found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[10px] text-muted-foreground uppercase tracking-wider">
                    <th className="px-3 py-2 text-left font-medium">ID / Ref</th>
                    <th className="px-3 py-2 text-left font-medium">User</th>
                    <th className="px-3 py-2 text-left font-medium">Type</th>
                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                    <th className="px-3 py-2 text-left font-medium">Method</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {txns.map((txn) => (
                    <tr
                      key={txn.id}
                      className={cn(
                        'hover:bg-muted/30 transition-colors',
                        txn.method === 'mpesa' && 'bg-green-50/40 dark:bg-green-950/10',
                        txn.status === 'pending' && 'bg-amber-50/40 dark:bg-amber-950/10',
                        txn.status === 'failed' && 'bg-red-50/30 dark:bg-red-950/10',
                      )}
                    >
                      <td className="px-3 py-2.5">
                        <div className="font-mono text-[10px] text-muted-foreground">{txn.id}</div>
                        {txn.reference && (
                          <div className="font-mono text-[9px] text-muted-foreground/60 truncate max-w-32" title={txn.reference}>
                            {txn.reference}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{txn.username || `user#${txn.userId}`}</div>
                        <div className="text-[10px] text-muted-foreground">ID {txn.userId}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-1">
                          {txn.amount >= 0
                            ? <ArrowDownLeft className="h-3 w-3 text-emerald-500 shrink-0" />
                            : <ArrowUpRight className="h-3 w-3 text-rose-500 shrink-0" />}
                          <span>{TYPE_LABELS[txn.type] || txn.type}</span>
                        </span>
                        {txn.description && (
                          <div className="text-[10px] text-muted-foreground truncate max-w-40 mt-0.5" title={txn.description}>
                            {txn.description}
                          </div>
                        )}
                      </td>
                      <td className={cn(
                        'px-3 py-2.5 text-right font-semibold tabular-nums',
                        txn.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500',
                      )}>
                        {txn.amount >= 0 ? '+' : ''}{txn.amount.toLocaleString()} {txn.currency}
                      </td>
                      <td className="px-3 py-2.5">
                        {txn.method ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[9px] px-1.5 h-4',
                              txn.method === 'mpesa' && 'border-green-400 text-green-700 dark:text-green-400',
                            )}
                          >
                            {txn.method === 'mpesa' && <Smartphone className="h-2.5 w-2.5 mr-0.5" />}
                            {METHOD_LABELS[txn.method] || txn.method}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={txn.status} />
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                        {new Date(txn.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        <br />
                        <span className="text-[10px]">
                          {new Date(txn.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages} ({data?.total ?? 0} results)
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
