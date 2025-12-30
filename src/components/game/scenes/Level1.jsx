import Phaser from 'phaser';

export default class Level1 extends Phaser.Scene {
    constructor() {
        super({ key: 'Level1' });
    }

    create() {
        // --- Constants ---
        this.GRID_SIZE = 21;
        this.TILE_SIZE = Math.min(this.scale.width, this.scale.height) / this.GRID_SIZE;
        this.MOVE_SPEED = 220; 
        this.GLITCH_SPEED = 800;
        this.ROTATION_INTERVAL = 7000;

        // --- State ---
        this.playerPos = { x: 8, y: 8 };
        this.grid = []; 
        this.tileSprites = []; 
        this.nextDirection = { x: 0, y: 0 };
        this.currentDirection = { x: 0, y: 0 };
        this.lastMoveTime = 0;
        
        this.lives = this.registry.get('lives') || 3;
        this.isGameOver = false;
        this.isWon = false;
        
        this.rotationTimer = 0;
        this.rotationCount = 0;
        this.currentRotation = 0; // Degrees

        // --- Setup ---
        this.cameras.main.setBackgroundColor('#e5e5e5'); // Light gray for grid lines effect
        
        this.generateGrid();
        this.drawGrid();
        this.setupPlayer();
        this.setupInputs();
        
        // Initial Glitch
        this.spawnInitialGlitch();

        // UI Event
        this.updateUI();
    }

    generateGrid() {
        // 0: Path, 1: Wall, 3: End, 5: Glitch
        this.grid = Array(this.GRID_SIZE).fill().map(() => Array(this.GRID_SIZE).fill(0));

        // Random Walls (Density 0.3)
        for (let y = 0; y < this.GRID_SIZE; y++) {
            for (let x = 0; x < this.GRID_SIZE; x++) {
                if (Math.random() < 0.3) this.grid[y][x] = 1;
            }
        }

        // Finder Patterns
        const addFinder = (ox, oy) => {
            for(let y=0; y<7; y++) {
                for(let x=0; x<7; x++) {
                    if (ox+x < this.GRID_SIZE && oy+y < this.GRID_SIZE) {
                        if (y===0 || y===6 || x===0 || x===6 || (y>=2 && y<=4 && x>=2 && x<=4)) {
                            this.grid[oy+y][ox+x] = 1; 
                        } else {
                            this.grid[oy+y][ox+x] = 0; 
                        }
                    }
                }
            }
        };

        addFinder(0, 0); 
        addFinder(this.GRID_SIZE-7, 0); 
        addFinder(0, this.GRID_SIZE-7); 

        // Clear Start
        this.grid[8][8] = 0; 
        this.grid[8][9] = 0; this.grid[9][8] = 0;

        // Place End avoiding finder zones
        let endPlaced = false;
        let attempts = 0;
        while (!endPlaced && attempts < 100) {
            const rx = Math.floor(Math.random() * this.GRID_SIZE);
            const ry = Math.floor(Math.random() * this.GRID_SIZE);
            const dist = Math.abs(rx - 8) + Math.abs(ry - 8);
            if (this.grid[ry][rx] === 0 && !this.isFinderZone(rx, ry) && dist > 5) {
                this.grid[ry][rx] = 3;
                endPlaced = true;
            }
            attempts++;
        }

        // Find end position and ensure path
        let endPos = null;
        for (let y = 0; y < this.GRID_SIZE; y++) {
            for (let x = 0; x < this.GRID_SIZE; x++) {
                if (this.grid[y][x] === 3) {
                    endPos = {x, y};
                    break;
                }
            }
            if (endPos) break;
        }
        if (endPos) this.carvePath({x:8, y:8}, endPos);
    }

    carvePath(start, end) {
        let cx = start.x, cy = start.y;
        let timeout = 0;
        this.grid[cy][cx] = 0; 
        while((cx !== end.x || cy !== end.y) && timeout < 2000) {
            const dx = end.x - cx;
            const dy = end.y - cy;
            if (Math.random() < 0.7) {
                if (Math.abs(dx) > Math.abs(dy)) cx += Math.sign(dx);
                else cy += Math.sign(dy);
            } else {
                 if (Math.random() < 0.5) cx += (Math.random()>0.5?1:-1);
                 else cy += (Math.random()>0.5?1:-1);
            }
            cx = Math.max(0, Math.min(this.GRID_SIZE-1, cx));
            cy = Math.max(0, Math.min(this.GRID_SIZE-1, cy));
            this.grid[cy][cx] = 0; 
            if (cx === end.x && cy === end.y) this.grid[cy][cx] = 3; 
            timeout++;
        }
    }

    drawGrid() {
        // Clear existing if any (though usually create is called once per scene start)
        this.tileSprites = [];
        const size = this.TILE_SIZE - 1; // Gap for grid effect

        for (let y = 0; y < this.GRID_SIZE; y++) {
            const row = [];
            for (let x = 0; x < this.GRID_SIZE; x++) {
                const cx = x * this.TILE_SIZE + this.TILE_SIZE / 2;
                const cy = y * this.TILE_SIZE + this.TILE_SIZE / 2;
                
                const rect = this.add.rectangle(cx, cy, size, size, 0xffffff);
                row.push(rect);
                this.updateTileVisualByObj(rect, this.grid[y][x]);
            }
            this.tileSprites.push(row);
        }
    }

    updateTileVisual(x, y) {
        if (x < 0 || x >= this.GRID_SIZE || y < 0 || y >= this.GRID_SIZE) return;
        this.updateTileVisualByObj(this.tileSprites[y][x], this.grid[y][x]);
    }

    updateTileVisualByObj(rect, type) {
        if (type === 1) {
            rect.setFillStyle(0x000000);
            rect.setDepth(0);
        } else if (type === 3) {
            rect.setFillStyle(0x22c55e);
            rect.setDepth(20);
        } else if (type === 5) {
            rect.setFillStyle(0xdc2626);
            rect.setDepth(0);
        } else {
            rect.setFillStyle(0xffffff);
            rect.setDepth(0);
        }
    }

    setupPlayer() {
        // Purple player with terminal symbol
        this.player = this.add.rectangle(
            this.playerPos.x * this.TILE_SIZE + this.TILE_SIZE / 2,
            this.playerPos.y * this.TILE_SIZE + this.TILE_SIZE / 2,
            this.TILE_SIZE - 2,
            this.TILE_SIZE - 2,
            0x9333ea
        );
        this.player.setDepth(10);
        
        // Terminal symbol ">"
        this.playerSymbol = this.add.text(
            this.playerPos.x * this.TILE_SIZE + this.TILE_SIZE / 2,
            this.playerPos.y * this.TILE_SIZE + this.TILE_SIZE / 2,
            '>',
            {
                fontFamily: 'monospace',
                fontSize: `${this.TILE_SIZE * 0.7}px`,
                color: '#ffffff',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);
        this.playerSymbol.setDepth(11);
    }

    setupInputs() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });

        this.input.on('pointerdown', (pointer) => {
            this.touchStartX = pointer.x;
            this.touchStartY = pointer.y;
        });

        this.input.on('pointerup', (pointer) => {
            const dx = pointer.x - this.touchStartX;
            const dy = pointer.y - this.touchStartY;
            const threshold = 20;

            if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
                if (Math.abs(dx) > Math.abs(dy)) {
                    this.handleInput(dx > 0 ? 1 : -1, 0);
                } else {
                    this.handleInput(0, dy > 0 ? 1 : -1);
                }
            }
        });
    }

    handleInput(dx, dy) {
        // dx, dy are Screen relative directions (1,0 is Right, 0,-1 is Up)
        // We need to rotate this vector by -CameraRotation to get Grid direction
        
        const rad = -this.cameras.main.rotation;
        const gridDx = Math.round(dx * Math.cos(rad) - dy * Math.sin(rad));
        const gridDy = Math.round(dx * Math.sin(rad) + dy * Math.cos(rad));

        this.setDirection(gridDx, gridDy);
    }

    setDirection(dx, dy) {
        this.nextDirection = { x: dx, y: dy };
    }

    update(time, delta) {
        if (this.isGameOver || this.isWon) return;

        // Keyboard Inputs (screen relative mapping)
        // ArrowUp is Screen Up.
        if (this.cursors.left.isDown || this.wasd.left.isDown) this.handleInput(-1, 0);
        else if (this.cursors.right.isDown || this.wasd.right.isDown) this.handleInput(1, 0);
        else if (this.cursors.up.isDown || this.wasd.up.isDown) this.handleInput(0, -1);
        else if (this.cursors.down.isDown || this.wasd.down.isDown) this.handleInput(0, 1);

        // Movement Loop
        if (time - this.lastMoveTime > this.MOVE_SPEED) {
            this.movePlayer();
            this.lastMoveTime = time;
        }

        // Glitch Logic
        if (time > (this.glitchTimer || 0)) {
            // Init timer if 0
            if (!this.glitchTimer) this.glitchTimer = time + this.GLITCH_SPEED;
            else {
                this.expandGlitch();
                this.glitchTimer = time + this.GLITCH_SPEED;
            }
        }

        // Rotation Logic
        if (!this.nextRotationTime) this.nextRotationTime = time + this.ROTATION_INTERVAL;
        
        if (time > this.nextRotationTime) {
            this.rotateWorld();
            this.nextRotationTime = time + this.ROTATION_INTERVAL;
        }

        // Update UI Timer
        const timeLeft = Math.max(0, Math.ceil((this.nextRotationTime - time) / 1000));
        this.updateUI(timeLeft);
    }

    rotateWorld() {
        this.rotationCount++;
        this.currentRotation += 90;
        
        this.tweens.add({
            targets: this.cameras.main,
            rotation: Phaser.Math.DegToRad(this.currentRotation),
            duration: 1000,
            ease: 'Cubic.easeOut'
        });

        // Move End Point every 2 rotations
        if (this.rotationCount % 2 === 0) {
            this.relocateEndPoint();
        }
    }

    relocateEndPoint() {
        // Clear old end
        let oldEnd = null;
        for(let y=0; y<this.GRID_SIZE; y++) {
            for(let x=0; x<this.GRID_SIZE; x++) {
                if(this.grid[y][x] === 3) {
                    this.grid[y][x] = 0;
                    this.updateTileVisual(x, y);
                    oldEnd = {x, y};
                }
            }
        }

        // BFS to find all reachable valid tiles
        const reachable = [];
        const queue = [{x: this.playerPos.x, y: this.playerPos.y}];
        const visited = new Set([`${this.playerPos.x},${this.playerPos.y}`]);

        while(queue.length > 0) {
            const {x, y} = queue.shift();

            // Collect valid candidates (not player pos)
            if ((x !== this.playerPos.x || y !== this.playerPos.y) && 
                !this.isFinderZone(x, y) && 
                this.grid[y][x] === 0) {
                reachable.push({x, y});
            }

            // Neighbors
            [[0,1], [0,-1], [1,0], [-1,0]].forEach(([dx, dy]) => {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < this.GRID_SIZE && ny >= 0 && ny < this.GRID_SIZE) {
                    // Allow moving through Path (0), End (3 if any), Glitch (5) - risky but traversable? 
                    // Let's assume Glitch is NOT safe to walk through for pathfinding safely?
                    // Actually player CAN walk on glitch but takes damage. 
                    // Ideally we want a path that is free of walls (1).
                    if (this.grid[ny][nx] !== 1 && !visited.has(`${nx},${ny}`)) {
                        visited.add(`${nx},${ny}`);
                        queue.push({x: nx, y: ny});
                    }
                }
            });
        }

        // Filter out finder zones from reachable
        const validReachable = reachable.filter(p => !this.isFinderZone(p.x, p.y));
        
        if (validReachable.length > 0) {
            const target = validReachable[Math.floor(Math.random() * validReachable.length)];
            this.grid[target.y][target.x] = 3;
            this.updateTileVisual(target.x, target.y);
        } else if (oldEnd) {
            // Fallback: put back old if no reachable spots found (trapped)
            this.grid[oldEnd.y][oldEnd.x] = 3;
            this.updateTileVisual(oldEnd.x, oldEnd.y);
        }
    }

    movePlayer() {
        if (this.nextDirection.x !== 0 || this.nextDirection.y !== 0) {
            this.currentDirection = { ...this.nextDirection };
        }
        if (this.currentDirection.x === 0 && this.currentDirection.y === 0) return;

        // Sound on move removed
        let nextX = this.playerPos.x + this.currentDirection.x;
        let nextY = this.playerPos.y + this.currentDirection.y;

        // Wrap Logic
        if (nextX < 0) nextX = this.GRID_SIZE - 1;
        if (nextX >= this.GRID_SIZE) nextX = 0;
        if (nextY < 0) nextY = this.GRID_SIZE - 1;
        if (nextY >= this.GRID_SIZE) nextY = 0;

        const cell = this.grid[nextY][nextX];

        if (cell !== 1) { // Not Wall
            this.playerPos = { x: nextX, y: nextY };
            
            // Update player symbol based on direction
            if (this.currentDirection.x > 0) this.playerSymbol.setText('>');
            else if (this.currentDirection.x < 0) this.playerSymbol.setText('<');
            else if (this.currentDirection.y > 0) this.playerSymbol.setText('v');
            else if (this.currentDirection.y < 0) this.playerSymbol.setText('^');
            
            if (cell === 3) { // End
                this.handleWin();
            } else if (cell === 5) { // Glitch
                this.handleDamage();
            }

            this.updatePlayerVisuals();
        }
    }

    updatePlayerVisuals() {
        this.player.x = this.playerPos.x * this.TILE_SIZE + this.TILE_SIZE / 2;
        this.player.y = this.playerPos.y * this.TILE_SIZE + this.TILE_SIZE / 2;
        this.playerSymbol.x = this.playerPos.x * this.TILE_SIZE + this.TILE_SIZE / 2;
        this.playerSymbol.y = this.playerPos.y * this.TILE_SIZE + this.TILE_SIZE / 2;
    }

    spawnInitialGlitch() {
        let placed = false;
        let attempts = 0;
        while(!placed && attempts < 100) {
            const rx = Math.floor(Math.random() * this.GRID_SIZE);
            const ry = Math.floor(Math.random() * this.GRID_SIZE);
            const dist = Math.abs(rx - 8) + Math.abs(ry - 8);
            
            if (this.grid[ry][rx] === 0 && !this.isFinderZone(rx, ry) && dist > 5) {
                this.grid[ry][rx] = 5;
                this.updateTileVisual(rx, ry);
                placed = true;
            }
            attempts++;
        }
    }

    expandGlitch() {
        const newGlitchPos = [];
        
        for (let y = 0; y < this.GRID_SIZE; y++) {
            for (let x = 0; x < this.GRID_SIZE; x++) {
                if (this.grid[y][x] === 5) { // Glitch
                    const neighbors = [[0,1], [0,-1], [1,0], [-1,0]];
                    neighbors.forEach(([dx, dy]) => {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < this.GRID_SIZE && ny >= 0 && ny < this.GRID_SIZE) {
                            const target = this.grid[ny][nx];
                            // Consume Paths ONLY (do not eat Walls or Finder Zones)
                            // Strict check against walls (1) and finder zones
                            if (target !== 1 && target !== 5 && !this.isFinderZone(nx, ny)) {
                                if (Math.random() < 0.2) {
                                    newGlitchPos.push({x: nx, y: ny});
                                }
                            }
                        }
                    });
                }
            }
        }

        newGlitchPos.forEach(p => {
            this.grid[p.y][p.x] = 5;
            this.updateTileVisual(p.x, p.y);
            if (p.x === this.playerPos.x && p.y === this.playerPos.y) {
                this.handleDamage();
            }
        });
    }

    isFinderZone(x, y) {
        if (x <= 6 && y <= 6) return true;
        if (x >= this.GRID_SIZE - 7 && y <= 6) return true;
        if (x <= 6 && y >= this.GRID_SIZE - 7) return true;
        return false;
    }

    handleDamage() {
        this.game.events.emit('play-sound', 'damage');
        this.lives--;
        this.cameras.main.shake(200, 0.01);
        if (this.lives <= 0) {
            this.isGameOver = true;
            this.game.events.emit('game-over', { win: false });
            this.scene.pause();
        } else {
            this.updateUI(); // Update lives
        }
    }

    handleWin() {
        this.isWon = true;
        this.game.events.emit('game-over', { win: true, nextLevel: 2 });
        this.scene.pause();
    }

    updateUI(timeLeft = 7) {
        this.game.events.emit('update-ui', {
            lives: this.lives,
            level: 1,
            timeLeft: timeLeft
        });
    }
}