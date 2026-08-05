// ตรวจคอลัมน์ชุดใหม่ในตาราง #exec: ซ่อนลูกหนี้ · เจ้าหนี้เตือนแดง · เงินสดคงเหลือหลังภาระ MOE · ส่วนขาดสภาพคล่อง
// ตรวจ "สูตรรายแห่งครบ 103" ไม่ใช่แค่จำนวนคอลัมน์ + ตรวจว่าเปลี่ยนช่วงจำลองแล้วตัวเลขขยับจริง
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
global.location={hash:''}; global.navigator={clipboard:null};
global.getComputedStyle=()=>({getPropertyValue:()=>'#888'});
global.Chart=function(){return{destroy(){}}}; global.fetch=()=>Promise.reject(0);
const A=new Function(code+`;return {exRender,exSimPath,exMoeLeft,exTopUp,exHorMonths,exPayIn,exHorLab,tLab,exMoeMonths,exMoeTargetLab,EXMAX:EX_MMO_MAX,
  SHOW_TJAR:EX_SHOW_TJAR,getTSV:()=>EX_TSV,setEX:v=>{EX=v},setEXST:v=>{EXST=v},
  setEXOPEN:v=>{EXOPEN=v},setEXBRK:v=>{EXBRK=v},setEXSORT:v=>{EXSORT=v},getEXST:()=>EXST};`)();
const j=JSON.parse(fs.readFileSync('D:/Github/Rh1-BalanceSheet/docs/data/risk/exec.json','utf8'));
const ST=(ext,mmo)=>({mmo,crisis:'all',types:{'รพศ.':true,'รพท.':true,'รพช.':true},prov:'all',ext,tgt:6,
  moePct:{},moePctAll:0,moeOff:{},moeOvr:{},xmoe:true,adj:{},adjAll:0,revOff:{},ovr:{},
  tj:{mode:'off',scope:'crisis'},inj:{},open:{}});
const fmtM=v=>{if(v==null)return '—';const a=Math.abs(v);if(a>=1e9)return(v/1e9).toFixed(2)+'B';if(a>=1e6)return(v/1e6).toFixed(1)+'M';if(a>=1e3)return(v/1e3).toFixed(0)+'K';return Math.round(v).toLocaleString()};
const txt=s=>s.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
let fail=[];
const chk=(ok,msg)=>{ console.log(`  ${ok?'✅':'❌'} ${msg}`); if(!ok) fail.push(msg); };

A.setEX(j);
console.log(`ไฟล์: ${SRC}`);

// ── ป้ายงวด tLab: เดือนงบ 1-3 (ต.ค.-ธ.ค.) อยู่ในปีปฏิทินก่อนหน้าปีงบ ──
console.log('\n━━ ป้ายงวด tLab (ข้ามรอยต่อปีงบ) ━━');
let badLab=0;
for(const [t,want,real] of [[256901,'ต.ค.68','ตุลาคม 2568'],[256903,'ธ.ค.68','ธันวาคม 2568'],
                            [256904,'ม.ค.69','มกราคม 2569'],[256909,'มิ.ย.69','มิถุนายน 2569'],
                            [256912,'ก.ย.69','กันยายน 2569'],[257001,'ต.ค.69','ตุลาคม 2569'],
                            [257003,'ธ.ค.69','ธันวาคม 2569'],[257012,'ก.ย.70','กันยายน 2570']]){
  const got=A.tLab(t); if(got!==want) badLab++;
  console.log(`  ${got===want?'✅':'❌'} ${t} → ${got}${got===want?'':' (ควรเป็น '+want+')'}  [${real}]`);
}
chk(badLab===0, `ป้ายงวดถูกต้องทุกเดือน (ผิด ${badLab})`);
// หน้าอื่นต้องใช้สูตรเดียวกัน — กันหน้าใดหน้าหนึ่งตกขบวนอีก
for(const f of ['index.html','explorer.html']){
  const src=fs.readFileSync('D:/Github/Rh1-BalanceSheet/docs/'+f,'utf8');
  chk(/fm<=3\?fy-1:fy|m<=3\?1:0/.test(src), `${f} ใช้สูตรปีปฏิทินเดียวกัน (ไม่หลุดออกจากกัน)`);
}
console.log();
console.log(`EX_SHOW_TJAR = ${A.SHOW_TJAR} (ต้องเป็น false = ซ่อนลูกหนี้)\n`);

for(const mmo of [1,3,6]){
  const ext=0;
  A.setEXST(ST(ext,mmo)); A.setEXOPEN({}); A.setEXBRK({}); A.setEXSORT({col:null,dir:-1});
  A.exRender();
  const html=els.exResBox.innerHTML;
  const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(m=>m[0]);
  const head=rows[0], main=rows.filter(r=>r.includes('class="ovtgl"'));
  const nTh=(head.match(/<th\b/g)||[]).length;
  const months=A.exMoeMonths();
  console.log(`━━ ประเมินสภาพคล่อง ${months} เดือน → ถึง ${A.exMoeTargetLab()} ━━`);
  // หัวคอลัมน์ตัดบรรทัดด้วย <br> — เทียบแบบตัดช่องว่างทิ้งทั้งหมด จะได้ไม่พังเวลาย้ายตำแหน่งตัดบรรทัด
  const norm=s=>s.replace(/<br\s*\/?>/g,' ').replace(/\s+/g,'');
  const headTxt=norm(head), inHead=s=>headTxt.includes(norm(s));
  chk(nTh===14, `หัวตาราง 14 ช่อง (ได้ ${nTh})`);
  chk(!inHead('ลูกหนี้'), 'ไม่มีคอลัมน์ลูกหนี้ในหัวตาราง');
  chk(inHead('เงินสดคงเหลือหลังภาระ MOE ถึง '+A.exMoeTargetLab()), `หัวคอลัมน์ระบุเดือนประเมิน "${A.exMoeTargetLab()}"`);
  chk(inHead('ส่วนขาดสภาพคล่อง'), 'มีคอลัมน์ส่วนขาดสภาพคล่อง');
  chk(/สมมติฐานว่ารายรับหยุดสนิท/.test(html)&&/ไม่ใช่คำของบ/.test(html), 'กล่องเหนือตารางระบุสมมติฐาน + ไม่ใช่คำของบ');
  chk(!inHead('จะหมด?'), 'คอลัมน์ "เงินสดจะหมด?" ถูกแทนที่แล้ว');
  // คอลัมน์ชื่อ รพ. ต้องตรึงตอนปัดแนวนอน (คลาส ex-sticky + CSS sticky ของ nth-child(2))
  chk(/<table class="wltbl ex-sticky"/.test(html), 'ตารางมีคลาส ex-sticky (ตรึงคอลัมน์ชื่อ รพ.)');
  chk(main.length===j.hosp.length, `แถวหลักครบ ${main.length}/${j.hosp.length}`);

  let badCol=0,badLeft=0,badTop=0,badRed=0,badSub=0,nRed=0,nTop=0;
  for(const h of j.hosp){
    const r=main.find(x=>x.includes('<b>'+h.name+'</b>')); if(!r){badCol++;continue;}
    const tds=[...r.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
    if(tds.length!==nTh) badCol++;
    const r0=A.exSimPath(h,0);
    const x={h,r0};
    const pay=A.exPayIn(h);
    const expLeft=(h.bs.cn-pay)-(r0.moeMo||0)*months;
    const expTop=expLeft<0?-expLeft:0;
    // ตรวจว่า helper ตรงกับสูตรที่ตั้งใจ (ไม่ใช่แค่ตรงกับตัวเอง)
    if(Math.abs(A.exMoeLeft(x)-expLeft)>1) badLeft++;
    if(Math.abs(A.exTopUp(x)-expTop)>1) badTop++;
    if(A.exHorMonths(h)!==months) badLeft++;
    const cLeft=txt(tds[7][1]), cTop=txt(tds[8][1]), cPay=tds[6][0];
    // เซลล์ต้องแสดงตัวเลขตรงกับสูตร
    if(expLeft<0 ? !cLeft.startsWith('ขาด '+fmtM(-expLeft)) : !cLeft.startsWith(fmtM(expLeft))) badLeft++;
    if(expTop>0){ nTop++; if(!txt(tds[8][1]).startsWith(fmtM(expTop))) badTop++; }
    else if(cTop!=='–') badTop++;
    // เจ้าหนี้: แดงเมื่อเงินสดไม่พอ + บอกส่วนขาด
    const gap=pay-h.bs.cn;
    if(gap>0){ nRed++;
      if(!/var\(--red\)/.test(cPay)||!cPay.includes('ขาด '+fmtM(gap))) badRed++; }
    else if(pay>0&&/var\(--red\)/.test(cPay)) badRed++;
    // เซลล์ต้องติดป้ายสมมติฐานให้ทั้ง 2 บรรทัด ไม่งั้นอ่านแล้วดูขัดกันเอง (ข้อ 4)
    const wantSub=r0.cashOut!=null?'กรณีรายรับปกติ: เงินสดติดลบ':'กรณีรายรับปกติ: เงินสดไม่ติดลบ';
    if(!cLeft.includes(wantSub)||!cLeft.includes('สมมติรายรับหยุด')) badSub++;
  }
  chk(badCol===0, `ทุกแถวมี td ครบเท่าหัว (ผิด ${badCol})`);
  chk(badLeft===0, `เงินสดคงเหลือหลังภาระ MOE ตรงสูตร (เงินสด−เจ้าหนี้)−MOE×${months} ทุกแห่ง (ผิด ${badLeft})`);
  chk(badTop===0, `ส่วนขาดสภาพคล่อง = ส่วนที่ติดลบ ทุกแห่ง (ผิด ${badTop}) · เปราะ ${nTop} แห่ง`);
  chk(badRed===0, `เจ้าหนี้ไฮไลต์แดง+บอกส่วนขาดถูกต้อง (ผิด ${badRed}) · แดง ${nRed} แห่ง`);
  chk(badSub===0, `ทั้ง 2 บรรทัดในเซลล์ติดป้ายสมมติฐานครบ (ผิด ${badSub})`);
  // colspan ต้องเท่าหัวตารางเสมอ
  A.setEXOPEN({[j.hosp[0].hcode]:true}); A.setEXBRK({[j.hosp[1].hcode]:6}); A.exRender();
  const cs=[...els.exResBox.innerHTML.matchAll(/<tr class="ovsub"><td colspan="(\d+)"/g)].map(m=>+m[1]);
  chk(cs.length===2&&cs.every(c=>c===nTh), `colspan แถวย่อย = ${nTh} (ได้ ${cs.join(',')})`);
  A.setEXOPEN({}); A.setEXBRK({}); A.exRender();
  // TSV
  const L=A.getTSV().split('\n'), w=[...new Set(L.map(l=>l.split('\t').length))];
  chk(w.length===1, `TSV ทุกบรรทัดกว้างเท่ากัน (${w.join(',')} คอลัมน์)`);
  chk(!L[0].includes('ลูกหนี้'), 'TSV ไม่มีคอลัมน์ลูกหนี้ (ตรงกับตาราง)');
  const hh=L[0].split('\t'), tt=L[L.length-1].split('\t');
  const iTop=hh.findIndex(c=>c.startsWith('ส่วนขาดสภาพคล่อง'));
  const sumTop=j.hosp.reduce((s,h)=>{const r0=A.exSimPath(h,0);return s+A.exTopUp({h,r0});},0);
  chk(iTop>=0&&Math.abs(parseFloat(tt[iTop])-sumTop/1e6)<0.02, `ยอดรวมส่วนขาดสภาพคล่องใน TSV ตรง (${tt[iTop]} vs ${(sumTop/1e6).toFixed(2)})`);
  console.log(`   → ส่วนขาดสภาพคล่องรวม ${(sumTop/1e6).toFixed(1)} ลบ. · เปราะ ${nTop} แห่ง · เจ้าหนี้เกินเงินสด ${nRed} แห่ง\n`);
}

// ── สาขาเตือน "เงินสดติดลบ" ต้องเรนเดอร์ได้จริง ──
// ข้อมูลจริงงวดนี้ทุกแห่งเงินสดไม่ติดลบ สาขานี้จึงไม่เคยถูกรัน — ต้องยิงด้วยเคสสังเคราะห์
// ไม่งั้นเป็นโค้ดที่ไม่มีใครทดสอบ แล้วพังเงียบตอนมี รพ. เข้าเงื่อนไขจริง
console.log('━━ สาขาเตือน "เงินสดติดลบ" (เคสสังเคราะห์) ━━');
{
  const k=JSON.parse(JSON.stringify(j));
  const t=k.hosp[0];
  t.bs.cn=200000; t.bs.depMo=0; t.bs.donMo=0; t.rev={};   // เงินสดน้อย + ไม่มีรายรับ + ไม่มีค่าเสื่อมกลบ
  A.setEX(k); A.setEXST(ST(0,3)); A.setEXOPEN({}); A.setEXBRK({}); A.setEXSORT({col:null,dir:-1});
  A.exRender();
  const row=[...els.exResBox.innerHTML.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(m=>m[0])
    .find(x=>x.includes('<b>'+t.name+'</b>'));
  const td=[...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)][7][1];
  const plain=td.replace(/<[^>]*>/g,'');
  chk(/cellsub warn/.test(td), 'ใช้สไตล์เตือน (สีแดง) เมื่อแบบจำลองบอกว่าเงินสดติดลบ');
  chk(/กรณีรายรับปกติ: เงินสดติดลบ [ก-ฮ]/.test(plain), `ระบุเดือนที่เงินสดติดลบ (${(plain.match(/เงินสดติดลบ \S+/)||[])[0]||'—'})`);
  chk(plain.includes('สมมติรายรับหยุด'), 'ยังติดป้ายสมมติฐานให้บรรทัดบนครบ');
  A.setEX(j);   // คืนข้อมูลจริงให้การทดสอบถัดไป
}
console.log();

// ── tooltip หัวคอลัมน์ต้องมาตั้งแต่ "เรนเดอร์ครั้งแรก" ──
// EX_COLDEF_MAP ต้องถูกตั้งก่อนสร้าง exHeadRow ไม่งั้น exSortTh อ่านแผนที่ว่าง → title หายทั้งแถว
// (เคยพลาดมาแล้ว ตอนย้ายหัวตารางขึ้นไปสร้างก่อนเพื่อคำนวณ colspan)
console.log('━━ tooltip หัวคอลัมน์ (เรนเดอร์ครั้งแรก) ━━');
{
  const B=new Function(code+`;return {exRender,setEX:v=>{EX=v},setEXST:v=>{EXST=v},
    setEXOPEN:v=>{EXOPEN=v},setEXBRK:v=>{EXBRK=v},setEXSORT:v=>{EXSORT=v}};`)();   // instance ใหม่ = EX_COLDEF_MAP ว่างจริง
  B.setEX(j); B.setEXST(ST(0,3)); B.setEXOPEN({}); B.setEXBRK({}); B.setEXSORT({col:null,dir:-1});
  B.exRender();
  const ths=[...els.exResBox.innerHTML.matchAll(/<th class="exsortth[^>]*>/g)].map(m=>m[0]);
  const noTitle=ths.filter(t=>!/ title="[^"]+"/.test(t));
  chk(ths.length>0&&noTitle.length===0,
      `หัวคอลัมน์มี tooltip ครบ ${ths.length-noTitle.length}/${ths.length} ตั้งแต่เรนเดอร์แรก`);
  const bad=ths.filter(t=>/ title="[^"]*"[^ >]/.test(t));   // อัญประกาศใน title ตัด attribute กลางคัน
  chk(bad.length===0, `title ไม่มีอัญประกาศดิบที่ทำ markup เพี้ยน (พบ ${bad.length})`);
}
console.log();

// ── ⭐ หัวใจของการแก้ข้อ 2: คอลัมน์ทดสอบความทนทานต้อง "ไม่" ขยับตาม dropdown ช่วงจำลอง ──
// เดิมผูกกับ EXST.ext ทำให้เลือก +12 เดือนแล้วตัวเลขบวมเป็นหมื่นล้าน อ่านเป็นเม็ดเงินจริงไม่ได้
console.log('━━ แยกจากช่วงจำลอง (EXST.ext) ━━');
const totFor=()=>{ A.exRender(); return j.hosp.reduce((s,h)=>{const r0=A.exSimPath(h,0);return s+A.exTopUp({h,r0});},0); };
A.setEXST(ST(0,3));  const base=totFor(), baseLab=A.exMoeTargetLab();
let drift=0;
for(const ext of [3,6,12]){
  A.setEXST(ST(ext,3));
  const v=totFor();
  const same=Math.abs(v-base)<1 && A.exMoeTargetLab()===baseLab;
  if(!same) drift++;
  console.log(`  ${same?'✅':'❌'} ext=${String(ext).padStart(2)} → ส่วนที่ขาดรวม ${(v/1e6).toFixed(1)} ลบ. · เดือนเป้า ${A.exMoeTargetLab()}${same?'  (ไม่ขยับ ถูกต้อง)':'  ← ยังผูกกันอยู่!'}`);
}
chk(drift===0, 'เปลี่ยนช่วงจำลองแล้วคอลัมน์ประเมินสภาพคล่องไม่ขยับ');
// เพดาน 6 เดือน — ค่าเกินต้องตกกลับเป็นค่าเริ่มต้น ไม่ใช่ยอมรับ
A.setEXST(ST(0,99)); A.exRender();
chk(A.exMoeMonths()<=A.EXMAX, `ค่าเกินเพดานถูกจำกัด (mmo=99 → ${A.exMoeMonths()} เดือน · เพดาน ${A.EXMAX})`);
A.setEXST(ST(0,0)); A.exRender();
chk(A.exMoeMonths()>=1, `ค่าต่ำกว่า 1 ถูกจำกัด (mmo=0 → ${A.exMoeMonths()} เดือน)`);
console.log();

// เรียงลำดับคอลัมน์ใหม่
A.setEXST(ST(0,3));
for(const col of ['moeleft','topup']){
  A.setEXSORT({col,dir:-1}); A.exRender();
  const rr=[...els.exResBox.innerHTML.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(m=>m[0]).filter(r=>r.includes('class="ovtgl"'));
  const first=(rr[0].match(/<b>([^<]+)<\/b>/)||[])[1];
  const vals=j.hosp.map(h=>{const r0=A.exSimPath(h,0);const x={h,r0};return {n:h.name,v:col==='moeleft'?A.exMoeLeft(x):A.exTopUp(x)};});
  const want=vals.sort((a,b)=>b.v-a.v)[0].n;
  chk(first===want, `sort ${col} มาก→น้อย แถวแรก = ${first}`);
}
console.log('\n'+(fail.length?`❌ ไม่ผ่าน ${fail.length} ข้อ:\n  `+fail.join('\n  '):'✅ ผ่านทุกข้อ'));
process.exit(fail.length?1:0);
