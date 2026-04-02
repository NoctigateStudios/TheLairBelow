// ════════════════════════════════════════════════════════════
// COMPANY
// ════════════════════════════════════════════════════════════

async function renderCharacterSkills() {
  const el = document.getElementById('char-skills-list');
  const lbl = document.getElementById('char-skills-label');
  if (!el || !_characterData) return;

  // Load world skills once and cache
  if (!_cachedWorldSkills) {
    try {
      const res = await fetch(`${FB_URL}/world/skills.json?cb=` + Date.now());
      if (res.ok) { const d = await res.json(); if (d && !d.error) _cachedWorldSkills = d; }
    } catch(e) {}
  }
  if (!_cachedWorldSkills) return;

  const charLevel  = _characterData.level || 1;
  const charClass  = (_characterData.classKey || '').toLowerCase();
  const startingKeys = _characterData.startingSkills || [];

  // A skill is available if:
  // 1. It matches the character's class (or has no class requirement), AND
  // 2. Its unlockLevel <= current level, AND
  // 3. Its category is NOT 'rite' (rites go to Arcana)
  const available = Object.entries(_cachedWorldSkills).filter(([k, s]) => {
    if (!s) return false;
    const cat = s.category || s.cat || s.type || '';
    if (cat === 'rite') return false; // rites shown in Arcana, not here
    const classOk = !s.classKey || s.classKey.toLowerCase() === charClass || s.classKey === '';
    const levelOk = (s.unlockLevel || 1) <= charLevel;
    return classOk && levelOk;
  });

  if (lbl) lbl.textContent = 'Combat Skills (' + available.length + ')';

  if (!available.length) {
    el.innerHTML = '<div style="font-family:var(--ff-body);font-style:italic;font-size: 0.82rem;color:var(--text-secondary);padding:0.4rem 0;">No skills unlocked yet.</div>';
    return;
  }

  const CAT_COLOR = {attack:'var(--crimson-bright)',heal:'var(--viridian-bright)',buff:'var(--amber-bright)',debuff:'var(--mist)',revive:'var(--dm-bright)',utility:'var(--gold)'};
  el.innerHTML = available.map(([k, s]) => {
    const cat = s.category || s.cat || 'utility';
    const col = CAT_COLOR[cat] || 'var(--gold)';
    const dmg = s.damage?.type && s.damage.type !== 'none'
      ? `<span style="font-family:var(--ff-heading);font-size: 0.49rem;color:${col};">${s.damage.dice||''}${s.damage.flat?'+'+s.damage.flat:''} ${s.damage.type}</span>` : '';
    const cost = s.cost?.mana
      ? `<span style="font-family:var(--ff-heading);font-size: 0.49rem;color:var(--indigo-bright);">${s.cost.mana} mana</span>` : '';
    const target = s.targeting?.target
      ? `<span style="font-family:var(--ff-heading);font-size: 0.49rem;color:var(--ash);">→ ${s.targeting.target.replace('-',' ')}</span>` : '';
    return `<div style="border-left:2px solid ${col};padding:0.5rem 0.7rem;margin-bottom:0.45rem;background:rgba(255,255,255,0.01);">
      <div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.15rem;">
        <span style="font-family:var(--ff-heading);font-size: 0.49rem;letter-spacing:0.1em;text-transform:uppercase;color:${col};">${cat}</span>
        <span style="font-family:var(--ff-heading);font-size: 0.83rem;color:var(--bone);">${s.name||k}</span>
        <span style="font-family:var(--ff-heading);font-size: 0.41rem;color:var(--ash);margin-left:auto;">Lv.${s.unlockLevel||1}</span>
      </div>
      <div style="font-family:var(--ff-body);font-style:italic;font-size: 0.92rem;color:var(--mist);">${s.desc||''}</div>
      <div style="display:flex;gap:0.5rem;margin-top:0.25rem;flex-wrap:wrap;">${dmg}${cost}${target}</div>
    </div>`;
  }).join('');
}

function refreshCharacterBar() {
  if (!_characterData) return;
  const c = _characterData;
  const needed = xpForNextLevel(c.level || 1);
  const pct = Math.min(100, Math.round(((c.xp || 0) / needed) * 100));
  const el = document.querySelector('#panel-company .char-name');
  if (el) el.textContent = c.name || playerName || '—';
  const elCls = document.querySelector('#panel-company .char-class');
  if (elCls) elCls.textContent = (c.class || '—') + ' · Level ' + (c.level || 1);
  const xpFill = document.querySelector('#panel-company .char-xp-fill');
  if (xpFill) xpFill.style.width = pct + '%';
  const xpLbl = document.querySelector('#panel-company .char-xp-label');
  if (xpLbl) xpLbl.textContent = (c.xp || 0).toLocaleString() + ' / ' + needed.toLocaleString() + ' XP';
  // Refresh stats with new bar IDs
  if (c.stats) {
    const STATS = ['fortitude','wrath','intuition','empathy','endurance','memory','cunning','speed'];
    STATS.forEach(key => {
      const val = c.stats[key]; if (val === undefined) return;
      const vEl = document.getElementById('sv-' + key);
      const bEl = document.getElementById('sb-' + key);
      if (vEl) vEl.textContent = val;
      if (bEl) bEl.style.width = Math.min(100, Math.round((val/20)*100)) + '%';
    });
    if (c.stats.gnosis !== undefined) {
      const gEl = document.getElementById('sv-gnosis');
      if (gEl) gEl.textContent = c.stats.gnosis + ' / 30';
      const ab = document.querySelector('.aether-fill');
      if (ab) ab.style.width = Math.min(100, Math.round((c.stats.gnosis/30)*100)) + '%';
    }
    // Update derived stats
    const s = c.stats, lv = c.level || 1;
    const hp = Math.round(s.endurance*5 + s.fortitude*2 + lv*3);
    const mana = Math.round((s.gnosis||0)*5 + s.memory*2 + lv*2);
    const crit = Math.min(60, Math.max(5, Math.round(s.cunning*1.5 + s.wrath*0.5)));
    const dodge = Math.min(50, Math.max(0, Math.round(s.cunning + s.intuition*0.5)));
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('ds-hp-val', hp); set('ds-mana-val', mana);
    set('ds-crit-val', crit + '%'); set('ds-dodge-val', dodge + '%');
  }
  // Re-render skills for the new level
  renderCharacterSkills();
}

function renderAcolyteCards(acolytes) {
  const section = document.querySelector('#panel-company .section-label[data-section="acolytes"]');
  if (!section) return;
  document.querySelectorAll('.acolyte-card[data-acolyte-id]').forEach(e => e.remove());
  const recruit = document.querySelector('.acolyte-card[data-recruit]');
  const parent  = section.parentElement;
  const GLYPHS  = ['△','▽','◈','◇','○','◬'];

  acolytes.forEach((a, idx) => {
    const stressPct = Math.min(100, Math.max(0, a.stress || 0));
    const stressColor = stressPct >= 75 ? 'var(--crimson-bright)' : stressPct >= 40 ? 'var(--amber-bright)' : 'var(--viridian-bright)';
    const states    = (a.states || []);
    const id        = a.id || ('ac' + idx);
    const skills    = (a.skills || []);
    const inv       = (a.inventory || []);
    const onRoster  = (a.onRoster === true);
    const el        = document.createElement('div');
    el.className    = 'acolyte-card';
    el.dataset.acolyteId    = id;
    el.dataset.acolyteClass = (a.classKey || a.class || '').toLowerCase().replace(/\s+/g,'-');
    el.dataset.acolyteLevel = a.level || 1;
    el.dataset.acolyteStates= states.join(',');

    // Skills section — compact list with category colour
    const CAT_COL = {attack:'var(--crimson-bright)',heal:'var(--viridian-bright)',buff:'var(--amber-bright)',debuff:'var(--mist)',revive:'var(--indigo-bright)',utility:'var(--gold)',rite:'var(--indigo-bright)'};
    const skillHTML = skills.length
      ? skills.map(sk => {
          const cat = sk.category || sk.cat || 'utility';
          const col = CAT_COL[cat] || 'var(--gold)';
          return `<div style="display:flex;align-items:center;gap:0.5rem;padding:0.35rem 0.5rem;border-left:2px solid ${col};margin-bottom:0.25rem;background:rgba(255,255,255,0.01);">
            <span style="font-family:var(--ff-heading);font-size: 0.51rem;color:var(--bone);flex:1;">${sk.name||sk}</span>
            ${sk.damage?.type&&sk.damage.type!=='none'?`<span style="font-family:var(--ff-heading);font-size: 0.47rem;color:${col};">${sk.damage.dice||''}+${sk.damage.flat||0} ${sk.damage.type}</span>`:''}
          </div>`;
        }).join('')
      : `<div style="font-family:var(--ff-body);font-style:italic;font-size: 0.64rem;color:var(--text-secondary);padding:0.3rem 0;">No skills learned.</div>`;

    // Stats mini-block if acolyte has stats
    const statsBlock = a.stats ? (() => {
      const s = a.stats;
      const STAT_PAIRS = [['FOR',s.fortitude||'—'],['WRA',s.wrath||'—'],['INT',s.intuition||'—'],['EMP',s.empathy||'—'],['END',s.endurance||'—'],['MEM',s.memory||'—'],['CUN',s.cunning||'—'],['SPD',s.speed||'—']];
      return `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.25rem;margin-top:0.4rem;">
        ${STAT_PAIRS.map(([k,v])=>`<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(201,168,76,0.1);padding:0.25rem;text-align:center;"><div style="font-family:var(--ff-heading);font-size: 0.39rem;color:var(--text-secondary);letter-spacing:0.08em;">${k}</div><div style="font-family:var(--ff-heading);font-size: 0.59rem;color:var(--bone);">${v}</div></div>`).join('')}
      </div>`;
    })() : '';

    // Inventory section
    const invHTML = inv.length
      ? inv.map(it => `<div style="display:flex;align-items:center;gap:0.5rem;padding:0.35rem 0.5rem;border:1px solid rgba(201,168,76,0.15);margin-bottom:0.25rem;background:rgba(201,168,76,0.02);">
          <span style="font-family:var(--ff-heading);font-size: 0.51rem;color:var(--bone);flex:1;">${it.name||it}</span>
          ${it.desc?`<span style="font-family:var(--ff-body);font-style:italic;font-size: 0.47rem;color:var(--text-secondary);">${it.desc}</span>`:''}
          <button style="background:none;border:none;color:var(--ash);cursor:pointer;font-size: 0.55rem;padding:0;" onclick="unequipItem('${id}','${it.key||it.name||it}',event)">✕</button>
        </div>`).join('')
      : `<div style="font-family:var(--ff-body);font-style:italic;font-size: 0.64rem;color:var(--text-secondary);padding:0.3rem 0;">No equipment carried.</div>`;

    el.onclick = () => openAcolyteDetail(a);
    el.style.cursor = 'pointer';
    el.innerHTML = `
      <div class="acol-top-row">
        <div class="acolyte-avatar">${GLYPHS[idx % GLYPHS.length]}</div>
        <div class="acolyte-info">
          <div class="acolyte-name">${a.name}</div>
          <div class="acolyte-class">${a.class || '—'} · Lv.${a.level||1}</div>
          <div class="stress-bar" title="Stress ${stressPct}%">
            <div class="stress-fill" style="width:${stressPct}%;background:${stressColor};"></div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.15rem;">
            <div style="font-family:var(--ff-heading);font-size: 0.43rem;color:${stressColor};letter-spacing:0.08em;">Stress ${stressPct}%</div>
            <div style="display:flex;gap:0.25rem;">${states.map(s => `<span class="state-tag">${s}</span>`).join('')}</div>
          </div>
        </div>
        <div class="acol-roster-toggle${onRoster?' active':''}" title="Mission roster" onclick="toggleRoster('${id}',this)">
          ${onRoster ? '◆ Roster' : '◇ Roster'}
        </div>
      </div>
      <div class="acol-detail">
        ${statsBlock}
        <div class="acol-detail-section" style="margin-top:0.6rem;">
          <div class="acol-detail-label">Skills <span style="color:var(--text-secondary);font-size:0.85em;">(${skills.length})</span></div>
          ${skillHTML}
          <button class="acol-action-btn" onclick="openSkillTeach('${id}')">+ Teach Skill</button>
        </div>
        <div class="acol-detail-section">
          <div class="acol-detail-label">Equipment <span style="color:var(--text-secondary);font-size:0.85em;">(${inv.length})</span></div>
          ${invHTML}
          <button class="acol-action-btn" onclick="openInventoryEquip('${id}')">+ Equip Item</button>
        </div>
        <div class="acol-detail-section">
          <button class="acolyte-avail-toggle ${availableAcolytes[id]?'active':''}" id="avail-${id}"
            onclick="toggleAcolyteAvailable('${id}',this)">Coven Share: ${availableAcolytes[id]?'On':'Off'}</button>
        </div>
      </div>`;

    if (recruit) { parent.insertBefore(el, recruit); }
    else { parent.appendChild(el); }
  });
  renderRoster();
}

function renderRoster() {
  const empty = document.getElementById('roster-empty');
  const cards = document.getElementById('roster-cards');
  if (!cards) return;

  const members = [];
  if (_characterData?.onRoster) {
    members.push({
      type:'player', id:'__player',
      name: _characterData.name || playerName || 'Seeker',
      level: _characterData.level || 1,
      cls: _characterData.class || '—',
      glyph: '✦',
      stress: 0,
    });
  }
  const GLYPHS = ['△','▽','◈','◇','○','◬'];
  (_acolytesData||[]).filter(a => a.onRoster).forEach((a, i) => {
    members.push({
      type:'acolyte', id: a.id,
      name: a.name, level: a.level || 1,
      cls: a.class || '—',
      glyph: GLYPHS[(_acolytesData||[]).indexOf(a) % GLYPHS.length],
      stress: a.stress || 0,
    });
  });

  if (!members.length) {
    if (empty) empty.style.display = '';
    // Remove any existing chips
    cards.querySelectorAll('.roster-chip').forEach(c => c.remove());
    return;
  }
  if (empty) empty.style.display = 'none';
  cards.querySelectorAll('.roster-chip').forEach(c => c.remove());

  members.forEach(m => {
    const chip = document.createElement('div');
    chip.className = 'roster-chip';
    chip.dataset.rosterId = m.id;
    const stressCol = m.stress >= 75 ? 'var(--crimson-bright)' : m.stress >= 40 ? 'var(--amber-bright)' : 'var(--viridian-bright)';
    chip.innerHTML =
      '<span style="color:' + (m.type==='player'?'var(--text-accent)':'var(--gold)') + ';margin-right:0.2rem;">' + m.glyph + '</span>' +
      '<span>' + m.name.split(' ')[0] + ' <span style="color:var(--text-secondary);font-size:0.85em;">Lv.' + m.level + '</span></span>' +
      (m.stress > 0 ? '<span style="margin-left:0.4rem;color:' + stressCol + ';font-size:0.85em;">' + m.stress + '%</span>' : '') +
      '<span class="chip-remove">  ✕</span>';
    chip.querySelector('.chip-remove').onclick = (function(id){ return function(e){ e.stopPropagation(); removeFromRoster(id,e); }; })(m.id);
    cards.appendChild(chip);
  });
}

function toggleRoster(acolyteId, btn) {
  if (!_acolytesData) return;
  const a = _acolytesData.find(x => x.id === acolyteId);
  if (!a) return;
  a.onRoster = !a.onRoster;
  btn.textContent  = a.onRoster ? '◆ Roster' : '◇ Roster';
  btn.classList.toggle('active', a.onRoster);
  renderRoster();
  persistState();
}

function togglePlayerRoster(btn) {
  if (!_characterData) return;
  _characterData.onRoster = !_characterData.onRoster;
  btn.textContent = _characterData.onRoster ? '◆ Roster' : '◇ Roster';
  btn.classList.toggle('active', _characterData.onRoster);
  renderRoster();
  persistState();
}

function removeFromRoster(id, e) {
  e.stopPropagation();
  if (id === '__player') {
    if (_characterData) _characterData.onRoster = false;
    const btn = document.getElementById('player-roster-toggle');
    if (btn) { btn.textContent = '◇ Roster'; btn.classList.remove('active'); }
  } else {
    const a = (_acolytesData||[]).find(x => x.id === id);
    if (a) {
      a.onRoster = false;
      // Update the acolyte card button
      const btn = document.querySelector('.acolyte-card[data-acolyte-id="' + id + '"] .acol-roster-toggle');
      if (btn) { btn.textContent = '◇ Roster'; btn.classList.remove('active'); }
    }
  }
  renderRoster();
  persistState();
}

function openInventoryEquip(acolyteId) {
  _equippingAcolyteId = acolyteId;
  const a = (_acolytesData || []).find(x => x.id === acolyteId);
  if (!a) return;

  const playerItems = Object.entries(inventory || {}).filter(([k, v]) => v > 0).map(([k]) => k);

  if (!playerItems.length) {
    toast(`${a.name} has nothing to equip — craft items at the Forge first.`);
    return;
  }

  const equipped = (a.inventory || []).map(i => i.key || i.name || i);
  const modal = document.getElementById('acol-equip-modal');
  if (!modal) { buildEquipModal(); }

  document.getElementById('acol-equip-title').textContent = `Equipment — ${a.name}`;
  document.getElementById('acol-equip-list').innerHTML = playerItems.map(key => {
    const recipe = RECIPES.find(r => r.key === key);
    const isEquipped = equipped.includes(key);
    const qty = inventory[key] || 0;
    const equippedTo = getItemEquippedTo(key);
    const lockedToOther = equippedTo && equippedTo !== acolyteId && qty === 1;
    const otherName = lockedToOther ? ((_acolytesData||[]).find(x=>x.id===equippedTo)?.name||'another') : null;
    return `<div class="equip-item-row ${lockedToOther?'locked':''}" onclick="${lockedToOther?'':''}" ${lockedToOther?'':''}>
      <div style="display:flex;align-items:center;gap:0.6rem;width:100%;" onclick="${lockedToOther?`toast('Equipped to ${otherName} — only 1 copy exists.')`:''};${lockedToOther?'':'toggleEquip(\''+acolyteId+'\',\''+key+'\',this.closest(\'.equip-item-row\'))'}">
        <span class="equip-item-check" style="color:${lockedToOther?'var(--ash)':isEquipped?'var(--gold)':'var(--text-secondary)'};">${isEquipped?'◆':'◇'}</span>
        <div style="flex:1;">
          <div class="equip-item-name" style="color:${lockedToOther?'var(--text-secondary)':'var(--bone)'};">${recipe?.name||key} ${qty>1?'<span style="color:var(--amber-bright);font-size:0.85em;">×'+qty+'</span>':''}</div>
          <div style="font-family:var(--ff-body);font-style:italic;font-size: 0.66rem;color:var(--text-secondary);">${recipe?.effect||''}</div>
          ${lockedToOther?`<div style="font-family:var(--ff-heading);font-size: 0.51rem;color:var(--ash);letter-spacing:0.08em;text-transform:uppercase;">Equipped: ${otherName}</div>`:''}
        </div>
      </div>
    </div>`;
  }).join('');

  document.getElementById('acol-equip-modal').classList.add('open');
}

function buildEquipModal() {
  const div = document.createElement('div');
  div.id = 'acol-equip-modal';
  div.className = 'acol-modal';
  div.innerHTML = `
    <div class="acol-modal-inner">
      <div class="acol-modal-title" id="acol-equip-title">Equip</div>
      <div id="acol-equip-list" class="acol-modal-list"></div>
      <button class="acol-modal-close" onclick="document.getElementById('acol-equip-modal').classList.remove('open')">
        Done
      </button>
    </div>`;
  document.body.appendChild(div);
}

function toggleEquip(acolyteId, itemKey, row) {
  const a = (_acolytesData || []).find(x => x.id === acolyteId);
  if (!a) return;
  if (!a.inventory) a.inventory = [];
  const idx = a.inventory.findIndex(i => (i.key||i.name||i) === itemKey);
  const check = row.querySelector('.equip-item-check');
  if (idx >= 0) {
    // Un-equip
    a.inventory.splice(idx, 1);
    if (check) check.textContent = '◇';
  } else {
    // Check if already equipped to another character
    const equippedTo = getItemEquippedTo(itemKey);
    if (equippedTo && equippedTo !== acolyteId) {
      const other = (_acolytesData || []).find(x => x.id === equippedTo);
      toast(`Only one copy exists. Unequip from ${other?.name || 'another acolyte'} first.`);
      return;
    }
    const recipe = RECIPES.find(r => r.key === itemKey);
    a.inventory.push({ key: itemKey, name: recipe?.name || itemKey, desc: recipe?.effect || '', icon: recipe?.icon || '' });
    if (check) check.textContent = '◆';
  }
  renderAcolyteCards(_acolytesData);
  persistState();
}

function unequipItem(acolyteId, itemKey, e) {
  e.stopPropagation();
  const a = (_acolytesData||[]).find(x => x.id === acolyteId);
  if (!a) return;
  const idx = (a.inventory||[]).findIndex(i => (i.key||i.name||i) === itemKey);
  if (idx >= 0) { a.inventory.splice(idx,1); }
  renderAcolyteCards(_acolytesData);
  persistState();
  toast('Item unequipped.');
}

function getItemEquippedTo(itemKey) {
  // Returns acolyte id that has this item equipped, or null
  // If crafted in multiple copies (qty > 1), can be equipped by multiple
  const recipe = RECIPES.find(r => r.key === itemKey);
  const qty = inventory[itemKey] || 0;
  if (qty > 1) return null; // multiple copies — no restriction
  if (!_acolytesData) return null;
  for (const a of _acolytesData) {
    if ((a.inventory || []).some(i => (i.key||i.name||i) === itemKey)) return a.id;
  }
  return null;
}

function openSkillTeach(acolyteId) {
  _teachingAcolyteId = acolyteId;
  const a = (_acolytesData || []).find(x => x.id === acolyteId);
  if (!a) return;

  // Get mastered skills from research
  const mastered = getMasteredSkills();
  if (!mastered.length) {
    toast('No skills mastered yet — research skills in the Arcana panel first.');
    return;
  }

  const alreadyKnown = (a.skills || []).map(s => s.key || s.name || s);
  const teachable = mastered.filter(sk => {
    const classOk = !sk.classKey || sk.classKey.toLowerCase() === (a.classKey||a.class||'').toLowerCase().replace(/\s+/g,'-');
    const notKnown = !alreadyKnown.includes(sk.key);
    return classOk && notKnown;
  });

  if (!teachable.length) {
    toast(`${a.name} already knows all mastered skills for their class.`);
    return;
  }

  let modal = document.getElementById('acol-teach-modal');
  if (!modal) { buildTeachModal(); modal = document.getElementById('acol-teach-modal'); }

  document.getElementById('acol-teach-title').textContent = `Teach — ${a.name}`;
  document.getElementById('acol-teach-list').innerHTML = teachable.map(sk => `
    <div class="equip-item-row" onclick="confirmTeachSkill('${acolyteId}','${sk.key}','${sk.name}',this)">
      <span class="equip-item-check">◇</span>
      <div>
        <div class="equip-item-name">${sk.name}</div>
        <div style="font-family:var(--ff-body);font-style:italic;font-size: 0.9rem;color:var(--text-secondary);margin-top:0.1rem;">${sk.desc||''}</div>
      </div>
    </div>`).join('');

  document.getElementById('acol-teach-modal').classList.add('open');
}

function buildTeachModal() {
  const div = document.createElement('div');
  div.id = 'acol-teach-modal';
  div.className = 'acol-modal';
  div.innerHTML = `
    <div class="acol-modal-inner">
      <div class="acol-modal-title" id="acol-teach-title">Teach Skill</div>
      <div id="acol-teach-list" class="acol-modal-list"></div>
      <button class="acol-modal-close" onclick="document.getElementById('acol-teach-modal').classList.remove('open')">
        Cancel
      </button>
    </div>`;
  document.body.appendChild(div);
}

function confirmTeachSkill(acolyteId, skillKey, skillName, row) {
  const a = (_acolytesData || []).find(x => x.id === acolyteId);
  if (!a) return;
  if (!a.skills) a.skills = [];

  // Load full skill data
  const sk = _cachedWorldSkills?.[skillKey] || { key: skillKey, name: skillName };
  a.skills.push({ key: skillKey, name: skillName, desc: sk.desc||'' });

  const check = row.querySelector('.equip-item-check');
  if (check) check.textContent = '◆';
  row.style.opacity = '0.5';
  row.style.pointerEvents = 'none';

  renderAcolyteCards(_acolytesData);
  persistState();
  toast(`${a.name} has learned ${skillName}.`);

  setTimeout(() => {
    document.getElementById('acol-teach-modal')?.classList.remove('open');
  }, 800);
}

function openAcolyteDetail(a) {
  const GLYPHS = ['△','▽','◈','◇','○','◬'];
  const idx = (_acolytesData||[]).indexOf(a);
  const glyph = GLYPHS[idx % GLYPHS.length];
  const derived = derivedStats(a.stats||{}, a.level||1);
  const onRoster = a.onRoster === true;

  document.getElementById('ad-glyph').textContent = glyph;
  document.getElementById('ad-name').textContent = a.name;
  document.getElementById('ad-class').textContent = (a.class||'—') + ' · Lv.' + (a.level||1)
    + (a.stress >= 75 ? ' · ⚠ High Stress' : '');
  document.getElementById('ad-hp').textContent   = Math.round(derived.hp);
  document.getElementById('ad-mana').textContent = Math.round(derived.mana);
  document.getElementById('ad-crit').textContent = Math.round(derived.crit) + '%';
  document.getElementById('ad-dodge').textContent= Math.round(derived.dodge) + '%';
  const badge = document.getElementById('ad-roster-badge');
  badge.textContent = onRoster ? '◆ Roster' : '◇ Off Roster';
  badge.style.color = onRoster ? 'var(--amber-bright)' : 'var(--text-secondary)';
  badge.style.borderColor = onRoster ? 'rgba(212,137,10,0.4)' : 'var(--border)';

  // Stats tab
  const ELEM = [
    { name:'Fire',  color:'#c43030', stats:['fortitude','wrath'] },
    { name:'Water', color:'#4a7a8b', stats:['intuition','empathy'] },
    { name:'Earth', color:'#8b7355', stats:['endurance','memory'] },
    { name:'Air',   color:'#6b9ac4', stats:['cunning','speed'] },
    { name:'Aether',color:'#3d3daa', stats:['gnosis'] },
  ];
  const stats = a.stats||{};
  document.getElementById('ad-stats').innerHTML = ELEM.map(el =>
    `<div style="border-top:1px solid var(--border);padding:0.5rem 0;">
      <div style="font-family:var(--ff-heading);font-size:0.5rem;letter-spacing:0.2em;text-transform:uppercase;color:${el.color};margin-bottom:0.3rem;">${el.name}</div>
      ${el.stats.map(s => {
        const v = stats[s]||0; const pct = Math.round((v/20)*100);
        return `<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.25rem;">
          <span style="font-family:var(--ff-heading);font-size:0.6rem;letter-spacing:0.05em;color:var(--text-secondary);width:72px;">${s.charAt(0).toUpperCase()+s.slice(1)}</span>
          <div style="flex:1;height:3px;background:var(--stone);"><div style="height:100%;background:${el.color};width:${pct}%;transition:width 0.3s;"></div></div>
          <span style="font-family:var(--ff-heading);font-size:0.7rem;color:var(--text-primary);width:20px;text-align:right;">${v}</span>
        </div>`;
      }).join('')}
    </div>`
  ).join('');

  // Skills tab
  const skills = a.skills||[];
  document.getElementById('ad-skills').innerHTML = skills.length
    ? skills.map(sk => `<div style="border-top:1px solid var(--border);padding:0.6rem 0;">
        <div style="font-family:var(--ff-heading);font-size:0.65rem;letter-spacing:0.04em;color:var(--text-primary);">${sk.name||sk.key||sk}</div>
        <div style="font-family:var(--ff-body);font-style:italic;font-size:0.82rem;color:var(--text-secondary);line-height:1.5;">${sk.desc||''}</div>
      </div>`).join('')
    : '<div style="font-family:var(--ff-body);font-style:italic;font-size:0.88rem;color:var(--text-secondary);padding:0.5rem 0;">No skills learned. Use + Teach Skill from Company panel.</div>';

  // Inventory tab
  const inv = a.inventory||[];
  document.getElementById('ad-inventory').innerHTML = inv.length
    ? inv.map(it => `<div style="border-top:1px solid var(--border);padding:0.5rem 0;font-family:var(--ff-heading);font-size:0.7rem;letter-spacing:0.04em;color:var(--amber-bright);">${it.name||it}</div>`).join('')
    : '<div style="font-family:var(--ff-body);font-style:italic;font-size:0.88rem;color:var(--text-secondary);padding:0.5rem 0;">No equipment.</div>';

  // Traits tab
  const traits = a.states||a.traits||[];
  const worldTraits = _worldTraits || {};
  document.getElementById('ad-traits').innerHTML = traits.length
    ? traits.map(t => {
        const td = worldTraits[t.toLowerCase?.()];
        return `<div style="border-top:1px solid var(--border);padding:0.6rem 0;">
          <div style="font-family:var(--ff-heading);font-size:0.65rem;letter-spacing:0.04em;color:var(--text-primary);">${td?.name||t}</div>
          <div style="font-family:var(--ff-body);font-style:italic;font-size:0.82rem;color:var(--text-secondary);line-height:1.5;">${td?.desc||'No description available.'}</div>
        </div>`;
      }).join('')
    : '<div style="font-family:var(--ff-body);font-style:italic;font-size:0.88rem;color:var(--text-secondary);padding:0.5rem 0;">No traits.</div>';

  // Reset to stats tab
  document.querySelectorAll('.ad-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.ad-tab')?.classList.add('active');
  document.querySelectorAll('.ad-section').forEach(s => s.style.display = 'none');
  document.getElementById('ad-stats').style.display = '';

  document.getElementById('acolyte-detail-modal').classList.add('open');
}

function switchAdTab(tab, btn) {
  document.querySelectorAll('.ad-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.ad-section').forEach(s => s.style.display = 'none');
  if (btn) btn.classList.add('active');
  const el = document.getElementById('ad-'+tab);
  if (el) el.style.display = '';
}

function borrowAcolyte(ownerId, acolyteId, acolyteName) {
  const bkey = 'borrow_' + ownerId + '_' + acolyteId;
  const existing = parseInt(localStorage.getItem(bkey)||'0');
  if (existing > Date.now()) {
    toast(acolyteName + ' already in your roster — ' + Math.round((existing-Date.now())/60000) + 'm left.');
    return;
  }
  const expiry = Date.now() + 60 * 60 * 1000;
  // Store full borrow info for restore on reload
  localStorage.setItem(bkey, expiry.toString());
  localStorage.setItem(bkey + '_name', acolyteName);
  localStorage.setItem(bkey + '_owner', nearbyPlayers[ownerId]?.name || 'Nearby Seeker');
  const owner = nearbyPlayers[ownerId];
  const existCard = document.getElementById('borrowed-'+ownerId+'-'+acolyteId);
  if (existCard) existCard.remove();
  const card = document.createElement('div');
  card.className = 'acolyte-card';
  card.id = 'borrowed-' + ownerId + '-' + acolyteId;
  card.style.cssText = 'border-color:rgba(123,79,207,0.5);background:rgba(123,79,207,0.04);';
  card.innerHTML = `<div class="acolyte-avatar" style="border-color:rgba(123,79,207,0.4);">🜁</div>
    <div class="acolyte-info">
      <div class="acolyte-name">${acolyteName}</div>
      <div class="acolyte-class" style="color:#9b6fd4;">Borrowed · ${owner?.name||'Nearby Seeker'} · 60m</div>
      <div class="stress-bar"><div class="stress-fill" style="width:30%;"></div></div>
      <div class="acolyte-states"><span class="state-tag" style="border-color:rgba(123,79,207,0.5);color:#9b6fd4;">Borrowed</span></div>
    </div>`;
  const recruit = document.querySelector('#panel-company .acolyte-card[style*="dashed"]');
  if (recruit) recruit.parentNode.insertBefore(card, recruit);
  setTimeout(() => { card.remove(); toast(acolyteName + ' returns to their coven.'); }, expiry - Date.now());
  toast('✦ ' + acolyteName + ' joins your company for 1 hour.');
  closePlayerModal();
}

function restoreBorrowedAcolytes() {
  const now = Date.now();
  Object.keys(localStorage).filter(k => k.startsWith('borrow_') && !k.endsWith('_name') && !k.endsWith('_owner')).forEach(bkey => {
    const expiry = parseInt(localStorage.getItem(bkey));
    if (expiry <= now) {
      localStorage.removeItem(bkey);
      localStorage.removeItem(bkey + '_name');
      localStorage.removeItem(bkey + '_owner');
      return;
    }
    // Parse: borrow_{ownerId}_{acolyteId}
    const withoutPrefix = bkey.slice(7); // remove 'borrow_'
    // ownerId is a UUID (5 parts with -), acolyteId is the last segment
    const parts = withoutPrefix.split('_');
    const acolyteId = parts[parts.length - 1];
    const ownerId = parts.slice(0, -1).join('_');
    const acolyteName = localStorage.getItem(bkey + '_name') || 'Unknown Acolyte';
    const ownerName = localStorage.getItem(bkey + '_owner') || 'Nearby Seeker';
    const minsLeft = Math.round((expiry - now) / 60000);

    const existCard = document.getElementById('borrowed-' + ownerId + '-' + acolyteId);
    if (existCard) return;
    const card = document.createElement('div');
    card.className = 'acolyte-card';
    card.id = 'borrowed-' + ownerId + '-' + acolyteId;
    card.style.cssText = 'border-color:rgba(123,79,207,0.5);background:rgba(123,79,207,0.04);';
    card.innerHTML = `<div class="acolyte-avatar" style="border-color:rgba(123,79,207,0.4);">🜁</div>
      <div class="acolyte-info">
        <div class="acolyte-name">${acolyteName}</div>
        <div class="acolyte-class" style="color:#9b6fd4;">Borrowed · ${ownerName} · ${minsLeft}m remaining</div>
        <div class="stress-bar"><div class="stress-fill" style="width:30%;"></div></div>
        <div class="acolyte-states"><span class="state-tag" style="border-color:rgba(123,79,207,0.5);color:#9b6fd4;">Borrowed</span></div>
      </div>`;
    const recruit = document.querySelector('#panel-company .acolyte-card[style*="dashed"]');
    if (recruit) recruit.parentNode.insertBefore(card, recruit);
    setTimeout(() => {
      card.remove();
      localStorage.removeItem(bkey);
      localStorage.removeItem(bkey + '_name');
      localStorage.removeItem(bkey + '_owner');
      toast(acolyteName + ' returns to their coven.');
    }, expiry - now);
  });
}

function toggleAcolyteAvailable(id, btn) {
  availableAcolytes[id] = !availableAcolytes[id];
  const on = availableAcolytes[id];
  btn.textContent = 'Share with Coven: ' + (on ? 'On' : 'Off');
  btn.classList.toggle('active', on);
  publishProfile();
  toast(on ? '✦ Acolyte available to nearby coven members for 1 hour.' : 'Acolyte sharing disabled.');
}

function openPlayerModal(id) {
  const p = nearbyPlayers[id];
  if (!p) return;
  document.getElementById('pm-name').textContent = p.name;
  document.getElementById('pm-coven').textContent = 'Coven of ' + p.coven;
  const profile = p.profile;
  let html = '';

  // Resources
  if (profile?.resources) {
    html += '<div class="pm-section"><div class="pm-section-title">Essence Reserves</div><div class="pm-res-row">';
    profile.resources.forEach(r => {
      html += `<span class="pm-res-pill">${r.symbol} ${r.value} ${r.name}</span>`;
    });
    html += '</div></div>';
  }

  // Acolytes
  if (profile?.acolytes) {
    html += '<div class="pm-section"><div class="pm-section-title">Acolytes</div>';
    profile.acolytes.forEach(a => {
      const avail = a.available;
      const bkey = 'borrow_' + id + '_' + a.id;
      const bexp = parseInt(localStorage.getItem(bkey)||'0');
      const borrowed = bexp > Date.now();
      const minsLeft = borrowed ? Math.round((bexp - Date.now())/60000) : 0;
      const badge = borrowed
        ? `<span class="pm-acolyte-badge" style="border-color:var(--gold);color:var(--gold);">In Roster · ${minsLeft}m</span>`
        : avail ? `<span class="pm-acolyte-badge" style="border-color:var(--viridian-bright);color:var(--viridian-bright);">⊕ Borrow 1h</span>` : '';
      html += `<div class="pm-acolyte ${avail&&!borrowed?'pm-acolyte-available':''}"
        ${avail&&!borrowed?`onclick="borrowAcolyte('${id}','${a.id}','${a.name}')"`:''} 
        style="${avail&&!borrowed?'cursor:pointer':''}">
        <div class="pm-acolyte-avatar">🜃</div>
        <div class="pm-acolyte-info">
          <div class="pm-acolyte-name">${a.name}</div>
          <div class="pm-acolyte-class">${a.cls} · Stress ${a.stress}%</div>
        </div>
        ${badge}
      </div>`;
    });
    html += '</div>';
  }

  // Inventory
  if (profile?.inventory?.length) {
    html += '<div class="pm-section"><div class="pm-section-title">Forge Inventory</div><div class="pm-res-row">';
    profile.inventory.forEach(it => {
      html += `<span class="pm-res-pill">${it.icon} ${it.name} ×${it.qty}</span>`;
    });
    html += '</div></div>';
  }

  // Lair
  if (profile?.lair) {
    html += `<div class="pm-section"><div class="pm-section-title">Lair Status</div><div class="pm-res-row">
      <span class="pm-res-pill">† Scriptorium Lv.${profile.lair.scriptorium}</span>
      <span class="pm-res-pill">⚗ Forge Lv.${profile.lair.forge}</span>
      <span class="pm-res-pill">◻ Dormitorium Lv.${profile.lair.dormitorium}</span>
      <span class="pm-res-pill">◈ Altar Lv.${profile.lair.altar}</span>
    </div></div>`;
  }

  // Actions
  html += `<div class="pm-action-row">
    <button class="pm-btn primary" onclick="openExchangeModal('${id}')">⟺ Propose Exchange</button>
  </div>`;

  document.getElementById('pm-body').innerHTML = html;
  document.getElementById('player-modal').classList.add('open');
}

function closePlayerModal() { document.getElementById('player-modal').classList.remove('open'); }

function renderInventory(el) {
  const items = Object.entries(inventory).filter(([,qty]) => qty > 0);
  if (!items.length) {
    el.innerHTML = '<div class="inventory-grid"><div class="inv-empty">The forge has produced nothing yet.</div></div>'; return;
  }
  el.innerHTML = '<div class="inventory-grid">' + items.map(([key,qty]) => {
    const r = RECIPES.find(x => x.key === key);
    if (!r) return '';
    return `<div class="inv-item"><span class="inv-item-qty">×${qty}</span><div class="inv-item-name">${r.name}</div><div class="inv-item-type">${r.type}</div><div class="inv-item-effect">${r.effect}</div></div>`;
  }).join('') + '</div>';
}
