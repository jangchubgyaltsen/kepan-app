// ===== 动画：弹窗、菜单、释义、目录、页面切换、导图展开收起、跳转滚动 =====
// 界面是整块重画的（innerHTML），所以这里不在每个弹窗里写动画，而是看「这次重画之后多了哪个弹窗、少了哪个」：
// 新出现的播入场，消失的留一个影子播退场；同一个弹窗重画（比如在学习节奏里点选项）不重播，界面就不会闪。
// 设置 → 动画 里可以换风格、调时长和幅度；系统打开「减少动态效果」时一律不播。
(function(){
const MOS={off:"关",fade:"淡入",slide:"滑入",spring:"弹性"};
Object.assign(ST,{mo:"slide",mot:240,mod:14,mopg:true,mopr:true},{});
["mo","mot","mod","mopg","mopr"].forEach(k=>{if(!STKEEP.includes(k))STKEEP.push(k)});
const RM=window.matchMedia?matchMedia("(prefers-reduced-motion: reduce)"):{matches:false};
const on=()=>ST.mo!=="off"&&!RM.matches;
const T=()=>Math.max(60,+ST.mot||240),D=()=>ST.mo==="fade"?0:Math.max(0,+ST.mod||0);
const EIN=()=>ST.mo==="spring"?"cubic-bezier(.34,1.42,.55,1)":"cubic-bezier(.22,.8,.24,1)",EOUT="cubic-bezier(.4,0,.9,.6)";
function apply(){const h=document.documentElement;h.classList.toggle("mo-on",on());h.classList.toggle("mo-press",on()&&!!ST.mopr);
 h.style.setProperty("--mo-t",T()+"ms");h.style.setProperty("--mo-e",EIN())}
if(RM.addEventListener)RM.addEventListener("change",apply);

// 每一类弹窗从哪里来：dy/dx 是位移（乘以「幅度」），s 是起始缩放
const KIND={
 scrim:{o:1},
 pop:{dy:-.35,s:.94},
 sheet:{dy:3},
 side:{dx:2.2},
 page:{dy:1.6},
 drop:{dy:-.5},
 inline:{dy:-.5},
 dialog:{dy:.6,s:.94}};
function frames(k,out){const K=KIND[k]||{},d=D();const x=(K.dx||0)*d,y=(K.dy||0)*d,s=ST.mo==="fade"?1:(K.s||1);
 const from={opacity:0,transform:`translate(${x}px,${y}px) scale(${s})`},to={opacity:1,transform:"none"};return out?[to,from]:[from,to]}
function play(el,k,out,done){if(!on()||!el.animate){done&&done();return null}
 const a=el.animate(frames(k,out),{duration:out?T()*.7:T(),easing:out?EOUT:EIN(),fill:out?"forwards":"none"});if(done)a.onfinish=done;return a}

// 认哪些元素是弹窗，以及怎样算「同一个」弹窗
const OV=[
 [".cpov",e=>"cpov:"+((e.firstElementChild||{}).className||"")+((e.querySelector("[aria-label]")||{getAttribute:()=>""}).getAttribute("aria-label")||""),"scrim",true],
 [".hsheet-bg",()=>"hsbg","scrim",true],
 [".hsheet",()=>"hsheet","sheet",true],
 [".ssheet",()=>"ssheet","sheet",true],
 [".ltsh",e=>"ltsh","sheet",true],
 [".shy",e=>"shy","sheet",true],
 [".hmenu",e=>"hmenu:"+((e.closest("[data-w]")||{dataset:{}}).dataset.w||""),"pop",true],
 [".aapop",()=>"aapop","pop",true],
 [".tocov",()=>"tocov","page",true],
 [".hchaps",e=>"hchaps:"+((e.closest("[data-w]")||{dataset:{}}).dataset.w||""),"drop",false],
 [".shyin",e=>"shyin:"+((e.closest(".row")||{dataset:{}}).dataset.id||"")+":"+(SHY?SHY.gi:""),"inline",false]];
const SEL=OV.map(o=>o[0]).join(",");
let prev=new Map(),scr=null;
function kindOf(e,k){if(e.classList.contains("shy")&&e.classList.contains("side"))return "side";return k}
function enter(e,k){play(e,k);if(k==="scrim"){const p=e.querySelector(".cfd,.cpsh");if(p)play(p,"dialog")}}
function leave(v){const app=dev.querySelector(".app");if(!app||!on())return;const e=v.e,r=v.r;if(!r||!r.width)return;
 e.classList.add("mo-ghost");Object.assign(e.style,{position:"fixed",left:r.left+"px",top:r.top+"px",width:r.width+"px",height:r.height+"px",right:"auto",bottom:"auto",margin:"0",pointerEvents:"none",maxHeight:"none"});
 app.appendChild(e);const p=v.k==="scrim"&&e.querySelector(".cfd,.cpsh");if(p)play(p,"dialog",true);play(e,v.k,true,()=>e.remove())}
function scan(){const now=new Map();const els=dev.querySelectorAll(SEL);
 els.forEach(e=>{if(e.classList.contains("mo-ghost"))return;const o=OV.find(o=>e.matches(o[0]));if(!o)return;const key=o[1](e);if(now.has(key))return;now.set(key,{e,k:kindOf(e,o[2]),g:o[3]})});
 const same=scr===ST.screen;
 now.forEach((v,key)=>{const p=prev.get(key);if(!p){if(same)enter(v.e,v.k)}if(v.g)v.r=v.e.getBoundingClientRect()});
 if(same)prev.forEach((v,key)=>{if(!now.has(key)&&v.g&&!v.e.isConnected)leave(v)});
 prev=now;scr=ST.screen}
const mo=new MutationObserver(ms=>{if(ms.every(m=>[...m.addedNodes,...m.removedNodes].every(n=>n.nodeType!==1||n.classList.contains("mo-ghost"))))return;scan()});
mo.observe(dev,{childList:true,subtree:true});

// 页面切换：书架 → 阅读 / 设置 / 导入 → 学习，往里走从右边进，往回走从左边进
const DEPTH={home:0,reader:1,settings:1,import:1,study:2};
let lastScr=null;
const _render=render;
render=function(){apply();const from=lastScr;const r=_render.apply(this,arguments);lastScr=ST.screen;
 if(from&&from!==ST.screen&&ST.mopg&&on()&&!dev.classList.contains("enter")){const a=dev.querySelector(".app");if(a&&a.animate){const back=(DEPTH[ST.screen]??1)<(DEPTH[from]??1);const x=(back?-1:1)*D()*2;
  a.animate([{opacity:0,transform:`translateX(${x}px)`},{opacity:1,transform:"none"}],{duration:T()*1.1,easing:EIN()})}}
 return r};

// 跳到某一科：一屏半以内平滑滚过去（返回用了多少毫秒），再远就直接到
let sc=null;
function scroll(box,top){if(sc){cancelAnimationFrame(sc.raf);sc=null}if(!on())return 0;const y0=box.scrollTop,dy=top-y0,h=box.clientHeight||1;
 if(Math.abs(dy)<2||Math.abs(dy)>h*1.6)return 0;const dur=Math.round(Math.min(T()*2.2,T()+Math.abs(dy)/h*T()*.8));const t0=performance.now();
 const ease=p=>1-Math.pow(1-p,3);const stop=()=>{if(sc){cancelAnimationFrame(sc.raf);sc=null}box.removeEventListener("wheel",stop);box.removeEventListener("touchstart",stop)};
 box.addEventListener("wheel",stop,{passive:true,once:true});box.addEventListener("touchstart",stop,{passive:true,once:true});
 const step=t=>{const p=Math.min(1,(t-t0)/dur);box.scrollTop=y0+dy*ease(p);if(p<1)sc.raf=requestAnimationFrame(step);else stop()};sc={raf:requestAnimationFrame(step)};return dur}
// 远跳之后，落点那一科淡淡亮一下，眼睛知道到了哪里
function land(row){if(!row||!on()||!row.animate)return;row.animate([{backgroundColor:"color-mix(in srgb,var(--k0) 16%,transparent)"},{backgroundColor:"transparent"}],{duration:T()*4,easing:"ease-out"})}
function fadeOut(el,done){if(!on()||!el.animate){done();return}let ok=false;const fin=()=>{if(!ok){ok=true;done()}};play(el,"inline",true,fin);setTimeout(fin,T()+80)}

// 导图展开 / 收起：节点从原来的位置挪到新位置，新长出来的从父节点里滑出来，收起的缩回父节点，连线随后淡入
function mapFlip(el,run,pivot){const c0=el.querySelector(".mmc");if(!on()||!c0||!c0.animate){run();return}
 const key=e=>e.dataset.id+(e.classList.contains("vb")?"~v":"");const pos=e=>[parseFloat(e.style.left)||0,parseFloat(e.style.top)||0];
 const old=new Map();c0.querySelectorAll(".nd").forEach(e=>old.set(key(e),{p:pos(e),e}));if(old.size>700){run();return}
 const tx0=MS.tx,ty0=MS.ty,k0=MS.k;run();
 // 点节点之后外面还会挪画布让被点的节点不动，挪完再算偏移
 Promise.resolve().then(()=>{const c=el.querySelector(".mmc");if(c&&c!==c0)go(c)});
 function go(c){const ox=(tx0-MS.tx)/MS.k,oy=(ty0-MS.ty)/MS.k,sk=k0/MS.k;const pv=old.get(pivot)||null;const nn=new Map();c.querySelectorAll(".nd").forEach(e=>nn.set(key(e),e));
  const pn=nn.get(pivot);const pvNew=pn?pos(pn):null;const t=T()*1.15,ez=EIN();
  nn.forEach((e,k)=>{const [x,y]=pos(e);const o=old.get(k);if(o){const dx=o.p[0]*sk+ox-x,dy=o.p[1]*sk+oy-y;if(Math.abs(dx)+Math.abs(dy)>.5)e.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:"none"}],{duration:t,easing:ez})}
   else if(pv){const dx=pv.p[0]*sk+ox-x,dy=pv.p[1]*sk+oy-y;e.animate([{transform:`translate(${dx}px,${dy}px) scale(.6)`,opacity:0},{transform:"none",opacity:1}],{duration:t,easing:ez})}
   else e.animate([{opacity:0},{opacity:1}],{duration:t})});
  if(pvNew)old.forEach((o,k)=>{if(nn.has(k))return;const g=o.e;g.classList.add("mo-ghost");g.style.left=o.p[0]*sk+ox+"px";g.style.top=o.p[1]*sk+oy+"px";g.style.pointerEvents="none";c.appendChild(g);
   const dx=pvNew[0]-(o.p[0]*sk+ox),dy=pvNew[1]-(o.p[1]*sk+oy);g.animate([{transform:"none",opacity:1},{transform:`translate(${dx}px,${dy}px) scale(.6)`,opacity:0}],{duration:t*.8,easing:EOUT,fill:"forwards"}).onfinish=()=>g.remove()});
  const sv=c.querySelector("svg");if(sv)sv.animate([{opacity:0},{opacity:0,offset:.45},{opacity:1}],{duration:t,easing:"ease-out"})}}

// ===== 设置里的「动画」一栏 =====
const _rs=renderSettings;
renderSettings=function(){const r=_rs.apply(this,arguments);try{mount()}catch(e){console.warn(e)}return r};
function summaryLine(){return `${MOS[ST.mo]}${ST.mo==="off"?"":` · 时长 ${ST.mot}ms${ST.mo==="fade"?"":` · 幅度 ${ST.mod}px`} · 翻页${ST.mopg?"开":"关"} · 按下回弹${ST.mopr?"开":"关"}`}`}
function mount(){const sin=dev.querySelector(".settings .sin");if(!sin)return;const hs=[...sin.querySelectorAll(".sh")];const at=hs.find(h=>h.textContent==="复习")||hs[2];
 const sys=RM.matches?`<span class="sv">系统开了「减少动态效果」，现在不播动画</span>`:"";
 const rng=(id,min,max,step,v,l,r,unit)=>`<div class="srng"><small style="font-size:12px">${l}</small><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${v}"><small style="font-size:12px">${r}</small><output>${v}${unit}</output></div>`;
 const off=ST.mo==="off";
 const html=`<div class="sh">动画</div><div class="sc mosc"><div class="sr col"><b>动画风格</b>${sys}<div class="schips" role="group" aria-label="动画风格">${Object.entries(MOS).map(([k,t])=>`<button data-mo="${k}" aria-pressed="${ST.mo===k}">${t}</button>`).join("")}</div>
  ${off?"":`${rng("s-mot",120,520,20,ST.mot,"快","慢","ms")}${ST.mo==="fade"?"":rng("s-mod",0,40,1,ST.mod,"轻","大","px")}
  <div class="modemo" aria-hidden="true"><div class="mdsheet"><i></i><b>甲二、所入之自性</b><span>弹窗、菜单、释义都按这个样子出现</span></div></div>
  <button class="mo-replay" data-moplay>重放</button>`}</div>
  ${off?"":`<div class="sr"><b>翻页动画</b><span class="sv" style="flex:1">书架、阅读、学习之间切换时</span><button class="stog" data-motog="mopg" aria-pressed="${!!ST.mopg}" aria-label="翻页动画"></button></div>
  <div class="sr"><b>按下回弹</b><span class="sv" style="flex:1">按钮和书卡按下时轻轻一缩</span><button class="stog" data-motog="mopr" aria-pressed="${!!ST.mopr}" aria-label="按下回弹"></button></div>`}
  <div class="sr col"><span class="sv mocur">当前数值：${summaryLine()}</span></div></div>`;
 if(at)at.insertAdjacentHTML("beforebegin",html);else sin.insertAdjacentHTML("beforeend",html);
 const sb=dev.querySelector(".sbody");const re=()=>{const y=sb?sb.scrollTop:0;apply();renderSettings();const s2=dev.querySelector(".sbody");if(s2)s2.scrollTop=y;save()};
 const demo=()=>{const d=dev.querySelector(".mdsheet");if(d)play(d,"sheet")};
 dev.querySelectorAll("[data-mo]").forEach(b=>b.onclick=()=>{ST.mo=b.dataset.mo;re();demo()});
 dev.querySelectorAll("[data-motog]").forEach(b=>b.onclick=()=>{const k=b.dataset.motog;ST[k]=!ST[k];re()});
 const pb=dev.querySelector("[data-moplay]");if(pb)pb.onclick=demo;
 [["s-mot","mot","ms"],["s-mod","mod","px"]].forEach(([id,k,u])=>{const i=dev.querySelector("#"+id);if(!i)return;
  i.oninput=()=>{ST[k]=+i.value;i.parentNode.querySelector("output").textContent=i.value+u;apply();const c=dev.querySelector(".mocur");if(c)c.textContent="当前数值："+summaryLine()};
  i.onchange=()=>{save();demo()}})}

window.MO={scroll,land,fadeOut,mapFlip,play,apply,on};
apply();
})();
