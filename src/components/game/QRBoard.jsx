import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Play, RotateCcw, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Trophy, Skull, FastForward, Heart, Volume2, VolumeX, Crosshair, Settings, X, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Constants
const GRID_SIZE = 21; // Standard QR V1 size
const TICK_RATE = 100; // Game loop speed (ms)
const ROTATION_INTERVAL = 7000; // 7 seconds
const ROTATION_INTERVAL_L4 = 7000; // 7 seconds (Same as others now)
const GLITCH_SPEED_L1 = 800;
const GLITCH_SPEED_L2 = 800; // Same as Level 1
const GLITCH_SPEED_L3 = 200; // Very fast for Level 3
const GLITCH_SPEED_L4 = 500; // Standard speed for Level 4

// Cell Types
const WALL = 1;
const PATH = 0;
const START = 2;
const END = 3;
const PLAYER = 4;
const GLITCH = 5;
const HEAL = 6;
const BINARY_0 = 7;
const BINARY_1 = 8;

const isFinderZone = (x, y) => {
  // Top Left (0-6, 0-6)
  if (x <= 6 && y <= 6) return true;
  // Top Right
  if (x >= GRID_SIZE - 7 && y <= 6) return true;
  // Bottom Left
  if (x <= 6 && y >= GRID_SIZE - 7) return true;
  return false;
};

const getReachableCells = (grid, startX, startY) => {
  const reachable = [];
  const queue = [{x: startX, y: startY}];
  const visited = new Set([`${startX},${startY}`]);

  while(queue.length > 0) {
      const {x, y} = queue.shift();
      // Store valid path candidates (excluding finder zones for end point placement safety)
      if (!isFinderZone(x, y)) {
          reachable.push({x, y});
      }

      [[0,1], [0,-1], [1,0], [-1,0]].forEach(([dx, dy]) => {
          let nx = x + dx;
          let ny = y + dy;

          // Boundary check (No wrapping)
          if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
              const key = `${nx},${ny}`;
              if (!visited.has(key) && grid[ny][nx] !== WALL) {
                  visited.add(key);
                  queue.push({x: nx, y: ny});
              }
          }
      });
  }
  return reachable;
};

// Utils
const generateQRGrid = () => {
  // Initialize with noise
  let grid = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(0));
  
  // Fill with random walls (density 0.3)
  for(let y=0; y<GRID_SIZE; y++) {
    for(let x=0; x<GRID_SIZE; x++) {
      if (Math.random() < 0.3) grid[y][x] = WALL;
    }
  }

  // Add Finder Patterns (The big squares in corners)
  const addFinder = (ox, oy) => {
    for(let y=0; y<7; y++) {
      for(let x=0; x<7; x++) {
        if (ox+x < GRID_SIZE && oy+y < GRID_SIZE) {
          if (y===0 || y===6 || x===0 || x===6 || (y>=2 && y<=4 && x>=2 && x<=4)) {
            grid[oy+y][ox+x] = WALL;
          } else {
            grid[oy+y][ox+x] = PATH;
          }
        }
      }
    }
  };

  addFinder(0, 0); // Top Left
  addFinder(GRID_SIZE-7, 0); // Top Right
  addFinder(0, GRID_SIZE-7); // Bottom Left

  // Ensure Path logic (Simple clear path algorithm)
  // We'll just clear a safe zone around start and end for now
  // Start is at (8, 8) to avoid finder, End is at (GRID-2, GRID-2)
  grid[8][8] = START;
  grid[GRID_SIZE-2][GRID_SIZE-2] = END;

  // Simple path carving (Random walk from start to end to ensure solvability)
  let cx = 8, cy = 8;
  const targetX = GRID_SIZE-2, targetY = GRID_SIZE-2;
  
  while(cx !== targetX || cy !== targetY) {
    grid[cy][cx] = PATH; // Clear wall
    if (Math.random() > 0.5 && cx !== targetX) {
      cx += (targetX > cx) ? 1 : -1;
    } else if (cy !== targetY) {
      cy += (targetY > cy) ? 1 : -1;
    }
  }

  return grid;
};

export default function QRBoard() {
  const [grid, setGrid] = useState([]);
  const [playerPos, setPlayerPos] = useState({ x: 8, y: 8 });
  const [rotation, setRotation] = useState(0);
  const [gameState, setGameState] = useState('menu'); // menu, playing, won, lost, level_complete
  const [glitchQueue, setGlitchQueue] = useState([]);
  const [score, setScore] = useState(0);
  const [countdown, setCountdown] = useState(6);
  const [level, setLevel] = useState(0);
  const [tutorialPhase, setTutorialPhase] = useState(0);
  const [rotationCount, setRotationCount] = useState(0);
  const [fluxState, setFluxState] = useState(null); // { dir: 'UP'|'DOWN'|'LEFT'|'RIGHT', index: 0 }
  const [lives, setLives] = useState(3);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [hasMoved, setHasMoved] = useState(false);
  const [projectiles, setProjectiles] = useState([]); // Player projectiles (unused)
  const [enemyProjectiles, setEnemyProjectiles] = useState([]); // Level 2 Enemy projectiles
  const [lastDir, setLastDir] = useState({ x: 0, y: -1 }); // Default facing up
  const [moveSpeed, setMoveSpeed] = useState(212); // ms per tick (Default slider 20)
  const [showSettings, setShowSettings] = useState(false);
  const [targetBinary, setTargetBinary] = useState("");
  const [currentBinary, setCurrentBinary] = useState("");
  const [userModifiedSpeed, setUserModifiedSpeed] = useState(false);
  const [damageFlash, setDamageFlash] = useState(false);
  const [joystick, setJoystick] = useState(null); // { startX, startY, currentX, currentY } for visual feedback

  // Continuous Movement State
  const [currentDir, setCurrentDir] = useState({ x: 0, y: 0 });
  const [nextDir, setNextDir] = useState({ x: 0, y: 0 });
  const [wrapCount, setWrapCount] = useState(0);
  
  const audioCtxRef = useRef(null);
  const touchStartRef = useRef(null);
  const lastTapRef = useRef(0); // For double tap detection
  
  // Input Refs for Zero-Latency Handling
  const nextDirRef = useRef({ x: 0, y: 0 });

  // Sync Refs with State (for resets/levels)
  useEffect(() => {
      nextDirRef.current = nextDir;
  }, [nextDir]);

  const latestStateRef = useRef({ grid, playerPos, lives, currentDir, nextDir });

  useEffect(() => {
    latestStateRef.current = { grid, playerPos, lives, fluxState, currentDir, nextDir };
  }, [grid, playerPos, lives, fluxState, currentDir, nextDir]);

  // Refs for intervals to clear them easily
  const gameLoopRef = useRef(null);
  const glitchLoopRef = useRef(null);
  const rotationLoopRef = useRef(null);

  // Rotation Logic - Centralized
  useEffect(() => {
    if (rotationLoopRef.current) clearInterval(rotationLoopRef.current);
    
    const isTutorial = level === 0;
    // Rotation active in normal levels OR in Tutorial Phase 1. DISABLED IN LEVEL 4.
    const activeRotation = (gameState === 'playing') && (!isTutorial || (isTutorial && tutorialPhase === 1)) && level !== 4 && level !== 5;

    if (activeRotation) {
        const intervalMs = level === 4 ? 4000 : ROTATION_INTERVAL; // Level 4 rotates every 4s
        const countStart = level === 4 ? 4 : 7;
        
        rotationLoopRef.current = setInterval(() => {
            setRotation(r => r + (Math.random() > 0.5 ? 90 : -90));
            setRotationCount(c => c + 1);
            setCountdown(countStart);
        }, intervalMs);
    }
    
    return () => {
         if (rotationLoopRef.current) clearInterval(rotationLoopRef.current);
    };
  }, [gameState, level, tutorialPhase]);

  const startLevel = (targetLevel, resetLives = false, startPhase = 0) => {
    const lvl = targetLevel !== undefined ? targetLevel : 0;
    setLevel(lvl);
    setTutorialPhase(startPhase);
    
    if (resetLives) setLives(3);

    if (lvl === 0) setHasMoved(false);

    // Adjust speed for Level 6 to be slower and more precise, unless user set it
    if (!userModifiedSpeed) {
        if (lvl === 6) setMoveSpeed(250); 
        else setMoveSpeed(212); // Default base speed (slider 20%)
    }

    const newGrid = generateQRGrid();
    let startP = { x: 8, y: 8 };
    let endP = { x: GRID_SIZE-2, y: GRID_SIZE-2 };

    // Level 3 & Tutorial Phase 2: Glitch spawns
    if (lvl === 0 && startPhase === 2) {
       newGrid[10][10] = GLITCH;
    }
    if (lvl === 3) {
       newGrid[10][3] = GLITCH;
       newGrid[10][17] = GLITCH;
       newGrid[3][10] = GLITCH; // Third infection point
    }

    // Helper to clear zones
    const clearZone = (cx, cy) => {
        for(let y=cy-1; y<=cy+1; y++) 
          for(let x=cx-1; x<=cx+1; x++) 
            if(x>=0 && x<GRID_SIZE && y>=0 && y<GRID_SIZE) newGrid[y][x] = PATH;
    };

    // Level 6: BINARY DECODE
    if (lvl === 6) {
        // Only override if user hasn't messed with settings, otherwise respect user speed (or force 50? decided to respect user intent primarily or default to 50 for L6 if not set)
        // Actually, L6 logic needs fast ticks. If user sets "Slow" (250ms), L6 will be laggy. 
        // But user asked for settings to work. 
        // Let's keep the user setting if modified.
        if (!userModifiedSpeed) setMoveSpeed(50); 

        // Generate random 8-bit binary string
        let bin = "";
        for(let i=0; i<8; i++) bin += Math.random() > 0.5 ? "1" : "0";
        setTargetBinary(bin);
        setCurrentBinary("");
        
        // Scatter 0s and 1s
        // High density: Fill 40% of PATHs with numbers
        for(let y=0; y<GRID_SIZE; y++) {
            for(let x=0; x<GRID_SIZE; x++) {
                if (newGrid[y][x] === PATH && !isFinderZone(x, y)) {
                    // Leave some paths clear (60% clear)
                    if (Math.random() < 0.4) {
                        newGrid[y][x] = Math.random() > 0.5 ? BINARY_1 : BINARY_0;
                    }
                }
            }
        }
        
        // Ensure start area is clear
        clearZone(startP.x, startP.y);
    }

    // Level 4 & 5: THE FLUX
    if (lvl === 4 || lvl === 5) {
        // 1. Pick Random Direction
        const dirs = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
        const dir = dirs[Math.floor(Math.random() * dirs.length)];
        
        // 2. Set Start/End based on Flux Direction
        // Flux starts at 'dir' side and moves opposite.
        // Player starts safe (opposite to flux origin? No, flux comes from one side, usually behind or side).
        // Let's say Flux comes from TOP (UP). It moves y=0 -> y=GRID.
        // Player should start near y=GRID (or middle) and Exit at y=GRID?
        // User said: "Exit must be on opposite side of flux".
        // So if Flux comes from TOP (Index 0->20), Exit is at BOTTOM. Player starts somewhere in between?
        // Or Player starts near Flux and runs? "Escape". Let's put Player near Flux start but safe, Exit at far end.
        
        if (dir === 'DOWN') { // Moves Top to Bottom (y=0 -> y=20)
            startP = { x: 10, y: 5 }; 
            endP = { x: 10, y: GRID_SIZE - 2 };
            setFluxState({ dir: 'DOWN', index: -1 }); // Start off-screen
        } else if (dir === 'UP') { // Moves Bottom to Top (y=20 -> y=0)
            startP = { x: 10, y: GRID_SIZE - 6 };
            endP = { x: 10, y: 1 };
            setFluxState({ dir: 'UP', index: GRID_SIZE });
        } else if (dir === 'RIGHT') { // Moves Left to Right (x=0 -> x=20)
            startP = { x: 5, y: 10 };
            endP = { x: GRID_SIZE - 2, y: 10 };
            setFluxState({ dir: 'RIGHT', index: -1 });
        } else { // LEFT (x=20 -> x=0)
            startP = { x: GRID_SIZE - 6, y: 10 };
            endP = { x: 1, y: 10 };
            setFluxState({ dir: 'LEFT', index: GRID_SIZE });
        }
        
        // Ensure only ONE exit exists
        // Clear default END from generateQRGrid
        newGrid[GRID_SIZE-2][GRID_SIZE-2] = PATH; 
        
        // Ensure Exit is reachable (clear walls around it)
        clearZone(endP.x, endP.y);

        // Complex Path Generation for L4/5

        // 1. Increase Wall Density for "Narrow Paths"
        for(let y=0; y<GRID_SIZE; y++) {
            for(let x=0; x<GRID_SIZE; x++) {
                if (!isFinderZone(x, y) && Math.random() < 0.6) { // 60% Walls
                    newGrid[y][x] = WALL;
                }
            }
        }

        // 2. Bunker around End Point (Surround with walls)
        for(let dy=-2; dy<=2; dy++) {
            for(let dx=-2; dx<=2; dx++) {
                const by = endP.y + dy;
                const bx = endP.x + dx;
                if (by >= 0 && by < GRID_SIZE && bx >= 0 && bx < GRID_SIZE) {
                    newGrid[by][bx] = WALL;
                }
            }
        }
        newGrid[endP.y][endP.x] = END; // Clear center

        // 3. Create a Single Entry Point to Bunker (PERPENDICULAR to Start to force a turn)
        // Calculate direction from End to Start
        const dxs = startP.x - endP.x;
        const dys = startP.y - endP.y;

        let entryX = endP.x;
        let entryY = endP.y;

        // If mainly Horizontal approach, open Vertically. If mainly Vertical, open Horizontally.
        // This guarantees a wall is "in front" of the approach.
        if (Math.abs(dxs) > Math.abs(dys)) {
             // Approach is Horizontal -> Open Top or Bottom
             const dirY = Math.random() > 0.5 ? 1 : -1;
             newGrid[endP.y + dirY][endP.x] = PATH;
             newGrid[endP.y + dirY*2][endP.x] = PATH;
             entryY += dirY*2;
        } else {
             // Approach is Vertical -> Open Left or Right
             const dirX = Math.random() > 0.5 ? 1 : -1;
             newGrid[endP.y][endP.x + dirX] = PATH;
             newGrid[endP.y][endP.x + dirX*2] = PATH;
             entryX += dirX*2;
        }

        // 4. Carve Path from Start to Bunker Entry
        // Use a "Drunken Walk" that biases towards target but wanders to create complexity
        let cx = startP.x, cy = startP.y;
        const tx = entryX, ty = entryY; // Target the entry, not the end directly

        let safety = 0;
        // Clear start area
        clearZone(cx, cy);

        while((cx !== tx || cy !== ty) && safety < 2000) {
            newGrid[cy][cx] = PATH; 

            // Decide next step
            const distX = tx - cx;
            const distY = ty - cy;

            let moveX = 0;
            let moveY = 0;

            // 70% chance to move towards target, 30% random deviation
            if (Math.random() < 0.7) {
                if (Math.abs(distX) > Math.abs(distY)) {
                    moveX = Math.sign(distX);
                } else {
                    moveY = Math.sign(distY);
                }
            } else {
                // Random move (valid)
                if (Math.random() < 0.5) moveX = Math.random() > 0.5 ? 1 : -1;
                else moveY = Math.random() > 0.5 ? 1 : -1;
            }

            // Check bounds
            const nx = cx + moveX;
            const ny = cy + moveY;

            if (nx >= 1 && nx < GRID_SIZE-1 && ny >= 1 && ny < GRID_SIZE-1) {
                cx = nx;
                cy = ny;
            }
            safety++;
        }
        // Ensure final connection
        newGrid[ty][tx] = PATH;

        // Spawn Extra Life (Level 4) - Close to player (within 5 tiles)
        let healPlaced = false;
        let attempts = 0;
        while (!healPlaced && attempts < 50) {
            const range = 5;
            const ox = Math.floor(Math.random() * (range * 2 + 1)) - range;
            const oy = Math.floor(Math.random() * (range * 2 + 1)) - range;
            const hx = startP.x + ox;
            const hy = startP.y + oy;
            
            if (hx >= 0 && hx < GRID_SIZE && hy >= 0 && hy < GRID_SIZE) {
                  // Ensure it's not on start or end, and is a PATH, and not too close (min 2 tiles)
                  const dist = Math.abs(ox) + Math.abs(oy);
                  if (dist > 1 && newGrid[hy][hx] === PATH) {
                      newGrid[hy][hx] = HEAL;
                      healPlaced = true;
                  }
            }
            attempts++;
        }
    } else {
        setFluxState(null);
    }

    setGrid(newGrid);
    setProjectiles([]); // Clear projectiles
    setEnemyProjectiles([]); // Clear enemy projectiles
    setPlayerPos(startP);
    // Reset Movement
    setCurrentDir({ x: 0, y: 0 });
    setNextDir({ x: 0, y: 0 });
    nextDirRef.current = { x: 0, y: 0 };

    setRotation(0);
    setGameState('playing');
    if (lvl <= 1) setScore(0);
    setGlitchQueue([{ x: 8, y: 8 }]); 
    setRotationCount(0);

    const isTutorial = lvl === 0;
    const intervalTime = (lvl === 4 || lvl === 5) ? ROTATION_INTERVAL_L4 : ROTATION_INTERVAL;
    const countdownStart = (lvl === 4 || lvl === 5 || lvl === 6) ? 5 : 7;

    setCountdown(isTutorial ? 0 : countdownStart);

    // Ensure initial Glitch is safe (not adjacent to start)
    if (lvl > 0 && lvl !== 4 && lvl !== 5 && lvl !== 6) {
        let hasGlitch = false;
        for(let y=0; y<GRID_SIZE; y++) for(let x=0; x<GRID_SIZE; x++) if(newGrid[y][x] === GLITCH) hasGlitch = true;
        
        if (!hasGlitch) {
            // Spawn random glitch far from start
            let placed = false;
            let attempts = 0;
            while(!placed && attempts < 100) {
                const rx = Math.floor(Math.random() * GRID_SIZE);
                const ry = Math.floor(Math.random() * GRID_SIZE);
                const dist = Math.abs(rx - startP.x) + Math.abs(ry - startP.y);
                // Ensure distance > 3 and not in finder zone
                if (newGrid[ry][rx] === PATH && !isFinderZone(rx, ry) && dist > 3) {
                    newGrid[ry][rx] = GLITCH;
                    placed = true;
                }
                attempts++;
            }
        }
    }

    // Start Rotation Timer - Managed by useEffect now
    if (rotationLoopRef.current) clearInterval(rotationLoopRef.current);
  };

  const startGame = () => startLevel(0, true);
  const nextLevel = () => startLevel(level + 1, level === 0); // Reset lives only if coming from tutorial
  const restartLevel = () => startLevel(level, false, (level === 0 && tutorialPhase === 2) ? 2 : 0);

  const playSound = useCallback((type) => {
    if (!audioEnabled) return;
    
    if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
    }

    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;

    if (type === 'move') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'collect') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.1);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
    } else if (type === 'shoot') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'win') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554, now + 0.1);
        osc.frequency.setValueAtTime(659, now + 0.2);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
    } else if (type === 'loss') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(50, now + 0.4);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
    }
  }, [audioEnabled]);

  // Shooting Logic (Disabled for now as L5/Flux is removed, but kept for future use if needed)
  const shoot = useCallback(() => {
    return; // Disabled feature
    /*
    if (level !== 5 || gameState !== 'playing') return;

    const { grid: currentGrid, playerPos: pPos } = latestStateRef.current;
    ... code kept for reference ...
    */
    
    // Auto-aim: Smart targeting
    let target = null;
    let bestScore = -Infinity;

    // Find Exit position first
    let endPos = null;
    for(let y=0; y<GRID_SIZE; y++) {
        for(let x=0; x<GRID_SIZE; x++) {
            if (currentGrid[y][x] === END) {
                endPos = {x, y};
                break;
            }
        }
    }

    // Vectors for prioritization
    const toEnd = endPos ? { x: endPos.x - pPos.x, y: endPos.y - pPos.y } : { x: 0, y: 0 };
    
    for(let y=0; y<GRID_SIZE; y++) {
        for(let x=0; x<GRID_SIZE; x++) {
            if (currentGrid[y][x] === GLITCH) {
                const dx = x - pPos.x;
                const dy = y - pPos.y;
                const dist = Math.abs(dx) + Math.abs(dy);
                
                // Score calculation:
                // 1. Base score: Closer is better (-dist)
                // 2. Direction Bonus: If glitch is in general direction of End (+bonus)
                
                let score = -dist;
                
                if (endPos) {
                    // Dot product to check alignment with path to exit
                    // Normalize roughly by just checking signs or simple dot
                    const dot = dx * toEnd.x + dy * toEnd.y;
                    if (dot > 0) {
                        score += 20; // Big bonus for being "in front" towards objective
                    }
                    
                    // Extra bonus if it's strictly blocking (between player and end in X or Y)
                    const isBetweenX = (pPos.x < x && x < endPos.x) || (pPos.x > x && x > endPos.x);
                    const isBetweenY = (pPos.y < y && y < endPos.y) || (pPos.y > y && y > endPos.y);
                    if (isBetweenX || isBetweenY) {
                         score += 10;
                    }
                }

                if (score > bestScore) {
                    bestScore = score;
                    target = {x, y};
                }
            }
        }
    }

    let nearest = target; // Use the best scored target

    let dir = { x: 0, y: -1 }; // Default Up if no targets
    
    if (nearest) {
        const dx = nearest.x - pPos.x;
        const dy = nearest.y - pPos.y;
        
        // Determine cardinal direction based on largest difference
        if (Math.abs(dx) > Math.abs(dy)) {
            dir = { x: Math.sign(dx), y: 0 };
        } else {
            dir = { x: 0, y: Math.sign(dy) };
        }
    } else {
        // Fallback to last facing direction if no enemies
        // If currentDir is 0,0 use lastDir, otherwise use currentDir
        if (currentDir.x !== 0 || currentDir.y !== 0) {
             dir = currentDir;
        } else {
             dir = lastDir; 
        }
    }

    setProjectiles(prev => [
        ...prev, 
        { x: pPos.x, y: pPos.y, dx: dir.x, dy: dir.y }
    ]);
    playSound('shoot');
    }, [level, gameState, lastDir, currentDir, playSound]);

  // Enemy AI Shooting (Levels 2+)
  useEffect(() => {
      if ((level < 2) || gameState !== 'playing') return;

      const performShot = () => {
          const { grid, playerPos, fluxState } = latestStateRef.current;

          let glitchCells = [];

          // LEVEL 6: CANNONS IN FINDER PATTERNS
          if (level === 6) {
              glitchCells.push({x: 3, y: 3});
              glitchCells.push({x: GRID_SIZE - 4, y: 3});
              glitchCells.push({x: 3, y: GRID_SIZE - 4});
          }
          // LEVEL 4/5 OPTIMIZED FINDER
          else if ((level === 4 || level === 5) && fluxState) {
              // Only shoot from the leading edge of flux
              const idx = fluxState.index;
              if (idx >= 0 && idx < GRID_SIZE) {
                  if (fluxState.dir === 'DOWN' || fluxState.dir === 'UP') {
                      for(let x=0; x<GRID_SIZE; x++) glitchCells.push({x, y: idx});
                  } else {
                      for(let y=0; y<GRID_SIZE; y++) glitchCells.push({x: idx, y});
                  }
              }
          } else {
              // L2/L3 Finder
              for(let y=0; y<GRID_SIZE; y++) {
                  for(let x=0; x<GRID_SIZE; x++) {
                      if (grid[y][x] === GLITCH) glitchCells.push({x, y});
                  }
              }
          }

          if (glitchCells.length === 0) return;

          // Pick shooters
          // Level 6: All cannons shoot
          const shooterCount = level === 6 ? 3 : ((level === 4 || level === 5) ? 2 : (2 + Math.floor(Math.random() * 2))); 
          const newProjectiles = [];

          for(let i=0; i<shooterCount; i++) {
              if (glitchCells.length === 0) break;
              
              let shooter;
              if (level === 6) {
                  // In level 6, iterate through all cannons if count is 3
                  if (i < glitchCells.length) shooter = glitchCells[i];
                  else break;
              } else {
                  const randIndex = Math.floor(Math.random() * glitchCells.length);
                  shooter = glitchCells[randIndex];
              }

              // Aiming Logic
              let targetX = playerPos.x;
              let targetY = playerPos.y;

              // Level 6: Imprecise aiming (aim near player)
              if (level === 6) {
                  // Less precise: Offset by -4 to +4 tiles
                  targetX += Math.floor(Math.random() * 9) - 4;
                  targetY += Math.floor(Math.random() * 9) - 4;
              }

              const dx = targetX - shooter.x;
              const dy = targetY - shooter.y;

              // Determine direction (Cardinal mostly)
              let dirX = 0;
              let dirY = 0;

              if (Math.abs(dx) > Math.abs(dy)) {
                  dirX = Math.sign(dx);
                  if (Math.abs(dy) > 2 && Math.random() > 0.7) dirY = Math.sign(dy);
              } else {
                  dirY = Math.sign(dy);
                  if (Math.abs(dx) > 2 && Math.random() > 0.7) dirX = Math.sign(dx);
              }

              if (dirX === 0 && dirY === 0) continue;

              newProjectiles.push({
                  x: shooter.x, 
                  y: shooter.y, 
                  dx: dirX, 
                  dy: dirY,
                  id: Date.now() + Math.random()
              });
          }

          if (newProjectiles.length > 0) {
              setEnemyProjectiles(prev => [...prev, ...newProjectiles]);
          }
      };

      // Fire immediately upon level start / playing state
      performShot();

      // Level 6: Slower fire rate (3500ms instead of 2000ms)
      const shootDelay = level === 6 ? 3500 : (level === 4 ? 1500 : (level === 5 ? 2500 : (level === 3 ? 3500 : 2500)));
      const shootInterval = setInterval(performShot, shootDelay);

      return () => clearInterval(shootInterval);
  }, [level, gameState]);

  // Enemy Projectile Movement Loop
  useEffect(() => {
    if (enemyProjectiles.length === 0 || gameState !== 'playing') return;

    const moveInterval = setInterval(() => {
        setEnemyProjectiles(prev => {
            const next = [];
            const { grid, playerPos, lives } = latestStateRef.current;
            let hitPlayer = false;
            
            prev.forEach(p => {
                if (hitPlayer) return; 

                // Move 0.5 tiles per tick for smoother animation? No, stick to grid for now but maybe faster ticks
                const nx = p.x + p.dx;
                const ny = p.y + p.dy;
                
                // Check Bounds
                if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) return;
                
                // Use Math.round to check the specific cell
                const cellX = Math.round(nx);
                const cellY = Math.round(ny);
                
                // Check Wall (Projectiles pass through walls in Level 2 & 3)
                // if (grid[cellY][cellX] === WALL) return; // Removed wall collision

                // Check Player Hit
                if (cellX === playerPos.x && cellY === playerPos.y) {
                    hitPlayer = true;
                    return; 
                }

                next.push({ ...p, x: nx, y: ny });
            });

            if (hitPlayer) {
                 playSound('loss');
                 clearInterval(rotationLoopRef.current);
                 if (lives > 1) {
                     setLives(l => l - 1);
                     setGameState('lost');
                 } else {
                     setLives(0);
                     setGameState('game_over');
                 }
                 return []; 
            }

            return next;
            });
            }, level === 6 ? 250 : 150); // Projectile speed (Level 6: Slower 250ms, Others: 150ms)

            return () => clearInterval(moveInterval);
            }, [enemyProjectiles.length, gameState, playSound, level]);

  // Projectile Loop (Player - Disabled)
  useEffect(() => {
      if (false || gameState !== 'playing' || projectiles.length === 0) return; // Disabled for now

      const interval = setInterval(() => {
          setProjectiles(prev => {
              const nextProjectiles = [];
              let gridChanged = false;
              // We need a copy of grid to modify if hits happen
              // Since this is inside interval, we should probably access ref or use functional update on grid too?
              // But setGrid(prev => ...) is async.
              // Let's rely on latestStateRef for reading grid, but we need to update it.
              
              // Actually, updating grid inside here might conflict with other updates.
              // Let's do a functional update on grid inside the projectile loop if hit detected.
              
              // Simplified: Calculate all hits first, then update grid once, then update projectiles.
              
              return prev.map(p => ({ ...p, x: p.x + p.dx, y: p.y + p.dy })).filter(p => {
                  // Check bounds
                  if (p.x < 0 || p.x >= GRID_SIZE || p.y < 0 || p.y >= GRID_SIZE) return false;
                  
                  // Check collision with Glitch using ref to get latest grid
                  const currentGrid = latestStateRef.current.grid;
                  if (currentGrid[p.y][p.x] === GLITCH) {
                      // HIT! 
                      // 1. Clear glitch on grid
                      setGrid(g => {
                          const newG = [...g];
                          newG[p.y] = [...newG[p.y]];
                          newG[p.y][p.x] = PATH; 
                          return newG;
                      });

                      // 2. Register Safe Zone for Flux (Tunnel Effect)
                      const currentFlux = fluxStateRef.current;
                      if (currentFlux) {
                          const fluxes = currentFlux.isDual ? currentFlux.fluxes : [currentFlux];
                          let updated = false;
                          const newFluxes = fluxes.map(f => {
                              const isVert = f.dir === 'UP' || f.dir === 'DOWN';
                              const coord = isVert ? p.x : p.y;
                              if (!f.safeZones.includes(coord)) {
                                  updated = true;
                                  return { ...f, safeZones: [...f.safeZones, coord] };
                              }
                              return f;
                          });

                          if (updated) {
                              const newFluxState = currentFlux.isDual 
                                  ? { ...currentFlux, fluxes: newFluxes } 
                                  : newFluxes[0];
                              fluxStateRef.current = newFluxState;
                              setFluxState(newFluxState);
                          }
                      }

                      return false; // Remove projectile
                  }
                  return true; // Keep projectile
              });
          });
      }, 50); // Fast projectiles

      return () => clearInterval(interval);
  }, [level, gameState, projectiles.length]);

  // Helper to rotate vector based on screen rotation
  const getRotatedDir = (dir, rot) => {
      // Deg to Rad
      const rad = (-rot * Math.PI) / 180; 
      const rx = Math.round(dir.x * Math.cos(rad) - dir.y * Math.sin(rad));
      const ry = Math.round(dir.x * Math.sin(rad) + dir.y * Math.cos(rad));
      return { x: rx, y: ry };
  };

  // Continuous Movement Loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const moveTick = () => {
        const { grid: currentGrid, playerPos: pPos } = latestStateRef.current;

        // Use Refs for instantaneous input reading
        let screenNextDir = nextDirRef.current;
        let screenCurrentDir = currentDir;

        // Convert Screen Direction to Grid Direction based on Rotation
        const rot = rotation % 360;
        
        // Controls are ALWAYS screen-relative now (Up is always Up on screen)
        let gridNextDir = getRotatedDir(screenNextDir, rot);
        let gridCurrentDir = getRotatedDir(screenCurrentDir, rot);

        // 1. Try to change direction to nextDir
        let activeGridDir = gridCurrentDir;
        
        if (screenNextDir.x !== 0 || screenNextDir.y !== 0) {
            let nextX = pPos.x + gridNextDir.x;
            let nextY = pPos.y + gridNextDir.y;

            // Handle Wrapping (Disabled for Level 4 & 5)
            let isOutOfBounds = false;
            if (level === 4 || level === 5) {
                if (nextX < 0 || nextX >= GRID_SIZE || nextY < 0 || nextY >= GRID_SIZE) {
                    isOutOfBounds = true;
                }
            } else {
                if (nextX < 0) nextX = GRID_SIZE - 1;
                if (nextX >= GRID_SIZE) nextX = 0;
                if (nextY < 0) nextY = GRID_SIZE - 1;
                if (nextY >= GRID_SIZE) nextY = 0;
            }

            if (!isOutOfBounds && currentGrid[nextY][nextX] !== WALL) {
                activeGridDir = gridNextDir;
                setCurrentDir(screenNextDir);
            }
        }

        // 2. Move in activeDir
        if (activeGridDir.x !== 0 || activeGridDir.y !== 0) {
            let targetX = pPos.x + activeGridDir.x;
            let targetY = pPos.y + activeGridDir.y;
            let wrapped = false;

            // Handle Wrapping (Disabled for Level 4 & 5)
            let isTargetOutOfBounds = false;
            if (level === 4 || level === 5) {
                if (targetX < 0 || targetX >= GRID_SIZE || targetY < 0 || targetY >= GRID_SIZE) {
                    isTargetOutOfBounds = true;
                }
            } else {
                if (targetX < 0) { targetX = GRID_SIZE - 1; wrapped = true; }
                if (targetX >= GRID_SIZE) { targetX = 0; wrapped = true; }
                if (targetY < 0) { targetY = GRID_SIZE - 1; wrapped = true; }
                if (targetY >= GRID_SIZE) { targetY = 0; wrapped = true; }
            }

            if (isTargetOutOfBounds) {
                 // Hit Screen Edge in L4/L5 -> Stop
                 setCurrentDir({x:0, y:0});
                 // No movement
                 return;
            }

            const cell = currentGrid[targetY][targetX];

            // Standard Movement Logic
            if (cell !== WALL) {
                
                // Level 6: Binary Logic
                if (level === 6) {
                    let moveSuccessful = false;
                    if (cell === BINARY_0 || cell === BINARY_1) {
                        const val = cell === BINARY_0 ? "0" : "1";
                        const expected = targetBinary[currentBinary.length];
                        
                        if (val === expected) {
                            // Correct!
                            const nextBin = currentBinary + val;
                            setCurrentBinary(nextBin);
                            playSound('collect'); 

                            setGrid(g => {
                                const ng = [...g];
                                ng[targetY] = [...ng[targetY]];
                                ng[targetY][targetX] = PATH;
                                return ng;
                            });

                            setPlayerPos({ x: targetX, y: targetY });
                            if (wrapped) setWrapCount(c => c + 1);
                            moveSuccessful = true;

                            if (nextBin === targetBinary) {
                                handleWin();
                            }
                        } else {
                            // Level 6 Wrong Bit: Silent Damage (No Game Stop unless 0 lives)
                            playSound('loss');
                            setDamageFlash(true);
                            setTimeout(() => setDamageFlash(false), 300);

                            setLives(prev => {
                                const newLives = prev - 1;
                                if (newLives <= 0) {
                                    setGameState('game_over');
                                    clearInterval(rotationLoopRef.current);
                                    return 0;
                                }
                                return newLives;
                            });
                            // Do not move
                        }
                        } else {
                        // Path/Empty
                        setPlayerPos({ x: targetX, y: targetY });
                        if (wrapped) setWrapCount(c => c + 1);
                        moveSuccessful = true;

                        if (cell === HEAL) {
                            if (lives < 3) {
                                setLives(l => Math.min(3, l + 1));
                                playSound('win');
                            }
                            setGrid(g => {
                                const ng = [...g];
                                ng[targetY] = [...ng[targetY]];
                                ng[targetY][targetX] = PATH;
                                return ng;
                            });
                        }
                    }

                    // DISCRETE MOVEMENT: Reset direction immediately to stop continuous movement
                    if (moveSuccessful || cell !== WALL) {
                        setCurrentDir({x:0, y:0});
                        setNextDir({x:0, y:0});
                        nextDirRef.current = {x:0, y:0};
                    }
                } else {
                    // Levels 0-5 Standard Logic
                    setPlayerPos({ x: targetX, y: targetY });
                    if (wrapped) setWrapCount(c => c + 1);
                    
                    if (cell === END) {
                        handleWin();
                        setCurrentDir({x:0, y:0}); 
                    }
                    if (cell === HEAL) {
                        if (lives < 3) {
                            setLives(l => Math.min(3, l + 1));
                            playSound('win');
                        }
                        setGrid(g => {
                            const ng = [...g];
                            ng[targetY] = [...ng[targetY]];
                            ng[targetY][targetX] = PATH;
                            return ng;
                        });
                    }
                    if (cell === GLITCH) {
                        handleLoss();
                        setCurrentDir({x:0, y:0}); 
                    }
                }

            } else {
                    // Hit a wall
                    // Stop? Or just stay pushing?
                    // Pacman logic: keep trying.
                    // But if we just stay here, we don't update pos.
                }
            }
    };

    const interval = setInterval(moveTick, moveSpeed); 
    return () => clearInterval(interval);
    }, [gameState, currentDir, nextDir, lives, playSound, moveSpeed]);

  // Input Handling (Keyboard)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Prevent default scrolling for arrows/space
      if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) {
        e.preventDefault();
      }

      if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'].includes(e.key)) {
        setHasMoved(true);
      }

      const updateDir = (newDir) => {
        setNextDir(newDir);
        nextDirRef.current = newDir;
    };

    switch(e.key) {
        case 'ArrowUp': case 'w': case 'W': updateDir({x: 0, y: -1}); break;
        case 'ArrowDown': case 's': case 'S': updateDir({x: 0, y: 1}); break;
        case 'ArrowLeft': case 'a': case 'A': updateDir({x: -1, y: 0}); break;
        case 'ArrowRight': case 'd': case 'D': updateDir({x: 1, y: 0}); break;
        case ' ': shoot(); break;
    }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shoot]);

  // Input Handling (Virtual Joystick)
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    const start = { x: touch.clientX, y: touch.clientY };

    touchStartRef.current = start;
    setJoystick({ startX: start.x, startY: start.y, currentX: start.x, currentY: start.y });

    // Double tap detection
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
        shoot();
    }
    lastTapRef.current = now;
  };

  const handleTouchMove = (e) => {
      if (!touchStartRef.current) return;
      const touch = e.touches[0];
      const current = { x: touch.clientX, y: touch.clientY };

      // Update Visuals
      setJoystick(prev => prev ? ({ ...prev, currentX: current.x, currentY: current.y }) : null);

      const dx = current.x - touchStartRef.current.x;
      const dy = current.y - touchStartRef.current.y;

      // Threshold before registering direction (prevents jitter at center)
      const threshold = 15; 

      if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
          setHasMoved(true);

          let candidateDir = { x: 0, y: 0 };
          // Determine major axis
          if (Math.abs(dx) > Math.abs(dy)) {
              candidateDir = { x: dx > 0 ? 1 : -1, y: 0 };
          } else {
              candidateDir = { x: 0, y: dy > 0 ? 1 : -1 };
          }

          // Direct update - The Joystick logic is "absolute" relative to start
          // No need for complex filtering, the user is holding the direction they want
          setNextDir(candidateDir);
          nextDirRef.current = candidateDir;
      }
  };

  const handleTouchEnd = (e) => {
    touchStartRef.current = null;
    setJoystick(null);
  };

  // Glitch Mechanics
  useEffect(() => {
    if (gameState !== 'playing') return;
    if (level === 0 && tutorialPhase < 2) return; // Disable glitch in early tutorial

    const expandGlitch = () => {
      const { grid, playerPos } = latestStateRef.current;
      
      // LEVEL 4/5 FLUX LOGIC
      if (level === 4 || level === 5) {
          setFluxState(prev => {
              if (!prev) return null;
              const newGrid = [...grid.map(r => [...r])];
              let newIndex = prev.index;
              
              if (prev.dir === 'DOWN') { // Moving Top to Bottom
                 newIndex++;
                 if (newIndex < GRID_SIZE) {
                     for(let x=0; x<GRID_SIZE; x++) newGrid[newIndex][x] = GLITCH;
                 }
              } else if (prev.dir === 'UP') { // Bottom to Top
                 newIndex--;
                 if (newIndex >= 0) {
                     for(let x=0; x<GRID_SIZE; x++) newGrid[newIndex][x] = GLITCH;
                 }
              } else if (prev.dir === 'RIGHT') { // Left to Right
                 newIndex++;
                 if (newIndex < GRID_SIZE) {
                     for(let y=0; y<GRID_SIZE; y++) newGrid[y][newIndex] = GLITCH;
                 }
              } else if (prev.dir === 'LEFT') { // Right to Left
                 newIndex--;
                 if (newIndex >= 0) {
                     for(let y=0; y<GRID_SIZE; y++) newGrid[y][newIndex] = GLITCH;
                 }
              }
              
              // Check Player Collision with Flux
              if (newGrid[playerPos.y][playerPos.x] === GLITCH) {
                  handleLoss();
              }
              
              setGrid(newGrid);
              return { ...prev, index: newIndex };
          });
          return;
      }

      // STANDARD GLITCH LOGIC (L1-L3)
      const glitches = [];
      for(let y=0; y<GRID_SIZE; y++) {
        for(let x=0; x<GRID_SIZE; x++) {
          if (grid[y][x] === GLITCH) glitches.push({x, y});
        }
      }
      
      const candidates = [];
      glitches.forEach(g => {
        [[0,1], [0,-1], [1,0], [-1,0]].forEach(([dx, dy]) => {
          const nx = g.x + dx;
          const ny = g.y + dy;
          if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
            // Glitch now consumes WALLS too
            if ((grid[ny][nx] === PATH || grid[ny][nx] === START || grid[ny][nx] === WALL) && !isFinderZone(nx, ny)) {
              candidates.push({x: nx, y: ny});
            }
          }
        });
      });

      if (candidates.length > 0) {
        const target = candidates[Math.floor(Math.random() * candidates.length)];
        const newGrid = [...grid];
        newGrid[target.y] = [...newGrid[target.y]];
        newGrid[target.y][target.x] = GLITCH;
        setGrid(newGrid);

        if (target.x === playerPos.x && target.y === playerPos.y) handleLoss();
      }
    };

    // Adjusted speeds to match faster player
    const speed = level === 4 ? 500 : (level === 5 ? 700 : (level === 0 ? 900 : (level === 1 ? 700 : (level === 3 ? 180 : 700))));
    const interval = setInterval(expandGlitch, speed);
    return () => clearInterval(interval);
    }, [gameState, level, tutorialPhase]);

  // Countdown Timer
  useEffect(() => {
    if (gameState !== 'playing') return;
    const interval = setInterval(() => {
        setCountdown(c => Math.max(0, c - 0.1)); // Update visually faster
    }, 100);
    return () => clearInterval(interval);
  }, [gameState]);

  // Level 6: Bit Flip on Rotation
  useEffect(() => {
      if (level === 6 && gameState === 'playing') {
          setGrid(prev => {
              const newG = prev.map(row => row.map(cell => {
                  if (cell === BINARY_0) return BINARY_1;
                  if (cell === BINARY_1) return BINARY_0;
                  return cell;
              }));
              return newG;
          });
      }
  }, [rotation, level, gameState]);

  // Level 5: Moving Walls (Level 6 removed from here)
  useEffect(() => {
    if (level !== 5 || gameState !== 'playing') return;

    const interval = setInterval(() => {
        const { grid: currentGrid, playerPos: currentPlayerPos } = latestStateRef.current;
        let newGrid = currentGrid.map(row => [...row]);
        let newPlayerPos = { ...currentPlayerPos };
        let playerCrushed = false;

        if (level === 5) {
            // Level 5: Dynamic Reconstruction (Shift Walls but keep Path)

            // 1. Find End Position
            let endP = null;
            for(let y=0; y<GRID_SIZE; y++) {
                for(let x=0; x<GRID_SIZE; x++) {
                    if (newGrid[y][x] === END) endP = {x, y};
                }
            }

            if (endP) {
                // 2. High Density Noise (60% Walls)
                for(let y=0; y<GRID_SIZE; y++) {
                    for(let x=0; x<GRID_SIZE; x++) {
                        if (!isFinderZone(x, y)) {
                            // Preserve End, Start (if relevant), Player, Glitch, etc?
                            // Actually just overwrite WALL/PATH. Keep special entities?
                            // For simplicity, we overwrite everything that isn't a special marker, 
                            // but we need to keep END.
                            const cell = newGrid[y][x];
                            if (cell !== END && cell !== PLAYER && cell !== GLITCH && cell !== HEAL) {
                                newGrid[y][x] = Math.random() < 0.6 ? WALL : PATH;
                            }
                        }
                    }
                }

                // 3. Re-Bunker around End
                for(let dy=-2; dy<=2; dy++) {
                    for(let dx=-2; dx<=2; dx++) {
                        const by = endP.y + dy;
                        const bx = endP.x + dx;
                        if (by >= 0 && by < GRID_SIZE && bx >= 0 && bx < GRID_SIZE && newGrid[by][bx] !== END) {
                            newGrid[by][bx] = WALL;
                        }
                    }
                }

                // 4. Create Bunker Entry (PERPENDICULAR / BLOCKED DIRECT APPROACH)
                const dxs = currentPlayerPos.x - endP.x;
                const dys = currentPlayerPos.y - endP.y;
                let entryX = endP.x;
                let entryY = endP.y;

                // Force entry to be on the side NOT facing the player directly
                if (Math.abs(dxs) > Math.abs(dys)) {
                     // Horizontal relation -> Open Vertically
                     const dirY = Math.random() > 0.5 ? 1 : -1;
                     newGrid[endP.y + dirY][endP.x] = PATH;
                     newGrid[endP.y + dirY*2][endP.x] = PATH;
                     entryY += dirY*2;
                } else {
                     // Vertical relation -> Open Horizontally
                     const dirX = Math.random() > 0.5 ? 1 : -1;
                     newGrid[endP.y][endP.x + dirX] = PATH;
                     newGrid[endP.y][endP.x + dirX*2] = PATH;
                     entryX += dirX*2;
                }

                // 5. Carve Path from Player to Bunker Entry
                let cx = currentPlayerPos.x, cy = currentPlayerPos.y;
                const tx = entryX, ty = entryY;
                let safety = 0;

                // Ensure immediate player area is clear
                const pOffsets = [[0,0], [0,1], [0,-1], [1,0], [-1,0]];
                pOffsets.forEach(([dx, dy]) => {
                    const py = cy + dy;
                    const px = cx + dx;
                    if(py >= 0 && py < GRID_SIZE && px >= 0 && px < GRID_SIZE && newGrid[py][px] === WALL) {
                        newGrid[py][px] = PATH;
                    }
                });

                while((cx !== tx || cy !== ty) && safety < 2000) {
                    newGrid[cy][cx] = PATH; 

                    const distX = tx - cx;
                    const distY = ty - cy;
                    let moveX = 0;
                    let moveY = 0;

                    // High bias towards target (80%) to make path "tight" and direct but winding
                    if (Math.random() < 0.8) {
                        if (Math.abs(distX) > Math.abs(distY)) moveX = Math.sign(distX);
                        else moveY = Math.sign(distY);
                    } else {
                        if (Math.random() < 0.5) moveX = Math.random() > 0.5 ? 1 : -1;
                        else moveY = Math.random() > 0.5 ? 1 : -1;
                    }

                    const nx = cx + moveX;
                    const ny = cy + moveY;

                    if (nx >= 1 && nx < GRID_SIZE-1 && ny >= 1 && ny < GRID_SIZE-1) {
                        cx = nx;
                        cy = ny;
                    }
                    safety++;
                }
                newGrid[ty][tx] = PATH; // Ensure connection
            }

            setGrid(newGrid);
        }
    }, 2200);

    return () => clearInterval(interval);
  }, [level, gameState]);

  // Move Exit Logic
  useEffect(() => {
      // Level 6: Exit is fixed in finder pattern, no moving logic needed here.
      if (level === 6) return;
      // Level 6: Update Exit to always be at "Screen Top" when rotation changes
      if (level === 6) {
          const rot = ((rotation % 360) + 360) % 360;
          let targetX = -1, targetY = -1;

          // Determine "Top" edge based on rotation
          if (rot === 0) { targetX = 10; targetY = 1; } // Top Edge
          else if (rot === 90) { targetX = 1; targetY = 10; } // Left Edge (Visual Top)
          else if (rot === 180) { targetX = 10; targetY = GRID_SIZE - 2; } // Bottom Edge (Visual Top)
          else if (rot === 270) { targetX = GRID_SIZE - 2; targetY = 10; } // Right Edge (Visual Top)

          // Relocate End if needed
          if (targetX !== -1) {
              setGrid(prev => {
                  const newG = prev.map(r => [...r]);
                  // Find and remove old END
                  for(let y=0; y<GRID_SIZE; y++) for(let x=0; x<GRID_SIZE; x++) if(newG[y][x] === END) newG[y][x] = PATH;
                  
                  // Place new END (if not blocking player)
                  const { playerPos } = latestStateRef.current;
                  if (playerPos.x !== targetX || playerPos.y !== targetY) {
                      newG[targetY][targetX] = END;
                      // Ensure it's not a wall
                      // And maybe clear neighbors to ensure reachability
                  }
                  return newG;
              });
          }
          return;
      }

      if (level !== 4 && level !== 5 && level !== 6 && rotationCount > 0 && rotationCount % 2 === 0) { 
          // Use BFS to find reachable cells from player
          const reachableCells = getReachableCells(grid, playerPos.x, playerPos.y);

          // Filter only empty PATH cells
          const validCells = reachableCells.filter(p => 
              grid[p.y][p.x] === PATH && 
              (p.x !== playerPos.x || p.y !== playerPos.y)
          );

          if (validCells.length > 0) {
              const newGrid = [...grid.map(row => [...row])];
              // Remove old END
              for(let y=0; y<GRID_SIZE; y++) {
                  for(let x=0; x<GRID_SIZE; x++) {
                      if (newGrid[y][x] === END) newGrid[y][x] = PATH;
                  }
              }
              // Set new END
              const target = validCells[Math.floor(Math.random() * validCells.length)];
              newGrid[target.y][target.x] = END;
              setGrid(newGrid);
          }
      }
  }, [rotationCount, rotation, level]);


  // Heal Respawn Logic (L4, L5, L6)
  useEffect(() => {
      if ((level !== 4 && level !== 5 && level !== 6) || gameState !== 'playing') return;
      
      const checkForHeal = () => {
          let hasHeal = false;
          let endPos = null;
          
          const currentGrid = latestStateRef.current.grid;
          for(let y=0; y<GRID_SIZE; y++) {
              for(let x=0; x<GRID_SIZE; x++) {
                  if (currentGrid[y][x] === HEAL) hasHeal = true;
                  if (currentGrid[y][x] === END) endPos = {x, y};
              }
          }
          
          // In Level 6, we spawn heal randomly on map if missing. In L4/5, near End.
          if (!hasHeal) {
              setGrid(prev => {
                  const newG = prev.map(r => [...r]);
                  let placed = false;
                  let attempts = 0;
                  
                  while(!placed && attempts < 50) {
                      let tx, ty;
                      
                      if (level === 6) {
                          // Close to player (within 5 tiles) for easier pickup
                          const pPos = latestStateRef.current.playerPos;
                          const range = 5;
                          const rx = Math.floor(Math.random() * (range * 2 + 1)) - range;
                          const ry = Math.floor(Math.random() * (range * 2 + 1)) - range;
                          tx = pPos.x + rx;
                          ty = pPos.y + ry;
                      } else if (endPos) {
                          // Near end logic for L4/5
                          const rx = Math.floor(Math.random() * 9) - 4; 
                          const ry = Math.floor(Math.random() * 9) - 4;
                          tx = endPos.x + rx;
                          ty = endPos.y + ry;
                      } else {
                          break; // No end pos for L4/5?
                      }
                      
                      if(tx >= 0 && tx < GRID_SIZE && ty >= 0 && ty < GRID_SIZE) {
                           const pPos = latestStateRef.current.playerPos;
                           const cell = newG[ty][tx];
                           
                           // Don't spawn on player or too close
                           const dist = Math.abs(tx - pPos.x) + Math.abs(ty - pPos.y);
                           
                           if(cell === PATH && dist > 3 && !isFinderZone(tx, ty)) {
                               newG[ty][tx] = HEAL;
                               placed = true;
                           }
                      }
                      attempts++;
                  }
                  return newG;
              });
          }
      };

      const interval = setInterval(checkForHeal, 2000); // Check every 2s
      return () => clearInterval(interval);
  }, [level, gameState]);

  const handleWin = () => {
    if (level === 0) {
      const relocateEnd = (currentGrid) => {
          // BFS for reachable cells
          const reachableCells = getReachableCells(currentGrid, playerPos.x, playerPos.y);
          const validCells = reachableCells.filter(p => 
            currentGrid[p.y][p.x] === PATH && 
            (p.x !== playerPos.x || p.y !== playerPos.y)
          );

          if (validCells.length > 0) {
              const newGrid = [...currentGrid.map(row => [...row])];
              for(let y=0; y<GRID_SIZE; y++) for(let x=0; x<GRID_SIZE; x++) if(newGrid[y][x] === END) newGrid[y][x] = PATH;
              const target = validCells[Math.floor(Math.random() * validCells.length)];
              newGrid[target.y][target.x] = END;
              return newGrid;
          }
          return currentGrid;
      };

      if (tutorialPhase === 0) {
        setTutorialPhase(1);
        setCountdown(7); // Start countdown for the rotation phase
        setGrid(prev => relocateEnd(prev));
        return;
      } else if (tutorialPhase === 1) {
        setTutorialPhase(2);
        setRotation(0); // Reset rotation for glitch phase
        const gridWithEndMoved = relocateEnd(grid);
        const gridWithGlitch = [...gridWithEndMoved.map(row => [...row])];
        gridWithGlitch[10][10] = GLITCH; // Spawn glitch in center
        setGrid(gridWithGlitch);
        return;
      }
    }

    playSound('win');
    clearInterval(rotationLoopRef.current);
    if (level < 6 || level === 0) {
      setGameState('level_complete');
    } else {
      setGameState('won');
    }
  };

  const handleLoss = () => {
    playSound('loss');
    clearInterval(rotationLoopRef.current);
    if (level === 0) {
        // Infinite lives in tutorial
        setGameState('lost');
    } else {
        if (lives > 1) {
            setLives(l => l - 1);
            setGameState('lost');
        } else {
            setLives(0);
            setGameState('game_over');
        }
    }
  };

  // Render Helper
  const getCellColor = (type, x, y) => {
    // Player is handled by motion.div overlay now
    if (x === playerPos.x && y === playerPos.y) return 'bg-transparent'; 
    if (type === WALL) return 'bg-black';
    if (type === START) return 'bg-neutral-800';
    if (type === END) return 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)] animate-pulse';
    if (type === GLITCH) return 'bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]';
    if (type === HEAL) return 'bg-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.4)]';
    if (type === BINARY_0 || type === BINARY_1) return 'bg-white flex items-center justify-center'; // Container for text
    return 'bg-white';
    };

  if (gameState === 'menu') {
    return (
      <div className="text-center space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="relative inline-block">
            <div className="w-48 h-48 bg-white p-2 mx-auto grid grid-cols-4 grid-rows-4 gap-1">
                {Array(16).fill(0).map((_,i) => (
                    <div key={i} className={`w-full h-full ${Math.random() > 0.5 ? 'bg-black' : 'bg-transparent'}`} />
                ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
                <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600 tracking-tighter drop-shadow-sm bg-neutral-900/80 backdrop-blur-sm p-4 rounded-xl border border-white/20">
                    QueRy
                </h1>
            </div>
        </div>

        <div className="space-y-4 max-w-md mx-auto text-neutral-400 text-sm font-mono">
            <p className="flex items-center justify-center gap-2">
                <ArrowUp className="w-4 h-4" /> <span className="text-cyan-400">WASD / SWIPE</span> per muoverti
            </p>
            <p>Obiettivo: Raggiungi la zona <span className="text-green-500 font-bold">VERDE</span>.</p>
            <p>Attenzione: Evita il <span className="text-red-500 font-bold">GLITCH ROSSO</span>.</p>
            <p>Info: Il mondo ruota ogni 7 secondi.</p>
        </div>

        <div className="flex flex-col gap-4 items-center">
            <Button 
                onClick={() => startLevel(1, true)} 
                className="bg-white text-black hover:bg-cyan-400 hover:text-black font-bold px-12 py-6 text-xl rounded-none border-2 border-transparent hover:border-white transition-all w-64"
            >
                <Play className="w-5 h-5 mr-2" /> INIZIA GIOCO
            </Button>

            <Button 
                onClick={() => startLevel(0, true)} 
                className="bg-transparent text-neutral-500 hover:text-white border border-neutral-800 hover:border-white px-8 py-4 text-sm font-mono transition-all w-48"
            >
                <Play className="w-4 h-4 mr-2" /> TUTORIAL
            </Button>

            <Button 
                onClick={() => setShowSettings(true)} 
                className="bg-transparent text-neutral-500 hover:text-white border border-neutral-800 hover:border-white px-8 py-4 text-sm font-mono transition-all w-48"
            >
                <Settings className="w-4 h-4 mr-2" /> IMPOSTAZIONI
            </Button>

            {/* 
            <Button 
                onClick={() => startLevel(6, true)} 
                className="bg-transparent text-neutral-600 hover:text-white border border-neutral-800 hover:border-white px-4 py-2 text-xs font-mono transition-all opacity-50 hover:opacity-100"
            >
                DEBUG: LVL 6
            </Button> 
            */}
        </div>

        {/* Settings Modal */}
        <AnimatePresence>
            {showSettings && (
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
                >
                    <div className="bg-neutral-900 border border-neutral-700 p-8 rounded-xl max-w-sm w-full space-y-8 relative">
                        <button 
                            onClick={() => setShowSettings(false)}
                            className="absolute top-4 right-4 text-neutral-500 hover:text-white"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        
                        <h2 className="text-2xl font-bold text-white text-center flex items-center justify-center gap-2">
                            <Settings className="w-6 h-6" /> IMPOSTAZIONI
                        </h2>

                        {/* Audio Toggle */}
                        <div className="space-y-2">
                            <label className="text-neutral-400 text-sm font-mono uppercase tracking-widest block text-center">Audio</label>
                            <div className="flex justify-center">
                                <Button 
                                    onClick={() => setAudioEnabled(!audioEnabled)}
                                    variant={audioEnabled ? "default" : "outline"}
                                    className={`w-full ${audioEnabled ? 'bg-cyan-500 hover:bg-cyan-600 text-black' : 'border-neutral-600 text-neutral-400'}`}
                                >
                                    {audioEnabled ? <Volume2 className="w-5 h-5 mr-2" /> : <VolumeX className="w-5 h-5 mr-2" />}
                                    {audioEnabled ? "ABILITATO" : "DISABILITATO"}
                                </Button>
                            </div>
                        </div>

                        {/* Speed Slider */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-neutral-400 text-sm font-mono uppercase tracking-widest">
                                <span>Velocità Giocatore</span>
                                <span className="text-cyan-400 font-bold">
                                    {Math.round((250 - moveSpeed) / (250 - 60) * 100)}%
                                </span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="100" 
                                step="5"
                                value={(250 - moveSpeed) / (250 - 60) * 100}
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    const ms = 250 - (val / 100) * (250 - 60);
                                    setMoveSpeed(ms);
                                    setUserModifiedSpeed(true);
                                }}
                                className="w-full accent-cyan-400 h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-xs text-neutral-600 font-mono">
                                <span>LENTO</span>
                                <span>VELOCE</span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center gap-8 w-full max-w-xl mx-auto">
        
        {/* HUD */}
        <div className="w-full flex flex-col gap-2 mb-4">
          <div className="w-full flex justify-between items-center px-4 font-mono text-sm uppercase tracking-widest text-neutral-500">
              <div className="flex items-center gap-4">
                  {level > 0 && (
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${countdown < 2 ? 'bg-red-500 animate-ping' : 'bg-cyan-500'}`} />
                        <span>{Math.ceil(countdown)}s</span>
                    </div>
                  )}
                  <div className="text-neutral-400 min-w-[4ch]">
                      {((rotation % 360) + 360) % 360}°
                  </div>
              </div>
              <div className="flex items-center gap-4">
                  <div className="text-neutral-300">LIV {level}</div>
                  <div className="flex items-center gap-1">
                      {Array(3).fill(0).map((_, i) => (
                          <Heart 
                              key={i} 
                              className={`w-4 h-4 ${i < lives ? 'fill-red-500 text-red-500' : 'text-neutral-800'}`} 
                          />
                      ))}
                  </div>
                  <button 
                      onClick={() => setAudioEnabled(!audioEnabled)}
                      className="ml-2 text-neutral-500 hover:text-white transition-colors"
                  >
                      {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                      </button>
                      <button 
                      onClick={() => setGameState('menu')}
                      className="ml-2 text-neutral-500 hover:text-white transition-colors"
                      title="Menu Principale"
                      >
                      <Home className="w-4 h-4" />
                      </button>
                      </div>
                      </div>

          {/* Level 0-5 HUD: Minimalist again */}
          {level === 0 && gameState === 'playing' && (
            <div className="text-center font-bold text-cyan-400 px-4 text-xs sm:text-sm font-mono tracking-wide">
              {tutorialPhase === 0 && "[TUTORIAL] RAGGIUNGI LA ZONA VERDE"}
              {tutorialPhase === 1 && "[INFO] IL MONDO RUOTA OGNI 7 SECONDI"}
              {tutorialPhase === 2 && "[PERICOLO] EVITA IL GLITCH ROSSO"}
            </div>
          )}
          {level === 2 && gameState === 'playing' && (
             <div className="text-center font-bold text-orange-400 animate-pulse px-4 text-xs sm:text-sm font-mono tracking-wide">
                ⚠️ TORRETTE ATTIVE - SCHIVA I PROIETTILI
             </div>
          )}
          {level === 4 && gameState === 'playing' && (
             <div className="text-center font-bold text-purple-400 animate-pulse px-4 text-xs sm:text-sm font-mono tracking-wide">
                ⚠️ ONDA DI FLUSSO IN ARRIVO
             </div>
          )}
          {level === 5 && gameState === 'playing' && (
             <div className="text-center font-bold text-red-500 animate-pulse px-4 text-xs sm:text-sm font-mono tracking-wide">
                ⚠️ INSTABILITÀ CRITICA - MURI MOBILI
             </div>
          )}

          {/* Level 6: Binary Decode - Removed from Top HUD */}
          </div>

          {/* Game Container */}
          <div 
          className="relative p-4 border-2 border-neutral-800 bg-neutral-900 rounded-xl shadow-2xl overflow-hidden group touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          >
            {/* Damage Flash Overlay */}
            <AnimatePresence>
                {damageFlash && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-red-500/30 z-50 pointer-events-none"
                    />
                )}
            </AnimatePresence>

            {/* Virtual Joystick Overlay (Fixed to Screen) */}
            {joystick && (
                <div className="fixed inset-0 z-[100] pointer-events-none">
                    {/* Joystick Base */}
                    <div 
                        className="absolute w-32 h-32 rounded-full border-2 border-cyan-500/20 bg-cyan-900/20 backdrop-blur-[2px] -translate-x-1/2 -translate-y-1/2"
                        style={{ left: joystick.startX, top: joystick.startY }}
                    />
                    {/* Joystick Knob */}
                    <div 
                        className="absolute w-12 h-12 rounded-full bg-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,0.5)] -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
                        style={{ 
                            left: joystick.startX, 
                            top: joystick.startY,
                            transform: `translate(${Math.max(-50, Math.min(50, joystick.currentX - joystick.startX))}px, ${Math.max(-50, Math.min(50, joystick.currentY - joystick.startY))}px) translate(-50%, -50%)`
                        }}
                    />
                </div>
            )}

            {/* Rotation Wrapper */}
            <motion.div 
                animate={{ rotate: rotation }}
                transition={{ type: "spring", stiffness: 60, damping: 15 }}
                className="bg-white p-2 rounded-sm" // White border around QR
            >
                <div 
                    className="grid gap-[1px] bg-neutral-200"
                    style={{ 
                        gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
                        width: 'min(94vw, 550px)',
                        height: 'min(94vw, 550px)',
                    }}
                >
                    {grid.map((row, y) => (
                        row.map((cell, x) => (
                            <div 
                                key={`${x}-${y}`}
                                className={`w-full h-full relative ${getCellColor(cell, x, y)} transition-colors duration-300`}
                            >
                                {/* Player (Animated) */}
                                {x === playerPos.x && y === playerPos.y && (
                                    <motion.div 
                                      layoutId={`player-${wrapCount}`}
                                      // Linear interpolation matching the exact speed for fluid continuous movement
                                      transition={{ 
                                          type: "tween", 
                                          ease: "linear", 
                                          duration: moveSpeed / 1000 
                                      }} 
                                      className="absolute inset-0 flex items-center justify-center bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)] z-10"
                                    >
                                        <div className="w-[60%] h-[20%] bg-black/50" />
                                        {level === 0 && !hasMoved && (
                                            <>
                                                <ArrowUp className="absolute -top-12 w-8 h-8 text-cyan-400 animate-bounce" />
                                                <ArrowDown className="absolute -bottom-12 w-8 h-8 text-cyan-400 animate-bounce" />
                                                <ArrowLeft className="absolute -left-12 w-8 h-8 text-cyan-400 animate-bounce" />
                                                <ArrowRight className="absolute -right-12 w-8 h-8 text-cyan-400 animate-bounce" />
                                            </>
                                        )}
                                    </motion.div>
                                )}
                                {/* Heal Icon */}
                                {cell === HEAL && (
                                    <div className="absolute inset-0 flex items-center justify-center animate-bounce">
                                        <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                                    </div>
                                )}
                                {/* Projectiles */}
                                {/* Projectiles disabled */}
                                
                                {/* Enemy Projectiles */}
                                {enemyProjectiles.some(p => Math.round(p.x) === x && Math.round(p.y) === y) && (
                                     <div className="absolute inset-0 flex items-center justify-center z-20">
                                        <div className="w-[60%] h-[60%] bg-red-500 border-2 border-white shadow-[0_0_10px_rgba(255,0,0,1)] rounded-none" />
                                     </div>
                                )}
                                {/* Binary Numbers */}
                                {(cell === BINARY_0 || cell === BINARY_1) && (
                                    <div 
                                        className="absolute inset-0 flex items-center justify-center font-mono font-bold text-black text-xs sm:text-sm pointer-events-none select-none transition-transform duration-500"
                                        style={{ transform: `rotate(${-rotation}deg)` }}
                                    >
                                        {cell === BINARY_0 ? "0" : "1"}
                                    </div>
                                )}
                                {/* Level 6 Cannons - BIGGER */}
                                {level === 6 && (
                                    (x === 3 && y === 3) || 
                                    (x === GRID_SIZE - 4 && y === 3) || 
                                    (x === 3 && y === GRID_SIZE - 4)
                                ) && (
                                    <div className="absolute inset-[-50%] flex items-center justify-center z-20 pointer-events-none">
                                        <div className="w-[180%] h-[180%] bg-black/80 rounded-full flex items-center justify-center border-2 border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.6)]">
                                            <Crosshair className="w-3/4 h-3/4 text-red-500 animate-[spin_4s_linear_infinite]" />
                                            <div className="absolute inset-0 border border-red-500/30 rounded-full animate-ping" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    ))}
                </div>
            </motion.div>

            {/* Level 6: In-Game HUD Overlay */}
            {level === 6 && gameState === 'playing' && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 bg-black/80 backdrop-blur-sm px-6 py-3 rounded-full border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)] flex flex-col items-center pointer-events-none">
                    <div className="text-[10px] font-bold text-cyan-400 tracking-widest uppercase mb-1">SEQUENZA</div>
                    <div className="flex items-center gap-1 font-mono text-2xl font-black tracking-widest">
                        <span className="text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]">{currentBinary}</span>
                        <span className="text-white animate-pulse">{targetBinary.slice(currentBinary.length, currentBinary.length + 1)}</span>
                        <span className="text-neutral-600 text-lg">{targetBinary.slice(currentBinary.length + 1)}</span>
                    </div>
                    {/* Mini Progress */}
                    <div className="w-full h-0.5 bg-neutral-800 mt-1 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-cyan-500 transition-all duration-300 ease-out"
                            style={{ width: `${(currentBinary.length / targetBinary.length) * 100}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Overlays */}
            <AnimatePresence>
                {gameState === 'level_complete' && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md"
                    >
                        <Trophy className="w-12 h-12 text-yellow-400 mb-6 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
                        <h2 className="text-2xl font-black text-white mb-6 tracking-tight uppercase">
                            {level === 0 ? "TUTORIAL COMPLETATO" : `LIVELLO ${level} SUPERATO`}
                        </h2>

                        <div className="mb-8 w-full max-w-sm">
                            {/* Info Box Style for ALL Levels */}
                            <div className="bg-neutral-900/80 border border-neutral-700 p-6 rounded-xl relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500" />

                                {/* Level 0 -> 1 */}
                                {level === 0 && (
                                    <div className="text-left space-y-2">
                                        <div className="text-cyan-400 font-bold text-sm tracking-widest uppercase">PROSSIMO: INIZIO SISTEMA</div>
                                        <p className="text-neutral-400 text-sm font-mono">
                                            Protezione tutorial disattivata. <br/>
                                            <span className="text-white">Il Glitch è attivo e letale.</span>
                                        </p>
                                    </div>
                                )}

                                {/* Level 1 -> 2 */}
                                {level === 1 && (
                                    <div className="text-left space-y-2">
                                        <div className="text-orange-400 font-bold text-sm tracking-widest uppercase animate-pulse">⚠️ ALLARME SICUREZZA</div>
                                        <p className="text-neutral-400 text-sm font-mono">
                                            Sistemi difensivi rilevati. <br/>
                                            <span className="text-white">TORRETTE ATTIVE. Schiva i proiettili.</span>
                                        </p>
                                    </div>
                                )}

                                {/* Level 2 -> 3 */}
                                {level === 2 && (
                                    <div className="text-left space-y-2">
                                        <div className="text-red-400 font-bold text-sm tracking-widest uppercase animate-pulse">⚠️ LIVELLO CRITICO</div>
                                        <p className="text-neutral-400 text-sm font-mono">
                                            L'infezione accelera. <br/>
                                            <span className="text-white">Velocità Glitch aumentata drasticamente.</span>
                                        </p>
                                    </div>
                                )}

                                {/* Level 3 -> 4 */}
                                {level === 3 && (
                                    <div className="text-left space-y-2">
                                        <div className="text-purple-400 font-bold text-sm tracking-widest uppercase animate-pulse">⚠️ ANOMALIA FLUSSO</div>
                                        <p className="text-neutral-400 text-sm font-mono">
                                            Rilevata onda energetica. <br/>
                                            <span className="text-white">Il FLUSSO cancella tutto al suo passaggio.</span>
                                        </p>
                                    </div>
                                )}

                                {/* Level 4 -> 5 */}
                                {level === 4 && (
                                    <div className="text-left space-y-2">
                                        <div className="text-red-500 font-bold text-sm tracking-widest uppercase animate-pulse">⚠️ ERROR: WORLD_UNSTABLE</div>
                                        <p className="text-neutral-400 text-sm font-mono">
                                            Corruzione strutturale. <br/>
                                            <span className="text-white">I MURI SI SPOSTANO casualmente.</span>
                                        </p>
                                    </div>
                                )}

                                {/* Level 5 -> 6 (Major Change) */}
                                {level === 5 && (
                                    <div className="text-left space-y-3">
                                        <div className="text-green-400 font-bold text-sm tracking-widest uppercase animate-pulse border-b border-green-900/50 pb-2">
                                            ⚠️ SYSTEM REBOOT ⚠️
                                        </div>
                                        <ul className="text-xs sm:text-sm space-y-2 text-neutral-300 font-mono">
                                            <li className="flex gap-2">
                                                <span className="text-cyan-400 font-bold">1.</span>
                                                <span><span className="text-white font-bold">1 Swipe = 1 Passo.</span> Movimento a scatti.</span>
                                            </li>
                                            <li className="flex gap-2">
                                                <span className="text-cyan-400 font-bold">2.</span>
                                                <span>Raccogli <span className="text-white font-bold">0</span> e <span className="text-white font-bold">1</span> nella sequenza corretta.</span>
                                            </li>
                                            <li className="flex gap-2">
                                                <span className="text-red-500 font-bold">!</span>
                                                <span>La rotazione <span className="text-white font-bold">INVERTE</span> i valori!</span>
                                            </li>
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>

                        <Button onClick={nextLevel} className="bg-white text-black hover:bg-cyan-400 hover:text-black font-bold px-8 py-6 rounded-none border-2 border-transparent hover:border-white transition-all w-64">
                            <FastForward className="w-5 h-5 mr-2" /> {level === 0 ? "AVVIA GIOCO" : "PROSSIMO LIVELLO"}
                        </Button>
                        <button onClick={() => setGameState('menu')} className="mt-4 text-neutral-500 hover:text-white text-xs font-mono underline">
                            TORNA AL MENU
                        </button>
                        </motion.div>
                    )}
                    {gameState === 'won' && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-8 text-center backdrop-blur-sm"
                    >
                        <Trophy className="w-16 h-16 text-yellow-400 mb-4" />
                        <h2 className="text-3xl font-bold text-white mb-2">SISTEMA EVASO</h2>
                        <p className="text-neutral-400 mb-8">Sei sopravvissuto a tutti i livelli.</p>
                        <Button onClick={() => startLevel(1, true)} className="bg-yellow-400 text-black hover:bg-yellow-500 font-bold">
                            <RefreshCw className="w-4 h-4 mr-2" /> RIAVVIA SISTEMA (LIV 1)
                        </Button>
                        <button onClick={() => setGameState('menu')} className="mt-4 text-neutral-500 hover:text-white text-xs font-mono underline">
                            TORNA AL MENU
                        </button>
                        </motion.div>
                    )}
                    {gameState === 'lost' && (
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="absolute inset-0 z-50 bg-red-950/90 flex flex-col items-center justify-center p-8 text-center backdrop-blur-sm"
                        >
                            <Skull className="w-16 h-16 text-red-500 mb-4" />
                            <h2 className="text-3xl font-bold text-white mb-2">VITA PERSA</h2>
                            <p className="text-red-300 mb-8">Rilevamento anomalia.</p>
                            <Button onClick={restartLevel} className="bg-red-600 text-white hover:bg-red-700 font-bold">
                                <RotateCcw className="w-4 h-4 mr-2" /> RIPROVA ({lives} VITE RIMASTE)
                            </Button>
                            <button onClick={() => setGameState('menu')} className="mt-4 text-neutral-500 hover:text-white text-xs font-mono underline">
                                TORNA AL MENU
                            </button>
                            </motion.div>
                        )}
                    {gameState === 'game_over' && (
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center p-8 text-center"
                        >
                            <Skull className="w-20 h-20 text-neutral-800 mb-4 animate-pulse" />
                            <h2 className="text-4xl font-black text-red-600 mb-2 glitch-text">GAME OVER</h2>
                            <p className="text-neutral-500 mb-8 font-mono">Il sistema è stato compromesso definitivamente.</p>
                            <Button onClick={() => startLevel(1, true)} className="bg-white text-black hover:bg-neutral-200 font-bold px-8 py-4">
                                <RefreshCw className="w-4 h-4 mr-2" /> REBOOT SISTEMA (LIV 1)
                            </Button>
                            <button onClick={() => setGameState('menu')} className="mt-4 text-neutral-500 hover:text-white text-xs font-mono underline">
                                TORNA AL MENU
                            </button>
                            </motion.div>
                    )}
            </AnimatePresence>
        </div>


    </div>
  );
}