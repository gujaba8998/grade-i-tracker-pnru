// Login Screen - 3 paths: Admin, Teacher, Student (no login)

const Login = ({ onLogin, theme, toggleTheme }) => {
  const [mode, setMode] = React.useState(null); // null | 'admin' | 'teacher' | 'student'
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [studentId, setStudentId] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleStaffLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const result = await window.API.login(username, password);
      if (result.success) onLogin({ ...result, username });
      else setError(result.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    } catch { setError('เกิดข้อผิดพลาด กรุณาลองใหม่'); }
    setLoading(false);
  };

  const handleStudentLookup = (e) => {
    e.preventDefault();
    if (!studentId.trim()) { setError('กรุณากรอกรหัสนักศึกษา'); return; }
    onLogin({ success: true, role: 'student', studentId: studentId.trim(), displayName: studentId.trim() });
  };

  return (
    <div className="ge-login-stage" style={{
      minHeight:'100vh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      backgroundImage:'linear-gradient(90deg, rgba(4,40,89,.93) 0%, rgba(6,55,112,.78) 52%, rgba(4,42,90,.44) 100%), url("assets/grade-progress-hero.png")',
      backgroundSize:'cover', backgroundPosition:'center',
      position:'relative',
      padding:24, fontFamily:"'Noto Sans Thai', Sarabun, sans-serif"
    }}>
      {/* Theme toggle (floating) */}
      <button onClick={toggleTheme} title="สลับโหมดสว่าง/มืด" style={{
        position:'absolute', top:22, right:24, width:42, height:42, borderRadius:12,
        border:'1px solid rgba(255,255,255,.3)', background:'rgba(4,35,79,.28)',
        color:'#fff', cursor:'pointer', fontSize:18,
      }}>{theme === 'dark' ? '☀️' : '🌙'}</button>

      {/* Logo + Title */}
      <div style={{ textAlign:'center', marginBottom:26 }}>
        <div className="ge-brand-plaque" style={{ width:242, height:72, margin:'0 auto 18px' }}>
          <img src="assets/logo-ge.png" alt="Phranakhon General Education" />
        </div>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, color:'#dbeeff', fontSize:11, letterSpacing:1.3, textTransform:'uppercase', fontWeight:700 }}>
          <span style={{ width:30, height:2, background:'#bdd52a' }} /> Grade I management
        </div>
        <div style={{ color:'#fff', fontSize:26, fontWeight:700, lineHeight:1.32, marginTop:8 }}>ระบบติดตามการแก้ไขเกรด I</div>
        <div style={{ color:'rgba(255,255,255,.78)', fontSize:14, marginTop:5 }}>วิชาศึกษาทั่วไป มหาวิทยาลัยราชภัฏพระนคร</div>
      </div>

      {/* Card */}
      <div style={{ background:'rgba(255,255,255,.98)', borderRadius:22, boxShadow:'0 26px 70px rgba(1,22,55,.32)', width:'100%', maxWidth:438, overflow:'hidden', border:'1px solid rgba(255,255,255,.55)' }}>

        {!mode ? (
          // Role selector
          <div style={{ padding:'30px 32px 30px' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#0b6f92', marginBottom:5, textAlign:'center', letterSpacing:.4 }}>เลือกบทบาทของคุณ</div>
            <div style={{ fontSize:18, fontWeight:700, color:'#10253b', marginBottom:22, textAlign:'center' }}>เข้าสู่ระบบเพื่อดำเนินการต่อ</div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { key:'admin', icon:'🛡️', title:'ผู้ดูแลระบบ', sub:'จัดการข้อมูลและติดตามสถานะ', color:'#0b3f7a', soft:'#edf4ff' },
                { key:'teacher', icon:'👨‍🏫', title:'อาจารย์ผู้สอน', sub:'ดูข้อมูลเฉพาะรายวิชาที่รับผิดชอบ', color:'#0789b6', soft:'#e8f8fc' },
                { key:'student', icon:'🎒', title:'นักศึกษา', sub:'ตรวจสอบสถานะการแก้ไขเกรด I', color:'#7a9100', soft:'#f4f8df' },
              ].map(r => (
                <button className="ge-role-option" key={r.key} onClick={() => { setMode(r.key); setError(''); }} style={{
                  '--role-accent':r.color,
                  display:'flex', alignItems:'center', gap:14, padding:'14px 18px',
                  borderRadius:13, border:'1px solid #dfe8ef', background:'#fff',
                  cursor:'pointer', textAlign:'left', transition:'all .15s',
                  fontFamily:"'Noto Sans Thai', Sarabun, sans-serif",
                }}
                  onMouseEnter={e => { e.currentTarget.style.border=`1px solid ${r.color}`; e.currentTarget.style.background=r.soft; e.currentTarget.style.transform='translateX(3px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.border='1px solid #dfe8ef'; e.currentTarget.style.background='#fff'; e.currentTarget.style.transform='none'; }}
                >
                  <span style={{ fontSize:26, width:40, height:40, borderRadius:12, display:'grid', placeItems:'center', background:r.soft }}>{r.icon}</span>
                  <div>
                    <div style={{ fontWeight:700, fontSize:15, color:'var(--text)' }}>{r.title}</div>
                    <div style={{ fontSize:12, color:'var(--text-dim)', marginTop:2 }}>{r.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : mode === 'student' ? (
          // Student ID lookup
          <form onSubmit={handleStudentLookup} style={{ padding:'32px 32px 28px' }}>
            <button onClick={() => setMode(null)} style={{ background:'none', border:'none', color:'#0d2c6b', cursor:'pointer', fontSize:13, marginBottom:16, padding:0, fontFamily:'Sarabun' }}>← กลับ</button>
            <div style={{ fontSize:18, fontWeight:700, color:'var(--text)', marginBottom:6 }}>🎒 ตรวจสอบสถานะเกรด I</div>
            <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:24 }}>ไม่ต้องลงชื่อเข้าใช้ — กรอกรหัสนักศึกษาเพียงอย่างเดียว</div>
            {error && <div style={{ background:'#fef2f2', color:'#dc2626', padding:'10px 14px', borderRadius:8, fontSize:13, marginBottom:16 }}>{error}</div>}
            <label style={{ fontSize:13, fontWeight:600, color:'var(--text)', display:'block', marginBottom:6 }}>รหัสนักศึกษา</label>
            <input value={studentId} onChange={e => setStudentId(e.target.value)} placeholder="เช่น 6810122561019" style={{ width:'100%', padding:'11px 14px', borderRadius:8, border:'2px solid #e5e7eb', fontSize:15, fontFamily:'Sarabun', outline:'none', boxSizing:'border-box', letterSpacing:1 }} autoFocus />
            <button type="submit" style={{ marginTop:16, width:'100%', padding:'12px', borderRadius:8, border:'none', background:'#0d2c6b', color:'#fff', fontWeight:700, fontSize:15, cursor:'pointer', fontFamily:'Sarabun' }}>ตรวจสอบสถานะ</button>
          </form>
        ) : (
          // Admin / Teacher login
          <form onSubmit={handleStaffLogin} style={{ padding:'32px 32px 28px' }}>
            <button onClick={() => setMode(null)} style={{ background:'none', border:'none', color:'#0d2c6b', cursor:'pointer', fontSize:13, marginBottom:16, padding:0, fontFamily:'Sarabun' }}>← กลับ</button>
            <div style={{ fontSize:18, fontWeight:700, color:'var(--text)', marginBottom:4 }}>
              {mode === 'admin' ? '🛡️ Admin' : '👨‍🏫 อาจารย์ผู้สอน'}
            </div>
            <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:24 }}>กรุณาเข้าสู่ระบบด้วยบัญชีที่ได้รับ</div>
            {error && <div style={{ background:'#fef2f2', color:'#dc2626', padding:'10px 14px', borderRadius:8, fontSize:13, marginBottom:16 }}>{error}</div>}
            <label style={{ fontSize:13, fontWeight:600, color:'var(--text)', display:'block', marginBottom:6 }}>ชื่อผู้ใช้</label>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder={mode === 'admin' ? 'admin' : 'teacher'} style={{ width:'100%', padding:'11px 14px', borderRadius:8, border:'2px solid #e5e7eb', fontSize:14, fontFamily:'Sarabun', outline:'none', boxSizing:'border-box', marginBottom:14 }} autoFocus />
            <label style={{ fontSize:13, fontWeight:600, color:'var(--text)', display:'block', marginBottom:6 }}>รหัสผ่าน</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ width:'100%', padding:'11px 14px', borderRadius:8, border:'2px solid #e5e7eb', fontSize:14, fontFamily:'Sarabun', outline:'none', boxSizing:'border-box' }} />
            <button type="submit" disabled={loading} style={{ marginTop:20, width:'100%', padding:'12px', borderRadius:8, border:'none', background: loading ? 'var(--text-dim)' : '#0d2c6b', color:'#fff', fontWeight:700, fontSize:15, cursor: loading ? 'not-allowed' : 'pointer', fontFamily:'Sarabun' }}>
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>
            {mode === 'admin' && window.API.isDemo && (
              <div style={{ marginTop:14, padding:'10px 14px', background:'#f0f9ff', borderRadius:8, fontSize:12, color:'#0369a1' }}>
                💡 <strong>Demo:</strong> username: <code>admin</code> / password: <code>admin123</code>
              </div>
            )}
            {mode === 'teacher' && (
              <div style={{ marginTop:14, padding:'10px 14px', background:'#f0fdf4', borderRadius:8, fontSize:12, color:'#166534' }}>
                🔑 <strong>Login อาจารย์:</strong> ใช้บัญชีที่ได้รับจากผู้ดูแลระบบ
                {window.API.isDemo && <span style={{ color:'var(--text-dim)', marginTop:3, display:'block' }}>Demo: teacher1 / teacher1</span>}
              </div>
            )}
          </form>
        )}
      </div>

      <button type="button" onClick={() => {
        if (window.API.isDemo) window.API.useDefaultGasUrl(); else window.API.useDemo();
        window.location.reload();
      }} style={{ marginTop:16, background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.2)', color:'rgba(255,255,255,.75)', padding:'7px 14px', borderRadius:8, cursor:'pointer', fontFamily:'Sarabun', fontSize:12 }}>
        {window.API.isDemo ? '↩ กลับไปใช้ระบบจริง' : 'ทดลองใช้งาน Demo Mode'}
      </button>
      <div style={{ color:'rgba(255,255,255,.4)', fontSize:12, marginTop:12 }}>งานวิชาศึกษาทั่วไป</div>
    </div>
  );
};

Object.assign(window, { Login });
