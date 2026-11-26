'use strict';
// =====================================================================
//  試合（スコアシート・5人制）
// =====================================================================
const GSTORE='sakusen.v2.games';
const gLoad=()=>{try{return JSON.parse(localStorage.getItem(GSTORE))||[]}catch(e){return []}};
const gPut=l=>{try{localStorage.setItem(GSTORE,JSON.stringify(l))}catch(e){snack('保存できませんでした')}};
let G=null,gSel=null,gTab='log',gMode='list',gTick=null;
const FK={P:'パーソナルファウル',T:'テクニカルファウル',U:'アンスポーツマンライクファウル',D:'ディスクォリファイングファウル',C:'コーチのテクニカル',B:'ベンチのテクニカル'};
const AK={'1':'フリースロー成功','2':'2P成功','3':'3P成功','1x':'フリースロー失敗','2x':'2P失敗','3x':'3P失敗',TO:'タイムアウト'};
function gToday(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function gBlank(n){return Array.from({length:n||12},()=>({no:'',name:'',start:false}))}
function gNew(){return {id:'g'+Date.now().toString(36),title:'',date:gToday(),place:'',qmin:10,otmin:5,teams:[{name:'',coach:'',players:gBlank()},{name:'',coach:'',players:gBlank()}],period:1,rem:600000,runAt:0,ev:[],seq:0}}
function gSave(){if(!G)return;G.updated=Date.now();const l=gLoad();const i=l.findIndex(x=>x.id===G.id);if(i>=0)l[i]=G;else l.unshift(G);gPut(l)}
const tn=ti=>(G.teams[ti].name||(ti?'Bチーム':'Aチーム'));
const perLen=p=>(p<=4?G.qmin:(G.otmin||5))*60000;
const pName=p=>p<=4?p+'Q':'延長'+(p-4);
function clockNow(){return G.runAt?Math.max(0,G.rem-(Date.now()-G.runAt)):G.rem}
function fmtClock(ms){if(ms>0&&ms<60000)return (Math.floor(ms/100)/10).toFixed(1);const s=Math.ceil(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
function gState(g){
  const st={pts:[0,0],per:{},tf:{},pl:[],to:[[],[]],run:[],coach:[[],[]],after:{}};
  g.teams.forEach((t,ti)=>{st.pl[ti]=t.players.map(()=>({pts:0,fg2:[0,0],fg3:[0,0],ft:[0,0],f:[],played:false}))});
  for(const e of g.ev){const ti=e.team;const P=e.p>=0?st.pl[ti][e.p]:null;if(P)P.played=true;
    st.per[e.per]=st.per[e.per]||[0,0];
    if(e.k==='1'||e.k==='2'||e.k==='3'){const v=+e.k;st.pts[ti]+=v;st.per[e.per][ti]+=v;if(P){P.pts+=v;const a=v===1?P.ft:v===2?P.fg2:P.fg3;a[0]++;a[1]++}st.run.push({team:ti,p:e.p,v,total:st.pts[ti],per:e.per})}
    else if(e.k[1]==='x'){if(P){const v=+e.k[0];const a=v===1?P.ft:v===2?P.fg2:P.fg3;a[1]++}}
    else if('PTUD'.includes(e.k)&&P){P.f.push({k:e.k,per:e.per});const k=Math.min(e.per,4);st.tf[k]=st.tf[k]||[0,0];st.tf[k][ti]++}
    else if(e.k==='C'||e.k==='B')st.coach[ti].push({k:e.k,per:e.per});
    else if(e.k==='TO')st.to[ti].push({per:e.per,c:e.c});
    st.after[e.id]=st.pts.slice()}
  g.teams.forEach((t,ti)=>t.players.forEach((p,i)=>{if(p.start)st.pl[ti][i].played=true}));
  return st}
function outStatus(P){if(!P)return '';const T=P.f.filter(f=>f.k==='T').length,U=P.f.filter(f=>f.k==='U').length,D=P.f.some(f=>f.k==='D');
  if(D||T>=2||U>=2||(T>=1&&U>=1))return '失格・退場';if(P.f.length>=5)return '5ファウル退場';return ''}
function coachOut(list){const C=list.filter(x=>x.k==='C').length;return C>=2||list.length>=3}
const tfOf=(st,per,ti)=>(st.tf[Math.min(per,4)]||[0,0])[ti];
function toLeft(st,ti){const per=G.period;const used=st.to[ti];
  if(per<=2){const u=used.filter(x=>x.per<=2).length;return {left:Math.max(0,2-u),max:2,used:u}}
  if(per<=4){const u=used.filter(x=>x.per>=3&&x.per<=4);let left=3-u.length;
    if(per===4&&clockNow()<=120000){const inLast=u.filter(x=>x.per===4&&x.c<=120000).length;left=Math.min(left,2-inLast)}return {left:Math.max(0,left),max:3,used:u.length}}
  const u=used.filter(x=>x.per===per).length;return {left:Math.max(0,1-u),max:1,used:u}}
const roster=ti=>G.teams[ti].players.map((p,i)=>({p,i})).filter(x=>x.p.no!==''||x.p.name);

// ---------------- 画面の切り替え ----------------
function gameRoute(h){showView('game');let m;
  if(h==='/game/new'){G=gNew();gSave();return go('/game/'+G.id+'/setup')}
  if((m=h.match(/^\/game\/([^/]+)(\/setup)?$/))){const g=gLoad().find(x=>x.id===m[1]);if(!g)return go('/game');G=g;gMode=m[2]?'setup':'rec';gSel=null}
  else gMode='list';
  gRender()}
function gRender(){if(gMode==='list')return gList();if(gMode==='setup')return gSetup();gRec()}

// ---------------- 一覧 ----------------
function gList(){const l=gLoad();
  $('game').innerHTML=`<div class="gtop"><h1>試合</h1><button class="btn sm fill" id="gnew"><svg class="ic"><use href="#i-plus"/></svg>新しい試合</button></div>`+
  (l.length?`<div class="glist">${l.map(g=>{const st=gState(g);const a=g.teams[0].name||'Aチーム',b=g.teams[1].name||'Bチーム';
    return `<button class="grow" data-id="${esc(g.id)}"><div class="tx"><b>${esc(a)} 対 ${esc(b)}</b><small>${esc([g.date,g.title,g.place].filter(Boolean).join('・'))}</small></div><div class="sc">${st.pts[0]} - ${st.pts[1]}</div><svg class="ic chev" style="color:var(--faint);width:16px"><use href="#i-chev"/></svg></button>`}).join('')}</div>`
  :`<div class="empty">記録した試合はありません。<br><button class="btn" id="gnew2"><svg class="ic"><use href="#i-plus"/></svg>新しい試合を記録する</button></div>`)+
  `<p class="note">試合中は選手をタップして得点・ファウル・タイムアウトを記録します。チームファウルとタイムアウトの残り、5ファウル退場は自動で判定し、公式記録用紙に近い形式で印刷できます。練習試合やチーム内の記録用です。記録はこの端末にだけ保存されます。</p>`;
  const nw=()=>go('/game/new');if($('gnew'))$('gnew').onclick=nw;if($('gnew2'))$('gnew2').onclick=nw;
  $('game').querySelectorAll('.grow').forEach(b=>b.onclick=()=>go('/game/'+b.dataset.id))}

// ---------------- 設定 ----------------
function gSetup(){const g=G;
  const team=(t,ti)=>`<div class="card"><h3>${ti?'Bチーム':'Aチーム'}<small>先発は5人まで</small></h3>
    <div class="form" style="grid-template-columns:1fr 1fr"><label><small>チーム名</small><input class="inp" data-f="name" data-t="${ti}" value="${esc(t.name)}" maxlength="30"></label><label><small>コーチ</small><input class="inp" data-f="coach" data-t="${ti}" value="${esc(t.coach)}" maxlength="20"></label></div>
    <table class="ptable"><tr><th>番号</th><th>氏名</th><th style="text-align:center">先発</th></tr>
    ${t.players.map((p,i)=>`<tr><td class="no"><input class="inp num" data-t="${ti}" data-r="${i}" data-c="no" value="${esc(p.no)}" inputmode="numeric" maxlength="2"></td><td><input class="inp" data-t="${ti}" data-r="${i}" data-c="name" value="${esc(p.name)}" maxlength="20"></td><td class="st"><span class="ck${p.start?' on':''}" data-t="${ti}" data-r="${i}"></span></td></tr>`).join('')}</table>
    ${t.players.length<15?`<button class="btn sm" data-add="${ti}" style="margin-top:8px"><svg class="ic"><use href="#i-plus"/></svg>行を追加</button>`:''}</div>`;
  $('game').innerHTML=`<div class="gtop"><button class="back" id="gback" aria-label="戻る" style="width:36px;height:36px;border-radius:10px;border:1px solid var(--line);display:grid;place-items:center;color:var(--sub)"><svg class="ic"><use href="#i-back"/></svg></button><h1>試合の設定</h1>${g.ev.length?'':`<button class="btn sm" id="gdel"><svg class="ic"><use href="#i-trash"/></svg>削除</button>`}</div>
   <div class="card"><div class="form"><label class="w2"><small>大会名</small><input class="inp" data-f="title" value="${esc(g.title)}" maxlength="40"></label><label><small>日付</small><input class="inp" type="date" data-f="date" value="${esc(g.date)}"></label><label><small>ピリオドの長さ</small><select data-f="qmin">${[10,8,7,6,5,12].map(m=>`<option value="${m}"${g.qmin==m?' selected':''}>${m}分</option>`).join('')}</select></label><label><small>延長の長さ</small><select data-f="otmin">${[5,3,2].map(m=>`<option value="${m}"${(g.otmin||5)==m?' selected':''}>${m}分</option>`).join('')}</select></label><label class="w2"><small>会場</small><input class="inp" data-f="place" value="${esc(g.place)}" maxlength="40"></label></div></div>
   <div class="teams2">${g.teams.map(team).join('')}</div>
   <div class="erun" style="grid-template-columns:1fr;max-width:420px;margin:16px auto 0"><button class="btn fill" id="gstart">記録の画面へ</button></div>`;
  const root=$('game');
  root.querySelectorAll('input,select').forEach(el=>el.oninput=el.onchange=()=>{const t=el.dataset.t,f=el.dataset.f;
    if(el.dataset.r!=null){G.teams[t].players[el.dataset.r][el.dataset.c]=el.dataset.c==='no'?el.value.replace(/[^0-9]/g,''):el.value;if(el.dataset.c==='no')el.value=G.teams[t].players[el.dataset.r].no}
    else if(t!=null)G.teams[t][f]=el.value;else if(f==='otmin'){G.otmin=+el.value}else if(f==='qmin'){G.qmin=+el.value;if(!G.ev.length&&!G.runAt){G.rem=perLen(G.period)}}else G[f]=el.value;gSave()});
  root.querySelectorAll('.ck').forEach(c=>c.onclick=()=>{const ps=G.teams[c.dataset.t].players;const p=ps[c.dataset.r];if(!p.start&&ps.filter(x=>x.start).length>=5){snack('先発は5人までです');return}p.start=!p.start;c.classList.toggle('on',p.start);gSave()});
  root.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{G.teams[b.dataset.add].players.push(...gBlank(1));gSave();gSetup()});
  $('gback').onclick=()=>go(G.ev.length?'/game/'+G.id:'/game');
  if($('gdel'))$('gdel').onclick=()=>{if(confirm('この試合を削除しますか？元に戻せません。')){gPut(gLoad().filter(x=>x.id!==G.id));G=null;go('/game')}};
  $('gstart').onclick=()=>{const bad=[0,1].find(ti=>{const nos=roster(ti).map(x=>x.p.no).filter(Boolean);return new Set(nos).size!==nos.length});
    if(bad!=null){snack((bad?'Bチーム':'Aチーム')+'に同じ番号があります');return}
    if(!roster(0).length||!roster(1).length){snack('両チームの選手を入力してください');return}go('/game/'+G.id)}}

// ---------------- 記録 ----------------
function gRec(){const st=gState(G);const c=clockNow();
  const tinfo=ti=>{const tf=tfOf(st,G.period,ti);const to=toLeft(st,ti);
    return `<div class="tinfo"><span>ファウル<span class="dots">${[1,2,3,4,5].map(i=>`<i class="${i<=tf?'on':''}"></i>`).join('')}</span>${tf>=4?' <span class="bonus">次からFT</span>':''}</span><span>TO 残り${to.left}<span class="dots to">${Array.from({length:to.max},(_,i)=>`<i class="${i<to.used?'on':''}"></i>`).join('')}</span></span></div>`};
  const pbtn=(ti,x)=>{const P=st.pl[ti][x.i];const o=outStatus(P);const sel=gSel&&gSel.t===ti&&gSel.p===x.i;
    return `<button class="pb${sel?' sel':''}${o?' out':''}" data-t="${ti}" data-p="${x.i}"><b>${esc(x.p.no||'-')}</b><small>${esc(x.p.name||'')}</small><span class="pp">${P.pts}</span><span class="fl">${[0,1,2,3,4].map(i=>`<i class="${i<P.f.length?'on':''}"></i>`).join('')}</span></button>`};
  const teamBlock=ti=>`<div><div class="th3"><b>${esc(tn(ti))}</b><small>${coachOut(st.coach[ti])?'<span class="bonus">コーチ失格・退場</span>':''}</small></div><div class="pg">${roster(ti).map(x=>pbtn(ti,x)).join('')}<button class="pb team${gSel&&gSel.t===ti&&gSel.p===-1?' sel':''}" data-t="${ti}" data-p="-1">チーム<br>コーチ</button></div></div>`;
  let bar;
  if(!gSel)bar=`<div class="who"><span>選手をタップして記録</span><button id="gundo" style="color:var(--sub);font-size:12.5px">1つ戻す</button></div>`;
  else if(gSel.p===-1){const to=toLeft(st,gSel.t);bar=`<div class="who"><span><b>${esc(tn(gSel.t))}</b>　タイムアウト残り${to.left}回</span><button id="gcan" style="color:var(--sub);font-size:12.5px">やめる</button></div>
    <div class="g" style="grid-template-columns:repeat(3,1fr)"><button class="a ok" data-k="TO">TO<small>タイムアウト</small></button><button class="a f" data-k="C">C<small>コーチのT</small></button><button class="a f" data-k="B">B<small>ベンチのT</small></button></div>`}
  else{const pl=G.teams[gSel.t].players[gSel.p];const P=st.pl[gSel.t][gSel.p];
    bar=`<div class="who"><span><b>${esc(tn(gSel.t))}　#${esc(pl.no)} ${esc(pl.name)}</b>　${P.pts}点・ファウル${P.f.length}</span><button id="gcan" style="color:var(--sub);font-size:12.5px">やめる</button></div>
    <div class="g"><button class="a ok" data-k="2">2P<small>成功</small></button><button class="a ok" data-k="3">3P<small>成功</small></button><button class="a ok" data-k="1">FT<small>成功</small></button><button class="a ng" data-k="2x">2P<small>失敗</small></button><button class="a ng" data-k="3x">3P<small>失敗</small></button><button class="a ng" data-k="1x">FT<small>失敗</small></button></div>
    <div class="g g4"><button class="a f" data-k="P">P<small>ファウル</small></button><button class="a f" data-k="T">T<small>テクニカル</small></button><button class="a f" data-k="U">U<small>アンスポ</small></button><button class="a f" data-k="D">D<small>失格</small></button></div>`}
  $('game').innerHTML=`<div class="gtop"><button class="back" id="gback" aria-label="一覧へ" style="width:36px;height:36px;border-radius:10px;border:1px solid var(--line);display:grid;place-items:center;color:var(--sub)"><svg class="ic"><use href="#i-back"/></svg></button><h1>${esc(G.title||(tn(0)+' 対 '+tn(1)))}</h1><button class="btn sm" id="gset">設定</button></div>
   <div class="sbd"><div class="tm"><div class="nm">${esc(tn(0))}</div><div class="pt">${st.pts[0]}</div>${tinfo(0)}</div>
     <div class="mid"><div class="pd">${pName(G.period)}</div><div class="clk ${G.runAt?'run':'stop'}" id="gclk" title="タップして時間を直す">${fmtClock(c)}</div>
       <div class="cb"><button class="${G.runAt?'':'go'}" id="gcl">${G.runAt?'止める':'開始'}</button><button id="gnext">次へ</button></div></div>
     <div class="tm"><div class="nm">${esc(tn(1))}</div><div class="pt">${st.pts[1]}</div>${tinfo(1)}</div></div>
   <div class="teams2">${teamBlock(0)}${teamBlock(1)}</div>
   <div class="abar" id="gbar">${bar}</div>
   <div class="gtabs" id="gtabs">${[['log','経過'],['stats','スタッツ'],['sheet','記録用紙']].map(x=>`<button data-v="${x[0]}" class="${gTab===x[0]?'on':''}">${x[1]}</button>`).join('')}</div>
   <div id="gpane"></div>`;
  gPane(st);
  const root=$('game');
  root.querySelectorAll('.pb').forEach(b=>b.onclick=()=>{const t=+b.dataset.t,p=+b.dataset.p;gSel=gSel&&gSel.t===t&&gSel.p===p?null:{t,p};gRec();if(gSel&&innerWidth<900)setTimeout(()=>$('gbar').scrollIntoView({block:'nearest',behavior:'smooth'}),30)});
  root.querySelectorAll('#gbar [data-k]').forEach(b=>b.onclick=()=>gAdd(b.dataset.k,gSel.t,gSel.p));
  if($('gcan'))$('gcan').onclick=()=>{gSel=null;gRec()};
  if($('gundo'))$('gundo').onclick=()=>{const e=G.ev.pop();if(!e){snack('記録がありません');return}gSave();snack('取り消しました：'+gDesc(e));gRec()};
  $('gback').onclick=()=>go('/game');$('gset').onclick=()=>go('/game/'+G.id+'/setup');
  $('gcl').onclick=gClockToggle;
  $('gnext').onclick=()=>{const st2=gState(G);const n=G.period+1;
    if(G.period>=4&&st2.pts[0]!==st2.pts[1]){snack('同点ではないので延長はありません');return}
    if(!confirm(pName(n)+'へ進みますか？'))return;G.period=n;G.rem=perLen(n);G.runAt=0;gSave();gRec()};
  $('gclk').onclick=()=>{if(G.runAt){snack('時計を止めてから直してください');return}const v=prompt('残り時間（例 5:32）',fmtClock(G.rem));if(!v)return;const m=v.match(/^(\d{1,2})[:：](\d{1,2})$/)||v.match(/^(\d{1,2})$/);if(!m){snack('「分:秒」で入力してください');return}
    const ms=m[2]!=null?(+m[1]*60+ +m[2])*1000:+m[1]*60000;G.rem=Math.min(ms,perLen(G.period));gSave();gRec()};
  $('gtabs').onclick=e=>{const b=e.target.closest('button');if(!b)return;gTab=b.dataset.v;$('gtabs').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));gPane(gState(G))};
  clearInterval(gTick);gTick=setInterval(()=>{if(curView!=='game'||gMode!=='rec'||!G){clearInterval(gTick);return}const el=$('gclk');if(!el)return;const cn=clockNow();el.textContent=fmtClock(cn);
    if(G.runAt&&cn<=0){G.rem=0;G.runAt=0;gSave();snack(pName(G.period)+'終了');gRec()}},100);
}
function gClockToggle(){if(G.runAt){G.rem=clockNow();G.runAt=0}else{if(G.rem<=0){snack('「次へ」で次のピリオドに進んでください');return}G.runAt=Date.now()}gSave();gRec()}
function gDesc(e){const pl=e.p>=0?G.teams[e.team].players[e.p]:null;const who=esc(tn(e.team))+(pl?' #'+esc(pl.no)+' '+esc(pl.name):'');return who+'　'+(AK[e.k]||FK[e.k]||e.k)}
function gAdd(k,team,p){
  let st=gState(G);
  if(k==='TO'&&toLeft(st,team).left<=0&&!confirm('タイムアウトの残りがありません。記録しますか？'))return;
  if(p>=0&&outStatus(st.pl[team][p])&&!confirm('この選手は退場しています。記録しますか？'))return;
  const c=Math.round(clockNow());
  G.ev.push({id:++G.seq,per:G.period,c,team,p,k});
  const stop='PTUDCB'.includes(k)||k==='TO'||((k==='2'||k==='3')&&G.period>=4&&c<=120000);
  if(stop&&G.runAt){G.rem=clockNow();G.runAt=0}
  gSave();st=gState(G);
  if('PTUD'.includes(k)){const pl=G.teams[team].players[p];const o=outStatus(st.pl[team][p]);
    snack('#'+pl.no+' '+(o?o+'。交代が必要です':FK[k]+'（'+st.pl[team][p].f.length+'個目）'));
    if(tfOf(st,G.period,team)===4)setTimeout(()=>snack(tn(team)+'のチームファウルが4つ。次のファウルからフリースロー'),1700)}
  else if(k==='TO')snack(tn(team)+' タイムアウト（残り'+toLeft(st,team).left+'回）');
  else if(k==='C'||k==='B'){snack(tn(team)+' '+FK[k]+(coachOut(st.coach[team])?'。コーチは失格・退場':''))}
  else snack(gDesc(G.ev[G.ev.length-1]).replace(/<[^>]+>/g,''));
  gSel=null;gRec()}
function gPane(st){const el=$('gpane');
  if(gTab==='log'){const list=G.ev.slice().reverse();
    el.innerHTML=list.length?`<ul class="glog">${list.map(e=>`<li><span class="t">${pName(e.per)} ${fmtClock(e.c)}</span><span class="x">${gDesc(e)}</span><span class="s">${st.after[e.id][0]}-${st.after[e.id][1]}</span><button data-del="${e.id}" aria-label="削除"><svg class="ic"><use href="#i-x"/></svg></button></li>`).join('')}</ul>`:`<div class="empty">まだ記録がありません</div>`;
    el.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{const e=G.ev.find(x=>x.id==+b.dataset.del);if(e&&confirm('「'+gDesc(e).replace(/<[^>]+>/g,'')+'」を削除しますか？')){G.ev=G.ev.filter(x=>x!==e);gSave();gRec()}});return}
  if(gTab==='stats'){const pers=Object.keys(st.per).map(Number).concat([1,2,3,4]).filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>a-b);
    let h=`<div class="qs" style="--nq:${pers.length}"><div class="h"></div>${pers.map(p=>`<div class="h">${pName(p)}</div>`).join('')}<div class="h">合計</div>`;
    [0,1].forEach(ti=>{h+=`<div class="n">${esc(tn(ti))}</div>${pers.map(p=>`<div>${st.per[p]?st.per[p][ti]:(p<=G.period?0:'')}</div>`).join('')}<div class="tt">${st.pts[ti]}</div>`});h+='</div>';
    const pct=a=>a[1]?`${a[0]}/${a[1]}`:'-';
    [0,1].forEach(ti=>{const rows=roster(ti);const tot={pts:0,fg2:[0,0],fg3:[0,0],ft:[0,0],f:0};
      h+=`<div class="cap" style="margin-top:20px">${esc(tn(ti))}</div><div class="scrollx"><table class="stt"><tr><th>番号</th><th>氏名</th><th>得点</th><th>2P</th><th>3P</th><th>FT</th><th>ファウル</th></tr>`+
      rows.map(x=>{const P=st.pl[ti][x.i];tot.pts+=P.pts;['fg2','fg3','ft'].forEach(k=>{tot[k][0]+=P[k][0];tot[k][1]+=P[k][1]});tot.f+=P.f.length;
        return `<tr><td>${esc(x.p.no)}</td><td>${esc(x.p.name)}${outStatus(P)?' <span class="bonus" style="font-size:10.5px">退場</span>':''}</td><td>${P.pts}</td><td>${pct(P.fg2)}</td><td>${pct(P.fg3)}</td><td>${pct(P.ft)}</td><td>${P.f.map(f=>f.k).join('')||'-'}</td></tr>`}).join('')+
      `<tr class="tot"><td></td><td>合計</td><td>${tot.pts}</td><td>${pct(tot.fg2)}</td><td>${pct(tot.fg3)}</td><td>${pct(tot.ft)}</td><td>${tot.f}</td></tr></table></div>`});
    h+=`<p class="mini">2P・3P・FTは「成功/試投」。失敗も記録すると試投数に入ります。</p>`;el.innerHTML=h;return}
  el.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px"><span style="font-size:12.5px;color:var(--sub)">A4縦で印刷できます。PDFにする場合は印刷画面で「PDFに保存」を選んでください。</span><button class="btn sm fill" id="gprint"><svg class="ic"><use href="#i-print"/></svg>印刷・PDF</button></div><div class="sheetwrap">${sheetHTML(G,st)}</div>`;
  $('gprint').onclick=()=>{$('printsheet').innerHTML=sheetHTML(G,gState(G));setTimeout(()=>window.print(),50)}}

// ---------------- 記録用紙 ----------------
function sheetHTML(g,st){
  const box=(x,txt)=>`<span class="box${x?' x':''}" style="${txt?'background:none;text-align:center;line-height:4mm;font-size:6.5pt':''}">${txt||''}</span>`;
  const team=ti=>{const t=g.teams[ti];const to=st.to[ti];const minute=x=>{const L=x.per<=4?g.qmin:(g.otmin||5);return Math.min(L,Math.floor((L*60000-x.c)/60000)+1)};
    const h1=to.filter(x=>x.per<=2),h2=to.filter(x=>x.per>=3&&x.per<=4),ot=to.filter(x=>x.per>4);
    const toRow=`前半 ${[0,1].map(i=>box(0,h1[i]?minute(h1[i]):'')).join('')}　後半 ${[0,1,2].map(i=>box(0,h2[i]?minute(h2[i]):'')).join('')}　延長 ${[0,1,2].map(i=>box(0,ot[i]?minute(ot[i]):'')).join('')}`;
    const tfRow=[1,2,3,4].map(q=>{const n=(st.tf[q]||[0,0])[ti];return `${q}Q ${[1,2,3,4].map(i=>box(i<=n)).join('')}`}).join(' ');
    const rows=t.players.slice(0,Math.max(12,t.players.length)).map((p,i)=>{const P=st.pl[ti][i];const f=P?P.f:[];
      const mark=p.start?'⊗':(P&&P.played?'×':'');
      return `<tr><td style="width:8mm">${esc(p.no)}</td><td class="nm">${esc(p.name)}</td><td style="width:7mm">${mark}</td>${[0,1,2,3,4].map(k=>`<td class="f">${f[k]?f[k].k:''}</td>`).join('')}</tr>`}).join('');
    const cf=st.coach[ti];
    return `<table class="tb pl"><tr><td class="tn" colspan="8" style="text-align:left">${ti?'B':'A'}チーム：${esc(t.name)}</td></tr>
      <tr><td colspan="8" style="text-align:left;white-space:nowrap"><b style="display:inline-block;width:22mm">タイムアウト</b>${toRow}</td></tr>
      <tr><td colspan="8" style="text-align:left;white-space:nowrap"><b style="display:inline-block;width:22mm">チームファウル</b>${tfRow}</td></tr>
      <tr><th>番号</th><th>氏名</th><th>出場</th><th colspan="5">ファウル</th></tr>${rows}
      <tr><th colspan="2" style="text-align:left">コーチ：${esc(t.coach)}</th><td></td>${[0,1,2].map(k=>`<td class="f">${cf[k]?cf[k].k:''}</td>`).join('')}<td class="f"></td><td class="f"></td></tr></table>`};
  // ランニングスコア
  const mk=[{},{}];
  st.run.forEach(r=>{mk[r.team][r.total]={v:r.v,no:r.p>=0?g.teams[r.team].players[r.p].no:''}});
  const ends=[{},{}];[0,1].forEach(ti=>{const byPer={};st.run.filter(r=>r.team===ti).forEach(r=>byPer[r.per]=r.total);Object.values(byPer).forEach(v=>ends[ti][v]=1)});
  const cell=(ti,n)=>{const m=mk[ti][n];const cls=['p'];if(m)cls.push(m.v===1?'m1':m.v===2?'m2':'m3');if(ends[ti][n])cls.push('end');return `<td class="${cls.join(' ')}">${m&&m.v===1?'':n}</td>`};
  const nocell=(ti,n)=>{const m=mk[ti][n];return `<td class="${m&&m.v===3?'c3':''}${ends[ti][n]?' end':''}">${m?(m.v===3?`<span>${esc(m.no)}</span>`:esc(m.no)):''}</td>`};
  const blocks=[0,1,2,3].map(b=>`<table><tr><th colspan="2">A</th><th colspan="2">B</th></tr>${Array.from({length:40},(_,i)=>{const n=b*40+i+1;return `<tr>${nocell(0,n)}${cell(0,n)}${cell(1,n)}${nocell(1,n)}</tr>`}).join('')}</table>`).join('');
  const pers=Object.keys(st.per).map(Number).concat([1,2,3,4]).filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>a-b);
  const win=st.pts[0]===st.pts[1]?'':(st.pts[0]>st.pts[1]?(g.teams[0].name||'Aチーム'):(g.teams[1].name||'Bチーム'));
  return `<div class="sheet"><h2>スコアシート</h2>
   <table class="hd"><tr><th style="width:18mm">大会名</th><td colspan="3">${esc(g.title)}</td><th style="width:14mm">日付</th><td style="width:30mm">${esc(g.date)}</td></tr>
   <tr><th>会場</th><td colspan="3">${esc(g.place)}</td><th>時間</th><td>${g.qmin}分×4（延長${g.otmin||5}分）</td></tr>
   <tr><th>Aチーム</th><td style="width:50mm">${esc(g.teams[0].name)}</td><th style="width:16mm">Bチーム</th><td>${esc(g.teams[1].name)}</td><th>記録者</th><td></td></tr></table>
   <div class="bd"><div>${team(0)}${team(1)}</div><div><div style="text-align:center;font-weight:700;font-size:8pt;margin-bottom:1mm">ランニングスコア</div><div class="rs">${blocks}</div></div></div>
   <div class="ft"><table><tr><th>チーム</th>${pers.map(p=>`<th>${pName(p)}</th>`).join('')}<th>合計</th></tr>${[0,1].map(ti=>`<tr><td>${esc(g.teams[ti].name||(ti?'B':'A'))}</td>${pers.map(p=>`<td style="text-align:center">${st.per[p]?st.per[p][ti]:''}</td>`).join('')}<td style="text-align:center;font-weight:700">${st.pts[ti]}</td></tr>`).join('')}</table>
   <table><tr><th style="width:20mm">最終スコア</th><td style="text-align:center;font-size:11pt;font-weight:700">${st.pts[0]} − ${st.pts[1]}</td></tr><tr><th>勝者</th><td>${esc(win)}</td></tr><tr><th>主審</th><td></td></tr><tr><th>副審</th><td></td></tr></table></div>
   <div class="note">2P：数字に斜線／3P：斜線と番号に丸／フリースロー：●／太線：各ピリオドの終わり。出場欄の⊗は先発、×は出場。タイムアウト欄の数字は、そのピリオドの経過分。公式記録には使えません。練習試合やチーム内の記録用です。</div></div>`}
