// 🧪 ล็อกโหมดจำลอง "ไม่เคลียร์เจ้าหนี้ + ไม่ได้รับเงินจากลูกหนี้" (เจ้าของงานสั่ง 11 ก.ย. 69 · คู่มือ 7.37)
//   ① ค่าเริ่มต้นต้องปิด · สลับแล้วสถานะเปลี่ยนจริง
//   ② โหมดเปิด: สายเงิน = เงินสดตั้งต้น ± โยก/เงินเขต เท่านั้น (ไม่หักเจ้าหนี้ ไม่บวกลูกหนี้) ครบทุกแห่ง
//   ③ ส่วนต่างจากโหมดปกติ = ลูกหนี้ − เจ้าหนี้ เป๊ะทุกแห่ง (ไม่มีพจน์แปลกปลอม)
//   ④ งบดุลฉากนี้ต้อง "ไม่ตัดจำหน่ายลูกหนี้ ไม่ลดเจ้าหนี้" — cl เท่าเดิม · ca/qn ลดเฉพาะ MOE/เงินเขต
//   ⑤ exChainBS ยังปิดตรง exMoeLeft (สายเลขคณิตไม่หลุด) ทั้ง 103 แห่ง
//   ⑥ ป็อปอัป 💵 เจ้าหนี้ / 📥 ลูกหนี้ ต้อง "ไม่ขยับ" ตามโหมดนี้ (ตอบคนละคำถาม — กติกาเดิม 7.30)
//   ⑦ ยอดดิบในคอลัมน์เจ้าหนี้/ลูกหนี้ยังต้องแสดงอยู่ + มีป้าย "ไม่นับในสายเงิน" + แถบเตือนบนหัวตาราง
//   ⑧ ลายเซ็นแคชต้องรู้จักโหมดนี้ ไม่งั้นสลับแล้วได้ผลค้างจากรอบก่อน
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
const A = new Function(code + ';return {exRender,exSimPath,exNoClr,exSetNoClr,exNetAfterDebt,exMoeLeft,' +
  'exChainBS,exPayIn,exArIn,exArCut,exXferNet,exRgDep,exRgIn,exHorMonths,exTopUp,exTjPop,exArPop,exMoePop,' +
  'exDefaultState,exBS,exTjScore,' +
  'setEX:v=>{EX=v},setEXST:v=>{EXST=v},getEXST:()=>EXST,setEXOPEN:v=>{EXOPEN=v},setEXBRK:v=>{EXBRK=v},setEXSORT:v=>{EXSORT=v}};')();
const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'data', 'risk', 'exec.json'), 'utf8'));
const ST = o => ({ ...A.exDefaultState(), mmo: 3, crisis: '67', ...o });
A.setEX(j); A.setEXOPEN({}); A.setEXBRK({}); A.setEXSORT({ col: null, dir: -1 });
const M = v => (v / 1e6).toFixed(2) + ' ลบ.';
const box = () => els['exResBox'].innerHTML;
const fail = [];
const chk = (ok, msg) => { console.log('  ' + (ok ? '✅' : '❌') + ' ' + msg); if (!ok) fail.push(msg); };
const NEAR = (a, b, eps = 1) => Math.abs(a - b) <= eps;
const rowsOf = () => j.hosp.map(h => ({ h, r0: A.exSimPath(h, 0) }));
console.log('ไฟล์: ' + SRC + '\nงวด: ' + j.periodLabel + ' · รพ. ' + j.hosp.length + ' แห่ง');

// ══ ① ค่าเริ่มต้น + สลับ ══════════════════════════════════════════════════════════
console.log('\n━━ ① ค่าเริ่มต้น/สวิตช์ ━━');
A.setEXST(ST()); A.exRender();
chk(A.exNoClr() === false, 'ค่าเริ่มต้น = ปิด (ตารางยังเป็นโหมดปกติ)');
const itemsOff = rowsOf(), leftOff = {}, netOff = {};
itemsOff.forEach(x => { leftOff[x.h.hcode] = A.exMoeLeft(x); netOff[x.h.hcode] = A.exNetAfterDebt(x.h); });
const nShortOff = itemsOff.filter(x => A.exTopUp(x) > 0).length;
const totShortOff = itemsOff.reduce((s, x) => s + A.exTopUp(x), 0);
A.setEXST(ST({ noClr: true })); A.exRender();
chk(A.exNoClr() === true, 'เปิดโหมดแล้วสถานะเป็น true');

// ══ ② สายเงินโหมดเปิด = เงินสดตั้งต้น ± โยก/เงินเขต ══════════════════════════════
console.log('\n━━ ② สายเงินตอนเปิดโหมด ━━');
let bad2 = 0;
j.hosp.forEach(h => {
  const want = h.bs.cn + A.exXferNet(h) - A.exRgDep(h) + A.exRgIn(h);
  if (!NEAR(A.exNetAfterDebt(h), want)) bad2++;
});
chk(bad2 === 0, 'เงินสดหลังจัดการหนี้สิน = เงินสด ± โยก/เงินเขต เท่านั้น ครบ ' + (j.hosp.length - bad2) + '/' + j.hosp.length + ' แห่ง');

// ══ ③ ส่วนต่างจากโหมดปกติ = ลูกหนี้ − เจ้าหนี้ ═══════════════════════════════════
console.log('\n━━ ③ ส่วนต่างเทียบโหมดปกติ ━━');
let bad3 = 0, nMove = 0;
j.hosp.forEach(h => {
  const d = netOff[h.hcode] - A.exNetAfterDebt(h);          // ปกติ − ไม่เคลียร์
  const want = A.exArIn(h) - A.exPayIn(h);
  if (!NEAR(d, want)) bad3++;
  if (Math.abs(want) > 1) nMove++;
});
chk(bad3 === 0, 'ส่วนต่าง = ลูกหนี้ − เจ้าหนี้ เป๊ะทุกแห่ง (มีเงินขยับจริง ' + nMove + ' แห่ง)');
let bad3b = 0;
rowsOf().forEach(x => { if (!NEAR(leftOff[x.h.hcode] - A.exMoeLeft(x), A.exArIn(x.h) - A.exPayIn(x.h))) bad3b++; });
chk(bad3b === 0, 'เงินสดคงเหลือหลังภาระ MOE ขยับด้วยส่วนต่างเดียวกัน (ภาระ MOE ไม่ถูกแตะ)');

// ══ ④ งบดุลฉากนี้: ไม่ตัดลูกหนี้ ไม่ลดเจ้าหนี้ ═══════════════════════════════════
console.log('\n━━ ④ งบดุลฉาก "ค้างไว้เฉย ๆ" ━━');
let bad4a = 0, bad4b = 0, bad4c = 0;
j.hosp.forEach(h => {
  const C = A.exChainBS(h);
  if (C.D !== 0 || C.A !== 0 || C.cut !== 0) bad4a++;
  if (C.bS.back === 0 && !NEAR(C.bS.cl, C.b0.cl)) bad4b++;          // ไม่มีเงินสดติดลบ → cl ต้องเท่าเดิม
  const wantCa = C.b0.ca + C.sub - C.dep - C.M;                     // ไม่มีพจน์ −cut
  if (C.bS.back === 0 && !NEAR(C.bS.ca, wantCa)) bad4c++;
});
chk(bad4a === 0, 'เจ้าหนี้/ลูกหนี้/ยอดตัดจำหน่าย ในฉากนี้เป็น 0 ทุกแห่ง (ไม่มีเงินไหล)');
chk(bad4b === 0, 'หนี้สินหมุนเวียนเท่าเดิม — ไม่มีการเคลียร์เจ้าหนี้');
chk(bad4c === 0, 'สินทรัพย์หมุนเวียนลดเฉพาะ MOE/เงินเขต — ไม่มีการตัดจำหน่ายลูกหนี้');

// ══ ⑤ สายเลขคณิตยังปิดตรง exMoeLeft ═════════════════════════════════════════════
console.log('\n━━ ⑤ สายเลขคณิตปิดตรง ━━');
let bad5 = 0;
rowsOf().forEach(x => { const C = A.exChainBS(x.h, x.r0); if (!NEAR(C.left, A.exMoeLeft(x))) bad5++; });
chk(bad5 === 0, 'exChainBS.left = exMoeLeft ครบ ' + (j.hosp.length - bad5) + '/' + j.hosp.length + ' แห่ง');

// ══ ⑥ ป็อปอัป 💵/📥 ต้องไม่ขยับตามโหมดนี้ ════════════════════════════════════════
console.log('\n━━ ⑥ ป็อปอัปเจ้าหนี้/ลูกหนี้ไม่ผูกกับโหมด ━━');
const pops = hc => {
  A.exTjPop(hc); const a = els['exTjOverlay'].innerHTML;
  A.exArPop(hc); const b = els['exArOverlay'].innerHTML;
  return a + '||' + b;
};
const cand = j.hosp.filter(h => A.exPayIn(h) > 0 && A.exArIn(h) > 0).slice(0, 8).map(h => h.hcode);
const onPop = cand.map(pops);
A.setEXST(ST()); A.exRender();
const offPop = cand.map(pops);
chk(cand.length > 0 && onPop.every((v, i) => v === offPop[i]),
  'ป็อปอัป 💵 และ 📥 ให้ HTML เท่าเดิมเป๊ะทั้งเปิด/ปิดโหมด (' + cand.length + ' แห่ง)');

// ══ ⑦ สิ่งที่ต้องเห็นบนจอ ════════════════════════════════════════════════════════
console.log('\n━━ ⑦ บนหน้าจอ ━━');
const htmlOff = box();
A.setEXST(ST({ noClr: true })); A.exRender();
const htmlOn = box();
chk(/กำลังจำลองสถานการณ์: ไม่เคลียร์เจ้าหนี้ และไม่ได้รับเงินจากลูกหนี้/.test(htmlOn), 'มีแถบเตือนโหมดจำลองบนหัวตาราง');
chk(!/กำลังจำลองสถานการณ์/.test(htmlOff), 'โหมดปกติไม่มีแถบเตือน');
chk(/nclr-tag/.test(htmlOn) && !/nclr-tag/.test(htmlOff), 'คอลัมน์เจ้าหนี้/ลูกหนี้ติดป้าย "ไม่นับในสายเงิน" เฉพาะตอนเปิดโหมด');
chk(/nclrbtn on/.test(htmlOn) && /nclrbtn/.test(htmlOff) && !/nclrbtn on/.test(htmlOff), 'ปุ่มสวิตช์แสดงสถานะ on/off ถูกต้อง');
const big = j.hosp.slice().sort((a, b) => A.exPayIn(b) - A.exPayIn(a))[0];
chk(A.exPayIn(big) > 0 && htmlOn.includes(M(A.exPayIn(big)).replace(' ลบ.', '')),
  'ยอดดิบเจ้าหนี้ยังแสดงอยู่ (' + big.name + ' ' + M(A.exPayIn(big)) + ')');
chk(/ไม่ใช่การตัดจำหน่ายลูกหนี้/.test(htmlOn), 'บอกชัดว่าไม่ใช่การตัดจำหน่ายลูกหนี้');
chk(/ไม่กระทบ:<\/b> คอลัมน์ระดับ ณ/.test(htmlOn), 'บอกชัดว่าไม่กระทบคอลัมน์ระดับก่อน/หลังช่วย');
A.exMoePop(big.hcode);
chk(/ไม่เคลียร์เจ้าหนี้ \/ ไม่ได้รับเงินจากลูกหนี้/.test(els['exMoeOverlay'].innerHTML), 'ป็อปอัป 💧 บอกว่าโหมดนี้เปิดอยู่');

// ══ ⑧ แคชต้องรู้จักโหมด ══════════════════════════════════════════════════════════
console.log('\n━━ ⑧ แคช ━━');
const itemsOn = rowsOf();
const nShortOn = itemsOn.filter(x => A.exTopUp(x) > 0).length;
const totShortOn = itemsOn.reduce((s, x) => s + A.exTopUp(x), 0);
A.setEXST(ST()); A.exRender();                                    // กลับโหมดปกติ แล้ววัดซ้ำ
const back = rowsOf().reduce((s, x) => s + A.exTopUp(x), 0);
chk(NEAR(back, totShortOff, 1e4), 'ปิดโหมดแล้วยอดกลับมาเท่าเดิม (' + M(back) + ' vs ' + M(totShortOff) + ')');
chk(!NEAR(totShortOn, totShortOff, 1e4), 'เปิดโหมดแล้วยอดเปลี่ยนจริง (ไม่ค้างจากแคช)');

console.log('\n📊 ผลทั้งเขต — ส่วนขาดสภาพคล่อง(MOE) ถึงเดือนเป้า');
console.log('   โหมดปกติ      เปราะ ' + nShortOff + ' แห่ง · ขาดรวม ' + M(totShortOff));
console.log('   🧪 ไม่เคลียร์  เปราะ ' + nShortOn + ' แห่ง · ขาดรวม ' + M(totShortOn) +
  '  (' + (totShortOn > totShortOff ? '+' : '') + M(totShortOn - totShortOff) + ')');

console.log('\n━━ สรุป ━━');
if (fail.length) { console.log('❌ ไม่ผ่าน ' + fail.length + ' ข้อ:\n   - ' + fail.join('\n   - ')); process.exit(1); }
console.log('✅ ผ่านทุกข้อ');
