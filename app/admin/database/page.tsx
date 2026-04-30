'use client';

import { useState, useEffect } from 'react';
import { Database, CheckCircle, XCircle, Loader2, ShieldAlert, Trash2, Save, TestTube } from 'lucide-react';

interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
}

interface ApiState {
  source: 'env' | 'file' | 'none';
  hasEnvVar: boolean;
  config: DbConfig | null;
}

const EMPTY: DbConfig = { host: '', port: 3306, user: '', password: '', database: '', ssl: false };

export default function DatabaseSettingsPage() {
  const [apiState, setApiState] = useState<ApiState | null>(null);
  const [form, setForm] = useState<DbConfig>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveMsg, setSaveMsg] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function load() {
    const res = await fetch('/api/admin/db-config');
    if (res.ok) {
      const data: ApiState = await res.json();
      setApiState(data);
      if (data.config) {
        setForm(data.config);
      }
    }
  }

  useEffect(() => { load(); }, []);

  function field(key: keyof DbConfig, value: string | number | boolean) {
    setForm(f => ({ ...f, [key]: value }));
    setTestResult(null);
    setSaveMsg('');
  }

  async function save() {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch('/api/admin/db-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setSaveMsg('Configuration saved. Restart the server to apply.');
        await load();
      } else {
        setSaveMsg(data.error || 'Save failed.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/db-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test' }),
      });
      const data = await res.json();
      setTestResult(data);
    } finally {
      setTesting(false);
    }
  }

  async function clear() {
    if (!confirm('Remove the saved database configuration?')) return;
    setDeleting(true);
    await fetch('/api/admin/db-config', { method: 'DELETE' });
    setForm(EMPTY);
    setTestResult(null);
    setSaveMsg('');
    await load();
    setDeleting(false);
  }

  const source = apiState?.source ?? 'none';
  const hasEnvVar = apiState?.hasEnvVar ?? false;

  return (
    <div className="max-w-2xl mx-auto py-4 px-4 space-y-4">

        {/* Header */}
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" /> Database Connection
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Configure your MySQL database. Settings are applied on the next server restart.
          </p>
        </div>

        {/* Status banner */}
        <div className={`rounded-xl border p-3 flex items-start gap-2.5 ${
          source === 'none'
            ? 'border-amber-500/40 bg-amber-50 dark:bg-amber-950/30'
            : source === 'env'
            ? 'border-blue-500/40 bg-blue-50 dark:bg-blue-950/30'
            : 'border-green-500/40 bg-green-50 dark:bg-green-950/30'
        }`}>
          {source === 'none' ? (
            <XCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          ) : source === 'env' ? (
            <ShieldAlert className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          ) : (
            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
          )}
          <div>
            {source === 'none' && (
              <>
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">No database configured</p>
                <p className="text-[10px] text-amber-600/80 dark:text-amber-400/70 mt-0.5 leading-tight">
                  The app is running on mock data. Fill in the form below to connect your MySQL database.
                </p>
              </>
            )}
            {source === 'env' && (
              <>
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Using DATABASE_URL env var</p>
                <p className="text-[10px] text-blue-600/80 dark:text-blue-300/70 mt-0.5 leading-tight">
                  A <code className="font-mono">DATABASE_URL</code> is set and takes priority.
                </p>
              </>
            )}
            {source === 'file' && (
              <>
                <p className="text-xs font-semibold text-green-700 dark:text-green-300">Configuration saved</p>
                <p className="text-[10px] text-green-600/80 dark:text-green-300/70 mt-0.5 leading-tight">
                  Using admin panel settings. Click "Test Connection" to verify.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Form */}
        <div className="rounded-xl border bg-card p-4 space-y-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-0.5">Connection Details</h2>

          {hasEnvVar && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-2.5 text-[10px] text-blue-700 dark:text-blue-300 leading-tight">
              <strong>Note:</strong> <code className="font-mono">DATABASE_URL</code> is set. This form stores a fallback configuration.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground px-0.5 uppercase tracking-wider">Host</label>
              <input
                className="w-full h-8 rounded-md border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="db.example.com"
                value={form.host}
                onChange={e => field('host', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground px-0.5 uppercase tracking-wider">Port</label>
              <input
                type="number"
                className="w-full h-8 rounded-md border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="3306"
                value={form.port}
                onChange={e => field('port', parseInt(e.target.value) || 3306)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground px-0.5 uppercase tracking-wider">Username</label>
              <input
                className="w-full h-8 rounded-md border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="user"
                autoComplete="off"
                value={form.user}
                onChange={e => field('user', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground px-0.5 uppercase tracking-wider">Password</label>
              <input
                type="password"
                className="w-full h-8 rounded-md border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="••••••••"
                autoComplete="new-password"
                value={form.password}
                onChange={e => field('password', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground px-0.5 uppercase tracking-wider">Database Name</label>
            <input
              className="w-full h-8 rounded-md border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="db_name"
              value={form.database}
              onChange={e => field('database', e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none px-0.5">
            <input
              type="checkbox"
              className="rounded"
              checked={form.ssl}
              onChange={e => field('ssl', e.target.checked)}
            />
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Require SSL / TLS</span>
          </label>

          {/* Save message */}
          {saveMsg && (
            <p className={`text-[11px] rounded-md px-2.5 py-1.5 ${
              saveMsg.includes('saved')
                ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
            }`}>
              {saveMsg}
            </p>
          )}

          {/* Test result */}
          {testResult && (
            <div className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px] ${
              testResult.success
                ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300'
                : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
            }`}>
              {testResult.success
                ? <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                : <XCircle className="h-3.5 w-3.5 shrink-0" />}
              {testResult.message}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving || !form.host || !form.user || !form.database}
              className="flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Config
            </button>

            <button
              onClick={test}
              disabled={testing}
              className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
            >
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TestTube className="h-3.5 w-3.5" />}
              Test Connection
            </button>

            {source === 'file' && (
              <button
                onClick={clear}
                disabled={deleting}
                className="flex items-center gap-2 rounded-md border border-destructive/40 text-destructive px-3 py-1.5 text-xs font-semibold hover:bg-destructive/5 disabled:opacity-50 ml-auto"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Clear
              </button>
            )}
          </div>
        </div>

        {/* How it works */}
        <div className="rounded-xl border bg-muted/40 p-3.5 space-y-1.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">How this works</h3>
          <ol className="text-[10px] text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Fill in your VPS MySQL details above.</li>
            <li>Click <strong>Save Config</strong> — credentials stored securely.</li>
            <li>Click <strong>Test Connection</strong> to verify reachability.</li>
            <li>Restart server (or redeploy) to apply changes.</li>
          </ol>
        </div>

    </div>
  );
}
