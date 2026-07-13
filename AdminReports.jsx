// AdminReports.jsx — Audit Log, Cross-term Comparison, Export Reports
// Exports: AdminLog, AdminCompare, AdminReports

// ════════════════════════════════════════════════════════════════
// Shared helpers
// ════════════════════════════════════════════════════════════════
const fmtDateTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const date = d.toLocaleDateString('th-TH', { day:'2-digit', month:'short', year:'numeric' });
  const time = d.toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' });
  return `${date} ${time}`;
};

const sortSemestersDesc = (sems) => [...sems].sort((a, b) => {
  const [ta, ya] = String(a).split('/').map(Number);
  const [tb, yb] = String(b).split('/').map(Number);
  return yb !== ya ? yb - ya : tb - ta;
});

// ════════════════════════════════════════════════════════════════
// 1) AUDIT LOG VIEWER
// ════════════════════════════════════════════════════════════════
const AdminLog = ({ user }) => {
  const [logs, setLogs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [filterAction, setFilterAction] = React.useState('');
  const [filterSem, setFilterSem] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [confirmClear, setConfirmClear] = React.useState(false);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    window.API.getLogs({}).then(r => { setLogs(r.data || []); setLoading(false); });
  };
  React.useEffect(load, []);

  const semesters = React.useMemo(() => sortSemestersDesc([...new Set(logs.map(l => l.semester).filter(Boolean))]), [logs]);

  const filtered = logs.filter(l => {
    if (filterAction && l.action !== filterAction) return false;
    if (filterSem && (l.semester||'') !== filterSem) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!String(l.studentId).includes(q) &&
          !String(l.studentName||'').toLowerCase().includes(q) &&
          !String(l.by||'').toLowerCase().includes(q) &&
          !String(l.courseCode||'').includes(q)) return false;
    }
    return true;
  });

  const doClear = async () => {
    await window.API.clearLogs();
    setConfirmClear(false);
    toast('ล้างประวัติแล้ว', 'success');
    load();
  };

  const actionMeta = {
    'เปลี่ยนสถานะ': { color:'#0284c7', bg:'#f0f9ff' },
    'แก้ไขเกรด':   { color:'#7c3aed', bg:'#f5f3ff' },
  };

  return (
    <div style={{ padding:'28px 28px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6, flexWrap:'wrap', gap:12 }}>
        <div style={{ fontSize:20, fontWeight:700, color:'var(--text)' }}>🕓 ประวัติการแก้ไข (Audit Log)</div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={load} style={{ padding:'7px 14px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', cursor:'pointer', fontSize:13, fontFamily:'Sarabun', color:'var(--text)' }}>🔄 รีเฟรช</button>
          {logs.length > 0 && <button onClick={()=>setConfirmClear(true)} style={{ padding:'7px 14px', borderRadius:8, border:'1px solid #fca5a5', background:'var(--surface)', color:'#dc2626', cursor:'pointer', fontSize:13, fontFamily:'Sarabun' }}>🗑️ ล้างประวัติ</button>}
        </div>
      </div>
      <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:20 }}>บันทึกทุกครั้งที่มีการเปลี่ยนสถานะหรือแก้ไขเกรด — ใคร ทำอะไร เมื่อไหร่</div>

      {/* Filters */}
      <Card style={{ padding:'14px 18px', marginBottom:18 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:12 }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 ค้นหา รหัส/ชื่อ/ผู้ทำ" style={{ padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:14, fontFamily:'Sarabun', outline:'none' }} />
          <select value={filterAction} onChange={e=>setFilterAction(e.target.value)} style={{ padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:14, fontFamily:'Sarabun', background:'var(--surface)', outline:'none' }}>
            <option value="">ทุกประเภท</option>
            <option value="เปลี่ยนสถานะ">เปลี่ยนสถานะ</option>
            <option value="แก้ไขเกรด">แก้ไขเกรด</option>
          </select>
          <select value={filterSem} onChange={e=>setFilterSem(e.target.value)} style={{ padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:14, fontFamily:'Sarabun', background:'var(--surface)', outline:'none' }}>
            <option value="">ทุกภาคเรียน</option>
            {semesters.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </Card>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <EmptyState icon="🕓" title="ยังไม่มีประวัติการแก้ไข" sub={logs.length === 0 ? 'เมื่อมีการเปลี่ยนสถานะหรือแก้เกรด รายการจะปรากฏที่นี่' : 'ลองปรับตัวกรองใหม่'} />
      ) : (
        <Card style={{ overflow:'hidden' }}>
          <div style={{ padding:'10px 18px', borderBottom:'1px solid var(--border-soft)', fontSize:13, color:'var(--text-muted)' }}>แสดง {filtered.length} รายการ</div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
              <thead><tr style={{ background:'var(--surface-2)' }}>
                {['เวลา','ประเภท','นักศึกษา','รายวิชา','จาก','→','เป็น','ผู้ดำเนินการ'].map((h,i)=>(
                  <th key={i} style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:'var(--text-muted)', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.map((l, i) => {
                  const m = actionMeta[l.action] || { color:'#6b7280', bg:'var(--surface-2)' };
                  return (
                    <tr key={i} style={{ borderBottom:'1px solid var(--border-soft)' }}>
                      <td style={{ padding:'9px 14px', fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{fmtDateTime(l.timestamp)}</td>
                      <td style={{ padding:'9px 14px' }}><span style={{ background:m.bg, color:m.color, padding:'2px 10px', borderRadius:20, fontSize:12, fontWeight:600, whiteSpace:'nowrap' }}>{l.action}</span></td>
                      <td style={{ padding:'9px 14px' }}>
                        <div style={{ fontWeight:500, color:'var(--text)' }}>{l.studentName || '—'}</div>
                        <div style={{ fontSize:11, color:'var(--text-dim)', fontFamily:'monospace' }}>{l.studentId}</div>
                      </td>
                      <td style={{ padding:'9px 14px', fontSize:13, color:'var(--text-muted)' }}>
                        <span style={{ fontFamily:'monospace', fontSize:12 }}>{l.courseCode}</span> {l.section && <span style={{color:'var(--text-dim)'}}>/{l.section}</span>}
                      </td>
                      <td style={{ padding:'9px 14px', fontSize:13, color:'var(--text-dim)' }}>{l.from || '—'}</td>
                      <td style={{ padding:'9px 14px', color:'var(--text-dim)' }}>→</td>
                      <td style={{ padding:'9px 14px', fontSize:13, fontWeight:600, color:m.color }}>{l.to || '—'}</td>
                      <td style={{ padding:'9px 14px', fontSize:13, color:'var(--text)' }}>{l.by || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ConfirmDialog open={confirmClear} title="ล้างประวัติทั้งหมด?" message="การกระทำนี้จะลบประวัติการแก้ไขทั้งหมดอย่างถาวร ไม่สามารถกู้คืนได้" danger onConfirm={doClear} onCancel={()=>setConfirmClear(false)} />
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// 2) CROSS-TERM COMPARISON
// ════════════════════════════════════════════════════════════════
const AdminCompare = ({ user }) => {
  const [students, setStudents] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    window.API.getStudents({}).then(r => { setStudents(r.data || []); setLoading(false); });
  }, []);

  const semesters = React.useMemo(() => sortSemestersDesc([...new Set(students.map(s => s.semester).filter(Boolean))]), [students]);

  // Per-semester summary
  const bySem = React.useMemo(() => {
    const map = {};
    semesters.forEach(sem => {
      const list = students.filter(s => s.semester === sem);
      const done = list.filter(s => s.status === 'เสร็จสิ้น').length;
      map[sem] = {
        total: list.length,
        done,
        pending: list.length - done,
        absent: list.filter(s => s.cause === 'ขาดสอบ').length,
        incomplete: list.filter(s => s.cause === 'ส่งงานไม่ครบ').length,
        pct: list.length ? Math.round(done / list.length * 100) : 0,
      };
    });
    return map;
  }, [students, semesters]);

  // Top courses with recurring I across terms
  const courseTrend = React.useMemo(() => {
    const map = {}; // courseCode -> { courseName, perSem: {sem: count}, total }
    students.forEach(s => {
      if (!map[s.courseCode]) map[s.courseCode] = { courseCode: s.courseCode, courseName: s.courseName, perSem: {}, total: 0 };
      map[s.courseCode].perSem[s.semester] = (map[s.courseCode].perSem[s.semester] || 0) + 1;
      map[s.courseCode].total++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 12);
  }, [students]);

  const maxTotal = Math.max(1, ...semesters.map(s => bySem[s]?.total || 0));

  if (loading) return <div style={{ padding:32 }}><Spinner /></div>;

  if (semesters.length === 0) {
    return <div style={{ padding:'28px' }}><div style={{ fontSize:20, fontWeight:700, color:'var(--text)', marginBottom:24 }}>📈 เปรียบเทียบเทอม</div>
      <EmptyState icon="📈" title="ยังไม่มีข้อมูลให้เปรียบเทียบ" sub="นำเข้าข้อมูลนักศึกษาอย่างน้อย 1 ภาคเรียนก่อน" /></div>;
  }

  return (
    <div style={{ padding:'28px 28px' }}>
      <div style={{ fontSize:20, fontWeight:700, color:'var(--text)', marginBottom:6 }}>📈 เปรียบเทียบข้ามภาคเรียน</div>
      <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:24 }}>ดูแนวโน้มจำนวนนักศึกษาติด I และวิชาที่ติดซ้ำบ่อยในแต่ละเทอม</div>

      {/* Per-semester cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14, marginBottom:24 }}>
        {semesters.map(sem => {
          const d = bySem[sem];
          return (
            <Card key={sem} style={{ padding:'18px 20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <span style={{ fontWeight:700, fontSize:16, color:'var(--text)' }}>{sem}</span>
                <span style={{ fontSize:12, color:'#16a34a', fontWeight:600 }}>{d.pct}% เสร็จ</span>
              </div>
              <div style={{ fontSize:30, fontWeight:700, color:'#0d2c6b', lineHeight:1 }}>{d.total}<span style={{ fontSize:14, color:'var(--text-dim)', fontWeight:400 }}> คนติด I</span></div>
              <div style={{ height:8, background:'var(--surface-2)', borderRadius:6, overflow:'hidden', margin:'12px 0 10px' }}>
                <div style={{ height:'100%', width:`${d.pct}%`, background:'linear-gradient(90deg,#16a34a,#4ade80)' }}></div>
              </div>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap', fontSize:12, color:'var(--text-muted)' }}>
                <span>📋 ขาดสอบ {d.absent}</span>
                <span>📝 ส่งงานไม่ครบ {d.incomplete}</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Bar chart: total per semester */}
      <Card style={{ padding:'20px 24px', marginBottom:24 }}>
        <div style={{ fontWeight:700, color:'var(--text)', marginBottom:18 }}>จำนวนนักศึกษาติด I แต่ละเทอม</div>
        <div style={{ display:'flex', alignItems:'flex-end', gap:24, height:200, paddingLeft:8 }}>
          {sortSemestersDesc(semesters).slice().reverse().map(sem => {
            const d = bySem[sem];
            const h = Math.round((d.total / maxTotal) * 160);
            const dh = d.total ? Math.round((d.done / d.total) * h) : 0;
            return (
              <div key={sem} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', maxWidth:90 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:6 }}>{d.total}</div>
                <div style={{ width:'100%', maxWidth:56, height:h, minHeight:4, background:'#dbeafe', borderRadius:'6px 6px 0 0', position:'relative', overflow:'hidden' }} title={`เสร็จ ${d.done}/${d.total}`}>
                  <div style={{ position:'absolute', bottom:0, left:0, right:0, height:dh, background:'linear-gradient(180deg,#16a34a,#22c55e)' }}></div>
                </div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:8, whiteSpace:'nowrap' }}>{sem}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display:'flex', gap:16, marginTop:16, fontSize:12, color:'var(--text-muted)' }}>
          <span style={{ display:'flex', alignItems:'center', gap:6 }}><span style={{ width:10, height:10, background:'#16a34a', borderRadius:2 }}></span>เสร็จสิ้น</span>
          <span style={{ display:'flex', alignItems:'center', gap:6 }}><span style={{ width:10, height:10, background:'#dbeafe', borderRadius:2 }}></span>ยังค้าง</span>
        </div>
      </Card>

      {/* Course recurrence matrix */}
      <Card style={{ overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border-soft)', fontWeight:700, color:'var(--text)' }}>🔁 วิชาที่ติด I บ่อย (Top {courseTrend.length})</div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
            <thead><tr style={{ background:'var(--surface-2)' }}>
              <th style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:'var(--text-muted)', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>รหัสวิชา</th>
              <th style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:'var(--text-muted)', borderBottom:'1px solid var(--border)' }}>ชื่อวิชา</th>
              {sortSemestersDesc(semesters).map(sem => (
                <th key={sem} style={{ padding:'10px 14px', textAlign:'center', fontSize:12, fontWeight:600, color:'var(--text-muted)', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>{sem}</th>
              ))}
              <th style={{ padding:'10px 14px', textAlign:'center', fontSize:12, fontWeight:600, color:'var(--text-muted)', borderBottom:'1px solid var(--border)' }}>รวม</th>
            </tr></thead>
            <tbody>
              {courseTrend.map((c, i) => (
                <tr key={i} style={{ borderBottom:'1px solid var(--border-soft)' }}>
                  <td style={{ padding:'9px 14px', fontFamily:'monospace', fontSize:12 }}>{c.courseCode}</td>
                  <td style={{ padding:'9px 14px', maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--text)' }}>{c.courseName || '—'}</td>
                  {sortSemestersDesc(semesters).map(sem => {
                    const v = c.perSem[sem] || 0;
                    return <td key={sem} style={{ padding:'9px 14px', textAlign:'center' }}>
                      {v > 0
                        ? <span style={{ display:'inline-block', minWidth:26, padding:'2px 8px', borderRadius:20, fontSize:12, fontWeight:700, background:`rgba(220,38,38,${Math.min(0.12 + v*0.06, 0.5)})`, color:'#dc2626' }}>{v}</span>
                        : <span style={{ color:'var(--border)' }}>·</span>}
                    </td>;
                  })}
                  <td style={{ padding:'9px 14px', textAlign:'center', fontWeight:700, color:'#0d2c6b' }}>{c.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// 3) EXPORT REPORTS (Excel / PDF)
// ════════════════════════════════════════════════════════════════
const AdminReports = ({ user }) => {
  const [students, setStudents] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [semester, setSemester] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const toast = useToast();

  React.useEffect(() => {
    window.API.getStudents({}).then(r => {
      const data = r.data || [];
      setStudents(data);
      const sems = sortSemestersDesc([...new Set(data.map(s => s.semester).filter(Boolean))]);
      setSemester(sems[0] || '');
      setLoading(false);
    });
  }, []);

  const semesters = React.useMemo(() => sortSemestersDesc([...new Set(students.map(s => s.semester).filter(Boolean))]), [students]);

  const rows = React.useMemo(() => {
    let list = students.filter(s => !semester || s.semester === semester);
    if (statusFilter) list = list.filter(s => s.status === statusFilter);
    return list;
  }, [students, semester, statusFilter]);

  const COLS = [
    { key:'studentId',   label:'รหัสนักศึกษา' },
    { key:'studentName', label:'ชื่อ-สกุล' },
    { key:'courseCode',  label:'รหัสวิชา' },
    { key:'courseName',  label:'ชื่อวิชา' },
    { key:'section',     label:'หมู่' },
    { key:'teacher',     label:'อาจารย์ผู้สอน' },
    { key:'bracketGrade',label:'เกรด I เดิม' },
    { key:'cause',       label:'สาเหตุ' },
    { key:'examScore',   label:'คะแนนสอบรอบ 2' },
    { key:'newGrade',    label:'เกรดใหม่' },
    { key:'status',      label:'สถานะ' },
  ];

  const exportExcel = () => {
    if (rows.length === 0) { toast('ไม่มีข้อมูลให้ส่งออก', 'error'); return; }
    const XLSX = window.XLSX;
    const aoa = [COLS.map(c => c.label)];
    rows.forEach(r => aoa.push(COLS.map(c => r[c.key] ?? '')));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = COLS.map(c => ({ wch: c.key === 'courseName' ? 36 : c.key === 'studentName' ? 22 : c.key === 'teacher' ? 24 : 14 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'รายงานเกรด I');
    XLSX.writeFile(wb, `รายงานเกรด-I_${(semester||'all').replace('/','-')}.xlsx`);
    toast('ส่งออก Excel เรียบร้อย ✅', 'success');
  };

  const exportPDF = () => {
    if (rows.length === 0) { toast('ไม่มีข้อมูลให้ส่งออก', 'error'); return; }
    const win = window.open('', '_blank');
    const head = COLS.map(c => `<th>${c.label}</th>`).join('');
    const body = rows.map(r => `<tr>${COLS.map(c => `<td>${r[c.key] ?? ''}</td>`).join('')}</tr>`).join('');
    win.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">
      <title>รายงานเกรด I ${semester}</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        body { font-family: 'Sarabun', sans-serif; color:#111; }
        h1 { font-size:18px; text-align:center; margin:0; }
        .sub { text-align:center; font-size:13px; color:#555; margin:4px 0 16px; }
        table { width:100%; border-collapse:collapse; font-size:11px; }
        th,td { border:1px solid #999; padding:5px 6px; text-align:left; }
        th { background:#f0f0f0; }
        .foot { margin-top:24px; font-size:12px; display:flex; justify-content:space-between; }
      </style>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
      </head><body>
      <h1>รายงานสรุปนักศึกษาที่ติดเกรด I</h1>
      <div class="sub">งานวิชาศึกษาทั่วไป มหาวิทยาลัยราชภัฏพระนคร • ภาคเรียน ${semester || 'ทั้งหมด'} • รวม ${rows.length} รายการ</div>
      <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
      <div class="foot"><span>ออกรายงานเมื่อ ${new Date().toLocaleString('th-TH')}</span><span>ผู้ออกรายงาน: ${user?.displayName || '________'}</span></div>
      <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 400); };<\/script>
      </body></html>`);
    win.document.close();
    toast('เปิดหน้าพิมพ์ PDF แล้ว', 'info');
  };

  if (loading) return <div style={{ padding:32 }}><Spinner /></div>;

  const doneCount = rows.filter(r => r.status === 'เสร็จสิ้น').length;

  return (
    <div style={{ padding:'28px 28px', maxWidth:880 }}>
      <div style={{ fontSize:20, fontWeight:700, color:'var(--text)', marginBottom:6 }}>📤 ออกรายงาน</div>
      <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:24 }}>ส่งออกรายงานสรุปสำหรับส่งกองบริการการศึกษา (Excel หรือ PDF)</div>

      <Card style={{ padding:'20px 24px', marginBottom:20 }}>
        <div style={{ fontWeight:700, color:'var(--text)', marginBottom:14 }}>ตัวเลือกรายงาน</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14, marginBottom:18 }}>
          <div>
            <label style={{ fontSize:13, fontWeight:600, color:'var(--text)', display:'block', marginBottom:6 }}>ภาคการศึกษา</label>
            <select value={semester} onChange={e=>setSemester(e.target.value)} style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:14, fontFamily:'Sarabun', background:'var(--surface)', outline:'none' }}>
              <option value="">ทุกภาคเรียน</option>
              {semesters.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:13, fontWeight:600, color:'var(--text)', display:'block', marginBottom:6 }}>กรองตามสถานะ</label>
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:14, fontFamily:'Sarabun', background:'var(--surface)', outline:'none' }}>
              <option value="">ทุกสถานะ</option>
              {Object.keys(STATUS_META).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display:'flex', gap:16, padding:'12px 16px', background:'var(--surface-2)', borderRadius:10, fontSize:13, color:'var(--text-muted)' }}>
          <span>📊 พบ <strong style={{ color:'var(--text)' }}>{rows.length}</strong> รายการ</span>
          <span>✅ เสร็จสิ้น <strong style={{ color:'#16a34a' }}>{doneCount}</strong></span>
          <span>⏳ ค้าง <strong style={{ color:'#d97706' }}>{rows.length - doneCount}</strong></span>
        </div>
      </Card>

      <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
        <button onClick={exportExcel} style={{ flex:1, minWidth:200, padding:'16px', borderRadius:12, border:'1px solid #16a34a', background:'var(--surface)', cursor:'pointer', fontFamily:'Sarabun', display:'flex', alignItems:'center', gap:14, textAlign:'left' }}>
          <span style={{ fontSize:32 }}>📗</span>
          <div><div style={{ fontWeight:700, fontSize:15, color:'var(--text)' }}>ส่งออก Excel</div><div style={{ fontSize:12, color:'var(--text-muted)' }}>ไฟล์ .xlsx แก้ไขต่อได้</div></div>
        </button>
        <button onClick={exportPDF} style={{ flex:1, minWidth:200, padding:'16px', borderRadius:12, border:'1px solid #dc2626', background:'var(--surface)', cursor:'pointer', fontFamily:'Sarabun', display:'flex', alignItems:'center', gap:14, textAlign:'left' }}>
          <span style={{ fontSize:32 }}>📕</span>
          <div><div style={{ fontWeight:700, fontSize:15, color:'var(--text)' }}>ส่งออก PDF</div><div style={{ fontSize:12, color:'var(--text-muted)' }}>เปิดหน้าพิมพ์ → บันทึกเป็น PDF</div></div>
        </button>
      </div>

      {/* Preview */}
      {rows.length > 0 && (
        <Card style={{ overflow:'hidden', marginTop:20 }}>
          <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--border-soft)', fontSize:13, fontWeight:600, color:'var(--text)' }}>ตัวอย่างข้อมูล (10 รายการแรก)</div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'var(--surface-2)' }}>
                {COLS.slice(0,7).map(c => <th key={c.key} style={{ padding:'8px 12px', textAlign:'left', fontSize:11, fontWeight:600, color:'var(--text-muted)', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>{c.label}</th>)}
              </tr></thead>
              <tbody>
                {rows.slice(0,10).map((r,i) => (
                  <tr key={i} style={{ borderBottom:'1px solid var(--border-soft)' }}>
                    {COLS.slice(0,7).map(c => <td key={c.key} style={{ padding:'8px 12px', color:'var(--text)', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r[c.key] ?? '—'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

Object.assign(window, { AdminLog, AdminCompare, AdminReports });
