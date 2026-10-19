(function(){'use strict';
const LEGACY_MATCHUPS = window.MSU_DRAFT_DATA.LEGACY_MATCHUPS;
const LEGACY_SYNERGIES = window.MSU_DRAFT_DATA.LEGACY_SYNERGIES;
const STAT_MATCHUPS = window.MSU_DRAFT_DATA.STAT_MATCHUPS;
const STAT_SYNERGIES = window.MSU_DRAFT_DATA.STAT_SYNERGIES;
const BASE_WR = window.MSU_DRAFT_DATA.BASE_WR;
const FULL_CHAMPIONS = window.MSU_DRAFT_DATA.FULL_CHAMPIONS;
const STAT_HISTORIC = window.MSU_DRAFT_DATA.STAT_HISTORIC;

const START_POOL = window.MSU_DRAFT_DATA.START_POOL;
const META = window.MSU_DRAFT_DATA.META;
const TRAIT_GROUPS = window.MSU_DRAFT_DATA.TRAIT_GROUPS;

function tagsOf(name){const tag=new Set((META[name]?.tags||[]));for(const [t,group] of Object.entries(TRAIT_GROUPS))if(group.some(c=>canon(c)===canon(name)))tag.add(t);return tag;}
function enemyProfile(){const enemies=Object.values(state.enemy).filter(Boolean);const counts={};for(const c of enemies){for(const t of tagsOf(c))counts[t]=(counts[t]||0)+1;}return {enemies,counts};}
function strategicEffects(champ,role,our){
 const result={counter:0,synergy:0,hits:[]};const self=tagsOf(champ),profile=enemyProfile();
 if(!profile.enemies.length)return result;
 const add=(condition,points,label)=>{if(!condition)return;result.counter+=points;result.hits.push({kind:'counter',points,rule:{id:'strategy-'+canon(champ)+'-'+label,a:champ,b:'Enemy comp',note:label+' · heuristic, not win-rate evidence'},label:'Composition '+(points>0?'+':'')+points+': '+label});};
 const count=(t)=>profile.counts[t]||0;
 add(count('dive')>=2&&self.has('anti-dive'),6,'Anti-dive tools against '+count('dive')+' dive picks');
 add(count('dive')>=2&&self.has('immobile')&&!self.has('anti-dive'),-5,'Immobile vs multiple divers');
 add(count('frontline')>=2&&self.has('anti-tank'),6,'Sustained tank damage needed');
 add(count('frontline')>=3&&self.has('poke')&&!self.has('anti-tank')&&!self.has('hypercarry'),-3,'Poke may struggle into heavy frontline');
 add(count('engage')>=2&&self.has('peel'),4,'Peel versus heavy initiation');
 add(count('poke')>=2&&self.has('sustain'),4,'Sustain into poke composition');
 add(count('poke')>=3&&self.has('immobile')&&!self.has('poke'),-3,'Limited mobility into long-range poke');
 add(count('hypercarry')>=2&&self.has('pick'),3,'Catch threat on multiple carries');
 return result;
}
function renderEnemyProfile(){let target=$('enemyCompAnalysis');if(!target)return;const p=enemyProfile(),c=p.counts;
 const line=['dive','frontline','engage','poke','sustain','hypercarry','anti-dive','pick'].filter(k=>c[k]).map(k=>`<span class="traitChip">${escapeHTML(k)} <b>${c[k]}</b></span>`);
 const duos=[...STAT_SYNERGIES,...(state.importedStats||[]).filter(x=>x.type==='synergy')].filter(x=>x.games>=Number(state.statsMinGames)&&canon(state.enemy[x.role])===canon(x.champ)&&canon(state.enemy[x.allyRole])===canon(x.ally));
 const duoHtml=duos.map(x=>`<div class="small" style="padding:7px 0"><b>${escapeHTML(x.champ)} + ${escapeHTML(x.ally)}</b> — ${x.win.toFixed(2)}% observed duo WR (${x.delta>0?'+':''}${x.delta.toFixed(2)} pp vs ${escapeHTML(x.champ)} baseline; ${x.games.toLocaleString()} games) <a target="_blank" rel="noopener" href="${escapeHTML(x.source)}">${escapeHTML(x.site)} ${escapeHTML(x.patches)} ↗</a></div>`).join('');
 target.innerHTML=`<div class="card-title"><h3>Enemy composition reading</h3><span class="pill">${p.enemies.length}/5 locked</span></div><div>${line.join('')||'<span class="muted">Select enemies from the full roster to see strategic threats.</span>'}</div>${duos.length?'<h4 style="margin-top:12px">Observed enemy duos</h4>'+duoHtml:''}<p class="shortHelp">Archetypes are qualitative drafting heuristics, not measured counter rates. ${duos.length?'Duo differences are anchor-relative, not causal.':''} Measured same-role matchups are evaluated separately when sources exist.</p>`;
}
const START_RULES = window.MSU_DRAFT_DATA.START_RULES;
const ROLES=['TOP','JUNGLE','MID','ADC','SUPPORT'];
const ROLE_NAMES={TOP:'TOP',JUNGLE:'JG',MID:'MID',ADC:'ADC',SUPPORT:'SUP'};
const NEEDS=['frontline','engage','peel','poke','scaling','AD','AP','pick','teamfight','waveclear'];
const ASSIGN={default:{TOP:'Seth',JUNGLE:'Ian',MID:'David',ADC:'Chris',SUPPORT:'Tim'},swap:{TOP:'David',JUNGLE:'Ian',MID:'Seth',ADC:'Chris',SUPPORT:'Tim'}};
const STORAGE='msu-draft-proto-v5';
const PREV_STORAGE='msu-draft-proto-v4';
const V3_STORAGE='msu-draft-proto-v2';
const OLD_STORAGE='msu-draft-proto-v1';
const defaultState=()=>({series:createSeries(),config:'auto',nextRole:'ALL',phase:'early',midSkill:'average',topSkill:'average',strictBlinds:true,statsEnabled:true,statsTier:'all',statsMinGames:700,statsWeight:1,legacyEnabled:false,importedStats:[],our:{TOP:'',JUNGLE:'',MID:'',ADC:'',SUPPORT:''},enemy:{TOP:'',JUNGLE:'',MID:'',ADC:'',SUPPORT:''},bans:'',needs:[],pool:JSON.parse(JSON.stringify(START_POOL)),rules:JSON.parse(JSON.stringify(START_RULES))});
let state=defaultState();
try{const saved=JSON.parse(localStorage.getItem(STORAGE)||localStorage.getItem(PREV_STORAGE)||localStorage.getItem(V3_STORAGE)||localStorage.getItem(OLD_STORAGE)||'null'); if(saved&&Array.isArray(saved.pool)&&saved.pool.length){state=Object.assign(defaultState(),saved,{our:Object.assign(defaultState().our,saved.our||{}),enemy:Object.assign(defaultState().enemy,saved.enemy||{}),rules:Array.isArray(saved.rules)?saved.rules:JSON.parse(JSON.stringify(START_RULES))});}}catch(e){}
if(state.statsTier!=='all')state.statsTier='all';
if(!Array.isArray(state.importedStats))state.importedStats=[];
normalizeSeries();
const $=(id)=>document.getElementById(id);
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
const ALIASES={yasou:'yasuo',sorka:'soraka',orinn:'ornn',naut:'nautilus',lee:'leesin',j4:'jarvaniv',shyv:'shyvana',yuanara:'yunara',tf:'twistedfate',leo:'leona'};
function canon(s){const n=norm(s);return ALIASES[n]||n}
const used=()=>new Set([...fearlessLocked(),...Object.values(state.our),...Object.values(state.enemy),...state.bans.split(/[,\n;]/)].filter(Boolean).map(canon));
function save(){syncCurrentGame();try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch(e){}}
function notify(msg){let el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(notify._t);notify._t=setTimeout(()=>el.classList.remove('show'),2200)}
function playerEntries(mode,role){return state.pool.filter(e=>e.player===ASSIGN[mode][role] && e.role===role)}
function configurations(){return state.config==='auto'?['default','swap']:[state.config]}
function isValidMode(mode){
 const allied=Object.values(state.our).filter(Boolean).map(canon);
 if(new Set(allied).size!==allied.length)return false;const enemies=Object.values(state.enemy).filter(Boolean).map(canon);if(new Set(enemies).size!==enemies.length)return false;
 const offLimits=new Set([...Object.values(state.enemy),...state.bans.split(/[,\n;]/)].filter(Boolean).map(canon));
 if(allied.some(c=>offLimits.has(c)||fearlessLocked().has(c)))return false;
 if(enemies.some(c=>fearlessLocked().has(c)))return false;
 return ROLES.every(role=>!state.our[role]||playerEntries(mode,role).some(e=>canon(e.champ)===canon(state.our[role])));
}
function meta(champ){return META[champ]||{damage:'Mixed',tags:[]}}
function isPhysical(e){return meta(e.champ).damage==='AD'}
// Rule weights are editable heuristics, not measured win probabilities.
function interactionEffects(champ,role,our){
 const result={synergy:0,counter:0,hits:[]},self=canon(champ),allies=Object.entries(our).filter(([r,c])=>r!==role&&c).map(([r,c])=>canon(c));
 for(const rule of state.rules||[]){if(!rule.enabled)continue;
  const a=canon(rule.a),b=canon(rule.b),n=Number(rule.strength);
  if(!a||!b||!Number.isFinite(n))continue;
  if(rule.type==='synergy'){
   if(((a===self&&allies.includes(b))||(b===self&&allies.includes(a)))&&n>0){const v=Math.round(n*4);result.synergy+=v;result.hits.push({kind:'synergy',points:v,rule,label:'Synergy '+(v>0?'+':'')+v+': '+(a===self?rule.b:rule.a)+(rule.note?' — '+rule.note:'')});}
  }else if(rule.type==='counter'&&a===self){
   const opponents=rule.scope==='any'?ROLES: [role];
   const matching=opponents.find(r=>state.enemy[r]&&canon(state.enemy[r])===b);
   if(matching){const v=Math.round(n*5);result.counter+=v;result.hits.push({kind:'counter',points:v,rule,label:(v>0?'Advantage +':'Threat ')+v+': vs '+rule.b+' ('+matching+')'+(rule.note?' — '+rule.note:'')});}
  }
 }
 return result;
}
// Snapshot statistics: audited patch windows and sample counts; never infer missing records.
function statEffects(champ,role,our){
 const out={synergy:0,counter:0,hits:[]};if(!state.statsEnabled)return out;
 const minN=Number(state.statsMinGames)||0,scale=Number(state.statsWeight)||0,own=canon(champ);
 const matches=[...(state.importedStats||[]).filter(x=>x.type==='counter'),...STAT_MATCHUPS];
 const others=[...(state.importedStats||[]).filter(x=>x.type==='synergy'),...STAT_SYNERGIES];
 const opponent=state.enemy[role];
 if(opponent){let row=matches.find(x=>x.role===role&&canon(x.champ)===own&&canon(x.opp)===canon(opponent)&&x.games>=minN),win=row?.win;
  if(!row){const reverse=matches.find(x=>x.role===role&&canon(x.champ)===canon(opponent)&&canon(x.opp)===own&&x.games>=minN);
   if(reverse){row=reverse;win=100-reverse.win;}}
  if(row){const n=row.games;
   // Adjust matchup win rate relative to anchor base only when base is known (verified METAsrc anchor row set).
   const base=BASE_WR[role+'|'+canon(champ)]??BASE_WR[role+'|'+canon(row.champ)];
   const directionalDelta=(base!==undefined&&canon(row.champ)===own)?win-base:win-50;
   const confidence=n/(n+5000),v=Math.round(Math.max(-10,Math.min(10,directionalDelta*1.65*confidence))*scale);
   out.counter+=v;
   const note=`${row.site||'Imported'} patch ${row.patches}: ${win.toFixed(2)}% observed ${champ} win rate vs ${opponent} (${n.toLocaleString()} matches). ${base!==undefined&&canon(row.champ)===own?'Baseline adjusted':'Not baseline adjusted'}; not a causal counter rate.`;
   out.hits.push({kind:'counter',points:v,rule:{id:'verified-counter-'+role+'-'+own+'-'+canon(opponent),a:champ,b:opponent,note,source:row.source},label:note});
  }
 }
 for(const [otherRole,ally] of Object.entries(our)){
  if(!ally||role===otherRole)continue;
  const rec=others.find(x=>x.games>=minN&&((x.role===role&&canon(x.champ)===own&&x.allyRole===otherRole&&canon(x.ally)===canon(ally))||(x.allyRole===role&&canon(x.ally)===own&&x.role===otherRole&&canon(x.champ)===canon(ally))));
  if(!rec)continue;
  const n=rec.games,delta=rec.delta;
  // Baseline deltas can be inflated by strong partners: intentionally cap to 5 score points.
  const v=Math.round(Math.max(-5,Math.min(5,delta*1.6*n/(n+6000)))*scale);
  out.synergy+=v;
  const note=`${rec.site||'Imported'} patch ${rec.patches}: ${(rec.win??0).toFixed(2)}% duo win rate, ${(delta>=0?'+':'')+delta.toFixed(2)} pp vs ${rec.champ} baseline, ${n.toLocaleString()} games. Not partner-adjusted.`;
  out.hits.push({kind:'synergy',points:v,rule:{id:'verified-duo-'+canon(champ)+'-'+canon(ally),a:champ,b:ally,note,source:rec.source},label:note});
 }
 return out;
}
function scored(e,mode,role,our,ignoreBlind=false){
 const m=meta(e.champ), known=!!String(state.enemy[role]||'').trim(), early=state.phase==='early';
 if(!ignoreBlind&&!known&&e.blind==='Conditional'&&state.strictBlinds&&!e.approved)return null;
 const notes=[];
 let score=e.rated?19+Number(e.comfort||3)*10:49;
 if(e.rated)notes.push('Comfort '+e.comfort+'/5');else notes.push('Comfort unrated');
 if(!known){
   if(e.blind==='Safe'){score+=early?23:14;notes.push('Safe blind');}
   else if(e.blind==='Conditional'){score+=e.approved?3:-12;notes.push(e.approved?'B! approved':'B! unverified');}
   else{score+=early?-10:-5;notes.push('Unmarked blind');}
 }else{score+=5;notes.push('Enemy lane revealed · check patch evidence');}
 if(mode==='default'){score+=7;}
 const target=getTargetComp();if(target&&target.config===mode&&canon(target.picks?.[role])===canon(e.champ)){score+=8;notes.push('Prepared composition target (+8 heuristic)');}else{score+=0;}
 if(mode==='swap'&&role==='MID'&&ASSIGN[mode][role]==='Seth'){
  if(state.midSkill==='weak'&&['Zed','Yone','Yasuo'].includes(e.champ)){score+=19;notes.push('Seth carry vs weaker MID');}
  if(state.midSkill==='strong'&&['Zed','Yone','Yasuo'].includes(e.champ)){score-=12;notes.push('Risk vs stronger MID');}
 }
 if(mode==='swap'&&role==='TOP'&&state.topSkill==='strong'&&['Malphite','Ornn'].includes(e.champ)){score+=19;notes.push('David neutralizer vs strong TOP');}
 if(mode==='default'&&role==='TOP'&&state.midSkill==='strong'){score+=3;}
 const locked=Object.values(our).filter(Boolean);
 const lockedMeta=locked.map(meta);
 const lockedTags=new Set(lockedMeta.flatMap(x=>x.tags));
 const lockedAD=lockedMeta.filter(x=>x.damage==='AD').length;
 const lockedAP=lockedMeta.filter(x=>x.damage==='AP').length;
 if(!lockedTags.has('frontline')&&m.tags.includes('frontline')){score+=8;notes.push('Frontline coverage');}
 if(!lockedTags.has('engage')&&m.tags.includes('engage')){score+=7;notes.push('Engage coverage');}
 if(locked.length>=2){
   if(lockedAD===0&&m.damage==='AD'){score+=11;notes.push('Adds physical damage');}
   if(lockedAP===0&&m.damage==='AP'){score+=11;notes.push('Adds magic damage');}
   if(lockedAD>=2&&lockedAP===0&&m.damage==='AP'){score+=7;}
   if(lockedAP>=2&&lockedAD===0&&m.damage==='AD'){score+=7;}
 }
 for(const need of state.needs){if((need==='AD'||need==='AP')?m.damage===need:m.tags.includes(need)){
   const exists=need==='AD'||need==='AP'?lockedMeta.some(x=>x.damage===need):lockedTags.has(need);
   score+=exists?5:13; if(!exists)notes.push('Need: '+need);
 }}
 const manual=interactionEffects(e.champ,role,our);
 const stats=statEffects(e.champ,role,our);
 if(known&&!stats.hits.some(h=>h.kind==='counter'))notes.push('No verified numeric matchup sample vs selected lane opponent');
 const strategic=strategicEffects(e.champ,role,our);
 const effects={synergy:manual.synergy+stats.synergy,counter:manual.counter+stats.counter+strategic.counter,hits:[...manual.hits,...stats.hits,...strategic.hits]};
 score+=effects.synergy+effects.counter;
 for(const hit of effects.hits)notes.push(hit.label);
 return {score:Math.round(score),baseScore:Math.round(score-effects.synergy-effects.counter),synergyScore:effects.synergy,counterScore:effects.counter,hits:effects.hits,notes, e,mode,role,player:ASSIGN[mode][role]};
}
function openRoles(){return state.nextRole==='ALL'?ROLES.filter(r=>!state.our[r]):[state.nextRole].filter(r=>!state.our[r]);}
function getRecommendations(){const blocked=used(),res=[];for(const mode of configurations()){
 if(!isValidMode(mode))continue;
 for(const role of openRoles())for(const e of playerEntries(mode,role)){
  if(blocked.has(canon(e.champ)))continue;
  const s=scored(e,mode,role,state.our);if(s)res.push(s);
 }}
 res.sort((a,b)=>b.score-a.score||(a.mode==='default'?-1:1)||a.e.champ.localeCompare(b.e.champ));
 const uniq=[],seen=new Set();for(const r of res){const k=r.role+':'+canon(r.e.champ);if(!seen.has(k)){uniq.push(r);seen.add(k)}}return uniq;
}
function getLineup(mode){if(!isValidMode(mode))return {mode,valid:false,reason:'Current picks conflict with this role setup.'};
 let our={...state.our};
 for(const role of ROLES){if(our[role])continue;
  const taken=new Set([...fearlessLocked(),...Object.values(our),...Object.values(state.enemy),...state.bans.split(/[,\n;]/)].filter(Boolean).map(canon));
  const poss=playerEntries(mode,role).filter(e=>!taken.has(canon(e.champ))).map(e=>scored(e,mode,role,our)).filter(Boolean).sort((a,b)=>b.score-a.score);
  if(!poss.length)return {mode,valid:false,reason:'No eligible '+role+' champions remain.'};
  our[role]=poss[0].e.champ;
 }
 // Count pair synergy once, not twice: evaluate every role against only previous roles.
 let total=0,prior={TOP:'',JUNGLE:'',MID:'',ADC:'',SUPPORT:''};
 for(const role of ROLES){const e=playerEntries(mode,role).find(x=>canon(x.champ)===canon(our[role]));if(!e)return {mode,valid:false,reason:'Champion pool changed.'};
  const s=scored(e,mode,role,prior,true);total+=s?.score||0;prior[role]=our[role];
 }
 return {mode,valid:true,our,total};}

function pickOptions(role){const set=new Map();for(const mode of configurations())for(const e of playerEntries(mode,role))set.set(e.champ,e.champ);
 // Include current value even after config toggles; render invalid instead of silently deleting.
 if(state.our[role])set.set(state.our[role],state.our[role]);return [...set.keys()].sort((a,b)=>a.localeCompare(b));}
function playerLabel(role){const vals=[...new Set(configurations().map(m=>ASSIGN[m][role]))];return vals.join(' / ')}
function renderDraft(){renderSeriesBar();for(const key of ['config','nextRole','phase','midSkill','topSkill'])$(key).value=state[key];$('strictBlinds').checked=state.strictBlinds;$('statsEnabled').checked=state.statsEnabled;
 $('pickRows').innerHTML=ROLES.map(role=>`<tr><td class="role">${ROLE_NAMES[role]}<span class="assigned">${playerLabel(role)}</span></td><td class="ours"><select aria-label="Our ${role} pick" data-our="${role}"><option value="">— not picked —</option>${pickOptions(role).map(c=>`<option value="${escapeHTML(c)}" ${c===state.our[role]?'selected':''} ${fearlessLocked().has(canon(c))?'disabled':''}>${escapeHTML(c)}</option>`).join('')}</select></td><td class="opp"><select aria-label="Enemy ${role} pick from complete roster" data-enemy="${role}"><option value="">— unknown —</option>${FULL_CHAMPIONS.map(c=>`<option value="${escapeHTML(c)}" ${canon(c)===canon(state.enemy[role])?'selected':''} ${fearlessLocked().has(canon(c))?'disabled':''}>${escapeHTML(c)}</option>`).join('')}</select></td></tr>`).join('');
 $('bans').value=state.bans;
 let enemyNames=Object.values(state.enemy).filter(Boolean).map(canon);let enemyDuplicates=enemyNames.some((c,i)=>enemyNames.indexOf(c)!==i);let enemyBanned=enemyNames.some(x=>state.bans.split(/[,\n;]/).some(y=>canon(y)===x));let valid=configurations().filter(isValidMode);let duplicates=Object.values(state.our).filter(Boolean).map(canon).some((x,i,a)=>a.indexOf(x)!==i);
 const enemyDup=Object.values(state.our).filter(Boolean).some(x=>Object.values(state.enemy).some(y=>canon(y)===canon(x)));
 const bannedDup=Object.values(state.our).filter(Boolean).some(x=>state.bans.split(/[,\n;]/).some(y=>canon(y)===canon(x)));
 $('draftValidation').innerHTML=enemyDuplicates?'<span style="color:var(--coral)">⚠ Enemy champion entered in multiple roles.</span>':enemyBanned?'<span style="color:var(--coral)">⚠ Enemy pick is also banned.</span>':duplicates?'<span style="color:var(--coral)">⚠ Duplicate allied champion selected. Fix the picks.</span>':enemyDup?'<span style="color:var(--coral)">⚠ A champion is selected by both teams.</span>':bannedDup?'<span style="color:var(--coral)">⚠ One of our picks is banned.</span>':valid.length?`<span style="color:var(--mint)">✓ ${valid.length} compatible role setup${valid.length>1?'s':''}</span>`:'<span style="color:var(--coral)">⚠ Current allied picks do not fit the selected role setup.</span>';
 $('needsChips').innerHTML=NEEDS.map(n=>`<label class="need ${state.needs.includes(n)?'active':''}"><input type="checkbox" data-need="${n}" ${state.needs.includes(n)?'checked':''}>${n==='AD'?'Physical damage':n==='AP'?'Magic damage':n[0].toUpperCase()+n.slice(1)}</label>`).join('');
 renderRecommendations();renderLineups();renderInteractionTracker();renderEnemyProfile();}
let showAllRecs=false;
function renderRecommendations(){let allRecs=getRecommendations(),q=canon($('recSearch').value),recs=allRecs.filter(r=>!q||canon([r.e.champ,r.role,r.player].join(' ')).includes(q)),summary=$('recSummary'),list=$('recList');const picks=Object.values(state.our).filter(Boolean).length;const valid=configurations().filter(isValidMode).length;
 summary.innerHTML=`<div class="heroresult"><div class="eyebrow">Decision board</div><div class="headline">${5-picks} slots remaining</div><div class="col-scores"><div class="metric"><strong>${valid}</strong><span>Legal setups</span></div><div class="metric"><strong>${allRecs.length}</strong><span>Eligible options</span></div><div class="metric"><strong>${state.needs.length}</strong><span>Team priorities</span></div></div><div class="tiny muted">Scores rank your editable rules; they are not win probabilities.</div></div>`;
 $('recShowAll').textContent=showAllRecs?'Top 6':'Show all ('+allRecs.length+')';$('recShowAll').classList.toggle('hidden',allRecs.length<=6||!!q);
 if(!valid){list.innerHTML='<div class="empty">No legal role setups. Change the assignment or correct a locked pick.</div>';return}
 if(!recs.length){list.innerHTML='<div class="empty">No picks to recommend. Either all roles are filled, the chosen role is already locked, or restrictions are too tight.</div>';return}
 list.innerHTML=recs.slice(0,(showAllRecs||q)?recs.length:6).map((r,i)=>`<article class="rec"><div class="recTop"><div><div class="tiny" style="color:var(--gold);font-weight:800">#${i+1} · ${ROLE_NAMES[r.role]} · ${escapeHTML(r.player)} ${r.mode==='swap'?'<span class="pill">SWAP</span>':''}</div><h3>${escapeHTML(r.e.champ)}</h3><div class="recsub">${r.e.blind==='Safe'?'<span class="pill safe">B · SAFE</span>':r.e.blind==='Conditional'?'<span class="pill conditional">B! · CONDITIONAL</span>':'<span class="pill unknown">UNMARKED</span>'} ${r.e.star?'<span class="pill">*</span>':''}${r.e.F?'<span class="pill">F</span>':''}</div></div><div class="score" title="Heuristic points, not probability">${r.score}<span class="tiny muted"> pts</span></div></div><div class="impactline"><span>Base <b>${r.baseScore}</b></span><span class="${r.synergyScore<0?'negative':r.synergyScore>0?'positive':''}">Synergy <b>${r.synergyScore>0?'+':''}${r.synergyScore}</b></span><span class="${r.counterScore<0?'negative':r.counterScore>0?'positive':''}">Matchups <b>${r.counterScore>0?'+':''}${r.counterScore}</b></span></div><div class="reason">${r.notes.filter(x=>!x.startsWith('Synergy ')&&!x.startsWith('Advantage ')&&!x.startsWith('Threat ')).slice(0,3).map(x=>`<span>${escapeHTML(x)}</span>`).join('')}</div>${r.hits.length?`<div class="ruleHint">${r.hits.slice(0,3).map(h=>`<span class="pill ${h.points<0?'warn':'safe'}" title="${escapeHTML(h.rule.note)}">${escapeHTML(h.kind==='synergy'?'Combo':'Counter')}: ${h.points>0?'+':''}${h.points} ${escapeHTML(h.rule.b)}</span>`).join('')}</div>`:''}<div class="recBottom"><small>${r.mode==='default'?'Default: Seth TOP / David MID':'Swap: David TOP / Seth MID'}</small><button class="btn ghost" data-newrule="${escapeHTML(r.e.champ)}">+ Rule</button><button class="btn primary" data-lock="${escapeHTML(r.e.champ)}" data-role="${r.role}" data-mode="${r.mode}">Lock pick →</button></div></article>`).join('');}
function renderLineups(){let lineups=['default','swap'].map(getLineup),valid=lineups.filter(x=>x.valid),max=valid.length?Math.max(...valid.map(x=>x.total)):null;
 $('lineupCompare').innerHTML=`<div class="twocol">${lineups.map(l=>`<div class="lineup ${l.valid&&l.total===max?'winner':''}"><h3>${l.mode==='default'?'DEFAULT':'SWAP'}</h3><div class="points">${l.valid?l.total+' combined pts':'Not legal'}</div>${l.valid?ROLES.map(role=>`<div class="lineuprow"><span>${ROLE_NAMES[role]}</span><span title="${ASSIGN[l.mode][role]}">${escapeHTML(l.our[role])}</span></div>`).join(''):`<p class="tiny muted" style="min-height:143px">${escapeHTML(l.reason)}</p>`}<button class="btn" data-apply="${l.mode}" ${l.valid?'':'disabled'}>Load this lineup</button></div>`).join('')}</div>`;
}
function renderPool(){const q=norm($('poolSearch').value),p=$('poolPlayer').value,r=$('poolRole').value;const shown=state.pool.map((e,i)=>({...e,i})).filter(e=>(p==='ALL'||e.player===p)&&(r==='ALL'||e.role===r)&&(!q||norm(e.champ+' '+e.player+' '+e.raw).includes(q)));
 $('poolCount').textContent=`Showing ${shown.length} of ${state.pool.length} entries`;
 $('poolRows').innerHTML=shown.map(e=>`<tr><td><strong>${e.player}</strong><small>${e.role}</small></td><td><input class="nameInput" value="${escapeHTML(e.champ)}" aria-label="Champion name" data-index="${e.i}" data-prop="champ"><small>Original: ${escapeHTML(e.raw)}</small></td><td><select class="tinyInput" data-index="${e.i}" data-prop="comfort">${[1,2,3,4,5].map(n=>`<option ${e.comfort===n?'selected':''} value="${n}">${n}/5</option>`).join('')}</select><small>${e.rated?'Rated':'Unrated default'}</small></td><td><select class="blindSelect" data-index="${e.i}" data-prop="blind">${['Safe','Conditional','Unmarked'].map(o=>`<option ${e.blind===o?'selected':''}>${o}</option>`).join('')}</select></td><td>${e.star?'* ':''}${e.F?'F':''}${!e.star&&!e.F?'—':''}</td><td><input type="checkbox" aria-label="Approve conditional blind" data-index="${e.i}" data-prop="approved" ${e.approved?'checked':''} ${e.blind!=='Conditional'?'disabled':''}></td><td><input class="condInput" type="text" placeholder="Conditions / matchup notes" value="${escapeHTML(e.condition||'')}" data-index="${e.i}" data-prop="condition"></td></tr>`).join('');}
let editRuleId=null;
function allChampionNames(){return FULL_CHAMPIONS;}
function renderChampionList(){$('knownChampions').innerHTML=allChampionNames().map(x=>`<option value="${escapeHTML(x)}"></option>`).join('');}
function strengthOptions(type,value){const list=type==='synergy'?[1,2,3,4,5]:[-5,-4,-3,-2,-1,1,2,3,4,5];
 return list.map(n=>`<option value="${n}" ${n===Number(value)?'selected':''}>${n>0?'+':''}${n} · ${type==='synergy'?'synergy':n>0?'good for us':'bad for us'} (${Math.abs(n)*(type==='synergy'?4:5)} pts)</option>`).join('')}
function setRuleType(){const type=$('ruleType').value, old=Number($('ruleStrength').value);$('ruleALabel').textContent=type==='synergy'?'Ally champion A':'Our champion';$('ruleBLabel').textContent=type==='synergy'?'Ally champion B':'Enemy champion';
 $('ruleScopeField').classList.toggle('hidden',type==='synergy');$('ruleStrength').innerHTML=strengthOptions(type,(type==='synergy'&&old<1)?3:old||3);$('ruleFormHint').textContent=type==='synergy'?'Pair counted only when both champions are on MSU.':'Positive helps us; negative means the enemy counters us. “Any enemy role” models a cross-map threat.';}
function resetRuleForm(){editRuleId=null;$('ruleForm').reset();$('ruleType').value='synergy';$('ruleStrength').innerHTML=strengthOptions('synergy',3);$('ruleScope').value='same';$('ruleSave').textContent='Add rule';$('ruleFormTitle').textContent='Add an interaction';$('ruleCancel').classList.add('hidden');setRuleType();}
function editRule(id){const rule=state.rules.find(r=>r.id===id);if(!rule)return;editRuleId=id;$('ruleType').value=rule.type;setRuleType();$('ruleA').value=rule.a;$('ruleB').value=rule.b;$('ruleStrength').value=String(rule.strength);$('ruleScope').value=rule.scope||'same';$('ruleNote').value=rule.note||'';$('ruleSave').textContent='Save rule';$('ruleFormTitle').textContent='Edit interaction';$('ruleCancel').classList.remove('hidden');activate('rules');$('ruleForm').scrollIntoView({behavior:'smooth',block:'center'});}
function renderRules(){renderChampionList();const q=canon($('ruleSearch').value),filter=$('ruleFilter').value;const all=state.rules||[],active=all.filter(r=>r.enabled);
 $('rulesCount').textContent=all.length+' rules · '+active.length+' enabled';$('rulesEnabled').textContent=active.length+' active';
 const filtered=all.filter(r=>(!q||canon(r.a+' '+(r.type==='counter'?'vs':'+')+' '+r.b+' '+r.note).includes(q))&&(filter==='all'||filter===r.type||(filter==='enabled'&&r.enabled)||(filter==='starter'&&r.source==='starter')||(filter==='custom'&&r.source!=='starter')));
 $('ruleList').innerHTML=filtered.length?filtered.map(r=>{const val=Number(r.strength),positive=val>0,type=r.type==='synergy'?'ALLY SYNERGY':'MATCHUP';return `<article class="ruleItem ${r.enabled?'':'off'}"><div><div class="ruleHeadline"><span class="pill ${r.type==='synergy'?'safe':'conditional'}">${type}</span><strong>${escapeHTML(r.a)} ${r.type==='synergy'?'+':'vs'} ${escapeHTML(r.b)}</strong><span class="pill ${positive?'safe':'warn'}">${positive?'+':''}${val*(r.type==='synergy'?4:5)} pts</span>${r.source==='starter'?'<span class="pill">SAMPLE</span>':''}</div><div class="ruleExplain">${r.type==='counter'?(r.scope==='any'?'Any enemy lane':'Same role matchup')+' · ':''}${escapeHTML(r.note||'No explanation added.')}</div></div><div class="ruleActions"><label class="tiny" style="white-space:nowrap"><input type="checkbox" data-enable="${escapeHTML(r.id)}" ${r.enabled?'checked':''} aria-label="Enable rule"> On</label><button class="btn" data-edit="${escapeHTML(r.id)}">Edit</button><button class="btn danger" data-delete="${escapeHTML(r.id)}">×</button></div></article>`}).join(''):'<div class="ruleEmpty">No rules match this filter. Add a rule above to start building the matchup database.</div>';
}
function renderInteractionTracker(){const hits=[];const seen=new Set();
 for(const [role,champ] of Object.entries(state.our)){if(!champ)continue;
  const rest=Object.fromEntries(Object.entries(state.our).filter(([r])=>r!==role));
  for(const hit of [...interactionEffects(champ,role,rest).hits,...statEffects(champ,role,rest).hits]){
   // Synergy is two-way: only show once on the tracker.
   const key=hit.kind==='synergy'?hit.rule.id:hit.rule.id+'-'+role;
   if(seen.has(key))continue;seen.add(key);hits.push(hit);
  }
 }
 const active=(state.rules||[]).filter(r=>r.enabled).length;
 $('interactionTracker').innerHTML=hits.length?hits.sort((a,b)=>b.points-a.points).map(h=>`<div class="ruleHit ${h.points<0?'bad':''}"><strong>${h.kind==='synergy'?'Ally combo':'Enemy matchup'} · <span class="${h.points>=0?'positive':'negative'}">${h.points>0?'+':''}${h.points} pts</span></strong><div>${escapeHTML(h.rule.a)} ${h.kind==='synergy'?' + ':' vs '}${escapeHTML(h.rule.b)}</div><small>${escapeHTML(h.rule.note||'No explanation')}</small></div>`).join(''):`<div class="ruleEmpty">No measured or active team-rule interactions between locked picks yet.</div>`;
}
function openQuickRule(champ){resetRuleForm();if(champ)$('ruleA').value=champ;const ally=Object.values(state.our).find(Boolean),enemy=Object.values(state.enemy).find(Boolean);if(ally&&canon(ally)!==canon(champ))$('ruleB').value=ally;else if(enemy){$('ruleType').value='counter';setRuleType();$('ruleB').value=enemy;}activate('rules');$('ruleForm').scrollIntoView({behavior:'smooth',block:'start'});$('ruleB').focus();}

let statRowLimit=100;
function renderStats(){
 $('nCounterRows').textContent=(STAT_MATCHUPS.length+(state.importedStats||[]).filter(x=>x.type==='counter').length).toLocaleString();$('nSynergyRows').textContent=(STAT_SYNERGIES.length+(state.importedStats||[]).filter(x=>x.type==='synergy').length).toLocaleString();$('nHistoricRows').textContent=(LEGACY_MATCHUPS.length+LEGACY_SYNERGIES.length+STAT_HISTORIC.length).toLocaleString();
 $('statsTier').value='all';$('statsMinGames').value=String(state.statsMinGames);$('statsWeight').value=String(state.statsWeight);
 const type=$('statType').value,query=canon($('statSearch').value),role=$('statRole').value,sort=$('statSort').value,poolOnly=$('statPoolOnly').checked,minN=Number(state.statsMinGames);
 const keys=new Set(state.pool.map(x=>x.role+'|'+canon(x.champ)));
 let data=[];
 if(type==='all'||type==='counter')data.push(...[...STAT_MATCHUPS,...(state.importedStats||[]).filter(x=>x.type==='counter')].map(x=>({...x,other:x.opp,otherRole:x.oppRole,note:x.win.toFixed(2)+'% win',measure:x.win-50,order:'C'})));
 if(type==='historic')data.push(...[...LEGACY_MATCHUPS,...STAT_HISTORIC].map(x=>({...x,other:x.opp,otherRole:x.oppRole,note:x.win.toFixed(2)+'% win',measure:x.win-50,order:'H'})));
 if(type==='all'||type==='synergy')data.push(...[...STAT_SYNERGIES,...(state.importedStats||[]).filter(x=>x.type==='synergy')].map(x=>({...x,other:x.ally,otherRole:x.allyRole,note:(x.delta>0?'+':'')+x.delta.toFixed(1)+'pp vs expected',measure:x.delta,order:'S'})));
 data=data.filter(x=>x.games>=minN&&(!poolOnly||keys.has(x.role+'|'+canon(x.champ))||x.type==='synergy'&&keys.has(x.otherRole+'|'+canon(x.other)))&&(role==='ALL'||x.role===role||x.type==='synergy'&&x.otherRole===role)&&(!query||canon(x.champ+' '+x.other).includes(query)));
 if(sort==='advantage')data.sort((a,b)=>b.measure-a.measure||b.games-a.games);
 else if(sort==='disadvantage')data.sort((a,b)=>a.measure-b.measure||b.games-a.games);
 else if(sort==='champion')data.sort((a,b)=>a.champ.localeCompare(b.champ)||b.games-a.games);
 else data.sort((a,b)=>b.games-a.games);
 const count=data.length;
 $('statCount').textContent=count.toLocaleString()+' matching observations';
 $('statShown').textContent='Showing '+Math.min(count,statRowLimit).toLocaleString()+' of '+count.toLocaleString()+' matching records';
 $('statShowMore').classList.toggle('hidden',count<=statRowLimit);
 $('statRows').innerHTML=data.slice(0,statRowLimit).map(x=>`<tr><td><b>${escapeHTML(x.champ)}</b><br><small>${escapeHTML(x.role)} · ${x.type==='synergy'?'ALLY':'ENEMY'}</small></td><td><b>${escapeHTML(x.other)}</b><br><small>${escapeHTML(x.otherRole)}</small></td><td class="${x.measure<0?'dis':'adv'}">${escapeHTML(x.note)}<br><small>${x.type==='synergy'?'vs anchor baseline, not causal':'observed same-role matchup WR'}</small></td><td>${x.games.toLocaleString()}</td><td>${escapeHTML(x.patches)}<br><a href="${escapeHTML(x.source)}" target="_blank" rel="noopener">${escapeHTML(x.site)} source ↗</a></td></tr>`).join('')||'<tr><td colspan="5" class="muted">No verified sample matches these filters. Change your minimum games or search.</td></tr>';
}


function sourceSlug(s){return canon(s);}
function renderCoverage(){
 const keys=new Set(),rows=[];const valid=[...STAT_MATCHUPS,...STAT_SYNERGIES,...(state.importedStats||[])];
 for(const e of state.pool){const k=e.role+'|'+canon(e.champ);if(keys.has(k+'|'+e.player))continue;keys.add(k+'|'+e.player);
  const count=valid.filter(x=>(x.role===e.role&&canon(x.champ)===canon(e.champ))||(x.type==='counter'&&x.oppRole===e.role&&canon(x.opp)===canon(e.champ))||(x.type==='synergy'&&x.allyRole===e.role&&canon(x.ally)===canon(e.champ))).length;
  const counter=valid.filter(x=>x.type==='counter'&&x.role===e.role&&(canon(x.champ)===canon(e.champ)||canon(x.opp)===canon(e.champ))).length;
  const duo=valid.filter(x=>x.type==='synergy'&&((x.role===e.role&&canon(x.champ)===canon(e.champ))||(x.allyRole===e.role&&canon(x.ally)===canon(e.champ)))).length;
  rows.push({e,count,counter,duo});}
 const covered=rows.filter(x=>x.count).length;
 $('coverageSummary').innerHTML=`<strong>${covered} of ${rows.length}</strong> pool entries have at least one sourced statistical interaction (${rows.length-covered} without). The other champions still have editable pool ratings and qualitative composition scoring. Source links do not imply stats have already been imported.`;
 const q=canon($('coverageSearch').value),filter=$('coverageFilter').value;
 $('coverageRows').innerHTML=rows.filter(x=>(!q||canon(x.e.player+' '+x.e.champ+' '+x.e.role).includes(q))&&(filter==='all'||(filter==='missing'?!x.count:!!x.count))).map(({e,counter,duo})=>`<tr><td><strong>${escapeHTML(e.player)}</strong><small>${escapeHTML(e.role)}</small></td><td>${escapeHTML(e.champ)}</td><td class="${counter?'adv':'dis'}">${counter||'—'}</td><td class="${duo?'adv':'dis'}">${duo||'—'}</td><td><a href="https://www.metasrc.com/lol/champions/${sourceSlug(e.champ)}/counters" target="_blank" rel="noopener">Counters ↗</a> · <a href="https://www.metasrc.com/lol/champions/${sourceSlug(e.champ)}/synergies" target="_blank" rel="noopener">Duos ↗</a></td></tr>`).join('');
}
function renderAll(){renderChampionList();renderDraft();renderStats();renderCoverage()}

function activate(tab){for(const name of ['draft','series','pool','rules','stats','coverage','guide']){$(name+'Panel').classList.toggle('hidden',tab!==name);document.querySelector(`[data-tab="${name}"]`).classList.toggle('selected',tab===name)}if(tab==='series')renderSeriesHQ();if(tab==='pool')renderPool();if(tab==='rules')renderRules();if(tab==='stats')renderStats();if(tab==='coverage')renderCoverage();if(tab==='draft')renderDraft();}
document.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>activate(btn.dataset.tab)));
for(const id of ['config','nextRole','phase','midSkill','topSkill','strictBlinds','statsEnabled'])$(id).addEventListener('change',()=>{state[id]=['strictBlinds','statsEnabled'].includes(id)?$(id).checked:$(id).value;save();renderDraft()});
$('pickRows').addEventListener('change',ev=>{const t=ev.target;if(t.dataset.our)state.our[t.dataset.our]=t.value;if(t.dataset.enemy)state.enemy[t.dataset.enemy]=t.value;save();renderDraft()});
$('bans').addEventListener('change',ev=>{state.bans=ev.target.value;save();renderDraft()});
$('needsChips').addEventListener('change',ev=>{const n=ev.target.dataset.need;if(!n)return;state.needs=ev.target.checked?[...new Set([...state.needs,n])]:state.needs.filter(x=>x!==n);save();renderDraft()});
$('recList').addEventListener('click',ev=>{const quick=ev.target.closest('[data-newrule]');if(quick){openQuickRule(quick.dataset.newrule);return;}const btn=ev.target.closest('[data-lock]');if(!btn)return;
 state.our[btn.dataset.role]=btn.dataset.lock;
 // Keep AUTO active; a locked pick narrows the legal configurations automatically.
 state.nextRole='ALL';notify('Locked '+btn.dataset.lock+' into '+btn.dataset.role);save();renderDraft();});
$('lineupCompare').addEventListener('click',ev=>{const btn=ev.target.closest('[data-apply]');if(!btn)return;const l=getLineup(btn.dataset.apply);if(!l.valid)return;state.config=l.mode;state.our=l.our;save();renderDraft();notify('Loaded '+l.mode+' lineup — change any pick to explore');window.scrollTo({top:0,behavior:'smooth'});});
$('poolRows').addEventListener('change',ev=>{const t=ev.target,i=Number(t.dataset.index),prop=t.dataset.prop;if(!prop||!state.pool[i])return;const e=state.pool[i];if(prop==='approved')e.approved=t.checked;else if(prop==='comfort'){e.comfort=Number(t.value);e.rated=true;}else e[prop]=t.value.trim();save();renderPool();});
$('poolSearch').addEventListener('input',renderPool);$('poolPlayer').addEventListener('change',renderPool);$('poolRole').addEventListener('change',renderPool);
$('addDraftRule').addEventListener('click',()=>openQuickRule(''));
$('browseStatsLink').addEventListener('click',ev=>{ev.preventDefault();activate('stats')});
for(const id of ['statType','statRole','statSort','statPoolOnly'])$(id).addEventListener('change',()=>{statRowLimit=100;renderStats()});
$('statSearch').addEventListener('input',()=>{statRowLimit=100;renderStats()});
$('statShowMore').addEventListener('click',()=>{statRowLimit+=100;renderStats()});
for(const id of ['statsTier','statsMinGames','statsWeight'])$(id).addEventListener('change',()=>{state[id]=id==='statsTier'?'all':Number($(id).value);statRowLimit=100;save();renderStats();renderDraft();});
$('recSearch').addEventListener('input',renderRecommendations);$('recShowAll').addEventListener('click',()=>{showAllRecs=!showAllRecs;renderRecommendations();});
$('ruleType').addEventListener('change',setRuleType);
$('ruleCancel').addEventListener('click',resetRuleForm);
$('ruleSearch').addEventListener('input',renderRules);$('ruleFilter').addEventListener('change',renderRules);
$('ruleForm').addEventListener('submit',ev=>{ev.preventDefault();const type=$('ruleType').value,a=$('ruleA').value.trim(),b=$('ruleB').value.trim(),strength=Number($('ruleStrength').value),scope=$('ruleScope').value,note=$('ruleNote').value.trim();
 if(!a||!b||canon(a)===canon(b)){alert('Choose two different champion names.');return;}
 if(!Number.isInteger(strength)||Math.abs(strength)>5||strength===0||(type==='synergy'&&strength<0)){alert('Choose a valid 1–5 strength.');return;}
 // Prevent accidental double scoring from duplicate rules; allow editing the existing record.
 const duplicate=state.rules.find(r=>r.id!==editRuleId&&r.type===type&&((type==='synergy'&&((canon(r.a)===canon(a)&&canon(r.b)===canon(b))||(canon(r.a)===canon(b)&&canon(r.b)===canon(a))))||(type==='counter'&&canon(r.a)===canon(a)&&canon(r.b)===canon(b))));
 if(duplicate){alert('A rule for this matchup already exists. Click Edit on the existing rule instead.');return;}
 if(editRuleId){const r=state.rules.find(r=>r.id===editRuleId);if(r)Object.assign(r,{type,a,b,strength,scope,note});notify('Rule updated');}
 else {state.rules.unshift({id:'custom-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),type,a,b,strength,scope,note,enabled:true,source:'custom'});notify('New rule is active');}
 save();resetRuleForm();renderRules();renderDraft();});
$('ruleList').addEventListener('change',ev=>{const id=ev.target.dataset.enable;if(!id)return;const r=state.rules.find(x=>x.id===id);if(!r)return;r.enabled=ev.target.checked;save();renderRules();renderDraft();});
$('ruleList').addEventListener('click',ev=>{const edit=ev.target.closest('[data-edit]');if(edit){editRule(edit.dataset.edit);return;}const del=ev.target.closest('[data-delete]');if(del){const r=state.rules.find(x=>x.id===del.dataset.delete);if(!r||!confirm('Delete the '+r.a+' / '+r.b+' rule?'))return;state.rules=state.rules.filter(x=>x.id!==r.id);if(editRuleId===r.id)resetRuleForm();save();renderRules();renderDraft();notify('Rule deleted');}});
$('enableStarterRules').addEventListener('click',()=>{let n=0;for(const r of state.rules||[]){if(r.source==='starter'&&!r.enabled){r.enabled=true;n++;}}save();renderRules();renderDraft();notify(n+' sample rules enabled — review them');});
$('disableStarterRules').addEventListener('click',()=>{let n=0;for(const r of state.rules||[]){if(r.source==='starter'&&r.enabled){r.enabled=false;n++;}}save();renderRules();renderDraft();notify(n+' sample rules disabled');});
$('resetDraftBtn').addEventListener('click',()=>{if(!confirm('Clear all picks, bans and draft priorities? (Champion pool edits will remain.)'))return;const fresh=defaultState();state={...state,config:fresh.config,nextRole:fresh.nextRole,phase:fresh.phase,midSkill:fresh.midSkill,topSkill:fresh.topSkill,strictBlinds:fresh.strictBlinds,our:fresh.our,enemy:fresh.enemy,bans:'',needs:[]};save();renderDraft();notify('Draft cleared');});
$('resetPoolBtn').addEventListener('click',()=>{if(!confirm('Restore all 81 champion pool entries? This resets custom comfort, blind status, and notes. Export first if you want a backup.'))return;state.pool=JSON.parse(JSON.stringify(START_POOL));save();renderPool();notify('Pool restored');});
$('exportBtn').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({...state,_app:'MSU Draft Lab v0.5',_exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='MSU_Draft_Data.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Draft data exported');});
$('importBtn').addEventListener('click',()=>$('importFile').click());
$('importFile').addEventListener('change',async ev=>{const f=ev.target.files?.[0];if(!f)return;try{const d=JSON.parse(await f.text());if(!Array.isArray(d.pool)||!d.our||!d.enemy||!Array.isArray(d.needs))throw Error('Invalid draft export file');if(!confirm('Replace your current draft and champion ratings with this import?'))return;state={...defaultState(),...d,rules:Array.isArray(d.rules)?d.rules:JSON.parse(JSON.stringify(START_RULES))};normalizeSeries();save();renderDraft();renderRules();notify('Imported draft, pool and interaction rules')}catch(err){alert('Could not import file: '+err.message)}finally{ev.target.value=''}});

$('coverageSearch').addEventListener('input',renderCoverage);
$('coverageFilter').addEventListener('change',renderCoverage);
$('importStatsBtn').addEventListener('click',()=>$('importStatsFile').click());
$('importStatsFile').addEventListener('change',async ev=>{
 const f=ev.target.files?.[0];if(!f)return;
 try{const raw=JSON.parse(await f.text());const rows=Array.isArray(raw)?raw:raw.records;
  if(!Array.isArray(rows))throw Error('Expected array of records or {records:[...]}');
  const known=new Set(FULL_CHAMPIONS.map(canon));const allowedPatches=new Set(['26.18','26.19','26.20']);
  const safe=[];
  for(const row of rows){const ok=row&&['counter','synergy'].includes(row.type)&&known.has(canon(row.champ))&&known.has(canon(row.type==='counter'?row.opp:row.ally))&&ROLES.includes(row.role)&&ROLES.includes(row.type==='counter'?row.oppRole:row.allyRole)&&Number(row.games)>=100&&Number(row.games)<10000000&&allowedPatches.has(row.patches)&&/^https:\/\//.test(row.source||'')&&row.site;
   if(!ok)continue;
   if(row.type==='counter'&&Number(row.win)>=0&&Number(row.win)<=100)safe.push({...row,win:Number(row.win),games:Number(row.games)});
   if(row.type==='synergy'&&Math.abs(Number(row.delta))<=50&&Number(row.win)>=0&&Number(row.win)<=100)safe.push({...row,win:Number(row.win),delta:Number(row.delta),games:Number(row.games)});
  }
  if(safe.length===0)throw Error('No usable records: patch 26.18–26.20, role, source URL, names, win rate and game count required.');
  if(!confirm(`Import ${safe.length} verified-format rows out of ${rows.length}? You are responsible for confirming the source matches the submitted values.`))return;
  state.importedStats=safe;save();renderStats();renderCoverage();renderDraft();notify(`${safe.length} rows imported`);
 }catch(e){alert('Statistics import failed: '+e.message)}ev.target.value='';
});
$('downloadStatsTemplate').addEventListener('click',()=>{const rows=[{type:'counter',champ:'Ornn',role:'TOP',opp:'Gnar',oppRole:'TOP',win:56.73,games:4093,patches:'26.20',site:'METAsrc',source:'https://www.metasrc.com/lol/champions/ornn/counters'},{type:'synergy',champ:'Xayah',role:'ADC',ally:'Rakan',allyRole:'SUPPORT',win:52.66,delta:1.35,games:53340,patches:'26.20',site:'METAsrc',source:'https://www.metasrc.com/lol/champions/xayah/synergies'}];
 const blob=new Blob([JSON.stringify({records:rows},null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='msu_stats_import_example.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);});


// ----- v0.5 series and scouting layer; deliberately no network/API requests -----
function blankGame(){return {our:Object.fromEntries(ROLES.map(r=>[r,''])),enemy:Object.fromEntries(ROLES.map(r=>[r,''])),bans:'',config:'auto',nextRole:'ALL',phase:'early',needs:[],result:'',notes:''};}
function createSeries(){return {format:3,index:0,opponent:'',drafter:'',games:Array.from({length:3},()=>blankGame()),comps:[],targetCompId:'',scouts:Object.fromEntries(ROLES.map(r=>[r,{role:r,name:'',beer:'',opgg:'',champs:{},notes:''}]))};}
function normalizeSeries(){if(!state.series||typeof state.series!=='object')state.series=createSeries();let x=state.series;
 x.format=[3,5].includes(Number(x.format))?Number(x.format):3;
 if(!Array.isArray(x.games))x.games=[];while(x.games.length<x.format)x.games.push(blankGame());x.games.length=x.format;
 x.index=Math.max(0,Math.min(x.format-1,Number(x.index)||0));
 x.opponent=String(x.opponent||'');x.drafter=String(x.drafter||'');
 if(!Array.isArray(x.comps))x.comps=[];
 if(!x.scouts||typeof x.scouts!=='object')x.scouts={};
 for(const r of ROLES){if(!x.scouts[r]||typeof x.scouts[r]!=='object')x.scouts[r]={role:r,name:'',beer:'',opgg:'',champs:{},notes:''};if(!x.scouts[r].champs||typeof x.scouts[r].champs!=='object')x.scouts[r].champs={};}
 if(typeof x.targetCompId!=='string')x.targetCompId='';
 // A previously migrated v0.4 live draft is game one only. v0.5 saves game snapshots on each change.
}
function syncCurrentGame(){if(!state.series)return;const g=state.series.games[state.series.index];if(!g)return;
 Object.assign(g,{our:{...state.our},enemy:{...state.enemy},bans:state.bans,config:state.config,nextRole:state.nextRole,phase:state.phase,needs:[...state.needs]});}
function goGame(next){const x=state.series;if(next<0||next>=x.format)return;syncCurrentGame();x.index=next;
 const g=x.games[next]||blankGame();state.our={...blankGame().our,...g.our};state.enemy={...blankGame().enemy,...g.enemy};state.bans=g.bans||'';
 state.config=['auto','default','swap'].includes(g.config)?g.config:'auto';state.nextRole=g.nextRole||'ALL';state.phase=g.phase||'early';state.needs=Array.isArray(g.needs)?g.needs:[];
 save();renderDraft();renderSeriesHQ();notify('Viewing game '+(next+1));}
function fearlessLocked(){const x=state.series;if(!x)return new Set();const set=new Set();
 for(let i=0;i<x.index;i++)for(const c of [...Object.values(x.games[i]?.our||{}),...Object.values(x.games[i]?.enemy||{})])if(c)set.add(canon(c));
 return set;}
function getTargetComp(){return state.series?.comps?.find(c=>c.id===state.series.targetCompId)||null;}
function draftConflicts(){const messages=[];let lock=fearlessLocked(); // Validate both teams so role-key collisions cannot mask violations.
 for(const side of ['our','enemy'])for(const [role,champ] of Object.entries(state[side]))if(champ&&lock.has(canon(champ)))messages.push(champ+' locked from earlier game ('+side+' '+role+')');
 return [...new Set(messages)];}
function seriesScores(){let w=0,l=0;for(const g of state.series.games){w+=g.result==='W'?1:0;l+=g.result==='L'?1:0;}return {w,l};}
function renderSeriesBar(){const x=state.series;if(!x)return;const {w,l}=seriesScores();
 $('seriesBarName').textContent='MSU vs '+(x.opponent||'Opponent');$('seriesBarScore').textContent='BO'+x.format+' · '+w+'–'+l;
 $('seriesGameButtons').innerHTML=Array.from({length:x.format},(_,i)=>`<button type="button" data-game="${i}" class="${i===x.index?'active':''}">Game ${i+1}${x.games[i]?.result?' · '+x.games[i].result:''}</button>`).join('');
 $('seriesPrev').disabled=x.index<=0;$('seriesNext').disabled=x.index>=x.format-1;
 const blocked=fearlessLocked(),target=getTargetComp(),bar=`Game ${x.index+1} of ${x.format} · ${blocked.size} champions globally locked from earlier picks · bans reset each game`;
 $('seriesBarStatus').textContent=bar+(target?' · Target: '+target.name:'');
 const conflicts=draftConflicts();$('seriesAlert').innerHTML=conflicts.length?`<div class="hqAlert">⚠ ${escapeHTML(conflicts.join(' · '))}</div>`:'';
}
function hqCount(){return Object.values(state.series.scouts).filter(x=>Object.keys(x.champs||{}).length>0).length;}
function validExternalURL(url){if(!url)return true;try{const u=new URL(url);return u.protocol==='https:'||u.protocol==='http:';}catch{return false;}}
function champFromText(raw){return FULL_CHAMPIONS.find(x=>canon(x)===canon(raw))||null;}
function parseScoutChamps(raw){const out={},invalid=[];for(const entry of String(raw||'').split(/[,;\n]+/)){
 const token=entry.trim();if(!token)continue;const match=token.match(/^(.+?)(?:\s*[:=]\s*([1-5]))?$/);if(!match){invalid.push(token);continue;}
 const champ=champFromText(match[1].trim());if(!champ){invalid.push(token);continue;}out[champ]=match[2]?Number(match[2]):3;
 }return {out,invalid};}
function parseScoutImport(raw){const obj=JSON.parse(raw),list=Array.isArray(obj)?obj:obj.players;if(!Array.isArray(list)||list.length>5)throw Error('Expected players array with up to five role entries.');
 const out=[];for(const x of list){if(!x||!ROLES.includes(x.role)||typeof x.champs!=='object'||Array.isArray(x.champs)||x.champs===null)throw Error('Each player needs a valid role and champs object.');
 const champs={};for(const [name,rating] of Object.entries(x.champs)){const champ=champFromText(name);if(!champ||!Number.isInteger(Number(rating))||rating<1||rating>5)throw Error('Unknown champion or invalid 1–5 comfort: '+name);champs[champ]=Number(rating);}
 if(!validExternalURL(x.beer||'')||!validExternalURL(x.opgg||''))throw Error('Scouting URLs must start with http(s).');
 out.push({role:x.role,name:String(x.name||'').slice(0,100),beer:String(x.beer||''),opgg:String(x.opgg||''),notes:String(x.notes||'').slice(0,1600),champs});
 }return out;}
function csvChamps(champs){return Object.entries(champs||{}).map(([n,v])=>`${n}:${v}`).join(', ');}
function renderScoutEditor(){const r=$('hqScoutRole').value,s=state.series.scouts[r];
 $('hqScoutPlayer').value=s.name||'';$('hqBeer').value=s.beer||'';$('hqOPGG').value=s.opgg||'';$('hqScoutChamps').value=csvChamps(s.champs);$('hqScoutNotes').value=s.notes||'';
 $('hqScoutFeedback').innerHTML='';}
function compLegal(c){const previous=fearlessLocked(),currentBans=new Set(state.bans.split(/[,;\n]/).map(canon).filter(Boolean)),enemy=new Set(Object.values(state.enemy).map(canon).filter(Boolean)),currentOur=new Set(Object.values(state.our).map(canon).filter(Boolean));let failures=[];
 if(!c||!c.picks)return ['Missing composition'];
 for(const role of ROLES){const champ=c.picks[role],key=canon(champ);if(!champ){failures.push(role+' unfilled');continue;}
 if(!playerEntries(c.config,role).some(p=>canon(p.champ)===key))failures.push(role+' not in player pool');
 if(previous.has(key))failures.push(champ+' fearless-locked');
 if(currentBans.has(key))failures.push(champ+' banned this game');
 if(enemy.has(key))failures.push(champ+' picked by enemy');
 if(state.our[role]&&canon(state.our[role])!==key)failures.push(role+' already locked on '+state.our[role]);
 if(currentOur.has(key)&&canon(state.our[role])!==key)failures.push(champ+' already locked in other allied role');
 }
 const vals=Object.values(c.picks).filter(Boolean).map(canon);if(vals.length!==new Set(vals).size)failures.push('Duplicate champion in comp');
 return [...new Set(failures)];}
function renderCompEditor(){const mode=$('hqCompConfig').value;
 const prev=Object.fromEntries(ROLES.map(role=>[role,$('hqComp'+role)?.value||'']));
 $('hqCompEditor').innerHTML=ROLES.map(role=>{const champ=prev[role],options=playerEntries(mode,role).filter(e=>e.champ!=='Tal [confirm]').map(e=>e.champ);return `<label>${role} · ${escapeHTML(ASSIGN[mode][role])}<select id="hqComp${role}"><option value="">Select champion</option>${[...new Set(options)].map(c=>`<option value="${escapeHTML(c)}" ${c===champ?'selected':''}>${escapeHTML(c)}</option>`).join('')}</select></label>`}).join('');}
function renderThreats(){const locked=fearlessLocked(),picked=used();const chunks=[];let total=0;
 for(const role of ROLES){const scout=state.series.scouts[role],options=Object.entries(scout.champs||{}).filter(([name])=>!picked.has(canon(name))).sort((a,b)=>b[1]-a[1]);total+=options.length;
 chunks.push(`<div class="hqBox"><div class="hqInline"><h3>${role} · ${escapeHTML(scout.name||'Player unknown')}</h3><span class="pill">${options.length} known options</span></div><div class="chipwrap">${options.slice(0,7).map(([champ,rating])=>`<span class="focuschip">${escapeHTML(champ)} <b>${rating}/5</b></span>`).join('')||'<span class="hqMuted">No available scouted picks. Add a profile to improve the prediction.</span>'}</div>${scout.notes?`<p>${escapeHTML(scout.notes)}</p>`:''}${scout.beer||scout.opgg?`<div class="hqActions">${scout.beer?`<a class="scoutLink" href="${escapeHTML(scout.beer)}" target="_blank" rel="noopener">Beer League ↗</a>`:''}${scout.opgg?`<a class="scoutLink" href="${escapeHTML(scout.opgg)}" target="_blank" rel="noopener">OP.GG ↗</a>`:''}</div>`:''}</div>`);
 }
 $('hqThreats').innerHTML=chunks.join('')+`<div class="hqMini">Scouted options ≠ measured draft probability. Comfort rankings are manually supplied; locked and banned champions are excluded. ${locked.size} previous-game fearless locks.</div>`;
}
function renderComps(){const x=state.series,target=x.targetCompId;const comps=x.comps;
 $('hqCompCount').textContent=comps.length+' saved';
 $('hqComps').innerHTML=comps.length?comps.map(c=>{const fails=compLegal(c);return `<article class="hqBox"><div class="hqInline"><div><h3>${escapeHTML(c.name)}</h3><span class="hqMuted">${c.config==='swap'?'David TOP / Seth MID':'Seth TOP / David MID'}</span></div><span class="pill ${fails.length?'conditional':'safe'}">${fails.length?'Unavailable: '+fails.length+' issue(s)':'Available'}</span></div><div class="chipwrap">${ROLES.map(r=>`<span class="focuschip">${r}: ${escapeHTML(c.picks[r]||'?')}</span>`).join('')}</div>${c.notes?`<p>${escapeHTML(c.notes)}</p>`:''}<div class="hqActions"><button class="btn ${target===c.id?'primary':'ghost'}" data-targetcomp="${escapeHTML(c.id)}">${target===c.id?'Target selected':'Set draft target'}</button><button class="btn ghost" data-editcomp="${escapeHTML(c.id)}">Edit</button><button class="btn danger" data-delcomp="${escapeHTML(c.id)}">Delete</button></div>${fails.length?`<div class="hqMini" style="color:var(--coral)">Blocked: ${escapeHTML(fails.join(' · '))}</div>`:''}</article>`}).join(''):'<div class="hqMuted" style="margin-top:12px">No saved comps. Create a full five-champion composition above; draft targeting is advisory.</div>';
}
function renderSeriesHealth(){let x=state.series,locked=fearlessLocked(),summary=ROLES.map(role=>{let players=[...new Set(['default','swap'].map(mode=>ASSIGN[mode][role]))];let all=state.pool.filter(e=>e.role===role&&players.includes(e.player));
 let eligible=all.filter(e=>!locked.has(canon(e.champ)));return `<div class="hqBox"><h3>${role} · ${eligible.length}/${all.length} available pool entries</h3><p>${eligible.length<=2?'Very thin remaining pool. ':''}${escapeHTML(eligible.map(e=>e.champ).slice(0,8).join(' · '))}${eligible.length>8?' · …':''}</p></div>`}).join('');
 $('hqSeriesHealth').innerHTML=`<p class="hqMuted">Depth shown across the listed player-role pools. Champions picked in earlier games are excluded; duplicates across players count as separate entries. Saved comps are re-evaluated each game.</p><div class="hqGrid" style="margin-top:10px;gap:8px">${summary}</div>`;}
function renderSeriesHQ(){const x=state.series;if(!x)return;const score=seriesScores(),g=x.games[x.index];
 $('hqOpponent').value=x.opponent;$('hqDrafter').value=x.drafter;$('hqFormat').value=String(x.format);$('hqResult').value=g.result||'';$('hqGameNotes').value=g.notes||'';
 const lock=fearlessLocked();$('hqOverview').innerHTML=`<div><strong>Game ${x.index+1}</strong><span>Current game / BO${x.format}</span></div><div><strong>${score.w}–${score.l}</strong><span>MSU–Opponent score</span></div><div><strong>${lock.size}</strong><span>Global fearless locked champions</span></div>`;
 $('hqGames').innerHTML=Array.from({length:x.format},(_,i)=>`<button data-game="${i}" class="${x.index===i?'active':''}">Game ${i+1}${x.games[i].result?' · '+x.games[i].result:''}</button>`).join('');
 $('hqPreviousGames').innerHTML=x.games.map((g,i)=>`<span class="focuschip">G${i+1}: ${Object.values(g.our||{}).filter(Boolean).length} MSU picks · ${Object.values(g.enemy||{}).filter(Boolean).length} enemy picks${g.result?' · '+g.result:''}</span>`).join(' ');
 renderComps();renderThreats();renderSeriesHealth();renderSeriesBar();}
function validateGameMove(side,role,champ){if(!champ)return '';
 if(fearlessLocked().has(canon(champ)))return `${champ} was picked in an earlier game (global fearless).`;
 for(const team of ['our','enemy'])for(const r of ROLES){if(team===side&&r===role)continue;if(canon(state[team][r])===canon(champ))return champ+' is already picked by '+team+' '+r+'.';}
 if(state.bans.split(/[,;\n]/).some(x=>canon(x)===canon(champ)))return champ+' is banned this game.';
 return '';}
function setupCompHandlers(){const x=state.series;
 $('hqCompConfig').addEventListener('change',renderCompEditor);
 $('hqSaveComp').addEventListener('click',()=>{
  const name=$('hqCompName').value.trim(),config=$('hqCompConfig').value,picks=Object.fromEntries(ROLES.map(role=>[role,$('hqComp'+role)?.value||''])),notes=$('hqCompNotes').value.trim();
  if(!name||Object.values(picks).some(c=>!c)){ $('hqCompStatus').innerHTML='<div class="hqAlert">Enter a name and all five champions.</div>';return;}
  if(new Set(Object.values(picks).map(canon)).size<5){$('hqCompStatus').innerHTML='<div class="hqAlert">A champion cannot occupy two roles.</div>';return;}
  const id=$('hqSaveComp').dataset.edit||'comp-'+Date.now();const comp={id,name,config,picks,notes};
  const at=x.comps.findIndex(c=>c.id===id);if(at>=0)x.comps[at]=comp;else x.comps.push(comp);
  $('hqSaveComp').dataset.edit='';$('hqSaveComp').textContent='Save composition';save();renderSeriesHQ();$('hqCompStatus').innerHTML='<div class="hqGood">Composition saved. Select a target to influence recommendations.</div>';});
 $('hqFillCurrent').addEventListener('click',()=>{for(const role of ROLES){const el=$('hqComp'+role);if(el&&[...el.options].some(o=>o.value===state.our[role]))el.value=state.our[role];}});
 $('hqClearComp').addEventListener('click',()=>{$('hqCompName').value='';$('hqCompNotes').value='';$('hqSaveComp').dataset.edit='';$('hqSaveComp').textContent='Save composition';renderCompEditor();});
 $('hqComps').addEventListener('click',ev=>{let t=ev.target.closest('[data-targetcomp],[data-editcomp],[data-delcomp]');if(!t)return;
  const id=t.dataset.targetcomp||t.dataset.editcomp||t.dataset.delcomp;const c=x.comps.find(c=>c.id===id);if(!c)return;
  if(t.dataset.targetcomp){x.targetCompId=x.targetCompId===id?'':id;save();renderSeriesHQ();renderDraft();notify('Draft target updated');}
  else if(t.dataset.editcomp){$('hqCompName').value=c.name;$('hqCompNotes').value=c.notes||'';$('hqCompConfig').value=c.config;renderCompEditor();for(const role of ROLES)$('hqComp'+role).value=c.picks[role];$('hqSaveComp').dataset.edit=c.id;$('hqSaveComp').textContent='Update composition';$('hqCompName').focus();}
  else if(t.dataset.delcomp){if(!confirm('Delete composition '+c.name+'?'))return;x.comps=x.comps.filter(z=>z.id!==id);if(x.targetCompId===id)x.targetCompId='';save();renderSeriesHQ();renderDraft();}
 });}
function downloadJSON(data,file){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=file;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function initSeriesControls(){
 $('openSeriesHQ').addEventListener('click',()=>activate('series'));
 for(const elem of ['seriesGameButtons','hqGames'])$(elem).addEventListener('click',ev=>{const t=ev.target.closest('[data-game]');if(t)goGame(Number(t.dataset.game))});
 $('seriesPrev').addEventListener('click',()=>goGame(state.series.index-1));$('seriesNext').addEventListener('click',()=>goGame(state.series.index+1));
 $('hqOpponent').addEventListener('change',ev=>{state.series.opponent=ev.target.value.trim();save();renderSeriesBar();});
 $('hqDrafter').addEventListener('change',ev=>{state.series.drafter=ev.target.value.trim();save();});
 $('hqOpenDrafter').addEventListener('click',()=>{const url=$('hqDrafter').value.trim()||'https://drafter.lol/';if(!validExternalURL(url)){alert('Use an http(s) Drafter link.');return;}window.open(url,'_blank','noopener,noreferrer');});
 $('hqFormat').addEventListener('change',ev=>{const n=Number(ev.target.value),x=state.series;if(n===x.format)return;
 if(n<x.format&&x.games.slice(n).some(g=>Object.values(g.our||{}).some(Boolean)||Object.values(g.enemy||{}).some(Boolean)||g.result)&&!confirm('Reducing BO5 to BO3 will discard games 4 and 5. Continue?')){ev.target.value=String(x.format);return;}
 syncCurrentGame();x.format=n;while(x.games.length<n)x.games.push(blankGame());x.games.length=n;if(x.index>=n)goGame(n-1);else {save();renderDraft();renderSeriesHQ();}});
 $('hqNewSeries').addEventListener('click',()=>{if(!confirm('New series clears ALL game picks, results and fearless locks. Champion pools, scouting profiles and saved comps remain. Export a backup first if needed.'))return;
 const x=state.series,oldComps=x.comps,oldScouts=x.scouts,oldOpp=x.opponent,oldDrafter=x.drafter,format=x.format;
 state.series=createSeries();Object.assign(state.series,{comps:oldComps,scouts:oldScouts,opponent:oldOpp,drafter:oldDrafter,format,games:Array.from({length:format},()=>blankGame())});goGame(0);notify('Started new series');});
 $('hqResult').addEventListener('change',ev=>{state.series.games[state.series.index].result=ev.target.value;save();renderSeriesHQ()});
 $('hqGameNotes').addEventListener('change',ev=>{state.series.games[state.series.index].notes=ev.target.value.trim();save();});
 setupCompHandlers();
 $('hqScoutRole').addEventListener('change',renderScoutEditor);
 $('hqSaveScout').addEventListener('click',()=>{const r=$('hqScoutRole').value,name=$('hqScoutPlayer').value.trim(),beer=$('hqBeer').value.trim(),opgg=$('hqOPGG').value.trim();
  if(!validExternalURL(beer)||!validExternalURL(opgg)){$('hqScoutFeedback').innerHTML='<div class="hqAlert">URLs must be valid http(s) links.</div>';return;}
  const {out,invalid}=parseScoutChamps($('hqScoutChamps').value);
  if(invalid.length){$('hqScoutFeedback').innerHTML=`<div class="hqAlert">Unrecognized entries: ${escapeHTML(invalid.join(', '))}. Check spelling; nothing was changed.</div>`;return;}
  state.series.scouts[r]={role:r,name,beer,opgg,champs:out,notes:$('hqScoutNotes').value.trim()};save();renderSeriesHQ();$('hqScoutFeedback').innerHTML='<div class="hqGood">Scouting profile saved (user-provided, not independently verified).</div>';});
 $('hqClearScout').addEventListener('click',()=>{if(!confirm('Clear this enemy player profile?'))return;let r=$('hqScoutRole').value;state.series.scouts[r]={role:r,name:'',beer:'',opgg:'',champs:{},notes:''};save();renderScoutEditor();renderSeriesHQ();});
 $('hqImportScout').addEventListener('click',()=>{try{const arr=parseScoutImport($('hqScoutJSON').value);const roles=new Set();for(const p of arr){if(roles.has(p.role))throw Error('Duplicate role: '+p.role);roles.add(p.role);}
  if(!confirm(`Import ${arr.length} role profiles? Existing profiles for those roles will be replaced.`))return;
  for(const p of arr)state.series.scouts[p.role]=p;save();renderScoutEditor();renderSeriesHQ();$('hqScoutImportStatus').innerHTML='<div class="hqGood">Imported '+arr.length+' scouting profiles.</div>';
  }catch(e){$('hqScoutImportStatus').innerHTML='<div class="hqAlert">Import failed: '+escapeHTML(e.message)+'</div>';}});
 $('hqExportScout').addEventListener('click',()=>downloadJSON({players:ROLES.map(r=>state.series.scouts[r])},'MSU_Opponent_Scouting.json'));
 $('hqScoutExample').addEventListener('click',()=>{$('hqScoutJSON').value=JSON.stringify({players:[{role:'MID',name:'Example player',champs:{Yone:5,Zed:4,'Twisted Fate':3},opgg:'',beer:'',notes:'Example only; remove before importing real scouts'}]},null,2);});
 // Check selectable enemy and allied options BEFORE original event handlers commit invalid picks.
 $('pickRows').addEventListener('change',ev=>{const t=ev.target,side=t.dataset.our?'our':t.dataset.enemy?'enemy':null,role=t.dataset.our||t.dataset.enemy;if(!side)return;
 const error=validateGameMove(side,role,t.value);if(error){ev.stopImmediatePropagation();notify('INVALID: '+error);renderDraft();return;}
 },true);
 // Guard the draft board's Lock action before the original handler runs.
 $('recList').addEventListener('click',ev=>{const b=ev.target.closest('[data-lock]');if(!b)return;const problem=validateGameMove('our',b.dataset.role,b.dataset.lock);if(problem){ev.stopImmediatePropagation();notify('INVALID: '+problem);}},true);
 $('lineupCompare').addEventListener('click',ev=>{const b=ev.target.closest('[data-apply]');if(b&&getLineup(b.dataset.apply).valid===false){ev.stopImmediatePropagation();notify('Lineup unavailable in this fearless game');}},true);
 // Add a clear, small companion disclaimer next to live recommendations, without rewriting old stats.
 const summary=$('recSummary');if(summary&&summary.parentElement){const div=document.createElement('div');div.id='seriesTargetHint';summary.parentNode.insertBefore(div,summary);}
 renderCompEditor();renderScoutEditor();renderSeriesHQ();
}

initSeriesControls();resetRuleForm();renderChampionList();renderDraft();
})();