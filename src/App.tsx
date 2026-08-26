import { useEffect, useMemo, useState } from 'react';
import { Activity, CalendarDays, ChevronRight, RefreshCw, ShieldCheck, UserCheck, UserX, Users, X } from 'lucide-react';
import { fetchAdoption, fetchUserDailyActivity, loadReference, summarizeByMz, type MzSummary, type UserActivity } from './services/adoptionEngine';

type Range = 7 | 15 | 30;

export default function App() {
  const [range, setRange] = useState<Range>(30);
  const [users, setUsers] = useState<UserActivity[]>([]);
  const [zones, setZones] = useState<MzSummary[]>([]);
  const [selectedMz, setSelectedMz] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserActivity | null>(null);
  const [daily, setDaily] = useState<{ day: string; logins: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refCount, setRefCount] = useState(0);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const reference = await loadReference();
      setRefCount(reference.size);
      const activity = await fetchAdoption(range, reference);
      setUsers(activity);
      setZones(summarizeByMz(activity));
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Adoption data could not be loaded.');
      setUsers([]); setZones([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [range]);

  const active = users.filter((u) => u.status === 'Active').length;
  const inactive = users.length - active;
  const adoption = users.length ? Math.round(active / users.length * 100) : 0;
  const totalLogins = users.reduce((sum, u) => sum + u.logins, 0);
  const displayedUsers = useMemo(() => selectedMz ? users.filter((u) => u.assignments.some((a) => a.mz === selectedMz)) : [], [users, selectedMz]);
  const selectedZone = zones.find((z) => z.mz === selectedMz);

  const openUser = async (user: UserActivity) => {
    setSelectedUser(user);
    try { setDaily(await fetchUserDailyActivity(user.userId, range)); } catch { setDaily([]); }
  };

  return <main className="shell">
    <header className="header">
      <div><div className="eyebrow">AXIS BANK · DYNATRACE APPENGINE</div><h1>Dynatrace User Adoption</h1><p>Management Zone and application adoption based on the maintained user population and live Dynatrace login activity.</p></div>
      <div className="toolbar"><div className="ranges">{[7, 15, 30].map((d) => <button className={range === d ? 'selected' : ''} key={d} onClick={() => setRange(d as Range)}>{d} Days</button>)}</div><button className="refresh" onClick={() => void load()}><RefreshCw size={16} className={loading ? 'spin' : ''}/></button></div>
    </header>
    <div className="status"><span><i/> {loading ? 'Querying Grail…' : 'Live Dynatrace data'}</span><span><CalendarDays size={13}/> Last {range} days</span><span>{refCount.toLocaleString()} reference users</span></div>
    {error && <div className="error"><b>Data unavailable</b><span>{error}</span></div>}

    <section className="cards">
      <Card icon={<Users/>} label="Reference Users" value={refCount} hint="Unique users in supplied MZ base"/>
      <Card icon={<UserCheck/>} label="Active Users" value={active} hint={`At least one LOGIN in ${range} days`}/>
      <Card icon={<UserX/>} label="Inactive Users" value={inactive} hint="Reference users with no LOGIN"/>
      <Card icon={<Activity/>} label="Adoption Rate" value={`${adoption}%`} hint={`${totalLogins.toLocaleString()} aggregated login events`}/>
    </section>

    <section className="panel"><div className="panelHead"><div><h2>Management Zone Adoption</h2><p>Users are assigned to MZ/application relationships from the supplied reference base; login activity comes from Grail.</p></div><span>{zones.length} MZs</span></div>
      <div className="mzTable"><div className="thead"><span>MANAGEMENT ZONE</span><span>APPLICATION</span><span>USERS</span><span>ACTIVE</span><span>INACTIVE</span><span>ADOPTION</span><span/></div>
        {zones.map((z) => <button className={`mzRow ${selectedMz === z.mz ? 'selected' : ''}`} key={z.mz} onClick={() => setSelectedMz(selectedMz === z.mz ? null : z.mz)}><strong>{z.mz}</strong><span>{z.apps.join(', ')}</span><span>{z.total}</span><span>{z.active}</span><span>{z.inactive}</span><span><b>{z.adoption}%</b><i><em style={{width:`${z.adoption}%`}}/></i></span><ChevronRight size={15}/></button>)}
        {!zones.length && !loading && <div className="empty">No MZ assignments found.</div>}
      </div>
    </section>

    {selectedMz && <section className="panel detailPanel"><div className="panelHead"><div><h2>{selectedMz}</h2><p>{selectedZone?.apps.join(', ')} · {displayedUsers.length} assigned users</p></div><button className="close" onClick={() => setSelectedMz(null)}><X size={15}/></button></div>
      <div className="table"><div className="thead"><span>USER</span><span>LAST LOGIN</span><span>ACTIVE DAYS</span><span>LOGINS</span><span>STATUS</span><span/></div>
        {displayedUsers.slice(0, 1000).map((u) => <button className="tr userRow" key={`${selectedMz}-${u.userId}`} onClick={() => void openUser(u)}><strong>{u.userName}</strong><span>{u.lastLogin || '—'}</span><span>{u.activeDays}</span><span>{u.logins}</span><em className={u.status.toLowerCase()}>{u.status}</em><ChevronRight size={14}/></button>)}
      </div>
    </section>}

    {selectedUser && <section className="panel userDetail"><div className="panelHead"><div><h2>{selectedUser.userName}</h2><p>{selectedUser.userId} · {selectedUser.assignments.map((a) => a.mz).join(', ')}</p></div><button className="close" onClick={() => setSelectedUser(null)}><X size={15}/></button></div><div className="userStats"><b>{selectedUser.status}</b><span>{selectedUser.activeDays} active days</span><span>{selectedUser.logins} login events</span><span>Last login: {selectedUser.lastLogin || '—'}</span></div><div className="timeline">{daily.map((d) => <div key={d.day} className="day"><i className={d.logins ? 'hit' : ''}/><span>{d.day.slice(0,10)}</span><b>{d.logins ? `${d.logins} login${d.logins > 1 ? 's' : ''}` : 'No login'}</b></div>)}{!daily.length && <div className="empty">No daily activity for this user.</div>}</div></section>}

    <div className="callout"><ShieldCheck size={15}/><span>Reference population is privacy-safe SHA-256 user mapping. Raw LDAP/user data is not stored in the repository.</span></div>
    <footer>Dynatrace User Adoption · MZ-aware adoption engine · Aggregated Grail queries</footer>
  </main>;
}

function Card({icon,label,value,hint}:{icon:React.ReactNode;label:string;value:string|number;hint:string}) { return <article className="card"><div className="icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>; }
