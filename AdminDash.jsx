// Admin Dashboard - overview stats + sidebar navigation

const ADMIN_TABS = [
  { id:'dashboard', icon:'📊', label:'ภาพรวม' },
  { id:'students',  icon:'👥', label:'รายชื่อนักศึกษา' },
  { id:'grade',     icon:'📝', label:'แก้ไขเกรด' },
  { id:'compare',   icon:'📈', label:'เปรียบเทียบเทอม' },
  { id:'reports',   icon:'📤', label:'ออกรายงาน' },
  { id:'log',       icon:'🕓', label:'ประวัติการแก้ไข' },
  { id:'import',    icon:'📥', label:'นำเข้าข้อมูล' },
  { id:'form',      icon:'🖨️', label:'สร้างแบบฟอร์ม' },
  { id:'settings',  icon:'⚙️', label:'ตั้งค่าระบบ' },
];

const AdminLayout = ({ user, activeTab, onTabChange, onLogout, children, theme, toggleTheme }) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  React.useEffect(() => { window.__goAdminTab = onTabChange; return () => { delete window.__goAdminTab; }; }, [onTabChange]);

  return (
    <div className="gi-admin-shell" style={{ display:'flex', minHeight:'100vh', fontFamily:'Sarabun, sans-serif' }}>
      {/* Sidebar */}
      <div className="gi-sidebar" style={{
        width: sidebarOpen ? 220 : 60, minHeight:'100vh',
        background:'#0d2c6b', color:'#fff', flexShrink:0,
        transition:'width .2s', display:'flex', flexDirection:'column',
        boxShadow:'2px 0 12px rgba(0,0,0,.15)'
      }}>
        {/* Logo */}
        <div className="gi-side-logo" style={{ padding: sidebarOpen ? '20px 18px 16px' : '20px 14px 16px', borderBottom:'1px solid rgba(255,255,255,.1)', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:24, flexShrink:0 }}>🎓</span>
          {sidebarOpen && <div>
            <div style={{ fontSize:13, fontWeight:700, lineHeight:1.3 }}>ระบบเกรด I</div>
            <div style={{ fontSize:10, opacity:.55, lineHeight:1.4 }}>วิชาศึกษาทั่วไป</div>
          </div>}
        </div>

        {/* User info */}
        {sidebarOpen && (
          <div className="gi-side-user" style={{ padding:'12px 18px', borderBottom:'1px solid rgba(255,255,255,.08)', background:'rgba(255,255,255,.05)' }}>
            <div style={{ fontSize:11, opacity:.5, marginBottom:3 }}>เข้าสู่ระบบในฐานะ</div>
            <div style={{ fontSize:13, fontWeight:600 }}>{user.displayName}</div>
            <div style={{ fontSize:11, opacity:.55, marginTop:2 }}>Admin</div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex:1, padding:'10px 0' }}>
          {ADMIN_TABS.map(tab => (
            <button key={tab.id} onClick={() => onTabChange(tab.id)} style={{
              display:'flex', alignItems:'center', gap:12, width:'100%',
              padding: sidebarOpen ? '11px 18px' : '11px 0', justifyContent: sidebarOpen ? 'flex-start' : 'center',
              background: activeTab === tab.id ? 'rgba(255,255,255,.15)' : 'transparent',
              borderLeft: activeTab === tab.id ? '3px solid #c8a951' : '3px solid transparent',
              border:'none', color:'#fff', cursor:'pointer', fontFamily:'Sarabun', fontSize:14,
              transition:'all .15s',
            }}
              onMouseEnter={e => { if(activeTab!==tab.id) e.currentTarget.style.background='rgba(255,255,255,.07)'; }}
              onMouseLeave={e => { if(activeTab!==tab.id) e.currentTarget.style.background='transparent'; }}
            >
              <span style={{ fontSize:18, flexShrink:0 }}>{tab.icon}</span>
              {sidebarOpen && <span style={{ fontWeight: activeTab===tab.id ? 600 : 400 }}>{tab.label}</span>}
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div className="gi-side-bottom" style={{ padding:'12px 0', borderTop:'1px solid rgba(255,255,255,.1)' }}>
          <button onClick={toggleTheme} style={{ display:'flex', alignItems:'center', gap:12, width:'100%', padding: sidebarOpen ? '9px 18px' : '9px 0', justifyContent: sidebarOpen ? 'flex-start' : 'center', background:'transparent', border:'none', color:'rgba(255,255,255,.5)', cursor:'pointer', fontFamily:'Sarabun', fontSize:13 }}>
            <span style={{ fontSize:18 }}>{theme === 'dark' ? '☀️' : '🌙'}</span>
            {sidebarOpen && (theme === 'dark' ? 'โหมดสว่าง' : 'โหมดมืด')}
          </button>
          <button onClick={() => setSidebarOpen(p=>!p)} style={{ display:'flex', alignItems:'center', gap:12, width:'100%', padding: sidebarOpen ? '9px 18px' : '9px 0', justifyContent: sidebarOpen ? 'flex-start' : 'center', background:'transparent', border:'none', color:'rgba(255,255,255,.5)', cursor:'pointer', fontFamily:'Sarabun', fontSize:13 }}>
            <span style={{ fontSize:18 }}>{sidebarOpen ? '◀' : '▶'}</span>
            {sidebarOpen && 'ย่อเมนู'}
          </button>
          <button onClick={onLogout} style={{ display:'flex', alignItems:'center', gap:12, width:'100%', padding: sidebarOpen ? '9px 18px' : '9px 0', justifyContent: sidebarOpen ? 'flex-start' : 'center', background:'transparent', border:'none', color:'rgba(255,255,255,.5)', cursor:'pointer', fontFamily:'Sarabun', fontSize:13 }}>
            <span style={{ fontSize:18 }}>🚪</span>
            {sidebarOpen && 'ออกจากระบบ'}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex:1, overflowX:'hidden', background:'var(--bg)' }}>
        {children}
      </div>
    </div>
  );
};

// ── Dashboard Tab ─────────────────────────────────────────────
const AdminDashboard = ({ user }) => {
  const [stats, setStats] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [semester, setSemester] = React.useState('');
  const [semesters, setSemesters] = React.useState([]);
  const toast = useToast();

  const loadSemesters = React.useCallback(async () => {
    const res = await window.API.getStudents({});
    const list = res.data || [];
    const set = new Set();
    list.forEach(s => s.semester && set.add(s.semester));
    const sorted = [...set].sort().reverse();
    setSemesters(sorted);
    setSemester(prev => prev && sorted.includes(prev) ? prev : (sorted[0] || ''));
  }, []);

  const loadStats = () => {
    if (!semester) { setLoading(false); return; }
    setLoading(true);
    window.API.getStats(semester).then(res => {
      setStats(res.data);
      setLoading(false);
    });
  };

  React.useEffect(() => { loadSemesters(); }, [loadSemesters]);
  React.useEffect(() => { loadStats(); }, [semester]);

  const refresh = async () => { await loadSemesters(); loadStats(); };

  const selectStyle = { padding:'7px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:13, fontFamily:'Sarabun', background:'var(--surface)', color:'var(--text)' };
  const btnStyle = { padding:'7px 14px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', cursor:'pointer', fontSize:13, fontFamily:'Sarabun' };

  if (loading) return (
    <div style={{ padding:'28px 28px' }}>
      <div style={{ fontSize:20, fontWeight:700, color:'var(--text)', marginBottom:24 }}>📊 ภาพรวมการแก้ไขเกรด I</div>
      <div style={{ marginBottom:24 }}><SkeletonCards count={5} /></div>
      <SkeletonTable rows={5} cols={6} />
    </div>
  );

  const byStatus = stats?.byStatus || {};
  const byCause  = stats?.byCause  || {};
  const courses  = Object.values(stats?.byCourse || {});
  const done = byStatus['เสร็จสิ้น'] || 0;
  const submitted = byStatus['ส่งงานทะเบียนแล้ว'] || 0;
  const total = stats?.total || 0;
  const completedPct = total > 0 ? Math.round((done + submitted)/total*100) : 0;

  const bottleneck = courses.filter(c => c.total > c.done).sort((a,b) => (b.total-b.done)-(a.total-a.done));

  // Donut segments — status breakdown
  const statusOrder = ['รอดำเนินการ','ส่งงานแล้ว','รออาจารย์แก้เกรด','เสร็จสิ้น','ส่งงานทะเบียนแล้ว'];
  const donutSegments = statusOrder
    .filter(s => (byStatus[s] || 0) > 0)
    .map(s => ({ label: STATUS_META[s].label, value: byStatus[s], color: STATUS_META[s].color }));

  return (
    <div style={{ padding:'28px 28px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div style={{ fontSize:20, fontWeight:700, color:'var(--text)' }}>📊 ภาพรวมการแก้ไขเกรด I</div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <select value={semester} onChange={e => setSemester(e.target.value)} style={selectStyle}>
            {semesters.length === 0 && <option value="">— ไม่มีข้อมูล —</option>}
            {semesters.map(s => <option key={s} value={s}>ภาค {s}</option>)}
          </select>
          <button onClick={refresh} style={btnStyle}>🔄 รีเฟรช</button>
        </div>
      </div>

      {total === 0 ? (
        <Card style={{ padding:'48px 32px', textAlign:'center' }}>
          <div style={{ fontSize:56, marginBottom:16 }}>📭</div>
          <div style={{ fontSize:18, fontWeight:700, color:'var(--text)', marginBottom:8 }}>ยังไม่มีข้อมูลนักศึกษาในระบบ</div>
          <div style={{ fontSize:14, color:'var(--text-muted)', marginBottom:24, lineHeight:1.7 }}>
            เริ่มต้นด้วยการนำเข้าข้อมูล 3 อย่าง: รายวิชาเปิดสอน → รายชื่อนักศึกษาที่ติด I → คะแนนสอบปลายภาครอบ 2<br/>
            จากนั้นภาพรวมและรายงานต่างๆ จะแสดงขึ้นที่นี่
          </div>
          <button onClick={() => window.__goAdminTab && window.__goAdminTab('import')} style={{ padding:'11px 28px', borderRadius:10, border:'none', background:'#0d2c6b', color:'#fff', cursor:'pointer', fontFamily:'Sarabun', fontSize:15, fontWeight:700 }}>📥 ไปหน้านำเข้าข้อมูล</button>
        </Card>
      ) : (
      <>
      {/* Summary stats */}
      <div className="gi-grid-3" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:14, marginBottom:20 }}>
        <StatCard accent label="นักศึกษาที่ติด I" value={total} icon="👥" color="var(--brand)" />
        <StatCard accent label="รอดำเนินการ" value={byStatus['รอดำเนินการ']||0} icon="⏸️" color="#6b7280" />
        <StatCard accent label="กำลังดำเนินการ" value={(byStatus['ส่งงานแล้ว']||0)+(byStatus['รออาจารย์แก้เกรด']||0)} icon="⚡" color="#d97706" />
        <StatCard accent label="แก้เกรดแล้ว" value={done} icon="✅" color="#16a34a" />
        <StatCard accent label="ส่งทะเบียนแล้ว" value={submitted} icon="📮" color="var(--brand)" />
      </div>

      {/* Charts row */}
      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:16, marginBottom:24 }} className="gi-grid-2">
        <Card style={{ padding:'20px 24px' }}>
          <div style={{ fontWeight:700, color:'var(--text)', marginBottom:16 }}>สัดส่วนตามสถานะ</div>
          {donutSegments.length === 0
            ? <EmptyState icon="📭" title="ยังไม่มีข้อมูล" />
            : <DonutChart segments={donutSegments} centerLabel={total} centerSub="นักศึกษา" />}
        </Card>
        <Card style={{ padding:'20px 24px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
          <div style={{ fontWeight:700, color:'var(--text)', marginBottom:16, alignSelf:'flex-start' }}>ความคืบหน้าโดยรวม</div>
          <ProgressRing percent={completedPct} size={150} thickness={16} color="#16a34a" label="เสร็จ/ส่งแล้ว" />
          <div style={{ display:'flex', gap:16, marginTop:18, flexWrap:'wrap', justifyContent:'center' }}>
            {[
              { label:'ขาดสอบ', value: byCause['ขาดสอบ']||0, color:'#dc2626' },
              { label:'ส่งงานไม่ครบ', value: byCause['ส่งงานไม่ครบ']||0, color:'#d97706' },
            ].map(i => (
              <div key={i.label} style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'var(--text-muted)' }}>
                <span style={{ width:10, height:10, borderRadius:'50%', background:i.color, display:'inline-block' }}></span>
                {i.label}: <strong style={{ color:'var(--text)' }}>{i.value}</strong>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Bottleneck table */}
      <Card style={{ overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border-soft)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontWeight:700, color:'var(--text)' }}>🚨 คอขวด — วิชาที่ยังค้างดำเนินการ</div>
          <div style={{ fontSize:12, color:'var(--text-dim)' }}>{bottleneck.length} รายวิชา</div>
        </div>
        {bottleneck.length === 0 ? (
          <EmptyState icon="🎉" title="ทุกรายวิชาดำเนินการเสร็จสิ้นแล้ว!" />
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
              <thead><tr style={{ background:'var(--surface-2)' }}>
                {['รหัสวิชา','ชื่อวิชา','หมู่','อาจารย์','ค้างอยู่','ความคืบหน้า'].map(h => (
                  <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:12, fontWeight:600, color:'var(--text-muted)', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {bottleneck.map((c,i) => {
                  const pending = c.total - c.done;
                  const p = Math.round(c.done/c.total*100);
                  return (
                    <tr key={i} style={{ borderBottom:'1px solid var(--border-soft)' }}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <td style={{ padding:'10px 16px', fontFamily:'monospace', fontSize:12, color:'var(--text)' }}>{c.courseCode}</td>
                      <td style={{ padding:'10px 16px', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--text)' }}>{c.courseName}</td>
                      <td style={{ padding:'10px 16px', color:'var(--text-muted)' }}>{c.section}</td>
                      <td style={{ padding:'10px 16px', color:'var(--text)' }}>{c.teacher||'—'}</td>
                      <td style={{ padding:'10px 16px' }}>
                        <span style={{ background:'#fef2f2', color:'#dc2626', padding:'2px 10px', borderRadius:20, fontSize:12, fontWeight:700 }}>{pending} คน</span>
                      </td>
                      <td style={{ padding:'10px 16px', minWidth:120 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ flex:1, height:6, background:'var(--border)', borderRadius:4 }}>
                            <div style={{ height:'100%', width:`${p}%`, background:'#16a34a', borderRadius:4 }}></div>
                          </div>
                          <span style={{ fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{p}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      </>
      )}
    </div>
  );
};

Object.assign(window, { AdminLayout, AdminDashboard });
