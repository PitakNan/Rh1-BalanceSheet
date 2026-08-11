// ทดสอบ headless: คอลัมน์+ชิป "เงินสดพอจ่าย MOE" ใน Watchlist หน้าหลัก (risk_drill.html)
const fs=require('fs');
const HTML=process.argv[2]||'D:/Github/Rh1-BalanceSheet/docs/risk_drill.html';
const DATA=process.argv[3]||'D:/Github/Rh1-BalanceSheet/docs/data/risk/';
const blocks=[...fs.readFileSync(HTML,'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const code=blocks.find(b=>b.includes('function renderWatchlist'));
if(!code){ console.log('ไม่พบบล็อกที่มี renderWatchlist'); process.exit(1); }

const mk=()=>({innerHTML:'',textContent:'',scrollTop:0,classList:{toggle(){},add(){},remove(){},contains:()=>false},
  dataset:{},querySelectorAll:()=>[],addEventListener(){},getAttribute:()=>null,setAttribute(){},appendChild(){},style:{}});
const els={};
global.document={getElementById:id=>(els[id]=els[id]||mk()),querySelectorAll:()=>[],addEventListener(){},
  documentElement:mk(),createElement:()=>mk(),body:mk()};
global.window={addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
global.location={hash:''}; global.navigator={clipboard:null};
global.getComputedStyle=()=>({getPropertyValue:()=>'#888'});
global.Chart=function(){return{destroy(){}}}; global.fetch=()=>Promise.reject(0);

const A=new Function(code+`;return {renderWatchlist,wlMoeBuf,wlMoeLeft,wlMoeShort,wlMoeCell,wlMoeChip,wlMoeNote,
  setSUMMARY:v=>{SUMMARY=v}};`)();
const S=JSON.parse(fs.readFileSync(DATA+'summary.json','utf8'));
A.setSUMMARY(S);

let fail=0;
const chk=(name,cond,extra='')=>{ console.log((cond?'  ✅ ':'  ❌ ')+name+(extra?' — '+extra:'')); if(!cond)fail++; };

// 1) ฟิลด์ใหม่ครบทุกแห่ง
const noF=S.hospitals.filter(h=>h.moeMo==null||h.cn==null);
chk('summary.json มี cn+moeMo ครบ '+S.hospitals.length+' แห่ง', noF.length===0, noF.length?noF.slice(0,3).map(h=>h.name).join(','):'');

// 2) เรนเดอร์ไม่ throw + ไม่มี undefined/NaN
let html='',err=null;
try{ A.renderWatchlist(); html=els['right'].innerHTML; }catch(e){ err=e; }
chk('renderWatchlist() ไม่ throw', !err, err?err.message:'');
chk('ไม่มี undefined ใน HTML', !/undefined/.test(html));
chk('ไม่มี NaN ใน HTML', !/NaN/.test(html));
chk('มีคอลัมน์ "เงินสดพอจ่าย<br>MOE"', html.includes('เงินสดพอจ่าย<br>MOE'));

// 3) จำนวน <td> ต่อแถว = 8 (หัวตาราง 8 <th>)
const wlTbl=(html.match(/<table class="wltbl wl-card">[\s\S]*?<\/table>/)||[''])[0];
const th=((wlTbl.match(/<tr>[\s\S]*?<\/tr>/)||[''])[0].match(/<th[ >]/g)||[]).length;
const rows6=S.hospitals.filter(h=>(h.risk||0)>=6);
chk('หัวตาราง 8 คอลัมน์', th===8, 'พบ '+th);
const trs=[...html.matchAll(/<tr class="click"[\s\S]*?<\/tr>/g)].map(m=>m[0]);
chk('จำนวนแถว = รพ.วิกฤต '+rows6.length, trs.length===rows6.length, 'พบ '+trs.length);
const bad=trs.filter(t=>(t.match(/<td[ >]/g)||[]).length!==8);
chk('ทุกแถวมี 8 <td>', bad.length===0, bad.length?'ผิด '+bad.length+' แถว':'');

// 4) ตัวเลขตรงกับสูตร cn/moeMo และเส้นเทียบ = 12−เดือนที่ผ่าน (เส้นเทียบ ไม่ใช่เพดาน)
const left=A.wlMoeLeft();
// เกณฑ์ขั้นต่ำ = 3 เดือนคงที่ (ตาม SU ของ Risk Score) — ห้ามผูกกับงวด ไม่งั้นงวด ก.ย. จะได้ 0 แล้วชิปหาย
chk('เกณฑ์ขั้นต่ำ = 3 เดือน คงที่ (งวด '+S.period+')', left===3);
A.setSUMMARY({...S,period:256912});
chk('งวด ก.ย. (256912) เกณฑ์ยังเป็น 3 ไม่กลายเป็น 0', A.wlMoeLeft()===3, 'ได้ '+A.wlMoeLeft());
chk('งวด ก.ย. ชิปยังแสดง (ไม่หายทั้งแผง)', /เงินสดพอจ่าย MOE ไม่ถึง 3 เดือน/.test(A.wlMoeChip(S.hospitals.filter(h=>(h.risk||0)>=6))));
A.setSUMMARY(S);
const shortAll=A.wlMoeShort(S.hospitals), short6=A.wlMoeShort(rows6);
const expAll=S.hospitals.filter(h=>h.moeMo>0&&h.cn/h.moeMo<left);
chk('นับแห่งที่ต่ำกว่าเส้นเทียบทั้งเขต = '+expAll.length, shortAll.length===expAll.length, 'ได้ '+shortAll.length);
chk('ชิปในหัวแผงแสดง '+short6.length+'/'+rows6.length, A.wlMoeChip(rows6).includes(short6.length+'/'+rows6.length));
chk('บรรทัดสรุปอ้างทั้งเขต '+shortAll.length+'/'+S.nHosp, A.wlMoeNote(rows6).includes('<b>'+shortAll.length+'</b> จาก '+S.nHosp));

// 5) เทียบค่าที่แสดงในเซลล์กับที่คำนวณเอง ทุกแห่งในตาราง
let cellBad=[];
rows6.forEach(h=>{
  const c=A.wlMoeCell(h), rw=h.cn/h.moeMo, want=rw.toFixed(1)+' เดือน';
  if(!c.includes(want)) cellBad.push(h.name+': ควรเป็น '+want);
  const isRed=c.includes('var(--red)');
  if(isRed!==(rw<left)) cellBad.push(h.name+': สีเตือนไม่ตรงเกณฑ์');
});
chk('ค่าในเซลล์ตรงสูตร cn/moeMo ทุกแถว', cellBad.length===0, cellBad.slice(0,3).join(' · '));

// 6) เงินสดพอจ่าย MOE ต้องตรงกับแท็บ #exec (exec.json) เป๊ะ
const E=JSON.parse(fs.readFileSync(DATA+'exec.json','utf8'));
const ex={}; E.hosp.forEach(x=>{ ex[x.hcode]={cn:x.bs.cn, moeMo:Object.values(x.moe).reduce((s,v)=>s+v,0)/x.bs.mo, mo:x.bs.mo}; });
let mism=[];
S.hospitals.forEach(h=>{ const e=ex[h.hcode]; if(!e) return;
  if(Math.abs(e.moeMo-h.moeMo)>1) mism.push(h.name+' moeMo '+h.moeMo+' vs '+Math.round(e.moeMo));
  if(e.cn!==h.cn) mism.push(h.name+' cn '+h.cn+' vs '+e.cn); });
chk('cn/moeMo ตรงกับ exec.json (#exec) ทุกแห่ง', mism.length===0, mism.slice(0,3).join(' · '));

// 7) รายชื่อ 4 แห่งที่ควรจับตา (RISK_EXEC_MODEL.md 3.6) ยังออกมาเหมือนเดิม
const w=Object.fromEntries(S.hospitals.map(h=>[h.name,(h.cn/h.moeMo)]));
// ⚠️ ค่าเดือนผูกกับงวดข้อมูล ต้องอัปเดตทุกครั้งที่เดินงวด (ล่าสุด: งวด 256910 ก.ค. 69 — 11 ส.ค. 69)
//    งวด 256909 เดิม: ทุ่งหัวช้าง 0.5 · สันป่าตอง 1.2 · เทิง 0.9 · ลี้ 1.8 (ทุกแห่งเงินสดตึงขึ้นยกเว้นเทิง)
[['ทุ่งหัวช้าง',1.10],['สันป่าตอง',1.52],['เทิง',0.79],['ลี้',1.66]].forEach(([n,v])=>{
  const got=Object.keys(w).find(k=>k.includes(n));
  chk('เดือนที่พอจ่าย '+n+' ≈ '+v, got && Math.abs(w[got]-v)<0.1, got?w[got].toFixed(2):'ไม่พบชื่อ');
});

console.log('\nสรุป: '+(fail?('❌ ไม่ผ่าน '+fail+' ข้อ'):'✅ ผ่านทุกข้อ'));
console.log('ต่ำกว่าเส้นเทียบทั้งเขต '+shortAll.length+'/'+S.nHosp+' แห่ง · ในกลุ่มวิกฤต '+short6.length+'/'+rows6.length+
  ' · ขาดรวม '+(shortAll.reduce((s,h)=>s+(h.moeMo*left-h.cn),0)/1e6).toFixed(1)+' ลบ.');
console.log('น้อยสุด 6 แห่ง: '+shortAll.map(h=>({n:h.name,r:h.cn/h.moeMo})).sort((a,b)=>a.r-b.r).slice(0,6)
  .map(x=>x.n+' '+x.r.toFixed(1)+' เดือน').join(' · '));
process.exit(fail?1:0);
