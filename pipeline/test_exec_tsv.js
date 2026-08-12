// ⭐ เทียบ "ทุกเซลล์ในไฟล์ TSV ที่ปุ่ม 📋 คัดลอกแผน ส่งออก" กับ "ตัวเลขที่แสดงบนจอ" ทีละช่อง
// เจ้าของงานถาม 7 ส.ค. 69: ของที่ copy ไป Excel ต้องเป็นข้อมูลชุดเดียวกับที่เห็นบนจอ
// 🪤 ตอนเขียนตัวตรวจเอง เจอกับดัก 2 อย่าง (ระวังถ้าจะแก้ไฟล์นี้):
//   ① จอใช้ fmtM ซึ่งมีเครื่องหมายนำหน้าได้ทั้ง + · − (U+2212 ไม่ใช่ hyphen) · "ขาด "
//      ถ้า parser ไม่รับครบ จะฟ้อง false positive เพียบ (เคยฟ้อง 86 แถวทั้งที่ตัวเลขตรงกัน)
//   ② จอแสดง "–" เมื่อค่าเป็น 0 ส่วน TSV เขียน "0.00" — ความหมายเดียวกัน ต้องไม่นับว่าไม่ตรง
const fs=require('fs');
const SRC=process.env.RD_SRC||'D:/Github/Rh1-BalanceSheet/docs/risk_drill.html';
const code=[...fs.readFileSync(SRC,'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(b=>b.includes('function exBrkHtml'));
const mkEl=()=>({innerHTML:'',textContent:'',scrollTop:0,classList:{toggle(){},add(){},remove(){},contains:()=>false},dataset:{},querySelectorAll:()=>[],addEventListener(){},getAttribute:()=>null,setAttribute(){},appendChild(){},style:{}});
const els={};
global.document={getElementById:id=>(els[id]=els[id]||mkEl()),querySelectorAll:()=>[],addEventListener(){},documentElement:mkEl(),createElement:mkEl,body:mkEl()};
global.window={addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
global.location={hash:''};global.navigator={clipboard:null};
global.getComputedStyle=()=>({getPropertyValue:()=>'#888'});
global.Chart=function(){return{destroy(){}}};global.fetch=()=>Promise.reject(0);
const A=new Function(code+`;return {exRender,exSepLab,getTSV:()=>EX_TSV,setEX:v=>{EX=v},setEXST:v=>{EXST=v},setEXOPEN:v=>{EXOPEN=v},setEXBRK:v=>{EXBRK=v},setEXSORT:v=>{EXSORT=v}};`)();
A.setEX(JSON.parse(fs.readFileSync(process.env.RD_JSON||'D:/Github/Rh1-BalanceSheet/docs/data/risk/exec.json','utf8')));
const ST=o=>({mmo:3,crisis:'all',types:{'รพศ.':true,'รพท.':true,'รพช.':true},prov:'all',ext:0,tgt:6,moeVer:'69',payPct:50,moePct:{},moePctAll:0,moeOff:{},moeOvr:{},xmoe:true,adj:{},adjAll:0,revOff:{},ovr:{},tj:{mode:'off',scope:'crisis'},inj:{},open:{},xfer:[],arPct:100,arOvr:{},wide:false,clGrow:true,seas:true,...o});
let fail=[];
const chk=(ok,m)=>{ console.log(`  ${ok?'✅':'❌'} ${m}`); if(!ok) fail.push(m); };
// อ่านเลขจากบนจอ (fmtM: 12.3M / 456K / 1.23B) และจาก TSV (หน่วยล้านบาท 2 ตำแหน่ง)
const scr=s=>{ const t=String(s).replace(/,/g,'').trim(); if(!t||t==='–'||t==='-'||t==='—') return null;
  // 🪤 ต้องรับเครื่องหมายนำหน้าครบ: + (บวก) · − (ลบ อักขระ U+2212 ไม่ใช่ hyphen) · "ขาด"
  // "ติดลบ" = คำนำหน้าของคอลัมน์ "เงินสด+เทียบเท่าหลังจัดการหนี้สิน" (เพิ่ม 11 ส.ค. 69)
  const m=t.match(/^(ขาด\s*|ติดลบ\s*)?([+−-]?)([\d.]+)\s*([BMK]?)/); if(!m) return null;
  const sign=(m[1]||m[2]==='-'||m[2]==='−')?-1:1;
  return parseFloat(m[3])*({B:1e9,M:1e6,K:1e3,'':1}[m[4]])*sign; };
const tsvN=s=>{ const t=String(s).trim(); if(!t||t==='-'||t==='ไม่พอ') return null;
  const v=parseFloat(t.replace(/,/g,'')); return isNaN(v)?null:v*1e6; };
const cellMain=c=>c.replace(/<span class="cellsub[\s\S]*?<\/span>/g,'').replace(/<button[\s\S]*?<\/button>/g,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();

// จับคู่ คอลัมน์บนจอ ↔ ชื่อคอลัมน์ใน TSV
// ⚠️ ฝั่งจอใช้ "ชื่อหัวคอลัมน์" ไม่ใช่เลขดัชนี (แก้ 11 ส.ค. 69) — ตอนเรียงคอลัมน์ใหม่ตามคำสั่งเจ้าของงาน
//    ดัชนีคงที่ทำให้เทสต์จับคู่ผิดคอลัมน์แล้วฟ้อง 21 ข้อทั้งที่ค่าบนจอกับ TSV ตรงกันอยู่
// ⚠️ ป้าย NI/NWC มีชื่อเดือนเป้าอยู่ในหัวคอลัมน์ → ต้องสร้าง PAIRS **หลัง** setEXST ทุกรอบ
//    (เรียก exSepLab() ตอน module load จะพังเพราะ EXST ยังเป็น null)
const mkPAIRS=()=>[
  ['เจ้าหนี้','เจ้าหนี้ OP-UC นอก CUP ในจังหวัด 2101020199.202(ลบ.)'],
  ['ลูกหนี้','ลูกหนี้ UC-OP นอก CUP ในจังหวัด 1102050101.203+1102050194.204(ลบ.)'],
  ['เงินสด+เทียบเท่า','เงินสด+เทียบเท่า(ลบ.)'],
  ['หลังจัดการหนี้สิน','เงินสด+เทียบเท่า หลังจัดการหนี้สิน(ลบ. · เงินสด−เจ้าหนี้+ลูกหนี้±โยกช่วย)'],
  ['MOE/เดือน','MOE กองเศรษฐฯ/เดือน(ลบ. · เงินสดจ่ายจริง)'],
  ['NI สะสม','NI สะสม ณ '+A.exSepLab()+' (คาดการณ์)'],
  ['NWC','NWC ณ '+A.exSepLab()+' (คาดการณ์)'],
];
for(const st of [{},{arPct:62},{arPct:62,tj:{mode:'forgive',scope:'all'}},{crisis:'67',arPct:62}]){
  A.setEXST(ST(st)); A.setEXOPEN({}); A.setEXBRK({}); A.setEXSORT({col:null,dir:-1}); A.exRender();
  const PAIRS=mkPAIRS();
  const tsv=A.getTSV().split('\n').map(l=>l.split('\t'));
  const head=tsv[0], body=tsv.slice(1,-1), foot=tsv[tsv.length-1];
  const res=els['exResBox'].innerHTML;
  const rows=[...res.matchAll(/<tr>\s*<td>([^<]*)<\/td>\s*<td[^>]*><b>([^<]+)<\/b>[\s\S]*?<\/tr>/g)]
    .map(m=>({name:m[2], tds:[...m[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x=>x[1])}));
  console.log(`\n━━ ${JSON.stringify(st)} ━━  จอ ${rows.length} แถว · TSV ${body.length} แถว · ${head.length} คอลัมน์`);
  chk(rows.length===body.length, `จำนวนแถวตรงกัน (จอ ${rows.length} = TSV ${body.length})`);
  chk(body.every(r=>r.length===head.length) && foot.length===head.length,
    'ทุกแถวมีจำนวนช่องเท่าหัวตาราง (แถวรวมไม่เลื่อน)');
  // ชื่อ รพ. ต้องเรียงตรงกันแถวต่อแถว
  const nameCol=head.indexOf('โรงพยาบาล');
  const orderBad=body.filter((r,i)=>r[nameCol]!==rows[i].name).length;
  chk(orderBad===0, `ลำดับ รพ. ตรงกันทุกแถว (ต่าง ${orderBad})`);
  // ดัชนีคอลัมน์บนจอ อ่านจากหัวตารางจริง (ดูหมายเหตุที่ PAIRS)
  const sths=[...res.match(/<tr>[\s\S]*?<\/tr>/)[0].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)]
    .map(m=>m[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,''));
  // เทียบค่าทีละเซลล์
  for(const [scrLab,hname] of PAIRS){
    const ti=sths.findIndex(t=>t.includes(scrLab.replace(/\s+/g,'')));
    const ci=head.indexOf(hname);
    if(ti<0){ chk(false, `หาคอลัมน์ "${scrLab}" บนจอไม่เจอ`); continue; }
    if(ci<0){ chk(false, `หาคอลัมน์ "${hname.slice(0,40)}" ใน TSV ไม่เจอ`); continue; }
    let bad=0, ex='';
    body.forEach((r,i)=>{
      const a=scr(cellMain(rows[i].tds[ti])), b=tsvN(r[ci]);
      // จอแสดง "–" เมื่อค่าเป็น 0 ส่วน TSV เขียน 0.00 — ความหมายเดียวกัน ไม่ใช่ความไม่ตรงกัน
      if((a==null?0:a)===0 && (b==null?0:b)===0) return;
      if(a==null&&b==null) return;
      const tol=Math.max(60000, Math.abs(a||0)*0.012);   // จอปัด 1 ตำแหน่ง TSV ปัด 2
      if(a==null||b==null||Math.abs(a-b)>tol){ bad++; if(!ex) ex=`${rows[i].name}: จอ ${cellMain(rows[i].tds[ti])} ≠ TSV ${r[ci]}`; }
    });
    chk(bad===0, `คอลัมน์ "${hname.split('(')[0].trim().slice(0,38)}" ตรงกันทั้ง ${body.length} แถว${bad?' — ผิด '+bad+' · '+ex:''}`);
  }
}
// ══ TSV ของตารางสรุปรายจังหวัด (ปุ่ม 📋 คัดลอกตารางนี้) ต้องตรงกับตารางบนจอเช่นกัน ══
console.log('\n━━ TSV ของตารางสรุปรายจังหวัด ━━');
const A2=new Function(code+`;return {exRender,getProvTSV:()=>EXPROV_TSV,setEX:v=>{EX=v},setEXST:v=>{EXST=v},setEXOPEN:v=>{EXOPEN=v},setEXBRK:v=>{EXBRK=v},setEXSORT:v=>{EXSORT=v}};`)();
A2.setEX(JSON.parse(fs.readFileSync(process.env.RD_JSON||'D:/Github/Rh1-BalanceSheet/docs/data/risk/exec.json','utf8')));
for(const st of [{},{arPct:62},{crisis:'67',arPct:62},{prov:'ลำปาง',arPct:62}]){
  A2.setEXST(ST(st)); A2.setEXOPEN({}); A2.setEXBRK({}); A2.setEXSORT({col:null,dir:-1}); A2.exRender();
  const t=A2.getProvTSV().split('\n').map(l=>l.split('\t'));
  const scrRows=[...els['exProvTjBox'].innerHTML.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
    .map(m=>[...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x=>x[1])).filter(r=>r.length===6);
  const lab=JSON.stringify(st);
  chk(t.length-1===scrRows.length, `${lab}: จำนวนแถวตรงกัน (TSV ${t.length-1} = จอ ${scrRows.length})`);
  chk(t.every(r=>r.length===t[0].length), `${lab}: ทุกแถวมีจำนวนช่องเท่าหัวตาราง`);
  let bad=0, ex='';
  scrRows.forEach((r,i)=>{
    const tr=t[i+1]; if(!tr) return;
    // [ดัชนีคอลัมน์บนจอ, ดัชนีช่องใน TSV, ชื่อ] — คอลัมน์สุทธิถูกถอดออก 8 ส.ค. 69
    // แทนด้วย เงินช่วยภายในจังหวัด (จอ 4 ↔ TSV 7) และ ส่วนขาดสภาพคล่อง(MOE) (จอ 5 ↔ TSV 9)
    const pairs=[[0,0,'จังหวัด'],[1,1,'จำนวน รพ.'],[2,2,'หนี้'],[3,3,'ลูกหนี้'],
                 [4,7,'เงินช่วยภายในจังหวัด'],[5,9,'ส่วนขาดสภาพคล่อง(MOE)']];
    pairs.forEach(([si,ti,nm])=>{
      const sv=cellMain(r[si]), tv=String(tr[ti]).trim();
      if(si===0||si===1){ if(sv.replace(/<[^>]+>/g,'')!==tv && !sv.includes(tv)){ bad++; if(!ex) ex=`${nm}: จอ "${sv}" ≠ TSV "${tv}"`; } return; }
      const a=scr(sv), b=tsvN(tv);
      if((a==null?0:a)===0&&(b==null?0:b)===0) return;
      if(a==null||b==null||Math.abs(a-b)>Math.max(60000,Math.abs(a)*0.012)){ bad++; if(!ex) ex=`${nm}: จอ "${sv}" ≠ TSV "${tv}"`; }
    });
  });
  chk(bad===0, `${lab}: ทุกเซลล์ตรงกัน (ผิด ${bad}${ex?' · '+ex:''})`);
}
const src2=fs.readFileSync(SRC,'utf8');
chk(/onclick="exCopyProvTSV\(\)"/.test(src2), 'ตารางสรุปรายจังหวัดมีปุ่ม 📋 คัดลอก');
chk(/EXPROV_TSV=\[/.test(src2), 'TSV ของตารางสรุปสร้างจากตัวแปร P/T ชุดเดียวกับที่วาดตาราง');

console.log(`\n${fail.length?'❌ ไม่ผ่าน '+fail.length+' ข้อ:\n  - '+fail.join('\n  - '):'✅ ไฟล์ TSV ทั้งสองตาราง = ตัวเลขบนจอ ทุกเซลล์ ทุกสถานะ'}`);
process.exit(fail.length?1:0);
