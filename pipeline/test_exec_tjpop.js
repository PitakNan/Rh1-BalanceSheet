// ตรวจป็อปอัปสายเงิน 3 ตัวในตาราง #exec — เจ้าหนี้ / ลูกหนี้ / เงินสดคงเหลือหลังภาระ MOE
// เจ้าของงานสั่ง 12 ส.ค. 69 (รอบ 2) — RISK_EXEC_MODEL.md 7.30
// รัน: node pipeline/test_exec_tjpop.js
//
// ชุดนี้พิสูจน์ **ค่าคงตัวเชิงคณิต** ของแต่ละฉาก ไม่ใช่แค่ดูว่าเรนเดอร์ได้:
//   เจ้าหนี้ (จ่ายจริง) → ca/qn/cn/cl −D พร้อมกัน ⇒ **NWC เท่าเดิมเป๊ะ** · cash เดิม<0.80 ห้ามดีขึ้น · NI นิ่ง
//   ลูกหนี้ (เก็บได้)   → cn +A เท่านั้น ⇒ **CR/QR/NWC/NI/SU เท่าเดิมเป๊ะทุกแห่ง** ขยับแค่ Cash ratio
//                        (ลูกหนี้อยู่ใน ca และ qn อยู่แล้ว — ดู export_exec.py: ลูกหนี้ = qn − cn)
//   ลูกหนี้ (ตัดจำหน่าย)→ ca/qn/ni −raw ⇒ ห้ามดีขึ้นสักแห่ง
//   MOE                → เงินสดปลายทางของสายเลขคณิต **ต้องเท่ากับ exMoeLeft เป๊ะ** (ตัวเดียวกับคอลัมน์)
// ⚠️ ห้ามลอกสูตร fmtM/scoreOf มาไว้ในไฟล์นี้ — ดึงจากหน้าเว็บตรง ๆ (กติกาเดิม 9 ส.ค. 69)
const fs=require('fs');
const SRC=process.env.RD_SRC||'D:/Github/Rh1-BalanceSheet/docs/risk_drill.html';
const raw=fs.readFileSync(SRC,'utf8');
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
const A=new Function(code+`;return {fmtM,fmtR,scoreOf,exPayIn,exArIn,exArRaw,exArCut,exRender,
  exTjPop,exArPop,exMoePop,exTjScore,exBS,exMoeLeft,exNetAfterDebt,exHorMonths,exMoeTargetLab,exSimPath,
  exXferNet,exRgDep,exRgIn,
  setEX:v=>{EX=v},setEXST:v=>{EXST=v},setEXOPEN:v=>{EXOPEN=v},setEXBRK:v=>{EXBRK=v},setEXSORT:v=>{EXSORT=v}};`)();
const j=JSON.parse(fs.readFileSync('D:/Github/Rh1-BalanceSheet/docs/data/risk/exec.json','utf8'));
const ST=()=>({mmo:0,crisis:'all',types:{'รพศ.':true,'รพท.':true,'รพช.':true},prov:'all',ext:0,tgt:6,
  moePct:{},moePctAll:0,moeOff:{},moeOvr:{},xmoe:true,adj:{},adjAll:0,revOff:{},ovr:{},
  tj:{mode:'off',scope:'crisis'},inj:{},open:{}});
A.setEX(j); A.setEXST(ST()); A.setEXOPEN({}); A.setEXBRK({}); A.setEXSORT({k:'risk0',d:-1});
const EL=id=>document.getElementById(id);
const txt=s=>String(s).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
let fail=[]; const chk=(c,m)=>{console.log('  '+(c?'✅':'❌')+' '+m); if(!c) fail.push(m)};
const r2=v=>Math.round(v*100)/100;
const sc=b=>A.scoreOf(b.ca,b.cl,b.qn,b.cn,b.ni,b.mo);
const B=h=>A.exBS(h);
const withPay=j.hosp.filter(h=>A.exPayIn(h)>0 && h.bs && h.bs.cl);
const withAr =j.hosp.filter(h=>A.exArRaw(h)>0 && h.bs && h.bs.cl);
// เปิดป็อปอัปแล้วคืน {html, txt, badges} — badges = เลขในทุก .badge ตามลำดับที่ปรากฏ
const open=(fn,hc,id)=>{ EL(id).innerHTML=''; A[fn](hc); const html=String(EL(id).innerHTML);
  const badges=[...html.matchAll(/class="badge"[^>]*>(\d+|–)</g)].map(m=>m[1]);
  return {html, txt:txt(html), badges}; };

console.log('━━ ① ยอดที่คลิกได้ตรงกับเงื่อนไขของแต่ละคอลัมน์ ━━');
const html=A.exRender()||EL('exResBox').innerHTML;
const got=f=>new Set([...String(html).matchAll(new RegExp(f+"\\('(\\d+)'\\)",'g'))].map(m=>m[1]));
const want=f=>new Set(j.hosp.filter(f).map(h=>h.hcode));
const cmp=(f,pred,lab)=>{ const g=got(f), w=want(pred);
  chk(g.size===w.size&&[...w].every(x=>g.has(x)),`${lab}: คลิกได้ ${g.size} แห่ง = ที่ควรได้ ${w.size} แห่ง`); };
cmp('exTjPop', h=>A.exPayIn(h)>0, 'เจ้าหนี้');
cmp('exArPop', h=>A.exArRaw(h)>0, 'ลูกหนี้');
cmp('exMoePop',()=>true,          'เงินสดหลังภาระ MOE');

console.log('\n━━ ② ป็อปอัปทั้ง 3 ตัวเรนเดอร์ได้ครบทุกแห่ง ไม่ throw ไม่มี NaN/undefined ━━');
for(const [fn,id,lab] of [['exTjPop','exTjOverlay','เจ้าหนี้'],['exArPop','exArOverlay','ลูกหนี้'],['exMoePop','exMoeOverlay','MOE']]){
  let bad=[], nan=[];
  for(const h of j.hosp){
    EL(id).innerHTML='';
    try{ A[fn](h.hcode); }catch(e){ bad.push(h.name+': '+e.message); continue; }
    const s=String(EL(id).innerHTML);
    if(!s) bad.push(h.name+': ว่าง');
    if(/NaN|undefined|Infinity/.test(s)) nan.push(h.name);
  }
  chk(bad.length===0,`${lab}: เรนเดอร์ผ่าน ${j.hosp.length} แห่ง`+(bad.length?' → '+bad.slice(0,3).join(' | '):''));
  chk(nan.length===0,`${lab}: ไม่มี NaN/undefined/Infinity`+(nan.length?' → '+nan.slice(0,4).join(', '):''));
}
const noPay=j.hosp.find(h=>!(A.exPayIn(h)>0));
chk(/ไม่มียอดเจ้าหนี้/.test(open('exTjPop',noPay.hcode,'exTjOverlay').txt),`เคสไม่มีเจ้าหนี้ขึ้นข้อความอธิบาย (${noPay.name})`);
const noAr=j.hosp.find(h=>!(A.exArRaw(h)>0));
if(noAr) chk(/ไม่มียอดลูกหนี้/.test(open('exArPop',noAr.hcode,'exArOverlay').txt),`เคสไม่มีลูกหนี้ขึ้นข้อความอธิบาย (${noAr.name})`);
else chk(true,'ทุกแห่งมีลูกหนี้ (ไม่มีเคสว่างให้ทดสอบ)');

console.log('\n━━ ③ เจ้าหนี้ · ฉากหลัก = จ่ายจริง: NWC เท่าเดิมเป๊ะ · cash เดิม<0.80 ห้ามดีขึ้น · NI นิ่ง ━━');
const payRoute=(b,D)=>{ let ca=b.ca-D,qn=b.qn-D,cn=b.cn-D,cl=Math.max(0,b.cl-D),back=0;
  if(cn<0){ back=-cn; cn=0; ca+=back; qn+=back; cl+=back; }
  return {ca,cl,qn,cn,ni:b.ni,mo:b.mo,back}; };
let nwcMoved=[], cashUp=[], niMoved=[], clampN=0, payBetter=0, payWorse=0;
for(const h of withPay){
  const b0=B(h), D=A.exPayIn(h), rp=payRoute(b0,D), s0=sc(b0), sp=sc(rp);
  if(Math.abs(sp.nwc-s0.nwc)>1) nwcMoved.push(`${h.name} ${Math.round(sp.nwc-s0.nwc)}`);
  if(r2(s0.cash)<0.8 && sp.cash>s0.cash+1e-9) cashUp.push(h.name);
  if(rp.ni!==b0.ni) niMoved.push(h.name);
  if(rp.back>0) clampN++;
  if(sp.risk<s0.risk) payBetter++; else if(sp.risk>s0.risk) payWorse++;
}
chk(nwcMoved.length===0,'NWC เท่าเดิมทุกแห่ง (จ่ายลดสองฝั่งเท่ากัน)'+(nwcMoved.length?' → '+nwcMoved.slice(0,3).join(' | '):''));
chk(cashUp.length===0,'Cash ratio ที่เดิม<0.80 ไม่มีแห่งไหนดีขึ้นจากการจ่ายเงินสด'+(cashUp.length?' → '+cashUp.slice(0,3).join(', '):''));
chk(niMoved.length===0,'NI ไม่ขยับสักแห่ง (การจ่ายหนี้ไม่ผ่านบัญชีรายได้/ค่าใช้จ่าย)');
console.log(`     → จ่ายจริงแล้วดีขึ้น ${payBetter} แห่ง · แย่ลง ${payWorse} แห่ง · เงินสดไม่พอจ่ายเต็มก้อน ${clampN} แห่ง`);
// หัวป็อปอัปต้องรายงานฉาก "จ่ายจริง" ไม่ใช่ฉากวัดน้ำหนัก
const pk=withPay.slice().sort((a,b)=>A.exPayIn(b)-A.exPayIn(a)).slice(0,3);
for(const h of pk){
  const b0=B(h), D=A.exPayIn(h), rp=payRoute(b0,D);
  const o=open('exTjPop',h.hcode,'exTjOverlay');
  console.log(`  · ${h.name} หนี้ ${A.fmtM(D)} — ระดับ ${sc(b0).risk} → จ่ายจริง ${sc(rp).risk} · badge [${o.badges.join(',')}]`);
  chk(+o.badges[1]===sc(rp).risk,`  ${h.name}: badge หัวป็อปอัป = ระดับหลัง**จ่ายจริง** (${sc(rp).risk})`);
  chk(/หลังจ่ายจริง/.test(o.txt),`  ${h.name}: พาดหัวบอกว่าเป็นฉากจ่ายจริง`);
  chk(/NWC ไม่ขยับ/.test(o.txt),`  ${h.name}: เตือนว่า NWC ไม่ขยับ`);
  chk(o.txt.includes(A.fmtM(D)),`  ${h.name}: มียอดหนี้ ${A.fmtM(D)} บนจอ`);
}

// 🪤 ช่อง "เปลี่ยน" ห้ามขึ้น "↓ 0.00" / "↑ 0.00" — ถ้าสองช่องซ้ายเลขต่างกัน ส่วนต่างต้องอ่านออก
//    (เจอจริง 12 ส.ค. 69 ที่ CR 0.98 → 0.97 ส่วนต่าง 0.005 ปัดเป็น 0.00)
{ let zero=[];
  for(const h of withPay){ const o=open('exTjPop',h.hcode,'exTjOverlay');
    if(/[↑↓]\s*0\.00(?!\d)/.test(o.txt)||/[↑↓]\s*0(?![\d.])/.test(o.txt)) zero.push(h.name); }
  chk(zero.length===0,'ไม่มีแห่งไหนขึ้นส่วนต่างเป็น 0 ทั้งที่ค่าเปลี่ยนจริง'+(zero.length?' → '+zero.slice(0,3).join(', '):'')); }

console.log('\n━━ ④ เจ้าหนี้ · กริด 4 ฉาก: ตัดหนี้ล้วน ๆ ไม่แย่ลง · ยกหนี้ ≤ ตัดหนี้ล้วน ๆ ━━');
let cutWorse=[], fgWorse=[];
for(const h of withPay){
  const b0=B(h), D=A.exPayIn(h);
  const s0=sc(b0), s1=sc({...b0,cl:Math.max(0,b0.cl-D)}), sf=sc({...b0,cl:Math.max(0,b0.cl-D),ni:b0.ni+D});
  if(s1.risk>s0.risk) cutWorse.push(h.name);
  if(sf.risk>s1.risk) fgWorse.push(h.name);
}
chk(cutWorse.length===0,'ฉากวัดน้ำหนัก (cl−D) ไม่แย่ลงสักแห่ง');
chk(fgWorse.length===0,'ยกหนี้ไม่แย่กว่าฉากวัดน้ำหนักสักแห่ง');
const g4=open('exTjPop',pk[0].hcode,'exTjOverlay');
chk(g4.badges.length===2+4,`กริดมี 4 ฉาก + หัว 2 badge (ได้ ${g4.badges.length})`);
chk(/สถานการณ์จริง/.test(g4.txt),'กริดชี้ว่าแถวไหนคือสถานการณ์จริง');
chk(/ไม่ articulate/.test(g4.txt),'แถวอ้างอิงยังเตือนว่างบดุลไม่ articulate');

console.log('\n━━ ⑤ ลูกหนี้ · เก็บได้: ขยับ Cash ratio ตัวเดียว — CR/QR/NWC/NI/SU ต้องเท่าเดิมเป๊ะ ━━');
let arMoved=[], arCashFlat=[];
for(const h of withAr){
  const b0=B(h), Ain=A.exArIn(h);
  const s0=sc(b0), s1=sc({...b0, cn:b0.cn+Ain});
  if(Math.abs(s1.cr-s0.cr)>1e-12||Math.abs(s1.qr-s0.qr)>1e-12||Math.abs(s1.nwc-s0.nwc)>1||s1.su!==s0.su)
    arMoved.push(`${h.name} cr${(s1.cr-s0.cr).toFixed(4)} qr${(s1.qr-s0.qr).toFixed(4)} nwc${Math.round(s1.nwc-s0.nwc)} su${s1.su-s0.su}`);
  if(Ain>0 && !(s1.cash>s0.cash)) arCashFlat.push(h.name);
}
chk(arMoved.length===0,`CR/QR/NWC/SU ไม่ขยับสักแห่งทั้ง ${withAr.length} แห่ง`+(arMoved.length?' → '+arMoved.slice(0,3).join(' | '):''));
chk(arCashFlat.length===0,'Cash ratio สูงขึ้นทุกแห่งที่มียอดเก็บได้ > 0'+(arCashFlat.length?' → '+arCashFlat.slice(0,3).join(', '):''));
const ap=withAr.slice().sort((a,b)=>A.exArIn(b)-A.exArIn(a))[0];
const oa=open('exArPop',ap.hcode,'exArOverlay');
console.log(`  · ${ap.name}: ลูกหนี้เก็บได้ ${A.fmtM(A.exArIn(ap))} — badge [${oa.badges.join(',')}]`);
chk(/ขยับแค่ Cash ratio|ทำไมขยับแค่ Cash ratio/.test(oa.txt),'ป็อปอัปอธิบายว่าทำไมขยับแค่ Cash ratio');
chk(/qn − cn|ลูกหนี้ = qn − cn/.test(oa.txt),'อ้างที่มาว่าลูกหนี้ถูกนับใน ca/qn อยู่แล้ว');
chk(/ตัดจำหน่าย/.test(oa.txt),'มีฉากตัดจำหน่ายลูกหนี้ที่เก็บไม่ได้');
chk(oa.txt.includes(A.fmtM(A.exArIn(ap))),'ยอดที่คาดว่าเก็บได้ปรากฏบนจอ');

// แถว "② เก็บได้ + ตัดที่เก็บไม่ได้" ต้องโผล่เฉพาะเมื่อมีการตัดจริง (ค่าเริ่มต้น arPct=100 → ไม่มี)
chk(!/เก็บได้[^<]*\+ ตัดที่เก็บไม่ได้/.test(oa.txt),'ค่าเริ่มต้น (ไม่มีการตัด) ไม่ขึ้นแถวผสม');
{ const st=ST(); st.arPct=62; A.setEXST(st); A.exRender();
  const h2=withAr.slice().sort((a,b)=>A.exArIn(b)-A.exArIn(a))[0];
  const cut=A.exArCut(h2), o2=open('exArPop',h2.hcode,'exArOverlay');
  chk(cut>0,`ตั้ง "ลูกหนี้ที่เก็บได้ 62%" แล้วมีส่วนที่ตัดออกจริง ${A.fmtM(cut)} (${h2.name})`);
  chk(/ตัดที่เก็บไม่ได้/.test(o2.txt),'พอมีการตัดจริง แถวผสมโผล่ขึ้นมา');
  chk(o2.txt.includes(A.fmtM(A.exArIn(h2))),'ยอดในป็อปอัปเดินตามตัวควบคุม % (ไม่ค้างยอดเดิม)');
  A.setEXST(ST()); A.exRender(); }

console.log('\n━━ ⑥ ลูกหนี้ · ตัดจำหน่ายเต็มจำนวน: ห้ามดีขึ้นสักแห่ง (เป็นทางลง) ━━');
let wrWorse=0, wrBetter=[];
for(const h of withAr){
  const b0=B(h), rawv=A.exArRaw(h);
  const s0=sc(b0), sw=sc({...b0, ca:b0.ca-rawv, qn:b0.qn-rawv, ni:b0.ni-rawv});
  if(sw.risk<s0.risk) wrBetter.push(h.name);
  if(sw.risk>s0.risk) wrWorse++;
}
chk(wrBetter.length===0,'ไม่มีแห่งไหนคะแนนดีขึ้นจากการตัดจำหน่ายลูกหนี้'+(wrBetter.length?' → '+wrBetter.slice(0,3).join(', '):''));
console.log(`     → ตัดจำหน่ายเต็มจำนวนแล้วแย่ลง ${wrWorse} แห่ง จาก ${withAr.length} แห่ง`);

console.log('\n━━ ⑦ MOE · สายเลขคณิตต้องปิดที่ exMoeLeft เป๊ะ (ตัวเดียวกับคอลัมน์) ━━');
let moeOff=[], moeTxt=[];
for(const h of j.hosp){
  const r0=A.exSimPath(h,0), x={h,r0};
  const b0=B(h), D=A.exPayIn(h), Ain=A.exArIn(h), xf=A.exXferNet(h), dep=A.exRgDep(h), rin=A.exRgIn(h);
  const mm=A.exHorMonths(h), M=(r0.moeMo||0)*mm;
  const chainEnd=b0.cn-D+Ain+xf-dep+rin-M;                 // ปลายทางของสายเลขคณิตในป็อปอัป
  const left=A.exMoeLeft(x);
  if(Math.abs(chainEnd-left)>1) moeOff.push(`${h.name} ${Math.round(chainEnd-left)}`);
  const t=txt(EL('exMoeOverlay').innerHTML='')||'';
  const o=open('exMoePop',h.hcode,'exMoeOverlay');
  const shown=left<0?'ขาด '+A.fmtM(-left):'เหลือ '+A.fmtM(left);
  if(!o.txt.includes(shown)) moeTxt.push(h.name+' ต้องมี "'+shown+'"');
}
chk(moeOff.length===0,`สายเลขคณิตปิดตรง exMoeLeft ทั้ง ${j.hosp.length} แห่ง`+(moeOff.length?' → '+moeOff.slice(0,3).join(' | '):''));
chk(moeTxt.length===0,'ยอดคงเหลือบนป็อปอัป = ยอดในคอลัมน์ทุกแห่ง'+(moeTxt.length?' → '+moeTxt.slice(0,2).join(' | '):''));

console.log('\n━━ ⑧ MOE · งบดุลสถานการณ์ stress: เงินสดปลายทาง = exMoeLeft · badge ตรงกับที่คำนวณ ━━');
const stress=h=>{
  const r0=A.exSimPath(h,0), b0=B(h);
  const D=A.exPayIn(h), Ain=A.exArIn(h), cut=A.exArCut(h), xf=A.exXferNet(h), dep=A.exRgDep(h), rin=A.exRgIn(h);
  const mm=A.exHorMonths(h), M=(r0.moeMo||0)*mm, sub=xf+rin;
  let b={ca:b0.ca-D-cut+sub-dep-M, qn:b0.qn-D-cut+sub-dep-M, cn:b0.cn-D+Ain+sub-dep-M,
         cl:Math.max(0,b0.cl-D), ni:b0.ni-cut+sub-M, mo:b0.mo, back:0};
  if(b.cn<0){ const d=-b.cn; b={...b, cn:0, ca:b.ca+d, qn:b.qn+d, cl:b.cl+d, back:d}; }
  return b;
};
let cnOff=[], badgeOff=[];
for(const h of j.hosp){
  const bS=stress(h), left=A.exMoeLeft({h,r0:A.exSimPath(h,0)});
  if(Math.abs((bS.back>0?-bS.back:bS.cn)-left)>1) cnOff.push(`${h.name} ${Math.round((bS.back>0?-bS.back:bS.cn)-left)}`);
}
chk(cnOff.length===0,'เงินสดในงบดุลสถานการณ์ stress = exMoeLeft ทุกแห่ง'+(cnOff.length?' → '+cnOff.slice(0,3).join(' | '):''));
const mp=j.hosp.filter(h=>h.bs&&h.bs.cl).slice().sort((a,b)=>A.exMoeLeft({h:a,r0:A.exSimPath(a,0)})-A.exMoeLeft({h:b,r0:A.exSimPath(b,0)})).slice(0,4);
for(const h of mp){
  const b0=B(h), bS=stress(h), s0=sc(b0), s1=sc(bS);
  const o=open('exMoePop',h.hcode,'exMoeOverlay');
  const left=A.exMoeLeft({h,r0:A.exSimPath(h,0)});
  console.log(`  · ${h.name}: คงเหลือ ${A.fmtM(left)} — ระดับ ${s0.risk} → ${s1.risk} · badge [${o.badges.join(',')}]`);
  chk(+o.badges[0]===s0.risk&&+o.badges[1]===s1.risk,`  ${h.name}: badge = ${s0.risk} → ${s1.risk} ตรงกับที่คำนวณ`);
  if(bS.back>0) chk(/ค้างจ่าย|จ่ายไม่ไหว/.test(o.txt),`  ${h.name}: บอกว่าส่วนที่จ่ายไม่ไหวค้างเป็นเจ้าหนี้`);
  chk(/สมมติไม่มีรายรับ/.test(o.txt),`  ${h.name}: ติดป้ายว่าเป็น stress test`);
  chk(/ยังขาดอีกกี่บาท|ห่างจากเกณฑ์/.test(o.txt),`  ${h.name}: มีคอลัมน์ระยะห่างจากเกณฑ์เป็นบาท`);
}

console.log('\n━━ ⑨ MOE · เปลี่ยนเดือนในตัวกรองแล้วป็อปอัปต้องขยับตาม ━━');
const hM=mp[0];
const snap=n=>{ const st=ST(); st.mmo=n; A.setEXST(st); A.exRender();
  return {t:open('exMoePop',hM.hcode,'exMoeOverlay').txt, left:A.exMoeLeft({h:hM,r0:A.exSimPath(hM,0)}), lab:A.exMoeTargetLab()}; };
const m3=snap(3), m6=snap(6);
chk(m3.left!==m6.left,`คงเหลือเปลี่ยนตามเดือน (3ด. ${A.fmtM(m3.left)} · 6ด. ${A.fmtM(m6.left)})`);
chk(m3.t.includes('3 เดือน')&&m6.t.includes('6 เดือน'),'ป็อปอัปบอกจำนวนเดือนตามตัวกรอง');
chk(m3.t.includes(m3.lab)&&m6.t.includes(m6.lab),`ป็อปอัปบอกเดือนเป้าตามตัวกรอง (${m3.lab} / ${m6.lab})`);
A.setEXST(ST()); A.exRender();

console.log('\n━━ ⑩ กติกาโค้ด ━━');
const slice=(a,b)=>code.slice(code.indexOf(a),code.indexOf(b)).split('\n').map(l=>l.replace(/\/\/.*/,'')).join('\n');
// 🪤 ห้ามใส่ $ ท้าย regex ตัดคอมเมนต์ — ไฟล์เป็น CRLF, "." ไม่กิน \r จึงไม่แมตช์ (เจอจริง 12 ส.ค. 69)
const fnTj=slice('function exTjPop','function exTjClose');
chk(!/EXST\.tj/.test(fnTj)&&!/EXTJ\b/.test(fnTj),'exTjPop ไม่อ่าน EXST.tj / EXTJ (ไม่ผูก dropdown Option)');
const ref=open('exTjPop',pk[0].hcode,'exTjOverlay').html;
let drift=[];
for(const mode of ['pay','forgive','smart','off']){
  const st=ST(); st.tj={mode,scope:'all'}; A.setEXST(st); A.exRender();
  if(open('exTjPop',pk[0].hcode,'exTjOverlay').html!==ref) drift.push(mode);
}
chk(drift.length===0,'สลับ Option ครบ off/pay/forgive/smart แล้วป็อปอัปเจ้าหนี้ไม่ขยับ'+(drift.length?' → '+drift.join(','):''));
A.setEXST(ST()); A.exRender();
const fnAr=slice('function exArPop','function exArClose');
chk(!/CR|QR/.test(fnAr)||!/เก็บ[^<]{0,20}(CR|QR)[^<]{0,20}ดีขึ้น/.test(fnAr),'ไม่มีประโยคอ้างว่าเก็บลูกหนี้แล้ว CR/QR ดีขึ้น');
chk(/exArIn\(h\)/.test(fnAr)&&/exArRaw\(h\)/.test(fnAr),'ลูกหนี้อ่านทั้งยอดหลังปรับ % และยอดดิบ');
const fnMoe=slice('function exMoePop','function exMoeClose');
chk(/exMoeLeft\(x\)/.test(fnMoe)&&/exNetAfterDebt\(h\)/.test(fnMoe),'MOE ใช้ exMoeLeft/exNetAfterDebt ตัวเดียวกับคอลัมน์ ไม่คำนวณเอง');
chk(/exHorMonths\(h\)/.test(fnMoe)&&/exMoeTargetLab\(\)/.test(fnMoe),'MOE ผูกกับเดือนในตัวกรอง ไม่ hardcode');
// ทุกป็อปอัปต้องใช้ตัวเรนเดอร์ร่วม เพื่อให้หน้าตา/กติกาการปัดเศษตรงกัน
for(const [f,a,b] of [['เจ้าหนี้','function exTjPop','function exTjClose'],['ลูกหนี้','function exArPop','function exArClose'],['MOE','function exMoePop','function exMoeClose']])
  chk(/exCmpTable\(/.test(slice(a,b)),`${f}: ใช้ exCmpTable ร่วมกัน (กติกาเกณฑ์/การปัดเดียวกับ 7.29)`);

console.log('\n'+(fail.length?'❌ ตก '+fail.length+' ข้อ:\n  - '+fail.join('\n  - '):'✅ ผ่านทุกข้อ'));
process.exit(fail.length?1:0);
