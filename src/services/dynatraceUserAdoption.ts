import { queryExecutionClient } from '@dynatrace-sdk/client-query';

export type LoginEvent = { timestamp: string; userId: string; userName?: string; provider?: string };
export type UserActivity = { userId: string; userName: string; lastLogin: string; activeDays: number; logins: number; status: 'Active' | 'Inactive'; managementZone: string };

const queryFor = (days: number) => `fetch dt.system.events, from:now()-${days}d\n| filter event.kind == "AUDIT_EVENT"\n| filter event.type == "LOGIN"\n| fields timestamp, user.id, user.name, event.provider, event.type\n| sort timestamp desc\n| limit 10000`;

const diagnosticQuery = `fetch dt.system.events, from:now()-7d\n| filter event.kind == "AUDIT_EVENT"\n| summarize eventCount=count(), by:{event.type}\n| sort eventCount desc\n| limit 100`;
const str = (v: unknown) => v == null ? '' : String(v);

export async function fetchLoginEvents(days: 7 | 15 | 30): Promise<LoginEvent[]> {
  const result = await queryExecutionClient.queryExecute({ body: { query: queryFor(days), requestTimeoutMilliseconds: 30000 } });
  const records = (result.result?.records ?? []) as Record<string, unknown>[];
  return records.map((r) => ({ timestamp: str(r.timestamp), userId: str(r['user.id']) || 'Unknown', userName: str(r['user.name']) || undefined, provider: str(r['event.provider']) || undefined }));
}

export async function diagnoseAuditEventTypes(): Promise<string[]> {
  const result = await queryExecutionClient.queryExecute({ body: { query: diagnosticQuery, requestTimeoutMilliseconds: 30000 } });
  const records = (result.result?.records ?? []) as Record<string, unknown>[];
  return records.map((r) => `${str(r['event.type']) || 'UNKNOWN'} (${str(r.eventCount) || '0'})`);
}

export function buildUserActivity(events: LoginEvent[]): UserActivity[] {
  const grouped = new Map<string, LoginEvent[]>();
  for (const event of events) grouped.set(event.userId, [...(grouped.get(event.userId) ?? []), event]);
  return [...grouped.entries()].map(([userId, items]): UserActivity => {
    const ordered = [...items].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return { userId, userName: ordered.find((x) => x.userName)?.userName ?? userId, lastLogin: ordered[0]?.timestamp ?? '', activeDays: new Set(ordered.map((x) => x.timestamp.slice(0, 10))).size, logins: ordered.length, status: 'Active', managementZone: 'Pending enrichment' };
  }).sort((a, b) => b.logins - a.logins);
}

export function dailyActiveUsers(events: LoginEvent[]) {
  const daily = new Map<string, Set<string>>();
  for (const event of events) { const day = event.timestamp.slice(0, 10); const users = daily.get(day) ?? new Set<string>(); users.add(event.userId); daily.set(day, users); }
  return [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, users]) => ({ date, users: users.size }));
}
