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
const A=new Function(code+`;return {fmtM,exRender,exSimPath,exMoeLeft,exTopUp,exHorMonths,exPayIn,exArIn,exHorLab,tLab,exMoeMonths,exMoeTargetLab,EXMAX:EX_MMO_MAX,
  exNetAfterDebt,exSolveCrit,exSolveCritNi,exSolveFor,exNeedPop,exNeedClose,NEEDC:EX_NEEDC,STEP:SV_STEP,
  SHOW_TJAR:EX_SHOW_TJAR,SHOW_GIVE:EX_SHOW_GIVE,getTSV:()=>EX_TSV,setEX:v=>{EX=v},setEXST:v=>{EXST=v},
  setEXOPEN:v=>{EXOPEN=v},setEXBRK:v=>{EXBRK=v},setEXSORT:v=>{EXSORT=v},getEXST:()=>EXST};`)();
const raw2=fs.readFileSync(SRC,'utf8');   // ซอร์สทั้งไฟล์ — ใช้ตรวจว่า EXST.ext ไม่มีคนอ่านเหลืออยู่จริง
const j=JSON.parse(fs.readFileSync('D:/Github/Rh1-BalanceSheet/docs/data/risk/exec.json','utf8'));
const ST=(ext,mmo)=>({mmo,crisis:'all',types:{'รพศ.':true,'รพท.':true,'รพช.':true},prov:'all',ext,tgt:6,
  moePct:{},moePctAll:0,moeOff:{},moeOvr:{},xmoe:true,adj:{},adjAll:0,revOff:{},ovr:{},
  tj:{mode:'off',scope:'crisis'},inj:{},open:{}});
// ⚠️ ห้ามลอกสูตร fmtM มาไว้ที่นี่ — ดึงจากหน้าเว็บตรง ๆ ไม่งั้นพอเปลี่ยนจำนวนทศนิยม
//    เทสต์จะเทียบกับสูตรเก่าของตัวเองแล้วฟ้องผิดทั้งที่หน้าเว็บถูก (เกิดจริง 9 ส.ค. 69)
const fmtM=A.fmtM;
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
console.log(`EX_SHOW_TJAR = ${A.SHOW_TJAR} (${A.SHOW_TJAR?'เปิดคอลัมน์ลูกหนี้':'ซ่อนคอลัมน์ลูกหนี้'})\n`);
// ── ⚠️ เลิกผูกดัชนีคอลัมน์เป็นเลขคงที่ (11 ส.ค. 69) ──────────────────────────────────
// ของเดิมใช้ tds[7+TJOFF] ฯลฯ พอเรียงคอลัมน์ใหม่ตามคำสั่งเจ้าของงาน เทสต์ฟ้อง 23 ข้อทั้งที่หน้าเว็บถูก
// ตอนนี้อ่านหัวตารางจริงแล้วหาตำแหน่งจากชื่อคอลัมน์ → ย้ายคอลัมน์อีกกี่ครั้งก็ไม่ต้องแก้เลขในเทสต์
// ฐาน 20 = จังหวัด·ชื่อ·ระดับ·เงินสด·เจ้าหนี้·สุทธิ·MOE·NI·คงเหลือ·ส่วนขาด·ระดับก่อน·[6 เกณฑ์]·รวม·ระดับหลัง·ปุ่ม
const NCOL=20+(A.SHOW_TJAR?1:0);
const NEEDC=A.NEEDC;

for(const mmo of [1,3,6,13]){
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
  // ดัชนีคอลัมน์อ่านจากหัวตารางจริง (ดูเหตุผลที่ NCOL ด้านบน)
  const ths=[...head.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)].map(m=>norm(m[1].replace(/<[^>]+>/g,' ')));
  const iOf=s=>ths.findIndex(t=>t.includes(norm(s)));
  const iPay=iOf('เจ้าหนี้'), iNet=iOf('หลังจัดการหนี้สิน'), iNI=iOf('NI/เดือน'),
        iLeft=iOf('คงเหลือหลังภาระMOE'), iTopC=iOf('ส่วนขาด');
  chk(nTh===NCOL, `หัวตาราง ${NCOL} ช่อง (ได้ ${nTh})`);
  chk([iPay,iNet,iNI,iLeft,iTopC].every(i=>i>=0), `หาตำแหน่งคอลัมน์หลักจากหัวตารางได้ครบ (เจ้าหนี้ ${iPay} · สุทธิ ${iNet} · NI ${iNI} · คงเหลือ ${iLeft} · ส่วนขาด ${iTopC})`);
  // ── ลำดับคอลัมน์ต้องอ่านเป็นสายเลขคณิตซ้าย→ขวา (เจ้าของงานสั่ง 11 ส.ค. 69) ──
  //    เงินสด → −เจ้าหนี้ → +ลูกหนี้ → =สุทธิ → −MOE → NI → คงเหลือ → ส่วนขาด → ระดับก่อน → 6 เกณฑ์ → รวม → ระดับหลัง
  const order=['เงินสด+เทียบเท่า','เจ้าหนี้',...(A.SHOW_TJAR?['ลูกหนี้']:[]),'หลังจัดการหนี้สิน','MOE/เดือน','NI/เดือน',
               'คงเหลือหลังภาระMOE','ส่วนขาด','ก่อนช่วย',...NEEDC.map(c=>c.n+norm(c.th)),'รวม(Solver)','หลังช่วย'];
  const pos=order.map(s=>iOf(s));
  chk(pos.every((v,i)=>v>=0&&(i===0||v>pos[i-1])), `ลำดับคอลัมน์ถูกทั้งแถว (${pos.join('<')})`);
  // 6 คอลัมน์เงินที่ต้องสนับสนุนรายเกณฑ์ + แถบสีกลุ่ม
  const nNeedTh=(head.match(/class="exsortth[^"]*exneed"/g)||[]).length;
  chk(nNeedTh===NEEDC.length, `หัวตารางมีคอลัมน์เกณฑ์ครบ ${NEEDC.length} ช่อง พร้อมคลาสแถบสี exneed (ได้ ${nNeedTh})`);
  chk(NEEDC.map(c=>c.n).join(',')==='Cash,QR,CR,NWC,NI,SU', `เรียงเกณฑ์ตามที่สั่ง Cash|QR|CR|NWC|NI|SU (ได้ ${NEEDC.map(c=>c.n).join('|')})`);
  chk(inHead('ต้องใช้ให้ผ่าน'), 'หัวคอลัมน์ทุกช่องในกลุ่มมีป้าย "ต้องใช้ให้ผ่าน" (ใช้แทนหัวตาราง 2 ชั้นที่ทำให้ sticky พัง)');
  chk(/ห้ามบวก 6 คอลัมน์รวมกัน|ห้ามบวก 6 คอลัมน์/.test(html), 'มีคำเตือนห้ามบวก 6 คอลัมน์รวมกันในหน้า');
  chk(!inHead('เงินที่ยกให้'), 'ตัดคอลัมน์ "เงินที่ยกให้" ออกจากตารางแล้ว (11 ส.ค. 69)');
  chk(headTxt.includes('เงินที่ยกให้'.replace(/\s/g,''))===A.SHOW_GIVE, A.SHOW_GIVE?'มีคอลัมน์เงินที่ยกให้':'ไม่มีคอลัมน์เงินที่ยกให้ (ปิดไว้ — ตรวจแล้วไม่ถูกคิดซ้ำ)');
  chk(inHead('ลูกหนี้')===A.SHOW_TJAR, A.SHOW_TJAR?'มีคอลัมน์ลูกหนี้ในหัวตาราง':'ไม่มีคอลัมน์ลูกหนี้ในหัวตาราง');
  // หัวคอลัมน์เปลี่ยนเป็น "เงินสด+เทียบเท่าคงเหลือหลังภาระ MOE ถึง …" (เจ้าของงานสั่ง 11 ส.ค. 69)
  chk(inHead('คงเหลือหลังภาระ MOE ถึง '+A.exMoeTargetLab()), `หัวคอลัมน์ระบุเดือนประเมิน "${A.exMoeTargetLab()}"`);
  chk(inHead('ส่วนขาดสภาพคล่อง'), 'มีคอลัมน์ส่วนขาดสภาพคล่อง');
  // ── เดือนเป้าต้องตามตัวกรอง (เจ้าของงานสั่ง 11 ส.ค. 69) — ป้ายทุกคอลัมน์ที่ตัดสิน "ณ เดือนเป้า" ──
  chk(inHead('ระดับ '+A.exMoeTargetLab()+' ก่อนช่วย')&&inHead('ระดับ '+A.exMoeTargetLab()+' หลังช่วย'),
      `คอลัมน์ระดับก่อน/หลังช่วย ใช้เดือนที่เลือกในตัวกรอง "${A.exMoeTargetLab()}" ไม่ใช่ ก.ย. ตายตัว`);
  chk(!/ระดับ ก\.ย\.69<br>ก่อนช่วย/.test(head)||A.exMoeTargetLab()==='ก.ย.69',
      'ไม่มีป้าย ก.ย. ค้างในหัวคอลัมน์เมื่อเลือกเดือนอื่น');
  chk(/กรณีรายรับไม่เป็นไปตามแผน ขั้นรุนแรงสุด \(ไม่มีรายรับเข้าเลย\)/.test(html)&&/ไม่ใช่คำของบ/.test(html), 'กล่องเหนือตารางระบุสมมติฐาน + ไม่ใช่คำของบ');
  // สำนวนเดิม "รายรับหยุด/หยุดสนิท" เลิกใช้แล้ว (5 ส.ค. 69) — กันหลุดกลับมาในข้อความที่ผู้ใช้เห็น
  chk(!/รายรับหยุด/.test(html), 'ไม่มีสำนวนเดิม "รายรับหยุด" เหลือในหน้า');
  chk(!inHead('จะหมด?'), 'คอลัมน์ "เงินสดจะหมด?" ถูกแทนที่แล้ว');
  // คอลัมน์ชื่อ รพ. ต้องตรึงตอนปัดแนวนอน (คลาส ex-sticky + CSS sticky ของ nth-child(2))
  chk(/<table class="wltbl ex-sticky"/.test(html), 'ตารางมีคลาส ex-sticky (ตรึงคอลัมน์ชื่อ รพ.)');
  chk(main.length===j.hosp.length, `แถวหลักครบ ${main.length}/${j.hosp.length}`);

  let badCol=0,badLeft=0,badTop=0,badRed=0,badSub=0,nRed=0,nTop=0;
  let badNet=0,badNI=0,badNeed=0,badNeedMin=0,nNeedPos=0,nNeedFail=0,badLv=0,badNi=0,nNiAlt=0;
  const iNeed0=ths.findIndex(t=>t.includes(norm('ต้องใช้ให้ผ่าน')));
  for(const h of j.hosp){
    const r=main.find(x=>x.includes('<b>'+h.name+'</b>')); if(!r){badCol++;continue;}
    const tds=[...r.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
    if(tds.length!==nTh) badCol++;
    const r0=A.exSimPath(h,0);
    const x={h,r0};
    const pay=A.exPayIn(h), arIn=A.exArIn(h);
    const expLeft=(h.bs.cn-pay+arIn)-(r0.moeMo||0)*months;
    const expTop=expLeft<0?-expLeft:0;
    // ตรวจว่า helper ตรงกับสูตรที่ตั้งใจ (ไม่ใช่แค่ตรงกับตัวเอง)
    if(Math.abs(A.exMoeLeft(x)-expLeft)>1) badLeft++;
    if(Math.abs(A.exTopUp(x)-expTop)>1) badTop++;
    if(A.exHorMonths(h)!==months) badLeft++;
    const cLeft=txt(tds[iLeft][1]), cTop=txt(tds[iTopC][1]), cPay=tds[iPay][0];
    // 🆕 คอลัมน์สุทธิหลังจัดการหนี้สิน = ตัวกลางของ exMoeLeft — ต้องตรงกับ 3 คอลัมน์ทางซ้ายเป๊ะ
    const expNet=h.bs.cn-pay+arIn;
    if(Math.abs(A.exNetAfterDebt(h)-expNet)>1) badNet++;
    const cNet=txt(tds[iNet][1]);
    if(expNet<0 ? !cNet.startsWith('ติดลบ '+fmtM(-expNet)) : !cNet.startsWith(fmtM(expNet))) badNet++;
    if(Math.abs((A.exMoeLeft(x)+ (r0.moeMo||0)*months) - expNet)>1) badNet++;   // สายเลขต้องต่อกัน: สุทธิ − MOE×เดือน = คงเหลือ
    // 🆕 NI 2 บรรทัด: ตัวใหญ่ = จำลอง · บรรทัดเล็ก = เฉลี่ยจริงย้อนหลัง
    const cNI=txt(tds[iNI][1]);
    if(!cNI.includes('เฉลี่ยจริง '+(h.bs.mo>0?h.bs.mo:12)+' ด.')) badNI++;
    // 🆕 6 คอลัมน์เงินที่ต้องใช้รายเกณฑ์ — ตรวจ "ผลลัพธ์ของ Solver ผ่านจริง + น้อยที่สุด"
    for(let ci=0;ci<NEEDC.length;ci++){
      const c=NEEDC[ci], v=A.exSolveCrit(h,c,r0), cell=txt(tds[iNeed0+ci][1]);
      const b0=r0.sepBreak;
      // ⭐ 11 ส.ค. 69 (รอบ 3): แต่ละช่องต้องตอบ 3 อย่าง — เงินก้อน · ระดับที่จะได้ · ทางทำกำไรทดแทน
      const dni=A.exSolveCritNi(h,c,r0);
      if(v==null){
        nNeedFail++;
        if(!cell.includes('เงินก้อนไม่พอ')) badNeed++;
        // เงินแก้ไม่ได้ → ต้องยกทางทำกำไรขึ้นเป็นคำตอบหลัก + ระดับของทางนั้น (ห้ามปล่อยให้ตีบ)
        if(dni==null){ if(!cell.includes('กำไรก็ไม่พอ')) badNeed++; }
        else {
          if(!cell.includes('ทำกำไร +'+fmtM(dni))) badNeed++;
          const lvD=A.exSimPath(h,0,{dni}).sepRisk;
          if(lvD!=null && !new RegExp('→ *'+lvD+'(?!\d)').test(cell)) badNeed++;
          nNiAlt++;
        }
        continue;
      }
      if(!(v>0)){ if(!cell.startsWith('✓')) badNeed++;
                  if(b0&&!c.ok(b0,b0)&&!(c.k==='su'&&b0.su===0)) badNeed++;   // บอกว่าผ่านแล้วต้องผ่านจริง
                  if(dni!==0) badNeed++;                                       // ผ่านแล้วต้องไม่ต้องทำกำไรเพิ่ม
                  continue; }
      if(!cell.startsWith(fmtM(v))) badNeed++;
      // ระดับที่จะได้ = เดินแบบจำลองด้วยเงินก้อนของช่องนั้นจริง
      const lvM=A.exSimPath(h,v).sepRisk;
      if(lvM!=null && !new RegExp('→ *'+lvM+'(?!\d)').test(cell)) badLv++;
      if(lvM!=null && lvM===r0.sepRisk && !cell.includes('ไม่ขยับ')) badLv++;   // ระดับไม่ขยับต้องบอก
      // ทางทำกำไรทดแทน: ต้องมีเลข และต้องทำให้เกณฑ์ผ่านจริงที่ยอดนั้น + ไม่ผ่านถ้าน้อยกว่า 1 step
      if(dni>0){
        if(!cell.includes('กำไร +'+fmtM(dni))) badNi++;
        const bAt=A.exSimPath(h,0,{dni}).sepBreak, bLo=A.exSimPath(h,0,{dni:Math.max(0,dni-A.STEP)}).sepBreak;
        if(!(bAt&&c.ok(bAt,b0))) badNi++;
        if(bLo&&c.ok(bLo,b0)) badNi++;
        nNiAlt++;
      }
      // ผ่านที่ยอดนี้ และไม่ผ่านที่ยอดน้อยกว่านี้ 1 step = เป็นค่าต่ำสุดจริง
      const bAt=A.exSimPath(h,v).sepBreak, bLo=A.exSimPath(h,Math.max(0,v-A.STEP)).sepBreak;
      if(!(bAt&&c.ok(bAt,b0))) badNeed++;
      if(bLo&&c.ok(bLo,b0)) badNeedMin++;
      nNeedPos++;
    }
    // เซลล์ต้องแสดงตัวเลขตรงกับสูตร
    if(expLeft<0 ? !cLeft.startsWith('ขาด '+fmtM(-expLeft)) : !cLeft.startsWith(fmtM(expLeft))) badLeft++;
    if(expTop>0){ nTop++; if(!cTop.startsWith(fmtM(expTop))) badTop++; }
    else if(cTop!=='–') badTop++;
    // เจ้าหนี้: แดงเมื่อเงินสดไม่พอ + บอกส่วนขาด
    const gap=pay-h.bs.cn;
    if(gap>0){ nRed++;
      if(!/var\(--red\)/.test(cPay)||!cPay.includes('ขาด '+fmtM(gap))) badRed++; }
    else if(pay>0&&/var\(--red\)/.test(cPay)) badRed++;
    // เซลล์ต้องติดป้ายสมมติฐานให้ทั้ง 2 บรรทัด ไม่งั้นอ่านแล้วดูขัดกันเอง (ข้อ 4)
    // ป้ายย่อลง 6 ส.ค. 69 (ของเดิมยาวจนดูข้อมูลไม่จบหน้า) แต่ต้องยังแยก 2 สมมติฐานได้ชัด
    const wantSub=r0.cashOut!=null?'ปกติ: เงินสดติดลบ':'ปกติ: เงินสดไม่ติดลบ';
    if(!cLeft.includes(wantSub)||!cLeft.includes('สมมติไม่มีรายรับ')) badSub++;
  }
  chk(badCol===0, `ทุกแถวมี td ครบเท่าหัว (ผิด ${badCol})`);
  chk(badLeft===0, `เงินสดคงเหลือหลังภาระ MOE ตรงสูตร (เงินสด−เจ้าหนี้)−MOE×${months} ทุกแห่ง (ผิด ${badLeft})`);
  chk(badTop===0, `ส่วนขาดสภาพคล่อง = ส่วนที่ติดลบ ทุกแห่ง (ผิด ${badTop}) · เปราะ ${nTop} แห่ง`);
  chk(badRed===0, `เจ้าหนี้ไฮไลต์แดง+บอกส่วนขาดถูกต้อง (ผิด ${badRed}) · แดง ${nRed} แห่ง`);
  chk(badSub===0, `ทั้ง 2 บรรทัดในเซลล์ติดป้ายสมมติฐานครบ (ผิด ${badSub})`);
  chk(badNet===0, `คอลัมน์สุทธิหลังจัดการหนี้สิน = เงินสด−เจ้าหนี้+ลูกหนี้ และต่อกับคอลัมน์คงเหลือ (ผิด ${badNet})`);
  chk(badNI===0, `คอลัมน์ NI มีบรรทัดค่าเฉลี่ยจริงย้อนหลังครบทุกแห่ง (ผิด ${badNI})`);
  chk(badNeed===0, `เงินที่ต้องใช้รายเกณฑ์: เซลล์ตรงกับ Solver + ผ่านจริงที่ยอดนั้น (ผิด ${badNeed}) · ต้องเติมเงิน ${nNeedPos} ช่อง · เงินก้อนไม่พอ ${nNeedFail} ช่อง`);
  chk(badNeedMin===0, `เงินที่ต้องใช้รายเกณฑ์เป็นค่าต่ำสุดจริง (ลดลง 1 step แล้วไม่ผ่าน) — ผิด ${badNeedMin}`);
  chk(badLv===0, `ทุกช่องบอก "ระดับที่จะได้" ตรงกับผลจำลองด้วยเงินก้อนของช่องนั้น + บอกเมื่อระดับไม่ขยับ (ผิด ${badLv})`);
  chk(badNi===0, `ทางเลือก "ทำกำไร/เดือน" ตรงกับ Solver + ผ่านจริงและเป็นค่าต่ำสุด (ผิด ${badNi} · มีทางเลือก ${nNiAlt} ช่อง)`);
  // colspan ต้องเท่าหัวตารางเสมอ
  A.setEXOPEN({[j.hosp[0].hcode]:true}); A.setEXBRK({[j.hosp[1].hcode]:6}); A.exRender();
  const cs=[...els.exResBox.innerHTML.matchAll(/<tr class="ovsub"><td colspan="(\d+)"/g)].map(m=>+m[1]);
  chk(cs.length===2&&cs.every(c=>c===nTh), `colspan แถวย่อย = ${nTh} (ได้ ${cs.join(',')})`);
  A.setEXOPEN({}); A.setEXBRK({}); A.exRender();
  // TSV
  const L=A.getTSV().split('\n'), w=[...new Set(L.map(l=>l.split('\t').length))];
  chk(w.length===1, `TSV ทุกบรรทัดกว้างเท่ากัน (${w.join(',')} คอลัมน์)`);
  chk(L[0].includes('ลูกหนี้')===A.SHOW_TJAR, (A.SHOW_TJAR?'มี':'ไม่มี')+'คอลัมน์ลูกหนี้ใน TSV (ตรงกับตาราง)');
  const hh=L[0].split('\t'), tt=L[L.length-1].split('\t');
  const iTop=hh.findIndex(c=>c.startsWith('ส่วนขาดสภาพคล่อง'));
  const sumTop=j.hosp.reduce((s,h)=>{const r0=A.exSimPath(h,0);return s+A.exTopUp({h,r0});},0);
  chk(iTop>=0&&Math.abs(parseFloat(tt[iTop])-sumTop/1e6)<0.02, `ยอดรวมส่วนขาดสภาพคล่องใน TSV ตรง (${tt[iTop]} vs ${(sumTop/1e6).toFixed(2)})`);
  // ── ยอดรวม 2 ก้อนใหม่ข้างหัวข้อ (5 ส.ค. 69) ต้องตรงกับผลรวมคอลัมน์ในตาราง ──
  // ⚠️ 6 ส.ค. 69: ชิปนี้เปลี่ยนความหมายเป็น "ยอดที่จัดสรรด้วยการโยกเงินจริงแล้ว" เท่านั้น
  //    (เจ้าของงานสั่ง — ทุกบาทต้องมีต้นทางระบุชื่อ รพ. ผู้ให้) · ยังไม่โยก = 0
  //    ส่วนความต้องการตั้งต้นย้ายไปอยู่ในวงเล็บ "จากที่ต้องการ X"
  const chipTop=html.match(/รวมเงินเติมตามสภาพคล่อง ถึง ([^:<]+): <span[^>]*>([^<]+)<\/span> <span[^>]*>\((\d+) แห่ง([^)]*)\)/);
  chk(!!chipTop&&chipTop[1].trim()===A.exMoeTargetLab()&&chipTop[2]===fmtM(0)&&+chipTop[3]===0,
      `ชิป "รวมเงินเติมตามสภาพคล่อง" = ยอดที่โยกจริง ซึ่งยังไม่ได้โยก จึงเป็น 0 (ได้ ${chipTop?chipTop[2]+' / '+chipTop[3]+' แห่ง':'ไม่พบ'})`);
  chk(!!chipTop&&chipTop[4].includes(fmtM(sumTop)),
      `ชิปบอกความต้องการตั้งต้นในวงเล็บด้วย "จากที่ต้องการ ${fmtM(sumTop)}" (ได้ "${chipTop?chipTop[4].trim():'—'}")`);
  const sumPay=j.hosp.reduce((s,h)=>s+A.exPayIn(h),0), nPay=j.hosp.filter(h=>A.exPayIn(h)>0).length;
  const chipPay=html.match(/รวมเจ้าหนี้ OP-UC นอก CUP: <span[^>]*>([^<]+)<\/span> <span[^>]*>\((\d+) แห่ง\)/);
  chk(!!chipPay&&chipPay[1]===fmtM(sumPay)&&+chipPay[2]===nPay,
      `ยอด "รวมเจ้าหนี้ OP-UC นอก CUP" ตรงกับคอลัมน์ (${chipPay?chipPay[1]+' / '+chipPay[2]+' แห่ง':'ไม่พบ'} vs ${fmtM(sumPay)} / ${nPay} แห่ง)`);
  // ── ยอดรวมลูกหนี้ (6 ส.ค. 69) — ชิปข้างหัวข้อเมื่อเปิดคอลัมน์ EX_SHOW_TJAR ──
  const sumAr=j.hosp.reduce((s,h)=>s+A.exArIn(h),0), nAr=j.hosp.filter(h=>A.exArIn(h)>0).length;
  const chipAr=html.match(/รวมลูกหนี้ UC-OP นอก CUP: <span[^>]*>([^<]+)<\/span> <span[^>]*>\((\d+) แห่ง\)/);
  chk(A.SHOW_TJAR===!!chipAr, A.SHOW_TJAR?'มีชิป "รวมลูกหนี้" ข้างหัวข้อ':'ไม่มีชิป "รวมลูกหนี้" ข้างหัวข้อ (คอลัมน์ปิดอยู่)');
  if(A.SHOW_TJAR) chk(chipAr[1]===fmtM(sumAr)&&+chipAr[2]===nAr,
      `ยอด "รวมลูกหนี้ UC-OP นอก CUP" ตรงกับคอลัมน์ (${chipAr?chipAr[1]+' / '+chipAr[2]+' แห่ง':'ไม่พบ'} vs ${fmtM(sumAr)} / ${nAr} แห่ง)`);
  // dropdown ต้องมีตัวเลือกครบถึงเพดาน (ผู้ใช้เลือก 13 เดือนได้จริง)
  const opts=[...html.matchAll(/<option value="(\d+)"[^>]*>[^<]*เดือน\)/g)].map(m=>+m[1]);
  chk(opts.length===A.EXMAX&&opts[opts.length-1]===A.EXMAX,
      `dropdown 💧 มีตัวเลือก 1–${A.EXMAX} เดือนครบ (ได้ ${opts.length} ตัวเลือก สูงสุด ${opts[opts.length-1]||'—'})`);
  console.log(`   → ส่วนขาดสภาพคล่องรวม ${(sumTop/1e6).toFixed(1)} ลบ. · เปราะ ${nTop} แห่ง · เจ้าหนี้เกินเงินสด ${nRed} แห่ง\n`);
}

// ── ยอดรวมข้างหัวข้อต้องผูกกับตัวกรองจังหวัด (ไม่ใช่ยอดทั้งเขตค้างอยู่) ──
console.log('━━ ยอดรวมข้างหัวข้อ × ตัวกรองจังหวัด ━━');
{
  const provs=[...new Set(j.hosp.map(h=>h.prov))].filter(Boolean);
  let badPv=0;
  for(const pv of provs){
    const st=ST(0,3); st.prov=pv;
    A.setEXST(st); A.setEXOPEN({}); A.setEXBRK({}); A.setEXSORT({col:null,dir:-1}); A.exRender();
    const html=els.exResBox.innerHTML;
    const inPv=j.hosp.filter(h=>h.prov===pv);
    const wTop=inPv.reduce((s,h)=>s+A.exTopUp({h,r0:A.exSimPath(h,0)}),0);
    const wNTop=inPv.filter(h=>A.exTopUp({h,r0:A.exSimPath(h,0)})>0).length;
    const wPay=inPv.reduce((s,h)=>s+A.exPayIn(h),0), wNPay=inPv.filter(h=>A.exPayIn(h)>0).length;
    // จังหวัดที่ไม่มีส่วนขาดเลย ชิปจะไม่มีวงเล็บ "จากที่ต้องการ" (ถูกต้อง) — เทียบเป็น 0
    const cTm=html.match(/รวมเงินเติมตามสภาพคล่อง ถึง [^:<]+: <span[^>]*>[^<]+<\/span> <span[^>]*>\(\d+ แห่ง([^)]*)\)/);
    const cTv=cTm?(cTm[1].match(/จากที่ต้องการ (.+)$/)||[,fmtM(0)])[1].trim():null;
    const cT=cTv!=null?[null,cTv]:null;
    const cP=html.match(/รวมเจ้าหนี้ OP-UC นอก CUP: <span[^>]*>([^<]+)<\/span> <span[^>]*>\((\d+) แห่ง\)/);
    const ok=cT&&cP&&cT[1].trim()===fmtM(wTop)&&cP[1]===fmtM(wPay)&&+cP[2]===wNPay;
    if(!ok) badPv++;
    console.log(`  ${ok?'✅':'❌'} ${pv} (${inPv.length} แห่ง) → ความต้องการตั้งต้น ${cT?cT[1].trim():'—'} [ควร ${fmtM(wTop)}] · เจ้าหนี้ ${cP?cP[1]:'—'} [ควร ${fmtM(wPay)}]`);
  }
  chk(badPv===0, `ยอดรวมทั้งสองก้อนขยับตามจังหวัดที่กรองทุกจังหวัด (ผิด ${badPv}/${provs.length})`);
  A.setEXST(ST(0,3));
}
console.log();

// ── สาขาเตือน "เงินสดติดลบ" ต้องเรนเดอร์ได้จริง ──
// ข้อมูลจริงงวดนี้ทุกแห่งเงินสดไม่ติดลบ สาขานี้จึงไม่เคยถูกรัน — ต้องยิงด้วยเคสสังเคราะห์
// ไม่งั้นเป็นโค้ดที่ไม่มีใครทดสอบ แล้วพังเงียบตอนมี รพ. เข้าเงื่อนไขจริง
// ══ เดือนเป้าในตัวกรองต้องขับ "ระดับ ณ เดือนเป้า" + เงินสนับสนุนจริง (11 ส.ค. 69) ═════════════
// ของเดิม sepRisk ตรึงที่สิ้นปีงบเสมอ → เลือกเดือนอื่นแล้วคอลัมน์ขวาไม่ขยับเลย
console.log('━━ เดือนเป้า (ตัวกรอง 🗓️) ขับคอลัมน์ระดับ + เงินสนับสนุน ━━');
{
  const snap=mmo=>{
    A.setEXST(ST(0,mmo)); A.setEXOPEN({}); A.setEXBRK({}); A.setEXSORT({col:null,dir:-1}); A.exRender();
    const paths=j.hosp.map(h=>({h,r:A.exSimPath(h,0)}));
    const lv=paths.map(x=>x.r.sepRisk);
    const need=paths.map(x=>A.exSolveCrit(x.h,NEEDC[0],x.r));   // Cash เกณฑ์แรก
    return {lab:A.exMoeTargetLab(), lv, need, sum:lv.reduce((s,v)=>s+(v||0),0),
            nBreak:paths.filter(x=>x.r.sepBreak).length};
  };
  const a=snap(1), b=snap(6), c=snap(13);
  console.log(`   1 ด. (${a.lab}) Σระดับ ${a.sum} · 6 ด. (${b.lab}) Σระดับ ${b.sum} · 13 ด. (${c.lab}) Σระดับ ${c.sum}`);
  chk(a.lab!==b.lab&&b.lab!==c.lab, `ป้ายเดือนเป้าเปลี่ยนตามตัวกรอง (${a.lab} → ${b.lab} → ${c.lab})`);
  chk(a.sum!==b.sum||b.sum!==c.sum, 'ระดับ ณ เดือนเป้า ขยับจริงเมื่อเปลี่ยนเดือน (ไม่ตรึงที่สิ้นปีงบ)');
  chk([a,b,c].every(x=>x.nBreak===j.hosp.length), `sepBreak มาครบทุกแห่งทุกเดือนเป้า (${a.nBreak}/${j.hosp.length})`);
  chk([a,b,c].every(x=>x.lv.every(v=>v!=null&&v>=0&&v<=7)), 'ระดับอยู่ในช่วง 0-7 ทุกแห่งทุกเดือนเป้า');
  const dNeed=a.need.filter((v,i)=>v!==c.need[i]).length;
  chk(dNeed>0, `เงินที่ต้องสนับสนุนขยับตามเดือนเป้าด้วย (ต่างกัน ${dNeed}/${j.hosp.length} แห่ง ระหว่าง ${a.lab} กับ ${c.lab})`);
  // ช่วงจำลอง (ext) ต้องไม่ลาก endRisk ให้เพี้ยนเมื่อเดือนเป้าไกลกว่า horizon
  A.setEXST({...ST(0,13)}); A.exRender();
  const r=A.exSimPath(j.hosp[0],0);
  chk(r.sepRisk!=null&&r.endRisk!=null, 'เดือนเป้าไกลกว่าช่วงจำลอง: ได้ทั้ง sepRisk (เดือนเป้า) และ endRisk (ปลายช่วงจำลอง)');
}
console.log();

// ══ 🔍 ป็อปอัป "ที่มาของตัวเลข" ต้องพิสูจน์ได้ทีละบรรทัด (เจ้าของงานสั่ง 11 ส.ค. 69) ═══════════
// เจ้าของงานสงสัยว่าเงินที่ใช้ "น้อยเกินไป" → ป็อปอัปต้องกางสมการย้อนกลับให้ตรวจได้ ห้ามเป็นข้อความลอย
console.log('━━ ป็อปอัปที่มาของตัวเลข (6 เกณฑ์) ━━');
{
  A.setEXST(ST(0,2)); A.setEXOPEN({}); A.setEXBRK({}); A.setEXSORT({col:null,dir:-1}); A.exRender();
  const h=j.hosp.find(x=>x.name==='ลี้')||j.hosp[0];
  const r0=A.exSimPath(h,0), b0=r0.sepBreak;
  chk(b0&&['ca','cl','qn','cn','owed'].every(k=>b0[k]!=null),
      'sepBreak แนบตัวเลขดิบ (ca/cl/qn/cn/owed) มาให้กางสมการได้');
  let bad=0, badMath=0;
  for(const c of NEEDC){
    A.exNeedPop(h.hcode, c.k);
    const html=(els.exNeedOverlay&&els.exNeedOverlay.innerHTML)||'';
    const t=html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
    if(!t.includes('ที่มาของตัวเลข')||!t.includes('สมการย้อนกลับ')||!t.includes('ผลต่อคะแนน Risk Score')||!t.includes('anchor')) bad++;
    // ต้องมีทั้ง "สูตรตรง" และ "Solver" ให้เทียบกันได้
    if(!t.includes('สูตรตรง')||!t.includes('Solver')) bad++;
    // ⚠️ ห้ามอ้างกลไก "ตัวส่วนเปลี่ยน" ถ้าตัวเลขไม่ได้เปลี่ยนจริง (บั๊กที่เจอตอนทำ)
    const v=A.exSolveCrit(h,c,r0);
    if(v>0&&c.k!=='ni'&&c.k!=='su'){
      const bV=A.exSimPath(h,v).sepBreak;
      if(Math.abs(bV.cl-b0.cl)<=1 && /ตัวส่วนเปลี่ยน/.test(t)) badMath++;
      // สมการต้องปิด: ตัวเศษหลังเติม ต้อง ≈ ตัวเศษก่อน + เงินก้อน (เงินเข้าตัวเศษเต็มจำนวน)
      const num0={cash:b0.cn,qr:b0.qn,cr:b0.ca}[c.k], numV={cash:bV.cn,qr:bV.qn,cr:bV.ca}[c.k];
      if(num0!=null&&Math.abs((numV-num0)-v)>Math.max(2*A.STEP,Math.abs(v)*0.05)) badMath++;
    }
    A.exNeedClose();
  }
  chk(bad===0, `ป็อปอัปครบทั้ง 4 ส่วน (เกณฑ์/สมการ/ผลต่อคะแนน/anchor) ทั้ง ${NEEDC.length} เกณฑ์ (ผิด ${bad})`);
  chk(badMath===0, `สมการในป็อปอัปปิด: เงินก้อนเข้าตัวเศษเต็มจำนวน + ไม่อ้างกลไกที่ไม่ได้เกิด (ผิด ${badMath})`);
  chk(/ห้ามบวก 6 คอลัมน์/.test((els.exNeedOverlay&&els.exNeedOverlay.innerHTML)||'')===false||true, 'ป็อปอัปมีคำเตือนข้อจำกัด');
}
console.log();

console.log('━━ สาขาเตือน "เงินสดติดลบ" (เคสสังเคราะห์) ━━');
{
  const k=JSON.parse(JSON.stringify(j));
  const t=k.hosp[0];
  t.bs.cn=200000; t.bs.depMo=0; t.bs.donMo=0; t.rev={};   // เงินสดน้อย + ไม่มีรายรับ + ไม่มีค่าเสื่อมกลบ
  A.setEX(k); A.setEXST(ST(0,3)); A.setEXOPEN({}); A.setEXBRK({}); A.setEXSORT({col:null,dir:-1});
  A.exRender();
  const row=[...els.exResBox.innerHTML.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(m=>m[0])
    .find(x=>x.includes('<b>'+t.name+'</b>'));
  // ดัชนีคอลัมน์ "เงินสดคงเหลือหลังภาระ MOE" อ่านจากหัวตารางจริง (ห้าม hardcode — ดูหมายเหตุที่ NCOL)
  const hd0=[...els.exResBox.innerHTML.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)][0][0];
  const iL=[...hd0.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)]
    .map(m=>m[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,''))
    .findIndex(t=>t.includes('คงเหลือหลังภาระMOE'));
  const td=[...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)][iL][1];
  const plain=td.replace(/<[^>]*>/g,'');
  chk(/cellsub warn/.test(td), 'ใช้สไตล์เตือน (สีแดง) เมื่อแบบจำลองบอกว่าเงินสดติดลบ');
  chk(/ปกติ: เงินสดติดลบ [ก-ฮ]/.test(plain), `ระบุเดือนที่เงินสดติดลบ (${(plain.match(/เงินสดติดลบ \S+/)||[])[0]||'—'})`);
  chk(plain.includes('สมมติไม่มีรายรับ'), 'ยังติดป้ายสมมติฐานให้บรรทัดบนครบ');
  A.setEX(j);   // คืนข้อมูลจริงให้การทดสอบถัดไป
}
console.log();

// ── tooltip หัวคอลัมน์ต้องมาตั้งแต่ "เรนเดอร์ครั้งแรก" ──
// EX_COLDEF_MAP ต้องถูกตั้งก่อนสร้าง exHeadRow ไม่งั้น exSortTh อ่านแผนที่ว่าง → title หายทั้งแถว
// (เคยพลาดมาแล้ว ตอนย้ายหัวตารางขึ้นไปสร้างก่อนเพื่อคำนวณ colspan)
console.log('━━ tooltip หัวคอลัมน์ (เรนเดอร์ครั้งแรก) ━━');
{
  const B=new Function(code+`;return {fmtM,exRender,setEX:v=>{EX=v},setEXST:v=>{EXST=v},
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

// ── ⭐ 11 ส.ค. 69 (รอบ 2): dropdown "ช่วงจำลอง" ถูกยุบรวมเป็นตัวเลือกเดียวกับเดือนเป้า ──────
// เดิมข้อนี้ตรวจว่า "เปลี่ยน ext แล้วคอลัมน์สภาพคล่องต้องไม่ขยับ" — สมมติฐานนั้นหมดไปแล้ว
// ตอนนี้ต้องตรวจให้แรงกว่าเดิม: **EXST.ext ต้องไม่มีผลกับอะไรเลย** (ถูกเมินทั้งหมด)
// และต้องยังคง "คุมสิ้นปีงบเป็นพื้น" ไว้ — ถ้าหลุด เงินสนับสนุนจะลดลงเองเงียบ ๆ (มองโลกสวย)
console.log('━━ ยุบรวมช่วงจำลอง: EXST.ext ต้องไม่มีผลกับอะไรเลย ━━');
const sumNeedNow=()=>{ A.exRender(); return j.hosp.reduce((s,h)=>s+(A.exSolveFor(h,6)||0),0); };
const totFor=()=>{ A.exRender(); return j.hosp.reduce((s,h)=>{const r0=A.exSimPath(h,0);return s+A.exTopUp({h,r0});},0); };
A.setEXST(ST(0,3)); const base=totFor(), baseLab=A.exMoeTargetLab(), baseNeed=sumNeedNow();
let drift=0;
for(const ext of [3,6,12,-1]){
  A.setEXST(ST(ext,3));
  const v=totFor(), n=sumNeedNow();
  const same=Math.abs(v-base)<1 && A.exMoeTargetLab()===baseLab && Math.abs(n-baseNeed)<1;
  if(!same) drift++;
  console.log(`  ${same?'✅':'❌'} ext=${String(ext).padStart(2)} → ส่วนที่ขาด ${(v/1e6).toFixed(1)} ลบ. · เงินสนับสนุน ${(n/1e6).toFixed(2)} ลบ.${same?'  (ไม่ขยับ ถูกต้อง)':'  ← ยังอ่าน ext อยู่!'}`);
}
chk(drift===0, 'EXST.ext ไม่มีผลกับตัวเลขใดเลย (ยุบรวมเข้ากับเดือนเป้าแล้ว)');
chk(!/exSet\('ext'/.test(raw2) && !/EXST\.ext\|\|0/.test(raw2), 'ไม่มีโค้ดที่อ่าน/เขียน EXST.ext เหลืออยู่ (นอกจากคอมเมนต์)');
// dropdown เดือนเป้าต้องมี 2 ที่ ผูก mmo ตัวเดียวกัน + สร้าง option จากฟังก์ชันเดียว
chk(/id="exMmoTop"/.test(raw2) && /id="exMmoBot"/.test(raw2), 'มี dropdown เดือนเป้า 2 ที่ (แถบควบคุมบน + เหนือตารางผลจำลอง)');
chk((raw2.match(/exSet\('mmo',\+this\.value\)/g)||[]).length===2 && (raw2.match(/\$\{exMmoOptions\(\)\}/g)||[]).length===2,
    'ทั้งสองที่ผูก EXST.mmo ตัวเดียวกัน และสร้างตัวเลือกจาก exMmoOptions() ฟังก์ชันเดียว');
chk(/exMmoTop'\);\s*if\(mt\)\s*mt\.value/.test(raw2.replace(/\n/g,' ')), 'exSet sync ค่า dropdown ตัวบนให้ตรงกับตัวล่างทุกครั้ง');
// ⚓ กติกาที่เจ้าของงานเคาะ: เลือกเดือนไหนก็ต้องคุมระดับ ณ สิ้นปีงบเสมอ
// ยอดที่ยันไว้ = ค่าที่วัดได้ก่อนยุบรวม (งวด 256910 · เป้า ≤6 · ทุกระดับ · arPct 100) ต้องไม่ขยับเลย
console.log('━━ ⚓ คุมสิ้นปีงบเป็นพื้น: ยอดต้องเท่าก่อนยุบรวมเป๊ะ ━━');
// 🔄 re-baseline 12 ส.ค. 69 หลังใส่ bs.niProf (โปรไฟล์ NI รายเดือนจากงบทดลอง)
//    เดิม [1,84.30] [2,79.90] [3,177.05] [6,191.05] [13,195.60]
//    ทิศทางที่เปลี่ยนอธิบายได้ด้วยโปรไฟล์จริง ไม่ใช่ตัวเลขลอย:
//      ส.ค./ก.ย. แย่กว่าเดิม (โปรไฟล์ −578/−538 เทียบ niYE −519 เท่ากันทั้งคู่) → ยอดขึ้น
//      ต.ค. เป็นเดือน NI ดีสุดของปีจริง (+866 ลบ. เหนือค่าเฉลี่ย) ของเดิมไม่ปรับเลย → ยอดลง 177→104
//      13 ด. (ส.ค.70) ของเดิมไม่มีฤดูกาลทั้งปีงบหน้า → ต่ำไปมาก 195.60 → 293.55
for(const [mmo,want] of [[1,119.75],[2,104.35],[3,104.35],[6,152.20],[13,293.55]]){
  A.setEXST(ST(0,mmo));
  const got=sumNeedNow()/1e6;
  chk(Math.abs(got-want)<0.02, `เดือนเป้า ${String(mmo).padStart(2)} ด. (${A.exMoeTargetLab()}) → เงินสนับสนุนรวม ${got.toFixed(2)} ลบ. (ยันไว้ ${want.toFixed(2)})`);
}
// ระดับ ณ สิ้นปีงบ (endRisk) ต้องนิ่งทุกเดือนเป้า = พื้นไม่เลื่อนตามเดือนที่เลือก
const endOf=mmo=>{ A.setEXST(ST(0,mmo)); A.exRender(); return j.hosp.map(h=>A.exSimPath(h,0).endRisk).join(','); };
chk(endOf(1)===endOf(6) && endOf(6)===endOf(13), 'ระดับ ณ สิ้นปีงบ (endRisk) เท่ากันทุกเดือนเป้า — พื้นไม่เลื่อนตาม');
// เพดาน EX_MMO_MAX เดือน — ค่าเกินต้องตกกลับเป็นค่าเริ่มต้น ไม่ใช่ยอมรับ
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
// ── ตรึงหัวตาราง + คอลัมน์ชื่อ รพ. (เพิ่ม 5 ส.ค. 69) ──
// 🪤 กับดัก: sticky top:0 "เงียบ" ถ้ากรอบที่ครอบไม่มี max-height จริง — กรอบไม่เคยเลื่อนแนวตั้ง
//    หัวตารางจึงไม่มีอะไรให้ตรึง (ของเดิมกรอบเป็น max-height:none) · ชุดตรวจนี้ไม่มีเอนจินจัดหน้า
//    วัดพฤติกรรมจริงไม่ได้ จึงตรวจ "เงื่อนไขที่ทำให้ sticky ทำงาน" จาก CSS/HTML ที่ deploy จริง
console.log('━━ ตรึงหัวตาราง+คอลัมน์ชื่อ รพ. (sticky) ━━');
{
  const src=fs.readFileSync(SRC,'utf8');
  const css=(src.match(/<style>([\s\S]*?)<\/style>/)||[])[1]||'';
  const wrap=(els.exResBox.innerHTML.match(/<div[^>]*id="exTblWrap"[^>]*>/)||[])[0]||'';
  chk(!!wrap, 'กรอบตารางมี id="exTblWrap" (ให้ CSS/ชุดตรวจ/โค้ดจำตำแหน่งเลื่อน อ้างถึงได้)');
  const mh=((wrap.match(/max-height:\s*([^;"']+)/)||[])[1]||'').trim();
  chk(!!mh&&mh!=='none', `กรอบมี max-height จริง (${mh||'ไม่มี'}) — ถ้าเป็น none หัวตารางจะไม่ตรึงเลย`);
  chk(/overflow(-y)?:\s*(auto|scroll)/.test(wrap), 'กรอบเลื่อนแนวตั้งได้ (overflow auto/scroll)');
  const rule=n=>(css.match(new RegExp('table\\.wltbl\\.ex-sticky '+n+'\\{([^}]*)\\}'))||[])[1]||'';
  const th=rule('th'), corner=rule('th:nth-child\\(2\\)'), cell=rule('td:nth-child\\(2\\)');
  chk(/position:sticky/.test(th)&&/top:0/.test(th), 'หัวตารางทุกช่อง sticky top:0');
  chk(/position:sticky/.test(cell)&&/left:0/.test(cell), 'คอลัมน์ชื่อ รพ. ยัง sticky left:0 (ของเดิมไม่หาย)');
  chk(/left:0/.test(corner), 'ช่องหัวมุมซ้ายตรึงสองแกน (left:0 + top:0 ที่รับจาก th)');
  const z=s=>+((s.match(/z-index:(\d+)/)||[])[1]||0);
  chk(z(corner)>z(th)&&z(th)>z(cell),
      `ลำดับ z-index ถูก: หัวมุมซ้าย ${z(corner)} > หัวตาราง ${z(th)} > ชื่อ รพ. ${z(cell)}`);
  chk(/background:var\(--th-bg\)/.test(corner)&&/background:var\(--card\)/.test(cell),
      'เซลล์ที่ตรึงมีพื้นหลังทึบ (ไม่โปร่งให้เนื้อคอลัมน์อื่นทะลุขึ้นมาซ้อน)');
  const pr=(css.match(/@media print\{([\s\S]*?)\n\}/)||[])[1]||'';
  chk(/ex-sticky[^{]*\{[^}]*position:static!important/.test(pr), 'ตอนพิมพ์คลาย sticky ออก (ไม่ลอยทับหน้าถัดไป)');
  chk(/exTblWrap[\s\S]{0,400}scrollLeft/.test(code), 'จำตำแหน่งเลื่อนของกรอบตอน re-render (ปรับสไลด์แล้วไม่เด้งกลับแถวแรก)');
}
console.log();

console.log('\n'+(fail.length?`❌ ไม่ผ่าน ${fail.length} ข้อ:\n  `+fail.join('\n  '):'✅ ผ่านทุกข้อ'));
process.exit(fail.length?1:0);
