'use strict';
// =====================================================================
//  画面
// =====================================================================
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const BX=x=>r2(x+7.5);
const C={ink:'#26211C',sub:'#6E665D',acc:'#E8742A',def:'#2F6DB5',off:'#D9473A',warn:'#D2483B',go:'#17985A',hl:'#F5C518',bg:'#FFFFFF'};
const CATN={};CATS.forEach(c=>CATN[c.id]=c.name);CATN.my='マイ作戦';
const KIND={run:'移動・カット',drib:'ドリブル',scr:'スクリーン'};
let snackT=null;function snack(m){const s=$('snack');s.textContent=m;s.classList.add('on');clearTimeout(snackT);snackT=setTimeout(()=>s.classList.remove('on'),2200)}

// ---------------- コート（木の床・塗ったペイントエリア・白いライン） ----------------
function courtSVG(){
  const ln='rgba(255,255,255,.95)';const yj=r2(HOOP.y+Math.sqrt(6.75**2-6.6**2));
  return `<defs><pattern id="wood" width="1.2" height="3.6" patternUnits="userSpaceOnUse"><rect width="1.2" height="3.6" fill="#E4BE8E"/><rect x="0.6" width="0.6" height="3.6" fill="#DFB784"/><path d="M0 0V3.6M0.6 1.8V3.6M0.6 0V0.9" stroke="rgba(120,78,40,.13)" stroke-width="0.02"/></pattern>`+
  `<filter id="hb" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="0.32"/></filter></defs>`+
  `<rect x="-0.4" y="-0.4" width="15.8" height="14.8" fill="#B57E52"/><rect x="0" y="0" width="15" height="14" fill="url(#wood)"/>`+
  `<rect x="${BX(-2.45)}" y="0" width="4.9" height="5.8" fill="#C9895A" opacity="0.92"/>`+
  `<g fill="none" stroke="${ln}" stroke-width="0.07"><rect x="0" y="0" width="15" height="14"/><rect x="${BX(-2.45)}" y="0" width="4.9" height="5.8"/>`+
  `<path d="M${BX(-1.8)} 5.8A1.8 1.8 0 0 0 ${BX(1.8)} 5.8"/><path d="M${BX(-1.8)} 5.8A1.8 1.8 0 0 1 ${BX(1.8)} 5.8" stroke-dasharray="0.3 0.25"/>`+
  `<path d="M${BX(-6.6)} 0V${yj}A6.75 6.75 0 0 0 ${BX(6.6)} ${yj}V0"/><path d="M${BX(-1.25)} ${HOOP.y}A1.25 1.25 0 0 0 ${BX(1.25)} ${HOOP.y}"/>`+
  `<path d="M${BX(-1.8)} 14A1.8 1.8 0 0 1 ${BX(1.8)} 14"/></g>`+
  `<line x1="${BX(-0.9)}" y1="1.2" x2="${BX(0.9)}" y2="1.2" stroke="#fff" stroke-width="0.12"/>`+
  `<circle cx="7.5" cy="${HOOP.y}" r="0.23" fill="none" stroke="#E0562B" stroke-width="0.08"/>`;
}
function tx(x,y,str,size,attrs){return `<text x="${Math.round(x*100)}" y="${Math.round(y*100)}" font-size="${Math.round(size*100)}" transform="scale(0.01)" text-anchor="middle" class="tk" ${attrs||''}>${str}</text>`}
function offTok(p,n,o){o=o||{};const r=o.r||0.43;return `<g transform="translate(${BX(p.x)} ${r2(p.y)})"${o.op?` opacity="${o.op}"`:''}><circle cx="0.04" cy="0.06" r="${r}" fill="rgba(60,30,10,.25)"/><circle r="${r}" fill="${C.off}" stroke="#fff" stroke-width="0.06"/>${o.noNum?'':tx(0,r*0.37,n,r*1.08,`font-weight="700" fill="#fff"`)}</g>`}
function defTok(p,n,off,stun){return `<g transform="translate(${BX(p.x)} ${r2(p.y)})"><circle cx="0.04" cy="0.06" r="0.41" fill="rgba(60,30,10,.25)"/><circle r="0.41" fill="${C.def}" stroke="${off?C.hl:'#fff'}" stroke-width="${off?0.13:0.06}"/>${tx(0,0.15,n,0.42,`font-weight="700" fill="#fff"`)}${stun?tx(0.44,-0.26,'!',0.6,`font-weight="900" fill="${C.hl}" stroke="${C.ink}" stroke-width="7" paint-order="stroke"`):''}</g>`}
function ballTok(x,y,r){r=r||0.2;const cx=BX(x),cy=r2(y);return `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="#E8742A" stroke="#4A230A" stroke-width="0.035"/><path d="M${r2(cx-r)} ${cy}H${r2(cx+r)}M${cx} ${r2(cy-r)}V${r2(cy+r)}" stroke="#4A230A" stroke-width="0.025"/></g>`}

// ---------------- 作戦図の記号 ----------------
function pd(pts){return pts.map((p,i)=>(i?'L':'M')+BX(p.x)+' '+r2(p.y)).join('')}
function head(a,b,c,s){s=s||0.34;const d=unit(sub(b,a));const n=V(-d.y,d.x);const p1=add(b,add(mul(d,-s),mul(n,s*0.55))),p2=add(b,add(mul(d,-s),mul(n,-s*0.55)));return `<path d="${pd([p1,b,p2])}Z" fill="${c}" stroke="none"/>`}
function along(pts){const seg=[];let tot=0;for(let i=1;i<pts.length;i++){const L=dist(pts[i-1],pts[i]);seg.push({a:pts[i-1],b:pts[i],L,s:tot});tot+=L}
  return {tot,at:s=>{for(const g of seg){if(s<=g.s+g.L||g===seg[seg.length-1]){const t=g.L?clamp((s-g.s)/g.L,0,1):0;return {p:lerpV(g.a,g.b,t),d:unit(sub(g.b,g.a))}}}return {p:pts[pts.length-1],d:V(1,0)}}}}
function trimEnd(pts,cut){const A=along(pts);if(A.tot<cut+0.1)return pts;const e=A.at(A.tot-cut).p;const out=[];let acc=0;out.push(pts[0]);for(let i=1;i<pts.length;i++){const L=dist(pts[i-1],pts[i]);if(acc+L<A.tot-cut){out.push(pts[i]);acc+=L}else break}out.push(e);return out}
function moveSVG(pts,kind,c,w){
  if(pts.length<2||along(pts).tot<0.15)return '';
  const A=along(pts);const end=pts[pts.length-1];
  if(kind==='scr'){const body=pd(pts);const d=A.at(A.tot).d;const n=V(-d.y,d.x);const a=add(end,mul(n,0.45)),b=add(end,mul(n,-0.45));
    return `<path d="${body}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="${pd([a,b])}" stroke="${c}" stroke-width="${r2(w*1.9)}" stroke-linecap="round"/>`}
  if(kind==='drib'){const z=[pts[0]];let f=1;const stop=A.tot-0.5;for(let s=0.26;s<stop;s+=0.26){const q=A.at(s);const n=V(-q.d.y,q.d.x);z.push(add(q.p,mul(n,0.16*f)));f*=-1}
    const pe=A.at(Math.max(0,A.tot-0.3)).p;z.push(pe);
    return `<path d="${pd(z)}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linejoin="round"/><path d="${pd([pe,end])}" stroke="${c}" stroke-width="${w}"/>`+head(pe,end,c)}
  const tp=trimEnd(pts,0.2);const prev=A.at(Math.max(0,A.tot-0.4)).p;
  return `<path d="${pd(tp)}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`+head(prev,end,c)}
function passSVG(a,b,c,w){const d=unit(sub(b,a));const a2=add(a,mul(d,0.5)),b2=add(b,mul(d,-0.5));if(dist(a,b)<1.1)return '';const pr=add(b2,mul(d,-0.3));
  return `<path d="${pd([a2,pr])}" stroke="${c}" stroke-width="${w}" stroke-dasharray="0.26 0.2" fill="none"/>`+head(pr,b2,c)}
function getMv(ph){return ph?(ph.alt?ph.alt[0].mv:(ph.mv||{})):{}}
function phasePositions(play,phMv){const out=[];const pos={};for(const k in play.start)pos[k]=V(play.start[k][0],play.start[k][1]);let hold=play.ball;
  play.phases.forEach((ph,i)=>{out.push({pos:Object.assign({},pos),hold});const mv=(phMv&&phMv[i])||getMv(ph);for(const k in mv){const p=mv[k].p;if(p&&p.length)pos[k]=V(p[p.length-1][0],p[p.length-1][1])}if(ph.pass)hold=ph.pass[1]});
  out.push({pos:Object.assign({},pos),hold});return out}
function phaseSVG(st,ph,mv,c,w){let h='';mv=mv||getMv(ph);
  for(const k in mv){const m=mv[k];if(!m.p||!m.p.length||!st.pos[k])continue;h+=moveSVG([st.pos[k]].concat(m.p.map(q=>V(q[0],q[1]))),m.k||'run',c,w)}
  if(ph&&ph.pass&&st.pos[ph.pass[0]]){const end=phEnd(st,mv);h+=passSVG(end[ph.pass[0]],end[ph.pass[1]],C.ink,w)}
  return h}
function phEnd(st,mv){const e=Object.assign({},st.pos);for(const k in mv){const p=mv[k].p;if(p&&p.length)e[k]=V(p[p.length-1][0],p[p.length-1][1])}return e}
function thumbSVG(play){const PP=phasePositions(play);let h=courtSVG();const n=play.phases.length;
  play.phases.forEach((ph,i)=>{h+=`<g opacity="${r2(0.45+0.55*(i+1)/n)}">${phaseSVG(PP[i],ph,null,C.ink,0.13)}</g>`});
  for(const k in play.start){const p=PP[0].pos[k];h+=`<circle cx="${BX(p.x)}" cy="${r2(p.y)}" r="0.58" fill="${C.off}" stroke="#fff" stroke-width="0.1"/>`+(k===play.ball?`<circle cx="${BX(p.x+0.55)}" cy="${r2(p.y-0.55)}" r="0.32" fill="#E8742A"/>`:'')}
  return `<svg viewBox="-0.4 -0.4 15.8 10.6" preserveAspectRatio="xMidYMid slice">${h}</svg>`}
function stepSVG(play,i,phMv){const PP=phasePositions(play,phMv);let h=courtSVG();
  for(let j=0;j<i;j++)h+=`<g opacity="0.22">${phaseSVG(PP[j],play.phases[j],phMv&&phMv[j],C.ink,0.12)}</g>`;
  h+=phaseSVG(PP[i],play.phases[i],phMv&&phMv[i],C.ink,0.13);
  const st=PP[i];for(const k in st.pos){h+=offTok(st.pos[k],NUM(k),{r:0.62})}
  const hp=st.pos[st.hold];if(hp)h+=ballTok(hp.x+0.5,hp.y-0.5,0.3);
  return `<svg viewBox="-0.4 -0.4 15.8 10.6" preserveAspectRatio="xMidYMid slice">${h}</svg>`}

// ---------------- 再生用の描画 ----------------
function ensureCourt(el){if(!el._court){el.innerHTML=courtSVG()+'<g class="dyn"></g>';el._court=true}return el.querySelector('.dyn')}
function frameIdx(res,t){const fr=res.frames;let lo=0,hi=fr.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(fr[m].t<=t)lo=m;else hi=m-1}return lo}
// 場所の価値（ゴール下と3Pラインの外が高く、ミドルは低い）
function locVal(p){const r=dist(p,HOOP);if(r<1.8)return 1;if(r<4.3)return 0.62;if(!is3(p))return 0.42;return r<8.4?0.88:0.25}
// 攻めやすさの地図：守備から離れていて、点になりやすい場所ほど濃い緑
function heatSVG(f){const ds=Object.values(f.d);if(!ds.length)return '';let h='';const st=0.7;
  for(let x=-7.15;x<=7.2;x+=st)for(let y=0.35;y<=10.4;y+=st){const p=V(x,y);let m=99;for(const d of ds){const dd=Math.hypot(d[0]-x,d[1]-y);if(dd<m)m=dd}
    const v=locVal(p)*clamp((m-1.1)/2.4,0,1);if(v>0.35)h+=`<rect x="${BX(x-st/2)}" y="${r2(y-st/2)}" width="${st}" height="${st}" fill="${C.go}" opacity="${r2((v-0.25)*0.5)}"/>`}
  return `<g filter="url(#hb)">${h}</g>`}
// 「ここ！」の吹き出し
function bubble(p,title,subt){const w=Math.max(title.length*0.4,(subt||'').length*0.3)+0.7,hh=subt?1.12:0.7;
  let y=p.y-0.78-hh;let below=false;if(y<0.05){y=p.y+0.78;below=true}
  const x=clamp(p.x-w/2,-7.4,7.4-w);const tipY=below?y:y+hh;const tipDir=below?-0.28:0.28;
  return `<g><path d="M${BX(p.x-0.2)} ${r2(tipY)}L${BX(p.x)} ${r2(tipY+tipDir)}L${BX(p.x+0.2)} ${r2(tipY)}Z" fill="${C.go}"/><rect x="${BX(x)}" y="${r2(y)}" width="${r2(w)}" height="${hh}" rx="0.28" fill="${C.go}"/>`+
    tx(BX(x+w/2),y+0.5,esc(title),0.38,'font-weight="800" fill="#fff"')+(subt?tx(BX(x+w/2),y+0.92,esc(subt),0.27,'fill="#E8FFF1"'):'')+`</g>`}
function chance(res,f){
  // これから起きる判断（パス・シュート）を先に知らせる
  for(const l of res.log){if(l.lv!==2||l.t<f.t-0.2||l.t>f.t+0.8)continue;let m;
    if((m=l.msg.match(/^(\d)→(\d) (\S+?)(?:｜([^｜]+))?｜/))){const dm=l.msg.match(/守備まで([\d.]+)m/);if(!dm||+dm[1]<2.0)continue;const why=m[4]&&!/守備まで/.test(m[4])?m[4]:m[3];return {to:'O'+m[2],from:'O'+m[1],title:'ここが空く！',sub:why}}
    if((m=l.msg.match(/^シュート：(\d) (\S+)/))&&l.msg.includes('ノーマーク'))return {to:'O'+m[1],title:'ここで打てる！',sub:m[2]}}
  return null}
function renderBoard(el,res,idx,o){o=o||{};const dyn=ensureCourt(el);const fr=res.frames;const f=fr[idx];if(!f){dyn.innerHTML='';return}
  let h='';const P=k=>V(f.o[k][0],f.o[k][1]);const ended=idx>=fr.length-1;
  const heat=o.heat!==false&&!o.playing&&!res.noDef&&!f.sh&&!ended&&(!$('heat')||$('heat').checked);
  if(heat)h+=heatSVG(f);
  // 予定の動き（いまのコマ）
  if(o.plan!==false&&f.ph<res.play.phases.length&&res.phStart[f.ph]!=null){const si=frameIdx(res,res.phStart[f.ph]);const sf=fr[si];
    const st={pos:{}};for(const k in sf.o)st.pos[k]=V(sf.o[k][0],sf.o[k][1]);
    h+=`<g opacity="0.32">${phaseSVG(st,res.play.phases[f.ph],res.phMv[f.ph],C.ink,0.08)}</g>`}
  // 動いた跡
  const tr=(get,c)=>{const pts=[];for(let i=Math.max(0,idx-40);i<=idx;i+=3)pts.push(get(fr[i]));pts.push(get(f));if(pts.length>2)h+=`<path d="${pd(pts)}" stroke="${c}" stroke-width="0.07" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`};
  for(const k in f.o)tr(x=>V(x.o[k][0],x.o[k][1]),'rgba(217,71,58,.38)');
  for(const id in f.d)tr(x=>V(x.d[id][0],x.d[id][1]),'rgba(47,109,181,.32)');
  // マークの線
  if(!res.zone&&!res.noDef)for(const id in f.d){const d=f.d[id];const t=P(d[4]);h+=`<path d="M${BX(d[0])} ${d[1]}L${BX(t.x)} ${r2(t.y)}" stroke="${d[2]?'rgba(245,197,24,.9)':'rgba(47,109,181,.45)'}" stroke-width="0.045" stroke-dasharray="0.14 0.12"/>`}
  // スクリーン
  const hk=f.h||(f.fl?f.fl[1]:null);
  for(const k of f.scr){const p=P(k);const to=hk&&f.o[hk]?P(hk):HOOP;const d=unit(sub(to,p));const n=V(-d.y,d.x);h+=`<path d="${pd([add(p,mul(n,0.62)),add(p,mul(n,-0.62))])}" stroke="${C.ink}" stroke-width="0.16" stroke-linecap="round"/>`}
  // 地図を消している時は、ノーマークを輪で示す
  if(!heat&&!res.noDef&&!f.sh&&!ended)for(const k in f.o){if(k===f.h)continue;const p=P(k);let m=99;for(const id in f.d){const dd=Math.hypot(f.d[id][0]-p.x,f.d[id][1]-p.y);if(dd<m)m=dd}
    if(m>=2.2)h+=`<circle cx="${BX(p.x)}" cy="${r2(p.y)}" r="0.9" fill="none" stroke="${C.go}" stroke-width="0.06" stroke-dasharray="0.18 0.14"/>`}
  // パス・シュート
  if(f.fl&&f.o[f.fl[1]]){const to=P(f.fl[1]);h+=`<path d="M${BX(f.fl[2])} ${f.fl[3]}L${BX(to.x)} ${r2(to.y)}" stroke="${C.ink}" stroke-width="0.07" stroke-dasharray="0.26 0.2"/>`}
  if(f.sh){const s=V(f.sh[0],f.sh[1]);h+=`<path d="M${BX(s.x)} ${s.y}Q${r2((BX(s.x)+7.5)/2)} ${r2(Math.min(s.y,HOOP.y)-1.4)} 7.5 ${HOOP.y}" stroke="${C.acc}" stroke-width="0.06" fill="none" stroke-dasharray="0.12 0.14"/>`}
  // 攻めどころ
  let ch=null;if(!res.noDef&&!ended&&!f.sh&&o.chance!==false)ch=chance(res,f);
  if(ch&&f.o[ch.to]){const p=P(ch.to);const r=0.72+0.12*Math.sin(f.t*9);h+=`<circle cx="${BX(p.x)}" cy="${r2(p.y)}" r="${r2(r)}" fill="rgba(23,152,90,.18)" stroke="${C.go}" stroke-width="0.09"/>`;
    const fromK=ch.from||f.h;if(fromK&&fromK!==ch.to&&f.o[fromK]&&!f.fl){const a=P(fromK);const d=unit(sub(p,a));const a2=add(a,mul(d,0.6)),b2=add(p,mul(d,-0.85));if(dist(a,p)>1.8)h+=`<path d="${pd([a2,b2])}" stroke="${C.go}" stroke-width="0.09" stroke-dasharray="0.3 0.18"/>`+head(add(b2,mul(d,-0.3)),b2,C.go,0.38)}}
  // 選手
  for(const id in f.d){const d=f.d[id];h+=defTok(V(d[0],d[1]),NUM(id),d[2],d[3])}
  for(const k in f.o)h+=offTok(P(k),NUM(k));
  // ボール
  if(f.h&&f.o[f.h]){const p=P(f.h);h+=ballTok(p.x+0.34,p.y-0.34)}else h+=ballTok(f.b[0],f.b[1]-f.b[2],0.2+f.b[2]*0.05);
  if(ch&&f.o[ch.to])h+=bubble(P(ch.to),ch.title,ch.sub);
  dyn.innerHTML=h;
}

// =====================================================================
//  作戦集
// =====================================================================
const DICT=[
 [/シューター|シュート力|3P|スリー|3ポイント|外から|ロング|外の|打てる/,'shooter','外のシュート'],
 [/ノーマーク|空け|フリーに|空いた/,'three','ノーマークを作る'],
 [/ドライブ|切り込|突破|抜き|速い|スピード|アタック|ペネトレ/,'drive','ドライブ'],
 [/センター|ビッグ|インサイド|ゴール下|ポスト|背が高|背の高|身長が高|高さ|長身|でかい|大きい選手|リバウンド|パワー/,'big','インサイド'],
 [/ゾーン|2-3|3-2|２－３|1-3-1/,'zone','ゾーン攻略'],
 [/ディナイ|パスが入らない|もらえない|ボールをもらえ|前をふさが|オーバープレ|厳しく|プレッシャー/,'backdoor','ディナイ対策'],
 [/残り|ラスト|最後|終盤|ブザー|逆転|同点|1本|確実|タイムアウト/,'clutch','終盤'],
 [/エース|1対1|１対１|アイソ|個人技/,'iso','1対1'],
 [/ピック|スクリーン|PnR|ピック&ロール|ピックアンドロール|ハンドオフ|ミスマッチ|スイッチ/,'pnr','スクリーン'],
 [/簡単|初心者|基本|シンプル|初めて|ミニバス|中学|覚えやす/,'basic','基本'],
 [/背が低|小さい|ガード中心|低身長|身長がない|小柄/,'small','小柄なチーム'],
 [/広が|スペース|5アウト|ファイブアウト|4アウト/,'spacing','スペーシング'],
 [/カット|合わせ|走り込|裏を/,'cut','カット']
];
let libCat='all';
function libScore(q){const tags={},hits=[];DICT.forEach(([re,t,l])=>{if(re.test(q)&&!tags[t]){tags[t]=1;hits.push(l)}});
  const list=PLAYS.map(p=>{let s=0;for(const t in tags)s+=(p.tags[t]||0);if(p.name.includes(q)||p.sub.includes(q))s+=4;if(tags.zone&&!p.zone)s-=2;if(!tags.zone&&p.zone&&Object.keys(tags).length)s-=1;return {p,s}});
  return {hits,list:list.filter(x=>x.s>0).sort((a,b)=>b.s-a.s)}}
function rowHTML(p,badge){return `<button class="row" data-id="${esc(p.id)}"><div class="th">${thumbSVG(p)}</div><div class="tx"><div class="ct">${esc(CATN[p.cat]||'')}</div><div class="nm">${esc(p.name)}${badge?`<span class="best">${badge}</span>`:''}</div><div class="sb">${esc(p.sub||'')}</div></div><svg class="ic chev"><use href="#i-chev"/></svg></button>`}
function renderLib(){
  const q=$('q').value.trim();$('sbox').classList.toggle('has',!!q);
  const cats=[{id:'all',name:'すべて',n:PLAYS.length}].concat(CATS.map(c=>({id:c.id,name:c.name,n:PLAYS.filter(p=>p.cat===c.id).length})));
  $('cats').innerHTML=cats.map(c=>`<button data-c="${c.id}" class="${libCat===c.id&&!q?'on':''}">${c.name}<b>${c.n}</b></button>`).join('');
  let items,hint='';
  if(q){const r=libScore(q);items=r.list.map(x=>x.p);hint=r.hits.length?'読み取った条件：'+r.hits.map(h=>`<span>${h}</span>`).join('・'):'';
    if(!items.length){hint='合う作戦が見つかりません。言い方を変えるか、カテゴリから探してください';items=[]}}
  else items=PLAYS.filter(p=>libCat==='all'||p.cat===libCat);
  $('qhint').innerHTML=hint;
  $('libcount').textContent=items.length+'件';
  $('list').innerHTML=items.map((p,i)=>rowHTML(p,q&&i===0?'おすすめ':'')).join('');
}
$('q').addEventListener('input',renderLib);
if(localStorage.getItem('sakusen.v2.guide')==='off')$('guide').style.display='none';
$('guidex').onclick=()=>{$('guide').style.display='none';try{localStorage.setItem('sakusen.v2.guide','off')}catch(e){}};
$('qx').onclick=e=>{e.preventDefault();$('q').value='';renderLib();$('q').focus()};
$('cats').onclick=e=>{const b=e.target.closest('button');if(!b)return;libCat=b.dataset.c;$('q').value='';renderLib()};
$('list').onclick=e=>{const b=e.target.closest('.row');if(b)go('/p/'+encodeURIComponent(b.dataset.id))};

// =====================================================================
//  画面切り替え
// =====================================================================
let curView='lib';
function showView(v){curView=v;document.querySelectorAll('.view').forEach(s=>s.classList.toggle('on',s.id==='v-'+v));
  const nav=v==='play'?(PB.from||'lib'):v;
  document.querySelectorAll('#tabs button,#bnav button').forEach(b=>b.classList.toggle('on',b.dataset.v===nav));
  if(v!=='play')pbPause();if(v!=='edit')edStopPreview();
  if(v==='lib')renderLib();if(v==='my')renderMy();if(v==='edit')edRenderAll();
  window.scrollTo(0,0)}
function go(h){if(location.hash==='#'+h)route();else location.hash=h}
document.querySelectorAll('#tabs button,#bnav button').forEach(b=>b.onclick=()=>go(b.dataset.v==='lib'?'/':'/'+b.dataset.v));
function findPlay(id){if(id==='__edit')return E.tmp;return PLAYS.find(p=>p.id===id)||myLoad().find(p=>p.id===id)}
function route(){const h=decodeURIComponent(location.hash.slice(1)||'/');let m;
  if((m=h.match(/^\/p\/(.+)$/))){const p=findPlay(m[1]);if(p)return showPlay(p);return go('/')}
  if(h.startsWith('/game'))return gameRoute(h);
  if(h.startsWith('/scout'))return scoutRoute(h);
  if(h==='/edit')return showView('edit');
  if(h==='/my')return showView('my');
  const legacy=PLAYS.find(p=>p.id===h.replace(/^\//,''));if(legacy)return go('/p/'+legacy.id);
  showView('lib')}
window.addEventListener('hashchange',route);

// =====================================================================
//  再生
// =====================================================================
const PB={play:null,res:null,t:0,playing:false,speed:1,seed:1,opt:{def:'man',cov:'auto',level:1},last:0,raf:0,fi:-1,li:-2,from:'lib'};
const ICON_PLAY='<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>',ICON_PAUSE='<svg viewBox="0 0 24 24"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>';
function showPlay(play){
  PB.from=window.__nextFrom||(play.id==='__edit'?'edit':(play.cat==='my'?'my':'lib'));window.__nextFrom=null;
  showView('play');PB.play=play;PB.seed=1;
  $('pcat').textContent=CATN[play.cat]||'';$('pname').textContent=play.name;$('psub').textContent=play.sub||'';
  const po=Object.assign({},PB.opt,window.__nextOpt||{});window.__nextOpt=null;
  $('sdef').value=play.zone?'zone':po.def;$('sdef').disabled=!!play.zone;
  $('scov').value=po.cov;$('slvl').value=po.level;
  syncCov();buildReads();$('an').innerHTML=anIntro();
  setPane('flow');pbRun(false);setTimeout(()=>{if(curView==='play'&&PB.play===play&&!PB.playing&&PB.t===0)pbPlay()},450);
}
function syncCov(){$('scov').disabled=$('sdef').value==='zone'}
function simOpt(){return {seed:PB.seed,def:PB.play.zone?'zone':$('sdef').value,cov:$('scov').value,level:+$('slvl').value}}
function pbRun(auto){pbPause();PB.res=simulate(PB.play,simOpt());PB.t=0;PB.fi=-1;PB.li=-2;buildFlow();buildSteps();buildMarks();pbDraw();if(auto)pbPlay()}
function pbPlay(){if(!PB.res)return;if(PB.t>=PB.res.dur-0.01){PB.t=0}PB.playing=true;PB.last=performance.now();$('pplay').innerHTML=ICON_PAUSE;cancelAnimationFrame(PB.raf);PB.raf=requestAnimationFrame(pbLoop)}
function pbPause(){PB.playing=false;cancelAnimationFrame(PB.raf);$('pplay').innerHTML=ICON_PLAY;if(PB.res&&curView==='play')pbDraw()}
function pbLoop(now){if(!PB.playing)return;const dt=Math.min(0.05,(now-PB.last)/1000);PB.last=now;PB.t=Math.min(PB.res.dur,PB.t+dt*PB.speed);pbDraw();if(PB.t>=PB.res.dur){pbPause();return}PB.raf=requestAnimationFrame(pbLoop)}
function pbDraw(){const res=PB.res;const idx=frameIdx(res,PB.t);renderBoard($('bd'),res,idx,{playing:PB.playing});
  const r=PB.t/res.dur;$('tfill').style.width=(r*100)+'%';$('tknob').style.left=(r*100)+'%';
  $('ptime').textContent=PB.t.toFixed(1)+' / '+res.dur.toFixed(1)+'秒';
  const end=PB.t>=res.dur-0.02;
  // 速報
  let li=-1;for(let i=0;i<res.log.length;i++){if(res.log[i].t<=PB.t+0.001)li=i;else break}
  const tst=$('toast');const e=res.log[li];
  if(e&&!end&&PB.t-e.t<2.2){tst.textContent=e.msg.replace(/^シュート：/,'');tst.className='toast on l'+e.lv}else tst.className='toast';
  // 結果
  const rc=$('rescard');
  if(end&&res.shot){const s=res.shot;$('rk').textContent=NUM(s.by)+'　'+s.kind;$('rs').textContent=s.q+'（守備まで'+Math.min(9,s.open).toFixed(1)+'m）・成功率'+Math.round(s.prob*100)+'%';$('rv').textContent=s.ev.toFixed(2);rc.classList.add('on')}else rc.classList.remove('on');
  if(li!==PB.li){PB.li=li;document.querySelectorAll('#flow li').forEach((x,i)=>{x.classList.toggle('fut',i>li);x.classList.toggle('cur',i===li)})}
  const f=res.frames[idx];if(f&&f.ph!==PB.fi){PB.fi=f.ph;document.querySelectorAll('#steps li').forEach((x,i)=>x.classList.toggle('on',i===f.ph))}
}
function buildFlow(){const res=PB.res;$('flow').innerHTML=res.log.map((l,i)=>`<li class="l${l.lv}" data-i="${i}"><span class="t">${l.t.toFixed(1)}</span><span>${esc(l.msg)}</span></li>`).join('')}
$('flow').onclick=e=>{const li=e.target.closest('li');if(!li)return;const l=PB.res.log[+li.dataset.i];PB.t=Math.max(0,l.t-0.4);pbDraw();pbPlay()};
function buildMarks(){const res=PB.res;$('tmk').innerHTML=res.log.filter(l=>l.lv>=1&&l.t>0).map(l=>`<i class="mk l${l.lv}" style="left:${(l.t/res.dur*100).toFixed(2)}%"></i>`).join('')}
function buildSteps(){const p=PB.play,res=PB.res;
  $('steps').innerHTML=p.phases.map((ph,i)=>`<li><span class="n">${i+1}</span><div class="d">${stepSVG(p,i,res.phMv)}</div><div class="x">${esc(ph.alt&&res.phMv[i]?(ph.alt.find(a=>a.mv===res.phMv[i])||ph).t:ph.t)}</div></li>`).join('')+
  `<li><span class="n">${p.phases.length+1}</span><div class="x">ここからは守備の動きを見て判断。シュート、パス、ドライブ、もう一度スクリーン</div></li>`;PB.fi=-1}
function buildReads(){const p=PB.play;let h='';
  if(p.reads&&p.reads.length)h+=`<div class="cap">守備の対応と狙い</div><div class="rd">${p.reads.map(r=>`<div class="a">${esc(r[0])}</div><div>${esc(r[1])}</div>`).join('')}</div>`;
  if(p.tips&&p.tips.length)h+=`<div class="cap">ポイント</div><ul class="tips">${p.tips.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`;
  h+=`<div class="cap">スクリーンへの守備の対応</div><div class="covs">${COV_LIST.map(c=>`<div><b>${COV[c]}</b>：${COV_D[c]}</div>`).join('')}</div>`;
  if(p.cat==='my'&&p.sub)h=`<div class="cap">メモ</div><p style="margin:0;font-size:13px">${esc(p.sub)}</p>`+h;
  $('reads').innerHTML=h}
function setPane(v){document.querySelectorAll('#ptabs button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));document.querySelectorAll('.pane').forEach(p=>p.classList.toggle('on',p.id==='pane-'+v))}
$('ptabs').onclick=e=>{const b=e.target.closest('button');if(b)setPane(b.dataset.v)};
$('pplay').onclick=()=>{if(PB.playing)pbPause();else pbPlay()};
$('prestart').onclick=()=>{PB.t=0;pbDraw();pbPlay()};
$('pagain').onclick=()=>{PB.seed=(PB.seed*7919+13)%100000+1;pbRun(true)};
['sdef','scov','slvl'].forEach(id=>$(id).onchange=()=>{if(id==='sdef')PB.opt.def=$('sdef').value;if(id==='scov')PB.opt.cov=$('scov').value;if(id==='slvl')PB.opt.level=+$('slvl').value;syncCov();$('an').innerHTML=anIntro();pbRun(true)});
$('heat').onchange=()=>pbDraw();
$('pspeed').onclick=e=>{const b=e.target.closest('button');if(!b)return;PB.speed=+b.dataset.v;$('pspeed').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b))};
$('pback').onclick=()=>go(PB.from==='lib'?'/':PB.from==='scout'?(window.__scoutBack||'/scout'):'/'+PB.from);
$('pedit').onclick=()=>{edFromPlay(PB.play);go('/edit')};
(function(){const tr=$('track');let drag=false;const seek=e=>{const r=tr.getBoundingClientRect();PB.t=clamp((e.clientX-r.left)/r.width,0,1)*PB.res.dur;pbDraw()};
  tr.addEventListener('pointerdown',e=>{drag=true;tr.setPointerCapture(e.pointerId);pbPause();seek(e)});
  tr.addEventListener('pointermove',e=>{if(drag)seek(e)});
  tr.addEventListener('pointerup',()=>{drag=false})})();
document.addEventListener('keydown',e=>{if(curView!=='play'||/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))return;
  if(e.code==='Space'){e.preventDefault();PB.playing?pbPause():pbPlay()}
  if(e.code==='ArrowRight'){PB.t=Math.min(PB.res.dur,PB.t+0.5);pbDraw()}
  if(e.code==='ArrowLeft'){PB.t=Math.max(0,PB.t-0.5);pbDraw()}});

// =====================================================================
//  分析（60回試す）
// =====================================================================
function anIntro(){const zone=PB.play&&(PB.play.zone||$('sdef').value==='zone');const auto=$('scov').value==='auto';
  const how=zone?'2-3ゾーン相手に60回':auto?'5種類のスクリーン対応を12回ずつ、計60回':COV[$('scov').value]+'で60回';
  return `<div class="an-top"><p>${how}試して、期待得点とシュートの内訳を出します。</p><button class="btn sm fill" id="anrun"><svg class="ic"><use href="#i-chart"/></svg>60回試す</button></div><div class="prog" id="anprog"><i></i></div><div id="anres"></div>`}
document.addEventListener('click',e=>{if(e.target.closest('#anrun'))runAnalysis()});
let anBusy=false;
async function runAnalysis(){if(anBusy)return;anBusy=true;const play=PB.play;const zone=play.zone||$('sdef').value==='zone';const cov=$('scov').value;const lvl=+$('slvl').value;
  const groups=zone?[{c:'zone',n:60}]:(cov==='auto'?COV_LIST.map(c=>({c,n:12})):[{c:cov,n:60}]);
  const prog=$('anprog');prog.classList.add('on');const bar=prog.firstChild;const all=[],by={};let done=0;
  for(const g of groups){by[g.c]=[];const seeds=trialSeeds(g.n,31+groups.indexOf(g));
    for(let i=0;i<seeds.length;i++){const r=simulate(play,{seed:seeds[i],def:zone?'zone':'man',cov:g.c==='zone'?'auto':g.c,level:lvl,record:false});all.push(r);by[g.c].push(r);done++;
      if(done%6===0){bar.style.width=(done/60*100)+'%';await new Promise(r=>setTimeout(r,0))}}}
  bar.style.width='100%';
  const s=summarize(all);let h='';
  h+=`<div class="kpi"><div><b>${s.ppp.toFixed(2)}</b><small>期待得点／回</small></div><div><b>${Math.round(s.open*100)}<span style="font-size:14px">%</span></b><small>ノーマークで打てた</small></div><div><b>${s.t.toFixed(1)}<span style="font-size:14px">秒</span></b><small>シュートまで</small></div></div>`;
  const tot=Math.max(1,s.shots.length);const z=[['ゴール下・近距離',s.zone.rim,C.ink],['ミドル',s.zone.mid,C.def],['3P',s.zone.three,C.acc]];
  h+=`<div class="cap">シュートの内訳</div><div class="mix">${z.filter(x=>x[1]).map(x=>`<i style="width:${x[1]/tot*100}%;background:${x[2]}"></i>`).join('')}</div><div class="mixl">${z.map(x=>`<span><i style="background:${x[2]}"></i>${x[0]} ${Math.round(x[1]/tot*100)}%</span>`).join('')}</div>`;
  if(groups.length>1){const rows=groups.map(g=>({c:g.c,v:summarize(by[g.c]).ppp}));const mx=Math.max(...rows.map(r=>r.v),0.01);
    h+=`<div class="cap">スクリーンへの対応ごとの期待得点</div><div class="bars">${rows.map(r=>`<div class="bar1"><span>${COV[r.c]}</span><div class="tr"><i style="width:${r.v/mx*100}%" class="${r.v===mx?'acc':''}"></i></div><span class="v">${r.v.toFixed(2)}</span></div>`).join('')}</div>`;
    const srt=rows.slice().sort((a,b)=>b.v-a.v);
    h+=srt[0].v-srt[srt.length-1].v<0.06?`<div class="verdict">スクリーンへの対応による差は小さい作戦です。</div>`:`<div class="verdict">効きやすい相手：<b>${COV[srt[0].c]}</b>（${srt[0].v.toFixed(2)}点）<br>苦手な相手：<b>${COV[srt[srt.length-1].c]}</b>（${srt[srt.length-1].v.toFixed(2)}点）</div>`}
  const byP=Object.entries(s.by).sort((a,b)=>b[1]-a[1]);
  h+=`<div class="cap">シュートを打った選手</div><div class="bars">${byP.map(([k,n])=>`<div class="bar1"><span>${NUM(k)}</span><div class="tr"><i style="width:${n/tot*100}%"></i></div><span class="v">${Math.round(n/tot*100)}%</span></div>`).join('')}</div>`;
  const ks=Object.entries(s.kinds).sort((a,b)=>b[1]-a[1]).slice(0,6);
  h+=`<div class="cap">シュートの種類</div><div class="bars">${ks.map(([k,n])=>`<div class="bar1"><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(k)}</span><div class="tr"><i style="width:${n/tot*100}%" class="acc"></i></div><span class="v">${n}回</span></div>`).join('')}</div>`;
  h+=`<div class="cap">シュートの位置</div><div class="chart"><svg viewBox="-0.4 -0.4 15.8 10.6">${courtSVG()}${s.shots.map(x=>{const c=x.open>=2.2?C.go:x.open>=1.3?C.acc:C.warn;return `<circle cx="${BX(x.pos.x)}" cy="${r2(x.pos.y)}" r="0.26" fill="${c}" opacity="0.85"/>`}).join('')}</svg></div>
  <div class="mixl"><span><i style="background:${C.go}"></i>ノーマーク</span><span><i style="background:${C.acc}"></i>少し余裕あり</span><span><i style="background:${C.warn}"></i>守備が目の前</span></div>
  <p class="mini">期待得点＝シュートの成功率×点数の平均。ターンオーバー、ファウル、リバウンドは含みません。成功率は守備との距離とシュートの種類から見積もっています。</p>`;
  $('anres').innerHTML=h;setTimeout(()=>prog.classList.remove('on'),400);anBusy=false}

// =====================================================================
//  作成（エディタ）
// =====================================================================
const STORE='sakusen.v2.my',DRAFT='sakusen.v2.draft';
function myLoad(){try{return JSON.parse(localStorage.getItem(STORE))||[]}catch(e){return []}}
function mySave(list){try{localStorage.setItem(STORE,JSON.stringify(list))}catch(e){snack('保存できませんでした')}}
const E={p:null,cur:0,tool:'run',hist:[],stroke:null,drag:null,prev:null,tmp:null};
function blankPlay(){return {id:'u'+Date.now().toString(36),name:'',memo:'',start:{O1:[0,8.6],O2:[-5.4,6.4],O3:[5.4,6.4],O4:[-6.9,0.9],O5:[2.6,2.0]},ball:'O1',phases:[{t:'',mv:{},dec:0}]}}
function edLoadDraft(){try{const d=JSON.parse(localStorage.getItem(DRAFT));if(d&&d.start)return d}catch(e){}return blankPlay()}
function edDraft(){try{localStorage.setItem(DRAFT,JSON.stringify(E.p))}catch(e){}}
function edPush(){E.hist.push(JSON.stringify(E.p));if(E.hist.length>60)E.hist.shift()}
function edFromPlay(play){
  if(play.id==='__edit')return;
  const mine=play.cat==='my'&&myLoad().some(x=>x.id===play.id);
  const src=mine?myLoad().find(x=>x.id===play.id):null;
  if(src){E.p=JSON.parse(JSON.stringify(src))}
  else{E.p={id:'u'+Date.now().toString(36),name:play.name+'（アレンジ）',memo:play.sub||'',start:JSON.parse(JSON.stringify(play.start)),ball:play.ball,
    phases:play.phases.map(ph=>({t:ph.t||'',mv:JSON.parse(JSON.stringify(getMv(ph))),pass:ph.pass?ph.pass.slice():undefined,ho:ph.ho?1:0,dec:ph.dec?1:0}))}}
  E.cur=0;E.hist=[];edDraft()}
function holderAt(p,i){let h=p.ball;for(let j=0;j<i;j++){if(p.phases[j].pass)h=p.phases[j].pass[1]}return h}
function autoDesc(ph,holder){const parts=[];const mv=ph.mv||{};
  for(const k in mv){const m=mv[k];const e=m.p&&m.p.length?m.p[m.p.length-1]:null;const toRim=e&&Math.hypot(e[0]-HOOP.x,e[1]-HOOP.y)<3;parts.push(NUM(k)+(m.k==='scr'?'がスクリーン':m.k==='drib'?(toRim?'がゴールへドライブ':'がドリブル'):(toRim?'がゴールへ':'が移動')))}
  if(ph.pass)parts.push(NUM(ph.pass[0])+'から'+NUM(ph.pass[1])+'へ'+(ph.ho?'手渡し':'パス'));
  return parts.join('、')||'動きなし'}
function edToPlay(){const p=JSON.parse(JSON.stringify(E.p));
  const phases=p.phases.filter((ph,i)=>Object.keys(ph.mv||{}).length||ph.pass||i===0);
  let hold=p.ball;phases.forEach(ph=>{if(!ph.t)ph.t=autoDesc(ph,hold);if(ph.pass)hold=ph.pass[1];if(!ph.pass)delete ph.pass});
  if(!phases.some(ph=>ph.dec))phases[phases.length-1].dec=1;
  return {id:p.id,cat:'my',name:p.name||'名前のない作戦',sub:p.memo||'',tags:{},start:p.start,ball:p.ball,phases,reads:[],tips:[]}}
function edRenderAll(){if(!E.p)E.p=edLoadDraft();if(E.cur>=E.p.phases.length)E.cur=E.p.phases.length-1;
  $('ename').value=E.p.name||'';$('ememo').value=E.p.memo||'';edFrames();edTools();edActs();edRender()}
function edFrames(){const n=E.p.phases.length;
  $('frames').innerHTML=`<span class="lb">コマ</span>`+E.p.phases.map((_,i)=>`<button class="f${i===E.cur?' on':''}" data-i="${i}">${i+1}</button>`).join('')+(n<8?`<button class="add" id="fadd" aria-label="コマを追加"><svg class="ic" style="width:16px;height:16px"><use href="#i-plus"/></svg></button>`:'')+
  `<span class="sp"></span>${n>1?`<button class="btn sm" id="fdel"><svg class="ic"><use href="#i-trash"/></svg>このコマを削除</button>`:''}`}
$('frames').onclick=e=>{const b=e.target.closest('button');if(!b)return;
  if(b.id==='fadd'){edPush();E.p.phases.push({t:'',mv:{},dec:0});E.cur=E.p.phases.length-1;edDraft();edRenderAll();return}
  if(b.id==='fdel'){edPush();E.p.phases.splice(E.cur,1);E.cur=Math.max(0,E.cur-1);edDraft();edRenderAll();return}
  if(b.dataset.i!=null){E.cur=+b.dataset.i;edRenderAll()}};
const HINT={place:'選手をドラッグして最初の位置を決めます（コマ1のみ）',run:'選手から指でなぞって、走るコースを描きます',drib:'ボールを持つ選手からなぞって、ドリブルのコースを描きます',scr:'選手からなぞって、スクリーンをかける位置まで描きます',pass:'パスの受け手をタップします。出し手はボールを持っている選手です',ball:'最初にボールを持つ選手をタップします（コマ1のみ）'};
function edTools(){document.querySelectorAll('#tools button').forEach(b=>b.classList.toggle('on',b.dataset.v===E.tool));edHint(HINT[E.tool])}
function edHint(m,warn){const h=$('ehint');h.textContent=m;h.classList.toggle('warn',!!warn)}
$('tools').onclick=e=>{const b=e.target.closest('button');if(!b)return;E.tool=b.dataset.v;if((E.tool==='place'||E.tool==='ball')&&E.cur!==0){E.cur=0;edRenderAll();return}edTools()};
function edActs(){const ph=E.p.phases[E.cur];const mv=ph.mv||{};$('eftitle').textContent='コマ'+(E.cur+1)+'の動き';
  const ds=[[0,'すぐ'],[0.3,'0.3秒後'],[0.6,'0.6秒後'],[1,'1秒後']],ss=[['','普通'],[3.2,'ゆっくり'],[6.4,'全力']];
  let h=Object.keys(mv).sort().map(k=>{const m=mv[k];return `<div class="act" data-k="${k}"><span class="who">${NUM(k)}</span><span class="k">${KIND[m.k||'run']}</span>
    <select data-f="d">${ds.map(d=>`<option value="${d[0]}"${(m.d||0)==d[0]?' selected':''}>${d[1]}</option>`).join('')}</select>
    ${m.k==='scr'?'':`<select data-f="s">${ss.map(s=>`<option value="${s[0]}"${(m.s||'')==s[0]?' selected':''}>${s[1]}</option>`).join('')}</select>`}
    <button class="del" data-del="${k}" aria-label="削除"><svg class="ic"><use href="#i-x"/></svg></button></div>`}).join('');
  if(ph.pass)h+=`<div class="act" data-k="pass"><span class="who">${NUM(ph.pass[0])}</span><span class="k">→ ${NUM(ph.pass[1])}</span><select data-f="ho"><option value="0"${ph.ho?'':' selected'}>パス</option><option value="1"${ph.ho?' selected':''}>手渡し</option></select><button class="del" data-del="pass" aria-label="削除"><svg class="ic"><use href="#i-x"/></svg></button></div>`;
  if(!h)h=`<div style="font-size:12.5px;color:var(--sub);padding:4px 2px">まだ動きがありません。下のボードで選手からなぞってください。</div>`;
  $('eacts').innerHTML=h;$('edesc').value=ph.t||'';$('edesc').placeholder=Object.keys(mv).length||ph.pass?autoDesc(ph):'このコマの説明（空欄なら自動で作成）';
  $('edec').classList.toggle('on',!!ph.dec)}
$('eacts').onclick=e=>{const d=e.target.closest('[data-del]');if(!d)return;edPush();const ph=E.p.phases[E.cur];if(d.dataset.del==='pass'){delete ph.pass;ph.ho=0}else delete ph.mv[d.dataset.del];edDraft();edActs();edRender()};
$('eacts').onchange=e=>{const s=e.target;const row=s.closest('.act');if(!row)return;edPush();const ph=E.p.phases[E.cur];const k=row.dataset.k;
  if(s.dataset.f==='ho'){ph.ho=+s.value}else{const m=ph.mv[k];const v=s.value===''?undefined:+s.value;if(v===undefined||v===0&&s.dataset.f==='d')delete m[s.dataset.f];else m[s.dataset.f]=v}
  edDraft();edActs();edRender()};
$('edesc').oninput=()=>{E.p.phases[E.cur].t=$('edesc').value;edDraft()};
$('edecw').onclick=e=>{e.preventDefault();edPush();const ph=E.p.phases[E.cur];ph.dec=ph.dec?0:1;edDraft();edActs()};
$('ename').oninput=()=>{E.p.name=$('ename').value;edDraft()};
$('ememo').oninput=()=>{E.p.memo=$('ememo').value;edDraft()};
$('eundo').onclick=()=>{const s=E.hist.pop();if(!s){snack('これ以上戻せません');return}E.p=JSON.parse(s);edDraft();edRenderAll()};
$('enew').onclick=()=>{if(Object.keys(E.p.phases[0].mv).length&&!confirm('作成中の作戦を消して、新しく作りますか？'))return;E.p=blankPlay();E.cur=0;E.hist=[];edDraft();edRenderAll()};
$('esave').onclick=()=>{const list=myLoad();const p=E.p;if(!p.name){p.name='名前のない作戦';$('ename').value=p.name}p.updated=Date.now();
  const i=list.findIndex(x=>x.id===p.id);if(i>=0)list[i]=JSON.parse(JSON.stringify(p));else list.unshift(JSON.parse(JSON.stringify(p)));mySave(list);edDraft();snack('マイ作戦に保存しました')};
$('etest').onclick=()=>{edStopPreview();E.tmp=Object.assign(edToPlay(),{id:'__edit'});go('/p/__edit')};
$('eprev').onclick=()=>{if(E.prev){edStopPreview();return}const res=simulate(edToPlay(),{noDef:true,seed:1});E.prev={res,t:0,last:performance.now()};$('eprev').lastChild.textContent='止める';
  const loop=now=>{if(!E.prev)return;const pv=E.prev;pv.t=Math.min(pv.res.dur,pv.t+Math.min(0.05,(now-pv.last)/1000));pv.last=now;renderBoard($('ed'),pv.res,frameIdx(pv.res,pv.t),{plan:false});
    if(pv.t>=pv.res.dur){setTimeout(()=>{if(E.prev===pv)edStopPreview()},700);return}pv.raf=requestAnimationFrame(loop)};E.prev.raf=requestAnimationFrame(loop)};
function edStopPreview(){if(!E.prev)return;cancelAnimationFrame(E.prev.raf);E.prev=null;$('eprev').lastChild.textContent='動きを確認';$('ed')._court=false;if(E.p)edRender()}
function edRender(){if(E.prev)return;const svg=$('ed');svg._court=false;const p=E.p;const PP=phasePositions(p);const st=PP[E.cur];let h=courtSVG();
  for(let j=0;j<E.cur;j++)h+=`<g opacity="0.2">${phaseSVG(PP[j],p.phases[j],null,C.ink,0.08)}</g>`;
  h+=phaseSVG(st,p.phases[E.cur],null,C.ink,0.09);
  const mv=p.phases[E.cur].mv||{};for(const k in mv){const q=mv[k].p;if(q&&q.length){const e=q[q.length-1];h+=`<circle cx="${BX(e[0])}" cy="${e[1]}" r="0.36" fill="none" stroke="rgba(38,33,28,.55)" stroke-width="0.05" stroke-dasharray="0.12 0.1"/>`}}
  if(E.stroke&&E.stroke.pts.length>1)h+=`<path d="${pd(E.stroke.pts)}" stroke="${C.acc}" stroke-width="0.1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  for(const k in st.pos)h+=offTok(st.pos[k],NUM(k));
  const hp=st.pos[st.hold];if(hp)h+=ballTok(hp.x+0.32,hp.y-0.32);
  svg.innerHTML=h}
function toCourt(svg,e){const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const q=pt.matrixTransform(svg.getScreenCTM().inverse());return V(clamp(q.x-7.5,-7.3,7.3),clamp(q.y,0.25,11.2))}
function rdp(pts,eps){if(pts.length<3)return pts;const a=pts[0],b=pts[pts.length-1];let md=0,mi=0;for(let i=1;i<pts.length-1;i++){const d=segDist(pts[i],a,b).d;if(d>md){md=d;mi=i}}
  if(md>eps){const l=rdp(pts.slice(0,mi+1),eps),r=rdp(pts.slice(mi),eps);return l.slice(0,-1).concat(r)}return [a,b]}
(function(){const svg=$('ed');
  const hit=(p,st)=>{let best=null,bd=0.85;for(const k in st.pos){const d=dist(st.pos[k],p);if(d<bd){bd=d;best=k}}return best};
  svg.addEventListener('pointerdown',e=>{if(E.prev)return;const p=E.p;const PP=phasePositions(p);const st=PP[E.cur];const c=toCourt(svg,e);const k=hit(c,st);
    if(E.tool==='ball'){if(k){edPush();p.ball=k;edDraft();edRender();edActs()}return}
    if(E.tool==='pass'){if(!k)return;const h=holderAt(p,E.cur);if(k===h){edHint('ボールを持っている選手です。受け手をタップしてください',true);return}edPush();const ph=p.phases[E.cur];
      if(ph.pass&&ph.pass[1]===k){delete ph.pass;ph.ho=0}else{ph.pass=[h,k];const e2=phEnd(st,ph.mv);ph.ho=dist(e2[h],e2[k])<1.6?1:0}edDraft();edActs();edRender();edHint(HINT.pass);return}
    if(!k)return;e.preventDefault();svg.setPointerCapture(e.pointerId);
    if(E.tool==='place'){edPush();E.drag={k};return}
    E.stroke={k,pts:[st.pos[k]]}});
  svg.addEventListener('pointermove',e=>{if(E.drag){const c=toCourt(svg,e);E.p.start[E.drag.k]=[r2(c.x),r2(c.y)];edRender();return}
    if(E.stroke){const c=toCourt(svg,e);const pts=E.stroke.pts;if(dist(pts[pts.length-1],c)>0.18){pts.push(c);edRender()}}});
  const up=()=>{if(E.drag){E.drag=null;edDraft();edRender();return}
    if(!E.stroke)return;const s=E.stroke;E.stroke=null;const A=along(s.pts);
    if(A.tot<0.6){edRender();return}
    let eps=0.22,pts=rdp(s.pts,eps);while(pts.length>7){eps*=1.5;pts=rdp(s.pts,eps)}
    edPush();const ph=E.p.phases[E.cur];let kind=E.tool;
    if(kind==='drib'&&s.k!==holderAt(E.p,E.cur)){kind='run';edHint('ドリブルはボールを持つ選手だけです。移動として記録しました',true)}else edHint(HINT[E.tool]);
    ph.mv[s.k]={p:pts.slice(1).map(q=>[r2(q.x),r2(q.y)]),k:kind};if(kind==='run')delete ph.mv[s.k].k;
    edDraft();edActs();edRender()};
  svg.addEventListener('pointerup',up);svg.addEventListener('pointercancel',up)})();

// =====================================================================
//  マイ作戦
// =====================================================================
function renderMy(){const list=myLoad();$('mycount').textContent=list.length+'件';
  if(!list.length){$('mylist').innerHTML=`<div class="empty" style="grid-column:1/-1">保存した作戦はありません。<br><button class="btn" onclick="go('/edit')"><svg class="ic"><use href="#i-pen"/></svg>作戦を作る</button></div>`;return}
  $('mylist').innerHTML=list.map(p=>{const pl=Object.assign(edToPlayFrom(p));if(!pl.sub){const d=new Date(p.updated||Date.now());pl.sub='コマ'+pl.phases.length+'・'+(d.getMonth()+1)+'月'+d.getDate()+'日に保存'}return `<div class="myrow">${rowHTML(pl)}<button class="ibtn" data-ed="${esc(p.id)}" aria-label="編集"><svg class="ic"><use href="#i-pen"/></svg></button><button class="ibtn" data-rm="${esc(p.id)}" aria-label="削除"><svg class="ic"><use href="#i-trash"/></svg></button></div>`}).join('')}
function edToPlayFrom(p){const keep=E.p;E.p=p;const r=edToPlay();E.p=keep;return r}
const _myLoad=myLoad;
$('mylist').onclick=e=>{const ed=e.target.closest('[data-ed]'),rm=e.target.closest('[data-rm]'),row=e.target.closest('.row');
  if(ed){const p=myLoad().find(x=>x.id===ed.dataset.ed);if(p){E.p=JSON.parse(JSON.stringify(p));E.cur=0;E.hist=[];edDraft();go('/edit')}return}
  if(rm){const p=myLoad().find(x=>x.id===rm.dataset.rm);if(p&&confirm('「'+p.name+'」を削除しますか？元に戻せません。')){mySave(myLoad().filter(x=>x.id!==p.id));renderMy();snack('削除しました')}return}
  if(row)go('/p/'+encodeURIComponent(row.dataset.id))};
// マイ作戦は再生用に変換して返す
function findMy(id){const p=myLoad().find(x=>x.id===id);return p?edToPlayFrom(p):null}
findPlay=function(id){if(id==='__edit')return E.tmp;return PLAYS.find(p=>p.id===id)||findMy(id)};

// =====================================================================
//  アプリ化（PWA）
// =====================================================================
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('install').classList.add('on')});
const standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone;
if(/iPhone|iPad|iPod/.test(navigator.userAgent)&&!standalone)$('install').classList.add('on');
$('install').onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('install').classList.remove('on')}else alert('ブラウザのメニュー（iPhoneはSafariの共有ボタン）から「ホーム画面に追加」を選んでください')};

E.p=edLoadDraft();
window.addEventListener('DOMContentLoaded',route);
