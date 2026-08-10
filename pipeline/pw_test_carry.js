// ตรวจแถบ "ยกแผนข้ามงวด" บนเบราว์เซอร์จริง
// จำลองงวดขยับด้วยการ seed แผนไว้ที่คีย์งวดก่อนหน้า (256908) แล้วเปิดหน้าที่ข้อมูลเป็น 256909
const {chromium}=require('playwright');
const URL=process.argv[2]||'http://localhost:8899/risk_drill.html';
const errs=[], net404=[];
let _n=0;
// ⚠️ goto ไป URL เดิมที่ต่างแค่ hash = same-document navigation ไม่โหลดหน้าใหม่
// ต้องใส่ query กันแคชทุกครั้ง ไม่งั้นโค้ด init (exLoad) ไม่ได้รันซ้ำแล้วเข้าใจผิดว่าฟีเจอร์พัง
const hardGo=async pg=>{ await pg.goto(URL+'?t='+(++_n)+'#exec',{waitUntil:'networkidle'}); };
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext();
  let p=await ctx.newPage();
  p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
  p.on('response',r=>{ if(r.status()>=400) net404.push(r.status()+' '+r.url()); });

  // ── ① ไม่มีแผนงวดเก่า → ต้องไม่มีแถบมารบกวน ─────────────────────────────────
  await hardGo(p);
  await p.waitForSelector('#exResBox table',{timeout:20000});
  const per=await p.evaluate(()=>({p:EX.period,l:EX.periodLabel}));
  console.log(`งวดข้อมูลบนหน้า: ${per.l} ${per.p}`);
  console.log(`① ไม่มีแผนงวดเก่า → แถบ: ${await p.locator('.excarry').count()} (ต้อง 0)`);

  // ── ② seed แผนของงวดก่อนหน้า แล้วโหลดใหม่ ───────────────────────────────────
  const seeded=await p.evaluate(prev=>{
    // ทำแผนจริงด้วยปุ่ม ⚡ ก่อน แล้วย้ายไปเก็บใต้คีย์งวดก่อนหน้า + ลบคีย์งวดนี้ทิ้ง
    exXferAuto();
    const st=JSON.parse(localStorage.getItem('rh1-exec-'+EX.period));
    localStorage.removeItem('rh1-exec-'+EX.period);
    localStorage.setItem('rh1-exec-'+prev, JSON.stringify(st));
    return {n:st.xfer.length, sum:st.xfer.reduce((s,x)=>s+x.a,0)};
  }, 256908);
  console.log(`   seed แผนงวด 256908: ${seeded.n} รายการ ${(seeded.sum/1e6).toFixed(1)}M`);
  await hardGo(p);
  await p.waitForSelector('.excarry',{timeout:20000});
  console.log('② แถบเสนอ:', (await p.locator('.excarry').innerText()).replace(/\s+/g,' ').slice(0,200));
  const before=await p.evaluate(()=>exXferList().length);
  console.log(`   ยังไม่ยกมาให้เอง: xfer = ${before} (ต้อง 0)`);

  // ── ③ กดปุ่มยกแผนมาใช้ต่อ ───────────────────────────────────────────────────
  await p.locator('.excarry button.tgt-apply').click();
  await p.waitForSelector('.excarry.done',{timeout:20000});
  const rep=(await p.locator('.excarry.done').innerText()).replace(/\s+/g,' ');
  console.log('③ รายงานหลังยก:', rep.slice(0,300));
  const after=await p.evaluate(()=>({n:exXferList().length, sum:exXferList().reduce((s,x)=>s+x.a,0)}));
  console.log(`   ยกมาแล้ว: ${after.n} รายการ ${(after.sum/1e6).toFixed(1)}M (ต้องเท่า seed)`);
  // บรรทัดสรุปบนหน้าต้องเปลี่ยนจาก "ยังไม่ได้โยก" เป็น "โยกแล้ว" = หน้าจอรับรู้แผนที่ยกมาจริง
  const sumLine=await p.evaluate(()=>(document.body.innerText.split(/\n/).find(l=>l.includes('แผนโยกเงินช่วยกัน'))||''));
  console.log(`   บรรทัดสรุปหลังยก: ${sumLine.slice(0,60)} (ต้องมีคำว่า "โยกแล้ว")`);

  // ── ④ รีโหลด — ต้องไม่ถามซ้ำ และแผนต้องอยู่ ─────────────────────────────────
  await hardGo(p);
  await p.waitForSelector('#exResBox table',{timeout:20000});
  console.log(`④ รีโหลด → แถบเสนอ: ${await p.locator('.excarry').count()} (ต้อง 0) · xfer คงอยู่: ${await p.evaluate(()=>exXferList().length)}`);

  // ── ⑤ ปุ่ม "เริ่มใหม่จากงวดนี้" ────────────────────────────────────────────────
  await p.evaluate(prev=>{
    const st=JSON.parse(localStorage.getItem('rh1-exec-'+EX.period));
    localStorage.removeItem('rh1-exec-'+EX.period);
    localStorage.setItem('rh1-exec-'+prev, JSON.stringify(st));
  },256908);
  await hardGo(p);
  await p.waitForSelector('.excarry',{timeout:20000});
  await p.locator('.excarry button.ovbulkbtn').click();
  await p.waitForTimeout(600);
  console.log(`⑤ กดเริ่มใหม่ → แถบ: ${await p.locator('.excarry').count()} (ต้อง 0) · xfer: ${await p.evaluate(()=>exXferList().length)} (ต้อง 0)`);
  await hardGo(p);
  await p.waitForSelector('#exResBox table',{timeout:20000});
  console.log(`   รีโหลดอีกรอบ ไม่ถามซ้ำ: ${await p.locator('.excarry').count()} (ต้อง 0)`);

  // ── ⑥ มือถือ + ธีมมืด ───────────────────────────────────────────────────────
  const m=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const mp=await m.newPage();
  mp.on('console',x=>{ if(x.type()==='error') errs.push('[mobile] '+x.text()); });
  await mp.goto(URL,{waitUntil:'networkidle'});
  await mp.evaluate(prev=>{ localStorage.setItem('rh1-theme','dark');
    localStorage.setItem('rh1-exec-'+prev, JSON.stringify({xfer:[{f:'11138',t:'11139',a:5000000}],arOvr:{},types:{},tj:{},open:{}})); },256908);
  await hardGo(mp);
  await mp.waitForSelector('.excarry',{timeout:20000});
  const box=await mp.locator('.excarry').boundingBox();
  const bw=await mp.evaluate(()=>document.documentElement.scrollWidth);
  console.log(`⑥ มือถือ+ธีมมืด: แถบกว้าง ${Math.round(box.width)}px · หน้ากว้าง ${bw}px (ต้องไม่เกิน 390) · ปุ่มครบ ${await mp.locator('.excarry button').count()}`);
  await mp.screenshot({path:process.argv[3]||'carry_mobile.png',fullPage:false});

  // ── ⑦ Watchlist: แผนจัดสรรรายแห่ง (rh1-ovplan-) ต้องยกข้ามงวดได้เหมือนกัน ──────
  const w=await ctx.newPage();
  await w.goto(URL+'?w=0',{waitUntil:'networkidle'});
  await w.evaluate(prev=>localStorage.setItem('rh1-ovplan-'+prev,
    JSON.stringify({tgt:5, plans:{'11138':{method:'acp',alpha:50,acp:1e7,acpMonth:2,debt:0},
                                  '11139':{method:'auto',alpha:50,acp:0,acpMonth:2,debt:3e6}}})), 256908);
  await w.goto(URL+'?w=1',{waitUntil:'networkidle'});
  await w.waitForSelector('#ovBody .excarry',{timeout:30000});
  console.log('⑦ Watchlist แถบเสนอ:', (await w.locator('#ovBody .excarry').innerText()).replace(/\s+/g,' ').slice(0,150));
  await w.locator('#ovBody .excarry button.tgt-apply').click();
  await w.waitForTimeout(1500);
  console.log(`   ยกแล้ว → แถบ ${await w.locator('#ovBody .excarry').count()} (ต้อง 0) · แผน ${await w.evaluate(()=>Object.keys(OV_PLAN).length)} แห่ง · เป้า ${await w.evaluate(()=>OV_TGT)} (ต้อง 5)`);
  await w.goto(URL+'?w=2',{waitUntil:'networkidle'});
  await w.waitForSelector('#ovBody',{timeout:30000});
  await w.waitForTimeout(2500);
  console.log(`   รีโหลด → ไม่ถามซ้ำ: ${await w.locator('#ovBody .excarry').count()} (ต้อง 0)`);

  // ── ⑧ NaN / undefined หลุดจอไหม ─────────────────────────────────────────────
  const bad=await p.evaluate(()=>{ const t=document.body.innerText; return (t.match(/NaN|undefined/g)||[]).length; });
  console.log(`⑧ NaN/undefined บนจอ: ${bad} · console error: ${errs.length} · network>=400: ${net404.length}`);
  if(errs.length) console.log('   errors:', errs.slice(0,5));
  if(net404.length) console.log('   net:', net404.slice(0,5));
  await b.close();
})().catch(e=>{ console.error('FAIL', e); process.exit(1); });
