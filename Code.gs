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
      sheet.appendRow(['admin','admin123','admin','ผู้ดูแลระบบ (GE)','']);
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

function doLogin(username, password) {
  const users = sheetToObjects(getSheet('users'));
  const user = users.find(u =>
    String(u.username) === String(username) &&
    String(u.password) === String(password)
  );
  if (!user) return { success: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
  const displayName = uCol(user, 'displayName', 'ชื่อ', 'name') || String(username);
  const courseAccessRaw = uCol(user, 'courseAccess', 'active', 'courses');
  const access = courseAccessRaw ? String(courseAccessRaw).split(',').map(function(s){return s.trim();}).filter(Boolean) : [];
  return { success: true, role: user.role, displayName: displayName, courseAccess: access };
}

// ======== Students ========
function getStudents(params) {
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
  return { success: true, data: list };
}

function updateStatus(payload) {
  const sheet = getSheet('students');
  const data  = sheet.getDataRange().getValues();
  const h     = data[0];
  const col   = name => h.indexOf(name);

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][col('studentId')]) === String(payload.studentId) &&
        String(data[i][col('courseCode')]) === String(payload.courseCode) &&
        String(data[i][col('section')])    === String(payload.section)) {

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
  if (clearExisting && sheet.getLastRow() > 1) {
    sheet.deleteRows(2, sheet.getLastRow() - 1);
  }
  const now = new Date().toISOString();
  const rows = students.map(s => [
    s.studentId, s.studentName || '', s.courseCode, s.courseName || '',
    s.section, s.teacher || '', semester || s.semester || '',
    s.bracketGrade, s.bracketGrade === 'E' ? 'ขาดสอบ' : 'ส่งงานไม่ครบ',
    s.examScore || '', s.examScoreOutOf30 || 0,
    s.status || 'รอดำเนินการ', s.newGrade || '', now, 'System', s.notes || ''
  ]);
  if (rows.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    // Force semester column (index 6 → col 7) to plain text BEFORE writing
    const semColIdx = SHEET_HEADERS.students.indexOf('semester');
    if (semColIdx > -1) sheet.getRange(startRow, semColIdx + 1, rows.length, 1).setNumberFormat('@');
    sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
  }
  return { success: true, imported: rows.length };
}

// ======== Exam Scores ========
function importExamScores(scores, semester) {
  const esSheet = getSheet('examScores');
  // Remove existing rows for this semester
  if (semester && esSheet.getLastRow() > 1) {
    const esData = esSheet.getDataRange().getValues();
    const semCol = esData[0].indexOf('semester');
    for (let i = esData.length - 1; i >= 1; i--) {
      if (String(esData[i][semCol]) === String(semester)) esSheet.deleteRow(i + 1);
    }
  }
  const now = new Date().toISOString();
  const rows = scores.map(s => [
    s.studentId, s.studentName || '', s.courseCode, s.courseName || '',
    s.section, s.rawScore || '', s.score30 || 0, semester || '', now
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
  scores.forEach(score => {
    for (let i = 1; i < stuData.length; i++) {
      if (String(stuData[i][sc('studentId')]) === String(score.studentId) &&
          (!semester || normSemGAS(stuData[i][sc('semester')]) === semester)) {
        if (!stuData[i][sc('studentName')]) stuSheet.getRange(i+1, sc('studentName')+1).setValue(score.studentName || '');
        stuSheet.getRange(i+1, sc('examScore')+1).setValue(score.rawScore || '');
        stuSheet.getRange(i+1, sc('examScoreOutOf30')+1).setValue(score.score30 || 0);
      }
    }
  });
  return { success: true, imported: scores.length };
}

function getExamScores(params) {
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
function getCourseOfferings(semester) {
  const all = getProp('courseOfferings') || {};
  return { success: true, data: semester ? (all[semester] || {}) : all };
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
  // Admin-only view — normalize column names for frontend compatibility
  const users = sheetToObjects(getSheet('users'));
  return { success: true, data: users.map(function(u) {
    return {
      username:     u.username,
      password:     u.password,
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
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(u.username)) return { success:false, error:'ชื่อผู้ใช้นี้มีอยู่แล้ว' };
  }
  sheet.appendRow([u.username, u.password, u.role, u.displayName, access]);
  return { success: true };
}

function updateUser(username, patch) {
  const sheet = getSheet('users');
  const data  = sheet.getDataRange().getValues();
  const h     = data[0];
  const col   = (name) => h.indexOf(name);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(username)) {
      // Guard duplicate username when renaming
      if (patch.username && patch.username !== username) {
        for (let j = 1; j < data.length; j++) {
          if (j !== i && String(data[j][0]) === String(patch.username)) return { success:false, error:'ชื่อผู้ใช้ใหม่ซ้ำกับที่มีอยู่' };
        }
      }
      if (patch.username   !== undefined) sheet.getRange(i+1, col('username')+1).setValue(patch.username);
      if (patch.password   !== undefined) sheet.getRange(i+1, col('password')+1).setValue(patch.password);
      if (patch.role       !== undefined) sheet.getRange(i+1, col('role')+1).setValue(patch.role);
      if (patch.displayName!== undefined) sheet.getRange(i+1, col('displayName')+1).setValue(patch.displayName);
      if (patch.courseAccess!== undefined) {
        const access = Array.isArray(patch.courseAccess) ? patch.courseAccess.join(',') : (patch.courseAccess || '');
        sheet.getRange(i+1, col('courseAccess')+1).setValue(access);
      }
      return { success: true };
    }
  }
  return { success: false, error: 'ไม่พบผู้ใช้' };
}

function deleteUser(username) {
  const sheet = getSheet('users');
  const data  = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(username)) { sheet.deleteRow(i+1); return { success: true }; }
  }
  return { success: false };
}

function upsertTeacherAccounts(teachers) {
  const sheet = getSheet('users');
  const data  = sheet.getDataRange().getValues();
  const h     = data[0];
  let created = 0, updated = 0;

  teachers.forEach(t => {
    const id   = String(t.teacherId);
    const name = String(t.teacherName || id);
    const courseAccess = [...new Set((t.courses || []).map(c => c.courseCode))].join(',');
    let found = false;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === id) {
        // Merge courseAccess (union)
        const existing = String(data[i][4] || '').split(',').filter(Boolean);
        const newCodes  = courseAccess.split(',').filter(Boolean);
        const merged    = [...new Set([...existing, ...newCodes])].join(',');
        sheet.getRange(i+1, 2).setValue(id);       // password = id
        sheet.getRange(i+1, 4).setValue(name);     // displayName
        sheet.getRange(i+1, 5).setValue(merged);   // courseAccess
        data[i][4] = merged;                        // keep in-memory copy in sync
        found = true; updated++; break;
      }
    }
    if (!found) {
      sheet.appendRow([id, id, 'teacher', name, courseAccess]);
      data.push([id, id, 'teacher', name, courseAccess]); // keep in sync
      created++;
    }
  });
  return { success: true, created, updated };
}

// ======== HTTP Routing ========
function doGet(e) {
  const p = e.parameter || {};
  try {
    switch (p.action) {
      case 'login':               return jsonOut(doLogin(p.username, p.password));
      case 'getStudents':         return jsonOut(getStudents(p));
      case 'getStats':            return jsonOut(getStats(p.semester));
      case 'getLogs':             return jsonOut(getLogs(p));
      case 'getSettings':         return jsonOut(getSettings());
      case 'getUsers':            return jsonOut(getUsers());
      case 'getExamScores':       return jsonOut(getExamScores(p));
      case 'getCourseOfferings':  return jsonOut(getCourseOfferings(p.semester));
      case 'getSectionTeachers':  return jsonOut(getSectionTeachers());
      default:                    return jsonOut({ error: 'Unknown GET action: ' + p.action });
    }
  } catch (err) {
    return jsonOut({ error: err.toString(), stack: err.stack });
  }
}

function doPost(e) {
  try {
    const p = JSON.parse(e.postData.contents);
    switch (p.action) {
      case 'updateStatus':          return jsonOut(updateStatus(p));
      case 'clearLogs':             return jsonOut(clearLogs());
      case 'updateSettings':        return jsonOut(updateSettings(p.patch));
      case 'importStudents':        return jsonOut(importStudents(p.students, p.semester, p.clearExisting));
      case 'importExamScores':      return jsonOut(importExamScores(p.scores, p.semester));
      case 'addUser':               return jsonOut(addUser(p.user));
      case 'updateUser':            return jsonOut(updateUser(p.username, p.patch));
      case 'deleteUser':            return jsonOut(deleteUser(p.username));
      case 'upsertTeacherAccounts': return jsonOut(upsertTeacherAccounts(p.teachers));
      case 'saveCourseOfferings':   return jsonOut(saveCourseOfferings(p.semester, p.map));
      case 'clearCourseOfferings':  return jsonOut(clearCourseOfferings(p.semester));
      case 'applyCourseOfferings':  return jsonOut(applyCourseOfferings(p.semester));
      case 'saveSectionTeachers':   return jsonOut(saveSectionTeachers(p.map));
      default:                      return jsonOut({ error: 'Unknown POST action: ' + p.action });
    }
  } catch (err) {
    return jsonOut({ error: err.toString(), stack: err.stack });
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
  Logger.log('Default Admin: username=admin / password=admin123');
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
