const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let lastClickTime = 0;
const DOUBLE_CLICK_DELAY = 300; // milliseconds
let singleClickTimeout = null;

let playerAbsolutism = {
  blue: 0,  // 0 to 100, %
  red: 0
};

let globalFoodStorage = {
  blue: 1000, // initialized or from starting game state
  red: 1000
};

const foodRingMult = {
  outer: {
    desert: 0.2,
    plains: 1.0,
    woods: 0.6,
    hills: 0.8,
    mountains: 0.5,
    coast: 1.2,
    water: 0.2
  },
  inner: {
    hamlet: 0.8,
    town: 0.7,
    city: 0.6,
    metropolis: 0.5,
    island: 1.0,
  }
};

// Simple beep sound for illegal actions
const illegalSound = new Audio('data:audio/wav;base64,UklGRhQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0Yf///w=='); 
// This is a very short silent wav, replace with your preferred beep base64, or valid URL

// Turn display label
const roundLabel = document.getElementById('roundLabel');
roundLabel.textContent = `Round ${round}`;
roundLabel.style.color = currentPlayer;

// Centralized function to update captures based on current tokens (called only at endTurn!)
function updateAllCaptures() {
    for(const hex of board) {
        ['inner', 'outer'].forEach(ring => {
            const blueCount = Object.values(hex.tokens[ring].blue || {}).reduce((a,b) => a + b, 0);
            const redCount = Object.values(hex.tokens[ring].red || {}).reduce((a,b) => a + b, 0);
            const capture = getCapture(hex);
            if(blueCount > redCount) {
                capture[ring] = 'blue';
            } else if(redCount > blueCount) {
                capture[ring] = 'red';
            }
            // Tie or zero units: keep existing capture owner unchanged
        });
    }
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function populationGrowth() {
  function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }

  let blueFood = globalFoodStorage.blue;
  let redFood = globalFoodStorage.red;

  for (const hex of board) {
    const capture = getCapture(hex);

    for (const ring of ['inner', 'outer']) {
      const owner = capture[ring];
      if (owner !== 'blue' && owner !== 'red') continue;  // Skip unowned rings
      
      const vars = ring === 'inner' ? hex.innerVariables : hex.outerVariables;
      if (!vars) continue;
      const population = vars.population || 0;
      if (population <= 0) continue;

      vars.foodStockpile = vars.foodStockpile || 0;
      let foodNeeded = population;
      
      // Subtract food needed locally first
      vars.foodStockpile -= foodNeeded;

      if (vars.foodStockpile < 0) {
        const neededFood = -vars.foodStockpile;

        if (owner === 'blue') {
          const foodUsed = Math.min(neededFood, blueFood);
          vars.foodStockpile += foodUsed;
          blueFood -= foodUsed;

          if (vars.foodStockpile < 0) {
            const starvation = -vars.foodStockpile;
            vars.foodStockpile = 0;
            let currentPop = population;
            for (let i=0; i<starvation && currentPop > 0; i++) {
              currentPop--;
              if (blueFood < 0) blueFood = Math.min(blueFood + 1, 0);
            }
            vars.population = currentPop;
          }
        } else if (owner === 'red') {
          const foodUsed = Math.min(neededFood, redFood);
          vars.foodStockpile += foodUsed;
          redFood -= foodUsed;

          if (vars.foodStockpile < 0) {
            const starvation = -vars.foodStockpile;
            vars.foodStockpile = 0;
            let currentPop = population;
            for (let i=0; i<starvation && currentPop > 0; i++) {
              currentPop--;
              if (redFood < 0) redFood = Math.min(redFood + 1, 0);
            }
            vars.population = currentPop;
          }
        }
      }
    }
  }

  globalFoodStorage.blue = clamp(blueFood, 0, Number.MAX_SAFE_INTEGER);
  globalFoodStorage.red = clamp(redFood, 0, Number.MAX_SAFE_INTEGER);

  // Now apply population growth only to owned rings
  for (const hex of board) {
    const capture = getCapture(hex);

    for (const ring of ['inner', 'outer']) {
      const owner = capture[ring];
      if (owner !== 'blue' && owner !== 'red') continue;

      const vars = ring === 'inner' ? hex.innerVariables : hex.outerVariables;
      if (!vars) continue;
      let pop = vars.population || 0;
      if (pop <= 0) continue;

      const health = clamp(vars.health || 0, 0, 100) / 100;
      const happiness = clamp(vars.happiness || 0, 0, 100) / 100;
      const wealth = clamp(vars.wealth || 0, 0, 1000);
      const foodStock = vars.foodStockpile || 0;
      const literacy = clamp(vars.literacy || 0, 0, 100) / 100;
      const control = clamp(vars.control || 0, 0, 100);
      const devastation = Math.max(0, 100 - control) / 100;

      let wealthBonus = 0;
      if (wealth >= 800) wealthBonus = 0.05;
      else if (wealth >= 500) wealthBonus = 0.03;
      else if (wealth >= 200) wealthBonus = 0.02;

      const foodBonus = Math.min(foodStock / (2 * pop), 1) * 0.1;
      const literacyPenalty = -0.05 * literacy;
      const devastationPenalty = -0.1 * devastation;

      let growthRate = 1.0 + (health * 0.1) + (happiness * 0.05) + wealthBonus + foodBonus + literacyPenalty + devastationPenalty;

      growthRate = Math.max(growthRate, 0);
      growthRate = Math.ceil(growthRate * 100) / 100;

      vars.population = Math.floor(pop * growthRate);
      vars.growth = growthRate;
    }
  }
}

function manaGeneration() {
  const totals = {
    blue: { food: 0, foodProduction: 0, wealth: 0, science: 0, culture: 0, faith: 0, production: 0, population: 0, power: 0, absolutism: 0 },
    red: { food: 0, foodProduction: 0, wealth: 0, science: 0, culture: 0, faith: 0, production: 0, population: 0, power: 0, absolutism: 0 },
  };

  for (const hex of board) {
    const capture = getCapture(hex);

    ['inner', 'outer'].forEach(ring => {
      const owner = capture[ring];
      if (!owner) return;

      const vars = ring === 'inner' ? hex.innerVariables : hex.outerVariables;
      if (!vars) return;

      const control = (vars.control !== undefined ? vars.control : 0) / 100;

      const foodProduction = vars.foodProduction || 0;
      const wealth = vars.wealth || 0;
      const science = vars.science || 0;
      const culture = vars.culture || 0;
      const faith = vars.faith || 0;
      const power = vars.power || 0;
      const production = vars.production || 0;
      const happiness = (vars.happiness || 0) / 100;
      const crime = (100 - (vars.control || 0)) / 100 / 2;
      const health = (vars.health || 0) / 100;
      const literacy = (vars.literacy || 0) / 100;
      const tax = Math.floor(wealth / 10) / 100;

      const happinessMult = 1 + happiness;
      const crimeMult = 1 - crime;
      const healthMult = 1 + health;
      const taxMult = tax;
      const literacyMult = literacy;
      const controlMult = control;

      const terrainType = vars.innerType || vars.outerType || ring;
      const ringFoodMult = (foodRingMult[ring] && foodRingMult[ring][terrainType]) || 1;

      // Calculate raw food income with multipliers
      const rawFoodIncome = foodProduction * controlMult * happinessMult * crimeMult * healthMult * ringFoodMult;

      // Add food income first to local foodStockpile
      vars.foodStockpile = (vars.foodStockpile || 0) + rawFoodIncome;

      // Limit local stockpile to twice population
      const maxLocalFood = 5 * (vars.population || 0);

      // Spill excess food to global storage
      if (vars.foodStockpile > maxLocalFood) {
        const excess = vars.foodStockpile - maxLocalFood;
        vars.foodStockpile = maxLocalFood;
        totals[owner].food += excess;
      }

      // Accumulate total local food production (for UI in parentheses)
      totals[owner].foodProduction += rawFoodIncome;

      // Calculate other incomes
      const wealthIncome = wealth * controlMult * taxMult * happinessMult * crimeMult * healthMult;
      const scienceIncome = science * controlMult * literacyMult * happinessMult * crimeMult * healthMult;
      const cultureIncome = culture * controlMult * happinessMult * crimeMult * healthMult;
      const faithIncome = faith * controlMult * happinessMult * crimeMult * healthMult;
      const productionIncome = production * controlMult * happinessMult * crimeMult * healthMult;
      const powerIncome = power * controlMult * happinessMult * crimeMult * healthMult;
      const populationRaw = vars.population || 0;

      totals[owner].wealth += wealthIncome;
      totals[owner].science += scienceIncome;
      totals[owner].culture += cultureIncome;
      totals[owner].faith += faithIncome;
      totals[owner].power += powerIncome;
      totals[owner].production += productionIncome;
      totals[owner].population += populationRaw;
    });
  }

  totals.blue.absolutism = playerAbsolutism.blue;
  totals.red.absolutism = playerAbsolutism.red;

  // Add excess food to global storage
  globalFoodStorage.blue += totals.blue.food;
  globalFoodStorage.red += totals.red.food;

  // Max food based on population * 3
  const blueMaxFood = Math.floor(totals.blue.population * 30);
  const redMaxFood = Math.floor(totals.red.population * 30);

  // Clamp global food stock
  globalFoodStorage.blue = Math.min(Math.max(globalFoodStorage.blue, 0), blueMaxFood);
  globalFoodStorage.red = Math.min(Math.max(globalFoodStorage.red, 0), redMaxFood);

  function formatVal(curr, inc) {
    return `${Math.floor(curr)} (+${Math.floor(inc)})`;
  }
  function formatFood(curr, max, production) {
    return `${Math.floor(curr)} / ${max} (+${Math.floor(production)})`;
  }

  // Update UI with total population and other stats
  document.getElementById('bluePopulationValue').textContent = `${Math.floor(totals.blue.population)}`;
  document.getElementById('redPopulationValue').textContent = `${Math.floor(totals.red.population)}`;

  document.getElementById('blueGoldValue').textContent = formatVal(totals.blue.wealth, totals.blue.wealth);
  document.getElementById('blueScienceValue').textContent = formatVal(totals.blue.science, totals.blue.science);
  document.getElementById('blueCultureValue').textContent = formatVal(totals.blue.culture, totals.blue.culture);
  document.getElementById('blueFaithValue').textContent = formatVal(totals.blue.faith, totals.blue.faith);
  document.getElementById('blueProductionValue').textContent = formatVal(totals.blue.production, totals.blue.production);
  document.getElementById('bluePowerValue').textContent = formatVal(totals.blue.power, totals.blue.power);
  document.getElementById('blueFoodValue').textContent = formatFood(globalFoodStorage.blue, blueMaxFood, totals.blue.foodProduction);
  document.getElementById('blueAbsolutismValue').textContent = `${Math.floor(totals.blue.absolutism)}%`;

  document.getElementById('redGoldValue').textContent = formatVal(totals.red.wealth, totals.red.wealth);
  document.getElementById('redScienceValue').textContent = formatVal(totals.red.science, totals.red.science);
  document.getElementById('redCultureValue').textContent = formatVal(totals.red.culture, totals.red.culture);
  document.getElementById('redFaithValue').textContent = formatVal(totals.red.faith, totals.red.faith);
  document.getElementById('redProductionValue').textContent = formatVal(totals.red.production, totals.red.production);
  document.getElementById('redPowerValue').textContent = formatVal(totals.red.power, totals.red.power);
  document.getElementById('redFoodValue').textContent = formatFood(globalFoodStorage.red, redMaxFood, totals.red.foodProduction);
  document.getElementById('redAbsolutismValue').textContent = `${Math.floor(totals.red.absolutism)}%`;
}

  // Helpers
  function capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Update the ring interface popup (for selected hex & ring)
  function updateRingInterface(e) {
    const infoDiv = document.getElementById("infoDiv");
    const provinceTitle = document.getElementById("provinceTitle");
    const terrainDetails = document.getElementById("terrainDetails");
    const terrainStats = document.getElementById("terrainStats");
    const terrainResources = document.getElementById("terrainResources");
    const populationStats = document.getElementById("populationStats");
    const buildingsGrid = document.getElementById("buildingsGrid");
    document.getElementById("terrainContainer").style.display = "block";
    document.getElementById("populationContainer").style.display = "block";
    if (selectedHex && selectedRing) {
      const variables = selectedRing === 'inner' ? selectedHex.innerVariables : selectedHex.outerVariables;
      const popVal = variables.population || 0;
      const growthRate = variables.growth || 1.0; // fallback to 1.0
      const growthPercent = ((growthRate - 1) * 100).toFixed(1);
      populationContainer.querySelector('h3').textContent = `Population: ${popVal} (${growthPercent}%)`;
    }
    document.getElementById("buildingsContainer").style.display = "block";
    document.getElementById("tokenStatsContainer").style.display = "none";
    document.getElementById("tokenActionsContainer").style.display = "none";

    if (!selectedHex || !selectedRing) {
      // Hide if no selection
      infoDiv.style.display = "none";
      return;
    }

    infoDiv.style.display = "block";

    // Title: Province [row,col] - Inner/Outer Ring
    provinceTitle.textContent = `Province [${selectedHex.row},${selectedHex.col}] - ${capitalize(selectedRing)} Ring`;

    // Terrain details
    let terrainDesc = `<div><b>Terrain Type:</b> ${capitalize(selectedRing === 'inner' ? selectedHex.innerType : selectedHex.outerType)}</div>`;
    terrainDesc += `<div><b>River:</b> ${(selectedRing === 'outer' && selectedHex.hasRiver) ? 'Present' : 'None'}</div>`;

    const variables = selectedRing === 'inner' ? selectedHex.innerVariables : selectedHex.outerVariables;
    const controlPct = variables.control || 0;
    const devastationPct = 100 - controlPct;
    const foodStorage = variables.foodStockpile || 0;
    const maxFoodStorage = (variables.population || 0) * 5;
    terrainDesc += `<div><b>Food Storage:</b> ${Math.floor(foodStorage)}/${maxFoodStorage}</div>`;

    terrainDetails.innerHTML = terrainDesc;

    // Terrain stats grid (1 row, 4 columns)
    const localTax = variables.wealth ? Math.floor(variables.wealth / 10) : 0; 
    // crime% approximate from control
    const crimePct = variables.control !== undefined ? Math.floor((100 - variables.control) / 2) : 0;

    terrainStats.innerHTML = `
      <div><b>Control</b><br>${controlPct}%</div>
      <div><b>Devastation</b><br>${devastationPct}%</div>
      <div><b>Local Tax</b><br>${localTax}%</div>
      <div><b>Crime</b><br>${crimePct}%</div>
    `;

    // Terrain resources: Wood, Stone, Metals, Gems
    // Provide zero if undefined (add actual data as needed)
    const wood = variables.wood || 0;
    const stone = variables.stone || 0;
    const metals = variables.metals || 0;
    const gems = variables.gems || 0;

    terrainResources.innerHTML = `
      <div><b>Wood</b><br>${wood}</div>
      <div><b>Stone</b><br>${stone}</div>
      <div><b>Metals</b><br>${metals}</div>
      <div><b>Gems</b><br>${gems}</div>
    `;

    // Population grid (3 rows, 4 columns)
    // Row 1: population, growth, manpower, happiness
    // Row 2: science, production, food, wealth
    // Row 3: faith, culture, health, literacy

    function getVal(key) {
      if (!variables) return 0;
      return variables[key] !== undefined ? variables[key] : 0;
    }

    populationStats.innerHTML = `
      <div><b>Growth</b><br>${getVal("growth") || 0}%</div>
      <div><b>Health</b><br>${getVal("health") || 0}%</div>
      <div><b>Happiness</b><br>${getVal("happiness") || 0}%</div>
      <div><b>Literacy</b><br>${getVal("literacy") || 0}%</div>

      <div><b>Science</b><br>${getVal("science") || 0}</div>
      <div><b>Production</b><br>${getVal("production") || 0}</div>
      <div><b>Food</b><br>${getVal("foodProduction") || 0}</div>
      <div><b>Wealth</b><br>${getVal("wealth")}</div>

      <div><b>Faith</b><br>${getVal("faith") || 0}</div>
      <div><b>Culture</b><br>${getVal("culture") || 0}</div>
      <div><b>Power</b><br>${getVal("power")}</div>
      <div><b>Manpower</b><br>${getVal("manpower")}</div>
    `;

    // Buildings grid (3 rows, 3 columns)
    buildingsGrid.innerHTML = "";

    if (!selectedHex.ringBuildings) selectedHex.ringBuildings = {};
    if (!selectedHex.ringBuildings[selectedRing]) selectedHex.ringBuildings[selectedRing] = {};

    const ringBuildings = selectedHex.ringBuildings[selectedRing];

    for (const bName of buildingDisplayOrder) {
      const qty = ringBuildings[bName] || 0;
      const itemDiv = document.createElement("div");
      itemDiv.className = "building-item";

      const labelDiv = document.createElement("div");
      labelDiv.className = "building-label";
      labelDiv.textContent = bName;

      const qtyDiv = document.createElement("div");
      qtyDiv.className = "building-qty";
      qtyDiv.textContent = qty;

      itemDiv.appendChild(labelDiv);
      itemDiv.appendChild(qtyDiv);

      buildingsGrid.appendChild(itemDiv);
    }
  }

  // Update token interface, separate popup or reuse #infoDiv for tokens
function updateTokenInterface(e) {
  const infoDiv = document.getElementById("infoDiv");
  const provinceTitle = document.getElementById("provinceTitle");

  // Containers
  const terrainContainer = document.getElementById("terrainContainer");
  const populationContainer = document.getElementById("populationContainer");
  const buildingsContainer = document.getElementById("buildingsContainer");
  const tokenStatsContainer = document.getElementById("tokenStatsContainer");
  const tokenActionsContainer = document.getElementById("tokenActionsContainer");

  if (!selectedTokens.length) {
    infoDiv.style.display = "none";
    terrainContainer.style.display = "block";
    populationContainer.style.display = "block";
    buildingsContainer.style.display = "block";
    tokenStatsContainer.style.display = "none";
    tokenActionsContainer.style.display = "none";
    return;
  }

  infoDiv.style.display = "block";

  // Hide ring info, show token info
  terrainContainer.style.display = "none";
  populationContainer.style.display = "none";
  buildingsContainer.style.display = "none";
  tokenStatsContainer.style.display = "block";
  tokenActionsContainer.style.display = "block";

  if (selectedTokens.length === 1) {
    const t = selectedTokens[0];
    const baseProps = tokenClassProperties[t.classLetter] || {};
    const totalOffense = baseProps.offense * t.quantity;
    const totalHP = baseProps.hitpoints * t.quantity;

    provinceTitle.textContent = `Token Class ${t.classLetter} Detail`;

    // Build stats HTML
    const statsHtml = `
      <div><b>Quantity:</b> ${t.quantity}</div>
      <div><b>Player:</b> ${capitalize(t.player)}</div>
      <div><b>Ring:</b> ${t.ring}</div>
      <div><b>Cell:</b> [${t.hex.row},${t.hex.col}]</div>
      <div><b>Offense per unit:</b> ${baseProps.offense || 0}</div>
      <div><b>Total Offense:</b> ${totalOffense}</div>
      <div><b>Hitpoints per unit:</b> ${baseProps.hitpoints || 0}</div>
      <div><b>Total Hitpoints:</b> ${totalHP}</div>
    `;
    document.getElementById("tokenStats").innerHTML = statsHtml;

    // Actions empty for now
    document.getElementById("tokenActions").innerHTML = "";
  } else {
    provinceTitle.textContent = `Selected Tokens (${selectedTokens.length})`;

    // Summary of tokens in list
    const tokenList = selectedTokens
      .map(t => `Class: ${t.classLetter}, Qty: ${t.quantity}, Player: ${capitalize(t.player)}`)
      .join("<br>");
    document.getElementById("tokenStats").innerHTML = `<div>${tokenList}</div>`;

    document.getElementById("tokenActions").innerHTML = "";
  }
}

function findTokenAtPosition(x, y) {
  for (const hex of board) {
    for (const token of hex.tokenInstances) {
      if (token.quantity <= 0) continue;  // Skip non-visible tokens involved in queued moves

      const pos = token.getPosition();
      const dx = x - pos.x;
      const dy = y - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= HEX_RADIUS * 0.15) {
        return token;
      }
    }
  }
  return null;
}

// Utility: find hex and ring under click position (x,y)
// Returns {hex, ring} or null
function findRingAtPosition(x, y) {
  for (const hex of board) {
    const ring = hex.hitTestRing(x, y);
    if (ring) return { hex, ring };
  }
  return null;
}

// Handle clicks on tokens (any button click)
function handleTokenClick(e, token) {
  const isLeftClick = (e.button === 0);
  const isRightClick = (e.button === 2);

  if (isLeftClick) {
    const now = Date.now();

    // Cancel any pending single-click action on new click
    if (singleClickTimeout) {
      clearTimeout(singleClickTimeout);
      singleClickTimeout = null;
    }

    // Shift + left click: add tokens of same player & ring at hex to selection
    if (e.shiftKey) {
      const tokensToAdd = token.hex.tokenInstances.filter(t =>
        t.player === token.player &&
        t.ring === token.ring &&
        !selectedTokens.includes(t) &&
        t.quantity > 0
      );
      if (tokensToAdd.length > 0) {
        selectedTokens = selectedTokens.concat(tokensToAdd);
        selectedHex = token.hex;
        selectedRing = token.ring;
        document.getElementById('infoDiv').style.display = 'none';
        draw();
      }
      return;
    }

    // Double click detection: second click on same token within delay
    if (
      handleTokenClick.lastClick &&
      now - handleTokenClick.lastClick.time < DOUBLE_CLICK_DELAY &&
      handleTokenClick.lastClick.token === token
    ) {
      // Select all tokens for player & ring on this hex
      selectedHex = token.hex;
      selectedRing = token.ring;
      selectedTokens = token.hex.tokenInstances.filter(t =>
        t.player === token.player && t.ring === token.ring && t.quantity > 0
      );
      document.getElementById('infoDiv').style.display = 'none';
      draw();
      handleTokenClick.lastClick = null;
      e.preventDefault();
      return;
    }

    // Schedule single click action with delay for double-click detection
    singleClickTimeout = setTimeout(() => {
      if (token.quantity <= 0) {
        illegalSound.play();
        return;
      }
      if (selectedTokens.length === 1 && selectedTokens[0] === token) {
        // Deselect token
        selectedTokens = [];
        selectedHex = null;
        selectedRing = null;
        document.getElementById('infoDiv').style.display = 'none';
        draw();
      } else {
        // Select clicked token
        selectedTokens = [token];
        selectedHex = token.hex;
        selectedRing = token.ring;
        document.getElementById('infoDiv').style.display = 'none'; // hide popups on left click
        draw();
      }
      singleClickTimeout = null;
    }, DOUBLE_CLICK_DELAY);

    handleTokenClick.lastClick = { time: now, token };
  } 
  else if (isRightClick) {
    // Right click: immediately select clicked token without opening interface
    selectedTokens = [token];
    selectedHex = token.hex;
    selectedRing = token.ring;
    // Do NOT open token interface, just redraw
    draw();
    e.preventDefault();
  }
}


// Handle clicks on ring area (not on tokens)
function handleRingClick(e, hex, ring) {
  const isLeftClick = (e.button === 0);
  const isRightClick = (e.button === 2);

  if (isLeftClick) {
    // Left click: select ring (existing logic)
    selectedTokens = [];
    selectedHex = hex;
    selectedRing = ring;
    document.getElementById('infoDiv').style.display = 'none';
    draw();
  } else if (isRightClick) {
    if (selectedTokens.length === 0) {
    illegalSound.play();
    return;
  }
  
  const srcHex = selectedTokens[0].hex;
  const srcRing = selectedTokens[0].ring;
  
  if (!selectedTokens.every(t => t.hex === srcHex && t.ring === srcRing)) {
    illegalSound.play();
    alert("Select tokens from a single hex and ring to assign moves.");
    return;
  }
  
  const tokensByClass = {};
  for (const t of selectedTokens) {
    if (!tokensByClass[t.classLetter]) tokensByClass[t.classLetter] = 0;
    tokensByClass[t.classLetter] += t.quantity;
  }
  
  showQuantitySelectorMultiple(tokensByClass, selectedQuantities => {
    if (!selectedQuantities) return; // cancelled
  
    // For each class, assign queued move if quantity > 0
    for (const classLetter in selectedQuantities) {
      const qty = selectedQuantities[classLetter];
      if (qty > 0) {
        const ok = assignQueuedMove(srcHex, srcRing, classLetter, qty, hex, ring);
        if (!ok) break; // abort if invalid
      }
    }
    selectedTokens = [];
    selectedHex = null;
    selectedRing = null;
    draw();
  });

  }
}

// Main click handler on canvas
canvas.onmousedown = function (e) {
  e.preventDefault();

  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  // 1) Check token under click first
  const token = findTokenAtPosition(clickX, clickY);

  if (token) {
    handleTokenClick(e, token);
    return;
  }

  // 2) Else check ring under click
  const ringInfo = findRingAtPosition(clickX, clickY);
  if (ringInfo) {
    handleRingClick(e, ringInfo.hex, ringInfo.ring);
  }
};

// Disable default context menu on canvas (to allow right click handling)
canvas.oncontextmenu = function (e) {
  e.preventDefault();
};

document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'i') {
    const infoDiv = document.getElementById('infoDiv');
    // Toggle interface visibility
    if (infoDiv.style.display === 'block') {
      // Close interface
      infoDiv.style.display = 'none';
      selectedTokens = [];
      selectedHex = null;
      selectedRing = null;
      draw();
    } else {
      // Open interface: prefer token interface if tokens selected, else ring interface
      if (selectedTokens.length > 0) {
        updateTokenInterface();
      } else if (selectedHex && selectedRing) {
        updateRingInterface();
      }
      // If no selection, do nothing (stay hidden)
    }
  } else if (e.key === 'Escape') {
    const infoDiv = document.getElementById('infoDiv');
    if (infoDiv.style.display === 'block') {
      infoDiv.style.display = 'none';
      selectedTokens = [];
      selectedHex = null;
      selectedRing = null;
      draw();
    }
  } else if (e.key.toLowerCase() === 'p') {
    productionInterfaceVisible = !productionInterfaceVisible;
    productionInterface.style.display = productionInterfaceVisible ? 'grid' : 'none';
    selectedProductionBuilding = null;
    updateProductionBuildingGrid();
    updateProductionLinesUI();
    updateCursor();
    draw();
  }
});


function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  board.forEach(hex => hex.draw(ctx));
  highlightMoveTargets();  // optional for move assignment highlighting
  drawQueuedMoves(ctx);    // Draw boots + labels for queued moves (no arrows now)
}

closeProductionBtn.addEventListener('click', () => {
  productionInterfaceVisible = false;
  productionInterface.style.display = 'none';
  selectedProductionBuilding = null;
  updateCursor();
  draw();  
});



// Show production interface toggled by player clicking production mana bar container
const blueProdContainer = document.getElementById('blueProductionValue').parentNode;
const redProdContainer = document.getElementById('redProductionValue').parentNode;

blueProdContainer.style.cursor = 'pointer';
redProdContainer.style.cursor = 'pointer';

blueProdContainer.addEventListener('click', () => {
  if (currentPlayer === PLAYERS.BLUE) {
    productionInterfaceVisible = !productionInterfaceVisible;
    productionInterface.style.display = productionInterfaceVisible ? 'grid' : 'none';
    selectedProductionBuilding = null;
    updateProductionBuildingGrid();
    updateProductionLinesUI();
  }
});

redProdContainer.addEventListener('click', () => {
  if (currentPlayer === PLAYERS.RED) {
    productionInterfaceVisible = !productionInterfaceVisible;
    productionInterface.style.display = productionInterfaceVisible ? 'grid' : 'none';
    selectedProductionBuilding = null;
    updateProductionBuildingGrid();
    updateProductionLinesUI();
  }
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (!selectedProductionBuilding) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const ringHit = findRingAtPosition(x, y);
  if (!ringHit) {
    return;
  }
  if (ringHit.ring !== 'inner') {
    return;
  }

  const capture = getCapture(ringHit.hex);
  if (!capture.inner || capture.inner !== currentPlayer) {
    return;
  }

  // Get existing quantity of that building in inner ring
  const existingQty = (ringHit.hex.ringBuildings && ringHit.hex.ringBuildings.inner && ringHit.hex.ringBuildings.inner[selectedProductionBuilding]) || 0;

  // Calculate dynamic cost and turns
  const baseCost = buildingProductionData[selectedProductionBuilding].cost;
  const baseTurns = buildingProductionData[selectedProductionBuilding].turns;

  const scaledCost = baseCost + existingQty * 100;
  const scaledTurns = baseTurns + existingQty * 1;

  // Get current production resource (parse value before '(')
  const prodElement = currentPlayer === PLAYERS.BLUE ? document.getElementById('blueProductionValue') : document.getElementById('redProductionValue');
  const prodText = prodElement.textContent;
  const currentProd = parseInt(prodText.split(' ')[0], 10) || 0;

  // Check for any existing production line in this ring on this hex
  const currentLines = currentPlayer === PLAYERS.BLUE ? productionLinesBlue : productionLinesRed;
  const exists = currentLines.some(line => 
    line.hex === ringHit.hex && line.ring === ringHit.ring  // no building type check
  );
  
  if (exists) {
    illegalSound.play();
    return; // block if any production line exists in ring
  }

  if (currentProd < scaledCost) {
    illegalSound.play();
    return;
  }

  // Deduct production points upfront
  prodElement.textContent = `${currentProd - scaledCost}`;

  // Add production line (auto progresses turns without consuming production)
  const productionLine = {
    hex: ringHit.hex,
    ring: 'inner',
    buildingName: selectedProductionBuilding,
    turnsCompleted: 0,
    cost: scaledCost,
    turnsRequired: scaledTurns
  };

  if (currentPlayer === PLAYERS.BLUE) {
    productionLinesBlue.push(productionLine);
  } else {
    productionLinesRed.push(productionLine);
  }

 // Clear highlights
  board.forEach(h => h.highlightForProduction = false);

  // Clear selection
  selectedProductionBuilding = null;

  // Re-open production interface
  productionInterfaceVisible = true;
  productionInterface.style.display = 'grid';

  updateCursor();
  updateProductionLinesUI();
  draw();
});

// Update UI initially on page load for production interface
updateProductionBuildingGrid();
updateProductionLinesUI();


document.getElementById('menuBtn').addEventListener('click', () => {
    window.location.href = 'index.html'; // Redirect to main menu
});

document.getElementById('regenMapBtn').addEventListener('click', () => {
    round = 1;
    currentPlayer = PLAYERS.BLUE;

    const newBoard = generateMapByType(selectedMapType);

    assignPopulationAndValues(newBoard);
    captureMap.clear();
    setupStartingPositions(newBoard);
    updateAllCaptures();
    newBoard.forEach(hex => hex.updateTokenInstances());

    board = newBoard;
    window.board = board; // keep global reference updated

    selectedHex = null;
    selectedRing = null;
    selectedTokens = [];

    roundLabel.textContent = `Round ${round}`;
    roundLabel.style.color = currentPlayer;
    draw();
});


const HOLD_DURATION = 1500; // ms hold required

// Elements
const blueBtn = document.getElementById('blueEndTurnBtn');
const blueFill = document.getElementById('blueEndTurnFill');

// Track hold timers and intervals
let blueHeldTime = 0;
let holdTimeoutBlue = null;
let holdIntervalBlue = null;
let blueTurnEnded = false;
let redTurnEnded = false;

function resetBlueFill() {
  blueFill.style.width = '0%';
  blueHeldTime = 0;
}

function disableBlueButton() {
  blueBtn.disabled = true;
  blueBtn.style.backgroundColor = '#666'; // grey background
  blueBtn.style.color = '#aaa';           // light grey text
  blueBtn.style.cursor = 'not-allowed';
}

function enableBlueButton() {
  blueBtn.disabled = false;
  blueBtn.style.backgroundColor = '#004085';
  blueBtn.style.color = 'white';
  blueBtn.style.cursor = 'pointer';
}

function endTurnCheck() {
  // Check if both players pressed end turn
  if (blueTurnEnded && redTurnEnded) {
    // Reset for next round
    blueTurnEnded = false;
    redTurnEnded = false;

    endTurn();
  }
}

function endTurn() {
  queuedMoves.forEach(move => {
    const {hexTo, ringTo, classLetter, quantity, player} = move;

    // Add tokens to destination only
    hexTo.tokens[ringTo][player][classLetter] = (hexTo.tokens[ringTo][player][classLetter] || 0) + quantity;

    hexTo.updateTokenInstances();
  });

  // Clear queue after moves applied
  queuedMoves = [];

  // Usual end-turn UI updates
  round++;
  roundLabel.textContent = `Round ${round}`;
  roundLabel.style.color = currentPlayer;

  selectedTokens = [];
  selectedHex = null;
  selectedRing = null;

  progressProductionLines();
  updateAllCaptures();
  draw();
  manaGeneration();
  populationGrowth();

}

// Blue button hold handlers
blueBtn.addEventListener('mousedown', e => {
  if (blueBtn.disabled) return; // ignore when disabled
  if (e.button !== 0) return; // Only left click

  blueHeldTime = 0;
  blueFill.style.transition = 'width 0s';

  holdIntervalBlue = setInterval(() => {
    blueHeldTime += 50;
    const pct = Math.min(blueHeldTime / HOLD_DURATION, 1);
    blueFill.style.width = (pct * 100) + '%';

    if (blueHeldTime >= HOLD_DURATION) {
      clearInterval(holdIntervalBlue);
      blueTurnEnded = true;
      redTurnEnded = true;

      endTurnCheck();

      // Disable the button now
      disableBlueButton();

      // Reset fill immediately, with a slight delay to avoid flicker
      setTimeout(() => resetBlueFill(), 100);

      // Re-enable button after 5 seconds (5000ms)
      setTimeout(() => {
        enableBlueButton();
        blueTurnEnded = false;
      }, 5000);
    }
  }, 50);
});

blueBtn.addEventListener('mouseup', e => {
  if (e.button !== 0) return;
  clearInterval(holdIntervalBlue);
  if (!blueTurnEnded) resetBlueFill();
});

blueBtn.addEventListener('mouseleave', e => {
  clearInterval(holdIntervalBlue);
  if (!blueTurnEnded) resetBlueFill();
});

draw();
