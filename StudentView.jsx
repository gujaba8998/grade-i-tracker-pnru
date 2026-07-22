// Student View - lookup by student ID (no login required)

const StudentView = ({ studentId, onBack, theme, toggleTheme }) => {
  const [records, setRecords] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setLoading(true); setError('');
    window.API.lookupStudent(studentId)
      .then(res => {
        if (!res.success) setError(res.error || 'ไม่สามารถค้นหาข้อมูลได้');
        setRecords(res.data || []);
      })
      .catch(() => setError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่'))
      .finally(() => setLoading(false));
  }, [studentId]);

  const STEPS = {
    'ขาดสอบ': [
      { key:'รอดำเนินการ',      label:'รอดำเนินการ',      desc:'GE กำลังรวบรวมข้อมูลและประสานงาน' },
      { key:'รออาจารย์แก้เกรด', label:'รออาจารย์แก้เกรด', desc:'GE แจ้งอาจารย์ผู้สอนเรียบร้อยแล้ว' },
      { key:'เสร็จสิ้น',        label:'แก้ไขเกรดเสร็จสิ้น', desc:'อาจารย์ดำเนินการแก้ไขเกรดเรียบร้อย' },
    ],
    'ส่งงานไม่ครบ': [
      { key:'รอดำเนินการ',       label:'รอดำเนินการ',       desc:'ยังไม่ได้ติดต่ออาจารย์' },
      { key:'ส่งงานแล้ว',       label:'ส่งงานแล้ว',         desc:'ส่งงานให้อาจารย์เรียบร้อย' },
      { key:'รออาจารย์แก้เกรด', label:'รออาจารย์แก้เกรด', desc:'อาจารย์กำลังดำเนินการ' },
      { key:'เสร็จสิ้น',        label:'แก้ไขเกรดเสร็จสิ้น', desc:'ดำเนินการเสร็จสมบูรณ์' },
    ],
  };

  const getStepIndex = (cause, status) => {
    const steps = STEPS[cause] || STEPS['ส่งงานไม่ครบ'];
    return steps.findIndex(s => s.key === status);
  };

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', fontFamily:'Sarabun' }}>
      <Spinner />
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', fontFamily:'Sarabun, sans-serif' }}>
      {/* Header */}
      <div style={{ background:'linear-gradient(135deg, #0d2c6b, #1a4499)', padding:'20px 24px', color:'#fff', position:'relative' }}>
        <button onClick={toggleTheme} title="สลับโหมด" style={{ position:'absolute', top:16, right:16, background:'rgba(255,255,255,.12)', border:'1px solid rgba(255,255,255,.2)', color:'#fff', width:36, height:34, borderRadius:8, cursor:'pointer', fontSize:15 }}>{theme === 'dark' ? '☀️' : '🌙'}</button>
        <button onClick={onBack} style={{ background:'none', border:'none', color:'rgba(255,255,255,.7)', cursor:'pointer', fontSize:13, marginBottom:10, padding:0, fontFamily:'Sarabun', display:'flex', alignItems:'center', gap:6 }}>← กลับหน้าหลัก</button>
        <div style={{ fontSize:20, fontWeight:700 }}>สถานะการแก้ไขเกรด I</div>
        <div style={{ fontSize:14, opacity:.75, marginTop:4 }}>รหัสนักศึกษา: {studentId}</div>
      </div>

      <div style={{ maxWidth:680, margin:'0 auto', padding:'24px 16px' }}>
        {error ? (
          <EmptyState icon="⚠️" title="เกิดข้อผิดพลาด" sub={error} />
        ) : records.length === 0 ? (
          <EmptyState icon="🔍" title="ไม่พบข้อมูล" sub={`ไม่พบรหัสนักศึกษา ${studentId} ในระบบ\nหากมีข้อสงสัยติดต่องานวิชาศึกษาทั่วไป`} />
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <div style={{ fontSize:14, color:'var(--text-muted)' }}>พบ {records.length} รายวิชา ที่มีเกรด I</div>
            {records.map((r, idx) => {
              const steps = STEPS[r.cause] || STEPS['ส่งงานไม่ครบ'];
              const currentStep = getStepIndex(r.cause, r.status);
              const isDone = r.status === 'เสร็จสิ้น';

              return (
                <Card key={idx} style={{ overflow:'hidden' }}>
                  {/* Course header */}
                  <div style={{ background: isDone ? '#f0fdf4' : 'var(--surface-2)', padding:'16px 20px', borderBottom:'1px solid var(--border-soft)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8 }}>
                      <div>
                        <div style={{ fontWeight:700, fontSize:16, color:'var(--text)' }}>{r.courseName || r.courseCode}</div>
                        <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:3 }}>รหัสวิชา {r.courseCode} หมู่ {r.section} • {r.teacher || 'ไม่ระบุอาจารย์'}</div>
                      </div>
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <GradeBadge grade={r.bracketGrade} />
                        <CauseBadge cause={r.cause} />
                      </div>
                    </div>
                    {r.examScore && (
                      <div style={{ marginTop:10, display:'inline-flex', alignItems:'center', gap:8, background:'#e0f2fe', padding:'6px 14px', borderRadius:20, fontSize:13 }}>
                        📊 คะแนนสอบปลายภาครอบ 2: <strong>{r.examScore}</strong> (เทียบเท่า {r.examScoreOutOf30}/30 คะแนน)
                      </div>
                    )}
                  </div>

                  {/* Progress steps */}
                  <div style={{ padding:'20px 20px 16px' }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:16 }}>ขั้นตอนการดำเนินการ</div>
                    {steps.map((step, si) => {
                      const done = si < currentStep || isDone;
                      const active = si === currentStep && !isDone;
                      return (
                        <div key={si} style={{ display:'flex', gap:12, marginBottom: si < steps.length-1 ? 0 : 0 }}>
                          <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                            <div style={{
                              width:28, height:28, borderRadius:'50%', flexShrink:0,
                              display:'flex', alignItems:'center', justifyContent:'center',
                              fontSize:13, fontWeight:700,
                              background: done ? '#16a34a' : active ? '#0d2c6b' : 'var(--border)',
                              color: (done || active) ? '#fff' : 'var(--text-dim)',
                              border: active ? '3px solid #93c5fd' : 'none',
                            }}>
                              {done ? '✓' : si+1}
                            </div>
                            {si < steps.length-1 && (
                              <div style={{ width:2, flex:1, minHeight:20, background: done ? '#16a34a' : 'var(--border)', margin:'2px 0' }}></div>
                            )}
                          </div>
                          <div style={{ paddingBottom: si < steps.length-1 ? 16 : 0 }}>
                            <div style={{ fontSize:14, fontWeight: active ? 700 : 500, color: done ? '#16a34a' : active ? '#0d2c6b' : 'var(--text-dim)' }}>{step.label}</div>
                            {(done || active) && <div style={{ fontSize:12, color:'var(--text-dim)', marginTop:2 }}>{step.desc}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Action hint */}
                  {!isDone && (
                    <div style={{ padding:'12px 20px', background:'#fffbeb', borderTop:'1px solid #fef3c7' }}>
                      {r.cause === 'ขาดสอบ' && r.status === 'รอดำเนินการ' && (
                        <div style={{ fontSize:13, color:'#92400e' }}>⏳ <strong>รอดำเนินการ:</strong> งานวิชาศึกษาทั่วไปกำลังรวบรวมข้อมูลและประสานงาน</div>
                      )}
                      {r.cause === 'ส่งงานไม่ครบ' && r.status === 'รอดำเนินการ' && (
                        <div style={{ fontSize:13, color:'#92400e' }}>💡 <strong>สิ่งที่ต้องทำ:</strong> ติดต่ออาจารย์ผู้สอน ({r.teacher || '—'}) เพื่อส่งงานที่ค้างชำระ</div>
                      )}
                      {r.status === 'รออาจารย์แก้เกรด' && (
                        <div style={{ fontSize:13, color:'#92400e' }}>⏳ <strong>รอผล:</strong> อาจารย์กำลังดำเนินการแก้ไขเกรด</div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}

            <div style={{ textAlign:'center', fontSize:12, color:'var(--text-dim)', paddingTop:8 }}>
              มีข้อสงสัยติดต่องานวิชาศึกษาทั่วไป มหาวิทยาลัยราชภัฏพระนคร
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

Object.assign(window, { StudentView });
