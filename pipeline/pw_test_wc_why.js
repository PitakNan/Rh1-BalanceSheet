// ตรวจบรรทัดเงินทุนหมุนเวียน + ป็อปอัป "ทำไมระดับถึงเปลี่ยน" บนเบราว์เซอร์จริง (7.25 + 7.26)
// รัน: NODE_PATH=<npm root -g> node pipeline/pw_test_wc_why.js [URL]
// ⚠️ ต้องใส่ ?t= กันแคช · อ่านจอด้วย innerText
const {chromium}=require('playwright');
const BASE=process.argv[2]||'https://pitaknan.github.io/Rh1-BalanceSheet/risk_drill.html';
let fail=[]; const chk=(c,m)=>{console.log('  '+(c?'✅':'❌')+' '+m); if(!c) fail.push(m)};
(async()=>{
  const b=await chromium.launch(); const errs=[];
  const p=await b.newPage(); p.on('pageerror',e=>errs.push(String(e)));
  await p.goto(`${BASE}?t=${Date.now()}#exec`,{waitUntil:'networkidle',timeout:90000});
  await p.waitForTimeout(4500);
  chk(errs.length===0,'cold load #exec ไม่มี error'+(errs.length?' → '+errs[0]:''));

  console.log('\n━━ ① บรรทัดเงินทุนหมุนเวียนถึงหน้าเว็บ ━━');
  const wc=await p.evaluate(()=>{
    const n=EX.hosp.filter(h=>Array.isArray(h.bs.arProf)&&Array.isArray(h.bs.invProf)).length;
    let ar=0,inv=0; EXST.mmo=2; exRender();
    for(const h of EX.hosp){const r=exSimPath(h,0); ar+=r.wcAR; inv+=r.wcINV;}
    return {n,tot:EX.hosp.length,ar:ar/1e6,inv:inv/1e6};
  });
  console.log(`     arProf/invProf ครบ ${wc.n}/${wc.tot} · ย้ายเข้าลูกหนี้ ${wc.ar.toFixed(0)} ลบ. · สินค้าคงเหลือ ${wc.inv.toFixed(0)} ลบ.`);
  chk(wc.n===wc.tot,'มีโปรไฟล์ลูกหนี้/สินค้าคงเหลือครบทุกแห่ง');
  chk(Math.abs(wc.ar)>1,'บรรทัดเงินทุนหมุนเวียนทำงานจริง (ไม่ใช่ 0)');

  console.log('\n━━ ② สามอัตราส่วนต้องแยกจากกันได้แล้ว ━━');
  const sp=await p.evaluate(()=>{
    let same=0,diff=0;
    for(const h of EX.hosp){
      const b=exSimPath(h,0).sepBreak; if(!b) continue;
      const g0=(h.bs.ca-h.bs.qn)/h.bs.cl, g1=b.cr-b.qr;   // ช่องว่าง CR−QR ณ ต้น/ปลาย
      (Math.abs(g1-g0)<1e-9?same++:diff++);
    }
    return {same,diff};
  });
  console.log(`     ช่องว่าง CR−QR เปลี่ยนไป ${sp.diff} แห่ง · เท่าเดิม ${sp.same} แห่ง`);
  chk(sp.diff>0,'ช่องว่างระหว่าง CR กับ QR เปลี่ยนได้แล้ว (ของเดิมตรึงตายตัวทุกแห่ง)');

  console.log('\n━━ ③ ป็อปอัป "ทำไมระดับถึงเปลี่ยน" ━━');
  const badge=await p.evaluate(()=>{
    const ths=[...document.querySelectorAll('#exResBox th')].map(t=>t.innerText.replace(/\s+/g,' ').trim());
    const i=ths.findIndex(t=>t.includes('ก่อนช่วย'));
    const tr=[...document.querySelectorAll('#exResBox tr')].filter(x=>x.querySelector('.ovtgl'))[0];
    const el=tr.querySelectorAll('td')[i].querySelector('.badge');
    return {has:!!(el&&el.getAttribute('onclick')||'').includes?!!el:false, name:tr.querySelector('b').innerText, i};
  });
  console.log(`     แถวแรก: ${badge.name} · คอลัมน์ที่ ${badge.i}`);
  await p.evaluate(i=>{
    const tr=[...document.querySelectorAll('#exResBox tr')].filter(x=>x.querySelector('.ovtgl'))[0];
    tr.querySelectorAll('td')[i].querySelector('.badge').click();
  }, badge.i);
  await p.waitForTimeout(1200);
  const pop=await p.evaluate(()=>{
    const el=document.getElementById('exWhyOverlay');
    return el?{shown:el.style.display==='flex', t:el.innerText.replace(/\s+/g,' ')}:null;
  });
  chk(pop&&pop.shown,'คลิก badge ก่อนช่วยแล้วป็อปอัปเปิดจริง');
  if(pop){
    for(const s of ['ทำไมระดับถึงเปลี่ยน','ปัจจัยที่ทำให้เปลี่ยนระหว่างทาง','มาตรการที่เลือกอยู่','เติมเงินให้พอจ่าย MOE','ผลลัพธ์ ณ'])
      chk(pop.t.includes(s),`มีหัวข้อ "${s}"`);
    chk(!/undefined|NaN/.test(pop.t),'ไม่มี undefined/NaN ในป็อปอัป');
    console.log('     ตัวอย่าง: '+pop.t.slice(0,190));
  }
  const st=await p.evaluate(()=>({seas:EXST.seas,cl:EXST.clGrow}));
  chk(st.seas!==false&&st.cl!==false,'สถานะหน้าไม่ค้างเป็นปิดปัจจัยหลังเปิดป็อปอัป');

  console.log('\n━━ ④ มือถือ ━━');
  const p2=await b.newPage({viewport:{width:390,height:844},colorScheme:'dark'});
  const e2=[]; p2.on('pageerror',e=>e2.push(String(e)));
  await p2.goto(`${BASE}?t=${Date.now()}#exec`,{waitUntil:'networkidle',timeout:90000});
  await p2.waitForTimeout(3500);
  chk(e2.length===0,'มือถือ+ธีมมืดโหลดผ่าน');
  chk(!(await p2.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+2)),'ไม่ปัดออกด้านข้าง');

  await b.close();
  console.log('\n━━ สรุป ━━');
  if(fail.length){console.log(`❌ ไม่ผ่าน ${fail.length} ข้อ`);process.exit(1)}
  console.log('✅ ผ่านทุกข้อบน URL จริง');
})();
