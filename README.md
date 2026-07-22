# Handoff: ระบบติดตามการแก้ไขเกรด I (Grade-I Tracking System)

## Overview
Web app for a university general-education office to track and resolve students' "I" (incomplete) grades across a semester: import course offerings and student lists, let teachers record makeup-exam/assignment results, convert brackets to final letter grades, and export reports.

## Status: this is a WORKING, DEPLOYED app — not a mockup
Unlike a typical design handoff, these files are the **actual production implementation**, currently live at a GitHub Pages URL, backed by a real Google Sheet via Apps Script. This bundle is a snapshot for a developer (Codex/Claude Code) to continue building on — not a reference to be "recreated" in another stack. Keep the same architecture unless there's a strong reason to migrate.

## Architecture
- **Frontend**: single-page app, no build step. Plain HTML + React 18 (UMD) + Babel-standalone in-browser JSX transpilation. Each `.jsx` file is loaded via `<script type="text/babel" src="...">` in `index.html`, in dependency order (Shared.jsx first).
- **No bundler, no npm.** All shared style helpers, `Card`, `Modal`, `ToastProvider`/`useToast`, `useTheme`, `ConfirmDialog` live in `Shared.jsx` and are used as globals across files (Babel-standalone gives each script its own module scope, but components attach to `window` where cross-file access is needed — check `Object.assign(window, {...})` at the bottom of each file before adding new shared helpers).
- **Backend**: Google Apps Script (`Code.gs`) deployed as a Web App, reading/writing a Google Sheet as the database (sheets: `students`, `examScores`, `users`, `log`, `settings`; two JSON blobs — `courseOfferings`, `sectionTeachers` — stored in `PropertiesService` rather than sheet rows for speed).
- **Dual storage mode**: `window.API` in `index.html` routes every call to either `LocalDB` (localStorage, demo/offline mode) or the GAS backend, based on whether a GAS URL is set. A default GAS URL is hardcoded (`DEFAULT_GAS_URL` in `index.html`) so the deployed app connects to Sheets automatically with no setup step; admins can override per-device from Settings.
- **Deployment**: static files served from GitHub Pages. There is no CI/CD — updating the live site means manually re-uploading changed files to the GitHub repo.

## Roles
1. **Admin** — full access: imports, master student roster + grade editing, reports, user management, settings. Logs in with username/password (`AdminSettings` manages accounts).
2. **Teacher** — new accounts receive the teacher ID as the one-time initial password. Re-importing course offerings no longer resets an existing password. Passwords are stored as salted SHA-256 hashes, and Admin can set a replacement password without viewing the old one. Teachers see only the sections assigned to their teacher ID in the selected semester. Multi-teacher sections use `teacherIds` arrays.
3. **Student** — no login, just enters student ID to view their own status/history (`StudentView.jsx`).

## Data model (see `Code.gs` → `SHEET_HEADERS` for authoritative field list)
- **students** sheet: one row per student+course+section+semester. Fields: `studentId, studentName, courseCode, courseName, section, teacher, semester, bracketGrade, cause, examScore, examScoreOutOf30, status, newGrade, statusUpdatedAt, statusUpdatedBy, notes`.
  - `bracketGrade` E → cause "ขาดสอบ" (missed exam); otherwise "ส่งงานไม่ครบ" (incomplete coursework).
  - `status` progresses through: รอดำเนินการ → ส่งงานแล้ว / รออาจารย์แก้เกรด → เสร็จสิ้น (workflow states used across dashboards/reports — grep these Thai strings before adding a new state).
- **examScores** sheet: Round-2 final exam scores imported from IT, joined onto `students` by `studentId` (+ semester).
- **users** sheet: `username, password, role, displayName, courseAccess` (`password` contains a salted hash; legacy plain-text values are migrated after the first successful login).
- **log** sheet: full audit trail of status/grade changes (`addLog` in Code.gs, `_log` in LocalDB).
- **settings** sheet: key/value, currently just `teacherStudentsTabVisible`.
- **courseOfferings** (PropertiesService JSON, keyed by semester → `{courseCode_section: {courseName, teacher}}`): master table used to auto-fill course name/teacher when importing student lists, and to re-sync existing rows via `applyCourseOfferings`.
- **sectionTeachers** (PropertiesService JSON): section→teacher lookup memory used during import matching.

## Known quirks / fixes already applied (don't regress these)
- **Google Sheets corrupts semester strings.** Typing `3/2568` into a cell gets auto-converted to a date serial/ISO string. Fixed by: forcing the semester column to plain-text number format (`setNumberFormat('@')`) on write, plus `normSemGAS()` (backend) / `_normSem()` (frontend, in `API._normSem`) to reconstruct `"M/YYYY"` from a corrupted date using a fixed Asia/Bangkok (+7h) offset. `repairSemesters()` in Code.gs is a one-time manual repair function for already-corrupted sheets — run again if new corruption appears.
- **Dark mode CSS transitions**: use `background-color`, not the `background` shorthand, when transitioning theme-variable-driven colors — transitioning a CSS var directly (or via shorthand) breaks/flickers. See `:root`/`[data-theme]` variable blocks and `.gi-card` in `index.html`.
- **Teacher section visibility**: must match by normalized `courseCode + section`, not raw import strings — padding/format differs between the offerings import and student import.
- **Authoritative record key**: every student update/import/score match must use `semester + studentId + courseCode + section`. Omitting semester or course/section can update the wrong historical record.
- **API security**: all staff reads and every mutation require a short-lived session token and server-side role checks. Login and data calls use POST so passwords/tokens are not placed in query strings. Student lookup uses a separate read-only endpoint returning a limited field set.
- **Imports**: student import is an upsert. "Clear existing" removes only the selected semester. Score imports match the full authoritative record key and return matched/unmatched counts.

## Files in this bundle
- `index.html` — shell: theme CSS vars, demo/local data + `LocalDB`, `window.API` (GAS/local router), `AdminSettings` component, root `App` component and role routing.
- `Login.jsx`, `StudentView.jsx`, `TeacherView.jsx` — per-role screens.
- `AdminDash.jsx` — dashboard (stats, donut/progress charts).
- `AdminStudents.jsx` — student list/detail management.
- `AdminGrade.jsx` — bracket→final grade conversion workflow.
- `AdminImport.jsx` — Excel import flows (course offerings, student lists, Round-2 scores) using SheetJS (`xlsx` CDN, loaded in `index.html`).
- `AdminForm.jsx` — form(s) for manual data entry.
- `AdminReports.jsx` — audit log tab, Excel/PDF export, cross-term comparison dashboard.
- `Shared.jsx` — shared UI primitives and hooks (Card, Modal, Toast, theme hook, etc.) — read this FIRST before touching any other file.
- `Code.gs` — Google Apps Script backend; paste into the bound Apps Script project, set `SPREADSHEET_ID`, run `setupSpreadsheet()` once, then Deploy → Web App.

## Security/deployment note for this revision
- Deploy the updated `Code.gs` and the updated frontend files together; the frontend now expects the token-protected POST API.
- Existing users can continue using their current passwords. A successful login migrates a legacy plain-text password to a salted hash.
- For a brand-new `users` sheet, `setupSpreadsheet()` generates a random Admin password and writes it only to the Apps Script execution log. Change it after the first login.
- Re-import course offerings once after deployment so existing multi-teacher sections receive the new `teacherIds` field.

Not included here (present in the live project but not needed for backend/frontend dev): `index-bundle.html` (a self-contained inlined build), `setup.html`, and an older Thai-named HTML file — superseded by the files above.

## Suggested next steps for the developer
- No CI/CD exists — consider wiring GitHub Actions or a simple script to push `grade-tracker/*` to the Pages repo automatically instead of manual uploads.
- No automated tests. Given the Sheets-corruption class of bugs already hit once, add a regression test/check for `_normSem`/`normSemGAS`.
- Multi-admin concurrency currently relies on Sheets' own locking; if usage grows, revisit for race conditions on `updateStatus`/`importStudents` (no explicit `LockService` calls in `Code.gs` currently).
- Consider migrating off Babel-standalone in-browser transpilation (slow first paint) to a prebuilt bundle if the app keeps growing — but this changes the whole dev workflow, so confirm with the project owner first.
