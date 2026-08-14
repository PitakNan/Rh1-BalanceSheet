// ชุดตรวจ 2 คอลัมน์จำลองหนี้ตามจ่าย "สังกัด สธ." เทียบค่าเฉลี่ยตัวเอง — RISK_EXEC_MODEL.md 7.32
// เจ้าของงานสั่ง 13 ส.ค. 69 · รัน: node pipeline/test_exec_tjsim.js
//
// ข้อที่สำคัญที่สุดคือ ④ — พิสูจน์ว่าคอลัมน์นี้ **ไม่เข้าสมการใด ๆ** ด้วยการยัดค่าเฉลี่ยมั่ว ๆ เข้าไป
// แล้วยันว่าทุกตัวเลขที่เหลือในตาราง (สายเลขคณิต/ระดับ/เงินสนับสนุน) ต้องเท่าเดิมเป๊ะทุกแห่ง
// ถ้าวันหนึ่งมีคนเอาคอลัมน์นี้ไปบวกในสมการ ข้อนี้จะฟ้องทันที
const fs=require('fs');
const SRC=process.env.RD_SRC||'D:/Github/Rh1-BalanceSheet/docs/risk_drill.html';
const raw=fs.readFileSync(SRC,'utf8');
const code=[...raw.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(b=>b.includes('function exBrkHtml'));
const mkEl=()=>({innerHTML:'',textContent:'',scrollTop:0,scrollLeft:0,style:{},classList:{toggle(){},add(){},remove(){},contains:()=>false},
  dataset:{},querySelectorAll:()=>[],addEventListener(){},getAttribute:()=>null,setAttribute(){},appendChild(){}});
const els={};
global.document={getElementById:id=>(els[id]=els[id]||mkEl()),querySelectorAll:()=>[],addEventListener(){},
  documentElement:mkEl(),createElement:()=>mkEl(),body:{appendChild(e){if(e&&e.id)els[e.id]=e}}};
global.window={addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
global.location={hash:''}; global.navigator={clipboard:null};
global.getComputedStyle=()=>({getPropertyValue:()=>'#888'});
global.Chart=function(){return{destroy(){}}}; global.fetch=()=>Promise.reject(0);
const A=new Function(code+`;return {exRender,fmtM,exPayIn,exArIn,exArRaw,exSimPath,exMoeLeft,exNetAfterDebt,
  exTopUp,exSolveFor,exTjApNow,exTjArNow,exTjApAvg,exTjArAvg,exTjApDiff,exTjArDiff,exTjSimWin,exTjAvgN,
  getTSV:()=>EX_TSV, setEX:v=>{EX=v},setEXST:v=>{EXST=v},setEXOPEN:v=>{EXOPEN=v},setEXBRK:v=>{EXBRK=v},setEXSORT:v=>{EXSORT=v}};`)();
const J='D:/Github/Rh1-BalanceSheet/docs/data/risk/exec.json';
const load=()=>JSON.parse(fs.readFileSync(J,'utf8'));
const ST=o=>Object.assign({mmo:0,crisis:'all',types:{'รพศ.':true,'รพท.':true,'รพช.':true},prov:'all',ext:0,tgt:6,
  moeVer:'69',payPct:50,moePct:{},moePctAll:0,moeOff:{},moeOvr:{},xmoe:true,adj:{},adjAll:0,revOff:{},ovr:{},
  tj:{mode:'off',scope:'crisis'},inj:{},open:{},xfer:[],arPct:100,arOvr:{},wide:false,clGrow:true,seas:true},o);
let j=load();
A.setEX(j); A.setEXST(ST({})); A.setEXOPEN({}); A.setEXBRK({}); A.setEXSORT({col:'risk0',dir:-1});
let fail=[]; const chk=(c,m)=>{console.log('  '+(c?'✅':'❌')+' '+m); if(!c) fail.push(m)};
const txt=s=>String(s).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();

console.log('━━ ① exec.json มีค่าเฉลี่ยย้อนหลังครบ ━━');
const miss=j.hosp.filter(h=>!h.tj||h.tj.apAvg==null||h.tj.arAvg==null);
chk(miss.length===0, `apAvg/arAvg ครบ ${j.hosp.length} แห่ง (ขาด ${miss.length})`);
const ns=[...new Set(j.hosp.map(h=>h.tj&&h.tj.avgN))];
chk(ns.length===1&&ns[0]>=3, `avgN เท่ากันทุกแห่งและ ≥3 งวด (ได้ ${ns.join(',')})`);
chk(A.exTjSimWin()===ns[0], `exTjSimWin() อ่านจากข้อมูลจริง = ${ns[0]} (ไม่ hardcode)`);

console.log('\n━━ ② ขอบเขต: กว้างกว่าคอลัมน์สายเลขคณิตทางซ้าย (รวมต่างจังหวัด) ━━');
let apOk=0, arOk=0, wider=0;
for(const h of j.hosp){
  if(Math.abs(A.exTjApNow(h)-(A.exPayIn(h)+(h.tj.payOut||0)))<0.5) apOk++;
  if(Math.abs(A.exTjArNow(h)-(A.exArRaw(h)+(h.tj.arOut||0)))<0.5) arOk++;
  if(A.exTjApNow(h)>A.exPayIn(h)+0.5 || A.exTjArNow(h)>A.exArRaw(h)+0.5) wider++;
}
chk(apOk===j.hosp.length, `เจ้าหนี้ = payIn + payOut ทุกแห่ง (${apOk}/${j.hosp.length})`);
chk(arOk===j.hosp.length, `ลูกหนี้ = arRaw + arOut ทุกแห่ง (${arOk}/${j.hosp.length})`);
chk(wider>0, `มี รพ. ที่ยอด "สังกัด สธ. ทั้งหมด" มากกว่าคอลัมน์ในจังหวัดจริง ${wider} แห่ง (ยืนยันว่าไม่ใช่คอลัมน์ซ้ำ)`);
const M=1e6;
console.log(`     ทั้งเขต: เจ้าหนี้ ${(j.hosp.reduce((s,h)=>s+A.exTjApNow(h),0)/M).toFixed(2)}M (ในจังหวัด ${(j.hosp.reduce((s,h)=>s+A.exPayIn(h),0)/M).toFixed(2)}M)`
           +` · ลูกหนี้ ${(j.hosp.reduce((s,h)=>s+A.exTjArNow(h),0)/M).toFixed(2)}M (ในจังหวัด ${(j.hosp.reduce((s,h)=>s+A.exArRaw(h),0)/M).toFixed(2)}M)`);

console.log('\n━━ ③ ส่วนต่าง = ยอดปัจจุบัน − ค่าเฉลี่ย เป๊ะทุกแห่ง + ตรงกับที่แสดงบนจอ ━━');
let dBad=0, cellBad=[];
const html=A.exRender()||els['exResBox'].innerHTML;
const body=txt(html);
for(const h of j.hosp){
  if(Math.abs(A.exTjApDiff(h)-(A.exTjApNow(h)-A.exTjApAvg(h)))>0.5) dBad++;
  if(Math.abs(A.exTjArDiff(h)-(A.exTjArNow(h)-A.exTjArAvg(h)))>0.5) dBad++;
}
chk(dBad===0, `ส่วนต่างคำนวณถูกทุกแห่ง (ผิด ${dBad})`);
// ยอดบนจอ: ทุกแห่งต้องมีข้อความ "เฉลี่ย N งวด <ยอด>" ของทั้งสองฝั่ง
for(const h of j.hosp.slice(0,25)){
  for(const v of [A.exTjApAvg(h),A.exTjArAvg(h)]){
    if(v>0 && !body.includes('เฉลี่ย '+A.exTjSimWin()+' งวด '+A.fmtM(v))) cellBad.push(h.name);
  }
}
chk(cellBad.length===0, `ยอดเฉลี่ยบนจอ = exTjApAvg/exTjArAvg (ตรวจ 25 แห่งแรก · ผิด ${cellBad.length})`);
chk(/exsim/.test(html), 'เซลล์/หัวคอลัมน์ติดคลาส exsim (แถบสีบอกว่าไม่เข้าสมการ)');
chk(/\.exsim\{|--exsim:/.test(raw), 'มี CSS ของ .exsim จริง (ไม่ใช่คลาสลอย)');

console.log('\n━━ ④ ⛔ ต้องไม่เข้าสมการใด ๆ — ยัดค่าเฉลี่ยมั่วแล้วทุกอย่างต้องเท่าเดิมเป๊ะ ━━');
const snap=()=>j.hosp.map(h=>{ const r=A.exSimPath(h,0), x={h,r0:r};
  return [A.exNetAfterDebt(h), A.exMoeLeft(x), A.exTopUp(x), r.sepRisk, r.endRisk, A.exSolveFor(h,6)].join('|'); }).join(';');
const before=snap();
j.hosp.forEach((h,i)=>{ h.tj.apAvg=1e9+i*7; h.tj.arAvg=-5e8-i*13; });
A.setEX(j);
const after=snap();
chk(before===after, 'สายเลขคณิต + ระดับก่อน/หลัง + เงินสนับสนุน ไม่ขยับเลยสักตัว');
// แต่ตัวคอลัมน์เองต้องขยับตาม (ไม่งั้นแปลว่าอ่านค่าไม่ถึง = เทสต์ข้อบนหลอกตัวเอง)
chk(A.exTjApAvg(j.hosp[0])===1e9, 'คอลัมน์เองอ่านค่าใหม่จริง (เทสต์ข้อบนไม่ใช่ผลหลอก)');
j=load(); A.setEX(j); A.setEXST(ST({}));

console.log('\n━━ ⑤ ไม่ผูกกับช่องปรับ % ลูกหนี้ (คนละคำถาม — ยอดบัญชีจริง ไม่ใช่ยอดที่คาดว่าเก็บได้) ━━');
const arNow0=j.hosp.map(h=>A.exTjArNow(h)).join(',');
A.setEXST(ST({arPct:20})); A.exRender();
chk(j.hosp.map(h=>A.exTjArNow(h)).join(',')===arNow0, 'ปรับ arPct=20% แล้วคอลัมน์จำลองลูกหนี้ไม่ขยับ');
chk(A.exArIn(j.hosp.find(h=>A.exArRaw(h)>0))<A.exArRaw(j.hosp.find(h=>A.exArRaw(h)>0)), '   (ยืนยันว่า arPct มีผลจริงกับ exArIn — ไม่ใช่สวิตช์ตาย)');
A.setEXST(ST({}));

console.log('\n━━ ⑥ ตำแหน่งคอลัมน์: อยู่ระหว่าง "ส่วนขาดสภาพคล่อง" กับ "ระดับก่อนช่วย" ━━');
const head=(A.exRender()||els['exResBox'].innerHTML).match(/<tr>(<th[\s\S]*?)<\/tr>/)[1];
const ths=[...head.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)].map(m=>txt(m[1]));
const iTop=ths.findIndex(t=>t.includes('ส่วนขาด')), iAp=ths.findIndex(t=>t.includes('จำลองเจ้าหนี้')),
      iAr=ths.findIndex(t=>t.includes('จำลองลูกหนี้')), iSep=ths.findIndex(t=>t.includes('ก่อนช่วย'));
chk(iTop>=0&&iAp>=0&&iAr>=0&&iSep>=0, `หาหัวคอลัมน์ครบ (ส่วนขาด ${iTop} · จำลองเจ้าหนี้ ${iAp} · จำลองลูกหนี้ ${iAr} · ก่อนช่วย ${iSep})`);
chk(iTop<iAp&&iAp<iAr&&iAr<iSep, 'ลำดับถูกต้อง: ส่วนขาด → จำลองเจ้าหนี้ → จำลองลูกหนี้ → ระดับก่อนช่วย');

console.log('\n━━ ⑦ TSV ส่งออกครบและตรงกับหน้าจอ ━━');
const tsv=A.getTSV()||'';
const hdr=(tsv.split('\n')[0]||'').split('\t');
const need=['🔬 เจ้าหนี้','🔬 ลูกหนี้','ส่วนต่างจากค่าเฉลี่ย'];
chk(need.every(n=>hdr.some(x=>x.includes(n))), 'หัว TSV มีคอลัมน์จำลองครบทั้ง 2 ฝั่ง + ส่วนต่าง');
chk(hdr.filter(x=>x.includes('🔬')).length===6, `TSV มี 6 ช่องจำลอง (ยอด/เฉลี่ย/ส่วนต่าง × 2 ฝั่ง) — ได้ ${hdr.filter(x=>x.includes('🔬')).length}`);
const iT=hdr.findIndex(x=>x.includes('🔬 เจ้าหนี้ UC-OP'));
const row1=(tsv.split('\n')[1]||'').split('\t');
chk(iT>=0&&row1[iT]!==undefined&&row1[iT]!=='', 'แถวข้อมูลใน TSV มีค่าจริงในช่องจำลอง');

console.log('\n━━ ⑧ ไม่มี undefined/NaN และมีคำเตือน "ไม่เข้าสมการ" บนจอ ━━');
const full=A.exRender()||els['exResBox'].innerHTML;
chk(!/undefined|NaN/.test(String(full).replace(/undefined"/g,'')), 'ตารางไม่มี undefined/NaN');
chk(/ไม่เข้าสมการ/.test(String(full)), 'มีข้อความกำกับว่าคอลัมน์นี้ไม่เข้าสมการ');

console.log('\n━━ สรุป ━━');
if(fail.length){ console.log(`❌ ไม่ผ่าน ${fail.length} ข้อ`); fail.forEach(f=>console.log('   '+f)); process.exit(1); }
console.log('✅ ผ่านทุกข้อ');
