// Track investment levels { power: 0, science: 0, production: 0, faith: 0, culture: 0 }
let investmentLevels = {
  power: 0,
  science: 0,
  production: 0,
  faith: 0,
  culture: 0,
};

let totalInvestmentLevels = 0;
let taxEfficiency = 10;
  
// Track cooldowns for market purchases
const marketCooldowns = {
  manpower: 0,
  food: 0,
  production: 0,
  equipment: 0,
};

const financeInterface = document.createElement('div');
financeInterface.id = 'financeInterface';
financeInterface.style = `
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: #1a2a6c;
  color: gold;
  padding: 20px;
  border-radius: 16px;
  width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  z-index: 10000;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  user-select: none;
  display: none;
  box-shadow: 0 0 30px #ff6f00;
`;

financeInterface.innerHTML = `
  <h2 style="text-align:center; border-bottom: 2px solid #ff6f00; padding-bottom: 8px; margin-bottom: 20px;">Finance Interface</h2>

  <section id="taxMenu" style="
    margin-bottom: 20px;
    padding: 12px;
    background-color: black;
    border: 3px solid gold;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    user-select: none;
  ">
    <h3 style="color: gold; margin: 0 0 12px 0; font-weight: 700; border-bottom: 2px solid gold; width: 100%; text-align: center;">Taxation</h3>
    <div id="taxEfficiency" style="color: gold; font-weight: 700; margin-bottom: 10px; font-size: 1.2rem;">Tax Efficiency: 100%</div>

    <label style="width: 100%; color: gold; font-weight: 700; margin-bottom: 6px; user-select: text;">
      Poll Tax: 
      <input 
        type="number" 
        id="pollTaxInput" 
        min="1" max="100" value="50" 
        style="width: 60px; margin-left: 10px; font-weight: 600; border-radius: 6px; border: 2px solid gold; background: black; color: gold; padding: 2px 6px;"
        oninput="this.value=this.value.replace(/[^0-9]/g,''); if(this.value<1) this.value=1; else if(this.value>100) this.value=100;"
      >
    </label>
    <input 
      type="range" 
      id="pollTaxSlider" 
      min="1" max="100" value="50" 
      style="width: 100%; margin-bottom: 16px; accent-color: gold; cursor: pointer;"
      oninput="const numInput=document.getElementById('pollTaxInput'); numInput.value=this.value; updateTaxEfficiency();"
    >

    <label style="width: 100%; color: gold; font-weight: 700; margin-bottom: 6px; user-select: text;">
      Capital Tax:
      <input 
        type="number" 
        id="capitalTaxInput" 
        min="1" max="100" value="50"
        style="width: 60px; margin-left: 10px; font-weight: 600; border-radius: 6px; border: 2px solid gold; background: black; color: gold; padding: 2px 6px;"
        oninput="this.value=this.value.replace(/[^0-9]/g,''); if(this.value<1) this.value=1; else if(this.value>100) this.value=100;"
      >
    </label>
    <input 
      type="range" 
      id="capitalTaxSlider" 
      min="1" max="100" value="50" 
      style="width: 100%; accent-color: gold; cursor: pointer;"
      oninput="const numInput=document.getElementById('capitalTaxInput'); numInput.value=this.value; updateTaxEfficiency();"
    >
  </section>

  <section id="maintenanceMenu" style="
    background-color: black; 
    border: 3px solid gold; 
    border-radius: 12px; 
    padding: 12px;
    user-select: none;
  ">
    <h3 style="color: gold; margin-top: 0; border-bottom: 2px solid gold; padding-bottom: 6px;">Upkeep</h3>
    <div id="tokenMaintenanceList" style="margin-bottom: 12px;"></div>
    <div style="color: gold; font-weight: 600;">Public Agents Upkeep (not operational)</div>
    <div><em>Government Upkeep (not operational)</em></div>
  </section>

  <section id="investmentMenu" style="
    margin-top: 20px;
    background-color: black; 
    border: 3px solid gold; 
    border-radius: 12px; 
    padding: 12px;
    user-select: none;
  ">
    <h3 style="color: gold; margin-top: 0; border-bottom: 2px solid gold; padding-bottom: 6px;">Public Services</h3>
    <table style="width: 100%; text-align: center; border-collapse: collapse; color: gold;">
      <thead>
        <tr>
          <th style="border-bottom: 2px solid gold;">Category</th>
          <th style="border-bottom: 2px solid gold;">Level</th>
        </tr>
      </thead>
      <tbody>
        ${['power','science','production','faith','culture'].map(cat => `
        <tr style="border-bottom: 1px solid gold;">
          <td style="text-transform: capitalize; padding: 6px 0;">${cat}</td>
          <td style="padding: 6px 0;">
            <select data-cat="${cat}" style="
              background-color: black;
              color: gold;
              font-weight: 700;
              padding: 6px 12px;
              border-radius: 10px;
              border: 2px solid gold;
              cursor: pointer;
              user-select: none;
              font-size: 1rem;
              transition: background-color 0.3s ease, color 0.3s ease;
            ">
              ${[0,1,2,3,4,5].map(v => `<option value="${v}">${v}</option>`).join('')}
            </select>
          </td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </section>

  <section id="marketMenu" style="
    margin-top: 20px;
    background-color: black;
    border: 3px solid gold;
    border-radius: 12px;
    padding: 12px;
    user-select: none;
  ">
    <h3 style="color: gold; margin-top: 0; border-bottom: 2px solid gold; padding-bottom: 6px;">Market</h3>
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
      <button data-purchase="manpower" style="
        background-color: black;
        color: gold;
        border: 2px solid gold;
        border-radius: 12px;
        padding: 10px;
        font-weight: 700;
        cursor: pointer;
        transition: background-color 0.3s ease, color 0.3s ease;
        user-select: none;
      ">Manpower<span class="cd" style="display:block; font-size:0.75rem; color:#ff6f00;"></span></button>
      <button data-purchase="food" style="
        background-color: black;
        color: gold;
        border: 2px solid gold;
        border-radius: 12px;
        padding: 10px;
        font-weight: 700;
        cursor: pointer;
        transition: background-color 0.3s ease, color 0.3s ease;
        user-select: none;
      ">Food<span class="cd" style="display:block; font-size:0.75rem; color:#ff6f00;"></span></button>
      <button data-purchase="production" style="
        background-color: black;
        color: gold;
        border: 2px solid gold;
        border-radius: 12px;
        padding: 10px;
        font-weight: 700;
        cursor: pointer;
        transition: background-color 0.3s ease, color 0.3s ease;
        user-select: none;
      ">Production<span class="cd" style="display:block; font-size:0.75rem; color:#ff6f00;"></span></button>
      <button data-purchase="equipment" style="
        background-color: black;
        color: gold;
        border: 2px solid gold;
        border-radius: 12px;
        padding: 10px;
        font-weight: 700;
        cursor: pointer;
        transition: background-color 0.3s ease, color 0.3s ease;
        user-select: none;
      ">Equipment<span class="cd" style="display:block; font-size:0.75rem; color:#ff6f00;"></span></button>
    </div>
  </section>
`;

document.body.appendChild(financeInterface);

function updateTokenMaintenance() {
  const container = document.getElementById('tokenMaintenanceList');
  container.innerHTML = '';

  // Aggregate token counts by class for current player (example: blue)
  const player = 'blue';  // or 'red', adjust per current state

  const tokenCounts = {};
  for (const hex of board) {
    ['inner', 'outer'].forEach(ring => {
      const capture = getCapture(hex)[ring];
      if (capture !== player) return;
      
      const tokens = hex.tokens[ring][player];
      if (!tokens) return;
      for (const cls in tokens) {
        tokenCounts[cls] = (tokenCounts[cls] || 0) + tokens[cls];
      }
    });
  }

  for (const cls in tokenCounts) {
    const count = tokenCounts[cls];
    const maintenance = (tokenClassProperties[cls]?.maintenance || 0) * count;
    const div = document.createElement('div');
    div.textContent = `${cls}: ${count} - ${maintenance}`;
    container.appendChild(div);
  }
}

financeInterface.querySelectorAll('select').forEach(sel => {
  sel.addEventListener('change', e => {
    const category = e.target.getAttribute('data-cat');
    investmentLevels[category] = Number(e.target.value);
    totalInvestmentLevels = Object.values(investmentLevels).reduce((a, b) => a + b, 0);
  });
});

financeInterface.querySelectorAll('#marketMenu button').forEach(btn => {
  btn.addEventListener('click', () => {
    const purchase = btn.getAttribute('data-purchase');
    if(marketCooldowns[purchase] > 0) return alert('Purchase on cooldown');
    marketCooldowns[purchase] = 10; // 10 turns cooldown
    updateMarketCooldownUI();
    // TODO: Trigger purchase effect
  });
});

function updateMarketCooldownUI() {
  financeInterface.querySelectorAll('#marketMenu button').forEach(btn => {
    const purchase = btn.getAttribute('data-purchase');
    const cdSpan = btn.querySelector('.cd');
    const cd = marketCooldowns[purchase];
    cdSpan.textContent = cd > 0 ? `CD: ${cd}` : '';
    btn.disabled = cd > 0;
  });
}

// Call once on load to init buttons state
updateMarketCooldownUI();

document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'f') {
    if (financeInterface.style.display === 'none' || !financeInterface.style.display) {
      updateTokenMaintenance();
      financeInterface.style.display = 'block';
    } else {
      financeInterface.style.display = 'none';
    }
  }
});

function updateTaxEfficiency() {
document.getElementById('taxEfficiency').textContent = `Tax Efficiency: ${taxEfficiency}%`;
}

const pollTaxInput = document.getElementById('pollTaxInput');
const pollTaxSlider = document.getElementById('pollTaxSlider');
const capitalTaxInput = document.getElementById('capitalTaxInput');
const capitalTaxSlider = document.getElementById('capitalTaxSlider');

// Sync inputs with sliders on change (for number inputs)
pollTaxInput.addEventListener('change', () => {
  let val = Math.min(100, Math.max(1, parseInt(pollTaxInput.value) || 1));
  pollTaxInput.value = val;
  pollTaxSlider.value = val;
});
capitalTaxInput.addEventListener('change', () => {
  let val = Math.min(100, Math.max(1, parseInt(capitalTaxInput.value) || 1));
  capitalTaxInput.value = val;
  capitalTaxSlider.value = val;
});

// Initialize efficiency display
updateTaxEfficiency();



