// ตรวจไฮไลต์เส้นเหลืองรอบช่องที่ "คลิกเลือก / คลิกกรอก" ได้ทั้งหน้า (เจ้าของงานสั่ง 7 ส.ค. 69)
// รอบแรกทาเฉพาะตัวกรอง → เจ้าของงานสั่งขยายเป็นทุกกรอบที่คลิกได้ + หนาขึ้นเป็น 2px
// วิธี: กฎ CSS ระดับ element ครอบทั้งหน้า ไม่ต้องติดคลาสรายตัว (ของที่เรนเดอร์ด้วย JS จึงได้ด้วยอัตโนมัติ)
const fs=require('fs');
const SRC=process.env.RD_SRC||'D:/Github/Rh1-BalanceSheet/docs/risk_drill.html';
const raw=fs.readFileSync(SRC,'utf8');
let fail=[];
const chk=(ok,msg)=>{ console.log(`  ${ok?'✅':'❌'} ${msg}`); if(!ok) fail.push(msg); };
console.log(`ไฟล์: ${SRC}\n`);

// ══ 1) กฎ CSS ══
console.log('━━ ① กฎ CSS ━━');
const rule=raw.match(/(select,input\[type=text\][^{]*)\{([^}]*)\}/);
chk(!!rule, 'มีกฎรวมที่ขึ้นต้นด้วย select,input[type=text]');
if(rule){
  const [,sel,body]=rule;
  for(const s of ['select','input[type=text]','input[type=number]','input[type=search]','.seg','.filt-grp'])
    chk(sel.includes(s), `selector ครอบ ${s}`);
  chk(/border:2px solid var\(--gold\)/.test(body), `เส้นหนา 2px สี var(--gold) — ได้ "${body.trim()}"`);
  chk(/!important/.test(body), '!important (กฎเดิม .lfilt select/.seg/.exctl select/#acpMonthSel inline ตั้ง border ไว้แล้ว)');
  chk(!/border-radius/.test(body), 'ไม่ไปแตะ border-radius (ปล่อยให้แต่ละตัวคงความโค้งเดิม)');
  // ⛔ ของที่ไม่ควรโดนทา
  for(const s of ['input[type=range]','input[type=checkbox]','input[type=radio]','.lvlbtn','button,'])
    chk(!sel.includes(s), `ไม่ทาให้ ${s}`);
}
chk((raw.match(/--gold:/g)||[]).length>=2, `--gold ประกาศครบทุกธีม (${(raw.match(/--gold:/g)||[]).length} จุด)`);
chk(/\.filt-grp\{[^}]*display:inline-flex/.test(raw), '.filt-grp ยังห่อกลุ่ม checkbox ประเภท รพ. อยู่');
chk(raw.indexOf('filt-hl')===-1, 'ถอดคลาส filt-hl เดิมออกหมดแล้ว (กฎใหม่ครอบให้เอง ไม่ต้องติดรายตัว)');

// ══ 2) ทุก control ในหน้าต้องถูก selector จับได้จริง ══
// 🪤 <input> ที่ไม่ระบุ type จะเป็น text โดยปริยาย แต่ selector input[type=text] จับไม่ได้ → ต้องไม่มี
console.log('\n━━ ② ครอบคลุมทุก control ที่มีจริงในหน้า ━━');
const tags=[...raw.matchAll(/<input\b[^>]*>/g)].map(m=>m[0]).filter(t=>!/^<input>$/.test(t));
const noType=tags.filter(t=>!/\btype\s*=/.test(t));
chk(noType.length===0, `ไม่มี <input> ที่ไม่ระบุ type (จะหลุดจาก selector) — พบ ${noType.length}`);
const byType={};
tags.forEach(t=>{ const m=t.match(/type\s*=\s*"?([a-z]+)/); if(m) byType[m[1]]=(byType[m[1]]||0)+1; });
const HL=['text','number','search'], SKIP=['range','checkbox','radio'];
console.log('   ชนิด input ที่พบ: '+Object.entries(byType).map(([k,v])=>`${k}=${v}`).join(' · '));
const unknown=Object.keys(byType).filter(k=>!HL.includes(k)&&!SKIP.includes(k));
chk(unknown.length===0, `ไม่มี input ชนิดแปลกใหม่ที่ยังไม่ได้ตัดสินใจว่าจะทาหรือไม่ — พบ ${unknown.join(',')||'ไม่มี'}`);
chk(!/<textarea/.test(raw), 'ไม่มี <textarea> (ถ้ามีในอนาคตต้องเพิ่มเข้า selector ด้วย)');
const nSel=(raw.match(/<select\b/g)||[]).length;
const nHl=HL.reduce((s,k)=>s+(byType[k]||0),0);
const nSkip=SKIP.reduce((s,k)=>s+(byType[k]||0),0);
chk(nSel>0&&nHl>0, `จะทาเหลืองรวม ${nSel+nHl} ช่อง (select ${nSel} · input ${nHl}) · ไม่ทา ${nSkip} ช่อง (range/checkbox/radio)`);

// ══ 3) control ที่มี inline style border ต้องยังโดน !important ทับได้ ══
console.log('\n━━ ③ กรณี inline style ━━');
const inl=[...raw.matchAll(/<(?:select|input)[^>]*style="[^"]*border[^"]*"[^>]*>/g)].map(m=>m[0]);
console.log(`   พบ control ที่ตั้ง border ใน inline style ${inl.length} จุด`);
chk(rule && /!important/.test(rule[2]),
  `inline style ${inl.length} จุดถูก !important ทับได้ (ถ้าไม่มี !important จุดพวกนี้จะไม่มีเส้นเหลือง)`);

// ══ 4) เรนเดอร์จริงแล้วไม่พัง ══
console.log('\n━━ ④ เรนเดอร์ #exec แล้วยังปกติ ━━');
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
const A=new Function(code+`;return {exRender,setEX:v=>{EX=v},setEXST:v=>{EXST=v},setEXOPEN:v=>{EXOPEN=v},setEXBRK:v=>{EXBRK=v},setEXSORT:v=>{EXSORT=v}};`)();
A.setEX(JSON.parse(fs.readFileSync(process.env.RD_JSON||'D:/Github/Rh1-BalanceSheet/docs/data/risk/exec.json','utf8')));
A.setEXST({mmo:3,crisis:'all',types:{'รพศ.':true,'รพท.':true,'รพช.':true},prov:'all',ext:0,tgt:6,moeVer:'69',payPct:50,
  moePct:{},moePctAll:0,moeOff:{},moeOvr:{},xmoe:true,adj:{},adjAll:0,revOff:{},ovr:{},tj:{mode:'off',scope:'crisis'},
  inj:{},open:{},xfer:[],arPct:100,arOvr:{},wide:false,clGrow:true,seas:true});
A.setEXOPEN({}); A.setEXBRK({}); A.setEXSORT({col:null,dir:-1}); A.exRender();
const rendered=Object.values(els).map(e=>typeof e.innerHTML==='string'?e.innerHTML:'').join('\n');
chk(rendered.length>1000 && !/undefined|NaN/.test(rendered), 'เรนเดอร์ #exec ได้ปกติ ไม่มี undefined/NaN');
const rSel=(rendered.match(/<select\b/g)||[]).length, rNum=(rendered.match(/type="number"/g)||[]).length;
chk(rSel>0&&rNum>0, `ของที่เรนเดอร์ด้วย JS ก็ได้เส้นเหลืองอัตโนมัติ (select ${rSel} · input number ${rNum} ในผลเรนเดอร์)`);
// กลุ่ม checkbox ประเภท รพ. ยังห่ออยู่
chk(/<span class="filt-grp"/.test(raw), 'กลุ่ม checkbox ประเภท รพศ./รพท./รพช. ยังมีกรอบครอบ');

console.log(`\n${fail.length?'❌ ไม่ผ่าน '+fail.length+' ข้อ:\n  - '+fail.join('\n  - '):'✅ ผ่านทั้งหมด'}`);
process.exit(fail.length?1:0);
