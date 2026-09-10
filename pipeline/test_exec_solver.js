// ── ตรวจตรรกะ "ตารางผลจำลอง + เงินสนับสนุน" ทั้งตาราง ทุกโรงพยาบาล (เพิ่ม 10 ก.ย. 69) ──
// ①-⑧ ตารางทั้งใบ: สายเลขคณิต · sepBreak↔scoreOf · ✓/✗↔คะแนน · anchor · อสมการงบดุล ·
//                   เอกโทนของ inj · Solver เป็นค่าต่ำสุดจริง · สูตรปิดของ CR/NWC
// ⑨-⑬ เจาะ "เงินที่ต้องใช้เติม" (เจ้าของงานสั่งตรวจให้ละเอียดที่สุด 10 ก.ย. 69):
//      สูตรปิดครบ 6 เกณฑ์ · สูตรปิดของยอดรวม · need ลดตามเป้า ·
//      need = max ของ 3 เงื่อนไข · เพดานผู้ให้ + กติกาจัดสรรอัตโนมัติ
// ⛔ ห้ามลอกสูตรมาไว้ในไฟล์นี้ — ทุกค่าดึงจาก risk_drill.html ตรง ๆ ยกเว้น "สูตรปิด" ในข้อ ⑧-⑩
//    ที่จงใจเขียนอิสระเพื่อพิสูจน์ข้ามวิธี (closed form เทียบ binary search)
// 📌 ตัวเลขที่ยันไว้ในไฟล์นี้เป็น "คุณสมบัติ" ไม่ใช่ค่าคงที่รายงวด → รันได้ทุกงวดโดยไม่ต้องแก้
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

const A = new Function(code + `;return {fmtM,scoreOf,exSimPath,exSolveFor,exSolveCrit,exSolveDown,exNetAfterDebt,exMoeLeft,
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

// ══════════════════════════════════════════════════════════════════════
// ชั้นที่ 9–13: ตรวจ "เงินที่ต้องใช้เติม" แบบเจาะจง (เพิ่ม 10 ก.ย. 69 · เจ้าของงานสั่งตรวจให้ละเอียดที่สุด)
// ══════════════════════════════════════════════════════════════════════

// bisect บนกริด SV_STEP ของฟังก์ชันเอกโทน — ใช้กับ "สูตรปิด" ที่ไม่เรียก exSimPath ระหว่างค้นหา
function gridMin(hi, ok) {
  if (ok(0)) return 0;
  if (!ok(hi)) return null;
  let lo = 0, h2 = hi;
  while (h2 - lo > S) { const mid = Math.round((lo + h2) / 2 / S) * S; if (mid <= lo || mid >= h2) break; if (ok(mid)) h2 = mid; else lo = mid; }
  return h2;
}
const suFormula = (nwc, ni, mo) => {
  const m = mo > 0 ? mo : 12, np = nwc >= 0, ip = ni >= 0;
  if (np && ip) return 0;
  if (!np && !ip) return 2;
  if (np && !ip) { const a = Math.abs(ni) / m; const s2 = a ? nwc / a : 1e9; return s2 < 3 ? 2 : s2 < 6 ? 1 : 0; }
  const a = ni / m; const r = a ? (-nwc) / a : 1e9; return r < 3 ? 0 : r < 6 ? 1 : 2;
};

// ── ⑨ พิสูจน์ข้ามวิธีครบทั้ง 6 เกณฑ์ (เงินก้อน v ดัน CA/QN/CN/NI ขึ้น v เท่ากันหมด) ──
console.log('━━ ⑨ สูตรปิดทางบัญชีครบทั้ง 6 เกณฑ์ เทียบ Solver');
set({});
{
  const F = {
    cash: b => Math.max(0, 0.8 * b.cl - b.cn), qr: b => Math.max(0, 1.0 * b.cl - b.qn),
    cr: b => Math.max(0, 1.5 * b.cl - b.ca), nwc: b => Math.max(0, 1.0 * b.cl - b.ca),
    ni: b => Math.max(0, -b.ni),
  };
  const tot = { su: 0 };
  for (const k of Object.keys(F)) tot[k] = 0;
  for (const h of H) {
    const r0 = A.exSimPath(h, 0), b0 = r0.sepBreak; if (!b0) continue;
    const tol = Math.max(2 * S, 0.006 * b0.cl);
    for (const k of Object.keys(F)) {
      const got = A.exSolveCrit(h, A.NEEDC.find(c => c.k === k), r0);
      if (got != null && Math.abs(got - F[k](b0)) > tol) tot[k]++;
    }
    const gotSu = A.exSolveCrit(h, A.NEEDC.find(c => c.k === 'su'), r0);
    if (gotSu != null) {
      const wantSu = b0.su === 0 ? 0 : gridMin(Math.max(2 * h.bs.cl, 400e6), v => suFormula(b0.nwc + v, b0.ni + v, b0.mo) <= b0.su - 1);
      if (wantSu == null || Math.abs(gotSu - wantSu) > tol) tot.su++;
    }
  }
  for (const k of ['cash', 'qr', 'cr', 'nwc', 'ni', 'su'])
    chk(tot[k] === 0, `เกณฑ์ ${k.toUpperCase().padEnd(4)} ตรงสูตรปิดทุกแห่ง — ต่าง ${tot[k]}`);
}

// ── ⑩ ยอด "รวม (Solver)" เทียบการคำนวณคะแนนจากสูตรปิดล้วน ──
console.log('━━ ⑩ ยอดรวม (Solver) เทียบสูตรปิด — Solver สูงกว่าได้เฉพาะเมื่อติดเงื่อนไขที่สูตรปิดมองไม่เห็น');
for (const tgt of [6, 3, 0]) {
  set({ tgt });
  let off = 0, n = 0;
  for (const h of H) {
    const r0 = A.exSimPath(h, 0), b0 = r0.sepBreak; if (!b0) continue;
    const need = A.exSolveFor(h, tgt); if (need == null) continue;
    const HI = Math.max(2 * h.bs.cl, 400e6);
    // สูตรปิดใช้ได้เมื่อหนี้สินหมุนเวียนไม่ตอบสนองต่อเงิน (ไม่มีเจ้าหนี้ที่ก่อจากการจ่ายไม่ได้)
    if (Math.abs(A.exSimPath(h, HI).sepBreak.cl - b0.cl) > 1) continue;
    n++;
    const base = A.scoreOf(h.bs.ca, h.bs.cl, h.bs.qn, h.bs.cn, h.bs.ni, h.bs.mo).risk;
    const anc = v => Math.max(0, Math.min(7, (h.risk != null ? h.risk : 0) + (v - base)));
    const want = gridMin(HI, v => anc(A.scoreOf(b0.ca + v, b0.cl, b0.qn + v, b0.cn + v, b0.ni + v, b0.mo).risk) <= tgt);
    if (want == null) continue;
    const tol = Math.max(2 * S, 0.006 * b0.cl);
    if (need < want - tol) off++;                                   // ต่ำกว่าสูตรปิด = ผิดแน่นอน
    else if (need > want + tol) {
      const r = A.exSimPath(h, want);
      if (r.cashOut == null && r.endRisk <= tgt) off++;              // สูงกว่าโดยไม่มีเหตุ = ผิด
    }
  }
  chk(off === 0, `เป้า ≤${tgt}: ตรวจ ${n} แห่ง — ไม่ตรงสูตรปิดโดยอธิบายไม่ได้ ${off}`);
}

// ── ⑪ เป้าหลวมขึ้น เงินต้องไม่แพงขึ้น ──
{
  const by = {};
  for (const L of [0, 1, 2, 3, 4, 5, 6, 7]) { set({ tgt: L }); by[L] = H.map(h => A.exSolveFor(h, L)); }
  let e = 0;
  for (let i = 0; i < H.length; i++) for (let L = 1; L <= 7; L++) {
    const a = by[L - 1][i], b = by[L][i];
    if (a != null && b != null && b > a + 1) e++;
  }
  chk(e === 0, `⑪ need(เป้า 0) ≥ need(1) ≥ … ≥ need(7) ทุกแห่ง — ละเมิด ${e}`);
}

// ── ⑫ pass() เป็น AND ของ 3 เงื่อนไข → need ต้อง = max ของ need แต่ละเงื่อนไขเดี่ยว ──
for (const tgt of [6, 0]) {
  set({ tgt });
  let e = 0;
  for (const h of H) {
    const need = A.exSolveFor(h, tgt); if (need == null) continue;
    const HI = Math.max(2 * h.bs.cl, 400e6);
    const a = gridMin(HI, v => { const r = A.exSimPath(h, v); return r.sepRisk == null || r.sepRisk <= tgt; });
    const b = gridMin(HI, v => A.exSimPath(h, v).endRisk <= tgt);
    const c = gridMin(HI, v => A.exSimPath(h, v).cashOut == null);
    if (Math.abs(need - Math.max(a ?? 0, b ?? 0, c ?? 0)) > 1) e++;
  }
  chk(e === 0, `⑫ เป้า ≤${tgt}: need = max(เดือนเป้า, สิ้นปีงบ, เงินสดไม่หมด) — ผิด ${e}`);
}

// ── ⑬ เพดานผู้ให้ + ⚡ จัดสรรอัตโนมัติ: เงินต้องไม่งอก และผู้ให้ต้องไม่พังเอง ──
console.log('━━ ⑬ เพดานผู้ให้ + ⚡ จัดสรรอัตโนมัติ');
{
  const HARD = 5, PER = 10e6, EXTRA = 100e3;
  set({ tgt: 6 });
  const capOf = h => {
    const sur = Math.max(0, A.exMoeLeft({ h, r0: A.exSimPath(h, 0) }));
    const d = A.exSolveDown(h, HARD + 1);
    return Math.max(0, Math.min(sur, (d == null) ? Infinity : Math.max(0, d - S)));
  };
  // ให้เงินออก a บาท = จำลองด้วย inj ติดลบ (กลไกเดียวกับ exXferNet ที่รวมเข้า inj)
  const safe = (h, a) => {
    const r = A.exSimPath(h, -a);
    return (r.sepRisk == null || r.sepRisk <= HARD) &&
      (A.exNetAfterDebt(h) - a - (r.moeMo || 0) * A.exHorMonths(h)) >= -1;
  };
  let e1 = 0, e2 = 0, nc = 0;
  for (const h of H) { const c = capOf(h); if (!isFinite(c) || c <= 0) continue; nc++; if (!safe(h, c)) e1++; if (safe(h, c + S)) e2++; }
  chk(e1 === 0, `ให้เท่าเพดานแล้วผู้ให้ยังปลอดภัย (${nc} แห่งที่มีเพดาน) — ผิด ${e1}`);
  chk(e2 === 0, `ให้เกินเพดาน 1 step แล้วต้องไม่ปลอดภัย — หลุด ${e2}`);

  // สร้างแผนด้วยตรรกะเดียวกับ exXferAuto (เรียกตรงไม่ได้เพราะมี confirm/exSave/exRender)
  const need = [], cap = {};
  for (const h of H) { const L = A.exMoeLeft({ h, r0: A.exSimPath(h, 0) }); if (L < 0) need.push({ h, want: -L }); else { const c = capOf(h); if (c > 0) cap[h.hcode] = c; } }
  need.sort((a, b) => ((b.h.risk || 0) - (a.h.risk || 0)) || (b.want - a.want));
  const capBase = Object.assign({}, cap), plan = [];
  for (const n of need) {
    let want = n.want + EXTRA;
    for (const g of H.filter(g => g.prov === n.h.prov && g.hcode !== n.h.hcode && cap[g.hcode] > 0).sort((a, b) => cap[b.hcode] - cap[a.hcode])) {
      if (want <= 0) break;
      const give = Math.min(want, cap[g.hcode], PER); if (give <= 0) continue;
      plan.push({ f: g.hcode, t: n.h.hcode, a: Math.round(give) }); cap[g.hcode] -= give; want -= give;
    }
  }
  const prov = {}; H.forEach(h => prov[h.hcode] = h.prov);
  chk(plan.every(p => prov[p.f] === prov[p.t]), 'จัดสรรอัตโนมัติ: โยกในจังหวัดเดียวกันทั้งหมด (กติกาข้อ ①)');
  chk(plan.every(p => p.a <= PER + 1), 'จัดสรรอัตโนมัติ: ไม่เกิน 10 ลบ. ต่อรายการ (กติกาข้อ ②)');
  const byD = {}; plan.forEach(p => byD[p.f] = (byD[p.f] || 0) + p.a);
  chk(Object.entries(byD).every(([k, v]) => v <= (capBase[k] || 0) + 1), 'จัดสรรอัตโนมัติ: ผู้ให้แต่ละแห่งรวมทุกรายการไม่เกินเพดานตัวเอง');
  set({ tgt: 6, xfer: plan });
  let eD = 0;
  for (const hc in byD) {
    const h = H.find(x => x.hcode === hc), r = A.exSimPath(h, 0);
    if ((r.sepRisk != null && r.sepRisk > HARD) || A.exMoeLeft({ h, r0: r }) < -1) eD++;
  }
  chk(eD === 0, `จัดสรรอัตโนมัติ: ผู้ให้ ${Object.keys(byD).length} แห่ง ไม่ตกเกินระดับ ${HARD} และสภาพคล่องตัวเองไม่ติดลบ — ผิด ${eD}`);
  set({});
}

// ── ℹ️ บันทึกขอบเขตของสวิตช์ "% ลูกหนี้ที่คาดว่าเก็บได้" (รายงานเฉย ๆ ไม่ตัดสินผ่าน/ไม่ผ่าน)
{
  const sum = o => { set(Object.assign({ tgt: 6 }, o)); let t = 0, s = 0; for (const h of H) { const v = A.exSolveFor(h, 6); if (v) t += v; const r0 = A.exSimPath(h, 0); s += A.exTopUp({ h, r0 }); } return { t, s }; };
  const a = sum({}), b = sum({ arPct: 0 });
  console.log(`  ℹ️ สไลด์ "% ลูกหนี้เก็บได้" 100%→0%: ส่วนขาดสภาพคล่อง ${(a.s / 1e6).toFixed(2)}M→${(b.s / 1e6).toFixed(2)}M · เงินสนับสนุน ${(a.t / 1e6).toFixed(2)}M→${(b.t / 1e6).toFixed(2)}M`);
  console.log('     (คะแนน Risk คิดจากมูลค่าตามบัญชี สไลด์นี้จึงไม่แตะเงินสนับสนุนเมื่อปิด Option ตามจ่าย — คู่มือ 7.35)');
  set({});
}

console.log('\n' + '─'.repeat(56));
if (fail.length) { console.log(`❌ ไม่ผ่าน ${fail.length} ข้อ:`); fail.forEach(x => console.log('   - ' + x)); process.exit(1); }
console.log('✅ ผ่านทุกข้อ');
