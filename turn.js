const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let lastClickTime = 0;
const DOUBLE_CLICK_DELAY = 300; // milliseconds
let singleClickTimeout = null;

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

      const starved = variables.starvedLastTurn || 0;
      const grown = variables.grownLastTurn !== undefined ? variables.grownLastTurn : 0;
      
      const starvedText = starved > 0 ? ` <span style="color:#d9534f; font-weight:bold;">-${starved}</span>` : '';
      
      // Show grown always, with + if positive, color green if > 0, red if < 0, gray if 0
      let grownSign = '+';
      let grownColor = '#5cb85c'; // green
      if (grown < 0) {
        grownSign = '';
        grownColor = '#d9534f';  // red
      } else if (grown === 0) {
        grownColor = '#6c757d';  // gray
      }
      
      const grownText = ` <span style="color:${grownColor}; font-weight:bold;">${grownSign}${grown}</span>`;
      
      populationContainer.querySelector('h3').innerHTML = `Population: ${popVal}${grownText}${starvedText}`;
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
    const controlDisplay = controlPct.toFixed(1) + '%';
    const devastationPct = variables.devastation|| 0;
    const foodStorage = variables.foodStockpile || 0;
    const maxFoodStorage = (variables.population || 0) * 5;
    terrainDesc += `<div><b>Food Storage:</b> ${Math.floor(foodStorage)}/${maxFoodStorage}</div>`;
    terrainDesc += `
      <div style="margin-top: 12px; width: 100%; max-width: 320px; display: flex; align-items: center; justify-content: space-between; user-select: none;">
        <label for="localTaxSlider" style="color: gold; font-weight: 700; min-width: 110px; user-select: text;">Local Tax Rate</label>
        <input 
          type="range" 
          id="localTaxSlider" 
          min="1" max="100" value="50"
          style="flex-grow: 1; margin: 0 10px; accent-color: gold; cursor: pointer;"
        >
        <span id="localTaxValue" style="color: gold; font-weight: 700; min-width: 30px; text-align: right; user-select: none;">50%</span>
      </div>
    `;

    terrainDetails.innerHTML = terrainDesc;
        
    const localTaxSlider = document.getElementById('localTaxSlider');
    const localTaxValue = document.getElementById('localTaxValue');
    if (localTaxSlider && localTaxValue) {
      const vars = selectedRing === 'inner' ? selectedHex.innerVariables : selectedHex.outerVariables;
      let localTaxVal = vars.localTax || 50;
      localTaxSlider.value = localTaxVal;
      localTaxValue.textContent = `${localTaxVal}%`;
    
      localTaxSlider.oninput = () => {
        const val = parseInt(localTaxSlider.value, 10);
        localTaxValue.textContent = `${val}%`;
        vars.localTax = val;
        // Optionally trigger recalculations here
      };
    }

    // Terrain stats grid (1 row, 4 columns)
    const pollution = variables.pollution|| 0; 
    // crime% approximate from control
    const crimePct = variables.crime|| 0 ;

    terrainStats.innerHTML = `
      <div><b>Control</b><br>${controlDisplay}</div>
      <div><b>Devastation</b><br>${devastationPct}%</div>
      <div><b>Pollution</b><br>${pollution}%</div>
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
  ringManaPop();
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
