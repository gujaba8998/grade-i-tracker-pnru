// Admin Students - filterable list with semester tabs, checkboxes, bulk actions

const AdminStudents = ({ user }) => {
  const [students, setStudents] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [filterSemester, setFilterSemester] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState('');
  const [filterCause, setFilterCause] = React.useState('');
  const [filterCourse, setFilterCourse] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [checkedIds, setCheckedIds] = React.useState(new Set()); // row keys
  const [selected, setSelected] = React.useState(null); // single edit
  const [bulkOpen, setBulkOpen] = React.useState(false); // bulk modal
  const [editStatus, setEditStatus] = React.useState('');
  const [editNotes, setEditNotes] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [sortCol, setSortCol] = React.useState('studentName');
  const [sortDir, setSortDir] = React.useState(1);
  const toast = useToast();

  // Row key helper (composite — student+course+section is unique)
  const rowKey = (s) => `${s.semester}_${s.studentId}_${s.courseCode}_${s.section}`;

  const loadStudents = () => {
    setLoading(true);
    window.API.getStudents({}).then(res => {
      const data = res.data || [];
      setStudents(data);
      setCheckedIds(new Set());
      // Auto-pick newest semester if none selected yet (or invalid)
      const sems = [...new Set(data.map(s => s.semester).filter(Boolean))].sort(window.compareSemestersDesc);
      setFilterSemester(prev => (prev && sems.includes(prev)) ? prev : (sems[0] || ''));
      setLoading(false);
    }).catch(() => { setStudents([]); setLoading(false); toast('โหลดข้อมูลนักศึกษาไม่สำเร็จ', 'error'); });
  };
  React.useEffect(loadStudents, []);

  // ── Derived: list of all semesters present ──
  const semesters = React.useMemo(() => {
    const set = new Set();
    students.forEach(s => s.semester && set.add(s.semester));
    return [...set].sort(window.compareSemestersDesc); // newest first
  }, [students]);

  // ── Derived: courses limited by selected semester ──
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

  // ── Derived: filtered list ──
  const filtered = React.useMemo(() => {
    let list = [...students];
    if (filterSemester) list = list.filter(s => s.semester === filterSemester);
    if (filterStatus)   list = list.filter(s => s.status === filterStatus);
    if (filterCause)    list = list.filter(s => s.cause === filterCause);
    if (filterCourse)   list = list.filter(s => (s.courseCode+'_'+s.section) === filterCourse);
    if (search) {
      const q = String(search).trim().toLocaleLowerCase('th-TH');
      const matches = (value) => String(value == null ? '' : value).toLocaleLowerCase('th-TH').includes(q);
      list = list.filter(s =>
        matches(s.studentId) || matches(s.studentName) ||
        matches(s.courseCode) || matches(s.courseName)
      );
    }
    list.sort((a, b) => {
      const va = a[sortCol] || '';
      const vb = b[sortCol] || '';
      return String(va).localeCompare(String(vb), 'th') * sortDir;
    });
    return list;
  }, [students, filterSemester, filterStatus, filterCause, filterCourse, search, sortCol, sortDir]);

  // Clear checks when filter changes (avoid editing hidden rows by accident)
  React.useEffect(() => { setCheckedIds(new Set()); },
    [filterSemester, filterStatus, filterCause, filterCourse, search]);

  // ── Checkbox handlers ──
  const toggleOne = (key) => setCheckedIds(prev => {
    const s = new Set(prev);
    s.has(key) ? s.delete(key) : s.add(key);
    return s;
  });
  const filteredKeys = filtered.map(rowKey);
  const allChecked = filteredKeys.length > 0 && filteredKeys.every(k => checkedIds.has(k));
  const someChecked = filteredKeys.some(k => checkedIds.has(k)) && !allChecked;
  const toggleAll = () => {
    if (allChecked) setCheckedIds(new Set());
    else setCheckedIds(new Set(filteredKeys));
  };

  // ── Single edit handlers ──
  const openEdit = (s) => {
    setSelected(s);
    setEditStatus(s.status || 'รอดำเนินการ');
    setEditNotes(s.notes || '');
  };
  const saveStatus = async () => {
    setSaving(true);
    try {
      const res = await window.API.updateStatus({
        studentId: selected.studentId,
        courseCode: selected.courseCode,
        section: selected.section,
        semester: selected.semester,
        status: editStatus,
        notes: editNotes,
        by: user.displayName,
      });
      if (res.success) {
        setStudents(prev => prev.map(s =>
          rowKey(s) === rowKey(selected)
            ? { ...s, status: editStatus, notes: editNotes }
            : s
        ));
        toast('อัปเดตสถานะเรียบร้อยแล้ว ✅', 'success');
        setSelected(null);
      } else toast(res.error || 'เกิดข้อผิดพลาด', 'error');
    } catch { toast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error'); }
    setSaving(false);
  };

  // ── Bulk edit handlers ──
  const openBulk = () => {
    setEditStatus('รออาจารย์แก้เกรด');
    setEditNotes('');
    setBulkOpen(true);
  };
  const saveBulk = async () => {
    if (!editStatus) { toast('กรุณาเลือกสถานะ', 'error'); return; }
    setSaving(true);
    const targets = students.filter(s => checkedIds.has(rowKey(s)));
    let okCount = 0, errCount = 0;
    for (const t of targets) {
      try {
        const res = await window.API.updateStatus({
          studentId: t.studentId, courseCode: t.courseCode, section: t.section, semester: t.semester,
          status: editStatus,
          notes: editNotes || t.notes || '',
          by: user.displayName,
        });
        if (res.success) okCount++; else errCount++;
      } catch { errCount++; }
    }
    // Update local state in one pass
    setStudents(prev => prev.map(s =>
      checkedIds.has(rowKey(s))
        ? { ...s, status: editStatus, notes: editNotes || s.notes }
        : s
    ));
    setSaving(false);
    setBulkOpen(false);
    setCheckedIds(new Set());
    if (errCount === 0) toast(`อัปเดต ${okCount} รายการเรียบร้อย ✅`, 'success');
    else toast(`สำเร็จ ${okCount} • ผิดพลาด ${errCount}`, errCount > 0 ? 'warning' : 'success');
  };

  // ── Bulk modal: status options ──
  // If all selected share the same cause, show only that cause's options; otherwise union
  const bulkSelected = students.filter(s => checkedIds.has(rowKey(s)));
  const bulkCauses = [...new Set(bulkSelected.map(s => s.cause))];
  let bulkStatusOptions;
  if (bulkCauses.length === 1) {
    bulkStatusOptions = STATUS_OPTIONS[bulkCauses[0]] || STATUS_OPTIONS['ส่งงานไม่ครบ'];
  } else {
    // union of all options, preserving order
    const seen = new Set();
    bulkStatusOptions = [];
    bulkCauses.forEach(c => (STATUS_OPTIONS[c] || []).forEach(o => {
      if (!seen.has(o)) { seen.add(o); bulkStatusOptions.push(o); }
    }));
  }

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => -d);
    else { setSortCol(col); setSortDir(1); }
  };
  const thStyle = (col) => ({
    padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:600,
    color:'var(--text-muted)', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap',
    cursor:'pointer', userSelect:'none',
    background: sortCol===col ? 'var(--brand-soft)' : 'var(--surface-2)',
  });

  const singleStatusOptions = selected ? (STATUS_OPTIONS[selected.cause] || STATUS_OPTIONS['ส่งงานไม่ครบ']) : [];

  return (
    <div style={{ padding:'28px 28px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:12 }}>
        <div style={{ fontSize:20, fontWeight:700, color:'var(--text)' }}>👥 รายชื่อนักศึกษา</div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ fontSize:13, color:'var(--text-muted)' }}>แสดง {filtered.length}/{students.length} รายการ</div>
          <button onClick={loadStudents} style={{ padding:'7px 14px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', cursor:'pointer', fontSize:13, fontFamily:'Sarabun' }}>🔄</button>
        </div>
      </div>

      {/* ── Semester tabs ── */}
      <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap', borderBottom:'1px solid var(--border)', paddingBottom:0 }}>
        {semesters.length === 0 && <div style={{ fontSize:13, color:'var(--text-dim)', padding:'8px 4px' }}>ยังไม่มีข้อมูล</div>}
        {semesters.map(sem => {
          const count = students.filter(s => s.semester === sem).length;
          const active = filterSemester === sem;
          return (
            <button key={sem} onClick={() => setFilterSemester(sem)} style={{
              padding:'9px 18px',
              border:'none', borderBottom: active ? '3px solid var(--brand)' : '3px solid transparent',
              background:'transparent', cursor:'pointer', fontFamily:'Sarabun',
              fontSize:14, fontWeight: active ? 700 : 500,
              color: active ? 'var(--brand)' : 'var(--text-muted)',
              display:'flex', alignItems:'center', gap:8,
              marginBottom:-1,
            }}>
              <span>ภาค {sem}</span>
              <span style={{ background: active ? 'var(--brand)' : 'var(--border)', color: active ? '#fff' : 'var(--text-muted)', padding:'1px 8px', borderRadius:10, fontSize:11, fontWeight:600 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Other Filters ── */}
      <Card style={{ padding:'14px 16px', marginBottom:16 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:10 }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 ค้นหา..." style={{ padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:14, fontFamily:'Sarabun', outline:'none' }} />
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:14, fontFamily:'Sarabun', background:'var(--surface)', outline:'none' }}>
            <option value="">ทุกสถานะ</option>
            {Object.keys(STATUS_META).map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterCause} onChange={e=>setFilterCause(e.target.value)} style={{ padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:14, fontFamily:'Sarabun', background:'var(--surface)', outline:'none' }}>
            <option value="">ทุกสาเหตุ</option>
            <option value="ขาดสอบ">ขาดสอบ</option>
            <option value="ส่งงานไม่ครบ">ส่งงานไม่ครบ</option>
          </select>
          <select value={filterCourse} onChange={e=>setFilterCourse(e.target.value)} style={{ padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:14, fontFamily:'Sarabun', background:'var(--surface)', outline:'none' }}>
            <option value="">ทุกรายวิชา</option>
            {courses.map(c=><option key={c.courseCode+'_'+c.section} value={c.courseCode+'_'+c.section}>{c.courseCode} หมู่{c.section}</option>)}
          </select>
        </div>
      </Card>

      {/* ── Bulk action bar (sticky-ish) ── */}
      {checkedIds.size > 0 && (
        <div style={{
          background:'#0d2c6b', color:'#fff', borderRadius:10,
          padding:'12px 18px', marginBottom:14,
          display:'flex', alignItems:'center', justifyContent:'space-between',
          flexWrap:'wrap', gap:10,
          boxShadow:'0 4px 12px rgba(13,44,107,.25)',
        }}>
          <div style={{ fontSize:14, fontWeight:600 }}>
            ✓ เลือก {checkedIds.size} รายการ
            {bulkCauses.length === 1 && <span style={{ opacity:.7, fontWeight:400, marginLeft:8 }}>(สาเหตุ: {bulkCauses[0]})</span>}
            {bulkCauses.length > 1 && <span style={{ opacity:.7, fontWeight:400, marginLeft:8 }}>(หลายสาเหตุ)</span>}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => setCheckedIds(new Set())} style={{ padding:'7px 14px', borderRadius:7, border:'1px solid rgba(255,255,255,.3)', background:'transparent', color:'#fff', cursor:'pointer', fontFamily:'Sarabun', fontSize:13 }}>ยกเลิก</button>
            <button onClick={openBulk} style={{ padding:'7px 18px', borderRadius:7, border:'none', background:'#c8a951', color:'#0d2c6b', cursor:'pointer', fontFamily:'Sarabun', fontSize:13, fontWeight:700 }}>📝 อัปเดตสถานะหลายรายการ</button>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      {loading ? <Spinner /> : filtered.length === 0 ? (
        <EmptyState icon="🔍" title="ไม่พบข้อมูล" sub="ลองปรับตัวกรองใหม่ หรือเลือกภาคการศึกษาอื่น" />
      ) : (
        <Card style={{ overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
              <thead>
                <tr>
                  {/* Master checkbox */}
                  <th style={{ ...thStyle('_check'), padding:'10px 14px 10px 18px', cursor:'default', width:36 }}>
                    <input type="checkbox" checked={allChecked} ref={el => el && (el.indeterminate = someChecked)} onChange={toggleAll} style={{ width:16, height:16, accentColor:'#0d2c6b', cursor:'pointer' }} />
                  </th>
                  {[
                    {col:'studentId',    label:'รหัสนักศึกษา'},
                    {col:'studentName',  label:'ชื่อ-สกุล'},
                    {col:'courseCode',   label:'วิชา / หมู่'},
                    {col:'teacher',      label:'อาจารย์'},
                    {col:'bracketGrade', label:'เกรด I'},
                    {col:'cause',        label:'สาเหตุ'},
                    {col:'examScore',    label:'คะแนนสอบรอบ 2'},
                    {col:'status',       label:'สถานะ'},
                    {col:'_action',      label:''},
                  ].map(({col,label}) => (
                    <th key={col} style={thStyle(col)} onClick={()=>col!=='_action' && toggleSort(col)}>
                      {label}{sortCol===col ? (sortDir===1?' ↑':' ↓') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const k = rowKey(s);
                  const isChecked = checkedIds.has(k);
                  return (
                    <tr key={k}
                      style={{
                        borderBottom:'1px solid var(--border-soft)',
                        background: isChecked ? 'var(--brand-soft)' : 'transparent',
                      }}
                      onMouseEnter={e=>{ if(!isChecked) e.currentTarget.style.background='var(--surface-2)'; }}
                      onMouseLeave={e=>{ if(!isChecked) e.currentTarget.style.background='transparent'; }}
                    >
                      <td style={{ padding:'10px 14px 10px 18px', width:36 }}>
                        <input type="checkbox" checked={isChecked} onChange={()=>toggleOne(k)} style={{ width:16, height:16, accentColor:'#0d2c6b', cursor:'pointer' }} />
                      </td>
                      <td style={{ padding:'10px 14px', fontFamily:'monospace', fontSize:12, color:'var(--text)' }}>{s.studentId}</td>
                      <td style={{ padding:'10px 14px', fontWeight:500, color:'var(--text)', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {s.studentName || <span style={{color:'var(--text-dim)',fontSize:12}}>ยังไม่ระบุ</span>}
                      </td>
                      <td style={{ padding:'10px 14px' }}>
                        <div style={{ fontSize:13, fontFamily:'monospace' }}>{s.courseCode}</div>
                        <div style={{ fontSize:11, color:'var(--text-dim)' }}>หมู่ {s.section}</div>
                      </td>
                      <td style={{ padding:'10px 14px', fontSize:13, color:'var(--text)', maxWidth:110, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.teacher||'—'}</td>
                      <td style={{ padding:'10px 14px' }}><GradeBadge grade={s.bracketGrade} /></td>
                      <td style={{ padding:'10px 14px' }}><CauseBadge cause={s.cause} /></td>
                      <td style={{ padding:'10px 14px', fontSize:13 }}>
                        {s.examScore
                          ? <span style={{color:'#0284c7',fontWeight:600}}>{s.examScore}<br/><span style={{fontSize:11,color:'var(--text-dim)'}}>={s.examScoreOutOf30}/30</span></span>
                          : <span style={{color:'var(--text-dim)'}}>—</span>}
                      </td>
                      <td style={{ padding:'10px 14px' }}><StatusBadge status={s.status} /></td>
                      <td style={{ padding:'10px 14px' }}>
                        <button onClick={()=>openEdit(s)} style={{ padding:'5px 12px', borderRadius:6, border:'1px solid var(--brand)', background:'var(--surface)', color:'var(--brand)', cursor:'pointer', fontSize:12, fontFamily:'Sarabun', fontWeight:600 }}>แก้ไข</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Single Edit Modal ── */}
      <Modal open={!!selected} onClose={()=>setSelected(null)} title="อัปเดตสถานะ" width={500}>
        {selected && (
          <div>
            <div style={{ background:'var(--surface-3)', borderRadius:10, padding:'14px 16px', marginBottom:20 }}>
              <div style={{ fontWeight:700, fontSize:15, color:'var(--text)', marginBottom:4 }}>{selected.studentName || selected.studentId}</div>
              <div style={{ fontSize:13, color:'var(--text-muted)' }}>{selected.courseName} • หมู่ {selected.section}</div>
              <div style={{ display:'flex', gap:8, marginTop:8 }}>
                <GradeBadge grade={selected.bracketGrade} />
                <CauseBadge cause={selected.cause} />
                {selected.examScore && <span style={{fontSize:12,color:'#0284c7',alignSelf:'center'}}>คะแนนสอบ: {selected.examScore}</span>}
              </div>
            </div>

            <label style={{ fontSize:13, fontWeight:600, color:'var(--text)', display:'block', marginBottom:8 }}>สถานะใหม่</label>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:18 }}>
              {singleStatusOptions.map(opt => (
                <label key={opt} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:8, border:`2px solid ${editStatus===opt ? 'var(--brand)' : 'var(--border)'}`, background: editStatus===opt ? '#f0f4ff' : 'var(--surface-2)', cursor:'pointer' }}>
                  <input type="radio" name="single-status" value={opt} checked={editStatus===opt} onChange={()=>setEditStatus(opt)} style={{ accentColor:'#0d2c6b' }} />
                  <div><StatusBadge status={opt} /></div>
                </label>
              ))}
            </div>

            <label style={{ fontSize:13, fontWeight:600, color:'var(--text)', display:'block', marginBottom:6 }}>บันทึกเพิ่มเติม (ถ้ามี)</label>
            <textarea value={editNotes} onChange={e=>setEditNotes(e.target.value)} placeholder="เช่น แจ้งอาจารย์ทางอีเมลแล้ว..." rows={3} style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:14, fontFamily:'Sarabun', resize:'vertical', outline:'none', boxSizing:'border-box' }} />

            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:20 }}>
              <button onClick={()=>setSelected(null)} style={{ padding:'9px 20px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', cursor:'pointer', fontFamily:'Sarabun', fontSize:14 }}>ยกเลิก</button>
              <button onClick={saveStatus} disabled={saving} style={{ padding:'9px 20px', borderRadius:8, border:'none', background: saving?'var(--text-dim)':'#0d2c6b', color:'#fff', cursor:saving?'not-allowed':'pointer', fontFamily:'Sarabun', fontSize:14, fontWeight:600 }}>
                {saving ? 'กำลังบันทึก...' : 'บันทึกสถานะ'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Bulk Edit Modal ── */}
      <Modal open={bulkOpen} onClose={()=>!saving && setBulkOpen(false)} title={`อัปเดตสถานะ ${checkedIds.size} รายการพร้อมกัน`} width={560}>
        <div>
          {/* Summary */}
          <div style={{ background:'var(--surface-3)', borderRadius:10, padding:'14px 16px', marginBottom:18, border:'1px solid #e0e7ff' }}>
            <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:6 }}>นักศึกษาที่จะอัปเดต ({checkedIds.size} คน):</div>
            <div style={{ maxHeight:120, overflowY:'auto', fontSize:13, lineHeight:1.8 }}>
              {bulkSelected.slice(0, 12).map((s, i) => (
                <div key={i} style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                  <span style={{ fontFamily:'monospace', fontSize:11, color:'var(--text-muted)' }}>{s.studentId}</span>
                  <span style={{ color:'var(--text)' }}>{s.studentName || '(ไม่ระบุ)'}</span>
                  <CauseBadge cause={s.cause} />
                </div>
              ))}
              {bulkSelected.length > 12 && <div style={{ color:'var(--text-dim)', fontSize:12, marginTop:6 }}>... และอีก {bulkSelected.length - 12} คน</div>}
            </div>
          </div>

          {bulkCauses.length > 1 && (
            <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#92400e' }}>
              ⚠️ <strong>นักศึกษาที่เลือกมีหลายสาเหตุ:</strong> {bulkCauses.join(', ')} — สถานะที่แสดงเป็นการรวมของทุกสาเหตุ
            </div>
          )}

          <label style={{ fontSize:13, fontWeight:600, color:'var(--text)', display:'block', marginBottom:8 }}>เปลี่ยนสถานะเป็น</label>
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:18 }}>
            {bulkStatusOptions.map(opt => (
              <label key={opt} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:8, border:`2px solid ${editStatus===opt ? 'var(--brand)' : 'var(--border)'}`, background: editStatus===opt ? '#f0f4ff' : 'var(--surface-2)', cursor:'pointer' }}>
                <input type="radio" name="bulk-status" value={opt} checked={editStatus===opt} onChange={()=>setEditStatus(opt)} style={{ accentColor:'#0d2c6b' }} />
                <div><StatusBadge status={opt} /></div>
              </label>
            ))}
          </div>

          <label style={{ fontSize:13, fontWeight:600, color:'var(--text)', display:'block', marginBottom:6 }}>บันทึกเพิ่มเติม (จะใส่ให้ทุกคนที่เลือก)</label>
          <textarea value={editNotes} onChange={e=>setEditNotes(e.target.value)} placeholder="เช่น แจ้งอาจารย์ผ่านอีเมลแล้วเมื่อ 1 เม.ย. 2569..." rows={2} style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:14, fontFamily:'Sarabun', resize:'vertical', outline:'none', boxSizing:'border-box' }} />

          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:20 }}>
            <button onClick={()=>setBulkOpen(false)} disabled={saving} style={{ padding:'9px 20px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', cursor: saving?'not-allowed':'pointer', fontFamily:'Sarabun', fontSize:14 }}>ยกเลิก</button>
            <button onClick={saveBulk} disabled={saving || !editStatus} style={{ padding:'9px 22px', borderRadius:8, border:'none', background: (saving||!editStatus)?'var(--text-dim)':'#0d2c6b', color:'#fff', cursor:(saving||!editStatus)?'not-allowed':'pointer', fontFamily:'Sarabun', fontSize:14, fontWeight:700 }}>
              {saving ? `กำลังอัปเดต...` : `บันทึก ${checkedIds.size} รายการ`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

Object.assign(window, { AdminStudents });
