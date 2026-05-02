let globalManaStorage = {
  blue: { food: 1000, wealth: 200, science: 0, culture: 0, faith: 0, production: 200, power: 0, absolutism: 0 },
  red: { food: 1000, wealth: 200, science: 0, culture: 0, faith: 0, production: 200, power: 0, absolutism: 0 },
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

function ringManaPop() {
  function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }

  let bluePopulation = 0;
  let redPopulation = 0;
  
  // Prepare totals for mana generation
  const totals = {
    blue: { food: 0, foodProduction: 0, wealth: 0, science: 0, culture: 0, faith: 0, production: 0, population: 0, power: 0, absolutism: 0 },
    red:  { food: 0, foodProduction: 0, wealth: 0, science: 0, culture: 0, faith: 0, production: 0, population: 0, power: 0, absolutism: 0 },
  };

  // Use local copies of global food for population growth food consumption
  let blueFood = globalManaStorage.blue.food;
  let redFood = globalManaStorage.red.food;

  for (const hex of board) {
    const capture = getCapture(hex);

    for (const ring of ['inner', 'outer']) {
      const owner = capture[ring];
      if (owner !== 'blue' && owner !== 'red') continue;

      const vars = ring === 'inner' ? hex.innerVariables : hex.outerVariables;
      if (!vars) continue;

      // --- MANA GENERATION ---

      const absolutism = globalManaStorage[owner].absolutism || 0;
      const control = (vars.control !== undefined ? vars.control : 0) / 100;
      const happiness = (vars.happiness || 0) / 100;
      const crime = (vars.crime || 0) / 100;
      const health = (vars.health || 0) / 100;
      const literacy = (vars.literacy || 0) / 100;
      const devastationPct = clamp(vars.devastation || 0, 0, 100) / 100;
      const localTaxRate = (vars.localTax !== undefined ? vars.localTax : 50) / 100;
      const capitalTaxInput = document.getElementById('capitalTaxInput');
      const capitalTaxRate = capitalTaxInput ? (parseInt(capitalTaxInput.value, 10) || 50) / 100 : 0.5; 
      const pollTaxInput = document.getElementById('pollTaxInput');
      const pollTaxRate = pollTaxInput ? (parseInt(pollTaxInput.value, 10) || 50) / 100 : 0.5;

      // Determine terrainType for food multiplier fallbacks
      const terrainType = (ring === 'inner' ? hex.innerType : hex.outerType) || ring;
      const ringFoodMult = (foodRingMult[ring] && foodRingMult[ring][terrainType]) || 1;

      const foodProduction = vars.foodProduction || 0;
      const wealth = vars.wealth || 0;
      const science = vars.science || 0;
      const culture = vars.culture || 0;
      const faith = vars.faith || 0;
      const power = vars.power || 0;
      const production = vars.production || 0;
      const populationRaw = vars.population || 0;

      const happinessMult = 1 + happiness;
      const crimeMult = 1 - crime;
      const healthMult = 1 + health;
      const taxMult = localTaxRate;
      const literacyMult = literacy;
      const controlMult = control;
      
      if (vars.devastation > 1) {
        vars.devastation -= 1;
        vars.wealth -= 10;
      }
      
      if (vars.control !== undefined) {
        if (vars.control < absolutism) {
          vars.control = Math.min(vars.control + 0.1, 100);
        } else if (vars.control > absolutism) {
          vars.control = Math.max(vars.control - 0.1, 0);
        }
      }

      // Food generation
      const rawFoodIncome = foodProduction * controlMult * happinessMult * crimeMult * healthMult * ringFoodMult;

      // Add food income to ring local food stockpile
      vars.foodStockpile = (vars.foodStockpile || 0) + rawFoodIncome;

      // Max local food stockpile limit, spill excess to global mana storage
      const maxLocalFood = 5 * populationRaw;

      if (vars.foodStockpile > maxLocalFood) {
        const excess = vars.foodStockpile - maxLocalFood;
        vars.foodStockpile = maxLocalFood;
        totals[owner].food += excess;
      }

      totals[owner].foodProduction += rawFoodIncome;

      // Other resources income
      const brutoPollTaxIncome = populationRaw * taxMult * pollTaxRate * controlMult * happinessMult * crimeMult * healthMult;
      const pollTaxIncome = brutoPollTaxIncome * (1 - totalInvestmentLevels * 0.04);
      const brutoCapitalTaxIncome = wealth * controlMult * taxMult * capitalTaxRate * happinessMult * crimeMult * healthMult;
      const capitalTaxIncome = brutoCapitalTaxIncome * (1 - totalInvestmentLevels * 0.04);
      const wealthIncome = pollTaxIncome + capitalTaxIncome;
      const scienceIncome = science * controlMult * literacyMult * happinessMult * crimeMult * healthMult + (investmentLevels.science * (brutoPollTaxIncome + brutoCapitalTaxIncome) / 25);
      const cultureIncome = culture * controlMult * happinessMult * crimeMult * healthMult + (investmentLevels.culture * (brutoPollTaxIncome + brutoCapitalTaxIncome) / 25);
      const faithIncome = faith * controlMult * happinessMult * crimeMult * healthMult + (investmentLevels.faith * (brutoPollTaxIncome + brutoCapitalTaxIncome) / 25);
      const productionIncome = production * controlMult * happinessMult * crimeMult * healthMult + (investmentLevels.production * (brutoPollTaxIncome + brutoCapitalTaxIncome) / 25);
      const powerIncome = power * controlMult * happinessMult * crimeMult * healthMult + (investmentLevels.power * (brutoPollTaxIncome + brutoCapitalTaxIncome) / 25);

      totals[owner].wealth += wealthIncome;
      totals[owner].science += scienceIncome;
      totals[owner].culture += cultureIncome;
      totals[owner].faith += faithIncome;
      totals[owner].power += powerIncome;
      totals[owner].production += productionIncome;
      totals[owner].population += populationRaw;

      // --- POPULATION GROWTH ---

      // Reset per-turn starvation/growth tracking
      vars.starvedLastTurn = 0;
      vars.grownLastTurn = 0;
      vars._previousPopulation = populationRaw;

      let population = populationRaw;
      if (population <= 0) {
        vars.growth = 0;
        continue; // skip further growth if no population
      }

      vars.foodStockpile = vars.foodStockpile || 0;

      // Consume food from local stockpile equal to population
      const foodNeeded = population;
      vars.foodStockpile -= foodNeeded;

      // If local food is insufficient, consume from global food stock
      if (vars.foodStockpile < 0) {
        const neededFood = -vars.foodStockpile;
        let globalFood = owner === 'blue' ? blueFood : redFood;
        const foodUsed = Math.min(neededFood, globalFood);
        vars.foodStockpile += foodUsed;
        if (owner === 'blue') blueFood -= foodUsed;
        else redFood -= foodUsed;

        // If still negative, starvation occurs
        if (vars.foodStockpile < 0) {
          const starvation = -vars.foodStockpile;
          vars.foodStockpile = 0;
          const starved = Math.min(starvation, population);
          population -= starved;
          vars.population = population;
          vars.starvedLastTurn = starved;
        }
      }

      // Calculate population growth if still alive
      if (population > 0) {
        // Clamp variables to safe ranges
        const healthPct = clamp(vars.health || 0, 0, 100) / 100;
        const happinessPct = clamp(vars.happiness || 0, 0, 100) / 100;
        const wealthVal = vars.wealth || 0;
        const foodStock = vars.foodStockpile || 0;
        const literacyPct = clamp(vars.literacy || 0, 0, 100) / 100;
        const controlPct = clamp(vars.control || 0, 0, 100);
        const devastationPct = clamp(vars.devastation || 0, 0, 100) / 100;

        // Wealth bonus by tiers
        let wealthBonus = 0;
        if (wealthVal >= population * 5) wealthBonus = 0.05;
        else if (wealthVal >= population * 3) wealthBonus = 0.03;
        else if (wealthVal >= population * 2) wealthBonus = 0.02;

        const foodBonus = Math.min(foodStock / (2 * population), 1) * 0.1;
        const literacyPenalty = -0.05 * literacyPct;
        const devastationPenalty = -0.1 * devastationPct;

        let growthRate = 1.0 + (healthPct * 0.1) + (happinessPct * 0.05) + wealthBonus + foodBonus + literacyPenalty + devastationPenalty;
        growthRate = Math.max(growthRate, 0);
        growthRate = Math.ceil(growthRate * 100) / 100;

        const newPopulation = Math.floor(population * growthRate);
        vars.growth = growthRate;

        const grew = newPopulation - population;
        vars.grownLastTurn = grew;

        vars.population = newPopulation;
        population = newPopulation;
        const pop = vars.population || 0;
        if (owner === 'blue') bluePopulation += pop;
        else if (owner === 'red') redPopulation += pop;
      } else {
        // Population zero disables growth
        vars.growth = 0;
        vars.grownLastTurn = 0;
      }
    }
  }

  // Commit updated global food after population growth consumption
  globalManaStorage.blue.food = clamp(blueFood, 0, Number.MAX_SAFE_INTEGER);
  globalManaStorage.red.food = clamp(redFood, 0, Number.MAX_SAFE_INTEGER);

  // Update other global resources with totals from manaGeneration
  ['food', 'wealth', 'science', 'culture', 'faith', 'production', 'power'].forEach(resource => {
    globalManaStorage.blue[resource] = (globalManaStorage.blue[resource] || 0) + totals.blue[resource];
    globalManaStorage.red[resource] = (globalManaStorage.red[resource] || 0) + totals.red[resource];
  });

  // Clamp global mana values (no negatives)
  ['wealth', 'science', 'culture', 'faith', 'production', 'power'].forEach(resource => {
    globalManaStorage.blue[resource] = Math.max(globalManaStorage.blue[resource], 0);
    globalManaStorage.red[resource] = Math.max(globalManaStorage.red[resource], 0);
  });

  // Max food based on population * 30 (same as before)
  const blueMaxFood = Math.floor(totals.blue.population * 30);
  const redMaxFood = Math.floor(totals.red.population * 30);
  globalManaStorage.blue.food = Math.min(globalManaStorage.blue.food, blueMaxFood);
  globalManaStorage.red.food = Math.min(globalManaStorage.red.food, redMaxFood);

  // Absolutism unchanged UI update
  totals.blue.absolutism = globalManaStorage.blue.absolutism || 0;
  totals.red.absolutism = globalManaStorage.red.absolutism || 0;

  // Format functions for UI display
  function formatVal(curr, inc) { return `${Math.floor(curr)} (+${Math.floor(inc)})`; }
  function formatFood(curr, max, production) { return `${Math.floor(curr)} / ${max} (+${Math.floor(production)})`; }

  // Update UI for blue player
  document.getElementById('blueGoldValue').textContent = formatVal(globalManaStorage.blue.wealth, totals.blue.wealth);
  document.getElementById('blueScienceValue').textContent = formatVal(globalManaStorage.blue.science, totals.blue.science);
  document.getElementById('blueCultureValue').textContent = formatVal(globalManaStorage.blue.culture, totals.blue.culture);
  document.getElementById('blueFaithValue').textContent = formatVal(globalManaStorage.blue.faith, totals.blue.faith);
  document.getElementById('blueProductionValue').textContent = formatVal(globalManaStorage.blue.production, totals.blue.production);
  document.getElementById('bluePowerValue').textContent = formatVal(globalManaStorage.blue.power, totals.blue.power);
  document.getElementById('blueFoodValue').textContent = formatFood(globalManaStorage.blue.food, blueMaxFood, totals.blue.foodProduction);
  document.getElementById('blueAbsolutismValue').textContent = `${Math.floor(totals.blue.absolutism)}%`;

  // Update UI for red player
  document.getElementById('redGoldValue').textContent = formatVal(globalManaStorage.red.wealth, totals.red.wealth);
  document.getElementById('redScienceValue').textContent = formatVal(globalManaStorage.red.science, totals.red.science);
  document.getElementById('redCultureValue').textContent = formatVal(globalManaStorage.red.culture, totals.red.culture);
  document.getElementById('redFaithValue').textContent = formatVal(globalManaStorage.red.faith, totals.red.faith);
  document.getElementById('redProductionValue').textContent = formatVal(globalManaStorage.red.production, totals.red.production);
  document.getElementById('redPowerValue').textContent = formatVal(globalManaStorage.red.power, totals.red.power);
  document.getElementById('redFoodValue').textContent = formatFood(globalManaStorage.red.food, redMaxFood, totals.red.foodProduction);
  document.getElementById('redAbsolutismValue').textContent = `${Math.floor(totals.red.absolutism)}%`;

  // Update total population UI separately
  document.getElementById('bluePopulationValue').textContent = Math.floor(bluePopulation);
  document.getElementById('redPopulationValue').textContent = Math.floor(redPopulation);
}
