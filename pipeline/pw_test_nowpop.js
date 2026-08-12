// ตรวจป็อปอัป "Risk Score ณ ปัจจุบัน" (คลิก badge คอลัมน์ "ระดับ ณ ปัจจุบัน")
// เจ้าของงานสั่ง 12 ส.ค. 69 — RISK_EXEC_MODEL.md 7.29
// รัน: NODE_PATH=<npm root -g> node pipeline/pw_test_nowpop.js [URL]
//
// หัวใจของชุดนี้ = **พิสูจน์ตัวเลขระยะห่างว่าจริง** ไม่ใช่แค่ดูว่าป็อปอัปเปิดได้:
//   ① เติมเงิน = ยอดที่ขาดมากสุด → ต้องผ่านทุกเกณฑ์ (li=0, st=0) ทุกแห่ง
//   ② เติมน้อยกว่านั้นนิดเดียว → ต้องยังไม่ผ่าน (พิสูจน์ว่าเป็นค่าต่ำสุดจริง ไม่ใช่เผื่อไว้เยอะ)
//   ③ ช่องที่บอก "ผ่านแล้วเกิน X" → ถอย X ออกต้องยังผ่าน แต่ถอยเกินนั้นต้องตก
// ⚠️ ต้องใส่ ?t= กันแคช · 🪤 badge หลายคอลัมน์ใช้คลาส .brkbadge เหมือนกัน ต้องกรองด้วย onclick
const {chromium}=require('playwright');
const BASE=process.argv[2]||'https://pitaknan.github.io/Rh1-BalanceSheet/risk_drill.html';
let fail=[]; const chk=(c,m)=>{console.log('  '+(c?'✅':'❌')+' '+m); if(!c) fail.push(m)};

(async()=>{
  const b=await chromium.launch();
  const errs=[];
  const p=await b.newPage();
  p.on('pageerror',e=>errs.push(String(e)));
  p.on('console',m=>{ if(m.type()==='error') errs.push('console: '+m.text()); });

  console.log('━━ ① cold load #exec ━━');
  await p.goto(`${BASE}?t=${Date.now()}#exec`,{waitUntil:'networkidle',timeout:90000});
  await p.waitForTimeout(4000);
  chk(errs.length===0,'ไม่มี JS error ตอน cold load'+(errs.length?' → '+errs.slice(0,2).join(' | '):''));

  console.log('\n━━ ② badge "ระดับ ณ ปัจจุบัน" กดได้ → ป็อปอัป ━━');
  const n=await p.locator('#exResBox .badge[onclick^="exNowPop"]').count();
  chk(n>0,`badge ระดับปัจจุบันกดได้ ${n} ปุ่ม`);
  await p.locator('#exResBox .badge[onclick^="exNowPop"]').first().click();
  await p.waitForTimeout(700);
  const o=await p.evaluate(()=>{
    const ov=document.getElementById('exNowOverlay');
    const vis=ov&&getComputedStyle(ov).display!=='none';
    return {vis:!!vis, modal:!!(ov&&ov.querySelector('.nip-modal')),
            rows:ov?ov.querySelectorAll('table.gaptbl tr').length:0,
            txt:vis?ov.innerText:''};
  });
  chk(o.vis&&o.modal,'ป็อปอัป #exNowOverlay เปิดด้วยโครง .nip-modal เดียวกับตัวอื่น');
  chk(o.rows===7,`ตารางมีหัว 1 + เกณฑ์ 5 + SU 1 = 7 แถว (ได้ ${o.rows})`);
  chk(/ขาด|เกิน/.test(o.txt),'มีคอลัมน์ระยะห่างบอก "ขาด/เกิน" เป็นบาท');
  chk(/ห้ามบวก/.test(o.txt),'มีคำเตือนห้ามบวก 5 บรรทัดรวมกัน');
  chk(!/undefined|NaN/.test(o.txt),'ไม่มี undefined/NaN ในป็อปอัป');

  console.log('\n━━ ③ 🔬 พิสูจน์ตัวเลข: เติม "ยอดที่ขาดมากสุด" แล้วต้องผ่านครบทุกแห่ง ━━');
  const v=await p.evaluate(()=>{
    const out={n:0, badAll:[], badMin:[], badSurp:[], nAll:0, nPass:0, maxNeed:0};
    for(const h of EX.hosp){
      const bs=h.bs; if(!bs.cl) continue;
      out.n++;
      const b={ca:bs.ca,cl:bs.cl,qn:bs.qn,cn:bs.cn,ni:bs.ni,mo:bs.mo};
      const gaps=EX_NOW_ROWS.map(c=>c.gap(b));
      const worst=Math.max(0,...gaps.map(g=>-g));
      // เงินก้อน X ดัน ca/qn/cn/ni ขึ้นเท่ากัน (ตรงกับที่ป็อปอัปเขียนไว้)
      const at=X=>scoreOf(b.ca+X,b.cl,b.qn+X,b.cn+X,b.ni+X,b.mo);
      if(worst>0){
        out.nAll++;
        out.maxNeed=Math.max(out.maxNeed,worst);
        const s=at(worst);
        if(!(s.li===0&&s.st===0)) out.badAll.push(`${h.name} เติม ${(worst/1e6).toFixed(2)} ลบ. แล้วยังได้ li=${s.li} st=${s.st}`);
        // ต่ำกว่านั้น 10,000 บาท ต้องยังไม่ผ่านครบ = เป็นค่าต่ำสุดจริง
        const s2=at(Math.max(0,worst-10000));
        if(s2.li===0&&s2.st===0) out.badMin.push(`${h.name} เติมน้อยกว่า 10K ก็ผ่านครบแล้ว = ยอดที่บอกสูงเกิน`);
      } else {
        out.nPass++;
        // ผ่านครบอยู่แล้ว → ถอยเท่ากับ "ตัวที่เกินน้อยสุด" ต้องยังผ่านพอดี ถอยเกินอีกนิดต้องตก
        const slack=Math.min(...gaps);
        const s=at(-slack), s2=at(-(slack+10000));
        if(!(s.li===0&&s.st===0)) out.badSurp.push(`${h.name} ถอย ${(slack/1e6).toFixed(2)} ลบ. แล้วตกทั้งที่ควรยังผ่าน`);
        if(s2.li===0&&s2.st===0) out.badSurp.push(`${h.name} ถอยเกินระยะที่บอกแล้วยังผ่าน = ระยะเกินที่บอกต่ำไป`);
      }
    }
    return out;
  });
  console.log(`     ตรวจ ${v.n} แห่ง · ยังขาด ${v.nAll} แห่ง · ผ่านครบแล้ว ${v.nPass} แห่ง · ยอดสูงสุด ${(v.maxNeed/1e6).toFixed(1)} ลบ.`);
  chk(v.n>50,`ตรวจครบทุกแห่งที่มีค่าดิบ (${v.n} แห่ง)`);
  chk(v.badAll.length===0,`เติม "ตัวที่ขาดมากสุด" แล้วผ่านทุกเกณฑ์จริง (ผิด ${v.badAll.length}) ${v.badAll.slice(0,2).join(' | ')}`);
  chk(v.badMin.length===0,`ยอดที่บอกเป็นค่าต่ำสุดจริง ไม่เผื่อเกิน (ผิด ${v.badMin.length}) ${v.badMin.slice(0,2).join(' | ')}`);
  chk(v.badSurp.length===0,`ช่อง "+ เกิน" = ระยะที่ถอยได้จริงก่อนตกเกณฑ์ (ผิด ${v.badSurp.length}) ${v.badSurp.slice(0,2).join(' | ')}`);

  console.log('\n━━ ④ ตัวเลขบนจอ = ตัวเลขที่คำนวณได้ (ไม่ใช่คนละชุด) ━━');
  const m=await p.evaluate(()=>{
    const hc=[...document.querySelectorAll('#exResBox .badge[onclick^="exNowPop"]')][0]
              .getAttribute('onclick').match(/'([^']+)'/)[1];
    const h=EX.hosp.find(x=>x.hcode===hc), bs=h.bs;
    const b={ca:bs.ca,cl:bs.cl,qn:bs.qn,cn:bs.cn,ni:bs.ni,mo:bs.mo};
    const gaps=EX_NOW_ROWS.map(c=>c.gap(b));
    const worst=Math.max(0,...gaps.map(g=>-g));
    exNowPop(hc);
    const txt=document.getElementById('exNowOverlay').innerText;
    return {name:h.name, worst, shown:worst>0?txt.includes(fmtM(worst)):null,
            allGaps:gaps.every(g=>txt.includes(fmtM(Math.abs(g)))), risk:h.risk, hasBadge:txt.includes(String(h.risk))};
  });
  chk(m.allGaps,`ระยะห่างทั้ง 5 เกณฑ์ของ ${m.name} ขึ้นบนจอตรงกับที่คำนวณ`);
  chk(m.shown!==false,`ยอด "เงินก้อนเดียวปิดได้ทุกเกณฑ์" ขึ้นบนจอ (${(m.worst/1e6).toFixed(2)} ลบ.)`);
  chk(m.hasBadge,'ระดับวิกฤตของ รพ. นั้นขึ้นในหัวป็อปอัป');

  console.log('\n━━ ⑤ ปิดป็อปอัป + ไม่ชนกับป็อปอัปตัวอื่น ━━');
  await p.locator('#exNowOverlay .tgt-apply').click();
  await p.waitForTimeout(400);
  const c=await p.evaluate(()=>{
    const g=id=>{const e=document.getElementById(id); return e&&getComputedStyle(e).display!=='none';};
    return {now:g('exNowOverlay'), why:g('exWhyOverlay'), brk:g('exBrkOverlay')};
  });
  chk(!c.now,'กดปิดแล้วป็อปอัปหายจริง');
  chk(!c.why&&!c.brk,'ไม่ไปเปิดป็อปอัป "ก่อนช่วย"/"หลังช่วย" ค้างไว้');
  chk(errs.length===0,'ไม่มี JS error ตลอดการทดสอบ'+(errs.length?' → '+errs.slice(0,2).join(' | '):''));

  console.log('\n━━ สรุป ━━');
  console.log(fail.length?`❌ ไม่ผ่าน ${fail.length} ข้อ:\n  - `+fail.join('\n  - '):'✅ ผ่านทุกข้อ');
  await b.close();
  process.exit(fail.length?1:0);
})();
