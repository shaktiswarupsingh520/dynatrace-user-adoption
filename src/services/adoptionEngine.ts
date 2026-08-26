import { queryExecutionClient } from '@dynatrace-sdk/client-query';

export type UserAssignment = { mz: string; app: string; code: string };
export type UserActivity = { userId: string; userName: string; assignments: UserAssignment[]; lastLogin: string; activeDays: number; logins: number; status: 'Active' | 'Inactive' };
export type MzSummary = { mz: string; apps: string[]; total: number; active: number; inactive: number; adoption: number };

type ReferencePayload = { assignments: Record<string, [string, string, string][]> };
const str = (v: unknown) => v == null ? '' : String(v);

export async function loadReference(): Promise<Map<string, UserAssignment[]>> {
  const response = await fetch('/data/user-mz-master.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Reference dataset not found. Copy user-mz-master.json into public/data before deployment.');
  const payload = await response.json() as ReferencePayload;
  return new Map(Object.entries(payload.assignments).map(([hash, values]) => [hash, values.map(([mz, app, code]) => ({ mz, app, code }))]));
}

async function hashUserId(userId: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(userId));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function fetchAdoption(days: 7 | 15 | 30, reference: Map<string, UserAssignment[]>): Promise<UserActivity[]> {
  const query = `fetch dt.system.events, from:now()-${days}d\n| filter event.kind == "AUDIT_EVENT" and event.type == "LOGIN"\n| summarize logins=count(), activeDays=countDistinctExact(bin(timestamp, 1d)), lastLogin=max(timestamp), userName=takeAny(user.name), by:{userId=user.id}\n| sort lastLogin desc`;
  const result = await queryExecutionClient.queryExecute({ body: { query, maxResultRecords: 10000, requestTimeoutMilliseconds: 30000 } });
  const rows = ((result.result?.records ?? []) as Record<string, unknown>[]).map((r) => ({ userId: str(r.userId), userName: str(r.userName), lastLogin: str(r.lastLogin), activeDays: Number(r.activeDays ?? 0), logins: Number(r.logins ?? 0) }));
  const activeByHash = new Map<string, typeof rows[number]>();
  for (const row of rows) activeByHash.set(await hashUserId(row.userId), row);
  return [...reference.entries()].map(([hash, assignments]) => {
    const row = activeByHash.get(hash);
    return { userId: row?.userId ?? `ref-${hash.slice(0, 10)}`, userName: row?.userName || row?.userId || 'Inactive user', assignments, lastLogin: row?.lastLogin || '', activeDays: row?.activeDays || 0, logins: row?.logins || 0, status: row ? 'Active' : 'Inactive' } satisfies UserActivity;
  });
}

export function summarizeByMz(users: UserActivity[]): MzSummary[] {
  const map = new Map<string, { apps: Set<string>; total: number; active: number }>();
  for (const user of users) for (const assignment of user.assignments) {
    const v = map.get(assignment.mz) ?? { apps: new Set<string>(), total: 0, active: 0 };
    v.apps.add(assignment.app); v.total += 1; if (user.status === 'Active') v.active += 1; map.set(assignment.mz, v);
  }
  return [...map.entries()].map(([mz, v]) => ({ mz, apps: [...v.apps].sort(), total: v.total, active: v.active, inactive: v.total - v.active, adoption: v.total ? Math.round(v.active / v.total * 100) : 0 })).sort((a, b) => b.total - a.total);
}

export async function fetchUserDailyActivity(userId: string, days: 7 | 15 | 30) {
  const safe = userId.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  const query = `fetch dt.system.events, from:now()-${days}d\n| filter event.kind == "AUDIT_EVENT" and event.type == "LOGIN" and user.id == "${safe}"\n| summarize logins=count(), by:{day=bin(timestamp, 1d)}\n| sort day asc`;
  const result = await queryExecutionClient.queryExecute({ body: { query, maxResultRecords: 100, requestTimeoutMilliseconds: 30000 } });
  return ((result.result?.records ?? []) as Record<string, unknown>[]).map((r) => ({ day: str(r.day), logins: Number(r.logins ?? 0) }));
}
