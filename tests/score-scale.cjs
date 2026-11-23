// No Google calls. Supply optional SheetJS-style worksheet rows as JSON on stdin.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const read = f => fs.readFileSync(require('node:path').join(__dirname,'..',f),'utf8');
const ctx = vm.createContext({window:{}});
vm.runInContext(read('Shared.jsx').split('// Exported to window')[0],ctx);
const ui = read('AdminImport.jsx');
const parser = vm.runInContext(ui.slice(ui.indexOf('const parseScoresFile'),ui.indexOf('// ── File select handler'))+'\nparseScoresFile',ctx);
const parse = rows => {
  ctx.window.XLSX = {read:()=>({SheetNames:['S'],Sheets:{S:rows}}),utils:{sheet_to_json:s=>s}};
  return parser({arrayBuffer:async()=>new ArrayBuffer(0)});
};
const sheet = data => ({
  data, getDataRange(){return {getValues:()=>data.map(row=>row.slice())}},getLastRow(){return data.length},
  deleteRow(n){data.splice(n-1,1)},getRange(r,c){return {setNumberFormat(){},setValue(v){data[r-1][c-1]=v},
    setValues(rows){rows.forEach((row,i)=>{data[r+i-1]??=[];row.forEach((v,j)=>data[r+i-1][c+j-1]=v)})}}}
});
(async()=>{
  const format=ctx.window.formatExamScore;
  const input=[];
  for(const [section,max,score,note] of [['001',20,13.33,''],['002',30,0,''],['003',0,0,'ขาดสอบ']]){
    input.push(['0010102 test sec '+section],['ลำดับ','รหัส','ชื่อ','คะแนนดิบ','คะแนน('+max+')','หมายเหตุ'],
      [1,'9999999999001','Test',note?'0/0':'20/60',score,note]);
  }
  const records=await parse(input);
  assert.deepEqual(Array.from(records,format),['13.33/20','0/30','ขาดสอบ']);
  assert.equal(format({score30:0}),'0');
  await assert.rejects(parse([input[0],['ลำดับ'],input[2]]));
  vm.runInContext(read('Code.gs'),ctx);
  const tables={
    examScores:sheet([['studentId','studentName','courseCode','courseName','section','rawScore','score30','semester','importedAt'],
      ['legacy','','','','','',10,'3/2568','']]),
    students:sheet([['studentId','courseCode','section','semester','studentName','examScore','examScoreOutOf30'],
      ['9999999999001',10102,1,'1/2569','Test','','']])
  };
  ctx.getSheet=n=>tables[n];
  for(let n=0;n<2;n++) {
    const result=ctx.importExamScores(records,'1/2569');
    assert.equal(result.imported,3);assert.equal(result.matched,1);
    assert.equal(tables.examScores.data.length,5);
    assert.equal(tables.examScores.data[1][7],'3/2568');
    assert.equal(tables.students.data[1][7],20);
    assert.deepEqual(Array.from(ctx.getExamScores({semester:'1/2569'}).data,format),['13.33/20','0/30','ขาดสอบ']);
  }
  const before=JSON.stringify(tables.examScores.data);
  assert.equal(ctx.importExamScores([{...records[0],scoreMax:undefined}],'1/2569').success,false);
  assert.equal(JSON.stringify(tables.examScores.data),before);
  if(process.argv.includes('--rows')){
    const rows=JSON.parse(fs.readFileSync(0,'utf8').replace(/^\uFEFF/,''));
    const expected=rows.filter(r=>typeof r[0]==='number');
    const actual=await parse(rows);
    assert.equal(actual.length,expected.length);
    let i=0,max;
    for(const r of rows){
      if(r[0]==='ลำดับ') max=Number(r[4].match(/\d+/)[0]);
      if(typeof r[0]!=='number')continue;
      const a=actual[i++];assert.equal(a.studentId,r[1]);assert.equal(a.rawScore,r[3]);
      assert.equal(a.score30,r[4]);assert.equal(a.scoreMax,max);assert.equal(a.scoreNote,r[5]||'');
    }
    console.log('Verified corrected workbook rows:',actual.length);
  }
  console.log('PASS: parser, rendering labels, legacy data, migration, semester isolation, repeat import and invalid-input rejection');
})().catch(e=>{console.error(e);process.exitCode=1});
