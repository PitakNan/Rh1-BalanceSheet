// ตรวจป็อปอัปสายเงิน 3 ตัวบนเบราว์เซอร์จริง — เจ้าหนี้ / ลูกหนี้ / เงินสดคงเหลือหลังภาระ MOE
// (คู่กับ test_exec_tjpop.js ที่พิสูจน์ตัวเลข) · เจ้าของงานสั่ง 12 ส.ค. 69 — RISK_EXEC_MODEL.md 7.30
// รัน: NODE_PATH=<npm root -g> node pipeline/pw_test_tjpop.js [URL]
// ⚠️ ต้องใส่ ?t= กันแคช · 🪤 ห้ามผูกดัชนีคอลัมน์ ให้จับด้วย onclick^="exXxxPop"
const {chromium}=require('playwright');
const BASE=process.argv[2]||'https://pitaknan.github.io/Rh1-BalanceSheet/risk_drill.html';
let fail=[]; const chk=(c,m)=>{console.log('  '+(c?'✅':'❌')+' '+m); if(!c) fail.push(m)};
const POPS=[
  {fn:'exTjPop', id:'exTjOverlay', lab:'เจ้าหนี้', cmp:0, grid:5, must:[/หลังจ่ายจริง/,/NWC ไม่ขยับ/,/2101020199\.202/,/ยกหนี้/]},
  {fn:'exArPop', id:'exArOverlay', lab:'ลูกหนี้', cmp:0, grid:5, must:[/หลังเก็บได้|หลังเก็บเงินได้/,/Cash ratio/,/ตัดจำหน่าย/]},
  // MOE: tbls[0] = สายเลขคณิต (จำนวนแถวไม่คงที่ ขึ้นกับว่ามีพจน์ไหนบ้าง) · tbls[1] = ตารางเกณฑ์
  {fn:'exMoePop',id:'exMoeOverlay',lab:'MOE',     cmp:1, grid:0, must:[/สมมติไม่มีรายรับ/,/ภาระ MOE/,/ห่างจากเกณฑ์/]},
];

(async()=>{
  const b=await chromium.launch();
  const errs=[]; const p=await b.newPage();
  p.on('pageerror',e=>errs.push(String(e)));
  p.on('console',m=>{ if(m.type()==='error') errs.push('console: '+m.text()); });

  console.log('━━ ① cold load #exec ━━');
  await p.goto(`${BASE}?t=${Date.now()}#exec`,{waitUntil:'networkidle',timeout:90000});
  await p.waitForTimeout(4000);
  chk(errs.length===0,'ไม่มี JS error ตอน cold load'+(errs.length?' → '+errs.slice(0,2).join(' | '):''));

  console.log('\n━━ ② ทั้ง 3 คอลัมน์คลิกได้ · เปิด/ปิดป็อปอัปได้ · มีข้อความหลักครบ ━━');
  for(const o of POPS){
    const n=await p.locator(`#exResBox .tjpop[onclick^="${o.fn}"]`).count();
    chk(n>0,`${o.lab}: ยอดกดได้ ${n} เซลล์`);
    if(!n) continue;
    const cur=await p.locator(`#exResBox .tjpop[onclick^="${o.fn}"]`).first().evaluate(e=>getComputedStyle(e).cursor);
    chk(cur==='pointer',`${o.lab}: เคอร์เซอร์เป็น pointer`);
    await p.locator(`#exResBox .tjpop[onclick^="${o.fn}"]`).first().click();
    await p.waitForTimeout(600);
    const r=await p.evaluate(id=>{
      const ov=document.getElementById(id);
      const vis=ov&&getComputedStyle(ov).display!=='none';
      return {vis:!!vis, modal:!!(ov&&ov.querySelector('.nip-modal')),
              tbls:ov?[...ov.querySelectorAll('table.gaptbl')].map(t=>t.querySelectorAll('tr').length):[],
              txt:vis?ov.innerText:''};
    },o.id);
    chk(r.vis&&r.modal,`${o.lab}: ป็อปอัปเปิดด้วยโครง .nip-modal เดียวกับตัวอื่น`);
    chk(r.tbls[o.cmp]===7,`${o.lab}: ตารางเกณฑ์ = หัว 1 + 5 เกณฑ์ + SU 1 = 7 แถว (ได้ ${r.tbls[o.cmp]})`);
    // 🪤 ฝั่งลูกหนี้จำนวนแถวไม่คงที่: แถว "② เก็บได้ + ตัดที่เก็บไม่ได้" โผล่เฉพาะเมื่อ exArCut > 0
    //    (ค่าเริ่มต้น arPct=100 → ไม่มีการตัด → 4 แถว) ห้ามล็อกเป็นเลขตายตัว
    if(o.grid){ const exp=o.fn==='exArPop'
      ? await p.evaluate(sel=>{ const hc=(document.querySelector(sel).getAttribute('onclick').match(/'(\d+)'/)||[])[1];
          const h=EX.hosp.find(x=>x.hcode===hc); return exArCut(h)>0?5:4; }, `#exResBox .tjpop[onclick^="${o.fn}"]`)
      : o.grid;
      chk(r.tbls[r.tbls.length-1]===exp,`${o.lab}: กริดเทียบฉาก ${exp} แถว (ได้ ${r.tbls[r.tbls.length-1]})`); }
    for(const re of o.must) chk(re.test(r.txt),`${o.lab}: มีข้อความ ${re}`);
    chk(!/NaN|undefined/.test(r.txt),`${o.lab}: ไม่มี NaN/undefined บนจอ`);
    // ปิดด้วยปุ่ม ✕ · คลิกในกล่องต้องไม่ปิด
    await p.locator(`#${o.id} .nip-modal table.gaptbl`).first().click({position:{x:5,y:5}});
    await p.waitForTimeout(200);
    chk(await p.evaluate(id=>getComputedStyle(document.getElementById(id)).display!=='none',o.id),`${o.lab}: คลิกในกล่องแล้วไม่ปิด`);
    await p.locator(`#${o.id} button.tgt-apply`).click(); await p.waitForTimeout(250);
    chk(await p.evaluate(id=>getComputedStyle(document.getElementById(id)).display==='none',o.id),`${o.lab}: ปุ่ม ✕ ปิดได้`);
  }

  console.log('\n━━ ③ เจ้าหนี้ · badge บนจอ = scoreOf ของฉาก "จ่ายจริง" (ca/qn/cn/cl −D) ━━');
  const rTj=await p.evaluate(()=>{
    const out=[];
    const hs=EX.hosp.filter(h=>exPayIn(h)>0&&h.bs&&h.bs.cl).sort((a,b)=>exPayIn(b)-exPayIn(a)).slice(0,6);
    for(const h of hs){
      const s=h.bs, D=exPayIn(h);
      let ca=s.ca-D,qn=s.qn-D,cn=s.cn-D,cl=Math.max(0,s.cl-D);
      if(cn<0){ const d=-cn; cn=0; ca+=d; qn+=d; cl+=d; }
      const s0=scoreOf(s.ca,s.cl,s.qn,s.cn,s.ni,s.mo), s1=scoreOf(ca,cl,qn,cn,s.ni,s.mo);
      exTjPop(h.hcode);
      const bg=[...document.getElementById('exTjOverlay').querySelectorAll('.badge')].map(x=>x.textContent.trim());
      out.push({name:h.name, s0:s0.risk, s1:s1.risk, bg, nwc0:Math.round(s0.nwc), nwc1:Math.round(s1.nwc)});
    }
    exTjClose(); return out;
  });
  for(const r of rTj){
    console.log(`  · ${r.name}: ${r.s0} → จ่ายจริง ${r.s1} · badge [${r.bg.join(',')}]`);
    chk(+r.bg[1]===r.s1,`  ${r.name}: badge หัว = ระดับหลังจ่ายจริง ${r.s1}`);
    chk(Math.abs(r.nwc1-r.nwc0)<=1,`  ${r.name}: NWC ไม่ขยับจริง (${r.nwc0} → ${r.nwc1})`);
  }

  console.log('\n━━ ④ ลูกหนี้ · เก็บได้แล้วขยับแค่ Cash ratio (CR/QR/NWC/SU เท่าเดิมบนจอ) ━━');
  const rAr=await p.evaluate(()=>{
    const out=[];
    const hs=EX.hosp.filter(h=>exArIn(h)>0&&h.bs&&h.bs.cl).sort((a,b)=>exArIn(b)-exArIn(a)).slice(0,6);
    for(const h of hs){
      const s=h.bs, A=exArIn(h);
      const s0=scoreOf(s.ca,s.cl,s.qn,s.cn,s.ni,s.mo), s1=scoreOf(s.ca,s.cl,s.qn,s.cn+A,s.ni,s.mo);
      exArPop(h.hcode);
      const ov=document.getElementById('exArOverlay');
      // ตารางเกณฑ์: แถว 2-6 = CR/QR/Cash/NWC/NI · คอลัมน์ 5 = ช่อง "เปลี่ยน"
      const rows=[...ov.querySelectorAll('table.gaptbl')][0].querySelectorAll('tr');
      const chg=[...rows].slice(1,6).map(tr=>tr.children[4]?tr.children[4].textContent.trim():'');
      out.push({name:h.name, A, s0:s0.risk, s1:s1.risk, chg,
        bg:[...ov.querySelectorAll('.badge')].map(x=>x.textContent.trim())});
    }
    exArClose(); return out;
  });
  for(const r of rAr){
    console.log(`  · ${r.name}: ลูกหนี้ ${(r.A/1e6).toFixed(2)}M · ${r.s0} → ${r.s1} · ช่อง"เปลี่ยน" [${r.chg.join(' | ')}]`);
    chk(+r.bg[1]===r.s1,`  ${r.name}: badge หัว = ${r.s1}`);
    chk(r.chg[0]==='ไม่ขยับ'&&r.chg[1]==='ไม่ขยับ',`  ${r.name}: CR/QR ขึ้นว่า "ไม่ขยับ"`);
    chk(/↑/.test(r.chg[2]),`  ${r.name}: Cash ratio ขึ้นว่าเพิ่ม (↑)`);
    chk(r.chg[3]==='ไม่ขยับ'&&r.chg[4]==='ไม่ขยับ',`  ${r.name}: NWC/NI ขึ้นว่า "ไม่ขยับ"`);
  }

  console.log('\n━━ ⑤ MOE · ยอดในป็อปอัป = ยอดในเซลล์ · เปลี่ยนเดือนแล้วขยับตาม ━━');
  const rMoe=await p.evaluate(()=>{
    const hs=EX.hosp.filter(h=>h.bs&&h.bs.cl)
      .map(h=>({h, l:exMoeLeft({h, r0:exSimPath(h,0)})})).sort((a,b)=>a.l-b.l).slice(0,4);
    return hs.map(({h,l})=>{
      exMoePop(h.hcode);
      const ov=document.getElementById('exMoeOverlay');
      const t=ov.innerText.replace(/\s+/g,' ');
      const shown=l<0?'ขาด '+fmtM(-l):'เหลือ '+fmtM(l);
      const r=exSimPath(h,0);
      return {name:h.name, l, ok:t.includes(shown), shown,
        mm:exHorMonths(h), lab:exMoeTargetLab(), hasLab:t.includes(exMoeTargetLab()),
        moe:t.includes(fmtM((r.moeMo||0)*exHorMonths(h))),
        bg:[...ov.querySelectorAll('.badge')].map(x=>x.textContent.trim())};
    });
  });
  for(const r of rMoe){
    console.log(`  · ${r.name}: ${r.shown} ถึง ${r.lab} (${r.mm}ด.) · badge [${r.bg.join(',')}]`);
    chk(r.ok,`  ${r.name}: ยอด "${r.shown}" ตรงกับคอลัมน์`);
    chk(r.hasLab,`  ${r.name}: ระบุเดือนเป้า ${r.lab}`);
    chk(r.moe,`  ${r.name}: มียอดภาระ MOE รวมบนจอ`);
  }
  // เปลี่ยนเดือนในตัวกรองจริง ๆ ผ่าน UI แล้วป็อปอัปต้องเปลี่ยนตาม
  const before=await p.evaluate(()=>{ const h=EX.hosp.find(x=>x.bs&&x.bs.cl);
    exMoePop(h.hcode); const t=document.getElementById('exMoeOverlay').innerText; exMoeClose();
    return {t, mm:exHorMonths(h), hc:h.hcode}; });
  const sel=await p.locator('#exMmoSel, select#exMmo, [id^=exMmo]').count();
  const after=await p.evaluate(hc=>{ EXST.mmo=(exHorMonths()===3?6:3); exRender();
    const h=EX.hosp.find(x=>x.hcode===hc); exMoePop(hc);
    const t=document.getElementById('exMoeOverlay').innerText; exMoeClose();
    const mm=exHorMonths(h); EXST.mmo=0; exRender(); return {t,mm}; }, before.hc);
  chk(after.mm!==before.mm&&after.t!==before.t,`เปลี่ยนเดือนประเมิน ${before.mm}ด. → ${after.mm}ด. แล้วป็อปอัปเปลี่ยนตาม`);
  console.log(`     (ตัวเลือกเดือนในหน้า: พบตัวควบคุม ${sel} ตัว)`);

  console.log('\n━━ ⑥ มือถือ 390px — กล่องต้องไม่ล้นจอทั้ง 3 ตัว ━━');
  const mp=await b.newPage({viewport:{width:390,height:850}});
  const merr=[]; mp.on('pageerror',e=>merr.push(String(e)));
  await mp.goto(`${BASE}?t=${Date.now()}#exec`,{waitUntil:'networkidle',timeout:90000});
  await mp.waitForTimeout(4000);
  for(const o of POPS){
    const n=await mp.locator(`#exResBox .tjpop[onclick^="${o.fn}"]`).count();
    if(!n){ chk(true,`${o.lab}: มือถือซ่อนคอลัมน์นี้ (ไม่ต้องตรวจ)`); continue; }
    await mp.locator(`#exResBox .tjpop[onclick^="${o.fn}"]`).first().click(); await mp.waitForTimeout(500);
    const r=await mp.evaluate(id=>{ const m=document.querySelector('#'+id+' .nip-modal');
      return m?{w:m.getBoundingClientRect().width, doc:document.documentElement.scrollWidth}:null; },o.id);
    chk(!!r&&r.w<=390,`${o.lab}: กล่องกว้าง ${r?Math.round(r.w):'–'}px ไม่เกินจอ`);
    chk(!!r&&r.doc<=400,`${o.lab}: หน้าไม่เลื่อนแนวนอน (scrollWidth ${r?r.doc:'–'})`);
    await mp.evaluate(id=>document.getElementById(id).style.display='none',o.id);
  }
  chk(merr.length===0,'มือถือไม่มี JS error'+(merr.length?' → '+merr[0]:''));

  await b.close();
  console.log('\n'+(fail.length?'❌ ตก '+fail.length+' ข้อ:\n  - '+fail.join('\n  - '):'✅ ผ่านทุกข้อ'));
  process.exit(fail.length?1:0);
})();
