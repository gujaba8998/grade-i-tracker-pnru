// Shared UI Components
// Exported to window for use across all views

const STATUS_OPTIONS = {
  'ขาดสอบ':      ['รอดำเนินการ','รออาจารย์แก้เกรด','เสร็จสิ้น','ส่งงานทะเบียนแล้ว'],
  'ส่งงานไม่ครบ': ['รอดำเนินการ','ส่งงานแล้ว','รออาจารย์แก้เกรด','เสร็จสิ้น','ส่งงานทะเบียนแล้ว'],
};

const STATUS_META = {
  'รอดำเนินการ':       { color: '#6b7280', bg: '#f3f4f6', label: 'รอดำเนินการ' },
  'ส่งงานแล้ว':         { color: '#d97706', bg: '#fffbeb', label: 'ส่งงานแล้ว' },
  'รออาจารย์แก้เกรด':   { color: '#7c3aed', bg: '#f5f3ff', label: 'รออาจารย์แก้เกรด' },
  'เสร็จสิ้น':           { color: '#16a34a', bg: '#f0fdf4', label: 'อาจารย์แก้เกรดแล้ว' },
  'ส่งงานทะเบียนแล้ว':  { color: '#0d2c6b', bg: '#eff6ff', label: 'ส่งงานทะเบียนแล้ว' },
};

const CAUSE_META = {
  'ขาดสอบ':      { color: '#dc2626', bg: '#fef2f2', icon: '📋' },
  'ส่งงานไม่ครบ': { color: '#d97706', bg: '#fffbeb', icon: '📝' },
};

const GRADE_COLORS = {
  'A': '#16a34a','B+': '#0284c7','B': '#0284c7',
  'C+': '#7c3aed','C': '#7c3aed','D+': '#d97706',
  'D': '#d97706','E': '#dc2626'
};

// ── Theme (dark mode) ──────────────────────────────────────────
const useTheme = () => {
  const [theme, setTheme] = React.useState(() => localStorage.getItem('grade_i_theme') || 'light');
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('grade_i_theme', theme);
  }, [theme]);
  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark');
  return { theme, toggle, setTheme };
};

const ThemeToggle = ({ theme, toggle, compact }) => (
  <button onClick={toggle} title={theme === 'dark' ? 'โหมดสว่าง' : 'โหมดมืด'} style={{
    display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8,
    width: compact ? 38 : 'auto', height:38, padding: compact ? 0 : '0 14px',
    borderRadius:9, border:'1px solid var(--border)', background:'var(--surface-2)',
    color:'var(--text-muted)', cursor:'pointer', fontFamily:'Sarabun', fontSize:14,
  }}>
    <span style={{ fontSize:16 }}>{theme === 'dark' ? '☀️' : '🌙'}</span>
    {!compact && (theme === 'dark' ? 'สว่าง' : 'มืด')}
  </button>
);

// ── Badge ──────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const m = STATUS_META[status] || STATUS_META['รอดำเนินการ'];
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:600,
      color: m.color, background: m.bg, border:`1px solid ${m.color}22`,
      whiteSpace:'nowrap'
    }}>{m.label}</span>
  );
};

const CauseBadge = ({ cause }) => {
  const m = CAUSE_META[cause] || CAUSE_META['ส่งงานไม่ครบ'];
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:500,
      color: m.color, background: m.bg, border:`1px solid ${m.color}22`
    }}>{cause}</span>
  );
};

const GradeBadge = ({ grade }) => (
  <span style={{
    display:'inline-flex', alignItems:'center',
    padding:'2px 8px', borderRadius:6, fontSize:13, fontWeight:700,
    color: GRADE_COLORS[grade] || '#374151',
    background: (GRADE_COLORS[grade] || '#374151') + '18',
    border: `1px solid ${GRADE_COLORS[grade] || '#374151'}33`
  }}>{grade === 'E' ? 'I(E)' : `I(${grade})`}</span>
);

// ── Card ───────────────────────────────────────────────────────
const Card = ({ children, style, className, hover }) => (
  <div className={'gi-card' + (hover ? ' gi-card-hover' : '') + (className ? ' ' + className : '')} style={{
    backgroundColor:'var(--surface)', borderRadius:12, boxShadow:'var(--shadow-sm)',
    border:'1px solid var(--border)', ...style
  }}>{children}</div>
);

const StatCard = ({ label, value, sub, color = 'var(--brand)', icon, accent }) => (
  <Card hover style={{ padding:'20px 24px', position:'relative', overflow:'hidden' }}>
    {accent && <div style={{ position:'absolute', left:0, top:0, bottom:0, width:4, background: color }}></div>}
    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
      <div>
        <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:6 }}>{label}</div>
        <div style={{ fontSize:32, fontWeight:700, color, lineHeight:1 }}>{value}</div>
        {sub && <div style={{ fontSize:12, color:'var(--text-dim)', marginTop:6 }}>{sub}</div>}
      </div>
      {icon && <div style={{ fontSize:28, opacity:.7 }}>{icon}</div>}
    </div>
  </Card>
);

// ── Donut Chart (SVG) ──────────────────────────────────────────
// segments: [{ label, value, color }]
const DonutChart = ({ segments, size = 160, thickness = 26, centerLabel, centerSub }) => {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div style={{ display:'flex', alignItems:'center', gap:24, flexWrap:'wrap' }}>
      <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
        <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={thickness} />
          {segments.map((seg, i) => {
            const frac = seg.value / total;
            const dash = frac * circumference;
            const el = (
              <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                stroke={seg.color} strokeWidth={thickness}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                style={{ transition:'stroke-dasharray .6s ease, stroke-dashoffset .6s ease' }} />
            );
            offset += dash;
            return el;
          })}
        </svg>
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
          <div style={{ fontSize:30, fontWeight:700, color:'var(--text)', lineHeight:1 }}>{centerLabel}</div>
          {centerSub && <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:3 }}>{centerSub}</div>}
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8, flex:1, minWidth:140 }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13 }}>
            <span style={{ width:11, height:11, borderRadius:3, background:seg.color, flexShrink:0 }}></span>
            <span style={{ color:'var(--text-muted)', flex:1 }}>{seg.label}</span>
            <span style={{ color:'var(--text)', fontWeight:700 }}>{seg.value}</span>
            <span style={{ color:'var(--text-dim)', fontSize:11, width:38, textAlign:'right' }}>
              {Math.round(seg.value / total * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Progress Ring (SVG) ────────────────────────────────────────
const ProgressRing = ({ percent = 0, size = 120, thickness = 12, color = '#16a34a', label }) => {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const dash = (percent / 100) * c;
  return (
    <div style={{ position:'relative', width:size, height:size }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={thickness} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={thickness}
          strokeLinecap="round" strokeDasharray={`${dash} ${c - dash}`}
          style={{ transition:'stroke-dasharray 1s ease' }} />
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        <div style={{ fontSize:size*0.22, fontWeight:700, color:'var(--text)', lineHeight:1 }}>{percent}%</div>
        {label && <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:2 }}>{label}</div>}
      </div>
    </div>
  );
};

// ── Modal ──────────────────────────────────────────────────────
const Modal = ({ open, onClose, title, children, width = 540 }) => {
  if (!open) return null;
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center',
      background:'rgba(0,0,0,.5)', padding:16, animation:'fadeIn .15s ease'
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <Card style={{ width:'100%', maxWidth:width, maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'var(--shadow-lg)', animation:'modalPop .2s ease' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 24px', borderBottom:'1px solid var(--border)' }}>
          <span style={{ fontWeight:700, fontSize:16, color:'var(--text)' }}>{title}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'var(--text-dim)', lineHeight:1 }}>×</button>
        </div>
        <div style={{ padding:'20px 24px', overflowY:'auto', flex:1 }}>{children}</div>
      </Card>
    </div>
  );
};

// ── Toast ──────────────────────────────────────────────────────
const ToastContext = React.createContext(null);
const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = React.useState([]);
  const show = React.useCallback((msg, type='success', action) => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, msg, type, action }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), action ? 6000 : 3500);
  }, []);
  const dismiss = (id) => setToasts(p => p.filter(t => t.id !== id));
  const TOAST_COLORS = { success:'#16a34a', error:'#dc2626', info:'#0284c7', warning:'#d97706' };
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div style={{ position:'fixed', bottom:24, right:24, zIndex:9999, display:'flex', flexDirection:'column', gap:10 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background:'#1f2937', color:'#fff', padding:'12px 18px', borderRadius:10,
            borderLeft:`4px solid ${TOAST_COLORS[t.type]}`,
            boxShadow:'0 4px 16px rgba(0,0,0,.25)', fontSize:14, maxWidth:360,
            display:'flex', alignItems:'center', gap:14, animation:'toastIn .25s ease'
          }}>
            <span style={{ flex:1 }}>{t.msg}</span>
            {t.action && (
              <button onClick={() => { t.action.onClick(); dismiss(t.id); }} style={{
                background:'rgba(255,255,255,.15)', border:'none', color:'#fff',
                padding:'5px 12px', borderRadius:7, cursor:'pointer', fontFamily:'Sarabun', fontSize:13, fontWeight:600, whiteSpace:'nowrap'
              }}>{t.action.label}</button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
const useToast = () => React.useContext(ToastContext);

// ── Spinner ────────────────────────────────────────────────────
const Spinner = ({ size = 32 }) => (
  <div style={{ display:'flex', justifyContent:'center', alignItems:'center', padding:40 }}>
    <div style={{
      width:size, height:size, border:`3px solid var(--border)`,
      borderTop:`3px solid var(--brand)`, borderRadius:'50%',
      animation:'spin 0.8s linear infinite'
    }}></div>
  </div>
);

// ── Skeleton loading ───────────────────────────────────────────
const Skeleton = ({ w = '100%', h = 16, r = 6, style }) => (
  <div className="gi-skeleton" style={{ width:w, height:h, borderRadius:r, ...style }}></div>
);

const SkeletonTable = ({ rows = 6, cols = 6 }) => (
  <Card style={{ overflow:'hidden' }}>
    <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)' }}>
      <Skeleton w={180} h={18} />
    </div>
    <div style={{ padding:'8px 18px' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display:'flex', gap:16, padding:'12px 0', borderBottom:'1px solid var(--border)' }}>
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} w={`${100/cols}%`} h={14} />
          ))}
        </div>
      ))}
    </div>
  </Card>
);

const SkeletonCards = ({ count = 4 }) => (
  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:14 }}>
    {Array.from({ length: count }).map((_, i) => (
      <Card key={i} style={{ padding:'20px 24px' }}>
        <Skeleton w={90} h={12} style={{ marginBottom:12 }} />
        <Skeleton w={60} h={28} />
      </Card>
    ))}
  </div>
);

// ── Empty State ────────────────────────────────────────────────
const EmptyState = ({ icon = '📭', title, sub }) => (
  <div style={{ textAlign:'center', padding:'48px 24px', color:'var(--text-dim)' }}>
    <div style={{ fontSize:48, marginBottom:12 }}>{icon}</div>
    <div style={{ fontSize:16, fontWeight:600, color:'var(--text-muted)', marginBottom:6 }}>{title}</div>
    {sub && <div style={{ fontSize:13, whiteSpace:'pre-line' }}>{sub}</div>}
  </div>
);

// ── Confirm Dialog ─────────────────────────────────────────────
const ConfirmDialog = ({ open, title, message, onConfirm, onCancel, danger }) => (
  <Modal open={open} onClose={onCancel} title={title} width={400}>
    <p style={{ margin:'0 0 20px', color:'var(--text-muted)', lineHeight:1.6 }}>{message}</p>
    <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
      <button onClick={onCancel} style={{ padding:'8px 20px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', cursor:'pointer', fontFamily:'Sarabun' }}>ยกเลิก</button>
      <button onClick={onConfirm} style={{ padding:'8px 20px', borderRadius:8, border:'none', background: danger ? '#dc2626' : 'var(--brand)', color:'#fff', cursor:'pointer', fontFamily:'Sarabun', fontWeight:600 }}>ยืนยัน</button>
    </div>
  </Modal>
);

// Export all shared components
Object.assign(window, {
  STATUS_OPTIONS, STATUS_META, CAUSE_META, GRADE_COLORS,
  StatusBadge, CauseBadge, GradeBadge,
  Card, StatCard, Modal, Spinner, EmptyState, ConfirmDialog,
  ToastProvider, ToastContext, useToast,
  useTheme, ThemeToggle, DonutChart, ProgressRing,
  Skeleton, SkeletonTable, SkeletonCards,
});
