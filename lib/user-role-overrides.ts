// Shared in-memory store of admin-applied role overrides. Both the admin
// users API (manual promote/demote) and the tipster-application approval flow
// write to the same Map so the user's role updates immediately across the app.
//
// We persist nothing — the dev environment uses mock users and the override
// rebuilds on cold start. In production (MySQL) the role lives on the user
// row directly; this module is the bridge for environments without a DB.
import type { Role } from './permissions';

const g = globalThis as { __userRoleOverrides?: Map<number, Role> };
if (!g.__userRoleOverrides) g.__userRoleOverrides = new Map<number, Role>();

const overrides = g.__userRoleOverrides;

export function setUserRoleOverride(userId: number, role: Role): void {
  overrides.set(userId, role);
}

export function getUserRoleOverride(userId: number): Role | undefined {
  return overrides.get(userId);
}

export function clearUserRoleOverride(userId: number): void {
  overrides.delete(userId);
}

export function listUserRoleOverrides(): Array<[number, Role]> {
  return Array.from(overrides.entries());
}
