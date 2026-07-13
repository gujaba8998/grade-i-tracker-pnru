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
    <div style={{
      minHeight:'100vh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      background:'linear-gradient(135deg, #0d2c6b 0%, #1a4499 60%, #0d2c6b 100%)',
      position:'relative',
      padding:24, fontFamily:'Sarabun, sans-serif'
    }}>
      {/* Theme toggle (floating) */}
      <button onClick={toggleTheme} title="สลับโหมดสว่าง/มืด" style={{
        position:'absolute', top:18, right:18, width:40, height:40, borderRadius:10,
        border:'1px solid rgba(255,255,255,.25)', background:'rgba(255,255,255,.12)',
        color:'#fff', cursor:'pointer', fontSize:18,
      }}>{theme === 'dark' ? '☀️' : '🌙'}</button>

      {/* Logo + Title */}
      <div style={{ textAlign:'center', marginBottom:36 }}>
        <div style={{ width:72, height:72, borderRadius:'50%', background:'rgba(255,255,255,.15)', border:'2px solid rgba(255,255,255,.4)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, margin:'0 auto 14px' }}>🎓</div>
        <div style={{ color:'#fff', fontSize:22, fontWeight:700, lineHeight:1.3 }}>ระบบติดตามการแก้ไขเกรด I</div>
        <div style={{ color:'rgba(255,255,255,.65)', fontSize:14, marginTop:6 }}>วิชาศึกษาทั่วไป มหาวิทยาลัยราชภัฏพระนคร</div>
      </div>

      {/* Card */}
      <div style={{ background:'var(--surface)', borderRadius:16, boxShadow:'0 20px 60px rgba(0,0,0,.3)', width:'100%', maxWidth:420, overflow:'hidden' }}>

        {!mode ? (
          // Role selector
          <div style={{ padding:'32px 32px 28px' }}>
            <div style={{ fontSize:16, fontWeight:600, color:'var(--text)', marginBottom:20, textAlign:'center' }}>เข้าสู่ระบบในฐานะ</div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { key:'admin', icon:'🛡️', title:'ผู้ดูแลระบบ (Admin)', sub:'จัดการข้อมูลและติดตามสถานะ', color:'#0d2c6b' },
                { key:'teacher', icon:'👨‍🏫', title:'อาจารย์ผู้สอน', sub:'ดูรายชื่อนักศึกษาในรายวิชา', color:'#1a4499' },
                { key:'student', icon:'🎒', title:'นักศึกษา', sub:'ตรวจสอบสถานะการแก้ไขเกรด I', color:'var(--text)' },
              ].map(r => (
                <button key={r.key} onClick={() => { setMode(r.key); setError(''); }} style={{
                  display:'flex', alignItems:'center', gap:14, padding:'14px 18px',
                  borderRadius:10, border:`2px solid #e5e7eb`, background:'var(--surface-2)',
                  cursor:'pointer', textAlign:'left', transition:'all .15s',
                  fontFamily:'Sarabun, sans-serif',
                }}
                  onMouseEnter={e => { e.currentTarget.style.border=`2px solid ${r.color}`; e.currentTarget.style.background='#f0f4ff'; }}
                  onMouseLeave={e => { e.currentTarget.style.border='2px solid #e5e7eb'; e.currentTarget.style.background='var(--surface-2)'; }}
                >
                  <span style={{ fontSize:26 }}>{r.icon}</span>
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
            {mode === 'admin' && (
              <div style={{ marginTop:14, padding:'10px 14px', background:'#f0f9ff', borderRadius:8, fontSize:12, color:'#0369a1' }}>
                💡 <strong>Demo:</strong> username: <code>admin</code> / password: <code>admin123</code>
              </div>
            )}
            {mode === 'teacher' && (
              <div style={{ marginTop:14, padding:'10px 14px', background:'#f0fdf4', borderRadius:8, fontSize:12, color:'#166534' }}>
                🔑 <strong>Login อาจารย์:</strong> ใช้ <strong>รหัสอาจารย์</strong> เป็นทั้ง username และ password<br/>
                <span style={{ color:'var(--text-dim)', marginTop:3, display:'block' }}>รหัสอาจารย์จะถูกสร้างอัตโนมัติเมื่อ Admin Import รายวิชาเปิดสอน</span>
              </div>
            )}
          </form>
        )}
      </div>

      <div style={{ color:'rgba(255,255,255,.4)', fontSize:12, marginTop:20 }}>งานวิชาศึกษาทั่วไป • ภาคการศึกษา 2/2568</div>
    </div>
  );
};

Object.assign(window, { Login });
