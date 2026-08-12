// ตรวจหัวข้อ ⑤ "สายเงินจริง" ในป็อปอัป badge ระดับก่อนช่วย บนเบราว์เซอร์จริง
// (คู่กับ test_exec_why.js ⑦ ที่พิสูจน์ตัวเลข) · เจ้าของงานสั่ง 13 ส.ค. 69 — RISK_EXEC_MODEL.md 7.31
// รัน: NODE_PATH=<npm root -g> node pipeline/pw_test_whychain.js [URL]
// ⚠️ ต้องใส่ ?t= กันแคช · 🪤 ห้ามผูกดัชนีคอลัมน์ ให้จับด้วย onclick^="exWhyPop"
const {chromium}=require('playwright');
const BASE=process.argv[2]||'https://pitaknan.github.io/Rh1-BalanceSheet/risk_drill.html';
let fail=[]; const chk=(c,m)=>{console.log('  '+(c?'✅':'❌')+' '+m); if(!c) fail.push(m)};

(async()=>{
  const b=await chromium.launch();
  const errs=[]; const p=await b.newPage();
  p.on('pageerror',e=>errs.push(String(e)));
  p.on('console',m=>{ if(m.type()==='error') errs.push('console: '+m.text()); });

  console.log('━━ ① cold load #exec ━━');
  await p.goto(`${BASE}?t=${Date.now()}#exec`,{waitUntil:'networkidle',timeout:90000});
  await p.waitForTimeout(4000);
  chk(errs.length===0,'ไม่มี JS error ตอน cold load'+(errs.length?' → '+errs.slice(0,2).join(' | '):''));

  const badges=await p.$$('span[onclick^="exWhyPop"]');
  chk(badges.length>0,`badge ก่อนช่วยคลิกได้ ${badges.length} แห่ง`);

  console.log('\n━━ ② เปิดแล้วมีหัวข้อ ⑤ ครบองค์ประกอบ ━━');
  await badges[0].click(); await p.waitForTimeout(600);
  const ov='#exWhyOverlay';
  chk(await p.isVisible(ov),'ป็อปอัปเปิดขึ้นจริง');
  const t=await p.textContent(ov);
  for(const [re,lab] of [[/อีกวิธีวัด/,'หัวข้อ ⑤'],[/สายเงินจริง/,'คำว่าสายเงินจริง'],
      [/ภาระ MOE \d+ เดือน/,'บรรทัดภาระ MOE พร้อมจำนวนเดือน'],
      [/เงินสดคงเหลือหลังภาระ MOE/,'บรรทัดปิดสายเลขคณิต'],
      [/ห่างจากเกณฑ์/,'ตารางเกณฑ์ (exCmpTable)'],
      [/ไม่ต้องตรงกับระดับ/,'คำเตือนว่าไม่ต้องตรงกับระดับก่อนช่วย']])
    chk(re.test(t),'มี'+lab);
  chk(!/undefined|NaN/.test(t),'ไม่มี undefined/NaN บนจอ');

  // ระดับ 2 badge แรกของหัวข้อ ⑤ ต้องตรงกับ scoreOf(exChainBS) ที่คำนวณสด ๆ ในหน้า
  const same=await p.evaluate(()=>{
    const el=document.querySelector('#exWhyOverlay'); const html=el.innerHTML;
    const i=html.indexOf('อีกวิธีวัด'); if(i<0) return 'ไม่พบหัวข้อ';
    const got=[...html.slice(i).matchAll(/class="badge"[^>]*>(\d+|–)</g)].map(m=>m[1]).slice(0,2);
    const hc=document.querySelector('span[onclick^="exWhyPop"]').getAttribute('onclick').match(/'(\d+)'/)[1];
    const h=EX.hosp.find(x=>x.hcode===hc), C=exChainBS(h);
    const want=[exTjScore(C.b0).risk, exTjScore(C.bS).risk].map(String);
    return got.join(',')===want.join(',') ? 'ok' : `บนจอ ${got} ควรเป็น ${want}`;
  });
  chk(same==='ok','ระดับบนจอ = scoreOf(exChainBS) สด ๆ ในหน้า'+(same==='ok'?'':' → '+same));

  console.log('\n━━ ③ ปิดได้ทุกทาง + คลิกในกล่องไม่ปิด ━━');
  await p.click(`${ov} .nip-modal`); await p.waitForTimeout(200);
  chk(await p.isVisible(ov),'คลิกในกล่องแล้วไม่ปิด');
  await p.click(`${ov} .tgt-apply`); await p.waitForTimeout(300);
  chk(!(await p.isVisible(ov)),'ปุ่ม ✕ ปิดได้');
  await (await p.$$('span[onclick^="exWhyPop"]'))[0].click(); await p.waitForTimeout(400);
  await p.mouse.click(5,5); await p.waitForTimeout(300);
  chk(!(await p.isVisible(ov)),'คลิกพื้นหลังปิดได้');

  console.log('\n━━ ④ มือถือ 390px ต้องไม่ล้นจอ ━━');
  const m=await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  await m.goto(`${BASE}?t=${Date.now()}#exec`,{waitUntil:'networkidle',timeout:90000});
  await m.waitForTimeout(4000);
  await (await m.$$('span[onclick^="exWhyPop"]'))[0].click(); await m.waitForTimeout(600);
  const w=await m.evaluate(()=>{ const el=document.querySelector('#exWhyOverlay .nip-modal');
    return {box:el.getBoundingClientRect().width, doc:document.documentElement.scrollWidth}; });
  chk(w.box<=390,`กล่องกว้าง ${Math.round(w.box)}px ไม่ล้นจอ 390px`);
  chk(w.doc<=395,`หน้าไม่เลื่อนแนวนอน (scrollWidth ${w.doc}px)`);

  await b.close();
  console.log('\n━━ สรุป ━━');
  if(fail.length){ console.log(`❌ ไม่ผ่าน ${fail.length} ข้อ`); fail.forEach(f=>console.log('   '+f)); process.exit(1); }
  console.log('✅ ผ่านทุกข้อ');
})();
