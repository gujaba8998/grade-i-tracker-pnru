// AdminForm.jsx - Generate & Print ใบแก้ไขผลการเรียน I

const AdminForm = ({ user }) => {
  const [students, setStudents] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState(new Set());
  const toast = useToast();
  const [submitter, setSubmitter] = React.useState(user?.displayName?.replace(/\(.*\)/,'').trim() || '');
  const [submitDate, setSubmitDate] = React.useState(() => {
    const d = new Date();
    return `${d.getDate()} ${['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'][d.getMonth()]} พ.ศ.${d.getFullYear()+543}`;
  });
  const [semester, setSemester] = React.useState('');
  const [allSemesters, setAllSemesters] = React.useState([]);
  const [term, setTerm] = React.useState('ปกติ');
  const [showPreview, setShowPreview] = React.useState(false);

  React.useEffect(() => {
    // Show students that are completed (graded) OR already submitted (so admin can re-print)
    window.API.getStudents({}).then(res => {
      const list = (res.data || []).filter(s => s.status === 'เสร็จสิ้น' || s.status === 'ส่งงานทะเบียนแล้ว');
      setStudents(list);
      const sems = [...new Set(list.map(s => s.semester).filter(Boolean))].sort(window.compareSemestersDesc);
      setAllSemesters(sems);
      setSemester(prev => (prev && sems.includes(prev)) ? prev : (sems[0] || ''));
      setLoading(false);
    }).catch(() => { setStudents([]); setLoading(false); toast('โหลดข้อมูลสำหรับแบบฟอร์มไม่สำเร็จ', 'error'); });
  }, []);

  const toggle = (key) => setSelected(prev => {
    const s = new Set(prev);
    s.has(key) ? s.delete(key) : s.add(key);
    return s;
  });
  const toggleAll = () => {
    if (selected.size === groups.length) setSelected(new Set());
    else setSelected(new Set(groups.map(g => g.key)));
  };

  // Group by course+section for form (filtered by selected semester)
  const groups = React.useMemo(() => {
    const map = {};
    students.filter(s => !semester || s.semester === semester).forEach(s => {
      const key = s.courseCode + '_' + s.section;
      if (!map[key]) map[key] = { key, courseCode: s.courseCode, courseName: s.courseName, section: s.section, teacher: s.teacher, students: [] };
      map[key].students.push(s);
    });
    return Object.values(map);
  }, [students, semester]);

  const selectedGroups = groups.filter(g => selected.has(g.key));

  // Print + auto-update status to 'ส่งงานทะเบียนแล้ว'
  const handlePrint = async () => {
    if (selectedGroups.length === 0) return;
    setShowPreview(false);

    // Open print dialog
    setTimeout(() => window.print(), 200);

    // After print dialog closes (best-effort detect via afterprint event)
    const onAfterPrint = async () => {
      window.removeEventListener('afterprint', onAfterPrint);
      // Auto-update status for all printed students
      const toUpdate = [];
      selectedGroups.forEach(g => g.students.forEach(s => {
        if (s.status !== 'ส่งงานทะเบียนแล้ว') toUpdate.push(s);
      }));
      if (toUpdate.length === 0) return;

      let ok = 0, err = 0;
      for (const s of toUpdate) {
        try {
          const res = await window.API.updateStatus({
            studentId: s.studentId, courseCode: s.courseCode, section: s.section, semester: s.semester,
            status: 'ส่งงานทะเบียนแล้ว',
            by: user.displayName,
          });
          if (res.success) ok++; else err++;
        } catch { err++; }
      }
      // Refresh list (status filter might change visibility)
      setStudents(prev => prev.map(s =>
        toUpdate.find(t => t.studentId===s.studentId && t.courseCode===s.courseCode && t.section===s.section && t.semester===s.semester)
          ? { ...s, status: 'ส่งงานทะเบียนแล้ว' } : s
      ));
      setSelected(new Set());
      toast(`พิมพ์เอกสารเรียบร้อย — อัปเดตสถานะ "ส่งงานทะเบียนแล้ว" จำนวน ${ok} รายการ ✅`, err > 0 ? 'warning' : 'success');
    };
    window.addEventListener('afterprint', onAfterPrint);
  };

  if (loading) return <div style={{ padding:32 }}><Spinner /></div>;

  return (
    <div style={{ padding:'28px 28px', fontFamily:'Sarabun, sans-serif' }}>
      <div style={{ fontSize:20, fontWeight:700, color:'var(--text)', marginBottom:6 }}>🖨️ สร้างใบแก้ไขผลการเรียน I</div>
      <div style={{ fontSize:14, color:'var(--text-muted)', marginBottom:24 }}>เลือกรายวิชาที่ต้องการสร้างเอกสาร (เฉพาะที่สถานะ "เสร็จสิ้น")</div>

      {/* Form settings */}
      <Card style={{ padding:'18px 22px', marginBottom:20 }}>
        <div style={{ fontWeight:700, color:'var(--text)', marginBottom:14 }}>ข้อมูลเอกสาร</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14 }}>
          <div>
            <label style={{ fontSize:13, fontWeight:600, color:'var(--text)', display:'block', marginBottom:6 }}>ภาคการศึกษา</label>
            <select value={semester} onChange={e=>{setSemester(e.target.value); setSelected(new Set());}} style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:14, fontFamily:'Sarabun', background:'var(--surface)', outline:'none' }}>
              {allSemesters.length === 0 && <option value="">— ไม่มีข้อมูล —</option>}
              {allSemesters.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:13, fontWeight:600, color:'var(--text)', display:'block', marginBottom:6 }}>ประเภทนักศึกษา</label>
            <select value={term} onChange={e=>setTerm(e.target.value)} style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:14, fontFamily:'Sarabun', background:'var(--surface)', outline:'none' }}>
              <option value="ปกติ">ภาคปกติ</option><option value="กศ.พบ.">ภาคกศ.พบ.</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize:13, fontWeight:600, color:'var(--text)', display:'block', marginBottom:6 }}>วันที่ส่งเอกสาร</label>
            <input value={submitDate} onChange={e=>setSubmitDate(e.target.value)} style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:14, fontFamily:'Sarabun', outline:'none', boxSizing:'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize:13, fontWeight:600, color:'var(--text)', display:'block', marginBottom:6 }}>ผู้ส่งเอกสาร</label>
            <input value={submitter} onChange={e=>setSubmitter(e.target.value)} placeholder="ชื่อผู้ส่ง" style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:14, fontFamily:'Sarabun', outline:'none', boxSizing:'border-box' }} />
          </div>
        </div>
      </Card>

      {/* Course selection */}
      {students.length === 0 ? (
        <EmptyState icon="📋" title="ยังไม่มีรายการที่เสร็จสิ้น" sub="รายการที่มีสถานะ 'เสร็จสิ้น' จะปรากฏที่นี่" />
      ) : (
        <>
          <Card style={{ overflow:'hidden', marginBottom:20 }}>
            <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--border-soft)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontWeight:700, color:'var(--text)' }}>เลือกรายวิชา ({selected.size}/{groups.length})</div>
              <button onClick={toggleAll} style={{ background:'none', border:'none', color:'var(--brand)', cursor:'pointer', fontSize:13, fontFamily:'Sarabun', fontWeight:600 }}>
                {selected.size === groups.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
              </button>
            </div>
            {groups.map((g, i) => (
              <label key={g.key} style={{ display:'flex', alignItems:'center', gap:14, padding:'13px 18px', cursor:'pointer', borderBottom: i < groups.length-1 ? '1px solid #f3f4f6' : 'none', background: selected.has(g.key) ? '#f0f4ff' : 'transparent' }}>
                <input type="checkbox" checked={selected.has(g.key)} onChange={()=>toggle(g.key)} style={{ accentColor:'#0d2c6b', width:16, height:16 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, fontSize:14, color:'var(--text)' }}>{g.courseName || g.courseCode} <span style={{ fontSize:12, color:'var(--text-dim)', fontWeight:400 }}>หมู่ {g.section}</span></div>
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>อาจารย์: {g.teacher||'—'} • {g.students.length} คน</div>
                </div>
                <span style={{ fontSize:12, background:'#e0f2fe', color:'#0284c7', padding:'2px 10px', borderRadius:20 }}>{g.students.length} คน</span>
              </label>
            ))}
          </Card>

          <div style={{ display:'flex', gap:12, justifyContent:'flex-end' }}>
            <button onClick={()=>setShowPreview(true)} disabled={selected.size===0} style={{ padding:'10px 22px', borderRadius:8, border:'1px solid var(--brand)', background:'var(--surface)', color:'var(--brand)', cursor: selected.size===0?'not-allowed':'pointer', fontFamily:'Sarabun', fontSize:14, fontWeight:600, opacity: selected.size===0?.5:1 }}>👁️ ดูตัวอย่าง</button>
            <button onClick={handlePrint} disabled={selected.size===0} style={{ padding:'10px 24px', borderRadius:8, border:'none', background: selected.size===0?'var(--text-dim)':'#0d2c6b', color:'#fff', cursor: selected.size===0?'not-allowed':'pointer', fontFamily:'Sarabun', fontSize:14, fontWeight:700 }}>🖨️ พิมพ์เอกสาร</button>
          </div>
        </>
      )}

      {/* Preview Modal */}
      <Modal open={showPreview} onClose={()=>setShowPreview(false)} title="ตัวอย่างเอกสาร" width={780}>
        <div style={{ fontFamily:'Sarabun, sans-serif' }}>
          <PrintableForm groups={selectedGroups} semester={semester} term={term} submitDate={submitDate} submitter={submitter} />
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:20 }}>
          <button onClick={()=>setShowPreview(false)} style={{ padding:'9px 20px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', cursor:'pointer', fontFamily:'Sarabun' }}>ปิด</button>
          <button onClick={handlePrint} style={{ padding:'9px 22px', borderRadius:8, border:'none', background:'#0d2c6b', color:'#fff', cursor:'pointer', fontFamily:'Sarabun', fontWeight:700 }}>🖨️ พิมพ์</button>
        </div>
      </Modal>

      {/* Print-only content */}
      <div className="print-only">
        <PrintableForm groups={selectedGroups} semester={semester} term={term} submitDate={submitDate} submitter={submitter} />
      </div>
    </div>
  );
};

// ── Printable Form Component ───────────────────────────────────
const PrintableForm = ({ groups, semester, term, submitDate, submitter }) => {
  const [semNum, semYear] = semester.split('/');
  let rowNum = 0;
  return (
    <div style={{ fontFamily:'Sarabun, sans-serif', fontSize:14, color:'#000', lineHeight:1.5, maxWidth:720, margin:'0 auto' }}>
      {/* Header */}
      <div style={{ textAlign:'center', marginBottom:16 }}>
        <div style={{ fontSize:18, fontWeight:700 }}>มหาวิทยาลัยราชภัฏพระนคร</div>
        <div style={{ fontSize:15, fontWeight:700, marginTop:4 }}>รายงานสรุปการส่งผลการสอบนักศึกษา</div>
        <div style={{ fontSize:14, marginTop:6, display:'flex', justifyContent:'center', gap:20 }}>
          <span>{term === 'ปกติ' ? '☑' : '☐'} ภาคปกติ</span>
          <span>{term === 'กศ.พบ.' ? '☑' : '☐'} ภาคกศ.พบ.</span>
        </div>
        <div style={{ fontSize:14, marginTop:4 }}>ประจำภาคเรียนที่ {semNum} ปีการศึกษา {semYear}  งานวิชาศึกษาทั่วไป</div>
        <div style={{ fontSize:13, marginTop:4 }}>รายงานวันที่ {submitDate}</div>
      </div>

      {/* Table */}
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
        <thead>
          <tr style={{ background:'var(--border-soft)' }}>
            {['ที่','รหัสนักศึกษา','ชื่อ-สกุล','หมู่เรียน','รหัสวิชา','ชื่อวิชา','สาเหตุ','เกรดเดิม','เกรดใหม่'].map(h => (
              <th key={h} style={{ border:'1px solid #999', padding:'6px 8px', textAlign:'center', fontSize:12, fontWeight:700, whiteSpace:'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g, gi) => (
            <React.Fragment key={g.key}>
              {/* Course header row */}
              <tr style={{ background:'#eef2ff' }}>
                <td colSpan={9} style={{ border:'1px solid #bbb', padding:'6px 10px', fontWeight:700 }}>
                  {++rowNum}. รายวิชา {g.courseCode} <span style={{fontWeight:400}}>{g.courseName}</span> • หมู่ {g.section} • ผู้สอน: {g.teacher || '—'} • {g.students.length} คน
                </td>
              </tr>
              {/* Student rows */}
              {g.students.map((s, si) => {
                const oldGrade = s.bracketGrade === 'E' ? 'I(E)' : `I(${s.bracketGrade})`;
                const newGrade = s.newGrade || '';
                return (
                  <tr key={si}>
                    <td style={{ border:'1px solid #bbb', padding:'5px 8px', textAlign:'center' }}>{si+1}</td>
                    <td style={{ border:'1px solid #bbb', padding:'5px 8px', fontFamily:'monospace', fontSize:12 }}>{s.studentId}</td>
                    <td style={{ border:'1px solid #bbb', padding:'5px 8px' }}>{s.studentName || '—'}</td>
                    <td style={{ border:'1px solid #bbb', padding:'5px 8px', textAlign:'center' }}>{g.section}</td>
                    <td style={{ border:'1px solid #bbb', padding:'5px 8px', textAlign:'center', fontFamily:'monospace' }}>{g.courseCode}</td>
                    <td style={{ border:'1px solid #bbb', padding:'5px 8px', fontSize:12 }}>{g.courseName}</td>
                    <td style={{ border:'1px solid #bbb', padding:'5px 8px', textAlign:'center' }}>{semester}</td>
                    <td style={{ border:'1px solid #bbb', padding:'5px 8px', textAlign:'center', fontWeight:700, color: s.bracketGrade==='E'?'#dc2626':'var(--text)' }}>
                      {oldGrade}
                    </td>
                    <td style={{ border:'1px solid #bbb', padding:'5px 8px', textAlign:'center', fontWeight:700, color:'#16a34a', fontSize:15 }}>
                      {newGrade || <span style={{color:'#dc2626', fontSize:11, fontWeight:400}}>(ยังไม่บันทึกเกรด)</span>}
                    </td>
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {/* Footer */}
      <div style={{ marginTop:24, display:'flex', justifyContent:'space-between', fontSize:13 }}>
        <div>วันที่ส่ง {submitDate}</div>
        <div>ผู้รับ .........................................................................</div>
        <div>ผู้ส่ง .........({submitter})..........</div>
      </div>
    </div>
  );
};

Object.assign(window, { AdminForm, PrintableForm });
