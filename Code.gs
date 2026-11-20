// ===============================================================
// ระบบติดตามการแก้ไขเกรด I — Google Apps Script Backend
// เวอร์ชัน 2.0 (อัปเดตครบทุกฟีเจอร์)
//
// วิธีใช้:
// 1. วางโค้ดทั้งหมดนี้ใน Google Apps Script Editor
// 2. แก้ SPREADSHEET_ID ด้านล่าง
// 3. รัน setupSpreadsheet() ครั้งเดียว
// 4. Deploy → New Deployment → Web App → Anyone → Copy URL
// 5. วาง URL ใน ระบบ → ตั้งค่าระบบ → Google Apps Script URL
// ===============================================================

const SPREADSHEET_ID = 'REPLACE_WITH_YOUR_SPREADSHEET_ID';

// ======== Sheet definitions ========
const SHEET_HEADERS = {
  students: [
    'studentId','studentName','courseCode','courseName','section',
    'teacher','semester','bracketGrade','cause','examScore',
    'examScoreOutOf30','status','newGrade','statusUpdatedAt','statusUpdatedBy','notes'
  ],
  examScores: [
    'studentId','studentName','courseCode','courseName','section',
    'rawScore','score30','semester','importedAt'
  ],
  users: ['username','password','role','displayName','courseAccess'],
  log:   ['timestamp','action','studentId','studentName','courseCode','section','semester','field','oldValue','newValue','updatedBy'],
  // courseOfferings and sectionTeachers stored as JSON in PropertiesService (faster)
};

// ======== Helpers ========
function ss() { return SpreadsheetApp.openById(SPREADSHEET_ID); }

function getSheet(name) {
  const spreadsheet = ss();
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
    const headers = SHEET_HEADERS[name];
    if (headers) sheet.appendRow(headers);
    if (name === 'users') {
      const initialPassword = Utilities.getUuid().replace(/-/g, '').slice(0, 12);
      sheet.appendRow(['admin',hashPassword(initialPassword),'admin','ผู้ดูแลระบบ (GE)','']);
      Logger.log('Initial Admin password (change after first login): ' + initialPassword);
    }
  }
  return sheet;
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] === '' ? '' : row[i]; });
    return obj;
  });
}

function jsonOut(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function normCourseGAS(v) {
  const digits = String(v == null ? '' : v).replace(/\D/g, '');
  return digits ? digits.padStart(7, '0') : '';
}

function normSectionGAS(v) {
  const digits = String(v == null ? '' : v).replace(/\D/g, '');
  return digits ? digits.padStart(3, '0') : '';
}

function recordKeyGAS(studentId, courseCode, section, semester) {
  return [normSemGAS(semester), String(studentId || '').trim(), normCourseGAS(courseCode), normSectionGAS(section)].join('|');
}

function hashPassword(password, salt) {
  const actualSalt = salt || Utilities.getUuid().replace(/-/g, '');
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    actualSalt + ':' + String(password),
    Utilities.Charset.UTF_8
  );
  const hash = bytes.map(function(b) { return ('0' + ((b < 0 ? b + 256 : b).toString(16))).slice(-2); }).join('');
  return 'sha256$' + actualSalt + '$' + hash;
}

function verifyPassword(password, stored) {
  const value = String(stored || '');
  if (value.indexOf('sha256$') !== 0) return value === String(password);
  const parts = value.split('$');
  return parts.length === 3 && hashPassword(password, parts[1]) === value;
}

function createSession(user) {
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const session = {
    username: String(user.username),
    role: String(user.role),
    displayName: String(user.displayName || user.username),
    courseAccess: user.courseAccess || []
  };
  CacheService.getScriptCache().put('session_' + token, JSON.stringify(session), 21600);
  return { token: token, session: session };
}

function getSession(token) {
  if (!token) return null;
  const raw = CacheService.getScriptCache().get('session_' + String(token));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (err) { return null; }
}

function requireSession(token, roles) {
  const session = getSession(token);
  if (!session) throw new Error('UNAUTHORIZED');
  if (roles && roles.length && roles.indexOf(session.role) < 0) throw new Error('FORBIDDEN');
  return session;
}

function deleteSession(token) {
  if (token) CacheService.getScriptCache().remove('session_' + String(token));
  return { success: true };
}

function withWriteLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function addLog(action, studentId, studentName, courseCode, section, semester, field, oldVal, newVal, by) {
  getSheet('log').appendRow([
    new Date().toISOString(), action, String(studentId), String(studentName||''),
    String(courseCode||''), String(section||''), String(semester||''),
    String(field), String(oldVal), String(newVal), by || '-'
  ]);
}

function getLogs(p) {
  const sheet = getSheet('log');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: true, data: [] };
  let rows = data.slice(1).map(r => ({
    timestamp: r[0], action: r[1], studentId: r[2], studentName: r[3],
    courseCode: r[4], section: r[5], semester: r[6],
    field: r[7], from: r[8], to: r[9], by: r[10]
  })).reverse();
  if (p.studentId) rows = rows.filter(l => String(l.studentId) === String(p.studentId));
  if (p.semester)  rows = rows.filter(l => String(l.semester) === p.semester);
  if (p.action)    rows = rows.filter(l => l.action === p.action);
  return { success: true, data: rows };
}

function clearLogs() {
  const sheet = getSheet('log');
  if (sheet.getLastRow() > 1) sheet.deleteRows(2, sheet.getLastRow() - 1);
  return { success: true };
}

// ======== System Settings (key-value sheet) ========
function getSettingsSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('settings');
  if (!sheet) {
    sheet = ss.insertSheet('settings');
    sheet.appendRow(['key', 'value']);
  }
  return sheet;
}

function getSettings() {
  const data = getSettingsSheet().getDataRange().getValues();
  const out = {};
  for (var i = 1; i < data.length; i++) {
    var v = data[i][1];
    if (v === 'true') v = true; else if (v === 'false') v = false;
    out[data[i][0]] = v;
  }
  return { success: true, data: out };
}

function updateSettings(patch) {
  const sheet = getSettingsSheet();
  const data = sheet.getDataRange().getValues();
  Object.keys(patch || {}).forEach(function (key) {
    var val = String(patch[key]);
    var found = false;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === key) { sheet.getRange(i + 1, 2).setValue(val); found = true; break; }
    }
    if (!found) sheet.appendRow([key, val]);
  });
  return { success: true };
}

// PropertiesService key helpers (for JSON blobs)
function getProp(key) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  return v ? JSON.parse(v) : null;
}
function setProp(key, val) {
  PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(val));
}

// ======== Auth ========
// Flexible column helper — tries multiple names for the same field
function uCol(u) {
  var args = Array.prototype.slice.call(arguments, 1);
  for (var i = 0; i < args.length; i++) {
    if (u[args[i]] !== undefined && u[args[i]] !== '') return u[args[i]];
  }
  return '';
}

function teacherUsername(value) {
  const name = String(value == null ? '' : value).trim();
  return /^\d{1,7}$/.test(name) ? name.padStart(7, '0') : name;
}

function userColumns(headers) {
  const find = (...names) => names.map(name => headers.indexOf(name)).find(index => index >= 0) ?? -1;
  return { username: find('username'), password: find('password'), role: find('role'),
    displayName: find('displayName', 'ชื่อ', 'name'), courseAccess: find('courseAccess', 'active', 'courses') };
}

function matchingUserRows(data, cols, username, reservingTeacherId) {
  const name = String(username == null ? '' : username).trim();
  const matches = [];
  if (!name || cols.username < 0 || cols.role < 0) return matches;
  for (let i = 1; i < data.length; i++) {
    const stored = String(data[i][cols.username]).trim();
    if (stored === name || ((reservingTeacherId || data[i][cols.role] === 'teacher') && teacherUsername(stored) === teacherUsername(name))) matches.push(i);
  }
  return matches;
}

function writeUsername(sheet, row, column, username) {
  const cell = sheet.getRange(row, column);
  cell.setNumberFormat('@');
  cell.setValue(username);
}

function doLogin(username, password) {
  const loginCache = CacheService.getScriptCache();
  const attemptKey = 'login_fail_' + teacherUsername(username).toLowerCase();
  const failedAttempts = Number(loginCache.get(attemptKey) || 0);
  if (failedAttempts >= 5) return { success:false, error:'ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอ 15 นาที' };
  const sheet = getSheet('users');
  const data = sheet.getDataRange().getValues();
  const headers = data[0] || [];
  const passwordCol = headers.indexOf('password');
  let user = null, userRow = -1;
  const matches = matchingUserRows(data, userColumns(headers), username);
  if (matches.length === 1 && passwordCol >= 0 && verifyPassword(password, data[matches[0]][passwordCol])) {
    const i = matches[0];
    user = {};
    headers.forEach((h, ci) => { user[h] = data[i][ci]; });
    userRow = i + 1;
  }
  if (!user) {
    loginCache.put(attemptKey, String(failedAttempts + 1), 900);
    return { success: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
  }
  loginCache.remove(attemptKey);
  // Transparently migrate legacy plain-text passwords after a valid login.
  if (String(user.password || '').indexOf('sha256$') !== 0) {
    sheet.getRange(userRow, passwordCol + 1).setValue(hashPassword(password));
  }
  const accountName = user.role === 'teacher' ? teacherUsername(user.username) : String(user.username);
  const displayName = uCol(user, 'displayName', 'ชื่อ', 'name') || accountName;
  const courseAccessRaw = uCol(user, 'courseAccess', 'active', 'courses');
  const access = courseAccessRaw ? String(courseAccessRaw).split(',').map(function(s){return s.trim();}).filter(Boolean) : [];
  const created = createSession({ username: accountName, role: user.role, displayName: displayName, courseAccess: access });
  return {
    success: true, token: created.token, username: accountName,
    role: user.role, displayName: displayName, courseAccess: access
  };
}

// ======== Students ========
function offeringTeacherIds(offering) {
  if (!offering) return [];
  if (Array.isArray(offering.teacherIds)) return offering.teacherIds.map(String);
  return offering.teacherId ? [String(offering.teacherId)] : [];
}

function teacherOfferingKeys(username, semester) {
  const all = getProp('courseOfferings') || {};
  const semesters = semester ? [semester] : Object.keys(all);
  const keys = {};
  semesters.forEach(function(sem) {
    Object.keys(all[sem] || {}).forEach(function(key) {
      if (offeringTeacherIds(all[sem][key]).indexOf(String(username)) >= 0) {
        keys[normSemGAS(sem) + '|' + key] = true;
      }
    });
  });
  return keys;
}

function getStudents(params, session) {
  let list = sheetToObjects(getSheet('students'));
  if (params.studentId)    list = list.filter(s => String(s.studentId)  === String(params.studentId));
  if (params.courseCode)   list = list.filter(s => s.courseCode  === params.courseCode);
  if (params.status)       list = list.filter(s => s.status      === params.status);
  if (params.cause)        list = list.filter(s => s.cause       === params.cause);
  if (params.teacher)      list = list.filter(s => s.teacher     === params.teacher);
  if (params.semester)     list = list.filter(s => normSemGAS(s.semester) === params.semester);
  if (params.courseAccess) {
    const acc = String(params.courseAccess).split(',').map(s=>s.trim()).filter(Boolean);
    if (acc.length) list = list.filter(s => acc.includes(s.courseCode));
  }
  if (session && session.role === 'teacher') {
    const allowed = teacherOfferingKeys(session.username, params.semester);
    list = list.filter(function(s) {
      const key = normSemGAS(s.semester) + '|' + normCourseGAS(s.courseCode) + '_' + normSectionGAS(s.section);
      return !!allowed[key];
    });
  }
  return { success: true, data: list };
}

function lookupStudent(studentId) {
  if (!/^\d{10,15}$/.test(String(studentId || '').trim())) {
    return { success: false, error: 'รหัสนักศึกษาไม่ถูกต้อง', data: [] };
  }
  const safeFields = ['studentId','courseCode','courseName','section','teacher','semester','bracketGrade','cause','examScore','examScoreOutOf30','status','newGrade'];
  const rows = getStudents({ studentId: String(studentId).trim() }, null).data;
  return { success: true, data: rows.map(function(row) {
    const out = {};
    safeFields.forEach(function(k) { out[k] = row[k] === undefined ? '' : row[k]; });
    return out;
  }) };
}

function updateStatus(payload) {
  const allowedStatuses = ['รอดำเนินการ','ส่งงานแล้ว','รออาจารย์แก้เกรด','เสร็จสิ้น','ส่งงานทะเบียนแล้ว'];
  const allowedGrades = ['A','B+','B','C+','C','D+','D','E'];
  if (!payload.semester) return { success:false, error:'ไม่พบภาคการศึกษาของรายการ' };
  if (allowedStatuses.indexOf(payload.status) < 0) return { success:false, error:'สถานะไม่ถูกต้อง' };
  if (payload.newGrade !== undefined && payload.newGrade !== '' && allowedGrades.indexOf(String(payload.newGrade)) < 0) {
    return { success:false, error:'เกรดใหม่ไม่ถูกต้อง' };
  }
  const sheet = getSheet('students');
  const data  = sheet.getDataRange().getValues();
  const h     = data[0];
  const col   = name => h.indexOf(name);

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][col('studentId')]) === String(payload.studentId) &&
        normCourseGAS(data[i][col('courseCode')]) === normCourseGAS(payload.courseCode) &&
        normSectionGAS(data[i][col('section')]) === normSectionGAS(payload.section) &&
        normSemGAS(data[i][col('semester')]) === normSemGAS(payload.semester)) {

      const oldStatus = data[i][col('status')];
      const oldGrade  = col('newGrade') > -1 ? data[i][col('newGrade')] : '';
      const sName     = col('studentName') > -1 ? data[i][col('studentName')] : '';
      const sem       = col('semester') > -1 ? data[i][col('semester')] : '';
      const r = i + 1;
      sheet.getRange(r, col('status')+1).setValue(payload.status);
      sheet.getRange(r, col('statusUpdatedAt')+1).setValue(new Date().toISOString());
      sheet.getRange(r, col('statusUpdatedBy')+1).setValue(payload.by || 'Admin');
      if (payload.notes       !== undefined) sheet.getRange(r, col('notes')+1).setValue(payload.notes);
      if (payload.examScore   !== undefined) sheet.getRange(r, col('examScore')+1).setValue(payload.examScore);
      if (payload.examScoreOutOf30 !== undefined) sheet.getRange(r, col('examScoreOutOf30')+1).setValue(payload.examScoreOutOf30);
      if (payload.newGrade    !== undefined) sheet.getRange(r, col('newGrade')+1).setValue(payload.newGrade);
      if (payload.status && payload.status !== oldStatus)
        addLog('เปลี่ยนสถานะ', payload.studentId, sName, payload.courseCode, payload.section, sem, 'สถานะ', oldStatus, payload.status, payload.by);
      if (payload.newGrade !== undefined && payload.newGrade !== oldGrade)
        addLog('แก้ไขเกรด', payload.studentId, sName, payload.courseCode, payload.section, sem, 'เกรดใหม่', oldGrade, payload.newGrade, payload.by);
      return { success: true };
    }
  }
  return { success: false, error: 'ไม่พบข้อมูลนักศึกษา' };
}

function importStudents(students, semester, clearExisting) {
  const sheet = getSheet('students');
  const targetSemester = normSemGAS(semester);
  if (!targetSemester) return { success: false, error: 'กรุณาระบุภาคการศึกษา' };
  if (clearExisting && sheet.getLastRow() > 1) {
    const existingData = sheet.getDataRange().getValues();
    const semCol = existingData[0].indexOf('semester');
    for (let i = existingData.length - 1; i >= 1; i--) {
      if (normSemGAS(existingData[i][semCol]) === targetSemester) sheet.deleteRow(i + 1);
    }
  }
  const now = new Date().toISOString();
  const current = sheet.getDataRange().getValues();
  const headers = current[0];
  const col = name => headers.indexOf(name);
  const existingByKey = {};
  for (let i = 1; i < current.length; i++) {
    const key = recordKeyGAS(current[i][col('studentId')], current[i][col('courseCode')], current[i][col('section')], current[i][col('semester')]);
    if (!existingByKey[key]) existingByKey[key] = i + 1;
  }

  const rows = [];
  let created = 0, updated = 0, skipped = 0;
  (students || []).forEach(function(s) {
    const studentId = String(s.studentId || '').trim();
    const courseCode = normCourseGAS(s.courseCode);
    const section = normSectionGAS(s.section);
    const bracketGrade = String(s.bracketGrade || '').trim().toUpperCase();
    if (!studentId || !courseCode || !section || !bracketGrade) { skipped++; return; }
    const key = recordKeyGAS(studentId, courseCode, section, targetSemester);
    const rowNumber = existingByKey[key];
    const cause = bracketGrade === 'E' ? 'ขาดสอบ' : 'ส่งงานไม่ครบ';
    if (rowNumber) {
      const values = {
        studentName: s.studentName || '', courseName: s.courseName || '',
        teacher: s.teacher || '', bracketGrade: bracketGrade, cause: cause
      };
      Object.keys(values).forEach(function(name) {
        if (col(name) >= 0) sheet.getRange(rowNumber, col(name) + 1).setValue(values[name]);
      });
      updated++;
      return;
    }
    rows.push([
      studentId, s.studentName || '', courseCode, s.courseName || '',
      section, s.teacher || '', targetSemester,
      bracketGrade, cause, s.examScore || '', s.examScoreOutOf30 || 0,
      s.status || 'รอดำเนินการ', s.newGrade || '', now, 'System', s.notes || ''
    ]);
    existingByKey[key] = -1;
    created++;
  });
  if (rows.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    // Force semester column (index 6 → col 7) to plain text BEFORE writing
    const semColIdx = SHEET_HEADERS.students.indexOf('semester');
    if (semColIdx > -1) sheet.getRange(startRow, semColIdx + 1, rows.length, 1).setNumberFormat('@');
    sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
  }
  return { success: true, imported: created + updated, created: created, updated: updated, skipped: skipped };
}

// ======== Exam Scores ========
function importExamScores(scores, semester) {
  const esSheet = getSheet('examScores');
  const targetSemester = normSemGAS(semester);
  if (!targetSemester) return { success: false, error: 'กรุณาระบุภาคการศึกษา' };
  // Remove existing rows for this semester
  if (esSheet.getLastRow() > 1) {
    const esData = esSheet.getDataRange().getValues();
    const semCol = esData[0].indexOf('semester');
    for (let i = esData.length - 1; i >= 1; i--) {
      if (normSemGAS(esData[i][semCol]) === targetSemester) esSheet.deleteRow(i + 1);
    }
  }
  const now = new Date().toISOString();
  const validScores = (scores || []).filter(function(s) {
    return s.studentId && normCourseGAS(s.courseCode) && normSectionGAS(s.section);
  });
  const rows = validScores.map(s => [
    String(s.studentId).trim(), s.studentName || '', normCourseGAS(s.courseCode), s.courseName || '',
    normSectionGAS(s.section), s.rawScore || '', Number(s.score30) || 0, targetSemester, now
  ]);
  if (rows.length > 0) {
    const startRow = esSheet.getLastRow() + 1;
    const semColIdx = SHEET_HEADERS.examScores.indexOf('semester');
    if (semColIdx > -1) esSheet.getRange(startRow, semColIdx + 1, rows.length, 1).setNumberFormat('@');
    esSheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
  }

  // Also update students sheet (match by studentId + semester)
  const stuSheet = getSheet('students');
  const stuData  = stuSheet.getDataRange().getValues();
  const sh = stuData[0];
  const sc = name => sh.indexOf(name);
  let matched = 0, unmatched = 0;
  validScores.forEach(score => {
    let found = false;
    for (let i = 1; i < stuData.length; i++) {
      if (String(stuData[i][sc('studentId')]) === String(score.studentId) &&
          normSemGAS(stuData[i][sc('semester')]) === targetSemester &&
          normCourseGAS(stuData[i][sc('courseCode')]) === normCourseGAS(score.courseCode) &&
          normSectionGAS(stuData[i][sc('section')]) === normSectionGAS(score.section)) {
        if (!stuData[i][sc('studentName')]) stuSheet.getRange(i+1, sc('studentName')+1).setValue(score.studentName || '');
        stuSheet.getRange(i+1, sc('examScore')+1).setValue(score.rawScore || '');
        stuSheet.getRange(i+1, sc('examScoreOutOf30')+1).setValue(score.score30 || 0);
        found = true;
        matched++;
        break;
      }
    }
    if (!found) unmatched++;
  });
  return { success: true, imported: validScores.length, matched: matched, unmatched: unmatched, skipped: (scores || []).length - validScores.length };
}

function getExamScores(params, session) {
  let list = sheetToObjects(getSheet('examScores'));
  if (params.semester)   list = list.filter(s => normSemGAS(s.semester) === String(params.semester));
  if (params.courseCode) list = list.filter(s => s.courseCode === params.courseCode);
  if (params.courseName) {
    const q = String(params.courseName).toLowerCase();
    list = list.filter(s => String(s.courseName || '').toLowerCase().includes(q));
  }
  if (params.section)    list = list.filter(s => s.section === params.section);
  if (params.courseAccess) {
    const acc = String(params.courseAccess).split(',').map(s=>s.trim()).filter(Boolean);
    if (acc.length) list = list.filter(s => acc.includes(s.courseCode));
  }
  if (session && session.role === 'teacher') {
    const allowed = teacherOfferingKeys(session.username, params.semester);
    list = list.filter(function(s) {
      const key = normSemGAS(s.semester) + '|' + normCourseGAS(s.courseCode) + '_' + normSectionGAS(s.section);
      return !!allowed[key];
    });
  }
  return { success: true, data: list };
}

// ======== Stats ========
function getStats(semester) {
  let students = sheetToObjects(getSheet('students'));
  if (semester) students = students.filter(s => normSemGAS(s.semester) === semester);
  const stats = { total: students.length, byStatus: {}, byCause: {}, byCourse: {} };
  students.forEach(s => {
    const st = s.status || 'รอดำเนินการ';
    stats.byStatus[st] = (stats.byStatus[st] || 0) + 1;
    stats.byCause[s.cause] = (stats.byCause[s.cause] || 0) + 1;
    const key = s.courseCode + '_' + s.section;
    if (!stats.byCourse[key]) {
      stats.byCourse[key] = {
        courseCode: s.courseCode, courseName: s.courseName,
        teacher: s.teacher, section: s.section, total: 0, done: 0
      };
    }
    stats.byCourse[key].total++;
    if (st === 'เสร็จสิ้น') stats.byCourse[key].done++;
  });
  return { success: true, data: stats };
}

// ======== Course Offerings ========
function getCourseOfferings(semester, session) {
  const all = getProp('courseOfferings') || {};
  if (!session || session.role === 'admin') return { success: true, data: semester ? (all[semester] || {}) : all };
  const filterMap = function(map) {
    const out = {};
    Object.keys(map || {}).forEach(function(key) {
      if (offeringTeacherIds(map[key]).indexOf(String(session.username)) >= 0) out[key] = map[key];
    });
    return out;
  };
  if (semester) return { success: true, data: filterMap(all[semester] || {}) };
  const filtered = {};
  Object.keys(all).forEach(function(sem) { filtered[sem] = filterMap(all[sem]); });
  return { success: true, data: filtered };
}

function saveCourseOfferings(semester, map) {
  const all = getProp('courseOfferings') || {};
  all[semester] = Object.assign({}, all[semester] || {}, map);
  setProp('courseOfferings', all);
  return { success: true, count: Object.keys(map).length };
}

function clearCourseOfferings(semester) {
  const all = getProp('courseOfferings') || {};
  delete all[semester];
  setProp('courseOfferings', all);
  return { success: true };
}

function applyCourseOfferings(semester) {
  const all      = getProp('courseOfferings') || {};
  const offerings = all[semester] || {};
  const sheet     = getSheet('students');
  const data      = sheet.getDataRange().getValues();
  const h         = data[0];
  const col       = name => h.indexOf(name);
  let updated = 0;

  for (let i = 1; i < data.length; i++) {
    if (normSemGAS(data[i][col('semester')]) !== semester) continue;
    const key = data[i][col('courseCode')] + '_' + data[i][col('section')];
    const off = offerings[key];
    if (!off) continue;
    let changed = false;
    if (off.courseName && data[i][col('courseName')] !== off.courseName) {
      sheet.getRange(i+1, col('courseName')+1).setValue(off.courseName); changed = true;
    }
    if (off.teacher && data[i][col('teacher')] !== off.teacher) {
      sheet.getRange(i+1, col('teacher')+1).setValue(off.teacher); changed = true;
    }
    if (changed) updated++;
  }
  return { success: true, updated };
}

// ======== Section Teachers Memory ========
function getSectionTeachers() {
  return { success: true, data: getProp('sectionTeachers') || {} };
}

function saveSectionTeachers(map) {
  const current = getProp('sectionTeachers') || {};
  Object.entries(map || {}).forEach(([k, v]) => { if (v) current[k] = v; });
  setProp('sectionTeachers', current);
  return { success: true };
}

// ======== Users ========
function getUsers() {
  // Never return password hashes or legacy plain-text passwords to the browser.
  const users = sheetToObjects(getSheet('users'));
  return { success: true, data: users.map(function(u) {
    return {
      username:     u.role === 'teacher' ? teacherUsername(u.username) : String(u.username),
      hasPassword:  !!u.password,
      role:         u.role,
      displayName:  uCol(u, 'displayName', 'ชื่อ', 'name') || String(u.username),
      courseAccess: uCol(u, 'courseAccess', 'active', 'courses'),
    };
  }) };
}

function addUser(u) {
  const access = Array.isArray(u.courseAccess) ? u.courseAccess.join(',') : (u.courseAccess || '');
  const sheet = getSheet('users');
  const data = sheet.getDataRange().getValues();
  if (!u.username || !u.password || ['admin','teacher'].indexOf(String(u.role)) < 0) {
    return { success:false, error:'ข้อมูลผู้ใช้ไม่ครบหรือบทบาทไม่ถูกต้อง' };
  }
  const cols = userColumns(data[0]);
  if (cols.username !== 0 || cols.role !== 2) return { success:false, error:'หัวคอลัมน์ในชีต users ไม่ตรงกับรูปแบบที่รองรับ' };
  const username = u.role === 'teacher' ? teacherUsername(u.username) : String(u.username).trim();
  if (!username || (u.role === 'teacher' && !/^\d{7}$/.test(username))) return { success:false, error:'รหัสอาจารย์ต้องเป็นตัวเลข 7 หลัก' };
  if (matchingUserRows(data, cols, username, u.role === 'teacher').length) return { success:false, error:'ชื่อผู้ใช้นี้มีอยู่แล้ว' };
  sheet.appendRow([username, hashPassword(u.password), u.role, u.displayName, access]);
  writeUsername(sheet, sheet.getLastRow(), cols.username + 1, username);
  return { success: true };
}

function updateUser(username, patch) {
  const sheet = getSheet('users');
  const data  = sheet.getDataRange().getValues();
  const cols = userColumns(data[0]);
  if (!patch || Object.values(cols).some(index => index < 0)) {
    return { success:false, error:'ข้อมูลหรือหัวคอลัมน์ในชีต users ไม่ครบ' };
  }
  const matches = matchingUserRows(data, cols, username);
  if (matches.length !== 1) return { success:false, error: matches.length ? 'พบรหัสผู้ใช้ซ้ำ กรุณาตรวจสอบชีต users' : 'ไม่พบผู้ใช้' };
  const index = matches[0];
  const row = data[index];
  const role = patch.role ?? row[cols.role];
  const rawName = String(patch.username ?? row[cols.username]).trim();
  const name = role === 'teacher' ? teacherUsername(rawName) : rawName;
  if (!name || (patch.role !== undefined && role !== row[cols.role] && !['admin','teacher'].includes(role))) return { success:false, error:'ชื่อผู้ใช้หรือบทบาทไม่ถูกต้อง' };
  if (role === 'teacher' && !/^\d{7}$/.test(name)) return { success:false, error:'รหัสอาจารย์ต้องเป็นตัวเลข 7 หลัก' };
  if (matchingUserRows(data, cols, name, role === 'teacher').some(i => i !== index)) return { success:false, error:'ชื่อผู้ใช้ใหม่ซ้ำกับที่มีอยู่' };
  writeUsername(sheet, index + 1, cols.username + 1, name);
  const write = (key, value) => sheet.getRange(index + 1, cols[key] + 1).setValue(value);
  if (patch.password) write('password', hashPassword(patch.password));
  if (patch.role !== undefined) write('role', role);
  if (patch.displayName !== undefined) write('displayName', patch.displayName);
  if (patch.courseAccess !== undefined) write('courseAccess', Array.isArray(patch.courseAccess) ? patch.courseAccess.join(',') : (patch.courseAccess || ''));
  return { success:true };
}

function deleteUser(username) {
  const sheet = getSheet('users');
  const data  = sheet.getDataRange().getValues();
  const cols = userColumns(data[0]);
  const matches = matchingUserRows(data, cols, username);
  if (matches.length !== 1) return { success:false, error: matches.length ? 'พบรหัสผู้ใช้ซ้ำ' : 'ไม่พบผู้ใช้' };
  if (String(data[matches[0]][cols.username]) === 'admin') return { success:false, error:'ไม่สามารถลบ Admin หลักได้' };
  sheet.deleteRow(matches[0] + 1);
  return { success:true };
}

function upsertTeacherAccounts(teachers) {
  const sheet = getSheet('users');
  const data  = sheet.getDataRange().getValues();
  const cols = userColumns(data[0]);
  if (cols.username !== 0 || cols.role !== 2 || cols.displayName !== 3 || cols.courseAccess !== 4) return { success:false, error:'หัวคอลัมน์ในชีต users ไม่ตรงกับรูปแบบที่รองรับ' };
  let created = 0, updated = 0;

  teachers.forEach(t => {
    const id   = teacherUsername(t.teacherId);
    if (!/^\d{7}$/.test(id)) return;
    const matches = matchingUserRows(data, cols, id, true);
    if (matches.length > 1 || (matches.length === 1 && data[matches[0]][cols.role] !== 'teacher')) return;
    const name = String(t.teacherName || id);
    const courseAccess = [...new Set((t.courses || []).map(c => c.courseCode))].join(',');
    let found = false;
    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === 'teacher' && teacherUsername(data[i][0]) === id) {
        // Merge courseAccess (union)
        const existing = String(data[i][4] || '').split(',').filter(Boolean);
        const newCodes  = courseAccess.split(',').filter(Boolean);
        const merged    = [...new Set([...existing, ...newCodes])].join(',');
        sheet.getRange(i+1, 4).setValue(name);     // displayName
        sheet.getRange(i+1, 5).setValue(merged);   // courseAccess
        data[i][4] = merged;                        // keep in-memory copy in sync
        found = true; updated++; break;
      }
    }
    if (!found) {
      const initialPassword = hashPassword(id);
      sheet.appendRow([id, initialPassword, 'teacher', name, courseAccess]);
      writeUsername(sheet, sheet.getLastRow(), 1, id);
      data.push([id, initialPassword, 'teacher', name, courseAccess]); // keep in sync
      created++;
    }
  });
  return { success: true, created, updated };
}

// ======== HTTP Routing ========
function doGet(e) {
  return jsonOut({ success: true, service: 'Grade-I Tracking API', message: 'Use POST requests.' });
}

function doPost(e) {
  try {
    const p = JSON.parse(e.postData.contents);
    if (p.action === 'login') return jsonOut(doLogin(p.username, p.password));
    if (p.action === 'lookupStudent') return jsonOut(lookupStudent(p.studentId));
    if (p.action === 'logout') return jsonOut(deleteSession(p.token));

    const readSession = function() { return requireSession(p.token, ['admin','teacher']); };
    const adminSession = function() { return requireSession(p.token, ['admin']); };
    switch (p.action) {
      case 'getStudents':           return jsonOut(getStudents(p, readSession()));
      case 'getStats':              adminSession(); return jsonOut(getStats(p.semester));
      case 'getLogs':               adminSession(); return jsonOut(getLogs(p));
      case 'getSettings':           readSession(); return jsonOut(getSettings());
      case 'getUsers':              adminSession(); return jsonOut(getUsers());
      case 'getExamScores':         return jsonOut(getExamScores(p, readSession()));
      case 'getCourseOfferings':    return jsonOut(getCourseOfferings(p.semester, readSession()));
      case 'getSectionTeachers':    adminSession(); return jsonOut(getSectionTeachers());
      case 'updateStatus':          adminSession(); p.by = getSession(p.token).displayName; return jsonOut(withWriteLock(function(){ return updateStatus(p); }));
      case 'clearLogs':             adminSession(); return jsonOut(withWriteLock(clearLogs));
      case 'updateSettings':        adminSession(); return jsonOut(withWriteLock(function(){ return updateSettings(p.patch); }));
      case 'importStudents':        adminSession(); return jsonOut(withWriteLock(function(){ return importStudents(p.students, p.semester, p.clearExisting); }));
      case 'importExamScores':      adminSession(); return jsonOut(withWriteLock(function(){ return importExamScores(p.scores, p.semester); }));
      case 'addUser':               adminSession(); return jsonOut(withWriteLock(function(){ return addUser(p.user); }));
      case 'updateUser':            adminSession(); return jsonOut(withWriteLock(function(){ return updateUser(p.username, p.patch); }));
      case 'deleteUser':            adminSession(); return jsonOut(withWriteLock(function(){ return deleteUser(p.username); }));
      case 'upsertTeacherAccounts': adminSession(); return jsonOut(withWriteLock(function(){ return upsertTeacherAccounts(p.teachers); }));
      case 'saveCourseOfferings':   adminSession(); return jsonOut(withWriteLock(function(){ return saveCourseOfferings(p.semester, p.map); }));
      case 'clearCourseOfferings':  adminSession(); return jsonOut(withWriteLock(function(){ return clearCourseOfferings(p.semester); }));
      case 'applyCourseOfferings':  adminSession(); return jsonOut(withWriteLock(function(){ return applyCourseOfferings(p.semester); }));
      case 'saveSectionTeachers':   adminSession(); return jsonOut(withWriteLock(function(){ return saveSectionTeachers(p.map); }));
      default:                      return jsonOut({ success:false, error: 'Unknown action' });
    }
  } catch (err) {
    const message = String(err && err.message ? err.message : err);
    if (message === 'UNAUTHORIZED') return jsonOut({ success:false, error:'กรุณาเข้าสู่ระบบใหม่', code:'UNAUTHORIZED' });
    if (message === 'FORBIDDEN') return jsonOut({ success:false, error:'ไม่มีสิทธิ์ดำเนินการ', code:'FORBIDDEN' });
    console.error(err && err.stack ? err.stack : err);
    return jsonOut({ success:false, error:'เกิดข้อผิดพลาดภายในระบบ' });
  }
}

// ======== Semester repair (Sheets auto-converts "3/2568" to a date) ========
function normSemGAS(v) {
  if (v == null || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    var m = Number(Utilities.formatDate(v, 'Asia/Bangkok', 'M'));
    var y = Number(Utilities.formatDate(v, 'Asia/Bangkok', 'yyyy'));
    return m + '/' + y;
  }
  var s = String(v);
  var mm = s.match(/^\d{4}-\d{2}-\d{2}T/);
  if (mm) {
    var d = new Date(s);
    if (!isNaN(d)) {
      var m2 = Number(Utilities.formatDate(d, 'Asia/Bangkok', 'M'));
      var y2 = Number(Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy'));
      return m2 + '/' + y2;
    }
  }
  return s;
}

// Run this ONCE from the editor to fix already-corrupted semester cells
function repairSemesters() {
  ['students', 'examScores'].forEach(function (name) {
    var sheet = getSheet(name);
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return;
    var ci = data[0].indexOf('semester');
    if (ci < 0) return;
    // Force the whole column to plain-text so it won't auto-convert again
    sheet.getRange(2, ci + 1, data.length - 1, 1).setNumberFormat('@');
    for (var i = 1; i < data.length; i++) {
      var fixed = normSemGAS(data[i][ci]);
      if (fixed !== String(data[i][ci])) sheet.getRange(i + 1, ci + 1).setValue(fixed);
    }
  });
  Logger.log('✅ Semester repair complete');
}

// ======== One-time Setup ========
function setupSpreadsheet() {
  ['students','examScores','users','log'].forEach(name => getSheet(name));
  Logger.log('✅ Setup complete! Sheets: students, examScores, users, log');
  Logger.log('If the users sheet was created now, check the execution log for the generated Admin password.');
}

// ======== Utility: export all data as JSON (backup) ========
function exportAllData() {
  const result = {
    students:  sheetToObjects(getSheet('students')),
    examScores: sheetToObjects(getSheet('examScores')),
    users:     sheetToObjects(getSheet('users')).map(u=>{delete u.password;return u;}),
    courseOfferings: getProp('courseOfferings') || {},
    sectionTeachers: getProp('sectionTeachers') || {},
  };
  Logger.log(JSON.stringify(result));
  return result;
}
