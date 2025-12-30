import Phaser from 'phaser';

export default class Level4 extends Phaser.Scene {
    constructor() {
        super({ key: 'Level4' });
    }

    create() {
        // --- Constants ---
        this.GRID_SIZE = 21;
        this.TILE_SIZE = Math.min(this.scale.width, this.scale.height) / this.GRID_SIZE;
        this.MOVE_SPEED = this.registry.get('moveSpeed') || 220;
        this.ROTATION_INTERVAL = 7000;
        this.WALL_SHUFFLE_INTERVAL = 3000; // Walls change every 3s
        this.FLUX_SPEED = 1600; // Faster flux
        this.SHOOT_INTERVAL = 1500; // Rapid fire

        // --- State ---
        this.playerPos = { x: 10, y: 10 }; 
        this.grid = []; 
        this.tileSprites = []; 
        this.heals = []; 
        this.projectiles = [];
        
        this.nextDirection = { x: 0, y: 0 };
        this.currentDirection = { x: 0, y: 0 };
        this.lastMoveTime = 0;
        
        this.lives = this.registry.get('lives') || 3;
        this.isGameOver = false;
        this.isWon = false;
        
        this.rotationTimer = 0;
        this.currentRotation = 0;

        // Flux State
        const dirs = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
        this.fluxDir = dirs[Math.floor(Math.random() * dirs.length)];
        this.fluxIndex = -1; // Starting index (off-grid)
        
        this.cameras.main.setBackgroundColor('#e5e5e5');
        
        this.initLevelLayout();
        this.drawGrid();
        this.setupPlayer();
        this.setupInputs();
        this.updateUI();

        // Wall Shuffle Timer
        this.time.addEvent({
            delay: this.WALL_SHUFFLE_INTERVAL,
            callback: this.shuffleWalls,
            callbackScope: this,
            loop: true
        });

        // Flux Advance Timer
        this.time.addEvent({
            delay: this.FLUX_SPEED,
            callback: this.advanceFlux,
            callbackScope: this,
            loop: true
        });

        // Shooting Timer
        this.time.addEvent({
            delay: this.SHOOT_INTERVAL,
            callback: this.shootProjectiles,
            callbackScope: this,
            loop: true
        });

        // Projectile Move Timer
        this.time.addEvent({
            delay: 150, 
            callback: this.moveProjectiles,
            callbackScope: this,
            loop: true
        });
    }

    initLevelLayout() {
        // Determine Start/End based on Flux Direction
        // Flux moves FROM a direction across the board.
        // Player should start near Flux origin (run away!) or opposite? 
        // User said: "Flusso avanza da uno dei lati... portando via tutto".
        // Let's spawn player safe relative to flux start, and End on the far side.
        
        let startX = 10, startY = 10;
        let endX = 10, endY = 10;
        
        if (this.fluxDir === 'DOWN') { // Top to Bottom
            this.fluxIndex = -1;
            startX = 10; startY = 4;
            endX = 10; endY = 18;
        } else if (this.fluxDir === 'UP') { // Bottom to Top
            this.fluxIndex = this.GRID_SIZE;
            startX = 10; startY = 16;
            endX = 10; endY = 2;
        } else if (this.fluxDir === 'RIGHT') { // Left to Right
            this.fluxIndex = -1;
            startX = 4; startY = 10;
            endX = 18; endY = 10;
        } else { // LEFT (Right to Left)
            this.fluxIndex = this.GRID_SIZE;
            startX = 16; startY = 10;
            endX = 2; endY = 10;
        }
        
        this.playerPos = { x: startX, y: startY };
        this.endPos = { x: endX, y: endY };
        
        this.generateGrid();
    }

    generateGrid() {
        this.grid = Array(this.GRID_SIZE).fill().map(() => Array(this.GRID_SIZE).fill(0));
        this.tileTexts = Array(this.GRID_SIZE).fill().map(() => Array(this.GRID_SIZE).fill(null));
        
        // 1. Fill with high density walls
        for (let y = 0; y < this.GRID_SIZE; y++) {
            for (let x = 0; x < this.GRID_SIZE; x++) {
                 // Leave margins for Finder Patterns (always safe/empty or walls? Standard is clear/wall specific)
                 if (!this.isFinderZone(x, y)) {
                     if (Math.random() < 0.45) this.grid[y][x] = 1;
                 }
            }
        }
        
        // 2. Add Finder Patterns
        const addFinder = (ox, oy) => {
            for(let y=0; y<7; y++) for(let x=0; x<7; x++) {
                if (ox+x < this.GRID_SIZE && oy+y < this.GRID_SIZE) {
                     if (y===0 || y===6 || x===0 || x===6 || (y>=2 && y<=4 && x>=2 && x<=4)) this.grid[oy+y][ox+x] = 1;
                     else this.grid[oy+y][ox+x] = 0;
                }
            }
        };
        addFinder(0, 0); 
        addFinder(this.GRID_SIZE-7, 0); 
        addFinder(0, this.GRID_SIZE-7); 

        // 3. Set End
        this.grid[this.endPos.y][this.endPos.x] = 3;

        // 4. Ensure Path from Player to End (Carve)
        this.carvePath(this.playerPos, this.endPos);

        // 5. Apply Flux (if any cells are already overtaken)
        this.applyFluxToGrid();
    }

    carvePath(start, end) {
        // Simple drunkard's walk or direct path carving to ensure solvability
        let cx = start.x, cy = start.y;
        let timeout = 0;
        
        // Clear start area
        this.grid[cy][cx] = 0; 
        
        while((cx !== end.x || cy !== end.y) && timeout < 1000) {
            const dx = end.x - cx;
            const dy = end.y - cy;
            
            // Move towards end mostly
            if (Math.random() < 0.7) {
                if (Math.abs(dx) > Math.abs(dy)) cx += Math.sign(dx);
                else cy += Math.sign(dy);
            } else {
                // Random deviation
                 if (Math.random() < 0.5) cx += (Math.random()>0.5?1:-1);
                 else cy += (Math.random()>0.5?1:-1);
            }
            
            // Clamp
            cx = Math.max(0, Math.min(this.GRID_SIZE-1, cx));
            cy = Math.max(0, Math.min(this.GRID_SIZE-1, cy));
            
            this.grid[cy][cx] = 0; // Clear wall
            if (cx === end.x && cy === end.y) this.grid[cy][cx] = 3; // Restore end if overwritten
            
            timeout++;
        }
    }

    shuffleWalls() {
        if (this.isGameOver || this.isWon) return;

        // Keep player safe
        const currentP = this.playerPos;
        const currentE = this.endPos;

        // Regenerate noise
        for(let y=0; y<this.GRID_SIZE; y++) {
            for(let x=0; x<this.GRID_SIZE; x++) {
                if (!this.isFinderZone(x, y) && (x!==currentP.x || y!==currentP.y) && (x!==currentE.x || y!==currentE.y)) {
                    // Don't overwrite Glitch (5) from Flux
                    if (this.grid[y][x] !== 5) {
                         this.grid[y][x] = Math.random() < 0.45 ? 1 : 0;
                    }
                }
            }
        }

        // Re-carve path to ensure connectivity
        this.carvePath(currentP, currentE);
        
        // Redraw
        this.updateAllTiles();
        
        // No flash - smoother transition
    }

    advanceFlux() {
        if (this.isGameOver || this.isWon) return;

        if (this.fluxDir === 'DOWN' || this.fluxDir === 'RIGHT') {
            this.fluxIndex++;
        } else {
            this.fluxIndex--;
        }

        this.applyFluxToGrid();
        
        // Check collision with player
        if (this.grid[this.playerPos.y][this.playerPos.x] === 5) {
            this.handleDamage(true); // Instant death or heavy damage? Let's say heavy damage.
        }
    }

    applyFluxToGrid() {
        // Turn everything behind fluxIndex into Glitch (5)
        for(let i=0; i<this.GRID_SIZE; i++) {
            // Depending on direction, i is x or y
            // We need to fill the "wave"
            
            // Actually, simpler: just set the specific row/col at fluxIndex to 5?
            // "Portando via tutto" -> Usually means it accumulates. 
            // So everything < fluxIndex (for Down/Right) is Glitch.
            
            let tx = -1, ty = -1;
            
            if (this.fluxDir === 'DOWN') {
                if (i <= this.fluxIndex) { // Rows up to index
                    for(let x=0; x<this.GRID_SIZE; x++) this.grid[i][x] = 5;
                }
            } else if (this.fluxDir === 'UP') {
                if (i >= this.fluxIndex && this.fluxIndex !== this.GRID_SIZE) { // Rows down to index
                     for(let x=0; x<this.GRID_SIZE; x++) this.grid[i][x] = 5;
                }
            } else if (this.fluxDir === 'RIGHT') {
                if (i <= this.fluxIndex) {
                     for(let y=0; y<this.GRID_SIZE; y++) this.grid[y][i] = 5;
                }
            } else if (this.fluxDir === 'LEFT') {
                 if (i >= this.fluxIndex && this.fluxIndex !== this.GRID_SIZE) {
                     for(let y=0; y<this.GRID_SIZE; y++) this.grid[y][i] = 5;
                 }
            }
        }
        this.updateAllTiles();
    }

    drawGrid() {
        this.tileSprites = [];
        const size = this.TILE_SIZE - 1; 
        for (let y = 0; y < this.GRID_SIZE; y++) {
            const rowSprites = [];
            const rowTexts = [];
            for (let x = 0; x < this.GRID_SIZE; x++) {
                const cx = x * this.TILE_SIZE + this.TILE_SIZE / 2;
                const cy = y * this.TILE_SIZE + this.TILE_SIZE / 2;
                const rect = this.add.rectangle(cx, cy, size, size, 0xffffff);
                rowSprites.push(rect);
                
                const text = this.add.text(cx, cy, '', {
                    fontFamily: 'monospace',
                    fontSize: `${size * 0.6}px`,
                    color: '#ffffff',
                    fontStyle: 'bold',
                    align: 'center'
                }).setOrigin(0.5);
                rowTexts.push(text);
                
                this.updateTileVisualByObj(rect, text, this.grid[y][x]);
            }
            this.tileSprites.push(rowSprites);
            this.tileTexts.push(rowTexts);
        }
    }

    updateAllTiles() {
        for(let y=0; y<this.GRID_SIZE; y++) {
            for(let x=0; x<this.GRID_SIZE; x++) {
                this.updateTileVisual(x, y);
            }
        }
    }

    updateTileVisual(x, y) {
        if (x < 0 || x >= this.GRID_SIZE || y < 0 || y >= this.GRID_SIZE) return;
        if (!this.tileSprites || !this.tileSprites[y] || !this.tileSprites[y][x]) return;
        this.updateTileVisualByObj(this.tileSprites[y][x], this.tileTexts[y][x], this.grid[y][x]);
    }

    updateTileVisualByObj(rect, text, type) {
        if (text) text.setText('');
        
        if (type === 1) rect.setFillStyle(0x000000);
        else if (type === 3) rect.setFillStyle(0x22c55e); // End
        else if (type === 5) rect.setFillStyle(0xdc2626); // Glitch/Flux
        else rect.setFillStyle(0xffffff);
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
                if (Math.abs(dx) > Math.abs(dy)) this.handleInput(dx > 0 ? 1 : -1, 0);
                else this.handleInput(0, dy > 0 ? 1 : -1);
            }
        });
    }

    handleInput(dx, dy) {
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

        if (this.cursors.left.isDown || this.wasd.left.isDown) this.handleInput(-1, 0);
        else if (this.cursors.right.isDown || this.wasd.right.isDown) this.handleInput(1, 0);
        else if (this.cursors.up.isDown || this.wasd.up.isDown) this.handleInput(0, -1);
        else if (this.cursors.down.isDown || this.wasd.down.isDown) this.handleInput(0, 1);

        if (time - this.lastMoveTime > this.MOVE_SPEED) {
            this.movePlayer();
            this.lastMoveTime = time;
        }

        if (!this.nextRotationTime) this.nextRotationTime = time + this.ROTATION_INTERVAL;
        if (time > this.nextRotationTime) {
            this.rotateWorld();
            this.nextRotationTime = time + this.ROTATION_INTERVAL;
        }

        const timeLeft = Math.max(0, Math.ceil((this.nextRotationTime - time) / 1000));
        this.updateUI(timeLeft);
    }

    shootProjectiles() {
        if (this.isGameOver) return;
        
        // Shoot from Flux/Glitches (5)
        const glitches = [];
        for(let y=0; y<this.GRID_SIZE; y++) {
            for(let x=0; x<this.GRID_SIZE; x++) {
                if(this.grid[y][x] === 5) glitches.push({x, y});
            }
        }
        
        if (glitches.length === 0) return;

        // Shoot from random points in the flux
        const shootersCount = Math.min(glitches.length, 4);
        
        for (let i = glitches.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [glitches[i], glitches[j]] = [glitches[j], glitches[i]];
        }

        for(let i=0; i<shootersCount; i++) {
            const shooter = glitches[i];
            
            let dx = this.playerPos.x - shooter.x;
            let dy = this.playerPos.y - shooter.y;
            
            let dirX = 0, dirY = 0;
            if (Math.abs(dx) > Math.abs(dy)) dirX = Math.sign(dx);
            else dirY = Math.sign(dy);
            
            if (dirX === 0 && dirY === 0) continue;

            const projSprite = this.add.rectangle(
                shooter.x * this.TILE_SIZE + this.TILE_SIZE/2,
                shooter.y * this.TILE_SIZE + this.TILE_SIZE/2,
                this.TILE_SIZE/2, this.TILE_SIZE/2, 
                0xff0000 
            );
            projSprite.setDepth(15);

            this.projectiles.push({
                x: shooter.x,
                y: shooter.y,
                dx: dirX,
                dy: dirY,
                sprite: projSprite
            });
        }
        this.game.events.emit('play-sound', 'shoot');
    }

    moveProjectiles() {
        const remaining = [];
        this.projectiles.forEach(p => {
            const nx = p.x + p.dx;
            const ny = p.y + p.dy;
            
            if (Math.round(nx) === this.playerPos.x && Math.round(ny) === this.playerPos.y) {
                this.handleDamage();
                p.sprite.destroy();
                return;
            }

            if (nx < 0 || nx >= this.GRID_SIZE || ny < 0 || ny >= this.GRID_SIZE) {
                p.sprite.destroy();
                return;
            }
            
            p.x = nx;
            p.y = ny;
            p.sprite.x = p.x * this.TILE_SIZE + this.TILE_SIZE/2;
            p.sprite.y = p.y * this.TILE_SIZE + this.TILE_SIZE/2;
            remaining.push(p);
        });
        this.projectiles = remaining;
    }

    rotateWorld() {
        this.currentRotation += 90;
        this.tweens.add({
            targets: this.cameras.main,
            rotation: Phaser.Math.DegToRad(this.currentRotation),
            duration: 1000,
            ease: 'Cubic.easeOut'
        });
    }

    movePlayer() {
        if (this.currentDirection.x === 0 && this.currentDirection.y === 0 && (this.nextDirection.x !== 0 || this.nextDirection.y !== 0)) {
            this.currentDirection = { ...this.nextDirection };
        } else if (this.nextDirection.x !== 0 || this.nextDirection.y !== 0) {
            this.currentDirection = { ...this.nextDirection };
        }

        if (this.currentDirection.x === 0 && this.currentDirection.y === 0) return;

        let nextX = this.playerPos.x + this.currentDirection.x;
        let nextY = this.playerPos.y + this.currentDirection.y;

        // Wrap Logic (Disabled for Level 4? "Portando via tutto" -> Usually implies finite board or inescapable doom)
        // Let's keep Wrap logic but if you wrap into Flux you die.
        if (nextX < 0) nextX = this.GRID_SIZE - 1;
        if (nextX >= this.GRID_SIZE) nextX = 0;
        if (nextY < 0) nextY = this.GRID_SIZE - 1;
        if (nextY >= this.GRID_SIZE) nextY = 0;

        const cell = this.grid[nextY][nextX];
        if (cell !== 1) { 
            this.playerPos = { x: nextX, y: nextY };
            
            // Update player symbol based on direction
            if (this.currentDirection.x > 0) this.playerSymbol.setText('>');
            else if (this.currentDirection.x < 0) this.playerSymbol.setText('<');
            else if (this.currentDirection.y > 0) this.playerSymbol.setText('v');
            else if (this.currentDirection.y < 0) this.playerSymbol.setText('^');
            
            if (cell === 3) this.handleWin();
            else if (cell === 5) this.handleDamage(true); // Flux kill

            this.updatePlayerVisuals();
        }
    }

    updatePlayerVisuals() {
        this.player.x = this.playerPos.x * this.TILE_SIZE + this.TILE_SIZE / 2;
        this.player.y = this.playerPos.y * this.TILE_SIZE + this.TILE_SIZE / 2;
        this.playerSymbol.x = this.playerPos.x * this.TILE_SIZE + this.TILE_SIZE / 2;
        this.playerSymbol.y = this.playerPos.y * this.TILE_SIZE + this.TILE_SIZE / 2;
    }

    isFinderZone(x, y) {
        if (x <= 6 && y <= 6) return true;
        if (x >= this.GRID_SIZE - 7 && y <= 6) return true;
        if (x <= 6 && y >= this.GRID_SIZE - 7) return true;
        return false;
    }

    handleDamage(instant = false) {
        this.game.events.emit('play-sound', 'damage');
        if (instant) this.lives = 0;
        else this.lives--;
        
        this.cameras.main.shake(200, 0.01);
        if (this.lives <= 0) {
            this.isGameOver = true;
            this.game.events.emit('game-over', { win: false });
            this.scene.pause();
        } else {
            this.updateUI();
        }
    }

    handleWin() {
        this.isWon = true;
        this.game.events.emit('game-over', { win: true, nextLevel: 5 });
        this.scene.pause();
    }

    updateUI(timeLeft = 7) {
        this.game.events.emit('update-ui', {
            lives: this.lives,
            level: 4,
            timeLeft: timeLeft
        });
    }
}