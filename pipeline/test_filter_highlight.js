// ตรวจไฮไลต์เส้นเหลืองรอบ "ตัวกรอง" (เจ้าของงานสั่ง 7 ส.ค. 69)
// ขอบเขตที่เจ้าของงานเคาะ: เฉพาะตัวกรองแท้ ๆ (กรองว่าจะแสดง รพ. ไหนบ้าง) เท่านั้น
// ⛔ ตัวปรับสมมติฐาน (ช่วงจำลอง · นิยาม MOE · %ลูกหนี้ · ประเมินสภาพคล่องถึง · ฤดูกาล) ต้องไม่ทา
const fs=require('fs');
const SRC=process.env.RD_SRC||'D:/Github/Rh1-BalanceSheet/docs/risk_drill.html';
const raw=fs.readFileSync(SRC,'utf8');
let fail=[];
const chk=(ok,msg)=>{ console.log(`  ${ok?'✅':'❌'} ${msg}`); if(!ok) fail.push(msg); };
console.log(`ไฟล์: ${SRC}\n`);

// ══ 1) CSS ══
console.log('━━ ① กฎ CSS ━━');
chk(/\.filt-hl\{[^}]*border:[^}]*var\(--gold\)[^}]*!important/.test(raw),
  '.filt-hl ใช้ border สี var(--gold) พร้อม !important');
chk(/\.filt-grp\{[^}]*border:[^}]*var\(--gold\)/.test(raw), '.filt-grp (กรอบรอบกลุ่ม checkbox) ใช้สี var(--gold)');
// ⚠️ ต้องมี !important จริง — .lfilt select / .seg / .exctl select ตั้ง border ไว้แล้วและ specificity สูงกว่า
for(const sel of ['\\.lfilt select,\\.lfilt input','\\.seg\\{','\\.exctl select'])
  chk(new RegExp(sel+'[^}]*border').test(raw), `มีกฎเดิม ${sel.replace(/\\/g,'')} ที่ตั้ง border ไว้ (จึงต้องใช้ !important)`);
// var(--gold) ต้องมีครบทุกธีม (สว่าง/มืด) ไม่งั้นธีมใดธีมหนึ่งจะไม่มีสี
chk((raw.match(/--gold:/g)||[]).length>=2, `--gold ประกาศครบทุกธีม (${(raw.match(/--gold:/g)||[]).length} จุด)`);

// ══ 2) ตัวกรองในมาร์กอัปคงที่ (แถบซ้าย) ══
console.log('\n━━ ② ตัวกรองแถบซ้าย ━━');
for(const [id,lab] of [['qSearch','ค้นหาชื่อ รพ./จังหวัด'],['fLevel','ระดับ'],['fProv','จังหวัด']]){
  const m=raw.match(new RegExp(`<(?:input|select)[^>]*id="${id}"[^>]*>`));
  chk(!!m && /class="[^"]*filt-hl/.test(m[0]), `#${id} (${lab}) มีคลาส filt-hl`);
}

// ══ 3) ตัวกรองที่เรนเดอร์ด้วย JS (#exec) ══
console.log('\n━━ ③ ตัวกรองใน #exec (เรนเดอร์จริง) ━━');
const code=[...raw.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(b=>b.includes('function exBrkHtml'));
const mkEl=()=>({innerHTML:'',textContent:'',scrollTop:0,classList:{toggle(){},add(){},remove(){},contains:()=>false},
  dataset:{},querySelectorAll:()=>[],addEventListener(){},getAttribute:()=>null,setAttribute(){},appendChild(){},style:{}});
const els={};
global.document={getElementById:id=>(els[id]=els[id]||mkEl()),querySelectorAll:()=>[],addEventListener(){},
  documentElement:mkEl(),createElement:mkEl,body:mkEl()};
global.window={addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
global.location={hash:''}; global.navigator={clipboard:null};
global.getComputedStyle=()=>({getPropertyValue:()=>'#888'});
global.Chart=function(){return{destroy(){}}}; global.fetch=()=>Promise.reject(0);
const A=new Function(code+`;return {exRender,exTabHtml:typeof exTabHtml!=='undefined'?exTabHtml:null,
  setEX:v=>{EX=v},setEXST:v=>{EXST=v},setEXOPEN:v=>{EXOPEN=v},setEXBRK:v=>{EXBRK=v},setEXSORT:v=>{EXSORT=v}};`)();
A.setEX(JSON.parse(fs.readFileSync(process.env.RD_JSON||'D:/Github/Rh1-BalanceSheet/docs/data/risk/exec.json','utf8')));
A.setEXST({mmo:3,crisis:'all',types:{'รพศ.':true,'รพท.':true,'รพช.':true},prov:'all',ext:0,tgt:6,moeVer:'69',payPct:50,
  moePct:{},moePctAll:0,moeOff:{},moeOvr:{},xmoe:true,adj:{},adjAll:0,revOff:{},ovr:{},tj:{mode:'off',scope:'crisis'},
  inj:{},open:{},xfer:[],arPct:100,arOvr:{},wide:false,clGrow:true,seas:true});
A.setEXOPEN({}); A.setEXBRK({}); A.setEXSORT({col:null,dir:-1}); A.exRender();
const rendered=Object.values(els).map(e=>typeof e.innerHTML==='string'?e.innerHTML:'').join('\n');
// แถบบนของ #exec อยู่ในมาร์กอัปที่ประกอบเป็นสตริงในโค้ด (ไม่ผ่าน exRender) จึงตรวจจาก raw ด้วย
const all=raw+'\n'+rendered;
chk(/<span class="seg filt-hl"/.test(all), 'ปุ่ม 🚨 วิกฤต 6-7 / ทุกระดับ มีกรอบเหลือง (.seg.filt-hl)');
chk(/<span class="filt-grp"[^>]*>[\s\S]{0,80}รพศ\./.test(all), 'กลุ่ม checkbox ประเภท รพศ./รพท./รพช. ถูกห่อด้วย .filt-grp');
const provSel=all.match(/🔎 กรองจังหวัด:[\s\S]{0,120}?<select[^>]*>/);
chk(!!provSel && /class="filt-hl"/.test(provSel[0]), 'select 🔎 กรองจังหวัด มีคลาส filt-hl');

// ══ 4) ⛔ ตัวปรับสมมติฐานต้องไม่ถูกทา ══
console.log('\n━━ ④ ตัวปรับสมมติฐาน (ต้องไม่มีเส้นเหลือง) ━━');
for(const [lab,pat] of [
  ['ช่วงจำลอง', /ช่วงจำลอง:[\s\S]{0,120}?<select[^>]*>/],
  ['💸 นิยาม MOE', /นิยาม MOE:[\s\S]{0,160}?<select[^>]*>/],
  ['📥 ลูกหนี้ที่เก็บได้ %', /ลูกหนี้ที่เก็บได้:[\s\S]{0,200}?<input[^>]*>/],
  ['💧 ประเมินสภาพคล่องถึง', /ประเมินสภาพคล่องถึง:[\s\S]{0,120}?<select[^>]*>/]]){
  const m=all.match(pat);
  chk(!!m && !/filt-hl/.test(m[0]), `${lab} ไม่มี filt-hl (เป็นตัวปรับ ไม่ใช่ตัวกรอง)${m?'':' — หา element ไม่เจอ'}`);
}
// จำนวนรวมต้องเท่ากับที่ตั้งใจเป๊ะ ๆ กันเผลอทาเพิ่มโดยไม่ตั้งใจ
// ⚠️ นับจาก raw (ซอร์ส) เท่านั้น — มาร์กอัปของ #exec อยู่ทั้งในซอร์สและในผลเรนเดอร์ ถ้านับรวมจะซ้ำ
const nHl=(raw.match(/class="[^"]*\bfilt-hl\b/g)||[]).length;
chk(nHl===5, `ใช้ filt-hl ทั้งหน้า 5 จุด (ค้นหา/ระดับ/จังหวัดซ้าย/วิกฤต6-7/กรองจังหวัด) — พบ ${nHl}`);
const nGrp=(raw.match(/class="filt-grp"/g)||[]).length;
chk(nGrp===1, `ใช้ filt-grp 1 จุด (กลุ่มประเภท รพ.) — พบ ${nGrp}`);

console.log(`\n${fail.length?'❌ ไม่ผ่าน '+fail.length+' ข้อ:\n  - '+fail.join('\n  - '):'✅ ผ่านทั้งหมด'}`);
process.exit(fail.length?1:0);
