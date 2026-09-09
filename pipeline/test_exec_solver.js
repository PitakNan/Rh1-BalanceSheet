// ── ตรวจตรรกะ "ตารางผลจำลอง + เงินสนับสนุน" ทั้งตาราง ทุกโรงพยาบาล (เพิ่ม 10 ก.ย. 69) ──
// ตรวจ 8 ชั้น: สายเลขคณิต · sepBreak↔scoreOf · ✓/✗↔คะแนน · anchor · อสมการงบดุล ·
//              เอกโทนของ inj · Solver เป็นค่าต่ำสุดจริง · สูตรปิดของ CR/NWC
// ⛔ ห้ามลอกสูตรมาไว้ในไฟล์นี้ — ทุกค่าดึงจาก risk_drill.html ตรง ๆ ยกเว้น "สูตรปิด" ในข้อ ⑧
//    ที่จงใจเขียนอิสระเพื่อพิสูจน์ข้ามวิธี (closed form เทียบ binary search)
const fs = require('fs');
const SRC = process.env.RD_SRC || 'D:/Github/Rh1-BalanceSheet/docs/risk_drill.html';
const EXECJ = process.env.EXEC_JSON || 'D:/Github/Rh1-BalanceSheet/docs/data/risk/exec.json';
const code = [...fs.readFileSync(SRC, 'utf8')
  .matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(b => b.includes('function exBrkHtml'));
const mkEl = () => ({ innerHTML: '', textContent: '', scrollTop: 0, classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
  dataset: {}, querySelectorAll: () => [], addEventListener() {}, getAttribute: () => null, setAttribute() {}, appendChild() {}, style: {} });
const els = {};
global.document = { getElementById: id => (els[id] = els[id] || mkEl()), querySelectorAll: () => [], addEventListener() {},
  documentElement: mkEl(), createElement: mkEl, body: mkEl() };
global.window = { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.location = { hash: '' }; global.navigator = { clipboard: null };
global.getComputedStyle = () => ({ getPropertyValue: () => '#888' });
global.Chart = function () { return { destroy() {} }; }; global.fetch = () => Promise.reject(0);

const A = new Function(code + `;return {fmtM,scoreOf,exSimPath,exSolveFor,exSolveCrit,exNetAfterDebt,exMoeLeft,
  exTopUp,exHorMonths,exMoeMonths,exPayIn,exArIn,exXferNet,exRgDep,exRgIn,exMoeMo,exTjCalc,
  NEEDC:EX_NEEDC,CRIT:EX_CRIT,STEP:SV_STEP,setEX:v=>{EX=v},setEXST:v=>{EXST=v},setEXTJ:v=>{EXTJ=v}};`)();

const J = JSON.parse(fs.readFileSync(EXECJ, 'utf8'));
A.setEX(J);
const ST = (o = {}) => Object.assign({ mmo: undefined, crisis: 'all', types: { 'รพศ.': true, 'รพท.': true, 'รพช.': true }, prov: 'all',
  tgt: 6, moePct: {}, moePctAll: 0, moeOff: {}, moeOvr: {}, moeVer: '69', xmoe: true, adj: {}, adjAll: 0, revOff: {}, ovr: {},
  arPct: 100, arOvr: {}, seas: true, clGrow: true, tj: { mode: 'off', scope: 'crisis' }, inj: {}, open: {}, sect: {},
  xfer: [], rgAlloc: [] }, o);
// ⚠️ ต้องตั้ง EXTJ ด้วยทุกครั้ง — exSimPath อ่าน EXTJ.debtors ตรง ๆ ไม่มีตัวกัน null (ของจริง exRender ตั้งให้)
const set = o => { A.setEXST(ST(o)); A.setEXTJ(A.exTjCalc()); };

const H = J.hosp, S = A.STEP, M = v => v == null ? 'null' : (v / 1e6).toFixed(2) + 'M';
let fail = [];
const chk = (ok, msg) => { console.log(`  ${ok ? '✅' : '❌'} ${msg}`); if (!ok) fail.push(msg); };
console.log(`ไฟล์: ${SRC}\nงวด ${J.period} (${J.periodLabel}) · ${H.length} แห่ง · mo=${H[0].bs.mo}\n`);

// ── ① สายเลขคณิตของแถว ────────────────────────────────────────────────
console.log('━━ ① สายเลขคณิต: เงินสด −เจ้าหนี้ +ลูกหนี้ −เงินฝากเขต +เงินเขตให้ = สุทธิ · สุทธิ −MOE×เดือน = คงเหลือ');
let e1 = 0, n1 = 0;
for (const mmo of [1, 3, 6, 13]) for (const tj of ['off', 'pay', 'forgive']) {
  set({ mmo, tj: { mode: tj, scope: 'crisis' } });
  for (const h of H) {
    n1++;
    const chain = h.bs.cn - A.exPayIn(h) + A.exArIn(h) + A.exXferNet(h) - A.exRgDep(h) + A.exRgIn(h);
    if (Math.abs(chain - A.exNetAfterDebt(h)) > 1) e1++;
    const r0 = A.exSimPath(h, 0), x = { h, r0 };
    if (Math.abs(A.exMoeLeft(x) - (A.exNetAfterDebt(h) - (r0.moeMo || 0) * A.exHorMonths(h))) > 1) e1++;
    const L = A.exMoeLeft(x);
    if (Math.abs(A.exTopUp(x) - (L < -1 ? -L : 0)) > 1e-6) e1++;
  }
}
chk(e1 === 0, `สายเลขปิดตรงทุกแห่ง ${n1} เคส (${H.length} แห่ง × 4 เดือนเป้า × 3 โหมดตามจ่าย) — ผิด ${e1}`);

// ── ② sepBreak ประกอบกลับเป็นคะแนนได้ตรง scoreOf ───────────────────────
let e2 = 0, n2 = 0;
for (const mmo of [1, 3, 6]) {
  set({ mmo });
  for (const h of H) {
    const b = A.exSimPath(h, 0).sepBreak; if (!b) continue; n2++;
    const s = A.scoreOf(b.ca, Math.max(b.cl, 1), b.qn, b.cn, b.ni, b.mo);
    if (['cr', 'qr', 'cash', 'nwc', 'li', 'st', 'su', 'risk'].some(k => Math.abs((s[k] || 0) - (b[k] || 0)) > 1e-9)) e2++;
  }
}
chk(e2 === 0, `② sepBreak ↔ scoreOf ตรงกัน ${n2} เคส — ผิด ${e2}`);

// ── ③ ✓/✗ ของ 6 เกณฑ์ ต้องประกอบกลับเป็นคะแนน li/st ได้ ─────────────────
set({});
let e3 = 0;
for (const h of H) {
  const b = A.exSimPath(h, 0).sepBreak; if (!b) continue;
  const g = k => A.NEEDC.find(c => c.k === k).ok(b);
  if (((g('cr') ? 0 : 1) + (g('qr') ? 0 : 1) + (g('cash') ? 0 : 1)) !== b.li) e3++;
  if (((g('nwc') ? 0 : 1) + (g('ni') ? 0 : 1)) !== b.st) e3++;
  for (const [n, k] of [['CR', 'cr'], ['QR', 'qr'], ['Cash ratio', 'cash'], ['NWC', 'nwc'], ['NI', 'ni']])
    if (A.CRIT.find(c => c.n === n).ok(b) !== g(k)) e3++;
}
chk(e3 === 0, `③ EX_CRIT (แผงเจาะเกณฑ์) = EX_NEEDC (คอลัมน์เงิน) = คะแนน scoreOf — ผิด ${e3}`);

// ── ④ anchor: คะแนนที่แสดงต้องตรง scoreOf จากงบดิบ ─────────────────────
let e4 = 0;
for (const h of H) {
  const b = h.bs, s = A.scoreOf(b.ca, b.cl, b.qn, b.cn, b.ni, b.mo);
  if (h.risk != null && s && s.risk !== h.risk) e4++;
}
chk(e4 === 0, `④ anchor: h.risk = scoreOf(งบดิบ) ทุกแห่ง — ต่าง ${e4}`);

// ── ⑤ อสมการงบดุลตลอดเส้นทาง ──────────────────────────────────────────
let e5 = 0, n5 = 0;
for (const mmo of [1, 3, 6, 10, 13]) {
  set({ mmo });
  for (const h of H) for (const inj of [0, 20e6]) {
    const b = A.exSimPath(h, inj).sepBreak; if (!b) continue; n5++;
    if (b.qn - b.ca > 1 || b.cn - b.qn > 1 || b.cn < -1 || b.cl < 1 - 1e-6) e5++;
    else if (Math.abs((b.ca - b.cl) - b.nwc) > 1) e5++;
    else if (Math.abs(b.cr - b.ca / b.cl) > 1e-9 || Math.abs(b.qr - b.qn / b.cl) > 1e-9 || Math.abs(b.cash - b.cn / b.cl) > 1e-9) e5++;
  }
}
chk(e5 === 0, `⑤ อสมการงบดุลตลอดเส้นทาง ${n5} เคส (สินทรัพย์เร็ว ⊆ หมุนเวียน · เงินสดไม่ติดลบ) — ผิด ${e5}`);

// ── ⑥ เอกโทน — สมมติฐานที่ binary search ต้องพึ่ง ─────────────────────
// ถ้าไม่เป็นเอกโทน Solver จะคืนค่าผิดเงียบ ๆ โดยไม่มีอะไรฟ้อง
set({});
let e6 = 0, n6 = 0;
for (const h of H) {
  let p = null;
  for (const v of [0, 1e6, 5e6, 10e6, 25e6, 50e6, 100e6, 200e6, Math.max(2 * h.bs.cl, 400e6)]) {
    const r = A.exSimPath(h, v); n6++;
    if (p) {
      const a = p.sepRisk == null ? -1 : p.sepRisk, b = r.sepRisk == null ? -1 : r.sepRisk;
      if (b > a || r.endRisk > p.endRisk ||
          (r.cashOut == null ? 1e9 : r.cashOut) < (p.cashOut == null ? 1e9 : p.cashOut)) e6++;
    }
    p = r;
  }
}
chk(e6 === 0, `⑥ เติมเงินมากขึ้นแล้วระดับไม่แย่ลง/เงินไม่หมดเร็วขึ้น ${n6} จุด — ละเมิด ${e6}`);

// ── ⑦ Solver คืน "ค่าต่ำสุดจริง" ──────────────────────────────────────
console.log('━━ ⑦ Solver เป็นค่าต่ำสุดจริง (ผ่านที่ยอดนั้น · ไม่ผ่านที่ยอด−1 step)');
for (const tgt of [0, 3, 6]) {
  set({ tgt });
  const pass = (h, v) => { const r = A.exSimPath(h, v); return (r.sepRisk == null || r.sepRisk <= tgt) && r.endRisk <= tgt && r.cashOut == null; };
  let e = 0, nz = 0, np = 0;
  for (const h of H) {
    const need = A.exSolveFor(h, tgt);
    if (need == null) { if (pass(h, Math.max(2 * h.bs.cl, 400e6))) e++; continue; }
    if (need === 0) { nz++; if (!pass(h, 0)) e++; continue; }
    np++;
    if (!pass(h, need)) e++;
    if (pass(h, Math.max(0, need - S))) e++;
  }
  chk(e === 0, `เป้า ≤${tgt}: ไม่ต้องเติม ${nz} แห่ง · ต้องเติม ${np} แห่ง — ผิด ${e}`);
}
set({});
let e7 = 0, n7 = 0;
for (const h of H) {
  const r0 = A.exSimPath(h, 0), b0 = r0.sepBreak; if (!b0) continue;
  for (const c of A.NEEDC) {
    const v = A.exSolveCrit(h, c, r0); if (v == null || v === 0) continue; n7++;
    const ok = x => { const b = A.exSimPath(h, x).sepBreak; return !!b && c.ok(b, b0); };
    if (!ok(v) || ok(Math.max(0, v - S))) e7++;
  }
}
chk(e7 === 0, `6 คอลัมน์เกณฑ์เป็นค่าต่ำสุดจริง ${n7} คู่ (แห่ง×เกณฑ์) — ผิด ${e7}`);

// ── ⑧ พิสูจน์ข้ามวิธี: สูตรปิดทางบัญชี เทียบ binary search ──────────────
// need_CR = max(0, 1.5×CL − CA) · need_NWC = max(0, CL − CA) วัด ณ เดือนเป้า ก่อนช่วย
// ⚠️ เกณฑ์ปัด 2 ตำแหน่ง (EX_R2) → ผ่านได้ตั้งแต่ CR 1.495 จึงเผื่อ tolerance 0.6% ของ CL
console.log('━━ ⑧ พิสูจน์ข้ามวิธี: สูตรปิดทางบัญชี เทียบ Solver แบบ binary search');
set({});
let e8a = 0, e8b = 0;
for (const h of H) {
  const r0 = A.exSimPath(h, 0), b0 = r0.sepBreak; if (!b0) continue;
  const tol = Math.max(2 * S, 0.006 * b0.cl);
  const a = A.exSolveCrit(h, A.NEEDC.find(c => c.k === 'cr'), r0);
  const b = A.exSolveCrit(h, A.NEEDC.find(c => c.k === 'nwc'), r0);
  if (a != null && Math.abs(a - Math.max(0, 1.5 * b0.cl - b0.ca)) > tol) e8a++;
  if (b != null && Math.abs(b - Math.max(0, b0.cl - b0.ca)) > tol) e8b++;
  // CR≥1.50 กินความ NWC≥0 อยู่ในตัว → need_CR ต้องไม่ต่ำกว่า need_NWC เด็ดขาด
  if (a != null && b != null && a < b - 1) fail.push(`need_CR (${M(a)}) < need_NWC (${M(b)}) ที่ ${h.name} — เป็นไปไม่ได้ทางตรรกะ`);
}
chk(e8a === 0, `need_CR = max(0, 1.5×CL − CA) ตรงทุกแห่ง — ผิด ${e8a}`);
chk(e8b === 0, `need_NWC = max(0, CL − CA) ตรงทุกแห่ง — ผิด ${e8b}`);
// 🐞 ข้อความที่เคยผิดบนหน้าเว็บ (แก้ 10 ก.ย. 69): "CR แพงกว่า NWC ครึ่งหนึ่งของ CL เสมอ"
//    จริงเฉพาะแห่งที่ NWC ยังติดลบ — ถ้า NWC เป็นบวกอยู่แล้ว need_NWC = 0 และส่วนต่างน้อยกว่านั้นมาก
chk(!/CR\s*=\s*NWC\s*\+\s*0\.5|แพงกว่า NWC อยู่ครึ่งหนึ่งของหนี้สินหมุนเวียนเสมอ/.test(fs.readFileSync(SRC, 'utf8')),
  'หน้าเว็บไม่มีข้อความ "CR แพงกว่า NWC ครึ่งหนึ่งของ CL เสมอ" (ไม่จริงเมื่อ NWC เป็นบวกอยู่แล้ว)');

console.log('\n' + '─'.repeat(56));
if (fail.length) { console.log(`❌ ไม่ผ่าน ${fail.length} ข้อ:`); fail.forEach(x => console.log('   - ' + x)); process.exit(1); }
console.log('✅ ผ่านทุกข้อ');
