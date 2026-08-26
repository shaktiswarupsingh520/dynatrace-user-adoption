import { useEffect, useMemo, useState } from 'react';
import { Activity, CalendarDays, RefreshCw, ShieldCheck, UserCheck, UserX, Users } from 'lucide-react';
import { buildUserActivity, dailyActiveUsers, diagnoseAuditEventTypes, fetchLoginEvents, type UserActivity } from './services/dynatraceUserAdoption';

type Range = 7 | 15 | 30;

export default function App() {
  const [range, setRange] = useState<Range>(7);
  const [users, setUsers] = useState<UserActivity[]>([]);
  const [daily, setDaily] = useState<{ date: string; users: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [diagnostic, setDiagnostic] = useState('');

  const load = async () => {
    setLoading(true); setError(''); setDiagnostic('');
    try {
      const events = await fetchLoginEvents(range);
      setUsers(buildUserActivity(events));
      setDaily(dailyActiveUsers(events));
      if (!events.length) {
        const types = await diagnoseAuditEventTypes();
        setDiagnostic(types.length ? `No LOGIN records returned. Audit event types seen in the last 7 days: ${types.join(', ')}.` : 'No audit events were returned in the last 7 days.');
      }
    } catch (e) {
      console.error(e);
      setUsers([]); setDaily([]);
      setError('Live audit data could not be loaded. Check the app permissions for storage:system:read and storage:buckets:read, then verify dt.system.events access in the Axis tenant.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [range]);

  const uniqueUsers = users.length;
  const latestDaily = daily.at(-1)?.users ?? 0;
  const totalLogins = users.reduce((sum, u) => sum + u.logins, 0);
  const topUsers = useMemo(() => users.slice(0, 100), [users]);

  return <main className="shell">
    <header className="header">
      <div><div className="eyebrow">AXIS BANK · DYNATRACE APPENGINE</div><h1>Dynatrace User Adoption</h1><p>Live login engagement and adoption analytics.</p></div>
      <div className="toolbar"><div className="ranges">{[7, 15, 30].map((d) => <button className={range === d ? 'selected' : ''} key={d} onClick={() => setRange(d as Range)}>{d} Days</button>)}</div><button className="refresh" onClick={() => void load()}><RefreshCw size={16} className={loading ? 'spin' : ''}/></button></div>
    </header>
    <div className="status"><span><i/> {loading ? 'Querying Grail…' : 'Live Dynatrace data'}</span><span><CalendarDays size={13}/> Last {range} days</span><span>{totalLogins.toLocaleString()} login events</span></div>
    {error && <div className="error"><b>Live data unavailable</b><span>{error}</span></div>}
    {diagnostic && !error && <div className="diagnostic"><b>Data diagnostic</b><span>{diagnostic}</span></div>}

    <section className="cards">
      <Card icon={<Users/>} label="Unique Active Users" value={uniqueUsers} hint="Users with LOGIN activity"/>
      <Card icon={<UserCheck/>} label="Login Events" value={totalLogins} hint={`Successful LOGIN records in ${range} days`}/>
      <Card icon={<UserX/>} label="Inactive Users" value="—" hint="Requires full IAM user population"/>
      <Card icon={<Activity/>} label="Latest Daily Active" value={latestDaily} hint="Unique users on latest activity day"/>
    </section>

    <section className="grid">
      <div className="panel"><div className="panelHead"><div><h2>Daily Active Users</h2><p>Unique users with a LOGIN audit event per day.</p></div><span>{daily.length} active days</span></div><div className="chart">{daily.map((d) => <div className="bar" key={d.date} title={`${d.date}: ${d.users}`}><b style={{height:`${Math.max(8, latestDaily ? d.users/latestDaily*100 : 8)}%`}}/><small>{d.date.slice(5)}</small></div>)}{!daily.length && <div className="empty">No daily login activity returned.</div>}</div></div>
      <div className="panel"><div className="panelHead"><div><h2>Activity Health</h2><p>Phase 1 live audit activity</p></div></div><div className="health"><div className="ring"><b>{uniqueUsers}</b><span>USERS</span></div><div><strong>{uniqueUsers}</strong><small>unique users</small><strong>{totalLogins}</strong><small>login events</small></div></div><div className="callout"><ShieldCheck size={15}/><span>Grail audit provider connected. IAM population and Management Zone enrichment are next.</span></div></div>
    </section>

    <section className="panel"><div className="panelHead"><div><h2>User Activity</h2><p>Real audit/login records. Management Zone enrichment is Phase 2.</p></div><span>{topUsers.length} users</span></div><div className="table"><div className="thead"><span>USER</span><span>MANAGEMENT ZONE</span><span>LAST LOGIN</span><span>ACTIVE DAYS</span><span>LOGINS</span><span>STATUS</span></div>{topUsers.map((u) => <div className="tr" key={u.userId}><strong>{u.userName}</strong><span>{u.managementZone}</span><span>{u.lastLogin || '—'}</span><span>{u.activeDays}</span><span>{u.logins}</span><em>Active in window</em></div>)}{!loading && !topUsers.length && <div className="empty">No users returned.</div>}</div></section>
    <footer>Dynatrace User Adoption · Phase 1 · Standalone AppEngine application</footer>
  </main>;
}

function Card({icon,label,value,hint}:{icon:React.ReactNode;label:string;value:string|number;hint:string}) { return <article className="card"><div className="icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>; }
