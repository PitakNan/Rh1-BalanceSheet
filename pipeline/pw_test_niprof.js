// ตรวจโปรไฟล์ NI รายเดือน (niProf) บนเบราว์เซอร์จริง — RISK_EXEC_MODEL.md 7.22
// รัน: NODE_PATH=<npm root -g> node pipeline/pw_test_niprof.js [URL]
// ค่าเริ่มต้นยิงไป GitHub Pages · ใส่ URL เองได้ถ้าจะทดสอบ localhost ก่อน push
// ⚠️ ต้องใส่ ?t= กันแคช — goto() ไป URL เดิมที่ต่างแค่ #hash ไม่โหลดหน้าใหม่
// ⚠️ อ่านจอด้วย innerText ไม่ใช่ textContent — textContent ดูดซอร์ส <script> มาด้วย (เจอ isNaN แล้วฟ้องผิด)
const {chromium}=require('playwright');
const BASE=process.argv[2]||'https://pitaknan.github.io/Rh1-BalanceSheet/risk_drill.html';
let fail=[]; const chk=(c,m)=>{console.log('  '+(c?'✅':'❌')+' '+m); if(!c) fail.push(m)};

(async()=>{
  const b=await chromium.launch();
  const errs=[];
  const p=await b.newPage();
  p.on('pageerror',e=>errs.push(String(e)));
  p.on('console',m=>{ if(m.type()==='error') errs.push('console: '+m.text()); });

  console.log('━━ ① cold load ตรงไปที่ #exec (กัน cache ด้วย ?t=) ━━');
  await p.goto(`${BASE}?t=${Date.now()}#exec`,{waitUntil:'networkidle',timeout:90000});
  await p.waitForTimeout(4000);

  const body=await p.evaluate(()=>document.body.innerText);
  chk(body.includes('แนวทางสำหรับผู้บริหาร')||body.includes('ผลจำลอง'),'แท็บผู้บริหารเรนเดอร์จริง (ไม่ว่างเปล่า)');
  chk(errs.length===0,'ไม่มี JS error ตอน cold load'+(errs.length?' → '+errs.slice(0,2).join(' | '):''));
  chk(!/undefined|NaN/.test(body.replace(/undefined-/g,'')),'ไม่มี undefined/NaN โผล่บนหน้าจอ');

  console.log('\n━━ ② โปรไฟล์ NI ถึงหน้าเว็บจริง ━━');
  const st=await p.evaluate(()=>{
    const n=EX.hosp.filter(h=>Array.isArray(h.bs.niProf)&&h.bs.niProf.length===12).length;
    const tot=new Array(12).fill(0);
    EX.hosp.forEach(h=>(h.bs.niProf||[]).forEach((v,i)=>tot[i]+=v));
    return {n,total:EX.hosp.length,oct:tot[0],aug:tot[10],sum:tot.reduce((a,b)=>a+b,0)};
  });
  chk(st.n===st.total,`exec.json บนเว็บมี niProf ครบ (${st.n}/${st.total})`);
  chk(st.oct>0&&st.aug<0,`ทิศทางถูก: ต.ค. +${(st.oct/1e6).toFixed(0)} ลบ. · ส.ค. ${(st.aug/1e6).toFixed(0)} ลบ.`);
  chk(Math.abs(st.sum)<1e6,'ผลรวม 12 เดือน = 0 (กระจายตัว ไม่เพิ่มยอดทั้งปี)');

  console.log('\n━━ ③ ป้ายสวิตช์เปลี่ยนเป็น "ทิศทาง NI รายเดือน" ━━');
  chk(body.includes('ทิศทาง NI รายเดือน'),'ป้ายใหม่ขึ้นบนหน้าเว็บ');
  chk(!body.includes('📉 ฤดูกาลปลายปีงบ'),'ป้ายเดิมไม่เหลือค้าง');

  console.log('\n━━ ④ สลับเดือนเป้าแล้วเงินสนับสนุนต้องขยับตามโปรไฟล์ ━━');
  const need=async mmo=>p.evaluate(m=>{
    EXST.mmo=m; exRender();
    return EX.hosp.reduce((s,h)=>{const v=exSolveFor(h,6); return s+(v||0)},0)/1e6;
  },mmo);
  const n1=await need(1), n2=await need(2), n3=await need(3), n13=await need(13);
  console.log(`     1 ด.(ส.ค.)=${n1.toFixed(2)} · 2 ด.(ก.ย.)=${n2.toFixed(2)} · 3 ด.(ต.ค.)=${n3.toFixed(2)} · 13 ด.=${n13.toFixed(2)} ลบ.`);
  chk(Math.abs(n2-104.35)<0.05,`ค่าเริ่มต้น (ก.ย.) = 104.35 ลบ. ตามที่วัดในเครื่อง (ได้ ${n2.toFixed(2)})`);
  chk(n1>n2,'ส.ค. ต้องแพงกว่า ก.ย. — ส.ค. เป็นเดือนแย่สุดของปี');
  chk(Math.abs(n13-293.55)<0.05,`13 ด. = 293.55 ลบ. (ได้ ${n13.toFixed(2)})`);

  console.log('\n━━ ⑤ ปิดสวิตช์แล้วตัวเลขต้องลดลง (โปรไฟล์ทำงานจริง) ━━');
  const off=await p.evaluate(()=>{
    EXST.mmo=2; EXST.seas=false; exRender();
    const s=EX.hosp.reduce((a,h)=>{const v=exSolveFor(h,6); return a+(v||0)},0)/1e6;
    EXST.seas=true; exRender(); return s;
  });
  console.log(`     ปิดทิศทาง NI: ${off.toFixed(2)} ลบ. · เปิด: ${n2.toFixed(2)} ลบ.`);
  chk(off<n2,'ปิดแล้วต้องต่ำกว่า = โปรไฟล์มีผลจริง ไม่ใช่ no-op');

  console.log('\n━━ ⑥ มือถือ + ธีมมืด ━━');
  const p2=await b.newPage({viewport:{width:390,height:844}, colorScheme:'dark'});
  const errs2=[]; p2.on('pageerror',e=>errs2.push(String(e)));
  await p2.goto(`${BASE}?t=${Date.now()}#exec`,{waitUntil:'networkidle',timeout:90000});
  await p2.waitForTimeout(3500);
  const b2=await p2.evaluate(()=>document.body.innerText);
  chk(errs2.length===0 && b2.includes('ทิศทาง NI รายเดือน'),'มือถือ+ธีมมืด cold load #exec ผ่าน');
  const hscroll=await p2.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+2);
  chk(!hscroll,'หน้าไม่ปัดออกด้านข้างบนมือถือ');

  await b.close();
  console.log('\n━━ สรุป ━━');
  if(fail.length){console.log(`❌ ไม่ผ่าน ${fail.length} ข้อ`); process.exit(1)}
  console.log('✅ ผ่านทุกข้อบน URL จริง');
})();
