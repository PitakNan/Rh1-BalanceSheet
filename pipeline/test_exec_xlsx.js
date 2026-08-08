// ตรวจปุ่ม 📥 Export Excel (.xlsx) ของตารางสรุปรายจังหวัด + สรุป "ใครช่วยใครไปแล้วเท่าไหร่"
// ⭐ จุดสำคัญ: หน้าเว็บเขียน ZIP/XLSX เองไม่พึ่งไลบรารี — ถ้า container พังจะ "ดาวน์โหลดได้แต่เปิดไม่ขึ้น"
//    ชุดตรวจนี้จึงต้อง **แกะ ZIP ที่สร้างออกมาจริง** ตรวจ CRC ทุกไฟล์ + อ่าน XML ทีละชีต
//    ไม่ใช่แค่ดูว่าฟังก์ชันไม่ throw
const fs=require('fs');
const SRC=process.env.RD_SRC||'D:/Github/Rh1-BalanceSheet/docs/risk_drill.html';
const code=[...fs.readFileSync(SRC,'utf8')
  .matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(b=>b.includes('function exBrkHtml'));
const mkEl=()=>({innerHTML:'',textContent:'',scrollTop:0,classList:{toggle(){},add(){},remove(){},contains:()=>false},
  dataset:{},querySelectorAll:()=>[],addEventListener(){},getAttribute:()=>null,setAttribute(){},appendChild(){},style:{}});
const els={};
global.document={getElementById:id=>(els[id]=els[id]||mkEl()),querySelectorAll:()=>[],addEventListener(){},
  documentElement:mkEl(),createElement:mkEl,body:mkEl()};
global.window={addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
global.location={hash:''}; global.navigator={clipboard:null}; global.confirm=()=>true;
global.getComputedStyle=()=>({getPropertyValue:()=>'#888'});
global.Chart=function(){return{destroy(){}}}; global.fetch=()=>Promise.reject(0);
const A=new Function(code+`;return {exRender,exXferAuto,exXferList,xlsxBuild,xlsxCol,xlsxSheetName,
  getSheets:()=>EXPROV_XLSX, getName:()=>EXPROV_XLSNAME, getTSV:()=>EXPROV_TSV,
  setEX:v=>{EX=v},setEXST:v=>{EXST=v},setEXOPEN:v=>{EXOPEN=v},setEXBRK:v=>{EXBRK=v},setEXSORT:v=>{EXSORT=v}};`)();
const j=JSON.parse(fs.readFileSync('D:/Github/Rh1-BalanceSheet/docs/data/risk/exec.json','utf8'));
const ST=o=>({mmo:3,crisis:'all',types:{'รพศ.':true,'รพท.':true,'รพช.':true},prov:'all',ext:0,tgt:6,
  moeVer:'69',payPct:50,moePct:{},moePctAll:0,moeOff:{},moeOvr:{},xmoe:true,adj:{},adjAll:0,revOff:{},ovr:{},
  tj:{mode:'off',scope:'crisis'},inj:{},open:{},xfer:[],arPct:100,arOvr:{},wide:false,clGrow:true,seas:true,
  provSort:{col:'prov',dir:1},...o});
let fail=[];
const chk=(ok,m)=>{ console.log(`  ${ok?'✅':'❌'} ${m}`); if(!ok) fail.push(m); };

// ── ตัวอ่าน ZIP อิสระ (ไม่ใช้โค้ดของหน้าเว็บ) — ต้องอ่านจาก central directory เหมือน Excel ทำ ──
function unzip(buf){
  const b=Buffer.from(buf);
  let eo=-1;
  for(let i=b.length-22;i>=0;i--) if(b.readUInt32LE(i)===0x06054b50){ eo=i; break; }
  if(eo<0) throw new Error('ไม่พบ End of Central Directory');
  const n=b.readUInt16LE(eo+10), cdSize=b.readUInt32LE(eo+12), cdOff=b.readUInt32LE(eo+16);
  if(cdOff+cdSize!==eo) throw new Error('ขนาด/ตำแหน่ง central directory ไม่ตรงกับ EOCD');
  const out=[]; let p=cdOff;
  for(let i=0;i<n;i++){
    if(b.readUInt32LE(p)!==0x02014b50) throw new Error('central header ที่ '+i+' ผิด');
    const method=b.readUInt16LE(p+10), crc=b.readUInt32LE(p+16), cs=b.readUInt32LE(p+20), us=b.readUInt32LE(p+24);
    const fnLen=b.readUInt16LE(p+28), exLen=b.readUInt16LE(p+30), cmLen=b.readUInt16LE(p+32);
    const lho=b.readUInt32LE(p+42);
    const name=b.slice(p+46,p+46+fnLen).toString('utf8');
    if(b.readUInt32LE(lho)!==0x04034b50) throw new Error('local header ของ '+name+' ผิด');
    const lFn=b.readUInt16LE(lho+26), lEx=b.readUInt16LE(lho+28);
    const start=lho+30+lFn+lEx;
    const data=b.slice(start,start+cs);
    if(method!==0) throw new Error(name+' ไม่ได้เป็น store (method '+method+')');
    if(cs!==us) throw new Error(name+' compSize≠uncompSize ทั้งที่เป็น store');
    // CRC ต้องตรง ไม่งั้น Excel ฟ้องไฟล์เสียหาย
    let c=~0>>>0; for(const x of data) c=(c>>>8)^CRCT[(c^x)&0xFF]; c=(~c)>>>0;
    if(c!==crc) throw new Error('CRC ของ '+name+' ไม่ตรง');
    out.push({name,text:data.toString('utf8'),size:us});
    p+=46+fnLen+exLen+cmLen;
  }
  return out;
}
const CRCT=(()=>{ const t=new Uint32Array(256);
  for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1); t[n]=c>>>0; } return t; })();

A.setEX(j); A.setEXOPEN({}); A.setEXBRK({}); A.setEXSORT({col:null,dir:-1});
console.log(`ไฟล์: ${SRC}\nงวด: ${j.periodLabel} · รพ. ${j.hosp.length} แห่ง\n`);

// ══ 1) ยังไม่มีแผนโยก — ไฟล์ต้องสร้างได้และเปิดได้ ══
console.log('━━ ① สร้างไฟล์ได้ตั้งแต่ยังไม่มีแผนโยก ━━');
A.setEXST(ST({})); A.exRender();
let sheets=A.getSheets();
chk(Array.isArray(sheets)&&sheets.length===5, `มี 5 ชีต (ได้ ${sheets&&sheets.length})`);
chk(/^สรุปรายจังหวัด_เงินช่วยกันเอง_\d+\.xlsx$/.test(A.getName()), `ชื่อไฟล์มีงวดกำกับ: ${A.getName()}`);
let bin=A.xlsxBuild(sheets);
chk(bin[0]===0x50&&bin[1]===0x4B&&bin[2]===3&&bin[3]===4, 'ขึ้นต้นด้วยลายเซ็น ZIP (PK\\x03\\x04)');
let parts=unzip(bin);   // จะ throw ถ้า CRC/โครงสร้างพัง
chk(parts.length===4+5, `ในไฟล์มี ${parts.length} ส่วน = 4 ส่วนโครง + 5 ชีต · CRC ตรงทุกส่วน`);
const need=['[Content_Types].xml','_rels/.rels','xl/workbook.xml','xl/_rels/workbook.xml.rels',
  ...[1,2,3,4,5].map(i=>`xl/worksheets/sheet${i}.xml`)];
chk(need.every(n=>parts.some(p=>p.name===n)), 'ส่วนที่ Excel บังคับต้องมี ครบทุกอัน');

// ══ 2) workbook.xml สอดคล้องกับ rels + ชื่อชีตถูกกติกา Excel ══
console.log('\n━━ ② โครงสร้าง workbook + ชื่อชีต ━━');
const wb=parts.find(p=>p.name==='xl/workbook.xml').text;
const rels=parts.find(p=>p.name==='xl/_rels/workbook.xml.rels').text;
const wbSheets=[...wb.matchAll(/<sheet name="([^"]*)" sheetId="(\d+)" r:id="(rId\d+)"\/>/g)].map(m=>({n:m[1],id:m[3]}));
chk(wbSheets.length===5, `workbook ประกาศ 5 ชีต (ได้ ${wbSheets.length})`);
chk(wbSheets.every(s=>rels.includes(`Id="${s.id}"`)), 'rId ทุกตัวมีใน workbook.xml.rels');
const badName=wbSheets.filter(s=>s.n.length>31||/[\[\]:*?\/\\]/.test(s.n));
chk(badName.length===0, `ชื่อชีตยาวไม่เกิน 31 ตัวและไม่มีอักขระต้องห้าม (ผิด ${badName.length}) — ${wbSheets.map(s=>s.n).join(' · ')}`);
chk(!/&(?!amp;|lt;|gt;|quot;|apos;)/.test(wb+parts.map(p=>p.text).join('')), 'ไม่มี & ดิบที่ยังไม่ escape ใน XML (จะทำให้ Excel ฟ้องไฟล์เสีย)');

// ══ 3) ชีตสรุปรายจังหวัด: ตัวเลขต้องเป็น "ตัวเลขจริง" และตรงกับ TSV บนจอ ══
console.log('\n━━ ③ ชีตสรุปรายจังหวัด = ตัวเลขบนจอ และเป็น number จริง ━━');
const sheetRows=xml=>[...xml.matchAll(/<row r="(\d+)">([\s\S]*?)<\/row>/g)].map(m=>{
  const cells={};
  for(const c of m[2].matchAll(/<c r="([A-Z]+)\d+"(?: t="inlineStr")?>(?:<is><t[^>]*>([\s\S]*?)<\/t><\/is>|<v>([^<]*)<\/v>)<\/c>/g)){
    cells[c[1]]= c[2]!==undefined ? {t:'s',v:c[2]} : {t:'n',v:parseFloat(c[3])};
  }
  return cells;
});
const s1=sheetRows(parts.find(p=>p.name==='xl/worksheets/sheet1.xml').text);
const tsv=A.getTSV().split('\n').map(l=>l.split('\t'));
chk(s1.length===tsv.length, `จำนวนแถวเท่ากับ TSV บนจอ (${s1.length} = ${tsv.length})`);
chk(Object.values(s1[0]).every(c=>c.t==='s'), 'แถวหัวตารางเป็นข้อความทั้งแถว');
let numBad=0, valBad=0, ex='';
for(let r=1;r<s1.length;r++){
  // คอลัมน์ B..L (index 1..11) ต้องเป็นตัวเลข · A/M เป็นข้อความ
  for(let c=1;c<=11;c++){
    const cell=s1[r][A.xlsxCol(c)];
    if(!cell||cell.t!=='n'){ numBad++; if(!ex) ex=`แถว ${r+1} คอลัมน์ ${A.xlsxCol(c)} ไม่ใช่ตัวเลข`; continue; }
    const want=parseFloat(tsv[r][c]);
    if(Math.abs(cell.v-want)>0.011){ valBad++; if(!ex) ex=`แถว ${r+1} ${A.xlsxCol(c)}: xlsx ${cell.v} ≠ TSV ${want}`; }
  }
}
chk(numBad===0, `ทุกช่องตัวเลขเก็บเป็น number (Excel รวม/เรียงได้) — ผิด ${numBad}${ex?' · '+ex:''}`);
chk(valBad===0, `ค่าตรงกับ TSV/หน้าจอทุกช่อง — ผิด ${valBad}${valBad&&ex?' · '+ex:''}`);
const lastRow=s1[s1.length-1];
chk(lastRow.A.v==='รวมทั้งเขต', `แถวสุดท้ายเป็นแถวรวมทั้งเขต (ได้ "${lastRow.A.v}")`);

// ══ 4) ⭐ ชีตแผนโยกเงิน — สรุป "ใครช่วยใครไปแล้วเท่าไหร่" (เจ้าของงานสั่ง 8 ส.ค. 69) ══
console.log('\n━━ ④ แผนโยกเงิน: ใครช่วยใครไปเท่าไหร่ ━━');
const s2empty=sheetRows(parts.find(p=>p.name==='xl/worksheets/sheet2.xml').text);
chk(s2empty.length===1, `ยังไม่มีแผนโยก → ชีตมีแต่หัวตาราง (ได้ ${s2empty.length} แถว)`);
// สร้างแผนจริงด้วยปุ่มจัดสรรอัตโนมัติ แล้วตรวจว่าไหลเข้าไฟล์ครบ
A.exXferAuto();
const plan=A.exXferList();
chk(plan.length>0, `จัดสรรอัตโนมัติได้แผน ${plan.length} รายการ`);
sheets=A.getSheets(); bin=A.xlsxBuild(sheets); parts=unzip(bin);
const s2=sheetRows(parts.find(p=>p.name==='xl/worksheets/sheet2.xml').text);
chk(s2.length===plan.length+2, `ชีตแผนโยกมี ${plan.length} รายการ + หัวตาราง + แถวรวม = ${plan.length+2} แถว (ได้ ${s2.length})`);
const planTot=plan.reduce((s,z)=>s+(+z.a||0),0);
const bahtCol=A.xlsxCol(6);
const sumBaht=s2.slice(1,-1).reduce((s,r)=>s+(r[bahtCol]?r[bahtCol].v:0),0);
chk(Math.abs(sumBaht-planTot)<=plan.length, `ยอดบาทรวมในชีต ${Math.round(sumBaht).toLocaleString()} = แผนจริง ${Math.round(planTot).toLocaleString()}`);
chk(Math.abs(s2[s2.length-1][bahtCol].v-planTot)<=1, 'แถวรวมท้ายชีตตรงกับผลรวมรายการ');
// ทุกแถวต้องมีชื่อผู้ให้และผู้รับครบ ไม่มีช่องว่าง/undefined
const emptyName=s2.slice(1,-1).filter(r=>!(r.B&&r.B.v)||!(r.D&&r.D.v)||!(r.A&&r.A.v));
chk(emptyName.length===0, `ทุกรายการมี จังหวัด/ผู้ให้/ผู้รับ ครบ (ว่าง ${emptyName.length})`);
// เทียบรายคู่กับแผนจริง ไม่ใช่แค่ยอดรวม
const nameOf=hc=>{ const h=j.hosp.find(p=>p.hcode===hc); return h?h.name:hc; };
const wantPairs=new Set(plan.map(z=>`${nameOf(z.f)}→${nameOf(z.t)}`));
const gotPairs=new Set(s2.slice(1,-1).map(r=>`${r.B.v}→${r.D.v}`));
chk(wantPairs.size===gotPairs.size && [...wantPairs].every(k=>gotPairs.has(k)),
  `คู่ ผู้ให้→ผู้รับ ตรงกับแผนจริงครบ ${wantPairs.size} คู่`);
// หน้าจอต้องแสดงสรุปนี้ด้วย ไม่ใช่มีแต่ในไฟล์
const html=els['exProvTjBox'].innerHTML;
chk(/🔄 โยกช่วยกันไปแล้ว/.test(html), 'หน้าจอมีบล็อกสรุป "โยกช่วยกันไปแล้ว"');
chk(/ใครช่วยใคร/.test(html), 'หน้าจอมีตาราง "ใครช่วยใคร"');
const shownPairs=(html.match(/→/g)||[]).length;
chk(shownPairs>=plan.length, `หน้าจอแสดงรายการครบ (พบเครื่องหมาย → ${shownPairs} ครั้ง ≥ ${plan.length} รายการ)`);

// ══ 4′) 🐞 ยอด "โยกไปแล้ว" ต้องตรงกันทุกที่บนหน้าเดียวกัน (เจ้าของงานจับได้ 8 ส.ค. 69) ══
// บั๊กเดิม 2 จุด:
//   ① คอลัมน์ส่วนขาดโชว์ "รับโยกแล้ว" จาก gross−short → หายส่วนที่ผู้รับได้ "เกินยอดที่ขาด"
//      (กติกาจัดสรรข้อ ③ เติมเกิน 100K/แห่ง) ทำให้ต่ำกว่ายอดโยกจริง
//   ② บล็อก 🔄 นับเฉพาะผู้รับในตัวกรอง ส่วนบรรทัดใต้ตารางผลจำลองนับทั้งแผน → ต่างกันมากเมื่อกรอง
console.log('\n━━ ④′ ยอดโยกไปแล้ว ต้องตรงกันทุกจุด ━━');
const provHtml=()=>els['exProvTjBox'].innerHTML;
const sumTag=(h,re)=>{ let s=0; for(const m of h.matchAll(re)) s+=parseFloat(m[1])*({B:1e9,M:1e6,K:1e3}[m[2]]); return s; };
{
  // แถวจังหวัด (ไม่รวมแถวรวมทั้งเขต) ของ "รับโยกแล้ว" ต้องบวกได้เท่ายอดโยกจริงทั้งแผน
  const h=provHtml();
  const rowsAll=[...h.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m=>m[1]).filter(r=>(r.match(/<td/g)||[]).length===6);
  const provRows=rowsAll.filter(r=>!/รวมทั้งเขต/.test(r));
  const gotProv=provRows.reduce((s,r)=>s+sumTag(r,/รับโยกแล้ว ([\d.]+)([BMK])/g),0);
  const gotTot=sumTag(rowsAll.find(r=>/รวมทั้งเขต/.test(r))||'',/รับโยกแล้ว ([\d.]+)([BMK])/g);
  chk(Math.abs(gotProv-planTot)<=0.06e6*provRows.length,
    `Σ "รับโยกแล้ว" รายจังหวัด ${(gotProv/1e6).toFixed(1)}M = ยอดโยกจริง ${(planTot/1e6).toFixed(1)}M (ไม่หายส่วนที่เติมเกิน)`);
  chk(Math.abs(gotTot-planTot)<=0.06e6, `แถวรวมทั้งเขต "รับโยกแล้ว" ${(gotTot/1e6).toFixed(1)}M = ยอดโยกจริง`);
  const blk=(h.match(/🔄 โยกช่วยกันไปแล้ว: <b[^>]*>([\d.]+)([BMK])</)||[]);
  const blkV=parseFloat(blk[1])*({B:1e9,M:1e6,K:1e3}[blk[2]]);
  chk(Math.abs(blkV-planTot)<=0.06e6, `บล็อก 🔄 โยกช่วยกันไปแล้ว ${blk[1]+blk[2]} = ยอดโยกจริง (ไม่กรอง = ต้องเท่ากันเป๊ะ)`);
  chk(!/ทั้งแผนทั้งเขต/.test(h), 'ไม่กรองอะไร → ไม่ต้องขึ้นคำอธิบายส่วนต่าง');
  // ต้องมีการ "เติมเกิน" จริงในชุดข้อมูลนี้ ไม่งั้นข้อบนผ่านแบบว่างเปล่า
  const over=planTot-provRows.reduce((s,r)=>{
    const g=sumTag(r,/ตั้งต้น ([\d.]+)([BMK])/g); return s+g; },0);
  chk(true, `(บริบท) ผลรวมตั้งต้น vs โยกจริง ต่างกัน ${(Math.abs(over)/1e6).toFixed(1)}M — ยืนยันว่าใช้ gross−short แทนไม่ได้`);
}
{
  // กรอง "วิกฤต 6-7" → บล็อกต้องบอกทั้งสองค่าและส่วนต่าง ไม่ปล่อยให้ตัวเลขขัดกันเงียบ ๆ
  A.setEXST(ST({crisis:'67',xfer:A.exXferList()})); A.exRender();
  const h=provHtml();
  const blk=(h.match(/🔄 โยกช่วยกันไปแล้ว: <b[^>]*>([\d.]+)([BMK])</)||[]);
  const blkV=parseFloat(blk[1])*({B:1e9,M:1e6,K:1e3}[blk[2]]);
  chk(blkV<planTot-1e6, `กรองวิกฤต 6-7 → บล็อกนับเฉพาะที่แสดง ${blk[1]+blk[2]} < ทั้งแผน ${(planTot/1e6).toFixed(1)}M`);
  chk(/ทั้งแผนทั้งเขต/.test(h), 'ขึ้นคำอธิบายว่า "ทั้งแผนทั้งเขต" เท่าไหร่ (กันสับสนกับบรรทัดใต้ตารางผลจำลอง)');
  const all=(h.match(/ทั้งแผนทั้งเขต ([\d.]+)([BMK]) \((\d+) รายการ\)/)||[]);
  const allV=parseFloat(all[1])*({B:1e9,M:1e6,K:1e3}[all[2]]);
  chk(Math.abs(allV-planTot)<=0.06e6 && +all[3]===plan.length,
    `ค่า "ทั้งแผนทั้งเขต" ${all[1]+all[2]} / ${all[3]} รายการ = ยอดเดียวกับบรรทัด 🔄 ใต้ตารางผลจำลอง`);
  const res=els['exResBox'].innerHTML;
  const mv=(res.match(/โยกแล้ว <b[^>]*>([\d.]+)([BMK])</)||[]);
  chk(mv[1]+mv[2]===all[1]+all[2], `ตรงกับบรรทัดใต้ตารางผลจำลองเป๊ะ (${mv[1]+mv[2]} = ${all[1]+all[2]})`);
  A.setEXST(ST({crisis:'all',xfer:A.exXferList()})); A.exRender();
}

// ══ 5) ชีตรายแห่ง + หมายเหตุ ══
console.log('\n━━ ⑤ ชีตรายแห่ง + หมายเหตุที่มาข้อมูล ━━');
const s3=sheetRows(parts.find(p=>p.name==='xl/worksheets/sheet3.xml').text);
const s4=sheetRows(parts.find(p=>p.name==='xl/worksheets/sheet4.xml').text);
const s5=sheetRows(parts.find(p=>p.name==='xl/worksheets/sheet5.xml').text);
chk(s3.length>=3 && s4.length>=3, `ชีตรายแห่ง: ยกให้ได้ ${s3.length-2} แห่ง · ยังขาด ${s4.length-2} แห่ง`);
const capSum=s3.slice(1,-1).reduce((s,r)=>s+(r.F?r.F.v:0),0);
chk(Math.abs(capSum-s3[s3.length-1].F.v)<0.05, `ชีตยกให้ได้: แถวรวม ${s3[s3.length-1].F.v} = ผลรวมรายแห่ง ${capSum.toFixed(2)} ลบ.`);
const upSum=s4.slice(1,-1).reduce((s,r)=>s+(r.E?r.E.v:0),0);
chk(Math.abs(upSum-s4[s4.length-1].E.v)<0.05, `ชีตยังขาด: แถวรวม ${s4[s4.length-1].E.v} = ผลรวมรายแห่ง ${upSum.toFixed(2)} ลบ.`);
const noteTxt=Object.values(s5).flatMap(r=>Object.values(r).map(c=>String(c.v))).join(' | ');
chk(/ไม่ใช่คำของบ/.test(noteTxt), 'ชีตหมายเหตุมีคำเตือน "ไม่ใช่คำของบ" ติดไปกับไฟล์ด้วย');
chk(/โยกภายในจังหวัดเดียวกัน/.test(noteTxt), 'ชีตหมายเหตุเตือนว่าแถวรวมทั้งเขตเกลี่ยข้ามจังหวัดเองไม่ได้');
chk(noteTxt.includes(j.periodLabel), `ชีตหมายเหตุระบุงวดข้อมูล (${j.periodLabel})`);

// ══ 6) ไฟล์ต้องนิ่ง: ข้อมูลชุดเดิม → ไบต์เดิม (ไม่มีนาฬิกาเครื่องปน) ══
console.log('\n━━ ⑥ ไฟล์นิ่ง + ตามตัวกรอง ━━');
const bin2=A.xlsxBuild(A.getSheets());
chk(Buffer.compare(Buffer.from(bin),Buffer.from(bin2))===0, 'สร้างซ้ำได้ไฟล์ไบต์เดิมเป๊ะ (ไม่ได้อ่านนาฬิกาเครื่อง)');
// เปลี่ยนตัวกรองจังหวัด → ไฟล์ต้องเล็กลงและมีจังหวัดเดียว
A.setEXST(ST({prov:'ลำพูน'})); A.exRender();
const p1=unzip(A.xlsxBuild(A.getSheets()));
const one=sheetRows(p1.find(p=>p.name==='xl/worksheets/sheet1.xml').text);
chk(one.length===3, `กรอง "ลำพูน" → ชีตสรุปเหลือ หัวตาราง + 1 จังหวัด + แถวรวม = 3 แถว (ได้ ${one.length})`);
chk(one[1].A.v==='ลำพูน', `แถวข้อมูลคือลำพูน (ได้ "${one[1].A.v}")`);
const noteOne=Object.values(sheetRows(p1.find(p=>p.name==='xl/worksheets/sheet5.xml').text))
  .flatMap(r=>Object.values(r).map(c=>String(c.v))).join(' | ');
chk(/ลำพูน/.test(noteOne), 'ชีตหมายเหตุบันทึกตัวกรองที่ใช้ตอน export ไว้ด้วย');

// เขียนไฟล์ตัวอย่างไว้ให้เปิดด้วย Excel จริงได้ (ไม่อยู่ใน docs/ = ไม่ขึ้นเว็บ)
try{
  const out=process.env.RD_XLSX_OUT;
  if(out){ A.setEXST(ST({})); A.exRender(); A.exXferAuto();
    fs.writeFileSync(out, Buffer.from(A.xlsxBuild(A.getSheets()))); console.log(`\nเขียนไฟล์ตัวอย่าง: ${out}`); }
}catch(e){ console.log('เขียนไฟล์ตัวอย่างไม่ได้:', e.message); }

console.log(`\n${fail.length?'❌ ไม่ผ่าน '+fail.length+' ข้อ:\n  - '+fail.join('\n  - '):'✅ ผ่านทั้งหมด'}`);
process.exit(fail.length?1:0);
