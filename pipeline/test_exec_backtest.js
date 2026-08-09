// ⭐ Backtest: โมเดลทำนายทิศทางถูกไหม เทียบกับสิ่งที่เกิดขึ้นจริงปี 2567/2568
// เจ้าของงานทักว่า "ระดับ ณ ก.ย. ไม่น่าจะเป็น 0 ได้" (6 ส.ค. 69) → ตรวจแล้วพบว่าถูก
//   ของจริง ด.9→ด.12: ปี67 ดีขึ้น 21/แย่ลง 33 · ปี68 ดีขึ้น 7/แย่ลง 65
//   โมเดลเดิม (ตรึง CL + ลาก NI ต้นปี): ดีขึ้น 29/แย่ลง 0  ← ผิดทิศชัดเจน
// ชุดตรวจนี้ล็อกไว้ว่าโมเดลต้อง "ทำนายว่ามีแห่งที่แย่ลงด้วย" ไม่ใช่ดีขึ้นอย่างเดียว
const fs=require('fs'),path=require('path');
// ⚠️ ต้องอิง __dirname ไม่ใช่ cwd — เดิมเป็น 'docs/data/risk/h' ทำให้ ENOENT ถ้ารันจากโฟลเดอร์ pipeline
//    (ชุดตรวจอื่นรันได้ทั้งสองที่ ชุดนี้ชุดเดียวที่พัง — แก้ 9 ส.ค. 69)
const dir=path.join(__dirname,'..','docs','data','risk','h');
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.json'));
const dist=r=>[0,1,2,3,4,5,6,7].map(L=>L+'×'+(r[L]||0)).join(' ');
for(const fy of [2567,2568]){
  const d9={},d12={}; let n=0, up=0, down=0, same=0, to0=0, clUp=0, clDn=0, clSame=0, clSum9=0, clSum12=0;
  for(const f of files){
    let j; try{ j=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')); }catch(e){ continue; }
    if(!j.trend) continue;
    const a=j.trend.find(r=>r.t===fy*100+9), b=j.trend.find(r=>r.t===fy*100+12);
    if(!a||!b||a.risk==null||b.risk==null) continue;
    n++; d9[a.risk]=(d9[a.risk]||0)+1; d12[b.risk]=(d12[b.risk]||0)+1;
    if(b.risk<a.risk) down++; else if(b.risk>a.risk) up++; else same++;
    if(b.risk===0&&a.risk>0) to0++;
    if(a.cl&&b.cl){ clSum9+=a.cl; clSum12+=b.cl;
      if(b.cl>a.cl*1.01) clUp++; else if(b.cl<a.cl*0.99) clDn++; else clSame++; }
  }
  if(!n){ console.log('ปีงบ '+fy+': ไม่มีข้อมูลครบ'); continue; }
  console.log('══ Backtest ปีงบ '+fy+' ('+n+' รพ. ที่มีทั้งเดือน 9 และ 12) ══');
  console.log('  ระดับ ณ เดือน 9  : '+dist(d9));
  console.log('  ระดับ ณ เดือน 12 : '+dist(d12));
  console.log('  → ดีขึ้น '+down+' แห่ง · แย่ลง '+up+' · เท่าเดิม '+same+'   (ที่ลงมาเป็น 0 จากที่ไม่ใช่ 0: '+to0+' แห่ง)');
  console.log('  → ระดับ 0 : '+(d9[0]||0)+' แห่ง (ด.9) → '+(d12[0]||0)+' แห่ง (ด.12)   เปลี่ยน '+(((d12[0]||0)-(d9[0]||0))>=0?'+':'')+((d12[0]||0)-(d9[0]||0)));
  console.log('  → หนี้สินหมุนเวียนรวม: '+(clSum9/1e9).toFixed(2)+'B (ด.9) → '+(clSum12/1e9).toFixed(2)+'B (ด.12)  = '+(((clSum12/clSum9-1)*100)).toFixed(1)+'%');
  console.log('     รายแห่ง: โตขึ้น '+clUp+' · ลดลง '+clDn+' · เท่าเดิม '+clSame+'  ⚠️ โมเดลตรึง CL ไว้คงที่ 103/103');
  console.log('');
}


// ══ โมเดลปัจจุบันต้องทำนายทิศทางสอดคล้องกับประวัติ ══
const codeSrc=fs.readFileSync('D:/Github/Rh1-BalanceSheet/docs/risk_drill.html','utf8');
const code=[...codeSrc.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(b=>b.includes('function exBrkHtml'));
const el={innerHTML:'',textContent:'',scrollTop:0,value:'',classList:{toggle(){},add(){},remove(){},contains:()=>false},dataset:{},querySelectorAll:()=>[],addEventListener(){},getAttribute:()=>null,setAttribute(){},appendChild(){},style:{}};
global.document={getElementById:()=>el,querySelectorAll:()=>[],addEventListener(){},documentElement:el,createElement:()=>el,body:el};
global.window={addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
global.location={hash:''}; global.navigator={clipboard:null};
global.getComputedStyle=()=>({getPropertyValue:()=>'#888'});
global.Chart=function(){return{destroy(){}}}; global.fetch=()=>Promise.reject(0);
const A=new Function(code+';return {exSimPath,setEX:v=>{EX=v},setEXST:v=>{EXST=v},setEXTJ:v=>{EXTJ=v}};')();
const ex=JSON.parse(fs.readFileSync('D:/Github/Rh1-BalanceSheet/docs/data/risk/exec.json','utf8'));
A.setEX(ex); A.setEXTJ({debtors:new Set(),shares:{},refund:{},total:0,uncovered:0});
const mkST=o=>Object.assign({mmo:3,ext:0,tgt:6,crisis:'all',types:{'รพศ.':true,'รพท.':true,'รพช.':true},prov:'all',
  moePct:{},moePctAll:0,moeOff:{},moeOvr:{},xmoe:true,adj:{},adjAll:0,revOff:{},ovr:{},
  tj:{mode:'off',scope:'crisis'},inj:{},open:{},xfer:[],arPct:100,arOvr:{},wide:false,clGrow:true,seas:true},o);
let bad=[];
const chk=(ok,m)=>{ console.log('  '+(ok?'✅':'❌')+' '+m); if(!ok) bad.push(m); };
console.log('══ โมเดลปัจจุบัน (ปีงบ 2569) ══');
A.setEXST(mkST({}));
let up=0,down=0,same=0,z=0;
ex.hosp.forEach(h=>{ const r=A.exSimPath(h,0);
  if(r.sepRisk<h.risk) down++; else if(r.sepRisk>h.risk) up++; else same++;
  if(r.sepRisk===0) z++; });
console.log('  ดีขึ้น '+down+' · แย่ลง '+up+' · เท่าเดิม '+same+' · ระดับ 0 = '+z+' แห่ง');
chk(up>0, `ต้องมี รพ. ที่ "แย่ลง" ณ ก.ย. ด้วย (ได้ ${up} แห่ง) — ของจริงปี 67/68 แย่ลง 33 และ 65 แห่ง`);
chk(up>=10, `จำนวนที่แย่ลงต้องอยู่ในระดับที่สมจริง ≥10 แห่ง (ได้ ${up})`);
chk(z<=45, `ระดับ 0 ต้องไม่บวมเกินจริง ≤45 แห่ง (ได้ ${z}) — ของจริง ณ ด.12 ปี67=17 ปี68=11 แห่ง`);
// ตัวเลือกฤดูกาลต้องมีผลจริง (กันโดนปิดโดยไม่ตั้งใจแล้วเงียบ)
A.setEXST(mkST({seas:false,clGrow:false}));
let up0=0; ex.hosp.forEach(h=>{ if(A.exSimPath(h,0).sepRisk>h.risk) up0++; });
chk(up>up0, `เปิดปัจจัยฤดูกาลแล้วทำนาย "แย่ลง" มากกว่าตอนปิด (${up0} → ${up} แห่ง) = ตัวเลือกมีผลจริง`);
console.log('');
console.log(bad.length?('❌ ไม่ผ่าน '+bad.length+' ข้อ'):'✅ ผ่านทุกข้อ');
process.exit(bad.length?1:0);
