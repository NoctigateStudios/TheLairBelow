// ════════════════════════════════════════════════════════════
// RECRUIT
// ════════════════════════════════════════════════════════════

function showRecruitTab(ev) {
  // Generate the potential acolyte
  const classKeys = Object.keys(ACOLYTE_CLASSES);
  const classKey  = classKeys[Math.floor(Math.random() * classKeys.length)];
  const cls       = ACOLYTE_CLASSES[classKey];
  const name      = ACOLYTE_NAMES[Math.floor(Math.random() * ACOLYTE_NAMES.length)];
  const lore      = cls.lore[Math.floor(Math.random() * cls.lore.length)];

  // Give them slight random stat variation
  const stats = {};
  Object.entries(cls.stats).forEach(([k,v]) => {
    stats[k] = Math.max(1, v + Math.floor((Math.random()-0.5)*4));
  });
  // Personality quirks — 1-2
  const QUIRKS = ['Guarded','Restless','Meticulous','Sardonic','Devout','Amnesiac',
                  'Insomniac','Obsessive','Detached','Fervent','Cautious','Reckless'];
  const quirk1 = QUIRKS[Math.floor(Math.random()*QUIRKS.length)];
  let quirk2 = QUIRKS[Math.floor(Math.random()*QUIRKS.length)];
  while (quirk2 === quirk1) quirk2 = QUIRKS[Math.floor(Math.random()*QUIRKS.length)];
  const states = [quirk1, quirk2];

  _recruitmentState = { ev, classKey, cls, name, stats, states, lore, approached: false, outcome: null };

  // Populate the panel
  document.getElementById('recruit-scene-location').textContent =
    ev.title || 'Field Encounter';
  document.getElementById('recruit-scene-desc').textContent =
    ev.desc || 'A figure moves at the edge of your perception.';
  document.getElementById('recruit-fig-glyph').textContent = cls.glyph;
  document.getElementById('recruit-fig-class').textContent = classKey.replace(/-/g,' ');
  document.getElementById('recruit-fig-name').textContent = name;
  document.getElementById('recruit-fig-lore').textContent = lore;

  // Stats display
  const statLabels = { fortitude:'FOR', wrath:'WRA', intuition:'INT', empathy:'EMP',
                       endurance:'END', memory:'MEM', cunning:'CUN', gnosis:'GNO', speed:'SPD' };
  document.getElementById('recruit-fig-stats').innerHTML =
    Object.entries(stats).filter(([k]) => k !== 'gnosis' || stats.gnosis > 0).map(([k,v]) =>
      `<span class="recruit-stat">${statLabels[k]||k} <span>${v}</span></span>`
    ).join('');

  // Approaches — filter by requirements
  const charStats = _characterData?.stats || {};
  const gnosis = charStats.gnosis || 0;
  const approaches = APPROACH_TYPES.filter(a => {
    if (!a.requires) return true;
    if (a.requires.stat === 'gnosis') return gnosis >= a.requires.min;
    return true;
  });

  document.getElementById('recruit-approaches').innerHTML = approaches.map(a => `
    <button class="approach-btn" onclick="attemptApproach('${a.id}')">
      <span class="approach-glyph">${a.glyph}</span>
      <span class="approach-text">${a.label}
        <span class="approach-sub">${a.sub}</span>
      </span>
    </button>`).join('');

  // Hide outcome, show approaches
  document.getElementById('recruit-outcome').style.display = 'none';
  document.getElementById('recruit-approach-label').style.display = '';
  document.getElementById('recruit-approaches').style.display = '';

  // Show and switch to recruit tab
  const tab = document.getElementById('tab-recruit');
  if (tab) { tab.style.display = ''; tab.classList.add('pulsing'); }
  switchTab('recruit');
  // Scroll to top
  document.getElementById('panel-recruit')?.scrollTo(0, 0);
}

function attemptApproach(approachId) {
  if (!_recruitmentState) return;
  const approach = APPROACH_TYPES.find(a => a.id === approachId);
  if (!approach) return;

  const success = Math.random() < approach.successChance;
  const lorePool = success ? approach.successLore : approach.failLore;
  const outcomeLore = lorePool[Math.floor(Math.random() * lorePool.length)];

  _recruitmentState.approached = true;
  _recruitmentState.outcome = success ? 'success' : 'fail';

  // Hide approach section
  document.getElementById('recruit-approach-label').style.display = 'none';
  document.getElementById('recruit-approaches').style.display = 'none';

  // Build outcome
  const outcome = document.getElementById('recruit-outcome');
  document.getElementById('recruit-outcome-sigil').textContent = success ? '◈' : '○';
  document.getElementById('recruit-outcome-sigil').style.color =
    success ? 'var(--amber-bright)' : 'var(--text-secondary)';
  document.getElementById('recruit-outcome-text').textContent = outcomeLore;

  const actionsEl = document.getElementById('recruit-outcome-actions');
  if (success) {
    actionsEl.innerHTML = `
      <button class="recruit-outcome-btn primary" onclick="confirmRecruit()">
        Bring them to the Lair
      </button>
      <button class="recruit-outcome-btn" onclick="declineRecruit()">
        Not now — the lair isn't ready
      </button>`;
  } else {
    actionsEl.innerHTML = `
      <button class="recruit-outcome-btn" onclick="closeRecruitTab()">
        Leave without looking back
      </button>
      <button class="recruit-outcome-btn" onclick="retryApproach()">
        Try a different approach
      </button>`;
  }
  outcome.style.display = '';
}

function retryApproach() {
  if (!_recruitmentState) return;
  _recruitmentState.outcome = null;
  document.getElementById('recruit-outcome').style.display = 'none';
  document.getElementById('recruit-approach-label').style.display = '';
  document.getElementById('recruit-approaches').style.display = '';
}

async function confirmRecruit() {
  if (!_recruitmentState || _recruitmentState.outcome !== 'success') return;
  const { name, classKey, stats, states } = _recruitmentState;
  const displayClass = ACOLYTE_CLASSES[classKey] ?
    classKey.split('-').map(w => w[0].toUpperCase()+w.slice(1)).join(' ') : classKey;

  const newAcolyte = {
    id: 'acol_' + Date.now(),
    name, class: displayClass, classKey,
    level: 1, xp: 0, stress: 0, states,
    stats, available: false,
  };

  // Add to character data
  if (!_acolytesData) _acolytesData = [];
  _acolytesData.push(newAcolyte);
  renderAcolyteCards(_acolytesData);

  // Persist
  try {
    await fbWrite(getOrCreatePlayerId(), collectGameState());
  } catch(e) {}

  const msg = name + ' joins the lair. ' + states.join(', ') + '.';
  document.getElementById('recruit-outcome-text').textContent = msg;
  document.getElementById('recruit-outcome-actions').innerHTML = `
    <button class="recruit-outcome-btn primary" onclick="closeRecruitTab(); switchTab('company')">
      Return to the Lair
    </button>`;
}

function declineRecruit() {
  document.getElementById('recruit-outcome-text').textContent =
    '"Another time, perhaps." You leave them to the street. They watch you go.';
  document.getElementById('recruit-outcome-actions').innerHTML = `
    <button class="recruit-outcome-btn" onclick="closeRecruitTab()">
      Leave
    </button>`;
}

function closeRecruitTab() {
  const tab = document.getElementById('tab-recruit');
  if (tab) { tab.style.display = 'none'; tab.classList.remove('pulsing','active'); }
  document.getElementById('panel-recruit')?.classList.remove('active');
  _recruitmentState = null;
  switchTab('field');
}
