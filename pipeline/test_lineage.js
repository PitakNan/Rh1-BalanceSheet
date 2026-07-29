const fs=require('fs');
const H='D:/Github/Rh1-BalanceSheet/docs/risk_drill.html';
const code=[...fs.readFileSync(H,'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(b=>b.includes('function renderLineage'));
if(!code){console.log('❌ ไม่พบ renderLineage ใน script block');process.exit(1)}
const store={};
const el={innerHTML:'',textContent:'',scrollTop:0,classList:{toggle(){},add(){},remove(){},contains:()=>false},dataset:{},querySelectorAll:()=>[],addEventListener(){},getAttribute:()=>null,setAttribute(){},appendChild(){},style:{},scrollIntoView(){store.scrolled=true}};
global.document={getElementById:id=>{store.last=id; if(id==='right')return el; return el;},querySelectorAll:()=>[],addEventListener(){},documentElement:el,createElement:()=>el,body:el};
global.window={addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};global.location={hash:''};global.navigator={clipboard:null};
global.getComputedStyle=()=>({getPropertyValue:()=>'#888'});global.Chart=function(){return{destroy(){}}};global.fetch=()=>Promise.reject(0);
const A=new Function(code+`;return {renderLineage,linSvg,linCards,linSelect,linChain,linCard,LIN_NODES,LIN_LINKS,LIN_COLS,
  setSUMMARY:v=>{SUMMARY=v},getSel:()=>LIN_SEL,getEl:()=>document.getElementById('right')};`)();
A.setSUMMARY(JSON.parse(fs.readFileSync('D:/Github/Rh1-BalanceSheet/docs/data/risk/summary.json','utf8')));
const ok=(c,l)=>console.log((c?'  ✅ ':'  ❌ ')+l);
A.renderLineage(); const out=A.getEl().innerHTML;
ok(out.length>6000,'เรนเดอร์ได้ '+out.length+' ตัวอักษร');
ok(/<svg /.test(out),'มี <svg>');
const nNode=(out.match(/class="lin-node/g)||[]).length, nLink=(out.match(/class="lin-link/g)||[]).length;
ok(nNode===A.LIN_NODES.length,`โหนดครบ ${nNode}/${A.LIN_NODES.length}`);
ok(nLink===A.LIN_LINKS.length,`เส้นเชื่อมครบ ${nLink}/${A.LIN_LINKS.length}`);
ok((out.match(/class="lin-card/g)||[]).length===7,'การ์ดอธิบาย 7 ใบ');
// ทุกโหนดต้องหาการ์ดเจอ + ทุก link ต้องชี้โหนดที่มีจริง
const ids=new Set(A.LIN_NODES.map(n=>n.id));
const badL=A.LIN_LINKS.filter(([a,b])=>!ids.has(a)||!ids.has(b));
ok(badL.length===0,'ทุกเส้นเชื่อมชี้โหนดที่มีจริง'+(badL.length?' — เสีย: '+JSON.stringify(badL):''));
const badC=A.LIN_NODES.filter(n=>!new RegExp('id="lc-'+A.linCard(n.id)+'"').test(out));
ok(badC.length===0,'ทุกโหนดมีการ์ดรองรับ'+(badC.length?' — ขาด: '+badC.map(n=>n.id).join(','):''));
// คอลัมน์ครบ + ไม่มี undefined/NaN หลุด
ok(A.LIN_COLS.every(t=>out.includes(t)),'หัวคอลัมน์ครบ 7 ขั้น');
ok(!/undefined|NaN/.test(out),'ไม่มี undefined/NaN หลุดใน HTML');
// เลือกโหนดกลางสาย: ต้องไฮไลต์เส้น + เลื่อนไปการ์ด
A.linSelect('ri'); const o2=A.getEl().innerHTML;
ok(A.getSel()==='ri','เลือกโหนด ratio_items ได้');
ok(/lin-link hot/.test(o2),'มีเส้นไฮไลต์ (hot) '+((o2.match(/lin-link hot/g)||[]).length)+' เส้น');
ok(/id="lc-bs" /.test(o2.replace(/class="lin-card on"/g,'class="lin-card on" ')) || /lin-card on/.test(o2),'การ์ดขั้น ③ ถูกไฮไลต์');
ok(store.scrolled===true,'เลื่อนไปการ์ดอัตโนมัติ');
A.linSelect('ri'); ok(A.getSel()===null,'คลิกซ้ำ = ล้างการเลือก');
// chain ต้องไล่ทั้งสาย: ต้นทาง hfo ต้องไปถึงปลายทาง ex
const ch=A.linChain('hfo'); ok(ch.has('ex')&&ch.has('exj'),'สายจาก 🌐 HFO ไล่ถึงแท็บผู้บริหารได้');
const ch2=A.linChain('ex'); ok(ch2.has('hfo'),'ย้อนจากแท็บผู้บริหารกลับถึง HFO ได้');
// viewBox ต้องไม่มีค่าเพี้ยน
const vb=out.match(/viewBox="([^"]+)"/); console.log('  viewBox =',vb&&vb[1]);
ok(vb&&vb[1].split(' ').every(v=>!isNaN(+v)),'viewBox เป็นตัวเลขถูกต้อง');
