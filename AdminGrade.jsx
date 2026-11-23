// AdminGrade.jsx — บันทึกเกรดใหม่ที่ได้รับจากอาจารย์

const GRADE_OPTIONS = ['A','B+','B','C+','C','D+','D','E'];

const AdminGrade = ({ user }) => {
  const [students, setStudents]   = React.useState([]);
  const [loading, setLoading]     = React.useState(true);
  const [filterSemester, setFilterSemester] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState('รออาจารย์แก้เกรด');
  const [filterCause, setFilterCause]   = React.useState('');
  const [filterCourse, setFilterCourse] = React.useState('');
  const [search, setSearch]       = React.useState('');
  const [editing, setEditing]     = React.useState(null);
  const [editGrade, setEditGrade] = React.useState('');
  const [editNotes, setEditNotes] = React.useState('');
  const [saving, setSaving]       = React.useState(false);
  const toast = useToast();

  const loadStudents = () => {
    setLoading(true);
    window.API.getStudents({}).then(res => {
      const data = res.data || [];
      setStudents(data);
      const sems = [...new Set(data.map(s => s.semester).filter(Boolean))].sort(window.compareSemestersDesc);
      setFilterSemester(prev => (prev && sems.includes(prev)) ? prev : (sems[0] || ''));
      setLoading(false);
    }).catch(() => { setStudents([]); setLoading(false); toast('โหลดข้อมูลนักศึกษาไม่สำเร็จ', 'error'); });
  };
  React.useEffect(loadStudents, []);

  const semesters = React.useMemo(() => {
    return [...new Set(students.map(s => s.semester).filter(Boolean))].sort(window.compareSemestersDesc);
  }, [students]);

  const courses = React.useMemo(() => {
    const seen = new Set();
    return students
      .filter(s => !filterSemester || s.semester === filterSemester)
      .filter(s => {
        const key = s.courseCode + '_' + s.section;
        if (seen.has(key)) return false;
        seen.add(key); return true;
      }).map(s => ({ courseCode: s.courseCode, courseName: s.courseName, section: s.section }));
  }, [students, filterSemester]);

  const filtered = React.useMemo(() => {
    let list = [...students];
    if (filterSemester) list = list.filter(s => s.semester === filterSemester);
    if (filterStatus)   list = list.filter(s => s.status === filterStatus);
    if (filterCause)    list = list.filter(s => s.cause === filterCause);
    if (filterCourse)   list = list.filter(s => (s.courseCode+'_'+s.section) === filterCourse);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        String(s.studentId).includes(q) ||
        (s.studentName || '').toLowerCase().includes(q) ||
        (s.courseCode || '').includes(q)
      );
    }
    return list;
  }, [students, filterSemester, filterStatus, filterCause, filterCourse, search]);

  const openEdit = (s) => {
    setEditing(s);
    setEditGrade(s.newGrade || '');
    setEditNotes(s.notes || '');
  };

  const saveGrade = async () => {
    if (!editGrade) { toast('กรุณาเลือกเกรดใหม่', 'error'); return; }
    setSaving(true);
    try {
      const res = await window.API.updateStatus({
        studentId:        editing.studentId,
        courseCode:       editing.courseCode,
        section:          editing.section,
        semester:         editing.semester,
        status:           'เสร็จสิ้น',
        newGrade:         editGrade,
        notes:            editNotes,
        by:               user.displayName,
      });
      if (res.success) {
        setStudents(prev => prev.map(s =>
          s.studentId === editing.studentId &&
          s.courseCode === editing.courseCode &&
          s.section    === editing.section
          && s.semester === editing.semester
            ? { ...s, status: 'เสร็จสิ้น', newGrade: editGrade, notes: editNotes }
            : s
        ));
        toast(`บันทึกเกรดใหม่ "${editGrade}" สำเร็จ ✅`, 'success');
        setEditing(null);
      } else {
        toast(res.error || 'เกิดข้อผิดพลาด', 'error');
      }
    } catch { toast('เกิดข้อผิดพลาดในการบันทึก', 'error'); }
    setSaving(false);
  };

  // Summary stats (within selected semester)
  const semStudents = filterSemester ? students.filter(s => s.semester === filterSemester) : students;
  const pendingCount = semStudents.filter(s => s.status === 'รออาจารย์แก้เกรด').length;
  const gradedCount  = semStudents.filter(s => s.newGrade).length;
  const doneCount    = semStudents.filter(s => s.status === 'เสร็จสิ้น').length;

  return (
    <div style={{ padding:'28px 28px', fontFamily:'Sarabun, sans-serif' }}>

      {/* Header */}
      <div style={{ marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700, color:'var(--text)', marginBottom:4 }}>📝 แก้ไขเกรด</div>
          <div style={{ fontSize:14, color:'var(--text-muted)' }}>บันทึกเกรดใหม่ที่ได้รับจากอาจารย์ผู้สอน — ระบบจะเปลี่ยนสถานะเป็น "เสร็จสิ้น" โดยอัตโนมัติ</div>
        </div>
        <div>
          <label style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)', display:'block', marginBottom:4 }}>ภาคการศึกษา</label>
          <select value={filterSemester} onChange={e=>setFilterSemester(e.target.value)} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', fontSize:14, fontFamily:'Sarabun', backgroundColor:'var(--surface)', minWidth:160 }}>
            {semesters.length === 0 && <option value="">— ไม่มีข้อมูล —</option>}
            {semesters.map(s => <option key={s} value={s}>ภาค {s}</option>)}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:14, marginBottom:24 }}>
        <StatCard label="รออาจารย์แก้เกรด" value={pendingCount} icon="⏳" color="#7c3aed" />
        <StatCard label="บันทึกเกรดแล้ว"   value={gradedCount}  icon="📝" color="#0284c7" />
        <StatCard label="เสร็จสิ้น"          value={doneCount}    icon="✅" color="#16a34a" />
      </div>

      {/* Filters */}
      <Card style={{ padding:'14px 16px', marginBottom:18 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:10 }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 ค้นหาชื่อ / รหัส..."
            style={{ padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:14, fontFamily:'Sarabun', outline:'none' }}
          />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:14, fontFamily:'Sarabun', backgroundColor:'var(--surface)', outline:'none' }}>
            <option value="">ทุกสถานะ</option>
            <option value="รออาจารย์แก้เกรด">รออาจารย์แก้เกรด</option>
            <option value="เสร็จสิ้น">เสร็จสิ้น</option>
            <option value="รอดำเนินการ">รอดำเนินการ</option>
            <option value="ส่งงานแล้ว">ส่งงานแล้ว</option>
          </select>
          <select value={filterCause} onChange={e => setFilterCause(e.target.value)} style={{ padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:14, fontFamily:'Sarabun', backgroundColor:'var(--surface)', outline:'none' }}>
            <option value="">ทุกสาเหตุ</option>
            <option value="ขาดสอบ">ขาดสอบ</option>
            <option value="ส่งงานไม่ครบ">ส่งงานไม่ครบ</option>
          </select>
          <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)} style={{ padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:14, fontFamily:'Sarabun', backgroundColor:'var(--surface)', outline:'none' }}>
            <option value="">ทุกรายวิชา</option>
            {courses.map(c => (
              <option key={c.courseCode+'_'+c.section} value={c.courseCode+'_'+c.section}>
                {c.courseCode} หมู่{c.section}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Table */}
      {loading ? <Spinner /> : filtered.length === 0 ? (
        <EmptyState icon="📝" title="ไม่พบข้อมูล" sub="ลองปรับตัวกรองใหม่" />
      ) : (
        <Card style={{ overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
              <thead>
                <tr style={{ background:'var(--surface-2)' }}>
                  {['รหัสนักศึกษา','ชื่อ-สกุล','วิชา / หมู่','อาจารย์','เกรด I เดิม','สาเหตุ','คะแนนสอบรอบ 2','สถานะ','เกรดใหม่',''].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:'var(--text-muted)', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={i}
                    style={{ borderBottom:'1px solid var(--border-soft)' }}
                    onMouseEnter={e => e.currentTarget.style.background='var(--surface-2)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}
                  >
                    <td style={{ padding:'10px 14px', fontFamily:'monospace', fontSize:12, color:'var(--text)' }}>{s.studentId}</td>
                    <td style={{ padding:'10px 14px', fontWeight:500, color:'var(--text)', maxWidth:150, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {s.studentName || <span style={{ color:'var(--text-dim)', fontSize:12 }}>ยังไม่ระบุ</span>}
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <div style={{ fontSize:13, fontFamily:'monospace' }}>{s.courseCode}</div>
                      <div style={{ fontSize:11, color:'var(--text-dim)' }}>หมู่ {s.section}</div>
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:13, color:'var(--text)', maxWidth:110, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.teacher || '—'}</td>
                    <td style={{ padding:'10px 14px' }}><GradeBadge grade={s.bracketGrade} /></td>
                    <td style={{ padding:'10px 14px' }}><CauseBadge cause={s.cause} /></td>
                    <td style={{ padding:'10px 14px', fontSize:13 }}>
                      {s.examScore
                        ? <span style={{ color:'#0284c7', fontWeight:600 }}>{s.examScore}<br/><span style={{ fontSize:11, color:'var(--text-dim)' }}>={window.formatExamScore(s)}</span></span>
                        : <span style={{ color:'var(--text-dim)' }}>—</span>}
                    </td>
                    <td style={{ padding:'10px 14px' }}><StatusBadge status={s.status} /></td>
                    <td style={{ padding:'10px 14px' }}>
                      {s.newGrade
                        ? <span style={{ background:'#f0fdf4', color:'#16a34a', padding:'3px 12px', borderRadius:8, fontWeight:700, fontSize:14, border:'1px solid #86efac' }}>{s.newGrade}</span>
                        : <span style={{ color:'var(--text-dim)', fontSize:12 }}>ยังไม่บันทึก</span>}
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <button onClick={() => openEdit(s)} style={{
                        padding:'5px 14px', borderRadius:6,
                        border:`1px solid ${s.newGrade ? 'var(--text-muted)' : '#7c3aed'}`,
                        backgroundColor:'var(--surface)',
                        color: s.newGrade ? 'var(--text-muted)' : '#7c3aed',
                        cursor:'pointer', fontSize:12, fontFamily:'Sarabun', fontWeight:600, whiteSpace:'nowrap'
                      }}>
                        {s.newGrade ? '✏️ แก้ไข' : '+ บันทึกเกรด'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Grade Edit Modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="บันทึกเกรดใหม่จากอาจารย์" width={500}>
        {editing && (
          <div>
            {/* Student info card */}
            <div style={{ background:'var(--surface-3)', borderRadius:10, padding:'14px 16px', marginBottom:20, border:'1px solid #e0e7ff' }}>
              <div style={{ fontWeight:700, fontSize:15, color:'var(--text)' }}>{editing.studentName || editing.studentId}</div>
              <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:3 }}>
                {editing.courseName} • หมู่ {editing.section} • {editing.teacher || '—'}
              </div>
              <div style={{ display:'flex', gap:8, marginTop:8, alignItems:'center', flexWrap:'wrap' }}>
                <span style={{ fontSize:12, color:'var(--text-muted)' }}>เกรด I เดิม:</span>
                <GradeBadge grade={editing.bracketGrade} />
                <CauseBadge cause={editing.cause} />
              </div>
              {editing.examScore && (
                <div style={{ fontSize:12, color:'#0284c7', marginTop:6 }}>
                  📊 คะแนนสอบปลายภาครอบ 2: <strong>{editing.examScore}</strong> ({window.formatExamScore(editing)})
                </div>
              )}
            </div>

            {/* Grade selector grid */}
            <label style={{ fontSize:13, fontWeight:600, color:'var(--text)', display:'block', marginBottom:10 }}>
              เกรดใหม่ที่ได้รับจากอาจารย์
            </label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:18 }}>
              {GRADE_OPTIONS.map(g => {
                const col = GRADE_COLORS[g] || 'var(--text)';
                const active = editGrade === g;
                return (
                  <button key={g} onClick={() => setEditGrade(g)} style={{
                    padding:'14px 0', borderRadius:8,
                    border:`2px solid ${active ? col : 'var(--border)'}`,
                    background: active ? col + '18' : 'var(--surface-2)',
                    color: active ? col : 'var(--text)',
                    fontWeight: active ? 700 : 500, fontSize:17,
                    cursor:'pointer', fontFamily:'Sarabun', transition:'all .1s',
                  }}>{g}</button>
                );
              })}
            </div>

            <label style={{ fontSize:13, fontWeight:600, color:'var(--text)', display:'block', marginBottom:6 }}>
              บันทึกเพิ่มเติม (เช่น วันที่รับเอกสาร)
            </label>
            <textarea
              value={editNotes} onChange={e => setEditNotes(e.target.value)}
              placeholder="เช่น อาจารย์ส่งเอกสารวันที่ 15 พ.ค. 2568..."
              rows={3}
              style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:14, fontFamily:'Sarabun', resize:'vertical', outline:'none', boxSizing:'border-box' }}
            />

            <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, padding:'10px 14px', marginTop:14, fontSize:12, color:'#92400e' }}>
              💡 การบันทึกเกรดจะเปลี่ยนสถานะเป็น <strong>"เสร็จสิ้น"</strong> โดยอัตโนมัติ
            </div>

            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:20 }}>
              <button onClick={() => setEditing(null)} style={{ padding:'9px 20px', borderRadius:8, border:'1px solid var(--border)', backgroundColor:'var(--surface)', cursor:'pointer', fontFamily:'Sarabun', fontSize:14 }}>ยกเลิก</button>
              <button onClick={saveGrade} disabled={saving || !editGrade} style={{
                padding:'9px 24px', borderRadius:8, border:'none',
                background: (!editGrade || saving) ? 'var(--text-dim)' : '#7c3aed',
                color:'#fff', cursor: (!editGrade || saving) ? 'not-allowed' : 'pointer',
                fontFamily:'Sarabun', fontSize:14, fontWeight:700
              }}>
                {saving ? 'กำลังบันทึก...' : `บันทึกเกรด ${editGrade || '—'}`}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

Object.assign(window, { AdminGrade, GRADE_OPTIONS });
