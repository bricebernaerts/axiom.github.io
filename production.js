  // Building display order for buildings grid (3x3)
  const buildingDisplayOrder = [
    "Barracks", "Farms", "Libraries",
    "Temples", "Markets", "Guilds",
    "Mines", "Agency", "Forts"
  ];

  // Safely get building count for ring
  function getBuildingCount(hex, ring, name) {
    if (!hex.ringBuildings) return 0;
    if (!hex.ringBuildings[ring]) return 0;
    return hex.ringBuildings[ring][name] || 0;
  }
  
// Global vars for production interface
let productionInterfaceVisible = false;
let selectedProductionBuilding = null;

// Define production costs and times per building
const buildingProductionData = {
  "Barracks": { cost: 200, turns: 5 },
  "Farms": { cost: 200, turns: 5 },
  "Libraries": { cost: 200, turns: 5 },
  "Temples": { cost: 200, turns: 5 },
  "Markets": { cost: 200, turns: 5 },
  "Guilds": { cost: 200, turns: 5 },
  "Mines": { cost: 200, turns: 5 },
  "Agency": { cost: 200, turns: 5 },
  "Forts": { cost: 200, turns: 5 }
};

// Production lines data structure: array of {hex, ring, buildingName, turnsCompleted}
let productionLinesBlue = [];
let productionLinesRed = [];

// Create production interface container (similar style to #infoDiv)
const productionInterface = document.createElement('div');
productionInterface.id = 'productionInterface';
productionInterface.style = `
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: #1a2a6c;
  padding: 20px 30px;
  border-radius: 16px;
  width: 100%;
  max-width: 600px;
  color: white;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  user-select: none;
  display: none;
  z-index: 103;
  box-shadow: 0 0 30px #ff6f00;
  max-height: 70vh;
  overflow-y: auto;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
`;
productionInterface.innerHTML = `
  <h2 style="grid-column:1 / -1; text-align:center; border-bottom: 2px solid #ff6f00; padding-bottom: 8px; margin-bottom:20px;">Production Interface</h2>
  <div id="productionBuildingGrid" style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 10px;"></div>
  <h3 style="grid-column:1 / -1; margin-top: 20px; border-top: 2px solid #ff6f00; padding-top: 10px;">Production Lines</h3>
  <div id="productionLinesContainer" style="grid-column:1 / -1; max-height: 200px; overflow-y: auto;"></div>
  <div style="grid-column:1 / -1; text-align:center; margin-top:10px;">
    <button id="closeProductionBtn" style="
      padding: 8px 20px;
      font-weight: bold;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      background-color: #ff6f00;
      color: black;
      box-shadow: 0 0 10px #ff6f00;">
      Close
    </button>
  </div>
`;

document.body.appendChild(productionInterface);

const productionBuildingGrid = productionInterface.querySelector('#productionBuildingGrid');
const productionLinesContainer = productionInterface.querySelector('#productionLinesContainer');
const closeProductionBtn = productionInterface.querySelector('#closeProductionBtn');

// Populate production building grid buttons
function updateProductionBuildingGrid() {
  productionBuildingGrid.innerHTML = '';
  for (const bName of buildingDisplayOrder) {
    const btn = document.createElement('button');
    btn.textContent = bName;
    btn.style = `
      background-color: black;
      color: white;
      font-weight: 700;
      padding: 14px 22px;
      border-radius: 6px;
      border: 2px solid #284a8a;
      cursor: pointer;
      font-size: 1rem;
      user-select: none;
      transition: background-color 0.3s ease;
    `;
    btn.title = `Cost: ${buildingProductionData[bName].cost} Production, Time: ${buildingProductionData[bName].turns} turns`;
    btn.addEventListener('click', () => {
      selectProductionBuilding(bName);
      updateCursor();
    });
    btn.addEventListener('mouseover', () => {
      btn.style.backgroundColor = '#ff8c00';
      btn.style.color = 'black';
    });
    btn.addEventListener('mouseout', () => {
      btn.style.backgroundColor = selectedProductionBuilding === bName ? '#ff8c00' : 'black';
      btn.style.color = selectedProductionBuilding === bName ? 'black' : 'white';
    });
    if (selectedProductionBuilding === bName) {
      btn.style.backgroundColor = '#ff8c00';
      btn.style.color = 'black';
    }
    productionBuildingGrid.appendChild(btn);
  }
}

function progressProductionLines() {
  const lines = currentPlayer === PLAYERS.BLUE ? productionLinesBlue : productionLinesRed;

  // Progress all lines by 1 turn automatically
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];

    line.turnsCompleted++;

    if (line.turnsCompleted >= line.turnsRequired) {
      // Completed production: increment building count
      const ringBuildings = line.hex.ringBuildings || {};
      ringBuildings.inner = ringBuildings.inner || {};
      line.hex.ringBuildings = ringBuildings;
      ringBuildings.inner[line.buildingName] = (ringBuildings.inner[line.buildingName] || 0) + 1;
      // Remove production line
      lines.splice(i, 1);
    }
  }

  updateProductionLinesUI();
}

// Consume production resource and progress production lines, called at endTurn()
function updateProductionLinesUI() {
  productionLinesContainer.innerHTML = '';

  const currentLines = currentPlayer === PLAYERS.BLUE ? productionLinesBlue : productionLinesRed;

  if (currentLines.length === 0) {
    productionLinesContainer.textContent = 'No active production lines.';
    return;
  }

  for (const line of currentLines) {
    const div = document.createElement('div');
    div.style = 'background: black; color: gold; border: 2px solid gold; border-radius: 8px; padding: 6px 10px; margin: 6px 0; font-size: 14px;';

    const building = line.buildingName;
    const hexCoord = `[${line.hex.row},${line.hex.col}]`;
    // Use scaled turnsRequired instead of base
    const progressPercent = Math.floor((line.turnsCompleted / line.turnsRequired) * 100);

    div.innerHTML = `
      <div><strong>${building}</strong> at Inner Ring ${hexCoord} (Cost: ${line.cost}, Time: ${line.turnsRequired} turns)</div>
      <div style="background:#333; border-radius:4px; height:16px; margin-top:4px; position:relative;">
        <div style="background:#ff6f00; width:${progressPercent}%; height:100%; border-radius:4px;"></div>
        <div style="position:absolute; width:100%; text-align:center; top:0; left:0; font-weight:bold; color:black;">${progressPercent}%</div>
      </div>
    `;
    productionLinesContainer.appendChild(div);
  }
}

function updateCursor() {
  if (selectedProductionBuilding) {
    canvas.style.cursor = 'crosshair'; // show crosshair when selecting building
  } else if (productionInterfaceVisible) {
    canvas.style.cursor = 'pointer';   // pointer when production interface visible but no building selected
  } else {
    canvas.style.cursor = 'default';
  }
}

// Call updateCursor whenever selectedProductionBuilding changes
function selectProductionBuilding(name) {
  selectedProductionBuilding = name;
  productionInterfaceVisible = false;
  productionInterface.style.display = 'none';
  updateCursor();
  
  // Highlight eligible inner rings
  highlightEligibleRings();
  
  draw();
}

function highlightEligibleRings() {
  const currentLines = currentPlayer === PLAYERS.BLUE ? productionLinesBlue : productionLinesRed;
  
  board.forEach(hex => {
    const capture = getCapture(hex);
    const hasCapture = capture.inner === currentPlayer;
    const hasActiveProd = currentLines.some(line => line.hex === hex && line.ring === 'inner');
    hex.highlightForProduction = hasCapture && !hasActiveProd;
  });
}
