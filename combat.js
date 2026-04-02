// ════════════════════════════════════════════════════════════
// COMBAT
// ════════════════════════════════════════════════════════════

async function showCombat(eventOrKey) {
  // Open modal immediately so the player gets instant feedback
  // Show combat tab — reveal it, pulse to draw attention, switch to it
  const combatTab = document.getElementById('tab-combat');
  if (combatTab) {
    combatTab.style.display = '';
    combatTab.classList.add('pulsing');
  }
  switchTab('combat');
  document.getElementById('combat-title').textContent = 'Entering the passage…';
  document.getElementById('combat-phase-bar').textContent = 'Loading encounter…';
  document.getElementById('combat-init-track').innerHTML = '';
  document.getElementById('combat-enemies').innerHTML = '';
  document.getElementById('combat-allies').innerHTML = '';
  document.getElementById('combat-log-panel').innerHTML = '';
  document.getElementById('combat-skill-grid').innerHTML = '';
  document.getElementById('combat-actor-label').textContent = '';

  const eventData = (eventOrKey && typeof eventOrKey === 'object') ? eventOrKey : null;
  const forcedEnemyKeys = eventData?.enemies || null;
  const encounterTitle = eventData?.title || null;

  // Load world data (silently — modal is already open)
  if (!_combatSystem) {
    try { const d=await fetch(FB_URL+'/world/combat.json?cb='+Date.now()).then(r=>r.json()); if(d&&!d.error)_combatSystem=d; } catch(e){}
  }
  if (!_cachedWorldSkills) {
    try { const d=await fetch(FB_URL+'/world/skills.json?cb='+Date.now()).then(r=>r.json()); if(d&&!d.error)_cachedWorldSkills=d; } catch(e){}
  }
  const charData = _characterData||{name:playerName||'Seeker',level:1,stats:{fortitude:10,wrath:8,intuition:12,empathy:10,endurance:10,memory:8,cunning:12,gnosis:0,speed:10},classKey:'hermeticist',class:'Seeker'};
  const charDerived = derivedStats(charData.stats, charData.level||1);

  // Build party from roster — player if onRoster, else always include player
  const playerOnRoster = charData.onRoster !== false; // default true
  const player = {id:'player', name:charData.name||playerName||'Seeker', icon:'✦', side:'ally', rank:4,
    stats:charData.stats, derived:charDerived, hp:charDerived.hp, maxHp:charDerived.hp,
    mana:charDerived.mana, maxMana:charDerived.mana, stress:charData.stress||0,
    initiative:charDerived.initiative+Math.random()*4, effects:[], dead:false,
    classKey:charData.classKey||'hermeticist',
    skills: charData.skills || [],          // player's learned skills
    inventory: charData.inventory || [],    // player's equipped items
    isPlayer: true };

  // Roster acolytes — those with onRoster:true, preserving their skills+inventory
  const rosterAcolytes = (_acolytesData||[]).filter(a=>a.onRoster===true);
  const partyAcolytes  = rosterAcolytes.length > 0 ? rosterAcolytes : (_acolytesData||[]).slice(0,1);

  const ACOL_ICONS = ['△','▽','◈','◇','○'];
  const acolytes = partyAcolytes.map((a, i) => {
    const as2 = a.stats||{fortitude:10,wrath:8,intuition:10,empathy:10,endurance:10,memory:8,cunning:10,gnosis:0,speed:9};
    const ad  = derivedStats(as2, a.level||1);
    return {id: a.id||('acol_'+i), name:a.name, icon:ACOL_ICONS[i%ACOL_ICONS.length],
      side:'ally', rank:i+1,
      stats:as2, derived:ad, hp:ad.hp, maxHp:ad.hp, mana:ad.mana, maxMana:ad.mana,
      stress:a.stress||0, initiative:ad.initiative+Math.random()*4, effects:[], dead:false,
      classKey:(a.classKey||a.class||'').toLowerCase().replace(/\s+/g,'-'),
      skills:a.skills||[], inventory:a.inventory||[],
      sourceAcolyte: a }; // keep ref for post-combat updates
  });
  let enemyDefs=[];
  try {
    const crt=await fetch(FB_URL+'/world/creatures.json?cb='+Date.now()).then(r=>r.json());
    if(crt&&!crt.error){
      if(forcedEnemyKeys&&forcedEnemyKeys.length){
        // Use exact enemies specified in the event
        enemyDefs=forcedEnemyKeys.map(k=>crt[k]?{key:k,...crt[k]}:null).filter(Boolean);
      } else {
        // Pick 1-2 random creatures
        const keys=Object.keys(crt).sort(()=>Math.random()-0.5).slice(0,Math.min(2,Object.keys(crt).length));
        enemyDefs=keys.map(k=>({key:k,...crt[k]}));
      }
    }
  } catch(e){}
  if(!enemyDefs.length){
    enemyDefs=[
      {key:'watcher',name:'The Membrane Watcher',icon:'✶',stats:{hp:32,armour:4,dodge:15,speed:11,damage:'2d6+2',stress:10,xp:120},abilities:['Blight Aura']},
      {key:'filament',name:'Seeping Filament',icon:'∿',stats:{hp:14,armour:0,dodge:0,speed:8,damage:'1d4',stress:5,xp:60}}
    ];
  }
  const enemies=enemyDefs.map((e,i)=>{
    const ehp=e.stats?.hp||20;
    return {id:'enemy_'+i,name:e.name||'Enemy '+(i+1),icon:e.icon||'▽',side:'enemy',rank:i+1,
      stats:e.stats||{},hp:ehp,maxHp:ehp,mana:0,maxMana:0,stress:0,
      dodge:e.stats?.dodge||0,armour:e.stats?.armour||0,damageExpr:(e.stats?.damage&&e.stats.damage.trim())||'1d6',
      abilities:e.abilities||[],loot:e.loot||[],xpReward:e.stats?.xp||50,
      initiative:(e.stats?.speed||10)*2+Math.random()*4,effects:[],dead:false,
      resistances:e.resistances||{}};
  });
  const all=[...enemies,player,...acolytes].sort((a,b)=>b.initiative-a.initiative);
  _CS={title:encounterTitle||enemyDefs[0]?.name||'Combat',combatants:all,round:1,turnIdx:0};
  switchTab('combat');
  combatLog('The encounter begins. Turn order set by initiative.','system');
  renderCombat();
  setTimeout(()=>maybeEnemyTurn(),300);
}

function closeCombat(){
  const combatTab = document.getElementById('tab-combat');
  if (combatTab) { combatTab.style.display = 'none'; combatTab.classList.remove('pulsing','active'); }
  document.getElementById('panel-combat')?.classList.remove('active');
  document.getElementById('combat-retreat-overlay')?.classList.remove('open');
  _CS = null; _pendingSkill = null;
  document.getElementById('combat-target-prompt').classList.remove('active');
  // Now safe to switch tab
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const fieldPanel = document.getElementById('panel-field');
  if (fieldPanel) fieldPanel.classList.add('active');
  const tabs = document.querySelectorAll('.tab');
  if (tabs[1]) tabs[1].classList.add('active'); // field tab
  if (map) setTimeout(() => map.invalidateSize(), 50);
  toast('You withdraw from the passage. The threshold holds — for now.');
  persistState().catch(()=>{});
}

function closeCombatVictory() {
  document.getElementById('combat-victory-overlay')?.classList.remove('open');
  closeCombat();
}

function renderCombat(){
  if(!_CS)return;
  document.getElementById('combat-title').textContent=_CS.title||'Combat';
  const active=_CS.combatants[_CS.turnIdx];
  document.getElementById('combat-phase-bar').textContent='Round '+_CS.round+(active?'  ·  '+active.name+"'s turn":'');
  updateCombatContextBar();
  const track=document.getElementById('combat-init-track');
  track.innerHTML=_CS.combatants.map((cb,i)=>{
    const cls=['init-token',cb.side==='enemy'?'enemy':'ally',i===_CS.turnIdx?'active-token':'',cb.dead?'dead-token':''].filter(Boolean).join(' ');
    return '<div class="'+cls+'" title="'+cb.name+'">'+(cb.icon||'◈')+'</div>';
  }).join('');
  const enemies=_CS.combatants.filter(cb=>cb.side==='enemy');
  const allies=_CS.combatants.filter(cb=>cb.side==='ally');
  document.getElementById('combat-enemies').innerHTML=enemies.map(renderCard).join('');
  document.getElementById('combat-allies').innerHTML=allies.map(renderCard).join('');
  const eCnt=document.getElementById('cbt-enemy-count');
  const aCnt=document.getElementById('cbt-ally-count');
  if(eCnt)eCnt.textContent=enemies.filter(cb=>!cb.dead).length+'/'+enemies.length+' standing';
  if(aCnt)aCnt.textContent=allies.filter(cb=>!cb.dead).length+'/'+allies.length+' standing';
  document.querySelectorAll('.combatant-card').forEach(el=>el.classList.remove('active-card'));
  if(active)document.querySelector('[data-cid="'+active.id+'"]')?.classList.add('active-card');
  renderActions();
}

function renderCard(cb){
  const hpPct  = Math.max(0, Math.min(100, (cb.hp / cb.maxHp) * 100));
  const mpPct  = cb.maxMana > 0 ? Math.max(0, Math.min(100, (cb.mana / cb.maxMana) * 100)) : 0;
  const stPct  = Math.min(100, cb.stress || 0);
  const hpCls  = cb.side === 'enemy' ? 'hp-fill-enemy' : 'hp-fill-ally';
  const hpCol  = hpPct < 25 ? 'var(--crimson-bright)' : hpPct < 50 ? 'var(--amber-bright)' : '';
  const pips   = (cb.effects||[]).map(ef =>
    `<span class="effect-pip ${ef.type}">${ef.type}${ef.stacks>1?' ×'+ef.stacks:''} ${ef.turns}t</span>`
  ).join('');

  const statline = cb.side === 'enemy'
    ? `<span>Dodge ${cb.dodge||0}%</span><span>Arm ${cb.armour||0}</span><span>Init ${Math.round(cb.initiative||0)}</span>`
    : `<span>Init ${Math.round(cb.initiative||0)}</span><span>Crit ${cb.derived?.crit||0}%</span><span>Dodge ${cb.derived?.dodge||0}%</span>`
      + ((cb.shield||0)>0 ? `<span class="stat-hi">Shield ${cb.shield}</span>` : '')
      + ((cb.stress||0)>=80 ? '<span class="stat-danger">High Stress</span>' : '');

  return `<div class="combatant-card ${cb.side}-card${cb.dead?' dead-card':''}" data-cid="${cb.id}" onclick="handleCombatantClick('${cb.id}')">
    <div class="cc-card-inner">
      <div class="cc-icon-col">${cb.icon||'◈'}</div>
      <div class="cc-body">
        <div class="cc-name-row">
          <span class="cc-name">${cb.name}${cb.dead?'<span class="cc-fallen-tag">fallen</span>':''}</span>
          <button class="cc-inspect-btn" onclick="event.stopPropagation();inspectCombatant('${cb.id}')" title="Inspect">ⓘ</button>
        </div>
        <div class="cc-bars">
          <div class="cc-bar-row">
            <span class="cc-bar-lbl">HP</span>
            <div class="cc-bar"><div class="cc-bar-fill ${hpCls}" style="width:${hpPct}%;${hpCol?'background:'+hpCol:''}"></div></div>
            <span class="cc-bar-val" style="${hpCol?'color:'+hpCol:''}">${Math.ceil(cb.hp)}/${cb.maxHp}</span>
          </div>
          ${cb.maxMana>0?`<div class="cc-bar-row">
            <span class="cc-bar-lbl">MP</span>
            <div class="cc-bar"><div class="cc-bar-fill mana-fill" style="width:${mpPct}%"></div></div>
            <span class="cc-bar-val">${Math.ceil(cb.mana||0)}/${cb.maxMana}</span>
          </div>`:''}
          ${cb.side==='ally'?`<div class="cc-bar-row">
            <span class="cc-bar-lbl">STR</span>
            <div class="cc-bar"><div class="cc-bar-fill stress-fill-c" style="width:${stPct}%"></div></div>
            <span class="cc-bar-val">${Math.round(cb.stress||0)}%</span>
          </div>`:''}
        </div>
        <div class="cc-statline">${statline}</div>
        ${pips?`<div class="cc-effects">${pips}</div>`:''}
      </div>
    </div>
  </div>`;
}

function renderActions(){
  if(!_CS)return;
  const active=_CS.combatants[_CS.turnIdx];
  const label=document.getElementById('combat-actor-label');
  const grid=document.getElementById('combat-skill-grid');
  if(!active||active.dead){label.textContent='Waiting…';grid.innerHTML='';return;}
  if(active.side==='enemy'){label.textContent=active.name+' is acting…';grid.innerHTML='';return;}
  label.textContent=active.name+' — Choose an Action';
  const skills=getSkillsFor(active);
  const CAT_COL={attack:'var(--crimson-bright)',heal:'var(--viridian-bright)',buff:'var(--amber-bright)',debuff:'var(--mist)',revive:'var(--indigo-bright)',utility:'var(--gold)'};

  // Skills
  const skillBtns=skills.map(sk=>{
    const cat=sk.category||sk.cat||'attack';
    const col=CAT_COL[cat]||'var(--gold)';
    const bcls='skill-btn'+(cat==='attack'||cat==='debuff'?' attack-btn':cat==='heal'||cat==='revive'?' heal-btn':'');
    const mc=sk.cost?.mana||0;
    const dis=mc>(active.mana||0)?'disabled-btn':'';
    const dmgLine=sk.damage?.type&&sk.damage.type!=='none'?`${sk.damage.dice||''}${sk.damage.flat?'+'+sk.damage.flat:''} <span style="color:${col}">${sk.damage.type}</span>`:(cat);
    return `<div class="skill-btn-wrap">
      <button class="${bcls} ${dis}" onclick="selectSkill('${sk._key}')">
        <span class="skill-btn-name">${sk.name||sk._key}</span>
        <span class="skill-btn-sub">${dmgLine}</span>
        ${mc?`<span class="skill-btn-cost">${mc} mana</span>`:''}
      </button>
      <button class="skill-info-btn" onclick="showSkillTooltip('${sk._key}',event)" title="Skill info">ⓘ</button>
    </div>`;
  }).join('');

  // Basic attack always available
  const basicBtn=`<div class="skill-btn-wrap"><button class="skill-btn" onclick="combatBasicAttack()">
      <span class="skill-btn-name">Strike</span>
      <span class="skill-btn-sub">Basic · No cost</span>
    </button></div>`;

  // Consumable items from player inventory (or acolyte's carried items)
  const combatItems = active.isPlayer
    ? Object.entries(inventory||{}).filter(([,qty])=>qty>0)
    : (active.sourceAcolyte?.inventory||[]).map(i=>[(i.name||i),1]);

  const itemBtns = combatItems.map(([key,qty])=>{
    const r=RECIPES.find(x=>x.key===key);
    if(!r) return '';
    const isConsumable=(r.cat==='consumables')||(r.type||'').toLowerCase().includes('consumable');
    if(!isConsumable) return '';
    return `<div class="skill-btn-wrap">
      <button class="skill-btn heal-btn" onclick="useCombatItem('${key}','${active.id}')">
        <span class="skill-btn-name">${r.name}</span>
        <span class="skill-btn-sub">×${qty} · ${r.effect||'Use item'}</span>
      </button>
    </div>`;
  }).filter(Boolean).join('');

  const itemSection = itemBtns
    ? `<div style="font-family:var(--ff-heading);font-size:0.5rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--text-secondary);margin-top:0.5rem;padding-top:0.4rem;border-top:1px solid var(--border);">Items</div>${itemBtns}`
    : '';

  grid.innerHTML = skillBtns + basicBtn + itemSection;
}

function combatLog(text,cls=''){
  const p=document.getElementById('combat-log-panel'); if(!p)return;
  const el=document.createElement('div'); el.className='log-line '+cls; el.innerHTML=text;
  p.appendChild(el); p.scrollTop=p.scrollHeight;
}

function combatBasicAttack(){
  if(!_CS)return;
  const actor=_CS.combatants[_CS.turnIdx];
  const sk={_key:'basic',name:'Strike',category:'attack',damage:{type:'physical',dice:'1d6',flat:0,scaleStat:'wrath',scaleAmt:50,critMult:1.5},targeting:{target:'single-enemy',hits:1,accuracyMod:0}};
  const targets=_CS.combatants.filter(c=>c.side==='enemy'&&!c.dead);
  if(targets.length===1){_pendingSkill=null;executeSkill(sk,actor,[targets[0]]);return;}
  _pendingSkill=sk;
  document.getElementById('combat-target-prompt').classList.add('active');
  document.querySelectorAll('.combatant-card.enemy-card').forEach(el=>el.classList.add('targeted'));
}

function selectSkill(key){
  if(!_CS||!_cachedWorldSkills)return;
  const sk={_key:key,..._cachedWorldSkills[key]};
  const actor=_CS.combatants[_CS.turnIdx]; if(!actor||actor.dead)return;
  const tgt=sk.targeting?.target||'single-enemy';
  if(tgt==='self'){executeSkill(sk,actor,[actor]);return;}
  if(tgt==='all-enemies'){executeSkill(sk,actor,_CS.combatants.filter(c=>c.side==='enemy'&&!c.dead));return;}
  if(tgt==='all-allies'){executeSkill(sk,actor,_CS.combatants.filter(c=>c.side==='ally'&&!c.dead));return;}
  if(tgt==='random-enemy'){const t=_CS.combatants.filter(c=>c.side==='enemy'&&!c.dead);if(t.length)executeSkill(sk,actor,[t[Math.floor(Math.random()*t.length)]]);return;}
  _pendingSkill=sk;
  document.getElementById('combat-target-prompt').classList.add('active');
  const vs=tgt.includes('enemy')?'enemy':'ally';
  document.querySelectorAll('.combatant-card').forEach(el=>{
    const c=_CS.combatants.find(x=>x.id===el.dataset.cid);
    if(c&&c.side===vs&&!c.dead)el.classList.add('targeted');
  });
}

function handleCombatantClick(cid){
  if(!_pendingSkill||!_CS)return;
  const target=_CS.combatants.find(c=>c.id===cid); if(!target)return;
  const tgt=_pendingSkill.targeting?.target||'single-enemy';
  if(tgt.includes('enemy')&&target.side!=='enemy'){combatLog('Targets enemies only.','system');return;}
  if(tgt.includes('ally')&&target.side!=='ally'){combatLog('Targets allies only.','system');return;}
  if(target.dead&&_pendingSkill.category!=='revive'){combatLog('Cannot target fallen.','system');return;}
  const sk=_pendingSkill; _pendingSkill=null;
  document.getElementById('combat-target-prompt').classList.remove('active');
  document.querySelectorAll('.combatant-card').forEach(c=>c.classList.remove('targeted'));
  executeSkill(sk,_CS.combatants[_CS.turnIdx],[target]);
}

function executeSkill(sk,actor,targets){
  if(!sk||!actor||!targets.length)return;
  const cat=sk.category||sk.cat||'attack';
  if(sk.cost?.mana)actor.mana=Math.max(0,(actor.mana||0)-sk.cost.mana);
  const hits=sk.targeting?.hits||1;
  for(const t of targets)for(let h=0;h<hits;h++){
    if(cat==='attack'||cat==='debuff')resolveAttack(sk,actor,t);
    else if(cat==='heal'||cat==='revive')resolveHeal(sk,actor,t);
    else if(cat==='buff')resolveBuff(sk,actor,t);
  }
  checkCombatEnd();
  if(_CS){renderCombat();setTimeout(()=>advanceTurn(),400);}
}

function resolveAttack(sk,actor,target){
  if(target.dead)return;
  const acc=(actor.derived?.accuracy||75)+(sk.targeting?.accuracyMod||0);
  const dodge=target.dodge||target.derived?.dodge||0;
  if(Math.random()*100>acc-dodge){combatLog(actor.name+' attacks '+target.name+' — <em>miss!</em>','miss');return;}
  let dmg=rollDice(sk.damage?.dice||'1d6')+(sk.damage?.flat||0);
  const ss=sk.damage?.scaleStat; if(ss&&ss!=='none'&&actor.stats?.[ss])dmg+=Math.floor(actor.stats[ss]*(sk.damage.scaleAmt||50)/100);
  const isCrit=Math.random()*100<(actor.derived?.crit||5);
  if(isCrit)dmg=Math.round(dmg*(sk.damage?.critMult||1.5));
  // Sadistic trait: +10% damage to enemies below 30% HP
  if (hasActiveTrait(actor, 'sadistic') && target.hp < target.maxHp * 0.3) {
    dmg = Math.round(dmg * 1.1);
  }
  dmg=Math.max(1,dmg-(target.armour||0));
  const resist=target.resistances?.[sk.damage?.type||'physical']||0;
  if(resist>0)dmg=Math.round(dmg*(1-resist/100));
  if((target.shield||0)>0){const ab=Math.min(target.shield,dmg);target.shield-=ab;dmg-=ab;if(ab)combatLog(target.name+"'s shield absorbs "+ab+'.','effect');}
  target.hp=Math.max(0,target.hp-dmg);
  combatLog(actor.name+' hits '+target.name+' — '+dmg+' '+(sk.damage?.type||'physical')+' damage'+(isCrit?' <strong>CRITICAL!</strong>':'')+'.',isCrit?'crit':'hit');
  if(sk.effects?.dot?.type&&sk.effects.dot.type!=='none'&&sk.effects.dot.dmg>0)applyEffect(target,sk.effects.dot.type,{dmg:sk.effects.dot.dmg,turns:sk.effects.dot.turns||2,maxStacks:sk.effects.dot.maxStacks||1});
  if(sk.effects?.status?.effect&&sk.effects.status.effect!=='none'&&Math.random()*100<(sk.effects.status.chance||100))applyEffect(target,sk.effects.status.effect,{turns:2});
  if(target.side==='ally'){const sd=Math.max(0,(sk.effects?.stressDmg||0)-(target.derived?.stressRes||0)/10);if(sd>0){target.stress=Math.min(100,(target.stress||0)+sd);combatLog(target.name+' stress +'+sd+'%.','effect');}}
  if(target.hp<=0&&!target.dead){target.dead=true;combatLog(target.name+' falls.','crit');if(target.side==='enemy'&&_characterData){_characterData.xp=(_characterData.xp||0)+(target.xpReward||50);combatLog('+'+(target.xpReward||50)+' XP','system');checkLevelUp();}}
}

function resolveHeal(sk,actor,target){
  if(!sk.effects?.heal)return;
  const h=rollDice(sk.effects.heal.dice||'0')+(sk.effects.heal.flat||0);
  if(sk.category==='revive'&&target.dead){target.dead=false;target.hp=Math.max(1,Math.round(target.maxHp*(sk.effects.heal.reviveHpPct||25)/100));combatLog(target.name+' is revived with '+target.hp+' HP!','heal');}
  else if(!target.dead&&h>0){target.hp=Math.min(target.maxHp,target.hp+h);combatLog(actor.name+' heals '+target.name+' for '+h+' HP.','heal');}
  if(sk.effects.heal.stressHeal>0&&!target.dead){target.stress=Math.max(0,(target.stress||0)-sk.effects.heal.stressHeal);combatLog(target.name+' stress -'+sk.effects.heal.stressHeal+'%.','effect');}
}

function resolveBuff(sk,actor,target){
  if(!sk.effects?.buff||sk.effects.buff.stat==='none')return;
  const st=sk.effects.buff.stat,am=sk.effects.buff.amt||0,tu=sk.effects.buff.turns||1;
  if(st==='hp')target.hp=Math.min(target.maxHp,target.hp+am);
  else if(st==='shield')target.shield=(target.shield||0)+am;
  else if(st==='stress')target.stress=Math.max(0,Math.min(100,(target.stress||0)+am));
  else if(target.derived)target.derived[st]=(target.derived[st]||0)+am;
  combatLog(target.name+': '+st+' '+(am>0?'+':'')+am+' for '+tu+' turns.','effect');
  applyEffect(target,st+'_buff',{amt:am,turns:tu});
  if(sk.effects?.turnOrder?.initiativeMod){const t2=sk.effects.turnOrder.applyTo==='self'?actor:target;t2.initiative+=sk.effects.turnOrder.initiativeMod;_CS.combatants.sort((a,b)=>b.initiative-a.initiative);}
}

function applyEffect(combatant,type,opts){
  const ex=combatant.effects.find(e=>e.type===type);
  if(ex){ex.stacks=Math.min(opts.maxStacks||99,(ex.stacks||1)+1);ex.turns=Math.max(ex.turns,opts.turns||2);}
  else combatant.effects.push({type,stacks:1,turns:opts.turns||2,dmg:opts.dmg||0});
}

function processDots(){
  if(!_CS)return;
  _CS.combatants.filter(c=>!c.dead&&c.effects.length).forEach(c=>{
    const rm=[];
    c.effects.forEach((ef,i)=>{
      if(ef.dmg>0){const d=ef.dmg*(ef.stacks||1);c.hp=Math.max(0,c.hp-d);combatLog(c.name+' takes '+d+' '+ef.type+' damage.','effect');if(c.hp<=0&&!c.dead){c.dead=true;combatLog(c.name+' falls to '+ef.type+'.','crit');}}
      ef.turns--; if(ef.turns<=0)rm.push(i);
    });
    rm.reverse().forEach(i=>c.effects.splice(i,1));
  });
}

function maybeEnemyTurn(){
  if(!_CS)return;
  const active=_CS.combatants[_CS.turnIdx];
  if(active&&active.side==='enemy'&&!active.dead)runEnemyAI(active);
}

function advanceTurn(){
  if(!_CS)return;
  let next=_CS.turnIdx+1;
  if(next>=_CS.combatants.length){next=0;_CS.round++;processDots();combatLog('— Round '+_CS.round+' —','system');}
  let safety=0;
  while(_CS.combatants[next]?.dead&&safety<_CS.combatants.length){next++;if(next>=_CS.combatants.length)next=0;safety++;}
  _CS.turnIdx=next;
  renderCombat();
  setTimeout(()=>maybeEnemyTurn(),300);
}

function combatPass(){
  if(!_CS)return;
  _pendingSkill=null;
  document.getElementById('combat-target-prompt').classList.remove('active');
  document.querySelectorAll('.combatant-card').forEach(c=>c.classList.remove('targeted'));
  combatLog((_CS.combatants[_CS.turnIdx]?.name||'?')+' passes.','system');
  advanceTurn();
}

function runEnemyAI(enemy){
  if(!_CS)return;
  const targets=_CS.combatants.filter(c=>c.side==='ally'&&!c.dead);
  if(!targets.length){checkCombatEnd();return;}
  const target=targets[Math.floor(Math.random()*targets.length)];
  const sk={_key:'basic',name:enemy.name,category:'attack',damage:{type:'physical',dice:enemy.damageExpr||'1d6',flat:0,scaleStat:'none',scaleAmt:0,critMult:1.3},targeting:{target:'single-ally',hits:1,accuracyMod:0}};
  resolveAttack(sk,enemy,target);
  const baseStress = enemy.stats?.stress||5;
  const stressRes = (target.derived?.stressRes||0)/10;
  const paranoidMult = hasActiveTrait(target, 'paranoid') ? 1.2 : 1;
  const sd = Math.max(0, (baseStress - stressRes) * paranoidMult);
  if(sd>0)target.stress=Math.min(100,(target.stress||0)+sd);
  checkCombatEnd();
  if(_CS){renderCombat();setTimeout(()=>advanceTurn(),600);}
}

function checkCombatEnd() {
  if (!_CS) return;
  const aliveEnemies = _CS.combatants.filter(c => c.side==='enemy' && !c.dead);
  const aliveAllies  = _CS.combatants.filter(c => c.side==='ally'  && !c.dead);
  const playerCbt    = _CS.combatants.find(c => c.isPlayer);

  // Process freshly dead allies this tick
  _CS.combatants.filter(c => c.side==='ally' && c.dead && !c.deathProcessed).forEach(c => {
    c.deathProcessed = true;
    if (c.isPlayer) return; // handled at combat end
    handleAcolyteDeath(c);
  });

  if (aliveEnemies.length === 0) {
    // ── VICTORY ──
    combatLog('✦ All enemies defeated.', 'crit');

    // Collect loot
    const loot = [];
    _CS.combatants.filter(c => c.side==='enemy').forEach(e => {
      (e.loot||[]).forEach(l => {
        const idx = RES_NAMES.indexOf(l.name);
        if (idx >= 0 && l.amount > 0) {
          values[idx] = Math.min(resCaps[idx], (values[idx]||0) + l.amount);
          loot.push(RES_SYMBOLS[idx] + '+' + l.amount);
        }
      });
    });
    if (loot.length) combatLog('Loot: ' + loot.join(' '), 'system');

    // XP to player
    const totalXp = _CS.combatants.filter(c => c.side==='enemy').reduce((s,e) => s+(e.xpReward||50), 0);
    if (_characterData && totalXp) {
      _characterData.xp = (_characterData.xp||0) + totalXp;
      combatLog('+' + totalXp + ' XP', 'system');
      checkLevelUp();
    }

    // Update resource display
    document.querySelectorAll('.resource-pill .res-value').forEach((el,i) => {
      el.textContent = Math.floor(values[i]);
    });

    document.getElementById('combat-skill-grid').innerHTML = '';
    document.getElementById('combat-actor-label').textContent = '';
    persistState().catch(() => {});
    // Show victory overlay
    showCombatVictory({ loot, totalXp });
    _CS = null;

  } else if (aliveAllies.length === 0 || (playerCbt && playerCbt.dead)) {
    // ── DEFEAT ──
    const playerDied = playerCbt && playerCbt.dead;
    const fullRout   = aliveAllies.length === 0;

    if (playerDied || fullRout) {
      combatLog('✗ The company falls.', 'hit');
      document.getElementById('combat-skill-grid').innerHTML = '';
      document.getElementById('combat-actor-label').textContent = '';
      _CS = null;
      if (playerDied) handlePlayerDeath(); // shows defeat overlay itself
    }
  }
}

function handleAcolyteDeath(combatant) {
  // Find source acolyte in _acolytesData
  const src = combatant.sourceAcolyte || (_acolytesData||[]).find(a => a.id === combatant.id);
  if (!src) return;

  combatLog(`${src.name} has fallen — permanently.`, 'crit');

  // Split inventory: 50% chance each item goes to object pool, rest lost
  const recovered = [];
  const lost = [];
  (src.inventory || []).forEach(it => {
    if (Math.random() > 0.5) recovered.push(it);
    else lost.push(it);
  });

  // Add recovered items to player inventory pool
  recovered.forEach(it => {
    const key = it.name || it;
    inventory[key] = (inventory[key] || 0) + 1;
  });

  if (recovered.length) combatLog(`Recovered from ${src.name}: ${recovered.map(i=>i.name||i).join(', ')}.`, 'system');
  if (lost.length) combatLog(`Lost with ${src.name}: ${lost.map(i=>i.name||i).join(', ')}.`, 'system');

  // Remove acolyte from roster permanently
  if (_acolytesData) {
    const idx = _acolytesData.findIndex(a => a.id === src.id);
    if (idx >= 0) _acolytesData.splice(idx, 1);
  }
  // Update available
  if (availableAcolytes) delete availableAcolytes[src.id];

  // Mark in save
  persistState().catch(() => {});
}

function handlePlayerDeath() {
  // XP penalty: lose 20% of current XP
  if (_characterData) {
    const xpLost = Math.floor((_characterData.xp || 0) * 0.2);
    _characterData.xp = Math.max(0, (_characterData.xp||0) - xpLost);
    // Stress penalty
    _characterData.stress = Math.min(100, (_characterData.stress||0) + 30);
    // Temp malus flag (used by resource tick to apply -15% rates for 2h)
    _characterData.deathMalus = { until: Date.now() + 2*3600000, xpLost };
    // Resource drain: -15% of current resources
    for (let i = 0; i < values.length; i++) {
      values[i] = Math.max(0, Math.floor(values[i] * 0.85));
    }
    const costs = [
      `XP −${xpLost}`,
      `Stress +30`,
      `All resources −15%`,
      `Income −15% for 2 hours`,
    ];
    const defeatEl = document.getElementById('combat-defeat-overlay');
    document.getElementById('defeat-title').textContent = 'The Lair Holds You';
    document.getElementById('defeat-body').textContent =
      'You drag yourself back through the threshold. The lair remembers what happened.';
    document.getElementById('defeat-cost').innerHTML = costs.join('<br>');
    if (defeatEl) defeatEl.classList.add('open');
    persistState().catch(() => {});
  }
}

async function checkLevelUp() {
  if (!_characterData) return;
  let levelled = false;
  let newLevel = _characterData.level || 1;

  while (true) {
    const needed = xpForNextLevel(newLevel);
    if (_characterData.xp >= needed && newLevel < 20) {
      _characterData.xp -= needed;
      newLevel++;
      levelled = true;
    } else break;
  }
  if (!levelled) { refreshCharacterBar(); return; }

  _characterData.level = newLevel;

  // Load class data from Firebase to get levelUpBonuses
  let classData = null;
  try {
    const key = _characterData.classKey || 'hermeticist';
    const res = await fetch(`${FB_URL}/world/classes/${key}.json?cb=`+Date.now());
    if (res.ok) { const d = await res.json(); if (d && !d.error) classData = d; }
  } catch(e) {}

  // Determine stat gains
  const FALLBACK_GAINS = {
    'hermeticist':  ['cunning','gnosis'],
    'flagellant':   ['fortitude','endurance'],
    'plague-scribe':['memory','cunning'],
  };
  const key = (_characterData.classKey||'hermeticist').toLowerCase();
  let statGains = [];

  // Try to read from Firebase class levelUpBonuses[newLevel]
  const levelBonuses = classData?.levelUpBonuses;
  if (levelBonuses) {
    const bonusEntry = Array.isArray(levelBonuses)
      ? levelBonuses.find(b => b.level === newLevel)
      : levelBonuses[newLevel] || levelBonuses[String(newLevel)];
    if (bonusEntry?.statGains) {
      statGains = Object.entries(bonusEntry.statGains).map(([stat,amt]) => ({stat,amt:Number(amt)}));
    }
  }
  // Fallback: +1 to two class stats
  if (!statGains.length) {
    (FALLBACK_GAINS[key] || ['fortitude','cunning']).forEach(stat => statGains.push({stat, amt:1}));
  }

  // Apply stat gains
  if (!_characterData.stats) _characterData.stats = {};
  statGains.forEach(({stat,amt}) => {
    _characterData.stats[stat] = (_characterData.stats[stat]||0) + amt;
  });

  // Skill unlock at this level
  const newSkillKey = levelBonuses
    ? (Array.isArray(levelBonuses)
        ? levelBonuses.find(b=>b.level===newLevel)?.skillKey
        : (levelBonuses[newLevel]||levelBonuses[String(newLevel)])?.skillKey)
    : null;
  if (newSkillKey && _cachedWorldSkills?.[newSkillKey]) {
    const sk = _cachedWorldSkills[newSkillKey];
    if (!_characterData.skills) _characterData.skills = [];
    if (!_characterData.skills.find(s=>(s.key||s)===newSkillKey)) {
      _characterData.skills.push({key:newSkillKey, name:sk.name||newSkillKey, desc:sk.desc||''});
      combatLog && combatLog(`Unlocked skill: ${sk.name||newSkillKey}`, 'system');
    }
  }

  // Specializations — check if any defined for this level
  const specs = classData?.specializations
    ? (Array.isArray(classData.specializations)
        ? classData.specializations.filter(s => (s.level||0)<=newLevel)
        : Object.values(classData.specializations).filter(s=>(s.level||0)<=newLevel))
    : [];
  // Only offer specs that haven't been chosen yet
  const chosenSpecs = _characterData.chosenSpecializations || [];
  const availableSpecs = specs.filter(s => !chosenSpecs.includes(s.name));

  _pendingLevelUp = { newLevel, statGains, newSkillKey, availableSpecs };
  showLevelUpModal(newLevel);
  refreshCharacterBar();
}

function showLevelUpModal(newLevel) {
  const lu = _pendingLevelUp || { newLevel, statGains: [], availableSpecs: [] };
  document.getElementById('lu-roman').textContent = toRoman(newLevel);
  document.getElementById('lu-title').textContent = `Level ${newLevel} Attained`;

  // Stat gains
  const gainsEl = document.getElementById('lu-gains');
  gainsEl.innerHTML = lu.statGains.map(g =>
    `<div class="levelup-gain-row">${g.stat.charAt(0).toUpperCase()+g.stat.slice(1)}<span>+${g.amt}</span></div>`
  ).join('');
  if (lu.newSkillKey && _cachedWorldSkills?.[lu.newSkillKey]) {
    const sk = _cachedWorldSkills[lu.newSkillKey];
    gainsEl.innerHTML += `<div class="levelup-gain-row">New Skill: ${sk.name||lu.newSkillKey}<span style="color:var(--viridian-bright);">unlocked</span></div>`;
  }
  if (!lu.statGains.length && !lu.newSkillKey) {
    gainsEl.innerHTML = `<div class="levelup-gain-row">The lair stirs with your ascent.<span>—</span></div>`;
  }

  // Specializations
  const specSection = document.getElementById('lu-spec-section');
  const specGrid = document.getElementById('lu-spec-grid');
  if (lu.availableSpecs && lu.availableSpecs.length) {
    specSection.style.display = '';
    specGrid.innerHTML = lu.availableSpecs.map((spec, i) => {
      const bonusStr = spec.statBonus
        ? Object.entries(spec.statBonus).map(([s,v])=>`${s} +${v}`).join(', ')
        : '';
      return `<div class="levelup-spec-card" id="spec-card-${i}" onclick="selectSpec(${i})">
        <div class="levelup-spec-name">${spec.name||'Unknown Path'}</div>
        <div class="levelup-spec-desc">${spec.desc||''}</div>
        ${bonusStr?`<div class="levelup-spec-bonus">${bonusStr}${spec.skillKey?' · Skill: '+spec.skillKey:''}</div>`:''}
      </div>`;
    }).join('');
    document.getElementById('lu-confirm-btn').textContent = 'Choose a Path to Ascend';
    document.getElementById('lu-confirm-btn').disabled = true;
    document.getElementById('lu-confirm-btn').style.opacity = '0.5';
  } else {
    specSection.style.display = 'none';
    document.getElementById('lu-confirm-btn').textContent = 'Ascend';
    document.getElementById('lu-confirm-btn').disabled = false;
    document.getElementById('lu-confirm-btn').style.opacity = '1';
  }

  document.getElementById('levelup-modal').classList.add('open');
}

function selectSpec(idx) {
  _chosenSpecIdx = idx;
  document.querySelectorAll('.levelup-spec-card').forEach((el,i) => {
    el.classList.toggle('selected', i === idx);
  });
  const btn = document.getElementById('lu-confirm-btn');
  btn.textContent = 'Ascend';
  btn.disabled = false;
  btn.style.opacity = '1';
}

function confirmLevelUp() {
  const lu = _pendingLevelUp;
  if (!lu) { document.getElementById('levelup-modal').classList.remove('open'); return; }

  // Apply chosen specialization
  if (lu.availableSpecs && lu.availableSpecs.length && _chosenSpecIdx !== null) {
    const spec = lu.availableSpecs[_chosenSpecIdx];
    if (spec) {
      if (!_characterData.chosenSpecializations) _characterData.chosenSpecializations = [];
      _characterData.chosenSpecializations.push(spec.name);
      // Apply stat bonus
      if (spec.statBonus && _characterData.stats) {
        Object.entries(spec.statBonus).forEach(([s,v]) => {
          _characterData.stats[s] = (_characterData.stats[s]||0) + Number(v);
        });
      }
      // Apply skill unlock
      if (spec.skillKey && _cachedWorldSkills?.[spec.skillKey]) {
        const sk = _cachedWorldSkills[spec.skillKey];
        if (!_characterData.skills) _characterData.skills = [];
        if (!_characterData.skills.find(s=>(s.key||s)===spec.skillKey)) {
          _characterData.skills.push({key:spec.skillKey, name:sk.name||spec.skillKey, desc:sk.desc||''});
        }
      }
    }
  } else if (lu.availableSpecs && lu.availableSpecs.length && _chosenSpecIdx === null) {
    toast('Choose a path before ascending.');
    return;
  }

  _pendingLevelUp = null;
  _chosenSpecIdx  = null;
  document.getElementById('levelup-modal').classList.remove('open');
  refreshCharacterBar();
  persistState().catch(() => {});
}

function applyLevelUpStatGains(char) {
  // Each level up: +1 to two stats based on class key
  const classGains = {
    'hermeticist':  ['cunning','gnosis'],
    'flagellant':   ['fortitude','endurance'],
    'plague-scribe':['memory','cunning'],
  };
  const key = (char.classKey || '').toLowerCase();
  const gains = classGains[key] || ['fortitude','cunning'];
  if (!char.stats) return;
  gains.forEach(stat => { char.stats[stat] = (char.stats[stat] || 0) + 1; });
}

function xpForNextLevel(level) { return level * 1000; }

function toRoman(n) {
  const v=[1000,900,500,400,100,90,50,40,10,9,5,4,1];
  const s=['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
  let r=''; v.forEach((val,i)=>{while(n>=val){r+=s[i];n-=val;}});
  return r;
}

function getSkillsFor(combatant){
  // For player/acolytes, use their saved skills[] array (learned skills only)
  const savedSkills = (combatant.skills||[]);
  if (savedSkills.length && _cachedWorldSkills) {
    return savedSkills.map(s => {
      const key = s.key || s;
      const worldSk = _cachedWorldSkills[key] || {};
      return { _key: key, name: s.name||worldSk.name||key, ...worldSk, ...s };
    }).filter(s => (s.category||s.cat||'') !== 'rite').slice(0, 6);
  }
  // Fallback: use world skills filtered by class (for chars without saved skills)
  if (!_cachedWorldSkills) return [];
  const cc = (combatant.classKey||'').toLowerCase();
  const lv = combatant.isPlayer ? (_characterData?.level||1) : (combatant.level||1);
  return Object.entries(_cachedWorldSkills).filter(([k,s]) => {
    if (!s) return false;
    const cat = s.category||s.cat||s.type||'';
    if (cat === 'rite') return false;
    const classOk = !s.classKey || s.classKey.toLowerCase()===cc;
    const levelOk = (s.unlockLevel||1) <= lv;
    return classOk && levelOk;
  }).map(([k,s]) => ({_key:k,...s})).slice(0, 6);
}

function derivedStats(baseStats, level) {
  const s = baseStats || {};
  const lv = level || 1;
  const cs = (typeof _combatSystem !== 'undefined' && _combatSystem) ? _combatSystem.formulae : null;
  const calc = (key, def) => {
    if (!cs || !cs[key]) return def;
    let v = (cs[key].flat||0) + (cs[key].perLevel||0)*lv;
    for (const [stat,coeff] of Object.entries(cs[key].coeffs||{})) v += (s[stat]||0)*coeff;
    if (cs[key].min !== undefined) v = Math.max(cs[key].min, v);
    if (cs[key].cap !== undefined) v = Math.min(cs[key].cap, v);
    return Math.round(v*10)/10;
  };
  const fo=s.fortitude||10,wr=s.wrath||8,it=s.intuition||12,em=s.empathy||10;
  const en=s.endurance||10,me=s.memory||8,cu=s.cunning||12,gn=s.gnosis||0,sp=s.speed||10;
  return {
    hp:        calc('hp',        en*5+fo*2+lv*3),
    mana:      calc('mana',      gn*5+me*2+lv*2),
    shield:    calc('shield',    fo*2+en),
    initiative:calc('initiative',cu*2+sp),
    crit:      calc('crit',      Math.min(60,Math.max(5,cu*1.5+wr*0.5))),
    dodge:     calc('dodge',     Math.min(50,Math.max(0,cu+it*0.5))),
    accuracy:  calc('accuracy',  60+it*1.5+cu*0.5),
    stressRes: calc('stressRes', em*2+en),
  };
}

function rollDice(expr) {
  if (!expr || expr === '') return 0;
  const s = String(expr).trim();
  if (!s) return 0;
  const m = s.match(/(\d+)d(\d+)([+-]\d+)?/i);
  if (!m) return Math.max(0, parseInt(s)||0);
  let t=0;
  for (let i=0;i<parseInt(m[1]);i++) t+=Math.floor(Math.random()*parseInt(m[2]))+1;
  if (m[3]) t+=parseInt(m[3]);
  return Math.max(0,t);
}

function inspectCombatant(cid) {
  if (!_CS) return;
  const cb = _CS.combatants.find(x => x.id === cid);
  if (!cb) return;
  const body = document.getElementById('combat-overlay-body');
  if (!body) return;

  if (cb.side === 'enemy') {
    const hpPct = Math.round((cb.hp / cb.maxHp) * 100);
    const lootHtml = (cb.loot||[]).map(l =>
      `<div class="cov-row"><span class="cov-key">${l.name||l}</span><span class="cov-val">${l.amount?'×'+l.amount:''}</span></div>`
    ).join('') || '<div class="cov-body">Nothing certain.</div>';
    const abHtml = (cb.abilities||[]).map(a =>
      `<div class="cov-row"><span class="cov-key">${a}</span></div>`
    ).join('') || '<div class="cov-body">None observed.</div>';
    const resistHtml = Object.entries(cb.resistances||{}).filter(([,v])=>v).map(([k,v]) =>
      `<div class="cov-row"><span class="cov-key">${k}</span><span class="cov-val" style="color:${v>0?'var(--viridian-bright)':'var(--crimson-bright)'}">${v>0?'-'+v+'%':'+'+Math.abs(v)+'%'}</span></div>`
    ).join('') || '<div class="cov-body">No resistances recorded.</div>';
    body.innerHTML = `
      <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.8rem;">
        <span style="font-family:var(--ff-heading);font-size:1.4rem;color:var(--crimson-bright);">${cb.icon||'▽'}</span>
        <div>
          <div class="cov-title">${cb.name}</div>
          <div style="font-family:var(--ff-heading);font-size:0.5rem;letter-spacing:0.15em;color:var(--text-secondary);text-transform:uppercase;">${cb.dead?'Fallen':'Enemy'}</div>
        </div>
      </div>
      <div class="cov-row"><span class="cov-key">HP</span><span class="cov-val" style="color:${hpPct<30?'var(--crimson-bright)':'var(--viridian-bright)'}">${Math.ceil(cb.hp)} / ${cb.maxHp} (${hpPct}%)</span></div>
      <div class="cov-row"><span class="cov-key">Armour</span><span class="cov-val">${cb.armour||0}</span></div>
      <div class="cov-row"><span class="cov-key">Dodge</span><span class="cov-val">${cb.dodge||0}%</span></div>
      <div class="cov-row"><span class="cov-key">Initiative</span><span class="cov-val">${Math.round(cb.initiative||0)}</span></div>
      <div class="cov-row"><span class="cov-key">Base Damage</span><span class="cov-val">${cb.damageExpr||'—'}</span></div>
      <div class="cov-row"><span class="cov-key">XP Reward</span><span class="cov-val">${cb.xpReward||0}</span></div>
      <div class="cov-section">Abilities</div>${abHtml}
      <div class="cov-section">Resistances</div>${resistHtml}
      <div class="cov-section">Potential Loot</div>${lootHtml}`;
  } else {
    const d = cb.derived || {};
    const skills = getSkillsFor(cb);
    const skillsHtml = skills.map(sk =>
      `<div class="cov-row"><span class="cov-key">${sk.name||sk._key}</span><span class="cov-val" style="font-size:0.5rem;">${sk.category||''}</span></div>`
    ).join('') || '<div class="cov-body">No skills learned.</div>';
    const invHtml = (cb.inventory||[]).map(it =>
      `<div class="cov-row"><span class="cov-key">${it.name||it}</span></div>`
    ).join('') || '<div class="cov-body">Nothing equipped.</div>';
    const stressColor = (cb.stress||0)>=80?'var(--crimson-bright)':(cb.stress||0)>=50?'var(--amber-bright)':'var(--viridian-bright)';
    body.innerHTML = `
      <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.8rem;">
        <span style="font-family:var(--ff-heading);font-size:1.4rem;color:var(--viridian-bright);">${cb.icon||'△'}</span>
        <div>
          <div class="cov-title">${cb.name}</div>
          <div style="font-family:var(--ff-heading);font-size:0.5rem;letter-spacing:0.15em;color:var(--text-secondary);text-transform:uppercase;">${cb.isPlayer?'Player Character':'Acolyte'}</div>
        </div>
      </div>
      <div class="cov-row"><span class="cov-key">HP</span><span class="cov-val">${Math.ceil(cb.hp)} / ${cb.maxHp}</span></div>
      <div class="cov-row"><span class="cov-key">Mana</span><span class="cov-val">${Math.ceil(cb.mana||0)} / ${cb.maxMana||0}</span></div>
      <div class="cov-row"><span class="cov-key">Stress</span><span class="cov-val" style="color:${stressColor}">${Math.round(cb.stress||0)}%</span></div>
      <div class="cov-row"><span class="cov-key">Initiative</span><span class="cov-val">${Math.round(cb.initiative||0)}</span></div>
      <div class="cov-row"><span class="cov-key">Crit</span><span class="cov-val">${d.crit||0}%</span></div>
      <div class="cov-row"><span class="cov-key">Dodge</span><span class="cov-val">${d.dodge||0}%</span></div>
      <div class="cov-row"><span class="cov-key">Accuracy</span><span class="cov-val">${d.accuracy||0}</span></div>
      ${(cb.shield||0)>0?`<div class="cov-row"><span class="cov-key">Shield</span><span class="cov-val">${cb.shield}</span></div>`:''}
      <div class="cov-section">Skills</div>${skillsHtml}
      <div class="cov-section">Equipment</div>${invHtml}`;
  }
  document.getElementById('combat-overlay')?.classList.add('open');
}

function showSkillTooltip(key, evt) {
  if (evt) { evt.stopPropagation(); evt.preventDefault(); }
  const sk = (_cachedWorldSkills && _cachedWorldSkills[key]) || {};
  const cat = sk.category || sk.cat || 'attack';
  const CAT_COL = {attack:'var(--crimson-bright)',heal:'var(--viridian-bright)',
    buff:'var(--amber-bright)',debuff:'var(--mist)',revive:'var(--indigo-bright)',utility:'var(--gold)'};
  const col = CAT_COL[cat] || 'var(--gold)';

  // Damage line
  let dmgHtml = '';
  if (sk.damage && sk.damage.type && sk.damage.type !== 'none') {
    dmgHtml = `<div class="csheet-sep">Damage</div>
      <div style="font-family:var(--ff-heading);font-size: 0.7rem;color:${col};">
        ${sk.damage.dice||''}${sk.damage.flat?'+'+sk.damage.flat:''} <span style="text-transform:uppercase;letter-spacing:0.1em;">${sk.damage.type}</span>
      </div>
      ${sk.damage.scaleStat&&sk.damage.scaleStat!=='none'?`<div style="font-family:var(--ff-heading);font-size: 0.41rem;letter-spacing:0.1em;color:var(--text-secondary);margin-top:0.2rem;">Scales with ${sk.damage.scaleStat} (${sk.damage.scaleAmt||50}%)</div>`:''}
      ${sk.damage.critMult?`<div style="font-family:var(--ff-heading);font-size: 0.41rem;letter-spacing:0.1em;color:var(--text-secondary);">Crit ×${sk.damage.critMult}</div>`:''}`;
  }

  // Effects line
  let effHtml = '';
  if (sk.effects) {
    const parts = [];
    if (sk.effects.heal?.flat || sk.effects.heal?.dice) parts.push(`Heals ${sk.effects.heal.dice||''}${sk.effects.heal.flat?'+'+sk.effects.heal.flat:''} HP`);
    if (sk.effects.heal?.stressHeal) parts.push(`Stress −${sk.effects.heal.stressHeal}%`);
    if (sk.effects.buff?.stat && sk.effects.buff.stat !== 'none') parts.push(`${sk.effects.buff.stat} +${sk.effects.buff.amt} for ${sk.effects.buff.turns} turns`);
    if (sk.effects.dot?.dmg) parts.push(`DoT ${sk.effects.dot.dmg}/turn for ${sk.effects.dot.turns} turns (${sk.effects.dot.type})`);
    if (sk.effects.status?.type) parts.push(`Applies ${sk.effects.status.type} for ${sk.effects.status.turns} turns`);
    if (parts.length) effHtml = `<div class="csheet-sep">Effects</div>${parts.map(p=>`<div style="font-family:var(--ff-body);font-style:italic;font-size: 0.78rem;color:var(--text-secondary);padding:0.1rem 0;">${p}</div>`).join('')}`;
  }

  // Cost / targeting
  const costLine = [];
  if (sk.cost?.mana) costLine.push(`${sk.cost.mana} mana`);
  if (sk.targeting?.target) costLine.push(`Target: ${sk.targeting.target.replace(/-/g,' ')}`);
  if (sk.targeting?.hits && sk.targeting.hits > 1) costLine.push(`${sk.targeting.hits} hits`);

  document.getElementById('combat-overlay-body').innerHTML = `
    <div class="csheet-head">
      <div class="csheet-icon">◈</div>
      <div class="csheet-name">${sk.name || key}</div>
      <div class="csheet-type" style="color:${col};">${cat}</div>
    </div>
    <div class="csheet-desc">${sk.desc || 'No description available.'}</div>
    ${dmgHtml}
    ${effHtml}
    ${costLine.length ? `<div class="csheet-sep">Cost &amp; Targeting</div>
      <div class="csheet-stat-grid">${costLine.map(l=>`<div class="csheet-stat"><span>${l}</span></div>`).join('')}</div>` : ''}
    ${sk.classKey ? `<div style="margin-top:0.6rem;"><span class="csheet-tag">${sk.classKey}</span>${sk.unlockLevel?`<span class="csheet-tag">Unlocks Lv.${sk.unlockLevel}</span>`:''}</div>` : ''}
    <button class="csheet-close" onclick="document.getElementById('combat-overlay').classList.remove('open')">Close</button>`;
  document.getElementById('combat-overlay').classList.add('open');
}

function hasActiveTrait(combatant, traitKey) {
  if (combatant?.isPlayer) {
    return (_characterData?.traits||[]).includes(traitKey);
  }
  return (combatant?.traits||[]).includes(traitKey);
}

function applyTraitCheckBonus(stat, baseBonus) {
  let bonus = baseBonus;
  const traits = _characterData?.traits || [];
  if (traits.includes('meticulous') && (stat==='memory'||stat==='cunning')) bonus += 2;
  if (traits.includes('devout') && stat==='gnosis') bonus += 2;
  if (traits.includes('sardonic') && stat==='cunning') bonus += 1;
  return bonus;
}

async function runSkillChecks(checks) {
  const STAT_LABEL = {
    fortitude:'Fortitude', wrath:'Wrath', intuition:'Intuition',
    empathy:'Empathy', endurance:'Endurance', memory:'Memory',
    cunning:'Cunning', gnosis:'Gnosis', speed:'Speed',
  };
  // Build roster: player + all acolytes
  const roster = [];
  if (_characterData) {
    roster.push({ name: _characterData.name || playerName || 'Seeker', stats: _characterData.stats || {} });
  }
  (_acolytesData || []).forEach(a => roster.push({ name: a.name, stats: a.stats || {} }));

  let allPassed = true;
  for (const check of checks) {
    const stat = (check.stat || 'cunning').toLowerCase();
    const dc   = parseInt(check.diff || check.dc || check.difficulty || 12);

    // Best party member for this stat
    let best = { name: roster[0]?.name || 'Seeker', statVal: 10 };
    roster.forEach(r => {
      const v = Number(r.stats[stat]) || 0;
      if (v > best.statVal) best = { name: r.name, statVal: v };
    });

    const roll  = Math.floor(Math.random() * 20) + 1;
    const total = roll + best.statVal;
    const pass  = total >= dc;
    const col   = pass ? 'var(--viridian-bright)' : 'var(--crimson-bright)';
    const label = pass ? 'SUCCESS' : 'FAILURE';

    // Insert result card into journal feed and switch to it
    const feed = document.getElementById('journal-feed');
    if (feed) {
      const card = document.createElement('div');
      card.className = 'journal-entry';
      card.style.cssText = `border-left-color:${col};`;
      const extraText = pass
        ? (check.successText || check.success || '')
        : (check.failText    || check.failure  || '');
      card.innerHTML = `
        <div class="entry-header">
          <span class="entry-title" style="color:${col};">${pass ? '✓' : '✗'} ${STAT_LABEL[stat] || stat} Check — DC ${dc}</span>
          <span class="entry-time">${label}</span>
        </div>
        <p class="entry-body">
          <strong>${best.name}</strong> rolls <strong>${roll}</strong>
          + ${best.statVal} ${STAT_LABEL[stat] || stat}
          = <strong style="color:${col};">${total}</strong> vs DC ${dc}
        </p>
        ${extraText ? `<p class="entry-body" style="margin-top:0.3rem;font-style:italic;">${extraText}</p>` : ''}`;
      feed.insertBefore(card, feed.firstChild);
      switchTab('journal');
      // Blocking result screen — player must tap to continue
      await showSkillCheckResult({ pass, name: best.name, roll, statVal: best.statVal,
        statLabel: STAT_LABEL[stat]||stat, total, dc, extraText, col });
    }

    if (!pass) { allPassed = false; break; }
  }
  return allPassed;
}

function applyCheckFailurePenalty(ev) {
  const stress = ev.failureStress || 10;
  (_acolytesData || []).forEach(a => {
    a.stress = Math.min(100, (a.stress || 0) + stress);
  });
  if (_acolytesData?.length) renderAcolyteCards(_acolytesData);
  toast(`✗ The check failed. ${stress} stress falls on the company.`);
  persistState().catch(() => {});
}

function useCombatItem(itemKey, actorId) {
  if (!_CS) return;
  const actor = _CS.combatants.find(cb => cb.id === actorId);
  if (!actor) return;
  const r = RECIPES.find(x => x.key === itemKey);
  if (!r) { toast('Item not found.'); return; }

  // Deduct from inventory
  if (actor.isPlayer) {
    if ((inventory[itemKey]||0) <= 0) { toast('None left.'); return; }
    inventory[itemKey]--;
    if (inventory[itemKey] <= 0) delete inventory[itemKey];
  } else {
    // Acolyte — remove from their carried inventory
    const src = actor.sourceAcolyte;
    if (src?.inventory) {
      const idx = src.inventory.findIndex(i=>(i.name||i)===r.name);
      if (idx >= 0) src.inventory.splice(idx, 1);
    }
  }

  // Resolve effect based on recipe type/effect text
  const effect = (r.effect||'').toLowerCase();
  const name = r.name;

  // Healing items
  if (effect.includes('heal') || effect.includes('hp') || effect.includes('restore')) {
    const healAmt = parseInt(effect.match(/\+?(\d+)/)?.[1] || '20');
    const targets = effect.includes('all') ? _CS.combatants.filter(c=>c.side==='ally'&&!c.dead) : [actor];
    targets.forEach(t => {
      const old = t.hp;
      t.hp = Math.min(t.maxHp||t.hp, t.hp + healAmt);
      combatLog(`${name}: ${t.name} restored ${Math.round(t.hp-old)} HP.`, 'heal');
    });
  }
  // Mana restore
  else if (effect.includes('mana')) {
    const manaAmt = parseInt(effect.match(/\+?(\d+)/)?.[1] || '15');
    actor.mana = Math.min(actor.maxMana||99, (actor.mana||0) + manaAmt);
    combatLog(`${name}: ${actor.name} recovered ${manaAmt} mana.`, 'system');
  }
  // Stress reduction
  else if (effect.includes('stress')) {
    const stressAmt = parseInt(effect.match(/\+?(\d+)/)?.[1] || '10');
    actor.stress = Math.max(0, (actor.stress||0) - stressAmt);
    combatLog(`${name}: ${actor.name} stress reduced by ${stressAmt}.`, 'system');
  }
  // Blight/status clear
  else if (effect.includes('blight') || effect.includes('clear') || effect.includes('clears')) {
    actor.effects = (actor.effects||[]).filter(e => !['blight','poison','burn'].includes(e.type));
    combatLog(`${name}: ${actor.name} cleared of status effects.`, 'system');
  }
  // Buff — generic
  else {
    combatLog(`${name} used. ${r.effect||''}`, 'system');
  }

  renderCombat();
  persistState().catch(()=>{});
  advanceTurn();
}

function showCombatVictory({ loot, totalXp }) {
  const overlay = document.getElementById('combat-victory-overlay');
  if (!overlay) { closeCombat(); return; }

  // Build reward rows
  const rewards = [];
  if (loot && loot.length) {
    loot.forEach(l => rewards.push({ label: 'Loot', val: l }));
  }
  if (totalXp) {
    rewards.push({ label: 'Experience', val: '+' + totalXp + ' XP' });
  }
  if (!rewards.length) {
    rewards.push({ label: 'The encounter is over.', val: '' });
  }

  document.getElementById('victory-rewards').innerHTML = rewards.map(r =>
    `<div class="victory-reward-row">
      <span>${r.label}</span>
      <span class="victory-reward-val">${r.val}</span>
    </div>`
  ).join('');

  overlay.classList.add('open');
}

function showSkillCheckResult(opts) {
  return new Promise(resolve => {
    const { pass, name, roll, statVal, statLabel, total, dc, extraText, col } = opts;

    // Populate
    const verdictEl = document.getElementById('sc-verdict');
    verdictEl.textContent = pass ? 'Success' : 'Failure';
    verdictEl.style.color = col || (pass ? 'var(--viridian-bright)' : 'var(--crimson-bright)');

    document.getElementById('sc-stat-label').textContent =
      name + ' · ' + statLabel + ' Check · DC ' + dc;

    const diceEl = document.getElementById('sc-dice-val');
    diceEl.textContent = roll;
    diceEl.style.borderColor = col || (pass ? 'var(--viridian-bright)' : 'var(--crimson-bright)');
    diceEl.style.color = col || (pass ? 'var(--viridian-bright)' : 'var(--crimson-bright)');

    document.getElementById('sc-roll-detail-line').innerHTML =
      roll + ' <span style="color:var(--text-secondary)">+ ' + statVal + ' ' + statLabel + '</span>';
    document.getElementById('sc-roll-total').innerHTML =
      '= <strong>' + total + '</strong> vs DC ' + dc;
    document.getElementById('sc-roll-total').style.color =
      col || (pass ? 'var(--viridian-bright)' : 'var(--crimson-bright)');

    const extraEl = document.getElementById('sc-extra');
    if (extraText) {
      extraEl.textContent = extraText;
      extraEl.style.display = '';
    } else {
      extraEl.style.display = 'none';
    }

    // Wire continue button
    const btn = document.getElementById('sc-continue-btn');
    btn.textContent = pass ? 'Continue' : 'Accept the outcome';
    btn.style.borderColor = col || 'var(--border)';
    const handler = () => {
      btn.removeEventListener('click', handler);
      document.getElementById('skill-check-overlay').classList.remove('open');
      resolve();
    };
    btn.addEventListener('click', handler);

    document.getElementById('skill-check-overlay').classList.add('open');
  });
}

function confirmRetreat(){
  document.getElementById('combat-retreat-overlay')?.classList.add('open');
}

function closeCombatOverlay(){
  document.getElementById('combat-overlay')?.classList.remove('open');
}

function toggleCombatLog(){
  const w=document.getElementById('combat-log-wrap');
  if(w)w.classList.toggle('collapsed');
  const ch=document.getElementById('combat-log-chevron');
  if(ch)ch.textContent=w?.classList.contains('collapsed')?'▼':'▲';
}

function updateCombatContextBar() {
  const ph=(typeof getPlanetaryHour==='function'&&playerLat)?getPlanetaryHour(playerLat,playerLng):null;
  const pEl=document.getElementById('cb-planet');
  if(pEl&&ph)pEl.textContent=ph.planet+' Hour';
  const mEl=document.getElementById('cb-moon');
  if(mEl)mEl.textContent=getMoonPhaseName();
  const tEl=document.getElementById('cb-time');
  if(tEl)tEl.textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  const eEl=document.getElementById('cb-encounter');
  if(eEl&&_CS)eEl.textContent=_CS.title||'Encounter';
}

function getMoonPhaseName() {
  const lunarCycle=29.53058867;
  const known=new Date(2000,0,6,18,14);
  const phase=(((Date.now()-known)/(864e5)%lunarCycle)+lunarCycle)%lunarCycle;
  if(phase<1.85)return'New Moon';
  if(phase<5.54)return'Waxing Crescent';
  if(phase<9.22)return'First Quarter';
  if(phase<12.91)return'Waxing Gibbous';
  if(phase<16.61)return'Full Moon';
  if(phase<20.30)return'Waning Gibbous';
  if(phase<23.99)return'Last Quarter';
  return'Waning Crescent';
}
