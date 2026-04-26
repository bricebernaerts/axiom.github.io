// setup.js

const HEX_RADIUS = 60;
const INNER_RING_RATIO = 0.4;
const OUTER_RING_RATIO = 0.9;

const ROWS_TOTAL = 24;
const MAX_COLS = 23;
const centerRow = Math.floor(ROWS_TOTAL / 2);
const centerCol = Math.floor(MAX_COLS / 2);

let selectedHex = null;
let selectedRing = null;
let selectedTokens = [];

// Players
const PLAYERS = {
    BLUE: 'blue',
    RED: 'red',
};
let currentPlayer = PLAYERS.BLUE;
let round = 1;

const OUTER_TYPES = {
    desert: '#FFFFE0',
    woods: '#228B22',
    hills: '#C68642',
    mountains: '#EEEEEE',
    plains: '#87CEEB',
    water: '#00008B',
    coast: '#FFC0CB',
};

const INNER_TYPES = {
    hamlet: '#D3D3D3',
    town: '#A9A9A9',
    city: '#696969',
    metropolis: '#000000',
    island: '#EDD27E',
};

// Token classes A-F
const TOKEN_CLASSES = ['A', 'B', 'C', 'D', 'E', 'F'];

// Data structure for token class properties
const tokenClassProperties = {
    'A': {
        name: "Infantry",
        label: "A",
        offense: 10,
        hitpoints: 100,
        defense: 10,
        cost: 100,
        maintenance: 10,
        manpower: 100,
        trainingTime: 10,
        visibility: 10,
        perception: 10,
        speed: 1
    },
    'B': {
        name: "Archer",
        label: "B",
        offense: 15,
        hitpoints: 100,
        defense: 10,
        cost: 200,
        maintenance: 20,
        manpower: 100,
        trainingTime: 20,
        visibility: 10,
        perception: 20,
        speed: 1
    },
    'C': {
        name: "Cavalry",
        label: "C",
        offense: 20,
        hitpoints: 100,
        defense: 10,
        cost: 300,
        maintenance: 30,
        manpower: 100,
        trainingTime: 30,
        visibility: 20,
        perception: 10,
        speed: 2
    },
    'D': {
        name: "Mage",
        label: "D",
        offense: 30,
        hitpoints: 100,
        defense: 10,
        cost: 1000,
        maintenance: 100,
        manpower: 1,
        trainingTime: 100,
        visibility: 1,
        perception: 20,
        speed: 2        
    },
    'E': {
        name: "Siege",
        label: "E",
        offense: 10,
        hitpoints: 100,
        defense: 10,
        cost: 300,
        maintenance: 30,
        manpower: 100,
        trainingTime: 30,
        visibility: 30,
        perception: 10,
        speed: 1        
    },
    'F': {
        name: "Scout",
        label: "F",
        offense: 5,
        hitpoints: 100,
        defense: 10,
        cost: 100,
        maintenance: 10,
        manpower: 100,
        trainingTime: 10,
        visibility: 5,
        perception: 50,
        speed: 1        
    },
};

const captureMap = new Map();

let moveAssignmentMode = false;  // true when selecting destinations after quantity chosen
let moveSource = null;           // {hex, ring, classLetter, maxQty}

function captureKey(hex) {
    return `${hex.row},${hex.col}`;
}

function getCapture(hex) {
    const key = captureKey(hex);
    if(!captureMap.has(key)) captureMap.set(key, {inner: null, outer: null});
    return captureMap.get(key);
}

function isTokenQueued(hex, ring, classLetter) {
  return queuedMoves.some(move =>
    move.hexFrom === hex &&
    move.ringFrom === ring &&
    move.classLetter === classLetter &&
    move.quantity > 0
  );
}

// Token class with player ownership & updated angles
class Token {
    constructor(hex, ring, classLetter, player=PLAYERS.BLUE, quantity = 1, angleIndex = 0) {
        this.hex = hex;
        this.ring = ring; // 'inner' or 'outer'
        this.classLetter = classLetter;
        this.player = player;
        this.quantity = quantity;
        this.angleIndex = angleIndex;
    }

    getPosition() {
        const center = this.hex.getCenter();
        const baseRadius = HEX_RADIUS * (this.ring === 'inner' ? INNER_RING_RATIO : OUTER_RING_RATIO);
        const radius = baseRadius * 0.7;
        
        // Angle offset for players:
        // Blue default: +PI * 1.5 (270°)
        // Red: +PI * 1.83 (~329°)
        const baseAngle = (this.player === PLAYERS.BLUE) ? Math.PI * 1.5 : Math.PI * 1.675;
        // Each class has an angle step of 60° = PI/3 radians
        const angle = Math.PI / 3 * this.angleIndex + baseAngle;
        return {
            x: center.x + radius * Math.cos(angle),
            y: center.y + radius * Math.sin(angle)
        };
    }

    draw(ctx) {
        const pos = this.getPosition();
        const baseRadius = HEX_RADIUS * 0.15;
        const r = baseRadius;

        ctx.save();

        // Highlight selected tokens with orange border
        if(selectedTokens.includes(this)) {
            ctx.fillStyle = 'orange';
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, r + 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // Fill color by player
        ctx.fillStyle = this.player;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.lineWidth = 2;
        ctx.strokeStyle = 'black';
        ctx.stroke();

        ctx.fillStyle = 'white';
        ctx.font = `${r * 1.3}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.classLetter + (this.quantity > 1 ? this.quantity : '1'), pos.x, pos.y);

        ctx.restore();
    }
}

// Draw diagonal stripes inside circle for inner ring
function drawRingStripes(ctx, cx, cy, radius, player) {
    ctx.save();
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 20;  // wider for longer stripes
    patternCanvas.height = 20;
    const pctx = patternCanvas.getContext('2d');
    pctx.strokeStyle = player;
    pctx.lineWidth = 2;
    pctx.beginPath();
    pctx.moveTo(0, 0);
    pctx.lineTo(20, 20);
    pctx.stroke();

    const pattern = ctx.createPattern(patternCanvas, 'repeat');
    ctx.fillStyle = pattern;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

function drawRingStripesHex(ctx, cx, cy, radius, player) {
    ctx.save();

    // Create clipping hex shape for outer ring
    ctx.beginPath();
    for(let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 * i + Math.PI / 6;
        const px = cx + radius * Math.cos(angle);
        const py = cy + radius * Math.sin(angle);
        if(i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();

    // Subtract the inner ring circle so stripes do not cover inner ring
    ctx.moveTo(cx + HEX_RADIUS * INNER_RING_RATIO, cy);
    ctx.arc(cx, cy, HEX_RADIUS * INNER_RING_RATIO, 0, Math.PI * 2, true);

    ctx.clip();

    // Create diagonal stripes pattern
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 25;
    patternCanvas.height = 25;
    const pctx = patternCanvas.getContext('2d');
      
    pctx.strokeStyle = player;
    pctx.lineWidth = 2;
    pctx.beginPath();
    pctx.moveTo(0, 25);
    pctx.lineTo(25, 0);
    pctx.stroke();

    const pattern = ctx.createPattern(patternCanvas, 'repeat');
    ctx.fillStyle = pattern;

    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

    ctx.restore();
}

class Hex {
    constructor(row, col, x, y) {
        this.row = row;
        this.col = col;
        this.x = x;
        this.y = y;
        
        this.hasRiver = false;
        this.outerType = 'plains';
        this.innerType = 'hamlet';

        // Add properties per ring
        this.outerVariables = {
            population: 0,
            wealth: 0,
            control: 0,
            soldiers: 0,
            foodProduction: 0,
        };

        this.innerVariables = {
            population: 0,
            wealth: 0,
            control: 0,
            soldiers: 0,
            foodProduction: 0,
        };

        this.tokens = {
            inner: { blue: {}, red: {} },
            outer: { blue: {}, red: {} },
        };

        this.tokenInstances = [];
    }

    getCenter() {
        return {x: this.x, y: this.y};
    }

    draw(ctx) {
        const outerRadius = HEX_RADIUS * OUTER_RING_RATIO;
        const innerRadius = HEX_RADIUS * INNER_RING_RATIO;

        // Draw hex polygon border (black)
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for(let i=0; i<6; i++) {
            const angle = Math.PI / 3 * i + Math.PI / 6;
            const px = this.x + HEX_RADIUS * Math.cos(angle);
            const py = this.y + HEX_RADIUS * Math.sin(angle);
            if(i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();

        // Fill outer ring hex with type color
        ctx.fillStyle = OUTER_TYPES[this.outerType] || '#ccc';
        ctx.beginPath();
        for(let i = 0; i < 6; i++) {
            const angle = Math.PI / 3 * i + Math.PI / 6;
            const px = this.x + outerRadius * Math.cos(angle);
            const py = this.y + outerRadius * Math.sin(angle);
            if(i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        // Stroke outer ring hex border
        ctx.lineWidth = 3;
        if (this.hasRiver) {
          ctx.strokeStyle = '#aaa';          // river border color
          ctx.setLineDash([10, 6]);          // dashed line pattern
        } else {
          ctx.strokeStyle = '#aaa';         // normal border color
          ctx.setLineDash([]);                // solid line
        }

        ctx.beginPath();
        for(let i = 0; i < 6; i++) {
            const angle = Math.PI / 3 * i + Math.PI / 6;
            const px = this.x + outerRadius * Math.cos(angle);
            const py = this.y + outerRadius * Math.sin(angle);
            if(i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();

        // Fill inner ring circle with type color
        ctx.fillStyle = INNER_TYPES[this.innerType] || '#ccc';
        ctx.beginPath();
        ctx.arc(this.x, this.y, innerRadius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();

        // Stroke inner ring circle border
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, innerRadius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.stroke();

        // Highlight selected ring if applicable
        if(selectedHex === this && selectedTokens.length === 0) {
            ctx.lineWidth = 4;
            ctx.strokeStyle = 'orange';
            if(selectedRing === 'outer') {
                ctx.beginPath();
                for(let i=0; i<6; i++) {
                    const angle = Math.PI/3 * i + Math.PI/6;
                    const px = this.x + outerRadius * Math.cos(angle);
                    const py = this.y + outerRadius * Math.sin(angle);
                    if(i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.stroke();
            } else if(selectedRing === 'inner') {
                ctx.beginPath();
                ctx.arc(this.x, this.y, innerRadius, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'black';
          }
          
        // Draw capture stripes if captured
        const captured = getCapture(this);
        if(captured.inner) {
            drawRingStripes(ctx, this.x, this.y, innerRadius, captured.inner);
        }
        if(captured.outer) {
            drawRingStripesHex(ctx, this.x, this.y, outerRadius, captured.outer);
        }

        // Draw tokens
        for(const token of this.tokenInstances) {
            token.draw(ctx);
        }
        
        if (this.highlightForProduction) {
          const innerRadius = HEX_RADIUS * INNER_RING_RATIO;
          ctx.save();
          ctx.fillStyle = 'rgba(50, 205, 50, 0.3)'; // translucent lime green fill
          ctx.beginPath();
          ctx.arc(this.x, this.y, innerRadius, 0, Math.PI * 2);
          ctx.closePath();
          ctx.fill();
        
          ctx.lineWidth = 4;
          ctx.strokeStyle = 'limegreen';
          ctx.beginPath();
          ctx.arc(this.x, this.y, innerRadius, 0, Math.PI * 2);
          ctx.closePath();
          ctx.stroke();
        
          ctx.restore();
        }
        
        // Calculate cumulative offense per player on outer ring
        const outerTokensByPlayer = { blue: [], red: [] };
        
        for (const token of this.tokenInstances) {
            if (token.ring === 'outer') {
                outerTokensByPlayer[token.player].push(token);
            }
        }
        
        function cumulativeStat(tokens, statName) {
            return tokens.reduce((sum, t) => {
                const baseStat = tokenClassProperties[t.classLetter]?.[statName] || 0;
                return sum + baseStat * t.quantity;
            }, 0);
        }
        
        const blueOffense = cumulativeStat(outerTokensByPlayer.blue, 'offense');
        const redOffense = cumulativeStat(outerTokensByPlayer.red, 'offense');
        
        ctx.save();
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        
        const padding = 1;
        
        function drawTextWithBackground(text, x, y, textColor) {
            const textWidth = ctx.measureText(text).width;
            const bgWidth = textWidth + 2 * padding;
            const bgHeight = 20;
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; // semi-transparent white background
            ctx.fillRect(x - bgWidth / 2, y - padding, bgWidth, bgHeight);
            
            ctx.fillStyle = textColor;
            ctx.fillText(text, x, y);
        }
        
        if (blueOffense > 0) {
            drawTextWithBackground(`${blueOffense}`, this.x, this.y - HEX_RADIUS - 10, 'blue');
        }
        if (redOffense > 0) {
            // Draw red offense number slightly below blue, adjust vertical offset as needed
            drawTextWithBackground(`${redOffense}`, this.x, this.y - HEX_RADIUS + 100, 'red');
        }
        
        ctx.restore();

    }

    hitTestRing(x, y) {
        const dx = x - this.x;
        const dy = y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if(dist <= HEX_RADIUS * INNER_RING_RATIO) return 'inner';
        if(dist <= HEX_RADIUS * OUTER_RING_RATIO) return 'outer';
        return null;
    }

  updateTokenInstances() {
    this.tokenInstances = [];
    ['inner', 'outer'].forEach(ring => {
      ['blue', 'red'].forEach(player => {
        const classes = Object.keys(this.tokens[ring][player]);
        classes.forEach(classLetter => {
          const count = this.tokens[ring][player][classLetter];
          if (count > 0) {
            const angleIndex = TOKEN_CLASSES.indexOf(classLetter);
            const token = new Token(this, ring, classLetter, player, count, angleIndex);
            this.tokenInstances.push(token);
          }
        });
      });
    });
  }
}

// Calculate hex neighbors offsets for flat-topped hex grid, as before
function getNeighbors(hex, data = board, isMap = false) {
  const dirs_even = [
      { dr: -1, dc: 0 }, { dr: -1, dc: 1 },
      { dr: 0, dc: 1 }, { dr: 1, dc: 1 },
      { dr: 1, dc: 0 }, { dr: 0, dc: -1 }
  ];
  const dirs_odd = [
      { dr: -1, dc: -1 }, { dr: -1, dc: 0 },
      { dr: 0, dc: 1 }, { dr: 1, dc: 0 },
      { dr: 1, dc: -1 }, { dr: 0, dc: -1 }
  ];
  const dirs = (hex.row % 2 === 0) ? dirs_even : dirs_odd;

  const neighbors = [];
  for (const d of dirs) {
      const nr = hex.row + d.dr;
      const nc = hex.col + d.dc;
      if (nr < 0 || nr >= ROWS_TOTAL) continue;
      if (nc < 0 || nc >= MAX_COLS) continue;
      
      let nHex;
      if (isMap) {
          nHex = data.get(`${nr},${nc}`);
      } else {
          nHex = data.find(h => h.row === nr && h.col === nc);
      }

      if (nHex) neighbors.push(nHex);
  }
  return neighbors;
}

function getUrlParam(key) {
  const params = new URLSearchParams(window.location.search);
  return params.get(key);
}

const selectedMapType = getUrlParam('mapType') || 'Pangea';

function generateMapByType(mapType) {
  let board;
  if (mapType === 'Lake') {
    board = generateLakeMap();
  } else if (mapType === 'Islands') {
    board = generateIslandsMap();
  } else if (mapType === 'Continents') {
    board = generateContinentsMap();
  } else {
    board = generatePangeaMap();
  }

  if (['Pangea', 'Lake', 'Continents'].includes(mapType)) {
    generateRivers(board);
  }

  return board;
}

function hexToPixel(row, col) {
    const offset = (row % 2 === 0) ? 0.5 : 0;
    const x = HEX_RADIUS * Math.sqrt(3) * (col + offset);
    const y = HEX_RADIUS * 1.5 * row;
    return {x: x + 80, y: y + 100};
}

function generatePangeaMap() {
    const board = [];

    const waterMarginRows = 3; // margin where water/coast can appear
    const waterMarginCols = 3;

    // First pass: generate hexes with tentative outerType assignments
    for (let r = 0; r < ROWS_TOTAL; r++) {
        const norm = (r - centerRow) / centerRow;
        const baseWidth = Math.round(MAX_COLS * Math.sqrt(1 - norm * norm));
        const width = Math.max(3, baseWidth + (Math.random() < 0.5 ? -1 : 1));
        const startCol = centerCol - Math.floor(width / 2);
        const endCol = startCol + width - 1;

        for (let c = 0; c < MAX_COLS; c++) {
            const pos = hexToPixel(r, c);
            const hex = new Hex(r, c, pos.x, pos.y);

            if (
                r < waterMarginRows || r >= ROWS_TOTAL - waterMarginRows ||
                c < waterMarginCols || c >= MAX_COLS - waterMarginCols
            ) {
                // Outer margin: mostly water or coast
                if (r === 0 || r === ROWS_TOTAL - 1 || c === 0 || c === MAX_COLS - 1) {
                    hex.outerType = 'water';
                } else {
                    hex.outerType = (Math.random() < 0.7) ? 'water' : 'coast';
                }
                hex.innerType = 'island';
            } else {
                // Inside margin: assign land or water/coast

                if (c >= startCol && c <= endCol) {
                    // Land area (temporarily assign land type or coast if border)
                    if (c === startCol || c === endCol) {
                        // Border is coast for now
                        hex.outerType = 'coast';
                    } else {
                        const outerTypesAvailable = ['desert', 'plains', 'woods', 'hills', 'mountains'];
                        hex.outerType = outerTypesAvailable[Math.floor(Math.random() * outerTypesAvailable.length)];
                    }
                    const innerTypesAvailable = ['hamlet', 'town', 'city', 'metropolis'];
                    hex.innerType = innerTypesAvailable[Math.floor(Math.random() * innerTypesAvailable.length)];
                } else {
                    // Outside land ellipse but inside margin is water/coast band
                    hex.outerType = (Math.random() < 0.7) ? 'water' : 'coast';
                    hex.innerType = 'island';
                }
            }

            board.push(hex);
        }
    }

    for (const hex of board) {
        if (hex.outerType === 'coast') {
            // Remove coasts fully surrounded by water
            const neighbors = getNeighbors(hex, board);
            const allWaterNeighbors = neighbors.every(n => n.outerType === 'water');
            if (allWaterNeighbors) {
                hex.outerType = 'water'; // convert to water
                hex.innerType = 'island';
            }
        }
    }

    // Now, any land tile next to water must be coast
    for (const hex of board) {
        if (hex.outerType !== 'water' && hex.outerType !== 'coast') {
            // check neighbors
            const neighbors = getNeighbors(hex, board);
            if (neighbors.some(n => n.outerType === 'water')) {
                hex.outerType = 'coast';  // convert land tile adjacent to water to coast
            }
        }
    }
    
    // Assign inner ring type to all coast hexes (if not assigned yet)
      for (const hex of board) {
          if (hex.outerType === 'coast') {
              const innerTypesAvailable = ['hamlet', 'town', 'city', 'metropolis'];
              hex.innerType = innerTypesAvailable[Math.floor(Math.random() * innerTypesAvailable.length)];
          }
      }

    return board;
}

function generateLakeMap() {
    const board = [];
    const lakeRadiusRows = 7;
    const lakeRadiusCols = 7;

    // First pass: mark water hexes inside the ellipse (lake) and others as land candidate
    for (let r = 0; r < ROWS_TOTAL; r++) {
        for (let c = 0; c < MAX_COLS; c++) {
            const pos = hexToPixel(r, c);
            const normRow = (r - centerRow) / lakeRadiusRows;
            const normCol = (c - centerCol) / lakeRadiusCols;
            const insideLake = (normRow * normRow + normCol * normCol) <= 1;

            const hex = new Hex(r, c, pos.x, pos.y);

            if (insideLake) {
                // These are water hexes inside the lake
                hex.outerType = 'water';
                hex.innerType = 'island';
            } else {
                // Land candidate: assign temp outerType as null for now
                hex.outerType = null;
                hex.innerType = null;
            }
            board.push(hex);
        }
    }

    // Second pass: assign coast or land types for hexes outside lake water area
    for (const hex of board) {
        if (hex.outerType === null) {
            // Calculate normalized coords relative to lake center again for distance
            const r = hex.row;
            const c = hex.col;
            const normRow = (r - centerRow) / lakeRadiusRows;
            const normCol = (c - centerCol) / lakeRadiusCols;
            const distEllipse = normRow * normRow + normCol * normCol;

            // Coast band between 1.0 and ~1.35 (arbitrary slice for coast width)
            if (distEllipse > 1 && distEllipse <= 1.35) {
                hex.outerType = 'coast';
            } else {
                // Land hexes beyond coast
                const outerTypesAvailable = ['desert', 'plains', 'woods', 'hills', 'mountains'];
                hex.outerType = outerTypesAvailable[Math.floor(Math.random() * outerTypesAvailable.length)];
            }

            const innerTypesAvailable = ['hamlet', 'town', 'city', 'metropolis'];
            hex.innerType = innerTypesAvailable[Math.floor(Math.random() * innerTypesAvailable.length)];
        }
    }

    return board;
}

function generateContinentsMap() {
  const board = [];
  const hexMap = new Map();

  // Initialize all hexes as water/island
  for (let r = 0; r < ROWS_TOTAL; r++) {
    for (let c = 0; c < MAX_COLS; c++) {
      const pos = hexToPixel(r, c);
      const hex = new Hex(r, c, pos.x, pos.y);
      hex.outerType = 'water';
      hex.innerType = 'island';
      board.push(hex);
      hexMap.set(`${r},${c}`, hex);
    }
  }

  const sepCols = 3; // minimum water columns separation between continents
  const marginRows = 1;

  // Determine vertical bounds for a continent, given column bounds
  function getBoundsForCols(colStart, colEnd) {
    // Because board is rectangular, vertical bounds can be full with margin,
    // but we could adjust row limits per continent for varied shapes if needed.
    const minR = marginRows;
    const maxR = ROWS_TOTAL - marginRows - 1;
    return { minR, maxR };
  }

  // Generate random continent parameters, including dynamic vertical range and ellipse sizes
  function randomContinentParams(colMin, colMax) {
    const { minR, maxR } = getBoundsForCols(colMin, colMax);
    const availableCols = colMax - colMin;
    const availableRows = maxR - minR;

    // Random width/height 90%-95% of available space
  const contWidth = Math.floor(availableCols * (0.9 + Math.random() * 0.1));
  const contHeight = Math.floor(availableRows * (0.9 + Math.random() * 0.1));

    // Random start positions within available horizontal/vertical ranges
    const startCol = colMin + Math.floor(Math.random() * (availableCols - contWidth));
    const endCol = startCol + contWidth;

    const maxStartRow = maxR - contHeight;
    const startRow = minR + Math.floor(Math.random() * (maxStartRow - minR + 1));
    const endRow = startRow + contHeight;

    const centerRowC = startRow + Math.floor(contHeight / 2);
    const centerColC = Math.floor((startCol + endCol) / 2);

    return {
      startCol, endCol,
      startRow, endRow,
      centerRowC, centerColC,
      radiusRow: contHeight / 2,
      radiusCol: contWidth / 2,
    };
  }

  // Generate continent hexes inside ellipse using params
  function generateContinentHexes(params) {
    const continentHexes = [];

    for (let r = params.startRow; r <= params.endRow; r++) {
      for (let c = params.startCol; c <= params.endCol; c++) {
        const hex = hexMap.get(`${r},${c}`);
        if (!hex) continue;

        const normRow = (r - params.centerRowC) / params.radiusRow;
        const normCol = (c - params.centerColC) / params.radiusCol;

        if (normRow * normRow + normCol * normCol <= 1) {
          continentHexes.push(hex);
        }
      }
    }
    return continentHexes;
  }

  // Pick continents: left half (cols 1..mid - sepCols), right half (cols mid + sepCols .. MAX_COLS-2)
  const midCol = Math.floor(MAX_COLS / 2);
  const leftParams = randomContinentParams(1, midCol - sepCols);
  const rightParams = randomContinentParams(midCol + sepCols, MAX_COLS - 2);

  let leftContHexes = generateContinentHexes(leftParams);
  let rightContHexes = generateContinentHexes(rightParams);

  // Balance hex count by trimming larger continent to smaller by closest-to-center
  const minCount = Math.min(leftContHexes.length, rightContHexes.length);

  function getClosestHexes(hexes, centerRow, centerCol, count) {
    return hexes
      .slice()
      .sort((a, b) => {
        const da = Math.hypot(a.row - centerRow, a.col - centerCol);
        const db = Math.hypot(b.row - centerRow, b.col - centerCol);
        return da - db;
      })
      .slice(0, count);
  }

  leftContHexes = getClosestHexes(leftContHexes, leftParams.centerRowC, leftParams.centerColC, minCount);
  rightContHexes = getClosestHexes(rightContHexes, rightParams.centerRowC, rightParams.centerColC, minCount);

  // Assign balanced outer and inner ring types evenly
  const outerTypesAvailable = ['desert', 'plains', 'woods', 'hills', 'mountains'];
  const innerTypesAvailable = ['hamlet', 'town', 'city', 'metropolis'];

  function shuffleArrayRepeated(arr, count) {
    let repeated = [];
    while (repeated.length < count) repeated = repeated.concat(arr);
    repeated = repeated.slice(0, count);
    for (let i = repeated.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [repeated[i], repeated[j]] = [repeated[j], repeated[i]];
    }
    return repeated;
  }

  function assignBalancedTypes(hexes) {
    const count = hexes.length;
    const shuffledOuter = shuffleArrayRepeated(outerTypesAvailable, count);
    const shuffledInner = shuffleArrayRepeated(innerTypesAvailable, count);
    for (let i = 0; i < count; i++) {
      hexes[i].outerType = shuffledOuter[i];
      hexes[i].innerType = shuffledInner[i];
    }
  }

  assignBalancedTypes(leftContHexes);
  assignBalancedTypes(rightContHexes);

  // After assigning terrain, assign coasts by checking adjacency to water using direct neighbors here
  for (const hex of board) {
    if (hex.outerType !== 'water') {
      const neighbors = getNeighbors(hex, hexMap, true);
      const adjacentWater = neighbors.some(n => n.outerType === 'water');
      if (adjacentWater) {
        hex.outerType = 'coast';
        const coastalInnerTypes = ['hamlet', 'town', 'city', 'metropolis'];
        hex.innerType = coastalInnerTypes[Math.floor(Math.random() * coastalInnerTypes.length)];
      }
    }
  }

  return board;
}

function generateIslandsMap() {
    const board = [];
    const islandMaxSizeLarge = 18; // larger islands in corners
    const islandMaxSizeSmall = 8;  // smaller islands filling remaining space
    const minBuffer = 1;           // water buffer hexes around islands

    // Initialize all hexes as water
    for (let r = 0; r < ROWS_TOTAL; r++) {
        for (let c = 0; c < MAX_COLS; c++) {
            const pos = hexToPixel(r, c);
            const hex = new Hex(r, c, pos.x, pos.y);
            hex.outerType = 'water';
            hex.innerType = 'island';
            board.push(hex);
        }
    }

    function getHex(r, c) {
        return board.find(h => h.row === r && h.col === c);
    }

    function getNeighborCoords(r, c) {
        const neighbors = [
            [r - 1, c], [r - 1, c + 1],
            [r, c + 1], [r + 1, c + 1],
            [r + 1, c], [r, c - 1]
        ];
        return neighbors.filter(([nr, nc]) =>
            nr >= 0 && nr < ROWS_TOTAL && nc >= 0 && nc < MAX_COLS
        );
    }

    // Mark tiles occupied by islands or buffer zones
    const occupiedCoords = new Set();

    // Mark edges as occupied (no islands on outermost layer)
    for (let r = 0; r < ROWS_TOTAL; r++) {
        occupiedCoords.add(`${r},0`);
        occupiedCoords.add(`${r},${MAX_COLS - 1}`);
    }
    for (let c = 0; c < MAX_COLS; c++) {
        occupiedCoords.add(`0,${c}`);
        occupiedCoords.add(`${ROWS_TOTAL - 1},${c}`);
    }

    // Function to add buffer coords (water around island cluster)
    function addBufferAround(cells) {
        for (const key of cells) {
            const [r, c] = key.split(',').map(Number);
            const neighbors = getNeighborCoords(r, c);
            for (const [nr, nc] of neighbors) {
                const nKey = `${nr},${nc}`;
                if (!occupiedCoords.has(nKey)) {
                    occupiedCoords.add(nKey);
                    const hex = getHex(nr, nc);
                    if(hex){
                        hex.outerType = 'water';
                        hex.innerType = 'island';
                    }
                }
            }
        }
    }

    // Create an island cluster starting from center, maxSize, returns set of occupied keys
    function createIslandCluster(centerRow, centerCol, maxSize) {
        const islandCells = new Set();
        islandCells.add(`${centerRow},${centerCol}`);

        const frontier = [`${centerRow},${centerCol}`];

        while (islandCells.size < maxSize && frontier.length > 0) {
            const current = frontier.shift();
            const [r, c] = current.split(',').map(Number);

            const neighbors = getNeighborCoords(r, c);

            for (const [nr, nc] of neighbors) {
                if (nr === 0 || nr === ROWS_TOTAL -1 || nc === 0 || nc === MAX_COLS -1) continue; // skip edges
                const key = `${nr},${nc}`;
                if (occupiedCoords.has(key) || islandCells.has(key)) continue;
                // Random chance 60% to grow island
                if (Math.random() < 0.6) {
                    islandCells.add(key);
                    frontier.push(key);
                    if (islandCells.size >= maxSize) break;
                }
            }
        }
        return islandCells;
    }

    // Assign island terrain and mark as occupied
    function assignIslandTiles(islandCells) {
        for (const key of islandCells) {
            const [r, c] = key.split(',').map(Number);
            const hex = getHex(r, c);
            if (hex) {
                const outerTypesAvailable = ['desert', 'plains', 'woods', 'hills', 'mountains'];
                hex.outerType = outerTypesAvailable[Math.floor(Math.random() * outerTypesAvailable.length)];
                const innerTypesAvailable = ['hamlet', 'town', 'city', 'metropolis'];
                hex.innerType = innerTypesAvailable[Math.floor(Math.random() * innerTypesAvailable.length)];
            }
            occupiedCoords.add(key);
        }
        addBufferAround(islandCells);
    }

    // 1) Create four large islands near corners, avoid edges with buffer (rows and cols 2..ROWS_TOTAL-3)
    const cornerPositions = [
        [2 + Math.floor(Math.random() * 2), 2 + Math.floor(Math.random() * 2)], // Top-left
        [2 + Math.floor(Math.random() * 2), MAX_COLS - 2 - Math.floor(Math.random() * 3)], // Top-right
        [ROWS_TOTAL - 2 - Math.floor(Math.random() * 3), 2 + Math.floor(Math.random() * 2)], // Bottom-left
        [ROWS_TOTAL - 2 - Math.floor(Math.random() * 3), MAX_COLS - 2 - Math.floor(Math.random() * 3)] // Bottom-right
    ];

    for (const [r, c] of cornerPositions) {
        const islandCells = createIslandCluster(r, c, islandMaxSizeLarge);
        assignIslandTiles(islandCells);
    }

    // 2) Create 7 to 9 smaller islands anywhere free (with buffer), max tries to avoid infinite loop
    const smallIslandCount = 7 + Math.floor(Math.random() * 3);
    let smallIslandsCreated = 0;
    let tries = 0;
    const maxTries = 1000;
    while (smallIslandsCreated < smallIslandCount && tries < maxTries) {
        tries++;
        // Choose a random location avoiding edges and occupied tiles and buffer around
        const r = 2 + Math.floor(Math.random() * (ROWS_TOTAL - 4));
        const c = 2 + Math.floor(Math.random() * (MAX_COLS - 4));
        const centerKey = `${r},${c}`;
        if (occupiedCoords.has(centerKey)) continue;
        // Check neighbors also not occupied (buffer)
        const neighbors = getNeighborCoords(r, c);
        const nearOccupied = neighbors.some(([nr, nc]) => occupiedCoords.has(`${nr},${nc}`));
        if (nearOccupied) continue;

        const islandCells = createIslandCluster(r, c, islandMaxSizeSmall);
        assignIslandTiles(islandCells);
        smallIslandsCreated++;
    }

    return board;
}

// Assign population and values based on outerType and innerType
function assignPopulationAndValues(board) {
    for(const hex of board) {
        switch(hex.outerType) {
            case 'water':
                hex.outerVariables.population = 0;
                hex.outerVariables.wealth = 50 + Math.floor(Math.random() * 50);
                hex.outerVariables.foodProduction = 0;
                break;
            case 'desert':
                hex.outerVariables.population = 0 + Math.floor(Math.random() * 100);
                hex.outerVariables.wealth = 100 + Math.floor(Math.random() * 50);
                hex.outerVariables.foodProduction = 0 + Math.floor(Math.random() * 30);
                break;
            case 'plains':
                hex.outerVariables.population = 600 + Math.floor(Math.random() * 400);
                hex.outerVariables.wealth = 300 + Math.floor(Math.random() * 200);
                hex.outerVariables.foodProduction = 600 + Math.floor(Math.random() * 400);
                break;
            case 'woods':
                hex.outerVariables.population = 400 + Math.floor(Math.random() * 100);
                hex.outerVariables.wealth = 200 + Math.floor(Math.random() * 100);
                hex.outerVariables.foodProduction = 200 + Math.floor(Math.random() * 100);
                break;
            case 'hills':
                hex.outerVariables.population = 400 + Math.floor(Math.random() * 100);
                hex.outerVariables.wealth = 250 + Math.floor(Math.random() * 100);
                hex.outerVariables.foodProduction = 150 + Math.floor(Math.random() * 150);
                break;
            case 'mountains':
                hex.outerVariables.population = 200 + Math.floor(Math.random() * 200);
                hex.outerVariables.wealth = 400 + Math.floor(Math.random() * 200);
                hex.outerVariables.foodProduction = 100 + Math.floor(Math.random() * 50);
                break;
            case 'coast':
                hex.outerVariables.population = 200 + Math.floor(Math.random() * 600);
                hex.outerVariables.wealth = 200 + Math.floor(Math.random() * 400);
                hex.outerVariables.foodProduction = 400 + Math.floor(Math.random() * 400);
                break;
            default:
                hex.outerVariables.population = 0;
                hex.outerVariables.wealth = 0;
                hex.outerVariables.foodProduction = 0;
        }

        hex.outerVariables.control = 0;
        hex.outerVariables.soldiers = 0;

        // Inner rings values
        switch(hex.innerType) {
            case 'hamlet':
                hex.innerVariables.population = 100 + Math.floor(Math.random() * 200);
                hex.innerVariables.wealth = 50 + Math.floor(Math.random() * 50);
                hex.innerVariables.foodProduction = 0;
                break;
            case 'town':
                hex.innerVariables.population = 300 + Math.floor(Math.random() * 100);
                hex.innerVariables.wealth = 100 + Math.floor(Math.random() * 200);
                hex.innerVariables.foodProduction = 0;
                break;
            case 'city':
                hex.innerVariables.population = 400 + Math.floor(Math.random() * 200);
                hex.innerVariables.wealth = 300 + Math.floor(Math.random() * 300);
                hex.innerVariables.foodProduction = 0;
                break;
            case 'metropolis':
                hex.innerVariables.population = 600 + Math.floor(Math.random() * 400);
                hex.innerVariables.wealth = 600 + Math.floor(Math.random() * 400);
                hex.innerVariables.foodProduction = 0;
                break;
            case 'island':
                hex.innerVariables.population = 50 + Math.floor(Math.random() * 150);
                hex.innerVariables.wealth = 30 + Math.floor(Math.random() * 120);
                hex.innerVariables.foodProduction = 50 + Math.floor(Math.random() * 250);
                break;
            default:
                hex.innerVariables.population = 200 + Math.floor(Math.random() * 200);
                hex.innerVariables.wealth = 100 + Math.floor(Math.random() * 100);
                hex.innerVariables.foodProduction = 0;
        }
        hex.innerVariables.control = 0;
        hex.innerVariables.soldiers = 0;
    }
}

// Updated setupStartingPositions to accept board parameter
function setupStartingPositions(board) {
    const maxRow = ROWS_TOTAL - 1;
    const maxCol = MAX_COLS - 1;

    const maxDistance = maxRow + maxCol;
    let minStartDistance;
    if (selectedMapType === 'Lake') {
    minStartDistance = Math.floor(maxDistance * 0.6);
    }
    else if (selectedMapType === 'Islands') {
    minStartDistance = Math.floor(maxDistance * 0.4);
    }
    else {
    minStartDistance = Math.floor(maxDistance * 0.4);
    }

    // Filter land hexes (exclude water)
    const landHexes = board.filter(hex => hex.outerType !== 'water');

    // Use top 1/4 and bottom 1/4 rows for start area selection:
    const topFractionMaxRow = Math.floor(maxRow / 4);
    const bottomFractionMinRow = Math.floor(maxRow * 3 / 4);

    const blueCandidates = landHexes.filter(hex => hex.row <= topFractionMaxRow);
    const redCandidates = landHexes.filter(hex => hex.row >= bottomFractionMinRow);

    // If no candidates found (unlikely), fallback to entire landHexes:
    const safeBlueCandidates = blueCandidates.length > 0 ? blueCandidates : landHexes;
    const safeRedCandidates = redCandidates.length > 0 ? redCandidates : landHexes;

    const blueStartHex = safeBlueCandidates[Math.floor(Math.random() * safeBlueCandidates.length)];

    function hexDistance(h1, h2) {
        return Math.abs(h1.row - h2.row) + Math.abs(h1.col - h2.col);
    }

    const farRedCandidates = safeRedCandidates.filter(h => hexDistance(h, blueStartHex) >= minStartDistance);
    const safeFarRedCandidates = farRedCandidates.length > 0 ? farRedCandidates : safeRedCandidates;

    const redStartHex = safeFarRedCandidates[Math.floor(Math.random() * safeFarRedCandidates.length)];

    // Assign starting types and variables for blueStartHex
    blueStartHex.innerType = 'metropolis';
    blueStartHex.outerType = 'plains';
    blueStartHex.innerVariables.population = 1000;
    blueStartHex.outerVariables.population = 1000;
    blueStartHex.innerVariables.foodProduction = 1000;
    blueStartHex.outerVariables.foodProduction = 1000;
    blueStartHex.innerVariables.control = 100;
    blueStartHex.outerVariables.control = 25;
    blueStartHex.innerVariables.wealth = 1000;
    blueStartHex.outerVariables.wealth = 500;

    // Assign starting types and variables for redStartHex
    redStartHex.innerType = 'metropolis';
    redStartHex.outerType = 'plains';
    redStartHex.innerVariables.population = 1000;
    redStartHex.outerVariables.population = 1000;
    redStartHex.innerVariables.foodProduction = 1000;
    redStartHex.outerVariables.foodProduction = 1000;
    redStartHex.innerVariables.control = 100;
    redStartHex.outerVariables.control = 25;
    redStartHex.innerVariables.wealth = 1000;
    redStartHex.outerVariables.wealth = 500;
    
  document.getElementById('blueFoodValue').textContent = '1000';
  document.getElementById('blueGoldValue').textContent = '500';
  document.getElementById('blueScienceValue').textContent = '0';
  document.getElementById('blueCultureValue').textContent = '0';
  document.getElementById('blueFaithValue').textContent = '100';
  document.getElementById('blueProductionValue').textContent = '500';
  document.getElementById('bluePopulationValue').textContent = '1000';

  document.getElementById('redFoodValue').textContent = '1000';
  document.getElementById('redGoldValue').textContent = '500';
  document.getElementById('redScienceValue').textContent = '0';
  document.getElementById('redCultureValue').textContent = '0';
  document.getElementById('redFaithValue').textContent = '100';
  document.getElementById('redProductionValue').textContent = '500';
  document.getElementById('redPopulationValue').textContent = '1000';
  
    // Clear any existing tokens at start hexes
    blueStartHex.tokens.inner.blue = {};
    blueStartHex.tokens.outer.blue = {};
    redStartHex.tokens.inner.red = {};
    redStartHex.tokens.outer.red = {};

    // Place starting tokens (example: 1 Infantry A and 1 Archer B inner ring for each)
    addTokens(blueStartHex, 'inner', 'A', 2, 'blue');
    addTokens(blueStartHex, 'inner', 'B', 2, 'blue');
    addTokens(blueStartHex, 'inner', 'C', 2, 'blue');
    addTokens(redStartHex, 'inner', 'A', 1, 'red');
    addTokens(redStartHex, 'inner', 'B', 1, 'red');

    blueStartHex.updateTokenInstances();
    redStartHex.updateTokenInstances();

    captureMap.set(captureKey(blueStartHex), { inner: 'blue', outer: null });
    captureMap.set(captureKey(redStartHex), { inner: 'red', outer: null });
}

function generateRivers(board) {
  const maxRiverLength = 9;
  const riverCount = 5;

  // Filter land hexes (non water)
  const landHexes = board.filter(h => h.outerType !== 'water');

  let riverSources = [];

  const triedSources = new Set();

  while (riverSources.length < riverCount) {
    const candidate = landHexes[Math.floor(Math.random() * landHexes.length)];
    const key = `${candidate.row},${candidate.col}`;
    if (triedSources.has(key)) continue;
    triedSources.add(key);

    // Build river chain from candidate
    const chain = [candidate];
    candidate.hasRiver = true;

    let current = candidate;

    for (let i = 1; i < maxRiverLength; i++) {
      const nbrs = getNeighbors(current, board).filter(n => !n.hasRiver && n.outerType !== 'water');
      if (nbrs.length === 0) break;
      // Randomly pick one neighbor
      const nextHex = nbrs[Math.floor(Math.random() * nbrs.length)];
      chain.push(nextHex);
      nextHex.hasRiver = true;
      current = nextHex;
    }

    riverSources.push(chain);
  }
}

// Utility to add tokens to hex for a player
function addTokens(hex, ring, classLetter, quantity, player) {
    if(!(ring in hex.tokens)) return;
    if(!(player in hex.tokens[ring])) return;
    const currentCount = hex.tokens[ring][player][classLetter] || 0;
    hex.tokens[ring][player][classLetter] = currentCount + quantity;
}

// Initialize board
let board = generateMapByType(selectedMapType);
window.board = board;

// After generating map, assign population & resource values
assignPopulationAndValues(board);

// Setup starting positions based on board
setupStartingPositions(board);
updateAllCaptures();

// Update token instances for all hexes
for(const hex of board) {
    hex.updateTokenInstances();
}
