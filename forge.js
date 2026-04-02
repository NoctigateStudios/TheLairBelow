// ════════════════════════════════════════════════════════════
// FORGE
// ════════════════════════════════════════════════════════════

async function loadRecipesFromFirebase() {
  try {
    const res = await fetch(`${FB_URL}/world/recipes.json?cb=` + Date.now());
    if (!res.ok) return;
    const data = await res.json();
    if (!data || data.error || !Array.isArray(data)) return;
    RECIPES = data;
    // Re-render forge if open
    const modal = document.getElementById('forge-modal');
    if (modal && modal.classList.contains('open')) renderForgeTab(currentForgeTab);
  } catch(e) {}
}

function openForge() {
  document.getElementById('forge-modal').classList.add('open');
  document.querySelectorAll('.forge-tab').forEach((t,i) => t.classList.toggle('active', i===0));
  currentForgeTab = 'weapons';
  renderForgeTab('weapons');
}

function closeForge() { document.getElementById('forge-modal').classList.remove('open'); }

function switchForgeTab(tab, btn) {
  currentForgeTab = tab;
  document.querySelectorAll('.forge-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderForgeTab(tab);
}

function canAfford(costs) { return costs.every(c => values[c.res] >= c.amount); }

function renderForgeTab(tab) {
  const el = document.getElementById('forge-content');
  if (tab === 'inventory') { renderInventory(el); return; }
  const recipes = RECIPES.filter(r => r.cat === tab);
  el.innerHTML = recipes.map(r => {
    const affordable = canAfford(r.costs);
    const qty = inventory[r.key] || 0;
    const costsHtml = r.costs.map(c => {
      const has = values[c.res] >= c.amount;
      return `<span class="recipe-cost-pill ${has?'affordable':'unaffordable'}">${c.symbol} ${c.amount} ${c.name} (${Math.floor(values[c.res])} held)</span>`;
    }).join('');
    return `<div class="recipe-card ${affordable?'craftable':''}" style="--recipe-color:${r.color}">
      <div class="recipe-header">
        
        <div class="recipe-info"><div class="recipe-name">${r.name}</div><div class="recipe-type">${r.type}</div></div>
        ${qty > 0 ? `<span style="font-family:var(--ff-heading);font-size: 0.7rem;color:var(--amber-bright);">×${qty} owned</span>` : ''}
      </div>
      <p class="recipe-desc">${r.desc}</p>
      <div class="recipe-costs">${costsHtml}</div>
      <button class="recipe-craft-btn" ${affordable?'':'disabled'} onclick="craftItem('${r.key}')">
        ${affordable ? '⚗ Craft' : '✗ Insufficient Essence'}
      </button>
    </div>`;
  }).join('');
}

function craftItem(key) {
  const r = RECIPES.find(x => x.key === key);
  if (!r || !canAfford(r.costs)) { toast('Insufficient essence.'); return; }
  r.costs.forEach(c => { values[c.res] -= c.amount; });
  inventory[key] = (inventory[key] || 0) + 1;
  toast('✦ ' + r.name + ' forged. The essence takes form.');
  renderForgeTab(currentForgeTab);
  document.querySelectorAll('.resource-pill .res-value').forEach((el,i) => { el.textContent = Math.floor(values[i]); });
  publishProfile();
}
