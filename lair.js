// ════════════════════════════════════════════════════════════
// LAIR
// ════════════════════════════════════════════════════════════

function renderLairBuildings(playerBuildings) {
  const grid = document.getElementById('lair-building-grid') || document.querySelector('#panel-lair .building-grid');
  if (!grid || !_worldBuildings) return;
  // Player save uses 'forge' but world key is 'alchemical-forge' — normalise both ways
  const nb = Object.assign({}, playerBuildings || {});
  if (nb.forge && !nb['alchemical-forge'])       nb['alchemical-forge'] = nb.forge;
  if (nb['alchemical-forge'] && !nb.forge)       nb.forge = nb['alchemical-forge'];
  grid.innerHTML = Object.entries(_worldBuildings).map(([key, b]) => {
    const lvl    = nb[key] || 0;
    const maxLvl = b.maxLevel || 3;
    const locked = lvl === 0;
    const isForge = key === 'alchemical-forge' || key === 'forge';
    const isScriptorium = key === 'scriptorium';
    const isAltar = key === 'altar';
    const isScrying = key === 'scrying-chamber';
    const isOssuary = key === 'ossuary';
    const clickFn = !locked ? (isForge ? 'openForge()' : isScriptorium ? 'openScriptorium()' : isAltar ? "switchTab('arcana')" : isScrying ? 'openScryingChamber()' : isOssuary ? 'openOssuary()' : '') : '';
    const clickAttr = clickFn ? `onclick="${clickFn}" style="cursor:pointer"` : '';
    // Build upgrade cost display
    const upgradeCost = b.upgradeCost && lvl < maxLvl && b.upgradeCost[lvl] ? b.upgradeCost[lvl] : null;
    const upgradeEffect = b.effects && b.effects[lvl] ? b.effects[lvl] : null;
    return `<div class="building-card ${locked?'locked':''}" ${clickAttr}>
      <span class="building-level">${locked ? 'Locked' : 'Lv. '+lvl+' / '+maxLvl}</span>
      <div class="building-name">${b.name || key}</div>
      <p class="building-desc">${b.desc || ''}</p>
      ${!locked&&upgradeEffect?`<div style="font-family:var(--ff-body);font-style:italic;font-size:0.72rem;color:var(--viridian-bright);margin-top:0.25rem;line-height:1.4;">${upgradeEffect}</div>`:''}
      ${!locked&&clickFn?`<div style="font-family:var(--ff-heading);font-size:0.5rem;color:var(--text-secondary);margin-top:0.35rem;letter-spacing:0.1em;">→ Open</div>`:''}
      ${!locked&&lvl<maxLvl&&upgradeCost?`<button onclick="event.stopPropagation();upgradeBuilding('${key}',${upgradeCost})" style="margin-top:0.5rem;font-family:var(--ff-heading);font-size:0.5rem;letter-spacing:0.1em;text-transform:uppercase;padding:0.4rem 0.6rem;border:1px solid rgba(201,168,76,0.3);background:none;color:var(--gold);cursor:pointer;width:100%;">Upgrade — ${upgradeCost} ♄ Saturnine</button>`:''}
      ${locked?`<div style="font-family:var(--ff-heading);font-size:0.5rem;color:var(--text-secondary);margin-top:0.3rem;letter-spacing:0.08em;">Not yet excavated</div>`:''}
    </div>`;
  }).join('');
}

async function loadBuildingsFromFirebase() {
  const myId = getOrCreatePlayerId();
  try {
    // Fetch world buildings and player save in parallel
    const [bRes, sRes] = await Promise.all([
      fetch(`${FB_URL}/world/buildings.json?cb=` + Date.now()),
      fetch(`${FB_URL}/saves/${myId}.json?cb=` + Date.now()),
    ]);
    if (bRes.ok) {
      const d = await bRes.json();
      if (d && !d.error) _worldBuildings = d;
    }
    if (sRes.ok) {
      const s = await sRes.json();
      if (s && s.lair && Object.keys(s.lair.buildings || {}).length > 0) {
        _lairData = s.lair;
      } else if (!_lairData) {
        // No lair in save yet — use starting defaults
        _lairData = { buildings: { 'alchemical-forge':1, 'altar':1, 'dormitorium':1, 'scriptorium':1 } };
      }
    }
    // Now render — both values are guaranteed to be set (or not available)
    renderLairBuildings(_lairData?.buildings || {});
  } catch(e) {}
}

function upgradeBuilding(key, cost) {
  // Default to Saturnine (index 4) as upgrade currency — can be overridden
  const saturnineIdx = 4;
  if ((values[saturnineIdx]||0) < cost) {
    toast('Insufficient Saturnine essence. Need ' + cost + ' ♄.');
    return;
  }
  values[saturnineIdx] -= cost;
  if (!_lairData) _lairData = { buildings: {} };
  if (!_lairData.buildings) _lairData.buildings = {};
  const curLvl = _lairData.buildings[key] || 0;
  _lairData.buildings[key] = curLvl + 1;
  renderLairBuildings(_lairData.buildings);
  updateCaps();
  document.querySelectorAll('.resource-pill .res-value').forEach((el,i) => { el.textContent = Math.floor(values[i]); });
  persistState().catch(()=>{});
  toast(`${key.replace(/-/g,' ')} upgraded to Lv.${curLvl+1}.`);
}

function openScryingChamber() {
  const lv = _lairData?.buildings?.['scrying-chamber'] || 0;
  if (!lv) { toast('The Scrying Chamber has not been constructed.'); return; }
  let modal = document.getElementById('scrying-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'scrying-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:700;background:rgba(5,4,7,0.96);display:none;flex-direction:column;align-items:center;justify-content:center;padding:2rem;';
    modal.innerHTML = `<div style="max-width:360px;width:100%;background:var(--abyss);border:1px solid rgba(61,61,170,0.4);padding:2rem 1.8rem;"><div style="font-family:var(--ff-heading);font-size: 0.86rem;color:var(--indigo-bright);letter-spacing:0.06em;margin-bottom:0.5rem;">The Scrying Chamber</div><div style="font-family:var(--ff-body);font-style:italic;font-size: 0.74rem;color:var(--mist);line-height:1.7;margin-bottom:1.4rem;">A room of polished dark glass. During Lunar hours it shows further. At Level ${lv}: map radius x${lv >= 2 ? '2.0' : '1.5'}${lv >= 2 ? ' — hidden encounters become visible before you reach them' : ''}.</div><div style="background:rgba(61,61,170,0.06);border:1px solid rgba(61,61,170,0.2);padding:1rem;margin-bottom:1.2rem;"><div style="font-family:var(--ff-heading);font-size: 0.59rem;color:var(--text-secondary);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:0.4rem;">Active Effect</div><div style="font-family:var(--ff-heading);font-size: 0.86rem;color:var(--bone);">Map radius x${lv >= 2 ? '2.0' : '1.5'}</div>${lv >= 2 ? '<div style="font-family:var(--ff-heading);font-size: 0.62rem;color:var(--viridian-bright);margin-top:0.3rem;">Hidden encounters revealed</div>' : ''}</div><button onclick="scryNow()" style="font-family:var(--ff-heading);font-size: 0.59rem;letter-spacing:0.1em;text-transform:uppercase;padding:0.75rem 1.5rem;border:1px solid rgba(61,61,170,0.4);background:rgba(61,61,170,0.06);color:var(--indigo-bright);cursor:pointer;width:100%;margin-bottom:0.6rem;">Scry the Field Now (200 Lunar)</button><button onclick="document.getElementById('scrying-modal').style.display='none'" style="font-family:var(--ff-heading);font-size: 0.59rem;letter-spacing:0.1em;text-transform:uppercase;padding:0.75rem 1.5rem;border:1px solid rgba(201,168,76,0.2);background:transparent;color:var(--text-secondary);cursor:pointer;width:100%;">Return to the Lair</button></div>`;
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';
  modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
}

function openOssuary() {
  const lv = _lairData?.buildings?.ossuary || 0;
  if (!lv) { toast('The Ossuary is not yet excavated.'); return; }
  let modal = document.getElementById('ossuary-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'ossuary-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:700;background:rgba(5,4,7,0.96);display:none;flex-direction:column;align-items:center;justify-content:center;padding:2rem;';
    const rateStr = lv >= 2 ? '+5' : '+2';
    modal.innerHTML = `<div style="max-width:360px;width:100%;background:var(--abyss);border:1px solid rgba(201,168,76,0.3);padding:2rem 1.8rem;"><div style="font-family:var(--ff-heading);font-size: 0.86rem;color:var(--gold);letter-spacing:0.06em;margin-bottom:0.5rem;">The Ossuary</div><div style="font-family:var(--ff-body);font-style:italic;font-size: 0.74rem;color:var(--mist);line-height:1.7;margin-bottom:1.4rem;">The walls weep with calcified matter. Saturnine essence seeps from bones older than the structure. Level ${lv}: ${rateStr} Saturnine per hour, passively.</div><div style="background:rgba(201,168,76,0.04);border:1px solid rgba(201,168,76,0.12);padding:1rem;margin-bottom:1.2rem;"><div style="font-family:var(--ff-heading);font-size: 0.59rem;color:var(--text-secondary);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:0.6rem;">Current Yield</div><div style="font-family:var(--ff-heading);font-size: 1.02rem;color:var(--bone);">♄ ${rateStr} Saturnine / hour</div></div>${lv >= 2 ? '<div style="font-family:var(--ff-heading);font-size: 0.62rem;color:var(--viridian-bright);letter-spacing:0.08em;margin-bottom:1rem;">Bone-craft recipes available in the Forge.</div>' : '<div style="font-family:var(--ff-body);font-style:italic;font-size: 0.66rem;color:var(--text-secondary);margin-bottom:1rem;">Excavate further (300 Saturnine) to unlock bone-craft and +5/h yield.</div>'}<button onclick="document.getElementById('ossuary-modal').style.display='none'" style="font-family:var(--ff-heading);font-size: 0.59rem;letter-spacing:0.1em;text-transform:uppercase;padding:0.75rem 1.5rem;border:1px solid rgba(201,168,76,0.3);background:transparent;color:var(--gold);cursor:pointer;width:100%;">Return to the Lair</button></div>`;
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';
  modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
}

function scryNow() {
  if (values[1] < 200) { toast('200 Lunar essence required.'); return; }
  values[1] -= 200;
  document.querySelectorAll('.resource-pill .res-value').forEach((el,i) => { el.textContent = Math.floor(values[i]); });
  document.getElementById('scrying-modal').style.display = 'none';
  refreshFieldEventCards();
  if (typeof loadWorldEvents === 'function') loadWorldEvents(playerLat, playerLng);
  toast('The Chamber opens its eye. The field clears for one hour.');
}
