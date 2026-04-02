// ════════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════════

function getOrCreatePlayerId() {
  let id = localStorage.getItem('llair_player_id');
  if (!id) {
    id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    localStorage.setItem('llair_player_id', id);
  }
  return id.toLowerCase();
}

function collectGameState() {
  // Collect character from live DOM (set by applyGameState or identity setup)
  const charName  = document.querySelector('.char-name')?.textContent  || playerName || 'Unknown';
  const charClass = document.querySelector('.char-class')?.textContent || 'Unknown';
  // Collect acolyte stress from live DOM
  // Preserve full acolyte data (skills, inventory) — only update live DOM values
  const acolyteEls = document.querySelectorAll('.acolyte-card[data-acolyte-id]');
  const domStress = {};
  acolyteEls.forEach(el => {
    domStress[el.dataset.acolyteId] = parseInt(el.querySelector('.stress-fill')?.style.width)||0;
  });
  const acolytesLive = (_acolytesData || []).map(a => ({
    ...a,
    stress: domStress[a.id] !== undefined ? domStress[a.id] : (a.stress || 0),
    available: !!availableAcolytes[a.id],
  }));
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    playerId: getOrCreatePlayerId(),
    resources: { values: [...values] },
    character: _characterData || {
      name: charName, class: charClass, level: 1, xp: 0,
      stats: { fortitude:10, wrath:8, intuition:12, empathy:10, endurance:10, memory:8, cunning:12, speed:10, gnosis:0 }
    },
    acolytes: acolytesLive.length ? acolytesLive : (_acolytesData || []),
    lair: _lairData || { buildings: {} },
    research: _researchData || { active: null, progress: 0, queue: [] },
    inventory: { ...inventory },
    availableAcolytes: { ...availableAcolytes },
    // Persist combat state so player returns to same combat on reload
    combatState: _CS ? {
      title: _CS.title,
      round: _CS.round,
      turnIdx: _CS.turnIdx,
      combatants: _CS.combatants.map(cb => ({
        id: cb.id, name: cb.name, side: cb.side, icon: cb.icon,
        hp: cb.hp, maxHp: cb.maxHp, mana: cb.mana, maxMana: cb.maxMana,
        stress: cb.stress, dead: cb.dead, armour: cb.armour||0,
        dodge: cb.dodge||0, initiative: cb.initiative||0,
        isPlayer: cb.isPlayer||false, rank: cb.rank||0,
        skills: cb.skills||[], effects: cb.effects||[],
        derived: cb.derived||{}, xpReward: cb.xpReward||0,
        loot: cb.loot||[], traits: cb.traits||[],
      })),
    } : null,
  };
}

function applyGameState(state) {
  if (!state || state.version !== 1) return false;

  // Resources — restore then apply offline gain
  if (state.resources?.values) {
    state.resources.values.forEach((v, i) => { values[i] = v; });
    document.querySelectorAll('.resource-pill .res-value').forEach((el, i) => {
      el.textContent = Math.floor(values[i]);
    });
    // Compute offline income since last save
    if (state.savedAt) computeOfflineGain(state.savedAt);
  }

  // Inventory
  if (state.inventory) inventory = { ...state.inventory };

  // Character
  if (state.character) {
    _characterData = state.character;
    // Restore player roster toggle
    const rToggle = document.getElementById('player-roster-toggle');
    if (rToggle) {
      rToggle.textContent = _characterData.onRoster ? '◆ Roster' : '◇ Roster';
      rToggle.classList.toggle('active', !!_characterData.onRoster);
    }
    const c = state.character;
    const xpForLevel = n => n * 1000;
    const xpNext = xpForLevel((c.level||1) + 1);
    const xpPct  = Math.min(100, Math.round(((c.xp||0) / xpNext) * 100));
    const el = document.querySelector('#panel-company .char-name');
    if (el) el.textContent = c.name || playerName || 'Unknown';
    // company-section-label is now the char-name — already set above
    const elCls = document.querySelector('#panel-company .char-class');
    if (elCls) elCls.textContent = (c.class||'—') + ' · Level ' + (c.level||1);
    const xpFill = document.querySelector('#panel-company .char-xp-fill');
    if (xpFill) xpFill.style.width = xpPct + '%';
    const xpLbl = document.querySelector('#panel-company .char-xp-label');
    if (xpLbl) xpLbl.textContent = (c.xp||0).toLocaleString() + ' / ' + xpNext.toLocaleString() + ' XP';
    // Stats — new IDs with progress bars
    if (c.stats) {
      const STATS = ['fortitude','wrath','intuition','empathy','endurance','memory','cunning','speed'];
      const MAX_STAT = 20;
      STATS.forEach(key => {
        const val = c.stats[key];
        if (val === undefined) return;
        const valEl = document.getElementById('sv-' + key);
        const barEl = document.getElementById('sb-' + key);
        if (valEl) valEl.textContent = val;
        if (barEl) barEl.style.width = Math.min(100, Math.round((val / MAX_STAT) * 100)) + '%';
      });
      // Gnosis separately
      if (c.stats.gnosis !== undefined) {
        const gEl = document.getElementById('sv-gnosis');
        if (gEl) gEl.textContent = c.stats.gnosis + ' / 30';
        const aBar = document.querySelector('.aether-fill');
        if (aBar) aBar.style.width = Math.min(100, Math.round((c.stats.gnosis/30)*100)) + '%';
      }
      // Derived combat stats (using default formulae)
      const s = c.stats, lv = c.level || 1;
      const hp   = Math.round(s.endurance*5 + s.fortitude*2 + lv*3);
      const mana = Math.round((s.gnosis||0)*5 + s.memory*2 + lv*2);
      const crit = Math.min(60, Math.max(5, Math.round(s.cunning*1.5 + s.wrath*0.5)));
      const dodge= Math.min(50, Math.max(0, Math.round(s.cunning + s.intuition*0.5)));
      const hpEl = document.getElementById('ds-hp-val');
      const mEl  = document.getElementById('ds-mana-val');
      const cEl  = document.getElementById('ds-crit-val');
      const dEl  = document.getElementById('ds-dodge-val');
      if (hpEl) hpEl.textContent = hp;
      if (mEl)  mEl.textContent  = mana;
      if (cEl)  cEl.textContent  = crit + '%';
      if (dEl)  dEl.textContent  = dodge + '%';
    }
  }

  // Acolytes
  if (state.acolytes && state.acolytes.length) {
    // Ensure each acolyte has skills and inventory arrays
    _acolytesData = state.acolytes.map(a => ({
      skills: [], inventory: [], ...a
    }));
    renderAcolyteCards(_acolytesData);
  }
  renderCharacterSkills();

  // Available acolytes
  if (state.availableAcolytes) {
    availableAcolytes = { ...state.availableAcolytes };
    Object.entries(availableAcolytes).forEach(([id, on]) => {
      const btn = document.getElementById('avail-' + id);
      if (btn) { btn.textContent = 'Share with Coven: ' + (on ? 'On' : 'Off'); btn.classList.toggle('active', on); }
    });
  }

  // Lair
  if (state.lair && Object.keys(state.lair.buildings || {}).length > 0) {
    _lairData = state.lair;
    renderLairBuildings(state.lair.buildings);
  } else {
    // Save exists but has no buildings — give starting defaults
    _lairData = { buildings: { 'alchemical-forge':1, 'altar':1, 'dormitorium':1, 'scriptorium':1 } };
    renderLairBuildings(_lairData.buildings);
  }

  // Research — restore full structure including skillResearch + tarot effects
  if (state.research) {
    _researchData = state.research;
    if (!_researchData.skillResearch) {
      _researchData.skillResearch = { active: null, mastered: [], queue: [] };
    }
    renderResearchQueue(state.research);
    renderSkillResearch();
    restoreTarotEffects();
  }

  return true;
}

async function persistState() {
  try {
    const state = collectGameState();
    await fbWrite(getOrCreatePlayerId(), state);
  } catch(e) {
    console.error('Persist failed:', e);
    toast('Save failed — check connection.');
  }
}

async function fbRead(playerId) {
  const res = await fetch(`${FB_URL}/saves/${playerId}.json`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firebase error ${res.status}`);
  const data = await res.json();
  return data; // null if not found
}

async function fbWrite(playerId, data) {
  const res = await fetch(`${FB_URL}/saves/${playerId}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Firebase error ${res.status}`);
  return res.json();
}

function startAutoSave() {
  setInterval(() => {
    const tb = document.getElementById('topbar-save-btn');
    tb.classList.add('saving');
    saveGame().finally(() => setTimeout(() => tb.classList.remove('saving'), 1500));
  }, 5 * 60 * 1000);
}

function openSaveModal() {
  document.getElementById('save-id-display').textContent = getOrCreatePlayerId();
  document.getElementById('save-status').textContent = '';
  document.getElementById('save-status').className = 'save-status';
  document.getElementById('restore-status').textContent = '';
  document.getElementById('restore-input').value = '';
  document.getElementById('save-modal').classList.add('open');
}

function closeSaveModal() {
  document.getElementById('save-modal').classList.remove('open');
}

function copySaveId() {
  const id = getOrCreatePlayerId();
  navigator.clipboard?.writeText(id)
    .then(() => toast('Your Seal has been copied to the clipboard.'))
    .catch(() => toast('Long-press your Seal to copy it manually.'));
}

async function saveGame() {
  setSaveStatus('save-status', '', 'Inscribing your chronicle into the ether…');
  const id = getOrCreatePlayerId();
  try {
    await fbWrite(id, collectGameState());
    setSaveStatus('save-status', 'ok', '✓ Chronicle saved. The stars bear witness.');
    const tb = document.getElementById('topbar-save-btn');
    tb.classList.add('saved');
    setTimeout(() => tb.classList.remove('saved'), 2500);
    localStorage.setItem('llair_last_save', new Date().toISOString());
  } catch(e) {
    setSaveStatus('save-status', 'err', '✗ ' + e.message);
  }
}

async function loadGame() {
  setSaveStatus('save-status', '', 'Reaching into the ether…');
  const id = getOrCreatePlayerId();
  try {
    const json = await fbRead(id);
    if (!json) { setSaveStatus('save-status', 'err', '✗ No chronicle found for your Seal.'); return; }
    if (applyGameState(json)) {
      setSaveStatus('save-status', 'ok', `✓ Restored. Last saved: ${new Date(json.savedAt).toLocaleString()}`);
      toast('Your chronicle has been restored from the ether.');
    } else {
      setSaveStatus('save-status', 'err', '✗ Chronicle format unrecognised.');
    }
  } catch(e) {
    setSaveStatus('save-status', 'err', '✗ ' + e.message);
  }
}

async function restoreFromId() {
  const input = document.getElementById('restore-input').value.trim();
  if (!input || input.length < 10) {
    setSaveStatus('restore-status', 'err', '✗ Paste a valid Save ID.'); return;
  }
  setSaveStatus('restore-status', '', 'Searching the archive…');
  try {
    const json = await fbRead(input);
    if (!json) { setSaveStatus('restore-status', 'err', '✗ No chronicle found for this Seal.'); return; }
    if (applyGameState(json)) {
      localStorage.setItem('llair_player_id', input);
      document.getElementById('save-id-display').textContent = input;
      setSaveStatus('restore-status', 'ok', `✓ Chronicle restored. Seal adopted.`);
      toast('A foreign chronicle has been made yours. The lair remembers.');
    } else {
      setSaveStatus('restore-status', 'err', '✗ Chronicle format unrecognised.');
    }
  } catch(e) {
    setSaveStatus('restore-status', 'err', '✗ ' + e.message);
  }
}

function setSaveStatus(id, cls, msg) {
  const el = document.getElementById(id);
  el.className = 'save-status' + (cls ? ' ' + cls : '');
  el.textContent = msg;
}

function computeOfflineGain(savedAtISO) {
  // Calculate resources accumulated since last save (capped at 8 hours)
  if (!savedAtISO) return;
  const elapsed = Math.min(8 * 3600, (Date.now() - new Date(savedAtISO).getTime()) / 1000);
  if (elapsed < 60) return; // less than a minute, skip
  updateCaps();
  let gained = [];
  for (let i = 0; i < 7; i++) {
    const gain = rates[i] * elapsed;
    const prev = values[i];
    values[i] = Math.min(resCaps[i], values[i] + gain);
    if (values[i] - prev > 1) gained.push(RES_SYMBOLS[i] + '+' + Math.floor(values[i]-prev));
  }
  if (gained.length) {
    const hrs = (elapsed / 3600).toFixed(1);
    toast('Offline income (' + hrs + 'h): ' + gained.join(' '));
  }
  // Advance research offline
  advanceResearchOffline(elapsed);
}

function advanceResearchOffline(elapsedSeconds) {
  const sr = getSkillResearch();
  if (!sr.active || !sr.researchAcolyte) return;
  // 25% per 10 minutes base, Memory bonus, planetary not applied offline
  const ticksPassed = Math.floor(elapsedSeconds / 60); // 1 tick per minute
  const acolyte = (_acolytesData||[]).find(a => a.id === sr.researchAcolyte);
  const memBonus = Math.max(0, Math.floor(((acolyte?.stats?.memory||8) - 8) / 2)) * 0.05;
  const pctPerTick = (25 / 10) * (1 + memBonus); // 2.5% base per minute
  const totalGain = Math.min(100 - (sr.active.progress||0), ticksPassed * pctPerTick);
  if (totalGain > 0) {
    sr.active.progress = Math.min(100, (sr.active.progress||0) + totalGain);
    if (sr.active.progress >= 100) completeResearch();
  }
}
