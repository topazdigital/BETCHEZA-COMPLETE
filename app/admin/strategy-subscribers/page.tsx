"use client";

import { useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import {
  Users, Clock, CheckCircle, XCircle, RefreshCw,
  AlertTriangle, TrendingUp, UserCheck, UserX, Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface SubscriberRow {
  userId: number;
  email: string;
  username: string;
  displayName: string;
  phone: string;
  paidAt: string;
  expiresAt: string;
  daysRemaining: number;
  reference: string;
}

interface PendingRow {
  userId: number;
  email: string;
  username: string;
  displayName: string;
  phone: string;
  reference: string;
  initiatedAt: string;
  checkoutRequestId?: string;
  walletContribution?: number;
  ageMinutes: number;
}

interface ApiData {
  active: SubscriberRow[];
  expired: SubscriberRow[];
  pending: PendingRow[];
}

type Tab = "pending" | "active" | "expired";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-KE", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtAge(minutes: number) {
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: React.ElementType; color: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 flex items-center gap-3">
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function StrategySubscribersPage() {
  const { data, isLoading, mutate } = useSWR<ApiData>(
    "/api/admin/strategy-subscribers",
    fetcher,
    { refreshInterval: 30000 }
  );
  const [tab, setTab] = useState<Tab>("pending");
  const [loadingRefs, setLoadingRefs] = useState<Set<string>>(new Set());

  const pending = data?.pending ?? [];
  const active = data?.active ?? [];
  const expired = data?.expired ?? [];

  async function postAction(body: Record<string, unknown>, ref: string) {
    setLoadingRefs(s => new Set(s).add(ref));
    try {
      const res = await fetch("/api/admin/strategy-subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) mutate();
    } finally {
      setLoadingRefs(s => { const ns = new Set(s); ns.delete(ref); return ns; });
    }
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "pending", label: "Pending Payments", count: pending.length },
    { id: "active", label: "Active Subscribers", count: active.length },
    { id: "expired", label: "Expired", count: expired.length },
  ];

  return (
    <div className="p-4 max-w-4xl">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Strategy Subscribers</h1>
            <p className="text-sm text-muted-foreground">
              Manage 3 Daily Odds Strategy payments and access
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => mutate()}
          disabled={isLoading}
          className="gap-1.5"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatCard
          label="Pending Payments"
          value={pending.length}
          icon={Clock}
          color={pending.length > 0
            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            : "bg-muted text-muted-foreground"}
        />
        <StatCard
          label="Active Subscribers"
          value={active.length}
          icon={UserCheck}
          color="bg-green-500/10 text-green-600 dark:text-green-400"
        />
        <StatCard
          label="Expired"
          value={expired.length}
          icon={UserX}
          color="bg-muted text-muted-foreground"
        />
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
              tab === t.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            {t.label}
            {t.count > 0 && (
              <span className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                tab === t.id
                  ? "bg-white/20 text-white"
                  : t.id === "pending"
                    ? "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                    : "bg-muted text-muted-foreground"
              )}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Pending Payments Tab */}
      {tab === "pending" && (
        <div className="space-y-3">
          {pending.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-card p-8 text-center">
              <CheckCircle className="mx-auto mb-2 h-8 w-8 text-green-500" />
              <p className="font-semibold text-sm">No pending payments</p>
              <p className="text-xs text-muted-foreground mt-1">
                All strategy payments have been resolved
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>
                  These users initiated M-Pesa payments that weren&apos;t automatically confirmed.
                  Verify with PayHero before granting access manually.
                </span>
              </div>
              {pending.map(p => (
                <PendingCard
                  key={p.reference}
                  row={p}
                  isLoading={loadingRefs.has(p.reference)}
                  onGrant={() => postAction(
                    { action: "grant", userId: p.userId, phone: p.phone, reference: p.reference },
                    p.reference
                  )}
                  onDismiss={() => postAction(
                    { action: "dismiss_pending", reference: p.reference },
                    p.reference
                  )}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Active Subscribers Tab */}
      {tab === "active" && (
        <div className="space-y-2">
          {active.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-card p-8 text-center">
              <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="font-semibold text-sm">No active subscribers yet</p>
            </div>
          ) : (
            active.map(s => (
              <SubscriberCard
                key={s.reference}
                row={s}
                isLoading={loadingRefs.has(s.reference)}
                onRevoke={() => postAction(
                  { action: "revoke", userId: s.userId },
                  s.reference
                )}
              />
            ))
          )}
        </div>
      )}

      {/* Expired Tab */}
      {tab === "expired" && (
        <div className="space-y-2">
          {expired.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">No expired subscribers</p>
            </div>
          ) : (
            expired.map(s => (
              <SubscriberCard
                key={s.reference}
                row={s}
                isLoading={false}
                expired
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function PendingCard({
  row, isLoading, onGrant, onDismiss,
}: {
  row: PendingRow;
  isLoading: boolean;
  onGrant: () => void;
  onDismiss: () => void;
}) {
  const isStale = row.ageMinutes > 120;
  return (
    <div className={cn(
      "rounded-lg border bg-card p-3.5 space-y-2.5",
      isStale ? "border-red-500/20" : "border-amber-500/20"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{row.displayName}</span>
            {row.email && (
              <span className="text-xs text-muted-foreground">{row.email}</span>
            )}
            <span className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
              isStale
                ? "bg-red-500/10 text-red-600 dark:text-red-400"
                : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
            )}>
              {fmtAge(row.ageMinutes)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>📱 {row.phone}</span>
            <span>Ref: <code className="font-mono text-[11px]">{row.reference}</code></span>
            {row.walletContribution && row.walletContribution > 0 && (
              <span className="text-blue-600 dark:text-blue-400">
                Wallet covered KES {row.walletContribution.toLocaleString()}
              </span>
            )}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Initiated {fmtDate(row.initiatedAt)}
            {row.checkoutRequestId && (
              <span className="ml-2 font-mono">{row.checkoutRequestId}</span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button
            size="sm"
            variant="default"
            className="h-7 gap-1 text-xs bg-green-600 hover:bg-green-700 text-white"
            onClick={onGrant}
            disabled={isLoading}
          >
            {isLoading ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <Shield className="h-3 w-3" />
            )}
            Grant Access
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs text-muted-foreground"
            onClick={onDismiss}
            disabled={isLoading}
          >
            <XCircle className="h-3 w-3" />
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}

function SubscriberCard({
  row, isLoading, onRevoke, expired,
}: {
  row: SubscriberRow;
  isLoading: boolean;
  onRevoke?: () => void;
  expired?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-lg border bg-card p-3 flex items-center gap-3",
      expired ? "opacity-60" : ""
    )}>
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
        expired ? "bg-muted text-muted-foreground" : "bg-green-500/10 text-green-700 dark:text-green-400"
      )}>
        {row.displayName.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{row.displayName}</span>
          {row.email && (
            <span className="text-xs text-muted-foreground truncate">{row.email}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground mt-0.5">
          <span>📱 {row.phone}</span>
          {expired ? (
            <span className="text-red-500">Expired {fmtDate(row.expiresAt)}</span>
          ) : (
            <span className="text-green-600 dark:text-green-400 font-medium">
              {row.daysRemaining}d remaining · expires {fmtDate(row.expiresAt)}
            </span>
          )}
          <span>Ref: <code className="font-mono text-[10px]">{row.reference}</code></span>
        </div>
      </div>
      {!expired && onRevoke && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs text-red-600 border-red-500/30 hover:bg-red-500/10 shrink-0"
          onClick={onRevoke}
          disabled={isLoading}
        >
          {isLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
          Revoke
        </Button>
      )}
    </div>
  );
}
