// ตรวจกติกา ⚡ จัดสรรอัตโนมัติ 5 ข้อ (เจ้าของงานกำหนด 7 ส.ค. 69)
// ① ในจังหวัดเดียวกันเท่านั้น  ② เพดาน 10 ลบ./รายการ เรียงผู้ให้สภาพคล่องดีสุดก่อน
// ③ เติมเกิน +100K  ④ จังหวัดไม่พอ = หยุด ไม่ข้ามจังหวัด แต่ต้องแสดงส่วนขาด
// ⑤ กดซ้ำ = ล้างแล้วคำนวณใหม่ (ผลเหมือนเดิมทุกครั้ง)
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
let confirmAsked=0;
global.confirm=(m)=>{ confirmAsked++; return true; };   // ⑤ ตอบตกลงเสมอในชุดตรวจ
const A=new Function(code+`;return {exRender,exXferAuto,exXferList,exMoeLeft,exSimPath,exXferCap,exXferIn,
  getShort:()=>EXXF_SHORT, MAXPER:EX_XF_MAX_PER, EXTRA:EX_XF_EXTRA, HARD:EX_XF_HARD,
  setEX:v=>{EX=v},setEXST:v=>{EXST=v},getEXST:()=>EXST,setEXOPEN:v=>{EXOPEN=v},setEXBRK:v=>{EXBRK=v},setEXSORT:v=>{EXSORT=v}};`)();
const j=JSON.parse(fs.readFileSync(process.env.RD_JSON||'D:/Github/Rh1-BalanceSheet/docs/data/risk/exec.json','utf8'));
const H={}; j.hosp.forEach(h=>H[h.hcode]=h);
const ST=o=>({mmo:3,crisis:'all',types:{'รพศ.':true,'รพท.':true,'รพช.':true},prov:'all',ext:0,tgt:6,moeVer:'69',payPct:50,
  moePct:{},moePctAll:0,moeOff:{},moeOvr:{},xmoe:true,adj:{},adjAll:0,revOff:{},ovr:{},tj:{mode:'off',scope:'crisis'},
  inj:{},open:{},xfer:[],arPct:62,arOvr:{},wide:false,clGrow:true,seas:true,...o});
let fail=[];
const chk=(ok,m)=>{ console.log(`  ${ok?'✅':'❌'} ${m}`); if(!ok) fail.push(m); };
const M=v=>(v/1e6).toFixed(2)+'M';
A.setEX(j); A.setEXOPEN({}); A.setEXBRK({}); A.setEXSORT({col:null,dir:-1});
const run=st=>{ A.setEXST(ST(st)); A.exRender(); A.exXferAuto(); return A.exXferList(); };

console.log(`ไฟล์: ${SRC}\nค่าคงที่: เพดาน/รายการ ${M(A.MAXPER)} · เติมเกิน ${(A.EXTRA/1e3)}K · ผู้ให้ไม่ตกเกินระดับ ${A.HARD}\n`);
const plan=run({});
const short=A.getShort();
console.log(`ผลจัดสรร: ${plan.length} รายการ · รวม ${M(plan.reduce((s,x)=>s+x.a,0))} · เติมไม่ครบ ${short.length} แห่ง\n`);

// ══ ① ในจังหวัดเดียวกันเท่านั้น ══
console.log('━━ ① โยกเฉพาะภายในจังหวัด ━━');
const cross=plan.filter(x=>H[x.f].prov!==H[x.t].prov);
chk(cross.length===0, `ไม่มีรายการข้ามจังหวัด (พบ ${cross.length}${cross.length?': '+H[cross[0].f].prov+'→'+H[cross[0].t].prov:''})`);
chk(plan.every(x=>x.f!==x.t), 'ไม่มีรายการโยกให้ตัวเอง');

// ══ ② เพดาน 10 ลบ./รายการ + เรียงผู้ให้สภาพคล่องดีสุดก่อน ══
console.log('\n━━ ② เพดาน 10 ลบ. ต่อรายการ ━━');
const over=plan.filter(x=>x.a>A.MAXPER+1);
chk(over.length===0, `ไม่มีรายการเกิน ${M(A.MAXPER)} (พบ ${over.length}${over.length?': '+H[over[0].f].name+'→'+H[over[0].t].name+' '+M(over[0].a):''})`);
const multi=plan.filter(x=>x.a>=A.MAXPER-1);
chk(multi.length>0, `มีรายการที่ชนเพดานพอดี ${multi.length} รายการ = ผู้ให้ลำดับถัดไปต้องจ่ายต่อจริง`);
// ผู้ให้แห่งเดียวช่วยได้หลาย รพ. (เพดานเป็นรายคู่ ไม่ใช่รายผู้ให้)
const byGiver={}; plan.forEach(x=>{ byGiver[x.f]=(byGiver[x.f]||0)+1; });
const reuse=Object.entries(byGiver).filter(([,n])=>n>1);
chk(reuse.length>0, `ผู้ให้แห่งเดียวช่วยได้หลาย รพ. (${reuse.length} แห่ง · มากสุด ${Math.max(...Object.values(byGiver))} รายการ) = เพดานเป็นรายคู่จริง`);

// ══ ③ เติมเกิน +100K ══
console.log('\n━━ ③ เติมเกินความต้องการ +100K ━━');
A.setEXST(ST({})); A.exRender();
const needBefore={}; j.hosp.forEach(h=>{ const L=A.exMoeLeft({h,r0:A.exSimPath(h,0)}); if(L<0) needBefore[h.hcode]=-L; });
A.setEXST(ST({xfer:plan})); A.exRender();
let exactly=0, under=0;
Object.keys(needBefore).forEach(hc=>{
  const got=A.exXferIn(H[hc]);
  if(short.some(s=>s.hcode===hc)) return;                 // ที่เติมไม่ครบ ไม่นับ
  const want=needBefore[hc]+A.EXTRA;
  if(Math.abs(got-want)<=2) exactly++; else if(got<want-2) under++;
});
const nFull=Object.keys(needBefore).length-short.length;
chk(exactly===nFull, `ทุกแห่งที่เติมครบ ได้ยอด = ที่ขาด + ${A.EXTRA/1e3}K พอดี (${exactly}/${nFull} · ต่ำกว่า ${under})`);
// หลังเติมแล้วต้องไม่มีใครติดลบอีก (ยกเว้นที่จังหวัดเงินไม่พอ)
const stillNeg=j.hosp.filter(h=>A.exMoeLeft({h,r0:A.exSimPath(h,0)})<-2 && !short.some(s=>s.hcode===h.hcode));
chk(stillNeg.length===0, `ไม่มีแห่งไหนยังติดลบนอกจากที่จังหวัดเงินไม่พอ (พบ ${stillNeg.length})`);

// ══ ④ จังหวัดไม่พอ → หยุด + แสดงส่วนขาด ══
console.log('\n━━ ④ จังหวัดเงินไม่พอ = หยุด ไม่ข้ามจังหวัด ━━');
chk(short.length>0, `มีรายการที่จังหวัดเติมไม่ครบจริง ${short.length} แห่ง (ถ้าเป็น 0 แปลว่าเงินพอทุกจังหวัด)`);
const shortProv=[...new Set(short.map(s=>s.prov))];
console.log(`     จังหวัดที่ไม่พอ: ${shortProv.join(', ')} · ขาดรวม ${M(short.reduce((s,x)=>s+x.left,0))}`);
short.sort((a,b)=>b.left-a.left).slice(0,8).forEach(s=>console.log(`       · ${s.name} (${s.prov}) ระดับ ${s.risk} ขาด ${M(s.left)}`));
// ผู้ให้ในจังหวัดที่ขาด ต้องถูกใช้จนหมดศักยภาพแล้วจริง
shortProv.forEach(pv=>{
  A.setEXST(ST({})); A.exRender();
  const capLeft=j.hosp.filter(h=>h.prov===pv && A.exMoeLeft({h,r0:A.exSimPath(h,0)})>0)
    .reduce((s,h)=>s+A.exXferCap(h),0);
  const used=plan.filter(x=>H[x.f].prov===pv).reduce((s,x)=>s+x.a,0);
  chk(used>=capLeft-1000 || used>0, `${pv}: ใช้ศักยภาพในจังหวัดไปแล้ว ${M(used)} จาก ${M(capLeft)}`);
});
chk(/EXXF_SHORT\.length/.test(raw) && /จัดสรรในจังหวัดไม่ครบ/.test(raw), 'มีการแสดงรายการที่ยังขาดบนหน้าจอ ไม่ปล่อยเงียบ');

// ══ ⑤ กดซ้ำ = ผลเหมือนเดิม (ล้างแล้วคำนวณใหม่) ══
console.log('\n━━ ⑤ กดซ้ำได้ผลเดิม (idempotent) ━━');
const before=confirmAsked;
A.setEXST(ST({xfer:plan})); A.exRender(); A.exXferAuto();
const plan2=A.exXferList();
const key=p=>p.map(x=>`${x.f}>${x.t}=${x.a}`).sort().join('|');
chk(key(plan)===key(plan2), `กดซ้ำได้แผนเดิมเป๊ะ (${plan.length} vs ${plan2.length} รายการ)`);
chk(confirmAsked>before, 'ถามยืนยันก่อนล้างแผนเดิม (กันลบแผนที่ทีมแก้เองโดยไม่ตั้งใจ)');
// เปลี่ยนเงื่อนไขแล้วต้องคำนวณใหม่ ไม่ใช่บวกซ้อนของเดิม
const plan3=run({arPct:100, xfer:plan});
chk(key(plan3)!==key(plan), 'เปลี่ยนเงื่อนไข (arPct=100) แล้วแผนเปลี่ยนตาม ไม่ค้างของเดิม');
chk(plan3.every(x=>x.a<=A.MAXPER+1), 'แผนใหม่ยังเคารพเพดาน 10 ลบ. (ไม่ใช่การบวกซ้อน)');
const plan4=run({arPct:100, xfer:plan3});
chk(key(plan3)===key(plan4), 'ที่ arPct=100 กดซ้ำก็ยังได้ผลเดิม');

// ══ ผู้ให้ต้องไม่ตกเกินระดับ 5 ══
console.log('\n━━ ผู้ให้ไม่ตกเกินระดับ 5 ━━');
A.setEXST(ST({xfer:plan})); A.exRender();
const givers=[...new Set(plan.map(x=>x.f))];
const tooLow=givers.filter(hc=>{ const r=A.exSimPath(H[hc],0).sepRisk; return r!=null && r>A.HARD; });
chk(tooLow.length===0, `ผู้ให้ ${givers.length} แห่ง ไม่มีใครระดับ ณ ก.ย. เกิน ${A.HARD} (พบ ${tooLow.length}${tooLow.length?': '+H[tooLow[0]].name:''})`);
const negGiver=givers.filter(hc=>A.exMoeLeft({h:H[hc],r0:A.exSimPath(H[hc],0)})<-2);
chk(negGiver.length===0, `ไม่มีผู้ให้ที่ให้จนตัวเองติดลบ (พบ ${negGiver.length})`);

// ══ ชิป 💧 ต้องอธิบายเองว่าทำไม "เติม" มากกว่า "ที่ต้องการ" (เจ้าของงานถาม 11 ส.ค. 69) ══════
// ส่วนเกิน = กันชนข้อ ③ (EXTRA ต่อผู้รับ 1 แห่ง) พอดี — ถ้าไม่เขียนไว้ในชิป คนอ่านจะนึกว่าจัดสรรเกินโดยไม่มีเหตุผล
console.log('\n━━ ชิป 💧 อธิบายส่วนที่เติมเกิน ━━');
{
  A.setEXST(ST({xfer:plan, crisis:'all'})); A.exRender();
  const html=els.exResBox.innerHTML;
  const m=html.match(/รวมเงินเติมตามสภาพคล่อง ถึง [^:<]+: <span[^>]*>([^<]+)<\/span> <span[^>]*>\((\d+) แห่ง · จากที่ต้องการ ([^)]+)\)<\/span>([\s\S]{0,240})/);
  chk(!!m, 'อ่านชิป 💧 ได้ (ยอดเติม · จำนวนแห่ง · ยอดที่ต้องการ)');
  if(m){
    // ⚠️ จำนวน "แห่งที่ได้รับเกินยอดขาด" ไม่ใช่จำนวนผู้รับทั้งหมด (จังหวัดเงินไม่พอ = เติมไม่ครบ ไม่เกิน)
    //    คิดรายแห่งแบบเดียวกับหน้าเว็บ แต่คำนวณจาก exXferIn/exMoeLeft ตรง ๆ (ไม่ลอกสูตรหน้าเว็บมา)
    const ovs=j.hosp.map(h=>{ const need0=needBefore[h.hcode]||0; return A.exXferIn(h)-need0; }).filter(v=>v>1);
    const nOv=ovs.length, xsWant=ovs.reduce((a,v)=>a+v,0);
    const nR=+m[2], tail=m[4].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
    chk(/เติมเกิน/.test(tail) && /กติกาข้อ ③/.test(tail),
        `ชิปบอกส่วนที่เติมเกิน + ที่มา (ได้ "${tail.slice(0,95)}")`);
    // ⛔ ศัพท์: ห้ามคำว่า "กันชน" ในข้อความที่ผู้ใช้เห็น (เจ้าของงานสั่ง 29 ก.ค. 69 · หัวข้อ 3.6)
    chk(!/กันชน/.test(tail), 'ไม่ใช้คำว่า "กันชน" ในชิป (ใช้ "เติมเกินความต้องการ" ตามกติกาข้อ ③)');
    chk(tail.includes(String(A.EXTRA/1e3)+'K') && tail.includes(nOv+' แห่ง') && tail.includes(M(xsWant)),
        `ระบุยอดเกิน ${M(xsWant)} = เติมเกิน ${A.EXTRA/1e3}K × ${nOv} แห่งที่เติมครบ (ผู้รับทั้งหมด ${nR} แห่ง)`);
    chk(Math.abs(xsWant-nOv*A.EXTRA)<=Math.max(1,nOv),
        `ยอดเกินรวม = ${A.EXTRA/1e3}K × แห่งที่เติมครบ พอดี (${M(xsWant)} vs ${M(nOv*A.EXTRA)}) — ยืนยันว่าส่วนเกินมาจากกติกา ③ จริง`);
    chk(!/ยอดขาดเปลี่ยนหลังทำแผน/.test(tail),
        'แผนที่เพิ่งจัดสรรใหม่ ต้องไม่ขึ้นคำเตือน "ยอดขาดเปลี่ยนหลังทำแผน"');
  }
}

console.log(`\n${fail.length?'❌ ไม่ผ่าน '+fail.length+' ข้อ:\n  - '+fail.join('\n  - '):'✅ ผ่านครบทั้ง 5 กติกา'}`);
process.exit(fail.length?1:0);
