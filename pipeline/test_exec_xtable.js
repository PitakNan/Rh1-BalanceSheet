// ⭐ เทียบ "ตัวเลขที่พิมพ์อยู่ในตารางผลจำลอง" กับ "ตารางสรุปรายจังหวัด" ตรง ๆ (ไม่ผ่าน exec.json)
// เจ้าของงานทัก 7 ส.ค. 69: "ไม่ใช่แค่เปลี่ยนที่เดียวนะ" — ชุดตรวจอื่นเทียบกับ exec.json
// ซึ่งพิสูจน์ได้แค่ว่าตารางสรุปถูก ไม่ได้พิสูจน์ว่า "สองตารางบนจอตรงกัน"
// ไฟล์นี้จึงอ่านตัวเลขจาก HTML ของทั้งสองตารางแล้วเทียบกันเอง ในหลายชุดตัวกรอง
// + ตรวจว่าไม่มีที่ไหนหลงใช้ลูกหนี้ "ดิบ" ปนกับ "หลังปรับ" อีก
const fs=require('fs');
const SRC=process.env.RD_SRC||'D:/Github/Rh1-BalanceSheet/docs/risk_drill.html';
const code=[...fs.readFileSync(SRC,'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(b=>b.includes('function exBrkHtml'));
const mkEl=()=>({innerHTML:'',textContent:'',scrollTop:0,classList:{toggle(){},add(){},remove(){},contains:()=>false},dataset:{},querySelectorAll:()=>[],addEventListener(){},getAttribute:()=>null,setAttribute(){},appendChild(){},style:{}});
const els={};
global.document={getElementById:id=>(els[id]=els[id]||mkEl()),querySelectorAll:()=>[],addEventListener(){},documentElement:mkEl(),createElement:mkEl,body:mkEl()};
global.window={addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
global.location={hash:''};global.navigator={clipboard:null};
global.getComputedStyle=()=>({getPropertyValue:()=>'#888'});
global.Chart=function(){return{destroy(){}}};global.fetch=()=>Promise.reject(0);
const A=new Function(code+`;return {exRender,setEX:v=>{EX=v},setEXST:v=>{EXST=v},setEXOPEN:v=>{EXOPEN=v},setEXBRK:v=>{EXBRK=v},setEXSORT:v=>{EXSORT=v}};`)();
A.setEX(JSON.parse(fs.readFileSync(process.env.RD_JSON||'D:/Github/Rh1-BalanceSheet/docs/data/risk/exec.json','utf8')));
const ST=o=>({mmo:3,crisis:'all',types:{'รพศ.':true,'รพท.':true,'รพช.':true},prov:'all',ext:0,tgt:6,moeVer:'69',payPct:50,moePct:{},moePctAll:0,moeOff:{},moeOvr:{},xmoe:true,adj:{},adjAll:0,revOff:{},ovr:{},tj:{mode:'off',scope:'crisis'},inj:{},open:{provtj:true},xfer:[],arPct:100,arOvr:{},wide:false,clGrow:true,seas:true,...o});
const num=s=>{ const m=String(s).replace(/,/g,'').match(/(-?[\d.]+)\s*([BMK]?)/); if(!m) return null;
  return parseFloat(m[1])*({B:1e9,M:1e6,K:1e3,'':1}[m[2]]); };
const cell=c=>c.replace(/<span class="cellsub[\s\S]*?<\/span>/g,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
let fail=[];
const chk=(ok,m)=>{ console.log(`  ${ok?'✅':'❌'} ${m}`); if(!ok) fail.push(m); };
const M=v=>(v/1e6).toFixed(2)+'M';

for(const st of [{}, {arPct:62}, {crisis:'67'}, {crisis:'67',arPct:62}, {prov:'เชียงใหม่',arPct:62}, {types:{'รพช.':true},arPct:62}]){
  A.setEXST(ST(st)); A.setEXOPEN({}); A.setEXBRK({}); A.setEXSORT({col:null,dir:-1}); A.exRender();
  const res=els['exResBox'].innerHTML, prov=els['exProvTjBox'].innerHTML;
  // ── แถวข้อมูลของตารางผลจำลอง: <tr> ที่ขึ้นต้นด้วย <td>จังหวัด</td><td><b>ชื่อ รพ.</b>
  const simRows=[...res.matchAll(/<tr>\s*<td>([^<]*)<\/td>\s*<td[^>]*><b>([^<]+)<\/b>[\s\S]*?<\/tr>/g)].map(m=>{
    const tds=[...m[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x=>x[1]);
    return {prov:m[1], name:m[2], pay:num(cell(tds[6])), ar:num(cell(tds[7]))};
  }).filter(r=>r.prov);
  // ── แถวของตารางสรุปรายจังหวัด
  const pRows=[...prov.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m=>{
    const t=[...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x=>x[1]);
    // 6 ช่อง: จังหวัด · n · หนี้ · ลูกหนี้ · เงินช่วยภายในจังหวัด · ส่วนขาด(MOE)
    // (คอลัมน์ "สุทธิ ลูกหนี้−หนี้" ถอดออก 8 ส.ค. 69 — ยอดเงินช่วย/ส่วนขาดตรวจใน test_exec_provtj ⑦)
    return t.length===6?{prov:t[0].replace(/<[^>]+>/g,'').trim(), n:+t[1], pay:num(cell(t[2])), ar:num(cell(t[3]))}:null;
  }).filter(Boolean);
  const tot=pRows.find(r=>r.prov.includes('รวมทั้งเขต')), data=pRows.filter(r=>!r.prov.includes('รวมทั้งเขต'));
  const lab=JSON.stringify(st);
  console.log(`\n━━ สถานะ ${lab} ━━`);
  console.log(`   ตารางผลจำลอง ${simRows.length} แถว · ตารางสรุป ${data.length} จังหวัด รวม ${tot?tot.n:'?'} แห่ง`);
  chk(simRows.length>0, 'ดึงแถวจากตารางผลจำลองได้');
  chk(tot && tot.n===simRows.length, `จำนวน รพ. ตรงกัน: ผลจำลอง ${simRows.length} = สรุป ${tot?tot.n:'?'}`);
  // รวมจากตารางผลจำลองเอง แล้วเทียบรายจังหวัด (ยอมคลาดเคลื่อนตามการปัดทศนิยม 1 ตำแหน่งของ fmtM)
  const S={}; simRows.forEach(r=>{ const p=S[r.prov]||(S[r.prov]={n:0,pay:0,ar:0});
    p.n++; p.pay+=(r.pay||0); p.ar+=(r.ar||0); });
  let bad=0;
  data.forEach(d=>{ const s=S[d.prov];
    if(!s){ bad++; console.log(`      ❌ ${d.prov} ไม่มีในตารางผลจำลอง`); return; }
    const tolP=0.05e6*Math.max(1,s.n), tolA=0.05e6*Math.max(1,s.n);   // ปัด 0.1M ต่อแถว
    const okN=s.n===d.n, okP=Math.abs(s.pay-d.pay)<=tolP, okA=Math.abs(s.ar-d.ar)<=tolA;
    if(!(okN&&okP&&okA)){ bad++;
      console.log(`      ❌ ${d.prov}: n ${s.n}/${d.n} · หนี้ ${M(s.pay)}/${M(d.pay)} · ลูกหนี้ ${M(s.ar)}/${M(d.ar)}`); }
  });
  chk(bad===0, `ทุกจังหวัด: รวมจากแถวในตารางผลจำลอง = ตัวเลขในตารางสรุป (ผิด ${bad})`);
  const sn=Object.keys(S).length;
  chk(sn===data.length, `จำนวนจังหวัดตรงกัน: ผลจำลองมี ${sn} = สรุปมี ${data.length}`);
  if(tot){
    const tp=simRows.reduce((s,r)=>s+(r.pay||0),0), ta=simRows.reduce((s,r)=>s+(r.ar||0),0);
    chk(Math.abs(tp-tot.pay)<=0.05e6*simRows.length, `แถวรวม หนี้: ${M(tp)} vs ${M(tot.pay)}`);
    chk(Math.abs(ta-tot.ar)<=0.05e6*simRows.length, `แถวรวม ลูกหนี้: ${M(ta)} vs ${M(tot.ar)}`);
  }
}
// ══ ไม่มีที่ไหนหลงใช้ลูกหนี้ "ดิบ" ปนอยู่อีก ══
console.log('\n━━ ไม่มีจุดที่ยังใช้ลูกหนี้ดิบปนกับยอดหลังปรับ ━━');
const src=fs.readFileSync(SRC,'utf8');
const rawHits=[...src.matchAll(/^.*h\.tj\.arIn.*$/gm)].map(m=>m[0].trim())
  .filter(l=>!/^function exArRaw/.test(l) && !/^\/\//.test(l));
chk(rawHits.length===0, `ใช้ h.tj.arIn ดิบนอก exArRaw() เหลือ ${rawHits.length} จุด${rawHits.length?': '+rawHits[0].slice(0,90):''}`);
chk(/const creds=EX\.hosp\.filter\(h=>exIsCred\(h\) && h\.prov===prov && exArIn\(h\)>0\)/.test(src),
  'exTjCalc เกลี่ยภาระตามลูกหนี้ "หลังปรับ" (exArIn) ไม่ใช่ยอดดิบ');
chk(/v:x=>M\(exArIn\(x\.h\)\), t:\(\)=>sum\(x=>exArIn\(x\.h\)\)/.test(src),
  'ไฟล์ TSV ส่งออกลูกหนี้ยอดเดียวกับที่แสดงบนจอ');
chk(/arPct:exArPct\(\),arOvr:EXST\.arOvr/.test(src),
  '_refundCache รู้จัก arPct/arOvr (ไม่งั้นปรับ % แล้วได้ผลค้างจากรอบก่อน)');

console.log(`\n${fail.length?'❌ ไม่ผ่าน '+fail.length+' ข้อ:\n  - '+fail.join('\n  - '):'✅ สองตารางสัมพันธ์กันทุกสถานะ + ไม่มียอดดิบปน'}`);
process.exit(fail.length?1:0);
