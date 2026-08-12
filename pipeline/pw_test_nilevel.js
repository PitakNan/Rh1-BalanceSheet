// ตรวจคอลัมน์ NI สะสม / NWC (ระดับ ณ เดือนเป้า) บนเบราว์เซอร์จริง — RISK_EXEC_MODEL.md 7.24
// รัน: NODE_PATH=<npm root -g> node pipeline/pw_test_nilevel.js [URL]
// ⚠️ ต้องใส่ ?t= กันแคช · อ่านจอด้วย innerText ไม่ใช่ textContent
const {chromium}=require('playwright');
const BASE=process.argv[2]||'https://pitaknan.github.io/Rh1-BalanceSheet/risk_drill.html';
let fail=[]; const chk=(c,m)=>{console.log('  '+(c?'✅':'❌')+' '+m); if(!c) fail.push(m)};
(async()=>{
  const b=await chromium.launch(); const errs=[];
  const p=await b.newPage(); p.on('pageerror',e=>errs.push(String(e)));
  await p.goto(`${BASE}?t=${Date.now()}#exec`,{waitUntil:'networkidle',timeout:90000});
  await p.waitForTimeout(4000);
  const txt=await p.evaluate(()=>document.body.innerText);
  chk(errs.length===0,'cold load #exec ไม่มี JS error'+(errs.length?' → '+errs[0]:''));
  chk(!/undefined|NaN/.test(txt),'ไม่มี undefined/NaN บนจอ');

  console.log('\n━━ หัวคอลัมน์ใหม่ ━━');
  const th=await p.evaluate(()=>[...document.querySelectorAll('#exResBox th')].map(t=>t.innerText.replace(/\s+/g,' ').trim()));
  const ni=th.filter(t=>t.startsWith('NI สะสม')), nw=th.filter(t=>t.startsWith('NWC ณ'));
  console.log('     '+ni.concat(nw).join('  |  '));
  chk(ni.length===1&&nw.length===1,'มีคอลัมน์ NI สะสม + NWC อย่างละ 1 ช่อง');
  chk(!th.some(t=>/^NI\s*\/เดือน/.test(t)),'ไม่มีคอลัมน์ "NI /เดือน" เหลืออยู่');

  console.log('\n━━ ค่าบนจอต้องตรงกับ sepBreak ที่ Solver ใช้ ━━');
  const r=await p.evaluate(()=>{
    const out=[]; 
    for(const h of EX.hosp.slice(0,103)){
      const b=exSimPath(h,0).sepBreak; if(!b) continue;
      out.push({n:h.name, ni:sgnM(b.ni), nwc:sgnM(b.nwc), niNow:sgnM(h.bs.ni), nwNow:sgnM(h.bs.ca-h.bs.cl)});
    }
    const rows=[...document.querySelectorAll('#exResBox tr')].filter(tr=>tr.querySelector('.ovtgl'));
    const ths=[...document.querySelectorAll('#exResBox th')].map(t=>t.innerText.replace(/\s+/g,' ').trim());
    const iNI=ths.findIndex(t=>t.startsWith('NI สะสม')), iNW=ths.findIndex(t=>t.startsWith('NWC ณ'));
    let bad=0, sample=null;
    rows.forEach(tr=>{
      const nm=tr.querySelector('b')?.innerText; const o=out.find(x=>x.n===nm); if(!o) return;
      const tds=tr.querySelectorAll('td');
      const a=tds[iNI].innerText.replace(/\s+/g,' '), c=tds[iNW].innerText.replace(/\s+/g,' ');
      if(!a.startsWith(o.ni)||!c.startsWith(o.nwc)) { bad++; if(!sample) sample=nm+': '+a+' | '+c+' ควรเป็น '+o.ni+' / '+o.nwc; }
      if(!a.includes('ปัจจุบัน')||!c.includes('ปัจจุบัน')) bad++;
    });
    return {n:rows.length, bad, sample, lab:exSepLab()};
  });
  console.log(`     ตรวจ ${r.n} แถว ณ ${r.lab}`);
  chk(r.bad===0,`ทุกแถว: ตัวใหญ่ = sepBreak + มีบรรทัดปัจจุบัน (ผิด ${r.bad})`+(r.sample?' → '+r.sample:''));

  console.log('\n━━ สลับเดือนเป้าแล้วหัวคอลัมน์+ตัวเลขต้องขยับ ━━');
  for(const mmo of [1,6]){
    const o=await p.evaluate(m=>{ EXST.mmo=m; exRender();
      const ths=[...document.querySelectorAll('#exResBox th')].map(t=>t.innerText.replace(/\s+/g,' ').trim());
      const i=ths.findIndex(t=>t.startsWith('NI สะสม'));
      const tr=[...document.querySelectorAll('#exResBox tr')].filter(x=>x.querySelector('.ovtgl'))[0];
      return {h:ths[i], v:tr.querySelectorAll('td')[i].innerText.replace(/\s+/g,' '), lab:exSepLab()};
    },mmo);
    console.log(`     ${mmo} ด. → ${o.lab} · หัว "${o.h}" · แถวแรก "${o.v}"`);
    chk(o.h.includes(o.lab),`หัวคอลัมน์ระบุเดือนเป้า ${o.lab}`);
  }
  const fy=await p.evaluate(()=>{ EXST.mmo=6; exRender();
    return document.querySelector('#exResBox').innerText.includes('เริ่มนับใหม่ปีงบหน้า'); });
  chk(fy,'เดือนเป้าข้ามปีงบ → ขึ้นป้าย "เริ่มนับใหม่ปีงบหน้า"');

  await b.close();
  console.log('\n━━ สรุป ━━');
  if(fail.length){console.log(`❌ ไม่ผ่าน ${fail.length} ข้อ`);process.exit(1)}
  console.log('✅ ผ่านทุกข้อบน URL จริง');
})();
