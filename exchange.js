// ════════════════════════════════════════════════════════════
// EXCHANGE
// ════════════════════════════════════════════════════════════

function openExchangeModal(targetId) {
  currentExchangeTarget = targetId;
  // Refresh name/coven from localStorage in case they weren't set yet
  if (!playerName) playerName = localStorage.getItem('llair_name') || '';
  if (!playerCoven) playerCoven = localStorage.getItem('llair_coven') || '';
  const p = nearbyPlayers[targetId];
  document.getElementById('exchange-sub').textContent = 'with ' + (p?.name || 'unknown seeker');
  closePlayerModal();

  const symRows = RES_SYMBOLS.map((s,i) => `
    <div class="exchange-res-row">
      <span class="exchange-res-label">${s} ${RES_NAMES[i]}</span>
      <input class="exchange-input" type="number" min="0" max="${Math.floor(values[i])}" value="0" data-res="${i}" data-side="offer">
    </div>`).join('');
  const reqRows = RES_SYMBOLS.map((s,i) => `
    <div class="exchange-res-row">
      <span class="exchange-res-label">${s} ${RES_NAMES[i]}</span>
      <input class="exchange-input" type="number" min="0" value="0" data-res="${i}" data-side="request">
    </div>`).join('');

  document.getElementById('offer-inputs').innerHTML = symRows;
  document.getElementById('request-inputs').innerHTML = reqRows;
  document.getElementById('exchange-modal').classList.add('open');
}

function closeExchangeModal() {
  document.getElementById('exchange-modal').classList.remove('open');
  currentExchangeTarget = null;
}

async function submitExchange() {
  if (!currentExchangeTarget) return;
  const myId = getOrCreatePlayerId();
  const offer = {}, request = {};
  document.querySelectorAll('.exchange-input[data-side="offer"]').forEach(inp => {
    const v = parseInt(inp.value)||0;
    if (v > 0) offer[inp.dataset.res] = v;
  });
  document.querySelectorAll('.exchange-input[data-side="request"]').forEach(inp => {
    const v = parseInt(inp.value)||0;
    if (v > 0) request[inp.dataset.res] = v;
  });
  if (!Object.keys(offer).length && !Object.keys(request).length) {
    toast('Specify at least one essence to offer or request.'); return;
  }
  // Validate offer amounts
  for (const [res, amt] of Object.entries(offer)) {
    if (values[parseInt(res)] < amt) { toast('You do not have enough ' + RES_NAMES[parseInt(res)] + ' to offer.'); return; }
  }
  const exchangeData = {
    from: myId,
    fromName: playerName || localStorage.getItem('llair_name') || 'Unknown',
    fromCoven: playerCoven || localStorage.getItem('llair_coven') || 'Unknown',
    to: currentExchangeTarget,
    offer, request,
    status: 'pending',
    created: Date.now(),
    expires: Date.now() + 2 * 60 * 60 * 1000,
  };
  const exchId = myId.slice(0,8) + '-' + Date.now();
  try {
    const exchRes = await fetch(`${FB_URL}/exchanges/${exchId}.json`, {
      method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(exchangeData)
    });
    if (!exchRes.ok) { toast('✗ Failed to send exchange: ' + exchRes.status); return; }
    toast('✦ Exchange proposal sent. Awaiting their response.');
    closeExchangeModal();
  } catch(e) { toast('✗ Failed to send proposal: ' + e.message); }
}

async function manualPoll() {
  const myId = getOrCreatePlayerId();
  toast('Polling... my ID: ' + myId.slice(0,8));
  try {
    const res = await fetch(`${FB_URL}/exchanges.json?t=` + Date.now());
    const all = await res.json();
    if (!all) { toast('No exchanges in Firebase'); return; }
    if (all.error) { toast('Firebase error: ' + all.error); return; }
    const entries = Object.entries(all);
    toast('Found ' + entries.length + ' exchange(s)');
    const now = Date.now();
    entries.forEach(([id, ex]) => {
      if (!ex) return;
      const toMatch = (ex.to||'').toLowerCase() === myId.toLowerCase();
      const fromMatch = (ex.from||'').toLowerCase() === myId.toLowerCase();
      const expired = (ex.expires||0) < now;
      toast('ID:' + id.slice(0,8) + ' from=' + (ex.fromName||'?') + ' status=' + (ex.status||'?') + ' toMe=' + toMatch + ' expired=' + expired);
      // Auto-delete only truly expired entries (not just missing status)
      if (expired) {
        fetch(`https://lairbelow-default-rtdb.firebaseio.com/exchanges/${id}.json`, {method:'DELETE'})
          .then(() => toast('Deleted stale exchange ' + id.slice(0,8)));
      }
      // Treat missing status as pending (older clients may omit it)
      if (toMatch && (!ex.status || ex.status === 'pending') && (ex.expires||0) > now) {
        // Clear old card and re-show
        const old = document.getElementById('exch-' + id);
        if (old) old.remove();
        showExchangeNotification(id, ex);
        toast('✓ Showing notification!');
      }
    });
  } catch(e) { toast('POLL ERROR: ' + e.message); }
}

async function pollIncomingExchanges() {
  const myId = getOrCreatePlayerId();
  try {
    const res = await fetch(`${FB_URL}/exchanges.json?cb=` + Date.now());
    if (!res.ok) return;
    const all = await res.json();
    if (!all) return;
    if (all.error) return;
    const now = Date.now();
    for (const [exchId, ex] of Object.entries(all)) {
      if (!ex) continue;
      const isForMe   = (ex.to||'').toLowerCase()   === myId.toLowerCase();
      const iFromMe   = (ex.from||'').toLowerCase() === myId.toLowerCase();
      const isPending = !ex.status || ex.status === 'pending';
      const notExpired = (ex.expires||0) > now;
      // RECEIVER: show popup for pending incoming exchanges addressed to me
      if (isPending && notExpired && !iFromMe && !_shownExchanges.has(exchId) && (isForMe || !ex.to)) {
        _shownExchanges.add(exchId);
        showExchangeNotification(exchId, ex);
      }

      // SENDER: detect when my outgoing exchange was accepted by the other player
      if (iFromMe && ex.status === 'accepted' && !_resolvedExchanges.has(exchId)) {
        _resolvedExchanges.add(exchId);
        // Deduct what I offered, receive what I requested
        for (const [r, amt] of Object.entries(ex.offer||{}))   values[parseInt(r)] -= amt;
        for (const [r, amt] of Object.entries(ex.request||{})) values[parseInt(r)] += amt;
        // Clamp to zero — can't go negative
        values.forEach((v,i) => { if (values[i] < 0) values[i] = 0; });
        document.querySelectorAll('.resource-pill .res-value').forEach((el,i) => { el.textContent = Math.floor(values[i]); });
        toast('✦ Your exchange was accepted. Essences transferred.');
        // Persist to Firebase
        try { await fbWrite(myId, collectGameState()); } catch(e) { console.error('Save after sender resolution failed:', e); }
        // Clean up exchange entry
        try { fetch(`${FB_URL}/exchanges/${exchId}.json`, {method:'DELETE'}); } catch(e) {}
      }
    }
  } catch(e) { console.error('pollExchanges error:', e); }
}

async function debugExchanges() {
  const myId = getOrCreatePlayerId();
  const now = Date.now();
  try {
    const res = await fetch(`${FB_URL}/exchanges.json?cb=` + Date.now());
    const all = await res.json();
    if (!all) { toast('No exchanges in Firebase'); return; }
    if (all.error) { toast('Firebase error: ' + all.error); return; }
    const entries = Object.entries(all);
    toast('Exchanges in Firebase: ' + entries.length);
    entries.forEach(([id, ex]) => {
      if (!ex) return;
      const isForMe = (ex.to||'').toLowerCase() === myId.toLowerCase();
      const isPending = !ex.status || ex.status === 'pending';
      const expired = (ex.expires||0) < now;
      toast('ID:' + id.slice(0,8) + ' from=' + (ex.fromName||'?') + ' status=' + (ex.status||'(none)') + ' toMe=' + isForMe + ' pending=' + isPending + ' expired=' + expired);
    });
  } catch(e) { toast('Error: ' + e.message); }
}

function showExchangeNotification(exchId, ex) {
  const offerText = Object.entries(ex.offer||{}).map(([r,a]) => RES_SYMBOLS[r]+' '+a+' '+RES_NAMES[r]).join(', ') || 'nothing';
  const reqText  = Object.entries(ex.request||{}).map(([r,a]) => RES_SYMBOLS[r]+' '+a+' '+RES_NAMES[r]).join(', ') || 'nothing';
  const exData = JSON.stringify(ex).replace(/"/g,'&quot;');

  // Persistent card in Journal inbox
  const inbox = document.getElementById('exchange-inbox');
  if (inbox && !document.getElementById('exch-' + exchId)) {
    inbox.style.display = 'block';
    const card = document.createElement('div');
    card.id = 'exch-' + exchId;
    card.style.cssText = 'border:1px solid rgba(201,168,76,0.5);background:rgba(201,168,76,0.06);padding:0.9rem 1rem;margin-bottom:0.5rem;';
    card.innerHTML = `
      <div style="font-family:var(--ff-heading);font-size: 0.77rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--gold);margin-bottom:0.5rem;">⟺ Exchange from ${ex.fromName}</div>
      <div style="font-family:var(--ff-body);font-style:italic;font-size: 0.82rem;color:var(--pale);margin-bottom:0.6rem;">
        Coven of ${ex.fromCoven||'Unknown'}<br>
        <strong style="color:var(--bone);">Offers:</strong> ${offerText}<br>
        <strong style="color:var(--bone);">Requests:</strong> ${reqText}
      </div>
      <div style="display:flex;gap:0.5rem;">
        <button onclick="acceptExchange('${exchId}',JSON.parse(this.dataset.ex))" data-ex="${exData}"
          style="flex:1;font-family:var(--ff-heading);font-size: 0.7rem;letter-spacing:0.1em;text-transform:uppercase;padding:0.6rem;border:1px solid var(--viridian-bright);background:transparent;color:var(--viridian-bright);cursor:pointer;">
          ✓ Accept
        </button>
        <button onclick="declineExchange('${exchId}')"
          style="flex:1;font-family:var(--ff-heading);font-size: 0.7rem;letter-spacing:0.1em;text-transform:uppercase;padding:0.6rem;border:1px solid var(--crimson-bright);background:transparent;color:var(--crimson-bright);cursor:pointer;">
          ✗ Decline
        </button>
      </div>`;
    inbox.prepend(card);
  }

  // Show full-screen incoming exchange popup
  openIncomingExchangeModal(exchId, ex, offerText, reqText);
}

function openIncomingExchangeModal(exchId, ex, offerText, reqText) {
  if (!offerText) offerText = Object.entries(ex.offer||{}).map(([r,a]) => RES_SYMBOLS[r]+' '+a+' '+RES_NAMES[r]).join(', ') || 'nothing';
  if (!reqText)  reqText  = Object.entries(ex.request||{}).map(([r,a]) => RES_SYMBOLS[r]+' '+a+' '+RES_NAMES[r]).join(', ') || 'nothing';

  document.getElementById('iem-from').textContent = ex.fromName || 'Unknown Seeker';
  document.getElementById('iem-coven').textContent = 'Coven of ' + (ex.fromCoven || 'Unknown');
  document.getElementById('iem-offer').textContent = offerText;
  document.getElementById('iem-request').textContent = reqText;

  // Accept button
  const acceptBtn = document.getElementById('iem-accept-btn');
  acceptBtn.onclick = () => {
    closeIncomingExchangeModal();
    acceptExchange(exchId, ex);
  };

  // Decline button
  const declineBtn = document.getElementById('iem-decline-btn');
  declineBtn.onclick = () => {
    closeIncomingExchangeModal();
    declineExchange(exchId);
  };

  // Countdown timer
  if (_iemTimerInterval) clearInterval(_iemTimerInterval);
  const timerEl = document.getElementById('iem-timer');
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
  updateTimer();
  _iemTimerInterval = setInterval(updateTimer, 1000);

  document.getElementById('incoming-exchange-modal').classList.add('open');
}

function closeIncomingExchangeModal() {
  document.getElementById('incoming-exchange-modal').classList.remove('open');
  if (_iemTimerInterval) { clearInterval(_iemTimerInterval); _iemTimerInterval = null; }
}

async function acceptExchange(exchId, ex) {
  if (!ex) ex = _pendingExchanges[exchId];
  if (!ex) { toast('Exchange data not found. Try reloading.'); return; }
  const myId = getOrCreatePlayerId();
  // Validate I can give what they request
  for (const [res, amt] of Object.entries(ex.request||{})) {
    if (values[parseInt(res)] < amt) { toast('You do not have enough ' + RES_NAMES[parseInt(res)] + ' to complete this exchange.'); return; }
  }
  // Apply: I give request, I receive offer
  for (const [res, amt] of Object.entries(ex.request||{})) values[parseInt(res)] -= amt;
  for (const [res, amt] of Object.entries(ex.offer||{}))   values[parseInt(res)] += amt;
  document.querySelectorAll('.resource-pill .res-value').forEach((el,i) => { el.textContent = Math.floor(values[i]); });
  // Write accepted result
  try {
    await fetch(`${FB_URL}/exchanges/${exchId}.json`, {
      method: 'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({...ex, status:'accepted', acceptedAt: Date.now()})
    });
  } catch(e) {}
  document.getElementById('exch-' + exchId)?.remove();
  const inbox = document.getElementById('exchange-inbox');
  if (inbox && !inbox.children.length) inbox.style.display = 'none';
  closeIncomingExchangeModal();
  toast('✦ Exchange accepted. Essences transferred.');
  publishProfile();
  // Persist updated resources to Firebase so they survive reload
  try { await fbWrite(myId, collectGameState()); } catch(e) { console.error('Save after accept failed:', e); }
}

async function declineExchange(exchId) {
  try {
    const res = await fetch(`${FB_URL}/exchanges/${exchId}.json`);
    const ex = await res.json();
    await fetch(`${FB_URL}/exchanges/${exchId}.json`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({...ex, status:'declined'})
    });
  } catch(e) {}
  document.getElementById('exch-' + exchId)?.remove();
  const inbox2 = document.getElementById('exchange-inbox');
  if (inbox2 && !inbox2.children.length) inbox2.style.display = 'none';
  closeIncomingExchangeModal();
  toast('Exchange declined.');
}
