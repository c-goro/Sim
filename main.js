import p5 from "p5";
import Chart from "chart.js/auto";
import acornImg from "./icons/acorn.png";  // import image as a module
import waterImg         from "./icons/water.png";
import dirtImg          from "./icons/dirt.png";
import rockImg          from "./icons/rock.png";
import grassImg         from "./icons/grass.png";
import saplingImg       from "./icons/sapling.png";
import treeImg          from "./icons/tree.png";
import deadTreeImg      from "./icons/dead-tree.png";
import flowerSeedImg    from "./icons/flower-seed.png";
import meadowImg        from "./icons/meadow.png";
import beeImg           from "./icons/bee.png";
import treeVineImg      from "./icons/tree-vine.png";
import deadTreeVineImg  from "./icons/dead-tree-vine.png";
import meadowVineImg    from "./icons/meadow-vine.png";
import fireImg          from "./icons/fire.png";

// Define cell types
const WATER = "water";
const DIRT = "dirt";
const ROCK = "rock";
const GRASS = "grass";

// Global simulation control
let paused = false;

// Global simulation timing variables
let tickRate = 1; // years per second (adjustable)
let tickInterval = 1 / tickRate;
let lastTickTime = 0;
let timeAccumulator = 0;

// Global simulation time counter (in years)
let simulationYears = 0;

// Grid configuration
const cols = 150;
const rows = 150;
const cellSize = 15;
let grid = [];

// Data tracking for Chart.js
let populationHistory = [];
let myChart, averageAgeChart;  // add averageAgeChart variable

// Global arrays for plants and vines (one per grid cell)
let plantLayer = []; // holds plant objects or null per cell
let vineLayer = []; // holds vine objects or null per cell

// NEW: Update fixed view dimensions
const viewWidth = document.documentElement.clientWidth; // UPDATED: simulation width equals screen width
const viewHeight = 1000; // ...existing view height...
let zoomLevel = 1;          // NEW: zoom level (from 1x up to 10x)
let panX = 0, panY = 0;     // NEW: panning offset
let dragStartX = 0, dragStartY = 0; // NEW: for tracking drag

let rockTreeCounter = []; // NEW: counter for adjacent trees at rock cells

// Generate rivers instead of random water distribution and initialize plant/vine layers
function generateRivers(p) {
  grid = [];
  rockTreeCounter = []; // NEW: reset counter grid
  for (let i = 0; i < cols; i++) {
    grid[i] = [];
    plantLayer[i] = [];
    vineLayer[i] = [];
    rockTreeCounter[i] = []; // NEW: initialize counter row
    for (let j = 0; j < rows; j++) {
      let r = p.random(1);
      // Modified default terrain: fewer isolated rocks
      if (r < 0.1) grid[i][j] = ROCK;
      else if (r < 0.55) grid[i][j] = DIRT;
      else grid[i][j] = GRASS;
      plantLayer[i][j] = null;
      vineLayer[i][j] = null;
      rockTreeCounter[i][j] = (grid[i][j] === ROCK) ? 0 : null; // NEW
    }
  }
  // Create a couple of meandering rivers
  const riverCount = 2;
  for (let k = 0; k < riverCount; k++) {
    let col = Math.floor(p.random(cols));
    for (let j = 0; j < rows; j++) {
      col += Math.floor(p.random(-1, 2));
      col = Math.max(1, Math.min(cols - 2, col));
      for (let dx = -1; dx <= 1; dx++) {
        let x = col + dx;
        if (x >= 0 && x < cols) {
          grid[x][j] = WATER;
        }
      }
    }
  }
  // Generate mountain ranges (concentrated rocky areas)
  const mountainCount = 2;
  for (let k = 0; k < mountainCount; k++) {
    let col = Math.floor(p.random(cols));
    for (let j = 0; j < rows; j++) {
      col += Math.floor(p.random(-1, 2));
      col = Math.max(1, Math.min(cols - 2, col));
      for (let dx = -1; dx <= 1; dx++) {
        let x = col + dx;
        if (x >= 0 && x < cols && grid[x][j] !== WATER) {
          grid[x][j] = ROCK;
        }
      }
    }
  }
} 

// Global togglePause function
window.togglePause = () => {
  paused = !paused;
};

// Global keydown listener for spacebar (works anywhere on the page)
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    togglePause();
  }
});

let pInstance;  // Global variable to store the p5 instance
let showGrid = true; // NEW: global flag for grid lines
let zoomEnabled = false;  // NEW: flag for magnifier

// p5.js sketch using instance mode
const sketch = (p) => {
  // NEW: Declare terrain icon variables
  let waterIcon, dirtIcon, rockIcon, grassIcon;
  // NEW: Declare additional icon variable for bees
  let beeIcon;
  // NEW: Declare icon variables (added new vine icons)
  let treeSeedIcon, saplingIcon, treeIcon, deadTreeIcon, flowerSeedIcon, meadowIcon;
  let treeVineIcon, deadTreeVineIcon, meadowVineIcon, fireIcon;
  
  // UPDATED: Preload icon images from local "icons" folder
  p.preload = () => {
    console.log("Preloading assets");
    try {
      waterIcon      = p.loadImage(waterImg,   () => console.log("Loaded waterIcon"),    (e) => console.error("Error loading waterIcon", e));
      dirtIcon       = p.loadImage(dirtImg,    () => console.log("Loaded dirtIcon"),     (e) => console.error("Error loading dirtIcon", e));
      rockIcon       = p.loadImage(rockImg,    () => console.log("Loaded rockIcon"),     (e) => console.error("Error loading rockIcon", e));
      grassIcon      = p.loadImage(grassImg,   () => console.log("Loaded grassIcon"),    (e) => console.error("Error loading grassIcon", e));
      treeSeedIcon   = p.loadImage(acornImg,   () => console.log("Loaded treeSeedIcon"), (e) => console.error("Error loading treeSeedIcon", e));
      saplingIcon    = p.loadImage(saplingImg, () => console.log("Loaded saplingIcon"),  (e) => console.error("Error loading saplingIcon", e));
      treeIcon       = p.loadImage(treeImg,    () => console.log("Loaded treeIcon"),     (e) => console.error("Error loading treeIcon", e));
      deadTreeIcon   = p.loadImage(deadTreeImg,() => console.log("Loaded deadTreeIcon"), (e) => console.error("Error loading deadTreeIcon", e));
      flowerSeedIcon = p.loadImage(flowerSeedImg,() => console.log("Loaded flowerSeedIcon"), (e) => console.error("Error loading flowerSeedIcon", e));
      meadowIcon     = p.loadImage(meadowImg,  () => console.log("Loaded meadowIcon"),   (e) => console.error("Error loading meadowIcon", e));
      beeIcon        = p.loadImage(beeImg,     () => console.log("Loaded beeIcon"),      (e) => console.error("Error loading beeIcon", e));
      treeVineIcon   = p.loadImage(treeVineImg,() => console.log("Loaded treeVineIcon"), (e) => console.error("Error loading treeVineIcon", e));
      deadTreeVineIcon = p.loadImage(deadTreeVineImg,() => console.log("Loaded deadTreeVineIcon"), (e) => console.error("Error loading deadTreeVineIcon", e));
      meadowVineIcon = p.loadImage(meadowVineImg,() => console.log("Loaded meadowVineIcon"), (e) => console.error("Error loading meadowVineIcon", e));
      fireIcon       = p.loadImage(fireImg,    () => console.log("Loaded fireIcon"),     (e) => console.error("Error loading fireIcon", e));
    } catch (e) {
      console.error("Error during asset preload:", e);
    }
    console.log("DONE Preloading assets");
  };

  p.setup = () => {
    console.log("Setup called");
    pInstance = p;
    p.createCanvas(viewWidth, viewHeight); // UPDATED: Use fixed view dimensions instead of cols*cellSize
    generateRivers(p);
    const canvas = document.getElementById("myChart");
    const initialHeight = parseInt(document.getElementById("chartHeight")?.value) || 200;
    // Set both CSS style and element attribute for width and height
    canvas.style.width = document.documentElement.clientWidth + "px";
    canvas.width = document.documentElement.clientWidth;
    canvas.style.height = initialHeight + "px";
    canvas.height = initialHeight;
    const ctx = canvas.getContext("2d");
    myChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          { label: "Tree Seeds", backgroundColor: "saddlebrown", borderColor: "saddlebrown", data: [], fill: false },
          { label: "Saplings", backgroundColor: "green", borderColor: "green", data: [], fill: false },
          { label: "Mature Trees", backgroundColor: "darkgreen", borderColor: "darkgreen", data: [], fill: false },
          { label: "Flower Seeds", backgroundColor: "brown", borderColor: "brown", data: [], fill: false },
          { label: "Meadows", backgroundColor: "pink", borderColor: "pink", data: [], fill: false },
          { label: "Vines", backgroundColor: "purple", borderColor: "purple", data: [], fill: false }
        ]
      },
      options: {
        responsive: false
      }
    });
    // Update canvas dimensions when chart height input changes
    document.getElementById("chartHeight")?.addEventListener("change", (e) => {
      let newHeight = parseInt(e.target.value) || 200;
      canvas.style.height = newHeight + "px";
      canvas.height = newHeight;
      myChart.resize();
      myChart.update();
    });
    // Update canvas width on window resize
    window.addEventListener("resize", () => {
      let newWidth = document.documentElement.clientWidth;
      canvas.style.width = newWidth + "px";
      canvas.width = newWidth;
      myChart.update();
    });
    // NEW: Setup second canvas for average age chart
    const ageCanvas = document.getElementById("myAgeChart");
    ageCanvas.style.width = document.documentElement.clientWidth + "px";
    ageCanvas.width = document.documentElement.clientWidth;
    ageCanvas.style.height = "400px"; // forced height of 400px
    ageCanvas.height = 400;
    const ageCtx = ageCanvas.getContext("2d");
    averageAgeChart = new Chart(ageCtx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          { label: "Tree Seeds Age", backgroundColor: "saddlebrown", borderColor: "saddlebrown", data: [], fill: false },
          { label: "Saplings Age", backgroundColor: "green", borderColor: "green", data: [], fill: false },
          { label: "Mature Trees Age", backgroundColor: "darkgreen", borderColor: "darkgreen", data: [], fill: false },
          { label: "Flower Seeds Age", backgroundColor: "brown", borderColor: "brown", data: [], fill: false },
          { label: "Meadows Age", backgroundColor: "pink", borderColor: "pink", data: [], fill: false },
          { label: "Vines Age", backgroundColor: "purple", borderColor: "purple", data: [], fill: false }
        ]
      },
      options: { responsive: false }
    });
    document.getElementById("showGrid").addEventListener("change", (e) => {
      showGrid = e.target.checked;
    });
    // NEW: Listen for changes in the magnifier checkbox
    document.getElementById("enableZoom").addEventListener("change", (e) => {
      zoomEnabled = e.target.checked;
    });
    // NEW: Listen for zoom slider changes
    document.getElementById("zoomLevel").addEventListener("input", (e) => {
      zoomLevel = parseFloat(e.target.value) || 1;
    });
  };

  // NEW: Add mousePressed and mouseDragged for panning
  p.mousePressed = () => {
    dragStartX = p.mouseX;
    dragStartY = p.mouseY;
  };

  p.mouseDragged = () => {
    panX += p.mouseX - dragStartX;
    panY += p.mouseY - dragStartY;
    dragStartX = p.mouseX;
    dragStartY = p.mouseY;
  };

  // NEW: Add scrollwheel zoom handler
  p.mouseWheel = (event) => {
    const zoomStep = 0.1;
    if (event.deltaY < 0) { // scroll up to zoom in
      zoomLevel = Math.min(10, zoomLevel + zoomStep);
    } else { // scroll down to zoom out
      zoomLevel = Math.max(1, zoomLevel - zoomStep);
    }
    return false; // prevent default scrolling
  };

  p.draw = () => {
    console.log("Draw tick: simulationYears =", simulationYears);
    p.background(220);
  
    // Use push/pop to apply zoom and pan without affecting charts etc.
    p.push();
    p.translate(panX, panY);
    p.scale(zoomLevel);
    if (!paused) {
      timeAccumulator += p.deltaTime / 1000;
      let ticksThisFrame = 0;
      while (timeAccumulator >= tickInterval) {
        simulationTick(p);
        grid = nextState(grid, p);
        simulationYears++;
        ticksThisFrame++;
        timeAccumulator -= tickInterval;
      }
      
      if (ticksThisFrame > 0) {
        let counts = {
          treeSeed: 0,
          sapling: 0,
          matureTree: 0,
          flowerSeed: 0,
          meadow: 0,
          vine: 0
        };
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            let plant = plantLayer[i][j];
            if (plant) {
              if (plant.type === "tree") {
                if (plant.state === "seed") counts.treeSeed++;
                else if (plant.state === "sapling") counts.sapling++;
                else if (plant.state === "tree") counts.matureTree++;
              } else if (plant.type === "flower") {
                if (plant.state === "seed") counts.flowerSeed++;
                else if (plant.state === "meadow") counts.meadow++;
              }
            }
            if (vineLayer[i][j]) counts.vine++;
          }
        }
        myChart.data.labels.push(simulationYears);
        myChart.data.datasets[0].data.push(counts.treeSeed);
        myChart.data.datasets[1].data.push(counts.sapling);
        myChart.data.datasets[2].data.push(counts.matureTree);
        myChart.data.datasets[3].data.push(counts.flowerSeed);
        myChart.data.datasets[4].data.push(counts.meadow);
        myChart.data.datasets[5].data.push(counts.vine);
        myChart.update();
        
        // NEW: Compute average age per category
        let sum = { treeSeed: 0, sapling: 0, matureTree: 0, flowerSeed: 0, meadow: 0, vine: 0 };
        let count = { treeSeed: 0, sapling: 0, matureTree: 0, flowerSeed: 0, meadow: 0, vine: 0 };
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            let plant = plantLayer[i][j];
            if (plant) {
              if (plant.type === "tree") {
                if (plant.state === "seed") { sum.treeSeed += plant.age; count.treeSeed++; }
                else if (plant.state === "sapling") { sum.sapling += plant.age; count.sapling++; }
                else if (plant.state === "tree") { sum.matureTree += plant.age; count.matureTree++; }
              } else if (plant.type === "flower") {
                if (plant.state === "seed") { sum.flowerSeed += plant.age; count.flowerSeed++; }
                else if (plant.state === "meadow") { sum.meadow += plant.age; count.meadow++; }
              }
            }
            if (vineLayer[i][j]) {
              // For vines, assume a similar measure
              sum.vine += vineLayer[i][j].age;
              count.vine++;
            }
          }
        }
        const avg = {
          treeSeed: count.treeSeed ? (sum.treeSeed/count.treeSeed) : 0,
          sapling: count.sapling ? (sum.sapling/count.sapling) : 0,
          matureTree: count.matureTree ? (sum.matureTree/count.matureTree) : 0,
          flowerSeed: count.flowerSeed ? (sum.flowerSeed/count.flowerSeed) : 0,
          meadow: count.meadow ? (sum.meadow/count.meadow) : 0,
          vine: count.vine ? (sum.vine/count.vine) : 0,
        };
        averageAgeChart.data.labels.push(simulationYears);
        averageAgeChart.data.datasets[0].data.push(avg.treeSeed);
        averageAgeChart.data.datasets[1].data.push(avg.sapling);
        averageAgeChart.data.datasets[2].data.push(avg.matureTree);
        averageAgeChart.data.datasets[3].data.push(avg.flowerSeed);
        averageAgeChart.data.datasets[4].data.push(avg.meadow);
        averageAgeChart.data.datasets[5].data.push(avg.vine);
        averageAgeChart.update();
      }
    } else {
      timeAccumulator = 0;
    }
  
    // UPDATED: Render terrain grid using terrain icons
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        let x = i * cellSize;
        let y = j * cellSize;
        if (grid[i][j] === WATER) {
          p.image(waterIcon, x, y, cellSize, cellSize);
        } else if (grid[i][j] === DIRT) {
          p.image(dirtIcon, x, y, cellSize, cellSize);
        } else if (grid[i][j] === ROCK) {
          p.image(rockIcon, x, y, cellSize, cellSize);
        } else if (grid[i][j] === GRASS) {
          p.image(grassIcon, x, y, cellSize, cellSize);  // using grass icon
        }
        if (showGrid) {
          p.stroke("black");
          p.noFill();
          p.rect(x, y, cellSize, cellSize);
        }
      }
    }
    
    // Render plant and vine overlays
    renderOverlays(p);
    
    // NEW: Draw magnifier if enabled
    if (zoomEnabled) {
      const zoomFactor = 5;
      const srcSize = 80; // UPDATED: increased from 40 to 80 for a 4x larger magnifier area
      const sx = p.mouseX - srcSize / 2;
      const sy = p.mouseY - srcSize / 2;
      // get a region under the mouse
      let zoomRegion = p.get(sx, sy, srcSize, srcSize);
      // draw the magnified region near the cursor
      p.push();
      p.noStroke();
      // Optionally draw an ellipse border showing the magnifier area
      p.ellipse(p.mouseX + 10 + (srcSize * zoomFactor) / 2, p.mouseY + 10 + (srcSize * zoomFactor) / 2, srcSize * zoomFactor + 4);
      p.image(zoomRegion, p.mouseX + 10, p.mouseY + 10, srcSize * zoomFactor, srcSize * zoomFactor);
      p.pop();
    }
    p.pop(); // end transformed context

    // NEW: Draw tooltip outside of simulation transform so it always follows the raw mouse cursor.
    p.push();
    p.resetMatrix(); // ensure no transform is active
    let simMouseX = (p.mouseX - panX) / zoomLevel;
    let simMouseY = (p.mouseY - panY) / zoomLevel;
    let hoverI = Math.floor(simMouseX / cellSize);
    let hoverJ = Math.floor(simMouseY / cellSize);
    if (hoverI >= 0 && hoverI < cols && hoverJ >= 0 && hoverJ < rows) {
      let info = "Terrain: " + grid[hoverI][hoverJ] + "\n";
      let plant = plantLayer[hoverI][hoverJ];
      if (plant) {
        info += "Plant: " + plant.type + " (" + plant.state + ")\n";
        info += "Age: " + plant.age + "\n";
        if (plant.type === "tree") {
          if (plant.vineExposure) info += "Vine Exposure: " + plant.vineExposure + "\n";
          if (plant.deadAge) info += "Dead Age: " + plant.deadAge + "\n";
        }
        if (plant.onFire) info += "On Fire: " + plant.fireAge + "\n";
        if (plant.bees) info += "Bees CD: " + plant.bees + "\n";
      }
      let tooltipWidth = 0;
      let lines = info.split("\n");
      for (let line of lines) {
        let w = p.textWidth(line);
        if (w > tooltipWidth) tooltipWidth = w;
      }
      let lineHeight = 12;
      let tooltipHeight = lines.length * lineHeight;
      let tooltipX = p.mouseX + 10;
      let tooltipY = p.mouseY + 10;
      p.fill(255, 240);
      p.stroke(0);
      p.rect(tooltipX, tooltipY, tooltipWidth + 10, tooltipHeight + 10, 5);
      p.fill(0);
      p.noStroke();
      p.textAlign(p.LEFT, p.TOP);
      p.text(info, tooltipX + 5, tooltipY + 5);
    }
    p.pop();
  };
  
  // Calculate the next state with new rules
  function nextState(oldGrid, p) {
    let newGrid = [];
    for (let i = 0; i < cols; i++) {
      newGrid[i] = oldGrid[i].slice();
    }
    // Water converts rock to dirt in a radius 3
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (oldGrid[i][j] === WATER) {
          for (let dx = -3; dx <= 3; dx++) {
            // FIX: use dy in the inner loop condition instead of dx
            for (let dy = -1; dy <= 1; dy++) {
              const x = i + dx, y = j + dy;
              if (x >= 0 && y >= 0 && x < cols && y < rows) {
                if (oldGrid[x][y] === ROCK) {
                  newGrid[x][y] = DIRT;
                }
              }
            }
          }
        }
      }
    }
    // Grass spreads to adjacent dirt cells
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (oldGrid[i][j] === DIRT) {
          let hasGrass = false;
          let hasWater = false;
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              if (dx === 0 && dy === 0) continue;
              const x = i + dx, y = j + dy;
              if (x >= 0 && y >= 0 && x < cols && y < rows) {
                if (oldGrid[x][y] === GRASS) hasGrass = true;
                if (oldGrid[x][y] === WATER) hasWater = true;
              }
            }
          }
          if (hasGrass) {
            let chance = hasWater ? 0.2 : 0.05;
            if (p.random(1) < chance) {
              newGrid[i][j] = GRASS;
            }
          }
        }
      }
    }

    // NEW: Check each rock cell for adjacent trees and update breakdown counter
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (oldGrid[i][j] === ROCK) {
          let treeCount = 0;
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              if (dx === 0 && dy === 0) continue;
              let x = i + dx, y = j + dy;
              if (x >= 0 && y >= 0 && x < cols && y < rows) {
                let adjPlant = plantLayer[x][y];
                if (adjPlant && adjPlant.type === "tree" && adjPlant.state === "tree") {
                  treeCount++;
                }
              }
            }
          }
          if (treeCount >= 3) {
            rockTreeCounter[i][j] = (rockTreeCounter[i][j] || 0) + 1;
          } else {
            rockTreeCounter[i][j] = 0;
          }
          if (rockTreeCounter[i][j] >= 25) {
            newGrid[i][j] = DIRT;
            rockTreeCounter[i][j] = 0;
          }
        }
      }
    }
    // NEW: Dirt-to-rock conversion. For each interior dirt cell,
    // if the four cardinal neighbors (up, down, left, right) exist on grid and are all DIRT,
    // then with a 1/10 chance, convert the cell to ROCK.
    for (let i = 1; i < cols - 1; i++) {
      for (let j = 1; j < rows - 1; j++) {
        if (oldGrid[i][j] === DIRT &&
            oldGrid[i-1][j] === DIRT &&
            oldGrid[i+1][j] === DIRT &&
            oldGrid[i][j-1] === DIRT &&
            oldGrid[i][j+1] === DIRT) {
          if (p.random(1) < 0.1) {
            newGrid[i][j] = ROCK;
          }
        }
      }
    }
    
    // NEW: River meandering logic.
    // Each row with a contiguous water segment (created in generateRivers)
    // of width exactly 3 will have a small chance to shift one column left or right.
    // Shifting adds water to one edge and removes water at the opposite edge.
    const meanderProb = 0.005;
    for (let j = 1; j < rows - 1; j++) {
      // Search for a contiguous segment of exactly 3 water cells.
      for (let i = 1; i < cols - 3; i++) {
        if (newGrid[i][j] === WATER &&
            newGrid[i+1][j] === WATER &&
            newGrid[i+2][j] === WATER &&
            (i === 1 || newGrid[i-1][j] !== WATER) && 
            (i+3 >= cols || newGrid[i+3][j] !== WATER)) {
          if (p.random(1) < meanderProb) {
            // Randomly decide shift direction.
            if (p.random(1) < 0.5 && i > 1 && newGrid[i-1][j] !== WATER) { // shift left
              newGrid[i-1][j] = WATER; // expand left
              newGrid[i+2][j] = DIRT;  // contract right
            } else if (i+3 < cols && newGrid[i+3][j] !== WATER) { // shift right
              newGrid[i+3][j] = WATER; // expand right
              newGrid[i][j] = DIRT;    // contract left
            }
          }
          // Only process one segment per row.
          break;
        }
      }
    }
    return newGrid;
  }

  // simulationTick: processes plant, vine, and now fire dynamics
  function simulationTick(p) {
    // Spawn seeds on grass cells without a plant
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (grid[i][j] === GRASS && !plantLayer[i][j]) {
          if (p.random(1) < 1 / 200) {
            if (p.random(1) < 0.5) {
              plantLayer[i][j] = { type: "tree", state: "seed", age: 0 };
            } else {
              plantLayer[i][j] = { type: "flower", state: "seed", age: 0 };
            }
          }
        }
      }
    }
    // Process growth and spread for plants and vines
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        let plant = plantLayer[i][j];
        if (plant) {
          plant.age++;
          if (plant.type === "tree") {
            if (plant.state === "seed" && plant.age >= 3) {
              plant.state = "sapling";
            } else if (plant.state === "sapling" && plant.age >= 10) {
              plant.state = "tree";
              let ni = i + Math.floor(p.random(-3, 4));
              let nj = j + Math.floor(p.random(-3, 4));
              if (ni >= 0 && nj >= 0 && ni < cols && nj < rows && grid[ni][nj] === GRASS && !plantLayer[ni][nj]) {
                let distance = Math.max(Math.abs(ni - i), Math.abs(nj - j));
                let chance = grid[ni][nj] === DIRT ? 0.25 : (grid[ni][nj] === ROCK ? 1 / (5 * distance) : 0);
                if (p.random(1) < chance) {
                  plantLayer[ni][nj] = { type: "tree", state: "seed", age: 0 };
                }
              }
            }
          } else if (plant.type === "flower") {
            if (plant.state === "seed" && plant.age >= 1) {
              plant.state = "meadow";
              plant.bees = 3;
              for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                  if (dx === 0 && dy === 0) continue;
                  let ni = i + dx, nj = j + dy;
                  if (ni >= 0 && nj >= 0 && ni < cols && nj < rows && grid[ni][nj] === GRASS && !plantLayer[ni][nj]) {
                    let matureCount = 0;
                    for (let ax = -1; ax <= 1; ax++) {
                      for (let ay = -1; ay <= 1; ay++) {
                        let tx = ni + ax, ty = nj + ay;
                        if (tx >= 0 && ty >= 0 && tx < cols && ty < rows) {
                          let adj = plantLayer[tx][ty];
                          if (adj && adj.type === "tree" && adj.state === "tree") {
                            matureCount++;
                          }
                        }
                      }
                    }
                    let modChance = 0.3 / Math.pow(2, matureCount);
                    if (p.random(1) < modChance) {
                      plantLayer[ni][nj] = { type: "flower", state: "seed", age: 0 };
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    
    // Age bees on meadows
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        let plant = plantLayer[i][j];
        if (plant && plant.type === "flower" && plant.state === "meadow" && plant.bees) {
          plant.bees--;
          if (plant.bees <= 0) { delete plant.bees; }
        }
      }
    }
    
    // Active reclamation: Meadows near 2+ mature trees revert to tree seed.
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        let plant = plantLayer[i][j];
        if (plant && plant.type === "flower" && plant.state === "meadow" && !plant.bees) {
          let matureCount = 0;
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              if (dx === 0 && dy === 0) continue;
              let ni = i + dx, nj = j + dy;
              if (ni >= 0 && nj >= 0 && ni < cols && nj < rows) {
                let adj = plantLayer[ni][nj];
                if (adj && adj.type === "tree" && adj.state === "tree") {
                  matureCount++;
                }
              }
            }
          }
          if (matureCount >= 2) {
            if (p.random(1) < 0.3) {
              plantLayer[i][j] = { type: "tree", state: "seed", age: 0 };
            }
          }
        }
      }
    }
    
    // Meadows take over saplings mechanic
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        let plant = plantLayer[i][j];
        if (plant && plant.type === "tree" && plant.state === "sapling") {
          let meadowCount = 0;
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              if (dx === 0 && dy === 0) continue;
              let ni = i + dx, nj = j + dy;
              if (ni >= 0 && nj >= 0 && ni < cols && nj < rows) {
                let adj = plantLayer[ni][nj];
                if (adj && adj.type === "flower" && adj.state === "meadow") {
                  meadowCount++;
                }
              }
            }
          }
          if (meadowCount >= 1) {
            if (p.random(1) < 0.3) {
              plantLayer[i][j] = { type: "flower", state: "seed", age: 0 };
            }
          }
        }
      }
    }
    
    // Tree death mechanic due to sustained vine infestation
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        let plant = plantLayer[i][j];
        if (plant && plant.type === "tree") {
          if (plant.state === "tree") {
            if (vineLayer[i][j]) {
              plant.vineExposure = (plant.vineExposure || 0) + 1;
              if (plant.vineExposure >= 10) {
                plant.state = "dead";
                plant.deadAge = 0;
              }
            } else {
              plant.vineExposure = 0;
            }
          } else if (plant.state === "dead") {
            plant.deadAge = (plant.deadAge || 0) + 1;
            // Updated dead time: 6 years before decaying to meadow
            if (plant.deadAge >= 6) {
              plantLayer[i][j] = { type: "flower", state: "meadow", age: 0 };
            }
          }
        }
      }
    }
    
    // Existing vine processing and additional plant aging logic…
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        let plant = plantLayer[i][j];
        if (plant) {
          plant.age++;
          if (plant.type === "tree") {
            if (plant.state === "seed" && plant.age >= 3) {
              plant.state = "sapling";
            } else if (plant.state === "sapling" && plant.age >= 10) {
              plant.state = "tree";
              let ni = i + Math.floor(p.random(-3, 4));
              let nj = j + Math.floor(p.random(-3, 4));
              if (ni >= 0 && nj >= 0 && ni < cols && nj < rows && grid[ni][nj] === GRASS && !plantLayer[ni][nj]) {
                let distance = Math.max(Math.abs(ni - i), Math.abs(nj - j));
                let chance = grid[ni][nj] === DIRT ? 0.25 : (grid[ni][nj] === ROCK ? 1 / (5 * distance) : 0);
                if (p.random(1) < chance) {
                  plantLayer[ni][nj] = { type: "tree", state: "seed", age: 0 };
                }
              }
            }
          } else if (plant.type === "flower") {
            if (plant.state === "seed" && plant.age >= 1) {
              plant.state = "meadow";
              for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                  if (dx === 0 && dy === 0) continue;
                  let ni = i + dx, nj = j + dy;
                  if (ni >= 0 && nj >= 0 && ni < cols && nj < rows && grid[ni][nj] === GRASS && !plantLayer[ni][nj]) {
                    if (p.random(1) < 0.3) {
                      plantLayer[ni][nj] = { type: "flower", state: "seed", age: 0 };
                    }
                  }
                }
              }
            }
          }
        }
        if (grid[i][j] === GRASS && plantLayer[i][j] && plantLayer[i][j].type === "tree") {
          if (plantLayer[i][j].state === "tree" && !vineLayer[i][j]) {
            if (p.random(1) < 0.01) {
              vineLayer[i][j] = { age: 0 };
            }
          }
          if (vineLayer[i][j] && plantLayer[i][j].state === "tree") {
            if (p.random(1) < 0.05) {
              vineLayer[i][j] = null;
            }
          }
        }
        if (vineLayer[i][j]) {
          vineLayer[i][j].age++;
          if (vineLayer[i][j].age >= 2) {
            let directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            let d = directions[Math.floor(p.random(directions.length))];
            let ni = i + d[0], nj = j + d[1];
            if (ni >= 0 && nj >= 0 && ni < cols && nj < rows &&
                plantLayer[ni][nj] && plantLayer[ni][nj].type === "tree" &&
                plantLayer[ni][nj].state === "tree" && !vineLayer[ni][nj]) {
              if (p.random(1) < 0.1) {
                vineLayer[ni][nj] = { age: 0 };
              }
            }
          }
        }
        if (plantLayer[i][j] && plantLayer[i][j].type === "flower" &&
            plantLayer[i][j].state === "meadow" && vineLayer[i][j]) {
          if (p.random(1) < 0.0667) {
            vineLayer[i][j] = null;
          }
        }
      }
    }
    
    // === NEW: Fire propagation and burn mechanics ===
    // First, process fire ignition for plants
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        let plant = plantLayer[i][j];
        if (plant) {
          let hasNeighborOnFire = false;
          // Check all 8 neighbors for a fire event
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              if (dx === 0 && dy === 0) continue;
              let ni = i + dx, nj = j + dy;
              if (ni >= 0 && nj >= 0 && ni < cols && nj < rows) {
                if (plantLayer[ni][nj] && plantLayer[ni][nj].onFire) {
                  hasNeighborOnFire = true;
                }
              }
            }
          }
          if (plant.type === "tree") {
            if (plant.state === "dead") {
              // Dead trees catch fire automatically if adjacent to fire
              if (hasNeighborOnFire) {
                plant.onFire = true;
                plant.fireAge = 0;
              } else if (!plant.onFire && p.random(1) < 0.01) {
                // Spontaneous ignition: 1/100 chance
                plant.onFire = true;
                plant.fireAge = 0;
              }
            } else if (plant.state === "tree") {
              // Live trees: 1/3 chance if adjacent to fire
              if (hasNeighborOnFire && !plant.onFire && p.random(1) < 0.33) {
                plant.onFire = true;
                plant.fireAge = 0;
              }
            }
          } else if (plant.type === "flower" && plant.state === "meadow") {
            // Meadows: 1/10 chance if adjacent to fire
            if (hasNeighborOnFire && !plant.onFire && p.random(1) < 0.1) {
              plant.onFire = true;
              plant.fireAge = 0;
            }
          }
        }
      }
    }
    // Now, process fire ignition for vines
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        let vine = vineLayer[i][j];
        if (vine) {
          let hasNeighborOnFire = false;
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              if (dx === 0 && dy === 0) continue;
              let ni = i + dx, nj = j + dy;
              if (ni >= 0 && nj >= 0 && ni < cols && nj < rows) {
                if ((plantLayer[ni][nj] && plantLayer[ni][nj].onFire) ||
                    (vineLayer[ni][nj] && vineLayer[ni][nj].onFire)) {
                  hasNeighborOnFire = true;
                }
              }
            }
          }
          if (hasNeighborOnFire && !vine.onFire && p.random(1) < 0.1667) { // 1/6 chance
            vine.onFire = true;
            vine.fireAge = 0;
          }
        }
      }
    }
    // Finally, process burning: after 1 year on fire, vegetation burns down to dirt
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        let plant = plantLayer[i][j];
        if (plant && plant.onFire) {
          plant.fireAge = (plant.fireAge || 0) + 1;
          if (plant.fireAge >= 2) { // increased threshold from 1 to 2
            grid[i][j] = DIRT;
            plantLayer[i][j] = null;
          }
        }
        let vine = vineLayer[i][j];
        if (vine && vine.onFire) {
          vine.fireAge = (vine.fireAge || 0) + 1;
          if (vine.fireAge >= 2) { // increased threshold from 1 to 2
            vineLayer[i][j] = null;
          }
        }
      }
    }
    // === End of fire mechanics ===
  }

  // Render overlays for plants and vines atop the terrain
  const renderOverlays = (p) => {
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        let x = i * cellSize;
        let y = j * cellSize;
        let plant = plantLayer[i][j];
        if (plant) {
          if (plant.onFire) {
            p.image(fireIcon, x, y, cellSize, cellSize);
          } else if (plant.type === "tree") {
            if (plant.state === "seed") {
              p.image(treeSeedIcon, x, y, cellSize, cellSize);
            } else if (plant.state === "sapling") {
              p.image(saplingIcon, x, y, cellSize, cellSize);
            } else if (plant.state === "tree") {
              p.image(treeIcon, x, y, cellSize, cellSize);
            } else if (plant.state === "dead") {
              p.image(deadTreeIcon, x, y, cellSize, cellSize);
            }
          } else if (plant.type === "flower") {
            if (plant.state === "seed") {
              p.image(flowerSeedIcon, x, y, cellSize, cellSize);
            } else if (plant.state === "meadow") {
              p.image(meadowIcon, x, y, cellSize, cellSize);
            }
          }
          // NEW: If plant has bees, render bee icon at top-right corner
          if (plant.bees) {
            p.image(beeIcon, x + cellSize * 0.6, y, cellSize * 0.4, cellSize * 0.4);
          }
        }
        // NEW: Render vine overlay using new vine icons based on underlying plant
        if (vineLayer[i][j]) {
          if (vineLayer[i][j].onFire) {
            p.image(fireIcon, x, y, cellSize, cellSize);
          } else if (plant) {
            if (plant.type === "tree") {
              if (plant.state === "dead") {
                p.image(deadTreeVineIcon, x, y, cellSize, cellSize);
              } else {
                p.image(treeVineIcon, x, y, cellSize, cellSize);
              }
            } else if (plant.type === "flower" && plant.state === "meadow") {
              p.image(meadowVineIcon, x, y, cellSize, cellSize);
            } else {
              // Fallback if there is no matching plant type.
              p.image(treeVineIcon, x, y, cellSize, cellSize);
            }
          } else {
            // If no plant exists, default to tree vine icon.
            p.image(treeVineIcon, x, y, cellSize, cellSize);
          }
        }
      }
    }
  };

  // Listen for changes in tick rate input and update tickInterval accordingly:
  document.getElementById("tickInput")?.addEventListener("change", (e) => {
    tickRate = parseFloat(e.target.value) || 1;
    tickInterval = 1 / tickRate;
  });
};

// Instantiate the p5 sketch, attaching it to the container element
new p5(sketch, document.getElementById("simulation-container"));

// Existing control functions
window.pauseSimulation = () => { paused = true; };
window.resumeSimulation = () => { paused = false; };
window.restartSimulation = () => {
  paused = false;
  simulationYears = 0;
  timeAccumulator = 0;
  generateRivers(pInstance);
  populationHistory = [];
  myChart.data.labels = [];
  myChart.data.datasets.forEach(ds => ds.data = []);
  myChart.update();
};
