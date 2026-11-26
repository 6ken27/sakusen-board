'use strict';
// =====================================================================
//  試合（スコアシート・5人制／FIBA・JBAの記録方法を参考）
// =====================================================================
const GSTORE='sakusen.v2.games';
const gLoad=()=>{try{return JSON.parse(localStorage.getItem(GSTORE))||[]}catch(e){return []}};
const gPut=l=>{try{localStorage.setItem(GSTORE,JSON.stringify(l))}catch(e){snack('保存できませんでした')}};
let G=null,gSel=null,gTab='log',gMode='list',gTick=null,gFoul=null,gSub=null;
const FK={HD:'ヘッドコーチのディスクォリファイング',P:'パーソナルファウル',T:'テクニカルファウル',U:'アンスポーツマンライクファウル',D:'ディスクォリファイングファウル',F:'ファイティング（ベンチを離れた）',C:'ヘッドコーチのテクニカル',B:'ベンチのテクニカル'};
const AK={'1':'フリースロー成功','2':'2P成功','3':'3P成功','1x':'フリースロー失敗','2x':'2P失敗','3x':'3P失敗',TO:'タイムアウト',SUB:'交代'};
function gToday(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
const hhmm=()=>{const d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')};
function gBlank(n){return Array.from({length:n||12},()=>({no:'',name:'',lic:'',start:false,cap:false}))}
function gNew(){return {id:'g'+Date.now().toString(36),title:'',no:'',date:gToday(),time:'',endTime:'',place:'',qmin:10,otmin:5,
  refs:{cc:'',u1:'',u2:''},tos:{sc:'',asc:'',tm:'',sco:''},
  teams:[{name:'',coach:'',acoach:'',players:gBlank()},{name:'',coach:'',acoach:'',players:gBlank()}],period:1,rem:600000,runAt:0,ev:[],seq:0,court:null,arrow:null,locked:false}}
function gFix(g){g.refs=g.refs||{cc:'',u1:'',u2:''};g.tos=g.tos||{sc:'',asc:'',tm:'',sco:''};g.otmin=g.otmin||5;g.teams.forEach(t=>{t.acoach=t.acoach||'';t.players.forEach(p=>{p.lic=p.lic||'';p.cap=!!p.cap})});return g}
function gSave(){if(!G)return;G.updated=Date.now();const l=gLoad();const i=l.findIndex(x=>x.id===G.id);if(i>=0)l[i]=G;else l.unshift(G);gPut(l)}
const tn=ti=>(G.teams[ti].name||(ti?'Bチーム':'Aチーム'));
const perLen=p=>(p<=4?G.qmin:(G.otmin||5))*60000;
const pName=p=>p<=4?p+'Q':'延長'+(p-4);
function clockNow(){return G.runAt?Math.max(0,G.rem-(Date.now()-G.runAt)):G.rem}
function fmtClock(ms){if(ms>0&&ms<60000)return (Math.floor(ms/100)/10).toFixed(1);const s=Math.ceil(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
const fMark=f=>f.k+(f.comp?'c':(f.ft?String(f.ft):''));
const isFoul=k=>'PTUDF'.includes(k)&&k.length===1;
function gState(g){
  const st={pts:[0,0],per:{},tf:{},pl:[],to:[[],[]],run:[],coach:[[],[]],after:{}};
  g.teams.forEach((t,ti)=>{st.pl[ti]=t.players.map(p=>({pts:0,fg2:[0,0],fg3:[0,0],ft:[0,0],f:[],played:!!p.start}))});
  for(const e of g.ev){const ti=e.team;const P=e.p>=0?st.pl[ti][e.p]:null;
    st.per[e.per]=st.per[e.per]||[0,0];
    if(e.k==='SUB'){if(P)P.played=true}
    else if(e.k==='1'||e.k==='2'||e.k==='3'){const v=+e.k;st.pts[ti]+=v;st.per[e.per][ti]+=v;if(P){P.played=true;P.pts+=v;const a=v===1?P.ft:v===2?P.fg2:P.fg3;a[0]++;a[1]++}st.run.push({team:ti,p:e.p,v,total:st.pts[ti],per:e.per})}
    else if(e.k[1]==='x'){if(P){P.played=true;const v=+e.k[0];const a=v===1?P.ft:v===2?P.fg2:P.fg3;a[1]++}}
    else if(isFoul(e.k)&&P){P.f.push({k:e.k,per:e.per,ft:e.ft||0,comp:!!e.comp});if(e.k!=='F'){const k=Math.min(e.per,4);st.tf[k]=st.tf[k]||[0,0];st.tf[k][ti]++}}
    else if(e.k==='C'||e.k==='B'||e.k==='HD')st.coach[ti].push({k:e.k,per:e.per,ft:e.ft==null?1:e.ft,comp:!!e.comp});
    else if(e.k==='TO')st.to[ti].push({per:e.per,c:e.c});
    st.after[e.id]=st.pts.slice()}
  return st}
function outStatus(P){if(!P)return '';const T=P.f.filter(f=>f.k==='T').length,U=P.f.filter(f=>f.k==='U').length,D=P.f.some(f=>f.k==='D'||f.k==='F');
  if(D)return '失格・退場';if(T>=2||U>=2||(T>=1&&U>=1))return '失格・退場（GD）';if(P.f.length>=5)return '5ファウル退場';return ''}
function coachOut(list){const C=list.filter(x=>x.k==='C').length;return list.some(x=>x.k==='HD')||C>=2||list.length>=3}
const tfOf=(st,per,ti)=>(st.tf[Math.min(per,4)]||[0,0])[ti];
function toLeft(st,ti){const per=G.period;const used=st.to[ti];
  if(per<=2){const u=used.filter(x=>x.per<=2).length;return {left:Math.max(0,2-u),max:2,used:u}}
  if(per<=4){const u=used.filter(x=>x.per>=3&&x.per<=4);let left=3-u.length;
    if(per===4&&clockNow()<=120000){const inLast=u.filter(x=>x.per===4&&x.c<=120000).length;left=Math.min(left,2-inLast)}return {left:Math.max(0,left),max:3,used:u.length}}
  const u=used.filter(x=>x.per===per).length;return {left:Math.max(0,1-u),max:1,used:u}}
const roster=ti=>G.teams[ti].players.map((p,i)=>({p,i})).filter(x=>x.p.no!==''||x.p.name);
function ensureCourtSet(){if(!G.court){G.court=[0,1].map(ti=>G.teams[ti].players.map((p,i)=>p.start?i:-1).filter(i=>i>=0));for(const e of G.ev)if(e.k==='SUB'){const c=G.court[e.team];const j=c.indexOf(e.out);if(j>=0)c[j]=e.p;else if(!c.includes(e.p))c.push(e.p)}}}

// ---------------- 画面の切り替え ----------------
function gameRoute(h){showView('game');let m;
  if(h==='/game/new'){G=gNew();gSave();return go('/game/'+G.id+'/setup')}
  if((m=h.match(/^\/game\/([^/]+)(\/setup)?$/))){const g=gLoad().find(x=>x.id===m[1]);if(!g)return go('/game');G=gFix(g);gMode=m[2]?'setup':'rec';gSel=null;gFoul=null;gSub=null}
  else gMode='list';
  gRender()}
function gRender(){if(gMode==='list')return gList();if(gMode==='setup')return gSetup();gRec()}
const backBtn=id=>`<button id="${id}" aria-label="戻る" style="width:36px;height:36px;border-radius:10px;border:1px solid var(--line2);background:var(--bg2);display:grid;place-items:center;color:var(--sub);flex:none"><svg class="ic"><use href="#i-back"/></svg></button>`;

// ---------------- 一覧 ----------------
function gList(){const l=gLoad().map(gFix);
  $('game').innerHTML=`<div class="gtop"><h1>試合</h1><button class="btn sm fill" id="gnew"><svg class="ic"><use href="#i-plus"/></svg>新しい試合</button></div>`+
  (l.length?`<div class="glist">${l.map(g=>{const st=gState(g);const a=g.teams[0].name||'Aチーム',b=g.teams[1].name||'Bチーム';
    return `<button class="grow" data-id="${esc(g.id)}"><div class="tx"><b>${esc(a)} 対 ${esc(b)}${g.locked?' <span style="font-size:11px;color:var(--go);font-weight:700">確定</span>':''}</b><small>${esc([g.date,g.title,g.no?'第'+g.no+'試合':'',g.place].filter(Boolean).join('・'))}</small></div><div class="sc">${st.pts[0]} - ${st.pts[1]}</div><svg class="ic chev" style="color:var(--faint);width:16px"><use href="#i-chev"/></svg></button>`}).join('')}</div>`
  :`<div class="empty">記録した試合はありません。<br><button class="btn" id="gnew2"><svg class="ic"><use href="#i-plus"/></svg>新しい試合を記録する</button></div>`)+
  `<p class="note">FIBA・JBAの記録方法を参考にしたスコアシートです。得点・ファウル（フリースローの本数つき）・タイムアウト・交代を記録し、チームファウル、タイムアウトの残り、退場、ポゼッションの矢印を管理します。試合後は確定してA4の記録用紙に印刷できます。記録はこの端末にだけ保存されます。</p>`;
  const nw=()=>go('/game/new');if($('gnew'))$('gnew').onclick=nw;if($('gnew2'))$('gnew2').onclick=nw;
  $('game').querySelectorAll('.grow').forEach(b=>b.onclick=()=>go('/game/'+b.dataset.id))}

// ---------------- 設定 ----------------
function gSetup(){const g=G;const lk=g.locked?' disabled':'';
  const team=(t,ti)=>`<div class="card"><h3>${ti?'Bチーム':'Aチーム'}<small>先発5人・キャプテン1人に印</small></h3>
    <div class="form" style="grid-template-columns:1fr 1fr 1fr"><label><small>チーム名</small><input class="inp" data-f="name" data-t="${ti}" value="${esc(t.name)}" maxlength="30"${lk}></label><label><small>ヘッドコーチ</small><input class="inp" data-f="coach" data-t="${ti}" value="${esc(t.coach)}" maxlength="20"${lk}></label><label><small>アシスタントコーチ</small><input class="inp" data-f="acoach" data-t="${ti}" value="${esc(t.acoach)}" maxlength="20"${lk}></label></div>
    <div class="scrollx"><table class="ptable"><tr><th>番号</th><th>氏名</th><th>登録番号</th><th style="text-align:center">先発</th><th style="text-align:center">CAP</th></tr>
    ${t.players.map((p,i)=>`<tr><td class="no"><input class="inp num" data-t="${ti}" data-r="${i}" data-c="no" value="${esc(p.no)}" inputmode="numeric" maxlength="2"${lk}></td><td><input class="inp" data-t="${ti}" data-r="${i}" data-c="name" value="${esc(p.name)}" maxlength="20"${lk}></td><td style="width:110px"><input class="inp" data-t="${ti}" data-r="${i}" data-c="lic" value="${esc(p.lic)}" maxlength="12"${lk}></td><td class="st"><span class="ck${p.start?' on':''}" data-k="start" data-t="${ti}" data-r="${i}"></span></td><td class="st"><span class="ck${p.cap?' on':''}" data-k="cap" data-t="${ti}" data-r="${i}"></span></td></tr>`).join('')}</table></div>
    ${t.players.length<15&&!g.locked?`<button class="btn sm" data-add="${ti}" style="margin-top:8px"><svg class="ic"><use href="#i-plus"/></svg>行を追加</button>`:''}</div>`;
  const fld=(lab,f,val,cls,type)=>`<label class="${cls||''}"><small>${lab}</small><input class="inp"${type?` type="${type}"`:''} data-f="${f}" value="${esc(val)}" maxlength="40"${lk}></label>`;
  $('game').innerHTML=`<div class="gtop">${backBtn('gback')}<h1>試合の設定</h1>${g.ev.length?'':`<button class="btn sm" id="gdel"><svg class="ic"><use href="#i-trash"/></svg>削除</button>`}</div>
   ${g.locked?'<div class="verdict" style="margin-bottom:12px">この試合は確定済みです。内容を直す場合は、記録の画面で「確定を取り消す」を押してください。</div>':''}
   <div class="card"><h3>試合</h3><div class="form">${fld('大会名','title',g.title,'w2')}${fld('試合番号','no',g.no)}${fld('日付','date',g.date,'','date')}${fld('会場','place',g.place,'w2')}${fld('開始時刻','time',g.time,'','time')}
     <label><small>ピリオドの長さ</small><select data-f="qmin"${lk}>${[10,8,7,6,5,12].map(m=>`<option value="${m}"${g.qmin==m?' selected':''}>${m}分</option>`).join('')}</select></label><label><small>延長の長さ</small><select data-f="otmin"${lk}>${[5,3,2].map(m=>`<option value="${m}"${(g.otmin||5)==m?' selected':''}>${m}分</option>`).join('')}</select></label></div></div>
   <div class="card"><h3>審判・テーブルオフィシャルズ<small>記録用紙に印刷されます</small></h3><div class="form">${fld('主審','r.cc',g.refs.cc)}${fld('副審1','r.u1',g.refs.u1)}${fld('副審2','r.u2',g.refs.u2)}<span></span>${fld('スコアラー','o.sc',g.tos.sc)}${fld('アシスタントスコアラー','o.asc',g.tos.asc)}${fld('タイマー','o.tm',g.tos.tm)}${fld('ショットクロックオペレーター','o.sco',g.tos.sco)}</div></div>
   <div class="teams2">${g.teams.map(team).join('')}</div>
   <div class="erun" style="grid-template-columns:1fr;max-width:420px;margin:16px auto 0"><button class="btn fill" id="gstart">記録の画面へ</button></div>`;
  const root=$('game');
  root.querySelectorAll('input,select').forEach(el=>el.oninput=el.onchange=()=>{const t=el.dataset.t,f=el.dataset.f;
    if(el.dataset.r!=null){const c=el.dataset.c;let v=el.value;if(c==='no'){v=v.replace(/[^0-9]/g,'');el.value=v}G.teams[t].players[el.dataset.r][c]=v}
    else if(t!=null)G.teams[t][f]=el.value;
    else if(f.startsWith('r.'))G.refs[f.slice(2)]=el.value;else if(f.startsWith('o.'))G.tos[f.slice(2)]=el.value;
    else if(f==='otmin')G.otmin=+el.value;else if(f==='qmin'){G.qmin=+el.value;if(!G.ev.length&&!G.runAt)G.rem=perLen(G.period)}else G[f]=el.value;gSave()});
  root.querySelectorAll('.ck').forEach(c=>c.onclick=()=>{if(G.locked)return;const ps=G.teams[c.dataset.t].players;const p=ps[c.dataset.r];const k=c.dataset.k;
    if(k==='start'){if(G.ev.length&&!confirm('記録を始めた後に先発を変えますか？'))return;if(!p.start&&ps.filter(x=>x.start).length>=5){snack('先発は5人までです');return}p.start=!p.start;G.court=null}
    else{const on=!p.cap;ps.forEach(x=>x.cap=false);p.cap=on;root.querySelectorAll(`.ck[data-k="cap"][data-t="${c.dataset.t}"]`).forEach(x=>x.classList.remove('on'))}
    c.classList.toggle('on',p[k]);gSave()});
  root.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{G.teams[b.dataset.add].players.push(...gBlank(1));gSave();gSetup()});
  $('gback').onclick=()=>go(G.ev.length?'/game/'+G.id:'/game');
  if($('gdel'))$('gdel').onclick=()=>{if(confirm('この試合を削除しますか？元に戻せません。')){gPut(gLoad().filter(x=>x.id!==G.id));G=null;go('/game')}};
  $('gstart').onclick=()=>{const bad=[0,1].find(ti=>{const nos=roster(ti).map(x=>x.p.no).filter(v=>v!=='');return new Set(nos).size!==nos.length});
    if(bad!=null){snack((bad?'Bチーム':'Aチーム')+'に同じ番号があります');return}
    if(!roster(0).length||!roster(1).length){snack('両チームの選手を入力してください');return}
    const ns=[0,1].find(ti=>G.teams[ti].players.filter(p=>p.start).length!==5);if(ns!=null&&!confirm((ns?'Bチーム':'Aチーム')+'の先発が5人ではありません。このまま進みますか？'))return;
    go('/game/'+G.id)}}

// ---------------- 記録 ----------------
function gRec(){ensureCourtSet();const st=gState(G);const c=clockNow();const L=G.locked;
  const tinfo=ti=>{const tf=tfOf(st,G.period,ti);const to=toLeft(st,ti);
    return `<div class="tinfo"><span>ファウル<span class="dots">${[1,2,3,4,5].map(i=>`<i class="${i<=tf?'on':''}"></i>`).join('')}</span>${tf>=4?' <span class="bonus">次からペナルティ</span>':''}</span><span>TO 残り${to.left}<span class="dots to">${Array.from({length:to.max},(_,i)=>`<i class="${i<to.used?'on':''}"></i>`).join('')}</span></span></div>`};
  const pbtn=(ti,x,onC)=>{const P=st.pl[ti][x.i];const o=outStatus(P);const sel=(gSel&&gSel.t===ti&&gSel.p===x.i)||(gSub&&gSub.t===ti&&gSub.out===x.i);
    return `<button class="pb${sel?' sel':''}${o?' out':''}${onC?'':' bench'}" data-t="${ti}" data-p="${x.i}"><b>${esc(x.p.no||'-')}</b><small>${esc(x.p.name||'')}${x.p.cap?'（CAP）':''}</small><span class="pp">${P.pts}</span><span class="fl">${[0,1,2,3,4].map(i=>`<i class="${i<P.f.length?'on':''}"></i>`).join('')}</span></button>`};
  const teamBlock=ti=>{const onIdx=G.court[ti];const rs=roster(ti);const on=rs.filter(x=>onIdx.includes(x.i)),bench=rs.filter(x=>!onIdx.includes(x.i));
    const subMode=gSub&&gSub.t===ti;
    return `<div><div class="th3"><b>${esc(tn(ti))}</b><small>${coachOut(st.coach[ti])?'<span class="bonus">ヘッドコーチ失格・退場</span> ':''}${L?'':`<button class="btn sm" data-subt="${ti}" style="height:28px">${subMode?'交代をやめる':'交代'}</button>`}</small></div>
      ${subMode?`<div class="howto" style="margin:6px 0 0"><b>${gSub.out==null?'下がる選手':'入る選手'}</b>をタップしてください</div>`:''}
      <div class="lbl" style="margin:8px 0 4px">コート上（${on.length}人）</div><div class="pg">${on.map(x=>pbtn(ti,x,true)).join('')}</div>
      <div class="lbl" style="margin:10px 0 4px">ベンチ</div><div class="pg">${bench.map(x=>pbtn(ti,x,false)).join('')}<button class="pb team${gSel&&gSel.t===ti&&gSel.p===-1?' sel':''}" data-t="${ti}" data-p="-1">チーム<br>コーチ</button></div></div>`};
  let bar='';
  if(L)bar=`<div class="who"><span><b>試合終了</b>　記録は確定しています（終了 ${esc(G.endTime||'')}）</span><button id="gunlock" style="color:var(--sub);font-size:12.5px">確定を取り消す</button></div>`;
  else if(gFoul){const pl=gFoul.p>=0?G.teams[gFoul.t].players[gFoul.p]:null;
    bar=`<div class="who"><span><b>${esc(tn(gFoul.t))}${pl?'　#'+esc(pl.no)+' '+esc(pl.name):''}</b>　${FK[gFoul.k]}：フリースローは？</span><button id="gcan" style="color:var(--sub);font-size:12.5px">やめる</button></div>
     <div class="g" style="grid-template-columns:repeat(5,1fr)">${[0,1,2,3].map(n=>`<button class="a f" data-ft="${n}">${gFoul.k==='HD'?'D':gFoul.k}${n||''}<small>${n?n+'本':'なし'}</small></button>`).join('')}<button class="a ng" data-ft="c">${gFoul.k==='HD'?'D':gFoul.k}c<small>相殺</small></button></div>`}
  else if(!gSel)bar=`<div class="who"><span>${gSub?'交代を選んでいます':'選手をタップして記録'}</span><button id="gundo" style="color:var(--sub);font-size:12.5px">1つ戻す</button></div>`;
  else if(gSel.p===-1){const to=toLeft(st,gSel.t);bar=`<div class="who"><span><b>${esc(tn(gSel.t))}</b>　タイムアウト残り${to.left}回</span><button id="gcan" style="color:var(--sub);font-size:12.5px">やめる</button></div>
    <div class="g" style="grid-template-columns:repeat(4,1fr)"><button class="a ok" data-k="TO">TO<small>タイムアウト</small></button><button class="a f" data-k="C">C<small>ヘッドコーチのT</small></button><button class="a f" data-k="B">B<small>ベンチのT</small></button><button class="a f" data-k="HD">D<small>ヘッドコーチ失格</small></button></div>`}
  else{const pl=G.teams[gSel.t].players[gSel.p];const P=st.pl[gSel.t][gSel.p];
    bar=`<div class="who"><span><b>${esc(tn(gSel.t))}　#${esc(pl.no)} ${esc(pl.name)}</b>　${P.pts}点・ファウル${P.f.length}</span><button id="gcan" style="color:var(--sub);font-size:12.5px">やめる</button></div>
    <div class="g"><button class="a ok" data-k="2">2P<small>成功</small></button><button class="a ok" data-k="3">3P<small>成功</small></button><button class="a ok" data-k="1">FT<small>成功</small></button><button class="a ng" data-k="2x">2P<small>失敗</small></button><button class="a ng" data-k="3x">3P<small>失敗</small></button><button class="a ng" data-k="1x">FT<small>失敗</small></button></div>
    <div class="g g5"><button class="a f" data-k="P">P<small>パーソナル</small></button><button class="a f" data-k="T">T<small>テクニカル</small></button><button class="a f" data-k="U">U<small>アンスポ</small></button><button class="a f" data-k="D">D<small>失格</small></button><button class="a f" data-k="F">F<small>ファイティング</small></button></div>`}
  const arrow=G.arrow==null?'<span style="color:var(--faint)">―</span>':(G.arrow===0?'◀ '+esc(tn(0)):esc(tn(1))+' ▶');
  $('game').innerHTML=`<div class="gtop">${backBtn('gback')}<h1>${esc(G.title||(tn(0)+' 対 '+tn(1)))}</h1><button class="btn sm" id="gset">設定</button></div>
   <div class="sbd"><div class="tm"><div class="nm">${esc(tn(0))}</div><div class="pt">${st.pts[0]}</div>${tinfo(0)}</div>
     <div class="mid"><div class="pd">${pName(G.period)}</div><div class="clk ${G.runAt?'run':'stop'}" id="gclk" title="タップして時間を直す">${fmtClock(c)}</div>
       ${L?'':`<div class="cb"><button class="${G.runAt?'':'go'}" id="gcl">${G.runAt?'止める':'開始'}</button><button id="gnext">次へ</button></div>`}
       <button id="garrow" class="arrow" title="ポゼッションの矢印（次のジャンプボールの場面でボールを得るチーム）"${L?' disabled':''}>ポゼッション ${arrow}</button></div>
     <div class="tm"><div class="nm">${esc(tn(1))}</div><div class="pt">${st.pts[1]}</div>${tinfo(1)}</div></div>
   <div class="teams2">${teamBlock(0)}${teamBlock(1)}</div>
   <div class="abar" id="gbar">${bar}</div>
   <div class="gtabs" id="gtabs">${[['log','経過'],['stats','スタッツ'],['sheet','記録用紙']].map(x=>`<button data-v="${x[0]}" class="${gTab===x[0]?'on':''}">${x[1]}</button>`).join('')}</div>
   <div id="gpane"></div>
   ${L?'':`<div style="text-align:center;margin-top:18px"><button class="btn" id="gend">試合終了（記録を確定）</button></div>`}`;
  gPane(st);
  const root=$('game');
  root.querySelectorAll('.pb').forEach(b=>b.onclick=()=>{if(L)return;const t=+b.dataset.t,p=+b.dataset.p;
    if(gSub&&gSub.t===t&&p>=0){const onC=G.court[t].includes(p);
      if(gSub.out==null){if(!onC){snack('先に下がる選手（コート上）を選んでください');return}gSub.out=p;gRec();return}
      if(onC){gSub.out=p;gRec();return}
      if(outStatus(st.pl[t][p])){snack('退場した選手は出場できません');return}
      G.court[t]=G.court[t].map(x=>x===gSub.out?p:x);G.ev.push({id:++G.seq,per:G.period,c:Math.round(clockNow()),team:t,p,out:gSub.out,k:'SUB'});
      const pi=G.teams[t].players[p],po=G.teams[t].players[gSub.out];snack(tn(t)+' 交代：#'+po.no+' → #'+pi.no);gSub=null;gSave();gRec();return}
    gFoul=null;gSel=gSel&&gSel.t===t&&gSel.p===p?null:{t,p};gRec();if(gSel&&innerWidth<900)setTimeout(()=>$('gbar').scrollIntoView({block:'nearest',behavior:'smooth'}),30)});
  root.querySelectorAll('[data-subt]').forEach(b=>b.onclick=()=>{const t=+b.dataset.subt;gSel=null;gFoul=null;gSub=gSub&&gSub.t===t?null:{t,out:null};gRec()});
  root.querySelectorAll('#gbar [data-k]').forEach(b=>b.onclick=()=>{const k=b.dataset.k;if(k==='T'&&gSel.p>=0&&!G.court[gSel.t].includes(gSel.p)){if(confirm('ベンチの選手のテクニカルは、ヘッドコーチのB（ベンチ）として記録します。Bで記録しますか？')){gFoul={k:'B',t:gSel.t,p:-1};gRec()}return}
    if(isFoul(k)||k==='C'||k==='B'||k==='HD'){gFoul={k,t:gSel.t,p:gSel.p};gRec();return}gAdd(k,gSel.t,gSel.p)});
  root.querySelectorAll('#gbar [data-ft]').forEach(b=>b.onclick=()=>{const v=b.dataset.ft;gAdd(gFoul.k,gFoul.t,gFoul.p,{ft:v==='c'?0:+v,comp:v==='c'});gFoul=null});
  if($('gcan'))$('gcan').onclick=()=>{gSel=null;gFoul=null;gRec()};
  if($('gundo'))$('gundo').onclick=()=>{const e=G.ev.pop();if(!e){snack('記録がありません');return}if(e.k==='SUB')G.court[e.team]=G.court[e.team].map(x=>x===e.p?e.out:x);gSave();snack('取り消しました：'+gDesc(e));gRec()};
  if($('gunlock'))$('gunlock').onclick=()=>{if(confirm('試合の確定を取り消して、記録を直せるようにしますか？')){G.locked=false;gSave();gRec()}};
  if($('gend'))$('gend').onclick=()=>{const s2=gState(G);if(G.period<4){snack('4Qが終わるまで試合終了にはできません');return}if(s2.pts[0]===s2.pts[1]){snack('同点です。延長に進んでください');return}
    if(!confirm('試合を終了して記録を確定しますか？'))return;if(G.runAt){G.rem=clockNow();G.runAt=0}if(!G.endTime)G.endTime=hhmm();else if(G.endTime!==hhmm()&&confirm('終了時刻（'+G.endTime+'）を今の時刻（'+hhmm()+'）に変えますか？'))G.endTime=hhmm();G.locked=true;gSel=null;gSave();gTab='sheet';gRec()};
  $('gback').onclick=()=>go('/game');$('gset').onclick=()=>go('/game/'+G.id+'/setup');
  $('garrow').onclick=()=>{if(L)return;G.arrow=G.arrow==null?0:(G.arrow===0?1:0);gSave();gRec()};
  if($('gcl'))$('gcl').onclick=gClockToggle;
  if($('gnext'))$('gnext').onclick=()=>{const st2=gState(G);const n=G.period+1;
    if(G.period>=4&&st2.pts[0]!==st2.pts[1]){snack('同点ではないので延長はありません。「試合終了」で確定してください');return}
    if(!confirm(pName(n)+'へ進みますか？'))return;G.period=n;G.rem=perLen(n);G.runAt=0;
    if(G.arrow!=null&&confirm('ピリオドの始まりはオルタネイティングポゼッションのスローインです。スローインの後、矢印を反対に向けますか？'))G.arrow=G.arrow===0?1:0;gSave();gRec()};
  $('gclk').onclick=()=>{if(L)return;if(G.runAt){snack('時計を止めてから直してください');return}const v=prompt('残り時間（例 5:32）',fmtClock(G.rem));if(!v)return;const m=v.match(/^(\d{1,2})[:：](\d{1,2})$/)||v.match(/^(\d{1,2})$/);if(!m){snack('「分:秒」で入力してください');return}
    const ms=m[2]!=null?(+m[1]*60+ +m[2])*1000:+m[1]*60000;G.rem=Math.min(ms,perLen(G.period));gSave();gRec()};
  $('gtabs').onclick=e=>{const b=e.target.closest('button');if(!b)return;gTab=b.dataset.v;$('gtabs').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));gPane(gState(G))};
  clearInterval(gTick);gTick=setInterval(()=>{if(curView!=='game'||gMode!=='rec'||!G){clearInterval(gTick);return}const el=$('gclk');if(!el)return;const cn=clockNow();el.textContent=fmtClock(cn);
    if(G.runAt&&cn<=0){G.rem=0;G.runAt=0;gSave();snack(pName(G.period)+'終了');gRec()}},100);
}
function gClockToggle(){if(G.runAt){G.rem=clockNow();G.runAt=0}else{if(G.rem<=0){snack('「次へ」で次のピリオドに進んでください');return}G.runAt=Date.now();if(!G.time)G.time=hhmm()}gSave();gRec()}
function gDesc(e){const pl=e.p>=0?G.teams[e.team].players[e.p]:null;const who=esc(tn(e.team))+(pl?' #'+esc(pl.no)+' '+esc(pl.name):'');
  if(e.k==='SUB'){const po=G.teams[e.team].players[e.out];return esc(tn(e.team))+'　交代 #'+esc(po?po.no:'')+' → #'+esc(pl?pl.no:'')}
  if(isFoul(e.k)||e.k==='C'||e.k==='B'||e.k==='HD')return who+'　'+FK[e.k]+'（'+fMark({k:e.k==='HD'?'D':e.k,ft:e.ft==null&&(e.k==='C'||e.k==='B')?1:e.ft,comp:e.comp})+'）';
  return who+'　'+(AK[e.k]||e.k)}
function gAdd(k,team,p,x){x=x||{};
  let st=gState(G);
  if(k==='TO'&&toLeft(st,team).left<=0&&!confirm('タイムアウトの残りがありません。記録しますか？'))return;
  if(p>=0&&outStatus(st.pl[team][p])&&!confirm('この選手は退場しています。記録しますか？'))return;
  const c=Math.round(clockNow());const e={id:++G.seq,per:G.period,c,team,p,k};if(x.ft!=null)e.ft=x.ft;if(x.comp)e.comp=true;
  G.ev.push(e);
  const stop=isFoul(k)||k==='C'||k==='B'||k==='HD'||k==='TO'||((k==='2'||k==='3')&&G.period>=4&&c<=120000);
  if(stop&&G.runAt){G.rem=clockNow();G.runAt=0}
  gSave();st=gState(G);
  if(isFoul(k)){const pl=G.teams[team].players[p];const o=outStatus(st.pl[team][p]);
    snack('#'+pl.no+' '+(o?o+'。交代が必要です':FK[k]+'（'+st.pl[team][p].f.length+'個目）'));
    if(k!=='F'&&tfOf(st,G.period,team)===4)setTimeout(()=>snack(tn(team)+'のチームファウルが4つ。次のファウルからペナルティ（フリースロー）'),1700)}
  else if(k==='TO')snack(tn(team)+' タイムアウト（残り'+toLeft(st,team).left+'回）');
  else if(k==='C'||k==='B'||k==='HD')snack(tn(team)+' '+FK[k]+(coachOut(st.coach[team])?'。ヘッドコーチは失格・退場':''));
  else snack(gDesc(e).replace(/<[^>]+>/g,''));
  gSel=null;gRec()}
function gPane(st){const el=$('gpane');
  if(gTab==='log'){const list=G.ev.slice().reverse();
    el.innerHTML=list.length?`<ul class="glog">${list.map(e=>`<li><span class="t">${pName(e.per)} ${fmtClock(e.c)}</span><span class="x">${gDesc(e)}</span><span class="s">${st.after[e.id][0]}-${st.after[e.id][1]}</span>${G.locked?'':`<button data-del="${e.id}" aria-label="削除"><svg class="ic"><use href="#i-x"/></svg></button>`}</li>`).join('')}</ul>`:`<div class="empty">まだ記録がありません</div>`;
    el.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{const e=G.ev.find(x=>x.id==+b.dataset.del);if(!e)return;if(e.k==='SUB'){snack('交代は「1つ戻す」で取り消してください');return}
      if(confirm('「'+gDesc(e).replace(/<[^>]+>/g,'')+'」を削除しますか？')){G.ev=G.ev.filter(x=>x!==e);gSave();gRec()}});return}
  if(gTab==='stats'){const pers=Object.keys(st.per).map(Number).concat([1,2,3,4]).filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>a-b);
    let h=`<div class="qs" style="--nq:${pers.length}"><div class="h"></div>${pers.map(p=>`<div class="h">${pName(p)}</div>`).join('')}<div class="h">合計</div>`;
    [0,1].forEach(ti=>{h+=`<div class="n">${esc(tn(ti))}</div>${pers.map(p=>`<div>${st.per[p]?st.per[p][ti]:(p<=G.period?0:'')}</div>`).join('')}<div class="tt">${st.pts[ti]}</div>`});h+='</div>';
    const pct=a=>a[1]?`${a[0]}/${a[1]}`:'-';
    [0,1].forEach(ti=>{const rows=roster(ti);const tot={pts:0,fg2:[0,0],fg3:[0,0],ft:[0,0],f:0};
      h+=`<div class="cap" style="margin-top:20px">${esc(tn(ti))}</div><div class="scrollx"><table class="stt"><tr><th>番号</th><th>氏名</th><th>得点</th><th>2P</th><th>3P</th><th>FT</th><th>ファウル</th></tr>`+
      rows.map(x=>{const P=st.pl[ti][x.i];tot.pts+=P.pts;['fg2','fg3','ft'].forEach(k=>{tot[k][0]+=P[k][0];tot[k][1]+=P[k][1]});tot.f+=P.f.length;
        return `<tr><td>${esc(x.p.no)}</td><td>${esc(x.p.name)}${outStatus(P)?' <span class="bonus" style="font-size:10.5px">退場</span>':''}</td><td>${P.pts}</td><td>${pct(P.fg2)}</td><td>${pct(P.fg3)}</td><td>${pct(P.ft)}</td><td>${P.f.map(fMark).join(' ')||'-'}</td></tr>`}).join('')+
      `<tr class="tot"><td></td><td>合計</td><td>${tot.pts}</td><td>${pct(tot.fg2)}</td><td>${pct(tot.fg3)}</td><td>${pct(tot.ft)}</td><td>${tot.f}</td></tr></table></div>`});
    h+=`<p class="mini">2P・3P・FTは「成功/試投」。失敗も記録すると試投数に入ります。</p>`;el.innerHTML=h;return}
  el.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px"><span style="font-size:12.5px;color:var(--sub)">A4縦で印刷できます。PDFにする場合は、印刷画面で「PDFに保存」を選んでください。${G.locked?'':'<br>試合終了で確定すると、終了時刻と最後の線引きが入ります。'}</span><button class="btn sm fill" id="gprint"><svg class="ic"><use href="#i-print"/></svg>印刷・PDF</button></div><div class="sheetwrap">${sheetHTML(G,st)}</div>`;
  $('gprint').onclick=()=>{$('printsheet').innerHTML=sheetHTML(G,gState(G));setTimeout(()=>window.print(),50)}}

// ---------------- 記録用紙 ----------------
function sheetHTML(g,st){
  const fin=!!g.locked;const curPer=g.period;
  const box=(x,txt,dl)=>`<span class="box${x?' x':''}${dl?' dl':''}">${txt||''}</span>`;
  const team=ti=>{const t=g.teams[ti];const to=st.to[ti];const minute=x=>{const L=x.per<=4?g.qmin:(g.otmin||5);return Math.min(L,Math.floor((L*60000-x.c)/60000)+1)};
    const h1=to.filter(x=>x.per<=2),h2=to.filter(x=>x.per>=3&&x.per<=4),ot=to.filter(x=>x.per>4);
    const half1Done=curPer>=3||fin,half2Done=fin;
    const last2=curPer>4||fin||(curPer===4&&(g.runAt?Math.max(0,g.rem-(Date.now()-g.runAt)):g.rem)<=120000);
    const crossFirst=last2&&h2.filter(x=>!(x.per===4&&x.c<=120000)).length===0;
    const h2b=crossFirst?['X',h2[0],h2[1]]:[h2[0],h2[1],h2[2]];
    const toRow=`前半 ${[0,1].map(i=>box(0,h1[i]?minute(h1[i]):'',!h1[i]&&half1Done)).join('')}　後半 ${h2b.map(x=>x==='X'?box(0,'',1):box(0,x?minute(x):'',!x&&half2Done)).join('')}　延長 ${[0,1,2].map(i=>{const x=ot.find(y=>y.per===5+i);return box(0,x?minute(x):'',!x&&(fin||curPer>5+i))}).join('')}`;
    const tfRow=[1,2,3,4].map(q=>{const n=(st.tf[q]||[0,0])[ti];return `${q}Q ${[1,2,3,4].map(i=>box(i<=n)).join('')}`}).join(' ');
    const n=Math.max(12,t.players.length);
    const rows=t.players.slice(0,n).map((p,i)=>{const P=st.pl[ti][i];const f=P?P.f.slice():[];const o=outStatus(P);
      const fi=f.findIndex(x=>x.k==='F');
      const cells=[0,1,2,3,4].map(k=>{if(fi>=0&&k===fi)return `<td class="f">D<sub>${f[k].ft||''}</sub></td>`;if(fi>=0&&k>fi)return `<td class="f">F</td>`;if(f[k])return `<td class="f">${f[k].k}<sub>${f[k].comp?'c':(f[k].ft||'')}</sub></td>`;
        if(o&&k===f.length&&/GD/.test(o))return `<td class="f">GD</td>`;if(o&&/失格/.test(o))return `<td class="f xo"></td>`;return `<td class="f"></td>`});
      const mark=p.start?'<span class="xs">X</span>':(P&&P.played?'X':'');
      return `<tr><td style="width:12mm;font-size:6.5pt">${esc(p.lic)}</td><td class="nm">${esc(p.name)}${p.cap?' (CAP)':''}</td><td style="width:7mm">${esc(p.no)}</td><td style="width:7mm">${mark}</td>${cells.join('')}</tr>`}).join('');
    const cf=st.coach[ti];const cOut=coachOut(cf);
    const gdIdx=cOut&&!cf.some(x=>x.k==='HD')?cf.length:-1;
    const ccells=[0,1,2,3,4].map(k=>cf[k]?`<td class="f">${cf[k].k==='HD'?'D':cf[k].k}<sub>${cf[k].comp?'c':(cf[k].ft||'')}</sub></td>`:(k===gdIdx?`<td class="f">GD</td>`:`<td class="f${cOut?' xo':''}"></td>`)).join('');
    return `<table class="tb pl"><tr><td class="tn" colspan="9" style="text-align:left">チーム${ti?'B':'A'}：${esc(t.name)}</td></tr>
      <tr><td colspan="9" style="text-align:left;white-space:nowrap"><b style="display:inline-block;width:22mm">タイムアウト</b>${toRow}</td></tr>
      <tr><td colspan="9" style="text-align:left;white-space:nowrap"><b style="display:inline-block;width:22mm">チームファウル</b>${tfRow}</td></tr>
      <tr><th>登録番号</th><th>氏名</th><th>番号</th><th>出場</th><th colspan="5">ファウル</th></tr>${rows}
      <tr><th colspan="2" style="text-align:left">ヘッドコーチ：${esc(t.coach)}</th><td colspan="2"></td>${ccells}</tr>
      <tr><th colspan="2" style="text-align:left">アシスタントコーチ：${esc(t.acoach)}</th><td colspan="2"></td><td class="f"></td><td class="f"></td><td class="f"></td><td class="f"></td><td class="f"></td></tr></table>`};
  // ランニングスコア
  const mk=[{},{}];st.run.forEach(r=>{mk[r.team][r.total]={v:r.v,no:r.p>=0?g.teams[r.team].players[r.p].no:''}});
  const ends=[{},{}];[0,1].forEach(ti=>{const byPer={};st.run.filter(r=>r.team===ti).forEach(r=>byPer[r.per]=r.total);
    Object.keys(byPer).forEach(pr=>{if(+pr<curPer||fin)ends[ti][byPer[pr]]=1})});
  const last=[st.pts[0],st.pts[1]];
  const cell=(ti,n)=>{const m=mk[ti][n];const cls=['p'];if(m)cls.push(m.v===1?'m1':m.v===2?'m2':'m3');if(ends[ti][n])cls.push('end','circ');if(fin&&n===last[ti])cls.push('fin');if(fin&&n>last[ti])cls.push('void');
    return `<td class="${cls.join(' ')}">${m&&m.v===1?(ends[ti][n]?'<span>&nbsp;</span>':''):`<span>${n}</span>`}</td>`};
  const nocell=(ti,n)=>{const m=mk[ti][n];const cls=[];if(m&&m.v===3)cls.push('c3');if(ends[ti][n])cls.push('end');if(fin&&n===last[ti])cls.push('fin');if(fin&&n>last[ti])cls.push('void');
    return `<td class="${cls.join(' ')}">${m?(m.v===3?`<span>${esc(m.no)}</span>`:esc(m.no)):''}</td>`};
  const blocks=[0,1,2,3].map(b=>`<table><tr><th colspan="2">A</th><th colspan="2">B</th></tr>${Array.from({length:40},(_,i)=>{const n=b*40+i+1;return `<tr>${nocell(0,n)}${cell(0,n)}${cell(1,n)}${nocell(1,n)}</tr>`}).join('')}</table>`).join('');
  const pers=Object.keys(st.per).map(Number).concat([1,2,3,4]).filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>a-b);
  const win=!fin||st.pts[0]===st.pts[1]?'':(st.pts[0]>st.pts[1]?(g.teams[0].name||'チームA'):(g.teams[1].name||'チームB'));
  const sig=lab=>`<tr><th style="width:30mm;text-align:left">${lab}</th><td></td></tr>`;
  return `<div class="sheet"><h2>スコアシート</h2>
   <table class="hd"><tr><th style="width:17mm">チームA</th><td colspan="3">${esc(g.teams[0].name)}</td><th style="width:17mm">チームB</th><td colspan="3">${esc(g.teams[1].name)}</td></tr>
   <tr><th>大会名</th><td colspan="3">${esc(g.title)}</td><th>試合番号</th><td>${esc(g.no)}</td><th style="width:12mm">日付</th><td style="width:24mm">${esc(g.date)}</td></tr>
   <tr><th>会場</th><td colspan="3">${esc(g.place)}</td><th>開始時刻</th><td>${esc(g.time)}</td><th>時間</th><td>${g.qmin}分×4（延長${g.otmin||5}分）</td></tr>
   <tr><th>主審</th><td>${esc(g.refs.cc)}</td><th style="width:12mm">副審1</th><td>${esc(g.refs.u1)}</td><th>副審2</th><td colspan="3">${esc(g.refs.u2)}</td></tr></table>
   <div class="bd"><div>${team(0)}${team(1)}</div><div><div style="text-align:center;font-weight:700;font-size:8pt;margin-bottom:1mm">ランニングスコア</div><div class="rs">${blocks}</div></div></div>
   <div class="ft"><div><table><tr><th>ピリオド</th>${pers.map(p=>`<th>${pName(p)}</th>`).join('')}<th>合計</th></tr>${[0,1].map(ti=>`<tr><td>${ti?'B':'A'}：${esc(g.teams[ti].name)}</td>${pers.map(p=>`<td style="text-align:center">${st.per[p]?st.per[p][ti]:''}</td>`).join('')}<td style="text-align:center;font-weight:700">${st.pts[ti]}</td></tr>`).join('')}</table>
     <table style="margin-top:2mm"><tr><th style="width:24mm">最終スコア</th><td style="font-size:10pt;font-weight:700">チームA ${fin?st.pts[0]:''}　−　チームB ${fin?st.pts[1]:''}</td></tr><tr><th>勝者</th><td>${esc(win)}</td></tr><tr><th>試合終了時刻</th><td>${esc(g.endTime)}</td></tr></table></div>
     <table class="sg"><tr><th>スコアラー</th><td>${esc(g.tos.sc)}</td><th>主審</th><td></td></tr><tr><th>アシスタント<br>スコアラー</th><td>${esc(g.tos.asc)}</td><th>副審1</th><td></td></tr><tr><th>タイマー</th><td>${esc(g.tos.tm)}</td><th>副審2</th><td></td></tr><tr><th>ショットクロック<br>オペレーター</th><td>${esc(g.tos.sco)}</td><th>抗議時の<br>キャプテン</th><td></td></tr></table></div>
   <div class="note">記号：2P＝数字に斜線／3P＝斜線と番号に丸／フリースロー＝●／ピリオドの終わり＝最後の得点に丸と太線／試合終了＝二重線（残りの数字は使わない）。出場欄の丸つきXは先発、Xは途中出場。ファウル欄の小さい数字はフリースローの本数、cは相殺、GDは失格・退場。タイムアウト欄の数字はそのピリオドの経過分、二重線は使わなかった枠。白黒印刷のため、ピリオドごとの色分けはしていません。大会で使う場合は、主催者の定める記録用紙・手順に従ってください。</div></div>`}
