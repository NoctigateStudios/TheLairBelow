// ════════════════════════════════════════════════════════════
// RESEARCH
// ════════════════════════════════════════════════════════════

function getSkillResearch() {
  if (!_researchData) _researchData = { active: null, progress: 0, queue: [], skillResearch: { active: null, mastered: [], queue: [] } };
  if (!_researchData.skillResearch) _researchData.skillResearch = { active: null, mastered: [], queue: [] };
  return _researchData.skillResearch;
}

function getMasteredSkills() {
  return getSkillResearch().mastered || [];
}

async function renderSkillResearch() {
  const el = document.getElementById('skill-research-panel');
  if (!el) return;

  // Load skills if needed
  if (!_cachedWorldSkills) {
    try {
      const res = await fetch(`${FB_URL}/world/skills.json?cb=`+Date.now());
      if (res.ok) { const d = await res.json(); if (d&&!d.error) _cachedWorldSkills = d; }
    } catch(e) {}
  }

  const sr = getSkillResearch();
  const mastered = sr.mastered || [];
  const masteredKeys = mastered.map(s => s.key);

  // Available skills to research (not mastered, not active)
  const available = _cachedWorldSkills
    ? Object.entries(_cachedWorldSkills).filter(([k,s]) => {
        const cat = s.category||s.cat||'';
        if (cat === 'rite') return false; // rites researched differently
        return !masteredKeys.includes(k) && sr.active?.key !== k;
      }).map(([k,s]) => ({key:k,...s}))
    : [];

  // Render available
  const avEl = document.getElementById('skill-research-available');
  if (avEl) {
    if (!available.length) {
      avEl.innerHTML = '<div style="font-family:var(--ff-body);font-style:italic;font-size: 0.8rem;color:var(--text-secondary);">All skills mastered.</div>';
    } else {
      avEl.innerHTML = available.map(sk => {
        const cat = sk.category||sk.cat||'utility';
        const CAT_COL = {attack:'var(--crimson-bright)',heal:'var(--viridian-bright)',buff:'var(--amber-bright)',debuff:'var(--mist)',utility:'var(--gold)'};
        const col = CAT_COL[cat]||'var(--gold)';
        const turns = _worldBuildings?.scriptorium?.maxLevel ? Math.max(1, 4 - (_lairData?.buildings?.scriptorium||1)) : 3;
        return `<div style="border-top:1px solid var(--border);padding:0.7rem 0;display:flex;align-items:flex-start;gap:0.6rem;">
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.1rem;">
              <span style="font-family:var(--ff-heading);font-size: 0.42rem;letter-spacing:0.15em;text-transform:uppercase;color:${col};">${cat}</span>
              <span style="font-family:var(--ff-heading);font-size: 0.79rem;color:var(--text-primary);">${sk.name}</span>
              ${sk.classKey?`<span style="font-family:var(--ff-heading);font-size: 0.38rem;color:var(--text-secondary);">${sk.classKey}</span>`:''}
            </div>
            <div style="font-family:var(--ff-body);font-style:italic;font-size: 0.96rem;color:var(--text-secondary);line-height:1.55;">${sk.desc||''}</div>
            <div style="font-family:var(--ff-heading);font-size: 0.41rem;letter-spacing:0.1em;color:var(--text-secondary);margin-top:0.25rem;">~${turns} session${turns!==1?'s':''} · Scriptorium Lv.${_lairData?.buildings?.scriptorium||1}</div>
          </div>
          <button style="font-family:var(--ff-heading);font-size: 0.45rem;letter-spacing:0.12em;text-transform:uppercase;padding:0.35rem 0.6rem;border:1px solid var(--border);background:none;color:var(--text-secondary);cursor:pointer;flex-shrink:0;"
            onclick="startSkillResearch('${sk.key}','${sk.name}')">Research</button>
        </div>`;
      }).join('');
    }
  }

  // Render active research
  const actEl = document.getElementById('skill-research-active');
  if (actEl) {
    if (!sr.active) {
      actEl.innerHTML = '<div style="font-family:var(--ff-body);font-style:italic;font-size: 0.8rem;color:var(--text-secondary);">No skill research underway.</div>';
    } else {
      const pct = Math.min(100, sr.active.progress||0);
      actEl.innerHTML = `<div style="border-top:1px solid var(--border);padding:0.7rem 0;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.4rem;">
          <span style="font-family:var(--ff-heading);font-size: 0.79rem;color:var(--text-primary);">${sr.active.name}</span>
          <span style="font-family:var(--ff-heading);font-size: 0.49rem;color:var(--text-secondary);">${pct}%</span>
        </div>
        <div style="height:2px;background:var(--border);margin-bottom:0.4rem;">
          <div style="height:100%;background:var(--viridian-bright);width:${pct}%;transition:width 0.4s;"></div>
        </div>
        <div style="display:flex;gap:0.5rem;">
          <button style="font-family:var(--ff-heading);font-size: 0.45rem;letter-spacing:0.12em;text-transform:uppercase;padding:0.3rem 0.6rem;border:1px solid var(--viridian-bright);background:none;color:var(--viridian-bright);cursor:pointer;"
            onclick="advanceSkillResearch(25)">Study (+25%)</button>
          <button style="font-family:var(--ff-heading);font-size: 0.45rem;letter-spacing:0.12em;text-transform:uppercase;padding:0.3rem 0.6rem;border:1px solid var(--border);background:none;color:var(--text-secondary);cursor:pointer;"
            onclick="abandonSkillResearch()">Abandon</button>
        </div>
      </div>`;
    }
  }

  // Render mastered
  const mastEl = document.getElementById('skill-research-mastered');
  if (mastEl) {
    if (!mastered.length) {
      mastEl.innerHTML = '<div style="font-family:var(--ff-body);font-style:italic;font-size: 0.8rem;color:var(--text-secondary);">No skills mastered yet.</div>';
    } else {
      mastEl.innerHTML = mastered.map(sk => `
        <div style="border-top:1px solid var(--border);padding:0.5rem 0;display:flex;align-items:center;gap:0.5rem;">
          <span style="font-family:var(--ff-heading);font-size: 0.83rem;color:var(--viridian-bright);">◆</span>
          <div>
            <div style="font-family:var(--ff-heading);font-size: 0.77rem;color:var(--text-primary);">${sk.name}</div>
            <div style="font-family:var(--ff-body);font-style:italic;font-size: 0.9rem;color:var(--text-secondary);">${sk.desc||''}</div>
          </div>
        </div>`).join('');
    }
  }
}

function startSkillResearch(key, name) {
  const sr = getSkillResearch();
  if (sr.active) {
    toast('Research already underway — complete or abandon it first.');
    return;
  }
  const sk = _cachedWorldSkills?.[key] || {};
  sr.active = { key, name, desc: sk.desc||'', progress: 0 };
  persistState();
  toast(`Researching: ${name}.`);
  renderSkillResearch();
}

function advanceSkillResearch(amount) {
  const sr = getSkillResearch();
  if (!sr.active) return;
  sr.active.progress = Math.min(100, (sr.active.progress||0) + amount);
  if (sr.active.progress >= 100) {
    // Complete!
    if (!sr.mastered) sr.mastered = [];
    sr.mastered.push({ key: sr.active.key, name: sr.active.name, desc: sr.active.desc||'' });
    const name = sr.active.name;
    sr.active = null;
    persistState();
    toast(`✦ ${name} has been mastered. Teach it to an acolyte.`);
  } else {
    persistState();
  }
  renderSkillResearch();
}

function abandonSkillResearch() {
  const sr = getSkillResearch();
  if (!sr.active) return;
  const name = sr.active.name;
  sr.active = null;
  persistState();
  toast(`Research on ${name} abandoned.`);
  renderSkillResearch();
}

function openScriptorium() {
  document.getElementById('scriptorium-modal').classList.add('open');
  renderScriptorium();
}

function closeScriptorium() {
  document.getElementById('scriptorium-modal').classList.remove('open');
}

function switchScripTab(tab, btn) {
  document.querySelectorAll('.scrip-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.scrip-section').forEach(s => s.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const el = document.getElementById('scrip-' + tab);
  if (el) el.classList.add('active');
}

async function renderScriptorium() {
  // Ensure skills loaded
  if (!_cachedWorldSkills) {
    try {
      const res = await fetch(`${FB_URL}/world/skills.json?cb=` + Date.now());
      if (res.ok) { const d = await res.json(); if (d && !d.error) _cachedWorldSkills = d; }
    } catch(e) {}
  }

  const sr = getSkillResearch();
  const mastered = sr.mastered || [];
  const masteredKeys = mastered.map(s => s.key);
  const scriptoriumLv = _lairData?.buildings?.scriptorium || 1;

  // ── Active research bar ──
  const activeBar = document.getElementById('scrip-active-bar');
  if (activeBar) {
    if (sr.active) {
      const pct = Math.min(100, sr.active.progress || 0);
      const assignedAcol = (_acolytesData||[]).find(a => a.id === sr.researchAcolyte);
      const mem = assignedAcol?.stats?.memory || 0;
      const memBonus = assignedAcol ? Math.max(0, Math.floor((mem-8)/2))*5 : 0;
      const ph = typeof getPlanetaryHour === 'function' ? getPlanetaryHour(phLat,phLng) : null;
      const planetBonus = ph?.meta?.name === 'Mercury' ? 30 : ph?.meta?.name === 'Saturn' ? 20 : 0;
      const tarotBonus = Math.round((researchRateBonus()-1)*100);
      const gainPerStudy = Math.round(25 + memBonus + planetBonus + tarotBonus);
      const gainPerMin = (2.5 + memBonus*0.1 + planetBonus*0.1 + tarotBonus*0.1).toFixed(1);
      // Acolyte picker
      const pickerOpts = [
        `<option value="">— assign a researcher —</option>`,
        ...(_acolytesData||[]).map(a =>
          `<option value="${a.id}" ${a.id===sr.researchAcolyte?'selected':''}>${a.name} (MEM ${a.stats?.memory||'?'})</option>`)
      ].join('');
      activeBar.innerHTML = `
        <div class="scrip-active-card">
          <div class="scrip-active-name">${sr.active.name}</div>
          <div style="font-family:var(--ff-body);font-style:italic;font-size: 0.96rem;color:var(--text-secondary);margin-bottom:0.5rem;line-height:1.55;">${sr.active.desc||''}</div>
          <div class="scrip-progress-track">
            <div class="scrip-progress-fill" style="width:${pct}%"></div>
          </div>
          <div style="font-family:var(--ff-heading);font-size: 0.41rem;letter-spacing:0.1em;color:var(--text-secondary);margin-bottom:0.5rem;">
            ${pct.toFixed(1)}% · Auto: +${gainPerMin}%/min · Manual: +${gainPerStudy}%/session
            ${planetBonus?` · ${ph.meta.symbol} ${ph.meta.name} Hour active`:''}
            ${tarotBonus?` · Tarot +${tarotBonus}%`:''}
          </div>
          <div style="margin-bottom:0.6rem;">
            <select onchange="setResearchAcolyte(this.value)" style="width:100%;font-family:var(--ff-heading);font-size: 0.58rem;background:var(--bg,var(--abyss));border:1px solid var(--border);color:var(--text-primary);padding:0.35rem;">
              ${pickerOpts}
            </select>
          </div>
          <div class="scrip-active-btns">
            <button class="scrip-btn primary" onclick="scriptoriumStudy()">Study (+${gainPerStudy}%)</button>
            <button class="scrip-btn" onclick="scriptoriumAbandon()">Abandon</button>
          </div>
        </div>`;
    } else {
      activeBar.innerHTML = `
        <div style="font-family:var(--ff-body);font-style:italic;font-size: 0.82rem;color:var(--text-secondary);padding:0.9rem 1rem;border-bottom:1px solid var(--border);">
          No research underway. Select a skill below.
        </div>`;
    }
  }

  // ── Available skills ──
  const CAT_COL = {attack:'var(--crimson-bright)',heal:'var(--viridian-bright)',
    buff:'var(--amber-bright)',debuff:'var(--mist)',utility:'var(--gold)'};
  const avEl = document.getElementById('scrip-available-list');
  if (avEl && _cachedWorldSkills) {
    const available = Object.entries(_cachedWorldSkills).filter(([k, s]) => {
      if ((s.category||s.cat||'') === 'rite') return false;
      return !masteredKeys.includes(k) && sr.active?.key !== k;
    });
    if (!available.length) {
      avEl.innerHTML = `<div class="scrip-skill-row"><div class="scrip-skill-desc">All skills have been mastered.</div></div>`;
    } else {
      avEl.innerHTML = available.map(([k, s]) => {
        const cat = s.category || s.cat || 'utility';
        const col = CAT_COL[cat] || 'var(--gold)';
        const sessions = Math.max(1, 5 - scriptoriumLv); // Lv1=4 sessions, Lv3=2
        return `<div class="scrip-skill-row">
          <div class="scrip-skill-body">
            <div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.2rem;">
              <span style="font-family:var(--ff-heading);font-size: 0.38rem;letter-spacing:0.15em;text-transform:uppercase;color:${col};">${cat}</span>
              ${s.classKey?`<span style="font-family:var(--ff-heading);font-size: 0.38rem;letter-spacing:0.1em;color:var(--text-secondary);">${s.classKey}</span>`:'<span style="font-family:var(--ff-heading);font-size: 0.38rem;color:var(--text-secondary);">Any class</span>'}
            </div>
            <div class="scrip-skill-name">${s.name||k}</div>
            <div class="scrip-skill-desc">${s.desc||''}</div>
            <div class="scrip-skill-meta" style="margin-top:0.25rem;">~${sessions} session${sessions!==1?'s':''} · Scriptorium Lv.${scriptoriumLv}</div>
          </div>
          <button class="scrip-research-btn" onclick="scriptoriumStart('${k}','${(s.name||k).replace(/'/g,'')}','${(s.desc||'').replace(/'/g,'').substring(0,80)}')" ${sr.active?'disabled style="opacity:0.35;cursor:not-allowed;"':''}>
            ${sr.active?'Busy':'Research'}
          </button>
        </div>`;
      }).join('');
    }
  }

  // ── Mastered ──
  const mastEl = document.getElementById('scrip-mastered-list');
  if (mastEl) {
    if (!mastered.length) {
      mastEl.innerHTML = `<div class="scrip-mastered-row"><div class="scrip-mastered-desc">Nothing mastered yet.</div></div>`;
    } else {
      mastEl.innerHTML = mastered.map(sk => `
        <div class="scrip-mastered-row">
          <span class="scrip-mastered-glyph">◆</span>
          <div class="scrip-mastered-body">
            <div class="scrip-mastered-name">${sk.name}</div>
            <div class="scrip-mastered-desc">${sk.desc||''}</div>
          </div>
        </div>`).join('');
    }
  }

  // ── Recipes unlocked (from forge) ──
  const recEl = document.getElementById('scrip-recipes-list');
  if (recEl) {
    const recipes = Object.entries(inventory||{}).filter(([k,v])=>v>0);
    if (!recipes.length) {
      recEl.innerHTML = `<div class="scrip-mastered-row"><div class="scrip-mastered-desc">No items crafted yet.</div></div>`;
    } else {
      recEl.innerHTML = recipes.map(([name,qty]) => `
        <div class="scrip-mastered-row">
          <span class="scrip-mastered-glyph" style="color:var(--amber-bright);">◈</span>
          <div class="scrip-mastered-body">
            <div class="scrip-mastered-name">${name}</div>
            <div class="scrip-mastered-desc" style="color:var(--amber-bright);">×${qty} in inventory</div>
          </div>
        </div>`).join('');
    }
  }

  // Also update Arcana panel
  renderSkillResearch();
}

function scriptoriumStart(key, name, desc) {
  const sr = getSkillResearch();
  if (sr.active) { toast('Complete or abandon current research first.'); return; }
  sr.active = { key, name, desc, progress: 0 };
  _researchData = _researchData || {};
  _researchData.skillResearch = sr;
  persistState();
  renderScriptorium();
}

function scriptoriumStudy() {
  const sr = getSkillResearch();
  if (!sr.active) return;
  if (!sr.researchAcolyte) {
    toast('Assign a researcher first — tap an acolyte card below.');
    return;
  }
  const acolyte = (_acolytesData||[]).find(a => a.id === sr.researchAcolyte);
  const mem = acolyte?.stats?.memory || 8;
  const memBonus = Math.max(0, Math.floor((mem - 8) / 2)) * 5;
  // Planetary bonus: if current hour matches a relevant planet, +20%
  const ph = getPlanetaryHour && getPlanetaryHour(phLat, phLng);
  const planetBonus = ph?.meta?.name === 'Mercury' ? 30 : ph?.meta?.name === 'Saturn' ? 20 : 0;
  const tarotBonus = Math.round((researchRateBonus() - 1) * 100);
  const gain = Math.round(25 + memBonus + planetBonus + tarotBonus);
  const breakdown = [`Base: 25%`, memBonus?`Memory: +${memBonus}%`:'', planetBonus?`${ph.meta.name} Hour: +${planetBonus}%`:'', tarotBonus?`Tarot: +${tarotBonus}%`:''].filter(Boolean).join(' · ');
  sr.active.progress = Math.min(100, (sr.active.progress||0) + gain);
  if (sr.active.progress >= 100) {
    completeResearch();
  } else {
    appendScriptoriumLog(`${acolyte?.name||'Researcher'} studied ${sr.active.name} +${gain}% (${breakdown})`);
    toast(`+${gain}% progress. ${sr.active.progress}% complete.`);
    persistState();
    renderScriptorium();
  }
}

function completeResearch() {
  const sr = getSkillResearch();
  if (!sr.active) return;
  if (!sr.mastered) sr.mastered = [];
  const completed = { key: sr.active.key, name: sr.active.name, desc: sr.active.desc||'' };
  sr.mastered.push(completed);
  const name = sr.active.name;
  const acolyte = (_acolytesData||[]).find(a => a.id === sr.researchAcolyte);
  appendScriptoriumLog(`✦ Mastered: ${name}. Research by ${acolyte?.name||'unknown'}.`);
  sr.active = null;
  sr.researchAcolyte = null;
  persistState();
  renderScriptorium();
  renderSkillResearch();
  toast(`✦ ${name} mastered. Teach it to an acolyte from the Company panel.`);
}

function researchTick() {
  const sr = getSkillResearch();
  if (!sr.active || !sr.researchAcolyte) return;
  const acolyte = (_acolytesData||[]).find(a => a.id === sr.researchAcolyte);
  const mem = acolyte?.stats?.memory || 8;
  const memBonus = Math.max(0, Math.floor((mem - 8) / 2)) * 5;
  const ph = getPlanetaryHour && getPlanetaryHour(phLat, phLng);
  const planetBonus = ph?.meta?.name === 'Mercury' ? 30 : ph?.meta?.name === 'Saturn' ? 20 : 0;
  const tarotBonus = Math.round((researchRateBonus() - 1) * 100);
  const gain = (2.5 + memBonus*0.1 + planetBonus*0.1 + tarotBonus*0.1); // per minute: base 2.5% per min = 25%/10min
  sr.active.progress = Math.min(100, (sr.active.progress||0) + gain);
  if (sr.active.progress >= 100) completeResearch();
  else {
    // Update scrip UI if open
    const bar = document.querySelector('.scrip-progress-fill');
    if (bar) bar.style.width = sr.active.progress + '%';
    persistState();
  }
}

function scriptoriumAbandon() {
  const sr = getSkillResearch();
  if (!sr.active) return;
  const name = sr.active.name;
  appendScriptoriumLog(`Abandoned research: ${name}.`);
  sr.active = null;
  persistState();
  renderScriptorium();
  toast(`Research on ${name} abandoned.`);
}

function appendScriptoriumLog(text) {
  if (!_researchData) return;
  if (!_researchData.sessionLog) _researchData.sessionLog = [];
  _researchData.sessionLog.unshift({ text, time: new Date().toLocaleTimeString() });
  _researchData.sessionLog = _researchData.sessionLog.slice(0, 20); // keep last 20
  // Render log
  const el = document.getElementById('scrip-lore-list');
  if (el) {
    el.innerHTML = (_researchData.sessionLog||[]).map(entry =>
      `<div style="border-top:1px solid var(--border);padding:0.55rem 1rem;display:flex;gap:0.6rem;align-items:baseline;">
        <span style="font-family:var(--ff-heading);font-size: 0.38rem;letter-spacing:0.08em;color:var(--text-secondary);flex-shrink:0;">${entry.time}</span>
        <span style="font-family:var(--ff-body);font-style:italic;font-size: 0.78rem;color:var(--text-secondary);">${entry.text}</span>
      </div>`
    ).join('');
  }
}

function setResearchAcolyte(acolyteId) {
  const sr = getSkillResearch();
  sr.researchAcolyte = acolyteId || null;
  persistState();
  const a = (_acolytesData||[]).find(x => x.id === acolyteId);
  if (a) toast(`${a.name} assigned to the Scriptorium.`);
}

function renderTarotSpread() {
  const row = document.getElementById('tarot-cards-row');
  if (!row) return;
  row.innerHTML = _currentSpread.map((s, i) => {
    if (!s) {
      const ready = i === 0 || _currentSpread[i-1] !== null;
      return `<div class="tarot-card face-down" onclick="${ready ? 'drawCard('+i+')' : 'toast("Draw the previous card first.")'}" style="cursor:${ready?'pointer':'default'};${ready?'':'opacity:0.4;'}">
        <div style="font-family:var(--ff-heading);font-size: 0.51rem;color:var(--text-secondary);letter-spacing:0.1em;text-transform:uppercase;padding:0.5rem;">${SPREAD_POSITIONS[i]}</div>
      </div>`;
    }
    const { card, reversed, effect } = s;
    const col = reversed ? 'var(--crimson-bright)' : 'var(--viridian-bright)';
    return `<div class="tarot-card revealed ${reversed?'reversed':''}" onclick="openCodexEntry('major-arcana')" style="cursor:pointer;">
      <span class="tarot-card-num">${card.num}</span>
      <span class="tarot-card-symbol">${card.sym}</span>
      <span class="tarot-card-name" style="color:var(--bone);">${card.name}${reversed?' ↓':''}</span>
      <div style="font-family:var(--ff-heading);font-size: 0.39rem;color:${col};margin-top:0.2rem;letter-spacing:0.04em;text-align:center;padding:0 0.15rem;line-height:1.2;overflow:hidden;max-height:2.5rem;">${effect.label.split('—')[0].trim()}</div>
    </div>`;
  }).join('');

  // Effects row
  const fx = document.getElementById('tarot-effects-row');
  if (fx) {
    const drawn = _currentSpread.filter(Boolean);
    if (!drawn.length) { fx.innerHTML = ''; return; }
    fx.innerHTML = drawn.map((s, i) => {
      const col = s.reversed ? 'var(--crimson-bright)' : 'var(--viridian-bright)';
      const label = s.effect?.label || '';
      return `<div class="effect-tag">
        <div>
          <div class="effect-name" style="font-size: 0.51rem;">${SPREAD_POSITIONS[i]} · <span style="color:${col};font-family:var(--ff-heading);">${s.card.name}${s.reversed?' ↓':''}</span></div>
          <div style="font-family:var(--ff-body);font-style:italic;font-size: 0.61rem;color:var(--mist);margin-top:0.1rem;">${label}</div>
        </div>
      </div>`;
    }).join('');
  }

  updateTarotEffectsList();
}

function drawCard(slot) {
  if (_currentSpread[slot] !== null) { toast('This position is already drawn.'); return; }
  if (_currentSpread.every(s => s === null) && slot !== 0) { toast('Draw the first card — The Past — before the others.'); return; }
  if (slot === 1 && _currentSpread[0] === null) { toast('Draw the Past card first.'); return; }
  if (slot === 2 && _currentSpread[1] === null) { toast('Draw the Present card first.'); return; }

  // Pick a card not already in spread
  const used = _currentSpread.filter(Boolean).map(s => s.card.name);
  const available = majorArcana.filter(c => !used.includes(c.name));
  if (!available.length) { toast('All cards have been drawn.'); return; }
  const card = available[Math.floor(Math.random() * available.length)];
  const reversed = Math.random() > 0.6;
  const effect = applyTarotEffect(card, reversed);
  _currentSpread[slot] = { card, reversed, effect };
  renderTarotSpread();
  toast((reversed ? '' : '✦ ') + SPREAD_POSITIONS[slot] + ': ' + card.name + (reversed ? ' (reversed)' : '') + ' — ' + effect.label);
  persistState();
}

function startNewSpread() {
  if (values[1] < 200) { toast('200 Lunar essence required to open the spread.'); return; }
  values[1] -= 200;
  document.querySelectorAll('.resource-pill .res-value').forEach((el,i) => { el.textContent = Math.floor(values[i]); });
  _currentSpread = [null, null, null];
  renderTarotSpread();
  toast('The cloth is laid. Draw each card in turn.');
  persistState();
}

function clearSpread() {
  _currentSpread = [null, null, null];
  tarotEffects = [];
  if (_researchData) _researchData.tarotEffects = [];
  renderTarotSpread();
  updateTarotEffectsList();
  persistState();
  toast('The spread is cleared. Effects removed.');
}

function updateTarotEffectsList() {
  const panel = document.getElementById('tarot-active-effects');
  const list  = document.getElementById('tarot-effects-list');
  if (!panel || !list) return;
  const now   = Date.now();
  const active = tarotEffects.filter(e => e.until > now);
  const drawn  = _currentSpread.filter(Boolean);
  if (!active.length && !drawn.length) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  list.innerHTML = drawn.map(s => {
    const { card, reversed, effect } = s;
    const col = reversed ? 'var(--crimson-bright)' : 'var(--viridian-bright)';
    const timeLeft = effect.until ? Math.max(0, Math.round((effect.until - now)/60000)) : null;
    return `<div style="border-left:2px solid ${col};padding:0.4rem 0.7rem;margin-bottom:0.4rem;background:rgba(255,255,255,0.01);">
      <div style="font-family:var(--ff-heading);font-size: 0.55rem;color:var(--bone);">${card.name}${reversed?' (reversed)':''}</div>
      <div style="font-family:var(--ff-body);font-style:italic;font-size: 0.64rem;color:var(--mist);line-height:1.5;">${effect.label}</div>
      ${timeLeft !== null ? `<div style="font-family:var(--ff-heading);font-size: 0.43rem;color:var(--text-secondary);margin-top:0.2rem;">${timeLeft > 0 ? timeLeft+'m remaining' : 'Expired'}</div>` : ''}
    </div>`;
  }).join('');
}

function restoreTarotEffects() {
  const now = Date.now();
  if (_researchData?.tarotEffects) {
    tarotEffects = (_researchData.tarotEffects||[]).filter(e => e.until > now);
    // Re-schedule stat reversals that are still live — the setTimeout was lost on reload
    tarotEffects.forEach(e => {
      if ((e.type === 'stat_buff' || e.type === 'stat_debuff') && e.stat && e.until > now) {
        const remaining = e.until - now;
        const snapshots = e._snapshots || [];
        const charBase  = e._charBase  !== undefined ? e._charBase : null;
        setTimeout(() => {
          snapshots.forEach(snap => {
            const a = (_acolytesData||[]).find(x => x.id === snap.id);
            if (a?.stats) a.stats[e.stat] = snap.base;
          });
          if (_characterData?.stats && charBase !== null) {
            _characterData.stats[e.stat] = charBase;
          }
          if (_acolytesData?.length) renderAcolyteCards(_acolytesData);
          refreshCharacterBar();
          tarotEffects = tarotEffects.filter(x => x !== e);
          toast(`✦ Tarot effect expired — ${e.stat} returns to base.`);
          persistState();
        }, remaining);
      }
    });
  }
  // Restore spread positions from saved state if present
  // Restore combat state — force player back into combat if they reloaded mid-fight
  if (state.combatState && state.combatState.combatants?.length) {
    _CS = state.combatState;
    setTimeout(() => {
      if (_CS) {
        const combatTab = document.getElementById('tab-combat');
        if (combatTab) { combatTab.style.display = ''; combatTab.classList.add('pulsing'); }
        switchTab('combat');
        renderCombat();
        renderActions();
        toast('Combat restored — the encounter awaits.');
      }
    }, 1200);
  }

  if (_researchData?.tarotSpread) {
    _currentSpread = _researchData.tarotSpread.map(s => {
      if (!s) return null;
      // Look in world cards first, then hardcoded majorArcana
      const allCards = [...majorArcana, ...(_worldTarotCards || [])];
      const card = allCards.find(cd => cd.name === s.cardName) 
        || { name: s.cardName, num: '?', sym: '◈' };
      const effect = TAROT_EFFECTS[card.name];
      const eff = s.reversed ? effect?.rev : effect?.up;
      return { card, reversed: s.reversed, effect: eff || { label: 'Fate persists.' } };
    });
    setTimeout(renderTarotSpread, 200);
  }
}

function drawThirdCard() { drawCard(2); }

function applyTarotEffect(card, reversed) {
  const def = TAROT_EFFECTS[card.name];
  if (!def) return { label: 'Fate shifts.' };
  const eff = reversed ? def.rev : def.up;
  const durationH = eff.dur !== undefined ? eff.dur : (reversed ? 2 : 2);
  const until = Date.now() + durationH * 3600000;

  // Remove existing effects of same type+resIdx
  tarotEffects = tarotEffects.filter(e => !(e.type === eff.type && e.resIdx === eff.resIdx));

  switch (eff.type) {
    case 'stress':
      (_acolytesData||[]).forEach(a => {
        a.stress = Math.min(100, Math.max(0, (a.stress||0) + eff.value));
      });
      if (_acolytesData?.length) renderAcolyteCards(_acolytesData);
      break;

    case 'cleanse':
      (_acolytesData||[]).forEach(a => { a.stress = 0; });
      if (_acolytesData?.length) renderAcolyteCards(_acolytesData);
      toast('✦ All wounds of the mind are lifted.');
      break;

    case 'cleanse_afflictions':
      (_acolytesData||[]).forEach(a => {
        if (a.states) a.states = a.states.filter(s => !['Paranoid','Abusive','Masochistic','Fearful','Hopeless','Irrational'].includes(s));
      });
      if (_acolytesData?.length) renderAcolyteCards(_acolytesData);
      break;

    case 'cleanse_all':
      (_acolytesData||[]).forEach(a => {
        a.stress = 0;
        if (a.states) a.states = a.states.filter(s => !['Paranoid','Abusive','Masochistic','Fearful','Hopeless','Irrational'].includes(s));
      });
      if (_acolytesData?.length) renderAcolyteCards(_acolytesData);
      break;

    case 'grant_essence':
      if (eff.value !== undefined && eff.resIdx !== undefined) {
        values[eff.resIdx] = Math.max(0, (values[eff.resIdx]||0) + eff.value);
        document.querySelectorAll('.resource-pill .res-value').forEach((el,i) => { el.textContent = Math.floor(values[i]); });
      }
      break;

    case 'stat_buff':
    case 'stat_debuff':
      if (eff.stat && eff.value) {
        // Snapshot original values BEFORE applying so reversal is exact
        const _snapshots = [];
        (_acolytesData||[]).forEach(a => {
          if (!a.stats) a.stats = {};
          const base = a.stats[eff.stat] !== undefined ? a.stats[eff.stat] : 10;
          _snapshots.push({ id: a.id, base });
          a.stats[eff.stat] = Math.max(1, base + eff.value);
        });
        let _charBase = null;
        if (_characterData?.stats) {
          _charBase = _characterData.stats[eff.stat] !== undefined ? _characterData.stats[eff.stat] : 10;
          _characterData.stats[eff.stat] = Math.max(1, _charBase + eff.value);
        }
        // Update both acolyte cards and main character stat bars immediately
        if (_acolytesData?.length) renderAcolyteCards(_acolytesData);
        refreshCharacterBar();
        // Schedule exact reversal using captured base values
        if (durationH > 0) {
          setTimeout(() => {
            _snapshots.forEach(snap => {
              const a = (_acolytesData||[]).find(x => x.id === snap.id);
              if (a?.stats) a.stats[eff.stat] = snap.base;
            });
            if (_characterData?.stats && _charBase !== null) {
              _characterData.stats[eff.stat] = _charBase;
            }
            if (_acolytesData?.length) renderAcolyteCards(_acolytesData);
            refreshCharacterBar();
            toast(`✦ Tarot effect expired — ${eff.stat} returns to base.`);
            persistState();
          }, durationH * 3600000);
        }
      }
      tarotEffects.push({ ...eff, until, _snapshots, _charBase });
      break;

    case 'level_bonus':
      (_acolytesData||[]).forEach(a => { a.xp = (a.xp||0) + 50; });
      if (_characterData) { _characterData.xp = (_characterData.xp||0) + 50; checkLevelUp(); }
      break;

    case 'unlock_rite':
      toast(`✦ ${eff.riteKey} rite is available without prerequisites for ${durationH}h.`);
      tarotEffects.push({ ...eff, until });
      break;

    default:
      if (durationH > 0) tarotEffects.push({ ...eff, until });
      break;
  }

  // Save tarot effects so they persist
  if (_researchData) {
    _researchData.tarotEffects = tarotEffects.map(e=>({...e}));
    // Save spread positions for restore on reload
    _researchData.tarotSpread = _currentSpread.map(s => s ? { cardName: s.card.name, reversed: s.reversed } : null);
  }
  persistState();
  return eff;
}

async function loadRitesFromFirebase() {
  try {
    const res = await fetch(`${FB_URL}/world/skills.json?cb=` + Date.now());
    if (!res.ok) return;
    const d = await res.json();
    if (!d || d.error) return;
    _worldSkills = d;
    renderRitesList();
  } catch(e) {}
}

function renderRitesList() {
  const el = document.getElementById('rites-list');
  if (!el) return;
  const skills = _worldSkills ? Object.entries(_worldSkills) : [];
  const rites  = skills.filter(([, s]) => s && (s.category === 'rite' || s.type === 'rite'));

  if (!rites.length) return; // keep seed HTML if nothing in Firebase yet

  const RS_LOCAL = ['☉','☽','♃','♂','♄','♀','☿'];
  const RN_LOCAL = ['Solar','Lunar','Jovian','Martial','Saturnine','Venusian','Mercurial'];

  el.innerHTML = rites.map(([key, s]) => {
    const cost    = Array.isArray(s.cost) ? s.cost : [];
    const costStr = cost.map((v, i) => v > 0 ? `${RS_LOCAL[i]} ${v} ${RN_LOCAL[i]}` : null).filter(Boolean).join(' · ');
    const now     = Date.now();
    const active  = _activeRites[key] && _activeRites[key] > now;
    const locked  = s.unlockCondition && s.unlockCondition.toLowerCase().includes('locked');
    return `<div class="research-item ${locked ? 'locked' : ''} ${active ? 'active' : ''}"
        style="${locked ? 'opacity:0.5;' : 'cursor:pointer;'}"
        onclick="${locked ? '' : `performRite('${key}')`}">
      <div class="research-name">${s.name || key}</div>
      <p class="research-desc">${s.desc || ''}</p>
      <div class="research-meta">
        <span>${costStr ? 'Cost: ' + costStr : 'No cost'}</span>
        ${s.unlockCondition ? `<span>${s.unlockCondition}</span>` : ''}
        ${active ? `<span style="color:var(--viridian-bright);">Active</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

function performRite(key, costAmt, resIdx) {
  // If called from seed HTML with explicit cost args
  if (costAmt !== undefined && resIdx !== undefined) {
    if (values[resIdx] < costAmt) {
      toast(`Insufficient essence. You need ${costAmt} ${['☉','☽','♃','♂','♄','♀','☿'][resIdx]}.`);
      return;
    }
    values[resIdx] -= costAmt;
    document.querySelectorAll('.resource-pill .res-value').forEach((el, i) => { el.textContent = Math.floor(values[i]); });
    _activeRites[key] = Date.now() + 3 * 60 * 60 * 1000; // 3h active
    toast(`✦ The rite is performed. The hour responds.`);
    const myId = getOrCreatePlayerId();
    fbWrite(myId, collectGameState()).catch(() => {});
    return;
  }
  // Called from Firebase-rendered rites
  if (!_worldSkills || !_worldSkills[key]) { toast('Rite not found.'); return; }
  const s = _worldSkills[key];
  const cost = Array.isArray(s.cost) ? s.cost : [];
  for (let i = 0; i < cost.length; i++) {
    if (cost[i] > 0 && values[i] < cost[i]) {
      toast(`Insufficient ${['Solar','Lunar','Jovian','Martial','Saturnine','Venusian','Mercurial'][i]} essence. Need ${cost[i]}.`);
      return;
    }
  }
  cost.forEach((v, i) => { if (v > 0) values[i] -= v; });
  document.querySelectorAll('.resource-pill .res-value').forEach((el, i) => { el.textContent = Math.floor(values[i]); });
  _activeRites[key] = Date.now() + 3 * 60 * 60 * 1000;
  toast(`✦ ${s.name || 'Rite'} performed. The lair shifts.`);
  renderRitesList();
  const myId = getOrCreatePlayerId();
  fbWrite(myId, collectGameState()).catch(() => {});
}

function renderResearchQueue(research) {
  const el = document.getElementById('research-queue-list');
  if (!el || !research) return;
  const items = [];
  if (research.active) {
    items.push({ name: research.active, pct: research.progress || 0, state: 'active' });
  }
  (research.queue || []).forEach(name => items.push({ name, pct: 0, state: 'queued' }));
  (research.completed || []).forEach(name => items.push({ name, pct: 100, state: 'completed' }));
  if (!items.length) {
    el.innerHTML = '<div style="font-family:var(--ff-body);font-style:italic;font-size: 0.8rem;color:var(--text-secondary);">No research underway.</div>';
    return;
  }
  el.innerHTML = items.map(it => `
    <div class="research-item ${it.state === 'active' ? 'active' : it.state === 'completed' ? 'completed' : ''}">
      <div class="research-name">${it.state === 'completed' ? '✓ ' : ''}${it.name}</div>
      <div class="research-progress"><div class="research-fill" style="width:${it.pct}%"></div></div>
      <div class="research-meta">
        <span>${it.state === 'active' ? it.pct + '% Complete' : it.state === 'queued' ? 'Queued' : 'Completed'}</span>
      </div>
    </div>`).join('');
}
