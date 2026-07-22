// Admin Import - 3 tabs: students / scores / course offerings

const AdminImport = ({ user }) => {
  const [tab, setTab] = React.useState('offerings'); // 'offerings' | 'students' | 'scores'
  const [preview, setPreview] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [semester, setSemester] = React.useState('3/2568');
  const [clearExisting, setClearExisting] = React.useState(false);
  const [courseTeachers, setCourseTeachers] = React.useState({});
  const [courseNames, setCourseNames] = React.useState({}); // courseKey -> courseName
  const [step, setStep] = React.useState(1);
  const [importResult, setImportResult] = React.useState(null);
  const [offeringsCount, setOfferingsCount] = React.useState({}); // semester -> count
  const toast = useToast();
  const fileRef = React.useRef();

  // Load summary of available offerings per semester (for badges)
  const loadOfferingsCount = React.useCallback(async () => {
    const res = await window.API.getCourseOfferings();
    const all = res.data || {};
    const counts = {};
    Object.entries(all).forEach(([sem, map]) => { counts[sem] = Object.keys(map).length; });
    setOfferingsCount(counts);
  }, []);
  React.useEffect(() => { loadOfferingsCount(); }, [loadOfferingsCount]);

  // ── Parse "Course Offerings" Excel ───────────────────────────
  // Block format:
  //   Row 0: "[TeacherID] อาจารย์[Name]"
  //   Row 1: ["#", "รหัสวิชา", "ชื่อวิชา", "SEC", "ประเภท"]
  //   Row 2+: data
  const parseOfferingsFile = async (file) => {
    const XLSX = window.XLSX;
    const ab = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(ab), { type: 'array' });
    const teachers = []; // {teacherId, teacherName, courses: [{courseCode, courseName, section, type}]}
    let current = null;

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      for (const row of rows) {
        const col0 = String(row[0] || '').trim();

        // Teacher header: "1100022 อาจารย์XXX" — col0 starts with digits + space + อาจารย์
        const m = col0.match(/^(\d{6,10})\s+(.+)$/);
        if (m && (m[2].includes('อาจารย์') || m[2].includes('ดร.') || m[2].includes('ผศ.') || m[2].includes('รศ.') || m[2].includes('ศ.'))) {
          current = { teacherId: m[1], teacherName: m[2].trim(), courses: [] };
          teachers.push(current);
          continue;
        }
        // Column header row — skip
        if (col0 === '#') continue;
        // Data row — col0 = number, col1 = courseCode
        if (typeof row[0] === 'number' && row[1] && current) {
          const courseCode = String(row[1]).padStart(7, '0');
          const courseName = String(row[2] || '').trim();
          const section    = String(row[3] || '').padStart(3, '0');
          const type       = String(row[4] || '').trim();
          if (courseCode && section) {
            current.courses.push({ courseCode, courseName, section, type });
          }
        }
      }
    }
    // Build flat map: (courseCode_section) → { courseName, teacher, teacherId, type }
    const map = {};
    teachers.forEach(t => t.courses.forEach(c => {
      const key = c.courseCode + '_' + c.section;
      // Multi-teacher: append names
      const teacherName = t.teacherName.replace(/^อาจารย์\s*/, 'อ.');
      if (map[key]) {
        if (!map[key].teacher.split(', ').includes(teacherName)) map[key].teacher = map[key].teacher + ', ' + teacherName;
        map[key].teacherIds = [...new Set([...(map[key].teacherIds || []), String(t.teacherId)])];
      } else {
        map[key] = { courseCode: c.courseCode, section: c.section, courseName: c.courseName, teacher: teacherName, teacherId: t.teacherId, teacherIds: [String(t.teacherId)], type: c.type };
      }
    }));
    return { teachers, map };
  };

  // ── Parse students_i.xlsx ───────────────────────────────────
  const parseStudentsFile = async (file) => {
    const XLSX = window.XLSX;
    const ab = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(ab), { type: 'array' });
    const allStudents = [];
    const courseMap = {};

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      for (const row of rows) {
        const col1 = row[1];
        if (/^\d{10,15}$/.test(String(col1 || '').trim())) {
          const studentId   = String(col1).trim();
          const courseRaw   = String(row[2] || '');
          const courseCode  = courseRaw.padStart(7, '0');
          const section     = String(row[3] || '').padStart(3, '0');
          const bracketGrade = String(row[5] || '').trim().toUpperCase();
          if (!bracketGrade) continue;
          const courseKey = courseCode + '_' + section;
          if (!courseMap[courseKey]) courseMap[courseKey] = { courseCode, section };
          allStudents.push({
            studentId, studentName: '',
            courseCode, courseName: '', section, teacher: '',
            bracketGrade,
            cause: bracketGrade === 'E' ? 'ขาดสอบ' : 'ส่งงานไม่ครบ',
            status: 'รอดำเนินการ',
          });
        }
      }
    }
    const seen = new Set();
    const unique = allStudents.filter(s => {
      const key = s.studentId + '_' + s.courseCode + '_' + s.section;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
    return { students: unique, courses: Object.values(courseMap) };
  };

  // ── Parse exam_scores.xlsx ──────────────────────────────────
  const parseScoresFile = async (file) => {
    const XLSX = window.XLSX;
    const ab = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(ab), { type: 'array' });
    const allScores = [];

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      let currentCode = '', currentName = '', currentSection = '';
      let score30Col = -1;

      for (const row of rows) {
        const col0 = String(row[0] || '');
        if (col0.includes('มหาวิทยาลัย') || col0.includes('ภาคการศึกษา')) {
          const lines = col0.split('\n');
          for (const line of lines) {
            const mm = line.match(/^(\d{7})\s+(.+?)\s+sec\s+(\d+)/i);
            if (mm) { currentCode = mm[1]; currentName = mm[2].trim(); currentSection = String(Number(mm[3])).padStart(3,'0'); }
          }
          score30Col = -1; continue;
        }
        const m2 = col0.match(/^(\d{7})\s+(.+?)\s+sec\s+(\d+)/i);
        if (m2) { currentCode = m2[1]; currentName = m2[2].trim(); currentSection = String(Number(m2[3])).padStart(3,'0'); score30Col = -1; continue; }
        const hasScore30Hdr = row.some(c => String(c).includes('คะแนน(30)'));
        if (col0 === 'ลำดับ' || hasScore30Hdr) {
          score30Col = row.findIndex(c => String(c).includes('คะแนน(30)'));
          continue;
        }
        const col1 = row[1];
        if (/^\d{10,15}$/.test(String(col1 || '').trim()) && currentCode && currentSection) {
          const studentId   = String(col1).trim();
          const studentName = String(row[2] || '').trim();
          let rawScore = '', score30 = 0;
          for (let ci = 3; ci < row.length; ci++) {
            if (/^\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?$/.test(String(row[ci] || '').trim())) {
              rawScore = String(row[ci]).trim().replace(/\s+/g, ''); break;
            }
          }
          if (score30Col > -1 && row[score30Col] !== '') {
            const parsed = Number(row[score30Col]);
            if (Number.isFinite(parsed)) score30 = parsed;
          }
          allScores.push({ studentId, studentName, courseCode: currentCode, courseName: currentName, section: currentSection, rawScore, score30 });
        }
      }
    }
    return allScores;
  };

  // ── File select handler ─────────────────────────────────────
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true); setPreview(null); setStep(1);
    try {
      if (tab === 'offerings') {
        const { teachers, map } = await parseOfferingsFile(file);
        setPreview({ teachers, map });
      } else if (tab === 'students') {
        const { students, courses } = await parseStudentsFile(file);
        // Auto-fill from master table (course offerings for selected semester)
        const offRes = await window.API.getCourseOfferings(semester);
        const offerings = offRes.data || {};
        // Fallback: section teachers memory
        const memRes = await window.API.getSectionTeachers();
        const memory = memRes.data || {};

        const teacherMap = {}, nameMap = {};
        let matchedFromOff = 0, matchedFromMem = 0;
        courses.forEach(c => {
          const key = c.courseCode + '_' + c.section;
          if (offerings[key]) {
            teacherMap[key] = offerings[key].teacher || '';
            nameMap[key]    = offerings[key].courseName || '';
            matchedFromOff++;
          } else if (memory[key]) {
            teacherMap[key] = memory[key];
            nameMap[key]    = '';
            matchedFromMem++;
          } else {
            teacherMap[key] = '';
            nameMap[key]    = '';
          }
        });
        setCourseTeachers(teacherMap);
        setCourseNames(nameMap);
        setPreview({ students, courses, matchedFromOff, matchedFromMem });

        const total = courses.length;
        if (matchedFromOff > 0 || matchedFromMem > 0) {
          toast(`Matching สำเร็จ ${matchedFromOff + matchedFromMem}/${total} รายวิชา ✨`, 'info');
        }
        if (matchedFromOff === 0 && offeringsCount[semester] === undefined) {
          toast(`💡 ยังไม่มีข้อมูลรายวิชาเปิดสอนสำหรับภาค ${semester} — แนะนำให้ Import ก่อน`, 'warning');
        }
      } else if (tab === 'scores') {
        const scores = await parseScoresFile(file);
        setPreview({ scores });
      }
      setStep(2);
    } catch (err) {
      console.error(err);
      toast('ไม่สามารถอ่านไฟล์ได้: ' + err.message, 'error');
    }
    setLoading(false);
    e.target.value = '';
  };

  // ── Import handler ──────────────────────────────────────────
  const doImport = async () => {
    if (!/^[1-3]\/\d{4}$/.test(semester.trim())) {
      toast('รูปแบบภาคการศึกษาต้องเป็น เช่น 1/2569', 'error');
      return;
    }
    setImporting(true);
    try {
      let res;
      if (tab === 'offerings') {
        res = await window.API.saveCourseOfferings(semester, preview.map);
        await loadOfferingsCount();
        if (res.success) {
          res.imported = Object.keys(preview.map).length;
          // 🔄 Cascade-sync existing student records for this semester
          const syncRes = await window.API.applyCourseOfferings(semester);
          res.synced = syncRes.updated || 0;
          // 👤 Auto-create/update teacher accounts from parsed data
          const acctRes = await window.API.upsertTeacherAccounts(preview.teachers);
          res.created = acctRes.created || 0;
          res.updatedAccounts = acctRes.updated || 0;
        }
      } else if (tab === 'students') {
        const students = preview.students.map(s => {
          const key = s.courseCode + '_' + s.section;
          return { ...s, teacher: courseTeachers[key] || '', courseName: courseNames[key] || '' };
        });
        res = await window.API.importStudents(students, semester, clearExisting);
        // 🔄 Always re-sync teacher/courseName from offerings after student import
        const syncAfter = await window.API.applyCourseOfferings(semester);
        res.synced = syncAfter.updated || 0;
        // Save mapping for future use
        await window.API.saveSectionTeachers(courseTeachers);
      } else {
        res = await window.API.importExamScores(preview.scores, semester);
      }
      if (res.success) {
        setImportResult(res);
        setStep(3);
        toast(`นำเข้าสำเร็จ ${res.imported} รายการ ✅`, 'success');
      } else toast(res.error || 'เกิดข้อผิดพลาด', 'error');
    } catch (err) { console.error(err); toast('เกิดข้อผิดพลาดในการนำเข้า', 'error'); }
    setImporting(false);
  };

  const reset = () => { setPreview(null); setStep(1); setImportResult(null); if(fileRef.current) fileRef.current.value=''; };

  // ── Tab button ──────────────────────────────────────────────
  const btnTab = (id, label, badge) => (
    <button onClick={()=>{setTab(id);reset();}} style={{
      padding:'9px 18px', borderRadius:8, border:'none', fontFamily:'Sarabun', fontSize:14,
      cursor:'pointer', fontWeight: tab===id?700:500,
      background: tab===id?'#0d2c6b':'#f3f4f6', color: tab===id?'#fff':'var(--text)',
      display:'inline-flex', alignItems:'center', gap:8,
    }}>
      {label}
      {badge !== undefined && badge !== null && (
        <span style={{ background: tab===id ? 'rgba(255,255,255,.2)' : '#0d2c6b', color: tab===id ? '#fff' : '#fff', padding:'1px 8px', borderRadius:10, fontSize:11, fontWeight:600 }}>{badge}</span>
      )}
    </button>
  );

  return (
    <div style={{ padding:'28px 28px' }}>
      <div style={{ fontSize:20, fontWeight:700, color:'var(--text)', marginBottom:6 }}>📥 นำเข้าข้อมูล</div>
      <div style={{ fontSize:14, color:'var(--text-muted)', marginBottom:24 }}>นำเข้าข้อมูลจากไฟล์ Excel — แนะนำให้ Import "รายวิชาเปิดสอน" ก่อน เพื่อให้ระบบ matching ข้อมูลนักศึกษาอัตโนมัติ</div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:24, flexWrap:'wrap' }}>
        {btnTab('offerings', '📚 รายวิชาเปิดสอน', offeringsCount[semester])}
        {btnTab('students',  '📋 รายชื่อนักศึกษาที่ติด I')}
        {btnTab('scores',    '📊 คะแนนสอบปลายภาครอบ 2')}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <Card style={{ padding:32 }}>
          {(tab === 'students' || tab === 'offerings' || tab === 'scores') && (
            <div style={{ marginBottom:20, display:'flex', gap:16, flexWrap:'wrap', alignItems:'flex-end' }}>
              <div>
                <label style={{ fontSize:13, fontWeight:600, color:'var(--text)', display:'block', marginBottom:6 }}>
                  ภาคการศึกษา {tab === 'scores' && <span style={{color:'#dc2626'}}>*</span>}
                </label>
                <input value={semester} onChange={e=>setSemester(e.target.value.trim())} placeholder="เช่น 1/2569" inputMode="numeric"
                  style={{ padding:'9px 14px', borderRadius:8, border:'1px solid var(--border)', fontSize:14, fontFamily:'Sarabun', background:'var(--surface)', width:130 }} />
              </div>
              {tab === 'students' && (
                <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:14, cursor:'pointer', paddingBottom:9 }}>
                  <input type="checkbox" checked={clearExisting} onChange={e=>setClearExisting(e.target.checked)} style={{ accentColor:'#dc2626' }} />
                  <span style={{ color:'#dc2626', fontWeight:600 }}>ล้างเฉพาะข้อมูลภาค {semester} ก่อนนำเข้า</span>
                </label>
              )}
              {tab === 'students' && (
                <div style={{ marginLeft:'auto', fontSize:13, color: offeringsCount[semester] ? '#16a34a' : '#dc2626', alignSelf:'center', paddingBottom:9 }}>
                  {offeringsCount[semester]
                    ? `✓ มีข้อมูลรายวิชาเปิดสอน ${offeringsCount[semester]} รายวิชาแล้ว`
                    : `⚠️ ยังไม่มีรายวิชาเปิดสอนสำหรับ ${semester}`}
                </div>
              )}
              {tab === 'scores' && (
                <div style={{ marginLeft:'auto', fontSize:12, color:'#92400e', background:'#fffbeb', border:'1px solid #fde68a', padding:'7px 14px', borderRadius:8, alignSelf:'center' }}>
                  🔴 ต้องระบุภาคเรียนของคะแนนผลสอบ
                </div>
              )}
            </div>
          )}
          <div style={{ border:'2px dashed #d1d5db', borderRadius:12, padding:'48px 32px', textAlign:'center', cursor:'pointer', transition:'all .15s' }}
            onClick={()=>fileRef.current?.click()}
            onMouseEnter={e=>e.currentTarget.style.borderColor='#0d2c6b'}
            onMouseLeave={e=>e.currentTarget.style.borderColor='var(--text-dim)'}>
            <div style={{ fontSize:48, marginBottom:12 }}>📂</div>
            <div style={{ fontSize:16, fontWeight:600, color:'var(--text)', marginBottom:6 }}>คลิกเพื่อเลือกไฟล์ Excel</div>
            <div style={{ fontSize:13, color:'var(--text-dim)' }}>รองรับ .xlsx, .xls เท่านั้น</div>
            {loading && <div style={{ marginTop:16, color:'#0d2c6b', fontWeight:600 }}>กำลังอ่านไฟล์...</div>}
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display:'none' }} />

          {/* Format hint */}
          <div style={{ marginTop:20, background:'var(--surface-3)', borderRadius:10, padding:'14px 18px' }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#0d2c6b', marginBottom:6 }}>
              {tab === 'offerings' && '📚 รูปแบบไฟล์ (รายวิชาเปิดสอน)'}
              {tab === 'students'  && '📋 รูปแบบไฟล์ (รายชื่อนักศึกษาที่ติด I)'}
              {tab === 'scores'    && '📊 รูปแบบไฟล์ (คะแนนจาก IT)'}
            </div>
            <div style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.8 }}>
              {tab === 'offerings' && 'แต่ละบล็อก: บรรทัดบนสุดเป็น "[รหัสอาจารย์] อาจารย์[ชื่อ]" ตามด้วยตาราง # | รหัสวิชา | ชื่อวิชา | SEC | ประเภท'}
              {tab === 'students'  && 'คอลัมน์: ลำดับ | รหัสนักศึกษา | รหัสวิชา | หมู่เรียน | เกรด(I) | เกรดวงเล็บ | ชื่อ-สกุล'}
              {tab === 'scores'    && 'รูปแบบรายงานจาก IT: หัวกลุ่ม "รหัสวิชา ชื่อวิชา sec XXX" ตามด้วยตาราง: ลำดับ | รหัส | ชื่อ-สกุล | คะแนน/เต็ม | ... | คะแนน(30)'}
            </div>
          </div>
        </Card>
      )}

      {/* Step 2: Preview */}
      {step === 2 && preview && (
        <div>
          {/* ── OFFERINGS Preview ── */}
          {tab === 'offerings' && (
            <>
              <Card style={{ padding:'18px 22px', marginBottom:18 }}>
                <div style={{ fontWeight:700, color:'var(--text)', marginBottom:6 }}>
                  ✅ พบ {preview.teachers.length} อาจารย์ • {Object.keys(preview.map).length} รายวิชา (รหัส+หมู่)
                </div>
                <div style={{ fontSize:13, color:'var(--text-muted)' }}>
                  ระบบจะบันทึกข้อมูลนี้เป็น Master Table สำหรับภาค <strong>{semester}</strong> เพื่อใช้ matching กับข้อมูลนักศึกษาที่ติด I ในภายหลัง
                </div>
                {offeringsCount[semester] > 0 && (
                  <div style={{ marginTop:10, background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, padding:'8px 14px', fontSize:12, color:'#92400e' }}>
                    ⚠️ ภาค {semester} มีข้อมูลอยู่แล้ว {offeringsCount[semester]} รายวิชา — การนำเข้าครั้งนี้จะ <strong>เพิ่มทับ</strong> ข้อมูลใหม่ (ของเดิมที่ไม่ทับจะยังอยู่)
                  </div>
                )}
              </Card>
              <Card style={{ overflow:'hidden', marginBottom:18 }}>
                <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--border-soft)', fontSize:13, fontWeight:600, color:'var(--text)' }}>รายการที่จะนำเข้า</div>
                <div style={{ maxHeight:420, overflowY:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead><tr style={{background:'var(--surface-2)',position:'sticky',top:0}}>
                      {['รหัสวิชา','หมู่','ชื่อวิชา','อาจารย์','ประเภท'].map(h=>(
                        <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:11, fontWeight:600, color:'var(--text-muted)', borderBottom:'1px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {Object.values(preview.map).map((c,i)=>(
                        <tr key={i} style={{borderBottom:'1px solid var(--border-soft)'}}>
                          <td style={{padding:'7px 14px',fontFamily:'monospace',fontSize:12}}>{c.courseCode}</td>
                          <td style={{padding:'7px 14px'}}>{c.section}</td>
                          <td style={{padding:'7px 14px'}}>{c.courseName}</td>
                          <td style={{padding:'7px 14px',color:'#0d2c6b',fontWeight:500}}>{c.teacher}</td>
                          <td style={{padding:'7px 14px',fontSize:11,color:'var(--text-dim)'}}>{c.type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

          {/* ── STUDENTS Preview ── */}
          {tab === 'students' && (
            <>
              <Card style={{ padding:'18px 22px', marginBottom:18 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14, flexWrap:'wrap', gap:8 }}>
                  <div>
                    <div style={{ fontWeight:700, color:'var(--text)' }}>✅ พบข้อมูล {preview.students.length} รายการ ใน {preview.courses.length} รายวิชา</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>
                      ✨ Matching จากรายวิชาเปิดสอน: <strong style={{color:'#16a34a'}}>{preview.matchedFromOff||0}</strong>
                      {preview.matchedFromMem > 0 && <> • จากการนำเข้าครั้งก่อน: <strong style={{color:'#7c3aed'}}>{preview.matchedFromMem}</strong></>}
                      {(preview.courses.length - (preview.matchedFromOff||0) - (preview.matchedFromMem||0) > 0) && <> • ยังไม่ matching: <strong style={{color:'#dc2626'}}>{preview.courses.length - (preview.matchedFromOff||0) - (preview.matchedFromMem||0)}</strong></>}
                    </div>
                  </div>
                </div>
                <div style={{ maxHeight:300, overflowY:'auto', display:'flex', flexDirection:'column', gap:8 }}>
                  {preview.courses.map(c => {
                    const key = c.courseCode + '_' + c.section;
                    const hasTeacher = !!courseTeachers[key];
                    const hasName = !!courseNames[key];
                    return (
                      <div key={key} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background: hasTeacher ? '#f0fdf4' : '#fef2f2', border: `1px solid ${hasTeacher ? '#bbf7d0' : '#fecaca'}`, borderRadius:8, flexWrap:'wrap' }}>
                        <span style={{ fontFamily:'monospace', fontSize:12, color:'var(--text)', minWidth:90 }}>{c.courseCode} • {c.section}</span>
                        {hasName ? (
                          <span style={{ fontSize:12, color:'var(--text)', flex:1, minWidth:160 }}>{courseNames[key]}</span>
                        ) : (
                          <input
                            value={courseNames[key] || ''}
                            onChange={e=>setCourseNames(p=>({...p, [key]: e.target.value}))}
                            placeholder="ชื่อวิชา"
                            style={{ padding:'5px 8px', border:'1px solid #fca5a5', borderRadius:6, fontSize:12, fontFamily:'Sarabun', flex:1, minWidth:160, outline:'none' }}
                          />
                        )}
                        <input
                          value={courseTeachers[key] || ''}
                          onChange={e=>setCourseTeachers(p=>({...p,[key]:e.target.value}))}
                          placeholder="ชื่ออาจารย์"
                          style={{
                            padding:'5px 10px', borderRadius:6,
                            border: hasTeacher ? '1px solid #86efac' : '1px solid #fca5a5',
                            background:'var(--surface)',
                            fontSize:12, fontFamily:'Sarabun', width:220, outline:'none'
                          }}
                        />
                        <span style={{ fontSize:11, color:'var(--text-dim)', whiteSpace:'nowrap' }}>
                          {preview.students.filter(s=>s.courseCode===c.courseCode&&s.section===c.section).length} คน
                        </span>
                      </div>
                    );
                  })}
                </div>
                {(preview.matchedFromOff||0) < preview.courses.length && (
                  <div style={{ marginTop:14, padding:'10px 14px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, fontSize:12, color:'#92400e' }}>
                    💡 รายวิชาที่ขึ้นสีแดงคือยังไม่มีในระบบ — กรอกชื่อวิชา/อาจารย์เอง หรือกลับไป Import "รายวิชาเปิดสอน" ก่อน
                  </div>
                )}
              </Card>
            </>
          )}

          {/* ── SCORES Preview ── */}
          {tab === 'scores' && preview.scores && (
            <Card style={{ overflow:'hidden', marginBottom:18 }}>
              <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border-soft)', fontWeight:700, color:'var(--text)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                <span>✅ พบคะแนนสอบ {preview.scores.length} รายการ</span>
                <span style={{ fontSize:12, color:'#0d2c6b', background:'#eff6ff', padding:'4px 12px', borderRadius:20, fontWeight:600 }}>ภาค {semester}</span>
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead><tr style={{background:'var(--surface-2)'}}>
                    {['รหัสนักศึกษา','ชื่อ-สกุล','รหัสวิชา','หมู่','คะแนน/60','คะแนน/30'].map(h=>(
                      <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:11, fontWeight:600, color:'var(--text-muted)', borderBottom:'1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {preview.scores.slice(0,12).map((s,i)=>(
                      <tr key={i} style={{borderBottom:'1px solid var(--border-soft)'}}>
                        <td style={{padding:'8px 14px',fontFamily:'monospace',fontSize:12}}>{s.studentId}</td>
                        <td style={{padding:'8px 14px',fontWeight:500}}>{s.studentName}</td>
                        <td style={{padding:'8px 14px',fontFamily:'monospace',fontSize:12}}>{s.courseCode}</td>
                        <td style={{padding:'8px 14px'}}>{s.section}</td>
                        <td style={{padding:'8px 14px',color:'#0284c7',fontWeight:600}}>{s.rawScore||'—'}</td>
                        <td style={{padding:'8px 14px',color:'#16a34a',fontWeight:600}}>{s.score30||'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.scores.length > 12 && <div style={{ padding:'10px 14px', fontSize:12, color:'var(--text-dim)' }}>... และอีก {preview.scores.length - 12} รายการ</div>}
              </div>
            </Card>
          )}

          <div style={{ display:'flex', gap:12, justifyContent:'flex-end' }}>
            <button onClick={reset} style={{ padding:'10px 22px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', cursor:'pointer', fontFamily:'Sarabun', fontSize:14 }}>← เริ่มใหม่</button>
            <button onClick={doImport} disabled={importing} style={{ padding:'10px 24px', borderRadius:8, border:'none', background: importing?'var(--text-dim)':'#0d2c6b', color:'#fff', cursor:importing?'not-allowed':'pointer', fontFamily:'Sarabun', fontSize:14, fontWeight:700 }}>
              {importing ? 'กำลังนำเข้า...' : (
                tab === 'offerings' ? `บันทึก ${Object.keys(preview.map||{}).length} รายวิชา (ภาค ${semester})` :
                tab === 'students'  ? `นำเข้า ${preview.students?.length||0} รายการ` :
                `นำเข้า ${preview.scores?.length||0} รายการ`
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Done */}
      {step === 3 && importResult && (
        <Card style={{ padding:40, textAlign:'center' }}>
          <div style={{ fontSize:64, marginBottom:16 }}>✅</div>
          <div style={{ fontSize:22, fontWeight:700, color:'#16a34a', marginBottom:8 }}>นำเข้าสำเร็จ!</div>
          <div style={{ fontSize:15, color:'var(--text-muted)', marginBottom:24 }}>
            {tab === 'offerings' ? `บันทึกรายวิชาเปิดสอนภาค ${semester}` : 'นำเข้าข้อมูล'} ทั้งหมด <strong>{importResult.imported}</strong> รายการเรียบร้อย
          </div>
          {tab === 'offerings' && (
            <div style={{ marginBottom:20, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{ fontSize:13, color:'#7c3aed' }}>
                💡 ตอนนี้สามารถนำเข้า "รายชื่อนักศึกษาที่ติด I" และระบบจะ matching ข้อมูลให้อัตโนมัติ
              </div>
              {(importResult.created > 0 || importResult.updatedAccounts > 0) && (
                <div style={{ padding:'10px 14px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, fontSize:13, color:'#16a34a' }}>
                  👤 สร้างบัญชีอาจารย์ใหม่ <strong>{importResult.created}</strong> บัญชี
                  {importResult.updatedAccounts > 0 && <> • อัปเดตบัญชีเดิม <strong>{importResult.updatedAccounts}</strong> บัญชี</>}
                  <div style={{ marginTop:4, fontSize:12, color:'#166534' }}>
                    🔑 อาจารย์ Login ได้ด้วย <strong>รหัสอาจารย์</strong> เป็นทั้ง username และ password ทันที
                  </div>
                </div>
              )}
              {importResult.synced > 0 && (
                <div style={{ padding:'8px 14px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, fontSize:12, color:'#16a34a' }}>
                  🔄 อัปเดตข้อมูลนักศึกษาเดิม <strong>{importResult.synced}</strong> รายการให้ตรงกับข้อมูลใหม่แล้ว
                </div>
              )}
            </div>
          )}
          <button onClick={reset} style={{ padding:'10px 28px', borderRadius:8, border:'none', background:'#0d2c6b', color:'#fff', cursor:'pointer', fontFamily:'Sarabun', fontSize:14, fontWeight:700 }}>นำเข้าไฟล์อื่น</button>
        </Card>
      )}
    </div>
  );
};

Object.assign(window, { AdminImport });
