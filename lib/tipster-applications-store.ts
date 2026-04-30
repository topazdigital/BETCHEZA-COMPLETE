// ─────────────────────────────────────────────────────────────────────
// Tipster application store.
//
// Anyone with a regular `user` account can apply to become a tipster.
// Applications land in this in-memory queue, surface in the admin panel
// at /admin/tipster-applications, and on approval the user's role is
// promoted to `tipster` (with optional verification badge).
//
// Persistence: JSON file at .local/state/tipster-applications.json so
// the queue survives a dev-server restart. No PostgreSQL — the dev
// environment is file-backed; in production this would migrate to a
// MySQL `tipster_applications` table.
// ─────────────────────────────────────────────────────────────────────

import { promises as fs } from 'fs';
import path from 'path';

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface TipsterApplication {
  id: string;
  userId: number;
  username: string;
  displayName: string;
  email?: string;
  /** Tipster's pitch — why they should be approved. */
  pitch: string;
  /** Sports / leagues they specialise in (free-text). */
  specialties: string;
  /** Optional past performance / proof links. */
  experience?: string;
  /** Optional social handles or proof URL. */
  socialProof?: string;
  /** Whether the applicant is asking for the verified badge from day one. */
  requestVerified: boolean;
  status: ApplicationStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: number;
  /** Admin's note on rejection (or approval). */
  reviewerNote?: string;
  /** True when admin approved AND granted the verified badge. */
  verifiedGranted?: boolean;
}

const STORE_DIR = path.join(process.cwd(), '.local', 'state');
const STORE_PATH = path.join(STORE_DIR, 'tipster-applications.json');

interface StoreShape {
  applications: TipsterApplication[];
}

const g = globalThis as { __tipsterAppsStore?: StoreShape; __tipsterAppsLoaded?: boolean };
if (!g.__tipsterAppsStore) g.__tipsterAppsStore = { applications: [] };

function store(): StoreShape {
  return g.__tipsterAppsStore!;
}

async function ensureLoaded(): Promise<void> {
  if (g.__tipsterAppsLoaded) return;
  g.__tipsterAppsLoaded = true;
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    const data = JSON.parse(raw) as StoreShape;
    if (Array.isArray(data?.applications)) {
      store().applications = data.applications;
    }
  } catch {
    // No file yet — that's fine. We'll create one on first write.
  }
}

async function persist(): Promise<void> {
  try {
    await fs.mkdir(STORE_DIR, { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(store(), null, 2), 'utf8');
  } catch (e) {
    console.warn('[tipster-applications] persist failed', e);
  }
}

function newId(): string {
  return `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface CreateApplicationInput {
  userId: number;
  username: string;
  displayName: string;
  email?: string;
  pitch: string;
  specialties: string;
  experience?: string;
  socialProof?: string;
  requestVerified?: boolean;
}

/** Create a pending application. Returns the new row. */
export async function createApplication(input: CreateApplicationInput): Promise<TipsterApplication> {
  await ensureLoaded();
  const row: TipsterApplication = {
    id: newId(),
    userId: input.userId,
    username: input.username,
    displayName: input.displayName,
    email: input.email,
    pitch: input.pitch.trim(),
    specialties: input.specialties.trim(),
    experience: input.experience?.trim() || undefined,
    socialProof: input.socialProof?.trim() || undefined,
    requestVerified: !!input.requestVerified,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  store().applications.unshift(row);
  await persist();
  return row;
}

/** All applications, newest-first. Admin queue. */
export async function listApplications(opts?: { status?: ApplicationStatus }): Promise<TipsterApplication[]> {
  await ensureLoaded();
  const all = store().applications;
  return opts?.status ? all.filter(a => a.status === opts.status) : all;
}

/** A user's own applications (so they see "pending" / "approved" status on /become-tipster). */
export async function listApplicationsForUser(userId: number): Promise<TipsterApplication[]> {
  await ensureLoaded();
  return store().applications.filter(a => a.userId === userId);
}

export async function getApplication(id: string): Promise<TipsterApplication | undefined> {
  await ensureLoaded();
  return store().applications.find(a => a.id === id);
}

export interface ReviewInput {
  reviewerId: number;
  decision: 'approve' | 'reject';
  note?: string;
  /** When approving, also grant the verified badge. */
  grantVerified?: boolean;
}

export async function reviewApplication(id: string, input: ReviewInput): Promise<TipsterApplication | undefined> {
  await ensureLoaded();
  const row = store().applications.find(a => a.id === id);
  if (!row) return undefined;
  row.status = input.decision === 'approve' ? 'approved' : 'rejected';
  row.reviewedAt = new Date().toISOString();
  row.reviewedBy = input.reviewerId;
  row.reviewerNote = input.note?.trim() || undefined;
  row.verifiedGranted = input.decision === 'approve' && !!input.grantVerified;
  await persist();
  return row;
}

/** Stats for the admin dashboard widget. */
export async function applicationStats(): Promise<{ pending: number; approved: number; rejected: number; total: number }> {
  await ensureLoaded();
  const all = store().applications;
  return {
    total: all.length,
    pending: all.filter(a => a.status === 'pending').length,
    approved: all.filter(a => a.status === 'approved').length,
    rejected: all.filter(a => a.status === 'rejected').length,
  };
}
