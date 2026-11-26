// =====================================================================
//  シミュレーション（座標はメートル。x：中央0、y：エンドラインから）
// =====================================================================
'use strict';
const HOOP={x:0,y:1.575};
const V=(x,y)=>({x,y});
const add=(a,b)=>V(a.x+b.x,a.y+b.y),sub=(a,b)=>V(a.x-b.x,a.y-b.y),mul=(a,k)=>V(a.x*k,a.y*k);
const len=a=>Math.hypot(a.x,a.y),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const unit=a=>{const l=len(a)||1;return V(a.x/l,a.y/l)};
const lerpV=(a,b,t)=>V(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const r2=v=>Math.round(v*100)/100;
function segDist(p,a,b){const ab=sub(b,a);const t=clamp(((p.x-a.x)*ab.x+(p.y-a.y)*ab.y)/((ab.x*ab.x+ab.y*ab.y)||1),0,1);return {d:dist(p,add(a,mul(ab,t))),t}}
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function interp(x,tb){if(x<=tb[0][0])return tb[0][1];for(let i=1;i<tb.length;i++){if(x<=tb[i][0]){const a=tb[i-1],b=tb[i];return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0])}}return tb[tb.length-1][1]}
function is3(p){return (Math.abs(p.x)>=6.6&&p.y<=2.99)||dist(p,HOOP)>=6.75}
const NUM=k=>k.slice(1);
const SPOTS={
  perim:[V(-6.9,0.9),V(6.9,0.9),V(-5.4,6.2),V(5.4,6.2),V(-2.7,8.5),V(2.7,8.5),V(0,8.9)],
  big:[V(-2.9,1.0),V(2.9,1.0),V(-2.45,5.8),V(2.45,5.8),V(-4.3,1.2),V(4.3,1.2)]
};
const COV={drop:'ドロップ',hedge:'ショウ',switch:'スイッチ',blitz:'ブリッツ',under:'アンダー'};
const COV_D={drop:'スクリーナーのマークが下がってゴール下を守る',hedge:'スクリーナーのマークが前に出てドリブルを止め、すぐ戻る',switch:'マークを交換する',blitz:'2人でボールマンを挟む',under:'ボールマンのマークがスクリーンの下を通る'};
const COV_LIST=['drop','hedge','switch','blitz','under'];
const DT=1/60;
let S=null;

function simulate(play,opt){
  opt=opt||{};
  const R=rng(opt.seed||1);
  const noDef=!!opt.noDef;
  const zone=!noDef&&(!!play.zone||opt.def==='zone');
  const lvl=opt.level==null?1:opt.level;
  const off={},def={};
  for(const k in play.start){const n=+k.slice(1);off[k]={id:k,n,p:V(play.start[k][0],play.start[k][1]),paintT:0,did:false}}
  if(!noDef)for(const k in off){const n=off[k].n,id='X'+n;
    def[id]={id,n,assign:k,p:V(0,0),role:'man',react:Math.max(0.07,0.13+R()*0.22-(lvl-1)*0.05),speed:[5.3,5.2,5.0,4.8,4.6][n-1]+R()*0.4+(lvl-1)*0.25,stun:0,late:0,stunCount:0,rotTo:null,roleT:0}}
  let cov=null;
  if(!zone&&!noDef)cov=opt.cov&&opt.cov!=='auto'?opt.cov:COV_LIST[Math.floor(R()*COV_LIST.length)];
  S={play,R,zone,off,def,cov,lvl,noDef,t:0,ball:{holder:play.ball,fl:null},phase:0,mv:{},scr:{},hist:[],log:[],shot:null,done:false,
     lastCatch:-1,catchOpen:0,catchDefDist:0,passes:0,helpId:null,tagId:null,events:{},frames:[],rec:opt.record!==false,nextThink:0,freeT:null,
     pending:null,bs:null,bsDone:{},repick:null,repicks:0,trap:null,drive:null,lastPasser:null,immune:{},aiT:0,cutter:null,phMv:[],phStart:[],
     dribbled:false,didCloseout:false,curMv:{},swings:0,stunMul:lvl===2?0.8:lvl===0?1.25:1};
  if(!noDef){const snap=snapshot();for(const id in def){def[id].p=zone?zoneTarget(def[id],snap):manTarget(def[id],snap)}
    log(zone?'守備：2-3ゾーン':'守備：マンツーマン／スクリーンには'+COV[cov],0,'def')}
  startPhase(0);
  let n=0;if(S.rec)frame();
  while(!S.done&&S.t<16){tick();if(S.rec&&(++n%2===0))frame()}
  if(S.rec)frame();
  const res={play,frames:S.frames,log:S.log,shot:S.shot,cov,zone,dur:S.t,phMv:S.phMv,phStart:S.phStart,noDef};
  return res;
}
function log(msg,lv,kind){const key=kind||msg;if(S.events[key])return;S.events[key]=1;S.log.push({t:r2(S.t),msg,lv:lv||0,kind:kind||''})}
function startPhase(i){
  S.phase=i;S.phaseStart=S.t;S.phStart[i]=S.t;const ph=S.play.phases[i];
  if(!ph){S.freeT=S.t;S.curMv={};return}
  let mv=ph.mv||{};
  if(ph.alt){const j=Math.floor(S.R()*ph.alt.length);mv=ph.alt[j].mv;log(ph.alt[j].t,1,'alt'+i)}
  S.curMv=mv;S.phMv[i]=mv;
  for(const k in mv){const m=mv[k];if(!S.off[k]||!m.p||!m.p.length)continue;let kind=m.k||'run';if(kind==='drib'&&S.ball.holder!==k)kind='run';
    S.mv[k]={path:m.p.map(q=>V(q[0],q[1])),k:kind,d:S.t+(m.d||0),s:m.s||(kind==='drib'?4.7:5.5),script:true}}
  if(ph.pass&&S.off[ph.pass[0]]&&S.off[ph.pass[1]])S.pending={from:ph.pass[0],to:ph.pass[1],ho:!!ph.ho,t0:S.t};
}
function snapshot(lag){
  const tt=S.t-(lag||0);let h=null;
  for(let i=S.hist.length-1;i>=0;i--){if(S.hist[i].t<=tt){h=S.hist[i];break}}
  if(!h){const off={};for(const k in S.off)off[k]=S.off[k].p;return {off,ball:ballPos(),holder:S.ball.holder,fl:S.ball.fl}}
  return h;
}
function ballPos(){const b=S.ball;if(b.fl&&S.t>=b.fl.t0){const f=b.fl;const t=clamp((S.t-f.t0)/f.dur,0,1);const to=f.to==='HOOP'?HOOP:S.off[f.to].p;return lerpV(f.from,to,t)}return b.holder&&S.off[b.holder]?S.off[b.holder].p:HOOP}
function rec(){const off={};for(const k in S.off)off[k]=V(S.off[k].p.x,S.off[k].p.y);S.hist.push({t:S.t,off,ball:ballPos(),holder:S.ball.holder,fl:S.ball.fl});if(S.hist.length>40)S.hist.shift()}
function holderOf(snap){return snap.fl?snap.fl.to:snap.holder}
function defOf(k){for(const id in S.def)if(S.def[id].assign===k)return S.def[id];return null}
function nearestDef(p){let m=null,md=1e9;for(const id in S.def){const d=dist(S.def[id].p,p);if(d<md){md=d;m=S.def[id]}}return m}
function onBallDef(k){return S.zone?nearestDef(S.off[k].p):defOf(k)}
function openness(k){if(S.noDef)return {d:9,who:null};let m=99,who=null;for(const id in S.def){const dd=dist(S.def[id].p,S.off[k].p);if(dd<m){m=dd;who=id}}return {d:m,who}}

// ---------------- 守備の立ち位置 ----------------
function manTarget(d,snap){
  const o=snap.off[d.assign];if(!o)return d.p;const ball=snap.ball;const h=holderOf(snap);
  const toH=unit(sub(HOOP,o));
  if(d.assign===h&&!snap.fl)return add(o,mul(toH,0.95));
  const db=dist(o,ball);
  if(S.play.deny===d.assign&&S.phase<=1&&S.ball.holder===S.play.ball)return add(add(o,mul(unit(sub(ball,o)),1.0)),mul(toH,0.2));
  const dk=dist(o,HOOP);
  if(dk<2.9){if(db<6.5)return add(o,mul(unit(sub(ball,o)),0.72));return add(add(o,mul(unit(sub(ball,o)),0.6)),mul(toH,0.45))}
  if(db<7.2)return add(add(o,mul(unit(sub(ball,o)),0.75)),mul(toH,0.55));
  const mid=lerpV(o,ball,0.36);return lerpV(mid,HOOP,0.28);
}
const ZH=[V(-2.0,6.3),V(2.0,6.3),V(-3.9,2.0),V(0,1.5),V(3.9,2.0)];
function zoneTarget(d,snap){
  const i=d.n-1;const h=holderOf(snap);const ball=snap.fl&&snap.fl.to!=='HOOP'&&snap.off[snap.fl.to]?snap.off[snap.fl.to]:snap.ball;
  const homes=ZH.map(z=>V(z.x+ball.x*0.32,z.y+(ball.y<4&&z.y>5?-1.4:0)));
  const home=homes[i];
  let near=0,best=1e9;homes.forEach((z,j)=>{const dd=dist(z,ball);if(dd<best){best=dd;near=j}});
  if(i===near)return add(ball,mul(unit(sub(HOOP,ball)),1.0));
  let tgt=null,bd=3.4;for(const k in snap.off){if(k===h)continue;const o=snap.off[k];const dd=dist(o,home);if(dd<bd){bd=dd;tgt=o}}
  if(tgt)return lerpV(home,lerpV(tgt,HOOP,0.25),0.45);
  return home;
}

// ---------------- 1フレーム ----------------
function tick(){
  if(S.done)return;
  S.t+=DT;rec();
  moveOffense();
  updateBall();
  if(!S.noDef){detectBallScreen();defenseBrain();moveDefense()}
  if(!S.shot&&!S.noDef){repickStep();holderAI();offballAI()}
  advancePhase();
  if(!S.noDef&&S.t>13.4&&!S.shot)forceShot();
  if(S.noDef&&S.phase>=S.play.phases.length&&S.t-S.freeT>0.7)S.done=true;
  for(const k in S.off){const o=S.off[k];if(dist(o.p,HOOP)<2.4){if(!o.paintT)o.paintT=S.t}else o.paintT=0}
}
function advancePhase(){
  if(S.phase>=S.play.phases.length)return;
  if(S.pending||(S.ball.fl&&!S.ball.fl.shot))return;
  const moving=Object.keys(S.curMv||{}).some(k=>S.mv[k]&&S.mv[k].script&&S.mv[k].path.length);
  if(!moving&&S.t-S.phaseStart>0.25)startPhase(S.phase+1);
}
function moveOffense(){
  for(const k in S.mv){const m=S.mv[k];const o=S.off[k];if(!m.path.length||S.t<m.d)continue;
    if(!m.started){m.started=true;if(S.scr[k]!==undefined)delete S.scr[k];
      if(m.k==='drib'&&k===S.ball.holder&&!S.noDef&&!S.zone){S.dribbled=true;const ob=defOf(k);if(ob&&!m.noLate)ob.late=Math.max(ob.late,0.1+S.R()*0.3)}}
    if(m.k==='drib'&&k!==S.ball.holder)m.k='run';
    let sp=m.s;if(S.trap&&S.trap.k===k&&m.k==='drib')sp=0;
    const tgt=m.path[0];const dv=sub(tgt,o.p);const L=len(dv);const step=sp*DT;
    if(L<=step){o.p=V(tgt.x,tgt.y);m.path.shift();if(!m.path.length&&m.k==='scr')S.scr[k]=S.t}
    else if(step>0)o.p=add(o.p,mul(unit(dv),step));
    o.p=V(clamp(o.p.x,-7.4,7.4),clamp(o.p.y,0.2,13.8));
  }
  const pd=S.pending;
  if(pd&&!S.ball.fl){
    if(S.ball.holder!==pd.from)S.pending=null;
    else{const rm=S.mv[pd.to];const moving=rm&&rm.path.length&&S.t>=rm.d;
      const near=dist(S.off[pd.from].p,S.off[pd.to].p);
      const ready=pd.ho?near<1.6:(!moving||S.t-pd.t0>0.9);
      if(ready||S.t-pd.t0>2.2){doPass(pd.from,pd.to,{script:true,ho:pd.ho});S.pending=null}}
  }
}
function doPass(from,to,o){o=o||{};const a=S.off[from].p,b=S.off[to].p;const d=dist(a,b);
  const spd=o.lob?8:o.skip?10.5:o.ho?6:11.5;
  S.ball.fl={from:V(a.x,a.y),to,t0:S.t,dur:Math.max(o.ho?0.15:0.22,d/spd),lob:!!o.lob,skip:!!o.skip,passer:from};
  S.passes++;S.lastPasser=from;S.lastPassT=S.t;
  if(S.mv[from]&&S.mv[from].k==='drib')S.mv[from].path=[];
  S.drive=null;S.trap=null;
  if(!o.script&&S.repick)S.repick=null;
  if(!o.script&&!S.noDef)passerFollow(from,to);
}
function updateBall(){const f=S.ball.fl;if(!f||S.t<f.t0)return;
  if(S.t-f.t0>=f.dur){
    if(f.to==='HOOP'){S.ball.fl=null;S.ball.holder=null;S.done=true;finishLog();return}
    S.ball.holder=f.to;S.ball.fl=null;S.lastCatch=S.t;S.dribbled=false;S.didCloseout=false;S.drive=null;
    if(!S.noDef){const op=openness(f.to);S.catchOpen=op.d;const md=onBallDef(f.to);S.catchDefDist=md?dist(md.p,S.off[f.to].p):9}
    if(f.lob)S.lobCatch=S.t;
    const m=S.mv[f.to];if(m)m.path=[];
    if(S.cutter===f.to)S.cutter=null;
    if(!S.noDef)rotateAfterCatch();
  }
}
function rotateAfterCatch(){
  endBS();
  for(const id in S.def){const d=S.def[id];if(d.role!=='man')d.roleT=0}
  if(S.zone){S.helpId=S.tagId=null;for(const id in S.def)S.def[id].role='man';return}
  const offs=Object.keys(S.off),defs=Object.keys(S.def);
  const need=defs.some(d=>S.def[d].role!=='man'||dist(S.def[d].p,S.off[S.def[d].assign].p)>3.2);
  for(const d of defs)S.def[d].role='man';
  S.helpId=null;S.tagId=null;
  if(!need)return;
  let best=null,bc=1e9;
  const perm=(arr,l)=>{if(!arr.length){let c=0;defs.forEach((d,i)=>{const o=l[i];const dd=dist(S.def[d].p,S.off[o].p);c+=dd*(o===S.ball.holder?2.2:1)+(S.def[d].assign===o?-1.4:0)});if(c<bc){bc=c;best=l.slice()}return}
    for(let i=0;i<arr.length;i++)perm(arr.slice(0,i).concat(arr.slice(i+1)),l.concat(arr[i]))};
  perm(offs,[]);
  const changes=[];defs.forEach((d,i)=>{if(S.def[d].assign!==best[i]){changes.push(d+'→'+NUM(best[i]));S.def[d].assign=best[i]}});
  if(changes.length>=2)log('ローテーション：'+changes.join('、'),1,'rot'+S.passes);
}

// ---------------- 守備：ボールスクリーンへの対応 ----------------
function detectBallScreen(){
  if(S.zone||S.ball.fl||!S.ball.holder)return;
  const h=S.ball.holder,hp=S.off[h].p;
  if(S.bs){if(S.t-S.bs.t0>2.6||S.ball.holder!==S.bs.h)endBS();return}
  for(const k in S.scr){if(k===h)continue;const sc=S.off[k].p;if(dist(hp,sc)>2.6)continue;
    const key=k+'@'+S.scr[k].toFixed(2);if(S.bsDone[key])continue;
    const m=S.mv[h];const using=(m&&m.k==='drib'&&m.path.length&&S.t>=m.d)||dist(hp,sc)<1.5;
    if(!using)continue;
    S.bsDone[key]=1;startBS(h,k);break}
}
function startBS(h,k){const ob=defOf(h),xs=defOf(k);if(!ob||!xs)return;
  const c=S.cov;S.bs={h,k,t0:S.t,cov:c,ob:ob.id,xs:xs.id};
  if(c==='drop'){xs.role='drop';log(xs.id+' ドロップ（下がってゴール下を守る）',0,'cv'+S.t)}
  if(c==='hedge'){xs.role='hedge';xs.roleT=S.t;log(xs.id+' ショウ（前に出てドリブルを止める）',0,'cv'+S.t)}
  if(c==='switch')S.bs.wantSwitch=true;
  if(c==='blitz'){xs.role='trap';ob.role='trap';S.trap={k:h,t0:S.t,scr:k};log(ob.id+'と'+xs.id+'がブリッツ（2人で挟む）',1,'cv'+S.t);
    if(S.mv[h])S.mv[h].path=[];
    const sr=add(HOOP,mul(unit(sub(S.off[k].p,HOOP)),Math.min(5.2,dist(S.off[k].p,HOOP)*0.62)));
    S.mv[k]={path:[sr],k:'run',d:S.t+0.3,s:5.2};log(NUM(k)+' ショートロール',0,'sr'+S.t);
    const tg=Object.values(S.def).filter(d=>d!==ob&&d!==xs).sort((a,b)=>dist(a.p,sr)-dist(b.p,sr))[0];
    if(tg){tg.role='tag';tg.rotTo=k;S.tagId=tg.id;log(tg.id+'が'+NUM(k)+'へ寄る → '+NUM(tg.assign)+'が空く',1,'bt'+S.t)}}
  if(c==='under'){S.immune[ob.id+k]=1;ob.role='under';log(ob.id+' アンダー（スクリーンの下を通る）',0,'cv'+S.t)}
}
function endBS(){const b=S.bs;if(!b)return;for(const id of [b.ob,b.xs]){const d=S.def[id];if(d&&['drop','hedge','under','trap'].includes(d.role))d.role='man'}S.bs=null;S.trap=null}

// ---------------- 守備の判断 ----------------
function defenseBrain(){
  if(S.zone||S.shot)return;
  const h=S.ball.holder;if(!h||S.ball.fl)return;
  const hp=S.off[h].p;const ob=defOf(h);const b=S.bs;
  if(b){const xs=S.def[b.xs],o2=S.def[b.ob];
    if(b.cov==='hedge'&&xs.role==='hedge'&&S.t-xs.roleT>0.9){xs.role='man';log(xs.id+' 自分のマークへ戻る',0,'hb'+b.t0)}
    if(b.cov==='drop'&&xs.role==='drop'&&dist(hp,HOOP)<3.2)xs.role='man';
    if(b.wantSwitch&&o2.assign===b.h&&(o2.stun>0||dist(o2.p,hp)>1.25)&&dist(xs.p,hp)<2.7){const a=o2.assign;o2.assign=xs.assign;xs.assign=a;b.wantSwitch=false;S.immune[xs.id+b.k]=1;S.immune[o2.id+b.k]=1;xs.role='man';o2.role='man';
      log(o2.id+'と'+xs.id+'がスイッチ',1,'sw'+b.t0);
      const m1=xs.n-S.off[xs.assign].n,m2=S.off[o2.assign].n-o2.n;if(Math.abs(m1)>=2||Math.abs(m2)>=2)log('ミスマッチ：'+NUM(xs.assign)+'に'+xs.id+'、'+NUM(o2.assign)+'に'+o2.id,1,'mm'+b.t0)}
    if(b.cov==='under'&&o2.role==='under'&&S.t-b.t0>0.4&&dist(hp,S.off[b.k].p)>2.0)o2.role='man';
    if(S.trap&&S.t-S.trap.t0>1.8){for(const d of [xs,o2])if(d.role==='trap')d.role='man';S.trap=null;log(NUM(h)+'がブリッツを抜ける',0,'te'+b.t0)}
  }
  const dh=dist(hp,HOOP);
  const beaten=!ob||dist(ob.p,hp)>1.1||ob.stun>0||(ob.late>0.05&&dist(ob.p,hp)>0.8);
  const still=!(S.mv[h]&&S.mv[h].path.length);
  const post=dh<3.6&&still&&!S.dribbled&&S.lastCatch>0&&S.t-S.lastCatch>0.7;
  if(!S.helpId&&!S.trap&&S.t-S.lastCatch>0.2&&((dh<4.8&&beaten)||dh<3.0||post)){
    const stop=add(hp,mul(unit(sub(HOOP,hp)),1.0));
    const cands=Object.values(S.def).filter(d=>d!==ob&&d.role!=='hedge'&&d.role!=='trap').map(d=>({d,c:dist(d.p,stop)+(dist(S.off[d.assign].p,hp)<3?2.5:0)+S.R()*0.8})).sort((a,b)=>a.c-b.c);
    if(cands.length&&cands[0].c<7){const hd=cands[0].d;S.helpId=hd.id;hd.role='help';
      log(hd.id+(post?' ポストにダブルチーム':' ヘルプ')+' → '+NUM(hd.assign)+'が空く',1,'help'+S.passes);
      const left=S.off[hd.assign].p;const c2=Object.values(S.def).filter(d=>d!==ob&&d!==hd&&d.role==='man').sort((a,b)=>dist(a.p,left)-dist(b.p,left))[0];
      if(c2&&dist(c2.p,left)<6.5){c2.role='rotate';c2.rotTo=hd.assign;S.tagId=c2.id;log(c2.id+'が'+NUM(hd.assign)+'へローテーション → '+NUM(c2.assign)+'が手薄',0,'rot2'+S.passes)}}
  }
  if(S.helpId){const hd=S.def[S.helpId];if(hd&&hd.role==='help'&&dh>5.8){hd.role='man';S.helpId=null}}
  if(!S.tagId){
    for(const k in S.off){if(k===h)continue;const o=S.off[k];const dk=dist(o.p,HOOP);const md=defOf(k);
      const cm=S.mv[k];const cutting=cm&&cm.path.length>0&&S.t>=cm.d&&S.t>0.8&&dist(cm.path[cm.path.length-1],HOOP)<dk-0.3;
      if(dk<3.0&&cutting&&md&&dist(md.p,o.p)>1.6){const tg=Object.values(S.def).filter(d=>d!==ob&&d!==md&&d.role==='man'&&d.id!==S.helpId).sort((a,b)=>dist(a.p,o.p)-dist(b.p,o.p))[0];
        if(tg&&dist(tg.p,o.p)<5.5){tg.role='tag';tg.rotTo=k;S.tagId=tg.id;log(tg.id+'がゴール下の'+NUM(k)+'へ寄る → '+NUM(tg.assign)+'が空く',1,'tag'+k+S.passes)}break}}
  }
}
function defTarget(d){
  const snap=snapshot(d.react);
  if(S.zone)return zoneTarget(d,snap);
  const h=S.ball.holder;
  if(d.role==='help'&&h&&!S.ball.fl){const ho=S.off[h].p;return add(ho,mul(unit(sub(HOOP,ho)),0.95))}
  if((d.role==='tag'||d.role==='rotate')&&d.rotTo){const o=S.off[d.rotTo].p;return d.role==='tag'?add(o,mul(unit(sub(HOOP,o)),0.6)):lerpV(lerpV(o,HOOP,0.3),S.off[d.assign].p,0.35)}
  if(d.role==='drop'&&h){const ho=snap.off[h];return add(HOOP,mul(unit(sub(ho,HOOP)),3.0))}
  if(d.role==='hedge'&&h){const ho=S.off[h].p;const m=S.mv[h];const nx=m&&m.path.length?m.path[0]:HOOP;return add(ho,mul(unit(sub(nx,ho)),1.0))}
  if(d.role==='trap'&&h){const ho=S.off[h].p;const toH=unit(sub(HOOP,ho));const side=V(-toH.y,toH.x);const s=(S.bs&&S.bs.xs===d.id)?1:-1;return add(add(ho,mul(toH,0.75)),mul(side,0.55*s))}
  if(d.role==='under'&&S.bs){const sc=S.off[S.bs.k].p;return add(sc,mul(unit(sub(HOOP,sc)),1.1))}
  if(S.ball.fl&&S.ball.fl.to===d.assign&&S.ball.fl.to!=='HOOP'&&S.t-S.ball.fl.t0>0.12+d.react*0.6){const o=S.off[d.assign].p;return add(o,mul(unit(sub(HOOP,o)),1.05))}
  return manTarget(d,snap);
}
function screenContact(){
  for(const sk in S.scr){const sc=S.off[sk].p;
    for(const id in S.def){const d=S.def[id];if(d.assign===sk||d.stun>0||S.immune[id+sk])continue;const me=S.off[d.assign];
      const key=id+sk;if(S._sc&&S._sc[key]&&S.t-S._sc[key]<1.5)continue;
      if(dist(me.p,sc)<1.15&&dist(d.p,sc)<1.9&&dist(d.p,me.p)>0.6){
        const a=unit(sub(me.p,sc)),b=unit(sub(d.p,sc));if(a.x*b.x+a.y*b.y<0.35){S._sc=S._sc||{};S._sc[key]=S.t;
          const xs=defOf(sk);const onBall=d.assign===S.ball.holder;
          if(!S.zone&&!onBall&&S.cov==='switch'&&xs&&dist(xs.p,me.p)<2.4&&xs.role==='man'){const a2=d.assign;d.assign=sk;xs.assign=a2;log(d.id+'と'+xs.id+'がスイッチ',1,'osw'+key);
            if(Math.abs(xs.n-S.off[a2].n)>=2)log('ミスマッチ：'+NUM(a2)+'に'+xs.id,1,'omm'+key);continue}
          if(!S.zone&&!onBall&&S.cov==='under'&&S.R()<0.7){S.immune[id+sk]=1;log(id+'はスクリーンの下をくぐる',0,'oun'+key);continue}
          if(S.R()<0.82){d.stun=(0.38+S.R()*0.3)*S.stunMul;d.stunCount++;log(id+'が'+NUM(sk)+'のスクリーンに掛かる',0,'st'+key+Math.floor(S.t))}
          else log(id+'はスクリーンをすり抜ける',0,'fi'+key)}}}}
}
function moveDefense(){
  screenContact();
  for(const id in S.def){const d=S.def[id];
    const tgt=defTarget(d);let dv=sub(tgt,d.p);const L=len(dv);
    if(d.late>0)d.late-=DT;
    const onb=S.ball.holder&&!S.ball.fl&&d.assign===S.ball.holder;
    const hd=onb&&((S.mv[d.assign]&&S.mv[d.assign].k==='drib'&&S.mv[d.assign].path.length)||S.drive);
    let sp=d.speed*(d.stun>0?0.3:1)*(d.late>0?0.45:1)*(hd?0.86:1);
    if(S.ball.fl&&S.ball.fl.to!=='HOOP'&&(S.zone?dist(tgt,S.off[S.ball.fl.to].p)<1.3:S.ball.fl.to===d.assign)&&L<2.2)sp*=0.6;
    if(d.role==='help'||d.role==='tag'||d.role==='trap')sp*=1.05;
    const step=Math.min(L,sp*DT);let np=L>0.01?add(d.p,mul(unit(dv),step)):d.p;
    for(const k in S.off){const o=S.off[k].p;const isScr=S.scr[k]!==undefined;const r=isScr?0.8:0.5;const dd=dist(np,o);
      if(dd<r&&dd>0){const push=unit(sub(np,o));const side=V(-push.y,push.x);const goSide=(side.x*dv.x+side.y*dv.y)>0?side:mul(side,-1);
        np=add(o,mul(push,r));np=add(np,mul(goSide,step*0.35));
        if(isScr&&d.stun<=0&&L>0.5&&d.assign!==k&&!S.immune[id+k]&&!(S._sc&&S._sc[id+k]&&S.t-S._sc[id+k]<1.5)){S._sc=S._sc||{};S._sc[id+k]=S.t;d.stun=0.42*S.stunMul;d.stunCount++;log(id+'が'+NUM(k)+'のスクリーンに掛かる',0,'st'+id+k+Math.floor(S.t))}}}
    for(const j in S.def){if(j===id)continue;const o=S.def[j].p;const dd=dist(np,o);if(dd<0.55&&dd>0)np=add(o,mul(unit(sub(np,o)),0.55))}
    d.p=V(clamp(np.x,-7.3,7.3),clamp(np.y,0.3,13.8));if(d.stun>0)d.stun-=DT;
  }
}

// ---------------- 攻撃：シュートの評価 ----------------
function shotModel(k,pos,open,o){
  const r=dist(pos,HOOP);const three=is3(pos);const pts=three?3:2;const n=S.off[k].n;let base,kind;
  if(r<1.7){base=0.62+(n>=4?0.05:0);kind=n>=4&&open>1.4?'ゴール下（ダンク）':'レイアップ'}
  else if(r<4.3){if(o.drib){base=0.41;kind='フローター'}else if(n>=4&&r<3.7){base=0.46;kind='フック'}else{base=0.41;kind='ショートジャンパー'}}
  else if(!three){if(o.drib){base=0.37;kind='プルアップ'}else{base=o.catch?0.41:0.39;kind='ミドル'}}
  else{const corner=Math.abs(pos.x)>=6.4&&pos.y<3.2;if(o.drib){base=0.32;kind='プルアップ3P'}else if(o.catch){base=corner?0.37:0.35;kind=corner?'コーナー3P':'キャッチ&シュート3P'}else{base=0.34;kind='3P'}if(n>=4)base-=0.04}
  if(o.step){base=0.31;kind='ステップバック3P'}
  const cf=r<1.7?interp(open,[[0.4,0.6],[1.0,0.8],[1.6,0.94],[2.2,1.0],[3.5,1.03]]):interp(open,[[0.4,0.52],[1.0,0.72],[1.6,0.88],[2.2,1.0],[3.5,1.08]]);
  let prob=base*cf;
  if(r<4.3&&!S.noDef){let rp=0;for(const id in S.def){const d=S.def[id];if(dist(d.p,HOOP)<1.8&&dist(d.p,pos)>open+0.05)rp++}if(rp>0)prob*=0.9}
  const md=S.zone?null:defOf(k);
  if(md&&r<4.3&&n-md.n>=2)prob+=0.06;
  if(md&&r>=4.3&&o.drib&&md.n-n>=2)prob+=0.03;
  prob=clamp(prob,0.05,0.8);
  return {ev:prob*pts,prob,pts,kind,r,three,open};
}
function selfShot(h,open,o){
  const hp=S.off[h].p;let e=shotModel(h,hp,open,o);
  const r=dist(hp,HOOP);
  if(o.drib&&open<1.25&&r>6.0&&r<7.8&&S.off[h].n<=3){const bp=add(hp,mul(unit(sub(hp,HOOP)),0.7));const e2=shotModel(h,bp,open+0.8,{drib:true,step:true});if(is3(bp)&&e2.ev>e.ev){e2.step=true;e2.open=open+0.8;e=e2}}
  return e;
}
// ---------------- 攻撃：パスの評価 ----------------
function laneOK(a,b){for(const id in S.def){const p=S.def[id].p;const sd=segDist(p,a,b);const L=dist(a,b);if(sd.t*L<0.9||(1-sd.t)*L<0.7)continue;if(sd.d<0.72)return false}return true}
function skipOK(a,b){const L=dist(a,b);for(const id in S.def){const p=S.def[id].p;const sd=segDist(p,a,b);const along=sd.t*L;if((along<1.6||L-along<2.0)&&sd.d<0.9)return false}return true}
function lobOK(a,b,k){
  if(dist(b,HOOP)>2.6||dist(a,b)<3||dist(a,HOOP)>7.5)return false;if(k&&S.mv[k]&&S.mv[k].path.length&&S.mv[k].ai!=='cut')return false;
  let near=0;for(const id in S.def)if(dist(S.def[id].p,b)<2.2)near++;if(near>1)return false;const toR=unit(sub(HOOP,b));
  for(const id in S.def){const p=S.def[id].p;const dp=dist(p,b);if(dp<1.5){const u=unit(sub(p,b));if(u.x*toR.x+u.y*toR.y>0.25)return false}if(dist(p,HOOP)<0.9)return false}return true
}
function passKind(h,k,o){const hp=S.off[h].p,rp=S.off[k].p;const dh=dist(hp,HOOP),dr=dist(rp,HOOP);
  if(o.lob)return 'ロブ';if(o.skip)return 'スキップパス';if(o.L<1.7)return '手渡し';
  if(dh<3.4&&dr<2.9)return 'ダンプオフ';
  if((S.drive||dh<4.6)&&is3(rp))return 'キックアウト';
  if(S.trap&&S.trap.k===h)return k===S.trap.scr?'ショートロールへのパス':'パス';
  if(S.t-S.lastCatch<0.9&&!S.dribbled&&S.passes>0)return 'エクストラパス';
  if(dr<2.6)return 'ゴール下へのパス';
  return 'パス';
}
function bestPass(h){const hp=S.off[h].p;let best=null;
  for(const k in S.off){if(k===h)continue;const o=S.off[k].p;let op=openness(k).d;const L=dist(hp,o);const raw=op;
    let ok=laneOK(hp,o),lob=false,skip=false;
    if(lobOK(hp,o,k)&&op<1.7){lob=true;ok=true;op=1.8}
    if(!ok&&L>7.5&&Math.sign(hp.x)!==Math.sign(o.x)&&skipOK(hp,o)){skip=true;ok=true}
    if(!ok)continue;
    const fly=L/(lob?8:skip?10.5:11.5)+0.25;const md=S.zone?null:defOf(k);
    let pd=op;
    if(S.zone)pd=op-4.4*fly*(skip?0.34:0.42);
    else if(!lob){if(md&&md.role==='man'&&dist(md.p,o)<=op+0.3)pd=op-md.speed*fly*0.55;else pd=op-4.2*fly*0.35}
    const rm=S.mv[k];const movingIn=rm&&rm.path.length&&rm.ai==='cut';
    const e=shotModel(k,o,Math.max(0.3,pd),{catch:true});
    let v=e.ev*0.94;
    if(k===S.lastPasser&&S.t-S.lastCatch<2.0)v*=0.6;
    if(movingIn&&dist(o,HOOP)>2.2)v*=0.85;
    if(!best||v>best.v)best={k,v,op:pd,raw,e,lob,skip,L,kind:passKind(h,k,{lob,skip,L})};
  }
  return best}
function reasonFor(k){const md=S.zone?null:defOf(k);
  if(S.zone)return 'ゾーンの隙間';
  if(!md)return '';
  if(md.role==='help')return md.id+'がヘルプに出た';
  if(md.role==='rotate'||md.role==='tag')return md.id+'が寄った';
  if(md.stunCount&&md.stun>-0.9)return md.id+'がスクリーンで遅れた';
  if(md.role==='hedge'||md.role==='drop'||md.role==='trap')return md.id+'がボールに寄った';
  if(S.tagId&&S.def[S.tagId]&&S.def[S.tagId].assign===k)return S.tagId+'が離れた';
  return '';
}

// ---------------- 攻撃：ボールマンの判断 ----------------
function holderAI(){
  if(S.ball.fl||S.pending)return;
  const h=S.ball.holder;if(!h)return;
  const ph=S.play.phases[S.phase];const free=S.phase>=S.play.phases.length;
  if(!free&&!(ph&&ph.dec))return;
  if(S.t<0.5||S.t-S.lastCatch<0.2)return;
  if(S.t<S.nextThink)return;S.nextThink=S.t+0.1;
  const hp=S.off[h].p;const ob=onBallDef(h);let op=openness(h);
  const m=S.mv[h];const moving=m&&m.path.length&&S.t>=m.d;
  const drib=(moving&&m.k==='drib')||!!S.drive||S.dribbled;
  const catchWin=S.t-S.lastCatch<0.7&&!moving&&!S.dribbled;
  if(catchWin&&S.catchOpen)op={d:Math.max(op.d,S.catchOpen*0.72),who:op.who};
  const self=selfShot(h,op.d,{catch:catchWin,drib:drib&&!catchWin});
  const best=bestPass(h);
  const thr=S.t<3?1.07:Math.max(0.8,1.01-0.04*Math.max(0,S.t-7));
  const helpOn=S.helpId&&S.def[S.helpId]&&S.def[S.helpId].role==='help';
  if(S.lobCatch&&S.t-S.lobCatch<0.5){S.lobCatch=0;const e=selfShot(h,Math.max(op.d,1.4),{catch:true});return shoot(h,e,'ロブを受けて')}
  if(S.trap&&S.trap.k===h){if(best&&best.v>0.45&&S.t-S.trap.t0>0.35)return pass(h,best,'ブリッツの外へ');return}
  if(self.r<1.7){if(best&&best.v>self.ev+0.1&&best.op>1.3)return pass(h,best);return shoot(h,self)}
  if(S.drive&&self.r<3.8&&op.d<0.85){S.drive=null;if(m)m.path=[];log(NUM(h)+'が止められる',0,'stop'+S.passes);
    if(best&&best.v>Math.max(0.55,self.ev+0.05))return pass(h,best,'ドライブで守備を集めた');
    if(self.ev>=0.62||S.t>11||S.resets>=2)return shoot(h,self);
    return resetOut(h)}
  if(S.reset){if(moving)return;S.reset=false;S.freeT=S.t}
  if(self.ev>=thr&&(!best||best.v<self.ev+0.25))return shoot(h,self);
  if(catchWin&&!S.didCloseout&&ob&&self.r>=5.2&&!S.zone){const dd=dist(ob.p,hp);
    if(dd<1.5&&dd>0.4&&S.catchDefDist>1.8&&(!best||best.v<self.ev+0.3)){S.didCloseout=true;
      if(S.R()<0.4){ob.stun=0.5*S.stunMul;ob.stunCount++;log(NUM(h)+'のポンプフェイクで'+ob.id+'が跳ぶ',1,'pf'+S.passes)}
      else{ob.late=0.35;log(NUM(h)+'がクローズアウトを抜く',1,'co'+S.passes)}
      return startDrive(h,'closeout')}}
  const pthr=helpOn?thr*0.82:thr;
  if(best&&best.v>=Math.max(pthr,self.ev+(helpOn?0.05:0.15)))return pass(h,best);
  if(!free)return;
  const tf=S.t-S.freeT;
  if(!S.drive&&!S.repick&&!moving&&tf>0.45){
    if(dist(hp,HOOP)<4.2){if(best&&best.v>0.55)return pass(h,best);if(self.ev>=0.62||S.resets>=2||S.t>11)return shoot(h,self);return resetOut(h)}
    if(!S.zone&&S.repicks<1&&tf>0.6&&dist(hp,HOOP)>5.4&&pickScreener(h)&&S.R()<0.5)return startRepick(h);
    if(best&&best.v>0.62&&S.swings<2&&S.passes<5&&S.R()<(S.zone?0.6:0.3)){S.swings++;return pass(h,best,'ボールを回す')}
    return startDrive(h,'attack');
  }
  if(tf>3.8||S.passes>=6){if(best&&best.v>self.ev)return pass(h,best);return shoot(h,self)}
}
function resetOut(h){const hp=S.off[h].p;const sp=nearestFreeSpot(h,SPOTS.perim,hp)||V(0,8.6);
  S.mv[h]={path:[sp],k:'drib',d:S.t,s:4.4,started:true,noLate:true};S.reset=true;S.resets=(S.resets||0)+1;S.drive=null;
  log(NUM(h)+'が外へ戻してやり直し',1,'rs'+S.resets)}
function startDrive(h,why){const hp=S.off[h].p;const side=Math.sign(hp.x)||(S.R()<0.5?-1:1);
  const mid=[lerpV(hp,V(side*0.9,4.2),0.6),V(side*0.7,2.3),V(side*0.4,1.75)];
  const base=Math.abs(hp.x)>2.6?[V(side*Math.min(Math.abs(hp.x),5.6)*0.85,Math.min(hp.y,3.6)),V(side*2.2,1.3),V(side*0.9,1.25)]:null;
  const ob=onBallDef(h);
  const crowd=path=>{let c=0;for(const id in S.def){const d=S.def[id];if(d===ob)continue;for(const q of path){if(dist(d.p,q)<1.8){c++;break}}}return c};
  let path=mid,lane='中';if(base&&(crowd(base)<crowd(mid)||(crowd(base)===crowd(mid)&&S.R()<0.4))){path=base;lane='ベースライン側'}
  S.mv[h]={path:path.map(q=>V(q.x,q.y)),k:'drib',d:S.t,s:5.0,started:true};
  S.drive={t0:S.t,lane};S.dribbled=true;
  for(const k in S.off)S.off[k].did=false;
  if(ob&&why!=='closeout'&&!S.zone&&dist(ob.p,hp)<1.8)ob.late=Math.max(ob.late,0.12+S.R()*0.3);
  if(why==='attack')log(NUM(h)+'が'+lane+'へドライブ',1,'dr'+S.passes+S.t.toFixed(1));
}
function pickScreener(h){let best=null,bd=9;for(const k in S.off){if(k===h)continue;const o=S.off[k];if(o.n<4)continue;const d=dist(o.p,S.off[h].p);if(d<bd&&d>1.2){bd=d;best=k}}return best}
function startRepick(h){const k=pickScreener(h);const hp=S.off[h].p;const ob=defOf(h);
  const toH=unit(sub(HOOP,hp));let side=V(-toH.y,toH.x);
  if(Math.abs(hp.x)<1){if(S.R()<0.5)side=mul(side,-1)}else if(side.x*(-hp.x)<0)side=mul(side,-1);
  const base=ob?ob.p:add(hp,mul(toH,0.95));
  const spot=add(base,mul(side,0.85));
  S.mv[k]={path:[spot],k:'scr',d:S.t,s:5.2};S.repick={h,k,side,stage:0,t0:S.t};S.repicks++;
  if(S.mv[h])S.mv[h].path=[];
  log(NUM(k)+'がもう一度ボールスクリーン',1,'rp'+S.repicks);
}
function repickStep(){const r=S.repick;if(!r)return;
  if(S.ball.holder!==r.h||S.ball.fl){S.repick=null;return}
  if(r.stage===0&&S.scr[r.k]!==undefined){const sc=S.off[r.k].p;
    const p1=add(sc,add(mul(r.side,0.95),mul(unit(sub(HOOP,sc)),0.3)));
    const p2=lerpV(p1,HOOP,0.5);const p3=add(HOOP,mul(unit(sub(p2,HOOP)),1.5));
    S.mv[r.h]={path:[p1,p2,p3],k:'drib',d:S.t,s:4.8};S.drive={t0:S.t,lane:'スクリーン'};S.dribbled=true;
    const sc0=V(sc.x,sc.y);
    if(S.off[r.k].n>=5||S.R()<0.5){S.mv[r.k]={path:[lerpV(sc0,HOOP,0.55),add(HOOP,mul(unit(sub(sc0,HOOP)),1.2))],k:'run',d:S.t+0.45,s:5.4};log(NUM(r.k)+' ロール',0,'rl'+S.repicks)}
    else{const pop=nearestFreeSpot(r.k,SPOTS.perim,sc0)||sc0;S.mv[r.k]={path:[pop],k:'run',d:S.t+0.4,s:5};log(NUM(r.k)+' ポップ',0,'pp'+S.repicks)}
    r.stage=2}
  if(r.stage===0&&S.t-r.t0>2.2)S.repick=null;
  if(r.stage===2&&S.t-r.t0>4)S.repick=null;
}
function pass(h,b,pre){
  const why=pre||reasonFor(b.k);
  log(NUM(h)+'→'+NUM(b.k)+' '+b.kind+(why?'｜'+why:'')+'｜'+NUM(b.k)+'の守備まで'+b.raw.toFixed(1)+'m',2,'ps'+S.passes);
  doPass(h,b.k,{lob:b.lob,skip:b.skip,ho:b.L<1.7});
}
function shoot(h,e,pre){const hp=S.off[h].p;const op=e.open;
  const q=op>=2.2?'ノーマーク':op>=1.3?'少し余裕あり':'守備が目の前';
  log('シュート：'+NUM(h)+' '+e.kind+'｜'+q+'（'+Math.min(op,9).toFixed(1)+'m）｜成功率'+Math.round(e.prob*100)+'%',2,'shot');
  S.shot={by:h,kind:e.kind,pts:e.pts,prob:e.prob,ev:e.ev,open:op,q,pos:V(hp.x,hp.y),t:S.t,three:e.three,r:e.r};
  if(S.mv[h])S.mv[h].path=[];S.drive=null;
  S.ball.fl={from:V(hp.x,hp.y),to:'HOOP',t0:S.t+0.18,dur:0.75,shot:true};
}
function forceShot(){const h=S.ball.holder;if(!h||S.ball.fl)return;const op=openness(h);log('ショットクロック間際',1,'clock');shoot(h,selfShot(h,op.d,{drib:true}))}
function finishLog(){const s=S.shot;if(!s)return;log('結果：'+s.q+'の'+s.kind+'。期待得点 '+s.ev.toFixed(2)+'点',2,'end')}

// ---------------- 攻撃：ボールを持たない選手 ----------------
function occupied(p,except){for(const k in S.off){if(k===except)continue;const o=S.off[k];if(dist(o.p,p)<2.4)return true;const m=S.mv[k];if(m&&m.path.length&&dist(m.path[m.path.length-1],p)<2.4)return true}return false}
function nearestFreeSpot(k,list,from){let best=null,bd=1e9;for(const sp of list){if(occupied(sp,k))continue;const d=dist(sp,from);if(d<bd){bd=d;best=sp}}return best}
function aiMove(k,path,ai,s){if(S.scr[k]!==undefined)delete S.scr[k];S.mv[k]={path:path.map(q=>V(q.x,q.y)),k:'run',d:S.t,s:s||5.0,ai,started:true}}
function crowded(k){const o=S.off[k];for(const j in S.off){if(j===k)continue;if(dist(S.off[j].p,o.p)<2.3)return true}return false}
function paintBusy(k){for(const j in S.off){if(j===k)continue;if(dist(S.off[j].p,HOOP)<2.6)return true;const m=S.mv[j];if(m&&m.ai==='cut'&&m.path.length)return true}return false}
function passerFollow(from,to){
  if(S.phase<S.play.phases.length||S.zone)return;
  const md=defOf(from);const o=S.off[from];
  if(md&&dist(o.p,HOOP)>4.5&&!paintBusy(from)&&S.R()<0.3){
    const path=[lerpV(o.p,HOOP,0.5),add(HOOP,V((Math.sign(o.p.x)||1)*0.6,0.6))];aiMove(from,path,'cut',6.0);S.cutter=from;log(NUM(from)+' パス&カット',0,'gg'+S.passes)}
}
function offballAI(){
  if(S.t<S.aiT)return;S.aiT=S.t+0.2;
  const h=S.ball.fl?S.ball.fl.to:S.ball.holder;if(!h||h==='HOOP')return;
  const free=S.phase>=S.play.phases.length;const ph=S.play.phases[S.phase];
  const hp=S.off[h].p;
  const driving=!!S.drive&&!S.ball.fl&&dist(hp,HOOP)<7.2;
  if(S.cutter){const cm=S.mv[S.cutter];if(!(cm&&cm.path.length)&&S.ball.holder!==S.cutter)S.cutter=null}
  for(const k in S.off){if(k===h)continue;const o=S.off[k];
    const m=S.mv[k];const busy=m&&m.path.length;
    if(S.repick&&S.repick.k===k)continue;
    if(S.trap&&S.trap.scr===k)continue;
    if(!free&&ph&&S.curMv[k])continue;
    if(!free&&S.scr[k]!==undefined)continue;
    if(busy&&(m.script||m.ai==='cut'))continue;
    if(!free&&!driving)continue;
    if(driving){if(o.did)continue;const side=Math.sign(hp.x)||1;const baseL=S.drive.lane==='ベースライン側';const same=Math.sign(o.p.x)===side;
      if(same&&Math.abs(o.p.x)>5.6&&o.p.y<2.6&&baseL&&dist(o.p,hp)<4.6){o.did=true;aiMove(k,[V(side*5.5,5.0)],'lift');log(NUM(k)+'がコーナーからリフト',0,'lf'+k+S.passes);continue}
      if(!same&&o.p.y>3.8&&Math.abs(o.p.x)>3.6&&!baseL&&!occupied(V(-side*6.9,1.0),k)){o.did=true;aiMove(k,[V(-side*6.9,1.0)],'drift');log(NUM(k)+'が逆のコーナーへドリフト',0,'df'+k+S.passes);continue}
      if(o.n>=4&&dist(o.p,HOOP)<5&&!S.zone){const md=defOf(k);if(md&&(md.role==='help'||md.role==='drop')){o.did=true;const sx=Math.sign(o.p.x)||-side;aiMove(k,[V(sx*2.9,1.0)],'dunker');log(NUM(k)+'がダンカースポットへ',0,'dk'+k+S.passes);continue}}
      if(same&&o.p.y>3.6&&Math.abs(o.p.x)<4.5&&dist(o.p,hp)<4.2){o.did=true;const sp=nearestFreeSpot(k,SPOTS.perim,V(-o.p.x*0.6,8.6));if(sp){aiMove(k,[sp],'fill');log(NUM(k)+'がドライブの後ろへ動く',0,'bf'+k+S.passes)}continue}
      continue}
    if(busy)continue;
    if(!S.zone&&!S.cutter&&S.t-S.freeT>0.4&&!S.drive){const md=defOf(k);const dk=dist(o.p,HOOP);
      if(md&&dk>4.5&&!paintBusy(k)){
        const watch=dist(md.p,o.p)>2.5&&dist(hp,o.p)>4.5;
        const deny=segDist(md.p,o.p,hp).d<0.7&&dist(md.p,o.p)<1.4&&dist(o.p,hp)<7.5;
        if((watch&&S.R()<0.2)||(deny&&S.R()<0.35)){
          const path=[lerpV(o.p,HOOP,0.55),add(HOOP,V((Math.sign(o.p.x)||1)*0.5,0.5))];
          aiMove(k,path,'cut',6.2);S.cutter=k;log(NUM(k)+(deny?' バックドアカット':' ゴールへカット（'+md.id+'がボールを見ている）'),1,'ct'+k+S.passes);continue}}}
    if(S.zone&&o.n===5&&!S.drive&&Math.abs(hp.x)>3&&!occupied(V(0,5.4),k)&&dist(o.p,V(0,5.4))>1.5&&S.R()<0.25){aiMove(k,[V(0.2,5.4)],'flash');log('5がハイポストへフラッシュ',0,'fl'+S.passes);continue}
    const inPaint=o.paintT&&S.t-o.paintT>1.4;
    if(crowded(k)||inPaint){const sp=nearestFreeSpot(k,o.n>=4?SPOTS.big.concat(SPOTS.perim):SPOTS.perim,o.p);if(sp&&dist(sp,o.p)>0.8)aiMove(k,[sp],'space')}
  }
}

// ---------------- 記録 ----------------
function frame(){const o={},d={};for(const k in S.off){const p=S.off[k].p;o[k]=[r2(p.x),r2(p.y)]}
  for(const id in S.def){const x=S.def[id];d[id]=[r2(x.p.x),r2(x.p.y),x.role==='man'?0:1,x.stun>0?1:0,x.assign]}
  const f=S.ball.fl;let b,lift=0;const fly=f&&S.t>=f.t0;
  if(fly){const tt=clamp((S.t-f.t0)/f.dur,0,1);const to=f.to==='HOOP'?HOOP:S.off[f.to].p;b=lerpV(f.from,to,tt);lift=Math.sin(Math.PI*tt)*(f.shot?1.5:(f.lob||f.skip)?1.0:0.25)}
  else b=S.ball.holder?S.off[S.ball.holder].p:HOOP;
  S.frames.push({t:r2(S.t),o,d,b:[r2(b.x),r2(b.y),r2(lift)],h:fly?null:S.ball.holder,fl:fly&&f.to!=='HOOP'?[f.passer,f.to,r2(f.from.x),r2(f.from.y)]:null,sh:fly&&f.shot?[r2(f.from.x),r2(f.from.y)]:null,scr:Object.keys(S.scr),ph:S.phase});
}

// ---------------- 分析（何回も試す） ----------------
function trialSeeds(n,base){const a=[];for(let i=0;i<n;i++)a.push(((base||1)*7919+i*104729+13)%1000003+1);return a}
function summarize(list){
  const n=list.length;const shots=list.filter(r=>r.shot);
  const ppp=shots.reduce((s,r)=>s+r.shot.ev,0)/Math.max(1,n);
  const open=shots.filter(r=>r.shot.open>=2.2).length/Math.max(1,n);
  const zone={rim:0,mid:0,three:0};const by={};const kinds={};
  for(const r of shots){const s=r.shot;if(s.three)zone.three++;else if(s.r<4.3)zone.rim++;else zone.mid++;by[s.by]=(by[s.by]||0)+1;kinds[s.kind]=(kinds[s.kind]||0)+1}
  const t=shots.reduce((s,r)=>s+r.shot.t,0)/Math.max(1,shots.length);
  return {n,ppp,open,zone,by,kinds,t,shots:shots.map(r=>r.shot)};
}
if(typeof module!=='undefined')module.exports={simulate,summarize,trialSeeds,COV,COV_LIST};
