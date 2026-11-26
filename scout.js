'use strict';
// =====================================================================
//  スカウト（動画を見ながら相手を記録し、傾向と効く作戦を出す）
// =====================================================================
const SSTORE='sakusen.v2.scouts';
const sLoad=()=>{try{return JSON.parse(localStorage.getItem(SSTORE))||[]}catch(e){return []}};
const sPut=l=>{try{localStorage.setItem(SSTORE,JSON.stringify(l))}catch(e){snack('保存できませんでした')}};
let SC=null,sMode='list',sSide='o',sTab='o',sD={},sVid=null,sVidName='',sCache={},sBusy=false;
const OTYPES=['ピック&ロール','ハンドオフ','オフボールスクリーン','ポストアップ','アイソ','カット','スポットアップ','トランジション','リバウンドから','その他'];
const ORES=[['2o','2P成功',2],['2x','2P失敗',0],['a2','2P成功＋FT',3],['3o','3P成功',3],['3x','3P失敗',0],['a3','3P成功＋FT',4],['f1','FT 1点',1],['f2','FT 2点',2],['f3','FT 3点',3],['f0','FT 0点',0],['to','ターンオーバー',0]];
const shotOf=r=>r[0]==='2'||r==='a2'?'2':r[0]==='3'||r==='a3'?'3':null;const madeOf=r=>r==='2o'||r==='3o'||r==='a2'||r==='a3';
const DTYPES=['マンツーマン','2-3ゾーン','3-2ゾーン','1-3-1ゾーン','ボックスワン','マンツーマンのプレス','ゾーンプレス'];
const DCOV=[['drop','ドロップ'],['hedge','ショウ'],['switch','スイッチ'],['blitz','ブリッツ'],['under','アンダー'],['none','スクリーンなし']];
const DRES=[['0','0点',0],['1','1点',1],['2','2点',2],['3','3点',3],['to','ターンオーバー',0]];
const isZone=d=>/ゾーン|ボックス/.test(d||'');
function sSave(){if(!SC)return;SC.updated=Date.now();const l=sLoad();const i=l.findIndex(x=>x.id===SC.id);if(i>=0)l[i]=SC;else l.unshift(SC);sPut(l)}
const fmtV=t=>t==null?'—':Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');

function scoutRoute(h){showView('scout');let m;
  if(h==='/scout/new'){SC={id:'s'+Date.now().toString(36),name:'',ev:[],seq:0};sSave();return go('/scout/'+SC.id)}
  if((m=h.match(/^\/scout\/([^/]+)$/))){const s=sLoad().find(x=>x.id===m[1]);if(!s)return go('/scout');if(!SC||SC.id!==s.id){sD={};sCache={}}SC=s;sMode='detail'}
  else sMode='list';
  sRender()}
function sRender(){if(sMode==='list')return sList();sDetail()}

// ---------------- 一覧 ----------------
function sList(){const l=sLoad();
  $('scout').innerHTML=`<div class="gtop"><h1>スカウト</h1><button class="btn sm fill" id="snew"><svg class="ic"><use href="#i-plus"/></svg>新しい相手</button></div>`+
  (l.length?`<div class="glist">${l.map(s=>{const o=s.ev.filter(e=>e.side==='o').length,d=s.ev.length-o;const dt=new Date(s.updated||Date.now());
    return `<button class="grow" data-id="${esc(s.id)}"><div class="tx"><b>${esc(s.name||'名前のない相手')}</b><small>攻撃${o}回・守備${d}回を記録　${dt.getMonth()+1}月${dt.getDate()}日に更新</small></div><svg class="ic chev" style="color:var(--faint);width:16px"><use href="#i-chev"/></svg></button>`}).join('')}</div>`
  :`<div class="empty">記録した相手はいません。<br><button class="btn" id="snew2"><svg class="ic"><use href="#i-plus"/></svg>相手を追加する</button></div>`)+
  `<p class="note">相手チームの試合動画を再生しながら、攻撃の形・結果と、守り方・スクリーンへの対応をタップで記録します。記録から相手の傾向をまとめ、作戦集の28戦術をその守り方に当てて効く作戦を順位づけします。動画はこの端末で再生するだけで、保存も送信もしません（動画のファイル名と再生位置は記録に残ります）。</p>`;
  const nw=()=>go('/scout/new');if($('snew'))$('snew').onclick=nw;if($('snew2'))$('snew2').onclick=nw;
  $('scout').querySelectorAll('.grow').forEach(b=>b.onclick=()=>go('/scout/'+b.dataset.id))}

// ---------------- 詳細 ----------------
function sDetail(){
  $('scout').innerHTML=`<div class="gtop"><button id="sback" aria-label="一覧へ" style="width:36px;height:36px;border-radius:10px;border:1px solid var(--line);display:grid;place-items:center;color:var(--sub);flex:none"><svg class="ic"><use href="#i-back"/></svg></button>
     <input class="inp" id="sname" placeholder="相手チーム名" value="${esc(SC.name)}" maxlength="30" style="flex:1;font-size:16px;font-weight:700;height:40px">
     <button class="btn sm" id="sdel"><svg class="ic"><use href="#i-trash"/></svg>削除</button></div>
   <div class="scgrid"><div><div id="svwrap"></div><div class="card tblock"><h3>記録<small id="scount"></small></h3><div id="srecs"></div></div></div>
     <div><div class="card"><div class="seg2" id="sside"><button data-v="o">相手の攻撃</button><button data-v="d">相手の守備</button></div><div id="stag"></div></div></div></div>
   <div class="gtabs" id="stabs"><button data-v="o">攻撃の傾向</button><button data-v="d">守備の傾向</button><button data-v="r">効く作戦</button></div><div id="ssum"></div>`;
  $('sback').onclick=()=>go('/scout');
  $('sname').oninput=()=>{SC.name=$('sname').value;sSave()};
  $('sdel').onclick=()=>{if(confirm('「'+(SC.name||'名前のない相手')+'」の記録を削除しますか？元に戻せません。')){sPut(sLoad().filter(x=>x.id!==SC.id));SC=null;go('/scout')}};
  $('sside').onclick=e=>{const b=e.target.closest('button');if(!b)return;sSide=b.dataset.v;sTagUI()};
  $('stabs').onclick=e=>{const b=e.target.closest('button');if(!b)return;sTab=b.dataset.v;sSum()};
  sVideoUI();sTagUI();sRecs();sSum()}
function sVideoUI(){const w=$('svwrap');
  if(!sVid){w.innerHTML=`<label class="vpick"><svg class="ic"><use href="#i-film"/></svg><b>試合の動画を開く</b>端末の中の動画を再生します。動画は保存・送信しません<input type="file" accept="video/*" id="svf" hidden></label><p class="mini" style="margin-top:8px">動画なしでも記録できます（時間は記録されません）。</p>`;
    $('svf').onchange=e=>{const f=e.target.files[0];if(!f)return;sVid=document.createElement('video');sVid.src=URL.createObjectURL(f);sVid.controls=false;sVid.playsInline=true;sVid.preload='metadata';sVidName=f.name;
      sVid.addEventListener('timeupdate',()=>{const t=$('svt');if(t)t.textContent=fmtV(sVid.currentTime)+' / '+fmtV(sVid.duration||0)});
      sVid.addEventListener('play',()=>sPlayIcon());sVid.addEventListener('pause',()=>sPlayIcon());sVid.addEventListener('click',()=>sVid.paused?sVid.play():sVid.pause());sVideoUI()};return}
  w.innerHTML=`<div class="vbox" id="svbox"></div><div class="vctl"><button class="ibtn" id="sb5" aria-label="5秒戻る"><svg class="ic"><use href="#i-back5"/></svg></button><button class="pbtn" id="spl" aria-label="再生"></button><button class="ibtn" id="sf5" aria-label="5秒進む"><svg class="ic"><use href="#i-fwd5"/></svg></button>
    <span class="tmv" id="svt">${fmtV(sVid.currentTime)} / ${fmtV(sVid.duration||0)}</span><div class="speed" id="svsp">${[0.5,1,2].map(v=>`<button data-v="${v}" class="${sVid.playbackRate==v?'on':''}">${v}×</button>`).join('')}</div>
    <div class="fn">${esc(sVidName)}　<label style="color:var(--acc);cursor:pointer">別の動画<input type="file" accept="video/*" id="svf2" hidden></label></div></div>`;
  $('svbox').appendChild(sVid);sPlayIcon();
  $('spl').onclick=()=>sVid.paused?sVid.play():sVid.pause();
  $('sb5').onclick=()=>{sVid.currentTime=Math.max(0,sVid.currentTime-5)};$('sf5').onclick=()=>{sVid.currentTime=Math.min(sVid.duration||1e9,sVid.currentTime+5)};
  $('svsp').onclick=e=>{const b=e.target.closest('button');if(!b)return;sVid.playbackRate=+b.dataset.v;$('svsp').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b))};
  $('svf2').onchange=e=>{const f=e.target.files[0];if(!f)return;URL.revokeObjectURL(sVid.src);sVid.src=URL.createObjectURL(f);sVidName=f.name;sVideoUI()}}
function sPlayIcon(){const b=$('spl');if(b&&sVid)b.innerHTML=sVid.paused?ICON_PLAY:ICON_PAUSE}
function chips(list,cur,attr){return `<div class="chs">${list.map(x=>{const v=Array.isArray(x)?x[0]:x,l=Array.isArray(x)?x[1]:x;return `<button data-${attr}="${esc(v)}" class="${cur===v?'on':''}">${esc(l)}</button>`}).join('')}</div>`}
function sTagUI(){$('sside').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v===sSide));const el=$('stag');
  if(sSide==='o'){const nos=[...new Set(SC.ev.filter(e=>e.side==='o'&&e.no).map(e=>e.no))].slice(-6);
    el.innerHTML=`<div class="lbl">攻撃の形</div>${chips(OTYPES,sD.type,'ty')}
     <div class="lbl">打った選手（番号）</div><div class="noin" style="display:flex;gap:8px;align-items:center"><input class="inp" id="sno" inputmode="numeric" maxlength="2" placeholder="番号" value="${esc(sD.no||'')}" style="width:80px;text-align:center">${chips(nos,sD.no,'no')}</div>
     <div class="lbl"><span>シュートの位置（任意）</span>${sD.x!=null?'<button id="sxy" style="color:var(--sub);font-size:11px">消す</button>':''}</div><div class="minic" id="smc">${sMini()}</div>
     <div class="lbl">結果（押すと記録）</div><div class="res">${ORES.map(r=>`<button data-r="${r[0]}" class="${r[2]?'ok':'ng'}">${r[1]}</button>`).join('')}</div>`;
    el.querySelectorAll('[data-ty]').forEach(b=>b.onclick=()=>{sD.type=sD.type===b.dataset.ty?null:b.dataset.ty;sTagUI()});
    el.querySelectorAll('[data-no]').forEach(b=>b.onclick=()=>{sD.no=b.dataset.no;sTagUI()});
    $('sno').oninput=()=>{sD.no=$('sno').value.replace(/[^0-9]/g,'');$('sno').value=sD.no};
    if($('sxy'))$('sxy').onclick=()=>{sD.x=sD.y=null;sTagUI()};
    $('smc').onclick=e=>{const svg=$('smc').querySelector('svg');const c=toCourt(svg,e);sD.x=r2(c.x);sD.y=r2(c.y);sTagUI()};
    el.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{const r=ORES.find(x=>x[0]===b.dataset.r);
      sAdd({side:'o',type:sD.type||'その他',no:sD.no||'',res:r[0],pts:r[2],x:sD.x,y:sD.y});sD={def:sD.def};sTagUI()});
  }else{
    el.innerHTML=`<div class="lbl">守り方</div>${chips(DTYPES,sD.def,'df')}
     <div class="lbl">スクリーンへの対応</div>${chips(DCOV,sD.cov,'cv')}
     <div class="lbl">こちらの得点（押すと記録）</div><div class="res">${DRES.map(r=>`<button data-r="${r[0]}" class="${r[2]?'ok':'ng'}">${r[1]}</button>`).join('')}</div>
     <p class="mini">守り方は次の記録にも引き継ぎます。スクリーンを使わなかった攻撃は「スクリーンなし」にしてください。効く作戦の計算では、ゾーンはすべて2-3ゾーンとして扱います。</p>`;
    el.querySelectorAll('[data-df]').forEach(b=>b.onclick=()=>{sD.def=b.dataset.df;sTagUI()});
    el.querySelectorAll('[data-cv]').forEach(b=>b.onclick=()=>{sD.cov=sD.cov===b.dataset.cv?null:b.dataset.cv;sTagUI()});
    el.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{if(!sD.def){snack('守り方を選んでください');return}const r=DRES.find(x=>x[0]===b.dataset.r);
      sAdd({side:'d',def:sD.def,cov:isZone(sD.def)?null:(sD.cov||null),res:r[0],pts:r[2]});sD={def:sD.def};sTagUI()})}}
function sMini(){let h=courtSVG();if(sD.x!=null)h+=`<circle cx="${BX(sD.x)}" cy="${sD.y}" r="0.42" fill="${C.acc}" stroke="${C.bg}" stroke-width="0.08"/>`;return `<svg viewBox="-0.4 -0.4 15.8 10.6">${h}</svg>`}
function sAdd(e){e.id=++SC.seq;e.vt=sVid?r2(sVid.currentTime):null;e.vf=sVid?sVidName:'';SC.ev.push(e);sSave();sRecs();sSum();snack('記録しました：'+sDesc(e))}
function sDesc(e){if(e.side==='o'){const r=ORES.find(x=>x[0]===e.res);return '攻撃｜'+e.type+(e.no?'・#'+e.no:'')+'・'+(r?r[1]:'')}
  const r=DRES.find(x=>x[0]===e.res);return '守備｜'+e.def+(e.cov==='none'?'・スクリーンなし':e.cov?'・'+COV[e.cov]:'')+'・こちら'+(r?r[1]:'')}
function sRecs(){const l=SC.ev.slice().reverse();$('scount').textContent=SC.ev.length+'件';
  $('srecs').innerHTML=l.length?`<ul class="glog">${l.map(e=>`<li data-id="${e.id}"><span class="t">${fmtV(e.vt)}</span><span class="x">${esc(sDesc(e))}</span><button data-del="${e.id}" aria-label="削除"><svg class="ic"><use href="#i-x"/></svg></button></li>`).join('')}</ul>`:`<div style="font-size:12.5px;color:var(--sub)">まだ記録がありません。記録の欄から1回ずつ記録します。</div>`;
  $('srecs').querySelectorAll('li').forEach(li=>li.onclick=ev=>{const d=ev.target.closest('[data-del]');const e=SC.ev.find(x=>x.id==+li.dataset.id);if(!e)return;
    if(d){if(confirm('この記録を削除しますか？')){SC.ev=SC.ev.filter(x=>x!==e);sSave();sRecs();sSum()}return}
    if(sVid&&e.vt!=null){sVid.currentTime=Math.max(0,e.vt-4);sVid.play();window.scrollTo({top:0,behavior:'smooth'})}})}

// ---------------- まとめ ----------------
function bars(rows,fmt,cls){const mx=Math.max(...rows.map(r=>r.v),0.0001);return `<div class="bars">${rows.map(r=>`<div class="bar1"><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.k)}</span><div class="tr"><i style="width:${r.v/mx*100}%" class="${r.c||cls||''}"></i></div><span class="v">${fmt(r)}</span></div>`).join('')}</div>`}
function sSum(){$('stabs').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v===sTab));const el=$('ssum');
  if(sTab==='o'){const o=SC.ev.filter(e=>e.side==='o');if(!o.length){el.innerHTML='<div class="empty">相手の攻撃を記録すると、ここに傾向が出ます</div>';return}
    const pts=o.reduce((s,e)=>s+e.pts,0);const shots=o.filter(e=>shotOf(e.res));const three=o.filter(e=>shotOf(e.res)==='3');
    const made=shots.filter(e=>madeOf(e.res)).length;
    let h=`<div class="kpi"><div><b>${(pts/o.length).toFixed(2)}</b><small>得点／回</small></div><div><b>${shots.length?Math.round(three.length/shots.length*100):0}<span style="font-size:14px">%</span></b><small>シュートのうち3P</small></div><div><b>${shots.length?Math.round(made/shots.length*100):0}<span style="font-size:14px">%</span></b><small>シュート成功率</small></div></div>`;
    const by={};o.forEach(e=>{by[e.type]=by[e.type]||{n:0,p:0};by[e.type].n++;by[e.type].p+=e.pts});
    const rows=Object.entries(by).sort((a,b)=>b[1].n-a[1].n).map(([k,v])=>({k,v:v.n,ppp:v.p/v.n}));
    h+=`<div class="cap">攻撃の形（回数と得点／回）</div>${bars(rows,r=>Math.round(r.v/o.length*100)+'%・'+r.ppp.toFixed(2))}`;
    const pl={};o.filter(e=>e.no).forEach(e=>{pl[e.no]=pl[e.no]||{n:0,p:0};pl[e.no].n++;pl[e.no].p+=e.pts});
    const prow=Object.entries(pl).sort((a,b)=>b[1].p-a[1].p).slice(0,8).map(([k,v])=>({k:'#'+k,v:v.p,n:v.n}));
    if(prow.length)h+=`<div class="cap">選手別の得点（記録した分）</div>${bars(prow,r=>r.v+'点／'+r.n+'回','acc')}`;
    const top=rows[0];const best=rows.filter(r=>r.v>=2).sort((a,b)=>b.ppp-a.ppp)[0];const tp=prow[0];
    h+=`<div class="verdict">最も多い攻撃：<b>${esc(top.k)}</b>（${Math.round(top.v/o.length*100)}%）${best?`<br>最も点を取られている形：<b>${esc(best.k)}</b>（${best.ppp.toFixed(2)}点／回）`:''}${tp?`<br>得点源：<b>${esc(tp.k)}</b>（${tp.v}点）`:''}</div>`;
    const pos=o.filter(e=>e.x!=null&&shotOf(e.res));
    if(pos.length)h+=`<div class="cap">シュートの位置</div><div class="chart"><svg viewBox="-0.4 -0.4 15.8 10.6">${courtSVG()}${pos.map(e=>{const ok=madeOf(e.res);return ok?`<circle cx="${BX(e.x)}" cy="${e.y}" r="0.3" fill="${C.go}" stroke="#fff" stroke-width="0.06"/>`:`<path d="M${BX(e.x-0.22)} ${e.y-0.22}L${BX(e.x+0.22)} ${e.y+0.22}M${BX(e.x+0.22)} ${e.y-0.22}L${BX(e.x-0.22)} ${e.y+0.22}" stroke="${C.warn}" stroke-width="0.08"/>`}).join('')}</svg></div><div class="mixl"><span><i style="background:${C.go}"></i>成功</span><span><i style="background:${C.warn}"></i>失敗</span></div>`;
    el.innerHTML=h;return}
  const d=SC.ev.filter(e=>e.side==='d');
  if(sTab==='d'){if(!d.length){el.innerHTML='<div class="empty">相手の守備を記録すると、ここに傾向が出ます</div>';return}
    const pts=d.reduce((s,e)=>s+e.pts,0);const zn=d.filter(e=>isZone(e.def)).length;
    let h=`<div class="kpi"><div><b>${(pts/d.length).toFixed(2)}</b><small>こちらの得点／回</small></div><div><b>${Math.round((d.length-zn)/d.length*100)}<span style="font-size:14px">%</span></b><small>マンツーマン</small></div><div><b>${Math.round(zn/d.length*100)}<span style="font-size:14px">%</span></b><small>ゾーン</small></div></div>`;
    const by={};d.forEach(e=>{by[e.def]=by[e.def]||{n:0,p:0};by[e.def].n++;by[e.def].p+=e.pts});
    h+=`<div class="cap">守り方（回数とこちらの得点／回）</div>${bars(Object.entries(by).sort((a,b)=>b[1].n-a[1].n).map(([k,v])=>({k,v:v.n,ppp:v.p/v.n})),r=>Math.round(r.v/d.length*100)+'%・'+r.ppp.toFixed(2))}`;
    const cv={};const cd=d.filter(e=>e.cov&&e.cov!=='none');cd.forEach(e=>{cv[e.cov]=cv[e.cov]||{n:0,p:0};cv[e.cov].n++;cv[e.cov].p+=e.pts});
    if(cd.length){const rows=Object.entries(cv).sort((a,b)=>b[1].n-a[1].n).map(([k,v])=>({k:COV[k],v:v.n,ppp:v.p/v.n}));
      h+=`<div class="cap">スクリーンへの対応</div>${bars(rows,r=>Math.round(r.v/cd.length*100)+'%・'+r.ppp.toFixed(2),'acc')}<div class="verdict">ボールスクリーンには主に<b>${esc(rows[0].k)}</b>で守る相手です（${Math.round(rows[0].v/cd.length*100)}%）。</div>`}
    else h+=`<p class="mini">スクリーンへの対応を記録すると、効く作戦の計算に使えます。</p>`;
    el.innerHTML=h;return}
  // 効く作戦
  if(!d.length){el.innerHTML='<div class="empty">相手の守備を記録すると、その守り方に効く作戦を計算できます</div>';return}
  el.innerHTML=`<div class="an-top"><p>${esc(sBasis(d).text)}</p><button class="btn sm fill" id="srun"><svg class="ic"><use href="#i-chart"/></svg>計算する</button></div><div class="prog" id="sprog"><i></i></div><div id="sres">${sCache.__last&&sCache.__lastKey===sBasis(d).key?sCache.__last:''}</div>`;
  $('srun').onclick=sRecommend;if($('sres').innerHTML)sBind()}
function sBasis(d){const zn=d.filter(e=>isZone(e.def)).length;const zs=zn/d.length;const cv={};let cn=0;d.forEach(e=>{if(e.cov&&e.cov!=='none'){cv[e.cov]=(cv[e.cov]||0)+1;cn++}});
  let w={};if(cn)for(const k in cv)w[k]=cv[k]/cn;else COV_LIST.forEach(c=>w[c]=1/COV_LIST.length);
  const keep=Object.keys(w).filter(c=>w[c]>=0.08);const s=keep.reduce((a,c)=>a+w[c],0);const w2={};keep.forEach(c=>w2[c]=w[c]/s);
  const covTxt=cn?Object.keys(w2).sort((a,b)=>w2[b]-w2[a]).map(c=>COV[c]+' '+Math.round(w2[c]*100)+'%').join('・'):'記録なし（5種類を同じ割合で計算）';
  return {zs,w:w2,key:JSON.stringify([Math.round(zs*100),w2]),text:`守備の記録${d.length}回（マンツーマン${Math.round((1-zs)*100)}%・ゾーン${Math.round(zs*100)}%、スクリーン対応：${covTxt}）をもとに、作戦集の各作戦をこの守り方に当てて8回ずつ試し、期待得点で順位をつけます。`}}
async function sRecommend(){if(sBusy)return;sBusy=true;const d=SC.ev.filter(e=>e.side==='d');const B=sBasis(d);
  const N=8,seeds=trialSeeds(N,77);const tasks=[];
  for(const p of PLAYS){if(p.zone){if(B.zs>0)tasks.push([p,'zone'])}else{if(B.zs<1)for(const c in B.w)tasks.push([p,c]);if(B.zs>0)tasks.push([p,'zone'])}}
  const bar=$('sprog').firstChild;$('sprog').classList.add('on');
  for(let i=0;i<tasks.length;i++){const [p,c]=tasks[i];const key=p.id+'|'+c;
    if(sCache[key]==null){let s=0;for(const sd of seeds){const r=simulate(p,{seed:sd,def:c==='zone'?'zone':'man',cov:c==='zone'?'auto':c,record:false});s+=r.shot?r.shot.ev:0}sCache[key]=s/N}
    if(i%3===0){bar.style.width=(i/tasks.length*100)+'%';await new Promise(r=>setTimeout(r,0))}}
  bar.style.width='100%';
  const manRank=B.zs<1?PLAYS.filter(p=>!p.zone).map(p=>{let v=0;for(const c in B.w)v+=B.w[c]*(sCache[p.id+'|'+c]||0);
    const parts=Object.keys(B.w).sort((a,b)=>B.w[b]-B.w[a]).slice(0,3).map(c=>COV[c]+' '+(sCache[p.id+'|'+c]||0).toFixed(2));return {p,v,detail:parts.join('・')}}).sort((a,b)=>b.v-a.v):[];
  const zoneRank=B.zs>0?PLAYS.filter(p=>sCache[p.id+'|zone']!=null).map(p=>({p,v:sCache[p.id+'|zone'],detail:'2-3ゾーン相手'})).sort((a,b)=>b.v-a.v):[];
  const list=(rows,n)=>`<div class="glist" style="margin-top:10px">${rows.slice(0,n).map((x,i)=>`<button class="grow" data-id="${x.p.id}" data-z="${x.detail==='2-3ゾーン相手'?1:0}"><span class="num" style="font-size:20px;color:${i?'var(--sub)':'var(--acc)'};width:22px">${i+1}</span><div class="tx"><b>${esc(x.p.name)}</b><small>${esc(x.detail)}</small></div><div class="sc">${x.v.toFixed(2)}</div><svg class="ic chev" style="color:var(--faint);width:16px"><use href="#i-chev"/></svg></button>`).join('')}</div>`;
  let html='';
  if(manRank.length){const low=manRank[manRank.length-1];html+=`<div class="cap">マンツーマンで守られたとき（${Math.round((1-B.zs)*100)}%）</div>${list(manRank,6)}<div class="verdict" style="margin-top:10px">避けたい作戦：<b>${esc(low.p.name)}</b>（${low.v.toFixed(2)}点）</div>`}
  if(zoneRank.length)html+=`<div class="cap">ゾーンで守られたとき（${Math.round(B.zs*100)}%）</div>${list(zoneRank,4)}`;
  html+=`<p class="mini">数字は期待得点（1回の攻撃あたり）。押すと、この相手の守り方を設定した状態で再生します。シミュレーションの目安で、相手選手の能力の差は入っていません。</p>`;
  sCache.__last=html;sCache.__lastKey=B.key;$('sres').innerHTML=html;sBind();setTimeout(()=>$('sprog').classList.remove('on'),300);sBusy=false}
function sBind(){$('sres').querySelectorAll('.grow').forEach(b=>b.onclick=()=>{const d=SC.ev.filter(e=>e.side==='d');const B=sBasis(d);
  const main=Object.keys(B.w).sort((a,b)=>B.w[b]-B.w[a])[0];window.__nextOpt={def:b.dataset.z==='1'?'zone':'man',cov:main||'auto'};
  window.__nextFrom='scout';window.__scoutBack='/scout/'+SC.id;go('/p/'+b.dataset.id)})}
document.addEventListener('keydown',e=>{if(curView!=='scout'||!sVid||/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))return;
  if(e.code==='Space'){e.preventDefault();sVid.paused?sVid.play():sVid.pause()}
  if(e.code==='ArrowRight')sVid.currentTime+=5;if(e.code==='ArrowLeft')sVid.currentTime=Math.max(0,sVid.currentTime-5)});
