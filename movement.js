let queuedMoves = []; // Array of move assignments
let moveBootIcons = [];

function ringDistance(hexStart, ringStart, hexEnd, ringEnd) {
  // Distance between rings in same hex
  if(hexStart === hexEnd) {
    return (ringStart !== ringEnd) ? 1 : 0;
  }

  // Hex distance (using axial coordinates or approximating Manhattan)
  // Assuming hex grid uses row, col:
  const dRow = Math.abs(hexStart.row - hexEnd.row);
  const dCol = Math.abs(hexStart.col - hexEnd.col);

  // Standard hex distance formula for flat topped:
  // https://www.redblobgames.com/grids/hexagons/#distances
  // Using cube coords:
  let x1 = hexStart.col - ((hexStart.row + (hexStart.row&1)) >> 1);
  let z1 = hexStart.row;
  let y1 = -x1 - z1;

  let x2 = hexEnd.col - ((hexEnd.row + (hexEnd.row&1)) >> 1);
  let z2 = hexEnd.row;
  let y2 = -x2 - z2;

  const hexDist = (Math.abs(x1-x2) + Math.abs(y1-y2) + Math.abs(z1-z2)) / 2;

  // Distance counting inner/outer ring switches: 
  // +1 for each ring switch (in -> out or out->in) transitions along path,
  // here approximated as 1 if rings differ besides first, else 0.
  // To simplify, count one additional step if start ring != 'outer' or end ring != 'outer'.
  // We'll add 1 for each ring difference crossing.

  let ringCrosses = 0;
  if(ringStart !== 'outer') ringCrosses += 1;
  if(ringEnd !== 'outer') ringCrosses += 1;

  return hexDist + ringCrosses;
}

// Replaces showQuantitySelector and sequential assignment for multiple classes

function showQuantitySelectorMultiple(tokensByClass, callback) {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.right = 0;
  overlay.style.bottom = 0;
  overlay.style.background = 'rgba(0, 0, 0, 0.85)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = 20000;

  const panel = document.createElement('div');
  panel.style.background = 'black';
  panel.style.color = 'gold';
  panel.style.padding = '20px 20px';
  panel.style.borderRadius = '16px';
  panel.style.minWidth = '100px';
  panel.style.maxWidth = '90vw';
  panel.style.maxHeight = '70vh';
  panel.style.overflowY = 'auto';
  panel.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.gap = '16px';
  panel.style.userSelect = 'none';

  const title = document.createElement('h2');
  title.textContent = 'Movement';
  title.style.margin = '0 0 18px 0';
  title.style.borderBottom = '2px solid gold';
  title.style.paddingBottom = '10px';
  panel.appendChild(title);

  // Store selected quantities per class
  const selectedQuantities = {};

  for (const classLetter in tokensByClass) {
    const maxQty = tokensByClass[classLetter];

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';
    row.style.marginBottom = '12px';

    const label = document.createElement('div');
    label.textContent = `${classLetter}:`;
    label.style.fontWeight = '600';
    label.style.fontSize = '1.1rem';
    label.style.userSelect = 'text';

    const select = document.createElement('select');
    select.style.fontSize = '1rem';
    select.style.padding = '6px 12px';
    select.style.borderRadius = '10px';
    select.style.border = '2px solid gold';
    select.style.background = 'black';
    select.style.color = 'gold';
    select.style.fontWeight = '600';
    select.style.cursor = 'pointer';
    select.style.minWidth = '70px';

    for (let i = maxQty; i >= 0; i--) {
      const option = document.createElement('option');
      option.value = i;
      option.textContent = i;
      select.appendChild(option);
    }
    
    select.value = String(maxQty);
    selectedQuantities[classLetter] = maxQty;


    select.addEventListener('change', () => {
      selectedQuantities[classLetter] = parseInt(select.value, 10);
    });

    row.appendChild(label);
    row.appendChild(select);
    panel.appendChild(row);
  }

  const buttonsDiv = document.createElement('div');
  buttonsDiv.style.textAlign = 'right';
  buttonsDiv.style.marginTop = '20px';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.marginRight = '12px';
  cancelBtn.style.padding = '10px 18px';
  cancelBtn.style.borderRadius = '12px';
  cancelBtn.style.border = 'none';
  cancelBtn.style.backgroundColor = 'black';
  cancelBtn.style.color = 'gold';
  cancelBtn.style.cursor = 'pointer';
  cancelBtn.style.fontWeight = '700';
  cancelBtn.style.transition = 'background-color 0.3s ease, color 0.3s ease';
  cancelBtn.style.userSelect = 'none';

  cancelBtn.onmouseenter = () => {
    cancelBtn.style.backgroundColor = 'gold';
    cancelBtn.style.color = 'black';
  };
  cancelBtn.onmouseleave = () => {
    cancelBtn.style.backgroundColor = 'black';
    cancelBtn.style.color = 'gold';
  };

  cancelBtn.addEventListener('click', () => {
    document.body.removeChild(overlay);
    callback(null);
  });

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'Confirm';
  confirmBtn.style.padding = '10px 22px';
  confirmBtn.style.borderRadius = '12px';
  confirmBtn.style.border = 'none';
  confirmBtn.style.backgroundColor = 'gold';
  confirmBtn.style.color = 'black';
  confirmBtn.style.cursor = 'pointer';
  confirmBtn.style.fontWeight = '700';
  confirmBtn.style.transition = 'background-color 0.3s ease, color 0.3s ease';
  confirmBtn.style.userSelect = 'none';

  confirmBtn.onmouseenter = () => {
    confirmBtn.style.backgroundColor = 'black';
    confirmBtn.style.color = 'gold';
    confirmBtn.style.border = '2px solid gold';
  };
  confirmBtn.onmouseleave = () => {
    confirmBtn.style.backgroundColor = 'gold';
    confirmBtn.style.color = 'black';
    confirmBtn.style.border = 'none';
  };

  confirmBtn.addEventListener('click', () => {
    const result = {};
    for (const cls in selectedQuantities) {
      const qty = selectedQuantities[cls];
      if (qty > 0) result[cls] = qty;
    }
    document.body.removeChild(overlay);
    callback(result);
  });

  buttonsDiv.appendChild(cancelBtn);
  buttonsDiv.appendChild(confirmBtn);
  panel.appendChild(buttonsDiv);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

function assignQueuedMove(fromHex, fromRing, classLetter, qty, toHex, toRing) {
  // Check movement distance against speed of token class
  
  if (fromHex === toHex && fromRing === toRing) {
    illegalSound.play();
    alert("Cannot move units to the same ring.");
    return false;
  }
  
  const speed = tokenClassProperties[classLetter].speed || 1;
  const dist = ringDistance(fromHex, fromRing, toHex, toRing);
  if(dist > speed) {
    illegalSound.play();
    return false;
  }
  
  const player = currentPlayer;
  
  // Check sufficient tokens available immediately (after subtracting previously assigned)
  const fromCount = fromHex.tokens[fromRing][player][classLetter] || 0;
  if (fromCount < qty) {
    illegalSound.play();
    return false;
  }
  
  // Immediately subtract quantity from source hex tokens
  fromHex.tokens[fromRing][player][classLetter] = fromCount - qty;
  if (fromHex.tokens[fromRing][player][classLetter] <= 0) {
    delete fromHex.tokens[fromRing][player][classLetter];
  }
  fromHex.updateTokenInstances();

  // Add queued move ONLY for adding tokens at destination later
  const existingMove = queuedMoves.find(m =>
    m.hexTo === toHex && m.ringTo === toRing &&
    m.classLetter === classLetter &&
    m.player === player
  );

  if (existingMove) {
    existingMove.quantity += qty;
  } else {
    queuedMoves.push({
      hexFrom: fromHex,    // Can keep for reference but not used for subtraction
      ringFrom: fromRing,
      classLetter,
      quantity: qty,
      hexTo: toHex,
      ringTo: toRing,
      player
    });
  }

  draw();
  return true;
}

function drawQueuedMoves(ctx) {
  ctx.save();
  ctx.fillStyle = 'gold';      // bright orange text
  ctx.strokeStyle = 'gold';    // orange crosshair stroke
  ctx.lineWidth = 2;
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  moveBootIcons = [];

  const grouped = {};
  queuedMoves.forEach(move => {
    const key = `${move.hexTo.row},${move.hexTo.col},${move.ringTo}`;
    if (!grouped[key]) grouped[key] = { hex: move.hexTo, ring: move.ringTo, quantity: 0, classes: {} };
    grouped[key].quantity += move.quantity;
    grouped[key].classes[move.classLetter] = (grouped[key].classes[move.classLetter] || 0) + move.quantity;
  });

  for (const key in grouped) {
    const g = grouped[key];
    const center = getRingCenter(g.hex, g.ring);
    const radius = HEX_RADIUS * (g.ring === 'inner' ? INNER_RING_RATIO : OUTER_RING_RATIO);

    const iconX = center.x;
    const iconY = center.y - radius; // top edge of ring

    const size = 24;
    const crosshairRadius = size / 2;
    const crosshairLineLen = crosshairRadius * 0.8;

    // Draw quantity on top
    ctx.fillText(g.quantity, iconX, iconY);

    // Draw sniper crosshair centered 10px below quantity (adjust as needed)
    const crosshairCenterY = iconY + 10;

    ctx.beginPath();
    // vertical line
    ctx.moveTo(iconX, crosshairCenterY - crosshairLineLen);
    ctx.lineTo(iconX, crosshairCenterY + crosshairLineLen);
    // horizontal line
    ctx.moveTo(iconX - crosshairLineLen, crosshairCenterY);
    ctx.lineTo(iconX + crosshairLineLen, crosshairCenterY);
    // outer circle
    ctx.moveTo(iconX + crosshairRadius, crosshairCenterY);
    ctx.arc(iconX, crosshairCenterY, crosshairRadius, 0, Math.PI * 2);
    ctx.stroke();

    moveBootIcons.push({
      x: iconX,
      y: crosshairCenterY, // use crosshair center y (not quantity y)
      radius: crosshairRadius + 4, // add small padding for easier clicking
      hex: g.hex,
      ring: g.ring,
      classes: g.classes
    });
  }

  ctx.restore();
}

function getRingCenter(hex, ring) {
  const center = hex.getCenter();
  if(ring === 'outer') {
    return {x: center.x, y: center.y}; // hex center approx outer ring center
  } else if(ring === 'inner') {
    return {x: center.x, y: center.y}; // inner circle center same for simplicity; offset if needed
  }
}

function highlightMoveTargets() {
  if (selectedTokens.length === 0) return;

  // For simplicity, highlight reachable rings per class of the first selected token
  const fromToken = selectedTokens[0];
  const fromHex = fromToken.hex;
  const fromRing = fromToken.ring;
  const classLetter = fromToken.classLetter;
  const speed = tokenClassProperties[classLetter]?.speed || 1;

  // Highlight rings within speed distance from the origin of selected tokens' hex+ring
  board.forEach(hex => {
    ['inner', 'outer'].forEach(ring => {
      const dist = ringDistance(fromHex, fromRing, hex, ring);
      if (dist >= 1 && dist <= speed) {
        // Skip highlighting outer ring if it's water
        if (ring === 'outer' && hex.outerType === 'water') return;

        // Skip highlighting inner ring if it's island
        if (ring === 'inner' && hex.innerType === 'island') return;
        const center = getRingCenter(hex, ring);
        ctx.save();
        ctx.strokeStyle = '#39FF14';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(center.x, center.y, HEX_RADIUS * (ring === 'inner' ? INNER_RING_RATIO : OUTER_RING_RATIO) * 0.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    });
  });
}

canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  for (const icon of moveBootIcons) {
    const dx = x - icon.x;
    const dy = y - icon.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    if (dist <= icon.radius) {
      // Click inside circular crosshair area
      showMovementDetailsPopup(icon);
      return;
    }
  }
});

function showMovementDetailsPopup(icon) {
  // Create overlay div
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.right = 0;
  overlay.style.bottom = 0;
  overlay.style.background = 'rgba(0, 0, 0, 0.85)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = 30000;

  // Popup container
  const popup = document.createElement('div');
  popup.style.background = 'black';
  popup.style.color = 'gold';
  popup.style.padding = '24px 36px';
  popup.style.borderRadius = '16px';
  popup.style.minWidth = '360px';
  popup.style.maxWidth = '90vw';
  popup.style.maxHeight = '70vh';
  popup.style.overflowY = 'auto';
  popup.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
  popup.style.boxShadow = '0 0 25px gold';
  popup.style.display = 'flex';
  popup.style.flexDirection = 'column';
  popup.style.gap = '16px';
  popup.style.textAlign = 'center';
  popup.style.userSelect = 'none';

  // Title
  const title = document.createElement('h2');
  title.textContent = `Movement to [${icon.hex.row}, ${icon.hex.col}] ${capitalize(icon.ring)} ring`;
  title.style.margin = '0 0 18px 0';
  title.style.borderBottom = '2px solid gold';
  title.style.paddingBottom = '10px';
  popup.appendChild(title);

  // List quantities by class
  for (const cls in icon.classes) {
    const li = document.createElement('div');
    li.textContent = `Class ${cls}: ${icon.classes[cls]}`;
    li.style.margin = '6px 0';
    li.style.fontSize = '18px';
    li.style.fontWeight = '600';
    li.style.userSelect = 'text';
    popup.appendChild(li);
  }

  // Cancel button
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel All Movements to This Ring';
  cancelBtn.style.marginTop = '28px';
  cancelBtn.style.padding = '14px 28px';
  cancelBtn.style.fontWeight = '700';
  cancelBtn.style.borderRadius = '12px';
  cancelBtn.style.border = `3px solid gold`;
  cancelBtn.style.cursor = 'pointer';
  cancelBtn.style.backgroundColor = 'black';
  cancelBtn.style.color = 'gold';
  cancelBtn.style.alignSelf = 'center';
  cancelBtn.style.boxShadow = '0 0 16px gold';
  cancelBtn.style.transition = 'background-color 0.3s ease, color 0.3s ease';

  cancelBtn.onmouseenter = () => {
    cancelBtn.style.backgroundColor = 'gold';
    cancelBtn.style.color = 'black';
  };
  cancelBtn.onmouseleave = () => {
    cancelBtn.style.backgroundColor = 'black';
    cancelBtn.style.color = 'gold';
  };

  cancelBtn.onclick = () => {
    // Remove all queuedMoves matching this hex and ring
    queuedMoves = queuedMoves.filter(m => !(m.hexTo === icon.hex && m.ringTo === icon.ring));
    document.body.removeChild(overlay);
    draw();
  };

  popup.appendChild(cancelBtn);

  // Close popup on clicking outside popup box
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  };

  overlay.appendChild(popup);
  document.body.appendChild(overlay);
}