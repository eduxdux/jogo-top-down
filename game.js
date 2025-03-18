// Game constants
const TILE_SIZE = 32;
const CHUNK_SIZE = 32; // Size of each chunk in tiles
let CANVAS_WIDTH = 1200;
let CANVAS_HEIGHT = 800;
const BUILDING_COLORS = ['#8B4513', '#A0522D', '#CD853F', '#D2691E', '#B22222', '#8B0000', '#4B0082'];
const BUILDING_WINDOW_COLORS = ['#87CEEB', '#ADD8E6', '#B0E0E6', '#AFEEEE', '#F0FFFF'];
const BUILDING_DOOR_COLORS = ['#8B4513', '#A52A2A', '#800000', '#4B0082', '#2F4F4F'];
const DAY_NIGHT_CYCLE_DURATION = 100000; // 5 minutes per cycle
const NIGHT_OVERLAY_COLOR = '#261357';
let gameStartTime = Date.now();
let timeDisplay; // Element to display game time

// Game variables
let seed = Math.floor(Math.random() * 1000000);
let chunks = new Map(); // Map to store chunks with their coordinates as keys
let player = null;
let keys = {}; // To track which keys are pressed

// DOM Elements
let canvas;
let ctx;
let seedDisplay;
let regenerateBtn;
let chunkDisplay; // Element to display current chunk coordinates

// Initialize the game
function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    seedDisplay = document.getElementById('seed-display');
    regenerateBtn = document.getElementById('regenerate-btn');
    
    // Set canvas dimensions based on container size
    resizeCanvas();
    
    // Create chunk display element
    chunkDisplay = document.createElement('div');
    chunkDisplay.id = 'chunk-display';
    document.getElementById('ui-overlay').appendChild(chunkDisplay);
    
    // Create time display element
    timeDisplay = document.createElement('div');
    timeDisplay.id = 'time-display';
    timeDisplay.style.marginTop = '10px';
    document.getElementById('ui-overlay').appendChild(timeDisplay);
    
    seedDisplay.textContent = `Seed: ${seed}`;
    initializePlayer();
    generateInitialChunks();
    render();
    
    // Add event listener for regenerate button
    regenerateBtn.addEventListener('click', () => {
        seed = Math.floor(Math.random() * 1000000);
        seedDisplay.textContent = `Seed: ${seed}`;
        chunks.clear();
        generateInitialChunks();
        updateChunkDisplay(); // Update chunk display after regenerating
        render();
    });
    
    // Add keyboard event listeners for player movement
    window.addEventListener('keydown', (e) => {
        keys[e.key] = true;
    });
    
    window.addEventListener('keyup', (e) => {
        keys[e.key] = false;
    });
    
    // Add on-screen control buttons event listeners
    setupControlButtons();
    
    // Add resize event listener
    window.addEventListener('resize', () => {
        resizeCanvas();
        render();
    });
    
    // Start game loop
    gameLoop();
}

// Function to resize canvas based on container size
function resizeCanvas() {
    const container = document.getElementById('game-container');
    CANVAS_WIDTH = container.clientWidth;
    CANVAS_HEIGHT = container.clientHeight;
    
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    
    // Update canvas rendering properties after resize
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false; // Keep pixel art crisp
}

// Setup on-screen control buttons
function setupControlButtons() {
    const upBtn = document.getElementById('up-btn');
    const downBtn = document.getElementById('down-btn');
    const leftBtn = document.getElementById('left-btn');
    const rightBtn = document.getElementById('right-btn');
    
    // Helper function to handle both touch and mouse events
    function addButtonListeners(button, keyCode) {
        // Mouse events
        button.addEventListener('mousedown', () => {
            keys[keyCode] = true;
        });
        
        button.addEventListener('mouseup', () => {
            keys[keyCode] = false;
        });
        
        button.addEventListener('mouseleave', () => {
            keys[keyCode] = false;
        });
        
        // Touch events for mobile
        button.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent scrolling
            keys[keyCode] = true;
        });
        
        button.addEventListener('touchend', (e) => {
            e.preventDefault();
            keys[keyCode] = false;
        });
        
        button.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            keys[keyCode] = false;
        });
    }
    
    // Add listeners to each direction button
    addButtonListeners(upBtn, 'ArrowUp');
    addButtonListeners(downBtn, 'ArrowDown');
    addButtonListeners(leftBtn, 'ArrowLeft');
    addButtonListeners(rightBtn, 'ArrowRight');
}

// Game loop
function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}

// Update game state
// Calculate game time based on cycle
function calculateGameTime() {
    const elapsedTime = (Date.now() - gameStartTime) % DAY_NIGHT_CYCLE_DURATION;
    const dayProgress = elapsedTime / DAY_NIGHT_CYCLE_DURATION;
    
    // Convert to 24-hour format starting at 6:00
    const hours = Math.floor((dayProgress * 24 + 6) % 24);
    const minutes = Math.floor((dayProgress * 24 * 60) % 60);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function update() {
    if (!player) return;
    
    // Update time display
    if (timeDisplay) {
        const gameTime = calculateGameTime();
        timeDisplay.textContent = `Horário: ${gameTime}`;
    }
    
    let newX = player.x;
    let newY = player.y;
    const moveSpeed = 6; // Pixels per frame
    
    // Handle arrow key movement
    if (keys['ArrowUp'] || keys['w']) {
        newY -= moveSpeed;
    }
    if (keys['ArrowDown'] || keys['s']) {
        newY += moveSpeed;
    }
    if (keys['ArrowLeft'] || keys['a']) {
        newX -= moveSpeed;
    }
    if (keys['ArrowRight'] || keys['d']) {
        newX += moveSpeed;
    }
    
    // Update player position without collision checks
    player.x = newX;
    player.y = newY;
    player.z = newY + TILE_SIZE * 1.5; // Update z-index based on player's feet position
    
    // Check if player is on water
    player.isOnWater = isPlayerOnWater();
    
    // Check if we need to generate new chunks
    checkAndGenerateChunks();
    
    // Update chunk display
    updateChunkDisplay();
}

// Seeded random function
function seededRandom() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
}

// Initialize player
function initializePlayer() {
    player = {
        type: 'player',
        x: 0,
        y: 0,
        z: 15, // Y-sorting based on bottom position
        color: '#FF0000', // Red
        isOnWater: false // Flag to track if player is on water
    };
}

// Get chunk key from world coordinates
function getChunkKey(x, y) {
    const chunkX = Math.floor(x / (CHUNK_SIZE * TILE_SIZE));
    const chunkY = Math.floor(y / (CHUNK_SIZE * TILE_SIZE));
    return `${chunkX},${chunkY}`;
}

// Check if player is on water tile
function isPlayerOnWater() {
    if (!player) return false;
    
    // Get the chunk key for the player's position
    const chunkKey = getChunkKey(player.x, player.y);
    const chunk = chunks.get(chunkKey);
    
    if (!chunk) return false;
    
    // Check if any water tile overlaps with the player's position
    return chunk.some(obj => {
        return obj.type === 'water' && 
               player.x >= obj.x && 
               player.x < obj.x + TILE_SIZE && 
               player.y >= obj.y && 
               player.y < obj.y + TILE_SIZE;
    });
}

// Generate initial chunks around player
function generateInitialChunks() {
    const renderDistance = 2; // Number of chunks to render in each direction
    const playerChunkX = Math.floor(player.x / (CHUNK_SIZE * TILE_SIZE));
    const playerChunkY = Math.floor(player.y / (CHUNK_SIZE * TILE_SIZE));
    
    for (let y = playerChunkY - renderDistance; y <= playerChunkY + renderDistance; y++) {
        for (let x = playerChunkX - renderDistance; x <= playerChunkX + renderDistance; x++) {
            generateChunk(x, y);
        }
    }
}

// Update the chunk display with current player chunk coordinates
function updateChunkDisplay() {
    if (!player || !chunkDisplay) return;
    
    const playerChunkX = Math.floor(player.x / (CHUNK_SIZE * TILE_SIZE));
    const playerChunkY = Math.floor(player.y / (CHUNK_SIZE * TILE_SIZE));
    
    chunkDisplay.textContent = `Chunk: ${playerChunkX}, ${playerChunkY}`;
}

// Check and generate new chunks as needed
function checkAndGenerateChunks() {
    const renderDistance = 2;
    const playerChunkX = Math.floor(player.x / (CHUNK_SIZE * TILE_SIZE));
    const playerChunkY = Math.floor(player.y / (CHUNK_SIZE * TILE_SIZE));
    
    for (let y = playerChunkY - renderDistance; y <= playerChunkY + renderDistance; y++) {
        for (let x = playerChunkX - renderDistance; x <= playerChunkX + renderDistance; x++) {
            const chunkKey = `${x},${y}`;
            if (!chunks.has(chunkKey)) {
                generateChunk(x, y);
            }
        }
    }
    
    // Remove chunks that are too far away
    for (const [key, chunk] of chunks.entries()) {
        const [chunkX, chunkY] = key.split(',').map(Number);
        if (Math.abs(chunkX - playerChunkX) > renderDistance + 1 ||
            Math.abs(chunkY - playerChunkY) > renderDistance + 1) {
            chunks.delete(key);
        }
    }
}

// Generate a single chunk
function generateChunk(chunkX, chunkY) {
    const chunkKey = `${chunkX},${chunkY}`;
    const chunkObjects = [];
    const chunkSeed = seed + chunkX * 10000 + chunkY; // Unique seed for each chunk
    
    // Generate base terrain (grass)
    for (let y = 0; y < CHUNK_SIZE; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
            const worldX = chunkX * CHUNK_SIZE * TILE_SIZE + x * TILE_SIZE;
            const worldY = chunkY * CHUNK_SIZE * TILE_SIZE + y * TILE_SIZE;
            
            chunkObjects.push({
                type: 'grass',
                x: worldX,
                y: worldY,
                z: worldY + TILE_SIZE, // Z-index at bottom of tile
                color: getGrassColor()
            });
        }
    }
    
    // Generate water bodies (ponds and lakes) using noise-like approach
    const hasWater = seededRandom() < 0.4; // 40% chance of having water in a chunk
    if (hasWater) {
        // Choose a center point for the water body
        const centerX = Math.floor(seededRandom() * CHUNK_SIZE);
        const centerY = Math.floor(seededRandom() * CHUNK_SIZE);
        const waterSize = Math.floor(seededRandom() * 8) + 3; // Size between 3 and 10 tiles
        
        // Generate water tiles in a natural pattern around the center
        for (let y = Math.max(0, centerY - waterSize); y < Math.min(CHUNK_SIZE, centerY + waterSize); y++) {
            for (let x = Math.max(0, centerX - waterSize); x < Math.min(CHUNK_SIZE, centerX + waterSize); x++) {
                const distanceFromCenter = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
                const worldX = chunkX * CHUNK_SIZE * TILE_SIZE + x * TILE_SIZE;
                const worldY = chunkY * CHUNK_SIZE * TILE_SIZE + y * TILE_SIZE;
                
                // Create irregular shaped water bodies
                if (distanceFromCenter < waterSize * (0.7 + seededRandom() * 0.3)) {
                    chunkObjects.push({
                        type: 'water',
                        x: worldX,
                        y: worldY,
                        z: worldY + TILE_SIZE, // Z-index at water surface
                        color: getWaterColor()
                    });
                }
            }
        }
    }
    
    // Track tree positions for minimum distance check
    const treePositions = [];
    const MIN_TREE_DISTANCE = TILE_SIZE * 1.5; // Minimum distance between trees
    
    // Function to check if a position is too close to existing trees
    function isTooCloseToTrees(x, y) {
        return treePositions.some(pos => {
            const distance = Math.sqrt(Math.pow(pos.x - x, 2) + Math.pow(pos.y - y, 2));
            return distance < MIN_TREE_DISTANCE;
        });
    }
    
    // Function to create a tree at the given position
    function createTree(worldX, worldY) {
        // Tree properties
        const pivotX = worldX + TILE_SIZE/2; // Center of the tile
        const pivotY = worldY + TILE_SIZE; // Bottom of the tile
        const treeZ = worldY + TILE_SIZE; // Base z-index for entire tree
        const trunkHeight = TILE_SIZE * 1.5;
        const trunkWidth = TILE_SIZE * 0.6;
        const leavesWidth = TILE_SIZE * 2.5;
        const leavesHeight = TILE_SIZE * 2.5;
        const treeVariation = seededRandom() * 0.3 + 0.85; // Scale variation 0.85-1.15
        
        // Add position to tracked tree positions
        treePositions.push({x: worldX, y: worldY});
        
        // Create a single tree object with all components
        chunkObjects.push({
            type: 'tree',
            pivotX: pivotX,
            pivotY: pivotY,
            x: pivotX,
            y: pivotY,
            z: treeZ,
            
            // Shadow properties
            shadowX: pivotX - (leavesWidth * 0.6),
            shadowY: pivotY - (TILE_SIZE * 0.3),
            shadowWidth: leavesWidth * 1.2,
            shadowHeight: TILE_SIZE * 0.5,
            shadowColor: 'rgba(0, 0, 0, 0.2)',
            
            // Trunk properties
            trunkX: pivotX - (trunkWidth/2),
            trunkY: pivotY - trunkHeight,
            trunkWidth: trunkWidth,
            trunkHeight: trunkHeight,
            trunkColor: '#8B4513',
            
            // Leaves properties
            leavesX: pivotX - (leavesWidth/2),
            leavesY: pivotY - trunkHeight - leavesHeight * 0.8,
            leavesWidth: leavesWidth,
            leavesHeight: leavesHeight,
            leavesColor: getTreeColor(),
            
            // Leaves highlight properties
            highlightX: pivotX - (leavesWidth/2) + leavesWidth * 0.2,
            highlightY: pivotY - trunkHeight - leavesHeight * 0.8 + leavesHeight * 0.1,
            highlightWidth: leavesWidth * 0.6,
            highlightHeight: leavesHeight * 0.5,
            highlightColor: 'rgba(255, 255, 255, 0.15)',
            
            // Common properties
            variation: treeVariation
        });
    }
    
    // Generate forest clusters
    const hasForest = seededRandom() < 0.6; // 60% chance of having a forest in a chunk
    if (hasForest) {
        // Choose a center point for the forest
        const forestCenterX = Math.floor(seededRandom() * CHUNK_SIZE);
        const forestCenterY = Math.floor(seededRandom() * CHUNK_SIZE);
        const forestSize = Math.floor(seededRandom() * 10) + 5; // Size between 5 and 14 tiles
        const forestDensity = 0.4 + seededRandom() * 0.4; // Density between 0.4 and 0.8
        
        // Generate trees in a natural cluster pattern
        for (let y = Math.max(0, forestCenterY - forestSize); y < Math.min(CHUNK_SIZE, forestCenterY + forestSize); y++) {
            for (let x = Math.max(0, forestCenterX - forestSize); x < Math.min(CHUNK_SIZE, forestCenterX + forestSize); x++) {
                const distanceFromCenter = Math.sqrt(Math.pow(x - forestCenterX, 2) + Math.pow(y - forestCenterY, 2));
                const worldX = chunkX * CHUNK_SIZE * TILE_SIZE + x * TILE_SIZE;
                const worldY = chunkY * CHUNK_SIZE * TILE_SIZE + y * TILE_SIZE;
                
                // Create trees with higher density near the center and lower at the edges
                const treeChance = forestDensity * (1 - distanceFromCenter / forestSize);
                if (seededRandom() < treeChance && distanceFromCenter < forestSize) {
                    // Check if this position already has water
                    const hasWaterAtPosition = chunkObjects.some(obj => 
                        obj.type === 'water' && obj.x === worldX && obj.y === worldY
                    );
                    
                    // Check if this position is too close to other trees
                    const tooCloseToTrees = isTooCloseToTrees(worldX, worldY);
                    
                    if (!hasWaterAtPosition && !tooCloseToTrees) {
                        // Tree properties
                        const pivotX = worldX + TILE_SIZE/2; // Center of the tile
                        const pivotY = worldY + TILE_SIZE; // Bottom of the tile
                        const treeZ = worldY + TILE_SIZE; // Base z-index for entire tree
                        const trunkHeight = TILE_SIZE * 1.5;
                        const trunkWidth = TILE_SIZE * 0.6;
                        const leavesWidth = TILE_SIZE * 2.5;
                        const leavesHeight = TILE_SIZE * 2.5;
                        const treeVariation = seededRandom() * 0.3 + 0.85; // Scale variation 0.85-1.15
                        
                        // Add position to tracked tree positions
                        treePositions.push({x: worldX, y: worldY});
                        
                        // Create a single tree object with all components
                        chunkObjects.push({
                            type: 'tree',
                            pivotX: pivotX,
                            pivotY: pivotY,
                            x: pivotX,
                            y: pivotY,
                            z: treeZ,
                            
                            // Shadow properties
                            shadowX: pivotX - (leavesWidth * 0.6),
                            shadowY: pivotY - (TILE_SIZE * 0.3),
                            shadowWidth: leavesWidth * 1.2,
                            shadowHeight: TILE_SIZE * 0.5,
                            shadowColor: 'rgba(0, 0, 0, 0.2)',
                            
                            // Trunk properties
                            trunkX: pivotX - (trunkWidth/2),
                            trunkY: pivotY - trunkHeight,
                            trunkWidth: trunkWidth,
                            trunkHeight: trunkHeight,
                            trunkColor: '#8B4513',
                            
                            // Leaves properties
                            leavesX: pivotX - (leavesWidth/2),
                            leavesY: pivotY - trunkHeight - leavesHeight * 0.8,
                            leavesWidth: leavesWidth,
                            leavesHeight: leavesHeight,
                            leavesColor: getTreeColor(),
                            
                            // Leaves highlight properties
                            highlightX: pivotX - (leavesWidth/2) + leavesWidth * 0.2,
                            highlightY: pivotY - trunkHeight - leavesHeight * 0.8 + leavesHeight * 0.1,
                            highlightWidth: leavesWidth * 0.6,
                            highlightHeight: leavesHeight * 0.5,
                            highlightColor: 'rgba(255, 255, 255, 0.15)',
                            
                            // Common properties
                            variation: treeVariation
                        });
                    }
                }
            }
        }
    }
    
    // Generate small grass elements scattered throughout the chunk
    for (let y = 0; y < CHUNK_SIZE; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
            const worldX = chunkX * CHUNK_SIZE * TILE_SIZE + x * TILE_SIZE;
            const worldY = chunkY * CHUNK_SIZE * TILE_SIZE + y * TILE_SIZE;
            
            if (seededRandom() < 0.05) { // 5% chance for small grass elements
                // Check if this position already has water or a tree
                const hasObjectAtPosition = chunkObjects.some(obj => 
                    (obj.type === 'water' || obj.type === 'tree') && 
                    obj.x === worldX && obj.y === worldY
                );
                
                if (!hasObjectAtPosition) {
                    // Create small grass element with pivot at base for Y-sorting
                    const grassHeight = TILE_SIZE * (0.3 + seededRandom() * 0.4); // 30-70% of tile size
                    const grassWidth = TILE_SIZE * (0.2 + seededRandom() * 0.3); // 20-50% of tile size
                    const pivotX = worldX + TILE_SIZE/2 + (seededRandom() * TILE_SIZE/2 - TILE_SIZE/4);
                    const pivotY = worldY + TILE_SIZE; // Bottom of the tile (base of grass)
                    
                    chunkObjects.push({
                        type: 'small_grass',
                        pivotX: pivotX,
                        pivotY: pivotY,
                        x: pivotX - grassWidth/2,
                        y: pivotY - grassHeight,
                        z: worldY + TILE_SIZE, // Z-index at grass base for Y-sorting
                        width: grassWidth,
                        height: grassHeight,
                        color: getSmallGrassColor(),
                        variation: 0.8 + seededRandom() * 0.4 // Slight variation in appearance
                    });
                }
            }
            
            if (seededRandom() < 0.02) { // 2% chance for rocks
                // Check if this position already has water or a tree
                const hasObjectAtPosition = chunkObjects.some(obj => 
                    (obj.type === 'water' || obj.type === 'tree') && 
                    obj.x === worldX && obj.y === worldY
                );
                
                if (!hasObjectAtPosition) {
                    chunkObjects.push({
                        type: 'rock',
                        x: worldX + (seededRandom() * TILE_SIZE/2),
                        y: worldY + (seededRandom() * TILE_SIZE/2),
                        z: worldY + TILE_SIZE/2, // Z-index at rock base
                        width: TILE_SIZE/2 + seededRandom() * TILE_SIZE/2,
                        height: TILE_SIZE/2 + seededRandom() * TILE_SIZE/3,
                        color: getRockColor()
                    });
                }
            }
        }
    }
    
    // Generate solitary trees outside of forests
    const solitaryTreeCount = Math.floor(seededRandom() * 5); // 0-4 solitary trees per chunk
    for (let i = 0; i < solitaryTreeCount; i++) {
        // Choose random positions for solitary trees
        const treeX = Math.floor(seededRandom() * CHUNK_SIZE);
        const treeY = Math.floor(seededRandom() * CHUNK_SIZE);
        const worldX = chunkX * CHUNK_SIZE * TILE_SIZE + treeX * TILE_SIZE;
        const worldY = chunkY * CHUNK_SIZE * TILE_SIZE + treeY * TILE_SIZE;
        
        // Check if this position already has water
        const hasWaterAtPosition = chunkObjects.some(obj => 
            obj.type === 'water' && obj.x === worldX && obj.y === worldY
        );
        
        // Check if this position is too close to other trees
        const tooCloseToTrees = isTooCloseToTrees(worldX, worldY);
        
        // Only create solitary tree if position is valid
        if (!hasWaterAtPosition && !tooCloseToTrees) {
            createTree(worldX, worldY);
        }
    }
    
    // Generate exactly ONE building per chunk with 40% probability
    const hasBuilding = seededRandom() < 0.4; // 40% chance of having a building
    if (hasBuilding) {
        // Choose a good position for the building (avoid water and dense forest areas)
        let buildingX, buildingY;
        let attempts = 0;
        let validPosition = false;
        
        while (!validPosition && attempts < 20) {
            buildingX = Math.floor(seededRandom() * (CHUNK_SIZE - 8)) + 4; // Keep away from edges
            buildingY = Math.floor(seededRandom() * (CHUNK_SIZE - 8)) + 4;
            
            const worldX = chunkX * CHUNK_SIZE * TILE_SIZE + buildingX * TILE_SIZE;
            const worldY = chunkY * CHUNK_SIZE * TILE_SIZE + buildingY * TILE_SIZE;
            
            // Check if there's water or trees in a 3x3 area around the building position
            let hasObstacle = false;
            for (let y = -1; y <= 1; y++) {
                for (let x = -1; x <= 1; x++) {
                    const checkX = worldX + x * TILE_SIZE;
                    const checkY = worldY + y * TILE_SIZE;
                    
                    const hasObjectAtPosition = chunkObjects.some(obj => 
                        (obj.type === 'water' || obj.type === 'tree') && 
                        Math.abs(obj.x - checkX) < TILE_SIZE && 
                        Math.abs(obj.y - checkY) < TILE_SIZE
                    );
                    
                    if (hasObjectAtPosition) {
                        hasObstacle = true;
                        break;
                    }
                }
                if (hasObstacle) break;
            }
            
            validPosition = !hasObstacle;
            attempts++;
        }
        
        // If we found a valid position or ran out of attempts, place the building
        const worldX = chunkX * CHUNK_SIZE * TILE_SIZE + buildingX * TILE_SIZE;
        const worldY = chunkY * CHUNK_SIZE * TILE_SIZE + buildingY * TILE_SIZE;
        
        const buildingWidth = (Math.floor(seededRandom() * 4) + 4) * TILE_SIZE;
        const buildingHeight = (Math.floor(seededRandom() * 4) + 4) * TILE_SIZE;
        const floors = Math.floor(seededRandom() * 3) + 1;
        const hasBalcony = floors > 1 && seededRandom() > 0.3;
        
        chunkObjects.push({
            type: 'building',
            x: worldX,
            y: worldY,
            z: worldY + buildingHeight, // Z-index at building base
            width: buildingWidth,
            height: buildingHeight,
            floors: floors,
            hasBalcony: hasBalcony,
            buildingColor: BUILDING_COLORS[Math.floor(seededRandom() * BUILDING_COLORS.length)],
            windowColor: BUILDING_WINDOW_COLORS[Math.floor(seededRandom() * BUILDING_WINDOW_COLORS.length)],
            doorColor: BUILDING_DOOR_COLORS[Math.floor(seededRandom() * BUILDING_DOOR_COLORS.length)]
        });
    }
    
    chunks.set(chunkKey, chunkObjects);
}

// Color generators
function getGrassColor() {
    const r = Math.floor(60 + seededRandom() * 15);
    const g = Math.floor(160 + seededRandom() * 25);
    const b = Math.floor(60 + seededRandom() * 15);
    return `rgb(${r}, ${g}, ${b})`;
}

function getWaterColor() {
    const r = Math.floor(10 + seededRandom() * 20);
    const g = Math.floor(90 + seededRandom() * 40);
    const b = Math.floor(170 + seededRandom() * 50);
    return `rgb(${r}, ${g}, ${b})`;
}

function getTreeColor() {
    // Create more natural tree colors with seasonal variations
    const seasonRandom = seededRandom();
    
    if (seasonRandom < 0.7) { // Summer/Spring green
        const r = Math.floor(20 + seededRandom() * 40);
        const g = Math.floor(100 + seededRandom() * 80);
        const b = Math.floor(20 + seededRandom() * 40);
        return `rgb(${r}, ${g}, ${b})`;
    } else if (seasonRandom < 0.9) { // Fall colors
        const r = Math.floor(150 + seededRandom() * 100);
        const g = Math.floor(50 + seededRandom() * 100);
        const b = Math.floor(10 + seededRandom() * 40);
        return `rgb(${r}, ${g}, ${b})`;
    } else { // Winter/special colors
        const r = Math.floor(20 + seededRandom() * 40);
        const g = Math.floor(80 + seededRandom() * 60);
        const b = Math.floor(80 + seededRandom() * 100);
        return `rgb(${r}, ${g}, ${b})`;
    }
}

function getRockColor() {
    const shade = Math.floor(100 + seededRandom() * 80);
    return `rgb(${shade}, ${shade}, ${shade})`;
}

function getSmallGrassColor() {
    // Create slightly different colors from the main grass
    const r = Math.floor(50 + seededRandom() * 20);
    const g = Math.floor(150 + seededRandom() * 40);
    const b = Math.floor(50 + seededRandom() * 20);
    return `rgb(${r}, ${g}, ${b})`;
}

// Drawing functions
function drawGrid() {
    const cameraX = player ? player.x - CANVAS_WIDTH/2 + TILE_SIZE/2 : 0;
    const cameraY = player ? player.y - CANVAS_HEIGHT/2 + TILE_SIZE/2 : 0;
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    // Calculate visible grid lines
    const startX = Math.floor(cameraX / TILE_SIZE) * TILE_SIZE;
    const startY = Math.floor(cameraY / TILE_SIZE) * TILE_SIZE;
    const endX = startX + CANVAS_WIDTH + TILE_SIZE;
    const endY = startY + CANVAS_HEIGHT + TILE_SIZE;
    
    // Draw vertical lines
    for (let x = startX; x <= endX; x += TILE_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
        ctx.stroke();
    }
    
    // Draw horizontal lines
    for (let y = startY; y <= endY; y += TILE_SIZE) {
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();
    }
}

function render() {
    // Clear the canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Calculate camera offset to center on player
    const cameraX = player ? player.x - CANVAS_WIDTH/2 + TILE_SIZE/2 : 0;
    const cameraY = player ? player.y - CANVAS_HEIGHT/2 + TILE_SIZE/2 : 0;
    
    // Apply camera transform
    ctx.save();
    ctx.translate(-cameraX, -cameraY);
    
    // Get all visible objects from loaded chunks
    const visibleObjects = [];
    for (const chunkObjects of chunks.values()) {
        visibleObjects.push(...chunkObjects);
    }
    if (player) visibleObjects.push(player);
    
    // Sort objects by z-index (Y-sorting)
    // For trees, we want to sort them based on their base z-index
    const sortedObjects = visibleObjects.sort((a, b) => {
        // Use the base z-index for comparison
        return a.z - b.z;
    });
    
    // Flag to track if player has been rendered by a tree
    let playerRenderedByTree = false;
    
    // Draw all objects
    for (const obj of sortedObjects) {
        switch (obj.type) {
            case 'grass':
                ctx.fillStyle = obj.color;
                ctx.fillRect(obj.x, obj.y, TILE_SIZE, TILE_SIZE);
                break;
                
            case 'water':
                ctx.fillStyle = obj.color;
                ctx.fillRect(obj.x, obj.y, TILE_SIZE, TILE_SIZE);
                
                // Add some water ripple effect
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                const rippleSize = Math.sin(Date.now() / 1000 + obj.x + obj.y) * 5 + 10;
                ctx.fillRect(
                    obj.x + TILE_SIZE/2 - rippleSize/2, 
                    obj.y + TILE_SIZE/2 - rippleSize/2, 
                    rippleSize, 
                    rippleSize
                );
                break;
                
            case 'tree':
                // Draw tree components in the correct order for proper z-sorting
                
                // 1. First draw the shadow (always at the bottom)
                ctx.fillStyle = obj.shadowColor;
                ctx.beginPath();
                ctx.ellipse(
                    obj.shadowX + obj.shadowWidth/2, 
                    obj.shadowY + obj.shadowHeight/2, 
                    obj.shadowWidth/2 * obj.variation, 
                    obj.shadowHeight/2 * obj.variation, 
                    0, 0, Math.PI * 2
                );
                ctx.fill();
                
                // 2. Check if player is behind the tree trunk but in front of the leaves
                // Expanded the detection area to better handle player position relative to the tree
                const playerBehindTrunk = player && 
                    player.z > obj.z && 
                    player.z < obj.z + obj.trunkHeight * 1.5 && 
                    player.x > obj.trunkX - TILE_SIZE * 1.5 && 
                    player.x < obj.trunkX + obj.trunkWidth + TILE_SIZE * 1.5 &&
                    player.y > obj.trunkY - TILE_SIZE * 1.5 && 
                    player.y < obj.pivotY + TILE_SIZE;
                
                // 3. Draw the player if they're behind the trunk but in front of leaves
                if (playerBehindTrunk) {
                    // Draw player body
                    ctx.fillStyle = player.color;
                    ctx.fillRect(player.x - TILE_SIZE/3, player.y - TILE_SIZE/2, TILE_SIZE*2/3, TILE_SIZE);
                    
                    // Draw player head
                    ctx.fillRect(player.x - TILE_SIZE/2, player.y - TILE_SIZE, TILE_SIZE, TILE_SIZE);
                    
                    // Draw player eyes
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(player.x - TILE_SIZE/3, player.y - TILE_SIZE*0.8, TILE_SIZE/6, TILE_SIZE/6);
                    ctx.fillRect(player.x + TILE_SIZE/6, player.y - TILE_SIZE*0.8, TILE_SIZE/6, TILE_SIZE/6);
                    
                    // Mark player as rendered
                    playerRenderedByTree = true;
                }
                
                // 4. Draw the tree trunk
                ctx.fillStyle = obj.trunkColor;
                ctx.fillRect(obj.trunkX, obj.trunkY, obj.trunkWidth, obj.trunkHeight);
                
                // 5. Draw the tree leaves
                ctx.fillStyle = obj.leavesColor;
                const radius = obj.leavesWidth / 4;
                
                ctx.beginPath();
                ctx.moveTo(obj.leavesX + radius, obj.leavesY);
                ctx.lineTo(obj.leavesX + obj.leavesWidth - radius, obj.leavesY);
                ctx.quadraticCurveTo(obj.leavesX + obj.leavesWidth, obj.leavesY, obj.leavesX + obj.leavesWidth, obj.leavesY + radius);
                ctx.lineTo(obj.leavesX + obj.leavesWidth, obj.leavesY + obj.leavesHeight - radius);
                ctx.quadraticCurveTo(obj.leavesX + obj.leavesWidth, obj.leavesY + obj.leavesHeight, obj.leavesX + obj.leavesWidth - radius, obj.leavesY + obj.leavesHeight);
                ctx.lineTo(obj.leavesX + radius, obj.leavesY + obj.leavesHeight);
                ctx.quadraticCurveTo(obj.leavesX, obj.leavesY + obj.leavesHeight, obj.leavesX, obj.leavesY + obj.leavesHeight - radius);
                ctx.lineTo(obj.leavesX, obj.leavesY + radius);
                ctx.quadraticCurveTo(obj.leavesX, obj.leavesY, obj.leavesX + radius, obj.leavesY);
                ctx.closePath();
                ctx.fill();
                
                // 6. Draw the leaves highlight
                ctx.fillStyle = obj.highlightColor;
                ctx.beginPath();
                ctx.ellipse(
                    obj.highlightX + obj.highlightWidth/2, 
                    obj.highlightY + obj.highlightHeight/2, 
                    obj.highlightWidth/2, 
                    obj.highlightHeight/2, 
                    0, 0, Math.PI * 2
                );
                ctx.fill();
                break;
                
            case 'tree_trunk':
            case 'tree_shadow':
            case 'tree_leaves':
            case 'tree_leaves_highlight':
                // Skip these cases as they're now handled by the 'tree' case
                // This is for backward compatibility with existing chunks
                break;
                
            case 'small_grass':
                // Draw small grass element with slight swaying animation
                ctx.fillStyle = obj.color;
                
                // Create a swaying effect based on time
                const swayAmount = Math.sin(Date.now() / 1000 + obj.x) * 2 * obj.variation;
                
                // Draw a simple grass blade shape
                ctx.beginPath();
                ctx.moveTo(obj.x, obj.y + obj.height); // Base left
                ctx.lineTo(obj.x + obj.width/2 + swayAmount, obj.y); // Tip
                ctx.lineTo(obj.x + obj.width, obj.y + obj.height); // Base right
                ctx.closePath();
                ctx.fill();
                break;
                
            case 'rock':
                ctx.fillStyle = obj.color;
                ctx.beginPath();
                ctx.ellipse(obj.x + obj.width/2, obj.y + obj.height/2, obj.width/2, obj.height/2, 0, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            case 'building':
                // Draw main building body
                ctx.fillStyle = obj.buildingColor;
                ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
                
                // Draw windows
                ctx.fillStyle = obj.windowColor;
                const windowSize = TILE_SIZE / 2;
                const windowSpacing = TILE_SIZE / 4;
                
                for (let floor = 0; floor < obj.floors; floor++) {
                    const floorY = obj.y + floor * TILE_SIZE + windowSpacing;
                    for (let wx = obj.x + windowSpacing; wx < obj.x + obj.width - windowSize; wx += TILE_SIZE) {
                        ctx.fillRect(wx, floorY, windowSize, windowSize);
                        
                        // Add window light effect during night
                        const elapsedTime = (Date.now() - gameStartTime) % DAY_NIGHT_CYCLE_DURATION;
                        const dayProgress = elapsedTime / DAY_NIGHT_CYCLE_DURATION;
                        const hours = Math.floor((dayProgress * 24 + 6) % 24);
                        
                        if (hours >= 18 || hours < 6) {
                            const gradient = ctx.createRadialGradient(
                                wx + windowSize/2, floorY + windowSize/2, 0,
                                wx + windowSize/2, floorY + windowSize/2, TILE_SIZE
                            );
                            gradient.addColorStop(0, 'rgba(255, 255, 200, 0.3)');
                            gradient.addColorStop(1, 'rgba(255, 255, 200, 0)');
                            ctx.fillStyle = gradient;
                            ctx.fillRect(wx - TILE_SIZE/2, floorY - TILE_SIZE/2, TILE_SIZE*2, TILE_SIZE*2);
                        }
                    }
                }
                
                // Draw door
                ctx.fillStyle = obj.doorColor;
                ctx.fillRect(
                    obj.x + obj.width/2 - TILE_SIZE/3,
                    obj.y + obj.height - TILE_SIZE,
                    TILE_SIZE*2/3,
                    TILE_SIZE
                );
                
                // Draw balcony if needed
                if (obj.hasBalcony) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                    ctx.fillRect(
                        obj.x - TILE_SIZE/4,
                        obj.y + TILE_SIZE,
                        obj.width + TILE_SIZE/2,
                        TILE_SIZE/4
                    );
                }
                break;
                
            case 'player':
                // Only draw the player if they haven't been rendered by a tree
                if (!playerRenderedByTree) {
                    // Get water color if player is on water
                    let waterColor = null;
                    if (obj.isOnWater) {
                        // Find the water tile the player is on to get its color
                        const chunkKey = getChunkKey(obj.x, obj.y);
                        const chunk = chunks.get(chunkKey);
                        if (chunk) {
                            const waterTile = chunk.find(tile => 
                                tile.type === 'water' && 
                                obj.x >= tile.x && 
                                obj.x < tile.x + TILE_SIZE && 
                                obj.y >= tile.y && 
                                obj.y < tile.y + TILE_SIZE
                            );
                            if (waterTile) {
                                waterColor = waterTile.color;
                            }
                        }
                        
                        // If no specific water tile found, use a default water color
                        if (!waterColor) {
                            waterColor = 'rgb(40, 130, 220)';
                        }
                    }
                    
                    // Draw player head (always above water)
                    ctx.fillStyle = obj.color;
                    ctx.fillRect(obj.x - TILE_SIZE/2, obj.y - TILE_SIZE, TILE_SIZE, TILE_SIZE);
                    
                    // Draw player eyes
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(obj.x - TILE_SIZE/3, obj.y - TILE_SIZE*0.8, TILE_SIZE/6, TILE_SIZE/6);
                    ctx.fillRect(obj.x + TILE_SIZE/6, obj.y - TILE_SIZE*0.8, TILE_SIZE/6, TILE_SIZE/6);
                    
                    // Draw player body
                    if (obj.isOnWater) {
                        // Draw top half of body with player color
                        ctx.fillStyle = obj.color;
                        ctx.fillRect(obj.x - TILE_SIZE/3, obj.y - TILE_SIZE/2, TILE_SIZE*2/3, TILE_SIZE/2);
                        
                        // Draw bottom half of body with water color (swimming effect)
                        ctx.fillStyle = waterColor;
                        ctx.fillRect(obj.x - TILE_SIZE/3, obj.y, TILE_SIZE*2/3, TILE_SIZE/2);
                    } else {
                        // Draw normal body when not in water
                        ctx.fillStyle = obj.color;
                        ctx.fillRect(obj.x - TILE_SIZE/3, obj.y - TILE_SIZE/2, TILE_SIZE*2/3, TILE_SIZE);
                    }
                }
                break;
        }
    }
    
    // Draw grid
    drawGrid();
    
    // Restore camera transform
    ctx.restore();
    
    // Apply day/night cycle overlay
    const cycleTime = (Date.now() - gameStartTime) % DAY_NIGHT_CYCLE_DURATION;
    const dayProgress = cycleTime / DAY_NIGHT_CYCLE_DURATION;
    const timeOfDay = (dayProgress * 24 + 6) % 24;
    
    // Calculate night intensity based on time of day
    let nightIntensity = 0;
    if (timeOfDay >= 18) {
        nightIntensity = (timeOfDay - 18) / 6; // Gradually get darker from 18:00 to 00:00
    } else if (timeOfDay < 5) {
        nightIntensity = 1; // Maximum darkness between 00:00 and 06:00
    } else if (timeOfDay < 11) {
        nightIntensity = 1 - ((timeOfDay - 5) / 5); // Gradually get lighter from 06:00 to 12:00
    }
    
    const overlayOpacity = Math.min(0.85, nightIntensity); // Max opacity 85%
    
    // Create a gradient mask for the player's light
    if (player && nightIntensity > 0) {
        // Create a circular gradient around the player
        const lightRadius = TILE_SIZE * 6; // Aumentado para uma área maior de iluminação
        const gradient = ctx.createRadialGradient(
            player.x - cameraX, player.y - cameraY, 0,
            player.x - cameraX, player.y - cameraY, lightRadius
        );
        
        // Ajusta o gradiente para uma transição mais suave
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)'); // Centro totalmente transparente
        gradient.addColorStop(0.1, `rgba(0, 0, 0, ${overlayOpacity * 0.2})`); // Transição suave inicial
        gradient.addColorStop(0.3, `rgba(0, 0, 0, ${overlayOpacity * 0.6})`); // Transição suave inicial
        gradient.addColorStop(0.5, `rgba(0, 0, 0, ${overlayOpacity * 0.8})`); // Meio termo
        gradient.addColorStop(1, `rgba(0, 0, 0, ${overlayOpacity})`); // Borda com opacidade total
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    } else {
        ctx.fillStyle = `${NIGHT_OVERLAY_COLOR}${Math.floor(overlayOpacity * 255).toString(16).padStart(2, '0')}`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
}

// Initialize the game when the window loads
window.addEventListener('load', init);