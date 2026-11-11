
const NUM=["","一","二","三","四","五","六","七","八","九","十"];
const esc=s=>s.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function hsh(i){i=(i*2654435761)>>>0;return (i>>>13)%97}
function verseMaskHTML(stanzas,r){let ci=0;return `<div class="verse vm">${stanzas.map(s=>{const ph=s.match(/[^，。！？：?!]+(?:[，。！？：?!]+|$)/g)||[s];const lines=[];
 const P=x=>{let out="";[...x].forEach((ch,j)=>{const pun=/[，。！？：；、?!]/.test(ch);const k=ci++;let m=false;if(!pun){if(r===1)m=hsh(k)%3===0;else if(r===2)m=hsh(k)%3!==0;else if(r>=3)m=j>0}out+=m?`<span class="mk">${esc(ch)}</span>`:esc(ch)});return out};
 for(let i=0;i<ph.length;i+=2)lines.push(ph.slice(i,i+2).map(x=>`<span class="ph">${P(x)}</span>`).join(""));
 return lines.map(l=>`<span class="ln">${l}</span>`).join("")}).join('<span class="ln" style="height:.5em"></span>')}</div>`}
const RND=["通读","遮三分之一","遮三分之二","只留首字"],RNDC=["通读","下半首自己接","只给第一句","只给第一个字"];
const SHIYI={};
// 引导文类的书（科判树 meta.kind = "guide"）：每一行要显示的全文，{行 id: {items}}，阅读页直接排出来
const PROSE={};
function proseHTML(n){const sec=PROSE[n.bk]&&PROSE[n.bk][n.id];if(!sec)return PROSE[n.bk]?"":`<p class="p0">正文载入中…</p>`;
 const its=sec.items||[],o=[],fn=[];let i=0;const sup=t=>esc(t).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g,m=>`<sup>${[...m].map(c=>"⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(c)).join("")}</sup>`);
 while(i<its.length){const it=its[i];
  if(it.type==="verse"){const g=[];while(i<its.length&&its[i].type==="verse")g.push(its[i++]);o.push(`<div class="pv">${g.map(x=>`<span>${sup(x.text)}</span>`).join("")}</div>`);continue}
  if(it.type==="ritual"){const g=[];while(i<its.length&&its[i].type==="ritual")g.push(its[i++]);
   o.push(`<div class="pr${g.some(x=>x.py||x.zh)?"":" pbo"}">${g.map(x=>`<div class="prl${x.head?" prh":""}${x.zh&&x.s!=null?" prv":""}">${x.bo?`<span class="rbo">${esc(x.bo)}</span>`:""}${x.py?`<span class="rpy">${sup(x.py)}</span>`:""}${x.zh?`<span class="rzh">${sup(x.zh)}</span>`:""}</div>`).join("")}</div>`);continue}
  i++;if(it.type==="footnote"){fn.push(it);continue}
  o.push(it.type==="title"?`<p class="pti">${sup(it.text)}</p>`:it.type==="small"?`<p class="psm">${sup(it.text)}</p>`:`<p>${sup(it.text)}</p>`)}
 if(fn.length)o.push(`<div class="pfn">${fn.map(x=>`<p><b>${x.n}</b>${esc(x.text)}</p>`).join("")}</div>`);
 return `<div class="prose">${o.join("")}</div>`}
let SHY=null;
function shyG(bk,id){const it=SHIYI[bk]&&SHIYI[bk][id];if(!it)return null;const G=[];let c=null;
 it.forEach(x=>{if(x[0]==="v"){if(!c||c.t.length){c={vs:[],l:[],t:[]};G.push(c)}if(!c.vs.includes(x[2]))c.vs.push(x[2]);c.l.push(x[1])}else{if(!c){c={vs:[],l:[],t:[]};G.push(c)}c.t.push(x)}});return G}
function shyList(){const bk=bkKey(BK);const L=[];BK.seq.forEach(n=>{const G=shyG(bk,n.id);if(G)G.forEach((g,gi)=>L.push({n,gi}))});return L}
function shyBody(g,withV){const ps=g.t.filter(x=>x[0]!=="n"),ns=g.t.filter(x=>x[0]==="n");
 return `${withV?`<div class="shyv">${g.l.map(x=>`<span>${esc(x)}</span>`).join("")}</div>`:""}${ps.length?ps.map(x=>`<p${x[0]==="g"?' class="shyg"':""}>${esc(x[1])}</p>`).join(""):`<p class="shy0">讲记里这几句和下一段合在一起解释。</p>`}${ns.length?`<div class="shyn">${ns.map(x=>{const m=x[1].match(/^(\d+)\s*([\s\S]*)$/);return `<p><b>注${m?m[1]:""}</b>${esc(m?m[2]:x[1])}</p>`}).join("")}</div>`:""}`}
function shyNav(){const L=shyList();const i=L.findIndex(x=>x.n.id===SHY.id&&x.gi===SHY.gi);return `<div class="shyf"><button data-shyn="-1" ${i<=0?"disabled":""}>‹ 上一段</button><span>${i+1} / ${L.length}</span><button data-shyn="1" ${i>=L.length-1?"disabled":""}>下一段 ›</button></div>`}
function shyIns(n){if(ST.shym!=="inline"||!SHY||SHY.id!==n.id||SHY.bk!==bkKey(BK))return null;const g=shyG(SHY.bk,n.id)[SHY.gi];if(!g)return null;
 const last=g.vs[g.vs.length-1];return {[last]:`<div class="shyin" style="--sf:${ST.shyf}px"><div class="shyh"><span class="shyl">${esc((BK.syName||"").split(/[·•]/).pop())} · 释义</span><button data-shyx aria-label="收起">收起 ⌃</button></div><div class="shyb">${shyBody(g,false)}</div></div>`}}
function shyMark(rw){rw.querySelectorAll(".stz.on").forEach(x=>x.classList.remove("on"));rw.querySelectorAll(".verse.shyon").forEach(x=>x.classList.remove("shyon"));if(!SHY||SHY.bk!==bkKey(BK))return;
 const row=rw.querySelector(`.row[data-id="${SHY.id}"]`);const G=shyG(SHY.bk,SHY.id);if(!row||!G||!G[SHY.gi])return;const v=row.querySelector(".verse");v&&v.classList.add("shyon");G[SHY.gi].vs.forEach(si=>{const e=row.querySelector(`.stz[data-si="${si}"]`);e&&e.classList.add("on")})}
function shySheet(app){const old=app.querySelector(".shy");const keep=old&&SHY&&ST.shym!=="inline"&&SHY.bk===bkKey(BK);if(old&&!keep)old.remove();if(!keep)app.classList.remove("shy-open");if(!SHY||ST.shym==="inline"||SHY.bk!==bkKey(BK))return;
 const n=BK.by[SHY.id],g=shyG(SHY.bk,SHY.id)[SHY.gi];const W=wide();const el=keep?old:document.createElement("div");if(!keep)el.className="shy "+(W?"side":"sheet");el.style.setProperty("--sf",ST.shyf+"px");
 el.innerHTML=`${W?"":'<span class="shyhd"></span>'}<div class="shyh">${badge(n)}<span class="shyt">${esc(n.title)}</span><button data-shyx aria-label="关闭">✕</button></div><div class="shyb">${shyBody(g,ST.shyv==="on")}${BK.syName?`<p class="shysrc">——《${esc(BK.syName)}》</p>`:""}</div>${shyNav()}`;
 if(keep){el.querySelector(".shyb").scrollTop=0;return el}(W?app.querySelector(".body"):app).appendChild(el);if(!W)app.classList.add("shy-open");return el}

function verseHTML(stanzas,ins,cls){return `<div class="verse ${cls||""}">${stanzas.map((s,si)=>{const ph=s.match(/[^，。！？：?!]+(?:[，。！？：?!]+|$)/g)||[s];const lines=[];
 for(let i=0;i<ph.length;i+=2)lines.push(ph.slice(i,i+2).map(x=>`<span class="ph">${esc(x)}</span>`).join(""));
 return `<span class="stz" data-si="${si}">${lines.map(l=>`<span class="ln">${l}</span>`).join("")}</span>${ins&&ins[si]||""}`}).join('<span class="ln" style="height:.5em"></span>')}</div>`}
const STEMS="甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥";
// ===== 书的数据：把 data/<id>.json 的科判树转成界面用的节点 =====
const CNUM=n=>{if(n==null)return "";if(n<=10)return NUM[n];if(n<20)return "十"+NUM[n-10];const t=Math.floor(n/10),u=n%10;return NUM[t]+"十"+(u?NUM[u]:"")};
const BOOKS={};let BK=null;
// 科判树里的颂词：只要 kind=verse 的诗句；note（如「第九品释终」）单独存
function vsOf(raw,after){const v=[],no=[];(raw.verses||[]).forEach(x=>{if(!!after!==(x.pos==="after"))return;if(x.kind==="verse")v.push(...(x.stanzas&&x.stanzas.length?x.stanzas:[x.text]));else if(x.text)no.push(x.text)});return [v,no]}
function buildBook(info,tree,shiyi){const id=info.id;const meta=Object.assign({},tree.meta||{},info.meta||{});
 const short=meta.shortName||(meta.title||id).split(/\s+/)[0];
 const R={id:"_root",code:"",title:short,v:[],c:[],depth:0,bk:id};const all=[R],seq=[],by={_root:R},front=[],tails=[];
 const mk=(raw,p,lvl)=>{const lv=raw.level;const leaf=!(raw.children&&raw.children.length);const [v,no]=vsOf(raw,false);
  const n={id:raw.id,code:lv?lv+CNUM(raw.num):"",title:raw.name||raw.raw||"",v:leaf?v:[],notes:no,c:[],depth:Math.max(0,STEMS.indexOf(lv)),bk:id,p,lvl,ch:raw.chapter||null,ne:!!raw.noexp};
  by[n.id]=n;all.push(n);
  if(!leaf){n.c=raw.children.map(k=>mk(k,n,lvl+1));
   const [tv,tn]=vsOf(raw,true);const iv=leaf?[]:v;// 有子科判又在本科下直接写的颂词：放在子科判之后单独一行
   const allv=[...iv,...tv],alln=[...tn];if(allv.length||alln.length){const t={id:n.id+"~",code:n.code,title:n.title,v:allv,notes:alln,c:[],depth:n.depth,bk:id,p:n,lvl:lvl+1,x:true};by[t.id]=t;n.tl=t}}
  return n};
 let seen=false;// 正文之后没有层级的段落（如「科判之结文」）放在书末，之前的（如顶礼）放在书首
 (tree.tree||[]).forEach(raw=>{
  if(raw.part){seen=true;R.c.push(mk(raw,R,1))}// 引导文书前的念诵仪轨：自成一部分，排在正文前面
  else if(!raw.level&&raw.children&&raw.children.length){seen=true;// 论名那一层：当作整本书的根
   meta.rootTitle=raw.name;raw.children.forEach(k=>R.c.push(mk(k,R,1)));const [tv,tn]=vsOf(raw,true);const [iv]=vsOf(raw,false);
   if(tv.length||iv.length||tn.length)tails.push({id:raw.id+"~",code:"",title:"",v:[...iv,...tv],notes:tn,c:[],depth:0,bk:id,p:R,lvl:1,x:true})}
  else if(!raw.level){const [v,no]=vsOf(raw,false);(seen?tails:front).push({id:raw.id,code:"",title:raw.name||"",v,notes:no,c:[],depth:0,bk:id,p:R,lvl:1,x:true})}
  else{seen=true;R.c.push(mk(raw,R,1))}});
 front.concat(tails).forEach(n=>{by[n.id]=n});
 const walk=n=>{if(!n.c.length){if(n!==R)seq.push(n);return}n.c.forEach(walk);if(n.tl)seq.push(n.tl)};
 seq.push(...front);walk(R);seq.push(...tails);
 const seqI={};seq.forEach((n,i)=>seqI[n.id]=i);
 // 品：节点上标了 chapter 的是一品的开头；第一品之前的科判（论名、礼赞等）算进第一品，最后的回向偈算进最后一品
 const chaps=[],pre=[];let cur=null;const addLeaf=n=>(cur?cur.leaves:pre).push(n);
 (function w(n){if(n.ch){cur={name:n.ch.replace(/^第[一二三四五六七八九十百]+品\s*/,"")||n.ch.replace(/\s+/g,""),full:n.ch,node:n,leaves:[]};chaps.push(cur)}if(n!==R&&!n.c.length)addLeaf(n);n.c.forEach(w);if(n.tl)addLeaf(n.tl)})(R);
 if(chaps.length){chaps[0].leaves.unshift(...front,...pre);chaps[chaps.length-1].leaves.push(...tails)}
 chaps.forEach(c=>{c.first=c.leaves[0]||fl(c.node);c.vs=c.leaves.reduce((a,n)=>a+n.v.length,0)});
 const chOf={};chaps.forEach(c=>c.leaves.forEach(n=>chOf[n.id]=c));
 const prose=(meta.kind||"")==="guide";if(prose){if(shiyi&&shiyi.sections)PROSE[id]=shiyi.sections}
 const sy=!prose&&shiyi&&shiyi.sections?shiyiOf(shiyi):null;if(sy)SHIYI[id]=sy;else delete SHIYI[id];
 const syName=syNameOf(shiyi);
 if(prose&&R.c.some(n=>n.ne))R.ne=true;// 有念诵仪轨这一部分时，书的第一层不出「展开」题（「全文分二」不含仪轨）
 const B={id,prose,root:R,title:short,all,seq,seqI,by,maxA:Math.max(1,...seq.map(n=>n.lvl))-1,meta,chaps,chOf,syName,builtin:!!info.builtin,info,tree};
 B.bfs=(()=>{const q=[R],o=[];while(q.length){const n=q.shift();o.push(n);q.push(...n.c)}return o})();
 const W={id,title:short,long:meta.name||meta.rootTitle||short,full:meta.name||meta.title||short,roles:(meta.roles||[]).map(r=>[r.name,r.role]),compiler:meta.compiler||"",proof:meta.proofreaders||[],
  shiyi:info.shiyiName||(syName?"《"+syName+"》":null),ed:meta.edition||"",date:fmtDate(meta.date),chaps:chaps.map(c=>c.name),real:true,vs:seq.reduce((a,n)=>a+n.v.length,0),builtin:!!info.builtin,errata:tree.corrections||[],notes:tree.notes||[]};
 return {B,W}}
function syNameOf(shiyi){const ep=shiyi&&shiyi.source&&shiyi.source.epub&&shiyi.source.epub.title||"";return ep?ep.replace(/^译作\s*\d+\s*/,"").replace(/[-_ ]?epub$/i,"").trim():""}
function fmtDate(d){d=String(d||"");const m=d.match(/^(\d{4})(\d{2})(\d{2})$/);return m?`${m[1]}-${m[2]}-${m[3]}`:d}
// 释义：{节点 id: [[类型, 文字, 第几颂]]}，类型 v 颂词 / p 释文 / n 脚注 / g 附偈
function shiyiOf(s){const o={};Object.entries(s.sections||{}).forEach(([id,sec])=>{let last=0;const a=[];
  (sec.items||[]).forEach(it=>{if(it.type==="chapter"||it.type==="chapterEnd")return;
   if(it.type==="verse"){if(it.stanza!=null)last=it.stanza;a.push(["v",it.text,last])}else if(it.type==="footnote")a.push(["n",it.text]);else if(it.type==="gatha")a.push(["g",it.text]);else a.push(["p",it.text])});
  if(a.length)o[id]=a});return o}
function installBook(info,tree,shiyi){const {B,W}=buildBook(info,tree,shiyi);BOOKS[B.id]=B;const i=WORKS.findIndex(w=>w.id===W.id);if(i>=0)WORKS[i]=W;else WORKS.push(W);if(!BK||BK.id===B.id)BK=B;return B}
const anc=n=>{const a=[];let p=n.p;while(p&&p.p){a.unshift(p);p=p.p}return a};
const fl=n=>{while(n.c.length)n=n.c[0];return n};
const ll=n=>{while(n.c.length)n=n.c[n.c.length-1];return n};
const H2=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const HX=a=>"#"+a.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,"0")).join("");
const MIX=(a,b,t)=>{const A=H2(a),B=H2(b);return HX(A.map((v,i)=>v+(B[i]-v)*t))};
const GR=(stops,t)=>{t=Math.min(1,Math.max(0,t));const x=t*(stops.length-1),i=Math.min(stops.length-2,Math.floor(x));return MIX(stops[i],stops[i+1],x-i)};
const LUM=h=>{const [r,g,b]=H2(h).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*r+.7152*g+.0722*b};
const isDark=()=>{const t=document.documentElement.dataset.theme;return t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches)};

const PAL={
 alt:{name:"冷暖交替",r:"层级 ★★★ · 区分 ★★★",f:(i,n)=>GR(i%2?["#1F3A5F","#2E6577","#4E8F86","#8DB7A3"]:["#6B1E2A","#A3402C","#C27A25","#C9A34A"],i/Math.max(1,n))},
 robe:{name:"僧袍渐变",r:"层级 ★★★ · 区分 ★★",f:(i,n)=>GR(["#5E1A24","#8E2C2C","#B5532A","#C98A1B","#C2A24A"],i/Math.max(1,n))},
 qinglv:{name:"青绿山水",r:"层级 ★★★ · 区分 ★★",f:(i,n)=>GR(["#17304F","#22567A","#2B7A78","#5E9C73","#A9A56A"],i/Math.max(1,n))},
 thangka:{name:"唐卡矿彩",r:"层级 ★★ · 区分 ★★★",f:(i,n)=>GR(["#9E2A22","#A8602C","#C29A22","#3F8A5A","#2C5A8C","#5A3F86"],i/Math.max(1,n))},
 ink:{name:"墨分五色",r:"层级 ★★★ · 区分 ★",f:(i,n)=>GR(["#1E1D1B","#3D3A35","#5F5A51","#857E71","#ABA394"],i/Math.max(1,n))},
 wuxing:{name:"天干五行",r:"层级 ★ · 区分 ★★",f:(i,n,d)=>["#2F6B3A","#6E9E5A","#A3312A","#D2735A","#8A6420","#BC9445","#9C7A1E","#8C8576","#1F3F66","#4F7896","#1F3F66","#8A6420","#2F6B3A","#6E9E5A","#BC9445","#A3312A","#D2735A","#8A6420","#9C7A1E","#8C8576","#BC9445","#4F7896"][d]},
 flags:{name:"藏地五色",r:"层级 ★ · 区分 ★★★",f:(i,n,d)=>["#2D5DA1","#8D9297","#B8322F","#2E7D4F","#C99A1E"][d%5]},
 rainbow:{name:"彩虹",r:"层级 ★ · 区分 ★★★",f:(i,n,d)=>["#7A2E2E","#9A5B13","#5F6F1E","#1E6B57","#1F5E86","#4B4E9A","#7A3F8C","#9A3563","#6B5A3A","#3F6466"][d%10]}
};
const BG={
 sys:{name:"跟随系统"},
 su:{name:"素白",c:["#FAFAF7","#FFFFFF","#1E1F1C","#6E706A","#E2E2DC"]},
 xuan:{name:"宣纸",c:["#F3EDE0","#FBF7EE","#2A241B","#7A6F5E","#E2D8C4"]},
 ci:{name:"青瓷",c:["#E8EFEA","#F5F9F6","#1C2A25","#5F6F68","#D0DCD5"]},
 yan:{name:"烟灰",c:["#E6E6E3","#F1F1EE","#222321","#666862","#D2D2CD"]},
 mo:{name:"夜墨",dark:1,c:["#17181A","#212225","#E8E6E1","#9C9A94","#33353A"]},
 zq:{name:"藏青夜",dark:1,c:["#0F1B2B","#16263A","#E6EAF0","#93A2B5","#27394F"]},
 jiang:{name:"绛红夜",dark:1,c:["#1F1215","#2B191D","#F0E6E3","#B39A95","#40292D"]}
};
const CORDS={sreal:"真实捻绳（柔光）",s3d:"立体圆编",snoshade:"圆编 · 不压暗",sflat:"扁平圆编",sbraid:"斜纹",ssolid:"素色"};
const RAILT={"rt-color":"彩色字","rt-ink":"深色字 + 浅色带","rt-solid":"实色带 + 反白字"};
const SEPS=["／","›","→","▸","〉","»","·"];
const STEMST={u:"下划线",b:"加粗",bu:"加粗 + 下划线",n:"普通"};
const ST={cord:"sreal",cw:8,rtw:25,rlight:65,rfib:60,rshadow:12,mvt:"h",pace:"course",qpw:5,lstate:"auto",cshow:"off",skst:"lamps",skc:"streak",rprog:"off",redit:"both",sklz:48,skbg:"none",sklay:"row",sktf:10,sknf:29,skm:"date",skgap:30,vgy:11,vgx:22,vls:6,vpd:6,fkP:.9,fkW:.75,railt:"rt-ink",sep:"›",sepb:true,stem:"n",gap:.6,tocf:14,toclh:1,indP:4,indW:8,dockw:42,pal:"thangka",bg:"sys",rline:true,rlo:40,fsh:24,fop:82,fbl:8,pf:14,tcol:"k0",tsty:"solid",tw:33,ttxt:"目录",tarr:"dbl",tani:"none",twist:"helix",tas:"tassel",tn:8,tl:125,tsp:25,twv:7,screen:"home",hcard:"spine",hprog:"beads",hexp:"arrow",hsearch:"box",habout:"menu",hsort:"recent",hlast:"chip",lentry:"book",htab:"shelf",sview:"card",sprog:"num",sfb:"ring",locsty:"tree",expsty:"tree",mk:"box",ring:"lamp",rentry:"fab",lhint:"lamp",lhtxt:"off",mkb:"solid",mko:19,mkr:2,mkg:1,rgold:"glow",rfade:"char",rsz:21,rsw:2,lst:"t7",rglw:5,lp:null,plz:43,fbz:78,hlay:"side",hgap:12,hsidep:"edge",ew:52,efs:13.5,er:10,eal:"mid",eclr:"k0",edt:"off",esub:"two",view:"toc",mnd:"card",mleaf:"line",mln:"curve",mlw:1.5,mlc:"level",mbg:"dots",mfs:15,mgy:7,mgx:32,mfull:false,tgs:"seg",tgc:"k0",tgi:"text",tgw:110,vf:16,ofr:7,ofn:11,ofz:81,ofh:28,ofa:37,ofc:"red",ofs:"off",oft:26,ofg:100,ofw:130,ofy:37,ofd:100,ofi:"fire",ofo:"fan",ofit:1.5,ofsa:45,ofsv:85,ofsl:100,ofbd:10,ofbs:50,ofbt:0.5,oftd:50,ofvx:25,ofvy:55,shym:"sheet",shyv:"on",shyf:15,ret:90,npd:1,srem:false,remT:"20:30",tocOpen:false};
const TCOL={pc:"跟随当前层色",k0:"跟随色盘首色",ink:"墨色",zhe:"赭红",jin:"金色"},TSTY={solid:"实色",tint:"浅底",line:"线框"},TTXT={"目录":"目录","科判目录":"科判目录","☰":"☰ 图标"};
const TARR={none:"无",chev:"⌄ 细折角",tri:"▾ 小三角",arrow:"↓ 箭头",right:"› 向右",dbl:"» 双折角"},TANI={none:"静止",bob:"轻跳",pulse:"呼吸"};
const SV=d=>`<svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const CHEV=SV('<path d="M2.5 4.5 6 8l3.5-3.5"/>'),TRI='<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2.5 4h7L6 8.5z" fill="currentColor"/></svg>',ARW=SV('<path d="M6 1.8v8.4M2.8 7 6 10.2 9.2 7"/>'),RGT=SV('<path d="M4.5 2.5 8 6l-3.5 3.5"/>'),DBL=SV('<path d="M2.5 2.5 6 6l-3.5 3.5M6.5 2.5 10 6l-3.5 3.5"/>');
const TWIST={helix:"绞拧（斜股）",cross:"交叉两股",wrap:"缠线束口",gap:"断开（原样）"};
const TAS={unravel:"散股（绳子拆成几股）",tassel:"流苏（金箍 + 细线）",ball:"穗结（小球结 + 散股）",none:"不散开（圆头）"};
const TGS={seg:"分段胶囊",sw:"滑动开关",tab:"下划线标签",one:"单个切换钮"},TGC={k0:"色盘首色",ink:"墨色",soft:"浅灰"},TGI={both:"图标 + 文字",text:"仅文字",icon:"仅图标"};
const IC_TOC='<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M2 3.5h12M4.5 8h9.5M7 12.5h7"/><circle cx="2.3" cy="8" r=".2"/></svg>',IC_MAP='<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1" y="6" width="4" height="4" rx="1"/><rect x="11" y="1.5" width="4" height="3.5" rx="1"/><rect x="11" y="11" width="4" height="3.5" rx="1"/><path d="M5 8h2.5M7.5 3.3v9.4M7.5 3.3H11M7.5 12.7H11"/></svg>';
const MND={card:"描边卡片",fill:"实色块",tint:"浅色底",pill:"胶囊"},MLEAF={line:"下划线",same:"同上一项",text:"纯文字"},MLN={curve:"曲线",elbow:"直角折线",straight:"直线",brace:"树枝（共用主干）"},MLC={level:"跟随层色",parent:"跟随上一层",gray:"灰色"},MBG={dots:"点阵",grid:"方格",plain:"纯色",paper:"宣纸"};
const HOME={shelf:"A 书架：品目列表",beads:"B 念珠：每品一串",outline:"C 全论目录"},BPOS={center:"标题栏正中",card:"路径卡片右侧（目录竖条上方）"},MK={box:"方块",line:"下划线",fade:"淡字"},LITV={both:"色带变灰 + 点亮发光",gray:"只变灰 / 恢复颜色",gold:"只加金边"};
const WORKS=[];
const HCARD={row:"列表行",card:"大卡片",spine:"经书书脊",grid:"封面网格（两列）"},HPROG={bar:"细进度条",beads:"念珠",ring:"圆环百分比",none:"不显示"},HEXP={arrow:"右侧小箭头展开品",chips:"品名标签一直露出（横滑）",none:"不展开"},HSEARCH={box:"顶部常驻搜索框",icon:"标题栏放大镜（点开全屏搜索）"},HABOUT={icon:"卡片上的 ⓘ",menu:"卡片上的 ⋯ 菜单"},HSORT={recent:"最近读的排最前",fixed:"原顺序，最近读的另起一排"},HLAST={line:"一行文字",chip:"「继续」按钮"};
let HEXPD=null,HQ="",ABOUT=null,MENU=null,DELC=null,HTOP=0;
// 书卡 ⋯ 菜单：放在按钮下方，下方放不下就翻到上方；上下都放不下时把书架滚到能看全
function placeMenu(hb){const m=hb&&hb.querySelector(".hmenu");const bt=m&&m.parentNode.querySelector("[data-menu]");if(!bt)return;const g=4,h=m.offsetHeight,br=hb.getBoundingClientRect(),r=bt.getBoundingClientRect();
 const pad=8,sb=hb.querySelector(".hsearch"),top=Math.max(br.top,sb?sb.getBoundingClientRect().bottom:0)+pad,below=br.bottom-pad-r.bottom-g,above=r.top-g-top;const up=h>below&&h<=above;m.classList.toggle("up",up);m.style.top=(up?bt.offsetTop-g-h:bt.offsetTop+bt.offsetHeight+g)+"px";
 if(!up&&h>below){const mr=m.getBoundingClientRect();hb.scrollTop+=Math.max(0,Math.min(mr.bottom-(br.bottom-pad),mr.top-top))}}
function delHTML(){const B=BOOKS[DELC];return `<div class="cpov cfov" data-delno><div class="cfd" role="alertdialog" aria-label="确认删除"><b>从书架删除《${esc(B?B.title:"")}》？</b><p>这部书的科判、释义和背诵记录都会从这台设备上删掉。以后可以重新导入。</p><div class="cfb"><button data-delno>取消</button><button class="danger" data-delyes>删除</button></div></div></div>`}
const bfsBranches=B=>{const q=[B.root],out=[];while(q.length){const n=q.shift();if(n.c.length){out.push(n);q.push(...n.c)}}return out};
const shuffle=(a0,seed)=>{let a=a0.slice();let x=seed||7;for(let i=a.length-1;i>0;i--){x=(x*9301+49297)%233280;const j=Math.floor(x/233280*(i+1));[a[i],a[j]]=[a[j],a[i]]}if(a.length>1&&a.every((v,i)=>v===a0[i]))a.push(a.shift());return a};
const leavesOf=n=>{const a=[];(function w(x){if(!x.c.length){if(x.v&&x.v.length)a.push(x)}else x.c.forEach(w)})(n);return a};

const PBOX={none:"无框",tint:"浅色底",card:"卡片",left:"左色条",slip:"题签（双线框）"};
const KH={};

function tasselSVG(cols,cw,o){if(cols.length<2)cols=[cols[0],MIX(cols[0],"#ffffff",.38)];const dk=c=>MIX(c,"#000000",.45);
 const N=+o.tn,L=+o.tl,SP=+o.tsp,WV=+o.twv,sty=o.tas;const padL=Math.max(cw,SP*.45)+6,padR=SP+cw+6;const Wt=padL+padR,cx=padL;
 let top=0,body="";const knotH=sty==="ball"?cw*1.3:sty==="tassel"?cw*.9:cw*.5;
 const H=L+knotH+8;
 // strand roots spread across cord width, ends fanned (more to the right, where the page is empty)
 const fine=sty==="tassel";const n=fine?N*3:N;
 const strands=[];for(let i=0;i<n;i++){const t=n===1?.5:i/(n-1);const x0=cx+(t-.5)*cw*.7;const x1=cx+(t-.3)*SP*1.6;
   const len=L*(fine?(.82+.18*Math.sin(i*2.3)**2):(.9+.1*Math.cos(i*1.7)));const y0=knotH,y1=knotH+len;
   const w=WV*(i%2?1:-1)*(.6+.4*Math.sin(i));
   const d=`M${x0.toFixed(1)},${y0} C${(x0+w).toFixed(1)},${(y0+len*.35).toFixed(1)} ${(x1-w).toFixed(1)},${(y0+len*.7).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
   strands.push({d,c:cols[i%cols.length],x1,y1})}
 const sw=fine?Math.max(1,cw*.12):Math.max(2.2,cw*.32);
 strands.forEach(s=>{
   if(fine){body+=`<path d="${s.d}" stroke="${s.c}" stroke-width="${sw}" fill="none" stroke-linecap="round" opacity=".92"/>`}
   else{body+=`<path d="${s.d}" stroke="${dk(s.c)}" stroke-width="${sw+1}" fill="none" stroke-linecap="round"/><path d="${s.d}" stroke="${s.c}" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke-dasharray="${(sw*.9).toFixed(1)} ${(sw*.45).toFixed(1)}"/>`;
     // frayed tip
     for(let k=-1;k<=1;k++)body+=`<path d="M${s.x1.toFixed(1)},${s.y1.toFixed(1)} l${(k*sw*.7).toFixed(1)},${(sw*2.2).toFixed(1)}" stroke="${s.c}" stroke-width="${Math.max(.8,sw*.22)}" stroke-linecap="round" opacity=".85"/>`}});
 // knot / collar at top
 const c0=cols[0],c1=cols[cols.length-1];
 if(sty==="ball"){const r=cw*.62;let gr="";for(let a=0;a<14;a++){const ang=a/14*Math.PI*2,rr=r*(a%2?.35:.7);gr+=`<ellipse cx="${(cx+Math.cos(ang)*rr).toFixed(1)}" cy="${(r+1+Math.sin(ang)*rr).toFixed(1)}" rx="${(cw*.2).toFixed(1)}" ry="${(cw*.14).toFixed(1)}" fill="${cols[a%cols.length]}" stroke="${dk(cols[a%cols.length])}" stroke-width=".4"/>`}
   body+=`<circle cx="${cx}" cy="${r+1}" r="${r}" fill="${MIX(c0,"#000000",.25)}"/>${gr}`}
 else if(sty==="tassel"){const bh=knotH;body+=`<rect x="${cx-cw*.52}" y="0" width="${cw*1.04}" height="${bh}" rx="2" fill="#c9a24a" stroke="${MIX("#c9a24a","#000000",.4)}" stroke-width=".6"/>`;for(let j=1;j<4;j++)body+=`<line x1="${cx-cw*.52}" x2="${cx+cw*.52}" y1="${(bh*j/4).toFixed(1)}" y2="${(bh*j/4).toFixed(1)}" stroke="${MIX("#c9a24a","#000000",.35)}" stroke-width=".6"/>`}
 else{body+=`<path d="M${cx-cw/2},0 H${cx+cw/2} L${cx+cw*.38},${knotH} H${cx-cw*.38}Z" fill="${MIX(c1,"#000000",.2)}"/>`}
 return {cx,svg:`<svg width="${Wt.toFixed(0)}" height="${(H+SP*.1+10).toFixed(0)}" viewBox="0 0 ${Wt.toFixed(1)} ${(H+SP*.1+10).toFixed(1)}" aria-hidden="true">${body}</svg>`}}
// 编绳图案很复杂（一处换段上百条路径），整本书有几百处，直接塞进页面会很慢。
// 同样的图案只画一次，存成图片地址，各处用 <img> 引用。
const SVGB=new Map();function svgBlob(s){let u=SVGB.get(s);if(!u){const t=/xmlns=/.test(s)?s:s.replace("<svg",'<svg xmlns="http://www.w3.org/2000/svg"');u=URL.createObjectURL(new Blob([t],{type:"image/svg+xml"}));SVGB.set(s,u)}return u}
function svgImg(s){if(!s)return s;const m=s.match(/^<svg width="([\d.]+)" height="([\d.]+)" viewBox="([-\d. ]+)"/);if(!m)return s;const w=+m[1],h=+m[2],[vx,vy,vw,vh]=m[3].split(" ").map(Number);const sx=vw/w,sy=vh/h,pw=w*.75,ph=h*.5;
 const t=s.replace(m[0],`<svg width="${w+2*pw}" height="${h+2*ph}" viewBox="${vx-pw*sx} ${vy-ph*sy} ${vw+2*pw*sx} ${vh+2*ph*sy}"`).replace(' style="overflow:visible"',"");
 return `<img alt="" src="${svgBlob(t)}" width="${w+2*pw}" height="${h+2*ph}" style="display:block;margin:${-ph}px ${-pw}px;max-width:none">`}
const TWC=new Map();function twistSVG(cu,cl,W,H,sty){const k=[cu,cl,W,H,sty,ST.cord].join("|");let r=TWC.get(k);if(r===undefined){r=svgImg(twistSVG0(cu,cl,W,H,sty));if(TWC.size>400)TWC.clear();TWC.set(k,r)}return r}
function twistSVG0(cu,cl,W,H,sty){if(ST.cord==="sreal")return ropeTwist(cu,cl,W,H);cu=cu.filter(Boolean);cl=cl.filter(Boolean);if(!cu.length)cu=cl;if(!cl.length)cl=cu;if(!cu.length)return "";const pad=a=>a.length<2?[a[0],MIX(a[0],"#ffffff",.38)]:a;cu=pad(cu);cl=pad(cl);const id="tw"+Math.random().toString(36).slice(2,8);const dk=c=>MIX(c,"#000000",.5);
 const pin=sty==="wrap"?.12:.2;const L=W*pin,R=W*(1-pin);
 const hg=`M0,0 H${W} C${W},${H*.3} ${R},${H*.4} ${R},${H/2} C${R},${H*.6} ${W},${H*.7} ${W},${H} H0 C0,${H*.7} ${L},${H*.6} ${L},${H/2} C${L},${H*.4} 0,${H*.3} 0,0Z`;
 let body="";
 if(sty==="helix"){const U=16/W,HU=H*U,mid=HU/2,sg=HU*.15,DY=4.4,pinMin=.4,N=cu.length,M=cl.length;
   const bell=y=>Math.exp(-(((y-mid)/sg)**2)),sc=y=>1-(1-pinMin)*bell(y);
   let pts=[];for(let i=0;i<=40;i++){const y=HU*i/40;pts.push([8+8*sc(y),y])}
   const hgU=`M${pts.map(p=>p.join(",")).join(" L")} L${pts.slice().reverse().map(p=>[16-p[0],p[1]].join(",")).join(" L")}Z`;
   let pills="";const rows=Math.ceil(HU/DY)+1;
   for(let r=-1;r<=rows;r++){const y=r*DY+DY/2;const odd=((r%2)+2)%2;const s_=sc(y),bl=bell(y);
    const ph=8*(1/(1+Math.exp(-(y-mid)/(sg*.6))));const ang=-55*bl;
    const base=odd?[0,8,16]:[4,12];
    for(const x0 of base)for(const sh of [-8,0,8]){let x=x0+ph+sh;if(x<-6||x>22)continue;const col=Math.round((x0+sh)/4);
     const lower=y>mid;const arr=lower?cl:cu,n=arr.length;const ci=(((Math.floor((col+r)/2))%n)+n)%n;const c=arr[ci];
     const X=8+(x-8)*s_;pills+=`<ellipse cx="${X.toFixed(2)}" cy="${y.toFixed(2)}" rx="${(3.7*Math.max(.55,s_)).toFixed(2)}" ry="2.7" transform="rotate(${ang.toFixed(1)} ${X.toFixed(2)} ${y.toFixed(2)})" fill="${c}" stroke="${dk(c)}" stroke-width=".5" stroke-opacity=".6"/>`}}
   const bgU=`<rect width="16" height="${mid}" fill="${MIX(cu[0],"#000000",.25)}"/><rect y="${mid}" width="16" height="${mid}" fill="${MIX(cl[0],"#000000",.25)}"/>`;
   return `<svg width="${W}" height="${H}" viewBox="0 0 16 ${HU}" aria-hidden="true"><defs><clipPath id="${id}c"><path d="${hgU}"/></clipPath><linearGradient id="${id}g" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".38" stop-color="#fff" stop-opacity=".12"/><stop offset=".62" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".26"/></linearGradient></defs><g clip-path="url(#${id}c)">${bgU}${pills}</g></svg>`}
 else if(sty==="cross"){const a=cu[cu.length-1],b=cl[cl.length-1],a2=cu[0],b2=cl[0];
   body+=`<rect width="${W}" height="${H/2}" fill="${MIX(a2,"#000000",.25)}"/><rect y="${H/2}" width="${W}" height="${H/2}" fill="${MIX(b2,"#000000",.25)}"/>`;
   const sw=W*.46;body+=`<path d="M${W*.2},-2 C${W*.2},${H*.35} ${W*.8},${H*.65} ${W*.8},${H+2}" stroke="${dk(b)}" stroke-width="${sw+1}" fill="none"/><path d="M${W*.2},-2 C${W*.2},${H*.35} ${W*.8},${H*.65} ${W*.8},${H+2}" stroke="${b}" stroke-width="${sw}" fill="none"/>`;
   body+=`<path d="M${W*.8},-2 C${W*.8},${H*.35} ${W*.2},${H*.65} ${W*.2},${H+2}" stroke="${dk(a)}" stroke-width="${sw+1}" fill="none"/><path d="M${W*.8},-2 C${W*.8},${H*.35} ${W*.2},${H*.65} ${W*.2},${H+2}" stroke="${a}" stroke-width="${sw}" fill="none"/>`}
 else{const a=cu[cu.length-1],b=cl[cl.length-1];body+=`<rect width="${W}" height="${H/2}" fill="${a}"/><rect y="${H/2}" width="${W}" height="${H/2}" fill="${b}"/>`;
   const n=6,bh=H*.5/n;for(let j=0;j<n;j++){const y=H*.25+j*bh;const c=j%2?MIX(a,b,.5):"#c9a24a";body+=`<rect x="0" y="${y}" width="${W}" height="${bh}" fill="${c}" stroke="${MIX(c,"#000000",.45)}" stroke-width=".5"/>`}}
 return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs><clipPath id="${id}c"><path d="${hg}"/></clipPath><linearGradient id="${id}g" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset=".38" stop-color="#fff" stop-opacity=".18"/><stop offset=".62" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></linearGradient></defs><g clip-path="url(#${id}c)">${body}<rect width="${W}" height="${H}" fill="url(#${id}g)"/></g><path d="${hg}" fill="none" stroke="#000" stroke-opacity=".25" stroke-width=".6"/></svg>`}
// ---- 真实绳子（三股/多股捻绳 + 柔光）
function ropeCols(cols){cols=cols.filter(Boolean);if(!cols.length)cols=["#8a5a3c"];if(cols.length===1)cols=[cols[0],MIX(cols[0],"#ffffff",.3),MIX(cols[0],"#000000",.18)];if(cols.length===2)cols=[cols[0],cols[1],MIX(cols[0],cols[1],.5)];return cols}
function ropeGeo(S){const a=Math.max(15,Math.min(65,+ST.rtw))*Math.PI/180;const P=2*Math.PI*8/Math.tan(a);const d=P/S;const bw=Math.max(3,d*Math.sin(a)*1.02);return {P,d,bw,a}}
// 画股：xf(x,y) 可选，用于束腰
function ropeStrands(cols,y0,y1,xf){const S=cols.length,{P,d,bw}=ropeGeo(S);const L=+ST.rlight/100,FB=+ST.rfib/100;let out="";
 const k0=Math.floor((y0-P)/d)-1,k1=Math.ceil((y1+P)/d)+1;
 for(let k=k0;k<=k1;k++){const c=cols[((k%S)+S)%S];const yk=k*d;const pts=[];
  for(let i=0;i<=24;i++){const th=-.25+(Math.PI+.5)*i/24;let x=8-8*Math.cos(th),y=yk-th/(2*Math.PI)*P;if(xf)x=xf(x,y);pts.push([x,y])}
  if(pts.every(p=>p[1]<y0-bw)||pts.every(p=>p[1]>y1+bw))continue;
  const dP="M"+pts.map(p=>p[0].toFixed(2)+","+p[1].toFixed(2)).join(" L");
  const off=(dx,dy)=>"M"+pts.map(p=>(p[0]+dx).toFixed(2)+","+(p[1]+dy).toFixed(2)).join(" L");
  // 缝隙（暗）→ 股体 → 受光面 → 纤维
  out+=`<path d="${dP}" stroke="${MIX(c,"#000000",.62)}" stroke-width="${(bw*1.02).toFixed(2)}" fill="none" stroke-linecap="butt"/>`;
  out+=`<path d="${dP}" stroke="${MIX(c,"#000000",.2)}" stroke-width="${(bw*.86).toFixed(2)}" fill="none"/>`;
  out+=`<path d="${off(0,-bw*.1)}" stroke="${c}" stroke-width="${(bw*.6).toFixed(2)}" fill="none"/>`;
  out+=`<path d="${off(0,bw*.27)}" stroke="${MIX(c,"#000000",.55)}" stroke-opacity=".55" stroke-width="${(bw*.28).toFixed(2)}" fill="none" filter="url(#rb)"/>`;
  out+=`<path d="${off(0,-bw*.2)}" stroke="${MIX(c,"#fff6e6",.55)}" stroke-opacity="${(.15+.55*L).toFixed(2)}" stroke-width="${(bw*.26).toFixed(2)}" fill="none" stroke-linecap="round" filter="url(#rb)"/>`;
  if(FB>0)for(let f=-2;f<=2;f++){if(!f)continue;const o=f*bw*.17;out+=`<path d="${off(0,o)}" stroke="${f<0?MIX(c,"#ffffff",.45):MIX(c,"#000000",.45)}" stroke-opacity="${(FB*.5).toFixed(2)}" stroke-width=".28" stroke-dasharray="${(2+Math.abs(f)).toFixed(1)} ${(1.1+f*.2+.6).toFixed(1)}" fill="none"/>`}}
 return out}
function ropeShade(id){const L=+ST.rlight/100;return `<linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="#1a0d06" stop-opacity=".55"/><stop offset=".16" stop-color="#1a0d06" stop-opacity=".12"/><stop offset=".34" stop-color="#fff8ea" stop-opacity="${(.06+.2*L).toFixed(2)}"/><stop offset=".5" stop-color="#fff8ea" stop-opacity="${(.03+.06*L).toFixed(2)}"/><stop offset=".74" stop-color="#1a0d06" stop-opacity=".14"/><stop offset="1" stop-color="#1a0d06" stop-opacity=".62"/></linearGradient>`}
const RBLUR=`<filter id="rb" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation=".55"/></filter>`;
function ropeTex(cols){cols=ropeCols(cols);const {P}=ropeGeo(cols.length);const W=16,H=+P.toFixed(3);
 const s=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${RBLUR}${ropeShade("rs")}</defs><rect width="${W}" height="${H}" fill="${MIX(cols[0],"#000000",.6)}"/>${ropeStrands(cols,0,H)}<rect width="${W}" height="${H}" fill="url(#rs)"/></svg>`;
 return `url("${svgBlob(s)}")`}
function ropeTwist(cu,cl,W,H){cu=ropeCols(cu);cl=ropeCols(cl);const id="rt"+Math.random().toString(36).slice(2,8);const U=16/W,HU=H*U,mid=HU/2,sg=HU*.16;
 const bell=y=>Math.exp(-(((y-mid)/sg)**2)),sc=y=>1-.42*bell(y);const xf=(x,y)=>8+(x-8)*sc(y);
 let pts=[];for(let i=0;i<=40;i++){const y=HU*i/40;pts.push([8-8*sc(y),y])}
 const hg=`M${pts.map(p=>p[0].toFixed(2)+","+p[1].toFixed(2)).join(" L")} L${pts.slice().reverse().map(p=>(16-p[0]).toFixed(2)+","+p[1].toFixed(2)).join(" L")}Z`;
 // 上半用上一段的股，下半用下一段的股，在束腰处交接；束腰处缠一圈金线
 const band=`<g>${[-1,0,1].map(j=>`<ellipse cx="8" cy="${(mid+j*1.5).toFixed(2)}" rx="${(8*sc(mid)+.4).toFixed(2)}" ry=".95" fill="#c9a24a" stroke="#6e5214" stroke-width=".3"/>`).join("")}</g>`;
 return `<svg width="${W}" height="${H}" viewBox="0 0 16 ${HU.toFixed(2)}" aria-hidden="true" style="overflow:visible"><defs>${RBLUR.replace('id="rb"',`id="rb"`)}${ropeShade(id+"s")}<clipPath id="${id}u"><rect width="16" height="${mid.toFixed(2)}"/></clipPath><clipPath id="${id}l"><rect y="${mid.toFixed(2)}" width="16" height="${mid.toFixed(2)}"/></clipPath><clipPath id="${id}c"><path d="${hg}"/></clipPath></defs><g clip-path="url(#${id}c)"><rect width="16" height="${HU}" fill="${MIX(cu[0],"#000000",.6)}"/><g clip-path="url(#${id}u)">${ropeStrands(cu,0,mid,xf)}</g><g clip-path="url(#${id}l)">${ropeStrands(cl,mid,HU,xf)}</g><rect width="16" height="${HU}" fill="url(#${id}s)"/>${band}</g></svg>`}
// 编绳纹理按颜色和绳子设置记下来，再次打开、换书回来都不用重新生成
const TEXC=new Map();function cordTexC(cols,style){const k=[cols.join(),style,ST.rlight,ST.rfib,ST.rtw].join("|");let r=TEXC.get(k);if(r===undefined){r=cordTex(cols,style);if(TEXC.size>400)TEXC.clear();TEXC.set(k,r)}return r}
function cordTex(cols,style){if(style==="sreal")return ropeTex(cols);if(cols.length<2)cols=[cols[0],MIX(cols[0],"#ffffff",.38)];
 if(style==="ssolid")return cols[cols.length-1];
 if(style==="sbraid")return `repeating-linear-gradient(150deg,${cols.map((c,i)=>`${c} ${i*4}px ${(i+1)*4}px`).join(",")})`;
 const N=cols.length,W=16,DY=4.4,rows=N*4,H=rows*DY;let defs="",body="";
 cols.forEach((c,i)=>{defs+=`<radialGradient id="g${i}" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="${MIX(c,"#ffffff",.55)}"/><stop offset=".45" stop-color="${c}"/><stop offset="1" stop-color="${MIX(c,"#000000",.42)}"/></radialGradient>`});
 const flat=style==="sflat";
 const pill=(x,y,ci)=>`<ellipse cx="${x}" cy="${y}" rx="${flat?3.7:4.1}" ry="${flat?2.7:3.05}" fill="${flat?cols[ci]:`url(#g${ci})`}" stroke="${MIX(cols[ci],"#000000",.5)}" stroke-width="${flat?.5:.25}" stroke-opacity=".6"/>`;
 for(let r=-1;r<=rows;r++){const y=r*DY+DY/2,odd=((r%2)+2)%2;const xs=odd?[0,8,16]:[4,12];
  xs.forEach((x,k)=>{const col=odd?k*2:k*2+1;const ci=(((Math.floor((col+r)/2))%N)+N)%N;body+=pill(x,y,ci)})}
 const bg=flat?MIX(cols[0],"#000000",.25):MIX(cols[0],"#000000",.55);
 const s=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs><rect width="${W}" height="${H}" fill="${bg}"/>${body}</svg>`;
 return `url("${svgBlob(s)}")`}

const dev=document.getElementById("device");
const wide=()=>dev.clientWidth>700;
const badge=n=>!n.code?"":`<span class="badge" style="background:var(--k${n.depth});color:var(--kt${n.depth})">${n.code}</span>`;
let refreshToc=null;

function applyColors(){const b=BG[ST.bg];const P=["--bg","--panel","--ink","--muted","--line","--sheet","--accent-soft"];let dk;
 if(!b.c){P.forEach(p=>dev.style.removeProperty(p));dev.style.colorScheme="";dk=isDark()}
 else{const c=b.c;[c[0],c[1],c[2],c[3],c[4],c[1],MIX(c[0],c[2],.08)].forEach((v,i)=>dev.style.setProperty(P[i],v));dev.style.colorScheme=b.dark?"dark":"light";dk=!!b.dark}
 const p=PAL[ST.pal]||PAL.thangka;const ds=BK?BK.all.filter(n=>n.p).map(n=>n.depth):[0,9];const mn=Math.min(...ds),mx=Math.max(...ds);
 for(let d=0;d<22;d++){let c=p.f(Math.max(0,d-mn),mx-mn,d);if(dk)c=MIX(c,"#ffffff",.32);KH[d]=c;dev.style.setProperty(`--k${d}`,c);dev.style.setProperty(`--kt${d}`,LUM(c)>.42?"#1b1b1b":"#ffffff")}
 dev.style.setProperty("--gap",ST.gap+"em");dev.style.setProperty("--tocf",ST.tocf+"px");dev.style.setProperty("--toclh",ST.toclh+"px");dev.style.setProperty("--rlo",ST.rlo+"%");[["--tw",ST.tw+"px"],["--fsh",ST.fsh],["--fop",ST.fop+"%"],["--fbl",ST.fbl+"px"],["--pf",ST.pf+"px"],["--vf",ST.vf+"px"],["--rsh",ST.rshadow+"px"]].forEach(([k,v])=>dev.style.setProperty(k,v));dev.style.setProperty("--dockw",ST.dockw+"%");dev.style.setProperty("--cw",ST.cw+"px");
 {const m=document.querySelector('meta[name="theme-color"]');if(m){const v=getComputedStyle(dev).getPropertyValue("--panel").trim();if(v)m.content=v}}document.documentElement.style.colorScheme=dk?"dark":"light";document.body.style.background=getComputedStyle(dev).getPropertyValue("--bg")}

function toggleHTML(){const L=(v,ic,t)=>`${ST.tgi!=="text"?ic:""}${ST.tgi!=="icon"?`<span>${t}</span>`:""}`;const m=ST.view==="map";
 const cls=`vtg g-${ST.tgs} c-${ST.tgc}`;
 if(ST.tgs==="one")return `<button class="${cls}" data-view="${m?"toc":"map"}" aria-label="切换到${m?"目录":"思维导图"}">${m?L("toc",IC_TOC,"目录"):L("map",IC_MAP,"导图")}</button>`;
 return `<div class="${cls}" role="tablist" style="width:${ST.tgs==="tab"?"auto":ST.tgw+"px"}"><button role="tab" data-view="toc" aria-selected="${!m}">${L("toc",IC_TOC,"目录")}</button><button role="tab" data-view="map" aria-selected="${m}">${L("map",IC_MAP,"导图")}</button>${ST.tgs==="sw"?`<i class="knob" style="transform:translateX(${m?"100%":"0"})"></i>`:""}</div>`}
let CUR=null;const MS={bk:null,col:new Set(),tx:0,ty:0,k:1,init:false,sel:null,moved:0};
function mmReset(cur){MS.bk=BK;MS.col=new Set();const on=new Set(cur?[...anc(cur),cur]:[]);BK.all.forEach(n=>{if(n.c.length&&n.p&&!on.has(n))MS.col.add(n.id)});MS.init=false;MS.sel=null}
const mmV=()=>!wide()&&ST.mvt==="v",mmVL=()=>!wide()&&ST.mvt==="vl";
function mmLayoutV(){const f=ST.mfs/13,Wn=Math.round(ST.mfs*2.3),GY=+ST.mgy+6,GX=Math.max(18,+ST.mgx),R=BK.root;const nodes=[];let x0=0;
 const h=n=>Math.min(320,(n.title.length*ST.mfs*1.16+54*f+(n.c.length?26:0)+(ST.ring==="none"?0:+ST.rsz+6)));
 const rw=Math.min(260,BK.title.length*15*f+30),rh=36;
 (function lay(n,y){const R_=n===R,ww=R_?rw:Wn,hh=R_?rh:h(n);const kids=MS.col.has(n.id)?[]:n.c;const me={n,y,w:ww,h:hh};nodes.push(me);
  if(!kids.length){me.x=x0;x0+=ww+GY}else{const ks=kids.map(k=>lay(k,y+hh+GX));me.kids=ks;me.x=(ks[0].x+ks[0].w/2+ks[ks.length-1].x+ks[ks.length-1].w/2)/2-ww/2}
  return me})(R,0);const mn=Math.min(...nodes.map(m=>m.x));if(mn<0)nodes.forEach(m=>m.x-=mn);return nodes}
function mmLayoutVL(){const f=ST.mfs/13,Wn=Math.round(ST.mfs*2.3),GY=+ST.vgy,GX=+ST.vgx,R=BK.root;const nodes=[];let y0=0;
 const h=n=>Math.min(360,(n.title.length*ST.mfs*(1.1+ST.vls/100)+48*f+2*ST.vpd+(n.c.length?26:0)+(ST.ring==="none"?0:+ST.rsz+6)));
 const rw=Math.min(260,BK.title.length*15*f+30);
 (function lay(n,x){const R_=n===R,ww=R_?rw:Wn,hh=R_?36:h(n);const kids=MS.col.has(n.id)?[]:n.c;const me={n,x,w:ww,h:hh};nodes.push(me);
  if(!kids.length){me.y=y0;y0+=hh+GY}else{const ks=kids.map(k=>lay(k,x+ww+GX));me.kids=ks;me.y=(ks[0].y+ks[0].h/2+ks[ks.length-1].y+ks[ks.length-1].h/2)/2-hh/2}
  return me})(R,0);const mn=Math.min(...nodes.map(m=>m.y));if(mn<0)nodes.forEach(m=>m.y-=mn);return nodes}
function mmLayout(){if(mmV())return mmLayoutV();if(mmVL())return mmLayoutVL();const f=ST.mfs/13,H=Math.round(ST.mfs*2.3),GY=+ST.mgy,GX=+ST.mgx,R=BK.root;const nodes=[];let y0=0;
 const w=n=>n===R?Math.min(260,BK.title.length*15*f+30):Math.min(360,(n.title.length*13.5+50+(n.c.length?26:0)+(ST.ring==="none"?0:+ST.rsz+5))*f);
 (function lay(n,x){const ww=w(n),h=n===R?36:H;const kids=MS.col.has(n.id)?[]:n.c;const me={n,x,w:ww,h};if(n===R)me.h=Math.round(h*1.15);nodes.push(me);
  if(!kids.length){me.y=y0;y0+=h+GY}else{const ks=kids.map(k=>lay(k,x+ww+GX));me.kids=ks;me.y=(ks[0].y+ks[0].h/2+ks[ks.length-1].y+ks[ks.length-1].h/2)/2-h/2}
  return me})(R,0);return nodes}
function mapHTML(cur){if(MS.bk!==BK)mmReset(cur);const nodes=mmLayout();const on=new Set(cur?[...anc(cur),cur]:[]);
 const W=Math.max(...nodes.map(m=>m.x+m.w))+20,H=Math.max(...nodes.map(m=>m.y+m.h))+20;let paths="";
 const V=mmV();nodes.forEach(m=>(m.kids||[]).forEach(k=>{if(V){const x1=m.x+m.w/2,y1=m.y+m.h,x2=k.x+k.w/2,y2=k.y,my=(y1+y2)/2;const o=on.has(k.n);
   const col=ST.mlc==="gray"?"var(--muted)":ST.mlc==="parent"&&m.n!==BK.root?`var(--k${m.n.depth})`:`var(--k${k.n.depth})`;const lw=+ST.mlw;const g=Math.min(10,(y2-y1)/2);
   const d=ST.mln==="elbow"?`M${x1} ${y1}V${my}H${x2}V${y2}`:ST.mln==="straight"?`M${x1} ${y1}L${x2} ${y2}`:ST.mln==="brace"?`M${x1} ${y1}V${y1+g}${x2===x1?"":`H${x2+(x2>x1?-6:6)}Q${x2} ${y1+g} ${x2} ${y1+g+6}`}V${y2}`:`M${x1} ${y1}C${x1} ${my},${x2} ${my},${x2} ${y2}`;
   paths+=`<path d="${d}" stroke="${col}" stroke-width="${o?lw+1:lw}" fill="none" opacity="${o?1:.7}" stroke-linejoin="round" stroke-linecap="round"/>`;return}
  const x1=m.x+m.w,y1=m.y+m.h/2,x2=k.x,y2=k.y+k.h/2,mx=(x1+x2)/2;const o=on.has(k.n);
  const col=ST.mlc==="gray"?"var(--muted)":ST.mlc==="parent"&&m.n!==BK.root?`var(--k${m.n.depth})`:`var(--k${k.n.depth})`;const lw=+ST.mlw;
  const g=Math.min(14,(x2-x1)/2);const d=ST.mln==="elbow"?`M${x1} ${y1}H${mx}V${y2}H${x2}`:ST.mln==="straight"?`M${x1} ${y1}L${x2} ${y2}`:ST.mln==="brace"?`M${x1} ${y1}H${x1+g}${y2===y1?"":`V${y2+(y2>y1?-6:6)}Q${x1+g} ${y2} ${x1+g+6} ${y2}`}H${x2}`:`M${x1} ${y1}C${mx} ${y1},${mx} ${y2},${x2} ${y2}`;
  paths+=`<path d="${d}" stroke="${col}" stroke-width="${o?lw+1:lw}" fill="none" opacity="${o?1:.7}" stroke-linejoin="round" stroke-linecap="round"/>`}));
 const nd=nodes.map(m=>{const n=m.n,R=n===BK.root,cl=MS.col.has(n.id)&&n.c.length;
  return `<button class="nd ${n.c.length?"":"leaf"} ${R?"root":""} ${!R&&ST.ring!=="none"&&!unlocked(n)?"lk":""} ${on.has(n)?"on":""} ${MS.sel===n?"sel":""}" data-id="${n.id}" aria-current="${n===cur}" style="--lc:${R?"var(--ink)":`var(--k${n.depth})`};--kt:var(--kt${n.depth});left:${m.x}px;top:${m.y}px;width:${m.w}px;height:${m.h}px">${R?"":ringHTML(n)}${R?"":badge(n)}<span class="t">${esc(R?BK.title:n.title)}</span>${cl?`<span class="cnt">+${n.c.length}</span>`:""}</button>`}).join("");
 const sel=MS.sel&&MS.sel!==BK.root?MS.sel:null;
 return `<div class="mmw ${V||mmVL()?"vt":""} n-${ST.mnd} l-${ST.mleaf} bg-${ST.mbg}" style="--mfs:${ST.mfs}px;--vls:${ST.vls/100}em;--vpd:${ST.vpd}px"><div class="mmc" style="width:${W}px;height:${H}px"><svg width="${W}" height="${H}" aria-hidden="true">${paths}</svg>${nd}</div>
  <div class="mmtools"><button data-z="1.25" aria-label="放大">＋</button><button data-z="0.8" aria-label="缩小">－</button><button data-fit aria-label="看全图">⤢</button><button data-here aria-label="回到当前位置">◎</button>${(()=>{const any=BK.all.some(n=>n.c.length&&n!==BK.root&&MS.col.has(n.id));return `<button data-xall="${any?"open":"close"}" aria-label="${any?"全部展开":"收回到当前位置"}" title="${any?"全部展开":"收回到当前位置"}">${any?"⊞":"⊟"}</button>`})()}${wide()?`<button data-full aria-label="${ST.mfull?"退出全屏":"全屏导图"}" title="${ST.mfull?"退出全屏":"全屏导图"}">${ST.mfull?"⤡":"⛶"}</button>`:""}</div>
  ${sel?`<button class="mmgo" data-go="${sel.id}">跳到 ${esc(sel.code+" "+sel.title)} →</button>`:""}</div>`}
function mmBind(el,fn){const mm=el.querySelector(".mmw");if(!mm)return;const c=mm.querySelector(".mmc");const ap=()=>{c.style.transform=`translate(${MS.tx}px,${MS.ty}px) scale(${MS.k})`};
 const nodeEl=n=>{let x=n;while(x&&!c.querySelector(`.nd[data-id="${x.id}"]`))x=x.p;return x?c.querySelector(`.nd[data-id="${x.id}"]`):null};
 const here=()=>here2(mm);
 const fit=()=>{const r=mm.getBoundingClientRect(),W=c.offsetWidth,H=c.offsetHeight;MS.k=Math.min(1.1,Math.max(.2,Math.min((r.width-24)/W,(r.height-24)/H)));MS.tx=12;MS.ty=Math.max(12,(r.height-H*MS.k)/2);ap()};
 if(!MS.init){MS.init=true;MS.k=mm.getBoundingClientRect().width<500?.85:1;requestAnimationFrame(()=>here2(mm,true))}
 ap();
 const zoomAt=(f,cx,cy)=>{const nk=Math.min(2.5,Math.max(.2,MS.k*f));MS.tx=cx-(cx-MS.tx)*nk/MS.k;MS.ty=cy-(cy-MS.ty)*nk/MS.k;MS.k=nk;ap()};
 const pts=new Map();let last=null,pinch=null;
 mm.onpointerdown=e=>{if(e.target.closest(".mmtools,.mmgo"))return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});MS.moved=0;last={x:e.clientX,y:e.clientY};mm.classList.add("dragging");
  if(pts.size===2){const [a,b]=[...pts.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),k:MS.k}}};
 mm.onpointermove=e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pts.size===2&&pinch){const [a,b]=[...pts.values()];const r=mm.getBoundingClientRect();const d=Math.hypot(a.x-b.x,a.y-b.y);zoomAt((pinch.k*d/pinch.d)/MS.k,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top);MS.moved=99;return}
  const dx=e.clientX-last.x,dy=e.clientY-last.y;MS.moved+=Math.abs(dx)+Math.abs(dy);last={x:e.clientX,y:e.clientY};if(MS.moved>4){MS.tx+=dx;MS.ty+=dy;ap()}};
 const up=e=>{pts.delete(e.pointerId);if(pts.size<2)pinch=null;if(!pts.size)mm.classList.remove("dragging")};
 mm.onpointerup=up;mm.onpointercancel=up;mm.onpointerleave=up;
 mm.onwheel=e=>{e.preventDefault();const r=mm.getBoundingClientRect();zoomAt(e.deltaY<0?1.1:1/1.1,e.clientX-r.left,e.clientY-r.top)};
 const rer=()=>{el.innerHTML=tocHTML(CUR);bindToc(el,fn)};
 mm.querySelectorAll(".nd").forEach(b=>b.onclick=()=>{if(MS.moved>4)return;const n=BK.by[b.dataset.id];if(!n)return;
  if(!n.c.length){fn(n);return}
  if(n!==BK.root){MS.col.has(n.id)?MS.col.delete(n.id):MS.col.add(n.id)}MS.sel=n;
  const before=b.getBoundingClientRect();rer();const nb=el.querySelector(`.nd[data-id="${n.id}"]`);
  if(nb){const a=nb.getBoundingClientRect();MS.tx+=before.left-a.left;MS.ty+=before.top-a.top;el.querySelector(".mmc").style.transform=`translate(${MS.tx}px,${MS.ty}px) scale(${MS.k})`}});
 mm.querySelectorAll("[data-z]").forEach(b=>b.onclick=()=>{const r=mm.getBoundingClientRect();zoomAt(+b.dataset.z,r.width/2,r.height/2)});
 mm.querySelector("[data-fit]").onclick=fit;
 mm.querySelector("[data-xall]").onclick=e=>{const open=e.currentTarget.dataset.xall==="open";if(open)MS.col.clear();else{const keep=new Set(CUR?anc(CUR).map(a=>a.id):[]);BK.all.forEach(n=>{if(n.c.length&&n!==BK.root&&!keep.has(n.id))MS.col.add(n.id)})}
  rer();requestAnimationFrame(()=>{const m2=el.querySelector(".mmw");if(m2)here2(m2)})};
 mm.querySelector("[data-here]").onclick=()=>{if(CUR){anc(CUR).forEach(a=>MS.col.delete(a.id));rer();requestAnimationFrame(()=>{const m2=el.querySelector(".mmw");if(m2)m2.querySelector("[data-here]").click()})}};
 mm.querySelector("[data-here]").onclick=(()=>{let busy=false;return()=>{if(busy){busy=false;here();return}if(CUR&&anc(CUR).some(a=>MS.col.has(a.id))){anc(CUR).forEach(a=>MS.col.delete(a.id));rer();const b2=el.querySelector(".mmw [data-here]");if(b2){requestAnimationFrame(()=>{const m2=el.querySelector(".mmw");const e2=nodeEl(CUR);here2(m2)})}}else here()}})();
 function here2(m2,still){const r=m2.getBoundingClientRect();const c2=m2.querySelector(".mmc");let x=CUR;let e=null;while(x&&!(e=c2.querySelector(`.nd[data-id="${x.id}"]`)))x=x.p;if(!e)return;
  const FK=wide()?+ST.fkW:+ST.fkP;MS.k=FK;const ex=parseFloat(e.style.left)+e.offsetWidth/2,ey=parseFloat(e.style.top)+e.offsetHeight/2;
  MS.tx=r.width*.5-ex*MS.k;MS.ty=r.height*.42-ey*MS.k;
  if(!still){c2.style.transition="transform .35s ease";setTimeout(()=>{c2.style.transition=""},400)}
  c2.style.transform=`translate(${MS.tx}px,${MS.ty}px) scale(${MS.k})`;
  m2.querySelectorAll(".nd.focus").forEach(z=>z.classList.remove("focus"));e.classList.add("focus");setTimeout(()=>e.classList.remove("focus"),1200)}
 const fb=mm.querySelector("[data-full]");if(fb)fb.onclick=()=>{ST.mfull=!ST.mfull;const ap_=dev.querySelector(".app");if(ap_)ap_.classList.toggle("mfull",ST.mfull);rer()};
 const go=mm.querySelector("[data-go]");if(go)go.onclick=()=>fn(BK.by[go.dataset.go])}
function tocHTML(cur){if(ST.view==="map")return (wide()?`<div class="dh">${toggleHTML()}</div>`:"")+mapHTML(cur);const ind=wide()?ST.indW:ST.indP;const onp=new Set(cur?anc(cur):[]);
 return `<div class="toc">${wide()?`<div class="dh">${toggleHTML()}</div>`:""}<div class="h">${esc(BK.title)} · 科判目录</div>`+BK.all.filter(n=>n.p).map(n=>`<button class="${n.c.length?"br":""} ${onp.has(n)?"on-path":""}" data-j="${n.id}" aria-current="${n===cur}" style="--lc:var(--k${n.depth})">${anc(n).map(x=>`<span class="gd" style="--lc:var(--k${x.depth});width:${ind}px"></span>`).join("")}${badge(n)}<span>${esc(n.title)}</span>${ringHTML(n)}</button>`).join("")+`</div>`}
const bindToc=(el,fn)=>{mmBind(el,fn);el.querySelectorAll("[data-j]").forEach(b=>b.onclick=()=>fn(BK.by[b.dataset.j]));
 el.querySelectorAll("[data-view]").forEach(b=>b.onclick=e=>{e.stopPropagation();const v=b.dataset.view;if(v===ST.view)return;ST.view=v;if(v==="toc"&&ST.mfull){ST.mfull=false;const ap_=dev.querySelector(".app");if(ap_)ap_.classList.remove("mfull")}dev.querySelectorAll(".mh .vtg").forEach(t=>t.outerHTML=toggleHTML());const mh=dev.querySelector(".tocov .mh");if(mh)bindToc(mh,fn);if(refreshToc)refreshToc(true)})};
function centerCur(box){if(box.querySelector(".mmw"))return;const c=box.querySelector('[aria-current="true"]');if(!c)return;const br=box.getBoundingClientRect(),cr=c.getBoundingClientRect();box.scrollTop+=cr.top-br.top-box.clientHeight/2+cr.height/2;box.scrollLeft+=cr.left-br.left-box.clientWidth/2+cr.width/2}

// ===== 学习（按《背诵方式定稿》：读→认→展→背→混） =====
const SK={loc:"定位",exp:"展开",mask:"遮字"};
const LENTRY={top:"A 书架顶部「今日」卡",book:"B 放在书的卡片上",tab:"C 底部两个标签：书架 / 今日"},SVIEW={full:"全屏练习页",card:"卡片（一题一张）",sheet:"阅读页 + 底部抽屉"},SPROG={bar:"细进度条",beads:"念珠（每题一颗）",num:"只显示 3 / 7"},SFB={ring:"节点圆环亮一段",quiet:"只一行文字"},LOCSTY={list:"路径 + 选项按钮",tree:"像目录一样逐级长出来"},EXPSTY={slot:"编号空槽",tree:"挂到树上"},RING={seg:"分段圆环",half:"宝珠（扇形填满）",petal:"莲瓣",lamp:"酥油灯",beads:"念珠",gem:"摩尼宝（菱形）",none:"不显示"},RGOLD={glow:"金色光晕",rays:"放光芒",none:"不加"},RFADE={dim:"金色变淡",gray:"整体变灰",ember:"变成暗铜色",char:"灰黑 + 一点金光"},LHINT={text:"文字（昨天复习过 / 4 天没复习了）",color:"按钮颜色由暖变冷",dot:"小红点 + 天数",spine:"书脊慢慢褪色",arc:"小圆弧倒计时（7 天走完）",lamp:"酥油灯火苗变小"},LHTXT={off:"不加文字",on:"同时加文字"},MKB={solid:"实心块",outline:"空心框",tian:"田字格",dot:"中间一点",paper:"纸签",gold:"金箔",ink:"墨块"},RENTRY={btn:"标题栏「练习」按钮",fab:"右下角浮动「今日 N」",none:"不放（只从首页进）"};
const hasV=n=>n.v.length>0||leavesOf(n).length>0;
// 子科判后面单独的那几颂（x）只读不练
const stepsOf=n=>{if(n._S)return n._S;const S=[];if(!n.x){if(n.p&&n.p.c.length>1&&hasV(n))S.push("loc");if(n.c.length>1&&!n.ne)S.push("exp");if(!n.c.length&&n.v.length)S.push("mask")}return n._S=S};
const unlocked=n=>!n.p||(n.p.c.length>1?!!itm(n.p,"exp"):unlocked(n.p));
const nstate=n=>{const S=stepsOf(n),L=S.filter(k=>itm(n,k));return {S,L,gold:L.length===S.length,fade:S.some(k=>{const t=itm(n,k);return t&&t.due<0}),unl:unlocked(n)}};
const bfsAll=B=>B.bfs;
// ---- 复习状态。每个科判的「定位」「展开」、每段颂词的「遮字」各是一张卡，用 FSRS（ts-fsrs）排下次复习
// SR 存在本机（IndexedDB），见 store.js
const SR={it:{},hist:{},today:null,daily:null,wk:{id:"",n:0},recent:{},course:{},last:{},lm:{},paceAsked:false,v:1};
// 学习模式：每部科判单独开关。undefined=还没问过，第一次打开时弹窗问
function lmFix(){if(!SR.lm)SR.lm={};Object.keys(SR.it||{}).forEach(k=>{const b=k.slice(0,k.indexOf(":"));if(b&&SR.lm[b]===undefined)SR.lm[b]="on"})}
const lmOn=B=>!!B&&SR.lm[B.id]==="on";let LMASK=null;
function lmAskHTML(){const B=LMASK&&BOOKS[LMASK.key];if(!B)return "";return `<div class="cpov cfov" data-lmx><div class="cfd lmd" role="dialog" aria-label="学习模式"><button class="lmx" data-lmx aria-label="关闭">✕</button><b>要开启《${esc(B.title)}》的学习模式吗？</b><p>开启后，书卡上会出现学习按钮，按你选的节奏安排背诵和复习。不开启就只是阅读。</p><p class="lmn">以后可以在书卡 ⋯ 的「学习节奏」里更改。</p><div class="cfb"><button data-lmset="off">只阅读</button><button class="lmy" data-lmset="on">开启</button></div></div></div>`}
const DAY=864e5;
const sod=t=>{const d=new Date(t);d.setHours(0,0,0,0);return d.getTime()};
const dkey=t=>{const d=new Date(t==null?Date.now():t);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const dayDiff=(a,b)=>Math.round((sod(a)-sod(b))/DAY);
const weekId=t=>{const d=new Date(sod(t==null?Date.now():t));d.setDate(d.getDate()-((d.getDay()+6)%7));return dkey(d)};
let FSI=null;
function fsrsI(){if(!FSI||FSI._r!==ST.ret){FSI=FSRS.fsrs(FSRS.generatorParameters({request_retention:ST.ret/100,enable_short_term:false,enable_fuzz:true}));FSI._r=ST.ret}return FSI}
const toCard=o=>({...o,due:new Date(o.due),last_review:o.last_review?new Date(o.last_review):undefined});
const fromCard=c=>({due:+c.due,stability:c.stability,difficulty:c.difficulty,elapsed_days:c.elapsed_days,scheduled_days:c.scheduled_days,learning_steps:c.learning_steps||0,reps:c.reps,lapses:c.lapses,state:c.state,last_review:c.last_review?+c.last_review:null});
const ckey=(n,k)=>n.bk+":"+n.id+"|"+k;
// 返回 {due: 距离今天的天数（≤0 是今天到期，<0 是过期）}，没学过返回 undefined
const itm=(n,k)=>{const c=SR.it[ckey(n,k)];return c?{due:dayDiff(c.due,Date.now()),c}:undefined};
const bookOf=n=>BOOKS[n.bk];
const bkKey=B=>B&&B.id;
const shortT=B=>B.title;
function bookVs(B){let t=0,l=0;B.seq.forEach(n=>{if(!n.v.length)return;t+=n.v.length;if(stepsOf(n).includes("mask")&&itm(n,"mask"))l+=n.v.length});return [l,t]}
function chapVs(c){let l=0;c.leaves.forEach(n=>{if(n.v.length&&stepsOf(n).includes("mask")&&itm(n,"mask"))l+=n.v.length});return [l,c.vs]}
function bookFrac(B){let t=0,l=0;bfsAll(B).forEach(n=>{const s=nstate(n);t+=s.S.length;l+=s.L.length});return t?l/t:0}
function dueList(B){const o=[];bfsAll(B).forEach(n=>stepsOf(n).forEach(k=>{const t=itm(n,k);if(t&&t.due<=0)o.push({n,k,B,isNew:false})}));return o}
// 同一次里选好的上层节点算作「将要学」，它下面的分支也就解锁了，一天学 2 支以上时不会卡在第一层
function newNodes(B,max){const o=[],pick=new Set();const ul=n=>!n.p||(n.p.c.length>1&&!n.p.ne?(!!itm(n.p,"exp")||pick.has(n.p)):ul(n.p));
 for(const n of bfsAll(B)){if(o.length>=max)break;if(ul(n)&&nstate(n).L.length<stepsOf(n).length&&paceOK(n)){o.push(n);pick.add(n)}}return o}
function newNode(B){return newNodes(B,1)[0]}
function todayRec(){const k=dkey();if(!SR.today||SR.today.date!==k)SR.today={date:k,n:0,dedi:false,nodes:{}};return SR.today}
// 今天还能新学几支：每天默认 1 支（设置里 1–5），到期复习超过 20 条时暂停新学
function newLeft(B){const T=todayRec();const done=Object.keys(T.nodes).filter(k=>k.startsWith(B.id+":")).length;return Math.max(0,(+ST.npd||1)-done)}
function bookCount(B){if(!lmOn(B))return {rev:0,nw:0,tot:0};const rev=dueList(B).length;const nw=rev>20||quotaFull()?0:newNodes(B,newLeft(B)).length;return {rev,nw,tot:rev+nw}}
function todayCount(){let rev=0,nw=0;Object.values(BOOKS).forEach(B=>{const c=bookCount(B);rev+=c.rev;nw+=c.nw});return {rev,nw,tot:rev+nw}}
// 点灯：当天答完 1 题就点亮；当天到期的都做完，灯满亮
function streakN(){let d=Date.now();if(!(SR.hist[dkey(d)]||{}).n)d-=DAY;let n=0;while((SR.hist[dkey(d)]||{}).n){n++;d-=DAY}return n}
function markFull(){const T=todayRec();if(!T.n)return;const h=SR.hist[T.date]||(SR.hist[T.date]={n:T.n});h.n=T.n;h.full=!todayCount().tot}
// ---- 节点圆环：中间层 = 认 + 展，最末层 = 认 + 背，每完成一步亮一段，全亮变金
function ringHTML(n,cls,anim){if(ST.ring==="none")return "";const s=nstate(n);if(!s.S.length)return cls==="big"?"":`<span class="rnone"></span>`;
 return ringSVG(ST.ring,s.S.map(k=>!!itm(n,k)),{gold:s.gold,fade:s.fade,lk:!s.unl,anim:anim?s.S.indexOf(anim):-1,cls,title:ringTitle(n,s)},cls==="big"?+ST.fbz:+ST.rsz)}
const RINGC=new Map();
function ringSVG(d,on,f,z){const key=d+"|"+on.join()+"|"+f.gold+f.fade+f.lk+f.anim+f.cls+f.title+"|"+z;const hit=RINGC.get(key);if(hit)return hit;const out=ringSVG0(d,on,f,z);if(RINGC.size>4000)RINGC.clear();RINGC.set(key,out);return out}
function ringSVG0(d,on,f,z){const N=on.length,c=z/2,k=z/15,sw=+ST.rsw*k,F=x=>(+x).toFixed(2);
 const cl=i=>`${on[i]?"on":""} ${f.anim===i?"new":""}`;const P=(r,a)=>[c+r*Math.cos(a*Math.PI/180),c+r*Math.sin(a*Math.PI/180)];
 const rays=f.gold&&ST.rgold==="rays";const S=rays?.74:1;let g="";
 if(d==="seg"){const r=c-sw/2-.4,C=2*Math.PI*r,gap=N>1?2.4*k:0,len=C/N-gap;
  g=on.map((o,i)=>`<circle cx="${c}" cy="${c}" r="${F(r)}" fill="none" stroke-width="${F(sw)}" class="sg ${cl(i)}" stroke-dasharray="${F(len)} ${F(C-len)}" transform="rotate(${F(-90+360/N*i+(gap/C*180))} ${c} ${c})"/>`).join("")+(f.gold?`<circle cx="${c}" cy="${c}" r="${F(Math.max(1,r-sw/2-1.2*k))}" class="core"/>`:"")}
 else if(d==="half"){const r=c-sw/2-.4,r2=r-sw/2-.9*k,gp=N>1?7:0;
  g=`<circle cx="${c}" cy="${c}" r="${F(r)}" fill="none" stroke-width="${F(sw)}" class="sg ${f.gold?"on":""}"/>`+on.map((o,i)=>{if(N===1)return `<circle cx="${c}" cy="${c}" r="${F(r2)}" class="sp ${cl(i)}"/>`;const a0=-90+360/N*i+gp/2,a1=a0+360/N-gp;const p0=P(r2,a0),p1=P(r2,a1);return `<path d="M${c} ${c}L${F(p0[0])} ${F(p0[1])}A${F(r2)} ${F(r2)} 0 0 1 ${F(p1[0])} ${F(p1[1])}Z" class="sp ${cl(i)}"/>`}).join("")}
 else if(d==="petal"){const bx=c,by=z*.9,L=z*.8,w=z*.2;const A=N===1?[0]:N===2?[-32,32]:on.map((_,i)=>-50+100*(i+.5)/N);
  const pet=(a,l,cls)=>{const r=a*Math.PI/180,tx=bx+l*Math.sin(r),ty=by-l*Math.cos(r),mx=(bx+tx)/2,my=(by+ty)/2,nx=Math.cos(r)*w,ny=Math.sin(r)*w;return `<path d="M${F(bx)} ${F(by)}Q${F(mx-nx)} ${F(my-ny)} ${F(tx)} ${F(ty)}Q${F(mx+nx)} ${F(my+ny)} ${F(bx)} ${F(by)}Z" class="sf ${cls}" stroke-width="${F(sw*.55)}"/>`};
  g=(f.gold?pet(0,L*1.06,"on mid"):"")+A.map((a,i)=>pet(a,L*.92,cl(i))).join("")}
 else if(d==="lamp"){g=tibLamp(ST.lst,z,on,cl,f.lk?"lk":f.fade?"char":f.gold?"lit":"dull",sw)}
 else if(d==="beads"){const rb=N===1?z*.3:z*.22,st=rb*2.15;const xs=on.map((_,i)=>c+(i-(N-1)/2)*st);
  g=`<path d="M${F(xs[0]-rb)} ${c}H${F(xs[N-1]+rb)}" class="thr" stroke-width="${F(k*.9)}"/>`+xs.map((x,i)=>`<circle cx="${F(x)}" cy="${c}" r="${F(rb-sw*.3)}" class="sf ${cl(i)}" stroke-width="${F(sw*.55)}"/>`).join("")+(f.gold?`<circle cx="${F(c)}" cy="${F(c-rb*1.35)}" r="${F(rb*.38)}" class="sf on"/>`:"")}
 else if(d==="gem"){const m=sw*.5+.5,T=[c,m],R=[z-m,c],B=[c,z-m],Lp=[m,c];const tri=(a,b,e,cls)=>`<path d="M${F(a[0])} ${F(a[1])}L${F(b[0])} ${F(b[1])}L${F(e[0])} ${F(e[1])}Z" class="sf ${cls}" stroke-width="${F(sw*.55)}" stroke-linejoin="round"/>`;
  g=N===1?`<path d="M${F(T[0])} ${F(T[1])}L${F(R[0])} ${F(R[1])}L${F(B[0])} ${F(B[1])}L${F(Lp[0])} ${F(Lp[1])}Z" class="sf ${cl(0)}" stroke-width="${F(sw*.55)}" stroke-linejoin="round"/>`:tri(T,B,Lp,cl(0))+tri(T,R,B,cl(1));
  if(f.gold)g+=`<path d="M${F(c-z*.14)} ${F(c-z*.1)}L${c} ${F(c-z*.26)}L${F(c+z*.14)} ${F(c-z*.1)}" class="hl" stroke-width="${F(k)}"/>`}
 const rr=rays?Array.from({length:8},(_,i)=>{const a=i*45-90,p0=P(c*.8,a),p1=P(c*.98,a);return `<path d="M${F(p0[0])} ${F(p0[1])}L${F(p1[0])} ${F(p1[1])}" class="ray" stroke-width="${F(k*1.1)}"/>`}).join(""):"";
 const glw=f.gold&&!f.fade&&ST.rgold==="glow"?` style="filter:drop-shadow(0 0 ${F(+ST.rglw*z/19*(f.cls==="big"?1.3:1))}px #e8b94a)"`:"";
 return `<svg class="rg r-${d} ${f.cls||""} ${f.lk?"lk":""} ${f.fade?"fade fd-"+ST.rfade:""} ${f.gold?"gold":""}" width="${z}" height="${z}" viewBox="0 0 ${z} ${z}" aria-hidden="true"${glw}>${f.title?`<title>${f.title}</title>`:""}${rr}<g transform="translate(${F(c*(1-S))} ${F(c*(1-S))}) scale(${S})">${g}</g></svg>`}
function ringSpec(){const L=[{on:[0,0],lk:1,t:"未解锁"},{on:[0,0],t:"可以学"},{on:[1,0],t:"认"},{on:[1,1],gold:1,t:"认 + 展"},{on:[1,1],gold:1,fade:1,t:"该复习"},{on:[1],gold:1,t:"只一步"}];const o=ST.lst;
 const h=`<div class="rspec">${Object.entries(LST).map(([st,name])=>{ST.lst=st;return `<button class="rsr" data-lst="${st}" aria-pressed="${o===st}"><b>${name}</b><span class="rss">${L.map(x=>`<span>${ringSVG("lamp",x.on.map(Boolean),{gold:!!x.gold,fade:!!x.fade,lk:!!x.lk},30)}<small>${x.t}</small></span>`).join("")}<span class="big">${ringSVG("lamp",[true,false],{},56)}${ringSVG("lamp",[true,true],{gold:true,cls:"big"},56)}</span></span></button>`}).join("")}</div>`;ST.lst=o;return h}
// ---- 藏式铜灯（有材质的版本）
const LST={t1:"C1 经典高足",t2:"C2 莲瓣口",t3:"C3 宝瓶足",t4:"C4 矮足宽碗",t5:"C5 錾花高脚",t6:"C6 银口铜身",t7:"C7 古铜深碗（参考图）"};
(function(){if(document.getElementById("cudefs"))return;const lg=(id,st,vert)=>`<linearGradient id="${id}" x1="0" y1="0" x2="${vert?0:1}" y2="${vert?1:0}">${st.map(([o,c,a])=>`<stop offset="${o}" stop-color="${c}"${a!=null?` stop-opacity="${a}"`:""}/>`).join("")}</linearGradient>`;
 const body=[lg("cuLit",[[0,"#5a2f0c"],[.18,"#a8641e"],[.34,"#f2c470"],[.42,"#fff3c4"],[.52,"#e3a548"],[.78,"#8c4f17"],[1,"#40210a"]]),
  lg("cuDull",[[0,"#3b2f28"],[.2,"#6e5a4a"],[.38,"#b39c84"],[.46,"#d9c9b4"],[.6,"#8d7663"],[.85,"#4c3d33"],[1,"#2c231e"]]),
  lg("cuChar",[[0,"#121010"],[.3,"#2e2824"],[.42,"#5d4c33"],[.48,"#8a6c36"],[.6,"#3a322c"],[1,"#100e0d"]]),
  lg("agLit",[[0,"#5c6066"],[.3,"#c9cdd2"],[.42,"#ffffff"],[.6,"#a7acb3"],[1,"#4a4d52"]]),
  lg("rimLit",[[0,"#fff0bd"],[.5,"#e0a447"],[1,"#7d4413"]],1),lg("rimDull",[[0,"#e6dccd"],[.5,"#a99280"],[1,"#5a493d"]],1),lg("rimChar",[[0,"#7a6640"],[.5,"#3a322c"],[1,"#151210"]],1),
  `<radialGradient id="oil" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#b07a2a"/><stop offset="1" stop-color="#3a2208"/></radialGradient>`,
  `<radialGradient id="flIn" cx=".5" cy=".72" r=".6"><stop offset="0" stop-color="#ffffff"/><stop offset=".3" stop-color="#fff2b0"/><stop offset=".7" stop-color="#ffc246"/><stop offset="1" stop-color="#f08a1c"/></radialGradient>`,
  `<radialGradient id="flOut" cx=".5" cy=".7" r=".62"><stop offset="0" stop-color="#ffd76a" stop-opacity=".95"/><stop offset=".6" stop-color="#ff9f2e" stop-opacity=".75"/><stop offset="1" stop-color="#e2561a" stop-opacity=".35"/></radialGradient>`];
 document.body.insertAdjacentHTML("afterbegin",`<svg id="cudefs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${body.join("")}</defs></svg>`)})();
// st: 款式；on: 各步是否完成；mat: lit / dull / char / lk；sc: 火苗大小
function tibLamp(st,z,on,cl,mat,sw,sc){if(st==="t7")return oldLamp(z,on,cl,mat,sc);const q=v=>(v*z).toFixed(2),F=v=>(+v).toFixed(2);
 const M={lit:["cuLit","rimLit"],dull:["cuDull","rimDull"],char:["cuChar","rimChar"]}[mat]||null;
 const body=M?`fill="url(#${M[0]})"`:`fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="${F(z/26)}" stroke-dasharray="${F(z/14)} ${F(z/18)}"`;
 const rimF=M?`fill="url(#${st==="t6"&&mat==="lit"?"agLit":M[1]})"`:body;
 const shade=M?`<path d="M${q(.18)} ${q(.5)}Q${q(.3)} ${q(.63)} ${q(.5)} ${q(.645)}" fill="none" stroke="#000" stroke-opacity=".22" stroke-width="${F(z/40)}"/>`:"";
 const spec=(x,y1,y2)=>M&&mat!=="char"?`<path d="M${q(x)} ${q(y1)}Q${q(x-.02)} ${q((y1+y2)/2)} ${q(x+.03)} ${q(y2)}" fill="none" stroke="#fff" stroke-opacity="${mat==="lit"?.75:.45}" stroke-width="${F(z/38)}" stroke-linecap="round"/>`:"";
 let rimY=.47,v="";
 const foot=(y,rx,h)=>`<path d="M${q(.5-rx)} ${q(y)}Q${q(.5-rx*.75)} ${q(y-h)} ${q(.5)} ${q(y-h)}Q${q(.5+rx*.75)} ${q(y-h)} ${q(.5+rx)} ${q(y)}Z" ${body}/><ellipse cx="${q(.5)}" cy="${q(y)}" rx="${q(rx)}" ry="${q(.028)}" ${rimF}/>`;
 const knob=(y,rx,ry)=>`<ellipse cx="${q(.5)}" cy="${q(y)}" rx="${q(rx)}" ry="${q(ry)}" ${body}/>`;
 const stem=(y1,y2,w)=>`<path d="M${q(.5-w)} ${q(y1)}L${q(.5-w*1.25)} ${q(y2)}H${q(.5+w*1.25)}L${q(.5+w)} ${q(y1)}Z" ${body}/>`;
 const cup=(y,rx,dep)=>`<path d="M${q(.5-rx)} ${q(y)}Q${q(.5-rx*.8)} ${q(y+dep)} ${q(.5)} ${q(y+dep)}Q${q(.5+rx*.8)} ${q(y+dep)} ${q(.5+rx)} ${q(y)}Z" ${body}/>`;
 const rim=(y,rx)=>`<ellipse cx="${q(.5)}" cy="${q(y)}" rx="${q(rx)}" ry="${q(.045)}" ${rimF}/>${M?`<ellipse cx="${q(.5)}" cy="${q(y+.004)}" rx="${q(rx*.82)}" ry="${q(.03)}" fill="url(#oil)"/>`:""}`;
 if(st==="t2"){rimY=.47;const pet=Array.from({length:7},(_,i)=>{const x=.17+i*.11;return `<path d="M${q(x-.055)} ${q(.5)}Q${q(x)} ${q(.4)} ${q(x+.055)} ${q(.5)}Z" ${rimF}/>`}).join("");
  v=foot(.96,.25,.1)+stem(.74,.87,.04)+knob(.74,.08,.05)+cup(.48,.36,.2)+pet+rim(.48,.33)+spec(.27,.52,.6)}
 else if(st==="t3"){rimY=.44;v=foot(.97,.24,.07)+knob(.885,.06,.03)+`<path d="M${q(.5)} ${q(.68)}C${q(.66)} ${q(.72)} ${q(.62)} ${q(.86)} ${q(.5)} ${q(.87)}C${q(.38)} ${q(.86)} ${q(.34)} ${q(.72)} ${q(.5)} ${q(.68)}Z" ${body}/>`+knob(.665,.08,.03)+cup(.44,.34,.19)+rim(.44,.34)+spec(.28,.48,.57)+spec(.44,.73,.83)}
 else if(st==="t4"){rimY=.55;v=foot(.95,.33,.11)+knob(.81,.1,.04)+cup(.55,.43,.22)+rim(.55,.43)+spec(.22,.59,.68)}
 else if(st==="t5"){rimY=.41;v=foot(.97,.22,.08)+stem(.62,.9,.035)+knob(.66,.075,.03)+knob(.76,.06,.025)+knob(.84,.07,.03)+cup(.41,.32,.2)+(M?`<path d="M${q(.22)} ${q(.5)}Q${q(.5)} ${q(.56)} ${q(.78)} ${q(.5)}M${q(.27)} ${q(.55)}Q${q(.5)} ${q(.6)} ${q(.73)} ${q(.55)}" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="${F(z/50)}"/>`:"")+rim(.41,.32)+spec(.26,.45,.54)}
 else {rimY=.47;v=foot(.96,.25,.1)+stem(.78,.87,.04)+knob(.765,.08,.055)+`<ellipse cx="${q(.5)}" cy="${q(.69)}" rx="${q(.1)}" ry="${q(.025)}" ${body}/>`+cup(.47,.37,.2)+rim(.47,.37)+spec(.26,.51,.6)}
 v=v.replace(/<\/?g>/g,"")+(st==="t1"||st==="t6"?shade:"");
 const room=Math.min(1,(rimY-.02)/.5)*(sc==null?1:sc),c=z/2,yB=rimY*z;
 const tear=(h,w,fill,cls)=>{const y0=yB-h;return `<path d="M${F(c)} ${F(y0)}C${F(c+w)} ${F(y0+h*.55)} ${F(c+w*.9)} ${F(yB)} ${F(c)} ${F(yB)}C${F(c-w*.9)} ${F(yB)} ${F(c-w)} ${F(y0+h*.55)} ${F(c)} ${F(y0)}Z" class="tf ${cls}" ${fill}/>`};
 const off=`fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="${F(z/40)}"`;
 let fl="";const N=on.length;
 if(room<=.01)fl=`<path d="M${F(c)} ${F(yB-z*.03)}q${F(z*.06)} ${F(-z*.1)} 0 ${F(-z*.2)}q${F(-z*.06)} ${F(-z*.1)} 0 ${F(-z*.2)}" class="smoke" stroke-width="${F(z*.03)}"/>`;
 else if(N===1)fl=tear(z*.46*room,z*.17*room,on[0]?`fill="url(#flIn)"`:off,cl(0));
 else fl=tear(z*.5*room,z*.21*room,on[1]?`fill="url(#flOut)"`:off,"outer "+cl(1))+tear(z*.3*room,z*.1*room,on[0]?`fill="url(#flIn)"`:off,cl(0));
 return v+fl+`<path d="M${F(c)} ${F(yB+z*.005)}v${F(-z*.03)}" stroke="#2a1a0a" stroke-width="${F(z/45)}"/>`}
function lampArt(st,z,on,cl,gold,sw,sc,mat){return tibLamp(st,z,on,cl,mat||(gold?"lit":"dull"),sw,sc)}
function pillLamp(d){const sc=[1,.82,.6,.6,.38,.38,.38,.38][d]??0;return `<svg class="plamp" width="${ST.plz}" height="${ST.plz}" viewBox="0 0 30 30" aria-hidden="true" style="--lb:${[1,.95,.82,.82,.66,.66,.66,.66][d]??.5}">${tibLamp(ST.lst,30,[1,1],i=>"on","lit",2,sc)}</svg>`}
// ---- C7 古铜深碗（照参考图）
(function(){const d=document.querySelector("#cudefs defs");if(!d||d.querySelector("#oldLit"))return;
 const lg=(id,st,vert)=>`<linearGradient id="${id}" x1="0" y1="0" x2="${vert?0:1}" y2="${vert?1:0}">${st.map(([o,c])=>`<stop offset="${o}" stop-color="${c}"/>`).join("")}</linearGradient>`;
 d.insertAdjacentHTML("beforeend",lg("oldLit",[[0,"#2e200b"],[.14,"#5e4519"],[.32,"#a8833d"],[.42,"#e3c47e"],[.5,"#b8954a"],[.7,"#6f5320"],[.9,"#3b2a0e"],[1,"#22170a"]])
  +lg("oldDull",[[0,"#262119"],[.18,"#4f4532"],[.36,"#857559"],[.45,"#a89878"],[.56,"#76684f"],[.85,"#3a3226"],[1,"#1d1913"]])
  +lg("oldRim",[[0,"#f3dc9c"],[.35,"#b8924a"],[1,"#4a3512"]],1)+lg("oldRimD",[[0,"#c9bea6"],[.4,"#857559"],[1,"#2f281d"]],1)
  +lg("oldIn",[[0,"#3a2a0f"],[.5,"#8a6a2c"],[1,"#d8b766"]],1)
  +`<radialGradient id="oilLit" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="#ffe7a0"/><stop offset=".45" stop-color="#e6ad48"/><stop offset="1" stop-color="#8a5a18"/></radialGradient>`
  +`<radialGradient id="oilDim" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="#b89a5c"/><stop offset="1" stop-color="#4d3a1a"/></radialGradient>`
  +`<radialGradient id="flTall" cx=".5" cy=".78" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset=".25" stop-color="#fff6cf"/><stop offset=".6" stop-color="#ffd166"/><stop offset=".85" stop-color="#f59a2a"/><stop offset="1" stop-color="#e0661a" stop-opacity=".8"/></radialGradient>`
  +`<radialGradient id="flHalo" cx=".5" cy=".6" r=".6"><stop offset="0" stop-color="#ffcf6a" stop-opacity=".75"/><stop offset=".7" stop-color="#ff9f2e" stop-opacity=".3"/><stop offset="1" stop-color="#ff9f2e" stop-opacity="0"/></radialGradient>`
  +`<pattern id="hammer" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r=".8" fill="#000" fill-opacity=".14"/><circle cx="4.5" cy="4" r=".9" fill="#fff" fill-opacity=".09"/><circle cx="4" cy="1" r=".5" fill="#000" fill-opacity=".1"/></pattern>`)})();
const LPD={bw:28,bd:29,fl:4,sh:7,fw:22,fh:41,fwd:14,ht:80,hue:2,sat:90,tone:130,ham:1};
const LPC={"古铜":{hue:0,sat:100,tone:100},"黄铜":{hue:8,sat:135,tone:115},"红铜":{hue:-22,sat:150,tone:100},"金":{hue:6,sat:170,tone:125},"银":{hue:0,sat:0,tone:130},"乌铜":{hue:0,sat:45,tone:70}};
const LPL={bw:["碗宽",20,40,1,""],bd:["碗深",16,38,1,""],fl:["杯口外翻",0,10,1,""],sh:["柄高",2,16,1,""],fw:["底座宽",12,32,1,""],fh:["火苗高",20,52,1,""],fwd:["火苗粗",4,14,1,""],ht:["整体高度",70,140,2,"%"],hue:["色相",-60,60,2,"°"],sat:["饱和度",0,200,5,"%"],tone:["明暗",60,140,5,"%"],ham:["锤纹（大图）",0,1,1,""]};
function oldLamp(z,on,cl,mat,sc){const P=Object.assign({},LPD,ST.lp||{}),p=k=>P[k]/100;const q=v=>(v*z).toFixed(2),F=v=>(+v).toFixed(2),big=z>=40;
 const lk=!["lit","dull","char"].includes(mat);
 const B=lk?`fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="${F(z/26)}" stroke-dasharray="${F(z/14)} ${F(z/18)}"`:`fill="url(#${mat==="lit"?"oldLit":mat==="char"?"cuChar":"oldDull"})"`;
 const RIM=lk?B:`fill="url(#${mat==="lit"?"oldRim":mat==="char"?"rimChar":"oldRimD"})"`;
 const ham=big&&!lk&&P.ham?`fill="url(#hammer)"`:null;
 const line=(d,o)=>lk?"":`<path d="${d}" fill="none" stroke="#000" stroke-opacity="${o||.28}" stroke-width="${F(z/60)}"/>`;
 const hi=(d,o)=>lk||mat==="char"?"":`<path d="${d}" fill="none" stroke="#fff" stroke-opacity="${o}" stroke-width="${F(z/34)}" stroke-linecap="round"/>`;
 const bw=p("bw"),fl=p("fl"),fw=p("fw"),rY=.4,y0=rY+.045;
 let bb=y0+p("bd");const ft=Math.min(.885,bb+.05+p("sh"));if(ft-bb<.05)bb=ft-.05;
 const bowl=`M${q(.5-bw)} ${q(y0)}C${q(.5-bw-.02)} ${q(y0+(bb-y0)*.62)} ${q(.5-bw*.6)} ${q(bb)} ${q(.5)} ${q(bb)}C${q(.5+bw*.6)} ${q(bb)} ${q(.5+bw+.02)} ${q(y0+(bb-y0)*.62)} ${q(.5+bw)} ${q(y0)}Z`;
 const footP=`M${q(.5)} ${q(ft)}C${q(.57)} ${q(ft)} ${q(.5+fw*.4)} ${q(.885)} ${q(.5+fw)} ${q(.92)}H${q(.5-fw)}C${q(.5-fw*.4)} ${q(.885)} ${q(.43)} ${q(ft)} ${q(.5)} ${q(ft)}Z`;
 const kY=bb+.035,my=y0+(bb-y0)*.42;
 let v=`<path d="M${q(.5-fw-.02)} ${q(.915)}H${q(.5+fw+.02)}V${q(.955)}Q${q(.5)} ${q(.985)} ${q(.5-fw-.02)} ${q(.955)}Z" ${B}/><ellipse cx="${q(.5)}" cy="${q(.915)}" rx="${q(fw+.02)}" ry="${q(.02)}" ${RIM}/>`
  +`<path d="${footP}" ${B}/>`+(ham?`<path d="${footP}" ${ham}/>`:"")
  +(big&&!lk?`<path d="M${q(.5)} ${q(.905)}c${q(-.03)} ${q(-.02)} ${q(-.035)} ${q(-.05)} 0 ${q(-.075)}c${q(.035)} ${q(.025)} ${q(.03)} ${q(.055)} 0 ${q(.075)}zM${q(.5)} ${q(.905)}c${q(-.05)} 0 ${q(-.07)} ${q(-.02)} ${q(-.075)} ${q(-.045)}M${q(.5)} ${q(.905)}c${q(.05)} 0 ${q(.07)} ${q(-.02)} ${q(.075)} ${q(-.045)}" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="${F(z/70)}"/>`:"")
  +hi(`M${q(.47)} ${q(ft+.02)}Q${q(.5-fw*.45)} ${q(.88)} ${q(.5-fw*.8)} ${q(.905)}`,.35)
  +`<rect x="${q(.455)}" y="${q(bb-.01)}" width="${q(.09)}" height="${q(ft-bb+.02)}" ${B}/>`
  +`<ellipse cx="${q(.5)}" cy="${q(kY)}" rx="${q(.095)}" ry="${q(.04)}" ${B}/>`+line(`M${q(.41)} ${q(kY)}H${q(.59)}`,.35)
  +`<ellipse cx="${q(.5)}" cy="${q(bb+.003)}" rx="${q(.065)}" ry="${q(.014)}" ${RIM}/>`
  +`<path d="${bowl}" ${B}/>`+(ham?`<path d="${bowl}" ${ham}/>`:"")
  +line(`M${q(.5-bw+.01)} ${q(y0+.035)}Q${q(.5)} ${q(y0+.085)} ${q(.5+bw-.01)} ${q(y0+.035)}`,.3)
  +(big&&!lk?`<path d="M${q(.5)} ${q(my)}l${q(.035)} ${q(.035)}l${q(-.035)} ${q(.035)}l${q(-.035)} ${q(-.035)}z M${q(.465)} ${q(my+.035)}c${q(-.03)} ${q(-.03)} ${q(-.05)} ${q(.02)} ${q(-.02)} ${q(.025)}M${q(.535)} ${q(my+.035)}c${q(.03)} ${q(-.03)} ${q(.05)} ${q(.02)} ${q(.02)} ${q(.025)}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="${F(z/80)}"/>`:"")
  +hi(`M${q(.5-bw*.75)} ${q(y0+.07)}Q${q(.5-bw*.72)} ${q(y0+(bb-y0)*.55)} ${q(.5-bw*.48)} ${q(y0+(bb-y0)*.75)}`,.4)
  +`<path d="M${q(.5-bw-fl)} ${q(rY)}L${q(.5-bw)} ${q(y0)}H${q(.5+bw)}L${q(.5+bw+fl)} ${q(rY)}Z" ${B}/>`
  +`<ellipse cx="${q(.5)}" cy="${q(rY)}" rx="${q(bw+fl)}" ry="${q(.055)}" ${RIM}/>`
  +(lk?"":`<ellipse cx="${q(.5)}" cy="${q(rY+.003)}" rx="${q(bw+fl-.035)}" ry="${q(.044)}" fill="url(#oldIn)"/><ellipse cx="${q(.5)}" cy="${q(rY+.012)}" rx="${q(Math.max(.05,bw+fl-.07))}" ry="${q(.032)}" fill="url(#${mat==="lit"?"oilLit":"oilDim"})"/>`);
 if(!lk&&(P.tone!==100||P.hue!==0||P.sat!==100))v=`<g style="filter:brightness(${P.tone/100}) saturate(${P.sat/100}) hue-rotate(${P.hue}deg)">${v}</g>`;
 const hs=P.ht/100,bot=.97*z,tr=y=>bot-(bot-y)*hs;if(hs!==1)v=`<g transform="translate(0 ${F(bot*(1-hs))}) scale(1 ${F(hs)})">${v}</g>`;
 const room=(sc==null?1:sc),c=z/2,yB=tr((rY+.01)*z),N=on.length;
 const tear=(h,w,fill,cls)=>{const ya=yB-h;return `<path d="M${F(c)} ${F(ya)}C${F(c+w*.55)} ${F(ya+h*.35)} ${F(c+w)} ${F(ya+h*.72)} ${F(c)} ${F(yB)}C${F(c-w)} ${F(ya+h*.72)} ${F(c-w*.55)} ${F(ya+h*.35)} ${F(c)} ${F(ya)}Z" class="tf ${cls}" ${fill}/>`};
 const off=`fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="${F(z/40)}"`;
 let fls="";const fh=p("fh"),fwd=p("fwd");
 if(room<=.01)fls=`<path d="M${F(c)} ${F(yB-z*.03)}q${F(z*.06)} ${F(-z*.1)} 0 ${F(-z*.2)}q${F(-z*.06)} ${F(-z*.1)} 0 ${F(-z*.2)}" class="smoke" stroke-width="${F(z*.03)}"/>`;
 else{const lit0=N===1?on[0]:on[1],lit1=on[0];
  if(lit0&&mat==="lit")fls+=`<ellipse cx="${F(c)}" cy="${F(yB-z*fh*.5*room)}" rx="${F(z*(fwd*2)*room)}" ry="${F(z*fh*.68*room)}" fill="url(#flHalo)"/>`;
  fls+=tear(z*fh*room,z*fwd*room,lit0?`fill="url(#flTall)"`:off,"outer "+(N===1?cl(0):cl(1)));
  if(N>1)fls+=tear(z*fh*.52*room,z*fwd*.5*room,lit1?`fill="#fffdf2"`:off,cl(0))}
 const top=yB-z*fh*room*1.05,fit=top<0?bot/(bot-top):1;const out=v+`<path d="M${F(c)} ${F(yB+z*.004)}v${F(-z*.03)}" stroke="#1a1006" stroke-width="${F(z/70)}" stroke-linecap="round"/>`+fls;
 return fit<1?`<g transform="translate(${F(c*(1-fit))} ${F(bot*(1-fit))}) scale(${F(fit)})">${out}</g>`:out}

// ---- 每部书自己的复习入口
const FSTUDY={};
// ---- 学习节奏（跟课程 / 每周定量 / 自由）
let COURSEP=false;const DL={};

// 跟课程：课程讲到的那一颂（每部书各记一个）
const gIdx=n=>{const B=bookOf(n);const i=B.seqI[n.id];return i!=null?i:B.seqI[fl(n).id]};
const courseLeaf=B=>{B=B||BK;const id=B&&SR.course[B.id];return id&&B.by[id]||null};
function paceOK(n){if(ST.pace!=="course")return true;const m=courseLeaf(bookOf(n));return !m||gIdx(n)<=gIdx(m)}
function newNodeAny(B){return bfsAll(B).find(n=>unlocked(n)&&nstate(n).L.length<stepsOf(n).length)}
function wkNew(){return SR.wk.id===weekId()?SR.wk.n:0}
function quotaFull(){return ST.pace==="quota"&&wkNew()>=+ST.qpw}
function courseLeft(B){const m=courseLeaf(B);if(!m)return 0;let t=0;B.seq.forEach(n=>{if(gIdx(n)<=gIdx(m)&&n.v.length&&!(stepsOf(n).includes("mask")&&itm(n,"mask")))t+=n.v.length});return t}
function paceState(C,B){const pre=B.id+":";if(!Object.keys(SR.it).some(k=>k.startsWith(pre)))return "fresh";if(C.tot)return "go";
 if(!newNodeAny(B))return "done";
 if(ST.pace==="course"&&courseLeaf(B)&&!newNodes(B,1).length)return "caught";if(quotaFull())return "quota";return "rest"}
const LSTATE={auto:"按实际进度",fresh:"刚开始（还没学过）",go:"有复习 / 新学",caught:"已跟上课程",quota:"本周定量用完",rest:"今日已完成",done:"整本圆满"};
function idleSide(state,id){const lamp=pillLamp(state==="done"?0:0);const B=id&&BOOKS[id];
 // 当天都做完后：按钮大小不变，小字换成红底小签「再学 ›」，点了再学下一支
 if(B&&state!=="done"&&state!=="fresh"&&extraQueue(B).length){const t=state==="caught"?["跟上了","等下次课"]:state==="quota"?[ST.qpw+"/"+ST.qpw,"本周已满"]:["已复习","今日 ✓"];
  return `<button class="hside at-edge done idle more hm-chip" data-more="${id}" aria-label="${t[0]}，可以继续学习">${lamp}<b>${t[0]}</b><small>再学 ›</small></button>`}
 if(B&&state==="done")return goldSide({rev:0},id);
 if(state==="caught")return `<span class="hside at-edge done idle">${lamp}<b>跟上了</b><small>等下次课</small></span>`;
 if(state==="quota")return `<span class="hside at-edge done idle">${lamp}<b>${ST.qpw}/${ST.qpw}</b><small>本周已满</small></span>`;
 if(state==="done")return `<span class="hside at-edge gold idle">${lamp}<b>圆满</b><small>整本背完</small></span>`;
 return `<span class="hside at-edge done idle">${lamp}<b>已复习</b><small>今日 ✓</small></span>`}
function paceLine(w){if(!w.real||ST.cshow==="off"||!lmOn(BOOKS[w.id]))return "";
 if(ST.pace==="course"){const B=BOOKS[w.id],m=courseLeaf(B);return `<span class="hpace"><i class="flag">⚑</i>课到 ${m?esc(m.code+" "+m.title):"（未设）"} · 待学 ${courseLeft(B)} 颂<button data-course="${w.id}">改</button></span>`}
 if(ST.pace==="quota")return `<span class="hpace">本周新学 ${Math.min(wkNew(),+ST.qpw)}/${ST.qpw} 颂</span>`;return ""}
function coursePickHTML(){if(!COURSEP)return "";const B=BOOKS[COURSEP]||BK;if(!B)return "";const m=courseLeaf(B);
 const rows=[[B.id,B]].map(([k,B])=>`<div class="cpg">${esc(B.title)}</div>`+B.seq.filter(n=>n.v.length&&!n.x).map(n=>`<button class="cpr ${n===m?"on":""} ${m&&gIdx(n)<gIdx(m)?"past":""}" data-cpick="${k}:${n.id}">${badge(n)}<span><b>${esc(n.title)}</b><small>${esc((n.v[0]||"").slice(0,16))}…</small></span>${n===m?"<em>课到这里</em>":""}</button>`).join("")).join("");
 return `<div class="cpov" data-cpclose><div class="cpsh" role="dialog" aria-label="课程讲到哪了"><div class="cph"><b>课程讲到哪了？</b><button data-cpclose aria-label="关闭">✕</button></div><p>选课上最后讲到的一颂。只会给你出这之前的新内容，之后的等下次课再学。</p><div class="cpl">${rows}</div></div></div>`}
// ---- 缓存
const CLOUD=`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18h10.5a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.4 9.2 4.4 4.4 0 0 0 7 18z"/><path d="M12 10.5v5.2M9.8 13.6 12 15.8l2.2-2.2"/></svg>`;
function cloudHTML(w){if(w.real||DL[w.id]==="ok")return "";if(DL[w.id]==="ing")return `<span class="hcloud ing" aria-label="下载中"><svg viewBox="0 0 20 20" width="18" height="18"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-opacity=".25" stroke-width="2"/><circle class="arc" cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="50.3" stroke-dashoffset="50.3" transform="rotate(-90 10 10)"/><rect x="7.4" y="7.4" width="5.2" height="5.2" rx="1" fill="currentColor"/></svg></span>`;
 return `<button class="hcloud" data-dl="${w.id}" aria-label="下载《${esc(w.title)}》到本机">${CLOUD}</button>`}
// ---- 连续天数条

function streakHTML(){if(ST.skst==="off"||ST.sklamp===false)return "";if(ST.skst==="lamps")return streakLamps();const wk=HIST.slice(-7),wsum=wk.reduce((a,b)=>a+b,0);const vs=Object.values(BOOKS).reduce((a,B)=>a+bookVs(B)[0],0);
 const ex=ST.skc==="streak"?"":`<span class="skx">${[`本周 <b>${wsum}</b> 题`,...(ST.skc==="full"?[`已背 <b>${vs}</b> 颂`,`正确率 <b>86</b>%`]:[])].join('<i class="sep">·</i>')}</span>`;
 const DN="一二三四五六日";const today=6;
 let vis="";
 if(ST.skst==="beads")vis=`<span class="skd">${wk.map((c,i)=>`<i class="${c?"on":""} ${i===today?"td":""}" title="周${DN[i]}"><em>${DN[i]}</em></i>`).join("")}</span>`;
 if(ST.skst==="lamps")vis=`<span class="skl">${wk.map((c,i)=>`<span class="${c?"on":"off"}">${pillLampAt(c?0:6,15)}</span>`).join("")}</span>`;
 if(ST.skst==="cal")vis=`<span class="skc">${HIST.map(c=>`<i style="--h:${c?Math.min(1,.25+c/14):0}"></i>`).join("")}</span>`;
 const big=ST.skst==="num"?`<span class="skn"><b>${SR.streak}</b> 天连续</span>`:`<span class="skn">${ST.skst==="lamps"?"":pillLampAt(0,18)}<b>${SR.streak}</b><small>天</small></span>`;
 return `<div class="skbar sk-${ST.skst} skc-${ST.skc}">${big}${vis}${ex}</div>`}
function pillLampAt(d,z){const o=ST.plz;ST.plz=z;const s=pillLamp(d).replace('class="plamp"','class="plamp sk"');ST.plz=o;return s}
// ---- 阅读页：颂词标题上的学习进度 + 直接修改
let PACESH=false,PRESTART=false;
function leafState(n){if(!n.v||!n.v.length)return null;const S=stepsOf(n),L=S.filter(k=>itm(n,k));
 if(ST.pace==="course"&&!n.x&&!paceOK(n)&&!L.length)return "after";
 if(L.length&&S.some(k=>{const t=itm(n,k);return t&&t.due<=0}))return "due";
 if(S.length&&L.length===S.length)return "done";
 if(L.length)return "ing";return "new"}
const LSN={done:"已背",due:"该复习",ing:"学到一半",new:"待学",after:"课程后面"};
function ltProg(n){const s=leafState(n);if(!s||ST.rprog==="off"||!lmOn(bookOf(n)))return "";const S=stepsOf(n);
 if(ST.rprog==="bar")return `<span class="lpb s-${s}" title="${LSN[s]}">${S.map(k=>{const t=itm(n,k);return `<i class="${t?(t.due<=0?"due":"on"):""}"></i>`}).join("")}</span>`;
 if(ST.rprog==="chip"||ST.rprog==="bg")return `<span class="lpc s-${s}">${LSN[s]}</span>`;
 return ""}
const vLeaves=B=>B.seq.filter(n=>n.v.length&&!n.x);
function clineHTML(n){if(!lmOn(bookOf(n))||ST.pace!=="course"||ST.redit==="menu"||courseLeaf(bookOf(n))!==n)return "";
 return `<div class="cline"><span class="cl">⚑ 课程讲到这里</span><span class="cbtn"><button data-cmv="-1" aria-label="课程往前一颂">▲</button><button data-cmv="1" aria-label="课程往后一颂">▼</button></span></div>`}
function moveCourse(d){const L=vLeaves(BK);const m=courseLeaf(BK);let i=L.indexOf(m);if(i<0)i=0;const t=L[Math.max(0,Math.min(L.length-1,i+d))];SR.course[BK.id]=t.id;ST.anchor=t.id;ST.anchorKeep=null;render()}
function ltSheet(n,app){const old=app.querySelector(".ltsh");if(old)old.remove();const isC=courseLeaf(bookOf(n))===n;const el=document.createElement("div");el.className="ltsh";
 el.innerHTML=`<div class="lth">${badge(n)}<b>${esc(n.title)}</b><button data-ltx aria-label="关闭">✕</button></div><button data-lta="course" ${isC?"disabled":""}>⚑ ${isC?"课程正讲到这里":"课程讲到这里"}</button>`;
 app.appendChild(el);el.querySelector("[data-ltx]").onclick=()=>el.remove();
 el.querySelectorAll("[data-lta]").forEach(b=>b.onclick=()=>{SR.course[n.bk]=n.id;ST.anchor=n.id;ST.anchorKeep=null;render()})}
// ---- 书卡 ⋯ → 学习节奏
let RESETC=false;
function paceSheetHTML(){if(!PACESH)return "";const B=BOOKS[PACESH]||BK;const c=ST.pace==="course",m=courseLeaf(B);
 return `<div class="cpov" data-cpclose><div class="cpsh pcsh" role="dialog" aria-label="学习节奏"><div class="cph"><b>${PRESTART?"先选一种学习节奏":"学习节奏 · "+esc(B.title)}</b><button data-cpclose aria-label="关闭">✕</button></div>
  ${PRESTART?"":`<button class="lmsw ${lmOn(B)?"on":""}" data-lmsw="${B.id}" role="switch" aria-checked="${lmOn(B)}"><span><b>学习模式</b><small>${lmOn(B)?"书卡上显示学习按钮，安排背诵和复习":"已关闭，只阅读。学过的记录都还在"}</small></span><i></i></button>`}
  ${!PRESTART&&!lmOn(B)?`<button class="pri pdone" data-pdone>完成</button></div></div>`:`<button class="pco ${c?"on":""}" data-pace="course"><i></i><span><b>跟课程</b></span></button>
  ${c?`<button class="pcbtn" data-course="${B.id}" aria-label="修改课程进度"><span class="pcl">课到</span><b>${m?esc(m.code+" "+m.title):"未设"}</b><span class="pcg">改 ›</span></button>`:""}
  <button class="pco ${!c?"on":""}" data-pace="quota"><i></i><span><b>每周定量</b></span></button>
  ${!c?`<div class="pcx"><span class="stp"><button data-qd="-1" aria-label="少一颂">−</button><b>${ST.qpw}</b><button data-qd="1" aria-label="多一颂">＋</button></span> 颂 / 周</div>`:""}
  <button class="pri pdone" data-pdone>${PRESTART?"开始学":"完成"}</button></div></div>`}`}
function resetHTML(){if(!RESETC)return "";const B=BOOKS[RESETC];return `<div class="cpov cfov" data-rsno><div class="cfd" role="alertdialog" aria-label="确认重置进度"><b>重置《${esc(B?B.title:"")}》的进度？</b><p>所有背诵和复习记录都会清空，从第一颂重新开始。这一步不能撤销。</p><div class="cfb"><button data-rsno>取消</button><button class="danger" data-rsyes>重置</button></div></div></div>`}
// ---- 连续点灯条
const CNM=["一","二","三","四","五","六","七","八","九","十","十一","十二"];
function streakLamps(){const now0=Date.now();const wk=[6,5,4,3,2,1,0].map(i=>SR.hist[dkey(now0-i*DAY)]||null);const C=todayCount();const T=todayRec();const todayOn=!!T.n,todayFull=todayOn&&!C.tot;const STK=streakN();const z=+ST.sklz;const now=new Date();
 // 按星期排：周一在最左，今天之后是暗的空灯
 const ti=(now.getDay()+6)%7;const days=wk.map((_,i)=>{const d=new Date(now);d.setDate(now.getDate()-(ti-i));return d});const WD="日一二三四五六";
 const wsum=wk.slice(6-ti).reduce((a,b)=>a+(b?b.n:0),0);const vs=Object.values(BOOKS).reduce((a,B)=>a+bookVs(B)[0],0);
 const ex=ST.skc==="streak"?"":`<span class="skx">${[`本周 <b>${wsum}</b> 题`,...(ST.skc==="full"?[`已背 <b>${vs}</b> 颂`,`正确率 <b>86</b>%`]:[])].join('<i class="sep">·</i>')}</span>`;
 const M=ST.skm,mon=CNM[now.getMonth()]+"月";
 const lamps=wk.map((_,i)=>{const fut=i>ti,c=fut?null:wk[6-(ti-i)];const on=i===ti?todayOn:!!(c&&c.n);const full=i===ti?todayFull:!!(c&&c.full);const d=days[i];const newM=i>0&&d.getMonth()!==days[i-1].getMonth();
  const lab=M==="date"||M==="both"?(newM?`${d.getMonth()+1}月`:`${d.getDate()}`):(i===ti?"今":WD[d.getDay()]);
  return `<span class="sl ${on?"on":"off"} ${i===ti?"td":""} ${fut?"fut":""}">${pillLampAt(on?0:10,z)}<em>${lab}</em></span>`}).join('<i class="sksp"></i>');
 const head=M==="text"||M==="both"?`<small class="skm">${mon}</small>`:"";
 const tag=M==="date"?`<span class="skmt"><b>${days[0].getMonth()+1}</b>月</span>`:"";
 return `<div class="skbar sk2 bg-${ST.skbg} lay-${ST.sklay} m-${M}" style="--lzb:${z}px;--lgb:${ST.skgap}px;--stf:${ST.sktf}px;--snf:${ST.sknf}px"><span class="skt">${head}${STK?`<span class="sk1">已连续点灯</span><span class="sk2n"><b>${STK}</b> 天</span>`:`<span class="sk1">还没点灯</span><span class="sk0">今天点<br>第一盏</span>`}</span>${tag}<span class="skl2">${lamps}</span>${ex}</div>`}
// 书卡上的复习按钮：last = 几天没复习了（灯随天数变小、按钮变暗）
function wStudy(w){const B=BOOKS[w.id];if(!B)return null;const C=bookCount(B);const l=SR.last[B.id];const last=l&&C.rev?Math.max(0,dayDiff(Date.now(),l)):0;return {rev:C.rev,nw:C.nw,last,state:paceState(C,B)}}
const agoT=d=>d===0?"今天复习过":d===1?"昨天复习过":`${d} 天没复习了`;
const tempOf=d=>d<=1?0:d<=3?1:d<=7?2:3;
function lampIcon(d){const h=[1,.8,.55,.3,0][Math.min(4,Math.floor(d/2))];return `<svg class="llamp" width="14" height="16" viewBox="0 0 14 16" aria-hidden="true">${h?`<path d="M7 ${(9-7*h).toFixed(1)}C${(7+3.2*h).toFixed(1)} ${(9-3.6*h).toFixed(1)} ${(7+2.6*h).toFixed(1)} 9 7 9.4C${(7-2.6*h).toFixed(1)} 9 ${(7-3.2*h).toFixed(1)} ${(9-3.6*h).toFixed(1)} 7 ${(9-7*h).toFixed(1)}Z" fill="#f2b84b"/>`:`<path d="M7 8.8v-2" stroke="currentColor" stroke-width="1" opacity=".5"/>`}<path d="M1.5 10h11q-1 4-5.5 4T1.5 10z" fill="currentColor"/></svg>`}
function arcIcon(d){const f=Math.max(0,1-d/7),r=5.5,C=2*Math.PI*r;return `<svg class="larc" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="${r}" fill="none" stroke="currentColor" stroke-opacity=".25" stroke-width="2"/><circle cx="7" cy="7" r="${r}" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="${(C*f).toFixed(2)} ${C.toFixed(2)}" transform="rotate(-90 7 7)"/></svg>`}
function pillHTML(st,id){const d=st.last,tot=st.rev+st.nw;
 if(!tot)return `<span class="hlrow"><span class="hlearn done pld" style="padding-left:${+ST.plz+2}px">${pillLamp(0)}<span>今日已复习 ✓</span></span></span>`;
 const dk=[0,8,22,22,38,38,38,38][d]??52,rd=d<1?0:Math.min(100,Math.round((d-1)/6*100));
 return `<span class="hlrow"><button class="hlearn plb" ${id?`data-learn="${id}"`:""} style="--dk:${dk}%;padding-left:${+ST.plz+2}px">${pillLamp(d)}<span>复习 ${st.rev}${st.nw?` · 新学 ${st.nw}`:""}</span>${d>=1?`<i class="pday" style="--rd:${rd}%">${d} 天</i>`:""}</button></span>`}
const HLAY={stack:"A 按钮在信息下方",inline:"C 灯收进按钮",side:"D 右侧灯签",foot:"E 底栏"};
// 整本圆满：金底大字「圆满」+ 深色小签；有到期「复习 N ›」，没有到期「再复习 ›」随机抽 5 条
function bookAllDone(B){const pre=B.id+":";return Object.keys(SR.it).some(k=>k.startsWith(pre))&&!newNodeAny(B)}
function freeQueue(B){const L=[];bfsAll(B).forEach(n=>stepsOf(n).forEach(k=>{if(itm(n,k))L.push({n,k,B,isNew:false})}));return shuffle(L,L.length*5+new Date().getDate()).slice(0,5)}
function goldSide(st,id){const due=st.rev||0;const lamp=pillLamp(0);
 return `<button class="hside gold hg-seal ${due?"":"gidle"}" ${due?`data-learn="${id}"`:`data-grev="${id}"`} aria-label="${due?"整本圆满，复习 "+due+" 条":"整本圆满，再复习几条"}">${lamp}<b>圆满</b><small class="gchip">${due?"复习 "+due+" ›":"再复习 ›"}</small></button>`}
// 继续学习：再学一支，不受每天新学数量限制
function extraQueue(B){const bs=B?[B,...Object.values(BOOKS).filter(x=>x!==B)]:Object.values(BOOKS);for(const X of (B?[B]:bs)){const n=newNode(X)||newNodeAny(X);if(n){const miss=stepsOf(n).filter(k=>!itm(n,k));return ["exp","mask","loc"].filter(k=>miss.includes(k)).map(k=>({n,k,B:X,isNew:true}))}}return []}
function startExtra(q,o){if(!q.length)return;SS={B:q[0].B,q,i:0,res:[],daily:false,from:"home",extra:true,...(o||{})};SS.t=initTask(q[0]);ST.screen="study";ST.tocOpen=false;MENU=null;render();bindPanel()}
function sideHTML(st,id){const d=st.last,tot=st.rev+st.nw;
 if(id&&BOOKS[id]&&bookAllDone(BOOKS[id]))return goldSide(st,id);
 if(!tot)return idleSide(st.state||"rest",id);
 const dk=[0,8,22,22,38,38,38,38][d]??52,rd=d<1?0:Math.min(100,Math.round((d-1)/6*100));
 return `<button class="hside" ${id?`data-learn="${id}"`:""} style="--dk:${dk}%">${pillLamp(d)}${ST.esub==="none"?"":ST.esub==="num"?`<b class="enum">${tot}</b>`:st.rev?`<b>复习 ${st.rev}</b>`:`<b>开始学</b>`}${ST.esub==="two"?(st.nw?`<small>新学 ${st.nw}</small>`:"<small>&nbsp;</small>"):""}${d>=1&&ST.edt!=="off"?`<i class="pday" style="--rd:${rd}%">${d} 天${ST.edt==="bottom"?"没复习":""}</i>`:""}</button>`}
function studyPill(w){const st=wStudy(w);return st?pillHTML(st,w.id):""}
function ringTitle(n,s){if(!s.unl)return "还没解锁";return s.S.map(k=>SK[k==="mask"?"mask":k]+(itm(n,k)?" ✓":" ○")).join("　")+(s.fade?"　· 该复习了":"")}
// ---- 会话
let SS=null;
// 先排复习（打乱，就是第 5 步「混」），再排新学
function buildQueue(B){const rev=dueList(B);const q=shuffle(rev,rev.length*7+3+new Date().getDate());
 if(rev.length<=20&&!quotaFull())newNodes(B,newLeft(B)).forEach(n=>{const miss=stepsOf(n).filter(k=>!itm(n,k));["exp","mask","loc"].filter(k=>miss.includes(k)).forEach(k=>q.push({n,k,B,isNew:true}))});
 return q}
// 每日一颂：只从自己学过的颂里出，一天一题
function pickDaily(){const L=[];Object.values(BOOKS).forEach(B=>B.seq.forEach(n=>{if(n.v.length&&!n.x&&itm(n,"loc"))L.push({n,B})}));if(!L.length)return null;const d=new Date();const x=L[(d.getFullYear()*372+d.getMonth()*31+d.getDate())*7%L.length];return {n:x.n,B:x.B,k:"loc",isNew:false,daily:true}}
function initTask(t){if(!t)return null;const n=t.n;
 if(t.k==="loc"){const L=leavesOf(n);const leaf=n.v.length?n:L[(n.id.length*3+L.length)%L.length];const path=[...anc(n),n];let lay=0;while(lay<path.length-1&&path[lay].p.c.length===1)lay++;
  return {kind:"loc",leaf,path,lay,auto:lay,bad:{},wrong:0,done:false,chances:t.daily?5:null}}
 if(t.k==="exp"){let dis=[];if(!t.isNew){const pool=t.B.all.filter(x=>x.lvl===n.lvl+1&&x.p!==n);const i0=t.B.all.indexOf(n);pool.sort((a,b)=>Math.abs(t.B.all.indexOf(a)-i0)-Math.abs(t.B.all.indexOf(b)-i0));dis=pool.slice(0,n.c.length>2?2:1).map(x=>x.id)}
  return {kind:"exp",order:shuffle([...n.c.map(x=>x.id),...dis],n.c.length*13+dis.length),dis:new Set(dis),placed:[],wrong:0,shake:null,done:false}}
 return {kind:"mask",r:t.isNew?0:3,peek:false,wrong:false,done:false}}
function dayMark(B){const T=todayRec();T.n++;SR.last[B.id]=Date.now();const h=SR.hist[T.date]||(SR.hist[T.date]={n:0});h.n=T.n}
// 回向：当天第一次结束学习时弹一次
// 回向不再自动弹出，改成首页顶栏的「回向」按钮；当天点了灯还没回向时按钮带金色提示
function dediMaybe(){markFull()}
// 评分只用两档：答对 / 记得 = Good，答错 / 模糊 = Again。答错的这一轮末尾再出一次（只出一次，不再记分）
function grade(t,ok){dayMark(t.B);if(t.daily){SR.daily={date:dkey(),done:true,ok,used:5-SS.t.chances};markFull();save();return}
 if(t.again){SS.res.push({t,ok,first:false,again:true});markFull();save();return}
 const key=ckey(t.n,t.k);const o=SR.it[key];const was=!!o;const now=new Date();
 const r=fsrsI().next(o?toCard(o):FSRS.createEmptyCard(now),now,ok?FSRS.Rating.Good:FSRS.Rating.Again);SR.it[key]=fromCard(r.card);
 const days=Math.max(1,dayDiff(r.card.due,now));
 if(t.isNew){todayRec().nodes[t.n.bk+":"+t.n.id]=1;if(t.k==="mask"){if(SR.wk.id!==weekId())SR.wk={id:weekId(),n:0};SR.wk.n+=t.n.v.length}}
 SS.res.push({t,ok,first:!was,days});if(!ok)SS.q.push({...t,isNew:false,again:true});markFull();save()}
function startSession(opt){const B=opt&&opt.B||BK;SS={B,q:opt&&opt.daily?[opt.daily]:buildQueue(B),i:0,res:[],daily:!!(opt&&opt.daily),from:ST.screen==="study"?"home":ST.screen};SS.t=initTask(SS.q[0]);ST.screen="study";ST.tocOpen=false;render();bindPanel()}
function exitSession(){const f=SS&&SS.from||"home";SS=null;ST.screen=f;render();bindPanel();dediMaybe()}
function chipsPath(A){return `<div class="spath">${A.map(x=>`<span style="--lc:var(--k${x.depth})"><b>${x.code}</b>${esc(x.title)}</span>`).join("<i>›</i>")}</div>`}
function whyBody(t,T){const G=shyG(bkKey(t.B),T.leaf.id);
 if(!G||!G.some(g=>g.t.length))return `<p>科判名本身就是这几颂的概括：「${esc(t.n.title)}」说的正是上面这段颂词的内容。</p><small>这一科还没有挂上释义。</small>`;
 return `<div class="shyb whyb" style="--sf:${ST.shyf}px">${G.map(g=>shyBody(g,G.length>1)).join("")}<p class="shysrc">——${esc(t.B.syName?"《"+t.B.syName+"》":"释义")}</p></div>`}
function locHTML(t,T){const P=T.path,chosen=P.slice(0,T.lay),cur=T.done?null:P[T.lay];const base=P[0].lvl;
 const ob=c=>{const w=T.bad[c.id];return `<button class="lo ${w?"bad":""}" data-lo="${c.id}" ${w?"disabled":""} style="--lc:var(--k${c.depth})">${badge(c)}<span class="lt2">${esc(c.title)}</span>${w?`<em>${w}</em>`:""}</button>`};
 const opts=cur?`<div class="lopts">${cur.p.c.map(ob).join("")}</div>`:"";
 let mid;
 if(ST.locsty==="tree")mid=`<div class="ltree">${chosen.map((x,i)=>`<div class="lr ${i<T.auto?"auto":""}" style="--lc:var(--k${x.depth});margin-left:${(x.lvl-base)*10}px">${badge(x)}<span>${esc(x.title)}</span></div>`).join("")}${cur?`<div class="lnext" style="margin-left:${(cur.lvl-base)*10}px">${opts}</div>`:""}</div>`;
 else mid=`<div class="lpath">${chosen.map((x,i)=>`<span class="${i<T.auto?"auto":""}" style="--lc:var(--k${x.depth})"><b>${x.code}</b>${esc(x.title)}</span>`).join("<i>›</i>")}${cur?`${chosen.length?"<i>›</i>":""}<span class="lqm">？</span>`:""}</div>${opts}`;
 const res=T.done?`<div class="sres ${T.wrong?"no":"ok"}">${t.daily?(T.fail?"5 次机会用完了，答案在上面":`用了 ${5-T.chances} 次机会就找到了`):T.wrong?`中途选错过 ${T.wrong} 次，这题按答错记`:"一次选对"}</div>
  ${t.daily?"":`<details class="why"><summary>为什么归在「${esc(t.n.title)}」？先自己想一想</summary>${whyBody(t,T)}</details>`}`:"";
 return `<div class="lq"><div class="lql">${T.done?"":"这一颂在哪一科？"}${t.daily?"":`<span>${T.done?"":`${P[T.auto].code?`从${P[T.auto].code[0]}开始，`:""}一层一层选`}</span>`}</div>${verseHTML(T.leaf.v)}</div>${mid}${res}`}
function expHTML(t,T){const n=t.n,B=t.B,R=!n.p;
 const head=`${R?"":chipsPath(anc(n).slice(-3))}<div class="eh" style="--lc:var(--k${n.depth||0})">${R?"":badge(n)}<b>${esc(R?B.title:n.title)}</b><span>分 <em>${n.c.length}</em> 支，依次是？${t.isNew?"<small>第一次学：只有正确的卡片</small>":T.dis.size?`<small>混了 ${T.dis.size} 张别处的卡片</small>`:""}</span></div>`;
 let mid;
 if(ST.expsty==="tree")mid=`<div class="etree" style="--lc:var(--k${n.depth||0})">${T.placed.map(id=>{const c=B.by[id];return `<div class="er" style="--lc:var(--k${c.depth})">${badge(c)}<span>${esc(c.title)}</span></div>`}).join("")}${T.done?"":`<div class="er next"><span class="en">${T.placed.length+1}</span><span>？</span></div>`}</div>`;
 else mid=`<div class="eslots">${n.c.map((c,i)=>{const p=T.placed[i];return `<div class="es ${p?"fill":""} ${!T.done&&i===T.placed.length?"next":""}" style="--lc:var(--k${c.depth})">${p?badge(c):`<span class="en">${i+1}</span>`}<span>${p?esc(c.title):""}</span></div>`}).join("")}</div>`;
 const cards=T.done?"":`<div class="ecards">${T.order.filter(id=>!T.placed.includes(id)).map(id=>`<button class="ec ${T.shake===id?"shake":""}" data-ec="${id}">${esc(B.by[id].title)}</button>`).join("")}</div>`;
 const res=T.done?`<div class="sres ${T.wrong?"no":"ok"}">${T.wrong?`点错过 ${T.wrong} 次，这题按答错记`:"顺序全对"}</div>`:"";
 return head+mid+cards+res}
function maskHTML(t,T){const n=t.n;const r=T.r;
 const v=r===0||T.done?verseHTML(n.v):verseMaskHTML(n.v,r).replace('class="verse vm"',`class="verse vm ${T.peek?"peek":""}" data-peek`);
 return `${chipsPath(anc(n).slice(-3))}<div class="eh" style="--lc:var(--k${n.depth})">${badge(n)}<b>${esc(n.title)}</b><span>下面的颂词，背出来</span></div>
  <div class="mv mb-${ST.mkb}" style="--mko:${ST.mko}%;--mkr:${ST.mkr}px;--mkg:${ST.mkg}px">${v}</div>
  <div class="mdots">${RND.map((x,i)=>`<i class="${T.done||i<r?"on":i===r?"cur":""}" title="${x}"></i>`).join("")}<span>${T.done?"背完了":`第 ${r+1} 轮 · ${RND[r]}${r>0&&!T.peek?"　心里背完，点颂词核对":""}`}</span></div>
  ${T.done?`<div class="sres ${T.wrong?"no":"ok"}">${t.isNew?"四轮都过了":T.wrong?"中途模糊过，按答错记":"首字提示下记得"}</div>`:""}`}
function fbHTML(t){const last=SS.res[SS.res.length-1];if(!last||t.daily)return "";const n=t.n;
 const msg=last.again?(last.ok?"这次记住了，明天再来":"还不牢，明天再练"):!last.ok?`还不牢，过一会儿再出现`:last.first?`${SK[t.k]}这一段亮了${nstate(n).gold?"，整个节点变金":""}`:`下次大约 ${last.days} 天后再来`;
 return `<div class="sfb">${ST.sfb==="ring"&&ST.ring!=="none"?ringHTML(n,"big",last.first?t.k:null):""}<div><b>${esc(n.p?n.code+" "+n.title:t.B.title)}</b><span>${msg}</span></div></div>`}
function taskHTML(t,T){const k=T.kind;const body=k==="loc"?locHTML(t,T):k==="exp"?expHTML(t,T):maskHTML(t,T);
 const last=SS.i===SS.q.length-1;
 const foot=T.done?`${fbHTML(t)}<div class="sacts">${ST.sview==="sheet"&&!t.daily?`<button data-jump>在原文里看看</button>`:""}<button class="pri" data-next>${t.daily?"回书架":last?"完成":"下一题"}</button></div>`
  :k==="mask"?`<div class="sacts"><button data-mj="fuzzy">模糊</button><button class="pri" data-mj="ok">${T.r===3?"记得 · 完成":"记得"}</button></div>`:"";
 return `<div class="tk tk-${k}"><div class="tkh"><span class="tkind ${t.isNew?"new":""} ${t.daily?"dly":""}">${t.daily?"每日一颂":(t.isNew?"新学":"复习")+" · "+SK[t.k]}</span><span class="tkb">${esc(shortT(t.B))}</span></div>${body}<div class="tkf">${foot}</div></div>`}
function moreBtn(){const q=extraQueue(SS.B);return q.length?`<button class="smore" data-smore><b>继续学习</b><small>再学一支：${esc(q[0].n.code||"")} ${esc(q[0].n.title)}</small></button>`:""}
function doneHTML(){const R=SS.res;const rv=R.filter(x=>!x.t.isNew&&!x.again),nw=[...new Set(R.filter(x=>x.t.isNew).map(x=>x.t.n))];const seen=[];R.forEach(x=>{if(!seen.includes(x.t.n))seen.push(x.t.n)});
 if(!R.length)return `<div class="sdone"><div class="sdt">今天没有要复习的</div><p>新学的也都学完了。可以回去读一读，或者做每日一颂。</p>${moreBtn()}<div class="sacts"><button class="pri" data-sx>回书架</button></div></div>`;
 return `<div class="sdone"><div class="sdt">${SS.free?"又复习了一轮":SS.extra?"又学完一支":"今天的完成了"}</div><div class="sstat"><span><b>${rv.length}</b>条复习<small>答对 ${rv.filter(x=>x.ok).length}</small></span><span><b>${nw.length}</b>支新学<small>${nw.length?esc(nw[0].title):"—"}</small></span><span><b>${streakN()}</b>天连续</span></div>
  <div class="slist">${seen.map(n=>`<div class="sli">${ringHTML(n)}${n.p?badge(n):""}<span>${esc(n.p?n.title:bookOf(n).title)}</span></div>`).join("")}</div>
  ${moreBtn()}<div class="sacts"><button data-tree>看点亮树</button><button class="pri" data-sx>回书架</button></div></div>`}
function progHead(){const q=SS.q,i=SS.i,fin=i>=q.length;if(SS.daily){const c=SS.t?SS.t.chances:0;return `<span class="sttl">每日一颂</span><span class="spd chance">${[0,1,2,3,4].map(j=>`<i class="${j<c?"ok":"no"}"></i>`).join("")}</span>`}
 const p=ST.sprog==="bar"?`<span class="spb"><i style="width:${(Math.min(i+(SS.t&&SS.t.done?1:0),q.length)/q.length*100).toFixed(0)}%"></i></span>`:ST.sprog==="beads"?`<span class="spd">${q.map((_,j)=>{const r=SS.res.find(x=>x.t===q[j]);return `<i class="${j<i||(j===i&&SS.t&&SS.t.done)?(r&&!r.ok?"no":"ok"):j===i?"cur":""}"></i>`}).join("")}</span>`:`<span class="sttl">${fin?"完成":`第 ${i+1} 题 · 共 ${q.length} 题`}</span>`;
 return p+(ST.sprog!=="num"?`<span class="scnt">${fin?"":`${i+1} / ${q.length}`}</span>`:"")}
function renderStudy(){if(!SS){startSession();return}
 const fin=SS.i>=SS.q.length,t=fin?null:SS.q[SS.i],T=SS.t;
 const inner=fin?doneHTML():taskHTML(t,T);
 const head=`<div class="shd"><button class="sx" data-sx aria-label="结束">✕</button>${progHead()}</div>`;
 let root;
 if(ST.sview==="sheet"&&!fin){BK=t.B;ST.openAt=(t.k==="loc"?T.leaf:t.n).id;ST.view="toc";renderReader();const app=dev.querySelector(".app");app.classList.add("sv-sheet");if(!T.done)app.classList.add("sblur");
  const sh=document.createElement("div");sh.className="ssheet "+(T.done?"low":"");sh.innerHTML=head+`<div class="sbody">${inner}</div>`;app.appendChild(sh);root=sh;
  if(T.done){const row=app.querySelector(`.row[data-id="${(t.k==="loc"?T.leaf:fl(t.n)).id}"]`);if(row)row.classList.add("flash")}}
 else{dev.innerHTML=`<div class="app study sv-${ST.sview==="sheet"?"full":ST.sview}">${head}<div class="sbody">${ST.sview==="card"&&!fin?`<div class="sstack"><div class="scard ${!T.done&&SS.shownI!==SS.i?"in":""}">${inner}</div></div>`:inner}</div></div>`;root=dev;SS.shownI=SS.i}
 bindStudy(root,t,T);if(fin||(SS.daily&&T&&T.done))dediMaybe()}
function bindStudy(root,t,T){const rer=()=>{renderStudy()};
 root.querySelectorAll("[data-sx]").forEach(b=>b.onclick=exitSession);
 root.querySelectorAll("[data-smore]").forEach(b=>b.onclick=()=>{const from=SS&&SS.from||"home";startExtra(extraQueue(SS.B),{from})});
 root.querySelectorAll("[data-tree]").forEach(b=>b.onclick=()=>{BK=SS.B||BK;SS=null;ST.view="map";ST.screen="reader";ST.tocOpen=!wide();mmReset(null);render();bindPanel()});
 const nx=root.querySelector("[data-next]");if(nx)nx.onclick=()=>{if(SS.daily){exitSession();return}SS.i++;SS.t=initTask(SS.q[SS.i]);rer()};
 const jp=root.querySelector("[data-jump]");if(jp)jp.onclick=()=>{const id=(t.k==="loc"?T.leaf:t.n).id;BK=t.B;SS=null;ST.screen="reader";ST.openAt=id;render();bindPanel()};
 if(!t||T.done)return;
 if(T.kind==="loc")root.querySelectorAll("[data-lo]").forEach(b=>b.onclick=()=>{const want=T.path[T.lay];const c=t.B.by[b.dataset.lo];
  if(c===want){T.lay++;while(T.lay<T.path.length&&T.path[T.lay].p.c.length===1)T.lay++;if(T.lay>=T.path.length){T.done=true;grade(t,!T.wrong)}T.bad={}}
  else{T.wrong++;const sib=want.p.c;T.bad[c.id]=sib.indexOf(c)<sib.indexOf(want)?"更后":"更前";if(T.chances!=null){T.chances--;if(T.chances<=0){T.fail=true;T.lay=T.path.length;T.done=true;grade(t,false)}}}
  rer()});
 if(T.kind==="exp")root.querySelectorAll("[data-ec]").forEach(b=>b.onclick=()=>{const want=t.n.c[T.placed.length].id;T.shake=null;
  if(b.dataset.ec===want){T.placed.push(want);if(T.placed.length===t.n.c.length){T.done=true;grade(t,!T.wrong)}rer()}
  else{T.wrong++;T.shake=b.dataset.ec;b.classList.remove("shake");void b.offsetWidth;b.classList.add("shake")}});
 if(T.kind==="mask"){const v=root.querySelector("[data-peek]");if(v)v.onclick=()=>{T.peek=!T.peek;v.classList.toggle("peek",T.peek);const s=root.querySelector(".mdots span");if(s)s.textContent=`第 ${T.r+1} 轮 · ${RND[T.r]}`};
  root.querySelectorAll("[data-mj]").forEach(b=>b.onclick=()=>{T.peek=false;if(b.dataset.mj==="ok"){if(T.r>=3){T.done=true;grade(t,!T.wrong)}else T.r++}else{if(!t.isNew){T.wrong=true;if(T.r===3)T.r=2}}rer()})}}
// ---- 首页「今日」
const dailyToday=()=>SR.daily&&SR.daily.date===dkey()?SR.daily:null;
function todayHTML(kind){const C=todayCount();const d=dailyToday();const BB=Object.values(BOOKS);const pct=Math.round(BB.reduce((a,B)=>a+bookFrac(B),0)/Math.max(1,BB.length)*100);
 const daily=`<button class="tdd ${d?"done":""}" data-daily><span class="tdi">颂</span><span class="tdx"><b>每日一颂</b><small>${d?(d.ok?`✓ 用了 ${d.used} 次机会找到`:"今天的没猜中，明天再来"):"给一颂，一层层选出它在哪一科 · 5 次机会"}</small></span>${d?"":"<span class=\"tda\">›</span>"}</button>`;
 const start=`<div class="tds"><span>今日复习 <b>${C.rev}</b> 条，新学 <b>${C.nw}</b> 支</span><button class="pri" data-learn ${C.tot?"":"disabled"}>${C.tot?"开始":"已完成"}</button></div>`;
 const tree=`<button class="tdt" data-tree><span>点亮树 · ${esc(shortT(BK))}</span><span class="tdbar"><i style="width:${pct}%"></i></span><span>${pct}% ›</span></button>`;
 if(kind==="strip")return `<div class="today slim">${streakHTML()}${daily}</div>`;
 if(kind==="page"){const rows=[];Object.values(BOOKS).forEach(B=>{rows.push(`<div class="ttr r0">${ringHTML(B.root)}<b>${esc(B.title)}</b></div>`);B.root.c.forEach(c=>{rows.push(`<button class="ttr" data-tt="${bkKey(B)}:${c.id}">${ringHTML(c)}${badge(c)}<span>${esc(c.title)}</span></button>`);c.c.forEach(g=>rows.push(`<button class="ttr r2" data-tt="${bkKey(B)}:${g.id}">${ringHTML(g)}${badge(g)}<span>${esc(g.title)}</span></button>`))})});
  return `<div class="today page"><div class="tdh"><b>今日</b><span class="streak">连续 ${streakN()} 天</span></div>${daily}${start}</div><div class="tpage"><div class="tdh"><b>点亮树</b><span class="streak">${pct}%</span></div><div class="ttree">${rows.join("")}</div><button class="tdt" data-tree><span>打开完整导图</span><span>›</span></button></div>`}
 return `<div class="today"><div class="tdh"><b>今日</b><span class="streak">连续 ${streakN()} 天</span></div>${daily}${start}${tree}</div>`}

function pathHTML(A){if(!A.length)return esc(BK.title);
 const kc="k"+(ST.stem.includes("b")?" b":"")+(ST.stem.includes("u")?" u":"");
 return A.map(x=>`<span class="it"><span class="${kc}" style="--lc:var(--k${x.depth})">${x.code}</span>${esc(x.title)}</span>`).join(`<span class="a${ST.sepb?" b":""}">${esc(ST.sep)}</span>`)}

function wProg(w){const B=BOOKS[w.id];return B?bookFrac(B):0}
// 上次读到哪：每部书记一个（阅读页滚动时更新）
function wLast(w){const B=BOOKS[w.id],r=SR.recent[w.id];if(!B||!r)return null;const n=B.by[r.id];if(!n)return null;const c=B.chOf[n.id];return {txt:(c?c.name:B.title)+" › "+anc(n).slice(-1).map(x=>x.code+" "+x.title).join(""),ago:"",t:r.t||0}}
function progHTML(f,w){const pc=Math.round(f*100);if(ST.hprog==="none")return "";
 if(ST.hprog==="ring")return `<span class="hring" style="--f:${pc}" title="点亮 ${pc}%"><b>${pc}</b></span>`;
 if(ST.hprog==="beads"){const n=Math.min(24,(w.chaps.length||4)*3);const on=Math.round(f*n);return `<span class="hbeads">${Array.from({length:n},(_,i)=>`<i class="${i<on?"on":""}"></i>`).join("")}</span>`}
 return `<span class="hbar"><i style="width:${pc}%"></i></span>`}
function chapsHTML(w){const B=BOOKS[w.id];if(!B||!B.chaps.length)return "";return `<div class="hchaps ${ST.hexp==="chips"?"chips":""}">${B.chaps.map((ch,i)=>{const c=ch.name;const vt=chapVs(ch);
 return `<button class="hch" data-open="${w.id}" data-at="${ch.first.id}"><span class="hn">${i+1}</span><span class="ht">${esc(c)}</span>${ST.hexp==="chips"?"":`<span class="hbar sm"><i style="width:${vt[1]?Math.round(vt[0]/vt[1]*100):0}%"></i></span><span class="hpc ${vt[0]?"":"z"}"><b>${vt[0]}</b>/${vt[1]} 颂</span>`}</button>`}).join("")}</div>`}
function searchAll(q){q=q.trim();if(!q)return null;const R={book:[],kp:[],vs:[]};
 WORKS.forEach(w=>{if((w.title+w.full+w.roles.map(r=>r[0]).join("")).includes(q))R.book.push(w)});
 // 颂词里的标点不算：搜「暇满人身」也能找到「暇满人身极难得，」
 const qq=q.replace(/[，。！？：；、?!\s]/g,"");const strip=t=>t.replace(/[，。！？：；、?!\s]/g,"");
 Object.entries(BOOKS).forEach(([k,B])=>{B.all.forEach(n=>{if(n.p&&n.title.includes(q))R.kp.push({k,n})});if(qq)B.seq.forEach(n=>{const line=n.v.find(v=>strip(v).includes(qq));if(line)R.vs.push({k,n,line})})});
 return R}
function hl(t,q){if(t.includes(q))return esc(t).split(esc(q)).join(`<mark>${esc(q)}</mark>`);
 // 跨标点的命中：逐字对齐后整段标出
 const qq=q.replace(/[，。！？：；、?!\s]/g,"");const ch=[...t];let i0=-1,i1=-1;for(let i=0;i<ch.length&&i0<0;i++){let j=i,k=0;while(j<ch.length&&k<qq.length){if(/[，。！？：；、?!\s]/.test(ch[j])){j++;continue}if(ch[j]!==qq[k])break;j++;k++}if(k===qq.length){i0=i;i1=j}}
 return i0<0?esc(t):esc(ch.slice(0,i0).join(""))+`<mark>${esc(ch.slice(i0,i1).join(""))}</mark>`+esc(ch.slice(i1).join(""))}
function resultsHTML(R,q){if(!R)return "";const tot=R.book.length+R.kp.length+R.vs.length;if(!tot)return `<div class="sres"><div class="sempty">没有找到「${esc(q)}」</div></div>`;
 const pth=(k,n)=>{const B=BOOKS[k],c=B.chOf[n.id];return `<span class="spath">${esc(B.title)}${c?" › "+esc(c.name):""}${anc(n).slice(-2).map(x=>" › "+x.code).join("")}</span>`};
 return `<div class="sres">${R.book.length?`<div class="sg">书名</div>${R.book.map(w=>`<button class="sr" data-wopen="${w.id}"><b>${hl(w.title,q)}</b><span class="spath">${esc(w.roles.map(r=>r[0]+" "+r[1]).join(" · "))}</span></button>`).join("")}`:""}
 ${R.kp.length?`<div class="sg">科判 <small>${R.kp.length}</small></div>${R.kp.slice(0,8).map(({k,n})=>`<button class="sr" data-open="${k}" data-at="${n.id}">${badge(n)} ${hl(n.title,q)}${pth(k,n)}</button>`).join("")}`:""}
 ${R.vs.length?`<div class="sg">颂词 <small>${R.vs.length}</small></div>${R.vs.slice(0,8).map(({k,n,line})=>`<button class="sr" data-open="${k}" data-at="${n.id}"><span class="sv">${hl(line,q)}</span>${pth(k,n)}</button>`).join("")}`:""}</div>`}
function aboutHTML(w){return `<div class="hsheet-bg" data-close></div><div class="hsheet"><div class="grab"></div><div class="ah">${esc(w.title)}<small>${esc(w.full)}</small></div>
 <dl class="adl">${w.roles.map(r=>`<dt>${esc(r[1]||"作者")}</dt><dd>${esc(r[0])}</dd>`).join("")}
 ${w.compiler?`<dt>科判整理</dt><dd>${esc(w.compiler)}</dd>`:""}${w.proof&&w.proof.length?`<dt>校对</dt><dd>${w.proof.map(esc).join("、")}</dd>`:""}
 ${w.shiyi?`<dt>释义</dt><dd>${esc(w.shiyi)}</dd>`:""}<dt>版本</dt><dd>${esc([w.ed,w.date].filter(Boolean).join(" · ")||"—")}</dd><dt>规模</dt><dd>${w.chaps.length?w.chaps.length+" 品 · ":""}${w.vs} 颂</dd></dl>
 ${errataHTML(w)}<p class="anote">此科判仅供学习，禁止商用、篡改。</p>
 <div class="aacts"><button data-fb>报告错误</button><button class="pri" data-close>好</button></div></div>`}
function renderHome(){const W=wide();{const ob=dev.querySelector(".app.home .hbody2");if(ob)HTOP=ob.scrollTop}
 const ord=WORKS.map((w,i)=>({w,i,l:wLast(w)}));const rec=ord.filter(o=>o.l).sort((a,b)=>b.l.t-a.l.t);
 const list=ST.hsort==="recent"?[...rec,...ord.filter(o=>!o.l)]:ord;
 const card=({w,l})=>{const f=wProg(w);const ex=ST.hexp==="arrow"&&HEXPD===w.id;
  const lastH=l?"":0?(ST.hlast==="chip"?`<span class="hcont" data-wopen="${w.id}">继续 · ${esc(l.txt)} ›</span>`:`<span class="hlast">上次读到：${esc(l.txt)}<em>${l.ago}</em></span>`):`<span class="hlast dim">${w.real?"还没开始读":DL[w.id]==="ok"?"示例":"未下载 · 示例"}</span>`;
  const meta=`<span class="hmeta">${esc(w.roles.map(r=>r[0]).join(" · "))}${w.prose?" · 散文":""}</span>`;
  const ab=ST.habout==="icon"?`<button class="hab" data-about="${w.id}" aria-label="关于${esc(w.title)}">ⓘ</button>`:`<button class="hab" data-menu="${w.id}" aria-label="更多">⋯</button>`;
  const ar=ST.hexp==="arrow"?`<button class="hex ${ex?"on":""}" data-exp="${w.id}" aria-label="展开各品">⌄</button>`:"";
  const lrn=ST.lentry==="book"&&lmOn(BOOKS[w.id])?studyPill(w):"";const ws=wStudy(w);const stale=ST.lentry==="book"&&ST.lhint==="spine"&&ws?"stale"+tempOf(ws.last):"";
  const L=ST.hlay;let outer="";const lrnB=L==="row"?`<span class="hrow2">${lastH}${lrn}</span>`:L==="side"||L==="foot"?"":lrn;
  const SP=ST.hsidep,sideIn=lrn&&L==="side"&&SP!=="right"&&SP!=="edge"?sideHTML(ws,w.id).replace(/class="hside/,`class="hside in-${SP}`):"";if(lrn&&L==="side"&&(SP==="right"||SP==="edge"))outer=sideHTML(ws,w.id).replace(/class="hside/,`class="hside at-${SP}`);if(lrn&&L==="foot")outer=`<div class="hfoot">${lrn}</div>`;
  const menu=MENU===w.id?`<div class="hmenu"><button data-about="${w.id}">关于这部论</button><button data-addshy="${w.id}">${w.shiyi?"换讲记":"加讲记"}</button><button data-pacesh="${w.id}">学习节奏</button>${w.chaps.length?`<button data-exp2="${w.id}">查看各品</button>`:""}<button data-reset="${w.id}" class="mdanger">重置进度</button>${w.builtin?"":`<button data-bdel="${w.id}" class="mdanger">从书架删除</button>`}</div>`:"";
  return `<div class="hw hc-${ST.hcard} hl-${ST.hlay} sp-${ST.hsidep} ea-${ST.eal} ec-${ST.eclr} ed-${ST.edt} ${lrn?"has-l":""} ${w.real?"":"na"} ${stale}" data-w="${w.id}" style="--hgap:${ST.hgap}px;--ew:${ST.ew}px;--efs:${ST.efs}px;--er:${ST.er}px"><div class="hwm" data-wopen="${w.id}" role="button" tabindex="0">
   ${sideIn&&SP==="left"?sideIn:""}${ST.hcard==="spine"&&sideIn&&SP==="under"?`<span class="hspcol"><span class="hsp">${esc(w.title)}</span>${sideIn}</span>`:ST.hcard==="spine"?`<span class="hsp">${esc(w.title)}</span>${sideIn&&SP==="mid"?sideIn:""}`:ST.hcard==="grid"?`<span class="hcov"><b>${esc(w.title)}</b></span>`:""}
   <span class="hwb"><span class="hwt"><b>${esc(ST.hcard==="spine"?w.long||w.full||w.title:w.title)}</b>${cloudHTML(w)}${ST.hcard!=="row"?"":`<small>${esc(w.full!==w.title?w.full:"")}</small>`}</span>${meta}${paceLine(w)}${L==="row"&&lrn?"":lastH}${lrnB}${progHTML(f,w)}</span></div>${outer}${ab}${ar}${menu}
   ${ex||ST.hexp==="chips"?chapsHTML(w):""}</div>`};
 const sbox=`<div class="hsearch"><span>⌕</span><input type="search" placeholder="搜书名、科判、颂词" value="${esc(HQ)}" aria-label="搜索"></div>`;
 const R=searchAll(HQ);
 let body;
 if(R)body=resultsHTML(R,HQ);
 else if(ST.hsort==="fixed"&&rec.length){body=`<div class="hgroup">最近在读</div><div class="hrecent">${rec.map(o=>`<button class="hrc" data-wopen="${o.w.id}"><b>${esc(o.w.title)}</b><span>${esc(o.l.txt)}</span>${progHTML(wProg(o.w),o.w)}</button>`).join("")}</div><div class="hgroup">全部 ${WORKS.length} 部</div><div class="hlist g-${ST.hcard}">${list.map(card).join("")}</div>`}
 else body=`<div class="hlist g-${ST.hcard}">${list.map(card).join("")}</div>`;
 const TAB=ST.lentry==="tab";
  if(!R){if(ST.lentry==="top")body=todayHTML()+body;else if(ST.lentry==="book")body=todayHTML("strip")+body;else if(TAB&&ST.htab==="today")body=todayHTML("page")}
 const C0=todayCount();
 dev.innerHTML=`<div class="app home"><div class="appbar"><div class="ttl"><span>科判</span><span class="tbs">${ST.hsearch==="icon"?`<button class="tocbtn" data-sopen aria-label="搜索">⌕</button>`:""}<button class="tocbtn dedb ${(()=>{const T=todayRec();return T.n>0&&!T.dedi?"hot":""})()}" data-dedi>回向</button><button class="tocbtn" data-import aria-label="导入一部论">＋</button><button class="tocbtn" data-settings aria-label="设置">⚙</button></span></div></div>
  <div class="hbody2">${(ST.hsearch==="box"||HQ||ST.sOpen)&&!(TAB&&ST.htab==="today")?sbox:""}${body}</div>${TAB?`<div class="htabs"><button data-htab="shelf" aria-pressed="${ST.htab!=="today"}">书架</button><button data-htab="today" aria-pressed="${ST.htab==="today"}">今日${C0.tot?`<em>${C0.tot}</em>`:""}</button></div>`:""}${ABOUT&&WORKS.find(w=>w.id===ABOUT)?aboutHTML(WORKS.find(w=>w.id===ABOUT)):""}${DELC?delHTML():""}${lmAskHTML()}${paceSheetHTML()}${coursePickHTML()}${resetHTML()}<div class="htoast" hidden></div></div>`;
 {const hb=dev.querySelector(".hbody2");if(hb){hb.scrollTop=HTOP;hb.addEventListener("scroll",()=>{HTOP=hb.scrollTop},{passive:true});placeMenu(hb)}
  // 菜单开着时，点别处只关菜单，不打开书
  if(MENU)dev.querySelector(".app.home").addEventListener("click",e=>{if(e.target.closest(".hmenu,[data-menu]"))return;e.stopPropagation();e.preventDefault();MENU=null;rer()},true)}
  {const ib=dev.querySelector("[data-import]");if(ib)ib.onclick=()=>{if(!IMP||IMP.step!==3&&IMP.step!==4)impReset();ST.screen="import";MENU=null;render();bindPanel()}}
 {const sb=dev.querySelector("[data-settings]");if(sb)sb.onclick=()=>{ST.screen="settings";MENU=null;render();bindPanel()}}
 const toast=t=>{const el=dev.querySelector(".htoast");el.textContent=t;el.hidden=false;clearTimeout(el._t);el._t=setTimeout(()=>el.hidden=true,1600)};
 const go=(key,at)=>{const B=BOOKS[key];if(!B)return;if(SR.lm[key]===undefined){LMASK={key,at};MENU=null;rer();return}BK=B;const r=SR.recent[key];ST.screen="reader";ST.openAt=at||(r&&r.id)||null;HQ="";ST.sOpen=false;render()};
 const rer=()=>{const inp=dev.querySelector(".hsearch input");const had=inp&&document.activeElement===inp;const pos=had?inp.selectionStart:0;renderHome();if(had){const i2=dev.querySelector(".hsearch input");i2.focus();i2.setSelectionRange(pos,pos)}};
 dev.querySelectorAll("[data-wopen]").forEach(b=>b.onclick=e=>{if(e.target.closest("[data-about],[data-menu],[data-exp]"))return;go(b.dataset.wopen)});
 dev.querySelectorAll("[data-open]").forEach(b=>b.onclick=e=>{e.stopPropagation();go(b.dataset.open,b.dataset.at)});
 dev.querySelectorAll("[data-na]").forEach(b=>b.onclick=()=>toast("这一品还没有导入"));
 dev.querySelectorAll("[data-exp]").forEach(b=>b.onclick=e=>{e.stopPropagation();HEXPD=HEXPD===b.dataset.exp?null:b.dataset.exp;rer()});
 dev.querySelectorAll("[data-exp2]").forEach(b=>b.onclick=e=>{e.stopPropagation();MENU=null;ST.hexp="arrow";HEXPD=b.dataset.exp2;rer();bindPanel()});
 {const db=dev.querySelector("[data-dedi]");if(db)db.onclick=()=>{const T=todayRec();T.dedi=true;save();db.classList.remove("hot");showDedi()}}
 dev.querySelectorAll("[data-about]").forEach(b=>b.onclick=e=>{e.stopPropagation();MENU=null;ABOUT=b.dataset.about;rer()});
 dev.querySelectorAll("[data-menu]").forEach(b=>b.onclick=e=>{e.stopPropagation();MENU=MENU===b.dataset.menu?null:b.dataset.menu;rer()});
 dev.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>{ABOUT=null;rer()});
 const fb=dev.querySelector("[data-fb]");if(fb)fb.onclick=()=>toast("会打开整理者留的反馈方式");
 const so=dev.querySelector("[data-sopen]");if(so)so.onclick=()=>{ST.sOpen=!ST.sOpen;rer();const i=dev.querySelector(".hsearch input");if(i)i.focus()};
 const inp=dev.querySelector(".hsearch input");if(inp)inp.oninput=()=>{HQ=inp.value;HTOP=0;const hb=dev.querySelector(".hbody2");if(hb)hb.scrollTop=0;rer()};
 dev.querySelectorAll("[data-more]").forEach(b=>b.onclick=e=>{e.stopPropagation();const B=BOOKS[b.dataset.more];if(B){BK=B;startExtra(extraQueue(B))}});
 dev.querySelectorAll("[data-grev]").forEach(b=>b.onclick=e=>{e.stopPropagation();const B=BOOKS[b.dataset.grev];if(B){BK=B;startExtra(freeQueue(B),{free:true})}});
 dev.querySelectorAll("[data-learn]").forEach(b=>b.onclick=e=>{e.stopPropagation();const B=BOOKS[b.dataset.learn]||BK;if(!B)return;BK=B;if(!SR.paceAsked){PACESH=B.id;PRESTART=true;MENU=null;rer();return}startSession({B})});
 dev.querySelectorAll("[data-dl]").forEach(b=>b.onclick=e=>{e.stopPropagation();const id=b.dataset.dl;DL[id]="ing";rer();requestAnimationFrame(()=>requestAnimationFrame(()=>{const a=dev.querySelector(`.hw[data-w="${id}"] .hcloud .arc`);if(a){a.style.transition="stroke-dashoffset 1.6s linear";a.style.strokeDashoffset="0"}}));setTimeout(()=>{DL[id]="ok";rer();toast("已下载到本机")},1750)});
 dev.querySelectorAll("[data-course]").forEach(b=>b.onclick=e=>{e.stopPropagation();MENU=null;COURSEP=b.dataset.course||(PACESH&&PACESH!==true?PACESH:BK&&BK.id);PACESH=false;rer()});
 dev.querySelectorAll("[data-addshy]").forEach(b=>b.onclick=e=>{e.stopPropagation();if(IMP&&IMP.step===2){toastNow("还有一个转换在进行");return}impReset();IMP.mode="add";IMP.book=b.dataset.addshy;ST.screen="import";MENU=null;render();bindPanel()});
 dev.querySelectorAll("[data-pacesh]").forEach(b=>b.onclick=e=>{e.stopPropagation();MENU=null;PACESH=b.dataset.pacesh;PRESTART=false;rer()});
 dev.querySelectorAll("[data-pace]").forEach(b=>b.onclick=e=>{e.stopPropagation();ST.pace=b.dataset.pace;rer();bindPanel()});
 dev.querySelectorAll("[data-qd]").forEach(b=>b.onclick=e=>{e.stopPropagation();ST.qpw=Math.max(1,Math.min(30,+ST.qpw+ +b.dataset.qd));rer()});
 dev.querySelectorAll("[data-reset]").forEach(b=>b.onclick=e=>{e.stopPropagation();MENU=null;RESETC=b.dataset.reset;rer()});
 dev.querySelectorAll("[data-bdel]").forEach(b=>b.onclick=e=>{e.stopPropagation();MENU=null;DELC=b.dataset.bdel;rer()});
 dev.querySelectorAll("[data-delno]").forEach(b=>b.onclick=e=>{if(e.target!==b&&!e.target.closest("button[data-delno]"))return;e.stopPropagation();DELC=null;rer()});
 dev.querySelectorAll("[data-delyes]").forEach(b=>b.onclick=async e=>{e.stopPropagation();const id=DELC;DELC=null;await removeBook(id);rer();toast("已从书架删除")});
 dev.querySelectorAll("[data-lmx]").forEach(b=>b.onclick=e=>{if(e.target!==b)return;e.stopPropagation();LMASK=null;rer()});
 dev.querySelectorAll("[data-lmset]").forEach(b=>b.onclick=e=>{e.stopPropagation();const a=LMASK;LMASK=null;if(!a)return;SR.lm[a.key]=b.dataset.lmset;save();go(a.key,a.at)});
 dev.querySelectorAll("[data-lmsw]").forEach(b=>b.onclick=e=>{e.stopPropagation();const k=b.dataset.lmsw;SR.lm[k]=SR.lm[k]==="on"?"off":"on";save();rer()});
 dev.querySelectorAll("[data-rsno]").forEach(b=>b.onclick=e=>{if(e.target!==b&&!e.target.closest("button[data-rsno]"))return;e.stopPropagation();RESETC=false;rer()});
 dev.querySelectorAll("[data-rsyes]").forEach(b=>b.onclick=e=>{e.stopPropagation();resetBook(RESETC);RESETC=false;rer();toast("已重置，从第一颂重新开始")});
 dev.querySelectorAll("[data-pdone]").forEach(b=>b.onclick=e=>{e.stopPropagation();const pb=BOOKS[PACESH]||BK;PACESH=false;if(PRESTART){PRESTART=false;SR.paceAsked=true;startSession({B:pb});return}rer();toast(!lmOn(pb)?"学习模式已关闭":ST.pace==="course"?"跟课程":`每周定量 ${ST.qpw} 颂`)});
 dev.querySelectorAll("[data-cpick]").forEach(b=>b.onclick=e=>{e.stopPropagation();const i=b.dataset.cpick.indexOf(":");SR.course[b.dataset.cpick.slice(0,i)]=b.dataset.cpick.slice(i+1);COURSEP=false;rer()});
 dev.querySelectorAll("[data-cpclose]").forEach(b=>b.onclick=e=>{if(e.target!==b&&!e.target.closest("button[data-cpclose]"))return;e.stopPropagation();COURSEP=false;PACESH=false;PRESTART=false;rer()});
 dev.querySelectorAll("[data-daily]").forEach(b=>b.onclick=()=>{if(dailyToday()){toast("今天的每日一颂做过了，明天再来");return}const d=pickDaily();if(!d){toast("先背几颂，每日一颂只从学过的颂里出题");return}startSession({daily:d,B:d.B})});
 dev.querySelectorAll("[data-tree]").forEach(b=>b.onclick=()=>{ST.view="map";ST.tocOpen=!wide();mmReset(null);go((BK||{}).id)});
 dev.querySelectorAll("[data-tt]").forEach(b=>b.onclick=()=>{const i=b.dataset.tt.indexOf(":");go(b.dataset.tt.slice(0,i),b.dataset.tt.slice(i+1))});
 dev.querySelectorAll("[data-htab]").forEach(b=>b.onclick=()=>{ST.htab=b.dataset.htab;rer()});
}

// ===== 导入一部论：选文件 → 在本机转换（web/convert，Pyodide）→ 核对科判和讲记的差异 → 书名 → 加入书架 =====
let IMP=null,CONV=null;
const IMPCHK=["疑似错字","用字不同","科名不同"];
function impReset(){IMP={step:1,pdf:null,epub:null,p:0,stage:0,err:"",diffs:[],hints:[],auto:[],flt:"all",long:"",short:"",autoOpen:false,hintOpen:false,run:0,mode:"new",book:null,sname:""}}
function impDiffStr(x,y){if(x.length!==y.length)return esc(x);return [...x].map((c,i)=>c===[...y][i]?esc(c):`<mark>${esc(c)}</mark>`).join("")}
function hashId(s){let h=0x811c9dc5;for(const ch of String(s)){h^=ch.codePointAt(0);h=Math.imul(h,0x01000193)>>>0}return "b"+h.toString(36)}
function converter(){if(!CONV)CONV=window.createConverter({onLog:s=>{if(!IMP||IMP.step!==2)return;if(/就绪/.test(s)){IMP.stage=Math.max(IMP.stage,1);IMP.p=Math.max(IMP.p,30)}impTick()}});return CONV}
let impTickT=0;function impTick(){if(impTickT)return;impTickT=requestAnimationFrame(()=>{impTickT=0;if(ST.screen==="import"&&IMP&&IMP.step===2)renderImport()})}
function flatRaw(t){const o=[];(function w(a,ch){a.forEach(n=>{const c=n.chapter||ch;o.push({n,ch:c});w(n.children||[],c)})})(t.tree||[],null);return o}
// 转换结果 → 界面上的核对清单
function impLoad(I,tree,res){I.tree=tree;I.res=res||null;const F=flatRaw(tree);const byId={},byRaw={};F.forEach(x=>{byId[x.n.id]=x;if(!byRaw[x.n.raw])byRaw[x.n.raw]=x});
 const code=n=>n.level?n.level+CNUM(n.num):"";
 I.diffs=(res&&res.suggestions||[]).filter(s=>IMPCHK.includes(s.kind)).map(s=>{const x=(s.fix&&s.fix.id&&byId[s.fix.id])||byRaw[s.raw]||{n:{name:s.raw},ch:""};
  return {code:code(x.n),name:x.n.name||s.raw,ch:x.ch||"",kind:s.kind,g:s.kind==="科名不同"?"n":"v",a:s.kepan||"",b:s.jiangji||"",fix:s.fix,pick:"b"}});
 const rep=res&&res.data&&res.data.report||{};I.hints=[];
 (rep.verseDiffs||[]).forEach(v=>(v.diffs||[]).forEach(d=>{if(IMPCHK.includes(d.kind))return;I.hints.push(`${v.raw}：${d.kind}「${(d.kepan||d.jiangji||"").slice(0,24)}」`)}));
 (rep.missing||[]).forEach(m=>I.hints.push(`讲记里没找到：${m.raw||m.heading||""}`));(rep.extra||[]).forEach(m=>I.hints.push(`讲记多出的标题：${m.heading||m.raw||""}`));
 I.auto=(tree.warnings||[]).map(String);
 const m=tree.meta||{};const id=impBookId(tree);const ex=BOOKS[id];
 I.id=id;I.prevFixes=ex&&ex.info&&ex.info.fixes||[];I.long=I.long||(ex?ex.meta.name||"":m.name||"");I.short=I.short||(ex?ex.title:(m.title||"").split(/\s+/)[0].slice(0,5))}
// 书的代号：同一部论（科判标题相同）重新导入时沿用原来的，进度不丢
function impBookId(tree){const t=(tree.meta||{}).title||"";const b=Object.values(BOOKS).find(B=>(B.meta.title||"")===t&&t);return b?b.id:hashId(t||Date.now())}
async function impRun(){const I=IMP;const my=++I.run;I.step=2;I.p=0;I.stage=0;I.err="";renderImport();
 if(I.mode==="add")return impRunAdd(my);
 try{const conv=converter();if(!navigator.onLine)I.note="现在没有网络：第一次转换要先下载转换程序，下载过一次之后离线也能用。";
  const prev=Object.values(BOOKS).find(B=>B.info&&B.info.pdfName===I.pdf.name);
  const tree=await conv.kepanFromPdf(I.pdf,{id:"book",fixes:prev&&prev.info.fixes||[],onProgress:(i,n)=>{if(I.run!==my)return;I.stage=1;I.p=30+Math.round(i/Math.max(1,n)*50);impTick()}});
  if(I.run!==my)return;tree.id=impBookId(tree);I.p=80;I.stage=2;impTick();
  let res=null;if(I.epub){res=await conv.shiyiFromEpub(I.epub,tree);if(I.run!==my)return}
  impLoad(I,tree,res);I.p=100;I.step=3;
  if(ST.screen==="import")renderImport();else toastNow(`《${I.short||"新书"}》转好了，点右上 ＋ 核对`)}
 catch(e){if(I.run!==my)return;I.err=String(e&&e.message||e);I.step=1;if(ST.screen==="import")renderImport();else toastNow("转换没有成功："+I.err)}}
// 给书架上已有的书加讲记：只跑释义转换，科判沿用这本书现有的
async function bookSrc(id){const b=await idbGet("book:"+id).catch(()=>null);if(b)return b;const B=BUILTIN[id];return B?{info:B.info,tree:B.tree}:null}
async function impRunAdd(my){const I=IMP;
 try{const had=!!CONV;const conv=converter();if(had){I.stage=1;I.p=40;impTick()}
  const src=await bookSrc(I.book);if(!src)throw new Error("找不到这本书的科判");
  const tree=JSON.parse(JSON.stringify(src.tree));tree.id=I.book;
  const res=await conv.shiyiFromEpub(I.epub,tree);if(I.run!==my)return;
  impLoad(I,tree,res);I.diffs.forEach(d=>d.pick="a");I.id=I.book;I.prevFixes=src.info&&src.info.fixes||[];I.srcInfo=src.info||{id:I.book};
  const ep=res&&res.data&&res.data.source&&res.data.source.epub&&res.data.source.epub.title||I.epub.name.replace(/\.epub$/i,"");
  if(!I.sname)I.sname="《"+ep.replace(/^译作\s*\d+\s*/,"").replace(/[-_ ]?epub$/i,"").trim()+"》";
  I.p=100;I.step=3;if(ST.screen==="import")renderImport();else toastNow("讲记转好了，点右上 ＋ 核对")}
 catch(e){if(I.run!==my)return;I.err=String(e&&e.message||e);I.step=1;if(ST.screen==="import")renderImport();else toastNow("转换没有成功："+I.err)}}
async function impAddFinish(){const I=IMP;const picked=I.diffs.filter(d=>d.pick==="b").map(d=>d.fix),kept=I.diffs.filter(d=>d.pick!=="b").map(d=>({...d.fix,skip:true}));
 let tree=I.tree,data=I.res&&I.res.data||null;I.saving=true;renderImport();
 if(picked.length){const r=await converter().applyFixes(tree,picked);tree=r.tree;if(r.data)data=r.data}
 if(!data)throw new Error("讲记里没有读到释义");tree.id=I.book;
 const fixes=[...I.prevFixes.filter(f=>!picked.concat(kept).some(x=>x.match===f.match&&JSON.stringify(x.verse||x.replace)===JSON.stringify(f.verse||f.replace))),...picked,...kept];
 const info=Object.assign({},I.srcInfo,{id:I.book,fixes,hasShiyi:true,shiyiName:I.sname.trim(),epubName:I.epub.name,added:I.srcInfo.added||Date.now()});
 const had=BOOKS[I.book]&&WORKS.find(w=>w.id===I.book)&&WORKS.find(w=>w.id===I.book).shiyi;
 await idbSet("book:"+I.book,{info,tree});await idbSet("shiyi:"+I.book,data);
 installBook(info,tree,data);const t=BOOKS[I.book].title;IMP=null;ST.screen="home";render();toastNow("《"+t+"》"+(had?"已换成新的讲记":"已加上讲记"))}
async function impFinish(){const I=IMP;const picked=I.diffs.filter(d=>d.pick==="b").map(d=>d.fix),kept=I.diffs.filter(d=>d.pick!=="b").map(d=>({...d.fix,skip:true}));
 let tree=I.tree,data=I.res&&I.res.data||null;
 if(picked.length){I.saving=true;renderImport();const r=await converter().applyFixes(tree,picked);tree=r.tree;if(r.data)data=r.data}
 tree.id=I.id;tree.meta=Object.assign({},tree.meta,{name:I.long.trim(),shortName:I.short.trim()});
 const fixes=[...I.prevFixes.filter(f=>!picked.concat(kept).some(x=>x.match===f.match&&JSON.stringify(x.verse||x.replace)===JSON.stringify(f.verse||f.replace))),...picked,...kept];
 const ex=BOOKS[I.id];const info={id:I.id,meta:{name:I.long.trim(),shortName:I.short.trim()},fixes,pdfName:I.pdf?I.pdf.name:"",epubName:I.epub?I.epub.name:"",added:Date.now()};
 if(!data&&ex&&ex.info&&ex.info.hasShiyi)data=await idbGet("shiyi:"+I.id);
 info.hasShiyi=!!data;
 await idbSet("book:"+I.id,{info,tree});if(data)await idbSet("shiyi:"+I.id,data);
 installBook(info,tree,data);BK=BOOKS[I.id];
 const msg=ex?"已更新《"+I.short.trim()+"》":"《"+I.short.trim()+"》已加入书架";IMP=null;ST.screen="home";render();toastNow(msg)}
function impSaveFixes(){const I=IMP;const fixes=[...I.diffs.filter(d=>d.pick==="b").map(d=>d.fix),...I.diffs.filter(d=>d.pick!=="b").map(d=>({...d.fix,skip:true}))];
 downloadFile((I.short||"本书")+"-勘误.json",JSON.stringify(fixes,null,1),"application/json");toastNow("已保存 "+(I.short||"本书")+"-勘误.json")}
function renderImport(){if(!IMP)impReset();const I=IMP;const hasE=!!I.epub;const add=I.mode==="add",BKW=add?WORKS.find(w=>w.id===I.book):null;
 const steps=add?["选书和讲记","转换","核对","讲记名"]:["选文件","转换","核对","书名"];
 const bar=`<div class="imst">${steps.map((t,i)=>`<span class="${I.step===i+1?"on":I.step>i+1?"dn":""}"><i>${I.step>i+1?"✓":i+1}</i>${t}</span>`).join("<u></u>")}</div>`;
 let body="",foot="";
 if(I.step===1){
  const card=(k,ti,sub,need,acc)=>`<label class="imf ${I[k]?"has":""}"><input type="file" accept="${acc}" data-impf="${k}" hidden><span class="imfi">${k==="pdf"?"科":"讲"}</span><span class="imfb"><b>${ti}<em>${need}</em></b><small>${I[k]?esc(I[k].name):sub}</small></span><span class="imfx">${I[k]?"换一个":"选择"}</span></label>`;
  const modes=`<div class="imflt immode">${[["new","导入新的一部论"],["add","给已有的书加讲记"]].map(([v,t])=>`<button data-impmode="${v}" aria-pressed="${I.mode===v}">${t}</button>`).join("")}</div>`;
  if(add){body=`${modes}<div class="sh">加到哪本书</div><div class="sc">${WORKS.map(w=>`<button class="sr impbk" data-impbk="${w.id}" aria-pressed="${I.book===w.id}"><i class="imrd"></i><span class="imfb"><b>${esc(w.long||w.full||w.title)}</b><small>${w.shiyi?"已有讲记 "+esc(w.shiyi):"还没有讲记"}</small></span></button>`).join("")}</div>
   <div class="sh">讲记文件</div>${card("epub","讲记 epub","按科名把释义挂到这本书的科判上，并校对颂词","必选",".epub,application/epub+zip")}
   ${I.err?`<p class="snote imerr">转换没有成功：${esc(I.err)}</p>`:""}
   ${BKW&&BKW.shiyi?`<p class="snote imwarn">这本书已经有讲记，加入后会换成新的这一份。学习进度不受影响。</p>`:""}
   <p class="snote">转换在这台设备上完成，文件不会上传。讲记要和这本书的科判是同一部论，科名对不上的段落会列出来给你看。</p>`;
   foot=`<button class="impri" data-impgo ${I.book&&I.epub?"":"disabled"}>开始转换</button>`}
  else{body=`${modes}<div class="sh">要导入的文件</div>${card("pdf","科判 PDF","Word 导出的表格式科判","必选",".pdf,application/pdf")}${card("epub","讲记 epub","有讲记才能点颂词看释义，也才能自动校对颂词","可选",".epub,application/epub+zip")}
   ${I.err?`<p class="snote imerr">转换没有成功：${esc(I.err)}</p>`:""}
   <p class="snote">转换在这台设备上完成，文件不会上传。第一次转换要下载约 18MB 的转换程序，之后离线也能用。加密的 PDF 转不了，请先另存一份不加密的。</p>`;
  foot=`<button class="impri" data-impgo ${I.pdf?"":"disabled"}>开始转换</button>`}}
 else if(I.step===2){const p=I.p;const pages=I.pages||0;const st=[["准备转换程序","第一次要下载约 18MB，之后离线也能用",0,30],["读科判",pages?`第 ${Math.max(1,Math.round((p-30)/50*pages))} / ${pages} 页`:"逐页读表格",30,80],...(hasE?[["挂上释义并比对","逐科对照讲记里的科名和颂词",80,100]]:[])];if(add)st.splice(1,2,["挂上释义并比对","逐科对照这本书的科判和讲记里的科名、颂词",30,100]);
  body=`<div class="sh">正在转换</div><div class="sc">${st.map(([t,sub,a,b],si)=>{const on=I.stage===si,dn=I.stage>si;return `<div class="sr imrow ${on?"on":dn?"dn":""}"><span class="imdot">${dn?"✓":on?'<i class="imspin"></i>':""}</span><span class="imfb"><b>${t}</b><small>${dn?"完成":on?sub:"等待中"}</small>${on?(si===0||si===2||add?`<span class="imbar ind"><i></i></span>`:`<span class="imbar"><i style="width:${Math.max(0,Math.min(100,Math.round((p-a)/(b-a)*100)))}%"></i></span>`):""}</span></div>`}).join("")}</div>
   <p class="snote">可以先离开这一页，转好了会提醒你。${esc(add?(I.epub?I.epub.name:""):I.pdf?I.pdf.name:"")}</p>${I.note?`<p class="snote">${esc(I.note)}</p>`:""}`;
  foot=`<button class="imsec" data-impcancel>取消</button>`}
 else if(I.step===3){const t=I.tree,S={nodes:t.stats&&t.stats.nodes||0,stanzas:t.stats&&t.stats.stanzas||0,sections:I.res&&I.res.data&&I.res.data.stats.sections||0};const ds=I.diffs;const cnt=g=>ds.filter(d=>d.g===g).length;const list=ds.map((d,i)=>({d,i})).filter(x=>I.flt==="all"||x.d.g===I.flt);
  const nb=ds.filter(d=>d.pick==="b").length;
  body=`<div class="imnums"><span><b>${S.nodes}</b>条科判</span><span><b>${S.stanzas}</b>颂</span>${hasE?`<span><b>${S.sections}</b>段释义</span>`:""}</div>
   ${hasE?(ds.length?`<div class="sh">科判和讲记不一致的 ${ds.length} 处</div>
   <div class="imflt">${[["all","全部 "+ds.length],["v","颂词 "+cnt("v")],["n","科名 "+cnt("n")]].map(([v,t])=>`<button data-impflt="${v}" aria-pressed="${I.flt===v}">${t}</button>`).join("")}</div>
   <div class="imbulk"><span>已选：用讲记 ${nb} 处，保持科判 ${ds.length-nb} 处</span><button data-impall="b">全用讲记</button><button data-impall="a">全保持科判</button></div>
   <div class="imdl">${list.map(({d,i})=>`<div class="imd"><div class="imdh">${d.ch?`<small>${esc(d.ch)}</small>`:""}<b>${esc(d.code)} ${esc(d.name)}</b><em class="k-${d.g}">${d.kind}</em></div>
     <div class="imdc"><button data-imppick="${i}:a" aria-pressed="${d.pick==="a"}"><small>科判</small><span>${impDiffStr(d.a,d.b)}</span></button><button data-imppick="${i}:b" aria-pressed="${d.pick==="b"}"><small>讲记</small><span>${impDiffStr(d.b,d.a)}</span></button></div></div>`).join("")}</div>`:`<div class="sh">科判和讲记</div><p class="snote">科名和颂词逐条比对过，没有要你决定的不一致。</p>`):`<p class="snote">这次没有选讲记，所以没有可比对的内容。以后可以在这本书的 ⋯ 里点“加讲记”。</p>`}
   ${hasE&&I.hints.length?`<div class="sc imauto"><div class="sr go ${I.hintOpen?"open":""}" data-imphint><b>只作提示、保持科判的 ${I.hints.length} 处</b></div>${I.hintOpen?I.hints.map(x=>`<div class="sr"><span class="imaw">${esc(x)}</span></div>`).join(""):""}</div>`:""}
   ${I.auto.length?`<div class="sc imauto"><div class="sr go ${I.autoOpen?"open":""}" data-impauto><b>程序自动处理的 ${I.auto.length} 处版式问题</b></div>${I.autoOpen?I.auto.map(x=>`<div class="sr"><span class="imaw">${esc(x)}</span></div>`).join(""):""}</div>`:""}
   ${add&&ds.length?`<p class="snote">这本书的科判已经校对过，所以默认保持科判；确认讲记对的地方再点“讲记”。</p>`:""}${ds.length?`<p class="snote">你的选择会存成这本书的勘误，下次导入新一稿时自动套用。</p>`:""}`;
  foot=`<button class="imsec" data-impback>重新选文件</button><button class="impri" data-impnext>下一步</button>`}
 else if(add){const nb=I.diffs.filter(d=>d.pick==="b").length;const ns=I.res&&I.res.data&&I.res.data.stats&&I.res.data.stats.sections||0;
  body=`<div class="sh">讲记名称</div><div class="sc"><div class="sr col"><b>名称 <small class="sv">显示在“关于这部论”里</small></b><input class="imin" data-impsn value="${esc(I.sname)}" placeholder="比如：《入行论广释·善说海》"></div></div>
   <div class="sh">这次加入的内容</div><div class="sc"><div class="sr"><b>加到</b><span class="sv">${esc(BKW?BKW.long||BKW.full||BKW.title:"")}</span></div><div class="sr"><b>释义</b><span class="sv">${ns} 段</span></div><div class="sr"><b>不一致处</b><span class="sv">用讲记 ${nb} 处，保持科判 ${I.diffs.length-nb} 处</span></div></div>
   <p class="snote">加好后，在这本书里点颂词就能看释义。</p>${I.diffs.length?`<button class="imdemo" data-impsave>另存一份勘误文件</button>`:""}`;
  foot=`<button class="imsec" data-impback3>上一步</button><button class="impri" data-impadd ${I.sname.trim()&&!I.saving?"":"disabled"}>${I.saving?"正在保存…":"加到这本书"}</button>`}
 else{const sp=(I.short||"").slice(0,5);const m=I.tree.meta||{};const roles=(m.roles||[]).map(r=>[r.name,r.role]);
  body=`<div class="sh">书名</div><div class="sc"><div class="sr col"><b>全称</b><input class="imin" data-impin="long" value="${esc(I.long)}" placeholder="比如：入菩萨行论"></div><div class="sr col"><b>书背简称 <small class="sv">最多 5 个字</small></b><input class="imin" data-impin="short" maxlength="5" value="${esc(I.short)}" placeholder="比如：入行论"></div></div>
   <div class="sh">书架上的样子</div><div class="impv"><span class="hsp">${esc(sp||"简称")}</span><span class="imfb"><b>${esc(I.long||"全称")}</b><small>${esc(roles.map(r=>r[0]).join(" · "))}</small></span></div>
   <div class="sh">从科判里读到的信息</div><div class="sc">${roles.map(r=>`<div class="sr"><b>${esc(r[1])}</b><span class="sv">${esc(r[0])}</span></div>`).join("")}<div class="sr"><b>版本</b><span class="sv">${esc([m.edition,fmtDate(m.date)].filter(Boolean).join(" · ")||"—")}</span></div></div>
   ${I.diffs.length?`<button class="imdemo" data-impsave>另存一份勘误文件</button>`:""}${BOOKS[I.id]?`<p class="snote">书架上已有这部论，加入后会换成这一稿，背诵记录保留。</p>`:""}`;
  foot=`<button class="imsec" data-impback3>上一步</button><button class="impri" data-impdone ${I.long.trim()&&I.short.trim()&&!I.saving?"":"disabled"}>${I.saving?"正在保存…":"加入书架"}</button>`}
 dev.innerHTML=`<div class="app settings imp"><div class="appbar"><div class="ttl rb"><span class="tl1"><button class="bk" data-impx aria-label="返回">‹</button><span>${add?"加讲记":"导入一部论"}</span></span><span></span></div>${bar}</div><div class="sbody"><div class="sin">${body}</div></div><div class="imfoot"><div class="sin2">${foot}</div></div><div class="htoast" hidden></div></div>`;
 const keep=fn=>{const y=dev.querySelector(".sbody").scrollTop;fn();if(ST.screen==="import"){renderImport();dev.querySelector(".sbody").scrollTop=y}};
 const q=(sel,fn)=>dev.querySelectorAll(sel).forEach(b=>b.onclick=e=>fn(b,e));
 dev.querySelector("[data-impx]").onclick=()=>{ST.screen="home";render()};
 dev.querySelectorAll("[data-impf]").forEach(i=>i.onchange=()=>{if(i.files[0])keep(()=>{I[i.dataset.impf]=i.files[0];I.err=""})});
 q("[data-impgo]",()=>{if(!window.createConverter){I.err="转换程序还没加载好，请联网后再试一次";renderImport();return}impRun()});
 q("[data-impcancel]",()=>{I.run++;I.step=1;renderImport()});
 q("[data-impflt]",b=>keep(()=>{I.flt=b.dataset.impflt}));q("[data-impall]",b=>keep(()=>{I.diffs.forEach(d=>d.pick=b.dataset.impall)}));
 q("[data-imppick]",b=>keep(()=>{const [i,v]=b.dataset.imppick.split(":");I.diffs[+i].pick=v}));
 q("[data-impauto]",()=>keep(()=>{I.autoOpen=!I.autoOpen}));q("[data-imphint]",()=>keep(()=>{I.hintOpen=!I.hintOpen}));
 q("[data-impback]",()=>{I.step=1;renderImport()});q("[data-impnext]",()=>{I.step=4;renderImport()});q("[data-impback3]",()=>{I.step=3;renderImport()});
 dev.querySelectorAll("[data-impin]").forEach(i=>i.oninput=()=>{I[i.dataset.impin]=i.value;const pv=dev.querySelector(".impv");pv.querySelector(".hsp").textContent=(I.short||"简称").slice(0,5);pv.querySelector("b").textContent=I.long||"全称";dev.querySelector("[data-impdone]").disabled=!(I.long.trim()&&I.short.trim())});
 q("[data-impsave]",impSaveFixes);
 q("[data-impmode]",b=>keep(()=>{I.mode=b.dataset.impmode;I.err=""}));q("[data-impbk]",b=>keep(()=>{I.book=b.dataset.impbk}));
 {const i=dev.querySelector("[data-impsn]");if(i)i.oninput=()=>{I.sname=i.value;dev.querySelector("[data-impadd]").disabled=!I.sname.trim()}}
 q("[data-impadd]",()=>{impAddFinish().catch(e=>{I.saving=false;renderImport();toastNow("保存没有成功："+(e&&e.message||e))})});
 q("[data-impdone]",()=>{impFinish().catch(e=>{I.saving=false;renderImport();toastNow("保存没有成功："+(e&&e.message||e))})});
}
const DEDI=[["བསོད་ནམས་འདི་ཡིས་ཐམས་ཅད་གཟིགས་པ་ཉིད། །","索南德益檀嘉热巴涅","此福已得一切智"],["ཐོབ་ནས་ཉེས་པའི་དགྲ་རྣམས་ཕམ་བྱས་ཏེ། །","托内尼波扎南攀旭得","催伏一切过患敌"],["སྐྱེ་རྒ་ན་འཆིའི་རྦ་ཀློང་འཁྲུགས་པ་ཡི། །","杰嘎那齐瓦隆彻巴耶","生老病死犹波涛"],["སྲིད་པའི་མཚོ་ལས་འགྲོ་བ་སྒྲོལ་བར་ཤོག །","哲波措类卓瓦卓瓦秀","愿度有海诸有情"]];
const DEDIM=["ཨོཾ་ཨཱཿཧཱུྃ་བཛྲ་གུ་རུ་པདྨ་སིདྡྷི་ཧཱུྃ༔","嗡啊吽班匝儿格热巴玛色德吽"];
function showDedi(){const old=dev.querySelector(".dedi");if(old)old.remove();const el=document.createElement("div");el.className="dedi";
 el.innerHTML=`<div class="dedc" role="dialog" aria-label="回向"><span class="dedl">${pillLampAt(0,54)}</span><b class="dedh">回向</b>${DEDI.map(l=>`<p><span class="bo" lang="bo">${l[0]}</span><small>${l[1]}</small><span class="zh">${l[2]}</span></p>`).join("")}<p class="dedm"><span class="bo" lang="bo">${DEDIM[0]}</span><small>${DEDIM[1]}</small></p><em class="dedt">回向完点击</em></div>`;
 dev.appendChild(el);el.setAttribute("role","button");el.onclick=()=>{el.classList.add("out");setTimeout(()=>el.remove(),700)}}
function fireWrap(L){const i=L.lastIndexOf("<ellipse");if(i<0||L.indexOf("flHalo",i)<0)return L;let j=L.indexOf("<path",i);if(j<0)return L;let L0=L.slice(0,i).replace("<g transform=",'<g class="ofbw" transform=');{const a=L0.indexOf('<g class="ofbw"'),b=L0.indexOf("</g></g>",a);if(a>=0&&b>0){const bowl=L0.slice(a,b+8);L0=L0.slice(0,b+8)+bowl.replace('class="ofbw"','class="ofdk"').replace(/ style="filter:[^"]*"/,"")+L0.slice(b+8)}}
 return L0+'<g class="ofire">'+L.slice(i,j).replace("<ellipse",'<ellipse class="fh"')+'<g class="ofsw">'+L.slice(j).replace("</svg>","</g></g></svg>")}
function offerHTML(W0,H){const W=W0*ST.ofw/100,R=+ST.ofr,N=Math.max(1,Math.round(+ST.ofn*Math.max(1,W0/390)*ST.ofw/100)),Z=+ST.ofz,rad=ST.ofa*Math.PI/180,sn=Math.sin(rad),cs=Math.cos(rad);
 const TH=H*ST.ofh/100,apron=Math.round(10+TH*.32*cs),Dp=Math.max(8,((TH-apron)*sn+8)*ST.ofd/100),back=1-.5*cs,narrow=.34*cs;
 let lamps="";
 for(let r=R-1;r>=0;r--){const t=R>1?r/(R-1):0,sc=1-(1-back)*t,z=Math.max(10,Math.round(Z*sc));const n=ST.ofs==="on"&&r%2?Math.max(1,N-1):N;
  const w=W*(1-narrow*t),gap=w/N,y=apron+4+t*Math.max(0,Dp-z*.5-8);
  for(let k=0;k<n;k++){const x=W/2+(k-(n-1)/2)*gap;const h=((k*37+r*53)%19)/19,h2=((k*61+r*29)%23)/23,cx=n>1?Math.abs(k-(n-1)/2)/((n-1)/2):0;const fr=ST.ofo==="rand"?h:ST.ofo==="front"?t*.85+h*.15:ST.ofo==="fan"?Math.min(1,Math.hypot(cx/(ST.ofvx/100),(t-.5)*2/(ST.ofvy/100))/(Math.hypot(100/ST.ofvx,100/ST.ofvy)*.92))*.92+h2*.08:ST.ofo==="mid"?cx*.85+h2*.15:(n>1?k/(n-1):0)*.9+h2*.1;
   const du=(1.5+h2*1.3)/(ST.ofsv/100);lamps+=`<span class="ofl" style="left:${(x-z/2).toFixed(1)}px;bottom:${y.toFixed(1)}px;z-index:${R-r};--d:${(fr*ST.ofit).toFixed(2)}s;--du:${du.toFixed(2)}s;--ph:${(-h*du*2).toFixed(2)}s">${fireWrap(pillLampAt(0,z))}</span>`}}
 const tw=(narrow*50).toFixed(1);
 return `<span class="oft c-${ST.ofc}" style="height:${(apron+Dp+Z*1.3).toFixed(0)}px;width:${W.toFixed(0)}px;left:${((W0-W)/2).toFixed(0)}px;right:auto;--og:${ST.ofg/100};--sa:${(ST.ofsa*.09).toFixed(2)};--sl:${(ST.ofsl/100).toFixed(2)};--it:${ST.ofit}s;--bd:${ST.ofbd/100};--bs:${ST.ofbs/100};--bt:${ST.ofbt}s;--td:${ST.oftd/100};--gdu:${(3.3/(ST.ofsv/100)).toFixed(2)}s"><i class="ofgw"><i class="ofglow" style="left:${(-(W0-W)/2-W0*.1).toFixed(0)}px;right:${(-(W0-W)/2-W0*.1).toFixed(0)}px"></i></i><i class="ofsurf" style="bottom:${apron}px;height:${Dp.toFixed(0)}px;clip-path:polygon(${tw}% 0,${(100-tw)}% 0,100% 100%,0 100%)"></i><i class="ofapr" style="height:${apron}px"></i>${lamps}</span>`}
function a2Due(){const s=a2State();return !s.off&&(!s.next||Date.now()>=s.next)}
function showA2hs(force){const k=a2Kind();const old=dev.querySelector(".a2h");if(old)old.remove();if(!k)return;if(!force&&!a2Due())return;const el=document.createElement("div");el.className="a2h";
 const SH='<svg width="22" height="26" viewBox="0 0 22 26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 16V2.5M6.5 6.5 11 2l4.5 4.5M6 10H4.5A2.5 2.5 0 0 0 2 12.500v9A2.5 2.5 0 0 0 4.5 24h13a2.5 2.5 0 0 0 2.500-2.500v-9A2.5 2.5 0 0 0 17.500 10H16"/></svg>',PL='<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="2" y="2" width="18" height="18" rx="4.5"/><path d="M11 6.500v9M6.500 11h9"/></svg>';
 const body=k==="ios"?`<ol class="a2s"><li><i>1</i><span>点屏幕底部的<b>分享</b>按钮</span>${SH}</li><li><i>2</i><span>往下找到<b>添加到主屏幕</b></span>${PL}</li><li><i>3</i><span>点右上角的<b>添加</b></span></li></ol><p class="a2n">要用 Safari 打开才有这一项。如果是在微信等 App 里打开的，请先点右上角「在 Safari 中打开」。</p>`
  :k==="prompt"?"":`<p class="a2n">在浏览器的菜单（⋮ 或 ⋯）里选「安装应用」或「添加到主屏幕」。</p>`;
 const pri=k==="ios"?["a2done","我加好了"]:k==="prompt"?["a2go","添加到主屏幕"]:["a2later","知道了"];
 el.innerHTML=`<div class="a2c" role="dialog" aria-label="添加到主屏幕"><span class="a2i">科</span><b class="a2t">把「科判」加到主屏幕</b><p class="a2p">学习进度只存在这台手机里。加到主屏幕、像 App 一样打开，进度才不会被浏览器清掉。</p>${body}<div class="a2f">${k==="other"?"":`<button data-a2="a2later">以后再说</button>`}<button class="pri" data-a2="${pri[0]}">${pri[1]}</button></div><button class="a2off" data-a2="a2off">不再提示</button></div>`;
 dev.appendChild(el);const close=()=>{el.classList.add("out");setTimeout(()=>el.remove(),320)};
 el.onclick=e=>{const b=e.target.closest("[data-a2]");if(!b)return;const a=b.dataset.a2,s=a2State();
  if(a==="a2later"){s.n=(s.n||0)+1;s.next=Date.now()+3*864e5;a2Save(s);close()}
  else if(a==="a2off"||a==="a2done"){s.off=true;a2Save(s);close()}
  else if(a==="a2go")a2Go(close)}}
function showSplash(){const old=dev.querySelector(".splash");if(old)old.remove();const el=document.createElement("button");el.className="splash i-"+ST.ofi;el.setAttribute("aria-label","发心后点击进入");
 const W=dev.clientWidth,H=dev.clientHeight,TH=H*ST.ofh/100+ST.ofz*.9;
 el.innerHTML=`<span class="spc" style="top:${ST.ofy}%"><span class="spt" style="font-size:${ST.oft}px"><span>为了使片等虚空的众生</span><span>都安置于佛果</span><span>发无上殊胜的菩提心</span></span><small>发心后点击</small></span>${offerHTML(W,H)}`;
 dev.appendChild(el);el.onclick=()=>{if(el.classList.contains("out"))return;el.classList.add("out");dev.classList.add("enter");setTimeout(()=>{el.remove();dev.classList.remove("enter");showA2hs()},1350)}}
function splashLive(){const o=dev.querySelector(".splash");showSplash();const e=dev.querySelector(".splash");e.classList.add("still")}
function isDarkNow(){const b=BG[ST.bg];return b.c?!!b.dark:matchMedia("(prefers-color-scheme: dark)").matches}
let SDL={};
function retNote(v){return v==90?"默认值。到复习那天，大约 10 条里能记得 9 条。":v<90?`复习次数比默认少，到复习那天大约 10 条里会忘 ${((100-v)/10).toFixed(1).replace(".0","")} 条。`:`忘得更少，但每天要复习的条数会明显变多。`}
function renderSettings(){const dk=isDarkNow();
 const bgs=Object.entries(BG).map(([k,b])=>`<button class="sbg" data-sbg="${k}" aria-pressed="${ST.bg===k}" style="${b.c?`background:${b.c[0]};color:${b.c[2]};border-color:${b.c[4]}`:""}"><i>${b.c?"文":"◐"}</i><b>${b.name}</b></button>`).join("");
 const pals=Object.entries(PAL).map(([k,p])=>`<button class="spal" data-spal="${k}" aria-pressed="${ST.pal===k}"><span class="strip">${strip(p,10,dk)}</span><b>${p.name}</b><em>✓</em></button>`).join("");
 const pv=[["甲一","入行论"],["乙二","所入之自性"],["丙二","入者之意乐"],["丁一","发心之功德"]].map(([c,t],i)=>`<span style="padding-left:${i*14}px"><span class="badge" style="background:var(--k${i});color:var(--kt${i})">${c}</span>${t}</span>`).join("");
 const RM=remInfo();
 const rng=(id,min,max,v,unit)=>`<div class="srng"><small>A</small><input type="range" id="${id}" min="${min}" max="${max}" step="${id==="s-shyf"?.5:1}" value="${v}"><big>A</big><output>${v}${unit}</output></div>`;
 dev.innerHTML=`<div class="app settings"><div class="appbar"><div class="ttl rb"><span class="tl1"><button class="bk" data-shome aria-label="返回">‹</button><span>设置</span></span><span></span></div></div><div class="sbody"><div class="sin">
  <div class="sh">外观</div>
  <div class="sc"><div class="sr col"><b>背景</b><div class="sbgs">${bgs}</div></div>
   <div class="sr col"><b>科判层级颜色</b><div class="sprev">${pv}</div><div class="spals">${pals}</div></div></div>
  <div class="sh">阅读</div>
  <div class="sc"><div class="sr col"><b>颂词字号</b>${rng("s-vf",14,26,ST.vf,"px")}<div class="sdemo" style="font-size:${ST.vf}px">暇满人身极难得，既得能办人生利，</div></div>
   <div class="sr col"><b>释义字号</b>${rng("s-shyf",13,20,ST.shyf,"px")}<div class="sdemo" style="font-size:${ST.shyf}px;text-indent:2em">这般暇满的士夫具有成办增上生与决定胜的能力。</div></div>
   <div class="sr"><b>释义弹窗里重复颂词</b><button class="stog" data-stog="shyv" aria-pressed="${ST.shyv==="on"}" aria-label="释义弹窗里重复颂词"></button></div></div>
  <div class="sh">复习</div>
  <div class="sc"><div class="sr col"><b>目标记住率</b><div class="srng"><small style="font-size:12px">少复习</small><input type="range" id="s-ret" min="80" max="95" step="1" value="${ST.ret}"><small style="font-size:12px">记得牢</small><output>${ST.ret}%</output></div><div class="sdemo" style="font-family:var(--sans);font-size:12.5px;line-height:1.7;color:var(--muted)" id="s-retd">${retNote(ST.ret)}</div></div></div>
  <div class="sh">提醒</div>
  <div class="sc"><div class="sr"><b>每天新学</b><span class="sv" style="flex:1">到期复习超过 20 条时暂停新学</span><span class="stp"><button data-npd="-1" aria-label="少一支">−</button><b>${ST.npd}</b><button data-npd="1" aria-label="多一支">＋</button></span><span class="sv">支</span></div></div>
  <div class="sh">提醒</div>
  <div class="sc"><div class="sr"><b>每日提醒</b><span class="sv" style="flex:1">${ST.srem?"每天 "+esc(ST.remT):""}</span><button class="stog" data-rem aria-pressed="${!!ST.srem}" aria-label="每日提醒" ${RM.busy?"disabled":""}></button></div>
   <div class="sr"><b>提醒时间</b><span style="flex:1"></span><input type="time" class="imin stime" data-remt value="${esc(ST.remT)}" aria-label="提醒时间"></div>
   ${RM.note?`<div class="sr col"><span class="sdemo snote2">${RM.note}</span></div>`:""}
   <div class="sr"><b>加到手机日历</b><span class="sv" style="flex:1">不用联网服务，每天到点由日历提醒</span><button class="sdl" data-ics>下载</button></div></div>
  <div class="sh">数据</div>
  <div class="sc"><div class="sr"><b>备份背诵记录</b><span class="sv" style="flex:1">换手机时用</span><button class="sdl" data-bkup>导出</button><label class="sdl">导入<input type="file" accept=".json,application/json" data-rstr hidden></label></div></div>
  <div class="sh">关于</div>
  <div class="sc"><div class="sr"><b>版本</b><span class="sv">${esc(APPVER)}</span></div><div class="sr"><b>复习算法</b><span class="sv">FSRS（ts-fsrs，MIT 协议）</span></div>${a2Kind()?`<button class="sr go" data-a2open><b>添加到主屏幕</b></button>`:""}</div>
 </div></div></div>`;
 {const ab=dev.querySelector("[data-a2open]");if(ab)ab.onclick=()=>showA2hs(true)}
 const re=()=>{const y=dev.querySelector(".sbody").scrollTop;applyColors();renderSettings();dev.querySelector(".sbody").scrollTop=y;save()};
 dev.querySelector("[data-shome]").onclick=()=>{ST.screen="home";render();bindPanel()};
 dev.querySelectorAll("[data-sbg]").forEach(b=>b.onclick=()=>{ST.bg=b.dataset.sbg;re();bindPanel()});
 dev.querySelectorAll("[data-spal]").forEach(b=>b.onclick=()=>{ST.pal=b.dataset.spal;re();bindPanel()});
 dev.querySelectorAll("[data-stog]").forEach(b=>b.onclick=()=>{const k=b.dataset.stog;if(k==="shyv")ST.shyv=ST.shyv==="on"?"off":"on";else if(k==="sklamp")ST.sklamp=ST.sklamp===false;else ST[k]=!ST[k];re()});
 {const i=dev.querySelector("#s-ret");if(i){i.oninput=()=>{i.parentNode.querySelector("output").textContent=i.value+"%";dev.querySelector("#s-retd").textContent=retNote(+i.value)};i.onchange=()=>{ST.ret=+i.value;save()}}}
 dev.querySelectorAll("[data-npd]").forEach(b=>b.onclick=()=>{ST.npd=Math.max(1,Math.min(5,+ST.npd+ +b.dataset.npd));re()});
 {const b=dev.querySelector("[data-rem]");if(b)b.onclick=async()=>{await remToggle(!ST.srem);if(ST.screen==="settings")re()}}
 {const t=dev.querySelector("[data-remt]");if(t)t.onchange=async()=>{if(!/^\d\d:\d\d$/.test(t.value))return;ST.remT=t.value;save();await remSync();if(ST.screen==="settings")re()}}
 {const b=dev.querySelector("[data-ics]");if(b)b.onclick=()=>{downloadFile("每日背诵提醒.ics",icsText(ST.remT),"text/calendar");toastNow("打开下载的文件，加到日历里")}}
 {const b=dev.querySelector("[data-bkup]");if(b)b.onclick=()=>{downloadFile("科判背诵记录-"+dkey()+".json",JSON.stringify({kepan:1,SR,ST:stSaved()}),"application/json")}}
 {const i=dev.querySelector("[data-rstr]");if(i)i.onchange=async()=>{const f=i.files[0];if(!f)return;try{const o=JSON.parse(await f.text());if(!o||!o.kepan||!o.SR)throw new Error("不是背诵记录文件");Object.assign(SR,o.SR);lmFix();if(o.ST)stLoad(o.ST);save();re();toastNow("已导入背诵记录")}catch(e){toastNow("导入没有成功："+e.message)}}}
 [["s-vf","vf"],["s-shyf","shyf"]].forEach(([id,k])=>{const i=dev.querySelector("#"+id);const out=i.parentNode.querySelector("output"),demo=i.closest(".sr").querySelector(".sdemo");i.oninput=()=>{out.textContent=i.value+"px";demo.style.fontSize=i.value+"px"};i.onchange=()=>{ST[k]=+i.value;if(k==="vf")dev.style.setProperty("--vf",ST.vf+"px");save()}});
}
// 换画面时，开屏和回向卡片留在最上面；画完存一次
let HPUSH=false;
function render(){const keep=[...dev.children].filter(e=>e.classList&&(e.classList.contains("splash")||e.classList.contains("dedi")));
 if(!BK&&ST.screen!=="import"&&ST.screen!=="settings")ST.screen="home";
 if(ST.screen==="home"){applyColors();renderHome()}else if(ST.screen==="study"){applyColors();renderStudy()}else if(ST.screen==="settings"){applyColors();renderSettings()}else if(ST.screen==="import"){applyColors();renderImport()}else renderReader();
 keep.forEach(e=>{if(!e.isConnected)dev.appendChild(e)});
 if(ST.screen!=="home"&&!(history.state&&history.state.s)){try{history.pushState({s:1},"")}catch(e){}}else if(ST.screen==="home"&&history.state&&history.state.s){HPUSH=true;try{history.back()}catch(e){}}
 save()}
function renderReader(){
 applyColors();const W=wide(),K=4;const nComp=Math.max(0,BK.maxA-K);const comp=l=>l<=nComp;
 const CW=nComp>0?ST.cw+8:0;const X=l=>CW+(l-1-Math.min(l-1,nComp))*18;
 const rows=BK.seq.map(n=>`<div class="row ${n.stub?"stub":""}" data-id="${n.id}" style="padding-left:${X(n.lvl)+10}px"><div class="lt ${lmOn(BK)&&leafState(n)?"ls-"+leafState(n):""}" ${n.v.length&&ST.pace==="course"&&lmOn(BK)?`data-lt="${n.id}" role="button"`:""}>${badge(n)}<span class="ltt">${esc(n.title)}</span>${ltProg(n)}</div>${BK.prose?proseHTML(n):n.v.length?verseHTML(n.v,shyIns(n),SHIYI[bkKey(BK)]&&SHIYI[bkKey(BK)][n.id]?"tap":""):""}${BK.prose?"":noteHTML(n.notes,n.title)}${clineHTML(n)}</div>`).join("");
 const TD=todayCount();const PR=ST.rentry==="btn"&&lmOn(BK)?`<button class="tocbtn lrn" data-learn>练习${TD.tot?`<em>${TD.tot}</em>`:""}</button>`:"";
 dev.innerHTML=`<div class="app pg-${ST.rprog} ${BK.prose?"prose"+(ST.bo?" bo-on":""):""} ${ST.mfull&&W&&ST.view==="map"?"mfull":""} ${ST.railt} ${ST.rline?"":"no-rline"}"><div class="appbar"><div class="ttl rb"><span class="tl1"><button class="bk" data-home aria-label="返回首页">‹</button><span class="tt" data-tabout role="button" title="关于">${esc(BK.title)}</span><span class="tch" aria-live="polite"></span></span><span class="tbs">${PR}${BK.prose?`<span class="shysw" role="group" aria-label="仪轨显示"><button data-botg aria-pressed="${!!ST.bo}">藏文</button></span>`:`<span class="shysw" role="group" aria-label="释义显示方式">${[["sheet","弹出"],["inline","展开"]].map(([v,t])=>`<button data-shysw="${v}" aria-pressed="${ST.shym===v}">${t}</button>`).join("")}</span>`}<button class="tocbtn" data-aa aria-label="颂词字号">Aa</button></span></div></div>
  <div class="body">${W?'<div class="dock" id="dock"></div>':""}<div class="scroll" id="rs"><button class="op" id="outer"></button><div class="wrapr" id="rw">${rows}</div></div></div>${ST.rentry==="fab"&&TD.tot&&lmOn(BK)?`<button class="lfab" data-learn>今日 ${TD.tot} ›</button>`:""}</div>`;
 const app=dev.querySelector(".app"),rs=dev.querySelector("#rs"),rw=dev.querySelector("#rw"),outer=dev.querySelector("#outer"),dock=dev.querySelector("#dock");
 // 先一次量好每一行的位置，再画色带和编绳（边量边插会反复重排，整本书时很慢）
 const ROWS={};rw.querySelectorAll(".row").forEach(e=>ROWS[e.dataset.id]=e);const rowOf=n=>ROWS[n.id];
 const TOP=BK.seq.map(n=>ROWS[n.id].offsetTop);const HGT=BK.seq.map(n=>ROWS[n.id].offsetHeight);const geo={};BK.seq.forEach((n,i)=>geo[n.id]=[TOP[i],HGT[i]]);
 const oT=n=>geo[n.id][0],oB=n=>geo[n.id][0]+geo[n.id][1];
 const lastRow=n=>n.tl?n.tl:n.c.length?lastRow(n.c[n.c.length-1]):n;
 const frag=document.createDocumentFragment();
 BK.all.filter(n=>n.p&&n.c.length&&!comp(n.lvl)).forEach(n=>{const a=fl(n),b=lastRow(n);const d=document.createElement("div");d.className="rl";
  d.style.cssText=`--lc:var(--k${n.depth});--kt:var(--kt${n.depth});left:${X(n.lvl)}px;width:18px;top:${oT(a)}px;height:${oB(b)-oT(a)}px`;
  d.innerHTML=`<span>${esc(n.code+" "+n.title)}</span>`;frag.appendChild(d)});
 const compA=n=>anc(n).filter(x=>comp(x.lvl));
 if(nComp>0){const segs=[];BK.seq.forEach(n=>{const A=compA(n);const key=A.map(x=>x.id).join();const last=segs[segs.length-1];if(last&&last.key===key)last.rows.push(n);else segs.push({key,A,rows:[n]})});
  const TH=Math.round(ST.cw*(ST.twist==="helix"?3.2:2.6)),CUT=Math.round(TH*.36);
  segs.forEach((s,i)=>{if(!s.A.length)return;const ra=s.rows[0],rb=s.rows[s.rows.length-1];const a={offsetTop:oT(ra)},b={offsetTop:oT(rb),offsetHeight:geo[rb.id][1]};const d=document.createElement("div");d.className="cord "+ST.cord;
   const first=!(segs[i-1]&&segs[i-1].A.length),last=!(segs[i+1]&&segs[i+1].A.length),tw=ST.twist!=="gap";
   let t0=a.offsetTop+4,t1=b.offsetTop+b.offsetHeight-4;if(tw){if(!first)t0=a.offsetTop+CUT;if(!last)t1=b.offsetTop+b.offsetHeight-CUT}
   const top0=i===0&&s.rows[0]===BK.seq[0];if(top0){t0=-400}
   d.style.borderRadius=`${first&&!top0?ST.cw/2:0}px ${first&&!top0?ST.cw/2:0}px ${(last||!tw)?ST.cw/2:0}px ${(last||!tw)?ST.cw/2:0}px`;
   d.style.top=t0+"px";d.style.height=(t1-t0)+"px";
   const endB=last&&s.rows[s.rows.length-1]===BK.seq[BK.seq.length-1]&&ST.tas!=="none";
   if(endB){t1=b.offsetTop+b.offsetHeight-2;d.style.borderBottomLeftRadius=d.style.borderBottomRightRadius="0";
    const cols=s.A.map(x=>KH[x.depth]).filter(Boolean);const g=document.createElement("div");g.className="tassel "+ST.cord;
    const sv=tasselSVG(cols,ST.cw,ST);g.style.cssText=`top:${t1-1}px;left:${3+ST.cw/2-sv.cx}px`;g.innerHTML=sv.svg;frag.appendChild(g)}
   d.style.height=(t1-t0)+"px";
   if(tw&&!last){const nx=segs[i+1],y=b.offsetTop+b.offsetHeight;const t=document.createElement("div");t.className="twist "+ST.cord;t.style.cssText=`top:${y-TH/2}px;height:${TH}px`;
    t.innerHTML=twistSVG(s.A.map(x=>KH[x.depth]),nx.A.map(x=>KH[x.depth]),ST.cw,TH,ST.twist);t.title="换段："+nx.A.map(x=>x.code+" "+x.title).join(" ／ ");frag.appendChild(t)}d.style.setProperty("--tex",cordTexC(s.A.map(x=>KH[x.depth]),ST.cord));
   d.title=s.A.map(x=>x.code+" "+x.title).join(" ／ ");frag.appendChild(d)})}
 rw.appendChild(frag);
 let cur=BK.seq[0];
 const jump=n=>{rs.scrollTop=oT(n.c.length?fl(n):n)-2;upd()};
 const drawDock=()=>{dock.innerHTML=tocHTML(cur);bindToc(dock,jump);if(ST.view==="map"){centerCur(dock);return}const e=dock.querySelector('[aria-current="true"]');if(e){const r=e.getBoundingClientRect(),dr=dock.getBoundingClientRect();if(r.top<dr.top||r.bottom>dr.bottom)dock.scrollTop+=r.top-dr.top-dr.height/3}};
 let lastC=null,recT=0;const tch=dev.querySelector(".tch");
 const upd=()=>{const y=rs.scrollTop+4;let lo=0,hi=TOP.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(TOP[m]<=y)lo=m;else hi=m-1}const c=BK.seq[lo];cur=c;CUR=c;
  if(c!==lastC){lastC=c;const ch=BK.chOf[c.id];if(tch)tch.textContent=ch?"· "+ch.name:"";clearTimeout(recT);recT=setTimeout(()=>{SR.recent[BK.id]={id:c.id,t:Date.now()};save()},800)}
  {const A=compA(c);outer.style.setProperty("--pc",A.length?`var(--k${A[A.length-1].depth})`:"var(--muted)");const dd=A.length?A[A.length-1].depth:0;outer.style.setProperty("--pkt",`var(--kt${dd})`);outer.innerHTML=`<span class="pbx"><span class="pth">${pathHTML(A)}</span>${W?"":`<span class="ttab t-${ST.tcol} s-${ST.tsty}" aria-label="打开目录"><span class="tx">${ST.ttxt}</span>${ST.tarr==="none"?"":`<span class="ta a-${ST.tarr} m-${ST.tani}">${{chev:CHEV,tri:TRI,arrow:ARW,right:RGT,dbl:DBL}[ST.tarr]}</span>`}</span>`}</span>`}const oh=outer.offsetHeight;rw.querySelectorAll(".rl span").forEach(s=>s.style.top=oh+"px");
  if(dock){const nb=dock.querySelector(`[data-j="${c.id}"]`);if(!nb||nb.getAttribute("aria-current")!=="true"){
   // 目录已经画好时只挪当前标记，不整个重画
   if(nb&&ST.view!=="map"){const onp=new Set(anc(c).map(x=>x.id));dock.querySelectorAll('[data-j][aria-current="true"]').forEach(x=>x.setAttribute("aria-current","false"));dock.querySelectorAll(".on-path").forEach(x=>x.classList.remove("on-path"));onp.forEach(id=>{const e=dock.querySelector(`[data-j="${id}"]`);if(e)e.classList.add("on-path")});nb.setAttribute("aria-current","true");const r=nb.getBoundingClientRect(),dr=dock.getBoundingClientRect();if(r.top<dr.top||r.bottom>dr.bottom)dock.scrollTop+=r.top-dr.top-dr.height/3}
   else drawDock()}}};
 rs.onscroll=upd;
 const open=()=>{ST.tocOpen=true;const ov=document.createElement("div");ov.className="tocov";ov.innerHTML=`<div class="mh"><span></span>${toggleHTML()}<span class="mhr"><button class="tocbtn" data-x>关闭</button></span></div><div class="tl">${tocHTML(cur)}</div>`;app.appendChild(ov);
  const tl=ov.querySelector(".tl");centerCur(tl);
  const close=()=>{ST.tocOpen=false;ov.remove();const b=document.getElementById("opentoc");if(b)b.textContent="打开目录看效果"};
  ov.querySelector("[data-x]").onclick=close;bindToc(ov,n=>{close();jump(n)});
  refreshToc=sw=>{const y=tl.scrollTop;tl.innerHTML=tocHTML(cur);bindToc(tl,n=>{close();jump(n)});if(sw)centerCur(tl);else tl.scrollTop=y}};
 outer.onclick=open;const tb=dev.querySelector("[data-toc]");if(tb)tb.onclick=open;
 const aaOpen=()=>{let pp=app.querySelector(".aapop");if(pp){pp.remove();ST.aaOpen=false;return}ST.aaOpen=true;pp=document.createElement("div");pp.className="aapop";
  pp.innerHTML=`<div class="aah">颂词字号</div><div class="aar"><button data-d="-1" aria-label="缩小">A</button><input type="range" min="14" max="26" step="1" value="${ST.vf}" aria-label="颂词字号"><button data-d="1" aria-label="放大">A</button></div><div class="aav">${ST.vf}px</div>`;
  app.appendChild(pp);{const bt=app.querySelector("[data-aa]"),op=pp.offsetParent;if(bt&&op){const r=bt.getBoundingClientRect(),o=op.getBoundingClientRect();const l=Math.max(8,Math.min(r.right-o.left-pp.offsetWidth,o.width-pp.offsetWidth-8));pp.style.right="auto";pp.style.left=l+"px";pp.style.top=(r.bottom-o.top+6)+"px"}}const set=v=>{v=Math.max(14,Math.min(26,v));if(v===ST.vf)return;ST.vf=v;ST.anchor=cur.id;dev.style.setProperty("--vf",v+"px");render();summary()};
  pp.querySelector("input").onchange=e=>set(+e.target.value);pp.querySelector("input").oninput=e=>{pp.querySelector(".aav").textContent=e.target.value+"px"};
  pp.querySelectorAll("[data-d]").forEach(b=>b.onclick=()=>set(ST.vf+ +b.dataset.d))};
 dev.querySelector("[data-aa]").onclick=aaOpen;
 {const b=dev.querySelector("[data-botg]");if(b)b.onclick=()=>{ST.bo=!ST.bo;save();const y=rs.scrollTop;render();bindPanel();dev.querySelector("#rs").scrollTop=y}}
 dev.querySelectorAll("[data-shysw]").forEach(b=>b.onclick=()=>{if(ST.shym===b.dataset.shysw)return;ST.shym=b.dataset.shysw;const y=rs.scrollTop;render();bindPanel();dev.querySelector("#rs").scrollTop=y});
 {const ta=dev.querySelector("[data-tabout]");if(ta)ta.onclick=()=>{const bg=document.createElement("div");bg.innerHTML=aboutHTML(WORKS.find(w=>w.id===BK.id));while(bg.firstChild)app.appendChild(bg.firstChild);app.querySelectorAll("[data-close]").forEach(x=>x.onclick=()=>{app.querySelectorAll(".hsheet,.hsheet-bg").forEach(z=>z.remove())})}}
 dev.querySelector("[data-home]").onclick=()=>{SR.recent[BK.id]={id:cur.id,t:Date.now()};ST.screen="home";ST.tocOpen=false;SHY=null;render()};
 dev.querySelectorAll("[data-learn]").forEach(b=>b.onclick=()=>{SR.recent[BK.id]={id:cur.id,t:Date.now()};if(!SR.paceAsked){PACESH=BK.id;PRESTART=true;ST.screen="home";ST.tocOpen=false;render();return}startSession({B:BK})});
 dev.querySelectorAll("[data-lt]").forEach(b=>b.onclick=e=>{if(!e.target.closest(".badge,.ltt"))return;e.stopPropagation();ltSheet(BK.by[b.dataset.lt],dev.querySelector(".app"))});
 dev.querySelectorAll("[data-cmv]").forEach(b=>b.onclick=e=>{e.stopPropagation();moveCourse(+b.dataset.cmv)});
 {const bk=bkKey(BK);
  const toTop=(id,si)=>{const row=rowOf(BK.by[id]);const t=(si!=null&&row.querySelector(`.stz[data-si="${si}"]`))||row;const r=t.getBoundingClientRect(),rr=rs.getBoundingClientRect();rs.scrollTop+=r.top-rr.top-outer.offsetHeight-12};
  const pinOf=(id,si)=>{const t=dev.querySelector(`.row[data-id="${id}"] .stz[data-si="${si}"]`);return t?{id,si,top:t.getBoundingClientRect().top-rs.getBoundingClientRect().top}:null};
  const show=(id,gi,how)=>{const G=shyG(bk,id);SHY={bk,id,gi};const si=G[gi].vs[0];
   if(ST.shym==="inline"){if(how==="tap")ST.pin=pinOf(id,si);else{ST.anchor=id;ST.anchorKeep=null}render();bindPanel();if(how!=="tap"){const r2=dev.querySelector(`.row[data-id="${id}"] .stz[data-si="${si}"]`),s2=dev.querySelector("#rs"),o2=dev.querySelector("#outer");if(r2)s2.scrollTop+=r2.getBoundingClientRect().top-s2.getBoundingClientRect().top-o2.offsetHeight-12}return}
   shyMark(rw);shySheet(app);bindShy();if(how!=="tap")toTop(id,si)};
  const close=()=>{const o=SHY;SHY=null;if(ST.shym==="inline"){if(o){const G=shyG(o.bk,o.id);ST.pin=pinOf(o.id,G&&G[o.gi]?G[o.gi].vs[0]:0)}render();bindPanel();return}shyMark(rw);shySheet(app)};
  const bindShy=()=>{dev.querySelectorAll("[data-shyx]").forEach(b=>b.onclick=e=>{e.stopPropagation();close()});
   dev.querySelectorAll("[data-shyn]").forEach(b=>b.onclick=e=>{e.stopPropagation();const L=shyList();const i=L.findIndex(x=>x.n.id===SHY.id&&x.gi===SHY.gi);const t=L[i+ +b.dataset.shyn];if(t)show(t.n.id,t.gi,"nav")})};
  rw.addEventListener("click",e=>{if(e.target.closest(".shyin,.cline,button,a,.badge,.ltt"))return;const row=e.target.closest(".row");if(!row||!row.querySelector(".verse.tap"))return;let s=e.target.closest(".verse.tap .stz");
   if(!s){let bd=1e9;row.querySelectorAll(".verse.tap .stz").forEach(z=>{if(z.closest(".shyin"))return;const r=z.getBoundingClientRect();const d=e.clientY<r.top?r.top-e.clientY:e.clientY>r.bottom?e.clientY-r.bottom:0;if(d<bd){bd=d;s=z}})}if(!s)return;const G=shyG(bk,row.dataset.id);if(!G)return;const gi=G.findIndex(g=>g.vs.includes(+s.dataset.si));if(gi<0)return;
   if(SHY&&SHY.bk===bk&&SHY.id===row.dataset.id&&SHY.gi===gi){close();return}show(row.dataset.id,gi,"tap")});
  if(SHY&&SHY.bk!==bk)SHY=null;shyMark(rw);shySheet(app);bindShy()}
 if(ST.pin){const P=ST.pin;ST.pin=null;ST.anchor=null;const t=dev.querySelector(`.row[data-id="${P.id}"] .stz[data-si="${P.si}"]`);if(t)rs.scrollTop+=t.getBoundingClientRect().top-rs.getBoundingClientRect().top-P.top}
 else if(ST.anchor){const n=BK.seq.find(x=>x.id===ST.anchor);ST.anchor=null;if(n)rs.scrollTop=oT(n)-(ST.anchorKeep!=null?ST.anchorKeep-outer.offsetHeight:2);ST.anchorKeep=null}else if(ST.openAt){const n=BK.by[ST.openAt];ST.openAt=null;if(n)rs.scrollTop=oT(geo[n.id]?n:fl(n))-2}
 upd();if(ST.aaOpen){ST.aaOpen=false;aaOpen()}
 if(W)refreshToc=sw=>{const y=dock.scrollTop;dock.innerHTML=tocHTML(cur);bindToc(dock,jump);if(sw)centerCur(dock);else dock.scrollTop=y};
 else{refreshToc=null;if(ST.tocOpen)open()}
}

function strip(p,n,dk){return Array.from({length:n},(_,i)=>{let c=p.f(i,n-1,i+2);if(dk)c=MIX(c,"#ffffff",.32);return `<i style="background:${c}"></i>`}).join("")}
function bindPanel(){}function summary(){}

// ===== 本机存储（IndexedDB）：背诵记录、设置、导入的书 =====
const APPVER="1.0";
const IDB=(()=>{let p=null;const open=()=>p||(p=new Promise((ok,bad)=>{const r=indexedDB.open("kepan",1);r.onupgradeneeded=()=>r.result.createObjectStore("kv");r.onsuccess=()=>ok(r.result);r.onerror=()=>bad(r.error)}));
 const tx=(mode,fn)=>open().then(db=>new Promise((ok,bad)=>{const t=db.transaction("kv",mode);const st=t.objectStore("kv");const r=fn(st);t.oncomplete=()=>ok(r&&r.result);t.onerror=()=>bad(t.error)}));
 return {get:k=>tx("readonly",s=>s.get(k)),set:(k,v)=>tx("readwrite",s=>s.put(v,k)),del:k=>tx("readwrite",s=>s.delete(k)),keys:()=>tx("readonly",s=>s.getAllKeys())}})();
const idbGet=k=>IDB.get(k).catch(()=>undefined),idbSet=(k,v)=>IDB.set(k,v),idbDel=k=>IDB.del(k).catch(()=>{});
const STKEEP=["bo","bg","pal","vf","shyf","shyv","shym","ret","srem","remT","npd","pace","qpw","view"];
function stSaved(){const o={};STKEEP.forEach(k=>o[k]=ST[k]);return o}
function stLoad(o){STKEEP.forEach(k=>{if(o[k]!==undefined)ST[k]=o[k]})}
let saveT=0,LOADED=false;
function save(now){if(!LOADED)return;clearTimeout(saveT);const go=()=>idbSet("state",{SR:JSON.parse(JSON.stringify(SR)),ST:stSaved(),at:Date.now()}).catch(e=>console.warn("保存失败",e));if(now)return go();saveT=setTimeout(go,400)}
addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")save(true)});
addEventListener("pagehide",()=>save(true));
function toastNow(t){let el=dev.querySelector(".htoast");if(!el){el=document.createElement("div");el.className="htoast gtoast";dev.appendChild(el)}el.textContent=t;el.hidden=false;clearTimeout(el._t);el._t=setTimeout(()=>el.hidden=true,2600)}
async function downloadFile(name,text,type){const blob=new Blob([text],{type});
 try{const f=new File([blob],name,{type});if(navigator.canShare&&navigator.canShare({files:[f]})&&/iP(hone|ad|od)|Android/.test(navigator.userAgent)){await navigator.share({files:[f],title:name});return}}catch(e){if(e&&e.name==="AbortError")return}
 const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500)}
function resetBook(id){const pre=id+":";Object.keys(SR.it).forEach(k=>{if(k.startsWith(pre))delete SR.it[k]});delete SR.course[id];delete SR.last[id];save()}
const BUILTIN={};
async function removeBook(id){await idbDel("book:"+id);await idbDel("shiyi:"+id);
 if(BUILTIN[id]){const b=BUILTIN[id];installBook(b.info,b.tree,b.shiyi)}else{resetBook(id);delete BOOKS[id];delete SHIYI[id];const i=WORKS.findIndex(w=>w.id===id);if(i>=0)WORKS.splice(i,1);if(BK&&BK.id===id)BK=Object.values(BOOKS)[0]||null}save()}

// ===== 每日提醒 =====
// 有推送服务（push/ 里的 Cloudflare Worker，地址写在 config.js）时用 Web Push；没有时可以把每天的提醒加到手机日历
const CFG=window.KEPAN_CONFIG||{};
let A2P=null;const A2K="kepan-a2hs";
function a2State(){try{return JSON.parse(localStorage.getItem(A2K))||{}}catch(e){return {}}}
function a2Save(o){try{localStorage.setItem(A2K,JSON.stringify(o))}catch(e){}}
function a2Kind(){return STANDALONE()?null:IOS?"ios":A2P?"prompt":"other"}
function a2Go(close){if(!A2P){close();return}const p=A2P;A2P=null;p.prompt();p.userChoice.then(r=>{if(r&&r.outcome==="accepted")a2Save({off:true});close()}).catch(close)}
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();A2P=e;if(dev.querySelector(".a2h"))showA2hs(true)});
window.addEventListener("appinstalled",()=>{a2Save({off:true});const o=dev.querySelector(".a2h");if(o)o.remove()});
const IOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
const STANDALONE=()=>matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
const pushOK=()=>!!CFG.pushServer&&"serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window;
const REM={busy:false};
function remInfo(){let note="";
 if(!CFG.pushServer)note="推送服务还没有架设，暂时收不到通知。可以先用下面的「加到手机日历」，每天到点由日历提醒。";
 else if(!pushOK())note=IOS&&!STANDALONE()?"iPhone 上要先把本页加到主屏幕：在 Safari 里点底部「分享」→「添加到主屏幕」，再从主屏幕打开，回到这里打开提醒（需要 iOS 16.4 以上）。":"这个浏览器不支持推送通知，可以用「加到手机日历」。";
 else if(Notification.permission==="denied")note="通知权限被关掉了，要到系统设置里允许「科判」发通知。";
 else if(ST.srem)note="到点会收到一条通知，写着今天要复习几条。";
 return {busy:REM.busy,note}}
const b64u=s=>{s=s.replace(/-/g,"+").replace(/_/g,"/");const b=atob(s+"===".slice((s.length+3)%4));return Uint8Array.from(b,c=>c.charCodeAt(0))};
async function pushSub(){const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();
 if(!sub){const r=await fetch(CFG.pushServer+"/vapid");if(!r.ok)throw new Error("推送服务没有响应");const {publicKey}=await r.json();sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(publicKey)})}
 const res=await fetch(CFG.pushServer+"/subscribe",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sub:sub.toJSON(),time:ST.remT,tz:Intl.DateTimeFormat().resolvedOptions().timeZone||"Asia/Shanghai"})});
 if(!res.ok)throw new Error("推送服务没有响应（"+res.status+"）")}
async function pushUnsub(){try{const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();if(sub){fetch(CFG.pushServer+"/unsubscribe",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({endpoint:sub.endpoint})}).catch(()=>{});await sub.unsubscribe()}}catch(e){}}
async function remToggle(on){if(!on){ST.srem=false;save();if(pushOK())await pushUnsub();return}
 if(!pushOK()){toastNow(remInfo().note);return}
 REM.busy=true;try{const p=await Notification.requestPermission();if(p!=="granted"){toastNow("没有允许通知，提醒打不开");return}await pushSub();ST.srem=true;save();toastNow("已打开每日提醒，每天 "+ST.remT)}
 catch(e){toastNow("提醒没有打开："+(e&&e.message||e))}finally{REM.busy=false}}
async function remSync(){if(ST.srem&&pushOK())try{await pushSub();toastNow("提醒时间改成每天 "+ST.remT)}catch(e){toastNow("提醒时间没改成功："+(e&&e.message||e))}}
function icsText(hm){const [h,m]=hm.split(":");const d=new Date();const ds=d.getFullYear()+String(d.getMonth()+1).padStart(2,"0")+String(d.getDate()).padStart(2,"0");
 const stamp=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d+/,"");const url=location.href.split("#")[0].split("?")[0];
 return ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//kepan//daily//ZH","CALSCALE:GREGORIAN","BEGIN:VEVENT","UID:kepan-daily-"+ds+"@kepan","DTSTAMP:"+stamp,`DTSTART:${ds}T${h}${m}00`,"DURATION:PT15M","RRULE:FREQ=DAILY","SUMMARY:背诵科判颂词","DESCRIPTION:打开科判，复习今天到期的颂词，点亮今天的灯。\\n"+url,"URL:"+url,"BEGIN:VALARM","ACTION:DISPLAY","DESCRIPTION:背诵科判颂词","TRIGGER:PT0M","END:VALARM","END:VEVENT","END:VCALENDAR",""].join("\r\n")}

// ===== 启动 =====
function layout(){dev.classList.toggle("wide",innerWidth>700)}
let lastW=innerWidth;
addEventListener("resize",()=>{clearTimeout(layout._t);layout._t=setTimeout(()=>{const w=innerWidth;if(Math.abs(w-lastW)<2)return;lastW=w;layout();if(!LOADED)return;if(ST.screen==="reader"&&CUR)ST.anchor=CUR.id;render()},180)});
try{matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>{if(LOADED){if(ST.screen==="reader"&&CUR)ST.anchor=CUR.id;render()}})}catch(e){}
// 手机的返回键：先回到书架，而不是直接退出
addEventListener("popstate",()=>{if(HPUSH){HPUSH=false;return}if(!LOADED)return;if(ST.screen==="study"){exitSession();return}if(ST.screen!=="home"){ST.screen="home";ST.tocOpen=false;SHY=null;render()}});
// 内置的书：科判同时下载，下完就能显示书架；释义（体积大，书架用不到）随后在后台取，取到再挂上
// books.json 里的 v 是文件内容的版本号（发布时生成），离线缓存按它判断要不要重新下载
const dataURL=(f,v)=>"data/"+f+(v?"?v="+v:"");
async function loadBuiltin(){const r=await fetch("data/books.json");if(!r.ok)throw new Error("书目读取失败");const list=await r.json();
 const trees=await Promise.all(list.map(b=>fetch(dataURL(b.data,b.v&&b.v.data)).then(r=>r.ok?r.json():null).catch(e=>{console.warn("内置书读取失败",b.id,e);return null})));
 list.forEach((b,i)=>{const t=trees[i];if(!t)return;try{const info={id:b.id,builtin:true,meta:{name:b.meta&&b.meta.name,shortName:b.meta&&b.meta.shortName}};BUILTIN[b.id]={info,tree:t,shiyi:null};installBook(info,t,null)}catch(e){console.warn("内置书读取失败",b.id,e)}});
 return list}
function loadBuiltinShiyi(list){return Promise.all((list||[]).filter(b=>b.shiyi&&BUILTIN[b.id]).map(b=>fetch(dataURL(b.shiyi,b.v&&b.v.shiyi)).then(r=>r.ok?r.json():null).then(s=>{if(s)attachShiyi(b.id,s)}).catch(e=>console.warn("释义读取失败",b.id,e))))}
function attachShiyi(id,s){const b=BUILTIN[id];if(!b)return;b.shiyi=s;const B=BOOKS[id];if(!B||!B.builtin)return;// 已被用户导入的同名书替换时不动
 if(B.prose){if(!s||!s.sections)return;PROSE[id]=s.sections;if(LOADED&&BK&&BK.id===id&&ST.screen==="reader"){const r=dev.querySelector("#rs"),y=r?r.scrollTop:0;render();bindPanel();const r2=dev.querySelector("#rs");if(r2)r2.scrollTop=y}return}
 const sy=s&&s.sections?shiyiOf(s):null;if(!sy)return;SHIYI[id]=sy;B.syName=syNameOf(s);
 const W=WORKS.find(w=>w.id===id);if(W&&!W.shiyi&&B.syName)W.shiyi="《"+B.syName+"》";
 // 阅读页已经打开这本书：给有释义的颂词补上可点的标记，不整页重画
 if(LOADED&&BK&&BK.id===id&&ST.screen==="reader")dev.querySelectorAll("#rw .row").forEach(r=>{if(sy[r.dataset.id]){const v=r.querySelector(".verse");if(v)v.classList.add("tap")}})}
async function loadImported(){const keys=(await IDB.keys().catch(()=>[]))||[];
 for(const k of keys){if(typeof k!=="string"||!k.startsWith("book:"))continue;try{const b=await idbGet(k);if(!b)continue;const s=b.info.hasShiyi?await idbGet("shiyi:"+b.info.id):null;installBook(b.info,b.tree,s)}catch(e){console.warn("导入的书读取失败",k,e)}}}
async function boot(){layout();dev.innerHTML=`<div class="app home"><div class="appbar"><div class="ttl"><span>科判</span></div></div></div>`;showSplash();
 try{const st=await idbGet("state");if(st){Object.assign(SR,st.SR||{});stLoad(st.ST||{})}}catch(e){}
 lmFix();
 let blist=null;try{blist=await loadBuiltin()}catch(e){console.warn(e)}
 await loadImported();
 BK=(Object.values(SR.recent).sort((a,b)=>b.t-a.t)[0]&&Object.keys(SR.recent).sort((a,b)=>SR.recent[b].t-SR.recent[a].t).map(id=>BOOKS[id]).find(Boolean))||Object.values(BOOKS)[0]||null;
 LOADED=true;ST.screen="home";render();
 if(!Object.keys(BOOKS).length)toastNow("书目没有读到，请联网后重新打开");
 loadBuiltinShiyi(blist);warmReader(BK);
 if("serviceWorker" in navigator&&location.protocol!=="file:")navigator.serviceWorker.register("sw.js").catch(e=>console.warn("离线缓存没有装上",e));
 if(ST.srem&&pushOK()&&Notification.permission==="granted")pushSub().catch(()=>{})}
boot();

// ===== 阅读页预热 =====
// 第一次打开大部头时，排版整本颂词（字形计算）和生成编绳图案最费时；再开一次就快很多。
// 所以在书架上空闲时，把最近读的那本书分成小块先算一遍，每块只占几十毫秒，不影响操作；
// 开屏还在、离开书架或换了书就停下。
function warmReader(B){if(!B||warmReader.done[B.id])return;warmReader.done[B.id]=true;
 const idle=f=>window.requestIdleCallback?requestIdleCallback(f,{timeout:800}):setTimeout(f,60);
 const steps=[];
 const nComp=Math.max(0,B.maxA-4);
 // 编绳和绞结是 blob 网址的 SVG 图：先载入解码一次，打开阅读页时就不用逐张解析
 const seen=new Set(),pre=h=>{const m=typeof h==="string"&&h.match(/blob:[^"')\s]+/);if(!m||seen.has(m[0]))return;seen.add(m[0]);const im=new Image();im.src=m[0];warmReader.imgs.push(im);if(im.decode)im.decode().catch(()=>{})};
 if(nComp>0&&ST.cord){const segs=[];B.seq.forEach(n=>{const A=anc(n).filter(x=>x.lvl<=nComp);const k=A.map(x=>x.id).join();const l=segs[segs.length-1];if(!l||l.k!==k)segs.push({k,A})});
  const TH=Math.round(ST.cw*(ST.twist==="helix"?3.2:2.6));
  for(let i=0;i<segs.length;i+=8)steps.push(()=>segs.slice(i,i+8).forEach((s,j)=>{if(!s.A.length)return;const c=s.A.map(x=>KH[x.depth]);pre(cordTexC(c,ST.cord));const nx=segs[i+j+1];if(ST.twist!=="gap"&&nx&&nx.A.length)pre(twistSVG(c,nx.A.map(x=>KH[x.depth]),ST.cw,TH,ST.twist))}))}
 let box=null;
 for(let i=0;i<B.seq.length;i+=12)steps.push(()=>{if(!box||!box.isConnected){box=document.createElement("div");box.setAttribute("aria-hidden","true");box.style.cssText=`position:absolute;left:-99999px;top:0;width:${Math.max(200,dev.clientWidth-60)}px;visibility:hidden;pointer-events:none`;dev.appendChild(box)}
  box.innerHTML=B.seq.slice(i,i+12).map(n=>`<div class="row"><div class="lt">${badge(n)}<span class="ltt">${esc(n.title)}</span></div>${n.v.length?verseHTML(n.v,null,""):""}</div>`).join("");box.offsetHeight});
 steps.push(()=>{if(box)box.remove()});
 let k=0;const tick=()=>{if(k>=steps.length)return;
  if(!LOADED||BK!==B||ST.screen!=="home"){if(box)box.remove();warmReader.done[B.id]=false;return}
  if(dev.querySelector(".splash")){setTimeout(tick,600);return}
  const t=performance.now();while(k<steps.length&&performance.now()-t<30)steps[k++]();idle(tick)};
 setTimeout(tick,1200)}
warmReader.done={};warmReader.imgs=[];

// 科判下的附注。经名的梵、藏、汉语在 PDF 里是分行写的，转出来连成了一串：按「梵语：」「藏语：」「汉语：」重新分行，用正文颜色
const NAMEL=/(?=(?:梵语|藏语|汉语|印度语|梵文|藏文)[：:])/;
function noteHTML(no,tt){if(!no||!no.length)return "";const nm=[],ot=[],isT=/题|名/.test(tt||"");no.forEach(t=>{const p=t.split(NAMEL).map(x=>x.trim()).filter(Boolean);(isT||p.length>1||/^(梵语|藏语|汉语|印度语|梵文|藏文)[：:]/.test(t)?nm:ot).push(...(p.length>1?p:[t]))});
 return (nm.length?`<div class="vnote vname">${nm.map(x=>`<div>${esc(x)}</div>`).join("")}</div>`:"")+(ot.length?`<div class="vnote">${ot.map(esc).join("　")}</div>`:"")}

function errataHTML(w){const E=w.errata||[],N=w.notes||[];if(!E.length&&!N.length)return "";
 const lab=c=>(c.raw||"").replace(/（表[^）]*）|（\d+表）/g,"").replace(/分[一二三四五六七八九十]+$/,"");
 return `<div class="aerr"><div class="aerrh">勘误与说明</div>${N.map(t=>`<p class="aerrn">${esc(t)}</p>`).join("")}${E.length?`<ol>${E.map(c=>`<li><b>${esc(lab(c))}</b>　${esc(c.reason||"")}</li>`).join("")}</ol>`:""}<p class="aerrai">以上勘误由制作者用 AI 校对，用者自行斟酌。</p></div>`}
