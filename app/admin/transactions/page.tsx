'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowUpRight, ArrowDownLeft, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

interface Transaction {
  id: string;
  userId: number;
  type: string;
  amount: number;
  currency: string;
  status: string;
  method?: string;
  reference?: string;
  description?: string;
  createdAt: string;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

function txnTypeLabel(type: string) {
  const map: Record<string, string> = {
    deposit: 'Deposit',
    withdraw: 'Withdrawal',
    competition_entry: 'Competition Entry',
    prize_payout: 'Prize Payout',
    refund: 'Refund',
    adjustment: 'Adjustment',
  };
  return map[type] || type;
}

function statusColor(status: string) {
  switch (status) {
    case 'completed': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'pending': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'failed': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    case 'reversed': return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
    default: return 'bg-muted text-muted-foreground';
  }
}

export default function AdminTransactionsPage() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const params = new URLSearchParams({ page: String(page), limit: '50' });
  if (typeFilter !== 'all') params.set('type', typeFilter);
  if (statusFilter !== 'all') params.set('status', statusFilter);

  const { data, isLoading, mutate } = useSWR<{
    transactions: Transaction[];
    total: number;
    pages: number;
  }>(`/api/admin/transactions?${params}`, fetcher, { revalidateOnFocus: false });

  const txns = data?.transactions ?? [];
  const totalPages = data?.pages ?? 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Transactions</h1>
          <p className="text-sm text-muted-foreground">{data?.total ?? 0} total transactions</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()}>
          <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="deposit">Deposit</SelectItem>
            <SelectItem value="withdraw">Withdrawal</SelectItem>
            <SelectItem value="competition_entry">Competition Entry</SelectItem>
            <SelectItem value="prize_payout">Prize Payout</SelectItem>
            <SelectItem value="refund">Refund</SelectItem>
            <SelectItem value="adjustment">Adjustment</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="reversed">Reversed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">All Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Loading…</div>
          ) : txns.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">No transactions found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-left">ID</th>
                    <th className="px-4 py-2 text-left">User</th>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                    <th className="px-4 py-2 text-left">Method</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {txns.map(txn => (
                    <tr key={txn.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{txn.id}</td>
                      <td className="px-4 py-2">User #{txn.userId}</td>
                      <td className="px-4 py-2">
                        <span className="flex items-center gap-1">
                          {txn.amount > 0
                            ? <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-500" />
                            : <ArrowUpRight className="h-3.5 w-3.5 text-red-500" />}
                          {txnTypeLabel(txn.type)}
                        </span>
                      </td>
                      <td className={`px-4 py-2 text-right font-semibold tabular-nums ${txn.amount > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {txn.amount > 0 ? '+' : ''}{txn.amount.toLocaleString()} {txn.currency}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{txn.method || '—'}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(txn.status)}`}>
                          {txn.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">
                        {new Date(txn.createdAt).toLocaleString()}
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
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
