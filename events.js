// ════════════════════════════════════════════════════════════
// EVENTS
// ════════════════════════════════════════════════════════════

async function pollDmEvents() {
  const myId = getOrCreatePlayerId();
  try {
    const res = await fetch(`${FB_URL}/events/${myId}.json?cb=` + Date.now());
    if (!res.ok) return;
    const all = await res.json();
    if (!all || all.error) return;
    for (const [evtId, ev] of Object.entries(all)) {
      if (!ev) continue;
      // Skip if already seen this session
      if (_shownDmEvents.has(evtId)) continue;
      // If already resolved/declined — show in journal as historical entry, skip modal
      const isResolved = ev.read === true || ev.read === 'resolved' || ev.read === 'declined'
        || ev.read === 'combat' || ev.read === 'failed';
      if (isResolved && ev.repeatable !== true) {
        appendJournalEntryCompleted(ev, evtId);
        continue;
      }
      _shownDmEvents.add(evtId);
      _dmEventQueue.push({ evtId, ev });
      // Add to journal — stays actionable until resolved or declined
      appendJournalEntry(ev, evtId);
      // DO NOT mark read here — only mark read when player resolves or declines
    }
    drainDmEventQueue();
  } catch(e) {}
}

function drainDmEventQueue() {
  if (_dmEventShowing || !_dmEventQueue.length) return;
  const { evtId, ev } = _dmEventQueue.shift();
  showDmEventModal(evtId, ev);
}

function showDmEventModal(evtId, ev) {
  _dmEventShowing = true;
  const sigils = { urgent:'!', story:'✦', discovery:'◎', neutral:'◈' };
  document.getElementById('dm-evt-sigil').textContent  = sigils[ev.type] || '✦';
  document.getElementById('dm-evt-type').textContent   = (ev.type || 'event').toUpperCase();
  document.getElementById('dm-evt-type').className     = 'dm-event-type ' + (ev.type || 'neutral');
  document.getElementById('dm-evt-title').textContent  = ev.title || '';
  document.getElementById('dm-evt-body').textContent   = ev.body  || '';

  // Build action buttons
  const actionsEl = document.getElementById('dm-evt-actions');
  actionsEl.innerHTML = '';

  const makeBtn = (label, primary, applyReward) => {
    const btn = document.createElement('button');
    btn.className = 'dm-event-btn' + (primary ? ' primary' : '');
    btn.textContent = label;
    btn.onclick = async () => {
      // Disable immediately to prevent double-tap
      actionsEl.querySelectorAll('.dm-event-btn').forEach(b => { b.disabled = true; b.style.opacity = '0.5'; });

      if (!applyReward) {
        closeDmEventModal();
        if (evtId) markEventReadInFirebase(evtId, 'declined');
        removeEventFromFieldList(evtId);
        removeEventMarkerById(evtId);
        const existingEntry = Array.from(document.querySelectorAll('.journal-entry'))
          .find(el => el.dataset.evtid === evtId);
        if (existingEntry) markJournalEntryResolved(existingEntry, 'Withdrawn');
        return;
      }

      // Run skill checks first
      if (ev.skillChecks && ev.skillChecks.length) {
        closeDmEventModal();
        const passed = await runSkillChecks(ev.skillChecks);
        if (!passed) {
          applyCheckFailurePenalty(ev);
          if (evtId) { markEventReadInFirebase(evtId, 'failed'); removeEventFromFieldList(evtId); removeEventMarkerById(evtId); }
          return;
        }
      } else {
        closeDmEventModal();
      }

      // Trigger combat if enemies defined
      if (ev.enemies && ev.enemies.length) {
        if (evtId) { markEventReadInFirebase(evtId, 'combat'); removeEventFromFieldList(evtId); removeEventMarkerById(evtId); }
        showCombat(ev).catch(err => {
          toast('Combat failed to load: ' + (err.message || err));
          switchTab('field');
        });
        return;
      }

      // No checks, no combat — apply reward and mark resolved
      if (ev.rewardRes) applyDmEventReward(ev);
      if (evtId) { markEventReadInFirebase(evtId, 'resolved'); removeEventFromFieldList(evtId); removeEventMarkerById(evtId); }
    };
    actionsEl.appendChild(btn);
  };

  if (ev.btn1) makeBtn(ev.btn1, true, true);
  if (ev.btn2) makeBtn(ev.btn2, false, false);
  if (!ev.btn1 && !ev.btn2) makeBtn('Acknowledge', true, true);

  // Show reward summary if present
  if (ev.reward) {
    const rwd = document.createElement('div');
    rwd.className = 'dm-event-rwd';
    rwd.style.cssText = 'font-family:var(--ff-heading);font-size: 0.54rem;letter-spacing:0.08em;color:var(--gold-dim);text-align:left;padding:0.5rem 0.2rem 0;border-top:1px solid rgba(201,168,76,0.1);margin-top:0.5rem;';
    rwd.textContent = '↳ ' + ev.reward;
    actionsEl.parentElement.insertBefore(rwd, actionsEl);
  }

  // Go to Location — flies the map to the pin
  const evLat = ev.location?.lat ?? ev.lat;
  const evLng = ev.location?.lng ?? ev.lng;
  if (evLat && evLng) {
    const btn = document.createElement('button');
    btn.className = 'dm-event-btn';
    btn.textContent = '◎ Go to Location';
    btn.onclick = () => { closeDmEventModal(); flyToEventLocation(evLat, evLng); };
    actionsEl.appendChild(btn);
  }

  // Stamp evtId on modal for resolution callbacks
  document.getElementById('dm-event-modal').dataset.evtid = evtId || '';
  document.getElementById('dm-event-modal').classList.add('open');
}

function applyDmEventReward(ev) {
  // Journal entry buttons pass JSON strings; modal passes objects directly
  if (typeof ev === 'string') { try { ev = JSON.parse(ev); } catch(e) { return; } }
  if (!ev.rewardRes || !Array.isArray(ev.rewardRes)) return;
  const RES_NAMES_LOCAL = ['Solar','Lunar','Jovian','Martial','Saturnine','Venusian','Mercurial'];
  const gained = [];
  ev.rewardRes.forEach((amt, i) => {
    if (amt && amt > 0) {
      values[i] = (values[i] || 0) + amt;
      gained.push(RES_SYMBOLS[i] + ' +' + amt + ' ' + RES_NAMES_LOCAL[i]);
    }
  });
  document.querySelectorAll('.resource-pill .res-value').forEach((el, i) => {
    el.textContent = Math.floor(values[i]);
  });
  if (ev.rewardXp && ev.rewardXp > 0) {
    if (_characterData) {
      _characterData.xp = (_characterData.xp || 0) + ev.rewardXp;
      gained.push('✦ +' + ev.rewardXp + ' XP');
      checkLevelUp();
    }
  }
  if (gained.length) toast('✦ Received: ' + gained.join(' · '));
  // Persist
  const myId = getOrCreatePlayerId();
  fbWrite(myId, collectGameState()).catch(() => {});
}

function closeDmEventModal() {
  document.getElementById('dm-event-modal').classList.remove('open');
  _dmEventShowing = false;
  setTimeout(drainDmEventQueue, 400);
}

async function pollBroadcasts() {
  const myId = getOrCreatePlayerId();
  try {
    const res = await fetch(`${FB_URL}/broadcasts/${myId}.json?cb=` + Date.now());
    if (!res.ok) return;
    const all = await res.json();
    if (!all || all.error) return;
    for (const [msgId, msg] of Object.entries(all)) {
      if (!msg) continue;
      // Skip if already seen this session
      if (_shownBroadcasts.has(msgId)) continue;
      // Skip if already read AND not pinned
      if (msg.read === true && msg.pinned !== true) continue;
      _shownBroadcasts.add(msgId);
      showBroadcastBanner(msg.message || '', msg.pinned === true);
      // Mark as read (pinned messages stay unread so they always re-show)
      if (msg.pinned !== true) {
        fetch(`${FB_URL}/broadcasts/${myId}/${msgId}/read.json`, {
          method:'PUT', headers:{'Content-Type':'application/json'}, body:'true'
        }).catch(()=>{});
      }
    }
  } catch(e) {}
}

function showBroadcastBanner(message, pinned) {
  const banner = document.getElementById('dm-broadcast-banner');
  document.getElementById('broadcast-msg-text').textContent = message;
  // Show a pin indicator for pinned messages
  const icon = banner.querySelector('.broadcast-icon');
  if (icon) icon.textContent = pinned ? '◆' : '✦';
  banner.classList.add('show');
}

function dismissBroadcast() {
  document.getElementById('dm-broadcast-banner').classList.remove('show');
}

function appendJournalEntry(evIn, evtId) {
  let ev = evIn;
  if (_journalEntryIds.has(evtId)) return;
  _journalEntryIds.add(evtId);
  const feed = document.getElementById('journal-feed');
  if (!feed) return;
  // Stamp the evtId so resolveJournalEvent can delete it from Firebase
  ev = { ...ev, _evtId: evtId };
  const SIGILS = { urgent:'!', story:'✦', discovery:'◎', neutral:'◈' };
  const sigil  = SIGILS[ev.type] || '✦';
  const cls    = ev.type || 'neutral';
  const when   = new Date(ev.createdAt || Date.now()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  const entry  = document.createElement('div');
  entry.className = `journal-entry ${cls}`;
  entry.dataset.evtid = evtId || '';
  const rewardLine = ev.reward
    ? `<div style="font-family:var(--ff-heading);font-size: 0.59rem;letter-spacing:0.08em;color:var(--gold-dim);margin-top:0.4rem;">↳ ${ev.reward}</div>`
    : '';
  entry.innerHTML = `
    <div class="entry-header">
      <span class="entry-title">${sigil} ${ev.title || 'An Omen Arrives'}</span>
      <span class="entry-time">${when}</span>
    </div>
    <p class="entry-body">${ev.body || ''}</p>
    ${rewardLine}
    <div class="entry-actions">
      ${ev.btn1 ? (() => { const jid='j_'+Math.random().toString(36).slice(2,8); _worldEventStore.set(jid,ev); return `<button class="btn-action primary" onclick="resolveJournalEvent('${jid}',this,true)">${ev.btn1}</button>`; })() : ''}
      ${ev.btn2 ? (() => { const jid2='j_'+Math.random().toString(36).slice(2,8); _worldEventStore.set(jid2,ev); return `<button class="btn-action" onclick="resolveJournalEvent('${jid2}',this,false)">${ev.btn2}</button>`; })() : ''}
      ${ev.location?.lat ? `<button class="btn-action" onclick="flyToEventLocation(${ev.location.lat},${ev.location.lng})">◎ Go to Location</button>` : (ev.lat ? `<button class="btn-action" onclick="flyToEventLocation(${ev.lat},${ev.lng})">◎ Go to Location</button>` : '')}
    </div>`;
  // Prepend so newest is at top, but after the planetary hour widget
  feed.insertBefore(entry, feed.firstChild);
  // Hide the seed entries once real events come in
  // Hide empty state once real events arrive
  const emptyMsg = document.getElementById('journal-empty');
  if (emptyMsg) emptyMsg.style.display = 'none';
}

function appendJournalEntryCompleted(ev, evtId) {
  if (_journalEntryIds.has(evtId + '_completed')) return;
  _journalEntryIds.add(evtId + '_completed');
  const feed = document.getElementById('journal-feed');
  if (!feed) return;
  const SIGILS = { urgent:'!', story:'◈', discovery:'○', neutral:'·' };
  const sigil = SIGILS[ev.type] || '◈';
  const when = new Date(ev.createdAt || Date.now()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  const statusText = ev.read === 'declined' ? 'Withdrawn'
    : ev.read === 'failed' ? 'Check Failed'
    : ev.read === 'combat' ? 'Combat Resolved'
    : 'Resolved';
  const statusColor = ev.read === 'declined' ? 'var(--text-secondary)'
    : ev.read === 'failed' ? 'var(--crimson-bright)'
    : 'var(--viridian-bright)';

  const entry = document.createElement('div');
  entry.className = 'journal-entry ' + (ev.type || 'neutral');
  entry.style.opacity = '0.4';
  entry.innerHTML = `
    <div class="entry-header">
      <span class="entry-title">${sigil} ${ev.title || 'An Omen Arrives'}</span>
      <span class="entry-time">${when}</span>
    </div>
    <p class="entry-body">${ev.body || ''}</p>
    <div style="font-family:var(--ff-heading);font-size:0.55rem;color:${statusColor};letter-spacing:0.12em;text-transform:uppercase;margin-top:0.3rem;">${statusText}</div>`;
  feed.insertBefore(entry, feed.firstChild);
  const emptyMsg = document.getElementById('journal-empty');
  if (emptyMsg) emptyMsg.style.display = 'none';
}

function markJournalEntryResolved(entry, label, color) {
  if (!entry) return;
  entry.style.opacity = '0.42';
  entry.style.pointerEvents = 'none';
  // Remove all action buttons from DOM so they cannot be re-tapped
  entry.querySelectorAll('.btn-action, .entry-actions button').forEach(b => b.remove());
  const actDiv = entry.querySelector('.entry-actions');
  if (actDiv) actDiv.remove();
  // Add status label
  const lbl = document.createElement('div');
  lbl.style.cssText = `font-family:var(--ff-heading);font-size:0.55rem;color:${color||'var(--text-secondary)'};letter-spacing:0.12em;text-transform:uppercase;margin-top:0.4rem;border-top:1px solid var(--border);padding-top:0.35rem;`;
  lbl.textContent = label || 'Resolved';
  entry.appendChild(lbl);
}

function markEventReadInFirebase(evtId, status) {
  if (!evtId) return;
  const myId = getOrCreatePlayerId();
  fetch(`${FB_URL}/events/${myId}/${evtId}/read.json`, {
    method:'PUT', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(status || true)
  }).catch(() => {});
}

function removeEventFromFieldList(evtId) {
  if (!evtId) return;
  // Match by data-evid or by stored ev.id
  document.querySelectorAll('.mission-card[data-evid]').forEach(card => {
    const storedEv = _worldEventStore.get(card.dataset.evid);
    if (storedEv && (storedEv.id === evtId || storedEv._evtId === evtId)) {
      card.remove();
    }
  });
  // Also refresh the count label
  const remaining = document.querySelectorAll('.mission-card[data-evid]').length;
  const lbl = document.getElementById('field-events-label');
  if (lbl) {
    const cur = parseInt(lbl.textContent.match(/\d+/)?.[0] || '0') - 1;
    if (cur <= 0) lbl.textContent = 'Obligations & Omens';
    else lbl.textContent = `Obligations & Omens (${cur})`;
  }
}

function removeEventMarkerById(evId) {
  if (!evId) return;
  if (dmMapMarkers[evId])       { dmMapMarkers[evId].remove(); delete dmMapMarkers[evId]; }
  if (randomMapMarkers[evId])   { randomMapMarkers[evId].remove(); delete randomMapMarkers[evId]; }
  if (_inboxMapMarkers[evId])   { _inboxMapMarkers[evId].remove(); delete _inboxMapMarkers[evId]; }
}

async function resolveJournalEvent(jid, btn, acceptReward) {
  const ev = _worldEventStore.get(jid);
  const entry = btn?.closest('.journal-entry');

  // Decline path — mark read (not delete), dim in journal, remove from map/field list
  if (!acceptReward) {
    if (entry) {
      entry.style.opacity = '0.38';
      entry.style.pointerEvents = 'none';
      const lbl = document.createElement('div');
      lbl.style.cssText = 'font-family:var(--ff-heading);font-size:0.55rem;color:var(--text-secondary);letter-spacing:0.1em;text-transform:uppercase;margin-top:0.4rem;';
      lbl.textContent = 'Withdrawn';
      entry.appendChild(lbl);
    }
    if (ev?._evtId) {
      const myId = getOrCreatePlayerId();
      // Mark as read so it doesn't re-trigger on next poll
      fetch(`${FB_URL}/events/${myId}/${ev._evtId}/read.json`, {
        method:'PUT', headers:{'Content-Type':'application/json'}, body:'"declined"'
      }).catch(()=>{});
      // Remove from field event list
      removeEventFromFieldList(ev._evtId);
      // Remove from map if it has a marker
      removeEventMarkerById(ev._evtId);
    }
    return;
  }

  if (!ev) { toast('Event data lost — please refresh.'); return; }

  // Disable buttons immediately to prevent double-tap
  if (entry) entry.querySelectorAll('.btn-action').forEach(b => { b.disabled = true; b.style.opacity = '0.5'; });

  // Run skill checks first
  if (ev.skillChecks && ev.skillChecks.length) {
    const passed = await runSkillChecks(ev.skillChecks);
    if (!passed) {
      applyCheckFailurePenalty(ev);
      markJournalEntryResolved(entry, 'Check Failed', 'var(--crimson-bright)');
      markEventReadInFirebase(ev._evtId, 'failed');
      removeEventFromFieldList(ev._evtId);
      removeEventMarkerById(ev._evtId);
      return;
    }
  }

  // Trigger combat if enemies defined
  if (ev.enemies && ev.enemies.length) {
    markJournalEntryResolved(entry, 'Combat Initiated', 'var(--crimson-bright)');
    markEventReadInFirebase(ev._evtId, 'combat');
    removeEventFromFieldList(ev._evtId);
    removeEventMarkerById(ev._evtId);
    showCombat(ev).catch(err => {
      toast('Combat failed to load: ' + (err.message || err));
      switchTab('field');
    });
    return;
  }

  // No combat — apply reward and mark resolved
  if (ev.rewardRes) applyDmEventReward(ev);
  markJournalEntryResolved(entry, 'Resolved');
  markEventReadInFirebase(ev._evtId, 'resolved');
  removeEventFromFieldList(ev._evtId);
  removeEventMarkerById(ev._evtId);
}

function updateTimer() {
    const msLeft = (ex.expires||0) - Date.now();
    if (msLeft <= 0) {
      timerEl.textContent = 'This proposal has expired.';
      acceptBtn.disabled = true;
      acceptBtn.style.opacity = '0.4';
      clearInterval(_iemTimerInterval);
      return;
    }
    const mins = Math.floor(msLeft / 60000);
    const secs = Math.floor((msLeft % 60000) / 1000);
    timerEl.textContent = 'Expires in ' + mins + 'm ' + secs + 's';
  }
