// ตรวจ ① badge "ระดับ ณ <เดือนเป้า> หลังช่วย" ต้องเปิดเป็น **ป็อปอัป** เหมือน badge "ก่อนช่วย"
//      ② แผง 🏦 เงินกองกลางเขตฯ ต้องอยู่เหนือตารางผลจำลอง และกางไว้ตั้งแต่เข้าหน้า
// (เจ้าของงานสั่ง 12 ส.ค. 69) — RISK_EXEC_MODEL.md 7.27
// รัน: NODE_PATH=<npm root -g> node pipeline/pw_test_brkpop.js [URL]
// ⚠️ ต้องใส่ ?t= กันแคช — goto() ไป URL เดิมที่ต่างแค่ #hash ไม่โหลดหน้าใหม่
// ⚠️ localStorage อาจมี EXST.sect.rg=false ค้างจากรอบก่อน → ล้างก่อนวัด "ค่าเริ่มต้น"
// 🪤 กับดัก: badge "ก่อนช่วย" (exWhyPop) กับ "หลังช่วย" (exBrkToggle) ใช้คลาส .brkbadge
//    เหมือนกันทั้งคู่ และ "ก่อนช่วย" มาก่อนในแถว → เลือกด้วยคลาสเฉย ๆ จะได้ตัวผิด
//    ต้องกรองด้วย [onclick^="exBrkToggle"] เสมอ
const {chromium}=require('playwright');
const BASE=process.argv[2]||'https://pitaknan.github.io/Rh1-BalanceSheet/risk_drill.html';
let fail=[]; const chk=(c,m)=>{console.log('  '+(c?'✅':'❌')+' '+m); if(!c) fail.push(m)};

(async()=>{
  const b=await chromium.launch();
  const errs=[];
  const p=await b.newPage();
  p.on('pageerror',e=>errs.push(String(e)));
  p.on('console',m=>{ if(m.type()==='error') errs.push('console: '+m.text()); });

  console.log('━━ ① cold load #exec (ล้าง localStorage ให้เป็นผู้ใช้ใหม่จริง) ━━');
  await p.goto(`${BASE}?t=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:90000});
  await p.evaluate(()=>localStorage.clear());
  await p.goto(`${BASE}?t=${Date.now()+1}#exec`,{waitUntil:'networkidle',timeout:90000});
  await p.waitForTimeout(4000);
  chk(errs.length===0,'ไม่มี JS error ตอน cold load'+(errs.length?' → '+errs.slice(0,2).join(' | '):''));

  console.log('\n━━ ② badge "หลังช่วย" → ป็อปอัป ━━');
  const before=await p.evaluate(()=>({
    ovsub:document.querySelectorAll('#exResBox tr.ovsub').length,
    ov:!!document.getElementById('exBrkOverlay')
  }));
  chk(before.ovsub===0,`ยังไม่กดอะไร ไม่มีแถวย่อยกางอยู่ (ได้ ${before.ovsub})`);

  const n=await p.locator('#exResBox .badge.brkbadge[onclick^="exBrkToggle"]').count();
  chk(n>0,`มี badge หลังช่วยให้กด ${n} ปุ่ม`);
  await p.locator('#exResBox .badge.brkbadge[onclick^="exBrkToggle"]').first().click();
  await p.waitForTimeout(700);

  const after=await p.evaluate(()=>{
    const ov=document.getElementById('exBrkOverlay');
    const vis=ov&&getComputedStyle(ov).display!=='none';
    return {
      vis:!!vis,
      modal:!!(ov&&ov.querySelector('.nip-modal')),
      brktbl:!!(ov&&ov.querySelector('table.brktbl')),
      head:!!(ov&&ov.querySelector('.brk-head')),
      lvl:ov?ov.querySelectorAll('.lvlbtn').length:0,
      txt:vis?ov.innerText:'',
      ovsub:document.querySelectorAll('#exResBox tr.ovsub').length,
      tblBrk:document.getElementById('exResBox').innerHTML.includes('brk-head')
    };
  });
  chk(after.vis,'ป็อปอัป #exBrkOverlay เปิดขึ้นจริง');
  chk(after.modal,'ใช้โครง .nip-modal ชุดเดียวกับป็อปอัป "ก่อนช่วย"');
  chk(after.brktbl&&after.head,'ในป็อปอัปมีตารางเกณฑ์ 7 คะแนนครบ');
  chk(after.lvl===8,`มีปุ่มเลือกระดับเป้า 0-7 ครบ (ได้ ${after.lvl})`);
  chk(after.ovsub===0&&!after.tblBrk,'ไม่กางเป็นแถวใต้ตารางอีกแล้ว (ตารางไม่กระโดด)');
  chk(!/undefined|NaN/.test(after.txt),'ไม่มี undefined/NaN ในป็อปอัป');

  console.log('\n━━ ③ เปลี่ยนระดับเป้าในป็อปอัป แล้วยังเปิดอยู่ ━━');
  await p.locator('#exBrkOverlay .lvlbtn').nth(3).click();
  await p.waitForTimeout(600);
  const lv=await p.evaluate(()=>{
    const ov=document.getElementById('exBrkOverlay');
    return {vis:ov&&getComputedStyle(ov).display!=='none',
            on:ov?[...ov.querySelectorAll('.lvlbtn.on')].map(b=>b.dataset.l):[],
            brk:JSON.parse(JSON.stringify(EXBRK))};
  });
  chk(lv.vis,'กดเปลี่ยนระดับแล้วป็อปอัปยังเปิดอยู่ (ไม่กระพริบปิด)');
  chk(lv.on.length===1&&lv.on[0]==='3',`ปุ่มระดับ 3 ถูกไฮไลต์ (ได้ ${lv.on.join(',')||'ไม่มี'})`);
  chk(Object.values(lv.brk)[0]===3,'EXBRK อัปเดตตามระดับที่เลือก');

  console.log('\n━━ ④ ปิดป็อปอัป ━━');
  await p.locator('#exBrkOverlay .tgt-apply').click();
  await p.waitForTimeout(400);
  const cl=await p.evaluate(()=>{
    const ov=document.getElementById('exBrkOverlay');
    return {vis:ov&&getComputedStyle(ov).display!=='none', brk:Object.keys(EXBRK).length};
  });
  chk(!cl.vis,'กดปิดแล้วป็อปอัปหายจริง');
  chk(cl.brk===0,'EXBRK ถูกล้าง (badge ไม่ค้างสถานะเปิด)');

  console.log('\n━━ ⑤ แผง 🏦 เงินกองกลางเขตฯ อยู่เหนือตารางผลจำลอง + กางไว้ ━━');
  const rg=await p.evaluate(()=>{
    const a=document.getElementById('exRgBox'), c=document.getElementById('exResBox');
    if(!a||!c) return null;
    const sec=a.querySelector('.exsec');
    return {
      before:!!(a.compareDocumentPosition(c)&Node.DOCUMENT_POSITION_FOLLOWING),
      open:!!(sec&&sec.classList.contains('on')),
      gapY:Math.round(c.getBoundingClientRect().top-a.getBoundingClientRect().top),
      txt:a.innerText
    };
  });
  chk(rg&&rg.before,'แผง 🏦 อยู่ "ก่อน" ตารางผลจำลองในหน้า');
  chk(rg&&rg.open,'แผง 🏦 กางไว้ตั้งแต่เข้าหน้า (ไม่ต้องไปกดหา)');
  chk(rg&&rg.gapY>0&&rg.gapY<2500,`อยู่ในระยะสายตาเดียวกับตาราง (ห่าง ${rg?rg.gapY:'-'} px)`);
  chk(rg&&/ดึงจากก้อนของ/.test(rg.txt),'เมนูสั่งโอน "ดึงจากก้อนของ → เติมให้" อยู่ในแผง');
  chk(rg&&!/undefined|NaN/.test(rg.txt),'ไม่มี undefined/NaN ในแผง 🏦');

  console.log('\n━━ สรุป ━━');
  console.log(fail.length?`❌ ไม่ผ่าน ${fail.length} ข้อ:\n  - `+fail.join('\n  - '):'✅ ผ่านทุกข้อ');
  await b.close();
  process.exit(fail.length?1:0);
})();
