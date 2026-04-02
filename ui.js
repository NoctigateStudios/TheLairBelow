// ════════════════════════════════════════════════════════════
// UI
// ════════════════════════════════════════════════════════════

function enterGame() {
  if (_gameStarted) return;
  _gameStarted = true;
  try {
    document.getElementById('splash').classList.add('hidden');
    document.getElementById('app').style.display = 'flex';
    document.getElementById('app').style.flexDirection = 'column';
    startPlanetaryHourEngine(46.1713, 9.8694);
    startResourceTick();
    initLocation();
    setTimeout(() => toast('The lair stirs. The stars take notice. You descend.'), 800);
    setTimeout(() => { try { initCodex(); attachLongPress(); } catch(e) { console.error('init error:',e); } }, 600);
    startAutoSave();
    loadBuildingsFromFirebase();        // immediate — needed before save loads
    setTimeout(loadRitesFromFirebase, 500);
    setTimeout(loadRecipesFromFirebase, 600);
    setTimeout(seedWorldDataIfEmpty, 2000);
    setTimeout(refreshFieldEventCards, 800);
    playerName = localStorage.getItem('llair_name') || '';
    playerCoven = localStorage.getItem('llair_coven') || '';
    // Auto-load saved state from Firebase on every startup
    setTimeout(async () => {
      try {
        const id = getOrCreatePlayerId();
        const json = await fbRead(id);
        if (json && applyGameState(json)) {
          toast('Chronicle restored from the ether.');
        } else {
          // No save found — could be new player OR deleted by DM
          // Clear any stale localStorage identity so character creation runs clean
          localStorage.removeItem('llair_name');
          localStorage.removeItem('llair_coven');
          playerName = '';
          playerCoven = '';
          // Give default lair so buildings panel isn't blank
          _lairData = { buildings: { 'alchemical-forge':1, 'altar':1, 'dormitorium':1, 'scriptorium':1 } };
          renderLairBuildings(_lairData.buildings);
          // Open character creation
          setTimeout(() => document.getElementById('identity-modal').classList.add('open'), 300);
        }
      } catch(e) { console.error('Auto-load failed:', e); }
    }, 800);
    setTimeout(restoreBorrowedAcolytes, 1000);
  } catch(e) {
    console.error('enterGame error:', e);
    alert('Error starting game: ' + e.message);
  }
}

function switchTab(tab) {
  // Block tab switching when combat is active — only 'combat' is allowed
  if (_CS && tab !== 'combat') {
    // Pulse the combat tab to remind player they're in combat
    document.getElementById('tab-combat')?.classList.add('pulsing');
    toast('Combat is active. Retreat first.');
    return;
  }
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const ORDER = ['journal','field','company','lair','arcana','codex'];
  const idx = ORDER.indexOf(tab);
  if (idx >= 0) document.querySelectorAll('.tab')[idx].classList.add('active');
  // Combat tab
  if (tab === 'combat') {
    document.getElementById('tab-combat')?.classList.add('active');
    document.getElementById('tab-combat')?.classList.remove('pulsing');
  }
  if (tab === 'recruit') {
    document.getElementById('tab-recruit')?.classList.add('active');
    document.getElementById('tab-recruit')?.classList.remove('pulsing');
  }
  const panel = document.getElementById('panel-' + tab);
  if (panel) panel.classList.add('active');
  if (tab === 'field' && map) { setTimeout(() => map.invalidateSize(), 50); placeInboxEventMarkers(playerLat||0, playerLng||0); }
  if (tab === 'codex') renderCodexList();
  if (tab === 'arcana') { renderSkillResearch(); renderTarotSpread(); }
}

function toggleTheme() {
  const isLight = document.documentElement.classList.toggle('light');
  localStorage.setItem('llair_theme', isLight ? 'light' : 'dark');
  // Update the leaflet tile filter for light mode
  document.querySelectorAll('.leaflet-tile').forEach(t => {
    t.style.filter = isLight
      ? 'sepia(0.4) hue-rotate(15deg) brightness(0.82) saturate(0.7)'
      : 'sepia(0.25) hue-rotate(200deg) brightness(0.85)';
  });
}

function toast(msg) {
  const container = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = '<span class="toast-icon">✦</span><span>' + msg + '</span>';
  container.appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

function initCodex() {
  renderCodexList();
  // Add switchTab codex support
  const tabs = ['journal','field','company','lair','arcana','codex'];
  document.querySelectorAll('.tab').forEach((t, i) => {
    t.addEventListener('click', () => {
      if (tabs[i] === 'codex') renderCodexList();
    });
  });
}

function renderCodexList() {
  const list = document.getElementById('codex-list');
  if (!list) return;
  const q = currentCodexSearch.toLowerCase();
  const entries = CODEX.filter(e => {
    const catOk = currentCodexCat === 'all' || e.cat === currentCodexCat;
    const searchOk = !q || e.name.toLowerCase().includes(q) || e.short.toLowerCase().includes(q) || e.tags.some(t => t.toLowerCase().includes(q));
    return catOk && searchOk;
  });
  list.innerHTML = entries.length ? entries.map(e => `
    <div class="codex-entry" onclick="openCodexEntry('${e.key}')">
      <div class="codex-entry-symbol">${e.symbol}</div>
      <div class="codex-entry-info">
        <div class="codex-entry-name">${e.name}</div>
        <div class="codex-entry-cat">${e.cat}</div>
        <div class="codex-entry-preview">${e.short}</div>
      </div>
    </div>`).join('') :
    '<div style="font-family:var(--ff-body);font-style:italic;color:var(--text-secondary);padding:1rem 0;text-align:center;">No entries found in the codex.</div>';
}

function filterCodex(q) {
  currentCodexSearch = q;
  renderCodexList();
}

function filterCodexCat(cat, btn) {
  currentCodexCat = cat;
  document.querySelectorAll('.codex-cat').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderCodexList();
}

function openCodexEntry(key) {
  const e = CODEX.find(x => x.key === key);
  if (!e) return;
  hideTooltip();
  document.getElementById('cm-cat').textContent = e.cat;
  document.getElementById('cm-term').textContent = e.name;
  document.getElementById('cm-symbol').textContent = e.symbol;
  document.getElementById('cm-body').textContent = e.body;
  document.getElementById('cm-tags').innerHTML = e.tags.map(t => `<span class="codex-tag">${t}</span>`).join('');
  const related = (e.related || []).map(r => {
    const re = CODEX.find(x => x.key === r);
    return re ? `<span class="codex-related-pill" onclick="openCodexEntry('${r}')">${re.symbol} ${re.name}</span>` : '';
  }).join('');
  document.getElementById('cm-related').innerHTML = related
    ? `<div class="codex-modal-related-title">See Also</div>${related}` : '';
  document.getElementById('codex-modal').classList.add('open');
}

function closeCodexModal() {
  document.getElementById('codex-modal').classList.remove('open');
}

function showTooltip(key) {
  const e = CODEX.find(x => x.key === key);
  if (!e) return;
  currentTooltipKey = key;
  document.getElementById('lp-term').textContent = e.symbol + ' ' + e.name;
  document.getElementById('lp-body').textContent = e.short;
  document.getElementById('lp-tooltip').classList.add('visible');
  document.getElementById('lp-backdrop').classList.add('visible');
}

function hideTooltip() {
  document.getElementById('lp-tooltip').classList.remove('visible');
  document.getElementById('lp-backdrop').classList.remove('visible');
  currentTooltipKey = null;
}

function attachLongPress() {
  // Single tap on any [data-codex] term shows the tooltip
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-codex]');
    if (el) {
      e.preventDefault();
      e.stopPropagation();
      showTooltip(el.dataset.codex);
    }
  });
}

function initLocation() {
  if (!navigator.geolocation) {
    document.getElementById('map-loading').querySelector('.map-loading-text').textContent = 'Geolocation not supported';
    initMap(45.4642, 9.1900);
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude } = pos.coords;
      document.getElementById('location-text').textContent =
        latitude.toFixed(4) + '°N ' + longitude.toFixed(4) + '°E';
      startPlanetaryHourEngine(latitude, longitude);
      initMap(latitude, longitude);
    },
    err => {
      document.getElementById('location-text').textContent = 'Allow location for full map';
      document.getElementById('map-loading').querySelector('.map-loading-text').textContent =
        err.code === 1 ? 'Location permission denied — open via HTTPS' : 'Location unavailable';
      initMap(45.4642, 9.1900);
      startPlanetaryHourEngine(45.4642, 9.1900);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

function calcSunriseSunset(latDeg, lngDeg, date) {
  const rad = Math.PI / 180;
  const JD = date.getTime() / 86400000 + 2440587.5;
  const n  = Math.ceil(JD - 2451545.0 + 0.0008);
  const Jstar = n - lngDeg / 360;
  const M  = (357.5291 + 0.98560028 * Jstar) % 360;
  const Mrad = M * rad;
  const C  = 1.9148*Math.sin(Mrad) + 0.0200*Math.sin(2*Mrad) + 0.0003*Math.sin(3*Mrad);
  const lam = (M + C + 180 + 102.9372) % 360;
  const lamRad = lam * rad;
  const Jtransit = 2451545.0 + Jstar + 0.0053*Math.sin(Mrad) - 0.0069*Math.sin(2*lamRad);
  const sinDec = Math.sin(lamRad) * Math.sin(23.4397 * rad);
  const dec = Math.asin(sinDec);
  const lat = latDeg * rad;
  const cosH0 = (Math.sin(-0.8333*rad) - Math.sin(lat)*sinDec) / (Math.cos(lat)*Math.cos(dec));
  if (cosH0 < -1 || cosH0 > 1) return null;
  const H0 = Math.acos(cosH0) / rad;
  const Jrise = Jtransit - H0/360;
  const Jset  = Jtransit + H0/360;
  const toUTC = jd => ((jd - Math.floor(jd - 0.5) - 0.5) * 24);
  return { sunriseUTC: toUTC(Jrise), sunsetUTC: toUTC(Jset) };
}

function fmtHour(localH) {
  const h = ((localH % 24) + 24) % 24;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return hh.toString().padStart(2,'0') + ':' + mm.toString().padStart(2,'0');
}

function getPlanetaryHour(lat, lng) {
  const now = new Date();
  const tzOffMin = now.getTimezoneOffset(); // minutes west of UTC
  const toLocal = utcH => ((utcH * 60 - tzOffMin) / 60 + 48) % 24;

  const ss = calcSunriseSunset(lat, lng, now);
  if (!ss) return null;

  const srLocal = toLocal(ss.sunriseUTC);
  const ssLocal = toLocal(ss.sunsetUTC);
  const nowLocal = now.getHours() + now.getMinutes()/60 + now.getSeconds()/3600;

  const dayLen    = ssLocal - srLocal;
  const nightLen  = 24 - dayLen;
  const dayHLen   = dayLen / 12;
  const nightHLen = nightLen / 12;

  const weekday = now.getDay();
  const dayRulerIdx = DAY_RULERS[weekday];
  const nightStartIdx = (dayRulerIdx + 12) % 7;

  // Build 24 hours
  const allHours = [];
  for (let i = 0; i < 12; i++) allHours.push({
    periodIdx: i, period: 'day',
    planetKey: CHALDEAN[(dayRulerIdx + i) % 7],
    start: srLocal + i * dayHLen,
    end:   srLocal + (i+1) * dayHLen,
  });
  for (let i = 0; i < 12; i++) allHours.push({
    periodIdx: i, period: 'night',
    planetKey: CHALDEAN[(nightStartIdx + i) % 7],
    start: (ssLocal + i * nightHLen) % 24,
    end:   (ssLocal + (i+1) * nightHLen) % 24,
  });

  // Find current hour (handle midnight crossover)
  let current = allHours.find(h => {
    if (h.start <= h.end) return nowLocal >= h.start && nowLocal < h.end;
    return nowLocal >= h.start || nowLocal < h.end;
  });
  if (!current) current = allHours[0];

  const dayHours  = allHours.filter(h => h.period === 'day');
  const nightHours = allHours.filter(h => h.period === 'night');
  const periodHours = current.period === 'day' ? dayHours : nightHours;

  return {
    planet:      current.planetKey,
    meta:        PLANET_META[current.planetKey],
    hourNum:     current.periodIdx,
    hourStart:   current.start,
    hourEnd:     current.end,
    hours:       periodHours.map(h => h.planetKey),
    isDay:       current.period === 'day',
    dayRuler:    CHALDEAN[dayRulerIdx],
    srLocal, ssLocal,
  };
}

function renderPlanetaryHour(lat, lng) {
  const ph = getPlanetaryHour(lat, lng);
  if (!ph) return;
  const m = ph.meta;

  document.getElementById('ph-planet-name').textContent = m.symbol + ' ' + m.name + ' Hour';
  document.getElementById('ph-planet-name').style.color = m.color;

  const clock = document.getElementById('ph-clock');
  clock.innerHTML = '';
  for (let i = 0; i < 12; i++) {
    const seg = document.createElement('div');
    const pm = PLANET_META[ph.hours[i]];
    if (i < ph.hourNum) {
      seg.className = 'ph-segment filled';
      seg.style.background = pm.color;
      seg.style.opacity = '0.4';
    } else if (i === ph.hourNum) {
      seg.className = 'ph-segment current';
      seg.style.background = m.color;
      seg.style.boxShadow = '0 0 6px ' + m.color;
    } else {
      seg.className = 'ph-segment';
    }
    clock.appendChild(seg);
  }

  document.getElementById('ph-bonuses').innerHTML = m.bonuses.map(b =>
    `<span class="ph-bonus" style="border-color:${m.color};color:${m.color}">${b}</span>`
  ).join('');

  document.getElementById('ph-time-range').textContent =
    fmtHour(ph.hourStart) + ' – ' + fmtHour(ph.hourEnd) +
    ' · ' + (ph.isDay ? 'Day' : 'Night') + ' Hour ' + (ph.hourNum + 1) + '/12';

  updateDominantPill(ph.planet, ph.meta.resIndex);
  return ph;
}

function updateDominantPill(planet, resIdx) {
  document.querySelectorAll('.resource-pill').forEach((p, i) => {
    p.classList.toggle('dominant', i === resIdx);
  });
  // Boost rate: dominant planet gets 1.5× rate during its hour
  rates.forEach((_, i) => {
    baseRates[i] = BASE_RATES[i];
  });
  rates[resIdx] = BASE_RATES[resIdx] * 1.5;
}

function startPlanetaryHourEngine(lat, lng) {
  phLat = lat; phLng = lng;
  renderPlanetaryHour(lat, lng);
  if (!phInterval) {
    phInterval = setInterval(() => renderPlanetaryHour(phLat, phLng), 30000);
  }
}

function startResourceTick() {
  updateCaps();
  setInterval(() => {
    updateCaps();
    for (let i = 0; i < 7; i++) {
      const r = effectiveRate(i);
      values[i] = Math.min(resCaps[i], values[i] + r / 3600);
      if (pills[i]) {
        pills[i].textContent = Math.floor(values[i]);
        // Visual: dim when near cap
        const pill = pills[i].closest('.resource-pill');
        if (pill) pill.style.opacity = values[i] >= resCaps[i] * 0.97 ? '0.55' : '1';
      }
    }
    // Update rate display
    updateRateDisplay();
    // Research tick (every minute = 60 ticks)
    _resTick = (_resTick||0) + 1;
    if (_resTick % 60 === 0) researchTick();
  }, 1000);
}

function updateRateDisplay() {
  document.querySelectorAll('.resource-pill .res-rate').forEach((el, i) => {
    const r = effectiveRate(i);
    const atCap = values[i] >= resCaps[i] * 0.97;
    el.textContent = atCap ? 'full' : '+' + (r >= 1 ? Math.round(r) : r.toFixed(1)) + '/h';
    el.style.color = atCap ? 'var(--text-secondary)' : '';
  });
}

function updateCaps() {
  // Scriptorium/other buildings don't affect caps — altar and dormitorium do
  const altarLv = _lairData?.buildings?.altar || 1;
  const dormLv  = _lairData?.buildings?.dormitorium || 1;
  for (let i = 0; i < 7; i++) {
    resCaps[i] = Math.round(BASE_CAPS[i] * (1 + (altarLv - 1) * 0.3));
  }
}

function getActiveTarotEffects() {
  const now = Date.now();
  tarotEffects = tarotEffects.filter(e => e.until > now);
  return tarotEffects;
}

function effectiveRate(i) {
  // Base rate × planetary bonus × tarot bonus
  let r = rates[i];
  getActiveTarotEffects().forEach(e => {
    if (e.type === 'rate' && e.resIdx === i) r *= e.mult;
    if (e.type === 'allRates') r *= e.mult;
  });
  return r;
}

function researchRateBonus() {
  // Returns multiplier on research progress per tick
  let m = 1;
  getActiveTarotEffects().forEach(e => {
    if (e.type === 'research') m *= e.mult;
  });
  return m;
}

function stressModifier() {
  // Returns additive modifier to stress gain/loss per tick
  let mod = 0;
  getActiveTarotEffects().forEach(e => {
    if (e.type === 'stress') mod += e.value;
  });
  return mod;
}

async function seedWorldDataIfEmpty() {
  // Seed /world/recipes, /world/classes, /world/creatures, /world/buildings if not present
  try {
    const check = await fetch(`${FB_URL}/world/seeded.json?cb=` + Date.now());
    const val = await check.json();
    if (val === true) return; // already seeded
    // Seed recipes
    await fetch(`${FB_URL}/world/recipes.json`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(RECIPES)
    });
    // Seed sample world events
    const sampleEvents = {
      random: {
        'evt-writhing': { type:'combat', title:'The Writhing Threshold', desc:'Something has nested in the third sub-level. The seals weaken from inside.', dlat:0.0018, dlng:0.0025, reward:'☉ 50 Solar · ♂ 30 Martial', actionText:'You descend into the passage.' },
        'evt-confluence': { type:'gather', title:'Lunar Confluence', desc:'Lunar essence pools here during the Moon\'s planetary hour. Stand here then.', dlat:0.0010, dlng:-0.0030, reward:'☽ ×3 Income during Moon Hour', actionText:'You mark the location in your memory.' },
        'evt-acolyte': { type:'recruit', title:'Potential Acolyte', desc:'A figure lingers near the old fountain, marked by something unseen.', dlat:-0.0005, dlng:0.0035, actionText:'You approach carefully.' },
      },
      dm: {}
    };
    await fetch(`${FB_URL}/world/events.json`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(sampleEvents)
    });
    // Seed default buildings
    const defaultBuildings = {
      'scriptorium':      { name:'The Scriptorium',   icon:'†', desc:'Research grimoires. Unlock new skills and esoteric knowledge.',         maxLevel:3, upgradeCost:[200,0,100,0,50,0,0],   effects:['Lv1: Research speed +20%','Lv2: +40%, unlock advanced codex','Lv3: +60%, unlock lost texts'] },
      'alchemical-forge': { name:'Alchemical Forge',  icon:'⚗', desc:'Craft equipment and consumables from gathered essences.',                 maxLevel:3, upgradeCost:[150,0,0,200,50,0,0],   effects:['Lv1: Unlock basic recipes','Lv2: Unlock weapons & armour','Lv3: Unlock Grand Sigils'] },
      'dormitorium':      { name:'Dormitorium',        icon:'◻', desc:'Acolytes recover Stress here. Haunted dreams may yield visions.',         maxLevel:3, upgradeCost:[100,150,0,0,0,100,0], effects:['Lv1: -10 Stress/cycle','Lv2: -20 Stress/cycle, chance of vision','Lv3: -30 Stress/cycle, vision always'] },
      'altar':            { name:'The Altar',          icon:'◈', desc:'Perform planetary rites. Empowers resource gathering by hour.',           maxLevel:3, upgradeCost:[0,0,200,0,100,0,150], effects:['Lv1: Rite slots x1','Lv2: Rite slots x2','Lv3: Rite slots x3, Grand Conjuration unlocked'] },
      'scrying-chamber':  { name:'Scrying Chamber',   icon:'◎', desc:'See further on the field map. Reveal hidden encounters.',                 maxLevel:2, upgradeCost:[0,200,0,0,0,0,300],   effects:['Lv1: Map radius +50%','Lv2: Map radius x2, hidden encounters visible'] },
      'ossuary':          { name:'Ossuary',            icon:'☽', desc:'Extract Saturnine essence from the ancient dead within the walls.',       maxLevel:2, upgradeCost:[0,0,0,0,300,0,0],     effects:['Lv1: +2 Saturnine/h','Lv2: +5 Saturnine/h, unlock bone-craft recipes'] },
    };
    await fetch(`${FB_URL}/world/buildings.json`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(defaultBuildings)
    });
    // Seed default acolyte classes
    const defaultClasses = {
      'hermeticist': { name:'Hermeticist', role:'Seeker of hidden correspondences', desc:'Specialises in Solar and Mercurial essence. Their Hermetic Strike scales with Cunning. At high Gnosis they unlock Grand Rites.', stats:{fortitude:10,wrath:8,intuition:14,empathy:11,endurance:9,memory:12,cunning:15,gnosis:0}, skills:['Glyph Reading','Solar Banishment','Hermetic Strike'], lore:'They read the world as a text. Everything corresponds to something else.' },
      'flagellant':  { name:'Flagellant',  role:'Front-rank brawler of the wounded', desc:'Peaks at low HP. Converts incoming Stress into Wrath. Synergises with Blight. Affliction rate is high but rarely impairs.', stats:{fortitude:16,wrath:14,intuition:7,empathy:6,endurance:15,memory:7,cunning:9,gnosis:0}, skills:['Iron Will','Self-Mortification','Punishing Strike'], lore:'Pain is the oldest rite. They have simply formalized it.' },
      'plague-scribe': { name:'Plague Scribe', role:'Back-rank Blight applicator', desc:'Applies Blight stacks and debuffs enemy resistances. Consumes Mercurial Essence. Fragile — cannot survive rank 1 or 2.', stats:{fortitude:7,wrath:9,intuition:13,empathy:8,endurance:7,memory:14,cunning:13,gnosis:0}, skills:['Ink Inscription','Virulent Scrawl','Mercurial Flux'], lore:'What is written becomes real. What is blighted rots into truth.' },
    };
    await fetch(`${FB_URL}/world/classes.json`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(defaultClasses)
    });
    // Seed default rites
    const defaultSkills = {
      'silver-crescent': { name:'Rite of the Silver Crescent', category:'rite', type:'rite',
        desc:'Offered during Lunar hours, this rite triples Lunar income for one full planetary cycle. Requires a Lunar-aligned acolyte present in the lair.',
        cost:[0,300,0,0,0,0,0], unlockCondition:'Altar Lv.1+' },
      'mercurial-tongue': { name:'Invocation of the Mercurial Tongue', category:'rite', type:'rite',
        desc:"Speed all ongoing research by 2× for the duration of Mercury's hour. Only usable during Mercury's planetary hour.",
        cost:[0,0,0,0,0,0,150], unlockCondition:"Mercury's Hour only" },
      'solar-invocation': { name:'Solar Invocation', category:'rite', type:'rite',
        desc:'Empower all Fire-type combat skills for 24 hours. Costs Solar essence proportional to the Altar level.',
        cost:[200,0,0,0,0,0,0], unlockCondition:'Altar Lv.2+' },
      'grand-conjuration': { name:'The Grand Conjuration', category:'rite', type:'rite',
        desc:'Aligns all seven planets simultaneously for 30 minutes. Effects: all resource income ×5, all combat stats +20%. Effects unknown in full.',
        cost:[500,500,300,300,200,300,300], unlockCondition:'[LOCKED] — Complete the Third Seal research' },
    };
    await fetch(`${FB_URL}/world/skills.json`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(defaultSkills)
    });
    await fetch(`${FB_URL}/world/seeded.json`, {
      method:'PUT', headers:{'Content-Type':'application/json'}, body:'true'
    });
  } catch(e) {}
}

function checkIdentity() {
  playerName = localStorage.getItem('llair_name') || '';
  playerCoven = localStorage.getItem('llair_coven') || '';
  if (!playerName) {
    document.getElementById('identity-modal').classList.add('open');
    return false;
  }
  return true;
}

function saveIdentity() {
  // Legacy shim — called if someone skips to finish directly
  ccFinish();
}

async function ccStep2() {
  const n = document.getElementById('identity-name').value.trim();
  if (!n) { toast('You must name yourself before descending.'); return; }
  _ccData.name  = n;
  _ccData.coven = document.getElementById('identity-coven').value.trim() || 'The Unsanctified';

  document.getElementById('cc-step-1').style.display = 'none';
  document.getElementById('cc-step-2').style.display = '';

  // Load classes from Firebase
  const grid = document.getElementById('cc-class-grid');
  grid.innerHTML = '<div style="font-family:var(--ff-body);font-style:italic;font-size:0.9rem;color:var(--text-secondary);">Loading classes…</div>';
  try {
    const classes = await fetch(`${FB_URL}/world/classes.json?cb=`+Date.now()).then(r=>r.json());
    if (!classes || classes.error) throw new Error('no classes');
    // Store all class data for progression viewer
    _ccAllClasses = classes;
    grid.innerHTML = Object.entries(classes).map(([key, cls]) => {
      const STAT_EL = {fortitude:'Fire',wrath:'Fire',intuition:'Water',empathy:'Water',endurance:'Earth',memory:'Earth',cunning:'Air',speed:'Air',gnosis:'Aether'};
      const STAT_COL = {fortitude:'#c43030',wrath:'#c43030',intuition:'#4a7a8b',empathy:'#4a7a8b',endurance:'#8b7355',memory:'#8b7355',cunning:'#6b9ac4',speed:'#6b9ac4',gnosis:'#3d3daa'};
      const statLine = cls.stats
        ? Object.entries(cls.stats).map(([s,v]) =>
            `<span style="color:${STAT_COL[s]||'var(--text-secondary)'}">${s.slice(0,3).toUpperCase()} ${v}</span>`).join('')
        : '';
      // Build progression preview (level 1–5 shown inline)
      const bonuses = cls.levelUpBonuses
        ? (Array.isArray(cls.levelUpBonuses) ? cls.levelUpBonuses : Object.values(cls.levelUpBonuses))
            .sort((a,b)=>a.level-b.level)
        : [];
      const progLines = bonuses.slice(0,8).map(b => {
        const gains = Object.entries(b.statGains||{}).map(([s,v])=>`${s.slice(0,3).toUpperCase()}+${v}`).join(' ');
        const sk = b.skillKey ? ` · Unlocks: ${b.skillKey}` : '';
        return `<div style="display:flex;gap:0.5rem;padding:0.2rem 0;border-top:1px solid var(--border);">
          <span style="font-family:var(--ff-heading);font-size:0.52rem;color:var(--text-accent);min-width:28px;">Lv ${b.level}</span>
          <span style="font-family:var(--ff-heading);font-size:0.52rem;color:var(--text-secondary);">${gains}${sk}</span>
        </div>`;
      }).join('');
      const specs = cls.specializations
        ? (Array.isArray(cls.specializations) ? cls.specializations : Object.values(cls.specializations))
        : [];
      const specLines = specs.map(s =>
        `<div style="padding:0.25rem 0;border-top:1px solid var(--border);">
          <span style="font-family:var(--ff-heading);font-size:0.52rem;color:var(--viridian-bright);">Path · Lv${s.level}: ${s.name}</span>
          ${s.desc ? `<div style="font-family:var(--ff-body);font-style:italic;font-size:0.78rem;color:var(--text-secondary);line-height:1.4;">${s.desc}</div>` : ''}
        </div>`
      ).join('');
      return `<div class="cc-class-card" id="cc-cls-${key}" onclick="ccPickClass('${key}')">
        <div class="cc-class-name">${cls.name||key}</div>
        <div class="cc-class-role">${cls.role||''}</div>
        <div class="cc-class-stats">${statLine}</div>
        ${cls.desc ? `<div style="font-family:var(--ff-body);font-style:italic;font-size:0.82rem;color:var(--text-secondary);margin-top:0.4rem;line-height:1.5;">${cls.desc}</div>` : ''}
        ${bonuses.length ? `<div style="margin-top:0.6rem;"><div style="font-family:var(--ff-heading);font-size:0.5rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-secondary);margin-bottom:0.2rem;">Level Progression</div>${progLines}</div>` : ''}
        ${specs.length ? `<div style="margin-top:0.5rem;"><div style="font-family:var(--ff-heading);font-size:0.5rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-secondary);margin-bottom:0.2rem;">Specializations</div>${specLines}</div>` : ''}
      </div>`;
    }).join('');
  } catch(e) {
    // Fallback to hardcoded classes
    const fallback = {
      'hermeticist':  { name:'Hermeticist',  role:'Seeker of hidden correspondences', stats:{fortitude:8,wrath:8,intuition:14,empathy:10,endurance:9,memory:13,cunning:15,gnosis:3,speed:10} },
      'flagellant':   { name:'Flagellant',   role:'Body as instrument, will as fuel',  stats:{fortitude:14,wrath:12,intuition:8,empathy:6,endurance:13,memory:7,cunning:9,gnosis:0,speed:9} },
      'plague-scribe':{ name:'Plague-Scribe',role:'The archivist of ruin',             stats:{fortitude:7,wrath:6,intuition:13,empathy:9,endurance:8,memory:15,cunning:14,gnosis:2,speed:8} },
    };
    grid.innerHTML = Object.entries(fallback).map(([key, cls]) =>
      `<div class="cc-class-card" id="cc-cls-${key}" onclick="ccPickClass('${key}')">
        <div class="cc-class-name">${cls.name}</div>
        <div class="cc-class-role">${cls.role}</div>
      </div>`
    ).join('');
  }
}

async function ccStep3() {
  if (!_ccData.classKey) { toast('Choose a class first.'); return; }
  document.getElementById('cc-step-2').style.display = 'none';
  document.getElementById('cc-step-3').style.display = '';

  // Load class stats from Firebase for base values
  let baseStats = {fortitude:10,wrath:8,intuition:12,empathy:10,endurance:10,memory:8,cunning:12,gnosis:0,speed:10};
  try {
    const cls = await fetch(`${FB_URL}/world/classes/${_ccData.classKey}.json?cb=`+Date.now()).then(r=>r.json());
    if (cls && !cls.error) {
      _ccData.classData = cls;
      if (cls.stats) baseStats = { ...baseStats, ...cls.stats };
    }
  } catch(e) {}

  _ccData.stats = { ...baseStats };
  _ccData.basePoints = 15;
  ccRenderStatGrid();
}

async function ccStep4() {
  document.getElementById('cc-step-3').style.display = 'none';
  document.getElementById('cc-step-4').style.display = '';

  await loadWorldTraits();
  ccRenderTraits();
}

function ccRenderStatGrid() {
  const STAT_LABELS = {
    fortitude:'Fortitude', wrath:'Wrath', intuition:'Intuition',
    empathy:'Empathy', endurance:'Endurance', memory:'Memory',
    cunning:'Cunning', gnosis:'Gnosis', speed:'Speed'
  };
  const STAT_COLORS = {
    fortitude:'#c43030', wrath:'#c43030', intuition:'#4a7a8b',
    empathy:'#4a7a8b', endurance:'#8b7355', memory:'#8b7355',
    cunning:'#6b9ac4', speed:'#6b9ac4', gnosis:'#3d3daa'
  };
  const totalStatPoints = Object.values(_ccData.stats).reduce((a,b)=>a+b,0);
  const baseStatTotal = Object.values(_ccData.classData?.stats||{}).reduce((a,b)=>a+b,0);
  const spent = Math.max(0, totalStatPoints - baseStatTotal);
  const traitCost = (_ccData.traits||[]).reduce((sum,t) => sum + ((_worldTraits[t]?.cost)||0), 0);
  const remaining = _ccData.basePoints - spent - traitCost;

  const ptColor = remaining < 0 ? 'var(--crimson-bright)' : remaining === 0 ? 'var(--viridian-bright)' : 'var(--gold)';
  document.getElementById('cc-points-label').innerHTML =
    `Points to spend: <strong style="font-size:1.2em;color:${ptColor}">${remaining}</strong>`
    + (remaining < 0 ? ' <span style="color:var(--crimson-bright);font-size:0.85em;">— over budget, remove traits or reduce stats</span>' : '')
    + (remaining === 0 ? ' <span style="color:var(--viridian-bright);font-size:0.85em;">— fully allocated</span>' : '');

  document.getElementById('cc-stat-grid').innerHTML = Object.entries(STAT_LABELS).map(([key, label]) => {
    const val = _ccData.stats[key] || 0;
    return `<div class="cc-stat-row">
      <span class="cc-stat-name" style="color:${STAT_COLORS[key]}">${label}</span>
      <div class="cc-stat-controls">
        <button class="cc-stat-btn" onclick="ccAdjStat('${key}',-1)">−</button>
        <span class="cc-stat-val">${val}</span>
        <button class="cc-stat-btn" onclick="ccAdjStat('${key}',+1)">+</button>
      </div>
    </div>`;
  }).join('');
}

function ccAdjStat(key, delta) {
  const spent = Object.values(_ccData.stats).reduce((a,b)=>a+b,0)
    - Object.values(_ccData.classData?.stats||{}).reduce((a,b)=>a+b,0) || 0;
  const traitCost = (_ccData.traits||[]).reduce((sum,t) => sum+((_worldTraits[t]?.cost)||0),0);
  const remaining = _ccData.basePoints - spent - traitCost;
  const cur = _ccData.stats[key] || 0;
  if (delta > 0 && remaining <= 0) { toast('No points remaining.'); return; }
  if (delta < 0 && cur <= 1) { toast('Minimum value is 1.'); return; }
  _ccData.stats[key] = cur + delta;
  ccRenderStatGrid();
}

function ccToggleTrait(key) {
  const idx = (_ccData.traits||[]).indexOf(key);
  const t = _worldTraits[key] || {};
  const traitCost = (_ccData.traits||[]).reduce((sum,k)=>sum+((_worldTraits[k]?.cost)||0),0);
  if (idx >= 0) {
    _ccData.traits.splice(idx, 1);
  } else {
    // Check: adding this trait must not push total trait cost past basePoints
    const baseStatTotal = Object.values(_ccData.classData?.stats||{}).reduce((a,b)=>a+b,0);
    const statSpend = Math.max(0, Object.values(_ccData.stats||{}).reduce((a,b)=>a+b,0) - baseStatTotal);
    const newTraitTotal = traitCost + (t.cost||0);
    if (newTraitTotal + statSpend > _ccData.basePoints) { toast('Not enough points. Reduce stats or remove other traits first.'); return; }
    if (!_ccData.traits) _ccData.traits = [];
    _ccData.traits.push(key);
  }
  ccRenderTraits();
  // Also update stat grid budget display
  ccRenderStatGrid();
}

function ccRenderTraits() {
  const traitCost = (_ccData.traits||[]).reduce((sum,t)=>sum+((_worldTraits[t]?.cost)||0),0);
  const totalBudget = _ccData.basePoints - traitCost;
  const budgetEl = document.getElementById('cc-trait-budget');
  budgetEl.innerHTML = `<strong style="color:${totalBudget<0?'var(--crimson-bright)':totalBudget<3?'var(--amber-bright)':'var(--viridian-bright)'}">${totalBudget}</strong> points remaining after traits`;

  // Only use Firebase traits — no fallbacks
  const traits = _worldTraits;

  if (!Object.keys(traits).length) {
    document.getElementById('cc-trait-grid').innerHTML =
      `<div style="font-family:var(--ff-body);font-style:italic;font-size:0.95rem;color:var(--text-secondary);padding:0.8rem 0;line-height:1.7;">
        No traits defined yet. The DM can add traits from the Traits page in dm.html.<br>
        You can continue without choosing any traits.
      </div>`;
    return;
  }

  document.getElementById('cc-trait-grid').innerHTML = Object.entries(traits).map(([key, t]) => {
    const selected = (_ccData.traits||[]).includes(key);
    const isNeg = t.negative || (t.cost||0) <= 0;
    const costLabel = (t.cost||0) > 0 ? `-${t.cost} pts` : (t.cost||0) < 0 ? `+${Math.abs(t.cost)} pts` : '0 pts';
    const costCls = (t.cost||0) > 0 ? 'pos' : 'neg';
    const effectLine = t.effects ? Object.entries(t.effects)
      .filter(([,v])=>typeof v==='number')
      .map(([k,v])=>`${k} ${v>0?'+'+v:v}`)
      .join(', ') : '';
    return `<div class="cc-trait-card${selected?' selected':''}${isNeg&&selected?' negative':''}" onclick="ccToggleTrait('${key}')">
      <span class="cc-trait-check">${selected?'◆':'◇'}</span>
      <div class="cc-trait-body">
        <div class="cc-trait-name">${t.name||key}
          <span class="cc-trait-cost ${costCls}">${costLabel}</span>
        </div>
        <div class="cc-trait-desc">${t.desc||''}</div>
        ${effectLine?`<div class="cc-trait-effect">${effectLine}</div>`:''}
      </div>
    </div>`;
  }).join('');
}

function ccBack(toStep) {
  for (let i=1; i<=4; i++) {
    const el = document.getElementById('cc-step-'+i);
    if (el) el.style.display = i===toStep ? '' : 'none';
  }
}

function ccFinish() {
  const n = _ccData.name || document.getElementById('identity-name')?.value.trim();
  if (!n) { toast('Enter your name first.'); ccBack(1); return; }
  if (!_ccData.classKey) { toast('Choose a class first.'); ccBack(2); return; }

  playerName = n;
  playerCoven = _ccData.coven || 'The Unsanctified';
  localStorage.setItem('llair_name', playerName);
  localStorage.setItem('llair_coven', playerCoven);

  // Apply trait stat effects
  const finalStats = { ..._ccData.stats };
  (_ccData.traits||[]).forEach(key => {
    const t = (_worldTraits[key]) || {};
    if (t.effects) Object.entries(t.effects).forEach(([s,v]) => {
      if (typeof v === 'number' && finalStats[s] !== undefined) {
        finalStats[s] = Math.max(1, (finalStats[s]||0) + v);
      }
    });
  });

  // Set up character data
  _characterData = {
    name: playerName, coven: playerCoven,
    class: _ccData.classData?.name || _ccData.classKey,
    classKey: _ccData.classKey,
    level: 1, xp: 0,
    stats: finalStats,
    traits: _ccData.traits || [],
    skills: [],
    inventory: [],
    stress: 0,
  };

  document.getElementById('identity-modal').classList.remove('open');
  refreshCharacterBar();
  persistState().catch(()=>{});
  toast('Welcome, ' + playerName + '.');
  publishPresence();
}

function ccPickClass(key) {
  document.querySelectorAll('.cc-class-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('cc-cls-'+key)?.classList.add('selected');
  _ccData.classKey = key;
  // Store class data from Firebase or fallback
  const cardEl = document.getElementById('cc-cls-'+key);
  _ccData.classData = { name: cardEl?.querySelector('.cc-class-name')?.textContent || key };
}

async function loadWorldTraits() {
  try {
    const d = await fetch(`${FB_URL}/world/traits.json?cb=`+Date.now()).then(r=>r.json());
    if (d && !d.error) _worldTraits = d;
  } catch(e) {}
}
