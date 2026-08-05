// ตรวจคอลัมน์ชุดใหม่ในตาราง #exec: ซ่อนลูกหนี้ · เจ้าหนี้เตือนแดง · เงินสดสำหรับจ่าย MOE · เงินที่ต้องเติม
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
const A=new Function(code+`;return {exRender,exSimPath,exMoeLeft,exTopUp,exHorMonths,exPayIn,exHorLab,
  SHOW_TJAR:EX_SHOW_TJAR,getTSV:()=>EX_TSV,setEX:v=>{EX=v},setEXST:v=>{EXST=v},
  setEXOPEN:v=>{EXOPEN=v},setEXBRK:v=>{EXBRK=v},setEXSORT:v=>{EXSORT=v},getEXST:()=>EXST};`)();
const j=JSON.parse(fs.readFileSync('D:/Github/Rh1-BalanceSheet/docs/data/risk/exec.json','utf8'));
const ST=ext=>({crisis:'all',types:{'รพศ.':true,'รพท.':true,'รพช.':true},prov:'all',ext,tgt:6,
  moePct:{},moePctAll:0,moeOff:{},moeOvr:{},xmoe:true,adj:{},adjAll:0,revOff:{},ovr:{},
  tj:{mode:'off',scope:'crisis'},inj:{},open:{}});
const fmtM=v=>{if(v==null)return '—';const a=Math.abs(v);if(a>=1e9)return(v/1e9).toFixed(2)+'B';if(a>=1e6)return(v/1e6).toFixed(1)+'M';if(a>=1e3)return(v/1e3).toFixed(0)+'K';return Math.round(v).toLocaleString()};
const txt=s=>s.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
let fail=[];
const chk=(ok,msg)=>{ console.log(`  ${ok?'✅':'❌'} ${msg}`); if(!ok) fail.push(msg); };

A.setEX(j);
console.log(`ไฟล์: ${SRC}`);
console.log(`EX_SHOW_TJAR = ${A.SHOW_TJAR} (ต้องเป็น false = ซ่อนลูกหนี้)\n`);

for(const ext of [0,3,12]){
  A.setEXST(ST(ext)); A.setEXOPEN({}); A.setEXBRK({}); A.setEXSORT({col:null,dir:-1});
  A.exRender();
  const html=els.exResBox.innerHTML;
  const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(m=>m[0]);
  const head=rows[0], main=rows.filter(r=>r.includes('class="ovtgl"'));
  const nTh=(head.match(/<th\b/g)||[]).length;
  const months=(12-j.hosp[0].bs.mo)+ext;
  console.log(`━━ ช่วงจำลอง ext=${ext} → ถึง ${A.exHorLab()} · ${months} เดือน ━━`);
  chk(nTh===14, `หัวตาราง 14 ช่อง (ได้ ${nTh})`);
  chk(!head.includes('ลูกหนี้'), 'ไม่มีคอลัมน์ลูกหนี้ในหัวตาราง');
  chk(head.includes('เงินสดสำหรับจ่าย MOE')&&head.includes(A.exHorLab()), `หัวคอลัมน์ระบุเดือนเป้า "${A.exHorLab()}"`);
  chk(head.includes('เงินที่ต้อง'), 'มีคอลัมน์เงินที่ต้องเติม');
  chk(!head.includes('จะหมด?'), 'คอลัมน์ "เงินสดจะหมด?" ถูกแทนที่แล้ว');
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
    // บรรทัดเล็ก = ข้อความเดิมของ "เงินสดจะหมด?"
    const wantSub=r0.cashOut!=null?'เงินสดหมด':'จำลองแล้วเงินสดไม่หมด';
    if(!cLeft.includes(wantSub)) badSub++;
  }
  chk(badCol===0, `ทุกแถวมี td ครบเท่าหัว (ผิด ${badCol})`);
  chk(badLeft===0, `เงินสดสำหรับจ่าย MOE ตรงสูตร (เงินสด−เจ้าหนี้)−MOE×${months} ทุกแห่ง (ผิด ${badLeft})`);
  chk(badTop===0, `เงินที่ต้องเติม = ส่วนที่ขาด ทุกแห่ง (ผิด ${badTop}) · มีที่ต้องเติม ${nTop} แห่ง`);
  chk(badRed===0, `เจ้าหนี้ไฮไลต์แดง+บอกส่วนขาดถูกต้อง (ผิด ${badRed}) · แดง ${nRed} แห่ง`);
  chk(badSub===0, `บรรทัดเล็กเก็บข้อความ "เงินสดจะหมด?" เดิมไว้ครบ (ผิด ${badSub})`);
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
  const iTop=hh.findIndex(c=>c.startsWith('เงินที่ต้องเติม'));
  const sumTop=j.hosp.reduce((s,h)=>{const r0=A.exSimPath(h,0);return s+A.exTopUp({h,r0});},0);
  chk(iTop>=0&&Math.abs(parseFloat(tt[iTop])-sumTop/1e6)<0.02, `ยอดรวมเงินที่ต้องเติมใน TSV ตรง (${tt[iTop]} vs ${(sumTop/1e6).toFixed(2)})`);
  console.log(`   → รวมเงินที่ต้องเติม ${(sumTop/1e6).toFixed(1)} ลบ. · ${nTop} แห่ง · เจ้าหนี้เกินเงินสด ${nRed} แห่ง\n`);
}

// เรียงลำดับคอลัมน์ใหม่
A.setEXST(ST(0));
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
