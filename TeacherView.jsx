// Teacher View - Dashboard + Score Search (filtered to own courses)

const TeacherView = ({ user, onLogout, theme, toggleTheme }) => {
  const [tab, setTab] = React.useState('scores');
  const [studentsTabVisible, setStudentsTabVisible] = React.useState(false);
  const [allStudents, setAllStudents] = React.useState([]);
  const [students, setStudents] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [filterStatus, setFilterStatus] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [selectedSemester, setSelectedSemester] = React.useState('');
  const [availableSemesters, setAvailableSemesters] = React.useState([]);
  const [teacherCourses, setTeacherCourses] = React.useState([]); // [{courseCode,section,courseName}] for selected sem

  // Score tab states — auto-loads on mount
  const [scoreResults, setScoreResults] = React.useState(null);
  const [scoreLoading, setScoreLoading] = React.useState(false);
  const [scoreSemester, setScoreSemester] = React.useState('');

  const teacherId = user.username; // rหัสอาจารย์ = username

  // ── Load system settings: admin controls students-tab visibility ──
  React.useEffect(() => {
    window.API.getSettings().then(res => {
      const visible = !!(res.data && res.data.teacherStudentsTabVisible);
      setStudentsTabVisible(visible);
      setTab(visible ? 'students' : 'scores');
    }).catch(() => {});
  }, []);

  // ── Normalize helpers: courseCode→7 digits, section→3 digits ──
  const padCourse  = (c) => String(c == null ? '' : c).replace(/\D/g, '').padStart(7, '0');
  const padSection = (s) => String(s == null ? '' : s).replace(/\D/g, '').padStart(3, '0');
  const courseKey  = (code, sec) => padCourse(code) + '_' + padSection(sec);
  const hasTeacher = (offering) => {
    const ids = Array.isArray(offering?.teacherIds) ? offering.teacherIds : (offering?.teacherId ? [offering.teacherId] : []);
    return ids.map(String).includes(String(teacherId));
  };

  // ── Get this teacher's course+section keys for a specific semester ──
  const getCourseAccessForSemester = React.useCallback(async (sem) => {
    const res = await window.API.getCourseOfferings(sem);
    const offeringsRaw = res.data || {};
    const arr = Array.isArray(offeringsRaw) ? offeringsRaw : Object.values(offeringsRaw);
    // Match offerings to this teacher by teacherId, return normalized course+section keys
    const myKeys = arr
      .filter(hasTeacher)
      .map(o => courseKey(o.courseCode, o.section));
    return [...new Set(myKeys)];
  }, [teacherId]);

  // ── Normalize courseAccess to always be an array ──────────────
  const normalizeCourseAccess = (ca) => {
    if (!ca) return [];
    if (Array.isArray(ca)) return ca.filter(Boolean);
    return String(ca).split(',').map(s => s.trim()).filter(Boolean);
  };

  // Teacher's full course list across all semesters (for header chips / warnings)
  const courseAccess = normalizeCourseAccess(user.courseAccess);

  // ── Load ALL students once (filtering happens per-semester below) ──
  React.useEffect(() => {
    window.API.getStudents({}).then(res => {
      const data = res.data || [];
      setAllStudents(data);
      // Derive available semesters from student data — sort descending
      const sems = [...new Set(data.map(s => s.semester).filter(Boolean))].sort((a, b) => {
        const [ta, ya] = String(a).split('/').map(Number);
        const [tb, yb] = String(b).split('/').map(Number);
        return yb !== ya ? yb - ya : tb - ta;
      });
      setAvailableSemesters(sems);
      const latest = sems[0] || '';
      setSelectedSemester(latest);
      setScoreSemester(latest);
      setLoading(false);
    }).catch(() => { setAllStudents([]); setLoading(false); });
  }, []);

  // ── When semester changes, show ONLY this teacher's course+section ──
  React.useEffect(() => {
    if (!selectedSemester) { setStudents([]); setTeacherCourses([]); return; }
    window.API.getCourseOfferings(selectedSemester).then(res => {
      const raw = res.data || {};
      const arr = Array.isArray(raw) ? raw : Object.values(raw);
      const mine = arr.filter(hasTeacher);
      setTeacherCourses(mine.map(o => ({ courseCode: padCourse(o.courseCode), section: padSection(o.section), courseName: o.courseName })));
      const keySet = new Set(mine.map(o => courseKey(o.courseCode, o.section)));
      const filtered = allStudents.filter(s =>
        s.semester === selectedSemester &&
        keySet.has(courseKey(s.courseCode, s.section))
      );
      setStudents(filtered);
    }).catch(() => { setStudents([]); setTeacherCourses([]); });
  }, [selectedSemester, allStudents]);

  // ── Filter students when semester changes ──────────────────────
  const handleSemesterSelect = (sem) => {
    setSelectedSemester(sem);
    setScoreSemester(sem);
    setFilterStatus('');
    setSearch('');
  };

  // ── Auto-load scores when switching to scores tab ──────────────
  React.useEffect(() => {
    if (tab === 'scores') {
      // sync score semester to match student semester
      const sem = scoreSemester || selectedSemester;
      setScoreSemester(sem);
      loadScores(sem);
    }
  }, [tab, selectedSemester]);

  // ── Print scores report ──────────────────────────────────
  const printScores = () => {
    if (!scoreResults || scoreResults.length === 0) return;
    const groups = Object.values(scoreGroups);
    const win = window.open('', '_blank');
    const sections = groups.map(g => {
      const sorted = [...g.students].sort((a,b) => Number(b.score30||0) - Number(a.score30||0));
      const scores30 = window.examStatsValues(sorted);
      const avg = scores30.length ? (scores30.reduce((a,b)=>a+b,0)/scores30.length).toFixed(2) : '—';
      const rows = sorted.map((s, i) => `<tr><td style="text-align:center">${i+1}</td><td>${window.escapeHtml(s.studentId)}</td><td>${window.escapeHtml(s.studentName||'—')}</td><td style="text-align:center">${window.escapeHtml(s.rawScore||'—')}</td><td style="text-align:center;font-weight:700">${window.escapeHtml(window.formatExamScore(s))}</td></tr>`).join('');
      return `<div class="course">
        <div class="course-head"><strong>${window.escapeHtml(g.courseCode)} ${window.escapeHtml(g.courseName||'')}</strong> • หมู่ ${window.escapeHtml(g.section)} • ${g.students.length} คน • เฉลี่ย ${avg}</div>
        <table><thead><tr><th style="width:36px">ที่</th><th style="width:130px">รหัสนักศึกษา</th><th>ชื่อ - สกุล</th><th style="width:90px">คะแนนดิบ</th><th style="width:90px">คะแนนที่ได้/เต็ม</th></tr></thead><tbody>${rows}</tbody></table>
      </div>`;
    }).join('');
    win.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">
      <title>คะแนนสอบปลายภาครอบ 2 ${scoreSemester ? 'ภาค '+scoreSemester : ''}</title>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        @page { size: A4; margin: 15mm; }
        body { font-family:'Sarabun',sans-serif; color:#111; font-size:13px; }
        h1 { font-size:17px; text-align:center; margin:0 0 2px; }
        .sub { text-align:center; font-size:12px; color:#555; margin-bottom:18px; }
        .course { margin-bottom:22px; page-break-inside:avoid; }
        .course-head { background:#f0f0f0; padding:7px 10px; border:1px solid #999; border-bottom:none; font-size:13px; }
        table { width:100%; border-collapse:collapse; }
        th,td { border:1px solid #999; padding:5px 8px; font-size:12px; text-align:left; }
        th { background:#f7f7f7; }
        .foot { margin-top:28px; font-size:12px; display:flex; justify-content:space-between; }
      </style></head><body>
      <h1>คะแนนสอบปลายภาครอบ 2</h1>
      <div class="sub">งานวิชาศึกษาทั่วไป มหาวิทยาลัยราชภัฏพระนคร${scoreSemester ? ' • ภาคเรียน '+window.escapeHtml(scoreSemester) : ''} • ผู้สอน: ${window.escapeHtml(user.displayName||'')} • รวม ${scoreResults.length} คน</div>
      ${sections}
      <div class="notice" style="margin-top:20px; border:1px solid #999; background:#f7f7f7; padding:10px 14px; font-size:12.5px; line-height:1.7;">
        <strong>หมายเหตุ:</strong> ขอความอนุเคราะห์อาจารย์ผู้สอนนำคะแนนสอบปลายภาครอบ 2 ข้างต้น
        ไปดำเนินการกรอกใน <strong>แบบฟอร์มส่งผลการเรียน (เปลี่ยนผลการเรียนจากระดับคะแนน I)</strong>
        และส่งกลับมายังงานวิชาศึกษาทั่วไป เพื่อดำเนินการแก้ไขผลการเรียนให้แล้วเสร็จตามกำหนดต่อไป
      </div>
      <div class="foot"><span>พิมพ์เมื่อ ${new Date().toLocaleString('th-TH')}</span></div>
      <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 400); };<\/script>
      </body></html>`);
    win.document.close();
  };

  const loadScores = async (sem) => {
    setScoreLoading(true);
    const targetSem = sem || selectedSemester;
    if (!targetSem) { setScoreResults([]); setScoreLoading(false); return; }
    try {
      const semKeys = new Set(await getCourseAccessForSemester(targetSem));
      const res = await window.API.getExamScores({ scoresOnly:true, semester:targetSem });
      const withScores = (res.data || []).filter(s =>
        semKeys.has(courseKey(s.courseCode, s.section)) &&
        s.score30 !== null && s.score30 !== '' && s.score30 !== undefined && Number(s.score30) >= 0 &&
        s.rawScore && s.rawScore !== ''
      );
      setScoreResults(withScores);
    } catch (_) { setScoreResults([]); }
    finally { setScoreLoading(false); }
  };

  const handleSemesterChange = (sem) => {
    setScoreSemester(sem);
    loadScores(sem);
  };

  // ── Students tab derived data ──────────────────────────────────
  const filtered = students.filter(s => {
    if (filterStatus && s.status !== filterStatus) return false;
    if (search && !s.studentName?.includes(search) && !s.studentId?.includes(search)) return false;
    return true;
  });

  const groups = filtered.reduce((acc, s) => {
    const key = `${s.courseCode}_${s.section}`;
    if (!acc[key]) acc[key] = { courseCode: s.courseCode, courseName: s.courseName, section: s.section, students: [] };
    acc[key].students.push(s);
    return acc;
  }, {});

  const stats = {
    total: students.length,
    done: students.filter(s => s.status === 'เสร็จสิ้น').length,
    waiting: students.filter(s => s.status === 'รออาจารย์แก้เกรด').length,
  };

  // ── Score tab derived data: group by course+section ───────────
  const scoreGroups = (scoreResults || []).reduce((acc, s) => {
    const key = `${s.courseCode}_${s.section}`;
    if (!acc[key]) acc[key] = { courseCode: s.courseCode, courseName: s.courseName, section: s.section, students: [] };
    acc[key].students.push(s);
    return acc;
  }, {});

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', fontFamily:'Sarabun, sans-serif' }}>
      {/* Navbar */}
      <div style={{ background:'#0d2c6b', color:'#fff', padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', height:56, boxShadow:'0 2px 8px rgba(0,0,0,.2)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:20 }}>🎓</span>
          <div>
            <div style={{ fontWeight:700, fontSize:15 }}>ระบบติดตามเกรด I</div>
            <div style={{ fontSize:11, opacity:.65 }}>ผู้สอน: {user.displayName}</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {teacherCourses.length > 0 && (
            <div style={{ fontSize:11, opacity:.6, display:'flex', gap:4, flexWrap:'wrap', maxWidth:240 }}>
              {[...new Set(teacherCourses.map(c => c.courseCode))].map(c => <span key={c} style={{ background:'rgba(255,255,255,.12)', padding:'2px 8px', borderRadius:10 }}>{c}</span>)}
            </div>
          )}
          <button onClick={toggleTheme} title="สลับโหมด" style={{ background:'rgba(255,255,255,.12)', border:'1px solid rgba(255,255,255,.2)', color:'#fff', width:36, height:34, borderRadius:8, cursor:'pointer', fontSize:15 }}>{theme === 'dark' ? '☀️' : '🌙'}</button>
          <button onClick={onLogout} style={{ background:'rgba(255,255,255,.12)', border:'1px solid rgba(255,255,255,.2)', color:'#fff', padding:'6px 16px', borderRadius:8, cursor:'pointer', fontSize:13, fontFamily:'Sarabun' }}>ออกจากระบบ</button>
        </div>
      </div>

      <div style={{ maxWidth:1000, margin:'0 auto', padding:'24px 16px' }}>

        {/* ── Tabs ── */}
        <div style={{ display:'flex', gap:6, marginBottom:20, borderBottom:'1px solid var(--border)' }}>
          {[
            ...(studentsTabVisible ? [{ id:'students', icon:'👥', label:'นักศึกษาที่ติด I' }] : []),
            { id:'scores',   icon:'📊', label:'คะแนนสอบปลายภาครอบ 2' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding:'10px 20px', border:'none',
              borderBottom: tab===t.id ? '3px solid #0d2c6b' : '3px solid transparent',
              background:'transparent', cursor:'pointer', fontFamily:'Sarabun',
              fontSize:14, fontWeight: tab===t.id ? 700 : 500,
              color: tab===t.id ? '#0d2c6b' : 'var(--text-muted)',
              marginBottom:-1, display:'flex', alignItems:'center', gap:6,
            }}>
              {t.icon} {t.label}
              {t.id === 'scores' && scoreResults !== null && (
                <span style={{ background:'#0d2c6b', color:'#fff', padding:'1px 8px', borderRadius:10, fontSize:11, fontWeight:600 }}>
                  {(scoreResults || []).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ─── TAB 1: Students with I (admin-controlled visibility) ─── */}
        {tab === 'students' && studentsTabVisible && <>

          {/* Semester selector */}
          {availableSemesters.length > 1 && (
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:18, flexWrap:'wrap' }}>
              <span style={{ fontSize:13, color:'var(--text-muted)', whiteSpace:'nowrap' }}>ภาคการศึกษา:</span>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {availableSemesters.map(sem => {
                  const active = selectedSemester === sem;
                  return (
                    <button key={sem} onClick={() => handleSemesterSelect(sem)} style={{
                      padding:'5px 14px', borderRadius:20, border:'none', cursor:'pointer',
                      fontFamily:'Sarabun', fontSize:13, fontWeight: active ? 700 : 400,
                      background: active ? '#0d2c6b' : 'var(--surface-2)',
                      color: active ? '#fff' : 'var(--text-muted)',
                      transition:'background .15s',
                    }}>
                      {sem}
                      {active && <span style={{ marginLeft:6, background:'rgba(255,255,255,.25)', borderRadius:10, padding:'1px 6px', fontSize:11 }}>
                        {students.length} คน
                      </span>}
                    </button>
                  );
                })}
              </div>
              {selectedSemester && (
                <div style={{ fontSize:12, color:'var(--text-dim)', marginLeft:4 }}>
                  🕐 เทอมล่าสุด
                </div>
              )}
            </div>
          )}

          {/* Latest semester badge (single semester) */}
          {availableSemesters.length === 1 && selectedSemester && (
            <div style={{ marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:13, color:'var(--text-muted)' }}>ภาคการศึกษา:</span>
              <span style={{ background:'#0d2c6b', color:'#fff', padding:'4px 14px', borderRadius:20, fontSize:13, fontWeight:700 }}>
                {selectedSemester}
              </span>
              <span style={{ fontSize:12, color:'var(--text-dim)' }}>🕐 เทอมล่าสุด</span>
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:20 }}>
            <StatCard label="นักศึกษาที่ติด I" value={stats.total} icon="👥" color="#0d2c6b" />
            <StatCard label="รออาจารย์แก้เกรด" value={stats.waiting} icon="⏳" color="#7c3aed" />
            <StatCard label="เสร็จสิ้นแล้ว" value={stats.done} icon="✅" color="#16a34a" />
          </div>

          <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, padding:'12px 18px', marginBottom:20, fontSize:13, color:'#1e40af' }}>
            📌 ข้อมูลด้านล่างเป็นรายชื่อนักศึกษาที่ติด I เฉพาะในรายวิชาของคุณ — หากมีนักศึกษาติดต่อส่งงาน แจ้ง GE เพื่ออัปเดตสถานะ
          </div>

          <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 ค้นหาชื่อ / รหัสนักศึกษา"
              style={{ flex:1, minWidth:200, padding:'9px 14px', borderRadius:8, border:'1px solid var(--border)', fontSize:14, fontFamily:'Sarabun', outline:'none' }} />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ padding:'9px 14px', borderRadius:8, border:'1px solid var(--border)', fontSize:14, fontFamily:'Sarabun', background:'var(--surface)', outline:'none' }}>
              <option value="">ทุกสถานะ</option>
              {Object.keys(STATUS_META).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {loading ? <Spinner /> : Object.keys(groups).length === 0 ? (
            <EmptyState icon="📚" title="ไม่พบข้อมูล" sub="ไม่มีนักศึกษาที่ติด I ในรายวิชาของคุณ" />
          ) : (
            Object.values(groups).map((group, gi) => (
              <Card key={gi} style={{ marginBottom:18, overflow:'hidden' }}>
                <div style={{ background:'var(--surface-3)', padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:15, color:'#0d2c6b' }}>{group.courseName || group.courseCode}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>รหัสวิชา {group.courseCode} • หมู่ {group.section} • {group.students.length} คน</div>
                  </div>
                  <div style={{ fontSize:13, color:'var(--text-muted)' }}>
                    เสร็จ {group.students.filter(s=>s.status==='เสร็จสิ้น').length}/{group.students.length}
                  </div>
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
                    <thead><tr style={{ background:'var(--surface-2)' }}>
                      {['รหัสนักศึกษา','ชื่อ-สกุล','เกรด I','สาเหตุ','คะแนนสอบปลายภาครอบ 2','สถานะ'].map(h => (
                        <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:'var(--text-muted)', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {group.students.map((s, si) => (
                        <tr key={si} style={{ borderBottom:'1px solid var(--border-soft)' }}
                          onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <td style={{ padding:'10px 14px', fontFamily:'monospace', fontSize:13, color:'var(--text)' }}>{s.studentId}</td>
                          <td style={{ padding:'10px 14px', fontWeight:500, color:'var(--text)' }}>{s.studentName || <span style={{color:'var(--text-dim)'}}>ยังไม่ระบุ</span>}</td>
                          <td style={{ padding:'10px 14px' }}><GradeBadge grade={s.bracketGrade} /></td>
                          <td style={{ padding:'10px 14px' }}><CauseBadge cause={s.cause} /></td>
                          <td style={{ padding:'10px 14px', fontSize:13 }}>
                            {s.examScore ? <span style={{color:'#0284c7',fontWeight:600}}>{s.examScore} ({window.formatExamScore(s)})</span> : <span style={{color:'var(--text-dim)'}}>—</span>}
                          </td>
                          <td style={{ padding:'10px 14px' }}><StatusBadge status={s.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))
          )}
        </>}

        {/* ─── TAB 2: Round 2 Exam Scores ─── */}
        {tab === 'scores' && <>
          {/* Header + semester filter */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:12 }}>
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:'var(--text)' }}>📊 คะแนนสอบปลายภาครอบ 2</div>
              <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:3 }}>
                แสดงเฉพาะนักศึกษาที่มีข้อมูลคะแนนแล้ว — วิชาในความรับผิดชอบของคุณเท่านั้น
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <label style={{ fontSize:13, color:'var(--text-muted)', whiteSpace:'nowrap' }}>ภาคการศึกษา</label>
              <select value={scoreSemester} onChange={e => handleSemesterChange(e.target.value)}
                style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', fontSize:14, fontFamily:'Sarabun', background:'var(--surface)', minWidth:140 }}>
                {availableSemesters.map(s => <option key={s} value={s}>ภาค {s}</option>)}
              </select>
              <button onClick={() => loadScores(scoreSemester)} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', cursor:'pointer', fontSize:13, fontFamily:'Sarabun' }}>🔄</button>
              <button onClick={printScores} disabled={!scoreResults || scoreResults.length === 0} style={{ padding:'8px 16px', borderRadius:8, border:'none', background: (!scoreResults || scoreResults.length===0) ? '#9ca3af' : '#0d2c6b', color:'#fff', cursor: (!scoreResults || scoreResults.length===0) ? 'not-allowed' : 'pointer', fontSize:13, fontFamily:'Sarabun', fontWeight:600, whiteSpace:'nowrap' }}>🖨️ ปริ้นคะแนน</button>
            </div>
          </div>

          {/* No course warning — only when teacher truly has no offerings this semester */}
          {!loading && selectedSemester && teacherCourses.length === 0 && (
            <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:10, padding:'14px 18px', marginBottom:16, fontSize:13, color:'#92400e' }}>
              ⚠️ บัญชีของคุณยังไม่ได้ระบุรายวิชาที่รับผิดชอบ — Admin สามารถอัปเดตสิทธิ์ได้ที่เมนูตั้งค่าระบบ
            </div>
          )}

          {scoreLoading ? <Spinner /> : (scoreResults !== null && (scoreResults || []).length === 0) ? (
            <EmptyState icon="📋" title="ยังไม่มีข้อมูลคะแนน"
              sub="ยังไม่มีนักศึกษาในวิชาของคุณที่มีคะแนนสอบปลายภาครอบ 2 หรือ Admin ยังไม่ได้ Import ข้อมูลคะแนน" />
          ) : scoreResults !== null ? (
            <>
              <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:14 }}>
                พบ <strong style={{color:'#0d2c6b'}}>{scoreResults.length}</strong> รายการ
                ใน <strong>{Object.keys(scoreGroups).length}</strong> วิชา
                <span style={{ marginLeft:8, background:'#f0fdf4', color:'#16a34a', padding:'2px 10px', borderRadius:10, fontSize:12, fontWeight:600 }}>
                  ✓ มีคะแนนครบทุกคนที่แสดง
                </span>
              </div>
              {Object.values(scoreGroups).map((g, gi) => {
                const scores30 = window.examStatsValues(g.students);
                const avg = scores30.length ? (scores30.reduce((a,b)=>a+b,0)/scores30.length).toFixed(2) : '—';
                const max = scores30.length ? Math.max(...scores30) : '—';
                const min = scores30.length ? Math.min(...scores30) : '—';
                return (
                  <Card key={gi} style={{ marginBottom:18, overflow:'hidden' }}>
                    <div style={{ background:'var(--surface-3)', padding:'14px 20px', borderBottom:'1px solid var(--border)' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:10 }}>
                        <div>
                          <div style={{ fontWeight:700, fontSize:16, color:'#0d2c6b' }}>{g.courseName || g.courseCode}</div>
                          <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:3 }}>รหัสวิชา {g.courseCode} • หมู่ {g.section} • {g.students.length} คน</div>
                        </div>
                        <div style={{ display:'flex', gap:16, fontSize:12 }}>
                          {[{label:'เฉลี่ย',val:avg,color:'#0d2c6b'},{label:'สูงสุด',val:max,color:'#16a34a'},{label:'ต่ำสุด',val:min,color:'#dc2626'}].map(x=>(
                            <div key={x.label} style={{ textAlign:'center' }}>
                              <div style={{ color:'var(--text-dim)' }}>{x.label}</div>
                              <div style={{ color:x.color, fontWeight:700, fontSize:18 }}>{x.val}<span style={{fontSize:11,color:'var(--text-dim)',fontWeight:400}}></span></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
                        <thead><tr style={{background:'var(--surface-2)'}}>
                          {['#','รหัสนักศึกษา','ชื่อ-สกุล','คะแนนดิบ','คะแนนที่ได้/เต็ม'].map(h=>(
                            <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:'var(--text-muted)', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {g.students
                            .sort((a,b) => Number(b.score30||0) - Number(a.score30||0))
                            .map((s, si) => (
                            <tr key={si} style={{ borderBottom:'1px solid var(--border-soft)' }}
                              onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'}
                              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                              <td style={{ padding:'9px 14px', color:'var(--text-dim)', fontSize:12 }}>{si+1}</td>
                              <td style={{ padding:'9px 14px', fontFamily:'monospace', fontSize:13, color:'var(--text)' }}>{s.studentId}</td>
                              <td style={{ padding:'9px 14px', fontWeight:500, color:'var(--text)' }}>{s.studentName || <span style={{color:'var(--text-dim)'}}>—</span>}</td>
                              <td style={{ padding:'9px 14px', color:'#0284c7', fontWeight:600 }}>{s.rawScore}</td>
                              <td style={{ padding:'9px 14px', fontWeight:700, fontSize:16, color:'#16a34a' }}>{window.formatExamScore(s)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                );
              })}
            </>
          ) : <Spinner />}
        </>}
      </div>
    </div>
  );
};

Object.assign(window, { TeacherView });
