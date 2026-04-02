// ═══════════════════════════════════════════════════════════
// THE LAIR BELOW — CONSTANTS & GLOBAL STATE
// Must be loaded FIRST before all other JS files.
// ═══════════════════════════════════════════════════════════

var _gameStarted = false;

var _deletionDetected = false;

var playerName = '';

var playerCoven = '';

var inventory = {};

var availableAcolytes = {};

var nearbyPlayers = {};

var otherPlayerMarkers = {};

var currentExchangeTarget = null;

var presenceInterval = null;

var currentForgeTab = 'weapons';

var _combatSystem      = null;

var _cachedWorldSkills = null;

var _CS                = null;

var _pendingSkill      = null;

var map = null;

var playerMarker = null;

var playerLat = 45.4642;

var playerLng = 9.1900;

var dmMapMarkers = {};

var randomMapMarkers = {};

var _worldEventStore = new Map();

var _cachedWorldEvents = null;

var _inboxMapMarkers = {};

var CHALDEAN = ['saturn', 'jupiter', 'mars', 'sun', 'venus', 'mercury', 'moon'];

var DAY_RULERS = [3, 6, 2, 5, 1, 4, 0];

var PLANET_META = {
  sun:     { symbol: '☉', name: 'Sol',     color: '#c9a84c', bonuses: ['+50% Solar Gain',     'Fire Rites Empowered',    'Sight Sharpened'],       resIndex: 0 },
  moon:    { symbol: '☽', name: 'Luna',    color: '#8b8ba0', bonuses: ['+50% Lunar Gain',     'Dreams Vivid',            'Scrying Empowered'],     resIndex: 1 },
  jupiter: { symbol: '♃', name: 'Jupiter', color: '#6b4c8b', bonuses: ['+50% Jovian Gain',    'Expansion Rites Active',  'Recruit Bonus'],         resIndex: 2 },
  mars:    { symbol: '♂', name: 'Mars',    color: '#8b2020', bonuses: ['+50% Martial Gain',   'Combat Damage +20%',      'Stress Resistance Up'],  resIndex: 3 },
  saturn:  { symbol: '♄', name: 'Saturn',  color: '#8b7355', bonuses: ['+50% Saturnine Gain', 'Research Deepens',        'Seals Strengthened'],    resIndex: 4 },
  venus:   { symbol: '♀', name: 'Venus',   color: '#5c8b5c', bonuses: ['+50% Venusian Gain',  'Acolyte Stress −10',      'Tarot Empowered'],       resIndex: 5 },
  mercury: { symbol: '☿', name: 'Mercury', color: '#4a7a8b', bonuses: ['+50% Mercurial Gain', 'Glyphs Decoded Faster',   'Research Speed +30%'],   resIndex: 6 },
};

var BASE_RATES = [3, 7, 1, 2, 0.5, 4, 3];

var rates = [...BASE_RATES];

var baseRates = [...BASE_RATES];

var values = [847, 312, 154, 98, 41, 203, 189];

var BASE_CAPS = [2000, 1500, 800, 600, 400, 1200, 1000];

var resCaps   = [...BASE_CAPS];

var tarotEffects = [];

var _resTick = 0;

var phLat = 46.1713, phLng = 9.8694;

var majorArcana = [
  {num:'0',    sym:'○',  name:'The Fool'},
  {num:'I',    sym:'☿',  name:'The Magician'},
  {num:'II',   sym:'☽',  name:'High Priestess'},
  {num:'III',  sym:'♀',  name:'The Empress'},
  {num:'IV',   sym:'♂',  name:'The Emperor'},
  {num:'V',    sym:'⛧',  name:'Hierophant'},
  {num:'VI',   sym:'✦',  name:'The Lovers'},
  {num:'VII',  sym:'⬡',  name:'The Chariot'},
  {num:'VIII', sym:'⚖',  name:'Justice'},
  {num:'X',    sym:'☸',  name:'Wheel of Fortune'},
  {num:'XI',   sym:'☉',  name:'Strength'},
  {num:'XII',  sym:'🜃',  name:'The Hanged Man'},
  {num:'XIII', sym:'♄',  name:'Death'},
  {num:'XIV',  sym:'🜄',  name:'Temperance'},
  {num:'XV',   sym:'🜂',  name:'The Devil'},
  {num:'XVII', sym:'✶',  name:'The Star'},
  {num:'XVIII',sym:'☽',  name:'The Moon'},
  {num:'XIX',  sym:'☉',  name:'The Sun'},
  {num:'XX',   sym:'✦',  name:'Judgement'},
  {num:'XXI',  sym:'⊕',  name:'The World'},
];

var _worldTarotCards = null;

var _currentSpread = [null, null, null];

var SPREAD_POSITIONS = ['The Past', 'The Present', 'The Future'];

var TAROT_EFFECTS = {
  'The Fool': {
    up:  { type:'allRates', mult:1.25, label:'+25% all income for 3h — the leap of faith pays off', dur:3 },
    rev: { type:'stat_debuff', stat:'cunning', value:-2, label:'−2 Cunning on all acolytes for 24h — recklessness costs', dur:24 }
  },
  'The Magician': {
    up:  { type:'research', mult:2.0, label:'Research speed doubled for 3h — the will makes it so', dur:3 },
    rev: { type:'grant_essence', resIdx:6, value:-150, label:'150 Mercurial essence lost — the work consumes itself', dur:0 }
  },
  'High Priestess': {
    up:  { type:'unlock_rite', riteKey:'silver-crescent', label:'Rite of the Silver Crescent unlocked without Altar requirement for 24h', dur:24 },
    rev: { type:'rate', resIdx:1, mult:0.0, label:'Lunar income suspended for 2h — the veil closes', dur:2 }
  },
  'The Empress': {
    up:  { type:'cleanse', label:'All acolyte Stress cleared — the earth receives the wound', dur:0 },
    rev: { type:'stress', value:15, label:'+15 Stress to all acolytes — abundance turns to hunger', dur:0 }
  },
  'The Emperor': {
    up:  { type:'stat_buff', stat:'fortitude', value:3, label:'+3 Fortitude to all acolytes for 24h — structure holds', dur:24 },
    rev: { type:'allRates', mult:0.7, label:'All income −30% for 4h — the throne demands tribute', dur:4 }
  },
  'Hierophant': {
    up:  { type:'research', mult:1.5, label:'+50% research speed for 6h and Codex entries unlock', dur:6 },
    rev: { type:'research', mult:0.5, label:'Research halved for 3h — orthodoxy resists', dur:3 }
  },
  'The Lovers': {
    up:  { type:'grant_essence', resIdx:5, value:400, label:'+400 Venusian essence — union yields', dur:0 },
    rev: { type:'stat_debuff', stat:'empathy', value:-3, label:'−3 Empathy on all acolytes for 12h — division wounds', dur:12 }
  },
  'The Chariot': {
    up:  { type:'stat_buff', stat:'speed', value:4, label:'+4 Speed on all acolytes for 12h — the wheels turn', dur:12 },
    rev: { type:'allRates', mult:0.85, label:'−15% all income for 2h — momentum reversed', dur:2 }
  },
  'Justice': {
    up:  { type:'cleanse_afflictions', label:'One affliction removed from each acolyte — debts settled', dur:0 },
    rev: { type:'stress', value:10, label:'+10 Stress to all acolytes — the scales tip against you', dur:0 }
  },
  'Wheel of Fortune': {
    up:  { type:'allRates', mult:2.0, label:'×2 all income for 1h — the wheel crests', dur:1 },
    rev: { type:'allRates', mult:0.4, label:'−60% all income for 2h — the wheel descends', dur:2 }
  },
  'Strength': {
    up:  { type:'stat_buff', stat:'fortitude', value:5, label:'+5 Fortitude and −20 Stress on all acolytes for 12h', dur:12 },
    rev: { type:'stat_debuff', stat:'wrath', value:-3, label:'−3 Wrath to all acolytes for 12h — rage without direction', dur:12 }
  },
  'The Hanged Man': {
    up:  { type:'research', mult:3.0, label:'+200% research speed for 2h — suspension yields understanding', dur:2 },
    rev: { type:'allRates', mult:0.0, label:'All income suspended for 1h — the pause is forced', dur:1 }
  },
  'Death': {
    up:  { type:'cleanse_all', label:'All Stress cleared, all Afflictions removed — transformation complete', dur:0 },
    rev: { type:'stress', value:30, label:'+30 Stress to all acolytes — death without rebirth', dur:0 }
  },
  'Temperance': {
    up:  { type:'allRates', mult:1.2, label:'+20% all income for 6h — the middle way sustains', dur:6 },
    rev: { type:'grant_essence', resIdx:3, value:-200, label:'−200 Martial essence — tempering destroys the blade', dur:0 }
  },
  'The Devil': {
    up:  { type:'grant_essence', resIdx:4, value:500, label:'+500 Saturnine essence — bound labour yields stone', dur:0 },
    rev: { type:'stat_debuff', stat:'memory', value:-3, label:'−3 Memory on all acolytes for 24h — the chains corrode thought', dur:24 }
  },
  'The Star': {
    up:  { type:'allRates', mult:1.15, label:'+15% all income for 8h — steady hope holds', dur:8 },
    rev: { type:'rate', resIdx:0, mult:0.5, label:'Solar income halved for 4h — the star dims', dur:4 }
  },
  'The Moon': {
    up:  { type:'rate', resIdx:1, mult:3.0, label:'×3 Lunar income for 3h — the tide is extreme', dur:3 },
    rev: { type:'stat_debuff', stat:'intuition', value:-4, label:'−4 Intuition on all acolytes for 12h — illusion clouds all', dur:12 }
  },
  'The Sun': {
    up:  { type:'stat_buff', stat:'wrath', value:4, label:'+4 Wrath and +100 Solar income — the sun blazes', dur:0 },
    rev: { type:'stress', value:20, label:'+20 Stress, Solar income halved for 1h — exposure burns', dur:0 }
  },
  'Judgement': {
    up:  { type:'level_bonus', label:'All acolytes gain +50 XP — the call awakens them', dur:0 },
    rev: { type:'stat_debuff', stat:'gnosis', value:-2, label:'−2 Gnosis on character for 24h — the call goes unanswered', dur:24 }
  },
  'The World': {
    up:  { type:'allRates', mult:1.5, label:'+50% all income for 4h and +1 Gnosis — completion grants sight', dur:4 },
    rev: { type:'allRates', mult:1.1, label:'+10% all income for 2h (reversed world still moves forward)', dur:2 }
  },
  'The Hermit': {
    up:  { type:'research', mult:1.4, label:'+40% research speed for 6h — solitude clarifies', dur:6 },
    rev: { type:'stat_debuff', stat:'empathy', value:-2, label:'−2 Empathy for 12h — isolation becomes withdrawal', dur:12 }
  },
};

var CODEX = [
  // RESOURCES
  { key:'solar',      cat:'resources', symbol:'☉', name:'Solar Essence',
    short:'Radiant energy drawn from the Sun\'s planetary hour. Fuels fire rites and illumination.',
    body:'Solar Essence is gathered during the hour of Sol — the planetary hour whose ruler is the Sun. It is the most volatile and potent of the seven essences, associated with clarity, will, and sacred fire. Used extensively in combat rites, the crafting of illuminated sigils, and any working that requires the banishment of darkness or the strengthening of the self. During the Sun\'s hour, Solar income is boosted by 50%.',
    tags:['Planetary','Fire','Day'], related:['planetary-hour','fire','martial'] },
  { key:'lunar',      cat:'resources', symbol:'☽', name:'Lunar Essence',
    short:'Tidal essence drawn from the Moon\'s hour. Powers dreams, scrying, and Tarot spreads.',
    body:'Lunar Essence ebbs and flows with the Moon\'s passage through the planetary hours. It is cold, reflective, and deeply tied to intuition, dreams, and hidden knowledge. Tarot spreads consume Lunar Essence to draw and empower cards. It also fuels scrying rituals and the maintenance of the Dormitorium\'s dream-vision cycle. The Moon governs Mondays and pools most intensely at Lunar Convergence Points across the city.',
    tags:['Planetary','Water','Night'], related:['tarot','scrying','convergence-point'] },
  { key:'jovian',     cat:'resources', symbol:'♃', name:'Jovian Essence',
    short:'Expansive essence of Jupiter. Fuels recruitment, growth rites, and building upgrades.',
    body:'Jovian Essence carries the expansive, beneficent quality of Jupiter — the greater benefic of classical astrology. It is associated with growth, luck, patronage, and the broadening of influence. In the Lair, it is consumed when recruiting new Acolytes, upgrading buildings beyond their base level, and performing rites of expansion. Jovian hours tend to be brief but generous. Jupiter rules Thursdays.',
    tags:['Planetary','Air','Expansion'], related:['recruit','buildings','acolyte'] },
  { key:'martial',    cat:'resources', symbol:'♂', name:'Martial Essence',
    short:'Aggressive essence of Mars. Powers combat abilities, weapon crafting, and war rites.',
    body:'Martial Essence is the most combative of the seven. Drawn from the hour of Mars, it fuels active combat skills, the forging of weapons in the Alchemical Forge, and rites of protection and aggression. High Martial reserves give your party a passive combat damage bonus. Mars rules Tuesdays and is associated with iron, blood, and the severing of obstacles. It is not subtle — those who accumulate too much without spending it find their Acolytes growing restless.',
    tags:['Planetary','Fire','Combat'], related:['combat','alchemical-forge','fortitude'] },
  { key:'saturnine',  cat:'resources', symbol:'♄', name:'Saturnine Essence',
    short:'Heavy, slow essence of Saturn. Enables deep research, seals, and binding rites.',
    body:'The rarest and most ponderous of the seven essences. Saturnine Essence accumulates slowly — Saturn\'s planetary hours are long and cold, and the planet is associated with limitation, time, and ancient knowledge. It is required for the deepest research tiers, for strengthening the Seals that keep the lair from collapsing inward, and for binding rites that permanently alter Acolyte traits. Saturn rules Saturdays. Do not rush it.',
    tags:['Planetary','Earth','Research'], related:['research','seals','scriptorium'] },
  { key:'venusian',   cat:'resources', symbol:'♀', name:'Venusian Essence',
    short:'Harmonious essence of Venus. Reduces Acolyte stress and empowers Tarot and social rites.',
    body:'Venusian Essence is associated with harmony, beauty, desire, and the bonds between people. It reduces Acolyte Stress when spent in the Dormitorium, enhances the power of Tarot spreads, and is used in recruitment rites to draw specific personality types. Venus rules Fridays and is considered the lesser benefic — its hours are among the most pleasant to work within. High Venusian reserves passively reduce stress accumulation across the entire company.',
    tags:['Planetary','Water','Social'], related:['stress','tarot','acolyte'] },
  { key:'mercurial',  cat:'resources', symbol:'☿', name:'Mercurial Essence',
    short:'Quick, mutable essence of Mercury. Accelerates research, decoding, and communication.',
    body:'Mercurial Essence is the most mutable and fast-moving of the seven. Mercury governs communication, writing, decoding, travel, and trade. In the Lair, Mercurial Essence accelerates all ongoing research, powers Glyph Inscription skills, and is consumed during the decoding of ancient texts found in the field. Mercury rules Wednesdays and its hours shift quickly — pay attention to when they begin, for the window to work is short.',
    tags:['Planetary','Air','Research'], related:['research','glyph','scriptorium'] },

  // STATS
  { key:'fortitude',  cat:'stats', symbol:'🜂', name:'Fortitude',
    short:'Fire element stat. Raw physical endurance and the capacity to absorb punishment.',
    body:'Fortitude is the primary Fire element stat. It determines how much physical damage a character can absorb before being downed, and governs resistance to Bleeding and Burning status effects. High Fortitude allows a character to hold the front ranks under sustained assault. It scales with the Martial Essence income of your lair — characters trained during Mars hours develop Fortitude faster.',
    tags:['Stat','Fire','Combat'], related:['fire','martial','combat'] },
  { key:'wrath',      cat:'stats', symbol:'🜂', name:'Wrath',
    short:'Fire element stat. Offensive power and the damage bonus on physical strikes.',
    body:'Wrath is the offensive Fire stat, governing the raw damage output of physical and fire-aligned attacks. A high Wrath score does not make a character reckless — it simply means their strikes land harder. Certain Afflictions (such as Abusive or Bloodthirsty) can cause Wrath to spike unpredictably, which is as dangerous to allies as it is to enemies.',
    tags:['Stat','Fire','Offense'], related:['fire','fortitude','affliction'] },
  { key:'intuition',  cat:'stats', symbol:'🜄', name:'Intuition',
    short:'Water element stat. Governs perception, trap detection, and resistance to psychic damage.',
    body:'Intuition is the primary Water stat. It determines a character\'s ability to perceive hidden things — concealed enemies, trap sigils embedded in dungeon walls, and the emotional states of recruits encountered in the field. High Intuition also grants resistance to psychic and Stress-based attacks, making it invaluable for long expeditions into the deeper sub-levels of the lair.',
    tags:['Stat','Water','Perception'], related:['water','stress','aether'] },
  { key:'empathy',    cat:'stats', symbol:'🜄', name:'Empathy',
    short:'Water element stat. Affects recruitment success, acolyte morale, and healing effectiveness.',
    body:'Empathy governs the social and restorative capacities of a character. A high Empathy score improves recruitment success rates when approaching potential Acolytes in the field, increases the effectiveness of healing skills, and reduces the Stress gain of nearby party members through passive morale support. It is the dominant stat of the Plague Scribe and Empath classes.',
    tags:['Stat','Water','Social'], related:['water','intuition','recruit'] },
  { key:'endurance',  cat:'stats', symbol:'🜃', name:'Endurance',
    short:'Earth element stat. Determines how long a character can act before needing rest.',
    body:'Endurance is the Earth element\'s measure of sustained capacity. It governs how many consecutive expeditions an Acolyte can undertake before requiring Dormitorium rest, their resistance to the Weakened and Exhausted debuffs, and their carry capacity for gathered resources. Earth is the element of patience and persistence — Endurance rarely shines in a single moment but wins long campaigns.',
    tags:['Stat','Earth','Sustain'], related:['earth','dormitorium','stress'] },
  { key:'memory',     cat:'stats', symbol:'🜃', name:'Memory',
    short:'Earth element stat. Governs skill slots, research contribution, and glyph retention.',
    body:'Memory is the most intellectual of the Earth stats. It determines how many active skills a character can hold simultaneously, how much their presence in the Scriptorium accelerates research, and their ability to retain decoded Glyphs as permanent passive bonuses. Memory can be damaged — certain psychic attacks and Afflictions reduce it temporarily or permanently. The Memory stat is uniquely vulnerable to the deeper horrors of the lair.',
    tags:['Stat','Earth','Knowledge'], related:['earth','endurance','scriptorium'] },
  { key:'cunning',    cat:'stats', symbol:'🜁', name:'Cunning',
    short:'Air element stat. Governs dodge chance, critical hit rate, and trap-laying.',
    body:'Cunning is the primary offensive Air stat. It determines a character\'s dodge chance in combat, their critical hit probability, and their ability to lay and detect trap-sigils during expeditions. High Cunning characters are slippery and unpredictable. The Hermeticist and Plague Scribe classes rely heavily on Cunning for their core abilities.',
    tags:['Stat','Air','Offense'], related:['air','speed','hermeticist'] },
  { key:'speed',      cat:'stats', symbol:'🜁', name:'Speed',
    short:'Air element stat. Determines turn order in combat and movement radius on the field map.',
    body:'Speed governs when a character acts in the combat turn queue — higher Speed means acting earlier, which can be decisive. It also affects how far a character\'s presence radiates on the Field map, slightly expanding the radius in which missions and recruits become visible. Air is the swiftest element and Speed is its purest expression.',
    tags:['Stat','Air','Initiative'], related:['air','cunning','combat'] },
  { key:'gnosis',     cat:'stats', symbol:'✦', name:'Gnosis',
    short:'Aether stat. The measure of your occult advancement and access to higher rites.',
    body:'Gnosis is the singular Aether stat — it stands apart from the four elemental categories and cannot be raised through ordinary training. It increases through research completion, successful Tarot readings, the discovery of hidden lore in the field, and the resolution of story events. Gnosis unlocks access to higher-tier research, new building functions, and eventually the deeper sub-levels of the lair itself. It is the true measure of how far you have descended.',
    tags:['Stat','Aether','Progression'], related:['aether','research','tarot'] },

  // MECHANICS
  { key:'planetary-hour', cat:'mechanics', symbol:'⌛', name:'Planetary Hour',
    short:'A division of day and night into 12 unequal hours, each ruled by one of the seven classical planets.',
    body:'The day is divided into 12 planetary hours from sunrise to sunset, and the night into 12 from sunset to sunrise. Each hour is governed by one of the seven classical planets in the Chaldean order: Saturn, Jupiter, Mars, Sun, Venus, Mercury, Moon. The first hour of the day is ruled by the day\'s ruling planet (Sunday = Sun, Monday = Moon, etc.), and subsequent hours follow the Chaldean sequence. The active planetary hour boosts the income of its corresponding resource by 50% and may empower or restrict specific rites and skills.',
    tags:['Mechanic','Time','Astrology'], related:['solar','lunar','jovian','martial','saturnine','venusian','mercurial'] },
  { key:'stress',     cat:'mechanics', symbol:'⚠', name:'Stress',
    short:'A hidden wound of the mind. When it fills, Acolytes break — gaining Afflictions or, rarely, Virtues.',
    body:'Every Acolyte carries a Stress meter from 0 to 100. Stress accumulates through combat encounters, particularly through psychic attacks, failed checks, and the death of companions. At 100, the Acolyte enters a Breakdown — they randomly acquire an Affliction (a permanent negative quirk) or, rarely, a Virtue (a permanent positive one). Stress can be reduced in the Dormitorium, through Venusian rites, and by spending Venusian Essence. An Acolyte whose Stress reaches 100 three times without resolution may be permanently lost.',
    tags:['Mechanic','Combat','Mental'], related:['affliction','virtue','dormitorium','venusian'] },
  { key:'affliction', cat:'mechanics', symbol:'▽', name:'Affliction',
    short:'A permanent negative psychological trait gained when an Acolyte breaks under Stress.',
    body:'Afflictions are the scars left by trauma. They manifest as permanent personality traits that impose mechanical penalties: Paranoid acolytes act erratically in combat; Abusive ones damage party morale; Masochistic ones resist healing. Afflictions can sometimes be removed through specific research, rare rites, or story events — but never easily. Some classes, notably the Flagellant, are designed to function despite or even because of certain Afflictions.',
    tags:['Mechanic','Mental','Permanent'], related:['stress','virtue','flagellant'] },
  { key:'virtue',     cat:'mechanics', symbol:'✨', name:'Virtue',
    short:'A rare positive psychological trait. Gained when an Acolyte breaks under Stress but emerges stronger.',
    body:'Virtues are the inverse of Afflictions — they emerge when an Acolyte breaks but finds something within the breaking. Courageous Acolytes gain bonus accuracy when below half HP; Stalwart ones resist Stress gain passively; Focused ones critically hit more often. Virtues are rarer than Afflictions and cannot be deliberately triggered. They cannot be removed. Treat them as gifts from the darkness.',
    tags:['Mechanic','Mental','Permanent'], related:['stress','affliction'] },
  { key:'convergence-point', cat:'mechanics', symbol:'⬡', name:'Convergence Point',
    short:'A real-world location in your city where planetary essence pools intensely during specific hours.',
    body:'Convergence Points are locations on your city\'s map where the geometry of streets, the age of foundations, or the memory of past events creates a resonance with one of the seven planetary forces. When you physically visit a Convergence Point during the matching planetary hour, your resource income for that essence is massively amplified — up to 5× the normal rate. Points are discovered through research in the Scriptorium and decoded from Glyph inscriptions. Their positions shift slowly with the seasons.',
    tags:['Mechanic','GPS','Field'], related:['planetary-hour','scriptorium','glyph'] },
  { key:'glyph',      cat:'mechanics', symbol:'⬡', name:'Glyph',
    short:'An inscribed occult symbol found in the field or lair that encodes hidden information or power.',
    body:'Glyphs are the written language of whatever made the lair. They appear on walls, beneath flagstones, carved into older structures of the city. When decoded — a process that costs Mercurial Essence and time in the Scriptorium — they yield one of three things: a map to a Convergence Point, a fragment of lore that advances a story chain, or a skill inscription that can be applied to an Acolyte. The Hermetic Alphabets research unlocks the ability to decode basic Glyphs; deeper research opens more complex scripts.',
    tags:['Mechanic','Knowledge','Field'], related:['mercurial','scriptorium','convergence-point'] },

  // COMBAT
  { key:'combat',     cat:'combat', symbol:'⚔', name:'Combat',
    short:'Turn-based encounters triggered by missions or lair events. Initiative, positioning, and resource management are decisive.',
    body:'Combat in The Lair Below is turn-based, with each participant acting in Speed order. Your party occupies ranks 1–4 (front to back); enemies mirror this. Most skills have rank restrictions — a Flagellant can only strike from ranks 1–2, while a Plague Scribe operates best from ranks 3–4. Damage types include Physical, Blight (damage over time), Holy (effective against darkness), Psychic (targets Stress rather than HP), and Elemental. Positioning is permanent unless a skill moves a character, making initial formation critical.',
    tags:['Combat','Core','Mechanic'], related:['stress','blight','rank','speed'] },
  { key:'blight',     cat:'combat', symbol:'☠', name:'Blight',
    short:'A damage-over-time effect. Applies a stack that deals damage at the start of each turn.',
    body:'Blight represents corruption, poison, or spiritual contamination. A Blighted character or enemy takes damage at the start of each turn equal to the Blight stack value. Multiple stacks accumulate additively. Some enemies are highly Blight-resistant (notably those of the Void sub-type); others are devastatingly vulnerable. Blight cannot be blocked but can be cleansed by certain skills. The Plague Scribe class specialises in Blight application.',
    tags:['Combat','Damage Type','Debuff'], related:['combat','plague-scribe','damage'] },
  { key:'rank',       cat:'combat', symbol:'⬛', name:'Rank',
    short:'Position in combat. Rank 1 is the front; Rank 4 is the rear. Skills have rank requirements.',
    body:'Combat positions are numbered 1 (front) through 4 (rear) for both parties. Most physical skills require the attacker to be in ranks 1 or 2 and target ranks 1 or 2. Ranged and magical skills typically operate from ranks 3–4 and can reach the enemy\'s back ranks. If a front-rank character is downed, all behind them shift forward. Managing rank displacement — either forcing enemies out of position or protecting your own formation — is central to combat strategy.',
    tags:['Combat','Positioning'], related:['combat','speed','cunning'] },

  // CLASSES
  { key:'hermeticist', cat:'classes', symbol:'🜏', name:'Hermeticist',
    short:'Your starting class. A scholar of occult correspondences — versatile, analytical, and dangerous at range.',
    body:'The Hermeticist is the default class for the player character. They specialize in Solar and Mercurial essence manipulation, translating esoteric knowledge into practical combat and field skills. Their signature ability, Hermetic Strike, scales with the Cunning stat and deals bonus Holy damage. At higher Gnosis levels they unlock Grand Rites — powerful rituals that consume planetary resources but can turn the tide of difficult encounters. They are not front-liners; keep them at rank 3–4.',
    tags:['Class','Player','Aether'], related:['cunning','solar','mercurial','gnosis'] },
  { key:'flagellant', cat:'classes', symbol:'🜃', name:'Flagellant',
    short:'A penitent warrior who weaponises self-destruction. Grows stronger as HP and sanity decline.',
    body:'The Flagellant is a front-rank brawler who operates at peak efficiency when wounded. Most of their skills deal bonus damage when they are below 50% HP, and their unique passive converts incoming Stress into temporary Wrath bonuses. They synergize poorly with healers (wasted resources) and well with Blight (they can absorb it). Their Affliction rate is high — Masochistic is almost universal — but this rarely impairs their function. Maurus is currently a Flagellant.',
    tags:['Class','Acolyte','Melee'], related:['wrath','fortitude','stress','affliction'] },
  { key:'plague-scribe', cat:'classes', symbol:'🜁', name:'Plague Scribe',
    short:'A scholar-archivist who weaponises decay. Specialises in Blight, Mercurial essence, and debuffing.',
    body:'The Plague Scribe operates from the back ranks, applying Blight stacks and debuffing enemy resistances. They consume Mercurial Essence as fuel for their inscriptions and grow more powerful when Mercurial income is high. Their weakness is fragility — low HP and poor physical defence mean they cannot survive in rank 1 or 2. Sister Irene Voss is currently a Plague Scribe. Their research contributions are doubled while stationed in the Scriptorium between expeditions.',
    tags:['Class','Acolyte','Ranged'], related:['blight','mercurial','memory','scriptorium'] },

  // BUILDINGS
  { key:'scriptorium', cat:'buildings', symbol:'†', name:'Scriptorium',
    short:'The lair\'s centre of knowledge. Here Acolytes research grimoires and decode Glyphs.',
    body:'The Scriptorium is where the intellectual work of the lair is done. Assign Acolytes with high Memory stats to accelerate research. Each active research consumes resources over time and yields a completion reward — new skills, unlocked buildings, decoded Convergence Points, or expanded Acolyte class options. The Scriptorium can be upgraded to run multiple simultaneous research projects. Plague Scribes double their contribution when stationed here.',
    tags:['Building','Research','Lair'], related:['research','memory','glyph','mercurial'] },
  { key:'alchemical-forge', cat:'buildings', symbol:'⚗', name:'Alchemical Forge',
    short:'Transforms gathered planetary essences into equipment, consumables, and inscribed arms.',
    body:'The Alchemical Forge is where raw essence becomes usable craft. Recipes are unlocked through Scriptorium research and require varying combinations of planetary essences. Output includes: weapons with elemental damage type bonuses, armour with specific resistance profiles, consumables (Blight antidotes, stress-relief tonics, planetary attunement flasks), and inscribed sigil tokens that can be equipped for passive bonuses. The Forge runs passively but faster with a dedicated Acolyte assigned to it.',
    tags:['Building','Crafting','Lair'], related:['martial','saturnine','equipment'] },
  { key:'dormitorium', cat:'buildings', symbol:'◻', name:'Dormitorium',
    short:'Where Acolytes rest and recover Stress between expeditions. Dreams here may yield visions.',
    body:'The Dormitorium is the lair\'s recovery space. Acolytes stationed here between expeditions recover Stress at a base rate modified by their Endurance and the current Venusian Essence reserves. Occasionally, during Lunar hours, a resting Acolyte will experience a Dream Vision — a brief text event that may yield lore, modify a quirk, or unlock a hidden story branch. The Dormitorium can be upgraded to hold more Acolytes simultaneously.',
    tags:['Building','Recovery','Lair'], related:['stress','venusian','lunar','endurance'] },
  { key:'altar', cat:'buildings', symbol:'◈', name:'The Altar',
    short:'A ritual space for planetary rites. Amplifies resource gathering during specific hours.',
    body:'The Altar is the lair\'s ritual centre. Rites performed here cost planetary essence and time but yield significant returns: the Rite of the Silver Crescent triples Lunar income for a full Lunar cycle; the Solar Invocation empowers all Fire-type combat skills for 24 hours; the Saturn Binding strengthens the lair\'s Seals, reducing the chance of structural events. Only one rite can be active at a time. The Altar\'s power scales with the Altar\'s upgrade level and the Gnosis of the character performing the rite.',
    tags:['Building','Ritual','Lair'], related:['gnosis','planetary-hour','venusian','solar'] },

  // ARCANA
  { key:'tarot',      cat:'arcana', symbol:'☽', name:'Tarot',
    short:'A spread of cards drawn with Lunar Essence. Each card modifies game mechanics for its duration.',
    body:'Tarot spreads are performed in the Arcana tab. A standard Three Fates spread costs Lunar Essence and draws three cards from the Major Arcana. Each card applies a mechanical effect to your game state for the spread\'s duration — typically one full Lunar cycle. Cards may be Upright or Reversed; Reversed cards often invert the expected effect. The spread resets at the next Lunar hour. More complex spreads (Celtic Cross, Grand Tableau) are unlocked through research and require rarer resources.',
    tags:['Arcana','Mechanic','Lunar'], related:['lunar','major-arcana','gnosis'] },
  { key:'major-arcana', cat:'arcana', symbol:'🃏', name:'Major Arcana',
    short:'The 22 trump cards of the Tarot. Each carries a distinct archetypal force that reshapes the world when drawn.',
    body:'The 22 Major Arcana — from The Fool (0) to The World (XXI) — are the most powerful cards in the Tarot deck. When drawn in a spread, each applies a unique effect: The Hermit boosts research speed; The Tower (Reversed) causes controlled collapse that reduces Stress; Death clears all active Afflictions at a cost of HP; The Moon destabilises all mechanics slightly while massively increasing Lunar income. Learning the full range of Major Arcana effects is itself a form of occult knowledge.',
    tags:['Arcana','Tarot','Cards'], related:['tarot','lunar','gnosis'] },
  { key:'aether',     cat:'arcana', symbol:'✦', name:'Aether',
    short:'The fifth element. The medium through which the other four operate. Source of Gnosis.',
    body:'Aether is not a resource that can be gathered — it is the underlying medium of occult reality. The four elements (Fire, Water, Earth, Air) exist within and through it. In game terms, Aether manifests as Gnosis — the measure of your attunement to the deeper patterns beneath the city. High Gnosis does not make you stronger in the conventional sense; it makes more of the world legible to you, opening doors that would otherwise remain walls.',
    tags:['Arcana','Element','Gnosis'], related:['gnosis','fire','water','earth','air'] },
  { key:'fire',       cat:'arcana', symbol:'🜂', name:'Fire',
    short:'The element of will, destruction, and transformation. Governs Fortitude and Wrath.',
    body:'Fire is the active, consuming element. It is associated with the Sun and Mars, with the colour red-gold, with iron and sulphur, with the South. In the Lair Below, Fire governs the stats of Fortitude and Wrath — the capacity to endure and the capacity to destroy. Fire-aligned skills deal bonus damage to creatures of darkness and Void, but are ineffective against certain elemental entities. The Hermeticist\'s Solar Banishment is a pure Fire skill.',
    tags:['Element','Arcana'], related:['fortitude','wrath','solar','martial'] },
  { key:'water',      cat:'arcana', symbol:'🜄', name:'Water',
    short:'The element of feeling, flow, and the hidden. Governs Intuition and Empathy.',
    body:'Water is the receptive, hidden element — the medium of dreams and deep knowing. Associated with the Moon and Venus, with silver, with the West and the colour blue-black. Water governs Intuition and Empathy. Water-aligned skills tend toward healing, debuffing, and perception enhancement rather than direct damage. The Scrying Chamber, when built, draws heavily on Water resonance.',
    tags:['Element','Arcana'], related:['intuition','empathy','lunar','venusian'] },
  { key:'earth',      cat:'arcana', symbol:'🜃', name:'Earth',
    short:'The element of substance, patience, and memory. Governs Endurance and Memory.',
    body:'Earth is the slow, patient element — the keeper of records and the weight of time. Associated with Saturn and Venus (in her terrestrial aspect), with lead and salt, with the North and deep green. Earth governs Endurance and Memory. It is the element most associated with the lair itself — the stone, the depth, the accumulated centuries of whatever dwelt here before you arrived. Earth-aligned skills tend toward passive bonuses, buffs, and structural effects.',
    tags:['Element','Arcana'], related:['endurance','memory','saturnine','venusian'] },
  { key:'air',        cat:'arcana', symbol:'🜁', name:'Air',
    short:'The element of thought, speed, and communication. Governs Cunning and Speed.',
    body:'Air is the swift, mutable element — the carrier of messages and the medium of thought. Associated with Mercury and Jupiter, with quicksilver, with the East and pale yellow. Air governs Cunning and Speed. Air-aligned skills include illusions, movement abilities, debuffs to enemy accuracy, and the rapid transmission of essence across distances. The Plague Scribe\'s inscriptions draw on Air as much as on Earth.',
    tags:['Element','Arcana'], related:['cunning','speed','mercurial','jovian'] },

  // BUILDINGS — expanded entries
  { key:'ossuary', cat:'buildings', symbol:'☽', name:'Ossuary',
    short:'An excavated chamber of ancient remains. Seeps Saturnine essence passively.',
    body:'The Ossuary is not built — it is uncovered. Behind a collapsed section of the lower lair lies a room whose walls are threaded with bone older than the structure itself. At Level 1 it yields 2 Saturnine essence per hour, requiring no active attention. At Level 2 the yield rises to 5/h and the chamber unlocks bone-craft recipes in the Forge: items that cannot be made any other way. The Ossuary makes no sound. It simply accumulates.',
    tags:['Building','Saturnine','Passive'], related:['saturnine','alchemical-forge','research'] },
  { key:'scrying-chamber', cat:'buildings', symbol:'◎', name:'Scrying Chamber',
    short:'A dark-glass room. Extends your map radius and reveals hidden field encounters during Lunar hours.',
    body:'The Scrying Chamber requires a significant investment of Lunar and Mercurial essence to construct. In return, it permanently extends your visible map radius — by 50% at Level 1, doubled at Level 2. More importantly, it allows you to perform an active Scry: spending 200 Lunar essence to trigger a full refresh of all world events and reveal any DM-placed encounters that might otherwise require you to physically approach. At Level 2 certain event markers appear before you reach them, giving you time to prepare.',
    tags:['Building','Lunar','Map'], related:['lunar','mercurial','convergence-point'] },

  // TAROT MECHANICS — new entries
  { key:'tarot-spread', cat:'arcana', symbol:'☽', name:'Three Fates Spread',
    short:'The standard spread. Three cards drawn with Lunar essence. Effects stack and last until the next Lunar hour.',
    body:'The Three Fates spread draws one card for the Past (what has shaped the moment), one for the Present (what acts now), and one for the Future (what approaches). Each card applies a distinct mechanical effect. Effects from the same type replace rather than stack — but effects of different types accumulate. A well-chosen spread can dramatically alter your session: cleansing all stress, doubling resource income, or granting effects that no other system can replicate. The spread costs 200 Lunar essence and resets at the following Lunar hour.',
    tags:['Arcana','Tarot','Spread'], related:['tarot','lunar','major-arcana'] },
  { key:'reversed', cat:'arcana', symbol:'▽', name:'Reversed Card',
    short:'A card drawn upside-down. Often inverts the expected effect — not always badly.',
    body:'When a card is drawn reversed, its energy is inverted or blocked. This does not always mean harm — The World reversed still improves income, The Hanged Man reversed simply pauses it rather than accelerating research. But some reversals are genuinely dangerous: The Empress reversed distributes stress across all acolytes; The Devil reversed degrades Memory. Whether a reversal lands well depends entirely on which card turns up. This uncertainty is part of the ritual.',
    tags:['Arcana','Tarot','Mechanic'], related:['tarot','major-arcana','tarot-spread'] },

  // LAIR ROOMS
  { key:'lair-depth', cat:'mechanics', symbol:'▽', name:'Lair Depth',
    short:'How deep your lair extends. Depth determines which rooms can be excavated and what threats emerge.',
    body:'The lair is not a static space. As Gnosis increases and specific research is completed, new sub-levels become accessible. Depth I is the Antechamber — the starting rooms you inhabit. Depth II requires completing the First Seal research and yields the Ossuary and Scrying Chamber. Depth III is theoretical: rumoured to contain a room with no defined function and a door that opens outward rather than in. No one has reached it.',
    tags:['Mechanic','Lair','Progression'], related:['gnosis','research','ossuary','scrying-chamber'] },

  // SKILL CHECK mechanic
  { key:'skill-check', cat:'mechanics', symbol:'⌛', name:'Skill Check',
    short:'A test of one acolyte\'s stat against a difficulty number. Failure costs something; success yields something.',
    body:'Skill checks appear in DM-authored events. An event might require your most Cunning acolyte to evade detection, or your highest Memory character to decode an inscription under pressure. The check is made by rolling a virtual die and adding the relevant stat — if the total meets or exceeds the difficulty, the acolyte succeeds. Some checks require the entire roster to attempt in sequence. Consequences for failure vary: stress, essence loss, narrative setbacks. There is no mechanic to avoid the roll.',
    tags:['Mechanic','Combat','Events'], related:['stress','fortitude','cunning','events'] },
  { key:'events', cat:'mechanics', symbol:'⚠', name:'Field Events',
    short:'Encounters that appear on the map near your location. Each type — combat, gather, story, recruit — resolves differently.',
    body:'Field events appear as coloured markers on the map. Red markers are combat encounters; blue-indigo are story events that play out as narrative choices; green are gathering sites that yield resources during specific planetary hours; amber are recruit encounters. DM-placed events are permanent until resolved or deleted. Random events are generated by the DM and offset from player positions — they appear within walking distance and disappear once activated. Resolving any event removes it from your visible map.',
    tags:['Mechanic','Field','Map'], related:['combat','convergence-point','planetary-hour'] },
];

var currentTooltipKey = null;

var currentCodexCat = 'all';

var currentCodexSearch = '';

var FB_URL = 'https://lairbelow-default-rtdb.firebaseio.com';

var _characterData = null;

var _acolytesData  = null;

var _lairData      = null;

var _researchData  = null;

var _pendingExchanges = {};

var _resolvedExchanges = new Set();

var _shownExchanges = new Set();

var _iemTimerInterval = null;

var _journalEntryIds = new Set();

var _shownDmEvents    = new Set();

var _shownBroadcasts  = new Set();

var _dmEventQueue     = [];

var _dmEventShowing   = false;

var _worldSkills = null;

var _activeRites = {};

var _ccData = { name:'', coven:'', classKey:'', classData:null, stats:{}, traits:[], basePoints:15 };

var _ccAllClasses = {};

var _worldTraits = {};

var RECIPES = [
  { key:'solar-brand', cat:'weapons', icon:'△', name:'Solar Brand', type:'Weapon — One-handed',
    desc:'A blade inscribed with Solar sigils. Deals +4 Holy damage and ignites Blighted enemies on hit.',
    effect:'+4 Holy damage · Ignite on Blight', color:'#c9a84c',
    costs:[{res:0,symbol:'☉',name:'Solar',amount:300},{res:3,symbol:'♂',name:'Martial',amount:150}] },
  { key:'merc-stiletto', cat:'weapons', icon:'†', name:'Mercurial Stiletto', type:'Weapon — Finesse',
    desc:'A slim blade treated with Mercurial essence. Grants +15% critical hit chance and bypasses 30% armour.',
    effect:'+15% Crit · 30% Armour Pierce', color:'#4a7a8b',
    costs:[{res:6,symbol:'☿',name:'Mercurial',amount:250},{res:3,symbol:'♂',name:'Martial',amount:100}] },
  { key:'lunar-veil', cat:'armour', icon:'☽', name:'Lunar Veil', type:'Armour — Cloak',
    desc:'Woven from moonlit thread and Lunar essence. Reduces incoming Stress by 20% and grants +10 Dodge.',
    effect:'−20% Stress taken · +10 Dodge', color:'#8b8ba0',
    costs:[{res:1,symbol:'☽',name:'Lunar',amount:280},{res:5,symbol:'♀',name:'Venusian',amount:120}] },
  { key:'saturn-plate', cat:'armour', icon:'◈', name:'Saturnine Plate', type:'Armour — Heavy',
    desc:'Dense iron inscribed with Saturn\'s binding seals. Grants +8 HP and 40% Blight resistance.',
    effect:'+8 Max HP · 40% Blight Resist', color:'#8b7355',
    costs:[{res:4,symbol:'♄',name:'Saturnine',amount:200},{res:3,symbol:'♂',name:'Martial',amount:180}] },
  { key:'blight-antidote', cat:'consumables', icon:'○', name:'Blight Antidote', type:'Consumable — Combat',
    desc:'A vial of Jovian essence purified through Venus. Instantly clears all Blight stacks from one character.',
    effect:'Clears all Blight · Single target', color:'#6b4c8b',
    costs:[{res:2,symbol:'♃',name:'Jovian',amount:120},{res:5,symbol:'♀',name:'Venusian',amount:80}] },
  { key:'stress-tonic', cat:'consumables', icon:'▽', name:'Venusian Stress Tonic', type:'Consumable — Rest',
    desc:'A calming draught brewed under Venus. Reduces one Acolyte\'s Stress by 30 when consumed outside combat.',
    effect:'−30 Stress · Single Acolyte', color:'#5c8b5c',
    costs:[{res:5,symbol:'♀',name:'Venusian',amount:200},{res:1,symbol:'☽',name:'Lunar',amount:100}] },
  { key:'jupiter-seal', cat:'sigils', icon:'✦', name:'Seal of Jupiter', type:'Sigil Token — Passive',
    desc:'A carved token that resonates with Jovian expansion. Equipped bearer gains +10% to all resource income.',
    effect:'+10% All Resource Income', color:'#6b4c8b',
    costs:[{res:2,symbol:'♃',name:'Jovian',amount:300},{res:0,symbol:'☉',name:'Solar',amount:150}] },
  { key:'mercury-cipher', cat:'sigils', icon:'⬡', name:"Mercury\'s Cipher", type:'Sigil Token — Passive',
    desc:'An inscribed disc that accelerates thought. Equipped bearer decodes Glyphs instantly and boosts research by 25%.',
    effect:'Instant Glyph Decode · +25% Research', color:'#4a7a8b',
    costs:[{res:6,symbol:'☿',name:'Mercurial',amount:250},{res:4,symbol:'♄',name:'Saturnine',amount:100}] },
];

var NEARBY_RADIUS_M = 100;

var RES_SYMBOLS = ['☉','☽','♃','♂','♄','♀','☿'];

var RES_NAMES   = ['Solar','Lunar','Jovian','Martial','Saturnine','Venusian','Mercurial'];

var ACOLYTE_NAMES = [
  'Milo Vetch', 'Sable Orin', 'Cassia Fell', 'Drest Avon', 'Irenea Moss',
  'Orin Lach', 'Thessaly Brun', 'Wren Cault', 'Piers Edda', 'Nola Grim',
  'Dorian Carse', 'Ysabel Krath', 'Emris Dun', 'Calla Voss', 'Hadden Ule',
  'Soren Falk', 'Maren Ast', 'Tobren Gault', 'Lysa Craw', 'Aldric Mourn',
];

var ACOLYTE_CLASSES = {
  'flagellant': {
    glyph: '✕',
    lore: [
      `The marks on their hands are old. They bear them without apology.`,
      `Something in their posture suggests they have survived worse than this street.`,
      `They carry no visible weapon. They do not need one.`,
    ],
    stats: { fortitude:14, wrath:12, intuition:8, empathy:6, endurance:13, memory:7, cunning:9, gnosis:0, speed:9 },
  },
  'plague-scribe': {
    glyph: '◇',
    lore: [
      `Their fingers are stained with something that does not wash out. They are watching you count the letters in your name.`,
      `A satchel of journals. Too many journals. Their eyes move faster than their feet.`,
      `They smell faintly of a library that burned down. They seem proud of this.`,
    ],
    stats: { fortitude:7, wrath:6, intuition:13, empathy:9, endurance:8, memory:15, cunning:14, gnosis:2, speed:8 },
  },
  'hermeticist': {
    glyph: '◈',
    lore: [
      `The geometry of their stance is slightly wrong — too deliberate. They know how they look from the outside.`,
      `A small notebook, constantly referenced. They pause mid-sentence to write something and will not say what.`,
      `Their coat has pockets in places coats do not usually have pockets.`,
    ],
    stats: { fortitude:8, wrath:8, intuition:14, empathy:10, endurance:9, memory:13, cunning:15, gnosis:3, speed:10 },
  },
};

var APPROACH_TYPES = [
  {
    id: 'direct',
    glyph: '—',
    label: 'Address them directly',
    sub: 'Name what you are. Let them decide.',
    requires: null,
    successChance: 0.6,
    successLore: [
      'They hold your gaze for longer than is comfortable. Then: "I wondered when someone would."',
      `A pause. They look at something behind you that isn't there. "Yes," they say. "Yes, I think so."`,
      `They exhale. "I've been standing here for an hour. I wasn't sure you'd come."`,
    ],
    failLore: [
      'They take one step back. "You have the wrong person." They believe it.',
      `Their expression closes. "I don't know what you're talking about." They leave too quickly.`,
      `"No." Quiet, final. They don't run — they don't need to.`,
    ],
  },
  {
    id: 'oblique',
    glyph: '⟋',
    label: 'Speak in signs',
    sub: 'Reference the hour. The alignment. Let them prove they understand.',
    requires: null,
    successChance: 0.7,
    successLore: [
      'They complete your sentence. Wrong planet, but the right constellation. Close enough.',
      'They pull back their sleeve to show you something. An old scar in a very specific pattern.',
      `Their head tilts. "How did you know about the third house?" You didn't say third house. "Neither did I," they add.`,
    ],
    failLore: [
      `Confusion, then suspicion. "Are you all right?" They think you're unwell.`,
      'They nod slowly, as though humouring you, then make an excuse about somewhere to be.',
      'They laugh. Not meanly — just genuinely baffled. The moment is gone.',
    ],
  },
  {
    id: 'ritual',
    glyph: '△',
    label: 'Invoke the mark',
    sub: 'Draw the sigil. Some recognize it before they know what it means.',
    requires: { stat: 'gnosis', min: 3 },
    successChance: 0.85,
    successLore: [
      'Their pupils contract. A breath. "Where did you learn that." Not a question.',
      'They touch something at their throat — hidden, small. "I thought I was the only one who remembered."',
      `They step forward. "Don't draw that in the open. Come with me."`,
    ],
    failLore: [
      `Nothing. They don't recognise it. A civilian. You've frightened them.`,
      'They recognise it — and back away. Wrong faction. Wrong lair. Bad luck.',
      'Their face goes carefully blank. "Excuse me." They take a different street entirely.',
    ],
  },
  {
    id: 'offer',
    glyph: '○',
    label: 'Make an offer',
    sub: 'Some are not found — they are purchased. Curiosity, safety, purpose.',
    requires: null,
    successChance: 0.75,
    successLore: [
      `"Purpose." They say the word like they've been waiting to hear it. "You're offering purpose."`,
      'They name a price — not in money. A question answered. You answer it.',
      '"Three months," they say. "Then I decide." You nod. Everyone says three months.',
    ],
    failLore: [
      `"You can't afford what I actually want." They're probably right.`,
      `They consider it. Genuinely, seriously. Then: "Not yet." Not never.`,
      `Wrong offer. They wanted something different — you read them wrong. They don't say so.`,
    ],
  },
];

var _recruitmentState = null;

var _equippingAcolyteId = null;

var _teachingAcolyteId = null;

var _pendingLevelUp = null;

// Theme restore
(function() {
  var saved = localStorage.getItem('llair_theme');
  if (saved === 'light') document.documentElement.classList.add('light');
})()