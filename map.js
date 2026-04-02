// ════════════════════════════════════════════════════════════
// MAP
// ════════════════════════════════════════════════════════════

function initMap(lat, lng) {
  playerLat = lat;
  playerLng = lng;

  map = L.map('leaflet-map', {
    center: [lat, lng],
    zoom: 16,
    zoomControl: false,
    attributionControl: true,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  // Leaflet 1.9.x strips onclick from popup HTML — wire buttons after popup opens
  map.on('popupopen', function(e) {
    // Wire popup button after Leaflet finishes DOM insertion
    setTimeout(function() {
      const btn = e.popup.getElement()?.querySelector('.popup-btn[data-evid]');
      if (btn && !btn._wired) {
        btn._wired = true;
        btn.addEventListener('click', function() {
          activateWorldEvent(btn.dataset.evid);
        });
      }
    }, 50);
  });

  // Player marker
  playerMarker = L.marker([lat, lng], { icon: makePlayerIcon(), zIndexOffset: 1000 }).addTo(map);

  // Load DM and random world events from Firebase
  setTimeout(() => loadWorldEvents(lat, lng), 1500);
  setInterval(() => loadWorldEvents(playerLat, playerLng), 30000);

  // Hide loading overlay
  const loading = document.getElementById('map-loading');
  loading.classList.add('hidden');
  setTimeout(() => loading.style.display = 'none', 900);

  // Watch position and update player marker AND planetary hour
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(pos => {
      const { latitude, longitude } = pos.coords;
      playerMarker.setLatLng([latitude, longitude]);
      playerLat = latitude;
      playerLng = longitude;
      document.getElementById('location-text').textContent =
        latitude.toFixed(4) + '°N ' + longitude.toFixed(4) + '°E';
      // Update planetary hour with real coordinates
      phLat = latitude;
      phLng = longitude;
      renderPlanetaryHour(latitude, longitude);
      // Republish presence with updated real GPS coords
      publishPresence();
    }, null, { enableHighAccuracy: true, maximumAge: 10000 });
  }

  toast('The city map unfolds. Your position is marked. The missions pulse.');
  startPlanetaryHourEngine(lat, lng);
  startPresenceEngine();
}

function makeIcon(type, source) {
  // source: 'dm' = DM-placed (larger, pulsing ring), 'random' = world-spawned (smaller)
  const size = source === 'dm' ? 16 : 12;
  const extra = source === 'dm' ? ' dm-placed' : '';
  return L.divIcon({
    className: '',
    html: `<div class="llair-mission ${type}${extra}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
    popupAnchor: [0, -14],
  });
}

function makePlayerIcon() {
  return L.divIcon({
    className: '',
    html: `<div class="llair-player"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

async function loadWorldEvents(lat, lng) {
  try {
    const res = await fetch(`${FB_URL}/world/events.json?cb=` + Date.now());
    if (!res.ok) return;
    const data = await res.json();
    if (!data || data.error) return;

    // DM-placed events — support both top-level lat/lng and nested location:{lat,lng}
    const dmEvts = data.dm || {};
    Object.entries(dmEvts).forEach(([id, ev]) => {
      if (!ev) return;
      const elat = ev.lat ?? ev.location?.lat;
      const elng = ev.lng ?? ev.location?.lng;
      if (!elat || !elng) return;
      if (dmMapMarkers[id]) return; // already on map
      const normEv = { ...ev, lat: elat, lng: elng, id, src: 'random' };
      const marker = L.marker([elat, elng], {
      icon: makeIcon(ev.type || 'gather', 'random')
  }).addTo(map);

marker.bindPopup(makeEventPopup(normEv), { maxWidth: 240, className: '' });

randomMapMarkers[id] = marker;
    });
    // Remove stale DM markers
    Object.keys(dmMapMarkers).forEach(id => {
      if (!dmEvts[id]) { dmMapMarkers[id].remove(); delete dmMapMarkers[id]; }
    });

    // Random world events — spawn near player if not already on map
    const randomEvts = data.random || {};
    Object.entries(randomEvts).forEach(([id, ev]) => {
      if (!ev) return;
      if (randomMapMarkers[id]) return;
      // Offset from player position using stored dlat/dlng, or absolute lat/lng
      const elat = ev.lat !== undefined ? ev.lat : lat + (ev.dlat || 0);
      const elng = ev.lng !== undefined ? ev.lng : lng + (ev.dlng || 0);
      const marker = L.marker([elat, elng], { icon: makeIcon(ev.type || 'gather', 'random') }).addTo(map);
      marker.bindPopup(makeEventPopup(ev), { maxWidth: 240, className: '' });
      randomMapMarkers[id] = marker;
    });
    Object.keys(randomMapMarkers).forEach(id => {
      if (!randomEvts[id]) { randomMapMarkers[id].remove(); delete randomMapMarkers[id]; }
    });

    // Also update the mission card list and place inbox event markers on map
    refreshFieldEventCards();
    placeInboxEventMarkers(lat, lng);

  } catch(e) {}
}

function makeEventPopup(ev) {
  const evId = 'ev_' + Math.random().toString(36).slice(2,9);
  _worldEventStore.set(evId, ev);
  const rewardHtml = ev.reward ? `<div style="margin-top:0.4rem;font-family:var(--ff-heading);font-size:0.64rem;color:#c9a84c;letter-spacing:0.08em;">${ev.reward}</div>` : '';
  return `<div class="popup-title">${ev.title || ev.body || 'Unknown Event'}</div>
  <div style="font-family:var(--ff-body);font-style:italic;font-size:0.78rem;color:var(--pale);margin:0.3rem 0;">${ev.desc || ev.body || ''}</div>
  ${rewardHtml}
  <button class="popup-btn" data-evid="${evId}">Investigate</button>`;
}

function activateWorldEvent(evId) {
  const ev = _worldEventStore.get(evId);
  if (!ev) { toast('Event data not found — try refreshing the map.'); return; }
  document.querySelector('.leaflet-popup-close-button')?.click();
  runEventResolution(ev, evId);
}

function handleWorldEvent(evJson) {
  // legacy — should not be called anymore but kept as safety net
  try {
    const ev = typeof evJson === 'string' ? JSON.parse(evJson) : evJson;
    if (ev.type === 'combat') { showCombat(ev); return; }
    toast(ev.actionText || 'You approach the site.');
  } catch(e) { toast('You approach the site.'); }
}

async function runEventResolution(ev, evId) {
  // 1. Skill checks
  if (ev.skillChecks && ev.skillChecks.length) {
    const passed = await runSkillChecks(ev.skillChecks);
    if (!passed) {
      applyCheckFailurePenalty(ev);
      deleteWorldEventAfterResolve(ev, evId);
      return;
    }
  }

  // 2. Combat
  if (ev.type === 'combat' || (ev.enemies && ev.enemies.length)) {
    showCombat(ev).catch(err => {
      console.error('Combat error:', err);
      toast('Combat failed to load: ' + (err.message || err));
      switchTab('field');
    }).then(() => deleteWorldEventAfterResolve(ev, evId));
    return;
  }

  // 3. Recruit
  if (ev.type === 'recruit') {
    showRecruitTab(ev);
    deleteWorldEventAfterResolve(ev, evId);
    return;
  }

  // 4. Gather / story — apply reward and toast
  if (ev.rewardRes) applyDmEventReward(ev);
  toast(ev.actionText || 'The moment settles into memory. Something has shifted.');
  deleteWorldEventAfterResolve(ev, evId);
}

async function deleteWorldEventAfterResolve(ev, evId) {
  if (!ev) return;
  try {
    if (ev.src === 'inbox' || ev.src === 'player') {
      // Personal inbox event — mark read (don't delete, preserve history)
      const myId = getOrCreatePlayerId();
      if (ev.id) {
        await fetch(`${FB_URL}/events/${myId}/${ev.id}/read.json`, {
          method:'PUT', headers:{'Content-Type':'application/json'}, body:'"resolved"'
        }).catch(() => {});
      }
    } else if (ev.id) {
      // Shared world event — delete from Firebase (shared events don't need history)
      const src = ev.src || 'random';
      await fetch(`${FB_URL}/world/events/${src}/${ev.id}.json`, { method: 'DELETE' }).catch(() => {});
      removeEventMarkerById(ev.id);
    }
    // Remove from active field list (not from journal)
    removeEventFromFieldList(ev.id);
    if (evId) _worldEventStore.delete(evId);
  } catch(e) {}
}

function flyToEventLocation(lat, lng) {
  switchTab('field');
  setTimeout(() => {
    if (!map) return;
    map.invalidateSize();
    map.flyTo([lat, lng], 16, { animate: true, duration: 1.2 });
    // Temporary gold highlight ring so the spot is obvious
    const ring = L.circleMarker([lat, lng], {
      radius: 20, color: '#c9a84c', weight: 2,
      fillColor: '#c9a84c', fillOpacity: 0.1,
    }).addTo(map);
    setTimeout(() => ring.remove(), 9000);
  }, 150);
}

async function refreshFieldEventCards() {
try {
  const myId = getOrCreatePlayerId();

  const [worldRes, inboxRes] = await Promise.all([
    fetch(`${FB_URL}/world/events.json?cb=` + Date.now()),
    fetch(`${FB_URL}/events/${myId}.json?cb=`  + Date.now()),
  ]);

  const worldData = worldRes.ok ? await worldRes.json() : {};
  const inboxData = inboxRes.ok ? await inboxRes.json() : {};

  // Normalize WORLD events (same format as map)
  const normWorld = Object.entries(worldData || {}).map(([id, ev]) => {
    const lat = Number(ev.lat ?? ev.latitude ?? ev.coords?.lat);
    const lng = Number(ev.lng ?? ev.longitude ?? ev.coords?.lng);

    return {
      ...ev,
      id,
      src: 'dm',
      lat,
      lng,
      title: ev.title || ev.body || 'Unknown Event',
      desc: ev.desc || ev.body || ''
    };
  }).filter(ev => !isNaN(ev.lat) && !isNaN(ev.lng));

  // Normalize PLAYER inbox events
  const normInbox = Object.entries(inboxData || {}).map(([id, ev]) => ({
    ...ev,
    id,
    src: 'player',
    title: ev.title || ev.body || 'Unknown Event',
    desc: ev.desc || ev.body || ''
  }));

  // Optional cache
  _cachedWorldEvents = normWorld;

  // Pass CLEAN data to renderer
  renderFieldEventCards(normWorld, normInbox);

} catch (e) {
  console.error("refreshFieldEventCards error:", e);
}
}

function renderFieldEventCards(data, inboxData) {
  const container = document.getElementById('field-events-list');
  if (!container) return;
  const TYPE_COLOR = {
    combat:  'var(--crimson-bright)',
    story:   'var(--indigo-bright)',
    gather:  'var(--viridian-bright)',
    recruit: 'var(--amber-bright)',
  };
  const TYPE_SIGIL = { combat:'⚠', story:'✦', gather:'☽', recruit:'⬡' };

  // World events (shared map)
  const worldEvts = [
    ...Object.entries((data?.dm     || {})).map(([id,ev]) => ({...ev, id, src:'dm'})),
    ...Object.entries((data?.random || {})).map(([id,ev]) => ({...ev, id, src:'random'})),
  ].filter(ev => ev && ev.title);

  // Personal inbox DM events — all active (not yet resolved or declined)
  const inboxEvts = inboxData
    ? Object.entries(inboxData)
        .filter(([id, ev]) => ev && ev.title && ev.read !== 'resolved' && ev.read !== 'declined' && ev.read !== 'combat' && ev.read !== 'failed' && ev.read !== true)
        .map(([id, ev]) => ({
          ...ev, id, src: 'inbox',
          lat: ev.lat ?? ev.location?.lat,
          lng: ev.lng ?? ev.location?.lng,
        }))
    : [];

  const allEvts = [...worldEvts, ...inboxEvts];

  if (!allEvts.length) {
    container.innerHTML = '<div style="font-family:var(--ff-body);font-style:italic;font-size: 0.82rem;color:var(--text-secondary);padding:0.5rem 0;">The field is quiet. The ether holds its breath.</div>';
    return;
  }

  const lbl = document.getElementById('field-events-label');
  if (lbl) lbl.textContent = `Obligations & Omens (${allEvts.length})`;

  container.innerHTML = allEvts.map(ev => {
    const type  = ev.type || 'story';
    const color = TYPE_COLOR[type] || 'var(--gold)';
    const sigil = TYPE_SIGIL[type] || '✦';
    const isDm  = ev.src === 'dm' || ev.src === 'inbox';
    const badge = isDm
      ? `<span class="mission-badge" style="color:var(--dm-bright,#a855f7);font-size: 0.49rem;">DM</span>`
      : `<span class="mission-badge ${type}">${type}</span>`;
    const rewardLine = ev.reward
      ? `<span style="color:var(--gold-dim);font-family:var(--ff-heading);font-size: 0.49rem;letter-spacing:0.06em;">↳ ${ev.reward}</span>`
      : '';
    const checkLine = ev.skillChecks?.length
      ? `<span style="color:var(--viridian-bright);font-family:var(--ff-heading);font-size: 0.49rem;letter-spacing:0.06em;">⌛ ${ev.skillChecks.length} check${ev.skillChecks.length > 1 ? 's' : ''}</span>`
      : '';
    const combatLine = ev.enemies?.length
      ? `<span style="color:var(--crimson-bright);font-family:var(--ff-heading);font-size: 0.49rem;letter-spacing:0.06em;">⚔ Combat</span>`
      : '';
    const evLat = ev.lat ?? ev.location?.lat;
    const evLng = ev.lng ?? ev.location?.lng;
    const coordLine = evLat
      ? `<span style="font-family:var(--ff-heading);font-size:0.49rem;color:var(--gold-dim);cursor:pointer;"
           onclick="event.stopPropagation();flyToEventLocation(${evLat},${evLng})">◎ ${Number(evLat).toFixed(4)}, ${Number(evLng).toFixed(4)}</span>`
      : '';
    const evId = 'ev_' + Math.random().toString(36).slice(2,9);
    _worldEventStore.set(evId, ev);
    return `<div class="mission-card" style="--mission-color:${color}" data-evid="${evId}">
      <div class="mission-header">
        <span class="mission-title">${sigil} ${ev.title}</span>
        ${badge}
      </div>
      <p class="mission-desc">${ev.desc || ''}</p>
      <div class="mission-meta" style="display:flex;flex-wrap:wrap;gap:0.35rem;align-items:center;">
        ${rewardLine}${checkLine}${combatLine}${coordLine}
      </div>
    </div>`;
  }).join('');

  container.querySelectorAll('[data-evid]').forEach(card => {
    card.addEventListener('click', () => activateWorldEvent(card.dataset.evid));
  });
}

function toggleMapLegend() {
  const panel = document.getElementById('map-legend-panel');
  const btn   = document.getElementById('legend-toggle');
  if (!panel) return;
  const visible = panel.style.display !== 'none';
  panel.style.display = visible ? 'none' : 'flex';
  panel.style.flexDirection = 'column';
  if (btn) btn.style.borderColor = visible ? 'rgba(201,168,76,0.3)' : 'var(--gold)';
}

async function scanNearbyPlayers() {
  if (!map) return;
  const myName = playerName || localStorage.getItem('llair_name') || '';
  const myId = getOrCreatePlayerId();
  try {
    const res = await fetch(`${FB_URL}/players.json`);
    if (!res.ok) return;
    const all = await res.json();
    if (!all) return;
    if (all.error) { console.error('Firebase exchanges error:', all.error); return; }
    const now = Date.now();
    nearbyPlayers = {};

    // Remove stale other-player markers
    Object.keys(otherPlayerMarkers).forEach(id => {
      if (!all[id] || id === myId) { otherPlayerMarkers[id]?.remove(); delete otherPlayerMarkers[id]; }
    });

    Object.entries(all).forEach(([id, data]) => {
      if (id === myId) return;
      const p = data.presence;
      if (!p || now - p.lastSeen > 2 * 60 * 1000) return; // stale > 2min
      const dist = haversineM(playerLat, playerLng, p.lat, p.lng);
      if (dist > NEARBY_RADIUS_M) {
        // Remove marker if moved away
        if (otherPlayerMarkers[id]) { otherPlayerMarkers[id].remove(); delete otherPlayerMarkers[id]; }
        return;
      }
      nearbyPlayers[id] = { ...p, profile: data.profile || null, id };

      // Add/update map marker
      const icon = L.divIcon({ className:'', html:'<div class="llair-player-other">✦</div>', iconSize:[36,36], iconAnchor:[18,18] });
      if (otherPlayerMarkers[id]) {
        otherPlayerMarkers[id].setLatLng([p.lat, p.lng]);
      } else {
        otherPlayerMarkers[id] = L.marker([p.lat,p.lng],{icon,zIndexOffset:900}).addTo(map);
        otherPlayerMarkers[id].bindTooltip(p.name, {permanent:true,direction:'top',offset:[0,-6]});
        otherPlayerMarkers[id].on('click', () => openPlayerModal(id));
        toast('✦ ' + p.name + ' of ' + p.coven + ' is nearby.');
      }
    });
    renderNearbyPlayersList();
  } catch(e) {}
}

function startPresenceEngine() {
  publishPresence();
  publishProfile();
  if (!presenceInterval) {
    presenceInterval = setInterval(() => { publishPresence(); scanNearbyPlayers(); }, 15000);
    setTimeout(() => scanNearbyPlayers(), 5000);
    setTimeout(() => scanNearbyPlayers(), 10000);
  }
}

async function publishPresence() {
  const id = getOrCreatePlayerId();
  // Check if our save has been deleted by DM — if so, show reset prompt
  try {
    const check = await fetch(`${FB_URL}/saves/${id}.json`);
    const saved = await check.json();
    if (saved === null) {
      // If identity modal is open, player is mid-creation — don't interfere
      const identityOpen = document.getElementById('identity-modal')?.classList.contains('open');
      if (identityOpen) return;
      // Otherwise: save was deleted by DM — stop interval, reload once
      if (presenceInterval) { clearInterval(presenceInterval); presenceInterval = null; }
      if (!_deletionDetected) {
        _deletionDetected = true;
        toast('Your chronicle has been erased. Reloading…');
        setTimeout(() => {
          localStorage.removeItem('llair_name');
          localStorage.removeItem('llair_coven');
          window.location.reload();
        }, 2500);
      }
      return;
    }
  } catch(e) {}
  const name = playerName || localStorage.getItem('llair_name') || 'Unknown Seeker';
  const coven = playerCoven || localStorage.getItem('llair_coven') || 'The Unsanctified';
  const data = {
    name, coven,
    lat: playerLat, lng: playerLng,
    lastSeen: Date.now(),
  };
  try {
    await fetch(`${FB_URL}/players/${id}/presence.json`, {
      method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data)
    });
  } catch(e) {}
}

async function publishProfile() {
  if (!playerName) return;
  const id = getOrCreatePlayerId();
  const profile = {
    resources: RES_NAMES.map((n,i) => ({ name:n, symbol:RES_SYMBOLS[i], value:Math.floor(values[i]) })),
    acolytes: (_acolytesData || [
      { id:'maurus', name:'Brother Maurus', cls:'Flagellant · Lv.4', stress:85, available: false },
      { id:'irene',  name:'Sister Irene Voss', cls:'Plague Scribe · Lv.3', stress:30, available: false },
    ]).map(a => ({...a, available: !!availableAcolytes[a.id || a.name]})),
    inventory: Object.entries(inventory).filter(([,q])=>q>0).map(([k,q])=>{
      const r=RECIPES.find(x=>x.key===k); return r?{name:r.name,icon:r.icon,qty:q}:null;
    }).filter(Boolean),
    lair: { scriptorium:2, forge:1, dormitorium:1, altar:2 },
  };
  try {
    await fetch(`${FB_URL}/players/${id}/profile.json`, {
      method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(profile)
    });
  } catch(e) {}
}

function renderNearbyPlayersList() {
  const cards = document.getElementById('nearby-players-cards');
  const panel = document.getElementById('nearby-players-list');
  if (!cards || !panel) return;
  const ids = Object.keys(nearbyPlayers);
  panel.style.display = ids.length ? 'block' : 'none';
  if (!ids.length) { cards.innerHTML = ''; return; }
  cards.innerHTML = ids.map(id => {
    const p = nearbyPlayers[id];
    if (!p) return '';
    const dist = Math.round(haversineM(playerLat, playerLng, p.lat, p.lng));
    const availCount = p.profile?.acolytes?.filter(a => a.available).length || 0;
    return `<div onclick="openPlayerModal('${id}')" style="border:1px solid rgba(123,79,207,0.5);background:rgba(123,79,207,0.06);padding:0.8rem 0.9rem;margin-bottom:0.5rem;cursor:pointer;display:flex;align-items:center;gap:0.8rem;">
      <div style="width:12px;height:12px;background:#7b4fcf;border-radius:2px;flex-shrink:0;box-shadow:0 0 8px rgba(123,79,207,0.8);"></div>
      <div style="flex:1;">
        <div style="font-family:var(--ff-heading);font-size: 0.92rem;letter-spacing:0.06em;color:var(--bone);">${p.name}</div>
        <div style="font-family:var(--ff-body);font-style:italic;font-size: 0.83rem;color:var(--gold);">${p.coven}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-family:var(--ff-heading);font-size: 0.64rem;color:var(--text-secondary);text-transform:uppercase;">${dist}m</div>
        ${availCount > 0 ? `<div style="font-family:var(--ff-heading);font-size: 0.58rem;color:var(--viridian-bright);margin-top:0.1rem;">${availCount} acolyte${availCount>1?'s':''} shared</div>` : ''}
      </div>
      <span style="color:rgba(123,79,207,0.7);font-size: 0.86rem;">›</span>
    </div>`;
  }).join('');
}

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000, r = Math.PI/180;
  const dLat = (lat2-lat1)*r, dLng = (lng2-lng1)*r;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function placeInboxEventMarkers(playerLat, playerLng) {
  if (!map) return;
  try {
    const myId = getOrCreatePlayerId();
    const res = await fetch(`${FB_URL}/events/${myId}.json?cb=` + Date.now());
    if (!res.ok) return;
    const all = await res.json();
    if (!all || all.error) return;

    // Remove stale inbox markers
    Object.keys(_inboxMapMarkers).forEach(id => {
      if (!all[id] || all[id].read === 'resolved' || all[id].read === 'declined'
          || all[id].read === 'combat' || all[id].read === 'failed' || all[id].read === true) {
        _inboxMapMarkers[id]?.remove();
        delete _inboxMapMarkers[id];
      }
    });

    // Place new active inbox markers
    for (const [id, ev] of Object.entries(all)) {
      if (!ev || !ev.title) continue;
      // Skip resolved/declined
      if (ev.read === 'resolved' || ev.read === 'declined' || ev.read === 'combat'
          || ev.read === 'failed' || ev.read === true) continue;
      if (_inboxMapMarkers[id]) continue; // already placed

      // Determine coordinates
      const evLat = ev.lat ?? ev.location?.lat;
      const evLng = ev.lng ?? ev.location?.lng;
      if (!evLat || !evLng) continue;

      const normEv = { ...ev, id, src: 'player',
        lat: Number(evLat), lng: Number(evLng) };
      const marker = L.marker([normEv.lat, normEv.lng], {
        icon: makeIcon(ev.type || 'story', 'dm')
      }).addTo(map);
      marker.bindPopup(makeEventPopup(normEv), { maxWidth: 240 });
      _inboxMapMarkers[id] = marker;
    }
  } catch(e) {}
}
