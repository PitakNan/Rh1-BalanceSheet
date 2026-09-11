// 🎬 ล็อก "ฐานตัดสินระดับวิกฤต" 2 ฉาก (เจ้าของงานสั่ง 11 ก.ย. 69 · คู่มือ 7.39)
//   โจทย์: *"ระดับ ณ ก.ย.69 ก่อนช่วย ต้องเป็นตัวเลขเดียวกับสถานการณ์ใน เงินสด+เทียบเท่าคงเหลือหลังภาระ MOE"*
//   ① ค่าเริ่มต้นต้องเป็น 'chain' (สายเงินจริง) — ไม่ใช่ 'sim'
//   ② ฉาก chain: งบดุล ณ เดือนเป้าของแบบจำลอง = exChainBS(h).bS **เป๊ะทุกฟิลด์** ครบ 103 แห่ง
//      ทดสอบหลายเดือนเป้า รวมกรณี**ข้ามรอยต่อปีงบ** (NI รีเซ็ต 1 ต.ค. ต้องตรงกันทั้งสองที่)
//   ③ ระดับในคอลัมน์ = ระดับในป็อปอัป 💧 ทุกแห่ง (คำขอตรง ๆ ของเจ้าของงาน)
//   ④ chain ต้อง "ไม่ดีกว่า" sim เลยสักแห่ง (ฉากไม่มีรายรับ ย่อมแย่กว่าหรือเท่ากันเสมอ)
//   ⑤ เงินสนับสนุนฐาน chain ≥ ฐาน sim ทุกแห่ง · ⑥ สลับกลับ 'sim' ได้เลขเดิม
//   ⑦ บนจอต้องมีแถบ 🎬 บอกฐานเสมอ + ตัวเลขวิกฤตในแถบตรงกับที่นับได้จริง
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = process.env.RD_SRC || path.join(ROOT, 'docs', 'risk_drill.html');
const code = [...fs.readFileSync(SRC, 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map(m => m[1]).find(b => b.includes('function exBrkHtml'));
const mkEl = () => ({
  innerHTML: '', textContent: '', scrollTop: 0, scrollLeft: 0, value: '',
  classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, dataset: {},
  querySelectorAll: () => [], addEventListener() {}, getAttribute: () => null,
  setAttribute() {}, appendChild() {}, style: {}
});
const els = {};
global.document = {
  getElementById: id => (els[id] = els[id] || mkEl()), querySelectorAll: () => [],
  addEventListener() {}, documentElement: mkEl(), createElement: mkEl, body: mkEl()
};
global.window = { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.location = { hash: '' }; global.navigator = { clipboard: null }; global.confirm = () => true;
global.getComputedStyle = () => ({ getPropertyValue: () => '#888' });
global.Chart = function () { return { destroy() {} }; }; global.fetch = () => Promise.reject(0);
const A = new Function(code + ';return {exRender,exSimPath,exChainBS,exTjScore,exSolveFor,exTopUp,exMoeLeft,' +
  'exScen,exScenChain,exSetScen,exDefaultState,exMoeTargetLab,exMoeMonths,exHorMonths,scoreOf,' +
  'setEX:v=>{EX=v},setEXST:v=>{EXST=v},setEXOPEN:v=>{EXOPEN=v},setEXBRK:v=>{EXBRK=v},setEXSORT:v=>{EXSORT=v}};')();
const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'data', 'risk', 'exec.json'), 'utf8'));
const ST = o => ({ ...A.exDefaultState(), crisis: 'all', tgt: 6, ...o });
A.setEX(j); A.setEXOPEN({}); A.setEXBRK({}); A.setEXSORT({ col: null, dir: -1 });
const M = v => (v / 1e6).toFixed(2) + ' ลบ.';
const fail = [];
const chk = (ok, msg) => { console.log('  ' + (ok ? '✅' : '❌') + ' ' + msg); if (!ok) fail.push(msg); };
const NEAR = (a, b, eps = 2) => Math.abs(a - b) <= eps;
// anchor เดียวกับ exSimPath — ระดับที่แสดง = risk ปัจจุบัน + (คะแนนฉาก − คะแนนงวดปัจจุบัน)
const ancOf = h => { const b = A.scoreOf(h.bs.ca, h.bs.cl, h.bs.qn, h.bs.cn, h.bs.ni, h.bs.mo);
  const base = b ? b.risk : (h.risk || 0);
  return v => Math.max(0, Math.min(7, (h.risk != null ? h.risk : 0) + (v - base))); };
console.log('ไฟล์: ' + SRC + '\nงวด: ' + j.periodLabel + ' · รพ. ' + j.hosp.length + ' แห่ง');

// ══ ① ค่าเริ่มต้น ═══════════════════════════════════════════════════════════════
console.log('\n━━ ① ค่าเริ่มต้น ━━');
A.setEXST(ST()); A.exRender();
chk(A.exScen() === 'chain' && A.exScenChain(), "ค่าเริ่มต้น = 'chain' (สายเงินจริง)");
chk(A.exDefaultState().scen === 'chain', 'exDefaultState() เขียนค่าเริ่มต้นไว้ด้วย (สถานะใหม่/ล้างแคชแล้วยังได้ chain)');

// ══ ②③ งบดุล/ระดับ ต้องตรงกับป็อปอัป 💧 ทุกเดือนเป้า ═══════════════════════════
console.log('\n━━ ②③ ฉาก chain = exChainBS เป๊ะ (รวมกรณีข้ามปีงบ) ━━');
for (const mmo of [1, 2, 3, 6, 13]) {
  A.setEXST(ST({ mmo })); A.exRender();
  let badBS = 0, badLvl = 0, n = 0, cross = 0;
  j.hosp.forEach(h => {
    const r0 = A.exSimPath(h, 0), b = r0.sepBreak; if (!b) return;
    n++;
    const C = A.exChainBS(h, r0), s = C.bS;
    if (C.nAfter > 0) cross++;
    if (!NEAR(b.ca, s.ca) || !NEAR(b.qn, s.qn) || !NEAR(b.cn, s.cn) || !NEAR(b.cl, s.cl) || !NEAR(b.ni, s.ni)) badBS++;
    const sc = A.exTjScore(s);
    if (sc && r0.sepRisk !== ancOf(h)(sc.risk)) badLvl++;
  });
  chk(badBS === 0 && badLvl === 0,
    `เดือนเป้า ${String(mmo).padStart(2)} ด. (${A.exMoeTargetLab()}): งบดุลตรง ${n - badBS}/${n} · ระดับตรงป็อปอัป 💧 ${n - badLvl}/${n}` +
    (cross ? ` (ข้ามปีงบ ${cross} แห่ง)` : ''));
}

// ══ ④ chain ต้องไม่ดีกว่า sim เลย ═══════════════════════════════════════════════
console.log('\n━━ ④ chain ไม่ดีกว่า sim ━━');
A.setEXST(ST({ scen: 'sim' })); A.exRender();
const simL = {}, simNeed = {}, simShort = {};
j.hosp.forEach(h => { const r = A.exSimPath(h, 0); simL[h.hcode] = r.sepRisk;
  simNeed[h.hcode] = A.exSolveFor(h, 6) || 0; simShort[h.hcode] = A.exTopUp({ h, r0: r }); });
A.setEXST(ST()); A.exRender();
const chL = {}, chNeed = {}, chNull = [];
j.hosp.forEach(h => { const r = A.exSimPath(h, 0); chL[h.hcode] = r.sepRisk;
  const v = A.exSolveFor(h, 6);
  if (v == null) chNull.push(h.name);          // เงินก้อนอย่างเดียวไม่พอ (ติดเกณฑ์ NI ที่เงินแก้ไม่ได้)
  chNeed[h.hcode] = v || 0; });
const better = j.hosp.filter(h => chL[h.hcode] < simL[h.hcode]);
const worse = j.hosp.filter(h => chL[h.hcode] > simL[h.hcode]);
chk(better.length === 0, `ไม่มีแห่งไหนที่ฉาก chain ให้ระดับ "ดีกว่า" sim (แย่ลง ${worse.length} · เท่าเดิม ${j.hosp.length - worse.length} แห่ง)`);

// ══ ⑤ เงินสนับสนุนฐาน chain ≥ ฐาน sim ═══════════════════════════════════════════
console.log('\n━━ ⑤ เงินสนับสนุน ━━');
// ⛔ ต้องกัน "เงินก้อนไม่พอ" (Solver คืน null) ออกก่อน ไม่งั้นมันถูกนับเป็น 0 = ดูเหมือนถูกกว่า
const cheaper = j.hosp.filter(h => !chNull.includes(h.name) && chNeed[h.hcode] < simNeed[h.hcode] - 1e4);
const sSim = j.hosp.reduce((s, h) => s + simNeed[h.hcode], 0);
const sCh = j.hosp.reduce((s, h) => s + chNeed[h.hcode], 0);
// ℹ️ มีข้อยกเว้นรายแห่งได้ และต้องอธิบายได้ด้วย 1 ใน 2 ทางนี้เท่านั้น:
//    ① ฉาก chain ปิด "หนี้สินหมุนเวียนโตตามจริง" → CL ณ เดือนเป้าต่ำกว่า sim = ปิดเกณฑ์ CR/NWC ถูกลง
//    ② ฉาก chain ปิดฤดูกาล NI → NI ณ เดือนเป้า "ติดลบน้อยกว่า" sim = ปิดเกณฑ์ NI/SU ถูกลง
//       (งวดนี้: สะเมิง NI −0.53 ในฉาก chain เทียบ −4.75 ในฉาก sim เพราะ ก.ย. เป็นเดือนปิดบัญชี)
//    ตัวที่ต้องยืนเสมอคือ "ยอดรวมทั้งเขตต้องมากกว่า" — ระดับรายแห่งห้ามดีขึ้น (ข้อ ④ คุมไว้แล้ว)
if (cheaper.length) console.log('     ℹ️ ถูกกว่า ' + cheaper.length + ' แห่ง: ' +
  cheaper.slice(0, 5).map(h => h.name + ' ' + M(simNeed[h.hcode]) + '→' + M(chNeed[h.hcode])).join(' · '));
{
  const grab = () => { const o = {}; j.hosp.forEach(h => { const b = A.exSimPath(h, 0).sepBreak; o[h.hcode] = b ? { cl: b.cl, ni: b.ni } : { cl: 0, ni: 0 }; }); return o; };
  A.setEXST(ST({ scen: 'sim' })); const bSim = grab();
  A.setEXST(ST()); const bCh = grab();
  const odd = cheaper.filter(h => bCh[h.hcode].cl >= bSim[h.hcode].cl - 1 && bCh[h.hcode].ni <= bSim[h.hcode].ni + 1);
  chk(odd.length === 0, `ทุกแห่งที่ chain ถูกกว่า (${cheaper.length} แห่ง) อธิบายได้ด้วย CL ที่ไม่โต หรือ NI ที่ไม่โดนฤดูกาล — อธิบายไม่ได้ ${odd.length} แห่ง` +
    (chNull.length ? ` · เงินก้อนไม่พอ ${chNull.length} แห่ง: ${chNull.slice(0, 4).join(' · ')}` : ''));
}
chk(sCh > sSim, `ฐาน chain ใช้เงินมากกว่าจริง (+${M(sCh - sSim)})`);

// ══ ⑥ สลับกลับได้ค่าเดิม ════════════════════════════════════════════════════════
console.log('\n━━ ⑥ สลับฐานกลับไปกลับมา ━━');
A.setEXST(ST({ scen: 'sim' })); A.exRender();
const back = j.hosp.map(h => A.exSimPath(h, 0).sepRisk).join(',');
chk(back === j.hosp.map(h => simL[h.hcode]).join(','), 'สลับกลับ sim แล้วได้ระดับชุดเดิมเป๊ะ (ไม่มีผลค้างจากแคช)');
A.setEXST(ST({ scen: 'sim' })); A.exRender(); const htmlSim = els['exResBox'].innerHTML;
A.setEXST(ST()); A.exRender(); const htmlCh = els['exResBox'].innerHTML;

// ══ ⑦ แถบบอกฐานบนจอ ════════════════════════════════════════════════════════════
console.log('\n━━ ⑦ บนหน้าจอ ━━');
chk(/scen-bar/.test(htmlCh) && /scen-bar/.test(htmlSim), 'แถบ 🎬 บอกฐานตัดสินแสดงทั้งสองฉาก (ไม่ใช่โผล่เฉพาะฉากเดียว)');
chk(/ฐานตัดสิน: สายเงินจริง/.test(htmlCh) && /ฐานตัดสิน: นับรายรับ/.test(htmlSim), 'แถบบอกชื่อฐานที่ใช้อยู่ถูกต้องทั้งสองฉาก');
chk(/ตัวเลขสองฐานบวกกันไม่ได้/.test(htmlCh), 'เตือนว่าห้ามใช้ตัวเลขสองฐานปนกัน');
chk(/<select onchange="exSetScen/.test(htmlCh), 'มี dropdown ให้สลับฐานในแถบควบคุม');
{ // ตัวเลข "วิกฤต 6-7" ในแถบต้องตรงกับที่นับได้จริงจากชุดที่กรองอยู่
  A.setEXST(ST()); A.exRender();
  const want = j.hosp.filter(h => A.exSimPath(h, 0).sepRisk >= 6).length;
  const m = els['exResBox'].innerHTML.match(/วิกฤต 6-7 = (\d+) แห่ง<\/b>/);
  chk(!!m && +m[1] === want, `ตัวเลขวิกฤต 6-7 ในแถบ (${m ? m[1] : '?'}) = ที่นับได้จริง (${want})`);
}

// ══ 📊 รายงานผลต่างของสองฐาน (ไม่ตัดสินผ่าน/ไม่ผ่าน) ═══════════════════════════
A.setEXST(ST()); A.exRender();
const hist = f => { const c = {}; j.hosp.forEach(h => { const v = f(h); c[v] = (c[v] || 0) + 1; }); return Object.keys(c).sort().map(k => k + '×' + c[k]).join(' '); };
const need = h => Math.max(A.exTopUp({ h, r0: A.exSimPath(h, 0) }), chNeed[h.hcode]);
const needSim = h => Math.max(simShort[h.hcode], simNeed[h.hcode]);
console.log('\n📊 เทียบสองฐาน (เป้า ' + A.exMoeTargetLab() + ' · เป้าระดับ ≤6 · 103 แห่ง)');
console.log('   sim   : ' + hist(h => simL[h.hcode]) + '  · วิกฤต6-7 ' + j.hosp.filter(h => simL[h.hcode] >= 6).length);
console.log('   chain : ' + hist(h => chL[h.hcode]) + '  · วิกฤต6-7 ' + j.hosp.filter(h => chL[h.hcode] >= 6).length);
console.log('   ฐานจัดสรร need6: sim ' + M(j.hosp.reduce((s, h) => s + needSim(h), 0)) +
  ' / ' + j.hosp.filter(h => needSim(h) > 1e4).length + ' แห่ง  →  chain ' +
  M(j.hosp.reduce((s, h) => s + need(h), 0)) + ' / ' + j.hosp.filter(h => need(h) > 1e4).length + ' แห่ง');

console.log('\n━━ สรุป ━━');
if (fail.length) { console.log('❌ ไม่ผ่าน ' + fail.length + ' ข้อ:\n   - ' + fail.join('\n   - ')); process.exit(1); }
console.log('✅ ผ่านทุกข้อ');
