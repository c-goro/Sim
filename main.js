import * as p5 from "p5";
import * as Chart from "chart.js/auto";

// Remove module imports for images and use string paths instead:
const acornImg          = "./icons/acorn.png";
const waterImg          = "./icons/water.png";
const dirtImg           = "./icons/dirt.png";
const rockImg           = "./icons/rock.png";
const grassImg          = "./icons/grass.png";
const saplingImg        = "./icons/sapling.png";
const treeImg           = "./icons/tree.png";
const deadTreeImg       = "./icons/dead-tree.png";
const flowerSeedImg     = "./icons/flower-seed.png";
const meadowImg         = "./icons/meadow.png";
const beeImg            = "./icons/bee.png";
const treeVineImg       = "./icons/tree-vine.png";
const deadTreeVineImg   = "./icons/dead-tree-vine.png";
const meadowVineImg     = "./icons/meadow-vine.png";
const fireImg           = "./icons/fire.png";

// Define cell types
const WATER = "water";
const DIRT  = "dirt";
const ROCK  = "rock";
const GRASS = "grass";

// Global simulation control
let paused = false;

// [WEEKLY CHANGE] Each tick is 1 "week" of game-time => add 1/52 to simulationYears each tick
let tickRate = 1;       
let tickInterval = 1 / tickRate;
let lastTickTime = 0;
let timeAccumulator = 0;
let simulationYears = 0;   // measured in years, each tick adds 1/52

// Grid configuration
const cols = 70;
const rows = 30;
const cellSize = 15;
let grid = [];

// For Chart.js
let populationHistory = [];
let myChart, averageAgeChart;

// We store plants and vines in parallel arrays
let plantLayer = [];
let vineLayer  = [];

// Used to track how long a rock has had >=3 adjacent trees
let rockTreeCounter = [];

const WEEK_FACTOR = 1 / 52; // 1 "week" = 1/52 year

// Generate map with rivers and mountains
function generateRivers(p) {
  grid = [];
  rockTreeCounter = [];
  for (let i = 0; i < cols; i++) {
    grid[i] = [];
    plantLayer[i] = [];
    vineLayer[i]  = [];
    rockTreeCounter[i] = [];
    for (let j = 0; j < rows; j++) {
      let r = p.random(1);
      if (r < 0.1)      grid[i][j] = ROCK;
      else if (r < 0.55) grid[i][j] = DIRT;
      else              grid[i][j] = GRASS;
      plantLayer[i][j] = null;
      vineLayer[i][j]  = null;
      rockTreeCounter[i][j] = (grid[i][j] === ROCK) ? 0 : null;
    }
  }

  // Make meandering rivers
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

  // Generate mountains
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

// Key listener for spacebar toggling
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    togglePause();
  }
});

let pInstance;
let showGrid = true;
let zoomEnabled = false;
let zoomLevel = 1;
let panX = 0, panY = 0;
let dragStartX = 0, dragStartY = 0;

// p5.js sketch
const sketch = (p) => {
  // preload images
  let waterIcon, dirtIcon, rockIcon, grassIcon;
  let beeIcon;
  let treeSeedIcon, saplingIcon, treeIcon, deadTreeIcon, flowerSeedIcon, meadowIcon;
  let treeVineIcon, deadTreeVineIcon, meadowVineIcon, fireIcon;

  p.preload = () => {
    waterIcon      = p.loadImage(waterImg);
    dirtIcon       = p.loadImage(dirtImg);
    rockIcon       = p.loadImage(rockImg);
    grassIcon      = p.loadImage(grassImg);
    treeSeedIcon   = p.loadImage(acornImg);
    saplingIcon    = p.loadImage(saplingImg);
treeIcon       = p.loadImage(treeImg);
    deadTreeIcon   = p.loadImage(deadTreeImg);
    flowerSeedIcon = p.loadImage(flowerSeedImg);
    meadowIcon     = p.loadImage(meadowImg);
    beeIcon        = p.loadImage(beeImg);
    treeVineIcon   = p.loadImage(treeVineImg);
    deadTreeVineIcon = p.loadImage(deadTreeVineImg);
    meadowVineIcon = p.loadImage(meadowVineImg);
    fireIcon       = p.loadImage(fireImg);
  };

  p.setup = () => {
    pInstance = p;
    p.createCanvas(document.documentElement.clientWidth, 1000);
    generateRivers(p);

    // Create population chart
    const canvas = document.getElementById("myChart");
    const initialHeight = parseInt(document.getElementById("chartHeight")?.value) || 200;
    canvas.style.width  = document.documentElement.clientWidth + "px";
    canvas.width        = document.documentElement.clientWidth;
    canvas.style.height = initialHeight + "px";
    canvas.height       = initialHeight;
    const ctx = canvas.getContext("2d");
    myChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          { label: "Tree Seeds",    backgroundColor: "saddlebrown", borderColor: "saddlebrown", data: [], fill: false },
          { label: "Saplings",     backgroundColor: "green",       borderColor: "green",       data: [], fill: false },
          { label: "Mature Trees", backgroundColor: "darkgreen",   borderColor: "darkgreen",   data: [], fill: false },
          { label: "Flower Seeds", backgroundColor: "brown",       borderColor: "brown",       data: [], fill: false },
          { label: "Meadows",      backgroundColor: "pink",        borderColor: "pink",        data: [], fill: false },
          { label: "Vines",        backgroundColor: "purple",      borderColor: "purple",      data: [], fill: false },
        ]
      },
      options: { responsive: false }
    });

    document.getElementById("chartHeight")?.addEventListener("change", (e) => {
      let newHeight = parseInt(e.target.value) || 200;
      canvas.style.height = newHeight + "px";
      canvas.height       = newHeight;
      myChart.resize();
      myChart.update();
    });
    window.addEventListener("resize", () => {
      let newWidth = document.documentElement.clientWidth;
      canvas.style.width = newWidth + "px";
      canvas.width       = newWidth;
      myChart.update();
    });

    // Create average age chart
    const ageCanvas = document.getElementById("myAgeChart");
    ageCanvas.style.width  = document.documentElement.clientWidth + "px";
    ageCanvas.width        = document.documentElement.clientWidth;
    ageCanvas.style.height = "400px";
    ageCanvas.height       = 400;
    const ageCtx = ageCanvas.getContext("2d");
    averageAgeChart = new Chart(ageCtx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          { label: "Tree Seeds Age",    backgroundColor: "saddlebrown", borderColor: "saddlebrown", data: [], fill: false },
          { label: "Saplings Age",     backgroundColor: "green",       borderColor: "green",       data: [], fill: false },
          { label: "Mature Trees Age", backgroundColor: "darkgreen",   borderColor: "darkgreen",   data: [], fill: false },
          { label: "Flower Seeds Age", backgroundColor: "brown",       borderColor: "brown",       data: [], fill: false },
          { label: "Meadows Age",      backgroundColor: "pink",        borderColor: "pink",        data: [], fill: false },
          { label: "Vines Age",        backgroundColor: "purple",      borderColor: "purple",      data: [], fill: false },
        ]
      },
      options: { responsive: false }
    });

    // UI checkboxes
    document.getElementById("showGrid")?.addEventListener("change", (e) => {
      showGrid = e.target.checked;
    });
    document.getElementById("enableZoom")?.addEventListener("change", (e) => {
      zoomEnabled = e.target.checked;
    });
    document.getElementById("zoomLevel")?.addEventListener("input", (e) => {
      zoomLevel = parseFloat(e.target.value) || 1;
    });
  };

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

  p.mouseWheel = (event) => {
    const zoomStep = 0.1;
    if (event.deltaY < 0) {
      zoomLevel = Math.min(10, zoomLevel + zoomStep);
    } else {
      zoomLevel = Math.max(1, zoomLevel - zoomStep);
    }
    return false;
  };

  p.draw = () => {
    p.background(220);
    p.push();
    p.translate(panX, panY);
    p.scale(zoomLevel);

    if (!paused) {
      timeAccumulator += p.deltaTime / 1000; // in seconds
      let ticksThisFrame = 0;
      while (timeAccumulator >= tickInterval) {
        stepSimulation(p);  // <<-- Single unified step
        simulationYears += WEEK_FACTOR;
        ticksThisFrame++;
        timeAccumulator -= tickInterval;
      }
      if (ticksThisFrame > 0) {
        updateCharts();
      }
    } else {
      timeAccumulator = 0;
    }

    // Render terrain
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        let x = i * cellSize, y = j * cellSize;
        switch (grid[i][j]) {
          case WATER: p.image(waterIcon, x, y, cellSize, cellSize); break;
          case DIRT:  p.image(dirtIcon,  x, y, cellSize, cellSize); break;
          case ROCK:  p.image(rockIcon,  x, y, cellSize, cellSize); break;
          case GRASS: p.image(grassIcon, x, y, cellSize, cellSize); break;
        }
        if (showGrid) {
          p.stroke("black");
          p.noFill();
          p.rect(x, y, cellSize, cellSize);
        }
      }
    }
    renderOverlays(p);

    // Magnifier
    if (zoomEnabled) {
      const zoomFactor = 5;
      const srcSize    = 80;
      const sx = p.mouseX - srcSize / 2;
      const sy = p.mouseY - srcSize / 2;
      let zoomRegion = p.get(sx, sy, srcSize, srcSize);
      p.push();
      p.noStroke();
      p.ellipse(p.mouseX + 10 + (srcSize*zoomFactor)/2,
                p.mouseY + 10 + (srcSize*zoomFactor)/2,
                srcSize*zoomFactor + 4);
      p.image(zoomRegion, p.mouseX + 10, p.mouseY + 10,
              srcSize*zoomFactor, srcSize*zoomFactor);
      p.pop();
    }
    p.pop();

    // Tooltip
    drawTooltip(p);
  };

  // Single unified simulation step
  function stepSimulation(p) {
    // 1) Water->Rock->Dirt using BFS within radius 3
    convertRockNearWater();

    // 2) Convert some DIRT => GRASS
    // 3) Count adjacency for rock->dirt via trees
    // 4) Dirt->rock random
    // 5) River meander
    // 6) Plant sprouting on GRASS
    // 7) Growth logic (trees, flowers, meadows)
    // 8) Fire mechanics
    // 9) Vines, including spread and removal
    // etc.

    // Because we’re merging your old “nextState” and “simulationTick,”
    // we need to read from the grid states *as is*, then do in-place or minimal updates.
    // For certain steps (like meandering water, or converting dirt->rock) we can safely
    // do in-place checks or gather changes in arrays and then commit them.

    // ––––––––––––––––––––––––––––––––––––––––––––––––––––––
    //        2) & 3) & 4) & 5) => all terrain changes
    // ––––––––––––––––––––––––––––––––––––––––––––––––––––––

    // We'll hold on to some “pending changes” for terrain:
    let newGrid = [];
    for (let i = 0; i < cols; i++) {
      newGrid[i] = grid[i].slice();
    }

    // Grass spreads to adjacent dirt
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (grid[i][j] === DIRT) {
          let hasGrass = false, hasWater = false;
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              let x = i + dx, y = j + dy;
              if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
              if (grid[x][y] === GRASS) hasGrass = true;
              if (grid[x][y] === WATER) hasWater = true;
            }
          }
          if (hasGrass) {
            let chance = hasWater ? (0.2 * WEEK_FACTOR) : (0.05 * WEEK_FACTOR);
            if (p.random(1) < chance) {
              newGrid[i][j] = GRASS;
            }
          }
        }
      }
    }

    // Check each rock cell for adjacency to 3+ mature trees
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (grid[i][j] === ROCK) {
          let treeCount = 0;
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              if (dx === 0 && dy === 0) continue;
              let x = i + dx, y = j + dy;
              if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
              let adjPlant = plantLayer[x][y];
              if (adjPlant && adjPlant.type === "tree" && adjPlant.state === "tree") {
                treeCount++;
              }
            }
          }
          if (treeCount >= 3) {
            rockTreeCounter[i][j] += WEEK_FACTOR;
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

    // Dirt->rock
    for (let i = 1; i < cols - 1; i++) {
      for (let j = 1; j < rows - 1; j++) {
        if (grid[i][j] === DIRT &&
            grid[i-1][j] === DIRT &&
            grid[i+1][j] === DIRT &&
            grid[i][j-1] === DIRT &&
            grid[i][j+1] === DIRT)
        {
          if (p.random(1) < (0.1 * WEEK_FACTOR)) {
            newGrid[i][j] = ROCK;
          }
        }
      }
    }

    // River meandering
    const meanderProb = 0.005 * WEEK_FACTOR;
    for (let j = 1; j < rows - 1; j++) {
      for (let i = 1; i < cols - 3; i++) {
        if (grid[i][j] === WATER &&
            grid[i+1][j] === WATER &&
            grid[i+2][j] === WATER &&
            (i === 1 || grid[i-1][j] !== WATER) &&
            (i+3 >= cols || grid[i+3][j] !== WATER))
        {
          if (p.random(1) < meanderProb) {
            if (p.random(1) < 0.5 && i > 1 && grid[i-1][j] !== WATER) {
              newGrid[i-1][j]    = WATER;
              newGrid[i+2][j]    = DIRT;
            } else if (i+3 < cols && grid[i+3][j] !== WATER) {
              newGrid[i+3][j]    = WATER;
              newGrid[i][j]      = DIRT;
            }
          }
          break;
        }
      }
    }

    // Commit the newGrid changes
    grid = newGrid;

    // ––––––––––––––––––––––––––––––––––––––––––––––––––––––
    //         Now handle PLANTS and VINES in 1 pass
    // ––––––––––––––––––––––––––––––––––––––––––––––––––––––

    // 1) Possibly spawn new seeds in GRASS
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (grid[i][j] === GRASS && !plantLayer[i][j]) {
          // was 1/200 => now (1/200)*WEEK_FACTOR
          if (p.random(1) < (1/200) * WEEK_FACTOR) {
            if (p.random(1) < 0.5) {
              plantLayer[i][j] = { type: "tree", state: "seed", age: 0 };
            } else {
              plantLayer[i][j] = { type: "flower", state: "seed", age: 0 };
            }
          }
        }
      }
    }

    // 2) Grow existing plants, do their adjacency-based spawns, etc.
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        let plant = plantLayer[i][j];
        if (!plant) continue;

        // Age the plant
        plant.age += WEEK_FACTOR;

        if (plant.type === "tree") {
          // tree state changes
          if (plant.state === "seed" && plant.age >= 3) {
            plant.state = "sapling";
          } 
          else if (plant.state === "sapling" && plant.age >= 10) {
            plant.state = "tree";
            // Attempt to drop a seed randomly in ~3-tile radius
            let ni = i + Math.floor(p.random(-3,4));
            let nj = j + Math.floor(p.random(-3,4));
            if (ni >= 0 && nj >= 0 && ni < cols && nj < rows &&
                grid[ni][nj] === GRASS && !plantLayer[ni][nj])
            {
              let distance = Math.max(Math.abs(ni - i), Math.abs(nj - j));
              // (these might have originally been immediate-chance logic, so 
              //  scale by WEEK_FACTOR only if truly meant to be yearly)
              let chance = 0;
              // the code references “if (grid[ni][nj]===DIRT) chance=0.25*WEEK_FACTOR”, etc.
              // but that’s not in your original code, so adapt as needed if you want the same rules
              if (grid[ni][nj] === DIRT) {
                chance = 0.25 * WEEK_FACTOR;
              } else if (grid[ni][nj] === ROCK) {
                chance = (1/(5*distance)) * WEEK_FACTOR;
              }
              if (p.random(1) < chance) {
                plantLayer[ni][nj] = { type: "tree", state: "seed", age: 0 };
              }
            }
          }

          // Check vine exposure
          if (plant.state === "tree") {
            if (vineLayer[i][j]) {
              plant.vineExposure = (plant.vineExposure||0) + WEEK_FACTOR;
              if (plant.vineExposure >= 10) {
                plant.state    = "dead";
                plant.deadAge  = 0;
              }
            } else {
              plant.vineExposure = 0;
            }
          }
          if (plant.state === "dead") {
            plant.deadAge = (plant.deadAge||0) + WEEK_FACTOR;
            if (plant.deadAge >= 6) {
              plantLayer[i][j] = { type: "flower", state: "meadow", age: 0 };
            }
          }
        }
        else if (plant.type === "flower") {
          // flower transitions
          if (plant.state === "seed" && plant.age >= 1) {
            plant.state = "meadow";
            // start bees timer
            plant.bees = 3;
            // attempt local spreading
            for (let dx = -1; dx <= 1; dx++) {
              for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                let nx = i + dx, ny = j + dy;
                if (nx<0 || ny<0 || nx>=cols || ny>=rows) continue;
                if (grid[nx][ny] === GRASS && !plantLayer[nx][ny]) {
                  // reduce chance if near many mature trees
                  let matureCount=0;
                  for (let ax=-1; ax<=1; ax++){
                    for (let ay=-1; ay<=1; ay++){
                      let tx=nx+ax, ty=ny+ay;
                      if (tx<0||ty<0||tx>=cols||ty>=rows) continue;
                      let adj = plantLayer[tx][ty];
                      if (adj && adj.type==="tree" && adj.state==="tree"){
                        matureCount++;
                      }
                    }
                  }
                  let modChance = (0.3 * WEEK_FACTOR)/Math.pow(2, matureCount);
                  if (p.random(1) < modChance) {
                    plantLayer[nx][ny] = { type: "flower", state: "seed", age: 0 };
                  }
                }
              }
            }
          }

          if (plant.state === "meadow") {
            // If bees are present, decrement them
            if (plant.bees) {
              plant.bees -= WEEK_FACTOR;
              if (plant.bees <= 0) {
                delete plant.bees;
              }
            } else {
              // Active reclamation => become trees if next to 2 or more mature trees
              let matureCount=0;
              for (let dx=-1; dx<=1; dx++){
                for (let dy=-1; dy<=1; dy++){
                  if (dx===0 && dy===0) continue;
                  let nx=i+dx, ny=j+dy;
                  if (nx<0||ny<0||nx>=cols||ny>=rows) continue;
                  let adj = plantLayer[nx][ny];
                  if (adj && adj.type==="tree" && adj.state==="tree") {
                    matureCount++;
                  }
                }
              }
              if (matureCount>=2 && p.random(1) < (0.3*WEEK_FACTOR)) {
                plantLayer[i][j] = { type: "tree", state: "seed", age: 0 };
              }
            }
          }
        }
      }
    }

    // Meadows taking over saplings
    for (let i=0;i<cols;i++){
      for (let j=0;j<rows;j++){
        let plant = plantLayer[i][j];
        if (plant && plant.type==="tree" && plant.state==="sapling"){
          let meadowCount=0;
          for (let dx=-1; dx<=1; dx++){
            for (let dy=-1; dy<=1; dy++){
              if(dx===0 && dy===0) continue;
              let nx=i+dx, ny=j+dy;
              if(nx<0||ny<0||nx>=cols||ny>=rows) continue;
              let adj=plantLayer[nx][ny];
              if(adj && adj.type==="flower" && adj.state==="meadow"){
                meadowCount++;
              }
            }
          }
          if(meadowCount>=1 && p.random(1)<(0.3*WEEK_FACTOR)){
            plantLayer[i][j] = { type:"flower", state:"seed", age:0 };
          }
        }
      }
    }

    // 3) Handle vines (spread, removal, aging)
    for (let i=0;i<cols;i++){
      for (let j=0;j<rows;j++){
        let plant = plantLayer[i][j];
        let vine  = vineLayer[i][j];
        if(grid[i][j]===GRASS && plant && plant.type==="tree"){
          // possible vine spawn
          if(plant.state==="tree" && !vine){
            if(p.random(1) < (0.01*WEEK_FACTOR)){
              vineLayer[i][j] = { age:0 };
            }
          }
          // possible vine removal if present
          if(vine && plant.state==="tree"){
            if(p.random(1)<(0.05*WEEK_FACTOR)){
              vineLayer[i][j] = null;
            }
          }
        }
        // Age the vine and try to spread
        if(vine){
          vine.age += WEEK_FACTOR;
          if(vine.age>=2){
            // pick random cardinal neighbor
            let directions=[[1,0],[-1,0],[0,1],[0,-1]];
            let d = directions[Math.floor(p.random(directions.length))];
            let nx = i + d[0], ny = j + d[1];
            if(nx>=0 && ny>=0 && nx<cols && ny<rows){
              let adjPlant=plantLayer[nx][ny];
              if(adjPlant && adjPlant.type==="tree" && adjPlant.state==="tree" && !vineLayer[nx][ny]){
                if(p.random(1) < (0.1*WEEK_FACTOR)){
                  vineLayer[nx][ny] = { age:0 };
                }
              }
            }
          }
          // Vine removal by meadow
          if(plant && plant.type==="flower" && plant.state==="meadow"){
            if(p.random(1)<(0.0667*WEEK_FACTOR)){
              vineLayer[i][j] = null;
            }
          }
        }
      }
    }

    // 4) Fire mechanics (spread, burning)
    spreadAndBurnFires(p);
  }

  // BFS to convert rock to dirt if within radius=3 of water
  function convertRockNearWater() {
    // Collect all water cells as BFS start
    let queue = [];
    let dist  = [];
    for (let i=0;i<cols;i++){
      dist[i] = new Array(rows).fill(Infinity);
    }
    for (let i=0; i<cols;i++){
      for (let j=0;j<rows;j++){
        if(grid[i][j]===WATER){
          queue.push({x:i,y:j});
          dist[i][j] = 0;
        }
      }
    }
    // BFS
    while(queue.length>0){
      let {x,y} = queue.shift();
      let d = dist[x][y];
      if(d<3){
        // expand to neighbors
        for(let [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
          let nx=x+dx, ny=y+dy;
          if(nx<0||ny<0||nx>=cols||ny>=rows) continue;
          if(dist[nx][ny]>d+1){
            dist[nx][ny] = d+1;
            queue.push({x:nx,y:ny});
          }
        }
      }
    }
    // Now dist[i][j] is the BFS-distance from the nearest water cell
    // Convert any ROCK with distance < 4 to DIRT
    for(let i=0;i<cols;i++){
      for(let j=0;j<rows;j++){
        if(grid[i][j]===ROCK && dist[i][j]<=3){
          grid[i][j] = DIRT;
        }
      }
    }
  }

  function spreadAndBurnFires(p){
    // First, gather which cells are onFire
    // Then decide which neighbors catch fire, etc.
    let onFire = [];
    for(let i=0;i<cols;i++){
      for(let j=0;j<rows;j++){
        let plant = plantLayer[i][j];
        let vine  = vineLayer[i][j];
        if(plant && plant.onFire) {
          onFire.push({i,j,isVine:false});
        }
        if(vine && vine.onFire) {
          onFire.push({i,j,isVine:true});
        }
      }
    }

    // For each neighbor of a fire cell, possibly catch fire
    for(let {i,j,isVine} of onFire){
      // check all neighbors
      for(let dx=-1; dx<=1; dx++){
        for(let dy=-1; dy<=1; dy++){
          if(dx===0 && dy===0) continue;
          let nx=i+dx, ny=j+dy;
          if(nx<0||ny<0||nx>=cols||ny>=rows) continue;

          let plant = plantLayer[nx][ny];
          let vine  = vineLayer[nx][ny];
          if(!isVine && plantLayer[i][j]){
            // a plant is on fire
            if(plant && !plant.onFire){
              // Check the original logic of probabilities:
              // If plant.type==="tree" and plant.state==="dead" => 0.01
              // If tree&state==="tree" => 0.33
              // If flower&meadow => 0.1
              // Scale by WEEK_FACTOR
              if(plant.type==="tree" && plant.state==="dead"){
                plant.onFire = true;
                plant.fireAge=0;
              } else if(plant.type==="tree" && plant.state==="tree"){
                if(p.random(1)<(0.33*WEEK_FACTOR)){
                  plant.onFire = true;
                  plant.fireAge=0;
                }
              } else if(plant.type==="flower" && plant.state==="meadow"){
                if(p.random(1)<(0.1*WEEK_FACTOR)){
                  plant.onFire = true;
                  plant.fireAge=0;
                }
              }
            }
            if(vine && !vine.onFire){
              // vine catch fire prob 0.1667
              if(p.random(1)<(0.1667*WEEK_FACTOR)){
                vine.onFire=true;
                vine.fireAge=0;
              }
            }
          }
          else if(isVine && vineLayer[i][j]){
            // a vine is on fire
            if(plant && !plant.onFire){
              // Possibly catch fire from vine to plant
              if(plant.type==="tree" && plant.state==="dead"){
                // auto-catch? or same 0.01 logic?
                plant.onFire=true;
                plant.fireAge=0;
              } else if(plant.type==="tree" && plant.state==="tree"){
                if(p.random(1)<(0.33*WEEK_FACTOR)){
                  plant.onFire=true;
                  plant.fireAge=0;
                }
              } else if(plant.type==="flower" && plant.state==="meadow"){
                if(p.random(1)<(0.1*WEEK_FACTOR)){
                  plant.onFire=true;
                  plant.fireAge=0;
                }
              }
            }
            if(vine && !vine.onFire){
              // Possibly catch fire from vine to vine
              if(p.random(1)<(0.1667*WEEK_FACTOR)){
                vine.onFire=true;
                vine.fireAge=0;
              }
            }
          }
        }
      }
    }

    // Age the fires
    for(let i=0;i<cols;i++){
      for(let j=0;j<rows;j++){
        let plant = plantLayer[i][j];
        let vine  = vineLayer[i][j];
        if(plant && plant.onFire){
          plant.fireAge = (plant.fireAge||0)+WEEK_FACTOR;
          if(plant.fireAge>=2){
            // burn out => becomes DIRT, kill the plant
            grid[i][j] = DIRT;
            plantLayer[i][j] = null;
          }
        }
        if(vine && vine.onFire){
          vine.fireAge = (vine.fireAge||0)+WEEK_FACTOR;
          if(vine.fireAge>=2){
            vineLayer[i][j]=null;
          }
        }
      }
    }
  }

  function updateCharts(){
    // Count categories
    let counts={
      treeSeed:0, sapling:0, matureTree:0,
      flowerSeed:0, meadow:0, vine:0
    };
    let sum={
      treeSeed:0, sapling:0, matureTree:0,
      flowerSeed:0, meadow:0, vine:0
    };
    let count={
      treeSeed:0, sapling:0, matureTree:0,
      flowerSeed:0, meadow:0, vine:0
    };
    for (let i=0;i<cols;i++){
      for (let j=0;j<rows;j++){
        let plant=plantLayer[i][j];
        if(plant){
          if(plant.type==="tree"){
            if(plant.state==="seed"){
              counts.treeSeed++;
              sum.treeSeed+=plant.age;
              count.treeSeed++;
            } else if(plant.state==="sapling"){
              counts.sapling++;
              sum.sapling+=plant.age;
              count.sapling++;
            } else if(plant.state==="tree"){
              counts.matureTree++;
              sum.matureTree+=plant.age;
              count.matureTree++;
            } else if(plant.state==="dead"){
              // no separate category in the chart for dead trees
            }
          } else if(plant.type==="flower"){
            if(plant.state==="seed"){
              counts.flowerSeed++;
              sum.flowerSeed+=plant.age;
              count.flowerSeed++;
            } else if(plant.state==="meadow"){
              counts.meadow++;
              sum.meadow+=plant.age;
              count.meadow++;
            }
          }
        }
        if(vineLayer[i][j]){
          counts.vine++;
          sum.vine += vineLayer[i][j].age;
          count.vine++;
        }
      }
    }
    // population chart
    myChart.data.labels.push(simulationYears.toFixed(2));
    myChart.data.datasets[0].data.push(counts.treeSeed);
    myChart.data.datasets[1].data.push(counts.sapling);
    myChart.data.datasets[2].data.push(counts.matureTree);
    myChart.data.datasets[3].data.push(counts.flowerSeed);
    myChart.data.datasets[4].data.push(counts.meadow);
    myChart.data.datasets[5].data.push(counts.vine);
    myChart.update();

    // average age chart
    function avg(s,c){return c? (s/c) : 0;}
    let avgAges={
      treeSeed:    avg(sum.treeSeed,    count.treeSeed),
      sapling:     avg(sum.sapling,     count.sapling),
      matureTree:  avg(sum.matureTree,  count.matureTree),
      flowerSeed:  avg(sum.flowerSeed,  count.flowerSeed),
      meadow:      avg(sum.meadow,      count.meadow),
      vine:        avg(sum.vine,        count.vine),
    };
    averageAgeChart.data.labels.push(simulationYears.toFixed(2));
    averageAgeChart.data.datasets[0].data.push(avgAges.treeSeed);
    averageAgeChart.data.datasets[1].data.push(avgAges.sapling);
    averageAgeChart.data.datasets[2].data.push(avgAges.matureTree);
    averageAgeChart.data.datasets[3].data.push(avgAges.flowerSeed);
    averageAgeChart.data.datasets[4].data.push(avgAges.meadow);
    averageAgeChart.data.datasets[5].data.push(avgAges.vine);
    averageAgeChart.update();
  }

  function renderOverlays(p) {
    for (let i=0;i<cols;i++){
      for (let j=0;j<rows;j++){
        let x=i*cellSize, y=j*cellSize;
        let plant=plantLayer[i][j];
        if(plant){
          // fire on top?
          if(plant.onFire){
            p.image(fireIcon, x, y, cellSize, cellSize);
          } else if(plant.type==="tree"){
            if(plant.state==="seed")         p.image(treeSeedIcon,   x,y, cellSize,cellSize);
            else if(plant.state==="sapling") p.image(saplingIcon,    x,y, cellSize,cellSize);
            else if(plant.state==="tree")    p.image(treeIcon,       x,y, cellSize,cellSize);
            else if(plant.state==="dead")    p.image(deadTreeIcon,   x,y, cellSize,cellSize);
          } else if(plant.type==="flower"){
            if(plant.state==="seed")   p.image(flowerSeedIcon, x,y, cellSize,cellSize);
            else if(plant.state==="meadow") p.image(meadowIcon, x,y, cellSize,cellSize);
          }
          if(plant.bees){
            p.image(beeIcon, x+cellSize*0.6, y, cellSize*0.4, cellSize*0.4);
          }
        }
        let vine=vineLayer[i][j];
        if(vine){
          if(vine.onFire){
            p.image(fireIcon, x,y, cellSize,cellSize);
          } else {
            // figure out which vine image to use
            if(plant){
              if(plant.type==="tree"){
                if(plant.state==="dead") p.image(deadTreeVineIcon, x,y, cellSize, cellSize);
                else                     p.image(treeVineIcon,     x,y, cellSize, cellSize);
              } else if(plant.type==="flower" && plant.state==="meadow"){
                p.image(meadowVineIcon, x,y, cellSize, cellSize);
              } else {
                p.image(treeVineIcon, x,y, cellSize, cellSize);
              }
            } else {
              // vine with no plant
              p.image(treeVineIcon, x,y, cellSize, cellSize);
            }
          }
        }
      }
    }
  }

  function drawTooltip(p){
    let simMouseX = (p.mouseX - panX)/zoomLevel;
    let simMouseY = (p.mouseY - panY)/zoomLevel;
    let hoverI = Math.floor(simMouseX/cellSize);
    let hoverJ = Math.floor(simMouseY/cellSize);
    if (hoverI<0||hoverI>=cols||hoverJ<0||hoverJ>=rows) return;

    let terrain = grid[hoverI][hoverJ];
    let plant   = plantLayer[hoverI][hoverJ];
    let info    = "Terrain: "+terrain+"\n";
    if(plant){
      info += `Plant: ${plant.type} (${plant.state})\n`;
      info += `Age: ${plant.age.toFixed(2)} yrs\n`;
      if(plant.vineExposure) info += `VineExposure: ${plant.vineExposure.toFixed(2)}\n`;
      if(plant.deadAge)      info += `Dead Age: ${plant.deadAge.toFixed(2)}\n`;
      if(plant.onFire)       info += `On Fire: ${plant.fireAge?.toFixed(2) ?? 0}\n`;
      if(plant.bees)         info += `Bees Timer: ${plant.bees.toFixed(2)}\n`;
    }
    let vine=vineLayer[hoverI][hoverJ];
    if(vine){
      info += `Vine Age: ${vine.age.toFixed(2)}\n`;
      if(vine.onFire) info += `Vine Fire Age: ${vine.fireAge?.toFixed(2) ?? 0}\n`;
    }

    // draw tooltip
    p.push();
    p.resetMatrix();
    let lines = info.split("\n");
    let w=0;
    lines.forEach(line=>{
      let tw=p.textWidth(line);
      if(tw>w) w=tw;
    });
    let lineHeight=12;
    let tooltipH = lines.length*lineHeight +10;
    let tooltipX = p.mouseX + 10;
    let tooltipY = p.mouseY + 10;
    p.fill(255,240);
    p.stroke(0);
    p.rect(tooltipX, tooltipY, w+10, tooltipH,5);
    p.fill(0);
    p.noStroke();
    p.textAlign(p.LEFT,p.TOP);
    p.text(info, tooltipX+5, tooltipY+5);
    p.pop();
  }

  // tickRate input
  document.getElementById("tickInput")?.addEventListener("change", (e) => {
    tickRate = parseFloat(e.target.value) || 1;
    tickInterval = 1/tickRate;
  });
};

new p5(sketch, document.getElementById("simulation-container"));

// Existing controls
window.pauseSimulation = () => { paused=true; };
window.resumeSimulation = () => { paused=false; };
window.restartSimulation = () => {
  paused = false;
  simulationYears = 0;
  timeAccumulator = 0;
  generateRivers(pInstance);
  populationHistory = [];
  myChart.data.labels = [];
  myChart.data.datasets.forEach(ds => ds.data = []);
  myChart.update();
  averageAgeChart.data.labels = [];
  averageAgeChart.data.datasets.forEach(ds => ds.data = []);
  averageAgeChart.update();
};
